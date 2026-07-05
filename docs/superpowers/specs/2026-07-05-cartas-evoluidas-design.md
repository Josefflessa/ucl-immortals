# Cartas Evoluídas — Design

**Data:** 2026-07-05
**Status:** Aprovado

## Objetivo

Dar uma **progressão por uso** às cartas: uma carta do seu time que **jogar 6 partidas** (como titular)
na campanha vira **Evoluída** — ganha um **fundo novo** (os `bg-{raridade}-emforma.png`) e libera **8
pontos livres** que o jogador distribui pelos atributos como quiser (e pode resetar/redistribuir quando
quiser), tudo explicado de forma clara e organizada no modal do jogador.

## Decisões (com o usuário)

- **Nome:** "**Evoluída**" (distinto da característica "Em Alta"/`inForm` ⚡, que é outra coisa).
- **Gatilho:** a carta jogou **6 partidas como TITULAR** (entrou no XI de jogos disputados) na campanha.
  Banco/reservas que não jogam **não** contam. Permanente na campanha (recomeça a cada nova campanha).
- **Recompensa:** só **(1) o fundo novo** + **(2) 8 pontos livres**. Nenhum boost automático de stat
  além dos pontos que o jogador distribui.
- **8 pontos:** cada ponto = **+1** num atributo; **sem teto** (pode pôr os 8 num atributo só);
  distribuível e **resetável** a qualquer momento. Somam de verdade nos atributos (fluem no motor).
- **Bots não evoluem** (é a progressão do time do jogador).
- Funciona no **solo e no online**.

## Componentes

### `client/src/lib/gameData.ts` (modificar) — modelo da carta
- No `interface Player`, adicionar (mesmo formato inline do `trainBoosts`, sem import de `AttrKey`
  — evita ciclo, já que `gameData` é importado por `gameEngine`):
  ```ts
  appearances?: number; // jogos disputados como titular (campanha)
  evolvePoints?: {      // pontos livres distribuídos (soma ≤ 8), sem teto por atributo
    pace?: number; shooting?: number; passing?: number; dribbling?: number;
    defending?: number; physical?: number; vision?: number; composure?: number;
  };
  ```

### `client/src/lib/gameEngine.ts` (modificar) — regra + efeito
- Constantes: `export const EVOLVE_GAMES = 6;` e `export const EVOLVE_POINTS = 8;`.
- Helper `export function isEvolved(p: { appearances?: number }): boolean` → `(p.appearances ?? 0) >= EVOLVE_GAMES`.
- Aplicar os pontos: em `getEffectiveAttribute` (perto do bloco de `trainBoosts`, ~linha 865) e em
  `getPlayerEffectiveStats`, somar `player.evolvePoints?.[attr] ?? 0` (igual ao Treino — sem teto).
  Só surte efeito quando a carta está evoluída, mas como `evolvePoints` só existe em carta evoluída,
  a soma direta já basta (uma carta não-evoluída não tem `evolvePoints`).

### Incremento de `appearances` (solo + online)
- **Regra:** ao resolver a(s) partida(s) de uma rodada em que o time do jogador jogou, cada **titular
  (índices 0-10)** do time do jogador que disputou aquela partida ganha **+1** em `appearances`.
- **Solo** (`client/src/contexts/GameContext.tsx`): no mesmo ponto onde a disciplina da rodada é
  aplicada ao estado (liga ~linha 895; mata-mata ~linha 1000), mapear os titulares do `playerTeam` e
  incrementar `appearances`. (Só conta quando o `playerTeam` participou do confronto da rodada.)
- **Online** (`server/handlers.ts`): no processamento do resultado da rodada de cada jogador (onde a
  disciplina/estatística é aplicada ao `player.team`), incrementar `appearances` dos titulares.
- **Não** incrementa pra reservas nem pra bots.

### `client/src/components/game/PlayerCard.tsx` (modificar) — fundo + selo
- `cardTexture(rarity)` passa a aceitar `evolved`: quando `true`, usar `/cards/${RARITY_FILE[rarity]}-emforma.png`
  (os arquivos `-emforma` são `.png`); senão o `.webp` normal.
- No render, `const evolved = isEvolved(player);` escolhe a textura evoluída e mostra um **selo discreto
  "EVOLUÍDA"** (canto do card, dourado). Vale nos tamanhos full e compact (respeitando `lite`).

### `client/src/components/game/SquadEditor.tsx` (modificar) — seção no modal do jogador
- No painel do jogador selecionado, adicionar uma seção **"⭐ CARTA EVOLUÍDA"** (clara e organizada):
  - **Se evoluída:** um **alocador dos 8 pontos** — lista dos 8 atributos, cada um com **−/valor/+**;
    o `+` some quando não há pontos sobrando, o `−` some quando aquele atributo está em 0. Cabeçalho
    "**Pontos: X/8 restantes**" e botão **"↺ Resetar"** (zera `evolvePoints`). Uma linha explicando:
    "Distribua 8 pontos livres — pode resetar e redistribuir quando quiser."
  - **Se ainda não evoluída:** um bloco de **progresso** — "Jogos: {appearances}/6 pra evoluir" com uma
    barrinha. Deixa claro o que falta.
- Callbacks recebidos por prop (como já é feito com física/mártir): `onSetEvolvePoint(playerId, attr, delta)`
  e `onResetEvolvePoints(playerId)`.

### Estado / ações (solo + online)
- **Solo** (`GameContext.tsx`): actions `SET_EVOLVE_POINT { playerId, attr, delta }` (valida: carta
  evoluída, `delta` mantém `0 ≤ valor` e `soma ≤ EVOLVE_POINTS`) e `RESET_EVOLVE_POINTS { playerId }`.
- **Online** (`server/handlers.ts` + helpers): emits `set_evolve_point` / `reset_evolve_points`,
  servidor valida (carta do próprio time, evoluída, soma ≤ 8) e aplica em `player.team`, `room_updated`.
- **Sync:** `appearances`/`evolvePoints` já fluem pro cliente via `playerTeam: me.team` no
  `SET_ONLINE_STATE` — nada extra.
- **Wire:** `LeagueSquadTab.tsx` liga os callbacks (solo dispatch / online emit), como faz com físio/mártir.

## Fluxo de dados

`appearances` sobe +1 por partida jogada (titular) até ≥ 6 → `isEvolved` vira `true` → o card usa o
fundo `-emforma` e o modal mostra o alocador. Os `evolvePoints` distribuídos somam nos atributos via o
motor (display e simulação). Reset zera os pontos. Nada persiste entre campanhas (recomeça com o time
novo).

## Verificação

- **Unidade (motor):** `isEvolved` (5 jogos = false, 6 = true); `evolvePoints` somam no
  `getEffectiveAttribute`/`getPlayerEffectiveStats` (ex.: +3 finalização); `EVOLVE_GAMES=6`, `EVOLVE_POINTS=8`.
- **Reducer/validação:** distribuir respeita soma ≤ 8 e piso 0; reset zera; só em carta evoluída.
- **Typecheck/build:** `cd client && npx tsc --noEmit`; raiz `npm run build`.
- **Manual (solo):** usar uma carta em 6 jogos → fundo muda + selo; no modal, distribuir/resetar os 8
  pontos e ver o overall/atributos subirem; carta com <6 jogos mostra o progresso. **Online (2 abas):**
  distribuir sincroniza só no autor; adversário não muda.

## Fora de escopo

- Boost automático de stat ao evoluir (só há os 8 pontos). Teto por atributo (é livre). Evolução de
  bots. Persistir entre campanhas. Animação/"toast" de comemoração ao evoluir (pode vir depois).
