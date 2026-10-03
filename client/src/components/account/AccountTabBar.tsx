import { Clock3, House, Trophy, UserRound, Users } from 'lucide-react';
import { Button } from '../../design-system';
import type { AccountSection } from '../../contexts/GameContext';
import { cn } from '../../lib/utils';

type AccountNavigationTab = 'home' | AccountSection;

interface AccountTabBarProps {
  active: AccountNavigationTab | null;
  incomingFriendRequestCount?: number;
  onNavigate: (tab: AccountNavigationTab) => void;
}

const NAV_ITEMS: Array<{ id: AccountNavigationTab; label: string; ariaLabel: string; icon: typeof House }> = [
  { id: 'home', label: 'INÍCIO', ariaLabel: 'Ir para o início', icon: House },
  { id: 'profile', label: 'PERFIL', ariaLabel: 'Abrir perfil', icon: UserRound },
  { id: 'history', label: 'HISTÓRICO', ariaLabel: 'Abrir histórico', icon: Clock3 },
  { id: 'records', label: 'RANKINGS', ariaLabel: 'Abrir rankings', icon: Trophy },
  { id: 'friends', label: 'AMIGOS', ariaLabel: 'Abrir amigos', icon: Users },
];

export default function AccountTabBar({ active, incomingFriendRequestCount = 0, onNavigate }: AccountTabBarProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-2 pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map(({ id, label, ariaLabel, icon: Icon }) => {
          const selected = active === id;
          const accessibleLabel = id === 'friends' && incomingFriendRequestCount > 0
            ? `Abrir amigos, ${incomingFriendRequestCount} ${incomingFriendRequestCount === 1 ? 'solicitação recebida' : 'solicitações recebidas'}`
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
                'flex h-14 flex-col gap-1 rounded-lg px-0 text-[9px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]',
                selected && 'bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] hover:text-[var(--ui-brand-strong)]',
              )}
            >
              <span className="relative inline-flex size-4 items-center justify-center">
                <Icon size={16} aria-hidden="true" />
                {id === 'friends' && incomingFriendRequestCount > 0 ? (
                  <span aria-hidden="true" className="absolute -right-2 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--ui-surface)] bg-[var(--ui-danger)] px-1 text-[9px] font-bold leading-none tabular-nums text-white">
                    {incomingFriendRequestCount > 9 ? '9+' : incomingFriendRequestCount}
                  </span>
                ) : null}
              </span>
              {label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
