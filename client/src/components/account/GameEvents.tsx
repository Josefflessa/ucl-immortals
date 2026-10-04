// UCL Immortals — account events on the home screen: a card with the running
// event and a modal with its challenges and the frame it unlocks.

import { useState } from 'react';
import { Check, Clock, Lock, Sparkles } from 'lucide-react';
import { AVATAR_FRAME_BY_KEY } from '@shared/game/events';
import { getProfileAvatarBackground } from '@shared/profileAppearance';
import { resolveProfileAvatarImage } from '../../lib/profileAvatars';
import type { GameEventState } from '../../contexts/AccountContext';
import { Button, GameModal, StatusBanner } from '../../design-system';
import { cn } from '../../lib/utils';
import { FRAME_SCALE, FrameImage } from './AvatarFrame';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "termina em 12 dias", "termina hoje", "começa em 2 dias". */
export function eventTimeLabel(event: Pick<GameEventState, 'status' | 'startsAt' | 'endsAt'>, now = Date.now()): string {
  if (event.status === 'ended') return 'Evento encerrado';
  const target = event.status === 'upcoming' ? event.startsAt : event.endsAt;
  const days = Math.ceil((target - now) / DAY_MS);
  const verb = event.status === 'upcoming' ? 'Começa' : 'Termina';
  if (days <= 1) {
    const hours = Math.max(1, Math.ceil((target - now) / (60 * 60 * 1000)));
    return hours < 24 ? `${verb} em ${hours} ${hours === 1 ? 'hora' : 'horas'}` : `${verb} amanhã`;
  }
  return `${verb} em ${days} dias`;
}

/** The player's own avatar with the event frame, as a reward preview. */
export function FramePreview({ frameKey, avatarKey, avatarBackgroundKey, avatarUrl, size, locked = false }: {
  frameKey: string;
  avatarKey: string;
  avatarBackgroundKey: string;
  avatarUrl?: string | null;
  size: number;
  locked?: boolean;
}) {
  const image = avatarUrl || resolveProfileAvatarImage(avatarKey);
  const inner = Math.round(size / FRAME_SCALE);
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <span className={cn('overflow-hidden rounded-full', locked && 'grayscale-[0.4]')} style={{ width: inner, height: inner, backgroundColor: getProfileAvatarBackground(avatarBackgroundKey).color }}>
        {image ? <img src={image} alt="" className={cn('size-full', avatarUrl ? 'object-cover' : 'object-contain')} /> : null}
      </span>
      <FrameImage frameKey={frameKey} className="absolute inset-0 size-full" />
    </span>
  );
}

interface AvatarLook {
  avatarKey: string;
  avatarBackgroundKey: string;
  avatarUrl?: string | null;
  avatarFrameKey?: string | null;
}

/** Compact chip at the top of the home screen, mirroring the profile chip on the right. */
export function EventTopChip({ event, look, onOpen }: { event: GameEventState; look: AvatarLook; onOpen: () => void }) {
  const frame = AVATAR_FRAME_BY_KEY.get(event.frameKey);
  const done = event.objectives.filter(objective => objective.done).length;
  const color = frame?.color ?? 'var(--ui-brand-strong)';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Evento ${event.name}: ${event.frameUnlocked ? 'moldura conquistada' : `${done} de ${event.objectives.length} desafios`}`}
      className="relative flex min-h-11 items-center gap-2 rounded-full border bg-[var(--ui-surface)]/90 p-0.5 text-left transition-colors hover:bg-[var(--ui-surface-3)] sm:max-w-[15rem] sm:pr-3.5"
      style={{ borderColor: `color-mix(in srgb, ${color} 60%, var(--ui-line-subtle))`, boxShadow: `0 0 18px color-mix(in srgb, ${color} 22%, transparent)` }}
    >
      <FramePreview frameKey={event.frameKey} avatarKey={look.avatarKey} avatarBackgroundKey={look.avatarBackgroundKey} avatarUrl={look.avatarUrl} size={42} locked={!event.frameUnlocked} />
      {/* Phones: only the frame, with the progress as a badge (the profile chip shares the row). */}
      <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--ui-bg)] px-1 text-[11px] font-black leading-none tabular-nums text-[var(--ui-brand-ink)] sm:hidden" style={{ background: event.frameUnlocked ? '#34d399' : color }}>
        {event.frameUnlocked ? <Check size={10} /> : `${done}/${event.objectives.length}`}
      </span>
      <span className="hidden min-w-0 leading-tight sm:block">
        <span className="block truncate text-[11px] font-black uppercase tracking-[0.14em]" style={{ color }}>Evento</span>
        <span className="flex items-center gap-1 truncate text-xs font-bold text-[var(--ui-text)]">
          {event.frameUnlocked
            ? <><Check size={12} aria-hidden="true" className="shrink-0 text-emerald-400" /> Conquistada</>
            : <><Clock size={11} aria-hidden="true" className="shrink-0 text-[var(--ui-text-muted)]" /> {done}/{event.objectives.length} desafios</>}
        </span>
      </span>
    </button>
  );
}

/** Event details: challenges with progress, the frame reward and a shortcut to wear it. */
export function EventModal({ event, look, open, onOpenChange, onEquip }: {
  event: GameEventState | null;
  look: AvatarLook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEquip: (frameKey: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!event) return null;
  const frame = AVATAR_FRAME_BY_KEY.get(event.frameKey);
  const color = frame?.color ?? 'var(--ui-brand-strong)';
  const wearing = look.avatarFrameKey === event.frameKey;
  const equip = async () => {
    setBusy(true);
    setError('');
    try {
      await onEquip(event.frameKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar a moldura agora.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <GameModal
      open={open}
      onOpenChange={onOpenChange}
      title={event.name.toUpperCase()}
      subtitle={eventTimeLabel(event)}
      closeLabel="Fechar evento"
      footer={event.frameUnlocked ? (
        <Button type="button" intent="primary" disabled={wearing} loading={busy} onClick={() => void equip()} className="w-full sm:w-auto">
          {wearing ? <><Check size={15} aria-hidden="true" /> USANDO A MOLDURA</> : <><Sparkles size={15} aria-hidden="true" /> USAR A MOLDURA</>}
        </Button>
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <FramePreview frameKey={event.frameKey} avatarKey={look.avatarKey} avatarBackgroundKey={look.avatarBackgroundKey} avatarUrl={look.avatarUrl} size={132} locked={!event.frameUnlocked} />
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider" style={{ color }}>
            {event.frameUnlocked ? <Check size={14} aria-hidden="true" /> : <Lock size={13} aria-hidden="true" />}
            Moldura {frame?.name ?? ''} {event.frameUnlocked ? 'conquistada' : ''}
          </span>
          <p className="max-w-[40ch] text-pretty text-sm leading-relaxed text-[var(--ui-text-muted)]">{event.description}</p>
        </div>
        {error ? <StatusBanner tone="danger" title="Não foi possível usar a moldura">{error}</StatusBanner> : null}
        <ol className="space-y-2">
          {event.objectives.map(objective => {
            const ratio = Math.min(1, objective.progress / Math.max(1, objective.target));
            return (
              <li key={objective.id} className="rounded-xl border bg-[var(--ui-surface-inset)] p-3" style={{ borderColor: objective.done ? `color-mix(in srgb, ${color} 50%, var(--ui-line-subtle))` : 'var(--ui-line-subtle)' }}>
                <div className="flex items-start gap-2.5">
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border', objective.done ? 'border-transparent text-[var(--ui-brand-ink)]' : 'border-[var(--ui-line-strong)]')} style={objective.done ? { background: color } : undefined}>
                    {objective.done ? <Check size={12} aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--ui-text)]">{objective.label}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: objective.done ? color : 'var(--ui-text-soft)' }}>{Math.min(objective.progress, objective.target)}/{objective.target}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ui-surface-3)]" role="progressbar" aria-valuemin={0} aria-valuemax={objective.target} aria-valuenow={Math.min(objective.progress, objective.target)}>
                  <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-xs leading-relaxed text-[var(--ui-text-faint)]">Vale qualquer competição concluída com a conta durante o evento, solo ou online. A moldura fica com você para sempre.</p>
      </div>
    </GameModal>
  );
}
