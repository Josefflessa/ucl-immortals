// Full-screen goal moment shown during the live match replay: a big GOL, who
// scored (card) and the assist (card, when there is one). A goal for the viewer's
// team is a gold celebration with confetti; a goal conceded is a sober red version.
//
// Kept cheap and flicker-free: no backdrop blur, no animated filters, and every
// animation is a CSS keyframe on transform/opacity that holds its final frame
// (fill-mode "both"). A JS animation library resets an element's styles when its
// animation ends, which made the browser rebuild the card's layer and drop it for
// one frame — the cards "blinked". Holding the last keyframe keeps the layer stable.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Player } from '@shared/game/gameData';
import type { Team } from '@shared/game/gameEngine';
import PlayerCard, { type PlayerCardStats } from '../PlayerCard';
import Crest from '../Crest';

export interface GoalMoment {
  /** Team credited with the goal. */
  teamId: string;
  minute: number;
  /** Who put the ball in: the attacker, or the defender on an own goal. */
  scorer?: Player;
  scorerStats?: PlayerCardStats;
  assister?: Player;
  assisterStats?: PlayerCardStats;
  ownGoal: boolean;
  /** Goals by this scorer in the match, this one included. */
  scorerGoalCount: number;
  homeScore: number;
  awayScore: number;
}

/** How long each version stays on screen (it also holds the replay clock). Online
 * uses one duration for both sides: the two players replay the same match on their
 * own clocks, and different lengths per side would push them further apart at every goal. */
export const GOAL_CELEBRATION_MS = { mine: 3600, against: 2800, online: 3400 } as const;
/** Fade-out at the end; the page unmounts the overlay only after it. */
export const GOAL_CELEBRATION_FADE_MS = 220;

const CARDS_MOUNT_DELAY_MS = 120;

const FONT_GAME = { fontFamily: 'var(--font-game), sans-serif' } as const;
const FONT_DISPLAY = { fontFamily: 'var(--font-display), sans-serif' } as const;
const LAYER: CSSProperties = { willChange: 'transform, opacity', backfaceVisibility: 'hidden' };

const CONFETTI_COLORS = ['#FFD700', '#FDE68A', '#FFFFFF', '#F59E0B', '#22C55E'];
// Fixed layout (no per-render randomness): left %, delay s, duration s, size px, sway px.
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  delay: (i % 6) * 0.11,
  duration: 1.8 + ((i * 7) % 10) / 10,
  size: 5 + (i % 3) * 2,
  sway: ((i * 29) % 70) - 35,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

const KEYFRAMES = `
@keyframes goal-overlay-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes goal-title-in {
  0% { transform: scale(2.2); opacity: 0; }
  55% { transform: scale(.94); opacity: 1; }
  78% { transform: scale(1.03); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes goal-rise-in {
  from { transform: translate3d(0, 14px, 0); opacity: 0; }
  to { transform: translate3d(0, 0, 0); opacity: 1; }
}
@keyframes goal-card-in {
  0% { transform: translate3d(calc(var(--dir) * 36px), 50px, 0) rotate(calc(var(--dir) * 9deg)) scale(.75); opacity: 0; }
  65% { transform: translate3d(0, -6px, 0) rotate(calc(var(--dir) * -1deg)) scale(1.03); opacity: 1; }
  100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes goal-pop-in {
  0% { transform: scale(.6); opacity: 0; }
  70% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes goal-confetti {
  from { transform: translate3d(0, -6vh, 0) rotate(0deg); opacity: 1; }
  to { transform: translate3d(var(--sway), 108vh, 0) rotate(600deg); opacity: .85; }
}
@keyframes goal-rays { from { transform: translate(-50%, -50%) rotate(0deg) scale(.85); } to { transform: translate(-50%, -50%) rotate(22deg) scale(1); } }
@media (prefers-reduced-motion: reduce) { .goal-fx { display: none; } }
`;

const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';

export default function GoalCelebration({ goal, homeTeam, awayTeam, mine, leaving = false, onSkip }: {
  goal: GoalMoment;
  homeTeam: Team;
  awayTeam: Team;
  /** The goal favours the viewer (or a neutral spectator is watching). */
  mine: boolean;
  /** Fading out; the parent removes the overlay when the fade ends. */
  leaving?: boolean;
  /** Tap to dismiss early (solo only). */
  onSkip?: () => void;
}) {
  const accent = mine ? '#FFD700' : '#EF4444';
  const scoringTeam = goal.teamId === homeTeam.id ? homeTeam : awayTeam;
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const scorerScale = narrow ? (goal.assister ? 0.8 : 0.9) : 1.05;
  const assistScale = narrow ? 0.6 : 0.76;
  // The cards are the heaviest part to mount; let the headline paint first and
  // mount them a moment later so the entry is not one long frame.
  const [cardsReady, setCardsReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setCardsReady(true), CARDS_MOUNT_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  const milestone = goal.ownGoal ? null
    : goal.scorerGoalCount === 3 ? 'HAT-TRICK!'
      : goal.scorerGoalCount >= 2 ? `${goal.scorerGoalCount}º GOL DELE NO JOGO`
        : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      onClick={onSkip}
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-4 ${onSkip ? 'cursor-pointer' : 'pointer-events-none'}`}
      style={{
        background: `radial-gradient(70% 55% at 50% 50%, ${accent}26 0%, rgba(5,5,10,.94) 62%), rgba(5,5,10,.94)`,
        // Fade in with a keyframe that releases afterwards ("backwards"), so the
        // fade-out below can run as a plain transition on the same property.
        animation: 'goal-overlay-in 150ms ease-out backwards',
        opacity: leaving ? 0 : 1,
        transition: `opacity ${GOAL_CELEBRATION_FADE_MS}ms ease-out`,
        willChange: 'opacity',
      }}
    >
      <style>{KEYFRAMES}</style>

      {mine && (
        <>
          {/* Light rays: one composited layer, rotated once. */}
          <div aria-hidden="true" className="goal-fx pointer-events-none absolute left-1/2 top-1/2 h-[115vmax] w-[115vmax] rounded-full"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${accent}17 0deg 7deg, transparent 7deg 20deg)`,
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 60%)',
              maskImage: 'radial-gradient(circle, #000 0%, transparent 60%)',
              animation: `goal-rays ${GOAL_CELEBRATION_MS.mine}ms linear both`,
              willChange: 'transform',
            }} />
          {CONFETTI.map((c, i) => (
            <span key={i} aria-hidden="true" className="goal-fx pointer-events-none absolute top-0 rounded-[1px]"
              style={{
                left: `${c.left}%`, width: c.size, height: c.size * 1.8, background: c.color,
                ['--sway' as string]: `${c.sway}px`,
                animation: `goal-confetti ${c.duration}s ${c.delay}s ease-in both`,
                willChange: 'transform',
              }} />
          ))}
        </>
      )}

      <div className="relative flex w-full max-w-3xl flex-col items-center">
        {/* The word itself is the headline. */}
        <div
          className="text-center font-black leading-[0.85]"
          style={{
            ...FONT_DISPLAY,
            ...LAYER,
            animation: `goal-title-in 600ms ${EASE_OUT} both`,
            color: accent,
            fontSize: mine ? 'clamp(4.5rem, 21vw, 10rem)' : 'clamp(5rem, 26vw, 10rem)',
            letterSpacing: '0.03em',
            textShadow: `0 0 36px ${accent}99, 0 6px 0 rgba(0,0,0,.5)`,
          }}
        >
          {mine ? 'GOOOOOL!' : 'GOL'}
        </div>
        <div
          className="mt-2 flex items-center gap-2 text-center font-black uppercase tracking-[0.12em] text-white"
          style={{ ...FONT_GAME, ...LAYER, fontSize: 'clamp(1rem, 4.4vw, 1.6rem)', animation: `goal-rise-in 250ms ${EASE_OUT} 200ms both` }}
        >
          <Crest crestId={scoringTeam.crestId} name={scoringTeam.name} size={narrow ? 24 : 32} />
          {mine ? scoringTeam.name : `do ${scoringTeam.name}`}
        </div>

        {/* Cards: scorer (big) + assist (smaller) */}
        <div className="mt-6 flex items-end justify-center gap-4 sm:gap-8" style={{ minHeight: Math.round(324 * scorerScale) + 32 }}>
          {cardsReady && goal.scorer && (
            <CardSlot label={goal.ownGoal ? 'GOL CONTRA' : 'GOL'} accent={goal.ownGoal ? '#EF4444' : accent} delayMs={0} dir={-1}>
              <PlayerCard player={goal.scorer} effectiveStats={goal.scorerStats} scale={scorerScale} />
            </CardSlot>
          )}
          {cardsReady && goal.assister && (
            <CardSlot label="ASSISTÊNCIA" accent="#93C5FD" delayMs={180} dir={1}>
              <PlayerCard player={goal.assister} effectiveStats={goal.assisterStats} scale={assistScale} />
            </CardSlot>
          )}
        </div>

        {/* Caption */}
        <div className="mt-4 text-center" style={{ ...FONT_GAME, ...LAYER, animation: `goal-rise-in 250ms ${EASE_OUT} 650ms both` }}>
          <div className="text-lg font-black uppercase tracking-wide text-white sm:text-2xl">
            {goal.scorer?.shortName ?? 'Gol contra'}
            {goal.assister && <span className="text-[var(--ui-text-muted)]"> · assistência de <span className="text-[#93C5FD]">{goal.assister.shortName}</span></span>}
          </div>
          {goal.ownGoal && <div className="mt-0.5 text-sm font-bold text-[#FCA5A5]">contra o próprio time · ponto para o {scoringTeam.name}</div>}
          {milestone && (
            <div className="mt-2 inline-block rounded-full px-3 py-1 text-sm font-black tracking-widest"
              style={{ ...LAYER, background: `${accent}22`, color: accent, border: `1px solid ${accent}66`, animation: `goal-pop-in 450ms ${EASE_OUT} 900ms both` }}>
              {milestone}
            </div>
          )}
        </div>

        {onSkip && (
          <div className="mt-5 text-[12px] font-bold tracking-widest text-[var(--ui-text-faint)]" style={FONT_GAME}>
            TOQUE PARA CONTINUAR
          </div>
        )}
      </div>
    </div>
  );
}

function CardSlot({ label, accent, delayMs, dir, children }: { label: string; accent: string; delayMs: number; dir: -1 | 1; children: ReactNode }) {
  return (
    <div
      className="relative flex flex-col items-center"
      style={{ ...LAYER, ['--dir' as string]: dir, animation: `goal-card-in 650ms ${EASE_OUT} ${delayMs}ms both` }}
    >
      {/* Static glow behind the card (cheaper than a drop-shadow filter on the card). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-18%] bottom-[-6%] top-[8%] rounded-full"
        style={{ background: `radial-gradient(closest-side, ${accent}40, transparent)` }} />
      <span className="relative mb-2 rounded-md px-2.5 py-0.5 text-[12px] font-black tracking-[0.2em]"
        style={{ ...FONT_GAME, color: accent, background: `${accent}1f`, border: `1px solid ${accent}55` }}>
        {label}
      </span>
      <div className="relative">{children}</div>
    </div>
  );
}
