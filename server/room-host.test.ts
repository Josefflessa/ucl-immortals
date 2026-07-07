import { describe, it, expect } from 'vitest';
import { pickHostId } from './room-host';

// Host = quem controla a progressão. A regra deve ser ESTÁVEL: o host não pode
// "pular" pra outro jogador quando o dono cai um instante (bug do playoff).
describe('pickHostId (host estável)', () => {
  it('mantém o host atual enquanto ele está na sala, mesmo desconectado', () => {
    const players = [
      { id: 'player_0', connected: false }, // host caiu um instante
      { id: 'player_1', connected: true },
    ];
    // NÃO deve transferir pro player_1 só porque o host está offline no momento.
    expect(pickHostId(players, 'player_0')).toBe('player_0');
  });

  it('transfere quando o host atual não está mais na sala (saiu de vez)', () => {
    const players = [
      { id: 'player_1', connected: true },
      { id: 'player_2', connected: true },
    ];
    expect(pickHostId(players, 'player_0')).toBe('player_1');
  });

  it('sem host válido, escolhe o primeiro CONECTADO', () => {
    const players = [
      { id: 'player_0', connected: false },
      { id: 'player_1', connected: true },
    ];
    expect(pickHostId(players, '')).toBe('player_1');
  });

  it('cai pro primeiro jogador se ninguém está conectado', () => {
    const players = [
      { id: 'player_0', connected: false },
      { id: 'player_1', connected: false },
    ];
    expect(pickHostId(players, '')).toBe('player_0');
  });

  it('sala vazia → host vazio', () => {
    expect(pickHostId([], 'player_0')).toBe('');
  });
});
