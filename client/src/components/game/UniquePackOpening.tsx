import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Scissors, X } from 'lucide-react';
import type { Player } from '../../lib/gameData';
import { Button } from '../../design-system';
import PlayerCard from './PlayerCard';

interface UniquePackOpeningProps {
  card: Player;
  onClaim: () => void;
  onClose?: () => void;
}

type OpeningStage = 'sealed' | 'revealed';

const GOLD = '#E8C84A';
const SOFT_GOLD = '#F4D879';
const MUTED = '#9693A5';
const PACK_SIZE = { width: 'min(78vw, 360px)', height: 'min(66vh, 520px)' };
const PACK_BACKGROUND = 'linear-gradient(145deg, #171729 0%, #111221 54%, #0C0F1A 100%)';
const TORN_EDGE = 'polygon(0 0, 100% 0, 100% 91%, 96% 100%, 91% 92%, 86% 100%, 81% 92%, 76% 100%, 71% 92%, 66% 100%, 61% 92%, 56% 100%, 51% 92%, 46% 100%, 41% 92%, 36% 100%, 31% 92%, 26% 100%, 21% 92%, 16% 100%, 11% 92%, 6% 100%, 0 92%)';
const TEAR_PATH = 'M 0.8 30.5 L 2.8 32.2 L 4.8 30.3 L 6.8 32.1 L 8.8 30.4 L 10.8 32.2 L 12.8 30.3 L 14.8 32.1 L 16.8 30.4 L 18.8 32.2 L 20.8 30.3 L 22.8 32.1 L 24.8 30.4 L 26.8 32.2 L 28.8 30.3 L 30.8 32.1 L 32.8 30.4 L 34.8 32.2 L 36.8 30.3 L 38.8 32.1 L 40.8 30.4 L 42.8 32.2 L 44.8 30.3 L 46.8 32.1 L 48.8 30.4 L 50.8 32.2 L 52.8 30.3 L 54.8 32.1 L 56.8 30.4 L 58.8 32.2 L 60.8 30.3 L 62.8 32.1 L 64.8 30.4 L 66.8 32.2 L 68.8 30.3 L 70.8 32.1 L 72.8 30.4 L 74.8 32.2 L 76.8 30.3 L 78.8 32.1 L 80.8 30.4 L 82.8 32.2 L 84.8 30.3 L 86.8 32.1 L 88.8 30.4 L 90.8 32.2 L 92.8 30.3 L 94.8 32.1 L 96.8 30.4 L 99.2 30.5';

function PackBrand({ back = false }: { back?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <img src="/icons/logo_ucl.png" alt="" className="h-[clamp(52px,10vw,82px)] w-[clamp(52px,10vw,82px)] object-contain opacity-90" />
      <div className="mt-5 text-[clamp(34px,7vw,58px)] leading-none tracking-[0.12em]" style={{ color: SOFT_GOLD, fontFamily: 'Bebas Neue, sans-serif' }}>UNIQUE</div>
      <div className="mt-3 h-px w-[clamp(40px,10vw,72px)]" style={{ background: `${GOLD}99` }} />
      <div className="mt-3 text-[clamp(9px,1.5vw,12px)] font-bold tracking-[0.22em]" style={{ color: back ? '#C9C3A4' : MUTED, fontFamily: 'Rajdhani, sans-serif' }}>
        CARTA ESPECIAL
      </div>
    </div>
  );
}

function PackBody({ children }: { children?: ReactNode }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[clamp(18px,3vw,28px)]"
      style={{ background: PACK_BACKGROUND, border: `1px solid ${GOLD}99`, boxShadow: '0 24px 65px rgba(0,0,0,.52)' }}
    >
      <div aria-hidden="true" className="absolute -right-[32%] top-[17%] h-[11%] w-[170%] rotate-[-34deg]" style={{ background: `${GOLD}13`, borderTop: `1px solid ${GOLD}33`, borderBottom: `1px solid ${GOLD}33` }} />
      <div aria-hidden="true" className="absolute inset-[10px] rounded-[clamp(14px,2.4vw,22px)]" style={{ border: `1px solid ${GOLD}26` }} />
      {children}
    </div>
  );
}

function PackFront({ cutProgress, isTearing, onPointerDown, onPointerMove, onPointerUp }: {
  cutProgress: number;
  isTearing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
}) {
  return (
    <div className="relative h-full w-full">
      <motion.div
        className="absolute inset-0 z-[2]"
        animate={isTearing ? { opacity: 0, scale: .985 } : { opacity: 1, scale: 1 }}
        transition={isTearing ? { duration: .84, ease: [0.22, 1, 0.36, 1] } : { duration: .14 }}
      >
        <PackBody>
          <PackBrand />
          <div className="absolute inset-x-[9%] bottom-[7%] flex items-center justify-between text-[clamp(9px,1.5vw,12px)] font-bold tracking-[0.18em]" style={{ color: '#777487', fontFamily: 'Rajdhani, sans-serif' }}>
            <span>UCL IMMORTALS</span>
            <span>01 / 01</span>
          </div>
          <motion.div
            className="absolute inset-x-0 top-0 z-[3] h-[31%] overflow-hidden"
            style={{ clipPath: isTearing ? TORN_EDGE : 'inset(0 0 0 0)', WebkitClipPath: isTearing ? TORN_EDGE : 'inset(0 0 0 0)', background: 'transparent', touchAction: 'pan-y', cursor: isTearing ? 'grabbing' : 'grab', willChange: 'transform', transformPerspective: 900 }}
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
            <div className="absolute inset-x-[9%] top-[17%] flex items-center justify-between text-[clamp(9px,1.5vw,12px)] font-bold tracking-[0.18em]" style={{ color: '#C7B66B', fontFamily: 'Rajdhani, sans-serif' }}>
              <span>UCL</span>
              <span>UNIQUE PACK</span>
            </div>
            <div className="absolute bottom-[13%] left-1/2 flex -translate-x-1/2 items-center gap-2 text-[clamp(9px,1.5vw,12px)] font-bold tracking-[0.15em]" style={{ color: '#A49D7B', fontFamily: 'Rajdhani, sans-serif' }}>
              <Scissors size={15} />
              <span>DESLIZE A ABA</span>
            </div>
          </motion.div>
          {cutProgress > 0 && (
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d={TEAR_PATH} fill="none" stroke="#05070B" strokeWidth="2.2" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - cutProgress / 100} />
              <path d={TEAR_PATH} fill="none" stroke={GOLD} strokeWidth={isTearing ? 1 : .75} strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - cutProgress / 100} style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }} />
            </svg>
          )}
        </PackBody>
      </motion.div>
    </div>
  );
}

export default function UniquePackOpening({ card, onClaim, onClose }: UniquePackOpeningProps) {
  const [stage, setStage] = useState<OpeningStage>('sealed');
  const [cutProgress, setCutProgress] = useState(0);
  const [cutStartX, setCutStartX] = useState<number | null>(null);
  const [isTearing, setIsTearing] = useState(false);
  const tearTimer = useRef<number | null>(null);

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

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stage !== 'sealed') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setCutStartX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stage !== 'sealed' || cutStartX === null) return;
    const distance = Math.max(0, event.clientX - cutStartX);
    const targetDistance = event.currentTarget.getBoundingClientRect().width * .82;
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

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-3 sm:pt-0">
        <AnimatePresence mode="wait" initial={false}>
          {stage === 'sealed' && (
            <motion.section key="sealed" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="flex w-full flex-col items-center">
              <div className="mb-5 text-center sm:mb-7">
                <div className="text-[11px] font-bold tracking-[0.24em]" style={{ color: GOLD, fontFamily: 'Rajdhani, sans-serif' }}>UMA CARTA. UMA ABERTURA.</div>
                <p className="mt-2 text-xs" style={{ color: MUTED, fontFamily: 'Rajdhani, sans-serif' }}>Rasgue a aba superior para começar.</p>
              </div>
              <motion.div
                style={PACK_SIZE}
                animate={isTearing ? { scale: [1, 1.018, .988, 1.006, 1], rotate: [0, -.35, .35, -.18, 0] } : { scale: 1, rotate: 0 }}
                transition={isTearing ? { duration: .64, ease: 'easeOut' } : { duration: .14 }}
              >
                <PackFront cutProgress={cutProgress} isTearing={isTearing} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
              </motion.div>
              <div className="mt-5 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em]" style={{ color: '#777487', fontFamily: 'Rajdhani, sans-serif' }}>
                <ArrowRight size={14} />
                <span>{cutProgress > 0 ? 'CONTINUE DESLIZANDO' : 'DESLIZE DA ESQUERDA PARA A DIREITA'}</span>
              </div>
              <button type="button" onClick={skipCut} className="mt-4 text-[10px] font-bold tracking-[0.14em] transition-colors hover:text-[#E8C84A]" style={{ color: '#656273', fontFamily: 'Rajdhani, sans-serif' }}>
                ABRIR SEM ANIMAÇÃO
              </button>
            </motion.section>
          )}

          {stage === 'revealed' && (
            <motion.section key="revealed" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="flex w-full flex-col items-center">
              <div className="mb-4 text-[11px] font-bold tracking-[0.24em]" style={{ color: GOLD, fontFamily: 'Rajdhani, sans-serif' }}>CARTA ÚNICA REVELADA</div>
              <motion.div initial={{ rotateY: 90, scale: .82, opacity: 0 }} animate={{ rotateY: 0, scale: 1, opacity: 1 }} transition={{ duration: .78, ease: [0.22, 1, 0.36, 1] }} className="mx-auto flex w-fit justify-center" style={{ perspective: 1200 }}>
                <PlayerCard player={card} lite scale={1.18} />
              </motion.div>
              <p className="mx-auto mt-5 max-w-[330px] text-center text-xs leading-relaxed" style={{ color: MUTED, fontFamily: 'Rajdhani, sans-serif' }}>Esta carta foi reservada para o seu time. Adicione-a ao banco para concluir.</p>
              <Button type="button" intent="primary" size="large" onClick={onClaim} className="mx-auto mt-5 flex w-full max-w-[420px] items-center justify-center gap-2" style={{ minHeight: 70, borderRadius: 14, fontSize: 24, boxShadow: '0 16px 36px rgba(232, 200, 74, .2)' }}>
                ADICIONAR AO BANCO <ArrowRight size={17} />
              </Button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
