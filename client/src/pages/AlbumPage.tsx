import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import PlayerCard from '../components/game/PlayerCard';
import {
  getRarityColor,
  effectiveSecondaries,
  POS_PT,
  PLAYERS,
  POSITION_GROUPS,
  UNIQUE_CARDS,
  type Player,
  type Rarity,
} from '../lib/gameData';
import {
  AppShell,
  Button,
  ChoiceCard,
  EmptyState,
  Input,
  Metric,
  PageContainer,
  Panel,
  PanelBody,
  SectionHeader,
  TopBar,
} from '../design-system';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cn } from '../lib/utils';

type AlbumPlayer = Player & { isUnique: boolean };
type SortMode = 'name' | 'overall' | 'rarity';
type GridColumns = 3 | 4 | 5;

const RARITY_LABELS: Record<Rarity, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  legendary: 'Lendária',
  immortal: 'Imortal',
  unique: 'Única',
};

const RARITY_ORDER: Record<Rarity, number> = {
  unique: 6,
  immortal: 5,
  legendary: 4,
  gold: 3,
  silver: 2,
  bronze: 1,
};

const POSITION_ORDER = ['GK', ...POSITION_GROUPS.DEF, ...POSITION_GROUPS.MID, ...POSITION_GROUPS.ATT];

const GRID_OPTIONS: Array<{ columns: GridColumns; label: string; detail: string }> = [
  { columns: 3, label: 'Ampla', detail: '1–3 por linha' },
  { columns: 4, label: 'Equilibrada', detail: '2–4 por linha' },
  { columns: 5, label: 'Compacta', detail: '3–5 por linha' },
];

const ATTRIBUTE_LABELS: Array<[keyof Pick<Player, 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'vision' | 'composure'>, string]> = [
  ['pace', 'Ritmo'],
  ['shooting', 'Finalização'],
  ['passing', 'Passe'],
  ['dribbling', 'Drible'],
  ['defending', 'Defesa'],
  ['physical', 'Físico'],
  ['vision', 'Visão'],
  ['composure', 'Compostura'],
];

const ALBUM_PLAYERS: AlbumPlayer[] = Array.from(
  new Map(
    [...PLAYERS, ...UNIQUE_CARDS].map(player => [
      player.id,
      { ...player, isUnique: player.rarity === 'unique' },
    ]),
  ).values(),
);

const ALBUM_NAME_BY_ID = new Map<string, string>();
ALBUM_PLAYERS.forEach(player => {
  ALBUM_NAME_BY_ID.set(player.id, player.shortName);
  if (player.basePlayerId && !ALBUM_NAME_BY_ID.has(player.basePlayerId)) ALBUM_NAME_BY_ID.set(player.basePlayerId, player.shortName);
  if (player.historicalPlayerId && !ALBUM_NAME_BY_ID.has(player.historicalPlayerId)) ALBUM_NAME_BY_ID.set(player.historicalPlayerId, player.shortName);
});

function readablePlayerId(id: string) {
  return ALBUM_NAME_BY_ID.get(id) ?? id;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function playerIdentity(player: Player) {
  return normalize(player.fullName || player.shortName);
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return width;
}

function getPositionLabel(position: string) {
  return POS_PT[position] ?? position;
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">
        {label}
      </span>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="ui-input w-full appearance-none pr-9 text-sm"
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)]" />
      </div>
    </label>
  );
}

function PlayerDetail({ player, versionCount }: { player: AlbumPlayer; versionCount: number }) {
  const rarityColor = getRarityColor(player.rarity);
  const secondaryPositions = effectiveSecondaries(player).filter(position => position !== player.position);

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
      <div className="flex justify-center md:justify-start">
        <PlayerCard player={player} lite />
      </div>

      <div className="min-w-0">
        <DialogHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: rarityColor, borderColor: `${rarityColor}66`, backgroundColor: `${rarityColor}14` }}
            >
              {RARITY_LABELS[player.rarity]}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">
              {player.club}
            </span>
          </div>
          <DialogTitle className="mt-3 font-display text-4xl font-normal tracking-wide text-[var(--ui-text)]">
            {player.shortName}
          </DialogTitle>
          <DialogDescription className="text-pretty text-[var(--ui-text-muted)]">
            {player.fullName}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="ui-panel ui-panel--inset p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">Geral</div>
            <div className="mt-1 font-display text-3xl leading-none tabular-nums" style={{ color: rarityColor }}>{player.overall}</div>
          </div>
          <div className="ui-panel ui-panel--inset p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">Posição</div>
            <div className="mt-1 font-display text-3xl leading-none text-[var(--ui-text)]">{getPositionLabel(player.position)}</div>
          </div>
          <div className="ui-panel ui-panel--inset p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">País</div>
            <div className="mt-1 truncate text-sm font-bold text-[var(--ui-text)]">{player.nation}</div>
          </div>
          <div className="ui-panel ui-panel--inset p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">Versões</div>
            <div className="mt-1 font-display text-3xl leading-none tabular-nums text-[var(--ui-text)]">{versionCount}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-text-faint)]">Atributos</h3>
            <span className="text-xs text-[var(--ui-text-muted)]">{player.club} · {player.nation}</span>
          </div>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {ATTRIBUTE_LABELS.map(([key, label]) => {
              const value = player[key];
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--ui-text-muted)]">{label}</span>
                    <span className="font-bold tabular-nums text-[var(--ui-text)]">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--ui-line-subtle)]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: rarityColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">Posições</div>
            <p className="mt-1 text-sm text-[var(--ui-text)]">
              Principal: <strong>{getPositionLabel(player.position)}</strong>
              {secondaryPositions.length > 0 ? ` · Também: ${secondaryPositions.map(getPositionLabel).join(', ')}` : ''}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">Disponibilidade</div>
            <p className="mt-1 text-sm text-[var(--ui-text)]">
              {player.isUnique ? 'Carta única da loja' : 'Carta regular do catálogo'}
            </p>
          </div>
        </div>

        {player.historicalPartners && player.historicalPartners.length > 0 ? (
          <div className="mt-4 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">Conexões históricas</div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ui-text-muted)]">
              {player.historicalPartners.map(readablePlayerId).join(' · ')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AlbumPage() {
  const { dispatch } = useGame();
  const viewportWidth = useViewportWidth();
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState<'ALL' | Rarity>('ALL');
  const [nationFilter, setNationFilter] = useState('ALL');
  const [clubFilter, setClubFilter] = useState('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [gridColumns, setGridColumns] = useState<GridColumns>(5);
  const [page, setPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<AlbumPlayer | null>(null);

  const nations = useMemo(() => uniqueSorted(ALBUM_PLAYERS.map(player => player.nation)), []);
  const clubs = useMemo(() => uniqueSorted(ALBUM_PLAYERS.map(player => player.club)), []);
  const versionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    ALBUM_PLAYERS.forEach(player => counts.set(playerIdentity(player), (counts.get(playerIdentity(player)) ?? 0) + 1));
    return counts;
  }, []);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = normalize(search);
    const filtered = ALBUM_PLAYERS.filter(player => {
      const matchesSearch = !normalizedSearch || [player.shortName, player.fullName, player.club, player.nation].some(value => normalize(value).includes(normalizedSearch));
      const matchesPosition = positionFilter === 'ALL' || player.position === positionFilter;
      const matchesRarity = rarityFilter === 'ALL' || player.rarity === rarityFilter;
      const matchesNation = nationFilter === 'ALL' || player.nation === nationFilter;
      const matchesClub = clubFilter === 'ALL' || player.club === clubFilter;
      return matchesSearch && matchesPosition && matchesRarity && matchesNation && matchesClub;
    });

    return filtered.sort((a, b) => {
      if (sortMode === 'overall') return b.overall - a.overall || a.shortName.localeCompare(b.shortName, 'pt-BR');
      if (sortMode === 'rarity') return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || b.overall - a.overall || a.shortName.localeCompare(b.shortName, 'pt-BR');
      return a.shortName.localeCompare(b.shortName, 'pt-BR') || a.club.localeCompare(b.club, 'pt-BR') || b.overall - a.overall;
    });
  }, [clubFilter, nationFilter, positionFilter, rarityFilter, search, sortMode]);

  const pageSize = gridColumns * 4;
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visiblePlayers = filteredPlayers.slice(pageStart, pageStart + pageSize);
  const pageEnd = Math.min(pageStart + visiblePlayers.length, filteredPlayers.length);
  const visibleColumns = viewportWidth < 640 ? gridColumns - 2 : viewportWidth < 1024 ? gridColumns - 1 : gridColumns;
  const viewportGutter = viewportWidth >= 1024 ? 64 : viewportWidth >= 640 ? 48 : 32;
  const availableGridWidth = Math.max(280, Math.min(viewportWidth, 1280) - viewportGutter);
  const albumCardScale = Math.min(1, Math.max(0.42, (availableGridWidth - (visibleColumns - 1) * 12) / (visibleColumns * 208)));
  const hasFilters = Boolean(search || positionFilter !== 'ALL' || rarityFilter !== 'ALL' || nationFilter !== 'ALL' || clubFilter !== 'ALL');

  const handleSearchChange = (value: string) => { setSearch(value); setPage(1); };
  const handlePositionChange = (value: string) => { setPositionFilter(value); setPage(1); };
  const handleRarityChange = (value: string) => { setRarityFilter(value as 'ALL' | Rarity); setPage(1); };
  const handleNationChange = (value: string) => { setNationFilter(value); setPage(1); };
  const handleClubChange = (value: string) => { setClubFilter(value); setPage(1); };
  const handleSortChange = (value: string) => { setSortMode(value as SortMode); setPage(1); };
  const handleGridChange = (columns: GridColumns) => { setGridColumns(columns); setPage(1); };

  const resetFilters = () => {
    setSearch('');
    setPositionFilter('ALL');
    setRarityFilter('ALL');
    setNationFilter('ALL');
    setClubFilter('ALL');
    setPage(1);
  };

  const selectedVersionCount = selectedPlayer ? versionCounts.get(playerIdentity(selectedPlayer)) ?? 1 : 1;

  return (
    <AppShell>
      <TopBar
        title="ÁLBUM DE JOGADORES"
        right={
          <Button intent="ghost" size="default" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'menu' })} className="ml-auto shrink-0 px-3 text-xs sm:px-4">
            <ArrowLeft size={15} aria-hidden="true" />
            <span className="hidden sm:inline">VOLTAR AO MENU</span>
            <span className="sm:hidden">VOLTAR</span>
          </Button>
        }
      />

      <PageContainer wide className="pb-10 pt-7 sm:pt-10">
        <SectionHeader
          kicker="CATÁLOGO · CONSULTA LIVRE"
          title="Álbum de jogadores"
          description="Explore todas as cartas disponíveis, compare versões históricas e encontre o jogador ideal para o seu próximo elenco."
          className="mb-6"
          actions={
            <div className="hidden items-center gap-2 text-xs text-[var(--ui-text-muted)] lg:flex">
              <Users size={16} className="text-[var(--ui-brand-strong)]" aria-hidden="true" />
              <span>Catálogo atualizado com as versões do jogo</span>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Cartas" value={ALBUM_PLAYERS.length} detail="versões disponíveis" tone="brand" />
          <Metric label="Jogadores" value={versionCounts.size} detail="identidades no catálogo" />
          <Metric label="Clubes" value={clubs.length} detail="representados" />
          <Metric label="Países" value={nations.length} detail="representados" />
        </div>

        <Panel density="compact" className="mt-5">
          <PanelBody className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={17} className="text-[var(--ui-brand-strong)]" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--ui-text)]">Filtros do álbum</h2>
              </div>
              {hasFilters ? (
                <Button intent="ghost" onClick={resetFilters} className="min-h-8 px-2.5 text-xs">
                  <X size={14} aria-hidden="true" /> Limpar filtros
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(130px,1fr))]">
              <label htmlFor="album-search" className="min-w-0">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">Buscar</span>
                <div className="relative">
                  <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)]" />
                  <Input
                    id="album-search"
                    value={search}
                    onChange={event => handleSearchChange(event.target.value)}
                    placeholder="Nome, país ou clube..."
                    className="w-full pl-9"
                  />
                </div>
              </label>

              <FilterSelect id="album-position" label="Posição" value={positionFilter} onChange={handlePositionChange}>
                <option value="ALL">Todas as posições</option>
                {POSITION_ORDER.map(position => <option key={position} value={position}>{getPositionLabel(position)} · {position}</option>)}
              </FilterSelect>

              <FilterSelect id="album-rarity" label="Raridade" value={rarityFilter} onChange={handleRarityChange}>
                <option value="ALL">Todas as raridades</option>
                {(Object.keys(RARITY_LABELS) as Rarity[]).reverse().map(rarity => <option key={rarity} value={rarity}>{RARITY_LABELS[rarity]}</option>)}
              </FilterSelect>

              <FilterSelect id="album-nation" label="País" value={nationFilter} onChange={handleNationChange}>
                <option value="ALL">Todos os países</option>
                {nations.map(nation => <option key={nation} value={nation}>{nation}</option>)}
              </FilterSelect>

              <FilterSelect id="album-club" label="Clube / versão" value={clubFilter} onChange={handleClubChange}>
                <option value="ALL">Todos os clubes</option>
                {clubs.map(club => <option key={club} value={club}>{club}</option>)}
              </FilterSelect>
            </div>

            <div className="mt-4 border-t border-[var(--ui-line-subtle)] pt-4">
              <div className="flex items-start gap-2">
                <LayoutGrid size={16} className="mt-0.5 shrink-0 text-[var(--ui-brand-strong)]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">Grade</div>
                  <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Escolher grade do álbum">
                    {GRID_OPTIONS.map(option => {
                      const selected = gridColumns === option.columns;
                      return (
                        <ChoiceCard
                          key={option.columns}
                          selected={selected}
                          onClick={() => handleGridChange(option.columns)}
                          className={cn('flex min-h-10 min-w-0 flex-col items-start justify-center gap-0.5 rounded-lg px-2.5 py-2 sm:flex-row sm:items-center sm:gap-2 sm:px-3', selected && 'border-[var(--ui-brand)] bg-[var(--ui-brand-soft)]')}
                        >
                          <span className="text-xs font-bold leading-none text-[var(--ui-text)]">{option.label}</span>
                          <span className="text-[10px] leading-none text-[var(--ui-text-faint)]">{option.detail}</span>
                        </ChoiceCard>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--ui-text-faint)]">A grade se adapta à largura da tela.</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--ui-line-subtle)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--ui-text-muted)]" aria-live="polite">
                  {filteredPlayers.length === 0 ? 'Nenhuma carta encontrada' : <>Mostrando <strong className="tabular-nums text-[var(--ui-text)]">{pageStart + 1}–{pageEnd}</strong> de <strong className="tabular-nums text-[var(--ui-text)]">{filteredPlayers.length}</strong> cartas</>}
                </p>
                <label htmlFor="album-sort" className="flex w-full items-center justify-between gap-3 text-xs text-[var(--ui-text-muted)] sm:w-auto sm:justify-start">
                  <span>Ordenar por</span>
                  <select id="album-sort" value={sortMode} onChange={event => handleSortChange(event.target.value)} className="ui-input h-9 min-w-0 flex-1 py-1 text-xs sm:w-40 sm:flex-none">
                    <option value="name">Nome</option>
                    <option value="overall">Maior geral</option>
                    <option value="rarity">Raridade</option>
                  </select>
                </label>
              </div>
            </div>
          </PanelBody>
        </Panel>

        <div className="mt-6">
          {filteredPlayers.length === 0 ? (
            <EmptyState
              title="Nenhuma carta encontrada"
              description="Tente remover algum filtro ou buscar por outro nome, país ou clube."
              action={<Button intent="secondary" onClick={resetFilters}>Limpar busca</Button>}
            />
          ) : (
            <>
              <div
                className="grid gap-x-3 gap-y-8 sm:gap-x-4"
                style={{ gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))` }}
              >
              {visiblePlayers.map(player => {
                const color = getRarityColor(player.rarity);
                return (
                  <article key={player.id} className="group flex min-w-0 flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedPlayer(player)}
                      className="mx-auto rounded-[18px] p-1 outline-none transition-transform duration-150 ease-out hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[var(--ui-brand-strong)]"
                      aria-label={`Ver detalhes de ${player.shortName}, versão ${player.club}`}
                    >
                      <PlayerCard player={player} lite scale={albumCardScale} />
                    </button>
                    <div className="mt-2 w-full min-w-0 text-center">
                      <h3 className="truncate text-xs font-bold text-[var(--ui-text)]">{player.shortName}</h3>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--ui-text-muted)]" title={player.club}>{player.club}</p>
                      <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color }}>
                        <span>{getPositionLabel(player.position)}</span>
                        <span className="text-[var(--ui-text-faint)]">·</span>
                        <span>{RARITY_LABELS[player.rarity]}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
              <nav aria-label="Paginação do álbum" className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-4 sm:flex-row">
                <span className="text-xs text-[var(--ui-text-muted)]">
                  Página <strong className="tabular-nums text-[var(--ui-text)]">{currentPage}</strong> de <strong className="tabular-nums text-[var(--ui-text)]">{totalPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    intent="secondary"
                    onClick={() => setPage(value => Math.max(1, value - 1))}
                    disabled={currentPage === 1}
                    className="min-h-9 px-3 text-xs"
                  >
                    <ChevronLeft size={15} aria-hidden="true" /> Anterior
                  </Button>
                  <Button
                    intent="secondary"
                    onClick={() => setPage(value => Math.min(totalPages, value + 1))}
                    disabled={currentPage === totalPages}
                    className="min-h-9 px-3 text-xs"
                  >
                    Próxima <ChevronRight size={15} aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            </>
          )}
        </div>
      </PageContainer>

      <Dialog open={selectedPlayer !== null} onOpenChange={open => { if (!open) setSelectedPlayer(null); }}>
        <DialogContent
          overlayClassName="bg-black/85"
          closeButtonLabel="Fechar ficha do jogador"
          closeButtonClassName="right-3 top-3 size-10 rounded-xl bg-[var(--ui-surface-2)] text-[var(--ui-text)] opacity-100 shadow-md hover:bg-[var(--ui-surface-3)] [&_svg]:size-5"
          className="max-h-[min(90dvh,780px)] max-w-4xl overflow-y-auto border-[var(--ui-line)] bg-[var(--ui-bg-raised)] p-4 text-[var(--ui-text)] shadow-2xl sm:p-6"
        >
          {selectedPlayer ? <PlayerDetail player={selectedPlayer} versionCount={selectedVersionCount} /> : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
