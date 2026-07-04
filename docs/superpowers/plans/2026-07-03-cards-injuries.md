# Cartões, Suspensões e Lesões — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cartões (🟨🟥), suspensões e lesões (🩹) integrados ao motor, à temporada e à escalação — valendo para todos os times (jogador, humanos, bots), com consequências que carregam entre jogos e forçam rotação de banco.

**Architecture:** Três camadas isoladas: (1) geração no motor (`runMatchSimulation`) engatada no mecanismo de falta existente, com força base mutável (🟥 remove + penalidade; lesão aplica debuff nos atributos); (2) estado de temporada num módulo puro `discipline.ts` (mapa de disponibilidade + funções puras testáveis); (3) escalação que resolve ausências promovendo reservas (com tratamento dedicado de goleiro). Solo no reducer, online autoritativo no servidor.

**Tech Stack:** React + TS (Vite), Node + socket.io, Vitest. Build da raiz (`npm run build`). Alias `@`.

## Global Constraints

- **NÃO commitar automaticamente — o usuário commita.** Cada task termina em verificação; os passos "Commit" são do usuário.
- Verificação: `cd client && npx tsc --noEmit`; testes `npx vitest run <arquivo>` (da RAIZ — o include é `client/src/**`); build final da raiz `npm run build`.
- Determinismo nos testes: injetar `rng`/seed; nunca `Math.random`/`Date.now` nos asserts. Testes de motor usam `mulberry32` seeded (padrão de `balance.test.ts`).
- Constantes de balanço vivem em `client/src/lib/discipline.ts` (exportadas, re-tunáveis): `YELLOW_ACCUM_THRESHOLD=3`, `INJURY_DEBUFF=12`, `RED_PENALTY≈8`, `RED_GK_PENALTY≈16`, distribuição de gravidade `1j .60 / 2j .30 / 3j .10`, taxas de cartão por posição, prob. de 🟥 direto, prob. de lesão, `PHYSIO_COST≈250`.
- **Goleiro é caso à parte em tudo** (taxa de cartão ~0; lesão via atributos do GK; 🟥 de GK = linha no gol com `RED_GK_PENALTY`; ausência promove GK reserva ou linha-no-gol `isOOP`; nunca deixar XI sem goleiro).
- Chave de disponibilidade: `` `${teamId}:${playerId}` `` (bots podem repetir ids entre si).
- Alvos: ~3–4 🟨/jogo · 🟥 ~1/8 jogos · lesão ~1/2–3 jogos. Placar médio mantém ~2.9–3.2 gols/jogo (re-tunar knobs se sair).

---

## File Structure

- **Create** `client/src/lib/discipline.ts` — tipos (`PlayerAvailability`, `DisciplineMap`, `DisciplineEntry`), constantes, `availKey`, `isAvailable`, `rollInjurySeverity`, `applyMatchDiscipline`, `resolveAvailableLineup`, `resetYellowsForKnockout`, `healInjury`.
- **Create** `client/src/lib/discipline.test.ts` — unit das funções puras (inclui goleiro).
- **Create** `client/src/lib/cards-injuries.balance.test.ts` — motor seeded (taxas, posição, A/B, hierarquia, goleiro).
- **Create** `client/src/lib/discipline-season.test.ts` — invariantes de temporada.
- **Modify** `client/src/lib/gameEngine.ts` — `'injury'` no tipo; geração no `runMatchSimulation`; força mutável + debuff; GK; agregação de stats; `generateBotTeam` com banco+GK reserva.
- **Modify** `client/src/lib/shop.ts` — `PHYSIO_COST` + item Fisioterapia.
- **Modify** `client/src/contexts/GameContext.tsx` — `discipline` no estado; aplicar pós-jogo (liga + mata-mata); `resolveAvailableLineup` antes de simular; reset no `START_KNOCKOUT`; ação Fisioterapia; sync.
- **Modify** `server/handlers.ts` — `discipline` no `RoomState`; aplicar após `play_round`/`play_knockout_leg`; resolver escalações; Fisioterapia; sync.
- **Modify** `client/src/pages/MatchSimPage.tsx` — render 🟨🟥🩹 no feed ao vivo (junto com gols) + replay/narração.
- **Modify** `client/src/components/game/MatchDetailsModal.tsx` — ícones 🟨🟥🩹.
- **Modify** `client/src/components/game/SquadEditor.tsx` + `LeagueSquadTab.tsx` — badges + bloquear indisponível no XI + botão Fisioterapia.
- **Modify** `client/src/pages/LeaguePage.tsx` + `client/src/components/game/KnockoutTiesTab.tsx` — aviso de desfalques; sub-aba DISCIPLINA em ESTATÍSTICAS.

---

## FASE 1 — Geração no motor (visível na hora, sem carregar)

### Task 1: Tipo `'injury'` + constantes de disciplina no motor

**Files:**
- Modify: `client/src/lib/gameEngine.ts` (interface `MatchEvent`, ~linha 66)
- Create: `client/src/lib/discipline.ts` (só constantes + tipos nesta task)

**Interfaces:**
- Produces em `discipline.ts`:
  - `interface PlayerAvailability { yellows: number; banned: number; injured: number }`
  - `type DisciplineMap = Record<string, PlayerAvailability>`
  - `interface DisciplineEntry { teamId: string; playerId: string; playerName: string; games: number; kind: 'ban' | 'injury' }`
  - `availKey(teamId, playerId): string`, `isAvailable(m, teamId, playerId): boolean`
  - Constantes: `YELLOW_ACCUM_THRESHOLD=3`, `INJURY_DEBUFF=12`, `RED_PENALTY=8`, `RED_GK_PENALTY=16`, `INJURY_SEVERITY_WEIGHTS=[[1,0.6],[2,0.3],[3,0.1]]`, `CARD_POS_MULT` (por posição), `FOUL_YELLOW_BASE`, `STRAIGHT_RED_PROB`, `INJURY_FOUL_PROB`, `INJURY_RANDOM_BASE`, `PHYSIO_COST=250`.

- [ ] **Step 1:** Adicionar `'injury'` à união em `gameEngine.ts`:
```ts
  type: 'goal' | 'save' | 'miss' | 'duel' | 'sub' | 'penalty' | 'foul' | 'momentum' | 'yellow' | 'red' | 'injury';
```

- [ ] **Step 2:** Criar `client/src/lib/discipline.ts` com os tipos e constantes:
```ts
// UCL Immortals — Disciplina & Lesões. Módulo PURO (sem React/rede). A geração DENTRO do jogo
// vive no motor; aqui ficam os tipos, as constantes de balanço e a lógica de TEMPORADA.
import { Player, Team } from './gameData';

export interface PlayerAvailability { yellows: number; banned: number; injured: number }
export type DisciplineMap = Record<string, PlayerAvailability>; // key = `${teamId}:${playerId}`
export interface DisciplineEntry { teamId: string; playerId: string; playerName: string; games: number; kind: 'ban' | 'injury' }

export const availKey = (teamId: string, playerId: string) => `${teamId}:${playerId}`;
export const isAvailable = (m: DisciplineMap, teamId: string, playerId: string): boolean => {
  const a = m[availKey(teamId, playerId)];
  return !a || (a.banned === 0 && a.injured === 0);
};

export const YELLOW_ACCUM_THRESHOLD = 3;   // 3 amarelos acumulados = 1 jogo suspenso
export const INJURY_DEBUFF = 12;           // −N em cada atributo do lesionado (resto do jogo)
export const RED_PENALTY = 8;              // força a menos por jogar com 10
export const RED_GK_PENALTY = 16;          // goleiro expulso → jogador de linha no gol (pior)
export const INJURY_SEVERITY_WEIGHTS: [1 | 2 | 3, number][] = [[1, 0.6], [2, 0.3], [3, 0.1]];
export const PHYSIO_COST = 250;            // 🏥 Fisioterapia: −1 jogo de lesão

// Multiplicador de risco de cartão por posição (goleiro ~0; atacante baixo; zaga/volante alto).
export const CARD_POS_MULT: Record<string, number> = {
  GK: 0.03, ST: 0.6, CF: 0.6, LW: 0.7, RW: 0.7, CAM: 0.9, LM: 0.9, RM: 0.9,
  CM: 1.1, CDM: 1.35, LB: 1.15, RB: 1.15, CB: 1.3,
};
export const FOUL_YELLOW_BASE = 0.22;      // prob. base de um amarelo por falta (× posição × ímpeto × compostura)
export const STRAIGHT_RED_PROB = 0.012;    // prob. de 🟥 direto por falta
export const INJURY_FOUL_PROB = 0.06;      // prob. de lesionar o faltado numa falta dura
export const INJURY_RANDOM_BASE = 0.010;   // base de lesão aleatória por titular por jogo (× frag. física)
```

- [ ] **Step 3:** `cd client && npx tsc --noEmit` → sem erros.
- [ ] **Step 4: Commit (usuário).**

---

### Task 2: `rollInjurySeverity` + card/injury helpers puros (testados)

**Files:**
- Modify: `client/src/lib/discipline.ts`
- Test: `client/src/lib/discipline.test.ts` (Create)

**Interfaces:**
- Produces:
  - `rollInjurySeverity(rng: () => number): 1 | 2 | 3`
  - `yellowChance(position: string, composure: number, aggression: number): number`
  - `injuryChanceFromFoul(fouledPhysical: number): number`
  - `randomInjuryChance(physical: number): number`

- [ ] **Step 1: Teste que falha** — criar `discipline.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { rollInjurySeverity, yellowChance, injuryChanceFromFoul, randomInjuryChance, CARD_POS_MULT } from './discipline';

describe('rollInjurySeverity', () => {
  it('mapeia faixas do rng p/ 1/2/3 conforme os pesos (.6/.3/.1)', () => {
    expect(rollInjurySeverity(() => 0.0)).toBe(1);
    expect(rollInjurySeverity(() => 0.59)).toBe(1);
    expect(rollInjurySeverity(() => 0.61)).toBe(2);
    expect(rollInjurySeverity(() => 0.89)).toBe(2);
    expect(rollInjurySeverity(() => 0.95)).toBe(3);
  });
});

describe('yellowChance', () => {
  it('zaga arrisca mais cartão que atacante (mesma compostura/ímpeto)', () => {
    const cb = yellowChance('CB', 70, 1); const st = yellowChance('ST', 70, 1);
    expect(cb).toBeGreaterThan(st);
  });
  it('compostura alta reduz o risco', () => {
    expect(yellowChance('CM', 90, 1)).toBeLessThan(yellowChance('CM', 50, 1));
  });
  it('goleiro é ~0', () => {
    expect(yellowChance('GK', 70, 1)).toBeLessThan(0.02);
  });
});

describe('lesão', () => {
  it('jogador mais frágil (físico baixo) lesiona mais no aleatório', () => {
    expect(randomInjuryChance(50)).toBeGreaterThan(randomInjuryChance(90));
  });
  it('falta dura tem chance fixa positiva independente do físico, maior p/ frágil', () => {
    expect(injuryChanceFromFoul(50)).toBeGreaterThan(injuryChanceFromFoul(90));
    expect(injuryChanceFromFoul(90)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2:** Rodar → FAIL. `cd .. && npx vitest run client/src/lib/discipline.test.ts` (da raiz).

- [ ] **Step 3: Implementar** em `discipline.ts`:
```ts
import { INJURY_SEVERITY_WEIGHTS, CARD_POS_MULT, FOUL_YELLOW_BASE, INJURY_FOUL_PROB, INJURY_RANDOM_BASE } from './discipline'; // (mesmo arquivo — usar direto)

export function rollInjurySeverity(rng: () => number): 1 | 2 | 3 {
  let r = rng(), acc = 0;
  for (const [sev, w] of INJURY_SEVERITY_WEIGHTS) { acc += w; if (r < acc) return sev; }
  return 3;
}
// compostura 40..99 → fator 1.4..0.55 (cabeça fria = menos cartão); ímpeto do jogo escala direto.
export function yellowChance(position: string, composure: number, aggression: number): number {
  const posMult = CARD_POS_MULT[position] ?? 1;
  const compMult = Math.max(0.4, 1.6 - composure / 80);
  return FOUL_YELLOW_BASE * posMult * compMult * aggression;
}
export function injuryChanceFromFoul(fouledPhysical: number): number {
  return INJURY_FOUL_PROB * Math.max(0.5, (110 - fouledPhysical) / 60);
}
export function randomInjuryChance(physical: number): number {
  return INJURY_RANDOM_BASE * Math.max(0.4, (110 - physical) / 55);
}
```
(As constantes já estão no módulo; remover o `import` circular do exemplo — usar as consts diretamente.)

- [ ] **Step 4:** Rodar → PASS. **Step 5:** tsc. **Step 6: Commit (usuário).**

---

### Task 3: Bots com banco completo + GK reserva (`generateBotTeam`)

**Files:**
- Modify: `client/src/lib/gameEngine.ts` (`generateBotTeam`, ~2480-2525)
- Test: `client/src/lib/discipline.test.ts` (adicionar)

**Interfaces:**
- Consumes: `generateBotTeam(name, difficulty)` (já existe) — passa a retornar time com `players.length >= 18` e ≥1 GK reserva no banco (índices 11+).

- [ ] **Step 1: Teste que falha** (adicionar em `discipline.test.ts`):
```ts
import { generateBotTeam } from './gameEngine';

describe('generateBotTeam — banco', () => {
  it('gera 11 titulares + banco (>=18) com pelo menos 1 GK reserva', () => {
    const t = generateBotTeam('Bot Teste', 0.7);
    expect(t.players.length).toBeGreaterThanOrEqual(18);
    const benchGKs = t.players.slice(11).filter(p => p.position === 'GK');
    expect(benchGKs.length).toBeGreaterThanOrEqual(1);
    const starterGKs = t.players.slice(0, 11).filter(p => p.position === 'GK');
    expect(starterGKs.length).toBe(1);
  });
});
```

- [ ] **Step 2:** Rodar → FAIL (só 11 players).

- [ ] **Step 3: Implementar** — no `generateBotTeam`, após completar os 11 titulares e ANTES de montar `playerCards`, adicionar geração de banco (7 reservas incluindo 1 GK). Inserir depois do `while (selected.length < 11)`:
```ts
  // 🪑 Banco: 7 reservas da mesma faixa, GARANTINDO 1 goleiro reserva (p/ cobrir lesão/suspensão do GK).
  const bench: Player[] = [];
  const takenAll = (p: Player) => taken(p) || bench.some(b => b.id === p.id);
  // 1 GK reserva
  let gkCands = PLAYERS.filter(p => !takenAll(p) && p.position === 'GK' && inBand(p));
  if (gkCands.length === 0) gkCands = PLAYERS.filter(p => !takenAll(p) && p.position === 'GK');
  if (gkCands.length > 0) bench.push(randOf(gkCands));
  // 6 de linha variados
  while (bench.length < 7) {
    let rem = PLAYERS.filter(p => !takenAll(p) && inBand(p) && p.position !== 'GK');
    if (rem.length === 0) rem = PLAYERS.filter(p => !takenAll(p) && p.position !== 'GK');
    if (rem.length === 0) break;
    bench.push(randOf(rem));
  }
  selected.push(...bench);
```
(`selected` agora tem 18; `playerCards` mapeia todos — o motor usa `slice(0,11)`, então o banco é ignorado em jogo normal, mas existe p/ rotação. Chemistry segue calculada só sobre os 11 titulares — não mudar a chamada existente, mas certifique-se que `calculateChemistry(selected...)` receba só os 11: trocar por `selected.slice(0,11)` se hoje passa a lista toda.)

- [ ] **Step 4:** Rodar → PASS. **Step 5:** tsc + `npm run build`. **Step 6: Commit (usuário).**

Nota: verificar se `calculateChemistry` e `chemData` no `generateBotTeam` usam `selected` (agora 18). Ajustar para `selected.slice(0, 11)` para não misturar banco na química.

---

### Task 4: Geração de cartões e lesões no `runMatchSimulation`

**Files:**
- Modify: `client/src/lib/gameEngine.ts` (`runMatchSimulation`: força base ~1189, bloco de falta ~1234, agregação ~1954)
- Test: `client/src/lib/cards-injuries.balance.test.ts` (Create)

**Interfaces:**
- Consumes: `yellowChance`, `injuryChanceFromFoul`, `randomInjuryChance`, `rollInjurySeverity`, `RED_PENALTY`, `RED_GK_PENALTY`, `INJURY_DEBUFF`, `STRAIGHT_RED_PROB` de `./discipline`.
- Produces: eventos `yellow`/`red`/`injury` em `MatchResult.events`; força reduzida no time afetado.

- [ ] **Step 1: Teste que falha** — criar `cards-injuries.balance.test.ts` (padrão seeded de `balance.test.ts`):
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { simulateMatch, generateBotTeam } from './gameEngine';

function seed(s: number) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('cards & injuries — taxas', () => {
  beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seed(12345)); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('em 200 jogos, ~3-4 amarelos/jogo e vermelho/lesão raros mas presentes', () => {
    let yellows = 0, reds = 0, injuries = 0;
    for (let i = 0; i < 200; i++) {
      const a = generateBotTeam('A' + i, 0.7), b = generateBotTeam('B' + i, 0.7);
      const r = simulateMatch(a, b);
      yellows += r.events.filter(e => e.type === 'yellow').length;
      reds += r.events.filter(e => e.type === 'red').length;
      injuries += r.events.filter(e => e.type === 'injury').length;
    }
    const perGame = yellows / 200;
    expect(perGame).toBeGreaterThan(2); expect(perGame).toBeLessThan(6);
    expect(reds).toBeGreaterThan(0); expect(reds).toBeLessThan(200 * 0.4);   // raro
    expect(injuries).toBeGreaterThan(0); expect(injuries).toBeLessThan(200); // ~ até 1/jogo
  });
});
```

- [ ] **Step 2:** Rodar → FAIL (nenhum evento yellow/red/injury gerado).

- [ ] **Step 3: Implementar** — três edições em `runMatchSimulation`:

**(a) Força base mutável + estado disciplinar** (trocar os `const` ~1189-1190 e adicionar estado logo abaixo):
```ts
  // Força base agora é MUTÁVEL — recomputada quando um evento disciplinar muda a XI/atributos.
  const sentOff = new Set<string>();                 // ids removidos (🟥)
  const injuredDebuff: Record<string, number> = {};  // id → nº de atributos-debuff (lesão em campo)
  let homeExtraPenalty = 0, awayExtraPenalty = 0;     // 🟥 (RED_PENALTY / RED_GK_PENALTY)
  const strengthOf = (team: Team, coach: typeof homeCoach, chem: typeof homeChem, formBonus: number) =>
    calculateTeamStrength(team, coach, chem, formBonus, { sentOff, injuredDebuff, injuryDebuff: INJURY_DEBUFF }) + zidaneBonus(team);
  let homeBaseStrength = strengthOf(home, homeCoach, homeChem, homeFormBonus);
  let awayBaseStrength = strengthOf(away, awayCoach, awayChem, awayFormBonus);
  const recomputeStrength = () => {
    homeBaseStrength = strengthOf(home, homeCoach, homeChem, homeFormBonus);
    awayBaseStrength = strengthOf(away, awayCoach, awayChem, awayFormBonus);
  };
```
E aplicar as penalidades por-minuto onde `homeStrength`/`awayStrength` são montados (~1195-1199):
```ts
    const homeStrength = homeBaseStrength - homeExtraPenalty + (fergusonActive(...) ? 10 : 0) + (isFinal ? 0 : HOME_ADVANTAGE);
    const awayStrength = awayBaseStrength - awayExtraPenalty + (fergusonActive(...) ? 10 : 0);
```
`calculateTeamStrength` ganha um 4º/5º parâmetro opcional `disc?` que, ao mediar os 11, **pula** ids em `sentOff` (divide pela quantidade restante) e **subtrai `injuryDebuff`** dos atributos de ids em `injuredDebuff`. (Editar `calculateTeamStrength` para aceitar e aplicar isso; sem `disc`, comportamento idêntico ao atual.)

**(b) Geração no bloco de falta** — dentro do `if (Math.random() < FLAVOR_FOUL_RATE * matchAggression) {` (~1234), após incrementar `Fouls`, adicionar:
```ts
      // Quem cometeu a falta (lado DEFENSOR), ponderado por posição (zaga/volante faltam mais).
      const foulerPool = defendTeam.players.slice(0, 11).filter(p => !sentOff.has(p.id) && p.position !== 'GK');
      const fouler = pickFouler(foulerPool); // helper: peso por CARD_POS_MULT
      if (fouler) {
        const fComp = fouler.composure ?? 65;
        const yc = yellowChance(fouler.position, fComp, matchAggression);
        const already = bookings.get(fouler.id) ?? 0;
        if (Math.random() < STRAIGHT_RED_PROB) {
          applySendOff(fouler, defendTeam, 'red');           // 🟥 direto
        } else if (Math.random() < yc) {
          if (already >= 1) applySendOff(fouler, defendTeam, 'second-yellow'); // 2º amarelo = 🟥
          else { bookings.set(fouler.id, already + 1); pushCard(fouler, defendTeam, 'yellow', minute); }
        }
      }
      // Lesão do FALTADO (lado atacante) por falta dura.
      const fouledPool = attackTeam.players.slice(0, 11).filter(p => !injuredDebuff[p.id] && !sentOff.has(p.id));
      const fouled = fouledPool[Math.floor(Math.random() * fouledPool.length)];
      if (fouled && Math.random() < injuryChanceFromFoul(fouled.physical ?? 70)) {
        applyInjury(fouled, attackTeam, minute);
      }
```
Onde os helpers (definidos no escopo de `runMatchSimulation`):
```ts
  const bookings = new Map<string, number>(); // id → nº de amarelos no jogo
  const pushCard = (p: Player, team: Team, type: 'yellow' | 'red', minute: number) => {
    events.push({ minute, type, description: type === 'yellow' ? `🟨 Amarelo para ${p.shortName}` : `🟥 ${p.shortName} está EXPULSO!`, teamId: team.id, playerId: p.id, isSpecial: type === 'red' });
  };
  const applySendOff = (p: Player, team: Team, reason: 'red' | 'second-yellow') => {
    if (sentOff.has(p.id)) return;
    if (reason === 'second-yellow') pushCard(p, team, 'yellow', minute);
    pushCard(p, team, 'red', minute);
    sentOff.add(p.id);
    const pen = p.position === 'GK' ? RED_GK_PENALTY : RED_PENALTY;
    if (team.id === home.id) homeExtraPenalty += pen; else awayExtraPenalty += pen;
    recomputeStrength();
  };
  const applyInjury = (p: Player, team: Team, minute: number) => {
    if (injuredDebuff[p.id]) return;
    injuredDebuff[p.id] = INJURY_DEBUFF;
    events.push({ minute, type: 'injury', description: `🩹 ${p.shortName} se machucou e segue limitado`, teamId: team.id, playerId: p.id, isSpecial: true });
    recomputeStrength();
  };
  const pickFouler = (pool: Player[]): Player | undefined => {
    if (pool.length === 0) return undefined;
    const weights = pool.map(p => CARD_POS_MULT[p.position] ?? 1);
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  };
```
Também: **lesão aleatória** (não-falta) — um passe único por jogo, no início do loop de minutos ou uma vez antes: para cada titular, `if (Math.random() < randomInjuryChance(p.physical))` num minuto sorteado → `applyInjury`. Implementar como uma verificação leve por minuto com prob. dividida por (endMinute-startMinute) para dar a taxa alvo.

**(c) Agregação de stats** (~1954, no loop que processa eventos) — adicionar após o `else if (e.type === 'yellow')`:
```ts
    } else if (e.type === 'red') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) { playerStats[sk].redCards++; playerStats[sk].rating -= 1.5; }
    } else if (e.type === 'injury') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) playerStats[sk].rating -= 0.3;
    }
```
E garantir que o expulso não seja MVP (onde o MVP é escolhido, filtrar ids com `redCards > 0`).

- [ ] **Step 4:** Rodar o teste → PASS (taxas na faixa). Ajustar constantes se fora.
- [ ] **Step 5: A/B e hierarquia** — adicionar testes: compostura alta→menos cartão; físico alto→menos lesão; time forçado a jogar com 🟥 (simular com um `sentOff` inicial não dá — em vez disso, comparar médias de gols sofridos entre um pool com muitos vermelhos vs sem). Alternativa robusta: teste unitário de `calculateTeamStrength` com `disc.sentOff` de 1 jogador → força menor que sem; com `injuredDebuff` → força menor, porém MENOS que o sentOff (hierarquia).
```ts
it('hierarquia: 10 homens penaliza mais que 1 lesionado', () => {
  const t = generateBotTeam('X', 0.7);
  const full = calculateTeamStrengthPublic(t);
  const withInjury = calculateTeamStrengthPublic(t, { injuredDebuff: { [t.players[5].id]: 12 }, injuryDebuff: 12 });
  const withRed = calculateTeamStrengthPublic(t, { sentOff: new Set([t.players[5].id]) }); // + RED_PENALTY aplicado à parte
  expect(withInjury).toBeLessThan(full);
  expect(withRed).toBeLessThanOrEqual(withInjury); // menos jogadores dói mais
});
```
(Expor um `calculateTeamStrengthPublic` de teste ou testar via a assinatura estendida.)

- [ ] **Step 6:** `npm run build` + rodar `npx vitest run` completo (regressões). Re-tunar `GK_SAVE_EDGE`/`ON_TARGET_RESISTANCE` se o placar médio sair de 2.9–3.2.
- [ ] **Step 7: Commit (usuário).**

---

### Task 5: Exibir 🟨🟥🩹 na transmissão ao vivo + MatchDetailsModal

**Files:**
- Modify: `client/src/pages/MatchSimPage.tsx` (feed de destaques ~2015-2026; replay ~1096; narração ~1606)
- Modify: `client/src/components/game/MatchDetailsModal.tsx`

**Interfaces:** consome os eventos `yellow`/`red`/`injury` já presentes em `result.events`.

- [ ] **Step 1:** No feed de destaques (filtro `event.type === 'goal' || event.type === 'penalty'`, ~2023), incluir os novos e renderizar com ícone/cor:
```ts
.filter(event => ['goal', 'penalty', 'yellow', 'red', 'injury'].includes(event.type))
```
e no map, um badge por tipo: 🟨 (amarelo), 🟥 (vermelho, vermelho forte), 🩹 (lesão) com minuto + `event.description`.

- [ ] **Step 2:** No replay minuto-a-minuto (~1096, `otherEvs`) e na narração (~1606, cadeia de `e.type`), adicionar casos `red` e `injury` (yellow/foul já tratados) para tocarem ao vivo junto com os lances.

- [ ] **Step 3:** No `MatchDetailsModal.tsx`, ao listar eventos/jogadores, mostrar 🟨🟥🩹 ao lado do nome do jogador afetado (derivar de `result.events`).

- [ ] **Step 4:** tsc + rodar o app (`npm run dev`) e conferir um jogo: cartões/lesões aparecem ao vivo com os gols. **Step 5: Commit (usuário).**

---

## FASE 2 — Temporada (solo): carregar consequências + rotação

### Task 6: `applyMatchDiscipline` (pós-jogo puro)

**Files:**
- Modify: `client/src/lib/discipline.ts`
- Test: `client/src/lib/discipline.test.ts`

**Interfaces:**
- Produces:
  - `applyMatchDiscipline(prev: DisciplineMap, playedTeamIds: string[], results: MatchResult[], nameOf: (teamId: string, playerId: string) => string): { next: DisciplineMap; newSuspensions: DisciplineEntry[]; newInjuries: DisciplineEntry[] }`
  - `resetYellowsForKnockout(m: DisciplineMap): DisciplineMap`
  - `healInjury(m: DisciplineMap, teamId: string, playerId: string): DisciplineMap`

- [ ] **Step 1: Teste que falha** (adicionar em `discipline.test.ts`):
```ts
import { applyMatchDiscipline, resetYellowsForKnockout, healInjury, availKey } from './discipline';
const nameOf = () => 'Jogador';
const evt = (type: any, teamId: string, playerId: string) => ({ minute: 10, type, description: '', teamId, playerId });
const res = (homeTeamId: string, awayTeamId: string, events: any[]) => ({ homeTeamId, awayTeamId, homeGoals: 0, awayGoals: 0, winner: null, events, stats: {} } as any);

describe('applyMatchDiscipline', () => {
  it('3º amarelo acumulado → suspenso 1 jogo e zera amarelos', () => {
    let m = { [availKey('t', 'p')]: { yellows: 2, banned: 0, injured: 0 } };
    const out = applyMatchDiscipline(m, ['t', 'o'], [res('t', 'o', [evt('yellow', 't', 'p')])], nameOf);
    expect(out.next[availKey('t', 'p')]).toEqual({ yellows: 0, banned: 1, injured: 0 });
    expect(out.newSuspensions).toHaveLength(1);
  });
  it('🟥 → suspenso 1 jogo (aplica no PRÓXIMO, não decrementa neste)', () => {
    const out = applyMatchDiscipline({}, ['t', 'o'], [res('t', 'o', [evt('red', 't', 'p')])], nameOf);
    expect(out.next[availKey('t', 'p')].banned).toBe(1);
  });
  it('decrementa quem já estava fora nos times que jogaram, ANTES de aplicar o novo', () => {
    let m = { [availKey('t', 'x')]: { yellows: 0, banned: 1, injured: 0 } };
    const out = applyMatchDiscipline(m, ['t', 'o'], [res('t', 'o', [])], nameOf);
    expect(out.next[availKey('t', 'x')].banned).toBe(0); // cumpriu o jogo
  });
  it('lesão seta injured pela gravidade', () => {
    const out = applyMatchDiscipline({}, ['t', 'o'], [res('t', 'o', [evt('injury', 't', 'p')])], nameOf, () => 2 as any);
    // se aceitar rng p/ gravidade determinística nos testes:
    expect(out.next[availKey('t', 'p')].injured).toBeGreaterThanOrEqual(1);
  });
});

describe('reset & physio', () => {
  it('resetYellowsForKnockout zera amarelos e preserva bans/lesões', () => {
    const m = { [availKey('t', 'p')]: { yellows: 2, banned: 1, injured: 2 } };
    expect(resetYellowsForKnockout(m)[availKey('t', 'p')]).toEqual({ yellows: 0, banned: 1, injured: 2 });
  });
  it('healInjury reduz 1 (piso 0)', () => {
    const m = { [availKey('t', 'p')]: { yellows: 0, banned: 0, injured: 2 } };
    expect(healInjury(m, 't', 'p')[availKey('t', 'p')].injured).toBe(1);
  });
});
```

- [ ] **Step 2:** Rodar → FAIL.

- [ ] **Step 3: Implementar** (assinatura com `injurySeverityRng` opcional p/ testes determinísticos):
```ts
export function applyMatchDiscipline(
  prev: DisciplineMap, playedTeamIds: string[], results: MatchResult[],
  nameOf: (teamId: string, playerId: string) => string,
  injurySeverityRng: () => number = Math.random,
): { next: DisciplineMap; newSuspensions: DisciplineEntry[]; newInjuries: DisciplineEntry[] } {
  const next: DisciplineMap = {};
  for (const k in prev) next[k] = { ...prev[k] };
  // 1) DECREMENTA quem estava fora nos times que jogaram (cumpriu 1 jogo).
  for (const teamId of playedTeamIds) {
    for (const k in next) {
      if (!k.startsWith(teamId + ':')) continue;
      if (next[k].banned > 0) next[k].banned--;
      if (next[k].injured > 0) next[k].injured--;
    }
  }
  // 2) APLICA as consequências deste jogo (a partir dos eventos).
  const newSuspensions: DisciplineEntry[] = [];
  const newInjuries: DisciplineEntry[] = [];
  const bump = (teamId: string, playerId: string) => {
    const k = availKey(teamId, playerId);
    if (!next[k]) next[k] = { yellows: 0, banned: 0, injured: 0 };
    return next[k];
  };
  for (const r of results) {
    // amarelos deste jogo (por jogador)
    const yellowsThis: Record<string, number> = {};
    for (const e of r.events) {
      if (!e.playerId) continue;
      if (e.type === 'yellow') yellowsThis[availKey(e.teamId, e.playerId)] = (yellowsThis[availKey(e.teamId, e.playerId)] ?? 0) + 1;
    }
    for (const key in yellowsThis) {
      const [teamId, playerId] = key.split(':');
      const a = bump(teamId, playerId);
      a.yellows += yellowsThis[key];
      if (a.yellows >= YELLOW_ACCUM_THRESHOLD) { a.yellows = 0; a.banned = Math.max(a.banned, 1); newSuspensions.push({ teamId, playerId, playerName: nameOf(teamId, playerId), games: 1, kind: 'ban' }); }
    }
    for (const e of r.events) {
      if (!e.playerId) continue;
      if (e.type === 'red') { const a = bump(e.teamId, e.playerId); a.banned = Math.max(a.banned, 1); newSuspensions.push({ teamId: e.teamId, playerId: e.playerId, playerName: nameOf(e.teamId, e.playerId), games: 1, kind: 'ban' }); }
      if (e.type === 'injury') { const sev = rollInjurySeverity(injurySeverityRng); const a = bump(e.teamId, e.playerId); a.injured = Math.max(a.injured, sev); newInjuries.push({ teamId: e.teamId, playerId: e.playerId, playerName: nameOf(e.teamId, e.playerId), games: sev, kind: 'injury' }); }
    }
  }
  return { next, newSuspensions, newInjuries };
}
export function resetYellowsForKnockout(m: DisciplineMap): DisciplineMap {
  const out: DisciplineMap = {};
  for (const k in m) out[k] = { ...m[k], yellows: 0 };
  return out;
}
export function healInjury(m: DisciplineMap, teamId: string, playerId: string): DisciplineMap {
  const k = availKey(teamId, playerId); if (!m[k]) return m;
  return { ...m, [k]: { ...m[k], injured: Math.max(0, m[k].injured - 1) } };
}
```

- [ ] **Step 4:** Rodar → PASS. **Step 5:** tsc. **Step 6: Commit (usuário).**

---

### Task 7: `resolveAvailableLineup` (com goleiro) — pós puro

**Files:**
- Modify: `client/src/lib/discipline.ts`
- Test: `client/src/lib/discipline.test.ts`

**Interfaces:**
- Produces: `resolveAvailableLineup(team: Team, m: DisciplineMap): { team: Team; forced: { outId: string; inId: string }[] }`.
- Consumes: `rebuildTeamChemistry` de `./gameEngine` (recompute química/OOP) — importar.

- [ ] **Step 1: Teste que falha** (adicionar):
```ts
import { resolveAvailableLineup, availKey } from './discipline';
const mkP = (id: string, position: string, overall = 75): any => ({ id, shortName: id, position, overall, secondaryPositions: [] });
const mkTeam = (players: any[]): any => ({ id: 't', players, captain: null, penaltyTaker: null, freeKickTaker: null, coachId: 'guardiola', formationId: '4-3-3', playStyle: 'balanced', totalChemistry: 0 });

describe('resolveAvailableLineup', () => {
  it('promove reserva compatível quando um titular está suspenso', () => {
    const players = [mkP('gk','GK'), ...Array.from({length:10},(_,i)=>mkP('s'+i, i<4?'CB':'CM')), mkP('b0','CM', 80)];
    const team = mkTeam(players);
    const m = { [availKey('t','s5')]: { yellows:0, banned:1, injured:0 } };
    const out = resolveAvailableLineup(team, m);
    expect(out.team.players.slice(0,11).some(p => p.id === 's5')).toBe(false); // fora do XI
    expect(out.team.players.slice(0,11).some(p => p.id === 'b0')).toBe(true);  // reserva entrou
    expect(out.forced).toEqual([{ outId: 's5', inId: 'b0' }]);
  });
  it('GK indisponível promove GK reserva do banco', () => {
    const players = [mkP('gk','GK'), ...Array.from({length:10},(_,i)=>mkP('s'+i,'CM')), mkP('gk2','GK', 78)];
    const team = mkTeam(players);
    const m = { [availKey('t','gk')]: { yellows:0, banned:0, injured:2 } };
    const out = resolveAvailableLineup(team, m);
    expect(out.team.players[0].position === 'GK' || out.team.players.slice(0,11).filter(p=>p.position==='GK').length===1).toBe(true);
    expect(out.team.players.slice(0,11).filter(p => p.position === 'GK')).toHaveLength(1);
    expect(out.team.players.slice(0,11).some(p => p.id === 'gk2')).toBe(true);
  });
  it('sem GK no banco, coloca linha no gol marcado isOOP (nunca fica sem goleiro)', () => {
    const players = [mkP('gk','GK'), ...Array.from({length:10},(_,i)=>mkP('s'+i,'CM')), mkP('b0','CM')];
    const team = mkTeam(players);
    const m = { [availKey('t','gk')]: { yellows:0, banned:1, injured:0 } };
    const out = resolveAvailableLineup(team, m);
    expect(out.team.players.slice(0,11).filter(p => p.position === 'GK' || (p as any).isOOP).length).toBeGreaterThanOrEqual(1);
    expect(out.team.players.slice(0,11)).toHaveLength(11);
  });
  it('re-seleciona capitão se ele sair do XI', () => {
    const players = [mkP('gk','GK'), ...Array.from({length:10},(_,i)=>mkP('s'+i,'CM')), mkP('b0','CM')];
    const team = { ...mkTeam(players), captain: 's3' };
    const m = { [availKey('t','s3')]: { yellows:0, banned:1, injured:0 } };
    const out = resolveAvailableLineup(team, m);
    expect(out.team.captain).not.toBe('s3');
    expect(out.team.players.slice(0,11).some(p => p.id === out.team.captain)).toBe(true);
  });
});
```

- [ ] **Step 2:** Rodar → FAIL.

- [ ] **Step 3: Implementar** — algoritmo:
  1. Separar XI (0-10) e banco (11+). Para cada titular indisponível (`!isAvailable`), achar o melhor reserva disponível compatível (mesma posição/secundária, senão maior overall), preferindo GK↔GK. Trocar de lugar (titular vai pro banco, reserva sobe).
  2. Se o GK titular ficou indisponível e não há GK disponível no banco: promover o melhor jogador de linha disponível, marcá-lo `isOOP=true` e position lógica GK (ou manter position mas flag OOP — usar o mecanismo `isOOP`).
  3. Reconstruir o time com `rebuildTeamChemistry`.
  4. Se `captain`/`penaltyTaker`/`freeKickTaker` caiu para fora do XI, re-selecionar (maior overall do XI para capitão; melhor `composure`/`shooting` para batedores).
  5. Retornar `{ team, forced }`.
```ts
import { rebuildTeamChemistry } from './gameEngine';
export function resolveAvailableLineup(team: Team, m: DisciplineMap): { team: Team; forced: { outId: string; inId: string }[] } {
  const players = [...team.players];
  const forced: { outId: string; inId: string }[] = [];
  const avail = (p: Player) => isAvailable(m, team.id, p.id);
  const fits = (p: Player, pos: string) => p.position === pos || (p.secondaryPositions?.includes(pos) ?? false);
  for (let i = 0; i < 11; i++) {
    const starter = players[i];
    if (!starter || avail(starter)) continue;
    const wantGK = starter.position === 'GK';
    // candidatos do banco disponíveis
    let bench = players.slice(11).filter(p => avail(p));
    let pick = wantGK
      ? bench.filter(p => p.position === 'GK').sort((a, b) => b.overall - a.overall)[0]
      : (bench.filter(p => fits(p, starter.position)).sort((a, b) => b.overall - a.overall)[0]
         ?? bench.sort((a, b) => b.overall - a.overall)[0]);
    if (!pick && wantGK) {
      // sem GK reserva → melhor linha disponível vai pro gol (OOP)
      pick = bench.sort((a, b) => b.overall - a.overall)[0];
      if (pick) (pick as any).isOOP = true;
    }
    if (!pick) continue; // banco esgotado (raro) — deixa como está
    const bi = players.indexOf(pick);
    [players[i], players[bi]] = [players[bi], players[i]]; // troca
    forced.push({ outId: starter.id, inId: pick.id });
  }
  let resolved: Team = rebuildTeamChemistry({ ...team, players });
  // re-seleciona capitão/batedores se saíram do XI
  const xiIds = new Set(resolved.players.slice(0, 11).map(p => p.id));
  const bestBy = (key: 'overall' | 'composure' | 'shooting') =>
    resolved.players.slice(0, 11).slice().sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0]?.id ?? null;
  if (resolved.captain && !xiIds.has(resolved.captain)) resolved = { ...resolved, captain: bestBy('overall') };
  if (resolved.penaltyTaker && !xiIds.has(resolved.penaltyTaker)) resolved = { ...resolved, penaltyTaker: bestBy('composure') };
  if (resolved.freeKickTaker && !xiIds.has(resolved.freeKickTaker)) resolved = { ...resolved, freeKickTaker: bestBy('shooting') };
  return { team: resolved, forced };
}
```

- [ ] **Step 4:** Rodar → PASS. **Step 5:** tsc. **Step 6: Commit (usuário).**

---

### Task 8: Integração no reducer solo (aplica pós-jogo, resolve escalação, reset, physio)

**Files:**
- Modify: `client/src/contexts/GameContext.tsx`
- Test: `client/src/lib/discipline-season.test.ts` (Create — invariantes)

**Interfaces:** consome `applyMatchDiscipline`, `resolveAvailableLineup`, `resetYellowsForKnockout`, `healInjury`, `DisciplineMap`, `isAvailable`.

- [ ] **Step 1:** Estado: `discipline: DisciplineMap` no `GameState` + `discipline: {}` no `initialState`. Import do módulo.

- [ ] **Step 2:** Ação `HEAL_INJURY { playerId }` (paga `PHYSIO_COST`, chama `healInjury(discipline, playerTeam.id, playerId)`), e `SHOP_COSTS.physio` em `shop.ts`.

- [ ] **Step 3:** Em `FINISH_LEAGUE_MATCH`: após montar `allFixtures`, chamar `applyMatchDiscipline(state.discipline, [todos os teamIds da rodada], resultsDaRodada, nameOf)` e guardar `next` em `discipline`. `nameOf` resolve pelo `allTeams`.

- [ ] **Step 4:** Antes de simular os jogos dos bots/da rodada (no ponto onde os times entram no `simulateMatch`), aplicar `resolveAvailableLineup(team, state.discipline)` para CADA time (jogador + bots), usando o XI resolvido. (No solo o jogador já pode ter ajustado; auto-resolve o resto.)

- [ ] **Step 5:** `FINISH_KNOCKOUT_MATCH` / `PLAY_KNOCKOUT_LEG`: mesma aplicação por perna (times da rodada ativa). `START_KNOCKOUT`: `discipline = resetYellowsForKnockout(discipline)`.

- [ ] **Step 6: Teste de invariantes** — `discipline-season.test.ts`: simular uma temporada solo (dispatch das ações ou chamando as funções puras em loop com resultados sintéticos) e assertar: ninguém com `banned>0`/`injured>0` aparece no XI resolvido; contadores decrementam; amarelos zeram após reset; todo XI tem 11 e exatamente 1 GK.

- [ ] **Step 7:** tsc + `npm run build` + `npx vitest run`. **Step 8: Commit (usuário).**

---

### Task 9: UI — badges, bloqueio no XI, aviso de desfalques, Fisioterapia, sub-aba DISCIPLINA

**Files:**
- Modify: `SquadEditor.tsx`, `LeagueSquadTab.tsx`, `LeaguePage.tsx`, `KnockoutTiesTab.tsx`, `ShopTab.tsx`

- [ ] **Step 1:** Badges no card do jogador (SquadEditor/LeagueSquadTab): ler `state.discipline[availKey(teamId,id)]` → `🟨×N`, `🟥 SUSP (n)`, `🩹 LESÃO (n)`.
- [ ] **Step 2:** Bloquear indisponível no swap para o XI (no SquadEditor, impedir mover indisponível p/ índice <11; mostrar tooltip).
- [ ] **Step 3:** Botão **🏥 Fisioterapia** no card do lesionado (dispatch `HEAL_INJURY`), custo `PHYSIO_COST`.
- [ ] **Step 4:** Aviso de desfalques antes da rodada (LeaguePage/KnockoutTiesTab): usar `newSuspensions`/`newInjuries` (guardar o último resumo no estado, ex. `lastAbsences`) ou derivar do `discipline` + XI.
- [ ] **Step 5:** Sub-aba **DISCIPLINA** em ESTATÍSTICAS (LeaguePage `statsSubTab`): listas de mais amarelos / expulsões / lesionados a partir de `getPlayerSeasonStats` (já agrega `yellowCards/redCards/fouls`).
- [ ] **Step 6:** tsc + rodar app. **Step 7: Commit (usuário).**

---

## FASE 3 — Online (autoritativo)

### Task 10: `discipline` no servidor + aplicação pós-jogo + resolução de escalação

**Files:**
- Modify: `server/handlers.ts`

- [ ] **Step 1:** `discipline: DisciplineMap` no `RoomState` (init `{}`, reset no `restart_room`). Import de `../client/src/lib/discipline.js`.
- [ ] **Step 2:** Após `play_round` simular: `applyMatchDiscipline` com todos os teamIds/resultados da rodada; guardar em `room.discipline`. Reset no início do mata-mata (`start_knockout` equivalente).
- [ ] **Step 3:** Antes de simular cada partida (liga e perna), `resolveAvailableLineup(team, room.discipline)` para cada time (humanos + bots) — usar o XI resolvido na simulação.
- [ ] **Step 4:** `player_heal_injury` (paga, chama `healInjury`) — só o autor. Validar disponibilidade nas edições de XI (não deixar escalar indisponível).
- [ ] **Step 5:** `npm run build`. **Step 6: Commit (usuário).**

### Task 11: Sync + validação no cliente online

**Files:**
- Modify: `client/src/contexts/GameContext.tsx`

- [ ] **Step 1:** Sync `discipline: roomState.discipline ?? {}` no `SET_ONLINE_STATE`.
- [ ] **Step 2:** Emits `player_heal_injury`. UI online lê `state.discipline` igual ao solo (badges/avisos).
- [ ] **Step 3:** tsc + `npm run build`. **Step 4: Commit (usuário).**

### Task 12: Fechamento total

- [ ] `cd client && npx tsc --noEmit` limpo; `npx vitest run` verde (discipline + balance + season + regressões); raiz `npm run build` limpo.
- [ ] Manual solo + online: cartões/lesões ao vivo com os gols; desfalque promove reserva (com aviso) e nunca deixa sem goleiro; suspenso/lesionado não escala; amarelos zeram no mata-mata; bots rodam banco; Fisioterapia funciona; online sincroniza sem vazar.
- [ ] Commit final (usuário).

---

## Ordem de execução
Fase 1: **1 → 2 → 3 → 4 → 5**. Fase 2: **6 → 7 → 8 → 9**. Fase 3: **10 → 11 → 12**.

## Self-review (cobertura da spec)
- §3.1 geração/força mutável/agregação → Task 4. §3.1b atributos/formação/tática → Tasks 2+4 (yellowChance/pos mult/aggression). §3.1c goleiro → Tasks 3 (banco GK), 4 (RED_GK_PENALTY/taxa~0), 7 (promoção GK/linha-no-gol). §3.2 mapa → Tasks 1,8,10. §3.3 applyMatchDiscipline/resolve/reset/heal → Tasks 6,7,8. §4 integração/ao vivo → Task 5; características em cascata → Task 7 (rebuildTeamChemistry). §5 UI → Task 9. §6 números → Task 1 (constantes). §7 sync online → Tasks 10,11. §8 testes → Tasks 2,4,6,7,8 (unit/balance/season) + regressões. §9 fases → 1/2/3. Sem lacunas.
```
