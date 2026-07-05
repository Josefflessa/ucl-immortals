# Cartas Evoluídas — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cartas que jogam 6 partidas como titular evoluem — ganham fundo novo (`bg-{raridade}-emforma.png`), selo "EVOLUÍDA" e 8 pontos livres que o jogador distribui/reseta pelos atributos no modal.

**Architecture:** Estado por carta (`appearances`, `evolvePoints`) no `Player`. O motor deriva `isEvolved` e soma os `evolvePoints` nos atributos (igual ao Treino). `appearances` sobe +1 nos 11 titulares após cada partida do jogador (solo reducer + servidor). O `PlayerCard` troca o fundo e o modal do jogador (`SquadEditor`) traz o alocador dos 8 pontos.

**Tech Stack:** React + TypeScript (Vite), TailwindCSS, Socket.io (online), Vitest (node, engine puro).

## Global Constraints

- **NÃO COMMITAR.** O usuário commita. Cada task termina num **Checkpoint** (typecheck/build/test).
- **Build da raiz:** `npm run build`. Typecheck: `cd client && npx tsc --noEmit`. Testes: `npx vitest run <arquivo>` da raiz.
- **pt-br** em todo texto ao jogador. Nome: **"Evoluída"** (distinto de "Em Alta"/`inForm`).
- **Gatilho:** 6 jogos como **titular** (índices 0-10 do time). Banco e bots **não** contam/evoluem.
- **8 pontos livres, sem teto** (cada = +1); distribuível e resetável; soma ≤ 8.
- Solo + online. Nada persiste entre campanhas.

---

## File Structure

- `client/src/lib/gameData.ts` **(modificar)** — `Player.appearances?`, `Player.evolvePoints?`.
- `client/src/lib/gameEngine.ts` **(modificar)** — constantes/helpers + efeito dos pontos no motor.
- `client/src/lib/engine-units.test.ts` **(modificar)** — testes dos helpers + efeito.
- `client/src/contexts/GameContext.tsx` **(modificar)** — contagem de jogos + actions solo + helper online.
- `server/handlers.ts` **(modificar)** — contagem de jogos + handlers online.
- `client/src/components/game/PlayerCard.tsx` **(modificar)** — fundo `-emforma` + selo.
- `client/src/components/game/SquadEditor.tsx` **(modificar)** — seção do alocador no modal.
- `client/src/components/game/LeagueSquadTab.tsx` **(modificar)** — wire dos callbacks (solo/online).

---

## Task 1: Modelo + motor (helpers + efeito dos pontos)

**Files:**
- Modify: `client/src/lib/gameData.ts` (interface `Player`)
- Modify: `client/src/lib/gameEngine.ts` (constantes/helpers ~perto de outras consts; `getEffectiveAttribute` ~865; `getPlayerEffectiveStats` ~558/569)
- Test: `client/src/lib/engine-units.test.ts`

**Interfaces:**
- Produces: `EVOLVE_GAMES=6`, `EVOLVE_POINTS=8`; `isEvolved(p)`, `evolvePointsSpent(ep)`, `applyEvolvePoint(ep, attr, delta)`, `bumpStarterAppearances(team)`. `AttrKey` já existe (import de `./traits`).

- [ ] **Step 1: Campos no modelo**

Em `client/src/lib/gameData.ts`, dentro de `interface Player`, logo após o bloco `trainBoosts?: {...}`:
```ts
  // ⭐ Carta Evoluída (jogou EVOLVE_GAMES como titular): pontos livres distribuídos + progresso.
  appearances?: number;
  evolvePoints?: {
    pace?: number; shooting?: number; passing?: number; dribbling?: number;
    defending?: number; physical?: number; vision?: number; composure?: number;
  };
```

- [ ] **Step 2: Escrever os testes**

Em `client/src/lib/engine-units.test.ts`, adicionar ao import de `./gameEngine` os símbolos `isEvolved, evolvePointsSpent, applyEvolvePoint, bumpStarterAppearances, EVOLVE_GAMES, EVOLVE_POINTS` (`getEffectiveAttribute` já está importado). E o bloco:
```ts
describe('⭐ cartas evoluídas', () => {
  it('isEvolved: 6 jogos evolui, 5 não', () => {
    expect(EVOLVE_GAMES).toBe(6);
    expect(EVOLVE_POINTS).toBe(8);
    expect(isEvolved({ appearances: 5 })).toBe(false);
    expect(isEvolved({ appearances: 6 })).toBe(true);
    expect(isEvolved({})).toBe(false);
  });
  it('applyEvolvePoint respeita piso 0 e teto 8', () => {
    expect(applyEvolvePoint({}, 'shooting', 1)).toEqual({ shooting: 1 });
    expect(applyEvolvePoint({ shooting: 0 }, 'shooting', -1)).toEqual({ shooting: 0 });
    const full = { shooting: 8 };
    expect(evolvePointsSpent(full)).toBe(8);
    expect(applyEvolvePoint(full, 'pace', 1)).toEqual(full);
  });
  it('evolvePoints somam no getEffectiveAttribute', () => {
    const coach = COACHES[0];
    const noChem = { passing: 0, pace: 0, special: 0 };
    const evo = getEffectiveAttribute(card(mkP({ shooting: 70, evolvePoints: { shooting: 3 } })), 'shooting', coach, 'Finalização', noChem, 'balanced', {});
    const base = getEffectiveAttribute(card(mkP({ shooting: 70 })), 'shooting', coach, 'Finalização', noChem, 'balanced', {});
    expect(evo - base).toBe(3);
  });
  it('bumpStarterAppearances: +1 só nos 11 titulares', () => {
    const team = mkTeam('T', Array.from({ length: 13 }, () => mkP()));
    const bumped = bumpStarterAppearances(team);
    expect(bumped.players.slice(0, 11).every(p => p.appearances === 1)).toBe(true);
    expect(bumped.players[11].appearances ?? 0).toBe(0);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run client/src/lib/engine-units.test.ts -t "cartas evoluídas"`
Expected: FALHA (símbolos não existem).

- [ ] **Step 4: Helpers no gameEngine**

Em `client/src/lib/gameEngine.ts`, adicionar (perto de outras constantes exportadas, ex.: após `HOME_ATTR_BONUS`):
```ts
// ⭐ Cartas Evoluídas: 6 jogos como titular → libera 8 pontos livres (sem teto por atributo).
export const EVOLVE_GAMES = 6;
export const EVOLVE_POINTS = 8;
export function isEvolved(p: { appearances?: number }): boolean {
  return (p.appearances ?? 0) >= EVOLVE_GAMES;
}
export function evolvePointsSpent(ep?: Partial<Record<AttrKey, number>>): number {
  return ep ? (Object.values(ep) as number[]).reduce((s, v) => s + (v ?? 0), 0) : 0;
}
export function applyEvolvePoint(ep: Partial<Record<AttrKey, number>>, attr: AttrKey, delta: number): Partial<Record<AttrKey, number>> {
  const next = (ep[attr] ?? 0) + delta;
  if (next < 0) return ep;                                   // não abaixo de 0
  if (evolvePointsSpent(ep) + delta > EVOLVE_POINTS) return ep; // não passa de 8
  return { ...ep, [attr]: next };
}
export function bumpStarterAppearances(team: Team): Team {
  return { ...team, players: team.players.map((p, i) => i < 11 ? { ...p, appearances: (p.appearances ?? 0) + 1 } : p) };
}
```

- [ ] **Step 5: Efeito no motor (simulação)**

Em `getEffectiveAttribute`, logo após a linha do Treino (~865, `base += (player.trainBoosts?.[...] ?? 0);`), adicionar:
```ts
  // ⭐ Carta Evoluída: pontos livres distribuídos (mesma natureza do Treino, sem teto).
  base += (player.evolvePoints?.[attribute as keyof NonNullable<Player['evolvePoints']>] ?? 0);
```

- [ ] **Step 6: Efeito no display (getPlayerEffectiveStats)**

Em `getPlayerEffectiveStats`, após a linha `const trainBonus = ...` (~558), adicionar:
```ts
  const evolveBonus = (attr: AttrKey): number => player.evolvePoints?.[attr] ?? 0;
```
E incluir `evolveBonus(attr)` na soma `extra` (~569):
```ts
  const extra = (attr: AttrKey) => traitBonus(attr) + styleBonus(attr) + globalChem(attr) + captainBonus(attr) + trainBonus(attr) + evolveBonus(attr) + charBonus(attr) + pipoqBonus(attr);
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run client/src/lib/engine-units.test.ts`
Expected: PASS (novos + os antigos).

---

## Task 2: Contagem de jogos (+1 nos titulares após cada partida)

**Files:**
- Modify: `client/src/contexts/GameContext.tsx` (retorno do caso que resolve a partida de LIGA do jogador ~925; e o caso do MATA-MATA ~onde `applyMatchDiscipline` do knockout roda ~1000)
- Modify: `server/handlers.ts` (handler que simula a rodada do jogador)

**Interfaces:**
- Consumes: `bumpStarterAppearances(team)` (Task 1).

- [ ] **Step 1: Import no GameContext**

Garantir que `bumpStarterAppearances` está no import de `../lib/gameEngine` no `GameContext.tsx`.

- [ ] **Step 2: Solo — liga**

No caso que resolve a partida de liga do jogador (o que usa `action.result` e retorna com `leagueFixtures/leagueStandings/...`, ~linha 925), adicionar ao objeto de retorno:
```ts
        playerTeam: bumpStarterAppearances(state.playerTeam),
```
(O `playerTeam` não era tocado nesse retorno; agora os 11 titulares ganham +1 jogo.)

- [ ] **Step 3: Solo — mata-mata**

No caso do mata-mata que aplica a disciplina do jogador (o `applyMatchDiscipline` ~linha 1000), no retorno correspondente, envolver o `playerTeam` do jogador com `bumpStarterAppearances(...)` **apenas quando o time do jogador jogou aquela perna** (o caso já sabe disso pelo fluxo do knockout do jogador). Se o retorno não seta `playerTeam`, adicionar `playerTeam: bumpStarterAppearances(state.playerTeam),`.

- [ ] **Step 4: Servidor**

Em `server/handlers.ts`, no handler que simula a rodada de cada jogador (procurar `simulateMatch` no arquivo), após obter o resultado da partida daquele `player`, atualizar o time do jogador:
```ts
player.team = bumpStarterAppearances(player.team);
```
Garantir `bumpStarterAppearances` no import de `../client/src/lib/gameEngine.js`. (Só pro time do jogador humano; bots não.)

- [ ] **Step 5: Checkpoint**

Run: `cd client && npx tsc --noEmit` e depois `npm run build` (raiz)
Expected: sem erros; build OK.

---

## Task 3: `PlayerCard` — fundo Evoluída + selo

**Files:**
- Modify: `client/src/components/game/PlayerCard.tsx` (`cardTexture` ~590; usos ~782 e ~874; selo no render)

**Interfaces:**
- Consumes: `isEvolved` (de `../../lib/gameEngine`).

- [ ] **Step 1: `cardTexture` aceita `evolved`**

Trocar `cardTexture` (~590):
```ts
export function cardTexture(rarity: string, evolved = false): string {
  const base = RARITY_FILE[rarity] ?? RARITY_FILE.bronze;
  return evolved ? `/cards/${base}-emforma.png` : `/cards/${base}.webp`;
}
```

- [ ] **Step 2: Importar `isEvolved` e derivar no componente**

Adicionar `import { isEvolved } from '../../lib/gameEngine';` (ou juntar a um import existente de gameEngine). No corpo de `PlayerCard` (perto de `const theme = getCardTheme(player.rarity);`, ~744):
```ts
  const evolved = isEvolved(player);
```

- [ ] **Step 3: Usar a textura Evoluída (compact e full)**

Nos dois pontos que montam o `background` (`~782` e `~874`), trocar `cardTexture(player.rarity)` por `cardTexture(player.rarity, evolved)`:
```ts
            `url(${uniq ? uniq.texture : cardTexture(player.rarity, evolved)}) center/cover no-repeat,` +
```
(Uniques mantêm `uniq.texture` — não trocam fundo.)

- [ ] **Step 4: Selo "EVOLUÍDA"**

No card **full** (dentro do container principal do render, junto dos outros selos/badges), adicionar quando `evolved && !lite`:
```tsx
        {evolved && !lite && (
          <div className="absolute z-20" style={{ top: 6, left: 6, padding: '2px 6px', borderRadius: 6, background: 'linear-gradient(90deg,#0a7a2f,#22C55E)', border: '1px solid #86efac', fontSize: 8, fontWeight: 900, letterSpacing: '0.08em', color: '#04120a', fontFamily: 'Rajdhani, sans-serif' }}>
            EVOLUÍDA
          </div>
        )}
```
(Posicionar num canto livre — ajustar `top/left` se colidir com o selo de raridade; usar o canto oposto.)

- [ ] **Step 5: Checkpoint**

Run: `cd client && npx tsc --noEmit` e `npm run build` (raiz)
Expected: sem erros; build OK. Manual: uma carta com `appearances >= 6` mostra o fundo `-emforma` + selo.

---

## Task 4: Ações solo (distribuir / resetar pontos)

**Files:**
- Modify: `client/src/contexts/GameContext.tsx` (union de actions; reducer)

**Interfaces:**
- Consumes: `applyEvolvePoint`, `isEvolved` (Task 1).
- Produces: actions `SET_EVOLVE_POINT { playerId, attr, delta }`, `RESET_EVOLVE_POINTS { playerId }`.

- [ ] **Step 1: Import + union**

Garantir `applyEvolvePoint, isEvolved` no import de `../lib/gameEngine`. Importar `AttrKey`:
`import type { AttrKey } from '../lib/traits';`
Na union de actions, adicionar:
```ts
  | { type: 'SET_EVOLVE_POINT'; playerId: string; attr: AttrKey; delta: number }
  | { type: 'RESET_EVOLVE_POINTS'; playerId: string }
```

- [ ] **Step 2: Reducer**

Adicionar os casos (perto dos outros que mexem no `playerTeam.players`):
```ts
    case 'SET_EVOLVE_POINT': {
      if (!state.playerTeam) return state;
      const players = state.playerTeam.players.map(p => {
        if (p.id !== action.playerId || !isEvolved(p)) return p;
        return { ...p, evolvePoints: applyEvolvePoint(p.evolvePoints ?? {}, action.attr, action.delta) };
      });
      return { ...state, playerTeam: { ...state.playerTeam, players } };
    }
    case 'RESET_EVOLVE_POINTS': {
      if (!state.playerTeam) return state;
      const players = state.playerTeam.players.map(p => p.id === action.playerId ? { ...p, evolvePoints: {} } : p);
      return { ...state, playerTeam: { ...state.playerTeam, players } };
    }
```

- [ ] **Step 3: Checkpoint**

Run: `cd client && npx tsc --noEmit`
Expected: sem erros.

---

## Task 5: Online (servidor + helpers do cliente)

**Files:**
- Modify: `server/handlers.ts` (handlers `set_evolve_point` / `reset_evolve_points`)
- Modify: `client/src/contexts/GameContext.tsx` (helpers `setEvolvePointOnline` / `resetEvolvePointsOnline` + tipo do contexto + provider)

**Interfaces:**
- Consumes: `applyEvolvePoint`, `isEvolved` (de `../client/src/lib/gameEngine.js`).

- [ ] **Step 1: Handlers no servidor**

Em `server/handlers.ts`, garantir `applyEvolvePoint, isEvolved` no import de shop/engine (`../client/src/lib/gameEngine.js`). Perto dos outros handlers de time (ex.: `set_martir_targets`), adicionar:
```ts
    socket.on("set_evolve_point", ({ roomCode, playerId, attr, delta }: { roomCode: string; playerId: string; attr: any; delta: number }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      player.team.players = player.team.players.map(p =>
        (p.id === playerId && isEvolved(p)) ? { ...p, evolvePoints: applyEvolvePoint(p.evolvePoints ?? {}, attr, delta) } : p);
      socket.emit("room_updated", room);
    });
    socket.on("reset_evolve_points", ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      player.team.players = player.team.players.map(p => p.id === playerId ? { ...p, evolvePoints: {} } : p);
      socket.emit("room_updated", room);
    });
```

- [ ] **Step 2: Helpers no cliente**

Em `client/src/contexts/GameContext.tsx`, perto de `martirTargetsOnline`, adicionar:
```ts
  const setEvolvePointOnline = useCallback((playerId: string, attr: AttrKey, delta: number) => {
    if (socketRef.current && state.roomCode) socketRef.current.emit("set_evolve_point", { roomCode: state.roomCode, playerId, attr, delta });
  }, [state.roomCode]);
  const resetEvolvePointsOnline = useCallback((playerId: string) => {
    if (socketRef.current && state.roomCode) socketRef.current.emit("reset_evolve_points", { roomCode: state.roomCode, playerId });
  }, [state.roomCode]);
```
Adicionar ao **tipo** do contexto (junto de `martirTargetsOnline: ...`): `setEvolvePointOnline: (playerId: string, attr: AttrKey, delta: number) => void; resetEvolvePointsOnline: (playerId: string) => void;` e ao objeto `value` do provider (junto de `martirTargetsOnline`).

- [ ] **Step 3: Checkpoint**

Run: `npm run build` (raiz — cliente + servidor)
Expected: build OK.

---

## Task 6: Modal do jogador (alocador) + wire

**Files:**
- Modify: `client/src/components/game/SquadEditor.tsx` (props + seção no painel do jogador selecionado)
- Modify: `client/src/components/game/LeagueSquadTab.tsx` (wire solo/online)

**Interfaces:**
- Consumes: `isEvolved`, `evolvePointsSpent`, `EVOLVE_GAMES`, `EVOLVE_POINTS` (gameEngine); `AttrKey` (traits).

- [ ] **Step 1: Props na SquadEditor**

Em `SquadEditorProps`, adicionar:
```ts
  onSetEvolvePoint?: (playerId: string, attr: AttrKey, delta: number) => void;
  onResetEvolvePoints?: (playerId: string) => void;
```
e recebê-las na desestruturação. Importar `import { isEvolved, evolvePointsSpent, EVOLVE_GAMES, EVOLVE_POINTS } from '../../lib/gameEngine';` e `import type { AttrKey } from '../../lib/traits';`. Definir a lista de atributos (rótulos pt) local:
```tsx
const EVOLVE_ATTRS: { key: AttrKey; label: string }[] = [
  { key: 'pace', label: 'RITMO' }, { key: 'shooting', label: 'FINALIZAÇÃO' }, { key: 'passing', label: 'PASSE' }, { key: 'dribbling', label: 'DRIBLE' },
  { key: 'defending', label: 'DEFESA' }, { key: 'physical', label: 'FÍSICO' }, { key: 'vision', label: 'VISÃO' }, { key: 'composure', label: 'COMPOSTURA' },
];
```

- [ ] **Step 2: Seção no painel do jogador selecionado**

No painel do `selectedPlayer` (onde já se mostram stats/efeitos do jogador), adicionar a seção (só quando há `onSetEvolvePoint`, i.e., no MEU TIME):
```tsx
{selectedPlayer && onSetEvolvePoint && (() => {
  const evolved = isEvolved(selectedPlayer);
  const ep = selectedPlayer.evolvePoints ?? {};
  const spent = evolvePointsSpent(ep);
  const left = EVOLVE_POINTS - spent;
  const apps = selectedPlayer.appearances ?? 0;
  return (
    <div className="rounded-xl overflow-hidden mt-3" style={{ background: '#0F0F1A', border: `1px solid ${evolved ? '#22C55E55' : '#1A1A2A'}` }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
        <span className="text-[10px] font-black tracking-widest" style={{ color: evolved ? '#22C55E' : '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>⭐ CARTA EVOLUÍDA</span>
        {evolved && <span className="text-[10px] font-black" style={{ color: left > 0 ? '#E8C84A' : '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Pontos: {left}/{EVOLVE_POINTS}</span>}
      </div>
      {evolved ? (
        <div className="p-3">
          <div className="text-[10px] mb-2 leading-snug" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
            Distribua {EVOLVE_POINTS} pontos livres entre os atributos — pode <b style={{ color: '#C9C9D5' }}>resetar</b> e redistribuir quando quiser.
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {EVOLVE_ATTRS.map(a => {
              const v = ep[a.key] ?? 0;
              return (
                <div key={a.key} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: '#0A0A12', border: '1px solid #1A1A2A' }}>
                  <span className="text-[10px] font-bold" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{a.label}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onSetEvolvePoint(selectedPlayer.id, a.key, -1)} disabled={v <= 0} className="w-5 h-5 rounded flex items-center justify-center text-xs font-black" style={{ background: v > 0 ? '#1A1A2A' : '#12121C', color: v > 0 ? '#EF4444' : '#3A3A4A', cursor: v > 0 ? 'pointer' : 'default' }}>−</button>
                    <span className="text-[11px] font-black w-4 text-center" style={{ color: v > 0 ? '#22C55E' : '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{v}</span>
                    <button onClick={() => onSetEvolvePoint(selectedPlayer.id, a.key, 1)} disabled={left <= 0} className="w-5 h-5 rounded flex items-center justify-center text-xs font-black" style={{ background: left > 0 ? '#1A1A2A' : '#12121C', color: left > 0 ? '#22C55E' : '#3A3A4A', cursor: left > 0 ? 'pointer' : 'default' }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          {onResetEvolvePoints && spent > 0 && (
            <button onClick={() => onResetEvolvePoints(selectedPlayer.id)} className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-black" style={{ background: '#1A1A2A', color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>↺ RESETAR PONTOS</button>
          )}
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-center justify-between text-[11px] font-bold mb-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            <span style={{ color: '#8A8A9A' }}>Jogos pra evoluir</span>
            <span style={{ color: '#C9C9D5' }}>{Math.min(apps, EVOLVE_GAMES)}/{EVOLVE_GAMES}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1A1A2A' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, apps / EVOLVE_GAMES * 100)}%`, background: 'linear-gradient(90deg,#0a7a2f,#22C55E)' }} />
          </div>
          <div className="text-[10px] mt-1.5 leading-snug" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
            Use esta carta como titular por {EVOLVE_GAMES} jogos pra evoluir (fundo novo + 8 pontos livres).
          </div>
        </div>
      )}
    </div>
  );
})()}
```
(Inserir dentro do bloco do `selectedPlayer`, abaixo do resumo de stats/efeitos — mesmo container onde hoje aparecem os buffs do jogador.)

- [ ] **Step 3: Wire no LeagueSquadTab**

Em `client/src/components/game/LeagueSquadTab.tsx`, adicionar `setEvolvePointOnline, resetEvolvePointsOnline` à desestruturação de `useGame()`, e passar ao `<SquadEditor>`:
```tsx
      onSetEvolvePoint={(playerId, attr, delta) => online ? setEvolvePointOnline(playerId, attr, delta) : dispatch({ type: 'SET_EVOLVE_POINT', playerId, attr, delta })}
      onResetEvolvePoints={(playerId) => online ? resetEvolvePointsOnline(playerId) : dispatch({ type: 'RESET_EVOLVE_POINTS', playerId })}
```

- [ ] **Step 4: Checkpoint final**

Run: `cd client && npx tsc --noEmit` e `npm run build` (raiz)
Expected: sem erros; build OK.

- [ ] **Step 5: Testes do motor**

Run: `npx vitest run client/src/lib/engine-units.test.ts client/src/lib/stadium.test.ts client/src/lib/shop.test.ts`
Expected: tudo verde.

---

## Verificação final

- **Testes:** `npx vitest run client/src/lib/engine-units.test.ts` verde (helpers + efeito dos pontos).
- **Typecheck/build:** `cd client && npx tsc --noEmit`; raiz `npm run build`.
- **Manual (solo):** usar uma carta como titular por 6 jogos → fundo `-emforma` + selo "EVOLUÍDA"; no modal, a seção mostra o alocador (distribuir/reset) e os atributos/overall sobem; carta com <6 jogos mostra a barra de progresso "Jogos: n/6". **Online (2 abas):** distribuir/resetar sincroniza só no autor; o adversário não muda.

## Self-Review (feito ao escrever o plano)

- **Cobertura da spec:** modelo (T1) ✓ · gatilho/contagem 6 jogos titular (T2) ✓ · fundo+selo (T3) ✓ · 8 pontos livres distribuir/reset solo (T4) ✓ · online (T5) ✓ · modal claro/organizado + progresso (T6) ✓. Bots não evoluem (só `playerTeam`/titulares) ✓.
- **Placeholders:** nenhum — código real em cada passo. (Os pontos de integração de contagem no solo/servidor têm a localização e o helper exatos.)
- **Consistência de tipos:** `appearances`/`evolvePoints`, `isEvolved`, `applyEvolvePoint(ep, attr, delta)`, `bumpStarterAppearances(team)`, `EVOLVE_GAMES`/`EVOLVE_POINTS`, actions `SET_EVOLVE_POINT`/`RESET_EVOLVE_POINTS` e helpers online usados igual em todas as tasks.
