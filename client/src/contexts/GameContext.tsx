// Game state entry point: types and initial state (game/state), the solo reducer
// (game/reducer) and the provider with the online actions (game/provider).
export type {
  GamePhase, AccountSection, RoomPlayer, GameState, KnockoutBracket, KnockoutMatch, GameAction,
} from './game/state';
export type {
  SavedSoloCampaign,
} from './game/soloCampaign';
export {
  gameReducer,
} from './game/reducer';
export {
  useGame, GameProvider,
} from './game/provider';
