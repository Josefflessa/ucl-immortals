// UCL Immortals — achievements and the profile showcase (mural).
// Pure presentation: every value comes from the server payload.

import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity, Award, BadgeCheck, BrickWall, CalendarCheck, CalendarDays, Castle, ChartColumnIncreasing, Check, ChevronsUp,
  CircleCheck, ClipboardList, Compass, Crown, Flag, Flame, Gamepad2, Gem, Globe, Goal, Hand, Handshake, Heart, HeartHandshake,
  Lock, Medal, Mountain, Pencil, Repeat, Shield, ShieldCheck, ShieldPlus, Shirt, Skull, Sparkles, Star, Sword, Swords,
  Target, Timer, TrendingUp, Trophy, Users, Wifi, Zap, type LucideIcon,
} from 'lucide-react';
import {
  ACHIEVEMENT_BY_ID,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_TIER_LABELS,
  ACHIEVEMENTS,
  achievementGoalText,
  rarityLabel,
  showcaseKey,
  SHOWCASE_MAX_ITEMS,
  tierForLevel,
  type AchievementCategory,
  type RecordCategory,
  type ShowcaseItem,
} from '@shared/game/achievements';
import { COACHES, DIFFICULTY_LEVELS, getRarityColor, type Rarity } from '@shared/game/gameData';
import DifficultyEmblem from '../game/DifficultyEmblem';
import { getCrest } from '@shared/game/crests';
import { isRankedDifficulty, RANKED_DIFFICULTY_IDS } from '@shared/game/competitionRanking';
import type { AchievementRarity, AchievementState, AchievementsPayload, ProfileRecordEntry } from '../../contexts/AccountContext';
import { Button, GameModal, SectionHeader, StatusBanner } from '../../design-system';
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
 * icon in its central disc. Locked achievements show a dimmed, grey medal.
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
        size={Math.round(size * 0.34)}
        strokeWidth={2.3}
        className="relative"
        style={{
          color: locked ? LOCKED_COLOR : `color-mix(in srgb, ${color} 60%, white)`,
          filter: locked ? undefined : `drop-shadow(0 0 ${Math.max(2, Math.round(size / 16))}px color-mix(in srgb, ${color} 70%, transparent))`,
        }}
      />
      {locked ? (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]">
          <Lock size={11} className="text-[var(--ui-text-faint)]" />
        </span>
      ) : null}
    </span>
  );
}

function rarityLine(state: AchievementState, rarity: AchievementRarity): string | null {
  if (rarity.players === 0) return null;
  const percents = rarity.percentByAchievement[state.id];
  if (!percents) return null;
  if (state.level === 0) return `${formatPercent(percents[0])} dos jogadores têm o Bronze`;
  const percent = percents[state.level - 1];
  return `${rarityLabel(percent)} · ${formatPercent(percent)} dos jogadores`;
}

/** Full achievement card: level, next goal with progress, and rarity. */
export function AchievementTile({ state, rarity, className }: { state: AchievementState; rarity: AchievementRarity; className?: string }) {
  const definition = ACHIEVEMENT_BY_ID.get(state.id);
  if (!definition) return null;
  const tier = tierForLevel(state.level);
  const color = achievementLevelColor(state.level);
  const maxed = state.level >= 4;
  const nextThreshold: number = definition.thresholds[Math.min(state.level, 3)];
  const previousThreshold: number = state.level === 0 ? 0 : definition.thresholds[Math.min(state.level - 1, 3)];
  const ratio = maxed ? 1 : Math.max(0, Math.min(1, (state.progress - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)));
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
            style={{ color: tier ? color : 'var(--ui-text-faint)', background: tier ? `color-mix(in srgb, ${color} 14%, transparent)` : 'var(--ui-surface)' }}
          >
            {tier ? ACHIEVEMENT_TIER_LABELS[tier] : 'Bloqueada'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-snug text-[var(--ui-text-muted)]">
          {maxed ? `Nível máximo · ${achievementGoalText(definition, 3)}` : achievementGoalText(definition, state.level)}
        </p>
        {!maxed ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--ui-surface)]" role="progressbar" aria-valuemin={0} aria-valuemax={nextThreshold} aria-valuenow={Math.min(state.progress, nextThreshold)}>
              <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: state.level > 0 ? color : 'var(--ui-text-faint)' }} />
            </div>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-[var(--ui-text-soft)]">
              {Math.min(state.progress, nextThreshold).toLocaleString('pt-BR')}/{nextThreshold.toLocaleString('pt-BR')}
            </span>
          </div>
        ) : null}
        {detail ? <p className="mt-1 truncate text-[11px] font-bold text-[var(--ui-text-soft)]">{detail}</p> : null}
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
      {percent !== undefined ? <span className="text-[11px] leading-tight text-[var(--ui-text-faint)]">{rarityLabel(percent)} · {formatPercent(percent)}</span> : null}
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
    </article>
  );
}

function findRecord(records: ProfileRecordEntry[], item: ShowcaseItem & { type: 'record' }) {
  return records.find(record => record.difficulty_id === item.difficultyId && record.category === item.category);
}

/** The mural: the player's chosen highlights (or an automatic pick). */
export function ShowcaseSection({ payload, records, onEdit, emptyText }: {
  payload: AchievementsPayload;
  records: ProfileRecordEntry[];
  onEdit?: () => void;
  emptyText: string;
}) {
  const states = new Map(payload.achievements.map(state => [state.id, state]));
  const tiles = payload.showcase.items.flatMap<ReactNode>(item => {
    if (item.type === 'achievement') {
      const state = states.get(item.id);
      return state && state.level > 0 ? [<AchievementShowcaseTile key={showcaseKey(item)} state={state} rarity={payload.rarity} />] : [];
    }
    const record = findRecord(records, item);
    return record ? [<RecordShowcaseTile key={showcaseKey(item)} record={record} />] : [];
  });
  return (
    <section aria-label="Mural" className="space-y-3">
      <SectionHeader
        title="Mural"
        className="mb-0"
        actions={onEdit ? (
          <Button type="button" intent="ghost" onClick={onEdit} className="min-h-9 gap-1.5 border border-[var(--ui-line-subtle)] px-3 text-xs">
            <Pencil size={14} aria-hidden="true" /> EDITAR
          </Button>
        ) : undefined}
      />
      <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">
        {payload.showcase.automatic ? 'Destaques escolhidos automaticamente entre as conquistas e recordes.' : 'Conquistas e recordes em destaque.'}
      </p>
      {tiles.length > 0
        ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{tiles}</div>
        : <div className="rounded-xl border border-dashed border-[var(--ui-line-strong)] p-4 text-center text-xs text-[var(--ui-text-muted)]">{emptyText}</div>}
    </section>
  );
}

const CATEGORY_ORDER: AchievementCategory[] = ['titles', 'campaign', 'career', 'difficulty', 'online'];

/** Every achievement, grouped by category, with progress and rarity. */
export function AchievementsSection({ payload, heading = true }: { payload: AchievementsPayload; heading?: boolean }) {
  const states = new Map(payload.achievements.map(state => [state.id, state]));
  const unlocked = payload.achievements.filter(state => state.level > 0).length;
  return (
    <section aria-label="Conquistas" className="space-y-3">
      {heading ? <>
        <SectionHeader
          title="Conquistas"
          className="mb-0"
          actions={<span className="font-display text-2xl tabular-nums text-[var(--ui-brand-strong)]">{unlocked}<span className="text-base text-[var(--ui-text-muted)]">/{ACHIEVEMENTS.length}</span></span>}
        />
        <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">Metas de carreira em 4 níveis: Bronze, Prata, Ouro e Lendário. A porcentagem mostra quantos jogadores já chegaram lá.</p>
      </> : null}
      {CATEGORY_ORDER.map(category => {
        const list = ACHIEVEMENTS.filter(definition => definition.category === category)
          .map(definition => states.get(definition.id))
          .filter((state): state is AchievementState => !!state)
          .sort((a, b) => b.level - a.level);
        return (
          <div key={category} className="space-y-2">
            <div className="ui-kicker">{ACHIEVEMENT_CATEGORY_LABELS[category]}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map(state => <AchievementTile key={state.id} state={state} rarity={payload.rarity} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Lets the owner pick up to SHOWCASE_MAX_ITEMS unlocked achievements and records, in order. */
export function ShowcaseEditor({ open, onOpenChange, payload, records, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: AchievementsPayload;
  records: ProfileRecordEntry[];
  onSave: (items: ShowcaseItem[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<ShowcaseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setSelected(payload.showcase.automatic ? [] : payload.showcase.items);
    setError('');
  }, [open, payload.showcase]);

  const unlocked = payload.achievements.filter(state => state.level > 0).sort((a, b) => b.level - a.level);
  const ownedRecords = [...RANKED_DIFFICULTY_IDS].reverse().flatMap(difficultyId =>
    records.filter(record => record.difficulty_id === difficultyId));
  const selectedKeys = selected.map(showcaseKey);
  const toggle = (item: ShowcaseItem) => {
    const key = showcaseKey(item);
    setSelected(current => current.some(entry => showcaseKey(entry) === key)
      ? current.filter(entry => showcaseKey(entry) !== key)
      : current.length >= SHOWCASE_MAX_ITEMS ? current : [...current, item]);
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
      subtitle={`Escolha até ${SHOWCASE_MAX_ITEMS} destaques, na ordem em que devem aparecer (${selected.length}/${SHOWCASE_MAX_ITEMS}).`}
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
        <div className="space-y-2">
          <div className="ui-kicker">Conquistas desbloqueadas</div>
          {unlocked.length === 0
            ? <p className="text-xs text-[var(--ui-text-muted)]">Você ainda não desbloqueou conquistas.</p>
            : unlocked.map(state => {
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
        </div>
        <div className="space-y-2">
          <div className="ui-kicker">Recordes</div>
          {ownedRecords.length === 0
            ? <p className="text-xs text-[var(--ui-text-muted)]">Seus recordes aparecem aqui quando você concluir competições.</p>
            : ownedRecords.map(record => {
              const category = record.category as RecordCategory;
              const meta = RECORD_META[category] ?? RECORD_META.goals;
              const Icon = meta.icon;
              const color = isRankedDifficulty(record.difficulty_id) ? getRarityColor(record.difficulty_id as Rarity) : 'var(--ui-brand-strong)';
              return option(`r:${record.difficulty_id}:${record.category}`, (
                <>
                  <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border-2" style={{ borderColor: color }}><Icon size={18} style={{ color }} /><DifficultyEmblem difficulty={record.difficulty_id} size={22} className="absolute -bottom-2 -right-2" /></span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-[var(--ui-text)]">{meta.label}: {record.value.toLocaleString('pt-BR')} {meta.suffix}</strong>
                    <span className="block truncate text-xs" style={{ color }}>{difficultyName(record.difficulty_id)} · {record.player_name}</span>
                  </span>
                </>
              ), () => toggle({ type: 'record', difficultyId: record.difficulty_id, category }));
            })}
        </div>
      </div>
    </GameModal>
  );
}

/** "Conquista desbloqueada" list for the end-of-competition report. */
export function UnlockedAchievements({ unlocks }: { unlocks: Array<{ id: string; level: number }> }) {
  if (unlocks.length === 0) return null;
  return (
    <section aria-label="Conquistas desbloqueadas" className="space-y-2">
      <div className="ui-kicker">{unlocks.length === 1 ? 'Conquista desbloqueada' : 'Conquistas desbloqueadas'}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {unlocks.map(unlock => {
          const definition = ACHIEVEMENT_BY_ID.get(unlock.id);
          const tier = tierForLevel(unlock.level);
          if (!definition || !tier) return null;
          return (
            <div key={unlock.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: achievementLevelColor(unlock.level), background: `color-mix(in srgb, ${achievementLevelColor(unlock.level)} 10%, transparent)` }}>
              <AchievementMedal id={unlock.id} level={unlock.level} size={52} />
              <div className="min-w-0">
                <strong className="block text-sm text-[var(--ui-text)]">{definition.name}</strong>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: achievementLevelColor(unlock.level) }}>Nível {ACHIEVEMENT_TIER_LABELS[tier]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
