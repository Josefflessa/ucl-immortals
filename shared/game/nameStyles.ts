// UCL Immortals — cosmetic font styles for the account's display name. The look
// itself lives in the client (components/account/StyledName); this shared list
// is also used by the server to validate unlocks and purchases.

export interface NameStyle {
  key: string;
  name: string;
  /** CSS font-family of the style. */
  font: string;
  /** Google Fonts family query, loaded only when the style is on screen. */
  googleFamily: string;
  /** Present for styles that can be bought with account coins. */
  shopPrice?: number;
}

export const NAME_STYLES: readonly NameStyle[] = [
  { key: 'lendario', name: 'Lendário', font: "'Cinzel Decorative', serif", googleFamily: 'Cinzel+Decorative:wght@900' },
  { key: 'arcade', name: 'Arcade', font: "'Press Start 2P', monospace", googleFamily: 'Press+Start+2P' },
  { key: 'assombrado', name: 'Assombrado', font: "'Creepster', cursive", googleFamily: 'Creepster' },
  { key: 'neon', name: 'Neon', font: "'Bungee Shade', cursive", googleFamily: 'Bungee+Shade' },
  { key: 'pirata', name: 'Pirata', font: "'New Rocker', cursive", googleFamily: 'New+Rocker' },
  { key: 'tatico', name: 'Tático', font: "'Teko', sans-serif", googleFamily: 'Teko:wght@600;700', shopPrice: 200 },
  { key: 'futurista', name: 'Futurista', font: "'Orbitron', sans-serif", googleFamily: 'Orbitron:wght@600;700', shopPrice: 200 },
  { key: 'estadio', name: 'Estádio', font: "'Saira Stencil One', sans-serif", googleFamily: 'Saira+Stencil+One', shopPrice: 200 },
  { key: 'comando', name: 'Comando', font: "'Black Ops One', display", googleFamily: 'Black+Ops+One', shopPrice: 200 },
];

export const NAME_STYLE_BY_KEY = new Map(NAME_STYLES.map(style => [style.key, style]));

export function isNameStyleKey(key: unknown): key is string {
  return typeof key === 'string' && NAME_STYLE_BY_KEY.has(key);
}
