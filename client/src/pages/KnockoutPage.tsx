// UCL Immortals — Knockout Phase Page
// Quarter-finals, Semi-finals, Final bracket

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, KnockoutMatch } from '../contexts/GameContext';
import { MatchResult } from '../lib/gameEngine';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';
const TROPHY_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-trophy-oKrRV4CKRhdEsz5wuhybrL.webp';

interface MatchEventFeedProps {
  result: MatchResult;
  homeName: string;
  awayName: string;
  onClose: () => void;
}

function MatchEventFeed({ result, homeName, awayName, onClose }: MatchEventFeedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,16,0.95)' }}
    >
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#0F0F1A', border: '1px solid #C9A84C44' }}>
        {/* Score header */}
        <div className="px-6 py-6 text-center"
          style={{ background: 'linear-gradient(135deg, #14142A, #0F0F1A)' }}>
          <div className="text-xs font-bold tracking-widest mb-2"
            style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
            RESULTADO
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="text-right">
              <div className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
                {homeName}
              </div>
            </div>
            <div className="text-5xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
              {result.homeGoals} - {result.awayGoals}
            </div>
            <div className="text-left">
              <div className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
                {awayName}
              </div>
            </div>
          </div>
          {result.penaltyWinner && (
            <div className="text-sm mt-2" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              Pênaltis: {result.homePenalties} - {result.awayPenalties}
            </div>
          )}
        </div>

        {/* Events feed */}
        <div className="px-4 py-4 max-h-80 overflow-y-auto space-y-2">
          {result.events.slice(0, 15).map((event, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 text-sm"
            >
              <span className="text-xs font-bold flex-shrink-0 w-8 text-right"
                style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                {event.minute}'
              </span>
              <span style={{
                color: event.type === 'goal' ? '#C9A84C' :
                  event.type === 'yellow' ? '#EAB308' :
                    event.type === 'red' ? '#EF4444' : '#8A8A9A',
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: event.type === 'goal' ? 'bold' : 'normal',
              }}>
                {event.description}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-black text-lg tracking-widest"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              background: 'linear-gradient(135deg, #C9A84C, #E8C84A)',
              color: '#080810',
            }}
          >
            CONTINUAR →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function KnockoutPage() {
  const { state, dispatch, getTeamById, streamMatchEvent, onMatchEventReceived } = useGame();
  const { knockoutBracket, playerTeam } = state;
  const [viewingResult, setViewingResult] = useState<{
    result: MatchResult;
    homeName: string;
    awayName: string;
  } | null>(null);

  useEffect(() => {
    if (state.mode !== 'online') return;

    const unsubscribe = onMatchEventReceived(({ eventType, data }) => {
      if (eventType === 'match_start') {
        const myPlayerId = state.onlinePlayers.find(p => p.socketId === state.socketId)?.id;
        if (myPlayerId && (data.homeTeamId === myPlayerId || data.awayTeamId === myPlayerId)) {
          dispatch({
            type: 'PLAY_KNOCKOUT_MATCH',
            matchId: data.matchId,
            round: data.round,
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [state.mode, state.socketId, state.onlinePlayers, onMatchEventReceived, dispatch]);

  if (!knockoutBracket) return null;

  const getTeamName = (teamId: string) => {
    if (teamId === playerTeam?.id) return playerTeam.name;
    const onlinePlayer = state.onlinePlayers.find(p => p.id === teamId);
    if (onlinePlayer) return onlinePlayer.name;
    return state.botTeams.find(t => t.id === teamId)?.name ?? 'TBD';
  };

  const isPlayerTeam = (teamId: string) =>
    teamId === playerTeam?.id ||
    (state.mode === 'online' && state.onlinePlayers.some(p => p.id === teamId && p.socketId === state.socketId));

  const playMatch = (matchId: string, round: string) => {
    if (state.mode === 'online' && knockoutBracket) {
      const allMatches = [
        ...knockoutBracket.quarterFinals,
        ...knockoutBracket.semiFinals,
        ...(knockoutBracket.final ? [knockoutBracket.final] : []),
      ];
      const match = allMatches.find(m => m.id === matchId);
      if (match) {
        streamMatchEvent('match_start', {
          matchId,
          round,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
        });
      }
    }
    dispatch({ type: 'PLAY_KNOCKOUT_MATCH', matchId, round });
  };

  const simulateAllInRound = (matches: KnockoutMatch[], round: string) => {
    const unplayed = matches.filter(m => !m.played);
    for (const match of unplayed) {
      dispatch({ type: 'PLAY_KNOCKOUT_MATCH', matchId: match.id, round });
    }
  };

  const getRoundMatches = (): { matches: KnockoutMatch[]; round: string; label: string } => {
    if (knockoutBracket.currentRound === 'quarters') {
      return { matches: knockoutBracket.quarterFinals, round: 'quarters', label: 'QUARTAS DE FINAL' };
    } else if (knockoutBracket.currentRound === 'semis') {
      return { matches: knockoutBracket.semiFinals, round: 'semis', label: 'SEMIFINAIS' };
    } else {
      return { matches: knockoutBracket.final ? [knockoutBracket.final] : [], round: 'final', label: 'GRANDE FINAL' };
    }
  };

  const { matches, round, label } = getRoundMatches();
  const allPlayed = matches.every(m => m.played);
  const isFinal = round === 'final';

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

        {/* Matches */}
        <div className="space-y-4">
          {matches.map((match, i) => {
            const homeName = getTeamName(match.homeTeamId);
            const awayName = getTeamName(match.awayTeamId);
            const homeIsPlayer = isPlayerTeam(match.homeTeamId);
            const awayIsPlayer = isPlayerTeam(match.awayTeamId);
            const hasPlayer = homeIsPlayer || awayIsPlayer;

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
                    <div className="flex-shrink-0 w-16 sm:w-24 text-center">
                      {match.played && match.result ? (
                        <div>
                          <div className="text-2xl sm:text-3xl font-black"
                            style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                            {match.result.homeGoals} - {match.result.awayGoals}
                          </div>
                          {match.result.penaltyWinner && (
                            <div className="text-[10px] sm:text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                              ({match.result.homePenalties}-{match.result.awayPenalties} pen)
                            </div>
                          )}
                          <div className="text-[10px] sm:text-xs mt-1 font-bold"
                            style={{
                              color: '#22C55E',
                              fontFamily: 'Rajdhani, sans-serif',
                            }}>
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
                    {!match.played ? (
                      <button
                        onClick={() => playMatch(match.id, round)}
                        className="px-6 py-2.5 rounded-xl font-black text-sm tracking-wider"
                        style={{
                          fontFamily: 'Bebas Neue, sans-serif',
                          background: hasPlayer
                            ? 'linear-gradient(135deg, #C9A84C, #E8C84A)'
                            : '#1B4FD8',
                          color: hasPlayer ? '#080810' : '#FFFFFF',
                          boxShadow: hasPlayer ? '0 0 20px rgba(201,168,76,0.3)' : 'none',
                        }}
                      >
                        {hasPlayer ? '⚽ JOGAR AGORA' : '▶ SIMULAR'}
                      </button>
                    ) : (
                      <button
                        onClick={() => match.result && setViewingResult({
                          result: match.result,
                          homeName,
                          awayName,
                        })}
                        className="px-4 py-2 rounded-lg text-xs font-bold"
                        style={{
                          background: '#1A1A2A',
                          color: '#8A8A9A',
                          fontFamily: 'Rajdhani, sans-serif',
                          border: '1px solid #333',
                        }}
                      >
                        VER DETALHES
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Simulate all button */}
        {!allPlayed && matches.some(m => !m.played && !isPlayerTeam(m.homeTeamId) && !isPlayerTeam(m.awayTeamId)) && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => simulateAllInRound(matches.filter(m => !isPlayerTeam(m.homeTeamId) && !isPlayerTeam(m.awayTeamId)), round)}
            className="w-full mt-4 py-3 rounded-xl font-black text-base tracking-wider"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              background: '#1A1A2A',
              color: '#8A8A9A',
              border: '1px solid #333',
            }}
          >
            SIMULAR OUTROS JOGOS
          </motion.button>
        )}
      </div>

      {/* Match result modal */}
      <AnimatePresence>
        {viewingResult && (
          <MatchEventFeed
            result={viewingResult.result}
            homeName={viewingResult.homeName}
            awayName={viewingResult.awayName}
            onClose={() => setViewingResult(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
