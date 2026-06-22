// UCL Immortals — Captain & Penalty-taker selector
// Shared by the squad-review screen (after the draft) and the league "MEU TIME"
// tab (between matches). Lets the manager choose who wears the armband and who
// takes the penalties that occur DURING a match.

import { POS_PT } from '../../lib/gameData';

interface RoleablePlayer {
  id: string;
  shortName: string;
  position: string;
  overall: number;
}

interface RolesSelectorProps {
  players: RoleablePlayer[]; // the 11 starters
  captainId: string | null | undefined;
  penaltyTakerId: string | null | undefined;
  onSetCaptain: (playerId: string) => void;
  onSetPenaltyTaker: (playerId: string) => void;
}

export default function RolesSelector({
  players,
  captainId,
  penaltyTakerId,
  onSetCaptain,
  onSetPenaltyTaker,
}: RolesSelectorProps) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
          FUNÇÕES DE JOGO
        </span>
        <span className="text-[10px] font-bold" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          CAPITÃO · COBRADOR DE PÊNALTI
        </span>
      </div>

      <p className="text-[11px] mb-3" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
        ⚽ O cobrador escolhido bate todos os pênaltis durante as partidas. Por padrão, é o melhor finalizador do time.
      </p>

      <div className="space-y-1.5">
        {players.map((p) => {
          const isCaptain = captainId === p.id;
          const isTaker = penaltyTakerId === p.id;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{
                background: isTaker || isCaptain ? '#14142A' : '#0A0A14',
                border: `1px solid ${isTaker ? '#C9A84C55' : isCaptain ? '#3B82F655' : '#1A1A2A'}`,
              }}
            >
              <span
                className="text-[9px] font-black w-9 text-center rounded px-1 flex-shrink-0"
                style={{ background: '#1c1c2e', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}
              >
                {POS_PT[p.position] ?? p.position}
              </span>
              <span className="text-sm font-bold text-white truncate flex-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {p.shortName}
              </span>
              <span className="text-[9px] font-bold text-gray-500 flex-shrink-0" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                GER {p.overall}
              </span>

              <button
                onClick={() => onSetCaptain(p.id)}
                className="text-[10px] font-black px-2 py-1 rounded transition-all flex-shrink-0"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: isCaptain ? '#3B82F6' : 'transparent',
                  color: isCaptain ? '#FFF' : '#6A6A7A',
                  border: `1px solid ${isCaptain ? '#3B82F6' : '#2A2A3A'}`,
                }}
              >
                🅒 CAP
              </button>
              <button
                onClick={() => onSetPenaltyTaker(p.id)}
                className="text-[10px] font-black px-2 py-1 rounded transition-all flex-shrink-0"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: isTaker ? '#C9A84C' : 'transparent',
                  color: isTaker ? '#080810' : '#6A6A7A',
                  border: `1px solid ${isTaker ? '#C9A84C' : '#2A2A3A'}`,
                }}
              >
                ⚽ PEN
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
