// UCL Immortals — League Phase Page
// Show standings, round-by-round fixtures, and results

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { computeSeasonTopScorers, getPlayerSeasonStats, getAllPlayedMatchResults, PlayerSeasonStats } from '../lib/gameEngine';
import LeagueSquadTab from '../components/game/LeagueSquadTab';
import { SOFIFA_MAPPING } from '../components/game/PlayerCard';
import { POS_PT } from '../lib/gameData';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';
const FIELD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-field-bg-TNi7gMGy2VJGpi28zWLUUX.webp';

export default function LeaguePage() {
  const { state, dispatch, playRoundOnline, advanceRoundOnline, getTeamById } = useGame();
  const { leagueStandings, leagueResults, leagueFixtures, leagueRound, playerTeam } = state;
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'results' | 'squad' | 'scorers'>('fixtures');
  const [statsSubTab, setStatsSubTab] = useState<'goals' | 'assists' | 'ratings' | 'keepers' | 'tackles'>('goals');

  const allTeams = playerTeam ? [playerTeam, ...state.botTeams] : state.botTeams;

  // Aggregate stats for all players in the league
  const allPlayedResults = getAllPlayedMatchResults(leagueResults, state.knockoutBracket);
  const allPlayers = allTeams.flatMap(t =>
    t.players.map(p => ({
      ...p,
      teamName: t.name,
      teamId: t.id,
      stats: getPlayerSeasonStats(p.id, t.id, allPlayedResults),
    }))
  );

  const topScorers = [...allPlayers].filter(p => p.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals);
  const topAssists = [...allPlayers].filter(p => p.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists);
  const topRatings = [...allPlayers].filter(p => p.stats.played >= 1).sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg);
  const topKeepers = [...allPlayers].filter(p => p.position === 'GK' && p.stats.played > 0).sort((a, b) => b.stats.saves - a.stats.saves);
  const topTacklers = [...allPlayers].filter(p => p.stats.tackles > 0).sort((a, b) => b.stats.tackles - a.stats.tackles);


  const playerResults = leagueResults.filter(
    r => r.homeTeamId === playerTeam?.id || r.awayTeamId === playerTeam?.id
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

  // ONLINE: never reveal this round's scores before the local player has watched
  // their own match (avoids spoiling the result the live replay is about to show).
  const hideRoundScore = state.mode === 'online' && state.lastWatchedRound < leagueRound;

  const getPlayerPhotoUrl = (playerId: string) => {
    const baseId = Object.keys(SOFIFA_MAPPING).find(key => playerId === key || playerId.startsWith(key + '_')) || playerId.split('_')[0];
    const m = SOFIFA_MAPPING[baseId];
    return m ? `https://cdn.sofifa.net/players/${String(m.id).padStart(6, '0').slice(0,3)}/${String(m.id).padStart(6, '0').slice(3,6)}/${m.ver}_120.png` : null;
  };

  // Check if player's match in this round is already played
  const playerFixture = currentRoundFixtures.find(
    f => f.homeTeamId === playerTeam?.id || f.awayTeamId === playerTeam?.id
  );
  const isPlayerMatchPlayed = playerFixture?.played ?? false;

  // Check if all fixtures in this round are played
  const allFixturesPlayed = currentRoundFixtures.every(f => f.played);

  const getTeamName = (teamId: string) => {
    if (teamId === playerTeam?.id) return playerTeam.name;
    const onlinePlayer = state.onlinePlayers.find(p => p.id === teamId);
    if (onlinePlayer) return onlinePlayer.name;
    return state.botTeams.find(t => t.id === teamId)?.name ?? teamId;
  };

  const handlePlayPlayerMatch = () => {
    // In online mode, the player's team ID is player_0, player_1 etc. not player_team
    const myPlayerId = state.mode === 'online'
      ? state.onlinePlayers.find(p => p.socketId === state.socketId)?.id
      : playerTeam?.id;

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

    const myId = state.onlinePlayers.find(p => p.socketId === state.socketId)?.id;
    if (!myId) return;

    const myFixture = leagueFixtures.find(
      f => f.round === leagueRound && (f.homeTeamId === myId || f.awayTeamId === myId)
    );
    if (!myFixture || !myFixture.played || !myFixture.result) return;
    if (state.lastWatchedRound >= leagueRound) return;

    const home = getTeamById(myFixture.homeTeamId);
    const away = getTeamById(myFixture.awayTeamId);
    if (!home || !away) return;

    dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [home, away], result: myFixture.result });
  }, [
    state.mode, state.phase, state.currentMatchResult, state.onlinePlayers, state.socketId,
    state.lastWatchedRound, leagueFixtures, leagueRound, getTeamById, dispatch,
  ]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
        <span className="text-base sm:text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          FASE DE LIGA
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {playerStanding && (
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
              style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
              RODADA {leagueRound} DE 8
            </h2>
            <p className="hidden sm:block" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', fontSize: '13px' }}>
              Dispute rodada por rodada e classifique-se no Top 8
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 sm:px-4 py-4 max-w-4xl mx-auto w-full">
        {/* Player summary card */}
        {playerStanding && (
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
          {[
            { id: 'fixtures', label: `RODADA ${leagueRound}` },
            { id: 'standings', label: 'CLASSIFICAÇÃO' },
            { id: 'scorers', label: 'ESTATÍSTICAS' },
            { id: 'squad', label: 'MEU TIME' },
            { id: 'results', label: 'MEUS JOGOS' },
          ].map(tab => (
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

        {/* Current Round Fixtures */}
        {activeTab === 'fixtures' && (
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
              const myPlayerId = state.mode === 'online'
                ? state.onlinePlayers.find(p => p.socketId === state.socketId)?.id
                : playerTeam?.id;

              const isMyFixture = fixture.homeTeamId === myPlayerId || fixture.awayTeamId === myPlayerId;
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

              const homeColor = fixture.homeTeamId === myPlayerId ? '#C9A84C' : isHomeHuman ? '#818CF8' : '#FFF';
              const awayColor = fixture.awayTeamId === myPlayerId ? '#C9A84C' : isAwayHuman ? '#818CF8' : '#FFF';

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
                      className="w-full py-4 rounded-xl font-black text-xl tracking-widest cursor-pointer shadow-lg transition-all"
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

        {/* Standings table */}
        {activeTab === 'standings' && (
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
                { id: 'goals', label: '⚽ GOLS', data: topScorers },
                { id: 'assists', label: '👟 ASSISTÊNCIAS', data: topAssists },
                { id: 'ratings', label: '⭐ NOTA MÉDIA', data: topRatings },
                { id: 'keepers', label: '🧤 GOLEIROS (DEF.)', data: topKeepers },
                { id: 'tackles', label: '🤺 DESARMES', data: topTacklers },
              ].map(sub => {
                const isActive = statsSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setStatsSubTab(sub.id as any)}
                    className="flex-shrink-0 py-2 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-bold transition-all text-center whitespace-nowrap"
                    style={{
                      fontFamily: 'Rajdhani, sans-serif',
                      background: isActive ? '#C9A84C' : 'transparent',
                      color: isActive ? '#080810' : '#8A8A9A',
                    }}
                  >
                    {sub.label}
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
                      const photoUrl = getPlayerPhotoUrl(player.id);
                      
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

                      // Rarity color for card border avatar
                      const getBorderColor = (rarity: string) => {
                        if (rarity === 'immortal') return '#C9A84C';
                        if (rarity === 'legendary') return '#818CF8';
                        if (rarity === 'gold') return '#EAB308';
                        if (rarity === 'silver') return '#9CA3AF';
                        return '#CD7F32';
                      };

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

                          {/* Player face avatar */}
                          <div
                            className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]"
                            style={{ border: `1.5px solid ${getBorderColor(player.rarity)}` }}
                          >
                            {photoUrl ? (
                              <img src={photoUrl} alt={player.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
                            ) : (
                              <span className="text-sm font-bold" style={{ color: getBorderColor(player.rarity) }}>⚽</span>
                            )}
                          </div>

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
    </div>
  );
}
