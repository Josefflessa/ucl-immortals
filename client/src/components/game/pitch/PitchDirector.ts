/**
 * Plays the live pitch in step with the match screen. It owns no game state:
 * the page tells it what happened (a minute's events, the next chance coming,
 * a danger and its narration stage, a shootout kick) and it decides what is on
 * the pitch. Open play is the radio view (ZoneModel: where the game is, no
 * players); dangers and shootout kicks play scripted timelines with the players.
 * The live pitch reads positions with sample() every frame and re-renders only
 * when the snapshot changes.
 */
import type { MatchEvent, PenaltyKick } from '@shared/game/engine/teamModel';
import {
  BALL_SLOT, buildDangerTimeline, buildShootoutKick, kickoffPositions, otherSide, PLAYERS_PER_SIDE,
  quickEventCue, sampleTimeline, shootoutLineup, sideOfTeam, slotBase, slotOfPlayer, stageStartMs, thirdFor, ZoneModel, DEFAULT_TIMING, type DangerTiming, type LeadIn,
  type Beat, type CastEntry, type Cue, type Touch, type DangerOutcome, type PitchSides, type PitchView, type Side, type Timeline, type Zone,
} from '@shared/game/pitch';
import type { FinishStyle, PlayVariant } from '@shared/game/playVariants';
import { seedFromString } from '@shared/game/random';

export type PitchMode = 'flow' | 'danger' | 'shootout' | 'idle';
export type PitchBeat = Beat & { id: number };

export interface PitchSnapshot {
  mode: PitchMode;
  /** Where open play is (the radio view); null while the players are on screen. */
  zone: Zone | null;
  cast: CastEntry[];
  cue: (Cue & { id: number }) | null;
  tactic: (Cue & { id: number }) | null;
  /** The latest beats (cut, strike, net, save…), newest last. */
  beats: readonly PitchBeat[];
  /** Who plays the ball and when, in the current play (empty in the radio view). */
  touches: readonly Touch[];
  sentOff: ReadonlySet<number>;
  injured: ReadonlySet<number>;
  focus: PitchView | null;
  /** The close-up the camera moves to at the strike. */
  strikeFocus: PitchView | null;
  threat: { side: Side; stage: number } | null;
  /** The current danger's clock (its stages, contact and arrival); the default outside one. */
  timing: DangerTiming;
  /** The current danger is one of the rare, memorable plays. */
  epic: boolean;
}

const KEPT_BEATS = 8;

export class PitchDirector {
  private readonly pos: Float32Array;
  private zone: ZoneModel;
  private segment: Timeline | null = null;
  /** The last lead-ins shown, so the next ones vary. */
  private recentLeads: LeadIn['pattern'][] = [];
  private segmentStart = 0;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private beatQueue: Beat[] = [];
  private nextBeat = 0;
  private seq = 0;
  private lastAttackSide: Side = 'left';
  private dominance = 0.5;
  private snapshot: PitchSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(readonly sides: PitchSides, private readonly matchKey: string, private readonly clock: () => number = () => performance.now()) {
    this.pos = kickoffPositions(sides, 'left');
    this.zone = new ZoneModel({ side: 'left', third: 1 });
    this.snapshot = {
      mode: 'flow', zone: this.zone.zone, cast: [], cue: null, tactic: null, beats: [], touches: [],
      sentOff: new Set(), injured: new Set(), focus: null, strikeFocus: null, threat: null, timing: DEFAULT_TIMING, epic: false,
    };
  }

  // ── React store ──
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): PitchSnapshot => this.snapshot;

  private emit(patch: Partial<PitchSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }

  private pushBeat(beat: Beat): void {
    this.emit({ beats: [...this.snapshot.beats, { ...beat, id: ++this.seq }].slice(-KEPT_BEATS) });
  }

  /** 0..1: how hard the side with the ball is pressing (drives the zone glow). */
  get pressure(): number {
    return this.dominance;
  }

  // ── Clock ──
  private now(): number {
    return this.pausedAt ?? this.clock();
  }

  private elapsed(): number {
    return this.now() - this.segmentStart - this.pausedTotal;
  }

  private restartClock(): void {
    this.segmentStart = this.now();
    this.pausedTotal = 0;
  }

  setPaused(paused: boolean): void {
    if (paused && this.pausedAt === null) this.pausedAt = this.clock();
    else if (!paused && this.pausedAt !== null) {
      this.pausedTotal += this.clock() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  /** Current positions (x, y, z per slot) in the director's own buffer — no allocation. */
  sample(): Float32Array {
    if (this.snapshot.mode === 'flow') {
      this.zone.advanceTo(this.elapsed());
      this.pos[BALL_SLOT * 3] = this.zone.ball.x;
      this.pos[BALL_SLOT * 3 + 1] = this.zone.ball.y;
      this.pos[BALL_SLOT * 3 + 2] = 0;
      return this.pos;
    }
    if (!this.segment) return this.pos;
    const t = this.elapsed();
    sampleTimeline(this.segment, t, this.pos);
    while (this.nextBeat < this.beatQueue.length && this.beatQueue[this.nextBeat].t <= t) {
      this.pushBeat(this.beatQueue[this.nextBeat]);
      this.nextBeat++;
    }
    return this.pos;
  }

  /**
   * Positions `offsetMs` away from now (no beats fired), for the pitch's motion smoothing.
   * Outside a play it is just the current positions.
   */
  sampleAt(offsetMs: number, out: Float32Array): void {
    if (!this.segment || this.snapshot.mode === 'flow') { out.set(this.pos); return; }
    sampleTimeline(this.segment, Math.max(0, this.elapsed() + offsetMs), out);
  }

  private play(timeline: Timeline, beats: Beat[]): void {
    this.segment = timeline;
    this.restartClock();
    this.beatQueue = beats;
    this.nextBeat = 0;
  }

  private startZone(zone: Zone): void {
    this.zone = new ZoneModel(zone, { x: this.pos[BALL_SLOT * 3], y: this.pos[BALL_SLOT * 3 + 1] });
    this.segment = null;
    this.restartClock();
  }

  // ── Open play (the radio view) ──
  /**
   * One replay minute: its events (shots excluded), the momentum (0-100, 100 = the
   * left side dominates), the tactics and which side has the next chance coming.
   */
  onMinute(minute: number, events: MatchEvent[], momentum: number, tactics: { left: string; right: string }, upcoming: Side | null, engine?: { attacking: Side; momentumLeft: number } | null): void {
    void minute;
    void tactics;
    if (this.snapshot.mode !== 'flow') return;
    this.zone.advanceTo(this.elapsed());
    let sentOff = this.snapshot.sentOff;
    let injured = this.snapshot.injured;
    const patch: Partial<PitchSnapshot> = {};
    let side = this.zone.zone.side;
    for (const event of events) {
      const cue = quickEventCue(event, this.sides);
      if (cue?.kind === 'tactic') patch.tactic = { ...cue, id: ++this.seq };
      else if (cue) patch.cue = { ...cue, id: ++this.seq };
      const eventSide = sideOfTeam(this.sides, event.teamId);
      if (!eventSide) continue;
      const slot = slotOfPlayer(this.sides, event.playerId, event.teamId);
      if (event.type === 'red' && slot >= 0) sentOff = new Set(Array.from(sentOff).concat(slot));
      else if (event.type === 'injury' && slot >= 0) injured = new Set(Array.from(injured).concat(slot));
      else if (event.type === 'momentum' || event.type === 'duel') side = eventSide;
      else if (event.type === 'foul') side = otherSide(eventSide); // the fouled side keeps the ball
      else if (event.type === 'corner') {
        this.zone.corner(eventSide);
        side = eventSide;
      }
    }
    // The engine's run of play, when recorded, says exactly who is attacking and how hard.
    if (engine) side = engine.attacking;
    const momentumLeft = engine ? engine.momentumLeft : momentum;
    // The side with a chance coming takes the game to its attacking third.
    const dominance = side === 'left' ? momentumLeft : 100 - momentumLeft;
    this.dominance = Math.min(1, Math.max(0, upcoming ? 1 : dominance / 100));
    const next: Zone = upcoming ? { side: upcoming, third: 2 } : { side, third: thirdFor(dominance) };
    this.zone.set(next, upcoming !== null);
    if (this.zone.zone !== this.snapshot.zone) patch.zone = this.zone.zone;
    if (sentOff !== this.snapshot.sentOff) patch.sentOff = sentOff;
    if (injured !== this.snapshot.injured) patch.injured = injured;
    if (Object.keys(patch).length > 0) this.emit(patch);
  }

  // ── Dangers ──
  /** Plays a danger; returns how the ball reached the decisive move (for the narration's first line). */
  startDanger(event: MatchEvent, eventIndex: number, outcome: DangerOutcome, finish?: FinishStyle, variant?: PlayVariant): LeadIn {
    const eventSide = sideOfTeam(this.sides, event.teamId) ?? 'left';
    // A save and a duel are credited to the defending side; the attack is the other.
    const attackSide = outcome === 'save' || outcome === 'duel' ? otherSide(eventSide) : eventSide;
    const fromRadio = this.snapshot.mode === 'flow' || this.snapshot.mode === 'idle';
    this.sample();
    const danger = buildDangerTimeline({
      sides: this.sides, attackSide, event, outcome, prev: Float32Array.from(this.pos),
      sentOff: this.snapshot.sentOff, entry: fromRadio ? 'fade' : 'cut', finish, variant, recentLeads: this.recentLeads,
      seed: seedFromString(`${this.matchKey}|danger|${eventIndex}`),
    });
    this.lastAttackSide = attackSide;
    this.recentLeads = [...this.recentLeads, danger.lead.pattern].slice(-3);
    this.play(danger.timeline, danger.beats);
    this.emit({ mode: 'danger', zone: null, cast: danger.cast, focus: danger.focus, strikeFocus: danger.strikeFocus, threat: { side: attackSide, stage: 1 }, cue: null, touches: danger.touches, timing: danger.timing, epic: danger.epic });
    return danger.lead;
  }

  /** Time into the current danger (ms), or -1 when none is playing. The narration follows it. */
  playTime(): number {
    return (this.snapshot.mode === 'danger' || this.snapshot.mode === 'shootout') && this.segment ? this.elapsed() : -1;
  }

  /** Re-aligns the danger with the narration stage (1-3) after timers or a pause drift. */
  syncStage(stage: number, consumedInStageMs: number): void {
    if (this.snapshot.mode !== 'danger') return;
    const target = stageStartMs(stage, this.snapshot.timing) + consumedInStageMs;
    const drift = this.elapsed() - target;
    // The narration follows the pitch's clock; only a real gap (a long stall) is corrected.
    if (Math.abs(drift) > 300) this.segmentStart += drift;
    if (this.snapshot.threat && this.snapshot.threat.stage !== stage) this.emit({ threat: { ...this.snapshot.threat, stage } });
  }

  /** Back to the radio view: the players leave and the ball glides to where play restarts. */
  endDanger(goalScoredBy: Side | null): void {
    this.sample();
    const zone: Zone = goalScoredBy
      ? { side: otherSide(goalScoredBy), third: 1 } // kick-off on the centre spot
      : { side: otherSide(this.lastAttackSide), third: 0 }; // the keeper restarts
    this.startZone(zone);
    this.emit({ mode: 'flow', zone, cast: [], focus: null, threat: null, touches: [], timing: DEFAULT_TIMING, epic: false });
  }

  // ── Shootout ──
  startShootout(): void {
    this.sample();
    this.pos.set(shootoutLineup(this.sides));
    this.segment = null;
    this.pushBeat({ t: 0, kind: 'cut', x: 0, y: 0 });
    this.emit({ mode: 'shootout', zone: null, cast: [], focus: { x: 97, y: 34, zoom: 1.6 }, threat: null, cue: null });
  }

  shootoutKick(kick: PenaltyKick, kickIndex: number, ids: { takerId?: string; gkId?: string }): void {
    const kicking = sideOfTeam(this.sides, kick.teamId) ?? 'left';
    const keeping = otherSide(kicking);
    let taker = slotOfPlayer(this.sides, ids.takerId, this.sides[kicking].teamId);
    if (taker < 0) taker = slotBase(kicking) + PLAYERS_PER_SIDE - 1;
    let gk = slotOfPlayer(this.sides, ids.gkId, this.sides[keeping].teamId);
    if (gk < 0) gk = slotBase(keeping);
    this.sample();
    const k = buildShootoutKick({
      sides: this.sides, prev: Float32Array.from(this.pos), takerSlot: taker, goalkeeperSlot: gk,
      isGoal: kick.isGoal, kickIndex, seed: seedFromString(`${this.matchKey}|shootout|${kickIndex}`),
    });
    this.play(k.timeline, k.beats);
    this.emit({ mode: 'shootout', cast: k.cast, focus: k.focus, strikeFocus: k.strikeFocus, touches: k.touches });
  }

  skipToEnd(shootout: boolean): void {
    this.segment = null;
    this.beatQueue = [];
    if (shootout) {
      this.pos.set(shootoutLineup(this.sides));
      this.emit({ mode: 'shootout', zone: null, cast: [], focus: { x: 97, y: 34, zoom: 1.6 }, threat: null, cue: null });
    } else {
      this.emit({ mode: 'idle', zone: null, cast: [], focus: null, threat: null, cue: null });
    }
  }
}

export { BALL_SLOT };
