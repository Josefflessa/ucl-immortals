// Lógica pura de quem é o host da sala — sem dependência de socket, pra ser testável.
// O host controla a progressão (jogar/avançar rodada). A regra é ESTÁVEL: o host só
// muda quando o dono atual sai da sala de verdade — NÃO quando cai um instante. Isso
// evita o host "pular" pra outro jogador numa queda transitória de conexão.

export interface HostCandidate {
  id: string;
  connected: boolean;
  kicked?: boolean;
}

// Devolve o hostId que a sala deve ter.
// - Se o host atual ainda está na sala (mesmo offline no momento) → mantém (sticky).
// - Senão → primeiro conectado; se ninguém conectado, primeiro da lista; sala vazia → ''.
export function pickHostId(players: HostCandidate[], currentHostId: string): string {
  if (players.some(p => p.id === currentHostId && !p.kicked)) return currentHostId;
  const eligible = players.filter(player => !player.kicked);
  const firstConnected = eligible.find(p => p.connected);
  return (firstConnected ?? eligible[0])?.id ?? '';
}
