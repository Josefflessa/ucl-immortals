// UCL Immortals — Events page
// Every account event in one place: what is running now, what is coming and what
// is over (ended, or already completed by the account), each with its challenges
// and the reward it unlocks.

import { useEffect, useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { useAccount, type EventsPayload, type GameEventState } from '../contexts/AccountContext';
import AccountTabBar from '../components/account/AccountTabBar';
import { CardRewardEventCard, ChoiceEventCard, CrestRewardEventCard, EventCard, NameStyleEventCard } from '../components/account/GameEvents';
import { AppShell, Button, EmptyState, PageContainer, SectionHeader, Skeleton, StatusBanner, Tab, TabList, TabPanel, Tabs } from '../design-system';

type EventStatus = GameEventState['status'];

/** The account already got what the event gives (a name style event counts once the style is picked). */
function rewardObtained(event: GameEventState): boolean {
  if (event.rewardNameStyles) return !!event.chosenKey;
  return event.frameUnlocked || event.cardUnlocked || event.crestUnlocked;
}

/** The tab an event lives in: finished events (ended or completed with the reward in hand) go to 'ended'. */
function sectionOf(event: GameEventState): EventStatus {
  if (event.status === 'ended') return 'ended';
  return event.status === 'active' && event.completed && rewardObtained(event) ? 'ended' : event.status;
}

const SECTIONS: { status: EventStatus; title: string; emptyTitle: string; empty: string }[] = [
  { status: 'active', title: 'Em andamento', emptyTitle: 'Nenhum evento em andamento', empty: 'Nenhum evento acontecendo agora. Fique de olho: os próximos aparecem em "Em breve".' },
  { status: 'upcoming', title: 'Em breve', emptyTitle: 'Nenhum evento a caminho', empty: 'Nenhum evento anunciado por enquanto.' },
  { status: 'ended', title: 'Encerrados', emptyTitle: 'Nenhum evento encerrado', empty: 'Os eventos que terminarem ou que você concluir ficam guardados aqui.' },
];

export default function EventsPage() {
  const { dispatch } = useGame();
  const { account, loading, getEvents, peekEvents, chooseEventOption, updateProfile } = useAccount();
  const [payload, setPayload] = useState<EventsPayload | null>(() => peekEvents());
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<EventStatus>('active');
  const accountId = account?.id ?? null;

  // Events belong to an account; without one there is nothing to show.
  useEffect(() => {
    if (!loading && !accountId) dispatch({ type: 'SET_PHASE', phase: 'menu' });
  }, [accountId, dispatch, loading]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const cached = peekEvents();
    setPayload(cached);
    setError('');
    void getEvents()
      .then(result => { if (active) setPayload(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar os eventos.'); });
    return () => { active = false; };
  }, [accountId, attempt, getEvents, peekEvents]);

  const choose = async (eventId: string, choice: string) => {
    setPayload(await chooseEventOption(eventId, choice));
  };

  const equip = async (frameKey: string) => {
    await updateProfile({ avatarFrameKey: frameKey });
    setPayload(current => current ? { ...current, equippedFrame: frameKey } : current);
  };

  return (
    <AppShell>
      {/* Same shell and header as the other account screens. */}
      <PageContainer wide className="space-y-5 py-5 pb-28 sm:py-8 sm:pb-28">
        <SectionHeader title="Eventos" />
        {error && !payload ? (
          <StatusBanner tone="danger" title="Não foi possível carregar os eventos">
            {error}{' '}
            <Button type="button" intent="ghost" onClick={() => setAttempt(value => value + 1)} className="ml-1 min-h-8 px-2 text-xs">TENTAR NOVAMENTE</Button>
          </StatusBanner>
        ) : !payload ? (
          <div className="space-y-3" aria-label="Carregando eventos"><Skeleton className="h-[320px] w-full rounded-2xl" /></div>
        ) : (
          <>
          {error ? <StatusBanner tone="warning" title="Os eventos podem estar desatualizados">
            {error}{' '}
            <Button type="button" intent="ghost" onClick={() => setAttempt(value => value + 1)} className="ml-1 min-h-8 px-2 text-xs">TENTAR NOVAMENTE</Button>
          </StatusBanner> : null}
          <Tabs value={tab} onValueChange={value => setTab(value as EventStatus)}>
            <TabList aria-label="Situação dos eventos" className="ui-tabs--equal">
              {SECTIONS.map(section => {
                const count = payload.events.filter(event => sectionOf(event) === section.status).length;
                return <Tab key={section.status} value={section.status} title={section.title} className="inline-flex items-center justify-center gap-1.5">
                  {section.title}{count > 0 ? <span className="tabular-nums opacity-70">{count}</span> : null}
                </Tab>;
              })}
            </TabList>
            {SECTIONS.map(section => {
              const events = payload.events.filter(event => sectionOf(event) === section.status);
              return (
                <TabPanel key={section.status} value={section.status} className="space-y-3 pt-4">
                  {events.length === 0
                    ? <EmptyState title={section.emptyTitle} description={section.empty} />
                    : events.map(event => event.rewardNameStyles
                      ? <NameStyleEventCard key={event.id} event={event} playerName={account?.displayName ?? ''} onChoose={choice => choose(event.id, choice)} />
                      : event.choices
                      ? <ChoiceEventCard key={event.id} event={event} onChoose={choice => choose(event.id, choice)} />
                      : event.rewardCrestId
                      ? <CrestRewardEventCard key={event.id} event={event} />
                      : event.rewardCardId
                      ? <CardRewardEventCard key={event.id} event={event} />
                      : <EventCard key={event.id} event={event} equippedFrame={payload.equippedFrame} onEquip={equip} />)}
                </TabPanel>
              );
            })}
          </Tabs>
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
          if (destination === 'store') {
            dispatch({ type: 'SET_PHASE', phase: 'store' });
            return;
          }
          dispatch({ type: 'SET_ACCOUNT_SECTION', section: destination });
        }}
      /> : null}
    </AppShell>
  );
}
