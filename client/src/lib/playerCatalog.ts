import { PLAYERS, UNIQUE_CARDS, type Player } from './gameData';
import { clubIdForName } from './crests';
import { CLUB_CATALOG, CLUBS_BY_ID, type ClubCatalogEntry } from './clubCatalog';

export type CatalogPlayer = Player & { isUnique: boolean };

export interface CatalogClub extends ClubCatalogEntry {
  players: CatalogPlayer[];
}

export interface CatalogLeague {
  id: string;
  name: string;
  countryId: string;
  countryName: string;
  clubs: CatalogClub[];
  playerCount: number;
}

export interface CatalogCountry {
  id: string;
  name: string;
  leagues: CatalogLeague[];
  playerCount: number;
}

export interface PlayerCatalog {
  players: CatalogPlayer[];
  countries: CatalogCountry[];
  clubs: CatalogClub[];
  leagues: CatalogLeague[];
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function catalogClubForPlayer(player: Pick<Player, 'club' | 'clubId'>): ClubCatalogEntry {
  const id = player.clubId || clubIdForName(player.club);
  const club = CLUBS_BY_ID[id];
  if (!club) {
    throw new Error(`Jogador "${player.club}" aponta para o clube "${id}", que não existe no catálogo.`);
  }
  return club;
}

export function buildPlayerCatalog(
  players: readonly Player[] = [...PLAYERS, ...UNIQUE_CARDS],
): PlayerCatalog {
  const uniquePlayers = Array.from(
    new Map(players.map(player => [player.id, {
      ...player,
      isUnique: player.rarity === 'unique',
    }])).values(),
  );

  const countryMap = new Map<string, {
    id: string;
    name: string;
    leagues: Map<string, {
      id: string;
      name: string;
      countryId: string;
      countryName: string;
      clubs: Map<string, CatalogClub>;
    }>;
  }>();

  for (const player of uniquePlayers) {
    const club = catalogClubForPlayer(player);
    let country = countryMap.get(club.countryId);
    if (!country) {
      country = { id: club.countryId, name: club.countryName, leagues: new Map() };
      countryMap.set(country.id, country);
    }

    let league = country.leagues.get(club.leagueId);
    if (!league) {
      league = {
        id: club.leagueId,
        name: club.leagueName,
        countryId: club.countryId,
        countryName: club.countryName,
        clubs: new Map(),
      };
      country.leagues.set(league.id, league);
    }

    let catalogClub = league.clubs.get(club.id);
    if (!catalogClub) {
      catalogClub = { ...club, players: [] };
      league.clubs.set(catalogClub.id, catalogClub);
    }
    catalogClub.players.push(player);
  }

  const countries: CatalogCountry[] = sortByName(Array.from(countryMap.values()).map(country => {
    const leagues = sortByName(Array.from(country.leagues.values()).map(league => {
      const clubs = sortByName(Array.from(league.clubs.values()).map(club => ({
        ...club,
        players: club.players.slice().sort((a, b) => a.shortName.localeCompare(b.shortName, 'pt-BR')),
      })));
      return {
        id: league.id,
        name: league.name,
        countryId: league.countryId,
        countryName: league.countryName,
        clubs,
        playerCount: clubs.reduce((total, club) => total + club.players.length, 0),
      };
    }));
    return {
      id: country.id,
      name: country.name,
      leagues,
      playerCount: leagues.reduce((total, league) => total + league.playerCount, 0),
    };
  }));

  const leagues = countries.flatMap(country => country.leagues);
  const clubs = leagues.flatMap(league => league.clubs);

  return {
    players: uniquePlayers,
    countries,
    leagues,
    clubs,
  };
}

export const PLAYER_CATALOG = buildPlayerCatalog();

export function getPlayerCatalogPath(player: Pick<Player, 'club' | 'clubId'>): {
  country: CatalogCountry;
  league: CatalogLeague;
  club: CatalogClub;
} {
  const clubId = player.clubId || clubIdForName(player.club);
  const club = PLAYER_CATALOG.clubs.find(item => item.id === clubId);
  if (!club) throw new Error(`Clube "${clubId}" não possui jogadores no catálogo.`);
  const league = PLAYER_CATALOG.leagues.find(item => item.id === club.leagueId && item.countryId === club.countryId);
  if (!league) throw new Error(`Liga "${club.leagueId}" não possui o clube "${club.id}" no catálogo.`);
  const country = PLAYER_CATALOG.countries.find(item => item.id === club.countryId);
  if (!country) throw new Error(`País "${club.countryId}" não possui a liga "${league.id}" no catálogo.`);
  return { country, league, club };
}

// Mantém uma verificação explícita contra clubes do catálogo de escudos que
// ainda não receberam jogadores. Eles continuam válidos para a tela de escudos,
// mas não aparecem indevidamente como categorias vazias no catálogo de cartas.
export const UNUSED_CATALOG_CLUBS = CLUB_CATALOG.filter(club => !PLAYER_CATALOG.clubs.some(playerClub => playerClub.id === club.id));
