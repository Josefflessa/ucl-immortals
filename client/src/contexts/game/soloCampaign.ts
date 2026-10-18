// Solo campaign helpers: seat rules adapter, save summary, recruitment and medical recoveries.

import * as seatRules from '@shared/game/seatRules';
import { Player } from '@shared/game/gameData';
import { Team, MatchResult, generateDraftOptions, RECRUITMENT_VARIANT_CHANCE, generateImmortalReport, LeagueFixture, getAllPlayedMatchResults, buildUniquePackRoundKey, advanceKnockoutBracket, applyDefeatGrowth, applyMatchStatGrowth, computeGroupQualifiedStandings, createKnockoutBracket, getActiveKnockoutMatches, isKnockoutTeamAlive, playActiveKnockoutLeg, stampMatchStartingLineups } from '@shared/game/gameEngine';
import { applyMatchDiscipline, applyMedicalReturnBoost, resolveAvailableLineup } from '@shared/game/discipline';
import { buildKnockoutMatchKey } from '@shared/game/bets';
import { createRecruitmentOfferMeta, getRecruitmentOfferConfig, medicalInjuryDuration, medicalReturnBoost, projectLevel, type RecruitmentEventKind, type RecruitmentOfferMeta } from '@shared/game/clubProjects';
import { type GamePhase, type GameState } from './state';

function currentUniquePackRoundKey(state: Pick<GameState, 'phase' | 'leagueRound' | 'knockoutBracket'>): string | null {
  if (state.phase === 'league') {
    return buildUniquePackRoundKey('league', state.leagueRound);
  }
  if (state.phase === 'knockout' && state.knockoutBracket) {
    return buildUniquePackRoundKey(
      'knockout',
      state.leagueRound,
      state.knockoutBracket.currentRound,
      state.knockoutBracket.currentLeg,
    );
  }
  return null;
}

// Phases of a solo campaign that are saved automatically (from the crest pick to the report).
export const SOLO_CAMPAIGN_PHASES = new Set<GamePhase>(['crest', 'coach', 'formation', 'draft', 'squad_review', 'league', 'knockout', 'match_sim', 'report']);

/** Summary of the saved solo campaign shown on the menu. */
export interface SavedSoloCampaign {
  savedAt: number;
  teamName: string;
  phase: GamePhase;
  leagueRound: number;
}

export function savedCampaignSummary(state: GameState, savedAt: number): SavedSoloCampaign {
  return { savedAt, // Empty until the club is named (that comes after the difficulty): the player's own name is not the club's.
    teamName: (state.teamName ?? '').trim(), phase: state.phase, leagueRound: state.leagueRound };
}

// ── Player seat: the same rules the online server applies (lib/seatRules) ──

function soloSeatOf(state: GameState): seatRules.PlayerSeat | null {
  if (!state.playerTeam) return null;
  return {
    team: state.playerTeam,
    points: state.points,
    missions: state.missions,
    bets: state.bets,
    medicalFreeTreatmentsUsed: state.medicalFreeTreatmentsUsed,
    reinforcementOptions: state.reinforcementOptions,
    reinforcementOffer: state.reinforcementOffer,
    pendingPack: state.pendingPack,
    pendingPackReveal: state.pendingPackReveal,
    pendingUniquePack: state.pendingUniquePack,
    uniquePackOfferIds: state.uniquePackOfferIds,
    uniquePackOfferRoundKey: state.uniquePackOfferRoundKey,
    eventUniqueIds: state.eventUniqueIds ?? [],
    playerPackOfferIds: state.playerPackOfferIds,
    playerPackOfferRoundKeys: state.playerPackOfferRoundKeys,
  };
}

export function soloSeatContext(state: GameState): seatRules.SeatContext {
  return { shopOpen: state.phase === 'league' || state.phase === 'knockout', roundKey: currentUniquePackRoundKey(state) };
}

export function soloMissionBoard(state: GameState): seatRules.MissionBoardContext {
  return { seed: localMissionSeed(state), cycle: seatRules.currentMissionCycle(state) };
}

export function applySoloSeatRule(state: GameState, rule: (seat: seatRules.PlayerSeat) => seatRules.SeatResult | seatRules.DisciplineResult): GameState {
  const seat = soloSeatOf(state);
  if (!seat) return state;
  const result = rule(seat);
  if (!result.ok) return state;
  const next = result.seat;
  const lockAlbumBonuses = <T extends Player>(player: T): T => {
    const level = player.competitionAlbumLevel ?? state.competitionAlbumLevelSnapshot?.[player.id] ?? 0;
    const pageBonus = player.competitionAlbumPageBonus ?? state.competitionAlbumPageBonusSnapshot?.[player.id] ?? 0;
    return player.competitionAlbumLevel === level && player.competitionAlbumPageBonus === pageBonus
      ? player
      : { ...player, competitionAlbumLevel: level, competitionAlbumPageBonus: pageBonus };
  };
  // Stamp any card entering the roster (recruitment, packs, emergency replacement)
  // with this campaign's frozen Album bonuses. Existing cards keep their locked values.
  const team = {
    ...next.team,
    players: next.team.players.map(lockAlbumBonuses),
  };
  const reinforcementOptions = next.reinforcementOptions === undefined ? state.reinforcementOptions : next.reinforcementOptions;
  return {
    ...state,
    playerTeam: team,
    points: next.points,
    missions: next.missions ?? state.missions,
    bets: next.bets ?? state.bets,
    medicalFreeTreatmentsUsed: next.medicalFreeTreatmentsUsed ?? state.medicalFreeTreatmentsUsed,
    reinforcementOptions: reinforcementOptions?.map(lockAlbumBonuses) ?? null,
    reinforcementOffer: next.reinforcementOffer === undefined ? state.reinforcementOffer : next.reinforcementOffer,
    discipline: 'discipline' in result ? result.discipline : state.discipline,
    pendingPack: next.pendingPack ? { ...next.pendingPack, options: next.pendingPack.options.map(lockAlbumBonuses) } : null,
    pendingPackReveal: next.pendingPackReveal ? { ...next.pendingPackReveal, card: lockAlbumBonuses(next.pendingPackReveal.card) } : null,
    pendingUniquePack: next.pendingUniquePack ? lockAlbumBonuses(next.pendingUniquePack) : null,
    uniquePackOfferIds: next.uniquePackOfferIds ?? [],
    uniquePackOfferRoundKey: next.uniquePackOfferRoundKey ?? null,
    playerPackOfferIds: next.playerPackOfferIds ?? {},
    playerPackOfferRoundKeys: next.playerPackOfferRoundKeys ?? {},
  };
}

export function localMissionSeed(state: Pick<GameState, 'mode' | 'playerName' | 'roomCode' | 'playerTeam' | 'missions'>): string {
  if (state.missions.seed) return state.missions.seed;
  if (state.mode === 'online') return `${state.roomCode ?? 'room'}:${state.playerTeam?.id ?? (state.playerName || 'player')}`;
  return `${state.playerName || 'solo'}:${state.playerTeam?.id ?? 'player'}`;
}

/**
 * The server keeps league results only on their fixtures, so derive the flat
 * list lazily. Reuse the previous derived array when the fixture reference did not change
 * (for example, a ready/shop patch), avoiding another full-history scan.
 */
export function onlineLeagueResults(
  roomState: any,
  previousFixtures: LeagueFixture[],
  previousResults: MatchResult[],
): MatchResult[] {
  const fixtures = Array.isArray(roomState.leagueFixtures) ? roomState.leagueFixtures : [];
  if (fixtures === previousFixtures) return previousResults;
  return fixtures
    .filter((fixture: LeagueFixture) => fixture.played && !!fixture.result)
    // `round` rides along so a "Ver Detalhes" click on a trimmed (bygone
    // round) result — e.g. from "Meus jogos" — knows which fixture to
    // re-request in full; MatchResult itself has no round field.
    .map((fixture: LeagueFixture) => ({ ...fixture.result!, round: fixture.round }));
}

export function createRecruitmentOffer(
  team: Team,
  baseOptions: number,
  eventKind: RecruitmentEventKind,
  eventNumber: number,
): { options: Player[]; offer: RecruitmentOfferMeta } {
  const level = projectLevel(team.clubProjects, 'recruitment');
  const config = getRecruitmentOfferConfig(baseOptions, level, eventNumber);
  const ownedIds = team.players.map(player => player.id);
  const options = generateDraftOptions([], ownedIds, config.optionCount, config.minimumOverall, RECRUITMENT_VARIANT_CHANCE);
  const selectionLimit = Math.min(config.selectionLimit, Math.max(1, options.length));

  return {
    options,
    offer: createRecruitmentOfferMeta(
      eventKind,
      eventNumber,
      level,
      baseOptions,
      selectionLimit,
      config.freeRerolls,
      config.minimumOverall,
    ),
  };
}

export function medicalInjuryDurationForTeam(team: Team): number {
  return medicalInjuryDuration(projectLevel(team.clubProjects, 'medical'));
}

export function applyMedicalRecoveries(team: Team, recoveredInjuries: { teamId: string; playerId: string }[]): Team {
  const boost = medicalReturnBoost(projectLevel(team.clubProjects, 'medical'));
  if (boost <= 0) return team;
  return recoveredInjuries
    .filter(recovery => recovery.teamId === team.id)
    .reduce((current, recovery) => applyMedicalReturnBoost(current, recovery.playerId, boost), team);
}

/** Keeps the online exit path partial: those results are authoritative on the room server. */
function createEliminatedPartialReport(state: GameState): GameState {
  if (state.mode !== 'solo' || !state.playerTeam) return state;

  const report = generateImmortalReport(
    state.playerTeam,
    getAllPlayedMatchResults(state.leagueResults, state.knockoutBracket),
    'Resultado ainda não definido',
  );

  return {
    ...state,
    champion: null,
    report,
    partialReport: true,
    phase: 'report',
    activeKnockoutMatch: null,
    currentMatchTeams: null,
    currentMatchResult: null,
    spectating: false,
    reinforcementOptions: null,
    reinforcementOffer: null,
  };
}

/**
 * Solo can resolve the remaining tournament immediately after elimination. If elimination
 * happened in the league/group phase, build the qualifiers' bracket first; then simulate all
 * remaining bot-only ties so the player receives the complete champion report.
 */
export function finishEliminatedSoloCampaign(state: GameState): GameState {
  if (state.mode !== 'solo' || !state.playerTeam) return state;

  let bracket: NonNullable<GameState['knockoutBracket']>;
  if (!state.knockoutBracket) {
    const leagueStageComplete = state.phase === 'league'
      && state.leagueFixtures.length > 0
      && state.leagueFixtures.every(fixture => fixture.played);
    if (!leagueStageComplete || state.competitionFormat.id === 'league') return state;

    const allTeams = [state.playerTeam, ...state.botTeams];
    const qualified = state.competitionFormat.id === 'groups_knockout'
      ? computeGroupQualifiedStandings(allTeams, state.leagueFixtures, state.competitionFormat)
      : state.leagueStandings.slice(0, state.competitionFormat.qualifiedTeams);
    if (qualified.some(entry => entry.teamId === state.playerTeam!.id)) return state;

    bracket = createKnockoutBracket(qualified, state.competitionFormat) as NonNullable<GameState['knockoutBracket']>;
  } else {
    if (isKnockoutTeamAlive(state.knockoutBracket, state.playerTeam.id)) return state;
    bracket = JSON.parse(JSON.stringify(state.knockoutBracket)) as NonNullable<GameState['knockoutBracket']>;
  }
  let botTeams = state.botTeams;
  let discipline = state.discipline;
  let champion: string | null = null;

  // A competition has at most five knockout stages, each with up to two legs. The wider guard
  // protects against malformed restored brackets without manufacturing an incomplete final.
  for (let step = 0; step < 20 && !champion; step++) {
    const active = getActiveKnockoutMatches(bracket) as any[];
    if (active.length === 0) break;

    if (active.every(tie => tie.played && tie.result)) {
      champion = advanceKnockoutBracket(bracket);
      continue;
    }

    const leg = bracket.currentLeg;
    const allTeams = [state.playerTeam, ...botTeams];
    const resolvedTeams = new Map<string, Team>();
    const resolve = (teamId: string): Team | undefined => {
      const cached = resolvedTeams.get(teamId);
      if (cached) return cached;
      const team = allTeams.find(candidate => candidate.id === teamId);
      if (!team) return undefined;
      const resolved = resolveAvailableLineup(team, discipline).team;
      resolvedTeams.set(teamId, resolved);
      return resolved;
    };

    playActiveKnockoutLeg(bracket, resolve);

    const currentTies = getActiveKnockoutMatches(bracket) as any[];
    const legResults = currentTies.map(tie => {
      const result = tie.isSingleLeg ? tie.result : leg === 2 ? tie.leg2 : tie.leg1;
      if (!result) return null;
      const home = resolvedTeams.get(result.homeTeamId) ?? allTeams.find(team => team.id === result.homeTeamId);
      const away = resolvedTeams.get(result.awayTeamId) ?? allTeams.find(team => team.id === result.awayTeamId);
      if (!home || !away) return null;
      const stamped = stampMatchStartingLineups(result, home, away);
      if (tie.isSingleLeg) tie.result = stamped;
      else if (leg === 2) tie.leg2 = stamped;
      else tie.leg1 = stamped;
      return stamped;
    }).filter((result): result is MatchResult => Boolean(result));

    if (legResults.length === 0) break;

    const playedTeamIds = Array.from(new Set(legResults.flatMap(result => [result.homeTeamId, result.awayTeamId])));
    const nameOf = (teamId: string, playerId: string) =>
      allTeams.find(team => team.id === teamId)?.players.find(player => player.id === playerId)?.shortName ?? '?';
    const disciplineResult = applyMatchDiscipline(
      discipline,
      playedTeamIds,
      legResults,
      nameOf,
      Math.random,
      teamId => medicalInjuryDurationForTeam(allTeams.find(team => team.id === teamId) ?? state.playerTeam!),
    );
    discipline = disciplineResult.next;

    const matchKeyForResult = (result: MatchResult) => {
      const tie = currentTies.find(candidate => candidate.homeTeamId === result.homeTeamId || candidate.awayTeamId === result.homeTeamId);
      return tie ? buildKnockoutMatchKey(tie.id, leg) : undefined;
    };
    botTeams = botTeams.map(team => {
      const grown = legResults.reduce(
        (current, result) => applyMatchStatGrowth(applyDefeatGrowth(current, result), result, matchKeyForResult(result)),
        team,
      );
      return applyMedicalRecoveries(grown, disciplineResult.recoveredInjuries);
    });
  }

  if (!champion) return createEliminatedPartialReport(state);

  const championName = [state.playerTeam, ...botTeams].find(team => team.id === champion)?.name ?? 'Campeão';
  const report = generateImmortalReport(
    state.playerTeam,
    getAllPlayedMatchResults(state.leagueResults, bracket),
    championName,
  );

  return {
    ...state,
    botTeams,
    discipline,
    knockoutBracket: bracket,
    champion,
    report,
    partialReport: false,
    phase: 'report',
    activeKnockoutMatch: null,
    currentMatchTeams: null,
    currentMatchResult: null,
    spectating: false,
    reinforcementOptions: null,
    reinforcementOffer: null,
  };
}

/** Online rooms use a partial report because the room server owns the remaining competition. */
export function finishEliminatedOnlineCampaign(state: GameState): GameState {
  if (state.mode !== 'online' || !state.playerTeam) return state;
  return {
    ...createEliminatedPartialReport({ ...state, mode: 'solo' }),
    mode: 'online',
    roomCode: null,
    onlineHostId: null,
    isHost: false,
  };
}
