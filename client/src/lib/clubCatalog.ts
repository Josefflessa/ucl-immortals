import { CREST_CATALOG, type CrestDef } from './crests';

/**
 * Organização competitiva dos clubes usados pelo catálogo de jogadores.
 *
 * O catálogo de escudos continua sendo a fonte do id/nome/arte do clube;
 * este módulo acrescenta a dimensão competitiva sem misturar essa regra com
 * química ou com a apresentação dos escudos.
 */
export interface ClubCatalogEntry {
  id: string;
  name: string;
  crestId: string;
  countryId: string;
  countryName: string;
  leagueId: string;
  leagueName: string;
}

interface CompetitionMetadata {
  countryId: string;
  countryName: string;
  leagueId: string;
  leagueName: string;
}

const GROUP_METADATA: Record<string, CompetitionMetadata> = {
  'Premier League 🇬🇧': { countryId: 'england', countryName: 'Inglaterra', leagueId: 'premier-league', leagueName: 'Premier League' },
  'La Liga 🇪🇸': { countryId: 'spain', countryName: 'Espanha', leagueId: 'la-liga', leagueName: 'La Liga' },
  'Serie A 🇮🇹': { countryId: 'italy', countryName: 'Itália', leagueId: 'serie-a', leagueName: 'Serie A' },
  'Bundesliga 🇩🇪': { countryId: 'germany', countryName: 'Alemanha', leagueId: 'bundesliga', leagueName: 'Bundesliga' },
  'Ligue 1 🇫🇷': { countryId: 'france', countryName: 'França', leagueId: 'ligue-1', leagueName: 'Ligue 1' },
  'Portugal 🇵🇹': { countryId: 'portugal', countryName: 'Portugal', leagueId: 'primeira-liga', leagueName: 'Primeira Liga' },
  'Eredivisie 🇳🇱': { countryId: 'netherlands', countryName: 'Holanda', leagueId: 'eredivisie', leagueName: 'Eredivisie' },
  'Escócia': { countryId: 'scotland', countryName: 'Escócia', leagueId: 'scottish-premiership', leagueName: 'Scottish Premiership' },
  'Turquia 🇹🇷': { countryId: 'turkey', countryName: 'Turquia', leagueId: 'super-lig', leagueName: 'Süper Lig' },
  'Grécia 🇬🇷': { countryId: 'greece', countryName: 'Grécia', leagueId: 'super-league-greece', leagueName: 'Super League' },
  'Bélgica 🇧🇪': { countryId: 'belgium', countryName: 'Bélgica', leagueId: 'belgian-pro-league', leagueName: 'Belgian Pro League' },
  'Áustria 🇦🇹': { countryId: 'austria', countryName: 'Áustria', leagueId: 'austrian-bundesliga', leagueName: 'Bundesliga Austríaca' },
  'Ucrânia 🇺🇦': { countryId: 'ukraine', countryName: 'Ucrânia', leagueId: 'ukrainian-premier-league', leagueName: 'Premier League Ucraniana' },
  'Rússia 🇷🇺': { countryId: 'russia', countryName: 'Rússia', leagueId: 'russian-premier-league', leagueName: 'Premier League Russa' },
  'Brasil 🇧🇷': { countryId: 'brazil', countryName: 'Brasil', leagueId: 'brasileirao', leagueName: 'Campeonato Brasileiro' },
  'Argentina 🇦🇷': { countryId: 'argentina', countryName: 'Argentina', leagueId: 'liga-profesional', leagueName: 'Liga Profesional' },
  'México 🇲🇽': { countryId: 'mexico', countryName: 'México', leagueId: 'liga-mx', leagueName: 'Liga MX' },
  'MLS 🇺🇸': { countryId: 'united-states', countryName: 'Estados Unidos', leagueId: 'mls', leagueName: 'MLS' },
};

// O grupo visual "Outros" reúne clubes de países e ligas diferentes. Eles
// precisam de uma classificação explícita para nunca cair em uma categoria
// genérica ou depender do nome exibido na carta.
const CLUB_METADATA_OVERRIDES: Record<string, CompetitionMetadata> = {
  watford: { countryId: 'england', countryName: 'Inglaterra', leagueId: 'efl-championship', leagueName: 'EFL Championship' },
  sunderland: { countryId: 'england', countryName: 'Inglaterra', leagueId: 'premier-league', leagueName: 'Premier League' },
  'red-star': { countryId: 'serbia', countryName: 'Sérvia', leagueId: 'serbian-superliga', leagueName: 'SuperLiga Sérvia' },
  'young-boys': { countryId: 'switzerland', countryName: 'Suíça', leagueId: 'swiss-super-league', leagueName: 'Swiss Super League' },
  'sparta-prague': { countryId: 'czechia', countryName: 'República Tcheca', leagueId: 'czech-first-league', leagueName: 'Czech First League' },
  'dinamo-zagreb': { countryId: 'croatia', countryName: 'Croácia', leagueId: 'croatian-first-league', leagueName: 'HNL' },
  girona: { countryId: 'spain', countryName: 'Espanha', leagueId: 'la-liga', leagueName: 'La Liga' },
  'al-nassr': { countryId: 'saudi-arabia', countryName: 'Arábia Saudita', leagueId: 'saudi-pro-league', leagueName: 'Saudi Pro League' },
  'atlanta-united': { countryId: 'united-states', countryName: 'Estados Unidos', leagueId: 'mls', leagueName: 'MLS' },
  'dalian-yifang': { countryId: 'china', countryName: 'China', leagueId: 'chinese-super-league', leagueName: 'Chinese Super League' },
  'dynamo-moscow': { countryId: 'russia', countryName: 'Rússia', leagueId: 'russian-premier-league', leagueName: 'Premier League Russa' },
  'hertha-bsc': { countryId: 'germany', countryName: 'Alemanha', leagueId: '2-bundesliga', leagueName: '2. Bundesliga' },
  hoffenheim: { countryId: 'germany', countryName: 'Alemanha', leagueId: 'bundesliga', leagueName: 'Bundesliga' },
  'lokomotiv-moscow': { countryId: 'russia', countryName: 'Rússia', leagueId: 'russian-premier-league', leagueName: 'Premier League Russa' },
  'los-angeles-fc': { countryId: 'united-states', countryName: 'Estados Unidos', leagueId: 'mls', leagueName: 'MLS' },
  basaksehir: { countryId: 'turkey', countryName: 'Turquia', leagueId: 'super-lig', leagueName: 'Süper Lig' },
  parma: { countryId: 'italy', countryName: 'Itália', leagueId: 'serie-a', leagueName: 'Serie A' },
  sassuolo: { countryId: 'italy', countryName: 'Itália', leagueId: 'serie-a', leagueName: 'Serie A' },
  'toronto-fc': { countryId: 'canada', countryName: 'Canadá', leagueId: 'mls', leagueName: 'MLS' },
  // Brasil representa uma seleção, não um clube de campeonato nacional.
  brazil: { countryId: 'brazil', countryName: 'Brasil', leagueId: 'national-teams', leagueName: 'Seleções' },
};

function metadataForClub(groupLeague: string, crest: CrestDef): CompetitionMetadata {
  const override = CLUB_METADATA_OVERRIDES[crest.id];
  if (override) return override;

  const groupMetadata = GROUP_METADATA[groupLeague];
  if (!groupMetadata) {
    throw new Error(`Clube "${crest.name}" não possui país/liga no catálogo.`);
  }
  return groupMetadata;
}

export const CLUB_CATALOG: ClubCatalogEntry[] = CREST_CATALOG.flatMap(group =>
  group.crests.map(crest => ({
    id: crest.id,
    name: crest.name,
    crestId: crest.id,
    ...metadataForClub(group.league, crest),
  })),
);

export const CLUBS_BY_ID: Record<string, ClubCatalogEntry> = Object.fromEntries(
  CLUB_CATALOG.map(club => [club.id, club]),
);

export function getClubCatalog(clubId: string | undefined | null): ClubCatalogEntry | null {
  return clubId ? CLUBS_BY_ID[clubId] ?? null : null;
}
