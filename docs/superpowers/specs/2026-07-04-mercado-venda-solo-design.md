# Mercado — Fase 1: venda solo — Design

**Data:** 2026-07-04
**Status:** Aprovado
**Fase:** 1 de 2 (esta spec = venda solo por pontos. Fase 2 = mercado online entre jogadores, spec própria.)

## Problema / objetivo

O jogo tem uma economia de `points` (moeda da loja: ganha por partida, gasta em turbinar/pack/
fisio/carta única, faixa 120-700) e um **banco que acumula jogadores extras** (1 reforço grátis
por rodada + 2 reservas do draft). Falta um jeito de **transformar reservas indesejadas em
pontos**. Esta fase adiciona a **venda solo**: uma aba "Mercado" onde o jogador vende reservas.

O mercado **online entre jogadores** (anunciar um jogador por um preço, outro compra) é a **Fase
2** — subsistema maior (estado no servidor, compra atômica, sync, timing por rodada, anti-conluio)
e terá spec própria. Esta aba já é desenhada pra ser a casa dele depois.

## Decisões tomadas (com o usuário)

- **Só reservas** (índice ≥ 11) podem ser vendidas. Pra vender um titular, mande-o pro banco antes
  (aba MEU TIME). Nunca quebra o XI.
- **Valor de venda por raridade** (função pura, fácil de calibrar):

  | Raridade | Valor |
  |---|---|
  | bronze | 30 |
  | prata (silver) | 60 |
  | ouro (gold) | 100 |
  | lendário (legendary) | 180 |
  | imortal (immortal) | 250 |
  | única (unique) | 400 |

  (Referência de economia: vitória rende ~100-150 pts; reforço é grátis 1/rodada. Valores
  calibrados pra recompensar sem virar farm — vender troca profundidade de banco por pontos, o que
  é uma decisão real com cartão/lesão em jogo.)
- **Confirmação obrigatória** antes de vender (modal, mesmo padrão da fisioterapia): mostra o
  jogador, o valor e "Vender por X?" com Cancelar/Confirmar. Nada de vender num clique só.
- **UI:** aba "Mercado" nova no hub (não um botão solto).
- **Online nesta fase:** a aba Mercado fica **oculta no modo online** até a Fase 2 (evita
  meia-feature no multiplayer).

## Componentes

### `client/src/lib/shop.ts` (modificar)
- Adicionar `SELL_VALUES: Record<string, number>` (por raridade, a tabela acima) e
  `sellValue(player: Player): number` → `SELL_VALUES[player.rarity] ?? SELL_VALUES.bronze`.
- Pura e testável, ao lado de `SHOP_COSTS`/`computeMatchPoints`.

### `client/src/contexts/GameContext.tsx` (modificar)
- Nova action `SELL_PLAYER { playerId: string }`. Reducer (solo):
  - Guard: `state.mode !== 'online'`, `state.playerTeam` existe.
  - Acha o índice do jogador em `playerTeam.players`. **Bloqueia se índice < 11** (titular) ou não
    encontrado → retorna `state` inalterado.
  - `points += sellValue(player)`.
  - Remove o jogador de `playerTeam.players`.
  - Limpa a entrada de disciplina: `discipline` sem a chave `${playerTeam.id}:${playerId}`.
  - Retorna o novo state (banco não afeta química, então não precisa `rebuildTeamChemistry`; mas se
    o jogador removido era capitão/batedor — impossível, pois é reserva — não há o que ajustar).

### `client/src/components/game/MarketTab.tsx` (criar)
- Componente fino (padrão do `LeagueSquadTab`): lê `state.playerTeam`, dispara `SELL_PLAYER`.
- Layout:
  - Cabeçalho: título "🏪 MERCADO" + saldo `💰 {points}`.
  - Subtítulo curto: "Venda reservas que não quer mais. (Pra vender um titular, mande pro banco no
    MEU TIME.)"
  - Grid das **reservas** (`playerTeam.players.slice(11)`), cada uma com `<PlayerCard compact lite/>`
    + o valor (`sellValue`) + botão "Vender · {valor}".
  - Clicar em vender → abre **modal de confirmação** (jogador + valor + Cancelar/Confirmar).
    Confirmar → `dispatch({ type: 'SELL_PLAYER', playerId })`.
  - Estado vazio (sem reservas): "Sem reservas pra vender — seus reforços e picks de banco aparecem
    aqui."

### `client/src/pages/LeaguePage.tsx` (modificar)
- `activeTab` union ganha `'market'`.
- Adicionar o botão de aba **🏪 MERCADO** na lista de tabs — **apenas no modo solo** (`state.mode
  !== 'online'`), ao lado de MEU TIME / LOJA.
- Renderizar `{activeTab === 'market' && <MarketTab />}` (padrão do `activeTab === 'squad'`).

## Fluxo de dados

```
MarketTab (solo)
  → mostra reservas (players.slice(11)) + sellValue(player)
  → clica "Vender" → modal confirma
  → dispatch SELL_PLAYER { playerId }
GameContext SELL_PLAYER (solo)
  → valida (reserva, solo)
  → points += sellValue · remove do elenco · limpa discipline
  → playerTeam atualizado
```

## Erros / edge cases

- Vender titular (índice < 11): bloqueado no reducer (defesa) e a UI só oferece reservas.
- Jogador inexistente: reducer retorna state inalterado.
- Online: aba não aparece; se `SELL_PLAYER` for disparado no online (não deveria), o guard
  `mode !== 'online'` barra.
- Banco vazio: MarketTab mostra estado vazio.

## Testes

- **Unidade `sellValue`** (`shop.test.ts` ou similar): cada raridade → valor da tabela; raridade
  desconhecida → fallback bronze (30).
- **Reducer `SELL_PLAYER`**: (a) vender reserva credita o valor certo e remove do elenco;
  (b) tentar vender titular (índice < 11) não muda nada; (c) a entrada de disciplina do vendido é
  removida.

## Fora de escopo (Fase 2 — mercado online)

Anunciar um jogador por um preço no online, outros comprarem, transferência de pontos+jogador,
estado de mercado no servidor, sync ao vivo, timing (quando negocia / quando resolve vs rodada),
guarda de elenco ≥ 11, disciplina do transferido, e anti-conluio/sabotagem. Spec própria.
