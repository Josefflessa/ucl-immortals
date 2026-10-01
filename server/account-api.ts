import { DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY, isProfileAvatarBackgroundKey } from '../shared/profileAppearance';
import { getTeamEffectiveStats, type Team } from '../client/src/lib/gameEngine.js';
import { retainRecentCompetitionSnapshots } from './competition-history-retention.js';

const SESSION_COOKIE = 'ucl_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_BIO_LENGTH = 240;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const PASSWORD_MIN_LENGTH = 8;
// Cloudflare Workers WebCrypto rejects PBKDF2 counts above 100,000.
const PBKDF2_ITERATIONS = 100_000;
const AUTH_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LOCKOUT_MS = 5 * 60 * 1000;
const AUTH_MAX_FAILURES = 5;
export const ACCOUNT_PRESENCE_TTL_MS = 30_000;
export const ROOM_INVITATION_TTL_MS = 60_000;

export interface AccountEnv {
  DB: D1Database;
}

export interface AuthenticatedAccount {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarKey: string;
  avatarBackgroundKey: string;
  coverKey: string;
  favoriteCrestId: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  visibility: 'public' | 'friends' | 'private';
  createdAt: number;
  stats: AccountStats;
}

export interface AccountStats {
  competitionsCompleted: number;
  titles: number;
  finishCounts: {
    leaguePhase: number;
    playoff: number;
    roundOf16: number;
    quarterfinal: number;
    semifinal: number;
    runnerUp: number;
    champion: number;
  };
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  saves: number;
  highestEffectiveOverall: number;
  highestDifficultyId: string | null;
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_key: string;
  avatar_background_key: string;
  cover_key: string;
  favorite_crest_id: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  visibility: 'public' | 'friends' | 'private';
  created_at: number;
  competitions_completed?: number;
  titles?: number;
  finish_league_phase?: number;
  finish_playoff?: number;
  finish_round_of_16?: number;
  finish_quarterfinal?: number;
  finish_semifinal?: number;
  finish_runner_up?: number;
  finish_champion?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goals?: number;
  assists?: number;
  saves?: number;
  highest_effective_overall?: number;
  highest_difficulty_id?: string | null;
}

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function randomToken(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return base64url(values);
}

function base64url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

async function sha256(value: string): Promise<string> {
  return base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('cookie') ?? '';
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS, secure = true): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax`;
}

function normalizeUsername(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, 24);
}

async function deriveSecret(secret: string, salt: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return base64url(bits);
}

async function hashSecret(secret: string): Promise<string> {
  const salt = randomToken(16);
  const digest = await deriveSecret(secret, salt);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${salt}$${digest}`;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifySecret(secret: string, encoded: string | null | undefined): Promise<boolean> {
  if (!encoded) return false;
  const [algorithm, iterationsText, salt, expected] = encoded.split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== 'pbkdf2-sha256' || !Number.isSafeInteger(iterations) || !salt || !expected) return false;
  const actual = await deriveSecret(secret, salt, iterations);
  return constantTimeEqual(actual, expected);
}

function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  return null;
}

function statsFromRow(row: UserRow): AccountStats {
  return {
    competitionsCompleted: Number(row.competitions_completed ?? 0),
    titles: Number(row.titles ?? 0),
    finishCounts: {
      leaguePhase: Number(row.finish_league_phase ?? 0),
      playoff: Number(row.finish_playoff ?? 0),
      roundOf16: Number(row.finish_round_of_16 ?? 0),
      quarterfinal: Number(row.finish_quarterfinal ?? 0),
      semifinal: Number(row.finish_semifinal ?? 0),
      runnerUp: Number(row.finish_runner_up ?? 0),
      champion: Number(row.finish_champion ?? 0),
    },
    wins: Number(row.wins ?? 0),
    draws: Number(row.draws ?? 0),
    losses: Number(row.losses ?? 0),
    goals: Number(row.goals ?? 0),
    assists: Number(row.assists ?? 0),
    saves: Number(row.saves ?? 0),
    highestEffectiveOverall: Number(row.highest_effective_overall ?? 0),
    highestDifficultyId: row.highest_difficulty_id ?? null,
  };
}

function accountFromRow(row: UserRow): AuthenticatedAccount {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarKey: row.avatar_key,
    avatarBackgroundKey: row.avatar_background_key ?? DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY,
    coverKey: row.cover_key,
    favoriteCrestId: row.favorite_crest_id,
    avatarUrl: row.avatar_url ?? null,
    coverUrl: row.cover_url ?? null,
    visibility: row.visibility,
    createdAt: Number(row.created_at),
    stats: statsFromRow(row),
  };
}

const ACCOUNT_SELECT = `
  WITH competition_finishes AS (
    SELECT user_id,
      SUM(CASE WHEN competition_points = 5 THEN 1 ELSE 0 END) AS finish_league_phase,
      SUM(CASE WHEN competition_points = 15 THEN 1 ELSE 0 END) AS finish_playoff,
      SUM(CASE WHEN competition_points = 25 THEN 1 ELSE 0 END) AS finish_round_of_16,
      SUM(CASE WHEN competition_points = 40 THEN 1 ELSE 0 END) AS finish_quarterfinal,
      SUM(CASE WHEN competition_points = 60 THEN 1 ELSE 0 END) AS finish_semifinal,
      SUM(CASE WHEN competition_points = 80 THEN 1 ELSE 0 END) AS finish_runner_up,
      SUM(CASE WHEN competition_points = 100 THEN 1 ELSE 0 END) AS finish_champion
    FROM competition_history
    GROUP BY user_id
  )
  SELECT u.id, u.email, p.username, p.display_name, p.bio, p.avatar_key, p.avatar_background_key,
         p.cover_key, p.favorite_crest_id, p.avatar_url, p.cover_url, p.visibility, p.created_at,
         COALESCE(s.competitions_completed, 0) AS competitions_completed,
         COALESCE(s.titles, 0) AS titles,
         COALESCE(cf.finish_league_phase, 0) AS finish_league_phase,
         COALESCE(cf.finish_playoff, 0) AS finish_playoff,
         COALESCE(cf.finish_round_of_16, 0) AS finish_round_of_16,
         COALESCE(cf.finish_quarterfinal, 0) AS finish_quarterfinal,
         COALESCE(cf.finish_semifinal, 0) AS finish_semifinal,
         COALESCE(cf.finish_runner_up, 0) AS finish_runner_up,
         COALESCE(cf.finish_champion, 0) AS finish_champion,
         COALESCE(s.wins, 0) AS wins,
         COALESCE(s.draws, 0) AS draws,
         COALESCE(s.losses, 0) AS losses,
         COALESCE(s.goals, 0) AS goals,
         COALESCE(s.assists, 0) AS assists,
         COALESCE(s.saves, 0) AS saves,
         COALESCE(s.highest_effective_overall, 0) AS highest_effective_overall,
         s.highest_difficulty_id
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    LEFT JOIN profile_stats s ON s.user_id = u.id
    LEFT JOIN competition_finishes cf ON cf.user_id = u.id
`;

async function accountById(db: D1Database, userId: string): Promise<AuthenticatedAccount | null> {
  const row = await db.prepare(`${ACCOUNT_SELECT} WHERE u.id = ?`).bind(userId).first<UserRow>();
  return row ? accountFromRow(row) : null;
}

export async function authenticatedAccount(request: Request, env: AccountEnv): Promise<AuthenticatedAccount | null> {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Date.now();
  const row = await env.DB.prepare(`${ACCOUNT_SELECT}
    JOIN sessions sess ON sess.user_id = u.id
    WHERE sess.token_hash = ? AND sess.expires_at > ?`).bind(tokenHash, now).first<UserRow>();
  if (!row) return null;
  await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').bind(now, tokenHash).run();
  return accountFromRow(row);
}

async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken(32);
  const now = Date.now();
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR user_id = ?').bind(now, userId).run();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), userId, now + SESSION_TTL_SECONDS * 1000, now, now).run();
  return token;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function authRateKey(request: Request, username: string): Promise<string> {
  const address = request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return sha256(`password-login:${address}:${username}`);
}

async function rateLimitStatus(db: D1Database, key: string): Promise<{ blocked: boolean; retryAfter: number }> {
  const row = await db.prepare('SELECT blocked_until, window_started_at FROM auth_rate_limits WHERE key = ?').bind(key).first<{ blocked_until: number; window_started_at: number }>();
  if (!row) return { blocked: false, retryAfter: 0 };
  const now = Date.now();
  const blockedUntil = Number(row.blocked_until);
  if (blockedUntil > now) {
    const cappedBlockedUntil = Math.min(blockedUntil, now + AUTH_LOCKOUT_MS);
    if (cappedBlockedUntil !== blockedUntil) {
      await db.prepare('UPDATE auth_rate_limits SET blocked_until = ? WHERE key = ?').bind(cappedBlockedUntil, key).run();
    }
    return { blocked: true, retryAfter: Math.max(1, Math.ceil((cappedBlockedUntil - now) / 1000)) };
  }
  if (blockedUntil > 0 || now - Number(row.window_started_at) >= AUTH_FAILURE_WINDOW_MS) {
    await db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').bind(key).run();
    return { blocked: false, retryAfter: 0 };
  }
  return { blocked: false, retryAfter: 0 };
}

async function registerAuthFailure(db: D1Database, key: string): Promise<void> {
  const now = Date.now();
  const existing = await db.prepare('SELECT failed_count, window_started_at FROM auth_rate_limits WHERE key = ?').bind(key).first<{ failed_count: number; window_started_at: number }>();
  if (!existing || now - Number(existing.window_started_at) >= AUTH_FAILURE_WINDOW_MS) {
    await db.prepare('INSERT OR REPLACE INTO auth_rate_limits (key, failed_count, window_started_at, blocked_until) VALUES (?, 1, ?, 0)')
      .bind(key, now).run();
    return;
  }
  const failedCount = Number(existing.failed_count) + 1;
  const blockedUntil = failedCount >= AUTH_MAX_FAILURES ? now + AUTH_LOCKOUT_MS : 0;
  await db.prepare('UPDATE auth_rate_limits SET failed_count = ?, blocked_until = ? WHERE key = ?')
    .bind(failedCount, blockedUntil, key).run();
}

async function clearAuthFailures(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').bind(key).run();
}

async function registerLocalAccount(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  const username = normalizeUsername(String(body?.username ?? ''));
  const displayName = String(body?.displayName ?? username).trim().slice(0, 40) || username;
  const password = String(body?.password ?? '');
  if (!USERNAME_RE.test(username)) return json({ error: 'invalid_username', message: 'Use um nome de usuário com 3 a 24 caracteres: letras, números, ponto, hífen ou sublinhado.' }, 400);
  const passwordMessage = passwordError(password);
  if (passwordMessage) return json({ error: 'invalid_password', message: passwordMessage }, 400);
  const existing = await env.DB.prepare('SELECT user_id FROM profiles WHERE username = ?').bind(username).first<{ user_id: string }>();
  if (existing) return json({ error: 'username_taken', message: 'Esse nome de usuário já está em uso.' }, 409);

  const now = Date.now();
  const userId = `usr_${randomToken(12)}`;
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, `${userId}@local.ucl-immortals.invalid`, await hashSecret(password), now, now, now),
      env.DB.prepare(`INSERT INTO profiles
        (user_id, username, display_name, bio, avatar_key, cover_key, avatar_url, cover_url, favorite_crest_id, visibility, created_at, updated_at)
        VALUES (?, ?, ?, '', 'mark-evans', 'cover-01', NULL, NULL, NULL, 'public', ?, ?)`)
        .bind(userId, username, displayName, now, now),
      env.DB.prepare('INSERT INTO profile_stats (user_id, updated_at) VALUES (?, ?)').bind(userId, now),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[auth] local account creation failed', message);
    if (/unique constraint failed.*profiles\.username/i.test(message)) {
      return json({ error: 'username_taken', message: 'Esse nome de usuário já está em uso.' }, 409);
    }
    return json({ error: 'account_create_failed', message: 'Não foi possível criar a conta agora. Tente novamente.' }, 500);
  }
  return json({ message: 'Conta criada. Agora entre com seu nome de usuário e senha.' }, 201);
}

async function loginLocalAccount(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  const username = normalizeUsername(String(body?.username ?? ''));
  const password = String(body?.password ?? '');
  const genericError = { error: 'invalid_credentials', message: 'Nome de usuário ou senha incorretos.' };
  if (!USERNAME_RE.test(username) || !password) return json(genericError, 401);
  const key = await authRateKey(request, username);
  const rate = await rateLimitStatus(env.DB, key);
  if (rate.blocked) return json({ error: 'too_many_attempts', message: 'Muitas tentativas. Aguarde até 5 minutos e tente novamente.' }, 429, { 'retry-after': String(rate.retryAfter) });
  const row = await env.DB.prepare(`SELECT u.id, u.password_hash
    FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.username = ?`).bind(username).first<{ id: string; password_hash: string | null }>();
  if (!row || !(await verifySecret(password, row.password_hash))) {
    await registerAuthFailure(env.DB, key);
    return json(genericError, 401);
  }
  await clearAuthFailures(env.DB, key);
  const now = Date.now();
  await env.DB.prepare('UPDATE users SET updated_at = ?, last_seen_at = ? WHERE id = ?').bind(now, now, row.id).run();
  const session = await createSession(env.DB, row.id);
  return json({ account: await accountById(env.DB, row.id) }, 200, { 'set-cookie': sessionCookie(session, SESSION_TTL_SECONDS, !isLocalRequest(request)) });
}

function publicAccount(account: AuthenticatedAccount): Record<string, unknown> {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    bio: account.bio,
    avatarKey: account.avatarKey,
    avatarBackgroundKey: account.avatarBackgroundKey,
    coverKey: account.coverKey,
    avatarUrl: account.avatarUrl,
    coverUrl: account.coverUrl,
    favoriteCrestId: account.favoriteCrestId,
    createdAt: account.createdAt,
    stats: account.stats,
  };
}

async function profileUpdate(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ error: 'invalid_json' }, 400);
  if (body.username !== undefined && normalizeUsername(String(body.username)) !== account.username) {
    return json({ error: 'username_immutable', message: 'O nome de usuário não pode ser alterado após o cadastro.' }, 400);
  }
  const displayName = body.displayName === undefined ? account.displayName : String(body.displayName).trim().slice(0, 40);
  const bio = body.bio === undefined ? account.bio : String(body.bio).trim().slice(0, MAX_BIO_LENGTH);
  const avatarKey = body.avatarKey === undefined ? account.avatarKey : String(body.avatarKey).trim();
  const avatarBackgroundKey = body.avatarBackgroundKey === undefined ? account.avatarBackgroundKey : String(body.avatarBackgroundKey).trim();
  const coverKey = body.coverKey === undefined ? account.coverKey : String(body.coverKey).trim();
  const avatarUrl = body.avatarUrl === undefined
    ? (body.avatarKey !== undefined && avatarKey !== account.avatarKey ? null : account.avatarUrl)
    : (body.avatarUrl ? String(body.avatarUrl).slice(0, 500) : null);
  const coverUrl = body.coverUrl === undefined
    ? (body.coverKey !== undefined && coverKey !== account.coverKey ? null : account.coverUrl)
    : (body.coverUrl ? String(body.coverUrl).slice(0, 500) : null);
  const favoriteCrestId = body.favoriteCrestId === undefined ? account.favoriteCrestId : (body.favoriteCrestId ? String(body.favoriteCrestId).slice(0, 80) : null);
  if (!displayName) return json({ error: 'invalid_display_name' }, 400);
  if (!/^[a-z0-9-]{3,40}$/.test(avatarKey) || !/^[a-z0-9-]{3,40}$/.test(coverKey) || !isProfileAvatarBackgroundKey(avatarBackgroundKey)) return json({ error: 'invalid_profile_asset' }, 400);
  await env.DB.prepare(`UPDATE profiles SET display_name = ?, bio = ?, avatar_key = ?, avatar_background_key = ?, cover_key = ?, avatar_url = ?, cover_url = ?, favorite_crest_id = ?, updated_at = ? WHERE user_id = ?`)
    .bind(displayName, bio, avatarKey, avatarBackgroundKey, coverKey, avatarUrl, coverUrl, favoriteCrestId, Date.now(), account.id).run();
  const updated = await accountById(env.DB, account.id);
  return updated ? json({ account: publicAccount(updated) }) : json({ error: 'account_not_found' }, 404);
}

async function historyList(env: AccountEnv, account: AuthenticatedAccount, requestedPage: number): Promise<Response> {
  const pageSize = 10;
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM competition_history WHERE user_id = ?')
    .bind(account.id).first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * pageSize;
  const rows = await env.DB.prepare(`SELECT id, mode, difficulty_id, format_id, team_name, crest_id, coach_id,
      champion, placement, competition_points, report_json, completed_at
    FROM competition_history
    WHERE user_id = ?
    ORDER BY completed_at DESC, id DESC
    LIMIT ? OFFSET ?`).bind(account.id, pageSize, offset).all();
  return json({
    history: rows.results.map(row => ({ ...row, report: JSON.parse(String((row as any).report_json ?? '{}')) })),
    page,
    pageSize,
    total,
    totalPages,
  });
}

async function historyCreate(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const mode = body.mode === 'online' ? 'online' : body.mode === 'solo' ? 'solo' : null;
  const difficultyId = String(body.difficultyId ?? '').trim().slice(0, 40);
  const formatId = String(body.formatId ?? '').trim().slice(0, 60);
  const teamName = String(body.teamName ?? '').trim().slice(0, 80);
  const report = body.report;
  const sourceKey = body.sourceKey ? String(body.sourceKey).trim().slice(0, 160) : null;
  const submittedRecords = Array.isArray(body.records) ? body.records : [];
  if (!mode || !difficultyId || !formatId || !teamName || !report || typeof report !== 'object' || Array.isArray(report)) {
    return json({ error: 'invalid_history' }, 400);
  }
  if (mode !== 'solo') return json({ error: 'online_history_server_authoritative', message: 'Resultados online são registrados pelo servidor da sala.' }, 400);
  const champion = body.champion ? 1 : 0;
  const allowedFinishPoints = new Set([5, 15, 25, 40, 60, 80]);
  const submittedPoints = Number(body.competitionPoints);
  const competitionPoints = champion ? 100 : allowedFinishPoints.has(submittedPoints) ? submittedPoints : 0;
  let reportJson: string;
  try {
    reportJson = JSON.stringify({ ...(report as Record<string, unknown>), competitionPoints });
  } catch {
    return json({ error: 'invalid_history' }, 400);
  }
  if (reportJson.length > 180_000) return json({ error: 'history_too_large' }, 413);
  if (submittedRecords.length > 4) return json({ error: 'too_many_records' }, 400);
  const allowedCategories = new Set(['goals', 'assists', 'saves', 'effective_overall']);
  const recordCategories = new Set<string>();
  const safeRecords: Array<{ category: string; playerId: string; playerName: string; playerPhotoUrl: string | null; value: number }> = [];
  for (const candidate of submittedRecords) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return json({ error: 'invalid_record' }, 400);
    const record = candidate as Record<string, unknown>;
    const category = String(record.category ?? '');
    const playerId = String(record.playerId ?? '').trim().slice(0, 100);
    const playerName = String(record.playerName ?? '').trim().slice(0, 100);
    const playerPhotoUrl = record.playerPhotoUrl ? String(record.playerPhotoUrl).slice(0, 500) : null;
    const value = Number(record.value);
    if (mode !== 'solo' || !allowedCategories.has(category) || recordCategories.has(category) || !playerId || !playerName || !Number.isSafeInteger(value)) {
      return json({ error: 'invalid_record' }, 400);
    }
    const maxValue = 9_999;
    if (value < 1 || value > maxValue) {
      const categoryLabel = category === 'goals' ? 'gols'
        : category === 'assists' ? 'assistências'
          : category === 'saves' ? 'defesas'
            : 'overall efetivo';
      return json({
        error: 'invalid_record_value',
        message: `O recorde de ${categoryLabel} (${value}) precisa ficar entre 1 e ${maxValue}.`,
      }, 400);
    }
    recordCategories.add(category);
    safeRecords.push({ category, playerId, playerName, playerPhotoUrl, value });
  }
  const id = `cmp_${randomToken(12)}`;
  const now = Date.now();
  const placement = body.placement == null ? null : Math.max(1, Math.min(999, Number(body.placement)) || 1);
  const crestId = body.crestId ? String(body.crestId).slice(0, 80) : null;
  const coachId = body.coachId ? String(body.coachId).slice(0, 80) : null;
  const statements = [env.DB.prepare(`INSERT INTO competition_history
      (id, user_id, mode, difficulty_id, format_id, team_name, crest_id, coach_id, champion, placement, competition_points, report_json, source_key, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, account.id, mode, difficultyId, formatId, teamName, crestId, coachId, champion, placement, competitionPoints, reportJson, sourceKey, now)];
  const persistedRecords = safeRecords.map(record => {
    const playerCard = recordPlayerCard(reportJson, record.playerId);
    const effectiveCardStats = playerCard?.effectiveStats && typeof playerCard.effectiveStats === 'object'
      ? playerCard.effectiveStats as Record<string, unknown>
      : null;
    const value = record.category === 'effective_overall'
      && typeof effectiveCardStats?.overall === 'number'
      && Number.isSafeInteger(effectiveCardStats.overall)
      && effectiveCardStats.overall >= 1
      ? effectiveCardStats.overall
      : record.value;
    return { ...record, value, playerCard };
  });
  for (const record of persistedRecords) {
    statements.push(env.DB.prepare(`INSERT INTO competition_records
      (id, competition_id, user_id, category, difficulty_id, player_id, player_name, player_photo_url, value,
       username_snapshot, team_name_snapshot, crest_id_snapshot, mode, format_id, completed_at, player_card_json, verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(`rec_${randomToken(12)}`, id, account.id, record.category, difficultyId, record.playerId, record.playerName,
        record.playerPhotoUrl, record.value, account.username, teamName, crestId, mode, formatId, now,
        record.playerCard ? JSON.stringify(record.playerCard) : null, now));
  }
  const reportValues = report as Record<string, unknown>;
  const safeStat = (key: string, max: number) => {
    const value = Number(reportValues[key]);
    return Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
  };
  const effectiveRecord = persistedRecords.find(record => record.category === 'effective_overall');
  statements.push(env.DB.prepare(`INSERT INTO profile_stats
    (user_id, competitions_completed, titles, wins, draws, losses, goals, assists, saves, highest_effective_overall, highest_difficulty_id, updated_at)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      competitions_completed = profile_stats.competitions_completed + 1,
      titles = profile_stats.titles + excluded.titles,
      wins = profile_stats.wins + excluded.wins,
      draws = profile_stats.draws + excluded.draws,
      losses = profile_stats.losses + excluded.losses,
      goals = profile_stats.goals + excluded.goals,
      assists = profile_stats.assists + excluded.assists,
      saves = profile_stats.saves + excluded.saves,
      highest_effective_overall = MAX(profile_stats.highest_effective_overall, excluded.highest_effective_overall),
      highest_difficulty_id = CASE WHEN excluded.highest_effective_overall > profile_stats.highest_effective_overall THEN excluded.highest_difficulty_id ELSE profile_stats.highest_difficulty_id END,
      updated_at = excluded.updated_at`)
    .bind(account.id, champion, safeStat('wins', 999), safeStat('draws', 999), safeStat('losses', 999), safeStat('goals', 9999), safeStat('assists', 9999), safeStat('saves', 9999), effectiveRecord?.value ?? 0, effectiveRecord ? difficultyId : null, now));
  try {
    // History, record entries, and profile aggregates must commit together so
    // an automatic retry cannot leave partial competition data behind.
    await env.DB.batch(statements);
  } catch (error) {
    if (sourceKey) {
      const existing = await env.DB.prepare('SELECT id FROM competition_history WHERE user_id = ? AND source_key = ?')
        .bind(account.id, sourceKey).first<{ id: string }>();
      if (existing) {
        await retainRecentCompetitionSnapshots(env.DB, account.id);
        return json({ id: existing.id, duplicate: true });
      }
    }
    throw error;
  }
  await retainRecentCompetitionSnapshots(env.DB, account.id);
  return json({ id, duplicate: false }, 201);
}

async function publicRecords(env: AccountEnv, url: URL): Promise<Response> {
  const category = url.searchParams.get('category');
  const difficulty = url.searchParams.get('difficulty');
  const allowed = new Set(['goals', 'assists', 'saves', 'effective_overall']);
  if (category && !allowed.has(category)) return json({ error: 'invalid_category' }, 400);
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (category) { clauses.push('r.category = ?'); binds.push(category); }
  if (difficulty) { clauses.push('r.difficulty_id = ?'); binds.push(difficulty); }
  const where = ['r.verified = 1', ...clauses].join(' AND ');
  const rows = await env.DB.prepare(`WITH ranked_records AS (
    SELECT r.id, r.user_id, r.category, r.difficulty_id, r.player_id, r.player_name, r.player_photo_url, r.value,
        r.username_snapshot, r.team_name_snapshot, r.crest_id_snapshot, r.created_at, r.competition_id,
        r.mode, r.format_id, r.completed_at, r.player_card_json,
        ${RECORD_CARD_EFFECTIVE_OVERALL_SQL} AS effective_overall_snapshot,
        ROW_NUMBER() OVER (
          PARTITION BY r.difficulty_id, r.category
          ORDER BY r.value DESC, r.created_at ASC, r.id ASC
        ) AS ranking_position
      FROM competition_records r
      WHERE ${where}
    )
    SELECT r.id, r.category, r.difficulty_id, r.player_id, r.player_name, r.player_photo_url, r.value,
      r.username_snapshot, r.team_name_snapshot, r.crest_id_snapshot, r.created_at,
      CASE WHEN p.visibility = 'public' THEN p.display_name ELSE NULL END AS profile_display_name,
      CASE WHEN p.visibility = 'public' THEN p.avatar_key ELSE NULL END AS profile_avatar_key,
      CASE WHEN p.visibility = 'public' THEN p.avatar_background_key ELSE NULL END AS profile_avatar_background_key,
      CASE WHEN p.visibility = 'public' THEN p.avatar_url ELSE NULL END AS profile_avatar_url,
      r.mode, r.format_id, r.completed_at, r.player_card_json, r.effective_overall_snapshot,
      ${RECORD_CARD_CONTEXT_SQL} AS player_card_context, r.ranking_position
    FROM ranked_records r
    LEFT JOIN profiles p ON p.user_id = r.user_id
    WHERE r.ranking_position <= 10
    ORDER BY r.difficulty_id, r.category, r.ranking_position`).bind(...binds).all();
  const records = rows.results.map((row: any) => {
    const { player_card_json: playerCardJson, effective_overall_snapshot: effectiveOverallSnapshot, player_card_context: playerCardContext, ...record } = row;
    const contextStats = effectiveCardStatsFromContext(playerCardContext, String(row.player_id));
    const effectiveOverall = normalizedRecordOverall(effectiveOverallSnapshot) ?? contextStats?.overall ?? null;
    const cardData = storedRecordCardData(playerCardJson, effectiveOverall, contextStats);
    return {
      ...record,
      ...(record.category === 'effective_overall' && effectiveOverall !== null ? { value: effectiveOverall } : {}),
      rank_position: Number(row.ranking_position),
      ...cardData,
    };
  });
  return json({ records });
}

function recordPlayerCard(reportJson: unknown, playerId: string): Record<string, unknown> | null {
  try {
    const report: unknown = JSON.parse(String(reportJson ?? ''));
    if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
    const snapshot = (report as Record<string, unknown>).historySnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    const team = (snapshot as Record<string, unknown>).playerTeam;
    if (!team || typeof team !== 'object' || Array.isArray(team)) return null;
    const players = (team as Record<string, unknown>).players;
    if (!Array.isArray(players)) return null;
    const player = players.find(candidate => candidate && typeof candidate === 'object'
      && !Array.isArray(candidate) && (candidate as Record<string, unknown>).id === playerId) as Record<string, unknown> | undefined;
    if (!player) return null;

    const validPlayer = validatedRecordPlayerCard(player);
    if (!validPlayer) return null;

    const effectiveOverallByPlayerId = (snapshot as Record<string, unknown>).effectiveOverallByPlayerId;
    const savedEffectiveOverall = effectiveOverallByPlayerId && typeof effectiveOverallByPlayerId === 'object' && !Array.isArray(effectiveOverallByPlayerId)
      ? (effectiveOverallByPlayerId as Record<string, unknown>)[playerId]
      : null;
    const effectiveStatsByPlayerId = (snapshot as Record<string, unknown>).effectiveStatsByPlayerId;
    const savedEffectiveStats = effectiveStatsByPlayerId && typeof effectiveStatsByPlayerId === 'object' && !Array.isArray(effectiveStatsByPlayerId)
      ? normalizedEffectiveCardStats((effectiveStatsByPlayerId as Record<string, unknown>)[playerId])
      : null;
    const effectiveStats = savedEffectiveStats
      ?? legacyEffectiveCardStats(report as Record<string, unknown>, snapshot as Record<string, unknown>, team as Record<string, unknown>, playerId);
    const effectiveOverall = effectiveStats?.overall ?? (typeof savedEffectiveOverall === 'number' && Number.isFinite(savedEffectiveOverall)
      ? Math.round(savedEffectiveOverall)
      : legacyEffectiveOverall(report as Record<string, unknown>, snapshot as Record<string, unknown>, team as Record<string, unknown>, playerId));
    return effectiveOverall !== null && Number.isSafeInteger(effectiveOverall) && effectiveOverall >= 1
      ? {
          ...validPlayer,
          effectiveStats: {
            overall: effectiveOverall,
            pace: effectiveStats?.pace ?? validPlayer.pace,
            shooting: effectiveStats?.shooting ?? validPlayer.shooting,
            passing: effectiveStats?.passing ?? validPlayer.passing,
            dribbling: effectiveStats?.dribbling ?? validPlayer.dribbling,
            defending: effectiveStats?.defending ?? validPlayer.defending,
            physical: effectiveStats?.physical ?? validPlayer.physical,
            vision: effectiveStats?.vision ?? validPlayer.vision,
            composure: effectiveStats?.composure ?? validPlayer.composure,
          },
        }
      : validPlayer;
  } catch {
    return null;
  }
}

function validatedRecordPlayerCard(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const player = value as Record<string, unknown>;
  const stringFields = ['id', 'shortName', 'fullName', 'position', 'nation', 'club', 'season'];
  const numberFields = ['overall', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'composure', 'vision'];
  const validRarities = new Set(['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique']);
  if (!stringFields.every(field => typeof player[field] === 'string')
    || !numberFields.every(field => typeof player[field] === 'number' && Number.isFinite(player[field]))
    || !Array.isArray(player.traits) || !player.traits.every(trait => typeof trait === 'string')
    || typeof player.rarity !== 'string' || !validRarities.has(player.rarity)
    || (player.photoUrl !== undefined && player.photoUrl !== null && typeof player.photoUrl !== 'string')) return null;
  return player;
}

function storedRecordPlayerCard(playerCardJson: unknown): Record<string, unknown> | null {
  try {
    return validatedRecordPlayerCard(JSON.parse(String(playerCardJson ?? '')));
  } catch {
    return null;
  }
}

function normalizedRecordOverall(value: unknown): number | null {
  const overall = typeof value === 'number' ? value : value == null ? NaN : Number(value);
  return Number.isSafeInteger(overall) && overall >= 1 ? overall : null;
}

const EFFECTIVE_RECORD_CARD_FIELDS = [
  'overall', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure',
] as const;

function normalizedEffectiveCardStats(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const stats = value as Record<string, unknown>;
  const normalized: Record<string, number> = {};
  for (const field of EFFECTIVE_RECORD_CARD_FIELDS) {
    const stat = normalizedRecordOverall(stats[field]);
    if (stat === null) return null;
    normalized[field] = stat;
  }
  return normalized;
}

function effectiveCardStatsFromContext(contextJson: unknown, playerId: string): Record<string, number> | null {
  try {
    const report: unknown = JSON.parse(String(contextJson ?? ''));
    if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
    const reportRecord = report as Record<string, unknown>;
    const snapshot = reportRecord.historySnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    const snapshotRecord = snapshot as Record<string, unknown>;
    const savedStats = snapshotRecord.effectiveStatsByPlayerId;
    if (savedStats && typeof savedStats === 'object' && !Array.isArray(savedStats)) {
      const normalized = normalizedEffectiveCardStats((savedStats as Record<string, unknown>)[playerId]);
      if (normalized) return normalized;
    }
    const team = snapshotRecord.playerTeam;
    return team && typeof team === 'object' && !Array.isArray(team)
      ? legacyEffectiveCardStats(reportRecord, snapshotRecord, team as Record<string, unknown>, playerId)
      : null;
  } catch {
    return null;
  }
}

function storedRecordCardData(
  playerCardJson: unknown,
  effectiveOverall: number | null,
  contextEffectiveStats: Record<string, number> | null,
): { player_card: Record<string, unknown> | null; player_effective_stats: Record<string, number> | null } {
  const stored = storedRecordPlayerCard(playerCardJson);
  if (!stored) return { player_card: null, player_effective_stats: null };
  const { effectiveStats: embeddedStats, ...player } = stored;
  const effectiveStats = contextEffectiveStats ?? normalizedEffectiveCardStats(embeddedStats);
  const overall = effectiveOverall ?? effectiveStats?.overall ?? null;
  const displayedStats: Record<string, number> | null = effectiveStats
    ? { ...effectiveStats, ...(overall !== null ? { overall } : {}) }
    : overall !== null
      ? {
          overall,
          pace: Number(player.pace),
          shooting: Number(player.shooting),
          passing: Number(player.passing),
          dribbling: Number(player.dribbling),
          defending: Number(player.defending),
          physical: Number(player.physical),
          vision: Number(player.vision),
          composure: Number(player.composure),
        }
      : null;
  return { player_card: player, player_effective_stats: displayedStats };
}

// Use one campaign snapshot for every category card. The saved per-player map is
// authoritative; an effective-overall record is a fallback for archived legacy
// snapshots where the map was intentionally removed after 20 competitions.
const RECORD_CARD_EFFECTIVE_OVERALL_SQL = `COALESCE(
  (SELECT CAST(player_overall.value AS INTEGER)
     FROM competition_history h
     JOIN json_each(CASE WHEN json_valid(h.report_json)
       THEN COALESCE(json_extract(h.report_json, '$.historySnapshot.effectiveOverallByPlayerId'), '{}')
       ELSE '{}'
     END) player_overall ON player_overall.key = r.player_id
    WHERE h.id = r.competition_id
      AND player_overall.type IN ('integer', 'real')
      AND CAST(player_overall.value AS INTEGER) >= 1
    LIMIT 1),
  (SELECT MAX(e.value)
     FROM competition_records e
    WHERE e.competition_id = r.competition_id
      AND e.player_id = r.player_id
      AND e.category = 'effective_overall'),
  CASE WHEN r.category = 'effective_overall' THEN r.value END
)`;

const RECORD_CARD_CONTEXT_SQL = `(SELECT json_object(
  'source', json_extract(h.report_json, '$.source'),
  'historySnapshot', json_object(
    'playerTeam', CASE WHEN json_type(h.report_json, '$.historySnapshot.playerTeam') = 'object'
      THEN json(json_extract(h.report_json, '$.historySnapshot.playerTeam')) ELSE NULL END,
    'effectiveStatsByPlayerId', CASE WHEN json_type(h.report_json, '$.historySnapshot.effectiveStatsByPlayerId') = 'object'
      THEN json(json_extract(h.report_json, '$.historySnapshot.effectiveStatsByPlayerId')) ELSE NULL END,
    'effectiveOverallByPlayerId', CASE WHEN json_type(h.report_json, '$.historySnapshot.effectiveOverallByPlayerId') = 'object'
      THEN json(json_extract(h.report_json, '$.historySnapshot.effectiveOverallByPlayerId')) ELSE NULL END,
    'formatId', json_extract(h.report_json, '$.historySnapshot.formatId'),
    'finalResult', CASE WHEN json_type(h.report_json, '$.historySnapshot.finalResult') = 'object'
      THEN json(json_extract(h.report_json, '$.historySnapshot.finalResult')) ELSE NULL END,
    'playStyle', json_extract(h.report_json, '$.historySnapshot.playStyle'),
    'championId', json_extract(h.report_json, '$.historySnapshot.championId')
  )
)
FROM competition_history h
WHERE h.id = r.competition_id
  AND json_valid(h.report_json)
  AND json_type(h.report_json, '$.historySnapshot') = 'object')`;

function legacyEffectiveOverall(
  report: Record<string, unknown>,
  snapshot: Record<string, unknown>,
  teamRecord: Record<string, unknown>,
  playerId: string,
): number | null {
  const season = report.season;
  if (season && typeof season === 'object' && !Array.isArray(season)) {
    const highest = (season as Record<string, unknown>).highestEffectiveOverall;
    if (highest && typeof highest === 'object' && !Array.isArray(highest)) {
      const saved = highest as Record<string, unknown>;
      if (saved.playerId === playerId && typeof saved.value === 'number' && Number.isFinite(saved.value)) return Math.round(saved.value);
    }
  }

  return legacyEffectiveCardStats(report, snapshot, teamRecord, playerId)?.overall ?? null;
}

function legacyEffectiveCardStats(
  report: Record<string, unknown>,
  snapshot: Record<string, unknown>,
  teamRecord: Record<string, unknown>,
  playerId: string,
): Record<string, number> | null {
  const players = teamRecord.players;
  if (!Array.isArray(players) || players.length > 40) return null;

  const teamId = typeof teamRecord.id === 'string' ? teamRecord.id : '';
  const formatId = typeof snapshot.formatId === 'string' ? snapshot.formatId : '';
  const finalResult = snapshot.finalResult && typeof snapshot.finalResult === 'object' && !Array.isArray(snapshot.finalResult)
    ? snapshot.finalResult as Record<string, unknown>
    : null;
  const finalIncludesTeam = Boolean(finalResult && (finalResult.homeTeamId === teamId || finalResult.awayTeamId === teamId));
  const isServerRecord = report.source === 'server';
  const isLosing = isServerRecord
    ? snapshot.championId !== teamId
    : finalIncludesTeam && (finalResult!.homeTeamId === teamId
      ? Number(finalResult!.homeGoals) < Number(finalResult!.awayGoals)
      : Number(finalResult!.awayGoals) < Number(finalResult!.homeGoals));

  try {
    const effective = getTeamEffectiveStats(teamRecord as unknown as Team, {
      playStyle: typeof snapshot.playStyle === 'string' ? snapshot.playStyle : undefined,
      isKnockout: formatId !== 'league',
      isFinal: isServerRecord || finalIncludesTeam,
      isLosing,
    });
    const stats = effective[playerId];
    if (!stats) return null;
    return normalizedEffectiveCardStats(stats);
  } catch {
    return null;
  }
}

async function loadRecordHighlights(env: AccountEnv, userId: string): Promise<Record<string, unknown>[]> {
  const rows = await env.DB.prepare(`WITH ranked_records AS (
      SELECT r.id, r.user_id, r.category, r.difficulty_id, r.player_id, r.player_name, r.player_photo_url, r.value,
             r.team_name_snapshot, r.crest_id_snapshot, r.created_at, r.competition_id,
             r.mode, r.format_id, r.completed_at, r.player_card_json,
             ${RECORD_CARD_EFFECTIVE_OVERALL_SQL} AS effective_overall_snapshot,
             ROW_NUMBER() OVER (
               PARTITION BY r.category
               ORDER BY r.value DESC, r.created_at ASC, r.id ASC
             ) AS ranking_position,
             ROW_NUMBER() OVER (
               PARTITION BY r.category, r.user_id
               ORDER BY r.value DESC, r.created_at ASC, r.id ASC
             ) AS user_record_rank
        FROM competition_records r
       WHERE r.difficulty_id = 'immortal' AND r.verified = 1
         AND r.category IN ('goals', 'assists', 'saves', 'effective_overall')
    )
    SELECT r.category, r.difficulty_id, r.player_id, r.player_name, r.player_photo_url, r.value,
           r.team_name_snapshot, r.crest_id_snapshot,
           p.display_name AS profile_display_name, p.avatar_key AS profile_avatar_key,
           p.avatar_background_key AS profile_avatar_background_key, p.avatar_url AS profile_avatar_url,
           r.mode, r.format_id, r.completed_at,
           r.player_card_json, r.effective_overall_snapshot,
           ${RECORD_CARD_CONTEXT_SQL} AS player_card_context, r.ranking_position AS rank_position
      FROM ranked_records r
      LEFT JOIN profiles p ON p.user_id = r.user_id
     WHERE r.user_id = ? AND r.user_record_rank = 1
     ORDER BY CASE r.category WHEN 'goals' THEN 1 WHEN 'assists' THEN 2 WHEN 'saves' THEN 3 ELSE 4 END`)
    .bind(userId).all();
  return rows.results.map((row: any) => {
    const { player_card_json: playerCardJson, effective_overall_snapshot: effectiveOverallSnapshot, player_card_context: playerCardContext, ...record } = row;
    const contextStats = effectiveCardStatsFromContext(playerCardContext, String(row.player_id));
    const effectiveOverall = normalizedRecordOverall(effectiveOverallSnapshot) ?? contextStats?.overall ?? null;
    const cardData = storedRecordCardData(playerCardJson, effectiveOverall, contextStats);
    return {
      ...record,
      ...(record.category === 'effective_overall' && effectiveOverall !== null ? { value: effectiveOverall } : {}),
      rank_position: Number(row.rank_position),
      ...cardData,
    };
  });
}

async function accountRecordHighlights(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const records = await loadRecordHighlights(env, account.id);
  return json({ records });
}

async function scoreLeaderboard(env: AccountEnv): Promise<Response> {
  const pointExpression = 'competition_points';
  const rows = await env.DB.prepare(`WITH totals AS (
      SELECT user_id,
        SUM(${pointExpression}) AS points,
        SUM(CASE WHEN ${pointExpression} > 0 THEN 1 ELSE 0 END) AS scored_competitions,
        SUM(champion) AS titles
      FROM competition_history
      GROUP BY user_id
    )
    SELECT p.username, p.display_name, p.avatar_key, p.avatar_background_key, p.avatar_url,
      latest.team_name AS team_name_snapshot, latest.crest_id AS crest_id_snapshot,
      totals.points, totals.scored_competitions, totals.titles
    FROM totals
    JOIN profiles p ON p.user_id = totals.user_id
    LEFT JOIN competition_history latest ON latest.id = (
      SELECT h.id FROM competition_history h
      WHERE h.user_id = totals.user_id
      ORDER BY h.completed_at DESC, h.id DESC
      LIMIT 1
    )
    WHERE p.visibility = 'public' AND totals.points > 0
    ORDER BY totals.points DESC, totals.titles DESC, totals.scored_competitions DESC, LOWER(p.username) ASC
    LIMIT 10`).all();
  const ranking = rows.results.map((row: any) => ({
    ...row,
    points: Number(row.points ?? 0),
    scored_competitions: Number(row.scored_competitions ?? 0),
    titles: Number(row.titles ?? 0),
  }));
  return json({ ranking });
}

async function getScoreLeaderboardPosition(env: AccountEnv, account: AuthenticatedAccount) {
  const pointExpression = 'competition_points';
  const row = await env.DB.prepare(`WITH totals AS (
      SELECT user_id,
        SUM(${pointExpression}) AS points,
        SUM(CASE WHEN ${pointExpression} > 0 THEN 1 ELSE 0 END) AS scored_competitions,
        SUM(champion) AS titles
      FROM competition_history
      GROUP BY user_id
    ), ranked AS (
      SELECT p.user_id,
        ROW_NUMBER() OVER (
          ORDER BY totals.points DESC, totals.titles DESC, totals.scored_competitions DESC, LOWER(p.username) ASC
        ) AS position
      FROM totals
      JOIN profiles p ON p.user_id = totals.user_id
      WHERE p.visibility = 'public' AND totals.points > 0
    )
    SELECT ranked.position,
      COALESCE(totals.points, 0) AS points,
      COALESCE(totals.scored_competitions, 0) AS scored_competitions,
      COALESCE(totals.titles, 0) AS titles,
      (SELECT COUNT(*) FROM ranked) AS participants
    FROM (SELECT ? AS user_id) viewer
    LEFT JOIN totals ON totals.user_id = viewer.user_id
    LEFT JOIN ranked ON ranked.user_id = viewer.user_id`).bind(account.id).first<{
      position: number | null;
      points: number;
      scored_competitions: number;
      titles: number;
      participants: number;
    }>();

  const position = row?.position == null ? null : Number(row.position);
  const isListed = account.visibility === 'public';
  return {
    position,
    participants: Number(row?.participants ?? 0),
    points: Number(row?.points ?? 0),
    scored_competitions: Number(row?.scored_competitions ?? 0),
    titles: Number(row?.titles ?? 0),
    status: !isListed ? 'profile_not_public' : position === null ? 'no_points' : 'ranked',
  } as const;
}

async function scoreLeaderboardPosition(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  return json(await getScoreLeaderboardPosition(env, account));
}

async function friendsList(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const now = Date.now();
  const rows = await env.DB.prepare(`WITH presence_summary AS (
      SELECT user_id,
        MAX(CASE WHEN status IN ('available', 'busy') THEN 1 ELSE 0 END) AS is_online,
        MAX(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS has_available_session,
        MAX(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) AS has_busy_session
      FROM account_presence WHERE updated_at > ? GROUP BY user_id
    ), friendship_rows AS (
      SELECT f.id, f.status, f.requester_id, f.addressee_id, f.created_at, f.updated_at,
        CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS friend_id
      FROM friendships f
      WHERE f.requester_id = ? OR f.addressee_id = ?
    )
    SELECT f.id, f.status, f.requester_id, f.addressee_id, f.created_at, f.updated_at,
    pr.username AS requester_username, pr.display_name AS requester_display_name, pr.avatar_key AS requester_avatar_key, pr.avatar_background_key AS requester_avatar_background_key,
    pa.username AS addressee_username, pa.display_name AS addressee_display_name, pa.avatar_key AS addressee_avatar_key, pa.avatar_background_key AS addressee_avatar_background_key,
    COALESCE(ps.is_online, 0) AS is_online,
    CASE WHEN COALESCE(ps.has_available_session, 0) = 1 AND COALESCE(ps.has_busy_session, 0) = 0 THEN 1 ELSE 0 END AS is_available,
    COALESCE(ps.has_busy_session, 0) AS is_busy
    FROM friendship_rows f
    JOIN profiles pr ON pr.user_id = f.requester_id
    JOIN profiles pa ON pa.user_id = f.addressee_id
    LEFT JOIN presence_summary ps ON ps.user_id = f.friend_id
    ORDER BY f.updated_at DESC`).bind(now - ACCOUNT_PRESENCE_TTL_MS, account.id, account.id, account.id).all();
  const friends = rows.results.map((row: any) => ({
    ...row,
    is_online: Boolean(row.is_online),
    is_available: Boolean(row.is_available),
    is_busy: Boolean(row.is_busy),
  }));
  return json({ friends });
}

async function updatePresence(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const body = await readJson(request);
  const presenceId = typeof body?.presenceId === 'string' ? body.presenceId : '';
  const status = body?.status;
  const revision = Number(body?.revision);
  const statusChanged = body?.statusChanged === true;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(presenceId)
    || !['available', 'busy', 'away'].includes(String(status))
    || !Number.isSafeInteger(revision) || revision < 1) {
    return json({ error: 'invalid_presence' }, 400);
  }

  const now = Date.now();
  if (revision === 1 || revision % 360 === 0) {
    await env.DB.prepare('DELETE FROM account_presence WHERE user_id = ? AND updated_at <= ?')
      .bind(account.id, now - 24 * 60 * 60 * 1000).run();
  }
  const updated = await env.DB.prepare(`INSERT INTO account_presence (user_id, presence_id, status, revision, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, presence_id) DO UPDATE SET
      status = excluded.status, revision = excluded.revision, updated_at = excluded.updated_at
    WHERE excluded.revision > account_presence.revision`)
    .bind(account.id, presenceId, status, revision, now).run();
  if (statusChanged && status !== 'available' && updated.meta.changes) {
    const currentPresence = await env.DB.prepare(`SELECT
        EXISTS(SELECT 1 FROM account_presence WHERE user_id = ? AND status = 'available' AND updated_at > ?) AS has_available_session,
        EXISTS(SELECT 1 FROM account_presence WHERE user_id = ? AND status = 'busy' AND updated_at > ?) AS has_busy_session`)
      .bind(account.id, now - ACCOUNT_PRESENCE_TTL_MS, account.id, now - ACCOUNT_PRESENCE_TTL_MS)
      .first<{ has_available_session: number; has_busy_session: number }>();
    if (!currentPresence?.has_available_session || currentPresence.has_busy_session) {
      await env.DB.prepare(`UPDATE room_invitations SET status = 'expired', updated_at = ?
        WHERE invitee_user_id = ? AND status = 'pending'`)
        .bind(now, account.id).run();
    }
  }
  return json({ ok: true });
}

async function roomInvitationsList(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const now = Date.now();
  await env.DB.prepare(`UPDATE room_invitations SET status = 'expired', updated_at = ?
    WHERE invitee_user_id = ? AND status = 'pending' AND (expires_at <= ? OR created_at <= ?)`)
    .bind(now, account.id, now, now - ROOM_INVITATION_TTL_MS).run();
  const rows = await env.DB.prepare(`SELECT i.id, i.room_code, i.inviter_user_id, i.created_at, i.expires_at,
      p.username AS inviter_username, p.display_name AS inviter_display_name, p.avatar_key AS inviter_avatar_key,
      p.avatar_background_key AS inviter_avatar_background_key
    FROM room_invitations i
    JOIN profiles p ON p.user_id = i.inviter_user_id
    WHERE i.invitee_user_id = ? AND i.status = 'pending' AND i.expires_at > ? AND i.created_at > ?
    ORDER BY i.created_at DESC LIMIT 50`).bind(account.id, now, now - ROOM_INVITATION_TTL_MS).all();
  return json({ invitations: rows.results });
}

async function roomInvitationDecline(env: AccountEnv, account: AuthenticatedAccount, id: string): Promise<Response> {
  const now = Date.now();
  const result = await env.DB.prepare(`UPDATE room_invitations
    SET status = CASE WHEN expires_at <= ? OR created_at <= ? THEN 'expired' ELSE 'declined' END, updated_at = ?
    WHERE id = ? AND invitee_user_id = ? AND status = 'pending'`)
    .bind(now, now - ROOM_INVITATION_TTL_MS, now, id, account.id).run();
  if (!result.meta.changes) return json({ error: 'room_invitation_not_found_or_expired' }, 404);
  return json({ ok: true });
}

async function friendCreate(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const body = await readJson(request);
  const username = normalizeUsername(String(body?.username ?? ''));
  if (!USERNAME_RE.test(username)) return json({ error: 'invalid_friend_username' }, 400);
  if (username === account.username) return json({ error: 'cannot_add_self' }, 400);
  const target = await env.DB.prepare('SELECT user_id FROM profiles WHERE username = ?').bind(username).first<{ user_id: string }>();
  if (!target) return json({ error: 'user_not_found' }, 404);
  const existing = await env.DB.prepare(`SELECT id, requester_id, addressee_id, status FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`)
    .bind(account.id, target.user_id, target.user_id, account.id).first<{ id: string; requester_id: string; addressee_id: string; status: string }>();
  const now = Date.now();
  if (existing?.status === 'accepted') return json({ error: 'already_friends' }, 409);
  if (existing) {
    await env.DB.prepare('UPDATE friendships SET requester_id = ?, addressee_id = ?, status = \'pending\', updated_at = ? WHERE id = ?')
      .bind(account.id, target.user_id, now, existing.id).run();
  } else {
    await env.DB.prepare('INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at) VALUES (?, ?, ?, \'pending\', ?, ?)')
      .bind(`fr_${randomToken(12)}`, account.id, target.user_id, now, now).run();
  }
  return json({ ok: true });
}

async function friendUpdate(request: Request, env: AccountEnv, account: AuthenticatedAccount, id: string): Promise<Response> {
  const body = await readJson(request);
  const action = String(body?.action ?? '');
  const row = await env.DB.prepare('SELECT * FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)')
    .bind(id, account.id, account.id).first<{ requester_id: string; addressee_id: string; status: string }>();
  if (!row) return json({ error: 'friendship_not_found' }, 404);
  const now = Date.now();
  if (action === 'accept' && row.addressee_id === account.id) {
    await env.DB.prepare('UPDATE friendships SET status = \'accepted\', updated_at = ? WHERE id = ?').bind(now, id).run();
  } else if (action === 'decline' && row.addressee_id === account.id) {
    await env.DB.prepare('UPDATE friendships SET status = \'declined\', updated_at = ? WHERE id = ?').bind(now, id).run();
  } else if (action === 'block') {
    await env.DB.prepare('UPDATE friendships SET status = \'blocked\', updated_at = ? WHERE id = ?').bind(now, id).run();
  } else if (action === 'remove') {
    await env.DB.prepare('DELETE FROM friendships WHERE id = ?').bind(id).run();
  } else {
    return json({ error: 'invalid_friend_action' }, 400);
  }
  return json({ ok: true });
}

async function publicProfile(request: Request, env: AccountEnv, username: string): Promise<Response> {
  const row = await env.DB.prepare(`${ACCOUNT_SELECT} WHERE p.username = ?`).bind(normalizeUsername(username)).first<UserRow>();
  if (!row) return json({ error: 'user_not_found' }, 404);
  const account = accountFromRow(row);
  const viewer = await authenticatedAccount(request, env);
  const isSelf = viewer?.id === account.id;
  if (!isSelf && account.visibility === 'private') return json({ error: 'profile_private' }, 403);
  if (!isSelf && account.visibility === 'friends') {
    if (!viewer) return json({ error: 'profile_private' }, 403);
    const friendship = await env.DB.prepare(`SELECT id FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      LIMIT 1`).bind(viewer.id, account.id, account.id, viewer.id).first<{ id: string }>();
    if (!friendship) return json({ error: 'profile_private' }, 403);
  }
  const [records, scorePosition, friendCountRow] = await Promise.all([
    loadRecordHighlights(env, account.id),
    getScoreLeaderboardPosition(env, account),
    env.DB.prepare(`SELECT COUNT(*) AS friend_count FROM friendships
      WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`).bind(account.id, account.id).first<{ friend_count: number }>(),
  ]);
  const visibleScorePosition = account.visibility === 'public'
    ? scorePosition
    : { ...scorePosition, position: null, points: 0, scored_competitions: 0, titles: 0 };
  return json({
    profile: publicAccount(account),
    records,
    scorePosition: visibleScorePosition,
    friendCount: Number(friendCountRow?.friend_count ?? 0),
  });
}

export async function handleAccountRequest(request: Request, env: AccountEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;
  if (url.pathname === '/api/auth/register' && request.method === 'POST') return registerLocalAccount(request, env);
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return loginLocalAccount(request, env);
  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const account = await authenticatedAccount(request, env);
    return json({ account: account ? publicAccount(account) : null });
  }
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) {
      const tokenHash = await sha256(token);
      const session = await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').bind(tokenHash).first<{ user_id: string }>();
      if (session) await env.DB.prepare('DELETE FROM account_presence WHERE user_id = ?').bind(session.user_id).run();
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    }
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, !isLocalRequest(request)) });
  }
  if (url.pathname === '/api/records' && request.method === 'GET') return publicRecords(env, url);
  if (url.pathname === '/api/leaderboards/score' && request.method === 'GET') return scoreLeaderboard(env);
  if (url.pathname.startsWith('/api/users/') && request.method === 'GET') return publicProfile(request, env, decodeURIComponent(url.pathname.slice('/api/users/'.length)));

  if (url.pathname.startsWith('/api/account')) {
    const account = await authenticatedAccount(request, env);
    if (!account) return json({ error: 'authentication_required' }, 401);
    if (url.pathname === '/api/account/profile' && request.method === 'GET') return json({ account: publicAccount(account) });
    if (url.pathname === '/api/account/profile' && request.method === 'PATCH') return profileUpdate(request, env, account);
    if (url.pathname === '/api/account/leaderboards/score-position' && request.method === 'GET') return scoreLeaderboardPosition(env, account);
    if (url.pathname === '/api/account/records' && request.method === 'GET') return accountRecordHighlights(env, account);
    if (url.pathname === '/api/account/history' && request.method === 'GET') {
      const requestedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      return historyList(env, account, Number.isFinite(requestedPage) ? requestedPage : 1);
    }
    if (url.pathname === '/api/account/history' && request.method === 'POST') return historyCreate(request, env, account);
    if (url.pathname === '/api/account/presence' && request.method === 'POST') return updatePresence(request, env, account);
    if (url.pathname === '/api/account/friends' && request.method === 'GET') return friendsList(env, account);
    if (url.pathname === '/api/account/friends' && request.method === 'POST') return friendCreate(request, env, account);
    if (url.pathname === '/api/account/room-invitations' && request.method === 'GET') return roomInvitationsList(env, account);
    const roomInvitationMatch = url.pathname.match(/^\/api\/account\/room-invitations\/([^/]+)$/);
    if (roomInvitationMatch && request.method === 'PATCH') {
      const body = await readJson(request);
      if (body?.action !== 'decline') return json({ error: 'invalid_room_invitation_action' }, 400);
      return roomInvitationDecline(env, account, roomInvitationMatch[1]);
    }
    const friendMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)$/);
    if (friendMatch && request.method === 'PATCH') return friendUpdate(request, env, account, friendMatch[1]);
    return json({ error: 'not_found' }, 404);
  }
  return null;
}
