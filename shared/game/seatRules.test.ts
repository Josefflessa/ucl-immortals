import { describe, expect, it } from 'vitest';
import * as seatRules from './seatRules';
import { generateBotTeam } from './gameEngine';
import { SHOP_COSTS } from './shop';
import { createMissionState } from './missions';
import { trainingCostForProject } from './clubProjects';
import { PLAYERS } from './gameData';

const open: seatRules.SeatContext = { shopOpen: true, roundKey: 'league:1' };
const closed: seatRules.SeatContext = { shopOpen: false, roundKey: null };

function seat(points = 1000): seatRules.PlayerSeat {
  const team = generateBotTeam('Seat FC', 0.7);
  return {
    team: { ...team, isBot: false, coachId: 'guardiola', coachPrime: false },
    points,
    missions: createMissionState('seat', 'L1'),
    pendingPack: null,
    pendingPackReveal: null,
    pendingUniquePack: null,
  };
}

describe('seat rules — shop', () => {
  it('changing coach charges once and mirrors the balance on the team', () => {
    const result = seatRules.changeCoach(seat(), open, 'klopp');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.seat.points).toBe(1000 - SHOP_COSTS.changeCoach);
    expect(result.seat.team.coachId).toBe('klopp');
    expect(result.seat.team.credits).toBe(result.seat.points);
    expect(seatRules.changeCoach(result.seat, open, 'klopp').ok).toBe(false); // same coach
  });

  it('the shop is closed outside the league/knockout hubs', () => {
    expect(seatRules.changeCoach(seat(), closed, 'klopp').ok).toBe(false);
    expect(seatRules.openScoutPack(seat(), closed, 'ST').ok).toBe(false);
  });

  it('reports insufficient credits with the amount needed', () => {
    const result = seatRules.openUniquePack(seat(10), open);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(String(SHOP_COSTS.uniqueCard));
  });

  it('a stale scout choice keeps the paid pack reserved', () => {
    const opened = seatRules.openScoutPack(seat(), open, 'ST');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.seat.points).toBe(1000 - SHOP_COSTS.scout);
    const stale = seatRules.pickScoutPack(opened.seat, 'not-an-offered-card');
    expect(stale.ok).toBe(false);
    const picked = seatRules.pickScoutPack(opened.seat, opened.seat.pendingPack!.options[0].id);
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.seat.pendingPack).toBeNull();
    expect(picked.seat.team.players).toHaveLength(opened.seat.team.players.length + 1);
  });

  it('a unique pack is paid on open and added to the bench on claim', () => {
    const opened = seatRules.openUniquePack(seat(), open);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.seat.uniquePackOfferRoundKey).toBe('league:1');
    const claimed = seatRules.claimUniquePack(opened.seat);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.seat.team.players.some(card => card.id === opened.seat.pendingUniquePack!.id)).toBe(true);
    expect(claimed.seat.pendingUniquePack).toBeNull();
  });

  it('training costs follow the Training Centre and add the boost', () => {
    const start = seat();
    const target = start.team.players[0];
    const result = seatRules.train(start, open, target.id, 'pace');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.seat.points).toBe(1000 - trainingCostForProject(1, 0));
    expect(result.seat.team.players[0].trainBoosts?.pace).toBe(3);
    expect(result.seat.team.players[0].trainCount).toBe(1);
  });

  it('round offers are stable within a round and refresh on the next one', () => {
    const first = seatRules.ensurePlayerPackOffers(seat(), open);
    expect(seatRules.ensurePlayerPackOffers(first, open)).toBe(first);
    const next = seatRules.ensurePlayerPackOffers(first, { shopOpen: true, roundKey: 'league:2' });
    expect(next.playerPackOfferRoundKeys?.gold).toBe('league:2');
  });
});

describe('seat rules — recruitment and lineup', () => {
  it('a recruitment pick adds the card once and closes a single-pick offer', () => {
    const base = seat();
    const ownedIds = new Set(base.team.players.map(card => card.id));
    const options = PLAYERS.filter(card => !ownedIds.has(card.id)).slice(0, 3);
    const offered = { ...base, reinforcementOptions: options, reinforcementOffer: null };
    expect(seatRules.pickReinforcement(offered, false, options[0].id).ok).toBe(false);
    const picked = seatRules.pickReinforcement(offered, true, options[0].id);
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.seat.reinforcementOptions).toBeNull();
    expect(picked.seat.team.players.at(-1)?.id).toBe(options[0].id);
    expect(seatRules.pickReinforcement(offered, true, 'not-offered').ok).toBe(false);
  });

  it('swapping a role holder to the bench drops the role', () => {
    const base = seat();
    const captain = base.team.players[0].id;
    const withRoles = seatRules.setMatchRoles(base, { captain });
    expect(withRoles.ok).toBe(true);
    if (!withRoles.ok) return;
    const swapped = seatRules.swapLineup(withRoles.seat, 0, 11);
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(swapped.seat.team.captain).toBeUndefined();
    expect(seatRules.swapLineup(base, 0, 0).ok).toBe(false);
  });

  it('takers must be outfield starters', () => {
    const base = seat();
    const gk = base.team.players.slice(0, 11).find(card => card.position === 'GK')!;
    const bench = base.team.players[11];
    expect(seatRules.setMatchRoles(base, { penaltyTaker: gk.id }).ok).toBe(false);
    expect(seatRules.setMatchRoles(base, { captain: bench.id }).ok).toBe(false);
    expect(seatRules.setMatchRoles(base, { captain: gk.id }).ok).toBe(true);
    expect(seatRules.setFormation(base, 'not-a-formation').ok).toBe(false);
    expect(seatRules.setPlayStyle(base, 'not-a-tactic').ok).toBe(false);
  });
});
