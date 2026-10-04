// UCL Immortals — account events: the home shortcut and the event card used on
// the events screen (challenges, progress and the frame each event unlocks).

import { useState } from 'react';
import { Check, Clock, Lock, PartyPopper, Sparkles } from 'lucide-react';
import { AVATAR_FRAME_BY_KEY } from '@shared/game/events';
import type { GameEventState } from '../../contexts/AccountContext';
import { Button, StatusBanner } from '../../design-system';
import { cn } from '../../lib/utils';
import { FrameImage } from './AvatarFrame';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Termina em 12 dias", "Começa amanhã", "Evento encerrado". */
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

/** Home shortcut to the events screen; the badge counts running events still open. */
export function EventsHomeButton({ pending, onOpen }: { pending: number; onOpen: () => void }) {
  return (
    <Button
      type="button"
      intent="ghost"
      aria-label={pending > 0 ? `Eventos: ${pending} em andamento` : 'Eventos'}
      title="Eventos"
      onClick={onOpen}
      className="relative size-11 min-h-11 w-11 justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/90 p-0"
    >
      <PartyPopper size={19} aria-hidden="true" />
      {pending > 0 ? (
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--ui-bg)] bg-[var(--ui-brand)] px-1 text-[12px] font-bold leading-none tabular-nums text-[var(--ui-brand-ink)]">
          {pending > 9 ? '9+' : pending}
        </span>
      ) : null}
    </Button>
  );
}


/** One event: its reward, time window, challenges with progress and a shortcut to wear the frame. */
export function EventCard({ event, equippedFrame, onEquip }: {
  event: GameEventState;
  equippedFrame: string | null;
  onEquip: (frameKey: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const frame = AVATAR_FRAME_BY_KEY.get(event.frameKey);
  const color = frame?.color ?? 'var(--ui-brand-strong)';
  const done = event.objectives.filter(objective => objective.done).length;
  const wearing = equippedFrame === event.frameKey;
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
    <article
      className={cn('overflow-hidden rounded-2xl border bg-[var(--ui-surface-inset)]', event.status === 'ended' && !event.frameUnlocked && 'opacity-75')}
      style={{ borderColor: `color-mix(in srgb, ${color} 45%, var(--ui-line-subtle))` }}
      aria-label={`Evento ${event.name}`}
    >
      {/* Header: the reward on the left, what and until when on the right. */}
      <div className="flex items-center gap-4 border-b border-[var(--ui-line-subtle)] p-4" style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)` }}>
        <FrameImage frameKey={event.frameKey} className={cn('size-24 shrink-0 sm:size-28', !event.frameUnlocked && event.status === 'ended' && 'grayscale')} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-none text-[var(--ui-text)] sm:text-3xl">{event.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ui-text-muted)]"><Clock size={12} aria-hidden="true" /> {eventTimeLabel(event)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold" style={{ color }}>
            {event.frameUnlocked ? <Check size={13} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
            Recompensa: moldura {frame?.name ?? ''}{event.frameUnlocked ? ' · conquistada' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-pretty text-sm leading-relaxed text-[var(--ui-text-muted)]">{event.description}</p>
        {error ? <StatusBanner tone="danger" title="Não foi possível usar a moldura">{error}</StatusBanner> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="ui-kicker">Desafios</span>
          <span className="text-xs font-bold tabular-nums text-[var(--ui-text-soft)]">{done}/{event.objectives.length}</span>
        </div>
        <ol className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {event.objectives.map(objective => {
            const ratio = Math.min(1, objective.progress / Math.max(1, objective.target));
            return (
              <li key={objective.id} className="flex flex-col rounded-xl border bg-[var(--ui-surface-1)] p-3" style={{ borderColor: objective.done ? `color-mix(in srgb, ${color} 50%, var(--ui-line-subtle))` : 'var(--ui-line-subtle)' }}>
                <div className="flex items-start gap-2.5">
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border', objective.done ? 'border-transparent text-[var(--ui-brand-ink)]' : 'border-[var(--ui-line-strong)]')} style={objective.done ? { background: color } : undefined}>
                    {objective.done ? <Check size={12} aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--ui-text)]">{objective.label}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: objective.done ? color : 'var(--ui-text-soft)' }}>{Math.min(objective.progress, objective.target)}/{objective.target}</span>
                </div>
                <div className="mt-auto pt-2.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ui-surface-3)]" role="progressbar" aria-valuemin={0} aria-valuemax={objective.target} aria-valuenow={Math.min(objective.progress, objective.target)}>
                    <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {event.frameUnlocked ? (
          <Button type="button" intent="primary" disabled={wearing} loading={busy} onClick={() => void equip()} className="w-full sm:w-auto">
            {wearing ? <><Check size={15} aria-hidden="true" /> USANDO A MOLDURA</> : <><Sparkles size={15} aria-hidden="true" /> USAR A MOLDURA</>}
          </Button>
        ) : event.status !== 'ended' ? (
          <p className="text-xs leading-relaxed text-[var(--ui-text-faint)]">Vale qualquer competição concluída com a conta durante o evento, solo ou online. A moldura fica com você para sempre.</p>
        ) : null}
      </div>
    </article>
  );
}
