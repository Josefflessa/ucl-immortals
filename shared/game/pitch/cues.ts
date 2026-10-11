/** One-second markers for the quick events of open play. */
import type { MatchEvent } from '../engine/teamModel';
import { getTacticById } from '../gameData';
import { sideOfTeam, slotOfPlayer, type PitchSides, type Side } from './geometry';

export type CueKind = 'foul' | 'yellow' | 'red' | 'injury' | 'tactic' | 'corner' | 'duel' | 'shot';
export interface Cue { kind: CueKind; slots: number[]; label?: string; side: Side | null; durationMs: number }
export const CUE_MS = 1100;

export function quickEventCue(event: MatchEvent, sides: PitchSides): Cue | null {
  const side = sideOfTeam(sides, event.teamId);
  const otherTeamId = event.teamId === sides.left.teamId
    ? sides.right.teamId
    : event.teamId === sides.right.teamId
      ? sides.left.teamId
      : undefined;
  const slots = (teamId: string | undefined, ...ids: (string | undefined)[]) =>
    ids.map(id => slotOfPlayer(sides, id, teamId)).filter(s => s >= 0);
  const cue = (kind: CueKind, list: number[], label?: string, durationMs = CUE_MS): Cue => ({ kind, slots: list, label, side, durationMs });
  switch (event.type) {
    case 'foul': return cue('foul', [...slots(event.teamId, event.playerId), ...slots(otherTeamId, event.opponentId)], 'FALTA');
    case 'yellow': return cue('yellow', slots(event.teamId, event.playerId), 'AMARELO');
    case 'red': return cue('red', slots(event.teamId, event.playerId), 'EXPULSO');
    case 'injury': return cue('injury', slots(event.teamId, event.playerId), 'LESÃO');
    case 'corner': return cue('corner', [], 'ESCANTEIO');
    case 'duel': return cue('duel', [...slots(event.teamId, event.playerId), ...slots(otherTeamId, event.opponentId)], 'DESARME');
    case 'tactic': return event.tacticAction ? cue('tactic', [], getTacticById(event.tacticAction).name.toUpperCase(), 1600) : null;
    case 'stat': {
      const shots = (event.statDelta?.homeShots ?? 0) + (event.statDelta?.awayShots ?? 0);
      return shots > 0 ? cue('shot', [], 'FINALIZAÇÃO') : null;
    }
    default: return null;
  }
}
