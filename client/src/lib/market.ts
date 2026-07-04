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
