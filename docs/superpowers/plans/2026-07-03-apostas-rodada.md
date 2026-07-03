# Apostas da Rodada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o jogador aposte pontos em QUALQUER partida da rodada da fase de liga (resultado V/E/D + bônus de placar exato), com pagamento **fixo** (nunca revela força dos times), funcionando em solo e online sem furar o anti-spoiler.

**Architecture:** Uma lib pura nova (`betting.ts`) com tipos + constantes de pagamento fixo + `resolveBet` (testável). O estado das apostas vive no `GameState` (solo) e em `RoomPlayer` (online), espelhado via `SET_ONLINE_STATE` como `points`/`reinforcementOptions` já são. A aposta é feita ANTES da rodada ser jogada e resolvida quando TODOS os placares da rodada existem — em solo no `FINISH_LEAGUE_MATCH` (que já simula tudo), no online no `play_round` (servidor autoritativo). No online, o painel de RESULTADO das apostas é escondido pelo mesmo gate anti-spoiler (`allPlayersWatched`) que já esconde os placares.

**Tech Stack:** TypeScript, React (Context + reducer), Vite, socket.io (servidor Node), Vitest.

## Global Constraints

- **Pagamento FIXO, nunca por odds** — o multiplicador depende só do TIPO de acerto, nunca dos times, pra não vazar diferença de força. Vitória (casa OU fora) `2×`, Empate `3×`, Placar exato `5×`. Valores em constantes ajustáveis.
- **Qualquer partida da rodada** — a do próprio jogador e as dos outros/bots. Várias apostas por rodada.
- **Teto por aposta** — `BET_MAX_STAKE` (200), mínimo `BET_MIN_STAKE` (10); nunca apostar mais pontos do que possui.
- **Anti-spoiler intacto** — no online, o RESULTADO das apostas (que revela placares de outras partidas) só aparece quando `allPlayersWatched` é verdadeiro. A COLOCAÇÃO da aposta só é possível enquanto a rodada não foi jogada.
- **Não commitar** — o usuário commita. Rodar `npx vitest run`, `cd client && npx tsc --noEmit` e `npm run build` (raiz) ao fim.
- **Determinismo dos testes** — `betting.test.ts` é puro (sem RNG). Reducer/servidor testados com resultados fixos, sem `Math.random`.

---

## File Structure

- **Create** `client/src/lib/betting.ts` — tipos (`Bet`, `BetResult`, `BetOutcome`), constantes de pagamento, `outcomeOf`, `resolveBet`, `fixtureId`, `canPlaceBet`. Importável pelo cliente E pelo servidor (via `../client/src/lib/betting.js`, mesmo padrão do `shop.ts`).
- **Create** `client/src/lib/betting.test.ts` — testes unitários puros de `resolveBet`/`outcomeOf`/`fixtureId`/`canPlaceBet`.
- **Create** `client/src/components/game/BettingPanel.tsx` — painel de COLOCAÇÃO (lista as partidas da rodada, escolhe V/E/D + placar + stake).
- **Create** `client/src/components/game/BetResultsPanel.tsx` — painel de RESULTADO (mostra cada aposta resolvida: seu palpite, placar real, ✓/✗, pago).
- **Modify** `client/src/contexts/GameContext.tsx` — campos `bets`/`betResults` no `GameState`, actions `PLACE_BET`/`CANCEL_BET`, resolução em `FINISH_LEAGUE_MATCH`, sync em `SET_ONLINE_STATE`, funções online `placeBetOnline`/`cancelBetOnline`.
- **Modify** `server/handlers.ts` — campos `bets`/`betResults` no `RoomPlayer`, handlers `place_bet`/`cancel_bet`, resolução no `play_round`.
- **Modify** `client/src/pages/LeaguePage.tsx` — render do `BettingPanel` (pré-rodada) e do `BetResultsPanel` (pós-rodada, gated no online).

---

## Task 1: Lib de apostas pura (`betting.ts`) + testes

**Files:**
- Create: `client/src/lib/betting.ts`
- Test: `client/src/lib/betting.test.ts`

**Interfaces:**
- Produces: `type BetOutcome`, `interface Bet`, `interface BetResult`, `BET_MIN_STAKE`, `BET_MAX_STAKE`, `BET_PAYOUT_WIN`, `BET_PAYOUT_DRAW`, `BET_PAYOUT_EXACT`, `outcomeOf(home,away): BetOutcome`, `resolveBet(bet, home, away): BetResult`, `fixtureId(round, homeTeamId, awayTeamId): string`, `canPlaceBet(stake, points): boolean`.

- [ ] **Step 1: Write the failing test**

Create `client/src/lib/betting.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  outcomeOf, resolveBet, fixtureId, canPlaceBet,
  BET_MAX_STAKE, BET_MIN_STAKE, BET_PAYOUT_WIN, BET_PAYOUT_DRAW, BET_PAYOUT_EXACT,
  type Bet,
} from './betting';

const bet = (over: Partial<Bet> = {}): Bet => ({
  fixtureId: 'r1:a-b', round: 1, homeTeamId: 'a', awayTeamId: 'b',
  outcome: 'home', stake: 100, ...over,
});

describe('outcomeOf', () => {
  it('maps score to outcome', () => {
    expect(outcomeOf(2, 1)).toBe('home');
    expect(outcomeOf(0, 3)).toBe('away');
    expect(outcomeOf(1, 1)).toBe('draw');
  });
});

describe('resolveBet — fixed payouts, never odds', () => {
  it('pays WIN multiplier when the outcome is right (home)', () => {
    const r = resolveBet(bet({ outcome: 'home' }), 2, 0);
    expect(r.won).toBe(true);
    expect(r.exactHit).toBe(false);
    expect(r.payout).toBe(100 * BET_PAYOUT_WIN);
  });
  it('pays the SAME for a home win and an away win (no strength leak)', () => {
    const home = resolveBet(bet({ outcome: 'home', stake: 50 }), 1, 0);
    const away = resolveBet(bet({ outcome: 'away', stake: 50 }), 0, 1);
    expect(home.payout).toBe(away.payout);
  });
  it('pays DRAW multiplier (higher) for a correct draw', () => {
    const r = resolveBet(bet({ outcome: 'draw' }), 1, 1);
    expect(r.payout).toBe(100 * BET_PAYOUT_DRAW);
  });
  it('pays EXACT multiplier when the exact score is nailed', () => {
    const r = resolveBet(bet({ outcome: 'home', exactScore: { home: 2, away: 1 } }), 2, 1);
    expect(r.exactHit).toBe(true);
    expect(r.payout).toBe(100 * BET_PAYOUT_EXACT);
  });
  it('falls back to base payout when outcome is right but score is wrong', () => {
    const r = resolveBet(bet({ outcome: 'home', exactScore: { home: 3, away: 0 } }), 2, 1);
    expect(r.won).toBe(true);
    expect(r.exactHit).toBe(false);
    expect(r.payout).toBe(100 * BET_PAYOUT_WIN);
  });
  it('pays 0 when the outcome is wrong', () => {
    const r = resolveBet(bet({ outcome: 'away' }), 2, 1);
    expect(r.won).toBe(false);
    expect(r.payout).toBe(0);
  });
  it('an inconsistent bet (score contradicts outcome) just loses when actual matches neither', () => {
    const r = resolveBet(bet({ outcome: 'away', exactScore: { home: 2, away: 1 } }), 2, 1);
    expect(r.won).toBe(false);
    expect(r.payout).toBe(0);
  });
});

describe('fixtureId', () => {
  it('is stable and unique per round+pairing', () => {
    expect(fixtureId(3, 'real', 'psg')).toBe('r3:real-psg');
    expect(fixtureId(3, 'real', 'psg')).not.toBe(fixtureId(3, 'psg', 'real'));
  });
});

describe('canPlaceBet', () => {
  it('requires stake within [MIN,MAX] and covered by points', () => {
    expect(canPlaceBet(BET_MIN_STAKE, 1000)).toBe(true);
    expect(canPlaceBet(BET_MAX_STAKE, 1000)).toBe(true);
    expect(canPlaceBet(BET_MIN_STAKE - 1, 1000)).toBe(false);
    expect(canPlaceBet(BET_MAX_STAKE + 1, 1000)).toBe(false);
    expect(canPlaceBet(200, 150)).toBe(false); // not enough points
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/betting.test.ts`
Expected: FAIL — `Cannot find module './betting'`.

- [ ] **Step 3: Write the implementation**

Create `client/src/lib/betting.ts`:

```ts
// UCL Immortals — Apostas da Rodada
// Pagamento FIXO por tipo de acerto (nunca por odds), pra não revelar a força dos times.

export type BetOutcome = 'home' | 'draw' | 'away';

export interface Bet {
  fixtureId: string;                 // id estável da partida (ver fixtureId())
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  outcome: BetOutcome;               // palpite obrigatório
  exactScore?: { home: number; away: number }; // add-on opcional de placar exato
  stake: number;                     // pontos apostados (debitados na colocação)
}

export interface BetResult {
  bet: Bet;
  actualHome: number;
  actualAway: number;
  won: boolean;                      // acertou o resultado?
  exactHit: boolean;                 // cravou o placar?
  payout: number;                    // total creditado (0 se perdeu; inclui a devolução do stake)
}

// ── Pagamento FIXO (multiplicadores do stake). Ajustáveis. ──
export const BET_MIN_STAKE = 10;
export const BET_MAX_STAKE = 200;    // teto por aposta
export const BET_PAYOUT_WIN = 2;     // acertar vitória (casa OU fora — igual, sem vazar força)
export const BET_PAYOUT_DRAW = 3;    // acertar empate (mais raro → paga mais)
export const BET_PAYOUT_EXACT = 5;   // cravar o placar exato

export function outcomeOf(home: number, away: number): BetOutcome {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
}

export function resolveBet(bet: Bet, home: number, away: number): BetResult {
  const actual = outcomeOf(home, away);
  const won = bet.outcome === actual;
  const exactHit = !!bet.exactScore && bet.exactScore.home === home && bet.exactScore.away === away;
  let mult = 0;
  if (won) {
    if (exactHit) mult = BET_PAYOUT_EXACT;
    else mult = bet.outcome === 'draw' ? BET_PAYOUT_DRAW : BET_PAYOUT_WIN;
  }
  return { bet, actualHome: home, actualAway: away, won, exactHit, payout: Math.round(bet.stake * mult) };
}

export function fixtureId(round: number, homeTeamId: string, awayTeamId: string): string {
  return `r${round}:${homeTeamId}-${awayTeamId}`;
}

export function canPlaceBet(stake: number, points: number): boolean {
  return Number.isFinite(stake) && stake >= BET_MIN_STAKE && stake <= BET_MAX_STAKE && stake <= points;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/lib/betting.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 5: Commit** — (não commitar; o usuário commita. Deixe o working tree pronto pra revisão.)

---

## Task 2: Estado + reducer solo (colocar / cancelar / resolver)

**Files:**
- Modify: `client/src/contexts/GameContext.tsx`
- Test: `client/src/contexts/betting-reducer.test.ts` (Create)

**Interfaces:**
- Consumes: `Bet`, `BetResult`, `resolveBet`, `fixtureId`, `canPlaceBet` (Task 1).
- Produces: `GameState.bets: Bet[]`, `GameState.betResults: BetResult[] | null`; actions `{ type: 'PLACE_BET'; bet: Bet }`, `{ type: 'CANCEL_BET'; fixtureId: string }`. `FINISH_LEAGUE_MATCH` passa a creditar pagamentos e preencher `betResults`.

- [ ] **Step 1: Add the state fields + action types**

In `client/src/contexts/GameContext.tsx`, add the import near the other lib imports:

```ts
import { Bet, BetResult, resolveBet, canPlaceBet } from '../lib/betting';
```

Add to the `GameState` interface (after `reinforcementRerolls` at line ~91):

```ts
  // Apostas da rodada (fase de liga). `bets` = apostas pendentes da rodada atual (debitadas
  // na colocação); `betResults` = resolução da última rodada, mostrada no pós-rodada.
  bets: Bet[];
  betResults: BetResult[] | null;
```

Add to the `GameAction` union (near `SHOP_BUY_REROLL`):

```ts
  | { type: 'PLACE_BET'; bet: Bet }
  | { type: 'CANCEL_BET'; fixtureId: string }
```

Add to `initialState` (after `reinforcementRerolls: 0,`):

```ts
  bets: [],
  betResults: null,
```

- [ ] **Step 2: Write the failing reducer test**

Create `client/src/contexts/betting-reducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gameReducer, initialState } from './GameContext';
import { fixtureId, BET_PAYOUT_WIN } from '../lib/betting';
import type { Bet } from '../lib/betting';

// Minimal helpers — a player team + one bot + a round-1 fixture between them.
const mkTeam = (id: string) => ({
  id, name: id, players: [], coachId: 'default', formationId: '4-3-3', playStyle: 'balanced',
  captain: null, penaltyTaker: null, freeKickTaker: null,
} as any);

function baseState() {
  const player = mkTeam('me');
  const bot = mkTeam('bot');
  return {
    ...initialState,
    playerTeam: player,
    botTeams: [bot],
    points: 500,
    leagueRound: 1,
    leagueFixtures: [
      { round: 1, homeTeamId: 'me', awayTeamId: 'bot', played: false } as any,
    ],
  };
}

const bet = (over: Partial<Bet> = {}): Bet => ({
  fixtureId: fixtureId(1, 'me', 'bot'), round: 1, homeTeamId: 'me', awayTeamId: 'bot',
  outcome: 'home', stake: 100, ...over,
});

describe('PLACE_BET', () => {
  it('debits points and stores the bet', () => {
    const s = gameReducer(baseState(), { type: 'PLACE_BET', bet: bet() });
    expect(s.points).toBe(400);
    expect(s.bets).toHaveLength(1);
  });
  it('rejects a stake over the cap or beyond points', () => {
    const s1 = gameReducer(baseState(), { type: 'PLACE_BET', bet: bet({ stake: 999 }) });
    expect(s1.bets).toHaveLength(0);
    expect(s1.points).toBe(500);
    const poor = { ...baseState(), points: 50 };
    const s2 = gameReducer(poor, { type: 'PLACE_BET', bet: bet({ stake: 100 }) });
    expect(s2.bets).toHaveLength(0);
  });
  it('replaces an existing bet on the same fixture (refunds the old stake first)', () => {
    let s = gameReducer(baseState(), { type: 'PLACE_BET', bet: bet({ stake: 100 }) });
    s = gameReducer(s, { type: 'PLACE_BET', bet: bet({ stake: 50, outcome: 'draw' }) });
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0].stake).toBe(50);
    expect(s.bets[0].outcome).toBe('draw');
    expect(s.points).toBe(450); // 500 - 50 (old 100 refunded before re-debit)
  });
});

describe('CANCEL_BET', () => {
  it('refunds and removes the bet', () => {
    let s = gameReducer(baseState(), { type: 'PLACE_BET', bet: bet({ stake: 100 }) });
    s = gameReducer(s, { type: 'CANCEL_BET', fixtureId: fixtureId(1, 'me', 'bot') });
    expect(s.bets).toHaveLength(0);
    expect(s.points).toBe(500);
  });
});

describe('FINISH_LEAGUE_MATCH resolves pending bets', () => {
  it('credits the payout for a won bet and clears pending bets', () => {
    const s0 = gameReducer(baseState(), { type: 'PLACE_BET', bet: bet({ outcome: 'home', stake: 100 }) });
    // player (home) beats bot 2-0 → home bet wins
    const result = { homeTeamId: 'me', awayTeamId: 'bot', homeGoals: 2, awayGoals: 0 } as any;
    const s = gameReducer(s0, { type: 'FINISH_LEAGUE_MATCH', result });
    // points after: 500 - 100 (stake) + match points + 100*WIN payout
    expect(s.betResults).not.toBeNull();
    expect(s.betResults!).toHaveLength(1);
    expect(s.betResults![0].won).toBe(true);
    expect(s.betResults![0].payout).toBe(100 * BET_PAYOUT_WIN);
    expect(s.bets).toHaveLength(0);
    // payout was credited on top of the post-stake balance
    expect(s.points).toBeGreaterThanOrEqual(400 + 100 * BET_PAYOUT_WIN);
  });
});
```

> If `gameReducer`/`initialState` are not currently exported from `GameContext.tsx`, export them: change `const initialState` → `export const initialState` and `function gameReducer` → `export function gameReducer`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run client/src/contexts/betting-reducer.test.ts`
Expected: FAIL — `PLACE_BET` not handled (points unchanged / bets undefined) and no `betResults`.

- [ ] **Step 4: Implement the reducer cases**

In `gameReducer`, add the two new cases (place near `SHOP_BUY_REROLL`):

```ts
    case 'PLACE_BET': {
      const b = action.bet;
      // refund any existing bet on the same fixture, then validate the new stake against
      // the refunded balance.
      const existing = state.bets.find(x => x.fixtureId === b.fixtureId);
      const refunded = state.points + (existing ? existing.stake : 0);
      if (!canPlaceBet(b.stake, refunded)) return state;
      const others = state.bets.filter(x => x.fixtureId !== b.fixtureId);
      return { ...state, points: refunded - b.stake, bets: [...others, b] };
    }

    case 'CANCEL_BET': {
      const existing = state.bets.find(x => x.fixtureId === action.fixtureId);
      if (!existing) return state;
      return {
        ...state,
        points: state.points + existing.stake,
        bets: state.bets.filter(x => x.fixtureId !== action.fixtureId),
      };
    }
```

In `FINISH_LEAGUE_MATCH` (line ~730), AFTER `allFixtures` is fully computed (all results simulated, line ~747) and BEFORE the `return`, resolve the pending bets. Replace the final `return { ...state, ... }` (lines ~761-772) with:

```ts
      // Resolve pending bets against this round's final results.
      let betPayout = 0;
      const betResults: BetResult[] = [];
      for (const bt of state.bets) {
        const fx = allFixtures.find(f =>
          f.round === bt.round && f.homeTeamId === bt.homeTeamId && f.awayTeamId === bt.awayTeamId);
        if (!fx?.result) continue;
        const r = resolveBet(bt, fx.result.homeGoals, fx.result.awayGoals);
        betResults.push(r);
        betPayout += r.payout;
      }

      return {
        ...state,
        phase: 'league',
        leagueFixtures: allFixtures,
        leagueStandings: standings,
        leagueResults: results,
        currentMatch: null,
        currentMatchTeams: null,
        reinforcementOptions,
        points: state.points + matchPoints.total + betPayout,
        lastMatchPoints: matchPoints,
        bets: [],
        betResults: betResults.length ? betResults : null,
      };
```

Also clear the previous round's `betResults` when a new round starts. In `ADVANCE_LEAGUE_ROUND` (line ~798):

```ts
    case 'ADVANCE_LEAGUE_ROUND': {
      return {
        ...state,
        leagueRound: Math.min(8, state.leagueRound + 1),
        betResults: null,
      };
    }
```

> Confirm `MatchResult` exposes `homeGoals`/`awayGoals` (used above). If the field names differ (e.g. `home`/`away`), adjust `resolveBet(bt, fx.result.homeGoals, fx.result.awayGoals)` accordingly — grep `interface MatchResult` in `gameEngine.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run client/src/contexts/betting-reducer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit** — (não commitar.)

---

## Task 3: UI solo — painel de colocação + painel de resultado

**Files:**
- Create: `client/src/components/game/BettingPanel.tsx`
- Create: `client/src/components/game/BetResultsPanel.tsx`
- Modify: `client/src/pages/LeaguePage.tsx`

**Interfaces:**
- Consumes: `useGame()` (state/dispatch), `Bet`, `fixtureId`, `outcomeOf`, `BET_MIN_STAKE`, `BET_MAX_STAKE`, `BET_PAYOUT_*` (Task 1), `<Crest crestId size/>` (existente), `getTeamById` (do contexto).
- Produces: `<BettingPanel />`, `<BetResultsPanel results={...} />`.

- [ ] **Step 1: Create the placement panel**

Create `client/src/components/game/BettingPanel.tsx`:

```tsx
// UCL Immortals — Apostas da Rodada (colocação). Aparece antes da rodada ser jogada.
import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import Crest from './Crest';
import {
  Bet, BetOutcome, fixtureId, canPlaceBet,
  BET_MIN_STAKE, BET_MAX_STAKE, BET_PAYOUT_WIN, BET_PAYOUT_DRAW, BET_PAYOUT_EXACT,
} from '../../lib/betting';

const STAKE_CHIPS = [10, 25, 50, 100, BET_MAX_STAKE];
const GOLD = '#C9A84C';

export default function BettingPanel() {
  const { state, dispatch, placeBetOnline, cancelBetOnline, getTeamById } = useGame();
  const online = state.mode === 'online';
  const [openFixture, setOpenFixture] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<BetOutcome>('home');
  const [stake, setStake] = useState<number>(50);
  const [useExact, setUseExact] = useState(false);
  const [exH, setExH] = useState(1);
  const [exA, setExA] = useState(0);

  const roundFixtures = state.leagueFixtures.filter(f => f.round === state.leagueRound);
  // Rodada já jogada? (se qualquer fixture da rodada tem resultado, fechou pra apostas)
  const roundPlayed = roundFixtures.some(f => f.played);
  if (roundPlayed || roundFixtures.length === 0) return null;

  const nameOf = (id: string) => getTeamById(id)?.name ?? id;
  const crestOf = (id: string) => getTeamById(id)?.crestId ?? null;
  const betOn = (fid: string) => state.bets.find(b => b.fixtureId === fid);

  const confirm = (home: string, away: string) => {
    const fid = fixtureId(state.leagueRound, home, away);
    const existing = betOn(fid);
    const budget = state.points + (existing ? existing.stake : 0);
    if (!canPlaceBet(stake, budget)) return;
    const bet: Bet = {
      fixtureId: fid, round: state.leagueRound, homeTeamId: home, awayTeamId: away,
      outcome, stake, ...(useExact ? { exactScore: { home: exH, away: exA } } : {}),
    };
    if (online) placeBetOnline(bet);
    else dispatch({ type: 'PLACE_BET', bet });
    setOpenFixture(null);
    setUseExact(false);
  };

  const cancel = (fid: string) => {
    if (online) cancelBetOnline(fid);
    else dispatch({ type: 'CANCEL_BET', fixtureId: fid });
  };

  return (
    <div style={{ background: '#0F0F1A', border: '1px solid #1A1A2A', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: GOLD, fontSize: 18 }}>
          🎲 APOSTAS DA RODADA
        </span>
        <span className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
          Vitória {BET_PAYOUT_WIN}× · Empate {BET_PAYOUT_DRAW}× · Placar {BET_PAYOUT_EXACT}×
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {roundFixtures.map(f => {
          const fid = fixtureId(state.leagueRound, f.homeTeamId, f.awayTeamId);
          const placed = betOn(fid);
          const isOpen = openFixture === fid;
          const labelOut = (o: BetOutcome) => o === 'home' ? nameOf(f.homeTeamId) : o === 'away' ? nameOf(f.awayTeamId) : 'Empate';
          return (
            <div key={fid} style={{ background: '#0A0A14', border: `1px solid ${placed ? GOLD : '#1A1A2A'}`, borderRadius: 10, padding: 10 }}>
              <div className="flex items-center gap-2">
                <Crest crestId={crestOf(f.homeTeamId)} size={22} />
                <span className="text-sm font-bold flex-1 text-right" style={{ color: '#DDD', fontFamily: 'Rajdhani, sans-serif' }}>{nameOf(f.homeTeamId)}</span>
                <span className="text-xs px-2" style={{ color: '#6A6A7A' }}>×</span>
                <span className="text-sm font-bold flex-1" style={{ color: '#DDD', fontFamily: 'Rajdhani, sans-serif' }}>{nameOf(f.awayTeamId)}</span>
                <Crest crestId={crestOf(f.awayTeamId)} size={22} />
                {placed ? (
                  <button onClick={() => cancel(fid)} className="ml-2 text-xs px-2 py-1 rounded" style={{ background: '#2A1414', color: '#EF6A6A' }}>✕</button>
                ) : (
                  <button onClick={() => { setOpenFixture(isOpen ? null : fid); setOutcome('home'); setStake(50); }}
                    className="ml-2 text-xs px-3 py-1 rounded font-bold" style={{ background: GOLD, color: '#0A0A14' }}>
                    {isOpen ? 'Fechar' : 'Apostar'}
                  </button>
                )}
              </div>

              {placed && (
                <div className="mt-1 text-xs" style={{ color: GOLD, fontFamily: 'Rajdhani, sans-serif' }}>
                  Palpite: <b>{labelOut(placed.outcome)}</b>{placed.exactScore ? ` (${placed.exactScore.home}-${placed.exactScore.away})` : ''} · {placed.stake} pts
                </div>
              )}

              {isOpen && !placed && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    {(['home', 'draw', 'away'] as BetOutcome[]).map(o => (
                      <button key={o} onClick={() => setOutcome(o)} className="flex-1 text-xs py-2 rounded font-bold"
                        style={{ background: outcome === o ? GOLD : '#1A1A2A', color: outcome === o ? '#0A0A14' : '#AAA' }}>
                        {labelOut(o)}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-xs" style={{ color: '#AAA' }}>
                    <input type="checkbox" checked={useExact} onChange={e => setUseExact(e.target.checked)} />
                    Cravar placar (paga {BET_PAYOUT_EXACT}×)
                  </label>
                  {useExact && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#DDD' }}>
                      <input type="number" min={0} max={9} value={exH} onChange={e => setExH(Math.max(0, +e.target.value))} style={{ width: 44, background: '#1A1A2A', color: '#FFF', borderRadius: 6, padding: 4, textAlign: 'center' }} />
                      <span>×</span>
                      <input type="number" min={0} max={9} value={exA} onChange={e => setExA(Math.max(0, +e.target.value))} style={{ width: 44, background: '#1A1A2A', color: '#FFF', borderRadius: 6, padding: 4, textAlign: 'center' }} />
                    </div>
                  )}

                  <div className="flex gap-1 flex-wrap">
                    {STAKE_CHIPS.filter(c => c <= state.points).map(c => (
                      <button key={c} onClick={() => setStake(c)} className="text-xs px-3 py-1 rounded font-bold"
                        style={{ background: stake === c ? GOLD : '#1A1A2A', color: stake === c ? '#0A0A14' : '#AAA' }}>{c}</button>
                    ))}
                  </div>

                  <button onClick={() => confirm(f.homeTeamId, f.awayTeamId)}
                    disabled={!canPlaceBet(stake, state.points)}
                    className="py-2 rounded font-black tracking-wide"
                    style={{ background: canPlaceBet(stake, state.points) ? GOLD : '#333', color: '#0A0A14', fontFamily: 'Bebas Neue, sans-serif', opacity: canPlaceBet(stake, state.points) ? 1 : 0.5 }}>
                    APOSTAR {stake} PTS
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
        Saldo: <b style={{ color: GOLD }}>{state.points}</b> pts · mín {BET_MIN_STAKE} / máx {BET_MAX_STAKE} por aposta
      </div>
    </div>
  );
}
```

> `getTeamById`, `placeBetOnline`, `cancelBetOnline` come from `useGame()`. `placeBetOnline`/`cancelBetOnline` are added in Task 5 — for solo they are unused (guarded by `online`). If TypeScript complains before Task 5, stub them in the context value as no-ops first, then implement in Task 5.

- [ ] **Step 2: Create the results panel**

Create `client/src/components/game/BetResultsPanel.tsx`:

```tsx
// UCL Immortals — Resultado das apostas da rodada. No online só renderiza quando liberado (anti-spoiler).
import { useGame } from '../../contexts/GameContext';
import { BetResult } from '../../lib/betting';

const GOLD = '#C9A84C';

export default function BetResultsPanel({ results }: { results: BetResult[] }) {
  const { getTeamById } = useGame();
  if (!results.length) return null;
  const nameOf = (id: string) => getTeamById(id)?.name ?? id;
  const net = results.reduce((s, r) => s + r.payout - r.bet.stake, 0);

  return (
    <div style={{ background: '#0A0A14', border: '1px solid #1A1A2A', borderRadius: 12, padding: 14, marginTop: 12 }}>
      <div className="font-black tracking-widest mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', color: GOLD }}>
        🎲 SUAS APOSTAS
      </div>
      <div className="flex flex-col gap-1">
        {results.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            <span style={{ color: '#AAA' }}>
              {nameOf(r.bet.homeTeamId)} {r.actualHome}-{r.actualAway} {nameOf(r.bet.awayTeamId)}
            </span>
            <span style={{ color: r.won ? '#39FF14' : '#EF6A6A', fontWeight: 700 }}>
              {r.won ? (r.exactHit ? '✓ PLACAR!' : '✓') : '✗'} {r.won ? `+${r.payout}` : `−${r.bet.stake}`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-right font-black" style={{ color: net >= 0 ? '#39FF14' : '#EF6A6A', fontFamily: 'Bebas Neue, sans-serif' }}>
        SALDO: {net >= 0 ? '+' : ''}{net} PTS
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire both into `LeaguePage.tsx`**

Add imports at the top of `client/src/pages/LeaguePage.tsx`:

```ts
import BettingPanel from '../components/game/BettingPanel';
import BetResultsPanel from '../components/game/BetResultsPanel';
```

Render `<BettingPanel />` in the league round view, above the fixtures list / near the "Jogar" button (the round overview area, before the fixtures rendered at line ~476). Render `<BetResultsPanel />` inside the reinforcement modal (line ~949 area), right below the `lastMatchPoints` summary, gated so the online spoiler is respected:

```tsx
{state.betResults && (state.mode !== 'online' || allPlayersWatched) && (
  <BetResultsPanel results={state.betResults} />
)}
```

- [ ] **Step 4: Manual check (solo)**

Run the app (`npm run dev` from repo root). Solo: na tela da rodada, abrir 🎲, apostar em 2-3 jogos (incluindo o seu), com um placar exato; jogar a rodada; conferir que o painel de resultado aparece no modal de reforço com ✓/✗ e o saldo bate com os pontos creditados. Sem erro no console.

- [ ] **Step 5: Commit** — (não commitar.)

---

## Task 4: Servidor — estado, handlers de aposta, resolução no `play_round`

**Files:**
- Modify: `server/handlers.ts`

**Interfaces:**
- Consumes: `Bet`, `BetResult`, `resolveBet`, `canPlaceBet` from `../client/src/lib/betting.js`.
- Produces: `RoomPlayer.bets: Bet[]`, `RoomPlayer.betResults: BetResult[] | null`; socket events `place_bet`, `cancel_bet`; resolução dentro de `play_round`.

- [ ] **Step 1: Import + RoomPlayer fields**

Add to the imports (next to the `shop.js` import at line ~27):

```ts
import { Bet, BetResult, resolveBet, canPlaceBet } from "../client/src/lib/betting.js";
```

Add to the `RoomPlayer` interface (after `reinforcementRerolls` at line ~48):

```ts
  bets: Bet[];                       // apostas pendentes da rodada atual (debitadas na colocação)
  betResults: BetResult[] | null;    // resolução da última rodada (escondida no cliente até liberar)
```

Initialize these wherever a `RoomPlayer` is created (grep the object literal that sets `reinforcementRerolls: 0` — add `bets: [], betResults: null,` alongside it).

- [ ] **Step 2: Add the place_bet / cancel_bet handlers**

Add near the `shop_buy_reroll` handler (line ~762), following the same validation pattern:

```ts
    // Coloca/atualiza uma aposta desta rodada (fase de liga, antes da rodada ser jogada).
    socket.on("place_bet", ({ roomCode, bet }: { roomCode: string; bet: Bet }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'league') return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !bet || bet.round !== room.leagueRound) return;
      // A rodada não pode ter começado (nenhum fixture jogado).
      const roundStarted = room.leagueFixtures.some(f => f.round === room.leagueRound && f.played);
      if (roundStarted) return;
      // A partida apostada tem que existir nesta rodada.
      const fx = room.leagueFixtures.find(f =>
        f.round === room.leagueRound && f.homeTeamId === bet.homeTeamId && f.awayTeamId === bet.awayTeamId);
      if (!fx) return;
      // Refund de aposta anterior no mesmo jogo, depois valida o novo stake.
      const existing = player.bets.find(b => b.fixtureId === bet.fixtureId);
      const budget = player.points + (existing ? existing.stake : 0);
      if (!canPlaceBet(bet.stake, budget)) return;
      player.points = budget - bet.stake;
      player.bets = [...player.bets.filter(b => b.fixtureId !== bet.fixtureId), bet];
      socket.emit("room_updated", room); // só o saldo/apostas deste jogador mudaram
    });

    socket.on("cancel_bet", ({ roomCode, fixtureId }: { roomCode: string; fixtureId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      const existing = player.bets.find(b => b.fixtureId === fixtureId);
      if (!existing) return;
      player.points += existing.stake;
      player.bets = player.bets.filter(b => b.fixtureId !== fixtureId);
      socket.emit("room_updated", room);
    });
```

- [ ] **Step 3: Resolve bets inside `play_round`**

In the `play_round` handler, inside the `if (simulatedAny) { ... }` block (line ~838), inside the `room.players.forEach(p => { ... })` loop (after `p.reinforcementOptions = ...` at line ~854), add:

```ts
          // Resolve as apostas deste jogador contra os placares finais da rodada.
          let betPayout = 0;
          const betResults: BetResult[] = [];
          for (const bt of p.bets) {
            const bfx = room.leagueFixtures.find(f =>
              f.round === room.leagueRound && f.homeTeamId === bt.homeTeamId && f.awayTeamId === bt.awayTeamId);
            if (!bfx?.result) continue;
            const r = resolveBet(bt, bfx.result.homeGoals, bfx.result.awayGoals);
            betResults.push(r);
            betPayout += r.payout;
          }
          p.points += betPayout;
          p.betResults = betResults.length ? betResults : null;
          p.bets = [];
```

> Note: `room.leagueRound` is still the round just played at this point (it's incremented only on advance). The `betResults` ride along in `room_updated`; the CLIENT hides them until `allPlayersWatched` (Task 5). Bets are cleared so the next round starts empty.

- [ ] **Step 4: Clear stale betResults on advance (optional safety)**

In the handler that advances the league round (grep `leagueRound++` / `room.leagueRound +=`), reset each player's `betResults` to `null` so an old panel can't linger into the new round's betting screen. (If advancing already broadcasts fresh state, this just guarantees a clean slate.)

- [ ] **Step 5: Typecheck the server**

Run: `cd client && npx tsc --noEmit` (the server shares these types via the client lib; also build the server per the repo's build script). Expected: no type errors related to `bets`/`betResults`.

- [ ] **Step 6: Commit** — (não commitar.)

---

## Task 5: Cliente online — emits + sync + gate anti-spoiler

**Files:**
- Modify: `client/src/contexts/GameContext.tsx`

**Interfaces:**
- Consumes: server events/state (Task 4), `Bet` (Task 1).
- Produces: context functions `placeBetOnline(bet: Bet): void`, `cancelBetOnline(fixtureId: string): void`; `SET_ONLINE_STATE` now mirrors `me.bets` → `state.bets` and `me.betResults` → `state.betResults`.

- [ ] **Step 1: Emit functions**

Where the other online emit helpers live (e.g. `rerollReinforcementOnline`, `pickReinforcementOnline`), add:

```ts
  const placeBetOnline = (bet: Bet) => {
    if (socket && state.roomCode) socket.emit('place_bet', { roomCode: state.roomCode, bet });
  };
  const cancelBetOnline = (fixtureId: string) => {
    if (socket && state.roomCode) socket.emit('cancel_bet', { roomCode: state.roomCode, fixtureId });
  };
```

Add both to the context Provider `value={{ ... }}` object AND to the context type/interface so `useGame()` exposes them. (Match how `rerollReinforcementOnline` is declared and exported.)

- [ ] **Step 2: Sync in SET_ONLINE_STATE**

In the `SET_ONLINE_STATE` return object (line ~983, next to `points`/`reinforcementOptions`), add:

```ts
        bets: me ? (me.bets ?? []) : state.bets,
        betResults: me ? (me.betResults ?? null) : state.betResults,
```

- [ ] **Step 3: Manual check (online, 2 abas)**

Run app + server. Em duas abas (host + convidado): antes do host jogar a rodada, cada um aposta em partidas diferentes (uma no jogo do outro humano). Host joga a rodada. Confirmar:
1. O saldo debitou na colocação e sincronizou.
2. O painel de RESULTADO das apostas **não aparece** até ambos assistirem seus jogos (anti-spoiler intacto — ele revelaria placares de outras partidas).
3. Depois que todos assistem, o resultado aparece e o pagamento foi creditado corretamente.
4. Apostar depois que a rodada foi jogada é impossível (painel de colocação some — `roundPlayed`).

- [ ] **Step 4: Commit** — (não commitar.)

---

## Task 6: Verificação final

**Files:** nenhum (só rodar).

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run client/src/lib/betting.test.ts client/src/contexts/betting-reducer.test.ts`
Expected: todos verdes.

- [ ] **Step 2: Regressão do balanço/engine**

Run: `npx vitest run client/src/lib/engine-units.test.ts` (garantir que nada quebrou; a suíte de balanço é opcional aqui pois é lenta).

- [ ] **Step 3: Typecheck + build**

Run: `cd client && npx tsc --noEmit` então, na raiz, `npm run build`.
Expected: sem erros.

- [ ] **Step 4: Report** — resumir pro usuário o que foi feito, telas afetadas, e deixar pronto pra ele commitar (NÃO commitar).

---

## Self-Review (feita ao escrever)

- **Cobertura da spec:** pagamento fixo ✅ (constantes, home==away payout); qualquer partida ✅ (painel lista todos os fixtures da rodada); online ✅ (handlers + sync); anti-spoiler ✅ (gate `allPlayersWatched` no painel de resultado; colocação fecha quando a rodada começa); teto ✅ (`canPlaceBet`).
- **Consistência de tipos:** `Bet`/`BetResult`/`resolveBet`/`canPlaceBet`/`fixtureId` definidos na Task 1 e usados idênticos em 2/3/4/5. `MatchResult.homeGoals`/`awayGoals` — CONFIRMADO em `gameEngine.ts:105-106` (as notas "verificar" nas Tasks 2/4 já estão resolvidas: use `homeGoals`/`awayGoals`).
- **Sem placeholders:** todo passo de código tem código real.
- **Escopo:** só a fase de LIGA (rodadas com múltiplos jogos simultâneos). Mata-mata fica de fora deste plano (ties de 2 mãos, estrutura diferente) — extensão futura se o usuário quiser.
```