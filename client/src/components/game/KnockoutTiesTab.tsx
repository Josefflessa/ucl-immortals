// UCL Immortals — Knockout CONFRONTOS tab
// The bracket ties + ida/volta leg controls (with online watch-gating) + result
// modal, hosted as a tab of the season hub (LeaguePage).

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, KnockoutMatch } from '../../contexts/GameContext';
import { useTeams } from '../../hooks/useTeams';
import { MAX_RESERVE_PLAYERS, MatchResult, Team, getActiveKnockoutMatches, knockoutRoundLabel, reservePlayerCount } from '@shared/game/gameEngine';
import MatchDetailsModal from './MatchDetailsModal';
import Crest from './Crest';
import BetSlipModal, { type BetSlipSubmission } from './BetSlipModal';
import { buildKnockoutMatchKey, describeBet, roundStakeUsed, BET_ROUND_CAP, Bet, bettingPayoutRulesForLevel } from '@shared/game/bets';
import { bettingStakeCapBonus, projectLevel } from '@shared/game/clubProjects';
import { unavailableStarters } from '@shared/game/discipline';
import { getOnlineKnockoutParticipantIds, getReadinessStatus, isOnlineHumanMatch, sortMatchesForOnlineDisplay } from '@shared/game/onlineReadiness';
import { GameModal } from '../../design-system';

export default function KnockoutTiesTab() {
  const { state, dispatch, playKnockoutRoundOnline, advanceKnockoutRoundOnline, getTeamById, shopPlaceBetOnline, shopCancelBetOnline, playerReadyOnline, playerUnreadyOnline } = useGame();
  const { knockoutBracket, playerTeam } = state;
  const online = state.mode === 'online';
  const { allTeams, localTeamId, getTeamName: resolveTeamName } = useTeams();
  const [betSlip, setBetSlip] = useState<{
    matchKey: string;
    homeName: string;
    awayName: string;
    homeTeamId?: string;
    awayTeamId?: string;
  } | null>(null);
  const [lineupWarning, setLineupWarning] = useState<{ kind: 'discipline' | 'reserve'; names: string[] } | null>(null); // 🚫 aviso de escalação inválida
  // 🎯 Palpite — POR JOGO: cada partida do mata-mata tem o seu próprio teto (BET_ROUND_CAP), então dá
  // pra apostar em cada jogo (ida E volta) de forma independente, sem um travar o outro.
  const bets = state.bets ?? [];
  const betFor = (matchKey: string): Bet | undefined => bets.find(b => b.matchKey === matchKey);
  const [viewingResult, setViewingResult] = useState<{
    result: MatchResult;
    homeTeam?: Team;
    awayTeam?: Team;
    homeName: string;
    awayName: string;
    subtitle?: string;
  } | null>(null);

  // NOTE: the leg-by-leg auto-open-replay effect lives in the season hub (LeaguePage),
  // not here, so it keeps firing while the player is on another tab.

  if (!knockoutBracket) return null;

  // Unknown ids show "TBD" (knockout slots not yet decided).
  const getTeamName = (teamId: string) => resolveTeamName(teamId, 'TBD');

  const isPlayerTeam = (teamId: string) =>
    teamId === playerTeam?.id ||
    teamId === localTeamId ||
    (state.mode === 'online' && state.onlinePlayers.some(p => p.id === teamId && p.socketId === state.socketId));

  // Solo: the player drives progression locally. Online: only the host does.
  const canControl = state.mode !== 'online' || state.isHost;
  const currentLeg = knockoutBracket.currentLeg;

  const handlePlayLeg = () => {
    if (state.mode === 'online') {
      if (!allReadyKO) return; // host inicia só quando os participantes confirmam
      playKnockoutRoundOnline();
    } else {
      if (reserveLimitExceededKO) { setLineupWarning({ kind: 'reserve', names: [] }); return; }
      if (myUnavailableKO.length > 0) { setLineupWarning({ kind: 'discipline', names: myUnavailableKO.map(u => u.shortName ?? '?') }); return; }
      dispatch({ type: 'PLAY_KNOCKOUT_LEG' });
    }
  };
  // ✅ Não-host confirma pronto (só com escalação válida).
  const handleReadyToggleKO = () => {
    if (!iPlayThisRound) return;
    if (iAmReadyKO) { playerUnreadyOnline(); return; }
    if (reserveLimitExceededKO) { setLineupWarning({ kind: 'reserve', names: [] }); return; }
    if (myUnavailableKO.length > 0) { setLineupWarning({ kind: 'discipline', names: myUnavailableKO.map(u => u.shortName ?? '?') }); return; }
    playerReadyOnline();
  };
  const handleAdvance = () => {
    if (state.mode === 'online') advanceKnockoutRoundOnline();
    else dispatch({ type: 'ADVANCE_KNOCKOUT' });
  };

  const onlineHumanTeamIds = online
    ? new Set(state.onlinePlayers.map(player => player.id))
    : new Set<string>();
  const matches = sortMatchesForOnlineDisplay(
    getActiveKnockoutMatches(knockoutBracket) as KnockoutMatch[],
    onlineHumanTeamIds,
    localTeamId,
  );

  const round = knockoutBracket.currentRound;

  // 🟥🩹 Escalação: bloqueia jogar a perna com titular indisponível (sem troca automática).
  const iPlayThisRound = matches.some(m => isPlayerTeam(m.homeTeamId) || isPlayerTeam(m.awayTeamId));
  const myUnavailableKO = (playerTeam && iPlayThisRound) ? unavailableStarters(playerTeam, state.discipline) : [];
  const reserveCountKO = playerTeam ? reservePlayerCount(playerTeam) : 0;
  const reserveLimitExceededKO = reserveCountKO > MAX_RESERVE_PLAYERS;
  // ✅ Ready-check: only connected humans in an active tie participate. A host
  // who has no tie can still control the room without confirming readiness.
  const readySet = new Set(state.onlineReadyPlayers);
  const koParticipantIds = state.mode === 'online'
    ? getOnlineKnockoutParticipantIds(state.onlinePlayers, matches)
    : [];
  const iAmReadyKO = iPlayThisRound && !!localTeamId && readySet.has(localTeamId);
  const koReadyStatus = getReadinessStatus(state.onlineReadyPlayers, koParticipantIds);
  const { total: totalReadyKO, readyCount: readyCountKO, allReady: allReadyKO } = koReadyStatus;

  // SPECTATOR: a player with no tie in this round (eliminated / didn't qualify) can
  // watch any other human's match as a live broadcast. Their watch doesn't gate anyone.
  const iAmSpectator = state.mode === 'online' && matches.length > 0 &&
    !matches.some(m => isPlayerTeam(m.homeTeamId) || isPlayerTeam(m.awayTeamId));

  const spectateLeg = (match: KnockoutMatch, leg: 0 | 1 | 2) => {
    const teamA = getTeamById(match.homeTeamId); // first-leg home
    const teamB = getTeamById(match.awayTeamId); // first-leg away
    if (!teamA || !teamB) return;
    if (leg === 0 && match.result) {
      dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [teamA, teamB], result: match.result, knockout: { matchId: match.id, round }, spectator: true });
    } else if (leg === 1 && match.leg1) {
      dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [teamA, teamB], result: match.leg1, knockout: { matchId: match.id, round, leg: 1 }, spectator: true });
    } else if (leg === 2 && match.leg2) {
      dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [teamB, teamA], result: match.leg2, knockout: { matchId: match.id, round, leg: 2, firstLeg: { home: match.leg1?.awayGoals ?? 0, away: match.leg1?.homeGoals ?? 0 } }, spectator: true });
    }
  };
  const label = knockoutRoundLabel(round, knockoutBracket.firstRoundSize);
  const allPlayed = matches.length > 0 && matches.every(m => m.played);
  const isFinal = round === 'final';
  const isFinalSingleLeg = isFinal && matches.every(m => m.isSingleLeg === true);
  // After the IDA is played the bracket bumps currentLeg to 2, but the ties aren't
  // resolved yet (allPlayed=false). This in-between state must ALSO gate on everyone
  // watching the ida before the host can fire the volta — otherwise the ida spoils.
  const idaPlayed = currentLeg === 2 && !allPlayed;

  // Online: gate advance button until all human players in this round have watched their tie.
  // Só jogadores CONECTADOS contam (igual o servidor em knockoutWatchStatus) — um jogador
  // que caiu não pode travar o gate "todos assistiram" pra sempre (esconderia placar/badge de todos).
  const humanPlayersInBracket = state.mode === 'online'
    ? state.onlinePlayers.filter(p => p.connected && matches.some(m => m.homeTeamId === p.id || m.awayTeamId === p.id))
    : [];
  const allPlayersWatched = state.mode !== 'online' || humanPlayersInBracket.length === 0 ||
    humanPlayersInBracket.every(p => state.onlineWatchedPlayers.includes(p.id));
  const knockoutWaitingCount = humanPlayersInBracket.filter(p => !state.onlineWatchedPlayers.includes(p.id)).length;
  const playLabel = isFinalSingleLeg
    ? `▶ JOGAR ${label}`
    : currentLeg === 1
      ? `▶ JOGAR IDA — ${label}`
      : `▶ JOGAR VOLTA — ${label}`;
  // Gate label: which leg everyone is still watching (ida between legs, else volta).
  const waitingLegLabel = idaPlayed ? 'A IDA' : 'O RESULTADO';
  const waitingBlock = (
    <div className="py-3">
      <div className="text-sm font-bold animate-pulse" style={{ fontFamily: 'var(--font-game), sans-serif', color: 'var(--ui-brand)' }}>
        ⏳ AGUARDANDO {knockoutWaitingCount} JOGADOR{knockoutWaitingCount !== 1 ? 'ES' : ''} ASSISTIREM {waitingLegLabel}...
      </div>
      <div className="mt-1 text-[13px] text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
        ({humanPlayersInBracket.length - knockoutWaitingCount}/{humanPlayersInBracket.length} concluídos)
      </div>
    </div>
  );

  return (
    <>
        {/* Confrontos da fase atual */}
        {/* Desktop: ties in two columns; your own tie keeps the full width. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {matches.map((match, i) => {
            const homeName = getTeamName(match.homeTeamId);
            const awayName = getTeamName(match.awayTeamId);
            const homeCrestId = allTeams.find(team => team.id === match.homeTeamId)?.crestId;
            const awayCrestId = allTeams.find(team => team.id === match.awayTeamId)?.crestId;
            const homeIsPlayer = isPlayerTeam(match.homeTeamId);
            const awayIsPlayer = isPlayerTeam(match.awayTeamId);
            const hasPlayer = homeIsPlayer || awayIsPlayer;
            const hasHumanMatch = online && isOnlineHumanMatch(match, onlineHumanTeamIds);
            const homeIsHuman = onlineHumanTeamIds.has(match.homeTeamId);
            const awayIsHuman = onlineHumanTeamIds.has(match.awayTeamId);
            const twoLeg = match.isSingleLeg !== true;
            const l1 = match.leg1;
            const l2 = match.leg2;
            const watched = state.watchedKnockoutMatches;
            // Não revela o placar da perna própria antes do jogador assistir. SÓ no SOLO:
            // `watchedKnockoutMatches` é local do cliente e se perde num refresh/reconexão, o que
            // re-escondia placar/badge de confrontos já resolvidos. No ONLINE isso é redundante —
            // o `hideAllScores` (sincronizado pelo servidor) já cobre, e sobrevive ao refresh.
            const hideMyScore = state.mode !== 'online' && hasPlayer && (
              twoLeg
                ? (!!l2 && !watched.includes(`${match.id}_l2`)) || (!!l1 && !watched.includes(`${match.id}_l1`))
                : (match.played && !!match.result && !watched.includes(match.id))
            );
            // In online mode hide ALL tie scores until every player has confirmed
            // watching — both after the volta (allPlayed) AND after the ida (idaPlayed).
            const hideAllScores = state.mode === 'online' && !allPlayersWatched && (allPlayed || idaPlayed);
            const hideScore = hideAllScores || hideMyScore;

            return (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={hasPlayer ? "rounded-2xl overflow-hidden lg:col-span-2" : "rounded-2xl overflow-hidden"}
                style={{
                  background: '#0F0F1A',
                  border: `1px solid ${hasPlayer ? '#C9A84C44' : hasHumanMatch ? '#6366F155' : '#1A1A2A'}`,
                  boxShadow: hasPlayer
                    ? '0 0 20px rgba(201,168,76,0.1)'
                    : hasHumanMatch ? '0 0 20px rgba(99,102,241,0.1)' : 'none',
                }}
              >
                {/* Match header */}
                {(hasPlayer || hasHumanMatch) && (
                  <div className="px-4 py-1.5 text-xs font-bold tracking-widest text-center"
                    style={{
                      background: hasPlayer ? '#C9A84C22' : '#6366F122',
                      color: hasPlayer ? 'var(--ui-brand)' : '#A5B4FC',
                      fontFamily: 'var(--font-game), sans-serif',
                    }}>
                    {hasPlayer ? '⭐ SEU TIME' : '👥 PARTIDA DE JOGADORES'}
                  </div>
                )}
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Home team */}
                    <div className={`flex-1 text-right min-w-0 ${homeIsPlayer ? 'text-yellow-400' : ''}`}>
                      <div className="text-sm sm:text-lg font-black leading-tight truncate"
                        style={{
                          fontFamily: 'var(--font-display), sans-serif',
                          color: homeIsPlayer ? 'var(--ui-brand)' : homeIsHuman ? '#A5B4FC' : '#FFFFFF',
                        }}>
                        {homeName}
                      </div>
                    </div>
                    <Crest crestId={homeCrestId} name={homeName} size={26} />

                    {/* Score / VS */}
                    <div className="flex-shrink-0 w-24 sm:w-36 text-center">
                      {hideScore ? (
                        <div className="text-sm font-black animate-pulse" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>
                          ⚽ AO VIVO
                        </div>
                      ) : twoLeg ? (
                        !l1 ? (
                          <div className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#555' }}>VS</div>
                        ) : !l2 || !match.result ? (
                          <div>
                            <div className="inline-block text-[12px] font-black tracking-widest text-indigo-300 rounded px-2 py-0.5 mb-0.5" style={{ fontFamily: 'var(--font-game), sans-serif', background: '#4338CA33', border: '1px solid #4338CA66' }}>JOGO DE IDA</div>
                            <div className="text-3xl sm:text-4xl font-black leading-none" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>
                              {l1.homeGoals} - {l1.awayGoals}
                            </div>
                            <div className="text-[12px] sm:text-[12px] font-bold text-gray-400 mt-0.5" style={{ fontFamily: 'var(--font-game), sans-serif' }}>⏳ aguardando a volta</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-[12px] font-black tracking-[0.2em] text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>AGREGADO</div>
                            <div className="text-3xl sm:text-4xl font-black leading-none" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>
                              {match.result.homeGoals} - {match.result.awayGoals}
                            </div>
                          </div>
                        )
                      ) : match.played && match.result ? (
                        <div>
                          <div className="text-2xl sm:text-3xl font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>
                            {match.result.homeGoals} - {match.result.awayGoals}
                          </div>
                          {match.result.penaltyWinner && (
                            <div className="text-[12px] sm:text-xs" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                              ({match.result.homePenalties}-{match.result.awayPenalties} pen)
                            </div>
                          )}
                          <div className="text-[12px] sm:text-xs mt-1 font-bold" style={{ color: 'var(--ui-success)', fontFamily: 'var(--font-game), sans-serif' }}>
                            {getTeamName(match.result.winner!)} avança
                          </div>
                        </div>
                      ) : (
                        <div className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#555' }}>
                          VS
                        </div>
                      )}
                    </div>

                    {/* Away team */}
                    <Crest crestId={awayCrestId} name={awayName} size={26} />
                    <div className={`flex-1 min-w-0 ${awayIsPlayer ? 'text-yellow-400' : ''}`}>
                      <div className="text-sm sm:text-lg font-black leading-tight truncate"
                        style={{
                          fontFamily: 'var(--font-display), sans-serif',
                          color: awayIsPlayer ? 'var(--ui-brand)' : awayIsHuman ? '#A5B4FC' : '#FFFFFF',
                        }}>
                        {awayName}
                      </div>
                    </div>
                  </div>

                  {twoLeg && l1 && l2 && match.result && !hideScore && (() => {
                    const legs = [
                      { key: 'ida', label: 'IDA', home: { crestId: homeCrestId, name: homeName }, away: { crestId: awayCrestId, name: awayName }, h: l1.homeGoals, a: l1.awayGoals, color: '#A5B4FC', bg: '#4338CA1F', border: '#4338CA55' },
                      { key: 'volta', label: 'VOLTA', home: { crestId: awayCrestId, name: awayName }, away: { crestId: homeCrestId, name: homeName }, h: l2.homeGoals, a: l2.awayGoals, color: '#5EEAD4', bg: '#0D94881F', border: '#14B8A655' },
                    ];
                    const scoreStyle = (mine: number, theirs: number) => ({ fontFamily: 'var(--font-display), sans-serif', color: mine > theirs ? '#FFFFFF' : '#8A8A9A' });
                    return (
                      <div className="mx-auto mt-3 w-full max-w-[280px] space-y-1.5" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        {legs.map(leg => (
                          <div key={leg.key} className="grid grid-cols-[52px_minmax(0,1fr)] items-center rounded-lg px-2.5 py-1.5" style={{ background: leg.bg, border: `1px solid ${leg.border}` }}>
                            <span className="text-[12px] font-black tracking-widest" style={{ color: leg.color }}>{leg.label}</span>
                            <span className="flex items-center justify-center gap-2.5">
                              <Crest crestId={leg.home.crestId} name={leg.home.name} size={20} />
                              <span className="text-lg font-black leading-none tabular-nums" style={scoreStyle(leg.h, leg.a)}>{leg.h}</span>
                              <span className="text-sm font-black text-[var(--ui-text-faint)]">×</span>
                              <span className="text-lg font-black leading-none tabular-nums" style={scoreStyle(leg.a, leg.h)}>{leg.a}</span>
                              <Crest crestId={leg.away.crestId} name={leg.away.name} size={20} />
                            </span>
                          </div>
                        ))}
                        {match.result.penaltyWinner && (
                          <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center rounded-lg px-2.5 py-1.5" style={{ background: '#78350F1F', border: '1px solid #B4530955' }}>
                            <span className="text-[12px] font-black tracking-widest" style={{ color: '#FBBF24' }}>PÊN.</span>
                            <span className="flex items-center justify-center gap-2.5">
                              <Crest crestId={homeCrestId} name={homeName} size={20} />
                              <span className="text-lg font-black leading-none tabular-nums" style={scoreStyle(match.result.homePenalties ?? 0, match.result.awayPenalties ?? 0)}>{match.result.homePenalties}</span>
                              <span className="text-sm font-black text-[var(--ui-text-faint)]">×</span>
                              <span className="text-lg font-black leading-none tabular-nums" style={scoreStyle(match.result.awayPenalties ?? 0, match.result.homePenalties ?? 0)}>{match.result.awayPenalties}</span>
                              <Crest crestId={awayCrestId} name={awayName} size={20} />
                            </span>
                          </div>
                        )}
                        <div className="pt-0.5 text-center text-[12px] font-bold" style={{ color: 'var(--ui-success)' }}>
                          ✓ {getTeamName(match.result.winner!)} avança
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action buttons */}
                  <div className="mt-2 mb-4 flex gap-2 sm:gap-3 justify-center flex-wrap">
                    {iAmSpectator ? (
                      // Spectator (eliminated): watch any human's match as a live broadcast.
                      (() => {
                        const specBtn = "px-3 sm:px-4 py-2 rounded-lg text-xs font-black tracking-wider transition-all hover:scale-[1.03]";
                        const specStyle = { background: 'linear-gradient(135deg, #4338CA, #6366F1)', color: '#fff', fontFamily: 'var(--font-game), sans-serif', boxShadow: '0 0 14px rgba(99,102,241,0.25)' };
                        if (twoLeg) {
                          if (!l1 && !l2) return <span className="px-4 py-2 text-xs font-bold text-gray-600" style={{ fontFamily: 'var(--font-game), sans-serif' }}>AGUARDANDO JOGO</span>;
                          return (
                            <>
                              {l1 && <button onClick={() => spectateLeg(match, 1)} className={specBtn} style={specStyle}>👁 ASSISTIR IDA</button>}
                              {l2 && <button onClick={() => spectateLeg(match, 2)} className={specBtn} style={specStyle}>👁 ASSISTIR VOLTA</button>}
                            </>
                          );
                        }
                        return match.result
                          ? <button onClick={() => spectateLeg(match, 0)} className={specBtn} style={specStyle}>👁 ASSISTIR JOGO</button>
                          : <span className="px-4 py-2 text-xs font-bold text-gray-600" style={{ fontFamily: 'var(--font-game), sans-serif' }}>AGUARDANDO JOGO</span>;
                      })()
                    ) : hideScore ? (
                      <span className="px-4 py-2 text-xs font-bold animate-pulse" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>
                        {hideMyScore ? '⚽ ABRINDO SEU CONFRONTO...' : '⏳ AGUARDANDO TODOS ASSISTIREM...'}
                      </span>
                    ) : match.played && match.result ? (
                      // Confronto RESOLVIDO. Em ida/volta dá pra ver as DUAS pernas; jogo único, uma só.
                      twoLeg && l1 && l2 ? (() => {
                        const teamA = getTeamById(match.homeTeamId); // mandante da ida
                        const teamB = getTeamById(match.awayTeamId); // visitante da ida
                        const aggH = match.result!.homeGoals, aggA = match.result!.awayGoals;
                        const advancer = getTeamName(match.result!.winner!);
                        const penSuffix = match.result!.penaltyWinner ? ` · Pên ${match.result!.homePenalties}-${match.result!.awayPenalties}` : '';
                        const detBtn = 'px-3 sm:px-4 py-2 rounded-lg text-xs font-bold';
                        const detStyle = { background: '#1A1A2A', color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif', border: '1px solid #333' };
                        return (
                          <>
                            <button onClick={() => setViewingResult({ result: l1, homeTeam: teamA, awayTeam: teamB, homeName, awayName, subtitle: `Jogo de IDA · ${label}` })} className={detBtn} style={detStyle}>👁 VER IDA</button>
                            {/* Volta: quem manda é o visitante da ida → inverte casa/fora. */}
                            <button onClick={() => setViewingResult({ result: l2, homeTeam: teamB, awayTeam: teamA, homeName: awayName, awayName: homeName, subtitle: `✅ ${advancer} avança · Agg ${homeName} ${aggH}-${aggA} ${awayName}${penSuffix}` })} className={detBtn} style={detStyle}>👁 VER VOLTA</button>
                          </>
                        );
                      })() : (
                        <button
                          onClick={() => {
                            const teamA = getTeamById(match.homeTeamId);
                            const teamB = getTeamById(match.awayTeamId);
                            setViewingResult({ result: match.result!, homeTeam: teamA, awayTeam: teamB, homeName, awayName });
                          }}
                          className="px-4 py-2 rounded-lg text-xs font-bold"
                          style={{ background: 'var(--ui-surface-3)', color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif', border: '1px solid #333' }}
                        >
                          VER DETALHES
                        </button>
                      )
                    ) : twoLeg && l1 ? (
                      // ⚽ IDA JÁ JOGADA, volta pendente — agora dá pra ver os detalhes da IDA.
                      <button
                        onClick={() => {
                          const teamA = getTeamById(match.homeTeamId);
                          const teamB = getTeamById(match.awayTeamId);
                          setViewingResult({ result: l1, homeTeam: teamA, awayTeam: teamB, homeName, awayName, subtitle: `Jogo de IDA · ${label} — aguardando volta` });
                        }}
                        className="px-4 py-2 rounded-lg text-xs font-bold"
                        style={{ background: 'var(--ui-surface-3)', color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif', border: '1px solid #333' }}
                      >
                        VER DETALHES DA IDA
                      </button>
                    ) : (
                      <span className="px-4 py-2 text-xs font-bold" style={{ color: hasPlayer ? 'var(--ui-brand)' : '#4A4A5A', fontFamily: 'var(--font-game), sans-serif' }}>
                        {hasPlayer ? '⚽ SEU CONFRONTO' : 'AGUARDANDO'}
                      </span>
                    )}
                  </div>

                  {/* 🎯 Palpite — botão na perna ativa (pré-jogo) + badges das pernas reveladas */}
                  {!iAmSpectator && (() => {
                    const isSingleLegTie = !twoLeg;
                    const legNum = isSingleLegTie ? 1 : currentLeg;
                    const activeKey = buildKnockoutMatchKey(match.id, legNum);
                    const legPlayed = legNum === 2 ? !!l2 : !!(l1 || match.result);
                    const betHome = legNum === 2 ? awayName : homeName; // volta: o visitante da ida manda
                    const betAway = legNum === 2 ? homeName : awayName;
                    const betHomeId = legNum === 2 ? match.awayTeamId : match.homeTeamId;
                    const betAwayId = legNum === 2 ? match.homeTeamId : match.awayTeamId;
                    const myActiveBet = betFor(activeKey);
                    const legWord = isSingleLegTie ? '' : (legNum === 2 ? 'volta' : 'ida');
                    const badge = (b: Bet | undefined, word: string) => {
                      if (!b || !b.settled) return null;
                      if (hideScore || !b.revealed) return <div key={word} className="text-[12px] font-bold" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>🎯 palpite {word} em andamento</div>;
                      const txt = b.tier === 'exact' ? `✅ Palpite ${word}: placar exato (+${b.payout})`
                        : b.tier === 'outcome' ? `✅ Palpite ${word}: resultado certo (+${b.payout})`
                        : b.tier === 'builder' ? `✅ Aposta ${word}: certa (+${b.payout})`
                          : `❌ Palpite ${word} perdido (−${b.stake})${(b.protectionRefund ?? 0) > 0 ? ` · devolução +${b.protectionRefund}` : ''}`;
                      return <div key={word} className="text-[13px] font-black" style={{ color: b.won ? 'var(--ui-success)' : 'var(--ui-danger)', fontFamily: 'var(--font-game), sans-serif' }}>{txt}</div>;
                    };
                    return (
                      <div className="mb-3 flex flex-col items-center gap-1">
                        {!legPlayed && !hideScore && (
                          <button onClick={() => setBetSlip({
                            matchKey: activeKey,
                            homeName: betHome,
                            awayName: betAway,
                            homeTeamId: betHomeId,
                            awayTeamId: betAwayId,
                          })}
                            className="px-3 py-1 rounded-lg text-[13px] font-black tracking-wider transition-transform hover:scale-[1.03]"
                            style={{ fontFamily: 'var(--font-game), sans-serif', background: myActiveBet ? '#C9A84C22' : 'var(--ui-surface-1)', color: 'var(--ui-brand-strong)', border: '1px solid #C9A84C55' }}>
                            {myActiveBet ? `🎯 ${myActiveBet.market === 'builder' ? 'Aposta' : 'Palpite'} ${legWord}: ${describeBet(myActiveBet)} · ${myActiveBet.stake} (editar)` : `🎯 Palpitar ${legWord}`}
                          </button>
                        )}
                        {isSingleLegTie
                          ? badge(betFor(buildKnockoutMatchKey(match.id, 1)), 'da final')
                          : <>{badge(betFor(buildKnockoutMatchKey(match.id, 1)), 'ida')}{badge(betFor(buildKnockoutMatchKey(match.id, 2)), 'volta')}</>}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Round controls — solo: the player drives; online: only the host */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-xl text-center border"
          style={{ background: 'var(--ui-surface-1)', borderColor: 'var(--ui-surface-3)' }}
        >
          {canControl ? (
            // Between the ida and the volta the host must also wait for everyone to
            // watch the ida — otherwise firing the volta spoils the first-leg score.
            idaPlayed && !allPlayersWatched ? (
              waitingBlock
            ) : !allPlayed ? (
              <>
                {/* SOLO: aviso se o próprio time tem indisponível (modal ao clicar em jogar). */}
                {state.mode !== 'online' && myUnavailableKO.length > 0 && (
                  <div className="mb-3 rounded-lg px-3 py-2 text-[13px] font-bold" style={{ background: '#241010', border: '1px solid #EF444466', color: '#FCA5A5', fontFamily: 'var(--font-game), sans-serif' }}>
                    🚫 Você tem indisponível no XI: {myUnavailableKO.map(u => u.shortName).join(', ')} — substitua em MEU CLUBE.
                  </div>
                )}
                {/* ONLINE: só quem disputa um confronto confirma "Estou pronto". */}
                {state.mode === 'online' && iPlayThisRound && (
                  iAmReadyKO ? (
                    <button onClick={handleReadyToggleKO} className="w-full py-3 rounded-xl font-black text-lg tracking-widest transition-all mb-2 active:scale-[0.98]"
                      style={{ fontFamily: 'var(--font-display), sans-serif', background: '#0a1a0e', color: '#4ADE80', border: '1px solid #22C55E88', boxShadow: 'inset 0 3px 9px rgba(0,0,0,0.55)', transform: 'scale(0.985)' }} title="Toque para cancelar">
                      ✅ PRONTO!
                    </button>
                  ) : (
                    <button onClick={handleReadyToggleKO} className="w-full py-3 rounded-xl font-black text-lg tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98] mb-2"
                      style={{ fontFamily: 'var(--font-display), sans-serif', background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                      ✅ ESTOU PRONTO
                    </button>
                  )
                )}
                {state.mode === 'online' && totalReadyKO > 0 && (
                  <div className="mb-2 text-[13px] font-black tracking-widest" style={{ fontFamily: 'var(--font-game), sans-serif', color: allReadyKO ? 'var(--ui-success)' : 'var(--ui-brand)' }}>
                    {readyCountKO}/{totalReadyKO} PRONTO{totalReadyKO !== 1 ? 'S' : ''}
                  </div>
                )}
                <button
                  onClick={handlePlayLeg}
                  disabled={state.mode === 'online' && !allReadyKO}
                  className="w-full py-4 rounded-xl font-black text-lg sm:text-xl tracking-widest shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:cursor-pointer"
                  style={{
                    fontFamily: 'var(--font-display), sans-serif',
                    background: (state.mode === 'online' && !allReadyKO) ? 'var(--ui-surface-3)' : 'linear-gradient(135deg, var(--ui-brand) 0%, var(--ui-brand-strong) 50%, var(--ui-brand) 100%)',
                    color: (state.mode === 'online' && !allReadyKO) ? '#666' : 'var(--ui-bg)',
                    boxShadow: (state.mode === 'online' && !allReadyKO) ? 'none' : '0 0 25px rgba(201,168,76,0.3)',
                  }}
                >
                  {playLabel}
                </button>
                <div className="mt-2 text-[13px] font-bold text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  {state.mode === 'online' && !allReadyKO
                    ? 'Todos os participantes do confronto precisam confirmar que estão prontos.'
                    : isFinalSingleLeg ? 'A grande final é em jogo único, em campo neutro.'
                      : isFinal ? 'A grande final será decidida em ida e volta, pelo placar agregado.'
                      : `Mata-mata em ida e volta — quem avança é decidido no placar agregado.${state.mode === 'online' ? ' Todos jogam ao mesmo tempo.' : ''}`}
                </div>
              </>
            ) : !allPlayersWatched ? (
              waitingBlock
            ) : (
              <button
                onClick={handleAdvance}
                className="w-full py-4 rounded-xl font-black text-lg sm:text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                style={{
                  fontFamily: 'var(--font-display), sans-serif',
                  background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)',
                  color: '#000',
                  boxShadow: '0 0 25px rgba(34,197,94,0.3)',
                }}
              >
                {isFinal ? '🏆 VER O CAMPEÃO →' : 'AVANÇAR PARA A PRÓXIMA FASE →'}
              </button>
            )
          ) : (
            idaPlayed && !allPlayersWatched ? (
              <div className="py-2 text-sm font-bold text-yellow-500/80 animate-pulse" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                ⏳ AGUARDANDO TODOS ASSISTIREM A IDA ANTES DA VOLTA...
              </div>
            ) : !allPlayed ? (
              iPlayThisRound ? (
                /* ✅ Não-host com tie: confirma "Estou pronto" (só com escalação válida). */
                <>
                  {myUnavailableKO.length > 0 && (
                    <div className="mb-3 rounded-lg px-3 py-2 text-[13px] font-bold" style={{ background: '#241010', border: '1px solid #EF444466', color: '#FCA5A5', fontFamily: 'var(--font-game), sans-serif' }}>
                      🚫 Você tem indisponível no XI: {myUnavailableKO.map(u => u.shortName).join(', ')} — substitua em MEU CLUBE.
                    </div>
                  )}
                  {iAmReadyKO ? (
                    <button onClick={handleReadyToggleKO} className="w-full py-4 rounded-xl font-black text-xl tracking-widest transition-all active:scale-[0.98]"
                      style={{ fontFamily: 'var(--font-display), sans-serif', background: '#0a1a0e', color: '#4ADE80', border: '1px solid #22C55E88', boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.55)', transform: 'scale(0.985)' }} title="Toque para cancelar">
                      ✅ PRONTO!
                    </button>
                  ) : (
                    <button onClick={handleReadyToggleKO} className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98]"
                      style={{ fontFamily: 'var(--font-display), sans-serif', background: 'linear-gradient(135deg, var(--ui-success) 0%, #4ADE80 50%, var(--ui-success) 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                      ✅ ESTOU PRONTO
                    </button>
                  )}
                  <div className="mt-2 text-[13px] font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#8A8A9A' }}>
                    {readyCountKO}/{totalReadyKO} pronto{totalReadyKO !== 1 ? 's' : ''} · o anfitrião inicia quando todos confirmarem.
                  </div>
                </>
              ) : (
                <div className="py-2 text-sm font-bold text-yellow-500/80 animate-pulse" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  ⏳ AGUARDANDO O ANFITRIÃO INICIAR: {isFinal ? label : currentLeg === 1 ? `IDA — ${label}` : `VOLTA — ${label}`}...
                </div>
              )
            ) : (
              <div className="py-2 text-sm font-bold text-green-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                👑 FASE CONCLUÍDA! AGUARDANDO O ANFITRIÃO AVANÇAR...
              </div>
            )
          )}
          {state.advanceBlocked && state.advanceBlocked.length > 0 && (
            <div className="mt-2 text-center text-[13px] font-bold text-yellow-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
              ⏳ Aguardando assistirem: {state.advanceBlocked.join(', ')}
            </div>
          )}
        </motion.div>

      {/* Detalhes da partida — placar + gols + campo dos 2 times com as notas finais */}
      <AnimatePresence>
        {viewingResult && (
          <MatchDetailsModal
            result={viewingResult.result}
            homeTeam={viewingResult.homeTeam}
            awayTeam={viewingResult.awayTeam}
            homeName={viewingResult.homeName}
            awayName={viewingResult.awayName}
            subtitle={viewingResult.subtitle}
            isKnockout
            isFinal={isFinal}
            onClose={() => setViewingResult(null)}
          />
        )}
      </AnimatePresence>

      {/* 🎯 Slip de palpite (mata-mata) */}
      {betSlip && (() => {
          const myBet = betFor(betSlip.matchKey);
          const bettingLevel = projectLevel(playerTeam?.clubProjects, 'betting');
          const betCap = BET_ROUND_CAP + bettingStakeCapBonus(bettingLevel);
          const capLeft = Math.max(0, betCap - roundStakeUsed(bets, betSlip.matchKey) + (myBet?.stake ?? 0));
          return (
            <BetSlipModal
              homeName={betSlip.homeName} awayName={betSlip.awayName} existing={myBet}
              remainingCap={capLeft} points={state.points}
              payoutRules={bettingPayoutRulesForLevel(bettingLevel)}
              onConfirm={(submission: BetSlipSubmission) => {
                if (online) shopPlaceBetOnline(betSlip.matchKey, submission.homeGoals, submission.awayGoals, submission.stake, betSlip.homeTeamId, betSlip.awayTeamId, submission.market, submission.selections);
                else dispatch({
                  type: 'PLACE_BET',
                  matchKey: betSlip.matchKey,
                  homeTeamId: betSlip.homeTeamId,
                  awayTeamId: betSlip.awayTeamId,
                  homeGoals: submission.homeGoals,
                  awayGoals: submission.awayGoals,
                  stake: submission.stake,
                  market: submission.market,
                  selections: submission.selections,
                });
                setBetSlip(null);
              }}
              onCancelBet={myBet ? () => {
                if (online) shopCancelBetOnline(betSlip.matchKey);
                else dispatch({ type: 'CANCEL_BET', matchKey: betSlip.matchKey });
                setBetSlip(null);
              } : undefined}
              onClose={() => setBetSlip(null)}
            />
          );
        })()}

      {/* 🚫 Aviso: escalação/banco impedem o início da perna */}
      <GameModal
        open={!!lineupWarning}
        onOpenChange={open => { if (!open) setLineupWarning(null); }}
        size="default"
        title={<span style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FCA5A5' }}>ESCALAÇÃO INVÁLIDA</span>}
        footer={(
          <button onClick={() => setLineupWarning(null)} className="w-full py-3.5 font-black tracking-widest text-sm"
            style={{ fontFamily: 'var(--font-game), sans-serif', background: '#EF444418', color: '#FCA5A5', border: 'none' }}>ENTENDI</button>
        )}
      >
        {lineupWarning && (
          <div className="text-center">
            <div className="text-4xl mb-2">🚫</div>
            {lineupWarning.kind === 'reserve' ? (
              <p className="text-[13px] leading-relaxed" style={{ color: '#C9B3B3', fontFamily: 'var(--font-game), sans-serif' }}>
                Seu banco tem <b style={{ color: '#FCA5A5' }}>{reserveCountKO} reservas</b>, mas o limite para iniciar uma partida é de <b style={{ color: '#FFF' }}>{MAX_RESERVE_PLAYERS}</b>.<br />
                Venda ou remova reservas na aba <b style={{ color: 'var(--ui-brand)' }}>MERCADO</b> antes de jogar.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed" style={{ color: '#C9B3B3', fontFamily: 'var(--font-game), sans-serif' }}>
                Você tem jogador(es) <b style={{ color: '#FCA5A5' }}>suspenso(s)/lesionado(s)</b> no time titular: <b style={{ color: '#FFF' }}>{lineupWarning.names.join(', ')}</b>.<br />
                Substitua na aba <b style={{ color: 'var(--ui-brand)' }}>MEU CLUBE</b> antes de jogar.
              </p>
            )}
          </div>
        )}
      </GameModal>
    </>
  );
}
