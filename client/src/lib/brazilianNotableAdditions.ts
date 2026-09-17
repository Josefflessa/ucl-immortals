import type { Player } from './gameData';

/**
 * Notable players added from the current Brazilian first-division squads.
 *
 * These are regular cards, kept separate from the existing starter snapshot
 * so future squad additions can be audited without touching that dataset.
 * Sortitoutsi is used only as a discovery/reference source; the game uses
 * local data and local portraits at runtime.
 */
const regularPlayer = (player: Omit<Player, 'traits'>): Player => ({
  ...player,
  traits: [],
});

export const BRAZILIAN_NOTABLE_ADDITIONS: Player[] = [
  // Flamengo
  regularPlayer({
    id: 'carrascal', shortName: 'Carrascal', fullName: 'Jorge Carrascal', position: 'CAM',
    secondaryPositions: ['RW', 'LW'], nation: 'Colômbia', club: 'Flamengo', season: '2025/26',
    rarity: 'gold', overall: 83, pace: 84, shooting: 75, passing: 83, dribbling: 87, defending: 35, physical: 66, composure: 79, vision: 84,
  }),
  regularPlayer({
    id: 'vitao_flamengo', shortName: 'Vitão', fullName: 'Vitão', position: 'CB',
    secondaryPositions: [], nation: 'Brasil', club: 'Flamengo', season: '2025/26',
    rarity: 'gold', overall: 82, pace: 77, shooting: 31, passing: 65, dribbling: 44, defending: 85, physical: 82, composure: 78, vision: 42,
  }),
  regularPlayer({
    id: 'rossi_flamengo', shortName: 'Rossi', fullName: 'Agustín Rossi', position: 'GK',
    secondaryPositions: [], nation: 'Argentina', club: 'Flamengo', season: '2025/26',
    rarity: 'gold', overall: 82, pace: 45, shooting: 18, passing: 54, dribbling: 25, defending: 87, physical: 73, composure: 84, vision: 65,
  }),
  regularPlayer({
    id: 'luiz_araujo_flamengo', shortName: 'Luiz Araújo', fullName: 'Luiz Araújo', position: 'RW',
    secondaryPositions: ['LW'], nation: 'Brasil', club: 'Flamengo', season: '2025/26',
    rarity: 'gold', overall: 82, pace: 86, shooting: 78, passing: 74, dribbling: 84, defending: 30, physical: 63, composure: 78, vision: 75,
  }),
  regularPlayer({
    id: 'gonzalo_plata', shortName: 'Gonzalo Plata', fullName: 'Gonzalo Plata', position: 'RW',
    secondaryPositions: ['LW', 'ST'], nation: 'Equador', club: 'Flamengo', season: '2025/26',
    rarity: 'gold', overall: 81, pace: 89, shooting: 73, passing: 74, dribbling: 86, defending: 30, physical: 64, composure: 75, vision: 73,
  }),
  regularPlayer({
    id: 'emerson_royal', shortName: 'Emerson Royal', fullName: 'Emerson Royal', position: 'RB',
    secondaryPositions: [], nation: 'Brasil', club: 'Flamengo', season: '2025/26',
    rarity: 'silver', overall: 80, pace: 83, shooting: 34, passing: 70, dribbling: 69, defending: 78, physical: 79, composure: 76, vision: 53,
  }),
  regularPlayer({
    id: 'bruno_henrique', shortName: 'Bruno Henrique', fullName: 'Bruno Henrique', position: 'LW',
    secondaryPositions: ['ST', 'RW'], nation: 'Brasil', club: 'Flamengo', season: '2025/26',
    rarity: 'gold', overall: 82, pace: 86, shooting: 85, passing: 75, dribbling: 85, defending: 28, physical: 76, composure: 85, vision: 70,
  }),

  // Palmeiras
  regularPlayer({
    id: 'lucas_evangelista', shortName: 'Lucas Evangelista', fullName: 'Lucas Evangelista', position: 'CDM',
    secondaryPositions: ['CM'], nation: 'Brasil', club: 'Palmeiras', season: '2025/26',
    rarity: 'silver', overall: 80, pace: 62, shooting: 57, passing: 81, dribbling: 75, defending: 62, physical: 70, composure: 80, vision: 84,
  }),
  regularPlayer({
    id: 'murilo_palmeiras', shortName: 'Murilo', fullName: 'Murilo', position: 'CB',
    secondaryPositions: [], nation: 'Brasil', club: 'Palmeiras', season: '2025/26',
    rarity: 'gold', overall: 82, pace: 70, shooting: 34, passing: 63, dribbling: 54, defending: 86, physical: 82, composure: 81, vision: 46,
  }),
  regularPlayer({
    id: 'khellven', shortName: 'Khellven', fullName: 'Khellven', position: 'RB',
    secondaryPositions: [], nation: 'Brasil', club: 'Palmeiras', season: '2025/26',
    rarity: 'silver', overall: 79, pace: 90, shooting: 37, passing: 68, dribbling: 72, defending: 68, physical: 66, composure: 68, vision: 50,
  }),
  regularPlayer({
    id: 'agustin_giay', shortName: 'Giay', fullName: 'Agustín Giay', position: 'RB',
    secondaryPositions: [], nation: 'Argentina', club: 'Palmeiras', season: '2025/26',
    rarity: 'silver', overall: 77, pace: 82, shooting: 34, passing: 67, dribbling: 72, defending: 67, physical: 64, composure: 70, vision: 49,
  }),
  regularPlayer({
    id: 'luighi', shortName: 'Luighi', fullName: 'Luighi', position: 'LW',
    secondaryPositions: ['ST'], nation: 'Brasil', club: 'Palmeiras', season: '2025/26',
    rarity: 'silver', overall: 76, pace: 82, shooting: 70, passing: 52, dribbling: 75, defending: 24, physical: 62, composure: 63, vision: 44,
  }),

  // Botafogo
  regularPlayer({
    id: 'cristian_medina', shortName: 'Cristian Medina', fullName: 'Cristian Medina', position: 'CAM',
    secondaryPositions: ['CM', 'RW'], nation: 'Argentina', club: 'Botafogo', season: '2025/26',
    rarity: 'gold', overall: 81, pace: 79, shooting: 57, passing: 77, dribbling: 78, defending: 54, physical: 70, composure: 77, vision: 78,
  }),
  regularPlayer({
    id: 'santiago_rodriguez', shortName: 'Santiago Rodríguez', fullName: 'Santiago Rodríguez', position: 'CAM',
    secondaryPositions: [], nation: 'Uruguai', club: 'Botafogo', season: '2025/26',
    rarity: 'gold', overall: 81, pace: 80, shooting: 62, passing: 82, dribbling: 85, defending: 28, physical: 54, composure: 73, vision: 84,
  }),
  regularPlayer({
    id: 'junior_santos', shortName: 'Júnior Santos', fullName: 'Júnior Santos', position: 'RW',
    secondaryPositions: ['ST', 'LW'], nation: 'Brasil', club: 'Botafogo', season: '2025/26',
    rarity: 'silver', overall: 79, pace: 88, shooting: 74, passing: 63, dribbling: 79, defending: 25, physical: 84, composure: 78, vision: 55,
  }),
  regularPlayer({
    id: 'alvaro_montoro', shortName: 'Álvaro Montoro', fullName: 'Álvaro Montoro', position: 'CAM',
    secondaryPositions: ['RW', 'LW'], nation: 'Argentina', club: 'Botafogo', season: '2025/26',
    rarity: 'silver', overall: 75, pace: 77, shooting: 55, passing: 70, dribbling: 79, defending: 25, physical: 51, composure: 62, vision: 76,
  }),
  regularPlayer({
    id: 'matheus_martins_botafogo', shortName: 'Matheus Martins', fullName: 'Matheus Martins', position: 'LW',
    secondaryPositions: ['RW', 'ST'], nation: 'Brasil', club: 'Botafogo', season: '2025/26',
    rarity: 'silver', overall: 79, pace: 85, shooting: 69, passing: 68, dribbling: 82, defending: 28, physical: 59, composure: 75, vision: 65,
  }),

  // Atlético Mineiro
  regularPlayer({
    id: 'alexsander_atletico', shortName: 'Alexsander', fullName: 'Alexsander', position: 'LB',
    secondaryPositions: ['CDM'], nation: 'Brasil', club: 'Atlético Mineiro', season: '2025/26',
    rarity: 'silver', overall: 79, pace: 78, shooting: 34, passing: 67, dribbling: 64, defending: 73, physical: 75, composure: 72, vision: 50,
  }),
  regularPlayer({
    id: 'igor_gomes_atletico', shortName: 'Igor Gomes', fullName: 'Igor Gomes', position: 'CAM',
    secondaryPositions: ['CM', 'LW'], nation: 'Brasil', club: 'Atlético Mineiro', season: '2025/26',
    rarity: 'silver', overall: 77, pace: 63, shooting: 51, passing: 73, dribbling: 72, defending: 36, physical: 54, composure: 70, vision: 72,
  }),
  regularPlayer({
    id: 'reinier', shortName: 'Reinier', fullName: 'Reinier', position: 'CAM',
    secondaryPositions: ['LW', 'ST'], nation: 'Brasil', club: 'Atlético Mineiro', season: '2025/26',
    rarity: 'silver', overall: 78, pace: 70, shooting: 61, passing: 70, dribbling: 76, defending: 27, physical: 59, composure: 72, vision: 76,
  }),

  // São Paulo
  regularPlayer({
    id: 'rafael_toloi', shortName: 'Rafael Tolói', fullName: 'Rafael Tolói', position: 'CB',
    secondaryPositions: ['RB'], nation: 'Itália', club: 'São Paulo', season: '2025/26',
    rarity: 'silver', overall: 76, pace: 53, shooting: 29, passing: 65, dribbling: 40, defending: 77, physical: 69, composure: 79, vision: 39,
  }),
  regularPlayer({
    id: 'ferreirinha', shortName: 'Ferreirinha', fullName: 'Ferreirinha', position: 'LW',
    secondaryPositions: ['RW', 'ST'], nation: 'Brasil', club: 'São Paulo', season: '2025/26',
    rarity: 'silver', overall: 80, pace: 91, shooting: 71, passing: 67, dribbling: 86, defending: 24, physical: 54, composure: 73, vision: 63,
  }),
  regularPlayer({
    id: 'andre_silva', shortName: 'André Silva', fullName: 'André Silva', position: 'ST',
    secondaryPositions: ['LW', 'RW'], nation: 'Brasil', club: 'São Paulo', season: '2025/26',
    rarity: 'silver', overall: 78, pace: 80, shooting: 76, passing: 58, dribbling: 72, defending: 24, physical: 70, composure: 75, vision: 45,
  }),

  // Fluminense
  regularPlayer({
    id: 'rodrigo_castillo', shortName: 'Rodrigo Castillo', fullName: 'Rodrigo Castillo', position: 'ST',
    secondaryPositions: [], nation: 'Argentina', club: 'Fluminense', season: '2025/26',
    rarity: 'silver', overall: 79, pace: 75, shooting: 77, passing: 51, dribbling: 62, defending: 22, physical: 82, composure: 75, vision: 39,
  }),
  regularPlayer({
    id: 'juan_pablo_freytes', shortName: 'Freytes', fullName: 'Juan Pablo Freytes', position: 'CB',
    secondaryPositions: ['LB'], nation: 'Argentina', club: 'Fluminense', season: '2025/26',
    rarity: 'silver', overall: 76, pace: 67, shooting: 30, passing: 58, dribbling: 39, defending: 76, physical: 74, composure: 69, vision: 37,
  }),
  regularPlayer({
    id: 'julian_millan', shortName: 'Julián Millán', fullName: 'Julián Millán', position: 'CB',
    secondaryPositions: [], nation: 'Colômbia', club: 'Fluminense', season: '2025/26',
    rarity: 'silver', overall: 76, pace: 69, shooting: 28, passing: 60, dribbling: 39, defending: 74, physical: 72, composure: 72, vision: 39,
  }),
  regularPlayer({
    id: 'alisson_fluminense', shortName: 'Alisson', fullName: 'Alisson', position: 'CDM',
    secondaryPositions: ['CM'], nation: 'Brasil', club: 'Fluminense', season: '2025/26',
    rarity: 'silver', overall: 78, pace: 63, shooting: 50, passing: 77, dribbling: 68, defending: 62, physical: 64, composure: 77, vision: 74,
  }),
];
