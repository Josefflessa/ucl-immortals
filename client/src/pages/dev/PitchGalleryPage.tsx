/**
 * Dev-only gallery: fire any play, variant and finish, and review it in slow motion
 * or frozen at any instant (the "congelar" box, in ms from the start of the play).
 * Open with #lances.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { generateBotTeam, statKey } from '@shared/game/gameEngine';
import type { MatchEvent, PlayKind } from '@shared/game/engine/teamModel';
import { DANGER_KINDS, SHOOTOUT_BUILDUP_MS, SHOOTOUT_HOLD_MS, stageStartMs, type DangerOutcome } from '@shared/game/pitch';
import { seededRandom, withRandomSource } from '@shared/game/random';
import { duelStylesFor, epicFinishesFor, EPIC_FINISHES, finishesFor, isEpicVariant, PLAY_VARIANTS, type FinishStyle, type PlayVariant } from '@shared/game/playVariants';
import LivePitch from '../../components/game/pitch/LivePitch';
import PitchErrorBoundary from '../../components/game/pitch/PitchErrorBoundary';
import { PitchDirector } from '../../components/game/pitch/PitchDirector';
import { buildPitchSides } from '../../components/game/pitch/sides';

const FORCED: Partial<Record<PlayKind, DangerOutcome>> = { own_goal: 'goal', blunder: 'goal', deflected: 'goal', screamer: 'goal', woodwork: 'miss' };

export default function PitchGalleryPage() {
  const [left, right] = useMemo(() => withRandomSource(seededRandom(7), () => [generateBotTeam('Meu Time', 0.9), generateBotTeam('Adversário', 0.9)]), []);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;
  // A virtual clock: slowed down, or frozen at an instant of the play.
  const virtual = useRef({ last: performance.now(), t: 0, start: 0, frozen: null as number | null });
  const director = useMemo(() => new PitchDirector(buildPitchSides(left, right), 'galeria', () => {
    const v = virtual.current;
    const now = performance.now();
    if (v.frozen === null) v.t += (now - v.last) * speedRef.current;
    else v.t = v.start + v.frozen;
    v.last = now;
    return v.t;
  }), [left, right]);
  const players = useMemo(() => new Map([
    ...left.players.map(p => [statKey(left.id, p.id), p] as const),
    ...right.players.map(p => [statKey(right.id, p.id), p] as const),
  ]), [left, right]);
  const [kind, setKind] = useState<PlayKind>('cross');
  const [outcome, setOutcome] = useState<DangerOutcome>('goal');
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [variant, setVariant] = useState<PlayVariant | ''>('');
  const [finish, setFinish] = useState<FinishStyle | ''>('');
  const [freezeAt, setFreezeAt] = useState('');
  const variants = (PLAY_VARIANTS[kind] as readonly PlayVariant[]).filter(v => outcome !== 'duel' || duelStylesFor(kind, v).length > 0);
  const result = FORCED[kind] ?? outcome;
  // The epic finishes too (marked ⚡), so every ending can be reviewed.
  const finishes: readonly FinishStyle[] = variant
    ? (result === 'duel' ? duelStylesFor(kind, variant) : [...finishesFor(kind, variant, result), ...epicFinishesFor(kind, variant, result)])
    : [];
  useEffect(() => { setVariant(''); setFinish(''); }, [kind]);
  useEffect(() => { setFinish(''); }, [variant, outcome]);
  const [flow, setFlow] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const minute = useRef(1);
  const eventIndex = useRef(0);

  useEffect(() => {
    if (!flow) return;
    const id = setInterval(() => {
      minute.current++;
      const m = minute.current;
      director.onMinute(m, [{ minute: m, type: 'momentum', description: '', teamId: m % 4 < 2 ? left.id : right.id, playerId: (m % 4 < 2 ? left : right).players[5].id }], 30 + (m * 7) % 40, { left: 'balanced', right: 'high_press' }, null);
    }, 222 / speed);
    return () => clearInterval(id);
  }, [flow, director, left, right, speed]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms / speedRef.current)); };

  const fire = () => {
    clear();
    setFlow(false);
    const atk = side === 'left' ? left : right;
    const def = side === 'left' ? right : left;
    const event: MatchEvent = {
      minute: 50, type: result, description: '',
      teamId: result === 'save' || result === 'duel' ? def.id : atk.id,
      playerId: result === 'save' ? def.players[0].id : result === 'duel' ? def.players[2].id : kind === 'own_goal' ? undefined : atk.players[10].id,
      opponentId: result === 'save' || result === 'duel' ? atk.players[10].id : kind === 'own_goal' ? def.players[2].id : undefined,
      play: { kind, attackerId: atk.players[10].id, creatorId: atk.players[7].id, wideId: kind === 'cross' ? atk.players[8].id : undefined, defenderId: def.players[2].id, goalkeeperId: def.players[0].id },
    };
    const frozen = freezeAt === '' ? null : Math.max(0, Number(freezeAt));
    virtual.current.frozen = null;
    virtual.current.start = virtual.current.t;
    director.startDanger(event, ++eventIndex.current, result, finish || undefined, variant || undefined);
    // This play's own clock (an epic can have a longer lead-in and strike).
    const timing = director.getSnapshot().timing;
    if (frozen !== null) {
      // Frozen: hold the play at that instant (the stages follow it).
      virtual.current.frozen = frozen;
      const stage = frozen >= stageStartMs(3, timing) ? 3 : frozen >= stageStartMs(2, timing) ? 2 : 1;
      director.syncStage(stage, frozen - stageStartMs(stage, timing));
      return;
    }
    after(stageStartMs(2, timing), () => director.syncStage(2, 0));
    after(stageStartMs(3, timing), () => director.syncStage(3, 0));
    after(timing.endMs, () => { director.endDanger(result === 'goal' ? side : null); setFlow(true); });
  };

  const cueEvent = (type: MatchEvent['type']) => {
    const m = ++minute.current;
    director.onMinute(m, [{ minute: m, type, description: '', teamId: left.id, playerId: left.players[4].id, opponentId: right.players[9].id, tacticAction: type === 'tactic' ? 'high_press' : undefined }], 55, { left: 'balanced', right: 'balanced' }, null);
  };

  const shootout = () => {
    clear();
    virtual.current.frozen = null;
    setFlow(false);
    director.startShootout();
    for (let i = 0; i < 6; i++) {
      after(1000 + i * (SHOOTOUT_BUILDUP_MS + SHOOTOUT_HOLD_MS), () => {
        const team = i % 2 === 0 ? left : right;
        const keeper = i % 2 === 0 ? right : left;
        director.shootoutKick({ teamId: team.id, takerName: '', gkName: '', isGoal: i % 3 !== 1 }, i, { takerId: team.players[10 - i].id, gkId: keeper.players[0].id });
      });
    }
  };

  const button = 'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10';
  return (
    <div className="min-h-screen bg-[#0b0b14] p-4 text-white">
      <h1 className="mb-3 text-xl font-black">Galeria de lances</h1>
      <div className="mx-auto max-w-4xl">
        <PitchErrorBoundary>
          <LivePitch director={director} players={players} colors={{ left: '#ffd700', right: '#6366f1' }} teamNames={{ left: 'MEU TIME', right: 'ADVERSÁRIO' }} className="rounded-xl" />
        </PitchErrorBoundary>
      </div>
      <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center gap-2">
        <select className="rounded-lg bg-white/10 p-2" value={kind} onChange={e => setKind(e.target.value as PlayKind)}>
          {DANGER_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="rounded-lg bg-white/10 p-2" value={outcome} onChange={e => setOutcome(e.target.value as DangerOutcome)}>
          <option value="goal">gol</option><option value="save">defesa</option><option value="miss">para fora</option><option value="duel">desarme (lance parado antes do chute)</option>
        </select>
        <select className="rounded-lg bg-white/10 p-2" value={side} onChange={e => setSide(e.target.value as 'left' | 'right')}>
          <option value="left">meu time ataca</option><option value="right">adversário ataca</option>
        </select>
        <select className="rounded-lg bg-white/10 p-2" value={variant} onChange={e => setVariant(e.target.value as PlayVariant | '')}>
          <option value="">variação aleatória</option>
          {variants.map(v => <option key={v} value={v}>{isEpicVariant(kind, v) ? `⚡ ${v}` : v}</option>)}
        </select>
        <select className="rounded-lg bg-white/10 p-2" value={finish} disabled={!variant} onChange={e => setFinish(e.target.value as FinishStyle | '')}>
          <option value="">desfecho aleatório</option>
          {finishes.map(f => <option key={f} value={f}>{EPIC_FINISHES.includes(f) ? `⚡ ${f}` : f}</option>)}
        </select>
        <input className="w-36 rounded-lg bg-white/10 p-2" placeholder="congelar (ms)" inputMode="numeric" value={freezeAt} onChange={e => setFreezeAt(e.target.value.replace(/\D/g, ''))} />
        <button className={button} onClick={fire}>Disparar lance</button>
        <button className={button} onClick={() => setSpeed(speed === 1 ? 0.25 : 1)}>{speed === 1 ? 'Câmera lenta' : 'Velocidade normal'}</button>
        <button className={button} onClick={() => setFlow(f => !f)}>{flow ? 'Parar jogo corrido' : 'Jogo corrido'}</button>
        {(['foul', 'yellow', 'red', 'injury', 'tactic', 'corner', 'duel'] as const).map(type => (
          <button key={type} className={button} onClick={() => cueEvent(type)}>{type}</button>
        ))}
        <button className={button} onClick={shootout}>Disputa de pênaltis</button>
      </div>
    </div>
  );
}
