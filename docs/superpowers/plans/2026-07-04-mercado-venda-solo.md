# Mercado — Fase 1 (venda solo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma aba "Mercado" no solo onde o jogador vende reservas por pontos.

**Architecture:** Uma função pura `sellValue(rarity)` (valor por raridade) em `shop.ts`; uma action `SELL_PLAYER` no reducer do `GameContext` que credita pontos + remove a reserva + limpa disciplina; um componente fino `MarketTab` (grid das reservas + modal de confirmação); e o wiring da aba no `LeaguePage` (só no modo solo).

**Tech Stack:** React + TypeScript, Vite, contexto/reducer do `GameContext`, Vitest (rodado da raiz).

## Global Constraints

- **NÃO commitar** — o usuário faz os commits. Nenhum passo roda `git commit`.
- Build/typecheck/testes rodam **da raiz** do repo (`c:\Users\josel\Downloads\ucl-immortals`).
- Typecheck: `cd client && npx tsc --noEmit` (deve sair 0).
- Testes: `node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run <arquivo>` (da raiz).
- Vender **só reservas** (índice ≥ 11 em `playerTeam.players`). Titular nunca é vendável.
- Valores de venda por raridade: **bronze 30 · silver 60 · gold 100 · legendary 180 · immortal 250 · unique 400** (fallback = bronze 30).
- Aba Mercado só aparece no **modo solo** (`state.mode !== 'online'`).
- Referências de código com `arquivo:linha` são aproximadas (o arquivo pode ter deslocado) — confirme pelo conteúdo âncora citado.

---

## File Structure

- `client/src/lib/shop.ts` (modificar) — `SELL_VALUES` + `sellValue(rarity)`.
- `client/src/lib/shop.test.ts` (criar) — testes de `sellValue`.
- `client/src/contexts/GameContext.tsx` (modificar) — action + reducer `SELL_PLAYER`.
- `client/src/components/game/MarketTab.tsx` (criar) — UI da aba (grid + modal de confirmação).
- `client/src/pages/LeaguePage.tsx` (modificar) — union do `activeTab`, botão da aba (solo), render.

---

## Task 1: `sellValue` (valor de venda por raridade)

**Files:**
- Modify: `client/src/lib/shop.ts` (adicionar perto de `SHOP_COSTS`)
- Test: `client/src/lib/shop.test.ts` (criar)

**Interfaces:**
- Produces: `SELL_VALUES: Record<string, number>` e `sellValue(rarity: string): number`.

- [ ] **Step 1: Escrever o teste que falha** — criar `client/src/lib/shop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sellValue } from './shop';

describe('sellValue — valor de venda por raridade', () => {
  it('cada raridade tem o valor calibrado', () => {
    expect(sellValue('bronze')).toBe(30);
    expect(sellValue('silver')).toBe(60);
    expect(sellValue('gold')).toBe(100);
    expect(sellValue('legendary')).toBe(180);
    expect(sellValue('immortal')).toBe(250);
    expect(sellValue('unique')).toBe(400);
  });
  it('raridade desconhecida cai no fallback bronze (30)', () => {
    expect(sellValue('inexistente')).toBe(30);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run client/src/lib/shop.test.ts`
Expected: FAIL — `sellValue` não existe (erro de import/undefined).

- [ ] **Step 3: Implementar** — em `client/src/lib/shop.ts`, logo abaixo do bloco `SHOP_COSTS` (por volta da linha 54), adicionar:

```ts
// 🏪 Mercado (venda solo): quanto o jogador recebe ao vender uma RESERVA, por raridade.
// Calibrado modesto vs. ganho por partida (~100-150 pts) pra recompensar sem virar farm.
export const SELL_VALUES: Record<string, number> = {
  bronze: 30,
  silver: 60,
  gold: 100,
  legendary: 180,
  immortal: 250,
  unique: 400,
};
export function sellValue(rarity: string): number {
  return SELL_VALUES[rarity] ?? SELL_VALUES.bronze;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `node --max-old-space-size=4096 ./node_modules/vitest/vitest.mjs run client/src/lib/shop.test.ts`
Expected: PASS (2 testes).

---

## Task 2: Action + reducer `SELL_PLAYER`

**Files:**
- Modify: `client/src/contexts/GameContext.tsx` (union de actions ~linha 163-200; case novo no reducer)

**Interfaces:**
- Consumes: `sellValue` de `../lib/shop` (Task 1).
- Produces: action `{ type: 'SELL_PLAYER'; playerId: string }` tratada no reducer (solo).

- [ ] **Step 1: Importar `sellValue`** — em `client/src/contexts/GameContext.tsx`, achar o import de `shop` (por volta da linha 19):

```ts
import { computeMatchPoints, MatchPoints, SHOP_COSTS, trainCost, TRAIN_BOOST, ShopVariant, TrainAttr } from '../lib/shop';
```

trocar por (adicionar `sellValue`):

```ts
import { computeMatchPoints, MatchPoints, SHOP_COSTS, trainCost, TRAIN_BOOST, ShopVariant, TrainAttr, sellValue } from '../lib/shop';
```

- [ ] **Step 2: Adicionar o tipo da action** — no union de actions (achar a linha `| { type: 'HEAL_INJURY'; playerId: string }`, ~linha 190) e adicionar logo abaixo:

```ts
  | { type: 'SELL_PLAYER'; playerId: string }
```

- [ ] **Step 3: Adicionar o case no reducer** — achar o `case 'HEAL_INJURY': {` (~linha 644) e adicionar o novo case logo ANTES dele (ou depois do `}` que o fecha):

```ts
    case 'SELL_PLAYER': {
      // 🏪 Mercado (solo): vende uma RESERVA (índice ≥ 11) por pontos. Titular não é vendável.
      if (state.mode === 'online' || !state.playerTeam) return state;
      const idx = state.playerTeam.players.findIndex(p => p.id === action.playerId);
      if (idx < 11) return state; // -1 (não achou) ou titular (0-10): bloqueia
      const sold = state.playerTeam.players[idx];
      const players = state.playerTeam.players.filter((_, i) => i !== idx);
      // limpa a disciplina (suspensão/lesão) do vendido, se houver
      const discKey = `${state.playerTeam.id}:${sold.id}`;
      const discipline = { ...state.discipline };
      delete discipline[discKey];
      return {
        ...state,
        points: state.points + sellValue(sold.rarity),
        playerTeam: { ...state.playerTeam, players },
        discipline,
      };
    }
```

- [ ] **Step 4: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: sai 0 (sem erros). Se acusar tipo de `discipline`/`DisciplineMap`, confirmar que `state.discipline` é um `Record`/objeto (é o `DisciplineMap`) — o spread + delete é válido.

---

## Task 3: Componente `MarketTab`

**Files:**
- Create: `client/src/components/game/MarketTab.tsx`

**Interfaces:**
- Consumes: `useGame()` (state + dispatch), `sellValue` (Task 1), action `SELL_PLAYER` (Task 2), `PlayerCard` default export de `./PlayerCard`.
- Produces: `export default function MarketTab()` — usado pelo `LeaguePage` (Task 4).

- [ ] **Step 1: Criar o arquivo** `client/src/components/game/MarketTab.tsx` com o conteúdo:

```tsx
// UCL Immortals — Aba "Mercado" (Fase 1: venda solo).
// Lista as RESERVAS do jogador (banco, índice ≥ 11) com o valor de venda e um botão que abre
// um modal de confirmação antes de vender por pontos. Só usada no modo solo.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { sellValue } from '../../lib/shop';
import PlayerCard from './PlayerCard';

export default function MarketTab() {
  const { state, dispatch } = useGame();
  const team = state.playerTeam;
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (!team) return null;

  const bench = team.players.slice(11);
  const confirmPlayer = confirmId ? team.players.find(p => p.id === confirmId) : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
        <div>
          <div className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>🏪 MERCADO</div>
          <div className="text-[11px]" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
            Venda reservas que não quer mais. Pra vender um titular, mande-o pro banco no MEU TIME.
          </div>
        </div>
        <div className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>💰 {state.points}</div>
      </div>

      {/* Grid das reservas */}
      {bench.length === 0 ? (
        <div className="rounded-xl px-4 py-10 text-center" style={{ background: '#0F0F1A', border: '1px dashed #1A1A2A', color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          Sem reservas pra vender — seus reforços e picks de banco aparecem aqui.
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {bench.map(p => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <PlayerCard player={p} compact lite />
              <button
                onClick={() => setConfirmId(p.id)}
                className="text-[11px] font-black px-3 py-1.5 rounded-lg tracking-wider transition-transform active:scale-95"
                style={{ fontFamily: 'Rajdhani, sans-serif', background: '#7f1d1dCC', color: '#FCA5A5', border: '1px solid #EF444455' }}
              >
                Vender · 💰{sellValue(p.rarity)}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmPlayer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={() => setConfirmId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-2xl p-5 text-center" style={{ background: '#0b0b14', border: '1px solid #7f1d1d' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl mb-1">🏪</div>
            <h3 className="text-lg font-black tracking-widest uppercase mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FCA5A5' }}>Vender jogador</h3>
            <p className="text-[13px] mb-1" style={{ color: '#C8D0D4', fontFamily: 'Rajdhani, sans-serif' }}>
              Vender <b style={{ color: '#FFF' }}>{confirmPlayer.shortName}</b> por <b style={{ color: '#E8C84A' }}>💰 {sellValue(confirmPlayer.rarity)}</b>?
            </p>
            <p className="text-[11px] mb-4" style={{ color: '#8A9BA0', fontFamily: 'Rajdhani, sans-serif' }}>Essa ação é permanente.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2.5 rounded-xl font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', background: '#17171f', color: '#9A9AA5' }}>
                CANCELAR
              </button>
              <button
                onClick={() => { dispatch({ type: 'SELL_PLAYER', playerId: confirmPlayer.id }); setConfirmId(null); }}
                className="flex-1 py-2.5 rounded-xl font-black tracking-widest transition-transform active:scale-95"
                style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg,#b91c1c,#ef4444)', color: '#fff' }}
              >
                VENDER
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: sai 0. Se acusar props do `PlayerCard` (`compact`/`lite`), confirmar que são aceitas (são — usadas em ShopTab/DraftedRoster).

---

## Task 4: Wiring da aba no `LeaguePage`

**Files:**
- Modify: `client/src/pages/LeaguePage.tsx` (union `activeTab` ~linha 53; lista de tabs ~469-490; render ~1077)

**Interfaces:**
- Consumes: `MarketTab` (Task 3).

- [ ] **Step 1: Importar `MarketTab`** — no topo do `client/src/pages/LeaguePage.tsx`, junto dos outros imports de componentes de aba (perto de onde `LeagueSquadTab` é importado):

```tsx
import MarketTab from '../components/game/MarketTab';
```

- [ ] **Step 2: Adicionar `'market'` ao union do `activeTab`** — achar (~linha 53):

```tsx
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'bracket' | 'results' | 'squad' | 'scorers' | 'shop'>('fixtures');
```

trocar por:

```tsx
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'bracket' | 'results' | 'squad' | 'scorers' | 'shop' | 'market'>('fixtures');
```

- [ ] **Step 3: Adicionar o botão da aba (só solo)** — na lista de tabs (por volta da linha 469-479 há entradas como `{ id: 'squad', label: 'MEU TIME' }` e `{ id: 'shop', label: \`🛒 LOJA · 💰${state.points}\` }`). Achar o array de tabs e inserir, logo depois da entrada de `shop`, uma entrada de mercado **condicional ao solo**. Como o array é montado com objetos, adicionar via spread condicional:

```tsx
                ...(state.mode !== 'online' ? [{ id: 'market', label: '🏪 MERCADO' }] : []),
```

Contexto: procure o bloco onde as tabs solo/online são definidas (há duas listas — uma inclui `standings` e outra não). Adicione a entrada `market` **na lista do modo solo** (a que já contém `{ id: 'shop', ... }`), imediatamente após o `shop`. Se as duas listas contiverem `shop`, adicione a linha de `market` logo após cada `shop` que pertença ao caminho solo — mas como a aba já é gated por `state.mode !== 'online'` no spread, é seguro adicioná-la após o `shop` em ambas.

- [ ] **Step 4: Renderizar a aba** — achar (~linha 1077):

```tsx
        {activeTab === 'squad' && <LeagueSquadTab />}
```

adicionar logo abaixo:

```tsx
        {activeTab === 'market' && <MarketTab />}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd client && npx tsc --noEmit` → sai 0.
Run (da raiz): `npm run build` → conclui sem erro (aparecem só os warnings pré-existentes de `VITE_ANALYTICS`).

- [ ] **Step 6: Verificação manual (solo)**

1. Rodar o app, entrar num jogo solo, chegar no hub da liga.
2. Ver a aba **🏪 MERCADO** (só no solo — no online ela NÃO aparece).
3. Abrir a aba: reservas listadas com "Vender · 💰X"; sem reservas → estado vazio.
4. Clicar Vender → modal aparece com nome + valor; Cancelar não faz nada; Confirmar credita os pontos (o `💰` do topo/LOJA sobe pelo valor), o jogador some do banco (e do MEU TIME).
5. Confirmar que titulares **não** aparecem no Mercado (só reservas).

---

## Self-Review (feito)

- **Cobertura da spec:** valor por raridade → Task 1; regra só-reserva + crédito + limpar disciplina → Task 2; aba Mercado + grid + modal de confirmação → Task 3; aba só-solo + render → Task 4. Teste de `sellValue` → Task 1. (Testes de reducer da spec: substituídos por typecheck/build/manual no Task 2/4, seguindo o padrão do repo, que não tem testes de reducer — o `GameContext` não expõe o reducer.)
- **Placeholders:** nenhum — todo passo tem código/comando concreto.
- **Consistência de tipos:** `sellValue(rarity: string): number` (Task 1) é chamado igual no reducer (Task 2, `sellValue(sold.rarity)`) e no MarketTab (Task 3, `sellValue(p.rarity)`). Action `SELL_PLAYER { playerId }` idêntica no union, reducer e dispatch. `MarketTab` default export ↔ import default no LeaguePage.

## Execução / commit

Não há passos de `git commit` — **o usuário commita**. Ao terminar, rodar typecheck + build + o teste de `shop.test.ts` e reportar; não commitar.
