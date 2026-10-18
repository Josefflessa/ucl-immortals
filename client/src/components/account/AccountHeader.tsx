import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setNavSlot } from '../../lib/navSlot';
import { Bell, BellOff, BellRing, Check, Coins, LoaderCircle, Sparkles, X } from 'lucide-react';
import { api, useAccount, type FriendshipEntry } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { useGame } from '../../contexts/GameContext';
import { getProfileAvatarBackground } from '@shared/profileAppearance';
import { isWeekendCompetitionCoinBonusActive } from '@shared/game/competitionRanking';
import { clubOfRewardKey } from '@shared/game/clubRewards';
import { cn } from '../../lib/utils';
import { resolveProfileAvatarImage } from '../../lib/profileAvatars';
import { Button, EmptyState, GameModal, StatusBanner } from '../../design-system';
import StyledName from './StyledName';
import FramedAvatar from './AvatarFrame';
import { EventsHomeButton } from './GameEvents';
import DailyRewardsHomeButton from './DailyRewards';
import SoundControl from './SoundControl';

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

type PushStatus = 'idle' | 'loading' | 'unsupported' | 'unconfigured' | 'blocked' | 'enabled' | 'disabled' | 'error';

function decodeApplicationServerKey(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

/** Shared account header for home and account-facing screens. */
export default function AccountHeader() {
  const { account, getEvents, getFriends, updateFriendship } = useAccount();
  const { album } = useAlbum();
  const { state, dispatch } = useGame();
  const [friendships, setFriendships] = useState<FriendshipEntry[]>([]);
  const [pendingEvents, setPendingEvents] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState('');
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const [pushConfig, setPushConfig] = useState<{ enabled: boolean; publicKey: string | null } | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [weekendBonusActive, setWeekendBonusActive] = useState(() => isWeekendCompetitionCoinBonusActive());
  const [pushError, setPushError] = useState('');
  const pushSubscription = useRef<PushSubscription | null>(null);

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

  const refreshPushSettings = useCallback(async () => {
    setPushError('');
    if (typeof window === 'undefined'
      || !window.isSecureContext
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
      || !('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }

    setPushStatus('loading');
    try {
      const config = await api<{ enabled: boolean; publicKey: string | null }>('/api/account/push/subscription');
      setPushConfig(config);
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      pushSubscription.current = current;
      if (!config.enabled || !config.publicKey) setPushStatus('unconfigured');
      else if (Notification.permission === 'denied') setPushStatus('blocked');
      else if (current) {
        // Rebind the same browser subscription to the account currently signed
        // in; this also refreshes stale keys and the device's last-seen time.
        await api('/api/account/push/subscription', {
          method: 'PUT',
          body: JSON.stringify(current.toJSON()),
        });
        setPushStatus('enabled');
      }
      else setPushStatus('disabled');
    } catch (error) {
      setPushStatus('error');
      setPushError(error instanceof Error ? error.message : 'Não foi possível carregar as notificações neste dispositivo.');
    }
  }, []);

  const enablePush = async () => {
    if (!pushConfig?.enabled || !pushConfig.publicKey || pushBusy) return;
    setPushBusy(true);
    setPushError('');
    try {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPushStatus(permission === 'denied' ? 'blocked' : 'disabled');
          return;
        }
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(pushConfig.publicKey) as BufferSource,
      });
      try {
        await api('/api/account/push/subscription', {
          method: 'PUT',
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch (error) {
        await subscription.unsubscribe().catch(() => undefined);
        throw error;
      }
      pushSubscription.current = subscription;
      setPushStatus('enabled');
    } catch (error) {
      setPushStatus('error');
      setPushError(error instanceof Error ? error.message : 'Não foi possível ativar as notificações push.');
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError('');
    try {
      const subscription = pushSubscription.current ?? await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (subscription) {
        await api('/api/account/push/subscription', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const unsubscribed = await subscription.unsubscribe();
        if (!unsubscribed) throw new Error('Não foi possível desativar as notificações neste dispositivo.');
      }
      pushSubscription.current = null;
      setPushStatus(pushConfig?.enabled ? 'disabled' : 'unconfigured');
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Não foi possível desativar as notificações push.');
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    if (account) void refreshPushSettings();
  }, [account?.id, refreshPushSettings]);

  useEffect(() => {
    const refreshWeekendBonus = () => setWeekendBonusActive(isWeekendCompetitionCoinBonusActive());
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshWeekendBonus();
    };
    const interval = window.setInterval(refreshWeekendBonus, 60_000);
    window.addEventListener('focus', refreshWeekendBonus);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWeekendBonus);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (notificationsOpen) void refreshPushSettings();
  }, [notificationsOpen, refreshPushSettings]);

  useEffect(() => {
    if (!account || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const destination = url.searchParams.get('open');
    if (destination !== 'notifications' && destination !== 'friends') return;
    url.searchParams.delete('open');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (destination === 'notifications') {
      setNotificationError('');
      setNotificationsOpen(true);
      void refresh();
    } else {
      dispatch({ type: 'SET_ACCOUNT_SECTION', section: 'friends' });
    }
  }, [account?.id, dispatch, refresh]);

  if (!account) return null;

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-[var(--ui-line-subtle)] bg-[var(--ui-bg-raised)]/95 backdrop-blur-md"
      >
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1280px] items-center justify-between gap-2 px-3 sm:min-h-[80px] sm:px-5">
          <button
            type="button"
            aria-label="Logo UCL Immortals"
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 'menu' })}
            className="hidden shrink-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] xl:order-1 xl:flex"
          >
            <img src="/icons/logo_ucl.png" alt="" className="size-10 object-contain" />
            <span className="font-display text-[1.45rem] leading-none tracking-[0.1em] text-[var(--ui-text)]">UCL <span className="text-[var(--ui-brand-strong)]">IMMORTALS</span></span>
          </button>
          <div ref={setNavSlot} className="hidden min-w-0 flex-1 items-center justify-center xl:order-2 xl:flex" />
          <div className="flex shrink-0 items-center gap-1.5 xl:order-3 xl:gap-0.5 xl:rounded-full xl:border xl:border-[var(--ui-line-subtle)] xl:bg-[var(--ui-surface)] xl:p-1 xl:[&_button]:border-transparent xl:[&_button]:bg-transparent xl:[&_button]:hover:bg-[var(--ui-surface-3)]">
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
            <SoundControl />
          </div>
          <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-[var(--ui-line-subtle)] xl:order-3 xl:ml-4 xl:block" />

          <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 xl:order-4 xl:ml-4">
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

      {weekendBonusActive && state.phase === 'menu' ? (
        <div className="px-3 pt-3 sm:px-5 sm:pt-4">
          <section
            role="status"
            aria-label="Bônus de fim de semana: moedas em dobro ao concluir competições"
            className="relative isolate mx-auto flex w-full max-w-[1280px] items-center gap-2.5 overflow-hidden rounded-2xl border border-[var(--ui-brand)]/45 bg-gradient-to-r from-[var(--ui-brand)]/10 via-[var(--ui-surface)] to-[var(--ui-brand)]/5 px-2.5 py-3 shadow-[0_8px_28px_rgba(234,199,68,0.08)] sm:gap-4 sm:px-4 sm:py-3.5"
          >
            <span aria-hidden="true" className="absolute -right-8 -top-12 -z-10 size-36 rounded-full bg-[var(--ui-brand)]/10 blur-2xl" />
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--ui-brand)]/30 bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] sm:size-11">
              <Coins size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-1 flex items-center gap-1 text-[9px] font-extrabold uppercase leading-none tracking-[0.16em] text-[var(--ui-brand-strong)] sm:text-[10px]">
                <Sparkles size={11} aria-hidden="true" /> Bônus de fim de semana
              </span>
              <span className="block text-sm font-extrabold leading-tight text-[var(--ui-text)] sm:text-base">Moedas em dobro!</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--ui-text-muted)] sm:text-xs">Conclua competições e ganhe o dobro.</span>
            </span>
            <span className="inline-flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-[var(--ui-brand-strong)] bg-[var(--ui-brand-strong)] px-1 text-[var(--ui-bg)] shadow-[0_3px_12px_rgba(232,200,74,0.22)] sm:h-14 sm:w-16">
              <span className="font-display text-2xl font-black leading-none sm:text-[1.7rem]">×2</span>
              <span className="mt-1 text-[9px] font-black uppercase leading-none tracking-[0.1em] sm:text-[10px]">moedas</span>
            </span>
          </section>
        </div>
      ) : null}

      <GameModal open={notificationsOpen} onOpenChange={setNotificationsOpen} title="NOTIFICAÇÕES" subtitle="Avisos e solicitações da sua conta." size="wide">
        <div className="space-y-3">
          <section className="flex flex-col gap-3 rounded-xl border border-[var(--ui-brand)]/25 bg-[var(--ui-brand)]/5 p-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Notificações push neste dispositivo">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ui-brand)]/15 text-[var(--ui-brand-strong)]">
                {pushStatus === 'loading' || pushBusy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : pushStatus === 'enabled' ? <BellRing size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--ui-text)]">Notificações neste dispositivo</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--ui-text-muted)]">
                  {pushStatus === 'enabled' ? 'Ativadas. Você receberá avisos de amizade, mensagens, convites para partidas e propostas de troca.'
                    : pushStatus === 'disabled' ? 'Desativadas. Ative para receber avisos mesmo com o jogo fechado.'
                      : pushStatus === 'blocked' ? 'A permissão foi bloqueada no navegador. Altere a permissão do site nas configurações do navegador.'
                        : pushStatus === 'unconfigured' ? 'O envio de push ainda não foi configurado no servidor.'
                          : pushStatus === 'unsupported' ? 'Este navegador ou dispositivo não oferece suporte a notificações push neste contexto.'
                            : pushStatus === 'error' ? 'Não foi possível carregar a configuração de notificações.'
                              : 'Você escolhe se quer receber avisos fora do jogo. A permissão só será solicitada ao ativar.'}
                </p>
              </div>
            </div>
            {pushStatus === 'enabled' || ((pushStatus === 'unconfigured' || pushStatus === 'blocked') && pushSubscription.current) ? (
              <Button type="button" intent="ghost" loading={pushBusy} disabled={pushBusy} onClick={() => void disablePush()} className="w-full shrink-0 text-xs sm:w-auto">DESATIVAR</Button>
            ) : pushStatus === 'disabled' ? (
              <Button type="button" intent="primary" loading={pushBusy} disabled={pushBusy} onClick={() => void enablePush()} className="w-full shrink-0 text-xs sm:w-auto">ATIVAR NESTE DISPOSITIVO</Button>
            ) : pushStatus === 'error' ? (
              <Button type="button" intent="ghost" disabled={pushBusy} onClick={() => void refreshPushSettings()} className="w-full shrink-0 text-xs sm:w-auto">TENTAR NOVAMENTE</Button>
            ) : null}
          </section>
          {pushError ? <StatusBanner tone="danger" role="alert">{pushError}</StatusBanner> : null}
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
