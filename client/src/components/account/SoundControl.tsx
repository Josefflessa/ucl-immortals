import { useState, useSyncExternalStore } from 'react';
import { Music, Volume1, Volume2, VolumeX } from 'lucide-react';
import { Button, GameModal } from '../../design-system';
import { playSound, UI_SOUNDS_ENABLED } from '../../audio/uiSound';
import { soundSettings } from '../../audio/soundSettings';
import { cn } from '../../lib/utils';

/** A labelled switch and volume slider: one row of the sound panel. */
function SoundRow({ id, title, muted, volume, onMuted, onVolume, onVolumeDone }: {
  id: string;
  title: string;
  muted: boolean;
  volume: number;
  onMuted: (muted: boolean) => void;
  onVolume: (volume: number) => void;
  /** Called when the slider is let go (to play a sample at the new level). */
  onVolumeDone?: () => void;
}) {
  const percent = Math.round(volume * 100);
  return (
    <section className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-4" aria-labelledby={`${id}-title`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div id={`${id}-title`} className="text-sm font-bold text-[var(--ui-text)]">{title}</div>
          {muted ? <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">Desligado</div> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!muted}
          aria-label={title}
          onClick={() => onMuted(!muted)}
          className={cn('relative h-7 w-12 shrink-0 rounded-full border transition-colors', muted ? 'border-[var(--ui-line-strong)] bg-[var(--ui-surface-3)]' : 'border-[var(--ui-brand)] bg-[var(--ui-brand)]')}
        >
          <span aria-hidden="true" className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', muted ? 'left-0.5' : 'left-[calc(100%-1.375rem)]')} />
        </button>
      </div>
      <div className={cn('mt-4 transition-opacity', muted && 'opacity-45')}>
        <div className="mb-2 flex items-center justify-between text-xs">
          <label htmlFor={`${id}-volume`} className="font-bold text-[var(--ui-text-muted)]">Volume</label>
          <span className="tabular-nums text-[var(--ui-text-muted)]">{percent}%</span>
        </div>
        <input
          id={`${id}-volume`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          disabled={muted}
          onChange={event => onVolume(Number(event.target.value) / 100)}
          onPointerUp={onVolumeDone}
          onKeyUp={onVolumeDone}
          className="h-2 w-full cursor-pointer accent-[var(--ui-brand)]"
          data-sound="none"
        />
      </div>
    </section>
  );
}

/** The speaker button and its panel: effects and music, each with its own switch and volume. */
export default function SoundControl({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const settings = useSyncExternalStore(soundSettings.subscribe, soundSettings.get, soundSettings.get);
  if (!UI_SOUNDS_ENABLED) return null;
  const silent = settings.muted && settings.musicMuted;
  const Icon = silent ? VolumeX : Math.max(settings.muted ? 0 : settings.volume, settings.musicMuted ? 0 : settings.musicVolume) < 0.5 ? Volume1 : Volume2;

  return (
    <>
      <Button
        type="button"
        intent="ghost"
        aria-label={silent ? 'Som desligado. Abrir configurações de som' : 'Configurações de som'}
        title="Som"
        onClick={() => setOpen(true)}
        className={cn('size-10 min-h-10 w-10 justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)] p-0 sm:size-11 sm:min-h-11 sm:w-11', silent && 'text-[var(--ui-text-faint)]', className)}
      >
        <Icon size={18} aria-hidden="true" />
      </Button>
      <GameModal open={open} onOpenChange={setOpen} title="SOM">
        <div className="space-y-4">
          <SoundRow
            id="sound-effects"
            title="Efeitos sonoros"
            muted={settings.muted}
            volume={settings.volume}
            onMuted={muted => { soundSettings.setMuted(muted); if (!muted) playSound('toggleOn'); }}
            onVolume={soundSettings.setVolume}
            onVolumeDone={() => playSound('coin')}
          />
          <SoundRow
            id="sound-music"
            title="Música"
            muted={settings.musicMuted}
            volume={settings.musicVolume}
            onMuted={soundSettings.setMusicMuted}
            onVolume={soundSettings.setMusicVolume}
          />
          <p className="flex items-center gap-2 text-[12px] text-[var(--ui-text-faint)]"><Music size={13} aria-hidden="true" /> A música só começa depois do seu primeiro toque na tela.</p>
        </div>
      </GameModal>
    </>
  );
}
