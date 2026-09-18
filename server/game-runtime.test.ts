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
});
