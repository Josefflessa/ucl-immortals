# Sistema de Palpite (apostas de pontos) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um sistema opcional de palpite (aposta de pontos no placar de qualquer partida), no solo e no online, com crédito diferido até a revelação do resultado — e corrigir o spoiler pré-existente dos pontos da partida no online.

**Architecture:** Um módulo puro (`bets.ts`) com o tipo `Bet`, constantes e `settleBet`. O stake é debitado por escrow ao apostar (solo: reducer; online: servidor autoritativo). A liquidação (cálculo) roda quando a partida é simulada, mas o crédito dos pontos (partida + palpite) só entra no saldo no momento da revelação (solo: `FINISH_LEAGUE_MATCH`; online: gate "todos assistiram"). UI: botão 🎯 e um modal de slip nos cards de partida.

**Tech Stack:** React + TypeScript (Vite) no cliente, Node + socket.io no servidor, Vitest para testes. Build da raiz (`npm run build`). Alias `@`.

## Global Constraints

- **NÃO commitar automaticamente — o usuário faz os commits.** Ao final de cada task, rode a verificação e **pare para o usuário commitar** (os passos "Commit" abaixo são do usuário).
- Verificação padrão de cada task com código: `cd client && npx tsc --noEmit`; testes com `cd client && npx vitest run <arquivo>`; build final da raiz `npm run build`.
- Constantes de balanço (em `client/src/lib/bets.ts`): `BET_OUTCOME_MULT = 1.5`, `BET_EXACT_MULT = 2.5`, `BET_ROUND_CAP = 200`, `BET_MAX_GOALS = 15`.
- **Sem odds na tela.** Nunca exibir multiplicador por confronto específico; só os fixos 1.5×/2.5× como info genérica.
- **Anti-spoiler rígido:** nada que revele resultado (saldo de pontos, ganho do palpite, badge de acerto) pode aparecer/creditar antes da revelação. Online: revelação = gate "todos assistiram" (`watchedRoundPlayers` completo). Solo: revelação = `FINISH_LEAGUE_MATCH`.
- `matchKey`: liga `L{round}:{homeTeamId}-{awayTeamId}`; mata-mata `K{matchId}:{leg}` (leg = 1 ou 2; jogo único usa leg 1).
- Determinismo nos testes: nunca usar `Math.random`/`Date.now` nos testes; montar `Bet`/`MatchResult` à mão.

---

## File Structure

- **Create** `client/src/lib/bets.ts` — tipo `Bet`, constantes, `settleBet`, `buildLeagueMatchKey`, `buildKnockoutMatchKey`, `roundStakeUsed`, `canPlaceStake`.
- **Create** `client/src/lib/bets.test.ts` — testes de `settleBet` e dos helpers de teto.
- **Create** `client/src/components/game/BetSlipModal.tsx` — modal do slip (steppers de placar + valor + confirmar/cancelar).
- **Modify** `client/src/contexts/GameContext.tsx` — `bets` no `GameState`; ações `PLACE_BET`/`CANCEL_BET`; liquidação+crédito no `FINISH_LEAGUE_MATCH` e `FINISH_KNOCKOUT_MATCH`; sync em `SET_ONLINE_STATE`; emits online.
- **Modify** `server/handlers.ts` — `bets` e `pendingMatchPoints` no `RoomPlayer`; handlers `place_bet`/`cancel_bet`; liquidação sem crédito em `play_round`/`play_knockout_leg`; crédito no gate de `player_match_watched`; init/reset.
- **Modify** `client/src/pages/LeaguePage.tsx` — botão 🎯 Palpitar + badge de resultado nos cards de fixture (Fase 1).
- **Modify** `client/src/components/game/KnockoutTiesTab.tsx` — botão 🎯 + badge por perna (Fase 2).

---

## FASE 1 — LIGA (solo + online) + fix do spoiler de pontos

### Task 1: Módulo puro `bets.ts` — tipo, constantes e `settleBet`

**Files:**
- Create: `client/src/lib/bets.ts`
- Test: `client/src/lib/bets.test.ts`

**Interfaces:**
- Produces:
  - `interface Bet { matchKey: string; homeGoals: number; awayGoals: number; stake: number; settled?: boolean; revealed?: boolean; won?: boolean; tier?: 'exact'|'outcome'|'miss'; payout?: number }`
  - `BET_OUTCOME_MULT`, `BET_EXACT_MULT`, `BET_ROUND_CAP`, `BET_MAX_GOALS` (números)
  - `settleBet(bet: Bet, result: { homeGoals: number; awayGoals: number }): { won: boolean; tier: 'exact'|'outcome'|'miss'; payout: number }`
  - `buildLeagueMatchKey(round: number, homeTeamId: string, awayTeamId: string): string`
  - `buildKnockoutMatchKey(matchId: string, leg: number): string`
  - `roundStakeUsed(bets: Bet[], keyPrefix: string): number`
  - `canPlaceStake(bets: Bet[], keyPrefix: string, matchKey: string, stake: number): boolean`

- [ ] **Step 1: Escrever o teste que falha**

Criar `client/src/lib/bets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { settleBet, roundStakeUsed, canPlaceStake, buildLeagueMatchKey, BET_EXACT_MULT, BET_OUTCOME_MULT, BET_ROUND_CAP, Bet } from './bets';

const bet = (over: Partial<Bet> = {}): Bet => ({ matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100, ...over });

describe('settleBet', () => {
  it('placar exato paga BET_EXACT_MULT', () => {
    expect(settleBet(bet(), { homeGoals: 2, awayGoals: 1 })).toEqual({ won: true, tier: 'exact', payout: Math.round(100 * BET_EXACT_MULT) });
  });
  it('resultado certo mas placar errado paga BET_OUTCOME_MULT', () => {
    expect(settleBet(bet(), { homeGoals: 3, awayGoals: 0 })).toEqual({ won: true, tier: 'outcome', payout: Math.round(100 * BET_OUTCOME_MULT) });
  });
  it('empate acertado no resultado (placar diferente) paga outcome', () => {
    expect(settleBet(bet({ homeGoals: 1, awayGoals: 1 }), { homeGoals: 0, awayGoals: 0 })).toEqual({ won: true, tier: 'outcome', payout: Math.round(100 * BET_OUTCOME_MULT) });
  });
  it('resultado errado perde tudo', () => {
    expect(settleBet(bet(), { homeGoals: 0, awayGoals: 2 })).toEqual({ won: false, tier: 'miss', payout: 0 });
  });
  it('arredonda o payout de stake ímpar', () => {
    expect(settleBet(bet({ stake: 33 }), { homeGoals: 2, awayGoals: 1 }).payout).toBe(Math.round(33 * BET_EXACT_MULT));
  });
});

describe('teto por rodada', () => {
  it('roundStakeUsed soma só os bets do prefixo da rodada', () => {
    const bets: Bet[] = [bet({ matchKey: 'L1:a-b', stake: 80 }), bet({ matchKey: 'L1:c-d', stake: 50 }), bet({ matchKey: 'L2:e-f', stake: 70 })];
    expect(roundStakeUsed(bets, 'L1:')).toBe(130);
  });
  it('canPlaceStake respeita o teto, ignorando o próprio bet ao editar', () => {
    const bets: Bet[] = [bet({ matchKey: 'L1:a-b', stake: 150 })];
    // editar o mesmo bet para 200 cabe (200 <= 200)
    expect(canPlaceStake(bets, 'L1:', 'L1:a-b', 200)).toBe(true);
    // novo bet de 60 estoura (150 + 60 = 210 > 200)
    expect(canPlaceStake(bets, 'L1:', 'L1:c-d', 60)).toBe(false);
    // novo bet de 50 cabe (150 + 50 = 200)
    expect(canPlaceStake(bets, 'L1:', 'L1:c-d', 50)).toBe(true);
  });
  it('buildLeagueMatchKey monta o prefixo esperado', () => {
    expect(buildLeagueMatchKey(3, 'x', 'y')).toBe('L3:x-y');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd client && npx vitest run src/lib/bets.test.ts`
Expected: FAIL (Cannot find module './bets').

- [ ] **Step 3: Implementar `bets.ts`**

Criar `client/src/lib/bets.ts`:

```ts
// UCL Immortals — Sistema de Palpite (apostas de pontos no placar de partidas).
// Módulo PURO: tipo, constantes de balanço e liquidação. Sem React/engine/rede.
// A regra de crédito diferido (só creditar na revelação) vive nos reducers/handlers,
// não aqui — este módulo só CALCULA se ganhou e quanto.

export const BET_OUTCOME_MULT = 1.5;  // acertar V/E/D
export const BET_EXACT_MULT = 2.5;    // acertar o placar exato
export const BET_ROUND_CAP = 200;     // teto de stake TOTAL por rodada
export const BET_MAX_GOALS = 15;      // teto do stepper de placar (0..15 por lado)

export interface Bet {
  matchKey: string;      // id estável da partida (ver builders abaixo)
  homeGoals: number;     // placar palpitado (perspectiva do mando da partida)
  awayGoals: number;
  stake: number;
  settled?: boolean;     // resultado já calculado (não exibir/creditar ainda)
  revealed?: boolean;    // já creditado + exibido (pós anti-spoiler)
  won?: boolean;
  tier?: 'exact' | 'outcome' | 'miss';
  payout?: number;       // quanto foi/será creditado (0 se miss)
}

// Compara o palpite com o placar real (orientado ao mando daquela partida).
export function settleBet(
  bet: Bet,
  result: { homeGoals: number; awayGoals: number }
): { won: boolean; tier: 'exact' | 'outcome' | 'miss'; payout: number } {
  const exact = bet.homeGoals === result.homeGoals && bet.awayGoals === result.awayGoals;
  const sign = (h: number, a: number) => Math.sign(h - a); // 1 casa / 0 empate / -1 fora
  const outcomeRight = sign(bet.homeGoals, bet.awayGoals) === sign(result.homeGoals, result.awayGoals);
  if (exact) return { won: true, tier: 'exact', payout: Math.round(bet.stake * BET_EXACT_MULT) };
  if (outcomeRight) return { won: true, tier: 'outcome', payout: Math.round(bet.stake * BET_OUTCOME_MULT) };
  return { won: false, tier: 'miss', payout: 0 };
}

export function buildLeagueMatchKey(round: number, homeTeamId: string, awayTeamId: string): string {
  return `L${round}:${homeTeamId}-${awayTeamId}`;
}

export function buildKnockoutMatchKey(matchId: string, leg: number): string {
  return `K${matchId}:${leg}`;
}

// Soma dos stakes dos palpites cujo matchKey começa com o prefixo da rodada (ex.: 'L3:').
export function roundStakeUsed(bets: Bet[], keyPrefix: string): number {
  return bets.filter(b => b.matchKey.startsWith(keyPrefix)).reduce((s, b) => s + b.stake, 0);
}

// Cabe apostar `stake` em `matchKey` sem estourar BET_ROUND_CAP? (ignora o bet que está
// sendo editado, pra troca de valor no mesmo jogo não somar duas vezes.)
export function canPlaceStake(bets: Bet[], keyPrefix: string, matchKey: string, stake: number): boolean {
  const used = bets.filter(b => b.matchKey.startsWith(keyPrefix) && b.matchKey !== matchKey).reduce((s, b) => s + b.stake, 0);
  return stake > 0 && used + stake <= BET_ROUND_CAP;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd client && npx vitest run src/lib/bets.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit (usuário)** — parar para o usuário commitar `bets.ts` + `bets.test.ts`.

---

### Task 2: Estado solo — `bets` no `GameState`, ações `PLACE_BET`/`CANCEL_BET` (escrow)

**Files:**
- Modify: `client/src/contexts/GameContext.tsx`
- Test: `client/src/contexts/betting-reducer.test.ts` (Create)

**Interfaces:**
- Consumes: `Bet`, `buildLeagueMatchKey`, `canPlaceStake`, `roundStakeUsed` de `../lib/bets`.
- Produces (no `GameState`): `bets: Bet[]`. Ações:
  - `{ type: 'PLACE_BET'; matchKey: string; homeGoals: number; awayGoals: number; stake: number }`
  - `{ type: 'CANCEL_BET'; matchKey: string }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `client/src/contexts/betting-reducer.test.ts`. (O reducer não é exportado; exporte-o.) Primeiro exporte no `GameContext.tsx`: trocar `function gameReducer(` por `export function gameReducer(`.

```ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from './GameContext';
import type { GameState } from './GameContext';

// Estado mínimo só com os campos que o betting toca.
const base = (over: Partial<GameState> = {}): GameState => ({
  ...({} as GameState),
  playerTeam: { id: 'me', players: [] } as any,
  points: 500,
  leagueRound: 1,
  bets: [],
  ...over,
});

describe('PLACE_BET / CANCEL_BET (escrow)', () => {
  it('debita o stake ao apostar e guarda o bet', () => {
    const s = gameReducer(base(), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
    expect(s.points).toBe(400);
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0]).toMatchObject({ matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
  });
  it('editar o mesmo jogo ajusta o escrow pela diferença', () => {
    let s = gameReducer(base(), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
    s = gameReducer(s, { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 0, awayGoals: 0, stake: 150 });
    expect(s.points).toBe(500 - 150);
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0]).toMatchObject({ homeGoals: 0, awayGoals: 0, stake: 150 });
  });
  it('rejeita aposta que estoura o teto da rodada', () => {
    let s = gameReducer(base({ points: 999 }), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 1, awayGoals: 0, stake: 150 });
    s = gameReducer(s, { type: 'PLACE_BET', matchKey: 'L1:c-d', homeGoals: 1, awayGoals: 0, stake: 100 }); // 250 > 200
    expect(s.bets).toHaveLength(1); // segundo rejeitado
    expect(s.points).toBe(999 - 150);
  });
  it('rejeita aposta sem saldo', () => {
    const s = gameReducer(base({ points: 50 }), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 1, awayGoals: 0, stake: 100 });
    expect(s.bets).toHaveLength(0);
    expect(s.points).toBe(50);
  });
  it('cancelar devolve o escrow e remove o bet', () => {
    let s = gameReducer(base(), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
    s = gameReducer(s, { type: 'CANCEL_BET', matchKey: 'L1:a-b' });
    expect(s.points).toBe(500);
    expect(s.bets).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd client && npx vitest run src/contexts/betting-reducer.test.ts`
Expected: FAIL (`gameReducer`/`bets` não existem no shape).

- [ ] **Step 3: Implementar o estado e as ações**

Em `client/src/contexts/GameContext.tsx`:

1. No import de `../lib/bets` (adicionar linha após o import de `../lib/shop`):
```ts
import { Bet, buildLeagueMatchKey, canPlaceStake } from '../lib/bets';
```

2. No `interface GameState`, após `pendingPack: ... | null;` adicionar:
```ts
  // 🎯 Palpites (apostas de pontos). Escrow já debitado ao apostar; crédito só na revelação.
  bets: Bet[];
```

3. No `initialState`, após `pendingPack: null,` adicionar:
```ts
  bets: [],
```

4. Na união `GameAction`, adicionar:
```ts
  | { type: 'PLACE_BET'; matchKey: string; homeGoals: number; awayGoals: number; stake: number }
  | { type: 'CANCEL_BET'; matchKey: string }
```

5. Trocar `function gameReducer(` por `export function gameReducer(`.

6. Adicionar os dois cases no reducer (perto dos outros `SHOP_*`):
```ts
    case 'PLACE_BET': {
      if (!state.playerTeam || action.stake <= 0) return state;
      const prefix = `L${state.leagueRound}:`;
      const existing = state.bets.find(b => b.matchKey === action.matchKey);
      const escrowDelta = action.stake - (existing?.stake ?? 0); // >0 debita mais, <0 devolve
      if (escrowDelta > state.points) return state;                 // saldo insuficiente
      if (!canPlaceStake(state.bets, prefix, action.matchKey, action.stake)) return state; // teto
      const bet: Bet = { matchKey: action.matchKey, homeGoals: action.homeGoals, awayGoals: action.awayGoals, stake: action.stake };
      const bets = existing
        ? state.bets.map(b => b.matchKey === action.matchKey ? bet : b)
        : [...state.bets, bet];
      return { ...state, points: state.points - escrowDelta, bets };
    }

    case 'CANCEL_BET': {
      const existing = state.bets.find(b => b.matchKey === action.matchKey);
      if (!existing || existing.settled) return state; // não cancela depois de travado/liquidado
      return { ...state, points: state.points + existing.stake, bets: state.bets.filter(b => b.matchKey !== action.matchKey) };
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd client && npx vitest run src/contexts/betting-reducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck** — `cd client && npx tsc --noEmit` → sem erros.

- [ ] **Step 6: Commit (usuário).**

---

### Task 3: Solo — liquidação + crédito no `FINISH_LEAGUE_MATCH` (revelação)

**Files:**
- Modify: `client/src/contexts/GameContext.tsx` (case `FINISH_LEAGUE_MATCH`, ~linhas 755-815)
- Test: `client/src/contexts/betting-reducer.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `settleBet`, `buildLeagueMatchKey` de `../lib/bets`.
- Produces: no fim do `FINISH_LEAGUE_MATCH`, todos os `bets` da rodada atual ficam `settled+revealed`, com `payout` somado a `points`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `betting-reducer.test.ts`:

```ts
import type { GameAction } from './GameContext';

describe('FINISH_LEAGUE_MATCH liquida e credita os palpites', () => {
  const mkResult = (homeTeamId: string, awayTeamId: string, hg: number, ag: number): any =>
    ({ homeTeamId, awayTeamId, homeGoals: hg, awayGoals: ag, events: [], playerStats: {} });

  it('credita o payout de palpites certos e zera os errados, marcando revealed', () => {
    // Time do jogador 'me' joga contra 'b' na rodada 1; e um jogo de bots 'c'x'd'.
    const state = base({
      points: 300,
      leagueRound: 1,
      playerTeam: { id: 'me', players: [] } as any,
      botTeams: [{ id: 'b', players: [] }, { id: 'c', players: [] }, { id: 'd', players: [] }] as any,
      leagueFixtures: [
        { round: 1, homeTeamId: 'me', awayTeamId: 'b', played: false },
        { round: 1, homeTeamId: 'c', awayTeamId: 'd', played: false },
      ] as any,
      bets: [
        { matchKey: 'L1:me-b', homeGoals: 2, awayGoals: 1, stake: 100 }, // vamos dizer que dá 2-1 → exact
        { matchKey: 'L1:c-d', homeGoals: 0, awayGoals: 0, stake: 40 },   // se der outra coisa → miss
      ],
    });
    // O resultado do jogador vem na action; os outros são simulados dentro do reducer.
    const finished = gameReducer(state, { type: 'FINISH_LEAGUE_MATCH', result: mkResult('me', 'b', 2, 1) } as GameAction);
    const meBet = finished.bets.find(b => b.matchKey === 'L1:me-b')!;
    expect(meBet.settled).toBe(true);
    expect(meBet.revealed).toBe(true);
    expect(meBet.tier).toBe('exact');
    // 300 (start) + pontos da partida do 'me' + payout do palpite exato (250). Verificamos só o incremento do palpite:
    expect(finished.points).toBeGreaterThanOrEqual(300 + 250);
    const cdBet = finished.bets.find(b => b.matchKey === 'L1:c-d')!;
    expect(cdBet.settled).toBe(true);
    expect(['exact', 'outcome', 'miss']).toContain(cdBet.tier);
  });
});
```

Nota: o resultado do jogo de bots é simulado dentro do reducer (não-determinístico), então o teste só valida o palpite do próprio jogo (determinístico via `action.result`) e que o bet de bots foi liquidado (settled+revealed) com algum tier.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd client && npx vitest run src/contexts/betting-reducer.test.ts`
Expected: FAIL (bets não são liquidados/creditados).

- [ ] **Step 3: Implementar a liquidação no `FINISH_LEAGUE_MATCH`**

No case `FINISH_LEAGUE_MATCH`, logo antes do `return { ...state, phase: 'league', ... }` final (após `allFixtures` já conter todos os resultados da rodada e `matchPoints` calculado), inserir:

```ts
      // 🎯 Palpite: liquida e CREDITA os palpites da rodada agora (no solo, o fim da partida é a
      // revelação — o jogador viu o seu jogo ao vivo e os demais foram simulados aqui).
      const betPrefix = `L${state.leagueRound}:`;
      let betWinnings = 0;
      const settledBets = state.bets.map(b => {
        if (b.revealed || !b.matchKey.startsWith(betPrefix)) return b;
        const fx = allFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === b.matchKey);
        if (!fx?.result) return b;
        const r = settleBet(b, fx.result);
        betWinnings += r.payout;
        return { ...b, settled: true, revealed: true, won: r.won, tier: r.tier, payout: r.payout };
      });
```

E no objeto de retorno final do case, trocar:
```ts
        points: state.points + matchPoints.total,
```
por:
```ts
        points: state.points + matchPoints.total + betWinnings,
        bets: settledBets,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd client && npx vitest run src/contexts/betting-reducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck** — sem erros.

- [ ] **Step 6: Commit (usuário).**

---

### Task 4: UI — `BetSlipModal` (slip de palpite)

**Files:**
- Create: `client/src/components/game/BetSlipModal.tsx`

**Interfaces:**
- Consumes: `Bet`, `BET_MAX_GOALS`, `BET_OUTCOME_MULT`, `BET_EXACT_MULT` de `../../lib/bets`.
- Produces (default export): componente
  ```ts
  BetSlipModal(props: {
    homeName: string; awayName: string;
    existing?: Bet;                 // palpite atual (edição) ou undefined
    remainingCap: number;           // quanto ainda cabe no teto da rodada (já somando o existing)
    points: number;                 // saldo atual do jogador
    onConfirm: (homeGoals: number, awayGoals: number, stake: number) => void;
    onCancelBet?: () => void;       // remover o palpite existente
    onClose: () => void;
  }): JSX.Element
  ```

- [ ] **Step 1: Implementar o componente**

Criar `client/src/components/game/BetSlipModal.tsx`:

```tsx
// UCL Immortals — slip de PALPITE. Escolha um placar + valor. Sem odds por confronto:
// só os múltiplos fixos (1.5× resultado · 2.5× placar exato) como info genérica.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bet, BET_MAX_GOALS, BET_OUTCOME_MULT, BET_EXACT_MULT } from '../../lib/bets';

function Stepper({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-black tracking-widest text-gray-400 truncate max-w-[110px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => set(Math.max(0, value - 1))} className="w-8 h-8 rounded-lg font-black" style={{ background: '#1A1A2A', color: '#C9A84C', border: '1px solid #333' }}>−</button>
        <span className="w-8 text-center text-2xl font-black tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{value}</span>
        <button onClick={() => set(Math.min(max, value + 1))} className="w-8 h-8 rounded-lg font-black" style={{ background: '#1A1A2A', color: '#C9A84C', border: '1px solid #333' }}>+</button>
      </div>
    </div>
  );
}

export default function BetSlipModal({ homeName, awayName, existing, remainingCap, points, onConfirm, onCancelBet, onClose }: {
  homeName: string; awayName: string; existing?: Bet; remainingCap: number; points: number;
  onConfirm: (homeGoals: number, awayGoals: number, stake: number) => void; onCancelBet?: () => void; onClose: () => void;
}) {
  const [hg, setHg] = useState(existing?.homeGoals ?? 1);
  const [ag, setAg] = useState(existing?.awayGoals ?? 0);
  const [stake, setStake] = useState(existing?.stake ?? Math.min(50, remainingCap, points));
  const maxStake = Math.max(0, Math.min(remainingCap, points));
  const stakeOk = stake > 0 && stake <= maxStake;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(6,6,14,0.92)' }} onClick={onClose}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0B0B14', border: '1px solid #C9A84C55' }}>
        <div className="px-5 py-3" style={{ background: 'linear-gradient(135deg,#171206,#0B0B14)', borderBottom: '1px solid #1d1d2f' }}>
          <div className="text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>🎯 PALPITE</div>
          <div className="text-[11px]" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Chute o placar. Acertou o resultado → {BET_OUTCOME_MULT}× · placar exato → {BET_EXACT_MULT}×.</div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Stepper label={homeName} value={hg} set={setHg} max={BET_MAX_GOALS} />
            <span className="text-xl font-black text-gray-600">×</span>
            <Stepper label={awayName} value={ag} set={setAg} max={BET_MAX_GOALS} />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold tracking-widest mb-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              <span>VALOR APOSTADO</span><span>resta na rodada: {remainingCap} · saldo: {points}</span>
            </div>
            <input type="number" min={1} max={maxStake} value={stake}
              onChange={e => setStake(Math.max(0, Math.min(maxStake, Math.floor(Number(e.target.value) || 0))))}
              className="w-full px-3 py-2 rounded-lg text-lg font-black tabular-nums"
              style={{ background: '#07070f', border: `1px solid ${stakeOk ? '#C9A84C55' : '#EF444455'}`, color: '#FFF', fontFamily: 'Bebas Neue, sans-serif' }} />
            <div className="mt-1 text-[11px]" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
              Ganho potencial: {Math.round(stake * BET_OUTCOME_MULT)} (resultado) · {Math.round(stake * BET_EXACT_MULT)} (placar)
            </div>
          </div>

          <div className="flex gap-2">
            <button disabled={!stakeOk} onClick={() => stakeOk && onConfirm(hg, ag, stake)}
              className="flex-1 py-2.5 rounded-lg font-black tracking-widest disabled:opacity-40"
              style={{ fontFamily: 'Bebas Neue, sans-serif', background: '#C9A84C', color: '#080810' }}>
              {existing ? 'ATUALIZAR PALPITE' : 'CONFIRMAR PALPITE'}
            </button>
            {existing && onCancelBet && (
              <button onClick={onCancelBet} className="px-3 py-2.5 rounded-lg font-black" style={{ fontFamily: 'Rajdhani, sans-serif', background: '#1A1A2A', color: '#F87171', border: '1px solid #333' }}>
                🗑
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck** — `cd client && npx tsc --noEmit` → sem erros.

- [ ] **Step 3: Commit (usuário).**

---

### Task 5: UI — botão 🎯 + badge nos cards de fixture da liga (solo)

**Files:**
- Modify: `client/src/pages/LeaguePage.tsx` (aba `fixtures`, bloco de cada `currentRoundFixtures.map`, e imports)

**Interfaces:**
- Consumes: `BetSlipModal`, `buildLeagueMatchKey`, `roundStakeUsed`, `BET_ROUND_CAP`, `Bet` de `../lib/bets` e `../components/game/BetSlipModal`.
- Usa `state.bets`, `dispatch({ type: 'PLACE_BET' | 'CANCEL_BET' })`.

- [ ] **Step 1: Imports + estado do slip**

No topo de `LeaguePage.tsx` adicionar:
```ts
import BetSlipModal from '../components/game/BetSlipModal';
import { buildLeagueMatchKey, roundStakeUsed, BET_ROUND_CAP, Bet } from '../lib/bets';
```
E, junto aos outros `useState` do componente:
```ts
  const [betSlip, setBetSlip] = useState<{ matchKey: string; homeName: string; awayName: string } | null>(null);
```
Helpers logo abaixo (usam `state.bets`, `leagueRound`, `dispatch`):
```ts
  const bets = state.bets ?? [];
  const betPrefix = `L${leagueRound}:`;
  const remainingCap = BET_ROUND_CAP - roundStakeUsed(bets, betPrefix);
  const betFor = (matchKey: string): Bet | undefined => bets.find(b => b.matchKey === matchKey);
```

- [ ] **Step 2: Botão/badge no card de fixture**

Dentro do `.map` das `currentRoundFixtures`, logo após o bloco "Away Team" (antes de fechar o `<div>` do card) — mas o card atual usa layout de 3 colunas; adicionar uma linha inferior. Envolver o conteúdo atual e acrescentar uma faixa. Concretamente, ao final do card (antes do `</div>` que fecha o card de fixture), inserir:

```tsx
                  {/* 🎯 Palpite — só em jogo ainda não decidido e enquanto a rodada não travou */}
                  {(() => {
                    const matchKey = buildLeagueMatchKey(leagueRound, fixture.homeTeamId, fixture.awayTeamId);
                    const myBet = betFor(matchKey);
                    if (fixture.played) {
                      // Pós-jogo: badge só quando o placar já pode ser revelado (mesma trava de score).
                      if (!myBet || hideRoundScore || !myBet.revealed) {
                        return myBet && !myBet.revealed
                          ? <div className="mt-2 text-center text-[10px] font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>🎯 palpite em andamento</div>
                          : null;
                      }
                      const txt = myBet.tier === 'exact' ? `✅ Palpite: placar exato (+${myBet.payout})`
                        : myBet.tier === 'outcome' ? `✅ Palpite: resultado certo (+${myBet.payout})`
                        : `❌ Palpite perdido (−${myBet.stake})`;
                      const col = myBet.won ? '#22C55E' : '#EF4444';
                      return <div className="mt-2 text-center text-[11px] font-black" style={{ color: col, fontFamily: 'Rajdhani, sans-serif' }}>{txt}</div>;
                    }
                    // Pré-jogo: botão de apostar/editar.
                    return (
                      <div className="mt-2 text-center">
                        <button onClick={() => setBetSlip({ matchKey, homeName, awayName })}
                          className="px-3 py-1 rounded-lg text-[11px] font-black tracking-wider transition-transform hover:scale-[1.03]"
                          style={{ fontFamily: 'Rajdhani, sans-serif', background: myBet ? '#C9A84C22' : '#0F0F1A', color: '#E8C84A', border: '1px solid #C9A84C55' }}>
                          {myBet ? `🎯 Palpite: ${myBet.homeGoals}-${myBet.awayGoals} · ${myBet.stake} (editar)` : '🎯 Palpitar'}
                        </button>
                      </div>
                    );
                  })()}
```
Obs.: o card de fixture atual é um flex de 3 colunas numa linha. Para caber a faixa inferior, trocar o container do card de `className="p-4 rounded-xl flex items-center justify-between ..."` para `className="p-4 rounded-xl ..."` e envolver as 3 colunas (Home/Score/Away) num `<div className="flex items-center justify-between">...</div>`. A faixa 🎯 fica como irmã dessa div, dentro do card.

- [ ] **Step 3: Render do modal**

Perto do fim do JSX de `LeaguePage` (junto ao `<AnimatePresence>` do `detailsMatch`/reforço), adicionar:
```tsx
      <AnimatePresence>
        {betSlip && (() => {
          const myBet = betFor(betSlip.matchKey);
          const capLeft = remainingCap + (myBet?.stake ?? 0); // editar reaproveita o próprio stake
          return (
            <BetSlipModal
              homeName={betSlip.homeName} awayName={betSlip.awayName} existing={myBet}
              remainingCap={capLeft} points={state.points}
              onConfirm={(hg, ag, stake) => {
                if (online) shopPlaceBetOnline(betSlip.matchKey, hg, ag, stake);
                else dispatch({ type: 'PLACE_BET', matchKey: betSlip.matchKey, homeGoals: hg, awayGoals: ag, stake });
                setBetSlip(null);
              }}
              onCancelBet={myBet ? () => { if (online) shopCancelBetOnline(betSlip.matchKey); else dispatch({ type: 'CANCEL_BET', matchKey: betSlip.matchKey }); setBetSlip(null); } : undefined}
              onClose={() => setBetSlip(null)}
            />
          );
        })()}
      </AnimatePresence>
```
(As funções `shopPlaceBetOnline`/`shopCancelBetOnline` vêm do `useGame()` — criadas na Task 7. Até lá, no solo, `online` é false e usa `dispatch`.)

- [ ] **Step 4: Typecheck** — `cd client && npx tsc --noEmit`. Enquanto a Task 7 não existir, referencie `shopPlaceBetOnline`/`shopCancelBetOnline` só dentro do ramo `online`; para não quebrar o typecheck agora, destructure-os do `useGame()` já nesta task (serão adicionados ao contexto na Task 7) — **ou** implemente a Task 7 antes da Task 5. Recomendado: fazer a Task 7 (contexto/servidor) e só depois plugar a UI. Ver ordem no fim do plano.

- [ ] **Step 5: Rodar o app e testar no solo** — `cd client && npm run dev` → apostar em jogos da rodada, editar/cancelar, jogar a rodada, ver crédito só ao terminar e o badge correto. (Ver skill `run`.)

- [ ] **Step 6: Commit (usuário).**

---

### Task 6: Servidor — `bets`/`pendingMatchPoints` no `RoomPlayer`, handlers `place_bet`/`cancel_bet`

**Files:**
- Modify: `server/handlers.ts`

**Interfaces:**
- Consumes: `Bet`, `buildLeagueMatchKey`, `canPlaceStake` de `../client/src/lib/bets.js`; `settleBet`.
- Produces: campos `bets: Bet[]` e `pendingMatchPoints?: number` em `RoomPlayer`; sockets `place_bet`/`cancel_bet`.

- [ ] **Step 1: Tipos + init/reset**

1. Import (junto ao import de `../client/src/lib/shop.js`):
```ts
import { Bet, buildLeagueMatchKey, buildKnockoutMatchKey, canPlaceStake, settleBet } from "../client/src/lib/bets.js";
```
2. Em `interface RoomPlayer`, após `pendingPack: ...`:
```ts
  bets: Bet[];
  pendingMatchPoints?: number; // pontos da partida calculados, NÃO creditados até a revelação
```
3. Onde jogadores são criados (procurar por `pendingPack: null` na criação do RoomPlayer, ~linha 323 e em `restart_room` ~1070), adicionar `bets: [],` e `pendingMatchPoints: undefined,`. No `restart_room`, resetar `p.bets = []; p.pendingMatchPoints = undefined;`.

- [ ] **Step 2: Handlers place_bet / cancel_bet**

Adicionar (perto do handler `shop_remove_variant`):
```ts
    socket.on("place_bet", ({ roomCode, matchKey, homeGoals, awayGoals, stake }: { roomCode: string; matchKey: string; homeGoals: number; awayGoals: number; stake: number }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'league') return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      if (!Number.isInteger(stake) || stake <= 0 || !Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) return;
      // Só aposta em jogo da rodada atual ainda NÃO jogado.
      const fx = room.leagueFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === matchKey);
      if (!fx || fx.round !== room.leagueRound || fx.played) return;
      const prefix = `L${room.leagueRound}:`;
      const existing = player.bets.find(b => b.matchKey === matchKey);
      const escrowDelta = stake - (existing?.stake ?? 0);
      if (escrowDelta > player.points) return;
      if (!canPlaceStake(player.bets, prefix, matchKey, stake)) return;
      const bet: Bet = { matchKey, homeGoals, awayGoals, stake };
      player.bets = existing ? player.bets.map(b => b.matchKey === matchKey ? bet : b) : [...player.bets, bet];
      player.points -= escrowDelta;
      socket.emit("room_updated", room); // só o autor (não vaza pros outros)
    });

    socket.on("cancel_bet", ({ roomCode, matchKey }: { roomCode: string; matchKey: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      const existing = player.bets.find(b => b.matchKey === matchKey);
      if (!existing || existing.settled) return;
      player.points += existing.stake;
      player.bets = player.bets.filter(b => b.matchKey !== matchKey);
      socket.emit("room_updated", room);
    });
```

- [ ] **Step 3: Typecheck do servidor** — na raiz `npm run build` (compila cliente + servidor). Expected: sem erros de tipo.

- [ ] **Step 4: Commit (usuário).**

---

### Task 7: Cliente — emits online + sync de `bets` em `SET_ONLINE_STATE`

**Files:**
- Modify: `client/src/contexts/GameContext.tsx`

**Interfaces:**
- Produces no `useGame()`: `shopPlaceBetOnline(matchKey, homeGoals, awayGoals, stake)`, `shopCancelBetOnline(matchKey)`.
- Sync: `bets` do `me` no `SET_ONLINE_STATE`.

- [ ] **Step 1: Sync**

No `SET_ONLINE_STATE`, junto de `pendingPack: me ? (me.pendingPack ?? null) : state.pendingPack,` adicionar:
```ts
        bets: me ? (me.bets ?? []) : state.bets,
```

- [ ] **Step 2: Emits + expor no contexto**

Perto de `shopRemoveVariantOnline`:
```ts
  const shopPlaceBetOnline = useCallback((matchKey: string, homeGoals: number, awayGoals: number, stake: number) => {
    if (socketRef.current && state.roomCode) socketRef.current.emit("place_bet", { roomCode: state.roomCode, matchKey, homeGoals, awayGoals, stake });
  }, [state.roomCode]);
  const shopCancelBetOnline = useCallback((matchKey: string) => {
    if (socketRef.current && state.roomCode) socketRef.current.emit("cancel_bet", { roomCode: state.roomCode, matchKey });
  }, [state.roomCode]);
```
Adicionar ambos ao objeto `value` do provider e à interface do contexto (assinaturas):
```ts
  shopPlaceBetOnline: (matchKey: string, homeGoals: number, awayGoals: number, stake: number) => void;
  shopCancelBetOnline: (matchKey: string) => void;
```
E na Task 5, destructure `shopPlaceBetOnline, shopCancelBetOnline` do `useGame()`.

- [ ] **Step 3: Typecheck** — `cd client && npx tsc --noEmit` → sem erros. (Agora a Task 5 compila.)

- [ ] **Step 4: Commit (usuário).**

---

### Task 8: Servidor — liquidação sem crédito em `play_round` + fix do spoiler dos pontos

**Files:**
- Modify: `server/handlers.ts` (`play_round`, ~linhas 893-911; `player_match_watched`, ~1032-1049)

**Interfaces:**
- Consumes: `settleBet`, `buildLeagueMatchKey`.
- Produces: função `creditLeagueRoundIfAllWatched(room)`.

- [ ] **Step 1: `play_round` — não creditar; guardar pendente e liquidar palpites**

No bloco `if (simulatedAny) { ... room.players.forEach(p => { ... }) }`, trocar:
```ts
          if (fixture?.result) {
            const mp = computeMatchPoints(fixture.result, p.team.id);
            p.points += mp.total;
            p.lastMatchPoints = mp;
          }
```
por:
```ts
          if (fixture?.result) {
            const mp = computeMatchPoints(fixture.result, p.team.id);
            // FIX anti-spoiler: NÃO credita agora; guarda como pendente até a revelação.
            p.pendingMatchPoints = mp.total;
            p.lastMatchPoints = mp; // resumo do PRÓPRIO jogo (exibido após assistir; não é spoiler)
          }
          // 🎯 Liquida (sem creditar) os palpites da rodada deste jogador.
          const betPrefix = `L${room.leagueRound}:`;
          p.bets = p.bets.map(b => {
            if (b.revealed || b.settled || !b.matchKey.startsWith(betPrefix)) return b;
            const fx = room.leagueFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === b.matchKey);
            if (!fx?.result) return b;
            const r = settleBet(b, fx.result);
            return { ...b, settled: true, won: r.won, tier: r.tier, payout: r.payout };
          });
```

- [ ] **Step 2: Função de crédito na revelação**

Adicionar perto de `knockoutWatchStatus`:
```ts
// Revelação da rodada de LIGA: quando todos os humanos conectados com jogo na rodada já
// assistiram, credita de uma vez os pontos da partida (pendentes) + os ganhos dos palpites.
// Idempotente: zera pendingMatchPoints e marca bets revealed após creditar.
function creditLeagueRoundIfAllWatched(room: RoomState): void {
  const roundFixtures = room.leagueFixtures.filter(f => f.round === room.leagueRound);
  const withFixture = room.players.filter(p => p.connected && roundFixtures.some(f => f.homeTeamId === p.id || f.awayTeamId === p.id));
  const allWatched = withFixture.length > 0 && withFixture.every(p => room.watchedRoundPlayers.includes(p.id));
  if (!allWatched) return;
  const betPrefix = `L${room.leagueRound}:`;
  room.players.forEach(p => {
    if (p.pendingMatchPoints != null) { p.points += p.pendingMatchPoints; p.pendingMatchPoints = undefined; }
    p.bets = p.bets.map(b => {
      if (b.settled && !b.revealed && b.matchKey.startsWith(betPrefix)) {
        p.points += b.payout ?? 0;
        return { ...b, revealed: true };
      }
      return b;
    });
  });
}
```

- [ ] **Step 3: Chamar no `player_match_watched`**

No handler `player_match_watched`, dentro do ramo `if (type === 'league')`, após adicionar o jogador em `watchedRoundPlayers`, antes do `io.to(roomCode).emit`:
```ts
        creditLeagueRoundIfAllWatched(room);
```

- [ ] **Step 4: Build** — na raiz `npm run build`. Expected: sem erros.

- [ ] **Step 5: Teste manual online (2 abas)** — host inicia a rodada; conferir que **nenhum saldo muda** (nem pontos da partida, nem palpite) até TODOS assistirem; ao completar, pontos + ganhos + badges aparecem juntos. Palpite aberto só antes do host iniciar.

- [ ] **Step 6: Commit (usuário).**

---

### Task 9: Fechamento Fase 1 — regressões e verificação total

**Files:** —

- [ ] **Step 1:** `cd client && npx tsc --noEmit` → sem erros.
- [ ] **Step 2:** `cd client && npx vitest run` → todos verdes (bets, betting-reducer, balance e demais).
- [ ] **Step 3:** raiz `npm run build` → cliente + servidor sem erros.
- [ ] **Step 4:** Manual solo: apostar em vários jogos, respeitar teto (200), jogar rodada, crédito só na revelação, badges corretos, editar/cancelar antes de jogar.
- [ ] **Step 5: Commit (usuário).**

---

## FASE 2 — MATA-MATA (mesma mecânica, por perna)

Reusa `bets.ts`, `BetSlipModal`, e as ações/emits. `matchKey = K{matchId}:{leg}`. Trava/liquida quando a perna é jogada; revela no gate de "todos assistiram a perna".

### Task 10: Solo — palpite nas pernas do mata-mata (liquida no `FINISH_KNOCKOUT_MATCH`)

**Files:**
- Modify: `client/src/contexts/GameContext.tsx` (`FINISH_KNOCKOUT_MATCH`, ~883-911)
- Test: `client/src/contexts/betting-reducer.test.ts`

**Interfaces:**
- Consumes: `settleBet`, `buildKnockoutMatchKey`.
- A liquidação usa o `action.result` (a perna que o jogador acabou de ver) e, para os demais confrontos da rodada de mata-mata, os `result`/`leg1`/`leg2` já presentes no bracket.

- [ ] **Step 1: Teste que falha** — em `betting-reducer.test.ts`, um caso montando `state.bets` com `matchKey` `K<id>:1` e um `knockoutBracket` mínimo com a perna resolvida; após `FINISH_KNOCKOUT_MATCH`, o bet fica `revealed` e o payout entra em `points`. (Modelar o bracket como `{ playoffs:[{id:'t', homeTeamId:'me', awayTeamId:'b', leg1:{homeTeamId:'me',awayTeamId:'b',homeGoals:2,awayGoals:0} }], round16:[], quarterFinals:[], semiFinals:[], final:null, currentRound:'playoffs', currentLeg:1 }`.)

```ts
describe('FINISH_KNOCKOUT_MATCH liquida palpites de perna', () => {
  it('credita palpite certo da perna e marca revealed', () => {
    const bracket: any = { playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'b', leg1: { homeTeamId: 'me', awayTeamId: 'b', homeGoals: 2, awayGoals: 0, events: [], playerStats: {} } }], round16: [], quarterFinals: [], semiFinals: [], final: null, currentRound: 'playoffs', currentLeg: 1 };
    const state = base({ points: 100, playerTeam: { id: 'me', players: [] } as any, knockoutBracket: bracket,
      bets: [{ matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40 }] });
    const finished = gameReducer(state, { type: 'FINISH_KNOCKOUT_MATCH', result: { homeTeamId: 'me', awayTeamId: 'b', homeGoals: 2, awayGoals: 0, events: [], playerStats: {} } } as any);
    const b = finished.bets.find(x => x.matchKey === 'Kt:1')!;
    expect(b.revealed).toBe(true);
    expect(b.tier).toBe('exact');
    expect(finished.points).toBeGreaterThanOrEqual(100 + Math.round(40 * 2.5));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** — no `FINISH_KNOCKOUT_MATCH`, antes do return que inclui `knockoutPointsPopup`, montar a lista de pernas resolvidas do bracket e liquidar+creditar os bets `K*` desta rodada:

```ts
      // 🎯 Palpite (mata-mata): liquida+credita as pernas já jogadas desta rodada (revelação no solo).
      const koTies: any[] = [
        ...(bracket.playoffs ?? []), ...(bracket.round16 ?? []),
        ...bracket.quarterFinals, ...bracket.semiFinals, ...(bracket.final ? [bracket.final] : []),
      ];
      const legResult = (tie: any, leg: number) => leg === 2 ? tie.leg2 : (tie.leg1 ?? tie.result);
      let koBetWinnings = 0;
      const koBets = state.bets.map(b => {
        if (b.revealed || !b.matchKey.startsWith('K')) return b;
        const [id, legStr] = b.matchKey.slice(1).split(':');
        const tie = koTies.find(t => t.id === id);
        const res = tie ? legResult(tie, Number(legStr)) : undefined;
        if (!res) return b;
        const r = settleBet(b, res);
        koBetWinnings += r.payout;
        return { ...b, settled: true, revealed: true, won: r.won, tier: r.tier, payout: r.payout };
      });
```
E somar `koBetWinnings` ao `points` do return e trocar `bets: koBets`. (No case `FINISH_KNOCKOUT_MATCH` o `bracket` já está em escopo; se não, usar `state.knockoutBracket`.)

Nota importante sobre a volta: `tie.leg2` já tem `homeTeamId/awayTeamId` invertidos (mando da volta) — `settleBet` usa o placar orientado ao `result`, então o palpite `K{id}:2` deve ter sido feito na perspectiva do mando da VOLTA (a UI da Task 11 passa `homeName/awayName` já invertidos para a volta).

- [ ] **Step 4: Rodar e ver passar. Step 5: Typecheck. Step 6: Commit (usuário).**

---

### Task 11: UI mata-mata — botão 🎯 + badge por perna

**Files:**
- Modify: `client/src/components/game/KnockoutTiesTab.tsx`

**Interfaces:**
- Consumes: `BetSlipModal`, `buildKnockoutMatchKey`, `roundStakeUsed`, `BET_ROUND_CAP`, `Bet`; `useGame()` (`state.bets`, `dispatch`, `shopPlaceBetOnline`, `shopCancelBetOnline`).

- [ ] **Step 1:** Adicionar estado `betSlip` e, em cada `match` NÃO jogado da perna atual (`currentLeg`), um botão 🎯 que abre o `BetSlipModal` com `matchKey = buildKnockoutMatchKey(match.id, currentLeg)`. Para a **volta** (`currentLeg === 2`), passar `homeName = awayName-da-ida` e vice-versa (mando invertido). Após a perna revelada (mesmo gate de score já usado na aba), mostrar o badge de resultado (igual à Task 5). Teto por rodada usa prefixo `K` da rodada corrente — como o mata-mata tem poucas partidas, usar `roundStakeUsed(bets, 'K')` filtrando só as pernas da rodada ativa (prefixo por ids das `matches` atuais). Simplificação aceitável: teto global `BET_ROUND_CAP` sobre todos os bets `K*` não revelados.

- [ ] **Step 2:** Render do `BetSlipModal` no fim do componente (igual à Task 5), roteando online/solo.

- [ ] **Step 3: Typecheck.** **Step 4: Manual (solo + online).** **Step 5: Commit (usuário).**

---

### Task 12: Servidor — palpite de mata-mata (liquida em `play_knockout_leg`, credita no gate da perna)

**Files:**
- Modify: `server/handlers.ts` (`play_knockout_leg` ~968-1010; `player_match_watched` ramo `knockout`)

**Interfaces:**
- Produces: `creditKnockoutLegIfAllWatched(room)` análoga à da liga, usando `knockoutWatchStatus(room)` e `watchedKnockoutLegPlayers`.

- [ ] **Step 1:** Em `place_bet`/`cancel_bet`, permitir também `room.phase === 'knockout'` e validar contra as pernas ativas (`getActiveKnockoutMatches`) não jogadas; `matchKey` via `buildKnockoutMatchKey(match.id, room.knockoutBracket.currentLeg)`.
- [ ] **Step 2:** No `play_knockout_leg`, trocar o crédito imediato (`p.points += computeMatchPoints(legRes, ...)`, ~linha 1000) por: guardar `p.pendingMatchPoints` e liquidar (sem creditar) os bets `K*` da perna atual com `settleBet`.
- [ ] **Step 3:** Adicionar `creditKnockoutLegIfAllWatched(room)` (usa `knockoutWatchStatus(room).allWatched`; credita `pendingMatchPoints` + payouts dos bets `K*` não revelados; idempotente) e chamá-la no `player_match_watched` ramo `knockout`, antes do emit.
- [ ] **Step 4: Build.** **Step 5: Manual online.** **Step 6: Commit (usuário).**

---

### Task 13: Fechamento total

- [ ] `cd client && npx tsc --noEmit` limpo; `cd client && npx vitest run` verde; raiz `npm run build` limpo.
- [ ] Manual solo + online, liga + mata-mata: apostar, teto, trava, crédito só na revelação, badges, e o fix do spoiler (saldo não muda antes de todos assistirem).
- [ ] Commit final (usuário).

---

## Ordem recomendada de execução
Fase 1: **1 → 2 → 3 → 6 → 7 → 4 → 5 → 8 → 9** (fazer contexto/servidor antes de plugar a UI, pra o typecheck da UI já enxergar `shopPlaceBetOnline`/`shopCancelBetOnline`). Fase 2: **10 → 12 → 11 → 13**.

## Self-review (cobertura da spec)
- §2 Mecânica/§8 settleBet → Task 1. §3 Escrow → Tasks 2/6. §4 Teto → Task 1 (`canPlaceStake`) + 2/6. §5 Timing/crédito diferido (solo) → Task 3; (online) → Task 8; fix spoiler pontos → Task 8. §6 Dados (solo/online + `pendingMatchPoints`) → Tasks 2/6/7. §7 Ações/emits → Tasks 2/6/7. §9 UI → Tasks 4/5/11. §10 Fases → 1-9 (liga) / 10-13 (mata-mata). §11 Testes → Tasks 1/2/3/10. Sem lacunas.
