// UCL Immortals — Championship End Screen
// Cinematic celebration / campaign summary after the tournament

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useTeams } from '../hooks/useTeams';
import { FORMATIONS, COACHES, getTacticById, getRarityColor, getRarityGlow, POS_PT } from '../lib/gameData';
import {
  calculateChemistry,
  getAllPlayedMatchResults,
  getPlayerSeasonStats,
  getPlayerEffectiveStats,
} from '../lib/gameEngine';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';
const TROPHY_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-trophy-oKrRV4CKRhdEsz5wuhybrL.webp';

// ── Stable particle data (computed once at module load) ──────────────────────
const CONFETTI = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  size: Math.random() * 9 + 4,
  color: ['#C9A84C', '#E8C84A', '#FFFFFF', '#1B4FD8', '#22C55E', '#EF4444', '#A855F7'][
    Math.floor(Math.random() * 7)
  ],
  delay: Math.random() * 7,
  duration: 3.5 + Math.random() * 3.5,
  xDrift: (Math.random() - 0.5) * 280,
  spin: Math.random() * 720 * (Math.random() > 0.5 ? 1 : -1),
  isSquare: Math.random() > 0.5,
}));

const FIREWORK_BURSTS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  cx: 8 + i * 12,
  cy: 8 + Math.random() * 28,
  delay: 0.3 + i * 0.55,
  color: ['#C9A84C', '#E8C84A', '#FFFFFF', '#1B4FD8', '#22C55E', '#EF4444', '#A855F7', '#C9A84C'][i],
  rays: 10 + Math.floor(Math.random() * 6),
}));

const STAR_FIELD = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  opacity: Math.random() * 0.6 + 0.1,
  twinkleDuration: 1.5 + Math.random() * 3,
  twinkleDelay: Math.random() * 4,
}));

// ── Firework burst ray component ─────────────────────────────────────────────
function FireworkBurst({ cx, cy, color, rays, delay }: { cx: number; cy: number; color: string; rays: number; delay: number }) {
  return (
    <>
      {Array.from({ length: rays }, (_, r) => {
        const angle = (r / rays) * 360;
        const length = 3 + Math.random() * 5;
        return (
          <motion.div
            key={r}
            className="absolute origin-center"
            style={{
              left: `${cx}%`,
              top: `${cy}%`,
              width: 2,
              height: 2,
              background: color,
              borderRadius: '50%',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0.8, 0],
              scale: [0, 1],
              x: [0, Math.cos((angle * Math.PI) / 180) * length * 12],
              y: [0, Math.sin((angle * Math.PI) / 180) * length * 12],
            }}
            transition={{
              duration: 1.2,
              delay,
              repeat: Infinity,
              repeatDelay: FIREWORK_BURSTS.length * 0.55 + 1,
              ease: [0.2, 0, 0.8, 1],
            }}
          />
        );
      })}
    </>
  );
}

export default function ReportPage() {
  const { state, dispatch } = useGame();
  const { report, playerTeam, champion, leagueResults, knockoutBracket } = state;
  const { localTeamId, allTeams: allTeamsForStats } = useTeams();

  const isChampion = champion === localTeamId;

  const formation = FORMATIONS.find(f => f.id === playerTeam?.formationId);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const chemData = playerTeam
    ? calculateChemistry(playerTeam.players.slice(0, 11), playerTeam.coachId, formationRoles, playerTeam.formationId)
    : null;

  const allResults = useMemo(
    () => getAllPlayedMatchResults(leagueResults, knockoutBracket) as any[],
    [leagueResults, knockoutBracket]
  );

  const playerResults = useMemo(
    () => allResults.filter((r: any) => r.homeTeamId === localTeamId || r.awayTeamId === localTeamId),
    [allResults, localTeamId]
  );

  const wins   = playerResults.filter((r: any) => r.winner === localTeamId).length;
  const draws  = playerResults.filter((r: any) => r.winner === null).length;
  const losses = playerResults.filter((r: any) => r.winner !== null && r.winner !== localTeamId).length;
  const totalGoals = playerResults.reduce((s: number, r: any) => s + (r.homeTeamId === localTeamId ? r.homeGoals : r.awayGoals), 0);
  const goalsAgainst = playerResults.reduce((s: number, r: any) => s + (r.homeTeamId === localTeamId ? r.awayGoals : r.homeGoals), 0);

  // ── Top performers across the whole season ────────────────────────────────
  const topScorer = useMemo(() => {
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getPlayerSeasonStats(pl.id, team.id, allResults);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals)[0] ?? null;
  }, [allResults]);

  const topRating = useMemo(() => {
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getPlayerSeasonStats(pl.id, team.id, allResults);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.played >= 3).sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg)[0] ?? null;
  }, [allResults]);

  const topAssister = useMemo(() => {
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getPlayerSeasonStats(pl.id, team.id, allResults);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists)[0] ?? null;
  }, [allResults]);

  // ── Champion team name (works for bot or any human in online mode) ─────────
  const championName = useMemo(() => {
    if (!champion) return '';
    const onlineP = state.onlinePlayers.find(p => p.id === champion);
    if (onlineP) return onlineP.team?.name ?? onlineP.name;
    return state.botTeams.find(t => t.id === champion)?.name ?? 'Campeão';
  }, [champion]);

  // ── Cinematic reveal phases ────────────────────────────────────────────────
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const starters = playerTeam?.players.slice(0, 11) ?? [];

  // ── Extra campaign metrics ────────────────────────────────────────────────
  const games = playerResults.length;
  const goalDiff = totalGoals - goalsAgainst;
  const aproveitamento = games > 0 ? Math.round(((wins * 3 + draws) / (games * 3)) * 100) : 0;
  const cleanSheets = playerResults.filter((r: any) => (r.homeTeamId === localTeamId ? r.awayGoals : r.homeGoals) === 0).length;
  const biggestWin = useMemo(() => {
    const margins = playerResults
      .filter((r: any) => r.winner === localTeamId)
      .map((r: any) => {
        const gf = r.homeTeamId === localTeamId ? r.homeGoals : r.awayGoals;
        const ga = r.homeTeamId === localTeamId ? r.awayGoals : r.homeGoals;
        return { gf, ga, m: gf - ga };
      });
    return margins.sort((a: any, b: any) => b.m - a.m)[0] ?? null;
  }, [playerResults, localTeamId]);
  const coach = COACHES.find(c => c.id === playerTeam?.coachId);
  const tacticName = getTacticById(playerTeam?.playStyle).name;
  const teamOverall = (playerTeam && chemData && starters.length === 11)
    ? Math.round(starters.reduce((s, p) => s + getPlayerEffectiveStats(p, chemData.individual[p.id] ?? 0, chemData.outOfPosition[p.id] ?? false, playerTeam.coachId, chemData.total, playerTeam.playStyle).overall, 0) / 11)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: '#050510' }}>

      {/* ── BACKGROUND: starfield ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {STAR_FIELD.map(s => (
          <motion.div
            key={s.id}
            className="absolute rounded-full"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, background: '#fff', opacity: s.opacity }}
            animate={{ opacity: [s.opacity, s.opacity * 0.2, s.opacity] }}
            transition={{ duration: s.twinkleDuration, repeat: Infinity, delay: s.twinkleDelay, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* ── BACKGROUND: confetti (champion only) ──────────────────────────── */}
      {isChampion && phase >= 2 && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {CONFETTI.map(p => (
            <motion.div
              key={p.id}
              className="absolute"
              style={{
                width: p.size, height: p.size,
                background: p.color,
                left: `${p.x}%`,
                top: -20,
                borderRadius: p.isSquare ? 2 : '50%',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: ['0vh', '105vh'], x: [0, p.xDrift], rotate: [0, p.spin] }}
              transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'linear' }}
            />
          ))}
        </div>
      )}

      {/* ── BACKGROUND: firework bursts (champion only) ───────────────────── */}
      {isChampion && phase >= 2 && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {FIREWORK_BURSTS.map(b => (
            <FireworkBurst key={b.id} cx={b.cx} cy={b.cy} color={b.color} rays={b.rays} delay={b.delay} />
          ))}
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: '#1A1A2A', background: 'rgba(8,8,16,0.8)' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-8 h-8 object-contain" />
        <span className="text-base font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          UCL IMMORTALS — FIM DE TEMPORADA
        </span>
      </div>

      {/* ── HERO: Champion or Runner-up ────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center py-10 sm:py-14 px-4 text-center">

        {isChampion ? (
          <>
            {/* Pulsing glow ring behind trophy */}
            <AnimatePresence>
              {phase >= 1 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute"
                  style={{ width: 220, height: 220 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ opacity: [0.25, 0.6, 0.25], scale: [1, 1.15, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.6) 0%, transparent 70%)' }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ opacity: [0.1, 0.35, 0.1], scale: [1.1, 1.35, 1.1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                    style={{ background: 'radial-gradient(circle, rgba(232,200,74,0.4) 0%, transparent 70%)' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trophy */}
            <AnimatePresence>
              {phase >= 1 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.3, y: 40 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 14 }}
                  className="relative z-10"
                >
                  <motion.img
                    src={TROPHY_URL}
                    alt="Troféu"
                    className="w-36 sm:w-44 object-contain"
                    animate={{ rotate: [-4, 4, -4], y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ filter: 'drop-shadow(0 0 50px rgba(201,168,76,0.9)) drop-shadow(0 0 100px rgba(232,200,74,0.5))' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* CAMPEÃO! heading */}
            <AnimatePresence>
              {phase >= 2 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="mt-4"
                >
                  <h1
                    className="text-7xl sm:text-8xl font-black tracking-widest leading-none"
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      color: '#E8C84A',
                      textShadow: '0 0 40px rgba(232,200,74,0.9), 0 0 80px rgba(201,168,76,0.5)',
                    }}
                  >
                    CAMPEÃO!
                  </h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl sm:text-2xl font-black mt-2 tracking-wide"
                    style={{ fontFamily: 'Rajdhani, sans-serif', color: '#fff' }}
                  >
                    {playerTeam?.name}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-sm mt-1 font-bold tracking-widest"
                    style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}
                  >
                    CONQUISTOU A UEFA CHAMPIONS LEAGUE!
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* ── NOT CHAMPION ── */
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                className="flex flex-col items-center"
              >
                <div className="text-6xl mb-4 select-none">🏅</div>
                <h1
                  className="text-5xl sm:text-6xl font-black tracking-widest"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}
                >
                  CAMPANHA ENCERRADA
                </h1>
                <p className="text-base mt-3 font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                  Você deu tudo, mas não chegou até o topo desta vez.
                </p>
                <div className="mt-4 px-5 py-2.5 rounded-full font-bold text-sm tracking-wider"
                  style={{ background: '#0F0F1A', border: '1px solid #C9A84C44', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                  🏆 CAMPEÃO: {championName}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ── SCROLLABLE CONTENT ────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 px-4 pb-10 max-w-2xl mx-auto w-full space-y-5">

        {/* Stats grid */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-3 sm:grid-cols-6 gap-2"
            >
              {[
                { label: 'JOGOS', value: playerResults.length, color: '#fff' },
                { label: 'V', value: wins, color: '#22C55E' },
                { label: 'E', value: draws, color: '#EAB308' },
                { label: 'D', value: losses, color: '#EF4444' },
                { label: 'GOLS', value: totalGoals, color: '#C9A84C' },
                { label: 'SOFRIDOS', value: goalsAgainst, color: '#8A8A9A' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-xl p-3 text-center"
                  style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
                >
                  <div className="text-2xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: s.color }}>{s.value}</div>
                  <div className="text-[10px] font-bold tracking-widest mt-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* W/D/L bar */}
        {phase >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl px-5 py-4"
            style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
          >
            <div className="text-[10px] font-black tracking-widest mb-3" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>DESEMPENHO GERAL</div>
            <div className="h-2.5 rounded-full overflow-hidden flex gap-0.5">
              {wins > 0 && <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(wins / Math.max(playerResults.length, 1)) * 100}%` }} transition={{ delay: 0.3, duration: 0.7 }} style={{ background: '#22C55E' }} />}
              {draws > 0 && <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(draws / Math.max(playerResults.length, 1)) * 100}%` }} transition={{ delay: 0.5, duration: 0.5 }} style={{ background: '#EAB308' }} />}
              {losses > 0 && <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(losses / Math.max(playerResults.length, 1)) * 100}%` }} transition={{ delay: 0.7, duration: 0.5 }} style={{ background: '#EF4444' }} />}
            </div>
            <div className="flex gap-5 mt-3">
              {[{ label: `${wins} Vitórias`, color: '#22C55E' }, { label: `${draws} Empates`, color: '#EAB308' }, { label: `${losses} Derrotas`, color: '#EF4444' }].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs font-bold" style={{ color: s.color, fontFamily: 'Rajdhani, sans-serif' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Ficha da campanha — team meta + advanced stats */}
        {phase >= 3 && playerTeam && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl overflow-hidden"
            style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
          >
            <div className="px-5 py-3 border-b" style={{ borderColor: '#1A1A2A' }}>
              <span className="text-[10px] font-black tracking-widest" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>FICHA DA CAMPANHA</span>
            </div>
            {/* Team identity */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0" style={{ borderColor: '#1A1A2A' }}>
              {[
                { l: 'TÉCNICO', v: coach?.name ?? '—', c: '#A78BFA' },
                { l: 'FORMAÇÃO', v: playerTeam.formationId, c: '#fff' },
                { l: 'TÁTICA', v: tacticName, c: '#4FC3F7' },
                { l: 'OVERALL', v: teamOverall != null ? `${teamOverall}` : '—', c: '#E8C84A' },
              ].map(m => (
                <div key={m.l} className="px-4 py-3" style={{ borderColor: '#1A1A2A' }}>
                  <div className="text-[9px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{m.l}</div>
                  <div className="text-sm font-black truncate mt-0.5" style={{ color: m.c, fontFamily: 'Rajdhani, sans-serif' }}>{m.v}</div>
                </div>
              ))}
            </div>
            {/* Advanced stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t" style={{ borderColor: '#1A1A2A' }}>
              {[
                { l: 'SALDO DE GOLS', v: `${goalDiff > 0 ? '+' : ''}${goalDiff}`, c: goalDiff >= 0 ? '#22C55E' : '#EF4444' },
                { l: 'APROVEITAMENTO', v: `${aproveitamento}%`, c: '#22C55E' },
                { l: 'JOGOS S/ SOFRER', v: `${cleanSheets}`, c: '#3B82F6' },
                { l: 'MAIOR VITÓRIA', v: biggestWin ? `${biggestWin.gf}–${biggestWin.ga}` : '—', c: '#C9A84C' },
              ].map(m => (
                <div key={m.l} className="px-4 py-3 border-r" style={{ borderColor: '#1A1A2A' }}>
                  <div className="text-lg font-black leading-none" style={{ color: m.c, fontFamily: 'Bebas Neue, sans-serif' }}>{m.v}</div>
                  <div className="text-[9px] font-bold tracking-widest mt-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{m.l}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Top performers */}
        {phase >= 3 && (topScorer || topRating || topAssister) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl overflow-hidden"
            style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
          >
            <div className="px-5 py-3 border-b" style={{ borderColor: '#1A1A2A' }}>
              <span className="text-[10px] font-black tracking-widest" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>DESTAQUES DA TEMPORADA</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#1A1A2A' }}>
              {topScorer && (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>⚽</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>ARTILHEIRO</div>
                    <div className="text-base font-black truncate" style={{ color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>{topScorer.pl.shortName}</div>
                    <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{topScorer.team.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>{topScorer.stats.goals}</div>
                    <div className="text-[10px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>gols</div>
                  </div>
                </div>
              )}
              {topRating && (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#22C55E' }}>⭐</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>MELHOR NOTA MÉDIA</div>
                    <div className="text-base font-black truncate" style={{ color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>{topRating.pl.shortName}</div>
                    <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{topRating.team.name} · {topRating.stats.played} jogos</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#22C55E' }}>{topRating.stats.ratingAvg.toFixed(1)}</div>
                    <div className="text-[10px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>nota</div>
                  </div>
                </div>
              )}
              {topAssister && (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#4FC3F7' }}>👟</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>REI DAS ASSISTÊNCIAS</div>
                    <div className="text-base font-black truncate" style={{ color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>{topAssister.pl.shortName}</div>
                    <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{topAssister.team.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#4FC3F7' }}>{topAssister.stats.assists}</div>
                    <div className="text-[10px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>assist.</div>
                  </div>
                </div>
              )}
              {report && report.historicalRecreations.length > 0 && (
                <div className="flex items-start gap-4 px-5 py-4">
                  <div className="text-2xl">⚡</div>
                  <div>
                    <div className="text-[10px] font-bold tracking-widest mb-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>PARCERIAS HISTÓRICAS RECRIADAS</div>
                    {report.historicalRecreations.map(trio => (
                      <div key={trio} className="text-sm font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>{trio}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Squad showcase */}
        {phase >= 4 && playerTeam && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-xl overflow-hidden"
            style={{ background: '#0F0F1A', border: `1px solid ${isChampion ? '#C9A84C55' : '#1A1A2A'}` }}
          >
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: '#1A1A2A', background: isChampion ? '#C9A84C11' : 'transparent' }}>
              <span className="text-[10px] font-black tracking-widest" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                {isChampion ? '🏆 ' : ''}ELENCO — {playerTeam.name}
              </span>
              {chemData && (
                <span className="ml-auto text-xs font-bold" style={{ color: '#3B82F6', fontFamily: 'Rajdhani, sans-serif' }}>
                  ⚗️ {chemData.total}%
                </span>
              )}
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {starters.map((pl, i) => (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: '#14142A',
                    border: `1px solid ${getRarityColor(pl.rarity)}33`,
                    boxShadow: pl.rarity === 'immortal' || pl.rarity === 'legendary' ? getRarityGlow(pl.rarity) : 'none',
                  }}
                >
                  <div className="flex-shrink-0 w-5 h-5 rounded text-[9px] font-black flex items-center justify-center"
                    style={{ background: getRarityColor(pl.rarity) + '33', color: getRarityColor(pl.rarity), fontFamily: 'Rajdhani, sans-serif' }}>
                    {(POS_PT as any)[pl.position] ?? pl.position}
                  </div>
                  <span className="text-xs font-bold truncate" style={{ color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>{pl.shortName}</span>
                  <span className="ml-auto text-[10px] font-black flex-shrink-0" style={{ color: getRarityColor(pl.rarity), fontFamily: 'Bebas Neue, sans-serif' }}>
                    {pl.overall}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Play again */}
        {phase >= 4 && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => dispatch({ type: 'RESET_GAME' })}
            className="w-full py-5 rounded-xl font-black text-2xl tracking-widest mt-2"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
              color: '#080810',
              boxShadow: '0 0 40px rgba(201,168,76,0.35)',
            }}
          >
            🔄 JOGAR NOVAMENTE
          </motion.button>
        )}
      </div>
    </div>
  );
}
