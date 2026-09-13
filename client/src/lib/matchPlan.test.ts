import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MATCH_PLAN,
  MAX_MATCH_TRIGGERS,
  normalizeMatchPlan,
  validateMatchPlan,
} from './gameEngine';

describe('plano de jogo', () => {
  it('começa sem gatilhos e permanece limitado a três respostas', () => {
    const plan = normalizeMatchPlan();

    expect(plan).toEqual(DEFAULT_MATCH_PLAN);
    expect(plan.triggers).toEqual([]);
    expect(plan.triggers.length).toBeLessThanOrEqual(MAX_MATCH_TRIGGERS);
    expect(plan.triggers.every(trigger => trigger.minute >= 15 && trigger.minute <= 85)).toBe(true);
  });

  it('preserva a opção explícita de não usar gatilhos', () => {
    expect(normalizeMatchPlan({ triggers: [] })).toEqual({ triggers: [] });
    expect(validateMatchPlan({ triggers: [] })).toEqual({ triggers: [] });
  });

  it('aceita exatamente três gatilhos configurados', () => {
    const triggers = [
      { id: 'one', condition: 'losing', minute: 60, action: 'counter' },
      { id: 'two', condition: 'draw', minute: 70, action: 'possession' },
      { id: 'three', condition: 'winning', margin: 3, minute: 80, action: 'defensive' },
    ] as const;

    expect(validateMatchPlan({ triggers })).toEqual({ triggers: [...triggers] });
  });

  it('rejeita payloads inválidos ou fora do limite no boundary do servidor', () => {
    expect(validateMatchPlan({ triggers: Array.from({ length: MAX_MATCH_TRIGGERS + 1 }, (_, index) => ({
      id: `trigger-${index}`,
      condition: 'losing',
      minute: 65,
      action: 'all_out_attack',
    })) })).toBeNull();

    expect(validateMatchPlan({ triggers: [{ id: 'same', condition: 'losing', minute: 65, action: 'all_out_attack' }, {
      id: 'same', condition: 'winning', minute: 75, action: 'defensive',
    }] })).toBeNull();

    expect(validateMatchPlan({ triggers: [{ id: 'bad', condition: 'anything', minute: 65, action: 'all_out_attack' }] })).toBeNull();
  });

  it('normaliza minuto, ação e condição sem deixar valores absurdos no cliente', () => {
    const plan = normalizeMatchPlan({ triggers: [{ id: 'late', condition: 'winning', minute: 999, action: 'defensive' }] });
    expect(plan.triggers[0]).toMatchObject({ minute: 85, condition: 'winning', action: 'defensive' });
  });

  it('aceita margens personalizadas de placar e migra condições antigas', () => {
    expect(validateMatchPlan({ triggers: [{
      id: 'three-goal-plan', condition: 'losing', margin: 3, minute: 55, action: 'counter',
    }] })).toEqual({
      triggers: [{ id: 'three-goal-plan', condition: 'losing', margin: 3, minute: 55, action: 'counter' }],
    });
    expect(validateMatchPlan({ triggers: [{
      id: 'legacy-plan', condition: 'losing_by_two', minute: 55, action: 'counter',
    }] })).toEqual({
      triggers: [{ id: 'legacy-plan', condition: 'losing', margin: 2, minute: 55, action: 'counter' }],
    });
    expect(validateMatchPlan({ triggers: [{
      id: 'scoreless-plan', condition: 'scoreless', minute: 60, action: 'balanced',
    }] })).toEqual({
      triggers: [{ id: 'scoreless-plan', condition: 'draw', minute: 60, action: 'balanced' }],
    });
    expect(validateMatchPlan({ triggers: [{
      id: 'red-plan', condition: 'opponent_red_card', minute: 45, action: 'possession',
    }] })).toEqual({
      triggers: [{ id: 'red-plan', condition: 'opponent_red_card', minute: 0, action: 'possession' }],
    });
  });
});
