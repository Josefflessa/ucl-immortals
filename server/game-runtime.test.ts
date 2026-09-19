import { describe, expect, it } from 'vitest';
import { createGameRuntime, registerSocketHandlers, runWithGameRuntime } from './handlers';
import type { RealtimeEventHandler, RealtimeServer, RealtimeSocket } from './realtime';

class FakeServer implements RealtimeServer {
  private connectionHandler: ((socket: RealtimeSocket) => void) | undefined;
  readonly sockets = {
    adapter: { rooms: new Map<string, Set<string>>() },
    sockets: new Map<string, RealtimeSocket>(),
  };

  on(_event: 'connection', handler: (socket: RealtimeSocket) => void): void {
    this.connectionHandler = handler;
  }

  to(roomCode: string) {
    return {
      emit: (event: string, payload?: unknown) => {
        Array.from(this.sockets.adapter.rooms.get(roomCode) ?? []).forEach((socketId) => {
          this.sockets.sockets.get(socketId)?.emit(event, payload);
        });
      },
    };
  }

  connect(socket: FakeSocket): void {
    this.sockets.sockets.set(socket.id, socket);
    this.connectionHandler?.(socket);
  }

  join(socketId: string, roomCode: string): void {
    const members = this.sockets.adapter.rooms.get(roomCode) ?? new Set<string>();
    members.add(socketId);
    this.sockets.adapter.rooms.set(roomCode, members);
  }
}

class FakeSocket implements RealtimeSocket {
  readonly sent: Array<{ event: string; payload?: unknown }> = [];
  private readonly handlers = new Map<string, RealtimeEventHandler>();

  constructor(readonly id: string, private readonly server: FakeServer) {}

  on(event: string, handler: RealtimeEventHandler): void {
    this.handlers.set(event, handler);
  }

  emit(event: string, payload?: unknown): void {
    this.sent.push({ event, payload });
  }

  join(roomCode: string): void {
    this.server.join(this.id, roomCode);
  }

  receive(event: string, payload?: unknown): void {
    this.handlers.get(event)?.(payload);
  }
}

describe('game runtime isolation', () => {
  it('keeps Durable Object room state isolated while reusing the server rules', () => {
    const runtimeA = createGameRuntime({ roomCode: 'ABCD' });
    const runtimeB = createGameRuntime({ roomCode: 'WXYZ' });
    const serverA = new FakeServer();
    const serverB = new FakeServer();
    const hostA = new FakeSocket('socket-a', serverA);
    const hostB = new FakeSocket('socket-b', serverB);

    registerSocketHandlers(serverA);
    registerSocketHandlers(serverB);
    runWithGameRuntime(runtimeA, () => serverA.connect(hostA));
    runWithGameRuntime(runtimeB, () => serverB.connect(hostB));

    runWithGameRuntime(runtimeA, () => hostA.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice',
    }));
    runWithGameRuntime(runtimeB, () => hostB.receive('create_room', {
      roomCode: 'WXYZ', creatorName: 'Bruno', difficulty: 'gold', clientId: 'bruno',
    }));

    expect(runtimeA.rooms.get('ABCD')?.players[0].name).toBe('Alice');
    expect(runtimeB.rooms.get('WXYZ')?.players[0].name).toBe('Bruno');
    expect(runtimeA.rooms.has('WXYZ')).toBe(false);
    expect(runtimeB.rooms.has('ABCD')).toBe(false);
    expect(hostA.sent.find(message => message.event === 'room_created')).toBeTruthy();
    expect(hostB.sent.find(message => message.event === 'room_created')).toBeTruthy();
  });

  it('publishes a newer authoritative revision when a player joins', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const host = new FakeSocket('socket-host', server);
    const guest = new FakeSocket('socket-guest', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(host));

    runWithGameRuntime(runtime, () => host.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice',
    }));
    expect(runtime.rooms.get('ABCD')?.stateRevision).toBe(1);

    runWithGameRuntime(runtime, () => {
      server.connect(guest);
      guest.receive('join_room', { roomCode: 'ABCD', playerName: 'Bruno', clientId: 'bruno' });
    });

    expect(runtime.rooms.get('ABCD')?.stateRevision).toBe(2);
    const joined = guest.sent.find(message => message.event === 'joined_room');
    expect((joined?.payload as any)?.roomState.stateRevision).toBe(2);
  });

  it('does not expose another player\'s reconnection credential or private state', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const host = new FakeSocket('socket-host', server);
    const guest = new FakeSocket('socket-guest', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(host));

    runWithGameRuntime(runtime, () => host.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice-secret',
    }));
    runWithGameRuntime(runtime, () => {
      server.connect(guest);
      guest.receive('join_room', { roomCode: 'ABCD', playerName: 'Bruno', clientId: 'bruno-secret' });
    });

    const guestViewAtHost = host.sent
      .filter(message => message.event === 'room_updated')
      .at(-1)?.payload as any;
    const guestInHostView = guestViewAtHost.players.find((player: any) => player.name === 'Bruno');
    expect(guestInHostView.clientId).toBeUndefined();
    expect(guestInHostView.bets).toEqual([]);
    expect(guestInHostView.pendingPack).toBeNull();

    const joinedPayload = guest.sent.find(message => message.event === 'joined_room')?.payload as any;
    const ownView = joinedPayload.roomState.players.find((player: any) => player.name === 'Bruno');
    expect(ownView.clientId).toBe('bruno-secret');
  });

  it('rejects empty or oversized player names before creating a room', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const socket = new FakeSocket('socket-host', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(socket));

    runWithGameRuntime(runtime, () => socket.receive('create_room', {
      roomCode: 'ABCD', creatorName: '   ', difficulty: 'gold', clientId: 'alice',
    }));
    expect(runtime.rooms.size).toBe(0);
    expect(socket.sent.find(message => message.event === 'action_error')).toBeTruthy();
  });

  it('applies a command only once when the client retries after a lost response', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const host = new FakeSocket('socket-host', server);
    const guest = new FakeSocket('socket-guest', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(host));

    runWithGameRuntime(runtime, () => host.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice',
    }));
    runWithGameRuntime(runtime, () => {
      server.connect(guest);
      guest.receive('join_room', { roomCode: 'ABCD', playerName: 'Bruno', clientId: 'bruno' });
    });
    runWithGameRuntime(runtime, () => host.receive('start_setup', { roomCode: 'ABCD' }));

    const commandId = 'setup-command-1';
    runWithGameRuntime(runtime, () => host.receive('submit_setup', {
      roomCode: 'ABCD', coachId: 'guardiola', formationId: '4-3-3', commandId,
    }));
    runWithGameRuntime(runtime, () => host.receive('submit_setup', {
      roomCode: 'ABCD', coachId: 'klopp', formationId: '4-2-3-1', commandId,
    }));

    const room = runtime.rooms.get('ABCD')!;
    expect(room.players[0].coachId).toBe('guardiola');
    expect(room.players[0].formationId).toBe('4-3-3');
    expect(room.commandReceipts).toHaveLength(1);
    expect(host.sent.some(message => (
      message.event === 'command_ack'
      && (message.payload as any)?.commandId === commandId
      && (message.payload as any)?.status === 'already_applied'
    ))).toBe(true);

    const guestView = guest.sent.filter(message => message.event === 'room_updated').at(-1)?.payload as any;
    expect(guestView.commandReceipts).toBeUndefined();
    expect(guestView.lastCheckpoint).toBeUndefined();
  });

  it('rejects a queued command from the previous match after a room restart', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const host = new FakeSocket('socket-host', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(host));

    runWithGameRuntime(runtime, () => host.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice',
    }));
    runWithGameRuntime(runtime, () => host.receive('restart_room', {
      roomCode: 'ABCD', commandId: 'restart-1', roomEpoch: 1,
    }));
    expect(runtime.rooms.get('ABCD')?.roomEpoch).toBe(2);

    runWithGameRuntime(runtime, () => host.receive('start_setup', {
      roomCode: 'ABCD', commandId: 'old-start', roomEpoch: 1,
    }));

    expect(runtime.rooms.get('ABCD')?.phase).toBe('lobby');
    expect(host.sent.some(message => (
      message.event === 'command_ack'
      && (message.payload as any)?.commandId === 'old-start'
      && (message.payload as any)?.reason === 'stale_room_epoch'
    ))).toBe(true);
  });

  it('transfers the host immediately when the current host leaves the lobby', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const host = new FakeSocket('socket-host', server);
    const guest = new FakeSocket('socket-guest', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(host));
    runWithGameRuntime(runtime, () => host.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice',
    }));
    runWithGameRuntime(runtime, () => {
      server.connect(guest);
      guest.receive('join_room', { roomCode: 'ABCD', playerName: 'Bruno', clientId: 'bruno' });
    });

    runWithGameRuntime(runtime, () => host.receive('leave_room', {
      roomCode: 'ABCD', commandId: 'leave-lobby-1', roomEpoch: 1,
    }));

    const room = runtime.rooms.get('ABCD')!;
    expect(room.hostId).toBe('player_1');
    expect(room.players.map(player => player.name)).toEqual(['Bruno']);
    expect(host.sent.some(message => message.event === 'room_left')).toBe(true);
    const guestUpdate = guest.sent.filter(message => message.event === 'room_updated').at(-1)?.payload as any;
    expect(guestUpdate.hostId).toBe('player_1');
  });

  it('transfers the host immediately while preserving an active player seat', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const host = new FakeSocket('socket-host', server);
    const guest = new FakeSocket('socket-guest', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(host));
    runWithGameRuntime(runtime, () => host.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice',
    }));
    runWithGameRuntime(runtime, () => {
      server.connect(guest);
      guest.receive('join_room', { roomCode: 'ABCD', playerName: 'Bruno', clientId: 'bruno' });
    });
    runtime.rooms.get('ABCD')!.phase = 'league';
    const hostPlayer = runtime.rooms.get('ABCD')!.players[0];
    hostPlayer.team = { id: 'team-a', name: 'Alice FC', players: [] } as any;
    hostPlayer.reinforcementOptions = [{ id: 'offline-reinforcement', shortName: 'Carta offline' } as any];

    runWithGameRuntime(runtime, () => host.receive('leave_room', {
      roomCode: 'ABCD', commandId: 'leave-active-1', roomEpoch: 1,
    }));

    const room = runtime.rooms.get('ABCD')!;
    expect(room.hostId).toBe('player_1');
    expect(room.players).toHaveLength(2);
    expect(room.players[0].connected).toBe(false);
    expect(room.players[1].connected).toBe(true);
    expect(room.players[0].team?.players).toHaveLength(1);
    expect(room.players[0].team?.players[0].id).toBe('offline-reinforcement');
    expect(room.players[0].reinforcementOptions).toBeNull();
    expect(host.sent.some(message => message.event === 'room_left')).toBe(true);
  });

  it('closes the room for every connected client when the host confirms it', () => {
    const runtime = createGameRuntime({ roomCode: 'ABCD' });
    const server = new FakeServer();
    const host = new FakeSocket('socket-host', server);
    const guest = new FakeSocket('socket-guest', server);
    registerSocketHandlers(server);
    runWithGameRuntime(runtime, () => server.connect(host));
    runWithGameRuntime(runtime, () => host.receive('create_room', {
      roomCode: 'ABCD', creatorName: 'Alice', difficulty: 'gold', clientId: 'alice',
    }));
    runWithGameRuntime(runtime, () => {
      server.connect(guest);
      guest.receive('join_room', { roomCode: 'ABCD', playerName: 'Bruno', clientId: 'bruno' });
    });

    runWithGameRuntime(runtime, () => host.receive('close_room', {
      roomCode: 'ABCD', commandId: 'close-1', roomEpoch: 1,
    }));

    expect(runtime.rooms.has('ABCD')).toBe(false);
    expect(host.sent.some(message => message.event === 'room_closed')).toBe(true);
    expect(guest.sent.some(message => message.event === 'room_closed')).toBe(true);
  });
});
