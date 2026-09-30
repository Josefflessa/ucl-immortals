import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock3, Crown, LogOut, Medal, Search, Shield, Sparkles, Trophy, UserRound, Users, X } from 'lucide-react';
import { useAccount, type CompetitionHistoryEntry, type FriendshipEntry, type PublicRecordEntry } from '../contexts/AccountContext';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS } from '../lib/gameData';
import { getCrest } from '../lib/crests';
import {
  AppShell,
  Badge,
  Button,
  Divider,
  EmptyState,
  Input,
  Metric,
  PageContainer,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  SectionHeader,
  Skeleton,
  StatusBanner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TopBar,
} from '../design-system';

const AVATAR_PRESETS = ['default-01', 'default-02', 'default-03', 'default-04', 'default-05', 'default-06'];
const COVER_PRESETS = ['cover-01', 'cover-02', 'cover-03', 'cover-04', 'cover-05', 'cover-06'];
const COVER_GRADIENTS: Record<string, string> = {
  'cover-01': 'linear-gradient(120deg, #17152d 0%, #31255b 48%, #9a7024 100%)',
  'cover-02': 'linear-gradient(120deg, #0c2330 0%, #0c5868 55%, #d0932f 100%)',
  'cover-03': 'linear-gradient(120deg, #26131d 0%, #6e2534 55%, #e4a332 100%)',
  'cover-04': 'linear-gradient(120deg, #101820 0%, #22445a 55%, #c9a84c 100%)',
  'cover-05': 'linear-gradient(120deg, #1b1029 0%, #532a76 52%, #e1a73b 100%)',
  'cover-06': 'linear-gradient(120deg, #1b211c 0%, #3d5d31 55%, #d5aa41 100%)',
};
const RECORD_LABELS: Record<PublicRecordEntry['category'], { label: string; icon: typeof Trophy; suffix: string }> = {
  goals: { label: 'Mais gols', icon: Trophy, suffix: 'gols' },
  assists: { label: 'Mais assistências', icon: Sparkles, suffix: 'assist.' },
  saves: { label: 'Mais defesas', icon: Shield, suffix: 'defesas' },
  effective_overall: { label: 'Maior geral efetivo', icon: Crown, suffix: 'GERAL' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function difficultyName(id: string): string {
  return DIFFICULTY_LEVELS.find(level => level.id === id)?.name ?? id;
}

function crestName(id: string | null | undefined): string {
  return id ? getCrest(id)?.name ?? id : 'Sem brasão';
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

function profileAvatar(avatarUrl: string | null, avatarKey: string, name: string, size = 'h-24 w-24') {
  if (avatarUrl) return <img src={avatarUrl} alt={`Foto de ${name}`} className={`${size} rounded-2xl object-cover ring-2 ring-[var(--ui-brand)]/60`} />;
  return <div className={`${size} flex items-center justify-center rounded-2xl bg-[var(--ui-brand)]/15 text-3xl font-black text-[var(--ui-brand-strong)] ring-2 ring-[var(--ui-brand)]/60`} aria-label={`Avatar de ${name}`}>{initials(name)}</div>;
}

function RecordCard({ record, rank }: { record: PublicRecordEntry; rank: number }) {
  const meta = RECORD_LABELS[record.category];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-3 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--ui-brand)]/10 font-display text-lg text-[var(--ui-brand-strong)]">{rank}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon size={13} className="flex-shrink-0 text-[var(--ui-brand-strong)]" />
          <strong className="truncate text-sm text-[var(--ui-text)]">{record.player_name}</strong>
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--ui-text-muted)]">
          @{record.username_snapshot} · {record.team_name_snapshot} · {crestName(record.crest_id_snapshot)}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="font-display text-2xl leading-none text-[var(--ui-brand-strong)]">{record.value}</div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--ui-text-faint)]">{meta.suffix}</div>
      </div>
    </div>
  );
}

function HistoryCard({ entry }: { entry: CompetitionHistoryEntry }) {
  const report = entry.report ?? {};
  const games = typeof report.games === 'number' ? report.games : typeof report.matches === 'number' ? report.matches : null;
  return (
    <Panel density="compact">
      <PanelBody className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)]">
              {entry.champion ? <Trophy size={19} /> : <Medal size={19} />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="truncate text-base text-[var(--ui-text)]">{entry.team_name}</strong>
                <Badge tone={entry.champion ? 'brand' : 'default'}>{entry.champion ? 'CAMPEÃO' : `#${entry.placement ?? '—'}`}</Badge>
              </div>
              <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{difficultyName(entry.difficulty_id)} · {entry.mode === 'online' ? 'Online' : 'Solo'}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--ui-text-faint)]"><Clock3 size={13} /> {formatDate(entry.completed_at)}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-[var(--ui-surface-inset)] p-2"><div className="text-[10px] uppercase tracking-wider text-[var(--ui-text-faint)]">Formato</div><div className="mt-1 text-xs font-bold text-[var(--ui-text)]">{entry.format_id}</div></div>
          <div className="rounded-lg bg-[var(--ui-surface-inset)] p-2"><div className="text-[10px] uppercase tracking-wider text-[var(--ui-text-faint)]">Partidas</div><div className="mt-1 text-xs font-bold text-[var(--ui-text)]">{games ?? '—'}</div></div>
          <div className="rounded-lg bg-[var(--ui-surface-inset)] p-2"><div className="text-[10px] uppercase tracking-wider text-[var(--ui-text-faint)]">Técnico</div><div className="mt-1 truncate text-xs font-bold text-[var(--ui-text)]">{entry.coach_id ?? '—'}</div></div>
          <div className="rounded-lg bg-[var(--ui-surface-inset)] p-2"><div className="text-[10px] uppercase tracking-wider text-[var(--ui-text-faint)]">Brasão</div><div className="mt-1 truncate text-xs font-bold text-[var(--ui-text)]">{crestName(entry.crest_id)}</div></div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function friendName(friend: FriendshipEntry, accountId: string): string {
  return friend.requester_id === accountId ? friend.addressee_display_name : friend.requester_display_name;
}

export default function AccountPage() {
  const { dispatch } = useGame();
  const { account, loading, loginWithGoogle, logout, updateProfile, getHistory, getRecords, getFriends, sendFriendRequest, updateFriendship } = useAccount();
  const [tab, setTab] = useState('profile');
  const [history, setHistory] = useState<CompetitionHistoryEntry[]>([]);
  const [records, setRecords] = useState<PublicRecordEntry[]>([]);
  const [friends, setFriends] = useState<FriendshipEntry[]>([]);
  const [profileForm, setProfileForm] = useState({ username: '', displayName: '', bio: '', avatarKey: '', coverKey: '' });
  const [friendUsername, setFriendUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!account) return;
    setProfileForm({ username: account.username, displayName: account.displayName, bio: account.bio, avatarKey: account.avatarKey, coverKey: account.coverKey });
  }, [account]);

  useEffect(() => {
    setError('');
    setNotice('');
    if (tab === 'history' && account) void getHistory().then(setHistory).catch(err => setError(err.message));
    if (tab === 'records') void getRecords().then(setRecords).catch(err => setError(err.message));
    if (tab === 'friends' && account) void getFriends().then(setFriends).catch(err => setError(err.message));
  }, [tab, account, getHistory, getRecords, getFriends]);

  const recordsByGroup = useMemo(() => {
    const groups = new Map<string, PublicRecordEntry[]>();
    for (const record of records) {
      const key = `${record.difficulty_id}:${record.category}`;
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([key, group]) => {
      const [difficulty, category] = key.split(':') as [string, PublicRecordEntry['category']];
      return { difficulty, category, records: group.slice(0, 10) };
    }).sort((a, b) => DIFFICULTY_LEVELS.findIndex(level => level.id === a.difficulty) - DIFFICULTY_LEVELS.findIndex(level => level.id === b.difficulty));
  }, [records]);

  const saveProfile = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await updateProfile(profileForm);
      setNotice('Perfil atualizado.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.'); }
    finally { setBusy(false); }
  };

  const addFriend = async () => {
    if (!friendUsername.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await sendFriendRequest(friendUsername.trim());
      setFriendUsername('');
      setNotice('Solicitação enviada.');
      setFriends(await getFriends());
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.'); }
    finally { setBusy(false); }
  };

  const actFriend = async (id: string, action: 'accept' | 'decline' | 'remove') => {
    setBusy(true); setError('');
    try { await updateFriendship(id, action); setFriends(await getFriends()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar a amizade.'); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <AppShell><TopBar title="CONTA UCL IMMORTALS" /><PageContainer narrow className="space-y-4 py-8"><Skeleton className="h-40 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-64 w-full" /></PageContainer></AppShell>;
  }

  if (!account) {
    return (
      <AppShell>
        <TopBar title="CONTA UCL IMMORTALS" right={<Button intent="ghost" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'menu' })}><ArrowLeft size={15} /> Voltar</Button>} />
        <PageContainer narrow className="flex min-h-[calc(100dvh-64px)] items-center py-8">
          <Panel className="w-full overflow-hidden">
            <div className="border-b border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-5 py-6 sm:px-8">
              <Badge tone="brand">CONTA OPCIONAL</Badge>
              <h1 className="mt-3 font-display text-4xl text-[var(--ui-text)]">Seu legado, salvo.</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ui-text-muted)]">Entre com o Google para guardar seu perfil, histórico de competições, recordes e amizades. O modo convidado continua local e separado, como sempre.</p>
            </div>
            <PanelBody className="space-y-4 p-5 sm:p-8">
              <Button intent="primary" size="large" className="w-full" onClick={() => loginWithGoogle('/')}><span className="inline-flex items-center gap-2"><LogOut size={18} className="rotate-180" /> CONTINUAR COM GOOGLE</span></Button>
              <div className="flex items-start gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 text-xs leading-relaxed text-[var(--ui-text-muted)]"><Shield size={15} className="mt-0.5 flex-shrink-0 text-[var(--ui-success)]" /> Sua conta não altera suas partidas de convidado e não exige senha criada no jogo.</div>
              <Button intent="ghost" className="w-full" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'menu' })}>Continuar como convidado</Button>
            </PanelBody>
          </Panel>
        </PageContainer>
      </AppShell>
    );
  }

  const pendingIncoming = friends.filter(friend => friend.status === 'pending' && friend.addressee_id === account.id);
  const acceptedFriends = friends.filter(friend => friend.status === 'accepted');
  const pendingOutgoing = friends.filter(friend => friend.status === 'pending' && friend.requester_id === account.id);
  const coverStyle = account.coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(7,9,16,.78), rgba(7,9,16,.24)), url(${account.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: COVER_GRADIENTS[account.coverKey] ?? COVER_GRADIENTS['cover-01'] };

  return (
    <AppShell>
      <TopBar title="UCL IMMORTALS — CONTA" right={<div className="flex items-center gap-2"><Button intent="ghost" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'menu' })}><ArrowLeft size={15} /> Menu</Button><Button intent="ghost" onClick={() => void logout()}><LogOut size={15} /> Sair</Button></div>} />
      <PageContainer wide className="space-y-5 py-5 sm:py-8">
        <Panel className="overflow-hidden">
          <div className="relative h-36 sm:h-44" style={coverStyle}>
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--ui-surface)] to-transparent" />
          </div>
          <PanelBody className="relative -mt-12 px-5 pb-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {profileAvatar(account.avatarUrl, account.avatarKey, account.displayName)}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2"><h1 className="truncate font-display text-3xl text-[var(--ui-text)]">{account.displayName}</h1><Badge tone="success">CONTA ATIVA</Badge></div>
                <div className="mt-1 text-sm text-[var(--ui-text-muted)]">@{account.username} · membro desde {formatDate(account.createdAt)}</div>
                {account.bio ? <p className="mt-2 max-w-2xl text-sm text-[var(--ui-text-muted)]">{account.bio}</p> : null}
              </div>
              <div className="flex items-center gap-2 pb-1 text-xs text-[var(--ui-text-faint)]"><Users size={14} /> {acceptedFriends.length} amigos</div>
            </div>
          </PanelBody>
        </Panel>

        {error ? <StatusBanner tone="danger" title="Não foi possível concluir">{error}</StatusBanner> : null}
        {notice ? <StatusBanner tone="success" title="Tudo certo">{notice}</StatusBanner> : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabList className="w-full overflow-x-auto">
            <Tab value="profile"><UserRound size={14} /> PERFIL</Tab>
            <Tab value="records"><Trophy size={14} /> RECORDES</Tab>
            <Tab value="history"><Clock3 size={14} /> HISTÓRICO</Tab>
            <Tab value="friends"><Users size={14} /> AMIGOS</Tab>
          </TabList>

          <TabPanel value="profile" className="space-y-5 pt-5">
            <SectionHeader kicker="CENTRAL DA CONTA" title="Seu perfil" description="Personalize sua identidade e acompanhe o que já construiu no UCL Immortals." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Competições" value={account.stats.competitionsCompleted} detail="campanhas concluídas" />
              <Metric label="Títulos" value={account.stats.titles} detail="conquistas" tone="brand" />
              <Metric label="Participações" value={`${account.stats.wins}V · ${account.stats.draws}E · ${account.stats.losses}D`} detail="campanhas registradas" />
              <Metric label="Geral efetivo" value={account.stats.highestEffectiveOverall || '—'} detail={account.stats.highestDifficultyId ? difficultyName(account.stats.highestDifficultyId) : 'ainda sem registro'} tone="success" />
            </div>
            <Panel>
              <PanelHeader><PanelTitle>IDENTIDADE DO JOGADOR</PanelTitle></PanelHeader>
              <PanelBody className="space-y-5 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2"><span className="ui-kicker">NOME DE USUÁRIO</span><Input value={profileForm.username} maxLength={24} onChange={event => setProfileForm(form => ({ ...form, username: event.target.value }))} /></label>
                  <label className="space-y-2"><span className="ui-kicker">NOME DE EXIBIÇÃO</span><Input value={profileForm.displayName} maxLength={40} onChange={event => setProfileForm(form => ({ ...form, displayName: event.target.value }))} /></label>
                </div>
                <label className="block space-y-2"><span className="ui-kicker">BIO</span><textarea value={profileForm.bio} maxLength={240} onChange={event => setProfileForm(form => ({ ...form, bio: event.target.value }))} className="ui-input min-h-24 w-full resize-y" placeholder="Conte um pouco sobre seu estilo de jogo..." /></label>
                <Divider />
                <div><div className="ui-kicker mb-3">AVATAR</div><div className="flex flex-wrap gap-2">{AVATAR_PRESETS.map(key => <button type="button" key={key} onClick={() => setProfileForm(form => ({ ...form, avatarKey: key }))} className={`flex h-12 w-12 items-center justify-center rounded-xl border text-sm font-black ${profileForm.avatarKey === key ? 'border-[var(--ui-brand)] bg-[var(--ui-brand)]/15 text-[var(--ui-brand-strong)]' : 'border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] text-[var(--ui-text-muted)]'}`}>{initials(key.replace('default-', 'Jogador '))}</button>)}</div></div>
                <div><div className="ui-kicker mb-3">FUNDO DO PERFIL</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{COVER_PRESETS.map(key => <button type="button" key={key} aria-label={`Selecionar ${key}`} onClick={() => setProfileForm(form => ({ ...form, coverKey: key }))} className={`h-12 rounded-lg border ${profileForm.coverKey === key ? 'border-[var(--ui-brand)] ring-2 ring-[var(--ui-brand)]/30' : 'border-[var(--ui-line-subtle)]'}`} style={{ background: COVER_GRADIENTS[key] }} />)}</div></div>
                <div className="flex justify-end"><Button intent="primary" loading={busy} onClick={() => void saveProfile()}><Check size={15} /> SALVAR PERFIL</Button></div>
              </PanelBody>
            </Panel>
          </TabPanel>

          <TabPanel value="records" className="space-y-5 pt-5">
            <SectionHeader kicker="LIVRO DE RECORDES" title="Marcas que ficam" description="Os quatro recordes principais, separados por dificuldade. Cada resultado mostra quem conseguiu e por qual time." />
            {recordsByGroup.length === 0 ? <EmptyState title="Ainda não há recordes públicos" description="Os recordes aparecem quando uma campanha solo com conta ou uma campanha online é concluída e validada pelo servidor." /> : <div className="grid gap-4 lg:grid-cols-2">{recordsByGroup.map(group => <Panel key={`${group.difficulty}-${group.category}`} density="compact"><PanelHeader><PanelTitle>{RECORD_LABELS[group.category].label}</PanelTitle><Badge tone="brand">{difficultyName(group.difficulty)}</Badge></PanelHeader><PanelBody className="space-y-2 p-3">{group.records.map((record: PublicRecordEntry, index: number) => <RecordCard key={record.id} record={record} rank={index + 1} />)}</PanelBody></Panel>)}</div>}
          </TabPanel>

          <TabPanel value="history" className="space-y-5 pt-5">
            <SectionHeader kicker="CAMPANHAS SALVAS" title="Histórico de competições" description="Cada entrada é a tela de resultado final da campanha, guardada somente na sua conta." />
            {history.length === 0 ? <EmptyState title="Nenhuma campanha salva ainda" description="Ao concluir uma competição conectado à sua conta, o resultado final aparecerá aqui." /> : <div className="space-y-3">{history.map(entry => <HistoryCard key={entry.id} entry={entry} />)}</div>}
          </TabPanel>

          <TabPanel value="friends" className="space-y-5 pt-5">
            <SectionHeader kicker="REDE DE JOGADORES" title="Amigos" description="Encontre outros técnicos, aceite solicitações e acompanhe quem está na sua rede." />
            <Panel><PanelBody className="flex flex-col gap-2 p-4 sm:flex-row"><div className="relative flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-[var(--ui-text-faint)]" /><Input className="pl-9" value={friendUsername} placeholder="Nome de usuário" onChange={event => setFriendUsername(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void addFriend(); }} /></div><Button intent="primary" loading={busy} onClick={() => void addFriend()}>ADICIONAR AMIGO</Button></PanelBody></Panel>
            {pendingIncoming.length > 0 ? <Panel><PanelHeader><PanelTitle>SOLICITAÇÕES RECEBIDAS</PanelTitle><Badge tone="brand">{pendingIncoming.length}</Badge></PanelHeader><PanelBody className="space-y-2 p-3">{pendingIncoming.map(friend => <div key={friend.id} className="flex items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ui-brand)]/10 text-sm font-black text-[var(--ui-brand-strong)]">{initials(friend.requester_display_name)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[var(--ui-text)]">{friend.requester_display_name}</div><div className="text-xs text-[var(--ui-text-muted)]">@{friend.requester_username}</div></div><Button intent="primary" onClick={() => void actFriend(friend.id, 'accept')}><Check size={14} /></Button><Button intent="ghost" onClick={() => void actFriend(friend.id, 'decline')}><X size={14} /></Button></div>)}</PanelBody></Panel> : null}
            <Panel><PanelHeader><PanelTitle>MINHA REDE</PanelTitle><Badge>{acceptedFriends.length}</Badge></PanelHeader><PanelBody className="space-y-2 p-3">{acceptedFriends.length === 0 ? <EmptyState title="Sua rede está vazia" description="Adicione alguém pelo nome de usuário para começar." /> : acceptedFriends.map(friend => <div key={friend.id} className="flex items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ui-brand)]/10 text-sm font-black text-[var(--ui-brand-strong)]">{initials(friendName(friend, account.id))}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[var(--ui-text)]">{friendName(friend, account.id)}</div><div className="text-xs text-[var(--ui-text-muted)]">Amigo desde {formatDate(friend.updated_at)}</div></div><Button intent="ghost" onClick={() => void actFriend(friend.id, 'remove')}><X size={14} /> Remover</Button></div>)}</PanelBody></Panel>
            {pendingOutgoing.length > 0 ? <div className="text-xs text-[var(--ui-text-faint)]">{pendingOutgoing.length} solicitação(ões) aguardando resposta.</div> : null}
          </TabPanel>
        </Tabs>
      </PageContainer>
    </AppShell>
  );
}
