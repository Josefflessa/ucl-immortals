import type { D1Database } from '@cloudflare/workers-types';
import { getAllPlayedMatchResults, getPlayerSeasonStats, getTeamEffectiveStats } from '../client/src/lib/gameEngine.js';
import type { MatchResult, PlayerCard, Team } from '../client/src/lib/gameEngine.js';
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

  const results = getAllPlayedMatchResults(room.leagueResults, room.knockoutBracket);
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
    if (existing) continue;

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
    const topEffective = allPlayers
      .map(card => ({ card, value: Math.round(effective[card.id]?.overall ?? card.overall) }))
      .sort((a, b) => b.value - a.value)[0];
    const champion = room.champion === team.id;
    const historyId = `cmp_${crypto.randomUUID().replaceAll('-', '')}`;
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
      season: {
        topScorer: topGoals ? { playerId: topGoals.card.id, playerName: topGoals.card.shortName, value: topGoals.stats.goals } : null,
        topAssister: topAssists ? { playerId: topAssists.card.id, playerName: topAssists.card.shortName, value: topAssists.stats.assists } : null,
        topSaver: topSaves ? { playerId: topSaves.card.id, playerName: topSaves.card.shortName, value: topSaves.stats.saves } : null,
        highestEffectiveOverall: topEffective ? { playerId: topEffective.card.id, playerName: topEffective.card.shortName, value: topEffective.value } : null,
      },
    };
    await env.DB.prepare(`INSERT INTO competition_history
      (id, user_id, mode, difficulty_id, format_id, team_name, crest_id, coach_id, champion, placement, report_json, source_key, completed_at)
      VALUES (?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(historyId, accountId, room.difficulty, room.competitionFormat.id, team.name, team.crestId ?? null, team.coachId ?? null, champion ? 1 : 0, placementFor(room, team.id), JSON.stringify(report), sourceKey, now)
      .run();

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
      await env.DB.prepare(`INSERT INTO competition_records
        (id, competition_id, user_id, category, difficulty_id, player_id, player_name, player_photo_url, value, username_snapshot, team_name_snapshot, crest_id_snapshot, verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
        .bind(`rec_${crypto.randomUUID().replaceAll('-', '')}`, historyId, accountId, category, room.difficulty, card.id, card.shortName, card.photoUrl ?? null, value, username, team.name, team.crestId ?? null, now)
        .run();
    }

    await env.DB.prepare(`INSERT INTO profile_stats
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
      .bind(accountId, champion ? 1 : 0, wins, draws, losses, goals, totalAssists, totalSaves, topEffective?.value ?? 0, room.difficulty, now)
      .run();
  }
}
