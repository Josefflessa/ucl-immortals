import type { Player } from '@shared/game/gameData';
import { getRarityColor } from '@shared/game/gameData';
import { Clock3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import { RARITY_LABEL } from '../album/albumData';
import { CoinAmount, QuantityStepper } from '../album/AlbumPieces';

interface BannerHeroProps {
  bannerNumber: 1 | 2;
  rotationDate: { date: string; time: string };
  preview: boolean;
  featuredCard?: Player;
  price: number;
  drawCount: number;
  coins: number;
  busy: boolean;
  onDraw: () => void;
  onDrawCountChange: (count: number) => void;
}

export default function BannerHero({ bannerNumber, rotationDate, preview, featuredCard, price, drawCount, coins, busy, onDraw, onDrawCountChange }: BannerHeroProps) {
  const rarity = featuredCard?.rarity ?? 'legendary';
  const rarityColor = getRarityColor(rarity);
  const totalPrice = price * drawCount;
  const shortfall = Math.max(0, totalPrice - coins);

  return (
    <section
      aria-label={`Banner ${bannerNumber}, diário`}
      className="grid min-h-[210px] grid-cols-[minmax(0,1fr)_132px] overflow-hidden rounded-2xl border bg-[var(--ui-surface-1)] sm:grid-cols-[minmax(0,1fr)_160px]"
      style={{ borderColor: `color-mix(in srgb, ${rarityColor} 38%, var(--ui-line-subtle))` }}
    >
      <div className="flex min-w-0 flex-col items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <span className="inline-flex items-center gap-1.5 text-micro font-bold uppercase text-[var(--ui-text-soft)]">
            Banner {bannerNumber} · {bannerNumber === 2 ? 'Únicas exclusivas' : 'Diário'}
          </span>
          <div className="flex min-w-0 items-start gap-2 text-[var(--ui-text-muted)]">
            <Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-micro font-semibold uppercase tracking-wide text-[var(--ui-text-faint)]">
                {preview ? 'Disponível a partir de' : 'Próxima troca'}
              </p>
              <p className="mt-0.5 break-words text-xs font-semibold leading-snug">{rotationDate.date}</p>
              {rotationDate.time ? <p className="mt-0.5 text-micro leading-tight text-[var(--ui-text-faint)]">{rotationDate.time}</p> : null}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase text-[var(--ui-text-faint)]">Prêmio em destaque</p>
          <h2 className="mt-1 line-clamp-2 text-balance font-display text-2xl leading-tight text-[var(--ui-text)] sm:text-3xl">
            {featuredCard?.shortName ?? 'Cartas especiais'}
          </h2>
          <p className="mt-1 text-xs font-semibold" style={{ color: rarityColor }}>
            {featuredCard ? RARITY_LABEL[rarity] : 'Destaques da rotação'}
          </p>
        </div>

        {preview ? (
          <p className="text-xs font-medium text-[var(--ui-text-soft)]">Prévia da próxima rotação</p>
        ) : (
          <div className="w-full">
            <div className="mb-2 flex w-full items-center justify-between gap-2">
              <span className="text-micro font-bold uppercase tracking-wide text-[var(--ui-text-faint)]">Sorteios</span>
              <QuantityStepper value={drawCount} onChange={onDrawCountChange} label="sorteios" max={10} canIncrease={coins >= price * (drawCount + 1)} disabled={busy} />
            </div>
            <Button intent="primary" aria-label={`Sortear ${drawCount} ${drawCount === 1 ? 'carta' : 'cartas'} por ${totalPrice.toLocaleString('pt-BR')} moedas`} disabled={busy || coins < totalPrice} onClick={onDraw} className="w-full px-2">
              <span className="flex w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap">
                <span>Sortear</span>
                <CoinAmount value={totalPrice} size={13} className="shrink-0 text-inherit" />
              </span>
            </Button>
            {shortfall > 0 ? <p className="mt-1.5 text-micro text-[var(--ui-text-muted)]">Faltam {shortfall.toLocaleString('pt-BR')} moedas</p> : null}
          </div>
        )}
      </div>

      <div
        aria-hidden="true"
        className={cn('relative flex items-center justify-center overflow-hidden border-l', preview && 'opacity-75')}
        style={{ borderColor: `color-mix(in srgb, ${rarityColor} 28%, var(--ui-line-subtle))`, backgroundColor: `color-mix(in srgb, ${rarityColor} 9%, var(--ui-surface-2))` }}
      >
        {featuredCard ? (
          <div className="opacity-95">
            <PlayerCard player={featuredCard} lite scale={0.55} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
