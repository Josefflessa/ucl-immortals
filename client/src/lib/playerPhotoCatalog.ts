import { PLAYERS } from './gameData';
import { getPlayerCatalogPath } from './playerCatalog';

/**
 * Diretórios físicos dos retratos regulares.
 *
 * Os jogadores continuam identificados pelo id da carta, mas os arquivos ficam
 * organizados pela mesma hierarquia usada no catálogo: país/liga/clube.
 */
export const LOCAL_PLAYER_PHOTO_ROOT = '/players/regular';

function filenameSlug(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter(character => {
      const code = character.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const PLAYER_BY_ID = Object.fromEntries(PLAYERS.map(player => [player.id, player]));

const PLAYER_PHOTO_DIRECTORY_BY_ID: Record<string, string> = Object.fromEntries(
  PLAYERS.map(player => {
    const { country, league, club } = getPlayerCatalogPath(player);
    return [player.id, `${LOCAL_PLAYER_PHOTO_ROOT}/${country.id}/${league.id}/${club.id}`];
  }),
);

export const PLAYER_PHOTO_FILENAME_BY_ID: Record<string, string> = Object.fromEntries(
  PLAYERS.map(player => {
    const { club } = getPlayerCatalogPath(player);
    return [player.id, `${filenameSlug(player.shortName)}_${filenameSlug(club.name)}.webp`];
  }),
);

export function getPlayerPhotoDirectory(playerId: string): string {
  if (PLAYER_PHOTO_DIRECTORY_BY_ID[playerId]) {
    return PLAYER_PHOTO_DIRECTORY_BY_ID[playerId];
  }

  // Variantes técnicas que não possuem uma carta própria podem reutilizar o
  // diretório da carta-base. IDs sem cadastro continuam procurando na raiz,
  // permitindo adicionar um retrato local sem alterar este mapa.
  const baseId = playerId.split('_')[0];
  return PLAYER_PHOTO_DIRECTORY_BY_ID[baseId] ?? LOCAL_PLAYER_PHOTO_ROOT;
}

export function getPlayerPhotoFilename(playerId: string): string | null {
  if (PLAYER_PHOTO_FILENAME_BY_ID[playerId]) {
    return PLAYER_PHOTO_FILENAME_BY_ID[playerId];
  }

  const baseId = Object.keys(PLAYER_PHOTO_FILENAME_BY_ID)
    .sort((a, b) => b.length - a.length)
    .find(id => playerId.startsWith(`${id}_`));
  return baseId ? PLAYER_PHOTO_FILENAME_BY_ID[baseId] : null;
}
