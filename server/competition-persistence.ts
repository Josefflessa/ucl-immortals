import type { D1Database } from '@cloudflare/workers-types';
import { generateImmortalReport, getAllPlayedMatchResults, getPlayerSeasonStats, getTeamEffectiveStats } from '../client/src/lib/gameEngine.js';
import { competitionRankingPoints } from '../client/src/lib/competitionRanking.js';
import type { MatchResult, PlayerCard, Team } from '../client/src/lib/gameEngine.js';
import { retainRecentCompetitionSnapshots } from './competition-history-retention.js';
import type { RoomPlayer, RoomState } from './handlers.js';

interface PersistenceEnv { DB: D1Database; }

function humanTeams(room: RoomState): Array<{ player: RoomPlayer; team: Team }> {
  return room.players.flatMap(player => player.team ? [{ player, team: player.team }] : []);
}

function teamResults(teamId: string, results: MatchResult[]): MatchResult[] {
  return results.filter(result => result.homeTeamId === teamId || result.awayTeamId === teamId);
}

function teamGoals(teamId: string, result: MatchResult): { scored: number; conceded: number } {
  return result.homeTeamId === teamId
    ? { scored: result.homeGoals, conceded: result.awayGoals }
    : { scored: result.awayGoals, conceded: result.homeGoals };
}

function placementFor(room: RoomState, teamId: string): number | null {
  const index = room.leagueStandings.findIndex(row => row.teamId === teamId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Persists only completed online campaigns. The room is authoritative here:
 * no browser-provided totals are accepted, and public records are marked
 * verified only after this server-side calculation.
 */
export async function persistCompletedCompetition(env: PersistenceEnv, room: RoomState): Promise<void> {
  const participants = humanTeams(room).filter(({ player }) => !!player.accountId);
  if (participants.length === 0) return;

  // League results live on their fixtures; knockout legs live in the bracket.
  const leagueResults = room.leagueFixtures
    .filter(fixture => fixture.played && !!fixture.result)
    .map(fixture => fixture.result!);
  const results = getAllPlayedMatchResults(leagueResults, room.knockoutBracket);
  const allTeams = [...humanTeams(room).map(({ team }) => team), ...room.botTeams];
  const allSeasonRows = allTeams.flatMap(team => team.players.map(card => ({
    card,
    team,
    stats: getPlayerSeasonStats(card.id, team.id, results),
  })));
  const leader = (metric: 'goals' | 'assists' | 'ratingAvg') => {
    const minimumPlayed = metric === 'ratingAvg' ? 3 : 0;
    const minimumValue = metric === 'ratingAvg' ? -Infinity : 1;
    const row = allSeasonRows
      .filter(candidate => candidate.stats.played >= minimumPlayed && candidate.stats[metric] > minimumValue)
      .sort((a, b) => b.stats[metric] - a.stats[metric])[0];
    return row ? {
      player: {
        id: row.card.id,
        shortName: row.card.shortName,
        photoUrl: row.card.photoUrl,
        rarity: row.card.rarity,
      },
      teamName: row.team.name,
      value: row.stats[metric],
      ...(metric === 'ratingAvg' ? { played: row.stats.played } : {}),
    } : null;
  };
  const leaders = {
    topScorer: leader('goals'),
    topRating: leader('ratingAvg'),
    topAssister: leader('assists'),
  };
  const championTeam = allTeams.find(team => team.id === room.champion);
  const championPlayer = room.players.find(player => player.id === room.champion);
  const championName = championTeam?.name ?? championPlayer?.name ?? (room.champion ? 'Campeão' : '');
  const finalResult: MatchResult | undefined = room.knockoutBracket?.final?.result;
  const sourceKey = `online:${room.code}:${room.roomEpoch}`;
  const accountIds = participants.map(({ player }) => player.accountId!);
  const profiles = await env.DB.prepare(`SELECT user_id, username FROM profiles WHERE user_id IN (${accountIds.map(() => '?').join(',')})`)
    .bind(...accountIds)
    .all<{ user_id: string; username: string }>();
  const usernames = new Map(profiles.results.map(profile => [profile.user_id, profile.username]));
  const now = Date.now();

  for (const { player, team } of participants) {
    const accountId = player.accountId!;
    const existing = await env.DB.prepare('SELECT id FROM competition_history WHERE user_id = ? AND source_key = ?')
      .bind(accountId, sourceKey)
      .first<{ id: string }>();
    if (existing) {
      await retainRecentCompetitionSnapshots(env.DB, accountId);
      continue;
    }

    const played = teamResults(team.id, results);
    const wins = played.filter(result => result.winner === team.id).length;
    const draws = played.filter(result => result.winner === null).length;
    const losses = Math.max(0, played.length - wins - draws);
    const goals = played.reduce((sum, result) => sum + teamGoals(team.id, result).scored, 0);
    const goalsAgainst = played.reduce((sum, result) => sum + teamGoals(team.id, result).conceded, 0);
    const allPlayers = team.players as PlayerCard[];
    const seasonRows = allPlayers.map(card => ({ card, stats: getPlayerSeasonStats(card.id, team.id, results) }));
    const totalAssists = seasonRows.reduce((sum, row) => sum + row.stats.assists, 0);
    const totalSaves = seasonRows.reduce((sum, row) => sum + row.stats.saves, 0);
    const topGoals = seasonRows.filter(row => row.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals)[0];
    const topAssists = seasonRows.filter(row => row.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists)[0];
    const topSaves = seasonRows.filter(row => row.stats.saves > 0).sort((a, b) => b.stats.saves - a.stats.saves)[0];
    const effective = getTeamEffectiveStats(team, {
      playStyle: team.playStyle,
      isKnockout: !!room.knockoutBracket,
      isFinal: true,
      isLosing: room.champion !== team.id,
    });
    const effectiveStatsByPlayerId = Object.fromEntries(team.players.map(card => {
      const stats = effective[card.id];
      return [card.id, {
        overall: Math.round(stats?.overall ?? card.overall),
        pace: Math.round(stats?.pace ?? card.pace),
        shooting: Math.round(stats?.shooting ?? card.shooting),
        passing: Math.round(stats?.passing ?? card.passing),
        dribbling: Math.round(stats?.dribbling ?? card.dribbling),
        defending: Math.round(stats?.defending ?? card.defending),
        physical: Math.round(stats?.physical ?? card.physical),
        vision: Math.round(stats?.vision ?? card.vision),
        composure: Math.round(stats?.composure ?? card.composure),
      }] as const;
    }));
    const effectiveOverallByPlayerId = Object.fromEntries(team.players.map(card => [
      card.id,
      effectiveStatsByPlayerId[card.id].overall,
    ]));
    const topEffective = allPlayers
      .map(card => ({ card, value: effectiveStatsByPlayerId[card.id].overall }))
      .sort((a, b) => b.value - a.value)[0];
    const champion = room.champion === team.id;
    const competitionPoints = competitionRankingPoints(team.id, room.champion, room.knockoutBracket);
    const historyId = `cmp_${crypto.randomUUID().replaceAll('-', '')}`;
    const playerFinalResult = finalResult && (finalResult.homeTeamId === team.id || finalResult.awayTeamId === team.id)
      ? {
          homeTeamId: finalResult.homeTeamId,
          awayTeamId: finalResult.awayTeamId,
          homeGoals: finalResult.homeGoals,
          awayGoals: finalResult.awayGoals,
          winner: finalResult.winner,
        }
      : null;
    const playStyle = finalResult
      ? finalResult.events
        .filter(event => event.type === 'tactic' && event.teamId === team.id && event.tacticAction)
        .sort((a, b) => a.minute - b.minute)
        .at(-1)?.tacticAction ?? team.playStyle
      : team.playStyle;
    const report = {
      version: 1,
      source: 'server',
      games: played.length,
      wins,
      draws,
      losses,
      goals,
      goalsAgainst,
      champion,
      competitionPoints,
      season: {
        topScorer: topGoals ? { playerId: topGoals.card.id, playerName: topGoals.card.shortName, value: topGoals.stats.goals } : null,
        topAssister: topAssists ? { playerId: topAssists.card.id, playerName: topAssists.card.shortName, value: topAssists.stats.assists } : null,
        topSaver: topSaves ? { playerId: topSaves.card.id, playerName: topSaves.card.shortName, value: topSaves.stats.saves } : null,
        highestEffectiveOverall: topEffective ? { playerId: topEffective.card.id, playerName: topEffective.card.shortName, value: topEffective.value } : null,
      },
      historySnapshot: {
        version: 1,
        playerTeam: team,
        effectiveStatsByPlayerId,
        effectiveOverallByPlayerId,
        matches: played.map(result => ({
          homeTeamId: result.homeTeamId,
          awayTeamId: result.awayTeamId,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          winner: result.winner,
        })),
        championId: room.champion,
        championName,
        formatId: room.competitionFormat.id,
        finalResult: playerFinalResult,
        playStyle,
        report: generateImmortalReport(team, results, championName),
        leaders,
      },
    };
    const statements = [env.DB.prepare(`INSERT INTO competition_history
      (id, user_id, mode, difficulty_id, format_id, team_name, crest_id, coach_id, champion, placement, competition_points, report_json, source_key, completed_at)
      VALUES (?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(historyId, accountId, room.difficulty, room.competitionFormat.id, team.name, team.crestId ?? null, team.coachId ?? null, champion ? 1 : 0, placementFor(room, team.id), competitionPoints, JSON.stringify(report), sourceKey, now)
    ];

    const username = usernames.get(accountId) ?? player.name;
    const records: Array<[string, PlayerCard, number] | null> = [
      topGoals && topGoals.stats.goals > 0 ? ['goals', topGoals.card, topGoals.stats.goals] : null,
      topAssists && topAssists.stats.assists > 0 ? ['assists', topAssists.card, topAssists.stats.assists] : null,
      topSaves && topSaves.stats.saves > 0 ? ['saves', topSaves.card, topSaves.stats.saves] : null,
      topEffective ? ['effective_overall', topEffective.card, topEffective.value] : null,
    ];
    for (const record of records) {
      if (!record) continue;
      const [category, card, value] = record;
      statements.push(env.DB.prepare(`INSERT INTO competition_records
        (id, competition_id, user_id, category, difficulty_id, player_id, player_name, player_photo_url, value,
         username_snapshot, team_name_snapshot, crest_id_snapshot, mode, format_id, completed_at, player_card_json, verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?, ?, 1, ?)`)
        .bind(`rec_${crypto.randomUUID().replaceAll('-', '')}`, historyId, accountId, category, room.difficulty, card.id,
          card.shortName, card.photoUrl ?? null, value, username, team.name, team.crestId ?? null, room.competitionFormat.id,
          now, JSON.stringify({ ...card, effectiveStats: effectiveStatsByPlayerId[card.id] }), now));
    }

    statements.push(env.DB.prepare(`INSERT INTO profile_stats
      (user_id, competitions_completed, titles, wins, draws, losses, goals, assists, saves, highest_effective_overall, highest_difficulty_id, updated_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        competitions_completed = profile_stats.competitions_completed + 1,
        titles = profile_stats.titles + excluded.titles,
        wins = profile_stats.wins + excluded.wins,
        draws = profile_stats.draws + excluded.draws,
        losses = profile_stats.losses + excluded.losses,
        goals = profile_stats.goals + excluded.goals,
        assists = profile_stats.assists + excluded.assists,
        saves = profile_stats.saves + excluded.saves,
        highest_effective_overall = MAX(profile_stats.highest_effective_overall, excluded.highest_effective_overall),
        highest_difficulty_id = CASE WHEN excluded.highest_effective_overall > profile_stats.highest_effective_overall THEN excluded.highest_difficulty_id ELSE profile_stats.highest_difficulty_id END,
        updated_at = excluded.updated_at`)
      .bind(accountId, champion ? 1 : 0, wins, draws, losses, goals, totalAssists, totalSaves, topEffective?.value ?? 0, room.difficulty, now));
    // Make the history row, records, and profile aggregates one idempotent
    // commit. If persistence is retried, the source key skips this whole set.
    await env.DB.batch(statements);
    await retainRecentCompetitionSnapshots(env.DB, accountId);
  }
}
