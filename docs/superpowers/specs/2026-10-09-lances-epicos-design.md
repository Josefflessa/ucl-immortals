# Lances épicos e mais variedade — design

**Data:** 2026-10-09 · **Status:** aprovado pelo usuário (fases 1–3 de uma vez)

## Objetivo

Aumentar a diversidade dos lances animados no campo ao vivo e criar lances **épicos**
(raros, memoráveis), mantendo a garantia atual: narração e campo contam exatamente o
mesmo lance, com o tempo de cada frase batendo com a imagem.

## Princípios (não negociáveis)

- O motor da partida continua decidindo autor, desfecho (gol/defesa/fora) e assistência.
  O campo e a narração escolhem só *como* aconteceu.
- Uma escolha só (variação + desfecho), sorteada pela semente do evento: mesma partida,
  mesmo lance em qualquer aparelho e replay.
- Todo lance novo: roteiro com velocidades reais (≤ 10 m/s jogador, ≤ 48 m/s bola),
  toques registrados (contorno branco correto), narração com 2–4 frases por etapa,
  aparece na galeria `#lances`, e passa no teste de velocidade e na auditoria completa
  (que passa a forçar **toda** variação × desfecho, não só as sorteadas).

## Épicos

| Grupo | Variação / desfecho | Tipo | Desfechos |
|---|---|---|---|
| Acrobáticos | `bicycle` bicicleta | cross | gol (low/high), defesa (parry/tip), fora (over/wide/bar) |
| | `diving` peixinho | cross | gol (low/high), defesa (parry/catch/feet), fora (wide/post) |
| | `backheel` voleio de calcanhar | cross | gol (low/postin), defesa (catch/parry), fora (wide/post) |
| De longe | `halfway` gol do meio-campo, goleiro adiantado | longrange | gol (high/low), defesa (tip), fora (over/wide/bar) |
| | `olimpico` gol olímpico | corner | gol (postin/high), defesa (tip/parry), fora (post/bar) |
| | `distance` falta de ~35 m | freekick | gol (high/postin), defesa (tip/parry), fora (over/bar) |
| Coletivos | `slalom` arrancada do próprio campo | dribble | os do drible (sem `blocked`/`cleared`) |
| | `tikitaka` 7+ passes | through | os do passe em profundidade |
| Dramáticos | desfecho `double` (duplo milagre) | defesa de chutes `close`/`header` | — |
| | desfecho `posts` (bate nas duas traves) | fora | — |

(`cleared`, "tirou em cima da linha", já existe.)

**Sem assistência:** `olimpico`, `halfway`, `distance`, `slalom` (ninguém dá o último passe).
`tikitaka`, `bicycle`, `diving`, `backheel` podem ser assistidos (o último passe/cruzamento
é do autor da assistência).

### Raridade

- Base: ~1 épico a cada 3–4 partidas com jogadores medianos (calibrada com a contagem
  real de lances animados por partida).
- Multiplicador pela qualidade de quem faz o lance (0,25× a 2×), no atributo que importa:
  acrobáticos → físico + drible; de longe → chute (+ visão no meio-campo);
  arrancada → drible + velocidade; tiki-taka → passe médio do time; duplo milagre → goleiro.
  `posts` é sorte (sem multiplicador).
- Traits dão ×1,6: Cabeceador/Cabeceador Implacável (peixinho), Chute de Longe (meio-campo,
  falta de longe), Cobrador de Falta (olímpico, falta de longe), Dribblador Nato/Técnico,
  Velocista (arrancada), Maestro do Passe/Visão de Jogo/Metrônomo no time (tiki-taka),
  Reflexo Felino (duplo milagre).
- O sorteio normal nunca escolhe um épico; o épico só sai pelo sorteio de raridade.

### Apresentação

- Sem tarja na narração (pedido do usuário): o épico se mostra só pelo lance em si.
- Etapa do chute mais longa nos épicos (1,9 s em vez de 1,5 s): mais câmera lenta na bola.
- Close do chute começa mais cedo e a vinheta é mais marcada.
- Poses: bicicleta (retrato gira de cabeça para baixo no ar), peixinho (mergulho rente ao
  chão), calcanhar (de costas para o gol).

## Comuns novos (2 por tipo)

| Tipo | Variações |
|---|---|
| cross | `trivela` (cruzamento de trivela, curva para o segundo pau, cabeceio); `lowfar` (rasteiro no segundo pau, de primeira) |
| through | `heelpass` (passe de calcanhar nas costas da zaga); `dummy` (corta-luz: um deixa passar para quem vem atrás) |
| dribble | `elastico` (finta para um lado, sai para o outro); `chapeu` (chapéu no zagueiro e finaliza) |
| longrange | `carryshot` (conduz desde o meio e solta a bomba); `knockdown` (escorada de cabeça e chute de primeira) |
| counter | `threevtwo` (3 contra 2 com inversão); `overlap` (ultrapassagem por fora e finalização) |
| corner | `backpost` (escorada no segundo pau para o meio); `nearpower` (rasteiro forte no primeiro pau, desvio de primeira) |
| freekick | `routine` (ensaiada: rolada para o lado e chute); `wide` (falta lateral cruzada na área) |

## Tempos do lance (mudança de estrutura)

Hoje os tempos das etapas são constantes. Passam a ser por lance (`DangerTiming`):

- `leadMs`: jogada inicial (1000 ms; arrancada e tiki-taka ganham uma jogada inicial longa,
  ~3,5–4,5 s, roteirizada como novo padrão de lead-in `slalom`/`tikitaka`).
- `strikeMs`: etapa do chute (1500; épicos 1900).
- Derivados: `buildUpMs = 1500 + leadMs`, `contactMs = buildUpMs + 150`,
  `arrivalMs = buildUpMs + strikeMs`, `endMs = arrivalMs + 1500`, `decisiveMs`.
- O roteiro decisivo continua no próprio relógio; só `S_ARRIVAL`/`S_END` passam a vir do
  timing. Lances normais ficam com os valores de hoje (nenhuma mudança de tempo para eles).
- Etapa 1 longa narra em passos: frase da jogada inicial, frases intermediárias nos
  momentos certos ("passa pelo primeiro... pelo segundo..."), e a frase decisiva.
- Campo (diretor, câmera), corredor da narração (`MatchSimPage`), galeria e auditoria
  leem o timing do lance, não constantes.

## Ferramentas de verificação

- `narrateDanger` aceita `force: { variant, finish, epic }` (testes, galeria, dev).
- Galeria `#lances`: todas as variações e desfechos (épicos marcados).
- Harness `#partida?lance=<tipo>/<variação>/<desfecho>` força um lance na partida de teste
  (só em dev) para checar a sincronia narração × campo de ponta a ponta.

## Critérios de aceite

1. Testes de lances (velocidade, toque, participação, área, etc.) passam para toda variação
   × desfecho × lado × entrada.
2. Auditoria completa passa forçando todas as variações e desfechos (mesmas regras de hoje,
   com as exceções explícitas: bicicleta/peixinho/calcanhar na regra de cabeçada; gol do
   meio-campo na regra de chute de fora).
3. Medição no navegador: etapas da narração viram no tempo do lance (±50 ms) em um lance
   normal, um épico curto e um épico longo; sem saltos de jogadores.
4. Taxa de épicos medida em ~200 partidas simuladas dentro da meta; maior com craques.
5. Typecheck e build limpos; testes do motor (golden/match-play) inalterados.
