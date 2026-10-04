// UCL Immortals — seletor de tática
// Mantém a organização da formação: opções compactas e uma leitura detalhada
// apenas para a tática atualmente selecionada.

import TacticIcon from './TacticIcon';
import { TACTICS, getTacticById } from '@shared/game/gameData';
import { tacticAggression, tacticProfile, tacticStatBonus } from '@shared/game/gameEngine';
import { ChoiceCard } from '../../design-system';
import ImpactMeter from './ImpactMeter';

const ATTRIBUTE_META = [
  { key: 'pace', label: 'Ritmo' },
  { key: 'shooting', label: 'Finalização' },
  { key: 'passing', label: 'Passe' },
  { key: 'vision', label: 'Visão' },
  { key: 'dribbling', label: 'Drible' },
  { key: 'defending', label: 'Defesa' },
  { key: 'physical', label: 'Físico' },
] as const;

function tacticBuffs(playStyle: string, analysisLevel = 1): { label: string; value: number }[] {
  return ATTRIBUTE_META.flatMap(attribute => {
    const value = tacticStatBonus(playStyle, attribute.key, analysisLevel);
    return value === 0 ? [] : [{ label: attribute.label, value }];
  });
}

function formatTacticBuffs(playStyle: string, analysisLevel = 1): string {
  const buffs = tacticBuffs(playStyle, analysisLevel);
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
  analysisLevel?: number;
}

export default function TacticSelector({ value, onChange, analysisLevel = 1 }: TacticSelectorProps) {
  const active = getTacticById(value);
  const discipline = disciplineEffect(active.id);

  return (
    <div className="space-y-3" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
      <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">Mentalidade atual</div>
            <div className="mt-1 flex items-center gap-2 font-display text-xl leading-none tracking-wide text-[var(--ui-brand-strong)]">
              <TacticIcon tactic={active.id} fallback={active.icon} size={30} />{active.name}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs leading-snug text-[var(--ui-text-muted)]">
          A tática ajusta o comportamento coletivo e os atributos durante a partida.
        </p>
      </div>

      <div>
        <div className="mb-1.5 px-0.5 text-[13px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-soft)]">Escolha a mentalidade</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TACTICS.map(tactic => {
          const isActive = active.id === tactic.id;
          return (
            <ChoiceCard
              key={tactic.id}
              selected={isActive}
              onClick={() => onChange(tactic.id)}
              title={tactic.desc}
              className="min-h-[52px] px-2.5 py-2.5"
              >
              <div className="flex items-center gap-2">
                <TacticIcon tactic={tactic.id} fallback={tactic.icon} size={32} />
                <span
                  className="text-sm font-black leading-tight text-balance"
                  style={{ color: isActive ? 'var(--ui-brand)' : '#FFF' }}
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
          <span className="text-[13px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-soft)]">Impacto no jogo</span>
          <span className="inline-flex items-center gap-1.5 font-display text-base tracking-wide text-[var(--ui-brand-strong)]"><TacticIcon tactic={active.id} fallback={active.icon} size={28} /> {active.name}</span>
        </div>
        <div className="text-xs leading-snug text-[var(--ui-text-muted)]">{active.desc}</div>
        <div className="mt-2 rounded-lg border border-[#22C55E33] bg-[#22C55E0D] px-2.5 py-2 text-xs leading-snug text-[#58D37B]">
          <b>Bônus:</b> {formatTacticBuffs(active.id, analysisLevel)}
        </div>
        <div className="mt-2 text-[13px] leading-snug" style={{ color: discipline.color }}>
          <b>Disciplina:</b> {discipline.label.toLowerCase()} · {discipline.detail}.
        </div>
        <div className="mt-2">
          <ImpactMeter profile={tacticProfile(active.id)} />
        </div>
      </div>

    </div>
  );
}
