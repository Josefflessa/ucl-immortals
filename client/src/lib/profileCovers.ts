export const PROFILE_COVER_PRESETS = [
  { key: 'cover-01', name: 'Cidade futurista', src: '/profile-covers/city-lights.webp' },
  { key: 'cover-02', name: 'Bosque nevado', src: '/profile-covers/snow-grove.webp' },
  { key: 'cover-03', name: 'Observatório', src: '/profile-covers/stargazer-tower.webp' },
  { key: 'cover-04', name: 'Mercado nas nuvens', src: '/profile-covers/cloud-market.webp' },
  { key: 'cover-05', name: 'Cachoeira lunar', src: '/profile-covers/moonfall.webp' },
  { key: 'cover-06', name: 'Salão de inverno', src: '/profile-covers/frost-hall.webp' },
  { key: 'cover-07', name: 'Tesouro do dragão', src: '/profile-covers/dragon-hoard.webp' },
  { key: 'cover-08', name: 'Cemitério sob a lua', src: '/profile-covers/graveyard.webp' },
  { key: 'cover-09', name: 'Porto ao entardecer', src: '/profile-covers/sunset-harbor.webp' },
  { key: 'cover-10', name: 'Cripta antiga', src: '/profile-covers/crypt.webp' },
  { key: 'cover-11', name: 'Cachoeira na floresta', src: '/profile-covers/jungle-falls.webp' },
  { key: 'cover-12', name: 'Árvore neon', src: '/profile-covers/neon-tree.webp' },
] as const;

export function getProfileCover(key: string) {
  return PROFILE_COVER_PRESETS.find(cover => cover.key === key) ?? PROFILE_COVER_PRESETS[0];
}
