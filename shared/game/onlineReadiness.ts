// Shared online readiness rules.
//
// A player is part of the current ready-check only when they have a team, are
// connected and have a fixture/tie in the active round. Keeping this logic in
// one small module prevents the client and server from drifting apart on byes,
// direct qualification, spectators and reconnects.

interface ReadinessPlayer {
  id: string;
  connected?: boolean;
  team?: unknown | null;
}

interface ReadinessFixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

interface TeamMatchDisplay {
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

interface ReadinessTie {
  homeTeamId: string;
  awayTeamId: string;
}

interface KnockoutWatchTie {
  isSingleLeg?: boolean;
  played?: boolean;
  result?: unknown;
  leg1?: unknown;
  leg2?: unknown;
}

const isConnected = (player: ReadinessPlayer): boolean => player.connected !== false;

// Older rooms can identify a human team with the player's id, while newer
// rooms use the authoritative team id. Accept both forms so reconnects and
// legacy room snapshots do not silently lose their ready/watch participant.
const playerOwnsTeam = (player: ReadinessPlayer, teamId: string): boolean => {
  const playerTeamId = (player.team as { id?: string } | null | undefined)?.id;
  return teamId === player.id || teamId === playerTeamId;
};

export function getOnlineLeagueParticipantIds(
  players: ReadinessPlayer[],
  fixtures: ReadinessFixture[],
  round: number,
): string[] {
  return players
    .filter(player => player.team && isConnected(player)
      && fixtures.some(fixture => fixture.round === round
        && (playerOwnsTeam(player, fixture.homeTeamId) || playerOwnsTeam(player, fixture.awayTeamId))))
    .map(player => player.id);
}

export function getOnlineKnockoutParticipantIds(
  players: ReadinessPlayer[],
  ties: ReadinessTie[],
): string[] {
  return players
    .filter(player => player.team && isConnected(player)
      && ties.some(tie => playerOwnsTeam(player, tie.homeTeamId) || playerOwnsTeam(player, tie.awayTeamId)))
    .map(player => player.id);
}

/**
 * Checks the exact knockout leg that a client says it finished watching.
 *
 * After the first leg is simulated, the bracket advances `currentLeg` to 2
 * before the replay is finished. The leg must therefore come from the watch
 * event, not from the bracket's current pointer.
 */
export function knockoutLegWasPlayed(tie: KnockoutWatchTie, leg: 1 | 2): boolean {
  if (tie.isSingleLeg === true) return Boolean(tie.played && tie.result);
  return leg === 1 ? Boolean(tie.leg1) : Boolean(tie.leg2);
}

interface ReadinessStatus {
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
