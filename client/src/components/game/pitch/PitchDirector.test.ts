import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '@shared/game/engine/teamModel';
import { BALL_SLOT, SHOT_ARRIVAL_MS, type PitchSides } from '@shared/game/pitch';
import { PitchDirector } from './PitchDirector';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };
const tactics = { left: 'balanced', right: 'balanced' };

function setup() {
  let now = 0;
  const director = new PitchDirector(sides, 'teste', () => now);
  return { director, advance: (ms: number) => { now += ms; director.sample(); } };
}

const goal: MatchEvent = { minute: 20, type: 'goal', description: '', teamId: 'L', playerId: 'L10',
  play: { kind: 'through', shot: 'one_on_one', attackerId: 'L10', creatorId: 'L6', defenderId: 'R2', goalkeeperId: 'R0' } };

describe('PitchDirector', () => {
  it('pausa congela tudo, no jogo corrido e no lance', () => {
    const { director, advance } = setup();
    advance(700);
    director.setPaused(true);
    const flowPos = Array.from(director.sample());
    advance(3000);
    expect(Array.from(director.sample())).toEqual(flowPos);
    director.setPaused(false);
    director.startDanger(goal, 3, 'goal');
    advance(700);
    director.setPaused(true);
    const dangerPos = Array.from(director.sample());
    advance(5000);
    expect(Array.from(director.sample())).toEqual(dangerPos);
  });

  it('syncStage alinha o lance com a narração', () => {
    const { director, advance } = setup();
    director.startDanger(goal, 3, 'goal');
    advance(200);
    director.syncStage(3, 0); // the narration is already at the reveal
    expect(director.sample()[BALL_SLOT * 3]).toBeGreaterThanOrEqual(105);
    expect(director.getSnapshot().threat?.stage).toBe(3);
    void SHOT_ARRIVAL_MS;
  });

  it('o lance entra sem corte, tem câmera lenta e volta à zona do meio após o gol', () => {
    const { director, advance } = setup();
    director.startDanger(goal, 3, 'goal');
    expect(director.getSnapshot().mode).toBe('danger');
    expect(director.getSnapshot().cast.length).toBeGreaterThan(1);
    advance(director.getSnapshot().timing.arrivalMs + 200);
    const kinds = director.getSnapshot().beats.map(b => b.kind);
    expect(kinds).not.toContain('cut');
    expect(kinds).toContain('slowmo');
    expect(kinds).toContain('net');
    director.endDanger('left');
    expect(director.getSnapshot().mode).toBe('flow');
    expect(director.getSnapshot().cast).toEqual([]);
    expect(director.getSnapshot().zone).toEqual({ side: 'right', third: 1 });
    advance(6000);
    expect(Math.abs(director.sample()[BALL_SLOT * 3] - 52.5)).toBeLessThan(3); // glided back to the centre
  });

  it('expulsão, lesão e tática ficam registradas', () => {
    const { director } = setup();
    director.onMinute(30, [
      { minute: 30, type: 'red', description: '', teamId: 'R', playerId: 'R4' },
      { minute: 30, type: 'injury', description: '', teamId: 'L', playerId: 'L2' },
      { minute: 30, type: 'tactic', description: '', teamId: 'R', tacticAction: 'defensive' },
    ], 50, tactics, null);
    const snap = director.getSnapshot();
    expect(snap.sentOff.has(15)).toBe(true);
    expect(snap.injured.has(2)).toBe(true);
    expect(snap.cue?.kind).toBe('injury');
    expect(snap.tactic?.label?.length).toBeGreaterThan(2);
  });

  it('o mesmo jogo gera as mesmas posições', () => {
    const run = () => {
      const { director, advance } = setup();
      for (let m = 1; m <= 15; m++) {
        director.onMinute(m, [{ minute: m, type: 'momentum', description: '', teamId: m % 3 ? 'L' : 'R', playerId: m % 3 ? 'L6' : 'R6' }], 40 + m, tactics, m > 10 ? 'left' : null);
        advance(222);
      }
      return Array.from(director.sample());
    };
    expect(run()).toEqual(run());
  });
});
