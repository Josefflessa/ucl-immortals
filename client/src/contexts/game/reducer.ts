// The game reducer (solo flow; online state arrives through room snapshots).

import * as seatRules from '@shared/game/seatRules';
import { Player, FORMATIONS, DIFFICULTY_LEVELS } from '@shared/game/gameData';
import { Team, PlayerCard, MatchResult, DraftState, calculateChemistry, generateDraftOptions, getNeededPositions, magnataPointMultiplier, generateBotTeam, pickBotNames, simulateMatch, generateImmortalReport, generateRandomLeagueFixtures, computeStandings, generateRandomGroupFixtures, computeGroupQualifiedStandings, getAllPlayedMatchResults, getPlayerSeasonStats, createKnockoutBracket, normalizeMatchPlan, MAX_RESERVE_PLAYERS, reservePlayerCount, draftSlotIndex, advanceKnockoutBracket, playActiveKnockoutLeg, getActiveKnockoutMatches, isKnockoutTeamAlive, bumpStarterAppearances, startingIdsForResult, stampMatchStartingLineups, applyMatchStatGrowth, applyDefeatGrowth, applyMercenarioProgress, applyApostadorWins, midiaticoCredits } from '@shared/game/gameEngine';
import { computeMatchPointsWithConfig, MatchPoints, lossStreakBonus, nextLossStreak } from '@shared/game/shop';
import { buildLeagueMatchKey, buildKnockoutMatchKey, newlyWonBets, revealEligibleKoBets, settleBet } from '@shared/game/bets';
import { applyMatchDiscipline, resolveAvailableLineup, resetYellowsForKnockout } from '@shared/game/discipline';
import { createInitialClubProjects, projectLevel, calculateClubReward, bettingLossRefundPercent } from '@shared/game/clubProjects';
import { DEFAULT_REWARDS_CONFIG, normalizeCompetitionFormat, validateCompetitionFormat } from '@shared/game/competition';
import { createMissionMatchContext, createMissionState, missionCycleKey, normalizeMissionState, rotateMissionBoard, updateMissionsAfterMatch, completedMissionCount } from '@shared/game/missions';
import { type GameState, type KnockoutBracket, type GameAction, initialState } from './state';

/**
 * Replay markers only make sense inside one room session. Carrying them into
 * another room (or a restarted one) marks unplayed rounds as watched, so the
 * replay never opens and the room waits forever for a confirmation.
 */
const ONLINE_REPLAY_RESET = {
  lastWatchedRound: 0,
  watchedKnockoutMatches: [],
  onlineWatchedPlayers: [],
  onlineWatchedLeagueRound: null,
  onlineWatchedKnockoutLegKey: null,
  onlineReplayKey: null,
  onlineFinishedReplays: [],
  currentMatchTeams: null,
  currentMatchResult: null,
  activeKnockoutMatch: null,
  spectating: false,
  matchCreditsModalPending: false,
} satisfies Partial<GameState>;

function finishOnlineReplay(state: GameState): Pick<GameState, 'onlineReplayKey' | 'onlineFinishedReplays'> {
  const key = state.mode === 'online' ? state.onlineReplayKey : null;
  return {
    onlineReplayKey: null,
    onlineFinishedReplays: key && !state.onlineFinishedReplays.includes(key)
      ? [...state.onlineFinishedReplays, key]
      : state.onlineFinishedReplays,
  };
}
import { soloSeatContext, soloMissionBoard, applySoloSeatRule, localMissionSeed, onlineLeagueResults, createRecruitmentOffer, medicalInjuryDurationForTeam, applyMedicalRecoveries, finishEliminatedSoloCampaign } from './soloCampaign';

// ============================================================
// REDUCER
// ============================================================
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SET_ACCOUNT_SECTION':
      return { ...state, accountSection: action.section, phase: 'account' };

    case 'SET_CREST':
      return { ...state, selectedCrestId: action.crestId };

    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.name };

    case 'SET_ONLINE_SETUP_INTENT':
      return { ...state, onlineSetupIntent: action.intent };

    case 'SET_DIFFICULTY':
      return { ...state, difficulty: action.difficulty };

    case 'SET_COMPETITION_FORMAT':
      // Keep the reducer defensive as well: UI validation is feedback, not a
      // security boundary, and invalid formats must never reach the engine.
      return validateCompetitionFormat(action.format) === null
        ? { ...state, competitionFormat: normalizeCompetitionFormat(action.format) }
        : state;

    case 'SET_COACH':
      return { ...state, selectedCoachId: action.coachId };

    case 'SET_FORMATION':
      return { ...state, selectedFormationId: action.formationId };

    case 'SET_PLAY_STYLE':
      return { ...state, selectedPlayStyle: action.playStyle };

    case 'SET_MATCH_PLAN':
      return { ...state, selectedMatchPlan: normalizeMatchPlan(action.plan) };

    case 'SET_PLAYER_TEAM_PLAY_STYLE':
      return applySoloSeatRule(state, seat => seatRules.setPlayStyle(seat, action.playStyle));

    case 'SET_PLAYER_TEAM_MATCH_PLAN':
      return applySoloSeatRule(state, seat => seatRules.setMatchPlan(seat, action.plan));

    case 'START_DRAFT': {
      const needed = getNeededPositions(state.selectedFormationId, Array(11).fill(undefined));
      const options = generateDraftOptions(needed, []);
      const draftState: DraftState = {
        round: 1,
        timerKey: 0,
        totalRounds: 13,          // 11 titulares + 2 reservas (banco)
        currentOptions: options,
        selectedPlayers: [],
        vetoesLeft: 4,
        formationId: state.selectedFormationId,
        coachId: state.selectedCoachId,
        neededPositions: needed,
      };
      return { ...state, phase: 'draft', draftState, draftedPlayers: Array(13).fill(undefined) };
    }

    case 'DRAFT_PLAYER': {
      if (!state.draftState) return state;
      const currentRound = state.draftState.round;
      const newDrafted = [...state.draftedPlayers];
      const targetIndex = draftSlotIndex(state.selectedFormationId, newDrafted, action.player);
      // A malformed/stale option must not overwrite a valid starter slot. The
      // server applies the same guard; in normal drafts this path is unreachable.
      if (targetIndex === -1) return state;

      newDrafted[targetIndex] = action.player;

      const newRound = currentRound + 1;

      if (newRound > state.draftState.totalRounds) {
        return {
          ...state,
          draftedPlayers: newDrafted,
          draftState: null,
          phase: 'squad_review',
        };
      }

      const needed = getNeededPositions(state.selectedFormationId, newDrafted);
      const drafted_ids = newDrafted.filter((p): p is Player => p !== null && p !== undefined).map(p => p.id);
      const options = generateDraftOptions(needed, drafted_ids);

      return {
        ...state,
        draftedPlayers: newDrafted,
        draftState: {
          ...state.draftState,
          round: newRound,
          timerKey: state.draftState.timerKey + 1,
          currentOptions: options,
          neededPositions: needed,
        },
      };
    }

    case 'VETO_DRAFT': {
      if (!state.draftState || state.draftState.vetoesLeft <= 0) return state;
      const actualDrafted = state.draftedPlayers.filter((p): p is Player => p !== null && p !== undefined);
      const needed = getNeededPositions(state.selectedFormationId, state.draftedPlayers);
      const drafted_ids = actualDrafted.map(p => p.id);
      const options = generateDraftOptions(needed, drafted_ids);
      return {
        ...state,
        draftState: {
          ...state.draftState,
          timerKey: state.draftState.timerKey + 1,
          currentOptions: options,
          vetoesLeft: state.draftState.vetoesLeft - 1,
        },
      };
    }

    case 'SWAP_PLAYERS': {
      const newDrafted = [...state.draftedPlayers];
      const temp = newDrafted[action.indexA];
      newDrafted[action.indexA] = newDrafted[action.indexB];
      newDrafted[action.indexB] = temp;
      
      let newCaptain = state.captain;
      let newPenaltyTaker = state.penaltyTaker;
      let newFreeKickTaker = state.freeKickTaker;

      const starters = newDrafted.slice(0, 11);
      const isCaptainInStarters = starters.some(p => p?.id === newCaptain);
      const isPenaltyTakerInStarters = starters.some(p => p?.id === newPenaltyTaker);
      const isFreeKickTakerInStarters = starters.some(p => p?.id === newFreeKickTaker);

      if (!isCaptainInStarters) {
        newCaptain = null;
      }
      if (!isPenaltyTakerInStarters) {
        newPenaltyTaker = null;
      }
      if (!isFreeKickTakerInStarters) {
        newFreeKickTaker = null;
      }

      return {
        ...state,
        draftedPlayers: newDrafted,
        captain: newCaptain,
        penaltyTaker: newPenaltyTaker,
        freeKickTaker: newFreeKickTaker,
      };
    }

    case 'SET_CAPTAIN':
      return { ...state, captain: action.playerId };

    case 'SET_PENALTY_TAKER':
      return { ...state, penaltyTaker: action.playerId };

    case 'SET_FREE_KICK_TAKER':
      return { ...state, freeKickTaker: action.playerId };

    case 'SWAP_PLAYER_TEAM':
      return applySoloSeatRule(state, seat => seatRules.swapLineup(seat, action.indexA, action.indexB));

    case 'SET_PLAYER_TEAM_CAPTAIN':
      return applySoloSeatRule(state, seat => seatRules.setMatchRoles(seat, { captain: action.playerId }));

    case 'SET_PLAYER_TEAM_MARTIR_TARGETS':
      return applySoloSeatRule(state, seat => seatRules.setMartirTargets(seat, action.playerId, action.targetIds));
    case 'SET_PLAYER_TEAM_PADRINHO_TARGET':
      return applySoloSeatRule(state, seat => seatRules.setPadrinhoTarget(seat, action.playerId, action.targetId));

    case 'SET_PLAYER_TEAM_PENALTY_TAKER':
      return applySoloSeatRule(state, seat => seatRules.setMatchRoles(seat, { penaltyTaker: action.playerId }));

    case 'SET_PLAYER_TEAM_FREE_KICK_TAKER':
      return applySoloSeatRule(state, seat => seatRules.setMatchRoles(seat, { freeKickTaker: action.playerId }));

    case 'SET_PLAYER_TEAM_FORMATION':
      return applySoloSeatRule(state, seat => seatRules.setFormation(seat, action.formationId));

    case 'PICK_REINFORCEMENT':
      // A stale or double click is a no-op: the offer stays open (online, the next
      // room patch reconciles the remaining choices).
      return applySoloSeatRule(state, seat => seatRules.pickReinforcement(seat, soloSeatContext(state).shopOpen, action.player.id));

    case 'DISMISS_REINFORCEMENT':
      return { ...state, reinforcementOptions: null, reinforcementOffer: null };

    case 'UPGRADE_CLUB_PROJECT':
      // Also applied optimistically in online rooms; the server stays authoritative.
      return applySoloSeatRule(state, seat => seatRules.upgradeClubProject(seat, soloSeatContext(state), action.projectId));

    // ── SHOP (solo; no online o servidor aplica e devolve o estado) ─────
    case 'SHOP_CHANGE_COACH':
      return applySoloSeatRule(state, seat => seatRules.changeCoach(seat, soloSeatContext(state), action.coachId));

    case 'SET_EVOLVE_POINT':
      return applySoloSeatRule(state, seat => seatRules.setEvolvePoint(seat, action.playerId, action.attr, action.delta));
    case 'SET_AUTO_EVOLVE_ATTRIBUTE':
      return applySoloSeatRule(state, seat => seatRules.setAutoEvolveAttribute(seat, action.playerId, action.attr));
    case 'UNLOCK_PLAYER_SPECIALIZATION':
      return applySoloSeatRule(state, seat => seatRules.unlockSpecialization(seat, action.playerId));
    case 'CHOOSE_PLAYER_SPECIALIZATION':
      return applySoloSeatRule(state, seat => seatRules.chooseSpecialization(seat, action.playerId, action.specialization));
    case 'RESET_EVOLVE_POINTS':
      return applySoloSeatRule(state, seat => seatRules.resetEvolvePoints(seat, action.playerId));

    case 'EVOLVE_COACH_PRIME': {
      const wins = state.leagueStandings.find(s => s.teamId === state.playerTeam?.id)?.won ?? 0;
      return applySoloSeatRule(state, seat => seatRules.evolveCoachPrime(seat, soloSeatContext(state), wins));
    }

    case 'ENSURE_UNIQUE_PACK_OFFER':
      if (state.mode === 'online') return state;
      return applySoloSeatRule(state, seat => ({ ok: true, seat: seatRules.ensureUniquePackOffer(seat, soloSeatContext(state)) }));

    case 'ENSURE_PLAYER_PACK_OFFERS':
      if (state.mode === 'online') return state;
      return applySoloSeatRule(state, seat => ({ ok: true, seat: seatRules.ensurePlayerPackOffers(seat, soloSeatContext(state)) }));

    case 'SHOP_OPEN_UNIQUE_PACK':
      // Paid on open; the card is drawn from the round's persisted offer and stays
      // pending until the reveal animation finishes (reopening never re-rolls).
      return applySoloSeatRule(state, seat => seatRules.openUniquePack(seat, soloSeatContext(state)));

    case 'SHOP_OPEN_PLAYER_PACK':
      return applySoloSeatRule(state, seat => seatRules.openPlayerPack(seat, soloSeatContext(state), action.rarity));

    case 'SHOP_CLAIM_PLAYER_PACK':
      return applySoloSeatRule(state, seatRules.claimPlayerPack);

    case 'SHOP_CLAIM_UNIQUE_PACK':
      return applySoloSeatRule(state, seatRules.claimUniquePack);

    case 'SHOP_OPEN_PACK':
      // Caça-Talentos: paid on open; the chosen card is free.
      return applySoloSeatRule(state, seat => seatRules.openScoutPack(seat, soloSeatContext(state), action.position));

    case 'SHOP_PICK_PACK':
      return applySoloSeatRule(state, seat => seatRules.pickScoutPack(seat, action.player.id));

    case 'SHOP_TURBINAR': {
      if (!state.playerTeam) return state;
      // A characteristic follows the whole competition, including matches already played.
      const competitionStats = getPlayerSeasonStats(
        action.playerId,
        state.playerTeam.id,
        getAllPlayedMatchResults(state.leagueResults, state.knockoutBracket),
      );
      return applySoloSeatRule(state, seat => seatRules.turbinar(seat, soloSeatContext(state), action.playerId, action.variant, competitionStats));
    }

    case 'SHOP_REMOVE_VARIANT':
      return applySoloSeatRule(state, seat => seatRules.removeVariant(seat, soloSeatContext(state), action.playerId, action.variantKey));

    case 'SHOP_TRAIN':
      return applySoloSeatRule(state, seat => seatRules.train(seat, soloSeatContext(state), action.playerId, action.attr));

    case 'REROLL_REINFORCEMENT':
      return applySoloSeatRule(state, seat => seatRules.rerollReinforcement(seat, soloSeatContext(state).shopOpen));

    case 'PLACE_BET':
      // 🎯 Escrow: the stake is held now; editing the same match adjusts by the difference.
      return applySoloSeatRule(state, seat => seatRules.placeBet(seat, action.matchKey, seatRules.resolveBetTarget(action.matchKey, state), action));

    case 'CANCEL_BET':
      return applySoloSeatRule(state, seat => seatRules.cancelBet(seat, action.matchKey));

    case 'HEAL_INJURY':
      // 🏥 Medical Department: free physio uses per competition, then the level's price.
      return applySoloSeatRule(state, seat => seatRules.treatInjury(seat, state.discipline, action.playerId));

    case 'EMERGENCY_REPLACE_PLAYER':
      if (state.mode === 'online') return state;
      return applySoloSeatRule(state, seat => seatRules.emergencyReplace(seat, state.discipline, action.starterId, action.player.id));

    case 'ACCEPT_MISSION':
      if (state.mode === 'online') return state;
      return applySoloSeatRule(state, seat => seatRules.acceptMissionOnBoard(seat, soloSeatContext(state), soloMissionBoard(state), action.missionId));

    case 'REROLL_MISSIONS':
      if (state.mode === 'online') return state;
      return applySoloSeatRule(state, seat => seatRules.rerollMissions(seat, soloSeatContext(state), soloMissionBoard(state)));

    case 'REMOVE_MISSION':
      if (state.mode === 'online') return state;
      return applySoloSeatRule(state, seat => seatRules.removeActiveMission(seat, soloSeatContext(state), soloMissionBoard(state), action.missionId));

    case 'DISMISS_MISSION_RESOLUTION':
      return applySoloSeatRule(state, seatRules.dismissMissionResult);

    case 'SELL_PLAYER':
      // 🏪 Solo market: sells a reserve (bench) to the bank. Starters are not for sale.
      if (state.mode === 'online') return state;
      return applySoloSeatRule(state, seat => seatRules.sellReserve(seat, soloSeatContext(state), state.discipline, action.playerId));

    case 'START_LEAGUE': {
      // Build player team
      const starters = state.draftedPlayers.slice(0, 11).filter((p): p is Player => p !== null && p !== undefined);
      const formation = FORMATIONS.find(f => f.id === state.selectedFormationId);
      const formationRoles = formation?.positions.map(p => p.role) ?? [];

      const chemData = calculateChemistry(
        starters,
        state.selectedCoachId,
        formationRoles,
        state.selectedFormationId
      );

      const allPlayers = state.draftedPlayers.filter((p): p is Player => p !== null && p !== undefined);
      const playerCards: PlayerCard[] = allPlayers.map(p => {
        const idx = state.draftedPlayers.findIndex(dp => dp?.id === p.id);
        const isOOP = idx !== -1 && idx < 11 ? (chemData.outOfPosition[p.id] ?? false) : false;

        return {
          ...p,
          chemistryScore: chemData.individual[p.id] ?? 1,
          isOOP,
        };
      });

      const playerTeam: Team = {
        id: 'player_team',
        name: state.playerName || 'Meu Time',
        coachId: state.selectedCoachId,
        formationId: state.selectedFormationId,
        playStyle: state.selectedPlayStyle,
        matchPlan: normalizeMatchPlan(state.selectedMatchPlan),
        players: playerCards,
        captain: state.captain ?? undefined,
        penaltyTaker: state.penaltyTaker ?? undefined,
        freeKickTaker: state.freeKickTaker ?? undefined,
        totalChemistry: chemData.total,
        isBot: false,
        credits: state.points,
        clubProjects: createInitialClubProjects(),
        crestId: state.selectedCrestId ?? undefined,
      };

      // Generate bot teams
      const diffLevel = DIFFICULTY_LEVELS.find(d => d.id === state.difficulty);
      const botStrength = diffLevel?.botStrength ?? 0.72;

      // Never a bot with the same name or crest as the player club.
      const botTeams = pickBotNames(Math.max(0, state.competitionFormat.teamCount - 1), [playerTeam]).map(name => generateBotTeam(name, botStrength));

      const allTeams = [playerTeam, ...botTeams];
      const fixtures = state.competitionFormat.id === 'groups_knockout'
        ? generateRandomGroupFixtures(allTeams, state.competitionFormat.groupCount, state.competitionFormat.groupRounds)
        : generateRandomLeagueFixtures(allTeams, state.competitionFormat.leagueRounds);
      const standings = computeStandings(allTeams, []);
      const initialMissionCycle = state.competitionFormat.id === 'knockout'
        ? missionCycleKey('knockout', 1, 'round16', 1)
        : missionCycleKey('league', 1);
      const missions = createMissionState(
        action.missionSeed,
        initialMissionCycle,
      );

      if (state.competitionFormat.id === 'knockout') {
        const bracket = createKnockoutBracket(standings, state.competitionFormat) as KnockoutBracket;
        return {
          ...state,
          playerTeam,
          botTeams,
          leagueFixtures: [],
          leagueStandings: standings,
          leagueResults: [],
          leagueRound: 1,
          knockoutBracket: bracket,
          phase: 'knockout',
          reinforcementOptions: null,
          reinforcementOffer: null,
          reinforcementEventCount: 0,
          missions,
          discipline: resetYellowsForKnockout(state.discipline),
        };
      }

      return {
        ...state,
        playerTeam,
        botTeams,
        leagueFixtures: fixtures,
        leagueStandings: standings,
        leagueResults: [],
        leagueRound: 1,
        phase: 'league',
        reinforcementOptions: null,
        reinforcementOffer: null,
        reinforcementEventCount: 0,
        missions,
        medicalFreeTreatmentsUsed: 0,
      };
    }

    case 'PLAY_LEAGUE_MATCH': {
      if (state.playerTeam && reservePlayerCount(state.playerTeam) > MAX_RESERVE_PLAYERS) return state;
      // In online mode, resolve teams from onlinePlayers; in solo from playerTeam + botTeams
      let homeTeam: Team | undefined;
      let awayTeam: Team | undefined;

      if (state.mode === 'online') {
        const allHumanTeams = state.onlinePlayers.filter(p => p.team).map(p => p.team!);
        const allTeams = [...allHumanTeams, ...state.botTeams];
        homeTeam = allTeams.find(t => t.id === action.homeTeamId);
        awayTeam = allTeams.find(t => t.id === action.awayTeamId);
      } else {
        if (!state.playerTeam) return state;
        const allTeams = [state.playerTeam, ...state.botTeams];
        homeTeam = allTeams.find(t => t.id === action.homeTeamId);
        awayTeam = allTeams.find(t => t.id === action.awayTeamId);
      }

      if (!homeTeam || !awayTeam) return state;

      // Estribado uses the owner's current shop balance. Hydrate the local team
      // immediately before a match so spending/earning credits cannot leave a
      // stale balance inside the match snapshot.
      const hydrateCredits = (team: Team): Team =>
        team.id === state.playerTeam?.id ? { ...team, credits: state.points } : team;
      homeTeam = hydrateCredits(homeTeam);
      awayTeam = hydrateCredits(awayTeam);

      // 🟨🟥🩹 Resolve as escalações contra a disciplina (suspensos/lesionados fora; reserva promovido).
      const rHome = resolveAvailableLineup(homeTeam, state.discipline).team;
      const rAway = resolveAvailableLineup(awayTeam, state.discipline).team;

      // Um único motor de simulação: no solo, pré-computa o resultado autoritativo (gols +
      // cartões + lesões + força) e entra em modo replay no MatchSimPage — igual mata-mata.
      // No online o replay é aberto por WATCH_ONLINE_MATCH com o resultado do servidor;
      // aqui preservamos o currentMatchResult existente pra não interferir.
      const currentMatchResult = state.mode === 'online'
        ? state.currentMatchResult
        : stampMatchStartingLineups(
            simulateMatch(rHome, rAway, false, false, true, false),
            rHome,
            rAway,
          );

      return {
        ...state,
        phase: 'match_sim',
        currentMatchTeams: [rHome, rAway],
        currentMatchResult,
      };
    }

    case 'FINISH_LEAGUE_MATCH': {
      // In online mode the server updates fixtures/standings — just clear the local
      // match state and mark this round's replay as watched.
      if (state.mode === 'online') {
        // The round was already marked watched when the replay opened.
        return {
          ...state,
          ...finishOnlineReplay(state),
          phase: 'league',
          currentMatchTeams: null,
          currentMatchResult: null,
        };
      }

      if (!state.playerTeam) return state;
      const allTeams = [{ ...state.playerTeam, credits: state.points }, ...state.botTeams];
      const playerFixture = state.leagueFixtures.find(f =>
        f.round === state.leagueRound
        && (f.homeTeamId === state.playerTeam!.id || f.awayTeamId === state.playerTeam!.id)
      );
      // A second finish event can arrive after a reconnect or a double click.
      // The fixture itself is the authoritative once-only gate in solo mode.
      if (!playerFixture || playerFixture.played) return state;

      const replayHome = state.currentMatchTeams?.find(team => team.id === action.result.homeTeamId);
      const replayAway = state.currentMatchTeams?.find(team => team.id === action.result.awayTeamId);
      const playerResult = replayHome && replayAway
        ? stampMatchStartingLineups(action.result, replayHome, replayAway)
        : action.result;

      // Save result for the player's fixture in the current round
      let allFixtures = state.leagueFixtures.map(f => {
        if (f.round === state.leagueRound && (f.homeTeamId === state.playerTeam?.id || f.awayTeamId === state.playerTeam?.id)) {
          return { ...f, played: true, result: playerResult };
        }
        return f;
      });

      // Automatically simulate other matches in the same round if not already done.
      // 🟨🟥🩹 Bots também resolvem a escalação contra a disciplina (suspensos/lesionados fora).
      allFixtures = allFixtures.map(f => {
        if (f.round === state.leagueRound && !f.played) {
          const home = resolveAvailableLineup(allTeams.find(t => t.id === f.homeTeamId)!, state.discipline).team;
          const away = resolveAvailableLineup(allTeams.find(t => t.id === f.awayTeamId)!, state.discipline).team;
          const result = stampMatchStartingLineups(
            simulateMatch(home, away, false, false, true, false),
            home,
            away,
          );
          return { ...f, played: true, result };
        }
        return f;
      });

      // 🟨🟥🩹 Aplica a disciplina da RODADA (todos os times que jogaram) — decrementa quem cumpriu e
      // aplica as novas suspensões/lesões deste jogo (valem no PRÓXIMO).
      const roundFx = allFixtures.filter(f => f.round === state.leagueRound && f.result);
      const roundTeamIds = Array.from(new Set(roundFx.flatMap(f => [f.homeTeamId, f.awayTeamId])));
      const nameOf = (teamId: string, playerId: string) =>
        allTeams.find(t => t.id === teamId)?.players.find(p => p.id === playerId)?.shortName ?? '?';
      const disc = applyMatchDiscipline(
        state.discipline,
        roundTeamIds,
        roundFx.map(f => f.result!),
        nameOf,
        Math.random,
        teamId => medicalInjuryDurationForTeam(allTeams.find(team => team.id === teamId) ?? state.playerTeam!),
      );

      const standings = computeStandings(allTeams, allFixtures);
      // Collect ALL played results across all rounds to preserve stats
      const results = allFixtures.map(f => f.result!).filter(Boolean);

      const rewards = state.competitionFormat?.rewards ?? DEFAULT_REWARDS_CONFIG;
      const rewardLimit = rewards.reinforcementUntilRound;
      const offersByRound = rewards.reinforcement === 'round' || rewards.reinforcement === 'round_and_stage';
      const shouldOfferReinforcement = rewards.reinforcement !== 'off'
        && (rewardLimit === null || state.leagueRound <= rewardLimit)
        && (offersByRound || state.leagueRound === (state.competitionFormat?.id === 'groups_knockout' ? state.competitionFormat.groupRounds : state.competitionFormat?.leagueRounds));
      // The competition decides whether this event exists. The Recruitment
      // Centre modifies its option count and how many players can be hired.
      const reinforcementEventCount = shouldOfferReinforcement
        ? state.reinforcementEventCount + 1
        : state.reinforcementEventCount;
      const recruitmentOffer = shouldOfferReinforcement
        ? createRecruitmentOffer(state.playerTeam, rewards.reinforcementOptions, 'round', reinforcementEventCount)
        : null;

      // Award shop credits for the player's performance using this format's values.
      const matchPoints = computeMatchPointsWithConfig(playerResult, state.playerTeam.id, rewards.points);
      const rewardVenue = playerResult.homeTeamId === state.playerTeam.id ? 'home' : 'away';
      // 🏟️📣 Torcida and 🤑 Magnata are independent bonuses calculated from the base reward.
      const magMult = magnataPointMultiplier(state.playerTeam.players);
      // 🔥 Recuperação — extra credits scaled by the CURRENT losing streak, reset on win/draw.
      const priorLossStreak = state.playerTeam.lossStreak ?? 0;
      const streakBonusAmount = lossStreakBonus(matchPoints.outcome, priorLossStreak);
      const updatedLossStreak = nextLossStreak(matchPoints.outcome, priorLossStreak);
      const reward = calculateClubReward(
        matchPoints.total,
        projectLevel(state.playerTeam.clubProjects, 'supporters'),
        rewardVenue,
        magMult > 1,
        streakBonusAmount,
        midiaticoCredits(state.playerTeam, playerResult),
      );
      const earnedPoints = rewards.pointsEnabled ? reward.total : 0;
      const decoratedMatchPoints = rewards.pointsEnabled
        ? {
            ...matchPoints,
            matchKey: buildLeagueMatchKey(playerFixture.round, playerFixture.homeTeamId, playerFixture.awayTeamId),
            total: reward.total,
            baseTotal: reward.base,
            supportersBonus: reward.supportersBonus,
            supportersPercent: reward.supportersPercent,
            supportersVenue: reward.supportersVenue,
            magnataBonus: reward.magnataBonus,
            magnataPercent: reward.magnataPercent,
            midiaticoBonus: reward.midiaticoBonus,
            lossStreakBonus: reward.lossStreakBonus,
            lossStreakAfter: updatedLossStreak,
          }
        : null;

      // 🎯 Palpite: liquida e CREDITA os palpites da rodada agora (no solo, o fim da partida é a
      // revelação — o jogador viu o seu jogo ao vivo e os demais foram simulados aqui).
      const betPrefix = `L${state.leagueRound}:`;
      let betWinnings = 0;
      const betProtectionPercent = bettingLossRefundPercent(projectLevel(state.playerTeam.clubProjects, 'betting'));
      const settledBets = state.bets.map(b => {
        if (b.revealed || !b.matchKey.startsWith(betPrefix)) return b;
        const fx = allFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === b.matchKey);
        if (!fx?.result) return b;
        const r = settleBet(b, fx.result);
        const protectionRefund = !r.won && betProtectionPercent > 0
          ? Math.round(b.stake * betProtectionPercent / 100)
          : 0;
        betWinnings += r.payout + protectionRefund;
        return { ...b, settled: true, revealed: true, won: r.won, tier: r.tier, payout: r.payout, protectionRefund };
      });

      const updatedPlayerTeam = bumpStarterAppearances(
        applyMatchStatGrowth(
          applyDefeatGrowth(state.playerTeam, playerResult),
          playerResult,
          buildLeagueMatchKey(playerFixture.round, playerFixture.homeTeamId, playerFixture.awayTeamId),
        ),
        startingIdsForResult(playerResult, state.playerTeam.id, replayHome?.id === state.playerTeam.id ? replayHome : replayAway?.id === state.playerTeam.id ? replayAway : state.playerTeam),
        buildLeagueMatchKey(playerFixture.round, playerFixture.homeTeamId, playerFixture.awayTeamId),
      );
      const recoveredPlayerTeam = applyMedicalRecoveries(updatedPlayerTeam, disc.recoveredInjuries);
      const updatedBotTeams = state.botTeams.map(team => {
        const fixture = roundFx.find(f => f.homeTeamId === team.id || f.awayTeamId === team.id);
        const updated = fixture?.result
          ? applyMatchStatGrowth(
          applyDefeatGrowth(team, fixture.result),
          fixture.result,
          buildLeagueMatchKey(fixture.round, fixture.homeTeamId, fixture.awayTeamId),
          )
          : team;
        return applyMedicalRecoveries(updated, disc.recoveredInjuries);
      });
      const nextPointsBeforeMissions = state.points + earnedPoints + betWinnings;
      const missionTeam = playerResult.homeTeamId === state.playerTeam.id ? replayHome : replayAway;
      const missionOpponent = playerResult.homeTeamId === state.playerTeam.id ? replayAway : replayHome;
      const missionContext = missionTeam && missionOpponent
        ? createMissionMatchContext(missionTeam, missionOpponent, playerResult)
        : null;
      const missionKey = buildLeagueMatchKey(playerFixture.round, playerFixture.homeTeamId, playerFixture.awayTeamId);
      const missionState = state.missions ?? createMissionState('solo', `L${state.leagueRound}`);
      const missionUpdate = missionContext
        ? updateMissionsAfterMatch(
            missionState,
            missionContext,
            missionKey,
            projectLevel(missionTeam?.clubProjects, 'missions'),
          )
        : { state: missionState, reward: 0, completed: [], expired: [] };
      const nextPoints = nextPointsBeforeMissions + missionUpdate.reward;

      return {
        ...state,
        phase: 'league',
        leagueFixtures: allFixtures,
        leagueStandings: standings,
        leagueResults: results,
        currentMatchTeams: null,
        currentMatchResult: null,
        reinforcementOptions: recruitmentOffer?.options ?? state.reinforcementOptions,
        reinforcementOffer: recruitmentOffer?.offer ?? state.reinforcementOffer,
        reinforcementEventCount,
        missions: missionUpdate.state,
        points: nextPoints,
        lastMatchPoints: decoratedMatchPoints,
        // Shown once on the hub; persisted so a reload or a continued campaign does not reopen it.
        matchCreditsModalPending: Boolean(decoratedMatchPoints),
        bets: settledBets,
        discipline: disc.next,
        // ⭐ +1 jogo pros 11 titulares do jogador (progresso pra Carta Evoluída).
        playerTeam: { ...applyApostadorWins(applyMercenarioProgress(recoveredPlayerTeam, completedMissionCount(missionUpdate.state)), newlyWonBets(state.bets, settledBets)), credits: nextPoints, lossStreak: updatedLossStreak },
        botTeams: updatedBotTeams,
      };
    }

    case 'ADVANCE_LEAGUE_ROUND': {
      const stageRounds = state.competitionFormat.id === 'groups_knockout'
        ? state.competitionFormat.groupRounds
        : state.competitionFormat.leagueRounds;
      const nextRound = Math.min(stageRounds, state.leagueRound + 1);
      return {
        ...state,
        leagueRound: nextRound,
        missions: rotateMissionBoard(
          state.missions,
          localMissionSeed(state),
          missionCycleKey('league', nextRound),
        ),
      };
    }

    case 'START_KNOCKOUT': {
      if (!state.playerTeam) return state;
      // Configured knockout: optional playoffs → R16 → QF → SF → Final.
      // Group formats qualify the configured number from each group instead of
      // taking a global top-N table.
      const allTeams = [state.playerTeam, ...state.botTeams];
      const bracketStandings = state.competitionFormat.id === 'groups_knockout'
        ? computeGroupQualifiedStandings(allTeams, state.leagueFixtures, state.competitionFormat)
        : state.leagueStandings;
      const bracket = createKnockoutBracket(bracketStandings, state.competitionFormat) as KnockoutBracket;
      const playerStillQualified = isKnockoutTeamAlive(bracket, state.playerTeam.id);
      // 🟨 Amarelos acumulados zeram ao entrar no mata-mata (suspensões/lesões em curso continuam).
      return {
        ...state,
        knockoutBracket: bracket,
        phase: 'knockout',
        reinforcementOptions: playerStillQualified ? state.reinforcementOptions : null,
        reinforcementOffer: playerStillQualified ? state.reinforcementOffer : null,
        missions: rotateMissionBoard(
          state.missions,
          localMissionSeed(state),
          missionCycleKey('knockout', state.leagueRound, bracket.currentRound, bracket.currentLeg),
        ),
        discipline: resetYellowsForKnockout(state.discipline),
      };
    }

    case 'PLAY_KNOCKOUT_LEG': {
      // Solo: simulate the current leg (ida/volta) of every tie in the active
      // round on the server-equivalent engine. The player then watches their own
      // tie as a synchronized replay (KnockoutPage auto-opens it).
      if (!state.knockoutBracket || !state.playerTeam) return state;
      if (reservePlayerCount(state.playerTeam) > MAX_RESERVE_PLAYERS) return state;
      const allTeams = [state.playerTeam, ...state.botTeams];
      const activeBefore = getActiveKnockoutMatches(state.knockoutBracket) as any[];
      const legNum = state.knockoutBracket.currentLeg;
      const legAlreadyPlayed = activeBefore.length > 0 && activeBefore.every(tie => {
        const singleLeg = tie.isSingleLeg === true;
        return singleLeg
          ? Boolean(tie.played && tie.result)
          : legNum === 2 ? Boolean(tie.leg2) : Boolean(tie.leg1);
      });
      // The same transition must be safe if the UI/replay dispatches it twice.
      if (legAlreadyPlayed) return state;

      const bracket: KnockoutBracket = JSON.parse(JSON.stringify(state.knockoutBracket));
      const isFinalRound = bracket.currentRound === 'final';
      const resolvedTeams = new Map<string, Team>();
      // 🟨🟥🩹 Resolve as escalações contra a disciplina antes de simular a perna (bots inclusos).
      const resolveFn = (id: string) => {
        const cached = resolvedTeams.get(id);
        if (cached) return cached;
        const t = allTeams.find(tm => tm.id === id);
        if (!t) return undefined;
        const resolved = resolveAvailableLineup(t, state.discipline).team;
        resolvedTeams.set(id, resolved);
        return resolved;
      };
      playActiveKnockoutLeg(bracket as any, resolveFn as any);
      // Aplica a disciplina da PERNA recém-jogada (times da rodada ativa).
      const active = getActiveKnockoutMatches(bracket) as any[];
      const legResults = active.map(tie => {
        const singleLeg = tie.isSingleLeg === true;
        const result = singleLeg ? tie.result : legNum === 2 ? tie.leg2 : tie.leg1;
        if (!result) return null;
        const stamped = stampMatchStartingLineups(
          result,
          resolvedTeams.get(result.homeTeamId) ?? allTeams.find(team => team.id === result.homeTeamId) ?? { players: [] },
          resolvedTeams.get(result.awayTeamId) ?? allTeams.find(team => team.id === result.awayTeamId) ?? { players: [] },
        );
        if (singleLeg) tie.result = stamped;
        else if (legNum === 2) tie.leg2 = stamped;
        else tie.leg1 = stamped;
        return stamped;
      }).filter((result): result is MatchResult => Boolean(result));
      const koTeamIds = Array.from(new Set(active.flatMap(t => [t.homeTeamId, t.awayTeamId])));
      const koNameOf = (teamId: string, playerId: string) =>
        allTeams.find(t => t.id === teamId)?.players.find(p => p.id === playerId)?.shortName ?? '?';
      const disc = applyMatchDiscipline(
        state.discipline,
        koTeamIds,
        legResults,
        koNameOf,
        Math.random,
        teamId => medicalInjuryDurationForTeam(allTeams.find(team => team.id === teamId) ?? state.playerTeam!),
      );
      const matchKeyForResult = (result: MatchResult) => {
        const tie = active.find(candidate => candidate.homeTeamId === result.homeTeamId || candidate.awayTeamId === result.homeTeamId);
        return tie ? buildKnockoutMatchKey(tie.id, legNum) : undefined;
      };
      const playerTeamAfterGrowth = legResults.reduce(
        (team, result) => applyMatchStatGrowth(applyDefeatGrowth(team, result), result, matchKeyForResult(result)),
        state.playerTeam,
      );
      const playerResult = legResults.find(result => result.homeTeamId === state.playerTeam!.id || result.awayTeamId === state.playerTeam!.id);
      const playerTie = active.find(tie => tie.homeTeamId === state.playerTeam!.id || tie.awayTeamId === state.playerTeam!.id);
      const playedPlayerTeam = playerResult && playerTie
        ? bumpStarterAppearances(
            playerTeamAfterGrowth,
            startingIdsForResult(playerResult, state.playerTeam.id, resolvedTeams.get(state.playerTeam.id) ?? state.playerTeam),
            buildKnockoutMatchKey(playerTie.id, legNum),
          )
        : playerTeamAfterGrowth;
      const playerTeam = applyMedicalRecoveries(playedPlayerTeam, disc.recoveredInjuries);
      const botTeams = state.botTeams.map(team => legResults.reduce(
        (current, result) => applyMatchStatGrowth(applyDefeatGrowth(current, result), result, matchKeyForResult(result)),
        team,
      )).map(team => applyMedicalRecoveries(team, disc.recoveredInjuries));
      // 🎯 Revela AGORA os palpites de confrontos que o jogador NÃO joga (placar já visível →
      // sem spoiler). O confronto próprio só revela depois que ele assistir (FINISH_KNOCKOUT_MATCH).
      // Sem isso, apostar num confronto alheio ficava eternamente "em andamento".
      const koTies = [
        ...((bracket as any).playoffs ?? []), ...((bracket as any).round16 ?? []),
        ...(bracket as any).quarterFinals, ...(bracket as any).semiFinals,
        ...((bracket as any).final ? [(bracket as any).final] : []),
      ];
      const bettingLevel = projectLevel(state.playerTeam.clubProjects, 'betting');
      const revealed = revealEligibleKoBets(
        state.bets,
        koTies,
        state.playerTeam.id,
        state.watchedKnockoutMatches,
        bettingLossRefundPercent(bettingLevel),
      );
      // ⭐ +1 jogo pros 11 titulares do jogador (a perna que ele acabou de disputar).
      const stageNumber = state.competitionFormat?.id === 'knockout'
        ? ({ round16: 1, quarters: 2, semis: 3, final: 4 } as Record<string, number>)[bracket.currentRound] ?? 1
        : ({ playoffs: 1, round16: 2, quarters: 3, semis: 4, final: 5 } as Record<string, number>)[bracket.currentRound] ?? 1;
      const koRewards = state.competitionFormat?.rewards ?? DEFAULT_REWARDS_CONFIG;
      const stageFinished = active.length > 0 && active.every(t => t.played);
      const playerTeamStillInCompetition = !isFinalRound && isKnockoutTeamAlive(bracket, playerTeam.id);
      const offersByStage = koRewards.reinforcement === 'stage' || koRewards.reinforcement === 'round_and_stage';
      const shouldOfferStageReinforcement = playerTeamStillInCompetition && stageFinished
        && offersByStage
        && (koRewards.reinforcement === 'round_and_stage' || koRewards.reinforcementUntilRound === null || stageNumber <= koRewards.reinforcementUntilRound);
      const reinforcementEventCount = shouldOfferStageReinforcement
        ? state.reinforcementEventCount + 1
        : state.reinforcementEventCount;
      const recruitmentOffer = shouldOfferStageReinforcement
        ? createRecruitmentOffer(playerTeam, koRewards.reinforcementOptions, 'stage', reinforcementEventCount)
        : null;
      const clearRecruitmentOffer = stageFinished && !playerTeamStillInCompetition;
      return {
        ...state,
        knockoutBracket: bracket,
        discipline: disc.next,
        playerTeam: applyApostadorWins(playerTeam, newlyWonBets(state.bets, revealed.bets)),
        botTeams,
        bets: revealed.bets,
        points: state.points + revealed.winnings,
        reinforcementOptions: clearRecruitmentOffer ? null : recruitmentOffer?.options ?? state.reinforcementOptions,
        reinforcementOffer: clearRecruitmentOffer ? null : recruitmentOffer?.offer ?? state.reinforcementOffer,
        reinforcementEventCount,
      };
    }

    case 'ADVANCE_KNOCKOUT': {
      // Solo: advance the bracket once the active round is fully decided.
      if (!state.knockoutBracket || !state.playerTeam) return state;
      const allTeams = [state.playerTeam, ...state.botTeams];
      const bracket: KnockoutBracket = JSON.parse(JSON.stringify(state.knockoutBracket));
      const champion = advanceKnockoutBracket(bracket as any);
      if (champion) {
        const championTeam = allTeams.find(t => t.id === champion);
        const report = generateImmortalReport(
          state.playerTeam!,
          getAllPlayedMatchResults(state.leagueResults, bracket),
          championTeam?.name ?? 'Campeão'
        );
        return { ...state, knockoutBracket: bracket, champion, report, phase: 'report', reinforcementOptions: null, reinforcementOffer: null };
      }
      return {
        ...state,
        knockoutBracket: bracket,
        missions: rotateMissionBoard(
          state.missions,
          localMissionSeed(state),
          missionCycleKey('knockout', state.leagueRound, bracket.currentRound, bracket.currentLeg),
        ),
      };
    }

    case 'FINISH_KNOCKOUT_MATCH': {
      // Both modes: the tie result is already computed by the engine and the
      // bracket advances via ADVANCE_KNOCKOUT (solo) / the host (online). Watching
      // a leg only returns to the bracket. The leg was marked watched on open.
      // Award shop points for the player's OWN leg (ida & volta) — but NOT the final (the season
      // is over after it, nothing left to spend on) and NOT while spectating someone else's tie.
      // Recruitment in the knockout is offered per stage in PLAY_KNOCKOUT_LEG. The client computes the points in
      // both modes to drive the post-match popup; SOLO also credits the balance here, while ONLINE
      // credits it server-side (play_knockout_round) to stay authoritative.
      const isFinal = state.knockoutBracket?.currentRound === 'final';
      let points = state.points;
      let popup: MatchPoints | null = null;
      let playerTeamAfterStreak = state.playerTeam;
      const knockoutRewardKey = state.activeKnockoutMatch?.matchId
        ? buildKnockoutMatchKey(
            state.activeKnockoutMatch.matchId,
            state.activeKnockoutMatch.leg ?? state.knockoutBracket?.currentLeg ?? 1,
          )
        : undefined;
      const pointsConfig = state.competitionFormat?.rewards ?? DEFAULT_REWARDS_CONFIG;
      if (!state.spectating && !isFinal && pointsConfig.pointsEnabled && pointsConfig.knockoutPointsEnabled && state.playerTeam && action.result &&
          (action.result.homeTeamId === state.playerTeam.id || action.result.awayTeamId === state.playerTeam.id)) {
        const mp = computeMatchPointsWithConfig(action.result, state.playerTeam.id, pointsConfig.points);
        const rewardVenue = state.knockoutBracket?.currentRound === 'final'
          ? 'neutral'
          : action.result.homeTeamId === state.playerTeam.id ? 'home' : 'away';
        // 🔥 Recuperação — extra credits scaled by the CURRENT losing streak, reset on win/draw.
        const priorLossStreak = state.playerTeam.lossStreak ?? 0;
        const streakBonusAmount = lossStreakBonus(mp.outcome, priorLossStreak);
        const updatedLossStreak = nextLossStreak(mp.outcome, priorLossStreak);
        playerTeamAfterStreak = { ...state.playerTeam, lossStreak: updatedLossStreak };
        const reward = calculateClubReward(
          mp.total,
          projectLevel(state.playerTeam.clubProjects, 'supporters'),
          rewardVenue,
          magnataPointMultiplier(state.playerTeam.players) > 1,
          streakBonusAmount,
          midiaticoCredits(state.playerTeam, action.result),
        );
        popup = {
          ...mp,
          matchKey: knockoutRewardKey,
          total: reward.total,
          baseTotal: reward.base,
          supportersBonus: reward.supportersBonus,
          supportersPercent: reward.supportersPercent,
          supportersVenue: reward.supportersVenue,
          magnataBonus: reward.magnataBonus,
          magnataPercent: reward.magnataPercent,
          midiaticoBonus: reward.midiaticoBonus,
          lossStreakBonus: reward.lossStreakBonus,
          lossStreakAfter: updatedLossStreak,
        };
        if (state.mode !== 'online') points += reward.total;
      }

      // 🎯 Palpite (mata-mata, SOLO): revela as pernas já jogadas que são seguras — o confronto
      // próprio recém-assistido E qualquer confronto alheio (placar já visível). (No online o
      // servidor credita no gate de "todos assistiram a perna".)
      let koBets = state.bets;
      if (state.mode !== 'online' && state.knockoutBracket) {
        const b = state.knockoutBracket as any;
        const koTies = [
          ...(b.playoffs ?? []), ...(b.round16 ?? []),
          ...b.quarterFinals, ...b.semiFinals, ...(b.final ? [b.final] : []),
        ];
        // Finishing the participant's own solo replay is itself proof that this
        // leg was watched.
        const watchedLegKeys = [...(state.watchedKnockoutMatches ?? [])];
        if (action.result) {
          const resultTeams = new Set([action.result.homeTeamId, action.result.awayTeamId]);
          const ownTie = koTies.find(t => resultTeams.has(t.homeTeamId) && resultTeams.has(t.awayTeamId));
          const ownLegKey = ownTie ? `${ownTie.id}_l${b.currentLeg ?? 1}` : null;
          if (ownLegKey && !watchedLegKeys.includes(ownLegKey)) watchedLegKeys.push(ownLegKey);
        }
        const bettingLevel = projectLevel(state.playerTeam?.clubProjects, 'betting');
        const revealed = revealEligibleKoBets(
          state.bets,
          koTies,
          state.playerTeam?.id ?? '',
          watchedLegKeys,
          bettingLossRefundPercent(bettingLevel),
        );
        if (playerTeamAfterStreak) playerTeamAfterStreak = applyApostadorWins(playerTeamAfterStreak, newlyWonBets(koBets, revealed.bets));
        koBets = revealed.bets;
        points += revealed.winnings;
      }

      let missions = state.missions ?? createMissionState('solo', 'L1');
      if (!state.spectating && state.mode !== 'online' && state.playerTeam && action.result && state.currentMatchTeams) {
        const missionHome = state.currentMatchTeams.find(team => team.id === action.result.homeTeamId);
        const missionAway = state.currentMatchTeams.find(team => team.id === action.result.awayTeamId);
        const missionTeam = action.result.homeTeamId === state.playerTeam.id ? missionHome : missionAway;
        const missionOpponent = action.result.homeTeamId === state.playerTeam.id ? missionAway : missionHome;
        const missionContext = missionTeam && missionOpponent
          ? createMissionMatchContext(missionTeam, missionOpponent, action.result)
          : null;
        if (missionContext) {
          const missionKey = knockoutRewardKey ?? buildKnockoutMatchKey(
            state.activeKnockoutMatch?.matchId ?? `${action.result.homeTeamId}-${action.result.awayTeamId}`,
            state.activeKnockoutMatch?.leg ?? state.knockoutBracket?.currentLeg ?? 1,
          );
          const missionUpdate = updateMissionsAfterMatch(
            missions,
            missionContext,
            missionKey,
            projectLevel(missionTeam?.clubProjects, 'missions'),
          );
          missions = missionUpdate.state;
          points += missionUpdate.reward;
          if (playerTeamAfterStreak) {
            playerTeamAfterStreak = applyMercenarioProgress(playerTeamAfterStreak, completedMissionCount(missions));
          }
        }
      }
      // Keep solo aligned with the server's per-leg mission cycles. The first
      // leg is evaluated against its own board above; only after that replay is
      // finished do we expose the board for the return leg. The second leg is
      // already on that cycle, so this is a no-op until ADVANCE_KNOCKOUT moves
      // the bracket to the next round.
      if (state.mode !== 'online' && state.knockoutBracket) {
        missions = rotateMissionBoard(
          missions,
          localMissionSeed(state),
          missionCycleKey(
            'knockout',
            state.leagueRound,
            state.knockoutBracket.currentRound,
            state.knockoutBracket.currentLeg,
          ),
        );
      }
      if (playerTeamAfterStreak) playerTeamAfterStreak = { ...playerTeamAfterStreak, credits: points };

      return {
        ...state,
        ...finishOnlineReplay(state),
        phase: 'knockout',
        spectating: false,
        activeKnockoutMatch: null,
        currentMatchTeams: null,
        currentMatchResult: null,
        missions,
        points,
        playerTeam: playerTeamAfterStreak,
        lastMatchPoints: popup ?? state.lastMatchPoints,
        bets: koBets,
      };
    }


    case 'DISMISS_MATCH_CREDITS':
      return { ...state, matchCreditsModalPending: false };


    case 'WATCH_ONLINE_MATCH': {
      // Open the match-sim screen in replay mode, driven by the authoritative
      // result already computed (identical on every device). Mark the round/leg as
      // watched immediately so it only auto-opens once.
      // A spectator watch never gates advancement, so it isn't recorded as "watched".
      const watchKey = action.spectator ? null : action.knockout
        ? (action.knockout.leg ? `${action.knockout.matchId}_l${action.knockout.leg}` : action.knockout.matchId)
        : null;
      return {
        ...state,
        phase: 'match_sim',
        spectating: !!action.spectator,
        currentMatchTeams: action.teams,
        currentMatchResult: action.result,
        matchCreditsModalPending: state.mode === 'online' && !action.spectator
          ? true
          : state.matchCreditsModalPending,
        activeKnockoutMatch: action.knockout
          ? { matchId: action.knockout.matchId, round: action.knockout.round, leg: action.knockout.leg, firstLeg: action.knockout.firstLeg }
          : null,
        onlineReplayKey: state.mode === 'online' && !action.spectator
          ? (watchKey ?? `L${state.leagueRound}`)
          : state.onlineReplayKey,
        lastWatchedRound: action.knockout
          ? state.lastWatchedRound
          : Math.max(state.lastWatchedRound, state.leagueRound),
        watchedKnockoutMatches: watchKey && !state.watchedKnockoutMatches.includes(watchKey)
          ? [...state.watchedKnockoutMatches, watchKey]
          : state.watchedKnockoutMatches,
      };
    }


    case 'FINISH_GAME':
      return { ...state, champion: action.champion, phase: 'report' };

    case 'FINISH_ELIMINATED_CAMPAIGN':
      return finishEliminatedSoloCampaign(state);

    case 'SET_ONLINE_STATE': {
      const { roomState, socketId } = action;
      const me = roomState.players.find((p: any) => p.socketId === socketId);
      
      let draftState: any = null;
      if (roomState.phase === 'draft' && roomState.draftState) {
        const activePlayerId = roomState.draftState.draftOrder[roomState.draftState.turnIndex];
        const activePlayer = roomState.players.find((p: any) => p.id === activePlayerId);
        if (activePlayer) {
          const isMyTurn = activePlayer.socketId === socketId;
          const currentOptions = isMyTurn 
            ? (roomState.draftState.currentOptionsByPlayer[activePlayerId] || [])
            : [];
          const needed = getNeededPositions(activePlayer.formationId, activePlayer.draftedPlayers);
          draftState = {
            round: roomState.draftState.round,
            timerKey: roomState.draftState.timerKey ?? roomState.draftState.turnIndex,
            totalRounds: 13,        // 11 titulares + 2 reservas (banco)
            currentOptions,
            selectedPlayers: [],
            vetoesLeft: activePlayer.vetoesLeft,
            formationId: activePlayer.formationId,
            coachId: activePlayer.coachId,
            neededPositions: needed,
          };
        }
      }

      let targetPhase = roomState.phase;
      if (roomState.phase === 'setup') {
        // Setup online = escolher ESCUDO → TÉCNICO → FORMAÇÃO. Mantém a sub-tela em que o jogador está;
        // senão começa no escudo (antes ia direto pro 'coach' e pulava a escolha de escudo).
        if (state.phase === 'crest' || state.phase === 'coach' || state.phase === 'formation') {
          targetPhase = state.phase;
        } else {
          targetPhase = 'crest';
        }
      } else if (state.phase === 'match_sim'
        && !!state.currentMatchResult
        && (roomState.phase === 'league' || roomState.phase === 'knockout')) {
        // Stay on the replay only while there is one to show; otherwise the
        // match screen would render nothing.
        targetPhase = 'match_sim';
      }
      // A room back in the lobby (restart) starts a new competition: every
      // replay marker from the previous one is stale.
      const replayBase = roomState.phase === 'lobby' ? { ...state, ...ONLINE_REPLAY_RESET } : state;
      const watchedLeagueRound = Number.isSafeInteger(roomState.watchedLeagueRound) ? roomState.watchedLeagueRound as number : null;
      const watchedKnockoutLegKey = roomState.watchedKnockoutLegKey
        && typeof roomState.watchedKnockoutLegKey.round === 'string'
        && (roomState.watchedKnockoutLegKey.leg === 1 || roomState.watchedKnockoutLegKey.leg === 2)
        ? { round: roomState.watchedKnockoutLegKey.round as string, leg: roomState.watchedKnockoutLegKey.leg as number }
        : null;

      // While the player is actively on a SELECTION screen (coach / formation / squad
      // review), their local picks aren't submitted yet — a room broadcast triggered by
      // ANOTHER player must NOT overwrite them with the server's stale/default values.
      // (This caused the coach reverting to Guardiola and post-draft picks "jumping".)
      // We only sync picks from the server when ENTERING the screen (phase changes).
      const keepLocalPicks = ['coach', 'formation', 'squad_review'].includes(targetPhase) && state.phase === targetPhase;
      const roomFixtures = Array.isArray(roomState.leagueFixtures) ? roomState.leagueFixtures : [];
      const roomLeagueResults = onlineLeagueResults(roomState, state.leagueFixtures, state.leagueResults);
      const roomMissionCycle = roomState.phase === 'knockout'
        ? missionCycleKey('knockout', roomState.leagueRound || 1, roomState.knockoutBracket?.currentRound, roomState.knockoutBracket?.currentLeg)
        : missionCycleKey('league', roomState.leagueRound || 1);
      const syncedMissions = me
        ? rotateMissionBoard(
            normalizeMissionState(me.missions, `${roomState.code}:${me.id}`, roomMissionCycle),
            `${roomState.code}:${me.id}`,
            roomMissionCycle,
          )
        : state.missions;
      const serverWatchedThisLeagueRound = roomState.phase === 'league'
        && !!me
        && watchedLeagueRound === (roomState.leagueRound || 1)
        && (roomState.watchedRoundPlayers || []).includes(me.id);
      let syncedWatchedKnockoutMatches = replayBase.watchedKnockoutMatches;
      if (roomState.phase === 'knockout'
        && me?.team
        && roomState.knockoutBracket
        && watchedKnockoutLegKey
        && watchedKnockoutLegKey.round === roomState.knockoutBracket.currentRound
        && (roomState.watchedKnockoutLegPlayers || []).includes(me.id)) {
        const activeTies = getActiveKnockoutMatches(roomState.knockoutBracket) as any[];
        const myTie = activeTies.find(tie => tie.homeTeamId === me.team.id
          || tie.awayTeamId === me.team.id
          || tie.homeTeamId === me.id
          || tie.awayTeamId === me.id);
        if (myTie) {
          const watchedKey = myTie.isSingleLeg === true ? myTie.id : `${myTie.id}_l${watchedKnockoutLegKey.leg}`;
          syncedWatchedKnockoutMatches = syncedWatchedKnockoutMatches.includes(watchedKey)
            ? syncedWatchedKnockoutMatches
            : [...syncedWatchedKnockoutMatches, watchedKey];
        }
      }

      return {
        ...state,
        mode: 'online',
        roomCode: roomState.code,
        phase: targetPhase,
        difficulty: roomState.difficulty,
        competitionFormat: normalizeCompetitionFormat(roomState.competitionFormat),
        botTeams: roomState.botTeams || [],
        leagueFixtures: roomFixtures,
        leagueStandings: roomState.leagueStandings || [],
        leagueResults: roomLeagueResults,
        onlineSeasonPlayerStats: roomState.seasonPlayerStats ?? {},
        leagueRound: roomState.leagueRound || 1,
        knockoutBracket: roomState.knockoutBracket || null,
        champion: roomState.champion || null,
        onlinePlayers: roomState.players || [],
        onlineHostId: typeof roomState.hostId === 'string' ? roomState.hostId : null,
        draftOrder: roomState.draftState?.draftOrder || [],
        draftTurnIndex: roomState.draftState?.turnIndex || 0,
        draftHistory: roomState.draftState?.history || [],
        onlineWatchedPlayers: roomState.phase === 'league'
          ? (roomState.watchedRoundPlayers || [])
          : (roomState.watchedKnockoutLegPlayers || []),
        onlineWatchedLeagueRound: watchedLeagueRound,
        onlineWatchedKnockoutLegKey: watchedKnockoutLegKey,
        onlineReplayKey: replayBase.onlineReplayKey,
        onlineFinishedReplays: replayBase.onlineFinishedReplays,
        currentMatchTeams: replayBase.currentMatchTeams,
        currentMatchResult: replayBase.currentMatchResult,
        activeKnockoutMatch: replayBase.activeKnockoutMatch,
        spectating: replayBase.spectating,
        matchCreditsModalPending: replayBase.matchCreditsModalPending,
        onlineReadyPlayers: roomState.readyPlayers || [],
        onlineMarket: roomState.market || [],
        onlineTradeSessions: roomState.trades || [],

        // Local player sync
        playerName: me ? me.name : state.playerName,
        playerTeam: me ? me.team : state.playerTeam,
        // Shop points + end-of-round reinforcement are server-authoritative online → mirror the
        // local player's balance, last-match summary and pending reinforcement offer.
        points: me ? (me.points ?? 0) : state.points,
        lastMatchPoints: me ? (me.lastMatchPoints ?? null) : state.lastMatchPoints,
        reinforcementOptions: me ? (me.reinforcementOptions ?? null) : state.reinforcementOptions,
        reinforcementOffer: me ? (me.reinforcementOffer ?? null) : state.reinforcementOffer,
        reinforcementEventCount: me ? (me.reinforcementEventCount ?? state.reinforcementEventCount) : state.reinforcementEventCount,
        pendingPack: me ? (me.pendingPack ?? null) : state.pendingPack,
        pendingPackReveal: me ? (me.pendingPackReveal ?? null) : state.pendingPackReveal,
        pendingUniquePack: me ? (me.pendingUniquePack ?? null) : state.pendingUniquePack,
        uniquePackOfferIds: me ? (me.uniquePackOfferIds ?? []) : state.uniquePackOfferIds,
        uniquePackOfferRoundKey: me ? (me.uniquePackOfferRoundKey ?? null) : state.uniquePackOfferRoundKey,
        playerPackOfferIds: me ? (me.playerPackOfferIds ?? {}) : state.playerPackOfferIds,
        playerPackOfferRoundKeys: me ? (me.playerPackOfferRoundKeys ?? {}) : state.playerPackOfferRoundKeys,
        bets: me ? (me.bets ?? []) : state.bets,
        discipline: roomState.discipline ?? state.discipline,
        medicalFreeTreatmentsUsed: me
          ? (me.medicalFreeTreatmentsUsed ?? state.medicalFreeTreatmentsUsed)
          : state.medicalFreeTreatmentsUsed,
        missions: syncedMissions,
        // A disconnect/leave is a terminal reveal for the current replay
        // window. Mirror the server marker so reconnecting does not reopen a
        // replay that was already released and credited.
        lastWatchedRound: serverWatchedThisLeagueRound
          ? Math.max(replayBase.lastWatchedRound, roomState.leagueRound || 1)
          : replayBase.lastWatchedRound,
        watchedKnockoutMatches: syncedWatchedKnockoutMatches,
        draftedPlayers: keepLocalPicks ? state.draftedPlayers : (me ? me.draftedPlayers : state.draftedPlayers),
        selectedCrestId: keepLocalPicks ? state.selectedCrestId : (me ? (me.crestId ?? state.selectedCrestId) : state.selectedCrestId),
        selectedCoachId: keepLocalPicks ? state.selectedCoachId : (me ? me.coachId : state.selectedCoachId),
        selectedFormationId: keepLocalPicks ? state.selectedFormationId : (me ? me.formationId : state.selectedFormationId),
        selectedPlayStyle: keepLocalPicks ? state.selectedPlayStyle : (me ? (me.playStyle ?? 'balanced') : state.selectedPlayStyle),
        selectedMatchPlan: keepLocalPicks
          ? state.selectedMatchPlan
          : normalizeMatchPlan(me?.matchPlan ?? state.selectedMatchPlan),
        captain: keepLocalPicks ? state.captain : (me ? me.captain : state.captain),
        penaltyTaker: keepLocalPicks ? state.penaltyTaker : (me ? me.penaltyTaker : state.penaltyTaker),
        freeKickTaker: keepLocalPicks ? state.freeKickTaker : (me ? me.freeKickTaker : state.freeKickTaker),
        // Host can transfer if the creator drops — derive from the server's hostId.
        isHost: me ? me.id === roomState.hostId : state.isHost,
        // Surfaced when the host tries to advance before everyone has watched.
        advanceBlocked: null,
        draftState,

        // Generate local report if transitioning to report phase
        report: (roomState.phase === 'report' && roomState.champion && !state.report)
          ? (() => {
              const myTeam = me ? me.team : state.playerTeam;
              const allHumanTeams = (roomState.players || []).filter((p: any) => p.team).map((p: any) => p.team);
              const allTeamsList = [...allHumanTeams, ...(roomState.botTeams || [])];
              const championTeam = allTeamsList.find((t: any) => t.id === roomState.champion);
              // Aggregate every played match (league + knockout) for accurate stats.
              const allResults = getAllPlayedMatchResults(roomLeagueResults, roomState.knockoutBracket || null);
              return myTeam
                ? generateImmortalReport(myTeam, allResults, championTeam?.name ?? 'Campeão')
                : state.report;
            })()
          : state.report,
      };
    }

    case 'INIT_ONLINE':
      return {
        ...state,
        ...(state.mode !== 'online' || state.roomCode !== action.roomCode ? ONLINE_REPLAY_RESET : {}),
        mode: 'online',
        onlineSetupIntent: null,
        socketId: action.socketId,
        roomCode: action.roomCode,
        isHost: action.isHost,
      };

    case 'SET_ONLINE_READY_PLAYERS':
      return { ...state, onlineReadyPlayers: action.readyPlayers };

    case 'SET_ONLINE_TRADE_STATE':
      return {
        ...state,
        onlineTradeSessions: action.trades,
        onlineReadyPlayers: action.readyPlayers,
      };

    case 'SET_ADVANCE_BLOCKED':
      return { ...state, advanceBlocked: action.waiting };

    case 'DISCONNECT_ONLINE':
      return {
        ...initialState,
      };

    case 'RESET_GAME':
      return { ...initialState };

    case 'RESTORE_SOLO_CAMPAIGN':
      // A saved solo campaign never carries an online session.
      return { ...initialState, ...action.state, mode: 'solo', roomCode: null, socketId: null, isHost: false, onlinePlayers: [] };

    default:
      return state;
  }
}
