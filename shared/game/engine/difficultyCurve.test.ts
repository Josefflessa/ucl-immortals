import { describe, expect, it } from 'vitest';
import { createCompetitionFormat } from '../competition';
import { botStrengthMultiplier, campaignProgress, knockoutRoundCount, leagueStageCount, roundsFromFinal } from './difficultyCurve';
import { DIFFICULTY_LEVELS } from '../gameData';

describe('curva de dificuldade da campanha', () => {
  const liga = createCompetitionFormat('league_knockout');

  it('começa em 0 na primeira rodada e termina em 1 na final', () => {
    expect(campaignProgress(liga, { phase: 'league', round: 1 })).toBe(0);
    expect(campaignProgress(liga, { phase: 'knockout', fromFinal: 0 })).toBe(1);
  });

  it('só sobe: cada rodada e cada fase do mata-mata aumenta a curva', () => {
    const steps = [
      ...Array.from({ length: leagueStageCount(liga) }, (_, i) => campaignProgress(liga, { phase: 'league', round: i + 1 })),
      ...Array.from({ length: knockoutRoundCount(liga) }, (_, i) => campaignProgress(liga, { phase: 'knockout', fromFinal: knockoutRoundCount(liga) - 1 - i })),
    ];
    for (let i = 1; i < steps.length; i++) expect(steps[i], `passo ${i}`).toBeGreaterThan(steps[i - 1]);
  });

  it('o mata-mata sobe mais por fase que a liga', () => {
    const league = campaignProgress(liga, { phase: 'league', round: 3 }) - campaignProgress(liga, { phase: 'league', round: 2 });
    const knockout = campaignProgress(liga, { phase: 'knockout', fromFinal: 1 }) - campaignProgress(liga, { phase: 'knockout', fromFinal: 2 });
    expect(knockout).toBeGreaterThan(league);
  });

  it('conta as fases de cada formato', () => {
    expect(knockoutRoundCount(liga)).toBe(5); // playoff, oitavas, quartas, semi e final
    expect(knockoutRoundCount(createCompetitionFormat('knockout'))).toBeGreaterThanOrEqual(1);
    expect(knockoutRoundCount(createCompetitionFormat('league'))).toBe(0);
    // Pontos corridos: a curva corre só pelas rodadas, da primeira à última.
    const pontos = createCompetitionFormat('league');
    expect(campaignProgress(pontos, { phase: 'league', round: 1 })).toBe(0);
    expect(campaignProgress(pontos, { phase: 'league', round: leagueStageCount(pontos) })).toBe(1);
    // Mata-mata direto: da primeira fase à final.
    const direto = createCompetitionFormat('knockout');
    expect(campaignProgress(direto, { phase: 'knockout', fromFinal: knockoutRoundCount(direto) - 1 })).toBe(0);
    expect(campaignProgress(direto, { phase: 'knockout', fromFinal: 0 })).toBe(1);
  });

  it('os nomes das fases do chaveamento viram a distância até a final', () => {
    expect(['final', 'semis', 'quarters', 'round16', 'playoffs'].map(roundsFromFinal)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('força dos bots por nível e por fase', () => {
  const levels = DIFFICULTY_LEVELS.map(level => level.botStrength);

  it('cada nível é mais forte que o anterior, no começo e no fim', () => {
    for (const progress of [0, 1]) {
      for (let i = 1; i < levels.length; i++) {
        expect(botStrengthMultiplier(levels[i], progress)).toBeGreaterThan(botStrengthMultiplier(levels[i - 1], progress));
      }
    }
  });

  it('o bot fica mais forte a cada fase, em todos os níveis', () => {
    for (const strength of levels) {
      expect(botStrengthMultiplier(strength, 1)).toBeGreaterThan(botStrengthMultiplier(strength, 0.5));
      expect(botStrengthMultiplier(strength, 0.5)).toBeGreaterThan(botStrengthMultiplier(strength, 0));
    }
  });

  it('sem fase informada o bot joga com a força do começo', () => {
    for (const strength of levels) expect(botStrengthMultiplier(strength)).toBe(botStrengthMultiplier(strength, 0));
  });
});
