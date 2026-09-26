# Técnico Prime e separação do Estádio

## Resumo da decisão

O Técnico Prime será uma evolução individualizada por treinador. Cada técnico
receberá uma melhoria forte e característica da sua habilidade especial. O
Estádio deixará de fazer parte dessa evolução e ficará responsável somente pela
vantagem de mando e pela sua própria progressão no projeto do clube.

## Objetivo

Fazer a evolução de 4 vitórias e 500 créditos valer a pena sem criar um bônus
genérico ou confundir o jogador sobre a origem dos efeitos. A separação também
deve funcionar de forma idêntica no solo e no online.

## Regras aprovadas

- O Técnico Prime exige 4 vitórias na campanha e custa 500 créditos.
- A compra ocorre na fase da Loja e é validada pelo servidor no online.
- O efeito passa a valer nas partidas seguintes à compra.
- O bônus Prime acumula com os efeitos normais do técnico.
- Nenhum bônus do Estádio é ativado ou alterado pela compra do Técnico Prime.
- Em uma final neutra, o Técnico Prime continua funcionando; o Estádio não
  concede vantagem de mando.
- O Técnico Prime continua podendo usar foto, moldura e selo Prime próprios.

## Assinaturas Prime

| Técnico | Efeito normal | Efeito Prime |
|---|---|---|
| Pep Guardiola | Visão ≥80: +3 em tudo | Visão ≥80: **+7 em tudo** |
| Jürgen Klopp | Quando perdendo: +8 em tudo | Quando perdendo: **+14 em tudo** |
| José Mourinho | Defensores no mata-mata: +6 Defesa | Defensores no mata-mata: **+12 Defesa** |
| Carlo Ancelotti | Na final: +6 em tudo | Na final: **+12 em tudo** |
| Zinedine Zidane | Lendários/Imortais no mata-mata: +6 em tudo | Lendários/Imortais no mata-mata: **+10 em tudo** |
| Sir Alex Ferguson | Quando perdendo: +10 em tudo | Quando perdendo: **+16 em tudo** |
| Luis Enrique | Meio-campistas +3 Visão; atacantes +2 Ritmo/Drible | Meio-campistas **+7 Visão**; atacantes **+6 Ritmo/Drible** |

Os valores Prime são os valores totais daquela habilidade, não um segundo
gatilho separado. Por exemplo, Klopp Prime recebe +14 em tudo quando está
perdendo, e não +8 mais +14.

## Estádio independente

O projeto Estádio será a única origem da vantagem de casa:

- nível 1: +3 em todos os atributos dos titulares mandantes;
- nível 2: +5;
- nível 3: +7;
- nível 4: +9;
- nível 5: +11 e desbloqueio da imagem especial do estádio.

O Estádio não receberá mais os bônus temáticos de clube/nação que pertenciam
ao antigo Estádio Prime do técnico. A imagem especial do nível 5 pode usar o
mesmo asset visual que antes representava o Estádio Prime.

## Interface

O modal de evolução exibirá somente:

- foto atual e foto Prime do técnico;
- nome da habilidade normal e da habilidade Prime;
- comparação objetiva do valor, como `+8 em tudo → +14 em tudo`;
- condições de ativação;
- requisitos de 4 vitórias e 500 créditos;
- botões Cancelar e Confirmar.

Não serão exibidos estádio, vantagem em casa, clube temático, nação temática
ou qualquer outro efeito de mando nesse modal.

## Integração técnica

- `coachPrime` continuará sendo o marcador de evolução do técnico.
- A resolução de atributos receberá esse marcador para aplicar a assinatura
  Prime correspondente ao `coachId`.
- A resolução do estádio usará apenas `stadiumProjectLevel`.
- Solo e servidor online usarão a mesma função de modificadores.
- O servidor continuará validando fase, vitórias, saldo e estado Prime antes de
  descontar os créditos.
- A mudança não recalculará partidas já finalizadas.

## Casos de borda

- Técnico Prime nunca deve conceder bônus de mando em partida neutra.
- Técnico Prime não pode ser comprado duas vezes.
- Evoluir o Estádio não pode aumentar ou reduzir a assinatura do técnico.
- Evoluir o técnico não pode alterar o nível, a imagem ou os bônus do Estádio.
- Um técnico Prime deve continuar com sua assinatura mesmo quando atua como
  visitante.

## Testes obrigatórios

- Cada técnico normal e Prime produz os valores esperados.
- O Prime não chama nem ativa o estádio temático.
- Os níveis do Estádio permanecem +3/+5/+7/+9/+11.
- O Prime funciona em liga, mata-mata e final neutra conforme sua condição.
- Solo e online possuem o mesmo resultado para o mesmo estado.
- Compra inválida é recusada sem descontar créditos.
- Compra válida é idempotente e não pode ser duplicada por clique ou
  reconexão.

## Registro de decisões

1. **Assinatura individual por técnico** — escolhida para preservar identidade
   e tornar a evolução perceptível.
2. **Melhorar a habilidade existente** — escolhida para manter continuidade
   com o que o jogador já conhece, em vez de criar sete sistemas paralelos.
3. **Estádio totalmente separado** — escolhido para eliminar a sobreposição
   entre evolução do técnico e vantagem de mando.
4. **4 vitórias e 500 créditos mantidos** — o custo será validado contra os
   efeitos Prime fortalecidos; qualquer mudança futura deve ser deliberada.
