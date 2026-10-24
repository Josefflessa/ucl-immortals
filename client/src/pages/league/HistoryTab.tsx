import Crest from '../../components/game/Crest';
import { knockoutRoundLabel } from '@shared/game/gameEngine';
import { Tab, TabList, Tabs } from '../../design-system';
import type { LeagueHub } from './useLeagueHub';
import { ChevronRight, House, Lock, Plane, Search } from 'lucide-react';
import { INLINE_ICON } from '../../components/game/inlineIcon';
import type { KnockoutBracket, MatchResult } from '@shared/game/gameEngine';
import { sortMatchesForOnlineDisplay } from '@shared/game/onlineReadiness';
import MatchScoreLine from './MatchScoreLine';

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

function ScoreCapsule({ homeGoals, awayGoals }: { homeGoals: number; awayGoals: number }) {
  return (
    <span className="inline-flex overflow-hidden rounded-(--ui-radius-sm) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] font-display text-xl leading-none tabular-nums text-[var(--ui-text)]">
      <span className="min-w-8 px-2 py-1.5 text-center">{homeGoals}</span>
      <span aria-hidden="true" className="w-px bg-[var(--ui-line-subtle)]" />
      <span className="min-w-8 px-2 py-1.5 text-center">{awayGoals}</span>
    </span>
  );
}

type HistoryMatchCardProps = {
  label: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  homeCrestId?: string;
  awayCrestId?: string;
  homeGoals?: number;
  awayGoals?: number;
  hidden?: boolean;
  playerTeamId?: string;
  onOpenDetails?: () => void;
};

function HistoryMatchCard({
  label,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
  homeCrestId,
  awayCrestId,
  homeGoals,
  awayGoals,
  hidden = false,
  playerTeamId,
  onOpenDetails,
}: HistoryMatchCardProps) {
  const isPlayerMatch = homeTeamId === playerTeamId || awayTeamId === playerTeamId;
  const score = hidden
    ? <Lock size="1em" aria-label="Resultado oculto" className="inline-block text-[var(--ui-text-faint)]" />
    : typeof homeGoals === 'number' && typeof awayGoals === 'number'
      ? <ScoreCapsule homeGoals={homeGoals} awayGoals={awayGoals} />
      : <span className="text-xs font-bold text-[var(--ui-text-faint)]">—</span>;

  return (
    <div
      role={onOpenDetails ? 'button' : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      aria-label={onOpenDetails ? `${label}: ${homeName} ${homeGoals} a ${awayGoals} ${awayName}. Ver detalhes da partida` : undefined}
      onClick={onOpenDetails}
      onKeyDown={onOpenDetails ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetails();
        }
      } : undefined}
      className={`group/match relative rounded-(--ui-radius-lg) px-3 py-3 ${onOpenDetails ? 'cursor-pointer pr-7 transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-[var(--ui-focus)]' : ''}`}
      style={{
        background: isPlayerMatch ? 'linear-gradient(135deg, var(--ui-surface-2), #0b0b14)' : 'var(--ui-surface-1)',
        border: isPlayerMatch ? '1px solid var(--ui-brand-line)' : '1px solid var(--ui-line-subtle)',
        boxShadow: isPlayerMatch ? '0 0 15px rgba(201, 168, 76, 0.1)' : 'none',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-caption font-black tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
          {label}
        </span>
      </div>
      <MatchScoreLine
        homeName={homeName}
        awayName={awayName}
        homeCrestId={homeCrestId}
        awayCrestId={awayCrestId}
        homeColor={homeTeamId === playerTeamId ? 'var(--ui-brand-strong)' : 'var(--ui-text)'}
        awayColor={awayTeamId === playerTeamId ? 'var(--ui-brand-strong)' : 'var(--ui-text)'}
        score={score}
      />
      {onOpenDetails && <ChevronRight size={16} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)] transition-colors group-hover/match:text-[var(--ui-brand-strong)]" />}
    </div>
  );
}

export default function HistoryTab({ hub }: { hub: LeagueHub }) {
  const {
    state, resultsSubTab, setResultsSubTab, playerResults, playerTeam, getTeamName, getTeamById,
    openMatchDetails, historyPeriods, historyKey, setSelectedHistoryKey, historyPeriod, leagueRounds,
    historyFixtures, isKnockout, leagueRound, hideRoundScore, allTeams, historyKoTies, koAllWatched, localTeamId,
  } = hub;
  const { leagueFixtures } = state;
  const humanTeamIds = state.mode === 'online'
    ? new Set(state.onlinePlayers.map(player => player.id))
    : new Set<string>();
  const orderedHistoryFixtures = sortMatchesForOnlineDisplay(historyFixtures, humanTeamIds, localTeamId);
  const orderedHistoryKoTies = sortMatchesForOnlineDisplay(historyKoTies, humanTeamIds, localTeamId);
  const crestIdFor = (teamId: string) => allTeams.find(team => team.id === teamId)?.crestId;

  const openResultDetails = (result: MatchResult) => {
    const knockoutRound = findKnockoutRoundForResult(result, state.knockoutBracket);
    const fixture = knockoutRound ? undefined : findLeagueFixtureForResult(result, leagueFixtures);
    const resultWithRound = fixture ? { ...result, round: fixture.round } : result;
    openMatchDetails(resultWithRound, knockoutRound
      ? { isKnockout: true, isFinal: knockoutRound === 'final' }
      : undefined);
  };
  return (
          <div className="competition-live-reading space-y-3">
            {/* Sub-abas do HISTÓRICO */}
            <Tabs
              value={resultsSubTab}
              onValueChange={(value) => setResultsSubTab(value as typeof resultsSubTab)}
            >
              <TabList className="ui-tabs--split-mobile">
              {([['mine', 'MEUS JOGOS'], ['rounds', 'RODADAS ANTERIORES']] as const).map(([id, label]) => (
                <Tab key={id} value={id}>
                  {label}
                </Tab>
              ))}
              </TabList>
            </Tabs>

            {resultsSubTab === 'mine' ? (
            <div className="space-y-2">
            <div className="text-caption font-bold tracking-wide-caps mb-3"
              style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
              SEUS RESULTADOS ({playerResults.length} jogos disputados)
            </div>
            {playerResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--ui-text-muted)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                Nenhum jogo disputado ainda.
              </div>
            ) : (
              /* Desktop: two columns so each result row stays readable. */
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {playerResults.map((result, i) => {
                const isHome = result.homeTeamId === playerTeam?.id;
                const myGoals = isHome ? result.homeGoals : result.awayGoals;
                const oppGoals = isHome ? result.awayGoals : result.homeGoals;
                const oppTeamId = isHome ? result.awayTeamId : result.homeTeamId;
                const oppName = getTeamName(oppTeamId);
                const won = myGoals > oppGoals;
                const drew = myGoals === oppGoals;
                const resultColor = won ? '#22C55E' : drew ? '#EAB308' : '#EF4444';
                const oppCrest = getTeamById(oppTeamId)?.crestId;
                return (
                  <div
                    key={i}
                    className="relative flex flex-col gap-2 overflow-hidden rounded-xl py-3 pl-4 pr-3"
                    style={{ background: 'linear-gradient(135deg,#12121e,#0b0b14)', border: `1px solid ${resultColor}33` }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: resultColor }} />
                    <div className="text-caption font-black tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                      {historyMatchLabel(result, state.knockoutBracket, leagueFixtures)}
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-black"
                        style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 18, background: `${resultColor}1f`, color: resultColor, border: `1px solid ${resultColor}44` }}>
                        {won ? 'V' : drew ? 'E' : 'D'}
                      </div>
                      <Crest crestId={oppCrest} name={oppName} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="text-caption font-bold uppercase tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                          {isHome ? <><House {...INLINE_ICON} />Em casa</> : <><Plane {...INLINE_ICON} />Fora</>}
                        </div>
                        <div className="whitespace-normal break-words text-sm font-black leading-tight" style={{ color: 'var(--ui-text)', fontFamily: 'var(--font-game), sans-serif' }}>
                          {oppName}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="text-2xl font-black leading-none tabular-nums" style={{ fontFamily: 'var(--font-display), sans-serif', color: resultColor }}>
                          {myGoals} <span style={{ opacity: .5 }}>-</span> {oppGoals}
                        </div>
                        {result.playerStats && (
                          <button type="button" onClick={() => openResultDetails(result)}
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
                <div className="py-8 text-center text-xs text-[var(--ui-text-muted)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
                            border: `1px solid ${isActive ? '#C9A84C' : (p.kind === 'ko' ? '#6366f133' : 'var(--ui-surface-3)')}` }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-caption font-bold tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                    RESULTADOS · {historyPeriod?.kind === 'league' ? `RODADA ${historyPeriod.round} DE ${leagueRounds}` : knockoutRoundLabel(historyPeriod?.koRound ?? '')}
                  </div>

                  {historyPeriod?.kind === 'league' ? (
                    /* Jogos da rodada de liga escolhida */
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {orderedHistoryFixtures.map((fixture, idx) => {
                        const roundHidden = !isKnockout && historyPeriod.round === leagueRound && hideRoundScore;
                        const homeName = getTeamName(fixture.homeTeamId);
                        const awayName = getTeamName(fixture.awayTeamId);
                        const result = fixture.result;
                        return (
                          <HistoryMatchCard
                            key={idx}
                            label={`RODADA ${fixture.round}`}
                            homeTeamId={fixture.homeTeamId}
                            awayTeamId={fixture.awayTeamId}
                            homeName={homeName}
                            awayName={awayName}
                            homeCrestId={crestIdFor(fixture.homeTeamId)}
                            awayCrestId={crestIdFor(fixture.awayTeamId)}
                            homeGoals={fixture.played ? result?.homeGoals : undefined}
                            awayGoals={fixture.played ? result?.awayGoals : undefined}
                            hidden={roundHidden && fixture.played}
                            playerTeamId={playerTeam?.id}
                            onOpenDetails={result?.playerStats && !roundHidden
                              ? () => openMatchDetails({ ...result, round: fixture.round }, { isKnockout: false, isFinal: false })
                              : undefined}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    /* Um card por confronto, com agregado e as partidas de ida/volta dentro dele. */
                    <div className="space-y-2">
                      {orderedHistoryKoTies.map((tie: any, tieIndex: number) => {
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
                        return (
                          <div key={tie.id ?? tieIndex} className="space-y-2 rounded-xl p-3"
                            style={{ background: isPlayer ? 'linear-gradient(135deg,#14142a,#0b0b14)' : '#0F0F1A', border: `1px solid ${isPlayer ? '#c9a84c55' : 'var(--ui-surface-3)'}` }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-caption font-black tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                                {phase}
                              </div>
                              {!singleLeg && tie.result && !koRoundHidden && (
                                <div className="text-caption font-bold uppercase tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                                  AGREGADO
                                </div>
                              )}
                            </div>
                            {!singleLeg && tie.result && !koRoundHidden && (
                            <div className="border-b border-white/5 pb-2">
                              <MatchScoreLine
                                homeName={homeName}
                                awayName={awayName}
                                homeCrestId={crestIdFor(tie.homeTeamId)}
                                awayCrestId={crestIdFor(tie.awayTeamId)}
                                homeColor={tie.homeTeamId === playerTeam?.id ? 'var(--ui-brand-strong)' : 'var(--ui-text)'}
                                awayColor={tie.awayTeamId === playerTeam?.id ? 'var(--ui-brand-strong)' : 'var(--ui-text)'}
                                score={<ScoreCapsule homeGoals={tie.result.homeGoals} awayGoals={tie.result.awayGoals} />}
                              />
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
                                    <HistoryMatchCard
                                      key={label}
                                      label={`${phase} · ${label}`}
                                      homeTeamId={legHomeId}
                                      awayTeamId={legAwayId}
                                      homeName={legHomeName}
                                      awayName={legAwayName}
                                      homeCrestId={crestIdFor(legHomeId)}
                                      awayCrestId={crestIdFor(legAwayId)}
                                      homeGoals={result.homeGoals}
                                      awayGoals={result.awayGoals}
                                      hidden={koRoundHidden}
                                      playerTeamId={playerTeam?.id}
                                      onOpenDetails={!koRoundHidden && result.playerStats
                                        ? () => openMatchDetails(result, { isKnockout: true, isFinal: historyPeriod?.koRound === 'final' })
                                        : undefined}
                                    />
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
