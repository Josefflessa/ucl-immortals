// The packs the album just granted for a finished campaign: open them now or keep
// them in the inventory. Shown when returning to the home menu.
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Package } from 'lucide-react';
import type { AlbumItemKey } from '@shared/game/album';
import { Button, GameModal } from '../../design-system';
import { useAlbum, type ItemGrant } from '../../contexts/AlbumContext';
import { useGame } from '../../contexts/GameContext';
import { groupKeys, itemColor, itemLabel } from './albumData';
import { ItemArt } from './AlbumPieces';
import AlbumPackOpening from './AlbumPackOpening';

function headline(grants: readonly ItemGrant[]): { title: string; text: string } {
  const titles = grants.filter(grant => grant.source === 'campaign' && grant.key.startsWith('pack:')).length;
  return {
    title: titles > 0 ? 'Campeão! Pacotes para o álbum' : 'Cartas da campanha',
    text: titles > 0 ? 'O título rendeu pacotes da dificuldade em que você jogou:' : 'Toda campanha concluída rende um envelope de cartas:',
  };
}

export default function AlbumGrantsPrompt() {
  const { album, pendingGrants, dismissGrants, refresh } = useAlbum();
  const { state, dispatch } = useGame();
  const [opening, setOpening] = useState<AlbumItemKey[] | null>(null);
  const previousPhase = useRef(state.phase);
  const hasPendingGrants = useRef(pendingGrants.length > 0);
  hasPendingGrants.current = pendingGrants.length > 0;

  // Online competitions are persisted by the room server. Sync when the player returns home so
  // their packs arrive without needing to open the album page. The room save runs in the
  // background, so retry once in case the first sync reaches the server before that save.
  useEffect(() => {
    const enteredMenu = state.phase === 'menu' && previousPhase.current !== 'menu';
    previousPhase.current = state.phase;
    if (!enteredMenu) return;
    void refresh();
    const retry = window.setTimeout(() => {
      if (!hasPendingGrants.current) void refresh();
    }, 2_500);
    return () => window.clearTimeout(retry);
  }, [state.phase, refresh]);

  if (opening) {
    return <AlbumPackOpening items={opening} onClose={() => setOpening(null)} />;
  }
  if (!album || pendingGrants.length === 0 || state.phase !== 'menu') return null;

  const { title, text } = headline(pendingGrants);
  // Only what is still in the inventory can be opened (another tab may have opened it already).
  const left = { ...album.inventory };
  const keys = pendingGrants.map(grant => grant.key).filter(key => {
    if ((left[key] ?? 0) <= 0) return false;
    left[key] = (left[key] ?? 0) - 1;
    return true;
  });
  const grouped = groupKeys(pendingGrants.map(grant => grant.key));

  return (
    <GameModal
      open
      onOpenChange={open => { if (!open) dismissGrants(); }}
      title={title}
      closeLabel="Guardar no inventário"
      footer={(
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button intent="ghost" onClick={dismissGrants}>Guardar no inventário</Button>
          <Button intent="secondary" onClick={() => { dismissGrants(); dispatch({ type: 'SET_PHASE', phase: 'album' }); }}>
            <BookOpen size={16} aria-hidden="true" /> Ver álbum
          </Button>
          <Button intent="primary" disabled={keys.length === 0} onClick={() => { setOpening(keys); dismissGrants(); }}>
            <Package size={16} aria-hidden="true" /> Abrir agora
          </Button>
        </div>
      )}
    >
      <p className="text-sm text-[var(--ui-text-muted)]">{text}</p>
      <div className="mt-5 flex flex-wrap items-end justify-center gap-5">
        {grouped.map(([key, count]) => (
          <div key={key} className="flex flex-col items-center gap-2">
            <div className="relative">
              <ItemArt itemKey={key} height={110} />
              {count > 1 ? (
                <span className="absolute -right-2 -top-2 rounded-full border border-black/40 px-2 py-0.5 text-xs font-bold text-[#0B0C12]" style={{ background: itemColor(key) }}>×{count}</span>
              ) : null}
            </div>
            <span className="text-xs font-bold text-[var(--ui-text)]">{itemLabel(key)}</span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-[var(--ui-text-faint)]">O que você guardar fica no Inventário do álbum.</p>
    </GameModal>
  );
}
