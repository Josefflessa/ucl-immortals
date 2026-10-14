// A sticker of the album, up close: its level and the copies towards the next one, and what to do
// with the spare copies (paste one to level up, or sell them for account coins); or, when it is
// missing, where it comes from (packs and envelopes only: a sticker is never bought).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpCircle, Minus, Plus } from 'lucide-react';
import { copiesToNextLevel, LEVEL_COPIES, levelForCopies, MAX_COPIES, SELL_VALUE } from '@shared/game/album';
import { canonicalClubName } from '@shared/game/crests';
import { EVENT_UNIQUE_CARDS, STORE_UNIQUE_CARDS } from '@shared/game/gameData';
import { Button, GameModal } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import type { AlbumLevel } from '../game/AlbumLevelFrame';
import { useAlbum } from '../../contexts/AlbumContext';
import { cn } from '../../lib/utils';
import { albumCard, CATALOG, RARITY_LABEL } from './albumData';
import { CoinAmount, LevelStars } from './AlbumPieces';

const EVENT_UNIQUE_CARD_IDS = new Set(EVENT_UNIQUE_CARDS.map(card => card.id));
const STORE_UNIQUE_CARD_IDS = new Set(STORE_UNIQUE_CARDS.map(card => card.id));

function exclusiveAvailability(cardId: string): string {
  if (EVENT_UNIQUE_CARD_IDS.has(cardId)) return 'Esta carta exclusiva é conquistada em eventos e não sai no banner nem em pacotes.';
  if (STORE_UNIQUE_CARD_IDS.has(cardId)) return 'Esta carta exclusiva pode ser conquistada no banner diário da Loja.';
  return 'Esta carta exclusiva pode ser conquistada em eventos ou no banner diário da Loja.';
}

function LevelTrack({ copies }: { copies: number }) {
  const level = levelForCopies(copies);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Níveis da carta">
      {LEVEL_COPIES.map((needed, i) => {
        const reached = i + 1 <= level;
        return (
          <li key={needed} className={cn('rounded-lg border px-1 py-1.5 text-center', reached ? 'border-[#E9C46A]/60 bg-[#E9C46A]/10' : 'border-[var(--ui-line-subtle)]')}>
            <div className={cn('text-xs font-bold', reached ? 'text-[#E9C46A]' : 'text-[var(--ui-text-muted)]')}>★{i + 1}</div>
            <div className="text-[11px] tabular-nums text-[var(--ui-text-faint)]">{needed} {needed === 1 ? 'cópia' : 'cópias'}</div>
          </li>
        );
      })}
    </ol>
  );
}

export default function StickerSheet({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const { album, applyCopy, sell } = useAlbum();
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => { setQuantity(1); }, [cardId]);

  const card = cardId ? albumCard(cardId) : undefined;
  const sticker = cardId ? CATALOG.stickers.get(cardId) : undefined;
  const owned = cardId ? album?.stickers.get(cardId) : undefined;
  const page = sticker?.pageId ? CATALOG.pageById.get(sticker.pageId) : undefined;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível concluir agora.');
    } finally { setBusy(false); }
  };

  if (!card || !sticker) return null;
  const level = owned ? levelForCopies(owned.copies) : 0;
  const toNext = owned ? copiesToNextLevel(owned.copies) : null;
  const spare = owned?.spare ?? 0;
  const sellQuantity = Math.min(quantity, Math.max(1, spare));
  const maxed = owned ? owned.copies >= MAX_COPIES : false;
  const applyQuantity = owned ? Math.min(sellQuantity, MAX_COPIES - owned.copies) : 0;

  return (
    <GameModal
      open={cardId !== null}
      onOpenChange={open => { if (!open) onClose(); }}
      size="wide"
      title={<span className="font-display text-3xl font-normal tracking-wide">{card.shortName}</span>}
      subtitle={`Nº ${sticker.number} · ${page?.title ?? canonicalClubName(card.club)} · ${RARITY_LABEL[card.rarity]}`}
      closeLabel="Fechar carta"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(150px,220px)_minmax(0,1fr)] sm:items-start sm:gap-5">
        <div className={cn('mx-auto pt-1 sm:pt-0', !owned && 'opacity-45 grayscale')}>
          <PlayerCard player={card} lite scale={0.76} albumLevel={level >= 2 ? level as AlbumLevel : undefined} />
        </div>

        <div className="min-w-0 space-y-3.5">
          {owned ? (
            <>
              <section className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">Nível do álbum</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="shrink-0 rounded-md bg-[#E9C46A]/10 px-2 py-0.5 text-sm font-black tabular-nums text-[#E9C46A]">★{level}</span>
                      <LevelStars level={level} size={15} />
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--ui-text-muted)]">
                    <div><strong className="tabular-nums text-[var(--ui-text)]">{owned.copies}</strong> {owned.copies === 1 ? 'cópia aplicada' : 'cópias aplicadas'}</div>
                    <div className="mt-0.5">{toNext === null ? 'Nível máximo' : <>{toNext === 1 ? 'Falta' : 'Faltam'} <strong className="tabular-nums text-[var(--ui-text)]">{toNext}</strong> para ★{level + 1}</>}</div>
                  </div>
                </div>
                <div className="mt-3"><LevelTrack copies={owned.copies} /></div>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--ui-text-muted)]">Cada estrela dá +1 em todos os atributos nas competições. O nível é fixado quando a competição começa.</p>
              </section>

              <section className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[var(--ui-text)]">Cópias repetidas</div>
                    <div className="mt-0.5 text-[11px] text-[var(--ui-text-muted)]">Aplique para evoluir ou venda por moedas.</div>
                  </div>
                  <div className="rounded-lg bg-[var(--ui-surface-3)] px-2.5 py-1 text-sm font-bold tabular-nums text-[var(--ui-text)]">{spare}</div>
                </div>
                {spare > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {!maxed ? (
                      <Button intent="primary" disabled={busy || applyQuantity < 1} onClick={() => run(async () => { await applyCopy(card.id, applyQuantity); setQuantity(1); toast.success(`${applyQuantity} ${applyQuantity === 1 ? 'cópia aplicada' : 'cópias aplicadas'} ao nível da carta.`); })} className="w-full">
                        <ArrowUpCircle size={16} aria-hidden="true" /> Aplicar {applyQuantity} {applyQuantity === 1 ? 'cópia' : 'cópias'}
                      </Button>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-10 items-center rounded-lg border border-[var(--ui-line-subtle)]">
                        <button type="button" aria-label="Menos" disabled={sellQuantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} className="flex size-9 items-center justify-center text-[var(--ui-text-muted)] disabled:opacity-30"><Minus size={14} /></button>
                        <span aria-live="polite" className="min-w-7 text-center text-sm font-bold tabular-nums">{sellQuantity}</span>
                        <button type="button" aria-label="Mais" disabled={sellQuantity >= spare} onClick={() => setQuantity(value => Math.min(spare, value + 1))} className="flex size-9 items-center justify-center text-[var(--ui-text-muted)] disabled:opacity-30"><Plus size={14} /></button>
                      </div>
                      <Button intent="secondary" disabled={busy} onClick={() => run(async () => { const earned = await sell(card.id, sellQuantity); setQuantity(1); toast.success(`Vendida${sellQuantity > 1 ? 's' : ''} por ${earned} moedas.`); })} className="min-w-0 flex-1 px-2">
                        <span className="flex w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap">
                          <span>Vender {sellQuantity === spare ? 'todas' : sellQuantity}</span>
                          <CoinAmount value={SELL_VALUE[card.rarity] * sellQuantity} size={13} className="shrink-0 text-inherit" />
                        </span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[var(--ui-text-faint)]">As cópias extras que saírem nos pacotes aparecem aqui.</p>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-xl border border-[var(--ui-line-subtle)] p-4">
              <div className="text-sm font-bold text-[var(--ui-text)]">Carta faltando</div>
                <p className="mt-1 text-xs text-[var(--ui-text-muted)]">{sticker.pageId === null ? exclusiveAvailability(card.id) : `Ela pode sair em qualquer pacote ou envelope${card.rarity === 'bronze' || card.rarity === 'silver' ? '' : ' (as mais raras saem mais nos pacotes de dificuldades maiores)'}.`}</p>
            </section>
          )}
        </div>
      </div>
    </GameModal>
  );
}
