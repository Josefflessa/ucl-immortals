// UCL Immortals — modelo de estádio.
// Fase 1: só existe o estádio padrão. Ele torna tangível a vantagem de casa (+N em todos os
// atributos quando você é o mandante). Fase 2 (Técnico Prime) introduz estádios temáticos.
export type StadiumAttr = 'pace'|'shooting'|'passing'|'dribbling'|'defending'|'physical'|'vision'|'composure';

export interface Stadium {
  id: string;
  name: string;
  photoUrl: string;
  homeAttrBonus: number;          // +N em TODOS os atributos, em casa
  prime?: boolean;
  themedAttrs?: [StadiumAttr, StadiumAttr]; // 2 atributos do tema (só Prime)
  themedClub?: string;            // clube que ganha o buff maior
  themedNation?: string;          // OU nação (Dragão → 'Portugal')
  coachPhotoUrl?: string;         // foto Prime do técnico
}

export const DEFAULT_STADIUM: Stadium = {
  id: 'default',
  name: 'Estádio Padrão',
  photoUrl: '/stadiums/default.webp',
  homeAttrBonus: 3,
};

// Estádios temáticos por técnico (Fase 2). Fotos em client/public/stadiums e /coaches/prime.
export const PRIME_STADIUMS: Record<string, Stadium> = {
  guardiola: { id: 'etihad',      name: 'Etihad',            photoUrl: '/stadiums/etihad.webp',      homeAttrBonus: 6, prime: true, themedAttrs: ['passing', 'vision'],    themedClub: 'Manchester City',   coachPhotoUrl: '/coaches/prime/guardiola.webp' },
  klopp:     { id: 'anfield',     name: 'Anfield',           photoUrl: '/stadiums/anfield.webp',     homeAttrBonus: 6, prime: true, themedAttrs: ['pace', 'physical'],     themedClub: 'Liverpool',         coachPhotoUrl: '/coaches/prime/klopp.webp' },
  ancelotti: { id: 'sansiro',     name: 'San Siro',          photoUrl: '/stadiums/sansiro.webp',     homeAttrBonus: 6, prime: true, themedAttrs: ['passing', 'composure'], themedClub: 'Milan',             coachPhotoUrl: '/coaches/prime/ancelotti.webp' },
  mourinho:  { id: 'dragao',      name: 'Estádio do Dragão', photoUrl: '/stadiums/dragao.webp',      homeAttrBonus: 6, prime: true, themedAttrs: ['defending', 'physical'], themedNation: 'Portugal',       coachPhotoUrl: '/coaches/prime/mourinho.webp' },
  zidane:    { id: 'bernabeu',    name: 'Bernabéu',          photoUrl: '/stadiums/bernabeu.webp',    homeAttrBonus: 6, prime: true, themedAttrs: ['dribbling', 'shooting'], themedClub: 'Real Madrid',      coachPhotoUrl: '/coaches/prime/zidane.webp' },
  ferguson:  { id: 'oldtrafford', name: 'Old Trafford',      photoUrl: '/stadiums/oldtrafford.webp', homeAttrBonus: 6, prime: true, themedAttrs: ['pace', 'shooting'],     themedClub: 'Manchester United', coachPhotoUrl: '/coaches/prime/ferguson.webp' },
};

export function stadiumFor(coachId: string, prime: boolean): Stadium {
  return prime ? (PRIME_STADIUMS[coachId] ?? DEFAULT_STADIUM) : DEFAULT_STADIUM;
}
