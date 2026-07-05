# Posições Secundárias — penalidade + cobertura — Design

**Data:** 2026-07-05
**Status:** Aprovado

## Objetivo

Duas mudanças ligadas às posições secundárias:
1. **Penalidade pequena** ao jogar numa secundária (hoje é 0 — idêntico à nativa). Fica **−7%** nos
   atributos, entre a nativa (0%) e o fora-de-posição (−15%).
2. **Cobertura:** hoje só 109 de 291 jogadores têm secundária. Passa a ser **híbrido** — jogadores
   importantes/famosos definidos **à mão**, e o resto **padronizado** por um mapa de posições vizinhas
   (calculado na hora). Os manuais existentes valem como **override**.

## Decisões (com o usuário)

- **Penalidade da secundária:** **−7%** em todos os atributos (× 0.93). Calibrável.
- **3 estados de encaixe:** **nativa** (0%) · **secundária** (−7%) · **fora de posição** (−15%, ou −8%
  com o trait de versatilidade). 🃏 Coringa continua imune (joga em qualquer lugar como nativa).
- **Química:** na secundária, o jogador **mantém** a química individual (não zera como no OOP) — só leva
  o −7% de stats. No OOP continua zerando a química e −15%.
- **Cobertura híbrida:** manuais à mão pros famosos (o tier **Imortal** entra nessa leva agora) +
  **adjacência** pro resto. `secondaryPositions` explícito **sempre** vence a adjacência.

## Componentes

### `client/src/lib/gameData.ts` (modificar) — dados
- Mapa de adjacência (secundárias PADRÃO por posição nativa):
  ```ts
  export const SECONDARY_ADJACENCY: Record<string, string[]> = {
    GK: [], CB: ['CDM'], LB: ['LWB', 'LM'], RB: ['RWB', 'RM'],
    LWB: ['LB', 'LM'], RWB: ['RB', 'RM'], CDM: ['CM', 'CB'], CM: ['CDM', 'CAM'],
    CAM: ['CM', 'CF'], LM: ['LW', 'LWB'], RM: ['RW', 'RWB'],
    LW: ['LM', 'CF'], RW: ['RM', 'CF'], CF: ['ST', 'CAM'], ST: ['CF'],
  };
  export function effectiveSecondaries(p: { position: string; secondaryPositions?: string[] }): string[] {
    return p.secondaryPositions ?? SECONDARY_ADJACENCY[p.position] ?? [];
  }
  ```
- **Curadoria manual (famosos):** setar `secondaryPositions` explícito nos **9 Imortais** com valores
  reais (ex.: um ala vira lateral, um CAM cobre ST/CM, etc.), lendo cada bloco. (Os já-manuais ficam.)

### `client/src/lib/gameEngine.ts` (modificar) — regra + penalidade
- Constante: `export const SECONDARY_STAT_MULT = 0.93;` (−7%).
- Encaixe em 3 estados: `export function positionFit(player, role): 'native' | 'secondary' | 'off'`
  (usa `effectiveSecondaries`; Coringa → 'native'). `isPlayerInPosition` passa a ser
  `positionFit(...) !== 'off'` (mantém o comportamento atual de "está em posição").
- `calculateChemistry` passa a marcar também **secundária**: além de `outOfPosition[id]` (só 'off'),
  expõe `secondaryPos: Record<string, boolean>` (true no 'secondary'). Na secundária **não** zera a
  química (só o 'off' zera).
- `getEffectiveAttribute` / `getPlayerEffectiveStats`: recebem `isSecondary` (como já recebem `isOOP`).
  Multiplicador de stats:
  - `off` → `oopMult` (0.85 / 0.92 com relief).
  - `secondary` → química normal do jogador **× SECONDARY_STAT_MULT** (mantém o bônus de química, tira 7%).
  - `native` → química normal (× 1).
- Onde as cartas recebem `isOOP` (montagem do XI pra simulação/display), setar também `isSecondary`
  a partir do `secondaryPos` da química.

### `client/src/components/game/SquadEditor.tsx` (modificar) — modal
- O painel do jogador e a lista "TROCAR COM" já mostram nativa/secundária/fora (do QOL anterior);
  ajustar pra refletir o **−7%**: no candidato secundário, deixar claro "cobre a vaga (−7%)"; no
  jogador selecionado em secundária, mostrar o status (hoje só marca OOP). O delta de stats já reflete
  automático (vem do motor).

## Fluxo de dados

Cada jogador tem secundárias efetivas (explícitas OU adjacência). No XI, o papel do slot define o
encaixe: nativa (cheio), secundária (−7%, mantém química), fora (−15%, química 0). O motor aplica isso
no display e na simulação; o modal comunica os 3 estados.

## Verificação

- **Unidade (motor):** `positionFit` (nativa/secundária/fora, com adjacência e override); `effectiveSecondaries`
  (override vence adjacência); um jogador na secundária rende **× 0.93** vs nativa e mantém química; no
  'off' continua × 0.85 e química 0; `SECONDARY_STAT_MULT = 0.93`.
- **Balanço:** rodar `balance.test.ts` — a mudança é pequena; conferir que segue na faixa.
- **Typecheck/build:** `cd client && npx tsc --noEmit`; raiz `npm run build`.
- **Manual:** escalar um jogador numa secundária → −7% nos stats (não −15%), química mantida, e o modal
  deixa claro. Adjacência: um jogador sem secundária explícita agora cobre as posições vizinhas.

## Fora de escopo

- Curadoria manual além do tier Imortal (o resto fica na adjacência; dá pra promover mais famosos
  depois). Mudar o mapa de adjacência por jogador (é por posição). Penalidade progressiva por "distância".
