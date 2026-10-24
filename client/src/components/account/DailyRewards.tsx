import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Clock3, Gift, LockKeyhole, RotateCw, Sparkles } from 'lucide-react';
import { ALBUM_TIER_META, parseItemKey, type AlbumItemKey } from '@shared/game/album';
import { WEEKLY_PACK_REWARDS } from '@shared/game/dailyRewards';
import { api } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { Badge, Button, GameModal, StatusBanner } from '../../design-system';
import { cn } from '../../lib/utils';
import { ItemArt } from '../album/AlbumPieces';

interface WeeklyRewardClaim {
  dayIndex: number;
  itemKey: AlbumItemKey;
  claimedAt: number;
}

interface WeeklyRewardsState {
  date: string;
  weekStart: string;
  todayIndex: number;
  rewards: typeof WEEKLY_PACK_REWARDS;
  claims: WeeklyRewardClaim[];
}

function packLabel(itemKey: AlbumItemKey): string {
  const tier = parseItemKey(itemKey)?.tier;
  return `Pacote ${tier ? ALBUM_TIER_META[tier].label : ''}`.trim();
}

function rewardStatus(dayIndex: number, todayIndex: number, claimed: boolean): string {
  if (claimed) return 'Resgatado';
  if (dayIndex === todayIndex) return 'Disponível hoje';
  if (dayIndex < todayIndex) return 'Não resgatado';
  return 'Em breve';
}

function RewardDay({ reward, todayIndex, claimed }: {
  reward: typeof WEEKLY_PACK_REWARDS[number];
  todayIndex: number;
  claimed: boolean;
}) {
  const isToday = reward.dayIndex === todayIndex;
  const status = rewardStatus(reward.dayIndex, todayIndex, claimed);
  return (
    <article
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'relative flex min-h-[178px] flex-col items-center rounded-2xl border px-3 py-3 text-center transition-colors',
        isToday && !claimed ? 'bg-[var(--ui-surface-2)] shadow-[0_0_24px_rgba(233,196,106,.08)]' : 'bg-[var(--ui-surface-1)]',
        claimed && 'opacity-80',
      )}
      style={{ borderColor: isToday && !claimed ? 'var(--ui-brand-strong)' : 'var(--ui-line-subtle)' }}
    >
      <div className="relative flex w-full min-w-0 items-center">
        <span className="w-full whitespace-nowrap pr-12 text-left text-micro font-extrabold uppercase tracking-[0.1em] text-[var(--ui-brand)]">{reward.shortDay}</span>
        {isToday ? <Badge tone={claimed ? 'success' : 'brand'} className="absolute right-0 top-1/2 min-h-5 -translate-y-1/2 px-1 py-0 text-micro tracking-normal">Hoje</Badge> : null}
      </div>
      <div className="my-1 flex h-[82px] items-center justify-center">
        <ItemArt itemKey={reward.itemKey} height={78} />
      </div>
      <strong className="text-sm leading-tight text-[var(--ui-text)]">{packLabel(reward.itemKey)}</strong>
      <span className={cn('mt-1 inline-flex items-center gap-1 text-caption font-semibold', claimed ? 'text-emerald-300' : isToday ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text-faint)]')}>
        {claimed ? <Check size={12} aria-hidden="true" /> : isToday ? <Sparkles size={12} aria-hidden="true" /> : reward.dayIndex > todayIndex ? <LockKeyhole size={11} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}
        {status}
      </span>
      <span className="sr-only">{reward.day}</span>
    </article>
  );
}

/** What a custom trigger needs to draw itself (the home dashboard uses a card instead of the icon). */
export interface DailyRewardTriggerInfo { loading: boolean; available: boolean; rewardLabel: string | null; open: () => void }

export default function DailyRewardsHomeButton({ renderTrigger }: { renderTrigger?: (info: DailyRewardTriggerInfo) => ReactNode } = {}) {
  const { refresh: refreshAlbum } = useAlbum();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<WeeklyRewardsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await api<WeeklyRewardsState>('/api/account/daily-rewards'));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as recompensas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const claimIndices = useMemo(() => new Set(state?.claims.map(claim => claim.dayIndex) ?? []), [state]);
  const claimedToday = state ? claimIndices.has(state.todayIndex) : false;
  const todayReward = state?.rewards[state.todayIndex];

  const claimToday = async () => {
    if (!todayReward || claiming || claimedToday) return;
    setClaiming(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api<WeeklyRewardsState>('/api/account/daily-rewards/claim', { method: 'POST' });
      setState(updated);
      await refreshAlbum();
      setSuccess(`${packLabel(todayReward.itemKey)} foi adicionado ao inventário do Álbum.`);
    } catch (cause) {
      const status = (cause as Error & { status?: number }).status;
      if (status === 409) {
        setError('A recompensa de hoje já foi resgatada.');
        void load();
      } else {
        setError(cause instanceof Error ? cause.message : 'Não foi possível resgatar o pacote.');
      }
    } finally {
      setClaiming(false);
    }
  };

  const openModal = () => { setOpen(true); setSuccess(''); void load(); };

  return (
    <>
      {renderTrigger ? renderTrigger({ loading: loading && !state, available: Boolean(state && !claimedToday), rewardLabel: todayReward ? packLabel(todayReward.itemKey) : null, open: openModal }) : <Button
        type="button"
        intent="ghost"
        aria-label={!claimedToday && state ? 'Recompensa diária disponível' : 'Recompensas diárias'}
        title="Recompensas diárias"
        onClick={() => { setOpen(true); setSuccess(''); void load(); }}
        className="relative size-10 min-h-10 w-10 justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/90 p-0 sm:size-11 sm:min-h-11 sm:w-11"
      >
        <Gift size={19} aria-hidden="true" />
        {!claimedToday && state ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[var(--ui-bg)] bg-[var(--ui-brand-strong)]" /> : null}
      </Button>}

      <GameModal
        open={open}
        onOpenChange={setOpen}
        title="Recompensas diárias"
        size="wide"
        bodyClassName="space-y-4"
        footer={(
          <div className="flex w-full flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs leading-relaxed text-[var(--ui-text-muted)]">Resgate no dia indicado. Cada dia termina à meia-noite, no horário de Brasília; a semana reinicia na segunda-feira.</p>
            {todayReward && !claimedToday ? (
              <Button intent="primary" loading={claiming} disabled={loading} onClick={() => void claimToday()} className="shrink-0">
                <Gift size={16} aria-hidden="true" /> Resgatar {packLabel(todayReward.itemKey)}
              </Button>
            ) : claimedToday ? (
              <Button intent="secondary" disabled className="shrink-0"><Check size={16} aria-hidden="true" /> Resgatado hoje</Button>
            ) : null}
          </div>
        )}
      >
        {error ? <StatusBanner tone="danger" title="Não foi possível resgatar">{error}</StatusBanner> : null}
        {success ? <StatusBanner tone="success" title="Recompensa recebida">{success}</StatusBanner> : null}
        {loading && !state ? (
          <div className="flex min-h-32 items-center justify-center text-sm text-[var(--ui-text-muted)]"><RotateCw size={16} className="mr-2 animate-spin" aria-hidden="true" /> Carregando calendário…</div>
        ) : state ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
            {state.rewards.map(reward => <RewardDay key={reward.dayIndex} reward={reward} todayIndex={state.todayIndex} claimed={claimIndices.has(reward.dayIndex)} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-5 text-center">
            <p className="text-sm text-[var(--ui-text-muted)]">Não foi possível carregar o calendário agora.</p>
            <Button intent="secondary" onClick={() => void load()} className="mt-3"><RotateCw size={15} aria-hidden="true" /> Tentar novamente</Button>
          </div>
        )}
      </GameModal>
    </>
  );
}
