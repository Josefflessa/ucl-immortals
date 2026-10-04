// UCL Immortals — League hub shared state
// Local UI state, effects, derived standings/fixtures/stats and handlers used by
// LeaguePage and its tab/modal components. Computed once per render of the page.

import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useGame, KnockoutMatch } from '../../contexts/GameContext';
import { useTeams } from '../../hooks/useTeams';
import { getPlayerSeasonStats, getAllPlayedMatchResults, getActiveKnockoutMatches, computeGroupStandings, knockoutRoundLabel, statKey } from '@shared/game/gameEngine';
import { preloadPlayerPhotos } from '../../components/game/PlayerPortrait';
import { roundStakeUsed, BET_ROUND_CAP, Bet } from '@shared/game/bets';
import { bettingStakeCapBonus, projectLevel } from '@shared/game/clubProjects';
import { getEmergencyReplacementTarget, unavailableStarters } from '@shared/game/discipline';
import { getOnlineLeagueParticipantIds, getOnlineKnockoutParticipantIds, getReadinessStatus, sortMatchesForOnlineDisplay } from '@shared/game/onlineReadiness';
import { MAX_RESERVE_PLAYERS, reservePlayerCount } from '@shared/game/gameEngine';
import type { MatchResult, Team } from '@shared/game/gameEngine';
import type { Player } from '@shared/game/gameData';

export function useLeagueHub() {
  const { state, dispatch, playRoundOnline, advanceRoundOnline, getTeamById, pickReinforcementOnline, dismissReinforcementOnline, rerollReinforcementOnline, shopPlaceBetOnline, shopCancelBetOnline, playerReadyOnline, playerUnreadyOnline, emergencyReplaceOnline, requestMatchResultOnline, dismissMissionResolutionOnline, notifyMatchWatchedOnline } = useGame();
  const online = state.mode === 'online';
  // A reward is acknowledged once per match. This also prevents an existing
  // online reward from reopening as soon as the page mounts or reconnects.
  const creditsSignature = state.lastMatchPoints
    ? state.lastMatchPoints.matchKey ?? JSON.stringify(state.lastMatchPoints)
    : null;
  const initialCreditsSignature = useRef<string | null | undefined>(undefined);
  const [postMatchModalQueueReady, setPostMatchModalQueueReady] = useState(false);
  useEffect(() => {
    if (initialCreditsSignature.current !== undefined) return;
    initialCreditsSignature.current = creditsSignature;
    // Do not paint recruitment or mission resolution before this first check.
    // On a solo return from the match screen, both the credit result and the
    // recruitment offer can already exist on the first render; without this
    // gate, recruitment briefly flashes before the credit modal takes over.
    setPostMatchModalQueueReady(true);
    // In solo, LeaguePage remounts after MatchSimPage finishes. The current
    // lastMatchPoints is therefore the reward for the match just played and
    // must be shown immediately. Online uses matchCreditsModalPending because
    // the hub also remounts after an online replay finishes.
  }, []);
  // Solo and online share the same persisted flag: the reward modal opens once per match and
  // never again after it is closed (reload, continued campaign or page remount included).
  const showCreditsModal = postMatchModalQueueReady && state.matchCreditsModalPending && !!state.lastMatchPoints;

  // A ticket on another player's match may be revealed while this player is
  // on the hub, not inside the replay. Keep that server-side credit visible
  // instead of making the balance change silently.
  const previousBetSnapshot = useRef<{ roomCode: string; states: Map<string, string> } | null>(null);
  useEffect(() => {
    if (!online || !state.roomCode) {
      previousBetSnapshot.current = null;
      return;
    }
    const current = new Map(state.bets.map(bet => [
      bet.matchKey,
      `${bet.revealed ? 1 : 0}:${bet.won ? 1 : 0}:${bet.payout ?? 0}:${bet.protectionRefund ?? 0}`,
    ]));
    const previous = previousBetSnapshot.current;
    if (!previous || previous.roomCode !== state.roomCode) {
      previousBetSnapshot.current = { roomCode: state.roomCode, states: current };
      return;
    }

    const newlyRevealed = state.bets.filter(bet => {
      if (!bet.revealed) return false;
      const before = previous.states.get(bet.matchKey);
      const now = current.get(bet.matchKey);
      return before !== now;
    });
    if (newlyRevealed.length > 0) {
      const credited = newlyRevealed.reduce((total, bet) => total + (bet.payout ?? 0) + (bet.protectionRefund ?? 0), 0);
      if (credited > 0) {
        toast.success(`Palpite liquidado · +${credited} créditos`);
      } else {
        toast.info(newlyRevealed.length === 1 ? 'Palpite encerrado sem recompensa.' : 'Palpites encerrados sem recompensa.');
      }
    }
    previousBetSnapshot.current = { roomCode: state.roomCode, states: current };
  }, [online, state.bets, state.roomCode]);

  const closeCreditsModal = () => dispatch({ type: 'DISMISS_MATCH_CREDITS' });
  const showMissionResolutionModal = postMatchModalQueueReady && !!state.missions.missionResolution && !showCreditsModal;
  const closeMissionResolutionModal = () => {
    if (online) dismissMissionResolutionOnline();
    else dispatch({ type: 'DISMISS_MISSION_RESOLUTION' });
  };
  const recruitmentOffer = state.reinforcementOffer;
  const recruitmentEventLabel = recruitmentOffer?.eventKind === 'stage' || state.phase === 'knockout' ? 'FASE' : 'RODADA';
  const recruitmentLevel = recruitmentOffer?.projectLevel ?? 1;
  const recruitmentSelectionsRemaining = Math.max(
    1,
    (recruitmentOffer?.selectionLimit ?? 1) - (recruitmentOffer?.selectionsMade ?? 0),
  );
  const recruitmentTotalOptions = (state.reinforcementOptions?.length ?? 0) + (recruitmentOffer?.selectionsMade ?? 0);
  const recruitmentRerollsRemaining = Math.max(
    0,
    (recruitmentOffer?.freeRerolls ?? 0) - (recruitmentOffer?.rerollsUsed ?? 0),
  );

  // Warm the compact portraits before the reinforcement modal is painted. The
  // modal has only a handful of cards, but waiting for lazy image loading here
  // makes the offer feel like a single, immediate interaction on mobile.
  const reinforcementPhotoKey = state.reinforcementOptions?.map(option => option.id).join('|') ?? '';
  useEffect(() => {
    if (!reinforcementPhotoKey) return;
    return preloadPlayerPhotos(reinforcementPhotoKey.split('|'), true);
  }, [reinforcementPhotoKey]);

  const { leagueStandings, leagueResults, leagueFixtures, leagueRound, playerTeam } = state;
  const { allTeams, localTeamId, getTeamName } = useTeams();
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'bracket' | 'results' | 'squad' | 'scorers' | 'shop' | 'market' | 'missions'>('fixtures');
  const [classificationSubTab, setClassificationSubTab] = useState<'league' | 'bracket'>('league');
  const [statsSubTab, setStatsSubTab] = useState<'goals' | 'assists' | 'ratings' | 'keepers' | 'tackles' | 'cards'>('goals');
  // HISTÓRICO: alterna entre "MEUS JOGOS" (do jogador) e "RODADAS ANTERIORES" (todos os resultados por rodada)
  const [resultsSubTab, setResultsSubTab] = useState<'mine' | 'rounds'>('mine');
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string | null>(null);
  // 🎯 Palpite — slip aberto (qual partida) e helpers de teto/consulta.
  const [betSlip, setBetSlip] = useState<{
    matchKey: string;
    homeName: string;
    awayName: string;
    homeTeamId?: string;
    awayTeamId?: string;
  } | null>(null);
  // 🟥🩹 Aviso "ajuste a escalação" — lista de nomes indisponíveis no XI.
  const [lineupWarning, setLineupWarning] = useState<{ kind: 'discipline' | 'reserve'; names: string[] } | null>(null);
  // 🆘 Contratação emergencial — abre quando não há reserva disponível para a posição.
  const [emergencySelection, setEmergencySelection] = useState<ReturnType<typeof getEmergencyReplacementTarget>>(null);
  // 🔍 "Ver Detalhes" de uma partida (placar + gols + campo dos 2 times c/ notas finais)
  const [detailsMatch, setDetailsMatch] = useState<{
    result: MatchResult;
    homeTeam?: Team;
    awayTeam?: Team;
    homeName: string;
    awayName: string;
    isKnockout: boolean;
    isFinal: boolean;
  } | null>(null);
  // True only while "Ver Detalhes" is fetching a trimmed online result's full
  // data — solo mode and the current round never trigger it.
  const [detailsLoading, setDetailsLoading] = useState(false);

  // MEUS JOGOS combines league and knockout results. Infer the phase from the
  // stored bracket so an old knockout result keeps its knockout-only effects.
  const knockoutRoundForResult = (result: MatchResult): string | undefined => {
    const bracket = state.knockoutBracket;
    if (!bracket) return undefined;
    const rounds: Array<[string, KnockoutMatch[]]> = [
      ['playoffs', bracket.playoffs ?? []],
      ['round16', bracket.round16 ?? []],
      ['quarters', bracket.quarterFinals ?? []],
      ['semis', bracket.semiFinals ?? []],
      ['final', bracket.final ? [bracket.final] : []],
    ];
    // getAllPlayedMatchResults preserves the bracket result objects, so identity
    // is intentional here: matching by score could confuse a league rematch with
    // a knockout leg between the same teams.
    const sameResult = (candidate?: MatchResult) => candidate === result;
    for (const [round, ties] of rounds) {
      if (ties.some(tie => sameResult(tie.result) || sameResult(tie.leg1) || sameResult(tie.leg2))) return round;
    }
    return undefined;
  };

  const openMatchDetails = async (result: MatchResult, context?: { isKnockout?: boolean; isFinal?: boolean }) => {
    // Online only: a bygone round's result arrives with events/playerStats
    // stripped (see roomViewForSocket) to keep the live sync light. Fetch the
    // full result before opening — solo mode and the current round never hit
    // this branch, since they're never trimmed.
    if (result.resultTrimmed && state.mode === 'online' && typeof result.round === 'number') {
      if (detailsLoading) return; // already fetching another "Ver Detalhes"
      setDetailsLoading(true);
      const loadingToast = toast.loading('Carregando detalhes da partida…');
      const full = await requestMatchResultOnline(result.round, result.homeTeamId, result.awayTeamId);
      toast.dismiss(loadingToast);
      setDetailsLoading(false);
      if (!full) {
        toast.error('Não foi possível carregar os detalhes dessa partida agora. Tenta de novo.');
        return;
      }
      result = full;
    }
    const inferredRound = knockoutRoundForResult(result);
    const knockout = context?.isKnockout ?? !!inferredRound;
    setDetailsMatch({
      result,
      homeTeam: getTeamById(result.homeTeamId),
      awayTeam: getTeamById(result.awayTeamId),
      homeName: getTeamById(result.homeTeamId)?.name ?? result.homeTeamId,
      awayName: getTeamById(result.awayTeamId)?.name ?? result.awayTeamId,
      isKnockout: knockout,
      isFinal: context?.isFinal ?? inferredRound === 'final',
    });
  };

  // This page is the season HUB for BOTH phases: league (rounds + standings) and
  // knockout (ties + bracket). Shared tabs — ESTATÍSTICAS, MEU TIME, MEUS JOGOS —
  // work in either phase; only the first tab (matches) and the standings tab differ.
  const isKnockout = state.phase === 'knockout';
  const isLeagueOnly = state.competitionFormat.id === 'league';
  const hasGroupStage = state.competitionFormat.id === 'groups_knockout';
  const hasLeagueClassification = state.competitionFormat.id !== 'knockout';
  const isGroupStage = !isKnockout && state.competitionFormat.id === 'groups_knockout';
  const knockoutLabel = state.knockoutBracket ? knockoutRoundLabel(state.knockoutBracket.currentRound, state.knockoutBracket.firstRoundSize) : '';
  const leagueRounds = isGroupStage ? state.competitionFormat.groupRounds : state.competitionFormat.leagueRounds;
  const qualifiedTeams = isLeagueOnly ? 1 : state.competitionFormat.qualifiedTeams;
  const playoffTeams = Math.max(0, qualifiedTeams - 16);
  const directTeams = 16 - playoffTeams;
  const groupTables = useMemo(
    () => hasGroupStage
      ? computeGroupStandings(allTeams, leagueFixtures, state.competitionFormat)
      : [],
    [allTeams, leagueFixtures, state.competitionFormat, hasGroupStage]
  );

  // Keep the classification tab available after league → knockout. The current
  // knockout view is the useful default, while the completed league table stays
  // available as a historical reference.
  useEffect(() => {
    setClassificationSubTab(isKnockout ? 'bracket' : 'league');
  }, [isKnockout]);

  // Aggregate stats for all players in the league. Memoized so switching tabs
  // (fixtures → standings → scorers) does not recompute/re-sort every render.
  const allPlayers = useMemo(() => {
    const allPlayedResults = getAllPlayedMatchResults(leagueResults, state.knockoutBracket);
    return allTeams.flatMap(t =>
      t.players.map(p => ({
        ...p,
        teamName: t.name,
        teamId: t.id,
        // Online old fixtures are intentionally compacted and no longer carry
        // playerStats. Use the server's compact cumulative read model so the
        // leaderboard keeps all rounds without downloading every event log.
        stats: state.mode === 'online'
          ? (state.onlineSeasonPlayerStats[statKey(t.id, p.id)] ?? getPlayerSeasonStats(p.id, t.id, allPlayedResults))
          : getPlayerSeasonStats(p.id, t.id, allPlayedResults),
      }))
    );
  }, [allTeams, leagueResults, state.knockoutBracket, state.mode, state.onlineSeasonPlayerStats]);

  const { topScorers, topAssists, topRatings, topKeepers, topTacklers, topCards } = useMemo(() => ({
    topScorers: [...allPlayers].filter(p => p.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals),
    topAssists: [...allPlayers].filter(p => p.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists),
    topRatings: [...allPlayers].filter(p => p.stats.played >= 1).sort((a, b) => b.stats.ratingAvg - a.stats.ratingAvg),
    topKeepers: [...allPlayers].filter(p => p.position === 'GK' && p.stats.played > 0).sort((a, b) => b.stats.saves - a.stats.saves),
    topTacklers: [...allPlayers].filter(p => p.stats.tackles > 0).sort((a, b) => b.stats.tackles - a.stats.tackles),
    topCards: [...allPlayers].filter(p => (p.stats.yellowCards + p.stats.redCards) > 0)
      .sort((a, b) => (b.stats.redCards * 10 + b.stats.yellowCards) - (a.stats.redCards * 10 + a.stats.yellowCards)),
  }), [allPlayers]);

  // MEUS JOGOS spans the whole season — league rounds AND knockout legs.
  const playerResults = useMemo(
    () => getAllPlayedMatchResults(leagueResults, state.knockoutBracket)
      .filter(r => r.homeTeamId === playerTeam?.id || r.awayTeamId === playerTeam?.id),
    [leagueResults, state.knockoutBracket, playerTeam?.id]
  );

  // RODADAS ANTERIORES: períodos disputados — todas as rodadas configuradas + mata-mata.
  const koShort = (r: string): string => ({ playoffs: 'PLAY', round16: 'OIT', quarters: 'QF', semis: 'SF', final: 'FIN' } as Record<string, string>)[r] ?? r;
  const historyPeriods = useMemo(() => {
    const periods: { key: string; label: string; kind: 'league' | 'ko'; round?: number; koRound?: string }[] = [];
    for (let r = 1; r <= leagueRounds; r++) {
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
  }, [leagueFixtures, state.knockoutBracket, leagueRounds]);
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

  const globalPlayerStanding = leagueStandings.find(s => s.teamId === playerTeam?.id);
  const playerGroup = isGroupStage
    ? groupTables.find(group => group.entries.some(entry => entry.teamId === playerTeam?.id))
    : undefined;
  const playerGroupLabel = playerGroup ? String.fromCharCode(65 + playerGroup.groupId) : null;
  const playerStanding = isGroupStage
    ? playerGroup?.entries.find(entry => entry.teamId === playerTeam?.id)
    : globalPlayerStanding;
  const playerPosition = isGroupStage
    ? (playerGroup ? playerGroup.entries.findIndex(entry => entry.teamId === playerTeam?.id) + 1 : 0)
    : leagueStandings.findIndex(s => s.teamId === playerTeam?.id) + 1;
  // Configured qualification line: direct places fill the Round of 16 first;
  // any remaining qualified teams form the seeded playoff field.
  const groupQualified = isGroupStage && playerTeam
    ? !!playerGroup?.entries.slice(0, state.competitionFormat.qualifiedPerGroup).some(entry => entry.teamId === playerTeam.id)
    : false;
  const groupQualifiedIds = isGroupStage
    ? new Set(groupTables.flatMap(group => group.entries.slice(0, state.competitionFormat.qualifiedPerGroup).map(entry => entry.teamId)))
    : new Set<string>();
  const directQual = isLeagueOnly || (!isGroupStage && playerPosition >= 1 && playerPosition <= directTeams);
  const playoffQual = !isGroupStage && playoffTeams > 0 && playerPosition > directTeams && playerPosition <= qualifiedTeams;
  const qualifies = isLeagueOnly || groupQualified || directQual || playoffQual;

  // Todos os confrontos da rodada ficam disponíveis na tela. No modo de grupos,
  // eles são organizados visualmente por grupo e o grupo do jogador é destacado.
  const currentRoundFixtures = leagueFixtures.filter(f => f.round === leagueRound);
  const onlineHumanTeamIds = state.mode === 'online'
    ? new Set(state.onlinePlayers.map(player => player.id))
    : new Set<string>();
  const displayedRoundFixtures = sortMatchesForOnlineDisplay(
    currentRoundFixtures,
    onlineHumanTeamIds,
    localTeamId,
  );
  // A janela anti-spoiler só existe depois que o servidor simulou pelo menos
  // uma partida desta rodada. Antes do início, `watched` naturalmente está
  // vazio e não pode ser interpretado como "há alguém atrasado".
  const hasPlayedLeagueResult = currentRoundFixtures.some(f => f.played && !!f.result);
  const allFixturesPlayed = currentRoundFixtures.every(f => f.played);
  const roundGroupIds: Array<number | null> = isGroupStage
    ? Array.from(new Set(displayedRoundFixtures.map(fixture => fixture.groupId ?? 0))).sort((a, b) => a - b)
    : [null];

  // 🎯 Palpite — helpers (usam state.bets + rodada atual)
  const bets = state.bets ?? [];
  const betPrefix = `L${leagueRound}:`;
  const bettingLevel = projectLevel(playerTeam?.clubProjects, 'betting');
  const betCap = BET_ROUND_CAP + bettingStakeCapBonus(bettingLevel);
  const remainingCap = Math.max(0, betCap - roundStakeUsed(bets, betPrefix));
  const betFor = (matchKey: string): Bet | undefined => bets.find(b => b.matchKey === matchKey);

  // 🟥🩹 Escalação: titulares indisponíveis do MEU time (bloqueia jogar/pronto até ajustar).
  const myUnavailable = playerTeam ? unavailableStarters(playerTeam, state.discipline) : [];
  const reserveCount = playerTeam ? reservePlayerCount(playerTeam) : 0;
  const reserveLimitExceeded = reserveCount > MAX_RESERVE_PLAYERS;
  // ✅ Ready-check: only connected humans with a fixture in this round participate.
  // A host who qualified directly (or has a bye) still controls the room, but does
  // not need to confirm readiness for a match they are not playing.
  const readySet = new Set(state.onlineReadyPlayers);
  const leagueParticipantIds = state.mode === 'online'
    ? getOnlineLeagueParticipantIds(state.onlinePlayers, currentRoundFixtures, leagueRound)
    : [];
  const leagueReadyStatus = getReadinessStatus(state.onlineReadyPlayers, leagueParticipantIds);
  const isActiveLeagueParticipant = !!localTeamId && leagueParticipantIds.includes(localTeamId);
  const iAmReady = isActiveLeagueParticipant && readySet.has(localTeamId!);
  const { readyCount, total: totalReady, allReady } = leagueReadyStatus;

  // Online: which human players still need to watch their match before host can advance
  const humanPlayersWithMatch = state.mode === 'online'
    ? state.onlinePlayers.filter(p => leagueParticipantIds.includes(p.id))
    : [];
  const allPlayersWatched = humanPlayersWithMatch.length === 0 ||
    humanPlayersWithMatch.every(p => state.onlineWatchedPlayers.includes(p.id));
  const waitingForCount = humanPlayersWithMatch.filter(p => !state.onlineWatchedPlayers.includes(p.id)).length;

  // ONLINE: hide scores only while a result from the current round is waiting
  // for the required viewers. An unplayed round has no spoiler to hide.
  const hideRoundScore = state.mode === 'online' && hasPlayedLeagueResult && !allPlayersWatched;

  // Knockout equivalent: everyone in the active tie round must have watched the leg.
  const koMatches = isKnockout && state.knockoutBracket ? getActiveKnockoutMatches(state.knockoutBracket) : [];
  const koParticipantIds = state.mode === 'online'
    ? getOnlineKnockoutParticipantIds(state.onlinePlayers, koMatches)
    : [];
  const koHumans = state.mode === 'online' ? state.onlinePlayers.filter(p => koParticipantIds.includes(p.id)) : [];
  const koAllWatched = koHumans.length === 0 || koHumans.every(p => state.onlineWatchedPlayers.includes(p.id));
  const koHasPlayedResult = koMatches.some((match: any) => {
    const singleLeg = match.isSingleLeg === true;
    if (singleLeg) return !!match.played && !!match.result;
    // After the first leg the bracket points to leg 2, but the first-leg
    // result is precisely what remains hidden until everyone watches it.
    return state.knockoutBracket?.currentLeg === 2 ? !!match.leg1 : !!match.leg2;
  });

  // Unified anti-spoiler gate: the POSITION notice, CLASSIFICAÇÃO, ESTATÍSTICAS and (knockout)
  // CHAVEAMENTO only reveal/update once EVERYONE in the round has left their match.
  const spoilerLock = state.mode === 'online' && (isKnockout
    ? koHasPlayedResult && !koAllWatched
    : hasPlayedLeagueResult && !allPlayersWatched);
  const spoilerWaiting = isKnockout
    ? koHumans.filter(p => !state.onlineWatchedPlayers.includes(p.id)).length
    : waitingForCount;
  const showingLeagueClassification = activeTab === 'standings'
    && hasLeagueClassification
    && (!isKnockout || classificationSubTab === 'league');

  // Check if player's match in this round is already played
  const playerFixture = currentRoundFixtures.find(
    f => f.homeTeamId === playerTeam?.id || f.awayTeamId === playerTeam?.id
  );
  const isPlayerMatchPlayed = playerFixture?.played ?? false;

  const handlePlayPlayerMatch = () => {
    if (reserveLimitExceeded) {
      setLineupWarning({ kind: 'reserve', names: [] });
      return;
    }
    // 🟥🩹 Bloqueio: se não houver reserva compatível, oferece contratação gratuita
    // prata/bronze para a posição antes de liberar a rodada.
    if (myUnavailable.length > 0) {
      const emergency = playerTeam ? getEmergencyReplacementTarget(playerTeam, state.discipline) : null;
      if (emergency && emergency.options.length > 0) { setEmergencySelection(emergency); return; }
      setLineupWarning({ kind: 'discipline', names: myUnavailable.map(u => u.shortName ?? '?') });
      return;
    }

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

  // ONLINE host only: simulate the entire round on the server at once (só com todos prontos).
  const handlePlayRound = () => {
    if (!allReady) return;
    playRoundOnline();
  };
  // ✅ Não-host aperta "Estou pronto" (só se a escalação estiver ok).
  const handleReadyToggle = () => {
    if (!isActiveLeagueParticipant) return;
    if (iAmReady) { playerUnreadyOnline(); return; }
    if (reserveLimitExceeded) {
      setLineupWarning({ kind: 'reserve', names: [] });
      return;
    }
    if (myUnavailable.length > 0) {
      const emergency = playerTeam ? getEmergencyReplacementTarget(playerTeam, state.discipline) : null;
      if (emergency && emergency.options.length > 0) { setEmergencySelection(emergency); return; }
      setLineupWarning({ kind: 'discipline', names: myUnavailable.map(u => u.shortName ?? '?') });
      return;
    }
    playerReadyOnline();
  };

  const handleEmergencySelection = (player: Player) => {
    if (!emergencySelection) return;
    if (online) {
      emergencyReplaceOnline(emergencySelection.starterId, player.id);
    } else {
      dispatch({ type: 'EMERGENCY_REPLACE_PLAYER', starterId: emergencySelection.starterId, player });
    }
    setEmergencySelection(null);
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
    } else if (isLeagueOnly) {
      const champion = state.leagueStandings[0]?.teamId ?? playerTeam?.id ?? 'player_team';
      dispatch({ type: 'FINISH_GAME', champion });
    } else {
      dispatch({ type: 'START_KNOCKOUT' });
    }
  };

  const handleFinishEliminatedCampaign = () => {
    if (state.mode === 'solo' && !qualifies) {
      dispatch({ type: 'FINISH_ELIMINATED_CAMPAIGN' });
    }
  };

  // ONLINE: when the host plays the round, the server simulates every match and
  // broadcasts the authoritative results. As soon as the local player's fixture
  // for the current round is resolved, auto-open it as a synchronized live replay
  // (each device replays the same server result, so the score is identical).
  // The server is the source of truth for "already watched": local markers only
  // remember which replay this device opened/finished. A replay that was never
  // finished opens again; one that was finished but not acknowledged by the
  // server is confirmed again instead of being replayed.
  const myOnlineId = online
    ? state.onlinePlayers.find(player => player.socketId === state.socketId)?.id ?? null
    : null;
  const pendingWatchConfirmation = useMemo((): { type: 'league' } | { type: 'knockout'; matchId: string; leg?: number } | null => {
    if (!online || !myOnlineId || !localTeamId || state.currentMatchResult) return null;
    if (state.phase === 'league') {
      if (state.onlineWatchedLeagueRound === leagueRound && state.onlineWatchedPlayers.includes(myOnlineId)) return null;
      return state.onlineFinishedReplays.includes(`L${leagueRound}`) ? { type: 'league' } : null;
    }
    if (state.phase === 'knockout' && state.knockoutBracket) {
      const legKey = state.onlineWatchedKnockoutLegKey;
      if (!legKey || legKey.round !== state.knockoutBracket.currentRound) return null;
      if (state.onlineWatchedPlayers.includes(myOnlineId)) return null;
      const myTie = (getActiveKnockoutMatches(state.knockoutBracket) as KnockoutMatch[])
        .find(m => m.homeTeamId === localTeamId || m.awayTeamId === localTeamId);
      if (!myTie) return null;
      const singleLeg = myTie.isSingleLeg === true;
      const key = singleLeg ? myTie.id : `${myTie.id}_l${legKey.leg}`;
      if (!state.onlineFinishedReplays.includes(key)) return null;
      return singleLeg ? { type: 'knockout', matchId: myTie.id } : { type: 'knockout', matchId: myTie.id, leg: legKey.leg };
    }
    return null;
  }, [
    online, myOnlineId, localTeamId, state.currentMatchResult, state.phase, leagueRound, state.knockoutBracket,
    state.onlineWatchedLeagueRound, state.onlineWatchedKnockoutLegKey, state.onlineWatchedPlayers, state.onlineFinishedReplays,
  ]);
  const pendingWatchKey = pendingWatchConfirmation ? JSON.stringify(pendingWatchConfirmation) : null;
  useEffect(() => {
    if (!pendingWatchConfirmation) return;
    // The first confirmation was sent when the replay ended; give it time to
    // land before repeating it. The server ignores duplicates.
    const resend = () => {
      if (pendingWatchConfirmation.type === 'league') notifyMatchWatchedOnline('league');
      else notifyMatchWatchedOnline('knockout', { matchId: pendingWatchConfirmation.matchId, leg: pendingWatchConfirmation.leg });
    };
    const timer = window.setInterval(resend, 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWatchKey, notifyMatchWatchedOnline]);

  useEffect(() => {
    if (state.mode !== 'online') return;
    if (state.phase !== 'league') return;
    if (state.currentMatchResult) return; // already watching one
    if (!localTeamId || !myOnlineId) return;

    const myFixture = leagueFixtures.find(
      f => f.round === leagueRound && (f.homeTeamId === localTeamId || f.awayTeamId === localTeamId)
    );
    if (!myFixture || !myFixture.played || !myFixture.result) return;
    if (state.onlineWatchedLeagueRound === leagueRound && state.onlineWatchedPlayers.includes(myOnlineId)) return;
    if (state.onlineFinishedReplays.includes(`L${leagueRound}`)) return;

    const home = getTeamById(myFixture.homeTeamId);
    const away = getTeamById(myFixture.awayTeamId);
    if (!home || !away) return;

    dispatch({ type: 'WATCH_ONLINE_MATCH', teams: [home, away], result: myFixture.result });
  }, [
    state.mode, state.phase, state.currentMatchResult, localTeamId, myOnlineId,
    state.onlineWatchedLeagueRound, state.onlineWatchedPlayers, state.onlineFinishedReplays,
    leagueFixtures, leagueRound, getTeamById, dispatch,
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
    let watched = state.watchedKnockoutMatches;
    if (state.mode === 'online' && myOnlineId) {
      const legKey = state.onlineWatchedKnockoutLegKey;
      const serverWaitsForMe = !!legKey && legKey.round === round && !state.onlineWatchedPlayers.includes(myOnlineId);
      if (serverWaitsForMe) {
        const pendingKey = myTie.isSingleLeg === true ? myTie.id : `${myTie.id}_l${legKey.leg}`;
        if (!state.onlineFinishedReplays.includes(pendingKey)) watched = watched.filter(key => key !== pendingKey);
      }
    }

    // Single-leg tie.
    const isSingleLegTie = myTie.isSingleLeg === true;
    if (isSingleLegTie) {
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
        teams: [teamB, teamA], // return leg: the first-leg visitor hosts
        result: myTie.leg2,
        knockout: { matchId: myTie.id, round, leg: 2, firstLeg: { home: myTie.leg1?.awayGoals ?? 0, away: myTie.leg1?.homeGoals ?? 0 } },
      });
    }
  }, [
    state.phase, state.mode, state.currentMatchResult, state.watchedKnockoutMatches, state.knockoutBracket, localTeamId, myOnlineId,
    state.onlineWatchedKnockoutLegKey, state.onlineWatchedPlayers, state.onlineFinishedReplays, getTeamById, dispatch,
  ]);

  return {
    // Game context
    state, dispatch, getTeamById, online,
    pickReinforcementOnline, dismissReinforcementOnline, rerollReinforcementOnline,
    shopPlaceBetOnline, shopCancelBetOnline,
    // Teams
    allTeams, localTeamId, getTeamName, playerTeam, leagueStandings, leagueRound,
    // Post-match modal queue
    postMatchModalQueueReady, showCreditsModal, closeCreditsModal,
    showMissionResolutionModal, closeMissionResolutionModal,
    // Recruitment
    recruitmentOffer, recruitmentEventLabel, recruitmentLevel,
    recruitmentSelectionsRemaining, recruitmentTotalOptions, recruitmentRerollsRemaining,
    // Local UI state
    activeTab, setActiveTab,
    classificationSubTab, setClassificationSubTab,
    statsSubTab, setStatsSubTab,
    resultsSubTab, setResultsSubTab,
    setSelectedHistoryKey,
    betSlip, setBetSlip,
    lineupWarning, setLineupWarning,
    emergencySelection, setEmergencySelection,
    detailsMatch, setDetailsMatch,
    openMatchDetails,
    // Competition format
    isKnockout, isLeagueOnly, hasGroupStage, hasLeagueClassification, isGroupStage,
    knockoutLabel, leagueRounds, qualifiedTeams, playoffTeams, directTeams, groupTables,
    // Stats
    topScorers, topAssists, topRatings, topKeepers, topTacklers, topCards,
    // History
    playerResults, historyPeriods, historyKey, historyPeriod, historyFixtures, historyKoTies,
    // Standing / qualification
    playerGroup, playerGroupLabel, playerStanding, playerPosition,
    groupQualified, groupQualifiedIds, directQual, playoffQual, qualifies,
    // Round fixtures
    displayedRoundFixtures, allFixturesPlayed, roundGroupIds,
    // Bets
    bettingLevel, remainingCap, betFor,
    // Lineup / readiness
    myUnavailable, reserveCount, reserveLimitExceeded,
    isActiveLeagueParticipant, iAmReady, readyCount, totalReady, allReady,
    humanPlayersWithMatch, allPlayersWatched, waitingForCount,
    hideRoundScore, koAllWatched,
    spoilerLock, spoilerWaiting, showingLeagueClassification,
    isPlayerMatchPlayed,
    // Handlers
    handlePlayPlayerMatch, handlePlayRound, handleReadyToggle, handleEmergencySelection,
    handleAdvanceRound, handleAdvanceKnockout, handleFinishEliminatedCampaign,
  };
}

export type LeagueHub = ReturnType<typeof useLeagueHub>;
