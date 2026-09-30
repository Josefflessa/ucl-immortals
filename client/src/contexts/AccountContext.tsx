import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

export interface AccountProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarKey: string;
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
  player_name: string;
  player_photo_url: string | null;
  value: number;
  username_snapshot: string;
  team_name_snapshot: string;
  crest_id_snapshot: string | null;
  created_at: number;
}

export interface FriendshipEntry {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  requester_id: string;
  addressee_id: string;
  requester_username: string;
  requester_display_name: string;
  requester_avatar_key: string;
  addressee_username: string;
  addressee_display_name: string;
  addressee_avatar_key: string;
  created_at: number;
  updated_at: number;
}

interface AccountContextValue {
  account: AccountProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  loginWithGoogle: (returnTo?: string) => void;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<AccountProfile, 'username' | 'displayName' | 'bio' | 'avatarKey' | 'coverKey' | 'favoriteCrestId'>>) => Promise<AccountProfile>;
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
  getFriends: () => Promise<FriendshipEntry[]>;
  sendFriendRequest: (username: string) => Promise<void>;
  updateFriendship: (id: string, action: 'accept' | 'decline' | 'block' | 'remove') => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null) as { message?: string; error?: string } & T;
  if (!response.ok) throw new Error(body?.message || body?.error || 'Não foi possível concluir essa ação.');
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

  const loginWithGoogle = useCallback((returnTo = '/') => {
    const path = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
    window.location.assign(`/api/auth/google/start?returnTo=${encodeURIComponent(path)}`);
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    setAccount(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Pick<AccountProfile, 'username' | 'displayName' | 'bio' | 'avatarKey' | 'coverKey' | 'favoriteCrestId'>>) => {
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

  const getFriends = useCallback(async () => {
    const result = await api<{ friends: FriendshipEntry[] }>('/api/account/friends');
    return result.friends;
  }, []);

  const sendFriendRequest = useCallback(async (username: string) => {
    await api('/api/account/friends', { method: 'POST', body: JSON.stringify({ username }) });
  }, []);

  const updateFriendship = useCallback(async (id: string, action: 'accept' | 'decline' | 'block' | 'remove') => {
    await api(`/api/account/friends/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action }) });
  }, []);

  const value = useMemo<AccountContextValue>(() => ({
    account, loading, refresh, loginWithGoogle, logout, updateProfile, getHistory, saveHistory, getRecords,
    getFriends, sendFriendRequest, updateFriendship,
  }), [account, loading, refresh, loginWithGoogle, logout, updateProfile, getHistory, saveHistory, getRecords, getFriends, sendFriendRequest, updateFriendship]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount deve ser usado dentro de AccountProvider');
  return context;
}
