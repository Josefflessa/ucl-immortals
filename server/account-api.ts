import { DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY, isProfileAvatarBackgroundKey } from '../shared/profileAppearance';
import { PROFILE_COVER_BY_KEY } from '../shared/profileCovers.js';
import { getTeamEffectiveStats, type Team } from '../shared/game/gameEngine.js';
import { retainRecentCompetitionSnapshots } from './competition-history-retention.js';
import {
  achievementRarity,
  automaticShowcase,
  ensureAchievementsCurrent,
  loadAchievements,
  loadShowcase,
  saveShowcase,
  syncAchievements,
} from './achievements.js';
import { chooseEventOption, loadOwnedEventCards, loadOwnedFrames, loadOwnedNameStyles, syncEventRewards } from './events.js';
import { isNameStyleKey } from '../shared/game/nameStyles.js';
import { isAvatarFrameKey } from '../shared/game/events.js';
import { isClubRewardKey } from '../shared/game/clubRewards.js';
import { albumSummary, applyCopy, buyAvatarFrame, buyDailyBannerCard, buyNameStyle, buyPack, buyProfileCover, buyWeeklyBannerCard, dailyBannerRotations, ensureAlbum, loadOwnedCovers, openItem, sellCopies, syncAlbum, syncAlbumPagesForCards, syncCampaignGrants, weeklyBannerRotations, type ItemGrant } from './album.js';
import { albumCatalog } from '../shared/game/album.js';
import { WEEKLY_PACK_REWARDS } from '../shared/game/dailyRewards.js';
import { isPushConfigured, isValidPushEndpoint, sendPushToUser, type PushEnvironment, type PushNotice } from './push.js';
import {
  competitionStagePoints,
  finishStageFromLegacyPoints,
  isCompetitionFinishStage,
  isRankedDifficulty,
  RANKED_DIFFICULTY_IDS,
  type CompetitionFinishStage,
  type RankedDifficultyId,
} from '../shared/game/competitionRanking.js';

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
export const ROOM_INVITATION_TTL_MS = 5 * 60_000;

type AccountEnv = PushEnvironment;

type PushExecutionContext = Pick<ExecutionContext, 'waitUntil'>;

function schedulePush(
  env: AccountEnv,
  context: PushExecutionContext | undefined,
  userId: string,
  notice: PushNotice,
  ttlSeconds?: number,
): void {
  if (!context || !isPushConfigured(env)) return;
  context.waitUntil(sendPushToUser(env, userId, notice, ttlSeconds));
}

interface AuthenticatedAccount {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarKey: string;
  avatarBackgroundKey: string;
  /** Event frame drawn around the avatar (null = none). */
  avatarFrameKey: string | null;
  /** Font + effect the display name is shown with (null = default). */
  nameStyleKey: string | null;
  coverKey: string;
  favoriteCrestId: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  visibility: 'public' | 'friends' | 'private';
  createdAt: number;
  /** Likes other players gave this profile. */
  likeCount: number;
  stats: AccountStats;
}

interface FinishCounts {
  leaguePhase: number;
  playoff: number;
  roundOf16: number;
  quarterfinal: number;
  semifinal: number;
  runnerUp: number;
  champion: number;
}

interface AccountStats {
  competitionsCompleted: number;
  titles: number;
  finishCounts: FinishCounts;
  /** Same counts split by difficulty (only difficulties with campaigns). */
  finishCountsByDifficulty: Partial<Record<RankedDifficultyId, FinishCounts>>;
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
  avatar_frame_key: string | null;
  name_style_key: string | null;
  cover_key: string;
  favorite_crest_id: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  visibility: 'public' | 'friends' | 'private';
  created_at: number;
  like_count?: number;
  competitions_completed?: number;
  titles?: number;
  finish_breakdown?: string | null;
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

const FINISH_COUNT_KEY: Record<CompetitionFinishStage, keyof FinishCounts> = {
  champion: 'champion',
  runnerUp: 'runnerUp',
  semifinalist: 'semifinal',
  quarterfinalist: 'quarterfinal',
  roundOf16: 'roundOf16',
  playoff: 'playoff',
  leaguePhase: 'leaguePhase',
};

function emptyFinishCounts(): FinishCounts {
  return { leaguePhase: 0, playoff: 0, roundOf16: 0, quarterfinal: 0, semifinal: 0, runnerUp: 0, champion: 0 };
}

/** Parses the [difficulty, stage, count] triples aggregated by ACCOUNT_SELECT. */
function finishCountsFromBreakdown(raw: string | null | undefined): Pick<AccountStats, 'finishCounts' | 'finishCountsByDifficulty'> {
  const finishCounts = emptyFinishCounts();
  const finishCountsByDifficulty: AccountStats['finishCountsByDifficulty'] = {};
  let entries: unknown = [];
  try {
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    entries = [];
  }
  if (!Array.isArray(entries)) return { finishCounts, finishCountsByDifficulty };
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const [difficultyId, stage, rawCount] = entry;
    const count = Number(rawCount);
    if (!isCompetitionFinishStage(stage) || !Number.isSafeInteger(count) || count <= 0) continue;
    const key = FINISH_COUNT_KEY[stage];
    finishCounts[key] += count;
    if (isRankedDifficulty(difficultyId)) {
      const perDifficulty = finishCountsByDifficulty[difficultyId] ?? emptyFinishCounts();
      perDifficulty[key] += count;
      finishCountsByDifficulty[difficultyId] = perDifficulty;
    }
  }
  return { finishCounts, finishCountsByDifficulty };
}

function statsFromRow(row: UserRow): AccountStats {
  return {
    competitionsCompleted: Number(row.competitions_completed ?? 0),
    titles: Number(row.titles ?? 0),
    ...finishCountsFromBreakdown(row.finish_breakdown),
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
    avatarFrameKey: isAvatarFrameKey(row.avatar_frame_key) ? row.avatar_frame_key : null,
    nameStyleKey: isNameStyleKey(row.name_style_key) ? row.name_style_key : null,
    coverKey: row.cover_key,
    favoriteCrestId: row.favorite_crest_id,
    avatarUrl: row.avatar_url ?? null,
    coverUrl: row.cover_url ?? null,
    visibility: row.visibility,
    createdAt: Number(row.created_at),
    likeCount: Number(row.like_count ?? 0),
    stats: statsFromRow(row),
  };
}

const RANKED_DIFFICULTY_SQL = RANKED_DIFFICULTY_IDS.map(id => `'${id}'`).join(', ');

const ACCOUNT_SELECT = `
  WITH finish_rows AS (
    SELECT user_id, difficulty_id, finish_stage, COUNT(*) AS finishes
    FROM competition_history
    WHERE finish_stage IS NOT NULL
    GROUP BY user_id, difficulty_id, finish_stage
  ), competition_finishes AS (
    SELECT user_id, json_group_array(json_array(difficulty_id, finish_stage, finishes)) AS finish_breakdown
    FROM finish_rows
    GROUP BY user_id
  )
  SELECT u.id, u.email, p.username, p.display_name, p.bio, p.avatar_key, p.avatar_background_key, p.avatar_frame_key, p.name_style_key,
         p.cover_key, p.favorite_crest_id, p.avatar_url, p.cover_url, p.visibility, p.created_at,
         (SELECT COUNT(*) FROM profile_likes pl WHERE pl.user_id = u.id) AS like_count,
         COALESCE(s.competitions_completed, 0) AS competitions_completed,
         COALESCE(s.titles, 0) AS titles,
         cf.finish_breakdown,
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

const SOLO_CAMPAIGN_VERSION = 1;
const MAX_SOLO_CAMPAIGN_JSON_BYTES = 32 * 1024 * 1024;
const MAX_SOLO_CAMPAIGN_COMPRESSED_BYTES = 16 * 1024 * 1024;
const SOLO_CAMPAIGN_CHUNK_BYTES = 900_000;
const SOLO_CAMPAIGN_PHASES = new Set([
  'crest', 'coach', 'formation', 'draft', 'squad_review', 'league', 'knockout', 'match_sim', 'report',
]);

async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new RangeError('request_too_large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new RangeError('request_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const compressed = new Blob([exactArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const expanded = new Blob([exactArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(expanded).arrayBuffer());
}

function splitBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }
  return chunks;
}

function blobBytes(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

async function accountSoloCampaign(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const row = await env.DB.prepare(`SELECT version, saved_at, chunk_count
    FROM solo_campaign_saves WHERE user_id = ?`).bind(account.id)
    .first<{ version: number; saved_at: number; chunk_count: number }>();
  if (!row) return json({ campaign: null });
  try {
    const chunkCount = Number(row.chunk_count);
    if (!Number.isSafeInteger(chunkCount) || chunkCount < 1 || chunkCount > 32) {
      return json({ error: 'solo_campaign_unavailable' }, 500);
    }
    const chunkRows = await env.DB.prepare(`SELECT chunk_index, chunk_data
      FROM solo_campaign_save_chunks WHERE user_id = ? AND saved_at = ? ORDER BY chunk_index`)
      .bind(account.id, Number(row.saved_at)).all<{ chunk_index: number; chunk_data: unknown }>();
    if (chunkRows.results.length !== chunkCount) return json({ error: 'solo_campaign_unavailable' }, 500);
    const chunks = chunkRows.results.map((chunk, index) => {
      if (Number(chunk.chunk_index) !== index) throw new Error('missing campaign chunk');
      const bytes = blobBytes(chunk.chunk_data);
      if (!bytes || bytes.byteLength > SOLO_CAMPAIGN_CHUNK_BYTES) throw new Error('invalid campaign chunk');
      return bytes;
    });
    const compressedLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    if (compressedLength > MAX_SOLO_CAMPAIGN_COMPRESSED_BYTES) throw new Error('campaign exceeds compressed limit');
    const compressed = new Uint8Array(compressedLength);
    let compressedOffset = 0;
    for (const chunk of chunks) {
      compressed.set(chunk, compressedOffset);
      compressedOffset += chunk.byteLength;
    }
    const stateBytes = await gunzipBytes(compressed);
    if (stateBytes.byteLength > MAX_SOLO_CAMPAIGN_JSON_BYTES) return json({ error: 'solo_campaign_unavailable' }, 500);
    const state = JSON.parse(new TextDecoder().decode(stateBytes)) as Record<string, unknown>;
    return json({ campaign: { accountId: account.id, version: Number(row.version), savedAt: Number(row.saved_at), state } });
  } catch (error) {
    console.error('[solo-campaign] failed to read saved campaign:', error);
    return json({ error: 'solo_campaign_unavailable' }, 500);
  }
}

async function accountSoloCampaignSave(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  let body: Record<string, unknown> | null;
  try {
    const text = await readBoundedText(request, MAX_SOLO_CAMPAIGN_JSON_BYTES);
    const parsed = JSON.parse(text);
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch (error) {
    if (error instanceof RangeError) return json({ error: 'solo_campaign_too_large', message: 'A campanha salva excede o limite.' }, 413);
    return json({ error: 'invalid_json' }, 400);
  }
  const state = body?.state;
  if (!body || body.accountId !== account.id || body.version !== SOLO_CAMPAIGN_VERSION
    || !state || typeof state !== 'object' || Array.isArray(state)) {
    return json({ error: 'invalid_solo_campaign' }, 400);
  }
  const gameState = state as Record<string, unknown>;
  if (gameState.mode !== 'solo' || typeof gameState.phase !== 'string' || !SOLO_CAMPAIGN_PHASES.has(gameState.phase)) {
    return json({ error: 'invalid_solo_campaign' }, 400);
  }
  let stateBytes: Uint8Array;
  try {
    stateBytes = new TextEncoder().encode(JSON.stringify(gameState));
  } catch {
    return json({ error: 'invalid_solo_campaign' }, 400);
  }
  const compressed = await gzipBytes(stateBytes);
  if (compressed.byteLength > MAX_SOLO_CAMPAIGN_COMPRESSED_BYTES) {
    return json({ error: 'solo_campaign_too_large', message: 'A campanha salva excede o limite da conta.' }, 413);
  }
  const chunks = splitBytes(compressed, SOLO_CAMPAIGN_CHUNK_BYTES);
  const now = Date.now();
  const requestedSavedAt = Number(body.savedAt);
  const savedAt = Number.isSafeInteger(requestedSavedAt) && requestedSavedAt > 0
    ? Math.min(requestedSavedAt, now + 5 * 60_000)
    : now;
  const statements = chunks.map((chunk, chunkIndex) => env.DB.prepare(`INSERT INTO solo_campaign_save_chunks
    (user_id, saved_at, chunk_index, chunk_data) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, saved_at, chunk_index) DO UPDATE SET chunk_data = excluded.chunk_data`)
    .bind(account.id, savedAt, chunkIndex, exactArrayBuffer(chunk)));
  statements.push(env.DB.prepare(`INSERT INTO solo_campaign_saves (user_id, version, saved_at, updated_at, chunk_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      version = excluded.version,
      saved_at = excluded.saved_at,
      updated_at = excluded.updated_at,
      chunk_count = excluded.chunk_count
    WHERE excluded.saved_at >= solo_campaign_saves.saved_at`)
    .bind(account.id, SOLO_CAMPAIGN_VERSION, savedAt, now, chunks.length));
  statements.push(env.DB.prepare(`DELETE FROM solo_campaign_save_chunks
    WHERE user_id = ? AND saved_at <> (SELECT saved_at FROM solo_campaign_saves WHERE user_id = ?)`)
    .bind(account.id, account.id));
  await env.DB.batch(statements);
  const latest = await env.DB.prepare('SELECT saved_at FROM solo_campaign_saves WHERE user_id = ?')
    .bind(account.id).first<{ saved_at: number }>();
  if (latest && Number(latest.saved_at) > savedAt) {
    return json({ error: 'solo_campaign_conflict', message: 'Outra sessão salvou uma campanha mais recente.' }, 409);
  }
  return json({ campaign: { accountId: account.id, version: SOLO_CAMPAIGN_VERSION, savedAt, state: gameState } });
}

async function accountSoloCampaignDelete(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM solo_campaign_save_chunks WHERE user_id = ?').bind(account.id),
    env.DB.prepare('DELETE FROM solo_campaign_saves WHERE user_id = ?').bind(account.id),
  ]);
  return json({ ok: true });
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
    avatarFrameKey: account.avatarFrameKey,
    nameStyleKey: account.nameStyleKey,
    coverKey: account.coverKey,
    avatarUrl: account.avatarUrl,
    coverUrl: account.coverUrl,
    favoriteCrestId: account.favoriteCrestId,
    createdAt: account.createdAt,
    likeCount: account.likeCount,
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
  let avatarFrameKey = account.avatarFrameKey;
  if (body.avatarFrameKey !== undefined) {
    avatarFrameKey = body.avatarFrameKey ? String(body.avatarFrameKey) : null;
    if (avatarFrameKey && !(await loadOwnedFrames(env.DB, account.id)).includes(avatarFrameKey)) return json({ error: 'frame_not_owned' }, 403);
  }
  let nameStyleKey = account.nameStyleKey;
  if (body.nameStyleKey !== undefined) {
    nameStyleKey = body.nameStyleKey ? String(body.nameStyleKey) : null;
    if (nameStyleKey && !(await loadOwnedNameStyles(env.DB, account.id)).includes(nameStyleKey)) return json({ error: 'name_style_not_owned' }, 403);
  }
  if (!/^[a-z0-9-]{3,40}$/.test(avatarKey) || !/^[a-z0-9-]{3,40}$/.test(coverKey) || !isProfileAvatarBackgroundKey(avatarBackgroundKey)) return json({ error: 'invalid_profile_asset' }, 400);
  // A club's cover is earned in the album: only an account that completed the club may use it.
  if (coverKey !== account.coverKey && isClubRewardKey(coverKey) && !(await loadOwnedCovers(env.DB, account.id)).includes(coverKey)) return json({ error: 'cover_not_owned' }, 403);
  if (PROFILE_COVER_BY_KEY.get(coverKey)?.shopPrice !== undefined && !(await loadOwnedCovers(env.DB, account.id)).includes(coverKey)) return json({ error: 'cover_not_owned' }, 403);
  await env.DB.prepare(`UPDATE profiles SET display_name = ?, bio = ?, avatar_key = ?, avatar_background_key = ?, avatar_frame_key = ?, name_style_key = ?, cover_key = ?, avatar_url = ?, cover_url = ?, favorite_crest_id = ?, updated_at = ? WHERE user_id = ?`)
    .bind(displayName, bio, avatarKey, avatarBackgroundKey, avatarFrameKey, nameStyleKey, coverKey, avatarUrl, coverUrl, favoriteCrestId, Date.now(), account.id).run();
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
      champion, placement, competition_points, finish_stage, report_json, completed_at
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
  if (difficultyId && !isRankedDifficulty(difficultyId)) {
    return json({ error: 'invalid_difficulty', message: 'Dificuldade desconhecida.' }, 400);
  }
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
  // The client only states how far the campaign went; the points are always
  // derived here from that stage and the difficulty. Older clients send the
  // full-table points instead, which still identify the stage.
  const finishStage: CompetitionFinishStage | null = champion
    ? 'champion'
    : isCompetitionFinishStage(body.finishStage) && body.finishStage !== 'champion'
      ? body.finishStage
      : finishStageFromLegacyPoints(body.competitionPoints);
  const competitionPoints = finishStage && isRankedDifficulty(difficultyId)
    ? competitionStagePoints(finishStage, difficultyId)
    : 0;
  let reportJson: string;
  try {
    reportJson = JSON.stringify({ ...(report as Record<string, unknown>), competitionPoints, finishStage });
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
  // Ensure campaign rewards are active before saving this result. This must not depend on a
  // visit to the album screen; the saved result uses the same timestamp and is immediately eligible.
  await ensureAlbum(env.DB, account.id, now);
  const placement = body.placement == null ? null : Math.max(1, Math.min(999, Number(body.placement)) || 1);
  const crestId = body.crestId ? String(body.crestId).slice(0, 80) : null;
  const coachId = body.coachId ? String(body.coachId).slice(0, 80) : null;
  await ensureAchievementsCurrent(env.DB, account.id);
  const statements = [env.DB.prepare(`INSERT INTO competition_history
      (id, user_id, mode, difficulty_id, format_id, team_name, crest_id, coach_id, champion, placement, competition_points, finish_stage, report_json, source_key, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, account.id, mode, difficultyId, formatId, teamName, crestId, coachId, champion, placement, competitionPoints, finishStage, reportJson, sourceKey, now)];
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
        return json({ id: existing.id, duplicate: true, achievementsUnlocked: [] });
      }
    }
    throw error;
  }
  await retainRecentCompetitionSnapshots(env.DB, account.id);
  // The campaign is stored; a failed evaluation is retried on the next profile
  // access, so it must never turn a saved campaign into an error.
  const achievementsUnlocked = await syncAchievements(env.DB, account.id).catch(error => {
    console.error('[achievements] evaluation after solo save failed:', error);
    return [];
  });
  const eventRewards = await syncEventRewards(env.DB, account.id).catch(error => {
    console.error('[events] evaluation after solo save failed:', error);
    return { unlocked: [], cardsUnlocked: [] };
  });
  // Album packs for campaigns saved since this account's album rewards were initialized.
  const albumGrants = await grantCampaignRewards(env, account.id);
  return json({ id, duplicate: false, achievementsUnlocked, framesUnlocked: eventRewards.unlocked, eventCardsUnlocked: eventRewards.cardsUnlocked, albumGrants }, 201);
}

async function publicRecords(env: AccountEnv, url: URL): Promise<Response> {
  const category = url.searchParams.get('category');
  const difficulty = url.searchParams.get('difficulty');
  const allowed = new Set(['goals', 'assists', 'saves', 'effective_overall']);
  if (category && !allowed.has(category)) return json({ error: 'invalid_category' }, 400);
  if (difficulty && !isRankedDifficulty(difficulty)) return json({ error: 'invalid_difficulty' }, 400);
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
      CASE WHEN p.visibility = 'public' THEN p.avatar_frame_key ELSE NULL END AS profile_avatar_frame_key,
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
               PARTITION BY r.difficulty_id, r.category
               ORDER BY r.value DESC, r.created_at ASC, r.id ASC
             ) AS ranking_position,
             ROW_NUMBER() OVER (
               PARTITION BY r.difficulty_id, r.category, r.user_id
               ORDER BY r.value DESC, r.created_at ASC, r.id ASC
             ) AS user_record_rank
        FROM competition_records r
       WHERE r.verified = 1
         AND r.difficulty_id IN (${RANKED_DIFFICULTY_SQL})
         AND r.category IN ('goals', 'assists', 'saves', 'effective_overall')
    )
    SELECT r.category, r.difficulty_id, r.player_id, r.player_name, r.player_photo_url, r.value,
           r.team_name_snapshot, r.crest_id_snapshot,
           p.display_name AS profile_display_name, p.avatar_key AS profile_avatar_key,
           p.avatar_background_key AS profile_avatar_background_key, p.avatar_url AS profile_avatar_url,
           p.avatar_frame_key AS profile_avatar_frame_key,
           r.mode, r.format_id, r.completed_at,
           r.player_card_json, r.effective_overall_snapshot,
           ${RECORD_CARD_CONTEXT_SQL} AS player_card_context, r.ranking_position AS rank_position
      FROM ranked_records r
      LEFT JOIN profiles p ON p.user_id = r.user_id
     WHERE r.user_id = ? AND r.user_record_rank = 1
     ORDER BY r.difficulty_id, CASE r.category WHEN 'goals' THEN 1 WHEN 'assists' THEN 2 WHEN 'saves' THEN 3 ELSE 4 END`)
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

async function achievementsPayload(env: AccountEnv, userId: string, records?: Array<Record<string, unknown>>) {
  await ensureAchievementsCurrent(env.DB, userId);
  const [achievements, rarity, chosen, recordRows] = await Promise.all([
    loadAchievements(env.DB, userId),
    achievementRarity(env.DB),
    loadShowcase(env.DB, userId),
    records
      ? Promise.resolve(records)
      : env.DB.prepare(`SELECT DISTINCT difficulty_id, category FROM competition_records WHERE user_id = ? AND verified = 1`)
        .bind(userId).all<Record<string, unknown>>().then(result => result.results),
  ]);
  const recordKeys = recordRows.map(row => ({ difficultyId: String(row.difficulty_id), category: String(row.category) }));
  // A pinned achievement stays on the mural only while it is unlocked (a rule change can lock it again).
  const levels = new Map(achievements.map(state => [state.id, state.level]));
  const pinned = chosen.filter(item => item.type !== 'achievement' || (levels.get(item.id) ?? 0) > 0);
  const automatic = pinned.length === 0;
  return {
    achievements,
    rarity,
    showcase: { items: automatic ? automaticShowcase(achievements, rarity, recordKeys) : pinned, automatic },
  };
}

async function accountAchievements(env: AccountEnv, account: AuthenticatedAccount, url: URL): Promise<Response> {
  const payload = await achievementsPayload(env, account.id);
  // Levels reached at or after "since" (e.g. while an online report was open).
  const since = Number(url.searchParams.get('since'));
  const recentlyUnlocked = Number.isFinite(since) && since > 0
    ? payload.achievements.filter(state => state.level > 0 && (state.unlockedAt ?? 0) >= since).map(state => ({ id: state.id, level: state.level }))
    : [];
  return json({ ...payload, recentlyUnlocked });
}

async function updateShowcase(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ error: 'invalid_json' }, 400);
  await ensureAchievementsCurrent(env.DB, account.id);
  const result = await saveShowcase(env.DB, account.id, body.items);
  if ('error' in result) {
    const message = result.error === 'showcase_item_not_owned'
      ? 'Só é possível fixar conquistas desbloqueadas e recordes que você tem.'
      : 'Mural inválido.';
    return json({ error: result.error, message }, 400);
  }
  return json({ showcase: { items: result.items, automatic: result.items.length === 0 } });
}

async function accountRecordHighlights(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const records = await loadRecordHighlights(env, account.id);
  return json({ records });
}

/** Optional difficulty filter of the score ranking: null = overall. */
function scoreDifficultyFilter(url: URL): { difficulty: RankedDifficultyId | null; error?: Response } {
  const raw = url.searchParams.get('difficulty');
  if (!raw || raw === 'all') return { difficulty: null };
  if (!isRankedDifficulty(raw)) return { difficulty: null, error: json({ error: 'invalid_difficulty' }, 400) };
  return { difficulty: raw };
}

function scoreTotalsSql(difficulty: RankedDifficultyId | null): string {
  return `SELECT user_id,
        SUM(competition_points) AS points,
        SUM(CASE WHEN competition_points > 0 THEN 1 ELSE 0 END) AS scored_competitions,
        SUM(champion) AS titles
      FROM competition_history
      ${difficulty ? 'WHERE difficulty_id = ?' : ''}
      GROUP BY user_id`;
}

async function scoreLeaderboard(env: AccountEnv, url: URL): Promise<Response> {
  const { difficulty, error } = scoreDifficultyFilter(url);
  if (error) return error;
  const rows = await env.DB.prepare(`WITH totals AS (
      ${scoreTotalsSql(difficulty)}
    )
    SELECT p.username, p.display_name, p.avatar_key, p.avatar_background_key, p.avatar_url, p.avatar_frame_key, p.name_style_key,
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
    LIMIT 10`).bind(...(difficulty ? [difficulty] : [])).all();
  const ranking = rows.results.map((row: any) => ({
    ...row,
    points: Number(row.points ?? 0),
    scored_competitions: Number(row.scored_competitions ?? 0),
    titles: Number(row.titles ?? 0),
  }));
  return json({ ranking, difficulty });
}

async function getScoreLeaderboardPosition(env: AccountEnv, account: AuthenticatedAccount, difficulty: RankedDifficultyId | null = null) {
  const row = await env.DB.prepare(`WITH totals AS (
      ${scoreTotalsSql(difficulty)}
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
    LEFT JOIN ranked ON ranked.user_id = viewer.user_id`).bind(...(difficulty ? [difficulty] : []), account.id).first<{
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

async function scoreLeaderboardPosition(env: AccountEnv, account: AuthenticatedAccount, url: URL): Promise<Response> {
  const { difficulty, error } = scoreDifficultyFilter(url);
  if (error) return error;
  return json({ ...(await getScoreLeaderboardPosition(env, account, difficulty)), difficulty });
}

async function friendsList(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const now = Date.now();
  const rows = await env.DB.prepare(`WITH presence_summary AS (
      SELECT user_id,
        MAX(CASE WHEN status IN ('available', 'busy') THEN 1 ELSE 0 END) AS is_online,
        MAX(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS has_available_session,
        MAX(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) AS has_busy_session
      FROM account_presence WHERE updated_at > ? GROUP BY user_id
    ), unread_messages AS (
      SELECT friendship_id, COUNT(*) AS unread_message_count
      FROM friend_messages
      WHERE sender_id <> ? AND read_at IS NULL AND expires_at > ?
      GROUP BY friendship_id
    ), friendship_rows AS (
      SELECT f.id, f.status, f.requester_id, f.addressee_id, f.created_at, f.updated_at,
        CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS friend_id
      FROM friendships f
      WHERE f.requester_id = ? OR f.addressee_id = ?
    )
    SELECT f.id, f.status, f.requester_id, f.addressee_id, f.created_at, f.updated_at,
    pr.username AS requester_username, pr.display_name AS requester_display_name, pr.avatar_key AS requester_avatar_key, pr.avatar_background_key AS requester_avatar_background_key, pr.avatar_url AS requester_avatar_url, pr.avatar_frame_key AS requester_avatar_frame_key, pr.name_style_key AS requester_name_style_key,
    pa.username AS addressee_username, pa.display_name AS addressee_display_name, pa.avatar_key AS addressee_avatar_key, pa.avatar_background_key AS addressee_avatar_background_key, pa.avatar_url AS addressee_avatar_url, pa.avatar_frame_key AS addressee_avatar_frame_key, pa.name_style_key AS addressee_name_style_key,
    COALESCE(ps.is_online, 0) AS is_online,
    CASE WHEN COALESCE(ps.has_available_session, 0) = 1 AND COALESCE(ps.has_busy_session, 0) = 0 THEN 1 ELSE 0 END AS is_available,
    COALESCE(ps.has_busy_session, 0) AS is_busy,
    CASE WHEN f.status = 'accepted' THEN COALESCE(um.unread_message_count, 0) ELSE 0 END AS unread_message_count
    FROM friendship_rows f
    JOIN profiles pr ON pr.user_id = f.requester_id
    JOIN profiles pa ON pa.user_id = f.addressee_id
    LEFT JOIN presence_summary ps ON ps.user_id = f.friend_id
    LEFT JOIN unread_messages um ON um.friendship_id = f.id
    ORDER BY f.updated_at DESC`).bind(now - ACCOUNT_PRESENCE_TTL_MS, account.id, now, account.id, account.id, account.id).all();
  const friends = rows.results.map((row: any) => ({
    ...row,
    is_online: Boolean(row.is_online),
    is_available: Boolean(row.is_available),
    is_busy: Boolean(row.is_busy),
    unread_message_count: Number(row.unread_message_count ?? 0),
  }));
  return json({ friends });
}

async function updatePresence(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const body = await readJson(request);
  const presenceId = typeof body?.presenceId === 'string' ? body.presenceId : '';
  const status = body?.status;
  const revision = Number(body?.revision);
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
  if (body?.statusChanged === true && status === 'busy' && updated.meta.changes) {
    await env.DB.prepare(`UPDATE room_invitations SET status = 'expired', updated_at = ?
      WHERE invitee_user_id = ? AND status = 'pending'`)
      .bind(now, account.id).run();
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

async function pushSubscription(request: Request, env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  if (request.method === 'GET') {
    const enabled = isPushConfigured(env);
    return json({ enabled, publicKey: enabled ? env.VAPID_PUBLIC_KEY ?? null : null });
  }

  const body = await readJson(request);
  if (request.method === 'DELETE') {
    if (!isValidPushEndpoint(body?.endpoint)) return json({ error: 'invalid_push_endpoint' }, 400);
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .bind(account.id, body.endpoint).run();
    return json({ ok: true });
  }

  if (request.method !== 'PUT') return json({ error: 'method_not_allowed' }, 405);
  if (!isPushConfigured(env)) return json({ error: 'push_not_configured' }, 503);

  const endpoint = body?.endpoint;
  const rawKeys = body?.keys;
  const keys = rawKeys && typeof rawKeys === 'object' && !Array.isArray(rawKeys)
    ? rawKeys as Record<string, unknown>
    : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';
  const base64UrlKey = /^[A-Za-z0-9_-]+$/;
  if (!isValidPushEndpoint(endpoint)
    || p256dh.length < 40 || p256dh.length > 200 || !base64UrlKey.test(p256dh)
    || auth.length < 16 || auth.length > 100 || !base64UrlKey.test(auth)) {
    return json({ error: 'invalid_push_subscription' }, 400);
  }

  const now = Date.now();
  await env.DB.prepare(`INSERT INTO push_subscriptions
      (endpoint, user_id, p256dh, auth, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = excluded.updated_at`)
    .bind(endpoint, account.id, p256dh, auth, now, now).run();
  await env.DB.prepare(`DELETE FROM push_subscriptions
    WHERE user_id = ? AND endpoint NOT IN (
      SELECT endpoint FROM push_subscriptions WHERE user_id = ?
      ORDER BY updated_at DESC LIMIT 8
    )`).bind(account.id, account.id).run();
  return json({ ok: true });
}

async function friendCreate(
  request: Request,
  env: AccountEnv,
  account: AuthenticatedAccount,
  context?: PushExecutionContext,
): Promise<Response> {
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
  const shouldNotify = !existing
    || existing.status !== 'pending'
    || existing.requester_id !== account.id
    || existing.addressee_id !== target.user_id;
  let friendshipId: string;
  if (existing) {
    friendshipId = existing.id;
    await env.DB.prepare('UPDATE friendships SET requester_id = ?, addressee_id = ?, status = \'pending\', updated_at = ? WHERE id = ?')
      .bind(account.id, target.user_id, now, existing.id).run();
  } else {
    friendshipId = `fr_${randomToken(12)}`;
    await env.DB.prepare('INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at) VALUES (?, ?, ?, \'pending\', ?, ?)')
      .bind(friendshipId, account.id, target.user_id, now, now).run();
  }
  if (shouldNotify) schedulePush(env, context, target.user_id, {
    title: 'Novo pedido de amizade',
    body: `${account.displayName} enviou um pedido de amizade.`,
    url: '/?open=notifications',
    tag: `friend-request:${friendshipId}`,
  });
  return json({ ok: true });
}

async function friendUpdate(
  request: Request,
  env: AccountEnv,
  account: AuthenticatedAccount,
  id: string,
  context?: PushExecutionContext,
): Promise<Response> {
  const body = await readJson(request);
  const action = String(body?.action ?? '');
  const row = await env.DB.prepare('SELECT * FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)')
    .bind(id, account.id, account.id).first<{ requester_id: string; addressee_id: string; status: string }>();
  if (!row) return json({ error: 'friendship_not_found' }, 404);
  const now = Date.now();
  if (action === 'accept' && row.addressee_id === account.id) {
    await env.DB.prepare('UPDATE friendships SET status = \'accepted\', updated_at = ? WHERE id = ?').bind(now, id).run();
    if (row.status === 'pending') schedulePush(env, context, row.requester_id, {
      title: 'Pedido de amizade aceito',
      body: `${account.displayName} aceitou seu pedido de amizade.`,
      url: '/?open=friends',
      tag: `friend-accepted:${id}`,
    });
  } else if (action === 'decline' && row.addressee_id === account.id) {
    await env.DB.prepare('UPDATE friendships SET status = \'declined\', updated_at = ? WHERE id = ?').bind(now, id).run();
  } else if (action === 'block') {
    await env.DB.prepare('UPDATE friendships SET status = \'blocked\', updated_at = ? WHERE id = ?').bind(now, id).run();
  } else if (action === 'remove') {
    const friendId = row.requester_id === account.id ? row.addressee_id : row.requester_id;
    await env.DB.batch([
      // A removed friend should no longer have an active conversation or an offer in flight.
      env.DB.prepare('DELETE FROM friend_messages WHERE friendship_id = ?').bind(id),
      env.DB.prepare('DELETE FROM album_friend_trades WHERE friendship_id = ?').bind(id),
      // Remove the like this account gave the friend; incoming likes are independent.
      env.DB.prepare('DELETE FROM profile_likes WHERE user_id = ? AND liker_id = ?').bind(friendId, account.id),
      env.DB.prepare('DELETE FROM friendships WHERE id = ?').bind(id),
    ]);
  } else {
    return json({ error: 'invalid_friend_action' }, 400);
  }
  return json({ ok: true });
}

/** A chat and trades are available only while this friendship is accepted. */
async function acceptedFriendship(env: AccountEnv, account: AuthenticatedAccount, friendshipId: string): Promise<{ id: string; requester_id: string; addressee_id: string } | null> {
  return env.DB.prepare(`SELECT id, requester_id, addressee_id FROM friendships
    WHERE id = ? AND status = 'accepted' AND (requester_id = ? OR addressee_id = ?) LIMIT 1`)
    .bind(friendshipId, account.id, account.id)
    .first<{ id: string; requester_id: string; addressee_id: string }>();
}

const FRIEND_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
const FRIEND_MESSAGE_MAX_LENGTH = 500;

async function loadFriendMessages(env: AccountEnv, friendshipId: string, now: number) {
  const rows = await env.DB.prepare(`SELECT id, sender_id, body, created_at, expires_at
    FROM friend_messages WHERE friendship_id = ? AND expires_at > ?
    ORDER BY created_at DESC, id DESC LIMIT 200`).bind(friendshipId, now).all();
  return [...rows.results].reverse();
}

async function friendMessages(
  request: Request,
  env: AccountEnv,
  account: AuthenticatedAccount,
  friendshipId: string,
  context?: PushExecutionContext,
): Promise<Response> {
  const friendship = await acceptedFriendship(env, account, friendshipId);
  if (!friendship) return json({ error: 'friendship_not_found' }, 404);
  const now = Date.now();
  // Expiration is enforced on every read and send; cleanup is shared across conversations.
  await env.DB.prepare('DELETE FROM friend_messages WHERE expires_at <= ?').bind(now).run();
  if (request.method === 'GET') {
    return json({ messages: await loadFriendMessages(env, friendshipId, now) });
  }
  const body = await readJson(request);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text || text.length > FRIEND_MESSAGE_MAX_LENGTH) return json({ error: 'invalid_message' }, 400);
  const message = {
    id: `msg_${randomToken(12)}`,
    sender_id: account.id,
    body: text,
    created_at: now,
    expires_at: now + FRIEND_MESSAGE_TTL_MS,
  };
  await env.DB.prepare(`INSERT INTO friend_messages (id, friendship_id, sender_id, body, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(message.id, friendshipId, account.id, text, now, message.expires_at).run();
  const recipientId = friendship.requester_id === account.id ? friendship.addressee_id : friendship.requester_id;
  const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
  schedulePush(env, context, recipientId, {
    title: `Mensagem de ${account.displayName}`,
    body: preview,
    url: `/?open=chat&friendship=${encodeURIComponent(friendshipId)}`,
    tag: `friend-message:${friendshipId}`,
  }, Math.max(60, Math.floor((message.expires_at - now) / 1000)));
  return json({ message }, 201);
}

async function friendMessagesRead(env: AccountEnv, account: AuthenticatedAccount, friendshipId: string): Promise<Response> {
  const friendship = await acceptedFriendship(env, account, friendshipId);
  if (!friendship) return json({ error: 'friendship_not_found' }, 404);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM friend_messages WHERE expires_at <= ?').bind(now),
    env.DB.prepare(`UPDATE friend_messages SET read_at = ?
      WHERE friendship_id = ? AND sender_id <> ? AND read_at IS NULL AND expires_at > ?`)
      .bind(now, friendshipId, account.id, now),
  ]);
  return json({ messages: await loadFriendMessages(env, friendshipId, now) });
}

const FRIEND_TRADE_TTL_MS = 72 * 60 * 60 * 1000;
const FRIEND_TRADE_MAX_QUANTITY = 999;

interface FriendTradeRow {
  id: string;
  friendship_id: string;
  requester_id: string;
  addressee_id: string;
  requester_card_id: string;
  requester_quantity: number;
  addressee_card_id: string | null;
  addressee_quantity: number | null;
  requester_ready: number;
  addressee_ready: number;
  status: 'pending' | 'processing' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  created_at: number;
  updated_at: number;
  expires_at: number;
}

async function friendTrades(
  request: Request,
  env: AccountEnv,
  account: AuthenticatedAccount,
  friendshipId: string,
  context?: PushExecutionContext,
): Promise<Response> {
  const friendship = await acceptedFriendship(env, account, friendshipId);
  if (!friendship) return json({ error: 'friendship_not_found' }, 404);
  const now = Date.now();
  await env.DB.prepare(`UPDATE album_friend_trades SET status = 'expired', updated_at = ?
    WHERE friendship_id = ? AND status = 'pending' AND expires_at <= ?`).bind(now, friendshipId, now).run();
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT id, friendship_id, requester_id, addressee_id,
        requester_card_id, requester_quantity, addressee_card_id, addressee_quantity, requester_ready, addressee_ready,
        status, created_at, updated_at, expires_at
      FROM album_friend_trades WHERE friendship_id = ?
        AND ((status = 'pending' AND expires_at > ?) OR (status = 'accepted' AND updated_at > ?))
      ORDER BY created_at DESC LIMIT 50`).bind(friendshipId, now, now - 10 * 60 * 1000).all<FriendTradeRow>();
    return json({ trades: rows.results.map((row: any) => ({ ...row, requester_ready: Boolean(row.requester_ready), addressee_ready: Boolean(row.addressee_ready) })) });
  }

  const body = await readJson(request);
  const cardId = typeof body?.cardId === 'string' ? body.cardId : '';
  const quantity = Number(body?.quantity ?? 1);
  if (!albumCatalog().stickers.has(cardId)) return json({ error: 'invalid_card' }, 400);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > FRIEND_TRADE_MAX_QUANTITY) return json({ error: 'invalid_quantity' }, 400);
  const addresseeId = friendship.requester_id === account.id ? friendship.addressee_id : friendship.requester_id;
  const availability = await env.DB.prepare(`SELECT
      EXISTS(SELECT 1 FROM account_presence WHERE user_id = ? AND status = 'available' AND updated_at > ?) AS has_available_session,
      EXISTS(SELECT 1 FROM account_presence WHERE user_id = ? AND status = 'busy' AND updated_at > ?) AS has_busy_session`)
    .bind(addresseeId, now - ACCOUNT_PRESENCE_TTL_MS, addresseeId, now - ACCOUNT_PRESENCE_TTL_MS)
    .first<{ has_available_session: number; has_busy_session: number }>();
  if (!availability?.has_available_session || availability.has_busy_session) return json({ error: 'friend_unavailable' }, 409);
  const activeTrade = await env.DB.prepare(`SELECT id FROM album_friend_trades
    WHERE friendship_id = ? AND status IN ('pending', 'processing')
      AND (status = 'processing' OR expires_at > ?) LIMIT 1`).bind(friendshipId, now).first();
  if (activeTrade) return json({ error: 'trade_in_progress' }, 409);
  const available = await env.DB.prepare('SELECT spare FROM user_stickers WHERE user_id = ? AND card_id = ?')
    .bind(account.id, cardId).first<{ spare: number }>();
  if (!available || available.spare < quantity) return json({ error: 'no_spare_copy' }, 409);
  const trade = {
    id: `tr_${randomToken(12)}`,
    friendship_id: friendshipId,
    requester_id: account.id,
    addressee_id: addresseeId,
    requester_card_id: cardId,
    requester_quantity: quantity,
    status: 'pending' as const,
    created_at: now,
    updated_at: now,
    expires_at: now + FRIEND_TRADE_TTL_MS,
  };
  try {
    await env.DB.prepare(`INSERT INTO album_friend_trades
      (id, friendship_id, requester_id, addressee_id, requester_card_id, requester_quantity, requester_ready, addressee_ready, status, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'pending', ?, ?, ?)`)
      .bind(trade.id, trade.friendship_id, trade.requester_id, trade.addressee_id, trade.requester_card_id,
        trade.requester_quantity, trade.created_at, trade.updated_at, trade.expires_at).run();
  } catch (cause) {
    const active = await env.DB.prepare(`SELECT id FROM album_friend_trades
      WHERE friendship_id = ? AND status IN ('pending', 'processing')
        AND (status = 'processing' OR expires_at > ?) LIMIT 1`)
      .bind(friendshipId, now).first();
    if (active) return json({ error: 'trade_in_progress' }, 409);
    throw cause;
  }
  const notificationTtl = Math.max(60, Math.floor((trade.expires_at - now) / 1000));
  schedulePush(env, context, addresseeId, {
    title: 'Nova proposta de troca',
    body: `${account.displayName} enviou uma proposta de troca de cartas.`,
    url: '/?open=friends',
    tag: `friend-trade:${trade.id}`,
  }, notificationTtl);
  return json({ trade }, 201);
}

async function friendTradeAction(
  env: AccountEnv,
  account: AuthenticatedAccount,
  friendshipId: string,
  tradeId: string,
  action: 'decline' | 'cancel',
): Promise<Response> {
  const friendship = await acceptedFriendship(env, account, friendshipId);
  if (!friendship) return json({ error: 'friendship_not_found' }, 404);
  const trade = await env.DB.prepare(`SELECT * FROM album_friend_trades
    WHERE id = ? AND friendship_id = ? AND status = 'pending' AND expires_at > ?`)
    .bind(tradeId, friendshipId, Date.now()).first<FriendTradeRow>();
  if (!trade) return json({ error: 'trade_not_found' }, 404);

  const allowed = action === 'decline' ? trade.addressee_id === account.id : trade.requester_id === account.id;
  if (!allowed) return json({ error: 'invalid_trade_action' }, 403);
  const status = action === 'decline' ? 'declined' : 'cancelled';
  const now = Date.now();
  const result = await env.DB.prepare(`UPDATE album_friend_trades SET status = ?, updated_at = ?
    WHERE id = ? AND status = 'pending' AND expires_at > ?`)
    .bind(status, now, tradeId, now).run();
  if ((result.meta?.changes ?? 0) === 0) return json({ error: 'trade_not_found' }, 404);
  return json({ ok: true, status });
}

async function finishFriendTrade(env: AccountEnv, friendshipId: string, tradeId: string): Promise<Response> {
  const trade = await env.DB.prepare(`SELECT * FROM album_friend_trades
    WHERE id = ? AND friendship_id = ? AND status = 'processing'`).bind(tradeId, friendshipId).first<FriendTradeRow>();
  if (!trade || !trade.addressee_card_id || !trade.addressee_quantity) return json({ error: 'trade_not_found' }, 404);
  const now = Date.now();
  // The trade is claimed before this batch, so neither side can change it while copies move.
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE user_stickers SET spare = spare - ?, updated_at = ?
      WHERE user_id = ? AND card_id = ? AND spare >= ?`)
      .bind(trade.requester_quantity, now, trade.requester_id, trade.requester_card_id, trade.requester_quantity),
    env.DB.prepare(`UPDATE user_stickers SET spare = spare - ?, updated_at = ?
      WHERE user_id = ? AND card_id = ? AND spare >= ? AND (SELECT changes()) = 1`)
      .bind(trade.addressee_quantity, now, trade.addressee_id, trade.addressee_card_id, trade.addressee_quantity),
    env.DB.prepare(`INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at)
      SELECT ?, ?, 1, ?, ?, ? WHERE (SELECT changes()) = 1
      ON CONFLICT(user_id, card_id) DO UPDATE SET spare = user_stickers.spare + ?, updated_at = excluded.updated_at`)
      .bind(trade.requester_id, trade.addressee_card_id, Math.max(0, trade.addressee_quantity - 1), now, now, trade.addressee_quantity),
    env.DB.prepare(`INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at)
      SELECT ?, ?, 1, ?, ?, ? WHERE (SELECT changes()) = 1
      ON CONFLICT(user_id, card_id) DO UPDATE SET spare = user_stickers.spare + ?, updated_at = excluded.updated_at`)
      .bind(trade.addressee_id, trade.requester_card_id, Math.max(0, trade.requester_quantity - 1), now, now, trade.requester_quantity),
    env.DB.prepare(`UPDATE album_friend_trades SET status = 'accepted', updated_at = ?
      WHERE id = ? AND status = 'processing' AND (SELECT changes()) = 1`).bind(now, tradeId),
  ]);
  const requesterDebited = Number(results[0]?.meta?.changes ?? 0) === 1;
  const addresseeDebited = Number(results[1]?.meta?.changes ?? 0) === 1;
  const completed = Number(results[4]?.meta?.changes ?? 0) === 1;
  if (!completed) {
    const statements: D1PreparedStatement[] = [];
    if (requesterDebited && !addresseeDebited) {
      statements.push(env.DB.prepare(`UPDATE user_stickers SET spare = spare + ?, updated_at = ?
        WHERE user_id = ? AND card_id = ?`).bind(trade.requester_quantity, now, trade.requester_id, trade.requester_card_id));
    }
    statements.push(env.DB.prepare(`UPDATE album_friend_trades SET status = 'pending', requester_ready = 0, addressee_ready = 0, updated_at = ?
      WHERE id = ? AND status = 'processing'`).bind(now, tradeId));
    await env.DB.batch(statements);
    return json({ error: requesterDebited ? 'no_spare_copy' : 'trade_cards_unavailable' }, 409);
  }
  let pageRewards: unknown[] = [];
  try {
    const [toAddressee, toRequester] = await Promise.all([
      syncAlbumPagesForCards(env.DB, trade.addressee_id, [trade.requester_card_id], now),
      syncAlbumPagesForCards(env.DB, trade.requester_id, [trade.addressee_card_id], now),
    ]);
    pageRewards = [...toAddressee, ...toRequester];
  } catch (error) {
    console.error('[album] page rewards after friend trade failed:', error);
  }
  return json({ ok: true, status: 'accepted', pageRewards, trade: { ...trade, status: 'accepted', updated_at: now } });
}

async function updateFriendTradeSelection(
  request: Request,
  env: AccountEnv,
  account: AuthenticatedAccount,
  friendshipId: string,
  tradeId: string,
): Promise<Response> {
  const friendship = await acceptedFriendship(env, account, friendshipId);
  if (!friendship) return json({ error: 'friendship_not_found' }, 404);
  const trade = await env.DB.prepare(`SELECT * FROM album_friend_trades
    WHERE id = ? AND friendship_id = ? AND status = 'pending' AND expires_at > ?`)
    .bind(tradeId, friendshipId, Date.now()).first<FriendTradeRow>();
  if (!trade) return json({ error: 'trade_not_found' }, 404);
  const isRequester = trade.requester_id === account.id;
  if (!isRequester && trade.addressee_id !== account.id) return json({ error: 'invalid_trade_action' }, 403);

  const body = await readJson(request);
  const cardId = typeof body?.cardId === 'string' ? body.cardId : '';
  const quantity = Number(body?.quantity ?? 1);
  const ready = body?.ready === true;
  const expectedOtherCardId = typeof body?.expectedOtherCardId === 'string' ? body.expectedOtherCardId : null;
  const expectedOtherQuantity = body?.expectedOtherQuantity == null ? null : Number(body.expectedOtherQuantity);
  if (!albumCatalog().stickers.has(cardId)) return json({ error: 'invalid_card' }, 400);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > FRIEND_TRADE_MAX_QUANTITY) return json({ error: 'invalid_quantity' }, 400);
  if (ready && (!expectedOtherCardId || !Number.isSafeInteger(expectedOtherQuantity) || expectedOtherQuantity! < 1)) {
    return json({ error: 'trade_changed' }, 409);
  }
  const available = await env.DB.prepare('SELECT spare FROM user_stickers WHERE user_id = ? AND card_id = ?')
    .bind(account.id, cardId).first<{ spare: number }>();
  if (!available || available.spare < quantity) return json({ error: 'no_spare_copy' }, 409);

  const now = Date.now();
  const update = isRequester
    ? env.DB.prepare(`UPDATE album_friend_trades SET requester_card_id = ?, requester_quantity = ?,
        requester_ready = CASE WHEN requester_card_id = ? AND requester_quantity = ? THEN ? ELSE 0 END,
        addressee_ready = CASE WHEN requester_card_id = ? AND requester_quantity = ? THEN addressee_ready ELSE 0 END,
        updated_at = ?
        WHERE id = ? AND friendship_id = ? AND requester_id = ? AND status = 'pending' AND expires_at > ?
          AND (? = 0 OR (addressee_card_id = ? AND addressee_quantity = ?))`)
      .bind(cardId, quantity, cardId, quantity, Number(ready), cardId, quantity, now, tradeId, friendshipId, account.id, now,
        Number(ready), expectedOtherCardId, expectedOtherQuantity)
    : env.DB.prepare(`UPDATE album_friend_trades SET addressee_card_id = ?, addressee_quantity = ?,
        addressee_ready = CASE WHEN addressee_card_id = ? AND addressee_quantity = ? THEN ? ELSE 0 END,
        requester_ready = CASE WHEN addressee_card_id = ? AND addressee_quantity = ? THEN requester_ready ELSE 0 END,
        updated_at = ?
        WHERE id = ? AND friendship_id = ? AND addressee_id = ? AND status = 'pending' AND expires_at > ?
          AND (? = 0 OR (requester_card_id = ? AND requester_quantity = ?))`)
      .bind(cardId, quantity, cardId, quantity, Number(ready), cardId, quantity, now, tradeId, friendshipId, account.id, now,
        Number(ready), expectedOtherCardId, expectedOtherQuantity);
  const updated = await update.run();
  if ((updated.meta?.changes ?? 0) === 0) {
    const latest = await env.DB.prepare(`SELECT * FROM album_friend_trades
      WHERE id = ? AND friendship_id = ? AND status = 'pending' AND expires_at > ?`)
      .bind(tradeId, friendshipId, now).first<FriendTradeRow>();
    return latest ? json({ error: 'trade_changed' }, 409) : json({ error: 'trade_not_found' }, 404);
  }

  const current = await env.DB.prepare('SELECT * FROM album_friend_trades WHERE id = ?').bind(tradeId).first<FriendTradeRow>();
  if (!current) return json({ error: 'trade_not_found' }, 404);
  if (current.requester_ready && current.addressee_ready && current.addressee_card_id && current.addressee_quantity) {
    const claim = await env.DB.prepare(`UPDATE album_friend_trades SET status = 'processing', updated_at = ?
      WHERE id = ? AND friendship_id = ? AND status = 'pending' AND expires_at > ?
        AND requester_ready = 1 AND addressee_ready = 1`)
      .bind(now, tradeId, friendshipId, now).run();
    if ((claim.meta?.changes ?? 0) === 1) return finishFriendTrade(env, friendshipId, tradeId);
  }
  return json({ trade: { ...current, requester_ready: Boolean(current.requester_ready), addressee_ready: Boolean(current.addressee_ready) } });
}

/** Events with the account's progress, plus its frames and exclusive cards. */
async function accountEvents(env: AccountEnv, account: AuthenticatedAccount): Promise<Response> {
  const { states, unlocked, cardsUnlocked, crests, crestsUnlocked } = await syncEventRewards(env.DB, account.id);
  return json({
    events: states,
    frames: await loadOwnedFrames(env.DB, account.id),
    eventCards: await loadOwnedEventCards(env.DB, account.id),
    nameStyles: await loadOwnedNameStyles(env.DB, account.id),
    equippedFrame: account.avatarFrameKey,
    unlocked,
    cardsUnlocked,
    crests,
    crestsUnlocked,
  });
}

/** Picks the account's option in a choice event (for good). */
async function chooseEvent(request: Request, env: AccountEnv, account: AuthenticatedAccount, eventId: string): Promise<Response> {
  const body = await readJson(request);
  const result = await chooseEventOption(env.DB, account.id, eventId, body?.choice);
  if ('error' in result) return json(result, result.error === 'already_chosen' ? 409 : 400);
  return accountEvents(env, account);
}

/** Album and coin rewards due for finished campaigns; never turns a saved campaign into an error. */
async function grantCampaignRewards(env: AccountEnv, userId: string): Promise<ItemGrant[]> {
  try {
    const album = await env.DB.prepare('SELECT created_at FROM user_album WHERE user_id = ?').bind(userId).first<{ created_at: number }>();
    return album ? await syncCampaignGrants(env.DB, userId, album.created_at) : [];
  } catch (error) {
    console.error('[album] grants after save failed:', error);
    return [];
  }
}

const ALBUM_ERROR_STATUS: Record<string, number> = {
  invalid_item: 400, invalid_card: 400, invalid_quantity: 400, not_for_sale: 400,
  item_not_owned: 409, no_spare_copy: 409, max_level: 409, already_owned: 409, not_enough_coins: 409, banner_unavailable: 503,
  banner_purchase_in_progress: 409,
};

/** The album state (after granting what is due) and the profile covers it won, plus whatever the operation returned. */
async function albumResponse(env: AccountEnv, userId: string, extra: Record<string, unknown> = {}): Promise<Response> {
  const [{ state, grants }, covers] = await Promise.all([syncAlbum(env.DB, userId), loadOwnedCovers(env.DB, userId)]);
  return json({ ...state, grants, covers, ...extra });
}

async function albumAction(request: Request, env: AccountEnv, account: AuthenticatedAccount, action: string): Promise<Response> {
  const body = await readJson(request) ?? {};
  await ensureAlbum(env.DB, account.id);
  let result: Record<string, unknown>;
  switch (action) {
    case 'open': result = await openItem(env.DB, account.id, String(body.item ?? '')) as unknown as Record<string, unknown>; break;
    case 'apply': result = await applyCopy(env.DB, account.id, String(body.cardId ?? '')); break;
    case 'sell': result = await sellCopies(env.DB, account.id, String(body.cardId ?? ''), Number(body.quantity ?? 1)); break;
    case 'buy-pack': result = await buyPack(env.DB, account.id, String(body.tier ?? '')); break;
    case 'buy-frame': result = await buyAvatarFrame(env.DB, account.id, String(body.frameKey ?? '')); break;
    case 'buy-cover': result = await buyProfileCover(env.DB, account.id, String(body.coverKey ?? '')); break;
    case 'buy-name-style': result = await buyNameStyle(env.DB, account.id, String(body.styleKey ?? '')); break;
    case 'buy-daily-banner': result = { ...await buyDailyBannerCard(env.DB, account.id) }; break;
    case 'buy-weekly-banner': result = { ...await buyWeeklyBannerCard(env.DB, account.id) }; break;
    default: return json({ error: 'not_found' }, 404);
  }
  if ('error' in result) return json(result, ALBUM_ERROR_STATUS[String(result.error)] ?? 400);
  return albumResponse(env, account.id, { result });
}

interface WeeklyPackClaimRow {
  day_index: number;
  item_key: string;
  claimed_at: number;
}

/** Calendar dates for the account reward week, using the game's São Paulo day boundary. */
function saoPauloRewardWeek(now: number): { date: string; weekStart: string; dayIndex: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayIndex = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayIndex);
  const format = (value: Date) => `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  return { date: format(new Date(Date.UTC(year, month - 1, day))), weekStart: format(date), dayIndex };
}

async function weeklyPackRewardsResponse(env: AccountEnv, accountId: string, now: number): Promise<Response> {
  const { date, weekStart, dayIndex } = saoPauloRewardWeek(now);
  const claims = await env.DB.prepare(`SELECT day_index, item_key, claimed_at
    FROM user_weekly_pack_claims WHERE user_id = ? AND week_start = ? ORDER BY day_index ASC`)
    .bind(accountId, weekStart).all<WeeklyPackClaimRow>();
  return json({
    date,
    weekStart,
    todayIndex: dayIndex,
    rewards: WEEKLY_PACK_REWARDS,
    claims: claims.results.map(claim => ({ dayIndex: claim.day_index, itemKey: claim.item_key, claimedAt: claim.claimed_at })),
  });
}

async function claimWeeklyPackReward(env: AccountEnv, accountId: string): Promise<Response> {
  const now = Date.now();
  const { weekStart, dayIndex } = saoPauloRewardWeek(now);
  const reward = WEEKLY_PACK_REWARDS[dayIndex];
  // The claim ledger and inventory credit share a D1 batch. `changes()` only lets the second
  // statement add the package when this request inserted the unique claim row.
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT INTO user_weekly_pack_claims (user_id, week_start, day_index, item_key, claimed_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, week_start, day_index) DO NOTHING`)
      .bind(accountId, weekStart, dayIndex, reward.itemKey, now),
    env.DB.prepare(`INSERT INTO user_inventory (user_id, item_key, quantity, updated_at)
      SELECT ?, ?, 1, ? WHERE (SELECT changes()) = 1
      ON CONFLICT(user_id, item_key) DO UPDATE SET
        quantity = user_inventory.quantity + excluded.quantity, updated_at = excluded.updated_at`)
      .bind(accountId, reward.itemKey, now),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    return json({ error: 'already_claimed', message: 'A recompensa de hoje já foi resgatada.' }, 409);
  }
  return weeklyPackRewardsResponse(env, accountId, now);
}

/** Whether the viewer may see this profile: public, their own, or a friend's "friends only". */
async function canViewProfile(env: AccountEnv, viewer: AuthenticatedAccount | null, account: AuthenticatedAccount): Promise<boolean> {
  if (viewer?.id === account.id || account.visibility === 'public') return true;
  if (account.visibility === 'private' || !viewer) return false;
  const friendship = await env.DB.prepare(`SELECT id FROM friendships
    WHERE status = 'accepted'
      AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
    LIMIT 1`).bind(viewer.id, account.id, account.id, viewer.id).first<{ id: string }>();
  return Boolean(friendship);
}

/** Like (PUT) or unlike (DELETE) another player's profile. */
async function profileLike(request: Request, env: AccountEnv, username: string): Promise<Response> {
  const viewer = await authenticatedAccount(request, env);
  if (!viewer) return json({ error: 'authentication_required' }, 401);
  const row = await env.DB.prepare(`${ACCOUNT_SELECT} WHERE p.username = ?`).bind(normalizeUsername(username)).first<UserRow>();
  if (!row) return json({ error: 'user_not_found' }, 404);
  const account = accountFromRow(row);
  if (account.id === viewer.id) return json({ error: 'cannot_like_self' }, 400);
  if (!(await canViewProfile(env, viewer, account))) return json({ error: 'profile_private' }, 403);
  const liked = request.method === 'PUT';
  if (liked) {
    await env.DB.prepare('INSERT OR IGNORE INTO profile_likes (user_id, liker_id, created_at) VALUES (?, ?, ?)').bind(account.id, viewer.id, Date.now()).run();
  } else {
    await env.DB.prepare('DELETE FROM profile_likes WHERE user_id = ? AND liker_id = ?').bind(account.id, viewer.id).run();
  }
  const count = await env.DB.prepare('SELECT COUNT(*) AS like_count FROM profile_likes WHERE user_id = ?').bind(account.id).first<{ like_count: number }>();
  return json({ liked, likeCount: Number(count?.like_count ?? 0) });
}

async function publicProfile(request: Request, env: AccountEnv, username: string): Promise<Response> {
  const row = await env.DB.prepare(`${ACCOUNT_SELECT} WHERE p.username = ?`).bind(normalizeUsername(username)).first<UserRow>();
  if (!row) return json({ error: 'user_not_found' }, 404);
  const account = accountFromRow(row);
  const viewer = await authenticatedAccount(request, env);
  if (!(await canViewProfile(env, viewer, account))) return json({ error: 'profile_private' }, 403);
  const likedByViewer = viewer && viewer.id !== account.id
    ? Boolean(await env.DB.prepare('SELECT 1 AS liked FROM profile_likes WHERE user_id = ? AND liker_id = ?').bind(account.id, viewer.id).first())
    : false;
  const [records, scorePosition, friendCountRow] = await Promise.all([
    loadRecordHighlights(env, account.id),
    getScoreLeaderboardPosition(env, account),
    env.DB.prepare(`SELECT COUNT(*) AS friend_count FROM friendships
      WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`).bind(account.id, account.id).first<{ friend_count: number }>(),
  ]);
  const visibleScorePosition = account.visibility === 'public'
    ? scorePosition
    : { ...scorePosition, position: null, points: 0, scored_competitions: 0, titles: 0 };
  const achievements = await achievementsPayload(env, account.id, records);
  const album = await albumSummary(env.DB, account.id).catch(() => null);
  return json({
    profile: publicAccount(account),
    album,
    records,
    achievements,
    scorePosition: visibleScorePosition,
    friendCount: Number(friendCountRow?.friend_count ?? 0),
    likedByViewer,
  });
}

export async function handleAccountRequest(
  request: Request,
  env: AccountEnv,
  context?: PushExecutionContext,
): Promise<Response | null> {
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
  if (url.pathname === '/api/leaderboards/score' && request.method === 'GET') return scoreLeaderboard(env, url);
  const likeRoute = /^\/api\/users\/([^/]+)\/like$/.exec(url.pathname);
  if (likeRoute && (request.method === 'PUT' || request.method === 'DELETE')) return profileLike(request, env, decodeURIComponent(likeRoute[1]));
  if (url.pathname.startsWith('/api/users/') && request.method === 'GET') return publicProfile(request, env, decodeURIComponent(url.pathname.slice('/api/users/'.length)));

  if (url.pathname.startsWith('/api/account')) {
    const account = await authenticatedAccount(request, env);
    if (!account) return json({ error: 'authentication_required' }, 401);
    if (url.pathname === '/api/account/profile' && request.method === 'GET') return json({ account: publicAccount(account) });
    if (url.pathname === '/api/account/profile' && request.method === 'PATCH') return profileUpdate(request, env, account);
    if (url.pathname === '/api/account/push/subscription'
      && (request.method === 'GET' || request.method === 'PUT' || request.method === 'DELETE')) {
      return pushSubscription(request, env, account);
    }
    if (url.pathname === '/api/account/solo-campaign' && request.method === 'GET') return accountSoloCampaign(env, account);
    if (url.pathname === '/api/account/solo-campaign' && request.method === 'PUT') return accountSoloCampaignSave(request, env, account);
    if (url.pathname === '/api/account/solo-campaign' && request.method === 'DELETE') return accountSoloCampaignDelete(env, account);
    if (url.pathname === '/api/account/leaderboards/score-position' && request.method === 'GET') return scoreLeaderboardPosition(env, account, url);
    if (url.pathname === '/api/account/records' && request.method === 'GET') return accountRecordHighlights(env, account);
    if (url.pathname === '/api/account/achievements' && request.method === 'GET') return accountAchievements(env, account, url);
    if (url.pathname === '/api/account/showcase' && request.method === 'PUT') return updateShowcase(request, env, account);
    if (url.pathname === '/api/account/events' && request.method === 'GET') return accountEvents(env, account);
    if (url.pathname === '/api/account/daily-rewards' && request.method === 'GET') return weeklyPackRewardsResponse(env, account.id, Date.now());
    if (url.pathname === '/api/account/daily-rewards/claim' && request.method === 'POST') return claimWeeklyPackReward(env, account.id);
    if (url.pathname === '/api/account/album/daily-banner' && request.method === 'GET') return json(dailyBannerRotations());
    if (url.pathname === '/api/account/album/weekly-banner' && request.method === 'GET') return json(weeklyBannerRotations());
    if (url.pathname === '/api/account/album' && request.method === 'GET') return albumResponse(env, account.id);
    const albumRoute = url.pathname.match(/^\/api\/account\/album\/(open|apply|sell|buy-pack|buy-frame|buy-cover|buy-name-style|buy-daily-banner|buy-weekly-banner)$/);
    if (albumRoute && request.method === 'POST') return albumAction(request, env, account, albumRoute[1]);
    const eventChoice = url.pathname.match(/^\/api\/account\/events\/([a-z0-9-]+)\/choice$/);
    if (eventChoice && request.method === 'POST') return chooseEvent(request, env, account, eventChoice[1]);
    if (url.pathname === '/api/account/history' && request.method === 'GET') {
      const requestedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
      return historyList(env, account, Number.isFinite(requestedPage) ? requestedPage : 1);
    }
    if (url.pathname === '/api/account/history' && request.method === 'POST') return historyCreate(request, env, account);
    if (url.pathname === '/api/account/presence' && request.method === 'POST') return updatePresence(request, env, account);
    if (url.pathname === '/api/account/friends' && request.method === 'GET') return friendsList(env, account);
    if (url.pathname === '/api/account/friends' && request.method === 'POST') return friendCreate(request, env, account, context);
    const friendMessagesReadMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)\/messages\/read$/);
    if (friendMessagesReadMatch && request.method === 'POST') {
      return friendMessagesRead(env, account, decodeURIComponent(friendMessagesReadMatch[1]));
    }
    const friendMessagesMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)\/messages$/);
    if (friendMessagesMatch && (request.method === 'GET' || request.method === 'POST')) {
      return friendMessages(request, env, account, decodeURIComponent(friendMessagesMatch[1]), context);
    }
    const friendTradesMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)\/trades$/);
    if (friendTradesMatch && (request.method === 'GET' || request.method === 'POST')) {
      return friendTrades(request, env, account, decodeURIComponent(friendTradesMatch[1]), context);
    }
    const friendTradeSelectionMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)\/trades\/([^/]+)\/selection$/);
    if (friendTradeSelectionMatch && request.method === 'PATCH') {
      return updateFriendTradeSelection(request, env, account,
        decodeURIComponent(friendTradeSelectionMatch[1]), decodeURIComponent(friendTradeSelectionMatch[2]));
    }
    const friendTradeActionMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)\/trades\/([^/]+)\/(decline|cancel)$/);
    if (friendTradeActionMatch && request.method === 'POST') {
      return friendTradeAction(env, account,
        decodeURIComponent(friendTradeActionMatch[1]), decodeURIComponent(friendTradeActionMatch[2]),
        friendTradeActionMatch[3] as 'decline' | 'cancel');
    }
    if (url.pathname === '/api/account/room-invitations' && request.method === 'GET') return roomInvitationsList(env, account);
    // PATCH /api/account/room-invitations/:id (accept/decline) is handled by the
    // Worker (cloudflare-worker.ts), because it must validate against the room DO.
    const friendMatch = url.pathname.match(/^\/api\/account\/friends\/([^/]+)$/);
    if (friendMatch && request.method === 'PATCH') return friendUpdate(request, env, account, friendMatch[1], context);
    return json({ error: 'not_found' }, 404);
  }
  return null;
}
