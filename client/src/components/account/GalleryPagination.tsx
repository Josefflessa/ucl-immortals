import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../design-system';
import { cn } from '../../lib/utils';

export default function GalleryPagination({ page, pageCount, label, onPageChange }: {
  page: number;
  pageCount: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  if (pageCount < 2) return null;
  const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index)
    : page <= 2
      ? [0, 1, 2, 3, 'ellipsis-right', pageCount - 1]
      : page >= pageCount - 3
        ? [0, 'ellipsis-left', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1]
        : [0, 'ellipsis-left', page - 1, page, page + 1, 'ellipsis-right', pageCount - 1];
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-3">
      <Button type="button" intent="ghost" aria-label="Página anterior" disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))} className="size-9 min-h-9 px-0">
        <ChevronLeft size={17} aria-hidden="true" />
      </Button>
      <div className="flex items-center gap-1.5">
        {pages.map((index, position) => typeof index === 'number' ? <Button
          type="button"
          key={index}
          intent="ghost"
          aria-label={`Página ${index + 1}`}
          aria-current={page === index ? 'page' : undefined}
          onClick={() => onPageChange(index)}
          className={cn('size-9 min-h-9 px-0 text-xs tabular-nums', page === index && 'border border-[var(--ui-brand)] text-[var(--ui-brand-strong)]')}
        >{index + 1}</Button> : <span key={index} className="px-0.5 text-xs text-[var(--ui-text-faint)]" aria-hidden="true">…</span>)}
      </div>
      <Button type="button" intent="ghost" aria-label="Próxima página" disabled={page === pageCount - 1} onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))} className="size-9 min-h-9 px-0">
        <ChevronRight size={17} aria-hidden="true" />
      </Button>
    </nav>
  );
}
