// The album's inventory: the packs and envelopes kept for later, and the spare stickers (each one
// opens its sheet, to paste it for a level or sell it).
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Coins, Layers, Package, Sparkles, X } from 'lucide-react';
import { copiesToNextLevel, levelForCopies, MAX_BULK_ITEM_OPEN, MAX_COPIES, SELL_VALUE, type AlbumItemKey, type AlbumLevel } from '@shared/game/album';
import { getRarityColor, type Rarity } from '@shared/game/gameData';
import { Button, EmptyState, GameModal } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import { useAlbum } from '../../contexts/AlbumContext';
import { albumCard, CATALOG, itemColor, itemLabel, RARITY_LABEL, sortedItems } from './albumData';
import { CoinAmount, ItemArt, LevelStars, QuantityStepper } from './AlbumPieces';
import AlbumPackOpening from './AlbumPackOpening';
import StickerSheet from './StickerSheet';
import SelectMenu from '../account/SelectMenu';
import AlbumFilterToolbar from './AlbumFilterToolbar';

type SpareFilter = 'all' | 'upgrade' | 'maxed';
type SpareSort = 'copies' | 'album' | 'name' | 'rarity';
type SpareDirection = 'asc' | 'desc';
const SPARE_RARITIES: Rarity[] = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'];
const SPARES_PER_PAGE = 12;
const MAX_BULK_ACTION_CARDS = 100;
type BulkSelectionAction = 'apply' | 'sell' | null;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function levelName(level: number) {
  return level > 0 ? `★${level}` : 'Conquistada';
}

export default function AlbumInventory() {
  const { album, applyCopiesBatch, sellBatch } = useAlbum();
  const [opening, setOpening] = useState<AlbumItemKey[] | null>(null);
  const [openingBulk, setOpeningBulk] = useState(false);
  const [openingSession, setOpeningSession] = useState(0);
  const [bulkItemKey, setBulkItemKey] = useState<AlbumItemKey | null>(null);
  const [bulkQuantity, setBulkQuantity] = useState(2);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SpareFilter>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [sort, setSort] = useState<SpareSort>('copies');
  const [direction, setDirection] = useState<SpareDirection>('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionAction, setSelectionAction] = useState<BulkSelectionAction>(null);
  const [confirmBulkApply, setConfirmBulkApply] = useState(false);
  const [confirmBulkSale, setConfirmBulkSale] = useState(false);
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [sellingBulk, setSellingBulk] = useState(false);

  const items = album ? sortedItems(album.inventory) : [];
  const bulkAvailable = bulkItemKey && album ? album.inventory[bulkItemKey] ?? 0 : 0;
  const bulkMax = Math.min(bulkAvailable, MAX_BULK_ITEM_OPEN);
  const bulkItemKind = bulkItemKey?.startsWith('envelope:') ? 'envelope' : 'pack';
  const startOpening = (key: AlbumItemKey, quantity: number, asBulk: boolean) => {
    setOpening(Array.from({ length: quantity }, () => key));
    setOpeningBulk(asBulk);
    setOpeningSession(session => session + 1);
    setBulkItemKey(null);
  };
  const openNextWithAnimation = () => {
    const key = opening?.[0];
    const quantity = key && album ? album.inventory[key] ?? 0 : 0;
    if (!key || quantity < 1) return;
    setOpening([key]);
    setOpeningBulk(false);
    setOpeningSession(session => session + 1);
  };
  const spares = useMemo(() => {
    if (!album) return [];
    const list: { id: string; spare: number; copies: number; number: number }[] = [];
    album.stickers.forEach((sticker, id) => {
      if (sticker.spare > 0) list.push({ id, ...sticker, number: CATALOG.stickers.get(id)?.number ?? 0 });
    });
    return list.sort((a, b) => a.number - b.number);
  }, [album]);
  const searchedSpares = useMemo(() => {
    const query = normalize(search);
    return spares.filter(spare => {
      const card = albumCard(spare.id);
      if (!card) return false;
      if (query && !normalize(`${card.shortName} ${card.fullName ?? ''} ${card.club} ${card.position} ${RARITY_LABEL[card.rarity]} Nº ${spare.number} ${spare.number}`).includes(query)) return false;
      return true;
    });
  }, [spares, search]);
  const raritySpares = useMemo(() => searchedSpares.filter(spare => rarity === 'all' || albumCard(spare.id)?.rarity === rarity), [searchedSpares, rarity]);
  const filterCounts = useMemo(() => ({
    all: raritySpares.length,
    upgrade: raritySpares.filter(spare => spare.copies < MAX_COPIES).length,
    maxed: raritySpares.filter(spare => spare.copies >= MAX_COPIES).length,
  }), [raritySpares]);
  const filteredSpares = useMemo(() => raritySpares
    .filter(spare => {
      if (filter === 'upgrade' && spare.copies >= MAX_COPIES) return false;
      if (filter === 'maxed' && spare.copies < MAX_COPIES) return false;
      return true;
    })
    .sort((a, b) => {
      let result = 0;
      if (sort === 'copies') result = a.spare - b.spare;
      else if (sort === 'name') result = (albumCard(a.id)?.shortName ?? '').localeCompare(albumCard(b.id)?.shortName ?? '', 'pt-BR');
      else if (sort === 'rarity') {
        const cardA = albumCard(a.id);
        const cardB = albumCard(b.id);
        result = SPARE_RARITIES.indexOf(cardA?.rarity ?? 'bronze') - SPARE_RARITIES.indexOf(cardB?.rarity ?? 'bronze');
        if (result !== 0) return direction === 'asc' ? result : -result;
        return (cardB?.overall ?? 0) - (cardA?.overall ?? 0) || a.number - b.number;
      }
      else result = a.number - b.number;
      if (result === 0) result = a.number - b.number;
      return direction === 'asc' ? result : -result;
    }), [raritySpares, filter, sort, direction]);
  const pageCount = Math.max(1, Math.ceil(filteredSpares.length / SPARES_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleSpares = useMemo(() => filteredSpares.slice((currentPage - 1) * SPARES_PER_PAGE, currentPage * SPARES_PER_PAGE), [filteredSpares, currentPage]);
  const filteredCopyCount = filteredSpares.reduce((sum, spare) => sum + spare.spare, 0);
  const selectedRows = useMemo(() => spares.filter(spare => selectedIds.has(spare.id)), [spares, selectedIds]);
  const selectedApplyRows = useMemo(() => selectedRows.filter(spare => spare.copies < MAX_COPIES), [selectedRows]);
  const applyPreview = useMemo(() => selectedApplyRows.flatMap(spare => {
    const card = albumCard(spare.id);
    const quantity = Math.min(spare.spare, MAX_COPIES - spare.copies);
    if (!card || quantity <= 0) return [];
    return [{
      ...spare,
      card,
      quantity,
      remaining: spare.spare - quantity,
      currentLevel: levelForCopies(spare.copies),
      nextLevel: levelForCopies(spare.copies + quantity),
    }];
  }), [selectedApplyRows]);
  const applyCopyCount = applyPreview.reduce((sum, row) => sum + row.quantity, 0);
  const applyRemainingCopies = applyPreview.reduce((sum, row) => sum + row.remaining, 0);
  const selectedCopies = selectedRows.reduce((sum, spare) => sum + spare.spare, 0);
  const selectedCoinValue = selectedRows.reduce((sum, spare) => {
    const card = albumCard(spare.id);
    return sum + (card ? SELL_VALUE[card.rarity] * spare.spare : 0);
  }, 0);
  const selectableVisibleSpares = selectionAction === 'apply' ? visibleSpares.filter(spare => spare.copies < MAX_COPIES) : visibleSpares;
  const allVisibleSelected = selectableVisibleSpares.length > 0 && selectableVisibleSpares.every(spare => selectedIds.has(spare.id));
  const hasSpareFilters = search.trim() !== '' || filter !== 'all' || rarity !== 'all' || sort !== 'copies' || direction !== 'desc';
  const clearSpareFilters = () => { setSearch(''); setFilter('all'); setRarity('all'); setSort('copies'); setDirection('desc'); };
  useEffect(() => { setPage(1); }, [search, filter, rarity, sort, direction]);
  const goToPage = (nextPage: number) => { setPage(nextPage); };
  const beginBulkSelection = (action: Exclude<BulkSelectionAction, null>) => {
    setSelectedIds(new Set());
    setSelectionAction(action);
    if (action === 'apply') setFilter('upgrade');
  };
  const cancelBulkSelection = () => {
    setSelectionAction(null);
    setSelectedIds(new Set());
  };
  const togglePageSelection = () => {
    if (!allVisibleSelected) {
      const toAdd = selectableVisibleSpares.filter(spare => !selectedIds.has(spare.id)).length;
      if (selectedIds.size + toAdd > MAX_BULK_ACTION_CARDS) {
        toast.error(`Você pode selecionar até ${MAX_BULK_ACTION_CARDS} cartas por vez.`);
        return;
      }
    }
    setSelectedIds(current => {
      const next = new Set(current);
      if (allVisibleSelected) selectableVisibleSpares.forEach(spare => next.delete(spare.id));
      else selectableVisibleSpares.forEach(spare => next.add(spare.id));
      return next;
    });
  };
  const toggleCardSelection = (cardId: string) => {
    if (!selectedIds.has(cardId) && selectedIds.size >= MAX_BULK_ACTION_CARDS) {
      toast.error(`Você pode selecionar até ${MAX_BULK_ACTION_CARDS} cartas por vez.`);
      return;
    }
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };
  const applySelected = async () => {
    if (applyingBulk || applyPreview.length === 0) return;
    setApplyingBulk(true);
    try {
      const result = await applyCopiesBatch(applyPreview.map(({ id, quantity }) => ({ cardId: id, quantity })));
      setSelectedIds(new Set());
      setSelectionAction(null);
      setConfirmBulkApply(false);
      toast.success(`${result.copies} ${result.copies === 1 ? 'cópia aplicada' : 'cópias aplicadas'} em ${result.cards} ${result.cards === 1 ? 'carta' : 'cartas'}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível aplicar as cópias selecionadas.');
    } finally {
      setApplyingBulk(false);
    }
  };
  const sellSelected = async () => {
    if (sellingBulk || selectedRows.length === 0) return;
    setSellingBulk(true);
    try {
      const result = await sellBatch(selectedRows.map(({ id, spare }) => ({ cardId: id, quantity: spare })));
      setSelectedIds(new Set());
      setConfirmBulkSale(false);
      toast.success(`${result.copies} ${result.copies === 1 ? 'cópia vendida' : 'cópias vendidas'} por ${result.coins.toLocaleString('pt-BR')} moedas.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível vender as cópias selecionadas.');
    } finally {
      setSellingBulk(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[var(--ui-text)]">Pacotes e envelopes</h2>
        {items.length === 0 ? (
          <EmptyState title="Nenhum pacote guardado" description="Campanhas concluídas, títulos e páginas completas enchem o inventário. Também dá para comprar pacotes na Loja." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map(([key, quantity]) => (
              <div key={key} className="relative flex flex-col items-center rounded-xl border border-[var(--ui-line-subtle)] px-3 pb-3 pt-4" style={{ background: `radial-gradient(circle at 50% 30%, ${itemColor(key)}1F, transparent 70%)` }}>
                {quantity > 1 ? <span className="absolute right-2 top-2 z-10 rounded-full border border-black/40 px-2 py-0.5 text-xs font-bold text-[#0B0C12]" style={{ background: itemColor(key) }}>×{quantity}</span> : null}
                <div className="relative flex h-[118px] items-end">
                  <ItemArt itemKey={key} height={112} />
                </div>
                <div className="mt-2 text-center text-xs font-bold text-[var(--ui-text)]">{itemLabel(key)}</div>
                <div className="mt-2.5 flex w-full flex-col gap-1.5">
                  <Button intent="primary" onClick={() => startOpening(key, 1, false)} className="min-h-9 w-full text-xs">
                    <Package size={14} aria-hidden="true" /> Abrir
                  </Button>
                  {quantity > 1 ? (
                    <Button intent="ghost" onClick={() => { setBulkItemKey(key); setBulkQuantity(Math.max(2, Math.min(quantity, MAX_BULK_ITEM_OPEN))); }} className="min-h-8 w-full text-xs">
                      <Layers size={13} aria-hidden="true" /> Abrir em lote
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--ui-text)]">Cartas repetidas</h2>
            {spares.length > 0 ? <p role="status" aria-live="polite" className="mt-1 text-xs text-[var(--ui-text-muted)]">{filteredSpares.length} {filteredSpares.length === 1 ? 'carta' : 'cartas'} · {filteredCopyCount} {filteredCopyCount === 1 ? 'cópia extra' : 'cópias extras'}</p> : null}
          </div>
        </div>
        {spares.length === 0 ? (
          <EmptyState title="Nenhuma carta repetida" description="As cópias extras que saírem nos pacotes aparecem aqui. Use-as para evoluir cartas ou venda-as por moedas." />
        ) : (
          <>
            <AlbumFilterToolbar
              search={search}
              onSearchChange={setSearch}
              searchLabel="Buscar carta repetida por nome, número, clube, posição ou raridade"
              placeholder="Nome, nº, clube ou raridade"
              sortLabel="cartas repetidas"
              sortValue={sort}
              onSortChange={value => setSort(value as SpareSort)}
              sortOptions={[{ value: 'copies', label: 'Cópias extras' }, { value: 'album', label: 'Nº do álbum' }, { value: 'name', label: 'Nome' }, { value: 'rarity', label: 'Raridade' }]}
              direction={direction}
              onDirectionChange={() => setDirection(value => value === 'asc' ? 'desc' : 'asc')}
              sortInFilterRow
              hasActiveFilters={hasSpareFilters}
              onClear={clearSpareFilters}
              extraFilters={<>
              <div role="group" aria-label="Filtrar repetidas por progresso" className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-1 sm:w-auto">
                {([
                  ['all', 'Todas', filterCounts.all],
                  ['upgrade', 'Podem evoluir', filterCounts.upgrade],
                  ['maxed', 'Nível máximo', filterCounts.maxed],
                ] as [SpareFilter, string, number][]).map(([value, label, count]) => (
                  <button key={value} type="button" disabled={selectionAction === 'apply' && value === 'maxed'} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-bold transition-colors ${filter === value ? 'bg-[var(--ui-surface-3)] text-[var(--ui-text)] shadow-sm' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'} disabled:cursor-not-allowed disabled:opacity-40`}>
                    <span className="truncate">{label}</span><span className="shrink-0 text-[10px] tabular-nums opacity-70">{count}</span>
                  </button>
                ))}
              </div>
                <SelectMenu
                  label="Filtrar por raridade"
                  value={rarity}
                  onChange={value => setRarity(value as Rarity | 'all')}
                  appearance="neutral"
                  className="w-full min-w-0 sm:w-[220px] sm:flex-none"
                  buttonClassName="w-full justify-between"
                  options={[
                    { value: 'all', text: 'Todas as raridades', label: <span className="block min-w-0 flex-1 truncate whitespace-nowrap pl-1 text-[var(--ui-text)]">Todas as raridades</span> },
                    ...SPARE_RARITIES.map(value => ({ value, text: RARITY_LABEL[value], color: getRarityColor(value), label: <span className="pl-1">{RARITY_LABEL[value]}</span>, dimmed: !searchedSpares.some(spare => albumCard(spare.id)?.rarity === value) })),
                  ]}
                />
              </>}
            />
            <div className="mb-4 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3">
              {selectionAction === null ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--ui-text-muted)]">Escolha como usar suas cópias repetidas.</p>
                  <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <Button intent="primary" disabled={filterCounts.upgrade === 0} onClick={() => beginBulkSelection('apply')} className="min-h-9 w-full px-3 text-xs sm:w-auto">
                      <Sparkles size={14} aria-hidden="true" /> Aplicar em lote
                    </Button>
                    <Button intent="secondary" onClick={() => beginBulkSelection('sell')} className="min-h-9 w-full px-3 text-xs sm:w-auto">
                      <Coins size={14} aria-hidden="true" /> Vender em lote
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button intent="secondary" onClick={togglePageSelection} disabled={selectableVisibleSpares.length === 0} className="min-h-9 px-3 text-xs">
                        <Check size={14} aria-hidden="true" /> {allVisibleSelected ? 'Desmarcar esta página' : 'Selecionar esta página'}
                      </Button>
                      <Button intent="ghost" onClick={cancelBulkSelection} className="min-h-9 px-3 text-xs">
                        <X size={14} aria-hidden="true" /> Cancelar
                      </Button>
                    </div>
                    <span className="text-xs text-[var(--ui-text-muted)] sm:text-right" aria-live="polite">
                      {selectionAction === 'apply'
                        ? selectedApplyRows.length > 0 ? `${applyPreview.length} cartas · ${applyCopyCount} cópias para aplicar${applyRemainingCopies > 0 ? ` · ${applyRemainingCopies} ficam guardadas` : ''}` : 'Selecione cartas que ainda podem evoluir.'
                        : selectedRows.length > 0 ? `${selectedRows.length} cartas · ${selectedCopies} cópias selecionadas` : 'Selecione cartas para vender.'}
                    </span>
                  </div>
                  {selectionAction === 'apply' ? (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ui-text-faint)]">Cartas no nível máximo não podem ser selecionadas. Cópias acima do limite continuam guardadas.</p>
                  ) : null}
                  {selectedRows.length > 0 ? (
                    <div className="mt-3 flex justify-end">
                      {selectionAction === 'apply' ? (
                        <Button intent="primary" disabled={applyPreview.length === 0} onClick={() => setConfirmBulkApply(true)} className="min-h-9 w-full px-3 text-xs sm:w-auto">
                          <Sparkles size={14} aria-hidden="true" /> Conferir aplicação
                        </Button>
                      ) : (
                        <Button intent="primary" onClick={() => setConfirmBulkSale(true)} className="min-h-9 w-full px-3 text-xs sm:w-auto">
                          Vender selecionadas <CoinAmount value={selectedCoinValue} size={13} className="text-inherit" />
                        </Button>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            {filteredSpares.length === 0 ? (
              <EmptyState title="Nenhuma carta encontrada" description="Tente outro nome, número ou clube, ou limpe os filtros." action={<Button intent="secondary" onClick={clearSpareFilters}>Limpar busca e filtros</Button>} />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {visibleSpares.map(s => {
                  const card = albumCard(s.id);
                  if (!card) return null;
                  const albumLevel = levelForCopies(s.copies);
                  const toNext = copiesToNextLevel(s.copies);
                  return (
                    <div key={s.id} className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 transition-colors ${selectedIds.has(s.id) ? 'border-[#E9C46A]/60 bg-[#E9C46A]/[.06]' : 'border-[var(--ui-line-subtle)] hover:border-[var(--ui-line-strong)] hover:bg-white/[.03]'}`}>
                      {selectionAction !== null ? (
                        <label className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${selectionAction === 'apply' && s.copies >= MAX_COPIES ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`} title={`Selecionar ${card.shortName} ${selectionAction === 'apply' ? 'para aplicar cópias' : 'para vender'}`}>
                          <input type="checkbox" checked={selectedIds.has(s.id)} disabled={selectionAction === 'apply' && s.copies >= MAX_COPIES} onChange={() => toggleCardSelection(s.id)} aria-label={`Selecionar ${card.shortName} ${selectionAction === 'apply' ? 'para aplicar cópias' : 'para vender'}`} className="size-5 cursor-pointer accent-[#E9C46A] disabled:cursor-not-allowed" />
                        </label>
                      ) : null}
                      <button type="button" onClick={() => setSelected(s.id)} aria-label={`Ver ${card.shortName}, carta número ${s.number}, ${s.spare} cópias repetidas${toNext === null ? ', nível máximo' : `, ${s.copies} de ${s.copies + toNext} cópias para nível ${albumLevel + 1}`}`} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand-strong)]">
                        <div className="shrink-0"><PlayerCard player={card} lite scale={0.28} albumLevel={albumLevel as AlbumLevel} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-bold leading-snug text-[var(--ui-text)] [overflow-wrap:anywhere]">{card.shortName}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[var(--ui-text-muted)]">
                            <span>Nº {s.number} · {RARITY_LABEL[card.rarity]}</span>
                            <LevelStars level={levelForCopies(s.copies)} size={11} />
                          </div>
                          <div className="mt-0.5 text-xs leading-snug text-[var(--ui-text-faint)]">{card.club} · {toNext === null ? 'Nível máximo' : `${toNext} até ★${albumLevel + 1}`}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#E9C46A] px-2.5 py-1 text-sm font-bold tabular-nums text-[#171208]" aria-hidden="true">+{s.spare}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {filteredSpares.length > SPARES_PER_PAGE ? (
              <nav aria-label="Paginação das cartas repetidas" className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-4 sm:flex-row">
                <span className="text-xs text-[var(--ui-text-muted)]">
                  Mostrando {(currentPage - 1) * SPARES_PER_PAGE + 1}–{Math.min(currentPage * SPARES_PER_PAGE, filteredSpares.length)} de {filteredSpares.length} cartas
                </span>
                <div className="flex items-center gap-2">
                  <Button intent="secondary" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="min-h-9 px-3 text-xs">
                    <ChevronLeft size={15} aria-hidden="true" /> Anterior
                  </Button>
                  <span className="text-xs tabular-nums text-[var(--ui-text-muted)]">Página {currentPage} de {pageCount}</span>
                  <Button intent="secondary" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount} className="min-h-9 px-3 text-xs">
                    Próxima <ChevronRight size={15} aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </section>

      {opening ? (
        <AlbumPackOpening
          key={openingSession}
          items={opening}
          bulk={openingBulk}
          remainingCount={album?.inventory[opening[0]] ?? 0}
          onOpenNext={openNextWithAnimation}
          onClose={() => { setOpening(null); setOpeningBulk(false); }}
        />
      ) : null}
      <StickerSheet cardId={selected} onClose={() => setSelected(null)} />
      <GameModal
        open={confirmBulkApply}
        onOpenChange={open => { if (!applyingBulk) setConfirmBulkApply(open); }}
        title="Aplicar repetidas"
        subtitle="Usaremos as cópias necessárias até o nível máximo. As cópias que sobrarem continuam guardadas."
        closeLabel="Fechar confirmação da aplicação"
        footer={(
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button intent="ghost" disabled={applyingBulk} onClick={() => setConfirmBulkApply(false)}>Voltar</Button>
            <Button intent="primary" disabled={applyingBulk || applyPreview.length === 0} loading={applyingBulk} onClick={() => void applySelected()} className="w-full sm:w-auto">
              Aplicar {applyCopyCount} {applyCopyCount === 1 ? 'cópia' : 'cópias'}
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-3 text-sm">
            <span className="text-[var(--ui-text-muted)]">Cartas selecionadas</span>
            <strong className="tabular-nums text-[var(--ui-text)]">{applyPreview.length}</strong>
            <span className="text-[var(--ui-text-muted)]">Cópias aplicadas</span>
            <strong className="tabular-nums text-[var(--ui-text)]">{applyCopyCount}</strong>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--ui-line-subtle)] p-2 sm:p-3">
            {applyPreview.slice(0, 20).map(row => (
              <div key={row.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-[var(--ui-surface-1)] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--ui-text)]">{row.card.shortName}</div>
                  <div className="text-xs text-[var(--ui-text-muted)]">+{row.quantity} {row.quantity === 1 ? 'cópia' : 'cópias'} · {row.copies} → {row.copies + row.quantity} no nível</div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                  <span className="text-[var(--ui-text-muted)]">{levelName(row.currentLevel)}</span>
                  <span aria-hidden="true" className="text-[var(--ui-text-faint)]">→</span>
                  <strong className="text-[var(--ui-brand-strong)]">{levelName(row.nextLevel)}</strong>
                </div>
              </div>
            ))}
            {applyPreview.length > 20 ? <div className="px-2 pt-1 text-xs text-[var(--ui-text-faint)]">e mais {applyPreview.length - 20} cartas</div> : null}
          </div>
          {applyRemainingCopies > 0 ? <p className="text-xs text-[var(--ui-text-muted)]">{applyRemainingCopies} {applyRemainingCopies === 1 ? 'cópia ficará' : 'cópias ficarão'} no inventário porque essas cartas já atingiram o nível máximo.</p> : null}
        </div>
      </GameModal>
      <GameModal
        open={bulkItemKey !== null}
        onOpenChange={open => { if (!open) setBulkItemKey(null); }}
        title="Abrir em lote"
        footer={bulkItemKey && bulkMax >= 2 ? (
          <div className="flex w-full justify-center">
            <Button intent="primary" onClick={() => startOpening(bulkItemKey, bulkQuantity, true)} className="w-full sm:w-auto">
              Abrir em lote
            </Button>
          </div>
        ) : undefined}
      >
        {bulkItemKey ? (
          <div className="flex flex-col items-center gap-3 py-1 text-center">
            <ItemArt itemKey={bulkItemKey} height={96} />
            <div className="text-sm font-bold text-[var(--ui-text-muted)]">{itemLabel(bulkItemKey)}</div>
            <QuantityStepper value={bulkQuantity} onChange={setBulkQuantity} label={bulkItemKind === 'pack' ? 'pacotes' : 'envelopes'} min={2} max={bulkMax} />
          </div>
        ) : null}
      </GameModal>
      <GameModal
        open={confirmBulkSale}
        onOpenChange={open => { if (!sellingBulk) setConfirmBulkSale(open); }}
        title="Vender cartas selecionadas?"
        subtitle="A venda inclui todas as cópias extras dessas cartas."
        closeLabel="Fechar confirmação da venda"
        footer={(
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button intent="ghost" disabled={sellingBulk} onClick={() => setConfirmBulkSale(false)}>Cancelar</Button>
            <Button intent="primary" disabled={sellingBulk || selectedRows.length === 0} loading={sellingBulk} onClick={() => void sellSelected()} className="w-full sm:w-auto">
              Vender {selectedCopies} {selectedCopies === 1 ? 'cópia' : 'cópias'} <CoinAmount value={selectedCoinValue} size={14} className="text-inherit" />
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-3 text-sm">
            <span className="text-[var(--ui-text-muted)]">Cartas selecionadas</span>
            <strong className="tabular-nums text-[var(--ui-text)]">{selectedRows.length}</strong>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[var(--ui-line-subtle)] p-3 text-xs text-[var(--ui-text-muted)]">
            {selectedRows.slice(0, 12).map(row => <div key={row.id} className="flex justify-between gap-3"><span className="truncate">{albumCard(row.id)?.shortName ?? row.id}</span><span className="shrink-0 tabular-nums">×{row.spare}</span></div>)}
            {selectedRows.length > 12 ? <div className="pt-1 text-[var(--ui-text-faint)]">e mais {selectedRows.length - 12} cartas</div> : null}
          </div>
          <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">O nível já aplicado no álbum não muda. A operação só é concluída se todas as cópias ainda estiverem disponíveis.</p>
        </div>
      </GameModal>
    </div>
  );
}
