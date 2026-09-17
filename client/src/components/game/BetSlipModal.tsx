// UCL Immortals — bilhete de aposta
// Um único fluxo reúne placar, resultado, gols e ambas marcam.
import { useState } from 'react';
import {
  Bet,
  BetBuilderSelection,
  BetMarket,
  BET_BUILDER_MAX_SELECTIONS,
  BET_BUILDER_MIN_SELECTIONS,
  BET_EXACT_MULT,
  BET_MAX_GOALS,
  BET_TOTAL_GOALS_LINES,
  calculateBuilderMultiplier,
  normalizeBuilderSelections,
} from '../../lib/bets';
import { Button } from '../../design-system';

function Stepper({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-[110px] truncate text-[10px] font-black tracking-widest text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => set(Math.max(0, value - 1))} className="ui-icon-btn" aria-label={`Diminuir ${label}`}>−</button>
        <span className="w-8 text-center text-2xl font-black tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{value}</span>
        <button type="button" onClick={() => set(Math.min(max, value + 1))} className="ui-icon-btn" aria-label={`Aumentar ${label}`}>+</button>
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
  return a.type === 'both_score' && b.type === 'both_score' && a.value === b.value;
}

function formatGoalLine(line: number): string {
  return line.toString().replace('.', ',');
}

function selectionLabel(selection: BetBuilderSelection, homeName: string, awayName: string): string {
  if (selection.type === 'exact_score') return `Placar ${selection.homeGoals}-${selection.awayGoals}`;
  if (selection.type === 'outcome') return selection.value === 'home' ? 'Casa vence' : selection.value === 'away' ? 'Fora vence' : 'Empate';
  if (selection.type === 'total_goals') return `${selection.operator === 'over' ? 'Mais de' : 'Menos de'} ${formatGoalLine(selection.line)} gols`;
  return selection.value ? 'Ambas marcam: sim' : 'Ambas marcam: não';
}

function Choice({ label, active, onClick, disabled = false }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} disabled={disabled}
      className="rounded-lg border px-2.5 py-2 text-[11px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        fontFamily: 'Rajdhani, sans-serif',
        borderColor: active ? '#C9A84C' : '#252538',
        background: active ? '#C9A84C22' : '#0F0F1A',
        color: active ? '#E8C84A' : '#9A9AAA',
      }}>
      {label}
    </button>
  );
}

export default function BetSlipModal({ homeName, awayName, existing, remainingCap, points, onConfirm, onCancelBet, onClose }: {
  homeName: string;
  awayName: string;
  existing?: Bet;
  remainingCap: number;
  points: number;
  onConfirm: (submission: BetSlipSubmission) => void;
  onCancelBet?: () => void;
  onClose: () => void;
}) {
  const initialSelections = existing?.market === 'builder'
    ? (normalizeBuilderSelections(existing.selections) ?? [])
    : existing
      ? [{ type: 'exact_score' as const, homeGoals: existing.homeGoals, awayGoals: existing.awayGoals }]
      : [];
  const initialExact = initialSelections.find((selection): selection is Extract<BetBuilderSelection, { type: 'exact_score' }> => selection.type === 'exact_score');
  const [homeGoals, setHomeGoals] = useState(initialExact?.homeGoals ?? 1);
  const [awayGoals, setAwayGoals] = useState(initialExact?.awayGoals ?? 0);
  const [selections, setSelections] = useState<BetBuilderSelection[]>(initialSelections);
  const maxStake = Math.max(0, Math.min(remainingCap, points));
  const [stake, setStake] = useState(Math.min(existing?.stake ?? Math.min(50, maxStake), maxStake));
  const exactSelection = selections.find((selection): selection is Extract<BetBuilderSelection, { type: 'exact_score' }> => selection.type === 'exact_score');
  const exactOnly = selections.length === 1 && !!exactSelection;
  const totalGoalsSelection = selections.find((selection): selection is Extract<BetBuilderSelection, { type: 'total_goals' }> => selection.type === 'total_goals');
  const builderMultiplier = calculateBuilderMultiplier(selections);
  const stakeOk = stake > 0 && stake <= maxStake && selections.length >= BET_BUILDER_MIN_SELECTIONS && builderMultiplier != null;
  const canAddMarket = (type: BetBuilderSelection['type']) => selections.some(selection => selection.type === type) || selections.length < BET_BUILDER_MAX_SELECTIONS;

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

  return (
    <div className="ui-modal-backdrop" onClick={onClose}>
      <div onClick={event => event.stopPropagation()} className="ui-modal ui-modal--wide max-w-2xl flex max-h-[92dvh] flex-col">
        <div className="ui-modal__header">
          <div className="min-w-0">
            <h2 className="ui-modal__title">🎯 Bilhete de aposta</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">
              Marque uma ou mais condições no mesmo bilhete. Todas as condições marcadas precisam acontecer.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="ui-icon-btn">✕</button>
        </div>

        <div className="ui-modal__body ui-stack min-h-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center text-[10px] font-bold tracking-widest leading-tight text-[var(--ui-text-faint)]">
            <span>MANDANTE</span><span className="text-[var(--ui-text-muted)]">{homeName}</span>
            <span className="mx-2 text-[var(--ui-brand-strong)]">×</span>
            <span>VISITANTE</span><span className="text-[var(--ui-text-muted)]">{awayName}</span>
          </div>

          <section className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3" aria-labelledby="bet-markets-title">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="bet-markets-title" className="text-[11px] font-black tracking-widest text-[var(--ui-text)]">MERCADOS DO BILHETE</h3>
              <span className="text-[10px] font-bold text-[var(--ui-text-faint)]">{selections.length}/{BET_BUILDER_MAX_SELECTIONS} condições</span>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black tracking-widest text-[var(--ui-text-faint)]">PLACAR EXATO</div>
                    <div className="mt-0.5 text-[11px] text-[var(--ui-text-muted)]">Só entra no bilhete se você ativar.</div>
                  </div>
                  <button type="button" aria-pressed={!!exactSelection} onClick={toggleExactScore}
                    disabled={!exactSelection && selections.length >= BET_BUILDER_MAX_SELECTIONS}
                    className="rounded-md border px-2.5 py-1.5 text-[10px] font-black tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderColor: exactSelection ? '#C9A84C' : '#252538', background: exactSelection ? '#C9A84C22' : '#0F0F1A', color: exactSelection ? '#E8C84A' : '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                    {exactSelection ? 'INCLUÍDO' : 'ADICIONAR'}
                  </button>
                </div>
                <div className={`flex items-center justify-center gap-3 ${exactSelection ? '' : 'opacity-45'}`}>
                  <Stepper label={homeName} value={homeGoals} set={value => updateExactScore('home', value)} max={BET_MAX_GOALS} />
                  <span className="text-xl font-black text-gray-600">×</span>
                  <Stepper label={awayName} value={awayGoals} set={value => updateExactScore('away', value)} max={BET_MAX_GOALS} />
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-black tracking-widest text-[var(--ui-text-faint)]">RESULTADO</div>
                <div className="grid grid-cols-3 gap-2">
                  <Choice label="Casa vence" active={selections.some(selection => sameSelection(selection, { type: 'outcome', value: 'home' }))} disabled={!canAddMarket('outcome')} onClick={() => choose({ type: 'outcome', value: 'home' })} />
                  <Choice label="Empate" active={selections.some(selection => sameSelection(selection, { type: 'outcome', value: 'draw' }))} disabled={!canAddMarket('outcome')} onClick={() => choose({ type: 'outcome', value: 'draw' })} />
                  <Choice label="Fora vence" active={selections.some(selection => sameSelection(selection, { type: 'outcome', value: 'away' }))} disabled={!canAddMarket('outcome')} onClick={() => choose({ type: 'outcome', value: 'away' })} />
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-black tracking-widest text-[var(--ui-text-faint)]">TOTAL DE GOLS</div>
                <select value={totalGoalsSelection ? `${totalGoalsSelection.operator}:${totalGoalsSelection.line}` : ''}
                  onChange={event => updateTotalGoals(event.target.value)} disabled={!canAddMarket('total_goals')}
                  className="ui-input w-full cursor-pointer text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  <option value="">Não selecionar</option>
                  <optgroup label="Mais de">
                    {BET_TOTAL_GOALS_LINES.map(line => <option key={`over-${line}`} value={`over:${line}`}>Mais de {formatGoalLine(line)} gols</option>)}
                  </optgroup>
                  <optgroup label="Menos de">
                    {BET_TOTAL_GOALS_LINES.map(line => <option key={`under-${line}`} value={`under:${line}`}>Menos de {formatGoalLine(line)} gols</option>)}
                  </optgroup>
                </select>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-black tracking-widest text-[var(--ui-text-faint)]">AMBAS MARCAM</div>
                <div className="grid grid-cols-2 gap-2">
                  <Choice label="Sim" active={selections.some(selection => sameSelection(selection, { type: 'both_score', value: true }))} disabled={!canAddMarket('both_score')} onClick={() => choose({ type: 'both_score', value: true })} />
                  <Choice label="Não" active={selections.some(selection => sameSelection(selection, { type: 'both_score', value: false }))} disabled={!canAddMarket('both_score')} onClick={() => choose({ type: 'both_score', value: false })} />
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black tracking-widest text-[var(--ui-text-faint)]">
              <span>SELEÇÕES</span><span>{selections.length === 1 ? '1 condição' : `${selections.length} condições`}</span>
            </div>
            <div className="text-[11px] leading-relaxed text-[var(--ui-text-muted)]">
              {selections.length > 0
                ? selections.map(selection => selectionLabel(selection, homeName, awayName)).join('  +  ')
                : 'Marque pelo menos uma condição acima.'}
            </div>
            {builderMultiplier != null && (
              <div className="mt-2 flex justify-center">
                <span className="inline-flex items-center rounded-full border border-[var(--ui-success)]/35 bg-[var(--ui-success)]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[var(--ui-success)]">
                  Multiplicador: {builderMultiplier.toFixed(2)}×
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-bold tracking-widest text-[var(--ui-text-faint)]">
              <span>VALOR APOSTADO</span><span className="whitespace-nowrap">resta: {remainingCap} · saldo: {points}</span>
            </div>
            <input type="number" min={1} max={maxStake} value={stake}
              onChange={event => setStake(Math.max(0, Math.min(maxStake, Math.floor(Number(event.target.value) || 0))))}
              className={`ui-input text-lg font-display tabular-nums ${!stakeOk ? 'border-[var(--ui-danger)]' : ''}`} />
            <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
              {selections.length === 0
                ? 'Marque uma ou mais condições para ver o retorno.'
                : exactOnly
                  ? <>Retorno: {Math.round(stake * BET_EXACT_MULT)} se o placar for exato</>
                  : builderMultiplier != null
                    ? <>Retorno do bilhete: {Math.round(stake * builderMultiplier)}</>
                    : `Você pode marcar até ${BET_BUILDER_MAX_SELECTIONS} condições.`}
            </div>
          </div>

          <div className="flex gap-2">
            <Button intent="primary" size="large" className="flex-1" disabled={!stakeOk} onClick={() => {
              if (!stakeOk) return;
              onConfirm({
                market: 'builder',
                homeGoals: exactSelection?.homeGoals ?? 0,
                awayGoals: exactSelection?.awayGoals ?? 0,
                stake,
                selections,
              });
            }}>
              {existing ? 'ATUALIZAR BILHETE' : 'CONFIRMAR BILHETE'}
            </Button>
            {existing && onCancelBet && (
              <button type="button" onClick={onCancelBet} aria-label="Cancelar aposta" className="ui-icon-btn h-[52px] min-h-[52px] text-[var(--ui-danger)]">🗑</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
