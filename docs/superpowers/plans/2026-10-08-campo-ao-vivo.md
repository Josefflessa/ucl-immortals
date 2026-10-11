# Campo ao vivo — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um campo 2D animado no topo da tela da partida que encena, em sincronia com a narração, tudo o que o motor simulou — jogo corrido, lances perigosos, bolas paradas, cartões e a disputa de pênaltis — sem mudar resultados nem a duração da partida.

**Architecture:** O motor passa a registrar cada lance (`MatchEvent.play`) sem nenhum sorteio novo. Um "diretor" em TypeScript puro (`shared/game/pitch/`) transforma eventos em linhas do tempo (posição da bola e dos 22 a cada instante), com semente derivada do evento. No cliente, `PitchDirector` controla qual linha do tempo está tocando e o relógio (pausa, etapas), e `LivePitch` só desenha, movendo elementos por `transform` num único `requestAnimationFrame`.

**Tech Stack:** TypeScript, React 19, Vite, Tailwind 4, Vitest 2 (ambiente node), lucide-react.

Spec: `docs/superpowers/specs/2026-10-08-campo-ao-vivo-design.md`.

## Global Constraints

- A partida dura o mesmo que hoje: `TICK_MS = 222` por minuto, lance perigoso em 3 etapas de 1.500 ms, disputa de pênaltis com 1.900 ms de preparação + 1.700 ms até a próxima cobrança, comemoração de gol (`GOAL_CELEBRATION_MS`) inalterada.
- Nenhuma chamada nova a `random()` dentro de `shared/game/engine/`. A sequência de sorteios do motor não pode mudar.
- Cores: lado esquerdo do campo (sempre o time de quem assiste) `#ffd700`; lado direito `#6366f1`. Ameaça do seu time `#22C55E`, ameaça do adversário `#EF4444`.
- O time de quem assiste sempre ataca para a direita da tela (x crescente). Espectador sem time: o mandante fica à esquerda.
- Coordenadas do diretor em metros: campo 105 × 68, origem no canto superior esquerdo.
- Animação só por `transform` e `opacity`. Nada de layout por quadro.
- Textos da interface em pt-BR, sem emoji na interface nova (ícones do `lucide-react` ou rótulos em texto).
- Não fazer `git commit` nem `git push` durante a execução: o usuário commita depois de testar. Cada tarefa termina num **checkpoint** com os testes da tarefa passando.
- Rodar só os arquivos de teste citados (`pnpm exec vitest run <arquivos>`), nunca a suíte inteira.
- Rodar comandos a partir da raiz do repositório (`C:\Users\josel\Downloads\ucl-immortals`).

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `shared/game/engine/teamModel.ts` (modificar) | Tipos `PlayKind`, `PlayShot`, `MatchPlay`; `MatchEvent.play`; `PenaltyKick.takerId/gkId` |
| `shared/game/engine/matchSim.ts` (modificar) | Preenche `play` em cada `goal`/`save`/`miss`/`duel` |
| `shared/game/engine/strength.ts` (modificar) | Ids do batedor e do goleiro em cada cobrança da disputa |
| `shared/game/engine/engine-golden.test.ts` (criar) | Referência fixa: o motor não muda |
| `shared/game/engine/match-play.test.ts` (criar) | `play` presente e coerente |
| `shared/game/dangerNarration.ts` (criar) | Narração das 3 etapas a partir do evento, com semente |
| `shared/game/dangerNarration.test.ts` (criar) | Determinismo e nomes corretos |
| `shared/game/pitch/geometry.ts` (criar) | Medidas do campo, slots, formações → posições |
| `shared/game/pitch/timeline.ts` (criar) | Quadros-chave, amostragem sem alocação, espelhamento |
| `shared/game/pitch/flow.ts` (criar) | Jogo corrido, saída de bola, reagrupamento |
| `shared/game/pitch/plays.ts` (criar) | Roteiros dos lances perigosos |
| `shared/game/pitch/cues.ts` (criar) | Marcadores rápidos (falta, cartão, lesão, tática…) |
| `shared/game/pitch/shootout.ts` (criar) | Cobranças da disputa de pênaltis |
| `shared/game/pitch/index.ts` (criar) | Reexportações |
| `shared/game/pitch/*.test.ts` (criar) | Testes do diretor |
| `client/src/components/game/pitch/PitchDirector.ts` (criar) | Relógio, segmentos, pausa, estado para o React |
| `client/src/components/game/pitch/PitchDirector.test.ts` (criar) | Testes com relógio falso |
| `client/src/components/game/pitch/sides.ts` (criar) | `Team` → `PitchSides` |
| `client/src/components/game/pitch/LivePitch.tsx` (criar) | Desenho do campo, jogadores, rostos, marcadores, câmera |
| `client/src/components/game/pitch/livePitch.css` (criar) | Estilos do campo |
| `client/src/components/game/pitch/PitchErrorBoundary.tsx` (criar) | Falha do campo nunca derruba a partida |
| `client/src/components/game/match/NarrationStrip.tsx` (criar) | Faixa de narração abaixo do campo |
| `client/src/components/game/match/ShootoutPanel.tsx` (criar) | Placar e narração da disputa (antes um modal) |
| `client/src/pages/dev/PitchGalleryPage.tsx` (criar) | Galeria de lances, só em desenvolvimento |
| `client/src/main.tsx` (modificar) | Abre a galeria em `#lances` no modo dev |
| `client/src/pages/MatchSimPage.tsx` (modificar) | Integra narração, diretor, campo, pênaltis |

---

### Task 1: O motor registra o lance

**Files:**
- Create: `shared/game/engine/engine-golden.test.ts`
- Create: `shared/game/engine/match-play.test.ts`
- Modify: `shared/game/engine/teamModel.ts` (antes de `export interface MatchEvent`, linha 247; `PenaltyKick`, linha 314)
- Modify: `shared/game/engine/matchSim.ts` (linhas 10, 80, 760-846, 895-930, 972-1048, 1087-1182)
- Modify: `shared/game/engine/strength.ts` (linhas 262, 269, 282, 283)

**Interfaces:**
- Produces: `PlayKind`, `PlayShot`, `MatchPlay` exportados de `shared/game/engine/teamModel.ts`; `MatchEvent.play?: MatchPlay`; `PenaltyKick.takerId?: string`, `PenaltyKick.gkId?: string`.

- [ ] **Step 1: Gravar a referência do motor ANTES de qualquer mudança**

Criar `shared/game/engine/engine-golden.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seededRandom } from '../random';
import { generateBotTeam } from './bots';
import { simulateMatch } from './matchSim';
import type { MatchResult, Team } from './teamModel';

// A fixed set of seeded matches. Recording the play of a chance must never change
// a score, an event or a word of narration, so the result here has to stay
// byte-identical (the new `play` field and kick ids are left out on purpose).
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i);

function fingerprint(result: MatchResult, home: Team, away: Team) {
  const team = (id: string | null | undefined) => (id === home.id ? 'H' : id === away.id ? 'A' : id ?? null);
  const player = (id: string | undefined) => {
    if (!id) return null;
    const h = home.players.findIndex(p => p.id === id);
    if (h >= 0) return `H${h}`;
    const a = away.players.findIndex(p => p.id === id);
    return a >= 0 ? `A${a}` : id;
  };
  return {
    score: [result.homeGoals, result.awayGoals],
    winner: team(result.winner),
    penalties: [result.homePenalties ?? null, result.awayPenalties ?? null],
    kicks: (result.penaltyKicks ?? []).map(k => [team(k.teamId), k.takerName, k.gkName, k.isGoal]),
    events: result.events.map(e => [e.minute, e.type, team(e.teamId), player(e.playerId), player(e.opponentId), player(e.assisterId), e.description]),
  };
}

describe('motor de partida — referência fixa', () => {
  afterEach(() => vi.restoreAllMocks());

  it('as mesmas sementes geram exatamente as mesmas partidas', async () => {
    const all = SEEDS.map(seed => {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const home = generateBotTeam(`Casa ${seed}`, 0.8);
      const away = generateBotTeam(`Fora ${seed}`, 0.8);
      const result = simulateMatch(home, away, seed % 3 === 0, false);
      vi.restoreAllMocks();
      return fingerprint(result, home, away);
    });
    await expect(JSON.stringify(all, null, 1)).toMatchFileSnapshot('./__snapshots__/engine-golden.json');
  });
});
```

- [ ] **Step 2: Rodar e gerar a referência**

Run: `pnpm exec vitest run shared/game/engine/engine-golden.test.ts`
Expected: PASS, e o arquivo `shared/game/engine/__snapshots__/engine-golden.json` é criado. Conferir que ele tem 40 partidas: `node -e "console.log(JSON.parse(require('fs').readFileSync('shared/game/engine/__snapshots__/engine-golden.json','utf8')).length)"` → `40`.

- [ ] **Step 3: Escrever o teste de `play` (que falha)**

Criar `shared/game/engine/match-play.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seededRandom } from '../random';
import { generateBotTeam } from './bots';
import { simulateMatch } from './matchSim';
import type { Team } from './teamModel';

const DANGER = new Set(['goal', 'save', 'miss', 'duel']);
const owns = (team: Team, id?: string) => !id || team.players.some(p => p.id === id);

describe('MatchEvent.play', () => {
  afterEach(() => vi.restoreAllMocks());

  it('todo lance de perigo registra a jogada com papéis coerentes', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const home = generateBotTeam(`H${seed}`, 0.7);
      const away = generateBotTeam(`A${seed}`, 0.7);
      const result = simulateMatch(home, away, seed % 2 === 0, false);
      vi.restoreAllMocks();
      for (const e of result.events) {
        if (!DANGER.has(e.type)) continue;
        expect(e.play, `${e.type} aos ${e.minute}' sem play`).toBeDefined();
        const play = e.play!;
        kinds.add(play.kind);
        // A save and a duel are credited to the defending side; goal and miss to the attackers.
        const eventTeam = e.teamId === home.id ? home : away;
        const otherTeam = eventTeam === home ? away : home;
        const defendingEvent = e.type === 'save' || e.type === 'duel';
        const attack = defendingEvent ? otherTeam : eventTeam;
        const defend = defendingEvent ? eventTeam : otherTeam;
        expect(owns(attack, play.attackerId), 'attackerId').toBe(true);
        expect(owns(attack, play.creatorId), 'creatorId').toBe(true);
        expect(owns(attack, play.wideId), 'wideId').toBe(true);
        expect(owns(defend, play.defenderId), 'defenderId').toBe(true);
        expect(owns(defend, play.goalkeeperId), 'goalkeeperId').toBe(true);
      }
    }
    for (const kind of ['cross', 'through', 'dribble', 'longrange', 'counter', 'corner', 'freekick', 'penalty']) {
      expect(kinds.has(kind), `nenhum lance do tipo ${kind}`).toBe(true);
    }
  });

  it('as cobranças da disputa de pênaltis trazem os ids do batedor e do goleiro', () => {
    let checked = 0;
    for (let seed = 1; seed <= 400 && checked < 5; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const home = generateBotTeam(`PH${seed}`, 0.7);
      const away = generateBotTeam(`PA${seed}`, 0.7);
      const result = simulateMatch(home, away, true, false);
      vi.restoreAllMocks();
      if (!result.penaltyKicks?.length) continue;
      checked++;
      for (const kick of result.penaltyKicks) {
        const kicking = kick.teamId === home.id ? home : away;
        const keeping = kicking === home ? away : home;
        expect(kicking.players.some(p => p.id === kick.takerId)).toBe(true);
        expect(keeping.players.some(p => p.id === kick.gkId)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm exec vitest run shared/game/engine/match-play.test.ts`
Expected: FAIL com "goal aos …' sem play" (e erro de tipo em `takerId`).

- [ ] **Step 5: Adicionar os tipos em `teamModel.ts`**

Inserir imediatamente antes de `export interface MatchEvent {` (linha 247):

```ts
/** How a chance was built. The engine already decides it; recording it lets the
 * replay (narration and the live pitch) show the play that was actually simulated. */
export type PlayKind =
  | 'cross' | 'through' | 'dribble' | 'longrange' | 'counter'
  | 'corner' | 'freekick' | 'penalty'
  | 'own_goal' | 'blunder' | 'deflected' | 'screamer' | 'woodwork';

/** The finish the engine resolved (see shotTypeForApproach in matchSim.ts). */
export type PlayShot = 'normal' | 'header' | 'long_range' | 'one_on_one' | 'first_time';

export interface MatchPlay {
  kind: PlayKind;
  shot?: PlayShot;
  /** Who shoots (or takes the penalty / free kick). */
  attackerId?: string;
  /** Who served it: the assist, the key pass, the corner. */
  creatorId?: string;
  /** The wide player who crossed. */
  wideId?: string;
  /** The marker in the duel (on an own goal, the defender who put it in). */
  defenderId?: string;
  goalkeeperId?: string;
}

```

Dentro de `export interface MatchEvent`, depois da linha `ratingDelta?: Record<string, number>;`, adicionar:

```ts
  /** The play behind a goal / save / miss / duel, as the engine simulated it. */
  play?: MatchPlay;
```

Em `export interface PenaltyKick` (linha 314), depois de `isGoal: boolean;`, adicionar:

```ts
  takerId?: string;
  gkId?: string;
```

- [ ] **Step 6: Usar o tipo em `matchSim.ts`**

Linha 10: na lista de tipos importados de `./teamModel`, acrescentar `type MatchPlay, type PlayShot` (depois de `type MatchResult`).

Linha 80: trocar
```ts
type ShotType = 'normal' | 'header' | 'long_range' | 'one_on_one' | 'first_time';
```
por
```ts
type ShotType = PlayShot;
```

- [ ] **Step 7: Pênalti durante o jogo**

Logo antes de `if (isPenGoal) {` (dentro do bloco `if (penaltyFoul) {`, ~linha 760), inserir:

```ts
        const penaltyPlay: MatchPlay = { kind: 'penalty', shot: 'normal', attackerId: penaltyTaker.id, defenderId: fouler?.id, goalkeeperId: penaltyGk.id };
```

Nos três `events.push` desse bloco (o `goal` com `penaltyGoalDesc`, o `save` com `penaltySaveDesc` e o `miss` com `penaltyMissDesc`), acrescentar a propriedade `play: penaltyPlay,` ao objeto, por exemplo:

```ts
          events.push({
            minute, type: 'goal',
            description: penaltyGoalDesc(penaltyTaker.shortName, fouled?.shortName ?? 'um atacante', fouler?.shortName ?? 'um defensor', penaltyGk.shortName),
            teamId: attackTeam.id, playerId: penaltyTaker.id, opponentId: penaltyGk.id, isSpecial: true,
            play: penaltyPlay,
          });
```

- [ ] **Step 8: Falta direta**

Logo antes de `if (r < goalChance) {` (bloco `else if (dangerousFoul) {`, ~linha 818), inserir:

```ts
        const freeKickPlay: MatchPlay = { kind: 'freekick', shot: 'normal', attackerId: taker.id, goalkeeperId: fkGk.id };
```

Acrescentar `play: freeKickPlay,` aos três `events.push` desse bloco (`freeKickGoalDesc`, `freeKickSaveDesc`, `freeKickMissDesc`).

- [ ] **Step 9: Escanteio com cabeceio**

Logo antes de `if (r2 < goalChance) {` (~linha 899), inserir:

```ts
          const cornerPlay: MatchPlay = { kind: 'corner', shot: 'header', attackerId: header.id, goalkeeperId: cgk.id };
```

No `events.push` do gol (`cornerGoalDesc`) acrescentar `play: { ...cornerPlay, creatorId: assister?.id },`. Nos `events.push` de `cornerSaveDesc` e `cornerMissDesc` acrescentar `play: cornerPlay,`.

- [ ] **Step 10: Lances de sorte**

Logo depois de `const isLuckEvent = random() < 0.04;` NÃO mexer na linha; dentro de `if (isLuckEvent) {`, logo depois de `dangerCount++;` (primeira linha do bloco), inserir:

```ts
        const luckPlayers = { attackerId: attacker.id, defenderId: defender.id, goalkeeperId: gk.id };
```

Acrescentar a cada `events.push` do bloco:
- gol contra (`ownGoalDesc`): `play: { kind: 'own_goal', ...luckPlayers },`
- frango (`frangoDesc`): `play: { kind: 'blunder', shot: 'normal', ...luckPlayers },`
- desvio (`deflectedDesc`): `play: { kind: 'deflected', shot: 'normal', ...luckPlayers },`
- golaço (`screamedDesc`): `play: { kind: 'screamer', shot: 'long_range', ...luckPlayers },`
- trave (`woodworkDesc`): `play: { kind: 'woodwork', shot: 'normal', ...luckPlayers },`

- [ ] **Step 11: Jogo corrido**

Logo depois do fechamento de `const chance = resolveOpenPlayChance({ … });` (~linha 1086), inserir:

```ts
        const openPlay: MatchPlay = {
          kind: approach,
          shot: chance.shotType,
          attackerId: attacker.id,
          defenderId: defender.id,
          goalkeeperId: gk.id,
          wideId: approach === 'cross' && widePlayer.id !== attacker.id ? widePlayer.id : undefined,
        };
```

Acrescentar:
- no `events.push` do gol (`goalDesc(approach, …)`): `play: { ...openPlay, creatorId: assister?.id },`
- no `events.push` da defesa (`saveDesc(approach, …)`): `play: { ...openPlay, creatorId: creatorS?.id },`
- no `events.push` do chute para fora (`missDesc(approach, …)`): `play: { ...openPlay, creatorId: creatorM?.id },`
- no `events.push` do desarme (`duelDesc(approach, …)`): `play: openPlay,`

Nenhuma outra linha muda. Nenhuma chamada a `random()` é adicionada.

- [ ] **Step 12: Ids nas cobranças da disputa (`strength.ts`)**

Nas quatro chamadas `kicks.push` (linhas 262, 269, 282, 283), acrescentar os ids. Exatamente:

```ts
    kicks.push({ teamId: home.id, takerName: homeTaker.shortName, gkName: awayGK.shortName, isGoal: homeGoal, takerId: homeTaker.id, gkId: awayGK.id });
```
```ts
    kicks.push({ teamId: away.id, takerName: awayTaker.shortName, gkName: homeGK.shortName, isGoal: awayGoal, takerId: awayTaker.id, gkId: homeGK.id });
```
```ts
      kicks.push({ teamId: home.id, takerName: homeTaker.shortName, gkName: awayGK.shortName, isGoal: homeGoalSD, takerId: homeTaker.id, gkId: awayGK.id });
      kicks.push({ teamId: away.id, takerName: awayTaker.shortName, gkName: homeGK.shortName, isGoal: awayGoalSD, takerId: awayTaker.id, gkId: homeGK.id });
```

- [ ] **Step 13: Rodar os dois testes**

Run: `pnpm exec vitest run shared/game/engine/engine-golden.test.ts shared/game/engine/match-play.test.ts`
Expected: PASS nos dois. Se o golden falhar, alguma edição mudou a sequência de sorteios ou um texto — desfazer e refazer a edição; **nunca** atualizar o snapshot.

- [ ] **Step 14: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída.

- [ ] **Step 15: Checkpoint** — Tarefa concluída com os dois testes passando e typecheck limpo.

---

### Task 2: Narração determinística do lance

**Files:**
- Create: `shared/game/dangerNarration.ts`
- Test: `shared/game/dangerNarration.test.ts`

**Interfaces:**
- Consumes: `MatchEvent`, `MatchPlay`, `Team` (Task 1); `buildUpDesc`, `dangerAttemptMsg`, `saveCelebMsg`, `missCelebMsg`, `Approach` de `shared/game/matchNarrative.ts`; `withRandomSource`, `seededRandom`, `seedFromString` de `shared/game/random.ts`.
- Produces:
  - `type DangerOutcome = 'goal' | 'save' | 'miss'`
  - `interface DangerNarration { attackTeamId: string; outcome: DangerOutcome; isOwnGoal: boolean; attackerName: string; defenderName: string; goalkeeperName: string; buildUp: string; attempt: string; reveal: string }`
  - `dangerSeed(event: MatchEvent, eventIndex: number): number`
  - `approachForPlay(play: MatchPlay | undefined): Approach`
  - `narrateDanger(args: { event: MatchEvent; eventIndex: number; homeTeam: Team; awayTeam: Team; fallbackGoalkeeperName: (team: Team) => string }): DangerNarration`

- [ ] **Step 1: Escrever o teste**

Criar `shared/game/dangerNarration.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededRandom } from './random';
import { generateBotTeam } from './gameEngine';
import { narrateDanger } from './dangerNarration';
import type { MatchEvent, Team } from './engine/teamModel';

let home: Team;
let away: Team;
beforeEach(() => {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(77));
  home = generateBotTeam('Casa', 0.8);
  away = generateBotTeam('Fora', 0.8);
  vi.restoreAllMocks();
});
afterEach(() => vi.restoreAllMocks());

const gkName = (team: Team) => team.players[0].shortName;

function goal(play: MatchEvent['play']): MatchEvent {
  return { minute: 33, type: 'goal', description: '', teamId: home.id, playerId: home.players[10].id, opponentId: away.players[3].id, play };
}

describe('narrateDanger', () => {
  it('gera sempre o mesmo texto para o mesmo lance, sem gastar o Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    const event = goal({ kind: 'cross', shot: 'header', attackerId: home.players[10].id, wideId: home.players[8].id, defenderId: away.players[3].id, goalkeeperId: away.players[0].id });
    const a = narrateDanger({ event, eventIndex: 12, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    const b = narrateDanger({ event, eventIndex: 12, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(a).toEqual(b);
    expect(spy).not.toHaveBeenCalled();
  });

  it('usa os jogadores do lance: finalizador, defensor e goleiro', () => {
    const event = goal({ kind: 'dribble', shot: 'normal', attackerId: home.players[10].id, defenderId: away.players[3].id, goalkeeperId: away.players[0].id });
    const n = narrateDanger({ event, eventIndex: 4, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: () => 'X' });
    expect(n.attackerName).toBe(home.players[10].shortName);
    expect(n.defenderName).toBe(away.players[3].shortName);
    expect(n.goalkeeperName).toBe(away.players[0].shortName);
    expect(n.attackTeamId).toBe(home.id);
    expect(n.reveal).toContain(home.players[10].shortName);
  });

  it('na defesa o time do evento é o do goleiro, e o atacante vem do opponentId', () => {
    const event: MatchEvent = { minute: 50, type: 'save', description: '', teamId: away.id, playerId: away.players[0].id, opponentId: home.players[9].id,
      play: { kind: 'longrange', shot: 'long_range', attackerId: home.players[9].id, goalkeeperId: away.players[0].id } };
    const n = narrateDanger({ event, eventIndex: 9, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(n.attackTeamId).toBe(home.id);
    expect(n.attackerName).toBe(home.players[9].shortName);
    expect(n.outcome).toBe('save');
  });

  it('gol contra é identificado e nomeia quem desviou', () => {
    const event: MatchEvent = { minute: 70, type: 'goal', description: '', teamId: home.id, opponentId: away.players[2].id,
      play: { kind: 'own_goal', attackerId: home.players[10].id, defenderId: away.players[2].id, goalkeeperId: away.players[0].id } };
    const n = narrateDanger({ event, eventIndex: 20, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(n.isOwnGoal).toBe(true);
    expect(n.attackerName).toContain(away.players[2].shortName);
  });

  it('evento antigo sem play continua narrado', () => {
    const event: MatchEvent = { minute: 15, type: 'miss', description: '', teamId: home.id, playerId: home.players[10].id };
    const n = narrateDanger({ event, eventIndex: 2, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(n.buildUp.length).toBeGreaterThan(10);
    expect(n.attempt.length).toBeGreaterThan(10);
    expect(n.reveal.length).toBeGreaterThan(5);
    expect(n.goalkeeperName).toBe(away.players[0].shortName);
  });

  it('pênalti e falta têm narração de bola parada', () => {
    const penalty = narrateDanger({ event: goal({ kind: 'penalty', shot: 'normal', attackerId: home.players[10].id, goalkeeperId: away.players[0].id }), eventIndex: 1, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(penalty.buildUp).toContain('PÊNALTI');
    const freeKick = narrateDanger({ event: goal({ kind: 'freekick', shot: 'normal', attackerId: home.players[10].id, goalkeeperId: away.players[0].id }), eventIndex: 1, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(freeKick.buildUp).toContain('Falta');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run shared/game/dangerNarration.test.ts`
Expected: FAIL com "Failed to resolve import './dangerNarration'".

- [ ] **Step 3: Implementar**

Criar `shared/game/dangerNarration.ts`:

```ts
/**
 * The three beats a danger is narrated with on the match screen (build-up,
 * attempt, reveal), built from the play the engine actually simulated. Every
 * variable phrase is drawn from a source seeded by the event, so the same match
 * reads exactly the same on every device and on every replay.
 */
import { buildUpDesc, dangerAttemptMsg, missCelebMsg, saveCelebMsg, type Approach } from './matchNarrative';
import { seededRandom, seedFromString, withRandomSource } from './random';
import type { MatchEvent, MatchPlay, Team } from './engine/teamModel';

export type DangerOutcome = 'goal' | 'save' | 'miss';

export interface DangerNarration {
  attackTeamId: string;
  outcome: DangerOutcome;
  isOwnGoal: boolean;
  /** On an own goal: "Gol Contra (Fulano)". */
  attackerName: string;
  defenderName: string;
  goalkeeperName: string;
  buildUp: string;
  attempt: string;
  reveal: string;
}

const OPEN_PLAY: ReadonlySet<string> = new Set(['cross', 'through', 'dribble', 'longrange', 'counter']);

export function dangerSeed(event: MatchEvent, eventIndex: number): number {
  return seedFromString(`${eventIndex}|${event.minute}|${event.type}|${event.teamId}|${event.playerId ?? ''}|${event.opponentId ?? ''}`);
}

/** The open-play wording that fits a recorded play (legacy events without a play read as a through ball). */
export function approachForPlay(play: MatchPlay | undefined): Approach {
  if (!play) return 'through';
  if (OPEN_PLAY.has(play.kind)) return play.kind as Approach;
  if (play.kind === 'corner') return 'cross';
  if (play.kind === 'freekick' || play.kind === 'penalty' || play.kind === 'screamer') return 'longrange';
  return 'dribble';
}

export function narrateDanger(args: {
  event: MatchEvent;
  eventIndex: number;
  homeTeam: Team;
  awayTeam: Team;
  fallbackGoalkeeperName: (team: Team) => string;
}): DangerNarration {
  const { event, eventIndex, homeTeam, awayTeam } = args;
  const outcome = event.type as DangerOutcome;
  const play = event.play;
  // A save is credited to the keeper's side; goal and miss to the attackers.
  const eventTeam = event.teamId === homeTeam.id ? homeTeam : awayTeam;
  const otherTeam = eventTeam === homeTeam ? awayTeam : homeTeam;
  const attackTeam = outcome === 'save' ? otherTeam : eventTeam;
  const defendTeam = attackTeam === homeTeam ? awayTeam : homeTeam;
  const nameIn = (team: Team, id?: string) => (id ? team.players.find(p => p.id === id)?.shortName : undefined);

  // Own goals carry no scorer on the attacking side (the engine tags the defender as opponentId).
  const isOwnGoal = outcome === 'goal' && (play?.kind === 'own_goal' || !event.playerId);
  const ownGoalName = isOwnGoal ? nameIn(defendTeam, play?.defenderId ?? event.opponentId) ?? 'um zagueiro' : '';
  const shooterId = play?.attackerId ?? (outcome === 'save' ? event.opponentId : event.playerId);
  const shooterName = nameIn(attackTeam, shooterId) ?? 'Atacante';
  const attackerName = isOwnGoal ? `Gol Contra (${ownGoalName})` : shooterName;
  const goalkeeperName = nameIn(defendTeam, play?.goalkeeperId) ?? args.fallbackGoalkeeperName(defendTeam);
  const defenderName = nameIn(defendTeam, play?.defenderId) ?? goalkeeperName;
  const wideName = nameIn(attackTeam, play?.wideId ?? play?.creatorId) ?? defenderName;

  return withRandomSource(seededRandom(dangerSeed(event, eventIndex)), () => {
    const approach = approachForPlay(play);
    let buildUp: string;
    let attempt: string;
    if (isOwnGoal) {
      buildUp = `😬 ${ownGoalName} tenta cortar sob pressão na área do ${defendTeam.name}, mas a bola desvia em direção ao próprio gol...`;
      attempt = '⚽ A bola viaja perigosamente em direção ao gol...!';
    } else if (play?.kind === 'penalty') {
      buildUp = `PÊNALTI! ${shooterName} ajeita a bola na marca. ${goalkeeperName} se prepara em cima da linha.`;
      attempt = `${shooterName} toma distância, corre para a bola e bate!`;
    } else if (play?.kind === 'freekick') {
      buildUp = `Falta perigosa na entrada da área! ${shooterName} ajeita a bola para a cobrança direta.`;
      attempt = `${shooterName} cobra por cima da barreira!`;
    } else if (play?.kind === 'corner') {
      buildUp = `Escanteio para o ${attackTeam.name}! A bola vai ser levantada na área.`;
      attempt = `A bola viaja na área e ${shooterName} sobe para cabecear!`;
    } else {
      buildUp = buildUpDesc(approach, shooterName, defenderName, wideName, attackTeam.name);
      attempt = dangerAttemptMsg(approach, shooterName, defenderName, goalkeeperName);
    }
    const reveal = isOwnGoal
      ? `😱 GOL CONTRA de ${ownGoalName} (${defendTeam.name})! Ele desviou para a própria meta e o ${attackTeam.name.toUpperCase()} agradece!`
      : outcome === 'goal'
        ? `🔥 GOOOOL! ${attackerName} balança as redes! ${attackTeam.name.toUpperCase()} MARCA!`
        : outcome === 'save'
          ? saveCelebMsg(goalkeeperName, attackerName)
          : missCelebMsg(attackerName);
    return { attackTeamId: attackTeam.id, outcome, isOwnGoal, attackerName, defenderName, goalkeeperName, buildUp, attempt, reveal };
  });
}
```

Nota: o gol contra, a revelação do gol e as celebrações mantêm exatamente os textos que a `MatchSimPage` usa hoje (só mudam de lugar). Os textos novos de bola parada não usam emoji.

- [ ] **Step 4: Rodar**

Run: `pnpm exec vitest run shared/game/dangerNarration.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Checkpoint** — teste passando; `npx tsc --noEmit -p tsconfig.json` sem saída.

---

### Task 3: Geometria e linha do tempo

**Files:**
- Create: `shared/game/pitch/geometry.ts`
- Create: `shared/game/pitch/timeline.ts`
- Test: `shared/game/pitch/timeline.test.ts`

**Interfaces:**
- Produces (geometry): `PITCH_LENGTH = 105`, `PITCH_WIDTH = 68`, `GOAL_Y_MIN = 30.34`, `GOAL_Y_MAX = 37.66`, `GOAL_HEIGHT = 2.44`, `PLAYERS_PER_SIDE = 11`, `BALL_SLOT = 22`, `SLOT_COUNT = 23`, `type Side = 'left' | 'right'`, `SIDES`, `interface Point { x: number; y: number }`, `interface Squad { teamId: string; playerIds: readonly string[]; formationId: string }`, `interface PitchSides { left: Squad; right: Squad }`, `slotBase(side)`, `otherSide(side)`, `slotOfPlayer(sides, id)`, `sideOfTeam(sides, teamId)`, `sideOfSlot(slot)`, `roleOfSlot(sides, slot)`, `homeShape(formationId)`, `shapeFor(side, formationId, { advance, widthScale })`, `mirrorPoint(p)`.
- Produces (timeline): `EASE_SMOOTH = 0`, `EASE_LINEAR = 1`, `EASE_OUT = 2`, `type Ease`, `interface Key { t; x; y; z; ease; arc }`, `interface Timeline { duration: number; tracks: Key[][] }`, `createPositionBuffer(): Float32Array` (23 × [x, y, z]), `sampleTrack(track, t, out, offset)`, `sampleTimeline(timeline, t, out)`, `class TimelineBuilder { constructor(start: Float32Array); key(slot, t, x, y, z?, ease?, arc?): this; hold(slot, t): this; at(slot, t): { x: number; y: number; z: number }; moved(slot): boolean; build(duration): Timeline }`, `mirrorTimeline(tl)`, `mirrorBuffer(src, dst)`.

- [ ] **Step 1: Escrever o teste**

Criar `shared/game/pitch/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BALL_SLOT, homeShape, PITCH_LENGTH, PITCH_WIDTH, shapeFor, slotOfPlayer, type PitchSides } from './geometry';
import { createPositionBuffer, EASE_LINEAR, mirrorBuffer, mirrorTimeline, sampleTimeline, TimelineBuilder } from './timeline';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };

describe('geometria', () => {
  it('a formação do time da esquerda fica no próprio campo, com o goleiro na pequena área', () => {
    const shape = homeShape('4-3-3');
    expect(shape).toHaveLength(11);
    expect(shape[0].x).toBeLessThan(8);
    for (const p of shape) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(PITCH_LENGTH / 2);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(PITCH_WIDTH);
    }
  });

  it('o time da direita é o espelho', () => {
    const left = shapeFor('left', '4-3-3', { advance: 0, widthScale: 1 });
    const right = shapeFor('right', '4-3-3', { advance: 0, widthScale: 1 });
    left.forEach((p, i) => {
      expect(right[i].x).toBeCloseTo(PITCH_LENGTH - p.x);
      expect(right[i].y).toBeCloseTo(PITCH_WIDTH - p.y);
    });
  });

  it('acha o slot de um jogador e ignora os reservas', () => {
    expect(slotOfPlayer(sides, 'L3')).toBe(3);
    expect(slotOfPlayer(sides, 'R10')).toBe(21);
    expect(slotOfPlayer(sides, 'nada')).toBe(-1);
  });
});

describe('linha do tempo', () => {
  it('interpola entre quadros-chave e respeita o arco da bola', () => {
    const start = createPositionBuffer();
    const b = new TimelineBuilder(start);
    b.key(BALL_SLOT, 1000, 10, 20, 0, EASE_LINEAR, 4);
    const tl = b.build(1000);
    const out = createPositionBuffer();
    sampleTimeline(tl, 500, out);
    expect(out[BALL_SLOT * 3]).toBeCloseTo(5);
    expect(out[BALL_SLOT * 3 + 1]).toBeCloseTo(10);
    expect(out[BALL_SLOT * 3 + 2]).toBeCloseTo(4); // peak of the arc
    sampleTimeline(tl, 5000, out); // clamped to the end
    expect(out[BALL_SLOT * 3]).toBeCloseTo(10);
  });

  it('insere quadros fora de ordem no lugar certo', () => {
    const b = new TimelineBuilder(createPositionBuffer());
    b.key(0, 1000, 10, 0, 0, EASE_LINEAR);
    b.key(0, 500, 2, 0, 0, EASE_LINEAR);
    expect(b.build(1000).tracks[0].map(k => k.t)).toEqual([0, 500, 1000]);
  });

  it('espelha posições e linhas do tempo', () => {
    const src = createPositionBuffer();
    src[0] = 10; src[1] = 5;
    const dst = createPositionBuffer();
    mirrorBuffer(src, dst);
    expect(dst[0]).toBeCloseTo(95);
    expect(dst[1]).toBeCloseTo(63);
    const b = new TimelineBuilder(src);
    b.key(0, 100, 20, 30);
    const m = mirrorTimeline(b.build(100));
    expect(m.tracks[0][1].x).toBeCloseTo(85);
    expect(m.tracks[0][1].y).toBeCloseTo(38);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run shared/game/pitch/timeline.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar `geometry.ts`**

```ts
/** Pitch measurements and slot layout for the live pitch. Metres, origin at the
 * top-left corner; the left team attacks to the right (towards x = 105). */
import { FORMATIONS } from '../gameData';

export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;
export const GOAL_Y_MIN = 30.34;
export const GOAL_Y_MAX = 37.66;
export const GOAL_HEIGHT = 2.44;
export const PLAYERS_PER_SIDE = 11;
/** Slots 0-10 are the left XI, 11-21 the right XI (formation order), 22 the ball. */
export const BALL_SLOT = 22;
export const SLOT_COUNT = 23;

export type Side = 'left' | 'right';
export const SIDES: readonly Side[] = ['left', 'right'];

export interface Point { x: number; y: number }
export interface Squad { teamId: string; playerIds: readonly string[]; formationId: string }
export interface PitchSides { left: Squad; right: Squad }

export const slotBase = (side: Side) => (side === 'left' ? 0 : PLAYERS_PER_SIDE);
export const otherSide = (side: Side): Side => (side === 'left' ? 'right' : 'left');
export const sideOfSlot = (slot: number): Side => (slot < PLAYERS_PER_SIDE ? 'left' : 'right');
export const mirrorPoint = (p: Point): Point => ({ x: PITCH_LENGTH - p.x, y: PITCH_WIDTH - p.y });

export function slotOfPlayer(sides: PitchSides, playerId: string | undefined): number {
  if (!playerId) return -1;
  const left = sides.left.playerIds.indexOf(playerId);
  if (left >= 0 && left < PLAYERS_PER_SIDE) return left;
  const right = sides.right.playerIds.indexOf(playerId);
  return right >= 0 && right < PLAYERS_PER_SIDE ? PLAYERS_PER_SIDE + right : -1;
}

export function sideOfTeam(sides: PitchSides, teamId: string | undefined): Side | null {
  if (teamId === sides.left.teamId) return 'left';
  if (teamId === sides.right.teamId) return 'right';
  return null;
}

function formation(formationId: string) {
  return FORMATIONS.find(f => f.id === formationId) ?? FORMATIONS.find(f => f.id === '4-4-2') ?? FORMATIONS[0];
}

export function roleOfSlot(sides: PitchSides, slot: number): string {
  const side = sideOfSlot(slot);
  return formation(sides[side].formationId).positions[slot - slotBase(side)]?.role ?? 'CM';
}

/** Kick-off shape of a team attacking to the right: formation slots (x across the
 * width, y 0 = attack) mapped onto its own half. */
export function homeShape(formationId: string): Point[] {
  return formation(formationId).positions.map(p => ({
    x: p.role === 'GK' ? 5 : 6 + (100 - p.y) * 0.47,
    y: (p.x / 100) * PITCH_WIDTH,
  }));
}

/** A team's shape pushed forward by `advance` metres and stretched across by
 * `widthScale`, in screen coordinates for the given side. */
export function shapeFor(side: Side, formationId: string, opts: { advance: number; widthScale: number }): Point[] {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return homeShape(formationId).map((p, i) => {
    const isKeeper = formation(formationId).positions[i]?.role === 'GK';
    const point = isKeeper
      ? { x: clamp(p.x + opts.advance * 0.3, 2, 18), y: 34 + (p.y - 34) * 0.4 }
      : { x: clamp(p.x + opts.advance, 3, 101), y: clamp(34 + (p.y - 34) * opts.widthScale, 2.5, 65.5) };
    return side === 'left' ? point : mirrorPoint(point);
  });
}
```

- [ ] **Step 4: Implementar `timeline.ts`**

```ts
/** Keyframe tracks for the 22 players and the ball, sampled into a reusable
 * buffer every animation frame (no allocation on the hot path). */
import { PITCH_LENGTH, PITCH_WIDTH, SLOT_COUNT } from './geometry';

export const EASE_SMOOTH = 0;
export const EASE_LINEAR = 1;
export const EASE_OUT = 2;
export type Ease = 0 | 1 | 2;

/** `ease` and `arc` describe the segment that ENDS at this key; `arc` lifts z by a
 * half sine over that segment (a ball in flight, a jump). */
export interface Key { t: number; x: number; y: number; z: number; ease: Ease; arc: number }
export interface Timeline { duration: number; tracks: Key[][] }

export function createPositionBuffer(): Float32Array {
  return new Float32Array(SLOT_COUNT * 3);
}

function eased(k: number, ease: Ease): number {
  if (ease === EASE_LINEAR) return k;
  if (ease === EASE_OUT) return 1 - (1 - k) * (1 - k);
  return k * k * (3 - 2 * k);
}

export function sampleTrack(track: Key[], t: number, out: Float32Array, offset: number): void {
  const first = track[0];
  if (track.length === 1 || t <= first.t) {
    out[offset] = first.x; out[offset + 1] = first.y; out[offset + 2] = first.z;
    return;
  }
  const last = track[track.length - 1];
  if (t >= last.t) {
    out[offset] = last.x; out[offset + 1] = last.y; out[offset + 2] = last.z;
    return;
  }
  let i = 1;
  while (track[i].t < t) i++;
  const a = track[i - 1];
  const b = track[i];
  const raw = (t - a.t) / (b.t - a.t);
  const k = eased(raw, b.ease);
  out[offset] = a.x + (b.x - a.x) * k;
  out[offset + 1] = a.y + (b.y - a.y) * k;
  out[offset + 2] = a.z + (b.z - a.z) * k + (b.arc !== 0 ? Math.sin(Math.PI * raw) * b.arc : 0);
}

export function sampleTimeline(timeline: Timeline, t: number, out: Float32Array): void {
  const time = t < 0 ? 0 : t > timeline.duration ? timeline.duration : t;
  for (let slot = 0; slot < SLOT_COUNT; slot++) sampleTrack(timeline.tracks[slot], time, out, slot * 3);
}

export class TimelineBuilder {
  private readonly tracks: Key[][];
  private readonly scratch = new Float32Array(3);

  constructor(start: Float32Array) {
    this.tracks = Array.from({ length: SLOT_COUNT }, (_, s) => [
      { t: 0, x: start[s * 3], y: start[s * 3 + 1], z: start[s * 3 + 2], ease: EASE_SMOOTH as Ease, arc: 0 },
    ]);
  }

  /** Adds (or replaces, at the same time) a key, keeping the track sorted. */
  key(slot: number, t: number, x: number, y: number, z = 0, ease: Ease = EASE_SMOOTH, arc = 0): this {
    const track = this.tracks[slot];
    const key: Key = { t: Math.max(1, t), x, y, z, ease, arc };
    let i = track.length;
    while (i > 0 && track[i - 1].t > key.t) i--;
    if (i > 0 && track[i - 1].t === key.t) track[i - 1] = key;
    else track.splice(i, 0, key);
    return this;
  }

  /** Pins the slot where it is at time t, so later keys start from there. */
  hold(slot: number, t: number): this {
    const p = this.at(slot, t);
    return this.key(slot, t, p.x, p.y, p.z, EASE_LINEAR);
  }

  at(slot: number, t: number): { x: number; y: number; z: number } {
    sampleTrack(this.tracks[slot], t, this.scratch, 0);
    return { x: this.scratch[0], y: this.scratch[1], z: this.scratch[2] };
  }

  moved(slot: number): boolean {
    return this.tracks[slot].length > 1;
  }

  lastTime(slot: number): number {
    const track = this.tracks[slot];
    return track[track.length - 1].t;
  }

  build(duration: number): Timeline {
    return { duration, tracks: this.tracks };
  }
}

export function mirrorTimeline(timeline: Timeline): Timeline {
  return {
    duration: timeline.duration,
    tracks: timeline.tracks.map(track => track.map(k => ({ ...k, x: PITCH_LENGTH - k.x, y: PITCH_WIDTH - k.y }))),
  };
}

export function mirrorBuffer(src: Float32Array, dst: Float32Array): void {
  for (let i = 0; i < src.length; i += 3) {
    dst[i] = PITCH_LENGTH - src[i];
    dst[i + 1] = PITCH_WIDTH - src[i + 1];
    dst[i + 2] = src[i + 2];
  }
}
```

- [ ] **Step 5: Rodar**

Run: `pnpm exec vitest run shared/game/pitch/timeline.test.ts`
Expected: PASS.

- [ ] **Step 6: Checkpoint** — teste passando; typecheck limpo.

---

### Task 4: Jogo corrido, saída de bola e reagrupamento

**Files:**
- Create: `shared/game/pitch/flow.ts`
- Test: `shared/game/pitch/flow.test.ts`

**Interfaces:**
- Consumes: Task 3 inteira; `seededRandom` de `shared/game/random.ts`.
- Produces:
  - `interface FlowInput { sides: PitchSides; possession: Side; carrier: number; momentum: number; tactics: { left: string; right: string }; sentOff: ReadonlySet<number>; seed: number; durationMs: number }` — `momentum` 0..100, 100 = a esquerda domina.
  - `interface FlowResult { timeline: Timeline; carrier: number }`
  - `teamShape(side, formationId, momentum, inPossession, tactic): Point[]`
  - `kickoffTaker(sides, side): number`
  - `kickoffPositions(sides, kickoff?: Side): Float32Array`
  - `buildFlowSegment(prev: Float32Array, input: FlowInput): FlowResult`
  - `buildKickoffSegment(prev, sides, kickoff: Side, durationMs, sentOff): FlowResult`
  - `buildRegroupSegment(prev, target: Float32Array, durationMs, sentOff): Timeline`

- [ ] **Step 1: Escrever o teste**

Criar `shared/game/pitch/flow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BALL_SLOT, PITCH_LENGTH, PITCH_WIDTH, type PitchSides } from './geometry';
import { buildFlowSegment, buildKickoffSegment, kickoffPositions, kickoffTaker } from './flow';
import { createPositionBuffer, sampleTimeline } from './timeline';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '3-5-2' } };
const tactics = { left: 'balanced', right: 'high_press' };

function run(minutes: number, sentOff: Set<number>) {
  let pos = kickoffPositions(sides, 'left');
  let carrier = kickoffTaker(sides, 'left');
  const out = createPositionBuffer();
  for (let m = 1; m <= minutes; m++) {
    const r = buildFlowSegment(pos, { sides, possession: m % 7 < 4 ? 'left' : 'right', carrier, momentum: 30 + (m * 13) % 50, tactics, sentOff, seed: m, durationMs: 222 });
    sampleTimeline(r.timeline, 222, out);
    for (let i = 0; i < out.length; i += 3) {
      expect(out[i]).toBeGreaterThanOrEqual(-1);
      expect(out[i]).toBeLessThanOrEqual(PITCH_LENGTH + 1);
      expect(out[i + 1]).toBeGreaterThanOrEqual(-1);
      expect(out[i + 1]).toBeLessThanOrEqual(PITCH_WIDTH + 1);
    }
    pos = Float32Array.from(out);
    carrier = r.carrier;
  }
  return { pos, carrier };
}

describe('jogo corrido', () => {
  it('mantém todos dentro do campo e a bola com quem tem a posse', () => {
    const { pos, carrier } = run(60, new Set());
    const dx = pos[BALL_SLOT * 3] - pos[carrier * 3];
    const dy = pos[BALL_SLOT * 3 + 1] - pos[carrier * 3 + 1];
    expect(Math.hypot(dx, dy)).toBeLessThan(3);
  });

  it('é determinístico', () => {
    expect(Array.from(run(20, new Set()).pos)).toEqual(Array.from(run(20, new Set()).pos));
  });

  it('expulso fica parado', () => {
    const start = kickoffPositions(sides, 'left');
    const r = buildFlowSegment(start, { sides, possession: 'left', carrier: 9, momentum: 70, tactics, sentOff: new Set([4]), seed: 3, durationMs: 222 });
    const out = createPositionBuffer();
    sampleTimeline(r.timeline, 222, out);
    expect(out[12]).toBeCloseTo(start[12]);
    expect(out[13]).toBeCloseTo(start[13]);
    expect(r.carrier).not.toBe(4);
  });

  it('a saída de bola leva todos ao próprio campo e a bola ao centro', () => {
    const { pos } = run(30, new Set());
    const k = buildKickoffSegment(pos, sides, 'right', 1100, new Set());
    const out = createPositionBuffer();
    sampleTimeline(k.timeline, 1100, out);
    for (let s = 0; s < 11; s++) expect(out[s * 3]).toBeLessThanOrEqual(52.5);
    for (let s = 11; s < 22; s++) expect(out[s * 3]).toBeGreaterThanOrEqual(52.5);
    expect(out[BALL_SLOT * 3]).toBeCloseTo(52.5);
    expect(out[BALL_SLOT * 3 + 1]).toBeCloseTo(34);
    expect(k.carrier).toBeGreaterThanOrEqual(11);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run shared/game/pitch/flow.test.ts`
Expected: FAIL (`./flow` não existe).

- [ ] **Step 3: Implementar `flow.ts`**

```ts
/** Open play between chances (the "radio" view): both blocks glide with the
 * momentum and the ball circulates inside the team in possession. */
import { seededRandom } from '../random';
import {
  BALL_SLOT, PLAYERS_PER_SIDE, SIDES, roleOfSlot, shapeFor, slotBase,
  type PitchSides, type Point, type Side,
} from './geometry';
import { createPositionBuffer, EASE_LINEAR, EASE_OUT, TimelineBuilder, type Timeline } from './timeline';

export interface FlowInput {
  sides: PitchSides;
  possession: Side;
  /** Slot holding the ball; anything invalid picks the nearest player in possession. */
  carrier: number;
  /** 0..100, 100 = the left team dominates. */
  momentum: number;
  tactics: { left: string; right: string };
  sentOff: ReadonlySet<number>;
  seed: number;
  durationMs: number;
}

export interface FlowResult { timeline: Timeline; carrier: number }

/** How much of the gap to its shape a player closes per segment (keeps the blocks gliding). */
const FLOW_GLIDE = 0.35;
const PASS_CHANCE = 0.4;
const PASS_RANGE = 28;
const FOOT = 0.9;

const TACTIC_SHAPE: Record<string, { advance: number; width: number }> = {
  balanced: { advance: 0, width: 1 },
  possession: { advance: 3, width: 1.08 },
  counter: { advance: -6, width: 0.92 },
  high_press: { advance: 7, width: 1 },
  defensive: { advance: -10, width: 0.85 },
  all_out_attack: { advance: 11, width: 1.12 },
};

export function teamShape(side: Side, formationId: string, momentum: number, inPossession: boolean, tactic: string): Point[] {
  const dominance = side === 'left' ? momentum : 100 - momentum;
  const t = TACTIC_SHAPE[tactic] ?? TACTIC_SHAPE.balanced;
  const advance = (dominance - 50) * 0.36 + (inPossession ? 6 : -4) + t.advance;
  return shapeFor(side, formationId, { advance, widthScale: t.width * (inPossession ? 1.06 : 0.86) });
}

const live = (side: Side, sentOff: ReadonlySet<number>) => {
  const base = slotBase(side);
  const out: number[] = [];
  for (let i = 0; i < PLAYERS_PER_SIDE; i++) if (!sentOff.has(base + i)) out.push(base + i);
  return out;
};

function nearest(slots: number[], x: number, y: number, pos: Float32Array): number {
  let best = slots[0];
  let bestD = Infinity;
  for (const s of slots) {
    const d = Math.hypot(pos[s * 3] - x, pos[s * 3 + 1] - y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function kickoffTaker(sides: PitchSides, side: Side): number {
  const base = slotBase(side);
  const shape = shapeFor('left', sides[side].formationId, { advance: 0, widthScale: 1 });
  let best = 1;
  for (let i = 1; i < shape.length; i++) if (shape[i].x > shape[best].x) best = i;
  return base + best;
}

export function kickoffPositions(sides: PitchSides, kickoff: Side = 'left'): Float32Array {
  const out = createPositionBuffer();
  for (const side of SIDES) {
    const base = slotBase(side);
    shapeFor(side, sides[side].formationId, { advance: 0, widthScale: 1 }).forEach((p, i) => {
      out[(base + i) * 3] = p.x;
      out[(base + i) * 3 + 1] = p.y;
    });
  }
  const taker = kickoffTaker(sides, kickoff);
  out[taker * 3] = kickoff === 'left' ? 51.6 : 53.4;
  out[taker * 3 + 1] = 34;
  out[BALL_SLOT * 3] = 52.5;
  out[BALL_SLOT * 3 + 1] = 34;
  return out;
}

export function buildFlowSegment(prev: Float32Array, input: FlowInput): FlowResult {
  const rng = seededRandom(input.seed);
  const b = new TimelineBuilder(prev);
  const d = input.durationMs;
  const end = createPositionBuffer();
  for (const side of SIDES) {
    const base = slotBase(side);
    const shape = teamShape(side, input.sides[side].formationId, input.momentum, input.possession === side, input.tactics[side]);
    for (let i = 0; i < PLAYERS_PER_SIDE; i++) {
      const s = base + i;
      const px = prev[s * 3];
      const py = prev[s * 3 + 1];
      let x = px;
      let y = py;
      if (!input.sentOff.has(s)) {
        const tx = shape[i].x + (rng() - 0.5) * 2;
        const ty = shape[i].y + (rng() - 0.5) * 2;
        x = px + (tx - px) * FLOW_GLIDE;
        y = py + (ty - py) * FLOW_GLIDE;
      }
      b.key(s, d, x, y, 0, EASE_LINEAR);
      end[s * 3] = x;
      end[s * 3 + 1] = y;
    }
  }

  const team = live(input.possession, input.sentOff);
  let carrier = team.includes(input.carrier)
    ? input.carrier
    : nearest(team, prev[BALL_SLOT * 3], prev[BALL_SLOT * 3 + 1], end);
  const dir = input.possession === 'left' ? 1 : -1;
  let passed = false;
  if (rng() < PASS_CHANCE) {
    const cx = end[carrier * 3];
    const cy = end[carrier * 3 + 1];
    const options = team.filter(s => s !== carrier && roleOfSlot(input.sides, s) !== 'GK'
      && Math.hypot(end[s * 3] - cx, end[s * 3 + 1] - cy) < PASS_RANGE);
    if (options.length > 0) {
      const weights = options.map(s => 1 + Math.max(0, (end[s * 3] - cx) * dir) / 10);
      let r = rng() * weights.reduce((a, w) => a + w, 0);
      let pick = options[options.length - 1];
      for (let i = 0; i < options.length; i++) { r -= weights[i]; if (r <= 0) { pick = options[i]; break; } }
      carrier = pick;
      passed = true;
    }
  }
  b.key(BALL_SLOT, d, end[carrier * 3] + FOOT * dir, end[carrier * 3 + 1] + 0.3, 0, passed ? EASE_OUT : EASE_LINEAR);
  return { timeline: b.build(d), carrier };
}

export function buildRegroupSegment(prev: Float32Array, target: Float32Array, durationMs: number, sentOff: ReadonlySet<number>): Timeline {
  const b = new TimelineBuilder(prev);
  for (let s = 0; s < BALL_SLOT; s++) {
    if (sentOff.has(s)) continue;
    b.key(s, durationMs, target[s * 3], target[s * 3 + 1]);
  }
  b.key(BALL_SLOT, durationMs, target[BALL_SLOT * 3], target[BALL_SLOT * 3 + 1], 0, EASE_OUT);
  return b.build(durationMs);
}

export function buildKickoffSegment(prev: Float32Array, sides: PitchSides, kickoff: Side, durationMs: number, sentOff: ReadonlySet<number>): FlowResult {
  return {
    timeline: buildRegroupSegment(prev, kickoffPositions(sides, kickoff), durationMs, sentOff),
    carrier: kickoffTaker(sides, kickoff),
  };
}
```

- [ ] **Step 4: Rodar**

Run: `pnpm exec vitest run shared/game/pitch/flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — teste passando; typecheck limpo.

---

### Task 5: Roteiros dos lances perigosos

**Files:**
- Create: `shared/game/pitch/plays.ts`
- Test: `shared/game/pitch/plays.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4 (`MatchEvent`, `MatchPlay`, `PlayKind`, `PlayShot`, geometria, `TimelineBuilder`, `shapeFor`).
- Produces:
  - `STAGE_MS = 1500`, `DANGER_MS = 4500`, `SHOT_ARRIVAL_MS = 3000` (a bola chega ao alvo exatamente quando a narração revela o desfecho)
  - `type DangerOutcome = 'goal' | 'save' | 'miss'`
  - `type CastRole = 'finisher' | 'creator' | 'defender' | 'goalkeeper'`, `interface CastEntry { slot: number; role: CastRole }`
  - `type BeatKind = 'net' | 'save' | 'post' | 'out'`, `interface Beat { t: number; kind: BeatKind; x: number; y: number }`
  - `interface DangerInput { sides: PitchSides; attackSide: Side; event: MatchEvent; outcome: DangerOutcome; prev: Float32Array; sentOff: ReadonlySet<number>; seed: number }`
  - `interface DangerTimeline { timeline: Timeline; cast: CastEntry[]; beats: Beat[]; focus: Point; attackSide: Side }`
  - `DANGER_KINDS: readonly PlayKind[]`
  - `buildDangerTimeline(input: DangerInput): DangerTimeline`

- [ ] **Step 1: Escrever o teste**

Criar `shared/game/pitch/plays.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MatchEvent, PlayKind } from '../engine/teamModel';
import { BALL_SLOT, GOAL_HEIGHT, GOAL_Y_MAX, GOAL_Y_MIN, PITCH_LENGTH, PITCH_WIDTH, type PitchSides, type Side } from './geometry';
import { kickoffPositions } from './flow';
import { buildDangerTimeline, DANGER_KINDS, DANGER_MS, SHOT_ARRIVAL_MS, type DangerOutcome } from './plays';
import { createPositionBuffer, sampleTimeline } from './timeline';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };

const OUTCOMES: Record<string, DangerOutcome[]> = {
  own_goal: ['goal'], blunder: ['goal'], deflected: ['goal'], screamer: ['goal'], woodwork: ['miss'],
};

function eventFor(kind: PlayKind, outcome: DangerOutcome, attackSide: Side): MatchEvent {
  const atk = attackSide === 'left' ? 'L' : 'R';
  const def = attackSide === 'left' ? 'R' : 'L';
  const atkTeam = attackSide === 'left' ? 'L' : 'R';
  const defTeam = attackSide === 'left' ? 'R' : 'L';
  return {
    minute: 40,
    type: outcome,
    description: '',
    teamId: outcome === 'save' ? defTeam : atkTeam,
    playerId: outcome === 'save' ? `${def}0` : kind === 'own_goal' ? undefined : `${atk}10`,
    opponentId: outcome === 'save' ? `${atk}10` : kind === 'own_goal' ? `${def}2` : undefined,
    play: { kind, attackerId: `${atk}10`, creatorId: `${atk}7`, wideId: kind === 'cross' ? `${atk}8` : undefined, defenderId: `${def}2`, goalkeeperId: `${def}0` },
  };
}

// Ball position in the attacker's frame (the attack always goes towards x = 105).
const toAttack = (side: Side, x: number, y: number) => (side === 'left' ? { x, y } : { x: PITCH_LENGTH - x, y: PITCH_WIDTH - y });

describe('roteiros de lance perigoso', () => {
  for (const kind of DANGER_KINDS) {
    for (const outcome of OUTCOMES[kind] ?? (['goal', 'save', 'miss'] as DangerOutcome[])) {
      for (const attackSide of ['left', 'right'] as Side[]) {
        it(`${kind} → ${outcome} (${attackSide})`, () => {
          for (let seed = 1; seed <= 4; seed++) {
            const prev = kickoffPositions(sides, 'left');
            const input = { sides, attackSide, event: eventFor(kind, outcome, attackSide), outcome, prev, sentOff: new Set<number>(), seed };
            const d = buildDangerTimeline(input);
            const out = createPositionBuffer();

            sampleTimeline(d.timeline, 0, out);
            out.forEach((v, i) => expect(v).toBeCloseTo(prev[i], 3)); // starts exactly where the players are

            for (let t = 0; t <= DANGER_MS; t += 50) {
              sampleTimeline(d.timeline, t, out);
              for (let i = 0; i < out.length; i += 3) {
                expect(out[i]).toBeGreaterThan(-7); // a ball sent wide can leave behind either goal
                expect(out[i]).toBeLessThan(PITCH_LENGTH + 7);
                expect(out[i + 1]).toBeGreaterThan(-4);
                expect(out[i + 1]).toBeLessThan(PITCH_WIDTH + 4);
                expect(out[i + 2]).toBeGreaterThanOrEqual(-0.01);
                expect(out[i + 2]).toBeLessThan(9);
              }
            }

            sampleTimeline(d.timeline, SHOT_ARRIVAL_MS, out);
            const ball = toAttack(attackSide, out[BALL_SLOT * 3], out[BALL_SLOT * 3 + 1]);
            const z = out[BALL_SLOT * 3 + 2];
            const gkSlot = d.cast.find(c => c.role === 'goalkeeper')!.slot;
            const gk = toAttack(attackSide, out[gkSlot * 3], out[gkSlot * 3 + 1]);
            if (kind === 'woodwork') {
              expect(ball.x).toBeGreaterThan(104.5);
              expect(Math.min(Math.abs(ball.y - GOAL_Y_MIN), Math.abs(ball.y - GOAL_Y_MAX))).toBeLessThan(0.5);
            } else if (outcome === 'goal') {
              expect(ball.x).toBeGreaterThanOrEqual(105);
              expect(ball.y).toBeGreaterThan(GOAL_Y_MIN);
              expect(ball.y).toBeLessThan(GOAL_Y_MAX);
              expect(z).toBeLessThan(GOAL_HEIGHT);
            } else if (outcome === 'save') {
              expect(Math.hypot(ball.x - gk.x, ball.y - gk.y)).toBeLessThan(1.5);
            } else {
              expect(ball.x).toBeGreaterThanOrEqual(105);
              expect(ball.y < GOAL_Y_MIN || ball.y > GOAL_Y_MAX || z > GOAL_HEIGHT).toBe(true);
            }

            const slots = d.cast.map(c => c.slot);
            expect(new Set(slots).size).toBe(slots.length);
            expect(slots.length).toBeLessThanOrEqual(4);
            expect(d.cast.some(c => c.role === 'finisher')).toBe(true);

            expect(JSON.stringify(buildDangerTimeline(input).timeline)).toBe(JSON.stringify(d.timeline));
          }
        });
      }
    }
  }

  it('evento antigo sem play vira um lance genérico', () => {
    const event: MatchEvent = { minute: 10, type: 'goal', description: '', teamId: 'L', playerId: 'L10' };
    const d = buildDangerTimeline({ sides, attackSide: 'left', event, outcome: 'goal', prev: kickoffPositions(sides), sentOff: new Set(), seed: 9 });
    const out = createPositionBuffer();
    sampleTimeline(d.timeline, SHOT_ARRIVAL_MS, out);
    expect(out[BALL_SLOT * 3]).toBeGreaterThanOrEqual(105);
  });

  it('expulso não participa do lance', () => {
    const event = eventFor('through', 'goal', 'left');
    const d = buildDangerTimeline({ sides, attackSide: 'left', event, outcome: 'goal', prev: kickoffPositions(sides), sentOff: new Set([10, 13]), seed: 2 });
    expect(d.cast.map(c => c.slot)).not.toContain(10);
    expect(d.cast.map(c => c.slot)).not.toContain(13);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run shared/game/pitch/plays.test.ts`
Expected: FAIL (`./plays` não existe).

- [ ] **Step 3: Implementar `plays.ts`**

```ts
/**
 * Choreography of a danger, from the build-up to the aftermath, timed to the
 * three narration beats: build-up 0-1500 ms, attempt 1500-3000 ms (the ball
 * reaches its target exactly at 3000, when the outcome is revealed) and
 * aftermath 3000-4500 ms. Scripted in the attacker's frame (attacking towards
 * x = 105) and mirrored when the right team attacks.
 */
import type { MatchEvent, PlayKind, PlayShot } from '../engine/teamModel';
import { seededRandom } from '../random';
import {
  BALL_SLOT, GOAL_Y_MAX, GOAL_Y_MIN, PLAYERS_PER_SIDE, mirrorPoint, otherSide, roleOfSlot, shapeFor, slotBase, slotOfPlayer,
  type PitchSides, type Point, type Side,
} from './geometry';
import { createPositionBuffer, EASE_LINEAR, EASE_OUT, EASE_SMOOTH, mirrorBuffer, mirrorTimeline, TimelineBuilder, type Timeline } from './timeline';

export const STAGE_MS = 1500;
export const DANGER_MS = STAGE_MS * 3;
export const SHOT_ARRIVAL_MS = STAGE_MS * 2;

export type DangerOutcome = 'goal' | 'save' | 'miss';
export type CastRole = 'finisher' | 'creator' | 'defender' | 'goalkeeper';
export interface CastEntry { slot: number; role: CastRole }
export type BeatKind = 'net' | 'save' | 'post' | 'out';
export interface Beat { t: number; kind: BeatKind; x: number; y: number }

export interface DangerInput {
  sides: PitchSides;
  attackSide: Side;
  event: MatchEvent;
  outcome: DangerOutcome;
  prev: Float32Array;
  sentOff: ReadonlySet<number>;
  seed: number;
}

export interface DangerTimeline { timeline: Timeline; cast: CastEntry[]; beats: Beat[]; focus: Point; attackSide: Side }

export const DANGER_KINDS: readonly PlayKind[] = [
  'cross', 'through', 'dribble', 'longrange', 'counter',
  'corner', 'freekick', 'penalty',
  'own_goal', 'blunder', 'deflected', 'screamer', 'woodwork',
];

const FOOT = 0.9;
const WIDE_ROLES = ['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB', 'LB', 'RB'];
const PLAYMAKER_ROLES = ['CAM', 'CM', 'CDM', 'LM', 'RM'];

interface Shot {
  x: number; y: number; z: number;
  /** Contact time. */
  t: number;
  shot: PlayShot;
  /** Sideways bend of a curled shot, in metres. */
  curve?: number;
  /** The ball passes here first (a fumble, a deflection). */
  via?: { t: number; x: number; y: number; z: number; slot: number };
}

interface Ctx {
  b: TimelineBuilder;
  rng: () => number;
  sides: PitchSides;
  sentOff: ReadonlySet<number>;
  kind: PlayKind;
  outcome: DangerOutcome;
  shotKind: PlayShot | undefined;
  wing: 1 | -1;
  /** Touchline y on the chosen wing. */
  W: number;
  finisher: number;
  creator: number;
  defender: number;
  gk: number;
  atkBase: number;
  defBase: number;
  atkLive: number[];
  defLive: number[];
  scripted: Set<number>;
  beats: Beat[];
}

function move(c: Ctx, slot: number, t: number, x: number, y: number, z = 0, ease = EASE_SMOOTH as 0 | 1 | 2): void {
  c.b.key(slot, t, x, y, z, ease);
  c.scripted.add(slot);
}

function ball(c: Ctx, t: number, x: number, y: number, z = 0, ease = EASE_LINEAR as 0 | 1 | 2, arc = 0): void {
  c.b.key(BALL_SLOT, t, x, y, z, ease, arc);
}

/** The ball at the player's feet at each of the given times. */
function carry(c: Ctx, slot: number, times: number[]): void {
  for (const t of times) {
    const p = c.b.at(slot, t);
    ball(c, t, p.x + FOOT, p.y + 0.3);
  }
}

function jump(c: Ctx, slot: number, peak: number): void {
  const a = c.b.at(slot, peak - 180);
  const m = c.b.at(slot, peak);
  const z = c.b.at(slot, peak + 180);
  c.b.key(slot, peak - 180, a.x, a.y, 0, EASE_LINEAR);
  c.b.key(slot, peak, m.x, m.y, 0.8, EASE_OUT);
  c.b.key(slot, peak + 180, z.x, z.y, 0, EASE_SMOOTH);
}

// ── Build-ups. Each scripts the cast and the ball up to the contact and returns the shot. ──

function cross(c: Ctx): Shot {
  const wide = c.creator;
  move(c, wide, 450, 73, c.W);
  ball(c, 450, 73.9, c.W + 0.3, 0, EASE_OUT);
  move(c, wide, 1350, 86, c.W - c.wing * 1.2, 0, EASE_LINEAR);
  carry(c, wide, [750, 1050, 1350]);
  const near = c.rng() < 0.5;
  const H = { x: near ? 96.5 : 98.5, y: near ? (c.W < 34 ? 31 : 37) : (c.W < 34 ? 37.5 : 30.5) };
  ball(c, 1500, 86.9, c.W - c.wing * 1.2, 0.1);
  ball(c, 2350, H.x, H.y, 1.9, EASE_LINEAR, 5);
  move(c, c.finisher, 1300, 90, H.y + (H.y < 34 ? -5 : 5));
  move(c, c.finisher, 2300, H.x - 0.6, H.y);
  jump(c, c.finisher, 2370);
  move(c, c.defender, 1300, 92.5, H.y + (H.y < 34 ? -3 : 3));
  move(c, c.defender, 2300, H.x + 0.5, H.y + 0.6);
  jump(c, c.defender, 2370);
  return { x: H.x, y: H.y, z: 1.9, t: 2400, shot: 'header' };
}

function through(c: Ctx): Shot {
  const cy = 34 + (c.rng() - 0.5) * 16;
  move(c, c.creator, 500, 68, cy);
  ball(c, 500, 68.9, cy + 0.3, 0, EASE_OUT);
  const P = { x: 92, y: 34 + (c.rng() - 0.5) * 10 };
  move(c, c.finisher, 900, 84, P.y + (c.rng() - 0.5) * 6);
  ball(c, 900, 69.4, cy + 0.3);
  ball(c, 1500, P.x, P.y, 0, EASE_OUT);
  move(c, c.finisher, 1500, P.x - 0.8, P.y, 0, EASE_LINEAR);
  move(c, c.defender, 900, 86, P.y + 2);
  move(c, c.defender, 1500, P.x - 3, P.y + 1.5, 0, EASE_LINEAR);
  const S = { x: 96.5, y: 34 + (P.y - 34) * 0.5 };
  move(c, c.finisher, 2300, S.x - 0.8, S.y, 0, EASE_LINEAR);
  carry(c, c.finisher, [1900, 2300]);
  move(c, c.defender, 2300, S.x - 3.5, S.y + 1.2, 0, EASE_LINEAR);
  return { x: S.x, y: S.y, z: 0.2, t: 2400, shot: c.shotKind ?? 'one_on_one' };
}

function dribble(c: Ctx): Shot {
  const y0 = 34 + c.wing * (6 + c.rng() * 6);
  move(c, c.finisher, 600, 77, y0);
  ball(c, 600, 77.9, y0 + 0.3, 0, EASE_OUT);
  move(c, c.finisher, 1000, 82, y0 - c.wing * 3, 0, EASE_LINEAR);
  move(c, c.finisher, 1500, 87, y0 + c.wing, 0, EASE_LINEAR);
  carry(c, c.finisher, [800, 1000, 1250, 1500]);
  move(c, c.defender, 1000, 84.5, y0 - c.wing * 3);
  move(c, c.defender, 1250, 85.5, y0 - c.wing * 1.5, 0, EASE_OUT);
  move(c, c.defender, 1700, 85, y0 - c.wing * 3.5);
  const S = { x: 91.5, y: 34 + c.wing * 4 };
  move(c, c.finisher, 2200, S.x - 0.8, S.y, 0, EASE_LINEAR);
  carry(c, c.finisher, [1800, 2200]);
  return { x: S.x, y: S.y, z: 0.2, t: 2300, shot: c.shotKind ?? 'normal' };
}

function longrange(c: Ctx): Shot {
  const S = { x: 80, y: 34 + c.wing * (3 + c.rng() * 6) };
  move(c, c.creator, 700, 84, S.y - c.wing * 7);
  ball(c, 700, 84.9, S.y - c.wing * 7 + 0.3, 0, EASE_OUT);
  move(c, c.finisher, 1300, S.x - 2, S.y);
  ball(c, 1300, S.x - 1.2, S.y, 0, EASE_OUT);
  move(c, c.finisher, 1900, S.x - 0.8, S.y, 0, EASE_LINEAR);
  carry(c, c.finisher, [1600, 1900]);
  move(c, c.defender, 1900, S.x + 4, S.y - c.wing * 1.5);
  return { x: S.x, y: S.y, z: 0.2, t: 2000, shot: 'long_range' };
}

function counter(c: Ctx): Shot {
  const win = { x: 55, y: 34 + c.wing * 4 };
  move(c, c.creator, 300, win.x, win.y);
  ball(c, 300, win.x + 0.9, win.y + 0.3, 0, EASE_OUT);
  ball(c, 600, win.x + 1.3, win.y + 0.3);
  const R = { x: 74, y: 34 + c.wing * 14 };
  move(c, c.finisher, 1150, R.x, R.y, 0, EASE_LINEAR);
  ball(c, 1150, R.x + 0.9, R.y + 0.3, 0.4, EASE_OUT, 2.5);
  const S = { x: 93, y: 34 + c.wing * 5 };
  move(c, c.finisher, 2250, S.x - 0.8, S.y, 0, EASE_LINEAR);
  carry(c, c.finisher, [1500, 1900, 2250]);
  move(c, c.defender, 1150, R.x + 6, R.y - c.wing * 5);
  move(c, c.defender, 2250, S.x - 2.5, S.y - c.wing * 2, 0, EASE_LINEAR);
  return { x: S.x, y: S.y, z: 0.2, t: 2350, shot: c.shotKind ?? 'one_on_one' };
}

function corner(c: Ctx): Shot {
  const flagY = c.W < 34 ? 0.6 : 67.4;
  move(c, c.creator, 1000, 104.3, c.W < 34 ? 0.1 : 67.9);
  ball(c, 900, 104.2, flagY);
  const H = { x: 98 - c.rng() * 2, y: 34 + (c.rng() - 0.5) * 6 };
  move(c, c.finisher, 1300, 94, H.y + (c.rng() - 0.5) * 8);
  move(c, c.defender, 1300, 95, H.y + 1);
  ball(c, 1500, 104.2, flagY);
  ball(c, 2000, 101.5, flagY < 34 ? 18 : 50, 4.5, EASE_LINEAR, 1.5);
  ball(c, 2350, H.x, H.y, 2);
  move(c, c.finisher, 2300, H.x - 0.6, H.y);
  jump(c, c.finisher, 2370);
  move(c, c.defender, 2300, H.x + 0.5, H.y + 0.7);
  jump(c, c.defender, 2370);
  return { x: H.x, y: H.y, z: 2, t: 2400, shot: 'header' };
}

function freekick(c: Ctx): Shot {
  const FK = { x: 79 + c.rng() * 4, y: 34 + c.wing * (4 + c.rng() * 8) };
  ball(c, 900, FK.x, FK.y);
  move(c, c.finisher, 1000, FK.x - 2.2, FK.y - c.wing * 0.8);
  // The wall: four defenders 9.15 m from the ball, across the line to the goal.
  const len = Math.hypot(105 - FK.x, 34 - FK.y);
  const dir = { x: (105 - FK.x) / len, y: (34 - FK.y) / len };
  const centre = { x: FK.x + dir.x * 9.15, y: FK.y + dir.y * 9.15 };
  const wall = c.defLive.filter(s => s !== c.gk && s !== c.defender && roleOfSlot(c.sides, s) !== 'GK').slice(0, 4);
  wall.forEach((s, i) => {
    const off = (i - (wall.length - 1) / 2) * 0.9;
    move(c, s, 1200, centre.x - dir.y * off, centre.y + dir.x * off);
    move(c, s, 2150, centre.x - dir.y * off, centre.y + dir.x * off, 0, EASE_LINEAR);
    jump(c, s, 2350);
  });
  move(c, c.defender, 1200, centre.x + 2, centre.y - c.wing * 4);
  move(c, c.finisher, 1500, FK.x - 2.2, FK.y - c.wing * 0.8, 0, EASE_LINEAR);
  move(c, c.finisher, 2150, FK.x - 0.5, FK.y, 0, EASE_LINEAR);
  return { x: FK.x, y: FK.y, z: 0.1, t: 2200, shot: 'normal', curve: -c.wing * 2.2 };
}

function penalty(c: Ctx): Shot {
  ball(c, 1000, 94, 34);
  move(c, c.finisher, 1200, 91.2, 34 + c.wing * 0.6);
  move(c, c.gk, 1200, 104.6, 34);
  move(c, c.finisher, 1500, 91.2, 34 + c.wing * 0.6, 0, EASE_LINEAR);
  move(c, c.finisher, 2350, 93.4, 34, 0, EASE_LINEAR);
  return { x: 94, y: 34, z: 0.1, t: 2400, shot: 'normal' };
}

function ownGoal(c: Ctx): Shot {
  const h = cross(c);
  // The defender gets there first and turns it into his own net.
  move(c, c.defender, 2300, h.x + 0.2, h.y);
  return { ...h, x: h.x + 0.6 };
}

function blunder(c: Ctx): Shot {
  const s = dribble(c);
  const gy = 34 + (s.y - 34) * 0.3;
  return { ...s, shot: 'normal', via: { t: 2750, x: 103.6, y: gy, z: 0.25, slot: c.gk } };
}

function deflected(c: Ctx): Shot {
  const s = longrange(c);
  const via = { t: s.t + 350, x: s.x + 8, y: s.y + (34 - s.y) * 0.3, z: 0.7, slot: c.defender };
  move(c, c.defender, via.t - 50, via.x + 0.3, via.y);
  return { ...s, shot: 'normal', via };
}

function screamer(c: Ctx): Shot {
  const S = { x: 73 + c.rng() * 4, y: 34 + c.wing * c.rng() * 8 };
  move(c, c.finisher, 1500, S.x - 1.5, S.y);
  ball(c, 1200, S.x - 0.6, S.y + 0.3, 0, EASE_OUT);
  move(c, c.finisher, 1950, S.x - 0.8, S.y, 0, EASE_LINEAR);
  carry(c, c.finisher, [1500, 1950]);
  move(c, c.defender, 1950, S.x + 5, S.y);
  return { x: S.x, y: S.y, z: 0.2, t: 2050, shot: 'long_range' };
}

function woodwork(c: Ctx): Shot {
  return c.rng() < 0.5 ? longrange(c) : dribble(c);
}

const SCRIPTS: Record<PlayKind, (c: Ctx) => Shot> = {
  cross, through, dribble, longrange, counter, corner, freekick, penalty,
  own_goal: ownGoal, blunder, deflected, screamer, woodwork,
};

// ── The shot, the keeper and the outcome. ──

function finishShot(c: Ctx, s: Shot): Point {
  const contactX = s.x + (s.shot === 'header' ? 0.3 : FOOT);
  ball(c, s.t, contactX, s.y, s.z);
  const far = c.rng() < 0.55;
  const goalY = far ? (s.y < 34 ? 36.6 : 31.4) : (s.y < 34 ? 31.4 : 36.6);
  const arc = s.shot === 'header' ? 0.3 : s.shot === 'long_range' ? 1.1 : 0.5;
  let from = { x: contactX, y: s.y, z: s.z, t: s.t };
  if (s.via) {
    ball(c, s.via.t, s.via.x, s.via.y, s.via.z, EASE_LINEAR, 0.3);
    from = s.via;
  }
  if (s.curve) {
    const mid = (from.t + SHOT_ARRIVAL_MS) / 2;
    ball(c, mid, (from.x + 105) / 2, (from.y + goalY) / 2 + s.curve, 2.4);
  }
  // The keeper sets himself on the line, facing the shot.
  move(c, c.gk, s.t, 103.8, 34 + (s.y - 34) * 0.25);
  const result = c.kind === 'woodwork' ? 'post' : c.outcome;
  let target: Point;
  if (result === 'goal') {
    const z = 0.3 + c.rng() * 1.7;
    target = { x: 105.4, y: goalY };
    ball(c, SHOT_ARRIVAL_MS, target.x, target.y, z, EASE_LINEAR, s.curve ? 0 : arc);
    ball(c, SHOT_ARRIVAL_MS + 250, 106.8, goalY, Math.max(0.15, z - 0.4), EASE_OUT);
    if (s.via?.slot === c.gk) {
      move(c, c.gk, s.via.t, s.via.x + 0.3, s.via.y, 0.2, EASE_OUT);
    } else {
      move(c, c.gk, SHOT_ARRIVAL_MS + 60, 104.2, goalY + (goalY < 34 ? 1.7 : -1.7), 0.5, EASE_OUT);
    }
    c.beats.push({ t: SHOT_ARRIVAL_MS, kind: 'net', x: 105, y: goalY });
  } else if (result === 'save') {
    target = { x: 104.1, y: goalY };
    ball(c, SHOT_ARRIVAL_MS, target.x, target.y, 0.9, EASE_LINEAR, s.curve ? 0 : arc);
    move(c, c.gk, SHOT_ARRIVAL_MS, target.x, target.y, 0.5, EASE_OUT);
    if (c.rng() < 0.5) {
      ball(c, SHOT_ARRIVAL_MS + 500, 107, goalY < 34 ? 24 : 44, 0.3, EASE_OUT, 1);
      c.beats.push({ t: SHOT_ARRIVAL_MS + 500, kind: 'out', x: 105, y: goalY < 34 ? 24 : 44 });
    } else {
      ball(c, SHOT_ARRIVAL_MS + 300, target.x - 0.4, target.y, 0.6, EASE_OUT);
      move(c, c.gk, SHOT_ARRIVAL_MS + 300, target.x - 0.4, target.y, 0, EASE_OUT);
    }
    c.beats.push({ t: SHOT_ARRIVAL_MS, kind: 'save', x: target.x, y: target.y });
  } else if (result === 'post') {
    const postY = goalY < 34 ? GOAL_Y_MIN : GOAL_Y_MAX;
    target = { x: 105, y: postY };
    ball(c, SHOT_ARRIVAL_MS, 105, postY, 1.3, EASE_LINEAR, arc);
    ball(c, SHOT_ARRIVAL_MS + 500, 96, postY + (postY < 34 ? -5 : 5), 0.4, EASE_OUT, 0.8);
    move(c, c.gk, SHOT_ARRIVAL_MS, 104.2, 34 + (postY - 34) * 0.6, 0.4, EASE_OUT);
    c.beats.push({ t: SHOT_ARRIVAL_MS, kind: 'post', x: 105, y: postY });
  } else {
    const over = c.rng() < 0.5;
    target = over
      ? { x: 106, y: 34 + (c.rng() - 0.5) * 5 }
      : { x: 106, y: goalY < 34 ? GOAL_Y_MIN - 1.4 : GOAL_Y_MAX + 1.4 };
    const z = over ? 3.1 : 0.6;
    ball(c, SHOT_ARRIVAL_MS, target.x, target.y, z, EASE_LINEAR, s.curve ? 0 : arc);
    ball(c, SHOT_ARRIVAL_MS + 500, 110, target.y + (target.y - s.y) * 0.15, z * 0.6, EASE_OUT);
    move(c, c.gk, SHOT_ARRIVAL_MS, 104, 34 + (target.y - 34) * 0.25);
    c.beats.push({ t: SHOT_ARRIVAL_MS, kind: 'out', x: 105, y: target.y });
  }
  return target;
}

// ── Everyone else. ──

type SupportMode = 'open' | 'box' | 'penalty';
const supportMode = (kind: PlayKind): SupportMode =>
  kind === 'penalty' ? 'penalty' : kind === 'corner' || kind === 'freekick' ? 'box' : 'open';

function support(c: Ctx, shot: Shot, atkFormation: string, defFormation: string): void {
  const mode = supportMode(c.kind);
  const free = (slots: number[]) => slots.filter(s => !c.scripted.has(s));
  const atkFree = free(c.atkLive);
  const defFree = free(c.defLive);
  const place = (slot: number, x: number, y: number) => {
    move(c, slot, 1300, x, y);
    move(c, slot, SHOT_ARRIVAL_MS, x + (c.rng() - 0.5), y + (c.rng() - 0.5), 0, EASE_LINEAR);
  };
  const isKeeper = (s: number) => roleOfSlot(c.sides, s) === 'GK';
  if (mode === 'penalty') {
    const all = [...atkFree, ...defFree].filter(s => !isKeeper(s));
    all.forEach((s, i) => place(s, 85.2 + (i % 2) * 0.8, 21 + (i * 26) / Math.max(1, all.length - 1)));
    atkFree.filter(isKeeper).forEach(s => place(s, 30, 34));
    return;
  }
  const atkShape = shapeFor('left', atkFormation, { advance: mode === 'box' ? 22 : 28, widthScale: 1 });
  const defShape = shapeFor('right', defFormation, { advance: -8, widthScale: 0.78 });
  const boxSpots = [{ x: 95, y: 30 }, { x: 96, y: 38 }, { x: 92, y: 34 }, { x: 98, y: 35.5 }];
  const inBox: number[] = [];
  if (mode === 'box') {
    const priority = ['CB', 'ST', 'CF', 'CDM', 'CM'];
    const rank = (slot: number) => {
      const i = priority.indexOf(roleOfSlot(c.sides, slot));
      return i < 0 ? priority.length : i;
    };
    const ranked = atkFree.filter(s => !isKeeper(s)).sort((a, b) => rank(a) - rank(b));
    ranked.slice(0, boxSpots.length).forEach((s, i) => {
      place(s, boxSpots[i].x + (c.rng() - 0.5) * 2, boxSpots[i].y + (c.rng() - 0.5) * 2);
      inBox.push(s);
    });
  }
  for (const s of atkFree) {
    if (inBox.includes(s)) continue;
    const p = atkShape[s - c.atkBase];
    place(s, p.x, p.y);
  }
  const markers = [...defFree].filter(s => !isKeeper(s));
  inBox.forEach((attacker, i) => {
    const m = markers[i];
    if (m === undefined) return;
    const target = c.b.at(attacker, 1300);
    place(m, target.x + 1, target.y + 0.6);
  });
  for (const s of defFree) {
    if (c.scripted.has(s)) continue;
    const p = defShape[s - c.defBase];
    place(s, p.x, p.y + (shot.y - 34) * 0.25);
  }
}

function aftermath(c: Ctx): void {
  const end = DANGER_MS;
  if (c.outcome === 'goal') {
    const hero = c.kind === 'own_goal' ? c.creator : c.finisher;
    const flag = { x: 99, y: c.W < 34 ? 6 : 62 };
    move(c, hero, end, flag.x, flag.y);
    const heroAt = c.b.at(hero, SHOT_ARRIVAL_MS);
    c.atkLive
      .filter(s => s !== hero && roleOfSlot(c.sides, s) !== 'GK')
      .map(s => ({ s, d: Math.hypot(c.b.at(s, SHOT_ARRIVAL_MS).x - heroAt.x, c.b.at(s, SHOT_ARRIVAL_MS).y - heroAt.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ s }, i) => move(c, s, end, flag.x - 3 - i * 1.5, flag.y + (flag.y < 34 ? 2 + i : -2 - i)));
  }
  for (let s = 0; s < BALL_SLOT; s++) {
    if (c.sentOff.has(s) || c.b.lastTime(s) >= end) continue;
    const p = c.b.at(s, SHOT_ARRIVAL_MS);
    c.b.key(s, end, p.x + (52.5 - p.x) * 0.04, p.y, 0, EASE_SMOOTH);
  }
}

// ── Entry point. ──

function liveSlots(base: number, sentOff: ReadonlySet<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < PLAYERS_PER_SIDE; i++) if (!sentOff.has(base + i)) out.push(base + i);
  return out;
}

function pickByRole(sides: PitchSides, live: number[], roles: string[], exclude: number[]): number {
  for (const role of roles) {
    const s = live.find(slot => !exclude.includes(slot) && roleOfSlot(sides, slot) === role);
    if (s !== undefined) return s;
  }
  return live.find(s => !exclude.includes(s) && roleOfSlot(sides, s) !== 'GK') ?? live[0];
}

export function buildDangerTimeline(input: DangerInput): DangerTimeline {
  const { sides, attackSide, event, outcome, sentOff } = input;
  const mirror = attackSide === 'right';
  const start = createPositionBuffer();
  if (mirror) mirrorBuffer(input.prev, start); else start.set(input.prev);

  const defendSide = otherSide(attackSide);
  const atkBase = slotBase(attackSide);
  const defBase = slotBase(defendSide);
  const atkLive = liveSlots(atkBase, sentOff);
  const defLive = liveSlots(defBase, sentOff);
  const play = event.play;
  const kind: PlayKind = play?.kind ?? (outcome === 'goal' && !event.playerId ? 'own_goal' : 'through');
  const rng = seededRandom(input.seed);
  const valid = (slot: number, live: number[]) => (slot >= 0 && live.includes(slot) ? slot : -1);

  let finisher = valid(slotOfPlayer(sides, play?.attackerId ?? (outcome === 'save' ? event.opponentId : event.playerId)), atkLive);
  if (finisher < 0) finisher = pickByRole(sides, atkLive, ['ST', 'CF', 'LW', 'RW', 'CAM'], []);
  let gk = valid(slotOfPlayer(sides, play?.goalkeeperId), defLive);
  if (gk < 0) gk = pickByRole(sides, defLive, ['GK'], []);
  let defender = valid(slotOfPlayer(sides, play?.defenderId ?? (kind === 'own_goal' ? event.opponentId : undefined)), defLive);
  if (defender < 0 || defender === gk) defender = pickByRole(sides, defLive, ['CB', 'LB', 'RB', 'CDM'], [gk]);
  let creator = valid(slotOfPlayer(sides, play?.wideId ?? play?.creatorId), atkLive);
  if (creator < 0 || creator === finisher || roleOfSlot(sides, creator) === 'GK') {
    const roles = kind === 'cross' || kind === 'corner' || kind === 'own_goal' ? WIDE_ROLES : PLAYMAKER_ROLES;
    creator = pickByRole(sides, atkLive, roles, [finisher]);
  }

  const creatorY = start[creator * 3 + 1];
  const wing: 1 | -1 = kind === 'cross' || kind === 'own_goal'
    ? (creatorY >= 34 ? 1 : -1)
    : (rng() < 0.5 ? -1 : 1);
  const c: Ctx = {
    b: new TimelineBuilder(start), rng, sides, sentOff, kind, outcome, shotKind: play?.shot,
    wing, W: wing < 0 ? 5 : 63,
    finisher, creator, defender, gk, atkBase, defBase, atkLive, defLive,
    scripted: new Set<number>(), beats: [],
  };

  const shot = SCRIPTS[kind](c);
  finishShot(c, shot);
  support(c, shot, sides[attackSide].formationId, sides[defendSide].formationId);
  aftermath(c);

  const usesCreator = kind === 'cross' || kind === 'through' || kind === 'longrange' || kind === 'counter' || kind === 'corner' || kind === 'own_goal' || kind === 'deflected';
  const cast: CastEntry[] = [{ slot: kind === 'own_goal' ? defender : finisher, role: 'finisher' }];
  if (usesCreator) cast.push({ slot: creator, role: 'creator' });
  if (kind !== 'own_goal' && kind !== 'penalty') cast.push({ slot: defender, role: 'defender' });
  cast.push({ slot: gk, role: 'goalkeeper' });
  const seen = new Set<number>();
  const uniqueCast = cast.filter(entry => (seen.has(entry.slot) ? false : (seen.add(entry.slot), true))).slice(0, 4);

  let timeline = c.b.build(DANGER_MS);
  let focus: Point = { x: (shot.x + 105) / 2, y: (shot.y + 34) / 2 };
  let beats = c.beats;
  if (mirror) {
    timeline = mirrorTimeline(timeline);
    focus = mirrorPoint(focus);
    beats = beats.map(beat => ({ ...beat, ...mirrorPoint(beat) }));
  }
  return { timeline, cast: uniqueCast, beats, focus, attackSide };
}
```

- [ ] **Step 4: Rodar**

Run: `pnpm exec vitest run shared/game/pitch/plays.test.ts`
Expected: PASS em todos os casos (13 tipos × desfechos × 2 lados + 2 testes extras). Se algum caso falhar nos limites, ajustar só a coordenada do roteiro daquele tipo, sem afrouxar o teste.

- [ ] **Step 5: Checkpoint** — teste passando; typecheck limpo.

---

### Task 6: Marcadores rápidos e disputa de pênaltis

**Files:**
- Create: `shared/game/pitch/cues.ts`
- Create: `shared/game/pitch/shootout.ts`
- Create: `shared/game/pitch/index.ts`
- Test: `shared/game/pitch/cues-shootout.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 5 (`CastEntry`, `Beat`).
- Produces:
  - `type CueKind = 'foul' | 'yellow' | 'red' | 'injury' | 'tactic' | 'corner' | 'duel' | 'shot'`; `interface Cue { kind: CueKind; slots: number[]; label?: string; side: Side | null; durationMs: number }`; `CUE_MS = 1100`; `quickEventCue(event, sides): Cue | null`.
  - `SHOOTOUT_BUILDUP_MS = 1900`, `SHOOTOUT_HOLD_MS = 1700`, `SHOOTOUT_KICK_MS = 3600`; `type ShootoutMiss = 'save' | 'miss'`; `shootoutMissKind(kickIndex): ShootoutMiss`; `shootoutLineup(sides): Float32Array`; `interface ShootoutKickInput { sides: PitchSides; prev: Float32Array; takerSlot: number; goalkeeperSlot: number; isGoal: boolean; kickIndex: number; seed: number }`; `buildShootoutKick(input): { timeline: Timeline; cast: CastEntry[]; beats: Beat[]; focus: Point }`.
  - `shared/game/pitch/index.ts` reexporta tudo de `geometry`, `timeline`, `flow`, `plays`, `cues`, `shootout`.

- [ ] **Step 1: Escrever o teste**

Criar `shared/game/pitch/cues-shootout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../engine/teamModel';
import { BALL_SLOT, GOAL_HEIGHT, GOAL_Y_MAX, GOAL_Y_MIN, type PitchSides } from './geometry';
import { quickEventCue } from './cues';
import { buildShootoutKick, shootoutLineup, shootoutMissKind, SHOOTOUT_BUILDUP_MS, SHOOTOUT_KICK_MS } from './shootout';
import { createPositionBuffer, sampleTimeline } from './timeline';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };
const ev = (e: Partial<MatchEvent>): MatchEvent => ({ minute: 30, type: 'foul', description: '', teamId: 'L', ...e });

describe('marcadores rápidos', () => {
  it('falta destaca infrator e vítima', () => {
    expect(quickEventCue(ev({ type: 'foul', playerId: 'L4', opponentId: 'R9' }), sides)).toMatchObject({ kind: 'foul', slots: [4, 20], side: 'left' });
  });
  it('cartões, lesão e tática', () => {
    expect(quickEventCue(ev({ type: 'yellow', playerId: 'R3', teamId: 'R' }), sides)?.slots).toEqual([14]);
    expect(quickEventCue(ev({ type: 'red', playerId: 'L5' }), sides)?.kind).toBe('red');
    expect(quickEventCue(ev({ type: 'injury', playerId: 'L6' }), sides)?.kind).toBe('injury');
    expect(quickEventCue(ev({ type: 'tactic', tacticAction: 'high_press' }), sides)?.label?.length).toBeGreaterThan(2);
  });
  it('eventos sem marcador', () => {
    expect(quickEventCue(ev({ type: 'momentum' }), sides)).toBeNull();
    expect(quickEventCue(ev({ type: 'stat', statDelta: {} }), sides)).toBeNull();
  });
});

describe('disputa de pênaltis', () => {
  it('alterna defesa e chute para fora como a narração', () => {
    expect([0, 1, 2, 3].map(shootoutMissKind)).toEqual(['save', 'miss', 'save', 'miss']);
  });

  for (const [isGoal, kickIndex] of [[true, 0], [false, 0], [false, 1]] as const) {
    it(`cobrança ${isGoal ? 'convertida' : shootoutMissKind(kickIndex)}`, () => {
      const prev = shootoutLineup(sides);
      const k = buildShootoutKick({ sides, prev, takerSlot: 20, goalkeeperSlot: 0, isGoal, kickIndex, seed: 5 });
      const out = createPositionBuffer();
      sampleTimeline(k.timeline, SHOOTOUT_BUILDUP_MS, out);
      const x = out[BALL_SLOT * 3], y = out[BALL_SLOT * 3 + 1], z = out[BALL_SLOT * 3 + 2];
      if (isGoal) {
        expect(x).toBeGreaterThanOrEqual(105);
        expect(y).toBeGreaterThan(GOAL_Y_MIN);
        expect(y).toBeLessThan(GOAL_Y_MAX);
        expect(z).toBeLessThan(GOAL_HEIGHT);
      } else if (shootoutMissKind(kickIndex) === 'save') {
        expect(Math.hypot(x - out[0], y - out[1])).toBeLessThan(1.5);
      } else {
        expect(y < GOAL_Y_MIN || y > GOAL_Y_MAX || z > GOAL_HEIGHT).toBe(true);
      }
      expect(k.timeline.duration).toBe(SHOOTOUT_KICK_MS);
      expect(k.cast.map(c => c.slot)).toEqual([20, 0]);
    });
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run shared/game/pitch/cues-shootout.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar `cues.ts`**

```ts
/** One-second markers for the quick events of open play. */
import type { MatchEvent } from '../engine/teamModel';
import { getTacticById } from '../gameData';
import { sideOfTeam, slotOfPlayer, type PitchSides, type Side } from './geometry';

export type CueKind = 'foul' | 'yellow' | 'red' | 'injury' | 'tactic' | 'corner' | 'duel' | 'shot';
export interface Cue { kind: CueKind; slots: number[]; label?: string; side: Side | null; durationMs: number }
export const CUE_MS = 1100;

export function quickEventCue(event: MatchEvent, sides: PitchSides): Cue | null {
  const side = sideOfTeam(sides, event.teamId);
  const slots = (...ids: (string | undefined)[]) => ids.map(id => slotOfPlayer(sides, id)).filter(s => s >= 0);
  const cue = (kind: CueKind, list: number[], label?: string, durationMs = CUE_MS): Cue => ({ kind, slots: list, label, side, durationMs });
  switch (event.type) {
    case 'foul': return cue('foul', slots(event.playerId, event.opponentId), 'FALTA');
    case 'yellow': return cue('yellow', slots(event.playerId), 'AMARELO');
    case 'red': return cue('red', slots(event.playerId), 'EXPULSO');
    case 'injury': return cue('injury', slots(event.playerId), 'LESÃO');
    case 'corner': return cue('corner', [], 'ESCANTEIO');
    case 'duel': return cue('duel', slots(event.playerId, event.opponentId), 'DESARME');
    case 'tactic': return event.tacticAction ? cue('tactic', [], getTacticById(event.tacticAction).name.toUpperCase(), 1600) : null;
    case 'stat': {
      const shots = (event.statDelta?.homeShots ?? 0) + (event.statDelta?.awayShots ?? 0);
      return shots > 0 ? cue('shot', [], 'FINALIZAÇÃO') : null;
    }
    default: return null;
  }
}
```

- [ ] **Step 4: Implementar `shootout.ts`**

```ts
/** A penalty-shootout kick on the right-hand goal: walk-up, run-up, the shot at
 * 1.9 s (the narration's reveal) and the walk back. */
import { seededRandom } from '../random';
import { BALL_SLOT, GOAL_Y_MAX, GOAL_Y_MIN, PLAYERS_PER_SIDE, SIDES, slotBase, type PitchSides, type Point } from './geometry';
import type { Beat, CastEntry } from './plays';
import { createPositionBuffer, EASE_LINEAR, EASE_OUT, TimelineBuilder, type Timeline } from './timeline';

export const SHOOTOUT_BUILDUP_MS = 1900;
export const SHOOTOUT_HOLD_MS = 1700;
export const SHOOTOUT_KICK_MS = SHOOTOUT_BUILDUP_MS + SHOOTOUT_HOLD_MS;

export type ShootoutMiss = 'save' | 'miss';
/** Same rule the screen narration uses, so the picture and the words agree. */
export function shootoutMissKind(kickIndex: number): ShootoutMiss {
  return kickIndex % 2 === 0 ? 'save' : 'miss';
}

/** Both teams lined up at the centre circle, the ball on the spot. */
export function shootoutLineup(sides: PitchSides): Float32Array {
  const out = createPositionBuffer();
  for (const side of SIDES) {
    const base = slotBase(side);
    for (let i = 0; i < PLAYERS_PER_SIDE; i++) {
      out[(base + i) * 3] = side === 'left' ? 50.5 : 54.5;
      out[(base + i) * 3 + 1] = 23 + i * 2.2;
    }
  }
  out[BALL_SLOT * 3] = 94;
  out[BALL_SLOT * 3 + 1] = 34;
  void sides;
  return out;
}

export interface ShootoutKickInput {
  sides: PitchSides;
  prev: Float32Array;
  takerSlot: number;
  goalkeeperSlot: number;
  isGoal: boolean;
  kickIndex: number;
  seed: number;
}

export function buildShootoutKick(input: ShootoutKickInput): { timeline: Timeline; cast: CastEntry[]; beats: Beat[]; focus: Point } {
  const rng = seededRandom(input.seed);
  const b = new TimelineBuilder(input.prev);
  const lineup = shootoutLineup(input.sides);
  const { takerSlot: taker, goalkeeperSlot: gk } = input;
  for (let s = 0; s < BALL_SLOT; s++) {
    if (s === taker || s === gk) continue;
    b.key(s, 700, lineup[s * 3], lineup[s * 3 + 1]);
  }
  b.key(BALL_SLOT, 600, 94, 34);
  b.key(taker, 700, 91.3, 34.4);
  b.key(gk, 700, 104.7, 34);
  b.key(taker, 1300, 91.3, 34.4, 0, EASE_LINEAR);
  b.key(taker, 1800, 93.5, 34, 0, EASE_LINEAR);
  b.key(BALL_SLOT, 1800, 94, 34);

  const left = rng() < 0.5;
  const goalY = left ? 31.3 : 36.7;
  const beats: Beat[] = [];
  const T = SHOOTOUT_BUILDUP_MS;
  if (input.isGoal) {
    const z = 0.2 + rng() * 1.6;
    b.key(BALL_SLOT, T, 105.4, goalY, z, EASE_LINEAR, 0.3);
    b.key(BALL_SLOT, T + 250, 106.8, goalY, Math.max(0.15, z - 0.4), EASE_OUT);
    const wrongWay = rng() < 0.6;
    const diveY = wrongWay ? 68 - goalY : goalY + (goalY < 34 ? 1.8 : -1.8);
    b.key(gk, T + 60, 104.3, diveY, 0.5, EASE_OUT);
    beats.push({ t: T, kind: 'net', x: 105, y: goalY });
  } else if (shootoutMissKind(input.kickIndex) === 'save') {
    b.key(BALL_SLOT, T, 104.2, goalY, 0.8, EASE_LINEAR, 0.3);
    b.key(gk, T, 104.2, goalY, 0.5, EASE_OUT);
    b.key(BALL_SLOT, T + 500, 107, goalY < 34 ? 25 : 43, 0.3, EASE_OUT, 1);
    beats.push({ t: T, kind: 'save', x: 104.2, y: goalY });
  } else {
    const over = rng() < 0.5;
    const y = over ? 34 + (rng() - 0.5) * 4 : left ? GOAL_Y_MIN - 1.2 : GOAL_Y_MAX + 1.2;
    const z = over ? 3.2 : 0.6;
    b.key(BALL_SLOT, T, 106, y, z, EASE_LINEAR, 0.4);
    b.key(BALL_SLOT, T + 500, 111, y, z * 0.6, EASE_OUT);
    b.key(gk, T + 60, 104.3, goalY, 0.5, EASE_OUT);
    beats.push({ t: T, kind: 'out', x: 105, y });
  }
  b.key(gk, SHOOTOUT_KICK_MS, 104.7, 34);
  b.key(taker, SHOOTOUT_KICK_MS, lineup[taker * 3], lineup[taker * 3 + 1]);
  return {
    timeline: b.build(SHOOTOUT_KICK_MS),
    cast: [{ slot: taker, role: 'finisher' }, { slot: gk, role: 'goalkeeper' }],
    beats,
    focus: { x: 96, y: 34 },
  };
}
```

- [ ] **Step 5: Criar `index.ts`**

```ts
export * from './geometry';
export * from './timeline';
export * from './flow';
export * from './plays';
export * from './cues';
export * from './shootout';
```

- [ ] **Step 6: Rodar todos os testes do diretor**

Run: `pnpm exec vitest run shared/game/pitch`
Expected: PASS (timeline, flow, plays, cues-shootout).

- [ ] **Step 7: Checkpoint** — testes passando; typecheck limpo.

---

### Task 7: `PitchDirector` — relógio, segmentos e estado para a tela

**Files:**
- Create: `client/src/components/game/pitch/PitchDirector.ts`
- Create: `client/src/components/game/pitch/sides.ts`
- Test: `client/src/components/game/pitch/PitchDirector.test.ts`

**Interfaces:**
- Consumes: tudo de `@shared/game/pitch`; `seedFromString` de `@shared/game/random`; `MatchEvent`, `PenaltyKick`, `Team` de `@shared/game/engine/teamModel`.
- Produces:
  - `buildPitchSides(left: Team, right: Team): PitchSides` (em `sides.ts`)
  - `type PitchMode = 'flow' | 'danger' | 'shootout' | 'idle'`
  - `interface PitchSnapshot { mode: PitchMode; cast: CastEntry[]; cue: (Cue & { id: number }) | null; beat: (Beat & { id: number }) | null; sentOff: ReadonlySet<number>; injured: ReadonlySet<number>; focus: Point | null; threat: { side: Side; stage: number } | null; tactic: (Cue & { id: number }) | null }`
  - `class PitchDirector` com: `constructor(sides: PitchSides, matchKey: string, clock?: () => number)`, `readonly sides`, `subscribe(listener): () => void`, `getSnapshot(): PitchSnapshot`, `sample(): Float32Array`, `setPaused(paused: boolean)`, `onMinute(minute: number, events: MatchEvent[], momentum: number, tactics: { left: string; right: string }, durationMs: number)`, `startDanger(event: MatchEvent, eventIndex: number, outcome: DangerOutcome)`, `syncStage(stage: number, consumedInStageMs: number)`, `endDanger(goalScoredBy: Side | null)`, `startShootout()`, `shootoutKick(kick: PenaltyKick, kickIndex: number, ids: { takerId?: string; gkId?: string })`, `skipToEnd(shootout: boolean)`.

- [ ] **Step 1: Escrever o teste**

Criar `client/src/components/game/pitch/PitchDirector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '@shared/game/engine/teamModel';
import { BALL_SLOT, STAGE_MS, type PitchSides } from '@shared/game/pitch';
import { PitchDirector } from './PitchDirector';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };
const tactics = { left: 'balanced', right: 'balanced' };

function setup() {
  let now = 0;
  const director = new PitchDirector(sides, 'teste', () => now);
  return { director, advance: (ms: number) => { now += ms; } };
}

const goal: MatchEvent = { minute: 20, type: 'goal', description: '', teamId: 'L', playerId: 'L10',
  play: { kind: 'through', shot: 'one_on_one', attackerId: 'L10', creatorId: 'L6', defenderId: 'R2', goalkeeperId: 'R0' } };

describe('PitchDirector', () => {
  it('pausa congela tudo', () => {
    const { director, advance } = setup();
    director.startDanger(goal, 3, 'goal');
    advance(700);
    const before = Array.from(director.sample());
    director.setPaused(true);
    advance(5000);
    expect(Array.from(director.sample())).toEqual(before);
    director.setPaused(false);
    advance(10);
    expect(Array.from(director.sample())).not.toEqual(before);
  });

  it('syncStage alinha o lance com a narração', () => {
    const { director, advance } = setup();
    director.startDanger(goal, 3, 'goal');
    advance(200);
    director.syncStage(3, 0); // the narration is already at the reveal
    const pos = director.sample();
    expect(pos[BALL_SLOT * 3]).toBeGreaterThanOrEqual(105); // the ball is in the net at 3000 ms
    expect(director.getSnapshot().threat?.stage).toBe(3);
    void STAGE_MS;
  });

  it('lance perigoso mostra protagonistas e volta ao jogo corrido com saída de bola', () => {
    const { director, advance } = setup();
    director.startDanger(goal, 3, 'goal');
    const snap = director.getSnapshot();
    expect(snap.mode).toBe('danger');
    expect(snap.cast.length).toBeGreaterThan(1);
    expect(snap.focus).not.toBeNull();
    advance(4600);
    director.endDanger('left');
    expect(director.getSnapshot().mode).toBe('flow');
    expect(director.getSnapshot().cast).toEqual([]);
    advance(1200);
    const pos = director.sample();
    expect(pos[BALL_SLOT * 3]).toBeCloseTo(52.5, 0);
  });

  it('expulsão e lesão ficam registradas', () => {
    const { director } = setup();
    director.onMinute(30, [
      { minute: 30, type: 'red', description: '', teamId: 'R', playerId: 'R4' },
      { minute: 30, type: 'injury', description: '', teamId: 'L', playerId: 'L2' },
    ], 50, tactics, 222);
    const snap = director.getSnapshot();
    expect(snap.sentOff.has(15)).toBe(true);
    expect(snap.injured.has(2)).toBe(true);
    expect(snap.cue?.kind).toBe('injury');
  });

  it('mudança de tática aparece como selo próprio', () => {
    const { director } = setup();
    director.onMinute(60, [{ minute: 60, type: 'tactic', description: '', teamId: 'R', tacticAction: 'defensive' }], 50, tactics, 222);
    expect(director.getSnapshot().tactic?.label?.length).toBeGreaterThan(2);
  });

  it('o mesmo jogo gera as mesmas posições', () => {
    const run = () => {
      const { director, advance } = setup();
      for (let m = 1; m <= 15; m++) {
        director.onMinute(m, [{ minute: m, type: 'momentum', description: '', teamId: m % 2 ? 'L' : 'R', playerId: m % 2 ? 'L6' : 'R6' }], 40 + m, tactics, 222);
        advance(222);
      }
      return Array.from(director.sample());
    };
    expect(run()).toEqual(run());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run client/src/components/game/pitch/PitchDirector.test.ts`
Expected: FAIL (`./PitchDirector` não existe).

- [ ] **Step 3: Implementar `sides.ts`**

```ts
import type { Team } from '@shared/game/engine/teamModel';
import type { PitchSides } from '@shared/game/pitch';

/** The left side is always the viewer's team, attacking to the right of the screen. */
export function buildPitchSides(left: Team, right: Team): PitchSides {
  const squad = (team: Team) => ({ teamId: team.id, playerIds: team.players.slice(0, 11).map(p => p.id), formationId: team.formationId });
  return { left: squad(left), right: squad(right) };
}
```

- [ ] **Step 4: Implementar `PitchDirector.ts`**

```ts
/**
 * Plays the pitch timelines in step with the match screen. It owns no game
 * state: the page tells it what happened (a minute's events, a danger and its
 * narration stage, a shootout kick) and it decides what the 22 players and the
 * ball do. The live pitch reads positions with sample() every frame and
 * re-renders only when the snapshot changes.
 */
import type { MatchEvent, PenaltyKick } from '@shared/game/engine/teamModel';
import {
  BALL_SLOT, buildDangerTimeline, buildFlowSegment, buildKickoffSegment, buildRegroupSegment, buildShootoutKick,
  createPositionBuffer, kickoffPositions, otherSide, PLAYERS_PER_SIDE, quickEventCue, sampleTimeline, shootoutLineup,
  sideOfTeam, slotBase, slotOfPlayer, STAGE_MS,
  type Beat, type CastEntry, type Cue, type DangerOutcome, type PitchSides, type Point, type Side, type Timeline,
} from '@shared/game/pitch';
import { seedFromString } from '@shared/game/random';

export type PitchMode = 'flow' | 'danger' | 'shootout' | 'idle';

export interface PitchSnapshot {
  mode: PitchMode;
  cast: CastEntry[];
  cue: (Cue & { id: number }) | null;
  tactic: (Cue & { id: number }) | null;
  beat: (Beat & { id: number }) | null;
  sentOff: ReadonlySet<number>;
  injured: ReadonlySet<number>;
  focus: Point | null;
  threat: { side: Side; stage: number } | null;
}

const KICKOFF_MS = 1100;
const SHOOTOUT_GATHER_MS = 900;

export class PitchDirector {
  private readonly pos: Float32Array;
  private segment: Timeline | null = null;
  private segmentStart = 0;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private carrier = -1;
  private possession: Side = 'left';
  private beats: Beat[] = [];
  private nextBeat = 0;
  private seq = 0;
  private snapshot: PitchSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(readonly sides: PitchSides, private readonly matchKey: string, private readonly clock: () => number = () => performance.now()) {
    this.pos = kickoffPositions(sides, 'left');
    this.snapshot = { mode: 'flow', cast: [], cue: null, tactic: null, beat: null, sentOff: new Set(), injured: new Set(), focus: null, threat: null };
  }

  // ── React store ──
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): PitchSnapshot => this.snapshot;

  private emit(patch: Partial<PitchSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }

  // ── Clock ──
  private now(): number {
    return this.pausedAt ?? this.clock();
  }

  private elapsed(): number {
    return this.now() - this.segmentStart - this.pausedTotal;
  }

  private play(timeline: Timeline, beats: Beat[] = []): void {
    this.segment = timeline;
    this.segmentStart = this.now();
    this.pausedTotal = 0;
    this.beats = beats;
    this.nextBeat = 0;
  }

  setPaused(paused: boolean): void {
    if (paused && this.pausedAt === null) this.pausedAt = this.clock();
    else if (!paused && this.pausedAt !== null) {
      this.pausedTotal += this.clock() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  /** Current positions (x, y, z per slot) in the director's own buffer — no allocation. */
  sample(): Float32Array {
    if (!this.segment) return this.pos;
    const t = this.elapsed();
    sampleTimeline(this.segment, t, this.pos);
    while (this.nextBeat < this.beats.length && this.beats[this.nextBeat].t <= t) {
      this.emit({ beat: { ...this.beats[this.nextBeat], id: ++this.seq } });
      this.nextBeat++;
    }
    return this.pos;
  }

  // ── Open play ──
  onMinute(minute: number, events: MatchEvent[], momentum: number, tactics: { left: string; right: string }, durationMs: number): void {
    let sentOff = this.snapshot.sentOff;
    let injured = this.snapshot.injured;
    const patch: Partial<PitchSnapshot> = {};
    let decided = false;
    for (const event of events) {
      const cue = quickEventCue(event, this.sides);
      if (cue?.kind === 'tactic') patch.tactic = { ...cue, id: ++this.seq };
      else if (cue) patch.cue = { ...cue, id: ++this.seq };
      const side = sideOfTeam(this.sides, event.teamId);
      if (event.type === 'red') {
        const slot = slotOfPlayer(this.sides, event.playerId);
        if (slot >= 0) sentOff = new Set(Array.from(sentOff).concat(slot));
      } else if (event.type === 'injury') {
        const slot = slotOfPlayer(this.sides, event.playerId);
        if (slot >= 0) injured = new Set(Array.from(injured).concat(slot));
      } else if ((event.type === 'momentum' || event.type === 'duel') && side) {
        this.possession = side;
        this.carrier = slotOfPlayer(this.sides, event.playerId);
        decided = true;
      } else if (event.type === 'foul' && side) {
        // The fouled side keeps the ball.
        this.possession = otherSide(side);
        this.carrier = slotOfPlayer(this.sides, event.opponentId);
        decided = true;
      }
    }
    if (!decided) {
      if (momentum > 56) this.possession = 'left';
      else if (momentum < 44) this.possession = 'right';
    }
    if (sentOff !== this.snapshot.sentOff) patch.sentOff = sentOff;
    if (injured !== this.snapshot.injured) patch.injured = injured;
    if (this.snapshot.mode !== 'flow') Object.assign(patch, { mode: 'flow', cast: [], focus: null, threat: null });
    this.sample();
    const flow = buildFlowSegment(this.pos, {
      sides: this.sides, possession: this.possession, carrier: this.carrier, momentum, tactics,
      sentOff, seed: seedFromString(`${this.matchKey}|flow|${minute}`), durationMs,
    });
    this.carrier = flow.carrier;
    this.play(flow.timeline);
    if (Object.keys(patch).length > 0) this.emit(patch);
  }

  // ── Dangers ──
  startDanger(event: MatchEvent, eventIndex: number, outcome: DangerOutcome): void {
    const eventSide = sideOfTeam(this.sides, event.teamId) ?? 'left';
    const attackSide = outcome === 'save' ? otherSide(eventSide) : eventSide;
    this.sample();
    const danger = buildDangerTimeline({
      sides: this.sides, attackSide, event, outcome, prev: Float32Array.from(this.pos),
      sentOff: this.snapshot.sentOff, seed: seedFromString(`${this.matchKey}|danger|${eventIndex}`),
    });
    this.play(danger.timeline, danger.beats);
    this.emit({ mode: 'danger', cast: danger.cast, focus: danger.focus, threat: { side: attackSide, stage: 1 } });
  }

  /** Re-aligns the danger with the narration stage (1-3) after timers or a pause drift. */
  syncStage(stage: number, consumedInStageMs: number): void {
    if (this.snapshot.mode !== 'danger') return;
    const target = (stage - 1) * STAGE_MS + consumedInStageMs;
    const drift = this.elapsed() - target;
    if (Math.abs(drift) > 80) this.segmentStart += drift;
    if (this.snapshot.threat && this.snapshot.threat.stage !== stage) this.emit({ threat: { ...this.snapshot.threat, stage } });
  }

  endDanger(goalScoredBy: Side | null): void {
    this.sample();
    if (goalScoredBy) {
      const kickoff = otherSide(goalScoredBy);
      const k = buildKickoffSegment(Float32Array.from(this.pos), this.sides, kickoff, KICKOFF_MS, this.snapshot.sentOff);
      this.possession = kickoff;
      this.carrier = k.carrier;
      this.play(k.timeline);
    }
    this.emit({ mode: 'flow', cast: [], focus: null, threat: null });
  }

  // ── Shootout ──
  startShootout(): void {
    this.sample();
    this.play(buildRegroupSegment(Float32Array.from(this.pos), shootoutLineup(this.sides), SHOOTOUT_GATHER_MS, this.snapshot.sentOff));
    this.emit({ mode: 'shootout', cast: [], focus: { x: 96, y: 34 }, threat: null, cue: null });
  }

  shootoutKick(kick: PenaltyKick, kickIndex: number, ids: { takerId?: string; gkId?: string }): void {
    const kicking = sideOfTeam(this.sides, kick.teamId) ?? 'left';
    const keeping = otherSide(kicking);
    let taker = slotOfPlayer(this.sides, ids.takerId);
    if (taker < 0) taker = slotBase(kicking) + PLAYERS_PER_SIDE - 1;
    let gk = slotOfPlayer(this.sides, ids.gkId);
    if (gk < 0) gk = slotBase(keeping);
    this.sample();
    const k = buildShootoutKick({
      sides: this.sides, prev: Float32Array.from(this.pos), takerSlot: taker, goalkeeperSlot: gk,
      isGoal: kick.isGoal, kickIndex, seed: seedFromString(`${this.matchKey}|shootout|${kickIndex}`),
    });
    this.play(k.timeline, k.beats);
    this.emit({ mode: 'shootout', cast: k.cast, focus: k.focus });
  }

  skipToEnd(shootout: boolean): void {
    this.pos.set(shootout ? shootoutLineup(this.sides) : kickoffPositions(this.sides, 'left'));
    this.segment = null;
    this.beats = [];
    this.emit({ mode: 'idle', cast: [], focus: null, threat: null, cue: null });
  }
}

export { BALL_SLOT, createPositionBuffer };
```

- [ ] **Step 5: Rodar**

Run: `pnpm exec vitest run client/src/components/game/pitch/PitchDirector.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 6: Checkpoint** — teste passando; typecheck limpo.

---

### Task 8: `LivePitch` — o desenho

**Files:**
- Create: `client/src/components/game/pitch/LivePitch.tsx`
- Create: `client/src/components/game/pitch/livePitch.css`
- Create: `client/src/components/game/pitch/PitchErrorBoundary.tsx`

**Interfaces:**
- Consumes: `PitchDirector`, `PitchSnapshot` (Task 7); `PITCH_LENGTH`, `PITCH_WIDTH`, `BALL_SLOT`, `sideOfSlot` de `@shared/game/pitch`; `PlayerPortrait` (`client/src/components/game/PlayerPortrait.tsx`); `Player` de `@shared/game/gameData`.
- Produces:
  - `default function LivePitch(props: { director: PitchDirector; players: ReadonlyMap<string, Player>; colors: { left: string; right: string }; className?: string })`
  - `default class PitchErrorBoundary extends Component<{ children: ReactNode }>`

Esta tarefa é visual; a verificação acontece na galeria (Task 9). Aqui o critério é compilar.

- [ ] **Step 1: Criar `PitchErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react';

/** The pitch is decoration over the narration: if it ever throws, the match goes on without it. */
export default class PitchErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[pitch] o campo ao vivo falhou e foi desligado nesta partida:', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
```

- [ ] **Step 2: Criar `livePitch.css`**

```css
.live-pitch {
  position: relative;
  width: 100%;
  aspect-ratio: 105 / 68;
  overflow: hidden;
  container-type: inline-size;
  background: #0f2a17;
  --dot: clamp(10px, 2.9cqw, 20px);
  --face: clamp(22px, 6.2cqw, 44px);
}
.live-pitch__camera {
  position: absolute;
  inset: 0;
  transition: transform 700ms cubic-bezier(.2, .7, .2, 1);
  will-change: transform;
}
.live-pitch__field { position: absolute; inset: 0; width: 100%; height: 100%; }
.live-pitch__layer { position: absolute; inset: 0; pointer-events: none; }
.live-pitch__dot {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--dot);
  height: var(--dot);
  margin: calc(var(--dot) / -2) 0 0 calc(var(--dot) / -2);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font: 800 calc(var(--dot) * .5) / 1 var(--font-game), sans-serif;
  color: #0b0b14;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .6);
  transition: opacity 250ms;
  will-change: transform;
}
.live-pitch__dot--keeper { filter: brightness(.72); outline: 1.5px solid rgba(255, 255, 255, .7); }
.live-pitch__dot--hidden { opacity: 0; }
.live-pitch__dot--injured::after {
  content: '';
  position: absolute;
  right: -2px;
  top: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 1px #0b0b14;
}
.live-pitch__face {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--face);
  height: var(--face);
  margin: calc(var(--face) / -2) 0 0 calc(var(--face) / -2);
  will-change: transform;
  animation: live-pitch-pop 220ms ease-out;
}
.live-pitch__face-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: #1b1b2b;
  box-shadow: 0 0 0 2.5px var(--ring), 0 3px 8px rgba(0, 0, 0, .6);
}
.live-pitch__face-img img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.live-pitch__name {
  position: absolute;
  left: 50%;
  top: calc(100% + 3px);
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 1px 6px;
  border-radius: 5px;
  background: rgba(8, 8, 15, .82);
  color: #fff;
  font: 800 clamp(9px, 1.6cqw, 12px) / 1.3 var(--font-game), sans-serif;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.live-pitch__ball {
  position: absolute;
  left: 0;
  top: 0;
  width: calc(var(--dot) * .62);
  height: calc(var(--dot) * .62);
  margin: calc(var(--dot) * -.31) 0 0 calc(var(--dot) * -.31);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff 0 45%, #cfd3dc 75%, #8b90a0);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .5);
  will-change: transform;
  z-index: 3;
}
.live-pitch__shadow {
  position: absolute;
  left: 0;
  top: 0;
  width: calc(var(--dot) * .7);
  height: calc(var(--dot) * .32);
  margin: calc(var(--dot) * -.16) 0 0 calc(var(--dot) * -.35);
  border-radius: 50%;
  background: rgba(0, 0, 0, .38);
  will-change: transform;
}
.live-pitch__cue {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: center bottom;
  will-change: transform;
}
.live-pitch__cue-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transform: translate(-50%, calc(-100% - var(--dot)));
  padding: 2px 7px;
  border-radius: 6px;
  white-space: nowrap;
  font: 900 clamp(9px, 1.7cqw, 12px) / 1.3 var(--font-game), sans-serif;
  letter-spacing: .08em;
  color: #fff;
  background: rgba(8, 8, 15, .88);
  border: 1px solid rgba(255, 255, 255, .18);
  animation: live-pitch-pop 200ms ease-out;
}
.live-pitch__card { width: 7px; height: 10px; border-radius: 1.5px; }
.live-pitch__tactic {
  position: absolute;
  top: 8px;
  padding: 3px 9px;
  border-radius: 999px;
  font: 900 clamp(9px, 1.7cqw, 12px) / 1.3 var(--font-game), sans-serif;
  letter-spacing: .1em;
  color: #0b0b14;
  animation: live-pitch-pop 220ms ease-out;
}
.live-pitch__threat {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  transform-origin: left center;
  transition: transform 800ms ease, background-color 300ms;
}
.live-pitch__net--ripple { animation: live-pitch-net 600ms ease-out; transform-box: fill-box; transform-origin: left center; }
.live-pitch__flash { animation: live-pitch-flash 500ms ease-out forwards; }
@keyframes live-pitch-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes live-pitch-net { 0%, 100% { transform: scaleX(1); } 35% { transform: scaleX(1.9); } 65% { transform: scaleX(1.3); } }
@keyframes live-pitch-flash { from { opacity: .9; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .live-pitch__camera { transition: none; transform: none !important; }
  .live-pitch__face, .live-pitch__cue-badge, .live-pitch__tactic, .live-pitch__net--ripple { animation: none; }
}
```

- [ ] **Step 3: Criar `LivePitch.tsx`**

```tsx
/**
 * The live pitch. Positions come from the PitchDirector every animation frame
 * and are written straight to the elements' transforms (no React render per
 * frame); React only renders when the snapshot changes (cast, cues, cards).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Player } from '@shared/game/gameData';
import { BALL_SLOT, PITCH_LENGTH, PITCH_WIDTH, roleOfSlot, sideOfSlot } from '@shared/game/pitch';
import PlayerPortrait from '../PlayerPortrait';
import type { PitchDirector } from './PitchDirector';
import './livePitch.css';

interface LivePitchProps {
  director: PitchDirector;
  players: ReadonlyMap<string, Player>;
  colors: { left: string; right: string };
  className?: string;
}

const SLOTS = Array.from({ length: 22 }, (_, i) => i);
const THREAT = { left: '#22C55E', right: '#EF4444' } as const;
const CARD_COLOR: Record<string, string> = { yellow: '#facc15', red: '#ef4444' };

function useTransient<T extends { id: number; durationMs?: number }>(value: T | null, fallbackMs: number): T | null {
  const [shown, setShown] = useState<T | null>(null);
  useEffect(() => {
    if (!value) return;
    setShown(value);
    const timer = setTimeout(() => setShown(current => (current?.id === value.id ? null : current)), value.durationMs ?? fallbackMs);
    return () => clearTimeout(timer);
  }, [value, fallbackMs]);
  return shown;
}

export default function LivePitch({ director, players, colors, className }: LivePitchProps) {
  const snap = useSyncExternalStore(director.subscribe, director.getSnapshot, director.getSnapshot);
  const frameRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ballRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const faceRefs = useRef(new Map<number, HTMLDivElement>());
  const cueRef = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const cue = useTransient(snap.cue, 1100);
  const tactic = useTransient(snap.tactic, 1600);
  const beatValue = useMemo(() => (snap.beat ? { ...snap.beat, durationMs: 600 } : null), [snap.beat]);
  const beat = useTransient(beatValue, 600);
  const cueSlot = cue?.slots[0] ?? -1;
  const cueSlotRef = useRef(cueSlot);
  cueSlotRef.current = cueSlot;

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => { size.current = { w: el.clientWidth, h: el.clientHeight }; };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const pos = director.sample();
      const sx = size.current.w / PITCH_LENGTH;
      const sy = size.current.h / PITCH_WIDTH;
      for (let s = 0; s < 22; s++) {
        const dot = dotRefs.current[s];
        if (dot) dot.style.transform = `translate3d(${pos[s * 3] * sx}px,${pos[s * 3 + 1] * sy}px,0) scale(${1 + pos[s * 3 + 2] * 0.35})`;
      }
      faceRefs.current.forEach((face, s) => {
        face.style.transform = `translate3d(${pos[s * 3] * sx}px,${pos[s * 3 + 1] * sy}px,0) scale(${1 + pos[s * 3 + 2] * 0.25})`;
      });
      const bx = pos[BALL_SLOT * 3] * sx;
      const by = pos[BALL_SLOT * 3 + 1] * sy;
      const bz = pos[BALL_SLOT * 3 + 2];
      if (ballRef.current) ballRef.current.style.transform = `translate3d(${bx}px,${by - bz * sy * 0.9}px,0) scale(${1 + bz * 0.12})`;
      if (shadowRef.current) shadowRef.current.style.transform = `translate3d(${bx}px,${by}px,0)`;
      const c = cueSlotRef.current;
      if (cueRef.current) {
        const cx = c >= 0 ? pos[c * 3] * sx : bx;
        const cy = c >= 0 ? pos[c * 3 + 1] * sy : by;
        cueRef.current.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [director]);

  const idOfSlot = (slot: number) => {
    const side = sideOfSlot(slot);
    return director.sides[side].playerIds[slot - (side === 'left' ? 0 : 11)];
  };
  const castSlots = new Set(snap.cast.map(c => c.slot));
  const focus = snap.focus;
  const cameraStyle = focus
    ? { transform: 'scale(1.6)', transformOrigin: `${(focus.x / PITCH_LENGTH) * 100}% ${(focus.y / PITCH_WIDTH) * 100}%` }
    : { transform: 'scale(1)', transformOrigin: '50% 50%' };
  const netRipple = beat?.kind === 'net' ? (beat.x > PITCH_LENGTH / 2 ? 'right' : 'left') : null;

  return (
    <div ref={frameRef} className={`live-pitch ${className ?? ''}`} role="img" aria-label="Campo ao vivo da partida">
      <div className="live-pitch__camera" style={cameraStyle}>
        <svg className="live-pitch__field" viewBox="0 0 105 68" preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={i * 10.5} y="0" width="10.5" height="68" fill={i % 2 ? '#123320' : '#14391f'} />
          ))}
          <g fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".3">
            <rect x=".6" y=".6" width="103.8" height="66.8" />
            <line x1="52.5" y1=".6" x2="52.5" y2="67.4" />
            <circle cx="52.5" cy="34" r="9.15" />
            <rect x=".6" y="13.84" width="16.5" height="40.32" />
            <rect x=".6" y="24.84" width="5.5" height="18.32" />
            <rect x="87.9" y="13.84" width="16.5" height="40.32" />
            <rect x="98.9" y="24.84" width="5.5" height="18.32" />
          </g>
          <g fill="rgba(255,255,255,.5)">
            <circle cx="52.5" cy="34" r=".35" /><circle cx="11" cy="34" r=".35" /><circle cx="94" cy="34" r=".35" />
          </g>
          <rect key={netRipple === 'left' ? `l${beat?.id}` : 'l'} className={netRipple === 'left' ? 'live-pitch__net--ripple' : undefined} x="-1.4" y="30.34" width="2" height="7.32" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.8)" strokeWidth=".25" />
          <rect key={netRipple === 'right' ? `r${beat?.id}` : 'r'} className={netRipple === 'right' ? 'live-pitch__net--ripple' : undefined} x="104.4" y="30.34" width="2" height="7.32" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.8)" strokeWidth=".25" />
          {beat && (beat.kind === 'save' || beat.kind === 'post') && (
            <circle key={beat.id} className="live-pitch__flash" cx={beat.x} cy={beat.y} r="2.4" fill="rgba(255,255,255,.55)" />
          )}
        </svg>

        <div className="live-pitch__layer">
          <div ref={shadowRef} className="live-pitch__shadow" />
          {SLOTS.map(slot => {
            const side = sideOfSlot(slot);
            const hidden = snap.sentOff.has(slot) || castSlots.has(slot);
            const keeper = roleOfSlot(director.sides, slot) === 'GK';
            return (
              <div
                key={slot}
                ref={el => { dotRefs.current[slot] = el; }}
                className={`live-pitch__dot${keeper ? ' live-pitch__dot--keeper' : ''}${hidden ? ' live-pitch__dot--hidden' : ''}${snap.injured.has(slot) ? ' live-pitch__dot--injured' : ''}`}
                style={{ background: colors[side] }}
              >
                {(slot % 11) + 1}
              </div>
            );
          })}
          {snap.cast.map(({ slot }) => {
            const player = players.get(idOfSlot(slot));
            const ring = colors[sideOfSlot(slot)];
            return (
              <div
                key={`face-${slot}`}
                ref={el => { if (el) faceRefs.current.set(slot, el); else faceRefs.current.delete(slot); }}
                className="live-pitch__face"
                style={{ ['--ring' as string]: ring }}
              >
                <div className="live-pitch__face-img">
                  {player && <PlayerPortrait playerId={player.id} photoUrl={player.photoUrl} lowRes alt="" />}
                </div>
                {player && <span className="live-pitch__name">{player.shortName}</span>}
              </div>
            );
          })}
          <div ref={ballRef} className="live-pitch__ball" />
          <div ref={cueRef} className="live-pitch__cue">
            {cue && (
              <span key={cue.id} className="live-pitch__cue-badge">
                {(cue.kind === 'yellow' || cue.kind === 'red') && <span className="live-pitch__card" style={{ background: CARD_COLOR[cue.kind] }} />}
                {cue.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {tactic && tactic.side && (
        <span key={tactic.id} className="live-pitch__tactic" style={{ background: colors[tactic.side], [tactic.side === 'left' ? 'left' : 'right']: 8 }}>
          {tactic.label}
        </span>
      )}
      {snap.threat && (
        <div className="live-pitch__threat" style={{ background: THREAT[snap.threat.side], transform: `scaleX(${snap.threat.stage / 3})` }} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída. (Se `PlayerPortrait` não aceitar `alt=""`, remover a prop.)

- [ ] **Step 5: Checkpoint** — typecheck limpo.

---

### Task 9: Galeria de lances (só em desenvolvimento)

**Files:**
- Create: `client/src/pages/dev/PitchGalleryPage.tsx`
- Modify: `client/src/main.tsx:5`

**Interfaces:**
- Consumes: `PitchDirector`, `LivePitch`, `PitchErrorBoundary`, `buildPitchSides`; `DANGER_KINDS`, `STAGE_MS`, `SHOOTOUT_BUILDUP_MS`, `SHOOTOUT_HOLD_MS`, `shootoutMissKind` de `@shared/game/pitch`; `generateBotTeam` de `@shared/game/gameEngine`; `PLAYERS` não é necessário.

- [ ] **Step 1: Criar a galeria**

```tsx
/** Dev-only gallery: fire any play with any outcome and review it in slow motion. Open with #lances. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { generateBotTeam } from '@shared/game/gameEngine';
import type { MatchEvent, PlayKind } from '@shared/game/engine/teamModel';
import { DANGER_KINDS, SHOOTOUT_BUILDUP_MS, SHOOTOUT_HOLD_MS, STAGE_MS, type DangerOutcome } from '@shared/game/pitch';
import { seededRandom, withRandomSource } from '@shared/game/random';
import LivePitch from '../../components/game/pitch/LivePitch';
import PitchErrorBoundary from '../../components/game/pitch/PitchErrorBoundary';
import { PitchDirector } from '../../components/game/pitch/PitchDirector';
import { buildPitchSides } from '../../components/game/pitch/sides';

const FORCED: Partial<Record<PlayKind, DangerOutcome>> = { own_goal: 'goal', blunder: 'goal', deflected: 'goal', screamer: 'goal', woodwork: 'miss' };

export default function PitchGalleryPage() {
  const [left, right] = useMemo(() => withRandomSource(seededRandom(7), () => [generateBotTeam('Meu Time', 0.9), generateBotTeam('Adversário', 0.9)]), []);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;
  const virtual = useRef({ last: performance.now(), t: 0 });
  const director = useMemo(() => new PitchDirector(buildPitchSides(left, right), 'galeria', () => {
    const now = performance.now();
    virtual.current.t += (now - virtual.current.last) * speedRef.current;
    virtual.current.last = now;
    return virtual.current.t;
  }), [left, right]);
  const players = useMemo(() => new Map([...left.players, ...right.players].map(p => [p.id, p])), [left, right]);
  const [kind, setKind] = useState<PlayKind>('cross');
  const [outcome, setOutcome] = useState<DangerOutcome>('goal');
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [flow, setFlow] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const minute = useRef(1);
  const eventIndex = useRef(0);

  useEffect(() => {
    if (!flow) return;
    const id = setInterval(() => {
      minute.current++;
      const m = minute.current;
      director.onMinute(m, [{ minute: m, type: 'momentum', description: '', teamId: m % 4 < 2 ? left.id : right.id, playerId: (m % 4 < 2 ? left : right).players[5].id }], 30 + (m * 7) % 40, { left: 'balanced', right: 'high_press' }, 222);
    }, 222 / speed);
    return () => clearInterval(id);
  }, [flow, director, left, right, speed]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms / speedRef.current)); };

  const fire = () => {
    clear();
    setFlow(false);
    const atk = side === 'left' ? left : right;
    const def = side === 'left' ? right : left;
    const result = FORCED[kind] ?? outcome;
    const event: MatchEvent = {
      minute: 50, type: result, description: '',
      teamId: result === 'save' ? def.id : atk.id,
      playerId: result === 'save' ? def.players[0].id : kind === 'own_goal' ? undefined : atk.players[10].id,
      opponentId: result === 'save' ? atk.players[10].id : kind === 'own_goal' ? def.players[2].id : undefined,
      play: { kind, attackerId: atk.players[10].id, creatorId: atk.players[7].id, wideId: kind === 'cross' ? atk.players[8].id : undefined, defenderId: def.players[2].id, goalkeeperId: def.players[0].id },
    };
    director.startDanger(event, ++eventIndex.current, result);
    after(STAGE_MS, () => director.syncStage(2, 0));
    after(STAGE_MS * 2, () => director.syncStage(3, 0));
    after(STAGE_MS * 3, () => { director.endDanger(result === 'goal' ? side : null); setFlow(true); });
  };

  const cueEvent = (type: MatchEvent['type']) => {
    const m = ++minute.current;
    director.onMinute(m, [{ minute: m, type, description: '', teamId: left.id, playerId: left.players[4].id, opponentId: right.players[9].id, tacticAction: type === 'tactic' ? 'high_press' : undefined }], 55, { left: 'balanced', right: 'balanced' }, 222);
  };

  const shootout = () => {
    clear();
    setFlow(false);
    director.startShootout();
    for (let i = 0; i < 6; i++) {
      after(1000 + i * (SHOOTOUT_BUILDUP_MS + SHOOTOUT_HOLD_MS), () => {
        const team = i % 2 === 0 ? left : right;
        const keeper = i % 2 === 0 ? right : left;
        director.shootoutKick({ teamId: team.id, takerName: '', gkName: '', isGoal: i % 3 !== 1 }, i, { takerId: team.players[10 - i].id, gkId: keeper.players[0].id });
      });
    }
  };

  const button = 'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10';
  return (
    <div className="min-h-screen bg-[#0b0b14] p-4 text-white">
      <h1 className="mb-3 text-xl font-black">Galeria de lances</h1>
      <div className="mx-auto max-w-4xl">
        <PitchErrorBoundary>
          <LivePitch director={director} players={players} colors={{ left: '#ffd700', right: '#6366f1' }} className="rounded-xl" />
        </PitchErrorBoundary>
      </div>
      <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center gap-2">
        <select className="rounded-lg bg-white/10 p-2" value={kind} onChange={e => setKind(e.target.value as PlayKind)}>
          {DANGER_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="rounded-lg bg-white/10 p-2" value={outcome} onChange={e => setOutcome(e.target.value as DangerOutcome)}>
          <option value="goal">gol</option><option value="save">defesa</option><option value="miss">para fora</option>
        </select>
        <select className="rounded-lg bg-white/10 p-2" value={side} onChange={e => setSide(e.target.value as 'left' | 'right')}>
          <option value="left">meu time ataca</option><option value="right">adversário ataca</option>
        </select>
        <button className={button} onClick={fire}>Disparar lance</button>
        <button className={button} onClick={() => setSpeed(speed === 1 ? 0.25 : 1)}>{speed === 1 ? 'Câmera lenta' : 'Velocidade normal'}</button>
        <button className={button} onClick={() => setFlow(f => !f)}>{flow ? 'Parar jogo corrido' : 'Jogo corrido'}</button>
        {(['foul', 'yellow', 'red', 'injury', 'tactic', 'corner', 'duel'] as const).map(type => (
          <button key={type} className={button} onClick={() => cueEvent(type)}>{type}</button>
        ))}
        <button className={button} onClick={shootout}>Disputa de pênaltis</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Abrir a galeria só em dev**

Em `client/src/main.tsx`, trocar a linha 5:

```tsx
createRoot(document.getElementById("root")!).render(<App />);
```

por:

```tsx
// Dev-only pitch gallery (#lances). `import.meta.env.DEV` is false in production
// builds, so this branch and its chunk are removed entirely.
if (import.meta.env.DEV && location.hash === "#lances") {
  void import("./pages/dev/PitchGalleryPage").then(({ default: PitchGalleryPage }) => {
    createRoot(document.getElementById("root")!).render(<PitchGalleryPage />);
  });
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída.

- [ ] **Step 4: Revisão visual de cada roteiro**

Iniciar o preview `ucl-dev` (`mcp__Claude_Browser__preview_start` com `name: "ucl-dev"`), navegar para `http://localhost:3000/#lances` e recarregar.
Para cada tipo de lance da lista, com os desfechos válidos e com os dois lados atacando, disparar em câmera lenta e conferir:
- a bola sai de quem conduz, chega ao finalizador e ao alvo sem atravessar jogadores de forma absurda;
- o goleiro reage do lado certo; a rede balança só no gol; a bola sai do campo na defesa para escanteio e no chute para fora;
- os rostos (até 4) aparecem com nome e a bolinha do mesmo jogador some;
- a câmera aproxima a área e volta ao fim;
- o jogo corrido mantém blocos compactos, sem tremedeira;
- os marcadores (falta, cartões, lesão, tática, escanteio, desarme) aparecem por ~1 s no lugar certo;
- a disputa de pênaltis reúne todos no círculo central e cada cobrança termina coerente.
Ajustar coordenadas em `plays.ts`/`shootout.ts` onde algo parecer errado e rodar `pnpm exec vitest run shared/game/pitch` de novo depois de cada ajuste.
Conferir também na largura de celular (`mcp__Claude_Browser__resize_window` com `preset: "mobile"`) que rostos e nomes ficam legíveis.

- [ ] **Step 5: Checkpoint** — galeria aprovada visualmente; testes do diretor passando.

---

### Task 10: Integração na tela da partida

**Files:**
- Create: `client/src/components/game/match/NarrationStrip.tsx`
- Modify: `client/src/pages/MatchSimPage.tsx` (imports; `dangerState` ~166-176; runner ~207-264; relógio ~269-426; `handleSkip` ~499; banner e sobreposição ~1028-1118)

**Interfaces:**
- Consumes: `narrateDanger` (Task 2); `PitchDirector`, `buildPitchSides`, `LivePitch`, `PitchErrorBoundary` (Tasks 7-8); `STAGE_MS`, `type Side` de `@shared/game/pitch`.
- Produces: `default function NarrationStrip(props: { minute: number; isFinished: boolean; userPaused: boolean; danger: { forMe: boolean; stage: number; message: string } | null; text: string; finishedContent: ReactNode })`.

- [ ] **Step 1: Criar `NarrationStrip.tsx`**

```tsx
/** The narration line under the live pitch: the current sentence, or the danger beat with its three steps. */
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NarrationStripProps {
  minute: number;
  isFinished: boolean;
  userPaused: boolean;
  danger: { forMe: boolean; stage: number; message: string } | null;
  text: string;
  finishedContent: ReactNode;
}

export default function NarrationStrip({ minute, isFinished, userPaused, danger, text, finishedContent }: NarrationStripProps) {
  const accent = danger ? (danger.forMe ? '#22C55E' : '#EF4444') : '#eab308';
  const label = isFinished ? 'FIM DE JOGO' : userPaused ? 'PAUSADO' : danger ? (danger.forMe ? 'CHANCE DO SEU TIME' : 'PERIGO NO SEU GOL') : 'AO VIVO';
  return (
    <div className="p-2 sm:p-3 border-b flex flex-col justify-center flex-shrink-0 transition-colors" style={{ background: danger ? `${accent}14` : 'linear-gradient(90deg, #0e0e1d, #14142b)', borderColor: danger ? `${accent}4d` : '#171725' }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[12px] font-black tracking-widest uppercase" style={{ fontFamily: 'var(--font-game), sans-serif', color: isFinished ? 'var(--ui-text-soft)' : accent }}>
          {label}
        </span>
        {danger && !isFinished && (
          <span className="flex items-center gap-1" aria-label={`Lance ${danger.stage} de 3`}>
            {[1, 2, 3].map(step => (
              <span key={step} className="h-2 w-2 rounded-full transition-colors" style={{ background: step <= danger.stage ? accent : 'transparent', border: `1px solid ${accent}` }} />
            ))}
          </span>
        )}
      </div>
      {isFinished ? finishedContent : (
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-sm sm:text-base font-bold text-yellow-500 tabular-nums min-w-[28px]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            {minute}'
          </span>
          <AnimatePresence mode="wait">
            <motion.p
              key={danger ? `d${danger.stage}-${danger.message}` : text}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-sm sm:text-base font-extrabold text-white leading-tight uppercase break-words"
              style={{ fontFamily: 'var(--font-game), sans-serif' }}
            >
              {danger ? danger.message : text}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Imports da página**

No topo de `client/src/pages/MatchSimPage.tsx`:
- remover `selectApproach`, `buildUpDesc`, `dangerAttemptMsg`, `saveCelebMsg`, `missCelebMsg` do import de `matchNarrative` (linha 12) se não restar outro uso (confirmar com `grep -n "selectApproach\|buildUpDesc\|dangerAttemptMsg\|saveCelebMsg\|missCelebMsg" client/src/pages/MatchSimPage.tsx` depois das edições; o import de `Approach` também sai se ficar sem uso);
- acrescentar:

```tsx
import { narrateDanger } from '@shared/game/dangerNarration';
import { STAGE_MS, shootoutMissKind, type Side } from '@shared/game/pitch';
import LivePitch from '../components/game/pitch/LivePitch';
import PitchErrorBoundary from '../components/game/pitch/PitchErrorBoundary';
import { PitchDirector } from '../components/game/pitch/PitchDirector';
import { buildPitchSides } from '../components/game/pitch/sides';
import NarrationStrip from '../components/game/match/NarrationStrip';
```

- [ ] **Step 3: Novo formato do `dangerState`**

Substituir a declaração (linhas ~166-176) por:

```tsx
  // The danger currently on screen: three narration beats, timed by the runner below.
  const [dangerState, setDangerState] = useState<{
    stage: number;
    teamId: string;
    type: string;
    message: string;
    /** Stage-2 line (the attempt), shown when the build-up ends. */
    attempt: string;
    /** Who scored, so the pitch can set up the kick-off; null for a save or a miss. */
    goalSide: Side | null;
  } | null>(null);
  // Time already spent in the current stage, so a pause resumes it instead of restarting it.
  const stageClockRef = useRef({ stage: 0, consumed: 0, startedAt: 0 });
```

- [ ] **Step 4: Criar o diretor**

Logo depois do objeto `sideColors` (~linha 203), inserir:

```tsx
  // The viewer's team always plays on the left, attacking to the right of the screen.
  const leftTeam = homeIsMine ? homeTeam : awayTeam;
  const rightTeam = homeIsMine ? awayTeam : homeTeam;
  const pitchDirector = useMemo(
    () => new PitchDirector(
      buildPitchSides(leftTeam, rightTeam),
      `${homeTeam.id}|${awayTeam.id}|${replayResult.homeGoals}-${replayResult.awayGoals}|${replayResult.events.length}`,
    ),
    [leftTeam, rightTeam, homeTeam.id, awayTeam.id, replayResult],
  );
  const pitchPlayers = useMemo(
    () => new Map([...homeTeam.players, ...awayTeam.players].map(p => [p.id, p] as const)),
    [homeTeam, awayTeam],
  );
  const sideOfTeamId = (teamId: string): Side => (teamId === leftTeam.id ? 'left' : 'right');
  const leftMomentum = (homeMomentum: number) => (leftTeam.id === homeTeam.id ? homeMomentum : 100 - homeMomentum);

  useEffect(() => { pitchDirector.setPaused(userPaused); }, [pitchDirector, userPaused]);
```

- [ ] **Step 5: Runner das etapas com retomada da pausa**

Substituir o `useEffect` inteiro da seção "4. Suspense / Danger sequence state runner" (~207-264) por:

```tsx
  // 4. Danger runner: build-up → attempt → reveal, 1.5 s each. A pause keeps the
  // time already spent in the stage, so the narration and the pitch resume together.
  useEffect(() => {
    if (!dangerState || userPaused) return;
    const clock = stageClockRef.current;
    if (clock.stage !== dangerState.stage) {
      clock.stage = dangerState.stage;
      clock.consumed = 0;
    }
    clock.startedAt = performance.now();
    pitchDirector.syncStage(dangerState.stage, clock.consumed);
    const remaining = Math.max(0, STAGE_MS - clock.consumed);

    const timer = setTimeout(() => {
      if (dangerState.stage === 1) {
        setDangerState(prev => (prev ? { ...prev, stage: 2, message: prev.attempt } : null));
        return;
      }
      if (dangerState.stage === 2) {
        if (pendingReplayGoals.current) {
          const rg = pendingReplayGoals.current;
          setHomeScore(s => s + rg.homeGoalDelta);
          setAwayScore(s => s + rg.awayGoalDelta);
          setEvents(prev => [...prev, ...rg.goalEvents]);
          if (rg.goalAlert) {
            showGoalAlert(rg.goalAlert, broadcastMode
              ? GOAL_CELEBRATION_MS.online
              : goalFavoursViewer(rg.goalAlert.teamId) ? GOAL_CELEBRATION_MS.mine : GOAL_CELEBRATION_MS.against);
          }
          setMomentum(m => {
            const next = Math.min(100, Math.max(0, m + rg.momentumShift));
            setMomentumHistory(h => [...h, next]);
            return next;
          });
          setDangerState(prev => (prev ? { ...prev, stage: 3, message: rg.messageStage3 } : null));
          pendingReplayGoals.current = null;
          return;
        }
        pitchDirector.endDanger(null);
        setDangerState(null);
        setIsPlaying(true);
        return;
      }
      pitchDirector.endDanger(dangerState.goalSide);
      setDangerState(null);
      pendingReplayGoals.current = null;
      setIsPlaying(true);
    }, remaining);

    return () => {
      clearTimeout(timer);
      clock.consumed += performance.now() - clock.startedAt;
    };
  }, [dangerState, userPaused, pitchDirector]);
```

(O corpo do estágio 2 é o mesmo de hoje; só mudam o temporizador, a chamada ao diretor e o `attempt`.)

- [ ] **Step 6: Relógio — campo a cada minuto e narração do lance**

Dentro do `setTimeout` do relógio (seção "4b"), logo depois de `setMinute(nextMin);` e `const evs = …`:

(a) Trocar o bloco `if (otherEvs.length > 0) { … }` por esta versão, que também alimenta o campo em todo minuto:

```tsx
        let delta = 0;
        if (otherEvs.length > 0) {
          setEvents(prev => [...prev, ...otherEvs]);
          for (const e of otherEvs) {
            const isHome = e.teamId === homeTeam.id;
            if (e.type === 'momentum') delta += isHome ? 6 : -6;
            else if (e.type === 'duel') delta += isHome ? 5 : -5;
          }
          if (delta !== 0) setMomentum(m => {
            const next = Math.min(95, Math.max(5, m + delta));
            setMomentumHistory(h => [...h, next]);
            return next;
          });
        }
        const revealed = [...events, ...otherEvs];
        pitchDirector.onMinute(nextMin, otherEvs, leftMomentum(Math.min(95, Math.max(5, momentum + delta))), {
          left: tacticAtMinute(leftTeam, revealed, nextMin),
          right: tacticAtMinute(rightTeam, revealed, nextMin),
        }, TICK_MS);
```

E no `else` final do relógio (minuto sem nenhum evento: `} else { setMomentumHistory(h => [...h, momentum]); }`), acrescentar antes do `setMomentumHistory`:

```tsx
        pitchDirector.onMinute(nextMin, [], leftMomentum(momentum), {
          left: tacticAtMinute(leftTeam, events, nextMin),
          right: tacticAtMinute(rightTeam, events, nextMin),
        }, TICK_MS);
```

(b) Dentro de `if (shotEvs.length > 0) {`: logo depois de `const isGoalOutcome = …`, inserir:

```tsx
          // The goal (if any) is the play we show; otherwise the minute's last shot.
          const featured = isGoalOutcome ? [...shotEvs].reverse().find(e => e.type === 'goal')! : decisive;
          const featuredIndex = replayResult.events.indexOf(featured);
          const narration = narrateDanger({
            event: featured,
            eventIndex: featuredIndex,
            homeTeam,
            awayTeam,
            fallbackGoalkeeperName: team => activeGoalkeeperForTeam(team, undefined, replayResult.playerStats).player?.shortName ?? team.name,
          });
```

Remover as definições de `attackerName`, `gkName` e `messageStage3` (o bloco do `const attackerName = isOwnGoal ? … : …;` até o fim do `const messageStage3 = …;`) e, no lugar, deixar:

```tsx
          const messageStage3 = narration.reveal;
```

Se `ogName` ficar sem uso depois disso, remover também a sua definição (o `goalMoment` usa só `isOwnGoal` e os ids).

(c) Trocar o trecho que vai de `setIsPlaying(false);` + `const replayApproach = selectApproach(…)` até o fechamento do `setDangerState({ … });` por:

```tsx
          setIsPlaying(false);
          pitchDirector.startDanger(featured, featuredIndex, isGoalOutcome ? 'goal' : isSaveOutcome ? 'save' : 'miss');
          setDangerState({
            stage: 1,
            teamId: atkId,
            type: 'attack',
            message: narration.buildUp,
            attempt: narration.attempt,
            goalSide: isGoalOutcome ? sideOfTeamId(narration.attackTeamId) : null,
          });
```

(d) Acrescentar `pitchDirector`, `leftTeam`, `rightTeam` ao array de dependências desse `useEffect`.

(e) Onde o relógio entra nos pênaltis (`setPenaltyMode(true);`), acrescentar logo antes: `pitchDirector.startShootout();`

- [ ] **Step 7: Pular**

No início de `handleSkip`, acrescentar:

```tsx
    pitchDirector.skipToEnd(Boolean(replayResult.penaltyWinner));
```

- [ ] **Step 8: Campo e faixa de narração no layout**

Substituir o bloco que começa em `{/* Live broadcast commentary banner */}` e termina no fechamento do `</AnimatePresence>` da sobreposição de perigo (`{/* Live Suspense Danger / Threat Meter Overlay */}`) por:

```tsx
          <PitchErrorBoundary>
            <LivePitch director={pitchDirector} players={pitchPlayers} colors={{ left: '#ffd700', right: '#6366f1' }} className="flex-shrink-0 border-b border-[#171725]" />
          </PitchErrorBoundary>

          <NarrationStrip
            minute={minute}
            isFinished={isFinished}
            userPaused={userPaused}
            danger={dangerState ? { forMe: dangerState.teamId === myTeam.id, stage: dangerState.stage, message: dangerState.message } : null}
            text={latestEvent ? latestEvent.description : 'Árbitro posiciona a bola. Arquibancadas cantam forte!'}
            finishedContent={(
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                <span className="text-sm sm:text-base font-extrabold uppercase text-white">
                  {homeScore > awayScore ? `Vitória do ${homeTeam.name}` : awayScore > homeScore ? `Vitória do ${awayTeam.name}` : 'Empate'} · {homeScore} × {awayScore}
                </span>
                {manOfTheMatch && (
                  <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] sm:text-[13px] font-black" style={{ background: 'rgba(201,168,76,.14)', color: 'var(--ui-brand)', border: '1px solid rgba(201,168,76,.35)' }}>
                    ⭐ MELHOR EM CAMPO: {manOfTheMatch.name.toUpperCase()} · {manOfTheMatch.rating.toFixed(1)}
                    <span className="font-bold text-[var(--ui-text-muted)]">({manOfTheMatch.team})</span>
                  </span>
                )}
              </div>
            )}
          />
```

(O conteúdo de fim de jogo é o mesmo de hoje, só passou para a prop.)

- [ ] **Step 9: Typecheck e testes**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída.
Run: `pnpm exec vitest run client/src/contexts/online-watch-gate.test.ts client/src/components/game/pitch/PitchDirector.test.ts shared/game/dangerNarration.test.ts`
Expected: PASS.

- [ ] **Step 10: Verificação no navegador**

Com o preview `ucl-dev`, jogar uma partida solo até a tela da partida e conferir:
- o campo aparece no topo da coluna principal, com a narração logo abaixo e o feed de lances embaixo;
- jogo corrido acompanha a barra de domínio; marcadores de falta e cartão aparecem com a frase da narração;
- cada lance perigoso encena a jogada descrita, a bola chega ao alvo exatamente quando a terceira frase aparece, e o placar muda nesse momento;
- depois de um gol, a comemoração em tela cheia aparece como hoje e o campo volta com a saída de bola;
- Pausar no meio de um lance congela campo e narração; Continuar retoma do mesmo ponto (sem reiniciar a etapa);
- Pular leva ao fim sem erros no console (`mcp__Claude_Browser__read_console_messages` com `onlyErrors: true`);
- a duração total da partida é a mesma de antes (≈ 20 s de relógio + lances);
- na largura de celular (`preset: "mobile"`), o campo ocupa a largura toda e a página continua rolando até o feed e as estatísticas.
Medir a fluidez: `mcp__Claude_Browser__javascript_tool` com
```js
await new Promise(done => { const times = []; let last = performance.now(); const f = now => { times.push(now - last); last = now; if (times.length < 240) requestAnimationFrame(f); else done(times); }; requestAnimationFrame(f); }).then(t => ({ avg: t.reduce((a, b) => a + b) / t.length, worst: Math.max(...t) }))
```
durante um lance perigoso. Esperado: média ≤ 17 ms e pior quadro < 50 ms.

- [ ] **Step 11: Checkpoint** — partida solo completa sem erros, verificada no desktop e no celular.

---

### Task 11: Disputa de pênaltis no campo

**Files:**
- Create: `client/src/components/game/match/ShootoutPanel.tsx`
- Modify: `client/src/pages/MatchSimPage.tsx` (efeito "4c" ~436-497; bloco `{/* ── 5. PENALTY SHOOTOUT OVERLAY ── */}` ~1272-1370; coluna principal)

**Interfaces:**
- Consumes: `PitchDirector.shootoutKick`, `shootoutMissKind` (Tasks 6-7).
- Produces: `default function ShootoutPanel(props: { homeTeam: Team; awayTeam: Team; penaltiesHome: boolean[]; penaltiesAway: boolean[]; homeScore: number; awayScore: number; pendingTeamId: string | null; commentary: string; winnerId: string | null; onFinish: () => void })`.

- [ ] **Step 1: Criar `ShootoutPanel.tsx`**

```tsx
/** Shootout scoreboard and narration, shown under the pitch while the kicks play out on it. */
import { motion } from 'framer-motion';
import type { Team } from '@shared/game/engine/teamModel';
import { Button } from '../../../design-system';

interface ShootoutPanelProps {
  homeTeam: Team;
  awayTeam: Team;
  penaltiesHome: boolean[];
  penaltiesAway: boolean[];
  homeScore: number;
  awayScore: number;
  pendingTeamId: string | null;
  commentary: string;
  winnerId: string | null;
  onFinish: () => void;
}

export default function ShootoutPanel(props: ShootoutPanelProps) {
  const { homeTeam, awayTeam, homeScore, awayScore, pendingTeamId, commentary, winnerId, onFinish } = props;
  const columns = [{ team: homeTeam, pens: props.penaltiesHome }, { team: awayTeam, pens: props.penaltiesAway }];
  return (
    <div className="flex-shrink-0 border-b px-3 sm:px-5 py-3" style={{ borderColor: 'rgba(255,215,0,0.25)', background: 'linear-gradient(165deg,#12121f,#0a0a14)' }}>
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[12px] font-black tracking-[0.22em] text-red-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>DISPUTA DE PÊNALTIS</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {[columns[0], null, columns[1]].map((col, ci) => {
          if (!col) return (
            <div key="score" className="text-center text-3xl sm:text-4xl font-black leading-none text-white" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {homeScore}<span className="text-gray-600 mx-1.5">-</span>{awayScore}
            </div>
          );
          const shooting = pendingTeamId === col.team.id;
          const slots = Math.max(5, col.pens.length + (shooting ? 1 : 0));
          return (
            <div key={ci} className="text-center rounded-xl py-2 px-1 transition-all" style={{ background: shooting ? 'rgba(255,215,0,0.08)' : 'transparent', border: `1px solid ${shooting ? 'rgba(255,215,0,0.4)' : 'transparent'}` }}>
              <div className="text-sm sm:text-base font-black truncate" style={{ fontFamily: 'var(--font-display), sans-serif', color: shooting ? '#ffd700' : '#fff' }}>{col.team.name.toUpperCase()}</div>
              <div className="flex gap-1 justify-center mt-1 flex-wrap">
                {Array.from({ length: slots }).map((_, i) => {
                  const v = col.pens[i];
                  const isNext = shooting && i === col.pens.length;
                  return <div key={i} className={`w-3 h-3 rounded-full ${isNext ? 'animate-pulse' : ''}`} style={{ background: v === true ? '#22c55e' : v === false ? '#ef4444' : '#141426', border: `1px solid ${isNext ? '#ffd700' : '#1f1f35'}` }} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs sm:text-sm font-bold text-gray-100 uppercase whitespace-pre-line leading-relaxed" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{commentary}</p>
      {winnerId && (
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3 text-center">
          <div className="text-xl sm:text-2xl font-black text-yellow-500 mb-2 tracking-wider" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            {(winnerId === homeTeam.id ? homeTeam.name : awayTeam.name).toUpperCase()} AVANÇA!
          </div>
          <Button type="button" intent="primary" size="large" onClick={onFinish} className="px-8">CONCLUIR →</Button>
        </motion.div>
      )}
    </div>
  );
}
```

Conferir o caminho do `Button`: `grep -n "from '../design-system'" client/src/pages/MatchSimPage.tsx` mostra de onde a página importa; a partir de `components/game/match/` o caminho é `../../../design-system`.

- [ ] **Step 2: Cobrança no campo e texto coerente**

No efeito "4c" (cobranças), logo depois de `setPenaltyKickPending(kick.teamId);`, inserir:

```tsx
    const kickingTeam = isHome ? homeTeam : awayTeam;
    const keepingTeam = isHome ? awayTeam : homeTeam;
    pitchDirector.shootoutKick(kick, penaltyReplayIdx, {
      takerId: kick.takerId ?? kickingTeam.players.find(p => p.shortName === kick.takerName)?.id,
      gkId: kick.gkId ?? keepingTeam.players.find(p => p.shortName === kick.gkName)?.id,
    });
```

E trocar `desc = penaltyReplayIdx % 2 === 0` por `desc = shootoutMissKind(penaltyReplayIdx) === 'save'`. Acrescentar `pitchDirector` às dependências do efeito.

- [ ] **Step 3: Painel no lugar do modal**

Remover o bloco inteiro `{/* ── 5. PENALTY SHOOTOUT OVERLAY ── */}` (`{penaltyMode && (<GameModal …>…</GameModal>)}`).

Na coluna principal, trocar o `<NarrationStrip … />` inserido na Task 10 por:

```tsx
          {penaltyMode ? (
            <ShootoutPanel
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              penaltiesHome={penaltiesHome}
              penaltiesAway={penaltiesAway}
              homeScore={penaltyHomeScore}
              awayScore={penaltyAwayScore}
              pendingTeamId={penaltyKickPending}
              commentary={penaltyCommentary}
              winnerId={penaltyWinner}
              onFinish={handleFinish}
            />
          ) : (
            <NarrationStrip … />
          )}
```

(com o mesmo `<NarrationStrip … />` da Task 10 dentro do ramo `:`), e importar `ShootoutPanel from '../components/game/match/ShootoutPanel'`. Se `GameModal` ficar sem uso na página, removê-lo do import (o modal dos elencos ainda usa — confirmar com grep).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída.

- [ ] **Step 5: Verificação no navegador**

Jogar (ou usar uma campanha de mata-mata) até uma disputa de pênaltis — a forma mais rápida é a galeria para o visual e uma partida de mata-mata empatada para a integração. Conferir: todos se reúnem no círculo central; cada cobrança mostra batedor e goleiro com rosto; a bola chega quando a frase de resultado aparece; defesa e chute para fora batem com o texto; o painel mostra o placar e o botão CONCLUIR no fim; Pular durante a disputa leva ao resultado final.

- [ ] **Step 6: Checkpoint** — disputa verificada.

---

### Task 12: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Todos os testes da feature**

Run: `pnpm exec vitest run shared/game/engine/engine-golden.test.ts shared/game/engine/match-play.test.ts shared/game/dangerNarration.test.ts shared/game/pitch client/src/components/game/pitch/PitchDirector.test.ts shared/game/gameEngine.test.ts shared/game/engine-units.test.ts client/src/contexts/online-watch-gate.test.ts`
Expected: PASS em todos.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída.

- [ ] **Step 3: Build de produção sem a galeria**

Run: `pnpm build`
Expected: build ok. Depois `grep -rl "Galeria de lances" dist/ || echo "galeria fora do build"` → `galeria fora do build`.

- [ ] **Step 4: Partida online**

No preview, criar uma sala online com duas abas (dois jogadores locais com contas de teste) e conferir na mesma partida que os dois veem o mesmo lance e a mesma narração (o mesmo texto da etapa 1 e o mesmo tipo de jogada). O espectador também vê o campo.

- [ ] **Step 5: Relato ao usuário**

Resumir o que foi feito, o que foi verificado (testes, navegador, medição de fluidez) e pedir que ele teste antes de commitar. Não commitar.
