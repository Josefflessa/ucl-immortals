import type { MatchEvent } from '../engine/teamModel';
import { serverRolesFor } from '../playVariants';
import { otherSide, roleOfSlot, slotBase, slotOfPlayer, type PitchSides, type Side } from './geometry';

export type DangerActorOutcome = 'goal' | 'save' | 'miss';

export interface DangerActors {
  attackSide: Side;
  defendSide: Side;
  finisher: number;
  creator: number;
  defender: number;
  goalkeeper: number;
  finisherId?: string;
  creatorId?: string;
  defenderId?: string;
  goalkeeperId?: string;
}

function liveSlots(base: number, sentOff: ReadonlySet<number>): number[] {
  return Array.from({ length: 11 }, (_, index) => base + index).filter(slot => !sentOff.has(slot));
}

function pickByRole(sides: PitchSides, live: number[], roles: readonly string[], exclude: number[]): number {
  for (const role of roles) {
    const slot = live.find(candidate => !exclude.includes(candidate) && roleOfSlot(sides, candidate) === role);
    if (slot !== undefined) return slot;
  }
  return live.find(slot => !exclude.includes(slot) && roleOfSlot(sides, slot) !== 'GK') ?? live[0] ?? -1;
}

function idAt(sides: PitchSides, side: Side, slot: number): string | undefined {
  return slot < 0 ? undefined : sides[side].playerIds[slot - slotBase(side)];
}

/** Resolves the actual on-pitch actors once so commentary and animation name the same players. */
export function resolveDangerActors(input: {
  sides: PitchSides;
  attackSide: Side;
  event: MatchEvent;
  outcome: DangerActorOutcome;
  sentOff: ReadonlySet<number>;
}): DangerActors {
  const { sides, attackSide, event, outcome, sentOff } = input;
  const defendSide = otherSide(attackSide);
  const atkLive = liveSlots(slotBase(attackSide), sentOff);
  const defLive = liveSlots(slotBase(defendSide), sentOff);
  const play = event.play;
  const kind = play?.kind ?? (outcome === 'goal' && !event.playerId ? 'own_goal' : 'through');
  const valid = (slot: number, live: number[]) => live.includes(slot) ? slot : -1;

  let finisher = valid(slotOfPlayer(
    sides,
    play?.attackerId ?? (outcome === 'save' ? event.opponentId : event.playerId),
    sides[attackSide].teamId,
  ), atkLive);
  if (finisher < 0) finisher = pickByRole(sides, atkLive, ['ST', 'CF', 'LW', 'RW', 'CAM'], []);

  let goalkeeper = valid(slotOfPlayer(sides, play?.goalkeeperId, sides[defendSide].teamId), defLive);
  if (goalkeeper < 0) goalkeeper = pickByRole(sides, defLive, ['GK'], []);

  let defender = valid(slotOfPlayer(
    sides,
    play?.defenderId ?? (kind === 'own_goal' ? event.opponentId : undefined),
    sides[defendSide].teamId,
  ), defLive);
  if (defender < 0 || defender === goalkeeper) {
    defender = pickByRole(sides, defLive, ['CB', 'LB', 'RB', 'CDM'], [goalkeeper]);
  }

  const assisted = outcome === 'goal' && !!event.assisterId;
  const namedCreatorId = (assisted ? event.assisterId : undefined) ?? play?.wideId ?? play?.creatorId;
  let creator = valid(slotOfPlayer(sides, namedCreatorId, sides[attackSide].teamId), atkLive);
  if (creator < 0 || creator === finisher || roleOfSlot(sides, creator) === 'GK') {
    creator = pickByRole(sides, atkLive, serverRolesFor(kind), [finisher]);
  }

  return {
    attackSide,
    defendSide,
    finisher,
    creator,
    defender,
    goalkeeper,
    finisherId: idAt(sides, attackSide, finisher),
    creatorId: idAt(sides, attackSide, creator),
    defenderId: idAt(sides, defendSide, defender),
    goalkeeperId: idAt(sides, defendSide, goalkeeper),
  };
}
