import { useMemo, useState } from 'react';
import { Armchair, ChevronDown, Search } from 'lucide-react';
import { POS_PT, type Player } from '@shared/game/gameData';
import type { PlayerSeasonStats } from '@shared/game/gameEngine';
import PlayerAvatar from './PlayerAvatar';
import { CardIcon } from './StatusIcon';

export interface PlayerSeasonStatsRow {
  player: Player;
  stats: PlayerSeasonStats;
  teamName?: string;
  isReserve?: boolean;
}

type SortKey = 'played' | 'goals' | 'assists' | 'rating' | 'saves' | 'tackles' | 'cards' | 'name';

interface Props {
  rows: PlayerSeasonStatsRow[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  defaultSort?: SortKey;
}

const sortLabels: Record<SortKey, string> = {
  played: 'Mais jogos',
  goals: 'Mais gols',
  assists: 'Mais assistências',
  rating: 'Melhor nota',
  saves: 'Mais defesas',
  tackles: 'Mais desarmes',
  cards: 'Mais cartões',
  name: 'Nome',
};

function number(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function DetailMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--ui-surface-inset)' }}>
      <div className="text-caption font-bold uppercase tracking-wide-caps" style={{ color: 'var(--ui-text-faint)' }}>{label}</div>
      <div className="mt-1 text-base font-black tabular-nums" style={{ color: 'var(--ui-text)' }}>{value}</div>
    </div>
  );
}

export default function PlayerSeasonStatsPanel({ rows, title = 'ESTATÍSTICAS DO ELENCO', description, emptyMessage = 'Nenhum jogador disponível para exibir.', defaultSort = 'played' }: Props) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>(defaultSort);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    const filtered = rows.filter(({ player }) => !normalizedQuery ||
      player.shortName.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
      player.fullName.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
      (POS_PT[player.position] ?? player.position).toLocaleLowerCase('pt-BR').includes(normalizedQuery));

    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.player.shortName.localeCompare(b.player.shortName, 'pt-BR');
      if (sortBy === 'rating') return b.stats.ratingAvg - a.stats.ratingAvg || b.stats.played - a.stats.played || a.player.shortName.localeCompare(b.player.shortName, 'pt-BR');
      if (sortBy === 'saves') return b.stats.saves - a.stats.saves || b.stats.played - a.stats.played || a.player.shortName.localeCompare(b.player.shortName, 'pt-BR');
      if (sortBy === 'tackles') return b.stats.tackles - a.stats.tackles || b.stats.played - a.stats.played || a.player.shortName.localeCompare(b.player.shortName, 'pt-BR');
      if (sortBy === 'cards') return (b.stats.redCards * 10 + b.stats.yellowCards) - (a.stats.redCards * 10 + a.stats.yellowCards) || b.stats.played - a.stats.played || a.player.shortName.localeCompare(b.player.shortName, 'pt-BR');
      const key = sortBy as 'played' | 'goals' | 'assists';
      return b.stats[key] - a.stats[key] || b.stats.played - a.stats.played || a.player.shortName.localeCompare(b.player.shortName, 'pt-BR');
    });
  }, [query, rows, sortBy]);

  return (
    <section className="overflow-hidden rounded-2xl border" style={{ background: 'var(--ui-surface-1)', borderColor: 'var(--ui-line-subtle)' }}>
      <header className="space-y-3 border-b px-5 py-4" style={{ borderColor: 'var(--ui-line-subtle)' }}>
        <div>
          <h2 className="ui-section-label">{title}</h2>
          {description && <p className="mt-1 text-body-sm leading-ui-snug" style={{ color: 'var(--ui-text-muted)' }}>{description}</p>}
        </div>
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="flex min-w-0 items-center gap-2.5 rounded-xl border px-3.5" style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-line-subtle)' }}>
            <Search size={18} className="shrink-0" style={{ color: 'var(--ui-text-faint)' }} aria-hidden="true" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar jogador ou posição"
              aria-label="Buscar jogador ou posição"
              className="h-11 min-w-0 flex-1 bg-transparent text-body-sm outline-none placeholder:text-[var(--ui-text-faint)]"
              style={{ color: 'var(--ui-text)' }}
            />
          </label>
          <label className="relative flex items-center rounded-xl border" style={{ background: 'var(--ui-bg)', borderColor: 'var(--ui-line-subtle)' }}>
            <span className="sr-only">Ordenar elenco</span>
            <select
              value={sortBy}
              onChange={event => setSortBy(event.target.value as SortKey)}
              className="h-11 w-full appearance-none bg-transparent px-3.5 pr-10 text-body-sm font-semibold outline-none"
              style={{ color: 'var(--ui-text)' }}
            >
              {(Object.keys(sortLabels) as SortKey[]).map(key => <option key={key} value={key}>{sortLabels[key]}</option>)}
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-3" style={{ color: 'var(--ui-text-muted)' }} aria-hidden="true" />
          </label>
        </div>
        <div className="text-label" style={{ color: 'var(--ui-text-muted)' }} aria-live="polite">
          {visibleRows.length} {visibleRows.length === 1 ? 'jogador' : 'jogadores'} · Jogos contabilizados a partir das partidas disputadas.
        </div>
      </header>

      {visibleRows.length === 0 ? (
        <div className="px-5 py-12 text-center text-body-sm" style={{ color: 'var(--ui-text-muted)' }}>{rows.length ? 'Nenhum jogador corresponde à busca.' : emptyMessage}</div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--ui-line-subtle)' }}>
          {visibleRows.map(({ player, stats, teamName, isReserve }, index) => {
            const yellow = number(stats.yellowCards);
            const red = number(stats.redCards);
            const hasPlayed = stats.played > 0;
            const isGoalkeeper = player.position === 'GK';
            return (
              <details key={`${player.id}-${index}`} className="group px-4 py-4 sm:px-5 sm:py-5">
                <summary className="grid cursor-pointer grid-cols-[48px_minmax(0,1fr)_20px] items-center gap-x-3 gap-y-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] [&::-webkit-details-marker]:hidden sm:flex sm:gap-4">
                  <div className="row-span-2 sm:row-span-1">
                    <PlayerAvatar playerId={player.id} photoUrl={player.photoUrl} rarity={player.rarity} size={48} />
                  </div>
                  <div className="col-start-2 row-start-1 min-w-0 sm:flex-1">
                    <div className="whitespace-normal break-words text-body font-black leading-tight" style={{ color: 'var(--ui-text)' }}>{player.shortName}</div>
                    <div className="mt-1 space-y-1 text-label" style={{ color: 'var(--ui-text-faint)' }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-black" style={{ background: 'var(--ui-surface-3)', color: 'var(--ui-text-muted)' }}>{POS_PT[player.position] ?? player.position}</span>
                        {isReserve && (
                          <span className="inline-flex shrink-0 items-center text-[var(--ui-brand-strong)]" title="Reserva" aria-label="Jogador reserva">
                            <Armchair size={15} strokeWidth={2.4} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight">
                        {teamName && <span className="min-w-0 whitespace-normal break-words">{teamName}</span>}
                        {teamName && <span className="shrink-0" aria-hidden="true">·</span>}
                        <span className="shrink-0">{stats.played} {stats.played === 1 ? 'jogo' : 'jogos'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-start-2 row-start-2 grid grid-cols-3 gap-x-1 border-t pt-1.5 text-center sm:ml-auto sm:shrink-0 sm:gap-x-5 sm:border-0 sm:pt-0">
                    <div className="flex items-baseline justify-center gap-1 sm:block"><span className="text-sm font-black tabular-nums sm:text-base" style={{ color: 'var(--ui-text)' }}>{stats.goals}</span><span className="text-[10px] font-bold uppercase tracking-wide sm:text-[11px] sm:tracking-wider" style={{ color: 'var(--ui-text-faint)' }}>Gols</span></div>
                    <div className="flex items-baseline justify-center gap-1 sm:block"><span className="text-sm font-black tabular-nums sm:text-base" style={{ color: 'var(--ui-text)' }}>{stats.assists}</span><span className="text-[10px] font-bold uppercase tracking-wide sm:text-[11px] sm:tracking-wider" style={{ color: 'var(--ui-text-faint)' }}>Assist.</span></div>
                    <div className="flex items-baseline justify-center gap-1 sm:block"><span className="text-sm font-black tabular-nums sm:text-base" style={{ color: hasPlayed ? 'var(--ui-brand-strong)' : 'var(--ui-text-faint)' }}>{hasPlayed ? stats.ratingAvg.toFixed(1) : '—'}</span><span className="text-[10px] font-bold uppercase tracking-wide sm:text-[11px] sm:tracking-wider" style={{ color: 'var(--ui-text-faint)' }}>Nota</span></div>
                  </div>
                  <ChevronDown size={18} className="col-start-3 row-start-1 ml-0.5 shrink-0 transition-transform group-open:rotate-180 sm:ml-0" style={{ color: 'var(--ui-text-faint)' }} aria-hidden="true" />
                </summary>
                <div className="grid grid-cols-2 gap-2.5 pl-[62px] pt-4 sm:grid-cols-4 lg:grid-cols-6">
                  {(!isGoalkeeper || number(stats.shots) > 0) && <DetailMetric label="Finalizações" value={number(stats.shots)} />}
                  {(!isGoalkeeper || number(stats.shotsOnTarget) > 0) && <DetailMetric label="No alvo" value={number(stats.shotsOnTarget)} />}
                  {(!isGoalkeeper || number(stats.keyPasses) > 0) && <DetailMetric label="Passes-chave" value={number(stats.keyPasses)} />}
                  {(!isGoalkeeper || number(stats.tackles) > 0) && <DetailMetric label="Desarmes" value={number(stats.tackles)} />}
                  {isGoalkeeper && <DetailMetric label="Defesas" value={number(stats.saves)} />}
                  <DetailMetric label="Faltas" value={number(stats.fouls)} />
                  <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--ui-surface-inset)' }}>
                    <div className="text-caption font-bold uppercase tracking-wide-caps" style={{ color: 'var(--ui-text-faint)' }}>Cartões</div>
                    <div className="mt-1 flex items-center gap-2 text-base font-black tabular-nums" style={{ color: 'var(--ui-text)' }}>
                      <span className="inline-flex items-center gap-1">{yellow}<CardIcon color="yellow" /></span>
                      <span className="inline-flex items-center gap-1">{red}<CardIcon color="red" /></span>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
