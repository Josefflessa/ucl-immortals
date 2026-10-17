# UCL Immortals — Visão geral do jogo

> Análise técnica e de design do projeto inteiro (estado em 2026-10-16). Serve como mapa para quem chega ao código.

## 1. O que é

Jogo web de **gestão + draft de cartas de futebol** no estilo Champions League. Cada jogador monta um time de lendas (draft de cartas), disputa um campeonato contra bots ou amigos, assiste às partidas simuladas minuto a minuto e gerencia economia, evolução e táticas entre rodadas. Fora das partidas há uma camada de **conta persistente** (álbum de figurinhas, conquistas, eventos, ranking, amigos).

Modos: **Solo** (estado no cliente, campanha salva na conta) e **Online** (até 8 humanos + bots, servidor autoritativo).

## 2. Arquitetura

| Camada | Tecnologia | Papel |
|---|---|---|
| `client/` | React 19 + Vite + Tailwind 4 + Framer Motion | UI, reducer do modo solo (`contexts/game/reducer.ts`), conexão realtime |
| `shared/` | TypeScript puro | **Todas as regras do jogo** — motor de partida, draft, economia, missões, álbum. Usado igual por cliente e servidor |
| `server/` | Cloudflare Worker | `GameRoom` (Durable Object por sala), `RoomDirectory` (códigos de sala), API de conta, push |
| `migrations/` | D1 (SQLite) | 31 migrações: contas, amigos, álbum, histórico, eventos, push |

Princípio central: **regra pura em `shared/`, aplicada por quem é autoritativo**. No solo o reducer do cliente aplica; no online o Durable Object aplica (`server/handlers.ts`, ~65 ações). Módulos como `seatRules.ts` e `onlineReadiness.ts` existem justamente para que solo e online nunca divirjam.

Consistência online (ADR-001, `docs/architecture/`): `stateRevision` monotônica, `commandId` idempotente com recibos, `roomEpoch` para reinícios, backup/restore por handler, mensagens enviadas só após persistir, visão da sala filtrada por socket (saldo, apostas e opções de draft são privados).

## 3. Fluxo de uma competição

Telas em `client/src/App.tsx`, fases da sala em `RoomState.phase`:

```
menu → format → setup → crest → coach → formation → draft → squad_review → league ⇄ match_sim → knockout ⇄ match_sim → report
```

1. **Formato** (`shared/game/competition.ts`): `league`, `league_knockout` (padrão), `groups_knockout`, `knockout`. Configura nº de times (4–20), rodadas, ida/volta, classificados, final em jogo único, regras de reforço e de pontos.
2. **Setup**: nome, escudo, dificuldade dos bots (Bronze 0.45 → Imortal 0.97 de força).
3. **Técnico** (7 opções, com bônus próprios e evolução "Prime") e **formação** (6).
4. **Draft** (`engine/draft.ts`): por turno, 6 opções por vez, 30 s por escolha no online (auto-pick no timeout). Raridade sorteada por chance; 25% das cartas vêm com **variante** (Lobo, Coringa, Nômade, Pilar…). Há veto.
5. **Revisão do elenco** → **liga/grupos** → **mata-mata** (chaveamento, ida/volta, pênaltis) → **relatório** final.

Entre rodadas: loja, reforços, mercado/trocas (online), apostas, missões, plano de jogo, cura de lesões, evolução.

## 4. Cartas e atributos

- **Catálogo**: 1.789 jogadores (`shared/game/players/`) — 180 bronze, 605 prata, 815 ouro, 172 lendário, 17 imortal, + cartas `unique` (eventos/álbum, overall 99).
- **Atributos**: ritmo, finalização, passe, drible, defesa (para GK = defesa a gol), físico, compostura, visão.
- **47 traits** (`traits.ts`) com efeito estruturado — o motor aplica por dados, não por `includes` espalhados.
- **Características de time** (em `Player`): Mártir, Ídolo, 12º Homem, Pipoqueiro, Noé, Forasteiro, Colecionador, Estribado, Todos por Um, Capitão Nato, Magnata etc. Calculadas em `chemistry.computeCharacteristicBoosts`.
- **Evolução** (`engine/attributes.ts`): níveis 0–4 por partidas jogadas, pontos de evolução distribuíveis, **especializações** (finalizador, maestro, motor, muralha).
- **Fora de posição**: penalidade de atributo e química (Coringa ignora). Jogador de linha no gol rende 70%.
- **Bônus do álbum**: nível do álbum da carta (0–5) e +3 por página completa, travados no início da competição.

## 5. Química e força do time

`engine/chemistry.ts` + `engine/strength.ts`:
- Ligações por **clube, nação, liga, técnico histórico, parceiros e trios históricos** (`HISTORICAL_TRIOS`).
- A química total vira bônus de passe/ritmo/especial.
- Táticas (6): Equilibrado, Posse, Contra-ataque, Pressão Alta, Defensivo, Tudo pro Ataque — cada uma muda volume de chances, perigo e exposição.
- Capitão, plano de jogo (`MatchPlan`: gatilhos de mudança tática por placar/minuto), papéis de cobrança (pênalti, falta, escanteio).
- **Projetos do Clube** (`clubProjects.ts`) — upgrades permanentes na campanha; o **Estádio** é a única fonte do mando de campo.

## 6. Motor de partida

`engine/matchSim.ts` — simulação **minuto a minuto**, determinística dado o RNG (`random.ts` / `withRandomSource`, teste golden em `__snapshots__`):

- Por minuto: lesão aleatória (pelo físico), força de cada lado (com ajuste de quem está perdendo), **momentum** com reversão à média, posse por meio-campo.
- **Minutos-chave** geram as jogadas perigosas: duelo atacante × defesa → finalização × goleiro via curvas de vantagem (`curves.edgeChance`).
- Eventos de "sabor": chutes, faltas (→ falta direta ou pênalti), escanteios (→ cabeceio), impedimentos.
- **Disciplina** (`discipline.ts`): amarelos/vermelhos dependentes de tática/formação agressiva, lesões por falta, suspensões que atravessam a temporada.
- **Lances épicos** (`epicPlays.ts`): bicicleta, gol do meio-campo, dupla defesa — ~1 a cada 3–4 jogos, ponderado pelo atributo/trait.
- Narração (`matchNarrative.ts`, `dangerNarration.ts`) e **campo ao vivo** (`shared/game/pitch/`: 4k linhas de jogadas posicionais + timeline) para a tela `MatchSimPage`.
- Saída: placar, eventos, estatísticas, notas por jogador (rating), disputa de pênaltis (`pitch/shootout.ts`).

## 7. Economia da competição

Créditos ganhos por partida (`competition.ts`): vitória 100, empate 45, derrota 15, +12 por saldo, +3 por gol, +20 sem sofrer gol (configurável). Gastos (`shop.ts`, desenhado como *sink*, não *snowball*):

| Item | Custo |
|---|---|
| Pacote de jogador | 60 (bronze) → 450 (imortal) / 750 (único) |
| Caça-talentos (por posição) | 220 |
| Turbinar | 300 |
| Trocar técnico | 250 |
| Técnico Prime (exige 4 vitórias) | 350 |
| Remover característica | 150 |
| Treino, fisioterapia, projetos | fórmulas próprias |

Outros sistemas: **reforços** por rodada (3–6 opções, reroll), **apostas** em partidas (`bets.ts`, crédito só na revelação, teto por rodada), **missões** (`missions.ts`, quadro rotativo idêntico em solo e online), **mercado** com escrow e **trocas diretas** (online).

## 8. Camada de conta (persistente, D1)

Rotas em `server/account-api.ts`:
- Login local, perfil (avatar, capa, estilo de nome, molduras), presença, amigos, chat, convites de sala, push (VAPID).
- **Álbum** (`album.ts`, `server/album.ts`): páginas por clube, figurinhas, pacotes, banners diário (25) e semanal (50) com *pity*, trocas entre amigos, cartas exclusivas. Nível do álbum dá bônus às cartas nas competições.
- **Conquistas** permanentes, **eventos** com janela de tempo e recompensas (derivados do `competition_history` no servidor — o cliente nunca concede recompensa), **recompensas diárias/semanais** (calendário de São Paulo), **ranking** por dificuldade, recordes, vitrine e histórico.
- Save da **campanha solo** na conta.

## 9. Qualidade e ferramentas

- Testes Vitest ao lado dos módulos (`*.test.ts`) — motor (golden snapshot), balanço de cartões/lesões, formatos, missões, álbum, runtime do servidor, reconexão de mata-mata.
- `pnpm check` (tsc), `pnpm catalog` (dedup do catálogo de jogadores), `pnpm dev:all` (Vite + Worker local), deploy único via `wrangler deploy`.
- Docs de design em `docs/design/features/` e specs em `docs/superpowers/specs/`.

## 10. Pontos de atenção

- **Arquivos muito grandes**: `pitch/plays.ts` (4,2k linhas), `server/handlers.ts` (3,8k), `account-api.ts` (2,2k), `MatchSimPage.tsx` (1,5k), `matchSim.ts` (1,5k). Candidatos a divisão por domínio (ex.: handlers de loja/mercado/draft em módulos separados).
- **Duas implementações de aplicação de regra** (reducer solo × handlers online): a convergência depende de manter regras em `shared/`. Toda regra nova deve nascer lá.
- **Complexidade de características**: ~20 efeitos de time interagindo com química, evolução, álbum e traits — balanceamento exige testes de simulação, não só unitários.
- Tipos `any` pontuais (ex.: `getActiveKnockoutMatches`) no código de torneio.
