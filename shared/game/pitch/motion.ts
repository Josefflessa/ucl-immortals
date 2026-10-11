/** Real-world speeds for the live pitch, in metres per second. Everything that
 * moves on the pitch is limited by these, so nobody teleports. */
export const SPEED = { jog: 5, run: 7.5, sprint: 9 } as const;

/** Top speeds the tests hold every timeline to (a little above the sprint and the hardest pass). */
export const MAX_PLAYER_SPEED = 10;
export const MAX_BALL_SPEED = 48;

/** Ball speeds of open play. */
export const BALL_SPEED = { pass: 17, long: 24 } as const;

/** A broadcast cut: the picture fades out, everyone is re-placed while it is dark
 * (at CUT_SNAP_MS) and it fades back in by CUT_MS. Used when a play starts far
 * from where the ball is. */
export const CUT_MS = 440;
export const CUT_SNAP_MS = 220;
