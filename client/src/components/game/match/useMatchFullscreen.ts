import { useCallback, useEffect, useRef, useState } from 'react';

type Platform = 'android' | 'desktop' | null;

/**
 * Where the pitch can go full screen: Android phones and tablets, turned to landscape (the
 * one mobile platform where a page can both go full screen and lock the orientation), and
 * computers with a mouse (already landscape). iPhone and iPad are left out for now.
 */
function fullscreenPlatform(): Platform {
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    return typeof (screen.orientation as ScreenOrientation & { lock?: unknown } | undefined)?.lock === 'function' ? 'android' : null;
  }
  // iPadOS reports itself as a Mac: tell it apart by its touch screen.
  const apple = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return !apple && window.matchMedia('(pointer: fine)').matches ? 'desktop' : null;
}

/** Full screen for the match's pitch (see fullscreenPlatform); `supported` false hides the button. */
export function useMatchFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isFull, setIsFull] = useState(false);
  const [platform] = useState(fullscreenPlatform);
  const supported = platform !== null;

  // The system back gesture (or any other exit) leaves full screen without us.
  useEffect(() => {
    const sync = () => setIsFull(!!ref.current && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el || document.fullscreenElement) return;
    try {
      await el.requestFullscreen({ navigationUI: 'hide' });
      // A phone turns to landscape. Best effort: the pitch still fills the screen if refused.
      if (platform === 'android') {
        await (screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock('landscape').catch(() => {});
      }
    } catch {
      /* refused (no user gesture, a policy): stay as we are */
    }
  }, [platform]);

  const exit = useCallback(() => {
    if (platform === 'android') { try { screen.orientation.unlock(); } catch { /* not locked */ } }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [platform]);

  // Leaving the match page in full screen: give the screen back.
  useEffect(() => () => { if (document.fullscreenElement) exit(); }, [exit]);

  return { ref, supported, isFull, enter, exit };
}
