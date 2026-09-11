import { describe, expect, it } from 'vitest';
import { buildPlayerPhotoSources } from './PlayerCard';

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
});
