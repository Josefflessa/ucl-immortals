// UCL Immortals — the account's album on the client: its state (stickers, inventory,
// coins), the actions (open, apply a copy, sell, buy), the album level of each card
// (read by PlayerCard), and the packs just granted (shown by AlbumGrantsPrompt). The server does
// every change and answers with the whole state, which simply replaces this one.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { levelForCopies, type AlbumItemKey, type AlbumLevel } from '@shared/game/album';
import type { Rarity } from '@shared/game/gameData';
import { api, useAccount } from './AccountContext';

export type GrantSource = 'campaign' | 'page' | 'shop';
export interface ItemGrant { key: AlbumItemKey; source: GrantSource; competitionId?: string; pageId?: string; coinsAwarded?: number }
export interface PageReward { pageId: string; frameKey: string | null; coverKey: string | null; items: AlbumItemKey[]; recompleted: boolean }
export interface OpenResult { item: AlbumItemKey; cards: { id: string; isNew: boolean }[]; pageRewards: PageReward[] }

export interface StickerState { copies: number; spare: number }

export interface AlbumState {
  coins: number;
  inventory: Partial<Record<AlbumItemKey, number>>;
  stickers: ReadonlyMap<string, StickerState>;
  completedPages: ReadonlySet<string>;
  pageCompletionCounts: Readonly<Record<string, number>>;
  covers: string[];
}

interface AlbumPayload {
  coins: number;
  inventory: Partial<Record<AlbumItemKey, number>>;
  stickers: [string, number, number][];
  completedPages: string[];
  pageCompletionCounts?: Record<string, number>;
  covers?: string[];
  grants: ItemGrant[];
  result?: unknown;
}

interface AlbumContextValue {
  /** Null for guests and until the first load. */
  album: AlbumState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  open: (item: AlbumItemKey) => Promise<OpenResult>;
  applyCopy: (cardId: string) => Promise<void>;
  sell: (cardId: string, quantity: number) => Promise<number>;
  buyPack: (tier: string) => Promise<void>;
  buyFrame: (frameKey: string) => Promise<{ frameKey: string; price: number }>;
  buyCover: (coverKey: string) => Promise<{ coverKey: string; price: number }>;
  buyNameStyle: (styleKey: string) => Promise<{ styleKey: string; price: number }>;
  buyDailyBannerCard: () => Promise<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[] }>;
  buyWeeklyBannerCard: () => Promise<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[] }>;
  /** Campaign rewards not yet acknowledged (the prompt offers to open granted packs or keep them). */
  pendingGrants: ItemGrant[];
  receiveGrants: (grants: readonly ItemGrant[] | undefined) => void;
  dismissGrants: () => void;
}

/** The server's album error codes, for people. */
const ERROR_MESSAGES: Record<string, string> = {
  item_not_owned: 'Este pacote já foi aberto.',
  no_spare_copy: 'Você não tem cópias extras desta carta.',
  max_level: 'Esta carta já está no nível máximo.',
  not_enough_coins: 'Moedas insuficientes.',
  already_owned: 'Você já possui este item.',
  banner_unavailable: 'Este banner está temporariamente indisponível.',
  not_for_sale: 'Este item não está à venda.',
};

const AlbumContext = createContext<AlbumContextValue | null>(null);

/** Album levels by card id. The provider gives the account's own; a view of someone else's cards can override it (empty). */
const AlbumLevelsContext = createContext<ReadonlyMap<string, AlbumLevel>>(new Map());
const NO_LEVELS: ReadonlyMap<string, AlbumLevel> = new Map();

export function AlbumProvider({ children }: { children: ReactNode }) {
  const { account, eventCards } = useAccount();
  const accountKey = account?.id ?? null;
  const eventCardKey = eventCards.join('\u0000');
  const [album, setAlbum] = useState<AlbumState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingGrants, setPendingGrants] = useState<ItemGrant[]>([]);

  const receiveGrants = useCallback((grants: readonly ItemGrant[] | undefined) => {
    if (grants && grants.length > 0) setPendingGrants(current => [...current, ...grants]);
  }, []);

  /** Takes a server answer: the new state, and any grants it reports. */
  const apply = useCallback((payload: AlbumPayload) => {
    setAlbum(current => ({
      coins: payload.coins,
      inventory: payload.inventory,
      stickers: new Map(payload.stickers.map(([id, copies, spare]) => [id, { copies, spare }])),
      completedPages: new Set(payload.completedPages),
      pageCompletionCounts: payload.pageCompletionCounts ?? {},
      covers: payload.covers ?? current?.covers ?? [],
    }));
    receiveGrants(payload.grants);
    return payload;
  }, [receiveGrants]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      apply(await api<AlbumPayload>('/api/account/album'));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o álbum.');
    } finally {
      setLoading(false);
    }
  }, [apply]);

  const post = useCallback(async <T,>(action: string, body: Record<string, unknown>): Promise<T> => {
    let response: AlbumPayload;
    try {
      response = await api<AlbumPayload>(`/api/account/album/${action}`, { method: 'POST', body: JSON.stringify(body) });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      throw new Error(ERROR_MESSAGES[message] ?? (message || 'Não foi possível concluir agora.'));
    }
    const payload = apply(response);
    return payload.result as T;
  }, [apply]);

  // Loaded with the account (its levels show on its cards everywhere).
  useEffect(() => {
    if (!accountKey) {
      setAlbum(null);
      setPendingGrants([]);
      return;
    }
    void refresh();
  }, [accountKey, eventCardKey, refresh]);

  const levels = useMemo<ReadonlyMap<string, AlbumLevel>>(() => {
    if (!album) return NO_LEVELS;
    const map = new Map<string, AlbumLevel>();
    album.stickers.forEach((sticker, id) => {
      const level = levelForCopies(sticker.copies);
      if (level >= 2) map.set(id, level as AlbumLevel);
    });
    return map;
  }, [album]);

  const value = useMemo<AlbumContextValue>(() => ({
    album,
    loading,
    error,
    refresh,
    open: item => post<OpenResult>('open', { item }),
    applyCopy: async cardId => { await post('apply', { cardId }); },
    sell: async (cardId, quantity) => (await post<{ coins: number }>('sell', { cardId, quantity })).coins,
    buyPack: async tier => { await post('buy-pack', { tier }); },
    buyFrame: frameKey => post<{ frameKey: string; price: number }>('buy-frame', { frameKey }),
    buyCover: coverKey => post<{ coverKey: string; price: number }>('buy-cover', { coverKey }),
    buyNameStyle: styleKey => post<{ styleKey: string; price: number }>('buy-name-style', { styleKey }),
    buyDailyBannerCard: async () => post<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[] }>('buy-daily-banner', {}),
    buyWeeklyBannerCard: async () => post<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[] }>('buy-weekly-banner', {}),
    pendingGrants,
    receiveGrants,
    dismissGrants: () => setPendingGrants([]),
  }), [album, loading, error, refresh, post, pendingGrants, receiveGrants]);

  return (
    <AlbumContext.Provider value={value}>
      <AlbumLevelsContext.Provider value={levels}>{children}</AlbumLevelsContext.Provider>
    </AlbumContext.Provider>
  );
}

export function useAlbum(): AlbumContextValue {
  const value = useContext(AlbumContext);
  if (!value) throw new Error('useAlbum must be used inside AlbumProvider');
  return value;
}

/** The album level (★2–★5) of a card for the cards shown here; undefined for ★1 or none. */
export function useAlbumLevel(cardId: string): AlbumLevel | undefined {
  return useContext(AlbumLevelsContext).get(cardId);
}

/** The current account's card levels, for syncing its visual cosmetics with an online team. */
export function useAlbumLevels(): ReadonlyMap<string, AlbumLevel> {
  return useContext(AlbumLevelsContext);
}

/** Wraps a view of someone else's cards (an opponent's squad): no album levels there. */
export function WithoutAlbumLevels({ children }: { children: ReactNode }) {
  return <AlbumLevelsContext.Provider value={NO_LEVELS}>{children}</AlbumLevelsContext.Provider>;
}
