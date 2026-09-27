// UCL Immortals — Mercado online (Fase 2): tipos + regra de preço compartilhados cliente/servidor.
// (O servidor importa daqui, como faz com bets.ts.)
import { Player } from './gameData';
import { sellValue } from './shop';

export interface MarketListing {
  id: string;          // id único do anúncio
  sellerId: string;    // RoomPlayer.id do vendedor
  sellerName: string;  // nome do vendedor (exibição)
  player: Player;      // jogador em escrow (fora do elenco enquanto anunciado)
  price: number;       // preço pedido (≥ piso)
}

// Piso de preço = valor "pra banca" da raridade (reaproveita a Fase 1). Não dá pra dar de graça.
export function marketMinPrice(player: Player): number {
  return sellValue(player.rarity);
}

// 🔄 Troca direta (P2P) — fluxo em duas etapas:
//   1) CONVITE: A convida B (só escolhe a pessoa, sem escolher jogador ainda). B recebe um
//      pop-up e pode aceitar ou recusar.
//   2) NEGOCIAÇÃO: se B aceitar, os dois entram numa "sala" compartilhada onde cada lado
//      escolhe (e pode trocar de ideia) um ou mais jogadores do PRÓPRIO banco + créditos
//      opcionais pra oferecer, vendo a escolha do outro em tempo real. Os dois lados precisam
//      oferecer a mesma quantidade de jogadores; quando marcam "Pronto", o servidor revalida
//      tudo e executa a troca atomicamente.
// Sem escrow: os jogadores continuam nos elencos originais até a execução. Cada jogador só
// pode estar em UMA sessão (convite ou negociação) por vez.
export type TradeSessionStatus = 'invite' | 'negotiating';

export interface TradeSessionSide {
  playerIds: string[];      // jogadores do PRÓPRIO banco que esse lado está oferecendo
  /** Compatibilidade com sessões antigas e consumidores que exibem o primeiro jogador. */
  playerId: string | null;
  creditsDelta: number;     // créditos que esse lado adiciona à oferta (sempre ≥ 0)
  ready: boolean;           // marcou "Pronto" com a escolha atual
}

export function emptyTradeSide(): TradeSessionSide {
  return { playerIds: [], playerId: null, creditsDelta: 0, ready: false };
}

export interface TradeSession {
  id: string;
  hostId: string;    // RoomPlayer.id de quem convidou
  hostName: string;
  guestId: string;   // RoomPlayer.id de quem foi convidado
  guestName: string;
  status: TradeSessionStatus;
  host: TradeSessionSide;
  guest: TradeSessionSide;
}
