/**
 * The one audio context the interface sounds and the music share (the match keeps its own),
 * with one limiter on the way out. Browsers keep a context suspended until the player taps
 * or presses a key: it is unlocked on the first of those, and `whenRunning` lets anything
 * that must not start before then (the music) wait for it.
 */

/** Presses and releases that count as the player's first interaction (iOS wants the release of the touch). */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'] as const;

let context: AudioContext | null = null;
let limiter: DynamicsCompressorNode | null = null;
let unlockInstalled = false;
const runningWaiters: Array<() => void> = [];

function flushWaiters(): void {
  if (!context || context.state !== 'running') return;
  while (runningWaiters.length) runningWaiters.shift()!();
}

/** The shared context (null where Web Audio is unavailable). Created on first use. */
export function getAudioContext(): AudioContext | null {
  if (context) return context;
  const Ctor = typeof window !== 'undefined'
    ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    : undefined;
  if (!Ctor) return null;
  try { context = new Ctor(); } catch { return null; }
  // A limiter on the way out: several sounds at once, or a loud reveal over the music, never distort.
  limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  limiter.connect(context.destination);
  context.addEventListener('statechange', flushWaiters);
  return context;
}

/** Where sounds are plugged in: the limiter in front of the speakers. */
export function getOutput(): AudioNode | null {
  getAudioContext();
  return limiter;
}

/** Resolves once the context is running (immediately if it already is). */
export function whenRunning(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return new Promise(() => undefined);
  if (ctx.state === 'running') return Promise.resolve();
  return new Promise(resolve => runningWaiters.push(resolve));
}

/** Starts the context on the first tap or key (the browsers' rule). Safe to call more than once. */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state !== 'running') void ctx.resume().then(flushWaiters).catch(() => undefined);
    if (ctx && ctx.state === 'running') {
      for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
    }
  };
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);
}
