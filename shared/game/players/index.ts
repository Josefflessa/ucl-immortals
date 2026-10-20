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
import { normalizeLegacyPlayerPosition } from '../positions';
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
import { FIFAINDEX_ALBUM_CLUB_ADDITIONS } from './fifaIndexAlbumClubsExpansion';
import { FIFAINDEX_2000_ADDITIONS } from './fifaIndex2000Expansion';
import { withExtraCoachLinks } from './coachLinks';
import { ORIGINAL_PLAYERS } from './originalCatalog';
import { EVENT_UNIQUE_CARD_LIST, UNIQUE_CARD_LIST } from './uniqueCards';
import { WEEKLY_BANNER_UNIQUE_CARDS } from './weeklyBannerCards';

export interface PlayerSource {
  /** File in shared/game/players that holds the cards. */
  file: string;
  players: Player[];
}

const RAW_PLAYER_SOURCES: PlayerSource[] = [
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
  { file: 'fifaIndexAlbumClubsExpansion', players: FIFAINDEX_ALBUM_CLUB_ADDITIONS },
  { file: 'fifaIndex2000Expansion', players: FIFAINDEX_2000_ADDITIONS },
];

// The imported datasets still use LM/RM for a handful of legacy entries. The
// game catalog exposes those players as LW/RW while formations retain LM/RM.
export const PLAYER_SOURCES: PlayerSource[] = RAW_PLAYER_SOURCES.map(source => ({
  ...source,
  players: source.players.map(normalizeLegacyPlayerPosition),
}));

// The source objects still carry a hand-written rarity label, but the overall band
// (rarity.ts) is the single source of truth in the exported catalogue.
function normalizeRegularPlayerRarity<T extends { overall: number }>(player: T): T & { rarity: Exclude<Rarity, 'unique'> } {
  return { ...player, rarity: rarityForBaseOverall(player.overall) };
}

function withCanonicalClub(player: Player): Player {
  return { ...normalizeLegacyPlayerPosition(player), clubId: clubIdForName(player.club) };
}

export const PLAYERS: Player[] = PLAYER_SOURCES
  .flatMap(source => source.players)
  .map(normalizeRegularPlayerRarity)
  .map(withExtraCoachLinks)
  .map(withCanonicalClub);

export const UNIQUE_CARDS: Player[] = UNIQUE_CARD_LIST.map(withCanonicalClub);
/** Event Únicas: only in the Pacote Único pool of the accounts that unlocked them. */
export const EVENT_UNIQUE_CARDS: Player[] = EVENT_UNIQUE_CARD_LIST.map(withCanonicalClub);
/** Únicas outside the general pool, available through weekly store banners (never event rewards). */
export const STORE_UNIQUE_CARDS: Player[] = WEEKLY_BANNER_UNIQUE_CARDS.map(withCanonicalClub);
const nonUniqueBannerCard = STORE_UNIQUE_CARDS.find(card => card.rarity !== 'unique');
if (nonUniqueBannerCard) throw new Error(`Weekly banner card ${nonUniqueBannerCard.id} must have Única rarity.`);
const existingExclusiveIds = new Set([...PLAYERS, ...UNIQUE_CARDS, ...EVENT_UNIQUE_CARDS].map(card => card.id));
const reusedExclusiveCard = STORE_UNIQUE_CARDS.find(card => existingExclusiveIds.has(card.id));
if (reusedExclusiveCard) throw new Error(`Weekly banner card ${reusedExclusiveCard.id} must be a new, non-event card.`);
/** Every Única, for lookups (offers, claims, album). */
export const ALL_UNIQUE_CARDS: Player[] = [...UNIQUE_CARDS, ...EVENT_UNIQUE_CARDS, ...STORE_UNIQUE_CARDS];
