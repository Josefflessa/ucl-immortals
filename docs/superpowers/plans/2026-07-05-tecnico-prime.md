# Técnico Prime — Fase 2 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolução do técnico pro Prime (4 vitórias na campanha + 500 pontos) que troca o estádio padrão pelo estádio temático do técnico — mais forte em casa (+7) e com um buff temático em 2 atributos que premia stackar o clube/nação daquele estádio.

**Architecture:** `coachPrime` vive em `Team.coachPrime` (solo via `playerTeam`, online via `RoomPlayer.team`, já sincronizado por `me.team` no `SET_ONLINE_STATE`). O estádio deriva de `stadiumFor(coachId, prime)`. O motor aplica dois buffs de casa: **uniforme** (+4 padrão / +7 Prime, como bônus de força do mandante) e **temático** (+3/+6 nos 2 atributos do tema, via a máquina de modificadores por atributo, injetado no contexto do mandante). Um único componente `CoachStadiumPanel` mostra técnico+estádio nas telas, com o botão/modal de evolução.

**Tech Stack:** React + TypeScript (Vite), TailwindCSS (inline styles), framer-motion, Socket.io (online), Vitest (ambiente `node`, só engine puro).

## Global Constraints

- **NÃO COMMITAR.** O usuário faz todos os commits. Cada task termina num **Checkpoint** (typecheck/build/test), nunca em `git commit`.
- **Build a partir da raiz:** `npm run build` (cliente + servidor). Typecheck cliente: `cd client && npx tsc --noEmit`. Testes: `npx vitest run <arquivo>` **da raiz**.
- **pt-br** em todo texto ao jogador.
- **Portão da evolução:** `wins >= 4` (vitórias da fase de liga, do `StandingsEntry.won` do time do jogador) **E** `points >= 500`. Custo: **500 pontos**. Uma vez por campanha, permanente.
- **Buff Prime em casa** (nunca na final): uniforme **+7** (vs +4); temático **+3** nos 2 atributos do tema pra todos, **+6** pros do clube/nação daquele estádio. Números calibráveis via harness.
- **Bots não evoluem** (`Team.coachPrime` fica `undefined`/`false` neles — nenhuma mudança em `generateBotTeam`).
- Fase 1 (estádio padrão +4) **intacta**.

---

## File Structure

- `client/src/lib/stadium.ts` **(modificar)** — `Stadium` ganha campos do tema; `PRIME_STADIUMS`; `stadiumFor()`.
- `client/src/lib/stadium.test.ts` **(modificar)** — testes de `stadiumFor`/`PRIME_STADIUMS`.
- `client/src/lib/gameEngine.ts` **(modificar)** — `Team.coachPrime`; constantes Prime; buff uniforme (+7) e temático em `getEffectiveAttribute`; `homeStadium` no contexto do mandante.
- `client/src/lib/engine-units.test.ts` **(modificar)** — testes do buff temático + `PRIME_HOME_ATTR_BONUS`.
- `client/src/lib/shop.ts` **(modificar)** — `PRIME_COST`, `PRIME_WINS_REQUIRED`, `canEvolvePrime()`.
- `client/src/lib/shop.test.ts` **(modificar)** — teste de `canEvolvePrime`.
- `client/src/contexts/GameContext.tsx` **(modificar)** — action `EVOLVE_COACH_PRIME` (solo) + helper `evolveCoachPrimeOnline`.
- `server/handlers.ts` **(modificar)** — `RoomPlayer.coachPrime` + handler `evolve_coach_prime`.
- `client/src/components/game/CoachCard.tsx` **(modificar)** — foto/moldura Prime + modo `bare`.
- `client/src/components/game/StadiumCard.tsx` **(modificar)** — texto do buff Prime + modo `bare`.
- `client/src/components/game/CoachStadiumPanel.tsx` **(criar)** — card único + botão/modal de evolução.
- `client/src/components/game/SquadEditor.tsx` **(modificar)** — usar o painel + novas props.
- `client/src/components/game/LeagueSquadTab.tsx` **(modificar)** — wire `wins`/`points`/`coachPrime`/`onEvolvePrime`.
- `client/src/pages/MatchSimPage.tsx` **(modificar)** — venue com estádio temático.
- `client/src/pages/ReportPage.tsx` **(modificar)** — usar o painel (sem botão).

---

## Task 1: Modelo — `PRIME_STADIUMS` + `stadiumFor`

**Files:**
- Modify: `client/src/lib/stadium.ts`
- Test: `client/src/lib/stadium.test.ts`

**Interfaces:**
- Produces: `Stadium` estendido (`prime?`, `themedAttrs?`, `themedClub?`, `themedNation?`, `coachPhotoUrl?`); `PRIME_STADIUMS: Record<string, Stadium>`; `stadiumFor(coachId: string, prime: boolean): Stadium`.

- [ ] **Step 1: Escrever os testes**

Adicionar em `client/src/lib/stadium.test.ts`:

```ts
import { DEFAULT_STADIUM, PRIME_STADIUMS, stadiumFor } from './stadium';

describe('estádios Prime', () => {
  it('stadiumFor volta o padrão sem prime e o temático com prime', () => {
    expect(stadiumFor('guardiola', false)).toBe(DEFAULT_STADIUM);
    const et = stadiumFor('guardiola', true);
    expect(et.name).toBe('Etihad');
    expect(et.homeAttrBonus).toBe(7);
    expect(et.prime).toBe(true);
    expect(et.themedAttrs).toEqual(['passing', 'vision']);
    expect(et.themedClub).toBe('Manchester City');
  });
  it('tem os 6 técnicos, todos +7 e com foto Prime', () => {
    for (const id of ['guardiola', 'klopp', 'ancelotti', 'mourinho', 'zidane', 'ferguson']) {
      const s = PRIME_STADIUMS[id];
      expect(s.homeAttrBonus).toBe(7);
      expect(s.prime).toBe(true);
      expect(s.coachPhotoUrl).toMatch(/^\/coaches\/prime\//);
      expect(s.themedClub || s.themedNation).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run client/src/lib/stadium.test.ts`
Expected: FALHA — `PRIME_STADIUMS`/`stadiumFor` não existem.

- [ ] **Step 3: Estender o modelo**

Em `client/src/lib/stadium.ts`, trocar a `interface Stadium` e adicionar o resto:

```ts
export type StadiumAttr = 'pace'|'shooting'|'passing'|'dribbling'|'defending'|'physical'|'vision'|'composure';

export interface Stadium {
  id: string;
  name: string;
  photoUrl: string;
  homeAttrBonus: number;          // +N em todos os atributos, em casa
  prime?: boolean;
  themedAttrs?: [StadiumAttr, StadiumAttr]; // 2 atributos do tema (só Prime)
  themedClub?: string;            // clube que ganha o buff maior
  themedNation?: string;          // OU nação (Dragão → 'Portugal')
  coachPhotoUrl?: string;         // foto Prime do técnico
}
```

Manter o `DEFAULT_STADIUM` como está e adicionar no fim do arquivo:

```ts
// Estádios temáticos por técnico (Fase 2). Fotos em client/public/stadiums e /coaches/prime.
export const PRIME_STADIUMS: Record<string, Stadium> = {
  guardiola: { id: 'etihad',      name: 'Etihad',            photoUrl: '/stadiums/etihad.webp',      homeAttrBonus: 7, prime: true, themedAttrs: ['passing', 'vision'],    themedClub: 'Manchester City',   coachPhotoUrl: '/coaches/prime/guardiola.webp' },
  klopp:     { id: 'anfield',     name: 'Anfield',           photoUrl: '/stadiums/anfield.webp',     homeAttrBonus: 7, prime: true, themedAttrs: ['pace', 'physical'],     themedClub: 'Liverpool',         coachPhotoUrl: '/coaches/prime/klopp.webp' },
  ancelotti: { id: 'sansiro',     name: 'San Siro',          photoUrl: '/stadiums/sansiro.webp',     homeAttrBonus: 7, prime: true, themedAttrs: ['passing', 'composure'], themedClub: 'Milan',             coachPhotoUrl: '/coaches/prime/ancelotti.webp' },
  mourinho:  { id: 'dragao',      name: 'Estádio do Dragão', photoUrl: '/stadiums/dragao.webp',      homeAttrBonus: 7, prime: true, themedAttrs: ['defending', 'physical'], themedNation: 'Portugal',       coachPhotoUrl: '/coaches/prime/mourinho.webp' },
  zidane:    { id: 'bernabeu',    name: 'Bernabéu',          photoUrl: '/stadiums/bernabeu.webp',    homeAttrBonus: 7, prime: true, themedAttrs: ['dribbling', 'shooting'], themedClub: 'Real Madrid',      coachPhotoUrl: '/coaches/prime/zidane.webp' },
  ferguson:  { id: 'oldtrafford', name: 'Old Trafford',      photoUrl: '/stadiums/oldtrafford.webp', homeAttrBonus: 7, prime: true, themedAttrs: ['pace', 'shooting'],     themedClub: 'Manchester United', coachPhotoUrl: '/coaches/prime/ferguson.webp' },
};

export function stadiumFor(coachId: string, prime: boolean): Stadium {
  return prime ? (PRIME_STADIUMS[coachId] ?? DEFAULT_STADIUM) : DEFAULT_STADIUM;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run client/src/lib/stadium.test.ts`
Expected: PASS.

---

## Task 2: Motor — buff Prime (uniforme +7 + temático +3/+6)

**Files:**
- Modify: `client/src/lib/gameEngine.ts` (interface `Team` ~55; import; constantes ~897; contexto/aplicação em `getEffectiveAttribute` ~814/865; uniforme ~1257; contexto do mandante ~1282)
- Test: `client/src/lib/engine-units.test.ts`

**Interfaces:**
- Consumes: `Stadium`, `stadiumFor` (de `./stadium`).
- Produces: `Team.coachPrime?: boolean`; `PRIME_HOME_ATTR_BONUS = 7`, `PRIME_THEMED_BONUS = 3`, `PRIME_THEMED_CLUB_BONUS = 6`; `getEffectiveAttribute` aceita `context.homeStadium?: Stadium`.

- [ ] **Step 1: Escrever os testes**

Em `client/src/lib/engine-units.test.ts`, adicionar ao import de `./gameEngine` os símbolos `getEffectiveAttribute` (já importado), `PRIME_HOME_ATTR_BONUS`, `PRIME_THEMED_BONUS`, `PRIME_THEMED_CLUB_BONUS`, e importar `stadiumFor` de `./stadium`. Adicionar o `import`:

```ts
import { stadiumFor } from './stadium';
```

E o teste (usa as factories `mkP`/`card` e `COACHES` já existentes no arquivo):

```ts
describe('🏟️ buff temático do estádio Prime (em getEffectiveAttribute)', () => {
  const coach = COACHES.find(c => c.id === 'guardiola')!; // Etihad → passe+visão, City
  const etihad = stadiumFor('guardiola', true);
  const noChem = { passing: 0, pace: 0, special: 0 };
  const eff = (p: any, attr: any, ctx: any) => getEffectiveAttribute(card(p), attr, coach, 'Criação', noChem, 'balanced', ctx);

  it('+6 nos 2 atributos do tema pros jogadores do clube (só em casa)', () => {
    const city = mkP({ club: 'Manchester City', passing: 70, vision: 70 });
    expect(eff(city, 'passing', { homeStadium: etihad }) - eff(city, 'passing', {})).toBe(6);
    expect(eff(city, 'vision', { homeStadium: etihad }) - eff(city, 'vision', {})).toBe(6);
  });
  it('+3 nos 2 atributos do tema pros demais (não é do clube)', () => {
    const other = mkP({ club: 'Barcelona', passing: 70 });
    expect(eff(other, 'passing', { homeStadium: etihad }) - eff(other, 'passing', {})).toBe(3);
  });
  it('zero em atributo fora do tema, e zero sem estádio (visitante)', () => {
    const city = mkP({ club: 'Manchester City', defending: 70, passing: 70 });
    expect(eff(city, 'defending', { homeStadium: etihad }) - eff(city, 'defending', {})).toBe(0);
    expect(eff(city, 'passing', {}) - eff(city, 'passing', {})).toBe(0);
  });
  it('PRIME_HOME_ATTR_BONUS = 7', () => {
    expect(PRIME_HOME_ATTR_BONUS).toBe(7);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run client/src/lib/engine-units.test.ts -t "buff temático do estádio Prime"`
Expected: FALHA (símbolos/`homeStadium` não existem).

- [ ] **Step 3: Import + constantes**

No topo de `client/src/lib/gameEngine.ts`, adicionar o import (perto dos outros imports de `./`):

```ts
import { Stadium, stadiumFor } from './stadium';
```

Logo abaixo de `export const HOME_ATTR_BONUS = 4;` (~linha 897), adicionar:

```ts
// Fase 2 (Técnico Prime): estádio temático. Buff de casa maior + temático em 2 atributos.
export const PRIME_HOME_ATTR_BONUS = 7;   // uniforme em casa (vs +4 do padrão)
export const PRIME_THEMED_BONUS = 3;      // nos 2 atributos do tema, todos os titulares do mandante
export const PRIME_THEMED_CLUB_BONUS = 6; // nos 2 atributos, pros do clube/nação daquele estádio
```

- [ ] **Step 4: `Team.coachPrime`**

Na `interface Team` (~linha 55), adicionar o campo (junto de `coachId`):

```ts
  coachPrime?: boolean; // Fase 2: técnico evoluído pro Prime → estádio temático
```

- [ ] **Step 5: Contexto de `getEffectiveAttribute` + aplicação do buff temático**

No tipo `context?` de `getEffectiveAttribute` (~linha 814-822), adicionar o campo:

```ts
    // 🏟️ Estádio Prime do mandante (só setado pro time da casa) — buff temático nos 2 atributos.
    homeStadium?: Stadium;
```

E, logo após o bloco de `charBoosts` (a linha `if (cb) base += cb.flatAll + ...`, ~linha 865), adicionar:

```ts
  // 🏟️ Estádio Prime do mandante — buff temático nos 2 atributos do tema (só a casa, só Prime).
  const st = context?.homeStadium;
  if (st?.prime && st.themedAttrs && (st.themedAttrs as string[]).includes(attribute as string)) {
    const themedForClubNation =
      (!!st.themedClub && player.club === st.themedClub) ||
      (!!st.themedNation && player.nation === st.themedNation);
    base += themedForClubNation ? PRIME_THEMED_CLUB_BONUS : PRIME_THEMED_BONUS;
  }
```

- [ ] **Step 6: Uniforme +7 (força do mandante)**

Na linha ~1257, trocar:
```ts
      (isFinal ? 0 : HOME_ATTR_BONUS); // +4 em tudo em casa · neutral venue for the final → no host edge
```
por:
```ts
      (isFinal ? 0 : (home.coachPrime ? PRIME_HOME_ATTR_BONUS : HOME_ATTR_BONUS)); // +4 (padrão) / +7 (Prime) em casa · neutro na final
```

- [ ] **Step 7: Injetar `homeStadium` no contexto do mandante**

Nas linhas ~1282-1283, no `matchCtxHome`, adicionar `homeStadium` (o do mandante; o visitante nunca recebe):
```ts
    const matchCtxHome = { isKnockout, isFinal, isLosing: homeIsLosing, captainBoost: homeCaptainBoost, charBoosts: homeCharBoosts, homeStadium: stadiumFor(home.coachId, !!home.coachPrime) };
    const matchCtxAway = { isKnockout, isFinal, isLosing: awayIsLosing, captainBoost: awayCaptainBoost, charBoosts: awayCharBoosts };
```

- [ ] **Step 8: Rodar os testes e ver passar**

Run: `npx vitest run client/src/lib/engine-units.test.ts`
Expected: PASS (novos + os 55 antigos).

- [ ] **Step 9: Regressão de balanço (Fase 1 intacta)**

Run: `npx vitest run client/src/lib/balance.test.ts -t "vantagem de jogar em casa"`
Expected: PASS — sem Prime nada muda (uniforme continua +4, temático ausente).

- [ ] **Step 10: Checkpoint de balanço com Prime (calibragem)**

Rodar o harness num cenário mandante Prime vs padrão pra confirmar que o Prime dá vantagem de casa **maior mas não quebrada**. Criar um teste diagnóstico TEMPORÁRIO `client/src/lib/_diag_prime.test.ts`:
```ts
import { describe, it } from 'vitest';
import { simulateMatch, generateBotTeam } from './gameEngine';
describe('diag prime home edge', () => {
  it('mede casa Prime vs padrão', () => {
    const N = 400; let hp = 0, h0 = 0;
    for (let i = 0; i < N; i++) {
      const A = generateBotTeam('Casa', 0.8); const B = generateBotTeam('Fora', 0.8);
      const rp = simulateMatch({ ...A, coachPrime: true }, B, false, false);
      const r0 = simulateMatch(A, B, false, false);
      if (rp.homeGoals > rp.awayGoals) hp++;
      if (r0.homeGoals > r0.awayGoals) h0++;
    }
    console.log(`casa Prime ${(hp/N*100).toFixed(1)}%  ·  casa padrão ${(h0/N*100).toFixed(1)}%`);
  });
});
```
Run: `npx vitest run client/src/lib/_diag_prime.test.ts`
Expected: Prime com % de vitória em casa **claramente acima** do padrão, sem beirar dominância absoluta (alvo folgado: Prime ~+6 a +15 pontos percentuais acima do padrão). Se estourar muito, ajustar `PRIME_HOME_ATTR_BONUS`/`PRIME_THEMED_*`. **Apagar o arquivo** `_diag_prime.test.ts` ao terminar.

---

## Task 3: Economia + evolução no solo

**Files:**
- Modify: `client/src/lib/shop.ts`
- Test: `client/src/lib/shop.test.ts`
- Modify: `client/src/contexts/GameContext.tsx` (union de actions ~161-210; reducer; nada no `SET_ONLINE_STATE` — `coachPrime` já vem via `me.team`)

**Interfaces:**
- Produces: `PRIME_COST = 500`, `PRIME_WINS_REQUIRED = 4`, `canEvolvePrime(wins: number, points: number): boolean`; action `{ type: 'EVOLVE_COACH_PRIME' }`.

- [ ] **Step 1: Escrever o teste da economia**

Em `client/src/lib/shop.test.ts`, adicionar:
```ts
import { canEvolvePrime, PRIME_COST, PRIME_WINS_REQUIRED } from './shop';

describe('canEvolvePrime', () => {
  it('exige 4 vitórias E 500 pontos', () => {
    expect(PRIME_COST).toBe(500);
    expect(PRIME_WINS_REQUIRED).toBe(4);
    expect(canEvolvePrime(4, 500)).toBe(true);
    expect(canEvolvePrime(10, 800)).toBe(true);
    expect(canEvolvePrime(3, 500)).toBe(false);
    expect(canEvolvePrime(4, 499)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run client/src/lib/shop.test.ts`
Expected: FALHA — símbolos não existem.

- [ ] **Step 3: Implementar em shop.ts**

Em `client/src/lib/shop.ts`, adicionar (perto de `SHOP_COSTS`):
```ts
// ⭐ Técnico Prime (Fase 2): critério + custo pra evoluir o técnico.
export const PRIME_COST = 500;
export const PRIME_WINS_REQUIRED = 4;
export function canEvolvePrime(wins: number, points: number): boolean {
  return wins >= PRIME_WINS_REQUIRED && points >= PRIME_COST;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run client/src/lib/shop.test.ts`
Expected: PASS.

- [ ] **Step 5: Action no reducer solo**

Em `client/src/contexts/GameContext.tsx`:
- No import de `../lib/shop`, adicionar `canEvolvePrime, PRIME_COST`.
- Na union de actions (perto de `| { type: 'SHOP_CHANGE_COACH'; coachId: string }`), adicionar:
  ```ts
  | { type: 'EVOLVE_COACH_PRIME' }
  ```
- No reducer, adicionar o case:
  ```ts
    case 'EVOLVE_COACH_PRIME': {
      if (!state.playerTeam || state.playerTeam.coachPrime) return state;
      const wins = state.leagueStandings.find(s => s.teamId === state.playerTeam!.id)?.won ?? 0;
      if (!canEvolvePrime(wins, state.points)) return state;
      return {
        ...state,
        points: state.points - PRIME_COST,
        playerTeam: { ...state.playerTeam, coachPrime: true },
      };
    }
  ```

- [ ] **Step 6: Checkpoint**

Run: `cd client && npx tsc --noEmit`
Expected: sem erros. (`coachPrime` no online já flui via `playerTeam: me.team` no `SET_ONLINE_STATE` — nada a fazer lá.)

---

## Task 4: Evolução no online (servidor + helper)

**Files:**
- Modify: `server/handlers.ts` (`interface RoomPlayer` ~33; inits ~355 e ~452; novo handler)
- Modify: `client/src/contexts/GameContext.tsx` (helper `evolveCoachPrimeOnline` + tipo do contexto)

**Interfaces:**
- Consumes: `canEvolvePrime`, `PRIME_COST` (de `../client/src/lib/shop`); `room.leagueStandings` (`StandingsEntry.won`).
- Produces: evento socket `evolve_coach_prime`; helper `evolveCoachPrimeOnline(): void`.

- [ ] **Step 1: `RoomPlayer.coachPrime` + inits**

Em `server/handlers.ts`:
- No `import ... from "../client/src/lib/shop"` (o que já traz `SHOP_COSTS`/`MatchPoints`), adicionar `canEvolvePrime, PRIME_COST`.
- Na `interface RoomPlayer` (~linha 33), adicionar `coachPrime: boolean;` (perto de `coachId`).
- Nos **dois** pontos que criam RoomPlayer (onde hoje tem `coachId: 'guardiola', ... points: 0, ... reinforcementRerolls: 0`, ~linhas 344-358 e 438-452), adicionar `coachPrime: false,`.

- [ ] **Step 2: Handler `evolve_coach_prime`**

Perto do handler `shop_change_coach` (~linha 758), adicionar:
```ts
    socket.on("evolve_coach_prime", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || player.coachPrime) return;
      const wins = room.leagueStandings.find(s => s.teamId === player.team!.id)?.won ?? 0;
      if (!canEvolvePrime(wins, player.points)) return;
      player.points -= PRIME_COST;
      player.coachPrime = true;
      player.team.coachPrime = true;
      socket.emit("room_updated", room); // só o time deste jogador mudou
    });
```

- [ ] **Step 3: Helper no cliente**

Em `client/src/contexts/GameContext.tsx`, perto de `shopChangeCoachOnline` (~linha 1469), adicionar:
```ts
  const evolveCoachPrimeOnline = useCallback(() => {
    if (socketRef.current && state.roomCode) socketRef.current.emit("evolve_coach_prime", { roomCode: state.roomCode });
  }, [state.roomCode]);
```
Adicionar `evolveCoachPrimeOnline` ao **tipo** do contexto (junto de `healInjuryOnline: ...`, ~linha 1282: `evolveCoachPrimeOnline: () => void;`) e ao **objeto** `value`/provider que expõe os helpers (onde `shopChangeCoachOnline` é listado).

- [ ] **Step 4: Checkpoint**

Run: `npm run build` (na raiz — compila cliente **e** servidor)
Expected: build OK (typecheck do servidor incluso).

---

## Task 5: `CoachCard` (foto/moldura Prime + `bare`) e `StadiumCard` (texto Prime + `bare`)

**Files:**
- Modify: `client/src/components/game/CoachCard.tsx`
- Modify: `client/src/components/game/StadiumCard.tsx`

**Interfaces:**
- Produces: `CoachCard` aceita `primePhotoUrl?: string` e `bare?: boolean`; `StadiumCard` aceita `bare?: boolean` e renderiza o buff Prime quando `stadium.prime`.

- [ ] **Step 1: `CoachCard` — props + foto Prime + moldura + bare**

Em `client/src/components/game/CoachCard.tsx`, trocar a assinatura/props e o topo do JSX:
```tsx
interface CoachCardProps {
  coach: Coach;
  formation?: Formation;
  isPrime?: boolean;
  primePhotoUrl?: string;
  bare?: boolean;
}

export default function CoachCard({ coach, formation, isPrime = false, primePhotoUrl, bare = false }: CoachCardProps) {
  const photo = isPrime && primePhotoUrl ? primePhotoUrl : coach.photoUrl;
  return (
    <div className={bare ? '' : 'rounded-xl overflow-hidden'} style={bare ? undefined : { background: '#0F0F1A', border: `1px solid ${isPrime ? '#C9A84C55' : '#1A1A2A'}` }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
        <span className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🎓 TÉCNICO</span>
        <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>COMANDO DO TIME</span>
      </div>
      <div className="p-4 flex gap-3.5">
        {photo && (
          <div className="relative w-20 h-20 flex-shrink-0">
            <img src={photo} alt={coach.name} referrerPolicy="no-referrer" className="w-20 h-20 rounded-xl object-cover"
              style={{ border: `2px solid ${isPrime ? '#E8C84A' : '#C9A84C55'}`, objectPosition: 'center top' }} />
            {isPrime && <img src="/coaches/prime/moldura.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
```
(O restante do card — nome/selo PRIME/filosofia/descrição e o bloco `px-4 pb-4` — permanece igual ao atual.)

- [ ] **Step 2: `StadiumCard` — bare + texto Prime**

Em `client/src/components/game/StadiumCard.tsx`:
- Adicionar `bare?: boolean` às props e importar as constantes do tema:
  ```tsx
  import { PRIME_THEMED_BONUS, PRIME_THEMED_CLUB_BONUS } from '../../lib/gameEngine';
  ```
- Adicionar um mapa de rótulos (topo do arquivo, fora do componente):
  ```tsx
  const ATTR_PT: Record<string, string> = { pace: 'Ritmo', shooting: 'Finalização', passing: 'Passe', dribbling: 'Drible', defending: 'Defesa', physical: 'Físico', vision: 'Visão', composure: 'Compostura' };
  ```
- Na assinatura: `export default function StadiumCard({ stadium = DEFAULT_STADIUM, variant = 'full', bare = false }: StadiumCardProps) {`
- No `variant === 'full'`, trocar o container externo pra respeitar `bare`:
  ```tsx
    <div className={bare ? '' : 'rounded-xl overflow-hidden'} style={bare ? undefined : { background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
  ```
- Trocar o bloco de texto do buff (o `<div className="min-w-0 flex-1">` com nome + buff) pra ramificar em Prime:
  ```tsx
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{stadium.name}</div>
          {stadium.prime && stadium.themedAttrs ? (
            <>
              <div className="text-[11px] font-black mt-1 leading-tight" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>
                🏠 Em casa: +{stadium.homeAttrBonus} em TUDO
              </div>
              <div className="text-[10px] font-black leading-snug" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                +{PRIME_THEMED_BONUS}/{PRIME_THEMED_CLUB_BONUS} {stadium.themedAttrs.map(a => ATTR_PT[a]).join(' + ')} · +{PRIME_THEMED_CLUB_BONUS} pros do {stadium.themedClub ?? stadium.themedNation}
              </div>
              <div className="text-[10px] leading-snug mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>Só como mandante · não vale na final.</div>
            </>
          ) : (
            <>
              <div className="text-[11px] font-black mt-1 leading-tight" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                🏠 Em casa: +{stadium.homeAttrBonus} em TODOS os atributos
              </div>
              <div className="text-[10px] leading-snug mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                Só quando você é o mandante · não vale na final (campo neutro).
              </div>
            </>
          )}
        </div>
  ```
  (A foto quadrada e a borda do container Prime podem ganhar realce dourado depois; não é obrigatório pro buff.)

- [ ] **Step 3: Checkpoint**

Run: `cd client && npx tsc --noEmit` e `npm run build` (raiz)
Expected: sem erros; build OK.

---

## Task 6: `CoachStadiumPanel` — card único + botão/modal de evolução

**Files:**
- Create: `client/src/components/game/CoachStadiumPanel.tsx`

**Interfaces:**
- Consumes: `CoachCard`, `StadiumCard`, `Coach`/`Formation` (gameData), `Stadium` (stadium), `PRIME_COST`/`PRIME_WINS_REQUIRED` (shop).
- Produces: `export default function CoachStadiumPanel(props)` com `{ coach, formation?, coachPrime, stadium, wins?, points?, onEvolve? }`.

- [ ] **Step 1: Criar o componente**

Criar `client/src/components/game/CoachStadiumPanel.tsx`:
```tsx
import { useState } from 'react';
import { Coach, Formation } from '../../lib/gameData';
import { Stadium } from '../../lib/stadium';
import { PRIME_COST, PRIME_WINS_REQUIRED } from '../../lib/shop';
import CoachCard from './CoachCard';
import StadiumCard from './StadiumCard';

interface Props {
  coach: Coach;
  formation?: Formation;
  coachPrime: boolean;
  stadium: Stadium;
  wins?: number;
  points?: number;
  onEvolve?: () => void; // presente só no MEU TIME (editável); ausente = só exibição
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: ok ? '#22C55E' : '#EF4444' }}>
      <span>{ok ? '✅' : '❌'}</span><span>{label}</span>
    </div>
  );
}

// Card único "Comando do Time": técnico em cima, estádio embaixo, e (no MEU TIME) o botão de evoluir.
export default function CoachStadiumPanel({ coach, formation, coachPrime, stadium, wins = 0, points = 0, onEvolve }: Props) {
  const [showModal, setShowModal] = useState(false);
  const canEvolve = wins >= PRIME_WINS_REQUIRED && points >= PRIME_COST;
  const showButton = !!onEvolve && !coachPrime;
  const clubNation = stadium.themedClub ?? stadium.themedNation ?? '';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0F0F1A', border: `1px solid ${coachPrime ? '#C9A84C55' : '#1A1A2A'}` }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
        <span className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🎯 COMANDO DO TIME</span>
        {coachPrime && <span className="text-[9px] font-black px-1.5 py-0.5 rounded leading-none" style={{ background: 'linear-gradient(90deg, #C9A84C, #E8C84A)', color: '#0A0A12', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em' }}>PRIME</span>}
      </div>

      <CoachCard coach={coach} formation={formation} isPrime={coachPrime} primePhotoUrl={stadium.coachPhotoUrl} bare />
      <div style={{ height: 1, background: '#1A1A2A' }} />
      <StadiumCard stadium={stadium} bare />

      {showButton && (
        <div className="p-3 border-t" style={{ borderColor: '#1A1A2A' }}>
          <button onClick={() => setShowModal(true)} className="w-full rounded-lg py-2.5 text-[12px] font-black tracking-wide"
            style={{ background: 'linear-gradient(90deg, #7A5C10, #C9A84C)', color: '#0A0A12', fontFamily: 'Rajdhani, sans-serif' }}>
            ⭐ EVOLUIR TÉCNICO → PRIME
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowModal(false)}>
          <div className="rounded-2xl max-w-sm w-full overflow-hidden" style={{ background: '#0F0F1A', border: '1px solid #C9A84C55' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b" style={{ borderColor: '#1A1A2A' }}>
              <div className="text-sm font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A', letterSpacing: '0.04em' }}>⭐ EVOLUIR {coach.name.toUpperCase()} → PRIME</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <div className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>REQUISITOS</div>
                <Req ok={wins >= PRIME_WINS_REQUIRED} label={`Vitórias na campanha: ${wins}/${PRIME_WINS_REQUIRED}`} />
                <Req ok={points >= PRIME_COST} label={`Pontos: ${points}/${PRIME_COST}`} />
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #1A1A2A' }}>
                <div className="text-[10px] font-black tracking-widest mb-1" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>O QUE MUDA</div>
                <ul className="text-[11px] leading-snug space-y-0.5" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>
                  <li>🏟️ Estádio vira <b>{stadium.name}</b> (temático).</li>
                  <li>🏠 Em casa: <b>+7</b> em todos os atributos (vs +4).</li>
                  <li>⚡ Buff nos 2 atributos do tema{clubNation ? <> (+6 pros do <b>{clubNation}</b>)</> : null}.</li>
                  <li>🖼️ Foto + moldura + selo <b>Prime</b> do técnico.</li>
                </ul>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 rounded-lg py-2 text-[11px] font-bold" style={{ background: '#1A1A2A', color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Cancelar</button>
                <button disabled={!canEvolve} onClick={() => { onEvolve?.(); setShowModal(false); }} className="flex-1 rounded-lg py-2 text-[11px] font-black"
                  style={{ background: canEvolve ? 'linear-gradient(90deg, #7A5C10, #C9A84C)' : '#1A1A2A', color: canEvolve ? '#0A0A12' : '#5A5A6A', fontFamily: 'Rajdhani, sans-serif', cursor: canEvolve ? 'pointer' : 'not-allowed', opacity: canEvolve ? 1 : 0.6 }}>
                  Confirmar (−{PRIME_COST} pts)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Checkpoint**

Run: `cd client && npx tsc --noEmit`
Expected: sem erros.

---

## Task 7: Integração nas telas

**Files:**
- Modify: `client/src/components/game/SquadEditor.tsx`
- Modify: `client/src/components/game/LeagueSquadTab.tsx`
- Modify: `client/src/pages/MatchSimPage.tsx`
- Modify: `client/src/pages/ReportPage.tsx`

**Interfaces:**
- Consumes: `CoachStadiumPanel`, `stadiumFor`.

- [ ] **Step 1: `SquadEditor` usa o painel**

Em `client/src/components/game/SquadEditor.tsx`:
- Trocar os imports `CoachCard`/`StadiumCard` (adicionados na Fase 1) por:
  ```tsx
  import CoachStadiumPanel from './CoachStadiumPanel';
  ```
  e adicionar `stadiumFor` ao import de `../../lib/stadium` (criar o import se não houver): `import { stadiumFor } from '../../lib/stadium';`
- Nas props do componente (interface de props da `SquadEditor`), adicionar:
  ```ts
  coachPrime?: boolean;
  points?: number;
  wins?: number;
  onEvolvePrime?: () => void;
  ```
  e recebê-las na desestruturação de props (com defaults onde fizer sentido).
- Trocar o bloco:
  ```tsx
      {showCoachCard && coach && (
        <>
          <CoachCard coach={coach} formation={formation} />
          <StadiumCard />
        </>
      )}
  ```
  por:
  ```tsx
      {showCoachCard && coach && (
        <CoachStadiumPanel
          coach={coach}
          formation={formation}
          coachPrime={!!coachPrime}
          stadium={stadiumFor(coachId, !!coachPrime)}
          wins={wins}
          points={points}
          onEvolve={onEvolvePrime}
        />
      )}
  ```

- [ ] **Step 2: `LeagueSquadTab` faz o wire (solo + online)**

Em `client/src/components/game/LeagueSquadTab.tsx`:
- Adicionar `evolveCoachPrimeOnline` à desestruturação de `useGame()`.
- Antes do `return`, calcular as vitórias:
  ```tsx
  const wins = state.leagueStandings.find(s => s.teamId === team.id)?.won ?? 0;
  ```
- Passar as novas props ao `<SquadEditor>`:
  ```tsx
      coachPrime={team.coachPrime}
      points={state.points}
      wins={wins}
      onEvolvePrime={() => online ? evolveCoachPrimeOnline() : dispatch({ type: 'EVOLVE_COACH_PRIME' })}
  ```

- [ ] **Step 3: `MatchSimPage` venue temático**

Em `client/src/pages/MatchSimPage.tsx`:
- Adicionar `import { stadiumFor } from '../lib/stadium';`.
- Trocar `<StadiumCard variant="venue" />` por:
  ```tsx
              <StadiumCard variant="venue" stadium={stadiumFor(homeTeam.coachId, !!homeTeam.coachPrime)} />
  ```

- [ ] **Step 4: `ReportPage` usa o painel (sem botão)**

Em `client/src/pages/ReportPage.tsx`:
- Trocar os imports `CoachCard`/`StadiumCard` (Fase 1) por `import CoachStadiumPanel from '../components/game/CoachStadiumPanel';` e adicionar `import { stadiumFor } from '../lib/stadium';`.
- Trocar o bloco "Técnico + Estádio" (o `motion.div` com `<CoachCard .../> <StadiumCard />`) por:
  ```tsx
        {phase >= 3 && playerTeam && coach && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <CoachStadiumPanel
              coach={coach}
              formation={formation}
              coachPrime={!!playerTeam.coachPrime}
              stadium={stadiumFor(playerTeam.coachId, !!playerTeam.coachPrime)}
            />
          </motion.div>
        )}
  ```

- [ ] **Step 5: Checkpoint final**

Run: `cd client && npx tsc --noEmit` e depois `npm run build` (raiz)
Expected: sem erros; build OK.

- [ ] **Step 6: Suite de testes do motor**

Run: `npx vitest run client/src/lib/stadium.test.ts client/src/lib/engine-units.test.ts client/src/lib/shop.test.ts`
Expected: tudo verde.

---

## Verificação final (end-to-end)

- **Testes:** `npx vitest run client/src/lib/stadium.test.ts client/src/lib/engine-units.test.ts client/src/lib/shop.test.ts` verdes; `balance.test.ts -t "vantagem de jogar em casa"` verde (Fase 1 intacta).
- **Typecheck/build:** `cd client && npx tsc --noEmit`; raiz `npm run build`.
- **Manual (solo):** card único "Comando do Time" no MEU TIME; botão "Evoluir" sempre visível; clicar abre o modal com requisitos ✅/❌ e o Confirmar apagado até 4 vitórias + 500 pts; ao evoluir → foto/moldura/selo Prime, estádio temático no card e no venue da partida, vantagem de casa maior. Fim de campanha mostra o mesmo painel (sem botão).
- **Manual (online, 2 abas):** evoluir num cliente desconta 500 pts só dele, liga o Prime, e o estádio/foto temáticos aparecem; o adversário não é afetado.

## Self-Review (feito ao escrever o plano)

- **Cobertura da spec:** modelo `PRIME_STADIUMS`/`stadiumFor` (T1) ✓ · motor uniforme+temático (T2) ✓ · economia + evolução solo (T3) ✓ · online (T4) ✓ · visuais CoachCard/StadiumCard (T5) ✓ · painel único + modal gated (T6) ✓ · integração 3 telas + venue (T7) ✓. Bots não evoluem (constraint) — sem mudança em `generateBotTeam` ✓.
- **Placeholders:** nenhum — todo passo tem caminho e código real.
- **Consistência de tipos:** `Team.coachPrime`, `Stadium.themedAttrs/themedClub/themedNation/coachPhotoUrl`, `stadiumFor(coachId, prime)`, `canEvolvePrime(wins, points)`, `context.homeStadium`, `PRIME_HOME_ATTR_BONUS`/`PRIME_THEMED_BONUS`/`PRIME_THEMED_CLUB_BONUS`/`PRIME_COST`/`PRIME_WINS_REQUIRED` usados igual em todas as tasks.
