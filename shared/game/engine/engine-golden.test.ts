import { afterEach, describe, expect, it, vi } from 'vitest';
import { seededRandom } from '../random';
import { generateBotTeam } from './bots';
import { simulateMatch } from './matchSim';
import type { MatchResult, Team } from './teamModel';

// A fixed set of seeded matches. Recording the play of a chance must never change
// a score, an event or a word of narration, so the result here has to stay
// byte-identical (the new `play` field and kick ids are left out on purpose).
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i);

function fingerprint(result: MatchResult, home: Team, away: Team) {
  const team = (id: string | null | undefined) => (id === home.id ? 'H' : id === away.id ? 'A' : id ?? null);
  const player = (id: string | undefined) => {
    if (!id) return null;
    const h = home.players.findIndex(p => p.id === id);
    if (h >= 0) return `H${h}`;
    const a = away.players.findIndex(p => p.id === id);
    return a >= 0 ? `A${a}` : id;
  };
  return {
    score: [result.homeGoals, result.awayGoals],
    winner: team(result.winner),
    penalties: [result.homePenalties ?? null, result.awayPenalties ?? null],
    kicks: (result.penaltyKicks ?? []).map(k => [team(k.teamId), k.takerName, k.gkName, k.isGoal]),
    events: result.events.map(e => [e.minute, e.type, team(e.teamId), player(e.playerId), player(e.opponentId), player(e.assisterId), e.description]),
  };
}

describe('motor de partida — referência fixa', () => {
  afterEach(() => vi.restoreAllMocks());

  it('as mesmas sementes geram exatamente as mesmas partidas', async () => {
    const all = SEEDS.map(seed => {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const home = generateBotTeam(`Casa ${seed}`, 0.8);
      const away = generateBotTeam(`Fora ${seed}`, 0.8);
      const result = simulateMatch(home, away, seed % 3 === 0, false);
      vi.restoreAllMocks();
      return fingerprint(result, home, away);
    });
    await expect(JSON.stringify(all, null, 1)).toMatchFileSnapshot('./__snapshots__/engine-golden.json');
  });
});
