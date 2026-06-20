# UCL Immortals — Design Brainstorming

## Três Abordagens Estilísticas

### Abordagem A — "Noite de Champions"
Inspiração em noites épicas de Champions League: fundo escuro quase preto, estrelas douradas, azul UEFA profundo. Cartões de jogadores como peças premium de coleção. Probabilidade: 0.07

### Abordagem B — "Arquivo Histórico"
Estética de arquivo fotográfico vintage com grão, tons sépia/dourado, tipografia serifada editorial. Sensação de museu de futebol. Probabilidade: 0.04

### Abordagem C — "HUD Tático Moderno"
Interface de jogo eletrônico premium: preto profundo, linhas neon douradas/azuis, tipografia condensada bold, efeitos de brilho. Inspiração em Valorant + EA FC. Probabilidade: 0.08

---

## Abordagem Escolhida: C — "HUD Tático Moderno" (0.08)

### Design Movement
**Dark Premium Gaming UI** — fusão de interface de jogo AAA com a grandiosidade da Champions League. Referência: Valorant HUD + EA FC card design + UEFA visual identity.

### Core Principles
1. **Contraste extremo**: fundo quase preto (#0A0A0F), texto branco puro, acentos dourados e azul UEFA
2. **Cartas como protagonistas**: toda a UI orbita em torno das cartas de jogadores — elas são o elemento visual central
3. **Dados com elegância**: atributos e estatísticas exibidos com clareza cirúrgica, sem poluição visual
4. **Momentos épicos**: animações reservadas para eventos importantes (gol, duelo decisivo, vitória)

### Color Philosophy
- **Fundo**: `#080810` — azul-preto profundo, como o céu de uma noite de Champions
- **Superfícies**: `#0F0F1A` e `#14142A` — camadas de profundidade
- **Dourado UCL**: `#C9A84C` — o ouro das estrelas e troféus
- **Azul UEFA**: `#1B4FD8` — identidade da competição
- **Prata**: `#8A8A9A` — elementos secundários
- **Vermelho alerta**: `#E84040` — cartões, alertas, perigo

### Layout Paradigm
Layout assimétrico com painel lateral de campo tático à esquerda e cartas/informações à direita. Durante o draft: grid de cartas em destaque central. Durante partidas: campo de futebol estilizado com indicadores de duelo sobrepostos.

### Signature Elements
1. **Molduras de raridade nas cartas**: Bronze (cobre), Prata (prata metálica), Ouro (dourado), Lendário (dourado com brilho), Imortal (dourado com partículas)
2. **Linhas de química**: conexões visuais entre jogadores no campo, coloridas por intensidade (verde = forte, amarelo = médio, vermelho = fraco)
3. **Medidor de momentum**: barra lateral pulsante que cresce com duelos vencidos

### Interaction Philosophy
Cada clique deve ter feedback imediato. Cartas têm hover com elevação 3D sutil. Seleções confirmadas com flash dourado. Timer de draft com tensão visual crescente (muda de cor conforme o tempo diminui).

### Animation
- **Entrada de cartas**: slide-in com escala de 0.95 → 1.0, 200ms ease-out
- **Seleção de carta**: flash dourado + escala 1.05 → 1.0, 150ms
- **Gol**: explosão de partículas douradas, texto animado
- **Duelo**: zoom-in nos dois jogadores com barra de progresso
- **Timer**: pulsa e fica vermelho nos últimos 5 segundos
- Respeitar `prefers-reduced-motion`

### Typography System
- **Display/Títulos**: `Bebas Neue` — condensado, impactante, esportivo
- **UI/Dados**: `Rajdhani` — técnico, limpo, legível em tamanhos pequenos
- **Corpo/Descrições**: `Inter` — legibilidade máxima para textos longos
- Hierarquia: 48px títulos → 24px seções → 16px dados → 12px labels

### Brand Essence
**UCL Immortals** — Para quem sempre quis responder: "Qual seria o time perfeito da história da Champions?" Diferente de qualquer outro: sem cadastro, sem grinding, pura decisão tática.
Personalidade: **Épico. Preciso. Histórico.**

### Brand Voice
Direto, dramático, reverente à história. Sem floreios corporativos.
- Exemplo headline: "Monta o time. Escreve a história."
- Exemplo CTA: "Entrar no Draft" (não "Começar a jogar")
- Proibido: "Bem-vindo ao nosso site", "Descubra mais"

### Wordmark & Logo
Escudo estilizado com estrela UCL dentro, linhas geométricas minimalistas, sem texto no ícone. Dourado sobre fundo escuro.

### Signature Brand Color
**Dourado UCL** `#C9A84C` — inconfundível, premium, histórico.
