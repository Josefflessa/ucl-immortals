# Estádio do time — Fase 1 — Design

**Data:** 2026-07-05
**Status:** Aprovado
**Fase:** 1 de 2 (esta = Estádio + vantagem de casa como buff de atributo. Fase 2 = Técnico Prime + estádios temáticos, spec própria.)

## Objetivo

Dar identidade de **estádio** ao time e, sobretudo, **deixar claro pro jogador o buff de jogar em
casa** — que hoje existe (`HOME_ADVANTAGE = +3` de força pro mandante), mas é **invisível e abstrato**.
A vantagem passa a ser um **buff de atributo** — do jeito que o jogo já fala (Em Alta +3, Forasteiro
+5, Noé +10…): **"+N em todos os atributos, em casa"**. Muito mais tangível que "% mais forte".

## Decisões (com o usuário)

- Vantagem de casa vira **buff de atributo**: em casa, **todos os jogadores do mandante ganham +N em
  todos os atributos** (não mais +3 de força abstrato).
- **Estádio padrão** dá **+4 em tudo** (≈ o +3 de hoje → balanço quase igual). Todos os times usam o
  padrão nesta fase.
- Card na aba **MEU TIME**, abaixo/ligado ao card do técnico.
- **Não muda o balanço de propósito** — só torna a vantagem visível e a reescreve como buff claro.
- Funciona no **solo e no online** (a vantagem já vale pro mandante em ambos).
- O estádio aparece em **3 telas**, com pesos diferentes:
  1. **MEU TIME** — card completo do estádio (o buff em destaque), abaixo do técnico.
  2. **Detalhes da partida** — apenas **"onde o jogo aconteceu"**: o **estádio do mandante** no header
     (nome + fallback 🏟️). Na **final** mostra *"Campo neutro"* (sem vantagem). Nada de campo/química
     novos aqui.
  3. **Fim de campanha** (tela final) — melhorar de verdade: trocar o técnico "só nome" por um **card
     de técnico completo**, adicionar o **card do estádio**, e **melhorar a viz de química** do bloco
     do elenco.
- **Reaproveitar componentes:** extrair o card do técnico (hoje inline na `SquadEditor`) pra um
  `CoachCard` reutilizável, usado no MEU TIME **e** no fim de campanha (DRY, visual consistente).
- **Fase 2 (Prime):** ao upar pro Prime, **o único diferencial é o ESTÁDIO** (o Prime NÃO aumenta os
  buffs que o próprio técnico já dá). O estádio vira temático do técnico: **+7 em tudo** em casa **+ um
  buff puro em 2 atributos** (base pra todos, e **+6** pros jogadores do clube/nação daquele estádio)
  — tabela no fim deste doc.

## Componentes

### `client/src/lib/gameEngine.ts` (modificar)
- Trocar `export const HOME_ADVANTAGE = 3;` por `export const HOME_ATTR_BONUS = 4;` (+4 em tudo).
- Aplicação (linha ~1257): +4 em todos os atributos do mandante = +4 no overall de cada jogador =
  **+4 na força do time** (a força é a média dos overalls efetivos, então um deslocamento uniforme de
  +4 nos atributos equivale a +4 na força). Aplicado exceto na final:
  ```ts
  const homeStrength = homeBaseStrength - homeExtraPenalty +
    (fergusonActive(home, homeGoals, awayGoals) ? 10 : 0) +
    (isFinal ? 0 : HOME_ATTR_BONUS); // vantagem de casa (+4 em tudo) — neutro na final
  ```
- `HOME_ADVANTAGE` não é usado em nenhum outro lugar (só aqui) → substituição segura.

### `client/src/lib/stadium.ts` (criar)
- Modelo do estádio (pequeno, extensível pra Fase 2):
  ```ts
  export interface Stadium { id: string; name: string; photoUrl: string; homeAttrBonus: number; }
  export const DEFAULT_STADIUM: Stadium = {
    id: 'default', name: 'Estádio Municipal', photoUrl: '/stadiums/default.webp', homeAttrBonus: 4,
  };
  ```
  (Fase 2 troca o estádio do jogador por um temático com `homeAttrBonus: 7` + efeito especial; nesta
  fase só existe o padrão.)

### `client/public/stadiums/default.webp` (asset)
- Foto padrão do estádio. Placeholder por enquanto (o usuário fornece a imagem final). O componente
  tem **fallback gracioso** (se a imagem não carregar, mostra um gradiente + 🏟️), então não quebra
  sem o arquivo.

### `client/src/components/game/StadiumCard.tsx` (criar)
- Card pequeno e autocontido: foto do estádio (com fallback), nome, e o **destaque do buff**:
  - Linha principal: **"🏠 Em CASA: +{homeAttrBonus} em todos os atributos de todos os jogadores"** (ex.: "+4 em tudo").
  - Subtexto: *"Vale quando você é o mandante do confronto · não vale na final (campo neutro)."*
- Recebe o estádio por prop (`stadium?: Stadium`, default `DEFAULT_STADIUM`). Puramente
  informativo nesta fase (sem interação).
- **Prop `variant?: 'full' | 'venue'`** (default `'full'`). `'venue'` = versão enxuta (linha só com
  🏟️ nome do estádio + "onde o jogo aconteceu"), usada no header da partida. Mantém 1 componente só.

### `client/src/components/game/CoachCard.tsx` (criar — extração)
- Extrair o card do técnico que hoje é **inline** na `SquadEditor` (bloco `showCoachCard && coach`,
  ~linhas 155-186: foto, nome, filosofia, descrição, efeito, habilidade especial, formação preferida).
- Assinatura: `CoachCard({ coach, formation? }: { coach: Coach; formation?: Formation })`. Sem estado;
  puro display. A `SquadEditor` passa a renderizar `<CoachCard coach={coach} formation={formation} />`
  no lugar do markup inline (comportamento idêntico — refactor sem mudança visual no MEU TIME).

### `client/src/components/game/SquadEditor.tsx` (modificar)
- Trocar o markup inline do técnico por `<CoachCard />` (refactor).
- Renderizar `<StadiumCard />` logo **abaixo do `CoachCard`**, no mesmo layout. Aparece no MEU TIME
  (solo e online).

### `client/src/pages/MatchSimPage.tsx` (modificar) — "onde o jogo aconteceu"
- No header/placar da partida, mostrar o **estádio do mandante** com `<StadiumCard variant="venue" />`
  (ou uma linha simples 🏟️): `homeTeam` é o mandante; na **final** (`isKnockout` + final / campo
  neutro) mostrar *"Campo neutro"*. Nesta fase todos usam o `DEFAULT_STADIUM`, então o nome é sempre
  "Estádio Municipal" — mas já deixa o gancho pronto pro estádio temático da Fase 2.
- (Não mexe no `FormationField`/notas ao vivo do `MatchFieldView`.)

### `client/src/pages/ReportPage.tsx` (modificar) — fim de campanha
- Na **FICHA DA CAMPANHA**, tirar o "TÉCNICO: {nome}" solto (statline, ~linha 459) e renderizar o
  **`<CoachCard />`** completo + o **`<StadiumCard />`** acima/junto do bloco do elenco — mesma cara do
  MEU TIME. As outras métricas da ficha (formação/tática/overall/saldo…) continuam.
- **Melhorar a viz de química** do "squad showcase": o campo com linhas já existe (~linha 580); reforçar
  a legenda/leitura (ex.: contagem de conexões por tipo, química total com destaque) mantendo leve.

## Fluxo de dados

Estático nesta fase: o card mostra `DEFAULT_STADIUM`; o motor aplica `HOME_ATTR_BONUS` (+4) ao mandante.
Nada de novo estado/economia. (A Fase 2 introduz o estádio variável por jogador + o Prime.)

## Verificação

- **Balanço:** rodar `balance.test.ts` — o teste *"vantagem de jogar em casa"* deve continuar verde
  (mandante ganha um pouco mais, final equilibrada). +4 ≈ o +3 anterior; ajustar se ficar fraco/forte.
- **Typecheck/build:** `cd client && npx tsc --noEmit`; `npm run build`.
- **Manual (MEU TIME):** card do estádio "+4 em tudo em casa" abaixo do técnico; o `CoachCard`
  extraído continua idêntico ao de antes (refactor sem regressão visual). Solo e online.
- **Manual (partida):** header mostra "🏟️ Estádio Municipal — onde o jogo aconteceu" quando você é o
  mandante; **"Campo neutro"** na final. Notas/gols ao vivo do campo intactos.
- **Manual (fim de campanha):** técnico aparece como card completo (não mais só o nome) + card do
  estádio; química do elenco mais clara. Nada quebrado se faltar a foto do estádio (fallback).

## Fora de escopo (Fase 2 — Técnico Prime)

Evolução do técnico (critérios + custo em pontos), foto/moldura Prime, o estado por jogador (solo +
online) que guarda o estádio/prime atual, e os **estádios temáticos por técnico** abaixo.

**Regra central do Prime:** upar pro Prime **NÃO aumenta os buffs que o próprio técnico já dá** — o
**único diferencial é o estádio**, que vira temático. O estádio Prime dá **+7 em tudo** em casa **+ um
buff puro em 2 atributos** (tema do técnico): valor base pra todos os seus jogadores em casa, e **+6**
(bem maior) pros jogadores **do clube/nação** daquele estádio — recompensa montar um time com a cara
do técnico (stackar Liverpool no Anfield, portugueses no Dragão…).

| Técnico | Estádio | 2 atributos (tema) | Buff extra (+6) pra… |
|---|---|---|---|
| 🔴 **Klopp** | Anfield | Ritmo + Físico (intensidade) | jogadores do **Liverpool** |
| 🔵 **Guardiola** | Etihad | Passe + Visão (tiki-taka) | **Manchester City** |
| ⚪ **Ancelotti** | San Siro | Passe + Compostura (classe) | **Milan** |
| 🇵🇹 **Mourinho** | Estádio do Dragão | Defesa + Físico (muralha) | **portugueses** (nação) |
| 👑 **Zidane** | Bernabéu | Drible + Finalização (galácticos) | **Real Madrid** |
| 🔥 **Ferguson** | Old Trafford | Ritmo + Finalização (ataque implacável) | **Manchester United** |

(Mourinho → Dragão/Porto = onde ganhou a UCL de 2004; buff pra portugueses no geral, já que o Porto
tem poucos jogadores no pool e o Real é do Zidane. Valores +7/+6 são chute inicial — medir e calibrar
na spec da Fase 2.)
