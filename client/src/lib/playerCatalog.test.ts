import { describe, expect, it } from 'vitest';
import { PLAYERS, UNIQUE_CARDS } from './gameData';
import { CLUB_CATALOG, CLUBS_BY_ID } from './clubCatalog';
import { buildPlayerCatalog, getPlayerCatalogPath, PLAYER_CATALOG } from './playerCatalog';

describe('catálogo hierárquico de jogadores', () => {
  it('classifica todas as cartas em país, liga e clube sem perder nenhuma', () => {
    const sourceCards = new Map([...PLAYERS, ...UNIQUE_CARDS].map(player => [player.id, player]));
    const catalogCards = new Map(PLAYER_CATALOG.players.map(player => [player.id, player]));

    expect(catalogCards.size).toBe(sourceCards.size);
    expect(PLAYER_CATALOG.countries.length).toBeGreaterThan(0);
    expect(PLAYER_CATALOG.leagues.length).toBeGreaterThan(0);
    expect(PLAYER_CATALOG.clubs.length).toBeGreaterThan(0);

    const nestedCardIds = PLAYER_CATALOG.countries.flatMap(country =>
      country.leagues.flatMap(league => league.clubs.flatMap(club => club.players.map(player => player.id))),
    );
    expect(new Set(nestedCardIds).size).toBe(catalogCards.size);
    expect(nestedCardIds).toHaveLength(catalogCards.size);
  });

  it('usa o país do clube, sem confundir com a nacionalidade do jogador', () => {
    const reijnders = PLAYER_CATALOG.players.find(player => player.id === 'reijnders');
    expect(reijnders?.nation).toBe('Holanda');
    expect(getPlayerCatalogPath(reijnders!).country.name).toBe('Inglaterra');
    expect(getPlayerCatalogPath(reijnders!).league.name).toBe('Premier League');
    expect(getPlayerCatalogPath(reijnders!).club.name).toBe('Manchester City');
  });

  it('mantém os clubes do catálogo de escudos com metadata competitiva', () => {
    expect(CLUB_CATALOG.length).toBe(Object.keys(CLUBS_BY_ID).length);
    for (const club of CLUB_CATALOG) {
      expect(club.countryId).toBeTruthy();
      expect(club.leagueId).toBeTruthy();
      expect(club.countryName).toBeTruthy();
      expect(club.leagueName).toBeTruthy();
    }
  });

  it('não duplica clubes dentro de uma mesma liga e país', () => {
    for (const country of PLAYER_CATALOG.countries) {
      const leagueIds = new Set<string>();
      for (const league of country.leagues) {
        expect(league.countryId).toBe(country.id);
        expect(leagueIds.has(league.id)).toBe(false);
        leagueIds.add(league.id);

        const clubIds = new Set<string>();
        for (const club of league.clubs) {
          expect(club.countryId).toBe(country.id);
          expect(club.leagueId).toBe(league.id);
          expect(clubIds.has(club.id)).toBe(false);
          clubIds.add(club.id);
        }
      }
    }
  });

  it('permite reconstruir o catálogo a partir de outra lista sem mutar as cartas', () => {
    const source = PLAYERS.slice(0, 12);
    const catalog = buildPlayerCatalog(source);
    expect(catalog.players).toHaveLength(source.length);
    expect(catalog.players.every(player => player.isUnique === false)).toBe(true);
    expect(source.every(player => !('isUnique' in player))).toBe(true);
  });
});
