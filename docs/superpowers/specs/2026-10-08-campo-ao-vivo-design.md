# Campo ao vivo na partida

Data: 2026-10-08 · Branch: `master`

## Problema

A tela da partida (`client/src/pages/MatchSimPage.tsx`) só narra em texto: um banner "AO VIVO" com a última frase, uma sobreposição de perigo com três pontinhos e um feed de lances. O jogador não vê onde a bola está nem como o lance aconteceu.

Levantamento factual que o desenho precisa respeitar:

- O motor (`shared/game/engine/matchSim.ts`) decide, em cada chance, o tipo de jogada (`approach`), o atacante, o defensor, o jogador aberto (`widePlayer`), o goleiro, o assistente/criador e o tipo de finalização. Mas descarta tudo isso. `MatchEvent` (`teamModel.ts:247`) guarda só `playerId`, `opponentId`, `assisterId` e o texto já pronto.
- A tela **sorteia de novo** o tipo de jogada para narrar as etapas do lance (`MatchSimPage.tsx:403`, `selectApproach` com `random()` sem semente), além de outros textos (`buildUpDesc`, `dangerAttemptMsg`, `saveCelebMsg`, `missCelebMsg`). Isso gera dois problemas: a narração das etapas pode contradizer a descrição do motor, e no online cada jogador da sala lê um texto diferente para o mesmo lance.
- Pênaltis e faltas diretas durante o jogo saem como `goal`/`save`/`miss` comuns. Só a prosa da descrição os distingue.
- O relógio anda 1 minuto a cada 222 ms (`TICK_MS`). Só `goal`/`save`/`miss` disparam a sequência de perigo: 3 etapas de 1.500 ms, com o relógio congelado. Depois de um gol entra a comemoração em tela cheia (`GoalCelebration`, 2,8 a 3,6 s).
- Não existe cor de time; a tela usa dourado (`#ffd700`, o seu lado) e índigo (`#6366f1`, o adversário).
- Não há intervalo nem substituições. A prorrogação é a continuação dos minutos 91 a 120.

## Objetivo

Um campo 2D visto de cima, no topo da coluna principal da partida, que encena tudo o que a narração conta, no estilo das transmissões de rádio e do "lance a lance". Entre os lances, mostra onde a bola está e quem domina. Nos lances perigosos, encena a jogada que o motor de fato simulou, sincronizada com as 3 etapas da narração. **A partida dura exatamente o mesmo que hoje.** Resultados, balanceamento e regras não mudam.

Decisões do usuário:

| Tema | Decisão |
|---|---|
| Posição | Topo da coluna principal, no lugar do banner "AO VIVO" e da sobreposição de perigo; narração logo abaixo do campo |
| Jogadores | Bolinhas com número para os 22; quem participa do lance vira rosto grande com nome |
| Cores | Dourado (o seu lado) × índigo (adversário), as mesmas da tela atual |
| Pênaltis | A disputa acontece no campo e substitui o modal atual |
| Desligar o campo | Não existe opção; o campo é parte da partida |

## Fora do escopo

- Física ou simulação contínua: o resultado continua vindo do motor por eventos.
- Substituições, intervalo e troca de lado, que o jogo não tem.
- Cores por clube, uniformes, som.
- Mudanças em `server/` além do que vem de graça por `shared/`. O servidor continua só simulando e enviando o `MatchResult`.

## Arquitetura

Quatro camadas, cada uma com uma responsabilidade:

```
motor (shared/game/engine)      registra o lance em MatchEvent.play
        │
narração (shared/game)          texto das etapas a partir de play, com semente do evento
        │
diretor (shared/game/pitch)     play + instante t  →  posição da bola e dos 22
        │
tela (client/.../pitch)         LivePitch desenha; MatchSimPage informa relógio e etapa
```

### 1. Motor: `MatchEvent.play`

Novo campo opcional em `MatchEvent`:

```ts
type PlayKind =
  | 'cross' | 'through' | 'dribble' | 'longrange' | 'counter'   // jogo corrido
  | 'corner' | 'freekick' | 'penalty'                            // bola parada
  | 'own_goal' | 'blunder' | 'deflected' | 'screamer' | 'woodwork'; // lances de sorte

type PlayShot = 'normal' | 'header' | 'long_range' | 'one_on_one' | 'first_time'; // o ShotType que o motor já usa

interface MatchPlay {
  kind: PlayKind;
  shot?: PlayShot;
  attackerId?: string;   // quem finaliza (ou bate o pênalti/falta)
  creatorId?: string;    // quem serve: cruzamento, passe, escanteio
  wideId?: string;       // jogador aberto usado no cruzamento
  defenderId?: string;   // marcador do lance
  goalkeeperId?: string; // goleiro que defende
}
```

- Preenchido em todo `goal`, `save` e `miss` (jogo corrido, escanteio, falta, pênalti e lances de sorte), e no `duel`.
- **Só registra valores que o motor já calculou.** Nenhuma chamada nova a `random()` entra na simulação. Uma partida com a mesma semente gera os mesmos placares, eventos e textos de antes, mais o campo `play`.
- `kind: 'penalty'` e `'freekick'` passam a distinguir esses lances sem depender da prosa.
- O `momentum` que antecede uma chance não recebe `play`. A chance que vem logo depois carrega tudo.
- `PenaltyKick` (cobranças da disputa) ganha `takerId` e `gkId`, para o campo mostrar o rosto do batedor e do goleiro.

### 2. Narração determinística

- `MatchSimPage` para de chamar `selectApproach`. As etapas usam `event.play.kind`.
- `buildUpDesc`, `dangerAttemptMsg`, `saveCelebMsg` e `missCelebMsg` passam a rodar dentro de `withRandomSource(seededRandom(seedDoEvento), …)`. A semente vem de `seedFromString` sobre `minuto + tipo + time + jogador + índice do evento`. Essas funções já existem em `shared/game/random.ts`.
- Resultado: o mesmo lance gera o mesmo texto em qualquer aparelho e em qualquer repetição.
- O defensor citado no texto passa a ser o `play.defenderId`, e não o goleiro, como acontece hoje por engano (`MatchSimPage.tsx:406`).
- Se o evento não tiver `play` (resultado salvo antes da atualização), o texto usa uma abordagem neutra coerente com o desfecho, também com semente.

### 3. Diretor: `shared/game/pitch/`

Funções puras e sem dependência de DOM, testáveis no Vitest.

- **Coordenadas:** metros de um campo 105 × 68. O lado do usuário ataca para a direita (x crescente). A tela espelha o adversário; o diretor sempre recebe "time A ataca para a direita".
- **`formationLayout(team, side)`:** posições base dos 11 a partir de `FORMATIONS` (`gameData.ts`, slots x/y 0 a 100), com goleiro na pequena área.
- **`flowState(input, t)`, o jogo corrido:**
  - Entradas: posse (definida pelos eventos `momentum`/`duel` do minuto e pela barra de domínio), dono da bola (o meio-campista do evento de fluxo ou um sorteio com semente) e o domínio de 0 a 100.
  - Os blocos se deslocam juntos conforme o domínio, com a defesa alinhada e as linhas compactas.
  - A bola faz passes curtos entre jogadores do time com a posse. A sequência de passes é gerada por semente a partir do minuto.
- **`buildDangerTimeline(event, teams, seed)`, o lance perigoso:**
  - Monta uma linha do tempo de 4.500 ms em 3 trechos alinhados às etapas: construção de 0 a 1.500 ms, finalização de 1.500 a 3.000 ms e desfecho de 3.000 a 4.500 ms.
  - Cada `PlayKind` tem um roteiro com 2 a 4 variações escolhidas pela semente: lado esquerdo ou direito, ponto de chegada na área, primeiro ou segundo pau.
  - O desfecho depende do tipo de evento:
    - gol: a bola cruza a linha entre as traves e balança a rede;
    - defesa: o goleiro alcança a bola, e às vezes ela sai para escanteio;
    - para fora: a bola passa fora do gol, ao lado ou por cima;
    - trave: a bola bate no poste e volta;
    - desarme: o defensor toma a bola antes da finalização.
  - Os jogadores que não estão no roteiro seguem o deslocamento do bloco em direção à bola.
- **`sampleTimeline(timeline, t, out)`:** escreve em um buffer pré-alocado (`Float32Array`) as posições x, y da bola e dos 22 e a altura (z) da bola. Interpola com suavização e não cria objetos por quadro.
- **`quickEventCue(event)`:** devolve o marcador de 1 s para falta, cartão, lesão e mudança de tática (ícone, posição e jogadores destacados).
- **`buildShootoutTimeline(kick, seed)`:** uma cobrança de pênalti da disputa, com o canto da bola e o pulo do goleiro coerentes com gol, defesa ou erro.

### 4. Tela: `client/src/components/game/pitch/`

- **`LivePitch`:**
  - Desenha o gramado, as linhas e as redes em um SVG estático.
  - Desenha 22 bolinhas e a bola como `div`s posicionados por `transform: translate3d`.
  - Uma camada de rostos mostra os protagonistas do lance (até 4), com anel na cor do time e o nome.
  - Uma camada de marcadores mostra o apito, o cartão, a lesão e o selo de tática.
  - A borda tem uma linha fina de perigo, na cor de quem ataca.
- **Laço de animação:** um único `requestAnimationFrame` no componente. A cada quadro chama `sampleTimeline` e aplica os `transform` por `ref`. O React só re-renderiza em mudanças estruturais: evento novo, protagonistas, expulsões e lesões.
- **Tempo:** o campo não tem relógio próprio. Recebe da página o minuto atual, a etapa do lance com o instante em que ela começou e o estado de pausa, e calcula o `t` a partir disso. Pausa, aba em segundo plano e "Pular" mantêm o campo sempre alinhado à narração.
- **Câmera:** no lance perigoso e nos pênaltis, um `transform: scale/translate` no contêiner aproxima cerca de 1,6× a área do lance, com transição suave. Com `prefers-reduced-motion`, não há zoom e as transições de entrada e saída viram esmaecimentos.
- **Etapas que retomam da pausa:** hoje cada etapa do lance recomeça os 1.500 ms inteiros ao sair da pausa. Os temporizadores passam a guardar o tempo já decorrido, para o campo e a narração continuarem exatamente de onde pararam.
- **Componentes extraídos:** para `MatchSimPage.tsx` (1.450 linhas) não crescer, o campo (`components/game/pitch/`) e o painel da disputa de pênaltis (`components/game/match/ShootoutPanel.tsx`) ficam em arquivos próprios, e o desenho do lance fica no `PitchDirector`.

### Tela da partida depois da mudança

- Coluna principal:
  1. campo;
  2. faixa de narração com a frase atual (substitui o banner "AO VIVO" e a sobreposição de perigo);
  3. feed "TRANSMISSÃO DE LANCES", que não muda.
- Coluna lateral (momentum, estatísticas e botões de time): não muda.
- Disputa de pênaltis: no campo, com o placar da disputa acima dele. O modal atual é removido.
- No celular: placar, campo (largura total, cerca de 360 × 235 px), narração, feed e lateral.

## O que o campo mostra

Orientação: o seu time sempre ataca para a direita. No online, cada jogador vê o próprio time atacando para a direita.

| Momento | Encenação | Pausa o relógio? |
|---|---|---|
| Início e saída após gol | 22 na formação, saída do meio-campo pelo time que sofreu o gol | Não |
| Jogo corrido | Bola circulando no time com a posse; blocos sobem e descem com o domínio | Não |
| Chute "de passagem" (evento `stat` com chute) | Chute rápido, travado ou para fora | Não |
| Falta | Apito no local, rostos do infrator e da vítima por cerca de 1 s | Não |
| Amarelo e vermelho | Cartão sobre o jogador; no vermelho, o jogador sai e o time fica com 10 | Não |
| Lesão | Ícone de lesão; o jogador continua em campo, marcado como lesionado (o motor não o tira da partida) | Não |
| Mudança de tática | Bloco muda de forma (linhas mais altas, baixas ou abertas) e aparece um selo com o nome da tática | Não |
| Desarme (`duel`) | Defensor rouba a bola; a posse muda | Não |
| Escanteio sem chance | Bola vai à bandeirinha, cobrança e afastamento | Não |
| Lance perigoso (`goal`/`save`/`miss`) | 3 etapas encenadas com câmera aproximada e protagonistas com rosto | Sim (as mesmas 3 × 1.500 ms de hoje) |
| Gol | Rede balança e o artilheiro corre para comemorar; depois entra a comemoração em tela cheia que já existe | Sim (como hoje) |
| Prorrogação | Selo "PRORROGAÇÃO"; mesma encenação | Não |
| Disputa de pênaltis | Câmera em um gol; batedor e goleiro com rosto; mesmo tempo por cobrança de hoje (1.900 ms de preparação e 1.700 ms até a próxima) | Sim (como hoje) |

Controles: "Pausar" congela tudo, inclusive no meio de um lance. "Pular" leva ao estado final.

## Visual

- Gramado escuro com faixas sutis, linhas brancas translúcidas e redes nos gols, coerente com o tema escuro do jogo.
- Bolinhas: dourado para o seu time e índigo para o adversário, com o número da camisa. O goleiro tem um tom mais escuro e contorno.
- Protagonistas: rosto cerca de 2× o tamanho da bolinha, anel na cor do time e nome em uma etiqueta.
- Bola branca com sombra no chão. Com altura, fica maior e se separa da sombra.
- Ícones do conjunto do jogo (lucide), sem emoji.
- Responsivo: o campo ocupa a largura da coluna, na proporção 105:68.

## Desempenho

- Meta: 60 fps no celular, verificada com a CPU reduzida em 4× no DevTools.
- Somente `transform` e `opacity` animam, sem mudanças de layout por quadro.
- O diretor monta a linha do tempo uma vez por lance; por quadro, só interpola 23 posições em buffer pré-alocado.
- Fotos: apenas dos protagonistas, em baixa resolução (`PlayerPortrait lowRes`). As 22 já são pré-carregadas no início da partida (`preloadPlayerPhotos`).

## Robustez

- **Determinismo:** todo sorteio visual e de narração usa semente derivada do evento, e o mesmo `MatchResult` gera o mesmo espetáculo em qualquer aparelho.
- **Compatibilidade:** se um evento não tiver `play` (campanha solo salva ou sala online anterior à atualização), o diretor e a narração montam um lance genérico coerente com o tipo e o desfecho do evento.
- **Dados ausentes:** um jogador não encontrado vira bolinha anônima, e um time sem formação conhecida usa 4-4-2.
- Nenhum erro do campo pode interromper a partida: o `LivePitch` fica dentro de um limite de erro (error boundary) que, em caso de falha, volta para a faixa de narração atual.

## Testes

1. **Motor inalterado:** um conjunto fixo de partidas com semente é simulado com o código atual e o resultado (placares, tipos, minutos, jogadores e descrições dos eventos) é salvo como referência. Depois da mudança, o resultado tem que ser idêntico, ignorando apenas o campo `play`.
2. **`play` completo:** em centenas de partidas com semente, todo `goal`/`save`/`miss`/`duel` tem `play` com papéis coerentes. O finalizador e o criador são do time atacante; o defensor e o goleiro são do time que defende; `penalty` e `freekick` aparecem onde o motor os gera.
3. **Narração determinística:** o mesmo evento produz o mesmo texto; eventos sem `play` produzem texto válido.
4. **Diretor:** para cada `PlayKind` e cada desfecho:
   - a bola está no ponto de finalização na marca de 1.500 ms;
   - no gol, a bola termina dentro do gol; na defesa e no chute para fora, termina fora;
   - todos os pontos ficam dentro dos limites do campo, com margem para a rede;
   - a mesma semente gera a mesma linha do tempo;
   - a amostragem não aloca objetos por quadro.
5. **Galeria de lances (apenas em desenvolvimento):** uma rota que não entra no build de produção e permite disparar qualquer `PlayKind` com qualquer desfecho, em velocidade normal ou lenta, para revisão visual de cada roteiro.
6. **Verificação na tela real:** partidas solo e online no preview, no celular e no desktop, com pausa e "Pular".

## Ordem de construção

Cada etapa termina com os testes passando e verificação no navegador quando houver tela.

1. Motor registra `play` e teste de motor inalterado.
2. Narração determinística usando `play`.
3. Diretor: layout, jogo corrido, roteiros de perigo, marcadores e pênaltis, com testes.
4. `LivePitch` e a galeria de lances.
5. Integração na `MatchSimPage` com o hook `useMatchReplay`.
6. Disputa de pênaltis no campo.

O commit e o push só acontecem depois que o usuário testar e aprovar.
