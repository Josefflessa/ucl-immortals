// UCL Immortals — Championship End Screen
// Cinematic celebration / campaign summary after the tournament

import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useAccount } from '../contexts/AccountContext';
import { useTeams } from '../hooks/useTeams';
import { FORMATIONS, COACHES, type Player } from '@shared/game/gameData';
import {
  calculateChemistry,
  getAllPlayedMatchResults,
  getPlayerSeasonStats,
  getTeamEffectiveStats,
  getChemistryLinks,
  type EffectiveStats,
} from '@shared/game/gameEngine';
import FormationField, { CHEM_LINK_COLOR } from '../components/game/FormationField';
import CoachStadiumPanel from '../components/game/CoachStadiumPanel';
import { projectLevel } from '@shared/game/clubProjects';
import Crest from '../components/game/Crest';
import PlayerCard from '../components/game/PlayerCard';
import PlayerAvatar from '../components/game/PlayerAvatar';
import PlayerDetailsModal from '../components/game/PlayerDetailsModal';
import { AppShell, Button, PageContainer, TopBar } from '../design-system';
import type { CompetitionHistoryEntry } from '../contexts/AccountContext';
import { getCompetitionHistorySnapshot, type CompetitionHistorySnapshot } from '../lib/historySnapshot';
import { competitionRankingPoints } from '@shared/game/competitionRanking';

type SavedEffectiveCardStats = Pick<EffectiveStats,
  'overall' | 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'vision' | 'composure'>;

function playerInitials(player: Player): string {
  const parts = player.shortName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function HighlightPortrait({ player, color }: { player: Player; color: string }) {
  return (
    <PlayerAvatar
      playerId={player.id}
      photoUrl={player.photoUrl}
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

interface ReportPageProps {
  historyEntry?: CompetitionHistoryEntry;
  historySnapshot?: CompetitionHistorySnapshot | null;
  onHistoryBack?: () => void;
}

function reportNumber(report: Record<string, unknown>, key: string): number | null {
  const value = report[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function LegacyHistoryReport({ entry, onBack }: { entry: CompetitionHistoryEntry; onBack?: () => void }) {
  const report = entry.report ?? {};
  const wins = reportNumber(report, 'wins');
  const draws = reportNumber(report, 'draws');
  const losses = reportNumber(report, 'losses');
  const summary = [
    ['JOGOS', reportNumber(report, 'games') ?? reportNumber(report, 'matches')],
    ['VITÓRIAS', wins],
    ['EMPATES', draws],
    ['DERROTAS', losses],
    ['GOLS', reportNumber(report, 'goals')],
    ['SOFRIDOS', reportNumber(report, 'goalsAgainst')],
  ] as const;
  return (
    <AppShell immersive className="flex flex-col overflow-x-hidden">
      <TopBar title="UCL IMMORTALS — FIM DE TEMPORADA" right={onBack ? <Button type="button" intent="ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> HISTÓRICO</Button> : undefined} />
      <div className="relative z-10 flex flex-col items-center justify-center px-4 py-10 text-center sm:py-14">
        <div className="mb-4 select-none text-6xl">{entry.champion ? '🏆' : '🏅'}</div>
        <h1 className="font-display text-5xl text-[var(--ui-text)] sm:text-7xl">{entry.champion ? 'CAMPEÃO!' : 'CAMPANHA ENCERRADA'}</h1>
        <div className="mt-3 flex items-center gap-3 rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-5 py-2.5">
          <Crest crestId={entry.crest_id} name={entry.team_name} size={34} />
          <span className="font-display text-xl text-[var(--ui-text)]">{entry.team_name}</span>
        </div>
      </div>
      <PageContainer narrow className="relative z-10 flex-1 space-y-4">
        <section aria-label="Resumo da competição" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summary.map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-4 text-center">
            <div className="font-display text-3xl leading-none text-[var(--ui-brand-strong)]">{value ?? '—'}</div>
            <div className="mt-1 text-[12px] font-bold tracking-widest text-[var(--ui-text-faint)]">{label}</div>
          </div>)}
        </section>
        <p className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-4 py-3 text-sm text-[var(--ui-text-muted)]">
          {entry.report.snapshotArchived === true
            ? 'O relatório detalhado foi arquivado para liberar espaço. O resumo da competição continua salvo.'
            : 'Esta competição foi salva antes de o jogo guardar escalação e detalhes completos do resultado.'}
        </p>
        {onBack ? <Button type="button" intent="primary" size="large" onClick={onBack} className="w-full"><ArrowLeft size={16} aria-hidden="true" /> VOLTAR AO HISTÓRICO</Button> : null}
      </PageContainer>
    </AppShell>
  );
}

export default function ReportPage({ historyEntry, historySnapshot: providedSnapshot, onHistoryBack }: ReportPageProps = {}) {
  const { state, dispatch, leaveRoomOnline, discardSoloCampaign } = useGame();
  const { account, saveHistory, markCompetitionCompleted } = useAccount();
  const historySnapshot = providedSnapshot ?? (historyEntry ? getCompetitionHistorySnapshot(historyEntry.report) : null);
  const { localTeamId: liveTeamId, allTeams: allTeamsForStats } = useTeams();
  const report = historySnapshot ? historySnapshot.report : state.report;
  const playerTeam = historySnapshot ? historySnapshot.playerTeam : state.playerTeam;
  const champion = historySnapshot ? historySnapshot.championId : state.champion;
  const localTeamId = historySnapshot ? historySnapshot.playerTeam.id : liveTeamId;
  const leagueResults = state.leagueResults;
  const knockoutBracket = state.knockoutBracket;

  const isChampion = champion === localTeamId;

  const formation = FORMATIONS.find(f => f.id === playerTeam?.formationId);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const chemData = playerTeam
    ? calculateChemistry(playerTeam.players.slice(0, 11), playerTeam.coachId, formationRoles, playerTeam.formationId)
    : null;

  const allResults = useMemo(
    () => historySnapshot ? [] : getAllPlayedMatchResults(leagueResults, knockoutBracket) as any[],
    [historySnapshot, leagueResults, knockoutBracket]
  );

  const playerResults = useMemo(
    () => historySnapshot
      ? historySnapshot.matches
      : allResults.filter((r: any) => r.homeTeamId === localTeamId || r.awayTeamId === localTeamId),
    [allResults, historySnapshot, localTeamId]
  );

  const wins   = playerResults.filter((r: any) => r.winner === localTeamId).length;
  const draws  = playerResults.filter((r: any) => r.winner === null).length;
  const losses = playerResults.filter((r: any) => r.winner !== null && r.winner !== localTeamId).length;
  const totalGoals = playerResults.reduce((s: number, r: any) => s + (r.homeTeamId === localTeamId ? r.homeGoals : r.awayGoals), 0);
  const goalsAgainst = playerResults.reduce((s: number, r: any) => s + (r.homeTeamId === localTeamId ? r.awayGoals : r.homeGoals), 0);

  const handlePlayAgain = () => {
    if (historyEntry) {
      onHistoryBack?.();
      return;
    }
    // The report can also be reached from an online room. Resetting only the
    // local reducer leaves the socket subscribed to the finished room, whose
    // next authoritative update would immediately restore the old competition.
    if (state.mode === 'online' && state.roomCode) {
      leaveRoomOnline();
    } else {
      // The solo campaign is over; its autosave is no longer resumable.
      void discardSoloCampaign();
    }
    dispatch({ type: 'RESET_GAME' });
  };

  // ── Top performers across the whole season ────────────────────────────────
  const topScorer = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topScorer;
      return leader ? { pl: leader.player as Player, team: { name: leader.teamName }, stats: { goals: leader.value } } : null;
    }
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getPlayerSeasonStats(pl.id, team.id, allResults);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals)[0] ?? null;
  }, [allResults, allTeamsForStats, historySnapshot]);

  const topRating = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topRating;
      return leader ? { pl: leader.player as Player, team: { name: leader.teamName }, stats: { played: leader.played ?? 0, ratingAvg: leader.value } } : null;
    }
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getPlayerSeasonStats(pl.id, team.id, allResults);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.played >= 3).sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg)[0] ?? null;
  }, [allResults, allTeamsForStats, historySnapshot]);

  const topAssister = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topAssister;
      return leader ? { pl: leader.player as Player, team: { name: leader.teamName }, stats: { assists: leader.value } } : null;
    }
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getPlayerSeasonStats(pl.id, team.id, allResults);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists)[0] ?? null;
  }, [allResults, allTeamsForStats, historySnapshot]);

  // ── Champion team name (works for bot or any human in online mode) ─────────
  const championName = useMemo(() => {
    if (historySnapshot) return historySnapshot.championName;
    if (!champion) return '';
    const onlineP = state.onlinePlayers.find(p => p.id === champion);
    if (onlineP) return onlineP.team?.name ?? onlineP.name;
    return state.botTeams.find(t => t.id === champion)?.name ?? 'Campeão';
  }, [champion, historySnapshot, state.onlinePlayers, state.botTeams]);

  // ── Cinematic reveal phases ────────────────────────────────────────────────
  const [phase, setPhase] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: Player; positionIndex: number } | null>(null);
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
  const liveFinalResult = knockoutBracket?.final?.result;
  const finalResult = historySnapshot ? historySnapshot.finalResult : liveFinalResult;
  const reportFinalResult = finalResult && playerTeam && (
    finalResult.homeTeamId === playerTeam.id || finalResult.awayTeamId === playerTeam.id
  ) ? finalResult : undefined;
  const reportIsKnockout = historySnapshot
    ? historySnapshot.formatId !== 'league'
    : state.competitionFormat.id !== 'league' || !!knockoutBracket;
  const reportIsFinal = !!reportFinalResult;
  const reportIsLosing = !!playerTeam && !!reportFinalResult && (
    reportFinalResult.homeTeamId === playerTeam?.id
      ? reportFinalResult.homeGoals < reportFinalResult.awayGoals
      : reportFinalResult.awayGoals < reportFinalResult.homeGoals
  );
  const reportPlayStyle = historySnapshot
    ? historySnapshot.playStyle ?? playerTeam?.playStyle
    : liveFinalResult && playerTeam && (liveFinalResult.homeTeamId === playerTeam.id || liveFinalResult.awayTeamId === playerTeam.id)
    ? liveFinalResult.events
      .filter(event => event.type === 'tactic' && event.teamId === playerTeam.id && event.tacticAction)
      .sort((a, b) => a.minute - b.minute)
      .at(-1)?.tacticAction ?? playerTeam.playStyle
    : playerTeam?.playStyle;
  const effectiveStatsById = useMemo(() => playerTeam
    ? getTeamEffectiveStats(playerTeam, {
        playStyle: reportPlayStyle,
        isKnockout: reportIsKnockout,
        isFinal: reportIsFinal,
        isLosing: reportIsLosing,
      })
    : {}, [playerTeam, reportPlayStyle, reportIsKnockout, reportIsFinal, reportIsLosing]);
  const effectiveCardStatsById = useMemo<Record<string, SavedEffectiveCardStats>>(() => {
    if (!playerTeam) return {};
    return Object.fromEntries(playerTeam.players.map(player => {
      const stats = effectiveStatsById[player.id];
      return [player.id, {
        overall: Math.round(stats?.overall ?? player.overall),
        pace: Math.round(stats?.pace ?? player.pace),
        shooting: Math.round(stats?.shooting ?? player.shooting),
        passing: Math.round(stats?.passing ?? player.passing),
        dribbling: Math.round(stats?.dribbling ?? player.dribbling),
        defending: Math.round(stats?.defending ?? player.defending),
        physical: Math.round(stats?.physical ?? player.physical),
        vision: Math.round(stats?.vision ?? player.vision),
        composure: Math.round(stats?.composure ?? player.composure),
      }] as const;
    }));
  }, [effectiveStatsById, playerTeam]);
  const teamOverall = (playerTeam && chemData && starters.length === 11)
    ? Math.round(starters.reduce((s, p) => s + (effectiveStatsById[p.id]?.overall ?? p.overall), 0) / 11)
    : null;
  const localSeasonRows = useMemo(
    () => playerTeam && !historySnapshot
      ? playerTeam.players.map(player => ({ player, stats: getPlayerSeasonStats(player.id, playerTeam.id, allResults) }))
      : [],
    [allResults, historySnapshot, playerTeam],
  );
  const soloRecordCandidates = useMemo(() => {
    const candidates: Array<{
      category: 'goals' | 'assists' | 'saves' | 'effective_overall';
      playerId: string;
      playerName: string;
      playerPhotoUrl: string | null;
      value: number;
    }> = [];
    const topGoals = localSeasonRows.filter(row => row.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals)[0];
    const topAssists = localSeasonRows.filter(row => row.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists)[0];
    const topSaves = localSeasonRows.filter(row => row.stats.saves > 0).sort((a, b) => b.stats.saves - a.stats.saves)[0];
    const topEffective = localSeasonRows
      .map(row => ({ ...row, value: Math.round(effectiveStatsById[row.player.id]?.overall ?? row.player.overall) }))
      .sort((a, b) => b.value - a.value)[0];
    if (topGoals) candidates.push({ category: 'goals', playerId: topGoals.player.id, playerName: topGoals.player.shortName, playerPhotoUrl: topGoals.player.photoUrl ?? null, value: topGoals.stats.goals });
    if (topAssists) candidates.push({ category: 'assists', playerId: topAssists.player.id, playerName: topAssists.player.shortName, playerPhotoUrl: topAssists.player.photoUrl ?? null, value: topAssists.stats.assists });
    if (topSaves) candidates.push({ category: 'saves', playerId: topSaves.player.id, playerName: topSaves.player.shortName, playerPhotoUrl: topSaves.player.photoUrl ?? null, value: topSaves.stats.saves });
    if (topEffective) candidates.push({ category: 'effective_overall', playerId: topEffective.player.id, playerName: topEffective.player.shortName, playerPhotoUrl: topEffective.player.photoUrl ?? null, value: topEffective.value });
    return { candidates, totalAssists: localSeasonRows.reduce((sum, row) => sum + row.stats.assists, 0), totalSaves: localSeasonRows.reduce((sum, row) => sum + row.stats.saves, 0) };
  }, [effectiveStatsById, localSeasonRows]);
  const soloHistoryKey = useRef<string | null>(null);
  const soloSaveAttemptKey = useRef<string | null>(null);
  const reportDataInvalidated = useRef(false);
  const [historySaveStatus, setHistorySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [historySaveError, setHistorySaveError] = useState('');
  const [historySaveRetry, setHistorySaveRetry] = useState(0);

  useEffect(() => {
    if (reportDataInvalidated.current || historyEntry || historySnapshot || !account || !playerTeam || games === 0) return;
    reportDataInvalidated.current = true;
    // Invalidate profile/history reads as soon as a new final report appears.
    // Online campaigns are persisted by the room server; solo saves below.
    markCompetitionCompleted();
  }, [account, games, historyEntry, historySnapshot, markCompetitionCompleted, playerTeam]);

  useEffect(() => {
    // Solo campaigns are not authoritative public records, but an account can
    // still keep the same final-season snapshot privately. Online campaigns
    // are persisted by the room server at the report transition.
    if (historyEntry || historySnapshot || !account || state.mode !== 'solo' || !playerTeam || games === 0) return;
    if (!soloHistoryKey.current) soloHistoryKey.current = `solo:${crypto.randomUUID()}`;
    const attemptKey = `${soloHistoryKey.current}:${historySaveRetry}`;
    if (soloSaveAttemptKey.current === attemptKey) return;
    soloSaveAttemptKey.current = attemptKey;
    setHistorySaveStatus('saving');
    setHistorySaveError('');
    void saveHistory({
      mode: 'solo',
      difficultyId: state.difficulty,
      formatId: state.competitionFormat.id,
      teamName: playerTeam.name,
      crestId: playerTeam.crestId ?? null,
      coachId: playerTeam.coachId ?? null,
      champion: isChampion,
      placement: isChampion ? 1 : null,
      competitionPoints: competitionRankingPoints(playerTeam.id, champion, state.knockoutBracket),
      sourceKey: soloHistoryKey.current,
      report: {
        version: 1,
        games,
        wins,
        draws,
        losses,
        goals: totalGoals,
        goalsAgainst,
        assists: soloRecordCandidates.totalAssists,
        saves: soloRecordCandidates.totalSaves,
        cleanSheets,
        goalDiff,
        teamOverall,
        topScorer: topScorer ? { playerId: topScorer.pl.id, playerName: topScorer.pl.shortName, value: topScorer.stats.goals } : null,
        topAssister: topAssister ? { playerId: topAssister.pl.id, playerName: topAssister.pl.shortName, value: topAssister.stats.assists } : null,
        topRating: topRating ? { playerId: topRating.pl.id, playerName: topRating.pl.shortName, value: topRating.stats.ratingAvg } : null,
        historySnapshot: {
          version: 1,
          playerTeam,
          effectiveStatsByPlayerId: effectiveCardStatsById,
          effectiveOverallByPlayerId: Object.fromEntries(Object.entries(effectiveCardStatsById).map(([id, stats]) => [id, stats.overall])),
          matches: playerResults.map((result: any) => ({
            homeTeamId: result.homeTeamId,
            awayTeamId: result.awayTeamId,
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
            winner: result.winner,
          })),
          championId: champion ?? null,
        competitionPoints: competitionRankingPoints(playerTeam.id, champion, state.knockoutBracket),
          championName,
          formatId: state.competitionFormat.id,
          finalResult: reportFinalResult ? {
            homeTeamId: reportFinalResult.homeTeamId,
            awayTeamId: reportFinalResult.awayTeamId,
            homeGoals: reportFinalResult.homeGoals,
            awayGoals: reportFinalResult.awayGoals,
            winner: reportFinalResult.winner,
          } : null,
          playStyle: reportPlayStyle ?? null,
          report,
          leaders: {
            topScorer: topScorer ? { player: topScorer.pl, teamName: topScorer.team.name, value: topScorer.stats.goals } : null,
            topRating: topRating ? { player: topRating.pl, teamName: topRating.team.name, value: topRating.stats.ratingAvg, played: topRating.stats.played } : null,
            topAssister: topAssister ? { player: topAssister.pl, teamName: topAssister.team.name, value: topAssister.stats.assists } : null,
          },
        },
      },
      records: soloRecordCandidates.candidates,
    }).then(() => {
      setHistorySaveStatus('saved');
    }).catch(error => {
      console.error('[account] não foi possível salvar o histórico solo:', error);
      setHistorySaveError(error instanceof Error ? error.message : 'Não foi possível salvar a competição agora.');
      setHistorySaveStatus('error');
    });
  }, [account, champion, championName, effectiveCardStatsById, games, historyEntry, historySaveRetry, historySnapshot, isChampion, losses, playerResults, playerTeam, report, reportFinalResult, reportPlayStyle, saveHistory, soloRecordCandidates, state.competitionFormat.id, state.difficulty, state.knockoutBracket, state.mode, teamOverall, topAssister, topRating, topScorer, totalGoals, goalsAgainst, cleanSheets, goalDiff, wins, draws]);

  if (historyEntry && !historySnapshot) {
    return <LegacyHistoryReport entry={historyEntry} onBack={onHistoryBack} />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppShell immersive className="flex flex-col overflow-x-hidden">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <TopBar
        title="UCL IMMORTALS — FIM DE TEMPORADA"
        right={historyEntry && onHistoryBack ? (
          <Button type="button" intent="ghost" onClick={onHistoryBack}>
            <ArrowLeft size={15} aria-hidden="true" /> HISTÓRICO
          </Button>
        ) : undefined}
      />

      {!historyEntry && account && state.mode === 'solo' && games > 0 && historySaveStatus !== 'idle' && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-3" aria-live="polite">
          <div
            role={historySaveStatus === 'error' ? 'alert' : 'status'}
            className="flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: historySaveStatus === 'error' ? '#7F1D1D' : historySaveStatus === 'saved' ? '#166534' : '#3F3F46',
              background: historySaveStatus === 'error' ? '#2A1015' : historySaveStatus === 'saved' ? '#0C1F16' : '#111118',
            }}
          >
            <div className="text-sm" style={{ color: historySaveStatus === 'error' ? '#FCA5A5' : historySaveStatus === 'saved' ? '#86EFAC' : '#D4D4D8' }}>
              {historySaveStatus === 'saving' ? 'Salvando histórico, recordes e dados do perfil…'
                : historySaveStatus === 'saved' ? 'Competição salva. Histórico, recordes e perfil foram atualizados.'
                  : `Não foi possível salvar esta competição. ${historySaveError}`}
            </div>
            {historySaveStatus === 'error' && (
              <Button type="button" intent="ghost" onClick={() => setHistorySaveRetry(retry => retry + 1)} className="shrink-0 border border-red-900/70 text-red-200 hover:bg-red-950/60">
                TENTAR NOVAMENTE
              </Button>
            )}
          </div>
        </div>
      )}

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
                  <div className="text-[12px] font-bold tracking-widest mt-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{s.label}</div>
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
            <div className="text-[12px] font-black tracking-widest mb-3" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>DESEMPENHO GERAL</div>
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
              <span className="text-[12px] font-black tracking-widest" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>FICHA DA CAMPANHA</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t" style={{ borderColor: '#1A1A2A' }}>
              {[
                { l: 'SALDO DE GOLS', v: `${goalDiff > 0 ? '+' : ''}${goalDiff}`, c: goalDiff >= 0 ? '#22C55E' : '#EF4444' },
                { l: 'APROVEITAMENTO', v: `${aproveitamento}%`, c: '#22C55E' },
                { l: 'JOGOS S/ SOFRER', v: `${cleanSheets}`, c: '#3B82F6' },
                { l: 'MAIOR VITÓRIA', v: biggestWin ? `${biggestWin.gf}–${biggestWin.ga}` : '—', c: '#C9A84C' },
              ].map(m => (
                <div key={m.l} className="px-4 py-3 border-r" style={{ borderColor: '#1A1A2A' }}>
                  <div className="text-lg font-black leading-none" style={{ color: m.c, fontFamily: 'Bebas Neue, sans-serif' }}>{m.v}</div>
                  <div className="text-[11px] font-bold tracking-widest mt-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{m.l}</div>
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
              <span className="text-[12px] font-black tracking-widest" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>DESTAQUES DA TEMPORADA</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#1A1A2A' }}>
              {topScorer && (
                <div className="flex items-center gap-4 px-5 py-4">
                  <HighlightPortrait player={topScorer.pl} color="#C9A84C" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>ARTILHEIRO</div>
                    <div className="text-base font-black truncate" style={{ color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>{topScorer.pl.shortName}</div>
                    <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{topScorer.team.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>{topScorer.stats.goals}</div>
                    <div className="text-[12px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>gols</div>
                  </div>
                </div>
              )}
              {topRating && (
                <div className="flex items-center gap-4 px-5 py-4">
                  <HighlightPortrait player={topRating.pl} color="#22C55E" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>MELHOR NOTA MÉDIA</div>
                    <div className="text-base font-black truncate" style={{ color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>{topRating.pl.shortName}</div>
                    <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{topRating.team.name} · {topRating.stats.played} jogos</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#22C55E' }}>{topRating.stats.ratingAvg.toFixed(1)}</div>
                    <div className="text-[12px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>nota</div>
                  </div>
                </div>
              )}
              {topAssister && (
                <div className="flex items-center gap-4 px-5 py-4">
                  <HighlightPortrait player={topAssister.pl} color="#4FC3F7" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>REI DAS ASSISTÊNCIAS</div>
                    <div className="text-base font-black truncate" style={{ color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}>{topAssister.pl.shortName}</div>
                    <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{topAssister.team.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#4FC3F7' }}>{topAssister.stats.assists}</div>
                    <div className="text-[12px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>assist.</div>
                  </div>
                </div>
              )}
              {report && report.historicalRecreations.length > 0 && (
                <div className="flex items-start gap-4 px-5 py-4">
                  <div className="text-2xl">⚡</div>
                  <div>
                    <div className="text-[12px] font-bold tracking-widest mb-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>PARCERIAS HISTÓRICAS RECRIADAS</div>
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
              stadiumProjectLevel={projectLevel(playerTeam.clubProjects, 'stadium')}
              reportSummary
              showStadium={false}
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
                    <div className="text-[12px] font-black tracking-[0.18em]" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>ESCALAÇÃO FINAL</div>
                    <div className="truncate text-base font-black" style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>{playerTeam.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {chemData && (
                    <div className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="text-[11px] font-black tracking-widest" style={{ color: '#7A8A7F', fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA</span>
                      <strong className="text-xl leading-none" style={{ color: '#22C55E', fontFamily: 'Bebas Neue, sans-serif' }}>{chemData.total}%</strong>
                    </div>
                  )}
                  <div className="h-5 w-px" style={{ background: '#2A2A3A' }} />
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-[11px] font-black tracking-widest" style={{ color: '#8A8290', fontFamily: 'Rajdhani, sans-serif' }}>GERAL DO TIME</span>
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
                  showChemLines
                  chemLinks={getChemistryLinks(starters, playerTeam.coachId)}
                  effectiveStats={effectiveStatsById}
                  onPlayerClick={historyEntry ? undefined : (player, positionIndex) => setSelectedPlayer({ player, positionIndex })}
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
                          <span className="text-[12px] font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{l} <b style={{ color: '#C9C9D5' }}>({n})</b></span>
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
                      <PlayerCard
                        player={pl}
                        compact
                        lite
                        effectiveStats={effectiveStatsById[pl.id]}
                        onClick={historyEntry ? undefined : () => setSelectedPlayer({ player: pl, positionIndex: i })}
                      />
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
                        <PlayerCard
                          player={pl}
                          compact
                          lite
                          effectiveStats={effectiveStatsById[pl.id]}
                          onClick={historyEntry ? undefined : () => setSelectedPlayer({ player: pl, positionIndex: starters.length + i })}
                        />
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
            onClick={handlePlayAgain}
            className="mt-2 w-full"
          >
            {historyEntry ? <><ArrowLeft size={17} aria-hidden="true" /> VOLTAR AO HISTÓRICO</> : '🔄 JOGAR NOVAMENTE'}
          </Button>
        )}
      </PageContainer>

      {!historyEntry && selectedPlayer && playerTeam && (
        <PlayerDetailsModal
          player={selectedPlayer.player}
          team={playerTeam}
          positionIndex={selectedPlayer.positionIndex}
          activePlayStyle={reportPlayStyle}
          isKnockout={reportIsKnockout}
          isFinal={reportIsFinal}
          isLosing={reportIsLosing}
          coachPrime={!!playerTeam.coachPrime}
          analysisLevel={projectLevel(playerTeam.clubProjects, 'analysis')}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </AppShell>
  );
}
