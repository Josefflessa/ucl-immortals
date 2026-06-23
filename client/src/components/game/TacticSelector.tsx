// UCL Immortals — Tactic / play-style selector
// Lets the manager pick the team mentality. The chosen id feeds team.playStyle,
// which the simulation engine reads to apply attribute bonuses and shape the
// match narrative. Shared by squad-review (initial pick) and the "MEU TIME" tab
// (between-match changes).

import { TACTICS, getTacticById } from '../../lib/gameData';

interface TacticSelectorProps {
  value: string | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}

export default function TacticSelector({ value, onChange, disabled, disabledHint }: TacticSelectorProps) {
  const active = getTacticById(value);

  return (
    <div className="rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
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
            <button
              key={t.id}
              onClick={() => !disabled && onChange(t.id)}
              disabled={disabled}
              title={disabled ? disabledHint : t.desc}
              className="text-left rounded-lg px-3 py-2.5 transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                background: isActive ? '#14142A' : '#0A0A14',
                border: `1px solid ${isActive ? '#C9A84C' : '#1A1A2A'}`,
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
            </button>
          );
        })}
      </div>

      {/* Active tactic explanation */}
      <div className="mt-3 rounded-lg px-3 py-2 text-[11px]" style={{ background: '#0A0A14', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
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
