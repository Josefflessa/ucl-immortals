// The album itself: its regions, the pages of each region (a club's own page, or the region's
// shared page for its smaller clubs) with their progress, and a page open with its slots.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Gift, Globe, Lock, Search, Sparkles, X } from 'lucide-react';
import { EVENT_UNIQUE_CARDS, STORE_UNIQUE_CARDS, getRarityColor, type Rarity } from '@shared/game/gameData';
import { GAME_EVENTS } from '@shared/game/events';
import { getCrest } from '@shared/game/crests';
import { CLUB_PAGE_RECOMPLETE, regionPageReward, type AlbumItemKey, type AlbumPage, type AlbumRegionId } from '@shared/game/album';
import { Button, EmptyState, Input, Progress } from '../../design-system';
import { ClubCover, ClubFrameRing } from '../account/ClubRewards';
import { useAlbum } from '../../contexts/AlbumContext';
import { useAccount } from '../../contexts/AccountContext';
import PlayerCard from '../game/PlayerCard';
import { cn } from '../../lib/utils';
import { albumCard, CATALOG, pageProgress, RARITY_LABEL, REGIONS, stickerLevel, itemLabel } from './albumData';
import { AlbumSlot, ItemArt } from './AlbumPieces';
import StickerSheet from './StickerSheet';
import SelectMenu from '../account/SelectMenu';

function useSlotScale() {
  const read = () => (typeof window === 'undefined' ? 0.6 : window.innerWidth < 480 ? 0.46 : window.innerWidth < 1024 ? 0.54 : 0.62);
  const [scale, setScale] = useState(read);
  useEffect(() => {
    const update = () => setScale(read());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

/** The flag of a region (flagcdn, as on the cards); a globe for the rest of the world. */
const REGION_FLAG: Partial<Record<AlbumRegionId, string>> = { england: 'gb-eng', spain: 'es', italy: 'it', germany: 'de', france: 'fr', brazil: 'br' };

function RegionFlag({ regionId }: { regionId: AlbumRegionId }) {
  const code = REGION_FLAG[regionId];
  if (!code) return <Globe size={18} className="shrink-0 text-[var(--ui-brand-strong)]" aria-hidden="true" />;
  return <img src={`https://flagcdn.com/${code}.svg`} alt="" referrerPolicy="no-referrer" className="h-[14px] w-[21px] shrink-0 rounded-[2px] object-cover shadow-[0_1px_2px_rgba(0,0,0,.6)]" />;
}

function PageCrest({ page, size = 40 }: { page: AlbumPage; size?: number }) {
  const crest = page.clubId ? getCrest(page.clubId) : null;
  if (crest) return <img src={crest.url} alt="" referrerPolicy="no-referrer" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  // A region's shared page: its flag (a globe for the rest of the world) in a round badge.
  const code = REGION_FLAG[page.regionId];
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2,#151622)]" style={{ width: size, height: size }}>
      {code
        ? <img src={`https://flagcdn.com/${code}.svg`} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        : <Globe size={Math.round(size * 0.55)} className="text-[var(--ui-brand-strong)]" aria-hidden="true" />}
    </span>
  );
}

/** Shows the reward for a first completion or for completing an expanded page again. */
function PageRewardBanner({ page, complete, completionCount, missing }: { page: AlbumPage; complete: boolean; completionCount: number; missing: number }) {
  const returning = completionCount > (complete ? 1 : 0);
  const items = page.kind === 'club'
    ? (returning ? CLUB_PAGE_RECOMPLETE : [])
    : regionPageReward(page.stickers.length, returning);
  const stateLabel = complete
    ? completionCount > 1 ? 'Recompensa da nova conclusão' : 'Recompensa conquistada'
    : returning ? 'Novas cartas na página' : 'Recompensa da página';
  const itemDescription = (key: AlbumItemKey) => itemLabel(key);
  const subtitle = complete
    ? completionCount > 1 ? `${items.map(itemDescription).join(' + ')} adicionado ao inventário.` : page.kind === 'club' ? 'Moldura e fundo de perfil desbloqueados. Use em Conta → Aparência.' : `${items.map(itemDescription).join(' + ')} adicionado ao inventário.`
    : returning ? `Faltam ${missing} ${missing === 1 ? 'carta' : 'cartas'} para completar a página e ganhar ${items.map(itemDescription).join(' + ')}.`
      : `Faltam ${missing} ${missing === 1 ? 'carta' : 'cartas'} para desbloquear ${page.kind === 'club' ? `a moldura e o fundo de perfil do ${page.title}` : items.map(itemDescription).join(' + ')}.`;
  if (page.kind === 'club' && page.clubId) {
    return (
      <ClubCover clubId={page.clubId} className={cn('rounded-xl border border-[var(--ui-line-subtle)]', !complete && !returning && 'grayscale-[.85] opacity-70')}>
        <div aria-hidden="true" className="absolute inset-0 z-0 bg-[linear-gradient(90deg,transparent_12%,rgba(7,9,16,.68)_42%,rgba(7,9,16,.88)_100%)]" />
        <div className="relative z-10 flex min-h-[112px] items-center gap-4 px-5 py-4 sm:min-h-[132px] sm:px-7">
          <span className="relative block size-14 shrink-0 rounded-full bg-[#1A1B29] sm:size-16">
            <ClubFrameRing clubId={page.clubId} className="absolute" style={{ left: '-20%', top: '-20%', width: '140%', height: '140%' }} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E9C46A]">
              {complete ? <Check size={13} aria-hidden="true" /> : returning ? <Gift size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
              {stateLabel}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-white">
              {returning ? <ItemArt itemKey={CLUB_PAGE_RECOMPLETE[0]} height={34} /> : null}
              <span>{returning ? itemDescription(CLUB_PAGE_RECOMPLETE[0]) : `Moldura e fundo de perfil do ${page.title}`}</span>
            </div>
            <div className="mt-0.5 text-xs text-white/80">{subtitle}</div>
          </div>
        </div>
      </ClubCover>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--ui-line-subtle)] px-5 py-4">
      <div className="flex shrink-0 items-end gap-1">{items.map((key, i) => <ItemArt key={`${key}:${i}`} itemKey={key} height={56} />)}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#E9C46A]">
          {complete ? <Check size={13} aria-hidden="true" /> : returning ? <Gift size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
          {stateLabel}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-[var(--ui-text)]">
          <span>{items.map(itemDescription).join(' + ')}</span>
        </div>
        {!complete ? <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{subtitle}</div> : null}
      </div>
    </div>
  );
}

type SlotStatus = 'all' | 'owned' | 'missing' | 'spare';
type AlbumSectionId = AlbumRegionId | 'exclusive';

const RARITY_ORDER: Rarity[] = ['unique', 'immortal', 'legendary', 'gold', 'silver', 'bronze'];

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Slots per page of an album page: whole rows on a phone (3 columns) and on a desktop (6). */
function useSlotsPerPage() {
  const read = () => (typeof window === 'undefined' || window.innerWidth >= 1024 ? 18 : 12);
  const [count, setCount] = useState(read);
  useEffect(() => {
    const update = () => setCount(read());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return count;
}

/** The event that gives each event Única (its own reward, or one of its options). */
const EVENT_OF_CARD = new Map<string, string>();
for (const event of GAME_EVENTS) {
  if (event.rewardCardId) EVENT_OF_CARD.set(event.rewardCardId, event.name);
  for (const choice of event.choices ?? []) EVENT_OF_CARD.set(choice.cardId, event.name);
}
const WEEKLY_BANNER_CARD_IDS = new Set(STORE_UNIQUE_CARDS.map(card => card.id));
const EXCLUSIVE_CARDS = [...EVENT_UNIQUE_CARDS, ...STORE_UNIQUE_CARDS];

function exclusiveCardSource(card: (typeof EXCLUSIVE_CARDS)[number]) {
  return EVENT_OF_CARD.get(card.id) ?? (WEEKLY_BANNER_CARD_IDS.has(card.id) ? 'Banner' : card.club);
}

/** Event and store cards are kept outside the country/club page progress. */
function ExclusiveCardsView({ scale }: { scale: number }) {
  const { eventCards } = useAccount();
  const { album } = useAlbum();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'owned' | 'missing'>('all');
  const [pageNumber, setPageNumber] = useState(1);
  const perPage = useSlotsPerPage();
  const gridTop = useRef<HTMLDivElement | null>(null);
  const owned = useMemo(() => new Set([...eventCards, ...(album ? Array.from(album.stickers.keys()) : [])]), [eventCards, album]);
  const counts = useMemo(() => ({
    all: EXCLUSIVE_CARDS.length,
    owned: EXCLUSIVE_CARDS.filter(card => owned.has(card.id)).length,
    missing: EXCLUSIVE_CARDS.filter(card => !owned.has(card.id)).length,
  }), [owned]);
  const filtered = useMemo(() => {
    const query = normalize(search);
    return EXCLUSIVE_CARDS.filter(card => {
      const has = owned.has(card.id);
      if (status === 'owned' && !has) return false;
      if (status === 'missing' && has) return false;
      if (query && !normalize(`${card.shortName} ${card.fullName ?? ''} ${card.club} ${exclusiveCardSource(card)}`).includes(query)) return false;
      return true;
    });
  }, [owned, search, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(pageNumber, totalPages);
  const visible = filtered.slice((current - 1) * perPage, current * perPage);
  const hasFilters = search.trim() !== '' || status !== 'all';

  useEffect(() => { setPageNumber(1); }, [search, status, perPage]);
  const goTo = (value: number) => {
    setPageNumber(value);
    gridTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const clearFilters = () => { setSearch(''); setStatus('all'); };

  return (
    <section aria-label="Cartas Exclusivas">
      <div ref={gridTop} className="mb-4 flex scroll-mt-4 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative min-w-0 sm:w-64">
          <span className="sr-only">Buscar carta exclusiva</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)]" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, clube ou evento" className="w-full pl-9" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu
            label="Situação das cartas exclusivas"
            value={status}
            onChange={setStatus}
            options={([
              ['all', 'Todas'],
              ['owned', 'Conquistadas'],
              ['missing', 'Faltando'],
            ] as ['all' | 'owned' | 'missing', string][]).map(([value, text]) => ({
              value,
              text: `${text}, ${counts[value]}`,
              dimmed: counts[value] === 0,
              label: <span className="flex min-w-[9.5rem] items-center gap-2 pl-1"><span className="text-[var(--ui-text)]">{text}</span><span className="ml-auto pl-3 text-xs tabular-nums text-[var(--ui-text-muted)]">{counts[value]}</span></span>,
            }))}
          />
          {hasFilters ? <Button intent="ghost" onClick={clearFilters} className="min-h-9 px-2.5 text-xs"><X size={14} aria-hidden="true" /> Limpar</Button> : null}
        </div>
      </div>

      {visible.length === 0 ? <EmptyState className="mt-6" title="Nenhuma carta encontrada" description="Tente outro nome ou remova algum filtro." action={<Button intent="secondary" onClick={clearFilters}>Limpar filtros</Button>} /> : null}

      {visible.length > 0 ? (
        <div className="mt-5 grid justify-items-center gap-x-3 gap-y-5 sm:gap-x-5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(200 * scale * 1.2)}px, 1fr))` }}>
          {visible.map(card => {
            const has = owned.has(card.id);
            return (
              <article key={card.id} className="flex min-w-0 flex-col items-center" style={{ paddingTop: Math.round(324 * scale * 0.12) }}>
                <button type="button" onClick={() => setSelected(card.id)} aria-label={`${card.shortName}, ${has ? 'ver carta e cópias' : 'ver carta exclusiva'}`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)]">
                  <span className={cn('block', !has && 'opacity-50 grayscale')}>
                    <PlayerCard player={card} lite scale={scale} albumLevel={stickerLevel(album, card.id) >= 2 ? stickerLevel(album, card.id) as 2 | 3 | 4 | 5 : undefined} />
                  </span>
                </button>
                <span className={cn('mt-1.5 line-clamp-2 text-center text-[12px] font-bold leading-tight', has ? 'text-[var(--ui-text)]' : 'text-[var(--ui-text-faint)]')} style={{ maxWidth: Math.max(200 * scale, 96) }}>{card.shortName}</span>
                <span className="mt-0.5 text-center text-[11px] text-[var(--ui-text-muted)]" style={{ maxWidth: Math.max(200 * scale, 96) }}>{exclusiveCardSource(card)}</span>
                <span className={cn('mt-1 text-center text-[11px] font-semibold', has ? 'text-[#55CBA0]' : 'text-[var(--ui-text-faint)]')}>{has ? `No álbum · ★${stickerLevel(album, card.id) || 1}${(album?.stickers.get(card.id)?.spare ?? 0) > 0 ? ` · ${album!.stickers.get(card.id)!.spare} repetida${album!.stickers.get(card.id)!.spare === 1 ? '' : 's'}` : ''}` : 'Ainda não conquistada'}</span>
              </article>
            );
          })}
        </div>
      ) : null}

      {totalPages > 1 ? (
        <nav aria-label="Paginação das cartas exclusivas" className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-4 sm:flex-row">
          <span className="text-xs text-[var(--ui-text-muted)]">Página <strong className="tabular-nums text-[var(--ui-text)]">{current}</strong> de <strong className="tabular-nums text-[var(--ui-text)]">{totalPages}</strong><span className="text-[var(--ui-text-faint)]"> · {filtered.length} cartas</span></span>
          <div className="flex items-center gap-2">
            <Button intent="secondary" onClick={() => goTo(current - 1)} disabled={current === 1} className="min-h-9 px-3 text-xs"><ChevronLeft size={15} aria-hidden="true" /> Anterior</Button>
            <Button intent="secondary" onClick={() => goTo(current + 1)} disabled={current === totalPages} className="min-h-9 px-3 text-xs">Próxima <ChevronRight size={15} aria-hidden="true" /></Button>
          </div>
        </nav>
      ) : null}
      <StickerSheet cardId={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function PageView({ page, onBack }: { page: AlbumPage; onBack: () => void }) {
  const { album } = useAlbum();
  const scale = useSlotScale();
  const perPage = useSlotsPerPage();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SlotStatus>('all');
  const [rarity, setRarity] = useState<'all' | Rarity>('all');
  const [pageNumber, setPageNumber] = useState(1);
  const gridTop = useRef<HTMLDivElement | null>(null);
  const progress = pageProgress(page, album);

  const counts = useMemo(() => {
    let owned = 0;
    let spare = 0;
    for (const id of page.stickers) {
      const sticker = album?.stickers.get(id);
      if (sticker) owned++;
      if (sticker && sticker.spare > 0) spare++;
    }
    return { all: page.stickers.length, owned, missing: page.stickers.length - owned, spare };
  }, [page, album]);
  const rarities = useMemo(() => RARITY_ORDER.filter(value => page.stickers.some(id => CATALOG.stickers.get(id)?.rarity === value)), [page]);

  // The filters apply to the whole page; then it is split into pages of results.
  const filtered = useMemo(() => {
    const query = normalize(search);
    return page.stickers.filter(id => {
      const card = albumCard(id);
      if (!card) return false;
      const sticker = album?.stickers.get(id);
      if (status === 'owned' && !sticker) return false;
      if (status === 'missing' && sticker) return false;
      if (status === 'spare' && !(sticker && sticker.spare > 0)) return false;
      if (rarity !== 'all' && card.rarity !== rarity) return false;
      if (query && !normalize(`${card.shortName} ${card.fullName ?? ''} ${CATALOG.stickers.get(id)?.number ?? ''}`).includes(query)) return false;
      return true;
    });
  }, [page, album, search, status, rarity]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(pageNumber, totalPages);
  const visible = useMemo(() => filtered.slice((current - 1) * perPage, current * perPage), [filtered, current, perPage]);
  const hasFilters = search.trim() !== '' || status !== 'all' || rarity !== 'all';

  useEffect(() => { setPageNumber(1); }, [search, status, rarity, perPage]);
  const goTo = (value: number) => {
    setPageNumber(value);
    gridTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const clearFilters = () => { setSearch(''); setStatus('all'); setRarity('all'); };

  // A shared page shows its clubs as sections (of the slots shown).
  const sections = useMemo(() => {
    if (page.kind === 'club') return [{ clubId: page.clubId, title: null as string | null, ids: visible }];
    const list: { clubId: string | null; title: string | null; ids: string[] }[] = [];
    for (const id of visible) {
      const clubId = CATALOG.stickers.get(id)?.clubId ?? null;
      const last = list[list.length - 1];
      if (last && last.clubId === clubId) last.ids.push(id);
      else list.push({ clubId, title: (clubId && getCrest(clubId)?.name) || albumCard(id)?.club || null, ids: [id] });
    }
    return list;
  }, [page, visible]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button intent="ghost" onClick={onBack} className="min-h-9 shrink-0 px-2.5 text-xs" aria-label="Voltar às páginas">
          <ArrowLeft size={16} aria-hidden="true" /> <span className="hidden sm:inline">Páginas</span>
        </Button>
        <PageCrest page={page} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[clamp(22px,6.4vw,30px)] leading-[1.02] text-[var(--ui-text)] [overflow-wrap:anywhere]">{page.title}</h2>
          <div className="mt-1.5 flex items-center gap-3">
            <Progress value={progress.owned} max={progress.total} tone={progress.complete ? 'success' : 'brand'} className="h-1.5 max-w-[220px] flex-1" />
            <span className="text-xs font-bold tabular-nums text-[var(--ui-text-muted)]">{progress.owned}/{progress.total}</span>
          </div>
        </div>
      </div>

      <PageRewardBanner page={page} complete={progress.complete} completionCount={album?.pageCompletionCounts[page.id] ?? 0} missing={counts.missing} />

      {/* Filters: by name or number, by whether it is in the album, by rarity. */}
      <div ref={gridTop} className="mt-5 flex scroll-mt-4 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative min-w-0 sm:w-64">
          <span className="sr-only">Buscar carta</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)]" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou número" className="w-full pl-9" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu
            label="Situação das cartas"
            value={status}
            onChange={setStatus}
            options={([
              ['all', 'Todas'],
              ['owned', 'No álbum'],
              ['missing', 'Faltando'],
              ['spare', 'Com cópias extras'],
            ] as [SlotStatus, string][]).map(([value, text]) => ({
              value,
              text: `${text}, ${counts[value]}`,
              dimmed: counts[value] === 0,
              label: <span className="flex min-w-[9.5rem] items-center gap-2 pl-1"><span className="text-[var(--ui-text)]">{text}</span><span className="ml-auto pl-3 text-xs tabular-nums text-[var(--ui-text-muted)]">{counts[value]}</span></span>,
            }))}
          />
          {rarities.length > 1 ? (
            <SelectMenu
              label="Raridade"
              value={rarity}
              onChange={value => setRarity(value as 'all' | Rarity)}
              options={[
                { value: 'all', text: 'Todas as raridades', label: <span className="pl-1 text-[var(--ui-text)]">Todas as raridades</span> },
                ...rarities.map(value => ({ value, text: RARITY_LABEL[value], color: getRarityColor(value), label: <span className="pl-1">{RARITY_LABEL[value]}</span> })),
              ]}
            />
          ) : null}
          {hasFilters ? (
            <Button intent="ghost" onClick={clearFilters} className="min-h-9 px-2.5 text-xs">
              <X size={14} aria-hidden="true" /> Limpar
            </Button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Nenhuma carta encontrada"
          description="Tente outro nome ou remova algum filtro."
          action={<Button intent="secondary" onClick={clearFilters}>Limpar filtros</Button>}
        />
      ) : null}

      {sections.map(section => (
        <section key={`${section.clubId}-${section.ids[0]}`} className="mt-6">
          {section.title ? (
            <div className="mb-1 flex items-center gap-2 border-b border-[var(--ui-line-subtle)] pb-2">
              {section.clubId && getCrest(section.clubId) ? <img src={getCrest(section.clubId)!.url} alt="" referrerPolicy="no-referrer" className="size-5 object-contain" /> : null}
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">{section.title}</span>
            </div>
          ) : null}
          <div className="grid justify-items-center gap-x-3 gap-y-5 sm:gap-x-5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(200 * scale * 1.2)}px, 1fr))` }}>
            {section.ids.map(id => {
              const card = albumCard(id);
              const number = CATALOG.stickers.get(id)?.number ?? 0;
              if (!card) return null;
              const owned = album?.stickers.get(id);
              return (
                <AlbumSlot
                  key={id}
                  card={card}
                  number={number}
                  owned={!!owned}
                  level={stickerLevel(album, id)}
                  spare={owned?.spare ?? 0}
                  scale={scale}
                  onClick={() => setSelected(id)}
                />
              );
            })}
          </div>
        </section>
      ))}

      {totalPages > 1 ? (
        <nav aria-label="Paginação das cartas" className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-4 sm:flex-row">
          <span className="text-xs text-[var(--ui-text-muted)]">
            Página <strong className="tabular-nums text-[var(--ui-text)]">{current}</strong> de <strong className="tabular-nums text-[var(--ui-text)]">{totalPages}</strong>
            <span className="text-[var(--ui-text-faint)]"> · {filtered.length} carta{filtered.length === 1 ? '' : 's'}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button intent="secondary" onClick={() => goTo(current - 1)} disabled={current === 1} className="min-h-9 px-3 text-xs">
              <ChevronLeft size={15} aria-hidden="true" /> Anterior
            </Button>
            <Button intent="secondary" onClick={() => goTo(current + 1)} disabled={current === totalPages} className="min-h-9 px-3 text-xs">
              Próxima <ChevronRight size={15} aria-hidden="true" />
            </Button>
          </div>
        </nav>
      ) : null}

      <StickerSheet cardId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PageRow({ page, onOpen }: { page: AlbumPage; onOpen: () => void }) {
  const { album } = useAlbum();
  const progress = pageProgress(page, album);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-[var(--ui-line-strong)] hover:bg-white/[.03]',
        progress.complete ? 'border-[#E9C46A]/45 bg-[#E9C46A]/[.06]' : 'border-[var(--ui-line-subtle)]',
      )}
    >
      <PageCrest page={page} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 text-sm font-bold leading-snug text-[var(--ui-text)] [overflow-wrap:anywhere]">{page.title}</span>
          {progress.complete ? <Check size={14} className="shrink-0 text-[#E9C46A]" aria-label="Completa" /> : null}
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <Progress value={progress.owned} max={progress.total} tone={progress.complete ? 'success' : 'brand'} className="h-1.5 flex-1" />
          <span className="w-12 shrink-0 text-right text-[12px] font-bold tabular-nums text-[var(--ui-text-muted)]">{progress.owned}/{progress.total}</span>
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-[var(--ui-text-faint)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

export default function AlbumBook() {
  const { album } = useAlbum();
  const { eventCards } = useAccount();
  const scale = useSlotScale();
  const [sectionId, setSectionId] = useState<AlbumSectionId>(REGIONS[0]?.id ?? 'england');
  const [pageId, setPageId] = useState<string | null>(null);
  const page = pageId ? CATALOG.pageById.get(pageId) : undefined;

  useEffect(() => { if (pageId) window.scrollTo({ top: 0 }); }, [pageId]);

  if (page) return <PageView key={page.id} page={page} onBack={() => setPageId(null)} />;

  const region = REGIONS.find(r => r.id === sectionId) ?? REGIONS[0];
  const exclusiveOwned = EXCLUSIVE_CARDS.filter(card => eventCards.includes(card.id) || album?.stickers.has(card.id)).length;
  return (
    <div>
      <div className="mb-4">
        <SelectMenu
          label="Seção do álbum"
          value={sectionId}
          onChange={value => setSectionId(value as AlbumSectionId)}
          options={[
            ...REGIONS.map(r => {
              const owned = r.pages.reduce((n, p) => n + pageProgress(p, album).owned, 0);
              const total = r.pages.reduce((n, p) => n + p.stickers.length, 0);
              return {
                value: r.id,
                text: `${r.name}, ${owned} de ${total}`,
                label: (
                  <span className="flex min-w-[13rem] items-center gap-2.5 pr-2">
                    <RegionFlag regionId={r.id} />
                    <span className="text-[var(--ui-text)]">{r.name}</span>
                    <span className="ml-auto pl-3 text-xs tabular-nums text-[var(--ui-text-muted)]">{owned}/{total}</span>
                  </span>
                ),
              };
            }),
            {
              value: 'exclusive',
              text: `Cartas Exclusivas, ${exclusiveOwned} de ${EXCLUSIVE_CARDS.length}`,
              label: <span className="flex min-w-[13rem] items-center gap-2.5 pr-2"><Sparkles size={17} className="shrink-0 text-[var(--ui-brand-strong)]" aria-hidden="true" /><span className="text-[var(--ui-text)]">Cartas Exclusivas</span><span className="ml-auto pl-3 text-xs tabular-nums text-[var(--ui-text-muted)]">{exclusiveOwned}/{EXCLUSIVE_CARDS.length}</span></span>,
            },
          ]}
        />
      </div>
      {sectionId === 'exclusive' ? <ExclusiveCardsView scale={scale} /> : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {region.pages.map(p => <PageRow key={p.id} page={p} onOpen={() => setPageId(p.id)} />)}
        </div>
      )}
    </div>
  );
}
