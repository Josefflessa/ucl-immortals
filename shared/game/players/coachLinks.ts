import type { Player } from '../gameData';

/**
 * Cartas que passaram a ter o técnico entre os "técnicos históricos" (química de técnico), sem mexer
 * na ficha de cada carta. Luis Enrique tinha só 3 cartas ligadas a ele e Zidane 14 (Guardiola, 51;
 * Mourinho, 48; Ancelotti, 46), então os dois quase nunca davam química de técnico.
 * Luis Enrique: Barcelona 2014–17 (MSN) e PSG 2023–25. Zidane: Real Madrid 2016–18 e 2019–21.
 */
export const EXTRA_COACH_LINKS: Record<string, string[]> = {
  // Luis Enrique — Barcelona
  messi: ['luis_enrique'], neymar: ['luis_enrique'], iniesta: ['luis_enrique'], busquets: ['luis_enrique'],
  xavi: ['luis_enrique'], alves: ['luis_enrique'], mascherano: ['luis_enrique'], pedro: ['luis_enrique'],
  terstegen: ['luis_enrique'], rakitic: ['luis_enrique'], pique: ['luis_enrique'], jordi_alba: ['luis_enrique'],
  bravo_barcelona_2014_15: ['luis_enrique'], turan_barcelona_2016_17: ['luis_enrique'], mathieu_barcelona_2015_16: ['luis_enrique'],
  // Luis Enrique — PSG
  marquinhos: ['luis_enrique'], mbappe: ['luis_enrique'], hakimi: ['luis_enrique'], donnarumma_psg_2021_22: ['luis_enrique'],
  kimpembe_psg_2020_21: ['luis_enrique'], goncalo_ramos_psg: ['luis_enrique'],
  // Zidane — Real Madrid
  asensio_real_madrid: ['zidane'], hazard_real_madrid_2019_20: ['zidane'], isco_real_madrid_2018_19: ['zidane'],
  keylor_navas: ['zidane'], kovacic_real_madrid_2017_18: ['zidane'],
};

export function withExtraCoachLinks(player: Player): Player {
  const extra = EXTRA_COACH_LINKS[player.id];
  if (!extra) return player;
  const merged = Array.from(new Set([...(player.historicalCoaches ?? []), ...extra]));
  return { ...player, historicalCoaches: merged };
}
