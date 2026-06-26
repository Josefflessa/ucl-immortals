// UCL Immortals — Captain & Penalty-taker selector
// Shared by the squad-review screen (after the draft) and the league "MEU TIME"
// tab (between matches). Lets the manager choose who wears the armband and who
// takes the penalties that occur DURING a match.
//
// The effect numbers below mirror the engine so the UI never lies:
//  - Captain: the captain's single best attribute is boosted +CAPTAIN_BOOST for every
//      teammate (gameEngine.captainBestStat / CAPTAIN_BOOST)
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
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
  traits?: string[];
}

interface RolesSelectorProps {
  players: RoleablePlayer[]; // the 11 starters
  captainId: string | null | undefined;
  penaltyTakerId: string | null | undefined;
  freeKickTakerId: string | null | undefined;
  onSetCaptain: (playerId: string) => void;
  onSetPenaltyTaker: (playerId: string) => void;
  onSetFreeKickTaker: (playerId: string) => void;
}

// Captain leadership — the captain's SINGLE BEST attribute is lifted +CAPTAIN_BOOST for
// every teammate (mirrors gameEngine.captainBestStat / CAPTAIN_BOOST). So the choice is
// "which team-wide stat do I want?", not "who is my best card?".
const CAPTAIN_BOOST = 3;
const CAP_STATS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const;
const STAT_LABELS: Record<string, string> = {
  pace: 'Ritmo', shooting: 'Finalização', passing: 'Passe', dribbling: 'Drible', defending: 'Defesa', physical: 'Físico',
};
function captainBestStatOf(p: RoleablePlayer): { stat: string; label: string; value: number } {
  let best: string = CAP_STATS[0], bestV = (p as unknown as Record<string, number>)[CAP_STATS[0]] ?? 0;
  for (const s of CAP_STATS) {
    const v = (p as unknown as Record<string, number>)[s] ?? 0;
    if (v > bestV) { bestV = v; best = s; }
  }
  return { stat: best, label: STAT_LABELS[best] ?? best, value: bestV };
}

// Penalty reliability score used only to RANK candidates for the suggestion.
// Mirrors the composure + trait weighting the engine uses on each kick.
function penaltyScoreFor(p: RoleablePlayer): number {
  return (p.composure ?? 0)
    + (p.traits?.includes('Especialista em Decisões') ? 10 : 0)
    + (p.traits?.includes('Frio na Final') ? 10 : 0);
}

// Free-kick ranking — mirrors gameEngine.getFreeKickTaker (specialist trait first,
// otherwise highest shooting + composure).
function freeKickScoreFor(p: RoleablePlayer): number {
  return (p.shooting ?? 0) + (p.composure ?? 0)
    + ((p.traits?.includes('Cobrador de Falta') || p.traits?.includes('Cobrança de Falta')) ? 50 : 0);
}

export default function RolesSelector({
  players,
  captainId,
  penaltyTakerId,
  freeKickTakerId,
  onSetCaptain,
  onSetPenaltyTaker,
  onSetFreeKickTaker,
}: RolesSelectorProps) {
  // Suggested picks: best captain = highest bonus (tiebreak overall);
  // best taker = highest penalty score; best free-kick = highest FK score.
  const suggestedCaptainId = [...players]
    .sort((a, b) => captainBestStatOf(b).value - captainBestStatOf(a).value || b.overall - a.overall)[0]?.id;
  const suggestedTakerId = [...players]
    .sort((a, b) => penaltyScoreFor(b) - penaltyScoreFor(a) || b.overall - a.overall)[0]?.id;
  const suggestedFreeKickId = [...players]
    .sort((a, b) => freeKickScoreFor(b) - freeKickScoreFor(a) || b.overall - a.overall)[0]?.id;

  const captain = players.find(p => p.id === captainId);
  const taker = players.find(p => p.id === penaltyTakerId);
  const fkTaker = players.find(p => p.id === freeKickTakerId);

  return (
    <div className="rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
          FUNÇÕES DE JOGO
        </span>
        <span className="text-[10px] font-bold" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          CAPITÃO · PÊNALTI · FALTA
        </span>
      </div>

      {/* What each role does */}
      <div className="grid sm:grid-cols-3 gap-2 mb-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: '#0A0A14', border: '1px solid #3B82F633', color: '#9AA8C8' }}>
          <span className="font-black" style={{ color: '#3B82F6' }}>🅒 Capitão</span> — a <b style={{ color: '#FFF' }}>maior
          estatística</b> dele vira <b style={{ color: '#FFF' }}>+{CAPTAIN_BOOST}</b> pra <b style={{ color: '#FFF' }}>todo o time</b>.
          Ex.: capitão com Defesa altíssima → +{CAPTAIN_BOOST} Defesa pra todos.
          <br /><span style={{ color: '#6A6A7A' }}>Dica: escolha pela estatística que seu time precisa.</span>
        </div>
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: '#0A0A14', border: '1px solid #C9A84C33', color: '#B8A875' }}>
          <span className="font-black" style={{ color: '#C9A84C' }}>⚽ Pênalti</span> — bate os pênaltis
          <b style={{ color: '#FFF' }}> durante o jogo</b> e a <b style={{ color: '#FFF' }}>1ª da disputa</b> (+5 compostura).
          Sucesso depende da compostura e dos traits de frieza.
          <br /><span style={{ color: '#6A6A7A' }}>Dica: maior compostura.</span>
        </div>
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: '#0A0A14', border: '1px solid #22C55E33', color: '#86B89A' }}>
          <span className="font-black" style={{ color: '#22C55E' }}>🎯 Falta</span> — cobra as
          <b style={{ color: '#FFF' }}> faltas perigosas</b> (cobrança direta) durante o jogo. O sucesso depende da
          <b style={{ color: '#FFF' }}> finalização + compostura</b>.
          <br /><span style={{ color: '#6A6A7A' }}>Dica: bom chute e frieza.</span>
        </div>
      </div>

      {/* Current selection summary */}
      <div className="flex flex-wrap gap-2 mb-3 text-[11px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        <span className="rounded px-2 py-1" style={{ background: '#14142A', color: '#9AA8C8' }}>
          🅒 Capitão atual: <b style={{ color: '#FFF' }}>{captain ? captain.shortName : '—'}</b>
          {captain && <span style={{ color: '#3B82F6' }}> (+{CAPTAIN_BOOST} {captainBestStatOf(captain).label} pra todo o time)</span>}
        </span>
        <span className="rounded px-2 py-1" style={{ background: '#14142A', color: '#B8A875' }}>
          ⚽ Pênalti: <b style={{ color: '#FFF' }}>{taker ? taker.shortName : '—'}</b>
          {taker?.composure !== undefined && <span style={{ color: '#C9A84C' }}> (comp. {taker.composure})</span>}
        </span>
        <span className="rounded px-2 py-1" style={{ background: '#14142A', color: '#86B89A' }}>
          🎯 Falta: <b style={{ color: '#FFF' }}>{fkTaker ? fkTaker.shortName : '—'}</b>
          {fkTaker && (fkTaker.shooting !== undefined || fkTaker.composure !== undefined) && (
            <span style={{ color: '#22C55E' }}> ({[
              fkTaker.shooting !== undefined ? `fin. ${fkTaker.shooting}` : null,
              fkTaker.composure !== undefined ? `comp. ${fkTaker.composure}` : null,
            ].filter(Boolean).join(' · ')})</span>
          )}
        </span>
      </div>

      <div className="space-y-1.5">
        {players.map((p) => {
          const isCaptain = captainId === p.id;
          const isTaker = penaltyTakerId === p.id;
          const isFreeKick = freeKickTakerId === p.id;
          const isSuggestedCap = !captainId && p.id === suggestedCaptainId;
          const isSuggestedTaker = !penaltyTakerId && p.id === suggestedTakerId;
          const isSuggestedFreeKick = !freeKickTakerId && p.id === suggestedFreeKickId;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{
                background: isTaker || isCaptain || isFreeKick ? '#14142A' : '#0A0A14',
                border: `1px solid ${isFreeKick ? '#22C55E55' : isTaker ? '#C9A84C55' : isCaptain ? '#3B82F655' : '#1A1A2A'}`,
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
                title={`Capitão → +${CAPTAIN_BOOST} ${captainBestStatOf(p).label} pra todo o time${isSuggestedCap ? ' (sugerido)' : ''}`}
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
              <button
                onClick={() => onSetFreeKickTaker(p.id)}
                title={isSuggestedFreeKick ? 'Sugerido: melhor finalização + compostura' : 'Definir como cobrador de falta'}
                className="text-[10px] font-black px-2 py-1 rounded transition-all flex-shrink-0"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: isFreeKick ? '#22C55E' : 'transparent',
                  color: isFreeKick ? '#080810' : isSuggestedFreeKick ? '#22C55E' : '#6A6A7A',
                  border: `1px solid ${isFreeKick ? '#22C55E' : isSuggestedFreeKick ? '#22C55E99' : '#2A2A3A'}`,
                }}
              >
                {isSuggestedFreeKick ? '★ ' : ''}🎯 FAL
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
