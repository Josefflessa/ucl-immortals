// UCL Immortals — área MEU CLUBE: Meu Time + Projetos.

import { useState } from 'react';
import { Tab, TabList, Tabs } from '../../design-system';
import LeagueSquadTab from './LeagueSquadTab';
import ClubProjectsTab from './ClubProjectsTab';

type ClubSubTab = 'team' | 'projects';

export default function ClubHubTab() {
  const [activeSubTab, setActiveSubTab] = useState<ClubSubTab>('team');

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={value => setActiveSubTab(value as ClubSubTab)}>
        <TabList className="mb-1 ui-tabs--split-mobile">
          <Tab value="team">MEU TIME</Tab>
          <Tab value="projects">PROJETOS</Tab>
        </TabList>
      </Tabs>

      {activeSubTab === 'team' ? <LeagueSquadTab /> : <ClubProjectsTab />}
    </div>
  );
}
