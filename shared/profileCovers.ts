export interface ProfileCoverPreset {
  key: string;
  name: string;
  src: string;
  /** Absent for cover presets that remain free. */
  shopPrice?: number;
}

/** The original profile covers, with the account's starter options kept free. */
export const PROFILE_COVER_PRESETS: readonly ProfileCoverPreset[] = [
  { key: 'cover-01', name: 'Cidade futurista', src: '/profile-covers/city-lights.webp' },
  { key: 'cover-02', name: 'Bosque nevado', src: '/profile-covers/snow-grove.webp' },
  { key: 'cover-03', name: 'Observatório', src: '/profile-covers/stargazer-tower.webp' },
  { key: 'cover-04', name: 'Mercado nas nuvens', src: '/profile-covers/cloud-market.webp', shopPrice: 250 },
  { key: 'cover-05', name: 'Cachoeira lunar', src: '/profile-covers/moonfall.webp', shopPrice: 250 },
  { key: 'cover-06', name: 'Salão de inverno', src: '/profile-covers/frost-hall.webp', shopPrice: 250 },
  { key: 'cover-07', name: 'Tesouro do dragão', src: '/profile-covers/dragon-hoard.webp', shopPrice: 250 },
  { key: 'cover-08', name: 'Cemitério sob a lua', src: '/profile-covers/graveyard.webp' },
  { key: 'cover-09', name: 'Porto ao entardecer', src: '/profile-covers/sunset-harbor.webp' },
  { key: 'cover-10', name: 'Cripta antiga', src: '/profile-covers/crypt.webp', shopPrice: 250 },
  { key: 'cover-11', name: 'Cachoeira na floresta', src: '/profile-covers/jungle-falls.webp' },
  { key: 'cover-12', name: 'Árvore neon', src: '/profile-covers/neon-tree.webp', shopPrice: 250 },
  { key: 'cover-13', name: 'Baleia nas nuvens', src: '/profile-covers/sky-whale.webp', shopPrice: 250 },
  { key: 'cover-14', name: 'Vórtice de lava', src: '/profile-covers/lava-vortex.webp', shopPrice: 250 },
  { key: 'cover-15', name: 'Cúpula submersa', src: '/profile-covers/sunken-dome.webp' },
  { key: 'cover-16', name: 'Salão do trono', src: '/profile-covers/throne-hall.webp', shopPrice: 250 },
  { key: 'cover-17', name: 'Templo em ruínas', src: '/profile-covers/temple-ruins.webp', shopPrice: 250 },
  { key: 'cover-18', name: 'Grande biblioteca', src: '/profile-covers/grand-library.webp', shopPrice: 250 },
  { key: 'cover-19', name: 'Ponte do castelo', src: '/profile-covers/castle-bridge.webp' },
  { key: 'cover-20', name: 'Pé de feijão', src: '/profile-covers/beanstalk-sky.webp', shopPrice: 250 },
  { key: 'cover-21', name: 'Janela na chuva', src: '/profile-covers/rainy-window.webp', shopPrice: 250 },
  { key: 'cover-22', name: 'Pântano ao crepúsculo', src: '/profile-covers/twilight-swamp.webp', shopPrice: 250 },
  { key: 'cover-23', name: 'Janela da nave', src: '/profile-covers/starship-window.webp', shopPrice: 250 },
  { key: 'cover-24', name: 'Estaleiro espacial', src: '/profile-covers/space-shipyard.webp', shopPrice: 250 },
];

export const PROFILE_COVER_BY_KEY = new Map(PROFILE_COVER_PRESETS.map(cover => [cover.key, cover]));

export function getProfileCover(key: string) {
  return PROFILE_COVER_BY_KEY.get(key) ?? PROFILE_COVER_PRESETS[0];
}

export function isProfileCoverKey(key: unknown): key is string {
  return typeof key === 'string' && PROFILE_COVER_BY_KEY.has(key);
}
