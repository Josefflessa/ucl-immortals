# Redesign dos cards de jogador — estilo FUT (escudo) · UCL Immortals

## Contexto
Hoje o `PlayerCard` (client/src/components/game/PlayerCard.tsx) é um retângulo arredondado:
mesmo formato de borda pra todas as raridades (só muda cor/glow via `getCardTheme`), fundo em
gradiente CSS + padrão animado + shimmer. O usuário quer um card **estilo FUT**: silhueta de
**escudo**, **fundo por raridade** (5 PNGs que ele forneceu) e um visual mais rico, mantendo a
fluidez/performance que acabamos de conquistar.

O design foi validado ao vivo em mockups (Artifacts). Este documento fixa o que implementar.

## Objetivo
Reescrever o visual do `PlayerCard` para o formato de escudo FUT, **escalável e otimizado**,
funcionando bem em **todos os tamanhos e lugares** onde o card aparece, sem regressão de performance.

## Decisões visuais (aprovadas)
- **Silhueta:** escudo FUT (topo com entalhe central, ombros curvos, base em ponta). Contorno igual
  ao aprovado no mockup.
- **Layout FUT (disposição):**
  - Rail à esquerda, empilhado: **OVR** (grande) → **posição** → **bandeira** → **escudo do clube**.
  - **Foto** grande à direita/centro.
  - **Chip de raridade** logo abaixo da foto — **mesmo estilo de hoje** (pill com a gradiente
    `theme.ribbon`, texto tipo "OURO"/"LENDÁRIO", **sem emoji**).
  - **Nome** centralizado, forte, sobre uma faixa escura semi-transparente (legibilidade).
  - **6 stats** em linha (PAC SHO PAS DRI DEF PHY: rótulo em cima, valor embaixo) sobre um painel
    escuro semi-transparente.
- **Fundo (fill):** a textura da raridade preenche o **interior** do escudo (os 5 PNGs do usuário:
  bronze/prata/ouro/lendário/imortal).
- **Moldura/anel:** entre a borda externa e a textura há um **anel metálico** (gradiente com brilho
  diagonal — escuro → highlight → cor → escuro). Cor do anel:
  - Sem característica → **cor da raridade**.
  - Com característica → **cor da característica** (o anel é o principal indicador da característica).
- **Borda externa:** fina, dourada/metálica, seguindo o escudo. Tingida sutilmente por raridade.
- **Característica (variantes: Em Alta/Lobo/Coringa/Nômade/Pilar/Mártir/Ídolo/12º Homem):**
  - Anel metálico na cor da característica (acima).
  - **Chip** com ícone + nome — **mesmo estilo de hoje** (pill `linear-gradient(90deg,#0008,cor,#0008)`,
    glow da cor, texto branco com ícone; ex.: "🩸 Mártir"), posicionado abaixo dos stats.
  - **Glow externo pequeno e discreto** (drop-shadow ~6px) na cor da característica. **Sem animação/pulso.**
- **Glow padrão (sem característica):** discreto, na cor da raridade (drop-shadow, estático).

## Arquitetura técnica
Meta: **vetorial + escalável + leve**, sem depender de asset de terceiro.

1. **Escudo em SVG próprio (NÃO usar o card_bg.png do CodePen).** Motivos: sem asset/licença de
   terceiro (o card_bg.png tem "FUT 19" e é de outra pessoa); **escala nítida em qualquer tamanho**;
   mais leve (elimina 275 KB). Traçar um `<path>` de escudo que reproduza o contorno aprovado.
2. **Clip escalável:** um `<clipPath clipPathUnits="objectBoundingBox">` (coords 0–1) definido uma vez
   e referenciado por CSS `clip-path: url(#cardShield)`. Assim o mesmo clip serve pra qualquer tamanho
   de card (grande, médio, compacto) sem recalcular geometria.
3. **Camadas (de baixo pra cima), todas clipadas ao escudo:**
   - `ring` — gradiente metálico (cor via `--ring`), escudo cheio.
   - `fill` — textura da raridade (`background-size:cover`), clipada a um escudo **levemente menor**
     (inset) → o anel aparece na volta. Segundo clipPath (escudo a ~95%) ou `transform:scale` na
     camada de textura.
   - `scrim` — gradientes escuros no topo-esquerdo (atrás do rail) e na base (atrás de nome/stats)
     pra garantir legibilidade sobre texturas claras (bronze/prata/ouro) e escuras (lendário).
   - `content` — HTML do layout FUT.
   - `border` — `<path>` do escudo com `stroke` (gradiente metálico dourado, por raridade), largura
     fina, seguindo o contorno.
4. **Glow:** `filter: drop-shadow()` na cor de raridade/característica (estático, discreto). drop-shadow
   segue a silhueta clipada.
5. **Cor do texto:** creme/branco com sombra, legível sobre os painéis escuros (que existem justamente
   pra isso). Rail com text-shadow forte.

## Adaptação a tamanhos (requisito central)
O card aparece em **vários tamanhos/lugares**. Precisa ficar bem feito em todos:
- **Grande** (detalhe, modal de reforço, draft): layout completo (rail + foto + chip raridade + nome +
  6 stats + chip característica).
- **Compacto** (grades: loja turbinar/treino, listas de elenco, candidatos de troca): versão enxuta
  (OVR + foto + nome), como já existe hoje no modo `compact`.
- **Qualquer tamanho intermediário**: o SVG escala nativamente; medidas internas em unidades relativas
  ao tamanho do card (%, `clamp`, ou um multiplicador de escala derivado da largura) pra tudo
  reposicionar/reescalar proporcionalmente — nada fixo em px que "quebre" fora do tamanho base.
- Manter as props atuais `compact` e `lite`; o redesign respeita ambas.

## Performance (não pode pesar)
1. **Assets otimizados:** as 5 texturas hoje têm 200–620 KB (PNG). Reduzir para o tamanho de exibição
   (~2x do card grande, ex.: ~450×730) e converter pra **WebP** (alvo ~150–250 KB no total, ~10x menos).
   Se não houver ferramenta de imagem no ambiente, o fallback é: manter PNG, **lazy-load** + cache, e
   (opcional) pedir ao usuário versões WebP/menores. Preload dos assets no início pra evitar "flash".
2. **Caminho leve no `compact`/`lite`:** onde muitos cards aparecem juntos (grades/scroll), usar
   renderização enxuta — textura achatada num fundo simples, **sem** as 3 camadas mascaradas/anel/glow.
   O tratamento pesado (anel metálico + border SVG + glow) fica só no card grande.
3. **Sem animação** nos cards (remover shimmer/pulso). Card estático = barato de compor.
4. **Memoização:** manter `memo()` do PlayerCard; evitar recriar objetos de estilo por render
   (constantes/derivados memoizados).
5. **1 clipPath/gradiente compartilhado** (definidos uma vez no app), não por card.

## Mapeamento de raridade → asset/cores
- Texturas (client/public/cards/): `bg-bronze.png`, `bg-prata.png`, `bg-ouro.png`, `bg-lendário.png`,
  `bg-imortal.png` (a otimizar → WebP).
- Chip de raridade: reaproveitar `theme.ribbon`/`theme.label` do `getCardTheme` atual (sem emoji).
- Cor do anel/borda por raridade: derivar de `getCardTheme` (bronze #C77B3A, prata #B7BCCC,
  ouro #D4B25A, lendário #FF9E3C, imortal #FFE680).
- Cores das características: reutilizar as de `shop.ts` `TURBINAR_VARIANTS` (⚡ #39FF14, 🐺 #A855F7,
  🃏 #EF4444, 🌍 #3B82F6, 🧱 #FFFFFF, 🩸 #B91C1C, ❤️ #F59E0B, 🪑 #14B8A6).

## Fallbacks / robustez
- Textura ausente ou erro de load → cai no gradiente CSS atual de `getCardTheme` (nada quebra).
- Escudo do clube ausente → usa o fallback de iniciais (componente `<Crest>` já existe).
- Bandeira ausente → fallback atual (`getFlagUrl`).

## Arquivos afetados (previsto)
- `client/src/components/game/PlayerCard.tsx` — reescrita do visual (mantendo API/props/memo).
- `client/public/cards/*` — texturas (otimizadas) + eventualmente o SVG do escudo inline.
- Possível novo helper/componente pequeno pro escudo SVG (clip + border) reutilizável.
- Sem mudança de dados/engine.

## Verificação
- `tsc --noEmit` + `npm run build` limpos.
- Rodar o app e conferir o card em: detalhe (grande), grade da loja (compact), draft, reforço,
  campo/formação, relatório — em telas larga e mobile.
- Conferir cada raridade (5) e cada característica (8) visualmente; confirmar legibilidade do texto
  sobre todas as texturas.
- Medir que não há jank ao rolar grades com muitos cards (caminho leve ativo).
- Sem regressão nas fotos/bandeiras/escudos já verificados.

## Fora de escopo
- Mudanças de gameplay/atributos. Novos jogadores/escudos. Alterações no servidor.
