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
import { POS_PT } from '../lib/gameData';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';
const FIELD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-field-bg-TNi7gMGy2VJGpi28zWLUUX.webp';

export default function LeaguePage() {
  const { state, dispatch, playRoundOnline, advanceRoundOnline, getTeamById, disconnectOnline, pickReinforcementOnline, dismissReinforcementOnline } = useGame();
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

  const playerStanding = leagueStandings.find(s => s.teamId === playerTeam?.id);
  const playerPosition = leagueStandings.findIndex(s => s.teamId === playerTeam?.id) + 1;
  // New UCL format: 1–8 qualify straight to the Round of 16, 9–24 go to the
  // knockout play-offs, 25–36 are eliminated.
  const directQual = playerPosition >= 1 && playerPosition <= 8;
  const playoffQual = playerPosition >= 9 && playerPosition <= 24;
  const qualifies = directQual || playoffQual;

  // Filter fixtures for the current round
  const currentRoundFixtures = leagueFixtures.filter(f => f.round === leagueRound);

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

  const handleSimulateBots = () => {
    dispatch({ type: 'SIMULATE_BOT_MATCHES' });
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
        {!isKnockout && playerStanding && (
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
                <div className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
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
                { id: 'results', label: 'MEUS JOGOS' },
                { id: 'shop', label: `🛒 LOJA · 💰${state.points}` },
              ]
            : [
                { id: 'fixtures', label: `RODADA ${leagueRound}` },
                { id: 'standings', label: 'CLASSIFICAÇÃO' },
                { id: 'scorers', label: 'ESTATÍSTICAS' },
                { id: 'squad', label: 'MEU TIME' },
                { id: 'results', label: 'MEUS JOGOS' },
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
        {activeTab === 'bracket' && isKnockout && <BracketTab />}
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
              {!allFixturesPlayed && state.mode !== 'online' && (
                <button
                  onClick={handleSimulateBots}
                  className="text-xs font-bold text-yellow-500 hover:underline"
                  style={{ fontFamily: 'Rajdhani, sans-serif' }}
                >
                  ⚡ Simular outros jogos da rodada
                </button>
              )}
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
                  className="p-4 rounded-xl flex items-center justify-between transition-all"
                  style={{
                    background: isMyFixture ? 'linear-gradient(135deg, #14142a, #0b0b14)' : isHumanMatch ? 'linear-gradient(135deg, #0f0f1f, #0a0a18)' : '#0F0F1A',
                    border: isMyFixture ? '1px solid #c9a84c55' : isHumanMatch ? '1px solid #6366f155' : '1px solid #1A1A2A',
                    boxShadow: isMyFixture ? '0 0 15px rgba(201, 168, 76, 0.1)' : 'none',
                  }}
                >
                  {/* Home Team */}
                  <div className="flex-1 text-right font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: homeColor }}>
                    {homeName}
                  </div>

                  {/* Score / VS */}
                  <div className="w-28 text-center flex flex-col items-center justify-center">
                    {fixture.played && fixture.result && !hideRoundScore ? (
                      <span className="text-lg font-black text-yellow-500 tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                        {fixture.result.homeGoals} - {fixture.result.awayGoals}
                      </span>
                    ) : hideRoundScore && fixture.played ? (
                      <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: isMyFixture ? '#C9A84C' : isHumanMatch ? '#6366f1' : '#4A4A5A' }}>
                        {isMyFixture ? '⚽ AO VIVO' : '🔒'}
                      </span>
                    ) : isMyFixture && state.mode !== 'online' ? (
                      <button
                        onClick={handlePlayPlayerMatch}
                        className="px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider"
                        style={{ fontFamily: 'Rajdhani, sans-serif' }}
                      >
                        ⚽ JOGAR
                      </button>
                    ) : (
                      <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: isMyFixture ? '#C9A84C' : isHumanMatch ? '#6366f1' : '#4A4A5A' }}>
                        {isMyFixture ? '⚽ VS' : isHumanMatch ? '👥 VS' : 'VS'}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 text-left font-semibold text-sm truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: awayColor }}>
                    {awayName}
                  </div>
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
              isPlayerMatchPlayed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  {leagueRound < 8 ? (
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
              )
            )}
          </motion.div>
        )}

        {/* Standings table — league only (knockout has no table) */}
        {activeTab === 'standings' && !isKnockout && (
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
                <motion.div
                  key={entry.teamId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
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
                </motion.div>
              );
            })}
            </div>
          </motion.div>
        )}

        {/* Estatísticas da Temporada */}
        {activeTab === 'scorers' && (
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
                        <motion.div
                          key={`${statsSubTab}-${player.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
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
                        </motion.div>
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
            className="space-y-2"
          >
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

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl"
                    style={{
                      background: '#0F0F1A',
                      border: `1px solid ${won ? '#22C55E22' : drew ? '#EAB30822' : '#EF444422'}`,
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
                      style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        background: won ? '#22C55E22' : drew ? '#EAB30822' : '#EF444422',
                        color: won ? '#22C55E' : drew ? '#EAB308' : '#EF4444',
                      }}>
                      {won ? 'V' : drew ? 'E' : 'D'}
                    </div>
                    <div className="flex-1">
                      <span style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px' }}>
                        {isHome ? 'vs' : '@'}
                      </span>
                      {' '}
                      <span style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', fontWeight: 'bold' }}>
                        {oppName}
                      </span>
                    </div>
                    <div className="text-xl font-black"
                      style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        color: won ? '#22C55E' : drew ? '#EAB308' : '#EF4444',
                      }}>
                      {myGoals} - {oppGoals}
                    </div>
                  </motion.div>
                );
              })
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
            style={{ background: 'rgba(6,6,14,0.95)', backdropFilter: 'blur(3px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
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

              {/* Options */}
              <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 min-h-0">
                <div className="flex flex-wrap justify-center gap-2.5 sm:gap-4">
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
                <span className="text-[11px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                  👆 Toque num card para contratar
                </span>
                <button
                  onClick={() => online ? dismissReinforcementOnline() : dispatch({ type: 'DISMISS_REINFORCEMENT' })}
                  className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                  style={{ fontFamily: 'Rajdhani, sans-serif', border: '1px solid #2A2A3A', background: 'transparent', color: '#8A8A9A' }}
                >
                  Pular reforço
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
