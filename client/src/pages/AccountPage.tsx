import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Crown, Eye, EyeOff, Image as ImageIcon, Info, LogIn, Pencil, Search, Shield, Sparkles, Trophy, UserPlus, UserRound, Users, X } from 'lucide-react';
import { useAccount, type AccountStats, type CompetitionHistoryEntry, type FriendshipEntry, type ProfileRecordEntry, type PublicProfileData, type PublicRecordEntry, type RecordCardEffectiveStats, type ScoreLeaderboardEntry, type ScoreLeaderboardPosition } from '../contexts/AccountContext';
import { useGame, type AccountSection } from '../contexts/GameContext';
import AccountTabBar from '../components/account/AccountTabBar';
import Crest from '../components/game/Crest';
import PlayerAvatar from '../components/game/PlayerAvatar';
import PlayerCard from '../components/game/PlayerCard';
import { normalizeProfileAvatarKey, PROFILE_AVATARS, resolveProfileAvatarImage } from '../lib/profileAvatars';
import { getProfileCover, PROFILE_COVER_PRESETS } from '../lib/profileCovers';
import { DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY, getProfileAvatarBackground, normalizeProfileAvatarBackgroundKey, PROFILE_AVATAR_BACKGROUNDS } from '@shared/profileAppearance';
import { COMPETITION_RANKING_POINTS } from '@shared/game/competitionRanking';
import ReportPage from './ReportPage';
import { cn } from '../lib/utils';
import {
  AppShell,
  Badge,
  Button,
  EmptyState,
  GameModal,
  Input,
  Metric,
  PageContainer,
  Panel,
  PanelBody,
  SectionHeader,
  Skeleton,
  StatusBanner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TopBar,
} from '../design-system';

const AVATARS_PER_PAGE = 12;
const RECORD_LABELS: Record<PublicRecordEntry['category'], { label: string; description: string; icon: typeof Trophy; suffix: string }> = {
  goals: { label: 'Mais gols', description: 'Mais gols marcados por um jogador em uma competição.', icon: Trophy, suffix: 'gols' },
  assists: { label: 'Mais assistências', description: 'Mais assistências dadas por um jogador em uma competição.', icon: Sparkles, suffix: 'assist.' },
  saves: { label: 'Mais defesas', description: 'Mais defesas feitas por um goleiro em uma competição.', icon: Shield, suffix: 'defesas' },
  effective_overall: { label: 'Maior geral efetivo', description: 'Maior geral efetivo de um jogador ao fim de uma competição.', icon: Crown, suffix: 'GERAL' },
};
const RECORD_CATEGORY_ORDER: PublicRecordEntry['category'][] = ['goals', 'assists', 'saves', 'effective_overall'];
const RANKING_TAB_LABELS: Record<RankingTab, string> = {
  overall: 'RANKING GERAL',
  records: 'RECORDES',
};
const RECORD_RANKING_TAB_LABELS: Record<PublicRecordEntry['category'], string> = {
  goals: 'GOLS',
  assists: 'ASSISTÊNCIAS',
  saves: 'DEFESAS',
  effective_overall: 'GERAL EFETIVO',
};
const RECORD_RANKING_TAB_COMPACT_LABELS: Record<PublicRecordEntry['category'], string> = {
  goals: 'GOLS',
  assists: 'ASSIST.',
  saves: 'DEFESAS',
  effective_overall: 'GERAL',
};
const POINT_TIER_LABELS = [
  { label: 'Campeão', points: COMPETITION_RANKING_POINTS.champion },
  { label: 'Vice', points: COMPETITION_RANKING_POINTS.runnerUp },
  { label: 'Semifinal', points: COMPETITION_RANKING_POINTS.semifinalist },
  { label: 'Quartas', points: COMPETITION_RANKING_POINTS.quarterfinalist },
  { label: 'Oitavas', points: COMPETITION_RANKING_POINTS.roundOf16 },
  { label: 'Playoff', points: COMPETITION_RANKING_POINTS.playoff },
  { label: 'Fase de liga', points: COMPETITION_RANKING_POINTS.leaguePhase },
];
const HISTORY_FINISH_LABELS: Record<number, string> = {
  [COMPETITION_RANKING_POINTS.champion]: 'Campeão',
  [COMPETITION_RANKING_POINTS.runnerUp]: 'Vice-campeão',
  [COMPETITION_RANKING_POINTS.semifinalist]: 'Encerrou na semifinal',
  [COMPETITION_RANKING_POINTS.quarterfinalist]: 'Encerrou nas quartas de final',
  [COMPETITION_RANKING_POINTS.roundOf16]: 'Encerrou nas oitavas de final',
  [COMPETITION_RANKING_POINTS.playoff]: 'Encerrou no playoff',
  [COMPETITION_RANKING_POINTS.leaguePhase]: 'Encerrou na fase de liga',
};
type RankingTab = 'overall' | 'records';
type FriendsTab = 'friends' | 'incoming' | 'outgoing';

const FRIEND_ERROR_MESSAGES: Record<string, string> = {
  invalid_friend: 'Confira o nome de usuário. Você só pode adicionar outra pessoa.',
  invalid_friend_username: 'Esse nome de usuário não é válido. Confira se digitou o @ corretamente.',
  cannot_add_self: 'Esse é o seu próprio usuário. Digite o @ de outra pessoa para adicioná-la.',
  user_not_found: 'Não encontramos esse usuário. Confira o @ e tente novamente.',
  already_friends: 'Vocês já estão na sua lista de amigos.',
  friendship_not_found: 'Essa solicitação não está mais disponível. Atualize a lista e tente novamente.',
  invalid_friend_action: 'Não foi possível atualizar essa amizade. Atualize a lista e tente novamente.',
};

function friendErrorMessage(error: unknown, fallback: string): string {
  const code = error instanceof Error ? error.message : '';
  return FRIEND_ERROR_MESSAGES[code] ?? fallback;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

function profileCoverStyle(coverKey: string, coverUrl?: string | null) {
  const imageUrl = coverUrl ?? getProfileCover(coverKey).src;
  const safeImageUrl = imageUrl.replace(/["\\\n\r]/g, character => `\\${character}`);
  return {
    backgroundImage: `linear-gradient(180deg, rgba(7,9,16,.14) 0%, rgba(7,9,16,.48) 46%, rgba(7,9,16,.9) 100%), linear-gradient(90deg, rgba(7,9,16,.58), rgba(7,9,16,.18)), url("${safeImageUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundOrigin: 'border-box',
    backgroundClip: 'border-box',
  } as const;
}

function profileAvatar(avatarUrl: string | null, avatarKey: string, name: string, backgroundKey: string, size = 'size-24') {
  const characterImage = resolveProfileAvatarImage(avatarKey);
  const image = avatarUrl ?? characterImage;
  return (
    <div
      role="img"
      aria-label={`Foto de ${name}`}
      className={cn(size, 'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--ui-brand)]/60 text-3xl font-black text-[var(--ui-text)]')}
      style={{ backgroundColor: getProfileAvatarBackground(backgroundKey).color }}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {image ? <img src={image} alt="" className={cn('absolute inset-0 size-full', avatarUrl ? 'object-cover' : 'object-contain')} onError={event => { event.currentTarget.style.display = 'none'; }} /> : null}
    </div>
  );
}

function GalleryPagination({ page, pageCount, label, onPageChange }: { page: number; pageCount: number; label: string; onPageChange: (page: number) => void }) {
  if (pageCount < 2) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-3">
      <Button type="button" intent="ghost" aria-label="Página anterior" disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))} className="size-9 min-h-9 px-0">
        <ChevronLeft size={17} aria-hidden="true" />
      </Button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: pageCount }, (_, index) => <Button
          type="button"
          key={index}
          intent="ghost"
          aria-label={`Página ${index + 1}`}
          aria-current={page === index ? 'page' : undefined}
          onClick={() => onPageChange(index)}
          className={cn('size-9 min-h-9 px-0 text-xs tabular-nums', page === index && 'border border-[var(--ui-brand)] text-[var(--ui-brand-strong)]')}
        >{index + 1}</Button>)}
      </div>
      <Button type="button" intent="ghost" aria-label="Próxima página" disabled={page === pageCount - 1} onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))} className="size-9 min-h-9 px-0">
        <ChevronRight size={17} aria-hidden="true" />
      </Button>
    </nav>
  );
}

function RecordPlayerCardVisual({ player, playerId, photoUrl, name, effectiveStats }: {
  player: PublicRecordEntry['player_card'];
  playerId: string;
  photoUrl: string | null;
  name: string;
  effectiveStats?: RecordCardEffectiveStats | null;
}) {
  return player ? <PlayerCard player={player} effectiveStats={effectiveStats ?? undefined} scale={0.55} lite /> : <div className="flex h-[178px] w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] p-2 text-center">
    <PlayerAvatar playerId={playerId} photoUrl={photoUrl ?? undefined} size={64} rounded="rounded-lg" ring={false} fallback={<Trophy size={20} aria-hidden="true" className="text-[var(--ui-text-muted)]" />} />
    <span className="text-[12px] font-semibold leading-tight text-[var(--ui-text-muted)]">Carta final indisponível</span>
    <span className="max-w-full truncate text-[11px] text-[var(--ui-text-faint)]">{name}</span>
  </div>;
}

function RecordCard({ record, rank }: { record: PublicRecordEntry; rank: number }) {
  const meta = RECORD_LABELS[record.category];
  const rankPosition = record.rank_position ?? rank;
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:gap-4 sm:p-4">
      <RecordPlayerCardVisual player={record.player_card} playerId={record.player_id} photoUrl={record.player_photo_url} name={record.player_name} effectiveStats={record.player_effective_stats} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div aria-label={`Posição ${rankPosition}`} className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border font-display text-lg tabular-nums', rankPosition === 1 ? 'border-[var(--ui-brand)]/45 bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)]' : 'border-[var(--ui-line-subtle)] text-[var(--ui-text-muted)]')}>{String(rankPosition).padStart(2, '0')}</div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm text-[var(--ui-text)]">{record.player_name}</strong>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <CompactProfileAvatar
                name={record.profile_display_name || record.username_snapshot}
                avatarKey={record.profile_avatar_key ?? ''}
                avatarUrl={record.profile_avatar_url}
                backgroundKey={record.profile_avatar_background_key ?? undefined}
                sizeClassName="size-9"
              />
              <div className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wider text-[var(--ui-text-faint)]">Recorde por</span>
                <span className="block truncate text-[13px] text-[var(--ui-text-muted)]">@{record.username_snapshot}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-2 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/70 px-2 py-1.5">
          <Crest crestId={record.crest_id_snapshot} name={record.team_name_snapshot} size={24} className="shrink-0 rounded-full" />
          <div className="min-w-0">
            <span className="block text-[11px] uppercase tracking-wider text-[var(--ui-text-faint)]">Time da campanha</span>
            <span className="block truncate text-xs font-semibold text-[var(--ui-text)]">{record.team_name_snapshot}</span>
          </div>
        </div>
        <div className="mt-2 flex min-w-0 items-end justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[11px] uppercase tracking-wider text-[var(--ui-text-faint)]">Data da campanha</span>
            <time className="block truncate text-xs text-[var(--ui-text-muted)]" dateTime={new Date(record.completed_at).toISOString()}>{formatDate(record.completed_at)}</time>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-xl leading-none tabular-nums text-[var(--ui-brand-strong)] sm:text-2xl">{record.value}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--ui-text-faint)]">{meta.suffix}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactProfileAvatar({ name, avatarKey, avatarUrl, backgroundKey = DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY, sizeClassName }: { name: string; avatarKey: string; avatarUrl?: string | null; backgroundKey?: string; sizeClassName?: string }) {
  const image = avatarUrl || resolveProfileAvatarImage(avatarKey);
  return (
    <div role="img" aria-label={`Foto de ${name}`} className={cn('relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ui-line-strong)] font-bold text-[var(--ui-text)]', sizeClassName)} style={{ backgroundColor: getProfileAvatarBackground(backgroundKey).color }}>
      <span aria-hidden="true">{initials(name)}</span>
      {image ? <img src={image} alt="" loading="lazy" className={cn('absolute inset-0 size-full', avatarUrl ? 'object-cover' : 'object-contain')} onError={event => { event.currentTarget.style.display = 'none'; }} /> : null}
    </div>
  );
}

function ScoreCard({ entry, rank }: { entry: ScoreLeaderboardEntry; rank: number }) {
  return (
    <article className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:gap-4 sm:p-4">
      <div aria-label={`Posição ${rank}`} className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg border font-display text-xl tabular-nums', rank === 1 ? 'border-[var(--ui-brand)]/45 bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)]' : 'border-[var(--ui-line-subtle)] text-[var(--ui-text-muted)]')}>{String(rank).padStart(2, '0')}</div>
      <CompactProfileAvatar name={entry.display_name} avatarKey={entry.avatar_key} avatarUrl={entry.avatar_url} backgroundKey={entry.avatar_background_key} sizeClassName="size-16" />
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-base font-bold text-[var(--ui-text)]">{entry.display_name}</strong>
        <div className="truncate text-xs text-[var(--ui-text-muted)]">@{entry.username}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-display text-2xl leading-none tabular-nums text-[var(--ui-brand-strong)]">{entry.points}</div>
        <div className="mt-1 text-[12px] uppercase tracking-wider text-[var(--ui-text-faint)]">pontos</div>
      </div>
    </article>
  );
}

function PersonalRecordCard({ category, record }: { category: PublicRecordEntry['category']; record: ProfileRecordEntry | undefined }) {
  const meta = RECORD_LABELS[category];
  const Icon = meta.icon;
  const rankPosition = record?.rank_position;
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:gap-4 sm:p-4">
      {record ? <RecordPlayerCardVisual player={record.player_card} playerId={record.player_id} photoUrl={record.player_photo_url} name={record.player_name} effectiveStats={record.player_effective_stats} /> : <div aria-hidden="true" className="flex h-[178px] w-[110px] shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--ui-line-strong)] bg-[var(--ui-surface)] text-[var(--ui-text-faint)]"><Icon size={24} /></div>}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--ui-brand)]/20 bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)]"><Icon size={15} aria-hidden="true" /></span>
            <strong className="min-w-0 text-sm leading-tight text-[var(--ui-text)]">{meta.label}</strong>
          </div>
          {record && rankPosition ? <div role="status" aria-label={`${rankPosition}ª posição no ranking geral de ${meta.label.toLowerCase()}`} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--ui-brand)]/30 bg-[var(--ui-brand-soft)] px-2 py-1 text-[var(--ui-brand-strong)]">
            <span className="font-display text-base leading-none tabular-nums">#{rankPosition}</span>
            <span className="text-[10px] uppercase leading-none tracking-wider">no geral</span>
          </div> : record ? <span className="shrink-0 rounded-lg border border-[var(--ui-line-subtle)] px-2 py-1 text-[11px] text-[var(--ui-text-faint)]">posição indisponível</span> : null}
        </div>
        {record ? <>
          <div className="mt-2 flex min-w-0 items-baseline justify-between gap-2">
            <strong className="min-w-0 truncate text-xs font-semibold text-[var(--ui-text-soft)]">{record.player_name}</strong>
            <div className="shrink-0 text-right">
              <strong className="font-display text-xl leading-none tabular-nums text-[var(--ui-brand-strong)]">{record.value.toLocaleString('pt-BR')}</strong>
              <span className="ml-1 text-[11px] uppercase tracking-wider text-[var(--ui-text-faint)]">{meta.suffix}</span>
            </div>
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/70 px-2 py-1.5">
            <Crest crestId={record.crest_id_snapshot} name={record.team_name_snapshot} size={24} className="shrink-0 rounded-full" />
            <div className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wider text-[var(--ui-text-faint)]">Time da campanha</span>
              <span className="block truncate text-xs font-semibold text-[var(--ui-text)]">{record.team_name_snapshot}</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="block text-[11px] uppercase tracking-wider text-[var(--ui-text-faint)]">Data da campanha</span>
            <time className="block text-xs text-[var(--ui-text-muted)]" dateTime={new Date(record.completed_at).toISOString()}>{formatDate(record.completed_at)}</time>
          </div>
        </> : <span className="mt-2 block text-xs text-[var(--ui-text-muted)]">Ainda sem marca registrada</span>}
      </div>
    </article>
  );
}

function ProfileCareerContent({
  scorePosition,
  scorePositionLoading = false,
  competitionsCompleted,
  finishCounts,
  records,
  recordsLoading = false,
  recordsError = '',
  recordsErrorTitle = 'Não foi possível carregar seus recordes',
}: {
  scorePosition: ScoreLeaderboardPosition | null;
  scorePositionLoading?: boolean;
  competitionsCompleted: number;
  finishCounts: AccountStats['finishCounts'];
  records: ProfileRecordEntry[];
  recordsLoading?: boolean;
  recordsError?: string;
  recordsErrorTitle?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {scorePositionLoading ? <div className="space-y-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-36" /></div>
          : <Metric
            label="Ranking geral"
            value={scorePosition?.position ? `#${scorePosition.position}` : '—'}
            detail={!scorePosition
              ? 'Posição indisponível no momento'
              : scorePosition.status === 'ranked'
                ? `${scorePosition.points.toLocaleString('pt-BR')} pontos`
                : scorePosition.status === 'profile_not_public'
                  ? 'Perfil fora do ranking público'
                  : 'Sem pontuação ainda'}
            tone="brand"
          />}
        <Metric label="Competições" value={competitionsCompleted} detail="concluídas no total" />
      </div>
      <CareerFinishBreakdown counts={finishCounts} />
      <section aria-label="Recordes pessoais" className="space-y-3">
        <SectionHeader title="Recordes pessoais" className="mb-0" />
        <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">Melhores marcas e posições no ranking.</p>
        {recordsError ? <StatusBanner tone="danger" title={recordsErrorTitle}>{recordsError}</StatusBanner>
          : recordsLoading
            ? <div className="grid grid-cols-1 gap-3" aria-label="Carregando recordes pessoais">{RECORD_CATEGORY_ORDER.map(category => <Skeleton key={category} className="h-[210px] w-full rounded-xl" />)}</div>
            : <div className="grid grid-cols-1 gap-3">{RECORD_CATEGORY_ORDER.map(category => <PersonalRecordCard key={category} category={category} record={records.find(record => record.category === category)} />)}</div>}
      </section>
    </div>
  );
}

function FriendProfileView({ data }: { data: PublicProfileData }) {
  const { profile, records } = data;
  const coverStyle = profileCoverStyle(profile.coverKey, profile.coverUrl);

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)]" aria-label={`Perfil de ${profile.displayName}`} style={coverStyle}>
        <div aria-hidden="true" className="relative h-36 sm:h-44" />
        <div className="relative -mt-12 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-8 sm:pb-8">
          <div className="shrink-0">{profileAvatar(profile.avatarUrl, profile.avatarKey, profile.displayName, profile.avatarBackgroundKey)}</div>
          <div className="min-w-0 flex-1 pb-1">
            <h2 className="truncate font-display text-3xl text-[var(--ui-text)]">{profile.displayName}</h2>
            <p className="mt-1 truncate text-sm text-[var(--ui-text-muted)]">@{profile.username} · conta criada em {formatDate(profile.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2 pb-1 text-xs text-[var(--ui-text-faint)]"><Users size={14} aria-hidden="true" /> {data.friendCount} amigos</div>
        </div>
      </section>

      <ProfileCareerContent
        scorePosition={data.scorePosition}
        competitionsCompleted={profile.stats.competitionsCompleted}
        finishCounts={profile.stats.finishCounts}
        records={records}
      />
    </div>
  );
}

function reportNumber(report: Record<string, unknown>, key: string): number | null {
  const value = report[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function HistoryCard({ entry, onView }: { entry: CompetitionHistoryEntry; onView: (entry: CompetitionHistoryEntry) => void }) {
  const report = entry.report ?? {};
  const competitionPoints = entry.competition_points ?? reportNumber(report, 'competitionPoints');
  const champion = Boolean(entry.champion) || competitionPoints === COMPETITION_RANKING_POINTS.champion;
  const hasFinishStage = champion || (competitionPoints !== null && HISTORY_FINISH_LABELS[competitionPoints] !== undefined);
  const summaryOnly = report.snapshotArchived === true;
  const finishLabel = champion
    ? 'Campeão'
    : HISTORY_FINISH_LABELS[competitionPoints ?? -1]
      ?? (entry.mode === 'online' && entry.placement ? `${entry.placement}º na liga` : entry.placement ? `Terminou em ${entry.placement}º lugar` : 'Campanha concluída');
  const title = `Ver resultado final: ${entry.team_name}, ${finishLabel}, ${formatDate(entry.completed_at)}`;

  return (
    <Panel density="compact" className="overflow-hidden p-0 transition-colors hover:border-[var(--ui-line-strong)]">
      <PanelBody className="p-0">
        <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <Button
            type="button"
            intent="ghost"
            aria-label={title}
            onClick={() => onView(entry)}
            className="group h-auto min-h-0 min-w-0 flex-1 justify-start whitespace-normal rounded-lg border-0 bg-transparent p-0 text-left normal-case font-normal tracking-normal hover:translate-y-0 hover:border-transparent hover:bg-transparent"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <span className="grid size-[68px] shrink-0 place-items-center rounded-2xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] shadow-sm">
                <Crest crestId={entry.crest_id} name={entry.team_name} size={64} className="rounded-full p-1" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-start gap-2">
                  <span className="min-w-0 truncate font-display text-xl font-bold leading-tight text-[var(--ui-text)] sm:text-2xl">{entry.team_name}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <Badge tone={champion ? 'brand' : 'default'} className="px-2 py-1 text-[12px]">{finishLabel}</Badge>
                  {summaryOnly ? <Badge className="px-2 py-1 text-[12px]">RESUMO</Badge> : null}
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-[var(--ui-text-muted)]">
                    <CalendarDays size={13} aria-hidden="true" />
                    {formatDate(entry.completed_at)}
                  </span>
                </span>
                {entry.mode === 'online' && hasFinishStage && entry.placement ? (
                  <span className="mt-2 block border-t border-[var(--ui-line-subtle)] pt-2 text-xs text-[var(--ui-text-muted)]">Classificação na liga: <strong className="text-[var(--ui-text)]">{entry.placement}º lugar</strong></span>
                ) : null}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="shrink-0 self-center text-[var(--ui-text-faint)] transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

function friendIdentity(friend: FriendshipEntry, accountId: string) {
  return friend.requester_id === accountId
    ? { name: friend.addressee_display_name, username: friend.addressee_username, avatarKey: friend.addressee_avatar_key, avatarBackgroundKey: friend.addressee_avatar_background_key }
    : { name: friend.requester_display_name, username: friend.requester_username, avatarKey: friend.requester_avatar_key, avatarBackgroundKey: friend.requester_avatar_background_key };
}

function CareerFinishBreakdown({ counts }: { counts: AccountStats['finishCounts'] }) {
  const finishes = [
    { label: 'Vice-campeão', value: counts.runnerUp },
    { label: 'Semifinal', value: counts.semifinal },
    { label: 'Quartas de final', value: counts.quarterfinal },
    { label: 'Oitavas de final', value: counts.roundOf16 },
    { label: 'Playoff', value: counts.playoff },
    { label: 'Fase de liga', value: counts.leaguePhase },
  ];

  return (
    <section aria-label="Competições por fase" className="space-y-3">
      <SectionHeader title="Competições por fase" className="mb-0" />
      <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">Quantidade de competições encerradas em cada fase.</p>
      <div className="space-y-2">
        <Metric label="Campeão" value={counts.champion} tone="brand" className="p-3" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {finishes.map(finish => <Metric key={finish.label} label={finish.label} value={finish.value} className="p-3" />)}
        </div>
      </div>
    </section>
  );
}

export default function AccountPage() {
  const { state, dispatch } = useGame();
  const { account, loading, refreshProfileIfStale, login, register, updateProfile, getHistory, getRecords, getOwnRecordHighlights, getScoreLeaderboard, getScoreLeaderboardPosition, getPublicProfile, getFriends, sendFriendRequest, updateFriendship } = useAccount();
  const tab: AccountSection = state.accountSection;
  const accountId = account?.id ?? null;
  const [history, setHistory] = useState<CompetitionHistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<CompetitionHistoryEntry | null>(null);
  const [records, setRecords] = useState<PublicRecordEntry[]>([]);
  const [scoreRanking, setScoreRanking] = useState<ScoreLeaderboardEntry[]>([]);
  const [scorePosition, setScorePosition] = useState<ScoreLeaderboardPosition | null>(null);
  const [ownRecords, setOwnRecords] = useState<ProfileRecordEntry[]>([]);
  const [ownRecordsError, setOwnRecordsError] = useState('');
  const [friends, setFriends] = useState<FriendshipEntry[]>([]);
  const [friendProfileUsername, setFriendProfileUsername] = useState<string | null>(null);
  const [friendProfileData, setFriendProfileData] = useState<PublicProfileData | null>(null);
  const [friendProfileLoading, setFriendProfileLoading] = useState(false);
  const [friendProfileError, setFriendProfileError] = useState('');
  const [rankingTab, setRankingTab] = useState<RankingTab>('overall');
  const [recordRankingTab, setRecordRankingTab] = useState<PublicRecordEntry['category']>('goals');
  const [friendsTab, setFriendsTab] = useState<FriendsTab>('friends');
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scorePositionLoading, setScorePositionLoading] = useState(false);
  const [ownRecordsLoading, setOwnRecordsLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [pointsInfoOpen, setPointsInfoOpen] = useState(false);
  const friendProfileRequestId = useRef(0);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceTab, setAppearanceTab] = useState<'avatar' | 'cover'>('avatar');
  const [appearancePage, setAppearancePage] = useState(0);
  const [appearanceDraft, setAppearanceDraft] = useState({ avatarKey: 'mark-evans', avatarBackgroundKey: DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY, coverKey: 'cover-01' });
  const [appearanceBusy, setAppearanceBusy] = useState(false);
  const [appearanceError, setAppearanceError] = useState('');
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', displayName: '', password: '' });

  useEffect(() => {
    setError('');
    setNotice('');
    let active = true;
    if (tab === 'history' && accountId) {
      setHistoryLoading(true);
      void getHistory(historyPage)
        .then(result => {
          if (!active) return;
          setHistory(result.history);
          setHistoryTotal(result.total);
          setHistoryTotalPages(result.totalPages);
          if (result.page !== historyPage) setHistoryPage(result.page);
        })
        .catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setHistoryLoading(false); });
    }
    if (tab === 'profile' && accountId) {
      void refreshProfileIfStale().then(refreshed => {
        if (active && !refreshed) setError('Não foi possível atualizar os dados do perfil. Tente abrir esta aba novamente.');
      });
      setScorePosition(null);
      setScorePositionLoading(true);
      void getScoreLeaderboardPosition().then(setScorePosition).catch(err => setError(err.message)).finally(() => setScorePositionLoading(false));
      setOwnRecords([]);
      setOwnRecordsError('');
      setOwnRecordsLoading(true);
      void getOwnRecordHighlights().then(setOwnRecords).catch(err => setOwnRecordsError(err instanceof Error ? err.message : 'Não foi possível carregar seus recordes.')).finally(() => setOwnRecordsLoading(false));
    }
    if (tab === 'records') {
      setLeaderboardLoading(true);
      setScoreLoading(true);
      void getRecords({ difficulty: 'immortal' }).then(setRecords).catch(err => setError(err.message)).finally(() => setLeaderboardLoading(false));
      void getScoreLeaderboard().then(setScoreRanking).catch(err => setError(err.message)).finally(() => setScoreLoading(false));
    }
    if (tab === 'friends' && accountId) {
      setFriendsLoading(true);
      void getFriends().then(setFriends).catch(err => setError(err.message)).finally(() => setFriendsLoading(false));
    }
    return () => { active = false; };
  }, [tab, accountId, historyPage, getHistory, getRecords, getOwnRecordHighlights, getScoreLeaderboard, getScoreLeaderboardPosition, getFriends, refreshProfileIfStale]);

  const submitAuth = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (authMode === 'login') {
        await login(authForm.username, authForm.password);
        dispatch({ type: 'SET_PHASE', phase: 'menu' });
        return;
      }
      if (authMode === 'register') {
        await register(authForm.username, authForm.password, authForm.displayName);
        setAuthMode('login');
        setAuthForm(form => ({ ...form, password: '' }));
        setShowPassword(false);
        setNotice('Conta criada. Agora entre com seu nome de usuário e senha.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir essa ação.');
    } finally {
      setBusy(false);
    }
  };

  const openNameEditor = () => {
    if (!account) return;
    setNameDraft(account.displayName);
    setNameError('');
    setNameEditorOpen(true);
  };

  const saveDisplayName = async () => {
    const displayName = nameDraft.trim();
    if (!displayName) {
      setNameError('Informe um nome de exibição.');
      return;
    }
    setNameBusy(true);
    setNameError('');
    try {
      await updateProfile({ displayName });
      setNotice('Nome atualizado.');
      setNameEditorOpen(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Não foi possível atualizar o nome.');
    } finally {
      setNameBusy(false);
    }
  };

  const openAppearanceEditor = () => {
    if (!account) return;
    const avatarKey = normalizeProfileAvatarKey(account.avatarKey);
    const currentAvatarIndex = PROFILE_AVATARS.findIndex(avatar => avatar.key === avatarKey);
    setAppearanceDraft({ avatarKey, avatarBackgroundKey: normalizeProfileAvatarBackgroundKey(account.avatarBackgroundKey), coverKey: account.coverKey });
    setAppearanceTab('avatar');
    setAppearancePage(Math.max(0, Math.floor(currentAvatarIndex / AVATARS_PER_PAGE)));
    setAppearanceError('');
    setAppearanceOpen(true);
  };

  const saveAppearance = async () => {
    setAppearanceBusy(true);
    setAppearanceError('');
    try {
      await updateProfile({ avatarKey: appearanceDraft.avatarKey, avatarBackgroundKey: appearanceDraft.avatarBackgroundKey, coverKey: appearanceDraft.coverKey });
      setNotice('Foto e fundo do perfil atualizados.');
      setAppearanceOpen(false);
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : 'Não foi possível salvar a aparência do perfil.');
    } finally {
      setAppearanceBusy(false);
    }
  };

  const addFriend = async () => {
    if (!friendUsername.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await sendFriendRequest(friendUsername.trim());
      setFriendUsername('');
      setNotice('Solicitação enviada.');
      setFriends(await getFriends());
    } catch (err) { setError(friendErrorMessage(err, 'Não foi possível enviar o pedido agora. Tente novamente em instantes.')); }
    finally { setBusy(false); }
  };

  const actFriend = async (id: string, action: 'accept' | 'decline' | 'remove') => {
    setBusy(true); setError('');
    try { await updateFriendship(id, action); setFriends(await getFriends()); }
    catch (err) { setError(friendErrorMessage(err, 'Não foi possível atualizar essa amizade. Tente novamente em instantes.')); }
    finally { setBusy(false); }
  };

  const viewFriendProfile = async (username: string) => {
    const requestId = ++friendProfileRequestId.current;
    setFriendProfileUsername(username);
    setFriendProfileData(null);
    setFriendProfileError('');
    setFriendProfileLoading(true);
    try {
      const data = await getPublicProfile(username);
      if (friendProfileRequestId.current === requestId) setFriendProfileData(data);
    } catch (err) {
      if (friendProfileRequestId.current === requestId) {
        setFriendProfileError(err instanceof Error && err.message === 'profile_private'
          ? 'Este perfil não está disponível para você.'
          : err instanceof Error ? err.message : 'Não foi possível carregar este perfil.');
      }
    } finally {
      if (friendProfileRequestId.current === requestId) setFriendProfileLoading(false);
    }
  };

  const closeFriendProfile = () => {
    friendProfileRequestId.current += 1;
    setFriendProfileUsername(null);
    setFriendProfileData(null);
    setFriendProfileError('');
    setFriendProfileLoading(false);
  };

  if (loading) {
    return <AppShell><TopBar title="UCL IMMORTALS" /><PageContainer narrow className="space-y-4 py-8"><Skeleton className="h-40 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></PageContainer></AppShell>;
  }

  if (!account) {
    return (
      <AppShell>
        <TopBar title="UCL IMMORTALS" />
        <PageContainer narrow className="flex min-h-[calc(100dvh-64px)] items-center py-8">
          <Panel className="w-full overflow-hidden">
            <PanelBody className="space-y-4 p-5 sm:p-8">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" intent={authMode === 'login' ? 'primary' : 'ghost'} onClick={() => { setAuthMode('login'); setError(''); setNotice(''); }}>ENTRAR</Button>
                <Button type="button" intent={authMode === 'register' ? 'primary' : 'ghost'} onClick={() => { setAuthMode('register'); setError(''); setNotice(''); }}>CRIAR CONTA</Button>
              </div>

              {notice ? <StatusBanner tone="success" title="Tudo certo">{notice}</StatusBanner> : null}
              {error ? <StatusBanner tone="danger" title="Não foi possível concluir">{error}</StatusBanner> : null}

              <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submitAuth(); }}>
                <label className="block space-y-2"><span className="ui-kicker">NOME DE USUÁRIO</span><Input autoComplete="username" value={authForm.username} maxLength={24} placeholder="ex.: treinador01" onChange={event => setAuthForm(form => ({ ...form, username: event.target.value }))} /></label>
                {authMode === 'register' ? <label className="block space-y-2"><span className="ui-kicker">NOME DE EXIBIÇÃO <span className="normal-case tracking-normal text-[var(--ui-text-faint)]">(opcional)</span></span><Input autoComplete="nickname" value={authForm.displayName} maxLength={40} placeholder="Como você quer aparecer" onChange={event => setAuthForm(form => ({ ...form, displayName: event.target.value }))} /></label> : null}
                <label className="block space-y-2">
                  <span className="ui-kicker">SENHA</span>
                  <span className="relative block">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      value={authForm.password}
                      placeholder={authMode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
                      onChange={event => setAuthForm(form => ({ ...form, password: event.target.value }))}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => setShowPassword(value => !value)}
                      className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-surface-2)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)]"
                    >
                      {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </span>
                </label>
                <Button type="submit" intent="primary" size="large" className="w-full" loading={busy}><span className="inline-flex items-center gap-2">{authMode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />} {authMode === 'login' ? 'ENTRAR NA CONTA' : 'CRIAR CONTA'}</span></Button>
              </form>
              <Button intent="ghost" className="w-full" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'menu' })}>Jogar sem conta</Button>
            </PanelBody>
          </Panel>
        </PageContainer>
      </AppShell>
    );
  }

  if (selectedHistory) {
    return <ReportPage
      key={selectedHistory.id}
      historyEntry={selectedHistory}
      onHistoryBack={() => setSelectedHistory(null)}
    />;
  }

  const pendingIncoming = friends.filter(friend => friend.status === 'pending' && friend.addressee_id === account.id);
  const acceptedFriends = friends.filter(friend => friend.status === 'accepted');
  const pendingOutgoing = friends.filter(friend => friend.status === 'pending' && friend.requester_id === account.id);
  const coverStyle = profileCoverStyle(account.coverKey, account.coverUrl);
  const historyStart = historyTotal > 0 ? (historyPage - 1) * 10 + 1 : 0;
  const historyEnd = Math.min(historyPage * 10, historyTotal);

  return (
    <AppShell>
      <TopBar title="UCL IMMORTALS" />
      <PageContainer wide className="space-y-5 py-5 pb-28 sm:py-8 sm:pb-28">
        {tab === 'profile' ? <Panel className="relative isolate overflow-hidden" style={coverStyle}>
          <div className="relative h-36 sm:h-44">
            <Button type="button" intent="ghost" onClick={openAppearanceEditor} className="absolute right-4 top-4 z-10 min-h-9 border border-white/20 bg-black/60 px-3 text-xs text-white hover:bg-black/75">
              <Pencil size={14} aria-hidden="true" /> EDITAR
            </Button>
          </div>
          <PanelBody className="relative -mt-12 px-5 pb-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {profileAvatar(account.avatarUrl, account.avatarKey, account.displayName, account.avatarBackgroundKey)}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2"><h1 className="truncate font-display text-balance text-3xl text-[var(--ui-text)]">{account.displayName}</h1><Button type="button" intent="ghost" aria-label="Editar nome de exibição" title="Editar nome de exibição" onClick={openNameEditor} className="size-8 min-h-8 rounded-full px-0"><Pencil size={14} aria-hidden="true" /></Button></div>
                <div className="mt-1 text-sm text-[var(--ui-text-muted)]">@{account.username} · conta criada em {formatDate(account.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2 pb-1 text-xs text-[var(--ui-text-faint)]"><Users size={14} /> {acceptedFriends.length} amigos</div>
            </div>
          </PanelBody>
        </Panel> : null}

        {error ? <StatusBanner tone="danger" title="Não foi possível concluir">{error}</StatusBanner> : null}
        {notice ? <StatusBanner tone="success" title="Tudo certo">{notice}</StatusBanner> : null}

        <Tabs value={tab}>
          <TabPanel value="profile" className="space-y-5 pt-5">
            <ProfileCareerContent
              scorePosition={scorePosition}
              scorePositionLoading={scorePositionLoading}
              competitionsCompleted={account.stats.competitionsCompleted}
              finishCounts={account.stats.finishCounts}
              records={ownRecords}
              recordsLoading={ownRecordsLoading}
              recordsError={ownRecordsError}
            />
          </TabPanel>

          <TabPanel value="records" className="space-y-5 pt-5">
            <SectionHeader title="Rankings" actions={<div className="flex w-10 justify-end sm:w-36">{rankingTab === 'overall' ? <Button type="button" intent="ghost" aria-label="Como funciona o ranking geral" title="Como funciona o ranking geral" onClick={() => setPointsInfoOpen(true)} className="min-h-9 gap-2 px-2 text-xs"><Info size={16} aria-hidden="true" /><span className="hidden sm:inline">COMO FUNCIONA</span></Button> : <span aria-hidden="true" className="size-9 shrink-0" />}</div>} />
            <Tabs value={rankingTab} onValueChange={value => setRankingTab(value as RankingTab)}>
              <TabList aria-label="Seções do ranking" className="ui-tabs--equal">
                {(Object.keys(RANKING_TAB_LABELS) as RankingTab[]).map(section => <Tab key={section} value={section} aria-label={RANKING_TAB_LABELS[section]} title={RANKING_TAB_LABELS[section]}>{RANKING_TAB_LABELS[section]}</Tab>)}
              </TabList>
              <TabPanel value="overall" className="space-y-3 pt-4">
                <div className="flex min-h-12 items-start justify-between gap-3">
                  <div><h2 className="font-display text-2xl leading-none text-[var(--ui-text)]">Ranking geral por pontos</h2><p className="mt-1 text-xs text-[var(--ui-text-muted)]">Pontuação acumulada ao concluir cada campanha.</p></div>
                  <Badge tone="brand" className="shrink-0 whitespace-nowrap">TOP 10</Badge>
                </div>
                {scoreLoading ? <div className="space-y-2" aria-label="Carregando ranking de pontos">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-[76px] w-full rounded-xl" />)}</div>
                  : scoreRanking.length === 0 ? <EmptyState title="O ranking começa com as próximas campanhas" description="Cada competição concluída registra pontos conforme a fase alcançada." />
                    : <ol className="space-y-2">{scoreRanking.slice(0, 10).map((entry, index) => <li key={entry.username}><ScoreCard entry={entry} rank={index + 1} /></li>)}</ol>}
              </TabPanel>
              <TabPanel value="records" className="space-y-3 pt-4">
                <Tabs value={recordRankingTab} onValueChange={value => setRecordRankingTab(value as PublicRecordEntry['category'])}>
                  <TabList aria-label="Categorias de recordes" className="ui-tabs--equal">
                    {RECORD_CATEGORY_ORDER.map(category => <Tab key={category} value={category} aria-label={RECORD_RANKING_TAB_LABELS[category]} title={RECORD_RANKING_TAB_LABELS[category]}>
                      <span className="hidden sm:inline">{RECORD_RANKING_TAB_LABELS[category]}</span>
                      <span className="sm:hidden">{RECORD_RANKING_TAB_COMPACT_LABELS[category]}</span>
                    </Tab>)}
                  </TabList>
                  {RECORD_CATEGORY_ORDER.map(category => {
                    const meta = RECORD_LABELS[category];
                    const Icon = meta.icon;
                    const categoryRecords = records.filter(record => record.category === category).slice(0, 10);
                    return <TabPanel key={category} value={category} className="space-y-3 pt-4">
                      <div className="flex min-h-12 items-start justify-between gap-3">
                        <div className="min-w-0"><h2 className="flex min-w-0 items-center gap-2 font-display text-2xl leading-none text-[var(--ui-text)]"><Icon size={17} aria-hidden="true" className="shrink-0 text-[var(--ui-brand-strong)]" />{meta.label}</h2><p className="mt-1 text-xs text-[var(--ui-text-muted)]">{meta.description}</p></div>
                        <Badge tone="brand" className="shrink-0 whitespace-nowrap">TOP 10</Badge>
                      </div>
                      {leaderboardLoading ? <div className="space-y-2" aria-label={`Carregando ranking de ${meta.label.toLowerCase()}`}>{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-[210px] w-full rounded-xl" />)}</div>
                        : categoryRecords.length === 0 ? <EmptyState title="Ainda sem resultados nesta categoria" description="Os recordes aparecem quando uma competição é concluída." />
                          : <ol className="space-y-2">{categoryRecords.map((record, index) => <li key={record.id}><RecordCard record={record} rank={index + 1} /></li>)}</ol>}
                    </TabPanel>;
                  })}
                </Tabs>
              </TabPanel>
            </Tabs>
          </TabPanel>

          <TabPanel value="history" className="space-y-5 pt-5">
            <SectionHeader title="Histórico de competições" actions={<span role="status" aria-label={`${historyTotal} ${historyTotal === 1 ? 'competição salva' : 'competições salvas'}`} aria-atomic="true" className={cn('font-display whitespace-nowrap text-[clamp(30px,5vw,46px)] font-normal leading-[0.98] tabular-nums', historyTotal > 0 ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text-muted)]')}>{historyTotal}</span>} />
            {historyLoading ? <div className="space-y-2" aria-label="Carregando histórico">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-[96px] w-full rounded-xl" />)}</div>
              : history.length === 0 ? <EmptyState title="Nenhuma competição salva" description="Suas competições concluídas aparecerão aqui." />
                : <>
                  <div className="space-y-2">{history.map(entry => <HistoryCard key={entry.id} entry={entry} onView={setSelectedHistory} />)}</div>
                  {historyTotalPages > 1 ? <nav aria-label="Paginação do histórico" className="flex flex-col items-center justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-3 sm:flex-row">
                    <span className="text-xs text-[var(--ui-text-muted)]">Mostrando <strong className="tabular-nums text-[var(--ui-text)]">{historyStart}–{historyEnd}</strong> de <strong className="tabular-nums text-[var(--ui-text)]">{historyTotal}</strong> · Página <strong className="tabular-nums text-[var(--ui-text)]">{historyPage}</strong> de <strong className="tabular-nums text-[var(--ui-text)]">{historyTotalPages}</strong></span>
                    <div className="flex items-center gap-2">
                      <Button type="button" intent="secondary" aria-label="Página anterior do histórico" onClick={() => setHistoryPage(page => Math.max(1, page - 1))} disabled={historyPage <= 1 || historyLoading} className="min-h-9 px-3 text-xs"><ChevronLeft size={15} aria-hidden="true" /> Anterior</Button>
                      <Button type="button" intent="secondary" aria-label="Próxima página do histórico" onClick={() => setHistoryPage(page => Math.min(historyTotalPages, page + 1))} disabled={historyPage >= historyTotalPages || historyLoading} className="min-h-9 px-3 text-xs">Próxima <ChevronRight size={15} aria-hidden="true" /></Button>
                    </div>
                  </nav> : null}
                </>}
          </TabPanel>

          <TabPanel value="friends" className="space-y-5 pt-5">
            <SectionHeader title="Amigos" />
            <div className="mx-auto w-full max-w-3xl space-y-5">
              <Panel density="compact"><PanelBody className="p-3 sm:p-4"><form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void addFriend(); }}><label className="relative min-w-0 flex-1"><span className="sr-only">Nome de usuário</span><Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-[var(--ui-text-faint)]" /><Input className="pl-9" value={friendUsername} placeholder="Buscar por nome de usuário" onChange={event => setFriendUsername(event.target.value)} /></label><Button type="submit" intent="primary" loading={busy} disabled={!friendUsername.trim()} className="sm:min-w-40"><UserPlus size={16} aria-hidden="true" /> ADICIONAR</Button></form></PanelBody></Panel>
              <Tabs value={friendsTab} onValueChange={value => setFriendsTab(value as FriendsTab)}>
                <TabList aria-label="Seções de amigos" className="mx-auto w-fit max-w-full flex-wrap justify-center gap-2 sm:gap-4">
                  <Tab value="friends" className="inline-flex items-center gap-2"><Users size={14} aria-hidden="true" /> AMIGOS <span className="tabular-nums">{acceptedFriends.length}</span></Tab>
                  <Tab value="incoming" className="inline-flex items-center gap-2"><Check size={14} aria-hidden="true" /> RECEBIDAS <span className="tabular-nums">{pendingIncoming.length}</span></Tab>
                  <Tab value="outgoing" className="inline-flex items-center gap-2"><UserPlus size={14} aria-hidden="true" /> ENVIADAS <span className="tabular-nums">{pendingOutgoing.length}</span></Tab>
                </TabList>
                <TabPanel value="friends" className="space-y-2 pt-4">
                  {friendsLoading ? <div className="space-y-2" aria-label="Carregando amigos">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-[72px] w-full rounded-xl" />)}</div>
                    : acceptedFriends.length === 0 ? <EmptyState title="Você ainda não tem amigos" description="Adicione alguém pelo nome de usuário." />
                      : acceptedFriends.map(friend => {
                        const person = friendIdentity(friend, account.id);
                        return <article key={friend.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:gap-4">
                          <Button type="button" intent="ghost" aria-label={`Ver perfil de ${person.name}`} title={`Ver perfil de ${person.name}`} onClick={() => void viewFriendProfile(person.username)} className="group flex h-auto min-h-0 min-w-0 flex-1 items-center justify-start gap-3 rounded-lg border-0 bg-transparent p-0 text-left normal-case font-normal tracking-normal hover:translate-y-0 hover:border-transparent hover:bg-transparent">
                            <CompactProfileAvatar name={person.name} avatarKey={person.avatarKey} backgroundKey={person.avatarBackgroundKey} />
                            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--ui-text)]">{person.name}</strong><span className="block truncate text-xs text-[var(--ui-text-muted)]">@{person.username}</span><span className="mt-1 block text-[12px] text-[var(--ui-brand-strong)]">Amigos desde {formatDate(friend.updated_at)}</span></span>
                            <span className="hidden shrink-0 text-[12px] font-bold text-[var(--ui-text-muted)] sm:block">VER PERFIL</span>
                            <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--ui-text-faint)]" />
                          </Button>
                          <Button intent="ghost" aria-label={`Remover ${person.name} dos amigos`} title={`Remover ${person.name}`} disabled={busy} onClick={() => void actFriend(friend.id, 'remove')} className="size-10 min-h-10 shrink-0 px-0"><X size={16} aria-hidden="true" /></Button>
                        </article>;
                      })}
              </TabPanel>
              <TabPanel value="incoming" className="space-y-2 pt-4">
                {friendsLoading ? <div className="space-y-2" aria-label="Carregando solicitações">{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[72px] w-full rounded-xl" />)}</div>
                  : pendingIncoming.length === 0 ? <EmptyState title="Nenhuma solicitação recebida" />
                    : pendingIncoming.map(friend => {
                      const person = friendIdentity(friend, account.id);
                      return <article key={friend.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:gap-4">
                        <CompactProfileAvatar name={person.name} avatarKey={person.avatarKey} backgroundKey={person.avatarBackgroundKey} />
                        <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--ui-text)]">{person.name}</strong><span className="block truncate text-xs text-[var(--ui-text-muted)]">@{person.username}</span></div>
                        <Button intent="primary" disabled={busy} aria-label={`Aceitar solicitação de ${person.name}`} onClick={() => void actFriend(friend.id, 'accept')} className="size-10 min-h-10 shrink-0 px-0 sm:h-auto sm:w-auto sm:px-3"><Check size={15} aria-hidden="true" /><span className="hidden sm:inline">ACEITAR</span></Button>
                        <Button intent="ghost" disabled={busy} aria-label={`Recusar solicitação de ${person.name}`} onClick={() => void actFriend(friend.id, 'decline')} className="size-10 min-h-10 shrink-0 px-0"><X size={16} aria-hidden="true" /></Button>
                      </article>;
                    })}
              </TabPanel>
              <TabPanel value="outgoing" className="space-y-2 pt-4">
                {friendsLoading ? <div className="space-y-2" aria-label="Carregando solicitações">{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[72px] w-full rounded-xl" />)}</div>
                  : pendingOutgoing.length === 0 ? <EmptyState title="Nenhuma solicitação enviada" />
                    : pendingOutgoing.map(friend => {
                      const person = friendIdentity(friend, account.id);
                      return <article key={friend.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:gap-4">
                        <CompactProfileAvatar name={person.name} avatarKey={person.avatarKey} backgroundKey={person.avatarBackgroundKey} />
                        <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--ui-text)]">{person.name}</strong><span className="block truncate text-xs text-[var(--ui-text-muted)]">@{person.username}</span></div>
                        <Badge tone="warning">PENDENTE</Badge>
                        <Button intent="ghost" aria-label={`Cancelar solicitação para ${person.name}`} title="Cancelar solicitação" disabled={busy} onClick={() => void actFriend(friend.id, 'remove')} className="size-10 min-h-10 shrink-0 px-0"><X size={16} aria-hidden="true" /></Button>
                      </article>;
                    })}
              </TabPanel>
              </Tabs>
            </div>
          </TabPanel>
        </Tabs>
      </PageContainer>
      <GameModal
        open={nameEditorOpen}
        onOpenChange={open => { setNameEditorOpen(open); if (!open) setNameError(''); }}
        title="EDITAR NOME"
        subtitle="Esse é o nome que aparece no seu perfil e para seus amigos."
        closeLabel="Fechar edição do nome"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" intent="ghost" disabled={nameBusy} onClick={() => setNameEditorOpen(false)}>CANCELAR</Button><Button type="button" intent="primary" loading={nameBusy} onClick={() => void saveDisplayName()}><Check size={15} /> SALVAR NOME</Button></div>}
      >
        <div className="space-y-3">
          {nameError ? <StatusBanner tone="danger" title="Não foi possível salvar">{nameError}</StatusBanner> : null}
          <label className="block space-y-2"><span className="ui-kicker">NOME DE EXIBIÇÃO</span><Input autoFocus value={nameDraft} maxLength={40} onChange={event => setNameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void saveDisplayName(); }} /></label>
        </div>
      </GameModal>
      <GameModal
        open={appearanceOpen}
        onOpenChange={open => { setAppearanceOpen(open); if (!open) setAppearanceError(''); }}
        title="PERSONALIZAR PERFIL"
        subtitle="Personalize sua foto e sua capa."
        size="wide"
        closeLabel="Fechar personalização"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" intent="ghost" disabled={appearanceBusy} onClick={() => setAppearanceOpen(false)}>CANCELAR</Button><Button type="button" intent="primary" loading={appearanceBusy} onClick={() => void saveAppearance()}><Check size={15} /> SALVAR ALTERAÇÕES</Button></div>}
      >
        <div className="space-y-4">
          {appearanceError ? <StatusBanner tone="danger" title="Não foi possível salvar">{appearanceError}</StatusBanner> : null}
          <Tabs value={appearanceTab} onValueChange={value => setAppearanceTab(value as 'avatar' | 'cover')}>
            <TabList className="ui-tabs--split-mobile">
              <Tab value="avatar" className="inline-flex items-center justify-center gap-2"><UserRound size={15} aria-hidden="true" /> AVATAR</Tab>
              <Tab value="cover" className="inline-flex items-center justify-center gap-2"><ImageIcon size={15} aria-hidden="true" /> CAPA</Tab>
            </TabList>
            <TabPanel value="avatar" className="space-y-4 pt-4">
              <fieldset className="min-w-0 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3">
                  <legend className="ui-kicker">COR DO FUNDO</legend>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {PROFILE_AVATAR_BACKGROUNDS.map(background => {
                      const selected = appearanceDraft.avatarBackgroundKey === background.key;
                      return <Button
                        type="button"
                        key={background.key}
                        intent="ghost"
                        aria-label={`Cor ${background.label}`}
                        aria-pressed={selected}
                        title={background.label}
                        onClick={() => setAppearanceDraft(draft => ({ ...draft, avatarBackgroundKey: background.key }))}
                        className={cn('size-9 min-h-9 justify-self-center rounded-full border-2 p-0', selected ? 'border-[var(--ui-brand)] ring-2 ring-[var(--ui-brand)]/35' : 'border-[var(--ui-line-strong)]')}
                        style={{ backgroundColor: background.color }}
                      >{selected ? <Check size={14} aria-hidden="true" className="text-white drop-shadow" /> : <span className="sr-only">{background.label}</span>}</Button>;
                    })}
                  </div>
              </fieldset>
              <div className="grid grid-cols-4 gap-3 p-3 sm:gap-4">
                {PROFILE_AVATARS.slice(appearancePage * AVATARS_PER_PAGE, (appearancePage + 1) * AVATARS_PER_PAGE).map(avatar => {
                  const selected = appearanceDraft.avatarKey === avatar.key;
                  return <Button
                    type="button"
                    key={avatar.key}
                    intent="ghost"
                    aria-label={`Selecionar ${avatar.name} como foto de perfil`}
                    aria-pressed={selected}
                    onClick={() => setAppearanceDraft(draft => ({ ...draft, avatarKey: avatar.key }))}
                    className={cn('relative aspect-square h-auto min-h-0 w-full min-w-0 overflow-visible rounded-full border-2 p-0', selected ? 'border-[var(--ui-brand)] ring-2 ring-[var(--ui-brand)]/35' : 'border-[var(--ui-line-subtle)] hover:border-[var(--ui-brand)]/60')}
                    style={{ backgroundColor: getProfileAvatarBackground(appearanceDraft.avatarBackgroundKey).color }}
                  >
                    <img src={avatar.src} alt="" loading="lazy" className="size-full rounded-full object-contain" />
                    {selected ? <span className="absolute right-0 top-0 z-10 flex size-5 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--ui-bg)] bg-[var(--ui-brand)] text-[var(--ui-brand-ink)]"><Check size={12} aria-hidden="true" /></span> : null}
                  </Button>;
                })}
              </div>
              <GalleryPagination page={appearancePage} pageCount={Math.ceil(PROFILE_AVATARS.length / AVATARS_PER_PAGE)} label="Paginação das fotos de perfil" onPageChange={setAppearancePage} />
            </TabPanel>
            <TabPanel value="cover" className="pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PROFILE_COVER_PRESETS.map(cover => {
                  const selected = appearanceDraft.coverKey === cover.key;
                  return <Button
                    type="button"
                    key={cover.key}
                    intent="ghost"
                    aria-label={`Selecionar fundo: ${cover.name}`}
                    aria-pressed={selected}
                    onClick={() => setAppearanceDraft(draft => ({ ...draft, coverKey: cover.key }))}
                    className={cn('relative aspect-[3/2] h-auto min-h-0 w-full overflow-hidden rounded-xl border p-0', selected ? 'border-[var(--ui-brand)] ring-2 ring-[var(--ui-brand)]/40' : 'border-[var(--ui-line-subtle)]')}
                  >
                    <img src={cover.src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                    {selected ? <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[var(--ui-brand)] text-[var(--ui-brand-ink)]"><Check size={12} aria-hidden="true" /></span> : null}
                  </Button>;
                })}
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </GameModal>
      <GameModal
        open={pointsInfoOpen}
        onOpenChange={setPointsInfoOpen}
        title="PONTUAÇÃO DO RANKING"
        subtitle="Cada campanha rende pontos uma vez, ao ser concluída."
        closeLabel="Fechar explicação da pontuação"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {POINT_TIER_LABELS.map(tier => <div key={tier.label} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-3 py-2.5">
              <span className="text-xs text-[var(--ui-text-soft)]">{tier.label}</span>
              <strong className="font-display text-xl tabular-nums text-[var(--ui-brand-strong)]">{tier.points}</strong>
            </div>)}
          </div>
          <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">Os pontos de todas as competições concluídas, solo e online, são somados. Em caso de empate: mais títulos; depois, mais campanhas pontuadas.</p>
        </div>
      </GameModal>
      <GameModal
        open={friendProfileUsername !== null}
        onOpenChange={open => { if (!open) closeFriendProfile(); }}
        title={friendProfileData?.profile.displayName ?? (friendProfileUsername ? `@${friendProfileUsername}` : 'PERFIL DO JOGADOR')}
        subtitle={friendProfileData ? `@${friendProfileData.profile.username}` : 'Perfil de amigo'}
        size="wide"
        closeLabel="Fechar perfil do amigo"
      >
        {friendProfileLoading ? <div className="space-y-3" aria-label="Carregando perfil do amigo"><Skeleton className="h-36 w-full rounded-xl" /><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</div></div>
          : friendProfileError ? <StatusBanner tone="danger" title="Não foi possível abrir o perfil">{friendProfileError}</StatusBanner>
            : friendProfileData ? <FriendProfileView data={friendProfileData} /> : null}
      </GameModal>
      <AccountTabBar
        active={tab}
        incomingFriendRequestCount={pendingIncoming.length}
        onNavigate={destination => {
          if (destination === 'home') {
            dispatch({ type: 'SET_PHASE', phase: 'menu' });
            return;
          }
          dispatch({ type: 'SET_ACCOUNT_SECTION', section: destination });
        }}
      />
    </AppShell>
  );
}
