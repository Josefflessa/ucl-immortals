import { useState, useEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import { preloadCardAssets } from '../lib/cardPreload';
import { motion, AnimatePresence } from 'framer-motion';
import { Shirt, Eye, Play, Pause, SkipForward, Volume2, VolumeX, Maximize2, Swords, Hand, Flag, ChartColumn, Repeat, Target, Megaphone, Star } from 'lucide-react';
import { INLINE_ICON } from '../components/game/inlineIcon';
import { matchAudio, outcomeSound, type MatchSound } from '../audio/matchAudio';
import { useGame } from '../contexts/GameContext';
import {
  Team, MatchResult, MatchEvent, MatchStatsDelta, PlayerMatchStat,
  activeGoalkeeperForTeam, setStatIds, statKey, playerMatchDiscipline, computePossession, tacticProfile,
  getTeamEffectiveStats, teamAtKickoff,
} from '@shared/game/gameEngine';
import GoalCelebration, { GOAL_CELEBRATION_FADE_MS, GOAL_CELEBRATION_MS, type GoalMoment } from '../components/game/match/GoalCelebration';
import { leadLine, leadSteps, narrateDanger } from '@shared/game/dangerNarration';
import { narrateRedCard } from '@shared/game/redCardNarration';
import { forcedPlayFor } from './dev/forcedPlay';
import { stageLengthMs, stageStartMs, shootoutMissKind, type Side } from '@shared/game/pitch';
import LivePitch from '../components/game/pitch/LivePitch';
import PitchErrorBoundary from '../components/game/pitch/PitchErrorBoundary';
import { PitchDirector } from '../components/game/pitch/PitchDirector';
import { buildPitchSides } from '../components/game/pitch/sides';
import NarrationStrip from '../components/game/match/NarrationStrip';
import ShootoutPanel from '../components/game/match/ShootoutPanel';
import { useMatchFullscreen } from '../components/game/match/useMatchFullscreen';
import FullscreenScoreboard from '../components/game/match/FullscreenScoreboard';
import '../components/game/match/matchStage.css';
import { preloadPlayerPhotos } from '../components/game/PlayerPortrait';
import MatchFieldView from '../components/game/MatchFieldView';
import Crest from '../components/game/Crest';
import { AppShell, Button, GameModal } from '../design-system';
import { CardIcon, InjuryIcon } from '../components/game/StatusIcon';

// One in-game minute every 222ms (about 20s for 90 minutes).
const TICK_MS = 222;

// Event descriptions already start with an emoji (⚽ GOL!, 🧤 DEFENDEU!…). The feed
// also renders a type-icon badge next to them, so strip the leading emoji from the
// text to avoid showing it twice (e.g. "⚽ ⚽ GOL CONTRA!").
const stripLeadingEmoji = (s: string) =>
  s.replace(/^[\s☀-➿⬀-⯿️‍\uD800-\uDFFF]+/, '');

// Scoreboard digit: pops in gold when it changes (a goal), then settles back to white.
function ScoreNumber({ value }: { value: number }) {
  return (
    <motion.div
      key={value}
      initial={value > 0 ? { scale: 1.6, color: '#FFD700' } : false}
      animate={{ scale: 1, color: '#FFFFFF' }}
      transition={{ type: 'spring', stiffness: 300, damping: 14, color: { duration: 1.2 } }}
      className="font-black tabular-nums"
      style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 8vw, 3.75rem)' }}
    >
      {value}
    </motion.div>
  );
}

// A trigger changes only the in-match mentalidade. The Team object stays immutable,
// so post-match screens can keep showing the manager's configured starting tactic.
function tacticAtMinute(team: Team, matchEvents: MatchEvent[], currentMinute: number): string {
  let active = team.playStyle ?? 'balanced';
  for (const event of matchEvents) {
    if (event.teamId === team.id && event.type === 'tactic' && event.tacticAction && event.minute <= currentMinute) {
      active = event.tacticAction;
    }
  }
  return active;
}


// The screen only replays a result already computed by the engine (solo) or
// the server (online); without one there is nothing to show. The guard lives in
// this wrapper so the replay component always calls its hooks unconditionally.
export default function MatchSimPage() {
  const { state } = useGame();
  const { currentMatchTeams, currentMatchResult } = state;
  // Replay every card with the credits each side had at kickoff, so both
  // players see the same effective numbers the engine used.
  const replayTeams = useMemo((): [Team, Team] | null => (currentMatchTeams && currentMatchResult
    ? [teamAtKickoff(currentMatchTeams[0], currentMatchResult), teamAtKickoff(currentMatchTeams[1], currentMatchResult)]
    : null), [currentMatchTeams, currentMatchResult]);
  if (!replayTeams || !currentMatchResult) return null;
  return <MatchReplay teams={replayTeams} replayResult={currentMatchResult} />;
}

function MatchReplay({ teams, replayResult }: { teams: [Team, Team]; replayResult: MatchResult }) {
  const {
    state,
    dispatch,
    notifyMatchWatchedOnline,
  } = useGame();
  const { activeKnockoutMatch } = state;
  const [initialHome, initialAway] = teams;

  const playerTeamId = state.playerTeam?.id;
  const isPlayerHome = initialHome.id === playerTeamId;

  // Two-legged context (for the aggregate banner during a second leg).
  const legNumber = activeKnockoutMatch?.leg;
  const firstLeg = activeKnockoutMatch?.firstLeg;

  // Online keeps the synchronized live-broadcast behavior, while solo still
  // allows pausing/skipping.
  const broadcastMode = state.mode === 'online';

  const isKnockout = !!activeKnockoutMatch;
  const isFinal = activeKnockoutMatch?.round === 'final';

  // 1. Teams are fixed for the whole match (there are no substitutions).
  const [homeTeam] = useState<Team>(() => ({ ...initialHome }));
  const [awayTeam] = useState<Team>(() => ({ ...initialAway }));

  const matchPortraitIds = useMemo(
    () => [...initialHome.players.slice(0, 11), ...initialAway.players.slice(0, 11)].map(player => player.id),
    [initialHome, initialAway],
  );

  useEffect(() => preloadPlayerPhotos(matchPortraitIds, true), [matchPortraitIds]);

  // 2. Real-time simulation state variables
  const [minute, setMinute] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [momentum, setMomentum] = useState(50); // 0 (away dominance) to 100 (home dominance)
  const [momentumHistory, setMomentumHistory] = useState<number[]>([50]);
  // isPlaying is the replay's own clock gate (it stops during each chance's
  // suspense); userPaused is the manager's Pausar button and wins over it.
  const [isPlaying, setIsPlaying] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [goalAlert, setGoalAlert] = useState<GoalMoment | null>(null);
  // The goal overlay fades itself out and only then unmounts. Relying on an exit
  // animation made it blink: the replay clock resumes the moment the alert clears,
  // and those per-minute re-renders restarted the half-finished fade.
  const [goalLeaving, setGoalLeaving] = useState(false);
  // Own ref, NOT tied to the danger-stage effect's cleanup: that effect
  // re-runs (and tears down) the instant dangerState flips stage 2 -> 3, which
  // happens synchronously right after this timer is scheduled — clearing it
  // via that effect's own cleanup cancelled it before it ever fired, leaving
  // goalAlert stuck forever. This only clears on a genuinely new alert or on
  // unmount.
  const goalAlertHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveGoalAlert = () => {
    if (goalAlertHideTimerRef.current) clearTimeout(goalAlertHideTimerRef.current);
    setGoalLeaving(true);
    goalAlertHideTimerRef.current = setTimeout(() => {
      goalAlertHideTimerRef.current = null;
      setGoalAlert(null);
      setGoalLeaving(false);
    }, GOAL_CELEBRATION_FADE_MS);
  };
  const showGoalAlert = (alert: GoalMoment, hideAfterMs: number) => {
    if (goalAlertHideTimerRef.current) clearTimeout(goalAlertHideTimerRef.current);
    setGoalLeaving(false);
    setGoalAlert(alert);
    goalAlertHideTimerRef.current = setTimeout(leaveGoalAlert, hideAfterMs);
  };
  const dismissGoalAlert = () => { if (!goalLeaving) leaveGoalAlert(); };
  // A neutral spectator (neither side is theirs) gets the celebratory version for every goal.
  const viewerInMatch = initialHome.id === playerTeamId || initialAway.id === playerTeamId;
  const goalFavoursViewer = (teamId: string) => !viewerInMatch || teamId === playerTeamId;
  useEffect(() => () => {
    if (goalAlertHideTimerRef.current) clearTimeout(goalAlertHideTimerRef.current);
  }, []);

  // Dynamic player ratings and match statistics: single source of truth
  const [playerMatchStats, setPlayerMatchStats] = useState<Record<string, PlayerMatchStat>>(() => {
    // Stamp per-instance stat keys so a player who happens to be on BOTH teams
    // (the pool is smaller than 36×11) gets separate stats per side.
    setStatIds(initialHome, initialAway);
    // Final ratings from the authoritative result (already keyed by teamId::playerId).
    return { ...replayResult.playerStats };
  });

  const [squadModal, setSquadModal] = useState<'mine' | 'opponent' | null>(null);

  // The danger currently on screen: three narration beats, timed by the runner below.
  const [dangerState, setDangerState] = useState<{
    stage: number;
    teamId: string;
    type: string;
    message: string;
    /** Stage-2 line (the attempt), shown when the build-up ends. */
    attempt: string;
    /**
     * Stage-1 lines still to come, at their moment (ms into the danger): a long lead-in's
     * lines along the way, then the decisive move's line as it starts.
     */
    cues: { at: number; message: string; stage?: number }[];
    /** Who scored, so the pitch can set up the kick-off; null for a save or a miss. */
    goalSide: Side | null;
    /** The crowd's reaction when the outcome is revealed (stage 3), and which danger it is. */
    sound: MatchSound;
    id: number;
    /** A red card scene (the foul, the referee, the card): the pitch ends it with the offender off. */
    red?: boolean;
  } | null>(null);
  // What the narration has said lately in this match (plays and lines), so it varies.
  const recentNarrationRef = useRef<{ plays: string[]; lines: string[] }>({ plays: [], lines: [] });
  // Time already spent in the current stage, so a pause resumes it instead of restarting it.
  const stageClockRef = useRef({ stage: 0, consumed: 0, startedAt: 0 });

  const pendingReplayGoals = useRef<any>(null); // buffered goal events for replay danger sequence

  // Interactive Penalty Shootout state
  const [penaltyMode, setPenaltyMode] = useState(false);
  const [penaltiesHome, setPenaltiesHome] = useState<boolean[]>([]);
  const [penaltiesAway, setPenaltiesAway] = useState<boolean[]>([]);
  const [penaltyHomeScore, setPenaltyHomeScore] = useState(0);
  const [penaltyAwayScore, setPenaltyAwayScore] = useState(0);
  const [penaltyCommentary, setPenaltyCommentary] = useState('A disputa de pênaltis vai começar! Escolha o próximo batedor.');
  const [penaltyWinner, setPenaltyWinner] = useState<string | null>(null);
  // Replay-mode kick-by-kick index (-1 = not in replay penalty mode)
  const [penaltyReplayIdx, setPenaltyReplayIdx] = useState(-1);
  // Team currently stepping up (build-up phase) — drives the overlay's "a cobrar" glow.
  const [penaltyKickPending, setPenaltyKickPending] = useState<string | null>(null);

  const myTeam = isPlayerHome ? homeTeam : awayTeam;
  const oppTeam = isPlayerHome ? awayTeam : homeTeam;
  // Same colours as the MEU TIME / ADVERSÁRIO buttons: gold is always the viewer's
  // side, indigo the opponent's (a neutral spectator sees the home side in gold).
  const homeIsMine = isPlayerHome || !viewerInMatch;
  const sideColors = {
    home: homeIsMine ? '#ffd700' : '#6366f1',
    away: homeIsMine ? '#6366f1' : '#ffd700',
    homeText: homeIsMine ? '#fde047' : '#a5b4fc',
    awayText: homeIsMine ? '#a5b4fc' : '#fde047',
  };

  // The viewer's team always plays on the left, attacking to the right of the screen.
  const leftTeam = homeIsMine ? homeTeam : awayTeam;
  const rightTeam = homeIsMine ? awayTeam : homeTeam;
  const pitchDirector = useMemo(
    () => new PitchDirector(
      buildPitchSides(leftTeam, rightTeam),
      `${homeTeam.id}|${awayTeam.id}|${replayResult.homeGoals}-${replayResult.awayGoals}|${replayResult.events.length}`,
    ),
    [leftTeam, rightTeam, homeTeam.id, awayTeam.id, replayResult],
  );
  const pitchPlayers = useMemo(
    () => new Map([
      ...homeTeam.players.map(p => [statKey(homeTeam.id, p.id), p] as const),
      ...awayTeam.players.map(p => [statKey(awayTeam.id, p.id), p] as const),
    ]),
    [homeTeam, awayTeam],
  );
  const sideOfTeamId = (teamId: string): Side => (teamId === leftTeam.id ? 'left' : 'right');
  const leftMomentum = (homeMomentum: number) => (leftTeam.id === homeTeam.id ? homeMomentum : 100 - homeMomentum);
  // The side whose chance is coming in the next few minutes keeps the ball and pushes up,
  // so the play starts on the pitch where open play left it.
  // The engine's recorded run of play for a minute (who attacks, and the momentum).
  const engineFlowAt = (minute: number): { attacking: Side; momentumLeft: number } | null => {
    const value = replayResult.flow?.[minute - 1];
    if (value === undefined || value === 0) return null;
    const homeAttacks = value > 0;
    const homeMomentum = Math.abs(value) - 1;
    const homeIsLeft = leftTeam.id === homeTeam.id;
    return { attacking: homeAttacks === homeIsLeft ? 'left' : 'right', momentumLeft: leftMomentum(homeMomentum) };
  };
  const upcomingSide = (fromMinute: number): Side | null => {
    const next = replayResult.events.find(e => e.minute > fromMinute && e.minute <= fromMinute + 5
      && (e.type === 'goal' || e.type === 'save' || e.type === 'miss'));
    if (!next) return null;
    const side = sideOfTeamId(next.teamId);
    return next.type === 'save' ? (side === 'left' ? 'right' : 'left') : side;
  };

  useEffect(() => { pitchDirector.setPaused(userPaused); }, [pitchDirector, userPaused]);

  // Sound: the crowd and the kick-off whistle when the match opens, everything holding while
  // paused, the final whistle at full time (or after the shootout), and the crowd's reaction
  // to each danger the moment its outcome is revealed (with the ball, the line and the picture).
  const muted = useSyncExternalStore(matchAudio.subscribe, matchAudio.isMuted);
  const fullscreen = useMatchFullscreen<HTMLDivElement>();
  useEffect(() => {
    void matchAudio.startMatch();
    return () => matchAudio.leave();
  }, []);
  useEffect(() => { if (userPaused) matchAudio.pause(); else matchAudio.resume(); }, [userPaused]);
  // The cards that will show up in the match (goals, line-ups) load their photos, flags and badges now, not when they appear.
  useEffect(() => preloadCardAssets([...homeTeam.players, ...awayTeam.players]), [homeTeam, awayTeam]);
  const matchOver = isFinished || !!penaltyWinner;
  useEffect(() => { if (matchOver) matchAudio.endMatch(); }, [matchOver]);
  // Full screen ends with the match: a moment on the final card, then back to the summary.
  const { isFull: isFullscreen, exit: exitFullscreen } = fullscreen;
  useEffect(() => {
    if (!matchOver || !isFullscreen) return;
    const timer = setTimeout(exitFullscreen, 2500);
    return () => clearTimeout(timer);
  }, [matchOver, isFullscreen, exitFullscreen]);
  // A red card: the whistle of the foul, just after the contact.
  const soundedWhistle = useRef(-1);
  useEffect(() => {
    if (!dangerState?.red || dangerState.stage !== 2 || soundedWhistle.current === dangerState.id) return;
    soundedWhistle.current = dangerState.id;
    const timer = setTimeout(() => matchAudio.play('whistleFoul'), 380);
    return () => clearTimeout(timer);
  }, [dangerState]);
  const soundedDanger = useRef(-1);
  useEffect(() => {
    if (!dangerState || dangerState.stage !== 3 || soundedDanger.current === dangerState.id) return;
    soundedDanger.current = dangerState.id;
    matchAudio.play(dangerState.sound);
  }, [dangerState]);

  // Outside a danger the narration only reads what matters: the last danger's
  // outcome, a card, an injury or a change of tactics, whichever came last. It stays
  // until the next one, so nothing flickers and nothing contradicts the pitch.
  const [lastReveal, setLastReveal] = useState<{ minute: number; text: string } | null>(null);
  const radioLine = (() => {
    const notable = [...events].reverse().find(e => e.type === 'yellow' || e.type === 'red' || e.type === 'injury' || e.type === 'tactic');
    if (notable && (!lastReveal || notable.minute > lastReveal.minute)) return notable.description;
    if (lastReveal) return lastReveal.text;
    return 'Árbitro posiciona a bola. Arquibancadas cantam forte!';
  })();

  const eventFeedRef = useRef<HTMLDivElement>(null);

  // 4. Danger runner: build-up (lead-in, then the decisive move) → attempt → reveal. A pause
  // keeps the time already spent in the stage, so the narration and the pitch resume together.
  useEffect(() => {
    if (!dangerState || userPaused) return;
    const clock = stageClockRef.current;
    if (clock.stage !== dangerState.stage) {
      clock.stage = dangerState.stage;
      clock.consumed = 0;
    }
    clock.startedAt = performance.now();
    pitchDirector.syncStage(dangerState.stage, clock.consumed);
    // The stage ends when the pitch's own clock gets there (it is the reference: the ball
    // reaches the goal exactly when the reveal is read out).
    const played = pitchDirector.playTime();
    // This play's own clock (an epic can have a longer lead-in and strike).
    const timing = pitchDirector.getSnapshot().timing;
    const stageEnd = stageStartMs(dangerState.stage, timing) + stageLengthMs(dangerState.stage, timing);
    const remaining = played >= 0 ? Math.max(0, stageEnd - played) : Math.max(0, stageLengthMs(dangerState.stage, timing) - clock.consumed);
    // Within the build-up, each line gives way to the next at its moment (the decisive move's
    // as it starts).
    const now = played >= 0 ? played : clock.consumed;
    const stageNow = dangerState.stage;
    const cueTimers = dangerState.cues
      .filter(cue => (cue.stage ?? 1) === stageNow)
      .map(cue => setTimeout(() => setDangerState(prev => (prev && prev.stage === stageNow ? { ...prev, message: cue.message, cues: prev.cues.filter(c => c !== cue) } : prev)), Math.max(0, cue.at - now)));

    const timer = setTimeout(() => {
      if (dangerState.stage === 1) {
        setDangerState(prev => (prev ? { ...prev, stage: 2, message: prev.attempt } : null));
        return;
      }
      if (dangerState.stage === 2) {
        // Apply the buffered shot: score, events, goal overlay and momentum.
        if (pendingReplayGoals.current) {
          const rg = pendingReplayGoals.current;
          setHomeScore(s => s + rg.homeGoalDelta);
          setAwayScore(s => s + rg.awayGoalDelta);
          setEvents(prev => [...prev, ...rg.goalEvents]);
          if (rg.goalAlert) {
            // The goal splash covers the pitch, so reset the live scene now. When
            // the message leaves, the viewer should already be back at kickoff.
            pitchDirector.endDanger(sideOfTeamId(rg.goalAlert.teamId));
            showGoalAlert(rg.goalAlert, broadcastMode
              ? GOAL_CELEBRATION_MS.online
              : goalFavoursViewer(rg.goalAlert.teamId) ? GOAL_CELEBRATION_MS.mine : GOAL_CELEBRATION_MS.against);
          }
          setMomentum(m => {
            const next = Math.min(100, Math.max(0, m + rg.momentumShift));
            setMomentumHistory(h => [...h, next]);
            return next;
          });
          setDangerState(prev => (prev ? { ...prev, stage: 3, message: rg.messageStage3 } : null));
          pendingReplayGoals.current = null;
          return;
        }
        if (dangerState.red) pitchDirector.endRedCard();
        else pitchDirector.endDanger(null);
        setDangerState(null);
        setIsPlaying(true);
        return;
      }
      if (dangerState.red) pitchDirector.endRedCard();
      else if (pitchDirector.getSnapshot().mode === 'danger') pitchDirector.endDanger(dangerState.goalSide);
      setDangerState(null);
      pendingReplayGoals.current = null;
      setIsPlaying(true); // Resume the replay clock
    }, remaining);

    return () => {
      clearTimeout(timer);
      cueTimers.forEach(clearTimeout);
      clock.consumed += performance.now() - clock.startedAt;
    };
  }, [dangerState, userPaused, pitchDirector]);

  // 4b. REPLAY clock — steps through the server's authoritative event timeline.
  // Reveals each event at its minute and rebuilds the score from goal events, so
  // the replay ends exactly on the server's score on every device.
  useEffect(() => {
    // Pause during the 3-stage danger sequence
    if (!isPlaying || userPaused || isFinished || penaltyMode || goalAlert || dangerState) return;

    // The result carries its own duration (90 or 120) — a first leg never goes to
    // extra time; a second leg / single tie may. Penalties are signalled by the
    // result's penaltyWinner, decided on aggregate by the engine.
    const finalMin = replayResult.durationMinutes ?? (isKnockout ? 120 : 90);

    const timer = setTimeout(() => {
      const nextMin = minute + 1;

      if (nextMin > finalMin) {
        // Regular / extra time finished.
        if (replayResult.penaltyWinner) {
          // Enter penalty mode and auto-play kicks one by one (kick-by-kick narration).
          pitchDirector.startShootout();
          setPenaltyCommentary('⚡ DISPUTA DE PÊNALTIS! Máxima tensão...');
          setPenaltyMode(true);
          setPenaltyReplayIdx(0);
          setIsPlaying(false);
        } else {
          setIsFinished(true);
          setIsPlaying(false);
        }
        setMinute(finalMin);
        return;
      }

      setMinute(nextMin);

      const evs = replayResult.events.filter(e => e.minute === nextMin);
      if (evs.length > 0) {
        // Shot outcomes (goal / save / miss) get the 3-stage suspense — you should
        // NOT know if it's a goal until the reveal. Everything else (build-up, duels,
        // fouls, cards) shows immediately.
        const shotEvs = evs.filter(e => e.type === 'goal' || e.type === 'save' || e.type === 'miss');
        // 'penalty' is the engine's shootout SUMMARY (carries the final pen score) — it
        // must NEVER hit the live feed here, or it spoils the result before the shootout
        // overlay even opens. It's added to the feed only after the overlay finishes.
        // A red card in a minute with no shot is a scene of its own: it reaches the feed at its reveal.
        const redEv = shotEvs.length === 0 ? evs.find(e => e.type === 'red') : undefined;
        const otherEvs = evs.filter(e => e.type !== 'goal' && e.type !== 'save' && e.type !== 'miss' && e.type !== 'penalty' && e !== redEv);

        let delta = 0;
        if (otherEvs.length > 0) {
          setEvents(prev => [...prev, ...otherEvs]);
          for (const e of otherEvs) {
            const isHome = e.teamId === homeTeam.id;
            if (e.type === 'momentum') delta += isHome ? 6 : -6;
            else if (e.type === 'duel') delta += isHome ? 5 : -5;
          }
          if (delta !== 0) setMomentum(m => {
            const next = Math.min(95, Math.max(5, m + delta));
            setMomentumHistory(h => [...h, next]);
            return next;
          });
        }
        const revealed = [...events, ...otherEvs];
        pitchDirector.onMinute(nextMin, otherEvs, leftMomentum(Math.min(95, Math.max(5, momentum + delta))), {
          left: tacticAtMinute(leftTeam, revealed, nextMin),
          right: tacticAtMinute(rightTeam, revealed, nextMin),
        }, upcomingSide(nextMin), engineFlowAt(nextMin));

        if (shotEvs.length > 0) {
          const decisive = shotEvs[shotEvs.length - 1];
          // The goal (if any) is the play we show; otherwise the minute's last shot.
          const featured = shotEvs.some(e => e.type === 'goal') ? [...shotEvs].reverse().find(e => e.type === 'goal')! : decisive;
          const isGoalOutcome = featured.type === 'goal';
          const isSaveOutcome = featured.type === 'save';
          const featuredIndex = replayResult.events.indexOf(featured);
          const narration = narrateDanger({
            event: featured,
            eventIndex: featuredIndex,
            homeTeam,
            awayTeam,
            fallbackGoalkeeperName: team => activeGoalkeeperForTeam(team, undefined, replayResult.playerStats).player?.shortName ?? team.name,
            recent: recentNarrationRef.current,
            force: forcedPlayFor(featured, isGoalOutcome ? 'goal' : isSaveOutcome ? 'save' : 'miss'),
            pitchSides: pitchDirector.sides,
            sentOff: pitchDirector.getSnapshot().sentOff,
          });
          // Remember it, so the next dangers vary (repeats get rarer, never impossible).
          {
            const kind = featured.play?.kind ?? 'through';
            const memory = recentNarrationRef.current;
            recentNarrationRef.current = {
              plays: [...memory.plays, `${kind}/${narration.variant}`, `${kind}/${narration.finish}`].slice(-8),
              lines: [...memory.lines, narration.buildUp, narration.attempt, narration.reveal].slice(-12),
            };
          }
          // Keep team attribution tied to the exact event used for the commentary and animation.
          const atkId = narration.attackTeamId;
          const atkTeam = atkId === homeTeam.id ? homeTeam : awayTeam;
          const defTeam = atkTeam.id === homeTeam.id ? awayTeam : homeTeam;
          // Own goals carry no attacking playerId; the event tags the defender in opponentId.
          const isOwnGoal = isGoalOutcome && narration.isOwnGoal;
          const homeDelta = shotEvs.filter(e => e.type === 'goal' && e.teamId === homeTeam.id).length;
          const awayDelta = shotEvs.filter(e => e.type === 'goal' && e.teamId === awayTeam.id).length;
          const atkIsHome = atkId === homeTeam.id;
          const momentumShift = isGoalOutcome ? (atkIsHome ? 22 : -22) : isSaveOutcome ? (atkIsHome ? -8 : 8) : (atkIsHome ? -3 : 3);
          const messageStage3 = narration.reveal;

          // The goal moment: scorer (the defender on an own goal), assist and both
          // cards with the effective stats they have at this minute.
          let goalMoment: GoalMoment | null = null;
          const goalEv = isGoalOutcome ? featured : undefined;
          if (goalEv) {
            const scorerTeam = isOwnGoal ? defTeam : atkTeam;
            const scorerId = isOwnGoal ? goalEv.opponentId : goalEv.playerId;
            const scorer = scorerTeam.players.find(p => p.id === scorerId);
            const assister = !isOwnGoal && goalEv.assisterId ? atkTeam.players.find(p => p.id === goalEv.assisterId) : undefined;
            const homeScoreAtMoment = homeScore + homeDelta;
            const awayScoreAtMoment = awayScore + awayDelta;
            const statsFor = (team: Team) => getTeamEffectiveStats(team, {
              playStyle: tacticAtMinute(team, [...events, ...otherEvs], nextMin),
              isKnockout,
              isFinal,
              isLosing: team.id === homeTeam.id ? homeScoreAtMoment < awayScoreAtMoment : awayScoreAtMoment < homeScoreAtMoment,
              isLeading: team.id === homeTeam.id ? homeScoreAtMoment > awayScoreAtMoment : awayScoreAtMoment > homeScoreAtMoment,
              isDrawing: homeScoreAtMoment === awayScoreAtMoment,
              teamHasScored: team.id === homeTeam.id ? homeScoreAtMoment > 0 : awayScoreAtMoment > 0,
            });
            const scorerStats = scorer ? statsFor(scorerTeam)[scorer.id] : undefined;
            const assisterStats = assister ? statsFor(atkTeam)[assister.id] : undefined;
            const previousGoals = events.filter(e => e.type === 'goal' && (isOwnGoal
              ? !e.playerId && e.opponentId === scorerId
              : e.teamId === atkTeam.id && e.playerId === scorerId)).length;
            goalMoment = {
              teamId: atkTeam.id,
              minute: nextMin,
              scorer,
              scorerTeamId: scorerTeam.id,
              scorerStats,
              assister,
              assisterTeamId: assister ? atkTeam.id : undefined,
              assisterStats,
              ownGoal: isOwnGoal,
              scorerGoalCount: previousGoals + 1,
              homeScore: homeScore + homeDelta,
              awayScore: awayScore + awayDelta,
            };
          }

          pendingReplayGoals.current = {
            goalEvents: shotEvs,
            homeGoalDelta: homeDelta,
            awayGoalDelta: awayDelta,
            goalAlert: goalMoment,
            momentumShift,
            messageStage3,
          };

          setIsPlaying(false);
          const lead = pitchDirector.startDanger(featured, featuredIndex, isGoalOutcome ? 'goal' : isSaveOutcome ? 'save' : 'miss', narration.finish, narration.variant);
          const timing = pitchDirector.getSnapshot().timing;
          setLastReveal({ minute: nextMin, text: narration.reveal });
          const attackingTeam = narration.attackTeamId === homeTeam.id ? homeTeam : awayTeam;
          const nameOf = (id?: string) => (id ? attackingTeam.players.find(p => p.id === id)?.shortName : undefined);
          const firstLine = leadLine(lead, nameOf, attackingTeam.name, featured.play?.kind ?? 'through', featuredIndex, recentNarrationRef.current.lines);
          recentNarrationRef.current = { ...recentNarrationRef.current, lines: [...recentNarrationRef.current.lines, firstLine].slice(-12) };
          setDangerState({
            stage: 1,
            teamId: atkId,
            type: 'attack',
            message: firstLine,
            cues: [...leadSteps(lead, nameOf, attackingTeam.name, featuredIndex).map(step => ({ at: step.at, message: step.line })), { at: timing.decisiveMs, message: narration.buildUp }],
            attempt: narration.attempt,
            goalSide: isGoalOutcome ? sideOfTeamId(narration.attackTeamId) : null,
            sound: outcomeSound(isGoalOutcome ? 'goal' : isSaveOutcome ? 'save' : 'miss', narration.finish),
            id: featuredIndex,
          });
        } else if (redEv) {
          const redIndex = replayResult.events.indexOf(redEv);
          const foul = evs.find(e => e.type === 'foul' && e.teamId === redEv.teamId && e.playerId === redEv.playerId);
          const narration = narrateRedCard({ event: redEv, eventIndex: redIndex, homeTeam, awayTeam, victimId: foul?.opponentId, recent: recentNarrationRef.current.lines });
          recentNarrationRef.current = { ...recentNarrationRef.current, lines: [...recentNarrationRef.current.lines, narration.buildUp, narration.attempt].slice(-12) };
          const offenderIsHome = redEv.teamId === homeTeam.id;
          pendingReplayGoals.current = {
            goalEvents: [redEv],
            homeGoalDelta: 0,
            awayGoalDelta: 0,
            goalAlert: null,
            momentumShift: offenderIsHome ? -10 : 10,
            messageStage3: narration.reveal,
          };
          setIsPlaying(false);
          pitchDirector.startRedCard(redEv, redIndex, { kind: narration.kind, variant: narration.variant, victimId: narration.victimId });
          setLastReveal({ minute: nextMin, text: narration.reveal });
          setDangerState({ stage: 1, teamId: redEv.teamId, type: 'discipline', message: narration.buildUp, cues: [], attempt: narration.attempt, goalSide: null, sound: 'miss', id: redIndex, red: true });
        } else if (otherEvs.length === 0) {
          setMomentumHistory(h => [...h, momentum]);
        }
      } else {
        pitchDirector.onMinute(nextMin, [], leftMomentum(momentum), {
          left: tacticAtMinute(leftTeam, events, nextMin),
          right: tacticAtMinute(rightTeam, events, nextMin),
        }, upcomingSide(nextMin), engineFlowAt(nextMin));
        setMomentumHistory(h => [...h, momentum]);
      }
    }, TICK_MS);

    return () => clearTimeout(timer);
  }, [replayResult, isPlaying, userPaused, isFinished, penaltyMode, goalAlert, dangerState, minute, isKnockout, isFinal, homeTeam, awayTeam, momentum, events, homeScore, awayScore, pitchDirector, leftTeam, rightTeam]);

  // Scroll live events feed to bottom automatically
  useEffect(() => {
    if (eventFeedRef.current) {
      eventFeedRef.current.scrollTop = eventFeedRef.current.scrollHeight;
    }
  }, [events, dangerState]);

  // 4c. Replay penalty kick-by-kick auto-narration
  useEffect(() => {
    if (!penaltyMode || penaltyReplayIdx < 0 || penaltyWinner) return;
    const kicks = replayResult.penaltyKicks;
    if (!kicks || kicks.length === 0) {
      // No kick data — fallback to instant reveal
      setPenaltyWinner(replayResult.penaltyWinner!);
      setPenaltyHomeScore(replayResult.homePenalties ?? 0);
      setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
      return;
    }
    if (penaltyReplayIdx >= kicks.length) {
      // All kicks narrated → reveal winner. Only NOW is it safe to drop the shootout
      // summary into the live feed (the result is no longer a spoiler).
      setPenaltyKickPending(null);
      setPenaltyWinner(replayResult.penaltyWinner!);
      setPenaltyHomeScore(replayResult.homePenalties ?? 0);
      setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
      const champ = replayResult.penaltyWinner === homeTeam.id ? homeTeam.name : awayTeam.name;
      setEvents(prev => prev.some(e => e.type === 'penalty') ? prev : [...prev, {
        minute: replayResult.durationMinutes ?? (isKnockout ? 120 : 90),
        type: 'penalty',
        description: `🎯 Pênaltis: ${homeTeam.name} ${replayResult.homePenalties ?? 0}-${replayResult.awayPenalties ?? 0} ${awayTeam.name} — ${champ} avança!`,
        teamId: replayResult.penaltyWinner!,
      }]);
      return;
    }

    const kick = kicks[penaltyReplayIdx];
    const isHome = kick.teamId === homeTeam.id;
    const teamName = isHome ? homeTeam.name : awayTeam.name;
    const num = penaltyReplayIdx + 1;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1 — build-up (suspense): the taker steps up, the keeper tries to read him.
    setPenaltyKickPending(kick.teamId);
    const kickingTeam = isHome ? homeTeam : awayTeam;
    const keepingTeam = isHome ? awayTeam : homeTeam;
    pitchDirector.shootoutKick(kick, penaltyReplayIdx, {
      takerId: kick.takerId ?? kickingTeam.players.find(p => p.shortName === kick.takerName)?.id,
      gkId: kick.gkId ?? keepingTeam.players.find(p => p.shortName === kick.gkName)?.id,
    });
    setPenaltyCommentary(`COBRANÇA ${num} · ${teamName.toUpperCase()}\n🎯 ${kick.takerName} ajeita a bola na marca... ${kick.gkName} dança na linha tentando intimidar.`);

    timers.push(setTimeout(() => {
      // Phase 2 — the reveal.
      let desc: string;
      if (kick.isGoal) {
        desc = `⚽ GOOOOL! ${kick.takerName} desloca o goleiro e estufa a rede!`;
      } else {
        desc = shootoutMissKind(penaltyReplayIdx) === 'save'
          ? `🧤 PEGOU! ${kick.gkName} voa no canto e DEFENDE a cobrança de ${kick.takerName}!`
          : `❌ PRA FORA! ${kick.takerName} pesa a perna e manda por cima do travessão!`;
      }
      setPenaltyCommentary(`COBRANÇA ${num} · ${teamName.toUpperCase()}\n${desc}`);
      setPenaltyKickPending(null);
      if (isHome) {
        setPenaltiesHome(prev => [...prev, kick.isGoal]);
        if (kick.isGoal) setPenaltyHomeScore(prev => prev + 1);
      } else {
        setPenaltiesAway(prev => [...prev, kick.isGoal]);
        if (kick.isGoal) setPenaltyAwayScore(prev => prev + 1);
      }
      // Hold the reveal so the drama lands before the next taker walks up.
      timers.push(setTimeout(() => setPenaltyReplayIdx(prev => prev + 1), 1700));
    }, 1900));

    return () => timers.forEach(clearTimeout);
  }, [penaltyMode, replayResult, penaltyReplayIdx, penaltyWinner, homeTeam, awayTeam, isKnockout, pitchDirector]);

  const handleSkip = () => {
    pitchDirector.skipToEnd(Boolean(replayResult.penaltyWinner));
    // Jump straight to the authoritative final state.
    // If already in penalty replay mode, skip to final shootout result immediately.
    if (penaltyMode && penaltyReplayIdx >= 0 && replayResult.penaltyKicks) {
      const kicks = replayResult.penaltyKicks;
      const homeKicks = kicks.filter(k => k.teamId === homeTeam.id).map(k => k.isGoal);
      const awayKicks = kicks.filter(k => k.teamId === awayTeam.id).map(k => k.isGoal);
      setPenaltiesHome(homeKicks);
      setPenaltiesAway(awayKicks);
      setPenaltyWinner(replayResult.penaltyWinner!);
      setPenaltyHomeScore(replayResult.homePenalties ?? 0);
      setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
      setPenaltyReplayIdx(-1);
      return;
    }
    setUserPaused(false);
    setMinute(replayResult.durationMinutes ?? (isKnockout ? 120 : 90));
    setEvents(replayResult.events);
    setHomeScore(replayResult.homeGoals);
    setAwayScore(replayResult.awayGoals);
    if (replayResult.playerStats) setPlayerMatchStats(replayResult.playerStats);
    if (goalAlertHideTimerRef.current) clearTimeout(goalAlertHideTimerRef.current);
    goalAlertHideTimerRef.current = null;
    setGoalAlert(null);
    setGoalLeaving(false);
    if (replayResult.penaltyWinner) {
      // Skip past penalty replay too
      const kicks = replayResult.penaltyKicks ?? [];
      setPenaltiesHome(kicks.filter(k => k.teamId === homeTeam.id).map(k => k.isGoal));
      setPenaltiesAway(kicks.filter(k => k.teamId === awayTeam.id).map(k => k.isGoal));
      setPenaltyWinner(replayResult.penaltyWinner);
      setPenaltyHomeScore(replayResult.homePenalties ?? 0);
      setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
      setPenaltyMode(true);
      setPenaltyReplayIdx(-1);
      setIsPlaying(false);
    } else {
      setIsFinished(true);
      setIsPlaying(false);
    }
  };

  const handleFinish = () => {
    // The motor result is authoritative. The screen is only a replay, so never
    // rebuild a second result from progressive UI state (which can have different
    // stats and uses player ids instead of per-team statIds).
    if (activeKnockoutMatch) {
      if (state.mode === 'online' && !state.spectating) notifyMatchWatchedOnline('knockout', activeKnockoutMatch);
      dispatch({ type: 'FINISH_KNOCKOUT_MATCH', result: replayResult });
    } else {
      if (state.mode === 'online') notifyMatchWatchedOnline('league');
      dispatch({ type: 'FINISH_LEAGUE_MATCH', result: replayResult });
    }
  };

  // Spectators (watching someone else's tie) can bail out at any moment — they aren't forced to
  // watch the whole match. Returns to the bracket; never notifies the advance-gate, never alters
  // any result (the tie is server-authoritative).
  const handleExitSpectator = () => {
    dispatch({
      type: 'FINISH_KNOCKOUT_MATCH',
      result: replayResult,
    });
  };

  // REPLAY: rebuild live player ratings + team stats progressively from the
  // events revealed so far, so they build up in real time instead of appearing
  // final from the kickoff. Deterministic (same events => same numbers on every
  // device), and we snap to the authoritative result at the final whistle.
  const replayProgress = useMemo(() => {
    const ps: Record<string, PlayerMatchStat> = {};
    const initTeam = (team: Team) => {
      team.players.slice(0, 11).forEach(p => {
        ps[p.statId!] = {
          playerId: p.id, playerName: p.shortName, teamId: team.id, rating: 6.4,
          goals: 0, assists: 0, shots: 0, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0,
          keyPasses: 0, interceptions: 0, shotsOnTarget: 0,
        };
      });
    };
    initTeam(homeTeam);
    initTeam(awayTeam);
    // Event ids → per-team stat keys (the actor is on e.teamId).
    const aKey = (e: MatchEvent, id?: string) => (e.teamId && id ? statKey(e.teamId, id) : undefined);

    const panel = {
      homePos: 50, awayPos: 50, homeShots: 0, awayShots: 0,
      homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeFouls: 0, awayFouls: 0,
      homeSaves: 0, awaySaves: 0, homeCorners: 0, awayCorners: 0,
    };
    const applyStatDelta = (delta?: MatchStatsDelta) => {
      if (!delta) return;
      for (const [key, value] of Object.entries(delta) as [keyof typeof panel, number][]) {
        if (typeof value === 'number') panel[key] += value;
      }
    };

    const homeId = replayResult.homeTeamId;
    for (const e of events) {
      const isHome = e.teamId === homeId;
      const ak = aKey(e, e.playerId);
      const asK = aKey(e, e.assisterId);
      // Ratings move exactly as the engine moved them during this event's minute.
      for (const [key, delta] of Object.entries(e.ratingDelta ?? {})) {
        if (ps[key]) ps[key].rating += delta;
      }
      if (e.type === 'stat') {
        // These are authoritative box-score changes that intentionally have no
        // player-facing shot/save narration.
        applyStatDelta(e.statDelta);
      } else if (e.type === 'corner') {
        // Corner events carry the attacking team, unlike save events whose teamId
        // is the defending goalkeeper's team.
        if (isHome) panel.homeCorners++; else panel.awayCorners++;
      } else if (e.type === 'goal') {
        if (ak && ps[ak]) ps[ak].goals++;
        if (asK && ps[asK]) ps[asK].assists++;
        if (isHome) { panel.homeShots++; panel.homeShotsOnTarget++; } else { panel.awayShots++; panel.awayShotsOnTarget++; }
      } else if (e.type === 'save') {
        if (ak && ps[ak]) ps[ak].saves++;
        // the shot belongs to the attacking (other) team
        if (isHome) { panel.homeSaves++; panel.awayShots++; panel.awayShotsOnTarget++; }
        else { panel.awaySaves++; panel.homeShots++; panel.homeShotsOnTarget++; }
      } else if (e.type === 'miss') {
        if (ak && ps[ak]) ps[ak].shots++;
        if (isHome) panel.homeShots++; else panel.awayShots++;
      } else if (e.type === 'duel') {
        if (ak && ps[ak]) ps[ak].tackles++;
      } else if (e.type === 'yellow') {
        if (ak && ps[ak]) ps[ak].yellowCards++;
      } else if (e.type === 'red') {
        if (ak && ps[ak]) ps[ak].redCards++;
      } else if (e.type === 'foul') {
        if (ak && ps[ak]) ps[ak].fouls++;
        if (isHome) panel.homeFouls++; else panel.awayFouls++;
      }
    }

    Object.values(ps).forEach(s => {
      s.rating = parseFloat(Math.min(10, Math.max(3, s.rating)).toFixed(1));
    });

    // Same formula as the engine's final possession, fed with the live shots and the
    // tactic active at this minute — so it converges on the final value at the whistle.
    const model = replayResult.possessionModel;
    if (model) {
      const homeTactic = tacticAtMinute(homeTeam, events, minute);
      const awayTactic = tacticAtMinute(awayTeam, events, minute);
      panel.homePos = computePossession(
        model.homeStrength, model.awayStrength, panel.homeShots, panel.awayShots,
        homeTactic, awayTactic,
        model.homeShapeControl + tacticProfile(homeTactic).control,
        model.awayShapeControl + tacticProfile(awayTactic).control,
      );
    }
    panel.awayPos = 100 - panel.homePos;

    return { ps, panel };
  }, [replayResult, events, homeTeam, awayTeam, minute]);

  // During a replay the panel/ratings build up live; at the whistle we use the
  // authoritative server values (already stored in playerMatchStats for replays).
  const currentStats = isFinished || penaltyMode ? replayResult.stats : replayProgress.panel;

  const getDisplayRating = (playerId: string): number => {
    if (!isFinished && !penaltyMode) {
      return replayProgress.ps[playerId]?.rating ?? 6.0;
    }
    return playerMatchStats[playerId]?.rating ?? 6.0;
  };

  const getDisplayStat = (playerId: string): PlayerMatchStat | undefined => {
    if (!isFinished && !penaltyMode) return replayProgress.ps[playerId];
    return playerMatchStats[playerId];
  };

  // Best-rated starter of either side, from the authoritative final ratings.
  const manOfTheMatch = useMemo(() => {
    let best: { name: string; rating: number; team: string } | null = null;
    for (const team of [homeTeam, awayTeam]) {
      for (const p of team.players.slice(0, 11)) {
        const rating = replayResult.playerStats?.[p.statId!]?.rating;
        if (rating !== undefined && (!best || rating > best.rating)) best = { name: p.shortName, rating, team: team.name };
      }
    }
    return best;
  }, [replayResult, homeTeam, awayTeam]);

  // Internal stat events keep the live panel exact but should never replace the
  // human-readable broadcast headline.

  // Helper to format events icons
  const getEventIcon = (type: MatchEvent['type']) => {
    switch (type) {
      case 'goal': return '⚽';
      case 'duel': return <Swords size="1.1em" strokeWidth={2.4} />;
      case 'save': return <Hand size="1.1em" strokeWidth={2.4} />;
      case 'corner': return <Flag size="1.1em" strokeWidth={2.4} />;
      case 'stat': return <ChartColumn size="1.1em" strokeWidth={2.4} />;
      case 'sub': return <Repeat size="1.1em" strokeWidth={2.4} />;
      case 'penalty': return <Target size="1.1em" strokeWidth={2.4} />;
      case 'tactic': return '';
      case 'yellow': return <CardIcon color="yellow" size="1.35em" />;
      case 'red': return <CardIcon color="red" size="1.35em" />;
      case 'injury': return <InjuryIcon size="1.25em" />;
      default: return <Megaphone size="1.1em" strokeWidth={2.4} />;
    }
  };

  // Render the pressure curves
  const renderMomentumChart = () => {
    if (momentumHistory.length === 0) return null;

    const width = 320;
    const height = 60;
    const padding = 10;
    const midY = height / 2;

    const points = momentumHistory.map((val, idx) => {
      const x = padding + (idx / (momentumHistory.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - (val / 100) * (height - 2 * padding);
      return { x, y };
    });

    const pathD = points.reduce((acc, p, idx) =>
      idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
    , "");

    const areaPathD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${midY} L ${points[0].x} ${midY} Z`
      : "";

    const goalEvents = events.filter(e => e.type === 'goal');

    return (
      <div className="bg-[#0e0e1a] border border-[#1f1f35] rounded-xl p-3 flex flex-col flex-shrink-0">
        <span className="text-[12px] font-black text-yellow-500 tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
          MOMENTUM
        </span>
        <div className="relative w-full h-[60px] bg-[#07070d] rounded-lg border border-[#141426] p-1 overflow-hidden">
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <line x1={padding} y1={midY} x2={width - padding} y2={midY} stroke="#1f1f35" strokeDasharray="3,3" strokeWidth="1" />
            
            {areaPathD && (
              <path d={areaPathD} fill="url(#momentumAreaGrad)" />
            )}

            {pathD && (
              <path d={pathD} fill="none" stroke="url(#momentumLineGrad)" strokeWidth="2.2" strokeLinecap="round" />
            )}

            <defs>
              <linearGradient id="momentumLineGrad" x1="0" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={sideColors.home} />
                <stop offset="47%" stopColor={sideColors.home} />
                <stop offset="50%" stopColor="#8a8a9a" />
                <stop offset="53%" stopColor={sideColors.away} />
                <stop offset="100%" stopColor={sideColors.away} />
              </linearGradient>
              <linearGradient id="momentumAreaGrad" x1="0" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={sideColors.home} stopOpacity="0.25" />
                <stop offset="45%" stopColor={sideColors.home} stopOpacity="0.03" />
                <stop offset="50%" stopColor="#07070d" stopOpacity="0" />
                <stop offset="55%" stopColor={sideColors.away} stopOpacity="0.03" />
                <stop offset="100%" stopColor={sideColors.away} stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {/* Display goals as marker circles on the graph */}
            {goalEvents.map((g, idx) => {
              const markerIdx = g.minute;
              const p = points[markerIdx] || points[points.length - 1];
              if (!p) return null;
              return (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill={g.teamId === homeTeam.id ? sideColors.home : sideColors.away} stroke="#05050a" strokeWidth="1.2" />
                  <text x={p.x} y={p.y - 7} fontSize="9" textAnchor="middle" className="select-none pointer-events-none">⚽</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex justify-between mt-2 text-[12px] font-black" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
          <span style={{ color: sideColors.home }}>▲ DOMINÂNCIA: {homeTeam.name.toUpperCase()}</span>
          <span style={{ color: sideColors.away }}>▼ DOMINÂNCIA: {awayTeam.name.toUpperCase()}</span>
        </div>
      </div>
    );
  };

  // The feed only changes when a new event lands; keep it out of the per-minute re-render.
  const feedContent = useMemo(() => (
            events.filter(event => ['goal', 'penalty', 'tactic', 'yellow', 'red', 'injury'].includes(event.type)).length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col text-center text-gray-500 py-8" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                <span className="text-5xl sm:text-6xl mb-3 animate-bounce">⚽</span>
                <span className="text-sm sm:text-base font-bold text-white tracking-wide">ÁRBITRO APITA O INÍCIO!</span>
                <span className="text-xs text-gray-500 mt-1 max-w-xs">A bola rola. Que vença a melhor estratégia!</span>
              </div>
            ) : (
              events
                .filter(event => ['goal', 'penalty', 'tactic', 'yellow', 'red', 'injury'].includes(event.type))
                .map((event, idx) => {
                  const isPlayerEvent = event.teamId === playerTeamId;
                  const isGoal = event.type === 'goal';
                  const isTactic = event.type === 'tactic';
                  const eventTeam = isTactic
                    ? (event.teamId === homeTeam.id ? homeTeam : event.teamId === awayTeam.id ? awayTeam : undefined)
                    : undefined;
                  const negative = event.type === 'yellow' || event.type === 'red' || event.type === 'injury';
                  // "Favorável" = bom PARA MIM. Gol meu é bom; cartão/lesão MINHA é ruim (o inverso).
                  const favorable = negative ? !isPlayerEvent : isPlayerEvent;
                  const accentColor   = isTactic ? '#c9a84c' : favorable ? '#22c55e' : '#ef4444';
                  const bgColor       = isTactic ? 'rgba(201, 168, 76, 0.07)' : favorable ? 'rgba(34, 197, 94, 0.07)' : 'rgba(239, 68, 68, 0.07)';
                  const borderColor   = isTactic ? 'rgba(201, 168, 76, 0.25)' : favorable ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';
                  // Cor do texto destaca o TIPO do lance (vermelho dramático, lesão âmbar, amarelo).
                  const descColor = isGoal ? accentColor
                    : isTactic ? '#e8c84a'
                    : event.type === 'red' ? '#f87171'
                      : event.type === 'injury' ? '#fbbf24'
                        : event.type === 'yellow' ? '#facc15'
                          : '#dfdfe8';

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: isPlayerEvent ? -14 : 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="feed-card flex gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all border"
                      style={{ background: bgColor, borderColor }}
                    >
                      {/* Coloured left accent bar */}
                      <div className="w-0.5 rounded-full flex-shrink-0 self-stretch" style={{ background: accentColor }} />

                      <span
                        className="feed-card__min font-extrabold text-xs sm:text-sm tabular-nums flex-shrink-0 w-7 sm:w-8"
                        style={{ fontFamily: 'var(--font-game), sans-serif', color: accentColor }}
                      >
                        {event.minute}'
                      </span>

                      {isTactic ? (
                        <span className="feed-card__crest flex h-9 w-9 flex-shrink-0 items-center justify-center">
                          <Crest crestId={eventTeam?.crestId} name={eventTeam?.name ?? event.description} size={38} />
                        </span>
                      ) : (
                        <span className="feed-card__icon text-sm sm:text-base flex-shrink-0">
                          {getEventIcon(event.type)}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <p
                          className={`feed-card__text text-xs sm:text-sm leading-snug ${negative || isGoal ? 'font-black' : 'font-semibold'}`}
                          style={{ fontFamily: 'var(--font-game), sans-serif', color: descColor }}
                        >
                          {stripLeadingEmoji(event.description)}
                        </p>
                        {/* Team label badge */}
                        <span
                          className="feed-card__tag text-[12px] font-black tracking-widest uppercase mt-0.5 inline-block px-1.5 py-0.5 rounded"
                          style={{
                            fontFamily: 'var(--font-game), sans-serif',
                            color: accentColor,
                            background: isTactic ? 'rgba(201,168,76,0.12)' : favorable ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          }}
                        >
                          {isTactic
                            ? 'TÁTICA ALTERADA'
                            : negative
                            ? (isPlayerEvent ? '▼ SEU TIME' : '▲ ADVERSÁRIO')
                            : (isPlayerEvent ? '▲ A FAVOR' : '▼ ADVERSÁRIO')}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
            )
  ), [events, playerTeamId, homeTeam, awayTeam]);

  const goalSplash = goalAlert && (
    <GoalCelebration
      key={`${goalAlert.minute}-${goalAlert.homeScore}-${goalAlert.awayScore}`}
      goal={goalAlert}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      localTeamId={playerTeamId}
      mine={goalFavoursViewer(goalAlert.teamId)}
      leaving={goalLeaving}
      onSkip={broadcastMode ? undefined : dismissGoalAlert}
    />
  );

  return (
    <AppShell className="h-dvh flex flex-col relative overflow-hidden select-none">

      {/* ── 1. GOAL SPLASH SCREEN (drawn inside the pitch's full screen while it is on) ── */}
      {!fullscreen.isFull && goalSplash}

      {/* ── Spectator bar: watching someone else's tie → leave whenever you want ── */}
      {state.spectating && (
        <div className="ui-topbar flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 py-2 relative z-20">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold tracking-wider" style={{ color: 'var(--ui-info)', fontFamily: 'var(--font-game), sans-serif' }}>
            <Eye {...INLINE_ICON} />Assistindo como espectador
          </span>
          <Button
            type="button"
            intent="ghost"
            onClick={handleExitSpectator}
            className="min-h-8 border border-[var(--ui-line-subtle)] px-3 text-xs"
          >
            ✕ SAIR DO JOGO
          </Button>
        </div>
      )}

      {/* ── 2. SCOREBOARD HEADER ── */}
      <div className="flex-shrink-0 border-b border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] relative z-10">
        <div className="py-3 px-3 sm:py-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
            {/* Home team metadata */}
            <div className="flex-1 text-right pr-2 sm:pr-6 min-w-0">
              <div className="flex items-center justify-end gap-2 min-w-0">
                <h2 className="min-w-0 whitespace-normal break-words text-right font-black leading-tight text-white" style={{ fontFamily: 'var(--font-display), sans-serif', letterSpacing: '0.04em', fontSize: 'clamp(1rem, 4vw, 1.875rem)' }}>
                  {homeTeam.name.toUpperCase()}
                </h2>
                <Crest crestId={homeTeam.crestId} name={homeTeam.name} size={30} />
              </div>
              <span className="text-[12px] sm:text-xs font-bold tracking-widest" style={{ fontFamily: 'var(--font-game), sans-serif', color: homeTeam.id === playerTeamId ? 'var(--ui-brand)' : 'var(--ui-info)' }}>
                {homeTeam.id === playerTeamId ? 'SEU TIME' : 'ADVERSÁRIO'}
              </span>
            </div>

            {/* Core Scoreboard Widgets */}
            <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
              <ScoreNumber value={homeScore} />

              <div className="flex flex-col items-center justify-center px-2 sm:px-6 py-1 sm:py-2 rounded-xl border" style={{ background: '#0e0e1a', borderColor: isFinished ? '#c9a84c66' : '#1f1f35' }}>
                <span className="text-[12px] sm:text-[12px] font-black tracking-widest" style={{ fontFamily: 'var(--font-game), sans-serif', color: userPaused && !isFinished ? 'var(--ui-info)' : '#eab308' }}>
                  {isFinished ? 'FIM' : penaltyMode ? 'PÊNALTIS' : userPaused ? 'PAUSADO' : isKnockout && minute > 90 ? 'PRORRG.' : 'MIN'}
                </span>
                <span className="font-black text-white leading-none mt-0.5" style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.5rem, 6vw, 2.5rem)' }}>
                  {minute}'
                </span>
              </div>

              <ScoreNumber value={awayScore} />
            </div>

            {/* Away team metadata */}
            <div className="flex-1 text-left pl-2 sm:pl-6 min-w-0">
              <div className="flex items-center justify-start gap-2 min-w-0">
                <Crest crestId={awayTeam.crestId} name={awayTeam.name} size={30} />
                <h2 className="min-w-0 whitespace-normal break-words font-black leading-tight text-white" style={{ fontFamily: 'var(--font-display), sans-serif', letterSpacing: '0.04em', fontSize: 'clamp(1rem, 4vw, 1.875rem)' }}>
                  {awayTeam.name.toUpperCase()}
                </h2>
              </div>
              <span className="text-[12px] sm:text-xs font-bold tracking-widest" style={{ fontFamily: 'var(--font-game), sans-serif', color: awayTeam.id === playerTeamId ? 'var(--ui-brand)' : 'var(--ui-info)' }}>
                {awayTeam.id === playerTeamId ? 'SEU TIME' : 'ADVERSÁRIO'}
              </span>
            </div>
          </div>
        </div>

        {/* ── GOAL TICKER ── Classic broadcaster-style goal list */}
        {(() => {
          const homeGoals = events.filter(e => e.type === 'goal' && e.teamId === homeTeam.id);
          const awayGoals = events.filter(e => e.type === 'goal' && e.teamId === awayTeam.id);
          if (homeGoals.length === 0 && awayGoals.length === 0) return null;
          // One entry per scorer with all of their minutes ("Cristiano 6', 40', 85'").
          const byScorer = (goals: MatchEvent[], team: Team) => {
            const defendingTeam = team.id === homeTeam.id ? awayTeam : homeTeam;
            const rows = new Map<string, number[]>();
            for (const g of goals) {
              const ogName = g.opponentId ? defendingTeam.players.find(p => p.id === g.opponentId)?.shortName : null;
              const scorer = g.playerId
                ? team.players.find(p => p.id === g.playerId)?.shortName ?? '?'
                : ogName ? `${ogName} (Contra)` : 'Gol Contra'; // sem playerId ⇒ gol contra (autor = opponentId)
              rows.set(scorer, [...(rows.get(scorer) ?? []), g.minute]);
            }
            return Array.from(rows.entries());
          };
          return (
            <div className="border-t px-3 sm:px-6 py-1.5 flex items-start justify-center gap-4 sm:gap-8 max-w-6xl mx-auto" style={{ borderColor: '#1a1a2e' }}>
              {/* Home goals */}
              <div className="flex-1 flex flex-wrap justify-end gap-x-2 sm:gap-x-3 gap-y-0.5">
                {byScorer(homeGoals, homeTeam).map(([scorer, minutes]) => (
                  <span key={scorer} className="text-[12px] sm:text-[13px] font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: sideColors.homeText }}>
                    ⚽ {scorer} {minutes.map(m => `${m}'`).join(', ')}
                  </span>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px self-stretch" style={{ background: '#1f1f35' }} />

              {/* Away goals */}
              <div className="flex-1 flex flex-wrap justify-start gap-x-2 sm:gap-x-3 gap-y-0.5">
                {byScorer(awayGoals, awayTeam).map(([scorer, minutes]) => (
                  <span key={scorer} className="text-[12px] sm:text-[13px] font-bold" style={{ fontFamily: 'var(--font-game), sans-serif', color: sideColors.awayText }}>
                    ⚽ {scorer} {minutes.map(m => `${m}'`).join(', ')}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── 2b. SECOND-LEG AGGREGATE BANNER ── */}
      {legNumber === 2 && firstLeg && (
        <div className="flex-shrink-0 border-b border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-3 sm:px-6 py-1.5 flex items-center justify-center gap-3 relative z-10">
          <span className="text-[12px] sm:text-[12px] font-black tracking-widest" style={{ color: 'var(--ui-info)', fontFamily: 'var(--font-game), sans-serif' }}>
            JOGO DE VOLTA
          </span>
          <span className="text-[12px] sm:text-xs font-bold" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
            AGREGADO:
          </span>
          <span className="text-sm sm:text-base font-black tabular-nums" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-display), sans-serif' }}>
            {homeTeam.name.split(' ')[0].toUpperCase()} {homeScore + firstLeg.home} - {awayScore + firstLeg.away} {awayTeam.name.split(' ')[0].toUpperCase()}
          </span>
          <span className="hidden sm:inline text-[12px] text-gray-600" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            (1ª mão {firstLeg.home}-{firstLeg.away})
          </span>
        </div>
      )}

      {/* ── 3. MAIN SIMULATION INTERFACE ── */}
      <div className="match-scroll flex-1 min-h-0 max-w-7xl w-full mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 overflow-y-auto lg:overflow-hidden relative z-10">
        
        {/* LEFT COLUMN: live feed */}
        <div className="match-scroll lg:col-span-2 flex flex-col min-h-[360px] sm:min-h-[500px] lg:min-h-0 h-max lg:h-full rounded-2xl overflow-hidden lg:overflow-y-auto lg:overflow-x-hidden border flex-shrink-0" style={{ background: '#0b0b14', borderColor: '#171725' }}>
          
          <div ref={fullscreen.ref} className={`match-stage${fullscreen.isFull ? ' match-stage--full' : ''}`}>
          <div className="match-stage__pitch">
          <PitchErrorBoundary>
            <LivePitch
              director={pitchDirector}
              players={pitchPlayers}
              colors={{ left: '#ffd700', right: '#6366f1' }}
              teamNames={{ left: leftTeam.name.toUpperCase(), right: rightTeam.name.toUpperCase() }}
              finalCard={isFinished || (penaltyMode && penaltyWinner) ? {
                title: 'FIM DE JOGO',
                score: `${homeTeam.name} ${homeScore} × ${awayScore} ${awayTeam.name}`,
                line: penaltyWinner
                  ? `${(penaltyWinner === homeTeam.id ? homeTeam.name : awayTeam.name).toUpperCase()} AVANÇA NOS PÊNALTIS (${penaltyHomeScore}–${penaltyAwayScore})`
                  : homeScore === awayScore ? 'EMPATE' : `VITÓRIA DO ${(homeScore > awayScore ? homeTeam.name : awayTeam.name).toUpperCase()}`,
              } : null} className="flex-shrink-0 border-b border-[#171725]" />
          </PitchErrorBoundary>
          {fullscreen.supported && !fullscreen.isFull && (
            <button type="button" className="match-stage__enter" onClick={() => { void fullscreen.enter(); }} aria-label="Ver o campo em tela cheia" title="Tela cheia">
              <Maximize2 size={16} />
            </button>
          )}
          </div>

          <div className="match-stage__side">
          {fullscreen.isFull && (
            <FullscreenScoreboard
              home={{ name: homeTeam.name, crestId: homeTeam.crestId, goals: homeScore, penalties: penaltyMode ? penaltyHomeScore : undefined, mine: homeTeam.id === playerTeamId }}
              away={{ name: awayTeam.name, crestId: awayTeam.crestId, goals: awayScore, penalties: penaltyMode ? penaltyAwayScore : undefined, mine: awayTeam.id === playerTeamId }}
              clock={isFinished || (penaltyMode && penaltyWinner)
                ? { label: 'FIM DE JOGO', state: 'done' }
                : penaltyMode ? { label: 'PÊNALTIS', state: 'live' }
                : { label: `${userPaused ? 'PAUSADO · ' : isKnockout && minute > 90 ? 'PRORROGAÇÃO · ' : ''}${minute}'`, state: userPaused ? 'paused' : 'live' }}
              aggregate={legNumber === 2 && firstLeg ? `Agregado ${homeScore + firstLeg.home} × ${awayScore + firstLeg.away}` : undefined}
              muted={muted}
              onToggleMute={() => matchAudio.setMuted(!muted)}
              onExit={fullscreen.exit}
            />
          )}

          {penaltyMode ? (
            <ShootoutPanel
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              penaltiesHome={penaltiesHome}
              penaltiesAway={penaltiesAway}
              homeScore={penaltyHomeScore}
              awayScore={penaltyAwayScore}
              pendingTeamId={penaltyKickPending}
              commentary={penaltyCommentary}
              winnerId={penaltyWinner}
              isFinal={isFinal}
              onFinish={handleFinish}
            />
          ) : (
            <NarrationStrip
              minute={minute}
              isFinished={isFinished}
              userPaused={userPaused}
              danger={dangerState ? (dangerState.red
                ? { forMe: dangerState.teamId !== myTeam.id, stage: dangerState.stage, message: dangerState.message, label: 'CARTÃO VERMELHO' }
                : { forMe: dangerState.teamId === myTeam.id, stage: dangerState.stage, message: dangerState.message }) : null}
              text={radioLine}
              finishedContent={(
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                <span className="text-sm sm:text-base font-extrabold uppercase text-white">
                  {homeScore > awayScore ? `Vitória do ${homeTeam.name}` : awayScore > homeScore ? `Vitória do ${awayTeam.name}` : 'Empate'} · {homeScore} × {awayScore}
                </span>
                {manOfTheMatch && (
                  <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] sm:text-[13px] font-black" style={{ background: 'rgba(201,168,76,.14)', color: 'var(--ui-brand)', border: '1px solid rgba(201,168,76,.35)' }}>
                    <Star {...INLINE_ICON} fill="currentColor" />MELHOR EM CAMPO: {manOfTheMatch.name.toUpperCase()} · {manOfTheMatch.rating.toFixed(1)}
                    <span className="font-bold text-[var(--ui-text-muted)]">({manOfTheMatch.team})</span>
                  </span>
                )}
              </div>
              )}
            />
          )}

          <div className="match-stage__feedhead px-3 sm:px-5 py-2 sm:py-2.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: '#171725', background: '#08080f' }}>
            <span className="text-[12px] sm:text-[12px] font-black tracking-widest text-gray-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
              <span className="match-stage__feedtitle-long">TRANSMISSÃO DE LANCES</span>
              <span className="match-stage__feedtitle-short">LANCES</span>
            </span>
            {isFinished ? (
              <span className="text-[12px] font-black tracking-widest text-[var(--ui-text-muted)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>ENCERRADA</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${userPaused ? 'bg-sky-500' : 'bg-red-600 animate-pulse'}`} />
                <span className="text-[12px] font-black tracking-widest" style={{ fontFamily: 'var(--font-game), sans-serif', color: userPaused ? 'var(--ui-info)' : '#ef4444' }}>{userPaused ? 'PAUSADO' : 'AO VIVO'}</span>
              </div>
            )}
          </div>

          {/* FIXED HEIGHT TIMELINE FEED */}
          <div
            ref={eventFeedRef}
            className="match-scroll match-stage__feed flex-1 min-h-[260px] lg:min-h-[280px] basis-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 space-y-2.5 sm:space-y-3.5 scroll-smooth"
            style={{ background: '#08080f' }}
          >
            {feedContent}
          </div>
          </div>
          {fullscreen.isFull && goalSplash}
          </div>
        </div>

        {/* RIGHT COLUMN: stats + squad buttons */}
        <div className="lg:col-span-1 flex flex-col min-h-0 lg:h-full gap-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={() => setSquadModal('mine')}
              className="py-3 sm:py-4 px-3 rounded-xl border font-black text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02]"
              style={{
                fontFamily: 'var(--font-display), sans-serif',
                background: 'linear-gradient(135deg, var(--ui-surface-2), #0b0b14)',
                borderColor: '#c9a84c55',
                color: 'var(--ui-brand)',
              }}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><Shirt size={15} /> MEU TIME</span>
              <span className="mt-1 block whitespace-normal break-words text-[12px] font-bold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#8A8A9A' }}>
                {myTeam.name}
              </span>
            </button>
            <button
              onClick={() => setSquadModal('opponent')}
              className="py-3 sm:py-4 px-3 rounded-xl border font-black text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02]"
              style={{
                fontFamily: 'var(--font-display), sans-serif',
                background: 'linear-gradient(135deg, var(--ui-surface-2), #0b0b14)',
                borderColor: '#6366f155',
                color: 'var(--ui-info)',
              }}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><Eye size={15} /> ADVERSÁRIO</span>
              <span className="mt-1 block whitespace-normal break-words text-[12px] font-bold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#8A8A9A' }}>
                {oppTeam.name}
              </span>
            </button>
          </div>

          <div className="flex-shrink-0 space-y-3">
            {renderMomentumChart()}
            <div className="bg-[#0b0b14] border border-[#171725] rounded-2xl p-3 flex flex-col">
              <span className="text-[12px] font-black text-yellow-500 tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                {isFinished ? 'ESTATÍSTICAS' : 'ESTATÍSTICAS (AO VIVO)'}
              </span>
              <div className="space-y-2">
                {[
                  { label: 'Posse (%)', homeVal: currentStats.homePos, awayVal: currentStats.awayPos },
                  { label: 'Finalizações', homeVal: currentStats.homeShots, awayVal: currentStats.awayShots },
                  { label: 'No Alvo', homeVal: currentStats.homeShotsOnTarget, awayVal: currentStats.awayShotsOnTarget },
                  { label: 'Escanteios', homeVal: currentStats.homeCorners, awayVal: currentStats.awayCorners },
                  { label: 'Faltas', homeVal: currentStats.homeFouls, awayVal: currentStats.awayFouls },
                  { label: 'Defesas do goleiro', homeVal: currentStats.homeSaves, awayVal: currentStats.awaySaves },
                ].map((s, i) => {
                  const total = s.homeVal + s.awayVal || 1;
                  const hPct = (s.homeVal / total) * 100;
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between text-[12px] font-bold text-gray-300" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        <span style={{ color: sideColors.home }}>{s.homeVal}</span>
                        <span className="text-gray-500 text-[12px] tracking-wider uppercase">{s.label}</span>
                        <span style={{ color: sideColors.away }}>{s.awayVal}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden flex" style={{ background: '#141426' }}>
                        <div className="h-full transition-all duration-300" style={{ width: `${hPct}%`, background: sideColors.home }} />
                        <div className="h-full transition-all duration-300" style={{ width: `${100 - hPct}%`, background: sideColors.away }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. SQUAD MODAL ── */}
      {squadModal && (
        <GameModal
          open
          onOpenChange={next => { if (!next) setSquadModal(null); }}
          className={squadModal === 'mine' ? 'max-w-lg !bg-[#0b0b14] !border-primary/33 !rounded-2xl' : 'max-w-lg !bg-[#0b0b14] !border-[#6366f155] !rounded-2xl'}
          bodyClassName="min-h-0 flex-1 overflow-y-auto pr-1"
          title={
            <h3 className="text-xl font-black tracking-widest uppercase" style={{
              fontFamily: 'var(--font-display), sans-serif',
              color: squadModal === 'mine' ? 'var(--ui-brand)' : 'var(--ui-info)',
            }}>
              {squadModal === 'mine' ? 'MEU TIME' : 'ADVERSÁRIO'}
            </h3>
          }
          subtitle={
            <span className="text-sm font-bold text-white" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
              {(squadModal === 'mine' ? myTeam : oppTeam).name}
            </span>
          }
        >
                {(() => {
                  const t = squadModal === 'mine' ? myTeam : oppTeam;
                  const ratings: Record<string, number> = {};
                  const goalsByPlayer: Record<string, number> = {};
                  const assistsByPlayer: Record<string, number> = {};
                  const disciplineByPlayer: Record<string, { yellow: number; red: boolean; injury: boolean }> = {};
                  t.players.forEach(p => {
                    const st = getDisplayStat(p.statId!);
                    ratings[p.id] = getDisplayRating(p.statId!);
                    goalsByPlayer[p.id] = st?.goals ?? 0;
                    assistsByPlayer[p.id] = st?.assists ?? 0;
                    // 🟨🟥🩹 derivado dos eventos deste jogo, POR INSTÂNCIA (time+jogador):
                    // o mesmo id pode estar nos dois times, então checar só playerId pintaria
                    // um cartão fantasma na cópia do adversário (bug do vermelho na transmissão).
                    const { yellow, red, injury } = playerMatchDiscipline(events, t.id, p.id);
                    if (yellow || red || injury) disciplineByPlayer[p.id] = { yellow, red, injury };
                  });
                  return (
                    <MatchFieldView
                      team={t}
                      activePlayStyle={tacticAtMinute(t, events, minute)}
                      ratings={ratings}
                      goalsByPlayer={goalsByPlayer}
                      assistsByPlayer={assistsByPlayer}
                      disciplineByPlayer={disciplineByPlayer}
                      accent={squadModal === 'mine' ? '#C9A84C' : '#818CF8'}
                      isKnockout={isKnockout}
                      isFinal={isFinal}
                      isLosing={t.id === homeTeam.id ? homeScore < awayScore : awayScore < homeScore}
                      isLeading={t.id === homeTeam.id ? homeScore > awayScore : awayScore > homeScore}
                      isDrawing={homeScore === awayScore}
                      teamHasScored={t.id === homeTeam.id ? homeScore > 0 : awayScore > 0}
                      disableEntryAnimation
              showAlbumLevel={t.id === playerTeamId}
                    />
                  );
                })()}
        </GameModal>
      )}

      {/* ── 6. FOOTER CONTROL CENTER ── */}
      <div className="ui-topbar py-3 px-3 sm:py-4 sm:px-6 border-t flex flex-row items-center justify-between gap-2 sm:gap-4 z-10 flex-shrink-0">
        
        {/* Online shows the live indicator; solo keeps pause/simulate controls. */}
        {broadcastMode ? (
          <div className="flex items-center gap-2 w-auto justify-center sm:justify-start">
            {!isFinished && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span style={{ fontFamily: 'var(--font-game), sans-serif', fontWeight: 800, letterSpacing: '0.18em', color: '#ff6b6b', fontSize: 13 }}>AO VIVO</span>
              </span>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-2 sm:gap-3 w-auto justify-start">
          {!isFinished && !penaltyMode && (
            <Button
              type="button"
              intent={userPaused ? 'success' : 'secondary'}
              onClick={() => setUserPaused(paused => !paused)}
              className="px-5 sm:px-6"
            >
              <span className="inline-flex items-center gap-1.5">
                {userPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
                {userPaused ? 'CONTINUAR' : 'PAUSAR'}
              </span>
            </Button>
          )}
        </div>
        )}

        {/* Sound, Skip & Conclude Match Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-auto justify-center sm:justify-end">
          <Button
            type="button"
            intent="ghost"
            onClick={() => matchAudio.setMuted(!muted)}
            aria-label={muted ? 'Ligar o som' : 'Desligar o som'}
            aria-pressed={!muted}
            title={muted ? 'Ligar o som' : 'Desligar o som'}
            className="border border-[var(--ui-line-subtle)] px-3"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </Button>
          {!isFinished && !(penaltyMode && penaltyWinner) && !broadcastMode && state.mode !== 'online' && (
            <Button
              type="button"
              intent="ghost"
              onClick={handleSkip}
              className="border border-[var(--ui-line-subtle)] px-4 sm:px-6"
            >
              <span className="inline-flex items-center gap-1.5"><SkipForward size={15} /> PULAR</span>
            </Button>
          )}

          {(isFinished || (penaltyMode && penaltyWinner)) && (
            <Button
              type="button"
              intent="primary"
              size="large"
              onClick={handleFinish}
              className="px-6 sm:px-8"
            >
              CONCLUIR →
            </Button>
          )}
        </div>
      </div>

      {/* Ticker styling override for custom thin scrolls */}
      <style>{`
        .match-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .match-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.01);
        }
        .match-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
        }
        .match-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.22);
        }
      `}</style>
    </AppShell>
  );
}
