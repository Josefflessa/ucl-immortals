// UCL Immortals — Captain & Penalty-taker selector
// Shared by the squad-review screen (after the draft) and the league "MEU TIME"
// tab (between matches). Lets the manager choose who wears the armband and who
// takes the penalties that occur DURING a match.
//
// The effect numbers below mirror the engine so the UI never lies:
//  - Captain: team-wide strength bonus by rarity (gameEngine.calculateTeamStrength)
//      immortal +3.5 · legendary +2.5 · others +1.5
//  - Penalty taker: shoots first in the shootout and gets +5 composure as the
//      designated taker; success scales with composure + the traits
//      "Especialista em Decisões"/"Frio na Final" (+10 each). (gameEngine.simulatePenalties)

import { POS_PT } from '../../lib/gameData';

interface RoleablePlayer {
  id: string;
  shortName: string;
  position: string;
  overall: number;
  rarity?: string;
  composure?: number;
  traits?: string[];
}

interface RolesSelectorProps {
  players: RoleablePlayer[]; // the 11 starters
  captainId: string | null | undefined;
  penaltyTakerId: string | null | undefined;
  onSetCaptain: (playerId: string) => void;
  onSetPenaltyTaker: (playerId: string) => void;
}

// Team-strength bonus a player grants as captain — same rule as the engine.
function captainBonusFor(rarity: string | undefined): number {
  if (rarity === 'immortal') return 3.5;
  if (rarity === 'legendary') return 2.5;
  return 1.5;
}

// Penalty reliability score used only to RANK candidates for the suggestion.
// Mirrors the composure + trait weighting the engine uses on each kick.
function penaltyScoreFor(p: RoleablePlayer): number {
  return (p.composure ?? 0)
    + (p.traits?.includes('Especialista em Decisões') ? 10 : 0)
    + (p.traits?.includes('Frio na Final') ? 10 : 0);
}

export default function RolesSelector({
  players,
  captainId,
  penaltyTakerId,
  onSetCaptain,
  onSetPenaltyTaker,
}: RolesSelectorProps) {
  // Suggested picks: best captain = highest bonus (tiebreak overall);
  // best taker = highest penalty score (tiebreak overall).
  const suggestedCaptainId = [...players]
    .sort((a, b) => captainBonusFor(b.rarity) - captainBonusFor(a.rarity) || b.overall - a.overall)[0]?.id;
  const suggestedTakerId = [...players]
    .sort((a, b) => penaltyScoreFor(b) - penaltyScoreFor(a) || b.overall - a.overall)[0]?.id;

  const captain = players.find(p => p.id === captainId);
  const taker = players.find(p => p.id === penaltyTakerId);

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

      {/* What each role does */}
      <div className="grid sm:grid-cols-2 gap-2 mb-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: '#0A0A14', border: '1px solid #3B82F633', color: '#9AA8C8' }}>
          <span className="font-black" style={{ color: '#3B82F6' }}>🅒 Capitão</span> — dá bônus de força ao
          time inteiro. Quanto mais raro, maior: <b style={{ color: '#FFF' }}>Imortal +3.5</b> · Lendário +2.5 · demais +1.5.
          <br /><span style={{ color: '#6A6A7A' }}>Dica: escolha seu craque mais raro.</span>
        </div>
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: '#0A0A14', border: '1px solid #C9A84C33', color: '#B8A875' }}>
          <span className="font-black" style={{ color: '#C9A84C' }}>⚽ Cobrador</span> — bate todos os
          pênaltis (na partida e na disputa) e ganha <b style={{ color: '#FFF' }}>+5 de compostura</b>. O sucesso
          depende da compostura e dos traits de frieza.
          <br /><span style={{ color: '#6A6A7A' }}>Dica: escolha quem tem maior compostura.</span>
        </div>
      </div>

      {/* Current selection summary */}
      <div className="flex flex-wrap gap-2 mb-3 text-[11px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        <span className="rounded px-2 py-1" style={{ background: '#14142A', color: '#9AA8C8' }}>
          🅒 Capitão atual: <b style={{ color: '#FFF' }}>{captain ? captain.shortName : '—'}</b>
          {captain && <span style={{ color: '#3B82F6' }}> (força do time +{captainBonusFor(captain.rarity)})</span>}
        </span>
        <span className="rounded px-2 py-1" style={{ background: '#14142A', color: '#B8A875' }}>
          ⚽ Cobrador atual: <b style={{ color: '#FFF' }}>{taker ? taker.shortName : '—'}</b>
          {taker?.composure !== undefined && <span style={{ color: '#C9A84C' }}> (compostura {taker.composure})</span>}
        </span>
      </div>

      <div className="space-y-1.5">
        {players.map((p) => {
          const isCaptain = captainId === p.id;
          const isTaker = penaltyTakerId === p.id;
          const isSuggestedCap = !captainId && p.id === suggestedCaptainId;
          const isSuggestedTaker = !penaltyTakerId && p.id === suggestedTakerId;
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
              <span className="text-sm font-bold text-white truncate flex-1 min-w-0" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {p.shortName}
              </span>
              {p.composure !== undefined && (
                <span className="text-[9px] font-bold flex-shrink-0" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }} title="Compostura (cobrança de pênalti)">
                  🧊 {p.composure}
                </span>
              )}
              <span className="text-[9px] font-bold text-gray-500 flex-shrink-0" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                GER {p.overall}
              </span>

              <button
                onClick={() => onSetCaptain(p.id)}
                title={isSuggestedCap ? 'Sugerido: maior bônus de capitão' : 'Definir como capitão'}
                className="text-[10px] font-black px-2 py-1 rounded transition-all flex-shrink-0"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: isCaptain ? '#3B82F6' : 'transparent',
                  color: isCaptain ? '#FFF' : isSuggestedCap ? '#3B82F6' : '#6A6A7A',
                  border: `1px solid ${isCaptain ? '#3B82F6' : isSuggestedCap ? '#3B82F699' : '#2A2A3A'}`,
                }}
              >
                {isSuggestedCap ? '★ ' : ''}🅒 CAP
              </button>
              <button
                onClick={() => onSetPenaltyTaker(p.id)}
                title={isSuggestedTaker ? 'Sugerido: maior compostura' : 'Definir como cobrador de pênalti'}
                className="text-[10px] font-black px-2 py-1 rounded transition-all flex-shrink-0"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: isTaker ? '#C9A84C' : 'transparent',
                  color: isTaker ? '#080810' : isSuggestedTaker ? '#C9A84C' : '#6A6A7A',
                  border: `1px solid ${isTaker ? '#C9A84C' : isSuggestedTaker ? '#C9A84C99' : '#2A2A3A'}`,
                }}
              >
                {isSuggestedTaker ? '★ ' : ''}⚽ PEN
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] mt-3" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
        ★ = sugestão automática enquanto a função não estiver definida.
      </p>
    </div>
  );
}
