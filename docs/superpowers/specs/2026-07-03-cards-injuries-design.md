# Cartões, Suspensões e Lesões — Design

**Data:** 2026-07-03
**Status:** aprovado (design) — aguardando revisão da spec antes do plano.

## 1. Visão geral

Sistema profundo de **disciplina e lesões** que dá peso real ao banco e à rotação de elenco.
Cartões (🟨🟥), suspensões e lesões (🩹) valem para **todos os times** (jogador, humanos
online e bots). As consequências **carregam entre partidas**, forçando o técnico a promover
reservas — e por isso "quem você escolhe pro banco" passa a importar.

Três camadas isoladas e testáveis:
1. **Geração no jogo** (motor): faltas → cartões/lesões, com penalidade de força pelo resto da partida.
2. **Estado de temporada**: mapa de disponibilidade por jogador, atualizado a cada partida.
3. **Escalação**: antes de cada jogo, resolve ausências promovendo reservas (auto + editável).

Requisitos inegociáveis (pedidos explicitamente):
- **Transmissão ao vivo:** 🟨🟥🩹 aparecem no feed ao vivo **junto com os gols** (mesmo pipeline).
- **Profundidade/integração:** o sistema conversa com características, compostura, física, tática,
  capitão/batedores, química, notas/MVP e estatísticas — não é um número solto.
- **Testes robustos:** cobrem cada ponto de balanço (taxas, distribuição, A/B) e a coerência de
  temporada (invariantes), além de manter as 120+ regressões verdes.

## 2. Decisões (todas confirmadas)

| Tema | Decisão |
|---|---|
| Efeito no jogo — 🟥 | **Sem substituição.** Jogador **sai** → time joga com 10 → **penalidade de força** no restante |
| Efeito no jogo — lesão | Jogador **continua em campo** com **−`INJURY_DEBUFF` (10–15) em todos os atributos** pelo resto da partida (capengando). Dreno **ameno** e integrado (flui pela média de força e pelos duelos) — mais leve que o vermelho |
| Suspensão | **Realista (UCL):** 3 amarelos acumulados = 1 jogo (zera o acúmulo); 2 amarelos no mesmo jogo = 🟥 = 1 jogo; 🟥 direto = 1 jogo; amarelos acumulados **zeram ao entrar no mata-mata** |
| Lesão | Chance por jogo ponderada por **FÍSICO** + **falta dura sofrida**; gravidade sorteada = **1 (60%) / 2 (30%) / 3 (10%)** jogos |
| Vaga do ausente | **Auto-promove** o melhor reserva compatível + **avisa** (editável na aba MEU TIME) |
| Abrangência | **Todos os times**, bots inclusos |
| Banco dos bots | Bots nascem com **elenco completo** (11 + ~7 reservas da mesma faixa) na criação, **incluindo ≥1 GK reserva** |
| Loja | **🏥 Fisioterapia**: −1 jogo de LESÃO (caro/limitado). Suspensão é **intocável** |

## 3. Arquitetura — 3 camadas

### 3.1 Geração no jogo (`gameEngine.ts` · `runMatchSimulation`)
- **Novo tipo de evento:** adicionar `'injury'` à união `MatchEvent.type` (já existem `yellow`/`red`/`foul`).
- **Cartões:** engancham no mecanismo de **falta que já existe** (o defensor falta o atacante a cada
  minuto). Cada falta pode virar 🟨 com prob. modulada por:
  - agressividade do jogo (`matchAggression`, já sorteado por partida),
  - **compostura** do faltador (alta → menos cartão),
  - **posição** (zagueiro/volante faltam mais que atacante),
  - **estilo/tática** (estilo mais agressivo → mais falta/cartão).
  2º amarelo no mesmo jogador → 🟥. 🟥 direto é raro (prob. baixa por falta).
- **Lesão:** duas fontes — (a) sorteio por titular por jogo ponderado por `(100 − physical)`;
  (b) **falta dura sofrida** pode lesionar o faltado. Gravidade via distribuição (§2).
- **Efeito no jogo — força mutável (recomputada por evento):** hoje `homeBaseStrength`/
  `awayBaseStrength` são `const` calculados uma vez (`runMatchSimulation:1189-1190`). Passam a `let`
  e são **recomputados quando um evento disciplinar muda o time**, mantendo um estado por partida:
  - **🟥:** o jogador **sai da XI efetiva** (removido da média de força e do sorteio de atores) e o
    time leva um **`RED_PENALTY`** (jogar com 10). Recomputa a força base sem ele.
  - **Lesão:** o jogador **permanece** na XI, mas seus atributos ganham **−`INJURY_DEBUFF`** por uma
    tabela de override por partida (`injuredDebuff[key]`); a média de força cai proporcionalmente
    (ameno) e, quando ele é ator de um duelo, entra já debuffado. Recomputa a força base com o override.
  - Assim a hierarquia é natural: **10 homens (🟥) ≫ jogador capengando (lesão)**.
- **Eventos emitidos:** `foul`/`yellow`/`red`/`injury` com `playerId`, `teamId`, `minute`,
  `description` — entram em `MatchResult.events` como os gols.
- **Agregação de stats** (loop já existente em `runMatchSimulation` ~1954): estender para `red`
  (penalidade de nota maior) e `injury` (nota levemente penalizada); expulso não pode ser MVP.
  Yellow já dá −0.5.

### 3.1b Integração com FORMAÇÃO, TÁTICA e ATRIBUTOS (parte central)
- **Atributos individuais** dirigem tudo: **compostura** ↓ prob. de cartão; **físico** ↓ prob. de
  lesão; **físico/defesa** de quem marca ↑ volume de falta. O debuff de lesão é **−N em cada
  atributo**, então reduz finalização/passe/defesa daquele jogador de forma coerente (e a fórmula
  especial do GK também).
- **Formação/posição:** a taxa de falta/cartão é **por posição** (GK ≪ ATK < LAT/MEIA < ZAG/VOL),
  então uma formação com mais zaga/volância naturalmente acumula mais cartão. Perder um jogador
  (🟥/lesão) desequilibra a **forma** daquele setor.
- **Tática/estilo (`playStyle`/`tacticProfile`):** estilo mais agressivo/pressão **eleva** a taxa de
  falta e cartão (e o risco de lesão do adversário nas divididas) — trade-off real de jogar pegado.
- **Características de time:** o debuff/saída recomputa química e `computeCharacteristicBoosts`
  (Pilar/Ídolo/Noé/12º/Mártir) — perder/capengar um craque-chave repercute em cascata.

### 3.1c GOLEIRO — tratamento dedicado (cuidado especial)
O GK é caso à parte em TODOS os pontos:
- **Cartões:** taxa de cartão do GK é **muito baixa** (goleiro raramente comete falta de campo).
- **Lesão de GK:** aplica o debuff nos atributos que a fórmula do GK usa
  (`defending`/`physical`/`pace` — `calculateTeamStrength` GK = `(defending*1.5 + physical + pace*0.5)/3`),
  então um GK machucado defende pior sem virar buraco.
- **🟥 de GK (raro):** sem substituição, um **jogador de linha "vai pro gol"** → penalidade defensiva
  **mais pesada** que um 🟥 normal (`RED_GK_PENALTY`) pelo resto do jogo.
- **Ausência de GK na temporada** (suspenso/lesionado): `resolveAvailableLineup` promove um **GK
  reserva** do banco; se **não houver GK no banco**, coloca o melhor jogador de linha no gol marcado
  como **OOP** (reusa o mecanismo `isOOP` já existente) com forte penalidade — nunca deixa a XI sem
  goleiro.
- **Banco dos bots inclui obrigatoriamente ≥1 GK reserva** na geração (senão bots ficariam sem
  cobertura de goleiro).

### 3.2 Estado de temporada (`discipline.ts` novo + `GameState`/`RoomState`)
```ts
export interface PlayerAvailability { yellows: number; banned: number; injured: number }
// chave estável por time+jogador (bots podem repetir ids entre si):
export type DisciplineMap = Record<string, PlayerAvailability>; // key = `${teamId}:${playerId}`
// Item de resumo para os avisos ("Fulano suspenso 1j / Ciclano lesão 2j").
export interface DisciplineEntry { teamId: string; playerId: string; playerName: string; games: number; kind: 'ban' | 'injury' }
export const availKey = (teamId: string, playerId: string) => `${teamId}:${playerId}`;
export const isAvailable = (m: DisciplineMap, teamId: string, playerId: string): boolean => {
  const a = m[availKey(teamId, playerId)];
  return !a || (a.banned === 0 && a.injured === 0);
};
```
- Guardado em `GameState.discipline` (solo) e `RoomState.discipline` (online, autoritativo).
  Cobre todos os times (jogador + bots + humanos).

### 3.3 Pós-jogo + escalação (funções puras em `discipline.ts`)
```ts
// Aplica a disciplina de UMA rodada/perna. Ordem importa: PRIMEIRO decrementa quem estava fora
// (passou um jogo p/ os times que jogaram), DEPOIS aplica as consequências deste jogo (então um
// 🟥 hoje = fora do PRÓXIMO, não deste). Retorna um novo mapa (imutável) + um resumo p/ avisos.
export function applyMatchDiscipline(
  prev: DisciplineMap,
  playedTeamIds: string[],
  results: MatchResult[],           // as partidas desta rodada/perna
): { next: DisciplineMap; newSuspensions: DisciplineEntry[]; newInjuries: DisciplineEntry[] };

// Resolve a escalação de um time contra o mapa: para cada titular (0-10) indisponível, promove o
// melhor reserva compatível (posição → overall) para a vaga e empurra o ausente pro banco.
// Reajusta capitão/penaltyTaker/freeKickTaker se caírem em quem saiu. Recomputa química/OOP.
// Retorna o time resolvido + as trocas forçadas (p/ o aviso).
export function resolveAvailableLineup(
  team: Team, m: DisciplineMap
): { team: Team; forced: { outId: string; inId: string }[] };

// Sorteio determinístico-testável de gravidade (injetando rng nos testes).
export function rollInjurySeverity(rng: () => number): 1 | 2 | 3;
```
- **Reset no mata-mata:** ao `START_KNOCKOUT`, zera `yellows` de todos (suspensões/lesões em
  curso continuam) — `resetYellowsForKnockout(m)`.
- **🏥 Fisioterapia:** `healInjury(m, teamId, playerId)` reduz `injured` em 1 (mín. 0).

## 4. Integração com mecânicas existentes (a profundidade)

1. **Transmissão ao vivo** (`MatchSimPage.tsx`): o feed de destaques (hoje filtra só `goal`/`penalty`,
   ~linha 2015-2026) passa a incluir `yellow`/`red`/`injury`; o replay minuto-a-minuto (~1096) e a
   narração (~1606) ganham os casos de `red`/`injury` (yellow/foul já existem parcialmente).
2. **Compostura → disciplina:** entra na prob. de cartão (cabeça fria). Reaproveita o atributo que
   já decide pênaltis.
3. **Física → lesão** e **posição → falta:** já descrito.
4. **Estilo/tática → agressividade:** `playStyle`/`tacticProfile` modula a taxa de falta/cartão.
5. **Características de time em cascata:** promover reserva muda o XI → `resolveAvailableLineup`
   **recomputa química e `computeCharacteristicBoosts`**, então perder Pilar/Ídolo/Noé/12º/Mártir
   repercute além do overall.
6. **Capitão / batedores:** re-seleção automática do próximo melhor quando o titular do posto sai.
7. **Notas & MVP:** 🟥 penaliza a nota; expulso não é MVP; time desfalcado rende diferente.
8. **Estatísticas:** nova sub-aba **DISCIPLINA** em ESTATÍSTICAS (mais amarelos / expulsões /
   lesionados) reaproveitando `yellowCards`/`redCards`/`fouls` já agregados em `getPlayerSeasonStats`.
9. **Economia/loja:** lesões dão sentido a scout/pacote/treino de reservas; **🏥 Fisioterapia** é a
   única válvula (custo alto).

## 5. UI

- **Editor de escalação / MEU TIME** (`SquadEditor.tsx`, `LeagueSquadTab.tsx`): badges no card —
  `🟨×N` (amarelos acumulados), `🟥 SUSP (n)`, `🩹 LESÃO (n)`. Indisponível **não pode ir pro XI**
  (bloqueado no swap; se estava no XI, cai pro banco). 🏥 Fisioterapia acessível no card do lesionado.
- **Antes da rodada** (`LeaguePage.tsx` / `KnockoutTiesTab.tsx`): aviso
  `⚠️ Desfalques: Fulano (suspenso) · Ciclano (lesão 2j) → promovidos: X, Y` com atalho pro MEU TIME.
- **Partida:** narração ao vivo + `MatchDetailsModal` mostram 🟨🟥🩹 (minuto + jogador); ícone ao lado
  do jogador afetado no campo do modal.

## 6. Números (constantes ajustáveis em `discipline.ts`)

Alvos de balanço (somando os dois times, por jogo de 90'):
- **Amarelos:** ~3–4/jogo. **Vermelho:** ~1 a cada 8 jogos. **Lesão:** ~1 a cada 2–3 jogos.
- Amarelo acumulado → suspensão: **3**. Gravidade da lesão: **1j 60% · 2j 30% · 3j 10%**.
- `INJURY_DEBUFF` (−N em cada atributo do lesionado, resto do jogo): **ponto de partida 12** (10–15).
- `RED_PENALTY` (força a menos por jogar com 10): ponto de partida **~7–9**, calibrado p/ "10 homens"
  perder claramente mais. `RED_GK_PENALTY` (goleiro expulso, jogador de linha no gol): **maior**
  (~14–18).
- Fisioterapia: custo alto na `SHOP_COSTS` (ponto de partida ~250), −1 jogo de lesão.
- Taxa de cartão **por posição**: GK ≈ 0 · ATK baixo · LAT/MEIA médio · ZAG/VOL alto (multiplicadores
  ajustáveis). 🟥 direto raro por falta.

Todos os valores acima são constantes exportadas e re-tunáveis no fechamento (balance).

## 7. Dados & sync

- **Solo:** `GameState.discipline: DisciplineMap`. Aplicado no reducer após cada partida.
- **Online:** `RoomState.discipline: DisciplineMap` (autoritativo). Calculado no servidor após
  `play_round`/`play_knockout_leg`; escalações resolvidas no servidor; sincronizado ao cliente
  (exibição). O jogador ainda edita o XI em MEU TIME — o servidor valida disponibilidade.
- Sync no `SET_ONLINE_STATE` (novo campo `discipline`, como `points`).
- **Bots:** cobertos pelo mesmo mapa; `resolveAvailableLineup` roda silencioso antes das partidas deles.

## 8. Testes (robustos, profissionais)

### 8.1 Unit — funções puras (`discipline.test.ts`, determinístico)
- `applyMatchDiscipline`: 3º amarelo cruza o threshold → `banned=1` e `yellows` zera; 🟥 → `banned=1`;
  2 amarelos no mesmo jogo → 🟥 (1 jogo); **ordem** decrementar-antes-de-aplicar (🟥 hoje ⇒ fora só
  do próximo); injury seta `injured` pela gravidade; `healInjury` −1 (piso 0); `resetYellowsForKnockout`
  zera amarelos e preserva bans/lesões.
- `resolveAvailableLineup`: promove por posição→overall; bloqueia indisponível no XI; re-seleciona
  capitão/penalty/free-kick quando cai em quem saiu; recomputa química/OOP; XI final sempre com 11 válidos.
- **Goleiro:** GK indisponível promove um **GK reserva** do banco; **sem GK no banco** → melhor
  jogador de linha vai pro gol marcado `isOOP` (nunca fica sem goleiro); a promoção nunca deixa 2 GKs
  na linha nem 0 no gol.
- `rollInjurySeverity`: distribuição bate (rng injetado nos limiares).

### 8.2 Motor — seeded, estatístico sobre N jogos (`cards-injuries.balance.test.ts`)
- Taxas de 🟨/🟥/lesão caem nas faixas-alvo (±tolerância).
- Distribuição por posição realista (DEF/MID recebem mais 🟨 que ATK).
- **A/B**: compostura alta → menos cartão; físico alto → menos lesão; estilo agressivo → mais cartão;
  **time que joga com 10 (🟥) concede/perde claramente mais** (penalidade calibrada).
- **Hierarquia do efeito:** 🟥 (10 homens) penaliza **mais** que uma lesão (jogador capengando) — A/B
  confirma que o placar sofre mais com vermelho do que com lesão equivalente.
- **Goleiro:** GK com cartão é raríssimo (taxa ~0); **GK lesionado** defende pior (concede mais que um
  GK íntegro, mesmo time); **🟥 no GK** (jogador de linha no gol) é o pior cenário defensivo (A/B vs 🟥
  normal).

### 8.3 Coerência de temporada — invariantes (`discipline-season.test.ts`)
- Simular uma temporada inteira (liga + mata-mata) e checar: **ninguém joga suspenso/lesionado**;
  contadores decrementam corretamente; amarelos zeram no mata-mata; bots rodam o banco; XI sempre
  com 11 válidos **e sempre com exatamente 1 goleiro** (GK reserva ou linha-no-gol); química/boosts
  recomputados ao promover.

### 8.4 Regressão
- Os 120+ testes de balanço/química/mata-mata/apostas seguem verdes; re-tunar `GK_SAVE_EDGE`/
  `ON_TARGET_RESISTANCE` se o "10 homens" mexer no placar médio para fora da faixa (~2.9–3.2 gols/jogo).

## 9. Fases de entrega

- **Fase 1 — Geração no motor:** `'injury'` no tipo; geração de faltas/cartões/lesões por
  atributo/posição/tática; **força base mutável** (🟥 remove + `RED_PENALTY`; lesão aplica
  `INJURY_DEBUFF` via override); **tratamento do goleiro** (taxa ~0, lesão pela fórmula do GK,
  `RED_GK_PENALTY`); agregação de stats (red/injury/MVP); **banco dos bots com GK reserva**; exibição
  na transmissão ao vivo (feed junto com os gols) + `MatchDetailsModal`. Testes 8.2. (Visível na hora;
  ainda sem carregar entre jogos.)
- **Fase 2 — Temporada (solo):** `discipline.ts` (mapa + funções puras); integração no reducer
  (aplica pós-jogo em liga e mata-mata; `resolveAvailableLineup` antes de simular; reset no
  `START_KNOCKOUT`); auto-promoção + avisos; badges/bloqueio no editor; sub-aba DISCIPLINA;
  🏥 Fisioterapia na loja. Testes 8.1 e 8.3.
- **Fase 3 — Online:** `discipline` no `RoomState`; cálculo/resolução no servidor
  (`play_round`/`play_knockout_leg`); validação de disponibilidade nas edições de XI; sync no
  `SET_ONLINE_STATE`; avisos no cliente online.

**Fora de escopo (YAGNI):** substituições táticas manuais no jogo, cartão por reclamação/simulação,
lesões de longa duração (temporada inteira), mercado de transferências, "Recurso" contra suspensão.

## 10. Verificação (fecho de cada fase)
- `cd client && npx tsc --noEmit`; raiz `npm run build`; `npx vitest run` (novos + regressões).
- Manual: cartões/lesões aparecem ao vivo junto com gols; desfalque promove reserva com aviso;
  suspenso/lesionado não escala; amarelos zeram no mata-mata; bots rodam banco; Fisioterapia funciona;
  online — nada some antes da hora e a disciplina sincroniza.
