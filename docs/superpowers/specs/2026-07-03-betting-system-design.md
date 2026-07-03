# Sistema de Palpite (apostas de pontos em partidas) — Design

**Data:** 2026-07-03
**Status:** aprovado (design) — aguardando revisão da spec antes do plano.

## 1. Visão geral

Um sistema **opcional** de apostas de pontos ("palpite") sobre o resultado das partidas.
O jogador chuta o **placar** de qualquer jogo da rodada e arrisca uma quantia dos seus
pontos de loja. Acertar paga um múltiplo do valor apostado. Vale no **solo** e no **online**.

Princípios inegociáveis (pedidos explicitamente):
- **Sem odds na tela** → nada pode revelar o favorito de um confronto específico. Os
  múltiplos são fixos e iguais pra todo jogo.
- **Anti-spoiler rígido:** o resultado do palpite (acertou/errou) **e o crédito dos pontos
  ganhos** só aparecem no **exato momento em que o placar é revelado** ao jogador — nunca antes.
  O saldo NÃO pode subir antes da revelação (o pulo do número entregaria o resultado).

## 2. Mecânica

- Botão **🎯 Palpitar** no card de cada partida (qualquer jogo da rodada — o próprio e os
  dos outros/bots).
- O slip pede: um **placar** (gols casa / gols fora, steppers de 0 a `BET_MAX_GOALS` = 15) e
  um **valor** (stake).
- Liquidação (pagamento escalonado sobre UM palpite de placar):
  - **Placar exato** → recebe `stake × BET_EXACT_MULT` (**2.5×**).
  - **Só o resultado certo** (V/E/D correto, placar errado) → recebe `stake × BET_OUTCOME_MULT` (**1.5×**).
  - **Resultado errado** → perde o stake.
- Um palpite por partida. Enquanto a rodada não trava, dá pra **editar** ou **cancelar**
  (cancelar devolve o escrow).

### Constantes (fáceis de ajustar, em `client/src/lib/bets.ts`)
```
BET_OUTCOME_MULT = 1.5   // acertar V/E/D
BET_EXACT_MULT   = 2.5   // acertar o placar exato
BET_ROUND_CAP    = 200   // teto de stake TOTAL por rodada
BET_MAX_GOALS    = 15     // teto do stepper de placar (0..15 por lado) — só pra sanidade da UI
```

## 3. Escrow (stake sai na hora)

Ao confirmar o palpite, o stake é **debitado imediatamente** dos pontos (padrão idêntico ao
fix "cobrar ao abrir o pacote"). Isso impede apostar 100 e gastar os mesmos 100 na loja antes
da liquidação. Debitar na aposta **não revela nada** (o jogador escolheu apostar).

- Ganhou → credita `stake × mult` **no momento da revelação** (§5).
- Perdeu → nada (o stake já saiu).
- Cancelou antes da trava → devolve o stake.

## 4. Teto por rodada

A soma dos stakes de todos os palpites **em aberto/feitos na rodada** ≤ `BET_ROUND_CAP`.
O slip mostra "restante da rodada: X". Cancelar um palpite libera o valor de volta pro teto.

## 5. Timing, trava e **crédito diferido = revelação**

Este é o coração do requisito anti-spoiler. Separar SEMPRE dois momentos:
1. **Liquidação (cálculo):** assim que a partida é simulada, computa-se `won/tier/payout` de
   cada palpite e marca-se `settled`, **sem creditar pontos e sem exibir**.
2. **Revelação (crédito + exibição):** no exato momento em que o placar fica visível pro
   jogador, credita-se o `payout` aos pontos e mostra-se o badge do palpite. Marca `revealed`.

### Solo
- **Aposta/edição:** na tela de confrontos, antes do **JOGAR RODADA**.
- **Trava:** ao apertar JOGAR.
- **Liquidação + Revelação juntas:** dentro do `FINISH_LEAGUE_MATCH` (reducer). No solo não há
  gate: quando a partida termina, os resultados (o seu, assistido ao vivo, e os dos bots) são
  revelados de uma vez → liquida e credita ali mesmo. `settled` e `revealed` no mesmo passo.

### Online
- **Aposta/edição:** enquanto a rodada não começou (host não apertou JOGAR RODADA).
- **Trava:** quando o host dispara `play_round`.
- **Liquidação (sem crédito):** dentro do `play_round` (handlers.ts), logo após simular a
  rodada — calcula `won/tier/payout` de cada palpite e marca `settled`, **sem somar em `points`**.
- **Revelação (crédito):** no `player_match_watched`, quando a rodada passa a `allWatched`
  (todos assistiram = mesmo instante em que `hideRoundScore` libera os placares). Aí sim soma
  os `payout` em `p.points`, marca `revealed`, e emite `room_updated`.

### Fix incluído: spoiler dos PONTOS DA PARTIDA no online
Hoje o `play_round` **credita `computeMatchPoints` na simulação** (handlers.ts:904) e sincroniza
`p.points` na hora — o saldo pula ANTES do jogador assistir, vazando o resultado. Este sistema
**corrige isso junto**, pela mesma regra: nada que revele resultado entra no saldo antes da
revelação.
- No `play_round`: em vez de `p.points += mp.total`, guarda o valor em
  **`p.pendingMatchPoints`** (novo campo) e computa `p.lastMatchPoints` já como pendente (não
  exibir antes da revelação). `reinforcementOptions` pode continuar sendo gerado ali (são
  jogadores aleatórios; não revelam o placar).
- No gate `allWatched` (`player_match_watched`): credita **`pendingMatchPoints` + payouts dos
  palpites** em `p.points` de uma vez, marca palpites `revealed`, libera `lastMatchPoints` pra
  exibição, limpa `pendingMatchPoints`, e emite `room_updated`. Guardar idempotência (creditar
  uma vez só) limpando o pendente após creditar.
- **Solo não muda** — já revela tudo no `FINISH_LEAGUE_MATCH` (não há gate).

## 6. Modelo de dados

```ts
// client/src/lib/bets.ts
export interface Bet {
  matchKey: string;      // id estável da partida (ver §6.1)
  homeGoals: number;     // placar palpitado (perspectiva mando da partida)
  awayGoals: number;
  stake: number;
  settled?: boolean;     // resultado já calculado (não exibir ainda)
  revealed?: boolean;    // creditado + exibido (pós-anti-spoiler)
  won?: boolean;
  tier?: 'exact' | 'outcome' | 'miss';
  payout?: number;       // quanto foi/será creditado (0 se miss)
}
```

- **Solo:** `bets: Bet[]` em `GameState`.
- **Online:** `bets: Bet[]` em `RoomPlayer` (autoritativo no servidor); sincronizado no
  `SET_ONLINE_STATE` como os `points`/`reinforcementRerolls`.
- **Online (fix do spoiler):** `pendingMatchPoints?: number` em `RoomPlayer` — pontos da
  partida calculados na simulação mas **não creditados** até o gate de revelação. Também
  sincronizado (o cliente NÃO deve somá-lo ao saldo exibido; ele só existe pra creditar no
  reveal). `lastMatchPoints` só é exibido após a revelação.

### 6.1 `matchKey`
Identificador estável e determinístico da partida, pra casar palpite ↔ resultado:
- **Liga:** `L{round}:{homeTeamId}-{awayTeamId}` (o fixture da rodada tem mando fixo).
- **Mata-mata (Fase 2):** `K{matchId}:{leg}` (cada perna é uma partida com placar próprio).

## 7. Ações / eventos

### Solo (reducer `GameContext`)
- `PLACE_BET { matchKey, homeGoals, awayGoals, stake }` — valida fundos + teto + rodada não
  jogada; debita escrow; upsert do palpite (substitui se já existir pra aquele `matchKey`,
  ajustando o escrow pela diferença).
- `CANCEL_BET { matchKey }` — devolve o escrow, remove o palpite (só antes da trava).
- Liquidação/revelação embutidas no `FINISH_LEAGUE_MATCH` (não é ação separada).

### Online (server `handlers.ts`)
- `place_bet { roomCode, matchKey, homeGoals, awayGoals, stake }` — valida no servidor
  (fundos, teto, `phase==='league'`, rodada da fixture ainda não jogada); debita escrow;
  upsert; `room_updated` só pro autor (não vaza pros outros).
- `cancel_bet { roomCode, matchKey }` — devolve escrow; remove; `room_updated` pro autor.
- Liquidação no `play_round`; crédito/revelação no `player_match_watched` (quando `allWatched`).

## 8. Liquidação — helper puro (`bets.ts`, testável)

```ts
export function settleBet(bet: Bet, result: { homeGoals: number; awayGoals: number }):
  { won: boolean; tier: 'exact'|'outcome'|'miss'; payout: number } {
  const exact = bet.homeGoals === result.homeGoals && bet.awayGoals === result.awayGoals;
  const sign  = (h: number, a: number) => Math.sign(h - a); // 1/0/-1
  const outcomeRight = sign(bet.homeGoals, bet.awayGoals) === sign(result.homeGoals, result.awayGoals);
  if (exact)        return { won: true,  tier: 'exact',   payout: Math.round(bet.stake * BET_EXACT_MULT) };
  if (outcomeRight) return { won: true,  tier: 'outcome', payout: Math.round(bet.stake * BET_OUTCOME_MULT) };
  return { won: false, tier: 'miss', payout: 0 };
}
```
- O `result` é sempre orientado ao **mando da partida daquele palpite** (o `matchKey` fixa
  qual time é casa). Pra pernas de volta do mata-mata, usa-se o `homeTeamId/awayTeamId` do
  próprio `result` da perna (que já vêm invertidos corretamente).

## 9. UI

- **Botão 🎯 Palpitar** nos cards de partida não jogada (aba de confrontos da liga; Fase 2:
  cards de perna do mata-mata). Se já há palpite: mostra o placar palpitado + valor, com opção
  de **editar/cancelar** até a trava.
- **Slip (modal pequeno):** steppers de placar (casa/fora), campo de stake com "restante da
  rodada: X" e o saldo, e os dois níveis de prêmio como **info fixa** (1.5× resultado · 2.5×
  placar) — sem odds por confronto. Botões Confirmar / Cancelar.
- **Pós-revelação:** badge no card — `✅ Palpite: acertou o placar (+X)` / `✅ acertou o
  resultado (+X)` / `❌ palpite perdido (−stake)`. Antes da revelação: `🎯 palpite em
  andamento` (sem placar, sem valor de resultado).
- **Trava anti-spoiler:** o badge de resultado e o crédito só aparecem quando o placar do jogo
  também aparece (mesma condição de `hideRoundScore`/assistido).

## 10. Escopo / fases

- **Fase 1 — Liga (solo + online):** sistema completo (mecânica, escrow, teto, timing,
  crédito diferido, UI, testes) **+ o fix do spoiler dos pontos da partida no online** (§5).
  É onde o card e o fluxo de rodada já existem.
- **Fase 2 — Mata-mata (mesma mecânica):** palpite por **perna** (ida/volta), `matchKey`
  `K{matchId}:{leg}`; trava/liquida quando a perna é jogada; crédito no gate de "todos
  assistiram a perna" (`watchedKnockoutLegPlayers`). Reusa `settleBet` e a UI do slip.

**Fora de escopo (YAGNI):** combos/múltiplas, aposta ao vivo, mudar palpite depois da trava,
apostar em estatística individual (gols de jogador).

## 11. Testes

- `bets.test.ts` (determinístico): `settleBet` cobre exact / outcome-only / miss em placares
  variados (incl. empates e mando invertido); arredondamento do payout.
- Reducer solo: `PLACE_BET` debita e respeita o teto; `CANCEL_BET` devolve; `FINISH_LEAGUE_MATCH`
  liquida + credita corretamente; ultrapassar o teto é rejeitado; escrow não permite saldo negativo.
- Regra anti-spoiler: garantir que `payout` só entra em `points` no passo de revelação
  (solo: FINISH; online: all-watched), nunca na liquidação.
- Fix online: após `play_round`, `p.points` NÃO muda e `pendingMatchPoints` guarda o valor;
  no all-watched, `points` recebe `pendingMatchPoints` + payouts exatamente uma vez (idempotente).

## 12. Verificação

- `cd client && npx tsc --noEmit`; na raiz `npm run build`; `npx vitest run` (bets + regressões).
- Manual solo: palpitar em vários jogos, respeitar teto, jogar rodada, conferir crédito só na
  revelação e badges corretos.
- Manual online (2 abas): apostar antes do host iniciar; trava ao iniciar; nenhum saldo/badge
  muda antes de todos assistirem; crédito e badges aparecem juntos quando libera.
