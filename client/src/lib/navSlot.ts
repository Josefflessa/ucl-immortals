/**
 * The place in the top bar where the main navigation sits on a wide screen: the space between
 * the brand and the icons, so the navigation is centred between the two (not on the window).
 * The top bar registers its empty slot here; the navigation draws itself into it.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** Ref callback for the slot element. */
export function setNavSlot(element: HTMLElement | null): void {
  if (slot === element) return;
  slot = element;
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useNavSlot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => slot, () => null);
}

/** True from 1280px: where the top bar carries the navigation. */
export function useWideNav(): boolean {
  const query = '(min-width: 1280px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}
