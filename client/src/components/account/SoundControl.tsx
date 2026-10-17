import { useState, useSyncExternalStore } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { Button, GameModal } from '../../design-system';
import { playSound, UI_SOUNDS_ENABLED } from '../../audio/uiSound';
import { soundSettings } from '../../audio/soundSettings';
import { cn } from '../../lib/utils';

/** The speaker button and its panel: one mute switch and one volume for every game sound. */
export default function SoundControl({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { muted, volume } = useSyncExternalStore(soundSettings.subscribe, soundSettings.get, soundSettings.get);
  const percent = Math.round(volume * 100);
  if (!UI_SOUNDS_ENABLED) return null;
  const Icon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      <Button
        type="button"
        intent="ghost"
        aria-label={muted ? 'Som desligado. Abrir configurações de som' : 'Configurações de som'}
        title="Som"
        onClick={() => setOpen(true)}
        className={cn('size-10 min-h-10 w-10 justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)] p-0 sm:size-11 sm:min-h-11 sm:w-11', muted && 'text-[var(--ui-text-faint)]', className)}
      >
        <Icon size={18} aria-hidden="true" />
      </Button>
      <GameModal open={open} onOpenChange={setOpen} title="SOM" subtitle="Vale para o menu, as cartas, as recompensas e as partidas.">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-4">
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--ui-text)]">Efeitos sonoros</div>
              <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{muted ? 'Desligados' : 'Ligados'}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!muted}
              aria-label="Efeitos sonoros"
              onClick={() => { soundSettings.setMuted(!muted); if (muted) playSound('toggleOn'); }}
              className={cn('relative h-7 w-12 shrink-0 rounded-full border transition-colors', muted ? 'border-[var(--ui-line-strong)] bg-[var(--ui-surface-3)]' : 'border-[var(--ui-brand)] bg-[var(--ui-brand)]')}
            >
              <span aria-hidden="true" className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', muted ? 'left-0.5' : 'left-[calc(100%-1.375rem)]')} />
            </button>
          </div>

          <div className={cn('rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-4 transition-opacity', muted && 'opacity-50')}>
            <div className="mb-3 flex items-center justify-between text-sm">
              <label htmlFor="sound-volume" className="font-bold text-[var(--ui-text)]">Volume</label>
              <span className="tabular-nums text-[var(--ui-text-muted)]">{percent}%</span>
            </div>
            <input
              id="sound-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              disabled={muted}
              onChange={event => soundSettings.setVolume(Number(event.target.value) / 100)}
              // Let go of the slider and hear how loud that is.
              onPointerUp={() => playSound('coin')}
              onKeyUp={() => playSound('coin')}
              className="h-2 w-full cursor-pointer accent-[var(--ui-brand)]"
              data-sound="none"
            />
          </div>
        </div>
      </GameModal>
    </>
  );
}
