import { Server, Socket } from "socket.io";

// Import game engine functions
import {
  generateDraftOptions,
  getNeededPositions,
  generateBotTeam,
  generateLeagueFixtures,
  computeStandings,
  simulateMatch,
  calculateChemistry,
  createKnockoutBracket,
  playActiveKnockoutLeg,
  advanceKnockoutBracket,
  rebuildTeamChemistry,
  applyShopVariant,
  generateStarPackOptions,
  generateScoutOptions,
  Team,
  PlayerCard,
  MatchResult,
  LeagueFixture,
  StandingsEntry,
  KnockoutBracket
} from "../client/src/lib/gameEngine.js";

import { FORMATIONS, DIFFICULTY_LEVELS, Player } from "../client/src/lib/gameData.js";
import { computeMatchPoints, MatchPoints, SHOP_COSTS, trainCost, TRAIN_BOOST, ShopVariant, TrainAttr } from "../client/src/lib/shop.js";

interface RoomPlayer {
  socketId: string;
  id: string;
  name: string;
  coachId: string;
  formationId: string;
  playStyle: string;
  draftedPlayers: (Player | undefined)[];
  vetoesLeft: number;
  captain: string | null;
  penaltyTaker: string | null;
  freeKickTaker: string | null;
  team: Team | null;
  ready: boolean;
  connected: boolean;
  points: number; // shop currency, earned per league match
  lastMatchPoints: MatchPoints | null;    // last round's points breakdown (shown once)
  reinforcementOptions: Player[] | null;   // end-of-round free pick (1 of 6 → bench)
}

interface RoomState {
  code: string;
  phase: 'lobby' | 'setup' | 'draft' | 'squad_review' | 'league' | 'knockout' | 'report';
  difficulty: string;
  // id of the player that currently drives progression (first connected player).
  hostId: string;
  players: RoomPlayer[];
  botTeams: Team[];
  leagueFixtures: LeagueFixture[];
  leagueStandings: StandingsEntry[];
  leagueResults: MatchResult[];
  leagueRound: number;
  knockoutBracket: KnockoutBracket | null;
  champion: string | null;
  // Synchronization: which human players have confirmed watching the current round/leg
  watchedRoundPlayers: string[];
  watchedKnockoutLegPlayers: string[];
  draftState: {
    round: number;
    turnIndex: number;
    draftOrder: string[];
    alreadyDraftedIds: string[];
    history: {
      round: number;
      teamName: string;
      playerName: string;
      playerId: string;
      position: string;
      overall: number;
    }[];
    currentOptionsByPlayer: Record<string, Player[]>;
  };
}

const rooms = new Map<string, RoomState>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getUniqueRoomCode(): string {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  return code;
}

// Pending deletions for rooms whose players have all left (kept off the RoomState
// so the timer object is never serialized to clients).
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ROOM_CLEANUP_MS = 5 * 60 * 1000; // delete an all-empty room after 5 min

// The host drives progression. It is the FIRST CONNECTED player, so if the
// creator drops the role transfers automatically (and reverts when they return).
function recomputeHost(room: RoomState): void {
  const firstConnected = room.players.find(p => p.connected);
  room.hostId = (firstConnected ?? room.players[0])?.id ?? '';
}

function isHost(room: RoomState, socketId: string): boolean {
  const host = room.players.find(p => p.id === room.hostId);
  return !!host && host.socketId === socketId;
}

// Whether every human in the active knockout round has confirmed watching the leg
// that was just played. Used to gate BOTH playing the next leg (ida → volta) and
// advancing the bracket (after the volta) — so the host can never skip ahead.
function knockoutWatchStatus(room: RoomState): { allWatched: boolean; waiting: string[] } {
  const bracket = room.knockoutBracket;
  if (!bracket) return { allWatched: true, waiting: [] };
  const roundKey = bracket.currentRound === 'quarters' ? 'quarterFinals' : bracket.currentRound === 'semis' ? 'semiFinals' : bracket.currentRound;
  const currentMatches: any[] = bracket.currentRound === 'final'
    ? (bracket.final ? [bracket.final] : [])
    : (bracket as any)[roundKey] || [];
  // Only CONNECTED humans gate advancement — a player who left/disconnected must not
  // freeze the host waiting for a "watch" that will never come.
  const humanIdsInRound = room.players
    .filter(p => p.connected && currentMatches.some((m: any) => m.homeTeamId === p.id || m.awayTeamId === p.id))
    .map(p => p.id);
  const allWatched = humanIdsInRound.every(id => room.watchedKnockoutLegPlayers.includes(id));
  const waiting = room.players
    .filter(p => humanIdsInRound.includes(p.id) && !room.watchedKnockoutLegPlayers.includes(p.id))
    .map(p => p.name);
  return { allWatched, waiting };
}

// Schedule deletion of a room once every player has disconnected; cancelled if
// anyone (re)joins. Prevents abandoned rooms from leaking forever.
function scheduleRoomCleanupIfEmpty(room: RoomState): void {
  if (room.players.some(p => p.connected)) {
    cancelRoomCleanup(room.code);
    return;
  }
  if (cleanupTimers.has(room.code)) return;
  const timer = setTimeout(() => {
    cleanupTimers.delete(room.code);
    const cur = rooms.get(room.code);
    if (cur && !cur.players.some(p => p.connected)) {
      clearDraftTurnTimer(room.code);
      rooms.delete(room.code);
      console.log(`Room ${room.code} deleted (all players left)`);
    }
  }, ROOM_CLEANUP_MS);
  cleanupTimers.set(room.code, timer);
}

function cancelRoomCleanup(code: string): void {
  const t = cleanupTimers.get(code);
  if (t) { clearTimeout(t); cleanupTimers.delete(code); }
}

// Slots the chosen player into the active player's lineup and advances the draft
// turn (or moves to squad review when the draft is complete). Shared by the
// draft_pick handler and the disconnected-player auto-pick.
function applyDraftPick(room: RoomState, activePlayer: RoomPlayer, chosenPlayer: Player): void {
  const ds = room.draftState;
  const currentRound = ds.round;
  const newDrafted = [...activePlayer.draftedPlayers];
  const formation = FORMATIONS.find(f => f.id === activePlayer.formationId);
  const roles = formation?.positions.map(p => p.role) ?? [];

  let targetIndex = roles.findIndex((role, idx) => role === chosenPlayer.position && newDrafted[idx] === undefined);
  if (targetIndex === -1 && chosenPlayer.secondaryPositions) {
    targetIndex = roles.findIndex((role, idx) => chosenPlayer.secondaryPositions!.includes(role) && newDrafted[idx] === undefined);
  }
  if (targetIndex === -1) targetIndex = newDrafted.findIndex(p => p === undefined);
  if (targetIndex === -1) targetIndex = currentRound - 1;

  newDrafted[targetIndex] = chosenPlayer;
  activePlayer.draftedPlayers = newDrafted;

  ds.alreadyDraftedIds.push(chosenPlayer.id);
  ds.history.push({
    round: currentRound,
    teamName: activePlayer.name,
    playerName: chosenPlayer.shortName,
    playerId: chosenPlayer.id,
    position: chosenPlayer.position,
    overall: chosenPlayer.overall,
  });

  const nextTurnIndex = ds.turnIndex + 1;
  if (nextTurnIndex >= ds.draftOrder.length) {
    room.phase = 'squad_review';
    room.players.forEach(p => { p.ready = false; });
  } else {
    ds.turnIndex = nextTurnIndex;
    ds.round = Math.floor(nextTurnIndex / room.players.length) + 1;
    const nextPlayerId = ds.draftOrder[nextTurnIndex];
    const nextPlayer = room.players.find(p => p.id === nextPlayerId);
    if (nextPlayer) {
      const nextNeeded = getNeededPositions(nextPlayer.formationId, nextPlayer.draftedPlayers);
      ds.currentOptionsByPlayer[nextPlayerId] = generateDraftOptions(nextNeeded, ds.alreadyDraftedIds);
    }
  }
}

// Auto-picks (first available option) for any disconnected player whose turn it
// is, so the draft never stalls on someone who left. Stops at the first connected
// player. Emits once if any auto-pick happened.
function autoPickDisconnected(io: Server, room: RoomState): void {
  let picked = false;
  let guard = 0;
  while (room.phase === 'draft' && guard++ < 1000) {
    const ds = room.draftState;
    const activeId = ds.draftOrder[ds.turnIndex];
    const active = room.players.find(p => p.id === activeId);
    if (!active || active.connected) break;
    let options = ds.currentOptionsByPlayer[activeId];
    if (!options || options.length === 0) {
      const needed = getNeededPositions(active.formationId, active.draftedPlayers);
      options = generateDraftOptions(needed, ds.alreadyDraftedIds);
      ds.currentOptionsByPlayer[activeId] = options;
    }
    const chosen = options[0];
    if (!chosen) break;
    applyDraftPick(room, active, chosen);
    picked = true;
  }
  if (picked) io.to(room.code).emit("room_updated", room);
}

// ── Draft turn timer ── auto-picks for a CONNECTED player who sits idle on their turn, so a
// single AFK player can't freeze the whole draft. (Disconnected players are covered separately
// by autoPickDisconnected.) Kept off RoomState so the timer object is never serialized.
const draftTurnTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DRAFT_TURN_MS = 30 * 1000;

function clearDraftTurnTimer(code: string): void {
  const t = draftTurnTimers.get(code);
  if (t) { clearTimeout(t); draftTurnTimers.delete(code); }
}

// (Re)arm the idle-turn timer for whoever is on the clock. No-op when the draft is over or the
// active player is disconnected. Safe to call after any draft state change — it always resets.
function scheduleDraftTurnTimer(io: Server, room: RoomState): void {
  clearDraftTurnTimer(room.code);
  if (room.phase !== 'draft') return;
  const active = room.players.find(p => p.id === room.draftState.draftOrder[room.draftState.turnIndex]);
  if (!active || !active.connected) return;
  const timer = setTimeout(() => {
    draftTurnTimers.delete(room.code);
    const cur = rooms.get(room.code);
    if (!cur || cur.phase !== 'draft') return;
    const ds = cur.draftState;
    const a = cur.players.find(p => p.id === ds.draftOrder[ds.turnIndex]);
    if (!a) return;
    let options = ds.currentOptionsByPlayer[a.id];
    if (!options || options.length === 0) {
      options = generateDraftOptions(getNeededPositions(a.formationId, a.draftedPlayers), ds.alreadyDraftedIds);
      ds.currentOptionsByPlayer[a.id] = options;
    }
    if (options[0]) {
      applyDraftPick(cur, a, options[0]);
      io.to(cur.code).emit("room_updated", cur);
      autoPickDisconnected(io, cur);     // next player might be offline
      scheduleDraftTurnTimer(io, cur);   // arm for the new active player
    }
  }, DRAFT_TURN_MS);
  draftTurnTimers.set(room.code, timer);
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Create Room
    socket.on("create_room", ({ creatorName }) => {
      const roomCode = getUniqueRoomCode();
      const newRoom: RoomState = {
        code: roomCode,
        phase: 'lobby',
        difficulty: 'gold',
        hostId: 'player_0',
        players: [
          {
            socketId: socket.id,
            id: 'player_0',
            name: creatorName,
            coachId: 'guardiola',
            formationId: '4-3-3',
            playStyle: 'balanced',
            draftedPlayers: Array(11).fill(undefined),
            vetoesLeft: 2,
            captain: null,
            penaltyTaker: null,
            freeKickTaker: null,
            team: null,
            ready: false,
            connected: true,
            points: 0,
            lastMatchPoints: null,
            reinforcementOptions: null
          }
        ],
        botTeams: [],
        leagueFixtures: [],
        leagueStandings: [],
        leagueResults: [],
        leagueRound: 1,
        knockoutBracket: null,
        champion: null,
        watchedRoundPlayers: [],
        watchedKnockoutLegPlayers: [],
        draftState: {
          round: 1,
          turnIndex: 0,
          draftOrder: [],
          alreadyDraftedIds: [],
          history: [],
          currentOptionsByPlayer: {}
        }
      };

      rooms.set(roomCode, newRoom);
      socket.join(roomCode);
      socket.emit("room_created", { roomCode, roomState: newRoom });
      console.log(`Room created: ${roomCode} by ${creatorName}`);
    });

    // Join Room
    socket.on("join_room", ({ roomCode, playerName }) => {
      const code = roomCode.toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        socket.emit("error_message", "Sala não encontrada. Verifique o código.");
        return;
      }

      // Check if player name already exists (Reconnect Scenario)
      const existingPlayer = room.players.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase());
      if (existingPlayer) {
        // Only treat a name match as a RECONNECT if that player is actually offline. If they're
        // still connected, this is a different person with a clashing name — reject it, otherwise
        // they'd hijack the original player's seat (steal their socket/team).
        if (existingPlayer.connected) {
          socket.emit("error_message", "Já existe um jogador com esse nome nesta sala. Escolha outro nome.");
          return;
        }
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        cancelRoomCleanup(code);
        recomputeHost(room);
        socket.join(code);
        socket.emit("joined_room", { roomCode: code, player: existingPlayer, roomState: room });
        io.to(code).emit("room_updated", room);
        // A reconnected player may have been the one we were waiting on for a pick.
        if (room.phase === 'draft') { autoPickDisconnected(io, room); scheduleDraftTurnTimer(io, room); }
        console.log(`Player reconnected: ${playerName} to ${code}`);
        return;
      }

      if (room.phase !== 'lobby') {
        socket.emit("error_message", "A partida nesta sala já começou.");
        return;
      }

      if (room.players.length >= 8) {
        socket.emit("error_message", "A sala já está cheia (limite de 8 jogadores).");
        return;
      }

      const newPlayer: RoomPlayer = {
        socketId: socket.id,
        id: `player_${room.players.length}`,
        name: playerName.trim(),
        coachId: 'guardiola',
        formationId: '4-3-3',
        playStyle: 'balanced',
        draftedPlayers: Array(11).fill(undefined),
        vetoesLeft: 2,
        captain: null,
        penaltyTaker: null,
        freeKickTaker: null,
        team: null,
        ready: false,
        connected: true,
        points: 0,
        lastMatchPoints: null,
        reinforcementOptions: null
      };

      room.players.push(newPlayer);
      recomputeHost(room);
      socket.join(code);
      socket.emit("joined_room", { roomCode: code, player: newPlayer, roomState: room });
      io.to(code).emit("room_updated", room);
      console.log(`Player joined: ${playerName} to ${code}`);
    });

    // Host updates difficulty
    socket.on("set_difficulty", ({ roomCode, difficulty }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id)) return;
      room.difficulty = difficulty;
      io.to(roomCode).emit("room_updated", room);
    });

    // Host starts setup phase
    socket.on("start_setup", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id)) return;
      room.phase = 'setup';
      room.players.forEach(p => { p.ready = false; });
      io.to(roomCode).emit("room_updated", room);
    });

    // Player submits coach & formation
    socket.on("submit_setup", ({ roomCode, coachId, formationId }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.coachId = coachId;
      player.formationId = formationId;
      player.ready = true;

      // Check if all players have submitted setup
      const allReady = room.players.every(p => p.ready);
      if (allReady) {
        // Build Snake Draft Order for 11 rounds
        const numPlayers = room.players.length;
        const draftOrder: string[] = [];
        for (let round = 1; round <= 11; round++) {
          if (round % 2 !== 0) {
            for (let i = 0; i < numPlayers; i++) {
              draftOrder.push(room.players[i].id);
            }
          } else {
            for (let i = numPlayers - 1; i >= 0; i--) {
              draftOrder.push(room.players[i].id);
            }
          }
        }

        room.draftState = {
          round: 1,
          turnIndex: 0,
          draftOrder,
          alreadyDraftedIds: [],
          history: [],
          currentOptionsByPlayer: {}
        };
        room.phase = 'draft';
        room.players.forEach(p => { p.ready = false; });

        // Generate draft options for first turn
        const firstPlayerId = draftOrder[0];
        const firstPlayer = room.players.find(p => p.id === firstPlayerId)!;
        const needed = getNeededPositions(firstPlayer.formationId, firstPlayer.draftedPlayers);
        const options = generateDraftOptions(needed, []);
        room.draftState.currentOptionsByPlayer[firstPlayerId] = options;
      }

      io.to(roomCode).emit("room_updated", room);
      // If the draft just started on a disconnected player, don't stall.
      if (room.phase === 'draft') { autoPickDisconnected(io, room); scheduleDraftTurnTimer(io, room); }
    });

    // Player picks a card
    socket.on("draft_pick", ({ roomCode, playerId }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.draftState) return;

      const activePlayerId = room.draftState.draftOrder[room.draftState.turnIndex];
      const activePlayer = room.players.find(p => p.id === activePlayerId);
      if (!activePlayer) return;

      // Verify it is indeed their turn
      if (activePlayer.socketId !== socket.id) return;

      const options = room.draftState.currentOptionsByPlayer[activePlayerId] || [];
      const chosenPlayer = options.find(p => p.id === playerId);
      if (!chosenPlayer) return;

      applyDraftPick(room, activePlayer, chosenPlayer);
      io.to(roomCode).emit("room_updated", room);
      // If the turn landed on someone who has disconnected, keep the draft moving.
      autoPickDisconnected(io, room);
      scheduleDraftTurnTimer(io, room); // arm the idle timer for the new active player
    });

    // Player vetoes current draft options
    socket.on("draft_veto", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.draftState) return;

      const activePlayerId = room.draftState.draftOrder[room.draftState.turnIndex];
      const activePlayer = room.players.find(p => p.id === activePlayerId);
      if (!activePlayer) return;

      if (activePlayer.socketId !== socket.id || activePlayer.vetoesLeft <= 0) return;

      activePlayer.vetoesLeft -= 1;
      const needed = getNeededPositions(activePlayer.formationId, activePlayer.draftedPlayers);
      const options = generateDraftOptions(needed, room.draftState.alreadyDraftedIds);
      room.draftState.currentOptionsByPlayer[activePlayerId] = options;

      io.to(roomCode).emit("room_updated", room);
      scheduleDraftTurnTimer(io, room); // fresh time after a veto
    });

    // Player submits squad review (captain, penalty taker)
    socket.on("submit_squad_review", ({ roomCode, captain, penaltyTaker, freeKickTaker, draftedPlayers, playStyle, formationId }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.captain = captain;
      player.penaltyTaker = penaltyTaker;
      player.freeKickTaker = freeKickTaker ?? null;
      player.draftedPlayers = draftedPlayers;
      if (playStyle) player.playStyle = playStyle;
      if (formationId) player.formationId = formationId; // formation can be changed post-draft
      player.ready = true;

      // Start once every CONNECTED player is ready — a player who dropped during squad review
      // must not freeze the whole room forever. Their team is still built below from the lineup
      // the draft already completed for them.
      const allReady = room.players.every(p => p.ready || !p.connected);
      if (allReady) {
        // Build Team objects for all humans
        room.players.forEach(p => {
          const starters = p.draftedPlayers.slice(0, 11).filter((pl): pl is Player => pl !== undefined);
          const formation = FORMATIONS.find(f => f.id === p.formationId);
          const roles = formation?.positions.map(pos => pos.role) ?? [];
          const chemData = calculateChemistry(starters, p.coachId, roles, p.formationId);

          const playerCards: PlayerCard[] = p.draftedPlayers
            .filter((pl): pl is Player => pl !== undefined)
            .map(pl => {
              const idx = p.draftedPlayers.findIndex(dp => dp?.id === pl.id);
              const isOOP = idx !== -1 && idx < 11 ? (chemData.outOfPosition[pl.id] ?? false) : false;
              return {
                ...pl,
                chemistryScore: chemData.individual[pl.id] ?? 1,
                isOOP
              };
            });

          p.team = {
            id: p.id,
            name: p.name,
            coachId: p.coachId,
            formationId: p.formationId,
            playStyle: p.playStyle ?? 'balanced',
            players: playerCards,
            captain: p.captain ?? undefined,
            penaltyTaker: p.penaltyTaker ?? undefined,
            freeKickTaker: p.freeKickTaker ?? undefined,
            totalChemistry: chemData.total,
            isBot: false
          };
        });

        // Generate bot teams to reach 36 teams total
        const diffLevel = DIFFICULTY_LEVELS.find(d => d.id === room.difficulty);
        const botStrength = diffLevel?.botStrength ?? 0.72;

        const BOT_NAMES = [
          'Real Madrid', 'Manchester City', 'Bayern München', 'Paris Saint-Germain',
          'Liverpool FC', 'Inter de Milão', 'Arsenal FC', 'FC Barcelona',
          'Borussia Dortmund', 'Juventus FC', 'Atlético de Madrid', 'Bayer Leverkusen',
          'AC Milan', 'Benfica Glorioso', 'Sporting CP', 'FC Porto', 'Ajax Legends',
          'PSV Eindhoven', 'Feyenoord Roterdã', 'Aston Villa', 'Atalanta Bergamo',
          'AS Monaco', 'Lille OSC', 'VfB Stuttgart', 'Bologna FC', 'Girona FC',
          'Celtic FC', 'Club Brugge', 'Shakhtar Donetsk', 'Dinamo Zagreb',
          'RB Salzburg', 'Sparta Praga', 'Young Boys Bern', 'Estrela Vermelha',
          'Lazio Roma'
        ];

        const humanNames = room.players.map(p => p.team!.name.toLowerCase());
        const filteredBotNames = BOT_NAMES.filter(name => !humanNames.includes(name.toLowerCase()));
        const numBotsNeeded = 36 - room.players.length;
        const selectedBotNames = filteredBotNames.slice(0, numBotsNeeded);

        room.botTeams = selectedBotNames.map(name => generateBotTeam(name, botStrength));
        const allTeams = [...room.players.map(p => p.team!), ...room.botTeams];

        room.leagueFixtures = generateLeagueFixtures(allTeams);
        room.leagueStandings = computeStandings(allTeams, []);
        room.leagueRound = 1;
        room.phase = 'league';
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Player updates captain / penalty taker for their own team (pre-league and
    // between matches). Kept on the authoritative server team so the server-side
    // simulation uses the chosen penalty taker.
    socket.on("set_match_roles", ({ roomCode, captain, penaltyTaker, freeKickTaker, playStyle, formationId }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.captain = captain ?? null;
      player.penaltyTaker = penaltyTaker ?? null;
      player.freeKickTaker = freeKickTaker ?? null;
      if (playStyle) player.playStyle = playStyle;
      if (formationId) player.formationId = formationId;
      if (player.team) {
        player.team.captain = captain ?? undefined;
        player.team.penaltyTaker = penaltyTaker ?? undefined;
        player.team.freeKickTaker = freeKickTaker ?? undefined;
        if (playStyle) player.team.playStyle = playStyle;
        // Changing formation between matches re-maps roles → recompute chemistry / OOP
        // server-side so the authoritative simulation uses the new shape.
        if (formationId && player.team.formationId !== formationId) {
          player.team.formationId = formationId;
          const formation = FORMATIONS.find(f => f.id === formationId);
          const roles = formation?.positions.map(pos => pos.role) ?? [];
          const starters = player.team.players.slice(0, 11);
          const chemData = calculateChemistry(starters, player.team.coachId, roles, formationId);
          player.team.players = player.team.players.map((pl, idx) => ({
            ...pl,
            chemistryScore: chemData.individual[pl.id] ?? 1,
            isOOP: idx < 11 ? (chemData.outOfPosition[pl.id] ?? false) : false,
          }));
          player.team.totalChemistry = chemData.total;
        }
      }
      socket.emit("room_updated", room); // only this player's own lineup changed
    });

    // Swap two players in this player's squad (bench ↔ starter, or reorder the XI). Mirrors the
    // solo SWAP_PLAYER_TEAM: recompute chemistry/OOP and drop captain/taker roles that fell out
    // of the XI, so the authoritative simulation uses the new lineup.
    socket.on("swap_player_team", ({ roomCode, indexA, indexB }: { roomCode: string; indexA: number; indexB: number }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      const players = [...player.team.players];
      if (indexA < 0 || indexB < 0 || indexA >= players.length || indexB >= players.length || indexA === indexB) return;
      const tmp = players[indexA]; players[indexA] = players[indexB]; players[indexB] = tmp;

      const starters = players.slice(0, 11);
      let captain = player.team.captain;
      let penaltyTaker = player.team.penaltyTaker;
      let freeKickTaker = player.team.freeKickTaker;
      if (captain && !starters.some(p => p.id === captain)) captain = undefined;
      if (penaltyTaker && !starters.some(p => p.id === penaltyTaker)) penaltyTaker = undefined;
      if (freeKickTaker && !starters.some(p => p.id === freeKickTaker)) freeKickTaker = undefined;

      player.team = rebuildTeamChemistry({ ...player.team, players, captain, penaltyTaker, freeKickTaker });
      // Keep the RoomPlayer role fields in sync (they seed future set_match_roles / rebuilds).
      player.captain = captain ?? null;
      player.penaltyTaker = penaltyTaker ?? null;
      player.freeKickTaker = freeKickTaker ?? null;
      socket.emit("room_updated", room); // only this player's own team changed
    });

    // ============================================================
    // SHOP — spend points (earned per league match) on this player's own team.
    // Server is authoritative: it validates the cost, mutates the player's team and
    // re-broadcasts. The local client then sees the change + new balance via room_updated.
    // ============================================================
    socket.on("shop_change_coach", ({ roomCode, coachId }: { roomCode: string; coachId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      const cost = SHOP_COSTS.changeCoach;
      if (player.points < cost || player.team.coachId === coachId) return;
      player.points -= cost;
      player.coachId = coachId;
      player.team.coachId = coachId;
      player.team = rebuildTeamChemistry(player.team);
      socket.emit("room_updated", room); // only this player's own team changed
    });

    socket.on("shop_buy_player", ({ roomCode, player: chosen, kind }: { roomCode: string; player: Player; kind: 'star' | 'scout' }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || !chosen) return;
      const cost = kind === 'star' ? SHOP_COSTS.starPack : SHOP_COSTS.scout;
      if (player.points < cost) return;
      if (player.team.players.some(p => p.id === chosen.id)) return;          // no duplicates
      if (kind === 'star' && chosen.overall < 88) return;                     // star pack is 88+
      player.points -= cost;
      const card: PlayerCard = { ...chosen, chemistryScore: 0, isOOP: false };
      player.team.players = [...player.team.players, card];
      socket.emit("room_updated", room); // only this player's own bench changed
    });

    socket.on("shop_turbinar", ({ roomCode, playerId, variant }: { roomCode: string; playerId: string; variant: ShopVariant }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      const cost = SHOP_COSTS.turbinar;
      const target = player.team.players.find(p => p.id === playerId);
      if (!target || player.points < cost) return;
      if (target.inForm || target.lobo || target.coringa || target.nomade || target.pilar) return; // one per card
      player.points -= cost;
      player.team.players = player.team.players.map(p =>
        p.id === playerId ? ({ ...applyShopVariant(p, variant), chemistryScore: p.chemistryScore, isOOP: p.isOOP } as PlayerCard) : p);
      player.team = rebuildTeamChemistry(player.team);
      socket.emit("room_updated", room); // only this player's own team changed
    });

    socket.on("shop_train", ({ roomCode, playerId, attr }: { roomCode: string; playerId: string; attr: TrainAttr }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      const target = player.team.players.find(p => p.id === playerId);
      if (!target) return;
      const cost = trainCost(target.trainCount ?? 0);
      if (player.points < cost) return;
      player.points -= cost;
      player.team.players = player.team.players.map(p => {
        if (p.id !== playerId) return p;
        const boosts = { ...(p.trainBoosts ?? {}) };
        boosts[attr] = (boosts[attr] ?? 0) + TRAIN_BOOST;
        return { ...p, trainBoosts: boosts, trainCount: (p.trainCount ?? 0) + 1 };
      });
      socket.emit("room_updated", room); // only this player's own team changed
    });

    // End-of-round reinforcement (free pick, same as solo): 1 of 6 → bench.
    socket.on("pick_reinforcement", ({ roomCode, player: chosen }: { roomCode: string; player: Player }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || !chosen) return;
      // Must be one of the offered options and not already owned.
      if (player.reinforcementOptions?.some(o => o.id === chosen.id) && !player.team.players.some(p => p.id === chosen.id)) {
        const card: PlayerCard = { ...chosen, chemistryScore: 0, isOOP: false };
        player.team.players = [...player.team.players, card];
      }
      player.reinforcementOptions = null;
      socket.emit("room_updated", room); // only this player's own bench changed
    });

    socket.on("dismiss_reinforcement", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      player.reinforcementOptions = null;
      socket.emit("room_updated", room); // only this player's own state changed
    });

    // ============================================================
    // LEAGUE — server-authoritative, host-driven round progression
    // ============================================================

    // Host triggers the whole round: the SERVER simulates every fixture of the
    // current round at once (single source of truth) so the scores/data are
    // identical on every device. Each human then watches their own match as a
    // deterministic replay of the result the server produced here.
    socket.on("play_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'league') return;
      if (!isHost(room, socket.id)) return;

      const allHumanTeams = room.players.map(p => p.team!).filter(Boolean);
      const allTeams = [...allHumanTeams, ...room.botTeams];

      let simulatedAny = false;
      room.leagueFixtures = room.leagueFixtures.map(f => {
        if (f.round === room.leagueRound && !f.played) {
          const home = allTeams.find(t => t.id === f.homeTeamId);
          const away = allTeams.find(t => t.id === f.awayTeamId);
          if (!home || !away) return f;
          const result = simulateMatch(home, away);
          room.leagueResults.push(result);
          simulatedAny = true;
          return { ...f, played: true, result };
        }
        return f;
      });

      if (simulatedAny) {
        room.leagueStandings = computeStandings(allTeams, room.leagueFixtures.filter(f => f.played));
        // Reset watch confirmations so the new round requires fresh confirmation
        room.watchedRoundPlayers = [];
        // Award shop points + offer the end-of-round reinforcement to each human (same as solo).
        room.players.forEach(p => {
          if (!p.team) return;
          const fixture = room.leagueFixtures.find(f =>
            f.round === room.leagueRound && f.result &&
            (f.homeTeamId === p.team!.id || f.awayTeamId === p.team!.id));
          if (fixture?.result) {
            const mp = computeMatchPoints(fixture.result, p.team.id);
            p.points += mp.total;
            p.lastMatchPoints = mp;
          }
          const ownedIds = p.team.players.map(pl => pl.id);
          p.reinforcementOptions = generateDraftOptions([], ownedIds);
        });
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Host advances to the next round (or to the knockout) — only allowed once
    // the entire current round has been played.
    socket.on("advance_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'league') return;
      if (!isHost(room, socket.id)) return;

      const roundFixtures = room.leagueFixtures.filter(f => f.round === room.leagueRound);
      const allPlayed = roundFixtures.length > 0 && roundFixtures.every(f => f.played);
      if (!allPlayed) return;

      // Block advancement until every CONNECTED human with a match this round has watched
      // (a player who left/disconnected must not freeze the host).
      const playersWithFixture = room.players.filter(p =>
        p.connected && roundFixtures.some(f => f.homeTeamId === p.id || f.awayTeamId === p.id)
      );
      const allWatched = playersWithFixture.every(p => room.watchedRoundPlayers.includes(p.id));
      if (!allWatched) {
        const waiting = playersWithFixture
          .filter(p => !room.watchedRoundPlayers.includes(p.id))
          .map(p => p.name);
        socket.emit("advance_blocked", { waiting });
        return;
      }

      if (room.leagueRound < 8) {
        room.leagueRound += 1;
      } else {
        // End of league phase! Build the full UCL knockout bracket
        // (play-offs → R16 → quarters → semis → final).
        room.phase = 'knockout';
        room.knockoutBracket = createKnockoutBracket(room.leagueStandings);
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // ============================================================
    // KNOCKOUT — server-authoritative, host-driven round progression
    // ============================================================

    // Host triggers the whole knockout round: the SERVER simulates every match
    // of the active bracket round. The bracket does NOT progress yet so that
    // each human can watch their tie before the next round is drawn.
    socket.on("play_knockout_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'knockout' || !room.knockoutBracket) return;
      if (!isHost(room, socket.id)) return;

      // About to play the SECOND leg (volta)? Gate it just like advancing: every
      // human must have watched the FIRST leg (ida) first. Without this the host
      // could fire the volta immediately, spoiling the ida score for everyone.
      if (room.knockoutBracket.currentLeg === 2) {
        const { allWatched, waiting } = knockoutWatchStatus(room);
        if (!allWatched) {
          socket.emit("advance_blocked", { waiting });
          return;
        }
      }

      const allHumanTeams = room.players.map(p => p.team!).filter(Boolean);
      const allTeams = [...allHumanTeams, ...room.botTeams];
      const resolve = (id: string) => allTeams.find(t => t.id === id);

      // Plays the current leg (ida or volta) of every tie in the active round.
      // Knockout results live in the bracket only — they are NOT pushed into
      // leagueResults (season stats read the legs directly from the bracket).
      playActiveKnockoutLeg(room.knockoutBracket, resolve);
      // Reset watch confirmations for this new leg
      room.watchedKnockoutLegPlayers = [];

      io.to(roomCode).emit("room_updated", room);
    });

    // Host advances the bracket — only once the active round has been played.
    socket.on("advance_knockout_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'knockout' || !room.knockoutBracket) return;
      if (!isHost(room, socket.id)) return;

      // Block until all human players who are in the current knockout round have
      // confirmed watching the leg just played (the volta).
      const { allWatched, waiting } = knockoutWatchStatus(room);
      if (!allWatched) {
        socket.emit("advance_blocked", { waiting });
        return;
      }

      const champion = advanceKnockoutBracket(room.knockoutBracket);
      if (champion) {
        room.champion = champion;
        room.phase = 'report';
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Player confirms they finished watching their match replay for the current round/leg.
    // The host cannot advance until all human players who have a match have confirmed.
    socket.on("player_match_watched", ({ roomCode, type }: { roomCode: string; type: 'league' | 'knockout' }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      if (type === 'league') {
        if (!room.watchedRoundPlayers.includes(player.id)) {
          room.watchedRoundPlayers.push(player.id);
        }
      } else {
        if (!room.watchedKnockoutLegPlayers.includes(player.id)) {
          room.watchedKnockoutLegPlayers.push(player.id);
        }
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Restart game in room (host only — otherwise any player could wipe progress)
    socket.on("restart_room", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id)) return;

      clearDraftTurnTimer(roomCode);
      room.phase = 'lobby';
      room.players.forEach(p => {
        p.draftedPlayers = Array(11).fill(undefined);
        p.vetoesLeft = 2;
        p.captain = null;
        p.penaltyTaker = null;
        p.freeKickTaker = null;
        p.playStyle = 'balanced';
        p.team = null;
        p.ready = false;
        p.points = 0;
        p.lastMatchPoints = null;
        p.reinforcementOptions = null;
      });
      room.botTeams = [];
      room.leagueFixtures = [];
      room.leagueStandings = [];
      room.leagueResults = [];
      room.leagueRound = 1;
      room.knockoutBracket = null;
      room.champion = null;
      room.watchedRoundPlayers = [];
      room.watchedKnockoutLegPlayers = [];
      room.draftState = {
        round: 1,
        turnIndex: 0,
        draftOrder: [],
        alreadyDraftedIds: [],
        history: [],
        currentOptionsByPlayer: {}
      };

      io.to(roomCode).emit("room_updated", room);
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Find rooms where player was present
      rooms.forEach((room: RoomState, code: string) => {
        const idx = room.players.findIndex((p: RoomPlayer) => p.socketId === socket.id);
        if (idx === -1) return;
        console.log(`Player ${room.players[idx].name} disconnected from room ${code}`);

        if (room.phase === 'lobby') {
          // In the lobby we fully remove the player (the seat is freed).
          room.players.splice(idx, 1);
          if (room.players.length === 0) {
            cancelRoomCleanup(code);
            clearDraftTurnTimer(code);
            rooms.delete(code);
            console.log(`Room ${code} deleted (empty)`);
            return;
          }
          recomputeHost(room);
          io.to(code).emit("room_updated", room);
          return;
        }

        // Mid-game: keep the player (so they can reconnect by name) but mark them
        // offline. Transfer host to the next connected player, keep the draft
        // moving if it was their turn, and schedule cleanup if everyone has left.
        room.players[idx].connected = false;
        recomputeHost(room);
        io.to(code).emit("room_updated", room);
        if (room.phase === 'draft') { autoPickDisconnected(io, room); scheduleDraftTurnTimer(io, room); }
        scheduleRoomCleanupIfEmpty(room);
      });
    });
  });
}
