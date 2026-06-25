// UCL Immortals — Game Context
// Central state management for the entire game session

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Player, Coach, Formation, COACHES, FORMATIONS, PLAYERS,
  DIFFICULTY_LEVELS,
} from '../lib/gameData';
import {
  Team, PlayerCard, MatchResult, StandingsEntry, DraftState, ImmortalReport,
  calculateChemistry, generateDraftOptions, getNeededPositions,
  generateBotTeam, simulateLeague, simulateMatch, generateImmortalReport,
  LeagueFixture, generateLeagueFixtures, computeStandings, rebuildTeamChemistry,
  getAllPlayedMatchResults, createKnockoutBracket,
  advanceKnockoutBracket, playActiveKnockoutLeg,
} from '../lib/gameEngine';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem } from '../lib/storage';

// ============================================================
// GAME PHASES
// ============================================================
export type GamePhase =
  | 'menu'           // Home screen
  | 'lobby'          // Multiplayer lobby
  | 'setup'          // Choose name, difficulty
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
  id: string; // e.g. "player_0"
  name: string;
  coachId: string;
  formationId: string;
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
  selectedCoachId: string;
  selectedFormationId: string;
  selectedPlayStyle: string;
  captain: string | null;
  penaltyTaker: string | null;
  freeKickTaker: string | null;
  // End-of-round reinforcement (solo league): 6 random players, pick 1 → joins the bench.
  reinforcementOptions: Player[] | null;

  // Online Multiplayer fields
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
  awayFromPo?: number;    // R16 only: index into playoffs whose winner fills awayTeamId
}

// ============================================================
// ACTIONS
// ============================================================
type GameAction =
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'SET_DIFFICULTY'; difficulty: string }
  | { type: 'SET_COACH'; coachId: string }
  | { type: 'SET_FORMATION'; formationId: string }
  | { type: 'SET_PLAY_STYLE'; playStyle: string }
  | { type: 'SET_PLAYER_TEAM_PLAY_STYLE'; playStyle: string }
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
  | { type: 'SET_PLAYER_TEAM_PENALTY_TAKER'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_FREE_KICK_TAKER'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_FORMATION'; formationId: string }
  | { type: 'PICK_REINFORCEMENT'; player: Player }
  | { type: 'DISMISS_REINFORCEMENT' }
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
  | { type: 'SET_CURRENT_MATCH'; result: MatchResult; teams: [Team, Team] }
  | { type: 'WATCH_ONLINE_MATCH'; teams: [Team, Team]; result: MatchResult; knockout?: { matchId: string; round: string; leg?: number; firstLeg?: { home: number; away: number } }; spectator?: boolean }
  | { type: 'CLEAR_CURRENT_MATCH' }
  | { type: 'FINISH_GAME'; champion: string }
  | { type: 'RESET_GAME' }
  | { type: 'SET_ONLINE_STATE'; roomState: any; socketId: string }
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
  selectedCoachId: 'guardiola',
  selectedFormationId: '4-3-3',
  selectedPlayStyle: 'balanced',
  captain: null,
  penaltyTaker: null,
  freeKickTaker: null,
  reinforcementOptions: null,

  // Online Multiplayer fields
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
  advanceBlocked: null,
};

// ============================================================
// REDUCER
// ============================================================
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.name };

    case 'SET_DIFFICULTY':
      return { ...state, difficulty: action.difficulty };

    case 'SET_COACH':
      return { ...state, selectedCoachId: action.coachId };

    case 'SET_FORMATION':
      return { ...state, selectedFormationId: action.formationId };

    case 'SET_PLAY_STYLE':
      return { ...state, selectedPlayStyle: action.playStyle };

    case 'SET_PLAYER_TEAM_PLAY_STYLE':
      if (!state.playerTeam) return state;
      return { ...state, playerTeam: { ...state.playerTeam, playStyle: action.playStyle } };

    case 'START_DRAFT': {
      const needed = getNeededPositions(state.selectedFormationId, Array(11).fill(undefined));
      const options = generateDraftOptions(needed, []);
      const draftState: DraftState = {
        round: 1,
        totalRounds: 11,
        currentOptions: options,
        selectedPlayers: [],
        vetoesLeft: 2,
        formationId: state.selectedFormationId,
        coachId: state.selectedCoachId,
        neededPositions: needed,
      };
      return { ...state, phase: 'draft', draftState, draftedPlayers: Array(11).fill(undefined) };
    }

    case 'DRAFT_PLAYER': {
      if (!state.draftState) return state;
      const currentRound = state.draftState.round;
      const newDrafted = [...state.draftedPlayers];

      const formation = FORMATIONS.find(f => f.id === state.selectedFormationId);
      const roles = formation?.positions.map(p => p.role) ?? [];

      let targetIndex = roles.findIndex((role, idx) =>
        role === action.player.position && newDrafted[idx] === undefined
      );

      if (targetIndex === -1 && action.player.secondaryPositions) {
        targetIndex = roles.findIndex((role, idx) =>
          action.player.secondaryPositions!.includes(role) && newDrafted[idx] === undefined
        );
      }

      if (targetIndex === -1) {
        targetIndex = newDrafted.findIndex(p => p === undefined);
      }

      if (targetIndex === -1) {
        targetIndex = currentRound - 1;
      }

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
        players: playerCards,
        captain: state.captain ?? undefined,
        penaltyTaker: state.penaltyTaker ?? undefined,
        freeKickTaker: state.freeKickTaker ?? undefined,
        totalChemistry: chemData.total,
        isBot: false,
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
      const botTeams = BOT_NAMES.map(name => generateBotTeam(name, botStrength));

      const allTeams = [playerTeam, ...botTeams];
      const fixtures = generateLeagueFixtures(allTeams);
      const standings = computeStandings(allTeams, []);

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
      const updatedFixtures = state.leagueFixtures.map(f => {
        if (f.played) return f;
        const home = allTeams.find(t => t.id === f.homeTeamId)!;
        const away = allTeams.find(t => t.id === f.awayTeamId)!;
        const result = simulateMatch(home, away);
        return { ...f, played: true, result };
      });
      const standings = computeStandings(allTeams, updatedFixtures);
      const results = updatedFixtures.map(f => f.result!).filter(Boolean);
      return {
        ...state,
        leagueFixtures: updatedFixtures,
        leagueStandings: standings,
        leagueResults: results,
        leagueRound: 8,
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

      return {
        ...state,
        phase: 'match_sim',
        currentMatch: null,
        currentMatchTeams: [homeTeam, awayTeam],
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

      // Automatically simulate other matches in the same round if not already done
      allFixtures = allFixtures.map(f => {
        if (f.round === state.leagueRound && !f.played) {
          const home = allTeams.find(t => t.id === f.homeTeamId)!;
          const away = allTeams.find(t => t.id === f.awayTeamId)!;
          const result = simulateMatch(home, away);
          return { ...f, played: true, result };
        }
        return f;
      });

      const standings = computeStandings(allTeams, allFixtures);
      // Collect ALL played results across all rounds to preserve stats
      const results = allFixtures.map(f => f.result!).filter(Boolean);

      // End-of-round reinforcement: offer 6 fresh players (none already owned) to pick
      // 1 from → it joins the bench. Solo only.
      const ownedIds = state.playerTeam.players.map(p => p.id);
      const reinforcementOptions = generateDraftOptions([], ownedIds);

      return {
        ...state,
        phase: 'league',
        leagueFixtures: allFixtures,
        leagueStandings: standings,
        leagueResults: results,
        currentMatch: null,
        currentMatchTeams: null,
        reinforcementOptions,
      };
    }

    case 'SIMULATE_BOT_MATCHES': {
      if (!state.playerTeam) return state;
      const allTeams = [state.playerTeam, ...state.botTeams];
      const allFixtures = state.leagueFixtures.map(f => {
        if (f.round === state.leagueRound && !f.played) {
          const home = allTeams.find(t => t.id === f.homeTeamId)!;
          const away = allTeams.find(t => t.id === f.awayTeamId)!;
          const result = simulateMatch(home, away);
          return { ...f, played: true, result };
        }
        return f;
      });
      const standings = computeStandings(allTeams, allFixtures);
      // Collect ALL played results across all rounds to preserve stats
      const results = allFixtures.map(f => f.result!).filter(Boolean);
      return {
        ...state,
        leagueFixtures: allFixtures,
        leagueStandings: standings,
        leagueResults: results,
      };
    }

    case 'ADVANCE_LEAGUE_ROUND': {
      return {
        ...state,
        leagueRound: Math.min(8, state.leagueRound + 1),
      };
    }

    case 'START_KNOCKOUT': {
      if (!state.playerTeam) return state;
      // Full UCL knockout: play-offs (9–24) → R16 (incl. top 8) → QF → SF → Final.
      const bracket = createKnockoutBracket(state.leagueStandings) as KnockoutBracket;
      return { ...state, knockoutBracket: bracket, phase: 'knockout' };
    }

    case 'PLAY_KNOCKOUT_LEG': {
      // Solo: simulate the current leg (ida/volta) of every tie in the active
      // round on the server-equivalent engine. The player then watches their own
      // tie as a synchronized replay (KnockoutPage auto-opens it).
      if (!state.knockoutBracket || !state.playerTeam) return state;
      const allTeams = [state.playerTeam, ...state.botTeams];
      const bracket: KnockoutBracket = JSON.parse(JSON.stringify(state.knockoutBracket));
      playActiveKnockoutLeg(bracket as any, (id: string) => allTeams.find(t => t.id === id));
      return { ...state, knockoutBracket: bracket };
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
      return {
        ...state,
        phase: 'knockout',
        spectating: false,
        activeKnockoutMatch: null,
        currentMatch: null,
        currentMatchTeams: null,
        currentMatchResult: null,
      };
    }

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
            totalRounds: 11,
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
        if (state.phase === 'coach' || state.phase === 'formation') {
          targetPhase = state.phase;
        } else {
          targetPhase = 'coach';
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

        // Local player sync
        playerName: me ? me.name : state.playerName,
        playerTeam: me ? me.team : state.playerTeam,
        draftedPlayers: keepLocalPicks ? state.draftedPlayers : (me ? me.draftedPlayers : state.draftedPlayers),
        selectedCoachId: keepLocalPicks ? state.selectedCoachId : (me ? me.coachId : state.selectedCoachId),
        selectedFormationId: keepLocalPicks ? state.selectedFormationId : (me ? me.formationId : state.selectedFormationId),
        selectedPlayStyle: keepLocalPicks ? state.selectedPlayStyle : (me ? (me.playStyle ?? 'balanced') : state.selectedPlayStyle),
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
        socketId: action.socketId,
        roomCode: action.roomCode,
        isHost: action.isHost,
      };

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
  createRoom: (creatorName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  setDifficultyOnline: (difficulty: string) => void;
  startSetupOnline: () => void;
  submitSetupOnline: (coachId: string, formationId: string) => void;
  draftPickOnline: (playerId: string) => void;
  draftVetoOnline: () => void;
  submitSquadReviewOnline: (captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, draftedPlayers: (Player | undefined)[], playStyle: string, formationId: string) => void;
  setMatchRolesOnline: (captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, playStyle?: string, formationId?: string) => void;
  // League — host only
  playRoundOnline: () => void;
  advanceRoundOnline: () => void;
  // Knockout — host only
  playKnockoutRoundOnline: () => void;
  advanceKnockoutRoundOnline: () => void;
  restartRoomOnline: () => void;
  disconnectOnline: () => void;
  // Each player emits this when they finish watching their match replay
  notifyMatchWatchedOnline: (type: 'league' | 'knockout') => void;
}

const GameContext = createContext<GameContextType | null>(null);

// Exported separately to avoid HMR incompatibility
export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const socketRef = useRef<Socket | null>(null);

  // Auto disconnect on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    // Connect to the same origin as the current page
    // (Socket.io is integrated directly into the Vite / production server)
    const socketInstance = io({
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      console.log("Socket connected to server:", socketInstance.id);
    });

    socketInstance.on("room_updated", (roomState: any) => {
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    // Server refused an advance because not everyone has watched their match yet.
    socketInstance.on("advance_blocked", ({ waiting }: { waiting: string[] }) => {
      dispatch({ type: 'SET_ADVANCE_BLOCKED', waiting: waiting || [] });
    });

    socketInstance.on("room_created", ({ roomCode, roomState }) => {
      const me = roomState.players[0];
      if (me) {
        setStorageItem(STORAGE_KEYS.playerName, me.name);
        setStorageItem(STORAGE_KEYS.roomCode, roomCode);
      }
      dispatch({ type: 'INIT_ONLINE', socketId: socketInstance.id || "", roomCode, isHost: true });
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("joined_room", ({ roomCode, player, roomState }) => {
      setStorageItem(STORAGE_KEYS.playerName, player.name);
      setStorageItem(STORAGE_KEYS.roomCode, roomCode);
      dispatch({ type: 'INIT_ONLINE', socketId: socketInstance.id || "", roomCode, isHost: player.id === 'player_0' });
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("error_message", (msg: string) => {
      alert(msg);
      removeStorageItem(STORAGE_KEYS.playerName);
      removeStorageItem(STORAGE_KEYS.roomCode);
      dispatch({ type: 'DISCONNECT_ONLINE' });
    });

    return socketInstance;
  }, []);

  const createRoom = useCallback((creatorName: string) => {
    const s = connectSocket();
    s.emit("create_room", { creatorName });
  }, [connectSocket]);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    const s = connectSocket();
    s.emit("join_room", { roomCode, playerName });
  }, [connectSocket]);

  const setDifficultyOnline = useCallback((difficulty: string) => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("set_difficulty", { roomCode: state.roomCode, difficulty });
    }
  }, [state.roomCode]);

  const startSetupOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("start_setup", { roomCode: state.roomCode });
    }
  }, [state.roomCode]);

  const submitSetupOnline = useCallback((coachId: string, formationId: string) => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("submit_setup", { roomCode: state.roomCode, coachId, formationId });
    }
  }, [state.roomCode]);

  const draftPickOnline = useCallback((playerId: string) => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("draft_pick", { roomCode: state.roomCode, playerId });
    }
  }, [state.roomCode]);

  const draftVetoOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("draft_veto", { roomCode: state.roomCode });
    }
  }, [state.roomCode]);

  const submitSquadReviewOnline = useCallback((captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, draftedPlayers: (Player | undefined)[], playStyle: string, formationId: string) => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("submit_squad_review", {
        roomCode: state.roomCode,
        captain,
        penaltyTaker,
        freeKickTaker,
        draftedPlayers,
        playStyle,
        formationId,
      });
    }
  }, [state.roomCode]);

  const setMatchRolesOnline = useCallback((captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, playStyle?: string, formationId?: string) => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("set_match_roles", { roomCode: state.roomCode, captain, penaltyTaker, freeKickTaker, playStyle, formationId });
    }
  }, [state.roomCode]);

  const playRoundOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("play_round", { roomCode: state.roomCode });
    }
  }, [state.roomCode]);

  const advanceRoundOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("advance_round", { roomCode: state.roomCode });
    }
  }, [state.roomCode]);

  const playKnockoutRoundOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("play_knockout_round", { roomCode: state.roomCode });
    }
  }, [state.roomCode]);

  const advanceKnockoutRoundOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("advance_knockout_round", { roomCode: state.roomCode });
    }
  }, [state.roomCode]);

  const restartRoomOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("restart_room", { roomCode: state.roomCode });
    }
  }, [state.roomCode]);

  const notifyMatchWatchedOnline = useCallback((type: 'league' | 'knockout') => {
    if (socketRef.current && state.roomCode) {
      socketRef.current.emit("player_match_watched", { roomCode: state.roomCode, type });
    }
  }, [state.roomCode]);

  const disconnectOnline = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
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
    createRoom, joinRoom, setDifficultyOnline, startSetupOnline, submitSetupOnline,
    draftPickOnline, draftVetoOnline, submitSquadReviewOnline, setMatchRolesOnline,
    playRoundOnline, advanceRoundOnline, playKnockoutRoundOnline, advanceKnockoutRoundOnline,
    restartRoomOnline, disconnectOnline, notifyMatchWatchedOnline,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, dispatch]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}


