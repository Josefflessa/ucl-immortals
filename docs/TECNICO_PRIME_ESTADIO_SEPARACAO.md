# Técnico Prime e separação do Estádio

## Resumo da decisão

O Técnico Prime é uma evolução individualizada por treinador. Ele amplia os
atributos de foco do bônus base e fortalece a habilidade especial do técnico. O
Estádio deixará de fazer parte dessa evolução e ficará responsável somente pela
vantagem de mando e pela sua própria progressão no projeto do clube.

## Objetivo

Fazer a evolução de 4 vitórias e 350 créditos valer a pena sem criar um bônus
genérico ou confundir o jogador sobre a origem dos efeitos. A separação também
deve funcionar de forma idêntica no solo e no online.

## Regras aprovadas

- O Técnico Prime exige 4 vitórias na campanha e custa 350 créditos.
- A compra ocorre na fase da Loja e é validada pelo servidor no online.
- O efeito passa a valer nas partidas seguintes à compra.
- O bônus Prime acumula com os efeitos normais do técnico.
- Nenhum bônus do Estádio é ativado ou alterado pela compra do Técnico Prime.
- Em uma final neutra, o Técnico Prime continua funcionando; o Estádio não
  concede vantagem de mando.
- O Técnico Prime continua podendo usar foto, moldura e selo Prime próprios.

## Assinaturas Prime

Todos os técnicos dão +5 em cada um de dois atributos de foco a todo o elenco
em qualquer partida. A habilidade de cada técnico tem condição, alcance e força
próprios. Os bônus em todos os atributos só aparecem para os jogadores elegíveis
quando a condição da habilidade é cumprida. No Prime, cada bônus base sobe +3
e a habilidade fica mais forte.

| Técnico | Bônus base | Habilidade normal | Habilidade Prime |
|---|---|---|---|
| Pep Guardiola | +6 em Passe e +5 em Visão (+9 e +8 Prime) | Com o placar empatado: elenco +3 em tudo | Com o placar empatado: elenco **+5 em tudo** |
| Jürgen Klopp | +4 em Ritmo e Físico (+7 Prime) | Depois de marcar: elenco +2 em tudo | Depois de marcar: elenco **+4 em tudo** |
| José Mourinho | +5 em Defesa e Físico (+8 Prime) | No mata-mata: defesa e goleiro +3 em tudo | No mata-mata: defesa e goleiro **+6 em tudo** |
| Carlo Ancelotti | +5 em Passe e Defesa (+8 Prime) | Mata-mata: elenco +1 em tudo; final: +5 em tudo no total | Mata-mata: elenco **+2 em tudo**; final: **+8 em tudo** no total |
| Zinedine Zidane | +4 em Drible e Finalização (+7 Prime) | Lendários e Imortais: +2 em tudo em todas as partidas | Lendários e Imortais: **+4 em tudo** em todas as partidas |
| Sir Alex Ferguson | +5 em Finalização e +4 em Físico (+8 e +7 Prime) | Perdendo: elenco +3 em tudo | Perdendo: elenco **+6 em tudo** |
| Luis Enrique | +5 em Ritmo e Drible (+8 Prime) | Vencendo: meio-campistas e atacantes +4 em tudo | Vencendo: meio-campistas e atacantes **+7 em tudo** |

O Prime preserva as condições e os jogadores afetados. O bônus de todos os
atributos tem valores diferentes porque algumas habilidades cobrem o elenco
inteiro ou ficam ativas por mais tempo, enquanto outras se limitam a jogadores
específicos ou a uma situação decisiva. Quando a habilidade ativa, ela se soma
ao bônus base. As regras e descrições permanecem juntas no catálogo de técnicos
para manter motor e interface sincronizados.

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
- comparação objetiva do bônus base e da habilidade normal e Prime;
- condições de ativação;
- requisitos de 4 vitórias e 350 créditos;
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
4. **4 vitórias e 350 créditos** — o custo atual é 350 (a proposta original era 500);
   qualquer mudança futura deve ser deliberada.
