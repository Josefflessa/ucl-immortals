/**
 * The game's background music: one track for the account side (menu, store, album, ranking…)
 * and one for the competition (set-up, draft, league). Each plays as an endless loop whose
 * seam is a long equal-power crossfade between two copies of the same stretch of the track,
 * and the stretch was picked so the beat and the chords line up at the seam. The tracks are
 * decoded on demand (one in memory at a time, at 32 kHz, only the looping stretch), levelled
 * to the same loudness, and move out of the way of the match (silence), of pack openings
 * (ducked) and of a hidden tab (paused).
 */

import { useEffect } from 'react';
import { getAudioContext, getOutput, installAudioUnlock, whenRunning } from './audioCore';
import { soundSettings } from './soundSettings';

export type MusicZone = 'menu' | 'competition';

interface TrackSpec {
  url: string;
  /** Seconds into the file where the loop starts (after the track's own fade-in). */
  loopStart: number;
  /** Seconds into the file where it ends (before the track's own fade-out). */
  loopEnd: number;
}

/** Loop points found by matching the beat of the end of each track with that of its start. */
export const TRACKS: Record<MusicZone, TrackSpec> = {
  menu: { url: '/music/menu.mp3', loopStart: 10, loopEnd: 134.2 },
  competition: { url: '/music/competicao.mp3', loopStart: 5, loopEnd: 140.45 },
};

export const CROSSFADE_S = 3;
export const ZONE_FADE_S = 1.8;
const DECODE_RATE = 32000;
/** RMS every track is levelled to at full music volume (the default volume sits well below it). */
const TARGET_RMS = 0.06;
const MAX_TRACK_GAIN = 3;
/** How much the music drops under a pack opening or a reveal. */
export const DUCK_LEVEL = 0.3;

// ── Pure helpers (tested) ───────────────────────────────────────────────────────

/** Which music a game phase has: the account side, the competition, or none (the match has its crowd). */
export function musicZoneForPhase(phase: string): MusicZone | null {
  switch (phase) {
    case 'menu': case 'account': case 'album': case 'store': case 'achievements': case 'events': case 'lobby':
      return 'menu';
    case 'format': case 'setup': case 'crest': case 'coach': case 'formation': case 'draft':
    case 'squad_review': case 'league': case 'knockout': case 'report':
      return 'competition';
    default:
      return null; // match_sim and anything unknown
  }
}

/** Seconds between the start of one copy of the loop and the next. */
export const loopPeriod = (spec: TrackSpec): number => spec.loopEnd - spec.loopStart;

/** The gain that brings a track of this RMS to the common loudness. */
export function trackGainFor(rms: number): number {
  if (!(rms > 0)) return 1;
  return Math.min(MAX_TRACK_GAIN, Math.max(0.2, TARGET_RMS / rms));
}

/** The two halves of an equal-power crossfade: at every instant fadeIn² + fadeOut² = 1. */
export function equalPowerCurves(steps = 128): { fadeIn: Float32Array; fadeOut: Float32Array } {
  const fadeIn = new Float32Array(steps);
  const fadeOut = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    fadeIn[i] = Math.sin(t * Math.PI / 2);
    fadeOut[i] = Math.cos(t * Math.PI / 2);
  }
  return { fadeIn, fadeOut };
}

/** The level of the whole music bus: the player's volume, the duck and a hidden tab. */
export function busLevel(musicGain: number, duckCount: number, hidden: boolean): number {
  if (hidden) return 0;
  return musicGain * (duckCount > 0 ? DUCK_LEVEL : 1);
}

// ── Decoding ────────────────────────────────────────────────────────────────────

interface Loaded { buffer: AudioBuffer; gain: number }

function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  // A throwaway context only to decode, at the low rate (Safari still wants the callback form).
  const offline = new OfflineAudioContext(2, 1, DECODE_RATE);
  return new Promise((resolve, reject) => { offline.decodeAudioData(data, resolve, reject); });
}

async function loadTrack(zone: MusicZone): Promise<Loaded | null> {
  const spec = TRACKS[zone];
  try {
    const response = await fetch(spec.url);
    if (!response.ok) return null;
    const full = await decode(await response.arrayBuffer());
    const rate = full.sampleRate;
    const from = Math.max(0, Math.floor((spec.loopStart - CROSSFADE_S) * rate));
    const to = Math.min(full.length, Math.floor(spec.loopEnd * rate));
    // Only the looping stretch (plus the lead-in for the crossfade) is kept; the rest is let go.
    const ctx = getAudioContext();
    if (!ctx || to <= from) return null;
    const buffer = ctx.createBuffer(2, to - from, rate);
    let sum = 0;
    let count = 0;
    for (let channel = 0; channel < 2; channel++) {
      const source = full.getChannelData(Math.min(channel, full.numberOfChannels - 1)).subarray(from, to);
      buffer.copyToChannel(source, channel);
      if (channel === 0) {
        // Loudness of the looping stretch (every 4th sample is plenty).
        for (let i = Math.floor(CROSSFADE_S * rate); i < source.length; i += 4) { sum += source[i] * source[i]; count++; }
      }
    }
    return { buffer, gain: trackGainFor(Math.sqrt(sum / Math.max(1, count))) };
  } catch {
    return null;
  }
}

// ── One zone playing ────────────────────────────────────────────────────────────

class ZonePlayer {
  /** Fades the whole zone in and out (changing zone, the match). */
  readonly fade: GainNode;
  private readonly level: GainNode;
  private readonly voices = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly curves = equalPowerCurves();
  private readonly period: number;

  constructor(private readonly ctx: AudioContext, destination: AudioNode, readonly zone: MusicZone, private readonly track: Loaded) {
    this.period = loopPeriod(TRACKS[zone]);
    this.fade = ctx.createGain();
    this.fade.gain.value = 0;
    this.level = ctx.createGain();
    this.level.gain.value = track.gain;
    this.fade.connect(this.level).connect(destination);
  }

  start(fadeInS: number): void {
    const now = this.ctx.currentTime + 0.05;
    this.fade.gain.setValueAtTime(0, now);
    this.fade.gain.linearRampToValueAtTime(1, now + fadeInS);
    this.scheduleVoice(now, true);
    this.timer = setInterval(() => {
      while (this.ctx.currentTime + 2 >= this.nextStart) this.scheduleVoice(this.nextStart, false);
    }, 400);
  }

  /** `at` is when this copy starts sounding; the first copy starts at the loop point itself. */
  private scheduleVoice(at: number, first: boolean): void {
    const { buffer } = this.track;
    const offset = first ? CROSSFADE_S : 0;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    source.connect(gain).connect(this.fade);
    if (first) gain.gain.setValueAtTime(1, at);
    else gain.gain.setValueCurveAtTime(this.curves.fadeIn, at, CROSSFADE_S);
    // The next copy starts one period after this one's virtual start; this one fades out as it comes in.
    const virtualStart = at - offset;
    const next = virtualStart + this.period;
    gain.gain.setValueCurveAtTime(this.curves.fadeOut, next, CROSSFADE_S);
    source.start(at, offset);
    source.stop(virtualStart + buffer.duration + 0.1);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); };
    this.nextStart = next;
  }

  stop(fadeOutS: number): void {
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(this.fade.gain.value, now);
    this.fade.gain.linearRampToValueAtTime(0, now + fadeOutS);
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    setTimeout(() => {
      this.voices.forEach(voice => { try { voice.stop(); } catch { /* already stopped */ } });
      this.voices.clear();
      this.fade.disconnect();
      this.level.disconnect();
    }, fadeOutS * 1000 + 200);
  }

  get playing(): number { return this.voices.size; }
}

// ── The engine ──────────────────────────────────────────────────────────────────

class MusicEngine {
  private desired: MusicZone | null = null;
  private active: ZonePlayer | null = null;
  private bus: GainNode | null = null;
  private duckCount = 0;
  private hidden = typeof document !== 'undefined' && document.hidden;
  private generation = 0;
  private started = false;

  /** Wires the engine to the player's settings and to the tab's visibility (once). */
  private init(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    installAudioUnlock();
    soundSettings.subscribe(() => {
      this.updateBus();
      void this.apply();
    });
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      this.updateBus();
      const ctx = getAudioContext();
      if (!ctx) return;
      // A hidden tab plays nothing: pause the clock too (saves battery); the loop carries on seamlessly.
      if (this.hidden) setTimeout(() => { if (this.hidden && ctx.state === 'running') void ctx.suspend(); }, 600);
      else if (ctx.state === 'suspended') void ctx.resume();
    });
  }

  private ensureBus(): GainNode | null {
    if (this.bus) return this.bus;
    const ctx = getAudioContext();
    const output = getOutput();
    if (!ctx || !output) return null;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(output);
    this.updateBus();
    return this.bus;
  }

  private updateBus(): void {
    const ctx = getAudioContext();
    if (!ctx || !this.bus) return;
    const target = busLevel(soundSettings.musicGain(), this.duckCount, this.hidden);
    this.bus.gain.setTargetAtTime(target, ctx.currentTime, this.hidden ? 0.1 : 0.35);
  }

  /** The zone the screen asks for (null: silence). */
  setZone(zone: MusicZone | null): void {
    this.init();
    this.desired = zone;
    void this.apply();
  }

  /** Lowers the music while something louder and more special is on screen (counted: several can overlap). */
  duck(on: boolean): void {
    this.duckCount = Math.max(0, this.duckCount + (on ? 1 : -1));
    this.updateBus();
  }

  private async apply(): Promise<void> {
    const generation = ++this.generation;
    const wanted = soundSettings.get().musicMuted ? null : this.desired;
    if (this.active?.zone === wanted) return;
    if (wanted === null) {
      this.active?.stop(ZONE_FADE_S);
      this.active = null;
      return;
    }
    // Nothing starts before the player's first tap (the browsers' rule).
    await whenRunning();
    if (generation !== this.generation) return;
    const track = await loadTrack(wanted);
    if (!track || generation !== this.generation) return;
    const ctx = getAudioContext();
    const bus = this.ensureBus();
    if (!ctx || !bus) return;
    const previous = this.active;
    const player = new ZonePlayer(ctx, bus, wanted, track);
    previous?.stop(ZONE_FADE_S);
    player.start(previous ? ZONE_FADE_S : 2.5);
    this.active = player;
  }

  /** For tests and the dev console. */
  debug() {
    return { desired: this.desired, active: this.active?.zone ?? null, voices: this.active?.playing ?? 0, duck: this.duckCount, bus: this.bus?.gain.value ?? null, hidden: this.hidden };
  }
}

export const music = new MusicEngine();

// ── For components ──────────────────────────────────────────────────────────────

/** Keeps the music lowered for as long as the component is mounted (pack openings, reveals). */
export function useMusicDuck(active = true): void {
  useEffect(() => {
    if (!active) return undefined;
    music.duck(true);
    return () => music.duck(false);
  }, [active]);
}
