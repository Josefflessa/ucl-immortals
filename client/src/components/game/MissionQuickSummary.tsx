import { ArrowLeft, ArrowRight, ScrollText } from 'lucide-react';
import { MAX_ACTIVE_MISSIONS } from '@shared/game/missions';
import { useGame } from '../../contexts/GameContext';

export default function MissionQuickSummary({ onOpen, isOpen = false }: { onOpen: () => void; isOpen?: boolean }) {
  const { state } = useGame();
  const activeCount = state.missions.active.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${isOpen ? 'Voltar à competição' : 'Abrir missões'}. ${activeCount} de ${MAX_ACTIVE_MISSIONS} ativas.`}
      className="mb-4 flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:border-[#C9A84C77] sm:px-4 sm:py-2.5"
      style={{ background: 'linear-gradient(100deg, #17172B, #10101A)', borderColor: '#C9A84C44' }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#C9A84C18', color: '#F0C674' }}>
        <ScrollText size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-black tracking-widest" style={{ color: '#F0C674', fontFamily: 'var(--font-game), sans-serif' }}>
        MISSÕES <span style={{ color: '#8E8EA0' }}>·</span> {activeCount}/{MAX_ACTIVE_MISSIONS} ATIVAS
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-black tracking-wide" style={{ color: '#F0C674', fontFamily: 'var(--font-game), sans-serif' }}>
        {isOpen ? <>VOLTAR <ArrowLeft size={15} aria-hidden="true" /></> : <>VER <ArrowRight size={15} aria-hidden="true" /></>}
      </span>
    </button>
  );
}
