import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync as SqliteDatabase } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { handleAccountRequest } from './account-api';
import { openItem, placeStickers } from './album';
import { albumCatalog, clubRewardKeys, REGION_PAGE_REWARD, SELL_VALUE, SHOP_PACK_PRICE } from '../shared/game/album';
import { seededRandom } from '../shared/game/random';

// ── A minimal D1 over node:sqlite (as in account-ranking.test.ts) ──
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = SqliteDatabase;
type Param = string | number | null;
const toParam = (value: unknown): Param => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
};
class FakeStatement {
  constructor(private readonly db: DatabaseSync, readonly sql: string, readonly params: Param[] = []) {}
  bind(...params: unknown[]) { return new FakeStatement(this.db, this.sql, params.map(toParam)); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.params) as T[] }; }
  async run() { const result = this.db.prepare(this.sql).run(...this.params); return { meta: { changes: Number(result.changes) } }; }
  runSync() { this.db.prepare(this.sql).run(...this.params); }
}
class FakeD1 {
  constructor(readonly db: DatabaseSync) {}
  prepare(sql: string) { return new FakeStatement(this.db, sql); }
  async batch(statements: FakeStatement[]) {
    this.db.exec('BEGIN');
    try {
      for (const statement of statements) statement.runSync();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return [];
  }
}
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
function database() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql')).sort()) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  return db;
}
function api(db: DatabaseSync) {
  const env = { DB: new FakeD1(db) as unknown as D1Database };
  const call = async (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const response = await handleAccountRequest(new Request(`http://localhost${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(init.cookie ? { cookie: init.cookie } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }), env);
    if (!response) throw new Error(`no route for ${path}`);
    return { status: response.status, body: await response.json() as any, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
  };
  const register = async (username: string) => {
    await call('/api/auth/register', { method: 'POST', body: { username, password: 'senha-segura-123' } });
    const session = await call('/api/auth/login', { method: 'POST', body: { username, password: 'senha-segura-123' } });
    const row = db.prepare('SELECT user_id FROM profiles WHERE username = ?').get(username) as { user_id: string };
    return { cookie: session.cookie, userId: row.user_id };
  };
  return { call, register, env };
}
const soloHistory = (difficultyId: string, extra: Record<string, unknown> = {}) => ({
  mode: 'solo', difficultyId, formatId: 'league_knockout', teamName: 'Time Teste',
  report: { version: 1, games: 10, wins: 6, draws: 2, losses: 2, goals: 20 }, ...extra,
});
const count = (items: readonly string[]) => items.reduce<Record<string, number>>((acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }), {});

describe('Álbum de figurinhas — servidor', () => {
  it('cria o álbum sem presente de abertura nem pacote diário', async () => {
    const { call, register } = api(database());
    const { cookie } = await register('colecionador');
    const first = await call('/api/account/album', { cookie });
    expect(first.status).toBe(200);
    expect(first.body.inventory).toEqual({});
    expect(first.body.grants).toEqual([]);
    expect(first.body).toMatchObject({ coins: 0, stickers: [] });
    expect(first.body.dailyAvailable).toBeUndefined();
    // Visiting again does not create any opening reward.
    const again = await call('/api/account/album', { cookie });
    expect(again.body.grants).toEqual([]);
    expect(again.body.inventory).toEqual({});

    expect((await call('/api/account/album/daily', { method: 'POST', cookie })).status).toBe(404);
  });

  it('premia uma campanha nova sem visita ao álbum e não duplica as recompensas', async () => {
    const { call, register } = api(database());
    const { cookie } = await register('campeao');
    // The first saved competition initializes album rewards and is paid immediately.
    const beforeAlbumVisit = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('gold', { champion: true, finishStage: 'champion' }) });
    expect(beforeAlbumVisit.body.albumGrants.map((g: any) => g.key)).toEqual(['envelope:gold', 'pack:gold', 'pack:gold']);
    const start = (await call('/api/account/album', { cookie })).body;
    expect(start.grants).toEqual([]);
    expect(start.inventory).toEqual({ 'envelope:gold': 1, 'pack:gold': 2 });

    // A gold campaign lost in the semi-final: an envelope.
    const lost = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('gold', { finishStage: 'semifinalist' }) });
    expect(lost.body.albumGrants.map((g: any) => g.key)).toEqual(['envelope:gold']);
    // The first legendary title: envelope + pack + the first-title pack. The second: one pack.
    const title = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('legendary', { champion: true, finishStage: 'champion' }) });
    expect(title.body.albumGrants.map((g: any) => g.key)).toEqual(['envelope:legendary', 'pack:legendary', 'pack:legendary']);
    const second = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('legendary', { champion: true, finishStage: 'champion' }) });
    expect(second.body.albumGrants.map((g: any) => g.key)).toEqual(['envelope:legendary', 'pack:legendary']);
    // The gold title before the album still counts as the first gold title: a new gold one is worth one pack.
    const goldAgain = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('gold', { champion: true, finishStage: 'champion' }) });
    expect(goldAgain.body.albumGrants.map((g: any) => g.key)).toEqual(['envelope:gold', 'pack:gold']);

    // Nothing is granted twice, however often the album is read.
    const state = (await call('/api/account/album', { cookie })).body;
    expect(state.grants).toEqual([]);
    expect(state.inventory['envelope:gold']).toBe(3);
    expect(state.inventory['pack:legendary']).toBe(3);
    expect(state.inventory['pack:gold']).toBe(3);
  });

  it('abre pacotes do inventário: figurinhas novas entram, repetidas viram cópias de sobra', async () => {
    const { call, register, env } = api(database());
    const { cookie, userId } = await register('abridor');
    await call('/api/account/album', { cookie });
    // No opening gift any more: the pack comes from a campaign (put straight in the inventory here).
    await env.DB.prepare('INSERT INTO user_inventory (user_id, item_key, quantity, updated_at) VALUES (?, ?, 1, 0)').bind(userId, 'pack:gold').run();
    const opened = await call('/api/account/album/open', { method: 'POST', cookie, body: { item: 'pack:gold' } });
    expect(opened.status).toBe(200);
    expect(opened.body.result.cards).toHaveLength(5);
    expect(opened.body.inventory['pack:gold']).toBeUndefined();
    const placed = opened.body.stickers.reduce((n: number, [, copies, spare]: number[]) => n + copies + spare, 0);
    expect(placed).toBe(5);
    expect((await call('/api/account/album/open', { method: 'POST', cookie, body: { item: 'pack:gold' } })).status).toBe(409);
    expect((await call('/api/account/album/open', { method: 'POST', cookie, body: { item: 'pack:diamond' } })).status).toBe(400);

    // The same card drawn twice in one pack: the second is a spare copy.
    const sameCard = () => 0; // the first rarity (bronze) and the first card of its pool, every time
    await env.DB.prepare('INSERT OR REPLACE INTO user_inventory (user_id, item_key, quantity, updated_at) VALUES (?, ?, 1, 0)').bind(userId, 'pack:bronze').run();
    const result = await openItem(env.DB, userId, 'pack:bronze', sameCard);
    if ('error' in result) throw new Error(result.error);
    expect(result.cards.filter(c => c.isNew)).toHaveLength(1);
    const row = await env.DB.prepare('SELECT copies, spare FROM user_stickers WHERE user_id = ? AND card_id = ?').bind(userId, result.cards[0].id).first<{ copies: number; spare: number }>();
    expect(row).toEqual({ copies: 1, spare: 4 });
  });

  it('cópias de sobra sobem o nível ou viram moedas; moedas compram pacotes e figurinhas', async () => {
    const { call, register, env } = api(database());
    const { cookie, userId } = await register('negociante');
    await call('/api/account/album', { cookie });
    const card = albumCatalog().pages.find(p => p.kind === 'club')!.stickers.at(-1)!;
    const rarity = albumCatalog().stickers.get(card)!.rarity;
    await env.DB.prepare('INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at) VALUES (?, ?, 1, 3, 0, 0)').bind(userId, card).run();

    const applied = await call('/api/account/album/apply', { method: 'POST', cookie, body: { cardId: card } });
    expect(applied.body.stickers).toContainEqual([card, 2, 2]);
    const sold = await call('/api/account/album/sell', { method: 'POST', cookie, body: { cardId: card, quantity: 2 } });
    expect(sold.body.coins).toBe(SELL_VALUE[rarity] * 2);
    expect(sold.body.stickers).toContainEqual([card, 2, 0]);
    expect((await call('/api/account/album/apply', { method: 'POST', cookie, body: { cardId: card } })).status).toBe(409);
    expect((await call('/api/account/album/sell', { method: 'POST', cookie, body: { cardId: card, quantity: 1 } })).status).toBe(409);

    // Not enough coins for an Ouro pack yet; with them, it goes to the inventory.
    expect((await call('/api/account/album/buy-pack', { method: 'POST', cookie, body: { tier: 'gold' } })).status).toBe(409);
    expect((await call('/api/account/album/buy-pack', { method: 'POST', cookie, body: { tier: 'legendary' } })).status).toBe(400);
    await env.DB.prepare('UPDATE user_album SET coins = 1000 WHERE user_id = ?').bind(userId).run();
    const bought = await call('/api/account/album/buy-pack', { method: 'POST', cookie, body: { tier: 'gold' } });
    expect(bought.body.coins).toBe(1000 - SHOP_PACK_PRICE.gold!);
    expect(bought.body.inventory['pack:gold']).toBe(1);
    // A specific sticker cannot be bought: stickers only come from packs and envelopes.
    expect((await call('/api/account/album/buy-sticker', { method: 'POST', cookie, body: { cardId: card } })).status).toBe(404);
  });

  it('completar um clube dá a moldura e o fundo dele; o perfil só aceita o que foi conquistado', async () => {
    const { call, register, env } = api(database());
    const { cookie, userId } = await register('torcedor');
    const other = await register('outro');
    await call('/api/account/album', { cookie });
    const page = albumCatalog().pages.filter(p => p.kind === 'club').sort((a, b) => a.stickers.length - b.stickers.length)[0];
    const [last, ...rest] = page.stickers;
    for (const id of rest) await env.DB.prepare('INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at) VALUES (?, ?, 1, 0, 0, 0)').bind(userId, id).run();

    // The last sticker comes out of a pack.
    const done = await placeStickers(env.DB, userId, [last]);
    const keys = clubRewardKeys(page.clubId!);
    expect(done.pageRewards).toEqual([{ pageId: page.id, frameKey: keys.frameKey, coverKey: keys.coverKey, items: [], recompleted: false }]);
    expect((await call('/api/account/album', { cookie })).body.completedPages).toContain(page.id);
    expect((await call('/api/account/album', { cookie })).body.covers).toEqual([keys.coverKey]);

    const equipped = await call('/api/account/profile', { method: 'PATCH', cookie, body: { avatarFrameKey: keys.frameKey, coverKey: keys.coverKey } });
    expect(equipped.status).toBe(200);
    expect(equipped.body.account).toMatchObject({ avatarFrameKey: keys.frameKey, coverKey: keys.coverKey });
    // Someone who did not complete it cannot use it.
    expect((await call('/api/account/profile', { method: 'PATCH', cookie: other.cookie, body: { avatarFrameKey: keys.frameKey } })).status).toBe(403);
    expect((await call('/api/account/profile', { method: 'PATCH', cookie: other.cookie, body: { coverKey: keys.coverKey } })).status).toBe(403);

    // The profile shows how far the album went.
    const profile = await call('/api/users/torcedor', { cookie: other.cookie });
    expect(profile.body.album).toMatchObject({ owned: page.stickers.length, total: albumCatalog().total, completedPages: 1, clubsCompleted: [page.clubId] });
  });

  it('uma página regional completa dá pacotes; se ela crescer e for completada de novo, dá outro prêmio', async () => {
    const { call, register, env } = api(database());
    const { cookie, userId } = await register('viajante');
    await call('/api/account/album', { cookie });
    const page = albumCatalog().pages.filter(p => p.kind === 'region').sort((a, b) => a.stickers.length - b.stickers.length)[0];
    const [last, ...rest] = page.stickers;
    for (const id of rest) await env.DB.prepare('INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at) VALUES (?, ?, 1, 0, 0, 0)').bind(userId, id).run();
    const before = (await call('/api/account/album', { cookie })).body.inventory;

    const done = await placeStickers(env.DB, userId, [last]);
    expect(done.pageRewards[0]).toMatchObject({ pageId: page.id, frameKey: null, items: REGION_PAGE_REWARD, recompleted: false });
    const after = (await call('/api/account/album', { cookie })).body.inventory;
    for (const [key, n] of Object.entries(count(REGION_PAGE_REWARD))) expect(after[key]).toBe((before[key] ?? 0) + n);

    // As if the page had been completed when it was one card smaller: completing it now counts again.
    await env.DB.prepare('UPDATE user_album_pages SET completed_size = completed_size - 1 WHERE user_id = ?').bind(userId).run();
    await env.DB.prepare('DELETE FROM user_stickers WHERE user_id = ? AND card_id = ?').bind(userId, last).run();
    const again = await placeStickers(env.DB, userId, [last]);
    expect(again.pageRewards[0]).toMatchObject({ pageId: page.id, recompleted: true });
  });

  it('exige conta', async () => {
    const { call } = api(database());
    expect((await call('/api/account/album')).status).toBe(401);
  });
});
