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
import { getAudioContext, getOutput, installAudioUnlock } from './audioCore';

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
export const UI_SOUNDS_ENABLED = true;

/** Where a sound is drawn: the audio context, the node it feeds and the time it starts. */
interface Voice { ctx: BaseAudioContext; out: AudioNode; t: number; noise: AudioBuffer; /** Pitch multiplier of this play (1 = as written). */ pitch: number }

const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77;
const C6 = 1046.5, E6 = 1318.5, G6 = 1568, C7 = 2093;
const F5 = 698.46, A5b = 880, D6 = 1174.66, F6 = 1396.91, A6 = 1760;

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
  osc.frequency.setValueAtTime(o.freq * v.pitch, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to * v.pitch, start + o.dur);
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

/**
 * A game-UI blip: a round triangle note with a hint of square for edge, sliding a little, and a
 * low-pass that keeps it warm. Arcade in character, but never shrill or chiptune-bright.
 */
const blip = (v: Voice, freq: number, at: number, dur: number, gain: number, to?: number) => {
  tone(v, { freq, to, dur, gain, at, type: 'triangle', attack: 0.002, lowpass: 3400 });
  tone(v, { freq, to, dur: dur * 0.8, gain: gain * 0.22, at, type: 'square', attack: 0.002, lowpass: 2600 });
};

/** The small low knock under a button press, like a pad being hit. */
const knock = (v: Voice, at: number, gain: number, dur = 0.055) => tone(v, { freq: 210, to: 85, dur, gain, at, attack: 0.001 });

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
  tap: v => { blip(v, 660, 0, 0.055, 0.2, 780); knock(v, 0, 0.15); },
  select: v => { blip(v, D5, 0, 0.055, 0.17); blip(v, 784, 0.05, 0.1, 0.15); knock(v, 0, 0.09); },
  tab: v => { blip(v, 520, 0, 0.06, 0.18, 620); knock(v, 0, 0.12, 0.06); },
  confirm: v => { blip(v, D5, 0, 0.07, 0.17); blip(v, A5b, 0.055, 0.2, 0.17); knock(v, 0, 0.15, 0.07); },
  back: v => { blip(v, 740, 0, 0.09, 0.17, 520); knock(v, 0, 0.1, 0.06); },
  toggleOn: v => { blip(v, D5, 0, 0.055, 0.16); blip(v, A5b, 0.05, 0.1, 0.16); },
  toggleOff: v => { blip(v, A5b, 0, 0.055, 0.15); blip(v, D5, 0.05, 0.1, 0.15); },

  // Feedback: each reads at a glance even with the screen out of sight.
  error: v => {
    tone(v, { freq: 294, to: 196, dur: 0.2, gain: 0.16, type: 'triangle', attack: 0.003, lowpass: 1500 });
    tone(v, { freq: 294, to: 196, dur: 0.16, gain: 0.04, type: 'square', attack: 0.003, lowpass: 1100 });
    knock(v, 0, 0.12, 0.07);
  },
  success: v => { [D5, F5, A5b].forEach((f, i) => blip(v, f, i * 0.07, 0.1, 0.15)); bell(v, D6, 0.05, 0.5, 0.2); knock(v, 0, 0.1, 0.06); },
  notify: v => { blip(v, A5b, 0, 0.08, 0.14); blip(v, D6, 0.09, 0.16, 0.13); bell(v, D6, 0.03, 0.45, 0.1); },
  message: v => { blip(v, 784, 0, 0.06, 0.12); blip(v, 1046.5, 0.06, 0.1, 0.11); },

  // Money and rewards.
  coin: v => { bell(v, D6, 0.085, 0.38); bell(v, A6, 0.045, 0.34, 0.06); knock(v, 0, 0.08, 0.05); },
  spend: v => { bell(v, A5b, 0.07, 0.24); bell(v, D5, 0.07, 0.3, 0.07); knock(v, 0, 0.1, 0.06); },
  claim: v => {
    [D5, F5, A5b, D6].forEach((f, i) => blip(v, f, i * 0.065, 0.1, 0.13));
    bell(v, D6, 0.06, 0.55, 0.26); bell(v, A6, 0.035, 0.6, 0.31);
    noise(v, { at: 0.3, dur: 0.55, gain: 0.015, type: 'highpass', f0: 6000, attack: 0.05 });
    knock(v, 0, 0.12, 0.07);
  },
  achievement: v => {
    [D5, F5, A5b].forEach((f, i) => blip(v, f, i * 0.09, i === 2 ? 0.22 : 0.08, 0.14));
    [D6, F6, A6].forEach(f => bell(v, f, 0.06, 1.2, 0.34));
    tone(v, { freq: 73.4, dur: 0.7, gain: 0.12, at: 0.34 });
    noise(v, { at: 0.34, dur: 0.9, gain: 0.018, type: 'highpass', f0: 5500, attack: 0.08 });
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
  // everyday
  tap: 0.87, select: 1.2, tab: 0.97, confirm: 1.16, back: 1.14, toggleOn: 1.44, toggleOff: 1.52,
  // feedback
  error: 1.25, success: 1.45, notify: 1.83, message: 1.92,
  // money and rewards
  coin: 1.98, spend: 1.92, claim: 1.67, achievement: 0.46,
  // packs, reveals and the title
  packTear: 2.4, revealBronze: 2.4, revealSilver: 2.3, revealGold: 2.1, revealLegendary: 1.2, revealImmortal: 1, champion: 1.3,
};
const DEFAULT_TRIM = 3.2;
/** Which sounds get a touch of random pitch each time (the ones heard hundreds of times). */
const JITTER: ReadonlySet<UiSound> = new Set<UiSound>(['tap', 'select', 'tab', 'back', 'toggleOn', 'toggleOff']);

/** Draws one sound into any audio context (live or offline), starting at `t`. */
export function renderUiSound(name: UiSound, ctx: BaseAudioContext, out: AudioNode, t: number, noiseBuffer: AudioBuffer, pitch = 1): void {
  const trim = ctx.createGain();
  trim.gain.value = TRIM[name] ?? DEFAULT_TRIM;
  trim.connect(out);
  SOUNDS[name]({ ctx, out: trim, t, noise: noiseBuffer, pitch });
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

let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const lastPlayed = new Map<UiSound, number>();
const recent: number[] = [];

/** The effects' own volume stage, plugged into the shared output (created once). */
function effectsOutput(): { context: AudioContext; master: GainNode; noise: AudioBuffer } | null {
  const context = getAudioContext();
  const output = getOutput();
  if (!context || !output) return null;
  if (!master) {
    master = context.createGain();
    master.gain.value = soundSettings.gain();
    master.connect(output);
    noiseBuffer = createNoiseBuffer(context);
    soundSettings.subscribe(() => {
      if (master) master.gain.setTargetAtTime(soundSettings.gain(), context.currentTime, 0.05);
    });
  }
  return { context, master, noise: noiseBuffer! };
}

/** Plays one interface sound (nothing when muted, in a hidden tab or before the first tap). */
export function playSound(name: UiSound): void {
  if (!UI_SOUNDS_ENABLED) return;
  if (soundSettings.gain() <= 0) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const stage = effectsOutput();
  if (!stage) return;
  const { context } = stage;
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
    const pitch = JITTER.has(name) ? 1 + (Math.random() - 0.5) * 0.05 : 1;
    renderUiSound(name, context, stage.master, context.currentTime + 0.005, stage.noise, pitch);
  } catch { /* a sound must never break the screen that asked for it */ }
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

// A player card is not a <button>, but when it has an onClick it is one (the draft, the squad): it is marked with cursor-pointer.
const INTERACTIVE = 'button, a[href], summary, [data-player-card="true"].cursor-pointer, [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="radio"]';

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
    dataSound: element.closest('[data-sound]')?.getAttribute('data-sound') ?? (element.hasAttribute('data-player-card') ? 'select' : null),
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
  installAudioUnlock();
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
