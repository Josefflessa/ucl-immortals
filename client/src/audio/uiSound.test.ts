import { describe, expect, it } from 'vitest';
import { revealSoundFor, revealSoundForBest, soundForClick, soundForRequest, soundsOnPointerDown, UI_SOUND_NAMES } from './uiSound';
import { soundSettings } from './soundSettings';

const btn = (classes: string[], extra: Record<string, unknown> = {}) => ({ classes, ...extra });

describe('soundForClick', () => {
  it('gives each kind of control its own sound', () => {
    expect(soundForClick(btn(['ui-btn', 'ui-btn--primary']))).toBe('confirm');
    expect(soundForClick(btn(['ui-btn', 'ui-btn--ghost']))).toBe('tap');
    expect(soundForClick(btn(['ui-choice']))).toBe('select');
    expect(soundForClick(btn([], { role: 'tab' }))).toBe('tab');
  });

  it('plays the opposite of the current state for a switch', () => {
    expect(soundForClick(btn([], { role: 'switch', checked: false }))).toBe('toggleOn');
    expect(soundForClick(btn([], { role: 'switch', checked: true }))).toBe('toggleOff');
  });

  it('reads back and close buttons by their label', () => {
    expect(soundForClick(btn(['ui-btn', 'ui-btn--primary'], { label: 'Fechar' }))).toBe('back');
    expect(soundForClick(btn(['ui-btn'], { label: 'Voltar ao menu' }))).toBe('back');
  });

  it('is silent for disabled controls and for data-sound="none"', () => {
    expect(soundForClick(btn(['ui-btn'], { disabled: true }))).toBeNull();
    expect(soundForClick(btn(['ui-btn'], { dataSound: 'none' }))).toBeNull();
  });

  it('lets data-sound pick any known sound, and ignores unknown names', () => {
    expect(soundForClick(btn(['ui-btn'], { dataSound: 'coin' }))).toBe('coin');
    expect(soundForClick(btn(['ui-btn'], { dataSound: 'nope' }))).toBe('tap');
  });
});

describe('soundsOnPointerDown', () => {
  it('stays silent for a finger landing (it may be a scroll) and waits for the click', () => {
    expect(soundsOnPointerDown({ pointerType: 'touch', button: 0 })).toBe(false);
  });

  it('plays at once for the primary mouse button and for a pen, not for the other mouse buttons', () => {
    expect(soundsOnPointerDown({ pointerType: 'mouse', button: 0 })).toBe(true);
    expect(soundsOnPointerDown({ pointerType: 'mouse', button: 2 })).toBe(false);
    expect(soundsOnPointerDown({ pointerType: 'pen', button: 0 })).toBe(true);
  });
});

describe('soundForRequest', () => {
  it('rewards a claim, charges a purchase, pays a sale', () => {
    expect(soundForRequest('POST', '/api/account/daily-rewards/claim')).toBe('claim');
    expect(soundForRequest('POST', '/api/account/seasons/claim')).toBe('claim');
    expect(soundForRequest('POST', '/api/account/album/buy-pack')).toBe('spend');
    expect(soundForRequest('POST', '/api/account/album/sell-batch')).toBe('coin');
  });

  it('stays silent for reads and for pack opening (it has its own sequence)', () => {
    expect(soundForRequest(undefined, '/api/account/daily-rewards/claim')).toBeNull();
    expect(soundForRequest('GET', '/api/account/album')).toBeNull();
    expect(soundForRequest('POST', '/api/account/album/open')).toBeNull();
  });
});

describe('reveal sounds', () => {
  it('grow with the rarity', () => {
    expect(revealSoundFor('bronze')).toBe('revealBronze');
    expect(revealSoundFor('gold')).toBe('revealGold');
    expect(revealSoundFor('immortal')).toBe('revealImmortal');
    expect(revealSoundFor('unique')).toBe('revealBronze');
  });

  it('a pack plays the sound of its best card', () => {
    expect(revealSoundForBest(['bronze', 'gold', 'silver'])).toBe('revealGold');
    expect(revealSoundForBest(['silver', 'immortal'])).toBe('revealImmortal');
    expect(revealSoundForBest([])).toBe('revealBronze');
  });
});

describe('catalogue and settings', () => {
  it('has every sound the game asks for', () => {
    for (const name of ['tap', 'confirm', 'claim', 'packTear', 'revealImmortal', 'champion', 'notify']) {
      expect(UI_SOUND_NAMES).toContain(name);
    }
  });

  it('mutes and clamps the volume', () => {
    soundSettings.setMuted(false);
    soundSettings.setVolume(0.5);
    expect(soundSettings.gain()).toBe(0.5);
    soundSettings.setVolume(7);
    expect(soundSettings.get().volume).toBe(1);
    soundSettings.setMuted(true);
    expect(soundSettings.gain()).toBe(0);
    soundSettings.setMuted(false);
  });

  it('notifies listeners only when something changed', () => {
    let calls = 0;
    const stop = soundSettings.subscribe(() => { calls++; });
    soundSettings.setVolume(0.3);
    soundSettings.setVolume(0.3);
    stop();
    expect(calls).toBe(1);
  });
});
