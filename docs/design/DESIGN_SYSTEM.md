# Design system do UCL Immortals

Referência única da interface do jogo: tokens, componentes, layout e textos.

- **Código:** `client/src/design-system/` (`tokens.css`, `primitives.tsx`, `patterns.tsx`, `index.ts`).
- **Ponte com o Tailwind:** `client/src/index.css` (bloco `@theme inline`).
- **Escopo:** o sistema cobre a "moldura" da interface: páginas, painéis, botões, abas, modais e textos. Cartas de jogador, escudos, estádios, retratos e a arte de raridade têm a própria linguagem visual e ficam fora dele.

Importe sempre de `@/design-system` (ou `../design-system`):

```tsx
import { Button, Panel, PanelHeader, PanelTitle, PanelBody, SectionHeader } from '@/design-system';
```

---

## 1. Princípios

1. **Escuro, dourado e esportivo.** O fundo é quase preto, o dourado é a marca e a Bebas Neue faz os títulos. A cor forte fica reservada para ação e destaque. Todo o resto é neutro.
2. **Uma ação principal por tela.** Só um botão `primary` visível por vez, em geral na `FixedActionBar`.
3. **Hierarquia pelo tamanho e pela fonte, não pela cor.** Os títulos usam a fonte display; rótulos usam caixa alta pequena com tracking; o texto de leitura usa Inter em caixa normal.
4. **Token antes de valor solto.** Para tamanho, espaço, cor, raio, sombra ou camada, use o token. Um valor em px no código de uma tela é exceção e precisa de motivo.
5. **Mobile primeiro.** Alvo de toque mínimo de 44px. Nada pode exigir rolagem horizontal da página.

---

## 2. Tokens

Todos os tokens ficam em `:root` dentro de `tokens.css`. No CSS, use `var(--ui-…)`. No Tailwind, use a utilidade da ponte quando ela existir (`text-label`) ou o valor arbitrário com variável (`bg-(--ui-surface-2)`, `z-(--ui-z-modal)`).

### 2.1 Cores

**Superfícies**, da mais funda para a mais alta:

| Token | Valor | Uso |
|---|---|---|
| `--ui-bg` | #080810 | fundo da página |
| `--ui-bg-raised` | #0b0b14 | barra superior, modal |
| `--ui-surface-inset` | #08080f | campos de texto, áreas rebaixadas |
| `--ui-surface-1` | #0f0f1a | painel padrão, cartão de escolha |
| `--ui-surface-2` | #14142a | painel de destaque, hover, cabeçalho de modal |
| `--ui-surface-3` | #1a1a2a | hover forte, trilho de progresso, skeleton |

Os aliases antigos (`--ui-surface`, `--ui-surface-muted`, `--ui-surface-strong`, `--ui-panel-inset`) continuam valendo, mas o código novo deve usar os nomes numerados.

**Linhas:** `--ui-line-subtle` (borda padrão de painel), `--ui-line` (campos, bordas tracejadas), `--ui-line-strong` (hover, botão secundário) e `--ui-focus` (anel de foco do teclado).

**Texto**, do mais forte para o mais fraco:

| Token | Uso |
|---|---|
| `--ui-text` | títulos e valores |
| `--ui-text-soft` | texto de leitura e títulos de painel |
| `--ui-text-muted` | descrições, metadados e rótulos |
| `--ui-text-faint` | placeholder e informação terciária. Passa no AA (4.5:1 ou mais), mas é o tom mais fraco: não use em informação principal |

**Marca:**

| Token | Uso |
|---|---|
| `--ui-brand` | borda e indicador ativo |
| `--ui-brand-strong` | texto dourado e botão primário |
| `--ui-brand-hover` | hover do botão primário |
| `--ui-brand-soft` | fundo de badge e destaque suave |
| `--ui-brand-line` | borda dourada translúcida (painel de destaque, modal) |
| `--ui-brand-ink` | texto sobre o dourado |

**Estados:** cada um tem a cor principal, o fundo suave (`-soft`) e a borda (`-line`).

| Estado | Token | Quando |
|---|---|---|
| Informação | `--ui-info` | dicas e neutros com destaque |
| Sucesso / vantagem | `--ui-success` | ganho, confirmação, "vantagem contra", química alta |
| Atenção | `--ui-warning` | limite próximo, "um pouco menos" |
| Perigo | `--ui-danger` | erro, derrota, ação destrutiva |
| Cautela / desvantagem | `--ui-caution` | "desvantagem contra", negativos leves que não são erro |
| Ao vivo | `--ui-live` | partida em andamento |

**Preenchimentos sólidos de botão:** `--ui-success-hover` e `--ui-success-ink`; `--ui-cyan`, `--ui-cyan-hover` e `--ui-cyan-ink` (botão `info`); `--ui-danger-fill`, `--ui-danger-fill-hover` e `--ui-danger-ink`.

**Jogo:** `--match-home` e `--match-away` são as cores dos lados da partida (não são cores da marca). As raridades vão de `--rarity-bronze` até `--rarity-immortal`.

> Vantagem usa sempre `--ui-success` e desvantagem usa `--ui-caution` (laranja). Não crie verdes, laranjas ou vermelhos novos (`#5EDB82`, `#22C55E`, `#F97316` etc.).

### 2.2 Tipografia

Há três famílias:

| Token | Fonte | Uso |
|---|---|---|
| `--font-display` | Bebas Neue | títulos de página, de modal e de cartão; números grandes; botão grande |
| `--font-ui` | Inter | todo o resto da interface (padrão do `body`) |
| `--font-game` | Rajdhani | números e rótulos de jogo (atributos, placares compactos); classe `font-game` |

**Escala de tamanhos.** 10px é o piso para texto que precisa ser lido.

| Token | Tailwind | px | Papel |
|---|---|---|---|
| `--ui-fs-micro` | `text-micro` | 10 | badge, contador, meta mínima |
| `--ui-fs-caption` | `text-caption` | 11 | kicker, rótulo de seção, aba, rótulo de campo |
| `--ui-fs-label` | `text-label` | 12 | título de painel, texto de tabela, dica de campo |
| `--ui-fs-body-sm` | `text-body-sm` | 13 | botão, texto denso, banner |
| `--ui-fs-body` | `text-body` | 14 | texto de leitura padrão |
| `--ui-fs-lead` | `text-lead` | 15 | subtítulo de página |
| `--ui-fs-title-sm` | `text-title-sm` | 18 | marca, título de cartão (display) |
| `--ui-fs-title` | `text-title` | 20 | título de estado vazio, botão grande, saldo |
| `--ui-fs-title-lg` | `text-title-lg` | 22 | título de modal |
| `--ui-fs-heading` | `text-heading` | 28 | título de seção dentro da página |
| `--ui-fs-display` | `text-display` | 30–46 | título da página (um por tela) |

**Entrelinha:** `--ui-leading-none` (1, títulos display), `--ui-leading-tight` (1.2, rótulos), `--ui-leading-snug` (1.4, texto denso) e `--ui-leading-normal` (1.55, parágrafos). No Tailwind: `leading-ui-*`.

**Peso:** `--ui-weight-regular` 400, `-medium` 500, `-semibold` 600, `-bold` 700 e `-heavy` 800. A Bebas Neue tem um peso só (400).

**Tracking**, para texto em caixa alta. No Tailwind: `tracking-display`, `tracking-caps` etc.

| Token | em | Uso |
|---|---|---|
| `--ui-tracking-display` | 0.045 | título de página |
| `--ui-tracking-tight-caps` | 0.06 | aba |
| `--ui-tracking-caps` | 0.08 | botão, badge, título de modal |
| `--ui-tracking-wide-caps` | 0.12 | título de painel, rótulo de seção, rótulo de métrica |
| `--ui-tracking-kicker` | 0.14 | kicker acima de título |

**Receitas de texto:**

| Papel | Receita |
|---|---|
| Título da página | `SectionHeader` (h1, `--ui-fs-display`, Bebas) |
| Título de seção | `SectionHeader level="section"` (h2, 28px) |
| Kicker | `.ui-kicker`: 11px, heavy, caixa alta, dourado |
| Rótulo de seção | `.ui-section-label`: 11px, heavy, caixa alta, cinza |
| Título de painel | `PanelTitle`: 12px, heavy, caixa alta |
| Parágrafo | `.ui-text-body`: 14px, `--ui-text-soft`, 1.55 |
| Metadado | `.ui-text-meta`: 12px, `--ui-text-muted` |

### 2.3 Espaçamento

A base é de 4px. Os meios passos (6, 10, 14, 18 e 22) servem só para miolo denso de componente. Para o layout da página, use os passos inteiros.

| Token | px | | Token | px |
|---|---|---|---|---|
| `--ui-space-0-5` | 2 | | `--ui-space-4` | 16 |
| `--ui-space-1` | 4 | | `--ui-space-4-5` | 18 |
| `--ui-space-1-5` | 6 | | `--ui-space-5` | 20 |
| `--ui-space-2` | 8 | | `--ui-space-5-5` | 22 |
| `--ui-space-2-5` | 10 | | `--ui-space-6` | 24 |
| `--ui-space-3` | 12 | | `--ui-space-8` | 32 |
| `--ui-space-3-5` | 14 | | `--ui-space-10` | 40 |
| | | | `--ui-space-12` | 48 |
| | | | `--ui-space-16` | 64 |

Equivalência com o Tailwind: `gap-4` vale 16px, que é `--ui-space-4`. As classes `p-*`, `gap-*` e `m-*` do Tailwind usam a mesma base de 4px, então `gap-3` e `p-4` já estão na escala. Evite valores arbitrários como `gap-[13px]`.

**Ritmo vertical recomendado:**

| Distância | Valor |
|---|---|
| Entre seções de página | 32px (`space-8`) |
| Entre painéis de uma mesma seção | 16px (`space-4`) |
| Dentro de um painel | 12–16px |
| Entre um rótulo e o seu valor | 4–6px |

### 2.4 Layout

| Token | Valor | Uso |
|---|---|---|
| `--ui-content-max` | 1200px | largura padrão de `PageContainer` |
| `--ui-page-narrow` | 760px | `PageContainer narrow`: formulários, escolha única, leitura |
| `--ui-page-wide` | 1280px | reservado. Hoje `PageContainer wide` continua limitado a `--ui-content-max` (1200px), igual ao padrão |
| `--ui-measure` | 680px | largura máxima de um parágrafo |
| `--ui-gutter` | 16 / 24 / 32px | margem lateral (mobile, ≥640px, ≥1024px) |
| `--ui-page-top` / `--ui-page-bottom` | 20–32 / 48px | respiro do topo e do pé da página |
| `--ui-topbar-h` | 64px | altura da barra superior |
| `--ui-modal-w` / `--ui-modal-w-wide` | 560 / 760px | largura dos modais |

**Breakpoints em uso:**

| Largura | Comportamento |
|---|---|
| < 640px | celular: uma coluna e barra de ação fixa |
| ≥ 640px | `sm`: duas colunas em grades de escolha |
| ≥ 900px | grades largas (mercado, revisão) |
| ≥ 1024px | `lg`: três colunas e coluna lateral |
| ≥ 1280px | abas laterais (`ui-tabs--side`) |

### 2.5 Forma, elevação e movimento

**Raios:**

| Token | Valor | Uso |
|---|---|---|
| `--ui-radius-sm` | 6px | chip, skeleton |
| `--ui-radius-md` | 10px | botão, campo, banner |
| `--ui-radius-lg` | 14px | painel, cartão de escolha |
| `--ui-radius-xl` | 18px | modal |
| `--ui-radius-pill` | 999px | badge, saldo, progresso |

No Tailwind, os raios saem de `--radius` (14px): `rounded-sm` = 10px, `rounded-md` = 12px, `rounded-lg` = 14px, `rounded-xl` = 18px e `rounded-full` = pílula. Para 6px, use `rounded-(--ui-radius-sm)`. Prefira `rounded-lg` em caixas e `rounded-sm` em controles. O `rounded-2xl` fica fora da escala.

**Sombras:**

| Token | Uso |
|---|---|
| `--ui-shadow-panel` | painel |
| `--ui-shadow-raised` | elemento flutuante sobre a página |
| `--ui-shadow-overlay` | modal |
| `--ui-shadow-brand` | brilho do botão primário |

**Movimento:** `--ui-duration-fast` 120ms (hover de ícone), `--ui-duration-standard` 220ms (padrão) e `--ui-duration-emphasis` 360ms (entrada de painel ou modal). As curvas são `--ui-ease-out` (entradas) e `--ui-ease-standard`. Com `prefers-reduced-motion`, as animações de interface são desligadas no fim do `tokens.css`.

### 2.6 Camadas (z-index)

Use os tokens, nunca números soltos (`z-[70]`, `z-[100]`). No Tailwind: `z-(--ui-z-modal)`.

| Token | Valor | Uso |
|---|---|---|
| `--ui-z-base` | 0 | conteúdo |
| `--ui-z-raised` | 1 | sobreposição dentro de um componente |
| `--ui-z-sticky` | 10 | barra superior e cabeçalhos fixos |
| `--ui-z-dropdown` | 20 | menus e popovers |
| `--ui-z-action-bar` | 30 | `FixedActionBar` e navegação inferior |
| `--ui-z-overlay` | 40 | telas cheias que não são diálogo |
| `--ui-z-modal` | 50 | `GameModal` e `ConfirmDialog` |
| `--ui-z-modal-stacked` | 60 | modal aberto sobre outro modal |
| `--ui-z-toast` | 90 | avisos (sonner) |
| `--ui-z-splash` | 100 | splash e abertura de pacote |

---

## 3. Componentes

Todos são exportados por `client/src/design-system/index.ts`. A classe CSS entre parênteses serve para quando o markup não pode usar o componente React (por exemplo, dentro de Radix ou de uma lista que já existe).

### Estrutura de página

**`AppShell`** (`.ui-app`): a raiz da tela.
- `immersive`: escurece o fundo.
- `backgroundImage`: imagem de fundo com degradê.

**`TopBar`** (`.ui-topbar`): barra superior das telas de fluxo (setup, draft, liga). Aceita `title`, `subtitle` (linha pequena embaixo), `center` (ex.: saldo), `right` (ex.: Sair) e `playerName`.

**`PageContainer`** (`.ui-page`): centraliza o conteúdo e aplica o gutter. Tem três larguras:

| Variante | Largura | Quando usar |
|---|---|---|
| padrão | 1200px | grades de escolha |
| `narrow` | 760px | uma coluna, formulário |
| `wide` | 1200px (limitado por `--ui-content-max`) | o mesmo que o padrão; telas do fluxo usam por convenção |

Todas as telas de um mesmo fluxo usam a mesma largura.

**`SectionHeader`**: kicker opcional, título, descrição e ações à direita.
- `level="page"` (padrão) gera um `h1` com a fonte display. Use só um por tela.
- `level="section"` gera um `h2` de 28px para blocos dentro da página.

**`FixedActionBar`**: barra fixa no pé da tela com a ação principal do passo.
- Use `narrow` quando a página for `narrow`.
- A ordem é: Voltar (ghost) à esquerda e a ação principal (`primary`, `size="large"`, ocupando o espaço) à direita.
- Reserve espaço no fim da página (`pb-28`) para a barra não cobrir conteúdo.

### Superfícies

**`Panel`** (`.ui-panel`), com `PanelHeader`, `PanelTitle` e `PanelBody` (`flush` remove o padding).

| Tom | Quando usar |
|---|---|
| `default` | painel padrão |
| `accent` | borda dourada, para o item em destaque |
| `inset` | rebaixado, para blocos dentro de outro painel |
| `live` | borda vermelha, para partida em andamento |

`density="compact"` reduz o padding. Use `Panel` para qualquer caixa com borda. Não monte caixas com `rounded-xl border bg-[#…]`.

**`Metric`**: rótulo, valor grande e detalhe. `tone` aceita `brand`, `success` e `danger`. Serve para resumos numéricos (overall, química, posição).

**`ChoiceCard`** (`.ui-choice`): um cartão selecionável inteiro (formato, dificuldade, treinador, formação). Não sobrescreva a borda e o fundo com `style` para o estado selecionado: o próprio componente já pinta o selecionado de dourado. A exceção é a dificuldade, que usa a cor da raridade.

**`ChoiceCheck`**: o selo dourado de "selecionado", com ✓, no canto superior direito do `ChoiceCard`. `size="small"` (22px) serve para colocar ao lado de um título; `color` troca o dourado pela cor da raridade. Substitui os círculos "✓" feitos à mão.
- `selected` mostra a borda dourada e define `aria-pressed`.
- O conteúdo é livre. O selo ✓ fica no canto superior direito.

### Ações

**`Button`** (`.ui-btn`):

| `intent` | Uso |
|---|---|
| `primary` | a ação principal (uma por tela) |
| `secondary` | ações comuns |
| `ghost` | Voltar, Cancelar, ações terciárias |
| `danger` | destrutivo (Sair da sala, Vender) |
| `success` | confirmar ganho |
| `info` | ação neutra destacada |

| `size` | Altura | Fonte |
|---|---|---|
| `small` | 36px | 11px; uso em toolbars densas no desktop |
| padrão | 42px | |
| `large` | 52px | Bebas 20px, para a ação principal |

- `block` ocupa a largura toda.
- Abaixo de 420px de largura, o `large` reduz a fonte para 18px, para o rótulo da ação principal caber em uma linha.
- `loading` mostra um spinner e desabilita o botão.
- Estados: hover sobe 1px, foco mostra o anel `--ui-focus`, desabilitado fica com 52% de opacidade e cursor bloqueado.
- No celular, o botão `small` precisa ficar dentro de uma área tocável de 44px.

**`IconButton`** (`.ui-icon-btn`): botão só com ícone.
- `label` é obrigatório e vira `aria-label` e `title`.
- `size`: `small` (36px), padrão (40px) ou `large` (48px, fechar em tela cheia).

### Formulários

**`Input`** (`.ui-input`): altura de 44px, fundo rebaixado e borda dourada no foco.

**`Field`**: rótulo, controle, dica ou erro.

```tsx
<Field label="Nome do seu time" htmlFor="team-name" hint="Pelo menos 2 letras." error={erro}>
  <Input id="team-name" value={nome} onChange={…} />
</Field>
```

O erro substitui a dica, recebe `role="alert"` e pinta a borda do campo de vermelho.

### Navegação

**`Tabs`, `TabList`, `Tab` e `TabPanel`** (Radix, `.ui-tabs`): abas sublinhadas em dourado.

| Variante | Comportamento |
|---|---|
| padrão | rola na horizontal sem barra |
| `.ui-tabs--equal` | todas as abas numa linha, com a mesma largura (2 a 4 abas) abaixo de 900px |
| `.ui-tabs--side` | menu vertical a partir de 1280px |

Com mais de 4 abas no mobile, prefira a rolagem horizontal a quebrar em duas linhas.

### Feedback

**`Chip`** (`.ui-chip`, numa fileira `.ui-chip-row`): filtro em pílula (liga, categoria). `selected` deixa o chip dourado e define `aria-pressed`. A fileira quebra linha no desktop e rola para o lado no celular, sem barra de rolagem.

**`Badge`** (`.ui-badge`): etiqueta curta em caixa alta, com no máximo 2 palavras. Tons: `default`, `brand`, `info`, `success`, `warning` e `danger`.

**`StatusBanner`** (`.ui-status`): mensagem de estado com bolinha colorida.
- Tons: `default`, `success`, `warning`, `danger` e `live`.
- Os tons `danger` e `success` tocam um som curto ao aparecer.

**`Progress`** (`.ui-progress`): barra de 6px. Tons: `brand`, `success`, `warning` e `danger`.

**`Skeleton`** (`.ui-skeleton`): bloco de carregamento. Mantenha o tamanho do conteúdo final.

**`EmptyState`** (`.ui-empty`): `icon` opcional, `title`, `description` e `action`. O título diz o que falta. A descrição diz como resolver e, quando possível, oferece a ação.

### Diálogos

**`GameModal`**: o modal de conteúdo, sobre o Radix Dialog.
- Fecha por X, Esc ou clique fora, a não ser que `dismissible={false}`.
- `size` pode ser `default` (560px) ou `wide` (760px). `fullscreen` ocupa a tela toda.
- `stacked` serve para abrir um modal sobre outro.
- A especificação completa está em `docs/superpowers/specs/2026-09-26-modal-padronizacao-design.md`.

**`ConfirmDialog`**: pergunta de sim ou não, sem X.
- O botão de confirmação diz a ação ("Vender carta"), nunca "OK".
- O de cancelar diz "Cancelar" ou "Voltar".

### Utilitários de layout

| Classe | Comportamento |
|---|---|
| `.ui-stack` | coluna com 16px de espaço |
| `.ui-cluster` | linha que quebra, com 10px de espaço |
| `.ui-kicker` | kicker |
| `.ui-section-label` | rótulo de seção |
| `.ui-text-body` | parágrafo |
| `.ui-text-meta` | metadado |
| `.ui-gesture-surface` | sem seleção de texto em superfícies de arrastar |

---

## 4. Padrões de tela

**Telas de fluxo (setup, draft, revisão):**
1. `TopBar` com a marca e Sair.
2. `PageContainer` com largura fixa para o fluxo inteiro.
3. `SectionHeader` com o título e uma frase de descrição.
4. O conteúdo.
5. `FixedActionBar` com Voltar e o próximo passo.

O botão principal diz o próximo passo ("Escolher formação →"), não "Continuar".

**Hubs (liga, menu, loja):** cabeçalho alinhado à esquerda como o resto da página, sem misturar com blocos centralizados. As abas ficam logo abaixo do resumo. A coluna lateral (classificação, carrinho) aparece só a partir de `lg`. A ação principal do hub (Jogar rodada, Avançar) usa `Button intent="primary" size="large" block`: no celular ela fica numa barra fixa no pé da tela; no desktop fica fixa (sticky) no fim da coluna de conteúdo, para nunca exigir rolar a lista inteira.

**Grades de escolha:** uma coluna no celular, duas a partir de `sm` e três a partir de `lg`, quando o cartão couber. Não deixe metade da tela vazia no desktop.

**Listas e tabelas:** o texto fica entre 12 e 13px. Os números ficam alinhados à direita, em `font-game` ou `tabular-nums`. A linha do jogador é destacada com `--ui-brand-soft`.

**Ícones:** use lucide-react e a família de ícones do jogo (`TacticIcon`, `TraitIcon` etc.). Não use emoji como ícone de interface.

---

## 5. Textos

1. **Português do Brasil e voz direta.** Fale com o jogador na segunda pessoa ("Escolha seu treinador"). Escreva frases curtas.
2. **Caixa.** Títulos, botões, abas, kickers e badges vão em caixa alta via CSS. Escreva o texto em caixa normal no código e deixe o `text-transform` cuidar do resto. Descrições e dicas vão em caixa normal, como frase.
3. **Botões.** Comece com um verbo que diga o que acontece: "Comprar pacote", "Iniciar draft", "Jogar rodada 1". Evite "OK", "Confirmar" sozinho e "Clique aqui". O rótulo precisa ser verdadeiro: um botão bloqueado até o jogador agir não pode se chamar "Pular".
4. **Números com unidade:** "36 times", "8 rodadas", "120 moedas". Em português, o símbolo de porcentagem fica colado ao número ("+10%").
5. **Dicas e erros.** Uma dica explica a regra antes do erro ("Pelo menos 2 letras"). Um erro diz o que fazer ("Escolha um nome com 2 letras ou mais").
6. **Carregando e espera:** use o caractere de reticências ("Carregando álbum…"), nunca três pontos. A frase diz o que está acontecendo, não só "Carregando…".
7. **Estados vazios** dizem o que falta e o próximo passo ("Seu álbum ainda está vazio. Abra pacotes na Loja para conseguir cartas.").
8. **Termos do jogo são fixos:**

| Use | Não use |
|---|---|
| Álbum | Álbum dos Imortais (nome antigo) |
| Moedas (moeda da conta) | |
| Créditos (moeda da competição) | |
| Química | |
| Geral (o número da carta) | Overall, OVR |
| Treinador | Técnico, em títulos e rótulos |
| Elenco | |
| Rodada | |
| Mata-mata | |
| Fase de liga | |

---

## 6. Acessibilidade

**Contraste:**
- `--ui-text` e `--ui-text-soft` passam no AA sobre qualquer superfície.
- `--ui-text-muted` passa no AA para texto a partir de 12px.
- `--ui-text-faint` (#848496) passa no AA em todas as superfícies, de 4.67:1 a 5.44:1. O tom antigo, #6a6a7a, tinha só 3.2 a 3.8:1. Não use hex de cinza solto no lugar dele.

**Foco e toque:**
- Todo elemento clicável mostra o anel `--ui-focus` no foco por teclado (regra global no `index.css`).
- Alvos de toque têm 44px ou mais no mobile. Em telas de toque (`pointer: coarse`), botões `ghost` e `small` e o `IconButton` sobem sozinhos para 44px. Nada clicável fica abaixo de 24px (WCAG 2.2 AA); a auditoria das telas da conta encontrou no mínimo 34px.

**Rótulos e semântica:**
- Botão só com ícone usa `IconButton` com `label`.
- Uma imagem decorativa leva `alt=""`.
- `ChoiceCard` já expõe `aria-pressed`, e as abas usam Radix (setas do teclado).

**Movimento:** respeite `prefers-reduced-motion`. Nenhuma informação pode depender só da animação.

---

## 7. Migração (para os próximos lotes)

| Trocar | Por |
|---|---|
| `text-[10px]` | `text-micro` |
| `text-[11px]` | `text-caption` |
| `text-[12px]` | `text-label` |
| `text-[13px]` | `text-body-sm` |
| `text-[9px]` | `text-micro`, ou repensar o texto |
| `tracking-[0.12em]` | `tracking-wide-caps` |
| `tracking-[0.14em]` | `tracking-kicker` |
| `tracking-[0.08em]` | `tracking-caps` |
| `tracking-widest` em rótulos | `tracking-wide-caps` |
| `<button className="…rounded-xl bg-[#C9A84C]…">` | `<Button intent="primary">` |
| caixas com borda montadas à mão | `Panel` |
| `z-[60]`, `z-[90]`, `z-[100]` | `z-(--ui-z-modal-stacked)`, `z-(--ui-z-toast)`, `z-(--ui-z-splash)` |
| hex de cor de interface | o token equivalente da seção 2.1 (a arte de jogo pode manter hex) |

**Atenção ao `cn()`:** ele usa o tailwind-merge, configurado em `client/src/lib/utils.ts` para reconhecer os nomes da escala (`text-label`, `leading-ui-snug`, `tracking-caps`…). Ao criar um nome novo de tamanho, entrelinha ou tracking no `@theme`, acrescente-o lá também. Sem isso, o `cn()` trata `text-label` como cor e o descarta quando há outra classe `text-[…]` na mesma lista.

Para saber quanto ainda falta migrar:

```bash
grep -rhoE "text-\[[0-9]+px\]" client/src --include=*.tsx | sort | uniq -c
```
