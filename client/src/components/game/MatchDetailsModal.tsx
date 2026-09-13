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
import { IconButton } from '../../design-system';

interface Props {
  result: MatchResult;
  homeTeam?: Team;
  awayTeam?: Team;
  homeName: string;
  awayName: string;
  subtitle?: string;      // ex.: agregado do mata-mata
  isKnockout?: boolean;
  isFinal?: boolean;
  onClose: () => void;
}

export default function MatchDetailsModal({ result, homeTeam, awayTeam, homeName, awayName, subtitle, isKnockout = false, isFinal = false, onClose }: Props) {
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
  // A match plan can switch tactics during the match. The final result should
  // display the same active tactic that was in force at the final whistle,
  // instead of silently falling back to the pre-match selection.
  const finalTactic = team
    ? result.events
      .filter(e => e.type === 'tactic' && e.teamId === team.id && e.tacticAction)
      .sort((a, b) => a.minute - b.minute)
      .at(-1)?.tacticAction ?? team.playStyle
    : undefined;

  return (
    <div className="ui-modal-backdrop z-[60] p-3 sm:p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} onClick={e => e.stopPropagation()}
        className="ui-modal ui-modal--wide flex max-h-[92vh] flex-col">

        {/* Placar: barra superior com contexto + fechar, e três colunas estáveis abaixo. */}
        <div className="ui-modal__header flex-shrink-0 flex-col items-stretch gap-2 px-4 pb-4 pt-2 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>
              Detalhes da partida
            </span>
            <IconButton label="Fechar detalhes da partida" onClick={onClose} className="shrink-0 text-xl leading-none">×</IconButton>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 sm:gap-4">
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="min-w-0 truncate text-right text-sm font-bold" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{homeName}</span>
              <Crest crestId={homeTeam?.crestId} name={homeName} size={30} />
            </div>
            <div className="font-display whitespace-nowrap px-1 text-4xl tabular-nums text-[var(--ui-brand-strong)]">
              {result.homeGoals} <span style={{ opacity: .45 }}>-</span> {result.awayGoals}
            </div>
            <div className="flex min-w-0 items-center justify-start gap-2">
              <Crest crestId={awayTeam?.crestId} name={awayName} size={30} />
              <span className="min-w-0 truncate text-sm font-bold" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{awayName}</span>
            </div>
          </div>
          {result.penaltyWinner && ((result.homePenalties ?? 0) + (result.awayPenalties ?? 0)) > 0 && (
            <div className="mt-1 text-center text-xs font-bold" style={{ color: '#EAB308', fontFamily: 'Rajdhani, sans-serif' }}>
              Pênaltis: {result.homePenalties} - {result.awayPenalties}
            </div>
          )}
          {subtitle && <div className="mt-1 text-center text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{subtitle}</div>}
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
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 gap-2">
              <button onClick={() => setSide('home')} className="ui-tab min-w-0 flex-1 truncate" data-active={side === 'home'}>
                {homeName}
              </button>
              <button onClick={() => setSide('away')} className="ui-tab min-w-0 flex-1 truncate" data-active={side === 'away'}>
                {awayName}
              </button>
            </div>
          </div>

          {team ? (
            <MatchFieldView
              team={team}
              activePlayStyle={finalTactic}
              ratings={ratings}
              goalsByPlayer={goalsByPlayer}
              assistsByPlayer={assistsByPlayer}
              disciplineByPlayer={disciplineByPlayer}
              accent={side === 'home' ? '#C9A84C' : '#818CF8'}
              isKnockout={isKnockout}
              isFinal={isFinal}
              isLosing={team.id === result.homeTeamId ? result.homeGoals < result.awayGoals : result.awayGoals < result.homeGoals}
            />
          ) : (
            <div className="ui-empty">Escalação indisponível.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
