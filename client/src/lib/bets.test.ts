import { describe, it, expect } from 'vitest';
import { settleBet, roundStakeUsed, canPlaceStake, buildLeagueMatchKey, BET_EXACT_MULT, BET_OUTCOME_MULT, Bet } from './bets';

const bet = (over: Partial<Bet> = {}): Bet => ({ matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100, ...over });

describe('settleBet', () => {
  it('placar exato paga BET_EXACT_MULT', () => {
    expect(settleBet(bet(), { homeGoals: 2, awayGoals: 1 })).toEqual({ won: true, tier: 'exact', payout: Math.round(100 * BET_EXACT_MULT) });
  });
  it('resultado certo mas placar errado paga BET_OUTCOME_MULT', () => {
    expect(settleBet(bet(), { homeGoals: 3, awayGoals: 0 })).toEqual({ won: true, tier: 'outcome', payout: Math.round(100 * BET_OUTCOME_MULT) });
  });
  it('empate acertado no resultado (placar diferente) paga outcome', () => {
    expect(settleBet(bet({ homeGoals: 1, awayGoals: 1 }), { homeGoals: 0, awayGoals: 0 })).toEqual({ won: true, tier: 'outcome', payout: Math.round(100 * BET_OUTCOME_MULT) });
  });
  it('resultado errado perde tudo', () => {
    expect(settleBet(bet(), { homeGoals: 0, awayGoals: 2 })).toEqual({ won: false, tier: 'miss', payout: 0 });
  });
  it('arredonda o payout de stake ímpar', () => {
    expect(settleBet(bet({ stake: 33 }), { homeGoals: 2, awayGoals: 1 }).payout).toBe(Math.round(33 * BET_EXACT_MULT));
  });
});

describe('teto por rodada', () => {
  it('roundStakeUsed soma só os bets do prefixo da rodada', () => {
    const bets: Bet[] = [bet({ matchKey: 'L1:a-b', stake: 80 }), bet({ matchKey: 'L1:c-d', stake: 50 }), bet({ matchKey: 'L2:e-f', stake: 70 })];
    expect(roundStakeUsed(bets, 'L1:')).toBe(130);
  });
  it('canPlaceStake respeita o teto, ignorando o próprio bet ao editar', () => {
    const bets: Bet[] = [bet({ matchKey: 'L1:a-b', stake: 150 })];
    expect(canPlaceStake(bets, 'L1:', 'L1:a-b', 200)).toBe(true);   // editar o mesmo bet p/ 200 cabe
    expect(canPlaceStake(bets, 'L1:', 'L1:c-d', 60)).toBe(false);   // novo de 60 estoura (210)
    expect(canPlaceStake(bets, 'L1:', 'L1:c-d', 50)).toBe(true);    // novo de 50 cabe (200)
  });
  it('buildLeagueMatchKey monta o prefixo esperado', () => {
    expect(buildLeagueMatchKey(3, 'x', 'y')).toBe('L3:x-y');
  });
});
