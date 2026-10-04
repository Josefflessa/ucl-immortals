// UCL Immortals — Achievements page
// Every career achievement with its level, progress and rarity. Reached from the
// home screen; any unlocked achievement can also be pinned to the profile mural.

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useAccount, type AchievementsPayload } from '../contexts/AccountContext';
import AccountTabBar from '../components/account/AccountTabBar';
import { AchievementsSection } from '../components/account/Achievements';
import { ACHIEVEMENTS } from '@shared/game/achievements';
import { AppShell, Button, Metric, PageContainer, SectionHeader, Skeleton, StatusBanner, TopBar } from '../design-system';

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
  const legendary = payload?.achievements.filter(state => state.level === 4).length ?? 0;

  return (
    <AppShell>
      <TopBar
        right={(
          <Button intent="ghost" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'menu' })} className="px-3 text-xs sm:px-4">
            <ArrowLeft size={15} aria-hidden="true" />
            <span className="hidden sm:inline">VOLTAR AO MENU</span>
            <span className="sm:hidden">VOLTAR</span>
          </Button>
        )}
      />
      <PageContainer wide className="space-y-5 pb-28 pt-7 sm:pb-28 sm:pt-10">
        <SectionHeader
          kicker="CARREIRA"
          title="Conquistas"
          description="Metas de carreira em 4 níveis: Bronze, Prata, Ouro e Lendário. Uma conquista desbloqueada é sua para sempre e pode ser fixada no mural do perfil."
          className="mb-0"
        />
        {error ? (
          <StatusBanner tone="danger" title="Não foi possível carregar as conquistas">
            {error}{' '}
            <Button type="button" intent="ghost" onClick={() => setAttempt(value => value + 1)} className="ml-1 min-h-8 px-2 text-xs">TENTAR NOVAMENTE</Button>
          </StatusBanner>
        ) : !payload ? (
          <div className="space-y-3" aria-label="Carregando conquistas">
            <div className="grid grid-cols-2 gap-2">{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[84px] w-full rounded-xl" />)}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[104px] w-full rounded-xl" />)}</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Desbloqueadas" value={`${unlocked}/${ACHIEVEMENTS.length}`} detail="conquistas" tone="brand" />
              <Metric label="Nível Lendário" value={legendary} detail="no nível máximo" />
            </div>
            <AchievementsSection payload={payload} heading={false} />
          </>
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
