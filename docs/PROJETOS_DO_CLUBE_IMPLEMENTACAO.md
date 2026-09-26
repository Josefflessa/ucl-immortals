# UCL Immortals — Projetos do Clube

**Status:** estrutura implementada; Recrutamento, Análise, Central de Palpites, Médico, Treinamento, Estádio e Torcida ativos  
**Escopo desta versão:** regras de progressão, contrato de dados e integração dos projetos ativos com solo e online.  
**Observação:** todos os clubes começam no nível 1; cada jogador decide onde investir os créditos da própria campanha.

## 1. Objetivo

Adicionar uma nova camada de progressão à competição sem substituir o elenco,
as características especiais, o técnico, o estádio ou a loja.

O jogador começa com todos os projetos no nível 1 e usa créditos para escolher
qual área do clube desenvolver. Cada escolha deve produzir um efeito visível e
mensurável dentro da partida ou da administração da competição.

A fantasia é a de um clube que vai se estruturando durante a campanha:

- recruta melhor;
- entende melhor os adversários;
- administra melhor o risco dos palpites;
- sofre menos com lesões e suspensões;
- treina o elenco com mais eficiência;
- transforma o estádio em uma vantagem real de mando;
- constrói uma torcida que melhora a receita em casa.

## 2. Onde o sistema aparece

### 2.1 Área principal e subáreas

Renomear a área atual **MEU TIME** para **MEU CLUBE**. Dentro dela, criar duas
subáreas claramente separadas:

- **MEU TIME** — elenco, titulares, reservas, formação, tática e técnico;
- **PROJETOS** — evolução estrutural do clube, incluindo o Estádio.

O Estádio deixa de ficar visualmente acoplado ao Técnico e passa a ser um dos
projetos evoluíveis. O Técnico continua na subárea **MEU TIME**, com sua
filosofia, formação preferida e evolução Prime.

Essa área continua acessível no mesmo local atual, ao lado das áreas já
existentes de partidas, tabela, estatísticas e histórico.

A aba não deve aparecer no setup inicial nem interromper o draft. Ela fica
disponível a partir do momento em que a competição começa e permanece acessível
até o relatório final em modo somente leitura.

### 2.2 Tela principal

O topo da tela mostra:

- saldo atual de créditos;
- rodada/fase atual;
- aviso de que os efeitos pertencem somente ao jogador atual;
- resumo do nível total investido nos projetos.

Ao abrir **PROJETOS**, sete cards são exibidos em uma grade responsiva:

1. Centro de Recrutamento;
2. Núcleo de Análise;
3. Central de Palpites;
4. Departamento Médico;
5. Centro de Treinamento;
6. Estádio;
7. Torcida.

Cada card mostra o nível atual, o efeito ativo, o próximo efeito e o custo para
subir de nível. O jogador deve conseguir entender o benefício sem abrir um
modal.

### 2.3 Upgrade

Ao clicar em **EVOLUIR**, abrir um modal curto com:

- nível atual → próximo nível;
- efeito que será ativado;
- custo exato;
- saldo antes e depois;
- aviso de que o upgrade não pode ser desfeito durante a competição;
- botões **CANCELAR** e **CONFIRMAR**.

O modal deve funcionar com teclado, toque e rolagem no celular. Depois da
confirmação, o card atualiza imediatamente sem recarregar a página.

## 3. Progressão e economia

Todos os sete projetos começam no **nível 1** gratuitamente.

| Evolução | Custo |
|---|---:|
| Nível 1 → 2 | 150 créditos |
| Nível 2 → 3 | 300 créditos |
| Nível 3 → 4 | 500 créditos |
| Nível 4 → 5 | 800 créditos |

O custo é pago uma única vez por evolução. O nível é permanente dentro daquela
campanha, mas volta ao nível 1 ao iniciar uma nova competição.

Regras de economia:

- os créditos usados nos projetos são os mesmos créditos da loja;
- pontos de classificação não podem pagar projetos;
- não existe upgrade parcial;
- não há reembolso;
- o efeito não é retroativo para partidas já encerradas;
- um projeto não pode reduzir o custo de outro projeto;
- cada jogador online possui seus próprios níveis e seu próprio saldo;
- comprar ou evoluir um projeto não altera o clube dos outros participantes.

Os valores foram escolhidos para permitir uma primeira decisão relevante sem
permitir que o jogador maximize tudo rapidamente. Evoluir um único projeto ao
nível 5 custa 1.750 créditos, portanto a especialização continua sendo uma
escolha real durante uma campanha.

## 4. Projetos e efeitos concretos

### 4.1 Centro de Recrutamento

Responsável pelas ofertas de recrutamento recebidas ao fechar uma rodada ou fase.

O projeto respeita a configuração da competição. Se o organizador desligar o
recrutamento, nenhum nível do Centro de Recrutamento cria ofertas do nada.

| Nível | Efeito |
|---|---|
| 1 | Mantém a regra da competição: recebe a quantidade normal de opções e escolhe a quantidade normal de jogadores. |
| 2 | Adiciona **+2 opções** à lista de cada oferta, com limite de 10 opções. |
| 3 | Mantém as opções extras e libera **+1 contratação**: o jogador pode escolher 2 cartas no mesmo recrutamento. |
| 4 | Mantém as duas contratações e libera **1 reroll gratuito por recrutamento**. O reroll é exclusivo do projeto e não é comprado na Loja. |
| 5 | Mantém todos os bônus anteriores e faz o Centro oferecer somente jogadores de **overall 88 ou mais**. |

Exemplo: se a competição oferece 6 jogadores e 1 escolha por rodada, um clube
no nível 2 recebe 8 opções e escolhe 1 jogador. No nível 3, 4 ou 5 recebe 8
opções e escolhe 2; no nível 4 ou 5 também pode trocar a lista uma vez sem
gastar créditos. No nível 5, as 8 opções precisam ter overall 88 ou mais.

Regras adicionais:

- cada contratação entra no banco, nunca diretamente nos titulares;
- uma escolha duplicada na mesma oferta é proibida;
- o jogador pode recusar a oferta normalmente;
- uma oferta pendente continua reservada em caso de reconexão;
- o bônus vale tanto para eventos de liga quanto para fases eliminatórias que
  já ofereçam recrutamento pela configuração atual;
- o projeto não altera a quantidade de cartas do draft inicial.

### 4.2 Núcleo de Análise

Transforma informação sobre o adversário em uma vantagem tática controlada pelo
jogador. A primeira entrega do projeto aproveita o confronto de formações que já
existe no motor; não altera permanentemente os atributos das cartas.

| Nível | Efeito |
|---|---|
| 1 | Mantém o confronto de formações existente e concede **+3 de força-base** quando a formação do jogador leva vantagem. |
| 2 | Aumenta em **50%** cada bônus de atributo da tática escolhida (**1,5×**, arredondado); a vantagem de formação permanece em +3. |
| 3 | A vantagem do confronto de formações sobe para **+5 de força-base**. |
| 4 | Aumenta em **mais 50%** cada bônus de atributo da tática (**2× no total**); a vantagem de formação permanece em +5. |
| 5 | A vantagem do confronto de formações sobe para **+7 de força-base**. |

Mapeamento futuro do Plano de Análise:

| Foco escolhido | Atributos beneficiados |
|---|---|
| Ataque | Finalização e Drible |
| Controle | Passe e Visão |
| Defesa | Defesa e Físico |

O bônus é aplicado somente à simulação daquela partida, apenas aos titulares
capturados no início do jogo. Não altera o card base, não gera química e não
acumula com dois planos.

Para não criar vantagem escondida, a tela da partida deve exibir um selo claro:
**ANÁLISE: CONTROLE +2 — PASSE/VISÃO**.

### 4.3 Central de Palpites

A Central de Palpites aproveita o sistema de apostas já existente na competição.
O nível 1 é exatamente a regra normal: banca fixa de 200 créditos, uma aposta
por partida e retornos padrão. A devolução é uma proteção limitada: no máximo
uma aposta perdida por rodada de liga ou por perna de mata-mata recebe o
percentual do nível; o stake continua sendo debitado no momento da aposta.

| Nível | Efeito |
|---|---|
| 1 | Regras normais de palpites, sem aumento de banca e sem devolução em derrota. |
| 2 | **+50 créditos** no limite de banca da rodada de liga ou do confronto de mata-mata. |
| 3 | Mantém o limite ampliado e devolve **25% do valor apostado** em uma derrota por rodada/confronto. |
| 4 | Adiciona **+50 créditos** ao limite, totalizando **+100**, e aumenta a devolução protegida para **50%**. |
| 5 | Mantém os bônus anteriores e adiciona **+0,25× ao multiplicador final de toda aposta vencedora**: resultado 1,75×, placar exato 2,75× e combinada até 3,75×. |

A proteção é calculada pelo servidor no online e pelo mesmo reducer no solo. Ela
fica registrada junto ao palpite, impedindo duplicação por clique, reconexão ou
reprocessamento da partida. Como a banca faz parte das regras fixas do jogo, o
projeto fica disponível em todas as competições.

O valor de 200 créditos não aparece como opção na criação da competição e não
pode ser alterado pelo organizador. No nível 2, o projeto leva o teto a 250; no
nível 4, a 300.

### 4.4 Departamento Médico

Reduz o impacto das lesões e oferece tratamentos limitados. Cartões continuam
sendo gerados pelo motor normal; o projeto não elimina a disciplina.

| Nível | Efeito |
|---|---|
| 1 | Concede **1 tratamento gratuito por competição**, equivalente à Fisioterapia: reduz em 1 jogo a lesão de um jogador. Os usos seguintes custam 150 créditos. |
| 2 | Os usos pagos de Fisioterapia custam **100 créditos**. Novas lesões duram exatamente 2 partidas. |
| 3 | Os usos pagos de Fisioterapia custam **50 créditos**. Novas lesões duram exatamente **1 partida**. |
| 4 | Quando um jogador retorna de lesão, por tempo ou Fisioterapia, recebe **+5 em todos os atributos**, acumulável a cada retorno. |
| 5 | O bônus de retorno passa a ser **+10 em todos os atributos** por retorno, também acumulável. |

Regras de segurança:

- tratamentos não podem reduzir uma lesão abaixo de zero;
- tratamentos não removem cartão vermelho nem suspensão já aplicada;
- a redução automática só vale para lesões geradas depois da evolução;
- a contratação emergencial gratuita segue as mesmas validações de posição e
  disponibilidade do sistema atual;
- o uso fica registrado no histórico da competição para evitar clique duplo ou
  reutilização após reconexão.

### 4.5 Centro de Treinamento

O treino deixa de ser uma opção da Loja e passa a ser operado pelo Centro de
Treinamento. O fluxo continua sendo o mesmo: escolher um jogador, escolher um
atributo e aplicar um bônus permanente. O servidor confirma o custo e o bônus
da progressão de custo e do bônus do primeiro treino de cada jogador, evitando
duplicação por reconexão ou clique repetido.

| Nível | Efeito |
|---|---|
| 1 | Treino normal: **+3** no atributo escolhido. O primeiro treino custa 100 créditos e cada treino seguinte no mesmo jogador aumenta o custo em 50. |
| 2 | O custo base de **cada treino** cai para 50 créditos. O aumento de 50 créditos por treino no mesmo jogador é mantido: 50, 100, 150... |
| 3 | O primeiro treino de cada jogador concede **+4** no atributo; os demais concedem +3. |
| 4 | Todos os treinos concedem **+4** no atributo escolhido. |
| 5 | O aumento do custo por treino no mesmo jogador cai de 50 para **25 créditos**. |

“Primeiro treino” se refere apenas ao bônus de +4 do nível 3: é o primeiro
treino confirmado daquele jogador em toda a competição. Cada jogador tem seu
próprio contador. O nível 2 altera o custo base de todos os treinos, não apenas
do primeiro. O contador fica no próprio card e no estado autoritativo; sair,
entrar novamente ou reenviar a ação não restaura o bônus. O nível 1 continua
exatamente com a regra que já existia antes da migração para os Projetos do Clube.

### 4.6 Estádio

O Estádio deixa de ficar acoplado à evolução do técnico. O técnico continua
existindo como sistema próprio, incluindo o técnico Prime. O projeto controla
somente o bônus numérico de mando de campo.

| Nível | Mando de campo |
|---|---|
| 1 | **+3 em todos os atributos** dos 11 titulares mandantes. Regra atual do estádio padrão. |
| 2 | **+5 em todos os atributos** dos 11 titulares mandantes. |
| 3 | **+7 em todos os atributos** dos 11 titulares mandantes. |
| 4 | **+9 em todos os atributos** dos 11 titulares mandantes. |
| 5 | **+11 em todos os atributos** dos 11 titulares mandantes e libera a imagem do estádio Prime correspondente ao técnico. |

Regras:

- o visitante nunca recebe o bônus;
- a final em campo neutro não recebe bônus de estádio;
- o bônus é aplicado apenas aos 11 titulares capturados no início da partida;
- o Estádio Prime do técnico não soma dois bônus de mando: aplica-se o maior
  bônus-base disponível;
- o bônus temático do estádio Prime, quando existir, continua separado e pode
  ser aplicado conforme as regras próprias do técnico;
- o placar e o modal de detalhes devem mostrar o valor ativo, por exemplo:
  **Mando de campo: +7 em tudo**.

### 4.7 Torcida

A Torcida é um projeto separado do Estádio e altera apenas os créditos da
recompensa da partida. O nível 1 preserva integralmente o valor que já existia.
Os bônus de casa e fora são calculados sobre a mesma recompensa-base, antes de
qualquer bônus do Magnata.

| Nível | Em casa | Fora de casa | Campo neutro |
|---|---:|---:|---:|
| 1 | +0% | +0% | +0% |
| 2 | +10% | +5% | +0% |
| 3 | +20% | +10% | +0% |
| 4 | +30% | +15% | +0% |
| 5 | +40% | +20% | +0% |

Regras:

- vale para os créditos da liga e do mata-mata quando a competição permitir créditos;
- não altera atributos, química, classificação ou recompensas de bots;
- uma final em campo neutro não recebe bônus de Torcida;
- a recompensa é calculada uma única vez e creditada no mesmo gate autoritativo
  já usado para evitar duplicação após reconexão;
- a Torcida e o Magnata não multiplicam um ao outro: cada percentual é aplicado
  à recompensa-base e depois os bônus são somados;
- a mensagem de créditos mostra a base, o bônus percentual da Torcida, o bônus
  do Magnata e o total.

## 5. Relação com o técnico

O técnico não vira um sexto projeto.

O sistema fica dividido assim:

- **Técnico:** filosofia, formação preferida, química e habilidades próprias;
- **Estádio:** nível de mando adquirido em Projetos do Clube;
- **Torcida:** percentual da recompensa adquirido em Projetos do Clube;
- **Núcleo de Análise:** preparação específica para cada partida.

Ao evoluir o técnico para Prime, o jogador não perde níveis dos projetos. O
Prime continua podendo trocar o estádio visual e liberar o bônus temático, mas
não deve duplicar o bônus-base comprado no projeto Estádio.

## 6. Regras para solo e online

### Solo

O reducer local aplica a mesma transação e as mesmas validações do servidor.
Uma ação inválida não altera saldo, nível ou usos restantes.

### Online

O servidor é a única autoridade para:

- saldo de créditos;
- nível de cada projeto;
- uso de tratamento;
- uso do Plano de Análise;
- contratação extra;
- bônus de treino por rodada;
- recompensa do Estádio e da Torcida.

Eventos sugeridos:

```text
upgrade_club_project
use_medical_treatment
select_analysis_plan
claim_recruitment_bonus
```

Cada evento deve validar o `projectId`, a fase da sala, a rodada atual, o nível
anterior, o saldo e um identificador de ação idempotente. Um segundo clique ou
uma retransmissão da mesma mensagem deve retornar o resultado já confirmado,
sem cobrar novamente.

O snapshot online deve carregar os projetos dentro do estado privado de cada
participante. Os demais jogadores recebem apenas os dados que precisam aparecer
na partida, nunca o saldo ou os custos privados do outro jogador.

## 7. Modelo de dados proposto

```ts
export type ClubProjectId =
  | 'recruitment'
  | 'analysis'
  | 'medical'
  | 'training'
  | 'stadium'
  | 'supporters';

export interface ClubProjectsState {
  levels: Record<ClubProjectId, number>;
}
```

Persistência e compatibilidade:

- estado ausente em uma campanha antiga deve ser interpretado como todos os
  projetos no nível 1;
- campos temporários de uma partida não devem ser gravados como evolução
  permanente;
- a sala online deve normalizar snapshots antigos antes de enviá-los ao cliente;
- a criação de uma nova competição deve gerar o estado completo, sem depender
  de `undefined` espalhado pela interface.

## 8. Integração com o motor de jogo

Os projetos não devem alterar atributos base das cartas. O motor deve calcular
os efeitos no mesmo ponto em que já combina:

```text
atributo base
+ característica especial
+ química
+ técnico
+ formação/tática
+ estádio/mando
+ efeito temporário da partida
= atributo efetivo
```

Cada efeito precisa ter uma origem identificável no detalhamento do jogador ou
da partida. Exemplos:

- `Projeto: Estádio nível 3 (+7 em todos os atributos em casa)`;
- `Projeto: Torcida nível 3 (+20% em casa / +10% fora)`;
- `Projeto: Análise — Defesa (+2 DEF/+2 FIS)`;
- `Projeto: Centro de Treinamento (+4 nesta rodada)`;
- `Projeto: Torcida (+15 créditos)`.

Isso evita que a interface e o motor apresentem valores diferentes e facilita
testar o online.

## 9. Interface e experiência

### Card do projeto

Cada card deve conter:

- ícone e nome;
- frase curta explicando a função;
- indicador `NÍVEL 3/5`;
- efeito atualmente ativo em destaque;
- próxima melhoria em texto secundário;
- custo e saldo suficiente/insuficiente;
- botão de evolução.

### Estados visuais

- nível atual: cor principal do projeto;
- upgrade disponível: botão dourado ativo;
- saldo insuficiente: botão desabilitado, mas explicando o valor faltante;
- projeto no máximo: selo `MÁXIMO`, sem botão inútil;
- efeito usado na rodada: selo `USADO NESTA RODADA`;
- efeito consumível esgotado: contador `0/3 tratamentos`.

### Acessibilidade e mobile

- modal com `max-height` e área interna rolável;
- foco preso ao modal enquanto ele estiver aberto;
- botão de fechar sempre acessível;
- números acompanhados de unidade (`créditos`, `jogo`, `titulares`);
- não depender apenas de cor para indicar ativo ou bloqueado;
- nenhuma informação importante escondida em tooltip exclusivo de desktop.

## 10. Testes obrigatórios

### Economia e progressão

- todos os projetos começam no nível 1;
- custo correto para cada transição;
- saldo insuficiente não altera estado;
- nível 5 não pode subir novamente;
- compra duplicada por clique/retry só cobra uma vez;
- reset de competição devolve todos os projetos ao nível 1.

### Recrutamento

- nível 2 adiciona uma opção sem duplicar jogador;
- nível 3 gera a contratação extra somente no evento 3, 6, 9...;
- nível 4 gera uma contratação extra em cada evento elegível;
- recrutamento desligado na competição continua desligado;
- ofertas pendentes sobrevivem a reconexão.

### Análise

- foco Ataque, Controle e Defesa mapeia para os atributos corretos;
- o bônus é aplicado somente na partida correta;
- não se aplica ao adversário nem à partida seguinte;
- o Plano de Análise não altera o card base nem a química;
- trocar o plano dentro da regra permitida não duplica o bônus.

### Médico

- tratamento reduz lesão no máximo até zero;
- tratamento não remove suspensão ou vermelho;
- os limites de amarelos respeitam o nível do projeto;
- contratação emergencial continua exigindo posição válida;
- uso consumido não volta após reconexão ou refresh.

### Treinamento, estádio e torcida

- desconto e primeiro treino de cada jogador são idempotentes;
- estádio só beneficia o mandante;
- final neutra não recebe bônus de estádio;
- Prime não empilha o bônus-base do estádio;
- Torcida é calculada uma vez sobre a base e não multiplica o Magnata;
- solo e online produzem os mesmos resultados para o mesmo estado.

### Online

- dois clientes evoluindo projetos simultaneamente não conseguem gastar o
  mesmo saldo;
- snapshot privado não expõe créditos de outro jogador;
- uma ação repetida retorna sucesso idempotente ou erro seguro;
- reconexão restaura nível, usos e bônus temporários corretamente;
- o host não ganha poderes especiais sobre os projetos dos demais jogadores.

## 11. Ordem de implementação

### Fase 1 — base segura

1. Criar tipos, constantes de custo e normalização do estado.
2. Adicionar a aba e os cards somente com leitura.
3. Implementar upgrade atômico no solo e no servidor online.
4. Cobrir economia, reset e compatibilidade de snapshots.

### Fase 2 — efeitos de administração

1. Centro de Recrutamento.
2. Departamento Médico.
3. Centro de Treinamento.
4. Testes de reconexão e idempotência.

### Fase 3 — efeitos de partida

1. Núcleo de Análise.
2. Exibição dos efeitos da Análise no resumo da partida e no detalhamento de atributos.

### Fase 4 — economia e acabamento

1. Estádio e Torcida.
2. Histórico de investimentos.
3. Ajustes de balanceamento com simulações.
4. Teste manual em telas estreitas e em sala online com múltiplos jogadores.

## 12. Critérios de aceite

A implementação só deve ser considerada pronta quando:

- o jogador entende o efeito de cada nível sem consultar código;
- nenhum projeto altera permanentemente o atributo base de uma carta;
- cada bônus aparece no detalhamento de onde veio;
- solo e online usam as mesmas regras;
- refresh, reconexão e clique duplo não duplicam compra, carta, tratamento ou
  recompensa;
- o técnico, o Estádio e a Torcida continuam funcionando, mas sem bônus duplicado;
- a aba funciona em celular sem modal cortado ou botão inacessível;
- os testes de motor, reducer, servidor e snapshot passam juntos;
- uma simulação de campanha completa não consegue maximizar todos os projetos
  antes da reta final sem abrir mão de outras compras importantes.

## 13. Decisões ainda calibráveis

Os valores acima formam a proposta inicial concreta. Antes de liberar a
mecânica para todas as competições, devem ser observados:

- quantos créditos médios sobram nas campanhas reais;
- quantas contratações o nível 4 do recrutamento adiciona ao banco;
- frequência de uso do Plano de Análise;
- impacto da mudança de 3 para 4 amarelos;
- se o bônus máximo de mando continua compatível com o estádio Prime;
- se a receita da Torcida acelera demais o acesso à loja.

O ajuste deve ser feito nas constantes de balanceamento, sem reescrever as
regras de persistência, sincronização ou interface.
