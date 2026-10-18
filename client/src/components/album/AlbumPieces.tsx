// Small visual pieces of the album: a pack or envelope, an album slot (the sticker
// or its numbered silhouette), the level stars and the coin amount.
import { Coins, Minus, Plus, Star } from 'lucide-react';
import { parseItemKey, type AlbumItemKey } from '@shared/game/album';
import type { Player } from '@shared/game/gameData';
import PlayerCard from '../game/PlayerCard';
import AlbumPackArt, { ALBUM_ENVELOPE_ASPECT, ALBUM_PACK_ASPECT } from './AlbumPackArt';
import type { AlbumLevel } from '../game/AlbumLevelFrame';
import { cn } from '../../lib/utils';

/** A pack (its artwork) or an envelope (drawn: a sealed envelope in the tier's color). */
export function ItemArt({ itemKey, height = 96, className }: { itemKey: AlbumItemKey; height?: number; className?: string }) {
  const parsed = parseItemKey(itemKey);
  if (!parsed) return null;
  // An envelope is wide: its height is a bit less than a packet's, for the same visual weight.
  const pack = parsed.kind === 'pack';
  const h = pack ? height : Math.round(height * 0.62);
  return (
    <AlbumPackArt
      kind={parsed.kind}
      tier={parsed.tier}
      className={className}
      style={{ height: h, width: Math.round(h * (pack ? ALBUM_PACK_ASPECT : ALBUM_ENVELOPE_ASPECT)), filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.5))' }}
    />
  );
}

export function LevelStars({ level, size = 11, className }: { level: number; size?: number; className?: string }) {
  if (level <= 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-[2px]', className)} aria-label={`Nível ${level} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} strokeWidth={2} aria-hidden="true" className={i < level ? 'fill-[#E9C46A] text-[#E9C46A]' : 'text-white/25'} />
      ))}
    </span>
  );
}

export function CoinAmount({ value, className, size = 15 }: { value: number; className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold tabular-nums text-[#E9C46A]', className)}>
      <Coins size={size} aria-hidden="true" />
      {value.toLocaleString('pt-BR')}
    </span>
  );
}

export function QuantityStepper({ value, onChange, label, min = 1, max = 10, canIncrease = true, disabled = false }: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  canIncrease?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)]" role="group" aria-label={`Quantidade de ${label}`}>
      <button type="button" aria-label={`Diminuir ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="flex size-9 items-center justify-center rounded-l-lg text-[var(--ui-text-muted)] transition-colors hover:bg-white/[.04] disabled:cursor-not-allowed disabled:opacity-30"><Minus size={14} aria-hidden="true" /></button>
      <span aria-live="polite" aria-atomic="true" className="min-w-7 text-center text-sm font-bold tabular-nums text-[var(--ui-text)]">{value}</span>
      <button type="button" aria-label={`Aumentar ${label}`} disabled={disabled || value >= max || !canIncrease} onClick={() => onChange(Math.min(max, value + 1))} className="flex size-9 items-center justify-center rounded-r-lg text-[var(--ui-text-muted)] transition-colors hover:bg-white/[.04] disabled:cursor-not-allowed disabled:opacity-30"><Plus size={14} aria-hidden="true" /></button>
    </div>
  );
}

/** The card size used in the album pages (the full card, scaled). */
export const SLOT_SCALE = { mobile: 0.5, desktop: 0.62 };

/** A slot of an album page: the owned sticker (with its level) or the numbered silhouette. */
export function AlbumSlot({ card, number, owned, level, spare, scale, onClick }: {
  card: Player;
  number: number;
  owned: boolean;
  level: number;
  spare: number;
  scale: number;
  onClick: () => void;
}) {
  const width = 200 * scale;
  const height = 324 * scale;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingTop: Math.round(height * 0.12), contentVisibility: 'auto', containIntrinsicSize: `auto ${Math.round(Math.max(width, 96))}px auto ${Math.round(height * 1.12 + 70)}px` }}
      className="group relative flex min-w-0 flex-col items-center rounded-xl outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--ui-brand-strong)]"
      aria-label={owned ? `${card.shortName}, carta ${number}${level > 0 ? `, nível ${level}` : ', conquistada'}` : `Carta ${number}, ${card.shortName}, faltando`}
    >
      {owned ? (
        <div className="relative">
          <PlayerCard player={card} lite flat scale={scale} albumLevel={level as AlbumLevel} />
          {spare > 0 ? (
            <span className="absolute -right-1 top-1 z-[5] rounded-full border border-black/40 bg-[#E9C46A] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#171208] shadow" aria-label={`${spare} ${spare === 1 ? 'cópia extra desta carta' : 'cópias extras desta carta'}`}>
              +{spare}
            </span>
          ) : null}
        </div>
      ) : (
        // Missing: the card itself, in grey and faded, so you know who to look for (its number below).
        <div className="relative" style={{ width, height }}>
          <div className="pointer-events-none" style={{ filter: 'grayscale(1) brightness(.8) contrast(.92)', opacity: .5 }}>
            <PlayerCard player={card} lite flat scale={scale} />
          </div>
        </div>
      )}
      <div className="mt-1.5 flex w-full min-w-0 flex-col items-center" style={{ maxWidth: Math.max(width, 96) }}>
        <span className={cn('line-clamp-2 w-full text-center text-[12px] font-bold leading-tight [overflow-wrap:anywhere]', owned ? 'text-[var(--ui-text)]' : 'text-[var(--ui-text-faint)]')}>{card.shortName}</span>
        {owned ? level > 0 ? <LevelStars level={level} size={10} className="mt-0.5" /> : <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#55CBA0]">Conquistada</span> : <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ui-text-faint)]">Nº {number}</span>}
      </div>
    </button>
  );
}

