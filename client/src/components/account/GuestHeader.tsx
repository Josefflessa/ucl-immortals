import { UserRound } from 'lucide-react';
import { setNavSlot } from '../../lib/navSlot';
import { Button } from '../../design-system';
import { useGame } from '../../contexts/GameContext';
import AccountTabBar from './AccountTabBar';
import SoundControl from './SoundControl';

/**
 * The top bar of someone without an account, on a wide screen: the same shape as the signed-in
 * one (brand, navigation, sound) with the places that need an account shown locked, and the
 * sign-in button where the coins and the avatar would be. Phones keep the plain home screen.
 */
export default function GuestHeader() {
  const { dispatch } = useGame();
  const toLogin = () => dispatch({ type: 'SET_PHASE', phase: 'account' });
  return (
    <header className="sticky top-0 z-30 hidden border-b border-[var(--ui-line-subtle)] bg-[var(--ui-bg-raised)]/95 backdrop-blur-md xl:block">
      <div className="mx-auto flex min-h-[80px] w-full max-w-[1280px] items-center justify-between gap-2 px-5">
        <div className="flex shrink-0 items-center gap-3">
          <img src="/icons/logo_ucl.png" alt="" className="size-10 object-contain" />
          <span className="font-display text-[1.45rem] leading-none tracking-[0.1em] text-[var(--ui-text)]">UCL <span className="text-[var(--ui-brand-strong)]">IMMORTALS</span></span>
        </div>
        <div ref={setNavSlot} className="flex min-w-0 flex-1 items-center justify-center" />
        <AccountTabBar guest active="home" onNavigate={tab => { if (tab !== 'home') toLogin(); }} />
        <div className="flex shrink-0 items-center gap-2">
          <SoundControl />
          <Button type="button" intent="ghost" onClick={toLogin} className="min-h-10 border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/90 px-4 text-xs">
            <UserRound size={15} aria-hidden="true" /> ENTRAR
          </Button>
        </div>
      </div>
    </header>
  );
}
