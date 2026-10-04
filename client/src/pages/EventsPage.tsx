// UCL Immortals — Events page
// Every account event in one place: what is running now, what is coming and what
// already ended, each with its challenges and the frame it unlocks.

import { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useAccount, type EventsPayload, type GameEventState } from '../contexts/AccountContext';
import AccountTabBar from '../components/account/AccountTabBar';
import { EventCard } from '../components/account/GameEvents';
import { AppShell, Button, EmptyState, PageContainer, SectionHeader, Skeleton, StatusBanner, TopBar } from '../design-system';

const SECTIONS: { status: GameEventState['status']; title: string }[] = [
  { status: 'active', title: 'Em andamento' },
  { status: 'upcoming', title: 'Em breve' },
  { status: 'ended', title: 'Encerrados' },
];

export default function EventsPage() {
  const { dispatch } = useGame();
  const { account, loading, getEvents, updateProfile } = useAccount();
  const [payload, setPayload] = useState<EventsPayload | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const accountId = account?.id ?? null;

  // Events belong to an account; without one there is nothing to show.
  useEffect(() => {
    if (!loading && !accountId) dispatch({ type: 'SET_PHASE', phase: 'menu' });
  }, [accountId, dispatch, loading]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setError('');
    void getEvents()
      .then(result => { if (active) setPayload(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar os eventos.'); });
    return () => { active = false; };
  }, [accountId, attempt, getEvents]);

  const equip = async (frameKey: string) => {
    await updateProfile({ avatarFrameKey: frameKey });
    setPayload(current => current ? { ...current, equippedFrame: frameKey } : current);
  };

  return (
    <AppShell>
      <TopBar title="UCL IMMORTALS" />
      {/* Same shell and header as the other account screens. */}
      <PageContainer wide className="space-y-5 py-5 pb-28 sm:py-8 sm:pb-28">
        <SectionHeader title="Eventos" />
        {error ? (
          <StatusBanner tone="danger" title="Não foi possível carregar os eventos">
            {error}{' '}
            <Button type="button" intent="ghost" onClick={() => setAttempt(value => value + 1)} className="ml-1 min-h-8 px-2 text-xs">TENTAR NOVAMENTE</Button>
          </StatusBanner>
        ) : !payload ? (
          <div className="space-y-3" aria-label="Carregando eventos"><Skeleton className="h-[320px] w-full rounded-2xl" /></div>
        ) : payload.events.length === 0 ? (
          <EmptyState title="Nenhum evento no momento" description="Os próximos eventos aparecem aqui, com os desafios e as recompensas." />
        ) : (
          SECTIONS.map(section => {
            const events = payload.events.filter(event => event.status === section.status);
            if (events.length === 0) return null;
            return (
              <section key={section.status} aria-label={section.title} className="space-y-3">
                <div className="ui-kicker">{section.title}</div>
                {events.map(event => <EventCard key={event.id} event={event} equippedFrame={payload.equippedFrame} onEquip={equip} />)}
              </section>
            );
          })
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
