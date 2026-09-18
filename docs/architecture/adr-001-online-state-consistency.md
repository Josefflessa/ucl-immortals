# ADR-001: Estado autoritativo e recuperação do multiplayer

## Status

Aceito

## Contexto

Uma partida online pode atravessar reconexões, hibernação do Durable Object,
troca de host e mensagens que chegam fora do instante em que foram geradas.
Um snapshot atrasado não pode substituir uma fase mais nova, e um clique de
gameplay feito durante uma queda não deve ser executado depois sobre um estado
que o jogador já não está vendo.

## Decisão

- O Durable Object continua sendo a única fonte de verdade para saldo, loja,
  escalações, resultados e avanço do campeonato.
- Cada sala mantém uma `stateRevision` monotônica. O cliente rejeita snapshots
  mais antigos e ignora eventos de sockets que já não são a conexão ativa.
- A fila de reconexão fica limitada a handshake e sincronização (`join_room`,
  `create_room`, capacidades e `sync_room`). Ações de gameplay são descartadas
  durante a queda e podem ser repetidas depois da sincronização.
- Cada handler faz backup da sala antes de executar. Exceções restauram o
  backup e não podem persistir uma mutação parcial.
- Confirmações de assistência são vinculadas à rodada/perna exata. Quedas
  transitórias preservam uma confirmação já feita, enquanto `ready` continua
  exigindo confirmação após reconectar.
- O estado persistido é validado contra o código da sala, atualizado com
  revisão monotônica e gravado com tentativas curtas de recuperação. Se houver
  socket ativo sem estado persistido, o objeto falha fechado em vez de criar uma
  sala vazia e sobrescrever o progresso.
- No Durable Object, as mensagens de estado ficam em buffer durante a ação e só
  são enviadas depois que a persistência termina. Falha de persistência restaura
  sala, timers e cursores de sincronização e não publica uma transação incompleta.
- Cada cliente recebe uma visão da sala filtrada por socket. Credenciais de
  reconexão, saldo, apostas e pacotes pendentes permanecem privados; opções do
  draft também são entregues apenas ao jogador da vez.
- A criação Cloudflare usa um token de reserva de uso único, e o servidor limita
  nomes, identificadores, valores e frequência de mensagens antes de executar
  qualquer regra de jogo.

## Consequências

O jogador precisa repetir um clique feito enquanto estava sem conexão, o que é
intencional: evita compras, avanços ou reinícios antigos sendo executados em
uma fase diferente. A sala faz algumas cópias JSON pequenas por ação, mas o
limite de jogadores torna esse custo previsível e favorece integridade sobre
micro-otimização. Clientes antigos continuam recebendo snapshots completos;
clientes atuais usam o fluxo versionado.
