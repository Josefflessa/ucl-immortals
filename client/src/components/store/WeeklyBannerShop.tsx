import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Sparkles } from 'lucide-react';
import { WEEKLY_BANNER_PITY_LIMIT, WEEKLY_BANNER_PRICE, type WeeklyBannerOffer, type WeeklyBannerRotations } from '@shared/game/album';
import { getRarityColor, type Rarity } from '@shared/game/gameData';
import { api, useAccount } from '../../contexts/AccountContext';
import { useAlbum, type BannerBatchResult } from '../../contexts/AlbumContext';
import { Button, GameModal, StatusBanner } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import { albumCard, RARITY_LABEL, stickerLevel } from '../album/albumData';
import { CoinAmount } from '../album/AlbumPieces';
import BannerHero from './BannerHero';
import BannerPityMeter from './BannerPityMeter';
import { formatBannerRotation } from './bannerDates';
import BannerBatchResultModal from './BannerBatchResultModal';

const FILTERS = ['legendary', 'immortal', 'unique'] as const satisfies readonly Rarity[];
const FEATURED_COUNT: Record<(typeof FILTERS)[number], number> = { legendary: 4, immortal: 4, unique: 1 };
const ROTATION_CACHE_TTL_MS = 60_000;
let weeklyRotationCache: { value?: WeeklyBannerRotations; updatedAt: number; request?: Promise<WeeklyBannerRotations> } | undefined;

export function loadWeeklyRotations() {
  if (weeklyRotationCache?.value && Date.now() - weeklyRotationCache.updatedAt < ROTATION_CACHE_TTL_MS) return Promise.resolve(weeklyRotationCache.value);
  if (weeklyRotationCache?.request) return weeklyRotationCache.request;
  const entry = weeklyRotationCache ?? { updatedAt: 0 };
  let request: Promise<WeeklyBannerRotations>;
  request = api<WeeklyBannerRotations>('/api/account/album/weekly-banner').then(value => {
    entry.value = value;
    entry.updatedAt = Date.now();
    return value;
  }).finally(() => {
    if (entry.request === request) entry.request = undefined;
  });
  entry.request = request;
  weeklyRotationCache = entry;
  return request;
}

function BannerCardPlaceholder() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex aspect-[0.72] w-full max-w-[9rem] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] text-[var(--ui-text-faint)]">
        <Sparkles size={20} aria-hidden="true" />
        <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em]">Única</span>
      </div>
      <span className="mt-1.5 text-center text-[10px] text-[var(--ui-text-faint)]">Em breve</span>
    </div>
  );
}

export default function WeeklyBannerShop() {
  const { album, buyWeeklyBannerCards } = useAlbum();
  const { getEvents } = useAccount();
  const [rotations, setRotations] = useState<WeeklyBannerRotations | null>(() => weeklyRotationCache?.value ?? null);
  const [loading, setLoading] = useState(() => !weeklyRotationCache?.value);
  const [error, setError] = useState<string | null>(null);
  const [previewNext, setPreviewNext] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('legendary');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawCount, setDrawCount] = useState(1);
  const [drawn, setDrawn] = useState<BannerBatchResult | null>(null);

  useEffect(() => {
    let active = true;
    const cached = weeklyRotationCache?.value ?? null;
    if (cached) {
      setRotations(cached);
      setLoading(false);
      setError(null);
    }
    if (cached && Date.now() - (weeklyRotationCache?.updatedAt ?? 0) < ROTATION_CACHE_TTL_MS) return () => { active = false; };
    void loadWeeklyRotations().then(result => {
      if (active) { setRotations(result); setError(null); }
    }).catch(cause => {
      if (active && !cached) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os banners.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const currentOffer = rotations?.current ?? null;
  const visibleOffer: WeeklyBannerOffer | null = previewNext ? rotations?.next ?? null : currentOffer;
  const featured = useMemo(() => (visibleOffer?.cards[filter] ?? [])
    .map(id => ({ id, card: albumCard(id) }))
    .filter((item): item is { id: string; card: NonNullable<ReturnType<typeof albumCard>> } => !!item.card), [filter, visibleOffer]);
  const topPrize = useMemo(() => {
    for (const rarity of ['unique', 'immortal', 'legendary'] as const) {
      for (const id of visibleOffer?.cards[rarity] ?? []) {
        const card = albumCard(id);
        if (card) return card;
      }
    }
    return undefined;
  }, [visibleOffer]);
  const price = currentOffer?.price ?? WEEKLY_BANNER_PRICE;
  const coins = album?.coins ?? 0;
  const uniqueLineupReady = (visibleOffer?.cards.unique.length ?? 0) >= FEATURED_COUNT.unique;

  const buy = async () => {
    if (busy || drawn) return;
    setBusy(true);
    try {
      const result = await buyWeeklyBannerCards(drawCount);
      setConfirmOpen(false);
      setDrawn(result);
      if (result.cards.some(draw => draw.rarity === 'unique')) void getEvents().catch(() => undefined);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível concluir a compra.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-72 animate-pulse rounded-2xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)]" aria-label="Carregando banners" />;
  if (error || !rotations || !visibleOffer) return <StatusBanner tone="danger" title="Banner indisponível">{error ?? 'Tente novamente em instantes.'}</StatusBanner>;

  const cardsInFilter = featured.length;
  const placeholders = filter === 'unique' ? Math.max(0, FEATURED_COUNT.unique - cardsInFilter) : 0;
  const featuredGrid = filter === 'legendary' || filter === 'immortal' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1';
  const rotationDate = formatBannerRotation(previewNext ? visibleOffer.dayStart : visibleOffer.endsAt);

  return (
    <div className="space-y-5">
      <BannerHero bannerNumber={2} rotationDate={rotationDate} preview={previewNext} featuredCard={topPrize} price={price} drawCount={drawCount} onDrawCountChange={setDrawCount} coins={coins} busy={busy} onDraw={() => setConfirmOpen(true)} />
      {uniqueLineupReady ? <BannerPityMeter
        misses={album?.bannerPity.weekly ?? 0}
        limit={WEEKLY_BANNER_PITY_LIMIT}
        guarantee="Uma Única exclusiva é garantida até o 40º sorteio."
        missLabel="uma Única exclusiva"
      /> : null}

      <section aria-labelledby="weekly-banner-highlights" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="weekly-banner-highlights" className="text-base font-semibold text-[var(--ui-text)]">Cartas em destaque</h3>
          <div role="group" aria-label="Escolher dia do banner para visualizar" className="inline-flex rounded-xl border border-[var(--ui-line-subtle)] p-1">
            <button type="button" aria-pressed={!previewNext} onClick={() => setPreviewNext(false)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${!previewNext ? 'bg-[var(--ui-surface-2)] text-[var(--ui-text)]' : 'text-[var(--ui-text-muted)]'}`}>Hoje</button>
            <button type="button" aria-pressed={previewNext} onClick={() => setPreviewNext(true)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${previewNext ? 'bg-[var(--ui-surface-2)] text-[var(--ui-text)]' : 'text-[var(--ui-text-muted)]'}`}>Amanhã</button>
          </div>
        </div>

        <div role="group" aria-label="Filtrar cartas em destaque" className="flex border-b border-[var(--ui-line-subtle)]">
          {FILTERS.map(rarity => {
            const active = filter === rarity;
            const title = rarity === 'unique' ? 'Única' : RARITY_LABEL[rarity];
            const count = FEATURED_COUNT[rarity];
            return (
              <button key={rarity} type="button" aria-pressed={active} onClick={() => setFilter(rarity)} className={`relative flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ui-brand)] ${active ? '' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'}`} style={active ? { color: getRarityColor(rarity) } : undefined}>
                <span className="truncate">{title}</span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? '' : 'bg-[var(--ui-surface-2)] text-[var(--ui-text-faint)]'}`} style={active ? { backgroundColor: `${getRarityColor(rarity)}18` } : undefined}>{count}</span>
                {active ? <span aria-hidden="true" className="absolute inset-x-3 bottom-[-1px] h-0.5 rounded-full" style={{ backgroundColor: getRarityColor(rarity) }} /> : null}
              </button>
            );
          })}
        </div>

        <div className={`grid justify-items-center gap-x-3 gap-y-4 pt-1 ${featuredGrid}`}>
          {featured.map(({ id, card }) => (
            <div key={id} className="flex min-w-0 flex-col items-center">
              <PlayerCard player={card} lite scale={0.68} />
              <span className="mt-1.5 max-w-full truncate text-center text-[10px] font-bold" style={{ color: getRarityColor(filter) }}>{card.shortName}</span>
              <span className="mt-1 flex min-h-4 items-center justify-center gap-1 text-[10px] font-semibold text-[var(--ui-success)]">
                {album?.stickers.has(id) ? <><Check size={12} aria-hidden="true" /> <span>Já tem</span></> : null}
              </span>
            </div>
          ))}
          {Array.from({ length: placeholders }, (_, index) => <BannerCardPlaceholder key={`unique-placeholder-${index}`} />)}
        </div>
      </section>

      <section aria-labelledby="weekly-banner-odds" className="border-t border-[var(--ui-line-subtle)] pt-4">
        <h3 id="weekly-banner-odds" className="text-xs font-bold uppercase text-[var(--ui-text-soft)]">Chances por sorteio</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {(['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'] as Rarity[]).map(rarity => {
            const chance = visibleOffer.odds[rarity];
            if (chance <= 0 && !(rarity === 'unique' && !uniqueLineupReady)) return null;
            return (
              <div key={rarity} className="flex min-w-0 items-center justify-between gap-2 text-xs">
                <dt className="truncate" style={{ color: getRarityColor(rarity) }}>{rarity === 'unique' ? 'Única exclusiva' : RARITY_LABEL[rarity]}</dt>
                <dd className="shrink-0 font-semibold tabular-nums text-[var(--ui-text-soft)]">{rarity === 'unique' && !uniqueLineupReady ? 'Em breve' : `${chance}%`}</dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-[10px] text-[var(--ui-text-faint)]">As Únicas exclusivas do banner não saem em pacotes nem envelopes.</p>
      </section>

      <GameModal
        open={confirmOpen}
        onOpenChange={open => { if (!busy) setConfirmOpen(open); }}
        title={`Sortear ${drawCount === 1 ? 'uma carta' : `${drawCount} cartas`}?`}
        subtitle="O resultado vai direto para o Álbum; cada sorteio avança o pity separadamente."
        closeLabel="Fechar confirmação"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button intent="ghost" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button intent="primary" className="w-full sm:w-auto" loading={busy} disabled={coins < price * drawCount} onClick={() => void buy()}><span>Confirmar</span><CoinAmount value={price * drawCount} size={14} className="text-inherit" /></Button></div>}
      >
        <p className="text-center text-sm text-[var(--ui-text-soft)]">{drawCount} {drawCount === 1 ? 'sorteio' : 'sorteios'} de {price.toLocaleString('pt-BR')} moedas cada. Total: <strong className="inline-flex items-center gap-1 text-[var(--ui-text)]"><CoinAmount value={price * drawCount} size={14} /></strong>.</p>
      </GameModal>

      <BannerBatchResultModal draws={drawn} onClose={() => setDrawn(null)} />
    </div>
  );
}
