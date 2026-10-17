---
name: quick-design
description: "Spec leve para mudanças pequenas no UCL Immortals — ajuste de números/balanço, pequena mudança de comportamento, mecânica pequena ou sistema pequeno (< ~1 semana). Gera uma spec com regras e critérios de aceite antes de codar. Adaptado de Claude-Code-Game-Studios (MIT)."
argument-hint: "[descrição curta da mudança]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion
---

# Quick Design

Caminho **leve** de design para mudanças pequenas demais para um plano completo,
mas importantes demais para codar sem registrar o porquê. Não implemente nada
aqui — a saída é uma spec.

**Saída:** `docs/design/quick-specs/[nome-kebab]-[YYYY-MM-DD].md`

## 1. Classificar

- **Tuning** — só números/balanço, sem mudar comportamento. Ex.: "XP de evolução
  +10%", "custo de pacote 500 → 400".
- **Tweak** — pequena mudança de comportamento, sem estados ou sistemas novos.
  Ex.: "cartão vermelho também tira o jogador da próxima partida".
- **Addition** — mecânica pequena num sistema existente (1–2 estados/interações
  novos). Ex.: "missão diária com bônus de sequência".
- **New Small System** — feature isolada, sem doc existente, < ~1 semana.
  Ex.: "popup de conquistas".

Se for maior que isso (muitas dependências entre sistemas, > 1 semana, ou muda
regra central) → pare e sugira `/brainstorm` ou `superpowers:brainstorming`.

Sem argumento: peça a descrição em texto livre. Depois confirme a classificação
via `AskUserQuestion`: "[A] Sim — [tipo]" / Tuning / Tweak / Addition /
New Small System / "Grande demais — redirecionar".

## 2. Contexto (pontual)

- Ache o código do sistema afetado com Grep/Glob (constantes, regras, tipos em
  `shared/`, lógica em `server/`/`client/`). Leia só os trechos relevantes.
- Para Tuning, localize **onde os valores vivem** (arquivo + constante).
- Veja `docs/design/quick-specs/` e `docs/design/features/` por specs anteriores
  do mesmo sistema; cite cada uma e diga se concorda ou conflita (cite mesmo se
  concordar).

Reporte: "Sistema em [arquivos]. Valores em [arquivo:linha]. Specs anteriores:
[lista ou 'nenhuma']."

## 3. Rascunho da spec

### Tuning

```markdown
# Quick Spec: [Título]
**Tipo**: Tuning · **Sistema**: [nome] · **Data**: [hoje]
**Onde**: `[arquivo]` — `[constante]`

## Mudança
| Parâmetro | Atual | Novo | Motivo |
|-----------|-------|------|--------|

## Critérios de aceite
- [ ] [Parâmetro] vale [novo] em `[arquivo]`
- [ ] Diferença observável em [contexto]
- [ ] Sem regressão em [comportamento relacionado]
```

### Tweak / Addition

```markdown
# Quick Spec: [Título]
**Tipo**: Tweak/Addition · **Sistema**: [nome] · **Data**: [hoje]

## Resumo
[1–2 frases: o que muda e por quê]

## Motivação
[Que problema de experiência do jogador resolve?]

## Delta
Hoje (`[arquivo:linha]`): [comportamento atual, preciso]
Passa a ser: [regra nova, precisa o bastante para implementar só com este texto]

## Regras / valores novos
[Estados novos, parâmetros novos com faixas]

## Sistemas afetados
| Sistema | Impacto | Ação |
|---------|---------|------|

## Critérios de aceite
- [ ] [testável 1]
- [ ] [testável 2]
- [ ] Sem regressão: [o que não pode quebrar]
```

### New Small System

```markdown
# Quick Spec: [Título]
**Tipo**: New Small System · **Data**: [hoje] · **Estimativa**: [horas]
**Escopo**: [o que faz e o que NÃO faz]

## Visão geral
[Um parágrafo: o que faz, quando ativa, o que produz]

## Regras
[Numeradas para sequência, bullets para condições — sem ambiguidade]

## Knobs de tuning
| Knob | Padrão | Faixa | Motivo |
|------|--------|-------|--------|
Valores em constantes/config, não hardcoded espalhado.

## Critérios de aceite
- [ ] Funcional: faz a coisa certa
- [ ] Funcional: trata o caso de borda
- [ ] Experiência: "parece certo" — o que um playtest valida
- [ ] Regressão: não quebra sistema vizinho
```

## 4. Aprovação

Mostre o rascunho inteiro. `AskUserQuestion`: "[A] Aprovar e salvar" /
"[B] Revisar — vou dizer o quê" / "[C] Cresceu demais — redirecionar".
Em [B], revise e pergunte de novo. Em [A], crie `docs/design/quick-specs/` se
precisar e grave o arquivo.

## 5. Handoff

```
Quick spec: docs/design/quick-specs/[arquivo].md
Tipo: [...] · Sistema: [...]
Próximo passo: implementar a partir dos critérios de aceite
(TDD via superpowers:test-driven-development se tiver lógica testável).
```
