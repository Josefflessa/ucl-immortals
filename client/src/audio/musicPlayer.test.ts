import { describe, expect, it } from 'vitest';
import { busLevel, CROSSFADE_S, DUCK_LEVEL, equalPowerCurves, loopPeriod, musicZoneForPhase, trackGainFor, TRACKS } from './musicPlayer';
import { soundSettings } from './soundSettings';

describe('musicZoneForPhase', () => {
  it('gives the account side its track', () => {
    for (const phase of ['menu', 'account', 'album', 'store', 'achievements', 'events', 'lobby']) expect(musicZoneForPhase(phase)).toBe('menu');
  });

  it('gives the whole competition its track, from the set-up to the report', () => {
    for (const phase of ['format', 'setup', 'crest', 'coach', 'formation', 'draft', 'squad_review', 'league', 'knockout', 'report']) expect(musicZoneForPhase(phase)).toBe('competition');
  });

  it('is silent for the match (it has its crowd) and for anything unknown', () => {
    expect(musicZoneForPhase('match_sim')).toBeNull();
    expect(musicZoneForPhase('something-new')).toBeNull();
  });
});

describe('loops', () => {
  it('have room for the crossfade at both ends', () => {
    for (const spec of Object.values(TRACKS)) {
      expect(spec.loopStart).toBeGreaterThanOrEqual(CROSSFADE_S);
      expect(loopPeriod(spec)).toBeGreaterThan(CROSSFADE_S * 4);
    }
  });

  it('are long enough not to feel short (over a minute and a half)', () => {
    for (const spec of Object.values(TRACKS)) expect(loopPeriod(spec)).toBeGreaterThan(90);
  });
});

describe('equalPowerCurves', () => {
  it('keeps the power constant through the crossfade', () => {
    const { fadeIn, fadeOut } = equalPowerCurves(64);
    for (let i = 0; i < fadeIn.length; i++) expect(fadeIn[i] ** 2 + fadeOut[i] ** 2).toBeCloseTo(1, 5);
    expect(fadeIn[0]).toBe(0);
    expect(fadeOut[0]).toBe(1);
    expect(fadeIn.at(-1)).toBeCloseTo(1, 5);
    expect(fadeOut.at(-1)).toBeCloseTo(0, 5);
  });
});

describe('levels', () => {
  it('brings loud and quiet tracks to the same loudness, within limits', () => {
    expect(trackGainFor(0.15) * 0.15).toBeCloseTo(trackGainFor(0.19) * 0.19, 5);
    expect(trackGainFor(0.0001)).toBeLessThanOrEqual(3);
    expect(trackGainFor(5)).toBeGreaterThanOrEqual(0.2);
    expect(trackGainFor(0)).toBe(1);
  });

  it('ducks under a reveal, silences a hidden tab and follows the player', () => {
    expect(busLevel(0.5, 0, false)).toBe(0.5);
    expect(busLevel(0.5, 1, false)).toBeCloseTo(0.5 * DUCK_LEVEL, 5);
    expect(busLevel(0.5, 2, false)).toBeCloseTo(0.5 * DUCK_LEVEL, 5);
    expect(busLevel(0.5, 0, true)).toBe(0);
    expect(busLevel(0, 0, false)).toBe(0);
  });
});

describe('music settings', () => {
  it('are separate from the effects', () => {
    soundSettings.setMuted(false);
    soundSettings.setMusicMuted(true);
    expect(soundSettings.gain()).toBeGreaterThan(0);
    expect(soundSettings.musicGain()).toBe(0);
    soundSettings.setMusicMuted(false);
    soundSettings.setMusicVolume(9);
    expect(soundSettings.get().musicVolume).toBe(1);
    soundSettings.setMusicVolume(0.5);
  });
});
