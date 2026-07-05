# Posições Secundárias — penalidade + cobertura — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar uma penalidade de −7% pra quem joga numa posição secundária (3 estados: nativa/secundária/fora) e cobrir 100% dos jogadores com secundárias via um mapa de adjacência (override pelos `secondaryPositions` explícitos), com curadoria à mão dos Imortais.

**Architecture:** `effectiveSecondaries(player)` = explícito ?? adjacência-por-posição. O motor deriva `positionFit(player, role)` em 3 estados; a química marca `outOfPosition` (fora) e `secondaryPos` (secundária); o stat-mult vira nativa=×1 / secundária=×0.93 / fora=×0.85. Flui pro display (getPlayerEffectiveStats via `context.isSecondary`) e pra simulação (`PlayerCard.isSecondary`).

**Tech Stack:** TypeScript (Vite), Vitest (node). Sem servidor (é puro engine/UI do cliente).

## Global Constraints

- **NÃO COMMITAR.** O usuário commita. Cada task termina num **Checkpoint** (typecheck/build/test).
- **Build da raiz:** `npm run build`. Typecheck: `cd client && npx tsc --noEmit`. Testes: `npx vitest run <arquivo>` da raiz.
- **Penalidade secundária = −7% (× 0.93)**, mantendo a química (só o 'fora' zera). Nativa = 0%. Fora = −15% (× 0.85 / × 0.92 com relief).
- 🃏 **Coringa** = sempre 'native' (imune). `secondaryPositions` explícito **sempre** vence a adjacência.

---

## File Structure

- `client/src/lib/gameData.ts` **(modificar)** — `SECONDARY_ADJACENCY`, `effectiveSecondaries()`, secundárias à mão dos Imortais.
- `client/src/lib/gameEngine.ts` **(modificar)** — `SECONDARY_STAT_MULT`, `positionFit()`, `isPlayerInPosition` via fit, química com `secondaryPos`, `PlayerCard.isSecondary`, penalidade nos 2 caminhos, cartas do XI setam `isSecondary`.
- `client/src/lib/engine-units.test.ts` **(modificar)** — testes de fit/penalidade/adjacência.
- `client/src/components/game/SquadEditor.tsx` **(modificar)** — passar `isSecondary` no `getPlayerEffectiveStats` + texto do −7% no modal.
- `client/src/pages/ReportPage.tsx` **(modificar)** — passar `isSecondary` no `getPlayerEffectiveStats`.

---

## Task 1: Dados — adjacência + effectiveSecondaries + Imortais à mão

**Files:**
- Modify: `client/src/lib/gameData.ts`
- Test: `client/src/lib/engine-units.test.ts`

**Interfaces:**
- Produces: `SECONDARY_ADJACENCY: Record<string, string[]>`, `effectiveSecondaries(p): string[]`.

- [ ] **Step 1: Escrever o teste**

Em `client/src/lib/engine-units.test.ts`, adicionar `import { effectiveSecondaries } from './gameData';` (ou juntar ao import existente de `./gameData`), e:
```ts
describe('posições secundárias — adjacência + override', () => {
  it('usa a adjacência por posição quando não há explícita', () => {
    expect(effectiveSecondaries({ position: 'CB' })).toEqual(['CDM']);
    expect(effectiveSecondaries({ position: 'LB' })).toEqual(['LWB', 'LM']);
    expect(effectiveSecondaries({ position: 'GK' })).toEqual([]);
  });
  it('secondaryPositions explícito vence a adjacência', () => {
    expect(effectiveSecondaries({ position: 'CB', secondaryPositions: ['RB'] })).toEqual(['RB']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run client/src/lib/engine-units.test.ts -t "adjacência"`
Expected: FALHA — `effectiveSecondaries` não existe.

- [ ] **Step 3: Mapa + helper em gameData**

Em `client/src/lib/gameData.ts`, perto de `POS_PT`, adicionar:
```ts
// Secundárias PADRÃO por posição nativa (vizinhança realista). `secondaryPositions` explícito vence.
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

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run client/src/lib/engine-units.test.ts -t "adjacência"`
Expected: PASS.

- [ ] **Step 5: Curadoria à mão dos 9 Imortais**

Localizar os 9 jogadores `rarity: 'immortal'` (`grep -n "rarity: 'immortal'" client/src/lib/gameData.ts` → ler cada bloco). Pra cada um que **não** tenha `secondaryPositions`, adicionar o campo com as posições reais da carreira dele (ex.: um ala/lateral cobre a posição vizinha do mesmo lado; um CAM cobre CM/ST; um ST cobre CF/LW conforme o jogador). Manter valores plausíveis e específicos por jogador (é a curadoria "famosos à mão").

- [ ] **Step 6: Checkpoint**

Run: `cd client && npx tsc --noEmit`
Expected: sem erros.

---

## Task 2: Motor — fit em 3 estados + penalidade −7%

**Files:**
- Modify: `client/src/lib/gameEngine.ts` (import; `SECONDARY_STAT_MULT`; `positionFit`; `isPlayerInPosition` ~170; interface de retorno da química ~188 + loop ~200; `PlayerCard` ~36; `getPlayerEffectiveStats` ~510/526/529; `getEffectiveAttribute` ~836; cartas do XI ~2800/2957)
- Test: `client/src/lib/engine-units.test.ts`

**Interfaces:**
- Consumes: `effectiveSecondaries` (de `./gameData`).
- Produces: `SECONDARY_STAT_MULT = 0.93`; `positionFit(player, role): 'native'|'secondary'|'off'`; química retorna `secondaryPos: Record<string, boolean>`; `PlayerCard.isSecondary?: boolean`.

- [ ] **Step 1: Escrever os testes**

Em `client/src/lib/engine-units.test.ts`, adicionar ao import de `./gameEngine` os símbolos `positionFit, SECONDARY_STAT_MULT` e a `effectiveSecondaries` já veio de `./gameData`. Bloco:
```ts
describe('encaixe de posição em 3 estados + penalidade', () => {
  it('positionFit: nativa / secundária (adjacência ou override) / fora', () => {
    expect(SECONDARY_STAT_MULT).toBe(0.93);
    expect(positionFit(mkP({ position: 'CB' }), 'CB')).toBe('native');
    expect(positionFit(mkP({ position: 'CB' }), 'CDM')).toBe('secondary');   // adjacência
    expect(positionFit(mkP({ position: 'CB' }), 'ST')).toBe('off');
    expect(positionFit(mkP({ position: 'CB', secondaryPositions: ['ST'] }), 'ST')).toBe('secondary'); // override
    expect(positionFit(mkP({ position: 'CB', secondaryPositions: ['ST'] }), 'CDM')).toBe('off');       // override troca adjacência
    expect(positionFit(mkP({ position: 'CM', coringa: true }), 'GK')).toBe('native'); // 🃏 imune
  });
  it('secundária rende menos que nativa e mais que fora-de-posição', () => {
    const coach = COACHES[0];
    const p = mkP({ pace: 80, shooting: 80, passing: 80, dribbling: 80, defending: 80, physical: 80, vision: 80, composure: 80 });
    const native = getPlayerEffectiveStats(p, 0, false, coach.id, 0, 'balanced', { isSecondary: false }).overall;
    const secondary = getPlayerEffectiveStats(p, 0, false, coach.id, 0, 'balanced', { isSecondary: true }).overall;
    const oop = getPlayerEffectiveStats(p, 0, true, coach.id, 0, 'balanced').overall;
    expect(secondary).toBeLessThan(native);
    expect(secondary).toBeGreaterThan(oop);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run client/src/lib/engine-units.test.ts -t "3 estados"`
Expected: FALHA (símbolos/comportamento não existem).

- [ ] **Step 3: Import + constante + positionFit**

No `import { ... } from './gameData'` do gameEngine, adicionar `effectiveSecondaries`. Perto de `HOME_ATTR_BONUS`, adicionar:
```ts
// Jogar numa posição SECUNDÁRIA custa −7% (× 0.93) — entre a nativa (0%) e o fora-de-posição (−15%).
export const SECONDARY_STAT_MULT = 0.93;
export type PosFit = 'native' | 'secondary' | 'off';
export function positionFit(player: { position: string; secondaryPositions?: string[]; coringa?: boolean }, role: string): PosFit {
  if (player.coringa) return 'native';                       // 🃏 imune
  if (player.position === role) return 'native';
  if (effectiveSecondaries(player).includes(role)) return 'secondary';
  return 'off';
}
```

- [ ] **Step 4: `isPlayerInPosition` via fit**

Trocar o corpo de `isPlayerInPosition` (~170) por:
```ts
export function isPlayerInPosition(player: Player, formationRole: string): boolean {
  return positionFit(player, formationRole) !== 'off';
}
```
(Agora inclui a adjacência — mais jogadores ficam "em posição".)

- [ ] **Step 5: Química marca secundária**

Na interface de retorno da química (~188), adicionar `secondaryPos: Record<string, boolean>;`. No corpo (~192-206), trocar o cálculo do OOP:
```ts
  const outOfPosition: Record<string, boolean> = {};
  const secondaryPos: Record<string, boolean> = {};
```
e dentro do loop, no lugar de `const isOOP = player.coringa ? ...; outOfPosition[player.id] = isOOP;`:
```ts
    const fit = formationRole ? positionFit(player, formationRole) : 'native';
    const isOOP = fit === 'off';
    outOfPosition[player.id] = isOOP;
    secondaryPos[player.id] = fit === 'secondary';
```
e no `return` da química, adicionar `secondaryPos`.

- [ ] **Step 6: `PlayerCard.isSecondary` + penalidade nos 2 caminhos**

- Na interface `PlayerCard` (~36), adicionar `isSecondary?: boolean;`.
- Em `getPlayerEffectiveStats`: no tipo `context?` adicionar `isSecondary?: boolean;`. Logo após ler `isOOP`, adicionar `const isSecondary = context?.isSecondary ?? false;`. Trocar a linha do `chemMult` (~529) por:
  ```ts
  const chemMult = isOOP ? oopMult : (effectiveChem === 3 ? 1.10 : effectiveChem === 2 ? 1.06 : effectiveChem === 1 ? 1.03 : 1.00) * (isSecondary ? SECONDARY_STAT_MULT : 1);
  ```
- Em `getEffectiveAttribute`, trocar a linha do `chemMult` (~836) por:
  ```ts
  const chemMult = player.isOOP ? oopMult : (player.chemistryScore >= 3 ? 1.10 : player.chemistryScore === 2 ? 1.06 : player.chemistryScore === 1 ? 1.03 : 1.00) * (player.isSecondary ? SECONDARY_STAT_MULT : 1);
  ```

- [ ] **Step 7: Cartas do XI setam `isSecondary`**

Nos 2 pontos que montam as cartas com `isOOP: chemData.outOfPosition[p.id] ?? false,` (~2800 e ~2957), adicionar na mesma linha/objeto:
```ts
    isSecondary: chemData.secondaryPos[p.id] ?? false,
```

- [ ] **Step 8: Rodar os testes e ver passar**

Run: `npx vitest run client/src/lib/engine-units.test.ts`
Expected: PASS (novos + antigos).

- [ ] **Step 9: Regressão de balanço**

Run: `npx vitest run client/src/lib/balance.test.ts`
Expected: verde — a mudança é pequena; conferir que gols/vantagem seguem na faixa.

---

## Task 3: Display (call-sites) + texto do modal

**Files:**
- Modify: `client/src/components/game/SquadEditor.tsx` (call-sites `:101` e `:360`; texto do modal)
- Modify: `client/src/pages/ReportPage.tsx` (call-site `:203`)

**Interfaces:**
- Consumes: `chemData.secondaryPos` (Task 2), `context.isSecondary` (Task 2).

- [ ] **Step 1: SquadEditor — passar isSecondary**

No `getPlayerEffectiveStats` do `teamOverall` (~101), adicionar `isSecondary` ao objeto de contexto:
```ts
      const eff = getPlayerEffectiveStats(p, chemData.individual[p.id] ?? 0, chemData.outOfPosition[p.id] ?? false, coachId, chemData.total, playStyle, { captainBoost, charBoosts, isKnockout, isSecondary: chemData.secondaryPos[p.id] ?? false });
```
No do jogador selecionado (~360), definir antes `const selectedIsSecondary = selectedPlayer ? (chemData.secondaryPos[selectedPlayer.id] ?? false) : false;` (perto de `selectedIsOOP`) e passar `isSecondary: selectedIsSecondary` no contexto.

- [ ] **Step 2: SquadEditor — texto do −7% no modal**

No painel do jogador selecionado, onde hoje mostra o aviso de OOP (`selectedIsOOP` → "⚠️ FORA DE POSIÇÃO"), adicionar o caso da secundária: quando `selectedIsSecondary`, mostrar um selo "🔁 2ª POSIÇÃO · −7%" (âmbar suave), pra o jogador saber que está cobrindo com custo. No card de candidato, o selo "✓ COBRE A VAGA (2ª pos)" passa a "✓ COBRE A VAGA (2ª pos · −7%)".

- [ ] **Step 3: ReportPage — passar isSecondary**

No `getPlayerEffectiveStats` (~203), adicionar o 7º arg de contexto:
```ts
        getPlayerEffectiveStats(p, chemData.individual[p.id] ?? 0, chemData.outOfPosition[p.id] ?? false, playerTeam.coachId, chemData.total, playerTeam.playStyle, { isSecondary: chemData.secondaryPos[p.id] ?? false }).overall
```

- [ ] **Step 4: Checkpoint final**

Run: `cd client && npx tsc --noEmit` e `npm run build` (raiz)
Expected: sem erros; build OK.

- [ ] **Step 5: Testes do motor**

Run: `npx vitest run client/src/lib/engine-units.test.ts`
Expected: verde.

---

## Verificação final

- **Testes:** `npx vitest run client/src/lib/engine-units.test.ts` verde (fit 3 estados, adjacência/override, secundária ×0.93); `balance.test.ts` na faixa.
- **Typecheck/build:** `cd client && npx tsc --noEmit`; raiz `npm run build`.
- **Manual:** escalar um jogador numa **secundária** → stats caem **~7%** (não 15%), química mantida, e o modal mostra "2ª POSIÇÃO · −7%". Um jogador **sem** secundária explícita agora cobre as vizinhas (adjacência); os Imortais têm secundárias reais curadas à mão; os manuais antigos seguem valendo.

## Self-Review (feito ao escrever o plano)

- **Cobertura da spec:** penalidade −7% (T2) ✓ · 3 estados/positionFit (T2) ✓ · química mantida na secundária (T2) ✓ · adjacência + override (T1) ✓ · Imortais à mão (T1) ✓ · modal comunica (T3) ✓ · Coringa imune (T2) ✓.
- **Placeholders:** nenhum de código — só a curadoria dos Imortais é data-entry (valores reais preenchidos ao ler cada bloco).
- **Consistência de tipos:** `effectiveSecondaries`, `positionFit`, `SECONDARY_STAT_MULT=0.93`, `PlayerCard.isSecondary`, `chemData.secondaryPos`, `context.isSecondary` usados igual em todas as tasks.
