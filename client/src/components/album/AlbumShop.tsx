// The album shop: packs for album coins (earned by selling spare stickers). Stickers themselves
// are never sold: they only come out of packs and envelopes.
import { useState } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { ALBUM_TIER_META, PACK_SIZE, SHOP_PACK_PRICE, TIER_GUARANTEE, TIER_ODDS, type AlbumItemKey, type AlbumPackTier } from '@shared/game/album';
import type { Rarity } from '@shared/game/gameData';
import { Button, GameModal } from '../../design-system';
import { useAlbum } from '../../contexts/AlbumContext';
import { RARITY_LABEL } from './albumData';
import { CoinAmount, ItemArt } from './AlbumPieces';
import AlbumPackOpening from './AlbumPackOpening';

const FOR_SALE = (Object.keys(SHOP_PACK_PRICE) as AlbumPackTier[]);

export default function AlbumShop() {
  const { album, buyPack } = useAlbum();
  const [busy, setBusy] = useState<AlbumPackTier | null>(null);
  const [confirming, setConfirming] = useState<AlbumPackTier | null>(null);
  const [opening, setOpening] = useState<AlbumItemKey[] | null>(null);
  const coins = album?.coins ?? 0;

  const buy = async (tier: AlbumPackTier) => {
    setBusy(tier);
    try {
      await buyPack(tier);
      const key: AlbumItemKey = `pack:${tier}`;
      setConfirming(null);
      toast.success(`Pacote ${ALBUM_TIER_META[tier].label} guardado no inventário.`, {
        action: { label: 'Abrir agora', onClick: () => setOpening([key]) },
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível comprar agora.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-[var(--ui-line-subtle)] px-4 py-3 text-xs text-[var(--ui-text-muted)]">
        <Info size={15} className="mt-0.5 shrink-0 text-[var(--ui-brand-strong)]" aria-hidden="true" />
        <p>Ganhe pontos vendendo cartas repetidas e troque por pacotes.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {FOR_SALE.map(tier => {
          const price = SHOP_PACK_PRICE[tier]!;
          const odds = TIER_ODDS[tier];
          const guarantee = TIER_GUARANTEE[tier];
          return (
            <article key={tier} className="flex flex-col items-center rounded-xl border border-[var(--ui-line-subtle)] px-4 pb-4 pt-5" style={{ background: `radial-gradient(circle at 50% 25%, ${ALBUM_TIER_META[tier].color}24, transparent 68%)` }}>
              <ItemArt itemKey={`pack:${tier}`} height={150} />
              <h3 className="mt-3 font-display text-2xl leading-none text-[var(--ui-text)]">Pacote {ALBUM_TIER_META[tier].label}</h3>
              <p className="mt-1 text-xs text-[var(--ui-text-muted)]">{PACK_SIZE} cartas{guarantee ? ` · 1 ${RARITY_LABEL[guarantee]} ou melhor garantida` : ''}</p>
              <dl className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-[var(--ui-text-faint)]" aria-label="Chances por carta">
                {(Object.entries(odds) as [Rarity, number][]).map(([rarity, chance]) => (
                  <div key={rarity} className="flex gap-1"><dt>{RARITY_LABEL[rarity]}</dt><dd className="tabular-nums text-[var(--ui-text-muted)]">{chance.toLocaleString('pt-BR')}%</dd></div>
                ))}
              </dl>
              <Button intent="primary" disabled={busy !== null || coins < price} onClick={() => setConfirming(tier)} className="mt-4 w-full">
                <CoinAmount value={price} size={14} className="text-inherit" />
              </Button>
              {coins < price ? <p className="mt-1.5 text-[11px] text-[var(--ui-text-faint)]">Faltam {price - coins} pontos</p> : null}
            </article>
          );
        })}
      </div>
      <GameModal
        open={confirming !== null}
        onOpenChange={open => { if (!open && busy === null) setConfirming(null); }}
        title={confirming ? `Comprar Pacote ${ALBUM_TIER_META[confirming].label}?` : 'Confirmar compra'}
        closeLabel="Cancelar compra"
        footer={confirming ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button intent="ghost" disabled={busy !== null} onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button intent="primary" className="w-full sm:w-auto" disabled={busy !== null || coins < SHOP_PACK_PRICE[confirming]!} loading={busy === confirming} onClick={() => void buy(confirming)}>
              <span className="whitespace-nowrap">Confirmar compra</span>
              <span className="inline-flex items-center rounded-full bg-black/10 px-2 py-1 text-xs tracking-normal">
                <CoinAmount value={SHOP_PACK_PRICE[confirming]!} size={14} className="text-[var(--ui-brand-ink)]" />
              </span>
            </Button>
          </div>
        ) : null}
      >
        {confirming ? (
          <div className="text-center">
            <div className="flex justify-center">
              <ItemArt itemKey={`pack:${confirming}`} height={105} />
            </div>
            <p className="mt-3 text-sm text-[var(--ui-text-soft)]">
              Comprar o Pacote {ALBUM_TIER_META[confirming].label} por <strong className="text-[var(--ui-text)]"><CoinAmount value={SHOP_PACK_PRICE[confirming]!} size={14} /></strong> pontos?
            </p>
            <p className="mt-2 text-xs text-[var(--ui-text-muted)]">Ele ficará no seu inventário para abrir quando quiser. Saldo depois da compra: <CoinAmount value={Math.max(0, coins - SHOP_PACK_PRICE[confirming]!)} size={13} /> pontos.</p>
          </div>
        ) : null}
      </GameModal>
      {opening ? <AlbumPackOpening items={opening} onClose={() => setOpening(null)} /> : null}
    </div>
  );
}
