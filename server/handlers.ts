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
  draftedPlayers: (Player | undefined)[];
  vetoesLeft: number;
  captain: string | null;
  penaltyTaker: string | null;
  team: Team | null;
  ready: boolean;
}

interface RoomState {
  code: string;
  phase: 'lobby' | 'setup' | 'draft' | 'squad_review' | 'league' | 'knockout' | 'report';
  difficulty: string;
  players: RoomPlayer[];
  botTeams: Team[];
  leagueFixtures: LeagueFixture[];
  leagueStandings: StandingsEntry[];
  leagueResults: MatchResult[];
  leagueRound: number;
  knockoutBracket: KnockoutBracket | null;
  champion: string | null;
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
        players: [
          {
            socketId: socket.id,
            id: 'player_0',
            name: creatorName,
            coachId: 'guardiola',
            formationId: '4-3-3',
            draftedPlayers: Array(11).fill(undefined),
            vetoesLeft: 2,
            captain: null,
            penaltyTaker: null,
            team: null,
            ready: false
          }
        ],
        botTeams: [],
        leagueFixtures: [],
        leagueStandings: [],
        leagueResults: [],
        leagueRound: 1,
        knockoutBracket: null,
        champion: null,
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
        socket.join(code);
        socket.emit("joined_room", { roomCode: code, player: existingPlayer, roomState: room });
        io.to(code).emit("room_updated", room);
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
        draftedPlayers: Array(11).fill(undefined),
        vetoesLeft: 2,
        captain: null,
        penaltyTaker: null,
        team: null,
        ready: false
      };

      room.players.push(newPlayer);
      socket.join(code);
      socket.emit("joined_room", { roomCode: code, player: newPlayer, roomState: room });
      io.to(code).emit("room_updated", room);
      console.log(`Player joined: ${playerName} to ${code}`);
    });

    // Host updates difficulty
    socket.on("set_difficulty", ({ roomCode, difficulty }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.difficulty = difficulty;
      io.to(roomCode).emit("room_updated", room);
    });

    // Host starts setup phase
    socket.on("start_setup", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
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
    });

    // Player picks a card
    socket.on("draft_pick", ({ roomCode, playerId }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.draftState) return;

      const activePlayerId = room.draftState.draftOrder[room.draftState.turnIndex];
      const activePlayer = room.players.find(p => p.id === activePlayerId)!;

      // Verify it is indeed their turn
      if (activePlayer.socketId !== socket.id) return;

      const options = room.draftState.currentOptionsByPlayer[activePlayerId] || [];
      const chosenPlayer = options.find(p => p.id === playerId);
      if (!chosenPlayer) return;

      // Add to player drafted list
      const currentRound = room.draftState.round;
      const newDrafted = [...activePlayer.draftedPlayers];
      const formation = FORMATIONS.find(f => f.id === activePlayer.formationId);
      const roles = formation?.positions.map(p => p.role) ?? [];

      let targetIndex = roles.findIndex((role, idx) =>
        role === chosenPlayer.position && newDrafted[idx] === undefined
      );

      if (targetIndex === -1 && chosenPlayer.secondaryPositions) {
        targetIndex = roles.findIndex((role, idx) =>
          chosenPlayer.secondaryPositions!.includes(role) && newDrafted[idx] === undefined
        );
      }

      if (targetIndex === -1) {
        targetIndex = newDrafted.findIndex(p => p === undefined);
      }

      if (targetIndex === -1) {
        targetIndex = currentRound - 1;
      }

      newDrafted[targetIndex] = chosenPlayer;
      activePlayer.draftedPlayers = newDrafted;

      // Update global draft state
      room.draftState.alreadyDraftedIds.push(chosenPlayer.id);
      room.draftState.history.push({
        round: currentRound,
        teamName: activePlayer.name,
        playerName: chosenPlayer.shortName,
        position: chosenPlayer.position,
        overall: chosenPlayer.overall
      });

      const nextTurnIndex = room.draftState.turnIndex + 1;
      if (nextTurnIndex >= room.draftState.draftOrder.length) {
        // Draft finished! Move to squad review phase
        room.phase = 'squad_review';
        room.players.forEach(p => { p.ready = false; });
      } else {
        room.draftState.turnIndex = nextTurnIndex;
        room.draftState.round = Math.floor(nextTurnIndex / room.players.length) + 1;

        // Generate options for the next player
        const nextPlayerId = room.draftState.draftOrder[nextTurnIndex];
        const nextPlayer = room.players.find(p => p.id === nextPlayerId)!;
        const nextNeeded = getNeededPositions(nextPlayer.formationId, nextPlayer.draftedPlayers);
        const nextOptions = generateDraftOptions(nextNeeded, room.draftState.alreadyDraftedIds);
        room.draftState.currentOptionsByPlayer[nextPlayerId] = nextOptions;
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Player vetoes current draft options
    socket.on("draft_veto", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.draftState) return;

      const activePlayerId = room.draftState.draftOrder[room.draftState.turnIndex];
      const activePlayer = room.players.find(p => p.id === activePlayerId)!;

      if (activePlayer.socketId !== socket.id || activePlayer.vetoesLeft <= 0) return;

      activePlayer.vetoesLeft -= 1;
      const needed = getNeededPositions(activePlayer.formationId, activePlayer.draftedPlayers);
      const options = generateDraftOptions(needed, room.draftState.alreadyDraftedIds);
      room.draftState.currentOptionsByPlayer[activePlayerId] = options;

      io.to(roomCode).emit("room_updated", room);
    });

    // Player submits squad review (captain, penalty taker)
    socket.on("submit_squad_review", ({ roomCode, captain, penaltyTaker, draftedPlayers }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.captain = captain;
      player.penaltyTaker = penaltyTaker;
      player.draftedPlayers = draftedPlayers;
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
            playStyle: 'balanced',
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

    // Multiplayer Match stream events: Match Host relays simulation events to Away player
    socket.on("match_event_stream", ({ roomCode, eventType, data }) => {
      // Relay match events (momentum, minute, goals, matchFinished) to all players in the room
      socket.to(roomCode).emit("match_event_relayed", { eventType, data });
    });

    // Match finished (Human vs Bot or Human vs Human host)
    socket.on("submit_match_result", ({ roomCode, result }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      // Avoid double saving identical match results
      const alreadySaved = room.leagueResults.some(
        r => r.homeTeamId === result.homeTeamId && r.awayTeamId === result.awayTeamId && r.homeGoals === result.homeGoals && r.awayGoals === result.awayGoals
      );

      if (!alreadySaved) {
        room.leagueResults.push(result);
        
        // Mark fixture as played in state
        room.leagueFixtures = room.leagueFixtures.map(f => {
          if (f.round === room.leagueRound && f.homeTeamId === result.homeTeamId && f.awayTeamId === result.awayTeamId) {
            return { ...f, played: true, result };
          }
          return f;
        });

        const allHumanTeams = room.players.map(p => p.team!).filter(Boolean);
        const allTeams = [...allHumanTeams, ...room.botTeams];
        room.leagueStandings = computeStandings(allTeams, room.leagueFixtures.filter(f => f.played));
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Host simulates bot-vs-bot matches and advances round
    socket.on("advance_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const allHumanTeams = room.players.map(p => p.team!).filter(Boolean);
      const allTeams = [...allHumanTeams, ...room.botTeams];

      // Simulate bot vs bot fixtures of this round
      room.leagueFixtures = room.leagueFixtures.map(f => {
        if (f.round === room.leagueRound && !f.played) {
          const isHomeBot = room.botTeams.some(t => t.id === f.homeTeamId);
          const isAwayBot = room.botTeams.some(t => t.id === f.awayTeamId);
          if (isHomeBot && isAwayBot) {
            const home = allTeams.find(t => t.id === f.homeTeamId)!;
            const away = allTeams.find(t => t.id === f.awayTeamId)!;
            const result = simulateMatch(home, away);
            return { ...f, played: true, result };
          }
        }
        return f;
      });

      // Recalculate standings
      room.leagueStandings = computeStandings(allTeams, room.leagueFixtures.filter(f => f.played));

      if (room.leagueRound < 8) {
        room.leagueRound += 1;
      } else {
        // End of league phase! Advance to Knockout!
        room.phase = 'knockout';
        
        // Build Round of 8 (top 8 teams)
        const top8 = room.leagueStandings.slice(0, 8);
        const qfMatches = [];
        for (let i = 0; i < 4; i++) {
          const homeTeam = top8[i];
          const awayTeam = top8[7 - i];
          qfMatches.push({
            id: `qf_${i}`,
            homeTeamId: homeTeam.teamId,
            awayTeamId: awayTeam.teamId,
            played: false,
          });
        }

        room.knockoutBracket = {
          round16: [],
          quarterFinals: qfMatches,
          semiFinals: [],
          final: null,
          currentRound: 'quarters',
        };
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Knockout Match Finished
    socket.on("submit_knockout_result", ({ roomCode, matchId, round, result }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.knockoutBracket) return;

      const bracket = room.knockoutBracket;
      let matchList: any[];

      if (round === 'quarters') matchList = bracket.quarterFinals;
      else if (round === 'semis') matchList = bracket.semiFinals;
      else matchList = [bracket.final!];

      const match = matchList.find(m => m.id === matchId);
      if (!match) return;

      // Update match result
      match.result = result;
      match.played = true;

      // Save match results to aggregate stats
      room.leagueResults.push(result);

      const allHumanTeams = room.players.map(p => p.team!).filter(Boolean);
      const allTeams = [...allHumanTeams, ...room.botTeams];

      // Auto-simulate any bot vs bot matches in the active bracket round
      for (const m of matchList) {
        if (!m.played) {
          const isHomeBot = room.botTeams.some(t => t.id === m.homeTeamId);
          const isAwayBot = room.botTeams.some(t => t.id === m.awayTeamId);
          if (isHomeBot && isAwayBot) {
            const home = allTeams.find(t => t.id === m.homeTeamId)!;
            const away = allTeams.find(t => t.id === m.awayTeamId)!;
            const res = simulateMatch(home, away, true, round === 'final');
            m.result = res;
            m.played = true;
            room.leagueResults.push(res);
          }
        }
      }

      // Check if all matches in the active bracket round are played
      const allPlayed = matchList.every(m => m.played);
      if (allPlayed) {
        const winners = matchList.map(m => m.result!.winner!);

        if (round === 'quarters') {
          bracket.semiFinals = [
            { id: 'sf_0', homeTeamId: winners[0], awayTeamId: winners[1], played: false },
            { id: 'sf_1', homeTeamId: winners[2], awayTeamId: winners[3], played: false },
          ];
          bracket.currentRound = 'semis';
        } else if (round === 'semis') {
          bracket.final = {
            id: 'final',
            homeTeamId: winners[0],
            awayTeamId: winners[1],
            played: false,
          };
          bracket.currentRound = 'final';
        } else if (round === 'final') {
          room.champion = result.winner!;
          room.phase = 'report';
        }
      }

      io.to(roomCode).emit("room_updated", room);
    });

    // Restart game in room
    socket.on("restart_room", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.phase = 'lobby';
      room.players.forEach(p => {
        p.draftedPlayers = Array(11).fill(undefined);
        p.vetoesLeft = 2;
        p.captain = null;
        p.penaltyTaker = null;
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
        if (idx !== -1) {
          console.log(`Player ${room.players[idx].name} disconnected from room ${code}`);
          if (room.phase === 'lobby') {
            // Remove player if still in lobby
            room.players.splice(idx, 1);
            if (room.players.length === 0) {
              rooms.delete(code);
              console.log(`Room ${code} deleted (empty)`);
            } else {
              io.to(code).emit("room_updated", room);
            }
          } else {
            // Keep player in room so they can reconnect during draft or gameplay
          }
        }
      });
    });
  });
}
