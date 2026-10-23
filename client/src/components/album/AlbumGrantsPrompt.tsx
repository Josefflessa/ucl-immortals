// The rewards the album just granted for a finished campaign. Shown when returning to the home menu.
import { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { parseItemKey, type AlbumItemKey } from '@shared/game/album';
import { Button, GameModal } from '../../design-system';
import { useAlbum, type ItemGrant } from '../../contexts/AlbumContext';
import { useGame } from '../../contexts/GameContext';
import { groupKeys, itemColor, itemLabel } from './albumData';
import { CoinAmount, ItemArt } from './AlbumPieces';
import AlbumPackOpening from './AlbumPackOpening';

function headline(grants: readonly ItemGrant[]): string {
  const achievements = grants.some(grant => grant.source === 'achievement');
  const titles = grants.filter(grant => grant.source === 'campaign' && grant.key.startsWith('pack:')).length;
  if (achievements && titles > 0) return 'RECOMPENSAS DA CAMPANHA E CONQUISTAS';
  if (achievements) return 'RECOMPENSAS DE CONQUISTAS';
  return titles > 0 ? 'RECOMPENSAS DO TÍTULO' : 'RECOMPENSAS DA CAMPANHA';
}

export default function AlbumGrantsPrompt() {
  const { album, pendingGrants, dismissGrants, refresh } = useAlbum();
  const { state } = useGame();
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

  const title = headline(pendingGrants);
  const coinsAwarded = pendingGrants.reduce((sum, grant) => sum + (grant.coinsAwarded ?? 0), 0);
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
        <div className="grid w-full gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <Button intent="ghost" onClick={dismissGrants} className="w-full">Guardar no inventário</Button>
          <Button intent="primary" disabled={keys.length === 0} onClick={() => { setOpening(keys); dismissGrants(); }} className="w-full sm:min-w-44">
            <Package size={16} aria-hidden="true" /> Abrir agora
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        {pendingGrants.some(grant => grant.source === 'achievement') ? <p className="rounded-lg border border-[var(--ui-brand)]/25 bg-[var(--ui-brand-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--ui-text-soft)]">Pacotes dos níveis de conquista que você alcançou foram adicionados ao inventário do Álbum.</p> : null}
        {coinsAwarded > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3">
            <div className="min-w-0">
              <div className="text-caption font-black tracking-kicker text-[var(--ui-text-faint)]">MOEDAS RECEBIDAS</div>
              <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">Adicionadas ao seu saldo</div>
            </div>
            <CoinAmount value={coinsAwarded} size={17} className="shrink-0 text-lg text-[var(--ui-brand-strong)]" />
          </div>
        ) : null}
        {grouped.length > 0 ? (
          <section className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-inset)] p-3 sm:p-4" aria-label="Itens recebidos">
            <div className="mb-2 text-caption font-black tracking-kicker text-[var(--ui-text-faint)]">ITENS ADICIONADOS AO ÁLBUM</div>
            <div className="space-y-2">
              {grouped.map(([key, count]) => (
                <div key={key} className="flex min-h-[96px] items-center gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 py-2 sm:gap-4 sm:px-3">
                  <div className="flex h-20 w-24 shrink-0 items-center justify-center">
                    <ItemArt itemKey={key} height={parseItemKey(key)?.kind === 'pack' ? 80 : 120} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-[var(--ui-text)]">{itemLabel(key)}</div>
                    <div className="mt-1 text-xs text-[var(--ui-text-muted)]">Disponível no inventário do Álbum</div>
                  </div>
                  <span className="flex h-8 w-10 shrink-0 items-center justify-center">
                    {count > 1 ? <span className="rounded-full border border-black/40 px-2 py-1 text-xs font-bold text-[#0B0C12]" style={{ background: itemColor(key) }}>×{count}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </GameModal>
  );
}
