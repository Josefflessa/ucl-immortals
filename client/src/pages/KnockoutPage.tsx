// UCL Immortals — Knockout Phase Page
// Quarter-finals, Semi-finals, Final bracket

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, KnockoutMatch } from '../contexts/GameContext';
import { useTeams } from '../hooks/useTeams';
import { MatchResult, getActiveKnockoutMatches, knockoutRoundLabel, getAllPlayedMatchResults, getPlayerSeasonStats } from '../lib/gameEngine';
import { POS_PT } from '../lib/gameData';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';
const TROPHY_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-trophy-oKrRV4CKRhdEsz5wuhybrL.webp';

interface MatchEventFeedProps {
  result: MatchResult;
  homeName: string;
  awayName: string;
  leg1?: MatchResult;
  leg1HomeName?: string;
  leg1AwayName?: string;
  subtitle?: string;
  onClose: () => void;
}

function MatchEventFeed({ result, homeName, awayName, leg1, leg1HomeName, leg1AwayName, subtitle, onClose }: MatchEventFeedProps) {
  const [activeView, setActiveView] = useState<'events' | 'ratings' | 'leg1'>('events');

  const renderEvents = (r: MatchResult, hName: string, aName: string) => (
    <div className="space-y-1.5">
      {r.events.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Nenhum evento registrado.</div>
      ) : r.events.map((event, i) => (
        <div key={i} className="flex items-start gap-3 text-sm">
          <span className="text-xs font-bold flex-shrink-0 w-8 text-right flex-shrink-0"
            style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
            {event.minute}'
          </span>
          <span style={{
            color: event.type === 'goal' ? '#C9A84C' : event.type === 'yellow' ? '#EAB308' : event.type === 'red' ? '#EF4444' : '#8A8A9A',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: event.type === 'goal' ? 'bold' : 'normal',
            fontSize: 13,
          }}>
            {event.description}
          </span>
        </div>
      ))}
    </div>
  );

  const renderRatings = (r: MatchResult) => {
    if (!r.playerStats) return <div className="py-6 text-center text-xs text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Sem dados de nota.</div>;
    const entries = Object.values(r.playerStats).sort((a, b) => b.rating - a.rating);
    return (
      <div className="space-y-1">
        {entries.map((ps, i) => {
          const color = ps.rating >= 8 ? '#C9A84C' : ps.rating >= 7 ? '#22C55E' : ps.rating >= 6 ? '#8A8A9A' : '#EF4444';
          return (
            <div key={ps.playerId} className="flex items-center gap-3 px-1 py-1.5 rounded" style={{ background: i % 2 === 0 ? '#0a0a14' : 'transparent' }}>
              <span className="text-base font-black w-10 text-right flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif', color }}>{ps.rating.toFixed(1)}</span>
              <span className="text-sm font-bold flex-1 truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#ddd' }}>{ps.playerName}</span>
              {ps.goals > 0 && <span className="text-xs font-bold text-yellow-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>⚽ {ps.goals}</span>}
              {ps.assists > 0 && <span className="text-xs font-bold text-blue-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>👟 {ps.assists}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const tabs = [
    { id: 'events', label: leg1 ? 'VOLTA' : 'EVENTOS' },
    { id: 'ratings', label: 'NOTAS' },
    ...(leg1 ? [{ id: 'leg1', label: 'IDA' }] : []),
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,16,0.95)' }}
    >
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: '#0F0F1A', border: '1px solid #C9A84C44', maxHeight: '90vh' }}>
        {/* Score header */}
        <div className="px-6 py-5 text-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #14142A, #0F0F1A)' }}>
          <div className="text-xs font-bold tracking-widest mb-2"
            style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
            {leg1 ? 'RESULTADO — VOLTA' : 'RESULTADO'}
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-right flex-1 min-w-0">
              <div className="text-base sm:text-lg font-black truncate" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>{homeName}</div>
            </div>
            <div className="text-4xl sm:text-5xl font-black flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
              {result.homeGoals} - {result.awayGoals}
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-base sm:text-lg font-black truncate" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>{awayName}</div>
            </div>
          </div>
          {result.penaltyWinner && (
            <div className="text-sm mt-1" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              Pênaltis: {result.homePenalties} - {result.awayPenalties}
            </div>
          )}
          {subtitle && (
            <div className="text-xs mt-1.5 font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 px-4 pt-3 pb-2 flex-shrink-0 border-b" style={{ borderColor: '#1A1A2A' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveView(t.id as any)}
              className="flex-1 py-1.5 rounded-lg text-xs font-black tracking-wider transition-all"
              style={{ fontFamily: 'Rajdhani, sans-serif', background: activeView === t.id ? '#C9A84C' : '#1A1A2A', color: activeView === t.id ? '#080810' : '#8A8A9A' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
          {activeView === 'events' && renderEvents(result, homeName, awayName)}
          {activeView === 'ratings' && renderRatings(result)}
          {activeView === 'leg1' && leg1 && renderEvents(leg1, leg1HomeName ?? homeName, leg1AwayName ?? awayName)}
        </div>

        <div className="px-4 pb-4 pt-2 flex-shrink-0">
          <button onClick={onClose} className="w-full py-3 rounded-xl font-black text-lg tracking-widest"
            style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg, #C9A84C, #E8C84A)', color: '#080810' }}>
            FECHAR →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function KnockoutPage() {
  const { state, dispatch, getTeamById, playKnockoutRoundOnline, advanceKnockoutRoundOnline } = useGame();
  const { knockoutBracket, playerTeam } = state;
  const { localTeamId, allTeams, getTeamName: resolveTeamName } = useTeams();
  const [viewingResult, setViewingResult] = useState<{
    result: MatchResult;
    homeName: string;
    awayName: string;
    leg1?: MatchResult;
    leg1HomeName?: string;
    leg1AwayName?: string;
    subtitle?: string;
  } | null>(null);
  const [knockoutTab, setKnockoutTab] = useState<'matches' | 'stats'>('matches');

  // Auto-open the local player's tie as a synchronized replay — LEG BY LEG — as
  // soon as each leg's engine-computed result is available (solo + online).
  useEffect(() => {
    if (state.phase !== 'knockout' || !knockoutBracket) return;
    if (state.currentMatchResult) return; // already watching
    if (!localTeamId) return;

    const round = knockoutBracket.currentRound;
    const ties = getActiveKnockoutMatches(knockoutBracket) as KnockoutMatch[];
    const myTie = ties.find(m => m.homeTeamId === localTeamId || m.awayTeamId === localTeamId);
    if (!myTie) return;
    const watched = state.watchedKnockoutMatches;

    // Single-leg tie (the grand final).
    if (myTie.isSingleLeg || round === 'final') {
      if (myTie.played && myTie.result && !watched.includes(myTie.id)) {
        const home = getTeamById(myTie.homeTeamId);
        const away = getTeamById(myTie.awayTeamId);
        if (home && away) {
          dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [home, away], result: myTie.result, knockout: { matchId: myTie.id, round } });
        }
      }
      return;
    }

    // Two-legged tie: watch the first leg, then the second.
    const teamA = getTeamById(myTie.homeTeamId); // first-leg home
    const teamB = getTeamById(myTie.awayTeamId); // first-leg away
    if (!teamA || !teamB) return;

    if (myTie.leg1 && !watched.includes(`${myTie.id}_l1`)) {
      dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [teamA, teamB], result: myTie.leg1, knockout: { matchId: myTie.id, round, leg: 1 } });
      return;
    }
    if (myTie.leg2 && !watched.includes(`${myTie.id}_l2`)) {
      dispatch({
        type: 'WATCH_ONLINE_MATCH',
        teams: [teamB, teamA], // return leg: B hosts
        result: myTie.leg2,
        knockout: { matchId: myTie.id, round, leg: 2, firstLeg: { home: myTie.leg1?.awayGoals ?? 0, away: myTie.leg1?.homeGoals ?? 0 } },
      });
    }
  }, [state.phase, state.currentMatchResult, state.watchedKnockoutMatches, knockoutBracket, localTeamId, getTeamById, dispatch]);

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
    if (state.mode === 'online') playKnockoutRoundOnline();
    else dispatch({ type: 'PLAY_KNOCKOUT_LEG' });
  };
  const handleAdvance = () => {
    if (state.mode === 'online') advanceKnockoutRoundOnline();
    else dispatch({ type: 'ADVANCE_KNOCKOUT' });
  };

  const matches = getActiveKnockoutMatches(knockoutBracket) as KnockoutMatch[];

  // ── Season stats (for ESTATÍSTICAS tab) — memoized so they don't recompute on every render ──
  const { topScorers, topAssists, topRatings } = useMemo(() => {
    const allPlayers = allTeams.flatMap(t => t.players);
    const allResults = getAllPlayedMatchResults(state.leagueResults, state.knockoutBracket ?? null);

    const rows = allPlayers.flatMap(pl => {
      const team = allTeams.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      return [{ pl, team, stats: getPlayerSeasonStats(pl.id, team.id, allResults) }];
    });

    return {
      topScorers: rows.filter(x => x.stats.goals > 0)
        .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists)
        .slice(0, 15),
      topAssists: rows.filter(x => x.stats.assists > 0)
        .sort((a, b) => b.stats.assists - a.stats.assists)
        .slice(0, 15),
      topRatings: rows.filter(x => x.stats.played >= 3)
        .sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg)
        .slice(0, 15),
    };
  }, [allTeams, state.leagueResults, state.knockoutBracket]);
  const round = knockoutBracket.currentRound;
  const label = knockoutRoundLabel(round);
  const allPlayed = matches.length > 0 && matches.every(m => m.played);
  const isFinal = round === 'final';

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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
        <span className="text-base sm:text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          MATA-MATA
        </span>
        <div className="ml-auto">
          <span className="text-sm font-bold tracking-widest"
            style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
            {label}
          </span>
        </div>
      </div>

      <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 max-w-3xl mx-auto w-full">
        {/* Trophy for final */}
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

        <div className="text-center mb-5 sm:mb-8">
          <h2 className="text-3xl sm:text-5xl font-black tracking-widest"
            style={{ fontFamily: 'Bebas Neue, sans-serif', color: isFinal ? '#C9A84C' : '#FFFFFF' }}>
            {label}
          </h2>
          {isFinal && (
            <p style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              A grande decisão da Champions League
            </p>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-5">
          {(['matches', 'stats'] as const).map(tab => (
            <button key={tab} onClick={() => setKnockoutTab(tab)}
              className="flex-1 py-2 rounded-xl font-black tracking-wider text-sm transition-all"
              style={{ fontFamily: 'Rajdhani, sans-serif', background: knockoutTab === tab ? '#C9A84C' : '#0F0F1A', color: knockoutTab === tab ? '#080810' : '#8A8A9A', border: `1px solid ${knockoutTab === tab ? '#C9A84C' : '#1A1A2A'}` }}>
              {tab === 'matches' ? 'CONFRONTOS' : 'ESTATÍSTICAS'}
            </button>
          ))}
        </div>

        {/* ── STATS TAB ── */}
        {knockoutTab === 'stats' && (
          <div className="space-y-6">
            {/* Top Scorers */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: '#1A1A2A' }}>
                <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#C9A84C' }}>⚽ ARTILHARIA</span>
              </div>
              <div className="divide-y" style={{ borderColor: '#1A1A2A' }}>
                {topScorers.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-center" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Sem gols marcados ainda.</div>
                ) : topScorers.map((x, i) => (
                  <div key={x.pl.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-sm font-black w-6 text-center flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif', color: i === 0 ? '#C9A84C' : '#8A8A9A' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#fff' }}>{x.pl.shortName}</div>
                      <div className="text-xs truncate" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{x.team.name} · {(POS_PT as any)[x.pl.position] ?? x.pl.position}</div>
                    </div>
                    <span className="text-xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>{x.stats.goals}</span>
                    <span className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>⚽</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Assists */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: '#1A1A2A' }}>
                <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#4FC3F7' }}>👟 ASSISTÊNCIAS</span>
              </div>
              <div className="divide-y" style={{ borderColor: '#1A1A2A' }}>
                {topAssists.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-center" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Sem assistências ainda.</div>
                ) : topAssists.map((x, i) => (
                  <div key={x.pl.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-sm font-black w-6 text-center flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif', color: i === 0 ? '#4FC3F7' : '#8A8A9A' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#fff' }}>{x.pl.shortName}</div>
                      <div className="text-xs truncate" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{x.team.name} · {(POS_PT as any)[x.pl.position] ?? x.pl.position}</div>
                    </div>
                    <span className="text-xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#4FC3F7' }}>{x.stats.assists}</span>
                    <span className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>👟</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Ratings */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: '#1A1A2A' }}>
                <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#22C55E' }}>⭐ MELHORES NOTAS</span>
                <span className="text-xs ml-2" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>(mín. 3 jogos)</span>
              </div>
              <div className="divide-y" style={{ borderColor: '#1A1A2A' }}>
                {topRatings.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-center" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Dados insuficientes ainda.</div>
                ) : topRatings.map((x, i) => (
                  <div key={x.pl.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-sm font-black w-6 text-center flex-shrink-0" style={{ fontFamily: 'Bebas Neue, sans-serif', color: i === 0 ? '#22C55E' : '#8A8A9A' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#fff' }}>{x.pl.shortName}</div>
                      <div className="text-xs truncate" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{x.team.name} · {x.stats.played}J</div>
                    </div>
                    <span className="text-xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#22C55E' }}>{x.stats.ratingAvg.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Matches */}
        {knockoutTab === 'matches' && <div className="space-y-4">
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
            // In online mode hide ALL tie scores until every player has confirmed watching.
            const hideAllScores = state.mode === 'online' && !allPlayersWatched && allPlayed;
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
                      {homeIsPlayer && (
                        <div className="text-xs" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                          {playerTeam?.formationId}
                        </div>
                      )}
                    </div>

                    {/* Score / VS */}
                    <div className="flex-shrink-0 w-20 sm:w-28 text-center">
                      {hideScore ? (
                        <div className="text-sm font-black animate-pulse" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                          ⚽ AO VIVO
                        </div>
                      ) : twoLeg ? (
                        !l1 ? (
                          <div className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#555' }}>VS</div>
                        ) : !l2 || !match.result ? (
                          <div>
                            <div className="text-[8px] font-black tracking-widest text-indigo-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>IDA</div>
                            <div className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                              {l1.homeGoals} - {l1.awayGoals}
                            </div>
                            <div className="text-[8px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>aguardando volta</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-2xl sm:text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                              {match.result.homeGoals} - {match.result.awayGoals}
                            </div>
                            <div className="text-[8px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                              ida {l1.homeGoals}-{l1.awayGoals} · volta {l2.homeGoals}-{l2.awayGoals}
                              {match.result.penaltyWinner ? ' · pên.' : ''}
                            </div>
                            <div className="text-[10px] sm:text-xs mt-0.5 font-bold" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
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
                      {awayIsPlayer && (
                        <div className="text-xs" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                          {playerTeam?.formationId}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-2 mb-4 flex gap-3 justify-center">
                    {hideScore ? (
                      <span className="px-4 py-2 text-xs font-bold animate-pulse" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                        {hideMyScore ? '⚽ ABRINDO SEU CONFRONTO...' : '⏳ AGUARDANDO TODOS ASSISTIREM...'}
                      </span>
                    ) : match.played && match.result ? (
                      <button
                        onClick={() => setViewingResult(
                          twoLeg && l2
                            ? (() => {
                                const aggH = match.result!.homeGoals;
                                const aggA = match.result!.awayGoals;
                                const l1H = l1?.homeGoals ?? 0;
                                const l1A = l1?.awayGoals ?? 0;
                                const advancer = getTeamName(match.result!.winner!);
                                const penSuffix = match.result!.penaltyWinner
                                  ? ` · Pên ${match.result!.homePenalties}-${match.result!.awayPenalties}`
                                  : '';
                                return {
                                  // Return leg (volta): the away team hosts, so flip home/away
                                  result: l2,
                                  homeName: awayName,
                                  awayName: homeName,
                                  leg1: l1,
                                  leg1HomeName: homeName,
                                  leg1AwayName: awayName,
                                  subtitle: `✅ ${advancer} avança · Agg ${homeName} ${aggH}-${aggA} ${awayName} (Ida ${l1H}-${l1A}${penSuffix})`,
                                };
                              })()
                            : { result: match.result!, homeName, awayName }
                        )}
                        className="px-4 py-2 rounded-lg text-xs font-bold"
                        style={{ background: '#1A1A2A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', border: '1px solid #333' }}
                      >
                        VER DETALHES
                      </button>
                    ) : (
                      <span className="px-4 py-2 text-xs font-bold" style={{ color: hasPlayer ? '#C9A84C' : '#4A4A5A', fontFamily: 'Rajdhani, sans-serif' }}>
                        {hasPlayer ? '⚽ SEU CONFRONTO' : 'AGUARDANDO'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>}

        {/* Round controls — solo: the player drives; online: only the host */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-xl text-center border"
          style={{ background: '#0F0F1A', borderColor: '#1A1A2A' }}
        >
          {canControl ? (
            !allPlayed ? (
              <>
                <button
                  onClick={handlePlayLeg}
                  className="w-full py-4 rounded-xl font-black text-lg sm:text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                    color: '#080810',
                    boxShadow: '0 0 25px rgba(201,168,76,0.3)',
                  }}
                >
                  {playLabel}
                </button>
                <div className="mt-2 text-[11px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {isFinal
                    ? 'A grande final é em jogo único, em campo neutro.'
                    : `Mata-mata em ida e volta — quem avança é decidido no placar agregado.${state.mode === 'online' ? ' Todos jogam ao mesmo tempo.' : ''}`}
                </div>
              </>
            ) : !allPlayersWatched ? (
              <div className="py-3">
                <div className="text-sm font-bold animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#C9A84C' }}>
                  ⏳ AGUARDANDO {knockoutWaitingCount} JOGADOR{knockoutWaitingCount !== 1 ? 'ES' : ''} VEREM O RESULTADO...
                </div>
                <div className="mt-1 text-[11px] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  ({humanPlayersInBracket.length - knockoutWaitingCount}/{humanPlayersInBracket.length} concluídos)
                </div>
              </div>
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
            !allPlayed ? (
              <div className="py-2 text-sm font-bold text-yellow-500/80 animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                ⏳ AGUARDANDO O ANFITRIÃO INICIAR: {isFinal ? label : currentLeg === 1 ? `IDA — ${label}` : `VOLTA — ${label}`}...
              </div>
            ) : (
              <div className="py-2 text-sm font-bold text-green-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                👑 FASE CONCLUÍDA! AGUARDANDO O ANFITRIÃO AVANÇAR...
              </div>
            )
          )}
        </motion.div>
      </div>

      {/* Match result modal */}
      <AnimatePresence>
        {viewingResult && (
          <MatchEventFeed
            result={viewingResult.result}
            homeName={viewingResult.homeName}
            awayName={viewingResult.awayName}
            leg1={viewingResult.leg1}
            leg1HomeName={viewingResult.leg1HomeName}
            leg1AwayName={viewingResult.leg1AwayName}
            subtitle={viewingResult.subtitle}
            onClose={() => setViewingResult(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
