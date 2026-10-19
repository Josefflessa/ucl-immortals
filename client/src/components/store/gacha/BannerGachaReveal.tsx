/**
 * The banner draw, as a summoning: a dark sky and a circle that charges in the colour of the
 * best card (so the wait already tells you what is coming), a burst of light, then the cards.
 * One card is shown big with rays and a rarity banner; several are dealt face down and
 * flipped from the weakest to the best, pausing on a legendary or better to build the tension.
 * The result is already known (it came from the server): this only stages it.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Copy, FastForward, Sparkles } from 'lucide-react';
import type { AlbumLevel } from '@shared/game/album';
import type { Player, Rarity } from '@shared/game/gameData';
import { Button } from '../../../design-system';
import { useAlbum, type BannerBatchResult, type BannerDraw } from '../../../contexts/AlbumContext';
import { playSound, revealSoundFor } from '../../../audio/uiSound';
import { useMusicDuck } from '../../../audio/musicPlayer';
import PlayerCard from '../../game/PlayerCard';
import { albumCard, RARITY_LABEL, stickerLevel } from '../../album/albumData';
import { preloadCardAssets, preloadPlayerCardArtwork } from '../../../lib/cardPreload';
import { bestDraw, flipOrder, gridLayout, NEUTRAL_TIER, seeded, tierOf, type GachaTier } from './gachaTiers';
import './gachaReveal.css';

const FONT = { fontFamily: 'var(--font-game), sans-serif' };
const DISPLAY = { fontFamily: 'var(--font-display), sans-serif' };
const LOGO_URL = '/icons/logo_ucl.png';

const withAlpha = (hex: string, alpha: number) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

/** Close with a short fade instead of cutting away: returns the screen's extra class and a close that waits for it. */
function useFadeOut(onClose: () => void): { leaving: boolean; close: () => void; leave: (action: () => void) => void } {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const leave = useCallback((action: () => void) => {
    if (timer.current) return;
    setLeaving(true);
    timer.current = setTimeout(action, 240);
  }, []);
  const close = useCallback(() => leave(onClose), [leave, onClose]);
  return { leaving, close, leave };
}

function useViewport(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/** What the last screen offers when "continue" is not all: its own buttons, and a line or card list above them. */
export interface RevealSummary {
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  extra?: React.ReactNode;
}

/** The last screen's buttons: just "continue", or the caller's own (each leaves with the fade). */
function RevealButtons({ summary, onDefault, leave }: { summary?: RevealSummary; onDefault: () => void; leave: (action: () => void) => void }) {
  if (!summary) return <Button intent="primary" size="large" onClick={onDefault} className="w-full max-w-xs">CONTINUAR</Button>;
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <Button intent="primary" size="large" onClick={() => leave(summary.onPrimary)} className="w-full">{summary.primaryLabel}</Button>
      {summary.secondaryLabel && summary.onSecondary ? <Button intent="ghost" onClick={() => leave(summary.onSecondary!)} className="w-full">{summary.secondaryLabel}</Button> : null}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────────

/** Particles drifting to the centre (charging) or flung out of it (burst). */
export function Particles({ count, color, mode, seed, spread = 260, lead = 0 }: { count: number; color: string; mode: 'in' | 'out'; seed: number; spread?: number; /** Seconds to hold the burst back (a flipping card must not show it edge-on). */ lead?: number }) {
  const items = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => {
      const angle = rand() * Math.PI * 2;
      const distance = spread * (0.45 + rand() * 0.75);
      return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size: 2 + rand() * 4, delay: lead + rand() * (mode === 'in' ? 1.4 : 0.15), duration: mode === 'in' ? 1 + rand() * 0.9 : 0.8 + rand() * 0.9 };
    });
  }, [count, mode, seed, spread, lead]);
  return (
    <>
      {items.map((item, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`gacha-particle gacha-particle--${mode}`}
          style={{ '--x': `${item.x}px`, '--y': `${item.y}px`, '--s': `${item.size}px`, '--c': color, '--d': `${item.duration}s`, '--delay': `${item.delay}s` } as React.CSSProperties}
        />
      ))}
    </>
  );
}

function Shockwaves({ tier, scale = 1, lead = 0 }: { tier: GachaTier; scale?: number; lead?: number }) {
  return (
    <>
      {Array.from({ length: tier.shockwaves }, (_, index) => (
        <span key={index} aria-hidden="true" className="gacha-shock" style={{ '--c': index === 0 ? tier.color : tier.accent, '--delay': `${lead + index * 0.18}s`, '--to': 1.5 * scale } as React.CSSProperties} />
      ))}
    </>
  );
}

/**
 * The pulse and sparks of a reveal, kept apart from the card on purpose: a sibling of the card's own box, never inside
 * its perspective, flip or float. It is built with the card, invisible and paused, and released by `go` (so nothing is
 * created while the card turns). It paints only plain gradients and dots, no blurred shadows.
 */
function BurstLayer({ tier, go, scale = 1, particles, seed, spread }: { tier: GachaTier; go: boolean; scale?: number; particles: number; seed: number; spread: number }) {
  return (
    <div aria-hidden="true" className={`gacha-burst pointer-events-none absolute inset-0 z-0 ${go ? 'gacha-burst--go' : ''}`}>
      <Shockwaves tier={tier} scale={scale} />
      <Particles count={particles} color={tier.color} mode="out" seed={seed} spread={spread} />
    </div>
  );
}

/** The sky: dark, tinted by the tier, with two layers of slowly drifting stars. */
function Sky({ tier, children, shaking }: { tier: GachaTier; children: React.ReactNode; shaking?: boolean }) {
  return (
    <div
      className={`gacha-root absolute inset-0 overflow-hidden ${shaking ? 'gacha-shake' : ''}`}
      style={{ backgroundColor: '#04050A', backgroundImage: `radial-gradient(ellipse at 50% 42%, ${withAlpha(tier.color, 0.2)} 0%, #0B0C18 48%, #04050A 100%)` }}
    >
      <div className="gacha-stars" aria-hidden="true" />
      <div className="gacha-stars gacha-stars--far" aria-hidden="true" />
      {children}
    </div>
  );
}

/** The summoning circle that charges: rings, a hexagram, a growing orb and particles pulled in. */
function ChargeStage({ tier, durationMs, reduced }: { tier: GachaTier; durationMs: number; reduced: boolean }) {
  const seconds = durationMs / 1000;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative" style={{ width: 'min(78vw, 46vh, 420px)', aspectRatio: '1' }}>
        <Particles count={reduced ? 0 : 18} color={tier.color} mode="in" seed={tier.rank + 3} spread={Math.min(window.innerWidth, 700) * 0.5} />
        {/* Glow breathing faster as it nears the burst */}
        <motion.div
          aria-hidden="true"
          className="absolute -inset-[28%] rounded-full"
          style={{ background: `radial-gradient(circle, ${withAlpha(tier.color, 0.55)} 0%, ${withAlpha(tier.color, 0.12)} 45%, transparent 68%)` }}
          animate={{ scale: [0.8, 1.05, 0.85, 1.15, 0.9, 1.3, 1.7], opacity: [0.5, 0.8, 0.6, 0.9, 0.7, 1, 1] }}
          transition={{ duration: seconds, times: [0, 0.2, 0.36, 0.52, 0.66, 0.84, 1], ease: 'easeInOut' }}
        />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {/* The centre circle and halfway line of a pitch, very faint, behind the rings */}
          <circle cx="50" cy="50" r="30" fill="none" stroke={tier.color} strokeWidth=".3" opacity=".25" />
          <g className="gacha-ring gacha-ring--a"><circle cx="50" cy="50" r="48" fill="none" stroke={tier.color} strokeWidth=".7" strokeDasharray="1.2 3.2" opacity=".85" /></g>
          <g className="gacha-ring gacha-ring--b"><circle cx="50" cy="50" r="42" fill="none" stroke={tier.color} strokeWidth="2.2" strokeDasharray="0.25 1.8" opacity=".6" /><circle cx="50" cy="8" r="1.7" fill={tier.color} /><circle cx="50" cy="92" r="1.7" fill={tier.color} /></g>
          <g className="gacha-ring gacha-ring--c"><circle cx="50" cy="50" r="36" fill="none" stroke={tier.accent} strokeWidth="1.1" strokeLinecap="round" strokeDasharray="42 28.6" opacity=".85" /></g>
        </svg>
        {/* Core: starts small and dim, ends bright and big */}
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle at 50% 45%, #fff 0%, ${tier.color} 42%, ${withAlpha(tier.color, 0.0)} 72%)` }}
          animate={{ scale: [0.5, 0.8, 1.1, 1.8, 2.6], opacity: [0.6, 0.9, 1, 1, 1] }}
          transition={{ duration: seconds, times: [0, 0.3, 0.6, 0.88, 1], ease: 'easeIn' }}
        />
      </div>
    </div>
  );
}

/** A white-hot flash that opens the reveal (tinted for the better tiers). */
function Flash({ tier, strength = 1 }: { tier: GachaTier; strength?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30"
      style={{ background: `radial-gradient(circle at 50% 50%, #fff 0%, ${withAlpha(tier.color, 0.9)} 40%, ${withAlpha(tier.color, 0.5)} 100%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, reduced ? Math.min(strength, 0.2) : strength, 0] }}
      transition={{ duration: 0.7, times: [0, 0.18, 1], ease: 'easeOut' }}
    />
  );
}

function Rays({ tier }: { tier: GachaTier }) {
  // Kept mounted once seen and faded in and out: a big layer that pops in and out as the cards change reads as a blink.
  const last = useRef(tier);
  if (tier.rays > 0) last.current = tier;
  const shown = last.current;
  if (shown.rays <= 0) return null;
  return (
    <div className="gacha-rays" aria-hidden="true" style={{ '--c': shown.color, '--a': shown.accent, '--o': shown.rays, opacity: tier.rays > 0 ? 1 : 0, transition: 'opacity .45s ease' } as React.CSSProperties}>
      <div className="gacha-rays__spin" />
      {tier.rank >= 4 ? <div className="gacha-rays__spin gacha-rays__spin--accent" /> : null}
    </div>
  );
}

function NewTag({ isNew }: { isNew: boolean | null }) {
  if (isNew === null) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-[0.12em] text-[#0A0A12]" style={{ background: isNew ? '#7BD88F' : '#E9C46A', ...FONT }}>
      {isNew ? <Sparkles size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}{isNew ? 'NOVA' : 'REPETIDA'}
    </span>
  );
}

// ── One card, big ───────────────────────────────────────────────────────────────

interface HeroProps {
  player: Player;
  rarity: Rarity;
  /** Null hides the new / repeated tag (a card that is not going to the album). */
  isNew: boolean | null;
  pity?: boolean;
  pageRewards?: BannerBatchResult['pageRewards'];
  /** A line under the name (what happens to the card). */
  note?: string;
  ctaLabel: string;
  onCta: () => void;
  /** Replaces the single button with the caller's own (see RevealSummary). */
  summary?: RevealSummary;
  leave?: (action: () => void) => void;
}

/** One card, big: the rarity banner, rays and a shockwave behind it, the name and a single button. */
function HeroReveal({ player, rarity, isNew, pity = false, pageRewards = [], note, ctaLabel, onCta, summary, leave }: HeroProps) {
  const { album } = useAlbum();
  const { height } = useViewport();
  const tier = tierOf(rarity);
  // What was drawn is the base card, as in the catalogue: not the level the player's copy has reached. (The competition's
  // player pack, which passes no new/repeated tag, keeps showing what it always showed.)
  const level = isNew === null ? stickerLevel(album, player.id) : 0;
  const scale = Math.max(0.7, Math.min(1.05, (height - 330) / 324));
  // The burst is released only after the card has landed (it is built, paused, with the card).
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setBurst(true), 450);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
      <Rays tier={tier} />
      <div
        className="gacha-drop relative z-10 flex items-center gap-3 text-[15px] font-black uppercase tracking-[0.32em] sm:text-lg"
        style={{ color: tier.color, textShadow: `0 0 18px ${withAlpha(tier.color, 0.8)}`, '--delay': '0.25s', ...FONT } as React.CSSProperties}
      >
        <span aria-hidden="true" className="h-px w-10 sm:w-16" style={{ background: `linear-gradient(90deg, transparent, ${tier.color})` }} />
        {RARITY_LABEL[rarity]}
        <span aria-hidden="true" className="h-px w-10 sm:w-16" style={{ background: `linear-gradient(270deg, transparent, ${tier.color})` }} />
      </div>

      <div className="relative z-10">
       <BurstLayer tier={tier} go={burst} particles={tier.particles} seed={tier.rank + 11} spread={300} />
       <div className="gacha-float relative z-[1]">
        <motion.div
          initial={{ opacity: 0, scale: 0.35, rotateY: 150, y: 40 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.1 }}
          style={{ perspective: 1000 }}
        >
          <div aria-hidden="true" className="absolute -inset-x-[42%] -inset-y-[26%] -z-[1]" style={{ background: `radial-gradient(closest-side, ${withAlpha(tier.color, 0.5)} 0%, ${withAlpha(tier.color, 0.26)} 32%, ${withAlpha(tier.color, 0.1)} 62%, transparent 100%)` }} />
          <PlayerCard player={player} lite flat scale={scale} albumLevel={level > 0 ? level as AlbumLevel : undefined} />
        </motion.div>
        <div aria-hidden="true" className="absolute -bottom-5 left-1/2 h-5 w-[72%] -translate-x-1/2 rounded-[50%]" style={{ background: `radial-gradient(ellipse, ${withAlpha(tier.color, 0.45)} 0%, transparent 70%)` }} />
       </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <div className="gacha-rise text-3xl leading-none text-white sm:text-4xl" style={{ '--delay': '0.7s', ...DISPLAY, textShadow: '0 2px 14px rgba(0,0,0,.8)' } as React.CSSProperties}>{player.shortName.toUpperCase()}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <NewTag isNew={isNew} />
          {pity ? <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.12em] text-white/85" style={FONT}><Check size={11} aria-hidden="true" />GARANTIA ATIVADA</span> : null}
        </div>
        {pageRewards.length > 0 ? <p className="max-w-sm text-xs text-[var(--ui-success)]" style={FONT}>{pageRewards.length === 1 ? 'Uma página do álbum foi completada: recompensa recebida.' : `${pageRewards.length} páginas do álbum completadas: recompensas recebidas.`}</p> : null}
        {note ? <p className="max-w-[20rem] text-xs leading-relaxed text-white/60" style={FONT}>{note}</p> : null}
      </div>

      <div className="gacha-rise relative z-10 mt-1 w-full max-w-xs" style={{ '--delay': '0.95s' } as React.CSSProperties}>
        {summary && leave ? <div className="flex w-full flex-col items-center gap-3">{summary.extra}<RevealButtons summary={summary} onDefault={onCta} leave={leave} /></div> : <Button intent="primary" size="large" onClick={onCta} className="w-full">{ctaLabel}</Button>}
      </div>
    </div>
  );
}

// ── Several cards, face down then flipped ───────────────────────────────────────

const FlipCard = memo(function FlipCard({ draw, tier, scale, flipped, charging, index }: { draw: BannerDraw; tier: GachaTier; scale: number; flipped: boolean; charging: boolean; index: number }) {
  const player = albumCard(draw.card.id);
  const width = 200 * scale;
  const height = 324 * scale;
  // The burst (pulse and sparks) is built with the card, invisible and paused, and only released once the card has
  // turned. Creating its animated layers at the pulse made the card blink (the browser re-layers the card under them),
  // and shown earlier it would be seen through the card while it is edge-on.
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!flipped || tier.rank < 2) return;
    const timer = setTimeout(() => setBurst(true), 380);
    return () => clearTimeout(timer);
  }, [flipped, tier.rank]);
  if (!player) return null;
  return (
    <div className="flex flex-col items-center" style={{ width }}>
      <div className="relative" style={{ width, height }}>
       {tier.rank >= 2 ? <BurstLayer tier={tier} go={burst} scale={0.6} particles={Math.round(tier.particles * 0.35)} seed={index + tier.rank * 7} spread={170} /> : null}
       <div className="relative z-[1] size-full" style={{ perspective: 900 }}>
        <motion.div
          className="relative size-full"
          style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d', willChange: 'transform' }}
          animate={{ rotateY: flipped ? 180 : 0, scale: charging ? 1.07 : 1 }}
          transition={{ rotateY: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.4 } }}
        >
          <div className="gacha-back absolute inset-0" data-flipped={flipped} style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderColor: charging ? tier.color : undefined, boxShadow: charging ? `0 0 34px ${tier.color}, 0 0 70px ${withAlpha(tier.color, 0.55)}` : undefined, transition: 'box-shadow .5s, border-color .5s' }}>
            <img src={LOGO_URL} alt="" draggable={false} className="absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-60" />
          </div>
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <div aria-hidden="true" className="absolute -inset-x-[34%] -inset-y-[22%] -z-[1]" style={{ background: `radial-gradient(closest-side, ${withAlpha(tier.color, tier.rank >= 3 ? 0.5 : 0.3)} 0%, ${withAlpha(tier.color, tier.rank >= 3 ? 0.2 : 0.1)} 55%, transparent 100%)`, opacity: flipped ? 1 : 0, transition: 'opacity .5s' }} />
            {/* The base card, as in the catalogue: the level of the player's copy is not part of what was drawn. */}
            <PlayerCard player={player} lite flat scale={scale} />
          </div>
        </motion.div>
        {flipped ? <div className="absolute left-1/2 top-0 z-[5] -translate-x-1/2 -translate-y-1/2"><NewTag isNew={draw.card.isNew} /></div> : null}
       </div>
      </div>
      <div className="mt-2 flex h-9 flex-col items-center text-center" style={{ opacity: flipped ? 1 : 0, transition: 'opacity .4s .3s' }}>
        <span className="w-full truncate text-[12px] font-bold text-white" style={{ ...FONT, maxWidth: Math.max(width, 80) }}>{player.shortName}</span>
        <span className="text-[11px] font-semibold" style={{ color: tier.color, ...FONT }}>{RARITY_LABEL[draw.rarity]}</span>
      </div>
    </div>
  );
});

/** Several cards on a wide screen: dealt face down and flipped in order. On a phone the same grid is only the summary (autoplay off: everything is already face up). */
function GridReveal({ draws, onClose, reduced, autoplay, summary, leave }: { draws: BannerBatchResult; onClose: () => void; reduced: boolean; autoplay: boolean; summary?: RevealSummary; leave: (action: () => void) => void }) {
  const { width, height } = useViewport();
  const cards = draws.cards;
  const order = useMemo(() => flipOrder(cards.map(draw => draw.rarity)), [cards]);
  const [flipped, setFlipped] = useState<ReadonlySet<number>>(() => autoplay ? new Set() : new Set(cards.map((_, index) => index)));
  const [charging, setCharging] = useState<number | null>(null);
  const [step, setStep] = useState(() => autoplay ? 0 : order.length);
  const flipNow = useRef<(() => void) | null>(null);
  const done = step >= order.length;

  useEffect(() => {
    if (step >= order.length) return;
    const position = order[step];
    const tier = tierOf(cards[position].rarity);
    const previous = step > 0 ? tierOf(cards[order[step - 1]].rarity) : null;
    const wait = reduced ? 160 : step === 0 ? 550 : previous && previous.rank >= 3 ? 1000 : 430;
    let suspense: ReturnType<typeof setTimeout> | undefined;
    let begin: ReturnType<typeof setTimeout> | undefined;
    const flip = () => {
      clearTimeout(begin); clearTimeout(suspense);
      setCharging(null);
      setFlipped(current => new Set(current).add(position));
      // The sound is built a moment after the flip starts: doing it in the same frame made the turn stutter.
      if (tier.rank >= 2) setTimeout(() => playSound(revealSoundFor(cards[position].rarity)), 200);
      setStep(current => current + 1);
    };
    flipNow.current = flip;
    begin = setTimeout(() => {
      if (tier.suspenseMs > 0 && !reduced) { setCharging(position); suspense = setTimeout(flip, tier.suspenseMs); } else flip();
    }, wait);
    return () => { clearTimeout(begin); clearTimeout(suspense); };
  }, [step, order, cards, reduced]);

  const skipAll = useCallback(() => {
    setCharging(null);
    setFlipped(new Set(cards.map((_, index) => index)));
    setStep(order.length);
  }, [cards, order.length]);

  const { columns, scale } = gridLayout(cards.length, width, Math.max(160, height - 215), autoplay);
  const best = bestDraw(cards)!;
  const bestTier = tierOf(best.rarity);
  const newCount = cards.filter(draw => draw.card.isNew).length;

  return (
    <div className="absolute inset-0 flex flex-col" onClick={() => { if (!done) flipNow.current?.(); }}>
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4 sm:px-8" onClick={event => event.stopPropagation()}>
        <div className="text-[13px] font-black tracking-[0.2em] text-white/80" style={FONT}>
          SORTEIO · <span className="tabular-nums" style={{ color: bestTier.color }}>{flipped.size}/{cards.length}</span>
        </div>
        {!done ? (
          <button type="button" onClick={skipAll} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-4 text-[12px] font-bold tracking-[0.14em] text-white/85 outline-none hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/60" style={FONT}>
            <FastForward size={14} aria-hidden="true" /> PULAR
          </button>
        ) : null}
      </div>

      <div className="gacha-scroll flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-2">
        <div className="m-auto grid justify-center gap-x-3 gap-y-5 pt-3" style={{ gridTemplateColumns: `repeat(${columns}, ${200 * scale}px)` }} aria-label="Cartas sorteadas">
          {cards.map((draw, index) => <FlipCard key={`${draw.card.id}:${index}`} draw={draw} tier={tierOf(draw.rarity)} scale={scale} flipped={flipped.has(index)} charging={charging === index} index={index} />)}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-5 pt-2" style={{ minHeight: 120 }} onClick={event => event.stopPropagation()}>
        {done ? (
          <div className="gacha-rise mx-auto flex max-w-md flex-col items-center gap-2 text-center">
            <p className="text-[13px] text-white/75" style={FONT}>
              {newCount > 0 ? <><strong className="text-[#7BD88F]">{newCount} {newCount === 1 ? 'nova' : 'novas'}</strong> · {cards.length - newCount} {cards.length - newCount === 1 ? 'repetida' : 'repetidas'}</> : <>{cards.length} repetidas</>}
              {cards.some(draw => draw.pityTriggered) ? <> · <span className="text-[var(--ui-brand-strong)]">garantia ativada</span></> : null}
            </p>
            {draws.pageRewards.length > 0 ? <p className="text-xs text-[var(--ui-success)]" style={FONT}>{draws.pageRewards.length === 1 ? 'Uma página do álbum foi completada: recompensa recebida.' : `${draws.pageRewards.length} páginas do álbum completadas: recompensas recebidas.`}</p> : null}
            {summary?.extra}
            <RevealButtons summary={summary} onDefault={onClose} leave={leave} />
          </div>
        ) : (
          <p className="text-center text-[12px] tracking-[0.18em] text-white/45" style={FONT}>TOQUE PARA ACELERAR</p>
        )}
      </div>
    </div>
  );
}

/**
 * While the charge or pack tear plays, cards are drawn out of sight so their textures and frames
 * are already in the browser cache before the reveal begins.
 */
function Warmup({ draws }: { draws: BannerBatchResult }) {
  const ids = useMemo(() => Array.from(new Set(draws.cards.map(draw => draw.card.id))), [draws]);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 size-px overflow-hidden opacity-0">
      {ids.map(id => { const player = albumCard(id); return player ? <PlayerCard key={id} player={player} lite scale={0.3} /> : null; })}
    </div>
  );
}

// ── Several cards on a phone: one big card at a time ─────────────────────────────

/** The cards come up one by one, big, weakest first. A tap flips, then moves on; it also moves by itself. */
function StackReveal({ draws, reduced, onDone }: { draws: BannerBatchResult; reduced: boolean; onDone: () => void }) {
  const { width, height } = useViewport();
  const cards = draws.cards;
  const order = useMemo(() => flipOrder(cards.map(draw => draw.rarity)), [cards]);
  const [step, setStep] = useState(0);
  const [flippedStep, setFlippedStep] = useState<number | null>(null);
  const [chargingStep, setChargingStep] = useState<number | null>(null);
  const flipNow = useRef<(() => void) | null>(null);
  const advanceNow = useRef<(() => void) | null>(null);
  const position = order[Math.min(step, order.length - 1)];
  const draw = cards[position];
  const tier = tierOf(draw.rarity);
  const flipped = flippedStep === step;
  const charging = chargingStep === step;

  useEffect(() => {
    let begin: ReturnType<typeof setTimeout> | undefined;
    let suspense: ReturnType<typeof setTimeout> | undefined;
    let hold: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      clearTimeout(hold);
      if (step + 1 >= order.length) onDone(); else setStep(current => current + 1);
    };
    const flip = () => {
      clearTimeout(begin); clearTimeout(suspense);
      setChargingStep(null);
      setFlippedStep(step);
      if (tier.rank >= 2) setTimeout(() => playSound(revealSoundFor(draw.rarity)), 200);
      advanceNow.current = advance;
      flipNow.current = null;
      hold = setTimeout(advance, reduced ? 700 : tier.rank >= 3 ? 2300 : 1350);
    };
    flipNow.current = flip;
    advanceNow.current = null;
    begin = setTimeout(() => {
      if (tier.suspenseMs > 0 && !reduced) { setChargingStep(step); suspense = setTimeout(flip, tier.suspenseMs); } else flip();
    }, reduced ? 120 : 520);
    return () => { clearTimeout(begin); clearTimeout(suspense); clearTimeout(hold); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const scale = Math.max(0.55, Math.min(1, (width - 56) / 200, (height - 360) / 324));
  return (
    <div className="absolute inset-0 flex flex-col" onClick={() => { (flipNow.current ?? advanceNow.current)?.(); }}>
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4" onClick={event => event.stopPropagation()}>
        <div className="text-[13px] font-black tracking-[0.2em] text-white/80" style={FONT}>
          SORTEIO · <span className="tabular-nums" style={{ color: tier.color }}>{step + 1}/{cards.length}</span>
        </div>
        <button type="button" onClick={onDone} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-4 text-[12px] font-bold tracking-[0.14em] text-white/85 outline-none focus-visible:ring-2 focus-visible:ring-white/60" style={FONT}>
          <FastForward size={14} aria-hidden="true" /> PULAR
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* Only once the card is face up: the rays must not give its rarity away while it is still face down. */}
        <Rays tier={flipped ? tier : NEUTRAL_TIER} />
        <motion.div
          key={step}
          className="relative z-10"
          initial={reduced ? false : { opacity: 0, x: 70, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <FlipCard draw={draw} tier={tier} scale={scale} flipped={flipped} charging={charging} index={step} />
        </motion.div>
      </div>
      <div className="shrink-0 pb-8 pt-2" onClick={event => event.stopPropagation()}>
        <div className="mb-3 flex justify-center gap-1.5" aria-hidden="true">
          {order.map((_, index) => <span key={index} className="h-1.5 rounded-full transition-all" style={{ width: index === step ? 18 : 6, background: index <= step ? tier.color : 'rgba(255,255,255,.22)' }} />)}
        </div>
        <p className="text-center text-[12px] tracking-[0.18em] text-white/45" style={FONT}>TOQUE PARA CONTINUAR</p>
      </div>
    </div>
  );
}

// ── The whole sequence ──────────────────────────────────────────────────────────

export default function BannerGachaReveal({ draws: incomingDraws, onClose, skipCharge = false, summary }: { draws: BannerBatchResult; onClose: () => void; /** Straight to the burst: the pack's tear was the build-up. */ skipCharge?: boolean; /** The last screen's own buttons (a pack's "open the next" / "finish"), instead of "continue". */ summary?: RevealSummary }) {
  const [draws] = useState(incomingDraws);
  const reduced = useReducedMotion() ?? false;
  useMusicDuck();
  const { leaving, close, leave } = useFadeOut(onClose);
  const best = bestDraw(draws.cards);
  const tier = tierOf((best?.rarity ?? 'bronze') as Rarity);
  // A pack's tear was the build-up, and its cards are face down at the burst: the sky, the flash and the shake must not
  // already carry the best card's colour (that would give it away). One card on its own is shown at once, so it may.
  const stageTier = skipCharge && draws.cards.length > 1 ? NEUTRAL_TIER : tier;
  const [phase, setPhase] = useState<'charge' | 'reveal'>(skipCharge ? 'reveal' : 'charge');
  const { width } = useViewport();
  const narrow = width < 720;
  const [stackDone, setStackDone] = useState(false);
  const chargeMs = reduced ? 500 : tier.chargeMs;
  // Start the warm-up during the charge, or immediately when a pack skips it,
  // so every hidden card has its frame and texture ready before its turn.
  const [warm, setWarm] = useState(skipCharge);
  // The photos, flags and crests too, so a card turned over never shows them popping in.
  useEffect(() => {
    const players = draws.cards.flatMap(card => { const player = albumCard(card.card.id); return player ? [player] : []; });
    void preloadPlayerCardArtwork(players);
    return preloadCardAssets(players);
  }, [draws]);
  useEffect(() => {
    if (skipCharge) return;
    const timer = setTimeout(() => setWarm(true), 350);
    return () => clearTimeout(timer);
  }, [skipCharge]);

  // The charge ends by itself; a tap or Esc skips straight to the burst.
  useEffect(() => {
    if (phase !== 'charge') return;
    const timer = setTimeout(() => setPhase('reveal'), chargeMs);
    return () => clearTimeout(timer);
  }, [phase, chargeMs]);
  const revealSounded = useRef(false);
  useEffect(() => {
    if (phase !== 'reveal' || revealSounded.current || !best || draws.cards.length !== 1) return;
    revealSounded.current = true;
    playSound(revealSoundFor(best.rarity));
  }, [phase, best, draws.cards.length]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (phase === 'charge') setPhase('reveal'); else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, close]);

  const shakeAtBurst = phase === 'reveal' && stageTier.shake && !reduced;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Resultado do sorteio" className={`gacha-screen fixed inset-0 z-[90] select-none overflow-hidden text-white ${leaving ? 'gacha-screen--leaving' : ''}`}>
      <Sky tier={stageTier} shaking={shakeAtBurst}>
        {phase === 'charge' ? (
          <button type="button" aria-label="Pular animação" onClick={() => setPhase('reveal')} className="absolute inset-0 z-10 cursor-pointer outline-none">
            <ChargeStage tier={tier} durationMs={chargeMs} reduced={reduced} />
            <div className="absolute inset-x-0 bottom-[9%] text-center text-[12px] tracking-[0.3em] text-white/50" style={FONT}>TOQUE PARA PULAR</div>
          </button>
        ) : draws.cards.length === 1 && best && albumCard(best.card.id) ? (
          <HeroReveal player={albumCard(best.card.id)!} rarity={best.rarity} isNew={best.card.isNew} pity={best.pityTriggered} pageRewards={draws.pageRewards} ctaLabel="CONTINUAR" onCta={close} summary={summary} leave={leave} />
        ) : narrow && !stackDone ? (
          <StackReveal draws={draws} reduced={reduced} onDone={() => setStackDone(true)} />
        ) : (
          <GridReveal draws={draws} onClose={close} reduced={reduced} autoplay={!narrow} summary={summary} leave={leave} />
        )}
        {phase === 'reveal' ? <Flash tier={stageTier} /> : null}
        {warm ? <Warmup draws={draws} /> : null}
      </Sky>
      {/* Screen readers get the result at once, whatever the animation is doing. */}
      <ul className="sr-only">
        {draws.cards.map((draw, index) => <li key={index}>{albumCard(draw.card.id)?.shortName ?? draw.card.id}, {RARITY_LABEL[draw.rarity]}, {draw.card.isNew ? 'nova' : 'repetida'}</li>)}
      </ul>
    </div>,
    document.body,
  );
}

/**
 * One card (not necessarily from the album) revealed on its own: the burst, the rarity banner
 * and the card, with a single button. Used by the competition shop's player packs.
 */
export function PlayerRevealOverlay({ player, ctaLabel, onCta, note }: { player: Player; ctaLabel: string; onCta: () => void; note?: string }) {
  const tier = tierOf(player.rarity);
  useMusicDuck();
  const { leaving, close } = useFadeOut(onCta);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Carta revelada" className={`gacha-screen fixed inset-0 z-[90] select-none overflow-hidden text-white ${leaving ? 'gacha-screen--leaving' : ''}`}>
      <Sky tier={tier}>
        <HeroReveal player={player} rarity={player.rarity} isNew={null} ctaLabel={ctaLabel} onCta={close} note={note} />
        <Flash tier={tier} />
      </Sky>
    </div>,
    document.body,
  );
}
