// The album's inventory: the packs and envelopes kept for later, and the spare stickers (each one
// opens its sheet, to paste it for a level or sell it).
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Package, Search, X } from 'lucide-react';
import { copiesToNextLevel, levelForCopies, MAX_COPIES, SELL_VALUE, type AlbumItemKey, type AlbumLevel } from '@shared/game/album';
import { getRarityColor, type Rarity } from '@shared/game/gameData';
import { Button, EmptyState, GameModal, Input } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import { useAlbum } from '../../contexts/AlbumContext';
import { albumCard, CATALOG, itemColor, itemLabel, RARITY_LABEL, sortedItems } from './albumData';
import { CoinAmount, ItemArt, LevelStars } from './AlbumPieces';
import AlbumPackOpening from './AlbumPackOpening';
import StickerSheet from './StickerSheet';
import SelectMenu from '../account/SelectMenu';

type SpareFilter = 'all' | 'upgrade' | 'maxed';
type SpareSort = 'copies' | 'album' | 'name' | 'rarity';
type SpareDirection = 'asc' | 'desc';
const SPARE_RARITIES: Rarity[] = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'];
const SPARES_PER_PAGE = 12;
const MAX_BULK_SALE_CARDS = 100;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function AlbumInventory() {
  const { album, sellBatch } = useAlbum();
  const [opening, setOpening] = useState<AlbumItemKey[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SpareFilter>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [sort, setSort] = useState<SpareSort>('copies');
  const [direction, setDirection] = useState<SpareDirection>('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmBulkSale, setConfirmBulkSale] = useState(false);
  const [sellingBulk, setSellingBulk] = useState(false);

  const items = album ? sortedItems(album.inventory) : [];
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
      else if (sort === 'rarity') result = SPARE_RARITIES.indexOf(albumCard(a.id)?.rarity ?? 'bronze') - SPARE_RARITIES.indexOf(albumCard(b.id)?.rarity ?? 'bronze');
      else result = a.number - b.number;
      if (result === 0) result = a.number - b.number;
      return direction === 'asc' ? result : -result;
    }), [raritySpares, filter, sort, direction]);
  const pageCount = Math.max(1, Math.ceil(filteredSpares.length / SPARES_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleSpares = useMemo(() => filteredSpares.slice((currentPage - 1) * SPARES_PER_PAGE, currentPage * SPARES_PER_PAGE), [filteredSpares, currentPage]);
  const filteredCopyCount = filteredSpares.reduce((sum, spare) => sum + spare.spare, 0);
  const selectedRows = useMemo(() => spares.filter(spare => selectedIds.has(spare.id)), [spares, selectedIds]);
  const selectedCopies = selectedRows.reduce((sum, spare) => sum + spare.spare, 0);
  const selectedCoinValue = selectedRows.reduce((sum, spare) => {
    const card = albumCard(spare.id);
    return sum + (card ? SELL_VALUE[card.rarity] * spare.spare : 0);
  }, 0);
  const allVisibleSelected = visibleSpares.length > 0 && visibleSpares.every(spare => selectedIds.has(spare.id));
  const hasSpareFilters = search.trim() !== '' || filter !== 'all' || rarity !== 'all' || sort !== 'copies' || direction !== 'desc';
  const clearSpareFilters = () => { setSearch(''); setFilter('all'); setRarity('all'); setSort('copies'); setDirection('desc'); };
  useEffect(() => { setPage(1); }, [search, filter, rarity, sort, direction]);
  const goToPage = (nextPage: number) => { setPage(nextPage); };
  const togglePageSelection = () => {
    if (!allVisibleSelected) {
      const toAdd = visibleSpares.filter(spare => !selectedIds.has(spare.id)).length;
      if (selectedIds.size + toAdd > MAX_BULK_SALE_CARDS) {
        toast.error(`Você pode vender até ${MAX_BULK_SALE_CARDS} cartas por vez.`);
        return;
      }
    }
    setSelectedIds(current => {
      const next = new Set(current);
      if (allVisibleSelected) visibleSpares.forEach(spare => next.delete(spare.id));
      else visibleSpares.forEach(spare => next.add(spare.id));
      return next;
    });
  };
  const toggleCardSelection = (cardId: string) => {
    if (!selectedIds.has(cardId) && selectedIds.size >= MAX_BULK_SALE_CARDS) {
      toast.error(`Você pode vender até ${MAX_BULK_SALE_CARDS} cartas por vez.`);
      return;
    }
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
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
              <div key={key} className="flex flex-col items-center rounded-xl border border-[var(--ui-line-subtle)] px-3 pb-3 pt-4" style={{ background: `radial-gradient(circle at 50% 30%, ${itemColor(key)}1F, transparent 70%)` }}>
                <div className="relative flex h-[118px] items-end">
                  <ItemArt itemKey={key} height={112} />
                  {quantity > 1 ? <span className="absolute -right-3 -top-1 rounded-full border border-black/40 px-2 py-0.5 text-xs font-bold text-[#0B0C12]" style={{ background: itemColor(key) }}>×{quantity}</span> : null}
                </div>
                <div className="mt-2 text-center text-xs font-bold text-[var(--ui-text)]">{itemLabel(key)}</div>
                <div className="mt-2.5 flex w-full flex-col gap-1.5">
                  <Button intent="primary" onClick={() => setOpening([key])} className="min-h-9 w-full text-xs">
                    <Package size={14} aria-hidden="true" /> Abrir
                  </Button>
                  {quantity > 1 ? (
                    <Button intent="ghost" onClick={() => setOpening(Array.from({ length: quantity }, () => key))} className="min-h-8 w-full text-xs">Abrir todos ({quantity})</Button>
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
            <div className="mb-4 flex flex-col gap-2.5">
              <label className="relative block min-w-0">
                <span className="sr-only">Buscar carta repetida por nome, número, clube, posição ou raridade</span>
                <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)]" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, nº, clube ou raridade" className="w-full pl-9 pr-10" />
                {search ? <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ui-text-muted)] hover:bg-white/[.06] hover:text-[var(--ui-text)]"><X size={15} aria-hidden="true" /></button> : null}
              </label>
              <div role="group" aria-label="Filtrar repetidas por progresso" className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-1">
                {([
                  ['all', 'Todas', filterCounts.all],
                  ['upgrade', 'Podem evoluir', filterCounts.upgrade],
                  ['maxed', 'Nível máximo', filterCounts.maxed],
                ] as [SpareFilter, string, number][]).map(([value, label, count]) => (
                  <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] font-bold transition-colors ${filter === value ? 'bg-[var(--ui-surface-3)] text-[var(--ui-text)] shadow-sm' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'}`}>
                    <span className="truncate">{label}</span><span className="shrink-0 text-[10px] tabular-nums opacity-70">{count}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SelectMenu
                  label="Filtrar por raridade"
                  value={rarity}
                  onChange={value => setRarity(value as Rarity | 'all')}
                  options={[
                    { value: 'all', text: 'Todas as raridades', label: <span className="pl-1 text-[var(--ui-text)]">Todas as raridades</span> },
                    ...SPARE_RARITIES.map(value => ({ value, text: RARITY_LABEL[value], color: getRarityColor(value), label: <span className="pl-1">{RARITY_LABEL[value]}</span>, dimmed: !searchedSpares.some(spare => albumCard(spare.id)?.rarity === value) })),
                  ]}
                />
                <SelectMenu
                  label="Ordenar repetidas por"
                  value={sort}
                  onChange={value => setSort(value as SpareSort)}
                  options={[
                    { value: 'copies', text: 'Cópias extras', label: <span className="pl-1">Cópias extras</span> },
                    { value: 'album', text: 'Nº do álbum', label: <span className="pl-1">Nº do álbum</span> },
                    { value: 'name', text: 'Nome', label: <span className="pl-1">Nome</span> },
                    { value: 'rarity', text: 'Raridade', label: <span className="pl-1">Raridade</span> },
                  ]}
                />
                <button type="button" title={`Ordem ${direction === 'asc' ? 'crescente' : 'decrescente'}`} aria-label={`Mudar para ordem ${direction === 'asc' ? 'decrescente' : 'crescente'}`} onClick={() => setDirection(value => value === 'asc' ? 'desc' : 'asc')} className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] text-[var(--ui-text-soft)] transition-colors hover:border-[var(--ui-line-strong)] hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]">
                  {direction === 'asc' ? <ArrowUp size={17} aria-hidden="true" /> : <ArrowDown size={17} aria-hidden="true" />}
                </button>
                {hasSpareFilters ? <Button intent="ghost" onClick={clearSpareFilters} className="min-h-9 px-2.5 text-xs"><X size={14} aria-hidden="true" /> Limpar</Button> : null}
              </div>
            </div>
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button intent="secondary" onClick={togglePageSelection} className="min-h-9 px-3 text-xs">
                  <Check size={14} aria-hidden="true" /> {allVisibleSelected ? 'Desmarcar esta página' : 'Selecionar esta página'}
                </Button>
                <span className="text-xs text-[var(--ui-text-muted)]" aria-live="polite">
                  {selectedRows.length > 0 ? `${selectedRows.length} cartas · ${selectedCopies} cópias selecionadas` : 'Selecione cartas para vender em lote'}
                </span>
              </div>
              {selectedRows.length > 0 ? (
                <Button intent="primary" onClick={() => setConfirmBulkSale(true)} className="min-h-9 w-full px-3 text-xs sm:w-auto">
                  Vender selecionadas <CoinAmount value={selectedCoinValue} size={13} className="text-inherit" />
                </Button>
              ) : null}
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
                      <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg" title={`Selecionar ${card.shortName} para vender`}>
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleCardSelection(s.id)} aria-label={`Selecionar ${card.shortName} para vender`} className="size-5 cursor-pointer accent-[#E9C46A]" />
                      </label>
                      <button type="button" onClick={() => setSelected(s.id)} aria-label={`Ver ${card.shortName}, carta número ${s.number}, ${s.spare} cópias repetidas${toNext === null ? ', nível máximo' : `, ${s.copies} de ${s.copies + toNext} cópias para nível ${albumLevel + 1}`}`} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand-strong)]">
                        <div className="shrink-0"><PlayerCard player={card} lite scale={0.28} albumLevel={albumLevel >= 2 ? albumLevel as AlbumLevel : undefined} /></div>
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

      {opening ? <AlbumPackOpening items={opening} onClose={() => setOpening(null)} /> : null}
      <StickerSheet cardId={selected} onClose={() => setSelected(null)} />
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
