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
  { key: 'cover-13', name: 'Baleia nas nuvens', src: '/profile-covers/sky-whale.webp' },
  { key: 'cover-14', name: 'Vórtice de lava', src: '/profile-covers/lava-vortex.webp' },
  { key: 'cover-15', name: 'Cúpula submersa', src: '/profile-covers/sunken-dome.webp' },
  { key: 'cover-16', name: 'Salão do trono', src: '/profile-covers/throne-hall.webp' },
  { key: 'cover-17', name: 'Templo em ruínas', src: '/profile-covers/temple-ruins.webp' },
  { key: 'cover-18', name: 'Grande biblioteca', src: '/profile-covers/grand-library.webp' },
  { key: 'cover-19', name: 'Ponte do castelo', src: '/profile-covers/castle-bridge.webp' },
  { key: 'cover-20', name: 'Pé de feijão', src: '/profile-covers/beanstalk-sky.webp' },
  { key: 'cover-21', name: 'Janela na chuva', src: '/profile-covers/rainy-window.webp' },
  { key: 'cover-22', name: 'Pântano ao crepúsculo', src: '/profile-covers/twilight-swamp.webp' },
  { key: 'cover-23', name: 'Janela da nave', src: '/profile-covers/starship-window.webp' },
  { key: 'cover-24', name: 'Estaleiro espacial', src: '/profile-covers/space-shipyard.webp' },
] as const;

export function getProfileCover(key: string) {
  return PROFILE_COVER_PRESETS.find(cover => cover.key === key) ?? PROFILE_COVER_PRESETS[0];
}
