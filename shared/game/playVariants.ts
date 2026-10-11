/**
 * The ways each kind of play can unfold on the pitch, and how it can end. The
 * narration picks one variant and one finish (seeded by the event) and writes its
 * lines for them; the live pitch plays exactly that. One choice, so words and
 * picture never disagree.
 */
import type { PlayKind } from './engine/teamModel';

export const PLAY_VARIANTS = {
  cross: ['byline', 'early', 'cutback', 'overlap', 'driven', 'volley', 'trivela', 'lowfar', 'bicycle', 'diving', 'backheel'],
  through: ['straight', 'onetwo', 'channel', 'lofted', 'split', 'roundkeeper', 'heelpass', 'dummy', 'tikitaka'],
  dribble: ['single', 'double', 'cutinside', 'solo', 'hurdle', 'nutmeg', 'elastico', 'chapeu', 'slalom'],
  longrange: ['layoff', 'clearance', 'square', 'carryshot', 'knockdown', 'halfway'],
  counter: ['long', 'carry', 'twoonone', 'breakaway', 'recovery', 'threevtwo', 'overlap'],
  corner: ['near', 'far', 'short', 'flick', 'edge', 'backpost', 'nearpower', 'olimpico'],
  freekick: ['curl', 'power', 'under', 'routine', 'flank', 'distance'],
  penalty: ['normal', 'stutter', 'power', 'panenka'],
  own_goal: ['byline', 'cutback', 'clearance'],
  blunder: ['single', 'longshot'],
  deflected: ['layoff', 'dribble'],
  screamer: ['strike', 'volley'],
  woodwork: ['layoff', 'clearance', 'curler'],
} as const satisfies Record<PlayKind, readonly string[]>;

export type PlayVariant = (typeof PLAY_VARIANTS)[PlayKind][number];

/**
 * The epic variants: rare, memorable plays. The ordinary draw never picks them; they come
 * only from the epic roll (see epicPlays.ts), weighted by how good the player is.
 */
export const EPIC_VARIANTS: Partial<Record<PlayKind, readonly PlayVariant[]>> = {
  cross: ['bicycle', 'diving', 'backheel'],
  through: ['tikitaka'],
  dribble: ['slalom'],
  longrange: ['halfway'],
  corner: ['olimpico'],
  freekick: ['distance'],
};
/** Epic finishes: they can crown any fitting play (see epicFinishesFor). */
export const EPIC_FINISHES: readonly FinishStyle[] = ['double', 'posts'];

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
  counter: ['breakaway', 'recovery'],
  longrange: ['clearance', 'carryshot', 'halfway'],
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

/** How a goal goes in. */
export type GoalStyle = 'low' | 'high' | 'chip' | 'postin' | 'deflect' | 'fumble' | 'panenka' | 'rebound';
/** How the keeper stops it ('double': the shot and then the follow-up, both saved — an epic). */
export type SaveStyle = 'parry' | 'catch' | 'tip' | 'feet' | 'double';
/**
 * Where a miss goes ('blocked': off a defender, or the wall, and out; 'cleared': off the line;
 * 'posts': off one post, along the line and off the other — an epic).
 */
export type MissStyle = 'wide' | 'over' | 'post' | 'bar' | 'blocked' | 'cleared' | 'posts';
export type FinishStyle = GoalStyle | SaveStyle | MissStyle;
export type Outcome = 'goal' | 'save' | 'miss';

/** What the strike is: it decides which finishes make sense. */
export type StrikeClass = 'header' | 'close' | 'long' | 'setpiece' | 'penalty';

export function strikeClassOf(kind: PlayKind, variant: PlayVariant): StrikeClass {
  switch (kind) {
    case 'cross': return variant === 'byline' || variant === 'early' || variant === 'overlap' || variant === 'trivela' || variant === 'diving' ? 'header' : 'close';
    case 'corner': return variant === 'edge' ? 'long' : variant === 'nearpower' ? 'close' : variant === 'olimpico' ? 'setpiece' : 'header';
    case 'freekick': return variant === 'flank' ? 'header' : 'setpiece';
    case 'own_goal': return 'close';
    case 'through': case 'counter': case 'dribble': case 'blunder': return 'close';
    case 'penalty': return 'penalty';
    default: return 'long'; // longrange, deflected, screamer, woodwork
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
  'longrange/halfway': { goal: ['high', 'low'], save: ['tip'], miss: ['over', 'wide', 'bar'] },
  'corner/olimpico': { goal: ['postin', 'high'], save: ['tip', 'parry'], miss: ['post', 'bar'] },
  'freekick/distance': { goal: ['high', 'postin'], save: ['tip', 'parry'], miss: ['over', 'bar'] },
  'freekick/flank': { goal: ['low', 'high', 'rebound'], save: ['parry', 'catch', 'tip'], miss: ['wide', 'over', 'post', 'bar', 'cleared'] },
  'freekick/routine': { goal: ['high', 'low', 'postin'], save: ['parry', 'catch', 'tip'], miss: ['over', 'wide', 'blocked', 'post'] },
  'dribble/slalom': { goal: ['low', 'high', 'chip', 'rebound'], save: ['parry', 'catch', 'feet'], miss: ['wide', 'over', 'post'] },
};

/**
 * The epic finishes a play can have for an outcome (on top of its ordinary ones): the double
 * save after a close-range shot or a header, the ball off both posts after a shot on the
 * ground. Only from the epic roll.
 */
export function epicFinishesFor(kind: PlayKind, variant: PlayVariant, outcome: Outcome): readonly FinishStyle[] {
  if (kind === 'penalty' || kind === 'freekick' || variant === 'roundkeeper' || isEpicVariant(kind, variant)) return [];
  const cls = strikeClassOf(kind, variant);
  if (outcome === 'save') return cls === 'close' || cls === 'header' ? ['double'] : [];
  if (outcome === 'miss') return cls === 'close' || cls === 'long' ? ['posts'] : [];
  return [];
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
    if (kind === 'screamer') return ['high', 'postin'];
    if (kind === 'penalty') return variant === 'panenka' ? ['panenka'] : variant === 'power' ? ['high'] : variant === 'stutter' ? ['low'] : ['low', 'high'];
    if (kind === 'freekick') return variant === 'under' ? ['low'] : variant === 'power' ? ['high', 'low'] : ['high', 'postin'];
    // Round the keeper: rolled into the empty net.
    if (variant === 'roundkeeper') return ['low'];
    if (cls === 'header') return ['low', 'high', 'rebound'];
    if (cls === 'long') return ['high', 'low', 'postin'];
    // A chip needs the keeper coming out: only when through on goal.
    const oneOnOne = kind === 'through' || kind === 'counter' || variant === 'solo';
    return oneOnOne ? ['low', 'high', 'chip', 'rebound'] : ['low', 'high', 'rebound'];
  }
  if (variant === 'roundkeeper') return outcome === 'miss' ? ['wide'] : [];
  if (outcome === 'save') {
    if (kind === 'penalty') return variant === 'panenka' ? ['catch'] : ['parry', 'catch', 'feet'];
    if (cls === 'close') return ['parry', 'catch', 'feet'];
    if (kind === 'freekick' && variant === 'under') return ['parry', 'catch'];
    return ['parry', 'catch', 'tip'];
  }
  if (kind === 'woodwork') return ['post', 'bar'];
  if (kind === 'penalty') return variant === 'panenka' ? ['over', 'bar'] : ['wide', 'over', 'post', 'bar'];
  if (kind === 'freekick') return variant === 'under' ? ['blocked', 'wide'] : ['over', 'wide', 'blocked', 'post', 'bar'];
  if (cls === 'header') return ['wide', 'over', 'post', 'bar', 'cleared'];
  // Through on goal (a counter, a solo run) nobody is in front of him: no block, nobody on the line.
  if (cls === 'close') return kind === 'counter' || variant === 'solo' ? ['wide', 'over', 'post'] : ['wide', 'over', 'post', 'blocked', 'cleared'];
  return ['wide', 'over', 'blocked', 'post', 'bar', 'cleared'];
}

/** A finish for the outcome, from a [0, 1) draw. */
export function finishFor(kind: PlayKind, variant: PlayVariant, outcome: Outcome, draw: number): FinishStyle {
  const list = finishesFor(kind, variant, outcome);
  return list[Math.min(list.length - 1, Math.floor(draw * list.length))];
}
