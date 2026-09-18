# ADR-001: Estado autoritativo e recuperação do multiplayer

## Status

Aceito

## Contexto

Uma partida online pode atravessar reconexões, hibernação do Durable Object,
troca de host e mensagens que chegam fora do instante em que foram geradas.
Um snapshot atrasado não pode substituir uma fase mais nova, e uma ação feita
durante uma queda só pode ser repetida depois se continuar válida para a mesma
partida e se tiver sido identificada por um comando idempotente.

## Decisão

- O Durable Object continua sendo a única fonte de verdade para saldo, loja,
  escalações, resultados e avanço do campeonato.
- Cada sala mantém uma `stateRevision` monotônica. O cliente rejeita snapshots
  mais antigos e ignora eventos de sockets que já não são a conexão ativa.
- Cada ação de gameplay recebe um `commandId` opaco. A sala persiste uma janela
  limitada de recibos e responde com ACK aplicado, já aplicado ou rejeitado.
  Assim, uma ação enviada cuja resposta se perdeu pode ser repetida sem duplicar
  compra, aposta, draft ou avanço de fase. O cliente mantém em fila apenas
  comandos identificados durante a reconexão; o servidor continua validando a
  fase, o jogador e o saldo em toda tentativa.
- A sala também mantém uma `roomEpoch`, incrementada ao reiniciar a partida.
  Comandos enfileirados antes do reinício são rejeitados, mesmo que o código da
  sala continue igual.
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
- Cada commit atualiza um checkpoint privado e inclui versão do formato de
  armazenamento. Ao carregar, o objeto valida a estrutura mínima da sala e
  falha fechado diante de um registro inválido, evitando substituir uma partida
  corrompida por um lobby novo.
- Cada cliente recebe uma visão da sala filtrada por socket. Credenciais de
  reconexão, saldo, apostas e pacotes pendentes permanecem privados; opções do
  draft também são entregues apenas ao jogador da vez.
- A criação Cloudflare usa um token de reserva de uso único, e o servidor limita
  nomes, identificadores, valores e frequência de mensagens antes de executar
  qualquer regra de jogo.

## Consequências

Comandos de uma queda curta podem ser concluídos automaticamente; comandos
rejeitados continuam exigindo uma nova intenção do jogador. O servidor ainda
faz cópias JSON pequenas por ação, mas o limite de jogadores torna esse custo
previsível e favorece integridade sobre micro-otimização. Clientes antigos
continuam recebendo snapshots completos; clientes atuais usam o fluxo
versionado e os ACKs de comando.
