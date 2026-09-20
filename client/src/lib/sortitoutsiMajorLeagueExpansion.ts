import type { Player } from './gameData';

/**
 * Jogadores adicionados após uma auditoria do catálogo do Sortitoutsi.
 *
 * Fontes de triagem:
 * - https://sortitoutsi.net/football-manager-2026-wonderkids-defence-position
 * - https://sortitoutsi.net/football-manager-2026-best-mc-position
 * - https://sortitoutsi.net/football-manager-2026-best-aml-position
 * - https://sortitoutsi.net/football-manager-2026-best-st-position
 * Os ids abaixo também registram a face correspondente no CDN do Sortitoutsi,
 * para que o retrato local possa ser conferido sem depender de uma busca vaga.
 */
export const SORTITOUTSI_FACE_IDS: Readonly<Record<string, number>> = {
  huijsen_real_madrid: 2000109240,
  khusanov_manchestercity: 2000168014,
  oreilly_manchestercity: 2000101285,
  veiga_villarreal: 83320123,
  kayode_brentford: 2000023588,
  beraldo_psg: 2000094252,
  gadou_salzburg: 2000287960,
  leoni_liverpool: 2000259904,
  dorgu_united: 27164470,
  koulierakis_wolfsburg: 36159445,
  alberto_costa_porto: 2000048260,
  belocian_wolfsburg: 2000115205,
  yarek_psv: 2000141707,
  acheampong_chelsea: 2000184611,
  heaven_united: 2000301027,
  diouf_westham: 2000262615,
  juma_bah_nice: 2000399711,
  martim_fernandes_porto: 2000183245,
  vitor_reis_girona: 2000221609,
  givairo_read_feyenoord: 2000257209,
  canvot_crystalpalace: 2000187623,
  fortini_fiorentina: 2000241002,
  sancet_athletic: 67260204,
  froholdt_porto: 2000202295,
  nmecha_dortmund: 28113827,
  anderson_nottinghamforest: 28127254,
  mitoma_brighton: 45111891,
  diomande_leipzig: 2000311833,
  ekitike_liverpool: 49062667,
  woltemade_newcastle: 91187791,
  jonathan_david_juventus: 18108540,
};

type CatalogProfile = Omit<Player, 'rarity' | 'traits'>;

function rarityForOverall(overall: number): Exclude<Player['rarity'], 'unique'> {
  if (overall <= 74) return 'bronze';
  if (overall <= 79) return 'silver';
  if (overall <= 87) return 'gold';
  if (overall <= 93) return 'legendary';
  return 'immortal';
}

const catalogPlayer = (player: CatalogProfile): Player => ({
  ...player,
  rarity: rarityForOverall(player.overall),
  traits: [],
});

/**
 * Primeira leva desta pesquisa: somente nomes que não tinham correspondência
 * exata no PLAYERS antes da inclusão. Os atributos são perfis-base, não cópias
 * entre versões: zagueiros priorizam defesa/físico, laterais velocidade e
 * condução, e meias/criadores passe/visão.
 */
export const SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS: Player[] = [
  // Premier League / jogadores em clubes ingleses
  catalogPlayer({ id: 'khusanov_manchestercity', shortName: 'Khusanov', fullName: 'Abdukodir Khusanov', position: 'CB', nation: 'Uzbequistão', club: 'Manchester City', season: '2025/26', overall: 82, pace: 82, shooting: 21, passing: 56, dribbling: 35, defending: 84, physical: 84, composure: 68, vision: 38 }),
  catalogPlayer({ id: 'oreilly_manchestercity', shortName: "Nico O'Reilly", fullName: "Nico O'Reilly", position: 'CAM', secondaryPositions: ['LB', 'CM'], nation: 'Inglaterra', club: 'Manchester City', season: '2025/26', overall: 78, pace: 72, shooting: 52, passing: 75, dribbling: 66, defending: 53, physical: 64, composure: 64, vision: 72 }),
  catalogPlayer({ id: 'kayode_brentford', shortName: 'Kayode', fullName: 'Michael Kayode', position: 'RB', secondaryPositions: ['RWB'], nation: 'Itália', club: 'Brentford', season: '2025/26', overall: 80, pace: 88, shooting: 34, passing: 66, dribbling: 76, defending: 65, physical: 69, composure: 72, vision: 58 }),
  catalogPlayer({ id: 'leoni_liverpool', shortName: 'Leoni', fullName: 'Giovanni Leoni', position: 'CB', nation: 'Itália', club: 'Liverpool', season: '2025/26', overall: 76, pace: 64, shooting: 22, passing: 62, dribbling: 37, defending: 78, physical: 77, composure: 64, vision: 34 }),
  catalogPlayer({ id: 'dorgu_united', shortName: 'Dorgu', fullName: 'Patrick Dorgu', position: 'LB', secondaryPositions: ['LWB', 'RW'], nation: 'Dinamarca', club: 'Manchester United', season: '2025/26', overall: 81, pace: 91, shooting: 42, passing: 69, dribbling: 77, defending: 65, physical: 75, composure: 72, vision: 60 }),
  catalogPlayer({ id: 'acheampong_chelsea', shortName: 'Acheampong', fullName: 'Joshua Acheampong', position: 'CB', secondaryPositions: ['RB'], nation: 'Inglaterra', club: 'Chelsea', season: '2025/26', overall: 75, pace: 77, shooting: 21, passing: 61, dribbling: 48, defending: 70, physical: 70, composure: 61, vision: 42 }),
  catalogPlayer({ id: 'heaven_united', shortName: 'Heaven', fullName: 'Ayden Heaven', position: 'CB', nation: 'Inglaterra', club: 'Manchester United', season: '2025/26', overall: 76, pace: 72, shooting: 18, passing: 63, dribbling: 40, defending: 76, physical: 72, composure: 62, vision: 39 }),
  catalogPlayer({ id: 'diouf_westham', shortName: 'Diouf', fullName: 'El Hadji Malick Diouf', position: 'LB', secondaryPositions: ['CB', 'LWB'], nation: 'Senegal', club: 'West Ham', season: '2025/26', overall: 80, pace: 88, shooting: 34, passing: 72, dribbling: 68, defending: 70, physical: 73, composure: 71, vision: 55 }),

  // La Liga / jogadores vinculados a clubes espanhóis
  catalogPlayer({ id: 'huijsen_real_madrid', shortName: 'Huijsen', fullName: 'Dean Huijsen', position: 'CB', nation: 'Espanha', club: 'Real Madrid', season: '2025/26', overall: 84, pace: 79, shooting: 27, passing: 76, dribbling: 47, defending: 82, physical: 75, composure: 75, vision: 54 }),
  catalogPlayer({ id: 'veiga_villarreal', shortName: 'Renato Veiga', fullName: 'Renato Veiga', position: 'CB', secondaryPositions: ['LB', 'CDM'], nation: 'Portugal', club: 'Villarreal', season: '2025/26', overall: 80, pace: 67, shooting: 32, passing: 70, dribbling: 46, defending: 75, physical: 77, composure: 70, vision: 55 }),
  catalogPlayer({ id: 'vitor_reis_girona', shortName: 'Vitor Reis', fullName: 'Vitor de Oliveira Nunes dos Reis', position: 'CB', nation: 'Brasil', club: 'Girona FC', season: '2025/26', overall: 78, pace: 70, shooting: 22, passing: 63, dribbling: 38, defending: 79, physical: 80, composure: 65, vision: 40 }),

  // Ligue 1 / jovens de clubes franceses e parceiros da liga
  catalogPlayer({ id: 'beraldo_psg', shortName: 'Beraldo', fullName: 'Lucas Beraldo', position: 'CB', nation: 'Brasil', club: 'PSG', season: '2025/26', overall: 78, pace: 59, shooting: 24, passing: 77, dribbling: 50, defending: 77, physical: 72, composure: 75, vision: 62 }),
  catalogPlayer({ id: 'juma_bah_nice', shortName: 'Juma Bah', fullName: 'Juma Bah', position: 'CB', nation: 'Serra Leoa', club: 'Nice', season: '2025/26', overall: 76, pace: 73, shooting: 18, passing: 54, dribbling: 34, defending: 75, physical: 79, composure: 60, vision: 31 }),
  catalogPlayer({ id: 'canvot_crystalpalace', shortName: 'Canvot', fullName: 'Jaydee Canvot', position: 'CB', secondaryPositions: ['CDM'], nation: 'França', club: 'Crystal Palace', season: '2025/26', overall: 74, pace: 75, shooting: 20, passing: 57, dribbling: 35, defending: 72, physical: 76, composure: 60, vision: 40 }),

  // Bundesliga
  catalogPlayer({ id: 'gadou_salzburg', shortName: 'Gadou', fullName: 'Joane Gadou', position: 'CB', nation: 'França', club: 'RB Salzburg', season: '2025/26', overall: 73, pace: 68, shooting: 20, passing: 51, dribbling: 38, defending: 72, physical: 80, composure: 59, vision: 35 }),
  catalogPlayer({ id: 'koulierakis_wolfsburg', shortName: 'Koulierakis', fullName: 'Konstantinos Koulierakis', position: 'CB', nation: 'Grécia', club: 'Wolfsburg', season: '2025/26', overall: 78, pace: 69, shooting: 26, passing: 61, dribbling: 41, defending: 79, physical: 78, composure: 70, vision: 40 }),
  catalogPlayer({ id: 'belocian_wolfsburg', shortName: 'Belocian', fullName: 'Jeanuël Belocian', position: 'CB', secondaryPositions: ['LB'], nation: 'França', club: 'Wolfsburg', season: '2025/26', overall: 76, pace: 78, shooting: 22, passing: 68, dribbling: 45, defending: 73, physical: 72, composure: 62, vision: 42 }),

  // Primeira Liga / talentos portugueses e estrangeiros em Portugal
  catalogPlayer({ id: 'alberto_costa_porto', shortName: 'Alberto Costa', fullName: 'Alberto Costa', position: 'RB', secondaryPositions: ['RWB', 'RM'], nation: 'Portugal', club: 'Porto', season: '2025/26', overall: 79, pace: 86, shooting: 32, passing: 67, dribbling: 74, defending: 61, physical: 71, composure: 71, vision: 55 }),
  catalogPlayer({ id: 'martim_fernandes_porto', shortName: 'Martim Fernandes', fullName: 'Martim Fernandes', position: 'RB', secondaryPositions: ['LB', 'RWB'], nation: 'Portugal', club: 'Porto', season: '2025/26', overall: 77, pace: 85, shooting: 29, passing: 68, dribbling: 72, defending: 63, physical: 68, composure: 67, vision: 54 }),
  catalogPlayer({ id: 'yarek_psv', shortName: 'Yarek', fullName: 'Yarek Gąsiorowski Hernández', position: 'CB', secondaryPositions: ['LB'], nation: 'Espanha', club: 'PSV', season: '2025/26', overall: 76, pace: 62, shooting: 25, passing: 67, dribbling: 42, defending: 77, physical: 70, composure: 65, vision: 42 }),

  // Eredivisie / jovens que acrescentam variedade à defesa
  catalogPlayer({ id: 'givairo_read_feyenoord', shortName: 'Givairo Read', fullName: 'Givairo Read', position: 'RB', secondaryPositions: ['LB', 'RW'], nation: 'Holanda', club: 'Feyenoord', season: '2025/26', overall: 78, pace: 88, shooting: 33, passing: 70, dribbling: 71, defending: 60, physical: 66, composure: 68, vision: 59 }),

  // Serie A
  catalogPlayer({ id: 'fortini_fiorentina', shortName: 'Fortini', fullName: 'Niccolò Fortini', position: 'LB', secondaryPositions: ['RB', 'LM'], nation: 'Itália', club: 'Fiorentina', season: '2025/26', overall: 74, pace: 82, shooting: 31, passing: 66, dribbling: 68, defending: 58, physical: 64, composure: 65, vision: 57 }),

  // Meio-campo e ataque — inclusão complementar para não concentrar a leva só
  // em defensores.
  catalogPlayer({ id: 'sancet_athletic', shortName: 'Sancet', fullName: 'Oihan Sancet Tirapu', position: 'CAM', secondaryPositions: ['CM'], nation: 'Espanha', club: 'Athletic Bilbao', season: '2025/26', overall: 83, pace: 75, shooting: 78, passing: 82, dribbling: 82, defending: 25, physical: 64, composure: 84, vision: 88 }),
  catalogPlayer({ id: 'froholdt_porto', shortName: 'Froholdt', fullName: 'Victor Froholdt', position: 'CM', secondaryPositions: ['CDM', 'CAM'], nation: 'Dinamarca', club: 'Porto', season: '2025/26', overall: 78, pace: 76, shooting: 45, passing: 77, dribbling: 70, defending: 57, physical: 69, composure: 72, vision: 78 }),
  catalogPlayer({ id: 'nmecha_dortmund', shortName: 'Nmecha', fullName: 'Felix Nmecha', position: 'CM', secondaryPositions: ['CAM', 'CDM'], nation: 'Alemanha', club: 'Borussia Dortmund', season: '2025/26', overall: 80, pace: 77, shooting: 57, passing: 80, dribbling: 77, defending: 56, physical: 73, composure: 78, vision: 80 }),
  catalogPlayer({ id: 'anderson_nottinghamforest', shortName: 'Elliot Anderson', fullName: 'Elliot Anderson', position: 'CM', secondaryPositions: ['CAM'], nation: 'Inglaterra', club: 'Nottingham Forest', season: '2025/26', overall: 80, pace: 71, shooting: 47, passing: 80, dribbling: 73, defending: 45, physical: 70, composure: 78, vision: 78 }),
  catalogPlayer({ id: 'mitoma_brighton', shortName: 'Mitoma', fullName: 'Kaoru Mitoma', position: 'LW', secondaryPositions: ['RW'], nation: 'Japão', club: 'Brighton', season: '2025/26', overall: 84, pace: 94, shooting: 75, passing: 76, dribbling: 89, defending: 25, physical: 58, composure: 82, vision: 74 }),
  catalogPlayer({ id: 'diomande_leipzig', shortName: 'Yan Diomandé', fullName: 'Yan Diomandé', position: 'RW', secondaryPositions: ['LW', 'CAM'], nation: 'Costa do Marfim', club: 'RB Leipzig', season: '2025/26', overall: 80, pace: 93, shooting: 68, passing: 71, dribbling: 87, defending: 23, physical: 57, composure: 70, vision: 67 }),
  catalogPlayer({ id: 'ekitike_liverpool', shortName: 'Ekitiké', fullName: 'Hugo Ekitiké', position: 'ST', secondaryPositions: ['LW'], nation: 'França', club: 'Liverpool', season: '2025/26', overall: 84, pace: 87, shooting: 84, passing: 57, dribbling: 80, defending: 22, physical: 78, composure: 78, vision: 50 }),
  catalogPlayer({ id: 'woltemade_newcastle', shortName: 'Woltemade', fullName: 'Nick Woltemade', position: 'ST', secondaryPositions: ['CAM'], nation: 'Alemanha', club: 'Newcastle', season: '2025/26', overall: 83, pace: 73, shooting: 82, passing: 55, dribbling: 75, defending: 26, physical: 86, composure: 82, vision: 52 }),
  catalogPlayer({ id: 'jonathan_david_juventus', shortName: 'Jonathan David', fullName: 'Jonathan Christian David', position: 'ST', secondaryPositions: ['CAM', 'LW'], nation: 'Canadá', club: 'Juventus', season: '2025/26', overall: 84, pace: 89, shooting: 87, passing: 63, dribbling: 85, defending: 24, physical: 72, composure: 85, vision: 64 }),
];
