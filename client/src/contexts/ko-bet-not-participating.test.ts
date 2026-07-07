import { describe, it, expect } from 'vitest';
import { revealEligibleKoBets, type Bet } from '../lib/bets';

// Cenário do usuário: apostar num confronto de mata-mata que ele NÃO joga (ex.: foi
// direto pras oitavas, apostou no playoff). O resultado do palpite nunca aparecia porque
// a revelação estava amarrada a ele terminar a PRÓPRIA partida. `revealEligibleKoBets`
// resolve isso: revela palpites com resultado que são SEGUROS (confronto alheio → sem
// spoiler; ou perna própria já assistida), mantendo o anti-spoiler do confronto próprio.

const mkRes = (h: number, a: number) => ({ homeGoals: h, awayGoals: a });

describe('revealEligibleKoBets', () => {
  it('revela palpite de confronto que o jogador NÃO joga (o bug reportado)', () => {
    const ties = [{ id: 'p0', homeTeamId: 'bot_a', awayTeamId: 'bot_b', leg1: mkRes(2, 0) }];
    const bets: Bet[] = [{ matchKey: 'Kp0:1', homeGoals: 2, awayGoals: 0, stake: 30 }];
    const { bets: out, winnings } = revealEligibleKoBets(bets, ties, 'me', []);
    expect(out[0].settled).toBe(true);
    expect(out[0].revealed).toBe(true);
    expect(out[0].tier).toBe('exact');
    expect(winnings).toBeGreaterThan(0);
  });

  it('NÃO revela o confronto PRÓPRIO ainda não assistido (anti-spoiler)', () => {
    const ties = [{ id: 't', homeTeamId: 'me', awayTeamId: 'bot_b', leg1: mkRes(1, 0) }];
    const bets: Bet[] = [{ matchKey: 'Kt:1', homeGoals: 1, awayGoals: 0, stake: 20 }];
    const { bets: out, winnings } = revealEligibleKoBets(bets, ties, 'me', []); // não assistiu
    expect(out[0].settled).toBeUndefined();
    expect(out[0].revealed).toBeUndefined();
    expect(winnings).toBe(0);
  });

  it('revela o confronto próprio DEPOIS de assistir a perna', () => {
    const ties = [{ id: 't', homeTeamId: 'me', awayTeamId: 'bot_b', leg1: mkRes(1, 0) }];
    const bets: Bet[] = [{ matchKey: 'Kt:1', homeGoals: 1, awayGoals: 0, stake: 20 }];
    const { bets: out } = revealEligibleKoBets(bets, ties, 'me', ['t_l1']); // assistiu a ida
    expect(out[0].revealed).toBe(true);
  });

  it('ignora palpite sem resultado ainda e o já revelado', () => {
    const ties = [{ id: 'p0', homeTeamId: 'bot_a', awayTeamId: 'bot_b' }]; // sem leg1
    const bets: Bet[] = [
      { matchKey: 'Kp0:1', homeGoals: 2, awayGoals: 0, stake: 30 },
      { matchKey: 'Kp0:2', homeGoals: 1, awayGoals: 1, stake: 10, settled: true, revealed: true, won: true, payout: 25 },
    ];
    const { bets: out, winnings } = revealEligibleKoBets(bets, ties, 'me', []);
    expect(out[0].revealed).toBeUndefined(); // sem resultado → fica
    expect(out[1].payout).toBe(25);          // já revelado → intocado
    expect(winnings).toBe(0);
  });
});
