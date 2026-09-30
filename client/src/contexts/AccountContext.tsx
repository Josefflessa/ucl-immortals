import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Player } from '../lib/gameData';

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

export interface AccountProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarKey: string;
  avatarBackgroundKey: string;
  coverKey: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  favoriteCrestId: string | null;
  createdAt: number;
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
  report: Record<string, unknown>;
  completed_at: number;
}

export interface PublicRecordEntry {
  id: string;
  category: 'goals' | 'assists' | 'saves' | 'effective_overall';
  difficulty_id: string;
  player_id: string;
  player_card?: Player | null;
  player_name: string;
  player_photo_url: string | null;
  value: number;
  username_snapshot: string;
  profile_display_name?: string | null;
  profile_avatar_key?: string | null;
  profile_avatar_background_key?: string | null;
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
}

export interface ProfileRecordEntry {
  category: PublicRecordEntry['category'];
  difficulty_id: string;
  player_id: string;
  player_card?: Player | null;
  rank_position?: number;
  player_name: string;
  player_photo_url: string | null;
  value: number;
  profile_display_name?: string | null;
  profile_avatar_key?: string | null;
  profile_avatar_background_key?: string | null;
  profile_avatar_url?: string | null;
  team_name_snapshot: string;
  crest_id_snapshot: string | null;
  mode: 'solo' | 'online';
  format_id: string;
  completed_at: number;
}

export interface PublicProfileData {
  profile: AccountProfile;
  records: ProfileRecordEntry[];
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
  addressee_username: string;
  addressee_display_name: string;
  addressee_avatar_key: string;
  addressee_avatar_background_key: string;
  created_at: number;
  updated_at: number;
  is_online: boolean;
  is_available: boolean;
  is_busy: boolean;
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
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<AccountProfile>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<AccountProfile, 'displayName' | 'bio' | 'avatarKey' | 'avatarBackgroundKey' | 'coverKey' | 'favoriteCrestId'>>) => Promise<AccountProfile>;
  getHistory: () => Promise<CompetitionHistoryEntry[]>;
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
    sourceKey?: string;
    report: Record<string, unknown>;
    records?: Array<{
      category: PublicRecordEntry['category'];
      playerId: string;
      playerName: string;
      playerPhotoUrl?: string | null;
      value: number;
    }>;
  }) => Promise<{ id: string; duplicate: boolean }>;
  getRecords: (filters?: { category?: string; difficulty?: string }) => Promise<PublicRecordEntry[]>;
  getOwnRecordHighlights: () => Promise<ProfileRecordEntry[]>;
  getScoreLeaderboard: () => Promise<ScoreLeaderboardEntry[]>;
  getScoreLeaderboardPosition: () => Promise<ScoreLeaderboardPosition>;
  getPublicProfile: (username: string) => Promise<PublicProfileData>;
  getFriends: () => Promise<FriendshipEntry[]>;
  setPresence: (presenceId: string, status: 'available' | 'busy' | 'away', revision: number, statusChanged?: boolean) => Promise<void>;
  getRoomInvitations: () => Promise<RoomInvitationEntry[]>;
  inviteFriendToRoom: (roomCode: string, friendshipId: string) => Promise<{ duplicate: boolean; expiresAt: number }>;
  respondToRoomInvitation: (id: string, action: 'accept' | 'decline') => Promise<{ roomCode?: string }>;
  sendFriendRequest: (username: string) => Promise<void>;
  updateFriendship: (id: string, action: 'accept' | 'decline' | 'block' | 'remove') => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
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
    if (body?.message || body?.error) throw new Error(body.message || body.error);
    const isLocal = typeof window !== 'undefined'
      && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocal && response.status >= 500) {
      throw new Error('O servidor local falhou. Confirme se o Worker está rodando com pnpm dev:all.');
    }
    throw new Error(`Não foi possível concluir essa ação (erro ${response.status}).`);
  }
  return body;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ account: AccountProfile | null }>('/api/auth/me');
      setAccount(result.account);
    } catch {
      // A conta é opcional: falha de rede não deve impedir o modo convidado.
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api<{ account: AccountProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
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
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    setAccount(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Pick<AccountProfile, 'displayName' | 'bio' | 'avatarKey' | 'avatarBackgroundKey' | 'coverKey' | 'favoriteCrestId'>>) => {
    const result = await api<{ account: AccountProfile }>('/api/account/profile', { method: 'PATCH', body: JSON.stringify(patch) });
    setAccount(result.account);
    return result.account;
  }, []);

  const getHistory = useCallback(async () => {
    const result = await api<{ history: CompetitionHistoryEntry[] }>('/api/account/history');
    return result.history;
  }, []);

  const saveHistory = useCallback(async (payload: Parameters<AccountContextValue['saveHistory']>[0]) => {
    return api<{ id: string; duplicate: boolean }>('/api/account/history', { method: 'POST', body: JSON.stringify(payload) });
  }, []);

  const getRecords = useCallback(async (filters: { category?: string; difficulty?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    const result = await api<{ records: PublicRecordEntry[] }>(`/api/records${params.toString() ? `?${params}` : ''}`);
    return result.records;
  }, []);

  const getOwnRecordHighlights = useCallback(async () => {
    const result = await api<{ records: ProfileRecordEntry[] }>('/api/account/records');
    return result.records;
  }, []);

  const getScoreLeaderboard = useCallback(async () => {
    const result = await api<{ ranking: ScoreLeaderboardEntry[] }>('/api/leaderboards/score');
    return result.ranking;
  }, []);

  const getScoreLeaderboardPosition = useCallback(async () => {
    return api<ScoreLeaderboardPosition>('/api/account/leaderboards/score-position');
  }, []);

  const getPublicProfile = useCallback(async (username: string) => {
    return api<PublicProfileData>(`/api/users/${encodeURIComponent(username)}`);
  }, []);

  const getFriends = useCallback(async () => {
    const result = await api<{ friends: FriendshipEntry[] }>('/api/account/friends');
    return result.friends;
  }, []);

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
    account, loading, refresh, login, register, logout, updateProfile, getHistory, saveHistory, getRecords, getOwnRecordHighlights, getScoreLeaderboard, getScoreLeaderboardPosition, getPublicProfile,
    getFriends, setPresence, getRoomInvitations, inviteFriendToRoom, respondToRoomInvitation, sendFriendRequest, updateFriendship,
  }), [account, loading, refresh, login, register, logout, updateProfile, getHistory, saveHistory, getRecords, getOwnRecordHighlights, getScoreLeaderboard, getScoreLeaderboardPosition, getPublicProfile, getFriends, setPresence, getRoomInvitations, inviteFriendToRoom, respondToRoomInvitation, sendFriendRequest, updateFriendship]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount deve ser usado dentro de AccountProvider');
  return context;
}
