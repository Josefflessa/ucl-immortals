# Estádio do time — Fase 1 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a vantagem de jogar em casa visível e tangível como um buff "+4 em todos os atributos", com um card de Estádio no MEU TIME, "onde o jogo aconteceu" no placar da partida, e um técnico+estádio ricos no fim de campanha.

**Architecture:** Uma constante do motor (`HOME_ADVANTAGE=3` → `HOME_ATTR_BONUS=4`) — matematicamente +4 na força equivale a +4 em todos os atributos (a força é a média dos overalls efetivos). Um modelo `Stadium` estático (`DEFAULT_STADIUM`). Dois componentes de display reutilizáveis: `CoachCard` (extraído do inline da `SquadEditor`) e `StadiumCard` (`variant: full | venue`), usados em 3 telas.

**Tech Stack:** React + TypeScript (Vite), TailwindCSS (classes utilitárias + estilos inline), framer-motion, Vitest (ambiente `node`, só engine puro — sem testes de componente React).

## Global Constraints

- **NÃO COMMITAR.** O usuário faz todos os commits manualmente. Nenhum passo roda `git commit`/`git add`. Cada task termina num **Checkpoint** (typecheck/build/test), não num commit.
- **Build a partir da raiz do repo:** `npm run build` roda na raiz (o `@` alias resolve daí). Typecheck: `cd client && npx tsc --noEmit`.
- **Testes do motor:** `cd client && npx vitest run <arquivo>` (ambiente node). Sem jsdom/testing-library — telas se verificam por `tsc` + build + manual.
- **pt-br** em todo texto voltado ao jogador.
- **Buff padrão = +4 em todos os atributos em casa** (não vale na final/campo neutro).
- **Asset já existe:** `client/public/stadiums/default.webp` (foto do estádio padrão, já otimizada).

---

## File Structure

- `client/src/lib/stadium.ts` **(criar)** — modelo `Stadium` + `DEFAULT_STADIUM`. Responsável só pelo dado do estádio.
- `client/src/lib/stadium.test.ts` **(criar)** — pin do `DEFAULT_STADIUM`.
- `client/src/lib/gameEngine.ts` **(modificar)** — `HOME_ADVANTAGE` → `HOME_ATTR_BONUS = 4` (linha ~897) e sua aplicação (linha ~1257).
- `client/src/lib/engine-units.test.ts` **(modificar)** — pin de `HOME_ATTR_BONUS`.
- `client/src/components/game/CoachCard.tsx` **(criar)** — card do técnico (extração do inline da `SquadEditor`).
- `client/src/components/game/StadiumCard.tsx` **(criar)** — card do estádio (`full` | `venue`).
- `client/src/components/game/SquadEditor.tsx` **(modificar)** — usar `CoachCard` + inserir `StadiumCard`.
- `client/src/pages/MatchSimPage.tsx` **(modificar)** — "onde o jogo aconteceu" no placar.
- `client/src/pages/ReportPage.tsx` **(modificar)** — técnico como card + estádio + contagem de conexões na química.

---

## Task 1: Motor — vantagem de casa como +4 em todos os atributos

**Files:**
- Modify: `client/src/lib/gameEngine.ts:897` e `client/src/lib/gameEngine.ts:1255-1257`
- Test: `client/src/lib/engine-units.test.ts`

**Interfaces:**
- Produces: `export const HOME_ATTR_BONUS: number` (= 4). Remove `HOME_ADVANTAGE`.

- [ ] **Step 1: Confirmar que `HOME_ADVANTAGE` só é usado nesses 2 lugares**

Run: `cd client && grep -rn "HOME_ADVANTAGE" src/`
Expected: exatamente 2 ocorrências, ambas em `src/lib/gameEngine.ts` (linhas ~897 e ~1257). Se aparecer em teste/outro arquivo, atualizar lá também.

- [ ] **Step 2: Escrever o teste (pin do valor)**

Em `client/src/lib/engine-units.test.ts`, adicionar `HOME_ATTR_BONUS` ao import existente vindo de `./gameEngine` (linha ~12, junto de `MAGNATA_POINT_MULT`), e adicionar o teste:

```ts
it('a vantagem de jogar em casa é +4 em todos os atributos (HOME_ATTR_BONUS)', () => {
  expect(HOME_ATTR_BONUS).toBe(4);
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `cd client && npx vitest run src/lib/engine-units.test.ts`
Expected: FALHA na compilação/execução — `HOME_ATTR_BONUS` não existe ainda.

- [ ] **Step 4: Renomear a constante (linha ~897)**

Trocar:
```ts
export const HOME_ADVANTAGE = 3;
```
por:
```ts
// Vantagem de casa: +4 em TODOS os atributos do mandante. Como a força do time é a média dos
// overalls efetivos, +4 em todo atributo desloca o overall (logo a força) em +4 — por isso é
// aplicado como +4 direto na força. Neutro na final (campo neutro). Ver StadiumCard/DEFAULT_STADIUM.
export const HOME_ATTR_BONUS = 4;
```

- [ ] **Step 5: Atualizar a aplicação (linha ~1255-1257)**

Trocar:
```ts
    const homeStrength = homeBaseStrength - homeExtraPenalty +
      (fergusonActive(home, homeGoals, awayGoals) ? 10 : 0) +
      (isFinal ? 0 : HOME_ADVANTAGE); // neutral venue for the final → no host edge
```
por:
```ts
    const homeStrength = homeBaseStrength - homeExtraPenalty +
      (fergusonActive(home, homeGoals, awayGoals) ? 10 : 0) +
      (isFinal ? 0 : HOME_ATTR_BONUS); // +4 em tudo em casa · neutral venue for the final → no host edge
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `cd client && npx vitest run src/lib/engine-units.test.ts`
Expected: PASS.

- [ ] **Step 7: Checkpoint de balanço (regressão da vantagem de casa)**

Run: `cd client && npx vitest run src/lib/balance.test.ts -t "vantagem de jogar em casa"`
Expected: PASS — `reg.homeWin > reg.awayWin + 0.03`, `reg.homeWin < 0.55`, e a final continua equilibrada. (+4 ≈ o +3 anterior; se estourar a banda, é sinal pra discutir com o usuário, não pra mexer no valor sem avisar.)

---

## Task 2: Modelo `Stadium` + `DEFAULT_STADIUM`

**Files:**
- Create: `client/src/lib/stadium.ts`
- Test: `client/src/lib/stadium.test.ts`

**Interfaces:**
- Produces: `interface Stadium { id: string; name: string; photoUrl: string; homeAttrBonus: number }` e `const DEFAULT_STADIUM: Stadium`.

- [ ] **Step 1: Escrever o teste**

Criar `client/src/lib/stadium.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_STADIUM } from './stadium';

describe('stadium', () => {
  it('estádio padrão dá +4 em todos os atributos e aponta pro asset webp', () => {
    expect(DEFAULT_STADIUM.homeAttrBonus).toBe(4);
    expect(DEFAULT_STADIUM.photoUrl).toBe('/stadiums/default.webp');
    expect(DEFAULT_STADIUM.name).toBe('Estádio Municipal');
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd client && npx vitest run src/lib/stadium.test.ts`
Expected: FALHA — `./stadium` não existe.

- [ ] **Step 3: Criar o modelo**

Criar `client/src/lib/stadium.ts`:

```ts
// UCL Immortals — modelo de estádio.
// Fase 1: só existe o estádio padrão. Ele torna tangível a vantagem de casa (+N em todos os
// atributos quando você é o mandante). Fase 2 (Técnico Prime) introduz estádios temáticos.
export interface Stadium {
  id: string;
  name: string;
  photoUrl: string;
  homeAttrBonus: number; // +N em TODOS os atributos, em casa
}

export const DEFAULT_STADIUM: Stadium = {
  id: 'default',
  name: 'Estádio Municipal',
  photoUrl: '/stadiums/default.webp',
  homeAttrBonus: 4,
};
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd client && npx vitest run src/lib/stadium.test.ts`
Expected: PASS.

---

## Task 3: `CoachCard` (extração, refactor sem mudança visual)

**Files:**
- Create: `client/src/components/game/CoachCard.tsx`
- Modify: `client/src/components/game/SquadEditor.tsx:8-15` (imports) e `:155-193` (bloco inline do técnico)

**Interfaces:**
- Consumes: `Coach`, `Formation` (de `../../lib/gameData`), `PREFERRED_FORMATION_CHEM_BONUS` (de `../../lib/gameEngine`).
- Produces: `export default function CoachCard({ coach, formation }: { coach: Coach; formation?: Formation })`.

- [ ] **Step 1: Criar o componente (markup idêntico ao inline atual)**

Criar `client/src/components/game/CoachCard.tsx`:

```tsx
import { Coach, Formation } from '../../lib/gameData';
import { PREFERRED_FORMATION_CHEM_BONUS } from '../../lib/gameEngine';

interface CoachCardProps {
  coach: Coach;
  formation?: Formation;
}

// Card do técnico — extraído do inline da SquadEditor pra ser reusado (MEU TIME + fim de campanha).
export default function CoachCard({ coach, formation }: CoachCardProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
        <span className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🎓 TÉCNICO</span>
        <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>COMANDO DO TIME</span>
      </div>
      <div className="p-4 flex gap-3.5">
        {coach.photoUrl && (
          <img src={coach.photoUrl} alt={coach.name} referrerPolicy="no-referrer" className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
            style={{ border: '2px solid #C9A84C55', objectPosition: 'center top' }} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{coach.name}</div>
          <div className="text-[11px] font-bold mt-0.5" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>{coach.philosophy}</div>
          <div className="text-[11px] mt-1 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{coach.description}</div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2">
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #1A1A2A' }}>
          <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>⚡ EFEITO NO ELENCO</div>
          <div className="text-[11px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{coach.effect}</div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #2A2A4A' }}>
          <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: '#A78BFA', fontFamily: 'Rajdhani, sans-serif' }}>✨ HABILIDADE: {coach.specialAbilityName?.toUpperCase()}</div>
          <div className="text-[11px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{coach.specialAbility}</div>
        </div>
        {coach.preferredFormation && (
          <div className="flex items-center gap-2 text-[10px] pt-0.5 flex-wrap" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            <span style={{ color: '#6A6A7A' }}>Formação preferida:</span>
            <span className="px-2 py-0.5 rounded font-black" style={{ background: '#C9A84C22', color: '#E8C84A', border: '1px solid #C9A84C44' }}>{coach.preferredFormation}</span>
            {formation?.id === coach.preferredFormation
              ? <span className="font-bold inline-flex items-center gap-1" style={{ color: '#22C55E' }}>✓ em uso · <span style={{ color: '#22C55E' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</span></span>
              : <span style={{ color: '#8A8A9A' }}>jogue nela pra <b style={{ color: '#22C55E' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</b> do time</span>}
          </div>
        )}
      </div>
    </div>
  );
}
```

(Única diferença em relação ao inline: `referrerPolicy="no-referrer"` na `<img>` — melhora o carregamento das fotos Wikimedia, sem mudança visual, igual já é feito na `MatchFieldView`.)

- [ ] **Step 2: Importar `CoachCard` na `SquadEditor`**

Em `client/src/components/game/SquadEditor.tsx`, adicionar após a linha 15 (`import FormationField, ...`):

```tsx
import CoachCard from './CoachCard';
```

- [ ] **Step 3: Substituir o bloco inline do técnico**

Trocar o bloco inteiro das linhas 155-193 (de `{/* ── Coach / manager card ── */}` até o `)}` que fecha `{showCoachCard && coach && (...)}`) por:

```tsx
      {/* ── Coach / manager card ── */}
      {showCoachCard && coach && <CoachCard coach={coach} formation={formation} />}
```

- [ ] **Step 4: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: sem erros. (`PREFERRED_FORMATION_CHEM_BONUS` continua sendo usado na `SquadEditor` no resumo de química — linha ~122 — então o import da linha 11 permanece necessário; não remover.)

- [ ] **Step 5: Checkpoint visual**

Run: `npm run build` (na raiz)
Expected: build OK. Manual: no MEU TIME (solo e online), o card do técnico está **idêntico** ao de antes.

---

## Task 4: `StadiumCard` + inserir no MEU TIME

**Files:**
- Create: `client/src/components/game/StadiumCard.tsx`
- Modify: `client/src/components/game/SquadEditor.tsx` (import + render abaixo do `CoachCard`)

**Interfaces:**
- Consumes: `Stadium`, `DEFAULT_STADIUM` (de `../../lib/stadium`).
- Produces: `export default function StadiumCard({ stadium, variant }: { stadium?: Stadium; variant?: 'full' | 'venue' })`.

- [ ] **Step 1: Criar o componente**

Criar `client/src/components/game/StadiumCard.tsx`:

```tsx
import { useState } from 'react';
import { Stadium, DEFAULT_STADIUM } from '../../lib/stadium';

interface StadiumCardProps {
  stadium?: Stadium;
  variant?: 'full' | 'venue';
}

// Card do estádio. 'full' = card completo (MEU TIME / fim de campanha) com destaque do buff de casa.
// 'venue' = linha enxuta "onde o jogo aconteceu" (header do placar da partida).
export default function StadiumCard({ stadium = DEFAULT_STADIUM, variant = 'full' }: StadiumCardProps) {
  const [imgOk, setImgOk] = useState(true);

  if (variant === 'venue') {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#8A8A9A' }}>
        <span>🏟️</span>
        <span style={{ color: '#C9C9D5' }}>{stadium.name}</span>
        <span style={{ color: '#6A6A7A' }}>· onde o jogo aconteceu</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
        <span className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🏟️ ESTÁDIO</span>
        <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>SUA CASA</span>
      </div>
      {/* Foto (com fallback gracioso) */}
      <div className="relative w-full" style={{ aspectRatio: '16 / 7', background: 'linear-gradient(135deg, #12203a 0%, #0A0A12 100%)' }}>
        {imgOk ? (
          <img src={stadium.photoUrl} alt={stadium.name} onError={() => setImgOk(false)}
            className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-60">🏟️</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: 'linear-gradient(to top, #0F0F1Aee, transparent)' }} />
        <div className="absolute left-3 bottom-2">
          <div className="text-base font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF', letterSpacing: '0.03em' }}>{stadium.name}</div>
        </div>
      </div>
      {/* Destaque do buff */}
      <div className="px-4 py-3">
        <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: '#0A2A14', border: '1px solid #16A34A44' }}>
          <span className="text-lg flex-shrink-0">🏠</span>
          <div className="min-w-0">
            <div className="text-[11px] font-black leading-tight" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
              Em casa: +{stadium.homeAttrBonus} em TODOS os atributos
            </div>
            <div className="text-[10px] leading-snug mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              Vale só quando você é o mandante · não vale na final (campo neutro).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Importar `StadiumCard` na `SquadEditor`**

Em `client/src/components/game/SquadEditor.tsx`, após o `import CoachCard from './CoachCard';` (adicionado na Task 3):

```tsx
import StadiumCard from './StadiumCard';
```

- [ ] **Step 3: Renderizar abaixo do `CoachCard`**

Trocar a linha adicionada na Task 3:
```tsx
      {showCoachCard && coach && <CoachCard coach={coach} formation={formation} />}
```
por:
```tsx
      {showCoachCard && coach && (
        <>
          <CoachCard coach={coach} formation={formation} />
          <StadiumCard />
        </>
      )}
```

(O container externo é `<motion.div className="space-y-4">`; como Fragment não cria nó DOM, os dois cards viram irmãos diretos e herdam o espaçamento `space-y-4`.)

- [ ] **Step 4: Typecheck + build**

Run: `cd client && npx tsc --noEmit` e depois `npm run build` (na raiz)
Expected: sem erros; build OK.

- [ ] **Step 5: Checkpoint visual**

Manual: MEU TIME (solo e online) mostra o card do Estádio logo **abaixo** do técnico, com a foto do `default.webp` e "Em casa: +4 em TODOS os atributos". Renomeie temporariamente o arquivo `client/public/stadiums/default.webp` e recarregue pra confirmar o **fallback 🏟️** (depois restaure o nome).

---

## Task 5: "Onde o jogo aconteceu" no placar da partida

**Files:**
- Modify: `client/src/pages/MatchSimPage.tsx` (import + inserir abaixo do scoreboard, ~linha 1126)

**Interfaces:**
- Consumes: `StadiumCard` (`../components/game/StadiumCard`); `isFinal` (já existe: `client/src/pages/MatchSimPage.tsx:71`).

- [ ] **Step 1: Importar `StadiumCard`**

Em `client/src/pages/MatchSimPage.tsx`, após a linha 24 (`import MatchFieldView from '../components/game/MatchFieldView';`):

```tsx
import StadiumCard from '../components/game/StadiumCard';
```

- [ ] **Step 2: Inserir o "venue" abaixo da linha do placar**

Localizar o fim do bloco flex do placar (a `</div>` que fecha `<div className="max-w-6xl mx-auto flex items-center justify-between gap-2">`, ~linha 1126). Logo **depois** dela e **antes** da `</div>` que fecha o padding `py-3 px-3` (~linha 1127), inserir:

```tsx
            {/* Venue — onde o jogo aconteceu: estádio do mandante (campo neutro na final) */}
            <div className="max-w-6xl mx-auto mt-2">
              {isFinal ? (
                <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#8A8A9A' }}>
                  <span>📍</span>
                  <span style={{ color: '#C9C9D5' }}>Campo neutro</span>
                  <span style={{ color: '#6A6A7A' }}>· final</span>
                </div>
              ) : (
                <StadiumCard variant="venue" />
              )}
            </div>
```

(Na Fase 1 todos os times usam o `DEFAULT_STADIUM`, então o `venue` mostra sempre "Estádio Municipal" — o gancho fica pronto pra passar o estádio do mandante na Fase 2.)

- [ ] **Step 3: Typecheck + build**

Run: `cd client && npx tsc --noEmit` e depois `npm run build` (na raiz)
Expected: sem erros; build OK.

- [ ] **Step 4: Checkpoint visual**

Manual: numa partida de liga, abaixo do placar aparece "🏟️ Estádio Municipal · onde o jogo aconteceu"; numa **final** de mata-mata aparece "📍 Campo neutro · final". Notas/gols ao vivo do campo (MatchFieldView) intactos.

---

## Task 6: Fim de campanha — técnico como card + estádio + conexões na química

**Files:**
- Modify: `client/src/pages/ReportPage.tsx` (imports; grid da FICHA ~457-469; novo bloco antes do "Squad showcase" ~557; legenda de conexões ~588-600)

**Interfaces:**
- Consumes: `CoachCard`, `StadiumCard`; `coach` (já existe: `ReportPage.tsx:198`), `formation`, `starters`, `chemData`, `playerTeam`, `getChemistryLinks` (já importado), `CHEM_LINK_COLOR` (já importado).

- [ ] **Step 1: Importar os cards**

Em `client/src/pages/ReportPage.tsx`, após a linha 16 (`import FormationField, { CHEM_LINK_COLOR } from '../components/game/FormationField';`):

```tsx
import CoachCard from '../components/game/CoachCard';
import StadiumCard from '../components/game/StadiumCard';
```

- [ ] **Step 2: Tirar o "TÉCNICO: só nome" da FICHA e ajustar o grid pra 3 colunas**

No grid "Team identity" (~linha 457), remover o objeto `{ l: 'TÉCNICO', v: coach?.name ?? '—', c: '#A78BFA' }` da lista (linha 459) e trocar a classe do grid de:
```tsx
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0" style={{ borderColor: '#1A1A2A' }}>
```
para:
```tsx
            <div className="grid grid-cols-3 divide-x" style={{ borderColor: '#1A1A2A' }}>
```
(Restam FORMAÇÃO / TÁTICA / OVERALL — 3 colunas limpas.)

- [ ] **Step 3: Adicionar o bloco Técnico + Estádio antes do "Squad showcase"**

Imediatamente **antes** do comentário `{/* Squad showcase */}` (~linha 557), inserir:

```tsx
        {/* Técnico + Estádio — visual completo, igual ao MEU TIME */}
        {phase >= 3 && playerTeam && coach && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="space-y-4"
          >
            <CoachCard coach={coach} formation={formation} />
            <StadiumCard />
          </motion.div>
        )}
```

- [ ] **Step 4: Melhorar a viz de química — contagem de conexões por tipo na legenda**

No bloco do "squad showcase", a legenda das conexões está em ~588-600. Trocar o `.map` da legenda:
```tsx
                  {([
                    { t: 'club' as const, l: 'Mesmo clube' },
                    { t: 'nation' as const, l: 'Mesma nação' },
                    { t: 'coach' as const, l: 'Mesmo técnico' },
                    { t: 'partner' as const, l: 'Dupla histórica' },
                  ]).map(({ t, l }) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 rounded" style={{ background: CHEM_LINK_COLOR[t] }} />
                      <span className="text-[10px] font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{l}</span>
                    </div>
                  ))}
```
por (conta quantas conexões de cada tipo o XI tem):
```tsx
                  {(() => {
                    const links = getChemistryLinks(starters, playerTeam.coachId);
                    return ([
                      { t: 'club' as const, l: 'Mesmo clube' },
                      { t: 'nation' as const, l: 'Mesma nação' },
                      { t: 'coach' as const, l: 'Mesmo técnico' },
                      { t: 'partner' as const, l: 'Dupla histórica' },
                    ]).map(({ t, l }) => {
                      const n = links.filter(lk => lk.type === t).length;
                      return (
                        <div key={t} className="flex items-center gap-1.5" style={{ opacity: n === 0 ? 0.4 : 1 }}>
                          <span className="inline-block w-4 h-0.5 rounded" style={{ background: CHEM_LINK_COLOR[t] }} />
                          <span className="text-[10px] font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{l} <b style={{ color: '#C9C9D5' }}>({n})</b></span>
                        </div>
                      );
                    });
                  })()}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd client && npx tsc --noEmit` e depois `npm run build` (na raiz)
Expected: sem erros; build OK. (Se `tsc` acusar `coach` possivelmente indefinido no `CoachCard`, o guard `coach &&` no Step 3 já cobre — confirmar que o bloco usa esse guard.)

- [ ] **Step 6: Checkpoint visual**

Manual: terminar uma campanha e abrir a tela final — o técnico aparece como **card completo** (não mais só o nome na ficha) + **card do estádio**, e a legenda de química mostra a **contagem** de cada tipo de conexão (ex.: "Mesmo clube (4)").

---

## Verificação final (end-to-end)

- **Typecheck/build:** `cd client && npx tsc --noEmit`; na raiz `npm run build`.
- **Testes do motor:** `cd client && npx vitest run src/lib/engine-units.test.ts src/lib/stadium.test.ts src/lib/balance.test.ts` — verdes; a faixa de gols/vantagem de casa dentro do esperado.
- **Manual (MEU TIME):** card do técnico idêntico ao de antes + card do Estádio "+4 em tudo em casa" logo abaixo (solo e online); fallback 🏟️ funciona sem a imagem.
- **Manual (partida):** "🏟️ Estádio Municipal · onde o jogo aconteceu" no placar; "📍 Campo neutro · final" na final.
- **Manual (fim de campanha):** técnico como card completo + estádio + contagem de conexões na química.

## Self-Review (feito ao escrever o plano)

- **Cobertura da spec:** motor +4 (Task 1) ✓ · modelo (Task 2) ✓ · `StadiumCard`/`CoachCard` reutilizáveis (Tasks 3-4) ✓ · MEU TIME (Task 4) ✓ · venue na partida (Task 5) ✓ · fim de campanha rico + química (Task 6) ✓. Fase 2 é fora de escopo (documentada na spec).
- **Placeholders:** nenhum — todo passo tem caminho de arquivo e código real.
- **Consistência de tipos:** `Stadium.homeAttrBonus`, `HOME_ATTR_BONUS`, `CoachCard({coach, formation})`, `StadiumCard({stadium?, variant?})` usados igualzinho em todas as tasks que os consomem.
