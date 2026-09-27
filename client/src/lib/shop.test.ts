import { describe, it, expect } from 'vitest';
import { sellValue, canEvolvePrime, PRIME_COST, PRIME_WINS_REQUIRED, SHOP_COSTS, lossStreakBonus, nextLossStreak, LOSS_STREAK_BONUS_STEP, LOSS_STREAK_BONUS_MAX_STEPS } from './shop';

describe('Pacote Único', () => {
  it('custa 750 pontos', () => {
    expect(SHOP_COSTS.uniqueCard).toBe(750);
  });
});

describe('canEvolvePrime', () => {
  it('exige 4 vitórias E 350 pontos', () => {
    expect(PRIME_COST).toBe(350);
    expect(PRIME_WINS_REQUIRED).toBe(4);
    expect(canEvolvePrime(4, 350)).toBe(true);
    expect(canEvolvePrime(10, 800)).toBe(true);
    expect(canEvolvePrime(3, 500)).toBe(false);
    expect(canEvolvePrime(4, 349)).toBe(false);
  });
});

describe('sellValue — valor de venda por raridade', () => {
  it('cada raridade tem o valor calibrado', () => {
    expect(sellValue('bronze')).toBe(30);
    expect(sellValue('silver')).toBe(60);
    expect(sellValue('gold')).toBe(100);
    expect(sellValue('legendary')).toBe(180);
    expect(sellValue('immortal')).toBe(250);
    expect(sellValue('unique')).toBe(400);
  });
  it('raridade desconhecida cai no fallback bronze (30)', () => {
    expect(sellValue('inexistente')).toBe(30);
  });
});

describe('🔥 Recuperação — bônus de sequência de derrotas', () => {
  it('não paga nada em vitória ou empate, mesmo com sequência anterior', () => {
    expect(lossStreakBonus('win', 4)).toBe(0);
    expect(lossStreakBonus('draw', 4)).toBe(0);
  });

  it('cresce a cada derrota consecutiva, capado no 6º da fileira', () => {
    expect(LOSS_STREAK_BONUS_STEP).toBe(15);
    expect(LOSS_STREAK_BONUS_MAX_STEPS).toBe(5);
    expect(lossStreakBonus('loss', 0)).toBe(0);   // 1ª derrota da fileira: só o LOSS_PTS normal
    expect(lossStreakBonus('loss', 1)).toBe(15);  // 2ª seguida
    expect(lossStreakBonus('loss', 2)).toBe(30);  // 3ª seguida
    expect(lossStreakBonus('loss', 3)).toBe(45);  // 4ª seguida
    expect(lossStreakBonus('loss', 4)).toBe(60);  // 5ª seguida
    expect(lossStreakBonus('loss', 5)).toBe(75);  // 6ª seguida: teto atingido
    expect(lossStreakBonus('loss', 6)).toBe(75);  // 7ª+ não cresce mais
    expect(lossStreakBonus('loss', 99)).toBe(75);
  });

  it('nextLossStreak incrementa em derrota e zera em vitória/empate', () => {
    expect(nextLossStreak('loss', 0)).toBe(1);
    expect(nextLossStreak('loss', 3)).toBe(4);
    expect(nextLossStreak('win', 5)).toBe(0);
    expect(nextLossStreak('draw', 5)).toBe(0);
  });
});
