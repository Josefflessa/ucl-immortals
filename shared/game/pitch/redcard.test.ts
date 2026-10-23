import { describe, expect, it } from 'vitest';
import type { MatchEvent, Team } from '../engine/teamModel';
import { generateBotTeam } from '../engine/bots';
import { FORMATIONS } from '../gameData';
import { RED_KINDS, RED_VARIANTS, type RedKind, type RedVariant } from '../redCards';
import { seededRandom, withRandomSource } from '../random';
import { kickoffPositions } from './flow';
import { BALL_SLOT, PITCH_LENGTH, PITCH_WIDTH, roleOfSlot, slotBase, type PitchSides, type Side } from './geometry';
import { MAX_BALL_SPEED, MAX_PLAYER_SPEED, CUT_SNAP_MS } from './motion';
import { buildRedCardTimeline, RED_ARRIVAL_MS, RED_BUILDUP_MS, RED_CONTACT_MS, RED_END_MS } from './redcard';
import { sampleTimeline, createPositionBuffer } from './timeline';

const STEP = 20;

function setup(f: number) {
  const [home, away] = withRandomSource(seededRandom(300 + f), () => [generateBotTeam('Casa', 0.9), generateBotTeam('Fora', 0.9)]) as [Team, Team];
  home.formationId = FORMATIONS[f].id;
  away.formationId = FORMATIONS[(f + 3) % FORMATIONS.length].id;
  const sides: PitchSides = {
    left: { teamId: home.id, playerIds: home.players.slice(0, 11).map(p => p.id), formationId: home.formationId },
    right: { teamId: away.id, playerIds: away.players.slice(0, 11).map(p => p.id), formationId: away.formationId },
  };
  return { home, away, sides };
}

const cases: { kind: RedKind; variant: RedVariant }[] = RED_KINDS.flatMap(kind => (RED_VARIANTS[kind] as readonly RedVariant[]).map(variant => ({ kind, variant })));

describe('cartão vermelho — a cena do campo', () => {
  it('toda variante de todo tipo respeita velocidades, limites do campo e o relógio', () => {
    const issues: string[] = [];
    let n = 0;
    for (let f = 0; f < FORMATIONS.length; f++) {
      const { home, away, sides } = setup(f);
      cases.forEach(({ kind, variant }, i) => {
        for (const offSide of ['left', 'right'] as Side[]) {
          const entry = (i + f) % 3 === 0 ? 'cut' : 'fade';
          const offTeam = offSide === 'left' ? home : away;
          const event: MatchEvent = { minute: 30, type: 'red', description: '', teamId: offTeam.id, playerId: offTeam.players[3 + (i % 5)].id, redKind: kind, redVariant: variant, secondYellow: kind === 'secondyellow' };
          const sentOff = new Set<number>(i % 4 === 0 ? [slotBase(offSide === 'left' ? 'right' : 'left') + 4] : []);
          const tag = `${kind}/${variant} ${offSide}-off ${FORMATIONS[f].id} ${entry}`;
          const r = buildRedCardTimeline({ sides, event, kind, variant, prev: kickoffPositions(sides, 'left'), sentOff, entry, seed: f * 997 + i * 31 + (offSide === 'left' ? 1 : 2) });
          n++;
          expect(r.timeline.duration, tag).toBe(RED_END_MS);
          const a = createPositionBuffer();
          const b = createPositionBuffer();
          const skip = entry === 'cut' ? CUT_SNAP_MS + STEP : 0;
          for (let t = 0; t + STEP <= RED_END_MS; t += STEP) {
            sampleTimeline(r.timeline, t, a);
            sampleTimeline(r.timeline, t + STEP, b);
            if (t < skip) continue;
            for (let s = 0; s <= BALL_SLOT; s++) {
              if (sentOff.has(s)) continue;
              const x = b[s * 3], y = b[s * 3 + 1];
              if (x < -3 || x > PITCH_LENGTH + 3 || y < -3 || y > PITCH_WIDTH + 3) issues.push(`fora do campo: slot ${s} t=${t} (${x.toFixed(1)},${y.toFixed(1)}) ${tag}`);
              const v = (Math.hypot(b[s * 3] - a[s * 3], b[s * 3 + 1] - a[s * 3 + 1]) / STEP) * 1000;
              const limit = s === BALL_SLOT ? MAX_BALL_SPEED : MAX_PLAYER_SPEED + 0.6;
              if (v > limit) issues.push(`rápido demais: slot ${s} ${v.toFixed(1)} m/s t=${t} ${tag}`);
              if (s === BALL_SLOT && b[s * 3 + 2] < -0.01) issues.push(`bola abaixo do chão t=${t} ${tag}`);
            }
          }
          for (let k = 1; k < r.referee.length; k++) {
            const p = r.referee[k - 1], q = r.referee[k];
            const v = (Math.hypot(q.x - p.x, q.y - p.y) / Math.max(1, q.t - p.t)) * 1000;
            if (v > 9.2) issues.push(`juiz rápido demais ${v.toFixed(1)} m/s em ${p.t} ${tag}`);
            if (q.t <= p.t) issues.push(`juiz fora de ordem ${tag}`);
          }
          const cards = r.beats.filter(beat => beat.kind === 'card');
          if (cards.filter(c => c.card === 'red').length !== 1) issues.push(`precisa de exatamente um vermelho: ${tag}`);
          if (kind === 'secondyellow' && !cards.some(c => c.card === 'yellow')) issues.push(`segundo amarelo sem o amarelo: ${tag}`);
          if (!r.beats.some(beat => beat.kind === 'whistle')) issues.push(`sem apito: ${tag}`);
          if (kind !== 'handball' && !r.beats.some(beat => beat.kind === 'fall' && beat.slot === r.victimSlot)) issues.push(`a vítima não cai: ${tag}`);
          if ((variant === 'pull' || variant === 'shirt') && !r.beats.some(beat => beat.kind === 'tug' && beat.slot === r.offenderSlot && beat.slot2 === r.victimSlot)) issues.push(`puxão sem a linha: ${tag}`);
          if (!r.beats.some(beat => beat.kind === 'contact' && beat.icon && beat.label)) issues.push(`sem ícone e legenda no contato: ${tag}`);
          const red = cards.find(c => c.card === 'red');
          if (red && (red.t < RED_ARRIVAL_MS - 100 || red.t > RED_END_MS - 800)) issues.push(`vermelho fora da etapa 3 (${red.t}): ${tag}`);
          if (r.cast.length < 2) issues.push(`elenco incompleto: ${tag}`);
          void RED_BUILDUP_MS; void RED_CONTACT_MS;
        }
      });
    }
    expect(n).toBeGreaterThan(100);
    const unique = Array.from(new Set(issues.map(i => i.replace(/ t=\d+/, '').replace(/ [\d.]+ m\/s/, ''))));
    expect(unique.slice(0, 80)).toEqual([]);
  });
});

describe('cartão vermelho — o entorno faz sentido', () => {
  it('cada tipo de lance tem o time, a bola e o goleiro onde o lance pede', () => {
    const issues: string[] = [];
    for (let f = 0; f < FORMATIONS.length; f++) {
      const { home, away, sides } = setup(f);
      cases.forEach(({ kind, variant }, i) => {
        for (const offSide of ['left', 'right'] as Side[]) {
          const offTeam = offSide === 'left' ? home : away;
          const event: MatchEvent = { minute: 30, type: 'red', description: '', teamId: offTeam.id, playerId: offTeam.players[3 + (i % 5)].id, redKind: kind, redVariant: variant, secondYellow: kind === 'secondyellow' };
          const tag = `${kind}/${variant} ${offSide}-off ${FORMATIONS[f].id}`;
          const r = buildRedCardTimeline({ sides, event, kind, variant, prev: kickoffPositions(sides, 'left'), sentOff: new Set(), entry: 'fade', seed: f * 977 + i * 41 + (offSide === 'left' ? 1 : 2) });
          // Back to the scene's own frame: the fouled team attacks towards x = 105.
          const flip = r.fouledSide === 'right';
          const at = (t: number) => {
            const buf = createPositionBuffer();
            sampleTimeline(r.timeline, t, buf);
            const point = (slot: number) => ({ x: flip ? PITCH_LENGTH - buf[slot * 3] : buf[slot * 3], y: flip ? PITCH_WIDTH - buf[slot * 3 + 1] : buf[slot * 3 + 1] });
            return { point, speedOf: (slot: number) => { const b2 = createPositionBuffer(); sampleTimeline(r.timeline, t + 100, b2); return (Math.hypot(b2[slot * 3] - buf[slot * 3], b2[slot * 3 + 1] - buf[slot * 3 + 1]) / 100) * 1000; } };
          };
          const fouledBase = slotBase(r.fouledSide);
          const offBase = slotBase(r.fouledSide === 'left' ? 'right' : 'left');
          const sideSlots = (base: number) => Array.from({ length: 11 }, (_, k) => base + k);
          const isGk = (slot: number) => roleOfSlot(sides, slot) === 'GK';
          const C = RED_CONTACT_MS;
          const now = at(C);
          const V = now.point(r.victimSlot);
          const gk = sideSlots(offBase).find(isGk)!;
          const inBox = (p: { x: number; y: number }) => p.x >= 88.5 && Math.abs(p.y - 34) <= 20.2;
          const others = (base: number) => sideSlots(base).filter(s => !isGk(s) && s !== r.victimSlot && s !== r.offenderSlot);
          const box = kind === 'handball' || (kind === 'elbow' && variant === 'blind');
          if (box) {
            if (others(fouledBase).filter(s => inBox(now.point(s))).length < 2) issues.push(`pouco ataque na área: ${tag}`);
            if (others(offBase).filter(s => inBox(now.point(s))).length < 3) issues.push(`pouca defesa na área: ${tag}`);
            if (PITCH_LENGTH - now.point(gk).x > 6) issues.push(`goleiro longe do gol (${(PITCH_LENGTH - now.point(gk).x).toFixed(1)} m): ${tag}`);
            if (!(variant === 'block' ? V.x >= 85 : inBox(V))) issues.push(`a vítima longe da área: ${tag}`);
          }
          if (kind === 'lastman') {
            const ahead = others(offBase).filter(s => now.point(s).x > V.x + 0.5);
            if (ahead.length) issues.push(`${ahead.length} defensor(es) à frente do último homem: ${tag}`);
            if (PITCH_LENGTH - V.x > 32) issues.push(`longe demais do gol para ser chance clara: ${tag}`);
          }
          // After the whistle the play is dead: the ball is still, near where it happened.
          const late = at(RED_ARRIVAL_MS);
          const ballSpeed = late.speedOf(BALL_SLOT);
          if (ballSpeed > 2.2) issues.push(`bola ainda correndo no fim (${ballSpeed.toFixed(1)} m/s): ${tag}`);
          const end = at(RED_END_MS).point(BALL_SLOT);
          if (Math.hypot(end.x - V.x, end.y - V.y) > 16) issues.push(`bola longe demais da falta (${Math.hypot(end.x - V.x, end.y - V.y).toFixed(0)} m): ${tag}`);
          // Nobody is left wandering off: the offender's goal keeper stays by his goal.
          if (PITCH_LENGTH - at(RED_END_MS).point(gk).x > 24) issues.push(`goleiro fora do lugar no fim: ${tag}`);
        }
      });
    }
    const unique = Array.from(new Set(issues));
    expect(unique.slice(0, 60)).toEqual([]);
  });
});
