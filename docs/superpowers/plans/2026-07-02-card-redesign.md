# Card Redesign (FUT/escudo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o visual do `PlayerCard` para um card estilo FUT (silhueta de escudo vetorial), com textura por raridade, anel metálico (raridade/característica), layout FUT, escalável a qualquer tamanho e otimizado.

**Architecture:** Escudo desenhado em **SVG vetorial próprio** (path em coords 0–1 `objectBoundingBox`), usado como `clip-path` escalável para recortar as camadas (anel metálico → textura da raridade → scrim), com a **borda** desenhada por um `<path>` SVG (stroke com `vector-effect:non-scaling-stroke`) e o **glow** via `drop-shadow`. Conteúdo (rail/foto/nome/stats) em HTML posicionado em % por cima. Modo `compact`/`lite` usa caminho leve (textura achatada, sem anel/border-SVG/glow). Nenhuma animação.

**Tech Stack:** React + TypeScript, framer-motion (já usado; card fica estático), CSS mask/clip-path, SVG clipPath objectBoundingBox.

## Global Constraints
- Manter a API do componente: `PlayerCardProps { player, selected?, onClick?, compact?, lite?, showChemistry?, chemScore? }`. Sem quebrar chamadas existentes.
- Manter `memo()` no PlayerCard e evitar recriar objetos de estilo pesados por render.
- **Sem animação** nos cards (remover shimmer/VariantRing/pulse). Respeitar `prefers-reduced-motion` em qualquer transição residual.
- Reutilizar helpers atuais: `getCardTheme`, `getRarityColor`, `PlayerPhoto`, `getFlagUrl`, `CLUB_CRESTS`, `getCardVariant`, `variantDesc`, `SOFIFA_MAPPING`, `posLabel`.
- Texturas em `client/public/cards/`: `bg-bronze`, `bg-prata`, `bg-ouro`, `bg-lendário`, `bg-imortal` (PNG hoje; otimizar p/ WebP se houver ferramenta, senão PNG lazy+cache).
- Caminho pesado só no card grande; `compact`/`lite` = caminho leve.
- `cd client && npx tsc --noEmit` e `npm run build` (na raiz) limpos ao fim de cada task que toca código.
- Build roda da RAIZ (vite/@ alias). Grep de erros deve ignorar o hint pré-existente `simulateLeague`.

---

## File Structure
- **Create** `client/src/components/game/CardShield.tsx` — primitivas do escudo: constante do path 0–1, `<CardShieldDefs/>` (SVG `<clipPath>` montado uma vez), `<ShieldBorder/>` (stroke por raridade/variante), helper `ringGradient(color)` (gradiente metálico).
- **Modify** `client/src/App.tsx` — montar `<CardShieldDefs/>` uma vez (defs SVG global).
- **Modify** `client/src/components/game/PlayerCard.tsx` — reescrever os dois branches de render (full e compact) usando as primitivas; adicionar config `RARITY_VIS` e `cardTexture(rarity)`; remover shimmer/VariantRing/VariantDecor do fluxo (o indicador de variante passa a ser anel+chip).
- **Modify** `client/src/index.css` — remover keyframes agora não usados (`inform-spin`, `martir-pulse`, `idolo-halo`, `shimmer`) SE não referenciados em outro lugar; adicionar nada novo (sem animação).
- **Assets** `client/public/cards/*` — texturas otimizadas (ver Task 1).

---

## Task 1: Assets de textura + config de raridade

**Files:**
- Modify (assets): `client/public/cards/` (otimização in-place ou versões `.webp`)
- Modify: `client/src/components/game/PlayerCard.tsx` (adicionar `cardTexture`)

**Interfaces:**
- Produces: `function cardTexture(rarity: string): string` → URL pública da textura (ex.: `/cards/bg-ouro.webp`), com fallback pro `.png` existente.

- [ ] **Step 1: Otimizar texturas (best-effort).** Tentar, na ordem, uma ferramenta disponível:
  - `cwebp` (se existir): `for f in bronze prata ouro lendário imortal; do cwebp -q 82 -resize 460 0 "client/public/cards/bg-$f.png" -o "client/public/cards/bg-$f.webp"; done`
  - senão `npx --yes sharp-cli` redimensionar p/ largura 460 + webp;
  - **se nenhuma ferramenta funcionar:** manter os PNGs (não bloquear) e anotar no fim que a otimização ficou pendente (lazy-load + cache cobrem o custo).
  Verificar tamanho: `ls -la client/public/cards/`.

- [ ] **Step 2: Adicionar `cardTexture` no PlayerCard.tsx** (perto de `getCardTheme`):

```ts
// Texturas de fundo por raridade (public/cards). WebP quando existir; PNG como fallback.
const TEXTURE_BASE = '/cards/';
const RARITY_FILE: Record<string, string> = {
  immortal: 'bg-imortal', legendary: 'bg-lendário', gold: 'bg-ouro', silver: 'bg-prata', bronze: 'bg-bronze',
};
function cardTexture(rarity: string): string {
  const base = RARITY_FILE[rarity] ?? RARITY_FILE.bronze;
  return `${TEXTURE_BASE}${base}.png`; // troca p/ .webp no Step 1 se gerado
}
```

- [ ] **Step 3: Verificar build.** `cd client && npx tsc --noEmit 2>&1 | grep -v simulateLeague` → sem erros.

- [ ] **Step 4: Commit.**
```bash
git add client/public/cards client/src/components/game/PlayerCard.tsx
git commit -m "feat(card): texturas de raridade + helper cardTexture"
```

---

## Task 2: Primitivas do escudo (CardShield.tsx)

**Files:**
- Create: `client/src/components/game/CardShield.tsx`
- Modify: `client/src/App.tsx` (montar `<CardShieldDefs/>`)

**Interfaces:**
- Produces:
  - `export const SHIELD_D: string` — path do escudo em coords 0–1.
  - `export function CardShieldDefs(): JSX.Element` — `<svg>` oculto com `<clipPath id="uclCardShield" clipPathUnits="objectBoundingBox"><path d={SHIELD_D}/></clipPath>`.
  - `export function ShieldBorder({ stroke, width, innerStroke }: { stroke: string; width: number; innerStroke?: string }): JSX.Element` — SVG absoluto (viewBox `0 0 1 1`, `preserveAspectRatio="none"`) com o path do escudo em `fill:none; stroke; vector-effect:non-scaling-stroke`.
  - `export function ringGradient(color: string): string` — gradiente metálico CSS derivado de `color`.
- Consumes: nada.

- [ ] **Step 1: Criar `CardShield.tsx`:**

```tsx
// Escudo FUT vetorial próprio (sem asset de terceiro), escalável a qualquer tamanho.
// clipPath em objectBoundingBox (0–1) → serve p/ card de qualquer dimensão.
export const SHIELD_D =
  'M0.5 0.012 C0.40 0.012 0.30 0.045 0.12 0.045 C0.06 0.045 0.02 0.075 0.02 0.125 ' +
  'L0.02 0.60 C0.02 0.72 0.10 0.80 0.26 0.885 C0.38 0.945 0.455 0.965 0.5 1.0 ' +
  'C0.545 0.965 0.62 0.945 0.74 0.885 C0.90 0.80 0.98 0.72 0.98 0.60 L0.98 0.125 ' +
  'C0.98 0.075 0.94 0.045 0.88 0.045 C0.70 0.045 0.60 0.012 0.5 0.012 Z';

export function CardShieldDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <clipPath id="uclCardShield" clipPathUnits="objectBoundingBox">
          <path d={SHIELD_D} />
        </clipPath>
      </defs>
    </svg>
  );
}

export function ShieldBorder({ stroke, width, innerStroke }: { stroke: string; width: number; innerStroke?: string }) {
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
      <path d={SHIELD_D} fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {innerStroke && (
        <path d={SHIELD_D} fill="none" stroke={innerStroke} strokeWidth={Math.max(1, width - 2)} vectorEffect="non-scaling-stroke"
          transform="translate(0.5 0.5) scale(0.965) translate(-0.5 -0.5)" opacity="0.8" />
      )}
    </svg>
  );
}

// Metálico: escuro → highlight → cor → highlight → escuro (diagonal).
export function ringGradient(color: string): string {
  return `linear-gradient(135deg,` +
    `color-mix(in srgb,${color} 52%,#000) 0%,` +
    `color-mix(in srgb,${color} 92%,#fff) 40%,` +
    `${color} 56%,` +
    `color-mix(in srgb,${color} 78%,#fff) 70%,` +
    `color-mix(in srgb,${color} 48%,#000) 100%)`;
}
```

- [ ] **Step 2: Montar defs uma vez no App.** Em `client/src/App.tsx`, importar e renderizar `<CardShieldDefs/>` dentro do provider (uma vez), ex. logo após abrir o container raiz do `GameRouter`.

```tsx
import { CardShieldDefs } from "./components/game/CardShield";
// ...dentro do JSX raiz, uma única vez:
<CardShieldDefs />
```

- [ ] **Step 3: Verificar build.** `cd client && npx tsc --noEmit 2>&1 | grep -v simulateLeague` → sem erros; `npm run build` (raiz) OK.

- [ ] **Step 4: Commit.**
```bash
git add client/src/components/game/CardShield.tsx client/src/App.tsx
git commit -m "feat(card): primitivas do escudo SVG (clip + borda + anel metálico)"
```

---

## Task 3: Config visual por raridade + variante (RARITY_VIS)

**Files:**
- Modify: `client/src/components/game/PlayerCard.tsx`

**Interfaces:**
- Produces: `const RARITY_VIS: Record<string,{ring:string;border:string;innerBorder?:string;glow:string}>` e helper `rarityVis(rarity)`.
- Consumes: `getCardVariant` (já existe) para cor da variante.

- [ ] **Step 1: Adicionar config** (cores derivadas de `getCardTheme`; anel/borda/glow):

```ts
const RARITY_VIS: Record<string, { ring: string; border: string; innerBorder?: string; glow: string }> = {
  bronze:    { ring: '#C77B3A', border: '#C77B3A', glow: 'rgba(205,127,50,.42)' },
  silver:    { ring: '#B7BCCC', border: '#B7BCCC', glow: 'rgba(183,188,204,.38)' },
  gold:      { ring: '#D4B25A', border: '#E0C268', glow: 'rgba(201,168,76,.45)' },
  legendary: { ring: '#FF9E3C', border: '#FFB152', innerBorder: '#7a3d02', glow: 'rgba(255,150,40,.5)' },
  immortal:  { ring: '#FFE680', border: '#FFF0B0', innerBorder: '#FFFFFF', glow: 'rgba(255,215,0,.55)' },
};
const rarityVis = (r: string) => RARITY_VIS[r] ?? RARITY_VIS.bronze;
```

- [ ] **Step 2: tsc.** `cd client && npx tsc --noEmit 2>&1 | grep -v simulateLeague` → sem erros (config ainda não usada; OK).

- [ ] **Step 3: Commit.**
```bash
git add client/src/components/game/PlayerCard.tsx
git commit -m "feat(card): config visual por raridade (anel/borda/glow)"
```

---

## Task 4: Card GRANDE (layout FUT + escudo + anel + textura)

**Files:**
- Modify: `client/src/components/game/PlayerCard.tsx` (branch full, ~linhas 805–fim do return full)

**Interfaces:**
- Consumes: `CardShieldDefs` (via App), `ShieldBorder`, `ringGradient`, `cardTexture`, `rarityVis`, `getCardTheme`, `getCardVariant`, `PlayerPhoto`, `getFlagUrl`, `CLUB_CRESTS`, `posLabel`.

- [ ] **Step 1: Importar primitivas** no topo do PlayerCard.tsx:
```ts
import { ShieldBorder, ringGradient } from './CardShield';
```

- [ ] **Step 2: Reescrever o branch full.** Substituir todo o JSX do card grande (do `const CardWrapper = ...` até o fechamento do return full) por uma estrutura em camadas. `ringColor`/`glowColor` vêm da variante se houver, senão da raridade:

```tsx
const CardWrapper = lite ? 'div' : motion.div;
const cardMotionProps = lite ? {} : { whileHover: { scale: 1.03, y: -4 }, whileTap: onClick ? { scale: 0.97 } : {} };
const vis = rarityVis(player.rarity);
const ringColor = variant ? variant.color : vis.ring;
const glowColor = selected ? 'rgba(255,255,255,.75)' : (variant ? variant.color : vis.glow);
const CLIP = { clipPath: 'url(#uclCardShield)', WebkitClipPath: 'url(#uclCardShield)' } as const;
const INSET = { transform: 'scale(0.93)', transformOrigin: 'center' } as const;

return (
  <CardWrapper {...cardMotionProps} onClick={onClick}
    className={`relative select-none flex ${onClick ? 'cursor-pointer' : ''}`}
    style={{ width: 200, height: 300, filter: `drop-shadow(0 0 10px ${glowColor}) drop-shadow(0 8px 14px rgba(0,0,0,.5))` }}>
    {/* anel metálico (raridade/variante) — escudo cheio */}
    <div className="absolute inset-0" style={{ ...CLIP, background: ringGradient(ringColor) }} />
    {/* textura da raridade — escudo levemente menor (revela o anel) */}
    <div className="absolute inset-0" style={{ ...CLIP, ...INSET, backgroundImage: `url(${cardTexture(player.rarity)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
    {/* fallback de fundo se a textura falhar: gradiente do tema por baixo */}
    {/* scrims p/ legibilidade */}
    <div className="absolute inset-0" style={{ ...CLIP, ...INSET, background:
      'linear-gradient(180deg,rgba(0,0,0,.40) 0%,rgba(0,0,0,0) 24%),linear-gradient(0deg,rgba(0,0,0,.60) 0%,rgba(0,0,0,0) 34%),radial-gradient(58% 38% at 17% 25%,rgba(0,0,0,.38),transparent 70%)' }} />

    {/* CONTEÚDO (FUT) */}
    <div className="absolute inset-0" style={{ color: '#f7eeca', ...CLIP }}>
      {/* rail */}
      <div className="absolute flex flex-col items-center" style={{ left: '6%', top: '15%', width: 46, gap: 4, textShadow: '0 2px 5px rgba(0,0,0,.85)' }}>
        <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontSize: 40, lineHeight: .8 }}>{player.overall}</span>
        <span style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '.04em' }}>{posLabel(player.position)}</span>
        <div style={{ width: 30, height: 1, background: 'rgba(247,238,202,.55)', margin: '3px 0' }} />
        {getFlagUrl(player.nation) && <img src={getFlagUrl(player.nation)!} alt={player.nation} style={{ width: 22, height: 15, objectFit: 'cover', borderRadius: 2, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }} />}
        {CLUB_CRESTS[player.club] && <img src={CLUB_CRESTS[player.club]} alt={player.club} referrerPolicy="no-referrer" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
      </div>
      {/* foto */}
      <div className="absolute flex items-end justify-center" style={{ right: '9%', top: '8%', width: '58%', height: '44%' }}>
        {hasPhoto ? <PlayerPhoto playerId={player.id} fullName={player.fullName} size={150} lowRes={lite} /> : <span style={{ fontSize: 40, opacity: .2 }}>⚽</span>}
      </div>
      {/* chip de raridade — igual ao de hoje (theme.ribbon + label, sem emoji) */}
      <div className="absolute" style={{ top: '52%', left: '50%', transform: 'translateX(-50%)', padding: '2px 11px', borderRadius: 999, fontSize: 8, fontWeight: 900, letterSpacing: '.16em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#0a0a0a', background: theme.ribbon, border: '1px solid rgba(0,0,0,.35)', boxShadow: '0 2px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25)' }}>{theme.label}</div>
      {/* nome */}
      <div className="absolute text-center" style={{ top: '56.5%', left: '13%', right: '13%', background: 'linear-gradient(90deg,rgba(0,0,0,.12),rgba(0,0,0,.58) 50%,rgba(0,0,0,.12))', borderRadius: 8, padding: '3px 0 5px', borderBottom: '2px solid rgba(255,255,255,.14)' }}>
        <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontWeight: 900, letterSpacing: '.03em', fontSize: 20, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,.8)' }}>{player.shortName.toUpperCase()}</span>
      </div>
      {/* 6 stats */}
      <div className="absolute" style={{ top: '68%', left: '12%', right: '12%', background: 'rgba(0,0,0,.4)', borderRadius: 10, padding: '6px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', fontVariantNumeric: 'tabular-nums' }}>
          {([['PAC', player.pace],['SHO', player.shooting],['PAS', player.passing],['DRI', player.dribbling],['DEF', player.defending],['PHY', player.physical]] as const).map(([k, v]) => (
            <div key={k} className="flex flex-col items-center" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
              <span style={{ fontSize: 8, fontWeight: 800, opacity: .78 }}>{k}</span>
              <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontWeight: 900, fontSize: 17 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {/* chip de característica — igual ao de hoje (pill colorido, ícone + label), sem animação */}
      {variant && (
        <div className="absolute inline-flex items-center" style={{ top: '81.5%', left: '50%', transform: 'translateX(-50%)', gap: 6, padding: '4px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 900, letterSpacing: '.12em', whiteSpace: 'nowrap', color: '#fff', background: `linear-gradient(90deg,#0008,${variant.color},#0008)`, border: '1px solid rgba(0,0,0,.45)', boxShadow: `0 0 12px color-mix(in srgb,${variant.color} 70%,transparent)`, textShadow: '0 1px 2px rgba(0,0,0,.9)' }} title={variantDesc(player)}>
          <span>{variant.icon}</span> {variant.label}
        </div>
      )}
    </div>

    {/* borda do escudo (por cima de tudo) */}
    <ShieldBorder stroke={vis.border} width={player.rarity === 'immortal' ? 4 : player.rarity === 'legendary' ? 3.2 : 2.4} innerStroke={selected ? '#fff' : vis.innerBorder} />
  </CardWrapper>
);
```

- [ ] **Step 3: tsc + build.** `cd client && npx tsc --noEmit 2>&1 | grep -v simulateLeague` sem erros; `npm run build` (raiz) OK.

- [ ] **Step 4: Verificação visual (REQUIRED).** Usar a skill `run` p/ abrir o app; ir a uma tela com card grande (ex.: draft/detalhe) e conferir: escudo com contorno certo, textura por raridade, anel metálico, borda, chip de raridade (sem emoji) e nome/stats legíveis. Conferir uma carta com variante (anel colorido + chip). Screenshot.

- [ ] **Step 5: Commit.**
```bash
git add client/src/components/game/PlayerCard.tsx
git commit -m "feat(card): card grande estilo FUT (escudo + textura + anel + layout)"
```

---

## Task 5: Card COMPACT/LITE (caminho leve)

**Files:**
- Modify: `client/src/components/game/PlayerCard.tsx` (branch compact, ~linhas 733–803)

**Interfaces:**
- Consumes: `cardTexture`, `rarityVis`, `getCardVariant`, `PlayerPhoto`, `posLabel`. **Não** usa `ShieldBorder`/anel/scrims pesados (perf).

- [ ] **Step 1: Reescrever o branch compact** com escudo (clip) + textura achatada + OVR/foto/nome, borda simples (1px stroke SVG leve OU box via clip + 1 camada de cor). Sem `motion` quando `lite`:

```tsx
if (compact) {
  const CompactWrapper = lite ? 'div' : motion.div;
  const compactMotion = lite ? {} : { whileHover: onClick ? { scale: 1.06, y: -3 } : {}, whileTap: onClick ? { scale: 0.97 } : {} };
  const vis = rarityVis(player.rarity);
  const ringColor = variant ? variant.color : vis.ring;
  const CLIP = { clipPath: 'url(#uclCardShield)', WebkitClipPath: 'url(#uclCardShield)' } as const;
  return (
    <CompactWrapper {...compactMotion} onClick={onClick}
      className={`relative select-none flex flex-col ${onClick ? 'cursor-pointer' : ''}`}
      style={{ width: 80, height: 120, filter: selected ? 'drop-shadow(0 0 8px rgba(255,255,255,.7))' : `drop-shadow(0 0 5px ${ringColor}66)` }}>
      {/* anel (cor) atrás */}
      <div className="absolute inset-0" style={{ ...CLIP, background: ringColor }} />
      {/* textura achatada (uma camada só) */}
      <div className="absolute inset-0" style={{ ...CLIP, transform: 'scale(0.92)', transformOrigin: 'center', backgroundImage: `url(${cardTexture(player.rarity)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0" style={{ ...CLIP, transform: 'scale(0.92)', transformOrigin: 'center', background: 'linear-gradient(0deg,rgba(0,0,0,.6),transparent 45%)' }} />
      <div className="absolute inset-0 flex flex-col" style={{ ...CLIP, color: '#f7eeca' }}>
        <div className="flex items-start justify-between px-1.5 pt-1.5">
          <div className="flex flex-col leading-none" style={{ textShadow: '0 1px 3px #000' }}>
            <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontSize: 17, lineHeight: 1, color: '#fff' }}>{player.overall}</span>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 800 }}>{posLabel(player.position)}</span>
          </div>
          {variant && <span style={{ fontSize: 9, textShadow: `0 0 6px ${variant.color}` }}>{variant.icon}</span>}
        </div>
        <div className="flex-1 flex items-end justify-center overflow-hidden mx-1" style={{ minHeight: 0 }}>
          {hasPhoto ? <PlayerPhoto playerId={player.id} fullName={player.fullName} size={50} lowRes /> : <span style={{ fontSize: 22, opacity: .2 }}>⚽</span>}
        </div>
        <div className="text-center truncate px-1 pb-2" style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px #000' }}>{player.shortName.toUpperCase()}</div>
      </div>
    </CompactWrapper>
  );
}
```

- [ ] **Step 2: tsc + build.** sem erros.

- [ ] **Step 3: Verificação visual (REQUIRED).** Via skill `run`: abrir a LOJA (grade Turbinar/Treino) e/ou lista de troca do elenco — muitos cards compactos. Conferir escudo pequeno legível e **scroll sem travar**. Screenshot.

- [ ] **Step 4: Commit.**
```bash
git add client/src/components/game/PlayerCard.tsx
git commit -m "feat(card): card compact/lite leve com escudo"
```

---

## Task 6: Limpeza de animações + perf + fallback de textura

**Files:**
- Modify: `client/src/components/game/PlayerCard.tsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Remover código morto** do PlayerCard: `VariantRing`, `VariantDecor`, `variantGlow`, `variantAura`, e as `<style>` de `shimmer` — se não usados mais. Confirmar com grep que não há outra referência antes de apagar cada um.
  Run: `grep -rn "VariantDecor\|VariantRing\|variantGlow\|inform-spin" client/src` → só definições a remover.

- [ ] **Step 2: Fallback de textura.** Garantir que, se a textura não carregar, o fundo não fica vazio: colocar o gradiente do tema (`theme.bg`) como `background` da camada raiz do card (atrás do anel), tanto no full quanto no compact. Ex.: no wrapper `style` adicionar `background: theme.bg` (fica escondido pela textura quando ela carrega; aparece se falhar).

- [ ] **Step 3: Preload das texturas.** Em `App.tsx` (ou no PlayerCard, uma vez via módulo), pré-carregar as 5 texturas:
```ts
// módulo-nível, roda uma vez
['bg-bronze','bg-prata','bg-ouro','bg-lendário','bg-imortal'].forEach(n => { const i = new Image(); i.src = `/cards/${n}.png`; });
```
Colocar num `useEffect` de montagem do App (guardar em ref p/ não repetir).

- [ ] **Step 4: Remover keyframes órfãos do index.css** (`@keyframes shimmer`, `inform-spin`, `martir-pulse`, `idolo-halo`) SE `grep -rn "martir-pulse\|idolo-halo\|inform-spin\|shimmer" client/src` não achar uso.

- [ ] **Step 5: tsc + build.** sem erros; conferir tamanho do bundle não cresceu de forma anormal.

- [ ] **Step 6: Commit.**
```bash
git add client/src/components/game/PlayerCard.tsx client/src/index.css client/src/App.tsx
git commit -m "perf(card): remove animações órfãs, fallback de textura, preload"
```

---

## Task 7: Verificação end-to-end (todos os tamanhos e lugares)

**Files:** nenhuma mudança (só verificação; corrigir inline se achar problema).

- [ ] **Step 1: tsc + build limpos.** `cd client && npx tsc --noEmit 2>&1 | grep -v simulateLeague`; `npm run build` (raiz).
- [ ] **Step 2: Rodar o app (skill `run`) e conferir o card em CADA lugar:**
  - Draft (grande), modal de reforço (grande, `lite`), detalhe do jogador.
  - Loja: grades Turbinar/Treino (compact).
  - MEU TIME / troca de jogador (compact, agrupado Titular/Reserva).
  - Campo/formação (se usa card), Relatório (fim de temporada).
  - Telas larga (desktop) e estreita (mobile ~380px).
- [ ] **Step 3: Conferir as 5 raridades e as 8 características** (uma carta de cada, via draft/turbinar de teste ou inspeção): textura certa, anel/borda coerentes, chips iguais aos de hoje, legibilidade do texto sobre toda textura.
- [ ] **Step 4: Perf:** rolar a grade da loja com muitos cards — sem jank perceptível.
- [ ] **Step 5: Regressão:** fotos/bandeiras/escudos de clube continuam certos; nada quebrou nas telas.
- [ ] **Step 6: Commit final (se houve ajustes).**
```bash
git add -A && git commit -m "test(card): verificação visual do redesign em todos os tamanhos"
```

---

## Self-Review (cobertura da spec)
- Escudo vetorial próprio (sem card_bg de terceiro) → Task 2. ✓
- Textura por raridade + fallback → Task 1, Task 6 Step 2. ✓
- Anel metálico (raridade/característica) → Task 2 (`ringGradient`) + Task 4/5. ✓
- Borda por raridade → Task 3 (`RARITY_VIS`) + Task 2 (`ShieldBorder`) + Task 4. ✓
- Layout FUT (rail/foto/chip raridade/nome/6 stats) → Task 4. ✓
- Chip de raridade igual ao de hoje (sem emoji) → Task 4 Step 2 (usa `theme.ribbon`/`theme.label`). ✓
- Chip de característica igual ao de hoje + glow discreto + sem animação → Task 4 Step 2 + Task 6. ✓
- Adaptação a todos os tamanhos → clip objectBoundingBox escalável (Task 2) + % no conteúdo (Task 4) + compact leve (Task 5) + verificação (Task 7). ✓
- Otimização (assets, lite path, sem animação, memo, preload) → Task 1, 5, 6. ✓
- Fallbacks (textura/escudo/bandeira) → Task 6 + reuso de helpers. ✓
- tsc/build/visual → todas as tasks + Task 7. ✓

Sem placeholders de código nas etapas de implementação; nomes/tipos consistentes (`SHIELD_D`, `CardShieldDefs`, `ShieldBorder`, `ringGradient`, `cardTexture`, `rarityVis`, `RARITY_VIS`).
