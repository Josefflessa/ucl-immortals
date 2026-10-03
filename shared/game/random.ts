// Single source of randomness for the game rules (match engine, discipline,
// draft, bots, narration). By default it is Math.random; tests and tools can
// run any rule with a seeded source to get fully reproducible results.

export type RandomSource = () => number;

let source: RandomSource = () => Math.random();

/** A number in [0, 1) from the active random source. */
export function random(): number {
  return source();
}

/** Runs `fn` with `next` as the random source, restoring the previous one afterwards. */
export function withRandomSource<T>(next: RandomSource, fn: () => T): T {
  const previous = source;
  source = next;
  try {
    return fn();
  } finally {
    source = previous;
  }
}

/** Deterministic PRNG (mulberry32): the same seed always yields the same sequence. */
export function seededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed from a string (FNV-1a), e.g. a test name or a match key. */
export function seedFromString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
