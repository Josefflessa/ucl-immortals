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
  Team,
  PlayerCard,
  MatchResult,
  LeagueFixture,
  StandingsEntry,
  KnockoutBracket
} from "../client/src/lib/gameEngine.js";

import { FORMATIONS, DIFFICULTY_LEVELS, Player } from "../client/src/lib/gameData.js";

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
  team: Team | null;
  ready: boolean;
  connected: boolean;
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
  const humanIdsInRound = room.players
    .filter(p => currentMatches.some((m: any) => m.homeTeamId === p.id || m.awayTeamId === p.id))
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
            team: null,
            ready: false,
            connected: true
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
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        cancelRoomCleanup(code);
        recomputeHost(room);
        socket.join(code);
        socket.emit("joined_room", { roomCode: code, player: existingPlayer, roomState: room });
        io.to(code).emit("room_updated", room);
        // A reconnected player may have been the one we were waiting on for a pick.
        if (room.phase === 'draft') autoPickDisconnected(io, room);
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
        team: null,
        ready: false,
        connected: true
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
      if (room.phase === 'draft') autoPickDisconnected(io, room);
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
    });

    // Player submits squad review (captain, penalty taker)
    socket.on("submit_squad_review", ({ roomCode, captain, penaltyTaker, draftedPlayers, playStyle }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.captain = captain;
      player.penaltyTaker = penaltyTaker;
      player.draftedPlayers = draftedPlayers;
      if (playStyle) player.playStyle = playStyle;
      player.ready = true;

      // Check if all players are ready
      const allReady = room.players.every(p => p.ready);
      if (allReady) {
        // Build Team objects for all humans
        room.players.forEach(p => {
          const starters = p.draftedPlayers.slice(0, 11).filter((pl): pl is Player => pl !== undefined);
          const formation = FORMATIONS.find(f => f.id === p.formationId);
          const roles = formation?.positions.map(pos => pos.role) ?? [];
          const chemData = calculateChemistry(starters, p.coachId, roles);

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
    socket.on("set_match_roles", ({ roomCode, captain, penaltyTaker, playStyle }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.captain = captain ?? null;
      player.penaltyTaker = penaltyTaker ?? null;
      if (playStyle) player.playStyle = playStyle;
      if (player.team) {
        player.team.captain = captain ?? undefined;
        player.team.penaltyTaker = penaltyTaker ?? undefined;
        if (playStyle) player.team.playStyle = playStyle;
      }
      io.to(roomCode).emit("room_updated", room);
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

      // Block advancement until every human player who has a match this round has confirmed watching
      const playersWithFixture = room.players.filter(p =>
        roundFixtures.some(f => f.homeTeamId === p.id || f.awayTeamId === p.id)
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

      room.phase = 'lobby';
      room.players.forEach(p => {
        p.draftedPlayers = Array(11).fill(undefined);
        p.vetoesLeft = 2;
        p.captain = null;
        p.penaltyTaker = null;
        p.playStyle = 'balanced';
        p.team = null;
        p.ready = false;
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
        if (room.phase === 'draft') autoPickDisconnected(io, room);
        scheduleRoomCleanupIfEmpty(room);
      });
    });
  });
}
