import { describe, expect, it } from 'vitest';
import type { MatchEvent, PlayKind } from '../engine/teamModel';
import { BALL_SLOT, GOAL_HEIGHT, GOAL_Y_MAX, GOAL_Y_MIN, PITCH_LENGTH, PITCH_WIDTH, type PitchSides, type Side } from './geometry';
import { kickoffPositions } from './flow';
import { buildDangerTimeline, DANGER_KINDS, FADE_ENTRY_MS, MAX_PASS_SPEED, peakBallSpeed, type DangerOutcome } from './plays';
import { CUT_SNAP_MS, MAX_BALL_SPEED, MAX_PLAYER_SPEED } from './motion';
import { epicFinishesFor, finishesFor, PLAY_VARIANTS, type FinishStyle, type PlayVariant } from '../playVariants';
import { createPositionBuffer, sampleTimeline } from './timeline';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };

const OUTCOMES: Record<string, DangerOutcome[]> = {
  own_goal: ['goal'], blunder: ['goal'], deflected: ['goal'], screamer: ['goal'], woodwork: ['miss'],
};

function eventFor(kind: PlayKind, outcome: DangerOutcome, attackSide: Side): MatchEvent {
  const atk = attackSide === 'left' ? 'L' : 'R';
  const def = attackSide === 'left' ? 'R' : 'L';
  const atkTeam = attackSide === 'left' ? 'L' : 'R';
  const defTeam = attackSide === 'left' ? 'R' : 'L';
  return {
    minute: 40,
    type: outcome,
    description: '',
    teamId: outcome === 'save' ? defTeam : atkTeam,
    playerId: outcome === 'save' ? `${def}0` : kind === 'own_goal' ? undefined : `${atk}10`,
    opponentId: outcome === 'save' ? `${atk}10` : kind === 'own_goal' ? `${def}2` : undefined,
    play: { kind, attackerId: `${atk}10`, creatorId: `${atk}7`, wideId: kind === 'cross' ? `${atk}8` : undefined, defenderId: `${def}2`, goalkeeperId: `${def}0` },
  };
}

// Ball position in the attacker's frame (the attack always goes towards x = 105).
const toAttack = (side: Side, x: number, y: number) => (side === 'left' ? { x, y } : { x: PITCH_LENGTH - x, y: PITCH_WIDTH - y });

const TOUCHED = new Set<FinishStyle>(['blocked', 'deflect', 'fumble', 'cleared', 'rebound']);

describe('roteiros de lance perigoso', () => {
  it('pelo menos 100 lances diferentes (variação × desfecho)', () => {
    const total = DANGER_KINDS.reduce((sum, kind) => sum + (PLAY_VARIANTS[kind] as readonly PlayVariant[])
      .reduce((n, v) => n + (OUTCOMES[kind] ?? (['goal', 'save', 'miss'] as DangerOutcome[])).reduce((m, o) => m + finishesFor(kind, v, o).length, 0), 0), 0);
    expect(total).toBeGreaterThanOrEqual(100);
  });

  for (const kind of DANGER_KINDS) {
    for (const outcome of OUTCOMES[kind] ?? (['goal', 'save', 'miss'] as DangerOutcome[])) {
      for (const attackSide of ['left', 'right'] as Side[]) {
        it(`${kind} → ${outcome} (${attackSide})`, () => {
          // Every variant with every finish it can have, with both entries.
          const combos = (PLAY_VARIANTS[kind] as readonly PlayVariant[]).flatMap(variant => [...finishesFor(kind, variant, outcome), ...epicFinishesFor(kind, variant, outcome)].map(finish => ({ variant, finish })));
          for (let seed = 1; seed <= Math.max(8, combos.length * 2); seed++) {
            const prev = kickoffPositions(sides, 'left');
            const { variant, finish } = combos[Math.floor((seed - 1) / 2) % combos.length];
            const input = { sides, attackSide, event: eventFor(kind, outcome, attackSide), outcome, prev, sentOff: new Set<number>(), entry: seed % 2 === 0 ? 'fade' as const : 'cut' as const, seed, variant, finish };
            const d = buildDangerTimeline(input);
            const out = createPositionBuffer();

            sampleTimeline(d.timeline, 0, out);
            out.forEach((v, i) => expect(v).toBeCloseTo(prev[i], 3)); // starts exactly where everything was

            // Nobody moves faster than a sprint, the ball than a hard strike (except during the cut, in the dark).
            const before = createPositionBuffer();
            sampleTimeline(d.timeline, 0, before);
            for (let t = 20; t <= d.timing.endMs; t += 20) {
              sampleTimeline(d.timeline, t, out);
              // The cut re-places everyone in the dark; a fade places the players at once and glides the ball in.
              const inCut = d.entry === 'cut' && t >= CUT_SNAP_MS - 20 && t <= CUT_SNAP_MS + 20;
              const inFade = d.entry === 'fade' && t <= 20;
              if (!inCut && !inFade) {
                for (let slot = 0; slot <= BALL_SLOT; slot++) {
                  if (slot === BALL_SLOT && d.entry === 'fade' && t <= FADE_ENTRY_MS) continue;
                  const speed = Math.hypot(out[slot * 3] - before[slot * 3], out[slot * 3 + 1] - before[slot * 3 + 1]) / 0.02;
                  if (speed > (slot === BALL_SLOT ? MAX_BALL_SPEED : MAX_PLAYER_SPEED)) expect(speed, `${variant}/${finish}: slot ${slot} at ${t} ms`).toBeLessThanOrEqual(slot === BALL_SLOT ? MAX_BALL_SPEED : MAX_PLAYER_SPEED);
                }
              }
              before.set(out);
            }
            expect(d.beats.some(b => b.kind === 'strike' && b.t === d.timing.contactMs)).toBe(true);
            expect(d.beats.some(b => (b.kind as string) === 'slowmo')).toBe(false);
            // The clock fits the play: passes and crosses at a real ball's pace, strikes ~120 km/h at most.
            expect(peakBallSpeed(d.timeline, FADE_ENTRY_MS + 40, d.timing.contactMs - 30), `${variant}/${finish}: pass`).toBeLessThanOrEqual(MAX_PASS_SPEED * 1.08);
            expect(peakBallSpeed(d.timeline, d.timing.contactMs - 10, d.timing.arrivalMs - 20), `${variant}/${finish}: strike`).toBeLessThanOrEqual(36);

            for (let t = 0; t <= d.timing.endMs; t += 50) {
              sampleTimeline(d.timeline, t, out);
              for (let i = 0; i < out.length; i += 3) {
                // A ball sent wide can leave behind either goal.
                const inside = out[i] > -7 && out[i] < PITCH_LENGTH + 7 && out[i + 1] > -4 && out[i + 1] < PITCH_WIDTH + 4 && out[i + 2] >= -0.01 && out[i + 2] < 9;
                if (!inside) expect([out[i], out[i + 1], out[i + 2]], `${variant}/${finish}: slot ${i / 3} at ${t} ms`).toBe('inside the drawing');
              }
            }

            sampleTimeline(d.timeline, d.timing.arrivalMs, out);
            const ball = toAttack(attackSide, out[BALL_SLOT * 3], out[BALL_SLOT * 3 + 1]);
            const z = out[BALL_SLOT * 3 + 2];
            const gkSlot = d.cast.find(c => c.role === 'goalkeeper')!.slot;
            const gk = toAttack(attackSide, out[gkSlot * 3], out[gkSlot * 3 + 1]);
            const label = `${variant}/${finish} seed ${seed}`;
            for (const save of d.beats.filter(beat => beat.kind === 'save')) {
              sampleTimeline(d.timeline, save.t, out);
              const saveBall = toAttack(attackSide, out[BALL_SLOT * 3], out[BALL_SLOT * 3 + 1]);
              const keeper = toAttack(attackSide, out[gkSlot * 3], out[gkSlot * 3 + 1]);
              // At contact, the ball must still be on the shooter's side of the keeper.
              expect(keeper.x - saveBall.x, `${label}: keeper must be goal-side at ${save.t} ms`).toBeGreaterThanOrEqual(0.65);
              expect(keeper.x - saveBall.x, `${label}: keeper must stay within reach at ${save.t} ms`).toBeLessThanOrEqual(1.4);
            }
            if (finish === 'rebound' || finish === 'double') {
              const firstSave = d.beats.find(beat => beat.kind === 'save')!;
              sampleTimeline(d.timeline, firstSave.t, out);
              const atContact = toAttack(attackSide, out[BALL_SLOT * 3], out[BALL_SLOT * 3 + 1]);
              sampleTimeline(d.timeline, firstSave.t + 320, out);
              const afterParry = toAttack(attackSide, out[BALL_SLOT * 3], out[BALL_SLOT * 3 + 1]);
              // The loose ball moves out toward the shooter, away from the goal, immediately.
              expect(afterParry.x, `${label}: rebound must leave the goal side`).toBeLessThan(atContact.x - 3.5);
            }
            if (finish === 'post' || finish === 'bar' || finish === 'posts' || finish === 'barline') {
              expect(ball.x).toBeGreaterThan(104.5);
              const onPost = Math.min(Math.abs(ball.y - GOAL_Y_MIN), Math.abs(ball.y - GOAL_Y_MAX)) < 0.5;
              const onBar = ball.y > GOAL_Y_MIN && ball.y < GOAL_Y_MAX && Math.abs(z - GOAL_HEIGHT) < 0.1;
              expect(onPost || onBar, label).toBe(true);
            } else if (outcome === 'goal') {
              expect(ball.x, label).toBeGreaterThanOrEqual(105);
              expect(ball.y, label).toBeGreaterThan(GOAL_Y_MIN);
              expect(ball.y).toBeLessThan(GOAL_Y_MAX);
              expect(z).toBeLessThan(GOAL_HEIGHT);
              // As drawn (height lifts it on screen, ~0.75 m radius at full zoom): inside the mouth as it
              // crosses the line, and resting inside the net afterwards, never over the post or the back.
              for (const t of [d.timing.arrivalMs, d.timing.arrivalMs + 400]) {
                sampleTimeline(d.timeline, t, out);
                const drawn = toAttack(attackSide, out[BALL_SLOT * 3], out[BALL_SLOT * 3 + 1] - out[BALL_SLOT * 3 + 2] * 0.5);
                expect(drawn.y, `${label} at ${t} ms`).toBeGreaterThan(GOAL_Y_MIN + 0.75);
                expect(drawn.y, `${label} at ${t} ms`).toBeLessThan(GOAL_Y_MAX - 0.75);
                if (t > d.timing.arrivalMs) expect(drawn.x, label).toBeLessThan(105 + 2.6 - 0.75);
              }
            } else if (finish === 'cleared') {
              // Cleared off the line, just before it.
              expect(ball.x, label).toBeLessThan(105);
              expect(ball.x, label).toBeGreaterThan(103);
            } else if (outcome === 'save') {
              expect(Math.hypot(ball.x - gk.x, ball.y - gk.y), label).toBeLessThan(1.5);
            } else {
              expect(ball.x).toBeGreaterThanOrEqual(105);
              expect(ball.y < GOAL_Y_MIN || ball.y > GOAL_Y_MAX || z > GOAL_HEIGHT, label).toBe(true);
            }

            // Nobody stands in the line of the shot unless the finish is a touch on the way.
            if (!TOUCHED.has(finish) && kind !== 'own_goal') {
              const finisherSlot = d.cast.find(c => c.role === 'finisher')!.slot;
              const keepers = new Set([gkSlot, attackSide === 'left' ? 0 : 11].concat(attackSide === 'left' ? [11, 0] : [0, 11]));
              for (let t = d.timing.contactMs + 150; t <= d.timing.arrivalMs - 150; t += 30) {
                sampleTimeline(d.timeline, t, out);
                if (out[BALL_SLOT * 3 + 2] > 1.8) continue;
                for (let slot = 0; slot < BALL_SLOT; slot++) {
                  // A player in the air (the wall, a header duel) lets it go over or under.
                  if (slot === finisherSlot || keepers.has(slot) || out[slot * 3 + 2] > 0.05) continue;
                  const gap = Math.hypot(out[slot * 3] - out[BALL_SLOT * 3], out[slot * 3 + 1] - out[BALL_SLOT * 3 + 1]);
                  if (gap <= 0.9) expect(gap, `${label}: slot ${slot} in the way at ${t} ms`).toBeGreaterThan(0.9);
                }
              }
            }
            // Everyone featured with a portrait really takes part: on the ball or challenging for it.
            for (const member of d.cast) {
              if (member.role === 'goalkeeper') continue;
              let closest = Infinity;
              for (let t = 0; t <= d.timing.arrivalMs; t += 20) {
                sampleTimeline(d.timeline, t, out);
                closest = Math.min(closest, Math.hypot(out[member.slot * 3] - out[BALL_SLOT * 3], out[member.slot * 3 + 1] - out[BALL_SLOT * 3 + 1]));
              }
              if (closest >= 3.5) expect(closest, `${label}: ${member.role} never near the ball`).toBeLessThan(3.5);
            }
            // Every recorded touch has the ball right there with that player.
            for (const touch of d.touches) {
              sampleTimeline(d.timeline, touch.t, out);
              const gap = Math.hypot(out[touch.slot * 3] - out[BALL_SLOT * 3], out[touch.slot * 3 + 1] - out[BALL_SLOT * 3 + 1]);
              if (gap > 1.6) expect(gap, `${label}: toque do slot ${touch.slot} em ${touch.t} ms longe da bola`).toBeLessThanOrEqual(1.6);
            }
            expect(d.variant).toBe(variant);
            expect(d.finish).toBe(finish);

            const slots = d.cast.map(c => c.slot);
            expect(new Set(slots).size).toBe(slots.length);
            expect(slots.length).toBeLessThanOrEqual(4);
            expect(d.cast.some(c => c.role === 'finisher')).toBe(true);

            expect(JSON.stringify(buildDangerTimeline(input).timeline)).toBe(JSON.stringify(d.timeline));
          }
        });
      }
    }
  }

  it('só chute de longe, falta e bomba saem de fora da área; o resto finaliza dentro dela', () => {
    const fromOutside = new Set(['longrange', 'freekick', 'screamer', 'woodwork/layoff', 'woodwork/clearance', 'blunder/longshot', 'blunder/freekick', 'deflected/layoff', 'deflected/freekick']);
    // A free kick out wide is crossed in and headed from inside the box.
    const insideAnyway = new Set(['freekick/flank', 'freekick/chipped']);
    for (const kind of DANGER_KINDS) {
      for (const variant of PLAY_VARIANTS[kind] as readonly PlayVariant[]) {
        const outside = (fromOutside.has(kind) || fromOutside.has(`${kind}/${variant}`)) && !insideAnyway.has(`${kind}/${variant}`);
        for (let seed = 1; seed <= 4; seed++) {
          const outcome = OUTCOMES[kind]?.[0] ?? 'goal';
          const d = buildDangerTimeline({ sides, attackSide: 'left', event: eventFor(kind, outcome, 'left'), outcome, prev: kickoffPositions(sides, 'left'), sentOff: new Set(), entry: seed % 2 ? 'cut' : 'fade', seed, variant });
          const out = createPositionBuffer();
          sampleTimeline(d.timeline, d.timing.contactMs, out);
          const distance = PITCH_LENGTH - out[BALL_SLOT * 3];
          if (outside) expect(distance, `${kind}/${variant}`).toBeGreaterThan(16.5);
          else expect(distance, `${kind}/${variant}`).toBeLessThanOrEqual(16.5);
        }
      }
    }
  });

  it('pênalti rasteiro convertido: o goleiro pula para o outro lado, como a narração diz', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const d = buildDangerTimeline({ sides, attackSide: 'left', event: eventFor('penalty', 'goal', 'left'), outcome: 'goal', prev: kickoffPositions(sides, 'left'), sentOff: new Set(), entry: 'cut', seed, variant: 'normal', finish: 'low' });
      const out = createPositionBuffer();
      sampleTimeline(d.timeline, d.timing.arrivalMs + 200, out);
      const gk = d.cast.find(c => c.role === 'goalkeeper')!.slot;
      const ballSide = Math.sign(out[BALL_SLOT * 3 + 1] - 34);
      const keeperSide = Math.sign(out[gk * 3 + 1] - 34);
      expect(keeperSide, `seed ${seed}`).toBe(-ballSide);
    }
  });

  it('gol com assistência: quem deu a assistência aparece e toca na bola antes de quem finaliza', () => {
    for (const kind of ['dribble', 'counter', 'longrange', 'cross', 'through'] as PlayKind[]) {
      for (let seed = 1; seed <= 12; seed++) {
        const event = { ...eventFor(kind, 'goal', 'left'), assisterId: 'L6' };
        const d = buildDangerTimeline({ sides, attackSide: 'left', event, outcome: 'goal', prev: kickoffPositions(sides, 'left'), sentOff: new Set(), entry: seed % 2 ? 'cut' : 'fade', seed });
        expect(['breakaway', 'recovery', 'clearance'], `${kind}/${d.variant}`).not.toContain(d.variant);
        const creator = d.cast.find(c => c.role === 'creator');
        expect(creator?.slot, `${kind}/${d.variant} seed ${seed}`).toBe(6);
        // The assist provider is on the ball before the finisher.
        const out = createPositionBuffer();
        let first = -1;
        for (let t = 0; t <= d.timing.contactMs && first < 0; t += 20) {
          sampleTimeline(d.timeline, t, out);
          for (const slot of [6, 10]) {
            if (Math.hypot(out[slot * 3] - out[BALL_SLOT * 3], out[slot * 3 + 1] - out[BALL_SLOT * 3 + 1]) < 1.3) { first = slot; break; }
          }
        }
        expect(first, `${kind}/${d.variant} seed ${seed}`).toBe(6);
      }
    }
  });

  it('entrada suave: jogadores já posicionados, sem corte, e a bola desliza até o início do lance', () => {
    const prev = kickoffPositions(sides);
    const d = buildDangerTimeline({ sides, attackSide: 'left', event: eventFor('cross', 'goal', 'left'), outcome: 'goal', prev, sentOff: new Set(), entry: 'fade', seed: 4 });
    expect(d.beats.some(b => b.kind === 'cut')).toBe(false);
    const at2 = createPositionBuffer();
    sampleTimeline(d.timeline, 2, at2);
    const at300 = createPositionBuffer();
    sampleTimeline(d.timeline, 300, at300);
    for (let s = 0; s < 22; s++) expect(Math.hypot(at300[s * 3] - at2[s * 3], at300[s * 3 + 1] - at2[s * 3 + 1])).toBeLessThan(3);
  });

  it('evento antigo sem play vira um lance genérico', () => {
    const event: MatchEvent = { minute: 10, type: 'goal', description: '', teamId: 'L', playerId: 'L10' };
    const d = buildDangerTimeline({ sides, attackSide: 'left', event, outcome: 'goal', prev: kickoffPositions(sides), sentOff: new Set(), entry: 'cut', seed: 9 });
    const out = createPositionBuffer();
    sampleTimeline(d.timeline, d.timing.arrivalMs, out);
    expect(out[BALL_SLOT * 3]).toBeGreaterThanOrEqual(105);
  });

  it('expulso não participa do lance', () => {
    const event = eventFor('through', 'goal', 'left');
    const d = buildDangerTimeline({ sides, attackSide: 'left', event, outcome: 'goal', prev: kickoffPositions(sides), sentOff: new Set([10, 13]), entry: 'cut', seed: 2 });
    expect(d.cast.map(c => c.slot)).not.toContain(10);
    expect(d.cast.map(c => c.slot)).not.toContain(13);
  });
});
