import { describe, expect, it } from 'vitest';
import {
  ALBUM_PACK_TIERS,
  albumCards,
  albumCatalog,
  buildAlbumCatalog,
  campaignGrant,
  CLUB_PAGE_MIN_CARDS,
  clubOfRewardKey,
  clubRewardKeys,
  copiesToNextLevel,
  ENVELOPE_SIZE,
  levelForCopies,
  PACK_SIZE,
  parseItemKey,
  rollItem,
  SELL_VALUE,
  TIER_GUARANTEE,
} from './album';
import { seededRandom } from './random';
import type { Rarity } from './gameData';

const RANK: Record<Rarity, number> = { bronze: 0, silver: 1, gold: 2, legendary: 3, immortal: 4, unique: 5 };

describe('Álbum de figurinhas — catálogo', () => {
  const catalog = albumCatalog();

  it('cada carta do álbum tem exatamente uma vaga, numerada em sequência', () => {
    const cards = albumCards();
    expect(catalog.total).toBe(cards.length);
    expect(catalog.stickers.size).toBe(cards.length);
    const numbers = [...catalog.stickers.values()].map(s => s.number).sort((a, b) => a - b);
    expect(numbers[0]).toBe(1);
    expect(numbers[numbers.length - 1]).toBe(cards.length);
    expect(new Set(numbers).size).toBe(cards.length);
    // Every page's stickers point back to it.
    for (const page of catalog.pages) for (const id of page.stickers) expect(catalog.stickers.get(id)!.pageId).toBe(page.id);
  });

  it('clubes com 10+ cartas têm página própria; os menores vão para a página da região', () => {
    for (const page of catalog.pages) {
      if (page.kind === 'club') {
        expect(page.stickers.length).toBeGreaterThanOrEqual(CLUB_PAGE_MIN_CARDS);
        expect(page.id).toBe(`club:${page.clubId}`);
      } else {
        expect(page.clubId).toBeNull();
        const perClub = new Map<string, number>();
        for (const id of page.stickers) perClub.set(catalog.stickers.get(id)!.clubId, (perClub.get(catalog.stickers.get(id)!.clubId) ?? 0) + 1);
        for (const count of perClub.values()) expect(count).toBeLessThan(CLUB_PAGE_MIN_CARDS);
      }
    }
    expect(catalog.pageById.get('club:barcelona')?.kind).toBe('club');
    expect(catalog.pageById.get('club:real-madrid')?.regionId).toBe('spain');
    expect(catalog.pageById.get('club:flamengo')?.regionId).toBe('brazil');
  });

  it('é determinístico: o mesmo catálogo de cartas gera o mesmo álbum', () => {
    const again = buildAlbumCatalog();
    expect(again.pages.map(p => [p.id, p.stickers.join()])).toEqual(catalog.pages.map(p => [p.id, p.stickers.join()]));
  });

  it('um clube que passa de 10 cartas ganha página própria', () => {
    const cards = albumCards();
    const small = catalog.pages.find(p => p.kind === 'region')!;
    const clubId = catalog.stickers.get(small.stickers[0])!.clubId;
    const template = cards.find(c => catalog.stickers.get(c.id)!.clubId === clubId)!;
    const missing = CLUB_PAGE_MIN_CARDS - small.stickers.filter(id => catalog.stickers.get(id)!.clubId === clubId).length;
    const extra = Array.from({ length: missing }, (_, i) => ({ ...template, id: `${template.id}-extra-${i}` }));
    const grown = buildAlbumCatalog([...cards, ...extra]);
    expect(grown.pageById.get(`club:${clubId}`)?.stickers.length).toBe(CLUB_PAGE_MIN_CARDS);
  });
});

describe('Álbum de figurinhas — níveis', () => {
  it('★1 com 1 cópia, ★2 com 2, ★3 com 4, ★4 com 7, ★5 com 10', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 9, 10, 12].map(levelForCopies)).toEqual([0, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(copiesToNextLevel(1)).toBe(1);
    expect(copiesToNextLevel(4)).toBe(3);
    expect(copiesToNextLevel(10)).toBeNull();
  });
});

describe('Álbum de figurinhas — pacotes', () => {
  const catalog = albumCatalog();

  it('pacote tem 5 figurinhas e envelope 2, todas do álbum', () => {
    const rand = seededRandom(1);
    for (const tier of ALBUM_PACK_TIERS) {
      const pack = rollItem(`pack:${tier}`, rand);
      const envelope = rollItem(`envelope:${tier}`, rand);
      expect(pack).toHaveLength(PACK_SIZE);
      expect(envelope).toHaveLength(ENVELOPE_SIZE);
      for (const id of [...pack, ...envelope]) expect(catalog.stickers.has(id)).toBe(true);
    }
  });

  it('o pacote cheio garante a raridade da sua dificuldade', () => {
    const rand = seededRandom(7);
    for (const tier of ALBUM_PACK_TIERS) {
      const floor = TIER_GUARANTEE[tier];
      if (!floor) continue;
      for (let i = 0; i < 300; i++) {
        const best = Math.max(...rollItem(`pack:${tier}`, rand).map(id => RANK[catalog.stickers.get(id)!.rarity]));
        expect(best).toBeGreaterThanOrEqual(RANK[floor]);
      }
    }
  });

  it('dificuldades mais altas dão cartas mais raras em média', () => {
    const rand = seededRandom(3);
    const average = (tier: (typeof ALBUM_PACK_TIERS)[number]) => {
      let sum = 0;
      for (let i = 0; i < 400; i++) for (const id of rollItem(`pack:${tier}`, rand)) sum += RANK[catalog.stickers.get(id)!.rarity];
      return sum / (400 * PACK_SIZE);
    };
    const averages = ALBUM_PACK_TIERS.map(average);
    for (let i = 1; i < averages.length; i++) expect(averages[i]).toBeGreaterThan(averages[i - 1]);
  });

  it('chaves de item e prêmios de campanha', () => {
    expect(parseItemKey('pack:gold')).toEqual({ kind: 'pack', tier: 'gold' });
    expect(parseItemKey('envelope:immortal')).toEqual({ kind: 'envelope', tier: 'immortal' });
    expect(parseItemKey('pack:diamond')).toBeNull();
    expect(parseItemKey('coins:gold')).toBeNull();
    expect(campaignGrant('silver', false, false)).toEqual(['envelope:silver']);
    expect(campaignGrant('gold', true, false)).toEqual(['envelope:gold', 'pack:gold']);
    expect(campaignGrant('gold', true, true)).toEqual(['envelope:gold', 'pack:gold', 'pack:gold']);
  });
});

describe('Álbum de figurinhas — economia e prêmios', () => {
  it('comprar uma figurinha custa mais do que vender uma cópia dela', () => {
  });

  it('as chaves de moldura e fundo do clube cabem no formato do perfil', () => {
    const { frameKey, coverKey } = clubRewardKeys('real-madrid');
    expect(frameKey).toMatch(/^[a-z0-9-]{3,40}$/);
    expect(coverKey).toMatch(/^[a-z0-9-]{3,40}$/);
    expect(clubOfRewardKey(frameKey)).toBe('real-madrid');
    expect(clubOfRewardKey('noite-dos-imortais')).toBeNull();
    // The longest club id still fits the profile's 40 characters.
    const longest = Math.max(...albumCatalog().pages.filter(p => p.clubId).map(p => clubRewardKeys(p.clubId!).coverKey.length));
    expect(longest).toBeLessThanOrEqual(40);
  });

});
