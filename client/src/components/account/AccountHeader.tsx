import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Coins, X } from 'lucide-react';
import { useAccount, type FriendshipEntry } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { useGame } from '../../contexts/GameContext';
import { getProfileAvatarBackground } from '@shared/profileAppearance';
import { clubOfRewardKey } from '@shared/game/clubRewards';
import { cn } from '../../lib/utils';
import { resolveProfileAvatarImage } from '../../lib/profileAvatars';
import { Button, EmptyState, GameModal, StatusBanner } from '../../design-system';
import StyledName from './StyledName';
import FramedAvatar from './AvatarFrame';
import { EventsHomeButton } from './GameEvents';
import DailyRewardsHomeButton from './DailyRewards';

function incomingIdentity(friendship: FriendshipEntry, accountId: string) {
  return friendship.requester_id === accountId
    ? { username: friendship.addressee_username, displayName: friendship.addressee_display_name, nameStyleKey: friendship.addressee_name_style_key }
    : { username: friendship.requester_username, displayName: friendship.requester_display_name, nameStyleKey: friendship.requester_name_style_key };
}

function compactCoins(value: number): string {
  const units: Array<{ limit: number; divisor: number; suffix: string }> = [
    { limit: 1_000_000_000_000, divisor: 1_000_000_000_000, suffix: ' tri' },
    { limit: 1_000_000_000, divisor: 1_000_000_000, suffix: ' bi' },
    { limit: 1_000_000, divisor: 1_000_000, suffix: ' mi' },
    { limit: 1_000, divisor: 1_000, suffix: ' mil' },
  ];
  const unit = units.find(candidate => value >= candidate.limit);
  if (!unit) return value.toLocaleString('pt-BR');
  const scaled = value / unit.divisor;
  const digits = scaled >= 100 || Number.isInteger(scaled) ? 0 : 1;
  return `${scaled.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })}${unit.suffix}`;
}

/** Shared account header for home and account-facing screens. */
export default function AccountHeader() {
  const { account, getEvents, getFriends, updateFriendship } = useAccount();
  const { album } = useAlbum();
  const { dispatch } = useGame();
  const [friendships, setFriendships] = useState<FriendshipEntry[]>([]);
  const [pendingEvents, setPendingEvents] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState('');

  const refresh = useCallback(async () => {
    if (!account) return;
    const [friendsResult, eventsResult] = await Promise.allSettled([getFriends(), getEvents()]);
    if (friendsResult.status === 'fulfilled') setFriendships(friendsResult.value);
    if (eventsResult.status === 'fulfilled') {
      setPendingEvents(eventsResult.value.events.filter(event => event.status === 'active' && !event.completed).length);
    }
  }, [account, getEvents, getFriends]);

  useEffect(() => {
    if (!account) {
      setFriendships([]);
      setPendingEvents(0);
      return;
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    refreshWhenVisible();
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [account?.id, refresh]);

  const incomingRequests = useMemo(() => account
    ? friendships.filter(friendship => friendship.status === 'pending' && friendship.addressee_id === account.id)
    : [], [account, friendships]);
  const avatarImage = account ? account.avatarUrl || resolveProfileAvatarImage(account.avatarKey) : null;
  const exactCoins = album?.coins ?? null;

  const handleFriendRequest = async (friendshipId: string, action: 'accept' | 'decline') => {
    setActionId(friendshipId);
    setNotificationError('');
    try {
      await updateFriendship(friendshipId, action);
      await refresh();
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Não foi possível atualizar a solicitação.');
    } finally {
      setActionId(null);
    }
  };

  if (!account) return null;

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-[var(--ui-line-subtle)] bg-[var(--ui-bg-raised)]/95 backdrop-blur-md"
      >
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1280px] items-center justify-between gap-2 px-3 sm:min-h-[80px] sm:px-5">
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              intent="ghost"
              aria-label={incomingRequests.length > 0 ? `Solicitações de amizade, ${incomingRequests.length} pendentes` : 'Notificações'}
              title="Notificações"
              onClick={() => { setNotificationError(''); setNotificationsOpen(true); void refresh(); }}
              className="relative size-10 min-h-10 w-10 justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)] p-0 sm:size-11 sm:min-h-11 sm:w-11"
            >
              <Bell size={18} aria-hidden="true" />
              {incomingRequests.length > 0 ? <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--ui-bg)] bg-[var(--ui-danger)] px-1 text-[10px] font-bold leading-none tabular-nums text-white">{incomingRequests.length > 9 ? '9+' : incomingRequests.length}</span> : null}
            </Button>
            <EventsHomeButton pending={pendingEvents} onOpen={() => dispatch({ type: 'SET_PHASE', phase: 'events' })} />
            <DailyRewardsHomeButton />
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_PHASE', phase: 'store' })}
              disabled={exactCoins === null}
              aria-label={exactCoins === null ? 'Saldo de moedas carregando' : `Saldo: ${exactCoins.toLocaleString('pt-BR')} moedas. Abrir loja`}
              title={exactCoins === null ? 'Carregando saldo' : `${exactCoins.toLocaleString('pt-BR')} moedas`}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--ui-brand)]/30 bg-[var(--ui-surface)] px-2.5 text-[var(--ui-brand-strong)] transition-colors hover:border-[var(--ui-brand)]/60 hover:bg-[var(--ui-surface-2)] disabled:opacity-60 sm:h-11 sm:gap-2 sm:px-3"
            >
              <Coins size={18} aria-hidden="true" />
              <strong className="max-w-[4.8rem] truncate text-xs font-extrabold tabular-nums sm:max-w-[8rem] sm:text-sm">{exactCoins === null ? '—' : compactCoins(exactCoins)}</strong>
            </button>
            <button
              type="button"
              aria-label={`Abrir perfil de ${account.displayName}`}
              title={account.displayName}
              onClick={() => dispatch({ type: 'SET_ACCOUNT_SECTION', section: 'profile' })}
              className="inline-flex shrink-0 items-center justify-center rounded-full p-0 transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)]"
            >
              <FramedAvatar frameKey={account.avatarFrameKey} compact>
                <span
                  aria-hidden="true"
                  className={cn('relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ui-brand)]/60 text-xs font-bold text-[var(--ui-text)] sm:size-11', clubOfRewardKey(account.avatarFrameKey) && 'sm:size-10')}
                  style={{ backgroundColor: getProfileAvatarBackground(account.avatarBackgroundKey).color }}
                >
                  <span hidden={!!avatarImage}>{account.displayName.trim().charAt(0).toUpperCase()}</span>
                  {avatarImage ? <img key={avatarImage} src={avatarImage} alt="" className={cn('absolute inset-0 size-full', account.avatarUrl ? 'object-cover' : 'object-contain')} onError={event => {
                    event.currentTarget.style.display = 'none';
                    const fallback = event.currentTarget.previousElementSibling as HTMLElement | null;
                    if (fallback) fallback.hidden = false;
                  }} /> : null}
                </span>
              </FramedAvatar>
            </button>
          </div>
        </div>
      </header>

      <GameModal open={notificationsOpen} onOpenChange={setNotificationsOpen} title="NOTIFICAÇÕES" subtitle="Avisos e solicitações da sua conta." size="wide">
        <div className="space-y-3">
          {notificationError ? <StatusBanner tone="danger" role="alert">{notificationError}</StatusBanner> : null}
          {incomingRequests.length === 0 ? <EmptyState title="Tudo em dia" description="Não há solicitações pendentes no momento." /> : incomingRequests.map(friendship => {
            const friend = incomingIdentity(friendship, account.id);
            const busy = actionId === friendship.id;
            return (
              <div key={friendship.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)] p-3 sm:flex-nowrap">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ui-brand)]/15 text-sm font-bold text-[var(--ui-brand-strong)]">{friend.displayName.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="min-w-0 max-w-full text-sm font-semibold text-[var(--ui-text)]"><StyledName name={friend.displayName} styleKey={friend.nameStyleKey} size="sm" /></div>
                  <div className="truncate text-xs text-[var(--ui-text-muted)]">@{friend.username} quer adicionar você</div>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button type="button" intent="ghost" disabled={actionId !== null} onClick={() => void handleFriendRequest(friendship.id, 'decline')} className="flex-1 px-3 text-xs sm:flex-none"><X size={14} aria-hidden="true" /> RECUSAR</Button>
                  <Button type="button" intent="primary" loading={busy} disabled={actionId !== null} onClick={() => void handleFriendRequest(friendship.id, 'accept')} className="flex-1 px-3 text-xs sm:flex-none">{!busy ? <Check size={14} aria-hidden="true" /> : null} ACEITAR</Button>
                </div>
              </div>
            );
          })}
        </div>
      </GameModal>
    </>
  );
}
