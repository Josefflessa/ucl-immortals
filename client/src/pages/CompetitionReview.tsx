import { useLeagueHub } from './league/useLeagueHub';
import HistoryTab from './league/HistoryTab';
import StatsTab from './league/StatsTab';
import StandingsTab from './league/StandingsTab';
import BracketTab from '../components/game/BracketTab';
import { Tab, TabList, Tabs } from '../design-system';

export type CompetitionReviewSection = 'table' | 'bracket' | 'matches' | 'stats';

interface Props {
  section: CompetitionReviewSection;
  partial?: boolean;
}

export default function CompetitionReview({ section }: Props) {
  const initialTab = section === 'table'
    ? 'standings'
    : section === 'stats'
      ? 'scorers'
      : section === 'matches'
        ? 'results'
        : 'bracket';
  const hub = useLeagueHub({ reportMode: true, initialTab });

  if (section === 'table') {
    const hasLeagueStage = hub.hasLeagueClassification;
    const hasBracket = !!hub.state.knockoutBracket;
    const hasBothStages = hasLeagueStage && hasBracket;

    return (
      <div className="space-y-5">
        {hasBothStages && (
          <Tabs
            value={hub.classificationSubTab}
            onValueChange={(value) => hub.setClassificationSubTab(value as typeof hub.classificationSubTab)}
          >
            <TabList className="mb-4 ui-tabs--split-mobile">
              <Tab value="league">{hub.hasGroupStage ? 'FASE DE GRUPOS' : 'FASE DE LIGA'}</Tab>
              <Tab value="bracket">CHAVEAMENTO</Tab>
            </TabList>
          </Tabs>
        )}

        {hub.classificationSubTab === 'bracket' && hasBracket
          ? <BracketTab reviewMode />
          : hasLeagueStage
            ? <StandingsTab hub={hub} />
            : null}
      </div>
    );
  }

  if (section === 'bracket') return <BracketTab reviewMode />;
  if (section === 'matches') return <HistoryTab hub={hub} />;
  return <StatsTab hub={hub} />;
}
