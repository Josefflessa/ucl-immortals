// The album on a public profile: how much of it the player filled, and the clubs they completed.
import { BookOpen } from 'lucide-react';
import { getCrest } from '@shared/game/crests';
import { Panel, PanelBody, Progress } from '../../design-system';

export interface AlbumSummary { owned: number; total: number; completedPages: number; clubsCompleted: string[] }

export default function ProfileAlbumSummary({ album }: { album: AlbumSummary }) {
  const percent = album.total ? Math.floor((album.owned / album.total) * 100) : 0;
  return (
    <Panel density="compact">
      <PanelBody className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[var(--ui-brand-strong)]" aria-hidden="true" />
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--ui-text)]">Álbum</h2>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={album.owned} max={album.total} className="h-2 flex-1" />
          <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--ui-text-muted)]">{album.owned}/{album.total} · {percent}%</span>
        </div>
        <p className="mt-2 text-xs text-[var(--ui-text-muted)]">
          {album.completedPages === 0 ? 'Nenhuma página completa ainda.' : `${album.completedPages} ${album.completedPages === 1 ? 'página completa' : 'páginas completas'}`}
        </p>
        {album.clubsCompleted.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Clubes completos">
            {album.clubsCompleted.map(clubId => {
              const crest = getCrest(clubId);
              return (
                <li key={clubId} title={crest?.name ?? clubId} className="flex items-center gap-1.5 rounded-full border border-[#E9C46A]/40 bg-[#E9C46A]/[.07] py-1 pl-1 pr-2.5 text-caption font-bold text-[var(--ui-text)]">
                  {crest ? <img src={crest.url} alt="" referrerPolicy="no-referrer" className="size-5 object-contain" /> : null}
                  {crest?.name ?? clubId}
                </li>
              );
            })}
          </ul>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
