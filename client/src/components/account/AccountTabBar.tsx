import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { House, Lock, ShoppingBag, Trophy, Users } from 'lucide-react';
import { playSound } from '../../audio/uiSound';
import { useNavSlot, useWideNav } from '../../lib/navSlot';
import { Button } from '../../design-system';
import { useAccount } from '../../contexts/AccountContext';
import type { AccountSection } from '../../contexts/GameContext';
import { cn } from '../../lib/utils';

type AccountNavigationTab = 'home' | 'store' | AccountSection;

interface AccountTabBarProps {
  /** Someone without an account sees the tabs too, with all but the home locked (the caller sends them to the login). Wide screens only. */
  guest?: boolean;
  active: AccountNavigationTab | null;
  incomingFriendRequestCount?: number;
  onNavigate: (tab: AccountNavigationTab) => void;
}

const NAV_ITEMS: Array<{ id: AccountNavigationTab; label: string; ariaLabel: string; icon: typeof House }> = [
  { id: 'home', label: 'INÍCIO', ariaLabel: 'Ir para o início', icon: House },
  { id: 'store', label: 'LOJA', ariaLabel: 'Abrir loja', icon: ShoppingBag },
  { id: 'records', label: 'RANKINGS', ariaLabel: 'Abrir rankings', icon: Trophy },
  { id: 'friends', label: 'AMIGOS', ariaLabel: 'Abrir amigos', icon: Users },
];

export default function AccountTabBar({ active, incomingFriendRequestCount = 0, onNavigate, guest = false }: AccountTabBarProps) {
  const { unreadMessageCount } = useAccount();
  const slot = useNavSlot();
  const wide = useWideNav();
  const friendsBadgeCount = incomingFriendRequestCount + unreadMessageCount;
  // A new friend request or message while you are here gets a soft cue (not what was already waiting).
  const seen = useRef({ requests: incomingFriendRequestCount, messages: unreadMessageCount });
  useEffect(() => {
    if (unreadMessageCount > seen.current.messages) playSound('message');
    else if (incomingFriendRequestCount > seen.current.requests) playSound('notify');
    seen.current = { requests: incomingFriendRequestCount, messages: unreadMessageCount };
  }, [incomingFriendRequestCount, unreadMessageCount]);
  const friendsLabel = [
    incomingFriendRequestCount > 0 ? `${incomingFriendRequestCount} ${incomingFriendRequestCount === 1 ? 'solicitação recebida' : 'solicitações recebidas'}` : '',
    unreadMessageCount > 0 ? `${unreadMessageCount} ${unreadMessageCount === 1 ? 'mensagem não lida' : 'mensagens não lidas'}` : '',
  ].filter(Boolean).join(' e ');
  // Drawn on the page itself, not inside whichever screen asked for it: a screen's own layers (the home's, for one)
  // would otherwise sit above this bar's and put the top bar's glass over it.
  const target = wide ? slot : document.body;
  if (!target) return null;
  return createPortal(
    <nav
      aria-label="Navegação principal"
      className={cn(guest && 'hidden xl:block', 'fixed inset-x-0 bottom-0 z-20 border-t border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] xl:static xl:inset-auto xl:z-auto xl:h-full xl:border-0 xl:bg-transparent xl:p-0')}
    >
      {/* Wide screens: plain text tabs sitting on the header's bottom edge; the current one is underlined in gold. */}
      <div className="mx-auto grid max-w-md grid-cols-4 xl:flex xl:h-full xl:max-w-none xl:gap-8">
        {NAV_ITEMS.map(({ id, label, ariaLabel, icon: Icon }) => {
          const selected = active === id;
          const locked = guest && id !== 'home';
          const accessibleLabel = locked
            ? `${ariaLabel}. Entre na sua conta para usar.`
            : id === 'friends' && friendsBadgeCount > 0
              ? `Abrir amigos, ${friendsLabel}`
              : ariaLabel;

          return (
            <Button
              key={id}
              type="button"
              intent="ghost"
              aria-label={accessibleLabel}
              aria-current={selected ? 'page' : undefined}
              onClick={() => onNavigate(id)}
              className={cn(
                'flex h-14 flex-col gap-1 rounded-lg px-0 text-label text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] xl:relative xl:h-full xl:min-h-0 xl:flex-row xl:gap-2 xl:rounded-none xl:px-0 xl:text-[1.3rem] xl:font-[family-name:var(--font-display)] xl:font-normal xl:uppercase xl:tracking-caps xl:hover:bg-transparent',
                'xl:after:absolute xl:after:inset-x-0 xl:after:bottom-0 xl:after:h-0.5 xl:after:rounded-full xl:after:bg-transparent xl:after:transition-colors',
                selected && 'bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] hover:text-[var(--ui-brand-strong)] xl:bg-transparent xl:text-[var(--ui-text)] xl:hover:text-[var(--ui-text)] xl:after:bg-[var(--ui-brand-strong)]',
              )}
            >
              <span className="relative inline-flex size-4 items-center justify-center xl:hidden">
                <Icon size={16} aria-hidden="true" />
                {id === 'friends' && friendsBadgeCount > 0 ? (
                  <span aria-hidden="true" className="absolute -right-2 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--ui-surface)] bg-[var(--ui-danger)] px-1 text-label font-bold leading-none tabular-nums text-white">
                    {friendsBadgeCount > 9 ? '9+' : friendsBadgeCount}
                  </span>
                ) : null}
              </span>
              {label}
              {id === 'friends' && friendsBadgeCount > 0 ? (
                <span aria-hidden="true" className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ui-danger)] px-1.5 font-ui text-label font-bold leading-none tabular-nums tracking-normal text-white xl:inline-flex">
                  {friendsBadgeCount > 9 ? '9+' : friendsBadgeCount}
                </span>
              ) : null}
              {locked ? <Lock size={12} aria-hidden="true" className="hidden opacity-50 xl:block" /> : null}
            </Button>
          );
        })}
      </div>
    </nav>,
    target,
  );
}
