import Crest from '../../components/game/Crest';
import { knockoutRoundLabel } from '@shared/game/gameEngine';
import { Tab, TabList, Tabs } from '../../design-system';
import type { LeagueHub } from './useLeagueHub';
import { House, Lock, Plane, Search } from 'lucide-react';
import { INLINE_ICON } from '../../components/game/inlineIcon';
import type { KnockoutBracket, MatchResult } from '@shared/game/gameEngine';

const KNOCKOUT_HISTORY_ROUNDS = [
  ['playoffs', 'playoffs'],
  ['round16', 'round16'],
  ['quarters', 'quarterFinals'],
  ['semis', 'semiFinals'],
  ['final', 'final'],
] as const;

function sameMatchResult(a: MatchResult | undefined, b: MatchResult): boolean {
  return !!a
    && a.homeTeamId === b.homeTeamId
    && a.awayTeamId === b.awayTeamId
    && a.homeGoals === b.homeGoals
    && a.awayGoals === b.awayGoals;
}

function findLeagueFixtureForResult(result: MatchResult, fixtures: LeagueHub['state']['leagueFixtures']) {
  return fixtures.find(fixture => fixture.result === result)
    ?? fixtures.find(fixture => fixture.result && sameMatchResult(fixture.result, result));
}

function knockoutPhaseLabel(round: string, bracket: KnockoutBracket | null): string {
  return round === 'playoffs' ? 'PLAYOFF' : knockoutRoundLabel(round, bracket?.firstRoundSize);
}

function findKnockoutRoundForResult(result: MatchResult, bracket: KnockoutBracket | null): string | null {
  if (!bracket) return null;
  for (const [round, key] of KNOCKOUT_HISTORY_ROUNDS) {
    const source = bracket[key];
    const ties = Array.isArray(source) ? source : source ? [source] : [];
    if (ties.some(tie => tie.leg1 === result || tie.leg2 === result || (tie.isSingleLeg && tie.result === result))) {
      return round;
    }
  }
  return null;
}

function historyMatchLabel(
  result: MatchResult & { round?: number },
  bracket: KnockoutBracket | null,
  fixtures: LeagueHub['state']['leagueFixtures'],
): string {
  if (typeof result.round === 'number') return `RODADA ${result.round}`;

  const knockoutRound = findKnockoutRoundForResult(result, bracket);
  if (knockoutRound) {
    const roundKey = KNOCKOUT_HISTORY_ROUNDS.find(([round]) => round === knockoutRound)?.[1];
    const source = roundKey ? bracket?.[roundKey] : null;
    const ties = Array.isArray(source) ? source : source ? [source] : [];
    const tie = ties.find(candidate => candidate.leg1 === result || candidate.leg2 === result || (candidate.isSingleLeg && candidate.result === result));
    const leg = tie?.leg1 === result ? 'IDA' : tie?.leg2 === result ? 'VOLTA' : 'JOGO ÚNICO';
    return `${knockoutPhaseLabel(knockoutRound, bracket)} · ${leg}`;
  }

  const fixture = findLeagueFixtureForResult(result, fixtures);
  if (fixture) return `RODADA ${fixture.round}`;
  return 'PARTIDA';
}

export default function HistoryTab({ hub }: { hub: LeagueHub }) {
  const {
    state, resultsSubTab, setResultsSubTab, playerResults, playerTeam, getTeamName, getTeamById,
    openMatchDetails, historyPeriods, historyKey, setSelectedHistoryKey, historyPeriod, leagueRounds,
    historyFixtures, isKnockout, leagueRound, hideRoundScore, allTeams, historyKoTies, koAllWatched,
  } = hub;
  const { leagueFixtures } = state;
  return (
          <div className="competition-live-reading space-y-3">
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
                    className="relative flex flex-col gap-2 pl-4 pr-3 py-3 rounded-xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,#12121e,#0b0b14)', border: `1px solid ${rc}33` }}
                  >
                    {/* barra de resultado */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: rc }} />
                    <div className="text-[12px] font-black tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                      {historyMatchLabel(result, state.knockoutBracket, leagueFixtures)}
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      {/* V / E / D */}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black flex-shrink-0"
                        style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 18, background: `${rc}1f`, color: rc, border: `1px solid ${rc}44` }}>
                        {won ? 'V' : drew ? 'E' : 'D'}
                      </div>
                      <Crest crestId={oppCrest} name={oppName} size={30} />
                      {/* adversário + mando */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                          {isHome ? <><House {...INLINE_ICON} />Em casa</> : <><Plane {...INLINE_ICON} />Fora</>}
                        </div>
                        <div className="whitespace-normal break-words text-sm font-black leading-tight" style={{ color: '#FFFFFF', fontFamily: 'var(--font-game), sans-serif' }}>
                          {oppName}
                        </div>
                      </div>
                      {/* placar + detalhes */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="text-2xl font-black leading-none tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif', color: rc }}>
                          {myGoals} <span style={{ opacity: .5 }}>-</span> {oppGoals}
                        </div>
                        {result.playerStats && (
                          <button type="button" onClick={() => {
                            const knockoutRound = findKnockoutRoundForResult(result, state.knockoutBracket);
                            const fixture = knockoutRound ? undefined : findLeagueFixtureForResult(result, leagueFixtures);
                            const resultWithRound = fixture ? { ...result, round: fixture.round } : result;
                            openMatchDetails(resultWithRound, knockoutRound
                              ? { isKnockout: true, isFinal: knockoutRound === 'final' }
                              : undefined);
                          }}
                            className="inline-flex h-8 min-h-0 min-w-[92px] shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-black uppercase leading-none tracking-wider transition-all hover:brightness-125"
                            style={{ background: 'var(--ui-surface-2)', border: '1px solid var(--ui-line)', color: '#9AA8C8', fontFamily: 'var(--font-game), sans-serif' }}>
                            <Search {...INLINE_ICON} />Detalhes
                          </button>
                        )}
                      </div>
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
                          <div key={idx} className="rounded-xl p-3"
                            style={{ background: isPlayer ? 'linear-gradient(135deg,#14142a,#0b0b14)' : '#0F0F1A', border: `1px solid ${isPlayer ? '#c9a84c55' : '#1A1A2A'}` }}>
                            <div className="mb-2 text-center text-[12px] font-black tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                              RODADA {fixture.round}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                              <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: fixture.homeTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{homeName}</span>
                              <Crest crestId={allTeams.find(t => t.id === fixture.homeTeamId)?.crestId} name={homeName} size={22} />
                            </div>
                              <div className="flex w-28 flex-col items-center justify-center text-center md:w-32">
                              {fixture.played && fixture.result && !roundHidden ? (
                                <>
                                  <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                                    {fixture.result.homeGoals} - {fixture.result.awayGoals}
                                  </span>
                                  {fixture.result.playerStats && (
                                    <button type="button" onClick={() => openMatchDetails({ ...fixture.result!, round: fixture.round }, { isKnockout: false, isFinal: false })}
                                      className="mt-1 inline-flex h-8 min-h-0 min-w-[92px] items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-black uppercase leading-none tracking-wider transition-all hover:brightness-125 md:min-w-[120px]"
                                      style={{ background: 'var(--ui-surface-2)', border: '1px solid var(--ui-line)', color: '#9AA8C8', fontFamily: 'var(--font-game), sans-serif' }}>
                                      <Search {...INLINE_ICON} />Detalhes
                                    </button>
                                  )}
                                </>
                              ) : roundHidden && fixture.played ? (
                                <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#4A4A5A' }}><Lock size="1em" strokeWidth={2.5} aria-label="Resultado oculto" className="inline-block" /></span>
                              ) : (
                                <span className="text-xs font-bold text-gray-600" style={{ fontFamily: 'var(--font-game), sans-serif' }}>—</span>
                              )}
                            </div>
                            <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                              <Crest crestId={allTeams.find(t => t.id === fixture.awayTeamId)?.crestId} name={awayName} size={22} />
                              <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: fixture.awayTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{awayName}</span>
                            </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Um card por confronto, com agregado e as partidas de ida/volta dentro dele. */
                    <div className="space-y-2">
                      {historyKoTies.map((tie: any, tieIndex: number) => {
                        const koRoundHidden = state.mode === 'online' && historyPeriod?.koRound === state.knockoutBracket?.currentRound && !koAllWatched;
                        const isPlayer = tie.homeTeamId === playerTeam?.id || tie.awayTeamId === playerTeam?.id;
                        const phase = knockoutPhaseLabel(historyPeriod?.koRound ?? '', state.knockoutBracket);
                        const singleLeg = tie.isSingleLeg || (!tie.leg1 && !tie.leg2 && !!tie.result);
                        const legs = singleLeg
                          ? (tie.result ? [{ result: tie.result, label: 'JOGO ÚNICO' }] : [])
                          : [
                              ...(tie.leg1 ? [{ result: tie.leg1, label: 'IDA' }] : []),
                              ...(tie.leg2 ? [{ result: tie.leg2, label: 'VOLTA' }] : []),
                            ];
                        const homeName = getTeamName(tie.homeTeamId);
                        const awayName = getTeamName(tie.awayTeamId);
                        const detailButtonClass = 'inline-flex h-7 min-h-0 w-28 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 py-1 text-[12px] font-black uppercase leading-none tracking-wider transition-all hover:brightness-125';
                        const detStyle = { background: '#14142A', border: '1px solid #2A2A3A', color: '#9AA8C8', fontFamily: 'var(--font-game), sans-serif' } as const;
                        return (
                          <div key={tie.id ?? tieIndex} className="space-y-2 rounded-xl p-3"
                            style={{ background: isPlayer ? 'linear-gradient(135deg,#14142a,#0b0b14)' : '#0F0F1A', border: `1px solid ${isPlayer ? '#c9a84c55' : '#1A1A2A'}` }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-black tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                                {phase}
                              </div>
                              {!singleLeg && tie.result && !koRoundHidden && (
                                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                                  AGREGADO
                                </div>
                              )}
                            </div>
                            {!singleLeg && tie.result && !koRoundHidden && (
                            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                              <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                                <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: tie.homeTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{homeName}</span>
                                <Crest crestId={allTeams.find(t => t.id === tie.homeTeamId)?.crestId} name={homeName} size={22} />
                              </div>
                              <div className="text-center">
                                <span className="text-xl font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{tie.result.homeGoals} - {tie.result.awayGoals}</span>
                              </div>
                              <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                                <Crest crestId={allTeams.find(t => t.id === tie.awayTeamId)?.crestId} name={awayName} size={22} />
                                <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: tie.awayTeamId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{awayName}</span>
                              </div>
                            </div>
                            )}
                            {legs.length > 0 && (
                              <div className="space-y-2">
                                {legs.map(({ result, label }: { result: MatchResult; label: string }) => {
                                  const legHomeId = result.homeTeamId;
                                  const legAwayId = result.awayTeamId;
                                  const legHomeName = getTeamName(legHomeId);
                                  const legAwayName = getTeamName(legAwayId);
                                  return (
                                    <div key={label} className="rounded-xl p-2.5" style={{ background: '#0B0B14', border: '1px solid #171725' }}>
                                      <div className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                                        {phase} · {label}
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                                          <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: legHomeId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{legHomeName}</span>
                                          <Crest crestId={allTeams.find(t => t.id === legHomeId)?.crestId} name={legHomeName} size={20} />
                                        </div>
                                        <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 sm:w-32">
                                          {koRoundHidden ? (
                                            <span className="text-xs text-gray-600"><Lock size="1em" strokeWidth={2.5} aria-label="Resultado oculto" className="inline-block" /></span>
                                          ) : (
                                            <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{result.homeGoals} - {result.awayGoals}</span>
                                          )}
                                          {!koRoundHidden && result.playerStats && (
                                            <button type="button" title={`Detalhes: ${phase.toLowerCase()} · ${label.toLowerCase()}`} aria-label={`Ver detalhes de ${phase.toLowerCase()} - ${label.toLowerCase()}`} className={detailButtonClass} style={detStyle}
                                              onClick={() => openMatchDetails(result, { isKnockout: true, isFinal: historyPeriod?.koRound === 'final' })}>
                                              <Search {...INLINE_ICON} />Detalhes
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
                                          <Crest crestId={allTeams.find(t => t.id === legAwayId)?.crestId} name={legAwayName} size={20} />
                                          <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: legAwayId === playerTeam?.id ? 'var(--ui-brand)' : '#FFF' }}>{legAwayName}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {!koRoundHidden && tie.result?.winner && (
                              <div className="break-words text-center text-[12px] font-bold leading-tight" style={{ color: 'var(--ui-success)', fontFamily: 'var(--font-game), sans-serif' }}>
                                {historyPeriod?.koRound === 'final'
                                  ? `${getTeamName(tie.result.winner)} é campeão`
                                  : `${getTeamName(tie.result.winner)} avança`}
                                {tie.result.penaltyWinner ? ` · pên ${tie.result.homePenalties}-${tie.result.awayPenalties}` : ''}
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
