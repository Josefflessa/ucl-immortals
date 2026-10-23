/**
 * The ways a player gets sent off. The engine tags every red card with its kind, so the
 * narration and the live pitch tell the same story the feed does; the variant (how that kind
 * unfolds on the grass) is drawn at the replay, from the match seed, like the other plays.
 */

export type RedKind = 'tackle' | 'lastman' | 'handball' | 'secondyellow' | 'elbow' | 'brawl';

export const RED_KINDS: readonly RedKind[] = ['tackle', 'lastman', 'handball', 'secondyellow', 'elbow', 'brawl'];

export const RED_VARIANTS = {
  /** A reckless tackle in the middle of the pitch. */
  tackle: ['behind', 'twofoot', 'highboot'],
  /** A foul that stops a clear goalscoring chance: the last man, the shirt, the heels. */
  lastman: ['pull', 'clip', 'bodycheck'],
  /** The ball stopped with a hand, on the line or in the way of a shot. */
  handball: ['line', 'block'],
  /** Already booked, and the second foul of the night. */
  secondyellow: ['late', 'shirt'],
  /** An elbow, in the air or off the ball. */
  elbow: ['aerial', 'blind'],
  /** Heads up, hands out: a scuffle. */
  brawl: ['shove', 'melee'],
} as const satisfies Record<RedKind, readonly string[]>;

export type RedVariant = (typeof RED_VARIANTS)[RedKind][number];

export function isRedKind(value: unknown): value is RedKind {
  return typeof value === 'string' && (RED_KINDS as readonly string[]).includes(value);
}

/** A variant of the kind, from a [0, 1) draw. */
export function redVariantFor(kind: RedKind, draw: number): RedVariant {
  const list = RED_VARIANTS[kind] as readonly RedVariant[];
  return list[Math.min(list.length - 1, Math.floor(draw * list.length))];
}

/** Is the variant one of the kind's? (a forced or stale value falls back to a draw) */
export function isRedVariantOf(kind: RedKind, variant: string | undefined): variant is RedVariant {
  return !!variant && (RED_VARIANTS[kind] as readonly string[]).includes(variant);
}

/**
 * The kind of a red card event. Replays recorded before kinds existed carry only the feed line,
 * so it is read for the telltale words (and anything else is a reckless tackle).
 */
export function redKindOf(event: { secondYellow?: boolean; redKind?: string; description?: string }): RedKind {
  if (event.secondYellow) return 'secondyellow';
  if (isRedKind(event.redKind) && event.redKind !== 'secondyellow') return event.redKind;
  const text = event.description ?? '';
  if (/m[ãa]o na bola|com a m[ãa]o|com o bra[çc]o/i.test(text)) return 'handball';
  if (/cotovel|agress[ãa]o/i.test(text)) return 'elbow';
  if (/confus[ãa]o|empurra/i.test(text)) return 'brawl';
  if (/[úu]ltimo homem|chance clara|cara do gol|gol certo|contra-ataque|pênalti/i.test(text)) return 'lastman';
  return 'tackle';
}

/** What a foul looks like on the pitch: the icon and the caption that pop up at the contact. */
export interface RedLabel { icon: string; text: string }

export const RED_LABELS: { [K in RedKind]: Record<(typeof RED_VARIANTS)[K][number], RedLabel> } = {
  tackle: {
    behind: { icon: '🦶', text: 'ENTRADA POR TRÁS' },
    twofoot: { icon: '🦶', text: 'DOIS PÉS' },
    highboot: { icon: '👟', text: 'SOLA ALTA' },
  },
  lastman: {
    pull: { icon: '✋', text: 'PUXÃO · CHANCE CLARA' },
    clip: { icon: '🦶', text: 'RASTEIRA · CHANCE CLARA' },
    bodycheck: { icon: '💪', text: 'TRANCO · CHANCE CLARA' },
  },
  handball: {
    line: { icon: '✋', text: 'MÃO NA BOLA' },
    block: { icon: '✋', text: 'MÃO NA BOLA' },
  },
  secondyellow: {
    late: { icon: '🦶', text: 'ENTRADA ATRASADA' },
    shirt: { icon: '✋', text: 'PUXÃO NA CAMISA' },
  },
  elbow: {
    aerial: { icon: '💢', text: 'COTOVELADA' },
    blind: { icon: '💢', text: 'COTOVELADA SEM BOLA' },
  },
  brawl: {
    shove: { icon: '😡', text: 'EMPURRÃO' },
    melee: { icon: '😡', text: 'CONFUSÃO' },
  },
};

export function redLabelOf(kind: RedKind, variant: RedVariant): RedLabel {
  return (RED_LABELS[kind] as Record<string, RedLabel>)[variant] ?? RED_LABELS.tackle.behind;
}
