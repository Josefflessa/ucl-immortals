import { describe, it, expect } from 'vitest';
import {
  calculateBuilderMultiplier,
  canPlaceStake,
  buildLeagueMatchKey,
  BET_EXACT_MULT,
  BET_OUTCOME_MULT,
  BET_TOTAL_CARDS_LINES,
  Bet,
  createBet,
  roundStakeUsed,
  settleBet,
} from './bets';

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
  it('liquida a vitória do meu time na volta usando o mando real da perna', () => {
    const returnLegBet = bet({
      matchKey: 'Kt:2',
      homeTeamId: 'opponent',
      awayTeamId: 'me',
      homeGoals: 0,
      awayGoals: 1,
    });
    expect(settleBet(returnLegBet, {
      homeTeamId: 'opponent',
      awayTeamId: 'me',
      homeGoals: 0,
      awayGoals: 1,
    })).toEqual({ won: true, tier: 'exact', payout: Math.round(100 * BET_EXACT_MULT) });
  });
  it('corrige a orientação quando um palpite legado veio na ordem da ida', () => {
    const legacyReturnBet = bet({
      matchKey: 'Kt:2',
      homeTeamId: 'me',
      awayTeamId: 'opponent',
      homeGoals: 1,
      awayGoals: 0,
    });
    expect(settleBet(legacyReturnBet, {
      homeTeamId: 'opponent',
      awayTeamId: 'me',
      homeGoals: 0,
      awayGoals: 1,
    })).toEqual({ won: true, tier: 'exact', payout: Math.round(100 * BET_EXACT_MULT) });
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

describe('aposta combinada', () => {
  const builderSelections = [
    { type: 'both_score', value: true as const },
    { type: 'total_goals', operator: 'over' as const, line: 2.5 as const },
  ];

  it('aceita uma ou mais condições, sem repetir o mesmo mercado', () => {
    expect(calculateBuilderMultiplier(builderSelections)).toBe(2.2);
    expect(createBet({ matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [{ type: 'both_score', value: true }] })).toMatchObject({ market: 'builder', multiplier: 1.7 });
    expect(createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder',
      selections: [...builderSelections, { type: 'both_score', value: false as const }],
    })).toBeNull();
  });

  it('não reduz a cotação ao combinar vitória com mais de 0,5 gols', () => {
    const combined = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [
        { type: 'outcome', value: 'home' as const },
        { type: 'total_goals', operator: 'over' as const, line: 0.5 as const },
      ],
    });
    expect(combined?.multiplier).toBe(BET_OUTCOME_MULT);
    expect(combined?.multiplier).toBeGreaterThanOrEqual(BET_OUTCOME_MULT);
  });

  it('valoriza uma linha de mais de 1,5 gols sem tratá-la como redundante', () => {
    const combined = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [
        { type: 'outcome', value: 'home' as const },
        { type: 'total_goals', operator: 'over' as const, line: 1.5 as const },
      ],
    });
    expect(combined?.multiplier).toBe(1.7);
  });

  it('não cobra duas vezes uma condição já garantida por outra', () => {
    const combined = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [
        { type: 'exact_score', homeGoals: 2, awayGoals: 1 },
        { type: 'outcome', value: 'home' as const },
        { type: 'total_goals', operator: 'over' as const, line: 1.5 as const },
      ],
    });
    expect(combined?.multiplier).toBe(BET_EXACT_MULT);
  });

  it('rejeita uma combinação matematicamente impossível', () => {
    const combined = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [
        { type: 'outcome', value: 'home' as const },
        { type: 'total_goals', operator: 'under' as const, line: 0.5 as const },
      ],
    });
    expect(combined).toBeNull();
  });

  it('só paga quando todas as condições da combinada acontecem', () => {
    const combined = createBet({ matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: builderSelections });
    expect(combined?.multiplier).toBe(2.2);
    expect(settleBet(combined!, { homeGoals: 2, awayGoals: 1 })).toEqual({ won: true, tier: 'builder', payout: 220 });
    expect(settleBet(combined!, { homeGoals: 1, awayGoals: 1 })).toEqual({ won: false, tier: 'miss', payout: 0 });
    expect(settleBet(combined!, { homeGoals: 3, awayGoals: 0 })).toEqual({ won: false, tier: 'miss', payout: 0 });
  });

  it('trata placar exato como condição própria, sem herdar o resultado simples', () => {
    const exactOnly = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder',
      selections: [{ type: 'exact_score', homeGoals: 2, awayGoals: 1 }],
    });
    expect(settleBet(exactOnly!, { homeGoals: 2, awayGoals: 1 })).toEqual({ won: true, tier: 'exact', payout: 250 });
    expect(settleBet(exactOnly!, { homeGoals: 3, awayGoals: 0 })).toEqual({ won: false, tier: 'miss', payout: 0 });
  });

  it('mantém a perspectiva correta na volta do mata-mata', () => {
    const combined = createBet({
      matchKey: 'Kt:2', homeTeamId: 'me', awayTeamId: 'opponent', stake: 50,
      market: 'builder', selections: [
        { type: 'outcome', value: 'home' as const },
        { type: 'both_score', value: true as const },
      ],
    });
    expect(settleBet(combined!, {
      homeTeamId: 'opponent', awayTeamId: 'me', homeGoals: 1, awayGoals: 2,
    }).won).toBe(true);
  });

  it('permite escolher a linha de gols e a liquida de forma estrita', () => {
    const combined = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [
        { type: 'outcome', value: 'home' as const },
        { type: 'total_goals', operator: 'over' as const, line: 3.5 as const },
      ],
    });
    expect(combined?.multiplier).toBe(2.4);
    expect(settleBet(combined!, { homeGoals: 3, awayGoals: 1 })).toEqual({ won: true, tier: 'builder', payout: 240 });
    expect(settleBet(combined!, { homeGoals: 2, awayGoals: 1 })).toEqual({ won: false, tier: 'miss', payout: 0 });
    expect(createBet({ matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [{ type: 'total_goals', operator: 'over', line: 2 }] })).toBeNull();
  });

  it('oferece total de cartões com linhas próprias e liquida pelos eventos disciplinares', () => {
    expect(BET_TOTAL_CARDS_LINES).toEqual([0.5, 1.5, 2.5, 3.5, 4.5]);
    const combined = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder', selections: [
        { type: 'outcome', value: 'home' as const },
        { type: 'total_cards', operator: 'over' as const, line: 1.5 as const },
      ],
    });
    expect(combined?.multiplier).toBe(1.85);
    expect(settleBet(combined!, {
      homeGoals: 2,
      awayGoals: 0,
      events: [{ type: 'yellow' }, { type: 'red' }, { type: 'foul' }],
    })).toEqual({ won: true, tier: 'builder', payout: 185 });
    expect(settleBet(combined!, {
      homeGoals: 2,
      awayGoals: 0,
      events: [{ type: 'yellow' }],
    })).toEqual({ won: false, tier: 'miss', payout: 0 });
  });

  it('não credita mercado de cartões quando o resultado não traz eventos', () => {
    const cardBet = createBet({
      matchKey: 'L1:a-b', stake: 100, market: 'builder',
      selections: [{ type: 'total_cards', operator: 'over' as const, line: 0.5 as const }],
    });
    expect(settleBet(cardBet!, { homeGoals: 1, awayGoals: 0 })).toEqual({ won: false, tier: 'miss', payout: 0 });
  });
});
