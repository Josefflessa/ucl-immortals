// Album pack category in the account-wide store. Spare stickers add to the account coins;
// stickers themselves are never sold, and only come out of packs and envelopes.
import { useState } from 'react';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { ALBUM_TIER_META, PACK_SIZE, SHOP_PACK_PRICE, TIER_GUARANTEE, TIER_ODDS, type AlbumItemKey, type AlbumPackTier } from '@shared/game/album';
import { getRarityColor, type Rarity } from '@shared/game/gameData';
import { Button, GameModal } from '../../design-system';
import { useAlbum } from '../../contexts/AlbumContext';
import { RARITY_LABEL } from '../album/albumData';
import { CoinAmount, ItemArt, QuantityStepper } from '../album/AlbumPieces';
import AlbumPackOpening from '../album/AlbumPackOpening';

const FOR_SALE = (Object.keys(SHOP_PACK_PRICE) as AlbumPackTier[]);

export default function AlbumPackShop() {
  const { album, buyPack } = useAlbum();
  const [busy, setBusy] = useState<AlbumPackTier | null>(null);
  const [confirming, setConfirming] = useState<AlbumPackTier | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [oddsTier, setOddsTier] = useState<AlbumPackTier | null>(null);
  const [opening, setOpening] = useState<AlbumItemKey[] | null>(null);
  const coins = album?.coins ?? 0;
  const odds = oddsTier ? TIER_ODDS[oddsTier] : null;
  const guarantee = oddsTier ? TIER_GUARANTEE[oddsTier] : null;
  const probabilities = odds
    ? (Object.entries(odds) as [Rarity, number][]).filter(([, chance]) => chance > 0)
    : [];

  const buy = async (tier: AlbumPackTier) => {
    const quantity = purchaseQuantity;
    setBusy(tier);
    try {
      await buyPack(tier, quantity);
      const key: AlbumItemKey = `pack:${tier}`;
      setConfirming(null);
      toast.success(`${quantity} ${quantity === 1 ? 'pacote guardado' : 'pacotes guardados'} no inventário.`, {
        action: { label: quantity === 1 ? 'Abrir agora' : `Abrir todos (${quantity})`, onClick: () => setOpening(Array.from({ length: quantity }, () => key)) },
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível comprar agora.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 lg:grid-cols-3">
        {FOR_SALE.map(tier => {
          const price = SHOP_PACK_PRICE[tier]!;
          const guarantee = TIER_GUARANTEE[tier];
          const tierColor = ALBUM_TIER_META[tier].color;
          return (
            <article key={tier} className="relative flex h-full flex-col overflow-hidden rounded-(--ui-radius-xl) border" style={{ borderColor: `${tierColor}55`, background: `radial-gradient(120% 70% at 50% 0%, ${tierColor}26, transparent 60%), var(--ui-surface-1)` }}>
              <button
                type="button"
                aria-label={`Ver chances por carta do Pacote ${ALBUM_TIER_META[tier].label}`}
                title="Ver chances por carta"
                onClick={() => setOddsTier(tier)}
                className="absolute right-2.5 top-2.5 z-10 inline-flex size-9 items-center justify-center rounded-full border transition hover:bg-white/5"
                style={{ color: tierColor, borderColor: `${tierColor}55`, backgroundColor: 'rgba(8,8,16,0.6)' }}
              >
                <Info size={16} aria-hidden="true" />
              </button>
              {/* The pack is the product: it leads the tile. */}
              <div className="flex justify-center px-4 pb-1 pt-6">
                <ItemArt itemKey={`pack:${tier}`} height={150} />
              </div>
              <div className="flex flex-1 flex-col px-4 pb-4 text-center sm:px-5 sm:pb-5">
                <h3 className="font-display text-title-lg uppercase leading-none tracking-caps text-[var(--ui-text)]">Pacote {ALBUM_TIER_META[tier].label}</h3>
                <p className="mt-1.5 text-body-sm text-[var(--ui-text-muted)]">{PACK_SIZE} cartas</p>
                <p className={guarantee ? 'mt-0.5 text-body-sm text-[var(--ui-success)]' : 'mt-0.5 text-body-sm text-[var(--ui-text-muted)]'}>
                  {guarantee ? `1 ${RARITY_LABEL[guarantee].toLowerCase()} ou melhor garantida` : 'Sem garantia de raridade'}
                </p>
                <div className="mt-auto pt-4">
                  {coins >= price ? (
                    <Button intent="primary" block disabled={busy !== null} onClick={() => { setPurchaseQuantity(1); setConfirming(tier); }}>
                      <span className="flex w-full items-center justify-between gap-3"><span>Comprar</span><CoinAmount value={price} size={14} className="text-inherit" /></span>
                    </Button>
                  ) : (
                    <Button intent="secondary" block disabled className="font-ui normal-case tracking-normal">
                      Faltam {(price - coins).toLocaleString('pt-BR')} moedas
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <GameModal
        open={oddsTier !== null}
        onOpenChange={open => { if (!open) setOddsTier(null); }}
        title={oddsTier ? `Chances do Pacote ${ALBUM_TIER_META[oddsTier].label}` : 'Chances do pacote'}
        subtitle="Probabilidade de raridade para cada carta"
        closeLabel="Fechar chances do pacote"
      >
        {oddsTier ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] px-3 py-2.5">
                <p className="text-micro font-bold uppercase tracking-wide-caps text-[var(--ui-text-muted)]">Conteúdo</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ui-text)]">{PACK_SIZE} cartas</p>
              </div>
              <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] px-3 py-2.5">
                <p className="text-micro font-bold uppercase tracking-wide-caps text-[var(--ui-text-muted)]">Garantia</p>
                <p className="mt-1 text-sm font-semibold leading-snug text-[var(--ui-text)]">
                  {guarantee ? `1 ${RARITY_LABEL[guarantee]} ou melhor` : 'Sem raridade mínima'}
                </p>
              </div>
            </div>

            <section className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-3.5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-micro font-bold uppercase tracking-wide-caps text-[var(--ui-text-soft)]">Chances por carta</h4>
              </div>
              <dl className="space-y-3" aria-label={`Chances por carta do Pacote ${ALBUM_TIER_META[oddsTier].label}`}>
                {probabilities.map(([rarity, chance]) => (
                  <div key={rarity}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <dt className="flex min-w-0 items-center gap-2 font-medium text-[var(--ui-text-soft)]">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getRarityColor(rarity) }} aria-hidden="true" />
                        <span className="truncate">{RARITY_LABEL[rarity]}</span>
                      </dt>
                      <dd className="shrink-0 font-bold tabular-nums text-[var(--ui-text)]">{chance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</dd>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-black/25"
                      role="meter"
                      aria-label={`Chance de ${RARITY_LABEL[rarity]}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={chance}
                    >
                      <div className="h-full rounded-full transition-[width]" style={{ width: `${chance}%`, backgroundColor: getRarityColor(rarity) }} />
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        ) : null}
      </GameModal>
      <GameModal
        open={confirming !== null}
        onOpenChange={open => { if (!open && busy === null) setConfirming(null); }}
        title={confirming ? `Comprar pacote ${ALBUM_TIER_META[confirming].label}` : 'Confirmar compra'}
        closeLabel="Cancelar compra"
        footer={confirming ? (
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-center gap-2">
              <QuantityStepper value={purchaseQuantity} onChange={setPurchaseQuantity} label="pacotes" max={10} canIncrease={coins >= SHOP_PACK_PRICE[confirming]! * (purchaseQuantity + 1)} disabled={busy !== null} />
              <Button intent="primary" className="min-w-0 flex-1 px-2" disabled={busy !== null || coins < SHOP_PACK_PRICE[confirming]! * purchaseQuantity} loading={busy === confirming} onClick={() => void buy(confirming)}>
                <span className="flex w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap">
                  <span className="truncate">Comprar {purchaseQuantity}</span>
                  <CoinAmount value={SHOP_PACK_PRICE[confirming]! * purchaseQuantity} size={13} className="shrink-0 text-inherit" />
                </span>
              </Button>
            </div>
            <Button intent="ghost" disabled={busy !== null} onClick={() => setConfirming(null)} className="w-full">Cancelar</Button>
          </div>
        ) : null}
      >
        {confirming ? (
          <div className="text-center">
            <div className="flex justify-center">
              <ItemArt itemKey={`pack:${confirming}`} height={105} />
            </div>
            <p className="mt-3 text-sm text-[var(--ui-text-soft)]">Escolha a quantidade. Os pacotes ficam no inventário e podem ser abertos juntos depois.</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2.5 text-xs">
              <span className="text-[var(--ui-text-muted)]">Saldo após a compra</span>
              <CoinAmount value={Math.max(0, coins - SHOP_PACK_PRICE[confirming]! * purchaseQuantity)} size={13} />
            </div>
          </div>
        ) : null}
      </GameModal>
      {opening ? <AlbumPackOpening items={opening} onClose={() => setOpening(null)} /> : null}
    </div>
  );
}
