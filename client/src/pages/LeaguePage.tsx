// UCL Immortals — League Phase Page
// Show standings, round-by-round fixtures, and results

import ClubHubTab from '../components/game/ClubHubTab';
import MarketTab from '../components/game/MarketTab';
import ShopTab from '../components/game/ShopTab';
import MissionsTab from '../components/game/MissionsTab';
import KnockoutTiesTab from '../components/game/KnockoutTiesTab';
import BracketTab from '../components/game/BracketTab';
import { AppShell, PageContainer, Tab, TabList, Tabs } from '../design-system';
import { useLeagueHub } from './league/useLeagueHub';
import SpoilerLock from './league/SpoilerLock';
import { HubHeader, HubSummary } from './league/HubHeader';
import FixturesTab from './league/FixturesTab';
import StandingsTab from './league/StandingsTab';
import StatsTab from './league/StatsTab';
import HistoryTab from './league/HistoryTab';
import HubModals from './league/HubModals';

export default function LeaguePage() {
  const hub = useLeagueHub();
  const {
    activeTab, isKnockout, hasLeagueClassification, hasGroupStage, spoilerLock, spoilerWaiting,
    classificationSubTab, setClassificationSubTab,
  } = hub;
  // Desktop side column: the league table next to the round's matches. Other tabs need the full
  // width (squad, shop, stats…), and the knockout bracket is too wide for it (it has its own tab).
  const showAside = activeTab === 'fixtures' && !isKnockout;

  return (
    <AppShell className="flex flex-col">
      <HubHeader hub={hub} />

      <PageContainer className="max-w-4xl lg:max-w-7xl">
        <HubSummary hub={hub} />

        {/* Desktop: on the round tab, the matches on the left and the league table on the right.
            Mobile keeps the single column. */}
        <div className={showAside ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-6' : undefined}>
        <div className="min-w-0">

        {/* Matches tab — knockout shows the bracket ties; league shows round fixtures */}
        {activeTab === 'fixtures' && isKnockout && <KnockoutTiesTab />}
        {activeTab === 'bracket' && isKnockout && !hasLeagueClassification && (spoilerLock
          ? <SpoilerLock waiting={spoilerWaiting} label="CHAVEAMENTO OCULTO" />
          : <BracketTab />)}
        {activeTab === 'standings' && isKnockout && hasLeagueClassification && (
          <Tabs
            value={classificationSubTab}
            onValueChange={(value) => setClassificationSubTab(value as typeof classificationSubTab)}
          >
            <TabList className="mb-4 ui-tabs--split-mobile">
              <Tab value="league">{hasGroupStage ? 'FASE DE GRUPOS' : 'FASE DE LIGA'}</Tab>
              <Tab value="bracket">CHAVEAMENTO</Tab>
            </TabList>
          </Tabs>
        )}
        {activeTab === 'standings' && isKnockout && hasLeagueClassification && classificationSubTab === 'bracket' && (
          spoilerLock
            ? <SpoilerLock waiting={spoilerWaiting} label="CHAVEAMENTO OCULTO" />
            : <BracketTab />
        )}
        {activeTab === 'fixtures' && !isKnockout && <FixturesTab hub={hub} />}

        <StandingsTab hub={hub} />

        <StatsTab hub={hub} />

        {/* Área do clube: time em campo + projetos estruturais. */}
        {activeTab === 'squad' && <ClubHubTab />}
        {activeTab === 'market' && <MarketTab />}

        {activeTab === 'shop' && <ShopTab />}
        {activeTab === 'missions' && <MissionsTab />}

        {/* Results */}
        {activeTab === 'results' && <HistoryTab hub={hub} />}
        </div>

        {showAside && (
          <aside className="hidden lg:block lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
            <div className="ui-section-label mb-2">Classificação</div>
            <StandingsTab hub={hub} placement="aside" />
          </aside>
        )}
        </div>

      </PageContainer>

      <HubModals hub={hub} />

    </AppShell>
  );
}
