# Cartão vermelho ao vivo

O vermelho agora é um lance de campo, como os gols e as defesas: a falta, o apito, o juiz correndo, o cartão no ar e a saída do expulso, com narração própria em três etapas.

## Como o lance chega ao campo

1. **Motor** (`matchSim.ts` → `applySendOff`): cada vermelho sai com o **tipo** (`redKind`) e, quando a frase do feed já diz como foi, a **variação** (`redVariant`). Os dois vêm da frase sorteada em `matchNarrative.ts` (`straightRedPlay`: cada frase carrega o tipo e a variação), então o campo e o feed contam a mesma história. Não há sorteio novo: o motor consome o mesmo número de sorteios de antes. O segundo amarelo é sempre o tipo `secondyellow`.
2. **Partida** (`MatchSimPage.tsx`): num minuto sem chute, o vermelho não vai direto ao feed. Ele roda como um lance de 3 etapas (o mesmo executor dos perigos) e só entra no feed na etapa 3. Num minuto com chute o vermelho continua aparecendo na hora (nunca dois lances ao mesmo tempo).
3. **Narração** (`redCardNarration.ts`): `narrateRedCard` devolve uma fala por etapa, como nos lances perigosos: 1 (a jogada), 2 (a falta e o juiz) e 3 (a linha do motor, o cartão). Sorteio semeado pelo evento, evita as últimas falas da partida.
4. **Campo** (`shared/game/pitch/redcard.ts`): `buildRedCardTimeline` monta a cena. Relógio fixo: etapa 1 até 1,9 s, falta em 2,15 s (tudo congela 0,14 s), etapa 2 até 4,0 s, fim em 5,25 s. O juiz é uma trilha própria (`referee`), desenhado pelo `LivePitch` (bolinha branca, anel de apito, cartão).
5. **Diretor** (`PitchDirector.ts`): `startRedCard` / `endRedCard`. A cena termina no cartão, com um momento parado para ler (sem expulso saindo). Ao fim, o expulso some do campo e o time que sofreu a falta cobra, no terço onde ela foi.

## Como o lance se explica no campo

- **Congelada no contato** (0,14 s): todos e a bola param, a câmera continua fechando. É o momento em que a falta fica clara.
- **Ícone e legenda no ponto da falta** (`RED_LABELS` em `redCards.ts`): 🦶 ENTRADA POR TRÁS, ✋ MÃO NA BOLA, 💢 COTOVELADA etc.,.
- **Quem fez e quem sofreu:** o expulso ganha aro e etiqueta vermelhos, o atingido, amarelos.
- **Faixa do cartão:** "EXPULSO" (ou "ADVERTIDO") com o rosto e o nome do jogador. O cartão fica no ar até o fim. No segundo amarelo saem os dois, em sequência.
- **Câmera própria:** larga na jogada, fecha na falta e fica parada no cartão.

## Tipos e variações

| Tipo | Variações | Cena |
|---|---|---|
| `tackle` | `behind`, `twofoot`, `highboot` | carrinho por trás, dois pés, sola alta no meio-campo |
| `lastman` | `pull`, `clip`, `bodycheck` | atacante lançado, o último homem puxa a camisa, enrosca os pés ou dá o ombro |
| `handball` | `line`, `block` | mão em cima da linha após cruzamento; mão num chute da entrada da área |
| `secondyellow` | `late`, `shirt` | amarelo no ar e, logo depois, o vermelho |
| `elbow` | `aerial`, `blind` | cotovelada no duelo aéreo; cotovelada longe da bola |
| `brawl` | `shove`, `melee` | empurrão; confusão com os dois times |

Replays antigos (sem `redKind`) leem a frase do feed (`redKindOf`) e, sem pista, viram entrada dura.

## Para ver e testar

- Galeria: `#lances`, linha "🟥 Cartão vermelho" (tipo, variação, quem é expulso, congelar em ms).
- `shared/game/pitch/redcard.test.ts`: toda variante, em todas as formações, nos dois lados e nas duas entradas (fade/cut): velocidades, limites do campo, juiz, cartões e relógio.
- `shared/game/redCardNarration.test.ts`: as falas, o determinismo e o tipo vindo do motor.

## Para acrescentar uma variação

1. Nova entrada em `RED_VARIANTS` (`redCards.ts`).
2. A cena em `redcard.ts` (um movimento que termina na falta em `C`; o resto é comum).
3. As falas em `linesFor` (`redCardNarration.ts`) e, se for do motor, a frase em `matchNarrative.ts` com o tipo e a variação.
4. Rodar o teste do campo e olhar a cena na galeria.
