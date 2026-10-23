/**
 * The match's sound: a constant stadium crowd under everything, the referee's whistle at
 * kick-off and full time, and the crowd's reaction to each danger as it is revealed (a
 * goal, a save, a miss, the woodwork). Web Audio, so the crowd loops with no seam and
 * every sound starts on the exact moment it is asked for. Each file is levelled when it
 * loads (to a loudness target per kind), so they sit together whatever their recording.
 * The mute and volume choices are shared with the interface sounds (see soundSettings).
 */

import { soundSettings } from './soundSettings';

export type MatchSound = 'whistleStart' | 'whistleEnd' | 'goal' | 'save' | 'miss' | 'post' | 'whistleFoul';
type Track = MatchSound | 'crowd';

/** Recorded sounds (the whistles are synthesised: see WHISTLES). */
const FILES: Partial<Record<Track, string>> = {
  crowd: '/sounds/torcida.mp3',
  goal: '/sounds/gol.mp3',
  save: '/sounds/defesa.mp3',
  miss: '/sounds/fora.mp3',
  post: '/sounds/trave.mp3',
};

/** The referee's whistle: one long blast to kick off; two short and a long one at full time (seconds). */
const WHISTLES: Partial<Record<Track, { at: number; dur: number }[]>> = {
  whistleStart: [{ at: 0, dur: 1.15 }],
  whistleEnd: [{ at: 0, dur: 0.3 }, { at: 0.45, dur: 0.3 }, { at: 0.9, dur: 1.25 }],
  /** A foul: one firm blast. */
  whistleFoul: [{ at: 0, dur: 0.55 }],
};

/**
 * Loudness (RMS, linear) each sound is levelled to: the crowd under the rest but always
 * there, the whistles clear above it, the reactions on top, the goal the loudest moment of
 * the match (a miss only a murmur of disappointment).
 */
const TARGET: Record<Track, number> = {
  crowd: 0.058,
  whistleStart: 0.12,
  whistleEnd: 0.12,
  whistleFoul: 0.12,
  goal: 0.45,
  save: 0.185,
  miss: 0.1,
  post: 0.16,
};

/**
 * A referee's pea whistle: a bright tone near 3 kHz, warbled ~31 times a second by the pea
 * rattling inside (both in pitch and in level), a touch of breath, a quick attack and a
 * short tail on each blast.
 */
function synthWhistle(ctx: AudioContext, blasts: { at: number; dur: number }[]): AudioBuffer {
  const rate = ctx.sampleRate;
  const total = Math.max(...blasts.map(b => b.at + b.dur)) + 0.1;
  const buffer = ctx.createBuffer(1, Math.ceil(total * rate), rate);
  const out = buffer.getChannelData(0);
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const blast of blasts) {
    const start = Math.round(blast.at * rate);
    const length = Math.round(blast.dur * rate);
    let phase = 0;
    let breath = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const pea = Math.sin(2 * Math.PI * 31 * t);
      const settle = Math.min(1, t / 0.05); // the pitch rises as the blast starts
      phase += (2 * Math.PI * (2650 + 300 * settle + 95 * pea)) / rate;
      breath += (noise() - breath) * 0.35;
      const tone = Math.sin(phase) + 0.12 * Math.sin(2 * phase) + 0.05 * Math.sin(3 * phase);
      const envelope = Math.min(1, t / 0.02) * Math.min(1, (blast.dur - t) / 0.07);
      out[start + i] += (tone * (0.78 + 0.22 * pea) + 0.06 * breath) * envelope * 0.5;
    }
  }
  return buffer;
}

/** How low the steady crowd dips (share of its level) while each reaction plays. */
const DUCK: Partial<Record<MatchSound, number>> = { goal: 0.2, save: 0.45, miss: 0.45, post: 0.45 };

/** The match sounds were levelled for the default volume: the slider moves them around it. */
const DEFAULT_VOLUME = 0.7;
const matchGain = (): number => { const { muted, volume } = soundSettings.get(); return muted ? 0 : Math.min(1.5, volume / DEFAULT_VOLUME); };
const CROWD_FADE_IN_S = 1.2;
const CROWD_FADE_OUT_S = 3.5;

/**
 * A decoded sound: its levelling gain, the span to loop (the crowd), and where it is strong
 * (until `strongUntil`) and where it has died away (`fadedBy`), in seconds.
 */
interface Loaded { buffer: AudioBuffer; gain: number; loopStart: number; loopEnd: number; strongUntil: number; fadedBy: number }

/** Where the sound drops below half its peak level, and below 15% of it (after the peak). */
function decay(buffer: AudioBuffer): { strongUntil: number; fadedBy: number } {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.round(buffer.sampleRate * 0.05));
  const levels: number[] = [];
  for (let i = 0; i < data.length; i += step) {
    let sum = 0;
    const end = Math.min(data.length, i + step);
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    levels.push(Math.sqrt(sum / (end - i)));
  }
  const peak = levels.reduce((best, v, i) => (v > levels[best] ? i : best), 0);
  const at = (share: number) => {
    for (let i = peak; i < levels.length; i++) if (levels[i] < levels[peak] * share) return (i * step) / buffer.sampleRate;
    return buffer.duration;
  };
  return { strongUntil: at(0.5), fadedBy: at(0.15) };
}

/** RMS of the buffer's loud part (silence at the ends does not lower it). */
function loudness(buffer: AudioBuffer): number {
  let sum = 0;
  let count = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i];
      if (Math.abs(v) < 0.002) continue;
      sum += v * v;
      count++;
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

/** Where the sound really starts and ends (the encoder pads both ends with silence). */
function audibleSpan(buffer: AudioBuffer): { start: number; end: number } {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.round(buffer.sampleRate * 0.2));
  let first = 0;
  while (first < limit && Math.abs(data[first]) < 1e-3) first++;
  let last = data.length - 1;
  while (last > data.length - limit && Math.abs(data[last]) < 1e-3) last--;
  return { start: first / buffer.sampleRate, end: (last + 1) / buffer.sampleRate };
}

class MatchAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowd: AudioBufferSourceNode | null = null;
  private readonly sounds = new Map<Track, Loaded>();
  private loading: Promise<void> | null = null;
  private unlock: (() => void) | null = null;

  // ── React store (the mute button) ──
  subscribe = (listener: () => void): (() => void) => soundSettings.subscribe(listener);
  isMuted = (): boolean => soundSettings.get().muted;

  setMuted(muted: boolean): void {
    soundSettings.setMuted(muted);
  }

  /** Follows the shared settings (mute and volume) with a short fade. */
  private applyLevel = (): void => {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(matchGain(), now, 0.08);
  };

  /** The audio graph, created on first use (null where Web Audio is unavailable). */
  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = matchGain();
    soundSettings.subscribe(this.applyLevel);
    // A limiter on the way out: a goal can ring out loud over the crowd without distorting.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 4;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0;
    this.crowdGain.connect(this.master);
    // A browser may hold the sound until the player interacts: the first tap or key unlocks it.
    if (this.ctx.state === 'suspended') {
      this.unlock = () => { void this.ctx?.resume(); this.dropUnlock(); };
      window.addEventListener('pointerdown', this.unlock, { once: true });
      window.addEventListener('keydown', this.unlock, { once: true });
    }
    return this.ctx;
  }

  private dropUnlock(): void {
    if (!this.unlock) return;
    window.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
    this.unlock = null;
  }

  /** Fetches and decodes every sound once (a failed one is just silent). */
  load(): Promise<void> {
    const ctx = this.context();
    if (!ctx) return Promise.resolve();
    if (!this.loading) {
      const tracks = Object.keys(TARGET) as Track[];
      this.loading = Promise.all(tracks.map(async track => {
        try {
          const blasts = WHISTLES[track];
          const file = FILES[track];
          let buffer: AudioBuffer;
          if (blasts) buffer = synthWhistle(ctx, blasts);
          else if (file) {
            const res = await fetch(file);
            if (!res.ok) return;
            buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          } else return;
          const rms = loudness(buffer);
          const span = audibleSpan(buffer);
          this.sounds.set(track, { buffer, gain: rms > 0 ? Math.min(6, TARGET[track] / rms) : 1, loopStart: span.start, loopEnd: span.end, ...decay(buffer) });
        } catch {
          // A missing or undecodable file leaves that sound out; the match plays on.
        }
      })).then(() => undefined);
    }
    return this.loading;
  }

  /** Kick-off: the crowd fades in and the referee blows for the start. */
  async startMatch(): Promise<void> {
    const ctx = this.context();
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);
    await this.load();
    this.startCrowd();
    this.play('whistleStart');
  }

  private startCrowd(): void {
    const ctx = this.ctx, loaded = this.sounds.get('crowd');
    if (!ctx || !loaded || !this.crowdGain || this.crowd) return;
    const source = ctx.createBufferSource();
    source.buffer = loaded.buffer;
    source.loop = true;
    source.loopStart = loaded.loopStart;
    source.loopEnd = loaded.loopEnd;
    source.connect(this.crowdGain);
    const now = ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
    this.crowdGain.gain.linearRampToValueAtTime(loaded.gain, now + CROWD_FADE_IN_S);
    source.start(now, loaded.loopStart);
    this.crowd = source;
  }

  /** A one-off sound, now (skipped if it has not loaded). */
  play(sound: MatchSound): void {
    const ctx = this.ctx, loaded = this.sounds.get(sound);
    if (!ctx || !loaded || !this.master) return;
    const source = ctx.createBufferSource();
    source.buffer = loaded.buffer;
    const gain = ctx.createGain();
    gain.gain.value = loaded.gain;
    source.connect(gain).connect(this.master);
    source.start(ctx.currentTime, loaded.loopStart);
    // The crowd's reaction to a danger: the steady crowd makes way for it (dips, then comes back
    // as it dies down), so it stands out instead of blending into the background — the most
    // for a goal's roar.
    const duck = DUCK[sound];
    if (duck !== undefined) this.duckCrowd(duck, loaded.strongUntil, loaded.fadedBy);
  }

  /** Down to `level` while the reaction is strong, back up as it dies away (seconds from now). */
  private duckCrowd(level: number, strongUntil: number, fadedBy: number): void {
    const ctx = this.ctx, loaded = this.sounds.get('crowd');
    if (!ctx || !loaded || !this.crowdGain || !this.crowd) return;
    const now = ctx.currentTime;
    const g = this.crowdGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(loaded.gain * level, now + 0.15);
    g.setValueAtTime(loaded.gain * level, now + Math.max(0.2, strongUntil));
    g.linearRampToValueAtTime(loaded.gain, now + Math.max(strongUntil + 0.4, fadedBy));
  }

  /** Full time: the final whistle, and the crowd slowly dies down. */
  endMatch(): void {
    this.play('whistleEnd');
    this.fadeOutCrowd(CROWD_FADE_OUT_S);
  }

  private fadeOutCrowd(seconds: number): void {
    const ctx = this.ctx, crowd = this.crowd;
    if (!ctx || !crowd || !this.crowdGain) return;
    const now = ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(now);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
    this.crowdGain.gain.linearRampToValueAtTime(0, now + seconds);
    crowd.stop(now + seconds + 0.05);
    this.crowd = null;
  }

  /** The match paused: everything holds (and picks up where it was). */
  pause(): void { void this.ctx?.suspend().catch(() => undefined); }
  resume(): void { void this.ctx?.resume().catch(() => undefined); }

  /** Leaving the match screen: a quick fade, nothing left playing. */
  leave(): void {
    this.dropUnlock();
    this.fadeOutCrowd(0.3);
  }
}

export const matchAudio = new MatchAudio();

/** The sound a danger's outcome makes, from how it ended. */
export function outcomeSound(outcome: 'goal' | 'save' | 'miss', finish: string): MatchSound {
  if (outcome === 'goal') return 'goal';
  if (outcome === 'save') return 'save';
  return finish === 'post' || finish === 'bar' || finish === 'posts' ? 'post' : 'miss';
}
