import type { Player } from './gameData';

/**
 * Cartas históricas selecionadas pelo usuário com retratos locais fornecidos
 * por ele. Os arquivos ficam junto das demais lendas europeias para manter a
 * mesma cadeia de carregamento de imagens do catálogo.
 */
export const USER_SELECTED_HISTORICAL_PLAYERS: Player[] = [
  {
    id: 'crespo', shortName: 'Crespo', fullName: 'Hernán Crespo', position: 'ST',
    nation: 'Argentina', club: 'Inter Milan', season: '2000/01', rarity: 'legendary', overall: 90,
    pace: 88, shooting: 95, passing: 73, dribbling: 85,
    defending: 25, physical: 82, composure: 94, vision: 78,
    traits: [], photoUrl: '/players/euro-legends/crespo.webp',
  },
  {
    id: 'klose', shortName: 'Klose', fullName: 'Miroslav Klose', position: 'ST',
    nation: 'Alemanha', club: 'Bayern Munich', season: '2013/14', rarity: 'legendary', overall: 89,
    pace: 78, shooting: 91, passing: 75, dribbling: 78,
    defending: 28, physical: 78, composure: 94, vision: 80,
    traits: [], photoUrl: '/players/euro-legends/klose.webp',
  },
  {
    id: 'mascherano', shortName: 'Mascherano', fullName: 'Javier Mascherano', position: 'CDM', secondaryPositions: ['CB'],
    nation: 'Argentina', club: 'Barcelona', season: '2010/11', rarity: 'legendary', overall: 93,
    pace: 78, shooting: 38, passing: 88, dribbling: 64,
    defending: 97, physical: 89, composure: 91, vision: 76,
    traits: [], photoUrl: '/players/euro-legends/mascherano.webp',
  },
  {
    id: 'jairzinho', shortName: 'Jairzinho', fullName: 'Jair Ventura Filho', position: 'RW', secondaryPositions: ['ST', 'LW'],
    nation: 'Brasil', club: 'Botafogo', season: '1970', rarity: 'immortal', overall: 95,
    pace: 98, shooting: 94, passing: 88, dribbling: 96,
    defending: 36, physical: 86, composure: 94, vision: 88,
    traits: [], photoUrl: '/players/euro-legends/jairzinho.webp',
  },
  {
    id: 'baggio', shortName: 'Baggio', fullName: 'Roberto Baggio', position: 'CAM', secondaryPositions: ['ST'],
    nation: 'Itália', club: 'Juventus', season: '1992/93', rarity: 'immortal', overall: 94,
    pace: 83, shooting: 94, passing: 96, dribbling: 97,
    defending: 30, physical: 64, composure: 99, vision: 99,
    traits: [], photoUrl: '/players/euro-legends/baggio.webp',
  },
];
