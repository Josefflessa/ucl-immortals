/**
 * Lets a screen ask the app to hide its usual top bar (the account header) while the screen
 * stands alone, like the room options of the multiplayer menu. Counted, so overlapping asks
 * cannot leave the bar hidden by mistake.
 */

import { useEffect, useSyncExternalStore } from 'react';

let hiders = 0;
const listeners = new Set<() => void>();

function change(delta: number): void {
  hiders = Math.max(0, hiders + delta);
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** True while some screen has asked for the top bar to be hidden. */
export function useChromeHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hiders > 0, () => false);
}

/** Hides the top bar for as long as `hidden` is true and the component is mounted. */
export function useHideChrome(hidden: boolean): void {
  useEffect(() => {
    if (!hidden) return undefined;
    change(1);
    return () => change(-1);
  }, [hidden]);
}
