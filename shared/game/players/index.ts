/**
 * The card catalogue. Every regular card comes from one of PLAYER_SOURCES, in
 * this order (the order is part of the draft pool, keep it stable).
 *
 * Adding players: run `pnpm catalog <name>` (or `pnpm catalog --check names.txt`)
 * first to see who is already in the game, then add the new cards to the
 * source file of the batch they belong to (or a new file listed below).
 * Rarity is always derived from the overall (rarity.ts); clubId from the club name.
 */
import type { Player, Rarity } from '../gameData';
import { rarityForBaseOverall } from '../rarity';
import { clubIdForName } from '../crests';
import { BRAZILIAN_STARTERS } from './brazilianStarters';
import { BRAZILIAN_NOTABLE_ADDITIONS } from './brazilianNotableAdditions';
import { SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS } from './sortitoutsiBrazilianLeagueExpansion';
import { MAJOR_LEAGUE_ADDITIONS } from './majorLeaguePlayers';
import { MAJOR_LEAGUE_CATALOG_EXPANSION_LIVE } from './majorLeagueCatalogExpansion';
import { NEXT_GENERATION_PLAYERS } from './next-generationPlayers';
import { SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS } from './sortitoutsiMajorLeagueExpansion';
import { SORTITOUTSI_1000_ADDITIONS } from './sortitoutsiThousandExpansion';
import { SORTITOUTSI_EUROPEAN_LEGENDS } from './sortitoutsiEuropeanLegendsExpansion';
import { USER_SELECTED_HISTORICAL_PLAYERS } from './userSelectedHistoricalPlayers';
import { FIFAINDEX_FAMOUS_ADDITIONS } from './fifaIndexFamousExpansion';
import { FIFAINDEX_VERSION_ADDITIONS } from './fifaIndexVersionsExpansion';
import { ORIGINAL_PLAYERS } from './originalCatalog';
import { UNIQUE_CARD_LIST } from './uniqueCards';

export interface PlayerSource {
  /** File in shared/game/players that holds the cards. */
  file: string;
  players: Player[];
}

export const PLAYER_SOURCES: PlayerSource[] = [
  { file: 'brazilianStarters', players: BRAZILIAN_STARTERS },
  { file: 'brazilianNotableAdditions', players: BRAZILIAN_NOTABLE_ADDITIONS },
  { file: 'sortitoutsiBrazilianLeagueExpansion', players: SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS },
  { file: 'majorLeaguePlayers', players: MAJOR_LEAGUE_ADDITIONS },
  { file: 'majorLeagueCatalogExpansion', players: MAJOR_LEAGUE_CATALOG_EXPANSION_LIVE },
  { file: 'next-generationPlayers', players: NEXT_GENERATION_PLAYERS },
  { file: 'sortitoutsiMajorLeagueExpansion', players: SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS },
  { file: 'sortitoutsiThousandExpansion', players: SORTITOUTSI_1000_ADDITIONS },
  { file: 'sortitoutsiEuropeanLegendsExpansion', players: SORTITOUTSI_EUROPEAN_LEGENDS },
  { file: 'userSelectedHistoricalPlayers', players: USER_SELECTED_HISTORICAL_PLAYERS },
  { file: 'fifaIndexFamousExpansion', players: FIFAINDEX_FAMOUS_ADDITIONS },
  { file: 'fifaIndexVersionsExpansion', players: FIFAINDEX_VERSION_ADDITIONS },
  { file: 'originalCatalog', players: ORIGINAL_PLAYERS },
];

// The source objects still carry a hand-written rarity label, but the overall band
// (rarity.ts) is the single source of truth in the exported catalogue.
function normalizeRegularPlayerRarity<T extends { overall: number }>(player: T): T & { rarity: Exclude<Rarity, 'unique'> } {
  return { ...player, rarity: rarityForBaseOverall(player.overall) };
}

function withCanonicalClub(player: Player): Player {
  return { ...player, clubId: clubIdForName(player.club) };
}

export const PLAYERS: Player[] = PLAYER_SOURCES
  .flatMap(source => source.players)
  .map(normalizeRegularPlayerRarity)
  .map(withCanonicalClub);

export const UNIQUE_CARDS: Player[] = UNIQUE_CARD_LIST.map(withCanonicalClub);
