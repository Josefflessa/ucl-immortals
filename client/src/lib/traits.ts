// UCL Immortals — Trait catalog (single source of truth)
// Every trait a player can carry is defined here with a STRUCTURED effect, so:
//  - the engine applies effects data-drivenly (no scattered `traits.includes`);
//  - the UI shows an accurate, auto-generated effect label per player.
//
// `id` MUST match the exact string used in gameData player definitions.
// Effects are intentionally modest (3–8) so they reward squad-building without
// dwarfing the base attributes.

export type AttrKey =
  | 'pace' | 'shooting' | 'passing' | 'dribbling'
  | 'defending' | 'physical' | 'composure' | 'vision';

export type TraitCondition = 'always' | 'final' | 'knockout' | 'losing';

export interface TraitBoost {
  attribute: AttrKey;
  value: number;
  condition?: TraitCondition; // default 'always'
}

export interface TraitDef {
  id: string;
  icon: string;
  flavor: string;             // short thematic description
  boosts?: TraitBoost[];      // attribute bonuses (applied in getEffectiveAttribute)
  goalkeeperSave?: number;    // GK only: added to shot-stopping / penalty saves
  penaltyComposure?: number;  // penalty taker: added composure in shootouts
  oopRelief?: boolean;        // softens the out-of-position penalty
}

// Portuguese labels for building effect text.
const ATTR_PT: Record<AttrKey, string> = {
  pace: 'Ritmo', shooting: 'Finalização', passing: 'Passe', dribbling: 'Drible',
  defending: 'Defesa', physical: 'Físico', composure: 'Compostura', vision: 'Visão',
};
const COND_PT: Record<TraitCondition, string> = {
  always: '', final: ' (na final)', knockout: ' (no mata-mata)', losing: ' (perdendo)',
};

export const TRAITS: TraitDef[] = [
  // ── Pace / runs ──────────────────────────────────────────────
  { id: 'Velocista',         icon: '💨', flavor: 'Explosão de velocidade.',          boosts: [{ attribute: 'pace', value: 5 }] },
  { id: 'Sobreposição',      icon: '🏃', flavor: 'Apoio constante pelo lado.',        boosts: [{ attribute: 'pace', value: 4 }] },
  { id: 'Ponta de Lança',    icon: '🎯', flavor: 'Referência na frente.',             boosts: [{ attribute: 'shooting', value: 4 }, { attribute: 'physical', value: 2 }] },
  { id: 'Invasor de Área',   icon: '⤴️', flavor: 'Chega na hora certa na área.',      boosts: [{ attribute: 'pace', value: 4 }, { attribute: 'shooting', value: 3 }] },
  { id: 'Chegada pelo Meio', icon: '⬆️', flavor: 'Surge do meio para finalizar.',     boosts: [{ attribute: 'pace', value: 3 }, { attribute: 'shooting', value: 3 }] },
  { id: 'Criador de Espaço', icon: '🌀', flavor: 'Cria espaços com movimentação.',    boosts: [{ attribute: 'pace', value: 3 }, { attribute: 'vision', value: 3 }] },

  // ── Finishing ────────────────────────────────────────────────
  { id: 'Finalizador',          icon: '🥅', flavor: 'Faro de gol.',                      boosts: [{ attribute: 'shooting', value: 6 }] },
  { id: 'Finalização Precisa',  icon: '🎯', flavor: 'Precisão na finalização.',           boosts: [{ attribute: 'shooting', value: 5 }] },
  { id: 'Chute de Longe',       icon: '🚀', flavor: 'Perigo de fora da área.',            boosts: [{ attribute: 'shooting', value: 4 }] },
  { id: 'Canhota Mágica',       icon: '🦶', flavor: 'Esquerda letal.',                   boosts: [{ attribute: 'shooting', value: 3 }, { attribute: 'dribbling', value: 4 }] },
  { id: 'Frio na Final',        icon: '🧊', flavor: 'Decide nos grandes jogos.',         boosts: [{ attribute: 'shooting', value: 8, condition: 'final' }], penaltyComposure: 10 },
  { id: 'Especialista em Decisões', icon: '⚖️', flavor: 'Aparece no mata-mata.',          boosts: [{ attribute: 'shooting', value: 6, condition: 'knockout' }], penaltyComposure: 10 },

  // ── Dribbling ────────────────────────────────────────────────
  { id: 'Dribblador Nato',   icon: '🪄', flavor: 'Drible natural.',         boosts: [{ attribute: 'dribbling', value: 6 }] },
  { id: 'Dribblador Técnico', icon: '🎩', flavor: 'Técnica refinada.',      boosts: [{ attribute: 'dribbling', value: 5 }] },
  { id: 'Dribblador Veloz',  icon: '⚡', flavor: 'Drible em velocidade.',   boosts: [{ attribute: 'dribbling', value: 4 }, { attribute: 'pace', value: 3 }] },

  // ── Passing / playmaking ─────────────────────────────────────
  { id: 'Maestro do Passe',  icon: '🎼', flavor: 'Rege o meio-campo.',        boosts: [{ attribute: 'passing', value: 6 }, { attribute: 'vision', value: 4 }] },
  { id: 'Metrônomo',         icon: '🎵', flavor: 'Mantém o ritmo do passe.',  boosts: [{ attribute: 'passing', value: 6 }] },
  { id: 'Armador',           icon: '🧩', flavor: 'Arma as jogadas.',          boosts: [{ attribute: 'passing', value: 5 }, { attribute: 'vision', value: 4 }] },
  { id: 'Passe Preciso',     icon: '🎯', flavor: 'Passe certeiro.',           boosts: [{ attribute: 'passing', value: 5 }] },
  { id: 'Passe de Calcanhar', icon: '🩰', flavor: 'Passes de calcanhar.',     boosts: [{ attribute: 'passing', value: 4 }] },
  { id: 'Visão de Jogo',     icon: '👁️', flavor: 'Enxerga o passe.',          boosts: [{ attribute: 'vision', value: 6 }] },

  // ── Set pieces ───────────────────────────────────────────────
  { id: 'Cobrador de Falta',     icon: '🎯', flavor: 'Especialista em faltas.', boosts: [{ attribute: 'shooting', value: 3 }, { attribute: 'passing', value: 2 }] },
  { id: 'Bola Parada',           icon: '🎯', flavor: 'Letal na bola parada.',  boosts: [{ attribute: 'shooting', value: 3 }, { attribute: 'passing', value: 3 }] },
  { id: 'Cobrador de Pênaltis',  icon: '⚽', flavor: 'Confiável nas penalidades.', penaltyComposure: 8 },

  // ── Heading / target man ─────────────────────────────────────
  { id: 'Cabeceador',            icon: '🗣️', flavor: 'Perigo de cabeça.',      boosts: [{ attribute: 'physical', value: 3 }, { attribute: 'shooting', value: 3 }] },
  { id: 'Cabeceador Implacável', icon: '🗣️', flavor: 'Imbatível pelo alto.',   boosts: [{ attribute: 'physical', value: 4 }, { attribute: 'shooting', value: 4 }] },
  { id: 'Pivô',                  icon: '🛡️', flavor: 'Segura a bola de costas.', boosts: [{ attribute: 'physical', value: 5 }] },
  { id: 'Pivô Implacável',       icon: '🛡️', flavor: 'Domina o jogo de pivô.', boosts: [{ attribute: 'physical', value: 5 }, { attribute: 'shooting', value: 3 }] },

  // ── Physical / engine ────────────────────────────────────────
  { id: 'Força Bruta',   icon: '💪', flavor: 'Força física acima da média.', boosts: [{ attribute: 'physical', value: 6 }] },
  { id: 'Motorzinho',    icon: '🔋', flavor: 'Não para de correr.',          boosts: [{ attribute: 'physical', value: 4 }, { attribute: 'pace', value: 3 }] },
  { id: 'Box-to-Box',    icon: '🔄', flavor: 'Defende e ataca o jogo todo.', boosts: [{ attribute: 'physical', value: 4 }, { attribute: 'passing', value: 3 }] },

  // ── Defending ────────────────────────────────────────────────
  { id: 'Muralha',             icon: '🧱', flavor: 'Parede defensiva.',          boosts: [{ attribute: 'defending', value: 7 }] },
  { id: 'Zagueiro Imponente',  icon: '🗿', flavor: 'Domina a zaga.',             boosts: [{ attribute: 'defending', value: 6 }, { attribute: 'physical', value: 3 }] },
  { id: 'Marcador Implacável', icon: '🔒', flavor: 'Anula o atacante.',          boosts: [{ attribute: 'defending', value: 6 }] },
  { id: 'Marcação Pesada',     icon: '🪓', flavor: 'Marcação dura.',             boosts: [{ attribute: 'defending', value: 5 }, { attribute: 'physical', value: 3 }] },
  { id: 'Pressão Implacável',  icon: '🔥', flavor: 'Sufoca o adversário.',       boosts: [{ attribute: 'defending', value: 8 }] },
  { id: 'Interceptador',       icon: '✋', flavor: 'Lê e intercepta lances.',    boosts: [{ attribute: 'defending', value: 5 }] },
  { id: 'Posicionamento',      icon: '📐', flavor: 'Sempre bem posicionado.',    boosts: [{ attribute: 'defending', value: 4 }] },
  { id: 'Pressionador',        icon: '🔥', flavor: 'Pressiona a saída de bola.', boosts: [{ attribute: 'defending', value: 3 }, { attribute: 'physical', value: 4 }] },

  // ── Leadership ───────────────────────────────────────────────
  { id: 'Liderança',      icon: '🎖️', flavor: 'Comanda o time.',          boosts: [{ attribute: 'composure', value: 5 }] },
  { id: 'Líder da Defesa', icon: '🛡️', flavor: 'Organiza a defesa.',      boosts: [{ attribute: 'composure', value: 3 }, { attribute: 'defending', value: 4 }] },

  // ── Goalkeeper ───────────────────────────────────────────────
  { id: 'Reflexo Felino',     icon: '🐱', flavor: 'Reflexos felinos.',           goalkeeperSave: 10 },
  { id: 'Elasticidade',       icon: '🤸', flavor: 'Defesas elásticas.',          goalkeeperSave: 6 },
  { id: 'Pegador de Pênalti', icon: '🧤', flavor: 'Pega pênaltis.',              goalkeeperSave: 8 },
  { id: 'Goleiro Líbero',     icon: '🧹', flavor: 'Atua como líbero.',           goalkeeperSave: 5 },
  { id: 'Saída Rápida',       icon: '🧤', flavor: 'Sai rápido do gol.',          goalkeeperSave: 4 },

  // ── Versatility / talent ─────────────────────────────────────
  { id: 'Versatilidade',  icon: '🧭', flavor: 'Joga bem em várias posições.', oopRelief: true, boosts: [{ attribute: 'composure', value: 2 }] },
  { id: 'Talento Natural', icon: '🌟', flavor: 'Talento puro.',              boosts: [{ attribute: 'dribbling', value: 3 }, { attribute: 'composure', value: 3 }] },
];

export const TRAIT_MAP: Record<string, TraitDef> = Object.fromEntries(
  TRAITS.map(t => [t.id, t])
);

// Builds a short, accurate effect label from the structured data (never lies).
export function traitEffectLabel(id: string): string {
  const def = TRAIT_MAP[id];
  if (!def) return '';
  const parts: string[] = [];
  for (const b of def.boosts ?? []) {
    parts.push(`+${b.value} ${ATTR_PT[b.attribute]}${COND_PT[b.condition ?? 'always']}`);
  }
  if (def.goalkeeperSave) parts.push(`+${def.goalkeeperSave} defesa do goleiro`);
  if (def.penaltyComposure) parts.push(`+${def.penaltyComposure} compostura nos pênaltis`);
  if (def.oopRelief) parts.push('sofre menos penalidade ao jogar fora de posição');
  return parts.join(' · ');
}

export function getTraitInfo(id: string): TraitDef | undefined {
  return TRAIT_MAP[id];
}

// ── Engine consumption ─────────────────────────────────────────
interface TraitContext { isKnockout?: boolean; isFinal?: boolean; isLosing?: boolean }

export function getTraitAttributeBonus(
  traits: string[],
  attribute: AttrKey,
  ctx?: TraitContext,
): number {
  let sum = 0;
  for (const id of traits) {
    const def = TRAIT_MAP[id];
    if (!def?.boosts) continue;
    for (const b of def.boosts) {
      if (b.attribute !== attribute) continue;
      const c = b.condition ?? 'always';
      if (c === 'final' && !ctx?.isFinal) continue;
      if (c === 'knockout' && !ctx?.isKnockout) continue;
      if (c === 'losing' && !ctx?.isLosing) continue;
      sum += b.value;
    }
  }
  return sum;
}

export function getGoalkeeperTraitBonus(traits: string[]): number {
  let sum = 0;
  for (const id of traits) sum += TRAIT_MAP[id]?.goalkeeperSave ?? 0;
  return sum;
}

export function getPenaltyComposureBonus(traits: string[]): number {
  let sum = 0;
  for (const id of traits) sum += TRAIT_MAP[id]?.penaltyComposure ?? 0;
  return sum;
}

export function hasOopRelief(traits: string[]): boolean {
  return traits.some(id => TRAIT_MAP[id]?.oopRelief);
}

// ── Random trait rolling ─────────────────────────────────────────
// Players have NO fixed traits. At draft / team-generation time each one is dealt
// RANDOM traits: one guaranteed, plus a rarity-weighted chance of a 2nd and a 3rd, so
// premium cards feel richer and "more than one" actually happens. Traits are drawn from
// a pool appropriate to the player's POSITION GROUP, so a roll is always relevant
// (a striker never lands a goalkeeper trait, a defender never a poacher's instinct).
export type PosGroup = 'GK' | 'DEF' | 'MID' | 'ATK';

export function positionGroup(position: string): PosGroup {
  if (position === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return 'MID';
  return 'ATK';
}

export const TRAIT_POOLS: Record<PosGroup, string[]> = {
  GK: ['Reflexo Felino', 'Elasticidade', 'Pegador de Pênalti', 'Goleiro Líbero', 'Saída Rápida', 'Liderança', 'Versatilidade'],
  DEF: ['Muralha', 'Zagueiro Imponente', 'Marcador Implacável', 'Marcação Pesada', 'Pressão Implacável', 'Interceptador',
    'Posicionamento', 'Pressionador', 'Líder da Defesa', 'Liderança', 'Força Bruta', 'Motorzinho', 'Box-to-Box',
    'Cabeceador', 'Velocista', 'Sobreposição', 'Versatilidade', 'Cobrador de Pênaltis', 'Talento Natural'],
  MID: ['Maestro do Passe', 'Metrônomo', 'Armador', 'Passe Preciso', 'Passe de Calcanhar', 'Visão de Jogo', 'Bola Parada',
    'Box-to-Box', 'Motorzinho', 'Força Bruta', 'Dribblador Técnico', 'Dribblador Veloz', 'Criador de Espaço',
    'Chegada pelo Meio', 'Chute de Longe', 'Cobrador de Falta', 'Cobrador de Pênaltis', 'Interceptador', 'Pressionador',
    'Marcação Pesada', 'Liderança', 'Talento Natural', 'Versatilidade', 'Frio na Final', 'Especialista em Decisões'],
  ATK: ['Finalizador', 'Finalização Precisa', 'Chute de Longe', 'Canhota Mágica', 'Ponta de Lança', 'Invasor de Área',
    'Chegada pelo Meio', 'Criador de Espaço', 'Velocista', 'Sobreposição', 'Dribblador Nato', 'Dribblador Técnico',
    'Dribblador Veloz', 'Cabeceador', 'Cabeceador Implacável', 'Pivô', 'Pivô Implacável', 'Cobrador de Falta',
    'Cobrador de Pênaltis', 'Bola Parada', 'Frio na Final', 'Especialista em Decisões', 'Talento Natural', 'Versatilidade'],
};

// Rolls a player's random traits (1 guaranteed; extras scale with rarity). `minCount`
// floors the number of traits — used by "em alta" (in-form) cards, which always carry
// at least one EXTRA trait on top of their attribute boost.
export function rollPlayerTraits(position: string, rarity: string, minCount = 1, rng: () => number = Math.random): string[] {
  const pool = TRAIT_POOLS[positionGroup(position)];
  const p2 = rarity === 'immortal' ? 0.80 : rarity === 'legendary' ? 0.60 : rarity === 'gold' ? 0.40 : 0.25;
  const p3 = rarity === 'immortal' ? 0.45 : rarity === 'legendary' ? 0.25 : rarity === 'gold' ? 0.10 : 0.0;
  let count = 1;
  if (rng() < p2) { count++; if (rng() < p3) count++; }
  count = Math.max(count, minCount);
  const shuffled = [...pool].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}
