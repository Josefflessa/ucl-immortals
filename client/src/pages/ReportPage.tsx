// UCL Immortals — Championship End Screen
// Cinematic celebration / campaign summary after the tournament

import { useState, useEffect, useMemo, useRef } from 'react';
import { Armchair, ArrowLeft, Home, Medal, Trophy, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { INLINE_ICON } from '../components/game/inlineIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { useAccount } from '../contexts/AccountContext';
import { useAlbum } from '../contexts/AlbumContext';
import { useTeams } from '../hooks/useTeams';
import { FORMATIONS, COACHES, type Player } from '@shared/game/gameData';
import {
  calculateChemistry,
  getAllPlayedMatchResults,
  getPlayerSeasonStats,
  MIN_MATCHES_FOR_RATING_LEADER,
  statKey,
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
import { competitionFinishStage, competitionStagePoints, isRankedDifficulty } from '@shared/game/competitionRanking';
import { UnlockedAchievements } from '../components/account/Achievements';
import type { AchievementUnlock, EventCardUnlock, FrameUnlock } from '../contexts/AccountContext';
import { ALL_UNIQUE_CARDS } from '@shared/game/gameData';
import { AVATAR_FRAME_BY_KEY } from '@shared/game/events';
import { FrameImage } from '../components/account/AvatarFrame';
import { CardIcon } from '../components/game/StatusIcon';
import { buildCareerSummary } from '@shared/game/careerSummary';

type SavedEffectiveCardStats = Pick<EffectiveStats,
  'overall' | 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'vision' | 'composure'>;

type HighlightPlayer = Pick<Player, 'id' | 'shortName' | 'photoUrl' | 'rarity'>;

function playerInitials(player: Pick<Player, 'shortName'>): string {
  const parts = player.shortName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function HighlightPortrait({ player, color }: { player: HighlightPlayer; color: string }) {
  return (
    <PlayerAvatar
      playerId={player.id}
      photoUrl={player.photoUrl}
      rarity={player.rarity}
      size={54}
      rounded="rounded-xl"
      fallback={
        <span className="text-sm font-black" style={{ color, fontFamily: 'var(--font-display), sans-serif' }}>
          {playerInitials(player)}
        </span>
      }
    />
  );
}

interface SeasonHighlight {
  key: string;
  label: string;
  player: HighlightPlayer;
  teamName: string;
  detail?: string;
  value: ReactNode;
  unit: string;
  color: string;
}

interface ReportPageProps {
  historyEntry?: CompetitionHistoryEntry;
  historySnapshot?: CompetitionHistorySnapshot | null;
  onHistoryBack?: () => void;
  hideTopBar?: boolean;
}

function reportNumber(report: Record<string, unknown>, key: string): number | null {
  const value = report[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function LegacyHistoryReport({ entry, onBack, hideTopBar = false }: { entry: CompetitionHistoryEntry; onBack?: () => void; hideTopBar?: boolean }) {
  const report = entry.report ?? {};
  const partial = report.partial === true;
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
      {!hideTopBar ? <TopBar right={onBack ? <Button type="button" intent="ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> HISTÓRICO</Button> : undefined} /> : null}
      {hideTopBar && onBack ? <div className="mx-auto w-full max-w-3xl px-4 pt-4"><Button type="button" intent="ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> VOLTAR AO HISTÓRICO</Button></div> : null}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 py-10 text-center sm:py-14">
        {entry.champion ? <Trophy size={60} strokeWidth={1.8} color="var(--ui-brand)" className="mx-auto mb-4 drop-shadow-[0_0_18px_rgba(201,168,76,0.45)]" aria-hidden="true" /> : <Medal size={60} strokeWidth={1.8} color="var(--ui-brand)" className="mx-auto mb-4 drop-shadow-[0_0_18px_rgba(201,168,76,0.45)]" aria-hidden="true" />}
        <h1 className="font-display text-5xl text-[var(--ui-text)] sm:text-7xl">{entry.champion ? 'CAMPEÃO!' : partial ? 'RESUMO PARCIAL' : 'CAMPANHA ENCERRADA'}</h1>
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
          {partial
            ? 'Resumo da sua campanha até a eliminação. Os resultados e destaques finais da competição não estão incluídos.'
            : entry.report.snapshotArchived === true
            ? 'O relatório detalhado foi arquivado para liberar espaço. O resumo da competição continua salvo.'
            : 'Esta competição foi salva antes de o jogo guardar escalação e detalhes completos do resultado.'}
        </p>
        {onBack ? <Button type="button" intent="primary" size="large" onClick={onBack} className="w-full"><ArrowLeft size={16} aria-hidden="true" /> VOLTAR AO HISTÓRICO</Button> : null}
      </PageContainer>
    </AppShell>
  );
}

export default function ReportPage({ historyEntry, historySnapshot: providedSnapshot, onHistoryBack, hideTopBar = false }: ReportPageProps = {}) {
  const { state, dispatch, leaveRoomOnline, discardSoloCampaign } = useGame();
  const { account, saveHistory, markCompetitionCompleted, getOwnAchievements } = useAccount();
  const { receiveGrants: receiveAlbumGrants, refresh: refreshAlbum } = useAlbum();
  const historySnapshot = providedSnapshot ?? (historyEntry ? getCompetitionHistorySnapshot(historyEntry.report) : null);
  const { localTeamId: liveTeamId, allTeams: allTeamsForStats } = useTeams();
  const report = historySnapshot ? historySnapshot.report : state.report;
  const playerTeam = historySnapshot ? historySnapshot.playerTeam : state.playerTeam;
  const champion = historySnapshot ? historySnapshot.championId : state.champion;
  const partialReport = historyEntry
    ? historyEntry.report.partial === true
    : !historySnapshot && state.partialReport;
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

  // Online room snapshots compact old match details. Their complete cumulative
  // stats arrive separately from the server and must drive season leaders.
  const getSeasonStats = useMemo(
    () => (playerId: string, teamId: string) => state.mode === 'online'
      ? state.onlineSeasonPlayerStats[statKey(teamId, playerId)] ?? getPlayerSeasonStats(playerId, teamId, allResults)
      : getPlayerSeasonStats(playerId, teamId, allResults),
    [allResults, state.mode, state.onlineSeasonPlayerStats]
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

  const handleReturnHome = () => {
    if (historyEntry) {
      onHistoryBack?.();
      return;
    }
    // The report can also be reached from an online room. Resetting only the
    // local reducer leaves the socket subscribed to the finished room, whose
    // next authoritative update would immediately restore the old competition.
    if (state.mode === 'online' && state.roomCode) {
      leaveRoomOnline();
    } else if (state.mode === 'solo') {
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
      const stats = getSeasonStats(pl.id, team.id);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals)[0] ?? null;
  }, [allTeamsForStats, getSeasonStats, historySnapshot]);

  const topRating = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topRating;
      return leader ? { pl: leader.player as Player, team: { name: leader.teamName }, stats: { played: leader.played ?? 0, ratingAvg: leader.value } } : null;
    }
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getSeasonStats(pl.id, team.id);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.played >= MIN_MATCHES_FOR_RATING_LEADER).sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg)[0] ?? null;
  }, [allTeamsForStats, getSeasonStats, historySnapshot]);

  const topAssister = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topAssister;
      return leader ? { pl: leader.player as Player, team: { name: leader.teamName }, stats: { assists: leader.value } } : null;
    }
    const allPlayers = allTeamsForStats.flatMap(t => t.players);
    const rows = allPlayers.flatMap(pl => {
      const team = allTeamsForStats.find(t => t.players.some(p => p.id === pl.id));
      if (!team) return [];
      const stats = getSeasonStats(pl.id, team.id);
      return [{ pl, team, stats }];
    });
    return rows.filter(x => x.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists)[0] ?? null;
  }, [allTeamsForStats, getSeasonStats, historySnapshot]);

  const topSaver = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topSaver;
      return leader ? { pl: leader.player as Player, team: { name: leader.teamName }, stats: { saves: leader.value } } : null;
    }
    const rows = allTeamsForStats.flatMap(team => team.players.map(pl => ({ pl, team, stats: getSeasonStats(pl.id, team.id) })));
    return rows.filter(row => row.pl.position === 'GK' && row.stats.played > 0)
      .sort((a, b) => b.stats.saves - a.stats.saves)[0] ?? null;
  }, [allTeamsForStats, getSeasonStats, historySnapshot]);

  const topTackler = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topTackler;
      return leader ? { pl: leader.player as Player, team: { name: leader.teamName }, stats: { tackles: leader.value } } : null;
    }
    const rows = allTeamsForStats.flatMap(team => team.players.map(pl => ({ pl, team, stats: getSeasonStats(pl.id, team.id) })));
    return rows.filter(row => row.stats.tackles > 0).sort((a, b) => b.stats.tackles - a.stats.tackles)[0] ?? null;
  }, [allTeamsForStats, getSeasonStats, historySnapshot]);

  const topCards = useMemo(() => {
    if (historySnapshot) {
      const leader = historySnapshot.leaders.topCards;
      return leader ? {
        pl: leader.player as Player,
        team: { name: leader.teamName },
        stats: { yellowCards: leader.yellowCards, redCards: leader.redCards },
      } : null;
    }
    const rows = allTeamsForStats.flatMap(team => team.players.map(pl => ({ pl, team, stats: getSeasonStats(pl.id, team.id) })));
    return rows.filter(row => row.stats.yellowCards + row.stats.redCards > 0)
      .sort((a, b) => (b.stats.redCards * 10 + b.stats.yellowCards) - (a.stats.redCards * 10 + a.stats.yellowCards))[0] ?? null;
  }, [allTeamsForStats, getSeasonStats, historySnapshot]);

  const seasonHighlights = ([
    topScorer && { key: 'goals', label: 'ARTILHEIRO', player: topScorer.pl, teamName: topScorer.team.name, value: topScorer.stats.goals, unit: 'gols', color: 'var(--ui-brand)' },
    topRating && { key: 'rating', label: 'MELHOR NOTA MÉDIA', player: topRating.pl, teamName: topRating.team.name, detail: `${topRating.stats.played} jogos`, value: topRating.stats.ratingAvg.toFixed(1), unit: 'nota', color: 'var(--ui-success)' },
    topAssister && { key: 'assists', label: 'REI DAS ASSISTÊNCIAS', player: topAssister.pl, teamName: topAssister.team.name, value: topAssister.stats.assists, unit: 'assist.', color: '#4FC3F7' },
    topSaver && { key: 'saves', label: 'GOLEIRO COM MAIS DEFESAS', player: topSaver.pl, teamName: topSaver.team.name, value: topSaver.stats.saves, unit: 'defesas', color: '#A78BFA' },
    topTackler && { key: 'tackles', label: 'MAIS DESARMES', player: topTackler.pl, teamName: topTackler.team.name, value: topTackler.stats.tackles, unit: 'desarmes', color: '#FB923C' },
    topCards && { key: 'cards', label: 'MAIS CARTÕES', player: topCards.pl, teamName: topCards.team.name, value: (
      <span className="inline-flex items-center justify-end gap-2 text-xl">
        {topCards.stats.yellowCards > 0 && <span className="inline-flex items-center gap-1">{topCards.stats.yellowCards}<CardIcon color="yellow" size={16} /></span>}
        {topCards.stats.redCards > 0 && <span className="inline-flex items-center gap-1">{topCards.stats.redCards}<CardIcon color="red" size={16} /></span>}
      </span>
    ), unit: 'amarelos · vermelhos', color: '#F87171' },
  ].filter(Boolean)) as SeasonHighlight[];

  // ── Champion team name (works for bot or any human in online mode) ─────────
  const championName = useMemo(() => {
    if (historySnapshot) return historySnapshot.championName;
    if (!champion) return '';
    const onlineP = state.onlinePlayers.find(p => p.id === champion);
    if (onlineP) return onlineP.team?.name ?? onlineP.name;
    return state.botTeams.find(t => t.id === champion)?.name ?? 'Campeão';
  }, [champion, historySnapshot, state.onlinePlayers, state.botTeams]);

  const championTeam = useMemo(
    () => !historySnapshot && champion ? allTeamsForStats.find(team => team.id === champion) ?? null : null,
    [allTeamsForStats, champion, historySnapshot],
  );
  const championCrestId = historySnapshot
    ? historySnapshot.championCrestId ?? (historySnapshot.championId === historySnapshot.playerTeam.id ? historySnapshot.playerTeam.crestId ?? null : null)
    : championTeam?.crestId ?? null;

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
      ? playerTeam.players.map(player => ({ player, stats: getSeasonStats(player.id, playerTeam.id) }))
      : [],
    [getSeasonStats, historySnapshot, playerTeam],
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
  const [achievementUnlocks, setAchievementUnlocks] = useState<AchievementUnlock[]>([]);
  const [frameUnlocks, setFrameUnlocks] = useState<FrameUnlock[]>([]);
  const [cardUnlocks, setCardUnlocks] = useState<EventCardUnlock[]>([]);

  // Online campaigns are saved by the room server when the report opens, so ask
  // for the levels reached since then, a few times while that save completes (and
  // sync the album, which grants that campaign's packs).
  const onlineAchievementsChecked = useRef(false);
  useEffect(() => {
    if (onlineAchievementsChecked.current || historyEntry || historySnapshot || !account || state.mode !== 'online' || games === 0) return;
    onlineAchievementsChecked.current = true;
    const since = Date.now() - 60_000;
    let cancelled = false;
    const timers: number[] = [];
    [2_000, 6_000, 12_000].forEach(delay => {
      timers.push(window.setTimeout(() => {
        if (delay >= 6_000) {
          void refreshAlbum();
          markCompetitionCompleted();
        }
        if (cancelled) return;
        void getOwnAchievements(since).then(result => {
          if (cancelled || result.recentlyUnlocked.length === 0) return;
          setAchievementUnlocks(result.recentlyUnlocked);
          cancelled = true;
        }).catch(() => undefined);
      }, delay));
    });
    return () => { cancelled = true; timers.forEach(timer => window.clearTimeout(timer)); };
  }, [account, games, getOwnAchievements, historyEntry, historySnapshot, markCompetitionCompleted, refreshAlbum, state.mode]);

  useEffect(() => {
    if (reportDataInvalidated.current || historyEntry || historySnapshot || (partialReport && state.mode === 'online') || !account || !playerTeam || games === 0) return;
    reportDataInvalidated.current = true;
    // Invalidate profile/history reads as soon as a new final report appears.
    // Online campaigns are persisted by the room server; solo saves below.
    markCompetitionCompleted();
  }, [account, games, historyEntry, historySnapshot, markCompetitionCompleted, partialReport, playerTeam, state.mode]);

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
    // The server derives the points from the stage and the difficulty; the value
    // sent here only mirrors it for the snapshot shown in the history.
    const finishStage = competitionFinishStage(playerTeam.id, champion, state.knockoutBracket);
    const competitionPoints = isRankedDifficulty(state.difficulty) ? competitionStagePoints(finishStage, state.difficulty) : 0;
    void saveHistory({
      mode: 'solo',
      difficultyId: state.difficulty,
      formatId: state.competitionFormat.id,
      teamName: playerTeam.name,
      crestId: playerTeam.crestId ?? null,
      coachId: playerTeam.coachId ?? null,
      champion: isChampion,
      placement: isChampion ? 1 : null,
      finishStage,
      competitionPoints,
      sourceKey: soloHistoryKey.current,
      report: {
        version: 1,
        partial: state.partialReport,
        ...(state.partialReport ? { finishStage } : {}),
        games,
        // The XI that started the final: the squad cannot change after it (events count it).
        finalStarterIds: reportFinalResult ? starters.map(player => player.id) : [],
        // Compact facts for the achievements (the match snapshot is archived later).
        career: buildCareerSummary({
          teamId: playerTeam.id,
          leagueResults,
          bracket: knockoutBracket,
          leagueStandings: state.competitionFormat.id === 'league' || state.competitionFormat.id === 'league_knockout' ? state.leagueStandings : undefined,
          finalStarters: reportFinalResult ? starters : [],
          finalChemistry: playerTeam.totalChemistry,
        }),
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
        ...(!state.partialReport ? {
          topScorer: topScorer ? { playerId: topScorer.pl.id, playerName: topScorer.pl.shortName, value: topScorer.stats.goals } : null,
          topAssister: topAssister ? { playerId: topAssister.pl.id, playerName: topAssister.pl.shortName, value: topAssister.stats.assists } : null,
          topRating: topRating ? { playerId: topRating.pl.id, playerName: topRating.pl.shortName, value: topRating.stats.ratingAvg } : null,
        } : {}),
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
          championId: state.partialReport ? null : champion ?? null,
          championCrestId: state.partialReport ? null : championCrestId,
          competitionPoints,
          finishStage,
          difficultyId: state.difficulty,
          championName: state.partialReport ? '' : championName,
          formatId: state.competitionFormat.id,
          finalResult: !state.partialReport && reportFinalResult ? {
            homeTeamId: reportFinalResult.homeTeamId,
            awayTeamId: reportFinalResult.awayTeamId,
            homeGoals: reportFinalResult.homeGoals,
            awayGoals: reportFinalResult.awayGoals,
            winner: reportFinalResult.winner,
          } : null,
          playStyle: reportPlayStyle ?? null,
          report: state.partialReport ? null : report,
          leaders: {
            topScorer: state.partialReport ? null : topScorer ? { player: topScorer.pl, teamName: topScorer.team.name, value: topScorer.stats.goals } : null,
            topRating: state.partialReport ? null : topRating ? { player: topRating.pl, teamName: topRating.team.name, value: topRating.stats.ratingAvg, played: topRating.stats.played } : null,
            topAssister: state.partialReport ? null : topAssister ? { player: topAssister.pl, teamName: topAssister.team.name, value: topAssister.stats.assists } : null,
            topSaver: state.partialReport ? null : topSaver ? { player: topSaver.pl, teamName: topSaver.team.name, value: topSaver.stats.saves } : null,
            topTackler: state.partialReport ? null : topTackler ? { player: topTackler.pl, teamName: topTackler.team.name, value: topTackler.stats.tackles } : null,
            topCards: state.partialReport ? null : topCards ? {
              player: topCards.pl,
              teamName: topCards.team.name,
              value: topCards.stats.redCards * 10 + topCards.stats.yellowCards,
              yellowCards: topCards.stats.yellowCards,
              redCards: topCards.stats.redCards,
            } : null,
          },
        },
      },
      records: state.partialReport ? [] : soloRecordCandidates.candidates,
    }).then(result => {
      setHistorySaveStatus('saved');
      setAchievementUnlocks(result.achievementsUnlocked ?? []);
      setFrameUnlocks(result.framesUnlocked ?? []);
      setCardUnlocks(result.eventCardsUnlocked ?? []);
      receiveAlbumGrants(result.albumGrants);
    }).catch(error => {
      console.error('[account] não foi possível salvar o histórico solo:', error);
      setHistorySaveError(error instanceof Error ? error.message : 'Não foi possível salvar a competição agora.');
      setHistorySaveStatus('error');
    });
  }, [account, champion, championCrestId, championName, effectiveCardStatsById, games, historyEntry, historySaveRetry, historySnapshot, isChampion, losses, playerResults, playerTeam, report, reportFinalResult, reportPlayStyle, saveHistory, receiveAlbumGrants, soloRecordCandidates, state.competitionFormat.id, state.difficulty, state.knockoutBracket, state.mode, state.partialReport, teamOverall, topAssister, topCards, topRating, topSaver, topScorer, topTackler, totalGoals, goalsAgainst, cleanSheets, goalDiff, wins, draws]);

  if (historyEntry && !historySnapshot) {
    return <LegacyHistoryReport entry={historyEntry} onBack={onHistoryBack} hideTopBar={hideTopBar} />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppShell immersive className="flex flex-col overflow-x-hidden">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      {!hideTopBar ? <TopBar
        title={historyEntry ? undefined : partialReport ? 'UCL IMMORTALS — RESUMO PARCIAL' : 'UCL IMMORTALS — FIM DE TEMPORADA'}
        right={historyEntry && onHistoryBack ? (
          <Button type="button" intent="ghost" onClick={onHistoryBack}>
            <ArrowLeft size={15} aria-hidden="true" /> HISTÓRICO
          </Button>
        ) : undefined}
      /> : null}
      {hideTopBar && historyEntry && onHistoryBack ? <div className="mx-auto w-full max-w-5xl px-4 pt-3"><Button type="button" intent="ghost" onClick={onHistoryBack}><ArrowLeft size={15} aria-hidden="true" /> VOLTAR AO HISTÓRICO</Button></div> : null}

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
              {historySaveStatus === 'saving' ? (partialReport ? 'Salvando resumo parcial…' : 'Salvando competição…')
                : historySaveStatus === 'saved' ? (partialReport ? 'Resumo parcial salvo.' : 'Competição salva.')
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

      {!historyEntry && account && partialReport && state.mode === 'online' && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-3" role="status" aria-live="polite">
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#166534', background: '#0C1F16', color: '#86EFAC' }}>
            Sua participação e as recompensas da fase alcançada estão sendo registradas no perfil e no Álbum.
          </div>
        </div>
      )}

      {/* A choice event finished with this campaign: its Única joins the player's Pacote Único. */}
      {!historyEntry && cardUnlocks.length > 0 ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-3" aria-live="polite">
          {cardUnlocks.map(unlock => {
            const card = ALL_UNIQUE_CARDS.find(candidate => candidate.id === unlock.cardId);
            if (!card) return null;
            return (
              <div key={unlock.cardId} className="flex items-center gap-3 rounded-xl border border-[var(--ui-brand)] bg-[var(--ui-surface-inset)] p-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ui-brand-strong)]">Evento concluído</div>
                  <div className="font-display text-xl leading-tight text-[var(--ui-text)]">Carta Única {card.shortName} liberada</div>
                  <div className="text-xs text-[var(--ui-text-muted)]">Ela agora pode aparecer no seu Pacote Único.</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* An event finished with this campaign: its avatar frame is now the player's. */}
      {!historyEntry && frameUnlocks.length > 0 ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-3" aria-live="polite">
          {frameUnlocks.map(unlock => {
            const frame = AVATAR_FRAME_BY_KEY.get(unlock.frameKey);
            if (!frame) return null;
            return (
              <div key={unlock.frameKey} className="flex items-center gap-3 rounded-xl border bg-[var(--ui-surface-inset)] p-3" style={{ borderColor: `color-mix(in srgb, ${frame.color} 55%, var(--ui-line-subtle))` }}>
                <FrameImage frameKey={unlock.frameKey} className="size-14 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: frame.color }}>Evento concluído</div>
                  <div className="font-display text-xl leading-tight text-[var(--ui-text)]">Moldura {frame.name} desbloqueada</div>
                  <div className="text-xs text-[var(--ui-text-muted)]">Use no perfil, em Personalizar › Moldura.</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!historyEntry && achievementUnlocks.length > 0 ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-3" aria-live="polite">
          <UnlockedAchievements unlocks={achievementUnlocks} />
        </div>
      ) : null}

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
                      fontFamily: 'var(--font-display), sans-serif',
                      color: 'var(--ui-brand-strong)',
                      textShadow: '0 0 40px rgba(232,200,74,0.9), 0 0 80px rgba(201,168,76,0.5)',
                    }}
                  >
                    CAMPEÃO!
                  </h1>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-3 inline-flex items-center gap-3 text-xl font-black tracking-wide sm:text-2xl"
                    style={{ fontFamily: 'var(--font-game), sans-serif', color: '#fff' }}
                  >
                    <Crest crestId={playerTeam?.crestId} name={playerTeam?.name ?? championName} size={34} />
                    <span>{playerTeam?.name}</span>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-sm mt-1 font-bold tracking-widest"
                    style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}
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
                <Medal size={60} strokeWidth={1.8} color="var(--ui-brand)" className="mx-auto mb-4 drop-shadow-[0_0_18px_rgba(201,168,76,0.45)]" aria-hidden="true" />
                <h1
                  className="text-5xl sm:text-6xl font-black tracking-widest"
                  style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FFFFFF' }}
                >
                  {partialReport ? 'RESUMO PARCIAL' : 'CAMPANHA ENCERRADA'}
                </h1>
                <p className="text-base mt-3 font-bold" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                  {partialReport ? 'Sua participação terminou antes do fim da competição. Estes são seus resultados até a eliminação.' : 'Você deu tudo, mas não chegou até o topo desta vez.'}
                </p>
                {!partialReport && <div className="mt-5 flex w-full max-w-sm items-center gap-4 rounded-2xl border px-4 py-3 text-left shadow-[0_8px_28px_rgba(201,168,76,0.08)]"
                  style={{ background: 'linear-gradient(110deg, rgba(201,168,76,0.12), var(--ui-surface-1) 55%)', borderColor: '#C9A84C55' }}>
                  <Crest crestId={championCrestId ?? undefined} name={championName} size={46} className="shrink-0 drop-shadow-[0_0_10px_rgba(201,168,76,0.25)]" />
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.16em]" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>
                      <Trophy size={13} strokeWidth={2.5} aria-hidden="true" />CAMPEÃO DA COMPETIÇÃO
                    </div>
                    <div className="truncate text-lg font-black" style={{ color: '#fff', fontFamily: 'var(--font-display), sans-serif' }}>{championName}</div>
                  </div>
                </div>}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ── SCROLLABLE CONTENT ────────────────────────────────────────────── */}
      <PageContainer narrow className="relative z-10 flex-1 space-y-5 lg:max-w-6xl">
        {/* Desktop: campaign numbers and highlights on the left, the final XI on the right. */}
        <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="min-w-0 space-y-5">

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
                  style={{ background: 'var(--ui-surface-1)', border: '1px solid var(--ui-surface-3)' }}
                >
                  <div className="text-2xl font-black leading-none" style={{ fontFamily: 'var(--font-display), sans-serif', color: s.color }}>{s.value}</div>
                  <div className="text-[12px] font-bold tracking-widest mt-1" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>{s.label}</div>
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
            style={{ background: 'var(--ui-surface-1)', border: '1px solid var(--ui-surface-3)' }}
          >
            <div className="text-[12px] font-black tracking-widest mb-3" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>DESEMPENHO GERAL</div>
            <div className="h-2.5 rounded-full overflow-hidden flex gap-0.5">
              {wins > 0 && <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(wins / Math.max(playerResults.length, 1)) * 100}%` }} transition={{ delay: 0.3, duration: 0.7 }} style={{ background: 'var(--ui-success)' }} />}
              {draws > 0 && <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(draws / Math.max(playerResults.length, 1)) * 100}%` }} transition={{ delay: 0.5, duration: 0.5 }} style={{ background: 'var(--ui-warning)' }} />}
              {losses > 0 && <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(losses / Math.max(playerResults.length, 1)) * 100}%` }} transition={{ delay: 0.7, duration: 0.5 }} style={{ background: 'var(--ui-danger)' }} />}
            </div>
            <div className="flex gap-5 mt-3">
              {[{ label: `${wins} Vitórias`, color: '#22C55E' }, { label: `${draws} Empates`, color: '#EAB308' }, { label: `${losses} Derrotas`, color: '#EF4444' }].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs font-bold" style={{ color: s.color, fontFamily: 'var(--font-game), sans-serif' }}>{s.label}</span>
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
            style={{ background: 'var(--ui-surface-1)', border: '1px solid var(--ui-surface-3)' }}
          >
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--ui-surface-3)' }}>
              <span className="text-[12px] font-black tracking-widest" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>FICHA DA CAMPANHA</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t" style={{ borderColor: 'var(--ui-surface-3)' }}>
              {[
                { l: 'SALDO DE GOLS', v: `${goalDiff > 0 ? '+' : ''}${goalDiff}`, c: goalDiff >= 0 ? '#22C55E' : '#EF4444' },
                { l: 'APROVEITAMENTO', v: `${aproveitamento}%`, c: '#22C55E' },
                { l: 'JOGOS S/ SOFRER', v: `${cleanSheets}`, c: '#3B82F6' },
                { l: 'MAIOR VITÓRIA', v: biggestWin ? `${biggestWin.gf}–${biggestWin.ga}` : '—', c: '#C9A84C' },
              ].map(m => (
                <div key={m.l} className="px-4 py-3 border-r" style={{ borderColor: 'var(--ui-surface-3)' }}>
                  <div className="text-lg font-black leading-none" style={{ color: m.c, fontFamily: 'var(--font-display), sans-serif' }}>{m.v}</div>
                  <div className="text-[12px] font-bold tracking-widest mt-1" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>{m.l}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Top performers */}
        {!partialReport && phase >= 3 && seasonHighlights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--ui-surface-1)', border: '1px solid var(--ui-surface-3)' }}
          >
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--ui-surface-3)' }}>
              <span className="text-[12px] font-black tracking-widest" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>DESTAQUES DA TEMPORADA</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--ui-surface-3)' }}>
              {seasonHighlights.map(highlight => (
                <div key={highlight.key} className="flex items-center gap-4 px-5 py-4">
                  <HighlightPortrait player={highlight.player} color={highlight.color} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>{highlight.label}</div>
                    <div className="truncate text-base font-black" style={{ color: '#fff', fontFamily: 'var(--font-game), sans-serif' }}>{highlight.player.shortName}</div>
                    <div className="truncate text-xs" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                      {highlight.teamName}{highlight.detail ? ` · ${highlight.detail}` : ''}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-3xl font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: highlight.color }}>{highlight.value}</div>
                    <div className="text-[12px]" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>{highlight.unit}</div>
                  </div>
                </div>
              ))}
              {report && report.historicalRecreations.length > 0 && (
                <div className="flex items-start gap-4 px-5 py-4">
                  <Zap size={24} strokeWidth={2.2} color="var(--ui-brand)" className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-[12px] font-bold tracking-widest mb-1" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>PARCERIAS HISTÓRICAS RECRIADAS</div>
                    {report.historicalRecreations.map(trio => (
                      <div key={trio} className="text-sm font-bold" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>{trio}</div>
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

        </div>
        <div className="min-w-0">

        {/* Squad showcase */}
        {phase >= 4 && playerTeam && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-xl overflow-hidden"
            style={{ background: '#0F0F1A', border: `1px solid ${isChampion ? '#C9A84C55' : '#1A1A2A'}` }}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--ui-surface-3)', background: isChampion ? '#C9A84C11' : 'transparent' }}>
              <div className="flex items-center gap-3">
                  <Crest
                    crestId={playerTeam.crestId}
                    name={playerTeam.name}
                    size={42}
                    className="flex-shrink-0 drop-shadow-[0_0_10px_rgba(201,168,76,0.25)]"
                  />
                  <div className="min-w-0">
                    <div className="text-[12px] font-black tracking-[0.18em]" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>{partialReport ? 'ELENCO DA CAMPANHA' : 'ESCALAÇÃO FINAL'}</div>
                    <div className="truncate text-base font-black" style={{ color: '#FFFFFF', fontFamily: 'var(--font-game), sans-serif' }}>{playerTeam.name}</div>
                  </div>
              </div>
              <div className="mt-4 grid w-full grid-cols-2 border-t pt-3" style={{ borderColor: 'var(--ui-surface-3)' }}>
                <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
                  <span className="text-[12px] font-black tracking-widest" style={{ color: '#7A8A7F', fontFamily: 'var(--font-game), sans-serif' }}>QUÍMICA</span>
                  <strong className="text-2xl leading-none" style={{ color: 'var(--ui-success)', fontFamily: 'var(--font-display), sans-serif' }}>{chemData?.total ?? '—'}</strong>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 border-l px-2 text-center" style={{ borderColor: 'var(--ui-surface-3)' }}>
                  <span className="text-[12px] font-black tracking-widest" style={{ color: '#8A8290', fontFamily: 'var(--font-game), sans-serif' }}>GERAL DO TIME</span>
                  <strong className="text-2xl leading-none" style={{ color: 'var(--ui-brand-strong)', fontFamily: 'var(--font-display), sans-serif' }}>{teamOverall ?? '—'}</strong>
                </div>
              </div>
            </div>
            {/* XI no campo, com as linhas de química (mesmo clube / nação / técnico / dupla) */}
            {formation && starters.length === 11 && chemData && (
              <div className="p-4 pb-2">
                <FormationField
                  formation={formation}
                  players={starters}
                  showAlbumLevel
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
                          <span className="text-[12px] font-bold" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>{l} <b style={{ color: '#C9C9D5' }}>({n})</b></span>
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
                <div className="text-xs font-black tracking-widest mb-2" style={{ color: '#FFF', fontFamily: 'var(--font-game), sans-serif' }}>TITULARES</div>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {starters.map((pl, i) => (
                    <motion.div key={pl.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                      <PlayerCard
                        player={pl}
                        compact
                        lite
                        showAlbumLevel
                        effectiveStats={effectiveStatsById[pl.id]}
                        onClick={historyEntry ? undefined : () => setSelectedPlayer({ player: pl, positionIndex: i })}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
              {/* RESERVAS / BANCO */}
              {bench.length > 0 && (
                <div className="pt-3 border-t" style={{ borderColor: 'var(--ui-surface-3)' }}>
                  <div className="text-xs font-black tracking-widest mb-2" style={{ color: 'var(--ui-info)', fontFamily: 'var(--font-game), sans-serif' }}><Armchair {...INLINE_ICON} />RESERVAS ({bench.length})</div>
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                    {bench.map((pl, i) => (
                      <motion.div key={pl.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                        <PlayerCard
                          player={pl}
                          compact
                          lite
                          showAlbumLevel
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

        </div>
        </div>

        {/* Return to the start or back to history. */}
        {phase >= 4 && (
          <Button
            type="button"
            intent="primary"
            size="large"
            onClick={handleReturnHome}
            className="mt-2 w-full"
          >
            {historyEntry ? <><ArrowLeft size={17} aria-hidden="true" /> VOLTAR AO HISTÓRICO</> : <><Home size={17} aria-hidden="true" /> VOLTAR AO INÍCIO</>}
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
