import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Scissors, X } from 'lucide-react';
import type { Player } from '@shared/game/gameData';
import { PLAYER_PACK_META, type PlayerPackRarity } from '@shared/game/shop';
import { Button } from '../../design-system';
import PlayerCard from './PlayerCard';

interface PlayerPackOpeningProps {
  card: Player;
  onClaim: () => void;
  onClose?: () => void;
  rarity?: PlayerPackRarity;
}

type OpeningStage = 'sealed' | 'revealed';

const MUTED = '#9693A5';
/** Pack artwork aspect ratio (public/packs, width / height). */
const PACK_ASPECT = 0.527;
const PACK_HEIGHT = 'min(60vh, 540px)';
const PACK_SIZE = { height: PACK_HEIGHT, width: `calc(${PACK_HEIGHT} * ${PACK_ASPECT})` };
/** The flap torn off the top: the crimped strip of the artwork. */
const TEAR_AT = 9;
const TEAR_PATH = 'M 0.8 8.3 L 2.8 9.7 L 4.8 8.3 L 6.8 9.7 L 8.8 8.3 L 10.8 9.7 L 12.8 8.3 L 14.8 9.7 L 16.8 8.3 L 18.8 9.7 L 20.8 8.3 L 22.8 9.7 L 24.8 8.3 L 26.8 9.7 L 28.8 8.3 L 30.8 9.7 L 32.8 8.3 L 34.8 9.7 L 36.8 8.3 L 38.8 9.7 L 40.8 8.3 L 42.8 9.7 L 44.8 8.3 L 46.8 9.7 L 48.8 8.3 L 50.8 9.7 L 52.8 8.3 L 54.8 9.7 L 56.8 8.3 L 58.8 9.7 L 60.8 8.3 L 62.8 9.7 L 64.8 8.3 L 66.8 9.7 L 68.8 8.3 L 70.8 9.7 L 72.8 8.3 L 74.8 9.7 L 76.8 8.3 L 78.8 9.7 L 80.8 8.3 L 82.8 9.7 L 84.8 8.3 L 86.8 9.7 L 88.8 8.3 L 90.8 9.7 L 92.8 8.3 L 94.8 9.7 L 96.8 8.3 L 98.8 9.7';

function PackFront({ rarity, cutProgress, isTearing, onPointerDown, onPointerMove, onPointerUp }: {
  rarity: PlayerPackRarity;
  cutProgress: number;
  isTearing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
}) {
  const accent = PLAYER_PACK_META[rarity].color;
  const src = `/packs/${rarity}.webp`;
  return (
    <div className="relative h-full w-full select-none">
      {/* Glow of the rarity behind the pack. */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-[18%] -z-[1] rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${accent}55 0%, ${accent}1F 38%, transparent 70%)` }} />

      {/* Body: everything below the tear line. */}
      <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-fill" style={{ clipPath: `inset(${TEAR_AT}% 0 0 0)`, filter: 'drop-shadow(0 24px 40px rgba(0,0,0,.55))' }} />

      {/* Light escaping from the opened pack. */}
      <AnimatePresence>
        {isTearing && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[4%] z-[2] origin-top"
            style={{ top: `${TEAR_AT - 2}%`, height: '26%', background: `radial-gradient(ellipse at 50% 0%, #FFFFFF 0%, ${accent} 26%, ${accent}00 70%)`, mixBlendMode: 'screen' }}
            initial={{ opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: [0, 1, 0.85], scaleY: [0.2, 1.25, 1] }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Flap: the crimped top strip, swiped away to open the pack. */}
      <motion.div
        className="absolute inset-0 z-[3]"
        style={{ clipPath: `inset(0 0 ${100 - TEAR_AT}% 0)`, WebkitClipPath: `inset(0 0 ${100 - TEAR_AT}% 0)`, touchAction: 'pan-y', cursor: isTearing ? 'grabbing' : 'grab', willChange: 'transform', transformPerspective: 900 }}
        animate={isTearing
          ? { x: '118%', y: '-16%', rotate: -9, rotateY: -18, skewX: -7, opacity: 0 }
          : { x: 0, y: cutProgress > 0 ? cutProgress * -.02 : 0, rotate: cutProgress > 0 ? cutProgress * 0.008 : 0, rotateY: 0, skewX: 0, opacity: 1 }}
        transition={isTearing ? { duration: .66, ease: [0.22, 1, 0.36, 1] } : { duration: .08 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Deslize a aba superior para rasgar o pacote"
      >
        <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full object-fill" />
      </motion.div>

      {/* Hint right under the flap. */}
      {!isTearing && cutProgress === 0 && (
        <div className="pointer-events-none absolute left-1/2 z-[4] flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.15em] backdrop-blur-sm" style={{ top: `${TEAR_AT + 2.5}%`, color: '#FFF', background: 'rgba(5,7,11,.55)', border: `1px solid ${accent}88`, fontFamily: 'var(--font-game), sans-serif' }}>
          <Scissors size={13} />
          <span>DESLIZE A ABA</span>
        </div>
      )}

      {/* Cut line following the swipe. */}
      {cutProgress > 0 && (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={TEAR_PATH} fill="none" stroke="#05070B" strokeWidth="2.2" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - cutProgress / 100} />
          <path d={TEAR_PATH} fill="none" stroke={accent} strokeWidth={isTearing ? 1 : .75} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - cutProgress / 100} style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
        </svg>
      )}
    </div>
  );
}

export default function UniquePackOpening({ card, onClaim, onClose, rarity = 'unique' }: PlayerPackOpeningProps) {
  const meta = PLAYER_PACK_META[rarity];
  const accent = meta.color;
  const [stage, setStage] = useState<OpeningStage>('sealed');
  const [cutProgress, setCutProgress] = useState(0);
  const [cutStartX, setCutStartX] = useState<number | null>(null);
  const [isTearing, setIsTearing] = useState(false);
  const tearTimer = useRef<number | null>(null);
  const packRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (tearTimer.current !== null) window.clearTimeout(tearTimer.current);
  }, []);

  const finishCut = () => {
    if (isTearing) return;
    setCutProgress(100);
    setCutStartX(null);
    setIsTearing(true);
    tearTimer.current = window.setTimeout(() => {
      setIsTearing(false);
      setStage('revealed');
    }, 900);
  };

  const skipCut = () => {
    if (tearTimer.current !== null) window.clearTimeout(tearTimer.current);
    setCutProgress(100);
    setCutStartX(null);
    setIsTearing(false);
    setStage('revealed');
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (stage !== 'sealed') return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setCutStartX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (stage !== 'sealed' || cutStartX === null) return;
    const distance = Math.max(0, event.clientX - cutStartX);
    const targetDistance = (packRef.current?.getBoundingClientRect().width ?? 260) * .82;
    const progress = Math.min(100, (distance / Math.max(1, targetDistance)) * 100);
    setCutProgress(progress);
    if (progress >= 100) finishCut();
  };

  const handlePointerUp = () => {
    if (stage !== 'sealed') return;
    if (cutProgress >= 96) finishCut();
    else {
      setCutStartX(null);
      setCutProgress(0);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-y-auto" style={{ background: 'radial-gradient(circle at 50% 42%, #181827 0%, #090A12 48%, #05060B 100%)', color: '#FFF' }}>
      <header className="flex shrink-0 items-center justify-end px-5 py-4 sm:px-8 sm:py-6">
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar abertura" className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/[.06]" style={{ color: '#B9B5C4' }}>
            <X size={22} strokeWidth={1.6} />
          </button>
        )}
      </header>

      <main
        className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-3 sm:pt-0"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <AnimatePresence mode="wait" initial={false}>
          {stage === 'sealed' && (
            <motion.section key="sealed" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="flex w-full flex-col items-center">
              <div className="mb-5 text-center sm:mb-7">
                <div className="text-[13px] font-bold tracking-[0.24em]" style={{ color: accent, fontFamily: 'var(--font-game), sans-serif' }}>UMA CARTA. UMA ABERTURA.</div>
                <p className="mt-2 text-xs" style={{ color: MUTED, fontFamily: 'var(--font-game), sans-serif' }}>Rasgue a aba superior para começar.</p>
              </div>
              <motion.div
                ref={packRef}
                style={PACK_SIZE}
                animate={isTearing ? { scale: [1, 1.018, .988, 1.006, 1], rotate: [0, -.35, .35, -.18, 0] } : { scale: 1, rotate: 0 }}
                transition={isTearing ? { duration: .64, ease: 'easeOut' } : { duration: .14 }}
              >
                <PackFront rarity={rarity} cutProgress={cutProgress} isTearing={isTearing} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
              </motion.div>
              <div className="mt-5 flex items-center gap-2 text-[12px] font-bold tracking-[0.16em]" style={{ color: '#777487', fontFamily: 'var(--font-game), sans-serif' }}>
                <ArrowRight size={14} />
                <span>{cutProgress > 0 ? 'CONTINUE DESLIZANDO' : 'DESLIZE DA ESQUERDA PARA A DIREITA'}</span>
              </div>
              <button type="button" onClick={skipCut} className="mt-4 text-[12px] font-bold tracking-[0.14em] transition-colors hover:text-brand-strong" style={{ color: '#656273', fontFamily: 'var(--font-game), sans-serif' }}>
                ABRIR SEM ANIMAÇÃO
              </button>
            </motion.section>
          )}

          {stage === 'revealed' && (
            <motion.section key="revealed" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="flex w-full flex-col items-center">
              <div className="mb-4 text-[13px] font-bold tracking-[0.24em]" style={{ color: accent, fontFamily: 'var(--font-game), sans-serif' }}>CARTA {meta.label} REVELADA</div>
              <motion.div initial={{ rotateY: 90, scale: .82, opacity: 0 }} animate={{ rotateY: 0, scale: 1, opacity: 1 }} transition={{ duration: .78, ease: [0.22, 1, 0.36, 1] }} className="mx-auto flex w-fit justify-center" style={{ perspective: 1200 }}>
                <PlayerCard player={card} lite scale={1.18} />
              </motion.div>
              <p className="mx-auto mt-5 max-w-[330px] text-center text-xs leading-relaxed" style={{ color: MUTED, fontFamily: 'var(--font-game), sans-serif' }}>Esta carta foi reservada para o seu time. Adicione-a ao banco para concluir.</p>
              <Button type="button" intent="primary" size="large" onClick={onClaim} className="mx-auto mt-5 flex w-full max-w-[420px] items-center justify-center gap-2" style={{ minHeight: 70, borderRadius: 14, fontSize: 24, boxShadow: `0 16px 36px ${accent}33` }}>
                ADICIONAR AO BANCO <ArrowRight size={17} />
              </Button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
