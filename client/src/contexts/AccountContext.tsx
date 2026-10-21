import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Player } from '@shared/game/gameData';
import type { CompetitionFinishStage, RankedDifficultyId } from '@shared/game/competitionRanking';
import type { AchievementLevel, ShowcaseItem } from '@shared/game/achievements';
import type { ItemGrant } from './AlbumContext';
import type { AlbumSummary } from '../components/album/ProfileAlbumSummary';
import type { SoloSave } from '../lib/soloSave';
import { playSound, soundForRequest } from '../audio/uiSound';
import { currentSeason } from '@shared/game/seasons';

export interface AchievementState {
  id: string;
  level: AchievementLevel;
  progress: number;
  /** Coach or crest id driving the progress, for "most with one" achievements. */
  detail?: string | null;
  unlockedAt: number | null;
}

export interface AchievementUnlock {
  id: string;
  level: AchievementLevel;
}

export interface AchievementRarity {
  players: number;
  /** Percent of players holding each level or better: Bronze through Imortal. */
  percentByAchievement: Record<string, [number, number, number, number, number]>;
}

export interface FrameUnlock {
  frameKey: string;
  eventId: string;
}

export interface EventObjectiveState {
  id: string;
  label: string;
  progress: number;
  target: number;
  done: boolean;
}

export interface EventChoiceState {
  key: string;
  label: string;
  cardId: string;
  crestId: string;
  objectives: string[];
}

export interface GameEventState {
  id: string;
  name: string;
  description: string;
  startsAt: number;
  endsAt: number;
  status: 'upcoming' | 'active' | 'ended';
  /** Frame reward (regular events). */
  frameKey: string | null;
  /** Choice events: the options and the account's pick. */
  choices: EventChoiceState[] | null;
  chosenKey: string | null;
  /** Name styles to pick from once the objectives are done (null = not that kind of event). */
  rewardNameStyles: string[] | null;
  objectives: EventObjectiveState[];
  completed: boolean;
  frameUnlocked: boolean;
  /** Regular events that give an event Única. */
  rewardCardId: string | null;
  cardUnlocked: boolean;
  /** National-team crest rewarded by a regular event. */
  rewardCrestId: string | null;
  crestUnlocked: boolean;
}

export interface EventCardUnlock {
  cardId: string;
  eventId: string;
}

export interface EventCrestUnlock {
  crestId: string;
  eventId: string;
}

export interface EventsPayload {
  events: GameEventState[];
  /** Frames the account owns. */
  frames: string[];
  /** Event Únicas the account unlocked (its personal Pacote Único pool). */
  eventCards: string[];
  /** Name styles the account unlocked. */
  nameStyles: string[];
  /** National-team crests the account unlocked through events. */
  crests: string[];
  equippedFrame: string | null;
  unlocked: FrameUnlock[];
  cardsUnlocked: EventCardUnlock[];
  crestsUnlocked: EventCrestUnlock[];
}

export interface AchievementsPayload {
  achievements: AchievementState[];
  rarity: AchievementRarity;
  showcase: { items: ShowcaseItem[]; automatic: boolean };
}

export interface FinishCounts {
  leaguePhase: number;
  playoff: number;
  roundOf16: number;
  quarterfinal: number;
  semifinal: number;
  runnerUp: number;
  champion: number;
}

export interface AccountStats {
  competitionsCompleted: number;
  titles: number;
  finishCounts: FinishCounts;
  /** Same counts per difficulty; missing on responses from an older server. */
  finishCountsByDifficulty?: Partial<Record<RankedDifficultyId, FinishCounts>>;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  saves: number;
  highestEffectiveOverall: number;
  highestDifficultyId: string | null;
}

export interface AccountProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarKey: string;
  avatarBackgroundKey: string;
  avatarFrameKey?: string | null;
  /** Font + effect the display name is shown with (event reward). */
  nameStyleKey?: string | null;
  coverKey: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  favoriteCrestId: string | null;
  createdAt: number;
  /** Likes other players gave this profile. */
  likeCount?: number;
  stats: AccountStats;
}

export interface CompetitionHistoryEntry {
  id: string;
  mode: 'solo' | 'online';
  difficulty_id: string;
  format_id: string;
  team_name: string;
  crest_id: string | null;
  coach_id: string | null;
  champion: number;
  placement: number | null;
  competition_points: number;
  /** Furthest stage reached; null on rows saved before stages were recorded. */
  finish_stage?: CompetitionFinishStage | null;
  report: Record<string, unknown>;
  completed_at: number;
}

interface CompetitionHistoryPage {
  history: CompetitionHistoryEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PublicRecordEntry {
  id: string;
  category: 'goals' | 'assists' | 'saves' | 'effective_overall';
  difficulty_id: string;
  player_id: string;
  player_card?: Player | null;
  player_effective_stats?: RecordCardEffectiveStats | null;
  player_name: string;
  player_photo_url: string | null;
  value: number;
  username_snapshot: string;
  profile_display_name?: string | null;
  profile_avatar_key?: string | null;
  profile_avatar_background_key?: string | null;
  profile_avatar_frame_key?: string | null;
  profile_avatar_url?: string | null;
  team_name_snapshot: string;
  crest_id_snapshot: string | null;
  mode: 'solo' | 'online';
  format_id: string;
  completed_at: number;
  rank_position?: number;
  created_at: number;
}

export interface ScoreLeaderboardEntry {
  username: string;
  display_name: string;
  avatar_key: string;
  avatar_background_key: string;
  avatar_frame_key?: string | null;
  name_style_key?: string | null;
  avatar_url: string | null;
  team_name_snapshot: string | null;
  crest_id_snapshot: string | null;
  points: number;
  scored_competitions: number;
  titles: number;
}

export interface ScoreLeaderboardPosition {
  position: number | null;
  participants: number;
  points: number;
  scored_competitions: number;
  titles: number;
  status: 'ranked' | 'no_points' | 'profile_not_public';
  /** Season the position belongs to (the current one when not asked). */
  season?: number;
  /** The viewer's prize, once that season was closed and paid. */
  reward?: SeasonRewardEntry | null;
}

export interface SeasonRewardEntry {
  season: number;
  position: number;
  points: number;
  coins: number;
  granted_at: number;
  /** null while the prize waits to be claimed in the season modal. */
  claimed_at: number | null;
}

export interface ProfileRecordEntry {
  category: PublicRecordEntry['category'];
  difficulty_id: string;
  player_id: string;
  player_card?: Player | null;
  player_effective_stats?: RecordCardEffectiveStats | null;
  rank_position?: number;
  player_name: string;
  player_photo_url: string | null;
  value: number;
  profile_display_name?: string | null;
  profile_avatar_key?: string | null;
  profile_avatar_background_key?: string | null;
  profile_avatar_frame_key?: string | null;
  profile_avatar_url?: string | null;
  team_name_snapshot: string;
  crest_id_snapshot: string | null;
  mode: 'solo' | 'online';
  format_id: string;
  completed_at: number;
  /** Season containing the competition date; absent on older server payloads. */
  season?: number;
}

export interface RecordCardEffectiveStats {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  vision: number;
  composure: number;
}

export interface PublicProfileData {
  profile: AccountProfile;
  records: ProfileRecordEntry[];
  /** Missing on responses from an older server. */
  achievements?: AchievementsPayload;
  scorePosition: ScoreLeaderboardPosition;
  friendCount: number;
  /** Whether the signed-in viewer liked this profile. */
  likedByViewer?: boolean;
  /** Their album (null before they open it). */
  album?: AlbumSummary | null;
}

export interface FriendshipEntry {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  requester_id: string;
  addressee_id: string;
  requester_username: string;
  requester_display_name: string;
  requester_avatar_key: string;
  requester_avatar_background_key: string;
  requester_avatar_url?: string | null;
  requester_avatar_frame_key?: string | null;
  requester_name_style_key?: string | null;
  addressee_username: string;
  addressee_display_name: string;
  addressee_avatar_key: string;
  addressee_avatar_background_key: string;
  addressee_avatar_url?: string | null;
  addressee_avatar_frame_key?: string | null;
  addressee_name_style_key?: string | null;
  created_at: number;
  updated_at: number;
  is_online: boolean;
  is_available: boolean;
  is_busy: boolean;
  unread_message_count?: number;
}

export interface RoomInvitationEntry {
  id: string;
  room_code: string;
  inviter_user_id: string;
  inviter_username: string;
  inviter_display_name: string;
  inviter_avatar_key: string;
  inviter_avatar_background_key: string;
  created_at: number;
  expires_at: number;
}

interface AccountContextValue {
  account: AccountProfile | null;
  loading: boolean;
  unreadMessageCount: number;
  refresh: () => Promise<boolean>;
  refreshProfileIfStale: () => Promise<boolean>;
  markCompetitionCompleted: () => void;
  login: (username: string, password: string) => Promise<AccountProfile>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<AccountProfile, 'displayName' | 'bio' | 'avatarKey' | 'avatarBackgroundKey' | 'avatarFrameKey' | 'nameStyleKey' | 'coverKey' | 'favoriteCrestId'>>) => Promise<AccountProfile>;
  getHistory: (page?: number) => Promise<CompetitionHistoryPage>;
  peekHistory: (page?: number) => CompetitionHistoryPage | null;
  getSoloCampaign: () => Promise<SoloSave<unknown> | null>;
  saveSoloCampaign: (save: SoloSave<unknown>) => Promise<SoloSave<unknown>>;
  deleteSoloCampaign: () => Promise<void>;
  saveHistory: (payload: {
    mode: 'solo' | 'online';
    difficultyId: string;
    formatId: string;
    teamName: string;
    crestId?: string | null;
    coachId?: string | null;
    champion?: boolean;
    placement?: number | null;
    competitionPoints?: number;
    finishStage?: CompetitionFinishStage;
    sourceKey?: string;
    report: Record<string, unknown>;
    records?: Array<{
      category: PublicRecordEntry['category'];
      playerId: string;
      playerName: string;
      playerPhotoUrl?: string | null;
      value: number;
    }>;
  }) => Promise<{ id: string; duplicate: boolean; achievementsUnlocked?: AchievementUnlock[]; framesUnlocked?: FrameUnlock[]; eventCardsUnlocked?: EventCardUnlock[]; albumGrants?: ItemGrant[] }>;
  getOwnAchievements: (since?: number) => Promise<AchievementsPayload & { recentlyUnlocked: AchievementUnlock[] }>;
  peekOwnAchievements: () => AchievementsPayload | null;
  getEvents: (forceRefresh?: boolean) => Promise<EventsPayload>;
  peekEvents: () => EventsPayload | null;
  /** Picks the account's option in a choice event (for good). */
  chooseEventOption: (eventId: string, choice: string) => Promise<EventsPayload>;
  /** Event Únicas the account unlocked; empty for guests. */
  eventCards: string[];
  updateShowcase: (items: ShowcaseItem[]) => Promise<AchievementsPayload['showcase']>;
  getRecords: (filters?: { category?: string; difficulty?: string; season?: number }) => Promise<PublicRecordEntry[]>;
  peekRecords: (filters?: { category?: string; difficulty?: string; season?: number }) => PublicRecordEntry[] | null;
  getOwnRecordHighlights: () => Promise<ProfileRecordEntry[]>;
  peekOwnRecordHighlights: () => ProfileRecordEntry[] | null;
  getScoreLeaderboard: (difficulty?: RankedDifficultyId | null, season?: number) => Promise<ScoreLeaderboardEntry[]>;
  peekScoreLeaderboard: (difficulty?: RankedDifficultyId | null, season?: number) => ScoreLeaderboardEntry[] | null;
  getSeasonStanding: (season: number) => Promise<ScoreLeaderboardPosition>;
  claimSeasonReward: (season: number) => Promise<SeasonRewardEntry>;
  getScoreLeaderboardPosition: () => Promise<ScoreLeaderboardPosition>;
  peekScoreLeaderboardPosition: () => ScoreLeaderboardPosition | null;
  getPublicProfile: (username: string) => Promise<PublicProfileData>;
  likeProfile: (username: string, like: boolean) => Promise<{ liked: boolean; likeCount: number }>;
  getFriends: () => Promise<FriendshipEntry[]>;
  /** The last list of friends read (null before the first read): screens start from it instead of an empty skeleton. */
  peekFriends: () => FriendshipEntry[] | null;
  setPresence: (presenceId: string, status: 'available' | 'busy' | 'away', revision: number, statusChanged?: boolean) => Promise<void>;
  getRoomInvitations: () => Promise<RoomInvitationEntry[]>;
  inviteFriendToRoom: (roomCode: string, friendshipId: string) => Promise<{ duplicate: boolean; expiresAt: number }>;
  respondToRoomInvitation: (id: string, action: 'accept' | 'decline') => Promise<{ roomCode?: string }>;
  sendFriendRequest: (username: string) => Promise<void>;
  updateFriendship: (id: string, action: 'accept' | 'decline' | 'block' | 'remove') => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const ACCOUNT_READ_CACHE_TTL_MS = 30_000;

interface CachedRead<T> {
  value?: T;
  updatedAt: number;
  request?: Promise<T>;
}

interface AccountReadCache {
  revision: number;
  historyByPage: Map<number, CompetitionHistoryPage>;
  historyRequests: Map<number, Promise<CompetitionHistoryPage>>;
  events?: CachedRead<EventsPayload>;
  achievements?: CachedRead<AchievementsPayload>;
  recordsByFilter: Map<string, CachedRead<PublicRecordEntry[]>>;
  scoreLeaderboards: Map<string, CachedRead<ScoreLeaderboardEntry[]>>;
  ownRecordHighlights?: CachedRead<ProfileRecordEntry[]>;
  scoreLeaderboardPosition?: CachedRead<ScoreLeaderboardPosition>;
}

function emptyAccountReadCache(): AccountReadCache {
  return {
    revision: 0,
    historyByPage: new Map(),
    historyRequests: new Map(),
    recordsByFilter: new Map(),
    scoreLeaderboards: new Map(),
  };
}

function isReadCacheFresh<T>(entry: CachedRead<T> | null | undefined): entry is CachedRead<T> & { value: T } {
  return entry?.value !== undefined && Date.now() - entry.updatedAt < ACCOUNT_READ_CACHE_TTL_MS;
}

function expireReadCache<T>(entry: CachedRead<T> | undefined) {
  if (!entry) return;
  entry.updatedAt = 0;
  entry.request = undefined;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    const isLocal = typeof window !== 'undefined'
      && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    throw new Error(isLocal
      ? 'O servidor local não está acessível. Inicie o jogo com pnpm dev:all e tente novamente.'
      : 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
  }
  const body = await response.json().catch(() => null) as { message?: string; error?: string } & T;
  if (!response.ok) {
    const withStatus = (message: string) => Object.assign(new Error(message), { status: response.status });
    if (body?.message || body?.error) throw withStatus(body.message || body.error!);
    const isLocal = typeof window !== 'undefined'
      && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocal && response.status >= 500) {
      throw withStatus('O servidor local falhou. Confirme se o Worker está rodando com pnpm dev:all.');
    }
    throw withStatus(`Não foi possível concluir essa ação (erro ${response.status}).`);
  }
  const sound = soundForRequest(init?.method, path);
  if (sound) playSound(sound);
  return body;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const friendsRequestRevision = useRef(0);
  const readCaches = useRef(new Map<string, AccountReadCache>());
  const profileStatsDirty = useRef(new Set<string>());
  const accountId = account?.id ?? null;

  useEffect(() => {
    friendsRequestRevision.current += 1;
    setUnreadMessageCount(0);
  }, [accountId]);

  const readCacheFor = useCallback((userId: string) => {
    let cache = readCaches.current.get(userId);
    if (!cache) {
      cache = emptyAccountReadCache();
      readCaches.current.set(userId, cache);
    }
    return cache;
  }, []);

  const markCompetitionCompleted = useCallback(() => {
    if (!accountId) return;
    const cache = readCacheFor(accountId);
    cache.revision += 1;
    cache.historyByPage.clear();
    cache.historyRequests.clear();
    expireReadCache(cache.events);
    expireReadCache(cache.achievements);
    expireReadCache(cache.ownRecordHighlights);
    expireReadCache(cache.scoreLeaderboardPosition);
    cache.recordsByFilter.forEach(expireReadCache);
    cache.scoreLeaderboards.forEach(expireReadCache);
    profileStatsDirty.current.add(accountId);
  }, [accountId, readCacheFor]);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ account: AccountProfile | null }>('/api/auth/me');
      setAccount(result.account);
      return true;
    } catch {
      // Falha transitória de rede não deve desconectar uma conta já carregada.
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfileIfStale = useCallback(async () => {
    if (!accountId || !profileStatsDirty.current.has(accountId)) return true;
    const refreshed = await refresh();
    if (refreshed && accountId === account?.id) profileStatsDirty.current.delete(accountId);
    return refreshed;
  }, [account?.id, accountId, refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api<{ account: AccountProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    readCaches.current.delete(result.account.id);
    profileStatsDirty.current.delete(result.account.id);
    setAccount(result.account);
    return result.account;
  }, []);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    await api<{ message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    });
  }, []);

  const logout = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (subscription) {
          await api('/api/account/push/subscription', {
            method: 'DELETE',
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          }).catch(() => undefined);
          await subscription.unsubscribe();
        }
      } catch {
        // Logging out should still work if push cleanup is unavailable.
      }
    }
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    if (accountId) {
      readCaches.current.delete(accountId);
      profileStatsDirty.current.delete(accountId);
    }
    setAccount(null);
  }, [accountId]);

  const updateProfile = useCallback(async (patch: Partial<Pick<AccountProfile, 'displayName' | 'bio' | 'avatarKey' | 'avatarBackgroundKey' | 'avatarFrameKey' | 'nameStyleKey' | 'coverKey' | 'favoriteCrestId'>>) => {
    const result = await api<{ account: AccountProfile }>('/api/account/profile', { method: 'PATCH', body: JSON.stringify(patch) });
    setAccount(result.account);
    if (accountId && patch.avatarFrameKey !== undefined) {
      const cache = readCacheFor(accountId);
      cache.revision += 1;
      expireReadCache(cache.events);
    }
    return result.account;
  }, [accountId, readCacheFor]);

  const getHistory = useCallback(async (page = 1) => {
    const cache = accountId ? readCacheFor(accountId) : null;
    const cached = cache?.historyByPage.get(page);
    if (cached) return cached;
    const revision = cache?.revision;
    const request = cache?.historyRequests.get(page) ?? api<CompetitionHistoryPage>(`/api/account/history?page=${encodeURIComponent(String(page))}`);
    if (cache && !cache.historyRequests.has(page)) cache.historyRequests.set(page, request);
    try {
      const result = await request;
      if (cache && cache.revision === revision) cache.historyByPage.set(page, result);
      return result;
    } finally {
      if (cache?.historyRequests.get(page) === request) cache.historyRequests.delete(page);
    }
  }, [accountId, readCacheFor]);

  const peekHistory = useCallback((page = 1) => {
    return accountId ? readCacheFor(accountId).historyByPage.get(page) ?? null : null;
  }, [accountId, readCacheFor]);

  const getSoloCampaign = useCallback(async () => {
    const result = await api<{ campaign: SoloSave<unknown> | null }>('/api/account/solo-campaign');
    return result.campaign;
  }, []);

  const saveSoloCampaign = useCallback(async (save: SoloSave<unknown>) => {
    const result = await api<{ campaign: SoloSave<unknown> }>('/api/account/solo-campaign', {
      method: 'PUT',
      body: JSON.stringify(save),
    });
    return result.campaign;
  }, []);

  const deleteSoloCampaign = useCallback(async () => {
    await api('/api/account/solo-campaign', { method: 'DELETE' });
  }, []);

  const saveHistory = useCallback(async (payload: Parameters<AccountContextValue['saveHistory']>[0]) => {
    let result: { id: string; duplicate: boolean; achievementsUnlocked?: AchievementUnlock[]; framesUnlocked?: FrameUnlock[]; eventCardsUnlocked?: EventCardUnlock[]; albumGrants?: ItemGrant[] } | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await api<{ id: string; duplicate: boolean; achievementsUnlocked?: AchievementUnlock[]; framesUnlocked?: FrameUnlock[]; eventCardsUnlocked?: EventCardUnlock[]; albumGrants?: ItemGrant[] }>('/api/account/history', { method: 'POST', body: JSON.stringify(payload) });
        break;
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        const retryable = status === undefined || status >= 500;
        if (!retryable || attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 400 : 1200));
      }
    }
    if (!result) throw new Error('Não foi possível confirmar o salvamento da competição.');
    markCompetitionCompleted();
    return result;
  }, [markCompetitionCompleted]);

  const peekOwnAchievements = useCallback(() => {
    return accountId ? readCacheFor(accountId).achievements?.value ?? null : null;
  }, [accountId, readCacheFor]);

  const getOwnAchievements = useCallback(async (since?: number) => {
    const cache = accountId ? readCacheFor(accountId) : null;
    const entry = cache ? (cache.achievements ??= { updatedAt: 0 }) : null;
    if (!since && isReadCacheFresh(entry)) return { ...entry.value, recentlyUnlocked: [] };
    if (!since && entry?.request) return entry.request as Promise<AchievementsPayload & { recentlyUnlocked: AchievementUnlock[] }>;
    const revision = cache?.revision;
    const query = since ? `?since=${encodeURIComponent(String(since))}` : '';
    const request = api<AchievementsPayload & { recentlyUnlocked: AchievementUnlock[] }>(`/api/account/achievements${query}`);
    let pending = request;
    if (!since && entry) {
      pending = request.then(result => {
        if (cache && cache.revision === revision) {
          entry.value = { achievements: result.achievements, rarity: result.rarity, showcase: result.showcase };
          entry.updatedAt = Date.now();
        }
        return result;
      });
      entry.request = pending;
    }
    try {
      return await pending;
    } finally {
      if (!since && entry?.request === pending) entry.request = undefined;
    }
  }, [accountId, readCacheFor]);

  const [eventCards, setEventCards] = useState<string[]>([]);
  const peekEvents = useCallback(() => {
    return accountId ? readCacheFor(accountId).events?.value ?? null : null;
  }, [accountId, readCacheFor]);

  const getEvents = useCallback(async (forceRefresh = false) => {
    const cache = accountId ? readCacheFor(accountId) : null;
    const entry = cache ? (cache.events ??= { updatedAt: 0 }) : null;
    if (!forceRefresh && isReadCacheFresh(entry)) {
      setEventCards(entry.value.eventCards ?? []);
      return entry.value;
    }
    if (!forceRefresh && entry?.request) return entry.request;
    const revision = cache?.revision;
    const request = api<EventsPayload>('/api/account/events');
    if (entry) entry.request = request;
    try {
      const payload = await request;
      if (cache && cache.revision === revision && entry && entry.request === request) {
        entry.value = payload;
        entry.updatedAt = Date.now();
      }
      if ((!cache || cache.revision === revision) && (!entry || entry.request === request)) setEventCards(payload.eventCards ?? []);
      return payload;
    } finally {
      if (entry?.request === request) entry.request = undefined;
    }
  }, [accountId, readCacheFor]);
  const chooseEventOption = useCallback(async (eventId: string, choice: string) => {
    const payload = await api<EventsPayload>(`/api/account/events/${encodeURIComponent(eventId)}/choice`, { method: 'POST', body: JSON.stringify({ choice }) });
    setEventCards(payload.eventCards ?? []);
    if (accountId) {
      const cache = readCacheFor(accountId);
      cache.revision += 1;
      const entry = cache.events ??= { updatedAt: 0 };
      entry.value = payload;
      entry.updatedAt = Date.now();
      entry.request = undefined;
    }
    return payload;
  }, [accountId, readCacheFor]);
  // The account's exclusive cards feed its draft and Única pack offers in solo games.
  const accountKey = account?.id ?? null;
  useEffect(() => {
    if (!accountKey) { setEventCards([]); return; }
    void getEvents().catch(() => undefined);
  }, [accountKey, getEvents]);

  const updateShowcase = useCallback(async (items: ShowcaseItem[]) => {
    const result = await api<{ showcase: AchievementsPayload['showcase'] }>('/api/account/showcase', { method: 'PUT', body: JSON.stringify({ items }) });
    if (accountId) {
      const cache = readCacheFor(accountId);
      cache.revision += 1;
      const entry = cache.achievements;
      if (entry?.value) {
        entry.value = { ...entry.value, showcase: result.showcase };
        entry.updatedAt = Date.now();
      }
    }
    return result.showcase;
  }, [accountId, readCacheFor]);

  const recordsCacheKey = useCallback((filters: { category?: string; difficulty?: string; season?: number } = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.season !== undefined) params.set('season', String(filters.season));
    return params.toString();
  }, []);

  const peekRecords = useCallback((filters: { category?: string; difficulty?: string; season?: number } = {}) => {
    return accountId ? readCacheFor(accountId).recordsByFilter.get(recordsCacheKey(filters))?.value ?? null : null;
  }, [accountId, readCacheFor, recordsCacheKey]);

  const getRecords = useCallback(async (filters: { category?: string; difficulty?: string; season?: number } = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.season !== undefined) params.set('season', String(filters.season));
    const cache = accountId ? readCacheFor(accountId) : null;
    const key = recordsCacheKey(filters);
    const entry = cache?.recordsByFilter.get(key);
    if (isReadCacheFresh(entry)) return entry.value;
    if (entry?.request) return entry.request;
    const revision = cache?.revision;
    const request = api<{ records: PublicRecordEntry[] }>(`/api/records${params.toString() ? `?${params}` : ''}`).then(result => result.records);
    const read = entry ?? { updatedAt: 0 };
    if (cache) { read.request = request; cache.recordsByFilter.set(key, read); }
    try {
      const records = await request;
      if (cache && cache.revision === revision) {
        read.value = records;
        read.updatedAt = Date.now();
      }
      return records;
    } finally {
      if (read.request === request) read.request = undefined;
    }
  }, [accountId, readCacheFor, recordsCacheKey]);

  const peekOwnRecordHighlights = useCallback(() => {
    return accountId ? readCacheFor(accountId).ownRecordHighlights?.value ?? null : null;
  }, [accountId, readCacheFor]);

  const getOwnRecordHighlights = useCallback(async () => {
    const cache = accountId ? readCacheFor(accountId) : null;
    const entry = cache?.ownRecordHighlights;
    if (isReadCacheFresh(entry)) return entry.value;
    if (entry?.request) return entry.request;
    const revision = cache?.revision;
    const request = api<{ records: ProfileRecordEntry[] }>('/api/account/records').then(result => result.records);
    const read = entry ?? { updatedAt: 0 };
    if (cache) { read.request = request; cache.ownRecordHighlights = read; }
    try {
      const records = await request;
      if (cache && cache.revision === revision) {
        read.value = records;
        read.updatedAt = Date.now();
      }
      return records;
    } finally {
      if (read.request === request) read.request = undefined;
    }
  }, [accountId, readCacheFor]);

  const peekScoreLeaderboard = useCallback((difficulty?: RankedDifficultyId | null, season?: number) => {
    const key = `${difficulty ?? 'all'}:${season ?? 'current'}`;
    return accountId ? readCacheFor(accountId).scoreLeaderboards.get(key)?.value ?? null : null;
  }, [accountId, readCacheFor]);

  const getScoreLeaderboard = useCallback(async (difficulty?: RankedDifficultyId | null, season?: number) => {
    const params = new URLSearchParams();
    if (difficulty) params.set('difficulty', difficulty);
    if (season !== undefined) params.set('season', String(season));
    const query = params.toString() ? `?${params}` : '';
    const cache = accountId ? readCacheFor(accountId) : null;
    const key = `${difficulty ?? 'all'}:${season ?? 'current'}`;
    const entry = cache?.scoreLeaderboards.get(key);
    if (isReadCacheFresh(entry)) return entry.value;
    if (entry?.request) return entry.request;
    if (cache) {
      cache.revision += 1;
      expireReadCache(cache.scoreLeaderboardPosition);
    }
    const revision = cache?.revision;
    const request = api<{ ranking: ScoreLeaderboardEntry[] }>(`/api/leaderboards/score${query}`).then(result => result.ranking);
    const read = entry ?? { updatedAt: 0 };
    if (cache) { read.request = request; cache.scoreLeaderboards.set(key, read); }
    try {
      const ranking = await request;
      if (cache && cache.revision === revision) {
        read.value = ranking;
        read.updatedAt = Date.now();
      }
      return ranking;
    } finally {
      if (read.request === request) read.request = undefined;
    }
  }, [accountId, readCacheFor]);

  const peekScoreLeaderboardPosition = useCallback(() => {
    return accountId ? readCacheFor(accountId).scoreLeaderboardPosition?.value ?? null : null;
  }, [accountId, readCacheFor]);

  const getScoreLeaderboardPosition = useCallback(async () => {
    const cache = accountId ? readCacheFor(accountId) : null;
    const entry = cache?.scoreLeaderboardPosition;
    if (isReadCacheFresh(entry)) return entry.value;
    if (entry?.request) return entry.request;
    const revision = cache?.revision;
    const request = api<ScoreLeaderboardPosition>('/api/account/leaderboards/score-position');
    const read = entry ?? { updatedAt: 0 };
    if (cache) cache.scoreLeaderboardPosition = read;
    read.request = request;
    try {
      const result = await request;
      if (cache && cache.revision === revision) {
        read.value = result;
        read.updatedAt = Date.now();
      }
      return result;
    } finally {
      if (read.request === request) read.request = undefined;
    }
  }, [accountId, readCacheFor]);

  // The viewer's position and prize in one season (not cached: it is read once per season pick).
  const getSeasonStanding = useCallback((season: number) => {
    return api<ScoreLeaderboardPosition>(`/api/account/leaderboards/score-position?season=${season}`);
  }, []);

  const claimSeasonReward = useCallback(async (season: number) => {
    const result = await api<{ reward: SeasonRewardEntry }>('/api/account/seasons/claim', { method: 'POST', body: JSON.stringify({ season }) });
    return result.reward;
  }, []);

  const getPublicProfile = useCallback(async (username: string) => {
    return api<PublicProfileData>(`/api/users/${encodeURIComponent(username)}`);
  }, []);

  const likeProfile = useCallback(async (username: string, like: boolean) => {
    return api<{ liked: boolean; likeCount: number }>(`/api/users/${encodeURIComponent(username)}/like`, { method: like ? 'PUT' : 'DELETE' });
  }, []);

  const lastFriends = useRef<{ accountId: string; list: FriendshipEntry[] } | null>(null);
  const peekFriends = useCallback(() => (accountId && lastFriends.current?.accountId === accountId ? lastFriends.current.list : null), [accountId]);
  const getFriends = useCallback(async () => {
    const requestRevision = ++friendsRequestRevision.current;
    const result = await api<{ friends: FriendshipEntry[] }>('/api/account/friends');
    if (accountId) lastFriends.current = { accountId, list: result.friends };
    if (accountId && requestRevision === friendsRequestRevision.current) {
      setUnreadMessageCount(result.friends.reduce((total, friendship) =>
        total + (friendship.status === 'accepted' ? Number(friendship.unread_message_count ?? 0) : 0), 0));
    }
    return result.friends;
  }, [accountId]);

  // Right after sign-in, in idle moments, reads what the account screens show (events, achievements, rankings,
  // history, friends) so the first visit to each one has its data on hand instead of loading in front of the player.
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const quiet = (request: Promise<unknown>) => request.catch(() => undefined);
      const season = currentSeason();
      void Promise.all([
        quiet(getEvents()), quiet(getOwnAchievements()), quiet(getOwnRecordHighlights()), quiet(getScoreLeaderboardPosition()),
        quiet(getScoreLeaderboard(null, season)), quiet(getHistory(1)), quiet(getRecords({ difficulty: 'immortal', season })), quiet(getFriends()),
      ]);
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [accountId, getEvents, getOwnAchievements, getOwnRecordHighlights, getScoreLeaderboardPosition, getScoreLeaderboard, getHistory, getRecords, getFriends]);

  useEffect(() => {
    if (!accountId || typeof navigator === 'undefined') return;
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'friend-message-received') void getFriends().catch(() => undefined);
    };
    navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
  }, [accountId, getFriends]);

  const setPresence = useCallback(async (presenceId: string, status: 'available' | 'busy' | 'away', revision: number, statusChanged = false) => {
    await api('/api/account/presence', {
      method: 'POST',
      body: JSON.stringify({ presenceId, status, revision, statusChanged }),
    });
  }, []);

  const getRoomInvitations = useCallback(async () => {
    const result = await api<{ invitations: RoomInvitationEntry[] }>('/api/account/room-invitations');
    return result.invitations;
  }, []);

  const inviteFriendToRoom = useCallback(async (roomCode: string, friendshipId: string) => {
    return api<{ duplicate: boolean; expiresAt: number }>(`/api/realtime/rooms/${encodeURIComponent(roomCode)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ friendshipId }),
    });
  }, []);

  const respondToRoomInvitation = useCallback(async (id: string, action: 'accept' | 'decline') => {
    return api<{ roomCode?: string }>(`/api/account/room-invitations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  }, []);

  const sendFriendRequest = useCallback(async (username: string) => {
    await api('/api/account/friends', { method: 'POST', body: JSON.stringify({ username }) });
  }, []);

  const updateFriendship = useCallback(async (id: string, action: 'accept' | 'decline' | 'block' | 'remove') => {
    await api(`/api/account/friends/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action }) });
  }, []);

  const value = useMemo<AccountContextValue>(() => ({
    account, loading, unreadMessageCount, refresh, refreshProfileIfStale, markCompetitionCompleted, login, register, logout, updateProfile, getHistory, peekHistory, getSoloCampaign, saveSoloCampaign, deleteSoloCampaign, saveHistory, getOwnAchievements, peekOwnAchievements, getEvents, peekEvents, chooseEventOption, eventCards, updateShowcase, getRecords, peekRecords, getOwnRecordHighlights, peekOwnRecordHighlights, getScoreLeaderboard, peekScoreLeaderboard, getSeasonStanding, claimSeasonReward, getScoreLeaderboardPosition, peekScoreLeaderboardPosition, getPublicProfile, likeProfile,
    getFriends, peekFriends, setPresence, getRoomInvitations, inviteFriendToRoom, respondToRoomInvitation, sendFriendRequest, updateFriendship,
  }), [account, loading, unreadMessageCount, refresh, refreshProfileIfStale, markCompetitionCompleted, login, register, logout, updateProfile, getHistory, peekHistory, getSoloCampaign, saveSoloCampaign, deleteSoloCampaign, saveHistory, getOwnAchievements, peekOwnAchievements, getEvents, peekEvents, chooseEventOption, eventCards, updateShowcase, getRecords, peekRecords, getOwnRecordHighlights, peekOwnRecordHighlights, getScoreLeaderboard, peekScoreLeaderboard, getSeasonStanding, claimSeasonReward, getScoreLeaderboardPosition, peekScoreLeaderboardPosition, getPublicProfile, likeProfile, getFriends, peekFriends, setPresence, getRoomInvitations, inviteFriendToRoom, respondToRoomInvitation, sendFriendRequest, updateFriendship]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount deve ser usado dentro de AccountProvider');
  return context;
}
