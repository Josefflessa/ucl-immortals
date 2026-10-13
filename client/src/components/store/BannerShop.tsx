import { Tab, TabList, TabPanel, Tabs } from '../../design-system';
import DailyBannerShop from './DailyBannerShop';
import WeeklyBannerShop from './WeeklyBannerShop';

export default function BannerShop() {
  return (
    <Tabs defaultValue="daily">
      <TabList aria-label="Tipo de banner" className="ui-tabs--equal">
        <Tab value="daily">Banner 1</Tab>
        <Tab value="weekly">Banner 2</Tab>
      </TabList>
      <TabPanel value="daily" className="pt-4"><DailyBannerShop /></TabPanel>
      <TabPanel value="weekly" className="pt-4"><WeeklyBannerShop /></TabPanel>
    </Tabs>
  );
}
