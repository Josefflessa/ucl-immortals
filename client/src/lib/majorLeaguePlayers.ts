import type { Player } from './gameData';

/**
 * Curated additions from the first-team squads of major European clubs.
 *
 * Sortitoutsi is used only as the discovery/reference source here. These
 * players are copied into the game's own schema and remain fully offline;
 * no external identifiers or runtime requests are required.
 */
const regularPlayer = (player: Omit<Player, 'traits'>): Player => ({
  ...player,
  traits: [],
});

export const MAJOR_LEAGUE_ADDITIONS: Player[] = [
  // Manchester City
  regularPlayer({
    id: 'doku', shortName: 'Doku', fullName: 'Jérémy Doku', position: 'RW',
    secondaryPositions: ['LW', 'ST'], nation: 'Bélgica', club: 'Manchester City', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 94, shooting: 73, passing: 75, dribbling: 91, defending: 35, physical: 67, composure: 78, vision: 80,
  }),
  regularPlayer({
    id: 'marmoush', shortName: 'Marmoush', fullName: 'Omar Marmoush', position: 'LW',
    secondaryPositions: ['ST', 'RW'], nation: 'Egito', club: 'Manchester City', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 90, shooting: 84, passing: 73, dribbling: 86, defending: 36, physical: 72, composure: 82, vision: 78,
  }),
  regularPlayer({
    id: 'stones', shortName: 'Stones', fullName: 'John Stones', position: 'CB',
    secondaryPositions: ['CDM'], nation: 'Inglaterra', club: 'Manchester City', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 73, shooting: 45, passing: 80, dribbling: 66, defending: 86, physical: 81, composure: 85, vision: 77,
  }),
  regularPlayer({
    id: 'cherki', shortName: 'Cherki', fullName: 'Rayan Cherki', position: 'CAM',
    secondaryPositions: ['RW', 'LW', 'ST'], nation: 'França', club: 'Manchester City', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 84, shooting: 79, passing: 87, dribbling: 90, defending: 32, physical: 57, composure: 79, vision: 89,
  }),
  regularPlayer({
    id: 'gvardiol', shortName: 'Gvardiol', fullName: 'Joško Gvardiol', position: 'CB',
    secondaryPositions: ['LB'], nation: 'Croácia', club: 'Manchester City', season: '2025/26',
    rarity: 'gold', overall: 87, pace: 85, shooting: 54, passing: 79, dribbling: 71, defending: 88, physical: 82, composure: 83, vision: 67,
  }),
  regularPlayer({
    id: 'reijnders', shortName: 'Reijnders', fullName: 'Tijjani Reijnders', position: 'CM',
    secondaryPositions: ['CDM', 'CAM'], nation: 'Holanda', club: 'Manchester City', season: '2025/26',
    rarity: 'gold', overall: 86, pace: 82, shooting: 70, passing: 84, dribbling: 85, defending: 62, physical: 75, composure: 82, vision: 84,
  }),

  // Real Madrid
  regularPlayer({
    id: 'valverde', shortName: 'Valverde', fullName: 'Federico Valverde', position: 'CM',
    secondaryPositions: ['CDM', 'RM'], nation: 'Uruguai', club: 'Real Madrid', season: '2025/26',
    rarity: 'gold', overall: 89, pace: 88, shooting: 78, passing: 85, dribbling: 82, defending: 77, physical: 86, composure: 85, vision: 82,
  }),
  regularPlayer({
    id: 'tchouameni', shortName: 'Tchouaméni', fullName: 'Aurélien Tchouaméni', position: 'CDM',
    secondaryPositions: ['CB'], nation: 'França', club: 'Real Madrid', season: '2025/26',
    rarity: 'gold', overall: 86, pace: 75, shooting: 54, passing: 82, dribbling: 72, defending: 87, physical: 83, composure: 82, vision: 80,
  }),
  regularPlayer({
    id: 'camavinga', shortName: 'Camavinga', fullName: 'Eduardo Camavinga', position: 'CDM',
    secondaryPositions: ['LB', 'CM'], nation: 'França', club: 'Real Madrid', season: '2025/26',
    rarity: 'gold', overall: 86, pace: 83, shooting: 55, passing: 79, dribbling: 83, defending: 80, physical: 78, composure: 82, vision: 77,
  }),
  regularPlayer({
    id: 'brahim_diaz', shortName: 'Brahim', fullName: 'Brahim Díaz', position: 'CAM',
    secondaryPositions: ['RW', 'LW'], nation: 'Marrocos', club: 'Real Madrid', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 84, shooting: 72, passing: 82, dribbling: 88, defending: 35, physical: 56, composure: 84, vision: 85,
  }),
  regularPlayer({
    id: 'ferland_mendy', shortName: 'Mendy', fullName: 'Ferland Mendy', position: 'LB',
    secondaryPositions: [], nation: 'França', club: 'Real Madrid', season: '2025/26',
    rarity: 'silver', overall: 83, pace: 88, shooting: 39, passing: 73, dribbling: 77, defending: 81, physical: 80, composure: 78, vision: 60,
  }),

  // Bayern Munich
  regularPlayer({
    id: 'luis_diaz', shortName: 'Luis Díaz', fullName: 'Luis Díaz', position: 'LW',
    secondaryPositions: ['RW'], nation: 'Colômbia', club: 'Bayern Munich', season: '2025/26',
    rarity: 'gold', overall: 87, pace: 91, shooting: 82, passing: 78, dribbling: 90, defending: 42, physical: 70, composure: 79, vision: 78,
  }),
  regularPlayer({
    id: 'upamecano', shortName: 'Upamecano', fullName: 'Dayot Upamecano', position: 'CB',
    secondaryPositions: [], nation: 'França', club: 'Bayern Munich', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 84, shooting: 43, passing: 72, dribbling: 62, defending: 85, physical: 84, composure: 77, vision: 55,
  }),
  regularPlayer({
    id: 'jonathan_tah', shortName: 'Tah', fullName: 'Jonathan Tah', position: 'CB',
    secondaryPositions: [], nation: 'Alemanha', club: 'Bayern Munich', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 66, shooting: 39, passing: 71, dribbling: 55, defending: 86, physical: 84, composure: 84, vision: 53,
  }),
  regularPlayer({
    id: 'alphonso_davies', shortName: 'Davies', fullName: 'Alphonso Davies', position: 'LB',
    secondaryPositions: ['LW'], nation: 'Canadá', club: 'Bayern Munich', season: '2025/26',
    rarity: 'gold', overall: 87, pace: 95, shooting: 48, passing: 78, dribbling: 82, defending: 78, physical: 78, composure: 77, vision: 69,
  }),
  regularPlayer({
    id: 'gnabry', shortName: 'Gnabry', fullName: 'Serge Gnabry', position: 'RW',
    secondaryPositions: ['LW', 'ST'], nation: 'Alemanha', club: 'Bayern Munich', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 85, shooting: 82, passing: 76, dribbling: 86, defending: 32, physical: 67, composure: 77, vision: 75,
  }),

  // Liverpool
  regularPlayer({
    id: 'isak', shortName: 'Isak', fullName: 'Alexander Isak', position: 'ST',
    secondaryPositions: ['LW'], nation: 'Suécia', club: 'Liverpool', season: '2025/26',
    rarity: 'gold', overall: 88, pace: 89, shooting: 88, passing: 73, dribbling: 86, defending: 29, physical: 74, composure: 86, vision: 69,
  }),
  regularPlayer({
    id: 'mac_allister', shortName: 'Mac Allister', fullName: 'Alexis Mac Allister', position: 'CM',
    secondaryPositions: ['CDM', 'CAM'], nation: 'Argentina', club: 'Liverpool', season: '2025/26',
    rarity: 'gold', overall: 86, pace: 71, shooting: 73, passing: 88, dribbling: 85, defending: 67, physical: 66, composure: 89, vision: 88,
  }),
  regularPlayer({
    id: 'szoboszlai', shortName: 'Szoboszlai', fullName: 'Dominik Szoboszlai', position: 'CM',
    secondaryPositions: ['CAM', 'RM'], nation: 'Hungria', club: 'Liverpool', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 82, shooting: 74, passing: 82, dribbling: 78, defending: 61, physical: 81, composure: 83, vision: 84,
  }),
  regularPlayer({
    id: 'konate', shortName: 'Konaté', fullName: 'Ibrahima Konaté', position: 'CB',
    secondaryPositions: [], nation: 'França', club: 'Liverpool', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 80, shooting: 37, passing: 66, dribbling: 54, defending: 88, physical: 89, composure: 82, vision: 50,
  }),
  regularPlayer({
    id: 'kerkez', shortName: 'Kerkez', fullName: 'Miloš Kerkez', position: 'LB',
    secondaryPositions: ['LM'], nation: 'Hungria', club: 'Liverpool', season: '2025/26',
    rarity: 'silver', overall: 83, pace: 89, shooting: 43, passing: 71, dribbling: 76, defending: 75, physical: 76, composure: 74, vision: 62,
  }),
  regularPlayer({
    id: 'gakpo', shortName: 'Gakpo', fullName: 'Cody Gakpo', position: 'LW',
    secondaryPositions: ['ST', 'RW'], nation: 'Holanda', club: 'Liverpool', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 83, shooting: 82, passing: 77, dribbling: 84, defending: 36, physical: 75, composure: 82, vision: 74,
  }),

  // Paris Saint-Germain
  regularPlayer({
    id: 'nuno_mendes', shortName: 'Nuno Mendes', fullName: 'Nuno Mendes', position: 'LB',
    secondaryPositions: [], nation: 'Portugal', club: 'PSG', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 93, shooting: 41, passing: 80, dribbling: 83, defending: 79, physical: 77, composure: 78, vision: 68,
  }),
  regularPlayer({
    id: 'kvaratskhelia', shortName: 'Kvaratskhelia', fullName: 'Khvicha Kvaratskhelia', position: 'LW',
    secondaryPositions: ['CAM', 'LM'], nation: 'Geórgia', club: 'PSG', season: '2025/26',
    rarity: 'gold', overall: 88, pace: 89, shooting: 83, passing: 79, dribbling: 94, defending: 38, physical: 68, composure: 82, vision: 82,
  }),

  // Inter Milan
  regularPlayer({
    id: 'dumfries', shortName: 'Dumfries', fullName: 'Denzel Dumfries', position: 'RB',
    secondaryPositions: ['RM'], nation: 'Holanda', club: 'Inter Milan', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 88, shooting: 59, passing: 71, dribbling: 76, defending: 78, physical: 85, composure: 82, vision: 64,
  }),
  regularPlayer({
    id: 'akanji', shortName: 'Akanji', fullName: 'Manuel Akanji', position: 'CB',
    secondaryPositions: ['RB'], nation: 'Suíça', club: 'Inter Milan', season: '2025/26',
    rarity: 'gold', overall: 85, pace: 82, shooting: 38, passing: 70, dribbling: 59, defending: 84, physical: 82, composure: 82, vision: 56,
  }),
  regularPlayer({
    id: 'zielinski', shortName: 'Zieliński', fullName: 'Piotr Zieliński', position: 'CM',
    secondaryPositions: ['CAM'], nation: 'Polônia', club: 'Inter Milan', season: '2025/26',
    rarity: 'silver', overall: 83, pace: 70, shooting: 67, passing: 85, dribbling: 82, defending: 57, physical: 61, composure: 85, vision: 88,
  }),
  regularPlayer({
    id: 'carlos_augusto', shortName: 'Carlos Augusto', fullName: 'Carlos Augusto', position: 'LB',
    secondaryPositions: ['CB', 'LM'], nation: 'Brasil', club: 'Inter Milan', season: '2025/26',
    rarity: 'silver', overall: 82, pace: 82, shooting: 52, passing: 73, dribbling: 78, defending: 72, physical: 75, composure: 79, vision: 68,
  }),
  regularPlayer({
    id: 'bisseck', shortName: 'Bisseck', fullName: 'Yann Aurel Bisseck', position: 'CB',
    secondaryPositions: [], nation: 'Alemanha', club: 'Inter Milan', season: '2025/26',
    rarity: 'silver', overall: 82, pace: 77, shooting: 34, passing: 61, dribbling: 52, defending: 81, physical: 85, composure: 72, vision: 46,
  }),
  regularPlayer({
    id: 'frattesi', shortName: 'Frattesi', fullName: 'Davide Frattesi', position: 'CM',
    secondaryPositions: [], nation: 'Itália', club: 'Inter Milan', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 83, shooting: 71, passing: 73, dribbling: 77, defending: 68, physical: 82, composure: 78, vision: 69,
  }),

  // Arsenal
  regularPlayer({
    id: 'gyokeres', shortName: 'Gyökeres', fullName: 'Viktor Gyökeres', position: 'ST',
    secondaryPositions: [], nation: 'Suécia', club: 'Arsenal', season: '2025/26',
    rarity: 'gold', overall: 88, pace: 91, shooting: 88, passing: 70, dribbling: 82, defending: 32, physical: 87, composure: 82, vision: 62,
  }),
  regularPlayer({
    id: 'hincapie', shortName: 'Hincapié', fullName: 'Piero Hincapié', position: 'CB',
    secondaryPositions: ['LB'], nation: 'Equador', club: 'Arsenal', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 81, shooting: 37, passing: 68, dribbling: 59, defending: 84, physical: 80, composure: 79, vision: 53,
  }),
  regularPlayer({
    id: 'mosquera', shortName: 'Mosquera', fullName: 'Cristhian Mosquera', position: 'CB',
    secondaryPositions: [], nation: 'Espanha', club: 'Arsenal', season: '2025/26',
    rarity: 'silver', overall: 82, pace: 84, shooting: 31, passing: 65, dribbling: 59, defending: 80, physical: 74, composure: 73, vision: 49,
  }),
  regularPlayer({
    id: 'kepa', shortName: 'Kepa', fullName: 'Kepa Arrizabalaga', position: 'GK',
    secondaryPositions: [], nation: 'Espanha', club: 'Arsenal', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 48, shooting: 22, passing: 52, dribbling: 30, defending: 88, physical: 66, composure: 82, vision: 78,
  }),
  regularPlayer({
    id: 'norgaard', shortName: 'Nørgaard', fullName: 'Christian Nørgaard', position: 'CDM',
    secondaryPositions: [], nation: 'Dinamarca', club: 'Arsenal', season: '2025/26',
    rarity: 'silver', overall: 82, pace: 57, shooting: 39, passing: 73, dribbling: 65, defending: 80, physical: 77, composure: 79, vision: 70,
  }),
  regularPlayer({
    id: 'lewis_skelly', shortName: 'Lewis-Skelly', fullName: 'Myles Lewis-Skelly', position: 'LB',
    secondaryPositions: ['CDM', 'CM'], nation: 'Inglaterra', club: 'Arsenal', season: '2025/26',
    rarity: 'gold', overall: 84, pace: 83, shooting: 34, passing: 75, dribbling: 77, defending: 72, physical: 70, composure: 80, vision: 71,
  }),
  regularPlayer({
    id: 'saliba', shortName: 'Saliba', fullName: 'William Saliba', position: 'CB',
    secondaryPositions: [], nation: 'França', club: 'Arsenal', season: '2025/26',
    rarity: 'gold', overall: 88, pace: 86, shooting: 34, passing: 77, dribbling: 63, defending: 89, physical: 82, composure: 84, vision: 57,
  }),

  // Borussia Dortmund
  regularPlayer({
    id: 'kobel', shortName: 'Kobel', fullName: 'Gregor Kobel', position: 'GK',
    secondaryPositions: [], nation: 'Suíça', club: 'Borussia Dortmund', season: '2025/26',
    rarity: 'gold', overall: 87, pace: 47, shooting: 21, passing: 47, dribbling: 30, defending: 91, physical: 81, composure: 86, vision: 80,
  }),
  regularPlayer({
    id: 'guirassy', shortName: 'Guirassy', fullName: 'Serhou Guirassy', position: 'ST',
    secondaryPositions: [], nation: 'Guiné', club: 'Borussia Dortmund', season: '2025/26',
    rarity: 'gold', overall: 86, pace: 77, shooting: 87, passing: 61, dribbling: 73, defending: 29, physical: 83, composure: 81, vision: 59,
  }),

  // Juventus
  regularPlayer({
    id: 'vlahovic', shortName: 'Vlahović', fullName: 'Dušan Vlahović', position: 'ST',
    secondaryPositions: [], nation: 'Sérvia', club: 'Juventus', season: '2025/26',
    rarity: 'gold', overall: 86, pace: 79, shooting: 88, passing: 59, dribbling: 75, defending: 28, physical: 85, composure: 81, vision: 55,
  }),
];
