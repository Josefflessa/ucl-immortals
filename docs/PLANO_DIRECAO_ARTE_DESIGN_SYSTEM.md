# UCL Immortals — Plano de direção de arte e design system

## 0. Objetivo

Transformar a interface de UCL Immortals em uma experiência com direção visual autoral, consistente e reconhecível, sem alterar as artes que já pertencem ao jogo.

O resultado desejado não é apenas uma interface “mais bonita”. É um sistema capaz de responder, de maneira coerente, a estas perguntas em qualquer tela:

- O que é mais importante aqui?
- Qual é a próxima ação do jogador?
- O que é conteúdo do jogo e o que é interface?
- Qual estado está selecionado, bloqueado, disponível, ao vivo ou concluído?
- Como essa tela se relaciona visualmente com todas as outras fases da campanha?

## 1. Escopo e limites

### 1.1 O que será preservado

Os elementos abaixo são ativos/conteúdo do jogo e não fazem parte da primeira frente de redesign:

- escudo e sua arte;
- molduras e texturas das cartas;
- retratos dos jogadores;
- escudos de clubes;
- imagens dos técnicos;
- imagens dos estádios;
- logo e ícones de marca já aprovados;
- identidade visual específica das raridades das cartas.

Podemos mudar o tamanho, posicionamento, recorte, espaçamento, estado de seleção e contexto desses ativos. Não devemos redesenhar os arquivos, trocar as texturas ou descaracterizar a arte existente como consequência da criação do design system.

### 1.2 O que entra no redesign

- shell das páginas;
- cabeçalhos, rodapés e navegação entre fases;
- hierarquia de títulos e textos;
- tipografia de interface;
- paleta e tokens semânticos de UI;
- painéis, cards de informação, bordas e elevação;
- botões, abas, badges, métricas, tabelas e estados;
- campos, modais, drawers, tooltips e notificações;
- layout responsivo e ordem de leitura no mobile;
- feedback de seleção, bloqueio, carregamento, sucesso, erro e ao vivo;
- transições e animações funcionais;
- organização dos componentes React e remoção da repetição visual;
- critérios de acessibilidade e performance visual.

## 2. Diagnóstico atual

### 2.1 O jogo já tem uma boa matéria-prima

O produto possui uma fantasia clara: montar um elenco histórico e competitivo, misturando jogadores de diferentes épocas, perfis e raridades; criar química; escolher técnico e formação; atravessar liga e mata-mata; simular partidas; e terminar com um relatório de campanha. Também existem elementos com alto valor de identidade — cartas, escudos, campo, técnicos, estádios e troféu.

O problema não é falta de conteúdo visual. É a falta de um sistema que faça todo esse conteúdo parecer parte do mesmo produto.

### 2.2 Por que a interface hoje pode parecer “de IA” ou montada por partes

1. **Cores aplicadas localmente.** O código usa tokens globais, mas muitas telas ignoram esses tokens e aplicam hexadecimais diretamente em `style`, `className`, SVG e gradientes. A mesma intenção visual aparece com várias cores e opacidades diferentes.

2. **Metáforas visuais concorrentes.** A interface mistura carta colecionável, dashboard neon, glassmorphism, broadcast esportivo e painel de ficção científica. Cada metáfora isolada funciona; juntas, sem uma regra de prioridade, parecem decisões independentes.

3. **Excesso de tratamento visual em elementos secundários.** Muitos painéis têm borda, gradiente, glow, sombra e tipografia condensada ao mesmo tempo. Quando tudo recebe destaque, nada é realmente principal.

4. **Tipografia sem hierarquia editorial.** Bebas Neue e Rajdhani dão energia de jogo, mas o uso amplo de caixa alta, tracking e texto condensado reduz a diferença entre título, label, dado e descrição. Isso cria densidade e sensação de template.

5. **Páginas muito longas e monolíticas.** `LeaguePage.tsx` e `MatchSimPage.tsx` concentram grandes quantidades de composição visual; `PlayerCard.tsx` também mistura renderização de arte, regra visual de raridade, conteúdo e interação. Isso dificulta manter consistência entre telas.

6. **Componentes de UI genéricos já existem, mas não formam a camada do jogo.** Há uma biblioteca de componentes baseada em Radix, porém boa parte da interface de gameplay foi construída com composição manual e estilos inline. O produto não tem uma camada intermediária de componentes com vocabulário próprio.

7. **Feedback de estado pouco sistematizado.** Selecionado, preferido, bloqueado, pronto, aguardando oponente, ao vivo, vantagem e erro aparecem com tratamentos diferentes em cada tela.

8. **Dependência visual de recursos remotos.** Imagens de herói, campo, retratos, escudos e técnicos são carregadas de origens diferentes. Isso pode criar variação de crop, falha, latência e aparência entre sessões. O plano não troca as artes agora, mas cria uma política de carregamento e fallback para que a interface não dependa de um carregamento perfeito.

### 2.3 Evidências técnicas encontradas

- `client/src/index.css` contém uma base escura e tokens Tailwind, mas também mantém cores hexadecimais fixas e utilitários visuais pontuais.
- O projeto usa `Bebas Neue` e `Rajdhani` via Google Fonts em `client/index.html`.
- Há aproximadamente 134 arquivos de interface em `client/src`.
- Foram encontrados cerca de 35 blocos de estilo inline, aproximadamente 1.976 ocorrências de hexadecimal e aproximadamente 1.227 linhas de composição visual em páginas/componentes do jogo. Esses números não são uma meta de “zerar tudo”, mas mostram que a linguagem visual está distribuída demais.
- `MenuPage.tsx` tem cerca de 500 linhas; `DraftPage.tsx`, cerca de 515; `LeaguePage.tsx`, cerca de 1.516; `MatchSimPage.tsx`, cerca de 1.753; `PlayerCard.tsx`, cerca de 955. Esses arquivos devem ser tratados como containers/orquestradores, não como o local definitivo de todo o visual.

## 3. Direção visual proposta

### 3.1 Conceito: “Matchday Archive”

A direção recomendada é uma mistura controlada de **arquivo de grandes noites europeias** com **transmissão de dia de jogo**.

O jogo deve parecer um produto esportivo premium que documenta uma campanha histórica, não um painel genérico com brilho neon.

#### Palavras-chave

- noite de jogo;
- arquivo de jogadores históricos e especiais;
- programa oficial de partida;
- placar editorial;
- decisão e legado;
- precisão tática;
- raridade como conteúdo, não como decoração da interface.

#### O que essa direção evita

- glassmorphism em todos os elementos;
- gradiente diferente em cada botão;
- glow permanente em tudo;
- excesso de roxo, ciano e cores “tech” sem significado;
- títulos, labels e descrições tratados como se tivessem a mesma importância;
- formas decorativas que não ajudam o jogador a tomar uma decisão.

### 3.2 Regra de separação visual

Haverá duas camadas visuais distintas:

| Camada | Responsabilidade | Exemplo |
|---|---|---|
| Conteúdo/arte | Comunicar fantasia, raridade e identidade do jogo | carta, escudo, retrato, estádio, troféu |
| Interface/chrome | Organizar decisões, dados e estados | painel, botão, tabela, tabs, stepper, modal |

A interface deve ser sóbria o suficiente para valorizar os ativos. A carta pode continuar rica e ornamental; o painel que explica a carta deve ser simples e legível.

### 3.3 Paleta semântica de interface

A paleta final deve ser definida em tokens. Os valores abaixo são a direção inicial; devem ser validados com contraste e com capturas das telas-piloto antes de virar contrato definitivo.

```css
:root {
  /* superfícies */
  --ui-bg: #080b14;
  --ui-surface-1: #0e1421;
  --ui-surface-2: #121b2a;
  --ui-surface-3: #182438;
  --ui-surface-inset: #090f1b;

  /* linhas e texto */
  --ui-line: #26344a;
  --ui-line-strong: #3a4a63;
  --ui-text: #f4f1e8;
  --ui-text-soft: #c6ccd7;
  --ui-text-muted: #8f9bae;
  --ui-text-faint: #647188;

  /* marca e ação principal */
  --ui-brand: #d7b45a;
  --ui-brand-strong: #f0d27a;
  --ui-brand-ink: #17130a;

  /* estados */
  --ui-info: #6c91d8;
  --ui-success: #55b98a;
  --ui-warning: #d89a55;
  --ui-danger: #d96a64;
  --ui-live: #e06464;

  /* lados da partida; não confundir com marca */
  --match-home: #e6bd54;
  --match-away: #7186d8;
}
```

Regras de uso:

- dourado é marca, foco e ação primária; não é fundo de todos os componentes;
- verde, vermelho e laranja significam estados, não decoração;
- roxo/índigo só aparece quando houver uma semântica clara, como lado adversário ou habilidade;
- raridades continuam com seus próprios tratamentos dentro da camada de arte;
- nenhuma nova tela deve inserir uma cor hexadecimal fora dos tokens, de um mapa de raridade ou de uma visualização que realmente dependa de cor dinâmica.

### 3.4 Tipografia

Recomendação:

- **Display/placar:** manter Bebas Neue inicialmente, com uso restrito a títulos de impacto, placares, códigos de sala e nomes de competição.
- **Interface e leitura:** migrar gradualmente de Rajdhani para uma sans mais editorial e legível, como Inter, DM Sans ou Barlow. A escolha final deve ser feita numa tela-piloto com números, nomes longos e textos em português.
- **Labels:** caixa alta apenas para labels curtos. Descrições, instruções, estados de espera e explicações devem usar capitalização normal.
- **Números:** variante tabular para pontos, saldo, placar, minutos e atributos.

Escala inicial:

| Papel | Tamanho desktop | Tamanho mobile | Uso |
|---|---:|---:|---|
| Display hero | 56–72 px | 40–52 px | título principal da campanha |
| Título de tela | 36–48 px | 30–38 px | uma única chamada principal |
| Título de seção | 20–28 px | 18–22 px | blocos de conteúdo |
| Label | 10–12 px | 10–11 px | contexto e categoria |
| Corpo | 14–16 px | 14–16 px | leitura e explicação |
| Dado | 24–40 px | 22–32 px | métricas e placar |

### 3.5 Forma, superfície e elevação

O sistema terá quatro níveis de superfície, com pouca variação:

1. **Canvas:** fundo da fase, com textura ou spotlight muito discreto.
2. **Panel:** bloco principal de decisão.
3. **Raised:** elemento ativo, selecionado ou elevado sobre o panel.
4. **Overlay:** modal, drawer, popover e confirmação.

Raios:

- 6 px para controles compactos;
- 10 px para campos, badges e cards pequenos;
- 14 px para painéis;
- 18 px para heróis e superfícies de destaque;
- pill apenas para status, filtros e controles que explicitamente representam um estado.

Elevação:

- borda de 1 px e contraste de superfície antes de sombra;
- sombra curta e macia para separar níveis;
- glow dourado apenas em foco, ação primária, seleção especial e recompensa;
- nunca animar sombra pesada ou blur continuamente.

### 3.6 Espaçamento e grid

Escala base: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`.

Layout:

- canvas central com largura máxima de 1200–1280 px;
- gutters de 16 px no mobile, 24 px no tablet, 32 px no desktop;
- uma coluna de foco em onboarding;
- duas colunas para decisão + preview;
- três zonas somente quando a informação justificar: navegação/estado, foco, inspeção;
- evitar grids com muitos cards pequenos quando uma lista ou tabela comunicar melhor.

## 4. Arquitetura do design system

### 4.1 Princípio de dependência

O design system não deve conhecer `GameContext`, jogadores, fases ou regras de química. Ele fornece componentes visuais e contratos de estado.

```text
design-system primitives
        ↓
game patterns
        ↓
game visuals / content assets
        ↓
page containers + GameContext
```

Isso permite alterar a aparência sem duplicar a lógica do jogo.

### 4.2 Estrutura recomendada

```text
client/src/design-system/
  tokens.css
  motion.ts
  typography.ts
  variants.ts
  primitives/
    AppShell.tsx
    PageContainer.tsx
    Panel.tsx
    Button.tsx
    IconButton.tsx
    Badge.tsx
    Tabs.tsx
    Stepper.tsx
    SectionHeader.tsx
    Metric.tsx
    Progress.tsx
    Divider.tsx
    Skeleton.tsx
    EmptyState.tsx
    StatusBanner.tsx
    Dialog.tsx
    Drawer.tsx
    Tooltip.tsx
  patterns/
    GameHeader.tsx
    FlowHeader.tsx
    CompetitionHeader.tsx
    ArtifactPreview.tsx
    PlayerRow.tsx
    StatGrid.tsx
    MatchCard.tsx
    StandingsTable.tsx
    Timeline.tsx
    ChoiceCard.tsx
  visuals/
    PlayerCardVisual.tsx
    CrestVisual.tsx
    FormationPitch.tsx
    StadiumVisual.tsx
```

Os componentes existentes de conteúdo — `PlayerCard`, `CardShield`, `Crest`, `FormationField`, `MatchFieldView`, `CoachCard` e `StadiumCard` — não precisam ser eliminados. A primeira etapa é separar suas responsabilidades e colocá-los atrás de wrappers/patterns consistentes.

### 4.3 API visual dos componentes

Todos os componentes devem aceitar variantes explícitas, em vez de estilos ad hoc:

```tsx
<Panel tone="default" density="comfortable" />
<Panel tone="accent" density="compact" />
<Button intent="primary" size="lg" loading />
<Badge tone="success" emphasis="subtle" />
<Metric label="Química" value={92} trend="up" />
<StatusBanner status="waiting" title="Aguardando o anfitrião" />
```

As variantes devem usar `class-variance-authority`, que já está disponível no projeto, ou mapas tipados equivalentes. O objetivo é impedir que cada tela invente sua própria combinação de fundo, borda, padding e hover.

### 4.4 Estados obrigatórios

Cada primitiva interativa deve definir, quando aplicável:

- default;
- hover;
- focus-visible;
- pressed;
- selected;
- disabled;
- loading;
- success;
- error;
- offline/awaiting;
- reduced motion.

O estado não deve depender apenas de cor. Seleção também precisa de borda, ícone, peso tipográfico ou mudança de posição; erro precisa de texto; loading precisa de uma indicação não cromática.

## 5. Sistema de motion

Motion deve explicar mudança de estado e reforçar o ritmo da partida.

Tokens iniciais:

```ts
export const motionTokens = {
  instant: 0,
  fast: 120,
  standard: 220,
  emphasis: 360,
  reveal: 600,
  ease: [0.22, 1, 0.36, 1],
};
```

Padrões:

- entrada de tela: fade + deslocamento pequeno, sem zoom exagerado;
- lista de escolhas: stagger curto, limitado aos primeiros elementos;
- seleção de carta: alteração de frame/estado e leve elevação;
- draft: foco no jogador ativo, confirmação clara, transição da carta para a lista;
- match sim: goal/evento usa uma única sequência de destaque, não vários pulsos simultâneos;
- relatório: revelação em etapas — resultado, campanha, destaques e ação seguinte;
- troca de aba: crossfade/slide de baixa amplitude.

Regras:

- implementar `prefers-reduced-motion` desde a primeira versão;
- usar `transform` e `opacity` para movimento;
- evitar animação permanente de `filter`, `box-shadow` e blur;
- não usar motion para mascarar uma hierarquia ruim;
- toda animação deve ter uma função: orientar, confirmar, dar ritmo ou celebrar.

## 6. Redesign por fase do jogo

### 6.1 Menu e lobby

**Objetivo:** apresentar a fantasia em poucos segundos e oferecer uma decisão clara.

Composição recomendada:

```text
eyebrow / competição
logo + título
frase de promessa
[Jogar solo] [Multiplayer]
[Como jogar]
prova de sistemas: Draft · Química · Tática · Liga
```

Mudanças:

- preservar hero e logo, mas reduzir camadas de brilho concorrentes;
- um único CTA primário e um secundário claramente diferente;
- transformar os benefícios em uma faixa editorial discreta, não em cinco badges competindo com o título;
- lobby deve usar o mesmo shell, com código da sala como foco, jogadores como lista de status e configurações do host em painel separado;
- mensagens de espera devem ser humanas e legíveis, não apenas texto em caixa alta com spinner.

### 6.2 Setup, escudo, técnico e formação

**Objetivo:** fazer o onboarding parecer uma sequência de decisões de uma campanha, não um conjunto de páginas independentes.

O cabeçalho principal de cada etapa mantém a mesma estrutura editorial e a navegação acontece pelos controles de voltar/avançar no rodapé. O `FlowHeader` continua disponível como primitive para contextos que realmente precisem expor progresso, mas não é renderizado acima destas telas: a validação visual mostrou que essa camada duplicava o kicker e deixava o fluxo pesado.

Quando um contexto exigir progresso explícito, a estrutura recomendada é:

```text
01 Dificuldade → 02 Escudo → 03 Técnico → 04 Formação → 05 Draft
```

O passo atual é o foco; passos concluídos ficam discretos; passos futuros não parecem disponíveis.

Por fase:

- **Dificuldade:** lista de escolhas como “dossiês” com uma única leitura de força, descrição e consequência. Reduzir efeitos de seleção e eliminar informação repetida.
- **Escudo:** deixar a arte dominar a composição. O sistema só organiza título, filtro, seleção, confirmar e voltar.
- **Técnico:** cards com retrato e uma área de comparação/efeito. Regras e descrições em painel estável, sem misturar cada cor de habilidade ao chrome inteiro.
- **Formação:** campo como preview principal; formações em lista/cartões ao lado; `ImpactMeter` tratado como componente semântico e não como decoração.
- **Mobile:** preview primeiro quando a decisão depende de visualizar o ativo; controles e confirmação depois.

### 6.3 Draft

**Objetivo:** transformar o draft no momento de maior desejo e tensão visual.

Desktop:

```text
header: rodada / jogador ativo / tempo
esquerda: elenco escolhido + slots
centro: carta/seleção em foco
direita: opções disponíveis + informação contextual
rodapé: ação principal e regra da rodada
```

Mobile:

```text
rodada + timer
opção em foco
confirmar
elenco resumido em drawer/accordion
outras opções em lista horizontal/vertical
```

Diretrizes:

- o timer precisa ser um componente com estados normal, alerta e expirado;
- a carta não deve competir com dez caixas de informação;
- atributos completos ficam em inspeção/modal, enquanto o card principal comunica decisão rápida;
- estados “indisponível”, “já escolhido” e “sua vez” precisam ser visualmente distintos;
- o roster deve funcionar como memória do jogador, não como uma segunda tela inteira dentro do draft.

### 6.4 Revisão de elenco e “Meu time”

**Objetivo:** criar uma sala de comando tática.

Estrutura:

- cabeçalho com química, rating e status da escalação;
- campo/escalação como foco;
- painel de inspeção para formação, estilo, capitão e bolas paradas;
- banco e elenco completo em uma lista consistente;
- ação “iniciar competição” fixa em posição previsível, sem parecer um banner publicitário.

`SquadEditor` deve ser dividido em subcomponentes visuais. A regra de troca de jogadores continua no container da página/contexto; o componente visual recebe callbacks e estados.

### 6.5 Liga e mata-mata

**Objetivo:** fazer a campanha parecer uma competição contínua, não uma coleção de tabs.

Hierarquia do hub:

1. próxima partida e decisão imediata;
2. posição/forma/pontos;
3. tabela ou confrontos;
4. elenco, mercado, loja e explicações como áreas secundárias.

No modo liga:

- um `MatchdayCard` com adversário, local, mando, recompensa e CTA;
- tabela com linha do jogador fixada/destacada, mas sem pintar todas as células;
- forma recente usando semântica de estado e tooltip/legenda;
- mercado e loja acessados por tabs ou drawer, com hierarquia visual menor.

No mata-mata:

- bracket editorial com foco no confronto atual;
- agregado e próximo passo sempre visíveis;
- bloqueios/aguardos explicados dentro de um `StatusBanner`;
- não misturar visual de tabela, bracket, loja e elenco na mesma densidade sem separação.

### 6.6 Simulação de partida

**Objetivo:** parecer uma transmissão interativa.

Composição desktop:

```text
scorebug: mandante · placar · visitante · minuto · estádio
campo/visualização: foco central
coluna de acontecimentos: timeline da partida
coluna secundária: tática, momentum e controles
```

Mobile:

```text
scorebug compacto
campo ou evento principal
controle de ritmo
timeline
estatísticas expansíveis
```

Diretrizes:

- preservar o campo, os escudos e as cores dos lados da partida;
- separar claramente informação ao vivo de análise pós-evento;
- transformar o feed de eventos em timeline legível, com minuto, tipo de evento e impacto;
- reduzir caixas simultâneas e deixar o placar ocupar o topo da hierarquia;
- o overlay de gol deve ser uma celebração curta e consistente, com caminho de saída claro;
- gráficos de momentum precisam compartilhar eixos, labels, cores e legenda do sistema.

### 6.7 Relatório final

**Objetivo:** entregar sensação de legado e fechamento de campanha.

Sequência visual:

1. resultado final;
2. status conquistado ou eliminado;
3. resumo de campanha;
4. time ideal/melhores jogadores;
5. técnico, estádio e evolução;
6. próxima ação — jogar novamente, voltar ao menu ou compartilhar quando houver essa função.

O relatório deve usar mais espaço, menos densidade e um tom de “dossiê de temporada”. Os ativos existentes são o centro; o chrome só dá moldura, contexto e conclusão.

## 7. Plano técnico de migração

### Fase 0 — inventário e contrato visual

Entregáveis:

- inventário das telas e estados, incluindo online, loading, erro, espera e final;
- matriz de componentes repetidos;
- captura baseline das telas principais em desktop e mobile;
- documento de tokens e princípios;
- identificação das cores que são UI, raridade, time da partida ou arte.

Critério de saída: nenhuma decisão de cor ou componente do redesign depende de memória ou preferência local de uma página.

### Fase 1 — fundação do sistema

Entregáveis:

- `tokens.css` com cores, tipografia, espaçamento, raios, elevação e motion;
- `AppShell`, `PageContainer`, `Panel`, `Button`, `Badge`, `Tabs`, `Stepper`, `SectionHeader`, `Metric`, `Progress`, `StatusBanner`, `Dialog` e `Drawer`;
- foco visível e `prefers-reduced-motion`;
- substituição gradual dos utilitários globais de `index.css` por tokens;
- uma rota/sandbox de desenvolvimento para demonstrar variantes do sistema.

Critério de saída: uma mudança em um token atualiza várias telas sem busca manual por dezenas de hexadecimais.

### Fase 2 — telas-piloto

Implementar primeiro três telas que exercitam todo o vocabulário:

1. Menu — identidade e primeira impressão;
2. Draft — seleção, carta, timer, lista e tensão;
3. Match Sim — broadcast, status ao vivo, timeline, gráfico e controles.

Essas telas são o teste de direção. Só depois de aprovadas deve-se aplicar o sistema em todas as fases.

Critério de saída: as três telas parecem o mesmo produto em uma captura lado a lado, sem que o jogador precise aprender uma linguagem nova em cada uma.

### Fase 3 — onboarding e escalação

Aplicar `ChoiceCard`, `ArtifactPreview` e `SquadWorkspace` em:

- Setup;
- Crest;
- Coach;
- Formation;
- Squad Review.

Extrair a composição das páginas, mantendo lógica e dispatch nos containers.

### Fase 4 — competição e economia

Aplicar `CompetitionHeader`, `MatchdayCard`, `StandingsTable`, `Bracket`, `MarketList`, `ShopOffer` e `StatusBanner` em:

- League;
- Knockout;
- Market;
- Shop;
- lobby online e espera de jogadores.

### Fase 5 — polimento e robustez

- estados vazios e erros de imagens;
- skeletons e transições de carregamento;
- revisão de todas as strings longas em português;
- foco por teclado e navegação sem mouse;
- contraste e tamanho mínimo de alvo de toque;
- revisão de `alt`, `aria-live` para eventos da partida e labels de controles;
- performance de imagens e animações;
- capturas de regressão visual nas larguras críticas.

## 8. Plano de refatoração por arquivo

### `client/src/index.css`

- transformar tokens de UI em uma fonte única;
- retirar gradualmente cores hardcoded que não sejam tokens de conteúdo;
- centralizar superfície, scrollbar, seleção, focus ring e motion;
- criar utilities semânticas pequenas em vez de classes decorativas isoladas.

### `client/src/App.tsx`

- manter o roteamento por fase;
- adicionar um shell de transição/viewport comum quando não houver motivo para uma tela fullscreen;
- separar pré-carregamento de arte do shell visual, evitando que decisão de conteúdo fique acoplada à apresentação.

### `client/src/pages/MenuPage.tsx`

- separar hero, modo de jogo, lobby e faixa de recursos;
- remover estilos locais repetidos;
- usar os componentes de ação e status do sistema.

### `client/src/pages/DraftPage.tsx`

- manter `DraftTimer`, `DraftOptions` e `DraftedRoster` como padrões visuais testáveis;
- extrair o palco de seleção e o cabeçalho de rodada;
- deixar o container responsável pelo turno e o design system responsável pelo estado.

### `client/src/pages/LeaguePage.tsx`

- separar hub, liga, mata-mata, tabs, modais e widgets de partida;
- extrair tabela, card de partida, bracket, resumo de recursos e navegação;
- reduzir nesting e estilos derivados diretamente do estado dentro do JSX.

### `client/src/pages/MatchSimPage.tsx`

- separar scorebug, timeline, campo, momentum, decisões, estatísticas e overlay de gol;
- criar tokens para `home/away/live/neutral`;
- limitar estilos dinâmicos aos dados que realmente mudam.

### `client/src/components/game/PlayerCard.tsx`

- preservar a arte e o mapa de raridades;
- separar frame/arte, conteúdo, stats, química e estados de interação;
- manter uma API única para `compact`, `lite`, `selected` e `showChemistry`;
- mover constantes visuais para módulos próprios, sem mudar o conteúdo das cartas.

### `client/src/components/game/FormationField.tsx`, `MatchFieldView.tsx`, `Crest.tsx`

- preservar a visualização e extrair apenas wrappers de contexto, estados, labels, loading e fallback;
- padronizar como esses elementos entram em `ArtifactPreview`/`FieldPanel`.

## 9. Responsividade e acessibilidade

### Breakpoints de trabalho

- `0–639 px`: uma coluna, foco em uma decisão, controles de alta prioridade primeiro;
- `640–1023 px`: duas colunas quando houver preview + controle;
- `1024 px+`: composição completa, sem aumentar densidade indiscriminadamente.

### Regras

- alvo de toque mínimo de 44 px;
- foco visível em todos os controles;
- nunca comunicar seleção apenas pela cor;
- texto de corpo com contraste suficiente e line-height confortável;
- score, timer e eventos com `aria-live` quando mudarem em tempo real;
- drawer/modal com foco controlado e fechamento previsível;
- não bloquear scroll ou criar painéis horizontais impossíveis no mobile;
- usar `prefers-reduced-motion` para reduzir stagger, parallax, pulso e transições.

## 10. Performance e carregamento de arte

Sem alterar as artes, o sistema pode tornar seu uso mais profissional:

- definir dimensões e `aspect-ratio` antes do carregamento para evitar layout shift;
- manter `alt` coerente e `aria-hidden` para molduras puramente decorativas;
- usar loading/fallback visual uniforme para imagem remota;
- lazy-load em imagens fora da primeira tela;
- pre-carregar apenas os assets necessários para a fase atual;
- evitar que uma falha de imagem quebre o layout do card;
- não aplicar filtros pesados ou múltiplos backgrounds animados em listas longas.

## 11. Critérios de aceitação

O redesign será considerado bem-sucedido quando:

- Menu, Draft e Match Sim forem reconhecíveis como partes do mesmo produto;
- cada tela tiver uma ação primária evidente;
- título, contexto, dados e descrição tiverem níveis de leitura distintos;
- a maior parte das superfícies utilizar tokens, não hexadecimais locais;
- seleção, bloqueio, espera, erro, loading e sucesso forem consistentes;
- cartas, escudos, técnicos, estádios e campos continuarem com suas artes intactas;
- a interface funcionar em mobile sem simplesmente encolher o desktop;
- os estados de partida ao vivo forem legíveis sem depender de animação;
- o sistema respeitar teclado, contraste, foco e movimento reduzido;
- uma nova tela puder ser composta usando primitives/patterns existentes, sem copiar 30 linhas de estilos de outra página;
- uma mudança de marca, contraste ou espaçamento puder ser feita nos tokens e propagada pelo produto.

## 12. Ordem de prioridade

### P0 — necessário para sair da aparência fragmentada

- tokens de UI;
- tipografia e escala;
- `AppShell`/`PageContainer`;
- `Panel`, `Button`, `Badge`, `SectionHeader`, `Tabs`, `Stepper`;
- estados de foco, seleção, loading e espera;
- Menu, Draft e Match Sim como telas-piloto;
- regra explícita separando UI de arte do jogo.

### P1 — necessário para consolidar o produto

- onboarding completo;
- squad workspace;
- hub de liga e mata-mata;
- tabela, bracket, timeline e cards de partida;
- modais/drawers consistentes;
- mobile dedicado;
- tratamento de imagem e fallback.

### P2 — refinamento de produto premium

- sandbox visual documentado;
- regressão visual automatizada;
- microinterações de recompensa;
- temas sazonais ou variações de competição;
- performance avançada de assets;
- eventual ilustração de apoio para estados vazios, caso isso seja desejado depois.

## 13. Decisões que devem permanecer fixas durante a implementação

1. Não redesenhar escudos, cartas, molduras, retratos, estádios, técnicos ou logo dentro deste projeto de UI.
2. Não adicionar mais efeitos para compensar falta de hierarquia.
3. Não mudar regra de jogo durante a migração visual.
4. Não criar uma segunda versão visual de um componente sem motivo de produto.
5. Não permitir que uma página introduza tokens próprios sem justificativa documentada.
6. Validar primeiro três telas-piloto antes de migrar o restante.
7. Garantir que a densidade de informação seja uma decisão por breakpoint, não um efeito colateral do layout desktop.

## 14. Primeiro pacote de implementação recomendado

O primeiro pacote de código deve conter apenas a fundação e uma prova visual:

1. `client/src/design-system/tokens.css`;
2. primitives `AppShell`, `Panel`, `Button`, `Badge`, `SectionHeader`, `Tabs` e `StatusBanner`;
3. `FlowHeader` e `MatchdayCard` como patterns iniciais;
4. migração do Menu para esses primitives;
5. captura desktop/mobile do Menu;
6. revisão visual antes de tocar nas demais páginas.

Esse pacote é pequeno o bastante para ser revisado como uma unidade e grande o bastante para revelar se a direção “Matchday Archive” funciona. Depois dele, Draft e Match Sim devem ser usados para provar que o sistema aguenta seleção, dados densos e estados ao vivo.
