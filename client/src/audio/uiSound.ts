/**
 * The interface's sound: every click, tab, dialog, reward and card reveal has a short sound
 * of its own. Nothing is downloaded: each one is synthesised with Web Audio the moment it
 * plays, so there are no files to load, license or keep in sync, and every sound shares one
 * musical key (C major pentatonic) so they never clash when several play close together.
 *
 * Loudness: interface sounds stay low (they are heard hundreds of times); rewards and card
 * reveals are louder and longer (they are the moments worth celebrating), growing with the
 * rarity. Everything passes through one volume control and a limiter.
 */

import { useEffect } from 'react';
import { soundSettings } from './soundSettings';

export type UiSound =
  // Everyday interface
  | 'tap' | 'select' | 'tab' | 'confirm' | 'back' | 'toggleOn' | 'toggleOff'
  // Feedback
  | 'error' | 'success' | 'notify' | 'message'
  // Money and rewards
  | 'coin' | 'spend' | 'claim' | 'achievement'
  // Opening a pack
  | 'packTear' | 'revealBronze' | 'revealSilver' | 'revealGold' | 'revealLegendary' | 'revealImmortal'
  // The title
  | 'champion';

/**
 * Master switch for the interface sounds. Off for now: nothing plays, no click listener is
 * installed and the volume button is hidden (the match keeps its own sounds and mute button).
 * Turn it on to bring everything back; no other code needs to change.
 */
export const UI_SOUNDS_ENABLED = false;

/** Where a sound is drawn: the audio context, the node it feeds and the time it starts. */
interface Voice { ctx: BaseAudioContext; out: AudioNode; t: number; noise: AudioBuffer }

const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77;
const C6 = 1046.5, E6 = 1318.5, G6 = 1568, C7 = 2093;

// ── Building blocks ─────────────────────────────────────────────────────────────

/** Rises quickly to `peak`, then decays exponentially to silence at `dur`. */
function envelope(param: AudioParam, t: number, peak: number, attack: number, dur: number): void {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
}

interface ToneOptions {
  freq: number; dur: number; gain: number;
  type?: OscillatorType; to?: number; at?: number; attack?: number; lowpass?: number;
}

/** One pitched note, optionally gliding to `to` and softened by a low-pass. */
function tone(v: Voice, o: ToneOptions): void {
  const start = v.t + (o.at ?? 0);
  const osc = v.ctx.createOscillator();
  const amp = v.ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, start + o.dur);
  envelope(amp.gain, start, o.gain, o.attack ?? 0.004, o.dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const filter = v.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = o.lowpass;
    osc.connect(filter);
    node = filter;
  }
  node.connect(amp).connect(v.out);
  osc.start(start);
  osc.stop(start + o.dur + 0.05);
}

/** A struck bell: the fundamental plus two inharmonic partials that die away faster. */
function bell(v: Voice, freq: number, gain: number, dur: number, at = 0): void {
  tone(v, { freq, dur, gain, at, attack: 0.003 });
  tone(v, { freq: freq * 2.76, dur: dur * 0.55, gain: gain * 0.28, at, attack: 0.002 });
  tone(v, { freq: freq * 5.4, dur: dur * 0.3, gain: gain * 0.1, at, attack: 0.002 });
}

interface NoiseOptions {
  dur: number; gain: number; at?: number; attack?: number;
  type?: BiquadFilterType; f0: number; f1?: number; q?: number;
}

/** Filtered noise, optionally sweeping its cut-off from `f0` to `f1` (whooshes, clicks, shimmer). */
function noise(v: Voice, o: NoiseOptions): void {
  const start = v.t + (o.at ?? 0);
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  src.loop = true;
  const filter = v.ctx.createBiquadFilter();
  filter.type = o.type ?? 'bandpass';
  filter.Q.value = o.q ?? 0.9;
  filter.frequency.setValueAtTime(o.f0, start);
  if (o.f1) filter.frequency.exponentialRampToValueAtTime(o.f1, start + o.dur);
  const amp = v.ctx.createGain();
  envelope(amp.gain, start, o.gain, o.attack ?? 0.005, o.dur);
  src.connect(filter).connect(amp).connect(v.out);
  src.start(start);
  src.stop(start + o.dur + 0.05);
}

/** A tiny noise tick: the "click" under a button press. */
const click = (v: Voice, at: number, gain: number, f = 4200) => noise(v, { at, dur: 0.014, gain, type: 'highpass', f0: f, attack: 0.001 });

/** Low thump: a sine that drops in pitch, the weight under a card landing or a reveal. */
const thump = (v: Voice, gain: number, at = 0, from = 170, to = 70, dur = 0.16) => tone(v, { freq: from, to, dur, gain, at, attack: 0.003 });

/** A pseudo-random but repeatable sparkle: high bells scattered between two moments. */
function sparkles(v: Voice, count: number, from: number, to: number, gain: number): void {
  const scale = [C7, C7 * 1.122, C7 * 1.26, C7 * 1.5, C7 * 1.68];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const at = from + (to - from) * (i / Math.max(1, count - 1)) + rand() * 0.04;
    bell(v, scale[Math.floor(rand() * scale.length)], gain * (0.6 + rand() * 0.4), 0.35, at);
  }
}

// ── The catalogue ───────────────────────────────────────────────────────────────

const SOUNDS: Record<UiSound, (v: Voice) => void> = {
  // Everyday interface: short, soft and never tiring.
  tap: v => { tone(v, { freq: 1100, to: 760, dur: 0.05, gain: 0.07 }); click(v, 0, 0.025); },
  select: v => { tone(v, { freq: G5, dur: 0.07, gain: 0.07, type: 'triangle' }); tone(v, { freq: C6, dur: 0.1, gain: 0.06, type: 'triangle', at: 0.045 }); },
  tab: v => { tone(v, { freq: 640, to: 470, dur: 0.07, gain: 0.08 }); click(v, 0, 0.02, 2600); },
  confirm: v => { bell(v, C6, 0.075, 0.24); tone(v, { freq: G5, dur: 0.2, gain: 0.06, type: 'triangle', at: 0.05 }); tone(v, { freq: E6, dur: 0.12, gain: 0.035, at: 0.09 }); },
  back: v => { tone(v, { freq: 600, to: 420, dur: 0.09, gain: 0.07 }); click(v, 0, 0.015, 3000); },
  toggleOn: v => { tone(v, { freq: 700, to: 980, dur: 0.09, gain: 0.08 }); click(v, 0, 0.02); },
  toggleOff: v => { tone(v, { freq: 980, to: 640, dur: 0.09, gain: 0.07 }); click(v, 0, 0.015, 3000); },

  // Feedback: each reads at a glance even with the screen out of sight.
  error: v => {
    tone(v, { freq: 174, to: 150, dur: 0.15, gain: 0.06, type: 'square', lowpass: 900 });
    tone(v, { freq: 174, to: 140, dur: 0.18, gain: 0.06, type: 'square', lowpass: 900, at: 0.17 });
  },
  success: v => { bell(v, E5, 0.07, 0.35); bell(v, G5, 0.07, 0.35, 0.07); bell(v, C6, 0.075, 0.45, 0.14); },
  notify: v => { bell(v, E6, 0.06, 0.5); bell(v, C6, 0.055, 0.5, 0.12); },
  message: v => { bell(v, A5, 0.05, 0.25); bell(v, E6, 0.045, 0.3, 0.08); },

  // Money and rewards.
  coin: v => {
    tone(v, { freq: B5, dur: 0.07, gain: 0.08, type: 'triangle' });
    tone(v, { freq: E6, dur: 0.32, gain: 0.08, type: 'triangle', at: 0.065 });
    tone(v, { freq: E6 * 2, dur: 0.16, gain: 0.025, at: 0.065 });
  },
  spend: v => { tone(v, { freq: E6, dur: 0.07, gain: 0.07, type: 'triangle' }); tone(v, { freq: B5, dur: 0.18, gain: 0.07, type: 'triangle', at: 0.06 }); click(v, 0, 0.03); },
  claim: v => {
    [C5, E5, G5, C6, E6].forEach((f, i) => bell(v, f, 0.07, 0.5, i * 0.075));
    noise(v, { at: 0.3, dur: 0.55, gain: 0.018, type: 'highpass', f0: 6000, attack: 0.05 });
  },
  achievement: v => {
    bell(v, C5, 0.085, 0.55); bell(v, G5, 0.075, 0.55);
    bell(v, C6, 0.075, 0.6, 0.12); bell(v, E6, 0.07, 0.6, 0.24); bell(v, G6, 0.07, 0.8, 0.36);
    [C6, E6, G6].forEach(f => bell(v, f, 0.05, 1.1, 0.5));
    tone(v, { freq: 130.8, dur: 0.6, gain: 0.09, at: 0.5 });
    noise(v, { at: 0.5, dur: 0.9, gain: 0.02, type: 'highpass', f0: 5500, attack: 0.08 });
  },

  // Cards: paper and weight, then the reveal grows with the rarity.
  packTear: v => {
    // Paper tearing: crackling noise, its level flickering, with a swish of air under it.
    const start = v.t;
    const src = v.ctx.createBufferSource();
    src.buffer = v.noise;
    src.loop = true;
    const filter = v.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.Q.value = 1;
    filter.frequency.setValueAtTime(2500, start);
    filter.frequency.exponentialRampToValueAtTime(4800, start + 0.55);
    const amp = v.ctx.createGain();
    const flicker = new Float32Array(48);
    let seed = 5;
    for (let i = 0; i < flicker.length; i++) {
      seed = (seed * 16807) % 2147483647;
      flicker[i] = (0.25 + 0.75 * (seed / 2147483647)) * 0.09 * Math.min(1, i / 4) * (1 - i / 60);
    }
    amp.gain.setValueCurveAtTime(flicker, start, 0.55);
    src.connect(filter).connect(amp).connect(v.out);
    src.start(start); src.stop(start + 0.6);
    noise(v, { dur: 0.5, gain: 0.035, type: 'highpass', f0: 1500, f1: 6000, attack: 0.1 });
  },
  revealBronze: v => { thump(v, 0.13); bell(v, G5, 0.05, 0.3, 0.02); },
  revealSilver: v => { thump(v, 0.14); bell(v, C6, 0.065, 0.55, 0.02); bell(v, E6, 0.045, 0.5, 0.08); },
  revealGold: v => {
    thump(v, 0.16);
    [C6, E6, G6].forEach((f, i) => bell(v, f, 0.07, 0.9, 0.02 + i * 0.06));
    noise(v, { at: 0.1, dur: 0.6, gain: 0.02, type: 'highpass', f0: 6000, attack: 0.05 });
  },
  revealLegendary: v => {
    tone(v, { freq: 60, to: 95, dur: 0.5, gain: 0.15, attack: 0.15 });
    noise(v, { dur: 0.45, gain: 0.06, f0: 800, f1: 5000, q: 0.7, attack: 0.3 });
    [C6, E6, G6, C7].forEach(f => bell(v, f, 0.07, 1.5, 0.42));
    sparkles(v, 4, 0.6, 1.1, 0.04);
    thump(v, 0.18, 0.42, 120, 50, 0.3);
  },
  revealImmortal: v => {
    thump(v, 0.2, 0, 90, 40, 0.5);
    noise(v, { dur: 0.8, gain: 0.08, f0: 400, f1: 8000, q: 0.6, attack: 0.6 });
    tone(v, { freq: 110, to: 440, dur: 0.8, gain: 0.07, type: 'triangle', attack: 0.5 });
    [C5, G5, C6, E6, G6, C7].forEach(f => bell(v, f, 0.07, 2.3, 0.82));
    tone(v, { freq: 65.4, dur: 1.4, gain: 0.17, at: 0.82 });
    sparkles(v, 9, 1.0, 2.3, 0.045);
    noise(v, { at: 0.82, dur: 1.8, gain: 0.03, type: 'highpass', f0: 5000, attack: 0.1 });
  },

  // Results and social.
  champion: v => {
    [0, 0.12, 0.24].forEach(at => { tone(v, { freq: G5, dur: 0.11, gain: 0.07, type: 'triangle', at }); tone(v, { freq: G5, dur: 0.11, gain: 0.03, type: 'square', at, lowpass: 2400 }); });
    tone(v, { freq: C6, dur: 0.4, gain: 0.08, type: 'triangle', at: 0.36 });
    [C5, E5, G5, C6, E6].forEach(f => bell(v, f, 0.07, 2, 0.8));
    [130.8, 196].forEach(f => tone(v, { freq: f, dur: 1.4, gain: 0.05, type: 'sawtooth', at: 0.8, lowpass: 700 }));
    sparkles(v, 8, 1.0, 2.2, 0.045);
    noise(v, { at: 0.8, dur: 1.6, gain: 0.025, type: 'highpass', f0: 5500, attack: 0.1 });
  },
};

/** Sounds that can fire in bursts (lists, drags): the same one is not repeated inside this gap (ms). */
const MIN_GAP_MS: Partial<Record<UiSound, number>> = {
  tap: 45, select: 45, tab: 60, back: 60, toggleOn: 80, toggleOff: 80, coin: 70, error: 350, success: 250, notify: 300, message: 150,
};
const DEFAULT_GAP_MS = 120;
/** Reward sounds are never dropped, even in the middle of a burst of small ones. */
const PRIORITY: ReadonlySet<UiSound> = new Set<UiSound>([
  'claim', 'achievement', 'packTear', 'revealBronze', 'revealSilver', 'revealGold', 'revealLegendary', 'revealImmortal', 'champion',
]);

export const UI_SOUND_NAMES = Object.keys(SOUNDS) as UiSound[];

/**
 * How much each sound is raised after it is drawn. Everyday sounds are drawn soft and lifted
 * the most; the big moments are drawn fuller and lifted the least, so the ladder from a tap
 * to an immortal reveal is about 7 dB, and nothing reaches the limiter by accident.
 */
const TRIM: Partial<Record<UiSound, number>> = {
  coin: 2.6, spend: 2.6, claim: 2.2, achievement: 1.8, packTear: 2.4,
  revealBronze: 2.4, revealSilver: 2.3, revealGold: 2.1, revealLegendary: 1.2, revealImmortal: 1, champion: 1.3,
};
const DEFAULT_TRIM = 3.2;

/** Draws one sound into any audio context (live or offline), starting at `t`. */
export function renderUiSound(name: UiSound, ctx: BaseAudioContext, out: AudioNode, t: number, noiseBuffer: AudioBuffer): void {
  const trim = ctx.createGain();
  trim.gain.value = TRIM[name] ?? DEFAULT_TRIM;
  trim.connect(out);
  SOUNDS[name]({ ctx, out: trim, t, noise: noiseBuffer });
}

/** Two seconds of white noise, shared by every noise-based sound of a context. */
export function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  return buffer;
}

// ── The live player ─────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const lastPlayed = new Map<UiSound, number>();
const recent: number[] = [];

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = typeof window !== 'undefined'
    ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    : undefined;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { return null; }
  master = ctx.createGain();
  master.gain.value = soundSettings.gain();
  // A limiter on the way out: several sounds at once (or a legendary reveal) never distort.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(ctx.destination);
  noiseBuffer = createNoiseBuffer(ctx);
  soundSettings.subscribe(() => {
    if (ctx && master) master.gain.setTargetAtTime(soundSettings.gain(), ctx.currentTime, 0.05);
  });
  return ctx;
}

/** Plays one interface sound (nothing when muted, in a hidden tab or before the first tap). */
export function playSound(name: UiSound): void {
  if (!UI_SOUNDS_ENABLED) return;
  if (soundSettings.gain() <= 0) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const context = audioContext();
  if (!context || !noiseBuffer) return;
  // Browsers keep the context suspended until a tap; a sound asked before that is dropped
  // (not queued), so it cannot burst out later.
  if (context.state !== 'running') { void context.resume().catch(() => undefined); return; }
  const now = performance.now();
  const gap = MIN_GAP_MS[name] ?? DEFAULT_GAP_MS;
  if (now - (lastPlayed.get(name) ?? -Infinity) < gap) return;
  while (recent.length && now - recent[0] > 100) recent.shift();
  if (!PRIORITY.has(name) && recent.length >= 6) return;
  lastPlayed.set(name, now);
  recent.push(now);
  try {
    renderUiSound(name, context, master!, context.currentTime + 0.005, noiseBuffer);
  } catch { /* a sound must never break the screen that asked for it */ }
}

/** Starts the audio context on the first tap or key (the browsers' rule), so later sounds can play. */
function unlockOnFirstGesture(): void {
  const unlock = () => {
    const context = audioContext();
    if (context && context.state !== 'running') void context.resume().catch(() => undefined);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

// ── What a click sounds like ────────────────────────────────────────────────────

/** What the sound picker needs to know about the element that was pressed. */
export interface ClickTarget {
  role?: string | null;
  classes: readonly string[];
  label?: string | null;
  /** The element's current checked state (switches and checkboxes), before the click. */
  checked?: boolean | null;
  disabled?: boolean;
  /** Explicit choice from `data-sound`: a sound name, or "none" for silence. */
  dataSound?: string | null;
}

const BACK_LABEL = /\b(fechar|voltar|cancelar|dispensar|close|back)\b/i;

/** Which sound a pressed control makes (null: none). Explicit `data-sound` always wins. */
export function soundForClick(target: ClickTarget): UiSound | null {
  if (target.disabled) return null;
  if (target.dataSound === 'none') return null;
  if (target.dataSound && target.dataSound in SOUNDS) return target.dataSound as UiSound;
  if (target.role === 'tab') return 'tab';
  if (target.role === 'switch' || target.role === 'checkbox') return target.checked ? 'toggleOff' : 'toggleOn';
  if (target.classes.includes('ui-choice')) return 'select';
  if (target.label && BACK_LABEL.test(target.label)) return 'back';
  if (target.classes.includes('ui-btn--primary') || target.classes.includes('ui-btn--success')) return 'confirm';
  return 'tap';
}

const INTERACTIVE = 'button, a[href], summary, [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="radio"]';

function describe(element: Element): ClickTarget {
  const role = element.getAttribute('role') ?? (element instanceof HTMLInputElement ? element.type : null);
  const checkedAttr = element.getAttribute('aria-checked');
  const checked = element instanceof HTMLInputElement ? element.checked : checkedAttr === null ? null : checkedAttr === 'true';
  return {
    role,
    classes: Array.from(element.classList),
    label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40),
    checked,
    disabled: (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true',
    dataSound: element.closest('[data-sound]')?.getAttribute('data-sound') ?? null,
  };
}

let installed = false;

/**
 * Gives every button, tab, switch and choice card its click sound, in one place (no screen
 * has to ask for it). A control opts out or picks another sound with `data-sound="none"` /
 * `data-sound="coin"` on itself or any parent.
 */
export function installUiSounds(): void {
  if (!UI_SOUNDS_ENABLED || installed || typeof window === 'undefined') return;
  installed = true;
  unlockOnFirstGesture();
  let pointerHandled = false;
  const handle = (event: Event) => {
    const element = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    if (!element) return;
    const name = soundForClick(describe(element));
    if (name) playSound(name);
  };
  // Pointer first (no wait for the finger to lift), then keyboard-driven clicks, which have no pointer.
  window.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointerHandled = true;
    handle(event);
  }, true);
  window.addEventListener('click', event => {
    if (pointerHandled && (event as MouseEvent).detail > 0) { pointerHandled = false; return; }
    pointerHandled = false;
    handle(event);
  }, true);
}

// ── For components ──────────────────────────────────────────────────────────────

/** Plays `name` once when the component mounts. */
export function useSoundOnMount(name: UiSound | null): void {
  useEffect(() => { if (name) playSound(name); }, [name]);
}

/** The reveal sound that matches a card's rarity. */
export function revealSoundFor(rarity: string): UiSound {
  switch (rarity) {
    case 'immortal': return 'revealImmortal';
    case 'legendary': return 'revealLegendary';
    case 'gold': return 'revealGold';
    case 'silver': return 'revealSilver';
    default: return 'revealBronze';
  }
}

// ── What a finished request sounds like ─────────────────────────────────────────

/**
 * The sound for a server action that just succeeded (null: none). Claiming is a reward,
 * buying is money going out, selling is money coming in. Opening a pack has its own, richer
 * sequence on screen, so it is not here.
 */
export function soundForRequest(method: string | undefined, path: string): UiSound | null {
  if ((method ?? 'GET').toUpperCase() !== 'POST') return null;
  const route = path.split('?')[0];
  if (route === '/api/account/daily-rewards/claim' || route === '/api/account/seasons/claim') return 'claim';
  const album = route.match(/^\/api\/account\/album\/([a-z-]+)$/)?.[1];
  if (album) {
    if (album.startsWith('buy-')) return 'spend';
    if (album === 'sell' || album === 'sell-batch') return 'coin';
    return null;
  }
  if (/^\/api\/account\/events\/[a-z0-9-]+\/choice$/.test(route)) return 'success';
  return null;
}

const RARITY_ORDER = ['bronze', 'silver', 'gold', 'legendary', 'immortal'];

/** The reveal sound for the best card of a set (a pack plays one sound, for its highlight). */
export function revealSoundForBest(rarities: readonly string[]): UiSound {
  let best = -1;
  for (const rarity of rarities) best = Math.max(best, RARITY_ORDER.indexOf(rarity));
  return revealSoundFor(RARITY_ORDER[Math.max(0, best)]);
}
