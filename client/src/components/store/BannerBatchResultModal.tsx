import { Check, Copy, Sparkles } from 'lucide-react';
import { getRarityColor } from '@shared/game/gameData';
import { GameModal } from '../../design-system';
import { useAlbum, type BannerBatchResult } from '../../contexts/AlbumContext';
import PlayerCard from '../game/PlayerCard';
import { albumCard, RARITY_LABEL, stickerLevel } from '../album/albumData';

export default function BannerBatchResultModal({ draws, onClose }: { draws: BannerBatchResult | null; onClose: () => void }) {
  const { album } = useAlbum();
  const newCount = draws?.cards.filter(draw => draw.card.isNew).length ?? 0;
  const repeatedCount = (draws?.cards.length ?? 0) - newCount;
  const pityCount = draws?.cards.filter(draw => draw.pityTriggered).length ?? 0;

  return (
    <GameModal
      open={draws !== null}
      onOpenChange={open => { if (!open) onClose(); }}
      size="wide"
      title={draws ? `${draws.cards.length} ${draws.cards.length === 1 ? 'carta recebida' : 'cartas recebidas'}` : 'Resultado do sorteio'}
      subtitle={draws ? `${newCount} novas · ${repeatedCount} repetidas${pityCount ? ` · garantia acionada ${pityCount}×` : ''}` : undefined}
      closeLabel="Fechar resultado dos sorteios"
    >
      {draws ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-2.5"><span className="text-[var(--ui-text-muted)]">Novas</span><strong className="ml-2 tabular-nums text-[var(--ui-success)]">{newCount}</strong></div>
            <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-2.5"><span className="text-[var(--ui-text-muted)]">Repetidas</span><strong className="ml-2 tabular-nums text-[#E9C46A]">{repeatedCount}</strong></div>
            <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-2.5"><span className="text-[var(--ui-text-muted)]">Gasto</span><strong className="ml-2 tabular-nums text-[var(--ui-text)]">{draws.price.toLocaleString('pt-BR')} moedas</strong></div>
          </div>
          <div className="grid grid-cols-2 justify-items-center gap-x-2 gap-y-4 sm:grid-cols-3 md:grid-cols-5" aria-label="Cartas sorteadas">
            {draws.cards.map((draw, index) => {
              const player = albumCard(draw.card.id);
              if (!player) return null;
              const isNew = draw.card.isNew;
              const rarityColor = getRarityColor(draw.rarity);
              return (
                <article key={`${draw.card.id}:${index}`} className="flex min-w-0 flex-col items-center text-center">
                  <div className="relative">
                    <PlayerCard player={player} lite scale={draws.cards.length === 1 ? 0.72 : 0.42} albumLevel={stickerLevel(album, player.id) >= 2 ? stickerLevel(album, player.id) as 2 | 3 | 4 | 5 : undefined} />
                    <span className="absolute left-1/2 top-0 z-[5] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.08em] text-[#0B0C12] shadow-lg" style={{ backgroundColor: isNew ? '#7BD88F' : '#E9C46A' }}>
                      {isNew ? <Sparkles size={10} aria-hidden="true" /> : <Copy size={10} aria-hidden="true" />}{isNew ? 'NOVA' : 'REPETIDA'}
                    </span>
                  </div>
                  <span className="mt-1.5 w-full truncate text-[11px] font-bold text-[var(--ui-text)]">{player.shortName}</span>
                  <span className="mt-0.5 text-[10px] font-semibold" style={{ color: rarityColor }}>{RARITY_LABEL[draw.rarity]}</span>
                  {draw.pityTriggered ? <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[var(--ui-brand-strong)]"><Check size={10} aria-hidden="true" /> Garantida</span> : null}
                </article>
              );
            })}
          </div>
          {draws.pageRewards.length > 0 ? <p className="rounded-lg border border-[var(--ui-success)]/25 bg-[var(--ui-success)]/[.06] px-3 py-2 text-xs text-[var(--ui-success)]">{draws.pageRewards.length} {draws.pageRewards.length === 1 ? 'página do álbum concluída' : 'páginas do álbum concluídas'}.</p> : null}
        </div>
      ) : null}
    </GameModal>
  );
}
