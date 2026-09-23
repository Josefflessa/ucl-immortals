import type { Player } from './gameData';

/**
 * Seleção de jogadores de elencos atuais e históricos de clubes do Brasileirão.
 * Cada ID foi conferido no elenco do SortitoutSI e o retrato correspondente é
 * baixado para client/public/players/sortitoutsi antes de expor a carta.
 *
 * Clubes consultados:
 * https://sortitoutsi.net/football-manager/team/337/sao-paulo-futebol-clube
 * https://sortitoutsi.net/football-manager-2026/competition/102423/brazilian-national-first-division
 */

type Entry = readonly [name: string, position: Player['position'], club: string, faceId: number];

const entries: Entry[] = [
  // Ceará
  ['Michel Macedo', 'RB', 'Ceará', 19019226], ['Dentinho', 'CAM', 'Ceará', 19028920],
  ['Fernando Sobral', 'CDM', 'Ceará', 19249856], ['Stiven Mendoza', 'CAM', 'Ceará', 76016258],
  // Vasco
  ['Tchê Tchê', 'CDM', 'Vasco', 19250321], ['Riquelme', 'LB', 'Vasco', 223637],
  ['Marino Hinestroza', 'CAM', 'Vasco', 76057670], ['Matheus França', 'CAM', 'Vasco', 2000090823],
  ['Robert Renan', 'CB', 'Vasco', 2000136297], ['Adson', 'CAM', 'Vasco', 19380038],
  ['Juan Sforza', 'CDM', 'Vasco', 14204638],
  // Atlético Mineiro
  ['Eduardo Vargas', 'CAM', 'Atlético Mineiro', 75003107], ['Ignacio Fernández', 'CAM', 'Atlético Mineiro', 14031117],
  ['Rodrigo Caio', 'CB', 'São Paulo', 19156536], ['Tomás Pérez', 'CDM', 'Atlético Mineiro', 2000166169],
  ['Róger Guedes', 'CAM', 'Atlético Mineiro', 19192947], ['Sávio', 'CAM', 'Atlético Mineiro', 2000011972],
  ['Keno', 'CAM', 'Atlético Mineiro', 19219855],
  // Cruzeiro
  ['Sídnei', 'CB', 'Cruzeiro', 8832967], ['Waguininho', 'CAM', 'Cruzeiro', 19189170],
  ['Robinho', 'CAM', 'Cruzeiro', 19030226], ['Federico Mancuello', 'CAM', 'Cruzeiro', 14022096],
  // Juventude
  ['Mauro Zárate', 'CAM', 'Juventude', 961289], ['Ricardo Bueno', 'ST', 'Juventude', 19003288],
  ['William Matheus', 'LB', 'Juventude', 19061779], ['Yuri Mamute', 'CAM', 'Juventude', 19162727],
  ['Vitor Gabriel', 'ST', 'Juventude', 19348887], ['Danilo Boza', 'CB', 'Juventude', 19354991],
  // Vitória
  ['Jádson', 'CAM', 'Vitória', 320362], ['Santiago Tréllez', 'ST', 'Vitória', 76003749],
  ['Roberto', 'CAM', 'Vitória', 319220], ['Willian Farias', 'CDM', 'Vitória', 19030967],
  ['Caíque Gonçalves', 'CDM', 'Vitória', 19270810], ['Wellington Rato', 'CAM', 'Vitória', 19335470],
  ['Denílson', 'CAM', 'Vitória', 19202678],
  // Fluminense
  ['Germán Cano', 'ST', 'Fluminense', 14003037], ['David Braz', 'CB', 'Fluminense', 2111732],
  ['André', 'CDM', 'Fluminense', 19375640], ['Luiz Henrique', 'CAM', 'Fluminense', 19377206],
  ['Junior Sornoza', 'CAM', 'Fluminense', 86029992], ['Nino', 'CB', 'Fluminense', 19261503],
  ['John Kennedy', 'ST', 'Fluminense', 19400559],
  // Fortaleza
  ['Titi', 'CB', 'Fortaleza', 19015213], ['Fernando Miguel', 'GK', 'Fortaleza', 8833560],
  ['Calebe', 'CAM', 'Fortaleza', 19363221], ['Valentín Depietri', 'CAM', 'Fortaleza', 14243533],
  ['Benjamín Kuscevic', 'CB', 'Fortaleza', 75032824], ['Gabriel Souza', 'CAM', 'Fortaleza', 2000218959],
  ['Ryan', 'CDM', 'Fortaleza', 2000161825], ['Imanol Machuca', 'CAM', 'Fortaleza', 14223283],
  ['Yeison Guzmán', 'CAM', 'Fortaleza', 76047118],
  // Grêmio
  ['Geromel', 'CB', 'Grêmio', 8878850], ['Thiago Santos', 'CDM', 'Grêmio', 19249773],
  ['Luan', 'CAM', 'Grêmio', 19226636], ['Marcelo Grohe', 'GK', 'Grêmio', 8835156],
  ['Miller Bolaños', 'CAM', 'Grêmio', 80007070], ['Viery', 'CB', 'Grêmio', 2000255823],
  ['Alexander Aravena', 'CAM', 'Grêmio', 75055397], ['Luis Eduardo', 'CB', 'Grêmio', 2000440037],
  ['Tiago', 'CAM', 'Grêmio', 2000440048], ['Matías Arezo', 'ST', 'Grêmio', 78094563],
  // Mirassol
  ['Camilo', 'CAM', 'Mirassol', 19002901], ['Ednei', 'CB', 'Mirassol', 19172326],
  ['Darley', 'GK', 'Mirassol', 19013948], ['José Aldo', 'CDM', 'Mirassol', 19271927],
  ['Lucas Oliveira', 'CB', 'Mirassol', 19367739], ['Renato Marques', 'ST', 'Mirassol', 2000109747],
  ['Shaylon', 'CAM', 'Mirassol', 19245683], ['Gabriel Pires', 'CDM', 'Mirassol', 19153477],
  ['Victor Luís', 'LB', 'Mirassol', 55060173],
  // Red Bull Bragantino
  ['Praxedes', 'CAM', 'Bragantino', 19406070], ['Natan', 'CB', 'Bragantino', 19351985],
  ['Helinho', 'CAM', 'Bragantino', 19302916], ['Gustavo Neves', 'CAM', 'Bragantino', 2000157429],
  ['Alerrandro', 'ST', 'Bragantino', 19296892], ['Fabinho', 'CDM', 'Bragantino', 19377986],
  ['José María Herrera', 'CAM', 'Bragantino', 2000051680],
  // Santos
  ['Carlos Sánchez', 'CAM', 'Santos', 8829831], ['Camacho', 'CDM', 'Santos', 19010988],
  ['Maicon Roque', 'CB', 'Santos', 19017908], ['Marcos Leonardo', 'ST', 'Santos', 19380666],
  ['Robinho Junior', 'CAM', 'Santos', 2000417769], ['Gabriel Bontempo', 'CAM', 'Santos', 2000206863],
  ['JP Chermont', 'RB', 'Santos', 2000218555], ['Sandry', 'CM', 'Santos', 19368081],
  ['Gabriel Pirani', 'CM', 'Santos', 19409770],
  // São Paulo
  ['Diego Souza', 'CAM', 'São Paulo', 8830373], ['Petros', 'CDM', 'São Paulo', 19140048],
  // Palmeiras
  ['Gabriel Veron', 'CAM', 'Palmeiras', 19360962], ['Raphael Veiga', 'CAM', 'Palmeiras', 19233491],
  ['Miguel Borja', 'ST', 'Palmeiras', 76033093], ['Lucas Lima', 'CAM', 'Palmeiras', 19187884],
  ['Patrick de Paula', 'CDM', 'Palmeiras', 19335628],
  // Corinthians
  ['Renato Augusto', 'CDM', 'Corinthians', 320569], ['Gil', 'CB', 'Corinthians', 19053424],
  ['Jô', 'ST', 'Corinthians', 8826161], ['Gabriel Pereira', 'CAM', 'Corinthians', 19408820],
  ['Rodriguinho', 'CAM', 'Corinthians', 19074937], ['Fabián Balbuena', 'CB', 'Corinthians', 79013838],
  // Sport
  ['Rithely', 'CDM', 'Sport', 19109926], ['Leandro Pereira', 'ST', 'Sport', 19220896],
  ['Marlone', 'CAM', 'Sport', 19151236], ['Everton Felipe', 'CAM', 'Sport', 19218935],
  ['Rogério', 'CAM', 'Sport', 19086275], ['Ronaldo Alves', 'CB', 'Sport', 19032955],
  ['Samuel Xavier', 'RB', 'Sport', 19100038],
  // Internacional
  ['Edenílson', 'CDM', 'Internacional', 19090354], ['Víctor Cuesta', 'CB', 'Internacional', 14019892],
  ['Peglow', 'CAM', 'Internacional', 19364342], ['Bruno Gomes', 'CDM', 'Internacional', 19376884],
  ['Gustavo Prado', 'CAM', 'Internacional', 2000125272], ['Wesley Moraes', 'ST', 'Internacional', 63028929],
  ['Carlos Palacios', 'CAM', 'Internacional', 75049645], ['Caio Vidal', 'CAM', 'Internacional', 19390669],
  // Botafogo
  ['Nathan Fernandes', 'CAM', 'Botafogo', 2000086446], ['Matheus Nascimento', 'ST', 'Botafogo', 19404650],
  ['Gatito Fernández', 'GK', 'Botafogo', 79000983], ['Mateo Ponte', 'RB', 'Botafogo', 2000076467],
  // Bahia
  ['Rodrigo Nestor', 'CAM', 'Bahia', 19306946], ['Kanu', 'CB', 'Bahia', 19307359],
  ['Ruan Pablo', 'CAM', 'Bahia', 2000382044], ['Cristian Olivera', 'CAM', 'Bahia', 78097898],
  // Flamengo
  ['João Gomes', 'CDM', 'Flamengo', 19371031], ['Diego', 'CAM', 'Flamengo', 311148],
];

const FOREIGN_NATIONS: Record<string, string> = {
  'Eduardo Vargas': 'Chile', 'Ignacio Fernández': 'Argentina', 'Federico Mancuello': 'Argentina',
  'Mauro Zárate': 'Argentina', 'Santiago Tréllez': 'Colômbia', 'Germán Cano': 'Argentina',
  'Valentín Depietri': 'Argentina', 'Benjamín Kuscevic': 'Chile', 'Miller Bolaños': 'Equador',
  'Alexander Aravena': 'Chile', 'Matías Arezo': 'Uruguai', 'José María Herrera': 'Argentina',
  'Carlos Sánchez': 'Uruguai', 'Miguel Borja': 'Colômbia', 'Fabián Balbuena': 'Paraguai',
  'Víctor Cuesta': 'Argentina', 'Carlos Palacios': 'Chile', 'Gatito Fernández': 'Paraguai',
  'Mateo Ponte': 'Uruguai', 'Cristian Olivera': 'Uruguai', 'Yeison Guzmán': 'Colômbia',
};

const ELITE_NAMES = new Set([
  'Germán Cano', 'Geromel', 'Luan', 'Marcelo Grohe', 'Diego Souza', 'Raphael Veiga',
  'Miguel Borja', 'Renato Augusto', 'Jô', 'Mauro Zárate', 'Eduardo Vargas', 'Ignacio Fernández',
  'Carlos Sánchez', 'Gustavo Scarpa', 'Marcos Leonardo',
]);

const YOUNG_NAMES = new Set([
  'Tomás Pérez', 'Riquelme', 'Robert Renan', 'Gabriel Souza', 'Ryan', 'Viery', 'Luis Eduardo',
  'Tiago', 'Renato Marques', 'Gustavo Neves', 'José María Herrera', 'Robinho Junior',
  'Gabriel Bontempo', 'JP Chermont', 'Ruan Pablo', 'Nathan Fernandes', 'Mateo Ponte',
]);

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function overallFor(name: string): number {
  if (ELITE_NAMES.has(name)) return 84;
  if (YOUNG_NAMES.has(name)) return 75;
  return 79;
}

function rarityForOverall(overall: number): Exclude<Player['rarity'], 'unique'> {
  if (overall <= 74) return 'bronze';
  if (overall <= 79) return 'silver';
  if (overall <= 87) return 'gold';
  if (overall <= 93) return 'legendary';
  return 'immortal';
}

function clamp(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function variation(name: string, offset: number): number {
  let hash = offset + 17;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) % 11;
  return hash - 5;
}

function makePlayer([name, position, club, faceId]: Entry, index: number): Player {
  const overall = overallFor(name);
  const v = (offset: number) => variation(name, index + offset);
  const group = position === 'GK' ? 'GK' : ['CB', 'LB', 'RB'].includes(position) ? 'DEF' : ['CDM', 'CM', 'CAM'].includes(position) ? 'MID' : 'ATT';
  const profiles = {
    GK: { pace: overall - 16, shooting: 8, passing: overall - 23, dribbling: overall - 35, defending: overall + 1, physical: overall - 7, composure: overall - 2, vision: overall - 17 },
    DEF: { pace: overall - 8, shooting: overall - 45, passing: overall - 13, dribbling: overall - 28, defending: overall + 3, physical: overall + 1, composure: overall - 6, vision: overall - 22 },
    MID: { pace: overall - 7, shooting: overall - 15, passing: overall + 3, dribbling: overall - 3, defending: overall - 16, physical: overall - 5, composure: overall, vision: overall + 1 },
    ATT: { pace: overall + 4, shooting: overall + 2, passing: overall - 10, dribbling: overall + 2, defending: overall - 45, physical: overall - 4, composure: overall - 1, vision: overall - 9 },
  }[group];

  return {
    id: `sortitoutsi_br_league_${slug(name)}_${slug(club)}`,
    shortName: name,
    fullName: name,
    position,
    nation: FOREIGN_NATIONS[name] ?? 'Brasil',
    club,
    season: '2025/26',
    rarity: rarityForOverall(overall),
    overall,
    pace: clamp(profiles.pace + v(1)), shooting: clamp(profiles.shooting + v(2)),
    passing: clamp(profiles.passing + v(3)), dribbling: clamp(profiles.dribbling + v(4)),
    defending: clamp(profiles.defending + v(5)), physical: clamp(profiles.physical + v(6)),
    composure: clamp(profiles.composure + v(7)), vision: clamp(profiles.vision + v(8)),
    traits: [],
    photoUrl: `/players/sortitoutsi/sortitoutsi_${faceId}.webp`,
  };
}

export const SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS: Player[] = entries.map(makePlayer);
