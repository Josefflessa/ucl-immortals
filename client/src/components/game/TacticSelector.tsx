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
    <div className="ui-panel p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
          TÁTICA DO TIME
        </span>
        <span className="text-xs font-bold" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>
          MENTALIDADE
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-pretty" style={{ color: '#A7A7B8', fontFamily: 'Rajdhani, sans-serif' }}>
        A tática define a postura coletiva e ajusta os atributos durante a partida.
        Escolha pelo equilíbrio entre <b style={{ color: '#FFF' }}>volume, perigo e proteção</b>.
      </p>

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
              className="px-3 py-3"
              style={{
                opacity: disabled && !isActive ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{tactic.icon}</span>
                <span
                  className="text-base font-black leading-tight text-balance"
                  style={{ color: isActive ? '#C9A84C' : '#FFF' }}
                >
                  {tactic.name}
                </span>
              </div>
            </ChoiceCard>
          );
        })}
      </div>

      <div className="ui-panel ui-panel--inset mt-3 px-3 py-3 text-sm">
        <div className="mb-1.5">
          <span className="text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
            {active.icon} {active.name}
          </span>
        </div>
        <div className="leading-relaxed" style={{ color: '#A7A7B8' }}>{active.desc}</div>
        <div className="mt-2 leading-relaxed" style={{ color: '#22C55E' }}>
          ✓ Bônus de atributos: <b>{formatTacticBuffs(active.id)}</b>
        </div>
        <div className="mt-1 text-xs leading-relaxed" style={{ color: discipline.color }}>
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
