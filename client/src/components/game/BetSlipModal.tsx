// UCL Immortals — bilhete de aposta
// Um único fluxo reúne placar, resultado, gols e ambas marcam.
import { useState, type ReactNode } from 'react';
import {
  Bet,
  BetBuilderSelection,
  BetMarket,
  BET_BUILDER_MAX_SELECTIONS,
  BET_BUILDER_MIN_SELECTIONS,
  BetPayoutRules,
  DEFAULT_BET_PAYOUT_RULES,
  BET_MAX_GOALS,
  BET_TOTAL_CARDS_LINES,
  BET_TOTAL_GOALS_LINES,
  calculateBuilderMultiplier,
  normalizeBuilderSelections,
} from '@shared/game/bets';
import { Button, GameModal } from '../../design-system';
import { Check, CircleAlert, Target, Trash2, X } from 'lucide-react';
import { INLINE_ICON } from './inlineIcon';
import { cn } from '../../lib/utils';

function Stepper({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number }) {
  return (
    <div className="min-w-0 text-center">
      <span className="block truncate text-xs font-bold text-[var(--ui-text-soft)] sm:text-sm" title={label}>{label}</span>
      <div className="mt-2 flex items-center justify-center gap-0.5 sm:gap-2">
        <button type="button" onClick={() => set(Math.max(0, value - 1))} className="ui-icon-btn" aria-label={`Diminuir gols de ${label}`}>−</button>
        <output aria-label={`${label}: ${value} gols`} className="w-5 text-center font-display text-2xl font-black tabular-nums text-[var(--ui-text)] sm:w-8">{value}</output>
        <button type="button" onClick={() => set(Math.min(max, value + 1))} className="ui-icon-btn" aria-label={`Aumentar gols de ${label}`}>+</button>
      </div>
    </div>
  );
}

export type BetSlipSubmission = {
  market: BetMarket;
  homeGoals: number;
  awayGoals: number;
  stake: number;
  selections?: BetBuilderSelection[];
};

function sameSelection(a: BetBuilderSelection, b: BetBuilderSelection): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'exact_score' && b.type === 'exact_score') return a.homeGoals === b.homeGoals && a.awayGoals === b.awayGoals;
  if (a.type === 'outcome' && b.type === 'outcome') return a.value === b.value;
  if (a.type === 'total_goals' && b.type === 'total_goals') return a.operator === b.operator && a.line === b.line;
  if (a.type === 'total_cards' && b.type === 'total_cards') return a.operator === b.operator && a.line === b.line;
  return a.type === 'both_score' && b.type === 'both_score' && a.value === b.value;
}

function formatGoalLine(line: number): string {
  return line.toString().replace('.', ',');
}

function selectionLabel(selection: BetBuilderSelection): string {
  if (selection.type === 'exact_score') return `Placar ${selection.homeGoals}-${selection.awayGoals}`;
  if (selection.type === 'outcome') return selection.value === 'home' ? 'Casa vence' : selection.value === 'away' ? 'Fora vence' : 'Empate';
  if (selection.type === 'total_goals') return `${selection.operator === 'over' ? 'Mais de' : 'Menos de'} ${formatGoalLine(selection.line)} gols`;
  if (selection.type === 'total_cards') return `${selection.operator === 'over' ? 'Mais de' : 'Menos de'} ${formatGoalLine(selection.line)} cartões`;
  return selection.value ? 'Ambas marcam: sim' : 'Ambas marcam: não';
}

function Choice({ label, active, onClick, disabled = false }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} disabled={disabled}
      className="min-h-11 w-full rounded-lg border px-2 py-2 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        fontFamily: 'var(--font-game), sans-serif',
        borderColor: active ? 'var(--ui-brand-line)' : 'var(--ui-line-subtle)',
        background: active ? 'var(--ui-brand-soft)' : 'var(--ui-surface-1)',
        color: active ? 'var(--ui-brand-strong)' : 'var(--ui-text-muted)',
      }}>
      {label}
    </button>
  );
}

function MarketCard({ title, description, active = false, className, children }: {
  title: string;
  description?: string;
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn('rounded-xl border p-3 sm:p-3.5', className)}
      style={{
        borderColor: active ? 'var(--ui-brand-line)' : 'var(--ui-line-subtle)',
        background: active ? 'linear-gradient(145deg, var(--ui-brand-soft), var(--ui-surface-1) 72%)' : 'var(--ui-surface-1)',
      }}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-black leading-tight text-[var(--ui-text)]">{title}</h4>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-[var(--ui-text-muted)]">{description}</p>}
        </div>
        {active && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--ui-brand-line)] bg-[var(--ui-brand-soft)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--ui-brand-strong)]">
            <Check size={12} aria-hidden="true" />No bilhete
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export default function BetSlipModal({ homeName, awayName, existing, remainingCap, points, payoutRules, onConfirm, onCancelBet, onClose }: {
  homeName: string;
  awayName: string;
  existing?: Bet;
  remainingCap: number;
  points: number;
  payoutRules?: BetPayoutRules;
  onConfirm: (submission: BetSlipSubmission) => void;
  onCancelBet?: () => void;
  onClose: () => void;
}) {
  const effectivePayoutRules = payoutRules ?? existing?.payoutRules ?? DEFAULT_BET_PAYOUT_RULES;
  const initialSelections = existing?.market === 'builder'
    ? (normalizeBuilderSelections(existing.selections) ?? [])
    : existing
      ? [{ type: 'exact_score' as const, homeGoals: existing.homeGoals, awayGoals: existing.awayGoals }]
      : [];
  const initialExact = initialSelections.find((selection): selection is Extract<BetBuilderSelection, { type: 'exact_score' }> => selection.type === 'exact_score');
  const [homeGoals, setHomeGoals] = useState(initialExact?.homeGoals ?? 1);
  const [awayGoals, setAwayGoals] = useState(initialExact?.awayGoals ?? 0);
  const [selections, setSelections] = useState<BetBuilderSelection[]>(initialSelections);
  // Editing keeps the current stake in escrow, so it must count as available
  // funds while changing this ticket. placeBet charges only the difference.
  const availablePoints = Math.max(0, points + (existing?.stake ?? 0));
  const maxStake = Math.max(0, Math.min(remainingCap, availablePoints));
  const [stake, setStake] = useState(Math.min(existing?.stake ?? Math.min(50, maxStake), maxStake));
  const exactSelection = selections.find((selection): selection is Extract<BetBuilderSelection, { type: 'exact_score' }> => selection.type === 'exact_score');
  const exactOnly = selections.length === 1 && !!exactSelection;
  const totalGoalsSelection = selections.find((selection): selection is Extract<BetBuilderSelection, { type: 'total_goals' }> => selection.type === 'total_goals');
  const totalCardsSelection = selections.find((selection): selection is Extract<BetBuilderSelection, { type: 'total_cards' }> => selection.type === 'total_cards');
  const builderMultiplier = calculateBuilderMultiplier(selections, effectivePayoutRules.builderMaxMultiplier, effectivePayoutRules);
  const stakeOk = stake > 0 && stake <= maxStake && selections.length >= BET_BUILDER_MIN_SELECTIONS && builderMultiplier != null;
  const canAddMarket = (type: BetBuilderSelection['type']) => selections.some(selection => selection.type === type) || selections.length < BET_BUILDER_MAX_SELECTIONS;
  const previewMultiplier = exactOnly
    ? effectivePayoutRules.exactMultiplier + (effectivePayoutRules.finalMultiplierBonus ?? 0)
    : builderMultiplier;
  const potentialReturn = previewMultiplier == null ? null : Math.round(stake * previewMultiplier);

  const choose = (selection: BetBuilderSelection) => {
    setSelections(previous => {
      const same = previous.some(current => sameSelection(current, selection));
      const withoutMarket = previous.filter(current => current.type !== selection.type);
      if (same) return withoutMarket;
      // Trocar uma opção do mesmo mercado não aumenta a quantidade de
      // condições; a substituição continua permitida mesmo no limite.
      if (previous.length >= BET_BUILDER_MAX_SELECTIONS && withoutMarket.length === previous.length) return previous;
      return [...withoutMarket, selection];
    });
  };

  const updateExactScore = (side: 'home' | 'away', value: number) => {
    if (side === 'home') setHomeGoals(value);
    else setAwayGoals(value);
    setSelections(previous => previous.map(selection => selection.type === 'exact_score'
      ? { ...selection, homeGoals: side === 'home' ? value : selection.homeGoals, awayGoals: side === 'away' ? value : selection.awayGoals }
      : selection));
  };

  const toggleExactScore = () => {
    if (exactSelection) {
      setSelections(previous => previous.filter(selection => selection.type !== 'exact_score'));
    } else if (selections.length < BET_BUILDER_MAX_SELECTIONS) {
      setSelections(previous => [...previous, { type: 'exact_score', homeGoals, awayGoals }]);
    }
  };

  const updateTotalGoals = (value: string) => {
    if (!value) {
      setSelections(previous => previous.filter(selection => selection.type !== 'total_goals'));
      return;
    }
    const [operator, rawLine] = value.split(':');
    const line = Number(rawLine);
    if ((operator !== 'over' && operator !== 'under') || !BET_TOTAL_GOALS_LINES.includes(line as typeof BET_TOTAL_GOALS_LINES[number])) return;
    choose({ type: 'total_goals', operator, line: line as typeof BET_TOTAL_GOALS_LINES[number] });
  };

  const updateTotalCards = (value: string) => {
    if (!value) {
      setSelections(previous => previous.filter(selection => selection.type !== 'total_cards'));
      return;
    }
    const [operator, rawLine] = value.split(':');
    const line = Number(rawLine);
    if ((operator !== 'over' && operator !== 'under') || !BET_TOTAL_CARDS_LINES.includes(line as typeof BET_TOTAL_CARDS_LINES[number])) return;
    choose({ type: 'total_cards', operator, line: line as typeof BET_TOTAL_CARDS_LINES[number] });
  };

  return (
    <GameModal
      open
      onOpenChange={next => { if (!next) onClose(); }}
      size="wide"
      title={<><Target {...INLINE_ICON} />Bilhete de aposta</>}
      subtitle="Escolha de 1 a 4 palpites. Todos precisam acontecer para ganhar."
      className="max-w-3xl max-h-[92dvh]"
      bodyClassName="ui-stack"
      footer={(
        <div className="grid w-full grid-cols-2 gap-2 pb-2 sm:flex sm:items-center sm:pb-3">
          <Button intent="secondary" size="large" className="w-full sm:w-auto" onClick={onClose}>
            Voltar
          </Button>
          <Button intent="primary" size="large" className="w-full sm:min-w-[190px]" disabled={!stakeOk} onClick={() => {
            if (!stakeOk) return;
            onConfirm({
              market: 'builder',
              homeGoals: exactSelection?.homeGoals ?? 0,
              awayGoals: exactSelection?.awayGoals ?? 0,
              stake,
              selections,
            });
          }}>
            {existing ? 'SALVAR APOSTA' : 'CONFIRMAR APOSTA'}
          </Button>
          {existing && onCancelBet && (
            <Button intent="danger" size="large" className="col-span-2 w-full sm:order-first sm:mr-auto sm:w-auto" onClick={onCancelBet}>
              <Trash2 size={16} aria-hidden="true" />Cancelar aposta
            </Button>
          )}
        </div>
      )}
    >
      <section className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-muted)] p-3 sm:p-4" aria-label="Partida da aposta">
        <div className="mb-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ui-text-faint)]">Partida</div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 text-center">
          <div className="flex min-w-0 flex-col justify-center rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-2 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)]">Mandante</div>
            <div title={homeName} className="mt-1 line-clamp-2 break-words text-sm font-black leading-tight text-[var(--ui-text)]">{homeName}</div>
          </div>
          <span aria-hidden="true" className="my-auto grid h-8 w-8 place-items-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] font-display text-sm font-black text-[var(--ui-brand-strong)]">×</span>
          <div className="flex min-w-0 flex-col justify-center rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-2 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)]">Visitante</div>
            <div title={awayName} className="mt-1 line-clamp-2 break-words text-sm font-black leading-tight text-[var(--ui-text)]">{awayName}</div>
          </div>
        </div>
      </section>

      <section aria-labelledby="bet-markets-title">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 id="bet-markets-title" className="text-sm font-black text-[var(--ui-text)]">Escolha seus palpites</h3>
            <p className="mt-0.5 text-xs text-[var(--ui-text-muted)]">Combine mercados ou escolha apenas um.</p>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--ui-text-soft)]">
            {selections.length}/{BET_BUILDER_MAX_SELECTIONS}
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <MarketCard title="Placar exato" description="Acerte o placar final da partida." active={!!exactSelection} className="p-2 sm:col-span-2 sm:p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-muted)] px-1.5 py-3 sm:gap-3 sm:px-3">
              <Stepper label={homeName} value={homeGoals} set={value => updateExactScore('home', value)} max={BET_MAX_GOALS} />
              <span aria-hidden="true" className="mt-8 grid h-6 w-6 place-items-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] font-display text-xs font-black text-[var(--ui-text-faint)] sm:h-7 sm:w-7 sm:text-sm">×</span>
              <Stepper label={awayName} value={awayGoals} set={value => updateExactScore('away', value)} max={BET_MAX_GOALS} />
            </div>
            <button
              type="button"
              aria-pressed={!!exactSelection}
              onClick={toggleExactScore}
              disabled={!exactSelection && selections.length >= BET_BUILDER_MAX_SELECTIONS}
              className="mt-2.5 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: exactSelection ? 'var(--ui-brand-line)' : 'var(--ui-line-subtle)',
                background: exactSelection ? 'var(--ui-brand-soft)' : 'var(--ui-surface-1)',
                color: exactSelection ? 'var(--ui-brand-strong)' : 'var(--ui-text-muted)',
              }}
            >
              {exactSelection ? <><Check size={15} aria-hidden="true" />Remover do bilhete</> : 'Adicionar placar ao bilhete'}
            </button>
          </MarketCard>

          <MarketCard title="Resultado" description="Quem vence a partida?" active={selections.some(selection => selection.type === 'outcome')}>
            <div className="grid grid-cols-3 gap-1.5">
              <Choice label="Casa" active={selections.some(selection => sameSelection(selection, { type: 'outcome', value: 'home' }))} disabled={!canAddMarket('outcome')} onClick={() => choose({ type: 'outcome', value: 'home' })} />
              <Choice label="Empate" active={selections.some(selection => sameSelection(selection, { type: 'outcome', value: 'draw' }))} disabled={!canAddMarket('outcome')} onClick={() => choose({ type: 'outcome', value: 'draw' })} />
              <Choice label="Fora" active={selections.some(selection => sameSelection(selection, { type: 'outcome', value: 'away' }))} disabled={!canAddMarket('outcome')} onClick={() => choose({ type: 'outcome', value: 'away' })} />
            </div>
          </MarketCard>

          <MarketCard title="Total de gols" description="Gols marcados pelas duas equipes." active={!!totalGoalsSelection}>
            <select
              aria-label="Total de gols"
              value={totalGoalsSelection ? `${totalGoalsSelection.operator}:${totalGoalsSelection.line}` : ''}
              onChange={event => updateTotalGoals(event.target.value)}
              disabled={!canAddMarket('total_goals')}
              className="ui-input min-h-11 w-full cursor-pointer text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontFamily: 'var(--font-game), sans-serif' }}
            >
              <option value="">Escolha uma linha</option>
              <optgroup label="Mais de">
                {BET_TOTAL_GOALS_LINES.map(line => <option key={`over-${line}`} value={`over:${line}`}>Mais de {formatGoalLine(line)} gols</option>)}
              </optgroup>
              <optgroup label="Menos de">
                {BET_TOTAL_GOALS_LINES.map(line => <option key={`under-${line}`} value={`under:${line}`}>Menos de {formatGoalLine(line)} gols</option>)}
              </optgroup>
            </select>
          </MarketCard>

          <MarketCard title="Total de cartões" description="Amarelos e vermelhos da partida." active={!!totalCardsSelection}>
            <select
              aria-label="Total de cartões"
              value={totalCardsSelection ? `${totalCardsSelection.operator}:${totalCardsSelection.line}` : ''}
              onChange={event => updateTotalCards(event.target.value)}
              disabled={!canAddMarket('total_cards')}
              className="ui-input min-h-11 w-full cursor-pointer text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontFamily: 'var(--font-game), sans-serif' }}
            >
              <option value="">Escolha uma linha</option>
              <optgroup label="Mais de">
                {BET_TOTAL_CARDS_LINES.map(line => <option key={`over-cards-${line}`} value={`over:${line}`}>Mais de {formatGoalLine(line)} cartões</option>)}
              </optgroup>
              <optgroup label="Menos de">
                {BET_TOTAL_CARDS_LINES.map(line => <option key={`under-cards-${line}`} value={`under:${line}`}>Menos de {formatGoalLine(line)} cartões</option>)}
              </optgroup>
            </select>
          </MarketCard>

          <MarketCard title="Ambas marcam" description="As duas equipes fazem pelo menos um gol?" active={selections.some(selection => selection.type === 'both_score')}>
            <div className="grid grid-cols-2 gap-2">
              <Choice label="Sim" active={selections.some(selection => sameSelection(selection, { type: 'both_score', value: true }))} disabled={!canAddMarket('both_score')} onClick={() => choose({ type: 'both_score', value: true })} />
              <Choice label="Não" active={selections.some(selection => sameSelection(selection, { type: 'both_score', value: false }))} disabled={!canAddMarket('both_score')} onClick={() => choose({ type: 'both_score', value: false })} />
            </div>
          </MarketCard>
        </div>
        {selections.length >= BET_BUILDER_MAX_SELECTIONS && (
          <p className="mt-2 text-xs text-[var(--ui-text-faint)]" role="status">Limite de palpites atingido. Remova um para escolher outro.</p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-muted)] p-3 sm:p-4" aria-labelledby="bet-ticket-title">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="bet-ticket-title" className="text-sm font-black text-[var(--ui-text)]">Seu bilhete</h3>
          <span className="text-xs font-semibold text-[var(--ui-text-faint)]">{selections.length === 1 ? '1 palpite' : `${selections.length} palpites`}</span>
        </div>

        {selections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--ui-line-subtle)] px-3 py-3 text-center text-sm text-[var(--ui-text-muted)]">
            Selecione ao menos um palpite para continuar.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {selections.map(selection => (
              <li key={selection.type}>
                <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--ui-brand-line)] bg-[var(--ui-brand-soft)] py-1 pl-2.5 pr-1 text-xs font-bold text-[var(--ui-brand-strong)]">
                  <span className="break-words">{selectionLabel(selection)}</span>
                  <button
                    type="button"
                    onClick={() => choose(selection)}
                    aria-label={`Remover ${selectionLabel(selection)} do bilhete`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-black/10"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {selections.length > 0 && builderMultiplier == null && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--ui-danger)]/30 bg-[var(--ui-danger)]/10 p-2.5 text-sm font-semibold text-[var(--ui-danger)]" role="alert">
            <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Esses palpites não podem acontecer juntos. Remova um para ajustar o bilhete.</span>
          </div>
        )}

        {builderMultiplier != null && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ui-success)]/30 bg-[var(--ui-success)]/10 p-3 sm:p-4" aria-label="Retorno potencial da aposta" aria-live="polite">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Retorno potencial</div>
              <div className="mt-0.5 flex items-baseline gap-1.5 text-[var(--ui-success)]">
                <span className="font-display text-2xl font-black leading-none tabular-nums sm:text-3xl">{potentialReturn?.toLocaleString('pt-BR') ?? '—'}</span>
                <span className="text-xs font-bold">pts</span>
              </div>
              <p className="mt-1 text-[11px] leading-tight text-[var(--ui-text-muted)]">Se acertar todos os palpites</p>
            </div>
            <div className="shrink-0 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)]">Multiplicador</div>
              <div className="mt-0.5 font-display text-base font-black tabular-nums text-[var(--ui-text)]">{previewMultiplier?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-muted)] p-3 sm:p-4" aria-labelledby="bet-stake-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="bet-stake-title" className="text-sm font-black text-[var(--ui-text)]">Valor da aposta</h3>
          <span className="text-xs text-[var(--ui-text-faint)]">Em pontos</span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)]">{existing ? 'Saldo + aposta atual' : 'Seu saldo'}</div>
            <div className="mt-0.5 font-display text-base font-black tabular-nums text-[var(--ui-text)]">{availablePoints} pts</div>
          </div>
          <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)]">{existing ? 'Limite desta aposta' : 'Limite restante'}</div>
            <div className="mt-0.5 font-display text-base font-black tabular-nums text-[var(--ui-text)]">{remainingCap} pts</div>
          </div>
        </div>
        <label htmlFor="bet-stake" className="mb-1.5 block text-xs font-bold text-[var(--ui-text-soft)]">Quanto quer apostar?</label>
        <div className="relative">
          <input
            id="bet-stake"
            type="number"
            min={1}
            max={maxStake}
            value={stake}
            disabled={maxStake < 1}
            onChange={event => setStake(Math.max(0, Math.min(maxStake, Math.floor(Number(event.target.value) || 0))))}
            className={cn('ui-input min-h-12 pr-14 text-lg font-display font-black tabular-nums', stake < 1 && maxStake > 0 && 'border-[var(--ui-danger)]')}
            aria-describedby="bet-stake-help"
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-[var(--ui-text-faint)]">pts</span>
        </div>
        <p id="bet-stake-help" className="mt-1.5 text-xs leading-relaxed text-[var(--ui-text-muted)]">
          {maxStake > 0
            ? existing
              ? `Máximo: ${maxStake} pontos, incluindo os ${existing.stake} pts já apostados.`
              : `Máximo disponível para esta aposta: ${maxStake} pontos.`
            : points < 1
              ? existing
                ? 'Não há saldo disponível para aumentar esta aposta.'
                : 'Você está sem pontos para apostar.'
              : 'O limite de apostas desta rodada foi atingido.'}
        </p>
      </section>
    </GameModal>
  );
}
