---
name: brainstorm
description: "Ideação guiada de FEATURES NOVAS para o UCL Immortals (modos de jogo, sistemas, eventos, progressão, social). Use quando o usuário quiser pensar/explorar ideias de feature para o jogo, não para implementar direto. Adaptado de Claude-Code-Game-Studios (MIT)."
argument-hint: "[tema ou área, ex: 'retenção', 'modo multiplayer', 'evolução de cartas', ou 'open']"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion
---

# Brainstorm de Features — UCL Immortals

Facilitador criativo para features novas de um jogo **já existente** (cartas de
lendas da Champions, partidas, evolução de jogadores, missões, multiplayer via
socket). A IA propõe e provoca; **o usuário decide**. Não implemente nada aqui.

Mantenha leve: poucas trocas, não um questionário de 15 perguntas.

## 0. Contexto (rápido, sem varrer o repo)

- Leia `ideas.md` e `docs/design/features/` (se existir) para não repetir ideias
  já descartadas ou registradas.
- Se o tema tocar um sistema específico, faça no máximo 2–3 Grep/Glob pontuais
  para entender o que já existe (ex.: missões, evolução, economia). Não leia
  arquivos grandes inteiros.

## 1. Enquadrar (1 pergunta)

A partir do argumento (ou de uma pergunta aberta se não houver), descubra o
**objetivo** da feature. Use `AskUserQuestion` com opções derivadas do tema, por
exemplo: Retenção diária / Profundidade estratégica / Coleção & progressão /
Social & competição / Monetização-economia. Inclua restrições se forem óbvias
(tempo disponível, tamanho).

## 2. Gerar 3 ideias distintas

Cada uma por uma técnica diferente:

- **Verbo primeiro** — qual ação nova o jogador faz? (montar, apostar, trocar,
  escalar, desafiar, colecionar…) O verbo É a feature.
- **Mashup** — [mecânica de outro jogo] + [universo UCL]. Ex.: "draft de roguelike
  + noites de Champions", "Ultimate Team + museu histórico".
- **Emoção primeiro (MDA ao contrário)** — escolha a estética (desafio, fantasia,
  descoberta, coleção/expressão, competição, comunidade) e volte até a mecânica.

Para cada ideia:
- **Nome**
- **Pitch** (1–2 frases, passa no "teste dos 10 segundos")
- **Verbo central** e **fantasia** ("me sinto montando o maior time da história")
- **Gancho** ("como X, E TAMBÉM Y")
- **Onde encaixa** no jogo atual (que telas/sistemas toca)
- **Tamanho** (P / M / G) e **maior risco** (1 frase)

Depois, `AskUserQuestion` em lista simples: "Ideia 1 — [nome]" / "Ideia 2" /
"Ideia 3" / "Combinar elementos" / "Gerar outras direções". Não pressione.

## 3. Aprofundar a escolhida

- **Loop**: o que o jogador faz em 30s → numa sessão → ao longo de dias? Onde
  entra o "só mais uma"?
- **Motivação (SDT)**: autonomia (escolhas reais?), competência (sente evoluir?),
  pertencimento (conecta com outros jogadores/clube?).
- **Interação com o existente**: economia, evolução de cartas, missões,
  partidas, multiplayer — o que reforça, o que pode quebrar/desbalancear.
- **Anti-objetivos**: 2–3 "NÃO vamos fazer X porque comprometeria Y" para
  conter escopo.

## 4. MVP e escopo

- **MVP**: a lista mínima (≤ 5–7 itens) que testa se a ideia é divertida. Se
  passar disso, empurre de volta no escopo.
- **Fora do escopo** e **ordem de construção** (o mais arriscado/divertido primeiro).
- **Riscos**: técnico (socket, persistência, performance), design (balanço,
  power creep), produto.

## 5. Registrar (só com aprovação)

Mostre o resumo final e pergunte via `AskUserQuestion`: "Posso salvar em
`docs/design/features/[nome-kebab].md`?" → Sim / Revisar algo antes.

Formato do arquivo (curto):

```markdown
# Feature: [Nome]
**Data**: [YYYY-MM-DD] · **Tamanho**: P/M/G · **Status**: ideia

## Pitch
## Objetivo / fantasia
## Loop
## Interação com sistemas existentes
## MVP
## Fora do escopo
## Ordem de construção
## Riscos
## Ideias descartadas nesta sessão
```

## 6. Próximos passos

- Peça pequena/ajuste de sistema existente → `/quick-design`.
- Feature maior pronta para virar código → `superpowers:brainstorming` /
  `superpowers:writing-plans` para desenhar a implementação.

Termine com 1 linha: pitch + nº de itens do MVP + caminho do arquivo.
