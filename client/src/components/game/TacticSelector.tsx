// UCL Immortals — Tactic / play-style selector
// Lets the manager pick the team mentality. The chosen id feeds team.playStyle,
// which the simulation engine reads to apply attribute bonuses and shape the
// match narrative. Shared by squad-review (initial pick) and the "MEU TIME" tab
// (between-match changes).

import { TACTICS, getTacticById } from '../../lib/gameData';
import { tacticProfile } from '../../lib/gameEngine';
import ImpactMeter from './ImpactMeter';
import { ChoiceCard } from '../../design-system';

interface TacticSelectorProps {
  value: string | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}

export default function TacticSelector({ value, onChange, disabled, disabledHint }: TacticSelectorProps) {
  const active = getTacticById(value);

  return (
    <div className="ui-panel p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
          TÁTICA DO TIME
        </span>
        <span className="text-[10px] font-bold" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          MENTALIDADE
        </span>
      </div>

      <p className="text-[11px] mb-3" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
        🧠 A tática reforça atributos dos seus jogadores durante as partidas e muda o jeito do time jogar.
        Escolha de acordo com a força do seu elenco.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TACTICS.map((t) => {
          const isActive = active.id === t.id;
          return (
            <ChoiceCard
              key={t.id}
              selected={isActive}
              onClick={() => !disabled && onChange(t.id)}
              disabled={disabled}
              title={disabled ? disabledHint : t.desc}
              className="px-3 py-2.5"
              style={{
                opacity: disabled && !isActive ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">{t.icon}</span>
                <span className="text-xs font-black truncate" style={{ color: isActive ? '#C9A84C' : '#FFF' }}>
                  {t.name}
                </span>
              </div>
              <div className="text-[10px] font-bold mt-1" style={{ color: isActive ? '#E8C84A' : '#6A6A7A' }}>
                {t.short}
              </div>
            </ChoiceCard>
          );
        })}
      </div>

      {/* Impacto qualitativo (setas) — prévia de o que a tática favorece / custa */}
      <div className="mt-3">
        <ImpactMeter profile={tacticProfile(active.id)} />
      </div>

      {/* Active tactic explanation */}
      <div className="ui-panel ui-panel--inset mt-2 px-3 py-2 text-[11px] text-[var(--ui-text-muted)]">
        <span className="font-black" style={{ color: '#C9A84C' }}>{active.icon} {active.name}:</span>{' '}
        {active.desc}
      </div>

      {disabled && disabledHint && (
        <p className="mt-2 text-[10px] font-bold" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          {disabledHint}
        </p>
      )}
    </div>
  );
}
