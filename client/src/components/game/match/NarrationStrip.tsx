/** The narration line under the live pitch: the current sentence, or the danger beat with its three steps. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NarrationStripProps {
  minute: number;
  isFinished: boolean;
  userPaused: boolean;
  danger: { forMe: boolean; stage: number; message: string } | null;
  text: string;
  finishedContent: ReactNode;
}

/** A line of open-play narration stays at least this long; the minutes fly by faster than that. */
const HOLD_MS = 1600;

function useHeldText(text: string): string {
  const [held, setHeld] = useState(text);
  const shownAt = useRef(0);
  useEffect(() => {
    if (text === held) return;
    const wait = Math.max(0, shownAt.current + HOLD_MS - performance.now());
    const timer = setTimeout(() => {
      setHeld(text);
      shownAt.current = performance.now();
    }, wait);
    return () => clearTimeout(timer);
  }, [text, held]);
  return held;
}

export default function NarrationStrip({ minute, isFinished, userPaused, danger, text, finishedContent }: NarrationStripProps) {
  const heldText = useHeldText(text);
  const accent = danger ? (danger.forMe ? '#22C55E' : '#EF4444') : '#eab308';
  const label = isFinished ? 'FIM DE JOGO' : userPaused ? 'PAUSADO' : danger ? (danger.forMe ? 'CHANCE DO SEU TIME' : 'PERIGO NO SEU GOL') : 'AO VIVO';
  return (
    <div className="narration-strip p-2 sm:p-3 border-b flex flex-col justify-center flex-shrink-0 transition-colors" style={{ background: danger ? `${accent}14` : 'linear-gradient(90deg, #0e0e1d, #14142b)', borderColor: danger ? `${accent}4d` : '#171725' }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="narration-strip__label text-[12px] font-black tracking-widest uppercase" style={{ fontFamily: 'var(--font-game), sans-serif', color: isFinished ? 'var(--ui-text-soft)' : accent }}>
          {label}
        </span>
        {danger && !isFinished && (
          <span className="flex items-center gap-1" aria-label={`Lance ${danger.stage} de 3`}>
            {[1, 2, 3].map(step => (
              <span key={step} className="h-2 w-2 rounded-full transition-colors" style={{ background: step <= danger.stage ? accent : 'transparent', border: `1px solid ${accent}` }} />
            ))}
          </span>
        )}
      </div>
      {isFinished ? finishedContent : (
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="narration-strip__minute text-sm sm:text-base font-bold text-yellow-500 tabular-nums min-w-[28px]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            {minute}'
          </span>
          <AnimatePresence mode="wait">
            <motion.p
              key={danger ? `d${danger.stage}-${danger.message}` : heldText}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              // In a danger each line is timed to the pitch: a quick swap, not a slow fade.
              exit={{ opacity: 0, x: -20, transition: { duration: danger ? 0.03 : 0.2 } }}
              transition={{ duration: danger ? 0.12 : 0.25 }}
              className="narration-strip__text text-sm sm:text-base font-extrabold text-white leading-tight uppercase break-words"
              style={{ fontFamily: 'var(--font-game), sans-serif' }}
            >
              {danger ? danger.message : heldText}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
