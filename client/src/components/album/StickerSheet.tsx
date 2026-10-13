// A sticker of the album, up close: its level and the copies towards the next one, and what to do
// with the spare copies (paste one to level up, or sell them for account coins); or, when it is
// missing, where it comes from (packs and envelopes only: a sticker is never bought).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpCircle, Minus, Plus } from 'lucide-react';
import { copiesToNextLevel, LEVEL_COPIES, levelForCopies, MAX_COPIES, SELL_VALUE } from '@shared/game/album';
import { canonicalClubName } from '@shared/game/crests';
import { Button, GameModal } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import type { AlbumLevel } from '../game/AlbumLevelFrame';
import { useAlbum } from '../../contexts/AlbumContext';
import { cn } from '../../lib/utils';
import { albumCard, CATALOG, RARITY_LABEL } from './albumData';
import { CoinAmount, LevelStars } from './AlbumPieces';

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

  return (
    <GameModal
      open={cardId !== null}
      onOpenChange={open => { if (!open) onClose(); }}
      size="wide"
      title={<span className="font-display text-3xl font-normal tracking-wide">{card.shortName}</span>}
      subtitle={`Nº ${sticker.number} · ${page?.title ?? canonicalClubName(card.club)} · ${RARITY_LABEL[card.rarity]}`}
      closeLabel="Fechar carta"
    >
      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <div className={cn('mx-auto pt-4', !owned && 'opacity-45 grayscale')}>
          <PlayerCard player={card} lite scale={0.9} albumLevel={level >= 2 ? level as AlbumLevel : undefined} />
        </div>

        <div className="min-w-0 space-y-5">
          {owned ? (
            <>
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">Nível no álbum</div>
                    <LevelStars level={level} size={18} className="mt-1" />
                  </div>
                  <div className="text-right text-xs text-[var(--ui-text-muted)]">
                    <div><strong className="tabular-nums text-[var(--ui-text)]">{owned.copies}</strong> {owned.copies === 1 ? 'cópia no álbum' : 'cópias no álbum'}</div>
                    <div>{toNext === null ? 'Nível máximo' : <>{toNext === 1 ? 'Falta' : 'Faltam'} <strong className="tabular-nums text-[var(--ui-text)]">{toNext}</strong> {toNext === 1 ? 'cópia' : 'cópias'} no álbum para ★{level + 1}</>}</div>
                  </div>
                </div>
                <div className="mt-3"><LevelTrack copies={owned.copies} /></div>
                <p className="mt-2 text-xs text-[var(--ui-text-faint)]">Cada nível muda a moldura da carta nos seus times. É só visual: não altera a força do jogador.</p>
              </section>

              <section className="rounded-xl border border-[var(--ui-line-subtle)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-[var(--ui-text)]">Cópias repetidas</div>
                  <div className="text-sm font-bold tabular-nums text-[var(--ui-text)]">{spare}</div>
                </div>
                {spare > 0 ? (
                  <div className="mt-3 flex flex-col gap-2.5">
                    {!maxed ? (
                      <Button intent="primary" disabled={busy} onClick={() => run(async () => { await applyCopy(card.id); toast.success('Cópia aplicada ao progresso da carta.'); })} className="w-full">
                        <ArrowUpCircle size={16} aria-hidden="true" /> Aplicar 1 cópia repetida
                      </Button>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-[var(--ui-line-subtle)]">
                        <button type="button" aria-label="Menos" disabled={sellQuantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} className="flex size-9 items-center justify-center text-[var(--ui-text-muted)] disabled:opacity-30"><Minus size={14} /></button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">{sellQuantity}</span>
                        <button type="button" aria-label="Mais" disabled={sellQuantity >= spare} onClick={() => setQuantity(value => Math.min(spare, value + 1))} className="flex size-9 items-center justify-center text-[var(--ui-text-muted)] disabled:opacity-30"><Plus size={14} /></button>
                      </div>
                      <Button intent="secondary" disabled={busy} onClick={() => run(async () => { const earned = await sell(card.id, sellQuantity); setQuantity(1); toast.success(`Vendida${sellQuantity > 1 ? 's' : ''} por ${earned} moedas.`); })} className="min-w-0 flex-1">
                        Vender por <CoinAmount value={SELL_VALUE[card.rarity] * sellQuantity} size={14} className="text-inherit" />
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
                <p className="mt-1 text-xs text-[var(--ui-text-muted)]">{sticker.pageId === null ? 'Esta carta exclusiva pode ser conquistada em eventos ou no banner semanal da Loja.' : `Ela pode sair em qualquer pacote ou envelope${card.rarity === 'bronze' || card.rarity === 'silver' ? '' : ' (as mais raras saem mais nos pacotes de dificuldades maiores)'}.`}</p>
            </section>
          )}
        </div>
      </div>
    </GameModal>
  );
}
