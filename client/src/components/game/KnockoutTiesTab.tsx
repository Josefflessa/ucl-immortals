// UCL Immortals — Knockout CONFRONTOS tab
// The bracket ties + ida/volta leg controls (with online watch-gating) + result
// modal, lifted out of the old standalone KnockoutPage so the season hub can host
// it as a single tab alongside MEU TIME / ESTATÍSTICAS / MEUS JOGOS.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, KnockoutMatch } from '../../contexts/GameContext';
import { useTeams } from '../../hooks/useTeams';
import { MatchResult, Team, getActiveKnockoutMatches, knockoutRoundLabel } from '../../lib/gameEngine';
import MatchDetailsModal from './MatchDetailsModal';
import BetSlipModal from './BetSlipModal';
import { buildKnockoutMatchKey, roundStakeUsed, BET_ROUND_CAP, Bet } from '../../lib/bets';
import { unavailableStarters } from '../../lib/discipline';

const TROPHY_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-trophy-oKrRV4CKRhdEsz5wuhybrL.webp';

export default function KnockoutTiesTab() {
  const { state, dispatch, playKnockoutRoundOnline, advanceKnockoutRoundOnline, getTeamById, shopPlaceBetOnline, shopCancelBetOnline, playerReadyOnline, playerUnreadyOnline } = useGame();
  const { knockoutBracket, playerTeam } = state;
  const online = state.mode === 'online';
  const { localTeamId, getTeamName: resolveTeamName } = useTeams();
  const [betSlip, setBetSlip] = useState<{ matchKey: string; homeName: string; awayName: string } | null>(null);
  const [lineupWarning, setLineupWarning] = useState<string[] | null>(null); // 🚫 aviso de escalação inválida (solo)
  // 🎯 Palpite — teto compartilhado entre as pernas ativas do mata-mata (prefixo 'K').
  const bets = state.bets ?? [];
  const remainingCap = BET_ROUND_CAP - roundStakeUsed(bets, 'K');
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
    (state.mode === 'online' && state.onlinePlayers.some(p => p.id === teamId && p.socketId === state.socketId));

  // Solo: the player drives progression locally. Online: only the host does.
  const canControl = state.mode !== 'online' || state.isHost;
  const currentLeg = knockoutBracket.currentLeg;

  const handlePlayLeg = () => {
    if (state.mode === 'online') {
      if (!allReadyKO) return; // host inicia só com todos prontos (o host também confirma "pronto")
      playKnockoutRoundOnline();
    } else {
      if (myUnavailableKO.length > 0) { setLineupWarning(myUnavailableKO.map(u => u.shortName ?? '?')); return; }
      dispatch({ type: 'PLAY_KNOCKOUT_LEG' });
    }
  };
  // ✅ Não-host confirma pronto (só com escalação válida).
  const handleReadyToggleKO = () => {
    if (iAmReadyKO) { playerUnreadyOnline(); return; }
    if (myUnavailableKO.length > 0) { setLineupWarning(myUnavailableKO.map(u => u.shortName ?? '?')); return; }
    playerReadyOnline();
  };
  const handleAdvance = () => {
    if (state.mode === 'online') advanceKnockoutRoundOnline();
    else dispatch({ type: 'ADVANCE_KNOCKOUT' });
  };

  const matches = getActiveKnockoutMatches(knockoutBracket) as KnockoutMatch[];

  const round = knockoutBracket.currentRound;

  // 🟥🩹 Escalação: bloqueia jogar a perna com titular indisponível (sem troca automática).
  const iPlayThisRound = matches.some(m => isPlayerTeam(m.homeTeamId) || isPlayerTeam(m.awayTeamId));
  const myUnavailableKO = (playerTeam && iPlayThisRound) ? unavailableStarters(playerTeam, state.discipline) : [];
  // ✅ Ready-check (online): TODOS com tie (incluindo o host) confirmam "Estou pronto".
  const readySet = new Set(state.onlineReadyPlayers);
  const iAmReadyKO = !!localTeamId && readySet.has(localTeamId);
  const humansWithTie = state.mode === 'online'
    ? state.onlinePlayers.filter(p => p.team && matches.some(m => m.homeTeamId === p.id || m.awayTeamId === p.id))
    : [];
  const totalReadyKO = humansWithTie.length;
  const readyCountKO = state.onlineReadyPlayers.length;
  const allReadyKO = readyCountKO >= totalReadyKO;

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
  const label = knockoutRoundLabel(round);
  const allPlayed = matches.length > 0 && matches.every(m => m.played);
  const isFinal = round === 'final';
  // After the IDA is played the bracket bumps currentLeg to 2, but the ties aren't
  // resolved yet (allPlayed=false). This in-between state must ALSO gate on everyone
  // watching the ida before the host can fire the volta — otherwise the ida spoils.
  const idaPlayed = !isFinal && currentLeg === 2 && !allPlayed;

  // Online: gate advance button until all human players in this round have watched their tie
  const humanPlayersInBracket = state.mode === 'online'
    ? state.onlinePlayers.filter(p => matches.some(m => m.homeTeamId === p.id || m.awayTeamId === p.id))
    : [];
  const allPlayersWatched = state.mode !== 'online' || humanPlayersInBracket.length === 0 ||
    humanPlayersInBracket.every(p => state.onlineWatchedPlayers.includes(p.id));
  const knockoutWaitingCount = humanPlayersInBracket.filter(p => !state.onlineWatchedPlayers.includes(p.id)).length;
  const playLabel = isFinal
    ? `▶ JOGAR ${label}`
    : currentLeg === 1
      ? `▶ JOGAR IDA — ${label}`
      : `▶ JOGAR VOLTA — ${label}`;
  // Gate label: which leg everyone is still watching (ida between legs, else volta).
  const waitingLegLabel = idaPlayed ? 'A IDA' : 'O RESULTADO';
  const waitingBlock = (
    <div className="py-3">
      <div className="text-sm font-bold animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#C9A84C' }}>
        ⏳ AGUARDANDO {knockoutWaitingCount} JOGADOR{knockoutWaitingCount !== 1 ? 'ES' : ''} ASSISTIREM {waitingLegLabel}...
      </div>
      <div className="mt-1 text-[11px] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        ({humanPlayersInBracket.length - knockoutWaitingCount}/{humanPlayersInBracket.length} concluídos)
      </div>
    </div>
  );

  return (
    <>
      {/* Final: trophy for drama */}
      {isFinal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-4 sm:mb-6"
        >
          <img src={TROPHY_URL} alt="Trophy" className="w-16 h-20 sm:w-24 sm:h-32 object-contain"
            style={{ filter: 'drop-shadow(0 0 30px rgba(201,168,76,0.6))' }} />
        </motion.div>
      )}

        {/* Confrontos da fase atual */}
        <div className="space-y-4">
          {matches.map((match, i) => {
            const homeName = getTeamName(match.homeTeamId);
            const awayName = getTeamName(match.awayTeamId);
            const homeIsPlayer = isPlayerTeam(match.homeTeamId);
            const awayIsPlayer = isPlayerTeam(match.awayTeamId);
            const hasPlayer = homeIsPlayer || awayIsPlayer;
            const twoLeg = !match.isSingleLeg && round !== 'final';
            const l1 = match.leg1;
            const l2 = match.leg2;
            const watched = state.watchedKnockoutMatches;
            // Don't reveal the player's own leg score before they watch that leg.
            const hideMyScore = hasPlayer && (
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
                className="rounded-2xl overflow-hidden"
                style={{
                  background: '#0F0F1A',
                  border: `1px solid ${hasPlayer ? '#C9A84C44' : '#1A1A2A'}`,
                  boxShadow: hasPlayer ? '0 0 20px rgba(201,168,76,0.1)' : 'none',
                }}
              >
                {/* Match header */}
                {hasPlayer && (
                  <div className="px-4 py-1.5 text-xs font-bold tracking-widest text-center"
                    style={{ background: '#C9A84C22', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                    ⭐ SEU TIME
                  </div>
                )}
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Home team */}
                    <div className={`flex-1 text-right min-w-0 ${homeIsPlayer ? 'text-yellow-400' : ''}`}>
                      <div className="text-sm sm:text-lg font-black leading-tight truncate"
                        style={{
                          fontFamily: 'Bebas Neue, sans-serif',
                          color: homeIsPlayer ? '#C9A84C' : '#FFFFFF',
                        }}>
                        {homeName}
                      </div>
                    </div>

                    {/* Score / VS */}
                    <div className="flex-shrink-0 w-24 sm:w-36 text-center">
                      {hideScore ? (
                        <div className="text-sm font-black animate-pulse" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                          ⚽ AO VIVO
                        </div>
                      ) : twoLeg ? (
                        !l1 ? (
                          <div className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#555' }}>VS</div>
                        ) : !l2 || !match.result ? (
                          <div>
                            <div className="inline-block text-[10px] font-black tracking-widest text-indigo-300 rounded px-2 py-0.5 mb-0.5" style={{ fontFamily: 'Rajdhani, sans-serif', background: '#4338CA33', border: '1px solid #4338CA66' }}>JOGO DE IDA</div>
                            <div className="text-3xl sm:text-4xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                              {l1.homeGoals} - {l1.awayGoals}
                            </div>
                            <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 mt-0.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>⏳ aguardando a volta</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-[8px] font-black tracking-[0.2em] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>AGREGADO</div>
                            <div className="text-3xl sm:text-4xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                              {match.result.homeGoals} - {match.result.awayGoals}
                            </div>
                            {/* Placares de cada perna — grandes e rotulados */}
                            <div className="mt-1.5 flex flex-col gap-1">
                              <div className="flex items-center justify-between rounded px-2 py-0.5" style={{ background: '#4338CA22', border: '1px solid #4338CA55' }}>
                                <span className="text-[8px] sm:text-[9px] font-black tracking-widest text-indigo-300" style={{ fontFamily: 'Rajdhani, sans-serif' }}>IDA</span>
                                <span className="text-sm sm:text-base font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C7D2FE' }}>{l1.homeGoals}-{l1.awayGoals}</span>
                              </div>
                              <div className="flex items-center justify-between rounded px-2 py-0.5" style={{ background: '#0D948822', border: '1px solid #14B8A655' }}>
                                <span className="text-[8px] sm:text-[9px] font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#5EEAD4' }}>VOLTA</span>
                                <span className="text-sm sm:text-base font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#99F6E4' }}>{l2.homeGoals}-{l2.awayGoals}</span>
                              </div>
                              {match.result.penaltyWinner && (
                                <div className="flex items-center justify-between rounded px-2 py-0.5" style={{ background: '#78350F22', border: '1px solid #B4530955' }}>
                                  <span className="text-[8px] sm:text-[9px] font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#FBBF24' }}>PÊNAL</span>
                                  <span className="text-sm sm:text-base font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FDE68A' }}>{match.result.homePenalties}-{match.result.awayPenalties}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs mt-1.5 font-bold" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                              {getTeamName(match.result.winner!)} avança
                            </div>
                          </div>
                        )
                      ) : match.played && match.result ? (
                        <div>
                          <div className="text-2xl sm:text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                            {match.result.homeGoals} - {match.result.awayGoals}
                          </div>
                          {match.result.penaltyWinner && (
                            <div className="text-[10px] sm:text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                              ({match.result.homePenalties}-{match.result.awayPenalties} pen)
                            </div>
                          )}
                          <div className="text-[10px] sm:text-xs mt-1 font-bold" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                            {getTeamName(match.result.winner!)} avança
                          </div>
                        </div>
                      ) : (
                        <div className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#555' }}>
                          VS
                        </div>
                      )}
                    </div>

                    {/* Away team */}
                    <div className={`flex-1 min-w-0 ${awayIsPlayer ? 'text-yellow-400' : ''}`}>
                      <div className="text-sm sm:text-lg font-black leading-tight truncate"
                        style={{
                          fontFamily: 'Bebas Neue, sans-serif',
                          color: awayIsPlayer ? '#C9A84C' : '#FFFFFF',
                        }}>
                        {awayName}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-2 mb-4 flex gap-2 sm:gap-3 justify-center flex-wrap">
                    {iAmSpectator ? (
                      // Spectator (eliminated): watch any human's match as a live broadcast.
                      (() => {
                        const specBtn = "px-3 sm:px-4 py-2 rounded-lg text-xs font-black tracking-wider transition-all hover:scale-[1.03]";
                        const specStyle = { background: 'linear-gradient(135deg, #4338CA, #6366F1)', color: '#fff', fontFamily: 'Rajdhani, sans-serif', boxShadow: '0 0 14px rgba(99,102,241,0.25)' };
                        if (twoLeg) {
                          if (!l1 && !l2) return <span className="px-4 py-2 text-xs font-bold text-gray-600" style={{ fontFamily: 'Rajdhani, sans-serif' }}>AGUARDANDO JOGO</span>;
                          return (
                            <>
                              {l1 && <button onClick={() => spectateLeg(match, 1)} className={specBtn} style={specStyle}>👁 ASSISTIR IDA</button>}
                              {l2 && <button onClick={() => spectateLeg(match, 2)} className={specBtn} style={specStyle}>👁 ASSISTIR VOLTA</button>}
                            </>
                          );
                        }
                        return match.result
                          ? <button onClick={() => spectateLeg(match, 0)} className={specBtn} style={specStyle}>👁 ASSISTIR JOGO</button>
                          : <span className="px-4 py-2 text-xs font-bold text-gray-600" style={{ fontFamily: 'Rajdhani, sans-serif' }}>AGUARDANDO JOGO</span>;
                      })()
                    ) : hideScore ? (
                      <span className="px-4 py-2 text-xs font-bold animate-pulse" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
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
                        const detStyle = { background: '#1A1A2A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', border: '1px solid #333' };
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
                          style={{ background: '#1A1A2A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', border: '1px solid #333' }}
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
                        style={{ background: '#1A1A2A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', border: '1px solid #333' }}
                      >
                        VER DETALHES DA IDA
                      </button>
                    ) : (
                      <span className="px-4 py-2 text-xs font-bold" style={{ color: hasPlayer ? '#C9A84C' : '#4A4A5A', fontFamily: 'Rajdhani, sans-serif' }}>
                        {hasPlayer ? '⚽ SEU CONFRONTO' : 'AGUARDANDO'}
                      </span>
                    )}
                  </div>

                  {/* 🎯 Palpite — botão na perna ativa (pré-jogo) + badges das pernas reveladas */}
                  {!iAmSpectator && (() => {
                    const isFinalTie = match.isSingleLeg || round === 'final';
                    const legNum = isFinalTie ? 1 : currentLeg;
                    const activeKey = buildKnockoutMatchKey(match.id, legNum);
                    const legPlayed = legNum === 2 ? !!l2 : !!(l1 || match.result);
                    const betHome = legNum === 2 ? awayName : homeName; // volta: mando invertido
                    const betAway = legNum === 2 ? homeName : awayName;
                    const myActiveBet = betFor(activeKey);
                    const legWord = isFinalTie ? '' : (legNum === 2 ? 'volta' : 'ida');
                    const badge = (b: Bet | undefined, word: string) => {
                      if (!b || !b.settled) return null;
                      if (hideScore || !b.revealed) return <div key={word} className="text-[10px] font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>🎯 palpite {word} em andamento</div>;
                      const txt = b.tier === 'exact' ? `✅ Palpite ${word}: placar exato (+${b.payout})`
                        : b.tier === 'outcome' ? `✅ Palpite ${word}: resultado certo (+${b.payout})`
                          : `❌ Palpite ${word} perdido (−${b.stake})`;
                      return <div key={word} className="text-[11px] font-black" style={{ color: b.won ? '#22C55E' : '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>{txt}</div>;
                    };
                    return (
                      <div className="mb-3 flex flex-col items-center gap-1">
                        {!legPlayed && !hideScore && (
                          <button onClick={() => setBetSlip({ matchKey: activeKey, homeName: betHome, awayName: betAway })}
                            className="px-3 py-1 rounded-lg text-[11px] font-black tracking-wider transition-transform hover:scale-[1.03]"
                            style={{ fontFamily: 'Rajdhani, sans-serif', background: myActiveBet ? '#C9A84C22' : '#0F0F1A', color: '#E8C84A', border: '1px solid #C9A84C55' }}>
                            {myActiveBet ? `🎯 Palpite ${legWord}: ${myActiveBet.homeGoals}-${myActiveBet.awayGoals} · ${myActiveBet.stake} (editar)` : `🎯 Palpitar ${legWord}`}
                          </button>
                        )}
                        {isFinalTie
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
          style={{ background: '#0F0F1A', borderColor: '#1A1A2A' }}
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
                  <div className="mb-3 rounded-lg px-3 py-2 text-[11px] font-bold" style={{ background: '#241010', border: '1px solid #EF444466', color: '#FCA5A5', fontFamily: 'Rajdhani, sans-serif' }}>
                    🚫 Você tem indisponível no XI: {myUnavailableKO.map(u => u.shortName).join(', ')} — substitua em MEU TIME.
                  </div>
                )}
                {/* ONLINE: o host também confirma "Estou pronto" (valida o próprio time). */}
                {state.mode === 'online' && (
                  iAmReadyKO ? (
                    <button onClick={handleReadyToggleKO} className="w-full py-3 rounded-xl font-black text-lg tracking-widest transition-all mb-2 active:scale-[0.98]"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', background: '#0a1a0e', color: '#4ADE80', border: '1px solid #22C55E88', boxShadow: 'inset 0 3px 9px rgba(0,0,0,0.55)', transform: 'scale(0.985)' }} title="Toque para cancelar">
                      ✅ PRONTO!
                    </button>
                  ) : (
                    <button onClick={handleReadyToggleKO} className="w-full py-3 rounded-xl font-black text-lg tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98] mb-2"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg, #22C55E 0%, #4ADE80 50%, #22C55E 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                      ✅ ESTOU PRONTO
                    </button>
                  )
                )}
                {state.mode === 'online' && totalReadyKO > 0 && (
                  <div className="mb-2 text-[11px] font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: allReadyKO ? '#22C55E' : '#C9A84C' }}>
                    {readyCountKO}/{totalReadyKO} PRONTO{totalReadyKO !== 1 ? 'S' : ''}
                  </div>
                )}
                <button
                  onClick={handlePlayLeg}
                  disabled={state.mode === 'online' && !allReadyKO}
                  className="w-full py-4 rounded-xl font-black text-lg sm:text-xl tracking-widest shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:cursor-pointer"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: (state.mode === 'online' && !allReadyKO) ? '#1A1A2A' : 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                    color: (state.mode === 'online' && !allReadyKO) ? '#666' : '#080810',
                    boxShadow: (state.mode === 'online' && !allReadyKO) ? 'none' : '0 0 25px rgba(201,168,76,0.3)',
                  }}
                >
                  {playLabel}
                </button>
                <div className="mt-2 text-[11px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {state.mode === 'online' && !allReadyKO
                    ? 'Todos (você incluso) precisam confirmar que estão prontos.'
                    : isFinal ? 'A grande final é em jogo único, em campo neutro.'
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
                  fontFamily: 'Bebas Neue, sans-serif',
                  background: 'linear-gradient(135deg, #22C55E 0%, #4ADE80 50%, #22C55E 100%)',
                  color: '#000',
                  boxShadow: '0 0 25px rgba(34,197,94,0.3)',
                }}
              >
                {isFinal ? '🏆 VER O CAMPEÃO →' : 'AVANÇAR PARA A PRÓXIMA FASE →'}
              </button>
            )
          ) : (
            idaPlayed && !allPlayersWatched ? (
              <div className="py-2 text-sm font-bold text-yellow-500/80 animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                ⏳ AGUARDANDO TODOS ASSISTIREM A IDA ANTES DA VOLTA...
              </div>
            ) : !allPlayed ? (
              iPlayThisRound ? (
                /* ✅ Não-host com tie: confirma "Estou pronto" (só com escalação válida). */
                <>
                  {myUnavailableKO.length > 0 && (
                    <div className="mb-3 rounded-lg px-3 py-2 text-[11px] font-bold" style={{ background: '#241010', border: '1px solid #EF444466', color: '#FCA5A5', fontFamily: 'Rajdhani, sans-serif' }}>
                      🚫 Você tem indisponível no XI: {myUnavailableKO.map(u => u.shortName).join(', ')} — substitua em MEU TIME.
                    </div>
                  )}
                  {iAmReadyKO ? (
                    <button onClick={handleReadyToggleKO} className="w-full py-4 rounded-xl font-black text-xl tracking-widest transition-all active:scale-[0.98]"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', background: '#0a1a0e', color: '#4ADE80', border: '1px solid #22C55E88', boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.55)', transform: 'scale(0.985)' }} title="Toque para cancelar">
                      ✅ PRONTO!
                    </button>
                  ) : (
                    <button onClick={handleReadyToggleKO} className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98]"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg, #22C55E 0%, #4ADE80 50%, #22C55E 100%)', color: '#04140A', boxShadow: '0 4px 0 #16833f, 0 8px 18px rgba(34,197,94,0.25)' }}>
                      ✅ ESTOU PRONTO
                    </button>
                  )}
                  <div className="mt-2 text-[11px] font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#8A8A9A' }}>
                    {readyCountKO}/{totalReadyKO} pronto{totalReadyKO !== 1 ? 's' : ''} · o anfitrião inicia quando todos confirmarem.
                  </div>
                </>
              ) : (
                <div className="py-2 text-sm font-bold text-yellow-500/80 animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  ⏳ AGUARDANDO O ANFITRIÃO INICIAR: {isFinal ? label : currentLeg === 1 ? `IDA — ${label}` : `VOLTA — ${label}`}...
                </div>
              )
            ) : (
              <div className="py-2 text-sm font-bold text-green-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                👑 FASE CONCLUÍDA! AGUARDANDO O ANFITRIÃO AVANÇAR...
              </div>
            )
          )}
          {state.advanceBlocked && state.advanceBlocked.length > 0 && (
            <div className="mt-2 text-center text-[11px] font-bold text-yellow-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
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
            onClose={() => setViewingResult(null)}
          />
        )}
      </AnimatePresence>

      {/* 🎯 Slip de palpite (mata-mata) */}
      <AnimatePresence>
        {betSlip && (() => {
          const myBet = betFor(betSlip.matchKey);
          const capLeft = remainingCap + (myBet?.stake ?? 0);
          return (
            <BetSlipModal
              homeName={betSlip.homeName} awayName={betSlip.awayName} existing={myBet}
              remainingCap={capLeft} points={state.points}
              onConfirm={(hg, ag, stake) => {
                if (online) shopPlaceBetOnline(betSlip.matchKey, hg, ag, stake);
                else dispatch({ type: 'PLACE_BET', matchKey: betSlip.matchKey, homeGoals: hg, awayGoals: ag, stake });
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
      </AnimatePresence>

      {/* 🚫 Aviso: tentou jogar a perna com titular indisponível (solo) */}
      <AnimatePresence>
        {lineupWarning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(6,6,14,0.92)' }} onClick={() => setLineupWarning(null)}>
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl overflow-hidden text-center" style={{ background: '#0B0B14', border: '1px solid #EF444455' }}>
              <div className="px-6 pt-6 pb-2">
                <div className="text-4xl mb-2">🚫</div>
                <div className="text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FCA5A5' }}>ESCALAÇÃO INVÁLIDA</div>
                <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#C9B3B3', fontFamily: 'Rajdhani, sans-serif' }}>
                  Você tem jogador(es) <b style={{ color: '#FCA5A5' }}>suspenso(s)/lesionado(s)</b> no time titular: <b style={{ color: '#FFF' }}>{lineupWarning.join(', ')}</b>.<br />
                  Substitua na aba <b style={{ color: '#C9A84C' }}>MEU TIME</b> antes de jogar.
                </p>
              </div>
              <button onClick={() => setLineupWarning(null)} className="w-full py-3.5 mt-3 font-black tracking-widest text-sm"
                style={{ fontFamily: 'Rajdhani, sans-serif', background: '#EF444418', color: '#FCA5A5', borderTop: '1px solid #EF444433' }}>ENTENDI</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
