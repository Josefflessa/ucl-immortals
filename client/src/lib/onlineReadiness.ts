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

export interface TeamMatchDisplay {
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Puts human-player matches before bot-only matches without changing the
 * order inside either group. The local player's match gets the first slot so
 * it remains the quickest one to find on a round screen.
 */
export function sortMatchesForOnlineDisplay<T extends TeamMatchDisplay>(
  matches: T[],
  humanTeamIds: ReadonlySet<string>,
  localTeamId?: string,
): T[] {
  return matches
    .map((match, index) => {
      const isLocalMatch = localTeamId !== undefined
        && (match.homeTeamId === localTeamId || match.awayTeamId === localTeamId);
      const isHumanMatch = humanTeamIds.has(match.homeTeamId) || humanTeamIds.has(match.awayTeamId);

      return {
        match,
        index,
        priority: isLocalMatch ? 0 : isHumanMatch ? 1 : 2,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(entry => entry.match);
}

export function isOnlineHumanMatch(
  match: TeamMatchDisplay,
  humanTeamIds: ReadonlySet<string>,
): boolean {
  return humanTeamIds.has(match.homeTeamId) || humanTeamIds.has(match.awayTeamId);
}

export interface ReadinessTie {
  homeTeamId: string;
  awayTeamId: string;
}

export interface KnockoutWatchTie {
  isSingleLeg?: boolean;
  played?: boolean;
  result?: unknown;
  leg1?: unknown;
  leg2?: unknown;
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

/**
 * Checks the exact knockout leg that a client says it finished watching.
 *
 * After the first leg is simulated, the bracket advances `currentLeg` to 2
 * before the replay is finished. The leg must therefore come from the watch
 * event, not from the bracket's current pointer. The fallback keeps older
 * clients working while they roll out the leg-aware payload.
 */
export function knockoutLegWasPlayed(
  tie: KnockoutWatchTie,
  currentRound: string,
  currentLeg: number,
  requestedLeg?: number,
): boolean {
  const isSingleLeg = tie.isSingleLeg === true
    || (currentRound === 'final' && tie.isSingleLeg === undefined);
  if (isSingleLeg) return Boolean(tie.played && tie.result);

  const leg = requestedLeg === 1 || requestedLeg === 2
    ? requestedLeg
    // Legacy clients sent no leg. Between ida and volta, the only played leg
    // is leg 1; after the volta, leg 2 is the latest played leg.
    : currentLeg === 2 && tie.leg1 && !tie.leg2 ? 1 : currentLeg;

  return leg === 1 ? Boolean(tie.leg1) : leg === 2 ? Boolean(tie.leg2) : false;
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
