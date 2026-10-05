// UCL Immortals — compact picker: a button showing the current choice that
// opens the list of options (difficulty filters, achievement categories).

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectMenuOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Plain text for screen readers when the label is not a string. */
  text: string;
  color?: string;
  /** Options without data stay selectable but dimmed. */
  dimmed?: boolean;
}

export default function SelectMenu<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  // Opens upwards when the list would not fit below (e.g. near a modal footer).
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const current = options.find(option => option.value === value) ?? options[0];
  const colorOf = (option?: SelectMenuOption<T>) => option?.color ?? 'var(--ui-brand-strong)';

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  const toggle = () => {
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      let bottom = window.innerHeight;
      let top = 0;
      // The nearest scrolling/clipping ancestor limits the room too.
      for (let node = rootRef.current.parentElement; node; node = node.parentElement) {
        const overflow = getComputedStyle(node).overflowY;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') {
          const box = node.getBoundingClientRect();
          bottom = Math.min(bottom, box.bottom);
          top = Math.max(top, box.top);
          break;
        }
      }
      const listHeight = options.length * 38 + 12;
      const below = bottom - rect.bottom;
      setDropUp(below < listHeight && rect.top - top > below);
    }
    setOpen(isOpen => !isOpen);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={`${label}: ${current?.text ?? ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border bg-[var(--ui-surface-inset)] py-1 pl-1.5 pr-2.5 text-sm font-bold tracking-wide transition-colors hover:bg-[var(--ui-surface-2)]"
        style={{ borderColor: `color-mix(in srgb, ${colorOf(current)} 55%, var(--ui-line-subtle))`, color: colorOf(current) }}
      >
        {current?.label}
        <ChevronDown size={16} aria-hidden="true" className={cn('ml-1 text-[var(--ui-text-muted)] transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul id={listId} role="listbox" aria-label={label} className={cn('absolute left-0 z-30 min-w-full', dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5', ' overflow-hidden rounded-lg border border-[var(--ui-line-strong)] bg-[var(--ui-surface-2)] py-1 shadow-xl')}>
          {options.map(option => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-1.5 whitespace-nowrap py-1.5 pl-1.5 pr-4 text-left text-sm font-bold transition-colors hover:bg-[var(--ui-surface-inset)]',
                    option.dimmed && !selected && 'opacity-50',
                  )}
                  style={{ color: selected ? colorOf(option) : 'var(--ui-text-soft)' }}
                >
                  {option.label}
                  {selected ? <Check size={15} aria-hidden="true" className="ml-auto pl-1" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
