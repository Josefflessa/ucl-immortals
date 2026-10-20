/**
 * The ways each kind of play can unfold on the pitch, and how it can end. The
 * narration picks one variant and one finish (seeded by the event) and writes its
 * lines for them; the live pitch plays exactly that. One choice, so words and
 * picture never disagree.
 */
import type { PlayKind } from './engine/teamModel';

export const PLAY_VARIANTS = {
  cross: ['byline', 'early', 'cutback', 'overlap', 'driven', 'volley', 'trivela', 'lowfar', 'deep', 'farknock', 'firsttime', 'bicycle', 'diving', 'backheel', 'scorpion', 'longthrow'],
  through: ['straight', 'onetwo', 'channel', 'lofted', 'split', 'roundkeeper', 'heelpass', 'dummy', 'thirdman', 'blindside', 'scoop', 'tikitaka', 'diagonal'],
  dribble: ['single', 'double', 'cutinside', 'solo', 'hurdle', 'nutmeg', 'elastico', 'chapeu', 'roulette', 'stepover', 'cruyff', 'slalom', 'rabona', 'dragback', 'strength', 'pace'],
  longrange: ['layoff', 'clearance', 'square', 'carryshot', 'knockdown', 'chest', 'outside', 'turn', 'halfway', 'wallpass', 'curler', 'crossfield'],
  counter: ['long', 'carry', 'twoonone', 'breakaway', 'recovery', 'threevtwo', 'overlap', 'switch', 'cutback', 'onetwo'],
  corner: ['near', 'far', 'short', 'flick', 'edge', 'backpost', 'nearpower', 'decoy', 'late', 'olimpico', 'scramble'],
  freekick: ['curl', 'power', 'under', 'routine', 'flank', 'dummyrun', 'chipped', 'distance', 'knuckle', 'dipper'],
  penalty: ['normal', 'stutter', 'power', 'panenka', 'center', 'corner', 'curved', 'calm'],
  own_goal: ['byline', 'cutback', 'clearance', 'corner'],
  blunder: ['single', 'longshot', 'header', 'freekick'],
  deflected: ['layoff', 'dribble', 'freekick', 'edge'],
  screamer: ['strike', 'volley', 'outside', 'dipping'],
  woodwork: ['layoff', 'clearance', 'curler', 'header', 'chip'],
} as const satisfies Record<PlayKind, readonly string[]>;

export type PlayVariant = (typeof PLAY_VARIANTS)[PlayKind][number];

/**
 * The epic variants: rare, memorable plays. The ordinary draw never picks them; they come
 * only from the epic roll (see epicPlays.ts), weighted by how good the player is.
 */
export const EPIC_VARIANTS: Partial<Record<PlayKind, readonly PlayVariant[]>> = {
  cross: ['bicycle', 'diving', 'backheel', 'scorpion'],
  through: ['tikitaka'],
  dribble: ['slalom', 'rabona'],
  longrange: ['halfway'],
  corner: ['olimpico'],
  freekick: ['distance'],
};
/** Epic finishes: they can crown any fitting play (see epicFinishesFor). */
export const EPIC_FINISHES: readonly FinishStyle[] = ['double', 'posts', 'barline'];

export function isEpicVariant(kind: PlayKind, variant: PlayVariant): boolean {
  return (EPIC_VARIANTS[kind] ?? []).includes(variant);
}
export function isEpic(kind: PlayKind, variant: PlayVariant, finish: FinishStyle): boolean {
  return isEpicVariant(kind, variant) || EPIC_FINISHES.includes(finish);
}

/**
 * Variants where nobody passes to the finisher: an assisted goal never plays as one of
 * these (a breakaway from his own half has no assist to show). Dribbles start with the
 * assist instead (see the pitch scripts).
 */
const UNASSISTED: Partial<Record<PlayKind, readonly string[]>> = {
  // The far-post knock-down: the last touch is the header back across, not the cross.
  cross: ['farknock'],
  // (The wall passes: the return pass is the last one, but the one who starts with the ball is the finisher.)
  counter: ['breakaway', 'recovery', 'onetwo'],
  longrange: ['clearance', 'carryshot', 'halfway', 'curler', 'wallpass'],
  dribble: ['slalom'],
  corner: ['olimpico'],
};
export function allowsAssist(kind: PlayKind, variant: PlayVariant): boolean {
  return !(UNASSISTED[kind] ?? []).includes(variant);
}

/**
 * A variant of the kind, from a [0, 1) draw. With an outcome, only variants that can end
 * that way (rounding the keeper never ends in a save, for instance); with an assist, only
 * variants where the assist is the last pass. Never an epic (those come from the epic roll).
 */
export function variantFor(kind: PlayKind, draw: number, outcome?: Outcome, assisted = false): PlayVariant {
  const all = (PLAY_VARIANTS[kind] as readonly PlayVariant[]).filter(v => !isEpicVariant(kind, v));
  const fitting = all
    .filter(v => !outcome || finishesFor(kind, v, outcome).length > 0)
    .filter(v => !assisted || allowsAssist(kind, v));
  const list = fitting.length > 0 ? fitting : all;
  return list[Math.min(list.length - 1, Math.floor(draw * list.length))];
}

/**
 * Who serves the ball when the engine names nobody (no assist, no creator): the first
 * player of the XI, in lineup order, with one of these roles (wide players for a cross or
 * a corner, playmakers otherwise). The narration and the pitch both use it, so the name
 * read out is the player shown.
 */
export const SERVER_ROLES = {
  wide: ['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB', 'LB', 'RB'],
  playmaker: ['CAM', 'CM', 'CDM', 'LM', 'RM'],
} as const;
export function serverRolesFor(kind: PlayKind): readonly string[] {
  return kind === 'cross' || kind === 'corner' || kind === 'own_goal' ? SERVER_ROLES.wide : SERVER_ROLES.playmaker;
}

/**
 * How a goal goes in ('nutmeg': through the keeper's legs as he comes out; 'barin': off the
 * underside of the bar and down over the line; 'bounce': it bounces just in front of the
 * keeper and over his arm; 'middle': a penalty struck down the middle as he dives).
 */
export type GoalStyle = 'low' | 'high' | 'chip' | 'postin' | 'deflect' | 'fumble' | 'panenka' | 'rebound' | 'nutmeg' | 'barin' | 'bounce' | 'middle';
/**
 * How the keeper stops it ('double': the shot and then the follow-up, both saved — an epic;
 * 'onehand': at full stretch with the top hand, round the post; 'reflex': point blank, off
 * his body and up, then claimed; 'spread': out to the shooter, spread wide, and it hits him; 'punch': up with both fists on a header, clearing it high and wide).
 */
export type SaveStyle = 'parry' | 'catch' | 'tip' | 'feet' | 'double' | 'onehand' | 'reflex' | 'spread' | 'punch';
/**
 * Where a miss goes ('blocked': off a defender, or the wall, and out; 'cleared': off the line;
 * 'posts': off one post, along the line and off the other — an epic; 'sidenet': into the
 * side netting from an angle; 'scuffed': mishit and rolling wide;
 * 'barline': off the bar, down on the line and back out — an epic).
 */
export type MissStyle = 'wide' | 'over' | 'post' | 'bar' | 'blocked' | 'cleared' | 'posts' | 'sidenet' | 'scuffed' | 'barline';
/**
 * How a defender stops the move before any strike (a duel, the engine's 'duel' event):
 * 'tackle': he steps in and takes it off him on his feet; 'slide': a sliding tackle;
 * 'intercept': he gets in front and cuts the ball out; 'aerial': he wins the header and
 * clears; 'sweep': the keeper comes out and smothers it at the attacker's feet.
 */
export type DuelStyle = 'tackle' | 'slide' | 'intercept' | 'aerial' | 'sweep';
export const DUEL_STYLES: readonly DuelStyle[] = ['tackle', 'slide', 'intercept', 'aerial', 'sweep'];
export function isDuelStyle(finish: FinishStyle | undefined): finish is DuelStyle {
  return finish !== undefined && (DUEL_STYLES as readonly string[]).includes(finish);
}
export type FinishStyle = GoalStyle | SaveStyle | MissStyle | DuelStyle;
export type Outcome = 'goal' | 'save' | 'miss';

/** What the strike is: it decides which finishes make sense. */
export type StrikeClass = 'header' | 'close' | 'long' | 'setpiece' | 'penalty';

const HEADED_CROSSES: readonly string[] = ['byline', 'early', 'overlap', 'trivela', 'diving', 'deep', 'firsttime', 'longthrow'];

export function strikeClassOf(kind: PlayKind, variant: PlayVariant): StrikeClass {
  switch (kind) {
    case 'cross': return HEADED_CROSSES.includes(variant) ? 'header' : 'close';
    case 'corner': return variant === 'edge' ? 'long' : variant === 'nearpower' || variant === 'scramble' ? 'close' : variant === 'olimpico' ? 'setpiece' : 'header';
    case 'freekick': return variant === 'flank' ? 'header' : variant === 'chipped' ? 'close' : 'setpiece';
    case 'own_goal': return 'close';
    case 'blunder': return variant === 'header' ? 'header' : variant === 'freekick' ? 'setpiece' : 'close';
    case 'through': case 'counter': case 'dribble': return 'close';
    case 'penalty': return 'penalty';
    case 'woodwork': return variant === 'header' ? 'header' : variant === 'chip' ? 'close' : 'long';
    case 'deflected': return variant === 'freekick' ? 'setpiece' : 'long';
    default: return 'long'; // longrange, screamer
  }
}

/**
 * Plays whose picture allows only some endings: a bicycle kick is never held, a ball from
 * the halfway line is only ever tipped over, an Olympic goal curls in off the post...
 */
const OWN_FINISHES: Record<string, Record<Outcome, readonly FinishStyle[]>> = {
  'cross/bicycle': { goal: ['low', 'high'], save: ['parry', 'tip'], miss: ['over', 'wide', 'bar'] },
  'cross/diving': { goal: ['low', 'high'], save: ['parry', 'catch', 'feet'], miss: ['wide', 'post'] },
  'cross/backheel': { goal: ['low', 'postin'], save: ['catch', 'parry'], miss: ['wide', 'post'] },
  'cross/scorpion': { goal: ['low', 'high'], save: ['parry', 'catch'], miss: ['wide', 'over', 'bar'] },
  'longrange/halfway': { goal: ['high', 'low'], save: ['tip'], miss: ['over', 'wide', 'bar'] },
  'corner/olimpico': { goal: ['postin', 'high'], save: ['tip', 'parry'], miss: ['post', 'bar'] },
  'freekick/distance': { goal: ['high', 'postin'], save: ['tip', 'parry'], miss: ['over', 'bar'] },
  'freekick/flank': { goal: ['low', 'high', 'rebound'], save: ['parry', 'catch', 'tip'], miss: ['wide', 'over', 'post', 'bar', 'cleared'] },
  'freekick/routine': { goal: ['high', 'low', 'postin'], save: ['parry', 'catch', 'tip'], miss: ['over', 'wide', 'blocked', 'post'] },
  'freekick/dummyrun': { goal: ['high', 'postin', 'barin'], save: ['parry', 'tip', 'onehand'], miss: ['over', 'wide', 'blocked', 'post'] },
  // Dinked over the wall to a runner, who volleys it: nobody is set to block it.
  'freekick/chipped': { goal: ['low', 'high', 'rebound'], save: ['parry', 'catch', 'reflex'], miss: ['wide', 'over', 'post'] },
  'dribble/slalom': { goal: ['low', 'high', 'chip', 'rebound'], save: ['parry', 'catch', 'feet'], miss: ['wide', 'over', 'post'] },
  'dribble/rabona': { goal: ['low', 'high', 'postin'], save: ['parry', 'catch', 'feet'], miss: ['wide', 'over', 'post'] },
  // A volley on the run after a ball dinked over the defence.
  'through/scoop': { goal: ['low', 'high', 'rebound'], save: ['parry', 'catch', 'reflex'], miss: ['wide', 'over', 'post'] },
  // A dink over the keeper coming out: it can only come down on the woodwork.
  'woodwork/chip': { goal: [], save: [], miss: ['bar', 'post'] },
};

/**
 * The epic finishes a play can have for an outcome (on top of its ordinary ones): the double
 * save after a close-range shot, a header or a penalty; the ball off both posts after a shot
 * on the ground; off the bar and down on the line after a header or a shot from distance.
 * Only from the epic roll.
 */
export function epicFinishesFor(kind: PlayKind, variant: PlayVariant, outcome: Outcome): readonly FinishStyle[] {
  // A penalty saved, and the follow-up too (never after a panenka: he stays on his feet).
  if (kind === 'penalty') return outcome === 'save' && variant !== 'panenka' ? ['double'] : [];
  if (kind === 'freekick' || variant === 'roundkeeper' || variant === 'chip' || isEpicVariant(kind, variant)) return [];
  const cls = strikeClassOf(kind, variant);
  if (outcome === 'save') return cls === 'close' || cls === 'header' ? ['double'] : [];
  if (outcome === 'miss') {
    const out: FinishStyle[] = [];
    if (cls === 'close' || cls === 'long') out.push('posts');
    if (cls === 'header' || cls === 'long') out.push('barline');
    return out;
  }
  return [];
}

/** Through on goal with the keeper coming out to meet him (a chip, or his legs, are on). */
function oneOnOne(kind: PlayKind, variant: PlayVariant): boolean {
  return (kind === 'through' || kind === 'counter' || variant === 'solo') && variant !== 'scoop';
}

/** Every finish a play can have for an outcome, so each one is a real option. */
export function finishesFor(kind: PlayKind, variant: PlayVariant, outcome: Outcome): readonly FinishStyle[] {
  const cls = strikeClassOf(kind, variant);
  // The epics and the set-piece routines end only in the ways their picture allows.
  const own = OWN_FINISHES[`${kind}/${variant}`];
  if (own) return own[outcome];
  if (outcome === 'goal') {
    if (kind === 'own_goal' || kind === 'deflected') return ['deflect'];
    if (kind === 'blunder') return ['fumble'];
    if (kind === 'screamer') return ['high', 'postin', 'barin'];
    if (kind === 'penalty') {
      if (variant === 'panenka') return ['panenka'];
      if (variant === 'center') return ['middle'];
      if (variant === 'corner') return ['low', 'postin'];
      return variant === 'power' ? ['high'] : variant === 'stutter' ? ['low'] : ['low', 'high'];
    }
    if (kind === 'freekick') return variant === 'under' ? ['low'] : variant === 'power' ? ['high', 'low', 'barin'] : ['high', 'postin', 'barin'];
    // Round the keeper: rolled into the empty net.
    if (variant === 'roundkeeper') return ['low'];
    if (cls === 'header') return ['low', 'high', 'rebound'];
    if (cls === 'long') return ['high', 'low', 'postin', 'barin', 'bounce'];
    return oneOnOne(kind, variant) ? ['low', 'high', 'chip', 'rebound', 'nutmeg'] : ['low', 'high', 'rebound'];
  }
  if (variant === 'roundkeeper') return outcome === 'miss' ? ['wide'] : [];
  if (outcome === 'save') {
    if (kind === 'penalty') {
      if (variant === 'panenka') return ['catch'];
      // Down the middle he stays up; tucked into the corner he has to get down to it.
      if (variant === 'center') return ['catch', 'feet'];
      if (variant === 'corner') return ['parry', 'feet'];
      return ['parry', 'catch', 'feet'];
    }
    if (cls === 'close') return oneOnOne(kind, variant) ? ['parry', 'catch', 'feet', 'reflex', 'spread'] : ['parry', 'catch', 'feet', 'reflex'];
    if (kind === 'freekick' && variant === 'under') return ['parry', 'catch'];
    if (cls === 'header') return ['parry', 'catch', 'tip', 'reflex', 'punch'];
    return ['parry', 'catch', 'tip', 'onehand'];
  }
  if (kind === 'woodwork') return ['post', 'bar'];
  if (kind === 'penalty') {
    if (variant === 'panenka' || variant === 'center') return ['over', 'bar'];
    if (variant === 'corner') return ['post', 'wide'];
    return ['wide', 'over', 'post', 'bar'];
  }
  if (kind === 'freekick') return variant === 'under' ? ['blocked', 'wide'] : ['over', 'wide', 'blocked', 'post', 'bar'];
  if (cls === 'header') return ['wide', 'over', 'post', 'bar', 'cleared'];
  // Through on goal (a counter, a solo run) nobody is in front of him: no block, nobody on the line.
  if (cls === 'close') return kind === 'counter' || variant === 'solo' ? ['wide', 'over', 'post', 'sidenet', 'scuffed'] : ['wide', 'over', 'post', 'blocked', 'cleared', 'sidenet', 'scuffed'];
  return ['wide', 'over', 'blocked', 'post', 'bar', 'cleared', 'scuffed'];
}

/** A finish for the outcome, from a [0, 1) draw. */
export function finishFor(kind: PlayKind, variant: PlayVariant, outcome: Outcome, draw: number): FinishStyle {
  const list = finishesFor(kind, variant, outcome);
  return list[Math.min(list.length - 1, Math.floor(draw * list.length))];
}

/** Plays that cannot end in a duel: the set pieces and the freak goals have no move to stop. */
const NO_DUEL: readonly PlayKind[] = ['penalty', 'freekick', 'own_goal', 'blunder', 'deflected', 'screamer', 'woodwork'];

/** Every way a defender can stop this play before the strike (empty: it cannot be stopped). */
export function duelStylesFor(kind: PlayKind, variant: PlayVariant): readonly DuelStyle[] {
  if (NO_DUEL.includes(kind)) return [];
  const v: string = variant;
  // Rounding the keeper: only the keeper can still stop it. A dink over him: nobody can get a foot to it.
  if (v === 'roundkeeper') return ['sweep'];
  // A dink over the keeper, or a volley after one: nobody can get a foot to it. A lofted ball can still be cut out.
  if (v === 'scoop' || v === 'chip') return [];
  if (v === 'lofted') return ['intercept'];
  // A volley is struck on the run from a ball already coming down: too late to stop it.
  if (v === 'volley') return [];
  const cls = strikeClassOf(kind, variant);
  if (cls === 'header') return ['aerial'];
  if (cls === 'setpiece') return [];
  // Through on goal: the last man, or the keeper rushing out.
  if (kind === 'through' || kind === 'counter' || v === 'solo') return ['tackle', 'slide', 'sweep'];
  return ['tackle', 'slide', 'intercept'];
}

/** A variant of the kind that a defender can stop (never an epic), from a [0, 1) draw. */
export function duelVariantFor(kind: PlayKind, draw: number): PlayVariant | null {
  const all = (PLAY_VARIANTS[kind] as readonly PlayVariant[]).filter(v => !isEpicVariant(kind, v) && duelStylesFor(kind, v).length > 0);
  return all.length === 0 ? null : all[Math.min(all.length - 1, Math.floor(draw * all.length))];
}

/** How the defender stops it, from a [0, 1) draw. */
export function duelFinishFor(kind: PlayKind, variant: PlayVariant, draw: number): DuelStyle {
  const list = duelStylesFor(kind, variant);
  return list[Math.min(list.length - 1, Math.floor(draw * list.length))];
}
