// The album's inventory: the packs and envelopes kept for later, and the spare stickers (each one
// opens its sheet, to paste it for a level or sell it).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, Search, X } from 'lucide-react';
import { copiesToNextLevel, levelForCopies, MAX_COPIES, type AlbumItemKey, type AlbumLevel } from '@shared/game/album';
import { Button, EmptyState, Input } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import { useAlbum } from '../../contexts/AlbumContext';
import { albumCard, CATALOG, itemColor, itemLabel, RARITY_LABEL, sortedItems } from './albumData';
import { ItemArt, LevelStars } from './AlbumPieces';
import AlbumPackOpening from './AlbumPackOpening';
import StickerSheet from './StickerSheet';
import SelectMenu from '../account/SelectMenu';

type SpareFilter = 'all' | 'upgrade' | 'maxed';
type SpareSort = 'copies' | 'album' | 'name';
const SPARES_PER_PAGE = 24;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function AlbumInventory() {
  const { album } = useAlbum();
  const [opening, setOpening] = useState<AlbumItemKey[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SpareFilter>('all');
  const [sort, setSort] = useState<SpareSort>('copies');
  const [page, setPage] = useState(1);
  const spareListRef = useRef<HTMLDivElement | null>(null);

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
  const filterCounts = useMemo(() => ({
    all: searchedSpares.length,
    upgrade: searchedSpares.filter(spare => spare.copies < MAX_COPIES).length,
    maxed: searchedSpares.filter(spare => spare.copies >= MAX_COPIES).length,
  }), [searchedSpares]);
  const filteredSpares = useMemo(() => searchedSpares
    .filter(spare => {
      if (filter === 'upgrade' && spare.copies >= MAX_COPIES) return false;
      if (filter === 'maxed' && spare.copies < MAX_COPIES) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'copies') return b.spare - a.spare || a.number - b.number;
      if (sort === 'name') return (albumCard(a.id)?.shortName ?? '').localeCompare(albumCard(b.id)?.shortName ?? '', 'pt-BR') || a.number - b.number;
      return a.number - b.number;
    }), [searchedSpares, filter, sort]);
  const pageCount = Math.max(1, Math.ceil(filteredSpares.length / SPARES_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleSpares = useMemo(() => filteredSpares.slice((currentPage - 1) * SPARES_PER_PAGE, currentPage * SPARES_PER_PAGE), [filteredSpares, currentPage]);
  const filteredCopyCount = filteredSpares.reduce((sum, spare) => sum + spare.spare, 0);
  const hasSpareFilters = search.trim() !== '' || filter !== 'all' || sort !== 'copies';
  const clearSpareFilters = () => { setSearch(''); setFilter('all'); setSort('copies'); };
  useEffect(() => { setPage(1); }, [search, filter, sort]);
  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    spareListRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
              <div className="flex flex-wrap items-center gap-2">
                <SelectMenu
                  label="Filtrar cartas repetidas"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', text: `Todas (${filterCounts.all})`, label: `Todas (${filterCounts.all})`, dimmed: filterCounts.all === 0 },
                    { value: 'upgrade', text: `Podem evoluir (${filterCounts.upgrade})`, label: `Podem evoluir (${filterCounts.upgrade})`, dimmed: filterCounts.upgrade === 0 },
                    { value: 'maxed', text: `Nível máximo (${filterCounts.maxed})`, label: `Nível máximo (${filterCounts.maxed})`, dimmed: filterCounts.maxed === 0 },
                  ]}
                />
                <SelectMenu
                  label="Ordenar cartas repetidas"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: 'copies', text: 'Mais cópias extras', label: 'Mais cópias extras' },
                    { value: 'album', text: 'Número do álbum', label: 'Número do álbum' },
                    { value: 'name', text: 'Nome A–Z', label: 'Nome A–Z' },
                  ]}
                />
                {hasSpareFilters ? <Button intent="ghost" onClick={clearSpareFilters} className="min-h-9 px-2.5 text-xs"><X size={14} aria-hidden="true" /> Limpar</Button> : null}
              </div>
            </div>
            {filteredSpares.length === 0 ? (
              <EmptyState title="Nenhuma carta encontrada" description="Tente outro nome, número ou clube, ou limpe os filtros." action={<Button intent="secondary" onClick={clearSpareFilters}>Limpar busca e filtros</Button>} />
            ) : (
              <div ref={spareListRef} className="grid scroll-mt-4 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {visibleSpares.map(s => {
                  const card = albumCard(s.id);
                  if (!card) return null;
                  const albumLevel = levelForCopies(s.copies);
                  const toNext = copiesToNextLevel(s.copies);
                  return (
                    <button key={s.id} type="button" onClick={() => setSelected(s.id)} aria-label={`${card.shortName}, carta número ${s.number}, ${s.spare} ${s.spare === 1 ? 'cópia repetida' : 'cópias repetidas'}${toNext === null ? ', nível máximo' : `, ${s.copies} de ${s.copies + toNext} cópias no álbum para nível ${albumLevel + 1}`}`} className="flex min-w-0 items-center gap-3.5 rounded-xl border border-[var(--ui-line-subtle)] px-3 py-2.5 text-left transition-colors hover:border-[var(--ui-line-strong)] hover:bg-white/[.03]">
                      <div className="shrink-0"><PlayerCard player={card} lite scale={0.28} albumLevel={albumLevel >= 2 ? albumLevel as AlbumLevel : undefined} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold leading-snug text-[var(--ui-text)] [overflow-wrap:anywhere]">{card.shortName}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[13px] text-[var(--ui-text-muted)]">
                          <span>Nº {s.number} · {RARITY_LABEL[card.rarity]}</span>
                          <LevelStars level={levelForCopies(s.copies)} size={11} />
                        </div>
                        <div className="mt-0.5 text-xs leading-snug text-[var(--ui-text-faint)]">{card.club} · {toNext === null ? 'Nível máximo: venda as cópias' : `${s.copies}/${s.copies + toNext} no álbum para ★${albumLevel + 1}`}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#E9C46A] px-2.5 py-1 text-sm font-bold tabular-nums text-[#171208]" aria-hidden="true">+{s.spare}</span>
                    </button>
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
    </div>
  );
}
