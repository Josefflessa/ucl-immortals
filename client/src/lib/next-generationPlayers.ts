import type { Player } from './gameData';

type NewPlayer = Omit<Player, 'rarity' | 'traits'>;

function player(data: NewPlayer): Player {
  const rarity: Player['rarity'] = data.overall <= 74
    ? 'bronze'
    : data.overall <= 79
      ? 'silver'
      : data.overall <= 87
        ? 'gold'
        : data.overall <= 93
          ? 'legendary'
          : 'immortal';

  return { ...data, rarity, traits: [] };
}

/**
 * Jogadores jovens e nomes de destaque pesquisados no FM26/Sortitoutsi.
 *
 * As cartas são mantidas em um módulo separado para deixar claro que são
 * adições de catálogo, não versões históricas dos jogadores já existentes.
 * Cada retrato usa o recorte local correspondente ao ID da carta.
 */
export const NEXT_GENERATION_PLAYERS: Player[] = [
  // Brasil e jogadores ligados ao futebol brasileiro
  player({ id: 'wesley_roma', shortName: 'Wesley', fullName: 'Wesley Vinícius França Lima', position: 'RB', secondaryPositions: ['RWB', 'RM'], nation: 'Brasil', club: 'Roma', season: '2025/26', overall: 83, pace: 91, shooting: 45, passing: 78, dribbling: 82, defending: 73, physical: 76, composure: 75, vision: 72 }),
  player({ id: 'marlon_gomes', shortName: 'Marlon Gomes', fullName: 'Marlon Gomes Claudino', position: 'CDM', secondaryPositions: ['CM', 'CAM'], nation: 'Brasil', club: 'Shakhtar Donetsk', season: '2025/26', overall: 82, pace: 74, shooting: 52, passing: 80, dribbling: 77, defending: 68, physical: 79, composure: 79, vision: 78 }),
  player({ id: 'rayan_bournemouth', shortName: 'Rayan', fullName: 'Rayan Vitor Simões de Souza', position: 'RW', secondaryPositions: ['ST'], nation: 'Brasil', club: 'Bournemouth', season: '2025/26', overall: 81, pace: 88, shooting: 76, passing: 60, dribbling: 82, defending: 27, physical: 70, composure: 75, vision: 55 }),
  player({ id: 'kaua_elias', shortName: 'Kauã Elias', fullName: 'Kauã Elias Nascimento de Oliveira', position: 'ST', secondaryPositions: ['RW'], nation: 'Brasil', club: 'Shakhtar Donetsk', season: '2025/26', overall: 80, pace: 82, shooting: 78, passing: 51, dribbling: 70, defending: 23, physical: 77, composure: 73, vision: 47 }),
  player({ id: 'ryan_francisco', shortName: 'Ryan Francisco', fullName: 'Ryan Francisco de Lima', position: 'ST', nation: 'Brasil', club: 'São Paulo', season: '2025/26', overall: 78, pace: 75, shooting: 80, passing: 43, dribbling: 63, defending: 21, physical: 70, composure: 76, vision: 40 }),
  player({ id: 'lorran_pisa', shortName: 'Lorran', fullName: 'Lorran Lucas Pereira da Silva', position: 'CAM', secondaryPositions: ['CM', 'RW'], nation: 'Brasil', club: 'Pisa', season: '2025/26', overall: 77, pace: 79, shooting: 57, passing: 75, dribbling: 82, defending: 25, physical: 53, composure: 73, vision: 82 }),
  player({ id: 'gabriel_mec', shortName: 'Gabriel Mec', fullName: 'Gabriel Ferreira de Carvalho', position: 'CAM', secondaryPositions: ['LW', 'RW'], nation: 'Brasil', club: 'Grêmio', season: '2025/26', overall: 76, pace: 82, shooting: 51, passing: 70, dribbling: 78, defending: 23, physical: 52, composure: 68, vision: 73 }),
  player({ id: 'joao_borne', shortName: 'João Borne', fullName: 'João Borne', position: 'CAM', secondaryPositions: ['CM'], nation: 'Brasil', club: 'Grêmio', season: '2025/26', overall: 74, pace: 73, shooting: 43, passing: 67, dribbling: 70, defending: 21, physical: 49, composure: 64, vision: 72 }),
  player({ id: 'wesley_nata', shortName: 'Wesley Natã', fullName: 'Wesley Natã de Souza', position: 'RW', secondaryPositions: ['LW'], nation: 'Brasil', club: 'Fluminense', season: '2025/26', overall: 74, pace: 84, shooting: 49, passing: 61, dribbling: 77, defending: 22, physical: 50, composure: 66, vision: 59 }),
  player({ id: 'pedro_morisco', shortName: 'Pedro Morisco', fullName: 'Pedro Morisco', position: 'GK', nation: 'Brasil', club: 'Coritiba', season: '2025/26', overall: 79, pace: 35, shooting: 15, passing: 44, dribbling: 18, defending: 83, physical: 76, composure: 69, vision: 65 }),

  // Premier League
  player({ id: 'adam_wharton', shortName: 'Adam Wharton', fullName: 'Adam James Wharton', position: 'CDM', secondaryPositions: ['CM'], nation: 'Inglaterra', club: 'Crystal Palace', season: '2025/26', overall: 84, pace: 70, shooting: 48, passing: 86, dribbling: 80, defending: 71, physical: 70, composure: 87, vision: 90 }),
  player({ id: 'archie_gray', shortName: 'Archie Gray', fullName: 'Archie David Gray', position: 'RB', secondaryPositions: ['CDM', 'CM'], nation: 'Inglaterra', club: 'Tottenham', season: '2025/26', overall: 82, pace: 76, shooting: 41, passing: 80, dribbling: 72, defending: 70, physical: 72, composure: 82, vision: 78 }),
  player({ id: 'jamie_gittens', shortName: 'Jamie Gittens', fullName: 'Jamie Jermaine Bynoe-Gittens', position: 'LW', secondaryPositions: ['RW'], nation: 'Inglaterra', club: 'Chelsea', season: '2025/26', overall: 83, pace: 92, shooting: 72, passing: 67, dribbling: 88, defending: 21, physical: 58, composure: 77, vision: 66 }),
  player({ id: 'tyler_dibling', shortName: 'Tyler Dibling', fullName: 'Tyler-Jay Dibling', position: 'RW', secondaryPositions: ['CAM', 'RM'], nation: 'Inglaterra', club: 'Everton', season: '2025/26', overall: 80, pace: 82, shooting: 65, passing: 69, dribbling: 85, defending: 23, physical: 57, composure: 75, vision: 74 }),
  player({ id: 'lewis_hall', shortName: 'Lewis Hall', fullName: 'Lewis Kieran Hall', position: 'LB', secondaryPositions: ['CM', 'LWB'], nation: 'Inglaterra', club: 'Newcastle', season: '2025/26', overall: 80, pace: 78, shooting: 35, passing: 79, dribbling: 77, defending: 69, physical: 66, composure: 77, vision: 75 }),

  // La Liga
  player({ id: 'marc_bernal', shortName: 'Marc Bernal', fullName: 'Marc Bernal Casas', position: 'CDM', secondaryPositions: ['CM'], nation: 'Espanha', club: 'Barcelona', season: '2025/26', overall: 79, pace: 60, shooting: 32, passing: 79, dribbling: 69, defending: 75, physical: 68, composure: 77, vision: 83 }),
  player({ id: 'mikel_jauregizar', shortName: 'Mikel Jauregizar', fullName: 'Mikel Jauregizar Alboniga', position: 'CM', secondaryPositions: ['CDM', 'CAM'], nation: 'Espanha', club: 'Athletic Bilbao', season: '2025/26', overall: 78, pace: 63, shooting: 42, passing: 75, dribbling: 68, defending: 53, physical: 72, composure: 76, vision: 77 }),
  player({ id: 'rodrigo_mendoza', shortName: 'Rodrigo Mendoza', fullName: 'Rodrigo Mendoza Martínez', position: 'CAM', secondaryPositions: ['CM', 'RW'], nation: 'Espanha', club: 'Atlético Madrid', season: '2025/26', overall: 77, pace: 76, shooting: 54, passing: 72, dribbling: 80, defending: 21, physical: 54, composure: 69, vision: 76 }),
  player({ id: 'alberto_moleiro', shortName: 'Alberto Moleiro', fullName: 'Alberto Moleiro González', position: 'CAM', secondaryPositions: ['LW', 'RW'], nation: 'Espanha', club: 'Villarreal', season: '2025/26', overall: 84, pace: 86, shooting: 69, passing: 84, dribbling: 91, defending: 20, physical: 54, composure: 84, vision: 86 }),
  player({ id: 'pau_navarro', shortName: 'Pau Navarro', fullName: 'Pau Navarro Martínez', position: 'CB', secondaryPositions: ['RB'], nation: 'Espanha', club: 'Villarreal', season: '2025/26', overall: 76, pace: 73, shooting: 28, passing: 66, dribbling: 49, defending: 75, physical: 67, composure: 70, vision: 45 }),

  // Serie A
  player({ id: 'pisilli', shortName: 'Pisilli', fullName: 'Niccolò Pisilli', position: 'CM', secondaryPositions: ['CAM'], nation: 'Itália', club: 'Roma', season: '2025/26', overall: 79, pace: 69, shooting: 42, passing: 73, dribbling: 74, defending: 53, physical: 68, composure: 78, vision: 79 }),
  player({ id: 'camarda', shortName: 'Camarda', fullName: 'Francesco Camarda', position: 'ST', nation: 'Itália', club: 'Lecce', season: '2025/26', overall: 79, pace: 75, shooting: 83, passing: 41, dribbling: 65, defending: 20, physical: 69, composure: 79, vision: 42 }),
  player({ id: 'pio_esposito', shortName: 'Pio Esposito', fullName: 'Francesco Pio Esposito', position: 'ST', nation: 'Itália', club: 'Inter Milan', season: '2025/26', overall: 82, pace: 72, shooting: 84, passing: 49, dribbling: 67, defending: 21, physical: 83, composure: 80, vision: 44 }),
  player({ id: 'scalvini', shortName: 'Scalvini', fullName: 'Giorgio Scalvini', position: 'CB', secondaryPositions: ['CDM'], nation: 'Itália', club: 'Atalanta', season: '2025/26', overall: 85, pace: 77, shooting: 32, passing: 73, dribbling: 49, defending: 87, physical: 78, composure: 82, vision: 52 }),
  player({ id: 'luca_marianucci', shortName: 'Luca Marianucci', fullName: 'Luca Marianucci', position: 'CB', nation: 'Itália', club: 'Napoli', season: '2025/26', overall: 78, pace: 67, shooting: 27, passing: 65, dribbling: 44, defending: 78, physical: 75, composure: 74, vision: 42 }),
  player({ id: 'pietro_comuzzo', shortName: 'Pietro Comuzzo', fullName: 'Pietro Comuzzo', position: 'CB', nation: 'Itália', club: 'Fiorentina', season: '2025/26', overall: 81, pace: 79, shooting: 26, passing: 59, dribbling: 40, defending: 83, physical: 82, composure: 76, vision: 38 }),

  // Bundesliga
  player({ id: 'tom_bischof', shortName: 'Tom Bischof', fullName: 'Tom Bischof', position: 'CM', secondaryPositions: ['CAM', 'CDM'], nation: 'Alemanha', club: 'Bayern Munich', season: '2025/26', overall: 80, pace: 65, shooting: 50, passing: 82, dribbling: 78, defending: 41, physical: 58, composure: 77, vision: 86 }),
  player({ id: 'assan_ouedraogo', shortName: 'Assan Ouédraogo', fullName: 'Assan Ouédraogo', position: 'CAM', secondaryPositions: ['CM', 'RW'], nation: 'Alemanha', club: 'RB Leipzig', season: '2025/26', overall: 80, pace: 88, shooting: 60, passing: 71, dribbling: 83, defending: 30, physical: 70, composure: 75, vision: 69 }),
  player({ id: 'brajan_gruda', shortName: 'Brajan Gruda', fullName: 'Brajan Gruda', position: 'RW', secondaryPositions: ['CAM', 'LW'], nation: 'Alemanha', club: 'RB Leipzig', season: '2025/26', overall: 81, pace: 80, shooting: 64, passing: 74, dribbling: 86, defending: 26, physical: 61, composure: 78, vision: 78 }),
  player({ id: 'finn_jeltsch', shortName: 'Finn Jeltsch', fullName: 'Finn Jeltsch', position: 'CB', secondaryPositions: ['CDM'], nation: 'Alemanha', club: 'Stuttgart', season: '2025/26', overall: 78, pace: 72, shooting: 25, passing: 68, dribbling: 43, defending: 80, physical: 76, composure: 72, vision: 43 }),
  player({ id: 'jonas_urbig', shortName: 'Jonas Urbig', fullName: 'Jonas Urbig', position: 'GK', nation: 'Alemanha', club: 'Bayern Munich', season: '2025/26', overall: 80, pace: 39, shooting: 16, passing: 51, dribbling: 19, defending: 86, physical: 79, composure: 77, vision: 73 }),
  player({ id: 'said_el_mala', shortName: 'Saïd El Mala', fullName: 'Saïd El Mala', position: 'RW', secondaryPositions: ['LW', 'CAM'], nation: 'Alemanha', club: 'Köln', season: '2025/26', overall: 79, pace: 89, shooting: 63, passing: 66, dribbling: 86, defending: 21, physical: 59, composure: 74, vision: 62 }),

  // Ligue 1
  player({ id: 'desire_doue', shortName: 'Désiré Doué', fullName: 'Désiré Doué', position: 'CAM', secondaryPositions: ['LW', 'RW'], nation: 'França', club: 'PSG', season: '2025/26', overall: 86, pace: 90, shooting: 75, passing: 86, dribbling: 92, defending: 24, physical: 64, composure: 84, vision: 88 }),
  player({ id: 'zaire_emery', shortName: 'Zaïre-Emery', fullName: 'Warren Zaïre-Emery', position: 'CM', secondaryPositions: ['CDM'], nation: 'França', club: 'PSG', season: '2025/26', overall: 86, pace: 78, shooting: 48, passing: 83, dribbling: 82, defending: 74, physical: 82, composure: 89, vision: 84 }),
  player({ id: 'ayyoub_bouaddi', shortName: 'Ayyoub Bouaddi', fullName: 'Ayyoub Bouaddi', position: 'CDM', secondaryPositions: ['CM'], nation: 'França', club: 'Lille', season: '2025/26', overall: 80, pace: 64, shooting: 31, passing: 78, dribbling: 73, defending: 69, physical: 67, composure: 78, vision: 81 }),
  player({ id: 'senny_mayulu', shortName: 'Senny Mayulu', fullName: 'Senny Mayulu', position: 'CAM', secondaryPositions: ['ST', 'LW'], nation: 'França', club: 'PSG', season: '2025/26', overall: 78, pace: 76, shooting: 66, passing: 63, dribbling: 80, defending: 22, physical: 65, composure: 71, vision: 60 }),
  player({ id: 'jeremy_jacquet', shortName: 'Jérémy Jacquet', fullName: 'Jérémy Jacquet', position: 'CB', nation: 'França', club: 'Rennes', season: '2025/26', overall: 78, pace: 76, shooting: 24, passing: 66, dribbling: 45, defending: 79, physical: 73, composure: 73, vision: 46 }),
  player({ id: 'ismael_doukoure', shortName: 'Ismaël Doukouré', fullName: 'Ismaël Doukouré', position: 'CB', secondaryPositions: ['CDM'], nation: 'França', club: 'Strasbourg', season: '2025/26', overall: 80, pace: 78, shooting: 32, passing: 71, dribbling: 55, defending: 81, physical: 80, composure: 78, vision: 57 }),
];
