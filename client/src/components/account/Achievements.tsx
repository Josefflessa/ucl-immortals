// UCL Immortals — achievements and the profile showcase (mural).
// Pure presentation: every value comes from the server payload.

import { useSoundOnMount } from '../../audio/uiSound';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity, Award, BadgeCheck, BrickWall, CalendarCheck, CalendarDays, Castle, ChartColumnIncreasing, Check, ChevronsUp,
  ChevronRight, CircleCheck, ClipboardList, Compass, Crown, Flag, Flame, Gamepad2, Gem, Globe, Goal, Hand, Handshake, Heart, HeartHandshake,
  Lock, Medal, Mountain, Pencil, Repeat, Shield, ShieldCheck, ShieldPlus, Shirt, Skull, Sparkles, Star, Sword, Swords,
  Target, Timer, TrendingUp, Trophy, Users, Wifi, Zap, RotateCcw, FlaskConical, Leaf, Vault, CircleDot, Coins, ListChecks, Eye, Crosshair, Package, Search, type LucideIcon,
} from 'lucide-react';
import {
  ACHIEVEMENT_BY_ID,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_TIERS,
  ACHIEVEMENT_TIER_LABELS,
  ACHIEVEMENTS,
  achievementThresholds,
  achievementGoalText,
  showcaseKey,
  SHOWCASE_MAX_ITEMS,
  tierForLevel,
  type AchievementCategory,
  type RecordCategory,
  type ShowcaseItem,
} from '@shared/game/achievements';
import { COACHES, DIFFICULTY_LEVELS, getRarityColor, type Player, type Rarity } from '@shared/game/gameData';
import DifficultyEmblem from '../game/DifficultyEmblem';
import PlayerCard from '../game/PlayerCard';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import { getCrest } from '@shared/game/crests';
import { isRankedDifficulty, RANKED_DIFFICULTY_IDS } from '@shared/game/competitionRanking';
import { levelForCopies, type AlbumLevel } from '@shared/game/album';
import { seasonAt, seasonLabel } from '@shared/game/seasons';
import { albumCard, CATALOG, RARITY_LABEL } from '../album/albumData';
import { useAlbum } from '../../contexts/AlbumContext';
import type { AchievementRarity, AchievementState, AchievementsPayload, ProfileRecordEntry } from '../../contexts/AccountContext';
import { Button, GameModal, Input, SectionHeader, StatusBanner, Tab, TabList, TabPanel, Tabs } from '../../design-system';
import { cn } from '../../lib/utils';

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  trophy_collector: Trophy,
  immortal_legend: Crown,
  ladder: Mountain,
  dynasty: Repeat,
  unbeaten: ShieldCheck,
  iron_wall: BrickWall,
  firepower: Flame,
  contender: Swords,
  veteran: CalendarCheck,
  born_winner: Medal,
  goal_machine: Goal,
  room_king: Globe,
  packed_arena: Users,
  finalist: Flag,
  persistent_runner_up: Award,
  perfect_campaign: BadgeCheck,
  winning_coach: ClipboardList,
  crest_collector: Shirt,
  steamroller: Zap,
  goal_difference: TrendingUp,
  top_scorer: Target,
  maestro: Handshake,
  brick_keeper: Hand,
  galactic_squad: Gem,
  qualified: CircleCheck,
  consistency: Activity,
  marathoner: Timer,
  point_scorer: ChartColumnIncreasing,
  loyal_crest: Heart,
  lasting_partnership: HeartHandshake,
  explorer: Compass,
  regular: CalendarDays,
  legendary_legend: Star,
  immortal_challenge: Skull,
  immortal_giant: Castle,
  level_up: ChevronsUp,
  fearless: Sword,
  multiplayer: Gamepad2,
  online_contender: Wifi,
  online_unbeaten: ShieldPlus,
  comeback_champion: RotateCcw,
  perfect_final: Target,
  knockout_unbeaten: ShieldCheck,
  final_wall: Lock,
  pure_blood: Leaf,
  max_chemistry: FlaskConical,
  national_team: Flag,
  league_unbeaten: Shield,
  league_leader: ChevronsUp,
  tournament_top_scorer: Goal,
  shootout_king: CircleDot,
  hat_trick: Sparkles,
  big_win: Flame,
  golden_waiter: HeartHandshake,
  safe_vault: Vault,
  tycoon: Coins,
  mission_runner: ListChecks,
  seer: Eye,
  exact_score: Crosshair,
  friends_nemesis: Swords,
};

/** "com Pep Guardiola" / "com Real Madrid" for achievements driven by one coach or crest. */
function detailText(definition: { detail?: 'coach' | 'crest' }, detail: string | null | undefined): string | null {
  if (!definition.detail || !detail) return null;
  const name = definition.detail === 'coach'
    ? COACHES.find(coach => coach.id === detail)?.name
    : getCrest(detail)?.name;
  return name ? `com ${name}` : null;
}

const RECORD_META: Record<RecordCategory, { label: string; suffix: string; icon: LucideIcon }> = {
  goals: { label: 'Mais gols', suffix: 'gols', icon: Trophy },
  assists: { label: 'Mais assistências', suffix: 'assist.', icon: Sparkles },
  saves: { label: 'Mais defesas', suffix: 'defesas', icon: Shield },
  effective_overall: { label: 'Maior geral efetivo', suffix: 'geral', icon: Crown },
};

const LOCKED_COLOR = '#4A4A5C';

export function achievementLevelColor(level: number): string {
  const tier = tierForLevel(level);
  return tier ? getRarityColor(tier as Rarity) : LOCKED_COLOR;
}

function difficultyName(id: string): string {
  return DIFFICULTY_LEVELS.find(level => level.id === id)?.name ?? id;
}

function formatPercent(percent: number): string {
  if (percent <= 0) return '0%';
  if (percent < 1) return '<1%';
  return `${percent.toLocaleString('pt-BR', { maximumFractionDigits: percent < 10 ? 1 : 0 })}%`;
}

/**
 * Medal: the tier artwork (Bronze, Prata, Ouro, Lendário) with the achievement
 * icon in its central disc. Imortal reuses the Lendário artwork with Imortal colors.
 * Locked achievements show a dimmed, grey medal.
 * The artwork keeps transparent margins around the shield, so it is drawn
 * slightly larger than the box and centred on it (the disc is the exact centre).
 */
export function AchievementMedal({ id, level, size = 48 }: { id: string; level: number; size?: number }) {
  const Icon = ACHIEVEMENT_ICONS[id] ?? Trophy;
  const tier = tierForLevel(level);
  const locked = !tier;
  const color = achievementLevelColor(level);
  const art = size * 1.34;
  return (
    <span aria-hidden="true" className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <img
        src={`/achievements/medal-${tier === 'immortal' ? 'legendary' : tier ?? 'bronze'}.webp`}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: art,
          height: art,
          left: (size - art) / 2,
          top: (size - art) / 2,
          filter: locked ? 'grayscale(1) brightness(0.42)' : undefined,
          opacity: locked ? 0.85 : 1,
        }}
      />
      <Icon
        size={Math.round(size * 0.34)}
        strokeWidth={2.3}
        className="relative"
        style={{
          color: locked ? LOCKED_COLOR : `color-mix(in srgb, ${color} 60%, white)`,
          filter: locked ? undefined : `drop-shadow(0 0 ${Math.max(2, Math.round(size / 16))}px color-mix(in srgb, ${color} 70%, transparent))`,
        }}
      />
      {locked ? (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)]">
          <Lock size={11} className="text-[var(--ui-text-faint)]" />
        </span>
      ) : null}
    </span>
  );
}

/** Share of players at this level or above ("38% dos jogadores chegaram ao nível Ouro"); locked shows the Bronze. */
function rarityLine(state: AchievementState, rarity: AchievementRarity): string | null {
  if (rarity.players === 0) return null;
  const percents = rarity.percentByAchievement[state.id];
  if (!percents) return null;
  const level = Math.max(1, state.level);
  const tier = tierForLevel(level);
  return `${formatPercent(percents[level - 1])} dos jogadores chegaram ao nível ${tier ? ACHIEVEMENT_TIER_LABELS[tier] : 'Bronze'}`;
}

/** Full achievement card: level, next goal with progress, and rarity. */
export function AchievementTile({ state, rarity, className }: { state: AchievementState; rarity: AchievementRarity; className?: string }) {
  const definition = ACHIEVEMENT_BY_ID.get(state.id);
  if (!definition) return null;
  const tier = tierForLevel(state.level);
  const color = achievementLevelColor(state.level);
  const maxed = state.level >= 5;
  const nextThreshold = achievementThresholds(definition)[Math.min(state.level, 4)];
  // The bar matches the counter next to it (3/5 fills 60%) and takes the colour of the level it leads to.
  const ratio = maxed ? 1 : Math.max(0, Math.min(1, state.progress / Math.max(1, nextThreshold)));
  const barColor = maxed ? color : achievementLevelColor(state.level + 1);
  const rarityText = rarityLine(state, rarity);
  const detail = detailText(definition, state.detail);
  return (
    <article
      className={cn('flex min-w-0 items-start gap-3 rounded-xl border bg-[var(--ui-surface-inset)] p-3', state.level === 0 && 'opacity-80', className)}
      style={{ borderColor: state.level > 0 ? `color-mix(in srgb, ${color} 40%, var(--ui-line-subtle))` : 'var(--ui-line-subtle)' }}
      aria-label={`${definition.name}: ${tier ? `nível ${ACHIEVEMENT_TIER_LABELS[tier]}` : 'bloqueada'}`}
    >
      <AchievementMedal id={state.id} level={state.level} size={56} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <strong className="min-w-0 break-words text-sm leading-tight text-[var(--ui-text)]">{definition.name}</strong>
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-black uppercase leading-none tracking-wider"
            style={{ color: tier ? color : 'var(--ui-text-faint)', background: tier ? `color-mix(in srgb, ${color} 14%, transparent)` : 'var(--ui-surface-2)' }}
          >
            {tier ? ACHIEVEMENT_TIER_LABELS[tier] : 'Bloqueada'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-snug text-[var(--ui-text-muted)]">
          {maxed ? `Nível máximo · ${achievementGoalText(definition, 4)}` : achievementGoalText(definition, state.level)}
        </p>
        {/* Every card keeps its bar; at the top level it stays full. */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--ui-surface-3)]" role="progressbar" aria-valuemin={0} aria-valuemax={nextThreshold} aria-valuenow={maxed ? nextThreshold : Math.min(state.progress, nextThreshold)}>
            <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: barColor }} />
          </div>
          <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: maxed ? color : 'var(--ui-text-soft)' }}>
            {maxed ? 'MÁX' : `${Math.min(state.progress, nextThreshold).toLocaleString('pt-BR')}/${nextThreshold.toLocaleString('pt-BR')}`}
          </span>
        </div>
        {detail ? <p className="mt-1 truncate text-[11px] font-bold text-[var(--ui-text-soft)]">{detail}</p> : null}
        {!maxed ? <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[var(--ui-brand-strong)]"><Package size={12} aria-hidden="true" /> Próxima recompensa: Pacote {ACHIEVEMENT_TIER_LABELS[ACHIEVEMENT_TIERS[Math.min(state.level, 4)]]}</p> : null}
        {rarityText ? <p className="mt-1.5 text-[11px] text-[var(--ui-text-faint)]">{rarityText}</p> : null}
      </div>
    </article>
  );
}

const SHOWCASE_TILE = 'flex min-w-0 flex-col items-center gap-1.5 rounded-xl border bg-[var(--ui-surface-inset)] px-2.5 py-3.5 text-center';

/** Mural tile for an achievement: what was reached, not the next goal. */
function AchievementShowcaseTile({ state, rarity }: { state: AchievementState; rarity: AchievementRarity }) {
  const definition = ACHIEVEMENT_BY_ID.get(state.id);
  const tier = tierForLevel(state.level);
  if (!definition || !tier) return null;
  const color = achievementLevelColor(state.level);
  const percent = rarity.players > 0 ? rarity.percentByAchievement[state.id]?.[state.level - 1] : undefined;
  return (
    <article className={SHOWCASE_TILE} style={{ borderColor: `color-mix(in srgb, ${color} 45%, var(--ui-line-subtle))` }} aria-label={`${definition.name}, nível ${ACHIEVEMENT_TIER_LABELS[tier]}`}>
      <AchievementMedal id={state.id} level={state.level} size={64} />
      <strong className="mt-1 line-clamp-2 text-sm leading-tight text-[var(--ui-text)]">{definition.name}</strong>
      <span className="text-[11px] font-black uppercase tracking-wider" style={{ color }}>{ACHIEVEMENT_TIER_LABELS[tier]}</span>
      {percent !== undefined ? <span className="text-[11px] leading-tight text-[var(--ui-text-faint)]">{formatPercent(percent)} dos jogadores chegaram ao nível {ACHIEVEMENT_TIER_LABELS[tier]}</span> : null}
    </article>
  );
}

/** Mural tile for a record: the mark, the player and where it ranks. */
function RecordShowcaseTile({ record }: { record: ProfileRecordEntry }) {
  const meta = RECORD_META[record.category as RecordCategory] ?? RECORD_META.goals;
  const Icon = meta.icon;
  const color = isRankedDifficulty(record.difficulty_id) ? getRarityColor(record.difficulty_id as Rarity) : 'var(--ui-brand-strong)';
  return (
    <article className={SHOWCASE_TILE} style={{ borderColor: `color-mix(in srgb, ${color} 45%, var(--ui-line-subtle))` }} aria-label={`${meta.label}: ${record.value} ${meta.suffix} no ${difficultyName(record.difficulty_id)}`}>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ui-text-soft)]">
        <Icon size={13} aria-hidden="true" style={{ color }} /> {meta.label}
      </span>
      <span className="font-display text-4xl leading-none tabular-nums" style={{ color }}>{record.value.toLocaleString('pt-BR')}</span>
      <span className="w-full truncate text-xs text-[var(--ui-text-muted)]">{record.player_name}</span>
      <span className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase tracking-wider" style={{ color }}>
        <DifficultyEmblem difficulty={record.difficulty_id} size={18} />
        {difficultyName(record.difficulty_id)}{record.rank_position ? ` · #${record.rank_position}` : ''}
      </span>
      <span className="text-[11px] font-semibold text-[var(--ui-text-muted)]">{seasonLabel(record.season ?? seasonAt(record.completed_at))}</span>
    </article>
  );
}

function AlbumCardShowcaseTile({ item }: { item: Extract<ShowcaseItem, { type: 'card' }> }) {
  const player = albumCard(item.cardId);
  if (!player) return null;
  const color = getRarityColor(player.rarity);
  return (
    <article className={SHOWCASE_TILE} style={{ borderColor: `color-mix(in srgb, ${color} 45%, var(--ui-line-subtle))` }} aria-label={`${player.shortName}, carta do álbum, ${RARITY_LABEL[player.rarity]}`}>
      <PlayerCard player={player} lite flat scale={0.35} albumLevel={item.albumLevel as AlbumLevel | undefined} />
      <strong className="mt-1 line-clamp-1 text-sm text-[var(--ui-text)]">{player.shortName}</strong>
      <span className="line-clamp-1 text-[11px] text-[var(--ui-text-muted)]">{player.club}</span>
      <span className="text-[11px] font-black uppercase tracking-wider" style={{ color }}>{RARITY_LABEL[player.rarity]}{item.albumLevel ? ` · ★${item.albumLevel}` : ''}</span>
    </article>
  );
}

function findRecord(records: ProfileRecordEntry[], item: ShowcaseItem & { type: 'record' }) {
  return records.find(record => record.difficulty_id === item.difficultyId && record.category === item.category);
}

/** The mural: the player's chosen highlights (or an automatic pick). */
export function ShowcaseSection({ payload, records, onEdit, emptyText, renderRecord }: {
  payload: AchievementsPayload;
  records: ProfileRecordEntry[];
  onEdit?: () => void;
  emptyText: string;
  /** Full card for a pinned record; without it the compact tile is used. */
  renderRecord?: (record: ProfileRecordEntry) => ReactNode;
}) {
  const states = new Map(payload.achievements.map(state => [state.id, state]));
  const tiles = payload.showcase.items.flatMap<ReactNode>(item => {
    const key = showcaseKey(item);
    const span = payload.showcase.items.length === 1
      ? 'col-span-2 sm:col-span-6'
      : item.type === 'record' && renderRecord ? 'col-span-2 sm:col-span-3' : 'col-span-1 sm:col-span-2';
    const wrapper = (content: ReactNode) => <div key={key} className={cn('min-w-0 [&>article]:h-full', span)}>{content}</div>;
    if (item.type === 'achievement') {
      const state = states.get(item.id);
      return state && state.level > 0 ? [wrapper(<AchievementShowcaseTile state={state} rarity={payload.rarity} />)] : [];
    }
    if (item.type === 'record') {
      const record = findRecord(records, item);
      return record ? [wrapper(renderRecord ? renderRecord(record) : <RecordShowcaseTile record={record} />)] : [];
    }
    return [wrapper(<AlbumCardShowcaseTile item={item} />)];
  });
  return (
    <section aria-label="Mural" className="space-y-3">
      <SectionHeader
        title="Mural"
        className="mb-0 items-center"
        actions={onEdit ? (
          <Button type="button" intent="ghost" onClick={onEdit} className="min-h-9 gap-1.5 border border-[var(--ui-line-subtle)] px-3 text-xs">
            <Pencil size={14} aria-hidden="true" /> EDITAR
          </Button>
        ) : undefined}
      />
      {tiles.length > 0 ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">{tiles}</div> : null}
      {tiles.length > 0
        ? null
        : <div className="!mt-6 rounded-xl border border-dashed border-[var(--ui-line-strong)] p-4 text-center text-xs text-[var(--ui-text-muted)]">{emptyText}</div>}
    </section>
  );
}

const CATEGORY_ORDER: AchievementCategory[] = ['titles', 'campaign', 'career', 'difficulty', 'online'];

/** Every achievement, grouped by category, with progress and rarity. */
export function AchievementsSection({ payload, heading = true }: { payload: AchievementsPayload; heading?: boolean }) {
  const states = new Map(payload.achievements.map(state => [state.id, state]));
  const unlocked = payload.achievements.filter(state => state.level > 0).length;
  // The dedicated page shows one category at a time, picked from a menu.
  const [category, setCategory] = useState<AchievementCategory | 'all'>(heading ? 'all' : CATEGORY_ORDER[0]);
  const categoryOptions: SelectMenuOption<AchievementCategory | 'all'>[] = [
    { value: 'all', text: 'Todas', label: <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pl-1"><span>Todas</span><span className="text-xs tabular-nums text-[var(--ui-text-muted)]">{unlocked}/{ACHIEVEMENTS.length}</span></span> },
    ...CATEGORY_ORDER.map(id => {
      const inCategory = ACHIEVEMENTS.filter(definition => definition.category === id);
      const done = inCategory.filter(definition => (states.get(definition.id)?.level ?? 0) > 0).length;
      return {
        value: id,
        text: ACHIEVEMENT_CATEGORY_LABELS[id],
        label: <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pl-1"><span>{ACHIEVEMENT_CATEGORY_LABELS[id]}</span><span className="text-xs tabular-nums text-[var(--ui-text-muted)]">{done}/{inCategory.length}</span></span>,
      };
    }),
  ];
  const shownCategories = category === 'all' ? CATEGORY_ORDER : [category];
  return (
    <section aria-label="Conquistas" className={heading ? 'space-y-3' : 'space-y-5'}>
      {heading ? <>
        <SectionHeader
          title="Conquistas"
          className="mb-0"
          actions={<span className="font-display text-2xl tabular-nums text-[var(--ui-brand-strong)]">{unlocked}<span className="text-base text-[var(--ui-text-muted)]">/{ACHIEVEMENTS.length}</span></span>}
        />
        <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">Metas de carreira em 5 níveis: Bronze, Prata, Ouro, Lendário e Imortal. Cada nível alcançado concede um pacote correspondente.</p>
      </> : null}
      {heading ? null : <SelectMenu label="Categoria das conquistas" value={category} options={categoryOptions} onChange={setCategory} />}
      {shownCategories.map(category => {
        const list = ACHIEVEMENTS.filter(definition => definition.category === category)
          .map(definition => states.get(definition.id))
          .filter((state): state is AchievementState => !!state)
          .sort((a, b) => b.level - a.level);
        return (
          <div key={category} className="space-y-2">
            {shownCategories.length > 1 ? <div className="ui-kicker">{ACHIEVEMENT_CATEGORY_LABELS[category]}</div> : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map(state => <AchievementTile key={state.id} state={state} rarity={payload.rarity} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Lets the owner choose achievements, records and owned album cards for the mural. */
export function ShowcaseEditor({ open, onOpenChange, payload, records, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: AchievementsPayload;
  records: ProfileRecordEntry[];
  onSave: (items: ShowcaseItem[]) => Promise<void>;
}) {
  const { album } = useAlbum();
  const [selected, setSelected] = useState<ShowcaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<'achievements' | 'records' | 'cards'>('achievements');
  const [cardSearch, setCardSearch] = useState('');
  const [cardRarity, setCardRarity] = useState<Rarity | 'all'>('all');
  useEffect(() => {
    if (!open) return;
    setSelected(payload.showcase.automatic ? [] : payload.showcase.items);
    setError('');
    setSection('achievements');
    setCardSearch('');
    setCardRarity('all');
  }, [open, payload.showcase]);

  const unlocked = payload.achievements.filter(state => state.level > 0).sort((a, b) => b.level - a.level);
  // Achievements are listed by category, as on the achievements screen.
  const [achievementCategory, setAchievementCategory] = useState<AchievementCategory | 'all'>('all');
  const unlockedIn = (category: AchievementCategory | 'all') => category === 'all'
    ? unlocked
    : unlocked.filter(state => ACHIEVEMENT_BY_ID.get(state.id)?.category === category);
  const achievementCategoryOptions: SelectMenuOption<AchievementCategory | 'all'>[] = [
    { value: 'all', text: 'Todas', label: <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pl-1"><span>Todas</span><span className="text-xs tabular-nums text-[var(--ui-text-muted)]">{unlocked.length}</span></span> },
    ...CATEGORY_ORDER.map(id => ({
      value: id,
      text: ACHIEVEMENT_CATEGORY_LABELS[id],
      dimmed: unlockedIn(id).length === 0,
      label: <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pl-1"><span>{ACHIEVEMENT_CATEGORY_LABELS[id]}</span><span className="text-xs tabular-nums text-[var(--ui-text-muted)]">{unlockedIn(id).length}</span></span>,
    })),
  ];
  const shownAchievements = unlockedIn(achievementCategory);
  useEffect(() => {
    if (!open) return;
    setAchievementCategory(CATEGORY_ORDER.find(category => unlockedIn(category).length > 0) ?? 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const ownedRecords = [...RANKED_DIFFICULTY_IDS].reverse().flatMap(difficultyId =>
    records.filter(record => record.difficulty_id === difficultyId));
  // Records are listed one difficulty at a time; it opens on the hardest one with records.
  const recordDifficulties = new Set(ownedRecords.map(record => record.difficulty_id));
  const [recordDifficulty, setRecordDifficulty] = useState<string>('immortal');
  useEffect(() => {
    if (!open) return;
    setRecordDifficulty(ownedRecords[0]?.difficulty_id ?? 'immortal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const shownRecords = ownedRecords.filter(record => record.difficulty_id === recordDifficulty);
  const ownedAlbumCards = useMemo(() => Array.from(album?.stickers.entries() ?? [])
    .flatMap(([id, sticker]) => {
      const player = albumCard(id);
      const number = CATALOG.stickers.get(id)?.number;
      return player && number && sticker.copies > 0
        ? [{ id, player, number, level: levelForCopies(sticker.copies) as AlbumLevel }]
        : [];
    })
    .sort((a, b) => a.number - b.number), [album]);
  const shownAlbumCards = useMemo(() => {
    const needle = cardSearch.trim().toLocaleLowerCase('pt-BR');
    return ownedAlbumCards.filter(({ player, number }) =>
      (cardRarity === 'all' || player.rarity === cardRarity)
      && (!needle || `${player.shortName} ${player.club} ${number}`.toLocaleLowerCase('pt-BR').includes(needle)));
  }, [cardRarity, cardSearch, ownedAlbumCards]);
  const cardRarityOptions: SelectMenuOption<Rarity | 'all'>[] = [
    { value: 'all', text: 'Todas as raridades', label: 'Todas as raridades' },
    ...(['immortal', 'legendary', 'gold', 'silver', 'bronze', 'unique'] as Rarity[]).map(rarity => ({
      value: rarity,
      text: RARITY_LABEL[rarity],
      color: getRarityColor(rarity),
      label: RARITY_LABEL[rarity],
    })),
  ];
  const recordDifficultyOptions: SelectMenuOption<string>[] = [...RANKED_DIFFICULTY_IDS].reverse().map(id => ({
    value: id,
    text: difficultyName(id),
    color: getRarityColor(id as Rarity),
    dimmed: !recordDifficulties.has(id),
    label: <><DifficultyEmblem difficulty={id} size={24} />{difficultyName(id)}</>,
  }));
  const selectedKeys = selected.map(showcaseKey);
  const toggle = (item: ShowcaseItem) => {
    const key = showcaseKey(item);
    setSelected(current => current.some(entry => showcaseKey(entry) === key)
      ? current.filter(entry => showcaseKey(entry) !== key)
      : current.length >= SHOWCASE_MAX_ITEMS ? current : [...current, item]);
  };
  const selectedLabel = (item: ShowcaseItem): string => {
    if (item.type === 'achievement') return ACHIEVEMENT_BY_ID.get(item.id)?.name ?? 'Conquista';
    if (item.type === 'card') return albumCard(item.cardId)?.shortName ?? 'Carta do álbum';
    const record = findRecord(records, item);
    return record ? `${RECORD_META[item.category].label} · ${difficultyName(item.difficultyId)}` : 'Recorde';
  };
  const save = async (items: ShowcaseItem[]) => {
    setSaving(true);
    setError('');
    try {
      await onSave(items);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o mural.');
    } finally {
      setSaving(false);
    }
  };
  const option = (key: string, label: ReactNode, onClick: () => void) => {
    const position = selectedKeys.indexOf(key);
    const isSelected = position >= 0;
    const full = !isSelected && selected.length >= SHOWCASE_MAX_ITEMS;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={isSelected}
        disabled={full}
        onClick={onClick}
        className={cn(
          'flex w-full min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-40',
          isSelected ? 'border-[var(--ui-brand)] bg-[var(--ui-brand-soft)]' : 'border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] hover:border-[var(--ui-line-strong)]',
        )}
      >
        {label}
        <span className={cn('ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-black', isSelected ? 'border-[var(--ui-brand)] bg-[var(--ui-brand)] text-[var(--ui-brand-ink)]' : 'border-[var(--ui-line-strong)] text-transparent')}>
          {isSelected ? position + 1 : <Check size={12} />}
        </span>
      </button>
    );
  };

  return (
    <GameModal
      open={open}
      onOpenChange={onOpenChange}
      title="EDITAR MURAL"
      subtitle={`Escolha até ${SHOWCASE_MAX_ITEMS} destaques; eles aparecerão na ordem numerada (${selected.length}/${SHOWCASE_MAX_ITEMS}).`}
      closeLabel="Fechar edição do mural"
      footer={(
        <div className="flex w-full flex-wrap gap-2">
          <Button type="button" intent="ghost" disabled={saving} onClick={() => void save([])} className="border border-[var(--ui-line-subtle)]">AUTOMÁTICO</Button>
          <Button type="button" intent="primary" loading={saving} onClick={() => void save(selected)} className="flex-1">SALVAR MURAL</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {error ? <StatusBanner tone="danger" title="Não foi possível salvar">{error}</StatusBanner> : null}
        <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[var(--ui-text)]">Destaques escolhidos</p>
              <p className="mt-0.5 text-xs text-[var(--ui-text-muted)]">Toque em um item para adicionar ou remover.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--ui-surface-2)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--ui-text-soft)]">{selected.length}/{SHOWCASE_MAX_ITEMS}</span>
          </div>
          {selected.length > 0 ? <ol className="mt-3 flex flex-wrap gap-2">
            {selected.map((item, index) => <li key={showcaseKey(item)}>
              <button type="button" aria-label={`Remover ${selectedLabel(item)} do mural`} onClick={() => toggle(item)} disabled={saving} className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-[var(--ui-brand)]/35 bg-[var(--ui-brand-soft)] px-2.5 text-left text-xs font-semibold text-[var(--ui-text)] hover:border-[var(--ui-brand)]">
                <span className="font-bold tabular-nums text-[var(--ui-brand-strong)]">{index + 1}.</span><span className="max-w-40 truncate">{selectedLabel(item)}</span><span aria-hidden="true" className="text-[var(--ui-text-muted)]">×</span>
              </button>
            </li>)}
          </ol> : <p className="mt-3 rounded-lg border border-dashed border-[var(--ui-line-subtle)] px-3 py-2 text-xs text-[var(--ui-text-faint)]">Nenhum destaque escolhido. O mural automático continua disponível.</p>}
        </div>
        <Tabs value={section} onValueChange={value => setSection(value as typeof section)}>
          <TabList aria-label="Tipo de destaque" className="grid w-full grid-cols-3">
            <Tab value="achievements">Conquistas <span className="ml-1 text-[var(--ui-text-muted)]">{unlocked.length}</span></Tab>
            <Tab value="records">Recordes <span className="ml-1 text-[var(--ui-text-muted)]">{ownedRecords.length}</span></Tab>
            <Tab value="cards">Cartas <span className="ml-1 text-[var(--ui-text-muted)]">{ownedAlbumCards.length}</span></Tab>
          </TabList>
        <TabPanel value="achievements" className="space-y-2 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="ui-kicker">Conquistas desbloqueadas</div>
            {unlocked.length > 0 ? <SelectMenu label="Categoria das conquistas" value={achievementCategory} options={achievementCategoryOptions} onChange={setAchievementCategory} /> : null}
          </div>
          {unlocked.length === 0
            ? <p className="text-xs text-[var(--ui-text-muted)]">Você ainda não desbloqueou conquistas.</p>
            : shownAchievements.length === 0
              ? <p className="text-xs text-[var(--ui-text-muted)]">Nenhuma conquista desbloqueada nesta categoria.</p>
            : shownAchievements.map(state => {
              const definition = ACHIEVEMENT_BY_ID.get(state.id)!;
              const tier = tierForLevel(state.level)!;
              return option(`a:${state.id}`, (
                <>
                  <AchievementMedal id={state.id} level={state.level} size={40} />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-[var(--ui-text)]">{definition.name}</strong>
                    <span className="text-xs font-bold" style={{ color: achievementLevelColor(state.level) }}>{ACHIEVEMENT_TIER_LABELS[tier]}</span>
                  </span>
                </>
              ), () => toggle({ type: 'achievement', id: state.id }));
            })}
        </TabPanel>
        <TabPanel value="records" className="space-y-2 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="ui-kicker">Seus melhores recordes</div>
            {ownedRecords.length > 0 ? <SelectMenu label="Dificuldade dos recordes" value={recordDifficulty} options={recordDifficultyOptions} onChange={setRecordDifficulty} /> : null}
          </div>
          {ownedRecords.length === 0
            ? <p className="text-xs text-[var(--ui-text-muted)]">Seus recordes aparecem aqui quando você concluir competições.</p>
            : shownRecords.length === 0
              ? <p className="text-xs text-[var(--ui-text-muted)]">Nenhum recorde no {difficultyName(recordDifficulty)} ainda.</p>
            : shownRecords.map(record => {
              const category = record.category as RecordCategory;
              const meta = RECORD_META[category] ?? RECORD_META.goals;
              const Icon = meta.icon;
              const color = isRankedDifficulty(record.difficulty_id) ? getRarityColor(record.difficulty_id as Rarity) : 'var(--ui-brand-strong)';
              return option(`r:${record.difficulty_id}:${record.category}`, (
                <>
                  <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border-2" style={{ borderColor: color }}><Icon size={18} style={{ color }} /><DifficultyEmblem difficulty={record.difficulty_id} size={22} className="absolute -bottom-2 -right-2" /></span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-[var(--ui-text)]">{meta.label}: {record.value.toLocaleString('pt-BR')} {meta.suffix}</strong>
                    <span className="block truncate text-xs" style={{ color }}>{difficultyName(record.difficulty_id)} · {seasonLabel(record.season ?? seasonAt(record.completed_at))}</span>
                    <span className="block truncate text-[11px] text-[var(--ui-text-muted)]">{record.player_name}</span>
                  </span>
                </>
              ), () => toggle({ type: 'record', difficultyId: record.difficulty_id, category }));
            })}
        </TabPanel>
        <TabPanel value="cards" className="space-y-3 pt-3">
          <div>
            <div className="ui-kicker">Cartas que você possui</div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Escolha uma carta do seu Álbum para destacar no perfil.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <span className="sr-only">Buscar cartas do álbum</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-faint)]" />
              <Input value={cardSearch} onChange={event => setCardSearch(event.target.value)} placeholder="Buscar por jogador, clube ou número" className="pl-9" />
            </label>
            <SelectMenu label="Raridade das cartas" value={cardRarity} options={cardRarityOptions} onChange={setCardRarity} />
          </div>
          {ownedAlbumCards.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--ui-line-subtle)] p-5 text-center"><p className="text-sm font-semibold text-[var(--ui-text)]">Seu Álbum ainda está vazio</p><p className="mt-1 text-xs text-[var(--ui-text-muted)]">As cartas que você coletar aparecerão aqui.</p></div>
            : shownAlbumCards.length === 0 ? <p className="rounded-lg bg-[var(--ui-surface-inset)] p-3 text-center text-xs text-[var(--ui-text-muted)]">Nenhuma carta encontrada com esses filtros.</p>
              : <div className="grid max-h-[min(50vh,420px)] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {shownAlbumCards.map(({ id, player, number, level }) => option(`c:${id}`, (
                  <>
                    <span className="shrink-0"><PlayerCard player={player as Player} lite flat scale={0.24} albumLevel={level} /></span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-[var(--ui-text)]">{player.shortName}</strong>
                      <span className="block truncate text-xs text-[var(--ui-text-muted)]">{player.club}</span>
                      <span className="block text-[11px] font-semibold" style={{ color: getRarityColor(player.rarity) }}>Nº {number} · {RARITY_LABEL[player.rarity]}{level > 1 ? ` · ★${level}` : ''}</span>
                    </span>
                  </>
                ), () => toggle({ type: 'card', cardId: id, albumLevel: level }))) }
              </div>}
        </TabPanel>
        </Tabs>
      </div>
    </GameModal>
  );
}

/** "Conquista desbloqueada" list for the end-of-competition report. */
export function UnlockedAchievements({ unlocks }: { unlocks: Array<{ id: string; level: number }> }) {
  const [open, setOpen] = useState(false);
  const shown = unlocks.filter(unlock => ACHIEVEMENT_BY_ID.has(unlock.id) && tierForLevel(unlock.level));
  useSoundOnMount(shown.length > 0 ? 'achievement' : null);
  if (shown.length === 0) return null;
  // Highest levels first, so the summary row shows the best medals.
  const sorted = [...shown].sort((a, b) => b.level - a.level);
  const best = achievementLevelColor(sorted[0].level);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:brightness-110"
        style={{ borderColor: best, background: `color-mix(in srgb, ${best} 10%, transparent)` }}
      >
        <span className="flex shrink-0 items-center" aria-hidden="true">
          {sorted.slice(0, 3).map((unlock, index) => (
            <span key={unlock.id} className={index > 0 ? '-ml-4' : undefined}>
              <AchievementMedal id={unlock.id} level={unlock.level} size={40} />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm text-[var(--ui-text)]">
            {shown.length === 1 ? 'Você desbloqueou 1 conquista' : `Você desbloqueou ${shown.length} conquistas`}
          </strong>
          <span className="text-xs text-[var(--ui-text-muted)]">Toque para ver</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-[var(--ui-text-muted)]" aria-hidden="true" />
      </button>
      <GameModal open={open} onOpenChange={setOpen} title={shown.length === 1 ? 'Conquista desbloqueada' : 'Conquistas desbloqueadas'}>
        <div className="space-y-2">
          {sorted.map(unlock => {
            const definition = ACHIEVEMENT_BY_ID.get(unlock.id)!;
            const tier = tierForLevel(unlock.level)!;
            return (
              <div key={unlock.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: achievementLevelColor(unlock.level), background: `color-mix(in srgb, ${achievementLevelColor(unlock.level)} 10%, transparent)` }}>
                <AchievementMedal id={unlock.id} level={unlock.level} size={52} />
                <div className="min-w-0">
                  <strong className="block text-sm text-[var(--ui-text)]">{definition.name}</strong>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: achievementLevelColor(unlock.level) }}>Nível {ACHIEVEMENT_TIER_LABELS[tier]}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[var(--ui-brand-strong)]"><Package size={12} aria-hidden="true" /> Recompensa: Pacote {ACHIEVEMENT_TIER_LABELS[tier]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </GameModal>
    </>
  );
}
