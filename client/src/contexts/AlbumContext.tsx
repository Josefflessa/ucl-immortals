// UCL Immortals — the account's album on the client: its state (stickers, inventory,
// coins), the actions (open, apply a copy, sell, buy), the album level of each card
// (read by PlayerCard), and the packs just granted (shown by AlbumGrantsPrompt). The server does
// every change and answers with the whole state, which simply replaces this one.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { levelForCopies, pageBonusSnapshotForOwnedCards, type AlbumItemKey, type AlbumLevel, type AlbumPageBonus } from '@shared/game/album';
import type { Rarity } from '@shared/game/gameData';
import { api, useAccount } from './AccountContext';

export type GrantSource = 'campaign' | 'page' | 'shop' | 'achievement';
export interface ItemGrant {
  key: AlbumItemKey;
  source: GrantSource;
  competitionId?: string;
  pageId?: string;
  coinsAwarded?: number;
  achievementId?: string;
  achievementLevel?: number;
}
export interface PageReward { pageId: string; frameKey: string | null; coverKey: string | null; items: AlbumItemKey[]; recompleted: boolean }
export interface OpenResult { item: AlbumItemKey; cards: { id: string; isNew: boolean }[]; pageRewards: PageReward[] }
export interface BannerDraw { card: { id: string; isNew: boolean }; rarity: Rarity; pityTriggered: boolean }
export interface BannerBatchResult { cards: BannerDraw[]; dayStart: string; price: number; pageRewards: PageReward[] }

export interface StickerState { copies: number; spare: number }

export interface AlbumState {
  coins: number;
  bannerPity: { daily: number; weekly: number };
  inventory: Partial<Record<AlbumItemKey, number>>;
  stickers: ReadonlyMap<string, StickerState>;
  completedPages: ReadonlySet<string>;
  pageCompletionCounts: Readonly<Record<string, number>>;
  covers: string[];
}

interface AlbumPayload {
  coins: number;
  bannerPity?: { daily: number; weekly: number };
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
  refreshIfStale: () => Promise<void>;
  /** Current account levels, freshly loaded if needed, for freezing a new competition. */
  captureCompetitionLevels: () => Promise<ReadonlyMap<string, AlbumLevel>>;
  /** Star levels and complete-page bonuses, captured together before a solo draft. */
  captureCompetitionSnapshot: () => Promise<{
    levels: ReadonlyMap<string, AlbumLevel>;
    pageBonuses: ReadonlyMap<string, AlbumPageBonus>;
  }>;
  open: (item: AlbumItemKey) => Promise<OpenResult>;
  applyCopy: (cardId: string, quantity?: number) => Promise<void>;
  sell: (cardId: string, quantity: number) => Promise<number>;
  sellBatch: (sales: readonly { cardId: string; quantity: number }[]) => Promise<{ coins: number; copies: number }>;
  buyPack: (tier: string, quantity?: number) => Promise<void>;
  buyFrame: (frameKey: string) => Promise<{ frameKey: string; price: number }>;
  buyCover: (coverKey: string) => Promise<{ coverKey: string; price: number }>;
  buyNameStyle: (styleKey: string) => Promise<{ styleKey: string; price: number }>;
  buyDailyBannerCard: () => Promise<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[]; pityTriggered: boolean }>;
  buyWeeklyBannerCard: () => Promise<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[]; pityTriggered: boolean }>;
  buyDailyBannerCards: (quantity: number) => Promise<BannerBatchResult>;
  buyWeeklyBannerCards: (quantity: number) => Promise<BannerBatchResult>;
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
  banner_purchase_in_progress: 'Seu sorteio já está sendo processado. Aguarde um instante.',
  not_for_sale: 'Este item não está à venda.',
};

const AlbumContext = createContext<AlbumContextValue | null>(null);

/** Album levels by card id. The provider gives the account's own; a view of someone else's cards can override it (empty). */
const AlbumLevelsContext = createContext<ReadonlyMap<string, AlbumLevel>>(new Map());
const AlbumPageBonusesContext = createContext<ReadonlyMap<string, AlbumPageBonus>>(new Map());
const NO_LEVELS: ReadonlyMap<string, AlbumLevel> = new Map();

function albumLevelsFromStickers(stickers: ReadonlyMap<string, StickerState> | undefined): ReadonlyMap<string, AlbumLevel> {
  if (!stickers) return NO_LEVELS;
  const map = new Map<string, AlbumLevel>();
  stickers.forEach((sticker, id) => {
    const level = levelForCopies(sticker.copies);
    if (level >= 1) map.set(id, level as AlbumLevel);
  });
  return map;
}

export function AlbumProvider({ children }: { children: ReactNode }) {
  const { account, eventCards } = useAccount();
  const accountKey = account?.id ?? null;
  const eventCardKey = eventCards.join('\u0000');
  const [album, setAlbum] = useState<AlbumState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingGrants, setPendingGrants] = useState<ItemGrant[]>([]);
  const albumRef = useRef<AlbumState | null>(null);
  const albumLoadedAt = useRef(0);
  const activeAccountKey = useRef(accountKey);
  const observedAccountKey = useRef(accountKey);
  activeAccountKey.current = accountKey;
  const refreshRequest = useRef<{ accountKey: string; promise: Promise<void> } | null>(null);

  const receiveGrants = useCallback((grants: readonly ItemGrant[] | undefined) => {
    if (grants && grants.length > 0) setPendingGrants(current => [...current, ...grants]);
  }, []);

  /** Takes a server answer: the new state, and any grants it reports. */
  const apply = useCallback((payload: AlbumPayload) => {
    const next: AlbumState = {
      coins: payload.coins,
      bannerPity: payload.bannerPity ?? albumRef.current?.bannerPity ?? { daily: 0, weekly: 0 },
      inventory: payload.inventory,
      stickers: new Map(payload.stickers.map(([id, copies, spare]) => [id, { copies, spare }])),
      completedPages: new Set(payload.completedPages),
      pageCompletionCounts: payload.pageCompletionCounts ?? {},
      covers: payload.covers ?? albumRef.current?.covers ?? [],
    };
    albumRef.current = next;
    albumLoadedAt.current = Date.now();
    setAlbum(next);
    receiveGrants(payload.grants);
    return payload;
  }, [receiveGrants]);

  const refresh = useCallback(async () => {
    if (!accountKey) return;
    const requestedAccount = accountKey;
    if (refreshRequest.current?.accountKey === requestedAccount) return refreshRequest.current.promise;
    if (!albumRef.current) setLoading(true);
    const requestRecord = { accountKey: requestedAccount, promise: Promise.resolve() };
    const promise = (async () => {
      try {
        const payload = await api<AlbumPayload>('/api/account/album');
        if (activeAccountKey.current === requestedAccount) {
          apply(payload);
          setError(null);
        }
      } catch (cause) {
        if (activeAccountKey.current === requestedAccount) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o álbum.');
        }
      } finally {
        if (activeAccountKey.current === requestedAccount) setLoading(false);
        if (refreshRequest.current === requestRecord) refreshRequest.current = null;
      }
    })();
    requestRecord.promise = promise;
    refreshRequest.current = requestRecord;
    return promise;
  }, [accountKey, apply]);

  const refreshIfStale = useCallback(async () => {
    if (albumRef.current && Date.now() - albumLoadedAt.current < 30_000) return;
    await refresh();
  }, [refresh]);

  const captureCompetitionLevels = useCallback(async (): Promise<ReadonlyMap<string, AlbumLevel>> => {
    if (!accountKey) return NO_LEVELS;
    let stickers = album?.stickers;
    if (!stickers) {
      setLoading(true);
      try {
        const payload = await api<AlbumPayload>('/api/account/album');
        apply(payload);
        setError(null);
        stickers = new Map(payload.stickers.map(([id, copies, spare]) => [id, { copies, spare }]));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Não foi possível carregar o Álbum.';
        setError(message);
        throw cause;
      } finally {
        setLoading(false);
      }
    }
    return albumLevelsFromStickers(stickers);
  }, [accountKey, album, apply]);

  const captureCompetitionSnapshot = useCallback(async () => {
    if (!accountKey) return { levels: NO_LEVELS, pageBonuses: new Map<string, AlbumPageBonus>() as ReadonlyMap<string, AlbumPageBonus> };
    let currentStickers = album?.stickers;
    if (!currentStickers) {
      setLoading(true);
      try {
        const payload = await api<AlbumPayload>('/api/account/album');
        apply(payload);
        setError(null);
        currentStickers = new Map(payload.stickers.map(([id, copies, spare]) => [id, { copies, spare }]));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Não foi possível carregar o Álbum.';
        setError(message);
        throw cause;
      } finally {
        setLoading(false);
      }
    }
    const levels = albumLevelsFromStickers(currentStickers);
    const ownedIds = new Set(Array.from(currentStickers.entries())
      .filter(([, sticker]) => sticker.copies > 0)
      .map(([id]) => id));
    const pageBonuses = pageBonusSnapshotForOwnedCards(ownedIds);
    return { levels, pageBonuses: new Map(Object.entries(pageBonuses)) as ReadonlyMap<string, AlbumPageBonus> };
  }, [accountKey, album, apply]);

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
      activeAccountKey.current = null;
      observedAccountKey.current = null;
      albumRef.current = null;
      albumLoadedAt.current = 0;
      refreshRequest.current = null;
      setAlbum(null);
      setLoading(false);
      setPendingGrants([]);
      return;
    }
    if (observedAccountKey.current !== accountKey) {
      observedAccountKey.current = accountKey;
      albumRef.current = null;
      albumLoadedAt.current = 0;
      setAlbum(null);
    }
    void refresh();
  }, [accountKey, eventCardKey, refresh]);

  useEffect(() => {
    if (!accountKey || typeof document === 'undefined') return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshIfStale();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [accountKey, refreshIfStale]);

  const levels = useMemo<ReadonlyMap<string, AlbumLevel>>(() => albumLevelsFromStickers(album?.stickers), [album]);
  const pageBonuses = useMemo<ReadonlyMap<string, AlbumPageBonus>>(() => {
    if (!album?.stickers) return new Map();
    const ownedIds = new Set(Array.from(album.stickers.entries())
      .filter(([, sticker]) => sticker.copies > 0)
      .map(([id]) => id));
    return new Map(Object.entries(pageBonusSnapshotForOwnedCards(ownedIds)));
  }, [album]);

  const value = useMemo<AlbumContextValue>(() => ({
    album,
    loading,
    error,
    refresh,
    refreshIfStale,
    captureCompetitionLevels,
    captureCompetitionSnapshot,
    open: item => post<OpenResult>('open', { item }),
    applyCopy: async (cardId, quantity = 1) => { await post('apply', { cardId, quantity }); },
    sell: async (cardId, quantity) => (await post<{ coins: number }>('sell', { cardId, quantity })).coins,
    sellBatch: sales => post<{ coins: number; copies: number }>('sell-batch', { sales }),
    buyPack: async (tier, quantity = 1) => { await post('buy-pack', { tier, quantity }); },
    buyFrame: frameKey => post<{ frameKey: string; price: number }>('buy-frame', { frameKey }),
    buyCover: coverKey => post<{ coverKey: string; price: number }>('buy-cover', { coverKey }),
    buyNameStyle: styleKey => post<{ styleKey: string; price: number }>('buy-name-style', { styleKey }),
    buyDailyBannerCard: async () => post<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[]; pityTriggered: boolean }>('buy-daily-banner', {}),
    buyWeeklyBannerCard: async () => post<{ card: { id: string; isNew: boolean }; rarity: Rarity; dayStart: string; price: number; pageRewards: PageReward[]; pityTriggered: boolean }>('buy-weekly-banner', {}),
    buyDailyBannerCards: quantity => post<BannerBatchResult>('buy-daily-banner-batch', { quantity }),
    buyWeeklyBannerCards: quantity => post<BannerBatchResult>('buy-weekly-banner-batch', { quantity }),
    pendingGrants,
    receiveGrants,
    dismissGrants: () => setPendingGrants([]),
  }), [album, loading, error, refresh, refreshIfStale, captureCompetitionLevels, captureCompetitionSnapshot, post, pendingGrants, receiveGrants]);

  return (
    <AlbumContext.Provider value={value}>
      <AlbumLevelsContext.Provider value={levels}>
        <AlbumPageBonusesContext.Provider value={pageBonuses}>{children}</AlbumPageBonusesContext.Provider>
      </AlbumLevelsContext.Provider>
    </AlbumContext.Provider>
  );
}

export function useAlbum(): AlbumContextValue {
  const value = useContext(AlbumContext);
  if (!value) throw new Error('useAlbum must be used inside AlbumProvider');
  return value;
}

/** The album level (★1–★5) of a card for the cards shown here; undefined when absent. */
export function useAlbumLevel(cardId: string): AlbumLevel | undefined {
  return useContext(AlbumLevelsContext).get(cardId);
}

/** Current account's card levels, used for the next competition snapshot and visuals. */
export function useAlbumLevels(): ReadonlyMap<string, AlbumLevel> {
  return useContext(AlbumLevelsContext);
}

/** Current account's completed-page bonus for each card. */
export function useAlbumPageBonuses(): ReadonlyMap<string, AlbumPageBonus> {
  return useContext(AlbumPageBonusesContext);
}

/** Wraps a view of someone else's cards (an opponent's squad): no album levels there. */
export function WithoutAlbumLevels({ children }: { children: ReactNode }) {
  return <AlbumLevelsContext.Provider value={NO_LEVELS}>{children}</AlbumLevelsContext.Provider>;
}
