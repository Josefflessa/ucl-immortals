# Feature: Ascensão das Lendas (nome provisório)
**Data**: 2026-10-18 · **Tamanho**: G · **Status**: ideia (planejamento; nada implementado)

## Pitch
Campanha roguelite **infinita** em que o jogador usa **16 cartas do próprio álbum** (11 titulares + 5 reservas, 2 goleiros), sem draft, contra bots que representam **clubes** (o melhor XI do clube no catálogo), com dificuldade crescente por etapas. O Campeonato atual continua sendo onde se conseguem cartas, estrelas e páginas; a Ascensão é onde elas valem.

## Pilares
1. As cartas do álbum são a base de força; as melhorias da campanha só ajudam por cima.
2. As decisões entre as partidas importam tanto quanto as partidas.
3. A dificuldade só sobe: cada um chega ao seu limite.
4. Perder uma tentativa nunca tira nada permanente.

## Ciclo entre os modos
| Modo | Dá | Consome |
|---|---|---|
| Campeonato | cartas, moedas, estrelas, páginas | nada |
| Ascensão | selos, cosméticos, recordes, pouca moeda | as cartas (sem gastá-las) |

Regra de segurança: a Ascensão não paga mais cartas/moedas do que o Campeonato.

## Regras
- **Quem joga**: só conta logada (o álbum só existe para conta). Abre com cartas para fechar 16 e 2 goleiros.
- **Elenco**: 16 cartas, fechado na campanha. O servidor congela nível e bônus de página no início (lendo `user_stickers`).
- **Partida**: jogo único com vencedor (prorrogação e pênaltis já existentes). Todas contam como mata-mata (isKnockout).
- **Vidas**: 3. Derrota tira 1; vencer o chefe devolve 1. Com 0, a tentativa acaba.
- **Etapa**: 5 partidas; a 5ª é o chefe. Vencer o chefe = checkpoint (recompensas garantidas).
- **Parar ou continuar** após cada chefe. Se as vidas acabam no meio da etapa, leva só uma fração (sugestão 30%) do pendente.
- **Banco**: lesões/suspensões como hoje. Sem reserva compatível, joga o melhor reserva fora de posição. **Sem contratação emergencial** (ela traz cartas fora do álbum).
- **Mando**: alternado casa/fora (bônus do Estádio só vale em casa; bot ganha +3 em casa).
- **Retomar**: sai e continua no intervalo entre partidas.

## Adversários e dificuldade
- **35 clubes legend válidos** (XI completo + 5 reservas com 2 goleiros). Benfica não tem goleiro no catálogo; ~18 clubes têm só 1. 57 clubes têm ≥11 cartas; 41 formam XI válido em alguma formação.
- **Faixas**: brasileiros menores → brasileiros fortes e europeus médios → elite europeia → topo (Liverpool, City, Inter, Milan, Bayern). **Bayern = chefe final** (elite tem 1% de vitória).
- **Infinito**: depois dos 35, o ciclo recomeça com bônus maior.
- **Alavancas**: faixa do clube; **bônus de Lenda** (+N em todos os atributos) crescente; **Núcleo de Análise do bot** (bots não têm projetos de clube: nível maior amplia vantagem de formação e bônus de tática).
- **Dados de calibragem** (simulação, 300 jogos/célula, semente fixa): cada +1 de bônus ≈ +1,2 de força efetiva ≈ 6–8 pontos percentuais de vitória perto de 50%; curva íngreme (4–5 pontos de bônus levam de 50% a 10%).

| Time do jogador (4-3-3, sem química de clube) | Força | vs legend mais fraco (Vitória) | vs mediano (Chelsea) | vs Bayern |
|---|---|---|---|---|
| Elite (XI 93, química 51) | 87 | 95% | 46% | 1% |
| Forte (XI 88, química 32) | 82 | 58% | 5% | 0% |
| Médio (XI 83, química 20) | 71 | 2% | 0% | 0% |

- **Química do legend é a decisão central**: legend de clube tem química 80–90 (força +3 em tudo); bots atuais têm 15–31; elenco misto do jogador tem 20–50. Opções: bônus negativo nas primeiras etapas (simulação sugere −3, −1, +1, +2,5, +4, depois +1 por etapa; chefe +2) ou limitar a química dos legends (~60). Os times de teste não tinham química de clube: elenco bem montado fica acima da tabela. **Medir coleções reais antes de fechar.**

## Intervalo, melhorias, loja e características
- **Intervalo**: recuperar (fisio/Médico), preparar (trocar titulares, formação, tática), loja, e **escolher 1 de 3 melhorias** após cada vitória.
- **Ofertas gravadas no estado** antes de aparecer (hoje só pacotes têm oferta estável após recarregar).
- **Melhorias grátis** (build; temporárias; não alteram a carta do álbum): tática (níveis de análise), clube (subir treino/estádio/análise), resiliência (+1 vida, curar lesão), relíquias (efeitos passivos de time; única parte realmente nova, começar pequena).
- **Loja paga**: características (3 ofertas por intervalo, preço crescente, limite por campanha; o caminho de conceder existe: `applyShopVariant`, limite 1 por carta, 2 nas Únicas), fisioterapia, trocar técnico, treino.
- **Pool de características curado**: fora as que dependem de banco grande (12º Homem, Colecionador, Lapidador), as sem teto em campanha infinita (Prodígio, Goleador, Garçom, Arrogante, Conquistador) e as que dependem de missões/apostas. Funcionam bem as de créditos, estilo e química.
- **Fora da v1**: missões, apostas, recrutamento, Pacote Único, venda de reserva. Técnico Prime (exige 4 vitórias na tabela) precisa ser reescrito.
- **Evolução por titularidade** segue dentro da campanha (zera ao fim).

## Economia
- Hoje ≈100 créditos/jogo; numa etapa de 5 partidas ≈250–550 (650–750 com 5 vitórias). Sem pacotes/Caça-Talentos/recrutamento sobra dinheiro: preços precisam ser sumidouros estruturados.
- Treino quase irrelevante (+3 num atributo ≈ 0,04 de força). **Estádio** é o melhor retorno por crédito.
- Ajustes sugeridos: vitória 100→120, derrota 15→25, prêmio de etapa +150, Turbinar 300→200 com limite por etapa, Estádio como sumidouro central.

## Recompensas permanentes
- **Selos** (Mural de Lendas): um por clube-chefe vencido; tabela própria.
- **Cosméticos**: itens `rewardOnly` nos catálogos existentes (molduras, capas, estilos de nome), concedidos com `INSERT OR IGNORE`.
- **Título**: não existe hoje; exige coluna nova no perfil + tabela de posse.
- **Recordes pessoais**: etapa máxima, maior sequência.
- **Moedas**: pouco, por marco, **uma vez só** (ledger com PK `(user_id, milestone_key)`), nunca por partida (interage com venda de cópias: Única vale 300, banner custa 25/50).
- **Pacote de prestígio** (opcional): conceder `pack:<tier>` existente em marcos únicos.
- **Sem ranking** por enquanto (futuro: semanal por etapa alcançada).

## Arquitetura e proteção
- **Dados**: tabelas próprias (campanha em andamento, campanhas concluídas com chave única, selos, recordes). **Não usar `competition_history`**: conquistas, eventos, ranking mensal e `syncCampaignGrants` (moedas + pacotes) leem tudo sem filtrar modo; o CHECK de `mode` aceita só solo/online e recriar a tabela arrisca apagar `competition_records` em cascata.
- **Código**: lógica da campanha em `shared/`, determinística e com semente (o motor aceita `withRandomSource`/`seededRandom`, hoje só usado em testes). Semente persistida antes de cada partida (hoje há janela de ~400 ms em que recarregar refaz o resultado; apagar o save é livre).
- **Estado**: campo novo `gameKind` (há ~88 usos de `mode === 'solo'|'online'` no cliente). Salvamento próprio (slot solo atual é único por dono). Lista de fases salvas existe duplicada (cliente e servidor).
- **Deploy**: migração aditiva primeiro, código depois (Worker único).
- **Proteção**: V1 cliente-confiável com recompensas só cosméticas/prestígio (já existem furos parecidos: relatório solo autodeclarado, records forjáveis). V2: servidor reproduz a campanha pela semente + registro de escolhas antes de pagar moeda/pacote.
- **Menu/presença**: entrada nova; estado "ocupado" durante a campanha; relatório próprio.

## Impacto por sistema
| Sistema | Impacto |
|---|---|
| Campeonato / draft | nenhum |
| Motor de partida | pequeno: partida avulsa + modificador de time |
| Loja de campanha | itens saem; treino perde valor |
| Projetos do clube | saem recrutamento, palpites, missões |
| Disciplina | muda: sem contratação emergencial |
| Química / formações | ficam; legend precisa de regra de química |
| Álbum / trocas | nenhum (posse e nível só crescem; trocas movem só cópias sobressalentes) |
| Moedas / banners | nenhum, com ledger limitado |
| Conquistas / eventos / ranking | nenhum (ficam fora do histórico) |
| Perfil / Mural | blocos novos (selos, título, recordes) |
| Online | nenhum |
| Relatório | novo formato |

## Riscos
- Calibragem (química + curva íngreme) — precisa de dados reais de coleções.
- Tamanho do estado em campanha infinita (limite nuvem 16 MB comprimido): podar resultados.
- Recarregar para refazer resultado/oferta: coberto pela semente e pelas ofertas gravadas.
- Modo de fim de jogo pode esvaziar: Mural, recordes e selos precisam segurar interesse.
- Mesma pessoa em dois legends (ex.: Messi no Barça e no PSG): aceitável.

## Marcos
0. Medir coleções reais e fechar a calibragem (consulta somente leitura ao D1 de produção, com autorização).
1. Núcleo determinístico em `shared/` (etapas, vidas, semente, 1 legend).
2. Elenco, 35 legends e partida avulsa.
3. Intervalo, melhorias, loja e características curadas.
4. Salvamento próprio e tabelas.
5. Recompensas: selos, cosméticos, título, recordes.
6. Calibragem final e polimento.
7. V2: servidor reproduz a campanha; depois ranking semanal.

## Decisões em aberto
1. Química dos legends: manter alta (bônus negativo no começo) ou limitar (~60)?
2. Banco: 5 reservas ou 7?
3. Fração perdida se as vidas acabam no meio da etapa (sugestão 30%).
4. Pacote de prestígio nos marcos: entra ou não?
5. Título (coluna nova no perfil): incluir já?
6. Autorizar a medição das coleções reais (consulta só leitura) no marco 0.

## Ideias descartadas nesta sessão
- Teto de poder por soma de notas (o usuário preferiu sem teto).
- Campeonato fixo de 36 legends como primeira versão (substituído pela campanha infinita).
- Bloqueio de carta para troca durante a campanha (desnecessário: posse só cresce).
- Evolução por titularidade permanente na conta (mantida só dentro da campanha).
- Talentos como recompensa do modo (fora do escopo por ora).
