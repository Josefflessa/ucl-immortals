# Dificuldade multidimensional dos bots — Design

**Data:** 2026-07-04
**Status:** Aprovado

## Objetivo

Hoje a dificuldade é **um número** (`botStrength`) que só define a **faixa de overall** de onde o
bot sorteia o XI (aleatório). Isso deixa os níveis "só com números maiores" — o bot não fica mais
**inteligente**. Objetivo: fazer cada nível escalar **vários eixos** de qualidade/decisão do bot,
de forma **gradual**, com a dificuldade vindo **só da qualidade do time** (motor da partida
continua simétrico/justo — nada de "IA trapaceando").

## Eixos que escalam com o nível (0 = Bronze … 1 = Imortal)

1. **Overall** — centro sobe e o **piso sobe mais rápido que o teto** (nível alto quase não fielda
   jogador fraco). Centros-alvo: Bronze **82** · Prata **86** · Ouro **88,5** · Lendário **91** ·
   Imortal **93**.
2. **Química (o maior salto)** — o draft passa de **aleatório** para **entrosado**: ao preencher
   cada vaga, o bot **prefere jogadores conectados** (mesmo clube/nação) aos já escolhidos.
   `chemBias` escala com a dificuldade. Um bot bem entrosado é MUITO mais forte (a química
   multiplica os atributos efetivos), então é aqui que "subir de nível" pesa.
3. **Técnico** — de aleatório para um que **combina com a formação** (`preferredFormation`), com
   probabilidade crescente.
4. **Características** — nos níveis altos, cada titular tem uma chance (`variantChance`) de ganhar
   uma variante **sempre-boa** (Em Alta +3 em tudo, ou Pilar +química). Bronze = 0.
5. **Tática/formação** — já existe o `pickBotTactic` (coerente por formação/dificuldade); mantém.
6. **Banco** — já sai da mesma faixa de overall, então melhora junto com o nível (cobre
   cartão/lesão melhor). Sem mudança extra.

## Arquitetura

- **`difficultyProfile(strength: number)`** (função pura, exportada, testável) → devolve os botões:
  `{ center, loSpread, hiSpread, chemBias, smartCoachChance, variantChance }`.
  - `center = 73 + strength*20.5` (bate nos alvos acima).
  - `loSpread = 8 - strength*4` (piso sobe mais rápido) · `hiSpread = 6`.
  - `chemBias = strength` (0.45 … 0.97).
  - `smartCoachChance = strength`.
  - `variantChance = max(0, (strength − 0.5) * 0.6)` (Bronze 0 · Ouro ~0.15 · Imortal ~0.28).
- **`generateBotTeam(name, difficulty)`** passa a ler o perfil:
  - banda `[center − loSpread, center + hiSpread]`;
  - técnico: com prob. `smartCoachChance`, escolhe um cujo `preferredFormation === formation.id`
    (senão aleatório);
  - preenche cada vaga com **escolha ponderada por química** (`pickChemAware`): peso do candidato
    = `1 + chemBias * conexões * K`, onde `conexões` conta os já-selecionados do mesmo clube (×2) e
    mesma nação (×1);
  - após montar o XI, cada titular tem prob. `variantChance` de receber Em Alta **ou** Pilar
    (via `applyShopVariant`), antes de calcular a química;
  - resto igual (banco, cartas, tática).

`pickChemAware(cands, selected, chemBias)` é uma função pura auxiliar (weighted pick).

## Validação (o pedido do usuário: "ver nos testes como tá")

Diagnóstico determinístico (script temporário) que mede, por nível:
- **overall médio do XI** e **química total média** (confirmam que sobem por nível, gradual);
- **win rate de um time-referência fixo** contra cada nível (deve cair conforme o nível sobe —
  gradual, sem degrau absurdo);
- **win rate nível N vs nível N−1** (o mais alto vence claramente > 50%).

Alvo de sensação: Bronze acessível (referência ganha fácil), subindo **gradual** até Imortal
difícil (referência perde a maioria). Calibrar `center`/`chemBias`/`variantChance` se algum nível
ficar fácil/difícil demais ou não-gradual. Fechar com `balance.test.ts` verde (nível maior → time
mais forte, e continua imprevisível o suficiente).

## Fora de escopo

Nenhuma vantagem do bot **dentro** do motor da partida (sem rubber-banding). Sem novo nível de
dificuldade. Sem mudar a UI de seleção de dificuldade (os 5 níveis atuais só ficam mais elaborados).
