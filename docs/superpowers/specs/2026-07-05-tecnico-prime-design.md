# Técnico Prime — Fase 2 — Design

**Data:** 2026-07-05
**Status:** Aprovado
**Fase:** 2 de 2 (Fase 1 = Estádio + vantagem de casa, já entregue. Esta = evolução do técnico pro Prime + estádios temáticos.)

## Objetivo

Dar uma **progressão de meio de campanha**: o jogador evolui seu técnico pro **Prime**, e o único
diferencial é o **estádio**, que vira o **estádio temático daquele técnico** (Anfield/Klopp,
Etihad/Guardiola…). O Prime **não aumenta os buffs que o próprio técnico já dá** — ele troca o estádio
padrão (+4 em casa) por um temático, mais forte (+7 em casa) e com um **buff temático em 2 atributos**
que premia montar o time com a cara do técnico (stackar Liverpool no Anfield, portugueses no Dragão…).

## Decisões (com o usuário)

- **Portão da evolução:** um botão **"Evoluir Técnico → Prime"** fica **sempre visível** no painel do
  técnico (MEU TIME) enquanto não for Prime — mesmo sem cumprir os requisitos. Clicar **sempre abre um
  modal** que detalha: os **requisitos** (com ✅/❌ — "Vitórias 4/4", "500 pontos"), **o que muda** ao
  evoluir (estádio temático daquele técnico, +7 em casa, buff dos 2 atributos, foto/moldura + selo
  Prime) e o **custo** (500 pts). Dentro do modal, o botão **Confirmar** fica **apagado e não-clicável**
  enquanto faltar requisito (**≥ 4 vitórias na campanha** E **≥ 500 pontos**); só habilita quando cumpre
  tudo. Ao confirmar, desconta **500 pontos** e liga o Prime — **uma vez por campanha, permanente**.
- **Técnico e estádio numa parte só:** MEU TIME (e o fim de campanha) mostram um **card único** —
  "Comando do Time" — com o **técnico em cima** e o **estádio embaixo**, num bloco só (divisor entre
  eles). O botão de evoluir fica no **rodapé** desse card (só no MEU TIME). Na partida continua só a
  linha enxuta do venue.
- **O Prime só muda o estádio.** Não mexe nos buffs do próprio técnico.
- **Estádio temático** por técnico (fotos webp já prontas em `client/public/stadiums/`):

  | Técnico | Estádio | 2 atributos (tema) | Buff extra pra… |
  |---|---|---|---|
  | 🔴 Klopp | Anfield | Ritmo + Físico | jogadores do **Liverpool** |
  | 🔵 Guardiola | Etihad | Passe + Visão | **Manchester City** |
  | ⚪ Ancelotti | San Siro | Passe + Compostura | **Milan** |
  | 🇵🇹 Mourinho | Estádio do Dragão | Defesa + Físico | **portugueses** (nação) |
  | 👑 Zidane | Bernabéu | Drible + Finalização | **Real Madrid** |
  | 🔥 Ferguson | Old Trafford | Ritmo + Finalização | **Manchester United** |

- **Mecânica do buff Prime em casa** (mandante; nunca na final/campo neutro):
  1. **Uniforme:** +7 em todos os atributos (vs. +4 do padrão) — aplicado como hoje (bônus de força
     do mandante), só trocando a constante quando Prime.
  2. **Temático (2 atributos):** **+3** nos 2 atributos do tema pra **todos** os titulares do mandante,
     e **+6** (em vez de +3) pros titulares **do clube/nação** daquele estádio. Aplicado **por atributo**,
     reusando a máquina de modificadores do técnico (`getCoachModifiersForPlayer`) — logo pesa nos
     momentos-chave da partida (finalizações, defesas, duelos) onde esses atributos entram.
  - Números (+7 / +3 / +6) são **ponto de partida**, calibrados no harness de balanço.
- **Bots não evoluem** (Prime é a progressão do jogador) — mantém o balanço previsível.
- **Foto/moldura Prime:** ao evoluir, o card do técnico troca pra **foto Prime** + **moldura** por cima
  + selo **PRIME** dourado (selo/borda já preparados na Fase 1 via `CoachCard isPrime`).
- Funciona no **solo e no online**.

## Componentes

### `client/src/lib/stadium.ts` (modificar)
- Estender `Stadium` com o tema (opcional, só os Prime têm):
  ```ts
  export type AttrKey = 'pace'|'shooting'|'passing'|'dribbling'|'defending'|'physical'|'vision'|'composure';
  export interface Stadium {
    id: string; name: string; photoUrl: string; homeAttrBonus: number;
    prime?: boolean;
    themedAttrs?: [AttrKey, AttrKey];   // os 2 atributos do tema
    themedClub?: string;                // clube que ganha o buff maior
    themedNation?: string;              // OU nação (Dragão → 'Portugal')
    coachPhotoUrl?: string;             // foto Prime do técnico (/coaches/prime/<id>.webp)
  }
  export const PRIME_STADIUMS: Record<string, Stadium> = { guardiola: {...}, klopp: {...}, ... };
  export function stadiumFor(coachId: string, prime: boolean): Stadium; // prime ? PRIME_STADIUMS[coachId] : DEFAULT_STADIUM
  ```
- `DEFAULT_STADIUM` fica com `homeAttrBonus: 4` (Fase 1, inalterado).
- Os 6 Prime: `homeAttrBonus: 7`, `prime: true`, `themedAttrs`, `themedClub`/`themedNation`, `coachPhotoUrl`.

### `client/src/lib/gameEngine.ts` (modificar)
- `Team` ganha `coachPrime?: boolean` (o motor sabe se o técnico evoluiu). `generateBotTeam` seta `false`.
- **Uniforme:** onde hoje se soma `HOME_ATTR_BONUS` à força do mandante (linha ~1257), passar a somar
  `home.coachPrime ? PRIME_HOME_ATTR_BONUS : HOME_ATTR_BONUS` (novo `export const PRIME_HOME_ATTR_BONUS = 7`).
  Continua neutro na final.
- **Temático:** estender o `context` de `getCoachModifiersForPlayer` (que já carrega `isKnockout`/`isFinal`)
  com `homeStadium?: Stadium` (setado só pro time mandante, e só quando `coachPrime`). Quando presente,
  somar aos `modifiers` dos 2 `themedAttrs`: **+6** se o jogador é do `themedClub`/`themedNation`, senão
  **+3**. Constantes novas: `PRIME_THEMED_BONUS = 3`, `PRIME_THEMED_CLUB_BONUS = 6`.
- Em `runMatchSimulation`, os contextos por time (`matchCtxHome`/`matchCtxAway`, ~linha 1282) passam
  `homeStadium` só no do mandante. O visitante nunca recebe (é vantagem de casa).
- **Fase 1 intacta:** sem Prime, nada muda (uniforme = +4, temático = ausente).

### `client/src/contexts/GameContext.tsx` (modificar) — solo
- `GameState` ganha `coachPrime: boolean` (init `false`); refletir em `playerTeam.coachPrime`.
- Vitórias da campanha: o entry do time do jogador em `leagueStandings` já tem `won`.
- Action `EVOLVE_COACH_PRIME`: valida `wonDoJogador >= 4 && points >= 500`; se ok, `points -= 500`,
  `coachPrime = true`, `playerTeam.coachPrime = true`. (No-op se já Prime ou critério não batido.)
- `SET_ONLINE_STATE`: mapear `coachPrime` do servidor (como já faz com `points`/`reinforcementRerolls`).

### `server/handlers.ts` (modificar) — online
- `RoomPlayer` ganha `coachPrime: boolean` (init `false`); incluir no estado emitido e no `player.team`.
- Handler `evolve_coach_prime`: valida (vitórias do jogador na classificação `>= 4` e `points >= 500`);
  se ok, `points -= 500`, `coachPrime = true`, `player.team.coachPrime = true`, `room_updated`.
- As telas de partida montadas no servidor passam `coachPrime` no `team` usado pela simulação.

### `client/src/components/game/CoachCard.tsx` (modificar)
- `isPrime` já existe (selo PRIME + borda dourada da Fase 1). Adicionar:
  - Quando `isPrime`, usar a **foto Prime** (`coachPhotoUrl` do estádio Prime, `/coaches/prime/<id>.webp`,
    via nova prop `primePhotoUrl?`) e sobrepor a **moldura** (`/coaches/prime/moldura.webp`) por cima da
    foto (overlay absoluto na mesma caixa).
  - Prop `bare?: boolean`: quando `true`, renderiza **sem o container externo** (borda/fundo/arredondado),
    só o cabeçalho + conteúdo — pra compor dentro do painel único sem borda dupla.

### `client/src/components/game/StadiumCard.tsx` (modificar)
- Já recebe `stadium` por prop. Adicionar:
  - Quando `stadium.prime`, o texto do buff mostra: "🏠 Em casa: **+7** em tudo · **+3/+6** {2 atributos
    do tema} · +6 pros jogadores do {clube/nação}" (realce dourado quando Prime). Layout compacto mantido.
  - Prop `bare?: boolean`: igual à do `CoachCard` — sem container externo, pra compor no painel único.

### `client/src/components/game/CoachStadiumPanel.tsx` (criar) — o card único "Comando do Time"
- Um **card só** (um container com borda) que compõe: cabeçalho "🎯 COMANDO DO TIME", `<CoachCard bare>`,
  um **divisor**, `<StadiumCard bare>`, e um **rodapé opcional** (o botão de evoluir).
- Props: `coach`, `formation`, `coachPrime`, `stadium` (derivado via `stadiumFor`), e — quando editável
  (MEU TIME) — `wins`, `points`, `onEvolve` (callback). No fim de campanha, sem `onEvolve` → sem rodapé.
- **Rodapé (só quando `onEvolve` e NÃO Prime):** botão **"⭐ Evoluir Técnico → Prime"** sempre visível e
  clicável, que abre o **modal** de evolução.
- **Modal de evolução** (mesmo padrão visual do modal da Fisioterapia):
  - Lista os **requisitos** com ✅/❌: "Vitórias na campanha: {wins}/4", "Pontos: {points}/500".
  - Mostra **o que muda:** estádio vira {nome do estádio temático}, +7 em casa, +3/+6 nos 2 atributos do
    tema (+6 pros do {clube/nação}), foto + moldura + selo Prime.
  - Botão **"Confirmar (−500 pts)"** fica **apagado e não-clicável** enquanto `wins < 4 || points < 500`;
    habilita quando cumpre tudo. Ao confirmar, chama `onEvolve()` e fecha.

### Integração nas telas
- `SquadEditor.tsx` (MEU TIME): trocar os `<CoachCard>`/`<StadiumCard>` soltos (Fase 1) por
  `<CoachStadiumPanel ... wins points onEvolve />`. Recebe `coachPrime`, `points`, `wins` por prop (a
  página que renderiza a `SquadEditor` já tem esses dados: solo via `GameState`, online via estado da sala).
  `onEvolve` → solo `dispatch(EVOLVE_COACH_PRIME)`; online `emit('evolve_coach_prime')`.
- `ReportPage.tsx` (fim de campanha): trocar os cards soltos por `<CoachStadiumPanel ... />` **sem**
  `onEvolve` (só exibição). Passa `coachPrime`/`stadium` do time final.

### `client/src/pages/MatchSimPage.tsx` (modificar) — venue temático
- O `StadiumCard variant="venue"` do mandante passa a receber `stadium={stadiumFor(homeTeam.coachId, homeTeam.coachPrime)}`
  (mostra "🏟️ Anfield · onde o jogo aconteceu" quando o mandante é Prime). O venue continua fora do
  painel único (é só uma linha no header da partida).

## Fluxo de dados

`coachPrime` nasce em `false`, vira `true` no evento de evolução (solo: reducer; online: servidor).
Deriva o estádio via `stadiumFor(coachId, coachPrime)`. O motor lê `team.coachPrime` pra escolher o
bônus uniforme e injetar o `homeStadium` no contexto do mandante. Nada persiste entre campanhas
(recomeça padrão a cada nova campanha, como o resto do estado do time).

## Verificação

- **Testes de unidade (motor):** `stadiumFor` (padrão vs prime); o buff temático entra em
  `getCoachModifiersForPlayer` (+3 pra genérico, +6 pra clube/nação, só no mandante Prime, zero fora de
  casa e zero na final); `PRIME_HOME_ATTR_BONUS = 7`.
- **Balanço (harness):** medir a vantagem de casa com Prime vs padrão — o Prime deve dar uma vantagem
  de casa **claramente maior**, mas não quebrada; stackar clube/nação deve render mais. Calibrar
  +7/+3/+6 se estourar.
- **Regressão:** os testes da Fase 1 (vantagem de casa padrão, `DEFAULT_STADIUM`) continuam verdes.
- **Typecheck/build:** `cd client && npx tsc --noEmit`; raiz `npm run build`.
- **Manual (solo):** botão "Evoluir" sempre visível; clicar abre o modal com requisitos ✅/❌ e o
  Confirmar apagado com <4 vitórias ou <500 pts; ao cumprir, Confirmar habilita → técnico com
  foto/moldura/selo PRIME, estádio temático no card único (MEU TIME) e no fim de campanha, venue
  temático na partida, buff maior em casa. **Manual (online, 2 abas):** evolução sincroniza, desconta
  pontos só do autor, e o estádio/foto Prime aparecem.

## Fora de escopo

- Bots com Prime. Prime persistindo entre campanhas. Estádios/temas além dos 6 técnicos existentes.
- Efeitos condicionais (perdendo/acréscimos/etc.) — descartados; o buff é puro (uniforme + 2 atributos).
