// UCL Immortals — "Ver Detalhes" da partida (pós-jogo).
// Mostra: placar dos dois times, quem marcou os gols, e — via dois botões (casa/fora) — o CAMPO
// de cada time (formação + jogadores) com a NOTA FINAL real de cada um (do result.playerStats).
// Reutilizável na rodada da liga, no MEUS JOGOS e no mata-mata (substitui a antiga narração).
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MatchResult, MatchEvent, Team } from '../../lib/gameEngine';
import MatchFieldView from './MatchFieldView';
import Crest from './Crest';
import { stadiumFor } from '../../lib/stadium';

interface Props {
  result: MatchResult;
  homeTeam?: Team;
  awayTeam?: Team;
  homeName: string;
  awayName: string;
  subtitle?: string;      // ex.: agregado do mata-mata
  onClose: () => void;
}

export default function MatchDetailsModal({ result, homeTeam, awayTeam, homeName, awayName, subtitle, onClose }: Props) {
  const [side, setSide] = useState<'home' | 'away'>('home');

  // playerId → nome (a partir do playerStats, que também tem teamId e a nota final).
  const nameById: Record<string, string> = {};
  if (result.playerStats) for (const st of Object.values(result.playerStats)) nameById[st.playerId] = st.playerName;

  const goalEvents = result.events.filter(e => e.type === 'goal');
  const homeGoals = goalEvents.filter(g => g.teamId === result.homeTeamId);
  const awayGoals = goalEvents.filter(g => g.teamId === result.awayTeamId);

  // Nome do autor do gol. Gol contra não tem playerId — o zagueiro vem em opponentId → "Nome (Contra)".
  const scorerLabel = (g: MatchEvent): string =>
    g.playerId ? (nameById[g.playerId] ?? '?')
      : g.opponentId && nameById[g.opponentId] ? `${nameById[g.opponentId]} (Contra)` : 'Gol Contra';

  // Notas/gols/assistências FINAIS por jogador (do time selecionado), keyed por player.id.
  const team = side === 'home' ? homeTeam : awayTeam;
  const ratings: Record<string, number> = {};
  const goalsByPlayer: Record<string, number> = {};
  const assistsByPlayer: Record<string, number> = {};
  const disciplineByPlayer: Record<string, { yellow: number; red: boolean; injury: boolean }> = {};
  if (result.playerStats && team) {
    for (const st of Object.values(result.playerStats)) {
      if (st.teamId !== team.id) continue;
      ratings[st.playerId] = st.rating;
      goalsByPlayer[st.playerId] = st.goals;
      assistsByPlayer[st.playerId] = st.assists;
    }
  }
  if (team) for (const e of result.events) {
    if (e.teamId !== team.id || !e.playerId) continue;
    const d = disciplineByPlayer[e.playerId] ?? { yellow: 0, red: false, injury: false };
    if (e.type === 'yellow') d.yellow++;
    else if (e.type === 'red') d.red = true;
    else if (e.type === 'injury') d.injury = true;
    else continue;
    disciplineByPlayer[e.playerId] = d;
  }

  return (
    <div className="ui-modal-backdrop z-[60] p-3 sm:p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} onClick={e => e.stopPropagation()}
        className="ui-modal ui-modal--wide flex max-h-[92vh] flex-col">

        {/* Placar */}
        <div className="ui-modal__header relative flex-shrink-0 px-4 py-4">
          <button onClick={onClose} aria-label="Fechar" className="ui-icon-btn absolute right-3 top-3">✕</button>
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
              <span className="font-bold text-sm truncate text-right" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{homeName}</span>
              <Crest crestId={homeTeam?.crestId} name={homeName} size={26} />
            </div>
            <div className="font-display flex-shrink-0 px-1 text-4xl tabular-nums text-[var(--ui-brand-strong)]">
              {result.homeGoals} <span style={{ opacity: .45 }}>-</span> {result.awayGoals}
            </div>
            <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
              <Crest crestId={awayTeam?.crestId} name={awayName} size={26} />
              <span className="font-bold text-sm truncate" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{awayName}</span>
            </div>
          </div>
          {result.penaltyWinner && ((result.homePenalties ?? 0) + (result.awayPenalties ?? 0)) > 0 && (
            <div className="text-center text-[11px] mt-1.5 font-bold" style={{ color: '#EAB308', fontFamily: 'Rajdhani, sans-serif' }}>
              Pênaltis: {result.homePenalties} - {result.awayPenalties}
            </div>
          )}
          {subtitle && <div className="text-center text-[10px] mt-1" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{subtitle}</div>}
        </div>

        <div className="ui-modal__body flex-1">
          {/* Gols + Cartões/lesões — SEMPRE no mesmo bloco, com UMA linha entre eles só quando os
              dois existem (layout consistente entre partidas). */}
          {(() => {
            const hasDisc = result.events.some(e => e.type === 'yellow' || e.type === 'red' || e.type === 'injury');
            if (goalEvents.length === 0 && !hasDisc) return null;
            const ic = (t: string) => t === 'yellow' ? '🟨' : t === 'red' ? '🟥' : '🩹';
            return (
              <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #16162a' }}>
                {goalEvents.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4">
                    <div className="flex flex-col items-end gap-0.5">
                      {homeGoals.map((g, i) => (
                        <div key={i} className="text-[12px]" style={{ color: '#E8D8A0', fontFamily: 'Rajdhani, sans-serif' }}>
                          {scorerLabel(g)} <span style={{ color: '#8A8A9A' }}>{g.minute}'</span> ⚽
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                      {awayGoals.map((g, i) => (
                        <div key={i} className="text-[12px]" style={{ color: '#E8D8A0', fontFamily: 'Rajdhani, sans-serif' }}>
                          ⚽ <span style={{ color: '#8A8A9A' }}>{g.minute}'</span> {scorerLabel(g)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {goalEvents.length > 0 && hasDisc && <div className="my-2.5" style={{ borderTop: '1px solid #16162a' }} />}
                {hasDisc && (
                  <div className="grid grid-cols-2 gap-x-4">
                    {(['home', 'away'] as const).map(sd => {
                      const tid = sd === 'home' ? result.homeTeamId : result.awayTeamId;
                      const list = result.events.filter(e => (e.type === 'yellow' || e.type === 'red' || e.type === 'injury') && e.teamId === tid);
                      return (
                        <div key={sd} className={`flex flex-col gap-0.5 ${sd === 'home' ? 'items-end' : 'items-start'}`}>
                          {list.map((e, i) => (
                            <div key={i} className="text-[11px]" style={{ color: '#B8B8C8', fontFamily: 'Rajdhani, sans-serif' }}>
                              {sd === 'away' && <>{ic(e.type)} </>}<span style={{ color: '#8A8A9A' }}>{e.minute}'</span> {e.playerId ? (nameById[e.playerId] ?? '?') : '?'}{sd === 'home' && <> {ic(e.type)}</>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Estádio — onde o jogo aconteceu (casa do mandante) */}
          {homeTeam && (() => {
            const st = stadiumFor(homeTeam.coachId, !!homeTeam.coachPrime);
            return (
              <div className="flex items-center gap-3 mb-3 rounded-lg px-3 py-2" style={{ background: '#0F0F1A', border: `1px solid ${st.prime ? '#E8C84A44' : '#1A1A2A'}` }}>
                <div className="w-[66px] h-[66px] rounded-lg overflow-hidden flex-shrink-0" style={{ border: `2px solid ${st.prime ? '#E8C84A66' : '#C9A84C55'}`, background: 'linear-gradient(135deg,#12203a,#0A0A12)' }}>
                  <img src={st.photoUrl} alt={st.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🏟️ ESTÁDIO</div>
                  <div className="text-base font-black leading-tight truncate" style={{ color: st.prime ? '#E8C84A' : '#FFF', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.02em' }}>{st.name}</div>
                  <div className="text-[10px] font-bold truncate" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>Casa do {homeName}</div>
                </div>
              </div>
            );
          })()}

          {/* Alternar entre os dois times */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSide('home')} className="ui-tab flex-1" data-active={side === 'home'}>
              {homeName}
            </button>
            <button onClick={() => setSide('away')} className="ui-tab flex-1" data-active={side === 'away'}>
              {awayName}
            </button>
          </div>

          {team ? (
            <MatchFieldView team={team} ratings={ratings} goalsByPlayer={goalsByPlayer} assistsByPlayer={assistsByPlayer} disciplineByPlayer={disciplineByPlayer} accent={side === 'home' ? '#C9A84C' : '#818CF8'} />
          ) : (
            <div className="ui-empty">Escalação indisponível.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
