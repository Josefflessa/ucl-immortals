# UCL Immortals — análise completa do estado atual

Data da análise: 2026-09-09  
Escopo: código atual do cliente, motor de jogo, servidor online, dados, regras, interface, PWA, testes e documentação histórica.

## Atualização após o primeiro bloco de correções

Em 2026-09-09 foram corrigidos os problemas prioritários de consistência do motor/replay e de integridade online:

- o mata-mata agora usa contexto de knockout desde o minuto 0; ida/volta podem empatar aos 90 e só decidem pelo agregado após a prorrogação;
- o replay entrega o `MatchResult` autoritativo ao reducer, sem reconstruí-lo a partir do estado visual;
- bônus posicionais do treinador usam o papel real na formação no motor e na interface;
- pacotes online são sorteados pelo servidor a partir do catálogo autoritativo e a escolha usa somente ID;
- handlers online passaram a validar treinadores, formações, táticas, escudos, variantes, atributos e papéis;
- o início online exige pelo menos 2 jogadores conectados;
- o reset de sala volta a usar 13 picks/4 vetos e limpa Prime, escudo, pacote pendente e mercado;
- o timer visual e o auto-pick online compartilham 30 segundos;
- a função de revelação de apostas tolera estados antigos/parciais sem `watchedKnockoutMatches`.

Essas mudanças foram acompanhadas por testes de regressão do motor e do fluxo de apostas/online.

## 1. Resumo executivo

UCL Immortals é um manager/simulador de futebol em uma campanha única. O jogador monta um elenco histórico e competitivo, combinando jogadores de diferentes épocas, perfis e raridades; define treinador, formação, estilo, capitão e cobradores; atravessa uma liga curta de 36 equipes e termina em um mata-mata até a final da Ultimate Champions League. A progressão vem de química, cartas com características, evolução, estádio, pontos de loja, reforços e apostas.

Existem dois modos:

- **Solo:** todo o estado vive no `GameContext` do navegador. A campanha não é salva de forma persistente; atualizar a página normalmente perde a sessão.
- **Multiplayer online:** o servidor mantém uma sala em memória, o host simula as partidas de forma autoritativa e os clientes reproduzem o resultado recebido. Não há conta, autenticação ou banco de dados.

O projeto está compilando e o typecheck passa. Após as correções, os testes de regressão do motor/reducer passaram (3 arquivos/97 testes) e os cenários online/reconexão/host passaram (7 arquivos/21 testes, com sobreposição do reducer). A suíte completa não terminou durante a validação porque ficou sem progresso por vários minutos; isso não foi tratado como aprovação da suíte inteira.

O ponto técnico mais importante para futuras mudanças é que o jogo já possui um **motor de simulação bastante rico**, mas ainda há divergências entre motor, reducer, servidor, replay e textos da interface. Antes de adicionar muitas mecânicas, convém consolidar uma fonte única de verdade para o contexto da partida e para a validação online.

## 2. Estrutura do projeto

### Cliente

- `client/src/App.tsx`: roteamento por fase do jogo, sem router de URLs; escolhe a página conforme `state.phase`.
- `client/src/contexts/GameContext.tsx`: estado global, reducer, ações de campanha e integração online.
- `client/src/lib/gameEngine.ts`: tipos de equipe/partida, química, força, draft, bots, liga, mata-mata, simulação, pênaltis e relatório.
- `client/src/lib/gameData.ts`: banco estático de jogadores, treinadores, formações, táticas, raridades e trios históricos.
- `client/src/lib/traits.ts`: catálogo e cálculo das características das cartas.
- `client/src/lib/shop.ts`: economia, recompensas, custos, variantes, treinamento e valores de venda.
- `client/src/lib/discipline.ts`: cartões, suspensões, lesões, escalação substituta e fisioterapia.
- `client/src/lib/bets.ts`: apostas, teto por rodada/jogo e liquidação.
- `client/src/lib/market.ts`: mercado online de jogadores e venda solo.
- `client/src/lib/stadium.ts`: estádio padrão e estádios Prime por treinador.
- `client/src/lib/matchNarrative.ts`: frases/narração contextual da partida.
- `client/src/lib/balanceHarness.ts`: simulador estatístico para balanceamento.
- `client/src/lib/storage.ts`: wrapper seguro de `localStorage`.
- `client/src/lib/crests.ts`: escudos e recursos visuais de clubes.
- `client/src/pages/`: Menu, setup, escudo, treinador, formação, draft, revisão, liga, partida e relatório.
- `client/src/components/game/`: editor de elenco, campo de formação, cartas, loja, mercado, treinador/estádio, abas da liga/mata-mata, apostas, detalhes e explicações de química.
- `client/src/components/ui/`: componentes visuais reutilizáveis baseados em Radix/shadcn.

### Servidor

- `server/index.ts`: Express em produção, Socket.IO, arquivos estáticos e rota SPA.
- `server/handlers.ts`: salas, lobby, draft snake, sincronização, partidas, disciplina, loja, apostas, mercado, reconexão e gates de avanço.
- `server/room-host.ts`: utilidades de hosting/estado da sala.
- `shared/const.ts`: constantes compartilhadas.

### Operação/build

- `package.json`: Vite + React no cliente; esbuild do servidor.
- `vite.config.ts`: Vite, Socket.IO em desenvolvimento, proxy de storage/debug e integração de servidor.
- `wrangler.jsonc`: configuração para servir `dist/public` como SPA em Cloudflare Pages/Worker.
- `client/public/manifest.webmanifest` e `client/public/sw.js`: instalação PWA e cache limitado do shell.
- `docs/superpowers/specs` e `docs/superpowers/plans`: histórico de decisões e implementações anteriores; alguns textos estão desatualizados em relação ao código atual.

Não há README principal descrevendo o jogo inteiro. Este documento serve como mapa técnico atual.

## 3. Fluxo completo da campanha

O fluxo é controlado por `GameState.phase`:

```text
menu/lobby
  -> setup
  -> crest
  -> coach
  -> formation
  -> draft
  -> squad_review
  -> league
  -> match_sim -> league
  -> knockout
  -> match_sim -> knockout
  -> report
```

### Menu e lobby

O menu oferece:

- Jogar solo.
- Criar ou entrar em sala online usando código de 4 letras.
- Como jogar.

Não há login. O nome do time é definido no setup. O online permite até 8 pessoas e a interface exige pelo menos 2 para iniciar. O host escolhe a dificuldade dos bots e inicia a configuração.

No online, a sala é um `Map` em memória do processo Node. Reiniciar o servidor apaga todas as salas. Em lobby, um jogador desconectado é removido; durante uma campanha, ele fica marcado offline por um período para poder reconectar.

### Setup

O jogador escolhe, nessa ordem:

1. Nome do time.
2. Escudo.
3. Treinador.
4. Formação inicial.
5. Estilo de jogo.

A formação define as posições necessárias no draft. O treinador define preferências, modificadores e possibilidade de Prime. O estilo define modificadores de atributos e o perfil tático do motor.

### Draft

O draft solo tem 13 escolhas: 11 titulares e 2 reservas. Cada rodada mostra 6 opções e existem 4 vetos. O timer visual do cliente é 20 segundos; o timer de auto-pick do servidor online é 30 segundos.

As primeiras 11 escolhas tentam preencher as posições da formação. O algoritmo prioriza posição nativa, depois posição secundária e por fim uma vaga disponível. Depois de completar os titulares, as escolhas restantes podem preencher o banco.

As opções são cópias dos jogadores estáticos, para que aplicar uma característica em uma campanha não altere o banco global. IDs já escolhidos são bloqueados dentro do draft. No online, o servidor mantém uma lista global de IDs já escolhidos pelos participantes.

Cada carta de draft recebe uma característica aleatória. A raridade aumenta a chance de ter segunda/terceira característica. `inForm` garante uma característica adicional. Variantes de draft são mutuamente exclusivas.

O draft pode sortear, entre outras, `inForm`, `lobo`, `coringa`, `nomade`, `pilar`, `martir`, `idolo`, `decimoHomem`, `pipoqueiro`, `noe`, `forasteiro`, `capitaoNato` e `magnata`.

### Revisão do elenco

Na revisão o jogador:

- troca jogadores entre titulares e banco;
- troca formação;
- muda tática;
- define capitão;
- define cobrador de pênaltis;
- define cobrador de faltas;
- inspeciona química, características e atributos efetivos.

Ao trocar titular/banco ou formação, a química é reconstruída e cargos inválidos são limpos.

### Liga

A liga cria 36 equipes: o time do jogador e 35 bots. A duração é configurável entre 1 e 35 rodadas, com 18 partidas por rodada. Portanto, não é necessariamente um campeonato completo de turno único; é uma liga de calendário parcial configurável.

Cada rodada é processada assim:

1. O jogador ajusta elenco, loja, mercado e apostas.
2. O time precisa estar disponível/ready quando aplicável.
3. A partida do jogador é simulada pelo motor.
4. As outras partidas da rodada são simuladas.
5. Cartões e lesões são aplicados à disponibilidade futura.
6. A classificação é recalculada.
7. O jogador recebe pontos de loja e pode receber opções de reforço.
8. A rodada seguinte é liberada.

O online faz esse processamento no servidor, normalmente pelo host, e depois distribui o estado/resultados aos clientes. Há gates para que os participantes assistam às partidas antes de avançar e para evitar spoilers.

### Mata-mata

Ao terminar a quantidade de rodadas escolhida:

- a linha de classificação é configurável entre 16 e 24 times;
- até completar os 16 lugares das oitavas, os primeiros entram diretamente e o restante disputa playoffs;
- os times fora da linha escolhida são eliminados. Por exemplo, com 23 classificados, são 9 vagas diretas + 14 times em 7 playoffs, e os 7 vencedores completam as oitavas.

Os playoffs e todas as fases anteriores à final são confrontos de ida e volta. A final é jogo único em campo neutro. O mando alterna na volta. Empates no agregado vão para prorrogação e depois pênaltis.

O bracket é guardado com `playoffs`, `round16`, `quarterFinals`, `semiFinals`, `final`, `currentRound` e `currentLeg`. O resultado agregado de um confronto é separado dos resultados reais das pernas, para não misturar estatística de ida/volta com placar agregado.

## 4. Modelo de estado e fonte de verdade

`GameContext` concentra:

- identidade/dificuldade/modo/sala;
- equipe humana e bots;
- formação, tática, treinador e escudo;
- draft e histórico de escolhas;
- rodada, fixtures, classificação e resultados;
- bracket e confronto ativo;
- resultado autoritativo da partida em `currentMatchResult`;
- relatório e campeão;
- pontos, reforços, pacotes, rerolls, apostas e disciplina;
- estado online, ready, espectadores e gates de visualização.

Os tipos centrais são `Player`, `PlayerCard`, `Team`, `MatchResult`, `MatchEvent`, `PlayerMatchStat`, `LeagueFixture`, `StandingsEntry`, `DraftState` e `KnockoutBracket`.

Cada jogador titular recebe `statId = teamId::playerId` antes da simulação. Isso evita misturar estatísticas quando o mesmo jogador-base aparece em equipes diferentes, algo possível porque os bots podem reutilizar jogadores do banco estático.

O servidor é autoritativo no online para sala, draft, escalação, loja, resultados, disciplina, classificação, recompensas e apostas. O cliente recebe snapshots `room_updated` e os transforma em estado local.

## 5. Conteúdo atual

### Jogadores

O banco base possui 385 jogadores, distribuídos assim:

- Bronze: 31
- Silver: 137
- Gold: 145
- Legendary: 63
- Immortal: 9

O banco cobre 70 clubes e 51 nacionalidades. Há 103 jogadores com posições secundárias explícitas. As posições principais atuais são GK, CB, LB, RB, CDM, CM, CAM, LM, RM, ST, CF, LW e RW. LWB/RWB existem no sistema de posições, mas não há cartas-base específicas nessas posições.

Cada jogador possui atributos de ritmo, finalização, passe, drible, defesa, físico, compostura e visão, além de posição, clube, nação, temporada, raridade, parceiros históricos e treinadores históricos.

Há 9 cartas únicas de loja, todas com overall 99: Kaká, Henry, Neymar, Cruyff, Buffon, Beckenbauer, Maldini, Messi e Cafu. Elas não entram no pool normal de draft/bots e custam 750 pontos.

### Treinadores

Há 6 treinadores:

- **Guardiola:** passe/visão para meio-campistas, passe global e bônus de visão para jogadores com visão alta; formação preferida 4-3-3.
- **Klopp:** físico e ritmo globais, defesa na marcação; pressão extra quando está perdendo; 4-3-3.
- **Mourinho:** defesa/físico, bônus de defesa para goleiro e força no mata-mata para defensores; 4-2-3-1.
- **Ancelotti:** bônus global, extra para craques e bônus especial na final; 4-4-2.
- **Zidane:** bônus global, maior para lendários/imortais e aumento em mata-mata/final; 4-3-3.
- **Ferguson:** físico/passe e finalização; grande bônus global quando está perdendo; 4-4-2.

O estado `coachPrime` habilita o estádio Prime correspondente e pode ser comprado depois de pelo menos 4 vitórias e 500 pontos, por 500 pontos.

### Formações

Há 6 formações: 4-3-3, 4-2-3-1, 4-4-2, 3-5-2, 3-4-3 e 5-3-2. Cada uma define 11 vagas, perfil de ataque/defesa/controle/cruzamento, pontos fortes, fraquezas e formações que ela contra.

No motor, os perfis principais são:

- 4-3-3: ataque moderado.
- 4-2-3-1: defesa e controle.
- 4-4-2: equilíbrio com defesa.
- 3-5-2: controle alto, penalidade de cruzamento.
- 3-4-3: ataque muito alto, defesa muito frágil.
- 5-3-2: defesa alta, ataque e cruzamento reduzidos.

O confronto de formações dá um bônus de matchup para a formação favorecida.

### Táticas

Há 6 táticas:

- Balanced
- Possession
- Counter
- High Press
- Defensive
- All Out Attack

Os bônus reais do motor são:

- Balanced: +2 aos seis atributos principais de campo.
- Possession: passe +5, visão +5, drible +3.
- Counter: ritmo +5, finalização +5, defesa +2.
- High Press: físico +5, defesa +3, ritmo +2.
- Defensive: defesa +8, físico +3.
- All Out Attack: finalização +8, ritmo +4, drible +2.

Além dos atributos, a tática altera ataque, defesa, controle, agressividade, escolha de abordagem e risco de cartões.

### Traços

O catálogo inclui traços de ritmo, finalização, drible, passe, bola parada, jogo aéreo, físico, defesa, liderança, goleiro e versatilidade. Exemplos: Velocista, Finalizador, Maestro do Passe, Muralha, Pressão Implacável, Reflexo Felino, Pegador de Pênalti, Liderança e Versatilidade.

Os traços podem:

- aumentar atributos;
- melhorar defesa de goleiro;
- aumentar compostura em pênaltis;
- aliviar penalidade de posição fora de lugar;
- funcionar apenas em final, mata-mata ou quando o time está perdendo.

O pool estático não traz traços fixos: as cartas de draft e bots recebem traços rolados em runtime. Cartas únicas compradas na loja começam sem rolagem automática de traços.

## 6. Química e atributos efetivos

### Química individual

Para cada titular, o motor verifica primeiro o encaixe de posição. A ordem é posição nativa, posição secundária/default e, em casos especiais, Coringa. Fora de posição, a química individual vai a zero, salvo alívio de Versatilidade/Coringa.

As ligações entre companheiros usam prioridade:

1. mesmo clube: +2;
2. mesma nação: +1;
3. ambos ligados ao treinador atual: +2;
4. parceiro histórico: +1;
5. `nomade` pode tratar nação como compatível.

O vínculo histórico do jogador com o treinador também adiciona um ponto separado. A pontuação é convertida para química individual de 0 a 3.

### Química total

O total é normalizado para 0–100, com extras de formação preferida, trios e variantes. Patamares globais:

- abaixo de 45: sem bônus;
- 45: bônus pequeno;
- 60: bônus médio;
- 75: bônus alto;
- 90: química perfeita.

Na prática, o bônus global fornece aumentos de passe/ritmo e um bônus especial distribuído aos atributos. A química individual gera multiplicadores aproximados de 1.00, 1.03, 1.06 e 1.10. Posição secundária aplica fator próprio; fora de posição aplica penalidade maior.

### Extras

- Formação preferida do treinador: +8 na química total.
- `pilar`: +12 por titular com a variante.
- `lobo`: +6 em atributos próprios, mas -12 na química do time.
- `noe`: +30 de química se a condição de carta única/titular for cumprida.
- Trios históricos: oito combinações, como MSN, BBC, Xavi/Iniesta/Busquets, Maldini/Nesta/Cannavaro e Kaká/Pirlo/Seedorf.

### Ordem do atributo efetivo

O motor parte do atributo base e aplica, em linhas gerais:

1. multiplicador de química/posição;
2. bônus global de química;
3. treinador e fase da partida;
4. tática;
5. capitão;
6. traço;
7. treino/evolução;
8. variante;
9. estádio/mando;
10. efeito de fase da variante;
11. clamp mínimo.

A força da equipe usa os 11 titulares, penaliza indisponíveis e pondera goleiro separadamente. Para bots, o resultado é multiplicado por um fator derivado da dificuldade.

## 7. Características/variantes das cartas

As variantes são o principal sistema de decisões de progressão:

- `inForm`: +3 em todos os atributos.
- `lobo`: +6 em todos, -12 química do time.
- `coringa`: pode atuar em qualquer posição sem penalidade de fora de posição.
- `nomade`: compatibilidade com qualquer nação para química.
- `pilar`: +12 química do time.
- `martir`: -6 no próprio jogador e +3 em até dois companheiros escolhidos.
- `idolo`: +2 em todos os atributos dos outros titulares do mesmo clube.
- `decimoHomem`: se estiver no banco, +1 compostura e +2 visão para os 11 titulares.
- `pipoqueiro`: +4 em todos na liga e -5 em todos no mata-mata.
- `noe`: +10 no próprio jogador em condição específica de carta única/atributo.
- `forasteiro`: +5 se o jogador for o único titular de sua nação e clube.
- `capitaoNato`: dobra o bônus de capitão quando designado capitão.
- `magnata`: multiplica por 1,5 os pontos de partida de liga quando titular, mas -5 em todos os atributos próprios.

Cartas normais podem ter no máximo uma variante. Cartas únicas podem ter até duas. A loja permite turbinar por 300, remover por 150 e, em carta única, remover uma variante específica.

## 8. Simulação de partidas

### Motor único e replay

O motor principal é `simulateMatch`/`runMatchSimulation`. Ele produz `MatchResult` com placar, vencedor, eventos, estatísticas de jogo, estatísticas por jogador, MVP, duelo, duração e pênaltis quando aplicável.

O `MatchSimPage` hoje reproduz eventos de um resultado já calculado, com suspense de três estágios, feed de narração, momentum, posse progressiva, escalações, ratings e pênaltis. O cliente online não recalcula o resultado; ele reproduz o snapshot do servidor.

Cartões, lesões e faltas são gerados pelo motor. Não há substituições reais durante a partida: há tipos/eventos de substituição no modelo, mas não foi encontrado fluxo que emita substituições durante a simulação. O banco é usado para promover jogador indisponível entre partidas.

### Chances e eventos

O laço de minutos combina:

- ritmo/tempo da partida;
- força relativa;
- momentum;
- perfil de formação;
- tática;
- controle de meio-campo;
- ruído aleatório;
- atributos de ataque e defesa;
- goleiro, traços e estádio.

Existem chances abertas, duelos, defesas, finalizações erradas, gols, escanteios/cabeceios, faltas perigosas, gols de falta, own goal, falha do goleiro, desvio, golaço, pênalti e bola na trave. Há limite de chances claras e cooldown para bolas paradas.

### Posse e criação

A posse combina participação de força e volume de chutes, depois recebe efeitos de estilo de posse, contra-ataque e controle de formação. A construção do meio usa passe/visão dos meio-campistas, com vantagem adicional para a tática de posse.

### Pênaltis

Os cobradores são ordenados por compostura + finalização, com o designado priorizado e o goleiro por último. A disputa usa melhor de cinco e morte súbita, limitada a dez rodadas. A chance combina compostura do cobrador e qualidade/reflexo do goleiro.

### Ratings

Os jogadores começam por volta de 6,4. Gols, assistências, defesas, ações, cartões, clean sheet, vitória/derrota e contexto alteram a nota. Ao final há clamp entre 3,0 e 10,0.

## 9. Disciplina e disponibilidade

O mapa de disciplina usa a chave `teamId:playerId` e guarda amarelos, partidas de suspensão e partidas de lesão.

- Acúmulo de 3 amarelos gera suspensão.
- Vermelho gera suspensão.
- Segundo amarelo é tratado como vermelho com contexto próprio.
- Lesões duram de 1 a 3 partidas, com pesos probabilísticos.
- Lesão aplica debuff de -12 nos atributos durante a partida.
- Vermelho aplica penalidade de força; para goleiro, a penalidade é maior.
- Amarelos são zerados ao entrar no mata-mata, preservando suspensões/lesões.
- Fisioterapia custa 250 e reduz uma partida de lesão.

Se um titular está indisponível, `resolveAvailableLineup` promove o melhor reserva compatível; se necessário, usa alguém fora de posição. O capitão e cobradores são reescolhidos se deixarem de estar nos 11.

No solo, a resolução de escalação substituta ocorre automaticamente. No online, o servidor bloqueia ready com titular indisponível e mantém a disciplina autoritativa.

## 10. Bots e dificuldade

Cada partida começa com 35 bots gerados por dificuldade. A dificuldade tem cinco níveis:

- Bronze: força aproximada 0,45;
- Silver: 0,62;
- Gold: 0,75;
- Legendary: 0,88;
- Immortal: 0,97.

Além da força, a geração altera overall-alvo, dispersão, viés de química, chance de treinador inteligente, variantes e escolha de tática. Bots escolhem jogadores por faixa de overall e adequação à formação, recebem banco com goleiro garantido e traços rolados.

O sistema permite que o mesmo jogador-base apareça em mais de um bot; o `statId` por equipe impede conflito estatístico. Existe, porém, risco de colisão de nomes se nomes de jogadores humanos coincidirem com nomes reservados de bots, pois o filtro pode remover mais bots que o previsto.

## 11. Economia, loja e reforços

Pontos de partida de liga:

- vitória: 100;
- empate: 45;
- derrota: 15;
- cada gol de saldo positivo: +12;
- cada gol marcado: +3;
- clean sheet: +20.

Custos principais:

- trocar treinador: 250;
- turbinar: 300;
- pacote de craque: 350;
- scout: 220;
- reroll de reforço: 120;
- remover variante: 150;
- carta única: 750;
- fisioterapia: 250;
- Prime: 500, exigindo 4 vitórias e 500 pontos.

Treino dá +3 em um atributo. O primeiro custa 100 e cada treino anterior aumenta o custo em 50. Evolução de jogador libera 8 pontos depois de 6 aparições como titular; os pontos não têm cap por atributo no código atual.

Após partidas/rodadas o jogo pode oferecer seis opções de reforço, das quais o jogador escolhe uma para o banco. O reroll consome token comprado na loja.

Vendas solo são apenas de reservas, pagas pelo banco com valores por raridade: Bronze 30, Silver 60, Gold 100, Legendary 180, Immortal 250 e Unique 400.

## 12. Estádios

O estádio padrão concede +3 a todos os atributos quando o time é mandante. O estádio Prime do treinador concede +6 e bônus temáticos para jogadores ligados ao clube/nação do estádio.

Estádios Prime:

- Guardiola: Etihad, passe/visão, tema Manchester City.
- Klopp: Anfield, ritmo/físico, tema Liverpool.
- Ancelotti: San Siro, passe/compostura, tema Milan.
- Mourinho: Dragão, defesa/físico, tema Portugal.
- Zidane: Bernabéu, drible/finalização, tema Real Madrid.
- Ferguson: Old Trafford, ritmo/finalização, tema Manchester United.

O código atual é +3/+6. Comentários antigos no motor e alguns planos históricos mencionam +4/+7; esses textos não refletem a implementação testada.

## 13. Apostas

O jogador prevê o placar antes de a partida ser jogada. A stake é debitada imediatamente, funciona como escrow, e editar a aposta ajusta apenas a diferença. Cancelar uma aposta ainda não resolvida devolve a stake.

- placar exato: pagamento de 2,5x;
- vencedor/empate correto: 1,5x;
- erro: zero;
- teto da liga: 200 por rodada;
- teto do mata-mata: 200 por jogo/perna;
- máximo previsto por time: 15 gols.

As chaves distinguem rodada/perna. No online, a revelação é atrasada para evitar spoiler: participantes precisam assistir à perna; não participantes podem receber o resultado conforme o fluxo de exibição.

## 14. Mercado online

No online, o jogador pode listar reserva, removendo-a temporariamente do elenco e colocando-a em escrow. Outro jogador compra, o vendedor recebe e a carta muda de equipe. Cancelar retorna a carta. No solo, vender é venda direta ao banco por valor fixo.

O mercado usa o ID da carta/jogador como referência. Como o mesmo jogador-base pode existir em várias equipes, a identidade de instância/escrow é um ponto que deve ser preservado em futuras extensões.

## 15. Multiplayer online

O protocolo Socket.IO cobre:

- criação/entrada de sala;
- reconexão por `clientId`/nome/código;
- host sticky e transferência após janela de graça;
- draft snake com auto-pick de desconectado/AFK;
- revisão de elenco;
- ready de partida;
- simulação da rodada pelo host;
- sincronização de classificação, disciplina, pontos, apostas e reforços;
- ida/volta do mata-mata;
- espectadores;
- gates de “todos assistiram” antes do avanço;
- reinício de campanha pelo host.

O servidor não oferece autenticação forte: a identidade é baseada em socket, clientId e estado da sala. A sala é temporária e somente em memória.

## 16. Interface e experiência

### Páginas

- `MenuPage`: entrada solo/online, lobby e acesso ao tutorial.
- `SetupPage`, `CrestPage`, `CoachPage`, `FormationPage`: montagem inicial.
- `DraftPage`: escolhas, veto, timer, histórico e espera online.
- `SquadReviewPage`: revisão antes da liga.
- `LeaguePage`: rodadas, tabela, partidas, histórico, elenco, loja, mercado e apostas.
- `MatchSimPage`: replay minuto a minuto, momentum, posse, feed, ratings e pênaltis.
- `ReportPage`: encerramento cinematográfico e resumo da campanha.

### Componentes relevantes

`PlayerCard`, `SquadEditor`, `FormationField`, `CoachStadiumPanel`, `ShopTab`, `MarketTab`, `KnockoutTiesTab`, `BracketTab`, `MatchDetailsModal`, `BetSlipModal`, `BuffBreakdown`, `ChemistryBonusInfo`, `RolesSelector`, `TacticSelector` e `HowToPlayModal` formam a camada principal de interação.

As cartas usam texturas locais WebP, raridade, badges de variante, escudos/bandeiras e fotos externas com fallback. Há dependências de rede para fotos SoFIFA, imagens remotas, fontes e alguns recursos visuais.

### PWA/offline

O app é instalável. O service worker faz cache limitado do shell/navegação; não transforma a campanha em jogo offline completo. Assets hash, imagens remotas, Socket.IO e estado da partida não são garantidos offline. O solo não tem save local.

## 17. Testes e validação realizada

Arquivos de teste cobrem motor, unidades, balanceamento, cartas/lesões, traits, loja, disciplina, apostas, mercado, estádio, reducer de apostas, display/e2e/reconexão online e host de sala.

Resultado da análise:

- `npm run check`: passou.
- `npm run build`: passou; cliente Vite e servidor esbuild foram gerados.
- Regresão pós-correção: 3 arquivos e 97 testes passaram (`gameEngine`, `engine-units`, `betting-reducer`).
- Online/host/reconexão: 7 arquivos e 21 testes passaram.
- Suíte completa: iniciou fora do sandbox, mas ficou sem progresso por vários minutos e foi interrompida; não há conclusão honesta de que todos os testes passam.
- O primeiro erro `Access is denied` veio do sandbox ao esbuild resolver o arquivo de configuração; com execução ampliada o build funcionou. Não é uma alteração de permissão necessária no projeto.

## 18. Discrepâncias e riscos prioritários

### Resolvido — contexto de mata-mata incorreto no motor

Esse problema foi corrigido. `simulateMatch` passa o contexto real aos primeiros 90 minutos; a volta usa uma opção explícita para não decidir o empate isoladamente, compara o agregado e então executa prorrogação/pênaltis com contexto de knockout.

Antes da correção, as consequências eram:

- bônus de treinadores condicionados ao mata-mata não valem nos 90 minutos normais;
- `pipoqueiro` recebe comportamento de liga onde deveria receber penalidade de mata-mata;
- traços de decisão e bônus KO ficam incompletos;
- Mourinho/Zidane e outros efeitos de fase não refletem o texto da interface.

### Resolvido — replay ainda reconstruía resultado na finalização

`MatchSimPage.handleFinish` agora despacha diretamente `replayResult` quando existe. O caminho legado sem resultado pré-computado permanece apenas como fallback defensivo.

Com o replay normalizado, esse caminho não altera mais o resultado autoritativo nem seus `statId`.

### Resolvido — pacote online confiava em dados enviados pelo cliente

O servidor agora ignora objetos/opções de carta enviados pelo cliente, sorteia a partir de `PLAYERS`, guarda as opções autoritativas e aceita apenas o ID no pick, reconstruindo a carta no catálogo do servidor.

A correção estrutural é o servidor sortear e armazenar as opções a partir do banco autoritativo, e aceitar no pick somente o ID, reconstruindo a carta no servidor.

### Parcialmente resolvido — validação runtime online incompleta

Os fluxos prioritários agora validam enums/IDs de treinador, formação, tática, escudo, variante, treino, evolução, papéis e draft. Ainda há outros payloads online que podem receber validações mais rigorosas em uma segunda etapa, especialmente limites numéricos e mensagens de erro estruturadas.

### Resolvido — reinício de sala inconsistente

`restart_room` agora reseta para 13 slots/4 vetos e limpa treinador, Prime, escudo, formação, pacote pendente, mercado e demais campos de campanha.

### Resolvido — timer de draft divergente

Cliente e servidor agora importam a mesma constante compartilhada de 30 segundos.

### Média — tática Balanced contraditória

O texto de `gameData` descreve Balanced como sem reforços, mas `tacticStatBonus` aplica +2 a seis atributos. A interface e o motor podem estar ensinando coisas diferentes ao jogador.

### Resolvido — contexto de posição do treinador

O resolvedor aceita o papel da formação e o motor/editor passam esse papel para os cálculos posicionais. A posição nativa continua sendo o fallback para chamadas que não pertencem a uma escalação.

### Média — substituições não existem na simulação

O modelo e a UI sugerem eventos de substituição, mas a partida usa os 11 titulares do início e não há substituição tática durante os 90/120 minutos. O banco serve sobretudo para disponibilidade entre jogos.

### Média — código legado da antiga simulação ao vivo

Após a unificação planejada, ainda existem funções/imports/comentários da simulação local antiga, incluindo caminho de `simulateRemainingMatch`. Isso aumenta a chance de uma futura melhoria ser feita no caminho errado.

### Baixa/média — relatório com campos cosméticos

Alguns campos legados do relatório, como `mvpFinal` e `biggestDuel`, são aleatórios ou placeholders; a tela calcula grande parte das métricas diretamente. Isso reduz a confiabilidade se novas telas consumirem o objeto de relatório como fonte única.

### Baixa — documentação histórica divergente

Os planos/specs registram decisões antigas, inclusive multiplicadores de aposta e bônus de estádio que já mudaram. Devem ser tratados como histórico, não como especificação atual.

### Baixa — persistência limitada

Solo não possui save. Online depende de o processo manter a sala viva. PWA instalado não significa campanha persistente/offline.

## 19. Ordem recomendada para continuar evoluindo

1. **Alinhar produto e código:** decidir os valores oficiais de Balanced, estádio, bônus dos treinadores e textos do tutorial; atualizar testes e documentação.
2. **Fechar a autoridade online restante:** validar limites numéricos, payloads de evolução/mercado e todas as transições de fase com mensagens de erro estruturadas.
3. **Limpar código morto:** remover o antigo sim local e deixar uma única rota de simulação/replay.
4. **Adicionar testes de integração do servidor:** pacotes autoritativos, payloads adulterados, reset e reconexão.
5. **Só depois ampliar conteúdo:** substituições, mais formatos de liga, save, novos treinadores/cartas, estatísticas avançadas e matchmaking terão menor risco quando a fonte de verdade estiver estável.

## 20. Conclusão

O jogo atual já é um produto jogável completo em termos de loop: montar time, criar química, jogar draft, atravessar liga curta, administrar desgaste/economia, disputar mata-mata e receber relatório final. A base de sistemas é mais profunda do que a superfície inicial sugere: há variantes condicionais, traits, química por links, treinador Prime, estádio, disciplina, pênaltis, apostas, mercado e sincronização online.

O trabalho de melhoria deve partir de três fatos: o motor é o centro correto das regras; o `GameContext` é o centro correto do fluxo; e o servidor precisa ser o centro correto da confiança online. As principais pendências não são falta de conteúdo, mas alinhamento entre esses três centros e a interface que os apresenta.
