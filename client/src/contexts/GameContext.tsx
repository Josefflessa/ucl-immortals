// UCL Immortals — Game Context
// Central state management for the entire game session

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import {
  Player, Coach, Formation, COACHES, FORMATIONS, PLAYERS,
  DIFFICULTY_LEVELS,
} from '../lib/gameData';
import {
  Team, PlayerCard, MatchResult, StandingsEntry, DraftState, ImmortalReport,
  calculateChemistry, generateDraftOptions, getNeededPositions, magnataPointMultiplier,
  generateBotTeam, simulateLeague, simulateMatch, generateImmortalReport,
  LeagueFixture, generateRandomLeagueFixtures, computeStandings, rebuildTeamChemistry,
  generateRandomGroupFixtures, computeGroupQualifiedStandings,
  getAllPlayedMatchResults, createKnockoutBracket,
  generateUniquePackCard,
  normalizeMatchPlan,
  draftSlotIndex,
  advanceKnockoutBracket, playActiveKnockoutLeg, getActiveKnockoutMatches, applyShopVariant, hasVariant, canAddVariant, stripVariant, stripSpecificVariant,
  bumpStarterAppearances, isEvolved, applyEvolvePoint, applyDefeatGrowth, applyDefeatGrowthForResults,
} from '../lib/gameEngine';
import type { MatchPlan, VariantFlag } from '../lib/gameEngine';
import type { AttrKey } from '../lib/traits';
import { computeMatchPointsWithConfig, MatchPoints, SHOP_COSTS, trainCost, TRAIN_BOOST, ShopVariant, TrainAttr, sellValue, canEvolvePrime, PRIME_COST } from '../lib/shop';
import { Bet, BetBuilderSelection, BetMarket, buildLeagueMatchKey, canPlaceStake, betCapPrefix, createBet, revealEligibleKoBets, settleBet, BET_ROUND_CAP } from '../lib/bets';
import { DisciplineMap, applyMatchDiscipline, resolveAvailableLineup, resetYellowsForKnockout, healInjury, applyEmergencyReplacement } from '../lib/discipline';
import { PHYSIO_COST } from '../lib/discipline';
import { MarketListing } from '../lib/market';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem, getClientId } from '../lib/storage';
import { DEFAULT_COMPETITION_FORMAT, DEFAULT_REWARDS_CONFIG, normalizeCompetitionFormat, type CompetitionFormat, validateCompetitionFormat } from '../lib/competition';
import { applyRoomPatch, type RoomPatchOperation } from '../../../shared/room-sync';
import { DurableRealtimeSocket, type RealtimeClientSocket } from '../lib/realtimeSocket';
import { toast } from 'sonner';

// ============================================================
// GAME PHASES
// ============================================================
export type GamePhase =
  | 'menu'           // Home screen
  | 'album'          // Player album / catalog
  | 'lobby'          // Multiplayer lobby
  | 'format'         // Choose the tournament format
  | 'setup'          // Choose name, difficulty
  | 'crest'          // Choose club crest
  | 'coach'          // Choose coach
  | 'formation'      // Choose formation
  | 'draft'          // Draft players
  | 'squad_review'   // Review squad, set captain
  | 'league'         // League phase
  | 'knockout'       // Knockout phase
  | 'match_sim'      // Watching a match simulation
  | 'report';        // Final immortal report


// ============================================================
// STATE
// ============================================================
export interface RoomPlayer {
  socketId: string;
  connected?: boolean; // sincronizado do servidor; ausente em estados locais antigos
  id: string; // e.g. "player_0"
  name: string;
  crestId?: string | null; // selected club crest
  coachId: string;
  formationId: string;
  matchPlan?: MatchPlan;
  draftedPlayers: (Player | undefined)[];
  vetoesLeft: number;
  captain: string | null;
  penaltyTaker: string | null;
  freeKickTaker: string | null;
  team: Team | null;
  ready: boolean;
}

export interface GameState {
  phase: GamePhase;
  playerName: string;
  difficulty: string;
  competitionFormat: CompetitionFormat;
  playerTeam: Team | null;
  botTeams: Team[];
  draftState: DraftState | null;
  leagueStandings: StandingsEntry[];
  leagueResults: MatchResult[];
  leagueRound: number;
  leagueFixtures: LeagueFixture[];
  knockoutBracket: KnockoutBracket | null;
  activeKnockoutMatch: { matchId: string; round: string; leg?: number; firstLeg?: { home: number; away: number } } | null;
  currentMatch: MatchResult | null;
  currentMatchTeams: [Team, Team] | null;
  // Online: authoritative result (from server) being watched as a replay
  currentMatchResult: MatchResult | null;
  report: ImmortalReport | null;
  champion: string | null;
  draftedPlayers: (Player | undefined)[];
  selectedCrestId: string | null;
  selectedCoachId: string;
  selectedFormationId: string;
  selectedPlayStyle: string;
  selectedMatchPlan: MatchPlan;
  captain: string | null;
  penaltyTaker: string | null;
  freeKickTaker: string | null;
  // End-of-round reinforcement (solo league): 6 random players, pick 1 → joins the bench.
  reinforcementOptions: Player[] | null;
  // Shop economy (solo league): points earned per match, spent in the LOJA tab.
  points: number;
  lastMatchPoints: MatchPoints | null; // shown once after a LEAGUE match (in the reinforcement modal)
  knockoutPointsPopup: MatchPoints | null; // transient "+X pontos" popup after a KNOCKOUT leg (no reinforcement there)
  reinforcementRerolls: number; // 🔄 re-roll tokens for the reinforcement pick (persist across rounds)
  // 🛒 Pacote da loja JÁ PAGO na abertura (Pacote do Craque / Caça-Talentos): fica guardado até você
  // escolher 1 → impede re-sortear de graça abrindo/fechando o modal. A escolha em si é grátis.
  pendingPack: { kind: 'star' | 'scout'; options: Player[] } | null;
  // ⭐ Pacote Único já pago: carta sorteada, aguardando a animação/revelação.
  pendingUniquePack: Player | null;
  // 🎯 Palpites (apostas de pontos). Escrow já debitado ao apostar; crédito só na revelação.
  bets: Bet[];
  // 🟨🟥🩹 Disciplina & lesões — disponibilidade por jogador (todos os times), carrega entre jogos.
  discipline: DisciplineMap;

  // Online Multiplayer fields
  onlineSetupIntent: 'create' | null;
  mode: 'solo' | 'online';
  roomCode: string | null;
  socketId: string | null;
  onlinePlayers: RoomPlayer[];
  isHost: boolean;
  draftOrder: string[];
  draftTurnIndex: number;
  draftHistory: any[];
  alreadyDraftedIds: string[];
  // Online sync: which league round / knockout matches the local player has
  // already watched, so we only auto-open each replay once.
  lastWatchedRound: number;
  watchedKnockoutMatches: string[];
  // True while watching SOMEONE ELSE'S tie as a spectator (eliminated player). Such a
  // watch must not notify the server's advance-gate (the spectator isn't a participant).
  spectating: boolean;
  // IDs of players who have confirmed watching the current round/leg (from server)
  onlineWatchedPlayers: string[];
  onlineReadyPlayers: string[]; // ✅ jogadores que apertaram "Estou pronto" p/ a rodada/perna atual
  onlineMarket: MarketListing[]; // 🏪 anúncios do mercado online (compartilhado pela sala)
  // Names the host is still waiting on before advancing (from the server's
  // advance_blocked event); null when not blocked.
  advanceBlocked: string[] | null;
}

export interface KnockoutBracket {
  playoffs: KnockoutMatch[];
  round16: KnockoutMatch[];
  quarterFinals: KnockoutMatch[];
  semiFinals: KnockoutMatch[];
  final: KnockoutMatch | null;
  currentRound: 'playoffs' | 'round16' | 'quarters' | 'semis' | 'final';
  currentLeg: number; // 1 = ida, 2 = volta
  firstRoundSize?: number;
  knockoutLegs?: 1 | 2;
}

export interface KnockoutMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  result?: MatchResult;   // two-legged: aggregate (winner/aggregate score); single: the match
  leg1?: MatchResult;     // first leg (two-legged ties)
  leg2?: MatchResult;     // second leg (two-legged ties)
  isSingleLeg?: boolean;  // the grand final is a single match
  played: boolean;
  homeSeed?: number;      // lower seed = better league-phase campaign
  awaySeed?: number;
  homeFromPo?: number;    // R16 only: index into playoffs whose winner fills homeTeamId
  awayFromPo?: number;    // R16 only: index into playoffs whose winner fills awayTeamId
}

// ============================================================
// ACTIONS
// ============================================================
export type GameAction =
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'SET_CREST'; crestId: string | null }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'SET_ONLINE_SETUP_INTENT'; intent: 'create' | null }
  | { type: 'SET_DIFFICULTY'; difficulty: string }
  | { type: 'SET_COMPETITION_FORMAT'; format: CompetitionFormat }
  | { type: 'SET_COACH'; coachId: string }
  | { type: 'SET_FORMATION'; formationId: string }
  | { type: 'SET_PLAY_STYLE'; playStyle: string }
  | { type: 'SET_MATCH_PLAN'; plan: MatchPlan }
  | { type: 'SET_PLAYER_TEAM_PLAY_STYLE'; playStyle: string }
  | { type: 'SET_PLAYER_TEAM_MATCH_PLAN'; plan: MatchPlan }
  | { type: 'START_DRAFT' }
  | { type: 'DRAFT_PLAYER'; player: Player }
  | { type: 'VETO_DRAFT' }
  | { type: 'FINISH_DRAFT' }
  | { type: 'SET_CAPTAIN'; playerId: string }
  | { type: 'SET_PENALTY_TAKER'; playerId: string }
  | { type: 'SET_FREE_KICK_TAKER'; playerId: string }
  | { type: 'SWAP_PLAYERS'; indexA: number; indexB: number }
  | { type: 'SWAP_PLAYER_TEAM'; indexA: number; indexB: number }
  | { type: 'SET_PLAYER_TEAM_CAPTAIN'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_MARTIR_TARGETS'; playerId: string; targetIds: string[] }
  | { type: 'SET_PLAYER_TEAM_PENALTY_TAKER'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_FREE_KICK_TAKER'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_FORMATION'; formationId: string }
  | { type: 'PICK_REINFORCEMENT'; player: Player }
  | { type: 'DISMISS_REINFORCEMENT' }
  | { type: 'SHOP_CHANGE_COACH'; coachId: string }
  | { type: 'EVOLVE_COACH_PRIME' }
  | { type: 'SET_EVOLVE_POINT'; playerId: string; attr: AttrKey; delta: number }
  | { type: 'RESET_EVOLVE_POINTS'; playerId: string }
  | { type: 'SHOP_OPEN_UNIQUE_PACK' } // cobra 750 e sorteia uma Única ainda não possuída
  | { type: 'SHOP_CLAIM_UNIQUE_PACK' } // adiciona a carta revelada ao banco, sem nova cobrança
  | { type: 'SHOP_OPEN_PACK'; kind: 'star' | 'scout'; options: Player[] } // COBRA ao abrir; guarda as opções
  | { type: 'SHOP_PICK_PACK'; player: Player } // escolhe 1 do pacote já pago (grátis) → banco
  | { type: 'SHOP_TURBINAR'; playerId: string; variant: ShopVariant }
  | { type: 'SHOP_REMOVE_VARIANT'; playerId: string; variantKey?: VariantFlag }
  | { type: 'SHOP_TRAIN'; playerId: string; attr: TrainAttr }
  | { type: 'SHOP_BUY_REROLL' }
  | { type: 'REROLL_REINFORCEMENT' }
  | { type: 'PLACE_BET'; matchKey: string; homeTeamId?: string; awayTeamId?: string; homeGoals?: number; awayGoals?: number; stake: number; market?: BetMarket; selections?: BetBuilderSelection[] }
  | { type: 'CANCEL_BET'; matchKey: string }
  | { type: 'HEAL_INJURY'; playerId: string }
  | { type: 'EMERGENCY_REPLACE_PLAYER'; starterId: string; player: Player }
  | { type: 'SELL_PLAYER'; playerId: string }
  | { type: 'START_LEAGUE' }
  | { type: 'SIMULATE_LEAGUE' }
  | { type: 'START_KNOCKOUT' }
  | { type: 'PLAY_LEAGUE_MATCH'; homeTeamId: string; awayTeamId: string }
  | { type: 'FINISH_LEAGUE_MATCH'; result: MatchResult }
  | { type: 'SIMULATE_BOT_MATCHES' }
  | { type: 'ADVANCE_LEAGUE_ROUND' }
  | { type: 'PLAY_KNOCKOUT_LEG' }
  | { type: 'ADVANCE_KNOCKOUT' }
  | { type: 'FINISH_KNOCKOUT_MATCH'; result: MatchResult }
  | { type: 'DISMISS_KO_POINTS' }
  | { type: 'SET_CURRENT_MATCH'; result: MatchResult; teams: [Team, Team] }
  | { type: 'WATCH_ONLINE_MATCH'; teams: [Team, Team]; result: MatchResult; knockout?: { matchId: string; round: string; leg?: number; firstLeg?: { home: number; away: number } }; spectator?: boolean }
  | { type: 'CLEAR_CURRENT_MATCH' }
  | { type: 'FINISH_GAME'; champion: string }
  | { type: 'RESET_GAME' }
  | { type: 'SET_ONLINE_STATE'; roomState: any; socketId: string }
  | { type: 'SET_ONLINE_READY_PLAYERS'; readyPlayers: string[] }
  | { type: 'INIT_ONLINE'; socketId: string; roomCode: string; isHost: boolean }
  | { type: 'SET_ADVANCE_BLOCKED'; waiting: string[] | null }
  | { type: 'DISCONNECT_ONLINE' };

// ============================================================
// INITIAL STATE
// ============================================================
const initialState: GameState = {
  phase: 'menu',
  playerName: '',
  difficulty: 'gold',
  competitionFormat: { ...DEFAULT_COMPETITION_FORMAT },
  playerTeam: null,
  botTeams: [],
  draftState: null,
  leagueStandings: [],
  leagueResults: [],
  leagueRound: 1,
  leagueFixtures: [],
  knockoutBracket: null,
  activeKnockoutMatch: null,
  currentMatch: null,
  currentMatchTeams: null,
  currentMatchResult: null,
  report: null,
  champion: null,
  draftedPlayers: [],
  selectedCrestId: null,
  selectedCoachId: 'guardiola',
  selectedFormationId: '4-3-3',
  selectedPlayStyle: 'balanced',
  selectedMatchPlan: normalizeMatchPlan(),
  captain: null,
  penaltyTaker: null,
  freeKickTaker: null,
  reinforcementOptions: null,
  points: 0,
  lastMatchPoints: null,
  knockoutPointsPopup: null,
  reinforcementRerolls: 0,
  pendingPack: null,
  pendingUniquePack: null,
  bets: [],
  discipline: {},

  // Online Multiplayer fields
  onlineSetupIntent: null,
  mode: 'solo',
  roomCode: null,
  socketId: null,
  onlinePlayers: [],
  isHost: false,
  draftOrder: [],
  draftTurnIndex: 0,
  draftHistory: [],
  alreadyDraftedIds: [],
  lastWatchedRound: 0,
  watchedKnockoutMatches: [],
  spectating: false,
  onlineWatchedPlayers: [],
  onlineReadyPlayers: [],
  onlineMarket: [],
  advanceBlocked: null,
};

// ============================================================
// REDUCER
// ============================================================
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

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
      if (!state.playerTeam) return state;
      return { ...state, playerTeam: { ...state.playerTeam, playStyle: action.playStyle } };

    case 'SET_PLAYER_TEAM_MATCH_PLAN':
      if (!state.playerTeam) return state;
      return { ...state, playerTeam: { ...state.playerTeam, matchPlan: normalizeMatchPlan(action.plan) } };

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

    case 'FINISH_DRAFT': {
      return { ...state, phase: 'squad_review' };
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

    case 'SWAP_PLAYER_TEAM': {
      if (!state.playerTeam) return state;
      const newPlayers = [...state.playerTeam.players];
      const temp = newPlayers[action.indexA];
      newPlayers[action.indexA] = newPlayers[action.indexB];
      newPlayers[action.indexB] = temp;

      let captain = state.playerTeam.captain;
      let penaltyTaker = state.playerTeam.penaltyTaker;
      let freeKickTaker = state.playerTeam.freeKickTaker;
      const starters = newPlayers.slice(0, 11);
      if (captain && !starters.some(p => p.id === captain)) captain = undefined;
      if (penaltyTaker && !starters.some(p => p.id === penaltyTaker)) penaltyTaker = undefined;
      if (freeKickTaker && !starters.some(p => p.id === freeKickTaker)) freeKickTaker = undefined;

      const updatedTeam = rebuildTeamChemistry({
        ...state.playerTeam,
        players: newPlayers,
        captain,
        penaltyTaker,
        freeKickTaker,
      });

      return { ...state, playerTeam: updatedTeam };
    }

    case 'SET_PLAYER_TEAM_CAPTAIN':
      if (!state.playerTeam) return state;
      return {
        ...state,
        playerTeam: { ...state.playerTeam, captain: action.playerId },
      };

    case 'SET_PLAYER_TEAM_MARTIR_TARGETS': {
      if (!state.playerTeam) return state;
      // Which 2 XI teammates a Mártir sacrifices for (the +3 recipients).
      const players = state.playerTeam.players.map(p =>
        p.id === action.playerId ? { ...p, martirTargets: action.targetIds } : p);
      return { ...state, playerTeam: { ...state.playerTeam, players } };
    }

    case 'SET_PLAYER_TEAM_PENALTY_TAKER':
      if (!state.playerTeam) return state;
      return {
        ...state,
        playerTeam: { ...state.playerTeam, penaltyTaker: action.playerId },
      };

    case 'SET_PLAYER_TEAM_FREE_KICK_TAKER':
      if (!state.playerTeam) return state;
      return {
        ...state,
        playerTeam: { ...state.playerTeam, freeKickTaker: action.playerId },
      };

    case 'SET_PLAYER_TEAM_FORMATION':
      if (!state.playerTeam) return state;
      // Changing the shape re-maps player roles → recompute chemistry / out-of-position.
      return {
        ...state,
        playerTeam: rebuildTeamChemistry({ ...state.playerTeam, formationId: action.formationId }),
      };

    case 'PICK_REINFORCEMENT': {
      if (!state.playerTeam) return { ...state, reinforcementOptions: null };
      // 🛡️ Anti-duplo-clique: só pega se ainda há oferta ativa, se o escolhido é uma das opções
      // atuais e se ainda não está no elenco. Um 2º clique rápido cai aqui com options=null → no-op.
      const valid = !!state.reinforcementOptions
        && state.reinforcementOptions.some(o => o.id === action.player.id)
        && !state.playerTeam.players.some(p => p.id === action.player.id);
      if (!valid) return { ...state, reinforcementOptions: null };
      // The reinforcement joins the BENCH (index 11+). The XI is untouched, so chemistry
      // stays the same until the manager substitutes him in via the MEU TIME screen.
      const card: PlayerCard = { ...action.player, chemistryScore: 0, isOOP: false };
      return {
        ...state,
        playerTeam: { ...state.playerTeam, players: [...state.playerTeam.players, card] },
        reinforcementOptions: null,
      };
    }

    case 'DISMISS_REINFORCEMENT':
      return { ...state, reinforcementOptions: null };

    // ── SHOP (solo league) ──────────────────────────────────────────────
    case 'SHOP_CHANGE_COACH': {
      if (!state.playerTeam) return state;
      const cost = SHOP_COSTS.changeCoach;
      if (state.points < cost || state.playerTeam.coachId === action.coachId) return state;
      // Coach drives chemistry links + buffs → recompute the team.
      return {
        ...state,
        points: state.points - cost,
        playerTeam: rebuildTeamChemistry({ ...state.playerTeam, coachId: action.coachId }),
      };
    }

    case 'SET_EVOLVE_POINT': {
      if (!state.playerTeam) return state;
      const players = state.playerTeam.players.map(p => {
        if (p.id !== action.playerId || !isEvolved(p)) return p;
        return { ...p, evolvePoints: applyEvolvePoint(p.evolvePoints ?? {}, action.attr, action.delta) };
      });
      return { ...state, playerTeam: { ...state.playerTeam, players } };
    }
    case 'RESET_EVOLVE_POINTS': {
      if (!state.playerTeam) return state;
      const players = state.playerTeam.players.map(p => p.id === action.playerId ? { ...p, evolvePoints: {} } : p);
      return { ...state, playerTeam: { ...state.playerTeam, players } };
    }

    case 'EVOLVE_COACH_PRIME': {
      if (!state.playerTeam || state.playerTeam.coachPrime) return state;
      const wins = state.leagueStandings.find(s => s.teamId === state.playerTeam!.id)?.won ?? 0;
      if (!canEvolvePrime(wins, state.points)) return state;
      return {
        ...state,
        points: state.points - PRIME_COST,
        playerTeam: { ...state.playerTeam, coachPrime: true },
      };
    }

    case 'SHOP_OPEN_UNIQUE_PACK': {
      // A cobrança acontece na abertura e o resultado fica pendente até o usuário
      // concluir a animação. Isso impede fechar/reabrir para sortear outra carta.
      if (!state.playerTeam || state.pendingUniquePack || state.pendingPack) return state;
      const cost = SHOP_COSTS.uniqueCard;
      if (state.points < cost) return state;
      const card = generateUniquePackCard(state.playerTeam.players.map(player => player.id));
      if (!card) return state;
      return {
        ...state,
        points: state.points - cost,
        pendingUniquePack: card,
      };
    }

    case 'SHOP_CLAIM_UNIQUE_PACK': {
      if (!state.playerTeam || !state.pendingUniquePack) return state;
      const pending = state.pendingUniquePack;
      // A carta fica no estado enquanto a animação toca; nunca aceitamos um
      // novo payload vindo da UI e ainda protegemos contra duplicatas.
      if (state.playerTeam.players.some(player => player.id === pending.id)) {
        return { ...state, pendingUniquePack: null };
      }
      const card: PlayerCard = { ...pending, chemistryScore: 0, isOOP: false };
      return {
        ...state,
        pendingUniquePack: null,
        playerTeam: { ...state.playerTeam, players: [...state.playerTeam.players, card] },
      };
    }

    case 'SHOP_OPEN_PACK': {
      // COBRA ao abrir o pacote (impede re-sortear de graça). Guarda as opções até a escolha.
      if (!state.playerTeam || state.pendingPack) return state; // um pacote pendente por vez
      const cost = action.kind === 'star' ? SHOP_COSTS.starPack : SHOP_COSTS.scout;
      if (state.points < cost) return state;
      return { ...state, points: state.points - cost, pendingPack: { kind: action.kind, options: action.options } };
    }

    case 'SHOP_PICK_PACK': {
      // Escolhe 1 do pacote JÁ PAGO (sem cobrar de novo) → banco, e limpa o pacote.
      if (!state.playerTeam || !state.pendingPack) return state;
      const chosen = action.player;
      const valid = state.pendingPack.options.some(o => o.id === chosen.id)
        && !state.playerTeam.players.some(p => p.id === chosen.id);
      if (!valid) return { ...state, pendingPack: null };
      const card: PlayerCard = { ...chosen, chemistryScore: 0, isOOP: false };
      return { ...state, pendingPack: null, playerTeam: { ...state.playerTeam, players: [...state.playerTeam.players, card] } };
    }

    case 'SHOP_TURBINAR': {
      if (!state.playerTeam) return state;
      const cost = SHOP_COSTS.turbinar;
      const target = state.playerTeam.players.find(p => p.id === action.playerId);
      if (!target || state.points < cost) return state;
      // Uma característica por carta (Únicas: até duas) — recusa se já atingiu o limite.
      if (!canAddVariant(target)) return state;
      const newPlayers = state.playerTeam.players.map(p =>
        p.id === action.playerId ? ({ ...applyShopVariant(p, action.variant) } as PlayerCard) : p);
      return {
        ...state,
        points: state.points - cost,
        playerTeam: rebuildTeamChemistry({ ...state.playerTeam, players: newPlayers }),
      };
    }

    case 'SHOP_REMOVE_VARIANT': {
      if (!state.playerTeam) return state;
      const cost = SHOP_COSTS.removeVariant;
      const target = state.playerTeam.players.find(p => p.id === action.playerId);
      // Only meaningful (and only charged) if the card actually HAS a characteristic.
      if (!target || state.points < cost || !hasVariant(target)) return state;
      const newPlayers = state.playerTeam.players.map(p =>
        p.id === action.playerId ? (action.variantKey ? stripSpecificVariant(p, action.variantKey) : stripVariant(p)) : p);
      return {
        ...state,
        points: state.points - cost,
        playerTeam: rebuildTeamChemistry({ ...state.playerTeam, players: newPlayers }),
      };
    }

    case 'SHOP_TRAIN': {
      if (!state.playerTeam) return state;
      const target = state.playerTeam.players.find(p => p.id === action.playerId);
      if (!target) return state;
      const cost = trainCost(target.trainCount ?? 0);
      if (state.points < cost) return state;
      const newPlayers = state.playerTeam.players.map(p => {
        if (p.id !== action.playerId) return p;
        const boosts = { ...(p.trainBoosts ?? {}) };
        boosts[action.attr] = (boosts[action.attr] ?? 0) + TRAIN_BOOST;
        return { ...p, trainBoosts: boosts, trainCount: (p.trainCount ?? 0) + 1 };
      });
      return {
        ...state,
        points: state.points - cost,
        playerTeam: { ...state.playerTeam, players: newPlayers },
      };
    }

    case 'SHOP_BUY_REROLL': {
      if (state.points < SHOP_COSTS.reroll) return state;
      return { ...state, points: state.points - SHOP_COSTS.reroll, reinforcementRerolls: state.reinforcementRerolls + 1 };
    }

    case 'REROLL_REINFORCEMENT': {
      // Re-sortear as opções de reforço, consumindo 1 token. Só faz sentido com o modal aberto.
      if (state.reinforcementRerolls <= 0 || !state.playerTeam || !state.reinforcementOptions) return state;
      const ownedIds = state.playerTeam.players.map(p => p.id);
      return {
        ...state,
        reinforcementRerolls: state.reinforcementRerolls - 1,
        reinforcementOptions: generateDraftOptions([], ownedIds).slice(0, state.competitionFormat?.rewards?.reinforcementOptions ?? DEFAULT_REWARDS_CONFIG.reinforcementOptions),
      };
    }

    case 'PLACE_BET': {
      // 🎯 Aposta (escrow): debita o stake AGORA. Editar o mesmo jogo ajusta pela diferença.
      if (!state.playerTeam || action.stake <= 0) return state;
      // Teto por rodada de liga (Lr:) ou POR PARTIDA no mata-mata (o próprio matchKey) —
      // igual o servidor. Antes usava 'K' genérico, que somava TODOS os jogos do KO num
      // teto só (aposta na 2ª partida sumia calada depois de 200 no total).
      const prefix = betCapPrefix(action.matchKey, state.leagueRound);
      const existing = state.bets.find(b => b.matchKey === action.matchKey);
      const escrowDelta = action.stake - (existing?.stake ?? 0); // >0 debita mais, <0 devolve
      if (escrowDelta > state.points) return state;               // saldo insuficiente
      const betCap = state.competitionFormat?.matchSettings?.betRoundCap ?? BET_ROUND_CAP;
      if (!canPlaceStake(state.bets, prefix, action.matchKey, action.stake, betCap)) return state; // teto da rodada
      if (existing?.settled) return state;
      const bet = createBet({
        matchKey: action.matchKey,
        homeTeamId: action.homeTeamId,
        awayTeamId: action.awayTeamId,
        homeGoals: action.homeGoals,
        awayGoals: action.awayGoals,
        stake: action.stake,
        market: action.market,
        selections: action.selections,
      });
      if (!bet) return state;
      const bets = existing
        ? state.bets.map(b => b.matchKey === action.matchKey ? bet : b)
        : [...state.bets, bet];
      return { ...state, points: state.points - escrowDelta, bets };
    }

    case 'CANCEL_BET': {
      const existing = state.bets.find(b => b.matchKey === action.matchKey);
      if (!existing || existing.settled) return state; // não cancela depois de travado/liquidado
      return { ...state, points: state.points + existing.stake, bets: state.bets.filter(b => b.matchKey !== action.matchKey) };
    }

    case 'HEAL_INJURY': {
      // 🏥 Fisioterapia — reduz 1 jogo de lesão de um jogador do time (custa PHYSIO_COST).
      if (!state.playerTeam || state.points < SHOP_COSTS.physio) return state;
      const key = `${state.playerTeam.id}:${action.playerId}`;
      if (!state.discipline[key] || state.discipline[key].injured <= 0) return state;
      return { ...state, points: state.points - SHOP_COSTS.physio, discipline: healInjury(state.discipline, state.playerTeam.id, action.playerId) };
    }

    case 'EMERGENCY_REPLACE_PLAYER': {
      // 🆘 Contratação emergencial — gratuita, limitada a prata/bronze e válida somente
      // quando não existe reserva disponível para cobrir a vaga indisponível.
      if (state.mode === 'online' || !state.playerTeam) return state;
      const canonicalPlayer = PLAYERS.find(p => p.id === action.player.id);
      if (!canonicalPlayer) return state;
      const updatedTeam = applyEmergencyReplacement(state.playerTeam, state.discipline, action.starterId, canonicalPlayer);
      return updatedTeam ? { ...state, playerTeam: updatedTeam } : state;
    }

    case 'SELL_PLAYER': {
      // 🏪 Mercado (solo): vende uma RESERVA (índice ≥ 11) por pontos. Titular não é vendável.
      if (state.mode === 'online' || !state.playerTeam) return state;
      const idx = state.playerTeam.players.findIndex(p => p.id === action.playerId);
      if (idx < 11) return state; // -1 (não achou) ou titular (0-10): bloqueia
      const sold = state.playerTeam.players[idx];
      const players = state.playerTeam.players.filter((_, i) => i !== idx);
      // limpa a disciplina (suspensão/lesão) do vendido, se houver
      const discipline = { ...state.discipline };
      delete discipline[`${state.playerTeam.id}:${sold.id}`];
      return {
        ...state,
        points: state.points + sellValue(sold.rarity),
        playerTeam: { ...state.playerTeam, players },
        discipline,
      };
    }

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
        crestId: state.selectedCrestId ?? undefined,
      };

      // Generate bot teams
      const diffLevel = DIFFICULTY_LEVELS.find(d => d.id === state.difficulty);
      const botStrength = diffLevel?.botStrength ?? 0.72;
      const BOT_NAMES = [
        'Real Madrid',
        'Manchester City',
        'Bayern München',
        'Paris Saint-Germain',
        'Liverpool FC',
        'Inter de Milão',
        'Arsenal FC',
        'FC Barcelona',
        'Borussia Dortmund',
        'Juventus FC',
        'Atlético de Madrid',
        'Bayer Leverkusen',
        'AC Milan',
        'Benfica Glorioso',
        'Sporting CP',
        'FC Porto',
        'Ajax Legends',
        'PSV Eindhoven',
        'Feyenoord Roterdã',
        'Aston Villa',
        'Atalanta Bergamo',
        'AS Monaco',
        'Lille OSC',
        'VfB Stuttgart',
        'Bologna FC',
        'Girona FC',
        'Celtic FC',
        'Club Brugge',
        'Shakhtar Donetsk',
        'Dinamo Zagreb',
        'RB Salzburg',
        'Sparta Praga',
        'Young Boys Bern',
        'Estrela Vermelha',
        'Lazio Roma',
      ];
      const botTeams = BOT_NAMES.slice(0, Math.max(0, state.competitionFormat.teamCount - 1)).map(name => generateBotTeam(name, botStrength));

      const allTeams = [playerTeam, ...botTeams];
      const fixtures = state.competitionFormat.id === 'groups_knockout'
        ? generateRandomGroupFixtures(allTeams, state.competitionFormat.groupCount, state.competitionFormat.groupRounds)
        : generateRandomLeagueFixtures(allTeams, state.competitionFormat.leagueRounds);
      const standings = computeStandings(allTeams, []);

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
      };
    }

    case 'SIMULATE_LEAGUE': {
      if (!state.playerTeam) return state;
      // Deprecated, but keep as fallback to instantly simulate remaining rounds
      const allTeams = [state.playerTeam, ...state.botTeams];
      const newlySimulatedResults: MatchResult[] = [];
      const updatedFixtures = state.leagueFixtures.map(f => {
        if (f.played) return f;
        const home = allTeams.find(t => t.id === f.homeTeamId)!;
        const away = allTeams.find(t => t.id === f.awayTeamId)!;
        const result = simulateMatch(home, away, false, false, true, false, state.competitionFormat?.matchSettings);
        newlySimulatedResults.push(result);
        return { ...f, played: true, result };
      });
      const standings = computeStandings(allTeams, updatedFixtures);
      const results = updatedFixtures.map(f => f.result!).filter(Boolean);
      const playerTeam = applyDefeatGrowthForResults(state.playerTeam, newlySimulatedResults);
      const botTeams = state.botTeams.map(team => applyDefeatGrowthForResults(team, newlySimulatedResults));
      return {
        ...state,
        playerTeam,
        botTeams,
        leagueFixtures: updatedFixtures,
        leagueStandings: standings,
        leagueResults: results,
        leagueRound: state.competitionFormat.id === 'groups_knockout'
          ? state.competitionFormat.groupRounds
          : state.competitionFormat.leagueRounds,
      };
    }

    case 'PLAY_LEAGUE_MATCH': {
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

      // 🟨🟥🩹 Resolve as escalações contra a disciplina (suspensos/lesionados fora; reserva promovido).
      const rHome = resolveAvailableLineup(homeTeam, state.discipline).team;
      const rAway = resolveAvailableLineup(awayTeam, state.discipline).team;

      // Um único motor de simulação: no solo, pré-computa o resultado autoritativo (gols +
      // cartões + lesões + força) e entra em modo replay no MatchSimPage — igual mata-mata.
      // No online o replay é aberto por WATCH_ONLINE_MATCH com o resultado do servidor;
      // aqui preservamos o currentMatchResult existente pra não interferir.
      const currentMatchResult = state.mode === 'online'
        ? state.currentMatchResult
        : simulateMatch(rHome, rAway, false, false, true, false, state.competitionFormat?.matchSettings);

      return {
        ...state,
        phase: 'match_sim',
        currentMatch: null,
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
          phase: 'league',
          currentMatch: null,
          currentMatchTeams: null,
          currentMatchResult: null,
        };
      }

      if (!state.playerTeam) return state;
      const allTeams = [state.playerTeam, ...state.botTeams];
      
      // Save result for the player's fixture in the current round
      let allFixtures = state.leagueFixtures.map(f => {
        if (f.round === state.leagueRound && (f.homeTeamId === state.playerTeam?.id || f.awayTeamId === state.playerTeam?.id)) {
          return { ...f, played: true, result: action.result };
        }
        return f;
      });

      // Automatically simulate other matches in the same round if not already done.
      // 🟨🟥🩹 Bots também resolvem a escalação contra a disciplina (suspensos/lesionados fora).
      allFixtures = allFixtures.map(f => {
        if (f.round === state.leagueRound && !f.played) {
          const home = resolveAvailableLineup(allTeams.find(t => t.id === f.homeTeamId)!, state.discipline).team;
          const away = resolveAvailableLineup(allTeams.find(t => t.id === f.awayTeamId)!, state.discipline).team;
          const result = simulateMatch(home, away, false, false, true, false, state.competitionFormat?.matchSettings);
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
      const disc = applyMatchDiscipline(state.discipline, roundTeamIds, roundFx.map(f => f.result!), nameOf);

      const standings = computeStandings(allTeams, allFixtures);
      // Collect ALL played results across all rounds to preserve stats
      const results = allFixtures.map(f => f.result!).filter(Boolean);

      const rewards = state.competitionFormat?.rewards ?? DEFAULT_REWARDS_CONFIG;
      const rewardLimit = rewards.reinforcementUntilRound;
      const shouldOfferReinforcement = rewards.reinforcement !== 'off'
        && (rewardLimit === null || state.leagueRound <= rewardLimit)
        && (rewards.reinforcement === 'round' || state.leagueRound === (state.competitionFormat?.id === 'groups_knockout' ? state.competitionFormat.groupRounds : state.competitionFormat?.leagueRounds));
      // End-of-round reinforcement: offer the configured number of fresh players
      // (none already owned) to pick 1 from. The current default remains 6.
      const ownedIds = state.playerTeam.players.map(p => p.id);
      const reinforcementOptions = shouldOfferReinforcement
        ? generateDraftOptions([], ownedIds).slice(0, rewards.reinforcementOptions)
        : null;

      // Award shop credits for the player's performance using this format's values.
      const matchPoints = computeMatchPointsWithConfig(action.result, state.playerTeam.id, rewards.points);
      // 🤑 Magnata — titular multiplica os créditos da partida de liga (não empilha).
      const magMult = magnataPointMultiplier(state.playerTeam.players);
      const earnedPoints = rewards.pointsEnabled ? Math.round(matchPoints.total * magMult) : 0;

      // 🎯 Palpite: liquida e CREDITA os palpites da rodada agora (no solo, o fim da partida é a
      // revelação — o jogador viu o seu jogo ao vivo e os demais foram simulados aqui).
      const betPrefix = `L${state.leagueRound}:`;
      let betWinnings = 0;
      const settledBets = state.bets.map(b => {
        if (b.revealed || !b.matchKey.startsWith(betPrefix)) return b;
        const fx = allFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === b.matchKey);
        if (!fx?.result) return b;
        const r = settleBet(b, fx.result);
        betWinnings += r.payout;
        return { ...b, settled: true, revealed: true, won: r.won, tier: r.tier, payout: r.payout };
      });

      const updatedPlayerTeam = bumpStarterAppearances(applyDefeatGrowth(state.playerTeam, action.result));
      const updatedBotTeams = state.botTeams.map(team => {
        const fixture = roundFx.find(f => f.homeTeamId === team.id || f.awayTeamId === team.id);
        return fixture?.result ? applyDefeatGrowth(team, fixture.result) : team;
      });

      return {
        ...state,
        phase: 'league',
        leagueFixtures: allFixtures,
        leagueStandings: standings,
        leagueResults: results,
        currentMatch: null,
        currentMatchTeams: null,
        currentMatchResult: null,
        reinforcementOptions,
        points: state.points + earnedPoints + betWinnings,
        lastMatchPoints: rewards.pointsEnabled ? (magMult > 1 ? { ...matchPoints, total: earnedPoints } : matchPoints) : null,
        bets: settledBets,
        discipline: disc.next,
        // ⭐ +1 jogo pros 11 titulares do jogador (progresso pra Carta Evoluída).
        playerTeam: updatedPlayerTeam,
        botTeams: updatedBotTeams,
      };
    }

    case 'SIMULATE_BOT_MATCHES': {
      if (!state.playerTeam) return state;
      const allTeams = [state.playerTeam, ...state.botTeams];
      const newlySimulatedResults: MatchResult[] = [];
      const allFixtures = state.leagueFixtures.map(f => {
        if (f.round === state.leagueRound && !f.played) {
          const home = allTeams.find(t => t.id === f.homeTeamId)!;
          const away = allTeams.find(t => t.id === f.awayTeamId)!;
          const result = simulateMatch(home, away, false, false, true, false, state.competitionFormat?.matchSettings);
          newlySimulatedResults.push(result);
          return { ...f, played: true, result };
        }
        return f;
      });
      const standings = computeStandings(allTeams, allFixtures);
      // Collect ALL played results across all rounds to preserve stats
      const results = allFixtures.map(f => f.result!).filter(Boolean);
      const playerTeam = applyDefeatGrowthForResults(state.playerTeam, newlySimulatedResults);
      const botTeams = state.botTeams.map(team => applyDefeatGrowthForResults(team, newlySimulatedResults));
      return {
        ...state,
        playerTeam,
        botTeams,
        leagueFixtures: allFixtures,
        leagueStandings: standings,
        leagueResults: results,
      };
    }

    case 'ADVANCE_LEAGUE_ROUND': {
      const stageRounds = state.competitionFormat.id === 'groups_knockout'
        ? state.competitionFormat.groupRounds
        : state.competitionFormat.leagueRounds;
      return {
        ...state,
        leagueRound: Math.min(stageRounds, state.leagueRound + 1),
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
      // 🟨 Amarelos acumulados zeram ao entrar no mata-mata (suspensões/lesões em curso continuam).
      return { ...state, knockoutBracket: bracket, phase: 'knockout', discipline: resetYellowsForKnockout(state.discipline) };
    }

    case 'PLAY_KNOCKOUT_LEG': {
      // Solo: simulate the current leg (ida/volta) of every tie in the active
      // round on the server-equivalent engine. The player then watches their own
      // tie as a synchronized replay (KnockoutPage auto-opens it).
      if (!state.knockoutBracket || !state.playerTeam) return state;
      const allTeams = [state.playerTeam, ...state.botTeams];
      const bracket: KnockoutBracket = JSON.parse(JSON.stringify(state.knockoutBracket));
      const isFinalRound = bracket.currentRound === 'final';
      // 🟨🟥🩹 Resolve as escalações contra a disciplina antes de simular a perna (bots inclusos).
      const resolveFn = (id: string) => {
        const t = allTeams.find(tm => tm.id === id);
        return t ? resolveAvailableLineup(t, state.discipline).team : undefined;
      };
      playActiveKnockoutLeg(bracket as any, resolveFn as any, state.competitionFormat?.matchSettings);
      // Aplica a disciplina da PERNA recém-jogada (times da rodada ativa).
      const active = getActiveKnockoutMatches(bracket) as any[];
      const legNum = state.knockoutBracket.currentLeg;
      const legResults = active.map(t => legNum === 2 ? t.leg2 : t.leg1).filter(Boolean);
      const koTeamIds = Array.from(new Set(active.flatMap(t => [t.homeTeamId, t.awayTeamId])));
      const koNameOf = (teamId: string, playerId: string) =>
        allTeams.find(t => t.id === teamId)?.players.find(p => p.id === playerId)?.shortName ?? '?';
      const disc = applyMatchDiscipline(state.discipline, koTeamIds, legResults, koNameOf);
      const playerTeam = applyDefeatGrowthForResults(state.playerTeam, legResults);
      const botTeams = state.botTeams.map(team => applyDefeatGrowthForResults(team, legResults));
      // 🎯 Revela AGORA os palpites de confrontos que o jogador NÃO joga (placar já visível →
      // sem spoiler). O confronto próprio só revela depois que ele assistir (FINISH_KNOCKOUT_MATCH).
      // Sem isso, apostar num confronto alheio ficava eternamente "em andamento".
      const koTies = [
        ...((bracket as any).playoffs ?? []), ...((bracket as any).round16 ?? []),
        ...(bracket as any).quarterFinals, ...(bracket as any).semiFinals,
        ...((bracket as any).final ? [(bracket as any).final] : []),
      ];
      const revealed = revealEligibleKoBets(state.bets, koTies, state.playerTeam.id, state.watchedKnockoutMatches);
      // ⭐ +1 jogo pros 11 titulares do jogador (a perna que ele acabou de disputar).
      const stageNumber = state.competitionFormat?.id === 'knockout'
        ? ({ round16: 1, quarters: 2, semis: 3, final: 4 } as Record<string, number>)[bracket.currentRound] ?? 1
        : ({ playoffs: 1, round16: 2, quarters: 3, semis: 4, final: 5 } as Record<string, number>)[bracket.currentRound] ?? 1;
      const koRewards = state.competitionFormat?.rewards ?? DEFAULT_REWARDS_CONFIG;
      const stageFinished = active.length > 0 && active.every(t => t.played);
      const shouldOfferStageReinforcement = !isFinalRound && stageFinished
        && koRewards.reinforcement === 'stage'
        && (koRewards.reinforcementUntilRound === null || stageNumber <= koRewards.reinforcementUntilRound);
      const koOwnedIds = state.playerTeam.players.map(p => p.id);
      const stageReinforcement = shouldOfferStageReinforcement
        ? generateDraftOptions([], koOwnedIds).slice(0, koRewards.reinforcementOptions)
        : state.reinforcementOptions;
      return { ...state, knockoutBracket: bracket, discipline: disc.next, playerTeam: bumpStarterAppearances(playerTeam), botTeams, bets: revealed.bets, points: state.points + revealed.winnings, reinforcementOptions: stageReinforcement };
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
        return { ...state, knockoutBracket: bracket, champion, report, phase: 'report' };
      }
      return { ...state, knockoutBracket: bracket };
    }

    case 'FINISH_KNOCKOUT_MATCH': {
      // Both modes: the tie result is already computed by the engine and the
      // bracket advances via ADVANCE_KNOCKOUT (solo) / the host (online). Watching
      // a leg only returns to the bracket. The leg was marked watched on open.
      // Award shop points for the player's OWN leg (ida & volta) — but NOT the final (the season
      // is over after it, nothing left to spend on) and NOT while spectating someone else's tie.
      // No reinforcement in the knockout (that's league-only). The client computes the points in
      // both modes to drive the post-match popup; SOLO also credits the balance here, while ONLINE
      // credits it server-side (play_knockout_round) to stay authoritative.
      const isFinal = state.knockoutBracket?.currentRound === 'final';
      let points = state.points;
      let popup: MatchPoints | null = null;
      const pointsConfig = state.competitionFormat?.rewards ?? DEFAULT_REWARDS_CONFIG;
      if (!state.spectating && !isFinal && pointsConfig.pointsEnabled && pointsConfig.knockoutPointsEnabled && state.playerTeam && action.result &&
          (action.result.homeTeamId === state.playerTeam.id || action.result.awayTeamId === state.playerTeam.id)) {
        const mp = computeMatchPointsWithConfig(action.result, state.playerTeam.id, pointsConfig.points);
        popup = mp;
        if (state.mode !== 'online') points += mp.total;
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
        // leg was watched. This also keeps old/minimal states without the local
        // watched array backwards-compatible.
        const watchedLegKeys = [...(state.watchedKnockoutMatches ?? [])];
        if (action.result) {
          const resultTeams = new Set([action.result.homeTeamId, action.result.awayTeamId]);
          const ownTie = koTies.find(t => resultTeams.has(t.homeTeamId) && resultTeams.has(t.awayTeamId));
          const ownLegKey = ownTie ? `${ownTie.id}_l${b.currentLeg ?? 1}` : null;
          if (ownLegKey && !watchedLegKeys.includes(ownLegKey)) watchedLegKeys.push(ownLegKey);
        }
        const revealed = revealEligibleKoBets(state.bets, koTies, state.playerTeam?.id ?? '', watchedLegKeys);
        koBets = revealed.bets;
        points += revealed.winnings;
      }

      return {
        ...state,
        phase: 'knockout',
        spectating: false,
        activeKnockoutMatch: null,
        currentMatch: null,
        currentMatchTeams: null,
        currentMatchResult: null,
        points,
        knockoutPointsPopup: popup,
        bets: koBets,
      };
    }

    case 'DISMISS_KO_POINTS':
      return { ...state, knockoutPointsPopup: null };

    case 'SET_CURRENT_MATCH':
      return { ...state, currentMatch: action.result, currentMatchTeams: action.teams };

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
        currentMatch: null,
        activeKnockoutMatch: action.knockout
          ? { matchId: action.knockout.matchId, round: action.knockout.round, leg: action.knockout.leg, firstLeg: action.knockout.firstLeg }
          : null,
        lastWatchedRound: action.knockout
          ? state.lastWatchedRound
          : Math.max(state.lastWatchedRound, state.leagueRound),
        watchedKnockoutMatches: watchKey && !state.watchedKnockoutMatches.includes(watchKey)
          ? [...state.watchedKnockoutMatches, watchKey]
          : state.watchedKnockoutMatches,
      };
    }

    case 'CLEAR_CURRENT_MATCH':
      return { ...state, currentMatch: null, currentMatchTeams: null, currentMatchResult: null };

    case 'FINISH_GAME':
      return { ...state, champion: action.champion, phase: 'report' };

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
      } else if (state.phase === 'match_sim' && (roomState.phase === 'league' || roomState.phase === 'knockout')) {
        targetPhase = 'match_sim';
      }

      // While the player is actively on a SELECTION screen (coach / formation / squad
      // review), their local picks aren't submitted yet — a room broadcast triggered by
      // ANOTHER player must NOT overwrite them with the server's stale/default values.
      // (This caused the coach reverting to Guardiola and post-draft picks "jumping".)
      // We only sync picks from the server when ENTERING the screen (phase changes).
      const keepLocalPicks = ['coach', 'formation', 'squad_review'].includes(targetPhase) && state.phase === targetPhase;

      return {
        ...state,
        mode: 'online',
        roomCode: roomState.code,
        phase: targetPhase,
        difficulty: roomState.difficulty,
        competitionFormat: normalizeCompetitionFormat(roomState.competitionFormat),
        botTeams: roomState.botTeams || [],
        leagueFixtures: roomState.leagueFixtures || [],
        leagueStandings: roomState.leagueStandings || [],
        leagueResults: roomState.leagueResults || [],
        leagueRound: roomState.leagueRound || 1,
        knockoutBracket: roomState.knockoutBracket || null,
        champion: roomState.champion || null,
        onlinePlayers: roomState.players || [],
        draftOrder: roomState.draftState?.draftOrder || [],
        draftTurnIndex: roomState.draftState?.turnIndex || 0,
        draftHistory: roomState.draftState?.history || [],
        alreadyDraftedIds: roomState.draftState?.alreadyDraftedIds || [],
        onlineWatchedPlayers: roomState.phase === 'league'
          ? (roomState.watchedRoundPlayers || [])
          : (roomState.watchedKnockoutLegPlayers || []),
        onlineReadyPlayers: roomState.readyPlayers || [],
        onlineMarket: roomState.market || [],

        // Local player sync
        playerName: me ? me.name : state.playerName,
        playerTeam: me ? me.team : state.playerTeam,
        // Shop points + end-of-round reinforcement are server-authoritative online → mirror the
        // local player's balance, last-match summary and pending reinforcement offer.
        points: me ? (me.points ?? 0) : state.points,
        lastMatchPoints: me ? (me.lastMatchPoints ?? null) : state.lastMatchPoints,
        reinforcementOptions: me ? (me.reinforcementOptions ?? null) : state.reinforcementOptions,
        reinforcementRerolls: me ? (me.reinforcementRerolls ?? 0) : state.reinforcementRerolls,
        pendingPack: me ? (me.pendingPack ?? null) : state.pendingPack,
        pendingUniquePack: me ? (me.pendingUniquePack ?? null) : state.pendingUniquePack,
        bets: me ? (me.bets ?? []) : state.bets,
        discipline: roomState.discipline ?? state.discipline,
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
              const allResults = getAllPlayedMatchResults(roomState.leagueResults || [], roomState.knockoutBracket || null);
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
        mode: 'online',
        onlineSetupIntent: null,
        socketId: action.socketId,
        roomCode: action.roomCode,
        isHost: action.isHost,
      };

    case 'SET_ONLINE_READY_PLAYERS':
      return { ...state, onlineReadyPlayers: action.readyPlayers };

    case 'SET_ADVANCE_BLOCKED':
      return { ...state, advanceBlocked: action.waiting };

    case 'DISCONNECT_ONLINE':
      return {
        ...initialState,
      };

    case 'RESET_GAME':
      return { ...initialState };

    default:
      return state;
  }
}

// ============================================================
// CONTEXT
// ============================================================
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  // Helpers
  getTeamById: (id: string) => Team | undefined;
  getPlayerById: (id: string) => Player | undefined;
  getCoachById: (id: string) => Coach | undefined;
  getFormationById: (id: string) => Formation | undefined;
  
  // Online Multiplayer Socket emitters
  createRoom: (creatorName: string, competitionFormat: CompetitionFormat, difficulty?: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  startSetupOnline: () => void;
  submitSetupOnline: (coachId: string, formationId: string, crestId?: string | null) => void;
  draftPickOnline: (playerId: string) => void;
  draftVetoOnline: () => void;
  submitSquadReviewOnline: (captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, draftedPlayers: (Player | undefined)[], playStyle: string, formationId: string, matchPlan: MatchPlan) => void;
  setMatchRolesOnline: (captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, playStyle?: string, formationId?: string) => void;
  setMatchPlanOnline: (matchPlan: MatchPlan) => void;
  // League — host only
  playRoundOnline: () => void;
  advanceRoundOnline: () => void;
  // Knockout — host only
  playKnockoutRoundOnline: () => void;
  advanceKnockoutRoundOnline: () => void;
  restartRoomOnline: () => void;
  disconnectOnline: () => void;
  // Each player emits this when they finish watching their match replay. A
  // knockout replay identifies the exact tie/leg so ida remains confirmable
  // after the bracket pointer has advanced to the volta.
  notifyMatchWatchedOnline: (type: 'league' | 'knockout', knockout?: { matchId: string; leg?: number }) => void;
  shopChangeCoachOnline: (coachId: string) => void;
  evolveCoachPrimeOnline: () => void;
  shopOpenUniquePackOnline: () => void;
  shopClaimUniquePackOnline: () => void;
  shopOpenPackOnline: (kind: 'star' | 'scout', position?: string) => void;
  shopPickPackOnline: (player: Player) => void;
  shopTurbinarOnline: (playerId: string, variant: ShopVariant) => void;
  shopRemoveVariantOnline: (playerId: string, variantKey?: VariantFlag) => void;
  shopPlaceBetOnline: (matchKey: string, homeGoals: number, awayGoals: number, stake: number, homeTeamId?: string, awayTeamId?: string, market?: BetMarket, selections?: BetBuilderSelection[]) => void;
  shopCancelBetOnline: (matchKey: string) => void;
  healInjuryOnline: (playerId: string) => void;
  emergencyReplaceOnline: (starterId: string, playerId: string) => void;
  marketSellOnline: (playerId: string) => void;
  marketListOnline: (playerId: string, price: number) => void;
  marketCancelOnline: (listingId: string) => void;
  marketBuyOnline: (listingId: string) => void;
  playerReadyOnline: () => void;
  playerUnreadyOnline: () => void;
  shopTrainOnline: (playerId: string, attr: TrainAttr) => void;
  swapPlayerTeamOnline: (indexA: number, indexB: number) => void;
  martirTargetsOnline: (playerId: string, targetIds: string[]) => void;
  setEvolvePointOnline: (playerId: string, attr: AttrKey, delta: number) => void;
  resetEvolvePointsOnline: (playerId: string) => void;
  shopBuyRerollOnline: () => void;
  rerollReinforcementOnline: () => void;
  pickReinforcementOnline: (player: Player) => void;
  dismissReinforcementOnline: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

// Production builds use the Durable Object endpoint on the same Cloudflare
// hostname. Keeping Socket.IO for Vite development (or an explicit legacy
// override) preserves the existing local development workflow.
function usesDurableRealtime(): boolean {
  return !import.meta.env.DEV && import.meta.env.VITE_REALTIME_TRANSPORT !== 'socketio';
}

// Exported separately to avoid HMR incompatibility
export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const socketRef = useRef<RealtimeClientSocket | null>(null);
  const socketRoomCodeRef = useRef<string | null>(null);
  const onlineRoomRef = useRef<any | null>(null);
  const onlineSyncRevisionRef = useRef<number | null>(null);
  // Server-side room revision. Unlike the per-socket patch counter, this is
  // shared by every connection and lets us reject a late snapshot from an old
  // socket/reconnect instead of rendering the room back in time.
  const authoritativeRoomRevisionRef = useRef<number | null>(null);
  const syncRequestPendingRef = useRef(false);
  const commandSequenceRef = useRef(0);

  // Every gameplay action gets an opaque command ID. The Durable Object stores
  // a bounded receipt for it, so a reconnect can safely retry the exact action
  // without charging twice or advancing a bracket twice.
  const emitOnlineAction = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    if (!socketRef.current || !state.roomCode) return;
    commandSequenceRef.current += 1;
    const entropy = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replaceAll('-', '')
      : Math.random().toString(36).slice(2);
    const commandId = `${getClientId()}-${Date.now().toString(36)}-${commandSequenceRef.current}-${entropy}`;
    const roomEpoch = onlineRoomRef.current?.roomEpoch;
    socketRef.current.emit(event, {
      ...payload,
      commandId,
      ...(Number.isSafeInteger(roomEpoch) && roomEpoch > 0 ? { roomEpoch } : {}),
    });
  }, [state.roomCode]);

  // Auto disconnect on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const connectSocket = useCallback((requestedRoomCode?: string) => {
    const durableRealtime = usesDurableRealtime();
    const roomCode = requestedRoomCode?.toUpperCase() || getStorageItem(STORAGE_KEYS.roomCode)?.toUpperCase();
    if (socketRef.current) {
      // A failed join/create may leave a live socket pointing to a different
      // room object. Recreate it instead of leaking actions into that room.
      if (!durableRealtime || !roomCode || socketRoomCodeRef.current === roomCode) return socketRef.current;
      socketRef.current.disconnect();
      socketRef.current = null;
      authoritativeRoomRevisionRef.current = null;
    }

    if (durableRealtime && !roomCode) {
      throw new Error('Uma sala é necessária para abrir a conexão online.');
    }

    // O Socket.IO continua disponível para `pnpm dev`. No build publicado o
    // transporte é WebSocket nativo, atendido pelo Durable Object da própria
    // Cloudflare; não há host externo de backend para configurar.
    const socketInstance: RealtimeClientSocket = durableRealtime
      ? new DurableRealtimeSocket(roomCode!)
      : io(import.meta.env.VITE_SOCKET_URL || undefined, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      }) as unknown as RealtimeClientSocket;

    socketRef.current = socketInstance;
    socketRoomCodeRef.current = roomCode ?? null;
    authoritativeRoomRevisionRef.current = null;

    const requestRoomSync = () => {
      const roomCode = getStorageItem(STORAGE_KEYS.roomCode);
      if (!roomCode || syncRequestPendingRef.current) return;
      syncRequestPendingRef.current = true;
      socketInstance.emit("sync_room", { roomCode });
    };

    const isCurrentSocket = () => socketRef.current === socketInstance;
    const acceptRoomState = (roomState: any): boolean => {
      if (!isCurrentSocket() || !roomState || typeof roomState !== 'object') return false;
      const incomingRevision = Number.isSafeInteger(roomState.stateRevision) && roomState.stateRevision >= 0
        ? roomState.stateRevision as number
        : null;
      const currentRevision = authoritativeRoomRevisionRef.current;
      // Once a versioned state has been accepted, an unversioned legacy frame
      // can only be older data from a rolling connection and must not overwrite it.
      if (incomingRevision === null && currentRevision !== null) return false;
      if (incomingRevision !== null && currentRevision !== null && incomingRevision < currentRevision) return false;
      if (incomingRevision !== null) authoritativeRoomRevisionRef.current = incomingRevision;
      return true;
    };

    // `connect` dispara no primeiro conecte E em toda reconexão de transporte (o
    // socket caiu e o socket.io reconectou sozinho, sem recarregar a página). Numa
    // reconexão o `socket.id` é NOVO, então o servidor não nos reconhece mais e toda
    // ação vira no-op silencioso (tela travada). Re-emitimos o join com a identidade
    // persistente (clientId): o servidor reassocia o socket ao nosso jogador, nos põe
    // de volta na sala e re-sincroniza o estado. O primeiro conecte é ignorado aqui —
    // quem cuida dele é o fluxo de create/join (e o auto-reconnect de mount).
    let hasConnectedOnce = false;
    let reconnectToastId: string | number | undefined;
    socketInstance.on("connect", () => {
      if (!isCurrentSocket()) return;
      console.log("Socket connected to server:", socketInstance.id);
      // Opt into incremental room updates. The server still supports the
      // legacy full-snapshot event for older clients during a rolling deploy.
      socketInstance.emit("client_capabilities", { roomUpdates: 1 });
      if (hasConnectedOnce) {
        const roomCode = getStorageItem(STORAGE_KEYS.roomCode);
        const playerName = getStorageItem(STORAGE_KEYS.playerName);
        if (roomCode && playerName) {
          console.log(`Reconectado — re-entrando na sala ${roomCode}...`);
          socketInstance.emit("join_room", { roomCode, playerName, clientId: getClientId() });
        }
        if (reconnectToastId !== undefined) {
          toast.dismiss(reconnectToastId);
          toast.success("Reconectado ✓");
          reconnectToastId = undefined;
        }
      }
      hasConnectedOnce = true;
    });

    // Conexão perdida no meio de uma sessão: mostra um aviso persistente enquanto o
    // socket.io tenta reconectar (o `connect` acima re-entra na sala e limpa o aviso).
    // Ignora saídas intencionais (o próprio jogador saiu) e quando não há sala ativa.
    socketInstance.on("disconnect", (reason: string) => {
      if (!isCurrentSocket()) return;
      onlineRoomRef.current = null;
      onlineSyncRevisionRef.current = null;
      authoritativeRoomRevisionRef.current = null;
      syncRequestPendingRef.current = false;
      const inRoom = getStorageItem(STORAGE_KEYS.roomCode);
      if (inRoom && reason !== "io client disconnect" && reconnectToastId === undefined) {
        reconnectToastId = toast.loading("Conexão perdida — reconectando…");
      }
    });

    // Uma ação estourou no servidor (o wrapper de handlers avisou). Em vez de a tela
    // ficar travada sem feedback, mostramos um toast.
    socketInstance.on("action_error", ({ message }: { message?: string }) => {
      if (!isCurrentSocket()) return;
      toast.error(message || "Algo deu errado ao processar a ação. Tenta de novo.");
    });

    socketInstance.on("action_dropped", () => {
      if (!isCurrentSocket()) return;
      toast.error("Conexão instável: a ação não foi enviada. Aguarde a reconexão e tente novamente.");
    });

    // A rejected command is terminal (it was not applied), but the browser may
    // have been acting on a stale phase/balance. Pull one authoritative snapshot
    // so the UI immediately explains the current room instead of remaining stale.
    socketInstance.on("command_ack", ({ status }: { status?: string }) => {
      if (!isCurrentSocket()) return;
      if (status === 'rejected') requestRoomSync();
    });

    socketInstance.on("room_updated", (roomState: any) => {
      if (!acceptRoomState(roomState)) return;
      // Legacy server / legacy browser compatibility. A full update is also a
      // valid recovery point, but without a revision we wait for a snapshot
      // before applying any subsequent patch.
      onlineRoomRef.current = roomState;
      onlineSyncRevisionRef.current = null;
      syncRequestPendingRef.current = false;
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("room_snapshot", ({ roomState, syncRevision }: { roomState?: any; syncRevision?: number }) => {
      if (!isCurrentSocket()) return;
      if (!roomState || typeof syncRevision !== 'number' || !Number.isInteger(syncRevision) || syncRevision < 0) {
        requestRoomSync();
        return;
      }
      if (!acceptRoomState(roomState)) return;
      onlineRoomRef.current = roomState;
      onlineSyncRevisionRef.current = syncRevision;
      syncRequestPendingRef.current = false;
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("room_patch", ({ baseRevision, revision, patch }: {
      baseRevision?: number;
      revision?: number;
      patch?: RoomPatchOperation[];
    }) => {
      if (!isCurrentSocket()) return;
      if (!onlineRoomRef.current
        || !Number.isInteger(baseRevision)
        || !Number.isInteger(revision)
        || revision !== (baseRevision as number) + 1
        || onlineSyncRevisionRef.current !== baseRevision
        || !Array.isArray(patch)) {
        requestRoomSync();
        return;
      }

      try {
        const nextRoom = applyRoomPatch(onlineRoomRef.current, patch);
        if (!acceptRoomState(nextRoom)) return;
        onlineRoomRef.current = nextRoom;
        onlineSyncRevisionRef.current = revision as number;
        syncRequestPendingRef.current = false;
        dispatch({ type: 'SET_ONLINE_STATE', roomState: nextRoom, socketId: socketInstance.id || "" });
      } catch {
        requestRoomSync();
      }
    });

    socketInstance.on("ready_state_updated", ({ readyPlayers }: { readyPlayers?: string[] }) => {
      if (!isCurrentSocket()) return;
      dispatch({ type: 'SET_ONLINE_READY_PLAYERS', readyPlayers: readyPlayers || [] });
    });

    // Server refused an advance because not everyone has watched their match yet.
    socketInstance.on("advance_blocked", ({ waiting }: { waiting: string[] }) => {
      if (!isCurrentSocket()) return;
      dispatch({ type: 'SET_ADVANCE_BLOCKED', waiting: waiting || [] });
    });

    socketInstance.on("room_created", ({ roomCode, roomState }) => {
      if (!acceptRoomState(roomState)) return;
      onlineRoomRef.current = roomState;
      onlineSyncRevisionRef.current = 0;
      syncRequestPendingRef.current = false;
      const me = roomState.players[0];
      if (me) {
        setStorageItem(STORAGE_KEYS.playerName, me.name);
        setStorageItem(STORAGE_KEYS.roomCode, roomCode);
      }
      dispatch({ type: 'INIT_ONLINE', socketId: socketInstance.id || "", roomCode, isHost: true });
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("joined_room", ({ roomCode, player, roomState }) => {
      if (!acceptRoomState(roomState)) return;
      onlineRoomRef.current = roomState;
      onlineSyncRevisionRef.current = 0;
      syncRequestPendingRef.current = false;
      setStorageItem(STORAGE_KEYS.playerName, player.name);
      setStorageItem(STORAGE_KEYS.roomCode, roomCode);
      dispatch({ type: 'INIT_ONLINE', socketId: socketInstance.id || "", roomCode, isHost: player.id === 'player_0' });
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("error_message", (msg: string) => {
      if (!isCurrentSocket()) return;
      onlineRoomRef.current = null;
      onlineSyncRevisionRef.current = null;
      authoritativeRoomRevisionRef.current = null;
      syncRequestPendingRef.current = false;
      toast.error(msg);
      removeStorageItem(STORAGE_KEYS.playerName);
      removeStorageItem(STORAGE_KEYS.roomCode);
      dispatch({ type: 'DISCONNECT_ONLINE' });
    });

    return socketInstance;
  }, []);

  const createRoom = useCallback((creatorName: string, competitionFormat: CompetitionFormat, difficulty?: string) => {
    if (!usesDurableRealtime()) {
      const s = connectSocket();
      s.emit("create_room", { creatorName, competitionFormat, difficulty, clientId: getClientId() });
      return;
    }

    void (async () => {
      try {
        const response = await fetch('/api/realtime/room-code', { method: 'POST' });
        const body = await response.json().catch(() => null) as { roomCode?: unknown; reservationToken?: unknown; message?: unknown } | null;
        if (!response.ok || typeof body?.roomCode !== 'string') {
          throw new Error(typeof body?.message === 'string' ? body.message : 'Não foi possível criar a sala online.');
        }
        if (typeof body.reservationToken !== 'string' || body.reservationToken.length === 0) {
          throw new Error('A reserva da sala não foi confirmada. Tente criar novamente.');
        }
        const roomCode = body.roomCode.toUpperCase();
        const socket = connectSocket(roomCode);
        socket.emit('create_room', { creatorName, competitionFormat, difficulty, clientId: getClientId(), roomCode, reservationToken: body.reservationToken });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível criar a sala online.');
      }
    })();
  }, [connectSocket]);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const s = connectSocket(normalizedRoomCode);
    s.emit("join_room", { roomCode: normalizedRoomCode, playerName, clientId: getClientId() });
  }, [connectSocket]);

  const startSetupOnline = useCallback(() => {
    emitOnlineAction("start_setup", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const submitSetupOnline = useCallback((coachId: string, formationId: string, crestId?: string | null) => {
    emitOnlineAction("submit_setup", { roomCode: state.roomCode, coachId, formationId, crestId });
  }, [emitOnlineAction, state.roomCode]);

  const draftPickOnline = useCallback((playerId: string) => {
    emitOnlineAction("draft_pick", { roomCode: state.roomCode, playerId });
  }, [emitOnlineAction, state.roomCode]);

  const draftVetoOnline = useCallback(() => {
    emitOnlineAction("draft_veto", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const submitSquadReviewOnline = useCallback((captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, draftedPlayers: (Player | undefined)[], playStyle: string, formationId: string, matchPlan: MatchPlan) => {
    emitOnlineAction("submit_squad_review", {
      roomCode: state.roomCode,
      captain,
      penaltyTaker,
      freeKickTaker,
      draftedPlayers,
      playStyle,
      formationId,
      matchPlan,
    });
  }, [emitOnlineAction, state.roomCode]);

  const setMatchRolesOnline = useCallback((captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, playStyle?: string, formationId?: string) => {
    emitOnlineAction("set_match_roles", { roomCode: state.roomCode, captain, penaltyTaker, freeKickTaker, playStyle, formationId });
  }, [emitOnlineAction, state.roomCode]);

  const playRoundOnline = useCallback(() => {
    emitOnlineAction("play_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const advanceRoundOnline = useCallback(() => {
    emitOnlineAction("advance_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const playKnockoutRoundOnline = useCallback(() => {
    emitOnlineAction("play_knockout_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const advanceKnockoutRoundOnline = useCallback(() => {
    emitOnlineAction("advance_knockout_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const restartRoomOnline = useCallback(() => {
    emitOnlineAction("restart_room", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const notifyMatchWatchedOnline = useCallback((type: 'league' | 'knockout', knockout?: { matchId: string; leg?: number }) => {
    emitOnlineAction("player_match_watched", {
      roomCode: state.roomCode,
      type,
      ...(type === 'league' ? { round: state.leagueRound } : {}),
      ...knockout,
    });
  }, [emitOnlineAction, state.roomCode, state.leagueRound]);

  // ── Shop (online): emit to the server, which validates + broadcasts the new team/points ──
  const shopChangeCoachOnline = useCallback((coachId: string) => {
    emitOnlineAction("shop_change_coach", { roomCode: state.roomCode, coachId });
  }, [emitOnlineAction, state.roomCode]);
  const evolveCoachPrimeOnline = useCallback(() => {
    emitOnlineAction("evolve_coach_prime", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const shopOpenUniquePackOnline = useCallback(() => {
    emitOnlineAction("shop_open_unique_pack", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const setMatchPlanOnline = useCallback((matchPlan: MatchPlan) => {
    emitOnlineAction("set_match_plan", { roomCode: state.roomCode, matchPlan });
  }, [emitOnlineAction, state.roomCode]);
  const shopClaimUniquePackOnline = useCallback(() => {
    emitOnlineAction("shop_claim_unique_pack", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const shopOpenPackOnline = useCallback((kind: 'star' | 'scout', position?: string) => {
    emitOnlineAction("shop_open_pack", { roomCode: state.roomCode, kind, position });
  }, [emitOnlineAction, state.roomCode]);
  const shopPickPackOnline = useCallback((player: Player) => {
    emitOnlineAction("shop_pick_pack", { roomCode: state.roomCode, playerId: player.id });
  }, [emitOnlineAction, state.roomCode]);
  const shopTurbinarOnline = useCallback((playerId: string, variant: ShopVariant) => {
    emitOnlineAction("shop_turbinar", { roomCode: state.roomCode, playerId, variant });
  }, [emitOnlineAction, state.roomCode]);
  const shopTrainOnline = useCallback((playerId: string, attr: TrainAttr) => {
    emitOnlineAction("shop_train", { roomCode: state.roomCode, playerId, attr });
  }, [emitOnlineAction, state.roomCode]);
  const shopRemoveVariantOnline = useCallback((playerId: string, variantKey?: VariantFlag) => {
    emitOnlineAction("shop_remove_variant", { roomCode: state.roomCode, playerId, variantKey });
  }, [emitOnlineAction, state.roomCode]);
  const shopPlaceBetOnline = useCallback((matchKey: string, homeGoals: number, awayGoals: number, stake: number, homeTeamId?: string, awayTeamId?: string, market?: BetMarket, selections?: BetBuilderSelection[]) => {
    emitOnlineAction("place_bet", { roomCode: state.roomCode, matchKey, homeGoals, awayGoals, stake, homeTeamId, awayTeamId, market, selections });
  }, [emitOnlineAction, state.roomCode]);
  const shopCancelBetOnline = useCallback((matchKey: string) => {
    emitOnlineAction("cancel_bet", { roomCode: state.roomCode, matchKey });
  }, [emitOnlineAction, state.roomCode]);
  const healInjuryOnline = useCallback((playerId: string) => {
    emitOnlineAction("heal_injury", { roomCode: state.roomCode, playerId });
  }, [emitOnlineAction, state.roomCode]);
  const emergencyReplaceOnline = useCallback((starterId: string, playerId: string) => {
    emitOnlineAction("emergency_replace_player", { roomCode: state.roomCode, starterId, playerId });
  }, [emitOnlineAction, state.roomCode]);
  const marketSellOnline = useCallback((playerId: string) => {
    emitOnlineAction("market_sell", { roomCode: state.roomCode, playerId });
  }, [emitOnlineAction, state.roomCode]);
  const marketListOnline = useCallback((playerId: string, price: number) => {
    emitOnlineAction("market_list", { roomCode: state.roomCode, playerId, price });
  }, [emitOnlineAction, state.roomCode]);
  const marketCancelOnline = useCallback((listingId: string) => {
    emitOnlineAction("market_cancel", { roomCode: state.roomCode, listingId });
  }, [emitOnlineAction, state.roomCode]);
  const marketBuyOnline = useCallback((listingId: string) => {
    emitOnlineAction("market_buy", { roomCode: state.roomCode, listingId });
  }, [emitOnlineAction, state.roomCode]);
  const playerReadyOnline = useCallback(() => {
    emitOnlineAction("player_ready", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const playerUnreadyOnline = useCallback(() => {
    emitOnlineAction("player_unready", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const swapPlayerTeamOnline = useCallback((indexA: number, indexB: number) => {
    emitOnlineAction("swap_player_team", { roomCode: state.roomCode, indexA, indexB });
  }, [emitOnlineAction, state.roomCode]);
  const martirTargetsOnline = useCallback((playerId: string, targetIds: string[]) => {
    emitOnlineAction("set_martir_targets", { roomCode: state.roomCode, playerId, targetIds });
  }, [emitOnlineAction, state.roomCode]);
  const setEvolvePointOnline = useCallback((playerId: string, attr: AttrKey, delta: number) => {
    emitOnlineAction("set_evolve_point", { roomCode: state.roomCode, playerId, attr, delta });
  }, [emitOnlineAction, state.roomCode]);
  const resetEvolvePointsOnline = useCallback((playerId: string) => {
    emitOnlineAction("reset_evolve_points", { roomCode: state.roomCode, playerId });
  }, [emitOnlineAction, state.roomCode]);
  const shopBuyRerollOnline = useCallback(() => {
    emitOnlineAction("shop_buy_reroll", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const rerollReinforcementOnline = useCallback(() => {
    emitOnlineAction("reroll_reinforcement", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const pickReinforcementOnline = useCallback((player: Player) => {
    emitOnlineAction("pick_reinforcement", { roomCode: state.roomCode, player });
  }, [emitOnlineAction, state.roomCode]);
  const dismissReinforcementOnline = useCallback(() => {
    emitOnlineAction("dismiss_reinforcement", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const disconnectOnline = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    socketRoomCodeRef.current = null;
    authoritativeRoomRevisionRef.current = null;
    removeStorageItem(STORAGE_KEYS.playerName);
    removeStorageItem(STORAGE_KEYS.roomCode);
    dispatch({ type: 'DISCONNECT_ONLINE' });
  }, []);

  const getTeamById = useCallback((id: string) => {
    if (state.mode === 'online') {
      const match = state.onlinePlayers.find(p => p.id === id);
      if (match && match.team) return match.team;
    }
    if (state.playerTeam?.id === id) return state.playerTeam;
    return state.botTeams.find(t => t.id === id);
  }, [state.playerTeam, state.botTeams, state.onlinePlayers, state.mode]);

  const getPlayerById = useCallback((id: string) => {
    return PLAYERS.find(p => p.id === id);
  }, []);

  const getCoachById = useCallback((id: string) => {
    return COACHES.find(c => c.id === id);
  }, []);

  const getFormationById = useCallback((id: string) => {
    return FORMATIONS.find(f => f.id === id);
  }, []);

  // Auto reconnect to room if details exist in localStorage on mount.
  // Guard against double-joining: only reconnect when no socket is active yet.
  useEffect(() => {
    if (socketRef.current) return;
    const storedName = getStorageItem(STORAGE_KEYS.playerName);
    const storedCode = getStorageItem(STORAGE_KEYS.roomCode);
    if (storedName && storedCode) {
      console.log(`Auto-reconnecting to room ${storedCode} as ${storedName}...`);
      joinRoom(storedCode, storedName);
    }
  }, [joinRoom]);

  const contextValue = useMemo(() => ({
    state, dispatch, getTeamById, getPlayerById, getCoachById, getFormationById,
    createRoom, joinRoom, startSetupOnline, submitSetupOnline,
    draftPickOnline, draftVetoOnline, submitSquadReviewOnline, setMatchRolesOnline, setMatchPlanOnline,
    playRoundOnline, advanceRoundOnline, playKnockoutRoundOnline, advanceKnockoutRoundOnline,
    restartRoomOnline, disconnectOnline, notifyMatchWatchedOnline,
    shopChangeCoachOnline, evolveCoachPrimeOnline, shopOpenUniquePackOnline, shopClaimUniquePackOnline, shopOpenPackOnline, shopPickPackOnline, shopTurbinarOnline, shopRemoveVariantOnline, shopPlaceBetOnline, shopCancelBetOnline, healInjuryOnline, emergencyReplaceOnline, marketSellOnline, marketListOnline, marketCancelOnline, marketBuyOnline, playerReadyOnline, playerUnreadyOnline, shopTrainOnline,
    swapPlayerTeamOnline, martirTargetsOnline, setEvolvePointOnline, resetEvolvePointsOnline, shopBuyRerollOnline, rerollReinforcementOnline,
    pickReinforcementOnline, dismissReinforcementOnline,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, dispatch]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}


