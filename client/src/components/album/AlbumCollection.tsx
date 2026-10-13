// The account's album page: its progress and points on top, then the
// album, the inventory, the shop and the free card catalogue (which guests see alone).
import { useEffect, useState, type ReactNode } from 'react';
import type { AlbumItemKey } from '@shared/game/album';
import { Button, EmptyState, Metric, SectionHeader, Skeleton, Tab, TabList, TabPanel, Tabs } from '../../design-system';
import { useAlbum } from '../../contexts/AlbumContext';
import { cn } from '../../lib/utils';
import { albumProgress, CATALOG, sortedItems } from './albumData';
import AlbumBook from './AlbumBook';
import AlbumInventory from './AlbumInventory';
import AlbumPackOpening from './AlbumPackOpening';

type AlbumTab = 'album' | 'inventory' | 'catalog';

export default function AlbumCollection({ catalog }: { catalog: ReactNode }) {
  const { album, loading, error, refresh } = useAlbum();
  const [tab, setTab] = useState<AlbumTab>('album');
  const [opening, setOpening] = useState<AlbumItemKey[] | null>(null);

  // Fresh on every visit: packs of campaigns finished elsewhere (online rooms, another device).
  useEffect(() => { void refresh(); }, [refresh]);

  const progress = albumProgress(album);
  const percent = progress.total ? Math.floor((progress.owned / progress.total) * 100) : 0;
  const itemCount = album ? sortedItems(album.inventory).reduce((n, [, q]) => n + q, 0) : 0;

  return (
    <>
      {/* Same header as the other account screens (achievements, events, history). */}
      <SectionHeader
        title="Álbum"
        actions={album ? (
          <span role="status" aria-label={`${progress.owned} de ${progress.total} cartas no álbum`} className={cn('font-display whitespace-nowrap text-[clamp(30px,5vw,46px)] font-normal leading-[0.98] tabular-nums', progress.owned > 0 ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text-muted)]')}>
            {progress.owned}<span className="text-[0.55em] text-[var(--ui-text-muted)]">/{progress.total}</span>
          </span>
        ) : undefined}
      />

      {!album ? (
        error ? (
          <EmptyState title="Não foi possível abrir o álbum" description={error} action={<Button intent="secondary" onClick={() => void refresh()}>Tentar de novo</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-busy={loading}>
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {/* Same composition: a short label, a plain number, and an explanation. */}
            <Metric label="Progresso" className="min-w-0" value={<span className="tabular-nums">{percent}%</span>} detail={<span className="block">das cartas do álbum já conquistadas</span>} />
            <Metric label="Páginas" className="min-w-0" value={<span className="tabular-nums">{progress.pages}<span className="text-base text-[var(--ui-text-faint)]">/{CATALOG.pages.length}</span></span>} detail={<span className="block">com todas as cartas conquistadas</span>} />
            <Metric label="Inventário" className="min-w-0" value={<span className="tabular-nums">{itemCount}</span>} detail={<span className="block">pacotes e envelopes que você pode abrir</span>} />
          </div>

          <Tabs value={tab} onValueChange={value => setTab(value as AlbumTab)}>
            <TabList aria-label="Seções do álbum" className="ui-tabs--equal [&>.ui-tab]:!overflow-visible [&>.ui-tab]:![text-overflow:clip] max-sm:[&>.ui-tab]:!px-0 max-sm:[&>.ui-tab]:!tracking-normal max-[359px]:[&>.ui-tab]:!text-[9px]">
              <Tab value="album">Álbum</Tab>
              <Tab value="inventory" aria-label={itemCount > 0 ? `Inventário, ${itemCount} pacotes e envelopes para abrir` : 'Inventário'}>
                Inventário
                {/* The count where there is room (on phones the three equal tabs have none). */}
                {itemCount > 0 ? <span aria-hidden="true" className="ml-1.5 hidden rounded-full bg-[var(--ui-brand)] px-1.5 text-[11px] font-bold tabular-nums text-[var(--ui-brand-ink)] sm:inline">{itemCount}</span> : null}
              </Tab>
              <Tab value="catalog">Catálogo</Tab>
            </TabList>
            <TabPanel value="album" className="pt-5"><AlbumBook /></TabPanel>
            <TabPanel value="inventory" className="pt-5"><AlbumInventory /></TabPanel>
            <TabPanel value="catalog" className="pt-5">{catalog}</TabPanel>
          </Tabs>
        </>
      )}
      {opening ? <AlbumPackOpening items={opening} onClose={() => setOpening(null)} /> : null}
    </>
  );
}
