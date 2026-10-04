// UCL Immortals — Achievements page
// Every career achievement with its level, progress and rarity. Reached from the
// home screen; any unlocked achievement can also be pinned to the profile mural.

import { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useAccount, type AchievementsPayload } from '../contexts/AccountContext';
import AccountTabBar from '../components/account/AccountTabBar';
import { AchievementsSection } from '../components/account/Achievements';
import { ACHIEVEMENTS } from '@shared/game/achievements';
import { AppShell, Button, PageContainer, SectionHeader, Skeleton, StatusBanner, TopBar } from '../design-system';
import { cn } from '../lib/utils';

export default function AchievementsPage() {
  const { dispatch } = useGame();
  const { account, loading, getOwnAchievements } = useAccount();
  const [payload, setPayload] = useState<AchievementsPayload | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const accountId = account?.id ?? null;

  // Achievements belong to an account; without one there is nothing to show.
  useEffect(() => {
    if (!loading && !accountId) dispatch({ type: 'SET_PHASE', phase: 'menu' });
  }, [accountId, dispatch, loading]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setError('');
    void getOwnAchievements()
      .then(result => { if (active) setPayload(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar as conquistas.'); });
    return () => { active = false; };
  }, [accountId, attempt, getOwnAchievements]);

  const unlocked = payload?.achievements.filter(state => state.level > 0).length ?? 0;

  return (
    <AppShell>
      <TopBar title="UCL IMMORTALS" />
      {/* Same shell and header as the other account screens (history, friends). */}
      <PageContainer wide className="space-y-5 py-5 pb-28 sm:py-8 sm:pb-28">
        <SectionHeader
          title="Conquistas"
          actions={payload ? (
            <span role="status" aria-label={`${unlocked} de ${ACHIEVEMENTS.length} conquistas desbloqueadas`} className={cn('font-display whitespace-nowrap text-[clamp(30px,5vw,46px)] font-normal leading-[0.98] tabular-nums', unlocked > 0 ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text-muted)]')}>
              {unlocked}<span className="text-[0.55em] text-[var(--ui-text-muted)]">/{ACHIEVEMENTS.length}</span>
            </span>
          ) : undefined}
        />
        {error ? (
          <StatusBanner tone="danger" title="Não foi possível carregar as conquistas">
            {error}{' '}
            <Button type="button" intent="ghost" onClick={() => setAttempt(value => value + 1)} className="ml-1 min-h-8 px-2 text-xs">TENTAR NOVAMENTE</Button>
          </StatusBanner>
        ) : !payload ? (
          <div className="space-y-3" aria-label="Carregando conquistas">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[104px] w-full rounded-xl" />)}</div>
          </div>
        ) : (
          <AchievementsSection payload={payload} heading={false} />
        )}
      </PageContainer>
      {account ? <AccountTabBar
        active={null}
        onNavigate={destination => {
          if (destination === 'home') {
            dispatch({ type: 'SET_PHASE', phase: 'menu' });
            return;
          }
          dispatch({ type: 'SET_ACCOUNT_SECTION', section: destination });
        }}
      /> : null}
    </AppShell>
  );
}
