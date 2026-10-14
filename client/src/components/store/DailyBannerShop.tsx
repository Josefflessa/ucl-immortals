import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Sparkles } from 'lucide-react';
import { DAILY_BANNER_PRICE, type DailyBannerOffer, type DailyBannerRotations } from '@shared/game/album';
import { getRarityColor, type Rarity } from '@shared/game/gameData';
import { api } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { Button, GameModal, StatusBanner } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import { albumCard, RARITY_LABEL, stickerLevel } from '../album/albumData';
import { CoinAmount } from '../album/AlbumPieces';
import BannerHero from './BannerHero';
import { formatBannerRotation } from './bannerDates';

const FILTERS = ['gold', 'legendary', 'immortal'] as const satisfies readonly Rarity[];
const FEATURED_COUNT: Record<(typeof FILTERS)[number], number> = { gold: 4, legendary: 4, immortal: 1 };
const ODDS_RARITIES: readonly Rarity[] = ['bronze', 'silver', 'gold', 'legendary', 'immortal'];
const ROTATION_CACHE_TTL_MS = 60_000;
let dailyRotationCache: { value?: DailyBannerRotations; updatedAt: number; request?: Promise<DailyBannerRotations> } | undefined;

function loadDailyRotations() {
  if (dailyRotationCache?.value && Date.now() - dailyRotationCache.updatedAt < ROTATION_CACHE_TTL_MS) return Promise.resolve(dailyRotationCache.value);
  if (dailyRotationCache?.request) return dailyRotationCache.request;
  const entry = dailyRotationCache ?? { updatedAt: 0 };
  let request: Promise<DailyBannerRotations>;
  request = api<DailyBannerRotations>('/api/account/album/daily-banner').then(value => {
    entry.value = value;
    entry.updatedAt = Date.now();
    return value;
  }).finally(() => {
    if (entry.request === request) entry.request = undefined;
  });
  entry.request = request;
  dailyRotationCache = entry;
  return request;
}

export default function DailyBannerShop() {
  const { album, buyDailyBannerCard } = useAlbum();
  const [rotations, setRotations] = useState<DailyBannerRotations | null>(() => dailyRotationCache?.value ?? null);
  const [loading, setLoading] = useState(() => !dailyRotationCache?.value);
  const [error, setError] = useState<string | null>(null);
  const [previewTomorrow, setPreviewTomorrow] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('gold');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawn, setDrawn] = useState<{ id: string; isNew: boolean; rarity: Rarity } | null>(null);

  useEffect(() => {
    let active = true;
    const cached = dailyRotationCache?.value ?? null;
    if (cached) {
      setRotations(cached);
      setLoading(false);
      setError(null);
    }
    if (cached && Date.now() - (dailyRotationCache?.updatedAt ?? 0) < ROTATION_CACHE_TTL_MS) return () => { active = false; };
    void loadDailyRotations().then(result => {
      if (active) { setRotations(result); setError(null); }
    }).catch(cause => {
      if (active && !cached) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o banner diário.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const currentOffer: DailyBannerOffer | null = rotations?.current ?? null;
  const visibleOffer: DailyBannerOffer | null = previewTomorrow ? rotations?.next ?? null : currentOffer;
  const featured = useMemo(() => (visibleOffer?.cards[filter] ?? [])
    .map(id => ({ id, card: albumCard(id) }))
    .filter((item): item is { id: string; card: NonNullable<ReturnType<typeof albumCard>> } => !!item.card), [filter, visibleOffer]);
  const topPrize = useMemo(() => {
    for (const rarity of ['immortal', 'legendary', 'gold'] as const) {
      for (const id of visibleOffer?.cards[rarity] ?? []) {
        const card = albumCard(id);
        if (card) return card;
      }
    }
    return undefined;
  }, [visibleOffer]);
  const selectedCard = drawn ? albumCard(drawn.id) : undefined;
  const price = currentOffer?.price ?? DAILY_BANNER_PRICE;
  const coins = album?.coins ?? 0;

  const buy = async () => {
    if (busy || drawn) return;
    setBusy(true);
    try {
      const result = await buyDailyBannerCard();
      setConfirmOpen(false);
      const resultCard = { ...result.card, rarity: result.rarity };
      setDrawn(resultCard);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível concluir a compra.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-72 animate-pulse rounded-2xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)]" aria-label="Carregando banner diário" />;
  if (error || !currentOffer || !visibleOffer) return <StatusBanner tone="danger" title="Banner diário indisponível">{error ?? 'Tente novamente em instantes.'}</StatusBanner>;

  const grid = filter === 'immortal' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4';
  const rotationDate = formatBannerRotation(previewTomorrow ? visibleOffer.dayStart : currentOffer.endsAt);

  return (
    <div className="space-y-5">
      <BannerHero bannerNumber={1} rotationDate={rotationDate} preview={previewTomorrow} featuredCard={topPrize} price={price} coins={coins} busy={busy} onDraw={() => setConfirmOpen(true)} />

      <section aria-labelledby="daily-banner-highlights" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="daily-banner-highlights" className="text-base font-semibold text-[var(--ui-text)]">Cartas em destaque</h3>
          <div role="group" aria-label="Escolher banner diário para visualizar" className="inline-flex rounded-xl border border-[var(--ui-line-subtle)] p-1">
            <button type="button" aria-pressed={!previewTomorrow} onClick={() => setPreviewTomorrow(false)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${!previewTomorrow ? 'bg-[var(--ui-surface-2)] text-[var(--ui-text)]' : 'text-[var(--ui-text-muted)]'}`}>Hoje</button>
            <button type="button" aria-pressed={previewTomorrow} onClick={() => { setConfirmOpen(false); setPreviewTomorrow(true); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${previewTomorrow ? 'bg-[var(--ui-surface-2)] text-[var(--ui-text)]' : 'text-[var(--ui-text-muted)]'}`}>Amanhã</button>
          </div>
        </div>

        <div role="group" aria-label="Filtrar cartas em destaque" className="flex border-b border-[var(--ui-line-subtle)]">
          {FILTERS.map(rarity => {
            const active = filter === rarity;
            return (
              <button key={rarity} type="button" aria-pressed={active} onClick={() => setFilter(rarity)} className={`relative flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ui-brand)] ${active ? '' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'}`} style={active ? { color: getRarityColor(rarity) } : undefined}>
                <span className="truncate">{RARITY_LABEL[rarity]}</span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? '' : 'bg-[var(--ui-surface-2)] text-[var(--ui-text-faint)]'}`} style={active ? { backgroundColor: `${getRarityColor(rarity)}18` } : undefined}>{FEATURED_COUNT[rarity]}</span>
                {active ? <span aria-hidden="true" className="absolute inset-x-3 bottom-[-1px] h-0.5 rounded-full" style={{ backgroundColor: getRarityColor(rarity) }} /> : null}
              </button>
            );
          })}
        </div>

        <div className={`grid justify-items-center gap-x-3 gap-y-4 pt-1 ${grid}`}>
          {featured.map(({ id, card }) => (
            <div key={id} className="flex min-w-0 flex-col items-center">
              <PlayerCard player={card} lite scale={0.68} />
              <span className="mt-1.5 max-w-full truncate text-center text-[10px] font-bold" style={{ color: getRarityColor(filter) }}>{card.shortName}</span>
              <span className="mt-1 flex min-h-4 items-center justify-center gap-1 text-[10px] font-semibold text-[var(--ui-success)]">
                {album?.stickers.has(id) ? <><Check size={12} aria-hidden="true" /> <span>Já tem</span></> : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="daily-banner-odds" className="border-t border-[var(--ui-line-subtle)] pt-4">
        <h3 id="daily-banner-odds" className="text-xs font-bold uppercase text-[var(--ui-text-soft)]">Chances por sorteio</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {ODDS_RARITIES.map(rarity => (
            <div key={rarity} className="flex min-w-0 items-center justify-between gap-2 text-xs">
              <dt className="truncate" style={{ color: getRarityColor(rarity) }}>{RARITY_LABEL[rarity]}</dt>
              <dd className="shrink-0 font-semibold tabular-nums text-[var(--ui-text-soft)]">{visibleOffer.odds[rarity]}%</dd>
            </div>
          ))}
        </dl>
      </section>

      <GameModal
        open={confirmOpen && !previewTomorrow}
        onOpenChange={open => { if (!busy) setConfirmOpen(open); }}
        title="Sortear uma carta?"
        subtitle="O resultado vai direto para o Álbum."
        closeLabel="Fechar confirmação"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button intent="ghost" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button intent="primary" className="w-full sm:w-auto" loading={busy} disabled={coins < price} onClick={() => void buy()}><span>Confirmar</span><CoinAmount value={price} size={14} className="text-inherit" /></Button></div>}
      >
        <p className="text-center text-sm text-[var(--ui-text-soft)]">Uma carta aleatória por <strong className="inline-flex items-center gap-1 text-[var(--ui-text)]"><CoinAmount value={price} size={14} /></strong> moedas.</p>
      </GameModal>

      <GameModal open={drawn !== null} onOpenChange={open => { if (!open) setDrawn(null); }} title={selectedCard?.shortName ?? 'Carta recebida'} subtitle={drawn ? `${RARITY_LABEL[drawn.rarity]} · ${drawn.isNew ? 'nova no Álbum' : 'já estava no Álbum'}` : ''} closeLabel="Fechar resultado">
        {selectedCard && drawn ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              <PlayerCard player={selectedCard} lite scale={0.72} albumLevel={stickerLevel(album, selectedCard.id) >= 2 ? stickerLevel(album, selectedCard.id) as 2 | 3 | 4 | 5 : undefined} />
              <span className="absolute left-1/2 top-0 z-[5] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-[#0B0C12] shadow-lg" style={{ backgroundColor: drawn.isNew ? '#7BD88F' : '#E9C46A' }}>
                {drawn.isNew ? <Sparkles size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
                {drawn.isNew ? 'NOVA' : 'REPETIDA'}
              </span>
            </div>
            <p className={`text-sm font-semibold ${drawn.isNew ? 'text-[var(--ui-success)]' : 'text-[#E9C46A]'}`}>
              Adicionada ao seu Álbum
            </p>
          </div>
        ) : null}
      </GameModal>
    </div>
  );
}
