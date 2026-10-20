/**
 * Primary positions used by cards and legacy roles retained by formations.
 * Left/right midfielders are represented as wingers on cards, but still fit
 * their matching wide-midfield formation slot as a native position.
 */
const LEGACY_WIDE_MIDFIELD_POSITION: Record<string, string> = {
  LM: 'LW',
  RM: 'RW',
};

export function canonicalPrimaryPosition(position: string): string {
  return LEGACY_WIDE_MIDFIELD_POSITION[position] ?? position;
}

export function samePrimaryPosition(a: string, b: string): boolean {
  return canonicalPrimaryPosition(a) === canonicalPrimaryPosition(b);
}

type PlayerPositionShape = {
  id?: unknown;
  shortName?: unknown;
  fullName?: unknown;
  position: string;
  secondaryPositions?: string[];
};

/** Converts an old LM/RM player record while retaining its former wingback coverage. */
export function normalizeLegacyPlayerPosition<T extends PlayerPositionShape>(player: T): T {
  const position = canonicalPrimaryPosition(player.position);
  const isLegacyWideMidfielder = position !== player.position;
  const oldDefaultSecondaries = player.position === 'LM' ? ['LWB'] : ['RWB'];
  const sourceSecondaries = player.secondaryPositions
    ?? (isLegacyWideMidfielder ? oldDefaultSecondaries : undefined);
  const secondaryPositions = sourceSecondaries?.filter(secondary => !samePrimaryPosition(secondary, position));
  const secondaryPositionsChanged = secondaryPositions !== undefined
    && (player.secondaryPositions === undefined
      || secondaryPositions.length !== player.secondaryPositions.length);

  if (!isLegacyWideMidfielder && !secondaryPositionsChanged) return player;

  return {
    ...player,
    position,
    ...(secondaryPositions !== undefined ? { secondaryPositions } : {}),
  };
}

function isPlayerPositionShape(value: Record<string, unknown>): value is Record<string, unknown> & PlayerPositionShape {
  return typeof value.id === 'string'
    && typeof value.position === 'string'
    && (typeof value.shortName === 'string' || typeof value.fullName === 'string')
    && (value.secondaryPositions == null
      || (Array.isArray(value.secondaryPositions)
        && value.secondaryPositions.every(position => typeof position === 'string')));
}

/**
 * Migrates old player snapshots in saved solo campaigns and online room frames.
 * The input is JSON-shaped game state; unchanged branches keep their references.
 */
export function normalizeLegacyPlayerPositionsDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    let normalized: unknown[] | null = null;
    for (let index = 0; index < value.length; index++) {
      const item = normalizeLegacyPlayerPositionsDeep(value[index]);
      if (item !== value[index]) {
        normalized ??= value.slice();
        normalized[index] = item;
      }
    }
    return (normalized ?? value) as T;
  }

  if (!value || typeof value !== 'object') return value;

  const original = value as Record<string, unknown>;
  let normalized: Record<string, unknown> = isPlayerPositionShape(original)
    ? normalizeLegacyPlayerPosition(original)
    : original;

  for (const [key, child] of Object.entries(normalized)) {
    const nextChild = normalizeLegacyPlayerPositionsDeep(child);
    if (nextChild !== child) {
      if (normalized === original) normalized = { ...original };
      normalized[key] = nextChild;
    }
  }

  return normalized as T;
}
