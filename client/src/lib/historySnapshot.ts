import { isCompetitionFormatId, type CompetitionFormatId } from './competition';
import type { ImmortalReport, Team } from './gameEngine';
import type { Player } from './gameData';

export interface HistoryMatchSnapshot {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  winner: string | null;
}

export interface HistoryLeaderSnapshot {
  player: Pick<Player, 'id' | 'shortName' | 'photoUrl' | 'rarity'>;
  teamName: string;
  value: number;
  played?: number;
}

export interface CompetitionHistorySnapshot {
  version: 1;
  playerTeam: Team;
  matches: HistoryMatchSnapshot[];
  championId: string | null;
  championName: string;
  formatId: CompetitionFormatId;
  finalResult: HistoryMatchSnapshot | null;
  playStyle: string | null;
  report: ImmortalReport | null;
  leaders: {
    topScorer: HistoryLeaderSnapshot | null;
    topRating: HistoryLeaderSnapshot | null;
    topAssister: HistoryLeaderSnapshot | null;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMatch(value: unknown): value is HistoryMatchSnapshot {
  return isRecord(value)
    && typeof value.homeTeamId === 'string'
    && typeof value.awayTeamId === 'string'
    && typeof value.homeGoals === 'number'
    && Number.isSafeInteger(value.homeGoals)
    && value.homeGoals >= 0
    && typeof value.awayGoals === 'number'
    && Number.isSafeInteger(value.awayGoals)
    && value.awayGoals >= 0
    && (typeof value.winner === 'string' || value.winner === null);
}

function isLeader(value: unknown): value is HistoryLeaderSnapshot {
  if (!isRecord(value) || !isRecord(value.player)) return false;
  return typeof value.player.id === 'string'
    && typeof value.player.shortName === 'string'
    && typeof value.player.rarity === 'string'
    && (value.player.photoUrl === undefined || value.player.photoUrl === null || typeof value.player.photoUrl === 'string')
    && typeof value.teamName === 'string'
    && typeof value.value === 'number'
    && Number.isFinite(value.value);
}

/** Returns only snapshots with enough structure to safely render the archived report. */
export function getCompetitionHistorySnapshot(report: Record<string, unknown>): CompetitionHistorySnapshot | null {
  const value = report.historySnapshot;
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.playerTeam)) return null;
  const team = value.playerTeam;
  if (typeof team.id !== 'string' || typeof team.name !== 'string'
    || typeof team.coachId !== 'string' || typeof team.formationId !== 'string'
    || typeof team.playStyle !== 'string' || !Array.isArray(team.players) || team.players.length < 11) return null;
  if (!team.players.every(player => isRecord(player)
    && typeof player.id === 'string'
    && typeof player.shortName === 'string'
    && typeof player.position === 'string'
    && typeof player.overall === 'number'
    && Number.isFinite(player.overall)
    && typeof player.rarity === 'string')) return null;
  if (!Array.isArray(value.matches) || !value.matches.every(isMatch)) return null;
  if (typeof value.championName !== 'string' || !isCompetitionFormatId(value.formatId)) return null;
  if (value.championId !== null && typeof value.championId !== 'string') return null;
  if (value.finalResult !== null && !isMatch(value.finalResult)) return null;
  if (value.playStyle !== null && typeof value.playStyle !== 'string') return null;
  if (!isRecord(value.leaders)) return null;
  for (const key of ['topScorer', 'topRating', 'topAssister'] as const) {
    if (value.leaders[key] !== null && !isLeader(value.leaders[key])) return null;
  }
  if (value.report !== null && (!isRecord(value.report)
    || !Array.isArray(value.report.historicalRecreations)
    || !value.report.historicalRecreations.every(item => typeof item === 'string'))) return null;

  return value as unknown as CompetitionHistorySnapshot;
}
