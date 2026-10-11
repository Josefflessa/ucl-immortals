// UCL Immortals — the keys of a club's album rewards (profile frame and cover, drawn in code:
// client/src/components/account/ClubRewards.tsx). Kept light (crests only), so the profile code
// can recognise them without loading the card catalogue.
import { getCrest } from './crests';

/** The profile frame and cover a club's own album page unlocks (user_frames / user_covers keys). */
export function clubRewardKeys(clubId: string): { frameKey: string; coverKey: string } {
  return { frameKey: `club-${clubId}`, coverKey: `club-${clubId}` };
}

/** The club of a club reward key (`club-<id>`), or null. */
export function clubOfRewardKey(key: string | null | undefined): string | null {
  return key?.startsWith('club-') ? key.slice(5) : null;
}

/** Whether a key is a club reward (of a club the game knows). */
export function isClubRewardKey(key: unknown): key is string {
  return typeof key === 'string' && !!getCrest(clubOfRewardKey(key));
}
