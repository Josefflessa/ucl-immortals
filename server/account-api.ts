const SESSION_COOKIE = 'ucl_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_BIO_LENGTH = 240;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const PASSWORD_MIN_LENGTH = 8;
const PBKDF2_ITERATIONS = 120_000;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_FAILURES = 5;

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
  cover_key: string;
  favorite_crest_id: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  visibility: 'public' | 'friends' | 'private';
  created_at: number;
  competitions_completed?: number;
  titles?: number;
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

function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
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

function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
  return `UCL-${raw.slice(0, 6)}-${raw.slice(6)}`;
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
  SELECT u.id, u.email, p.username, p.display_name, p.bio, p.avatar_key,
         p.cover_key, p.favorite_crest_id, p.avatar_url, p.cover_url, p.visibility, p.created_at,
         COALESCE(s.competitions_completed, 0) AS competitions_completed,
         COALESCE(s.titles, 0) AS titles,
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
  if (now - Number(row.window_started_at) >= AUTH_WINDOW_MS) {
    await db.prepare('DELETE FROM auth_rate_limits WHERE key = ?').bind(key).run();
    return { blocked: false, retryAfter: 0 };
  }
  const retryAfter = Math.max(1, Math.ceil((Number(row.blocked_until) - now) / 1000));
  return { blocked: Number(row.blocked_until) > now, retryAfter };
}

async function registerAuthFailure(db: D1Database, key: string): Promise<void> {
  const now = Date.now();
  const existing = await db.prepare('SELECT failed_count, window_started_at FROM auth_rate_limits WHERE key = ?').bind(key).first<{ failed_count: number; window_started_at: number }>();
  if (!existing || now - Number(existing.window_started_at) >= AUTH_WINDOW_MS) {
    await db.prepare('INSERT OR REPLACE INTO auth_rate_limits (key, failed_count, window_started_at, blocked_until) VALUES (?, 1, ?, 0)')
      .bind(key, now).run();
    return;
  }
  const failedCount = Number(existing.failed_count) + 1;
  const blockedUntil = failedCount >= AUTH_MAX_FAILURES ? now + AUTH_WINDOW_MS : 0;
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
  const recoveryCode = createRecoveryCode();
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, recovery_code_hash, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(userId, `${userId}@local.ucl-immortals.invalid`, await hashSecret(password), await hashSecret(normalizeRecoveryCode(recoveryCode)), now, now, now),
      env.DB.prepare(`INSERT INTO profiles
        (user_id, username, display_name, bio, avatar_key, cover_key, avatar_url, cover_url, favorite_crest_id, visibility, created_at, updated_at)
        VALUES (?, ?, ?, '', 'default-01', 'cover-01', NULL, NULL, NULL, 'public', ?, ?)`)
        .bind(userId, username, displayName, now, now),
      env.DB.prepare('INSERT INTO profile_stats (user_id, updated_at) VALUES (?, ?)').bind(userId, now),
    ]);
  } catch {
    return json({ error: 'username_taken', message: 'Não foi possível criar essa conta. Tente outro nome de usuário.' }, 409);
  }
  return json({ recoveryCode, message: 'Conta criada. Guarde o código de recuperação em um local seguro.' }, 201);
}

async function loginLocalAccount(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  const username = normalizeUsername(String(body?.username ?? ''));
  const password = String(body?.password ?? '');
  const genericError = { error: 'invalid_credentials', message: 'Nome de usuário ou senha incorretos.' };
  if (!USERNAME_RE.test(username) || !password) return json(genericError, 401);
  const key = await authRateKey(request, username);
  const rate = await rateLimitStatus(env.DB, key);
  if (rate.blocked) return json({ error: 'too_many_attempts', message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, 429, { 'retry-after': String(rate.retryAfter) });
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
  return json({ account: await accountById(env.DB, row.id) }, 200, { 'set-cookie': sessionCookie(session) });
}

async function recoverLocalAccount(request: Request, env: AccountEnv): Promise<Response> {
  const body = await readJson(request);
  const username = normalizeUsername(String(body?.username ?? ''));
  const recoveryCode = normalizeRecoveryCode(String(body?.recoveryCode ?? ''));
  const newPassword = String(body?.newPassword ?? '');
  const genericError = { error: 'invalid_recovery', message: 'Usuário ou código de recuperação inválido.' };
  const passwordMessage = passwordError(newPassword);
  if (!USERNAME_RE.test(username) || !recoveryCode || passwordMessage) return json(passwordMessage ? { error: 'invalid_password', message: passwordMessage } : genericError, 400);
  const row = await env.DB.prepare(`SELECT u.id, u.recovery_code_hash
    FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.username = ?`).bind(username).first<{ id: string; recovery_code_hash: string | null }>();
  if (!row || !(await verifySecret(recoveryCode, row.recovery_code_hash))) return json(genericError, 401);
  const nextRecoveryCode = createRecoveryCode();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, recovery_code_hash = ?, updated_at = ?, last_seen_at = ? WHERE id = ?')
      .bind(await hashSecret(newPassword), await hashSecret(normalizeRecoveryCode(nextRecoveryCode)), now, now, row.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.id),
  ]);
  return json({ recoveryCode: nextRecoveryCode, message: 'Senha atualizada. Guarde o novo código de recuperação.' });
}

function publicAccount(account: AuthenticatedAccount): Record<string, unknown> {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    bio: account.bio,
    avatarKey: account.avatarKey,
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
  const username = body.username === undefined ? account.username : normalizeUsername(String(body.username));
  const displayName = body.displayName === undefined ? account.displayName : String(body.displayName).trim().slice(0, 40);
  const bio = body.bio === undefined ? account.bio : String(body.bio).trim().slice(0, MAX_BIO_LENGTH);
  const avatarKey = body.avatarKey === undefined ? account.avatarKey : String(body.avatarKey).trim();
  const coverKey = body.coverKey === undefined ? account.coverKey : String(body.coverKey).trim();
  const avatarUrl = body.avatarUrl === undefined
    ? (body.avatarKey !== undefined && avatarKey !== account.avatarKey ? null : account.avatarUrl)
    : (body.avatarUrl ? String(body.avatarUrl).slice(0, 500) : null);
  const coverUrl = body.coverUrl === undefined
    ? (body.coverKey !== undefined && coverKey !== account.coverKey ? null : account.coverUrl)
    : (body.coverUrl ? String(body.coverUrl).slice(0, 500) : null);
  const favoriteCrestId = body.favoriteCrestId === undefined ? account.favoriteCrestId : (body.favoriteCrestId ? String(body.favoriteCrestId).slice(0, 80) : null);
  if (!USERNAME_RE.test(username)) return json({ error: 'invalid_username', message: 'Use de 3 a 24 caracteres: letras, números, ponto, hífen ou sublinhado.' }, 400);
  if (!displayName) return json({ error: 'invalid_display_name' }, 400);
  if (!/^[a-z0-9-]{3,40}$/.test(avatarKey) || !/^[a-z0-9-]{3,40}$/.test(coverKey)) return json({ error: 'invalid_profile_asset' }, 400);
  const collision = await env.DB.prepare('SELECT user_id FROM profiles WHERE username = ? AND user_id <> ?').bind(username, account.id).first();
  if (collision) return json({ error: 'username_taken', message: 'Esse nome de usuário já está em uso.' }, 409);
  await env.DB.prepare(`UPDATE profiles SET username = ?, display_name = ?, bio = ?, avatar_key = ?, cover_key = ?, avatar_url = ?, cover_url = ?, favorite_crest_id = ?, updated_at = ? WHERE user_id = ?`)
    .bind(username, displayName, bio, avatarKey, coverKey, avatarUrl, coverUrl, favoriteCrestId, Date.now(), account.id).run();
  const updated = await accountById(env.DB, account.id);
  return updated ? json({ account: publicAccount(updated) }) : json({ error: 'account_not_found' }, 404);
}

async function historyList(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const rows = await env.DB.prepare(`SELECT id, mode, difficulty_id, format_id, team_name, crest_id, coach_id, champion, placement, report_json, completed_at
    FROM competition_history WHERE user_id = ? ORDER BY completed_at DESC LIMIT 50`).bind(account.id).all();
  return json({ history: rows.results.map(row => ({ ...row, report: JSON.parse(String((row as any).report_json ?? '{}')) })) });
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
  let reportJson: string;
  try {
    reportJson = JSON.stringify(report);
  } catch {
    return json({ error: 'invalid_history' }, 400);
  }
  if (reportJson.length > 180_000) return json({ error: 'history_too_large' }, 413);
  if (mode === 'online' && submittedRecords.length > 0) return json({ error: 'online_records_are_server_authoritative' }, 400);
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
    const maxValue = category === 'effective_overall' ? 150 : 200;
    if (value < 1 || value > maxValue) return json({ error: 'invalid_record_value' }, 400);
    recordCategories.add(category);
    safeRecords.push({ category, playerId, playerName, playerPhotoUrl, value });
  }
  const id = `cmp_${randomToken(12)}`;
  const now = Date.now();
  const champion = body.champion ? 1 : 0;
  const placement = body.placement == null ? null : Math.max(1, Math.min(999, Number(body.placement)) || 1);
  const crestId = body.crestId ? String(body.crestId).slice(0, 80) : null;
  const coachId = body.coachId ? String(body.coachId).slice(0, 80) : null;
  try {
    await env.DB.prepare(`INSERT INTO competition_history
      (id, user_id, mode, difficulty_id, format_id, team_name, crest_id, coach_id, champion, placement, report_json, source_key, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, account.id, mode, difficultyId, formatId, teamName, crestId, coachId, champion, placement, reportJson, sourceKey, now).run();
  } catch (error) {
    if (sourceKey) {
      const existing = await env.DB.prepare('SELECT id FROM competition_history WHERE user_id = ? AND source_key = ?')
        .bind(account.id, sourceKey).first<{ id: string }>();
      if (existing) return json({ id: existing.id, duplicate: true });
    }
    throw error;
  }
  for (const record of safeRecords) {
    await env.DB.prepare(`INSERT INTO competition_records
      (id, competition_id, user_id, category, difficulty_id, player_id, player_name, player_photo_url, value, username_snapshot, team_name_snapshot, crest_id_snapshot, verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(`rec_${randomToken(12)}`, id, account.id, record.category, difficultyId, record.playerId, record.playerName, record.playerPhotoUrl, record.value, account.username, teamName, crestId, now)
      .run();
  }
  const reportValues = report as Record<string, unknown>;
  const safeStat = (key: string, max: number) => {
    const value = Number(reportValues[key]);
    return Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
  };
  const effectiveRecord = safeRecords.find(record => record.category === 'effective_overall');
  await env.DB.prepare(`INSERT INTO profile_stats
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
    .bind(account.id, champion, safeStat('wins', 999), safeStat('draws', 999), safeStat('losses', 999), safeStat('goals', 9999), safeStat('assists', 9999), safeStat('saves', 9999), effectiveRecord?.value ?? 0, effectiveRecord ? difficultyId : null, now)
    .run();
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
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await env.DB.prepare(`SELECT r.id, r.category, r.difficulty_id, r.player_id, r.player_name, r.player_photo_url, r.value,
    r.username_snapshot, r.team_name_snapshot, r.crest_id_snapshot, r.created_at
    FROM competition_records r ${where ? `${where} AND r.verified = 1` : 'WHERE r.verified = 1'}
    ORDER BY r.difficulty_id, r.category, r.value DESC, r.created_at ASC LIMIT 500`).bind(...binds).all();
  const grouped = new Map<string, unknown[]>();
  for (const row of rows.results) {
    const key = `${(row as any).difficulty_id}:${(row as any).category}`;
    const bucket = grouped.get(key) ?? [];
    if (bucket.length < 10) bucket.push(row);
    grouped.set(key, bucket);
  }
  return json({ records: Array.from(grouped.values()).flat() });
}

async function friendsList(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const rows = await env.DB.prepare(`SELECT f.id, f.status, f.requester_id, f.addressee_id, f.created_at, f.updated_at,
    pr.username AS requester_username, pr.display_name AS requester_display_name, pr.avatar_key AS requester_avatar_key,
    pa.username AS addressee_username, pa.display_name AS addressee_display_name, pa.avatar_key AS addressee_avatar_key
    FROM friendships f
    JOIN profiles pr ON pr.user_id = f.requester_id
    JOIN profiles pa ON pa.user_id = f.addressee_id
    WHERE f.requester_id = ? OR f.addressee_id = ? ORDER BY f.updated_at DESC`).bind(account.id, account.id).all();
  return json({ friends: rows.results });
}

async function friendCreate(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const body = await readJson(request);
  const username = normalizeUsername(String(body?.username ?? ''));
  if (!USERNAME_RE.test(username) || username === account.username) return json({ error: 'invalid_friend' }, 400);
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

async function publicProfile(env: AccountEnv, username: string): Promise<Response> {
  const row = await env.DB.prepare(`${ACCOUNT_SELECT} WHERE p.username = ?`).bind(normalizeUsername(username)).first<UserRow>();
  if (!row) return json({ error: 'user_not_found' }, 404);
  const account = accountFromRow(row);
  if (account.visibility === 'private') return json({ error: 'profile_private' }, 403);
  const records = await env.DB.prepare(`SELECT category, difficulty_id, player_id, player_name, player_photo_url, value, team_name_snapshot, crest_id_snapshot, created_at
    FROM competition_records WHERE user_id = ? AND verified = 1 ORDER BY value DESC, created_at ASC LIMIT 20`).bind(account.id).all();
  return json({ profile: publicAccount(account), records: records.results });
}

export async function handleAccountRequest(request: Request, env: AccountEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;
  if (url.pathname === '/api/auth/register' && request.method === 'POST') return registerLocalAccount(request, env);
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return loginLocalAccount(request, env);
  if (url.pathname === '/api/auth/recover' && request.method === 'POST') return recoverLocalAccount(request, env);
  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const account = await authenticatedAccount(request, env);
    return json({ account: account ? publicAccount(account) : null });
  }
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }
  if (url.pathname === '/api/records' && request.method === 'GET') return publicRecords(env, url);
  if (url.pathname.startsWith('/api/users/') && request.method === 'GET') return publicProfile(env, decodeURIComponent(url.pathname.slice('/api/users/'.length)));

  if (url.pathname.startsWith('/api/account')) {
    const account = await authenticatedAccount(request, env);
    if (!account) return json({ error: 'authentication_required' }, 401);
    if (url.pathname === '/api/account/profile' && request.method === 'GET') return json({ account: publicAccount(account) });
    if (url.pathname === '/api/account/profile' && request.method === 'PATCH') return profileUpdate(request, env, account);
    if (url.pathname === '/api/account/history' && request.method === 'GET') return historyList(env, account);
    if (url.pathname === '/api/account/history' && request.method === 'POST') return historyCreate(request, env, account);
    if (url.pathname === '/api/account/friends' && request.method === 'GET') return friendsList(env, account);
    if (url.pathname === '/api/account/friends' && request.method === 'POST') return friendCreate(request, env, account);
    const friendMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)$/);
    if (friendMatch && request.method === 'PATCH') return friendUpdate(request, env, account, friendMatch[1]);
    return json({ error: 'not_found' }, 404);
  }
  return null;
}
