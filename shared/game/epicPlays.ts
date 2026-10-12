/**
 * The epic roll: whether a danger plays as one of the rare, memorable plays (a bicycle kick,
 * a scorpion kick, a goal from the halfway line, a run from his own half, a double save...), and which.
 * Rare by design — about one every three or four matches between good teams — and more
 * likely the better the player is at what the play needs (and with the trait for it).
 * The engine still decides who scores and whether it goes in; this only picks how.
 */
import type { Player } from './gameData';
import type { PlayKind, Team } from './engine/teamModel';
import { allowsAssist, EPIC_VARIANTS, epicFinishesFor, finishesFor, PLAY_VARIANTS, type FinishStyle, type Outcome, type PlayVariant } from './playVariants';

/** Chance of an epic for a play by a player rated 85 at what it needs (weight 1). */
export const EPIC_BASE_CHANCE = 0.04;

export interface EpicContext {
  kind: PlayKind;
  outcome: Outcome;
  assisted: boolean;
  shooter?: Player;
  keeper?: Player;
  /** The attacking XI. */
  lineup: readonly Player[];
}

/** An epic variant (its finish drawn as usual), or an epic finish (on an ordinary variant). */
export type EpicPick = { variant: PlayVariant; finish?: undefined } | { variant?: undefined; finish: FinishStyle };

/** 0.25 for a 70-rated player, 1 at 85, up to 2 for the very best. */
export function skillWeight(rating: number): number {
  const u = (rating - 55) / 30;
  return Math.min(2, Math.max(0.25, u * u));
}

const TRAIT_BONUS = 1.6;
const hasTrait = (p: Player | undefined, traits: readonly string[]) => !!p && p.traits.some(t => traits.includes(t));
const avg = (...values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** How suited this player (or team) is to each epic. */
function weightOf(option: EpicPick, ctx: EpicContext): number {
  const p = ctx.shooter;
  if (option.finish === 'posts') return 0.5; // pure luck: the same for everyone, and rarer
  if (option.finish === 'barline') return 0.4; // luck too, and rarer still
  if (option.finish === 'double') {
    const gk = ctx.keeper;
    return gk ? skillWeight(gk.defending) * (hasTrait(gk, ['Reflexo Felino']) ? TRAIT_BONUS : 1) : 1;
  }
  if (!p) return 1;
  const trait = (...names: string[]) => (hasTrait(p, names) ? TRAIT_BONUS : 1);
  switch (option.variant) {
    case 'bicycle': return skillWeight(avg(p.physical, p.dribbling));
    case 'diving': return skillWeight(avg(p.physical, p.shooting)) * trait('Cabeceador', 'Cabeceador Implacável');
    case 'backheel': return skillWeight(avg(p.dribbling, p.composure));
    case 'scorpion': return 0.8 * skillWeight(avg(p.dribbling, p.physical, p.composure));
    case 'rabona': return skillWeight(avg(p.dribbling, p.composure)) * trait('Dribblador Técnico', 'Dribblador Nato');
    case 'halfway': return skillWeight(avg(p.shooting, p.vision)) * trait('Chute de Longe');
    case 'olimpico': return skillWeight(p.shooting) * trait('Cobrador de Falta');
    // (Free kicks are frequent, so a 35-metre one stays rarer per kick.)
    case 'distance': return 0.6 * skillWeight(p.shooting) * trait('Cobrador de Falta', 'Chute de Longe');
    case 'slalom': return skillWeight(avg(p.dribbling, p.pace)) * trait('Dribblador Nato', 'Dribblador Técnico', 'Velocista');
    case 'tikitaka': {
      const outfield = ctx.lineup.filter(x => x.position !== 'GK');
      const passing = outfield.length ? avg(...outfield.map(x => x.passing)) : 75;
      const maestro = ctx.lineup.some(x => hasTrait(x, ['Maestro do Passe', 'Visão de Jogo', 'Metrônomo', 'Passe Preciso']));
      return skillWeight(passing) * (maestro ? TRAIT_BONUS : 1);
    }
    default: return 1;
  }
}

/** Every epic this danger could be. */
export function epicOptions(kind: PlayKind, outcome: Outcome, assisted: boolean): EpicPick[] {
  const out: EpicPick[] = [];
  for (const variant of EPIC_VARIANTS[kind] ?? []) {
    if (finishesFor(kind, variant, outcome).length === 0) continue;
    if (assisted && !allowsAssist(kind, variant)) continue;
    out.push({ variant });
  }
  const finishes = new Set<FinishStyle>();
  for (const variant of PLAY_VARIANTS[kind] as readonly PlayVariant[]) {
    if (assisted && !allowsAssist(kind, variant)) continue;
    for (const f of epicFinishesFor(kind, variant, outcome)) finishes.add(f);
  }
  finishes.forEach(finish => out.push({ finish }));
  return out;
}

/**
 * The epic roll, from two [0, 1) draws (whether, and which). The chance grows with the best
 * suited option's weight (capped at 2.5x); the pick is weighted the same way.
 */
export function rollEpic(ctx: EpicContext, whether: number, which: number): EpicPick | null {
  const options = epicOptions(ctx.kind, ctx.outcome, ctx.assisted);
  if (options.length === 0) return null;
  const weights = options.map(o => weightOf(o, ctx));
  const chance = EPIC_BASE_CHANCE * Math.min(2.5, Math.max(...weights));
  if (whether >= chance) return null;
  const total = weights.reduce((sum, w) => sum + w, 0);
  let draw = which * total;
  for (let i = 0; i < options.length; i++) {
    draw -= weights[i];
    if (draw < 0) return options[i];
  }
  return options[options.length - 1];
}
