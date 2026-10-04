import Crest from '../../components/game/Crest';
import { buildLeagueMatchKey, describeBet } from '@shared/game/bets';
import { MAX_RESERVE_PLAYERS } from '@shared/game/gameEngine';
import type { LeagueHub } from './useLeagueHub';

// Matches tab (league phase): round fixtures, absences banner, bet buttons and
// the advance/ready/play controls.
export default function FixturesTab({ hub }: { hub: LeagueHub }) {
  const {
    state, isGroupStage, isLeagueOnly, playerTeam, myUnavailable, reserveLimitExceeded, reserveCount,
    roundGroupIds, displayedRoundFixtures, playerGroup, localTeamId, getTeamName, allTeams,
    hideRoundScore, openMatchDetails, leagueRound, leagueRounds, betFor, setBetSlip,
    isActiveLeagueParticipant, iAmReady, handleReadyToggle, totalReady, allReady, readyCount,
    handlePlayRound, allFixturesPlayed, allPlayersWatched, waitingForCount, humanPlayersWithMatch,
    handleAdvanceRound, handleAdvanceKnockout, isPlayerMatchPlayed, handlePlayPlayerMatch,
    qualifies, handleFinishEliminatedCampaign,
  } = hub;
  return (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold tracking-widest text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                {isGroupStage ? 'TODAS AS PARTIDAS DA RODADA' : 'PARTIDAS DA RODADA'}
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
                  <div className="text-[13px] font-black tracking-widest mb-2" style={{ color: '#FCA5A5', fontFamily: 'var(--font-game), sans-serif' }}>⚠️ DESFALQUES</div>
                  <div className="flex flex-col gap-1.5">
                    {outs.map(p => {
                      const a = state.discipline[`${playerTeam.id}:${p.id}`];
                      const isIn = inXI.has(p.id);
                      const suspended = a.banned > 0;
                      const games = suspended ? a.banned : a.injured;
                      const gamesTxt = `${games} ${games === 1 ? 'jogo' : 'jogos'}`;
                      return (
                        <div key={p.id} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm leading-none">{suspended ? '🟥' : '🩹'}</span>
                          <span className="text-[12px] font-bold" style={{ color: isIn ? '#FCA5A5' : '#C8B0B0', fontFamily: 'var(--font-game), sans-serif' }}>{p.shortName}</span>
                          <span className="text-[12px] font-black px-1.5 py-0.5 rounded tracking-wider" style={{ background: suspended ? '#EF444422' : '#3B82F622', color: suspended ? '#F87171' : '#93C5FD', fontFamily: 'var(--font-game), sans-serif' }}>
                            {suspended ? 'SUSPENSO' : 'LESIONADO'}
                          </span>
                          <span className="text-[13px] font-semibold" style={{ color: '#9A8080', fontFamily: 'var(--font-game), sans-serif' }}>fora por <b style={{ color: '#C8B0B0' }}>{gamesTxt}</b></span>
                          {isIn && (
                            <span className="text-[12px] font-black px-1.5 py-0.5 rounded tracking-wider" style={{ background: 'var(--ui-danger)', color: '#fff', fontFamily: 'var(--font-game), sans-serif' }}>
                              ⚠ ESCALADO — TROQUE
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[12px] mt-2 pt-2 font-bold" style={{ color: blocking ? '#FCA5A5' : '#8A6A6A', borderTop: '1px solid #ffffff0d', fontFamily: 'var(--font-game), sans-serif' }}>
                    {blocking ? '🚫 Você não pode jogar com um indisponível no XI — substitua na aba MEU CLUBE.' : '✓ Todos no banco — tudo certo. Só não escale indisponíveis no XI.'}
                  </div>
                </div>
              );
            })()}

            {reserveLimitExceeded && (
              <div className="rounded-xl px-4 py-3 mb-1" style={{ background: '#241010', border: '1px solid #EF444488' }}>
                <div className="text-[13px] font-black tracking-widest mb-1" style={{ color: '#FCA5A5', fontFamily: 'var(--font-game), sans-serif' }}>🚫 BANCO ACIMA DO LIMITE</div>
                <div className="text-[12px] font-bold" style={{ color: '#E8C4C4', fontFamily: 'var(--font-game), sans-serif' }}>
                  Seu banco tem {reserveCount}/{MAX_RESERVE_PLAYERS} reservas. Venda ou remova jogadores na aba MERCADO para liberar a partida.
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
                  className={isGroupStage ? 'overflow-hidden rounded-xl border border-[#1A1A2A] bg-[#0A0A14]' : undefined}
                >
                  {isGroupStage && (
                    <div className="flex items-center justify-between gap-3 border-b border-[#1A1A2A] bg-[#0F0F1A] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black tracking-widest" style={{ color: isMyGroup ? 'var(--ui-brand-strong)' : '#FFFFFF', fontFamily: 'var(--font-game), sans-serif' }}>
                          GRUPO {groupLabel}
                        </span>
                        {isMyGroup && <span className="rounded-full border border-primary/33 bg-primary/10 px-2 py-0.5 text-[12px] font-black tracking-wider text-brand-strong">SEU GRUPO</span>}
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

              const homeColor = fixture.homeTeamId === localTeamId ? '#C9A84C' : isHomeHuman ? '#818CF8' : '#FFF';
              const awayColor = fixture.awayTeamId === localTeamId ? '#C9A84C' : isAwayHuman ? '#818CF8' : '#FFF';

              return (
                <div
                  key={idx}
                  className={isMyFixture ? "p-4 rounded-xl transition-all lg:col-span-2" : "p-4 rounded-xl transition-all"}
                  style={{
                    background: isMyFixture ? 'linear-gradient(135deg, var(--ui-surface-2), #0b0b14)' : isHumanMatch ? 'linear-gradient(135deg, #0f0f1f, #0a0a18)' : 'var(--ui-surface-1)',
                    border: isMyFixture ? '1px solid #c9a84c55' : isHumanMatch ? '1px solid #6366f155' : '1px solid var(--ui-surface-3)',
                    boxShadow: isMyFixture ? '0 0 15px rgba(201, 168, 76, 0.1)' : 'none',
                  }}
                >
                 <div className="flex items-center justify-between">
                  {/* Home Team */}
                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    <span className="font-semibold text-sm truncate lg:whitespace-normal lg:text-right lg:leading-tight lg:line-clamp-2" style={{ fontFamily: 'var(--font-game), sans-serif', color: homeColor }}>{homeName}</span>
                    <Crest crestId={allTeams.find(t => t.id === fixture.homeTeamId)?.crestId} name={homeName} size={22} />
                  </div>

                  {/* Score / VS */}
                  <div className="w-28 shrink-0 text-center flex flex-col items-center justify-center lg:w-24">
                    {fixture.played && fixture.result && !hideRoundScore ? (
                      <>
                        <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                          {fixture.result.homeGoals} - {fixture.result.awayGoals}
                        </span>
                        {fixture.result.playerStats && (
                          <button onClick={() => openMatchDetails({ ...fixture.result!, round: fixture.round }, { isKnockout: false, isFinal: false })}
                            className="mt-1 h-7 min-h-0 px-2 py-0.5 rounded-md text-[12px] font-black uppercase leading-none tracking-wider transition-all hover:brightness-125"
                            style={{ background: 'var(--ui-surface-2)', border: '1px solid var(--ui-line)', color: '#9AA8C8', fontFamily: 'var(--font-game), sans-serif' }}>
                            🔍 Detalhes
                          </button>
                        )}
                      </>
                    ) : hideRoundScore && fixture.played ? (
                      <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: isMyFixture ? 'var(--ui-brand)' : isHumanMatch ? '#6366f1' : '#4A4A5A' }}>
                        {isMyFixture ? '⚽ AO VIVO' : '🔒'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: isMyFixture ? 'var(--ui-brand)' : isHumanMatch ? '#6366f1' : '#4A4A5A' }}>
                        {isMyFixture ? '⚽ VS' : isHumanMatch ? '👥 VS' : 'VS'}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                    <Crest crestId={allTeams.find(t => t.id === fixture.awayTeamId)?.crestId} name={awayName} size={22} />
                    <span className="font-semibold text-sm truncate lg:whitespace-normal lg:leading-tight lg:line-clamp-2" style={{ fontFamily: 'var(--font-game), sans-serif', color: awayColor }}>{awayName}</span>
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
                        return <div className="mt-2 text-center text-[12px] font-bold" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>🎯 palpite em andamento</div>;
                      }
                      const txt = myBet.tier === 'exact' ? `✅ Palpite: placar exato (+${myBet.payout})`
                        : myBet.tier === 'outcome' ? `✅ Palpite: resultado certo (+${myBet.payout})`
                          : myBet.tier === 'builder' ? `✅ Aposta certa (+${myBet.payout})`
                          : `❌ Palpite perdido (−${myBet.stake})${(myBet.protectionRefund ?? 0) > 0 ? ` · devolução +${myBet.protectionRefund}` : ''}`;
                      return <div className="mt-2 text-center text-[13px] font-black" style={{ color: myBet.won ? 'var(--ui-success)' : 'var(--ui-danger)', fontFamily: 'var(--font-game), sans-serif' }}>{txt}</div>;
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
                          className="px-3 py-1 rounded-lg text-[13px] font-black tracking-wider transition-transform hover:scale-[1.03]"
                          style={{ fontFamily: 'var(--font-game), sans-serif', background: myBet ? '#C9A84C22' : 'var(--ui-surface-1)', color: 'var(--ui-brand-strong)', border: '1px solid #C9A84C55' }}>
                          {myBet ? `🎯 ${myBet.market === 'builder' ? 'Aposta' : 'Palpite'}: ${describeBet(myBet)} · ${myBet.stake} (editar)` : '🎯 Palpitar'}
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
              <div className="mt-6 p-4 rounded-xl text-center border"
                style={{ background: 'var(--ui-surface-1)', borderColor: 'var(--ui-surface-3)' }}
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
                          ✅ PRONTO!
                        </button>
                      ) : (
                        <button onClick={handleReadyToggle}
                          className="w-full py-3 rounded-xl font-black text-lg tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98] mb-2"
                          style={{ fontFamily: 'var(--font-display), sans-serif', background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                          ✅ ESTOU PRONTO
                        </button>
                      ))}
                      {!isActiveLeagueParticipant && totalReady > 0 && (
                        <div className="mb-2 text-[13px] font-bold text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                          Você não disputa esta rodada; o anfitrião inicia quando os participantes confirmarem.
                        </div>
                      )}
                      {totalReady > 0 && (
                        <div className="mb-2 text-[13px] font-black tracking-widest" style={{ fontFamily: 'var(--font-game), sans-serif', color: allReady ? 'var(--ui-success)' : 'var(--ui-brand)' }}>
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
                        ▶ JOGAR RODADA {leagueRound}
                      </button>
                      <div className="mt-2 text-[13px] font-bold text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        {allReady
                          ? 'Todas as partidas começam ao mesmo tempo para todos.'
                          : 'Todos os participantes com partida precisam confirmar que estão prontos.'}
                      </div>
                    </>
                  ) : !allPlayersWatched ? (
                    <div className="py-3">
                      <div className="text-sm font-bold animate-pulse" style={{ fontFamily: 'var(--font-game), sans-serif', color: 'var(--ui-brand)' }}>
                        ⏳ AGUARDANDO {waitingForCount} JOGADOR{waitingForCount !== 1 ? 'ES' : ''} VEREM O RESULTADO...
                      </div>
                      <div className="mt-1 text-[13px] text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        ({humanPlayersWithMatch.length - waitingForCount}/{humanPlayersWithMatch.length} concluídos)
                      </div>
                    </div>
                  ) : leagueRound < leagueRounds ? (
                    <button
                      onClick={handleAdvanceRound}
                      className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                      style={{
                        fontFamily: 'var(--font-display), sans-serif',
                        background: 'linear-gradient(135deg, var(--ui-brand) 0%, var(--ui-brand-strong) 50%, var(--ui-brand) 100%)',
                        color: 'var(--ui-bg)',
                        boxShadow: '0 0 25px rgba(201,168,76,0.3)',
                      }}
                    >
                      AVANÇAR PARA A RODADA {leagueRound + 1} →
                    </button>
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
                      {isLeagueOnly ? '🏆 FINALIZAR COMPETIÇÃO →' : '🏆 AVANÇAR PARA O MATA-MATA →'}
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
                          ✅ PRONTO!
                        </button>
                      ) : (
                        <button onClick={handleReadyToggle}
                          className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98]"
                          style={{ fontFamily: 'var(--font-display), sans-serif', background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                          ✅ ESTOU PRONTO
                        </button>
                      )}
                      <div className="mt-2 text-[13px] font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#8A8A9A' }}>
                        {readyCount}/{totalReady} pronto{totalReady !== 1 ? 's' : ''} · o anfitrião inicia quando todos confirmarem.
                      </div>
                    </> : <>
                      {totalReady > 0 && (
                        <div className="mb-2 text-[13px] font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#8A8A9A' }}>
                          {readyCount}/{totalReady} participantes prontos.
                        </div>
                      )}
                      <div className="py-2 text-sm font-bold text-yellow-500/80" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        Você não disputa esta rodada. Aguardando o anfitrião iniciar.
                      </div>
                    </>
                  ) : (
                    <div className="py-2 text-sm font-bold text-green-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      👑 RODADA CONCLUÍDA! AGUARDANDO O ANFITRIÃO AVANÇAR...
                    </div>
                  )
                )}
                {state.advanceBlocked && state.advanceBlocked.length > 0 && (
                  <div className="mt-2 text-center text-[13px] font-bold text-yellow-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                    ⏳ Aguardando assistirem: {state.advanceBlocked.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6">
                {!isPlayerMatchPlayed ? (
                  /* Solo: o botão de JOGAR fica embaixo dos confrontos (igual ao host no online). */
                  <>
                    <button
                      onClick={handlePlayPlayerMatch}
                      className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                      style={{
                        fontFamily: 'var(--font-display), sans-serif',
                        background: 'linear-gradient(135deg, var(--ui-brand) 0%, var(--ui-brand-strong) 50%, var(--ui-brand) 100%)',
                        color: 'var(--ui-bg)',
                        boxShadow: '0 0 25px rgba(201,168,76,0.3)',
                      }}
                    >
                      ▶ JOGAR RODADA {leagueRound}
                    </button>
                  </>
                ) : leagueRound < leagueRounds ? (
                  <button
                    onClick={handleAdvanceRound}
                    className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all"
                    style={{
                      fontFamily: 'var(--font-display), sans-serif',
                      background: 'linear-gradient(135deg, var(--ui-brand) 0%, var(--ui-brand-strong) 50%, var(--ui-brand) 100%)',
                      color: 'var(--ui-bg)',
                      boxShadow: '0 0 25px rgba(201,168,76,0.3)',
                    }}
                  >
                    AVANÇAR PARA A RODADA {leagueRound + 1} →
                  </button>
                ) : (
                  <button
                    onClick={qualifies ? handleAdvanceKnockout : handleFinishEliminatedCampaign}
                    className="w-full py-4 rounded-xl font-black text-xl tracking-widest transition-all"
                    style={{
                      fontFamily: 'var(--font-display), sans-serif',
                      background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)',
                      color: '#000',
                      boxShadow: '0 0 25px rgba(34,197,94,0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    {qualifies
                      ? (isLeagueOnly ? '🏆 FINALIZAR COMPETIÇÃO →' : '🏆 AVANÇAR PARA O MATA-MATA →')
                      : '🏁 ENCERRAR CAMPANHA →'}
                  </button>
                )}
              </div>
            )}
          </div>
  );
}
