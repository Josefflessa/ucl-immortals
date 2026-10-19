/**
 * Flags are served from our own /flags (no third-party host at play time): a flag from another
 * site loaded in front of the player, one request at a time, and a failure left a broken image.
 */
export function flagUrl(code: string): string {
  return `/flags/${code}.webp`;
}
