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
import PlayerCard from '../../game/PlayerCard';
import { albumCard, RARITY_LABEL, stickerLevel } from '../../album/albumData';
import { bestDraw, flipOrder, gridLayout, seeded, tierOf, type GachaTier } from './gachaTiers';
import './gachaReveal.css';

const FONT = { fontFamily: 'var(--font-game), sans-serif' };
const DISPLAY = { fontFamily: 'var(--font-display), sans-serif' };
const LOGO_URL = '/icons/logo_ucl.png';

const withAlpha = (hex: string, alpha: number) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

/** Close with a short fade instead of cutting away: returns the screen's extra class and a close that waits for it. */
function useFadeOut(onClose: () => void): { leaving: boolean; close: () => void } {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = useCallback(() => {
    if (timer.current) return;
    setLeaving(true);
    timer.current = setTimeout(onClose, 240);
  }, [onClose]);
  return { leaving, close };
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

// ── Pieces ──────────────────────────────────────────────────────────────────────

/** Particles drifting to the centre (charging) or flung out of it (burst). */
export function Particles({ count, color, mode, seed, spread = 260 }: { count: number; color: string; mode: 'in' | 'out'; seed: number; spread?: number }) {
  const items = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => {
      const angle = rand() * Math.PI * 2;
      const distance = spread * (0.45 + rand() * 0.75);
      return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, size: 2 + rand() * 4, delay: rand() * (mode === 'in' ? 1.4 : 0.15), duration: mode === 'in' ? 1 + rand() * 0.9 : 0.8 + rand() * 0.9 };
    });
  }, [count, mode, seed, spread]);
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

function Shockwaves({ tier, scale = 1 }: { tier: GachaTier; scale?: number }) {
  return (
    <>
      {Array.from({ length: tier.shockwaves }, (_, index) => (
        <span key={index} aria-hidden="true" className="gacha-shock" style={{ '--c': index === 0 ? tier.color : tier.accent, '--delay': `${index * 0.18}s`, '--to': 1.5 * scale } as React.CSSProperties} />
      ))}
    </>
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
  if (tier.rays <= 0) return null;
  return (
    <div className="gacha-rays" aria-hidden="true" style={{ '--c': tier.color, '--a': tier.accent, '--o': tier.rays } as React.CSSProperties}>
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
}

/** One card, big: the rarity banner, rays and a shockwave behind it, the name and a single button. */
function HeroReveal({ player, rarity, isNew, pity = false, pageRewards = [], note, ctaLabel, onCta }: HeroProps) {
  const { album } = useAlbum();
  const { height } = useViewport();
  const tier = tierOf(rarity);
  const level = stickerLevel(album, player.id);
  const scale = Math.max(0.7, Math.min(1.05, (height - 330) / 324));
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
      <Rays tier={tier} />
      <motion.div
        initial={{ opacity: 0, y: -14, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.32em' }}
        transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex items-center gap-3 text-[15px] font-black uppercase sm:text-lg"
        style={{ color: tier.color, textShadow: `0 0 18px ${withAlpha(tier.color, 0.8)}`, ...FONT }}
      >
        <span aria-hidden="true" className="h-px w-10 sm:w-16" style={{ background: `linear-gradient(90deg, transparent, ${tier.color})` }} />
        {RARITY_LABEL[rarity]}
        <span aria-hidden="true" className="h-px w-10 sm:w-16" style={{ background: `linear-gradient(270deg, transparent, ${tier.color})` }} />
      </motion.div>

      <div className="gacha-float relative z-10">
        <Shockwaves tier={tier} />
        <Particles count={tier.particles} color={tier.color} mode="out" seed={tier.rank + 11} spread={300} />
        <motion.div
          initial={{ opacity: 0, scale: 0.35, rotateY: 150, y: 40 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.1 }}
          style={{ perspective: 1000 }}
        >
          <div aria-hidden="true" className="absolute -inset-x-[42%] -inset-y-[26%] -z-[1]" style={{ background: `radial-gradient(closest-side, ${withAlpha(tier.color, 0.5)} 0%, ${withAlpha(tier.color, 0.26)} 32%, ${withAlpha(tier.color, 0.1)} 62%, transparent 100%)` }} />
          <PlayerCard player={player} lite scale={scale} albumLevel={level > 0 ? level as AlbumLevel : undefined} />
        </motion.div>
        <div aria-hidden="true" className="absolute -bottom-5 left-1/2 h-5 w-[72%] -translate-x-1/2 rounded-[50%]" style={{ background: `radial-gradient(ellipse, ${withAlpha(tier.color, 0.45)} 0%, transparent 70%)` }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }} className="relative z-10 flex flex-col items-center gap-2 text-center">
        <div className="text-3xl leading-none text-white sm:text-4xl" style={{ ...DISPLAY, textShadow: '0 2px 14px rgba(0,0,0,.8)' }}>{player.shortName.toUpperCase()}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <NewTag isNew={isNew} />
          {pity ? <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.12em] text-white/85" style={FONT}><Check size={11} aria-hidden="true" />GARANTIA ATIVADA</span> : null}
        </div>
        {pageRewards.length > 0 ? <p className="max-w-sm text-xs text-[var(--ui-success)]" style={FONT}>{pageRewards.length === 1 ? 'Uma página do álbum foi completada: recompensa recebida.' : `${pageRewards.length} páginas do álbum completadas: recompensas recebidas.`}</p> : null}
        {note ? <p className="max-w-[20rem] text-xs leading-relaxed text-white/60" style={FONT}>{note}</p> : null}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="relative z-10 mt-1 w-full max-w-xs">
        <Button intent="primary" size="large" onClick={onCta} className="w-full">{ctaLabel}</Button>
      </motion.div>
    </div>
  );
}

// ── Several cards, face down then flipped ───────────────────────────────────────

const FlipCard = memo(function FlipCard({ draw, tier, scale, flipped, charging, index, upcoming }: { draw: BannerDraw; tier: GachaTier; scale: number; flipped: boolean; charging: boolean; index: number; /** It is the next to flip: mount the front now so the flip starts with it ready. */ upcoming: boolean }) {
  const { album } = useAlbum();
  const player = albumCard(draw.card.id);
  const level = player ? stickerLevel(album, player.id) : 0;
  const width = 200 * scale;
  const height = 324 * scale;
  if (!player) return null;
  return (
    <div className="flex flex-col items-center" style={{ width }}>
      <div className="relative" style={{ width, height, perspective: 900 }}>
        {flipped && tier.rank >= 2 ? (
          <div className="pointer-events-none absolute inset-0 z-0">
            <Shockwaves tier={tier} scale={0.6} />
            <Particles count={Math.round(tier.particles * 0.35)} color={tier.color} mode="out" seed={index + tier.rank * 7} spread={170} />
          </div>
        ) : null}
        <motion.div
          className="relative size-full"
          style={{ transformStyle: 'preserve-3d', willChange: flipped ? 'auto' : 'transform' }}
          animate={{ rotateY: flipped ? 180 : 0, scale: charging ? 1.07 : 1 }}
          transition={{ rotateY: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }, scale: { duration: 0.4 } }}
        >
          <div className="gacha-back absolute inset-0" data-flipped={flipped} style={{ backfaceVisibility: 'hidden', borderColor: charging ? tier.color : undefined, boxShadow: charging ? `0 0 34px ${tier.color}, 0 0 70px ${withAlpha(tier.color, 0.55)}` : undefined, transition: 'box-shadow .5s, border-color .5s' }}>
            <img src={LOGO_URL} alt="" draggable={false} className="absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-60" />
          </div>
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <div aria-hidden="true" className="absolute -inset-x-[34%] -inset-y-[22%] -z-[1]" style={{ background: `radial-gradient(closest-side, ${withAlpha(tier.color, tier.rank >= 3 ? 0.5 : 0.3)} 0%, ${withAlpha(tier.color, tier.rank >= 3 ? 0.2 : 0.1)} 55%, transparent 100%)`, opacity: flipped ? 1 : 0, transition: 'opacity .5s' }} />
            {flipped || charging || upcoming ? <PlayerCard player={player} lite scale={scale} albumLevel={level > 0 ? level as AlbumLevel : undefined} /> : null}
          </div>
        </motion.div>
        {flipped ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="absolute left-1/2 top-0 z-[5] -translate-x-1/2 -translate-y-1/2">
            <NewTag isNew={draw.card.isNew} />
          </motion.div>
        ) : null}
      </div>
      <div className="mt-2 flex h-9 flex-col items-center text-center" style={{ opacity: flipped ? 1 : 0, transition: 'opacity .4s .3s' }}>
        <span className="w-full truncate text-[12px] font-bold text-white" style={{ ...FONT, maxWidth: Math.max(width, 80) }}>{player.shortName}</span>
        <span className="text-[11px] font-semibold" style={{ color: tier.color, ...FONT }}>{RARITY_LABEL[draw.rarity]}</span>
      </div>
    </div>
  );
});

/** Several cards on a wide screen: dealt face down and flipped in order. On a phone the same grid is only the summary (autoplay off: everything is already face up). */
function GridReveal({ draws, onClose, reduced, autoplay }: { draws: BannerBatchResult; onClose: () => void; reduced: boolean; autoplay: boolean }) {
  const { width, height } = useViewport();
  const cards = draws.cards;
  const order = useMemo(() => flipOrder(cards.map(draw => draw.rarity)), [cards]);
  const [flipped, setFlipped] = useState<ReadonlySet<number>>(() => autoplay ? new Set() : new Set(cards.map((_, index) => index)));
  const [charging, setCharging] = useState<number | null>(null);
  const [step, setStep] = useState(() => autoplay ? 0 : order.length);
  const [burst, setBurst] = useState<{ key: number; tier: GachaTier } | null>(null);
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
      if (tier.rank >= 3) setBurst({ key: step, tier });
      if (tier.rank >= 2) playSound(revealSoundFor(cards[position].rarity));
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
          {cards.map((draw, index) => <FlipCard key={`${draw.card.id}:${index}`} draw={draw} tier={tierOf(draw.rarity)} scale={scale} flipped={flipped.has(index)} charging={charging === index} index={index} upcoming={order[step] === index} />)}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-5 pt-2" style={{ minHeight: 120 }} onClick={event => event.stopPropagation()}>
        {done ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
            <p className="text-[13px] text-white/75" style={FONT}>
              {newCount > 0 ? <><strong className="text-[#7BD88F]">{newCount} {newCount === 1 ? 'nova' : 'novas'}</strong> · {cards.length - newCount} {cards.length - newCount === 1 ? 'repetida' : 'repetidas'}</> : <>{cards.length} repetidas</>}
              {cards.some(draw => draw.pityTriggered) ? <> · <span className="text-[var(--ui-brand-strong)]">garantia ativada</span></> : null}
            </p>
            {draws.pageRewards.length > 0 ? <p className="text-xs text-[var(--ui-success)]" style={FONT}>{draws.pageRewards.length === 1 ? 'Uma página do álbum foi completada: recompensa recebida.' : `${draws.pageRewards.length} páginas do álbum completadas: recompensas recebidas.`}</p> : null}
            <Button intent="primary" size="large" onClick={onClose} className="w-full max-w-xs">CONTINUAR</Button>
          </motion.div>
        ) : (
          <p className="text-center text-[12px] tracking-[0.18em] text-white/45" style={FONT}>TOQUE PARA ACELERAR</p>
        )}
      </div>
      {burst ? <Flash key={burst.key} tier={burst.tier} strength={burst.tier.rank >= 4 ? 0.7 : 0.45} /> : null}
    </div>
  );
}

/**
 * While the circle charges, the cards are drawn once out of sight so their photos, crests and
 * frames are already loaded and decoded when the burst shows them: no pop-in, no hitch.
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
  const [flipped, setFlipped] = useState(false);
  const [charging, setCharging] = useState(false);
  const [burst, setBurst] = useState<{ key: number; tier: GachaTier } | null>(null);
  const flipNow = useRef<(() => void) | null>(null);
  const advanceNow = useRef<(() => void) | null>(null);
  const position = order[Math.min(step, order.length - 1)];
  const draw = cards[position];
  const tier = tierOf(draw.rarity);

  useEffect(() => {
    setFlipped(false);
    setCharging(false);
    let begin: ReturnType<typeof setTimeout> | undefined;
    let suspense: ReturnType<typeof setTimeout> | undefined;
    let hold: ReturnType<typeof setTimeout> | undefined;
    const advance = () => {
      clearTimeout(hold);
      if (step + 1 >= order.length) onDone(); else setStep(current => current + 1);
    };
    const flip = () => {
      clearTimeout(begin); clearTimeout(suspense);
      setCharging(false);
      setFlipped(true);
      if (tier.rank >= 3) setBurst({ key: step, tier });
      if (tier.rank >= 2) playSound(revealSoundFor(draw.rarity));
      advanceNow.current = advance;
      flipNow.current = null;
      hold = setTimeout(advance, reduced ? 700 : tier.rank >= 3 ? 2300 : 1350);
    };
    flipNow.current = flip;
    advanceNow.current = null;
    begin = setTimeout(() => {
      if (tier.suspenseMs > 0 && !reduced) { setCharging(true); suspense = setTimeout(flip, tier.suspenseMs); } else flip();
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
        <Rays tier={tier} />
        <motion.div
          key={step}
          className="relative z-10"
          initial={reduced ? false : { opacity: 0, x: 70, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <FlipCard draw={draw} tier={tier} scale={scale} flipped={flipped} charging={charging} index={step} upcoming />
        </motion.div>
      </div>
      <div className="shrink-0 pb-8 pt-2" onClick={event => event.stopPropagation()}>
        <div className="mb-3 flex justify-center gap-1.5" aria-hidden="true">
          {order.map((_, index) => <span key={index} className="h-1.5 rounded-full transition-all" style={{ width: index === step ? 18 : 6, background: index <= step ? tier.color : 'rgba(255,255,255,.22)' }} />)}
        </div>
        <p className="text-center text-[12px] tracking-[0.18em] text-white/45" style={FONT}>TOQUE PARA CONTINUAR</p>
      </div>
      {burst ? <Flash key={burst.key} tier={burst.tier} strength={burst.tier.rank >= 4 ? 0.7 : 0.45} /> : null}
    </div>
  );
}

// ── The whole sequence ──────────────────────────────────────────────────────────

export default function BannerGachaReveal({ draws, onClose, skipCharge = false }: { draws: BannerBatchResult; onClose: () => void; /** Straight to the burst: the pack's tear was the build-up. */ skipCharge?: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const { leaving, close } = useFadeOut(onClose);
  const best = bestDraw(draws.cards);
  const tier = tierOf((best?.rarity ?? 'bronze') as Rarity);
  const [phase, setPhase] = useState<'charge' | 'reveal'>(skipCharge ? 'reveal' : 'charge');
  const { width } = useViewport();
  const narrow = width < 720;
  const [stackDone, setStackDone] = useState(false);
  const chargeMs = reduced ? 500 : tier.chargeMs;
  // Start the warm-up a moment after the circle appears, so the opening itself stays smooth.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWarm(true), 350);
    return () => clearTimeout(timer);
  }, []);

  // The charge ends by itself; a tap or Esc skips straight to the burst.
  useEffect(() => {
    if (phase !== 'charge') return;
    const timer = setTimeout(() => setPhase('reveal'), chargeMs);
    return () => clearTimeout(timer);
  }, [phase, chargeMs]);
  useEffect(() => {
    if (phase === 'reveal' && best) playSound(revealSoundFor(best.rarity));
  }, [phase, best]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (phase === 'charge') setPhase('reveal'); else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, close]);

  const shakeAtBurst = phase === 'reveal' && tier.shake && !reduced;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Resultado do sorteio" className={`gacha-screen fixed inset-0 z-[90] select-none overflow-hidden text-white ${leaving ? 'gacha-screen--leaving' : ''}`}>
      <Sky tier={tier} shaking={shakeAtBurst}>
        {phase === 'charge' ? (
          <button type="button" aria-label="Pular animação" onClick={() => setPhase('reveal')} className="absolute inset-0 z-10 cursor-pointer outline-none">
            <ChargeStage tier={tier} durationMs={chargeMs} reduced={reduced} />
            <div className="absolute inset-x-0 bottom-[9%] text-center text-[12px] tracking-[0.3em] text-white/50" style={FONT}>TOQUE PARA PULAR</div>
          </button>
        ) : draws.cards.length === 1 && best && albumCard(best.card.id) ? (
          <HeroReveal player={albumCard(best.card.id)!} rarity={best.rarity} isNew={best.card.isNew} pity={best.pityTriggered} pageRewards={draws.pageRewards} ctaLabel="CONTINUAR" onCta={close} />
        ) : narrow && !stackDone ? (
          <StackReveal draws={draws} reduced={reduced} onDone={() => setStackDone(true)} />
        ) : (
          <GridReveal draws={draws} onClose={close} reduced={reduced} autoplay={!narrow} />
        )}
        {phase === 'reveal' ? <Flash tier={tier} /> : null}
        {phase === 'charge' && warm ? <Warmup draws={draws} /> : null}
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
