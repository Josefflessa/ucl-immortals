// UCL Immortals — League Phase Page
// Show standings, round-by-round fixtures, and results

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Goal, Footprints, Star, Hand, Swords, UserPlus, LogOut } from 'lucide-react';
import { useGame, KnockoutMatch } from '../contexts/GameContext';
import { useTeams } from '../hooks/useTeams';
import { computeSeasonTopScorers, getPlayerSeasonStats, getAllPlayedMatchResults, getActiveKnockoutMatches, knockoutRoundLabel, PlayerSeasonStats } from '../lib/gameEngine';
import LeagueSquadTab from '../components/game/LeagueSquadTab';
import ShopTab from '../components/game/ShopTab';
import KnockoutTiesTab from '../components/game/KnockoutTiesTab';
import BracketTab from '../components/game/BracketTab';
import PlayerAvatar from '../components/game/PlayerAvatar';
import PlayerCard from '../components/game/PlayerCard';
import Crest from '../components/game/Crest';
import MatchDetailsModal from '../components/game/MatchDetailsModal';
import BetSlipModal from '../components/game/BetSlipModal';
import { buildLeagueMatchKey, roundStakeUsed, BET_ROUND_CAP, Bet } from '../lib/bets';
import type { MatchResult, Team } from '../lib/gameEngine';
import { POS_PT } from '../lib/gameData';

const LOGO_URL = '/icons/logo_ucl.png';
const FIELD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-field-bg-TNi7gMGy2VJGpi28zWLUUX.webp';

// Anti-spoiler placeholder: shown instead of position/standings/stats/bracket while other
// players are still watching their match this round (durations vary, so results must stay hidden).
function SpoilerLock({ waiting, label }: { waiting: number; label: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="text-4xl mb-3">🔒</div>
      <div className="text-base font-black tracking-widest" style={{ color: '#C9A84C', fontFamily: 'Bebas Neue, sans-serif' }}>{label}</div>
      <div className="text-xs mt-2 leading-relaxed" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
        Liberado quando <b style={{ color: '#FFF' }}>todos saírem da partida</b> desta rodada
        {waiting > 0 ? <> — aguardando <b style={{ color: '#E8C84A' }}>{waiting}</b> jogador(es).</> : '.'}
      </div>
    </div>
  );
}

export default function LeaguePage() {
  const { state, dispatch, playRoundOnline, advanceRoundOnline, getTeamById, disconnectOnline, pickReinforcementOnline, dismissReinforcementOnline, rerollReinforcementOnline, shopPlaceBetOnline, shopCancelBetOnline } = useGame();
  const online = state.mode === 'online';

  const handleLeaveRoom = () => {
    if (window.confirm('Sair da sala? Você deixará o torneio online. Para voltar, é só entrar de novo com o mesmo código e nome enquanto a sala existir.')) {
      disconnectOnline();
    }
  };
  const { leagueStandings, leagueResults, leagueFixtures, leagueRound, playerTeam } = state;
  const { allTeams, localTeamId, getTeamName } = useTeams();
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'bracket' | 'results' | 'squad' | 'scorers' | 'shop'>('fixtures');
  const [statsSubTab, setStatsSubTab] = useState<'goals' | 'assists' | 'ratings' | 'keepers' | 'tackles'>('goals');
  // HISTÓRICO: alterna entre "MEUS JOGOS" (do jogador) e "RODADAS ANTERIORES" (todos os resultados por rodada)
  const [resultsSubTab, setResultsSubTab] = useState<'mine' | 'rounds'>('mine');
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  // 🎯 Palpite — slip aberto (qual partida) e helpers de teto/consulta.
  const [betSlip, setBetSlip] = useState<{ matchKey: string; homeName: string; awayName: string } | null>(null);
  // 🔍 "Ver Detalhes" de uma partida (placar + gols + campo dos 2 times c/ notas finais)
  const [detailsMatch, setDetailsMatch] = useState<{ result: MatchResult; homeTeam?: Team; awayTeam?: Team; homeName: string; awayName: string } | null>(null);
  const openMatchDetails = (result: MatchResult) => setDetailsMatch({
    result,
    homeTeam: getTeamById(result.homeTeamId),
    awayTeam: getTeamById(result.awayTeamId),
    homeName: getTeamById(result.homeTeamId)?.name ?? result.homeTeamId,
    awayName: getTeamById(result.awayTeamId)?.name ?? result.awayTeamId,
  });

  // This page is the season HUB for BOTH phases: league (rounds + standings) and
  // knockout (ties + bracket). Shared tabs — ESTATÍSTICAS, MEU TIME, MEUS JOGOS —
  // work in either phase; only the first tab (matches) and the standings tab differ.
  const isKnockout = state.phase === 'knockout';
  const knockoutLabel = state.knockoutBracket ? knockoutRoundLabel(state.knockoutBracket.currentRound) : '';

  // When the season advances league → knockout, the standings tab disappears; fall
  // back to the matches (CONFRONTOS) tab so we never render a blank panel.
  useEffect(() => {
    if (isKnockout && activeTab === 'standings') setActiveTab('fixtures');
  }, [isKnockout, activeTab]);

  // Aggregate stats for all players in the league. Memoized so switching tabs
  // (fixtures → standings → scorers) does not recompute/re-sort every render.
  const allPlayers = useMemo(() => {
    const allPlayedResults = getAllPlayedMatchResults(leagueResults, state.knockoutBracket);
    return allTeams.flatMap(t =>
      t.players.map(p => ({
        ...p,
        teamName: t.name,
        teamId: t.id,
        stats: getPlayerSeasonStats(p.id, t.id, allPlayedResults),
      }))
    );
  }, [allTeams, leagueResults, state.knockoutBracket]);

  const { topScorers, topAssists, topRatings, topKeepers, topTacklers } = useMemo(() => ({
    topScorers: [...allPlayers].filter(p => p.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals),
    topAssists: [...allPlayers].filter(p => p.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists),
    topRatings: [...allPlayers].filter(p => p.stats.played >= 1).sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg),
    topKeepers: [...allPlayers].filter(p => p.position === 'GK' && p.stats.played > 0).sort((a, b) => b.stats.saves - a.stats.saves),
    topTacklers: [...allPlayers].filter(p => p.stats.tackles > 0).sort((a, b) => b.stats.tackles - a.stats.tackles),
  }), [allPlayers]);

  // MEUS JOGOS spans the whole season — league rounds AND knockout legs.
  const playerResults = useMemo(
    () => getAllPlayedMatchResults(leagueResults, state.knockoutBracket)
      .filter(r => r.homeTeamId === playerTeam?.id || r.awayTeamId === playerTeam?.id),
    [leagueResults, state.knockoutBracket, playerTeam?.id]
  );

  // RODADAS ANTERIORES: períodos disputados — rodadas 1-8 da liga + as fases do mata-mata.
  const koShort = (r: string): string => ({ playoffs: 'PLAY', round16: 'OIT', quarters: 'QF', semis: 'SF', final: 'FIN' } as Record<string, string>)[r] ?? r;
  const historyPeriods = useMemo(() => {
    const periods: { key: string; label: string; kind: 'league' | 'ko'; round?: number; koRound?: string }[] = [];
    for (let r = 1; r <= 8; r++) {
      if (leagueFixtures.some(f => f.round === r && f.played)) periods.push({ key: `L${r}`, label: `R${r}`, kind: 'league', round: r });
    }
    const b = state.knockoutBracket;
    if (b) {
      const koRounds: [string, any[]][] = [
        ['playoffs', b.playoffs ?? []],
        ['round16', b.round16 ?? []],
        ['quarters', b.quarterFinals ?? []],
        ['semis', b.semiFinals ?? []],
        ['final', b.final ? [b.final] : []],
      ];
      for (const [rk, ties] of koRounds) {
        if (ties.some((t: any) => t.leg1 || t.result || t.played)) periods.push({ key: rk, label: koShort(rk), kind: 'ko', koRound: rk });
      }
    }
    return periods;
  }, [leagueFixtures, state.knockoutBracket]);
  const historyKey = selectedHistoryKey && historyPeriods.some(p => p.key === selectedHistoryKey)
    ? selectedHistoryKey
    : (historyPeriods.length ? historyPeriods[historyPeriods.length - 1].key : null);
  const historyPeriod = historyPeriods.find(p => p.key === historyKey) ?? null;
  const historyFixtures = useMemo(
    () => historyPeriod?.kind === 'league' ? leagueFixtures.filter(f => f.round === historyPeriod.round) : [],
    [leagueFixtures, historyPeriod]
  );
  const historyKoTies = useMemo(() => {
    const b = state.knockoutBracket;
    if (!b || historyPeriod?.kind !== 'ko') return [] as any[];
    const map: Record<string, any[]> = {
      playoffs: b.playoffs ?? [], round16: b.round16 ?? [], quarters: b.quarterFinals ?? [],
      semis: b.semiFinals ?? [], final: b.final ? [b.final] : [],
    };
    return map[historyPeriod.koRound!] ?? [];
  }, [state.knockoutBracket, historyPeriod]);

  const playerStanding = leagueStandings.find(s => s.teamId === playerTeam?.id);
  const playerPosition = leagueStandings.findIndex(s => s.teamId === playerTeam?.id) + 1;
  // New UCL format: 1–8 qualify straight to the Round of 16, 9–24 go to the
  // knockout play-offs, 25–36 are eliminated.
  const directQual = playerPosition >= 1 && playerPosition <= 8;
  const playoffQual = playerPosition >= 9 && playerPosition <= 24;
  const qualifies = directQual || playoffQual;

  // Filter fixtures for the current round
  const currentRoundFixtures = leagueFixtures.filter(f => f.round === leagueRound);

  // 🎯 Palpite — helpers (usam state.bets + rodada atual)
  const bets = state.bets ?? [];
  const betPrefix = `L${leagueRound}:`;
  const remainingCap = BET_ROUND_CAP - roundStakeUsed(bets, betPrefix);
  const betFor = (matchKey: string): Bet | undefined => bets.find(b => b.matchKey === matchKey);

  // Online: which human players still need to watch their match before host can advance
  const humanPlayersWithMatch = state.mode === 'online'
    ? state.onlinePlayers.filter(p =>
        currentRoundFixtures.some(f => f.homeTeamId === p.id || f.awayTeamId === p.id)
      )
    : [];
  const allPlayersWatched = humanPlayersWithMatch.length === 0 ||
    humanPlayersWithMatch.every(p => state.onlineWatchedPlayers.includes(p.id));
  const waitingForCount = humanPlayersWithMatch.filter(p => !state.onlineWatchedPlayers.includes(p.id)).length;

  // ONLINE: hide ALL scores until every player has confirmed watching the replay.
  // This prevents the host (or anyone else) from seeing results before others finish.
  const hideRoundScore = state.mode === 'online' && !allPlayersWatched;

  // Knockout equivalent: everyone in the active tie round must have watched the leg.
  const koMatches = isKnockout && state.knockoutBracket ? getActiveKnockoutMatches(state.knockoutBracket) : [];
  const koHumans = state.mode === 'online' ? state.onlinePlayers.filter(p => koMatches.some((m: any) => m.homeTeamId === p.id || m.awayTeamId === p.id)) : [];
  const koAllWatched = koHumans.length === 0 || koHumans.every(p => state.onlineWatchedPlayers.includes(p.id));

  // Unified anti-spoiler gate: the POSITION notice, CLASSIFICAÇÃO, ESTATÍSTICAS and (knockout)
  // CHAVEAMENTO only reveal/update once EVERYONE in the round has left their match.
  const spoilerLock = state.mode === 'online' && (isKnockout ? !koAllWatched : !allPlayersWatched);
  const spoilerWaiting = isKnockout
    ? koHumans.filter(p => !state.onlineWatchedPlayers.includes(p.id)).length
    : waitingForCount;

  // Check if player's match in this round is already played
  const playerFixture = currentRoundFixtures.find(
    f => f.homeTeamId === playerTeam?.id || f.awayTeamId === playerTeam?.id
  );
  const isPlayerMatchPlayed = playerFixture?.played ?? false;

  // Check if all fixtures in this round are played
  const allFixturesPlayed = currentRoundFixtures.every(f => f.played);

  const handlePlayPlayerMatch = () => {
    // In online mode, the player's team ID is player_0, player_1 etc. not player_team
    const myPlayerId = localTeamId;

    const myFixture = currentRoundFixtures.find(
      f => f.homeTeamId === myPlayerId || f.awayTeamId === myPlayerId
    );

    if (!myFixture) return;

    // Each player navigates to their own match simulation independently
    dispatch({
      type: 'PLAY_LEAGUE_MATCH',
      homeTeamId: myFixture.homeTeamId,
      awayTeamId: myFixture.awayTeamId,
    });
  };

  // ONLINE host only: simulate the entire round on the server at once.
  const handlePlayRound = () => {
    playRoundOnline();
  };

  const handleAdvanceRound = () => {
    if (state.mode === 'online') {
      advanceRoundOnline();
    } else {
      dispatch({ type: 'ADVANCE_LEAGUE_ROUND' });
    }
  };

  const handleAdvanceKnockout = () => {
    if (state.mode === 'online') {
      advanceRoundOnline();
    } else {
      dispatch({ type: 'START_KNOCKOUT' });
    }
  };

  // ONLINE: when the host plays the round, the server simulates every match and
  // broadcasts the authoritative results. As soon as the local player's fixture
  // for the current round is resolved, auto-open it as a synchronized live replay
  // (each device replays the same server result, so the score is identical).
  useEffect(() => {
    if (state.mode !== 'online') return;
    if (state.phase !== 'league') return;
    if (state.currentMatchResult) return; // already watching one

    if (!localTeamId) return;

    const myFixture = leagueFixtures.find(
      f => f.round === leagueRound && (f.homeTeamId === localTeamId || f.awayTeamId === localTeamId)
    );
    if (!myFixture || !myFixture.played || !myFixture.result) return;
    if (state.lastWatchedRound >= leagueRound) return;

    const home = getTeamById(myFixture.homeTeamId);
    const away = getTeamById(myFixture.awayTeamId);
    if (!home || !away) return;

    dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [home, away], result: myFixture.result });
  }, [
    state.mode, state.phase, state.currentMatchResult, localTeamId,
    state.lastWatchedRound, leagueFixtures, leagueRound, getTeamById, dispatch,
  ]);

  // Knockout: auto-open the local player's tie as a synchronized replay — LEG BY LEG
  // (solo + online). This lives in the HUB (not the CONFRONTOS tab) so it still fires
  // when the player is on another tab — WATCH_ONLINE_MATCH navigates to the replay.
  useEffect(() => {
    if (state.phase !== 'knockout' || !state.knockoutBracket) return;
    if (state.currentMatchResult) return;
    if (!localTeamId) return;

    const kb = state.knockoutBracket;
    const round = kb.currentRound;
    const ties = getActiveKnockoutMatches(kb) as KnockoutMatch[];
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
  }, [state.phase, state.currentMatchResult, state.watchedKnockoutMatches, state.knockoutBracket, localTeamId, getTeamById, dispatch]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
        <span className="text-base sm:text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          {isKnockout ? 'MATA-MATA' : 'FASE DE LIGA'}
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {!isKnockout && playerStanding && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                Posição:
              </span>
              <span className="text-xl font-black" style={{
                fontFamily: 'Bebas Neue, sans-serif',
                color: qualifies ? '#22C55E' : '#EF4444',
              }}>
                {playerPosition}º
              </span>
            </div>
          )}
          {state.roomCode && (
            <button
              onClick={handleLeaveRoom}
              title="Sair da sala"
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500/80 hover:text-red-400 border border-red-500/30 hover:border-red-400/60 rounded-md px-2 py-1 transition-all"
              style={{ fontFamily: 'Rajdhani, sans-serif' }}
            >
              <LogOut size={13} /> <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero banner */}
      <div className="relative h-20 sm:h-32 overflow-hidden">
        <div className="absolute inset-0"
          style={{
            backgroundImage: `url(${FIELD_BG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.3,
          }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, transparent, #080810)',
        }} />
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-3xl sm:text-5xl font-black tracking-widest"
              style={{ fontFamily: 'Bebas Neue, sans-serif', color: isKnockout ? '#C9A84C' : '#FFFFFF' }}>
              {isKnockout ? knockoutLabel : `RODADA ${leagueRound} DE 8`}
            </h2>
            <p className="hidden sm:block" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px' }}>
              {isKnockout ? 'Mata-mata em ida e volta — gerencie seu time entre os confrontos' : 'Dispute rodada por rodada e classifique-se no Top 8'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 sm:px-4 py-4 max-w-4xl mx-auto w-full">
        {/* Player summary card — league standing only (irrelevant in the knockout) */}
        {/* ONLINE anti-spoiler: while others are still watching, hide the position/qualification. */}
        {!isKnockout && spoilerLock && (
          <div className="mb-6">
            <SpoilerLock waiting={spoilerWaiting} label="POSIÇÃO E CLASSIFICAÇÃO OCULTAS" />
          </div>
        )}
        {!isKnockout && !spoilerLock && playerStanding && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 mb-6"
            style={{
              background: qualifies
                ? 'linear-gradient(135deg, #0A2A0A, #0F0F1A)'
                : 'linear-gradient(135deg, #2A0A0A, #0F0F1A)',
              border: `1px solid ${qualifies ? '#22C55E44' : '#EF444444'}`,
            }}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl font-black" style={{
                fontFamily: 'Bebas Neue, sans-serif',
                color: qualifies ? '#22C55E' : '#EF4444',
              }}>
                {playerPosition}º
              </div>
              <div>
                <div className="text-lg font-black flex items-center gap-2" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
                  <Crest crestId={playerTeam?.crestId} name={playerTeam?.name} size={26} />
                  {playerTeam?.name}
                </div>
                <div className="text-xs" style={{
                  color: directQual ? '#22C55E' : playoffQual ? '#3B82F6' : '#EF4444',
                  fontFamily: 'Rajdhani, sans-serif',
                }}>
                  {directQual
                    ? '✓ Classificação direta às Oitavas (Top 8)'
                    : playoffQual
                      ? '✓ Zona de Playoff (9º a 24º)'
                      : '✗ Eliminado (fora do Top 24)'}
                </div>
              </div>
              <div className="ml-auto grid grid-cols-4 gap-2 sm:gap-4 text-center">
                {[
                  { label: 'PTS', value: playerStanding.points },
                  { label: 'V', value: playerStanding.won },
                  { label: 'E', value: playerStanding.drawn },
                  { label: 'D', value: playerStanding.lost },
                ].map(stat => (
                  <div key={stat.label}>
                    <div className="text-lg sm:text-xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                      {stat.value}
                    </div>
                    <div className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs — scrollable on mobile */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {(isKnockout
            ? [
                { id: 'fixtures', label: 'CONFRONTOS' },
                { id: 'bracket', label: 'CHAVEAMENTO' },
                { id: 'scorers', label: 'ESTATÍSTICAS' },
                { id: 'squad', label: 'MEU TIME' },
                { id: 'results', label: 'HISTÓRICO' },
                { id: 'shop', label: `🛒 LOJA · 💰${state.points}` },
              ]
            : [
                { id: 'fixtures', label: `RODADA ${leagueRound}` },
                { id: 'standings', label: 'CLASSIFICAÇÃO' },
                { id: 'scorers', label: 'ESTATÍSTICAS' },
                { id: 'squad', label: 'MEU TIME' },
                { id: 'results', label: 'HISTÓRICO' },
                { id: 'shop', label: `🛒 LOJA · 💰${state.points}` },
              ]
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold tracking-wider transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                background: activeTab === tab.id ? '#C9A84C' : '#0F0F1A',
                color: activeTab === tab.id ? '#080810' : '#8A8A9A',
                border: `1px solid ${activeTab === tab.id ? '#C9A84C' : '#1A1A2A'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Matches tab — knockout shows the bracket ties; league shows round fixtures */}
        {activeTab === 'fixtures' && isKnockout && <KnockoutTiesTab />}
        {activeTab === 'bracket' && isKnockout && (spoilerLock
          ? <SpoilerLock waiting={spoilerWaiting} label="CHAVEAMENTO OCULTO" />
          : <BracketTab />)}
        {activeTab === 'fixtures' && !isKnockout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold tracking-widest text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                PARTIDAS DA RODADA
              </span>
            </div>

            {currentRoundFixtures.map((fixture, idx) => {
              const isMyFixture = fixture.homeTeamId === localTeamId || fixture.awayTeamId === localTeamId;
              const isPlayer = fixture.homeTeamId === playerTeam?.id || fixture.awayTeamId === playerTeam?.id;

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
                  className="p-4 rounded-xl transition-all"
                  style={{
                    background: isMyFixture ? 'linear-gradient(135deg, #14142a, #0b0b14)' : isHumanMatch ? 'linear-gradient(135deg, #0f0f1f, #0a0a18)' : '#0F0F1A',
                    border: isMyFixture ? '1px solid #c9a84c55' : isHumanMatch ? '1px solid #6366f155' : '1px solid #1A1A2A',
                    boxShadow: isMyFixture ? '0 0 15px rgba(201, 168, 76, 0.1)' : 'none',
                  }}
                >
                 <div className="flex items-center justify-between">
                  {/* Home Team */}
                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    <span className="font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: homeColor }}>{homeName}</span>
                    <Crest crestId={allTeams.find(t => t.id === fixture.homeTeamId)?.crestId} name={homeName} size={22} />
                  </div>

                  {/* Score / VS */}
                  <div className="w-28 text-center flex flex-col items-center justify-center">
                    {fixture.played && fixture.result && !hideRoundScore ? (
                      <>
                        <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          {fixture.result.homeGoals} - {fixture.result.awayGoals}
                        </span>
                        {fixture.result.playerStats && (
                          <button onClick={() => openMatchDetails(fixture.result!)}
                            className="mt-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all hover:brightness-125"
                            style={{ background: '#14142A', border: '1px solid #2A2A3A', color: '#9AA8C8', fontFamily: 'Rajdhani, sans-serif' }}>
                            🔍 Detalhes
                          </button>
                        )}
                      </>
                    ) : hideRoundScore && fixture.played ? (
                      <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: isMyFixture ? '#C9A84C' : isHumanMatch ? '#6366f1' : '#4A4A5A' }}>
                        {isMyFixture ? '⚽ AO VIVO' : '🔒'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: isMyFixture ? '#C9A84C' : isHumanMatch ? '#6366f1' : '#4A4A5A' }}>
                        {isMyFixture ? '⚽ VS' : isHumanMatch ? '👥 VS' : 'VS'}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                    <Crest crestId={allTeams.find(t => t.id === fixture.awayTeamId)?.crestId} name={awayName} size={22} />
                    <span className="font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: awayColor }}>{awayName}</span>
                  </div>
                 </div>

                  {/* 🎯 Palpite — botão (pré-jogo) / badge de resultado (pós-revelação) */}
                  {(() => {
                    const matchKey = buildLeagueMatchKey(leagueRound, fixture.homeTeamId, fixture.awayTeamId);
                    const myBet = betFor(matchKey);
                    if (fixture.played) {
                      if (!myBet) return null;
                      if (hideRoundScore || !myBet.revealed) {
                        return <div className="mt-2 text-center text-[10px] font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>🎯 palpite em andamento</div>;
                      }
                      const txt = myBet.tier === 'exact' ? `✅ Palpite: placar exato (+${myBet.payout})`
                        : myBet.tier === 'outcome' ? `✅ Palpite: resultado certo (+${myBet.payout})`
                          : `❌ Palpite perdido (−${myBet.stake})`;
                      return <div className="mt-2 text-center text-[11px] font-black" style={{ color: myBet.won ? '#22C55E' : '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>{txt}</div>;
                    }
                    return (
                      <div className="mt-2 text-center">
                        <button onClick={() => setBetSlip({ matchKey, homeName, awayName })}
                          className="px-3 py-1 rounded-lg text-[11px] font-black tracking-wider transition-transform hover:scale-[1.03]"
                          style={{ fontFamily: 'Rajdhani, sans-serif', background: myBet ? '#C9A84C22' : '#0F0F1A', color: '#E8C84A', border: '1px solid #C9A84C55' }}>
                          {myBet ? `🎯 Palpite: ${myBet.homeGoals}-${myBet.awayGoals} · ${myBet.stake} (editar)` : '🎯 Palpitar'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {/* Advance controls */}
            {state.mode === 'online' ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 rounded-xl text-center border"
                style={{ background: '#0F0F1A', borderColor: '#1A1A2A' }}
              >
                {state.isHost ? (
                  !allFixturesPlayed ? (
                    /* Host has not started the round yet — a single press simulates
                       every match of the round at once on the server. */
                    <>
                      <button
                        onClick={handlePlayRound}
                        className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                        style={{
                          fontFamily: 'Bebas Neue, sans-serif',
                          background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                          color: '#080810',
                          boxShadow: '0 0 25px rgba(201,168,76,0.3)',
                        }}
                      >
                        ▶ JOGAR RODADA {leagueRound}
                      </button>
                      <div className="mt-2 text-[11px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        Todas as partidas da rodada começam ao mesmo tempo para todos.
                      </div>
                    </>
                  ) : !allPlayersWatched ? (
                    <div className="py-3">
                      <div className="text-sm font-bold animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#C9A84C' }}>
                        ⏳ AGUARDANDO {waitingForCount} JOGADOR{waitingForCount !== 1 ? 'ES' : ''} VEREM O RESULTADO...
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        ({humanPlayersWithMatch.length - waitingForCount}/{humanPlayersWithMatch.length} concluídos)
                      </div>
                    </div>
                  ) : leagueRound < 8 ? (
                    <button
                      onClick={handleAdvanceRound}
                      className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                      style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                        color: '#080810',
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
                        fontFamily: 'Bebas Neue, sans-serif',
                        background: 'linear-gradient(135deg, #22C55E 0%, #4ADE80 50%, #22C55E 100%)',
                        color: '#000',
                        boxShadow: '0 0 25px rgba(34,197,94,0.3)',
                      }}
                    >
                      🏆 AVANÇAR PARA O MATA-MATA →
                    </button>
                  )
                ) : (
                  !allFixturesPlayed ? (
                    <div className="py-2 text-sm font-bold text-yellow-500/80 animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      ⏳ AGUARDANDO O ANFITRIÃO INICIAR A RODADA {leagueRound}...
                    </div>
                  ) : (
                    <div className="py-2 text-sm font-bold text-green-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      👑 RODADA CONCLUÍDA! AGUARDANDO O ANFITRIÃO AVANÇAR...
                    </div>
                  )
                )}
                {state.advanceBlocked && state.advanceBlocked.length > 0 && (
                  <div className="mt-2 text-center text-[11px] font-bold text-yellow-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    ⏳ Aguardando assistirem: {state.advanceBlocked.join(', ')}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                {!isPlayerMatchPlayed ? (
                  /* Solo: o botão de JOGAR fica embaixo dos confrontos (igual ao host no online). */
                  <>
                    <button
                      onClick={handlePlayPlayerMatch}
                      className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all hover:scale-[1.01]"
                      style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                        color: '#080810',
                        boxShadow: '0 0 25px rgba(201,168,76,0.3)',
                      }}
                    >
                      ▶ JOGAR RODADA {leagueRound}
                    </button>
                  </>
                ) : leagueRound < 8 ? (
                  <button
                    onClick={handleAdvanceRound}
                    className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all"
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                      color: '#080810',
                      boxShadow: '0 0 25px rgba(201,168,76,0.3)',
                    }}
                  >
                    AVANÇAR PARA A RODADA {leagueRound + 1} →
                  </button>
                ) : (
                  <button
                    onClick={handleAdvanceKnockout}
                    disabled={!qualifies}
                    className="w-full py-4 rounded-xl font-black text-xl tracking-widest transition-all"
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      background: qualifies
                        ? 'linear-gradient(135deg, #22C55E 0%, #4ADE80 50%, #22C55E 100%)'
                        : '#1A1A2A',
                      color: qualifies ? '#000' : '#555',
                      boxShadow: qualifies ? '0 0 25px rgba(34,197,94,0.3)' : 'none',
                      cursor: qualifies ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {qualifies ? '🏆 AVANÇAR PARA O MATA-MATA →' : '❌ ELIMINADO — FORA DO TOP 24'}
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Standings table — league only (knockout has no table) */}
        {activeTab === 'standings' && !isKnockout && spoilerLock && (
          <SpoilerLock waiting={spoilerWaiting} label="CLASSIFICAÇÃO OCULTA" />
        )}
        {activeTab === 'standings' && !isKnockout && !spoilerLock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl overflow-hidden overflow-x-auto"
            style={{ border: '1px solid #1A1A2A' }}
          >
            <div style={{ minWidth: '360px' }}>
            {/* Table header */}
            <div className="grid gap-0 px-3 sm:px-4 py-2"
              style={{
                gridTemplateColumns: '1.5rem 1fr 1.8rem 1.8rem 1.8rem 1.8rem 2.4rem 1.8rem 2.4rem',
                background: '#0F0F1A',
                borderBottom: '1px solid #1A1A2A',
              }}>
              {['#', 'Time', 'J', 'V', 'E', 'D', 'GF', 'GA', 'PTS'].map(h => (
                <div key={h} className="text-[10px] sm:text-xs font-bold text-center"
                  style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                  {h}
                </div>
              ))}
            </div>

            {leagueStandings.map((entry, i) => {
              const isPlayer = entry.teamId === playerTeam?.id;
              const isDirectQual = i < 8;
              const isPlayoff = i >= 8 && i < 24;
              const isEliminated = i >= 24;

              return (
                <div
                  key={entry.teamId}
                  className="grid gap-0 px-3 sm:px-4 py-2 sm:py-2.5 items-center"
                  style={{
                    gridTemplateColumns: '1.5rem 1fr 1.8rem 1.8rem 1.8rem 1.8rem 2.4rem 1.8rem 2.4rem',
                    background: isPlayer
                      ? '#14142A'
                      : i % 2 === 0 ? '#0A0A14' : '#080810',
                    borderBottom: '1px solid #1A1A2A',
                    borderLeft: isPlayer ? '3px solid #C9A84C' : '3px solid transparent',
                  }}
                >
                  <div className="text-center">
                    <span className="text-xs sm:text-sm font-bold"
                      style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        color: i === 0 ? '#C9A84C' : isDirectQual ? '#22C55E' : isPlayoff ? '#3B82F6' : '#EF4444',
                      }}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isDirectQual && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: '#22C55E' }} />}
                    {isPlayoff && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: '#3B82F6' }} />}
                    {isEliminated && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: '#EF4444' }} />}
                    <Crest crestId={allTeams.find(t => t.id === entry.teamId)?.crestId} name={entry.teamName} size={18} />
                    <span className="text-xs sm:text-sm font-semibold truncate"
                      style={{
                        fontFamily: 'Rajdhani, sans-serif',
                        color: isPlayer ? '#C9A84C' : '#FFFFFF',
                        fontWeight: isPlayer ? 'bold' : 'normal',
                      }}>
                      {entry.teamName}
                    </span>
                  </div>
                  {[entry.played, entry.won, entry.drawn, entry.lost, entry.goalsFor, entry.goalsAgainst].map((val, vi) => (
                    <div key={vi} className="text-center text-[10px] sm:text-xs"
                      style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {val}
                    </div>
                  ))}
                  <div className="text-center text-xs sm:text-sm font-black"
                    style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                    {entry.points}
                  </div>
                </div>
              );
            })}
            </div>
          </motion.div>
        )}

        {/* Estatísticas da Temporada */}
        {activeTab === 'scorers' && spoilerLock && (
          <SpoilerLock waiting={spoilerWaiting} label="ESTATÍSTICAS OCULTAS" />
        )}
        {activeTab === 'scorers' && !spoilerLock && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Sub-tabs scrollable on mobile */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-[#09090f] border border-[#1A1A2A] overflow-x-auto scrollbar-none">
              {[
                { id: 'goals', label: 'GOLS', Icon: Goal },
                { id: 'assists', label: 'ASSISTÊNCIAS', Icon: Footprints },
                { id: 'ratings', label: 'NOTA MÉDIA', Icon: Star },
                { id: 'keepers', label: 'GOLEIROS', Icon: Hand },
                { id: 'tackles', label: 'DESARMES', Icon: Swords },
              ].map(({ id, label, Icon }) => {
                const isActive = statsSubTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setStatsSubTab(id as any)}
                    className="flex-shrink-0 py-2 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-bold transition-all text-center whitespace-nowrap"
                    style={{
                      fontFamily: 'Rajdhani, sans-serif',
                      background: isActive ? '#C9A84C' : 'transparent',
                      color: isActive ? '#080810' : '#8A8A9A',
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {label}</span>
                  </button>
                );
              })}
            </div>

            {/* List panel */}
            <div key={statsSubTab} className="rounded-xl overflow-hidden border border-[#1A1A2A]" style={{ background: '#0F0F1A' }}>
              {/* Header label */}
              <div className="px-4 py-3 border-b border-[#1A1A2A] bg-[#0A0A12] flex justify-between items-center">
                <span className="text-[10px] font-black tracking-widest text-[#6A6A7A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {statsSubTab === 'goals' && 'ARTILHARIA DO CAMPEONATO'}
                  {statsSubTab === 'assists' && 'LÍDERES EM ASSISTÊNCIAS'}
                  {statsSubTab === 'ratings' && 'MELHORES NOTAS DA TEMPORADA (MÍN. 1 JOGO)'}
                  {statsSubTab === 'keepers' && 'GOLEIROS COM MAIS DEFESAS REALIZADAS'}
                  {statsSubTab === 'tackles' && 'LÍDERES EM DESARMES DO CAMPEONATO'}
                </span>
                <span className="text-[9px] font-black text-yellow-500 tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  UCL IMMORTALS LEAGUE
                </span>
              </div>

              {(() => {
                const getActiveList = () => {
                  if (statsSubTab === 'goals') return topScorers;
                  if (statsSubTab === 'assists') return topAssists;
                  if (statsSubTab === 'ratings') return topRatings;
                  if (statsSubTab === 'keepers') return topKeepers;
                  return topTacklers;
                };

                const currentList = getActiveList();

                if (currentList.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      Nenhum registro encontrado para esta categoria ainda. Avance rodadas para computar estatísticas!
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[#1A1A2A]">
                    {currentList.slice(0, 15).map((player, i) => {
                      const isPlayerTeam = player.teamId === playerTeam?.id;

                      // Resolve metric values
                      let metricVal: string | number = 0;
                      let metricLabel = "";

                      if (statsSubTab === 'goals') {
                        metricVal = player.stats.goals;
                        metricLabel = metricVal === 1 ? 'gol' : 'gols';
                      } else if (statsSubTab === 'assists') {
                        metricVal = player.stats.assists;
                        metricLabel = metricVal === 1 ? 'assistência' : 'assistências';
                      } else if (statsSubTab === 'ratings') {
                        metricVal = player.stats.ratingAvg.toFixed(2);
                        metricLabel = 'nota média';
                      } else if (statsSubTab === 'keepers') {
                        metricVal = player.stats.saves;
                        metricLabel = metricVal === 1 ? 'defesa' : 'defesas';
                      } else if (statsSubTab === 'tackles') {
                        metricVal = player.stats.tackles;
                        metricLabel = metricVal === 1 ? 'desarme' : 'desarmes';
                      }

                      return (
                        <div
                          key={`${statsSubTab}-${player.id}`}
                          className="flex items-center gap-4 px-4 py-3"
                          style={{
                            background: isPlayerTeam ? '#14142A' : i % 2 === 0 ? '#0A0A14' : '#080810',
                          }}
                        >
                          {/* Rank number */}
                          <span className="w-6 text-center font-black text-sm" style={{
                            fontFamily: 'Bebas Neue, sans-serif',
                            color: i === 0 ? '#C9A84C' : i === 1 ? '#D1D5DB' : i === 2 ? '#B45309' : '#4B5563',
                          }}>
                            {i + 1}
                          </span>

                          {/* Player face avatar (robust fallback) */}
                          <PlayerAvatar playerId={player.id} rarity={player.rarity} size={40} />

                          {/* Player details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[8px] font-black px-1.5 py-0.2 rounded text-white" style={{ background: '#222', fontFamily: 'Rajdhani, sans-serif' }}>
                                {POS_PT[player.position] ?? player.position}
                              </span>
                              <span className="text-[9px] text-[#8A8A9A] font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                                GER {player.overall}
                              </span>
                            </div>
                            <div className="text-sm font-black text-white truncate" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                              {player.shortName}
                            </div>
                            <div className="text-[10px] text-[#6A6A7A] font-semibold truncate" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                              {player.teamName} · <span className="text-[#8A8A9A]">{player.stats.played} {player.stats.played === 1 ? 'jogo' : 'jogos'}</span>
                            </div>
                          </div>

                          {/* Metric value box */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl font-black" style={{
                              fontFamily: 'Bebas Neue, sans-serif',
                              color: '#C9A84C'
                            }}>
                              {metricVal}
                            </div>
                            <div className="text-[8px] font-black text-gray-500 tracking-wider uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                              {metricLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}

        {/* Gestão do time */}
        {activeTab === 'squad' && <LeagueSquadTab />}

        {activeTab === 'shop' && <ShopTab />}

        {/* Results */}
        {activeTab === 'results' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {/* Sub-abas do HISTÓRICO */}
            <div className="flex gap-2">
              {([['mine', 'MEUS JOGOS'], ['rounds', 'RODADAS ANTERIORES']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setResultsSubTab(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-all"
                  style={{ fontFamily: 'Rajdhani, sans-serif', background: resultsSubTab === id ? '#C9A84C22' : '#0F0F1A', color: resultsSubTab === id ? '#E8C84A' : '#8A8A9A', border: `1px solid ${resultsSubTab === id ? '#C9A84C66' : '#1A1A2A'}` }}>
                  {label}
                </button>
              ))}
            </div>

            {resultsSubTab === 'mine' ? (
            <div className="space-y-2">
            <div className="text-xs font-bold tracking-widest mb-3"
              style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              SEUS RESULTADOS ({playerResults.length} jogos disputados)
            </div>
            {playerResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                Nenhum jogo disputado ainda na Fase de Liga.
              </div>
            ) : (
              playerResults.map((result, i) => {
                const isHome = result.homeTeamId === playerTeam?.id;
                const myGoals = isHome ? result.homeGoals : result.awayGoals;
                const oppGoals = isHome ? result.awayGoals : result.homeGoals;
                const oppName = getTeamName(isHome ? result.awayTeamId : result.homeTeamId);
                const won = myGoals > oppGoals;
                const drew = myGoals === oppGoals;
                const rc = won ? '#22C55E' : drew ? '#EAB308' : '#EF4444';
                const oppCrest = getTeamById(isHome ? result.awayTeamId : result.homeTeamId)?.crestId;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.25) }}
                    className="relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,#12121e,#0b0b14)', border: `1px solid ${rc}33` }}
                  >
                    {/* barra de resultado */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: rc }} />
                    {/* V / E / D */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black flex-shrink-0"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, background: `${rc}1f`, color: rc, border: `1px solid ${rc}44` }}>
                      {won ? 'V' : drew ? 'E' : 'D'}
                    </div>
                    {/* escudo do adversário */}
                    <Crest crestId={oppCrest} name={oppName} size={30} />
                    {/* adversário + mando */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                        {isHome ? '🏠 Em casa' : '✈️ Fora'}
                      </div>
                      <div className="text-sm font-black truncate" style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>
                        {oppName}
                      </div>
                    </div>
                    {/* placar + detalhes */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-2xl font-black leading-none tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', color: rc }}>
                        {myGoals} <span style={{ opacity: .5 }}>-</span> {oppGoals}
                      </div>
                      {result.playerStats && (
                        <button onClick={() => openMatchDetails(result)}
                          className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all hover:brightness-125"
                          style={{ background: '#14142A', border: '1px solid #2A2A3A', color: '#9AA8C8', fontFamily: 'Rajdhani, sans-serif' }}>
                          🔍 Detalhes
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
            </div>
            ) : (
            /* ─── RODADAS ANTERIORES: escolha a rodada e veja TODOS os resultados ─── */
            <div className="space-y-3">
              {historyPeriods.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Nenhuma rodada disputada ainda.
                </div>
              ) : (
                <>
                  {/* Seletor de período: rodadas da liga (R1-8) + fases do mata-mata */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {historyPeriods.map(p => {
                      const isActive = p.key === historyKey;
                      return (
                        <button key={p.key} onClick={() => setSelectedHistoryKey(p.key)}
                          className="flex-shrink-0 h-9 px-2.5 rounded-lg text-sm font-black transition-all"
                          style={{ fontFamily: 'Bebas Neue, sans-serif', minWidth: 36, letterSpacing: '.03em',
                            background: isActive ? '#C9A84C' : '#0F0F1A',
                            color: isActive ? '#080810' : (p.kind === 'ko' ? '#818CF8' : '#C9A84C'),
                            border: `1px solid ${isActive ? '#C9A84C' : (p.kind === 'ko' ? '#6366f133' : '#1A1A2A')}` }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                    RESULTADOS · {historyPeriod?.kind === 'league' ? `RODADA ${historyPeriod.round} DE 8` : knockoutRoundLabel(historyPeriod?.koRound ?? '')}
                  </div>

                  {historyPeriod?.kind === 'league' ? (
                    /* Jogos da rodada de liga escolhida */
                    <div className="space-y-2">
                      {historyFixtures.map((fixture, idx) => {
                        const roundHidden = !isKnockout && historyPeriod.round === leagueRound && hideRoundScore;
                        const homeName = getTeamName(fixture.homeTeamId);
                        const awayName = getTeamName(fixture.awayTeamId);
                        const isPlayer = fixture.homeTeamId === playerTeam?.id || fixture.awayTeamId === playerTeam?.id;
                        return (
                          <div key={idx} className="p-3 rounded-xl flex items-center justify-between"
                            style={{ background: isPlayer ? 'linear-gradient(135deg,#14142a,#0b0b14)' : '#0F0F1A', border: `1px solid ${isPlayer ? '#c9a84c55' : '#1A1A2A'}` }}>
                            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                              <span className="font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: fixture.homeTeamId === playerTeam?.id ? '#C9A84C' : '#FFF' }}>{homeName}</span>
                              <Crest crestId={allTeams.find(t => t.id === fixture.homeTeamId)?.crestId} name={homeName} size={22} />
                            </div>
                            <div className="w-24 text-center flex flex-col items-center justify-center">
                              {fixture.played && fixture.result && !roundHidden ? (
                                <>
                                  <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                    {fixture.result.homeGoals} - {fixture.result.awayGoals}
                                  </span>
                                  {fixture.result.playerStats && (
                                    <button onClick={() => openMatchDetails(fixture.result!)}
                                      className="mt-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all hover:brightness-125"
                                      style={{ background: '#14142A', border: '1px solid #2A2A3A', color: '#9AA8C8', fontFamily: 'Rajdhani, sans-serif' }}>
                                      🔍 Detalhes
                                    </button>
                                  )}
                                </>
                              ) : roundHidden && fixture.played ? (
                                <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#4A4A5A' }}>🔒</span>
                              ) : (
                                <span className="text-xs font-bold text-gray-600" style={{ fontFamily: 'Rajdhani, sans-serif' }}>—</span>
                              )}
                            </div>
                            <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                              <Crest crestId={allTeams.find(t => t.id === fixture.awayTeamId)?.crestId} name={awayName} size={22} />
                              <span className="font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: fixture.awayTeamId === playerTeam?.id ? '#C9A84C' : '#FFF' }}>{awayName}</span>
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
                        const detBtn = 'px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all hover:brightness-125';
                        const detStyle = { background: '#14142A', border: '1px solid #2A2A3A', color: '#9AA8C8', fontFamily: 'Rajdhani, sans-serif' } as const;
                        return (
                          <div key={idx} className="p-3 rounded-xl"
                            style={{ background: isPlayer ? 'linear-gradient(135deg,#14142a,#0b0b14)' : '#0F0F1A', border: `1px solid ${isPlayer ? '#c9a84c55' : '#1A1A2A'}` }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                                <span className="font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: tie.homeTeamId === playerTeam?.id ? '#C9A84C' : '#FFF' }}>{homeName}</span>
                                <Crest crestId={allTeams.find(t => t.id === tie.homeTeamId)?.crestId} name={homeName} size={22} />
                              </div>
                              <div className="w-20 text-center">
                                {koRoundHidden ? (
                                  <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#4A4A5A' }}>🔒</span>
                                ) : tie.result ? (
                                  <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{tie.result.homeGoals} - {tie.result.awayGoals}</span>
                                ) : l1 ? (
                                  <span className="text-lg font-black tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>{l1.homeGoals} - {l1.awayGoals}</span>
                                ) : (
                                  <span className="text-sm font-bold text-gray-600" style={{ fontFamily: 'Rajdhani, sans-serif' }}>VS</span>
                                )}
                              </div>
                              <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                                <Crest crestId={allTeams.find(t => t.id === tie.awayTeamId)?.crestId} name={awayName} size={22} />
                                <span className="font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: tie.awayTeamId === playerTeam?.id ? '#C9A84C' : '#FFF' }}>{awayName}</span>
                              </div>
                            </div>
                            {!koRoundHidden && (l1 || l2 || tie.result) && (
                              <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                                {single ? (
                                  tie.result?.playerStats && <button className={detBtn} style={detStyle} onClick={() => openMatchDetails(tie.result)}>🔍 Detalhes</button>
                                ) : (
                                  <>
                                    {l1 && <button className={detBtn} style={detStyle} onClick={() => openMatchDetails(l1)}>👁 Ida</button>}
                                    {l2 && <button className={detBtn} style={detStyle} onClick={() => openMatchDetails(l2)}>👁 Volta</button>}
                                  </>
                                )}
                                {tie.result?.winner && (
                                  <span className="text-[10px] font-bold" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
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
          </motion.div>
        )}

      </div>

      {/* ── End-of-round reinforcement pick ── */}
      <AnimatePresence>
        {state.reinforcementOptions && state.reinforcementOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            style={{ background: 'rgba(6,6,14,0.96)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[95vh]"
              style={{ background: '#0B0B14', border: '1px solid #C9A84C55', boxShadow: '0 0 50px rgba(201,168,76,0.18)' }}
            >
              {/* Header */}
              <div className="px-5 sm:px-6 py-4 flex-shrink-0" style={{ background: 'linear-gradient(135deg,#171206,#0B0B14)', borderBottom: '1px solid #1d1d2f' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#C9A84C22', border: '1px solid #C9A84C55' }}>
                    <UserPlus size={20} style={{ color: '#E8C84A' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black tracking-widest leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>
                      REFORÇO DA RODADA
                    </h3>
                    <p className="text-[11px] sm:text-xs mt-1" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                      Escolha <b style={{ color: '#FFF' }}>1 jogador</b> para entrar no seu <b style={{ color: '#818CF8' }}>banco de reservas</b>. Depois, na aba <b style={{ color: '#C9A84C' }}>MEU TIME</b>, você pode colocá-lo entre os titulares.
                    </p>
                  </div>
                </div>
              </div>

              {/* Points earned this match */}
              {state.lastMatchPoints && (
                <div className="mx-4 sm:mx-6 mt-4 rounded-xl px-4 py-3 flex items-center justify-between flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#0d1a10,#0B0B14)', border: '1px solid #34D39955' }}>
                  <div>
                    <div className="text-[11px] font-black tracking-widest" style={{ color: '#34D399', fontFamily: 'Rajdhani, sans-serif' }}>
                      💰 PONTOS DA PARTIDA
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {state.lastMatchPoints.outcome === 'win' ? 'Vitória' : state.lastMatchPoints.outcome === 'draw' ? 'Empate' : 'Derrota'} +{state.lastMatchPoints.base}
                      {state.lastMatchPoints.gdBonus > 0 && ` · saldo +${state.lastMatchPoints.gdBonus}`}
                      {state.lastMatchPoints.goalsBonus > 0 && ` · gols +${state.lastMatchPoints.goalsBonus}`}
                      {state.lastMatchPoints.csBonus > 0 && ` · sem sofrer +${state.lastMatchPoints.csBonus}`}
                      {` · use na aba 🛒 LOJA`}
                    </div>
                  </div>
                  <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#34D399' }}>+{state.lastMatchPoints.total}</div>
                </div>
              )}

              {/* Options — bigger full cards (light, no animations) */}
              {/* Opções: grade que cabe SEM rolagem (3 col no celular, 6 no PC) */}
              <div className="px-3 sm:px-6 py-4 flex-1 min-h-0 flex items-center justify-center">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 justify-items-center">
                  {state.reinforcementOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => online ? pickReinforcementOnline(option) : dispatch({ type: 'PICK_REINFORCEMENT', player: option })}
                      className="transition-transform hover:scale-[1.06] active:scale-[0.97] focus:outline-none"
                      title={`Contratar ${option.shortName} para o banco`}
                    >
                      <PlayerCard player={option} compact lite />
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 sm:px-6 py-4 flex-shrink-0 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1d1d2f' }}>
                <span className="text-[11px] hidden sm:inline" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                  👆 Toque num card para contratar
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  {state.reinforcementRerolls > 0 && (
                    <button
                      onClick={() => online ? rerollReinforcementOnline() : dispatch({ type: 'REROLL_REINFORCEMENT' })}
                      className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                      style={{ fontFamily: 'Rajdhani, sans-serif', border: '1px solid #F472B655', background: '#F472B618', color: '#F472B6' }}
                    >
                      🔄 Re-sortear ({state.reinforcementRerolls})
                    </button>
                  )}
                  <button
                    onClick={() => online ? dismissReinforcementOnline() : dispatch({ type: 'DISMISS_REINFORCEMENT' })}
                    className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                    style={{ fontFamily: 'Rajdhani, sans-serif', border: '1px solid #2A2A3A', background: 'transparent', color: '#8A8A9A' }}
                  >
                    Pular reforço
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Post-match points popup (knockout — there's no reinforcement modal there) ── */}
      <AnimatePresence>
        {state.knockoutPointsPopup && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(6,6,14,0.93)' }}
            onClick={() => dispatch({ type: 'DISMISS_KO_POINTS' })}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl overflow-hidden text-center"
              style={{ background: '#0B0B14', border: '1px solid #34D39955', boxShadow: '0 0 50px rgba(52,211,153,0.18)' }}
            >
              <div className="px-6 pt-6 pb-2">
                <div className="text-[11px] font-black tracking-widest" style={{ color: '#34D399', fontFamily: 'Rajdhani, sans-serif' }}>💰 PONTOS DA PARTIDA</div>
                <div className="text-6xl font-black leading-none mt-2" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#34D399' }}>
                  +{state.knockoutPointsPopup.total}
                </div>
                <div className="text-[12px] mt-3 leading-relaxed" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                  {state.knockoutPointsPopup.outcome === 'win' ? 'Vitória' : state.knockoutPointsPopup.outcome === 'draw' ? 'Empate' : 'Derrota'} +{state.knockoutPointsPopup.base}
                  {state.knockoutPointsPopup.gdBonus > 0 && ` · saldo +${state.knockoutPointsPopup.gdBonus}`}
                  {state.knockoutPointsPopup.goalsBonus > 0 && ` · gols +${state.knockoutPointsPopup.goalsBonus}`}
                  {state.knockoutPointsPopup.csBonus > 0 && ` · sem sofrer +${state.knockoutPointsPopup.csBonus}`}
                </div>
                <div className="text-[11px] mt-2" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Gaste na aba 🛒 LOJA</div>
              </div>
              <button
                onClick={() => dispatch({ type: 'DISMISS_KO_POINTS' })}
                className="w-full py-3.5 mt-3 font-black tracking-widest text-sm"
                style={{ fontFamily: 'Rajdhani, sans-serif', background: '#34D39918', color: '#34D399', borderTop: '1px solid #34D39933' }}
              >
                OK
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔍 Ver Detalhes da partida (rodada / MEUS JOGOS) */}
      {detailsMatch && (
        <MatchDetailsModal
          result={detailsMatch.result}
          homeTeam={detailsMatch.homeTeam}
          awayTeam={detailsMatch.awayTeam}
          homeName={detailsMatch.homeName}
          awayName={detailsMatch.awayName}
          onClose={() => setDetailsMatch(null)}
        />
      )}

      {/* 🎯 Slip de palpite */}
      <AnimatePresence>
        {betSlip && (() => {
          const myBet = betFor(betSlip.matchKey);
          const capLeft = remainingCap + (myBet?.stake ?? 0); // editar reaproveita o próprio stake
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
    </div>
  );
}
