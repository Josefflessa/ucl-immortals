export const PROFILE_AVATAR_BACKGROUNDS = [
  { key: 'graphite', label: 'Grafite', color: '#252737' },
  { key: 'ocean', label: 'Azul oceano', color: '#1d3f58' },
  { key: 'teal', label: 'Verde-petróleo', color: '#20544e' },
  { key: 'forest', label: 'Verde floresta', color: '#354b35' },
  { key: 'crimson', label: 'Vermelho', color: '#63313a' },
  { key: 'violet', label: 'Violeta', color: '#493664' },
  { key: 'gold', label: 'Dourado', color: '#69551f' },
  { key: 'rose', label: 'Rosa', color: '#693d56' },
] as const;

type ProfileAvatarBackgroundKey = (typeof PROFILE_AVATAR_BACKGROUNDS)[number]['key'];

export const DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY: ProfileAvatarBackgroundKey = 'graphite';

export function getProfileAvatarBackground(key: string) {
  return PROFILE_AVATAR_BACKGROUNDS.find(background => background.key === key)
    ?? PROFILE_AVATAR_BACKGROUNDS[0];
}

export function normalizeProfileAvatarBackgroundKey(key: string): ProfileAvatarBackgroundKey {
  return getProfileAvatarBackground(key).key;
}

export function isProfileAvatarBackgroundKey(key: string): key is ProfileAvatarBackgroundKey {
  return PROFILE_AVATAR_BACKGROUNDS.some(background => background.key === key);
}
