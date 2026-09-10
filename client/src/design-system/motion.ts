/** Shared motion contracts for interface chrome.
 *
 * Gameplay artwork and match celebrations may keep their own timing. These
 * values are for navigation, feedback and low-amplitude UI transitions.
 */
export const motionTokens = {
  instant: 0,
  fast: 120,
  standard: 220,
  emphasis: 360,
  reveal: 600,
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

export type MotionToken = keyof typeof motionTokens;
