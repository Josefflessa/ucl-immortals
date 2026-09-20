import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlayerPhotoSources, UNIQUE_STYLE } from './PlayerCard';
import { PLAYERS } from '../../lib/gameData';
import { getPlayerPhotoFilename, LOCAL_PLAYER_PHOTO_ROOT } from '../../lib/playerPhotoCatalog';

describe('fontes de foto dos jogadores', () => {
  it.each(['raphinha', 'rafinha', 'varane', 'yashin', 'haaland_borussia'])('prioriza o portrait local de %s', playerId => {
    expect(buildPlayerPhotoSources(playerId)[0]).toMatch(new RegExp(`${LOCAL_PLAYER_PHOTO_ROOT}/.+/${getPlayerPhotoFilename(playerId)}$`));
  });

  it('usa a foto do City como alias da carta-base do Haaland', () => {
    expect(buildPlayerPhotoSources('haaland')).toEqual(expect.arrayContaining([
      expect.stringMatching(new RegExp(`${LOCAL_PLAYER_PHOTO_ROOT}/.+/${getPlayerPhotoFilename('haaland')}$`)),
    ]));
  });

  it.each([
    ['coutinho', 'Aston Villa'],
    ['coutinho_bayern', 'Bayern Munich'],
    ['coutinho_barcelona', 'Barcelona'],
    ['coutinho_liverpool', 'Liverpool'],
    ['dimaria_benfica', 'Benfica'],
    ['diego_costa', 'Atlético de Madrid'],
    ['mane', 'Liverpool'],
    ['mane_bayern', 'Bayern Munich'],
  ])('associa a versão %s ao clube e retrato corretos', (playerId, club) => {
    const player = PLAYERS.find(candidate => candidate.id === playerId);
    expect(player?.club).toBe(club);
    expect(buildPlayerPhotoSources(playerId)[0]).toMatch(new RegExp(`${LOCAL_PLAYER_PHOTO_ROOT}/.+/${getPlayerPhotoFilename(playerId)}$`));
    expect(existsSync(resolve(process.cwd(), 'client/public', buildPlayerPhotoSources(playerId)[0].replace(/^\//, '')))).toBe(true);
  });

  it('aceita um novo arquivo local pelo próprio ID mesmo sem mapa externo', () => {
    expect(buildPlayerPhotoSources('jogador_local_novo')[0]).toBe('/players/regular/jogador_local_novo.webp');
  });

  it.each([
    ['lewandowski'],
    ['lewandowski_barcelona'],
    ['bellingham'],
    ['bellingham_dortmund'],
    ['ronaldinho_atleticomineiro'],
    ['ramos'],
    ['ramos_sevilla'],
    ['ramos_psg'],
    ['dimaria'],
    ['dimaria_psg'],
    ['dimaria_benfica'],
    ['coutinho_bayern'],
    ['coutinho_barcelona'],
    ['coutinho_liverpool'],
    ['mane_bayern'],
    ['falcao_atleticomadrid'],
  ])('prioriza o retrato local correto para %s', (playerId) => {
    expect(buildPlayerPhotoSources(playerId)[0]).toMatch(new RegExp(`${LOCAL_PLAYER_PHOTO_ROOT}/.+/${getPlayerPhotoFilename(playerId)}$`));
  });

  it.each([
    ['lewandowski_unico', 'lewandowski'],
    ['modric_unico', 'modric'],
    ['kroos_unico', 'kroos'],
    ['rogerio_ceni_unico', 'rogerio_ceni'],
    ['garrincha_unico', 'garrincha'],
    ['ronaldinho_unico', 'ronaldinho'],
    ['casemiro_unico', 'casemiro'],
    ['ronaldo_unico', 'ronaldo'],
    ['gattuso_unico', 'gattuso'],
    ['nesta_unico', 'nesta'],
    ['delpiero_unico', 'delpiero'],
    ['dani_alves_unico', 'dani_alves'],
    ['roberto_carlos_unico', 'roberto_carlos'],
  ])('usa o render WebP da carta única %s', (playerId, filename) => {
    expect(UNIQUE_STYLE[playerId].render).toBe(`/players/unico/${filename}.webp`);
    expect(buildPlayerPhotoSources(playerId)).toEqual([`/players/unico/${filename}.webp`]);
  });
});
