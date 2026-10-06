// UCL Immortals — name styles: a cosmetic font + effect for the account's display
// name, unlocked as event rewards. The look itself lives in the client
// (components/account/StyledName); this is the shared list the server validates.

export interface NameStyle {
  key: string;
  name: string;
  /** CSS font-family of the style. */
  font: string;
  /** Google Fonts family query, loaded only when the style is on screen. */
  googleFamily: string;
}

export const NAME_STYLES: readonly NameStyle[] = [
  { key: 'lendario', name: 'Lendário', font: "'Cinzel Decorative', serif", googleFamily: 'Cinzel+Decorative:wght@900' },
  { key: 'arcade', name: 'Arcade', font: "'Press Start 2P', monospace", googleFamily: 'Press+Start+2P' },
  { key: 'assombrado', name: 'Assombrado', font: "'Creepster', cursive", googleFamily: 'Creepster' },
  { key: 'neon', name: 'Neon', font: "'Bungee Shade', cursive", googleFamily: 'Bungee+Shade' },
  { key: 'pirata', name: 'Pirata', font: "'New Rocker', cursive", googleFamily: 'New+Rocker' },
];

export const NAME_STYLE_BY_KEY = new Map(NAME_STYLES.map(style => [style.key, style]));

export function isNameStyleKey(key: unknown): key is string {
  return typeof key === 'string' && NAME_STYLE_BY_KEY.has(key);
}
