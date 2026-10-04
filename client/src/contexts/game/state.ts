// Game phases, state shape, actions and the initial state.

import { Player, type PlayerSpecialization } from '@shared/game/gameData';
import { Team, MatchResult, StandingsEntry, DraftState, ImmortalReport, LeagueFixture, normalizeMatchPlan, type MatchPlan, type VariantFlag, type PlayerSeasonStats } from '@shared/game/gameEngine';
import { type AttrKey } from '@shared/game/traits';
import { MatchPoints, ShopVariant, TrainAttr, type RegularPlayerPackRarity } from '@shared/game/shop';
import { Bet, BetBuilderSelection, BetMarket } from '@shared/game/bets';
import { DisciplineMap } from '@shared/game/discipline';
import { type ClubProjectId, type RecruitmentOfferMeta } from '@shared/game/clubProjects';
import { MarketListing, TradeSession } from '@shared/game/market';
import { DEFAULT_COMPETITION_FORMAT, type CompetitionFormat } from '@shared/game/competition';
import { createMissionState, type MissionState } from '@shared/game/missions';

// ============================================================
// GAME PHASES
// ============================================================
export type GamePhase =
  | 'menu'           // Home screen
  | 'account'        // Account, profile, records and friends
  | 'album'          // Player album / catalog
  | 'achievements'   // Account achievements
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

export type AccountSection = 'profile' | 'history' | 'records' | 'friends';


// ============================================================
// STATE
// ============================================================
export interface RoomPlayer {
  socketId: string;
  connected: boolean; // sincronizado do servidor
  kicked?: boolean; // removido pelo anfitrião; não pode reconectar nesta sala
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
  reinforcementOptions?: Player[] | null;
  reinforcementOffer?: RecruitmentOfferMeta | null;
  reinforcementEventCount?: number;
  medicalFreeTreatmentsUsed?: number;
  lastMatchPoints?: MatchPoints | null;
  uniquePackOfferIds?: string[];
  uniquePackOfferRoundKey?: string | null;
  playerPackOfferIds?: Partial<Record<RegularPlayerPackRarity, string[]>>;
  playerPackOfferRoundKeys?: Partial<Record<RegularPlayerPackRarity, string | null>>;
  pendingPackReveal?: { kind: RegularPlayerPackRarity; card: Player } | null;
  missions?: MissionState;
}

export interface GameState {
  phase: GamePhase;
  accountSection: AccountSection;
  playerName: string;
  difficulty: string;
  competitionFormat: CompetitionFormat;
  playerTeam: Team | null;
  botTeams: Team[];
  draftState: DraftState | null;
  leagueStandings: StandingsEntry[];
  leagueResults: MatchResult[];
  // Online: compact server-authoritative aggregate for the season leaderboard.
  onlineSeasonPlayerStats: Record<string, PlayerSeasonStats>;
  leagueRound: number;
  leagueFixtures: LeagueFixture[];
  knockoutBracket: KnockoutBracket | null;
  activeKnockoutMatch: { matchId: string; round: string; leg?: number; firstLeg?: { home: number; away: number } } | null;
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
  // End-of-round recruitment offer. The competition decides when it appears;
  // the Recruitment Centre decides its options and selection limit.
  reinforcementOptions: Player[] | null;
  reinforcementOffer: RecruitmentOfferMeta | null;
  reinforcementEventCount: number;
  // Shop economy (solo league): points earned per match, spent in the LOJA tab.
  points: number;
  lastMatchPoints: MatchPoints | null; // latest reward breakdown (shown in the shared credits modal)
  // Online replays finish by remounting the league hub. Keep the reward marked
  // as pending until the player explicitly closes its credits modal.
  matchCreditsModalPending: boolean;
  // 🛒 Pacote da loja JÁ PAGO na abertura: fica guardado até você
  // escolher 1 → impede re-sortear de graça abrindo/fechando o modal. A escolha em si é grátis.
  pendingPack: { kind: 'scout'; options: Player[] } | null;
  pendingPackReveal: { kind: RegularPlayerPackRarity; card: Player } | null;
  // ⭐ Pacote Único já pago: carta sorteada, aguardando a animação/revelação.
  pendingUniquePack: Player | null;
  // ⭐ As quatro cartas visíveis da oferta da rodada. A lista fica estável;
  // quando uma é adquirida, o card apenas passa a exibir "JÁ POSSUI".
  uniquePackOfferIds: string[];
  uniquePackOfferRoundKey: string | null;
  playerPackOfferIds: Partial<Record<RegularPlayerPackRarity, string[]>>;
  playerPackOfferRoundKeys: Partial<Record<RegularPlayerPackRarity, string | null>>;
  // 🎯 Palpites (apostas de pontos). Escrow já debitado ao apostar; crédito só na revelação.
  bets: Bet[];
  // 🟨🟥🩹 Disciplina & lesões — disponibilidade por jogador (todos os times), carrega entre jogos.
  discipline: DisciplineMap;
  // 🏥 Usos gratuitos de Fisioterapia consumidos nesta competição.
  medicalFreeTreatmentsUsed: number;
  missions: MissionState;

  // Online Multiplayer fields
  onlineSetupIntent: 'create' | null;
  mode: 'solo' | 'online';
  roomCode: string | null;
  socketId: string | null;
  onlinePlayers: RoomPlayer[];
  onlineHostId: string | null;
  isHost: boolean;
  draftOrder: string[];
  draftTurnIndex: number;
  draftHistory: any[];
  // Online sync: which league round / knockout matches the local player has
  // already watched, so we only auto-open each replay once.
  lastWatchedRound: number;
  watchedKnockoutMatches: string[];
  // True while watching SOMEONE ELSE'S tie as a spectator (eliminated player). Such a
  // watch must not notify the server's advance-gate (the spectator isn't a participant).
  spectating: boolean;
  // IDs of players who have confirmed watching the current round/leg (from server)
  onlineWatchedPlayers: string[];
  // Which round / leg the server list above refers to. The server keeps the list
  // until the next match is simulated, so it is only meaningful for this window.
  onlineWatchedLeagueRound: number | null;
  onlineWatchedKnockoutLegKey: { round: string; leg: number } | null;
  // Replay currently open (league "L<round>", knockout "<tieId>_l<leg>" or "<tieId>")
  // and replays this device finished. A finished replay the server has not
  // acknowledged is re-confirmed instead of replayed again.
  onlineReplayKey: string | null;
  onlineFinishedReplays: string[];
  onlineReadyPlayers: string[]; // ✅ jogadores que apertaram "Estou pronto" p/ a rodada/perna atual
  onlineMarket: MarketListing[]; // 🏪 anúncios do mercado online (compartilhado pela sala)
  onlineTradeSessions: TradeSession[]; // 🔄 sessões de troca direta (compartilhado pela sala)
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
  | { type: 'SET_ACCOUNT_SECTION'; section: AccountSection }
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
  | { type: 'SET_CAPTAIN'; playerId: string }
  | { type: 'SET_PENALTY_TAKER'; playerId: string }
  | { type: 'SET_FREE_KICK_TAKER'; playerId: string }
  | { type: 'SWAP_PLAYERS'; indexA: number; indexB: number }
  | { type: 'SWAP_PLAYER_TEAM'; indexA: number; indexB: number }
  | { type: 'SET_PLAYER_TEAM_CAPTAIN'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_MARTIR_TARGETS'; playerId: string; targetIds: string[] }
  | { type: 'SET_PLAYER_TEAM_PADRINHO_TARGET'; playerId: string; targetId: string }
  | { type: 'SET_PLAYER_TEAM_PENALTY_TAKER'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_FREE_KICK_TAKER'; playerId: string }
  | { type: 'SET_PLAYER_TEAM_FORMATION'; formationId: string }
  | { type: 'PICK_REINFORCEMENT'; player: Player }
  | { type: 'DISMISS_REINFORCEMENT' }
  | { type: 'UPGRADE_CLUB_PROJECT'; projectId: ClubProjectId }
  | { type: 'SHOP_CHANGE_COACH'; coachId: string }
  | { type: 'EVOLVE_COACH_PRIME' }
  | { type: 'SET_EVOLVE_POINT'; playerId: string; attr: AttrKey; delta: number }
  | { type: 'SET_AUTO_EVOLVE_ATTRIBUTE'; playerId: string; attr: AttrKey | null }
  | { type: 'UNLOCK_PLAYER_SPECIALIZATION'; playerId: string }
  | { type: 'CHOOSE_PLAYER_SPECIALIZATION'; playerId: string; specialization: PlayerSpecialization }
  | { type: 'RESET_EVOLVE_POINTS'; playerId: string }
  | { type: 'SHOP_OPEN_UNIQUE_PACK' } // cobra 750 e sorteia uma Única ainda não possuída
  | { type: 'SHOP_CLAIM_UNIQUE_PACK' } // adiciona a carta revelada ao banco, sem nova cobrança
  | { type: 'ENSURE_UNIQUE_PACK_OFFER' } // cria a oferta visível da rodada, se necessário
  | { type: 'ENSURE_PLAYER_PACK_OFFERS' } // cria as ofertas de raridade visíveis da rodada
  | { type: 'SHOP_OPEN_PLAYER_PACK'; rarity: RegularPlayerPackRarity }
  | { type: 'SHOP_CLAIM_PLAYER_PACK' }
  | { type: 'SHOP_OPEN_PACK'; position: string } // Caça-Talentos: COBRA ao abrir; guarda as opções
  | { type: 'SHOP_PICK_PACK'; player: Player } // escolhe 1 do pacote já pago (grátis) → banco
  | { type: 'SHOP_TURBINAR'; playerId: string; variant: ShopVariant }
  | { type: 'SHOP_REMOVE_VARIANT'; playerId: string; variantKey?: VariantFlag }
  | { type: 'SHOP_TRAIN'; playerId: string; attr: TrainAttr }
  | { type: 'REROLL_REINFORCEMENT' }
  | { type: 'PLACE_BET'; matchKey: string; homeTeamId?: string; awayTeamId?: string; homeGoals?: number; awayGoals?: number; stake: number; market?: BetMarket; selections?: BetBuilderSelection[] }
  | { type: 'CANCEL_BET'; matchKey: string }
  | { type: 'HEAL_INJURY'; playerId: string }
  | { type: 'EMERGENCY_REPLACE_PLAYER'; starterId: string; player: Player }
  | { type: 'ACCEPT_MISSION'; missionId: string }
  | { type: 'REROLL_MISSIONS' }
  | { type: 'REMOVE_MISSION'; missionId: string }
  | { type: 'DISMISS_MISSION_RESOLUTION' }
  | { type: 'SELL_PLAYER'; playerId: string }
  | { type: 'START_LEAGUE'; missionSeed: string }
  | { type: 'START_KNOCKOUT' }
  | { type: 'PLAY_LEAGUE_MATCH'; homeTeamId: string; awayTeamId: string }
  | { type: 'FINISH_LEAGUE_MATCH'; result: MatchResult }
  | { type: 'ADVANCE_LEAGUE_ROUND' }
  | { type: 'PLAY_KNOCKOUT_LEG' }
  | { type: 'ADVANCE_KNOCKOUT' }
  | { type: 'FINISH_KNOCKOUT_MATCH'; result: MatchResult }
  | { type: 'DISMISS_MATCH_CREDITS' }
  | { type: 'WATCH_ONLINE_MATCH'; teams: [Team, Team]; result: MatchResult; knockout?: { matchId: string; round: string; leg?: number; firstLeg?: { home: number; away: number } }; spectator?: boolean }
  | { type: 'FINISH_ELIMINATED_CAMPAIGN' }
  | { type: 'FINISH_GAME'; champion: string }
  | { type: 'RESET_GAME' }
  | { type: 'RESTORE_SOLO_CAMPAIGN'; state: GameState }
  | { type: 'SET_ONLINE_STATE'; roomState: any; socketId: string }
  | { type: 'SET_ONLINE_READY_PLAYERS'; readyPlayers: string[] }
  | { type: 'SET_ONLINE_TRADE_STATE'; trades: TradeSession[]; readyPlayers: string[] }
  | { type: 'INIT_ONLINE'; socketId: string; roomCode: string; isHost: boolean }
  | { type: 'SET_ADVANCE_BLOCKED'; waiting: string[] | null }
  | { type: 'DISCONNECT_ONLINE' };

// ============================================================
// INITIAL STATE
// ============================================================
export const initialState: GameState = {
  phase: 'menu',
  accountSection: 'profile',
  playerName: '',
  difficulty: 'gold',
  competitionFormat: { ...DEFAULT_COMPETITION_FORMAT },
  playerTeam: null,
  botTeams: [],
  draftState: null,
  leagueStandings: [],
  leagueResults: [],
  onlineSeasonPlayerStats: {},
  leagueRound: 1,
  leagueFixtures: [],
  knockoutBracket: null,
  activeKnockoutMatch: null,
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
  reinforcementOffer: null,
  reinforcementEventCount: 0,
  points: 0,
  lastMatchPoints: null,
  matchCreditsModalPending: false,
  pendingPack: null,
  pendingPackReveal: null,
  pendingUniquePack: null,
  uniquePackOfferIds: [],
  uniquePackOfferRoundKey: null,
  playerPackOfferIds: {},
  playerPackOfferRoundKeys: {},
  bets: [],
  discipline: {},
  medicalFreeTreatmentsUsed: 0,
  missions: createMissionState('solo', 'L1'),

  // Online Multiplayer fields
  onlineSetupIntent: null,
  mode: 'solo',
  roomCode: null,
  socketId: null,
  onlinePlayers: [],
  onlineHostId: null,
  isHost: false,
  draftOrder: [],
  draftTurnIndex: 0,
  draftHistory: [],
  lastWatchedRound: 0,
  watchedKnockoutMatches: [],
  spectating: false,
  onlineWatchedPlayers: [],
  onlineWatchedLeagueRound: null,
  onlineWatchedKnockoutLegKey: null,
  onlineReplayKey: null,
  onlineFinishedReplays: [],
  onlineReadyPlayers: [],
  onlineMarket: [],
  onlineTradeSessions: [],
  advanceBlocked: null,
};
