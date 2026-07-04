// UCL Immortals — "Ver Detalhes" da partida (pós-jogo).
// Mostra: placar dos dois times, quem marcou os gols, e — via dois botões (casa/fora) — o CAMPO
// de cada time (formação + jogadores) com a NOTA FINAL real de cada um (do result.playerStats).
// Reutilizável na rodada da liga, no MEUS JOGOS e no mata-mata (substitui a antiga narração).
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MatchResult, MatchEvent, Team } from '../../lib/gameEngine';
import MatchFieldView from './MatchFieldView';
import Crest from './Crest';

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(4,4,12,0.94)' }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: '#0b0b14', border: '1px solid #c9a84c44', boxShadow: '0 0 50px rgba(0,0,0,0.6)' }}>

        {/* Placar */}
        <div className="relative px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1d1d2f', background: 'linear-gradient(135deg,#141018,#0b0b14)' }}>
          <button onClick={onClose} className="absolute top-3 right-4 text-gray-400 hover:text-white text-2xl font-black leading-none">✕</button>
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
              <span className="font-bold text-sm truncate text-right" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{homeName}</span>
              <Crest crestId={homeTeam?.crestId} name={homeName} size={26} />
            </div>
            <div className="text-3xl font-black tabular-nums px-1 flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
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

        <div className="overflow-y-auto flex-1 min-h-0 p-4">
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

          {/* Alternar entre os dois times */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSide('home')} className="flex-1 py-2 rounded-lg text-xs font-black tracking-wider transition-all"
              style={{ fontFamily: 'Bebas Neue, sans-serif', background: side === 'home' ? '#C9A84C' : '#14142A', color: side === 'home' ? '#0A0A14' : '#9A9AAA', border: `1px solid ${side === 'home' ? '#C9A84C' : '#1A1A2A'}` }}>
              {homeName}
            </button>
            <button onClick={() => setSide('away')} className="flex-1 py-2 rounded-lg text-xs font-black tracking-wider transition-all"
              style={{ fontFamily: 'Bebas Neue, sans-serif', background: side === 'away' ? '#818CF8' : '#14142A', color: side === 'away' ? '#0A0A14' : '#9A9AAA', border: `1px solid ${side === 'away' ? '#818CF8' : '#1A1A2A'}` }}>
              {awayName}
            </button>
          </div>

          {team ? (
            <MatchFieldView team={team} ratings={ratings} goalsByPlayer={goalsByPlayer} assistsByPlayer={assistsByPlayer} disciplineByPlayer={disciplineByPlayer} accent={side === 'home' ? '#C9A84C' : '#818CF8'} />
          ) : (
            <div className="py-8 text-center text-xs text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Escalação indisponível.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
