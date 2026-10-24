import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Crest from '../../components/game/Crest';
import { useGame } from '../../contexts/GameContext';
import { buildLeagueMatchKey, describeBet } from '@shared/game/bets';
import { MAX_RESERVE_PLAYERS } from '@shared/game/gameEngine';
import type { LeagueHub } from './useLeagueHub';
import { CardIcon, InjuryIcon } from '../../components/game/StatusIcon';
import { Ban, Check, CircleCheck, CircleX, Crown, Hourglass, Lock, LogOut, Play, Search, Target, TriangleAlert, Trophy, Users } from 'lucide-react';
import { INLINE_ICON } from '../../components/game/inlineIcon';
import { Button } from '../../design-system';

const GOLD_BUTTON = 'shadow-[0_0_25px_rgba(201,168,76,0.3)]';


// Matches tab (league phase): round fixtures, absences banner, bet buttons and
// the advance/ready/play controls.
export default function FixturesTab({ hub }: { hub: LeagueHub }) {
  const { leaveRoomOnline } = useGame();
  const actionBarRef = useRef<HTMLDivElement>(null);
  const [onlineActionBarSpace, setOnlineActionBarSpace] = useState(240);
  const {
    state, isGroupStage, isLeagueOnly, playerTeam, myUnavailable, reserveLimitExceeded, reserveCount,
    roundGroupIds, displayedRoundFixtures, playerGroup, localTeamId, getTeamName, allTeams,
    hideRoundScore, openMatchDetails, leagueRound, leagueRounds, betFor, setBetSlip,
    isActiveLeagueParticipant, iAmReady, handleReadyToggle, totalReady, allReady, readyCount,
    handlePlayRound, allFixturesPlayed, allPlayersWatched, waitingForCount, humanPlayersWithMatch,
    handleAdvanceRound, handleAdvanceKnockout, isPlayerMatchPlayed, handlePlayPlayerMatch,
    qualifies, handleFinishEliminatedCampaign, handleWatchRemainingCompetition,
  } = hub;
  // Keep the round's main action within thumb reach on phones. When a room is
  // waiting for matches/results, there is no actionable control to pin.
  const pinRoundAction = state.mode === 'solo'
    || (state.isHost
      ? !allFixturesPlayed || allPlayersWatched
      : !allFixturesPlayed && isActiveLeagueParticipant);
  const mobileActionBarClasses = pinRoundAction
    ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:mt-0 max-lg:rounded-t-2xl max-lg:rounded-b-none max-lg:border-x-0 max-lg:border-b-0 max-lg:px-4 max-lg:pt-3 max-lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-lg:shadow-[0_-10px_30px_rgba(0,0,0,0.45)]'
    : '';
  const mobileActionBarStyle = {
    background: pinRoundAction ? 'rgba(8, 8, 16, 0.96)' : undefined,
    backdropFilter: pinRoundAction ? 'blur(14px)' : undefined,
  };

  // Reserve the actual fixed bar height under the fixtures. The host has two
  // actions and a readiness counter, so a fixed padding can leave the last card
  // partly hidden on some phones and safe-area sizes.
  useEffect(() => {
    if (state.mode !== 'online' || !pinRoundAction) return;
    const bar = actionBarRef.current;
    if (!bar) return;
    const measure = () => {
      const isMobile = window.matchMedia('(max-width: 1023px)').matches;
      setOnlineActionBarSpace(isMobile ? Math.ceil(bar.getBoundingClientRect().height) + 16 : 0);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [pinRoundAction, state.mode]);

  const contentBottomSpace = state.mode === 'online' && pinRoundAction
    ? { '--online-action-bar-space': `${onlineActionBarSpace}px` } as CSSProperties
    : undefined;
  return (
          <div
            className={`space-y-3 ${pinRoundAction ? (state.mode === 'solo' ? 'pb-32 lg:pb-0' : 'pb-[var(--online-action-bar-space)] lg:pb-0') : ''}`}
            style={contentBottomSpace}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="ui-section-label">
                {isGroupStage ? 'Todas as partidas da rodada' : 'Partidas da rodada'}
              </span>
            </div>

            {/* ⚠️ Desfalques do seu time — se estiverem no XI, BLOQUEIA a rodada até ajustar (sem troca auto). */}
            {(() => {
              if (!playerTeam) return null;
              const outs = playerTeam.players.filter(p => {
                const a = state.discipline[`${playerTeam.id}:${p.id}`];
                return a && (a.banned > 0 || a.injured > 0);
              });
              if (outs.length === 0) return null;
              const inXI = new Set(myUnavailable.map(u => u.id)); // indisponíveis que estão no XI (bloqueiam)
              const blocking = outs.some(p => inXI.has(p.id));
              return (
                <div className="rounded-xl px-4 py-3 mb-1" style={{ background: blocking ? '#241010' : '#1a0e0e', border: `1px solid ${blocking ? '#EF444488' : '#7f1d1d66'}` }}>
                  <div className="text-caption font-black tracking-wide-caps mb-2" style={{ color: '#FCA5A5', fontFamily: 'var(--font-game), sans-serif' }}><TriangleAlert {...INLINE_ICON} />DESFALQUES</div>
                  <div className="flex flex-col gap-1.5">
                    {outs.map(p => {
                      const a = state.discipline[`${playerTeam.id}:${p.id}`];
                      const isIn = inXI.has(p.id);
                      const suspended = a.banned > 0;
                      const games = suspended ? a.banned : a.injured;
                      const gamesTxt = `${games} ${games === 1 ? 'jogo' : 'jogos'}`;
                      return (
                        <div key={p.id} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm leading-none">{suspended ? <CardIcon color="red" /> : <InjuryIcon />}</span>
                          <span className="text-[12px] font-bold" style={{ color: isIn ? '#FCA5A5' : '#C8B0B0', fontFamily: 'var(--font-game), sans-serif' }}>{p.shortName}</span>
                          <span className="text-caption font-black px-1.5 py-0.5 rounded tracking-caps" style={{ background: suspended ? '#EF444422' : '#3B82F622', color: suspended ? '#F87171' : '#93C5FD', fontFamily: 'var(--font-game), sans-serif' }}>
                            {suspended ? 'SUSPENSO' : 'LESIONADO'}
                          </span>
                          <span className="text-[13px] font-semibold" style={{ color: '#9A8080', fontFamily: 'var(--font-game), sans-serif' }}>fora por <b style={{ color: '#C8B0B0' }}>{gamesTxt}</b></span>
                          {isIn && (
                            <span className="text-caption font-black px-1.5 py-0.5 rounded tracking-caps" style={{ background: 'var(--ui-danger)', color: '#fff', fontFamily: 'var(--font-game), sans-serif' }}>
                              <TriangleAlert {...INLINE_ICON} />ESCALADO — TROQUE
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[12px] mt-2 pt-2 font-bold" style={{ color: blocking ? '#FCA5A5' : '#8A6A6A', borderTop: '1px solid #ffffff0d', fontFamily: 'var(--font-game), sans-serif' }}>
                    {blocking ? <><Ban {...INLINE_ICON} />Você não pode jogar com um indisponível no XI — substitua na aba MEU CLUBE.</> : <><Check {...INLINE_ICON} />Todos no banco — tudo certo. Só não escale indisponíveis no XI.</>}
                  </div>
                </div>
              );
            })()}

            {reserveLimitExceeded && (
              <div className="rounded-xl px-4 py-3 mb-1" style={{ background: '#241010', border: '1px solid #EF444488' }}>
                <div className="text-caption font-black tracking-wide-caps mb-1" style={{ color: '#FCA5A5', fontFamily: 'var(--font-game), sans-serif' }}><Ban {...INLINE_ICON} />BANCO ACIMA DO LIMITE</div>
                <div className="text-[12px] font-bold" style={{ color: '#E8C4C4', fontFamily: 'var(--font-game), sans-serif' }}>
                  Seu banco tem {reserveCount}/{MAX_RESERVE_PLAYERS} reservas. Venda reservas na aba MERCADO para liberar a partida.
                </div>
              </div>
            )}

            {roundGroupIds.map(groupId => {
              const groupFixtures = groupId === null
                ? displayedRoundFixtures
                : displayedRoundFixtures.filter(fixture => (fixture.groupId ?? 0) === groupId);
              const groupLabel = groupId === null ? null : String.fromCharCode(65 + groupId);
              const isMyGroup = groupId !== null && groupId === playerGroup?.groupId;
              return (
                <section
                  key={groupId === null ? 'all-fixtures' : `group-${groupId}`}
                  className={isGroupStage ? 'overflow-hidden rounded-xl border border-[var(--ui-surface-3)] bg-[var(--ui-bg-raised)]' : undefined}
                >
                  {isGroupStage && (
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-surface-3)] bg-[#0F0F1A] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-caption font-black tracking-wide-caps" style={{ color: isMyGroup ? 'var(--ui-brand-strong)' : 'var(--ui-text)', fontFamily: 'var(--font-game), sans-serif' }}>
                          GRUPO {groupLabel}
                        </span>
                        {isMyGroup && <span className="rounded-full border border-primary/33 bg-primary/10 px-2 py-0.5 text-caption font-black tracking-caps text-brand-strong">SEU GRUPO</span>}
                      </div>
                      <span className="text-[12px] font-bold text-[var(--ui-text-faint)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{groupFixtures.length} jogos</span>
                    </div>
                  )}
                  {/* Desktop: the other fixtures in two columns; your own match keeps the full width. */}
                  <div className={isGroupStage ? 'grid grid-cols-1 gap-3 p-3 lg:grid-cols-2' : 'grid grid-cols-1 gap-3 lg:grid-cols-2'}>
                    {groupFixtures.map((fixture, idx) => {
              const isMyFixture = fixture.homeTeamId === localTeamId || fixture.awayTeamId === localTeamId;

              const isHomeHuman = state.mode === 'online'
                ? state.onlinePlayers.some(p => p.id === fixture.homeTeamId)
                : fixture.homeTeamId === playerTeam?.id;
              const isAwayHuman = state.mode === 'online'
                ? state.onlinePlayers.some(p => p.id === fixture.awayTeamId)
                : fixture.awayTeamId === playerTeam?.id;
              const isHumanMatch = isHomeHuman || isAwayHuman;

              const homeName = getTeamName(fixture.homeTeamId);
              const awayName = getTeamName(fixture.awayTeamId);

              const homeColor = fixture.homeTeamId === localTeamId ? 'var(--ui-brand-strong)' : isHomeHuman ? 'var(--ui-info)' : 'var(--ui-text)';
              const awayColor = fixture.awayTeamId === localTeamId ? 'var(--ui-brand-strong)' : isAwayHuman ? 'var(--ui-info)' : 'var(--ui-text)';

              return (
                <div
                  key={idx}
                  className={isMyFixture ? "p-4 rounded-xl transition-all lg:col-span-2" : "p-4 rounded-xl transition-all"}
                  style={{
                    background: isMyFixture ? 'linear-gradient(135deg, var(--ui-surface-2), #0b0b14)' : isHumanMatch ? 'linear-gradient(135deg, #0f0f1f, #0a0a18)' : 'var(--ui-surface-1)',
                    border: isMyFixture ? '1px solid var(--ui-brand-line)' : isHumanMatch ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid var(--ui-line-subtle)',
                    boxShadow: isMyFixture ? '0 0 15px rgba(201, 168, 76, 0.1)' : 'none',
                  }}
                >
                 <div className="flex items-center justify-between">
                  {/* Home Team */}
                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    <span className="min-w-0 whitespace-normal break-words text-right text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: homeColor }}>{homeName}</span>
                    <Crest crestId={allTeams.find(t => t.id === fixture.homeTeamId)?.crestId} name={homeName} size={22} />
                  </div>

                  {/* Score / VS */}
                  <div className="w-24 shrink-0 text-center flex flex-col items-center justify-center sm:w-28 lg:w-24">
                    {fixture.played && fixture.result && !hideRoundScore ? (
                      <>
                        <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                          {fixture.result.homeGoals} - {fixture.result.awayGoals}
                        </span>
                        {fixture.result.playerStats && (
                          <button onClick={() => openMatchDetails({ ...fixture.result!, round: fixture.round }, { isKnockout: false, isFinal: false })}
                            className="mt-1 inline-flex h-7 min-h-0 min-w-[92px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-black uppercase leading-none tracking-wider transition-all hover:brightness-125"
                            style={{ background: 'var(--ui-surface-2)', border: '1px solid var(--ui-line)', color: 'var(--ui-text-soft)', fontFamily: 'var(--font-game), sans-serif' }}>
                            <Search {...INLINE_ICON} />Detalhes
                          </button>
                        )}
                      </>
                    ) : hideRoundScore && fixture.played ? (
                      <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: isMyFixture ? 'var(--ui-brand)' : isHumanMatch ? 'var(--ui-info)' : 'var(--ui-text-faint)' }}>
                        {isMyFixture ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" />AO VIVO</span> : <Lock size="1em" aria-label="Resultado oculto" className="inline-block" />}
                      </span>
                    ) : (
                      <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: isMyFixture ? 'var(--ui-brand)' : isHumanMatch ? 'var(--ui-info)' : 'var(--ui-text-faint)' }}>
                        {isMyFixture ? '⚽ VS' : isHumanMatch ? <><Users {...INLINE_ICON} />VS</> : 'VS'}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                    <Crest crestId={allTeams.find(t => t.id === fixture.awayTeamId)?.crestId} name={awayName} size={22} />
                    <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: awayColor }}>{awayName}</span>
                  </div>
                 </div>

                  {/* 🎯 Palpite — botão (pré-jogo) / badge de resultado (pós-revelação) */}
                  {(() => {
                    const matchKey = buildLeagueMatchKey(leagueRound, fixture.homeTeamId, fixture.awayTeamId);
                    const myBet = betFor(matchKey);
                    if (fixture.played) {
                      if (!myBet) return null;
                      // Online, a revealed ticket was already announced to its owner.
                      if (!myBet.revealed || (state.mode !== 'online' && hideRoundScore)) {
                        return <div className="mt-2 text-center text-[12px] font-bold" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}><Target {...INLINE_ICON} />aposta em andamento</div>;
                      }
                      const txt = myBet.tier === 'exact' ? `Aposta: placar exato (+${myBet.payout})`
                        : myBet.tier === 'outcome' ? `Aposta: resultado certo (+${myBet.payout})`
                          : myBet.tier === 'builder' ? `Aposta certa (+${myBet.payout})`
                          : `Aposta perdida (−${myBet.stake})${(myBet.protectionRefund ?? 0) > 0 ? ` · devolução +${myBet.protectionRefund}` : ''}`;
                      return <div className="mt-2 text-center text-[13px] font-black" style={{ color: myBet.won ? 'var(--ui-success)' : 'var(--ui-danger)', fontFamily: 'var(--font-game), sans-serif' }}>{myBet.won ? <CircleCheck {...INLINE_ICON} /> : <CircleX {...INLINE_ICON} />}{txt}</div>;
                    }
                    return (
                      <div className="mt-2 text-center">
                        <button onClick={() => setBetSlip({
                          matchKey,
                          homeName,
                          awayName,
                          homeTeamId: fixture.homeTeamId,
                          awayTeamId: fixture.awayTeamId,
                        })}
                          className="inline-flex min-h-8 items-center rounded-(--ui-radius-md) px-3 text-body-sm font-black tracking-wider transition-colors hover:bg-[var(--ui-brand-soft)]"
                          style={{ fontFamily: 'var(--font-game), sans-serif', background: myBet ? 'var(--ui-brand-soft)' : 'var(--ui-surface-1)', color: 'var(--ui-brand-strong)', border: '1px solid var(--ui-brand-line)' }}>
                          <Target {...INLINE_ICON} />{myBet ? `Aposta: ${describeBet(myBet)} · ${myBet.stake} (editar)` : 'Apostar'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Advance controls */}
            {state.mode === 'online' ? (
              <div ref={actionBarRef} className={`mt-6 p-4 rounded-xl text-center border ${mobileActionBarClasses}`}
                style={{ ...mobileActionBarStyle, background: mobileActionBarStyle.background ?? 'var(--ui-surface-1)', borderColor: 'var(--ui-surface-3)' }}
              >
                {state.isHost ? (
                  !allFixturesPlayed ? (
                    /* O host controla a rodada; só confirma pronto se também tiver partida. */
                    <>
                      {isActiveLeagueParticipant && (iAmReady ? (
                        <button onClick={handleReadyToggle}
                          className="w-full py-3 rounded-xl font-black text-lg tracking-widest transition-all mb-2 active:scale-[0.98]"
                          style={{ fontFamily: 'var(--font-display), sans-serif', background: '#0a1a0e', color: '#4ADE80', border: '1px solid #22C55E88', boxShadow: 'inset 0 3px 9px rgba(0,0,0,0.55)', transform: 'scale(0.985)' }}
                          title="Toque para cancelar">
                          <CircleCheck {...INLINE_ICON} />PRONTO!
                        </button>
                      ) : (
                        <button onClick={handleReadyToggle}
                          className="w-full py-3 rounded-xl font-black text-lg tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98] mb-2"
                          style={{ fontFamily: 'var(--font-display), sans-serif', background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                          <CircleCheck {...INLINE_ICON} />ESTOU PRONTO
                        </button>
                      ))}
                      {!isActiveLeagueParticipant && totalReady > 0 && (
                        <div className="mb-2 text-[13px] font-bold text-[var(--ui-text-muted)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                          Você não disputa esta rodada; o anfitrião inicia quando os participantes confirmarem.
                        </div>
                      )}
                      {totalReady > 0 && (
                        <div className="mb-2 text-caption font-black tracking-wide-caps" style={{ fontFamily: 'var(--font-game), sans-serif', color: allReady ? 'var(--ui-success)' : 'var(--ui-brand)' }}>
                          {readyCount}/{totalReady} PRONTO{totalReady !== 1 ? 'S' : ''}
                        </div>
                      )}
                      <button
                        onClick={handlePlayRound}
                        disabled={!allReady}
                        className="w-full py-4 rounded-xl font-black text-xl tracking-widest shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:cursor-pointer"
                        style={{
                          fontFamily: 'var(--font-display), sans-serif',
                          background: allReady ? 'linear-gradient(135deg, var(--ui-brand) 0%, var(--ui-brand-strong) 50%, var(--ui-brand) 100%)' : 'var(--ui-surface-3)',
                          color: allReady ? 'var(--ui-bg)' : '#666',
                          boxShadow: allReady ? '0 0 25px rgba(201,168,76,0.3)' : 'none',
                        }}
                      >
                        <Play {...INLINE_ICON} fill="currentColor" />JOGAR RODADA {leagueRound}
                      </button>
                      <div className={`mt-2 text-[13px] font-bold text-[var(--ui-text-muted)] ${pinRoundAction ? 'max-lg:hidden' : ''}`} style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        {allReady
                          ? 'Todas as partidas começam ao mesmo tempo para todos.'
                          : 'Todos os participantes com partida precisam confirmar que estão prontos.'}
                      </div>
                    </>
                  ) : !allPlayersWatched ? (
                    <div className="py-3">
                      <div className="text-sm font-bold animate-pulse" style={{ fontFamily: 'var(--font-game), sans-serif', color: 'var(--ui-brand)' }}>
                        <Hourglass {...INLINE_ICON} />AGUARDANDO {waitingForCount} JOGADOR{waitingForCount !== 1 ? 'ES' : ''} {waitingForCount !== 1 ? 'VEREM' : 'VER'} O RESULTADO...
                      </div>
                      <div className="mt-1 text-[13px] text-[var(--ui-text-muted)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        ({humanPlayersWithMatch.length - waitingForCount}/{humanPlayersWithMatch.length} concluídos)
                      </div>
                    </div>
                  ) : leagueRound < leagueRounds ? (
                    <Button intent="primary" size="large" block onClick={handleAdvanceRound} className={GOLD_BUTTON}>
                      AVANÇAR PARA A RODADA {leagueRound + 1} →
                    </Button>
                  ) : (
                    <button
                      onClick={handleAdvanceKnockout}
                      className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                      style={{
                        fontFamily: 'var(--font-display), sans-serif',
                        background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)',
                        color: '#000',
                        boxShadow: '0 0 25px rgba(34,197,94,0.3)',
                      }}
                    >
                      <Trophy {...INLINE_ICON} />{isLeagueOnly ? 'ENCERRAR COMPETIÇÃO →' : 'AVANÇAR PARA O MATA-MATA →'}
                    </button>
                  )
                ) : (
                  !allFixturesPlayed ? (
                    /* ✅ Só quem tem partida nesta rodada confirma "Estou pronto". */
                    isActiveLeagueParticipant ? <>
                      {iAmReady ? (
                        <button onClick={handleReadyToggle}
                          className="w-full py-4 rounded-xl font-black text-xl tracking-widest transition-all active:scale-[0.98]"
                          style={{ fontFamily: 'var(--font-display), sans-serif', background: '#0a1a0e', color: '#4ADE80', border: '1px solid #22C55E88', boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.55)', transform: 'scale(0.985)' }}
                          title="Toque para cancelar">
                          <CircleCheck {...INLINE_ICON} />PRONTO!
                        </button>
                      ) : (
                        <button onClick={handleReadyToggle}
                          className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98]"
                          style={{ fontFamily: 'var(--font-display), sans-serif', background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                          <CircleCheck {...INLINE_ICON} />ESTOU PRONTO
                        </button>
                      )}
                      <div className="mt-2 text-[13px] font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: 'var(--ui-text-muted)' }}>
                        {readyCount}/{totalReady} pronto{totalReady !== 1 ? 's' : ''} · o anfitrião inicia quando todos confirmarem.
                      </div>
                    </> : <>
                      {totalReady > 0 && (
                        <div className="mb-2 text-[13px] font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: 'var(--ui-text-muted)' }}>
                          {readyCount}/{totalReady} participantes prontos.
                        </div>
                      )}
                      <div className="py-2 text-sm font-bold text-yellow-500/80" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        Você não disputa esta rodada. Aguardando o anfitrião iniciar.
                      </div>
                    </>
                  ) : (
                    <div className="py-2 text-sm font-bold text-green-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      <Crown {...INLINE_ICON} />RODADA CONCLUÍDA! AGUARDANDO O ANFITRIÃO AVANÇAR...
                    </div>
                  )
                )}
                {state.advanceBlocked && state.advanceBlocked.length > 0 && (
                  <div className="mt-2 text-center text-[13px] font-bold text-yellow-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                    <Hourglass {...INLINE_ICON} />Aguardando assistirem: {state.advanceBlocked.join(', ')}
                  </div>
                )}
                {state.mode === 'online' && !isLeagueOnly && !qualifies && leagueRound >= leagueRounds && allFixturesPlayed && (
                  <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--ui-surface-3)' }}>
                    <button
                      type="button"
                      onClick={() => leaveRoomOnline({ partialReport: true })}
                      className="w-full rounded-xl border px-4 py-3 text-sm font-black tracking-wider transition-colors hover:bg-white/5"
                      style={{ fontFamily: 'var(--font-game), sans-serif', borderColor: 'var(--ui-surface-3)', color: 'var(--ui-text-muted)' }}
                    >
                      <LogOut {...INLINE_ICON} />SAIR E VER RESUMO PARCIAL
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={`mt-6 ${mobileActionBarClasses} ${pinRoundAction ? 'max-lg:border-t max-lg:border-[var(--ui-line-subtle)] lg:sticky lg:bottom-0 lg:z-(--ui-z-action-bar) lg:bg-gradient-to-t lg:from-[var(--ui-bg)] lg:from-70% lg:to-transparent lg:pb-4 lg:pt-6' : ''}`} style={mobileActionBarStyle}>
                {!isPlayerMatchPlayed ? (
                  /* Solo: o botão de JOGAR fica embaixo dos confrontos (igual ao host no online). */
                  <>
                    <Button intent="primary" size="large" block onClick={handlePlayPlayerMatch} className={GOLD_BUTTON}>
                      <Play size={18} fill="currentColor" aria-hidden="true" />JOGAR RODADA {leagueRound}
                    </Button>
                  </>
                ) : leagueRound < leagueRounds ? (
                  <Button intent="primary" size="large" block onClick={handleAdvanceRound} className={GOLD_BUTTON}>
                    AVANÇAR PARA A RODADA {leagueRound + 1} →
                  </Button>
                ) : (
                  state.mode === 'solo' && !qualifies ? (
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Button intent="primary" size="large" block onClick={handleWatchRemainingCompetition} className={GOLD_BUTTON}>
                        <Play size={18} fill="currentColor" aria-hidden="true" />ACOMPANHAR O MATA-MATA →
                      </Button>
                      <Button intent="secondary" size="large" onClick={handleFinishEliminatedCampaign} className="w-full font-ui text-body-sm sm:w-auto">
                        <Trophy size={16} aria-hidden="true" />Encerrar e ver resultado
                      </Button>
                    </div>
                  ) : (
                    <Button intent="success" size="large" block onClick={qualifies ? handleAdvanceKnockout : handleFinishEliminatedCampaign}>
                      <Trophy size={18} aria-hidden="true" />{isLeagueOnly ? 'ENCERRAR COMPETIÇÃO →' : qualifies ? 'AVANÇAR PARA O MATA-MATA →' : 'VER RESULTADO FINAL →'}
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
  );
}
