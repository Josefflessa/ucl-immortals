import { describe, expect, it } from 'vitest';
import { buildPlayerPhotoSources, UNIQUE_STYLE } from './PlayerCard';

describe('fontes de foto dos jogadores', () => {
  it.each(['raphinha', 'rafinha', 'varane', 'yashin', 'haaland_borussia'])('prioriza o portrait local de %s', playerId => {
    expect(buildPlayerPhotoSources(playerId)[0]).toBe(`/players/regular/${playerId}.webp`);
  });

  it('usa a foto do City como alias da carta-base do Haaland', () => {
    expect(buildPlayerPhotoSources('haaland')).toContain('/players/regular/haaland_city.webp');
  });

  it('aceita um novo arquivo local pelo próprio ID mesmo sem mapa externo', () => {
    expect(buildPlayerPhotoSources('jogador_local_novo')[0]).toBe('/players/regular/jogador_local_novo.webp');
  });

  it.each([
    ['lewandowski', 'lewandowski_bayern'],
    ['lewandowski_barcelona', 'lewandowski_barcelona'],
    ['bellingham', 'bellingham_realmadrid'],
    ['bellingham_dortmund', 'bellingham_borussia'],
    ['ronaldinho_atleticomineiro', 'ronaldinho_atleticomineiro'],
    ['ramos', 'ramos_realmadrid'],
    ['ramos_sevilla', 'ramos_sevilla'],
    ['ramos_psg', 'ramos_psg'],
    ['dimaria', 'dimaria_realmadrid'],
    ['dimaria_psg', 'dimaria_psg'],
    ['falcao_atleticomadrid', 'falcao_atleticomadrid'],
  ])('prioriza o retrato local correto para %s', (playerId, filename) => {
    expect(buildPlayerPhotoSources(playerId)[0]).toBe(`/players/regular/${filename}.webp`);
  });

  it.each([
    ['lewandowski_unico', 'lewandowski'],
    ['modric_unico', 'modric'],
    ['kroos_unico', 'kroos'],
    ['rogerio_ceni_unico', 'rogerio_ceni'],
    ['garrincha_unico', 'garrincha'],
  ])('usa o render WebP da carta única %s', (playerId, filename) => {
    expect(UNIQUE_STYLE[playerId].render).toBe(`/players/unico/${filename}.webp`);
    expect(buildPlayerPhotoSources(playerId)).toEqual([`/players/unico/${filename}.webp`]);
  });
});
