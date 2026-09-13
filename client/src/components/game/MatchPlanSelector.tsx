import { useMemo, useState } from 'react';
import { Button, IconButton, Panel, PanelBody, PanelHeader, PanelTitle } from '../../design-system';
import { getTacticById } from '../../lib/gameData';
import {
  MATCH_TRIGGER_GOAL_MARGINS,
  MATCH_TRIGGER_MINUTES,
  MAX_MATCH_TRIGGERS,
  normalizeMatchPlan,
  type MatchPlan,
  type MatchTrigger,
  type MatchTriggerAction,
  type MatchTriggerCondition,
} from '../../lib/gameEngine';
import { cn } from '../../lib/utils';

interface MatchPlanSelectorProps {
  value?: MatchPlan;
  onChange: (plan: MatchPlan) => void;
  playStyle: string;
}

const CONDITION_LABELS: Record<MatchTriggerCondition, string> = {
  losing: 'Placar: perdendo',
  draw: 'Placar: empatando (inclui 0–0)',
  winning: 'Placar: vencendo',
  red_card: 'Seu time recebe vermelho',
  opponent_red_card: 'Adversário recebe vermelho',
};

const ACTION_LABELS: Record<MatchTriggerAction, string> = {
  balanced: 'Equilibrado',
  possession: 'Posse de Bola',
  counter: 'Contra-ataque',
  high_press: 'Pressão Alta',
  defensive: 'Defensivo',
  all_out_attack: 'Tudo pro Ataque',
};

const ACTION_OPTIONS = Object.keys(ACTION_LABELS) as MatchTriggerAction[];
const CONDITION_OPTIONS = Object.keys(CONDITION_LABELS) as MatchTriggerCondition[];

function isScoreMarginCondition(condition: MatchTriggerCondition): boolean {
  return condition === 'losing' || condition === 'winning';
}

function triggerSummary(trigger: MatchTrigger): string {
  let when: string;
  switch (trigger.condition) {
    case 'losing':
      when = trigger.margin && trigger.margin > 1
        ? `perdendo por ${trigger.margin}+ gols aos ${trigger.minute}'`
        : `perdendo aos ${trigger.minute}'`;
      break;
    case 'winning':
      when = trigger.margin && trigger.margin > 1
        ? `vencendo por ${trigger.margin}+ gols aos ${trigger.minute}'`
        : `vencendo aos ${trigger.minute}'`;
      break;
    case 'red_card':
      when = 'após vermelho do seu time';
      break;
    case 'opponent_red_card':
      when = 'após vermelho adversário';
      break;
    default:
      when = `${CONDITION_LABELS[trigger.condition].toLowerCase()} aos ${trigger.minute}'`;
  }
  return `${when} → ${ACTION_LABELS[trigger.action]}`;
}

export default function MatchPlanSelector({ value, onChange, playStyle }: MatchPlanSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const plan = useMemo(() => normalizeMatchPlan(value), [value]);
  const currentTactic = getTacticById(playStyle);

  const updateTriggers = (triggers: MatchTrigger[]) => {
    onChange(normalizeMatchPlan({ triggers }));
  };

  const updateTrigger = (index: number, patch: Partial<MatchTrigger>) => {
    updateTriggers(plan.triggers.map((trigger, triggerIndex) => (
      triggerIndex === index ? { ...trigger, ...patch } : trigger
    )));
  };

  const addTrigger = () => {
    if (plan.triggers.length >= MAX_MATCH_TRIGGERS) return;
    let id = `trigger-${plan.triggers.length + 1}`;
    let suffix = 2;
    while (plan.triggers.some(trigger => trigger.id === id)) {
      id = `trigger-${plan.triggers.length + 1}-${suffix}`;
      suffix++;
    }
    updateTriggers([
      ...plan.triggers,
      { id, condition: 'losing', minute: 65, action: 'all_out_attack' },
    ]);
  };

  return (
    <Panel density="compact" tone="inset" className="border-[var(--ui-border)]">
      <PanelHeader className="items-start gap-3 sm:items-center">
        <div className="min-w-0">
          <PanelTitle>PLANO DE JOGO</PanelTitle>
        </div>
        <Button
          type="button"
          intent="secondary"
          size="default"
          className="shrink-0 text-xs"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(open => !open)}
        >
          {isOpen ? 'Fechar edição' : 'Configurar gatilhos'}
        </Button>
      </PanelHeader>

      <PanelBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--ui-text)]">
          <span className="font-semibold text-[var(--ui-brand-strong)]">Tática inicial:</span>
          <span>{currentTactic.name}</span>
          <span className="text-[var(--ui-text-faint)]">·</span>
          <span className="text-xs text-[var(--ui-text-muted)]">até {MAX_MATCH_TRIGGERS} mudanças automáticas</span>
        </div>

        {plan.triggers.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Resumo do plano de jogo">
            {plan.triggers.map(trigger => (
              <span
                key={trigger.id}
                className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-strong)] px-2.5 py-1.5 text-xs text-[var(--ui-text-muted)]"
              >
                {triggerSummary(trigger)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--ui-text-muted)]">Sem mudança automática. A tática inicial permanece até o fim.</p>
        )}

        {isOpen ? (
          <div className="space-y-3 border-t border-[var(--ui-border)] pt-3">
            <p className="text-xs text-[var(--ui-text-muted)]">Até 3 regras. Cada uma dispara uma vez; vermelho é imediato.</p>

            {plan.triggers.map((trigger, index) => (
              <div key={trigger.id} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ui-brand-strong)]">
                    Gatilho {index + 1}
                  </span>
                  <IconButton
                    label={`Remover gatilho ${index + 1}`}
                    className="h-8 w-8 text-base"
                    onClick={() => updateTriggers(plan.triggers.filter((_, triggerIndex) => triggerIndex !== index))}
                  >
                    ×
                  </IconButton>
                </div>

                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  <label className="min-w-0 text-xs text-[var(--ui-text-muted)]">
                    Condição
                    <select
                      aria-label={`Condição do gatilho ${index + 1}`}
                      className="ui-input mt-1 min-h-10 w-full text-sm"
                      value={trigger.condition}
                      onChange={event => {
                        const condition = event.target.value as MatchTriggerCondition;
                        updateTrigger(index, {
                          condition,
                          margin: isScoreMarginCondition(condition) ? trigger.margin : undefined,
                        });
                      }}
                    >
                      {CONDITION_OPTIONS.map(condition => <option key={condition} value={condition}>{CONDITION_LABELS[condition]}</option>)}
                    </select>
                  </label>

                  {isScoreMarginCondition(trigger.condition) ? (
                    <label className="min-w-0 text-xs text-[var(--ui-text-muted)]">
                      Diferença
                      <select
                        aria-label={`Diferença do gatilho ${index + 1}`}
                        className="ui-input mt-1 min-h-10 w-full text-sm"
                        value={trigger.margin ?? 1}
                        onChange={event => {
                          const margin = Number(event.target.value);
                          updateTrigger(index, { margin: margin > 1 ? margin : undefined });
                        }}
                      >
                        {MATCH_TRIGGER_GOAL_MARGINS.map(margin => (
                          <option key={margin} value={margin}>
                            {margin === 1 ? 'Qualquer diferença' : `${margin}+ gols`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="min-w-0 text-xs text-[var(--ui-text-muted)]">
                    A partir de
                    {trigger.condition === 'red_card' || trigger.condition === 'opponent_red_card' ? (
                      <span className="mt-1 flex min-h-10 items-center rounded-md border border-[var(--ui-border)] px-3 text-sm text-[var(--ui-text)]">
                        Imediato
                      </span>
                    ) : (
                      <select
                        aria-label={`Momento do gatilho ${index + 1}`}
                        className="ui-input mt-1 min-h-10 w-full text-sm"
                        value={trigger.minute}
                        onChange={event => updateTrigger(index, { minute: Number(event.target.value) })}
                      >
                        {MATCH_TRIGGER_MINUTES.map(minute => <option key={minute} value={minute}>{minute}'</option>)}
                      </select>
                    )}
                  </label>

                  <label className="min-w-0 text-xs text-[var(--ui-text-muted)]">
                    Trocar para
                    <select
                      aria-label={`Ação do gatilho ${index + 1}`}
                      className={cn('ui-input mt-1 min-h-10 w-full text-sm', 'text-[var(--ui-text)]')}
                      value={trigger.action}
                      onChange={event => updateTrigger(index, { action: event.target.value as MatchTriggerAction })}
                    >
                      {ACTION_OPTIONS.map(action => <option key={action} value={action}>{ACTION_LABELS[action]}</option>)}
                    </select>
                  </label>
                </div>

              </div>
            ))}

            {plan.triggers.length < MAX_MATCH_TRIGGERS ? (
              <Button type="button" intent="secondary" className="w-full text-xs" onClick={addTrigger}>
                + Adicionar gatilho
              </Button>
            ) : null}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
