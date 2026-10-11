import type { Team } from '@shared/game/engine/teamModel';
import type { PitchSides } from '@shared/game/pitch';

/** The left side is always the viewer's team, attacking to the right of the screen. */
export function buildPitchSides(left: Team, right: Team): PitchSides {
  const squad = (team: Team) => ({ teamId: team.id, playerIds: team.players.slice(0, 11).map(p => p.id), formationId: team.formationId });
  return { left: squad(left), right: squad(right) };
}
