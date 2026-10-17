# Feature: Álbum de figurinhas
**Data**: 2026-10-10 · **Tamanho**: G · **Status**: implementado (2026-10-10)

## Implementação
- Regras: `shared/game/album.ts` (páginas, níveis, pacotes, economia) e `shared/game/clubRewards.ts`.
- Servidor: `server/album.ts` + rotas `/api/account/album*` em `server/account-api.ts`; migração `0018_album.sql`.
- Cliente: `client/src/contexts/AlbumContext.tsx` e `client/src/components/album/` (livro, ficha, abertura, inventário, loja, aviso de pacotes).
- Níveis nas cartas próprias: prop `showAlbumLevel` do `PlayerCard` (draft, Meu Time, mercado, relatório).
- Moldura/fundo de clube: `client/src/components/account/ClubRewards.tsx`, usados em `AvatarFrame` e no perfil.

## Pitch
No modo com conta, o álbum vira uma coleção de verdade: você ganha pacotes jogando, cola as
figurinhas nas páginas de cada clube, usa as repetidas para evoluir a moldura dos jogadores
(★1 a ★5) ou vende para comprar mais pacotes, e fecha times para ganhar recompensas do clube.

## Objetivo / fantasia
Equilibrar vontade de completar, orgulho de exibir e motivo para jogar mais.
"Estou completando o maior álbum da história da Champions — e meus craques favoritos têm a moldura mais rara."

## Como o álbum funciona
- **Organização**: por liga → uma página por clube → uma vaga para cada carta daquele clube
  (versões normais, versões de clube e Únicas).
- **Só clubes com 10+ cartas têm página própria** (hoje 47 de 121). Os demais entram numa
  **página compartilhada por região** ("Outros clubes da Inglaterra", "…da Itália", "…do Brasil",
  "…do Resto do Mundo"), com as figurinhas agrupadas por clube. Quando um clube chega a 10 cartas,
  ganha página própria automaticamente.
- **Vaga**: vazia (silhueta numerada) ou colada (a carta, com o nível em estrelas).
- **Página**: contador "31/40" com barra; destaque para páginas quase completas ("falta 1!").
- **Progresso total**: "Álbum 38% · 12 páginas completas".

## De onde vêm as figurinhas
- **Pacotes por dificuldade** (Bronze, Prata, Ouro, Lendária, Imortal), com 5 cartas e chances
  por carta. Ouro: 34% Prata, 52% Ouro, 12,9% Lendária, 1% Imortal e 0,1% Única; Lendário:
  60% Ouro, 35,5% Lendária, 4% Imortal e 0,5% Única; Imortal: 32% Ouro, 54,5% Lendária,
  12% Imortal e 1,5% Única. Pacotes Prata, Ouro, Lendário e Imortal garantem ao menos uma carta da raridade
  indicada ou melhor; envelopes usam as mesmas chances, mas não têm garantia.
- **Campeão** na dificuldade X → 1 pacote X (5 figurinhas). Primeiro título numa dificuldade → +1 pacote.
- **Toda campanha terminada após a ativação do álbum da conta** → 1 envelope (2 figurinhas) da dificuldade jogada.
- A ativação acontece automaticamente ao carregar os dados da conta ou salvar uma campanha; não exige abrir a tela do álbum. Campanhas anteriores à ativação não recebem pacotes retroativos. Ao voltar para o menu, o álbum sincroniza campanhas persistidas pelo servidor da sala.
- **Loja do Álbum** → pacotes Bronze, Prata e Ouro por pontos; Lendário e Imortal não são vendidos.
- Lendário e Imortal **não** são vendidos: só por título.

## Inventário da conta
- Tudo o que se ganha vai para o inventário; ao ganhar: "Abrir agora" ou "Guardar".
- Genérico desde o início (itens com tipo + quantidade): no MVP só pacotes/envelopes/repetidas;
  depois pode guardar outros itens (recompensas de evento, itens de perfil etc.).

## Repetidas, níveis e Loja do Álbum
- Figurinha nova é colada sozinha; **repetida vai para o inventário** e o jogador escolhe:
  - **Usar** para subir o nível do jogador: ★1 = 1 cópia, ★2 = 2, ★3 = 4, ★4 = 7, ★5 = 10 (total).
  - **Vender** por **pontos do álbum** (separados dos créditos da campanha).
    Valores iniciais: Bronze 5 · Prata 10 · Ouro 20 · Lendária 50 · Imortal 120 · Única 300.
- **Loja do Álbum**: pacotes Bronze/Prata/Ouro. **Não dá para comprar uma figurinha específica** (decisão de 2026-10-11): figurinhas só saem de pacotes e envelopes.

## Recompensas (só visuais)
Os níveis mudam o **desenho**, nunca a **cor**: a cor da moldura da carta já diz a raridade e as
características especiais.
- **Nível do jogador = evolução do desenho da moldura da carta**, no álbum e nas campanhas do
  dono (draft, elenco, partidas — inclusive online), sempre na cor da raridade:
  ★1 moldura normal · ★2 cantos com ornamento discreto · ★3 cantos ornamentados + estrelas
  gravadas na borda · ★4 ornamento completo com louros · ★5 ornamento completo + borda com brilho animado.
- **Arte das molduras de nível — aprovada (2026-10-10)**: minimalista art déco, crescendo para
  FORA do escudo (a carta fica intacta): ★2 contorno fino · ★3 + losangos no topo e na ponta ·
  ★4 contorno duplo + detalhes angulares nos ombros · ★5 + coroa geométrica e entalhes laterais.
  Artes em `client/public/cards/album-level-{2..5}.webp`, ligadas por `AlbumLevelFrame`
  (`PlayerCard albumLevel`), coloridas pelo aro da carta (raridade, característica, Única).
  **Na integração:** ★4/★5 avançam ~8% para os lados e ~12% para cima — dar espaço nas grades e
  no campo do "meu time" onde houver cartas com nível.
- **Página compartilhada completa** → pacote Ouro na primeira conclusão; se a página crescer e for
  completada de novo, pacote Prata.
- **Fechar um time com página própria** (todos os jogadores do clube colados, qualquer nível) → de uma vez:
  - **moldura de perfil do clube** e **fundo de perfil do clube**, ambos **gerados por código** a partir
    das duas cores do clube (`shared/game/clubColors.ts`) e do brasão — nenhuma arte por clube.
    Protótipo aprovado em `client/src/components/account/ClubRewards.tsx`:
    - moldura: anel metálico na cor principal (serrilhado), filete na secundária, fios dourados,
      pontas art déco nas laterais, losango embaixo e medalhão marfim com o brasão no topo;
    - fundo: pinceladas a seco nas cores do clube, **mesma composição para todos**, brasão grande,
      inclinado, cortado pela borda e esmaecendo para a esquerda (com as cores dele); cores quase
      pretas viram grafite; brasões escuros ganham um contorno claro sutil.
  Não há degraus por nível para o time: os níveis são só da moldura da carta de cada jogador.
- **Jogador novo num clube já fechado**: as recompensas ganhas **nunca são perdidas**; a página mostra
  "Nova carta!" e volta a ficar incompleta; fechar de novo dá um pacote Ouro.

## Loop
- 30 s: abrir um pacote do inventário, decidir o que fazer com as repetidas.
- Sessão: jogar uma campanha → envelope (e pacote se for campeão).
- Dias: fechar páginas, evoluir molduras, vender/comprar na Loja do Álbum.

## Interação com sistemas existentes
- Conta/servidor (D1): novas tabelas de inventário, figurinhas (cópias usadas por nível) e moedas do álbum.
- Fim de competição (histórico já salvo no servidor) dispara a entrega de pacotes — decidida no servidor.
- Animação de abertura de pacote existente; artes de dificuldade e de estádio existentes.
- Perfil: capas, molduras de avatar e vitrine já existem; recebem os itens de clube.
- PlayerCard: aceita a moldura de nível do dono.
- Sem conta: o álbum continua como o catálogo atual.

## MVP
1. Servidor: inventário genérico + cartas da conta + pontos do álbum; entrega no fim da campanha.
2. Tela de inventário com "Abrir"; aviso "Abrir agora / Guardar" ao ganhar.
3. Abertura de pacote (animação existente) com chances por dificuldade.
4. Páginas por clube (vazia/colada, contador, nível em estrelas).
5. Repetidas: subir nível ou vender; Loja do Álbum (pacotes Bronze/Prata/Ouro).
6. Moldura de carta por nível (álbum + campanhas).
7. Recompensa de time completo (moldura + fundo de perfil do clube) e % do álbum no perfil.

## Fora do escopo
- Qualquer efeito no jogo (força, química, frequência no draft).
- Troca de figurinhas entre jogadores.
- Texto de "história" das figurinhas; figurinha brilhante por feitos.
- Pacotes Lendário/Imortal à venda.

## Ordem de construção
1 → 3 → 4 (já dá a graça de abrir e colar) → 2 → 5 → 6 → 7.

## Riscos
- **Economia**: pacotes por campanha, preços da loja e valores de venda — não completar numa semana nem nunca.
- **Catálogo que cresce**: cartas novas reabrem páginas completas (decidir: "página atualizada" mantendo as recompensas já ganhas).
- **Servidor**: tabelas/rotas novas; entrega tem de ser à prova de trapaça.
- **Visual**: 5 desenhos de moldura de nível (sobre a cor de cada raridade) + itens de perfil por clube (muitos clubes) — gerar por template, não à mão.

## Ideias descartadas nesta sessão
- Figurinha brilhante por feitos (título, melhor em campo, gol na final) — trocada pelos níveis por repetidas.
- Verso da figurinha com a história da campanha — complicado demais para todos.
- Museu dos Imortais (salas por clube/época, visitas) — muito trabalho de arte.
- Fichas da Banca de Trocas — substituídas pela Loja do Álbum com moedas.
- Recompensas com efeito leve no jogo (draft ou +1 na carta) — só visual.
- Níveis da carta por cor (prateado/dourado) — a cor já indica raridade e características especiais; os níveis mudam só o desenho.
- Degraus de recompensa do time por nível (todos ★3, todos ★5) — o time completo dá moldura + fundo de perfil de uma vez.
