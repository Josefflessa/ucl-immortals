import { useEffect, useState, type ReactNode } from 'react';
import { PackageOpen, Palette, Sparkles } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useAccount } from '../contexts/AccountContext';
import { useAlbum } from '../contexts/AlbumContext';
import AccountTabBar from '../components/account/AccountTabBar';
import AlbumPackShop from '../components/store/AlbumPackShop';
import BannerShop from '../components/store/BannerShop';
import AppearanceShop from '../components/store/AppearanceShop';
import { AppShell, Button, PageContainer, SectionHeader, Skeleton, StatusBanner, Tab, TabList, TabPanel, Tabs } from '../design-system';

type StoreCategory = 'packs' | 'banners' | 'customization';

function StoreCategoryTab({ value, title, description, children }: {
  value: StoreCategory;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <TabPanel value={value} className="space-y-4 pt-4">
      <header className="border-b border-[var(--ui-line-subtle)] pb-4">
        <h2 className="font-display text-2xl text-[var(--ui-text)]">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--ui-text-muted)]">{description}</p>
      </header>
      {children}
    </TabPanel>
  );
}

/** The account-wide store. All purchases use the same account coin balance. */
export default function StorePage() {
  const { dispatch } = useGame();
  const { account, loading: accountLoading } = useAccount();
  const { album, loading: albumLoading, error: albumError, refresh } = useAlbum();
  const [category, setCategory] = useState<StoreCategory>('packs');
  const accountId = account?.id ?? null;

  useEffect(() => {
    if (!accountLoading && !accountId) dispatch({ type: 'SET_PHASE', phase: 'menu' });
  }, [accountId, accountLoading, dispatch]);

  useEffect(() => {
    if (accountId) void refresh();
  }, [accountId, refresh]);

  return (
    <AppShell>
      <PageContainer wide className="space-y-4 py-5 pb-28 sm:py-8 sm:pb-28">
        <SectionHeader title="Loja" />

        {!account || albumLoading ? (
          <Skeleton className="h-72 w-full rounded-2xl" aria-label="Carregando loja" />
        ) : albumError && !album ? (
          <StatusBanner tone="danger" title="Não foi possível carregar o saldo da conta">
            {albumError}{' '}
            <Button type="button" intent="ghost" onClick={() => void refresh()} className="ml-1 min-h-8 px-2 text-xs">TENTAR NOVAMENTE</Button>
          </StatusBanner>
        ) : !album ? (
          <Skeleton className="h-72 w-full rounded-2xl" aria-label="Carregando loja" />
        ) : (
          <Tabs value={category} onValueChange={value => setCategory(value as StoreCategory)}>
            <TabList aria-label="Categorias da loja" className="ui-tabs--equal">
              <Tab value="packs" className="inline-flex items-center gap-2"><PackageOpen size={15} aria-hidden="true" /><span>Pacotes</span></Tab>
              <Tab value="banners" className="inline-flex items-center gap-2"><Sparkles size={15} aria-hidden="true" /><span>Banners</span></Tab>
              <Tab value="customization" className="inline-flex items-center gap-2"><Palette size={15} aria-hidden="true" /><span>Aparência</span></Tab>
            </TabList>

            <StoreCategoryTab value="packs" title="Pacotes de cartas" description="Confira o conteúdo e as chances de cada pacote. Guarde para abrir quando quiser e venda cartas repetidas por moedas.">
              <AlbumPackShop />
            </StoreCategoryTab>

            <StoreCategoryTab value="banners" title="Banners" description="Escolha entre dois banners diários e veja as cartas disponíveis para sorteio.">
              <BannerShop />
            </StoreCategoryTab>

            <StoreCategoryTab value="customization" title="Aparência do perfil" description="Explore molduras, fundos e fontes para personalizar seu perfil.">
              <AppearanceShop />
            </StoreCategoryTab>
          </Tabs>
        )}
      </PageContainer>
      {account ? <AccountTabBar
        active="store"
        onNavigate={destination => {
          if (destination === 'home') {
            dispatch({ type: 'SET_PHASE', phase: 'menu' });
            return;
          }
          if (destination === 'store') return;
          dispatch({ type: 'SET_ACCOUNT_SECTION', section: destination });
        }}
      /> : null}
    </AppShell>
  );
}
