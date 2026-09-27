import type { Player } from './gameData';

/**
 * Lendas europeias das principais ligas (anos 90 até hoje) ainda ausentes do
 * catálogo, pesquisadas no SortitoutSI. Cada retrato foi verificado
 * individualmente (nome, nacionalidade e data de nascimento reais batendo
 * com o perfil do site) E checado visualmente — mantidos só os que
 * realmente mostram a pessoa na época de jogador, não uma foto atual de
 * comissão técnica/embaixador/comentarista.
 */
export const SORTITOUTSI_EUROPEAN_LEGENDS: Player[] = [
  {
    id: 'yaya_toure', shortName: 'Yaya Touré', fullName: 'Yaya Touré', position: 'CDM', secondaryPositions: ['CM'],
    nation: 'Costa do Marfim', club: 'Manchester City', season: '2013/14', rarity: 'legendary', overall: 89,
    pace: 78, shooting: 68, passing: 87, dribbling: 80,
    defending: 83, physical: 90, composure: 92, vision: 88,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_yaya_toure.webp',
  },
  {
    id: 'trezeguet', shortName: 'David Trezeguet', fullName: 'David Trezeguet', position: 'ST',
    nation: 'França', club: 'Juventus', season: '2002/03', rarity: 'gold', overall: 87,
    pace: 89, shooting: 90, passing: 75, dribbling: 89,
    defending: 44, physical: 87, composure: 91, vision: 82,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_trezeguet.webp',
  },
  {
    id: 'godin', shortName: 'Diego Godín', fullName: 'Diego Godín', position: 'CB',
    nation: 'Uruguai', club: 'Atlético Madrid', season: '2013/14', rarity: 'gold', overall: 87,
    pace: 76, shooting: 37, passing: 78, dribbling: 61,
    defending: 90, physical: 86, composure: 77, vision: 70,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_godin.webp',
  },
  {
    id: 'rakitic', shortName: 'Ivan Rakitić', fullName: 'Ivan Rakitić', position: 'CM',
    nation: 'Croácia', club: 'Barcelona', season: '2014/15', rarity: 'gold', overall: 87,
    pace: 85, shooting: 70, passing: 92, dribbling: 79,
    defending: 70, physical: 85, composure: 83, vision: 88,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_rakitic.webp',
  },
  {
    id: 'kounde', shortName: 'Jules Koundé', fullName: 'Jules Koundé', position: 'CB', secondaryPositions: ['RB'],
    nation: 'França', club: 'Barcelona', season: '2024/25', rarity: 'gold', overall: 85,
    pace: 78, shooting: 45, passing: 70, dribbling: 59,
    defending: 83, physical: 85, composure: 82, vision: 59,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_kounde.webp',
  },
  {
    id: 'thomas_muller', shortName: 'Thomas Müller', fullName: 'Thomas Müller', position: 'CAM', secondaryPositions: ['ST'],
    nation: 'Alemanha', club: 'Bayern Munich', season: '2013/14', rarity: 'legendary', overall: 88,
    pace: 88, shooting: 77, passing: 92, dribbling: 94,
    defending: 48, physical: 76, composure: 88, vision: 97,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_thomas_muller.webp',
  },
  {
    id: 'gotze', shortName: 'Mario Götze', fullName: 'Mario Götze', position: 'CAM',
    nation: 'Alemanha', club: 'Borussia Dortmund', season: '2012/13', rarity: 'gold', overall: 86,
    pace: 80, shooting: 75, passing: 85, dribbling: 93,
    defending: 53, physical: 76, composure: 83, vision: 87,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_gotze.webp',
  },
  {
    id: 'jesus_navas', shortName: 'Jesús Navas', fullName: 'Jesús Navas', position: 'RW', secondaryPositions: ['RB'],
    nation: 'Espanha', club: 'Sevilla', season: '2006/07', rarity: 'gold', overall: 84,
    pace: 88, shooting: 74, passing: 85, dribbling: 93,
    defending: 45, physical: 75, composure: 78, vision: 77,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_jesus_navas.webp',
  },
  {
    id: 'kanoute', shortName: 'Frédéric Kanouté', fullName: 'Frédéric Kanouté', position: 'ST',
    nation: 'Mali', club: 'Sevilla', season: '2006/07', rarity: 'gold', overall: 85,
    pace: 87, shooting: 85, passing: 78, dribbling: 89,
    defending: 41, physical: 81, composure: 82, vision: 70,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_kanoute.webp',
  },
  {
    id: 'aimar', shortName: 'Pablo Aimar', fullName: 'Pablo Aimar', position: 'CAM',
    nation: 'Argentina', club: 'Valencia', season: '2003/04', rarity: 'gold', overall: 86,
    pace: 80, shooting: 75, passing: 85, dribbling: 93,
    defending: 53, physical: 76, composure: 83, vision: 87,
    traits: [],
    photoUrl: '/players/euro-legends/futwiz_aimar.webp',
  },
  {
    id: 'gerd_muller', shortName: 'Gerd Müller', fullName: 'Gerd Müller', position: 'ST',
    nation: 'Alemanha', club: 'Bayern Munich', season: '1972/73', rarity: 'immortal', overall: 95,
    pace: 94, shooting: 99, passing: 85, dribbling: 96,
    defending: 48, physical: 88, composure: 99, vision: 88,
    traits: [],
    photoUrl: '/players/euro-legends/sortitoutsi_3600230.webp',
  },
];
