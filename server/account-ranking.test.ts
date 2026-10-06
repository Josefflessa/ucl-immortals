import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync as SqliteDatabase } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAccountRequest } from './account-api';
import { competitionStagePoints } from '../shared/game/competitionRanking';

// ── A minimal D1 over node:sqlite (same SQLite engine D1 runs) ──
// Loaded through require: Vite's resolver does not know the node:sqlite builtin yet.
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
const migrationFiles = readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql')).sort();

function database(upTo?: string) {
  const db = new DatabaseSync(':memory:');
  for (const file of migrationFiles) {
    if (upTo && file > upTo) break;
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
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
    const created = await call('/api/auth/register', { method: 'POST', body: { username, password: 'senha-segura-123' } });
    expect(created.status).toBeLessThan(300);
    const session = await call('/api/auth/login', { method: 'POST', body: { username, password: 'senha-segura-123' } });
    expect(session.status).toBe(200);
    return session.cookie;
  };
  return { call, register };
}

const soloHistory = (difficultyId: string, extra: Record<string, unknown> = {}) => ({
  mode: 'solo',
  difficultyId,
  formatId: 'league_knockout',
  teamName: 'Time Teste',
  report: { version: 1, games: 10, wins: 6, draws: 2, losses: 2, goals: 20 },
  ...extra,
});

describe('ranked difficulties', () => {
  it('scores every difficulty from the stage on the server, ignoring forged points', async () => {
    const { call, register } = api(database());
    const cookie = await register('jogador1');

    const goldTitle = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('gold', { champion: true, finishStage: 'champion' }) });
    expect(goldTitle.status).toBe(201);
    // A forged total never counts: the stage and the difficulty decide.
    await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('bronze', { finishStage: 'roundOf16', competitionPoints: 100 }) });
    // An older client only sends the full-table points; they still identify the stage.
    await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('immortal', { competitionPoints: 60 }) });

    const invalid = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('impossible', { finishStage: 'champion' }) });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe('invalid_difficulty');

    const history = await call('/api/account/history?page=1', { cookie });
    const byDifficulty = Object.fromEntries(history.body.history.map((row: any) => [row.difficulty_id, row]));
    expect(byDifficulty.gold).toMatchObject({ finish_stage: 'champion', competition_points: 45 });
    expect(byDifficulty.bronze).toMatchObject({ finish_stage: 'roundOf16', competition_points: competitionStagePoints('roundOf16', 'bronze') });
    expect(byDifficulty.immortal).toMatchObject({ finish_stage: 'semifinalist', competition_points: 60 });

    const overall = await call('/api/leaderboards/score');
    expect(overall.body.ranking[0]).toMatchObject({ username: 'jogador1', points: 45 + 3 + 60, titles: 1 });
    const goldOnly = await call('/api/leaderboards/score?difficulty=gold');
    expect(goldOnly.body.ranking[0]).toMatchObject({ points: 45, titles: 1 });
    expect((await call('/api/leaderboards/score?difficulty=legendary')).body.ranking).toEqual([]);
    expect((await call('/api/leaderboards/score?difficulty=nope')).status).toBe(400);

    const position = await call('/api/account/leaderboards/score-position?difficulty=bronze', { cookie });
    expect(position.body).toMatchObject({ position: 1, points: 3, status: 'ranked', difficulty: 'bronze' });

    const me = await call('/api/auth/me', { cookie });
    expect(me.body.account.stats.finishCounts).toMatchObject({ champion: 1, roundOf16: 1, semifinal: 1 });
    expect(me.body.account.stats.finishCountsByDifficulty).toMatchObject({
      gold: { champion: 1 },
      bronze: { roundOf16: 1 },
      immortal: { semifinal: 1 },
    });
  });

  it('ranks personal records within their own difficulty', async () => {
    const { call, register } = api(database());
    const first = await register('artilheiro');
    const second = await register('rival');
    const record = (value: number) => [{ category: 'goals', playerId: 'p1', playerName: 'Craque', value }];

    await call('/api/account/history', { method: 'POST', cookie: first, body: soloHistory('immortal', { finishStage: 'leaguePhase', records: record(10) }) });
    await call('/api/account/history', { method: 'POST', cookie: first, body: soloHistory('bronze', { finishStage: 'leaguePhase', records: record(30) }) });
    await call('/api/account/history', { method: 'POST', cookie: second, body: soloHistory('immortal', { finishStage: 'leaguePhase', records: record(12) }) });

    const records = (await call('/api/account/records', { cookie: first })).body.records;
    const goals = Object.fromEntries(records.filter((r: any) => r.category === 'goals').map((r: any) => [r.difficulty_id, r]));
    // 30 on Bronze is #1 there; it must not hide the Imortal record or outrank the rival.
    expect(goals.bronze).toMatchObject({ value: 30, rank_position: 1 });
    expect(goals.immortal).toMatchObject({ value: 10, rank_position: 2 });

    const publicImmortal = (await call('/api/records?category=goals&difficulty=immortal')).body.records;
    expect(publicImmortal.map((r: any) => r.value)).toEqual([12, 10]);
    expect((await call('/api/records?difficulty=nope')).status).toBe(400);
  });

  it('migrates existing campaigns: stage backfilled, points weighted, Imortal untouched', () => {
    const db = database('0011_backfill_online_competition_points.sql');
    db.exec(`INSERT INTO users (id, email, created_at, updated_at, last_seen_at) VALUES ('u1', 'u1@x', 0, 0, 0)`);
    const insert = db.prepare(`INSERT INTO competition_history
      (id, user_id, mode, difficulty_id, format_id, team_name, champion, competition_points, report_json, completed_at)
      VALUES (?, 'u1', 'online', ?, 'league_knockout', 'T', ?, ?, '{}', 0)`);
    insert.run('imm', 'immortal', 1, 100);
    insert.run('gold-semi', 'gold', 0, 60);
    insert.run('legend-playoff', 'legendary', 0, 15);
    insert.run('bronze-league', 'bronze', 0, 5);
    insert.run('odd', 'normal', 0, 40);
    insert.run('unscored', 'immortal', 0, 0);

    db.exec(readFileSync(join(MIGRATIONS_DIR, '0012_ranked_difficulties.sql'), 'utf8'));
    const rows = Object.fromEntries((db.prepare('SELECT id, finish_stage, competition_points FROM competition_history').all() as any[])
      .map(row => [row.id, row]));
    expect(rows.imm).toMatchObject({ finish_stage: 'champion', competition_points: 100 });
    expect(rows['gold-semi']).toMatchObject({ finish_stage: 'semifinalist', competition_points: competitionStagePoints('semifinalist', 'gold') });
    expect(rows['legend-playoff']).toMatchObject({ finish_stage: 'playoff', competition_points: competitionStagePoints('playoff', 'legendary') });
    expect(rows['bronze-league']).toMatchObject({ finish_stage: 'leaguePhase', competition_points: 1 });
    // Unknown difficulty keeps its points; a row without a stage keeps 0.
    expect(rows.odd).toMatchObject({ finish_stage: 'quarterfinalist', competition_points: 40 });
    expect(rows.unscored).toMatchObject({ finish_stage: null, competition_points: 0 });
  });
});

describe('achievements and showcase', () => {
  it('unlocks from the history, reports only new levels and never loses them', async () => {
    const { call, register } = api(database());
    const cookie = await register('campeao');
    const title = (difficultyId: string, extra: Record<string, unknown> = {}) => soloHistory(difficultyId, {
      champion: true, finishStage: 'champion',
      report: { version: 1, games: 14, wins: 12, draws: 2, losses: 0, goals: 46, goalsAgainst: 7 },
      ...extra,
    });

    const first = await call('/api/account/history', { method: 'POST', cookie, body: title('gold') });
    const unlocked = Object.fromEntries(first.body.achievementsUnlocked.map((u: any) => [u.id, u.level]));
    // First title, unbeaten, tight defence and a 46-goal campaign.
    expect(unlocked).toMatchObject({ trophy_collector: 1, unbeaten: 1, iron_wall: 1, firepower: 2 });
    expect(unlocked.veteran).toBeUndefined();

    const second = await call('/api/account/history', { method: 'POST', cookie, body: title('immortal') });
    const secondUnlocks = Object.fromEntries(second.body.achievementsUnlocked.map((u: any) => [u.id, u.level]));
    // Only what this campaign added: a 2-title streak, 2 difficulties, Imortal.
    expect(secondUnlocks).toMatchObject({ dynasty: 1, ladder: 1, immortal_legend: 1, explorer: 1, immortal_challenge: 1 });
    // Levels reached by the first campaign are not reported again.
    expect(secondUnlocks.trophy_collector).toBeUndefined();
    expect(secondUnlocks.unbeaten).toBeUndefined();

    const own = (await call('/api/account/achievements', { cookie })).body;
    const state = Object.fromEntries(own.achievements.map((a: any) => [a.id, a]));
    expect(state.trophy_collector).toMatchObject({ level: 1, progress: 2 });
    expect(own.rarity.players).toBe(1);
    expect(own.rarity.percentByAchievement.trophy_collector[0]).toBe(100);
    // Nothing chosen yet: the mural is filled automatically, best levels first.
    expect(own.showcase.automatic).toBe(true);
    expect(own.showcase.items[0]).toEqual({ type: 'achievement', id: 'firepower' });
  });

  it('pins only owned items and shows the pick on the public profile', async () => {
    const { call, register } = api(database());
    const cookie = await register('colecionador');
    await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('legendary', {
      champion: true, finishStage: 'champion',
      report: { version: 1, games: 14, wins: 10, draws: 2, losses: 2, goals: 30, goalsAgainst: 15 },
      records: [{ category: 'goals', playerId: 'p1', playerName: 'Craque', value: 15 }],
    }) });

    const notOwned = await call('/api/account/showcase', { method: 'PUT', cookie, body: { items: [{ type: 'achievement', id: 'immortal_legend' }] } });
    expect(notOwned.status).toBe(400);
    expect(notOwned.body.error).toBe('showcase_item_not_owned');
    const wrongRecord = await call('/api/account/showcase', { method: 'PUT', cookie, body: { items: [{ type: 'record', difficultyId: 'immortal', category: 'goals' }] } });
    expect(wrongRecord.status).toBe(400);

    const pick = [{ type: 'record', difficultyId: 'legendary', category: 'goals' }, { type: 'achievement', id: 'trophy_collector' }];
    const saved = await call('/api/account/showcase', { method: 'PUT', cookie, body: { items: pick } });
    expect(saved.status).toBe(200);

    const visitor = await call('/api/users/colecionador');
    expect(visitor.body.achievements.showcase).toEqual({ items: pick, automatic: false });
    expect(visitor.body.achievements.achievements.find((a: any) => a.id === 'trophy_collector').level).toBe(1);

    // Clearing the pick goes back to the automatic mural.
    await call('/api/account/showcase', { method: 'PUT', cookie, body: { items: [] } });
    expect((await call('/api/account/achievements', { cookie })).body.showcase.automatic).toBe(true);
  });

  it('evaluates existing players retroactively on first access', async () => {
    const db = database();
    const { call, register } = api(db);
    const cookie = await register('antigo');
    await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('immortal', { champion: true, finishStage: 'champion' }) });
    // Simulate an account from before achievements existed.
    db.exec(`DELETE FROM user_achievements; UPDATE profile_stats SET achievements_version = 0;`);
    const own = (await call('/api/account/achievements', { cookie })).body;
    expect(own.achievements.find((a: any) => a.id === 'immortal_legend').level).toBe(1);
  });

  it('re-evaluates under new rules once, even when that lowers a level', async () => {
    const db = database();
    const { call, register } = api(db);
    const cookie = await register('regra-nova');
    await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('bronze', {
      champion: true, finishStage: 'champion',
      report: { version: 1, games: 14, wins: 12, draws: 2, losses: 0, goals: 41, goalsAgainst: 7 },
    }) });
    await call('/api/account/showcase', { method: 'PUT', cookie, body: { items: [{ type: 'achievement', id: 'firepower' }] } });
    // Levels stored under older rules, above what the history supports now.
    db.exec(`UPDATE user_achievements SET level = 4 WHERE achievement_id IN ('firepower', 'immortal_legend');
      UPDATE profile_stats SET achievements_version = 0;`);
    const own = (await call('/api/account/achievements', { cookie })).body;
    const level = (id: string) => own.achievements.find((a: any) => a.id === id).level;
    // Prata and above need the campaign on Prata or higher: Bronze only.
    expect(level('firepower')).toBe(1);
    // An achievement the history does not support is locked again and leaves the mural.
    expect(level('immortal_legend')).toBe(0);
    expect(own.showcase.items).toContainEqual({ type: 'achievement', id: 'firepower' });
    const again = (await call('/api/account/achievements', { cookie })).body;
    expect(again.achievements.find((a: any) => a.id === 'firepower').level).toBe(1);
  });
});

describe('achievements from records and loyalty', () => {
  it('reads campaign records and reports the coach that drives loyalty', async () => {
    const { call, register } = api(database());
    const cookie = await register('fiel');
    for (let index = 0; index < 5; index += 1) {
      await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('gold', {
        finishStage: 'quarterfinalist', coachId: 'ancelotti', crestId: 'milan',
        report: { version: 1, games: 12, wins: 7, draws: 2, losses: 3, goals: 24, goalsAgainst: 14 },
        records: index === 0 ? [
          { category: 'goals', playerId: 'p9', playerName: 'Artilheiro', value: 16 },
          { category: 'saves', playerId: 'gk', playerName: 'Goleiro', value: 41 },
        ] : [],
      }) });
    }
    const state = Object.fromEntries((await call('/api/account/achievements', { cookie })).body.achievements.map((a: any) => [a.id, a]));
    expect(state.lasting_partnership).toMatchObject({ level: 1, progress: 5, detail: 'ancelotti' });
    expect(state.loyal_crest).toMatchObject({ level: 1, progress: 5, detail: 'milan' });
    expect(state.top_scorer).toMatchObject({ level: 1, progress: 16 });
    expect(state.brick_keeper).toMatchObject({ level: 2, progress: 41 });
    expect(state.qualified).toMatchObject({ level: 1, progress: 5 });
    expect(state.marathoner).toMatchObject({ level: 1, progress: 60 });
  });
});

describe('events and avatar frames', () => {
  afterEach(() => { vi.useRealTimers(); });
  const at = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };
  const finish = (difficultyId: string, finishStage: string) => soloHistory(difficultyId, { champion: finishStage === 'champion', finishStage });

  it('unlocks the frame when every objective is done inside the window, and only owners can wear it', async () => {
    const { call, register } = api(database());
    at('2026-10-10T12:00:00-03:00');
    const cookie = await register('noturno');

    const before = (await call('/api/account/events', { cookie })).body;
    expect(before.events[0]).toMatchObject({ id: 'noite-dos-imortais-2026', status: 'active', completed: false, frameUnlocked: false });
    expect(before.frames).toEqual([]);
    // A frame the account does not own cannot be equipped.
    expect((await call('/api/account/profile', { method: 'PATCH', cookie, body: { avatarFrameKey: 'noite-dos-imortais' } })).status).toBe(403);

    const posts = [finish('bronze', 'leaguePhase'), finish('gold', 'semifinalist'), finish('gold', 'runnerUp'), finish('silver', 'playoff')];
    for (const body of posts) expect((await call('/api/account/history', { method: 'POST', cookie, body })).body.framesUnlocked).toEqual([]);
    const progress = Object.fromEntries((await call('/api/account/events', { cookie })).body.events[0].objectives.map((o: any) => [o.id, o.progress]));
    expect(progress).toEqual({ competitions: 4, semifinals: 2, title: 0 });

    // The 5th competition: a Lendário title closes all three objectives.
    const last = await call('/api/account/history', { method: 'POST', cookie, body: finish('legendary', 'champion') });
    expect(last.body.framesUnlocked).toEqual([{ frameKey: 'noite-dos-imortais', eventId: 'noite-dos-imortais-2026' }]);
    const after = (await call('/api/account/events', { cookie })).body;
    expect(after.events[0]).toMatchObject({ completed: true, frameUnlocked: true });
    expect(after.frames).toEqual(['noite-dos-imortais']);

    const equipped = await call('/api/account/profile', { method: 'PATCH', cookie, body: { avatarFrameKey: 'noite-dos-imortais' } });
    expect(equipped.body.account.avatarFrameKey).toBe('noite-dos-imortais');
    expect((await call('/api/users/noturno')).body.profile.avatarFrameKey).toBe('noite-dos-imortais');
    // Taking it off is always allowed.
    expect((await call('/api/account/profile', { method: 'PATCH', cookie, body: { avatarFrameKey: null } })).body.account.avatarFrameKey).toBeNull();
  });

  it('counts only competitions completed inside the event window', async () => {
    const { call, register } = api(database());
    at('2026-10-03T23:00:00-03:00');
    const cookie = await register('adiantado');
    // One hour before the start: does not count.
    await call('/api/account/history', { method: 'POST', cookie, body: finish('immortal', 'champion') });
    expect((await call('/api/account/events', { cookie })).body.events[0].status).toBe('upcoming');
    at('2026-10-04T00:30:00-03:00');
    await call('/api/account/history', { method: 'POST', cookie, body: finish('gold', 'semifinalist') });
    const progress = Object.fromEntries((await call('/api/account/events', { cookie })).body.events[0].objectives.map((o: any) => [o.id, o.progress]));
    expect(progress).toEqual({ competitions: 1, semifinals: 1, title: 0 });
  });
});

describe('choice events and event Únicas', () => {
  afterEach(() => { vi.useRealTimers(); });
  const at = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };
  const event = (body: any) => body.events.find((e: any) => e.id === 'classicos-sp-2026');

  it('picks one club for good and unlocks only its card after its own challenges', async () => {
    const { call, register } = api(database());
    at('2026-10-20T12:00:00-03:00');
    const cookie = await register('alvinegro');
    // Before the start the clubs are shown but cannot be picked.
    expect(event((await call('/api/account/events', { cookie })).body)).toMatchObject({ status: 'upcoming', chosenKey: null });
    expect((await call('/api/account/events/classicos-sp-2026/choice', { method: 'POST', cookie, body: { choice: 'corinthians' } })).status).toBe(400);

    at('2026-11-05T12:00:00-03:00');
    // Without a choice nothing is tracked, even with Corinthians campaigns.
    await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('gold', { crestId: 'corinthians' }) });
    expect(event((await call('/api/account/events', { cookie })).body)).toMatchObject({ chosenKey: null, objectives: [], completed: false });

    expect((await call('/api/account/events/classicos-sp-2026/choice', { method: 'POST', cookie, body: { choice: 'time-qualquer' } })).status).toBe(400);
    const chosen = await call('/api/account/events/classicos-sp-2026/choice', { method: 'POST', cookie, body: { choice: 'corinthians' } });
    expect(chosen.status).toBe(200);
    expect(event(chosen.body)).toMatchObject({ chosenKey: 'corinthians', cardUnlocked: false });
    // The choice is for good.
    expect((await call('/api/account/events/classicos-sp-2026/choice', { method: 'POST', cookie, body: { choice: 'santos' } })).status).toBe(409);

    // The competition played before choosing already counts (it is inside the window).
    const posts = [
      soloHistory('gold', { crestId: 'corinthians', champion: false, finishStage: 'runnerUp' }),
      soloHistory('silver', { crestId: 'palmeiras', champion: true, finishStage: 'champion' }),
    ];
    for (const body of posts) expect((await call('/api/account/history', { method: 'POST', cookie, body })).body.eventCardsUnlocked).toEqual([]);
    const progress = Object.fromEntries(event((await call('/api/account/events', { cookie })).body).objectives.map((o: any) => [o.id, o.progress]));
    expect(progress).toEqual({ crest: 2, finals: 1, title: 0 });

    // A Corinthians title on Ouro closes all three.
    const last = await call('/api/account/history', { method: 'POST', cookie, body: soloHistory('gold', { crestId: 'corinthians', champion: true, finishStage: 'champion' }) });
    expect(last.body.eventCardsUnlocked).toEqual([{ cardId: 'emerson_sheik_unico', eventId: 'classicos-sp-2026' }]);
    const after = (await call('/api/account/events', { cookie })).body;
    expect(event(after)).toMatchObject({ completed: true, cardUnlocked: true });
    expect(after.eventCards).toEqual(['emerson_sheik_unico']);
  });
});

describe('profile likes', () => {
  it('likes once, unlikes, never likes itself and respects private profiles', async () => {
    const db = database();
    const { call, register } = api(db);
    const fan = await register('torcedor');
    const star = await register('craque');

    const liked = await call('/api/users/craque/like', { method: 'PUT', cookie: fan });
    expect(liked.body).toEqual({ liked: true, likeCount: 1 });
    // Liking twice keeps a single like.
    expect((await call('/api/users/craque/like', { method: 'PUT', cookie: fan })).body.likeCount).toBe(1);
    const seen = (await call('/api/users/craque', { cookie: fan })).body;
    expect(seen.profile.likeCount).toBe(1);
    expect(seen.likedByViewer).toBe(true);
    expect((await call('/api/account/profile', { cookie: star })).body.account.likeCount).toBe(1);

    expect((await call('/api/users/craque/like', { method: 'DELETE', cookie: fan })).body).toEqual({ liked: false, likeCount: 0 });
    expect((await call('/api/users/craque/like', { method: 'PUT', cookie: star })).status).toBe(400);
    expect((await call('/api/users/craque/like', { method: 'PUT' })).status).toBe(401);

    db.exec("UPDATE profiles SET visibility = 'private' WHERE username = 'craque'");
    expect((await call('/api/users/craque/like', { method: 'PUT', cookie: fan })).status).toBe(403);
  });
});
