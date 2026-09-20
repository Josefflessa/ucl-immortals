import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Check, Copy, LogOut, MoreVertical, RotateCcw, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '../../design-system';

export type RoomMenuAction = 'restart' | 'close' | 'leave';

export interface RoomMenuPlayer {
  id: string;
  name: string;
  connected?: boolean;
}

interface RoomOptionsMenuProps {
  isHost: boolean;
  onAction: (action: RoomMenuAction) => void;
  roomCode?: string | null;
  players?: RoomMenuPlayer[];
  hostId?: string | null;
  onTransferHost?: (playerId: string) => void;
}

/** Small, shared room menu used by both the lobby and the competition header. */
export default function RoomOptionsMenu({ isHost, onAction, roomCode, players = [], hostId, onTransferHost }: RoomOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [showHostPicker, setShowHostPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const availableHostTargets = players.filter(player => player.id !== hostId && player.connected !== false);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const menuWidth = 256;
      const estimatedHeight = showHostPicker ? 420 : 280;
      const left = Math.min(
        Math.max(8, trigger.right - menuWidth),
        Math.max(8, window.innerWidth - menuWidth - 8),
      );
      const top = Math.min(
        trigger.bottom + 8,
        Math.max(8, window.innerHeight - estimatedHeight - 8),
      );
      setMenuPosition({ top, left });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, showHostPicker]);

  useEffect(() => {
    if (!open) {
      setShowHostPicker(false);
      setCopied(false);
    }
  }, [open]);

  const choose = (action: RoomMenuAction) => {
    setOpen(false);
    onAction(action);
  };

  const chooseHost = (playerId: string) => {
    setOpen(false);
    setShowHostPicker(false);
    onTransferHost?.(playerId);
  };

  const copyRoomCode = async () => {
    if (!roomCode || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard permission is optional; the room code remains visible.
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        intent="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Opções da sala"
        title="Opções da sala"
        onClick={() => setOpen(value => !value)}
        className="border border-[var(--ui-line-strong)]"
      >
        <MoreVertical size={16} />
        <span className="hidden sm:inline">OPÇÕES</span>
      </Button>

      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-64 overflow-y-auto rounded-xl border border-[var(--ui-line-strong)] bg-[var(--ui-surface-1)] p-1 shadow-2xl"
          style={{ top: menuPosition.top, left: menuPosition.left, zIndex: 10000, maxHeight: 'calc(100dvh - 16px)' }}
        >
          {roomCode && (
            <div className="mb-1 flex items-center justify-between gap-3 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-3 py-2">
              <div className="min-w-0">
                <div className="text-[9px] font-black tracking-[0.16em] text-[var(--ui-text-faint)]">CÓDIGO DA SALA</div>
                <div className="mt-0.5 font-display text-xl leading-none tracking-[0.16em] text-[var(--ui-brand-strong)]">{roomCode}</div>
              </div>
              <button
                type="button"
                aria-label={copied ? 'Código copiado' : 'Copiar código da sala'}
                title={copied ? 'Código copiado' : 'Copiar código'}
                onClick={copyRoomCode}
                className="rounded-md p-1.5 text-[var(--ui-text-muted)] transition hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)]"
              >
                {copied ? <Check size={14} className="text-[var(--ui-success)]" /> : <Copy size={14} />}
              </button>
            </div>
          )}

          {isHost && (
            <>
              {onTransferHost && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    aria-expanded={showHostPicker}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-2)]"
                    onClick={() => setShowHostPicker(value => !value)}
                  >
                    <ArrowRightLeft size={15} className="text-[var(--ui-brand-strong)]" />
                    TRANSFERIR HOST
                  </button>
                  {showHostPicker && (
                    <div className="mb-1 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-1">
                      <div className="px-2 py-1 text-[9px] font-black tracking-widest text-[var(--ui-text-faint)]">ESCOLHA O NOVO ANFITRIÃO</div>
                      {availableHostTargets.length > 0 ? availableHostTargets.map(player => (
                        <button
                          key={player.id}
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-bold text-[var(--ui-text-soft)] transition hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)]"
                          onClick={() => chooseHost(player.id)}
                        >
                          <span className="truncate">{player.name}</span>
                          <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-[var(--ui-success)]" aria-label="Conectado" />
                        </button>
                      )) : (
                        <div className="px-2 py-2 text-[10px] text-[var(--ui-text-faint)]">Nenhum outro jogador conectado.</div>
                      )}
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-2)]"
                onClick={() => choose('restart')}
              >
                <RotateCcw size={15} className="text-[var(--ui-brand-strong)]" />
                REINICIAR COMPETIÇÃO
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-[var(--ui-danger)] transition hover:bg-[var(--ui-danger-soft)]"
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
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold tracking-wide text-[var(--ui-danger)] transition hover:bg-[var(--ui-danger-soft)]"
            onClick={() => choose('leave')}
          >
            <LogOut size={15} />
            SAIR DA SALA
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
