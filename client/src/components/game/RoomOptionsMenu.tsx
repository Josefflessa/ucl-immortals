import { useEffect, useRef, useState } from 'react';
import { LogOut, MoreVertical, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../design-system';

export type RoomMenuAction = 'restart' | 'close' | 'leave';

interface RoomOptionsMenuProps {
  isHost: boolean;
  onAction: (action: RoomMenuAction) => void;
}

/** Small, shared room menu used by both the lobby and the competition header. */
export default function RoomOptionsMenu({ isHost, onAction }: RoomOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const choose = (action: RoomMenuAction) => {
    setOpen(false);
    onAction(action);
  };

  return (
    <div ref={menuRef} className="relative shrink-0">
      <Button
        type="button"
        intent="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Opções da sala"
        title="Opções da sala"
        onClick={() => setOpen(value => !value)}
        className="border border-[var(--ui-border)]"
      >
        <MoreVertical size={16} />
        <span className="hidden sm:inline">OPÇÕES</span>
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[80] mt-2 w-56 overflow-hidden rounded-xl border border-[var(--ui-border-strong)] bg-[var(--ui-surface-strong)] p-1 shadow-2xl"
        >
          {isHost && (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-hover)]"
                onClick={() => choose('restart')}
              >
                <RotateCcw size={15} className="text-[var(--ui-brand-strong)]" />
                REINICIAR COMPETIÇÃO
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-[var(--ui-danger)] transition hover:bg-[var(--ui-danger)]/10"
                onClick={() => choose('close')}
              >
                <Trash2 size={15} />
                ENCERRAR SALA
              </button>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-[var(--ui-danger)] transition hover:bg-[var(--ui-danger)]/10"
            onClick={() => choose('leave')}
          >
            <LogOut size={15} />
            SAIR DA SALA
          </button>
        </div>
      )}
    </div>
  );
}
