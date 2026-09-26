import { describe, expect, it } from 'vitest';
import {
  CLUB_PROJECT_DEFINITIONS,
  CLUB_PROJECT_ORDER,
  CLUB_PROJECT_LEVELS,
  createInitialClubProjects,
  createRecruitmentOfferMeta,
  getRecruitmentOfferConfig,
  medicalFreeTreatmentsPerCompetition,
  medicalInjuryDuration,
  medicalPhysioCost,
  medicalReturnBoost,
  bettingLossRefundPercent,
  bettingStakeCapBonus,
  normalizeClubProjects,
  purchaseClubProjectUpgrade,
  projectUpgradeCost,
  calculateClubReward,
  stadiumHomeBonus,
  supportersBonusPercent,
  trainingBoostForProject,
  trainingCostForProject,
} from './clubProjects';

describe('estrutura dos Projetos do Clube', () => {
  it('mantém os sete projetos na ordem oficial e todos começam no nível 1', () => {
    const projects = createInitialClubProjects();

    expect(CLUB_PROJECT_DEFINITIONS.map(project => project.id)).toEqual([...CLUB_PROJECT_ORDER]);
    expect(Object.values(projects.levels)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(CLUB_PROJECT_LEVELS).toBe(5);
  });

  it('normaliza estado ausente, inválido e níveis fora da faixa', () => {
    expect(normalizeClubProjects(undefined)).toEqual(createInitialClubProjects());
    expect(normalizeClubProjects({ levels: { recruitment: 99, analysis: 2.8, medical: 0 } }).levels).toEqual({
      recruitment: 5,
      analysis: 2,
      betting: 1,
      medical: 1,
      training: 1,
      stadium: 1,
      supporters: 1,
    });
  });

  it('expõe os custos somente para evoluções válidas', () => {
    expect(projectUpgradeCost(1)).toBeNull();
    expect(projectUpgradeCost(2)).toBe(150);
    expect(projectUpgradeCost(3)).toBe(200);
    expect(projectUpgradeCost(4)).toBe(250);
    expect(projectUpgradeCost(5)).toBe(300);
    expect(projectUpgradeCost(6)).toBeNull();
  });

  it('concede uma fisioterapia gratuita no nível 1 do Departamento Médico', () => {
    expect(medicalFreeTreatmentsPerCompetition(1)).toBe(1);
    expect(medicalFreeTreatmentsPerCompetition(5)).toBe(1);
  });

  it('aplica os preços, duração fixa das lesões e bônus de retorno do Departamento Médico', () => {
    expect(medicalPhysioCost(1)).toBe(150);
    expect(medicalPhysioCost(2)).toBe(100);
    expect(medicalPhysioCost(3)).toBe(50);
    expect(medicalPhysioCost(5)).toBe(50);
    expect(medicalInjuryDuration(1)).toBe(3);
    expect(medicalInjuryDuration(2)).toBe(2);
    expect(medicalInjuryDuration(3)).toBe(1);
    expect(medicalInjuryDuration(5)).toBe(1);
    expect(medicalReturnBoost(1)).toBe(0);
    expect(medicalReturnBoost(3)).toBe(0);
    expect(medicalReturnBoost(4)).toBe(5);
    expect(medicalReturnBoost(5)).toBe(10);
  });

  it('calcula a progressão da Central de Palpites', () => {
    expect(bettingStakeCapBonus(1)).toBe(0);
    expect(bettingStakeCapBonus(2)).toBe(50);
    expect(bettingStakeCapBonus(3)).toBe(50);
    expect(bettingStakeCapBonus(4)).toBe(100);
    expect(bettingStakeCapBonus(5)).toBe(100);
    expect(bettingLossRefundPercent(1)).toBe(0);
    expect(bettingLossRefundPercent(2)).toBe(0);
    expect(bettingLossRefundPercent(3)).toBe(25);
    expect(bettingLossRefundPercent(4)).toBe(50);
    expect(bettingLossRefundPercent(5)).toBe(50);
  });

  it('calcula as opções e contratações do Centro de Recrutamento', () => {
    expect(getRecruitmentOfferConfig(6, 1, 1)).toEqual({ optionCount: 6, selectionLimit: 1, freeRerolls: 0, minimumOverall: 0 });
    expect(getRecruitmentOfferConfig(6, 2, 1)).toEqual({ optionCount: 8, selectionLimit: 1, freeRerolls: 0, minimumOverall: 0 });
    expect(getRecruitmentOfferConfig(6, 3, 2)).toEqual({ optionCount: 8, selectionLimit: 2, freeRerolls: 0, minimumOverall: 0 });
    expect(getRecruitmentOfferConfig(6, 4, 1)).toEqual({ optionCount: 8, selectionLimit: 2, freeRerolls: 1, minimumOverall: 0 });
    expect(getRecruitmentOfferConfig(6, 5, 1)).toEqual({ optionCount: 8, selectionLimit: 2, freeRerolls: 1, minimumOverall: 88 });
    expect(getRecruitmentOfferConfig(12, 5, 1).optionCount).toBe(10);
  });

  it('mantém o progresso das escolhas no metadado da oferta', () => {
    expect(createRecruitmentOfferMeta('round', 3, 4, 6, 2, 1, 0)).toEqual({
      eventKind: 'round',
      eventNumber: 3,
      projectLevel: 4,
      baseOptions: 6,
      selectionLimit: 2,
      selectionsMade: 0,
      freeRerolls: 1,
      rerollsUsed: 0,
      minimumOverall: 0,
    });
  });

  it('aplica uma evolução de forma atômica e bloqueia saldo ou nível inválidos', () => {
    const first = purchaseClubProjectUpgrade(createInitialClubProjects(), 'recruitment', 200);
    expect(first).toMatchObject({ fromLevel: 1, toLevel: 2, cost: 150, remainingCredits: 50 });
    expect(first?.projects.levels.recruitment).toBe(2);
    expect(purchaseClubProjectUpgrade(createInitialClubProjects(), 'recruitment', 149)).toBeNull();
    expect(purchaseClubProjectUpgrade({ levels: { recruitment: 5, analysis: 1, betting: 1, medical: 1, training: 1, stadium: 1, supporters: 1 } }, 'recruitment', 9999)).toBeNull();
  });

  it('permite evoluir o Núcleo de Análise com a mesma regra atômica', () => {
    const result = purchaseClubProjectUpgrade(createInitialClubProjects(), 'analysis', 200);

    expect(result).toMatchObject({ fromLevel: 1, toLevel: 2, cost: 150, remainingCredits: 50 });
    expect(result?.projects.levels.analysis).toBe(2);
  });

  it('calcula o Centro de Treinamento por nível e por jogador', () => {
    expect(trainingCostForProject(1, 0)).toBe(100);
    expect(trainingCostForProject(2, 0)).toBe(50);
    expect(trainingCostForProject(2, 1)).toBe(100);
    expect(trainingCostForProject(2, 2)).toBe(150);
    expect(trainingBoostForProject(1, true)).toBe(3);
    expect(trainingBoostForProject(3, true)).toBe(4);
    expect(trainingBoostForProject(3, false)).toBe(3);
    expect(trainingBoostForProject(4, false)).toBe(4);
    expect(trainingCostForProject(5, 0)).toBe(50);
    expect(trainingCostForProject(5, 1)).toBe(75);
  });

  it('calcula a progressão numérica do Estádio e percentual da Torcida', () => {
    expect([1, 2, 3, 4, 5].map(stadiumHomeBonus)).toEqual([3, 5, 7, 9, 11]);
    expect(supportersBonusPercent(1, 'home')).toBe(0);
    expect(supportersBonusPercent(2, 'home')).toBe(15);
    expect(supportersBonusPercent(5, 'home')).toBe(45);
    expect(supportersBonusPercent(2, 'away')).toBe(10);
    expect(supportersBonusPercent(5, 'away')).toBe(25);
    expect(supportersBonusPercent(5, 'neutral')).toBe(0);
  });

  it('calcula Torcida e Magnata sobre a mesma base, sem multiplicação em cascata', () => {
    expect(calculateClubReward(100, 3, 'home', true)).toEqual({
      base: 100,
      supportersBonus: 25,
      supportersPercent: 25,
      supportersVenue: 'home',
      magnataBonus: 50,
      magnataPercent: 50,
      total: 175,
    });
    expect(calculateClubReward(100, 5, 'away', false).total).toBe(125);
  });

  it('migra o projeto combinado antigo para Estádio e Torcida', () => {
    expect(normalizeClubProjects({ levels: { stadiumSupporters: 4 } }).levels).toMatchObject({ stadium: 4, supporters: 4 });
  });
});
