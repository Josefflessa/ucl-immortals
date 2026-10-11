import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Check, Equal, Plus, SlidersHorizontal, Trash2, TrendingDown, TrendingUp, Workflow } from 'lucide-react';
import { Button, Panel, PanelBody } from '../../design-system';
import { getTacticById } from '@shared/game/gameData';
import {
  MATCH_TRIGGER_ACTIONS,
  MATCH_TRIGGER_GOAL_MARGINS,
  MATCH_TRIGGER_MINUTES,
  MAX_MATCH_TRIGGERS,
  normalizeMatchPlan,
  type MatchPlan,
  type MatchTrigger,
  type MatchTriggerAction,
  type MatchTriggerCondition,
} from '@shared/game/gameEngine';
import TacticIcon from './TacticIcon';
import { CardIcon } from './StatusIcon';

interface MatchPlanSelectorProps {
  value?: MatchPlan;
  onChange: (plan: MatchPlan) => void;
  playStyle: string;
}

const CONDITION_LABELS: Record<MatchTriggerCondition, string> = {
  losing: 'Perdendo',
  draw: 'Empatando (inclui 0–0)',
  winning: 'Vencendo',
  red_card: 'Vermelho (seu time)',
  opponent_red_card: 'Vermelho (adversário)',
};

/** How each condition reads at a glance: an icon and its colour. */
const CONDITION_LOOK: Record<MatchTriggerCondition, { icon: ReactNode; color: string }> = {
  losing: { icon: <TrendingDown size={15} strokeWidth={2.5} />, color: '#F87171' },
  draw: { icon: <Equal size={15} strokeWidth={2.5} />, color: '#94A3B8' },
  winning: { icon: <TrendingUp size={15} strokeWidth={2.5} />, color: '#4ADE80' },
  red_card: { icon: <CardIcon color="red" size={15} />, color: '#F87171' },
  opponent_red_card: { icon: <CardIcon color="red" size={15} />, color: '#FBBF24' },
};

const ACTION_OPTIONS = MATCH_TRIGGER_ACTIONS;
const ACTION_LABELS = Object.fromEntries(
  ACTION_OPTIONS.map(action => [action, getTacticById(action).name]),
) as Record<MatchTriggerAction, string>;
const CONDITION_OPTIONS = Object.keys(CONDITION_LABELS) as MatchTriggerCondition[];

const FONT = { fontFamily: 'var(--font-game), sans-serif' } as const;

function isScoreMarginCondition(condition: MatchTriggerCondition): boolean {
  return condition === 'losing' || condition === 'winning';
}

function isRedCard(condition: MatchTriggerCondition): boolean {
  return condition === 'red_card' || condition === 'opponent_red_card';
}

/** When a trigger fires, in a few words: "Perdendo por 2+ · 65'", "Vermelho do adversário · na hora". */
function whenLabel(trigger: MatchTrigger): string {
  switch (trigger.condition) {
    case 'losing':
    case 'winning': {
      const base = trigger.condition === 'losing' ? 'Perdendo' : 'Vencendo';
      return `${base}${trigger.margin && trigger.margin > 1 ? ` por ${trigger.margin}+` : ''} · ${trigger.minute}'`;
    }
    case 'draw':
      return `Empatando · ${trigger.minute}'`;
    case 'red_card':
      return 'Vermelho do seu time · na hora';
    case 'opponent_red_card':
      return 'Vermelho do adversário · na hora';
  }
}

function TacticName({ tactic, size = 22 }: { tactic: string; size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <TacticIcon tactic={tactic} size={size} />
      <span className="truncate font-bold text-[var(--ui-text)]">{getTacticById(tactic).name}</span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-faint)]" style={FONT}>{label}</span>
      {children}
    </label>
  );
}

const SELECT = 'ui-input min-h-10 w-full text-sm text-[var(--ui-text)]';

export default function MatchPlanSelector({ value, onChange, playStyle }: MatchPlanSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const plan = useMemo(() => normalizeMatchPlan(value), [value]);
  const triggers = plan.triggers;
  const full = triggers.length >= MAX_MATCH_TRIGGERS;

  const updateTriggers = (next: MatchTrigger[]) => {
    onChange(normalizeMatchPlan({ triggers: next }));
  };

  const updateTrigger = (index: number, patch: Partial<MatchTrigger>) => {
    updateTriggers(triggers.map((trigger, triggerIndex) => (
      triggerIndex === index ? { ...trigger, ...patch } : trigger
    )));
  };

  const addTrigger = () => {
    if (full) return;
    let id = `trigger-${triggers.length + 1}`;
    let suffix = 2;
    while (triggers.some(trigger => trigger.id === id)) {
      id = `trigger-${triggers.length + 1}-${suffix}`;
      suffix++;
    }
    updateTriggers([
      ...triggers,
      { id, condition: 'losing', minute: 65, action: 'all_out_attack' },
    ]);
    setIsOpen(true);
  };

  return (
    <Panel density="compact" tone="inset" className="border-[var(--ui-border)]">
      {/* Header: what this is, how many rules, and the edit switch. */}
      <div className="flex items-center gap-3 border-b border-[var(--ui-border)] px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#C9A84C44] bg-[#C9A84C14] text-[var(--ui-brand-strong)]" aria-hidden="true">
          <Workflow size={18} strokeWidth={2.3} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-black uppercase tracking-[0.16em] text-[var(--ui-text)]" style={FONT}>Plano de jogo</h3>
            <span
              className="rounded-full border border-[var(--ui-border)] px-2 py-0.5 text-[11px] font-black tabular-nums text-[var(--ui-text-muted)]"
              style={FONT}
              title={`${triggers.length} de ${MAX_MATCH_TRIGGERS} gatilhos`}
            >
              {triggers.length}/{MAX_MATCH_TRIGGERS}
            </span>
          </div>
          <p className="truncate text-xs text-[var(--ui-text-muted)]">Trocas automáticas de tática</p>
        </div>
        <Button
          type="button"
          intent={isOpen ? 'primary' : 'secondary'}
          size="default"
          className="shrink-0 gap-1.5 text-xs"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(open => !open)}
        >
          {isOpen ? <><Check size={15} strokeWidth={2.6} aria-hidden="true" />Concluir</> : <><SlidersHorizontal size={15} strokeWidth={2.4} aria-hidden="true" />Editar</>}
        </Button>
      </div>

      <PanelBody className="space-y-3">
        {!isOpen && (
          <ol className="relative space-y-2" aria-label="Resumo do plano de jogo">
            {/* The line joining the start to each rule. */}
            {triggers.length > 0 && <span aria-hidden="true" className="absolute bottom-5 left-[17px] top-5 w-px bg-[var(--ui-border)]" />}
            <li className="relative flex items-center gap-3">
              <span className="z-[1] flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-strong)]">
                <TacticIcon tactic={playStyle} size={26} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-brand-strong)]" style={FONT}>Começa com</div>
                <div className="truncate text-sm font-bold text-[var(--ui-text)]">{getTacticById(playStyle).name}</div>
              </div>
            </li>
            {triggers.map(trigger => {
              const look = CONDITION_LOOK[trigger.condition];
              return (
                <li key={trigger.id} className="relative flex items-center gap-3">
                  <span
                    className="z-[1] flex size-9 shrink-0 items-center justify-center rounded-lg border bg-[var(--ui-surface-strong)]"
                    style={{ borderColor: `${look.color}55`, color: look.color }}
                    aria-hidden="true"
                  >
                    {look.icon}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm">
                    <span className="font-bold" style={{ color: look.color }}>{whenLabel(trigger)}</span>
                    <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-[var(--ui-text-faint)]" aria-hidden="true" />
                    <TacticName tactic={trigger.action} size={20} />
                  </div>
                </li>
              );
            })}
            {triggers.length === 0 && (
              <li>
                <button
                  type="button"
                  onClick={addTrigger}
                  className="flex w-full items-center gap-3 rounded-lg border border-dashed border-[var(--ui-border)] px-3 py-3 text-left transition-colors hover:border-[#C9A84C77] hover:bg-[#C9A84C0A]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-surface-strong)] text-[var(--ui-brand-strong)]" aria-hidden="true">
                    <Plus size={18} strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--ui-text)]">Nenhum gatilho ainda</span>
                    <span className="block text-xs text-[var(--ui-text-muted)]">
                      Toque para criar uma troca automática.
                    </span>
                  </span>
                </button>
              </li>
            )}
          </ol>
        )}

        {isOpen && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--ui-text-muted)]">
              Até {MAX_MATCH_TRIGGERS} regras, verificadas em ordem. Cada uma dispara uma vez; as de cartão vermelho valem na hora.
            </p>

            {triggers.map((trigger, index) => {
              const look = CONDITION_LOOK[trigger.condition];
              return (
                <div key={trigger.id} className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                  <div className="flex items-center gap-3 border-b border-[var(--ui-border)] px-3 py-2">
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-[#17120A]"
                      style={{ background: 'var(--ui-brand-strong)', ...FONT }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-[13px]">
                      <span className="font-bold" style={{ color: look.color }}>{whenLabel(trigger)}</span>
                      <ArrowRight size={13} strokeWidth={2.5} className="shrink-0 text-[var(--ui-text-faint)]" aria-hidden="true" />
                      <span className="truncate font-bold text-[var(--ui-text)]">{ACTION_LABELS[trigger.action]}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover gatilho ${index + 1}`}
                      title="Remover"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[#EF444418] hover:text-[var(--ui-danger)]"
                      onClick={() => updateTriggers(triggers.filter((_, triggerIndex) => triggerIndex !== index))}
                    >
                      <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 p-3">
                    <Field label="Quando">
                      <select
                        aria-label={`Condição do gatilho ${index + 1}`}
                        className={SELECT}
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
                    </Field>

                    {isScoreMarginCondition(trigger.condition) && (
                      <Field label="Diferença">
                        <select
                          aria-label={`Diferença do gatilho ${index + 1}`}
                          className={SELECT}
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
                      </Field>
                    )}

                    <Field label="A partir de">
                      {isRedCard(trigger.condition) ? (
                        <span className="flex min-h-10 items-center rounded-md border border-[var(--ui-border)] px-3 text-sm text-[var(--ui-text-muted)]">
                          Na hora do cartão
                        </span>
                      ) : (
                        <select
                          aria-label={`Momento do gatilho ${index + 1}`}
                          className={SELECT}
                          value={trigger.minute}
                          onChange={event => updateTrigger(index, { minute: Number(event.target.value) })}
                        >
                          {MATCH_TRIGGER_MINUTES.map(minute => <option key={minute} value={minute}>{minute}'</option>)}
                        </select>
                      )}
                    </Field>

                    <Field label="Trocar para">
                      <select
                          aria-label={`Ação do gatilho ${index + 1}`}
                          className={SELECT}
                          value={trigger.action}
                          onChange={event => updateTrigger(index, { action: event.target.value as MatchTriggerAction })}
                        >
                          {ACTION_OPTIONS.map(action => <option key={action} value={action}>{ACTION_LABELS[action]}</option>)}
                        </select>
                    </Field>
                  </div>
                </div>
              );
            })}

            {full ? (
              <p className="text-center text-xs text-[var(--ui-text-faint)]">Limite de {MAX_MATCH_TRIGGERS} gatilhos atingido.</p>
            ) : (
              <button
                type="button"
                onClick={addTrigger}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--ui-border)] py-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-brand-strong)] transition-colors hover:border-[#C9A84C77] hover:bg-[#C9A84C0A]"
                style={FONT}
              >
                <Plus size={15} strokeWidth={2.6} aria-hidden="true" />
                Adicionar gatilho
              </button>
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
