// UCL Immortals — account events: the home shortcut and the event card used on
// the events screen (challenges, progress and the frame each event unlocks).

import { useId, useState } from 'react';
import { Check, ChevronDown, Clock, Lock, PartyPopper, Sparkles } from 'lucide-react';
import { AVATAR_FRAME_BY_KEY } from '@shared/game/events';
import { ALL_UNIQUE_CARDS } from '@shared/game/gameData';
import { getCrest } from '@shared/game/crests';
import type { EventChoiceState, EventObjectiveState, GameEventState } from '../../contexts/AccountContext';
import { Button, ConfirmDialog, StatusBanner } from '../../design-system';
import { cn } from '../../lib/utils';
import PlayerCard from '../game/PlayerCard';
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


/** The challenges of an event with their progress. */
function ObjectiveList({ objectives, color }: { objectives: EventObjectiveState[]; color: string }) {
  return (
    <ol className="grid grid-cols-1 gap-2 md:grid-cols-3">
      {objectives.map(objective => {
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
  );
}

const cardById = (id: string) => ALL_UNIQUE_CARDS.find(card => card.id === id) ?? null;
const CHOICE_COLOR = 'var(--ui-brand-strong)';

/** One option of a choice event: the card it unlocks, its club and its challenges. */
function ChoiceOption({ choice, selectable, onPick }: { choice: EventChoiceState; selectable: boolean; onPick?: () => void }) {
  const card = cardById(choice.cardId);
  const crest = getCrest(choice.crestId);
  return (
    <li className="flex flex-col items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3">
      {card ? <PlayerCard player={card} scale={0.62} /> : null}
      <div className="flex items-center gap-2">
        {crest ? <img src={crest.url} alt="" className="size-6 object-contain" /> : null}
        <span className="font-display text-xl leading-none text-[var(--ui-text)]">{choice.label}</span>
      </div>
      <ul className="w-full space-y-1.5 text-xs leading-snug text-[var(--ui-text-muted)]">
        {choice.objectives.map(label => <li key={label} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{label}</span></li>)}
      </ul>
      {selectable ? <Button type="button" intent="primary" onClick={onPick} className="mt-auto w-full">ESCOLHER {choice.label.toUpperCase()}</Button> : null}
    </li>
  );
}

/**
 * A choice event: the account picks one club (for good), then completes that
 * club's challenges to unlock its Carta Única in its own Pacote Único.
 */
export function ChoiceEventCard({ event, onChoose }: { event: GameEventState; onChoose: (choice: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(event.status === 'active' && !event.chosenKey);
  const [confirming, setConfirming] = useState<EventChoiceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const detailsId = useId();
  const choices = event.choices ?? [];
  const chosen = choices.find(choice => choice.key === event.chosenKey) ?? null;
  const chosenCard = chosen ? cardById(chosen.cardId) : null;
  const done = event.objectives.filter(objective => objective.done).length;
  const pick = async (choice: EventChoiceState) => {
    setBusy(true);
    setError('');
    try {
      await onChoose(choice.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a escolha agora.');
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };
  return (
    <article
      className={cn('overflow-hidden rounded-2xl border bg-[var(--ui-surface-inset)]', event.status === 'ended' && !event.cardUnlocked && 'opacity-75')}
      style={{ borderColor: `color-mix(in srgb, ${CHOICE_COLOR} 45%, var(--ui-line-subtle))` }}
      aria-label={`Evento ${event.name}`}
    >
      <div className="flex items-center gap-4 p-4" style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${CHOICE_COLOR} 16%, transparent), transparent 70%)` }}>
        {chosenCard ? (
          <div className="shrink-0"><PlayerCard player={chosenCard} scale={0.42} /></div>
        ) : (
          <div className="grid shrink-0 grid-cols-2 gap-1.5" aria-hidden="true">
            {choices.map(choice => { const crest = getCrest(choice.crestId); return crest ? <img key={choice.key} src={crest.url} alt="" className="size-10 object-contain" /> : null; })}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-none text-[var(--ui-text)] sm:text-3xl">{event.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ui-text-muted)]"><Clock size={12} aria-hidden="true" /> {eventTimeLabel(event)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold" style={{ color: CHOICE_COLOR }}>
            {event.cardUnlocked ? <Check size={13} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
            {chosenCard ? `Recompensa: Carta Única ${chosenCard.shortName}${event.cardUnlocked ? ' · conquistada' : ''}` : 'Recompensa: a Carta Única do clube que você escolher'}
          </p>
          <p className="mt-1 text-xs font-bold tabular-nums text-[var(--ui-text-soft)]">
            {chosen ? `${chosen.label} · ${done}/${event.objectives.length} desafios concluídos` : event.status === 'active' ? 'Escolha o seu clube' : event.status === 'upcoming' ? '4 clubes para escolher' : 'Nenhum clube escolhido'}
          </p>
        </div>
      </div>

      {expanded ? <div id={detailsId} className="space-y-3 border-t border-[var(--ui-line-subtle)] p-4">
        <p className="text-pretty text-sm leading-relaxed text-[var(--ui-text-muted)]">{event.description}</p>
        {error ? <StatusBanner tone="danger" title="Não foi possível escolher">{error}</StatusBanner> : null}
        {event.cardUnlocked && chosenCard ? (
          <StatusBanner tone="success" title={`${chosenCard.shortName} liberado`}>A carta agora pode aparecer no seu Pacote Único, nas suas competições.</StatusBanner>
        ) : null}
        {chosen ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="ui-kicker">Desafios · {chosen.label}</span>
              <span className="text-xs font-bold tabular-nums text-[var(--ui-text-soft)]">{done}/{event.objectives.length}</span>
            </div>
            <ObjectiveList objectives={event.objectives} color={CHOICE_COLOR} />
            {!event.cardUnlocked && event.status !== 'ended' ? (
              <p className="text-xs leading-relaxed text-[var(--ui-text-faint)]">Vale qualquer competição concluída com a conta durante o evento, solo ou online. Nas missões de escudo, escolha o escudo do clube ao montar o time.</p>
            ) : null}
          </>
        ) : (
          <>
            <span className="ui-kicker">{event.status === 'active' ? 'Escolha o seu clube · a escolha é definitiva' : 'Clubes do evento'}</span>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {choices.map(choice => <ChoiceOption key={choice.key} choice={choice} selectable={event.status === 'active'} onPick={() => setConfirming(choice)} />)}
            </ul>
          </>
        )}
      </div> : null}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded(value => !value)}
        className="flex h-10 w-full items-center justify-center gap-1 border-t border-[var(--ui-line-subtle)] text-[12px] font-black tracking-[0.16em] text-[var(--ui-text-muted)] transition-colors hover:text-[var(--ui-text)]"
        style={{ fontFamily: 'var(--font-game), sans-serif' }}
      >
        <span>{expanded ? 'RECOLHER' : 'VER DETALHES'}</span>
        <ChevronDown size={15} aria-hidden="true" className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={open => { if (!open && !busy) setConfirming(null); }}
        title={confirming ? `Escolher ${confirming.label}?` : ''}
        description={confirming ? `Você vai jogar pela Carta Única ${cardById(confirming.cardId)?.shortName ?? ''}. A escolha é definitiva: não dá para trocar de clube neste evento.` : ''}
        confirmLabel="Escolher"
        intent="primary"
        onConfirm={() => { if (confirming) void pick(confirming); }}
      />
    </article>
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
  // Collapsed by default: the header says what the event is; details open on demand.
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const frameKey = event.frameKey ?? '';
  const frame = AVATAR_FRAME_BY_KEY.get(frameKey);
  const color = frame?.color ?? 'var(--ui-brand-strong)';
  const done = event.objectives.filter(objective => objective.done).length;
  const wearing = equippedFrame === frameKey;
  const equip = async () => {
    setBusy(true);
    setError('');
    try {
      await onEquip(frameKey);
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
      <div className="flex items-center gap-4 p-4" style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)` }}>
        <FrameImage frameKey={frameKey} className={cn('size-24 shrink-0 sm:size-28', !event.frameUnlocked && event.status === 'ended' && 'grayscale')} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-none text-[var(--ui-text)] sm:text-3xl">{event.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ui-text-muted)]"><Clock size={12} aria-hidden="true" /> {eventTimeLabel(event)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold" style={{ color }}>
            {event.frameUnlocked ? <Check size={13} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
            Recompensa: moldura {frame?.name ?? ''}{event.frameUnlocked ? ' · conquistada' : ''}
          </p>
          <p className="mt-1 text-xs font-bold tabular-nums text-[var(--ui-text-soft)]">{done}/{event.objectives.length} desafios concluídos</p>
        </div>
      </div>

      {expanded ? <div id={detailsId} className="space-y-3 border-t border-[var(--ui-line-subtle)] p-4">
        <p className="text-pretty text-sm leading-relaxed text-[var(--ui-text-muted)]">{event.description}</p>
        {error ? <StatusBanner tone="danger" title="Não foi possível usar a moldura">{error}</StatusBanner> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="ui-kicker">Desafios</span>
          <span className="text-xs font-bold tabular-nums text-[var(--ui-text-soft)]">{done}/{event.objectives.length}</span>
        </div>
        <ObjectiveList objectives={event.objectives} color={color} />
        {event.frameUnlocked ? (
          <Button type="button" intent="primary" disabled={wearing} loading={busy} onClick={() => void equip()} className="w-full sm:w-auto">
            {wearing ? <><Check size={15} aria-hidden="true" /> USANDO A MOLDURA</> : <><Sparkles size={15} aria-hidden="true" /> USAR A MOLDURA</>}
          </Button>
        ) : event.status !== 'ended' ? (
          <p className="text-xs leading-relaxed text-[var(--ui-text-faint)]">Vale qualquer competição concluída com a conta durante o evento, solo ou online. A moldura fica com você para sempre.</p>
        ) : null}
      </div> : null}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded(value => !value)}
        className="flex h-10 w-full items-center justify-center gap-1 border-t border-[var(--ui-line-subtle)] text-[12px] font-black tracking-[0.16em] text-[var(--ui-text-muted)] transition-colors hover:text-[var(--ui-text)]"
        style={{ fontFamily: 'var(--font-game), sans-serif' }}
      >
        <span>{expanded ? 'RECOLHER' : 'VER DETALHES'}</span>
        <ChevronDown size={15} aria-hidden="true" className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>
    </article>
  );
}
