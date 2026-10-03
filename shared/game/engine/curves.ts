// Probability curves shared by every contest in the engine.
//
// Rule: an attribute never hits a ceiling. A contest is decided by the EDGE between the two
// sides (attacker − defender, taker − keeper…) through a logistic curve: 50% at a zero edge,
// approaching 0%/100% without ever reaching them, so every extra point always helps. The two
// sides are symmetric: +10 for the attacker is cancelled by +10 for the defender.

/**
 * Chance that the side holding `edge` wins the contest. `scale` is the steepness: it takes
 * `scale` points of edge to move from 50% to ~73% (and 2×scale to ~88%).
 */
export function edgeChance(edge: number, scale: number): number {
  return 1 / (1 + Math.exp(-edge / scale));
}
