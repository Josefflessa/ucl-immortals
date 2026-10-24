// UCL Immortals — achievements and the profile showcase (mural).
// Pure presentation: every value comes from the server payload.

import { useSoundOnMount } from '../../audio/uiSound';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity, Award, BadgeCheck, BookOpen, BrickWall, CalendarCheck, CalendarDays, Castle, ChartColumnIncreasing, Check, ChevronsUp,
  ChevronDown, ChevronRight, ChevronUp, CircleCheck, ClipboardList, Compass, Crown, Flag, Flame, Gamepad2, Gem, Globe, Goal, Hand, Handshake, Heart, HeartHandshake,
  Lock, Medal, Mountain, Pencil, Repeat, Shield, ShieldCheck, ShieldPlus, Shirt, Skull, Sparkles, Star, Sword, Swords,
  Target, Timer, TrendingUp, Trophy, Users, Wifi, Zap, RotateCcw, FlaskConical, Leaf, Vault, CircleDot, Coins, ListChecks, Eye, Crosshair, Package, X, type LucideIcon,
  Pin,
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
import { COACHES, DIFFICULTY_LEVELS, getRarityColor, POSITION_GROUPS, POS_PT, type Rarity } from '@shared/game/gameData';
import DifficultyEmblem from '../game/DifficultyEmblem';
import PlayerCard from '../game/PlayerCard';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import { getCrest } from '@shared/game/crests';
import { isRankedDifficulty, RANKED_DIFFICULTY_IDS } from '@shared/game/competitionRanking';
import { levelForCopies, type AlbumLevel } from '@shared/game/album';
import { seasonAt, seasonLabel } from '@shared/game/seasons';
import { albumCard, CATALOG, RARITY_LABEL } from '../album/albumData';
import { useAlbum } from '../../contexts/AlbumContext';
import { useAccount } from '../../contexts/AccountContext';
import AlbumFilterToolbar from '../album/AlbumFilterToolbar';
import { LevelStars } from '../album/AlbumPieces';
import type { AchievementRarity, AchievementState, AchievementsPayload, ProfileRecordEntry } from '../../contexts/AccountContext';
import { Button, EmptyState, GameModal, SectionHeader, StatusBanner, Tab, TabList, TabPanel, Tabs } from '../../design-system';
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
 * Medal: each tier's artwork with the achievement icon in its central disc.
 * The Imortal medal uses the matching winged crest from the Immortal difficulty.
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
  // The Immortal crest has a much smaller centre disc than the other medals.
  const iconSize = Math.round(size * (tier === 'immortal' ? 0.22 : 0.34));
  return (
    <span aria-hidden="true" className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <img
        src={`/achievements/medal-${tier ?? 'bronze'}.webp`}
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
        size={iconSize}
        strokeWidth={2.3}
        className="relative"
        style={{
          transform: tier === 'immortal' ? `translateY(${Math.round(size * 0.04)}px)` : undefined,
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
          {/* Locked ones already show a padlock on the emblem; a "Bloqueada" tag on every card was noise. */}
          {tier ? (
            <span
              className="rounded px-1.5 py-0.5 text-caption font-black uppercase leading-none tracking-wider"
              style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
            >
              {ACHIEVEMENT_TIER_LABELS[tier]}
            </span>
          ) : <span className="sr-only">Bloqueada</span>}
        </div>
        <p className="mt-1 text-xs leading-snug text-[var(--ui-text-muted)]">
          {maxed ? `Nível máximo · ${achievementGoalText(definition, 4)}` : achievementGoalText(definition, state.level)}
        </p>
        {/* Every card keeps its bar; at the top level it stays full. */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--ui-surface-3)]" role="progressbar" aria-valuemin={0} aria-valuemax={nextThreshold} aria-valuenow={maxed ? nextThreshold : Math.min(state.progress, nextThreshold)}>
            <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: barColor }} />
          </div>
          <span className="shrink-0 text-caption font-bold tabular-nums" style={{ color: maxed ? color : 'var(--ui-text-soft)' }}>
            {maxed ? 'MÁX' : `${Math.min(state.progress, nextThreshold).toLocaleString('pt-BR')}/${nextThreshold.toLocaleString('pt-BR')}`}
          </span>
        </div>
        {detail ? <p className="mt-1 truncate text-caption font-bold text-[var(--ui-text-soft)]">{detail}</p> : null}
        {!maxed ? <p className="mt-1.5 flex items-center gap-1 text-caption font-semibold text-[var(--ui-brand-strong)]"><Package size={12} aria-hidden="true" /> Próxima recompensa: Pacote {ACHIEVEMENT_TIER_LABELS[ACHIEVEMENT_TIERS[Math.min(state.level, 4)]]}</p> : null}
        {rarityText ? <p className="mt-1.5 text-caption text-[var(--ui-text-faint)]">{rarityText}</p> : null}
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
    <article className={cn(SHOWCASE_TILE, 'h-full flex-row justify-center gap-3 px-3 py-3 text-center sm:gap-4 sm:px-4')} style={{ borderColor: `color-mix(in srgb, ${color} 45%, var(--ui-line-subtle))` }} aria-label={`${definition.name}, nível ${ACHIEVEMENT_TIER_LABELS[tier]}`}>
      <AchievementMedal id={state.id} level={state.level} size={112} />
      <div className="flex min-w-0 w-full max-w-[220px] flex-col items-center justify-center gap-2">
        <strong className="line-clamp-2 text-base leading-tight text-[var(--ui-text)]">{definition.name}</strong>
        <span className="text-caption font-black uppercase tracking-wider" style={{ color }}>{ACHIEVEMENT_TIER_LABELS[tier]}</span>
        {percent !== undefined ? <span className="text-caption leading-tight text-[var(--ui-text-faint)]">{formatPercent(percent)} dos jogadores chegaram ao nível {ACHIEVEMENT_TIER_LABELS[tier]}</span> : null}
      </div>
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
      <span className="inline-flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-[var(--ui-text-soft)]">
        <Icon size={13} aria-hidden="true" style={{ color }} /> {meta.label}
      </span>
      <span className="font-display text-4xl leading-none tabular-nums" style={{ color }}>{record.value.toLocaleString('pt-BR')}</span>
      <span className="w-full truncate text-xs text-[var(--ui-text-muted)]">{record.player_name}</span>
      <span className="inline-flex items-center gap-0.5 text-caption font-black uppercase tracking-wider" style={{ color }}>
        <DifficultyEmblem difficulty={record.difficulty_id} size={18} />
        {difficultyName(record.difficulty_id)}{record.rank_position ? ` · #${record.rank_position}` : ''}
      </span>
      <span className="text-caption font-semibold text-[var(--ui-text-muted)]">{seasonLabel(record.season ?? seasonAt(record.completed_at))}</span>
    </article>
  );
}

function AlbumCardShowcaseTile({ item }: { item: Extract<ShowcaseItem, { type: 'card' }> }) {
  const player = albumCard(item.cardId);
  if (!player) return null;
  const color = getRarityColor(player.rarity);
  const level = item.albumLevel ?? 1;
  return (
    <article className={cn(SHOWCASE_TILE, 'gap-2.5 px-3 py-4 sm:py-5')} style={{ borderColor: `color-mix(in srgb, ${color} 58%, var(--ui-line-subtle))` }} aria-label={`${player.shortName}, carta do Álbum, nível do Álbum ${level} de 5, ${RARITY_LABEL[player.rarity]}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-micro font-black uppercase tracking-wide-caps" style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
        <BookOpen size={13} aria-hidden="true" /> DO ÁLBUM
      </span>
      <PlayerCard player={player} lite flat scale={0.5} albumLevel={level as AlbumLevel} />
      <div className="w-full min-w-0">
        <strong className="block truncate text-base font-black text-[var(--ui-text)]">{player.shortName}</strong>
        <span className="block truncate text-xs text-[var(--ui-text-muted)]">{player.club}</span>
      </div>
      <span className="rounded-md px-2 py-0.5 text-caption font-black uppercase tracking-wider" style={{ color, background: `color-mix(in srgb, ${color} 11%, transparent)` }}>{RARITY_LABEL[player.rarity]}</span>
      <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-bold text-[var(--ui-text-soft)]">
        <LevelStars level={level} size={13} />
        <span>Nível do Álbum {level}/5</span>
      </span>
      <span className="text-caption font-semibold text-[var(--ui-text-faint)]">Nº {CATALOG.stickers.get(item.cardId)?.number ?? '—'} do Álbum</span>
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
  const tiles = payload.showcase.items.flatMap<ReactNode>((item, index) => {
    const key = showcaseKey(item);
    const onlyTile = payload.showcase.items.length === 1;
    const lastInOddRow = !onlyTile && payload.showcase.items.length % 2 === 1 && index === payload.showcase.items.length - 1;
    const span = onlyTile
      ? 'sm:col-span-2'
      : lastInOddRow ? 'sm:col-span-2 sm:mx-auto sm:w-1/2' : '';
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
    <section aria-label="Mural" className="flex flex-col gap-4">
      <SectionHeader
        level="section"
        title="Mural"
        className="mb-0 items-center"
        actions={onEdit ? (
          <Button type="button" intent="ghost" onClick={onEdit} className="min-h-9 gap-1.5 border border-[var(--ui-line-subtle)] px-3 text-xs">
            <Pencil size={14} aria-hidden="true" /> EDITAR MURAL
          </Button>
        ) : undefined}
      />
      {tiles.length > 0 ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">{tiles}</div> : null}
      {tiles.length > 0
        ? null
        : <EmptyState
            icon={<Pin size={20} aria-hidden="true" />}
            title={onEdit ? 'Seu mural está vazio' : 'Mural vazio'}
            description={emptyText}
            action={onEdit ? <Button type="button" intent="secondary" size="small" onClick={onEdit}>Escolher destaques</Button> : undefined}
          />}
    </section>
  );
}

const CATEGORY_ORDER: AchievementCategory[] = ['titles', 'campaign', 'career', 'difficulty', 'online'];
type ShowcaseCardSort = 'number' | 'name' | 'level' | 'spares' | 'rarity';
type ShowcasePositionGroup = 'all' | keyof typeof POSITION_GROUPS;
const SHOWCASE_RARITY_ORDER: Rarity[] = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'];
const SHOWCASE_POSITION_LABEL: Record<keyof typeof POSITION_GROUPS, string> = {
  GK: 'Goleiros', DEF: 'Defensores', MID: 'Meio-campistas', ATT: 'Atacantes',
};

function normalizeCardSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

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
  const { eventCards } = useAccount();
  const [selected, setSelected] = useState<ShowcaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<'achievements' | 'records' | 'cards'>('achievements');
  const [cardSearch, setCardSearch] = useState('');
  const [cardSort, setCardSort] = useState<ShowcaseCardSort>('rarity');
  const [cardDirection, setCardDirection] = useState<'asc' | 'desc'>('desc');
  const [cardRarity, setCardRarity] = useState<Rarity | 'all'>('all');
  const [cardPositionGroup, setCardPositionGroup] = useState<ShowcasePositionGroup>('all');
  const [cardLevel, setCardLevel] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [cardCopies, setCardCopies] = useState<'all' | 'spares'>('all');
  useEffect(() => {
    if (!open) return;
    setSelected(payload.showcase.automatic ? [] : payload.showcase.items);
    setError('');
    setSection('achievements');
    setCardSearch('');
    setCardSort('rarity');
    setCardDirection('desc');
    setCardRarity('all');
    setCardPositionGroup('all');
    setCardLevel('all');
    setCardCopies('all');
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
  const ownedAlbumCards = useMemo(() => {
    const eventCardIds = new Set(eventCards);
    const ownedIds = new Set([...Array.from(album?.stickers.keys() ?? []), ...eventCards]);
    return Array.from(ownedIds)
    .flatMap(id => {
      const player = albumCard(id);
      const number = CATALOG.stickers.get(id)?.number;
      if (!player || number === undefined) return [];
      const sticker = album?.stickers.get(id);
      const copies = sticker?.copies ?? (eventCardIds.has(id) ? 1 : 0);
      const level = levelForCopies(copies) || (eventCardIds.has(id) ? 1 : 0);
      return copies > 0 ? [{ id, player, number, level, copies, spares: sticker?.spare ?? 0 }] : [];
    })
    .sort((a, b) => a.number - b.number);
  }, [album, eventCards]);
  const shownAlbumCards = useMemo(() => {
    const needle = normalizeCardSearch(cardSearch);
    return ownedAlbumCards.filter(({ player, number, level, spares }) =>
      (cardRarity === 'all' || player.rarity === cardRarity)
      && (cardPositionGroup === 'all' || POSITION_GROUPS[cardPositionGroup].includes(player.position))
      && (cardLevel === 'all' || level === Number(cardLevel))
      && (cardCopies === 'all' || spares > 0)
      && (!needle || normalizeCardSearch(`${player.shortName} ${player.fullName ?? ''} ${player.club} ${number} ${POS_PT[player.position] ?? player.position} ${player.position} ${RARITY_LABEL[player.rarity]} nível ${level} ${spares ? 'repetida repetidas' : ''}`).includes(needle)))
      .sort((a, b) => {
        let result = 0;
        if (cardSort === 'name') result = a.player.shortName.localeCompare(b.player.shortName, 'pt-BR');
        else if (cardSort === 'level') result = a.level - b.level;
        else if (cardSort === 'spares') result = a.spares - b.spares;
        else if (cardSort === 'rarity') {
          result = SHOWCASE_RARITY_ORDER.indexOf(a.player.rarity) - SHOWCASE_RARITY_ORDER.indexOf(b.player.rarity);
          if (result !== 0) return cardDirection === 'asc' ? result : -result;
          return b.player.overall - a.player.overall || a.number - b.number;
        } else result = a.number - b.number;
        if (result === 0) result = a.number - b.number;
        return cardDirection === 'asc' ? result : -result;
      });
  }, [cardCopies, cardDirection, cardLevel, cardPositionGroup, cardRarity, cardSearch, cardSort, ownedAlbumCards]);
  const cardRarityOptions: SelectMenuOption<Rarity | 'all'>[] = [
    { value: 'all', text: 'Todas as raridades', label: 'Todas as raridades' },
    ...(['immortal', 'legendary', 'gold', 'silver', 'bronze', 'unique'] as Rarity[]).map(rarity => ({
      value: rarity,
      text: RARITY_LABEL[rarity],
      color: getRarityColor(rarity),
      label: RARITY_LABEL[rarity],
    })),
  ];
  const cardPositionOptions: SelectMenuOption<ShowcasePositionGroup>[] = [
    { value: 'all', text: 'Todas as posições', label: 'Todas as posições' },
    ...(Object.keys(POSITION_GROUPS) as Array<keyof typeof POSITION_GROUPS>).map(group => ({
      value: group,
      text: SHOWCASE_POSITION_LABEL[group],
      label: SHOWCASE_POSITION_LABEL[group],
    })),
  ];
  const cardLevelOptions: SelectMenuOption<'all' | '1' | '2' | '3' | '4' | '5'>[] = [
    { value: 'all', text: 'Todos os níveis', label: 'Todos os níveis' },
    ...([1, 2, 3, 4, 5] as const).map(level => ({ value: String(level) as '1' | '2' | '3' | '4' | '5', text: `Nível ${level}`, label: `Nível ${level}` })),
  ];
  const cardCopiesOptions: SelectMenuOption<'all' | 'spares'>[] = [
    { value: 'all', text: 'Todas as cartas', label: 'Todas as cartas' },
    { value: 'spares', text: 'Com repetidas', label: 'Com repetidas' },
  ];
  const cardSortOptions = [
    { value: 'number', label: 'Nº do álbum' },
    { value: 'name', label: 'Nome' },
    { value: 'level', label: 'Nível' },
    { value: 'spares', label: 'Repetidas' },
    { value: 'rarity', label: 'Raridade' },
  ] as const;
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
  const selectedPresentation = (item: ShowcaseItem) => {
    if (item.type === 'achievement') {
      const state = payload.achievements.find(entry => entry.id === item.id);
      const tier = state ? tierForLevel(state.level) : null;
      return {
        kind: 'CONQUISTA',
        label: selectedLabel(item),
        detail: tier ? ACHIEVEMENT_TIER_LABELS[tier] : 'Conquista desbloqueada',
        Icon: ACHIEVEMENT_ICONS[item.id] ?? Trophy,
        color: state ? achievementLevelColor(state.level) : 'var(--ui-brand-strong)',
      };
    }
    if (item.type === 'card') {
      const player = albumCard(item.cardId);
      const level = item.albumLevel ?? 1;
      return {
        kind: 'CARTA DO ÁLBUM',
        label: player?.shortName ?? 'Carta do álbum',
        detail: `${player?.club ?? 'Álbum'} · Nível do Álbum ${level}/5`,
        Icon: BookOpen,
        color: player ? getRarityColor(player.rarity) : 'var(--ui-brand-strong)',
      };
    }
    const record = findRecord(records, item);
    const meta = RECORD_META[item.category] ?? RECORD_META.goals;
    return {
      kind: 'RECORDE',
      label: selectedLabel(item),
      detail: record ? `${record.value.toLocaleString('pt-BR')} ${meta.suffix} · ${seasonLabel(record.season ?? seasonAt(record.completed_at))}` : difficultyName(item.difficultyId),
      Icon: meta.icon,
      color: isRankedDifficulty(item.difficultyId) ? getRarityColor(item.difficultyId as Rarity) : 'var(--ui-brand-strong)',
    };
  };
  const moveSelected = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= selected.length) return;
    setSelected(current => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
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
        <section aria-label="Destaques escolhidos" className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-[var(--ui-text)]">Destaques escolhidos</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Eles aparecem no mural nesta ordem. Use as setas para organizar.</p>
            </div>
            <span className="shrink-0 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] px-2.5 py-1.5 text-xs font-black tabular-nums text-[var(--ui-text-soft)]">{selected.length}<span className="mx-1 text-[var(--ui-text-faint)]">/</span>{SHOWCASE_MAX_ITEMS}</span>
          </div>
          {selected.length > 0 ? <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {selected.map((item, index) => {
              const presentation = selectedPresentation(item);
              const ItemIcon = presentation.Icon;
              return (
                <li key={showcaseKey(item)} className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-3 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3 sm:p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border text-xs font-black tabular-nums" style={{ borderColor: `color-mix(in srgb, ${presentation.color} 40%, var(--ui-line-subtle))`, color: presentation.color, background: `color-mix(in srgb, ${presentation.color} 10%, transparent)` }}>{index + 1}</span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-surface-2)]" style={{ color: presentation.color }}><ItemIcon size={17} aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block text-micro font-black uppercase text-[var(--ui-text-faint)]">{presentation.kind}</span>
                    <strong className="block whitespace-normal break-words text-sm leading-snug text-[var(--ui-text)]">{presentation.label}</strong>
                    <span className="mt-0.5 block whitespace-normal break-words text-xs leading-snug text-[var(--ui-text-muted)]">{presentation.detail}</span>
                  </span>
                  <span className="col-span-3 flex min-w-0 items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-2.5">
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button type="button" aria-label={`Mover ${selectedLabel(item)} para cima`} title="Mover para cima" disabled={saving || index === 0} onClick={() => moveSelected(index, -1)} className="flex size-9 items-center justify-center rounded-md border border-[var(--ui-line-subtle)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-30"><ChevronUp size={16} aria-hidden="true" /></button>
                      <button type="button" aria-label={`Mover ${selectedLabel(item)} para baixo`} title="Mover para baixo" disabled={saving || index === selected.length - 1} onClick={() => moveSelected(index, 1)} className="flex size-9 items-center justify-center rounded-md border border-[var(--ui-line-subtle)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-30"><ChevronDown size={16} aria-hidden="true" /></button>
                    </span>
                    <button type="button" aria-label={`Remover ${selectedLabel(item)} do mural`} title="Remover do mural" disabled={saving} onClick={() => toggle(item)} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--ui-line-subtle)] px-3 text-xs font-bold text-[var(--ui-text-muted)] hover:border-[var(--ui-danger)]/40 hover:bg-[var(--ui-danger)]/10 hover:text-[var(--ui-danger)] disabled:opacity-40"><X size={14} aria-hidden="true" /> Remover</button>
                  </span>
                </li>
              );
            })}
          </ol> : <div className="mt-3 rounded-lg border border-dashed border-[var(--ui-line-subtle)] px-3 py-3 text-center"><p className="text-xs font-semibold text-[var(--ui-text-soft)]">Nenhum destaque escolhido</p><p className="mt-1 text-caption text-[var(--ui-text-faint)]">Seu mural continuará automático. Escolha itens abaixo para personalizá-lo.</p></div>}
        </section>
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
                    <span className="block truncate text-caption text-[var(--ui-text-muted)]">{record.player_name}</span>
                  </span>
                </>
              ), () => toggle({ type: 'record', difficultyId: record.difficulty_id, category }));
            })}
        </TabPanel>
        <TabPanel value="cards" className="space-y-3 pt-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="ui-kicker">Cartas do seu Álbum</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Escolha cartas que você já conquistou.</p>
            </div>
            <span className="rounded-md bg-[var(--ui-surface-2)] px-2 py-1 text-caption font-bold tabular-nums text-[var(--ui-text-soft)]">{shownAlbumCards.length} de {ownedAlbumCards.length}</span>
          </div>
          <AlbumFilterToolbar
            className="mb-2"
            search={cardSearch}
            onSearchChange={setCardSearch}
            searchLabel="Buscar cartas do Álbum"
            placeholder="Jogador, clube, nº, posição ou nível"
            sortLabel="minhas cartas"
            sortValue={cardSort}
            onSortChange={value => setCardSort(value as ShowcaseCardSort)}
            sortOptions={cardSortOptions}
            direction={cardDirection}
            onDirectionChange={() => setCardDirection(value => value === 'asc' ? 'desc' : 'asc')}
            hasActiveFilters={cardSearch.trim() !== '' || cardSort !== 'rarity' || cardDirection !== 'desc' || cardRarity !== 'all' || cardPositionGroup !== 'all' || cardLevel !== 'all' || cardCopies !== 'all'}
            onClear={() => {
              setCardSearch('');
              setCardSort('rarity');
              setCardDirection('desc');
              setCardRarity('all');
              setCardPositionGroup('all');
              setCardLevel('all');
              setCardCopies('all');
            }}
            extraFilters={(
              <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4">
                <SelectMenu label="Filtrar por raridade" value={cardRarity} onChange={setCardRarity} appearance="neutral" className="w-full min-w-0" buttonClassName="w-full justify-between" options={cardRarityOptions} />
                <SelectMenu label="Filtrar por posição" value={cardPositionGroup} onChange={setCardPositionGroup} appearance="neutral" className="w-full min-w-0" buttonClassName="w-full justify-between" options={cardPositionOptions} />
                <SelectMenu label="Filtrar por nível do Álbum" value={cardLevel} onChange={setCardLevel} appearance="neutral" className="w-full min-w-0" buttonClassName="w-full justify-between" options={cardLevelOptions} />
                <SelectMenu label="Filtrar por cópias repetidas" value={cardCopies} onChange={setCardCopies} appearance="neutral" className="w-full min-w-0" buttonClassName="w-full justify-between" options={cardCopiesOptions} />
              </div>
            )}
          />
          {ownedAlbumCards.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--ui-line-subtle)] p-5 text-center"><p className="text-sm font-semibold text-[var(--ui-text)]">Seu Álbum ainda está vazio</p><p className="mt-1 text-xs text-[var(--ui-text-muted)]">As cartas que você coletar aparecerão aqui.</p></div>
            : shownAlbumCards.length === 0 ? <p className="rounded-lg bg-[var(--ui-surface-inset)] p-3 text-center text-xs text-[var(--ui-text-muted)]">Nenhuma carta encontrada com esses filtros.</p>
              : <div className="grid max-h-[min(55vh,520px)] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {shownAlbumCards.map(({ id, player, number, level, spares }) => option(`c:${id}`, (
                  <>
                    <span className="shrink-0"><PlayerCard player={player} lite flat scale={0.3} albumLevel={level as AlbumLevel} /></span>
                    <span className="min-w-0 flex-1 self-center py-1">
                      <strong className="block whitespace-normal break-words text-sm font-black leading-snug text-[var(--ui-text)]">{player.shortName}</strong>
                      <span className="mt-0.5 block whitespace-normal break-words text-xs leading-snug text-[var(--ui-text-muted)]">{player.club}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md px-1.5 py-0.5 text-micro font-black uppercase" style={{ color: getRarityColor(player.rarity), background: `color-mix(in srgb, ${getRarityColor(player.rarity)} 12%, transparent)` }}>{RARITY_LABEL[player.rarity]}</span>
                        <span className="rounded-md bg-[var(--ui-surface-2)] px-1.5 py-0.5 text-micro font-semibold text-[var(--ui-text-soft)]">Nº {number} · {POS_PT[player.position] ?? player.position}</span>
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption font-semibold text-[var(--ui-text-soft)]">
                        <span className="inline-flex flex-wrap items-center gap-1"><LevelStars level={Math.max(1, level)} size={11} /><span>Nível do Álbum {level}/5</span></span>
                        {spares > 0 ? <span className="rounded-md bg-[var(--ui-surface-2)] px-1.5 py-0.5 text-micro text-[var(--ui-text-muted)]">+{spares} repetidas</span> : null}
                      </span>
                    </span>
                  </>
                ), () => toggle({ type: 'card', cardId: id, albumLevel: Math.max(1, level) as AlbumLevel }))) }
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
                    <span className="mt-0.5 flex items-center gap-1 text-caption font-semibold text-[var(--ui-brand-strong)]"><Package size={12} aria-hidden="true" /> Recompensa: Pacote {ACHIEVEMENT_TIER_LABELS[tier]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </GameModal>
    </>
  );
}
