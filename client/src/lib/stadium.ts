// UCL Immortals — modelo de estádio.
// O projeto Estádio é a única fonte da vantagem de casa. O nível 5 reutiliza
// a imagem especial que antes era associada ao Técnico Prime, sem importar
// bônus temáticos de clube ou nação.
export type StadiumAttr = 'pace'|'shooting'|'passing'|'dribbling'|'defending'|'physical'|'vision'|'composure';

export interface Stadium {
  id: string;
  name: string;
  photoUrl: string;
  homeAttrBonus: number;          // +N em TODOS os atributos, em casa
  prime?: boolean;
  /** Legacy fields kept so old serialized rooms can still be read; never used by gameplay. */
  themedAttrs?: [StadiumAttr, StadiumAttr];
  themedClub?: string;
  themedNation?: string;
  coachPhotoUrl?: string;         // foto Prime do técnico
}

export const DEFAULT_STADIUM: Stadium = {
  id: 'default',
  name: 'Estádio Padrão',
  photoUrl: '/stadiums/default.webp',
  homeAttrBonus: 3,
};

// Catálogo visual por técnico usado pela imagem especial do nível 5. O valor
// representa o mando do Estádio no nível 5; não há bônus por clube/nação.
export const PRIME_STADIUMS: Record<string, Stadium> = {
  guardiola: { id: 'etihad',      name: 'Etihad',            photoUrl: '/stadiums/etihad.webp',      homeAttrBonus: 11, prime: true, coachPhotoUrl: '/coaches/prime/guardiola.webp' },
  klopp:     { id: 'anfield',     name: 'Anfield',           photoUrl: '/stadiums/anfield.webp',     homeAttrBonus: 11, prime: true, coachPhotoUrl: '/coaches/prime/klopp.webp' },
  ancelotti: { id: 'sansiro',     name: 'San Siro',          photoUrl: '/stadiums/sansiro.webp',     homeAttrBonus: 11, prime: true, coachPhotoUrl: '/coaches/prime/ancelotti.webp' },
  mourinho:  { id: 'dragao',      name: 'Estádio do Dragão', photoUrl: '/stadiums/dragao.webp',      homeAttrBonus: 11, prime: true, coachPhotoUrl: '/coaches/prime/mourinho.webp' },
  zidane:    { id: 'bernabeu',    name: 'Bernabéu',          photoUrl: '/stadiums/bernabeu.webp',    homeAttrBonus: 11, prime: true, coachPhotoUrl: '/coaches/prime/zidane.webp' },
  ferguson:  { id: 'oldtrafford', name: 'Old Trafford',      photoUrl: '/stadiums/oldtrafford.webp', homeAttrBonus: 11, prime: true, coachPhotoUrl: '/coaches/prime/ferguson.webp' },
  luis_enrique: { id: 'parc-des-princes', name: 'Parc des Princes', photoUrl: '/stadiums/parc-des-princes.webp', homeAttrBonus: 11, prime: true, coachPhotoUrl: '/coaches/prime/luis-enrique.webp' },
};

export function stadiumFor(coachId: string, prime: boolean): Stadium {
  return prime ? (PRIME_STADIUMS[coachId] ?? DEFAULT_STADIUM) : DEFAULT_STADIUM;
}

/**
 * Resolves the stadium visual shown by the club UI. Only level 5 unlocks the
 * special stadium image associated with the selected coach. The coach Prime
 * state is intentionally ignored: it no longer changes the stadium.
 */
export function stadiumDisplayFor(coachId: string, _coachPrime: boolean, stadiumProjectLevel = 1): Stadium {
  if (stadiumProjectLevel < 5) return DEFAULT_STADIUM;

  const primeStadium = stadiumFor(coachId, true);
  return {
    ...primeStadium,
    homeAttrBonus: 11,
  };
}
