// Solo campaign helpers: seat rules adapter, save summary, recruitment and medical recoveries.

import * as seatRules from '@shared/game/seatRules';
import { Player } from '@shared/game/gameData';
import { Team, MatchResult, generateDraftOptions, generateImmortalReport, LeagueFixture, computeGroupQualifiedStandings, getAllPlayedMatchResults, createKnockoutBracket, buildUniquePackRoundKey, advanceKnockoutBracket, playActiveKnockoutLeg, getActiveKnockoutMatches } from '@shared/game/gameEngine';
import { applyMedicalReturnBoost, resolveAvailableLineup } from '@shared/game/discipline';
import { createRecruitmentOfferMeta, getRecruitmentOfferConfig, medicalInjuryDuration, medicalReturnBoost, projectLevel, type RecruitmentEventKind, type RecruitmentOfferMeta } from '@shared/game/clubProjects';
import { type GamePhase, type GameState, type KnockoutBracket } from './state';

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
  return { savedAt, teamName: state.playerName || 'Seu time', phase: state.phase, leagueRound: state.leagueRound };
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
  return {
    ...state,
    playerTeam: next.team,
    points: next.points,
    missions: next.missions ?? state.missions,
    bets: next.bets ?? state.bets,
    medicalFreeTreatmentsUsed: next.medicalFreeTreatmentsUsed ?? state.medicalFreeTreatmentsUsed,
    reinforcementOptions: next.reinforcementOptions === undefined ? state.reinforcementOptions : next.reinforcementOptions,
    reinforcementOffer: next.reinforcementOffer === undefined ? state.reinforcementOffer : next.reinforcementOffer,
    discipline: 'discipline' in result ? result.discipline : state.discipline,
    pendingPack: next.pendingPack,
    pendingPackReveal: next.pendingPackReveal,
    pendingUniquePack: next.pendingUniquePack,
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
  const options = generateDraftOptions([], ownedIds, config.optionCount, config.minimumOverall);
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

/**
 * Ends a solo campaign when the player misses the knockout qualification line.
 * The player no longer has a tie to play, so the remaining bracket is resolved
 * in the background and the normal end-of-season report receives the complete
 * league + knockout result set.
 */
export function finishEliminatedSoloCampaign(state: GameState): GameState {
  if (state.mode !== 'solo' || !state.playerTeam) return state;

  const allTeams = [state.playerTeam, ...state.botTeams];
  const format = state.competitionFormat;
  let bracket = state.knockoutBracket;
  let champion: string | null = null;

  if (format.id !== 'league') {
    const qualifiedStandings = format.id === 'groups_knockout'
      ? computeGroupQualifiedStandings(allTeams, state.leagueFixtures, format)
      : state.leagueStandings;
    bracket = (bracket
      ? JSON.parse(JSON.stringify(bracket))
      : createKnockoutBracket(qualifiedStandings, format)) as KnockoutBracket;

    const teamById = new Map(allTeams.map(team => [team.id, team]));
    for (let guard = 0; guard < 64 && !champion; guard++) {
      const active = getActiveKnockoutMatches(bracket);
      if (active.length === 0) break;

      playActiveKnockoutLeg(
        bracket,
        (teamId: string) => {
          const team = teamById.get(teamId);
          return team ? resolveAvailableLineup(team, state.discipline).team : undefined;
        },
      );
      champion = advanceKnockoutBracket(bracket);
    }
  }

  const fallbackChampion = state.leagueStandings[0]?.teamId ?? state.playerTeam.id;
  const championId = champion ?? fallbackChampion;
  const championTeam = allTeams.find(team => team.id === championId);
  const report = generateImmortalReport(
    state.playerTeam,
    getAllPlayedMatchResults(state.leagueResults, bracket),
    championTeam?.name ?? 'Campeão',
  );

  return {
    ...state,
    knockoutBracket: bracket,
    champion: championId,
    report,
    phase: 'report',
    activeKnockoutMatch: null,
    currentMatchTeams: null,
    currentMatchResult: null,
    spectating: false,
    reinforcementOptions: null,
    reinforcementOffer: null,
  };
}
