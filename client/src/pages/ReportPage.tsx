// UCL Immortals — Championship End Screen
// Cinematic celebration / campaign summary after the tournament

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useTeams } from '../hooks/useTeams';
import { FORMATIONS, COACHES, getRarityColor, getRarityGlow, POS_PT, type Player } from '../lib/gameData';
import {
  calculateChemistry,
  getAllPlayedMatchResults,
  getPlayerSeasonStats,
  getTeamEffectiveStats,
  getChemistryLinks,
} from '../lib/gameEngine';
import FormationField, { CHEM_LINK_COLOR } from '../components/game/FormationField';
import CoachStadiumPanel from '../components/game/CoachStadiumPanel';
import { stadiumFor } from '../lib/stadium';
import Crest from '../components/game/Crest';
import PlayerCard from '../components/game/PlayerCard';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { AppShell, Button, PageContainer, TopBar } from '../design-system';

function playerInitials(player: Player): string {
  const parts = player.shortName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function HighlightPortrait({ player, color }: { player: Player; color: string }) {
  return (
    <PlayerAvatar
      playerId={player.id}
      rarity={player.rarity}
      size={54}
      rounded="rounded-xl"
      fallback={
        <span className="text-sm font-black" style={{ color, fontFamily: 'Bebas Neue, sans-serif' }}>
          {playerInitials(player)}
        </span>
      }
    />
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
  const bench = playerTeam?.players.slice(11) ?? [];

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
  const finalResult = knockoutBracket?.final?.result;
  const reportFinalResult = finalResult && playerTeam && (
    finalResult.homeTeamId === playerTeam.id || finalResult.awayTeamId === playerTeam.id
  ) ? finalResult : undefined;
  const reportIsKnockout = state.competitionFormat.id !== 'league' || !!knockoutBracket;
  const reportIsFinal = !!reportFinalResult;
  const reportIsLosing = !!playerTeam && !!reportFinalResult && (
    reportFinalResult.homeTeamId === playerTeam?.id
      ? reportFinalResult.homeGoals < reportFinalResult.awayGoals
      : reportFinalResult.awayGoals < reportFinalResult.homeGoals
  );
  const reportPlayStyle = reportFinalResult
    ? reportFinalResult.events
      .filter(event => event.type === 'tactic' && event.teamId === playerTeam?.id && event.tacticAction)
      .sort((a, b) => a.minute - b.minute)
      .at(-1)?.tacticAction ?? playerTeam?.playStyle
    : playerTeam?.playStyle;
  const effectiveStatsById = playerTeam
    ? getTeamEffectiveStats(playerTeam, {
        playStyle: reportPlayStyle,
        isKnockout: reportIsKnockout,
        isFinal: reportIsFinal,
        isLosing: reportIsLosing,
      })
    : {};
  const teamOverall = (playerTeam && chemData && starters.length === 11)
    ? Math.round(starters.reduce((s, p) => s + (effectiveStatsById[p.id]?.overall ?? p.overall), 0) / 11)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppShell immersive className="flex flex-col overflow-x-hidden">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <TopBar title="UCL IMMORTALS — FIM DE TEMPORADA" />

      {/* ── HERO: Champion or Runner-up ────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center py-10 sm:py-14 px-4 text-center">

        {isChampion ? (
          <>
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
                    CONQUISTOU A ULTIMATE CHAMPIONS LEAGUE!
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
      <PageContainer narrow className="relative z-10 flex-1 space-y-5">

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
            {/* Formação, tática e geral já aparecem no cabeçalho acima. */}
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
                  <HighlightPortrait player={topScorer.pl} color="#C9A84C" />
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
                  <HighlightPortrait player={topRating.pl} color="#22C55E" />
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
                  <HighlightPortrait player={topAssister.pl} color="#4FC3F7" />
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

        {/* Técnico + Estádio — visual completo, igual ao MEU TIME */}
        {phase >= 3 && playerTeam && coach && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <CoachStadiumPanel
              coach={coach}
              formation={formation}
              coachPrime={!!playerTeam.coachPrime}
              stadium={stadiumFor(playerTeam.coachId, !!playerTeam.coachPrime)}
              reportSummary
            />
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
            <div className="border-b px-5 py-4" style={{ borderColor: '#1A1A2A', background: isChampion ? '#C9A84C11' : 'transparent' }}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex min-w-[180px] flex-1 items-center gap-3">
                  <Crest
                    crestId={playerTeam.crestId}
                    name={playerTeam.name}
                    size={42}
                    className="flex-shrink-0 drop-shadow-[0_0_10px_rgba(201,168,76,0.25)]"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black tracking-[0.18em]" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>ESCALAÇÃO FINAL</div>
                    <div className="truncate text-base font-black" style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>{playerTeam.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {chemData && (
                    <div className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="text-[9px] font-black tracking-widest" style={{ color: '#7A8A7F', fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA</span>
                      <strong className="text-xl leading-none" style={{ color: '#22C55E', fontFamily: 'Bebas Neue, sans-serif' }}>{chemData.total}%</strong>
                    </div>
                  )}
                  <div className="h-5 w-px" style={{ background: '#2A2A3A' }} />
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-[9px] font-black tracking-widest" style={{ color: '#8A8290', fontFamily: 'Rajdhani, sans-serif' }}>GERAL DO TIME</span>
                    <strong className="text-xl leading-none" style={{ color: '#E8C84A', fontFamily: 'Bebas Neue, sans-serif' }}>{teamOverall ?? '—'}</strong>
                  </div>
                </div>
              </div>
            </div>
            {/* XI no campo, com as linhas de química (mesmo clube / nação / técnico / dupla) */}
            {formation && starters.length === 11 && chemData && (
              <div className="p-4 pb-2">
                <FormationField
                  formation={formation}
                  players={starters}
                  chemistryScores={chemData.individual}
                  showChemLines
                  chemLinks={getChemistryLinks(starters, playerTeam.coachId)}
                  showPlayerCards
                  effectiveStats={effectiveStatsById}
                />
                {/* Legenda das conexões — com a contagem de cada tipo no XI */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3">
                  {(() => {
                    const links = getChemistryLinks(starters, playerTeam.coachId);
                    return ([
                      { t: 'club' as const, l: 'Mesmo clube' },
                      { t: 'nation' as const, l: 'Mesma nação' },
                      { t: 'coach' as const, l: 'Mesmo técnico' },
                      { t: 'partner' as const, l: 'Dupla histórica' },
                    ]).map(({ t, l }) => {
                      const n = links.filter(lk => lk.type === t).length;
                      return (
                        <div key={t} className="flex items-center gap-1.5" style={{ opacity: n === 0 ? 0.4 : 1 }}>
                          <span className="inline-block w-4 h-0.5 rounded" style={{ background: CHEM_LINK_COLOR[t] }} />
                          <span className="text-[10px] font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{l} <b style={{ color: '#C9C9D5' }}>({n})</b></span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
            <div className="p-4 pt-2 space-y-4">
              {/* TITULARES — cards de verdade, iguais aos do MEU TIME */}
              <div>
                <div className="text-xs font-black tracking-widest mb-2" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>TITULARES</div>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {starters.map((pl, i) => (
                    <motion.div key={pl.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                      <PlayerCard player={pl} compact lite effectiveStats={effectiveStatsById[pl.id]} />
                    </motion.div>
                  ))}
                </div>
              </div>
              {/* RESERVAS / BANCO */}
              {bench.length > 0 && (
                <div className="pt-3 border-t" style={{ borderColor: '#1A1A2A' }}>
                  <div className="text-xs font-black tracking-widest mb-2" style={{ color: '#818CF8', fontFamily: 'Rajdhani, sans-serif' }}>🪑 RESERVAS ({bench.length})</div>
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                    {bench.map((pl, i) => (
                      <motion.div key={pl.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                        <PlayerCard player={pl} compact lite effectiveStats={effectiveStatsById[pl.id]} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Play again */}
        {phase >= 4 && (
          <Button
            type="button"
            intent="primary"
            size="large"
            onClick={() => dispatch({ type: 'RESET_GAME' })}
            className="mt-2 w-full"
          >
            🔄 JOGAR NOVAMENTE
          </Button>
        )}
      </PageContainer>
    </AppShell>
  );
}
