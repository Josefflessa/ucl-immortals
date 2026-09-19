// UCL Immortals — seletor de tática
// Mantém a organização da formação: opções compactas e uma leitura detalhada
// apenas para a tática atualmente selecionada.

import { TACTICS, getTacticById } from '../../lib/gameData';
import { tacticAggression, tacticProfile, tacticStatBonus } from '../../lib/gameEngine';
import { ChoiceCard } from '../../design-system';
import ImpactMeter from './ImpactMeter';

const ATTRIBUTE_META = [
  { key: 'pace', label: 'Ritmo' },
  { key: 'shooting', label: 'Finalização' },
  { key: 'passing', label: 'Passe' },
  { key: 'dribbling', label: 'Drible' },
  { key: 'defending', label: 'Defesa' },
  { key: 'physical', label: 'Físico' },
] as const;

function tacticBuffs(playStyle: string): { label: string; value: number }[] {
  return ATTRIBUTE_META.flatMap(attribute => {
    const value = tacticStatBonus(playStyle, attribute.key);
    return value === 0 ? [] : [{ label: attribute.label, value }];
  });
}

function formatTacticBuffs(playStyle: string): string {
  const buffs = tacticBuffs(playStyle);
  return buffs.length > 0
    ? buffs.map(buff => `+${buff.value} ${buff.label}`).join(' · ')
    : 'Sem bônus de atributo';
}

function disciplineEffect(playStyle: string): { label: string; detail: string; color: string } {
  const factor = tacticAggression(playStyle);
  if (factor >= 1.2) return { label: 'Risco maior de cartões', detail: 'marcação mais intensa', color: '#F08A5D' };
  if (factor > 1.05) return { label: 'Risco acima da média', detail: 'mais disputas e faltas táticas', color: '#F5B84B' };
  if (factor < 0.9) return { label: 'Risco menor de cartões', detail: 'postura menos agressiva', color: '#7FCF6A' };
  return { label: 'Risco padrão de cartões', detail: 'comportamento normal do motor', color: '#9A9AAF' };
}

interface TacticSelectorProps {
  value: string | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}

export default function TacticSelector({ value, onChange, disabled, disabledHint }: TacticSelectorProps) {
  const active = getTacticById(value);
  const discipline = disciplineEffect(active.id);

  return (
    <div className="space-y-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
      <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">Mentalidade atual</div>
            <div className="mt-0.5 flex items-center gap-1.5 font-display text-xl leading-none tracking-wide text-[var(--ui-brand-strong)]">
              <span aria-hidden="true">{active.icon}</span>{active.name}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs leading-snug text-[var(--ui-text-muted)]">
          A tática ajusta o comportamento coletivo e os atributos durante a partida.
        </p>
      </div>

      <div>
        <div className="mb-1.5 px-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-soft)]">Escolha a mentalidade</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TACTICS.map(tactic => {
          const isActive = active.id === tactic.id;
          return (
            <ChoiceCard
              key={tactic.id}
              selected={isActive}
              onClick={() => !disabled && onChange(tactic.id)}
              disabled={disabled}
              title={disabled ? disabledHint : tactic.desc}
              className="min-h-[52px] px-2.5 py-2.5"
              style={{
                opacity: disabled && !isActive ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{tactic.icon}</span>
                <span
                  className="text-sm font-black leading-tight text-balance"
                  style={{ color: isActive ? '#C9A84C' : '#FFF' }}
                >
                  {tactic.name}
                </span>
              </div>
            </ChoiceCard>
          );
        })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-3 py-3 text-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-soft)]">Impacto no jogo</span>
          <span className="font-display text-base tracking-wide text-[var(--ui-brand-strong)]">{active.icon} {active.name}</span>
        </div>
        <div className="text-xs leading-snug text-[var(--ui-text-muted)]">{active.desc}</div>
        <div className="mt-2 rounded-lg border border-[#22C55E33] bg-[#22C55E0D] px-2.5 py-2 text-xs leading-snug text-[#58D37B]">
          <b>Bônus:</b> {formatTacticBuffs(active.id)}
        </div>
        <div className="mt-2 text-[11px] leading-snug" style={{ color: discipline.color }}>
          <b>Disciplina:</b> {discipline.label.toLowerCase()} · {discipline.detail}.
        </div>
        <div className="mt-2">
          <ImpactMeter profile={tacticProfile(active.id)} />
        </div>
      </div>

      {disabled && disabledHint && (
        <p className="mt-2 text-xs font-bold" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          {disabledHint}
        </p>
      )}
    </div>
  );
}
