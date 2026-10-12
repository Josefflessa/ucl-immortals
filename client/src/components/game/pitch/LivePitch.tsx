/**
 * The live pitch. Positions come from the PitchDirector every animation frame and
 * are written straight to the elements' transforms (no React render per frame).
 * The camera eases towards the play in the same loop, and dots and faces keep a
 * real-world scale (a face is always smaller than the goal mouth). React only
 * renders when the snapshot changes: cast, cues, cards and beats.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Flag, Hand, HeartPulse, Repeat, ShieldCheck, Target } from 'lucide-react';
import type { Cue } from '@shared/game/pitch';
import type { Player } from '@shared/game/gameData';
import { statKey } from '@shared/game/gameEngine';
import { BALL_SLOT, roleOfSlot, SHOOTOUT_CONTACT_MS, sideOfSlot, slotBase } from '@shared/game/pitch';
import PlayerPortrait from '../PlayerPortrait';
import type { PitchBeat, PitchDirector } from './PitchDirector';
import './livePitch.css';

interface LivePitchProps {
  director: PitchDirector;
  players: ReadonlyMap<string, Player>;
  colors: { left: string; right: string };
  /** Club names, for the radio view label ("FC PORTO · NO ATAQUE"). */
  teamNames?: { left: string; right: string };
  /** At the final whistle the pitch dims under this card. */
  finalCard?: { title: string; score: string; line: string } | null;
  className?: string;
}

// The drawing shows a margin around the pitch so the nets, a corner taker and a
// ball going behind the goal stay in view. View box in pitch metres:
const VIEW_X = -3;
const VIEW_Y = -2.5;
const VIEW_W = 111;
const VIEW_H = 73;
const GOAL_WIDTH_M = 10; // as drawn (see GOAL_Y_MIN / GOAL_Y_MAX)
/** A one-touch player glows at least this long after his touch (a quick pass still reads). */
const GLOW_HOLD_MS = 450;
/** The next to touch the ball lights up this much before it, as the drawn ball reaches him. */
const GLOW_LEAD_MS = 90;
const SLOTS = Array.from({ length: 22 }, (_, i) => i);
const THREAT = { left: '#22C55E', right: '#EF4444' } as const;
const CARD_COLOR: Record<string, string> = { yellow: '#facc15', red: '#ef4444' };
/**
 * The camera follows its target like a critically damped spring: it starts and
 * stops smoothly, never with a jolt, and settles in ~0.9 s (~0.6 s on the strike).
 */
const CAMERA_SPRING = 4.4;
/** The players' motion filter: weights at -90, -45, +45, +90 ms around now (and the centre). */
const SMOOTH_TAPS: readonly (readonly [number, number])[] = [[-90, 1 / 9], [-45, 2 / 9], [45, 2 / 9], [90, 1 / 9]];
const SMOOTH_CENTRE = 3 / 9;
const STRIKE_SPRING = 6.5;
/** The close-up on the strike: starts this long before it and takes this long, eased. */
const PUSH_IN_LEAD_MS = 450;
const PUSH_IN_MS = 1000;
const PUSH_IN_SPRING = 8;
/** How far (in metres) the camera may look past the drawing's ends, to frame a goal with grass behind it. */
const CAMERA_SLACK_M = 10;

/** Distance from the centre to a posed portrait's edge along a screen-space direction. */
function faceSurfaceRadius(dx: number, dy: number, rx: number, ry: number, angle = 0): number {
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return Math.min(rx, ry);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const ux = (dx * cos + dy * sin) / length;
  const uy = (-dx * sin + dy * cos) / length;
  return 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2);
}


const CHIP_TEXT: Record<Cue['kind'], string> = {
  foul: 'Falta', yellow: 'Cartão amarelo', red: 'Expulso', injury: 'Lesão',
  corner: 'Escanteio', duel: 'Desarme', shot: 'Finalização', tactic: '',
};

function chipIcon(cue: Cue): ReactNode {
  switch (cue.kind) {
    case 'yellow':
    case 'red': return <span className="live-pitch__chip-card" style={{ background: CARD_COLOR[cue.kind] }} />;
    case 'foul': return <Hand size={14} aria-hidden="true" />;
    case 'injury': return <HeartPulse size={14} aria-hidden="true" />;
    case 'corner': return <Flag size={14} aria-hidden="true" />;
    case 'duel': return <ShieldCheck size={14} aria-hidden="true" />;
    case 'shot': return <Target size={14} aria-hidden="true" />;
    case 'tactic': return <Repeat size={14} aria-hidden="true" />;
  }
}

/** How long a notice stays, and which ones matter most when several come at once. */
const CHIP_MS = 1800;
// Only what the narration also reads out: cards, injuries and changes of tactics.
const CHIP_PRIORITY: Partial<Record<Cue['kind'], number>> = { red: 5, injury: 4, yellow: 4, tactic: 3 };
type QueuedCue = Cue & { id: number };

/**
 * The game moves a minute every 0.22 s, far faster than anyone can read. Notices
 * are queued and shown one at a time for CHIP_MS; when the queue backs up, the
 * least important ones are dropped. Duels and passing shots are not shown at all.
 */
function useNoticeQueue(cue: QueuedCue | null, tactic: QueuedCue | null, active: boolean): QueuedCue | null {
  const queue = useRef<QueuedCue[]>([]);
  const seen = useRef(0);
  const [shown, setShown] = useState<QueuedCue | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNext = () => {
    const next = queue.current.shift() ?? null;
    setShown(next);
    timer.current = next ? setTimeout(showNext, CHIP_MS) : null;
  };
  useEffect(() => {
    for (const item of [cue, tactic]) {
      if (!item || item.id <= seen.current || !(item.kind in CHIP_PRIORITY)) continue;
      seen.current = Math.max(seen.current, item.id);
      queue.current.push(item);
    }
    queue.current.sort((a, b) => (CHIP_PRIORITY[b.kind] ?? 0) - (CHIP_PRIORITY[a.kind] ?? 0));
    queue.current = queue.current.slice(0, 2);
    if (!timer.current && queue.current.length > 0) showNext();
  }, [cue, tactic]);
  // A danger takes the whole screen: pending notices are dropped.
  useEffect(() => {
    if (active) return;
    queue.current = [];
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setShown(null);
  }, [active]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return shown;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

const ZONE_WORDS = ['NA DEFESA', 'NO MEIO-CAMPO', 'NO ATAQUE'] as const;

const NET_DEPTH = 2.6;
/** A goal's net in pitch metres; `bulge` pushes its back out (in metres) around `y`. */
function netPath(side: 'left' | 'right', y: number, bulge: number): string {
  const sign = side === 'left' ? -1 : 1;
  const line = side === 'left' ? 0 : 105;
  const back = line + sign * NET_DEPTH;
  const peak = back + sign * bulge;
  return `M${line} 29 L${back} 29 Q${peak} ${y} ${back} 39 L${line} 39 Z`;
}
function netValues(side: 'left' | 'right', y: number): string {
  return [netPath(side, y, 0), netPath(side, y, 0.9), netPath(side, y, 0.3), netPath(side, y, 0)].join(';');
}

/** On the pitch a long name is reduced to its last word ("José Luis Rodríguez" → "Rodríguez"). */
function compactName(name: string): string {
  if (name.length <= 11) return name;
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export default function LivePitch({ director, players, colors, teamNames, finalCard, className }: LivePitchProps) {
  const snap = useSyncExternalStore(director.subscribe, director.getSnapshot, director.getSnapshot);
  const frameRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ballRef = useRef<HTMLDivElement>(null);
  const ballSkinRef = useRef<HTMLSpanElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const faceRefs = useRef(new Map<number, HTMLDivElement>());
  // Portraits that would overlap are pushed slightly apart.
  const castSlotsRef = useRef<number[]>([]);
  castSlotsRef.current = snap.cast.map(c => c.slot);
  const faceOffsets = useRef(new Map<number, { x: number; y: number }>());
  const size = useRef({ w: 0, h: 0 });
  const camera = useRef({ x: 52.5, y: 34, zoom: 1, vx: 0, vy: 0, vz: 0, still: 0, promoted: false });
  // Each portrait's name tag, measured to keep tags from overlapping.
  const nameRefs = useRef(new Map<number, HTMLSpanElement>());
  const focusRef = useRef(snap.focus);
  focusRef.current = snap.focus;
  const strikeRef = useRef<typeof snap.strikeFocus>(null);
  const strikeFocusRef = useRef(snap.strikeFocus);
  strikeFocusRef.current = snap.mode === 'danger' || snap.mode === 'shootout' ? snap.strikeFocus : null;
  // In a danger the camera follows the ball, leaning towards the goal under attack.
  const attackedGoalRef = useRef<'left' | 'right' | null>(null);
  attackedGoalRef.current = snap.mode === 'danger' && snap.strikeFocus ? (snap.strikeFocus.x > 52.5 ? 'right' : 'left') : null;
  const keeperSlots = useRef(new Set<number>());
  const notice = useNoticeQueue(snap.cue, snap.tactic, snap.mode === 'flow');
  // In the radio view there are no players on screen: markers sit on the ball.
  const radio = snap.mode === 'flow' || snap.mode === 'idle';
  const castRef = useRef(snap.cast);
  castRef.current = snap.cast;
  const touchesRef = useRef(snap.touches);
  touchesRef.current = snap.touches;
  const radioRef = useRef(radio);
  radioRef.current = radio;
  // The zone keeps its last place while the players are on, so it can fade back in.
  const lastZone = useRef(snap.zone);
  if (snap.zone) lastZone.current = snap.zone;


  // Beats: cut (fade), strike contact, net ripple, save and post flashes.
  const [effects, setEffects] = useState({ cutId: 0, strike: false, tackle: null as PitchBeat | null, lunge: null as PitchBeat | null, pose: null as PitchBeat | null });
  // A sliding tackle: who is on the ground, until he gets up. A lunge: who darts in, briefly.
  const [downSlot, setDownSlot] = useState(-1);
  const [lungeSlot, setLungeSlot] = useState(-1);
  const downRef = useRef(-1);
  downRef.current = downSlot;
  const lungeRef = useRef(-1);
  lungeRef.current = lungeSlot;
  // A bicycle kick (upside down in the air) or a diving header (flat, head first).
  const [pose, setPose] = useState<{ slot: number; kind: 'flip' | 'dive' } | null>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  useEffect(() => {
    const b = effects.pose;
    if (!b || b.slot === undefined || (b.kind !== 'flip' && b.kind !== 'dive')) return;
    setPose({ slot: b.slot, kind: b.kind });
    const timer = setTimeout(() => setPose(null), b.ms ?? 600);
    return () => clearTimeout(timer);
  }, [effects.pose]);
  useEffect(() => {
    const b = effects.tackle;
    if (!b || b.slot === undefined) return;
    setDownSlot(b.slot);
    const timer = setTimeout(() => setDownSlot(-1), b.ms ?? 650);
    return () => clearTimeout(timer);
  }, [effects.tackle]);
  useEffect(() => {
    const b = effects.lunge;
    if (!b || b.slot === undefined) return;
    setLungeSlot(b.slot);
    const timer = setTimeout(() => setLungeSlot(-1), b.ms ?? 400);
    return () => clearTimeout(timer);
  }, [effects.lunge]);
  const lastBeat = useRef(0);
  // The save pulse and the net are started straight from the frame loop, on the very frame
  // the beat is reached (no React round trip, which would show them a few frames late).
  const flashRef = useRef<HTMLDivElement>(null);
  const kickRef = useRef<HTMLDivElement>(null);
  const skidRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const holderRef = useRef(-1);
  const instantBeat = useRef(0);
  const netAnimLeft = useRef<SVGAnimateElement>(null);
  const netAnimRight = useRef<SVGAnimateElement>(null);
  useEffect(() => {
    const fresh = snap.beats.filter(b => b.id > lastBeat.current);
    if (fresh.length === 0) return;
    lastBeat.current = fresh[fresh.length - 1].id;
    setEffects(prev => {
      const next = { ...prev };
      for (const b of fresh) {
        if (b.kind === 'cut') { next.cutId = b.id; next.strike = false; }
        else if (b.kind === 'strike') next.strike = true;
        else if (b.kind === 'normal' || b.kind === 'save') next.strike = false;
        else if (b.kind === 'tackle') next.tackle = b;
        else if (b.kind === 'lunge') next.lunge = b;
        else if (b.kind === 'flip' || b.kind === 'dive') next.pose = b;
      }
      return next;
    });
  }, [snap.beats]);
  useEffect(() => {
    setEffects(prev => (prev.strike ? { ...prev, strike: false } : prev));
  }, [snap.mode, snap.cast]);


  useEffect(() => {
    const set = new Set<number>();
    for (const s of SLOTS) if (roleOfSlot(director.sides, s) === 'GK') set.add(s);
    keeperSlots.current = set;
  }, [director]);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => { size.current = { w: el.clientWidth, h: el.clientHeight }; };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    // Some embedded browsers keep a visible page but never deliver animation frames. If a
    // frame does not come within 250 ms while the page is visible, a timer drives the loop.
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let timerLoop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timerLoop) { timer = setTimeout(() => tick(performance.now()), 16); return; }
      frame = requestAnimationFrame(tick);
      const check = () => {
        // Hidden: browsers pause frames on purpose; look again later.
        if (document.visibilityState !== 'visible') { watchdog = setTimeout(check, 500); return; }
        cancelAnimationFrame(frame);
        timerLoop = true;
        tick(performance.now());
      };
      watchdog = setTimeout(check, 250);
    };
    let lastTime = performance.now();
    const prev = new Float32Array(BALL_SLOT * 2);
    let primed = false;
    let spin = 0;
    let lastBall = { x: 0, y: 0 };
    const trailHistory: { x: number; y: number }[] = [];
    const drawn = new Float32Array((BALL_SLOT + 1) * 3);
    const tap = new Float32Array((BALL_SLOT + 1) * 3);
    // Where the ball is drawn relative to its true spot: at the feet of whoever's portrait has it.
    const ballAdj = { x: 0, y: 0 };
    // The holder and where he and the ball's true path were last frame (screen px), so a
    // controlled ball moves with him and not with the pass still running through him.
    let prevHolder = -1;
    // Which way from the holder the ball sits (screen, unit): set where it arrives, then
    // turning towards his run.
    const anchor = { slot: -1, x: 1, y: 0 };
    const prevTrue = { x: 0, y: 0 };
    const prevHeld = { x: 0, y: 0 };
    // The strike burst and the save pulse, anchored where the ball was drawn when they fired.
    const bursts: { el: HTMLDivElement | null; px: number; py: number; ax: number; ay: number; lift: number; armed: boolean }[] = [
      { el: null, px: 0, py: 0, ax: 0, ay: 0, lift: 0, armed: false },
      { el: null, px: 0, py: 0, ax: 0, ay: 0, lift: 0, armed: false },
    ];
    let pendingKick = false;
    // A sliding tackle's mark on the grass (or a lunge's short streak): from where he set
    // off, following him while he moves, then fading where he stopped.
    const skid = { on: false, slot: -1, fx: 0, fy: 0, ex: 0, ey: 0, at: 0, moveMs: 0, fadeMs: 0, lunge: false };
    // The white outline: whoever has the ball at his feet, or (for a moment) whoever just
    // touched it — a header, a volley, a strike.
    let lit = -1;
    // During the shot's flight the portraits not in it step back a little (the striker and the
    // keeper stay as they are), so the ball has room and a near miss never reads as a touch.
    const aside = new Set<number>();
    // Smoothed velocities (pitch metres per second) of every player and of the ball, and
    // the way each player faces (his running direction, kept when he stops).
    const velX = new Float32Array(BALL_SLOT + 1);
    const velY = new Float32Array(BALL_SLOT + 1);
    const facing = new Float32Array(BALL_SLOT * 2);
    const downW = new Float32Array(BALL_SLOT);
    const lungeW = new Float32Array(BALL_SLOT);
    const flipW = new Float32Array(BALL_SLOT);
    const diveW = new Float32Array(BALL_SLOT);
    const faceScaleX = new Float32Array(BALL_SLOT);
    const faceScaleY = new Float32Array(BALL_SLOT);
    const faceAngle = new Float32Array(BALL_SLOT);
    const faceShiftY = new Float32Array(BALL_SLOT);
    for (let s = 0; s < BALL_SLOT; s++) facing[s * 2] = s < 11 ? 1 : -1;
    // The touch rhythm of a carry, and the spring that places the ball at the holder's feet.
    let stridePhase = 0;
    // From the strike until the ball arrives nobody has it at his feet (it is in flight).
    let shotInFlight = false;
    let strikeContactPending = false;
    // Where the ball was drawn at the strike (relative to its true spot), and when: that
    // difference melts away over the flight, so the ball always travels forward.
    const strikeAdj = { x: 0, y: 0 };
    let strikeAt = 0;
    let strikeFlightMs = 1350;
    const adjVel = { x: 0, y: 0 };
    let ballSpeed = 0;
    let pendingFlash = false;
    const reduced = prefersReducedMotion();
    // Beats from before this mount are history, not something to play now.
    instantBeat.current = director.getSnapshot().beats.reduce((max, beat) => Math.max(max, beat.id), 0);
    const tick = (time: number) => {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      const dt = Math.min(0.1, Math.max(0.001, (time - lastTime) / 1000));
      lastTime = time;
      // The true positions (they fire the beats), then the players as drawn: a weighted
      // average over ±90 ms, centred so there is no lag. Turns become arcs, starts and stops
      // ease in and out, and every contact still lands on its frame. The ball is not
      // filtered: a kick is sharp.
      const truePos = director.sample();
      const pos = drawn;
      pos.set(truePos);
      if (!reduced && !radioRef.current) {
        for (let i = 0; i < BALL_SLOT * 3; i++) pos[i] *= SMOOTH_CENTRE;
        for (const [offset, weight] of SMOOTH_TAPS) {
          director.sampleAt(offset, tap);
          for (let i = 0; i < BALL_SLOT * 3; i++) pos[i] += tap[i] * weight;
        }
      }
      // Beats reached on this frame: pulse and net now, in the same frame as the ball.
      for (const b of director.getSnapshot().beats) {
        if (b.id <= instantBeat.current) continue;
        instantBeat.current = b.id;
        // The strike burst and the save pulse fire below, where the ball is drawn on this frame.
        if (b.kind === 'strike') {
          pendingKick = true;
          shotInFlight = true;
          strikeContactPending = true;
          strikeAdj.x = ballAdj.x;
          strikeAdj.y = ballAdj.y;
          strikeFlightMs = b.flightMs ?? 1350;
          strikeAt = time;
        }
        else if (b.kind === 'normal' || b.kind === 'cut') { shotInFlight = false; strikeContactPending = false; }
        else if (b.kind === 'save') {
          // The first flight is over; a rebound is loose until another player controls it.
          // A later strike beat starts a fresh shot (and a fresh contact anchor).
          shotInFlight = false;
          strikeContactPending = false;
          pendingFlash = true;
        }
        else if (b.kind === 'post' || b.kind === 'block') pendingFlash = true;
        else if ((b.kind === 'tackle' || b.kind === 'lunge') && b.slot !== undefined && b.fx !== undefined && b.fy !== undefined) {
          const lunge = b.kind === 'lunge';
          // A slide moves for its launch and glide (560 ms); a lunge for its dart and brake.
          Object.assign(skid, { on: true, slot: b.slot, fx: b.fx, fy: b.fy, ex: b.fx, ey: b.fy, at: time, moveMs: lunge ? Math.max(120, (b.ms ?? 400) - 80) : 560, fadeMs: lunge ? 320 : 1100, lunge });
          skidRef.current?.classList.toggle('live-pitch__skid--lunge', lunge);
        }
        else if (b.kind === 'net') {
          const right = b.x > 52.5;
          const anim = right ? netAnimRight.current : netAnimLeft.current;
          anim?.setAttribute('values', netValues(right ? 'right' : 'left', b.y));
          try { anim?.beginElement(); } catch { /* no SMIL support: the net just stays still */ }
        }
      }
      const { w, h } = size.current;
      const sx = w / VIEW_W;
      const sy = h / VIEW_H;

      // Camera: ease towards the play (or the whole pitch), clamped to the drawing.
      // Build-up framing, then the close-up on the strike and the goal.
      const focus = reduced ? null : strikeRef.current ?? focusRef.current;
      let target = focus ?? { x: 52.5, y: 34, zoom: 1 };
      const goalSide = attackedGoalRef.current;
      // How far into the close-up on the strike: it starts as the shooter shapes up and is
      // there just after the strike, one smooth push-in (no jolt at the strike, and no
      // second move once the ball has arrived).
      const playTime = director.playTime();
      const strikeFocus = strikeFocusRef.current;
      const now = director.getSnapshot();
      const contactAt = now.mode === 'shootout' ? SHOOTOUT_CONTACT_MS : now.timing.contactMs;
      // An epic: the camera starts closing in a little earlier.
      const pushLead = now.epic ? PUSH_IN_LEAD_MS + 250 : PUSH_IN_LEAD_MS;
      const into = reduced || !strikeFocus || playTime < 0 ? 0 : Math.min(1, Math.max(0, (playTime - (contactAt - pushLead)) / PUSH_IN_MS));
      const pushIn = into * into * (3 - 2 * into);
      if (!reduced && goalSide && focusRef.current) {
        // Build-up, like a broadcast: on the ball, with room ahead of it towards the goal.
        const ahead = goalSide === 'right' ? 9 : -9;
        target = {
          x: pos[BALL_SLOT * 3] + ahead,
          y: pos[BALL_SLOT * 3 + 1] * 0.75 + 34 * 0.25,
          zoom: Math.min(2.2, Math.max(1.7, focusRef.current.zoom)),
        };
      }
      if (strikeFocus && pushIn > 0) {
        target = {
          x: target.x + (strikeFocus.x - target.x) * pushIn,
          y: target.y + (strikeFocus.y - target.y) * pushIn,
          zoom: target.zoom + (strikeFocus.zoom - target.zoom) * pushIn,
        };
      }
      const cam = camera.current;
      // The push-in target already moves smoothly: the camera keeps close to it.
      const spring = pushIn > 0 ? PUSH_IN_SPRING : strikeRef.current ? STRIKE_SPRING : CAMERA_SPRING;
      const step = Math.min(dt, 0.05);
      const ty = target.y;
      cam.vx += (spring * spring * (target.x - cam.x) - 2 * spring * cam.vx) * step;
      cam.vy += (spring * spring * (ty - cam.y) - 2 * spring * cam.vy) * step;
      cam.vz += (spring * spring * (target.zoom - cam.zoom) - 2 * spring * cam.vz) * step;
      cam.x += cam.vx * step;
      cam.y += cam.vy * step;
      cam.zoom = Math.max(1, cam.zoom + cam.vz * step);
      if (reduced) { cam.x = target.x; cam.y = ty; cam.zoom = target.zoom; }
      const z = cam.zoom;
      const half = 50 / z;
      // Zoomed in, it may look a little past the ends of the drawing (grass behind the goal).
      const slackX = ((CAMERA_SLACK_M / VIEW_W) * 100) * Math.min(1, Math.max(0, (z - 1) / 0.5));
      const cx = Math.min(100 - half + slackX, Math.max(half - slackX, ((cam.x - VIEW_X) / VIEW_W) * 100));
      const cy = Math.min(100 - half, Math.max(half, ((cam.y - VIEW_Y) / VIEW_H) * 100));
      if (cameraRef.current) {
        cameraRef.current.style.transform = `translate(${50 - z * cx}%, ${50 - z * cy}%) scale(${z})`;
        // While the camera moves, the grass is its own layer (moved, not redrawn, each frame:
        // the redraw of the whole pitch is what stutters on phones); once it has settled, it
        // goes back to being drawn, so its lines are crisp again at the new zoom.
        const moving = Math.abs(cam.vx) + Math.abs(cam.vy) > 0.08 || Math.abs(cam.vz) > 0.004;
        cam.still = moving ? 0 : cam.still + step;
        const promote = cam.still < 0.4;
        if (promote !== cam.promoted) {
          cam.promoted = promote;
          cameraRef.current.style.willChange = promote ? 'transform' : 'auto';
        }
      }
      // Only the grass is scaled by the camera. Players, faces, names and the ball are
      // placed in screen pixels at their real size, so they stay sharp at any zoom.
      const tx = ((50 - z * cx) / 100) * w;
      const tyPx = ((50 - z * cy) / 100) * h;
      const X = (x: number) => (x - VIEW_X) * sx * z + tx;
      const Y = (y: number) => (y - VIEW_Y) * sy * z + tyPx;

      // Real-world scale: a dot ~1.9 m and a face under half the goal mouth, never unreadable.
      const pxPerM = sx * z;
      const dotPx = Math.min(22, Math.max(10, 2 * pxPerM));
      // A face is about a third of the goal mouth on screen: the goal always dwarfs the keeper.
      const facePx = Math.min(66, Math.max(26, GOAL_WIDTH_M * pxPerM * 0.42));
      const ballPx = Math.min(20, Math.max(10, 1.7 * pxPerM));
      if (layerRef.current) {
        layerRef.current.style.setProperty('--dot', `${dotPx}px`);
        layerRef.current.style.setProperty('--face', `${facePx}px`);
        layerRef.current.style.setProperty('--ball', `${ballPx}px`);
      }
      if (zoneRef.current) zoneRef.current.style.setProperty('--strength', String(0.45 + director.pressure * 0.55));

      // Callouts: relax the portraits apart (in screen pixels), smoothly, never jumping.
      const faceL = facePx;
      const cast = castSlotsRef.current;
      const gap = 3;
      const anchors = cast.map(s => {
        // The portrait and its tag (below it for the left side, above for the right).
        const tag = nameRefs.current.get(s);
        const tagW = tag?.offsetWidth ?? 0;
        const tagH = (tag?.offsetHeight ?? 0) + 2;
        const below = sideOfSlot(s) === 'left' ? 1 : -1;
        return { s, x: X(pos[s * 3]), y: Y(pos[s * 3 + 1]), hw: Math.max(faceL, tagW) / 2 + gap, hh: (faceL + tagH) / 2 + gap, cy: (below * tagH) / 2 };
      });
      const goal = anchors.map(a => {
        const o = faceOffsets.current.get(a.s) ?? { x: 0, y: 0 };
        return { x: o.x * 0.96, y: o.y * 0.96 }; // drift home slowly when there is room
      });
      for (let iteration = 0; iteration < 12; iteration++) {
        for (let i = 0; i < anchors.length; i++) {
          for (let j = i + 1; j < anchors.length; j++) {
            const a = anchors[i], b = anchors[j];
            // Opponents in a duel (a challenge, a block) may overlap a little, which reads as
            // the contact it is; their tags sit on opposite sides. Team-mates stay apart, tags too.
            const duel = sideOfSlot(a.s) !== sideOfSlot(b.s);
            let dx = a.x + goal[i].x - (b.x + goal[j].x);
            const dy = duel ? a.y + goal[i].y - (b.y + goal[j].y) : a.y + a.cy + goal[i].y - (b.y + b.cy + goal[j].y);
            const ox = (duel ? faceL * 0.7 : a.hw + b.hw) - Math.abs(dx);
            const oy = (duel ? faceL * 0.7 : a.hh + b.hh) - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;
            // Apart along the shorter way out (sideways when level, so tags sit side by side).
            if (ox < oy) {
              if (Math.abs(dx) < 0.01) dx = i % 2 ? 1 : -1;
              const push = (ox / 2) * Math.sign(dx);
              goal[i].x += push; goal[j].x -= push;
            } else {
              const sy = dy === 0 ? (a.cy >= b.cy ? 1 : -1) : Math.sign(dy);
              goal[i].y += (oy / 2) * sy; goal[j].y -= (oy / 2) * sy;
            }
          }
        }
      }
      const follow = 1 - Math.pow(1 - 0.45, dt * 60);
      anchors.forEach((a, i) => {
        const prevOff = faceOffsets.current.get(a.s) ?? { x: 0, y: 0 };
        const next = { x: prevOff.x + (goal[i].x - prevOff.x) * follow, y: prevOff.y + (goal[i].y - prevOff.y) * follow };
        faceOffsets.current.set(a.s, next);
      });
      for (const s of Array.from(faceOffsets.current.keys())) if (!cast.includes(s)) faceOffsets.current.delete(s);

      for (let s = 0; s < 22; s++) {
        const x = pos[s * 3];
        const y = pos[s * 3 + 1];
        const height = pos[s * 3 + 2];
        const vx = primed ? (x - prev[s * 2]) / dt : 0;
        const vy = primed ? (y - prev[s * 2 + 1]) / dt : 0;
        let shapeX = 1, shapeY = 1, angle = 0, shiftY = 0;
        prev[s * 2] = x;
        prev[s * 2 + 1] = y;
        // A keeper in the air with lateral speed is diving: lean the body into it.
        let pose = '';
        if (keeperSlots.current.has(s) && height > 0.12) {
          const lean = Math.max(-75, Math.min(75, vy * 9));
          pose = ` rotate(${Math.abs(vy) > 1 ? lean : 0}deg) scaleY(1.12)`;
          shapeY *= 1.12;
          angle = Math.abs(vy) > 1 ? lean * Math.PI / 180 : 0;
        } else if (height > 0.05) {
          shapeX *= 1 + height * 0.3;
          shapeY *= 1 + height * 0.3;
          pose = ` scale(${1 + height * 0.3})`;
        }
        // Down on the grass after a slide, or stretching into a lunge (eased in and out over ~140 ms).
        const ease = Math.min(1, dt / 0.14);
        downW[s] += ((s === downRef.current ? 1 : 0) - downW[s]) * ease;
        lungeW[s] += ((s === lungeRef.current ? 1 : 0) - lungeW[s]) * ease;
        // A bicycle kick turns him over in the air; a diving header lays him flat, head first.
        const poseNow = poseRef.current;
        flipW[s] += ((poseNow?.slot === s && poseNow.kind === 'flip' ? 1 : 0) - flipW[s]) * Math.min(1, dt / 0.12);
        diveW[s] += ((poseNow?.slot === s && poseNow.kind === 'dive' ? 1 : 0) - diveW[s]) * Math.min(1, dt / 0.1);
        if (flipW[s] > 0.01) pose += ` rotate(${(flipW[s] * 180).toFixed(1)}deg)`;
        if (diveW[s] > 0.01) {
          shapeX *= 1 + 0.25 * diveW[s];
          shapeY *= 1 - 0.14 * diveW[s];
          pose += ` scale(${(1 + 0.25 * diveW[s]).toFixed(3)},${(1 - 0.14 * diveW[s]).toFixed(3)})`;
        }
        // A slide should read as a low, stretched movement, not a portrait crushed flat.
        if (downW[s] > 0.01) pose += ` translateY(${(downW[s] * 11).toFixed(1)}%) scale(${(1 + 0.14 * downW[s]).toFixed(3)},${(1 - 0.16 * downW[s]).toFixed(3)})`;
        else if (lungeW[s] > 0.01) pose += ` scale(${(1 + 0.22 * lungeW[s]).toFixed(3)})`;
        if (downW[s] > 0.01) {
          shapeX *= 1 + 0.14 * downW[s];
          shapeY *= 1 - 0.16 * downW[s];
          shiftY = facePx * downW[s] * 0.11;
        } else if (lungeW[s] > 0.01) {
          // The frame-loop stretch composes with the CSS 1.1 scale on the portrait image.
          shapeX *= (1 + 0.22 * lungeW[s]) * 1.1;
          shapeY *= (1 + 0.22 * lungeW[s]) * 1.1;
        }
        faceScaleX[s] = shapeX;
        faceScaleY[s] = shapeY;
        faceAngle[s] = angle;
        faceShiftY[s] = shiftY;
        const follow = 1 - Math.pow(1 - 0.25, dt * 60);
        velX[s] += (vx - velX[s]) * follow;
        velY[s] += (vy - velY[s]) * follow;
        const running = Math.hypot(velX[s], velY[s]);
        if (running > 0.8) {
          facing[s * 2] += (velX[s] / running - facing[s * 2]) * follow;
          facing[s * 2 + 1] += (velY[s] / running - facing[s * 2 + 1]) * follow;
        }
        const dot = dotRefs.current[s];
        if (dot) dot.style.transform = `translate3d(${X(x)}px,${Y(y)}px,0)${pose}`;
        const face = faceRefs.current.get(s);
        if (face) {
          // Only the portrait leans into a dive; the name tag stays level.
          const o = faceOffsets.current.get(s) ?? { x: 0, y: 0 };
          // Lift the portrait away from its ground shadow when the player jumps.
          const lift = height * sy * z * 0.5;
          face.style.transform = `translate3d(${X(x) + o.x}px,${Y(y) + o.y - lift}px,0)`;
          face.style.setProperty('--pose', pose || 'none');
          // Off the ground (a hop, a header): his shadow stays on the grass below.
          face.style.setProperty('--air', height > 0.05 ? height.toFixed(2) : '0');
        }
      }
      primed = true;

      const ballFollow = 1 - Math.pow(1 - 0.3, dt * 60);
      const bvx = primed ? (pos[BALL_SLOT * 3] - lastBall.x) / dt : 0;
      const bvy = primed ? (pos[BALL_SLOT * 3 + 1] - lastBall.y) / dt : 0;
      velX[BALL_SLOT] += (Math.max(-60, Math.min(60, bvx)) - velX[BALL_SLOT]) * ballFollow;
      velY[BALL_SLOT] += (Math.max(-60, Math.min(60, bvy)) - velY[BALL_SLOT]) * ballFollow;
      ballSpeed = Math.hypot(velX[BALL_SLOT], velY[BALL_SLOT]);
      // How fast the ball moves away from a player: near zero while he carries it.
      const relSpeed = (s: number) => Math.hypot(bvx - velX[s], bvy - velY[s]);
      void relSpeed;
      // On the ball, from the play's own record of who touches it (never from just being near):
      // the last player to touch it has it while it stays at his feet; a struck or passed ball
      // belongs to nobody until the next touch.
      const gapTo = (s: number) => Math.hypot(pos[s * 3] - pos[BALL_SLOT * 3], pos[s * 3 + 1] - pos[BALL_SLOT * 3 + 1]);
      let lastTouch: { t: number; slot: number } | null = null;
      let nextTouch: { t: number; slot: number } | null = null;
      if (playTime >= 0 && !radioRef.current) {
        for (const touch of touchesRef.current) {
          if (touch.t > playTime + 20) { nextTouch = touch; break; }
          lastTouch = touch;
        }
      }
      const sameCarrier = lastTouch?.slot === holderRef.current;
      // Keep possession through small side-to-side touches while dribbling. A pass quickly
      // leaves this wider control radius, while a carried ball no longer drops its halo.
      const controlRadius = sameCarrier ? 2.4 : 1.6;
      const holder = lastTouch && !shotInFlight && pos[BALL_SLOT * 3 + 2] < 0.9 && gapTo(lastTouch.slot) < controlRadius ? lastTouch.slot : -1;
      holderRef.current = holder;

      // At the holder's feet: in front of him, the way he faces, just clear of his portrait (or
      // dot), rolling out and back with his stride. A spring takes the ball there and, once it
      // is played, back onto its true path, so it never jumps.
      let adjX = 0;
      let adjY = 0;
      if (holder < 0) anchor.slot = -1;
      if (holder >= 0) {
        const off = faceOffsets.current.get(holder);
        const speed = Math.hypot(velX[holder], velY[holder]);
        stridePhase += (speed * dt) / 1.9;
        const touch = 0.18 * Math.sin(stridePhase * Math.PI * 2) * Math.min(1, speed / 5);
        let fx = facing[holder * 2] * sx;
        let fy = facing[holder * 2 + 1] * sy;
        const flen = Math.hypot(fx, fy) || 1;
        fx /= flen; fy /= flen;
        // Received: the ball stops on the side it came from (the foot that takes it), never
        // running through him to his far side; carrying it, it swings round in front of him.
        const hx = X(pos[holder * 3]) + (off?.x ?? 0), hy = Y(pos[holder * 3 + 1]) + (off?.y ?? 0);
        if (holder !== anchor.slot) {
          const bx0 = X(pos[BALL_SLOT * 3]) + ballAdj.x - hx, by0 = Y(pos[BALL_SLOT * 3 + 1]) + ballAdj.y - hy;
          const blen = Math.hypot(bx0, by0);
          Object.assign(anchor, blen > 1 ? { slot: holder, x: bx0 / blen, y: by0 / blen } : { slot: holder, x: fx, y: fy });
        } else {
          const turn = Math.min(1, dt * 3.5 * Math.min(1, speed / 2));
          anchor.x += (fx - anchor.x) * turn;
          anchor.y += (fy - anchor.y) * turn;
          const alen = Math.hypot(anchor.x, anchor.y) || 1;
          anchor.x /= alen; anchor.y /= alen;
        }
        fx = anchor.x; fy = anchor.y;
        const holderX = X(pos[holder * 3]) + (off?.x ?? 0);
        const playerLift = pos[holder * 3 + 2] * sy * z * 0.5;
        const holderY = Y(pos[holder * 3 + 1]) + (off?.y ?? 0) - playerLift + faceShiftY[holder];
        const holderSize = faceRefs.current.has(holder) ? facePx : dotPx;
        const radius = faceSurfaceRadius(
          fx,
          fy,
          holderSize * faceScaleX[holder] / 2,
          holderSize * faceScaleY[holder] / 2,
          faceAngle[holder],
        );
        const ballLift = pos[BALL_SLOT * 3 + 2] * sy * z * 0.5;
        const ballRadius = ballPx * (1 + pos[BALL_SLOT * 3 + 2] * 0.12) / 2;
        const reach = radius + ballRadius + Math.max(0, touch) * pxPerM;
        adjX = holderX + fx * reach - X(pos[BALL_SLOT * 3]);
        adjY = holderY + fy * reach + ballLift - Y(pos[BALL_SLOT * 3 + 1]);
      }
      // A header or a volley: a ball in the air reaching a featured player is drawn meeting
      // his portrait (its height lift compensated), drawn in as it arrives and released as it
      // leaves, so the contact reads even with the portraits nudged apart.
      let toucher = -1;
      let touchWeight = 0;
      if (holder < 0 && !radioRef.current && !shotInFlight) {
        const bz0 = pos[BALL_SLOT * 3 + 2];
        if (bz0 > 0.5 && bz0 < 2.8) {
          // The finisher first (he is the one meeting it); otherwise whoever is nearest.
          let best = 3;
          if (cast.length > 0 && gapTo(cast[0]) < best) { best = gapTo(cast[0]); toucher = cast[0]; }
          else {
            for (const s of cast) {
              const g = gapTo(s);
              if (g < best) { best = g; toucher = s; }
            }
          }
          if (toucher >= 0) {
            const u = 1 - best / 3;
            touchWeight = u * u * (3 - 2 * u);
          }
        }
      }
      if (toucher >= 0 && touchWeight > 0) {
        const off = faceOffsets.current.get(toucher);
        const px = X(pos[toucher * 3]) + (off?.x ?? 0);
        const playerLift = pos[toucher * 3 + 2] * sy * z * 0.5;
        const py = Y(pos[toucher * 3 + 1]) + (off?.y ?? 0) - playerLift + faceShiftY[toucher];
        const bxTrue = X(pos[BALL_SLOT * 3]);
        const byTrue = Y(pos[BALL_SLOT * 3 + 1]);
        const ballLift = pos[BALL_SLOT * 3 + 2] * sy * z * 0.5;
        let dx = bxTrue - px;
        let dy = byTrue - ballLift - py;
        let dlen = Math.hypot(dx, dy);
        if (dlen < 0.001) {
          dx = facing[toucher * 2] * sx * z;
          dy = facing[toucher * 2 + 1] * sy * z;
          dlen = Math.hypot(dx, dy) || 1;
        }
        dx /= dlen; dy /= dlen;
        const toucherSize = faceRefs.current.has(toucher) ? facePx : dotPx;
        const faceReach = faceSurfaceRadius(
          dx,
          dy,
          toucherSize * faceScaleX[toucher] / 2,
          toucherSize * faceScaleY[toucher] / 2,
          faceAngle[toucher],
        );
        const reach = faceReach + ballPx * (1 + pos[BALL_SLOT * 3 + 2] * 0.12) / 2;
        adjX = (px + dx * reach - bxTrue) * touchWeight;
        adjY = (py + dy * reach + ballLift - byTrue) * touchWeight;
      }
      const springW = holder >= 0 || toucher >= 0 ? 24 : shotInFlight ? 34 : 16;
      // Who glows: the holder; or whoever just touched the ball (a one-touch pass, a header, a
      // strike, a save), long enough to be seen and until the ball has left him; and the next
      // to touch it a beat early, as the drawn ball (which glides to his feet) gets there. Only
      // real touches: nobody lights up for passing close by.
      const glow = holder >= 0 ? holder
        : nextTouch && nextTouch.t - playTime <= GLOW_LEAD_MS ? nextTouch.slot
          : lastTouch && (playTime - lastTouch.t < GLOW_HOLD_MS || (!shotInFlight && gapTo(lastTouch.slot) < 2.2)) ? lastTouch.slot : -1;
      const shooter = shotInFlight && lastTouch ? lastTouch.slot : -1;
      for (const { slot, role } of castRef.current) {
        const step = shotInFlight && slot !== shooter && role !== 'goalkeeper';
        if (step === aside.has(slot)) continue;
        faceRefs.current.get(slot)?.classList.toggle('live-pitch__face--aside', step);
        if (step) aside.add(slot); else aside.delete(slot);
      }
      if (glow !== lit) {
        dotRefs.current[lit]?.classList.remove('live-pitch__dot--ball');
        faceRefs.current.get(lit)?.classList.remove('live-pitch__face--ball');
        lit = glow;
      }
      // Portrait nodes can be mounted again for a new cast while the same slot stays lit.
      // Reapply to the current node so the ring cannot disappear during a carried ball.
      if (glow >= 0) {
        dotRefs.current[glow]?.classList.add('live-pitch__dot--ball');
        faceRefs.current.get(glow)?.classList.add('live-pitch__face--ball');
      }
      if (shotInFlight) {
        if (strikeContactPending && lastTouch) {
          const striker = lastTouch.slot;
          const face = faceRefs.current.has(striker);
          const off = face ? faceOffsets.current.get(striker) : undefined;
          const playerX = X(pos[striker * 3]) + (off?.x ?? 0);
          const playerLift = pos[striker * 3 + 2] * sy * z * 0.5;
          const playerY = Y(pos[striker * 3 + 1]) + (off?.y ?? 0) - playerLift + faceShiftY[striker];
          const ballX = X(pos[BALL_SLOT * 3]);
          const ballY = Y(pos[BALL_SLOT * 3 + 1]) - pos[BALL_SLOT * 3 + 2] * sy * z * 0.5;
          // Keep the side the ball was visibly on while the player controlled or met it.
          // The authored pitch point is often close to the marker's centre, so deriving the
          // contact side from it alone can make the ball jump around the portrait on impact.
          let dx = ballX + ballAdj.x - playerX;
          let dy = ballY + ballAdj.y - playerY;
          let distance = Math.hypot(dx, dy);
          if (distance < 1) {
            dx = facing[striker * 2] * sx * z;
            dy = facing[striker * 2 + 1] * sy * z;
            distance = Math.hypot(dx, dy) || 1;
          }
          const ballScale = 1 + pos[BALL_SLOT * 3 + 2] * 0.12;
          const strikerSize = face ? facePx : dotPx;
          const surfaceRadius = faceSurfaceRadius(
            dx,
            dy,
            strikerSize * faceScaleX[striker] / 2,
            strikerSize * faceScaleY[striker] / 2,
            faceAngle[striker],
          );
          const contactRadius = surfaceRadius + ballPx * ballScale / 2;
          const contactX = playerX + (dx / distance) * contactRadius;
          const contactY = playerY + (dy / distance) * contactRadius;
          // The ball's true contact point is authored in pitch metres, while the portrait is
          // drawn at a fixed screen size. Align the visible ball to the portrait's circumference
          // on the strike frame, then let this correction melt into the real shot path.
          strikeAdj.x = contactX - ballX;
          strikeAdj.y = contactY - (Y(pos[BALL_SLOT * 3 + 1]) - pos[BALL_SLOT * 3 + 2] * sy * z * 0.5);
          strikeContactPending = false;
        }
        // The strike's offset melts away along its flight; a rebound strike has less time to arrival.
        const u = Math.min(1, (time - strikeAt) / Math.max(1, strikeFlightMs));
        const keep = 1 - u * u * (3 - 2 * u);
        adjX = strikeAdj.x * keep;
        adjY = strikeAdj.y * keep;
        ballAdj.x = adjX;
        ballAdj.y = adjY;
        adjVel.x = 0;
        adjVel.y = 0;
      }
      // A controlled ball follows the holder, not its true path (which may still be running
      // through him): the path's own motion relative to him is taken out of the offset. On the
      // first touch the ball keeps its speed only up to what reaches his feet without running
      // past them, so it settles there at once instead of overshooting and coming back.
      const trueX = X(pos[BALL_SLOT * 3]);
      const trueY = Y(pos[BALL_SLOT * 3 + 1]);
      if (holder >= 0) {
        const heldX = X(pos[holder * 3]);
        const heldY = Y(pos[holder * 3 + 1]);
        if (holder === prevHolder) {
          ballAdj.x -= trueX - prevTrue.x - (heldX - prevHeld.x);
          ballAdj.y -= trueY - prevTrue.y - (heldY - prevHeld.y);
        } else if (dt > 0) {
          // The ball as drawn, relative to him (px/s).
          const vx = (trueX - prevTrue.x) / dt + adjVel.x - velX[holder] * sx * z;
          const vy = (trueY - prevTrue.y) / dt + adjVel.y - velY[holder] * sy * z;
          const dx = adjX - ballAdj.x;
          const dy = adjY - ballAdj.y;
          const d = Math.hypot(dx, dy) || 1;
          const along = Math.max(0, Math.min((vx * dx + vy * dy) / d, springW * d));
          adjVel.x = (dx / d) * along;
          adjVel.y = (dy / d) * along;
        }
        prevHeld.x = heldX;
        prevHeld.y = heldY;
      }
      prevTrue.x = trueX;
      prevTrue.y = trueY;
      prevHolder = holder;
      for (let i = 0; i < 2 && !shotInFlight; i++) {
        const h2 = Math.min(dt, 0.05) / 2;
        adjVel.x += (springW * springW * (adjX - ballAdj.x) - 2 * springW * adjVel.x) * h2;
        adjVel.y += (springW * springW * (adjY - ballAdj.y) - 2 * springW * adjVel.y) * h2;
        ballAdj.x += adjVel.x * h2;
        ballAdj.y += adjVel.y * h2;
      }
      const bx = X(pos[BALL_SLOT * 3]) + ballAdj.x;
      const by = Y(pos[BALL_SLOT * 3 + 1]) + ballAdj.y;
      const bz = pos[BALL_SLOT * 3 + 2];
      // Bursts: armed on their beat at the ball as drawn, then kept on that spot of the pitch.
      if (layerRef.current) layerRef.current.style.setProperty('--burst', `${pxPerM * 5.4}px`);
      bursts[0].el = kickRef.current;
      bursts[1].el = flashRef.current;
      [pendingKick, pendingFlash].forEach((pending, i) => {
        const burst = bursts[i];
        if (pending && burst.el) {
          Object.assign(burst, { px: pos[BALL_SLOT * 3], py: pos[BALL_SLOT * 3 + 1], ax: ballAdj.x, ay: ballAdj.y, lift: bz, armed: true });
          burst.el.classList.remove('live-pitch__burst--on');
          void burst.el.offsetWidth; // restart the animation
          burst.el.classList.add('live-pitch__burst--on');
        }
        if (burst.armed && burst.el) {
          burst.el.style.transform = `translate3d(${X(burst.px) + burst.ax}px,${Y(burst.py) + burst.ay - burst.lift * sy * z * 0.5}px,0)`;
        }
      });
      pendingKick = false;
      pendingFlash = false;
      // The tackle's mark: it grows with him while he slides, then stays and fades.
      const skidEl = skidRef.current;
      if (skidEl) {
        const age = time - skid.at;
        if (skid.on && age <= skid.moveMs) { skid.ex = pos[skid.slot * 3]; skid.ey = pos[skid.slot * 3 + 1]; }
        const fade = skid.on ? (age <= skid.moveMs ? 1 : 1 - (age - skid.moveMs) / skid.fadeMs) : 0;
        if (fade <= 0 || radioRef.current) {
          skid.on = false;
          skidEl.style.opacity = '0';
        } else {
          const off = faceOffsets.current.get(skid.slot) ?? { x: 0, y: 0 };
          const x0 = X(skid.fx) + off.x, y0 = Y(skid.fy) + off.y;
          const x1 = X(skid.ex) + off.x, y1 = Y(skid.ey) + off.y;
          const length = Math.hypot(x1 - x0, y1 - y0);
          skidEl.style.width = `${length}px`;
          skidEl.style.transform = `translate3d(${x0}px,${y0}px,0) rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`;
          skidEl.style.opacity = String(Math.min(1, length / 6) * fade * (skid.lunge ? 0.7 : 1));
        }
      }
      // A ball played (struck or passed) leaves a short trail; a carried one never does.
      const trail = radioRef.current || holder >= 0 ? 0 : Math.max(0, Math.min(1, (ballSpeed - 6) / 8));
      trailHistory.unshift({ x: bx, y: by - bz * sy * z * 0.5 });
      trailHistory.length = Math.min(trailHistory.length, 8);
      ghostRefs.current.forEach((ghost, i) => {
        if (!ghost) return;
        const p = trailHistory[Math.min(trailHistory.length - 1, (i + 1) * 2)];
        ghost.style.opacity = String(trail * (0.42 - i * 0.12));
        ghost.style.transform = `translate3d(${p.x}px,${p.y}px,0) scale(${0.85 - i * 0.15})`;
      });
      if (ballRef.current) ballRef.current.style.transform = `translate3d(${bx}px,${by - bz * sy * z * 0.5}px,0) scale(${1 + bz * 0.12})`;
      // The ball rolls: it spins with the distance it covers, in the direction it travels.
      const mx = pos[BALL_SLOT * 3] - lastBall.x;
      const my = pos[BALL_SLOT * 3 + 1] - lastBall.y;
      const moved = Math.hypot(mx, my);
      if (primed && moved < 6) spin += moved * (mx >= 0 ? 1 : -1) * 55;
      lastBall = { x: pos[BALL_SLOT * 3], y: pos[BALL_SLOT * 3 + 1] };
      if (ballSkinRef.current) ballSkinRef.current.style.transform = `rotate(${spin}deg)`;
      // In the air, the shadow shrinks and softens.
      if (shadowRef.current) {
        const lift = Math.min(1, bz / 4);
        shadowRef.current.style.transform = `translate3d(${bx}px,${by}px,0) scale(${1 - lift * 0.45})`;
        shadowRef.current.style.opacity = String(1 - lift * 0.6);
      }
      schedule();
    };
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      if (watchdog) clearTimeout(watchdog);
      if (timer) clearTimeout(timer);
    };
  }, [director]);

  const playerAtSlot = (slot: number) => {
    const side = sideOfSlot(slot);
    const squad = director.sides[side];
    const playerId = squad.playerIds[slot - slotBase(side)];
    return playerId ? players.get(statKey(squad.teamId, playerId)) : undefined;
  };
  const castSlots = new Set(snap.cast.map(c => c.slot));
  strikeRef.current = effects.strike ? snap.strikeFocus : null;

  return (
    <div ref={frameRef} className={`live-pitch${radio ? ' live-pitch--radio' : ''} ${className ?? ''}`} role="img" aria-label="Campo ao vivo da partida">
      <div ref={cameraRef} className="live-pitch__camera">
        <svg className="live-pitch__field" viewBox="-3 -2.5 111 73" preserveAspectRatio="none" overflow="visible" aria-hidden="true">
          <defs>
            <pattern id="live-pitch-net" width="0.6" height="0.6" patternUnits="userSpaceOnUse">
              <path d="M0 0L0.6 0.6M0.6 0L0 0.6" stroke="rgba(255,255,255,.35)" strokeWidth=".06" />
            </pattern>
          </defs>
          <rect x="-30" y="-20" width="165" height="110" fill="#0e2615" />
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={i * 10.5} y="0" width="10.5" height="68" fill={i % 2 ? '#123320' : '#14391f'} />
          ))}
          <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".3">
            <rect x="0" y="0" width="105" height="68" />
            <line x1="52.5" y1="0" x2="52.5" y2="68" />
            <circle cx="52.5" cy="34" r="9.15" />
            <rect x="0" y="13.84" width="16.5" height="40.32" />
            <rect x="0" y="24.84" width="5.5" height="18.32" />
            <rect x="88.5" y="13.84" width="16.5" height="40.32" />
            <rect x="99.5" y="24.84" width="5.5" height="18.32" />
            <path d="M16.5 26.7A9.15 9.15 0 0 1 16.5 41.3" />
            <path d="M88.5 26.7A9.15 9.15 0 0 0 88.5 41.3" />
          </g>
          <g fill="rgba(255,255,255,.55)">
            <circle cx="52.5" cy="34" r=".35" /><circle cx="11" cy="34" r=".35" /><circle cx="94" cy="34" r=".35" />
          </g>
          {/* Goals: net 2 m deep, posts drawn bold so the mouth always reads. */}
          <path d={netPath('left', 34, 0)} fill="url(#live-pitch-net)" stroke="rgba(255,255,255,.75)" strokeWidth=".15">
            <animate ref={netAnimLeft} attributeName="d" dur="0.8s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;0.22;0.55;1" keySplines=".2 .8 .3 1;.4 0 .6 1;.4 0 .6 1"
              values={netValues('left', 34)} />
          </path>
          <path d={netPath('right', 34, 0)} fill="url(#live-pitch-net)" stroke="rgba(255,255,255,.75)" strokeWidth=".15">
            <animate ref={netAnimRight} attributeName="d" dur="0.8s" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;0.22;0.55;1" keySplines=".2 .8 .3 1;.4 0 .6 1;.4 0 .6 1"
              values={netValues('right', 34)} />
          </path>
          <g stroke="#fff" strokeWidth=".45" strokeLinecap="round">
            <line x1="0" y1="29" x2="0" y2="39" />
            <line x1="105" y1="29" x2="105" y2="39" />
          </g>
        </svg>

        {lastZone.current && (() => {
          // The third where the game is, lit in the colour of the side with the ball,
          // with chevrons pointing the way it attacks. It glides between thirds and
          // fades out while the players are on.
          const zone = lastZone.current;
          const start = [0, 35, 70][zone.third];
          const x0 = zone.side === 'left' ? start : 105 - start - 35;
          const towardRight = zone.side === 'left';
          return (
            <div
              ref={zoneRef}
              className={`live-pitch__zone${radio && !finalCard ? '' : ' live-pitch__zone--off'}`}
              style={{ transform: `translateX(${(x0 / 35) * 100}%)`, ['--zone' as string]: colors[zone.side] }}
            >
              <svg className={`live-pitch__zone-arrow${towardRight ? '' : ' live-pitch__zone-arrow--left'}`} viewBox="0 0 30 12" aria-hidden="true">
                <path d="M2 1l5 5-5 5M12 1l5 5-5 5M22 1l5 5-5 5" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {teamNames && (
                <span className="live-pitch__zone-label">
                  <span className="live-pitch__zone-team">{teamNames[zone.side]}</span>
                  <span>{ZONE_WORDS[zone.third]}</span>
                </span>
              )}
            </div>
          );
        })()}
      </div>
      <div ref={layerRef} className="live-pitch__layer">
        <div ref={shadowRef} className="live-pitch__shadow" />
        <div ref={skidRef} className="live-pitch__skid" aria-hidden="true" />
        {SLOTS.map(slot => {
          const side = sideOfSlot(slot);
          const hidden = snap.sentOff.has(slot) || castSlots.has(slot);
          const keeper = keeperSlots.current.has(slot) || roleOfSlot(director.sides, slot) === 'GK';
          return (
            <div
              key={slot}
              ref={el => { dotRefs.current[slot] = el; }}
              className={`live-pitch__dot${keeper ? ' live-pitch__dot--keeper' : ''}${hidden ? ' live-pitch__dot--hidden' : ''}${snap.injured.has(slot) ? ' live-pitch__dot--injured' : ''}${downSlot === slot ? ' live-pitch__dot--down' : ''}${lungeSlot === slot ? ' live-pitch__dot--lunge' : ''}`}
              style={{ background: colors[side] }}
            >
              <span className="live-pitch__num">{(slot % 11) + 1}</span>
            </div>
          );
        })}
        {snap.cast.map(({ slot }) => {
          const player = playerAtSlot(slot);
          return (
            <div
              key={`face-${slot}`}
              ref={el => { if (el) faceRefs.current.set(slot, el); else faceRefs.current.delete(slot); }}
              className={`live-pitch__face${sideOfSlot(slot) === 'right' ? ' live-pitch__face--label-top' : ''}${downSlot === slot ? ' live-pitch__face--down' : ''}${lungeSlot === slot ? ' live-pitch__face--lunge' : ''}`}
              style={{ ['--ring' as string]: colors[sideOfSlot(slot)] }}
            >
              <div className="live-pitch__face-img">
                {player && <PlayerPortrait playerId={player.id} photoUrl={player.photoUrl} lowRes={false} alt="" />}
              </div>
              {player && (
                <span ref={el => { if (el) nameRefs.current.set(slot, el); else nameRefs.current.delete(slot); }} className="live-pitch__name">
                  {compactName(player.shortName)}
                </span>
              )}
            </div>
          );
        })}
        {/* The strike burst and the save pulse (sized in metres via --burst, placed each frame). */}
        <div ref={kickRef} className="live-pitch__burst live-pitch__kick" aria-hidden="true">
          <svg viewBox="-2.7 -2.7 5.4 5.4">
            <circle r="1.1" fill="none" stroke="#fff" strokeWidth=".3" />
            <path d="M1.5 0H2.6M-1.5 0H-2.6M0 1.5V2.6M0 -1.5V-2.6M1.1 1.1L1.8 1.8M-1.1 -1.1L-1.8 -1.8M1.1 -1.1L1.8 -1.8M-1.1 1.1L-1.8 1.8" stroke="#fff" strokeWidth=".22" strokeLinecap="round" />
          </svg>
        </div>
        <div ref={flashRef} className="live-pitch__burst live-pitch__flash" aria-hidden="true">
          <svg viewBox="-2.7 -2.7 5.4 5.4"><circle r="2.2" fill="none" stroke="#fff" strokeWidth=".5" /></svg>
        </div>
        {[0, 1, 2].map(i => <div key={`ghost-${i}`} ref={el => { ghostRefs.current[i] = el; }} className="live-pitch__ghost" />)}
        <div ref={ballRef} className="live-pitch__ball"><span ref={ballSkinRef} className="live-pitch__ball-skin" /></div>
      </div>

      {effects.cutId > 0 && <div key={effects.cutId} className="live-pitch__cut" aria-hidden="true" />}
      {(() => {
        // One quiet notice at the top of the pitch for the quick events of the game.
        const chip = notice;
        if (!chip) return null;
        const name = chip.slots[0] !== undefined ? playerAtSlot(chip.slots[0])?.shortName : undefined;
        const text = chip.kind === 'tactic' ? chip.label : CHIP_TEXT[chip.kind];
        return (
          <div key={chip.id} className="live-pitch__chip" style={{ ['--team' as string]: chip.side ? colors[chip.side] : '#94a3b8' }} role="status">
            <span className="live-pitch__chip-icon">{chipIcon(chip)}</span>
            <span className="live-pitch__chip-text">{text}</span>
            {name && <span className="live-pitch__chip-name">{name}</span>}
          </div>
        );
      })()}
      {finalCard && (
        <div className="live-pitch__final" role="status">
          <span className="live-pitch__final-title">{finalCard.title}</span>
          <span className="live-pitch__final-score">{finalCard.score}</span>
          <span className="live-pitch__final-line">{finalCard.line}</span>
        </div>
      )}
      {snap.threat && (
        <div className="live-pitch__threat" style={{ background: THREAT[snap.threat.side], transform: `scaleX(${snap.threat.stage / 3})` }} />
      )}
    </div>
  );
}
