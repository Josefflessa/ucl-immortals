# Dificuldade dos bots

A dificuldade tem duas partes:

1. **Nível** (Bronze a Imortal): define o elenco dos bots (faixa de overall, química, técnico, reforço dos titulares, tática). Está em `shared/game/engine/bots.ts` (`difficultyProfile`) e não muda durante a campanha.
2. **Curva da campanha**: define o quanto a força dos bots cresce do começo ao fim. Está em `shared/game/engine/difficultyCurve.ts`.

## Por que a curva existe

O time do jogador cresce durante a campanha (reforços a cada rodada, características que evoluem). Com a força dos bots fixa, o começo ficava duro e o fim fácil. Agora os bots também crescem.

## Como funciona

- `campaignProgress(formato, fase)` vai de 0 (primeira rodada) a 1 (a final). Cada rodada da liga ou da fase de grupos pesa 1 e cada fase do mata-mata pesa 1,6. A liga esquenta devagar e o mata-mata aperta mais.
- `botStrengthMultiplier(botStrength, progresso)` é o multiplicador aplicado à força do bot na partida (`strength.ts`). Ele vai do valor "começo" ao valor "final" do nível:

| Nível | Começo | Final |
|---|---|---|
| Bronze | 0,844 | 1,099 |
| Prata | 0,919 | 1,154 |
| Ouro | 0,974 | 1,159 |
| Lendário | 0,989 | 1,179 |
| Imortal | 1,014 | 1,229 |

- O progresso é posto no bot antes de cada partida (`withCampaignProgress`), no solo (`reducer.ts`) e no online (`server/handlers.ts`). Sem progresso informado, o bot joga com a força do começo.

## Calibração

Um jogador que escolhe sempre a melhor carta oferecida no draft (XI de overall ~86, sem características) e recebe os reforços da liga (8 trocas do pior titular) ganha, em % de vitórias:

| Nível | Começo | Final | Antes (força fixa) |
|---|---|---|---|
| Bronze | ~80% | ~62% | 82% a 90% |
| Prata | ~66% | ~40% a 50% | 57% a 83% |
| Ouro | ~42% | ~33% | 36% a 61% |
| Lendário | ~27% | ~24% | 26% a 43% |
| Imortal | ~11% | ~5% | 8% a 13% |

Em 2026-10-21 (segundo ajuste) todas as tabelas subiram +0,012 duas vezes (+0,024 no total; sem recalibrar por simulação; o efeito esperado é cerca de 1 a 3 pontos a menos de vitórias).

Alvo de projeto: Ouro ~50% no começo caindo para ~38% no fim, Bronze mais acessível e Imortal quase impossível. Margem de erro das simulações: cerca de 3 a 4 pontos percentuais.

Para recalibrar: simule um jogador de referência contra bots de cada nível com `campaignProgress` em 0 e em 1 (usando `generateBotTeam` e `simulateMatch`), procure o multiplicador que entrega a taxa desejada e ajuste as tabelas `MULTIPLIER_START` e `MULTIPLIER_END`.
