import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { Button, Input } from '../../design-system';
import SelectMenu from '../account/SelectMenu';

export interface AlbumSortOption {
  value: string;
  label: string;
}

interface AlbumFilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  placeholder: string;
  sortLabel?: string;
  sortValue?: string;
  sortOptions?: readonly AlbumSortOption[];
  onSortChange?: (value: string) => void;
  direction?: 'asc' | 'desc';
  onDirectionChange?: () => void;
  sortInFilterRow?: boolean;
  extraFilters?: ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  className?: string;
}

/** Shared, compact search/sort controls for the Album's card browsing views. */
export default function AlbumFilterToolbar({
  search,
  onSearchChange,
  searchLabel,
  placeholder,
  sortLabel = 'cartas',
  sortValue,
  sortOptions = [],
  onSortChange,
  direction = 'asc',
  onDirectionChange,
  sortInFilterRow = false,
  extraFilters,
  hasActiveFilters = false,
  onClear,
  className = '',
}: AlbumFilterToolbarProps) {
  const showSort = sortOptions.length > 0 && sortValue !== undefined && onSortChange;
  const sortControl = showSort ? (
    <>
      <SelectMenu
        label={`Ordenar ${sortLabel} por`}
        value={sortValue}
        onChange={value => onSortChange?.(value)}
        appearance="neutral"
        className="w-full min-w-0"
        buttonClassName="w-full justify-between"
        options={sortOptions.map(option => ({
          value: option.value,
          text: option.label,
          label: <span className="block min-w-0 truncate pl-1">{option.label}</span>,
        }))}
      />
      <button
        type="button"
        title={`Ordem ${direction === 'asc' ? 'crescente' : 'decrescente'}`}
        aria-label={`Mudar para ordem ${direction === 'asc' ? 'decrescente' : 'crescente'}`}
        onClick={onDirectionChange}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] text-[var(--ui-text-soft)] transition-colors hover:border-[var(--ui-line-strong)] hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)]"
      >
        {direction === 'asc' ? <ArrowUp size={17} aria-hidden="true" /> : <ArrowDown size={17} aria-hidden="true" />}
      </button>
    </>
  ) : null;

  return (
    <div className={`mb-4 space-y-2.5 ${className}`}>
      <div className={`grid gap-2.5 ${showSort && !sortInFilterRow ? 'sm:grid-cols-[minmax(0,1fr)_176px_40px] sm:items-center' : ''}`}>
        <label className="relative min-w-0">
          <span className="sr-only">{searchLabel}</span>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)]" />
          <Input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder={placeholder}
            className={`w-full pl-9 ${search ? 'pr-10' : ''}`}
          />
          {search ? (
            <button type="button" onClick={() => onSearchChange('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ui-text-muted)] hover:bg-white/[.06] hover:text-[var(--ui-text)]">
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        {showSort && !sortInFilterRow ? (
          <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2 sm:contents">
            {sortControl}
          </div>
        ) : null}
      </div>
      {extraFilters || (hasActiveFilters && onClear) || (showSort && sortInFilterRow) ? (
        <div className="flex flex-wrap items-center gap-2">
          {extraFilters}
          {showSort && sortInFilterRow ? <div className="grid w-[164px] shrink-0 grid-cols-[minmax(0,1fr)_40px] gap-2">{sortControl}</div> : null}
          {hasActiveFilters && onClear ? <Button intent="ghost" onClick={onClear} className="min-h-9 px-2.5 text-xs"><X size={14} aria-hidden="true" /> Limpar</Button> : null}
        </div>
      ) : null}
    </div>
  );
}
