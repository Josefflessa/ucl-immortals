# Unificar simulação num único motor (replay) — Design

**Data:** 2026-07-04
**Status:** Aprovado

## Problema

Existem **dois motores de simulação** independentes:

1. **Motor autoritativo** — `simulateMatch` / `runMatchSimulation` / `simulateRemainingMatch`
   (`client/src/lib/gameEngine.ts`). Gera gols **+ cartões 🟨🟥 + lesões 🩹** e efeitos de
   força. É usado no **online**, no **mata-mata** (solo e online), nos **bots**, e no
   botão **"pular"** do solo de liga (via `simulateRemainingMatch`).

2. **Sim local ao vivo** — funções `simulateKeyEvent`, `simulateFreeKick`,
   `simulateCornerHeader` + o laço de geração dentro de `client/src/pages/MatchSimPage.tsx`.
   Gera só gols/defesas/duelos, **sem cartões nem lesões**. É usado **apenas** no
   **solo de liga ao vivo**.

**Sintoma:** no solo de liga, assistir ao vivo → nenhum cartão/lesão aparece; usar "pular"
→ cartões/lesões aparecem (porque o "pular" usa o motor). Além disso, os dois sistemas
precisam ser mantidos em paralelo — qualquer mecânica nova (cartões, lesões, futuras)
teria que ser duplicada.

## Objetivo

Ter **um único motor** de simulação. O `MatchSimPage` vira **exclusivamente um reprodutor
(replay)** de um `MatchResult` autoritativo — que é exatamente o que ele já faz no online e
no mata-mata. Eliminar o sim local duplicado.

## Design

### 1. Solo de liga pré-computa pelo motor

No reducer `PLAY_LEAGUE_MATCH` (`client/src/contexts/GameContext.tsx`, ramo `solo`), depois
de resolver as escalações contra a disciplina (`rHome`/`rAway`, já existente), computar o
resultado pelo mesmo motor dos outros modos e guardá-lo:

```ts
const result = simulateMatch(rHome, rAway);
return {
  ...state,
  phase: 'match_sim',
  currentMatch: null,
  currentMatchTeams: [rHome, rAway],
  currentMatchResult: result,   // ← NOVO: liga o modo replay
};
```

Com `currentMatchResult` setado, `MatchSimPage` calcula `isReplay = true` e reproduz a
partida minuto-a-minuto pelo **caminho de replay já existente** — que já traz suspense de
3 estágios, narração, gráfico de momentum, pênaltis, e **cartões/lesões**.

O modo online **não muda**: lá o `currentMatchResult` continua vindo do servidor. O
mata-mata (solo/online) **não muda**: já é replay.

### 2. Finalização usa o resultado do motor

Em `MatchSimPage.handleFinish`, quando `isReplay`, despachar **o próprio `replayResult`**
(o resultado autoritativo do motor) em vez de reconstruir um `finalResult` a partir do
estado da tela. Isso garante que `FINISH_LEAGUE_MATCH`/`FINISH_KNOCKOUT_MATCH` recebam
exatamente o resultado do motor — com todos os eventos de cartão/lesão intactos, que o
`applyMatchDiscipline` consome para aplicar suspensões/lesões da rodada.

(Hoje `handleFinish` reconstrói `finalResult` do estado; no solo de mata-mata isso já
funcionava por aproximação, mas passar o `replayResult` direto é a fonte única e correta.)

O ramo solo de `FINISH_LEAGUE_MATCH` (que salva o resultado do jogador, simula as demais
partidas da rodada via `simulateMatch`, aplica disciplina, standings, apostas e reforço)
**não muda** — continua recebendo `action.result`.

### 3. Remover o motor duplicado (limpeza)

Uma vez que o solo de liga vira replay, o sim local nunca mais executa (o `useEffect` dele
já tem `if (isReplay) return`). Remover como código morto:

- Funções `simulateKeyEvent`, `simulateFreeKick`, `simulateCornerHeader`.
- O `useEffect` do laço de simulação local (o que começa em `if (isReplay) return;`).
- O ramo **não-replay** de `handleSkip` (o que chama `simulateRemainingMatch`) — no solo
  agora o skip cai sempre no ramo replay. `simulateRemainingMatch` continua exportado e
  usado? Verificar: se ninguém mais usa, remover o import; se ainda usado em outro lugar,
  manter. (Objetivo: sem imports órfãos.)

### 4. Remover a tática ao vivo

A mudança de tática no meio da partida (`showTactics` modal + botão + o `onChange` que fazia
`setMyTeam(prev => ({ ...prev, playStyle: id }))`) só fazia sentido com o sim local, que
consumia a mudança nos minutos seguintes. Com o resultado pré-computado, ela não teria
efeito. Decisão do usuário: **remover** a tática ao vivo. Remover:

- O botão que abre o modal (`onClick={() => { setIsPlaying(false); setShowTactics(true); }}`).
- O modal `showTactics` inteiro.
- O estado `showTactics` e os helpers `setMyTeam`/`setOppTeam` se ficarem órfãos.
- Ajustar `homeTeam`/`awayTeam`: permanecem como estado (são lidos em vários lugares), mas
  os setters `setHomeTeam`/`setAwayTeam` podem ficar órfãos — resolver conforme o typecheck
  (ex.: `const [homeTeam] = useState(...)`).

## Componentes afetados

| Arquivo | Mudança |
|---|---|
| `client/src/contexts/GameContext.tsx` | `PLAY_LEAGUE_MATCH` solo computa `simulateMatch` e seta `currentMatchResult`. |
| `client/src/pages/MatchSimPage.tsx` | `handleFinish` despacha `replayResult` quando replay; remover sim local, skip não-replay, tática ao vivo. |

`gameEngine.ts`, `server/handlers.ts`, `discipline.ts` — **não mudam**.

## Fluxo de dados (depois)

```
PLAY_LEAGUE_MATCH (solo)
  → resolveAvailableLineup (disciplina)
  → simulateMatch(rHome, rAway)  ── MOTOR ÚNICO (cartões/lesões/força)
  → currentMatchResult

MatchSimPage (isReplay=true)
  → reproduz replayResult.events minuto-a-minuto (cartões/lesões aparecem)
  → handleFinish → dispatch FINISH_LEAGUE_MATCH { result: replayResult }

FINISH_LEAGUE_MATCH (solo)
  → salva result na fixture do jogador
  → simula demais jogos da rodada (simulateMatch)
  → applyMatchDiscipline (lê cartões/lesões dos results)
  → standings / apostas / reforço
```

## Testes / verificação

- **Regressão:** `npx vitest run` (raiz) — todos os testes de balanço/disciplina/cartões
  seguem verdes (o motor não muda).
- **Novo teste (unidade do reducer):** `PLAY_LEAGUE_MATCH` no solo passa a setar
  `currentMatchResult` não-nulo com eventos do motor (garante que o solo entra em replay).
- **Typecheck/build:** `cd client && npx tsc --noEmit`; `npm run build` na raiz.
- **Manual (o bug):** solo de liga **ao vivo** mostra cartões/lesões (antes só o "pular"
  mostrava); "pular" e "ao vivo" produzem o mesmo tipo de resultado; disciplina/suspensão
  fluem na rodada seguinte; sem tática ao vivo; online/mata-mata inalterados.

## Fora de escopo

Não tocar no motor (`gameEngine.ts`) nem no servidor — só rotear o solo de liga pelo replay
e remover o código morto/duplicado.
