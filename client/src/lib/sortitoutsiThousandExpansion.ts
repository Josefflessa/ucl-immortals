import type { Player } from './gameData';

/**
 * Segunda leva da auditoria do catálogo: 75 jogadores novos para completar
 * os 1.000. Cada chave aponta para o ID individual da face Cut-Out no
 * Sortitoutsi; os arquivos locais são gerados a partir desses IDs.
 *
 * Fontes de triagem:
 * - https://sortitoutsi.net/football-manager-2026-wonderkids-defence-position
 * - https://sortitoutsi.net/football-manager-2026-best-mc-position
 * - https://sortitoutsi.net/football-manager-2026-best-aml-position
 * - https://sortitoutsi.net/football-manager-2026-best-st-position
 */
export const SORTITOUTSI_1000_FACE_IDS: Readonly<Record<string, number>> = {
  alejandro_balde_barcelona: 67296654,
  willy_kambwala_villarreal: 2000006158,
  ousmane_diomande_sporting: 2000160511,
  samson_baidoo_lens: 16337073,
  aaron_anselmino_strasbourg: 2000122572,
  el_chadaille_bitshiabu_leipzig: 2000100253,
  jon_martin_sociedad: 2000229718,
  juanlu_sevilla: 2000027530,
  tiago_gabriel_lecce: 2000288426,
  timothy_weah_marseille: 48042432,
  rico_lewis_city: 2000098727,
  zeno_debast_sporting: 18115016,
  jose_neto_benfica: 2000378240,
  gerard_martin_barcelona: 2000101061,
  ben_nelson_leicester: 2000023537,
  axel_tape_leverkusen: 2000288856,
  nuno_tavares_lazio: 83169864,
  alex_jimenez_bournemouth: 2000211997,
  honest_ahanor_atalanta: 2000400123,
  jofre_torrents_barcelona: 2000297306,
  fabian_psg: 67216396,
  zambo_anguissa_napoli: 48030711,
  manu_kone_roma: 49047182,
  ryan_gravenberch_liverpool: 37071197,
  matheus_nunes_city: 83188780,
  joelinton_newcastle: 19184436,
  amine_gouiri_marseille: 48044735,
  exequiel_palacios_leverkusen: 14110846,
  bernardo_silva_city: 55041632,
  nico_gonzalez_city: 67276127,
  pablo_barrios_atletico: 2000125958,
  johnny_cardoso_atletico: 89066513,
  mikel_merino_arsenal: 67211760,
  henrikh_mkhitaryan_inter: 59006269,
  khephren_thuram_juventus: 49038952,
  curtis_jones_liverpool: 28115788,
  gabriel_jesus_arsenal: 19220266,
  rafael_leao_milan: 83111483,
  marcus_rashford_barcelona: 28100266,
  kang_in_lee_psg: 67260506,
  leandro_trossard_arsenal: 18054004,
  iliman_ndiaye_everton: 89063107,
  pote_sporting: 29192705,
  federico_chiesa_liverpool: 43161651,
  mattia_zaccagni_lazio: 43125343,
  kingsley_coman_al_nassr: 85104424,
  justin_kluivert_bournemouth: 37055841,
  alex_berenguer_bilbao: 67157520,
  callum_hudson_odoi_forest: 28112986,
  ander_barrenetxea_sociedad: 67276482,
  ivan_perisic_psv: 34012563,
  bryan_zaragoza_roma: 2000054263,
  ez_abde_betis: 2000054872,
  baris_alper_yilmaz_galatasaray: 70112874,
  ruben_vargas_sevilla: 98041215,
  igor_paixao_marseille: 19383256,
  marcus_thuram_inter: 48037335,
  victor_osimhen_galatasaray: 13158205,
  kai_havertz_arsenal: 91151081,
  deniz_undav_stuttgart: 91157307,
  luis_suarez_sporting: 76046285,
  goncalo_ramos_psg: 83209468,
  inaki_williams_bilbao: 67184349,
  ivan_toney_al_nassr: 29116247,
  alexander_sorloth_atletico: 53063430,
  maximilian_beier_dortmund: 91207281,
  moise_kean_fiorentina: 43274977,
  tim_kleindienst_gladbach: 92065436,
  lois_openda_juventus: 18101745,
  donyell_malen_roma: 37055844,
  samu_aghehowa_porto: 2000211219,
  georges_mikautadze_villarreal: 49043189,
  evanilson_bournemouth: 19342183,
  jean_philippe_mateta_palace: 49034219,
  jonathan_burkardt_frankfurt: 91170086,
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

export const SORTITOUTSI_1000_ADDITIONS: Player[] = [
  // Defensores e laterais
  catalogPlayer({ id: 'alejandro_balde_barcelona', shortName: 'Balde', fullName: 'Alejandro Balde', position: 'LB', secondaryPositions: ['LWB'], nation: 'Espanha', club: 'Barcelona', season: '2025/26', overall: 82, pace: 91, shooting: 32, passing: 73, dribbling: 82, defending: 67, physical: 73, composure: 70, vision: 54 }),
  catalogPlayer({ id: 'willy_kambwala_villarreal', shortName: 'Kambwala', fullName: 'Willy Kambwala', position: 'CB', nation: 'França', club: 'Villarreal', season: '2025/26', overall: 76, pace: 73, shooting: 19, passing: 59, dribbling: 37, defending: 75, physical: 78, composure: 62, vision: 36 }),
  catalogPlayer({ id: 'ousmane_diomande_sporting', shortName: 'Diomande', fullName: 'Ousmane Diomande', position: 'CB', nation: 'Costa do Marfim', club: 'Sporting CP', season: '2025/26', overall: 82, pace: 78, shooting: 25, passing: 67, dribbling: 46, defending: 82, physical: 85, composure: 68, vision: 42 }),
  catalogPlayer({ id: 'samson_baidoo_lens', shortName: 'Baidoo', fullName: 'Samson Baidoo', position: 'CB', secondaryPositions: ['CDM'], nation: 'Áustria', club: 'Lens', season: '2025/26', overall: 75, pace: 70, shooting: 20, passing: 58, dribbling: 34, defending: 74, physical: 75, composure: 61, vision: 35 }),
  catalogPlayer({ id: 'aaron_anselmino_strasbourg', shortName: 'Anselmino', fullName: 'Aarón Anselmino', position: 'CB', nation: 'Argentina', club: 'Strasbourg', season: '2025/26', overall: 77, pace: 68, shooting: 23, passing: 63, dribbling: 39, defending: 78, physical: 76, composure: 64, vision: 38 }),
  catalogPlayer({ id: 'el_chadaille_bitshiabu_leipzig', shortName: 'Bitshiabu', fullName: 'El Chadaille Bitshiabu', position: 'CB', secondaryPositions: ['LB'], nation: 'França', club: 'RB Leipzig', season: '2025/26', overall: 76, pace: 67, shooting: 18, passing: 57, dribbling: 31, defending: 73, physical: 86, composure: 57, vision: 32 }),
  catalogPlayer({ id: 'jon_martin_sociedad', shortName: 'Jon Martín', fullName: 'Jon Martín', position: 'CB', nation: 'Espanha', club: 'Real Sociedad', season: '2025/26', overall: 74, pace: 63, shooting: 17, passing: 55, dribbling: 29, defending: 72, physical: 70, composure: 59, vision: 33 }),
  catalogPlayer({ id: 'juanlu_sevilla', shortName: 'Juanlu', fullName: 'Juanlu Sánchez', position: 'RB', secondaryPositions: ['RW'], nation: 'Espanha', club: 'Sevilla', season: '2025/26', overall: 78, pace: 83, shooting: 43, passing: 68, dribbling: 75, defending: 61, physical: 65, composure: 67, vision: 56 }),
  catalogPlayer({ id: 'tiago_gabriel_lecce', shortName: 'Tiago Gabriel', fullName: 'Tiago Gabriel', position: 'CB', nation: 'Portugal', club: 'Lecce', season: '2025/26', overall: 73, pace: 65, shooting: 16, passing: 54, dribbling: 27, defending: 70, physical: 69, composure: 55, vision: 30 }),
  catalogPlayer({ id: 'rico_lewis_city', shortName: 'Rico Lewis', fullName: 'Rico Lewis', position: 'RB', secondaryPositions: ['CDM'], nation: 'Inglaterra', club: 'Manchester City', season: '2025/26', overall: 82, pace: 79, shooting: 35, passing: 82, dribbling: 81, defending: 69, physical: 56, composure: 78, vision: 77 }),
  catalogPlayer({ id: 'zeno_debast_sporting', shortName: 'Debast', fullName: 'Zeno Debast', position: 'CB', nation: 'Bélgica', club: 'Sporting CP', season: '2025/26', overall: 79, pace: 74, shooting: 26, passing: 70, dribbling: 43, defending: 76, physical: 75, composure: 67, vision: 48 }),
  catalogPlayer({ id: 'jose_neto_benfica', shortName: 'José Neto', fullName: 'José Neto', position: 'LB', nation: 'Portugal', club: 'Benfica', season: '2025/26', overall: 73, pace: 80, shooting: 25, passing: 60, dribbling: 69, defending: 57, physical: 61, composure: 58, vision: 43 }),
  catalogPlayer({ id: 'gerard_martin_barcelona', shortName: 'Gerard Martín', fullName: 'Gerard Martín Langreo', position: 'LB', secondaryPositions: ['CB'], nation: 'Espanha', club: 'Barcelona', season: '2025/26', overall: 77, pace: 78, shooting: 24, passing: 65, dribbling: 68, defending: 59, physical: 60, composure: 62, vision: 45 }),
  catalogPlayer({ id: 'ben_nelson_leicester', shortName: 'Ben Nelson', fullName: 'Ben Nelson', position: 'CB', nation: 'Inglaterra', club: 'Leicester City', season: '2025/26', overall: 73, pace: 61, shooting: 15, passing: 49, dribbling: 24, defending: 69, physical: 72, composure: 53, vision: 29 }),
  catalogPlayer({ id: 'axel_tape_leverkusen', shortName: 'Axel Tape', fullName: 'Axel Tape', position: 'CB', secondaryPositions: ['CDM'], nation: 'França', club: 'Bayer Leverkusen', season: '2025/26', overall: 72, pace: 68, shooting: 17, passing: 52, dribbling: 29, defending: 67, physical: 74, composure: 49, vision: 31 }),
  catalogPlayer({ id: 'nuno_tavares_lazio', shortName: 'Nuno Tavares', fullName: 'Nuno Tavares', position: 'LB', secondaryPositions: ['LWB'], nation: 'Portugal', club: 'Lazio', season: '2025/26', overall: 80, pace: 93, shooting: 28, passing: 61, dribbling: 78, defending: 53, physical: 67, composure: 62, vision: 40 }),
  catalogPlayer({ id: 'alex_jimenez_bournemouth', shortName: 'Álex Jiménez', fullName: 'Álex Jiménez', position: 'RB', secondaryPositions: ['LB', 'RW'], nation: 'Espanha', club: 'Bournemouth', season: '2025/26', overall: 77, pace: 86, shooting: 31, passing: 67, dribbling: 73, defending: 60, physical: 63, composure: 64, vision: 48 }),
  catalogPlayer({ id: 'honest_ahanor_atalanta', shortName: 'Ahanor', fullName: 'Honest Ahanor', position: 'CB', secondaryPositions: ['LB'], nation: 'Itália', club: 'Atalanta', season: '2025/26', overall: 72, pace: 78, shooting: 14, passing: 48, dribbling: 31, defending: 64, physical: 66, composure: 50, vision: 27 }),
  catalogPlayer({ id: 'jofre_torrents_barcelona', shortName: 'Jofre Torrents', fullName: 'Jofre Torrents', position: 'LB', nation: 'Espanha', club: 'Barcelona', season: '2025/26', overall: 73, pace: 82, shooting: 22, passing: 58, dribbling: 67, defending: 55, physical: 59, composure: 54, vision: 39 }),

  // Meio-campistas
  catalogPlayer({ id: 'fabian_psg', shortName: 'Fabián', fullName: 'Fabián Ruiz', position: 'CM', secondaryPositions: ['CDM', 'CAM'], nation: 'Espanha', club: 'Paris Saint-Germain', season: '2025/26', overall: 85, pace: 58, shooting: 62, passing: 90, dribbling: 79, defending: 65, physical: 73, composure: 88, vision: 91 }),
  catalogPlayer({ id: 'zambo_anguissa_napoli', shortName: 'Zambo Anguissa', fullName: 'André-Frank Zambo Anguissa', position: 'CDM', secondaryPositions: ['CM'], nation: 'Camarões', club: 'Napoli', season: '2025/26', overall: 84, pace: 72, shooting: 34, passing: 76, dribbling: 82, defending: 82, physical: 91, composure: 78, vision: 69 }),
  catalogPlayer({ id: 'manu_kone_roma', shortName: 'Manu Koné', fullName: 'Manu Koné', position: 'CDM', secondaryPositions: ['CM'], nation: 'França', club: 'Roma', season: '2025/26', overall: 83, pace: 78, shooting: 42, passing: 72, dribbling: 84, defending: 77, physical: 86, composure: 75, vision: 60 }),
  catalogPlayer({ id: 'ryan_gravenberch_liverpool', shortName: 'Gravenberch', fullName: 'Ryan Gravenberch', position: 'CM', secondaryPositions: ['CDM'], nation: 'Holanda', club: 'Liverpool', season: '2025/26', overall: 84, pace: 77, shooting: 49, passing: 81, dribbling: 86, defending: 67, physical: 79, composure: 79, vision: 75 }),
  catalogPlayer({ id: 'matheus_nunes_city', shortName: 'Matheus Nunes', fullName: 'Matheus Nunes', position: 'CM', secondaryPositions: ['CDM', 'RB'], nation: 'Portugal', club: 'Manchester City', season: '2025/26', overall: 82, pace: 82, shooting: 38, passing: 77, dribbling: 82, defending: 61, physical: 78, composure: 71, vision: 62 }),
  catalogPlayer({ id: 'joelinton_newcastle', shortName: 'Joelinton', fullName: 'Joelinton', position: 'CM', secondaryPositions: ['CAM', 'CDM'], nation: 'Brasil', club: 'Newcastle', season: '2025/26', overall: 83, pace: 70, shooting: 53, passing: 71, dribbling: 76, defending: 78, physical: 92, composure: 76, vision: 55 }),
  catalogPlayer({ id: 'amine_gouiri_marseille', shortName: 'Gouiri', fullName: 'Amine Gouiri', position: 'ST', secondaryPositions: ['LW', 'CAM'], nation: 'Argélia', club: 'Marseille', season: '2025/26', overall: 81, pace: 74, shooting: 78, passing: 67, dribbling: 81, defending: 15, physical: 55, composure: 77, vision: 56 }),
  catalogPlayer({ id: 'exequiel_palacios_leverkusen', shortName: 'Palacios', fullName: 'Exequiel Palacios', position: 'CM', secondaryPositions: ['CDM'], nation: 'Argentina', club: 'Bayer Leverkusen', season: '2025/26', overall: 84, pace: 64, shooting: 44, passing: 86, dribbling: 78, defending: 70, physical: 64, composure: 83, vision: 88 }),
  catalogPlayer({ id: 'bernardo_silva_city', shortName: 'Bernardo Silva', fullName: 'Bernardo Silva', position: 'CAM', secondaryPositions: ['CM', 'RW'], nation: 'Portugal', club: 'Manchester City', season: '2025/26', overall: 86, pace: 67, shooting: 55, passing: 91, dribbling: 93, defending: 42, physical: 58, composure: 93, vision: 94 }),
  catalogPlayer({ id: 'nico_gonzalez_city', shortName: 'Nico González', fullName: 'Nico González', position: 'CM', secondaryPositions: ['CAM'], nation: 'Espanha', club: 'Manchester City', season: '2025/26', overall: 81, pace: 69, shooting: 42, passing: 80, dribbling: 77, defending: 62, physical: 70, composure: 70, vision: 76 }),
  catalogPlayer({ id: 'pablo_barrios_atletico', shortName: 'Pablo Barrios', fullName: 'Pablo Barrios', position: 'CM', secondaryPositions: ['CDM'], nation: 'Espanha', club: 'Atlético Madrid', season: '2025/26', overall: 80, pace: 64, shooting: 31, passing: 78, dribbling: 79, defending: 63, physical: 60, composure: 72, vision: 79 }),
  catalogPlayer({ id: 'johnny_cardoso_atletico', shortName: 'Johnny', fullName: 'Johnny Cardoso', position: 'CDM', secondaryPositions: ['CM', 'CAM'], nation: 'Estados Unidos', club: 'Atlético Madrid', season: '2025/26', overall: 82, pace: 67, shooting: 29, passing: 76, dribbling: 67, defending: 78, physical: 79, composure: 70, vision: 54 }),
  catalogPlayer({ id: 'mikel_merino_arsenal', shortName: 'Merino', fullName: 'Mikel Merino', position: 'CM', secondaryPositions: ['CDM'], nation: 'Espanha', club: 'Arsenal', season: '2025/26', overall: 84, pace: 55, shooting: 56, passing: 84, dribbling: 74, defending: 72, physical: 84, composure: 82, vision: 81 }),
  catalogPlayer({ id: 'henrikh_mkhitaryan_inter', shortName: 'Mkhitaryan', fullName: 'Henrikh Mkhitaryan', position: 'CM', secondaryPositions: ['CAM', 'CDM'], nation: 'Armênia', club: 'Inter Milan', season: '2025/26', overall: 83, pace: 58, shooting: 58, passing: 86, dribbling: 82, defending: 54, physical: 62, composure: 89, vision: 90 }),
  catalogPlayer({ id: 'khephren_thuram_juventus', shortName: 'Khéphren Thuram', fullName: 'Khéphren Thuram', position: 'CM', secondaryPositions: ['CDM'], nation: 'França', club: 'Juventus', season: '2025/26', overall: 82, pace: 76, shooting: 37, passing: 75, dribbling: 80, defending: 66, physical: 86, composure: 70, vision: 61 }),
  catalogPlayer({ id: 'curtis_jones_liverpool', shortName: 'Curtis Jones', fullName: 'Curtis Jones', position: 'CM', secondaryPositions: ['CAM'], nation: 'Inglaterra', club: 'Liverpool', season: '2025/26', overall: 82, pace: 69, shooting: 43, passing: 82, dribbling: 86, defending: 53, physical: 65, composure: 77, vision: 78 }),
  catalogPlayer({ id: 'gabriel_jesus_arsenal', shortName: 'Gabriel Jesus', fullName: 'Gabriel Jesus', position: 'ST', secondaryPositions: ['LW', 'CAM'], nation: 'Brasil', club: 'Arsenal', season: '2025/26', overall: 83, pace: 83, shooting: 79, passing: 61, dribbling: 84, defending: 20, physical: 66, composure: 75, vision: 46 }),
  catalogPlayer({ id: 'rafael_leao_milan', shortName: 'Rafael Leão', fullName: 'Rafael Leão', position: 'LW', secondaryPositions: ['ST'], nation: 'Portugal', club: 'Milan', season: '2025/26', overall: 86, pace: 95, shooting: 77, passing: 66, dribbling: 92, defending: 15, physical: 78, composure: 74, vision: 48 }),

  // Pontas e meias abertos
  catalogPlayer({ id: 'marcus_rashford_barcelona', shortName: 'Rashford', fullName: 'Marcus Rashford', position: 'LW', secondaryPositions: ['ST'], nation: 'Inglaterra', club: 'Barcelona', season: '2025/26', overall: 84, pace: 91, shooting: 84, passing: 72, dribbling: 85, defending: 28, physical: 76, composure: 72, vision: 59 }),
  catalogPlayer({ id: 'kang_in_lee_psg', shortName: 'Kang-In Lee', fullName: 'Kang-In Lee', position: 'RW', secondaryPositions: ['LW', 'CAM'], nation: 'Coreia do Sul', club: 'Paris Saint-Germain', season: '2025/26', overall: 84, pace: 76, shooting: 59, passing: 89, dribbling: 88, defending: 27, physical: 57, composure: 82, vision: 91 }),
  catalogPlayer({ id: 'leandro_trossard_arsenal', shortName: 'Trossard', fullName: 'Leandro Trossard', position: 'LW', secondaryPositions: ['RW', 'ST'], nation: 'Bélgica', club: 'Arsenal', season: '2025/26', overall: 83, pace: 79, shooting: 80, passing: 79, dribbling: 84, defending: 31, physical: 62, composure: 84, vision: 70 }),
  catalogPlayer({ id: 'iliman_ndiaye_everton', shortName: 'Ndiaye', fullName: 'Iliman N’Diaye', position: 'CAM', secondaryPositions: ['ST', 'RW'], nation: 'Senegal', club: 'Everton', season: '2025/26', overall: 80, pace: 82, shooting: 48, passing: 73, dribbling: 86, defending: 24, physical: 60, composure: 70, vision: 61 }),
  catalogPlayer({ id: 'pote_sporting', shortName: 'Pote', fullName: 'Pedro Gonçalves', position: 'CAM', secondaryPositions: ['LW', 'RW'], nation: 'Portugal', club: 'Sporting CP', season: '2025/26', overall: 84, pace: 80, shooting: 82, passing: 81, dribbling: 86, defending: 34, physical: 55, composure: 83, vision: 78 }),
  catalogPlayer({ id: 'federico_chiesa_liverpool', shortName: 'Chiesa', fullName: 'Federico Chiesa', position: 'LW', secondaryPositions: ['RW'], nation: 'Itália', club: 'Liverpool', season: '2025/26', overall: 84, pace: 91, shooting: 78, passing: 72, dribbling: 88, defending: 29, physical: 69, composure: 76, vision: 57 }),
  catalogPlayer({ id: 'mattia_zaccagni_lazio', shortName: 'Zaccagni', fullName: 'Mattia Zaccagni', position: 'LW', secondaryPositions: ['CAM'], nation: 'Itália', club: 'Lazio', season: '2025/26', overall: 83, pace: 80, shooting: 73, passing: 78, dribbling: 89, defending: 24, physical: 55, composure: 81, vision: 69 }),
  catalogPlayer({ id: 'kingsley_coman_al_nassr', shortName: 'Coman', fullName: 'Kingsley Coman', position: 'LW', secondaryPositions: ['RW'], nation: 'França', club: 'Al Nassr', season: '2025/26', overall: 84, pace: 93, shooting: 68, passing: 74, dribbling: 91, defending: 22, physical: 62, composure: 74, vision: 61 }),
  catalogPlayer({ id: 'justin_kluivert_bournemouth', shortName: 'Kluivert', fullName: 'Justin Kluivert', position: 'LW', secondaryPositions: ['CAM', 'RW'], nation: 'Holanda', club: 'Bournemouth', season: '2025/26', overall: 80, pace: 87, shooting: 65, passing: 70, dribbling: 85, defending: 22, physical: 54, composure: 70, vision: 62 }),
  catalogPlayer({ id: 'alex_berenguer_bilbao', shortName: 'Berenguer', fullName: 'Álex Berenguer', position: 'LW', secondaryPositions: ['RW'], nation: 'Espanha', club: 'Athletic Bilbao', season: '2025/26', overall: 81, pace: 75, shooting: 72, passing: 74, dribbling: 83, defending: 28, physical: 55, composure: 78, vision: 67 }),
  catalogPlayer({ id: 'callum_hudson_odoi_forest', shortName: 'Hudson-Odoi', fullName: 'Callum Hudson-Odoi', position: 'LW', secondaryPositions: ['RW', 'CAM'], nation: 'Inglaterra', club: 'Nottingham Forest', season: '2025/26', overall: 79, pace: 88, shooting: 53, passing: 69, dribbling: 83, defending: 19, physical: 52, composure: 64, vision: 57 }),
  catalogPlayer({ id: 'ander_barrenetxea_sociedad', shortName: 'Barrenetxea', fullName: 'Ander Barrenetxea', position: 'LW', secondaryPositions: ['RW'], nation: 'Espanha', club: 'Real Sociedad', season: '2025/26', overall: 80, pace: 86, shooting: 47, passing: 68, dribbling: 84, defending: 21, physical: 49, composure: 62, vision: 55 }),
  catalogPlayer({ id: 'timothy_weah_marseille', shortName: 'Timothy Weah', fullName: 'Timothy Weah', position: 'RW', secondaryPositions: ['RM', 'ST'], nation: 'Estados Unidos', club: 'Marseille', season: '2025/26', overall: 80, pace: 88, shooting: 62, passing: 65, dribbling: 79, defending: 31, physical: 70, composure: 64, vision: 45 }),
  catalogPlayer({ id: 'ivan_perisic_psv', shortName: 'Perišić', fullName: 'Ivan Perišić', position: 'LW', secondaryPositions: ['RW'], nation: 'Croácia', club: 'PSV', season: '2025/26', overall: 82, pace: 79, shooting: 77, passing: 78, dribbling: 79, defending: 40, physical: 76, composure: 84, vision: 71 }),
  catalogPlayer({ id: 'bryan_zaragoza_roma', shortName: 'Bryan Zaragoza', fullName: 'Bryan Zaragoza', position: 'LW', secondaryPositions: ['RW'], nation: 'Espanha', club: 'Roma', season: '2025/26', overall: 79, pace: 94, shooting: 43, passing: 64, dribbling: 92, defending: 17, physical: 42, composure: 57, vision: 54 }),
  catalogPlayer({ id: 'ez_abde_betis', shortName: 'Abde', fullName: 'Ez Abde', position: 'LW', secondaryPositions: ['RW', 'ST'], nation: 'Marrocos', club: 'Real Betis', season: '2025/26', overall: 80, pace: 93, shooting: 48, passing: 66, dribbling: 90, defending: 18, physical: 48, composure: 61, vision: 56 }),
  catalogPlayer({ id: 'baris_alper_yilmaz_galatasaray', shortName: 'Barış Alper', fullName: 'Barış Alper Yılmaz', position: 'RW', secondaryPositions: ['LW', 'ST'], nation: 'Turquia', club: 'Galatasaray', season: '2025/26', overall: 81, pace: 90, shooting: 67, passing: 62, dribbling: 78, defending: 23, physical: 81, composure: 65, vision: 42 }),
  catalogPlayer({ id: 'ruben_vargas_sevilla', shortName: 'Rubén Vargas', fullName: 'Rubén Vargas', position: 'LW', secondaryPositions: ['RW', 'CAM'], nation: 'Suíça', club: 'Sevilla', season: '2025/26', overall: 79, pace: 86, shooting: 55, passing: 68, dribbling: 82, defending: 20, physical: 58, composure: 65, vision: 57 }),
  catalogPlayer({ id: 'igor_paixao_marseille', shortName: 'Igor Paixão', fullName: 'Igor Paixão', position: 'LW', secondaryPositions: ['RW', 'ST'], nation: 'Brasil', club: 'Marseille', season: '2025/26', overall: 81, pace: 88, shooting: 57, passing: 70, dribbling: 85, defending: 19, physical: 52, composure: 67, vision: 59 }),

  // Atacantes
  catalogPlayer({ id: 'marcus_thuram_inter', shortName: 'Thuram', fullName: 'Marcus Thuram', position: 'ST', secondaryPositions: ['LW'], nation: 'França', club: 'Inter Milan', season: '2025/26', overall: 87, pace: 89, shooting: 83, passing: 66, dribbling: 86, defending: 18, physical: 88, composure: 79, vision: 49 }),
  catalogPlayer({ id: 'victor_osimhen_galatasaray', shortName: 'Osimhen', fullName: 'Victor Osimhen', position: 'ST', nation: 'Nigéria', club: 'Galatasaray', season: '2025/26', overall: 88, pace: 91, shooting: 91, passing: 36, dribbling: 77, defending: 12, physical: 88, composure: 73, vision: 28 }),
  catalogPlayer({ id: 'kai_havertz_arsenal', shortName: 'Havertz', fullName: 'Kai Havertz', position: 'ST', secondaryPositions: ['CAM'], nation: 'Alemanha', club: 'Arsenal', season: '2025/26', overall: 84, pace: 79, shooting: 78, passing: 76, dribbling: 78, defending: 24, physical: 78, composure: 81, vision: 67 }),
  catalogPlayer({ id: 'deniz_undav_stuttgart', shortName: 'Undav', fullName: 'Deniz Undav', position: 'ST', secondaryPositions: ['CAM'], nation: 'Alemanha', club: 'Stuttgart', season: '2025/26', overall: 83, pace: 63, shooting: 86, passing: 69, dribbling: 75, defending: 10, physical: 70, composure: 85, vision: 60 }),
  catalogPlayer({ id: 'luis_suarez_sporting', shortName: 'Luis Suárez', fullName: 'Luis Javier Suárez', position: 'ST', nation: 'Colômbia', club: 'Sporting CP', season: '2025/26', overall: 82, pace: 82, shooting: 84, passing: 39, dribbling: 72, defending: 9, physical: 81, composure: 75, vision: 31 }),
  catalogPlayer({ id: 'goncalo_ramos_psg', shortName: 'Gonçalo Ramos', fullName: 'Gonçalo Ramos', position: 'ST', nation: 'Portugal', club: 'Paris Saint-Germain', season: '2025/26', overall: 84, pace: 77, shooting: 86, passing: 44, dribbling: 73, defending: 16, physical: 77, composure: 77, vision: 32 }),
  catalogPlayer({ id: 'inaki_williams_bilbao', shortName: 'Iñaki Williams', fullName: 'Iñaki Williams', position: 'ST', secondaryPositions: ['RW'], nation: 'Gana', club: 'Athletic Bilbao', season: '2025/26', overall: 83, pace: 94, shooting: 74, passing: 50, dribbling: 80, defending: 14, physical: 83, composure: 68, vision: 34 }),
  catalogPlayer({ id: 'ivan_toney_al_nassr', shortName: 'Toney', fullName: 'Ivan Toney', position: 'ST', nation: 'Inglaterra', club: 'Al Nassr', season: '2025/26', overall: 84, pace: 70, shooting: 87, passing: 47, dribbling: 70, defending: 12, physical: 86, composure: 82, vision: 35 }),
  catalogPlayer({ id: 'alexander_sorloth_atletico', shortName: 'Sørloth', fullName: 'Alexander Sørloth', position: 'ST', nation: 'Noruega', club: 'Atlético Madrid', season: '2025/26', overall: 84, pace: 77, shooting: 88, passing: 40, dribbling: 71, defending: 8, physical: 91, composure: 80, vision: 30 }),
  catalogPlayer({ id: 'maximilian_beier_dortmund', shortName: 'Beier', fullName: 'Maximilian Beier', position: 'ST', secondaryPositions: ['RW'], nation: 'Alemanha', club: 'Borussia Dortmund', season: '2025/26', overall: 81, pace: 89, shooting: 73, passing: 45, dribbling: 75, defending: 11, physical: 63, composure: 65, vision: 31 }),
  catalogPlayer({ id: 'moise_kean_fiorentina', shortName: 'Kean', fullName: 'Moise Kean', position: 'ST', nation: 'Itália', club: 'Fiorentina', season: '2025/26', overall: 83, pace: 86, shooting: 82, passing: 34, dribbling: 77, defending: 8, physical: 84, composure: 67, vision: 25 }),
  catalogPlayer({ id: 'tim_kleindienst_gladbach', shortName: 'Kleindienst', fullName: 'Tim Kleindienst', position: 'ST', nation: 'Alemanha', club: "Borussia M'gladbach", season: '2025/26', overall: 82, pace: 61, shooting: 84, passing: 36, dribbling: 63, defending: 7, physical: 89, composure: 76, vision: 24 }),
  catalogPlayer({ id: 'lois_openda_juventus', shortName: 'Openda', fullName: 'Loïs Openda', position: 'ST', secondaryPositions: ['CAM'], nation: 'Bélgica', club: 'Juventus', season: '2025/26', overall: 84, pace: 94, shooting: 83, passing: 34, dribbling: 86, defending: 8, physical: 72, composure: 70, vision: 27 }),
  catalogPlayer({ id: 'donyell_malen_roma', shortName: 'Malen', fullName: 'Donyell Malen', position: 'ST', secondaryPositions: ['RW'], nation: 'Holanda', club: 'Roma', season: '2025/26', overall: 82, pace: 89, shooting: 78, passing: 41, dribbling: 80, defending: 8, physical: 65, composure: 66, vision: 29 }),
  catalogPlayer({ id: 'samu_aghehowa_porto', shortName: 'Samu', fullName: 'Samu Aghehowa', position: 'ST', nation: 'Espanha', club: 'Porto', season: '2025/26', overall: 82, pace: 85, shooting: 82, passing: 28, dribbling: 65, defending: 5, physical: 92, composure: 62, vision: 19 }),
  catalogPlayer({ id: 'georges_mikautadze_villarreal', shortName: 'Mikautadze', fullName: 'Georges Mikautadze', position: 'ST', secondaryPositions: ['LW'], nation: 'Geórgia', club: 'Villarreal', season: '2025/26', overall: 81, pace: 82, shooting: 81, passing: 53, dribbling: 82, defending: 11, physical: 55, composure: 74, vision: 41 }),
  catalogPlayer({ id: 'evanilson_bournemouth', shortName: 'Evanilson', fullName: 'Evanilson', position: 'ST', nation: 'Brasil', club: 'Bournemouth', season: '2025/26', overall: 82, pace: 81, shooting: 83, passing: 42, dribbling: 74, defending: 9, physical: 77, composure: 71, vision: 25 }),
  catalogPlayer({ id: 'jean_philippe_mateta_palace', shortName: 'Mateta', fullName: 'Jean-Philippe Mateta', position: 'ST', nation: 'França', club: 'Crystal Palace', season: '2025/26', overall: 82, pace: 77, shooting: 85, passing: 32, dribbling: 66, defending: 5, physical: 90, composure: 78, vision: 22 }),
  catalogPlayer({ id: 'jonathan_burkardt_frankfurt', shortName: 'Burkardt', fullName: 'Jonathan Burkardt', position: 'ST', nation: 'Alemanha', club: 'Eintracht Frankfurt', season: '2025/26', overall: 82, pace: 82, shooting: 80, passing: 42, dribbling: 75, defending: 10, physical: 66, composure: 73, vision: 31 }),
];
