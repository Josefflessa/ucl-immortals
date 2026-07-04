# Mercado — Fase 2: mercado online entre jogadores — Design

**Data:** 2026-07-04
**Status:** Aprovado
**Fase:** 2 de 2 (Fase 1 = venda solo, já implementada. Esta = mercado online entre humanos.)

## Objetivo

No online, um jogador **anuncia uma reserva sua por um preço** e outros jogadores **compram**
(transferência de jogador + pontos). Dá profundidade estratégica e "drama de mercado" à liga entre
amigos.

## Decisões (com o usuário)

- **Escrow:** anunciar **tira o jogador do banco do vendedor** e coloca no mercado. Cancelar
  devolve; comprar move pro banco do comprador. → Mercado fica aberto sempre, **sem trava por
  rodada** e sem corrida de "joguei com quem foi vendido".
- **Só reservas** (índice ≥ 11) podem ser anunciadas. Pra vender um titular, mande-o pro banco no
  MEU TIME antes. XI sempre intacto.
- **Preço:** livre, com **piso = `sellValue(player.rarity)`** (a tabela da Fase 1: bronze 30 …
  única 400). Não dá pra "dar" o craque por 1 ponto; acima do piso é livre.
- **Moeda:** os mesmos `points` da loja.
- **Disciplina** do transferido é **limpa** (comprador recebe zerado).

## Arquitetura

Segue o padrão online existente: estado no `RoomState`, ações via `socket.on(...)` que mutam o
room e dão `io.to(room.code).emit("room_updated", room)` (broadcast), e o cliente espelha via
`SET_ONLINE_STATE`. Tipos compartilhados vivem em `client/src/lib/*` e o servidor os importa (como
`Bet` em `bets.ts`).

## Componentes

### `client/src/lib/market.ts` (criar)
```ts
import { Player } from './gameData';
import { sellValue } from './shop';

export interface MarketListing {
  id: string;          // id único do anúncio
  sellerId: string;    // RoomPlayer.id do vendedor
  sellerName: string;  // nome do vendedor (exibição)
  player: Player;      // jogador em escrow
  price: number;       // preço pedido (≥ piso)
}

// Piso de preço = valor "pra banca" da raridade (reaproveita a Fase 1).
export function marketMinPrice(player: Player): number {
  return sellValue(player.rarity);
}
```

> **Ajuste pós-design (a pedido do usuário):** o Mercado tem **duas sub-abas**: **VENDER** (venda
> pra banca por valor fixo `sellValue` — ativa no **solo E no online**) e **ANUNCIAR** (mercado P2P
> entre jogadores — só no **online**). Isso adiciona um handler `market_sell` no servidor (venda pra
> banca no online, espelhando o `SELL_PLAYER` solo) e um emit `marketSellOnline`.

### `server/handlers.ts` (modificar)
- `RoomState.market: MarketListing[]` (import de `../client/src/lib/market.js`). Inicializar `[]`
  em toda criação de room (onde `botTeams`/`discipline` são inicializados).
- Contador de id de anúncio no escopo do módulo: `let marketSeq = 0;` → id = `m${++marketSeq}`
  (evita `Math.random`; simples e único no processo).
- **`socket.on("market_list", ({ roomCode, playerId, price }))`**:
  - `room` existe; `seller = players.find(socketId===socket.id)`; `seller.team` existe.
  - `idx = seller.team.players.findIndex(id===playerId)`; **`idx < 11` → return** (só reserva).
  - `player = seller.team.players[idx]`; `price >= marketMinPrice(player)` senão return.
  - Escrow: remove do `seller.team.players`; `delete room.discipline[`${seller.team.id}:${playerId}`]`.
  - `room.market.push({ id:`m${++marketSeq}`, sellerId: seller.id, sellerName: seller.name, player, price })`.
  - `io.to(room.code).emit("room_updated", room)`.
- **`socket.on("market_cancel", ({ roomCode, listingId }))`**:
  - `seller = players.find(socketId===socket.id)`; `li = room.market.find(id===listingId)`;
    `li && li.sellerId === seller.id && seller.team` senão return.
  - `seller.team.players.push(li.player)`; `room.market = room.market.filter(l => l.id !== listingId)`.
  - broadcast.
- **`socket.on("market_buy", ({ roomCode, listingId }))`**:
  - `buyer = players.find(socketId===socket.id)`; `li = room.market.find(id===listingId)`.
  - Validar: `li`, `buyer.team`, `buyer.id !== li.sellerId`, `buyer.points >= li.price`,
    `!buyer.team.players.some(p => p.id === li.player.id)` (dedup). Qualquer falha → return.
  - `seller = players.find(id===li.sellerId)` (pode ter saído; se não achar, ainda transfere o
    jogador e debita o comprador — os pontos do vendedor ausente se perdem? Não: **se o vendedor
    não existe mais, aborta** (return) pra não sumir pontos). Então exigir `seller` presente.
  - Transação: `buyer.points -= li.price`; `seller.points += li.price`;
    `buyer.team.players.push(li.player)`; `room.market = room.market.filter(l => l.id !== listingId)`.
  - broadcast.

### `client/src/contexts/GameContext.tsx` (modificar)
- `GameState.onlineMarket: MarketListing[]` (novo campo; init `[]`).
- `SET_ONLINE_STATE`: `onlineMarket: roomState.market ?? []` (campo de room, igual `discipline`).
- Três emits (useCallback, padrão dos `*Online`):
  - `marketListOnline(playerId: string, price: number)` → emit `"market_list"`.
  - `marketCancelOnline(listingId: string)` → emit `"market_cancel"`.
  - `marketBuyOnline(listingId: string)` → emit `"market_buy"`.
  - Adicionar ao tipo do contexto e ao `value` do provider.

### `client/src/components/game/MarketTab.tsx` (modificar)
- A aba passa a aparecer **também no online** (ver LeaguePage abaixo). Branch por `state.mode`:
  - **Solo:** exatamente como a Fase 1 (venda pra banca) — sem mudança.
  - **Online:**
    - Saldo no topo (`💰 {points}`).
    - **"MEU BANCO — anuncie":** `playerTeam.players.slice(11)` (reservas), cada uma com botão
      **Anunciar** → modal define o preço (input numérico, default e mínimo = `marketMinPrice`),
      Confirmar → `marketListOnline(playerId, price)`.
    - **"À VENDA":** `state.onlineMarket`. Para cada anúncio:
      - Se `sellerId === meuId` → card + preço + **Cancelar** (`marketCancelOnline(id)`).
      - Senão → card + `sellerName` + preço + **Comprar** (`marketBuyOnline(id)`), **desabilitado**
        se `points < price` ou se já tenho o jogador (`playerTeam.players.some(id)`).
      - "meuId" = id do RoomPlayer local (`state.onlinePlayers.find(p => p.team?.id === playerTeam.id)?.id`
        ou o campo que identifica o jogador local — usar o mesmo critério já usado no LeaguePage).
    - Vazio (sem anúncios): "Nenhum jogador à venda."

### `client/src/pages/LeaguePage.tsx` (modificar)
- Hoje a aba `market` só entra no array de tabs no solo (`state.mode !== 'online'`). **Remover esse
  gate** → a aba 🏪 MERCADO aparece nos dois modos. (O render `activeTab === 'market' && <MarketTab/>`
  já existe.)

## Fluxo (compra)

```
MarketTab (online) → Comprar → marketBuyOnline(listingId)
socket "market_buy" → valida (saldo, dedup, dono≠comprador, vendedor presente)
  → comprador.points -= price · vendedor.points += price
  → jogador → banco do comprador · remove anúncio
  → io.to(room).emit("room_updated") → todos re-sincronizam (SET_ONLINE_STATE)
```

## Edge cases

- **Corrida de compra:** Node é single-thread; a 1ª compra remove o anúncio, a 2ª não o acha → no-op.
- **Vendedor desconectou:** anúncios continuam; comprar exige o vendedor presente na sala (`seller`
  encontrado) — se saiu da sala, a compra aborta (não some pontos).
- **Dedup:** não compra jogador que já está no seu elenco; não compra o próprio anúncio.
- **Preço < piso:** rejeitado no servidor (e o input do modal já força o mínimo).
- **Fim da sala:** `room.market` vai junto (nada persiste fora do room).

## Testes

- `marketMinPrice(player)` (`market.test.ts`): retorna `sellValue(rarity)` por raridade.
- Regras/transação dos handlers: verificadas por typecheck + build + teste manual em 2 abas
  (padrão do repo — não há testes de handler de servidor). Manual: anunciar (sai do banco), ver na
  outra aba, comprar (pontos e jogador trocam de mãos, anúncio some), cancelar (volta pro banco),
  bloqueios (saldo, dono, dedup, preço < piso).

## Fora de escopo

- Contra-ofertas/leilão, histórico de transferências, taxa de mercado, notificações push. (Se
  quiser depois, spec própria.)
