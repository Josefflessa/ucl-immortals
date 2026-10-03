import Crest from '../../components/game/Crest';
import { knockoutRoundLabel } from '@shared/game/gameEngine';
import { Tab, TabList, Tabs } from '../../design-system';
import type { LeagueHub } from './useLeagueHub';

export default function HistoryTab({ hub }: { hub: LeagueHub }) {
  const {
    state, resultsSubTab, setResultsSubTab, playerResults, playerTeam, getTeamName, getTeamById,
    openMatchDetails, historyPeriods, historyKey, setSelectedHistoryKey, historyPeriod, leagueRounds,
    historyFixtures, isKnockout, leagueRound, hideRoundScore, allTeams, historyKoTies, koAllWatched,
  } = hub;
  return (
          <div className="space-y-3">
            {/* Sub-abas do HISTÓRICO */}
            <Tabs
              value={resultsSubTab}
              onValueChange={(value) => setResultsSubTab(value as typeof resultsSubTab)}
            >
              <TabList className="ui-tabs--split-mobile">
              {([['mine', 'MEUS JOGOS'], ['rounds', 'RODADAS ANTERIORES']] as const).map(([id, label]) => (
                <Tab key={id} value={id} className="text-xs">
                  {label}
                </Tab>
              ))}
              </TabList>
            </Tabs>

            {resultsSubTab === 'mine' ? (
            <div className="space-y-2">
            <div className="text-xs font-bold tracking-widest mb-3"
              style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
              SEUS RESULTADOS ({playerResults.length} jogos disputados)
            </div>
            {playerResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                Nenhum jogo disputado ainda.
              </div>
            ) : (
              /* Desktop: two columns so each result row stays readable. */
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {playerResults.map((result, i) => {
                const isHome = result.homeTeamId === playerTeam?.id;
                const myGoals = isHome ? result.homeGoals : result.awayGoals;
                const oppGoals = isHome ? result.awayGoals : result.homeGoals;
                const oppName = getTeamName(isHome ? result.awayTeamId : result.homeTeamId);
                const won = myGoals > oppGoals;
                const drew = myGoals === oppGoals;
                const rc = won ? '#22C55E' : drew ? '#EAB308' : '#EF4444';
                const oppCrest = getTeamById(isHome ? result.awayTeamId : result.homeTeamId)?.crestId;

                return (
                  <div
                    key={i}
                    className="relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,#12121e,#0b0b14)', border: `1px solid ${rc}33` }}
                  >
                    {/* barra de resultado */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: rc }} />
                    {/* V / E / D */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black flex-shrink-0"
                      style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 18, background: `${rc}1f`, color: rc, border: `1px solid ${rc}44` }}>
                      {won ? 'V' : drew ? 'E' : 'D'}
                    </div>
                    {/* escudo do adversário */}
                    <Crest crestId={oppCrest} name={oppName} size={30} />
                    {/* adversário + mando */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                        {isHome ? '🏠 Em casa' : '✈️ Fora'}
                      </div>
                      <div className="text-sm font-black truncate" style={{ color: '#FFFFFF', fontFamily: 'var(--font-game), sans-serif' }}>
                        {oppName}
                      </div>
                    </div>
                    {/* placar + detalhes */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-2xl font-black leading-none tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif', color: rc }}>
                        {myGoals} <span style={{ opacity: .5 }}>-</span> {oppGoals}
                      </div>
                      {result.playerStats && (
                        <button onClick={() => openMatchDetails(result)}
                          className="h-7 min-h-0 px-2 py-0.5 rounded-md text-[12px] font-black uppercase leading-none tracking-wider transition-all hover:brightness-125"
                          style={{ background: 'var(--ui-surface-2)', border: '1px solid var(--ui-line)', color: '#9AA8C8', fontFamily: 'var(--font-game), sans-serif' }}>
                          🔍 Detalhes
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
            </div>
            ) : (
            /* ─── RODADAS ANTERIORES: escolha a rodada e veja TODOS os resultados ─── */
            <div className="space-y-3">
              {historyPeriods.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  Nenhuma rodada disputada ainda.
                </div>
              ) : (
                <>
                  {/* Seletor de período: rodadas da liga + fases do mata-mata */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {historyPeriods.map(p => {
                      const isActive = p.key === historyKey;
                      return (
                        <button key={p.key} onClick={() => setSelectedHistoryKey(p.key)}
                          className="flex-shrink-0 h-9 px-2.5 rounded-lg text-sm font-black transition-all"
                          style={{ fontFamily: 'var(--font-display), sans-serif', minWidth: 36, letterSpacing: '.03em',
                            background: isActive ? '#C9A84C' : '#0F0F1A',
                            color: isActive ? '#080810' : (p.kind === 'ko' ? '#818CF8' : '#C9A84C'),
                            border: `1px solid ${isActive ? '#C9A84C' : (p.kind === 'ko' ? '#6366f133' : '#1A1A2A')}` }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs font-bold tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                    RESULTADOS · {historyPeriod?.kind === 'league' ? `RODADA ${historyPeriod.round} DE ${leagueRounds}` : knockoutRoundLabel(historyPeriod?.koRound ?? '')}
                  </div>

                  {historyPeriod?.kind === 'league' ? (
                    /* Jogos da rodada de liga escolhida */
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {historyFixtures.map((fixture, idx) => {
                        const roundHidden = !isKnockout && historyPeriod.round === leagueRound && hideRoundScore;
                        const homeName = getTeamName(fixture.homeTeamId);
                        const awayName = getTeamName(fixture.awayTeamId);
                        const isPlayer = fixture.homeTeamId === playerTeam?.id || fixture.awayTeamId === playerTeam?.id;
                        return (
                          <div key={idx} className="p-3 rounded-xl flex items-center justify-between"
                            style={{ background: isPlayer ? 'linear-gradient(135deg,#14142a,#0b0b14)' : '#0F0F1A', border: `1px solid ${isPlayer ? '#c9a84c55' : '#1A1A2A'}` }}>
                            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                              <span className="font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-game), sans-serif', color: fixture.homeTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{homeName}</span>
                              <Crest crestId={allTeams.find(t => t.id === fixture.homeTeamId)?.crestId} name={homeName} size={22} />
                            </div>
                            <div className="w-24 text-center flex flex-col items-center justify-center">
                              {fixture.played && fixture.result && !roundHidden ? (
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
                              ) : roundHidden && fixture.played ? (
                                <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#4A4A5A' }}>🔒</span>
                              ) : (
                                <span className="text-xs font-bold text-gray-600" style={{ fontFamily: 'var(--font-game), sans-serif' }}>—</span>
                              )}
                            </div>
                            <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                              <Crest crestId={allTeams.find(t => t.id === fixture.awayTeamId)?.crestId} name={awayName} size={22} />
                              <span className="font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-game), sans-serif', color: fixture.awayTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{awayName}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Confrontos do mata-mata (ida/volta ou jogo único) — agregado + detalhes de cada perna */
                    <div className="space-y-2">
                      {historyKoTies.map((tie: any, idx: number) => {
                        const koRoundHidden = state.mode === 'online' && historyPeriod?.koRound === state.knockoutBracket?.currentRound && !koAllWatched;
                        const homeName = getTeamName(tie.homeTeamId);
                        const awayName = getTeamName(tie.awayTeamId);
                        const isPlayer = tie.homeTeamId === playerTeam?.id || tie.awayTeamId === playerTeam?.id;
                        const single = !!tie.isSingleLeg;
                        const l1 = tie.leg1, l2 = tie.leg2;
                        const detBtn = 'px-2.5 py-1 rounded-md text-[12px] font-black uppercase tracking-wider transition-all hover:brightness-125';
                        const detStyle = { background: '#14142A', border: '1px solid #2A2A3A', color: '#9AA8C8', fontFamily: 'var(--font-game), sans-serif' } as const;
                        return (
                          <div key={idx} className="p-3 rounded-xl"
                            style={{ background: isPlayer ? 'linear-gradient(135deg,#14142a,#0b0b14)' : '#0F0F1A', border: `1px solid ${isPlayer ? '#c9a84c55' : '#1A1A2A'}` }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                                <span className="font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-game), sans-serif', color: tie.homeTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{homeName}</span>
                                <Crest crestId={allTeams.find(t => t.id === tie.homeTeamId)?.crestId} name={homeName} size={22} />
                              </div>
                              <div className="w-20 text-center">
                                {koRoundHidden ? (
                                  <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#4A4A5A' }}>🔒</span>
                                ) : tie.result ? (
                                  <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{tie.result.homeGoals} - {tie.result.awayGoals}</span>
                                ) : l1 ? (
                                  <span className="text-lg font-black tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>{l1.homeGoals} - {l1.awayGoals}</span>
                                ) : (
                                  <span className="text-sm font-bold text-gray-600" style={{ fontFamily: 'var(--font-game), sans-serif' }}>VS</span>
                                )}
                              </div>
                              <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                                <Crest crestId={allTeams.find(t => t.id === tie.awayTeamId)?.crestId} name={awayName} size={22} />
                                <span className="font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-game), sans-serif', color: tie.awayTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{awayName}</span>
                              </div>
                            </div>
                            {!koRoundHidden && (l1 || l2 || tie.result) && (
                              <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                                {single ? (
                                  tie.result?.playerStats && <button className={detBtn} style={detStyle} onClick={() => openMatchDetails(tie.result, { isKnockout: true, isFinal: historyPeriod?.koRound === 'final' })}>🔍 Detalhes</button>
                                ) : (
                                  <>
                                    {l1 && <button className={detBtn} style={detStyle} onClick={() => openMatchDetails(l1, { isKnockout: true, isFinal: historyPeriod?.koRound === 'final' })}>👁 Ida</button>}
                                    {l2 && <button className={detBtn} style={detStyle} onClick={() => openMatchDetails(l2, { isKnockout: true, isFinal: historyPeriod?.koRound === 'final' })}>👁 Volta</button>}
                                  </>
                                )}
                                {tie.result?.winner && (
                                  <span className="text-[12px] font-bold" style={{ color: 'var(--ui-success)', fontFamily: 'var(--font-game), sans-serif' }}>
                                    {getTeamName(tie.result.winner)} avança{tie.result.penaltyWinner ? ` · pên ${tie.result.homePenalties}-${tie.result.awayPenalties}` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            )}
          </div>
  );
}
