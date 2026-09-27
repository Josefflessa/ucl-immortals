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

// 🔄 Troca direta (P2P) — um jogador do banco por outro, com créditos opcionais pra equilibrar.
// Sem escrow: os dois jogadores continuam nos elencos originais enquanto a proposta está pendente;
// o servidor revalida tudo (posição no banco, créditos disponíveis) só no momento do ACEITE.
export interface TradeOffer {
  id: string;             // id único da proposta
  fromPlayerId: string;   // RoomPlayer.id de quem propôs
  fromPlayerName: string;
  toPlayerId: string;     // RoomPlayer.id de quem recebeu a proposta
  toPlayerName: string;
  offeredPlayer: Player;   // jogador do banco de quem propôs
  requestedPlayer: Player; // jogador do banco de quem recebeu a proposta
  /** Créditos extras pra equilibrar a troca. Positivo = quem propôs paga; negativo = quem propôs pede. */
  creditsDelta: number;
}
