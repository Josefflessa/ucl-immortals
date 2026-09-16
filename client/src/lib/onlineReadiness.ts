// Shared online readiness rules.
//
// A player is part of the current ready-check only when they have a team, are
// connected and have a fixture/tie in the active round. Keeping this logic in
// one small module prevents the client and server from drifting apart on byes,
// direct qualification, spectators and reconnects.

export interface ReadinessPlayer {
  id: string;
  connected?: boolean;
  team?: unknown | null;
}

export interface ReadinessFixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

export interface ReadinessTie {
  homeTeamId: string;
  awayTeamId: string;
}

const isConnected = (player: ReadinessPlayer): boolean => player.connected !== false;

export function getOnlineLeagueParticipantIds(
  players: ReadinessPlayer[],
  fixtures: ReadinessFixture[],
  round: number,
): string[] {
  return players
    .filter(player => player.team && isConnected(player)
      && fixtures.some(fixture => fixture.round === round
        && (fixture.homeTeamId === player.id || fixture.awayTeamId === player.id)))
    .map(player => player.id);
}

export function getOnlineKnockoutParticipantIds(
  players: ReadinessPlayer[],
  ties: ReadinessTie[],
): string[] {
  return players
    .filter(player => player.team && isConnected(player)
      && ties.some(tie => tie.homeTeamId === player.id || tie.awayTeamId === player.id))
    .map(player => player.id);
}

export interface ReadinessStatus {
  readyCount: number;
  total: number;
  allReady: boolean;
}

export function getReadinessStatus(readyIds: string[], participantIds: string[]): ReadinessStatus {
  const ready = new Set(readyIds);
  const readyCount = participantIds.filter(id => ready.has(id)).length;
  return {
    readyCount,
    total: participantIds.length,
    // With no human participants, the host may start a bot-only round.
    allReady: participantIds.every(id => ready.has(id)),
  };
}
