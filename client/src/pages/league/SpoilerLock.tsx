import { StatusBanner } from '../../design-system';

// Anti-spoiler placeholder: shown instead of position/standings/stats/bracket while other
// players are still watching their match this round (durations vary, so results must stay hidden).
export default function SpoilerLock({ waiting, label }: { waiting: number; label: string }) {
  return (
    <StatusBanner tone="warning" className="flex-col items-center p-8 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <div className="font-display text-base tracking-widest text-[var(--ui-brand-strong)]">{label}</div>
      <div className="mt-2 text-xs leading-relaxed text-[var(--ui-text-muted)]">
        Liberado quando <b style={{ color: '#FFF' }}>todos saírem da partida</b> desta rodada
        {waiting > 0 ? <> — aguardando <b style={{ color: 'var(--ui-brand-strong)' }}>{waiting}</b> jogador(es).</> : '.'}
      </div>
    </StatusBanner>
  );
}
