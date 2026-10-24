// UCL Immortals — Menu Page
// Design: Dark Premium Gaming UI — hero with stadium background, gold accents

import { useHideChrome } from '../lib/chrome';
import SoundControl from '../components/account/SoundControl';
import AccountAvatar from '../components/account/AccountAvatar';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, LogIn, Send, UserRound, Users } from 'lucide-react';
import RoomOptionsMenu, { type RoomMenuAction } from '../components/game/RoomOptionsMenu';
import AccountTabBar from '../components/account/AccountTabBar';
import { useGame, type SavedSoloCampaign } from '../contexts/GameContext';
import { useAccount, type FriendshipEntry } from '../contexts/AccountContext';
import { DIFFICULTY_LEVELS } from '@shared/game/gameData';
import { competitionFormatSummary, createCompetitionFormat } from '@shared/game/competition';
import { cn } from '../lib/utils';
import { AppShell, Button, ConfirmDialog, EmptyState, GameModal, Input, Panel, StatusBanner } from '../design-system';
import StyledName from '../components/account/StyledName';
import HomeDashboard from '../components/home/HomeDashboard';

const LOGO_URL = '/icons/logo_ucl.png';

function friendIdentity(friendship: FriendshipEntry, accountId: string | undefined) {
  if (friendship.requester_id === accountId) {
    return { username: friendship.addressee_username, displayName: friendship.addressee_display_name, avatarKey: friendship.addressee_avatar_key, nameStyleKey: friendship.addressee_name_style_key };
  }
  return { username: friendship.requester_username, displayName: friendship.requester_display_name, avatarKey: friendship.requester_avatar_key, nameStyleKey: friendship.requester_name_style_key };
}

function soloCampaignStageLabel(save: SavedSoloCampaign): string {
  if (save.phase === 'league') return `Rodada ${save.leagueRound}`;
  if (save.phase === 'knockout') return 'Mata-mata';
  if (save.phase === 'match_sim') return 'Partida em andamento';
  if (save.phase === 'report') return 'Relatório final';
  return 'Montando o elenco';
}

export default function MenuPage() {
  const {
    state,
    dispatch,
    createRoom,
    joinRoom,
    startSetupOnline,
    leaveRoomOnline,
    closeRoomOnline,
    restartRoomOnline,
    transferHostOnline,
    removePlayerOnline,
    savedSoloCampaign,
    soloCampaignSyncStatus,
    continueSoloCampaign,
    discardSoloCampaign,
  } = useGame();
  const {
    account,
    loading: accountLoading,
    getFriends,
    inviteFriendToRoom,
  } = useAccount();
  const [menuMode, setMenuMode] = useState<'selection' | 'online' | 'online_join'>('selection');
  // The room options (create / join) stand alone on the screen: no top bar, no logo.
  useHideChrome(menuMode !== 'selection' && !!account);
  const [soloSaveConfirm, setSoloSaveConfirm] = useState<'choose' | 'new' | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomAction, setRoomAction] = useState<RoomMenuAction | null>(null);
  const [friendships, setFriendships] = useState<FriendshipEntry[]>([]);
  const [incomingFriendRequestCount, setIncomingFriendRequestCount] = useState(0);
  const [roomInviteActionId, setRoomInviteActionId] = useState<string | null>(null);
  const [roomInviteFriendsOpen, setRoomInviteFriendsOpen] = useState(false);
  const [sentRoomInviteFriendships, setSentRoomInviteFriendships] = useState<string[]>([]);
  const [roomInviteError, setRoomInviteError] = useState('');
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const difficultyName = DIFFICULTY_LEVELS.find(level => level.id === state.difficulty)?.name ?? state.difficulty;


  useEffect(() => {
    // Reset only when the lobby is actually left. Including `menuMode` here
    // makes every click on SOLO/ONLINE immediately revert to the selection
    // screen, because both flows start while the app is still in phase `menu`.
    if (!state.roomCode && state.phase === 'menu') {
      setMenuMode('selection');
    }
  }, [state.phase, state.roomCode]);

  const refreshInbox = useCallback(async () => {
    if (!account) return;
    try {
      const nextFriendships = await getFriends();
      setFriendships(nextFriendships);
      setIncomingFriendRequestCount(nextFriendships.filter(friendship =>
        friendship.status === 'pending' && friendship.addressee_id === account.id,
      ).length);
    } catch {
      // Keep the last known requests if the inbox is briefly unavailable.
    }
  }, [account, getFriends]);

  useEffect(() => {
    if (!account) {
      setFriendships([]);
      setIncomingFriendRequestCount(0);
      return;
    }

    let active = true;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void getFriends().then(nextFriendships => {
        if (!active) return;
        setFriendships(nextFriendships);
        setIncomingFriendRequestCount(nextFriendships.filter(friendship =>
          friendship.status === 'pending' && friendship.addressee_id === account.id,
        ).length);
      }).catch(() => {
        // Keep the last known friendship badge if the network is unavailable.
      });
    };

    refreshWhenVisible();
    const interval = window.setInterval(refreshWhenVisible, 10_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [account?.id, getFriends]);

  const acceptedFriends = account
    ? friendships.filter(friendship => friendship.status === 'accepted')
    : [];

  const inviteFriendToCurrentRoom = async (friendshipId: string) => {
    if (!state.roomCode) return;
    setRoomInviteActionId(friendshipId);
    setRoomInviteError('');
    try {
      const result = await inviteFriendToRoom(state.roomCode, friendshipId);
      setSentRoomInviteFriendships(current => current.includes(friendshipId) ? current : [...current, friendshipId]);
      window.setTimeout(() => {
        setSentRoomInviteFriendships(current => current.filter(id => id !== friendshipId));
      }, Math.max(0, result.expiresAt - Date.now()));
      if (result.duplicate) setRoomInviteError('Esse amigo já tem um convite pendente para esta sala.');
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : '';
      const messages: Record<string, string> = {
        host_only: 'Só o anfitrião pode convidar amigos.',
        room_not_available: 'A competição dessa sala já começou.',
        room_full: 'A sala já está cheia.',
        friend_already_in_room: 'Esse amigo já está na sala.',
        friend_unavailable: 'Esse amigo está em uma partida no momento.',
        accepted_friendship_required: 'Só é possível convidar amigos que já aceitaram seu pedido.',
      };
      setRoomInviteError(messages[errorCode] ?? 'Não foi possível enviar o convite. Tente novamente.');
    } finally {
      setRoomInviteActionId(null);
    }
  };

  /** Solo goes straight to the difficulty; the team's name comes later, with its crest. */
  const handlePlaySolo = () => {
    dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: null });
    dispatch({ type: 'SET_TEAM_NAME', name: '' });
    dispatch({ type: 'SET_PLAYER_NAME', name: account?.displayName ?? '' });
    if (account) {
      // Ranked play: fixed format, free difficulty (chosen on the next screen).
      dispatch({ type: 'SET_COMPETITION_FORMAT', format: createCompetitionFormat('league_knockout') });
      dispatch({ type: 'SET_PHASE', phase: 'setup' });
      return;
    }
    dispatch({ type: 'SET_PHASE', phase: 'format' });
  };

  /** In the lobby a player is who they are: the profile name when signed in, the typed name otherwise. */
  const lobbyName = account ? account.displayName : playerName.trim();

  const handleCreateRoom = () => {
    if (!lobbyName) return;
    if (account) {
      dispatch({ type: 'SET_PLAYER_NAME', name: lobbyName });
      dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: 'create' });
      dispatch({ type: 'SET_COMPETITION_FORMAT', format: createCompetitionFormat('league_knockout') });
      dispatch({ type: 'SET_PHASE', phase: 'setup' });
      return;
    }
    dispatch({ type: 'SET_PLAYER_NAME', name: lobbyName });
    dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: 'create' });
    dispatch({ type: 'SET_PHASE', phase: 'format' });
  };

  const handleJoinRoom = () => {
    if (!lobbyName || !roomCodeInput.trim()) return;
    joinRoom(roomCodeInput.trim().toUpperCase(), lobbyName);
  };

  const handleRoomAction = (action: RoomMenuAction) => {
    setRoomAction(action);
  };

  const handleTransferHost = (playerId: string) => {
    const target = state.onlinePlayers.find(player => player.id === playerId);
    if (target) setTransferTarget({ id: target.id, name: target.name });
  };

  const handleRemovePlayer = (playerId: string) => {
    const target = state.onlinePlayers.find(player => player.id === playerId && player.id !== state.onlineHostId);
    if (target) setRemoveTarget({ id: target.id, name: target.name });
  };

  // If already in lobby, render Lobby view
  if (state.roomCode && state.phase === 'lobby') {
    return (
      <AppShell immersive className="relative overflow-hidden">
        
        <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <img src={LOGO_URL} alt="UCL Logo" className="w-10 h-10 object-contain" />
            <h2 className="text-2xl font-black tracking-widest text-primary" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              SALA ONLINE
            </h2>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="ui-panel w-full p-5"
          >
            {/* Room Code Header */}
            <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--ui-surface-3)' }}>
              <div className="min-w-0 flex-1 text-center">
                <span className="text-caption font-bold text-gray-500 tracking-wide-caps block uppercase" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  CÓDIGO DA SALA
                </span>
                <span className="text-4xl font-black text-yellow-500 tracking-wider block mt-1" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                  {state.roomCode}
                </span>
              </div>
              <RoomOptionsMenu
                isHost={state.isHost}
                onAction={handleRoomAction}
                roomCode={state.roomCode}
                players={state.onlinePlayers}
                hostId={state.onlineHostId}
                onTransferHost={handleTransferHost}
                onRemovePlayer={handleRemovePlayer}
              />
            </div>

            {state.isHost ? (
              <div className="mt-4">
                {account ? (
                  <Button
                    type="button"
                    intent="ghost"
                    onClick={() => {
                      setRoomInviteError('');
                      setSentRoomInviteFriendships([]);
                      setRoomInviteFriendsOpen(true);
                      void refreshInbox();
                    }}
                    className="w-full border border-[var(--ui-line-subtle)]"
                  >
                    <span className="inline-flex items-center justify-center gap-2"><Users size={16} /> CONVIDAR AMIGOS</span>
                  </Button>
                ) : (
                  <p className="text-center text-xs text-[var(--ui-text-muted)]">Entre na sua conta para convidar amigos.</p>
                )}
              </div>
            ) : null}

            {/* Players List */}
            <div className="my-4">
              <span className="text-caption font-bold text-primary tracking-wide-caps block uppercase mb-3" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                JOGADORES CONECTADOS ({state.onlinePlayers.length})
              </span>
              <div className="space-y-2">
                {state.onlinePlayers.map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border" 
                    style={{ background: '#08080f', borderColor: '#171725' }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {p.profile ? (
                        <AccountAvatar
                          name={p.name}
                          avatarKey={p.profile.avatarKey}
                          avatarUrl={p.profile.avatarUrl}
                          backgroundKey={p.profile.avatarBackgroundKey}
                          frameKey={p.profile.avatarFrameKey}
                          sizeClassName="size-11"
                        />
                      ) : null}
                      <span className="min-w-0 truncate font-bold text-white text-sm" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        {p.profile?.nameStyleKey ? <StyledName name={p.name} styleKey={p.profile.nameStyleKey} size="sm" /> : p.name} {p.socketId === state.socketId && <span className="text-xs text-primary font-normal">(Você)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-label text-green-500 font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        {p.id === state.onlineHostId ? 'ANFITRIÃO' : 'PRONTO'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Options */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ui-surface-3)' }}>
              <span className="text-caption font-bold text-primary tracking-wide-caps block uppercase" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                FORMATO DA COMPETIÇÃO
              </span>
              <p className="mt-1 text-body-sm leading-relaxed text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                {competitionFormatSummary(state.competitionFormat)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ background: '#08080f', borderColor: '#171725' }}>
                <span className="text-label font-bold tracking-widest text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>DIFICULDADE DOS BOTS</span>
                <span className="text-caption font-black uppercase tracking-wide-caps text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{difficultyName}</span>
              </div>
            </div>

            {/* Host progression */}
            {state.isHost ? (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ui-surface-3)' }}>
                <Button
                  type="button"
                  intent="primary"
                  size="large"
                  onClick={startSetupOnline}
                  disabled={state.onlinePlayers.length < 2}
                  className="w-full"
                >
                  {state.onlinePlayers.length >= 2 ? 'INICIAR COMPETIÇÃO →' : 'AGUARDANDO JOGADORES (MÍN. 2)'}
                </Button>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: 'var(--ui-surface-3)' }}>
                <div className="flex items-center justify-center gap-2 mb-2 text-xs font-bold text-gray-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-yellow-500 animate-spin flex-shrink-0" />
                  <span>AGUARDANDO O ANFITRIÃO INICIAR O JOGO…</span>
                </div>
              </div>
            )}
          </motion.div>

          <ConfirmDialog
            open={roomAction !== null}
            onOpenChange={(open) => { if (!open) setRoomAction(null); }}
            title={roomAction === 'restart' ? 'Reiniciar competição?' : roomAction === 'close' ? 'Encerrar sala?' : 'Sair da sala?'}
            description={roomAction === 'restart'
              ? 'A competição será zerada para todos, mantendo os jogadores na sala.'
              : roomAction === 'close'
                ? 'A sala será encerrada para todos e não poderá mais ser reaberta.'
                : state.isHost
                  ? 'Você sairá da sala e o anfitrião passará imediatamente para outro jogador conectado.'
                  : 'Você sairá da sala. Para voltar, entre novamente com o mesmo código e nome enquanto ela existir.'}
            confirmLabel={roomAction === 'restart' ? 'Reiniciar' : roomAction === 'close' ? 'Encerrar sala' : 'Sair da sala'}
            onConfirm={() => {
              const action = roomAction;
              setRoomAction(null);
              if (action === 'restart') restartRoomOnline();
              if (action === 'close') closeRoomOnline();
              if (action === 'leave') {
                leaveRoomOnline();
                setMenuMode('selection');
              }
            }}
          />

          <ConfirmDialog
            open={transferTarget !== null}
            onOpenChange={(open) => { if (!open) setTransferTarget(null); }}
            title="Transferir anfitrião?"
            description={`A partir de agora, ${transferTarget?.name ?? 'esse jogador'} controlará o início, reinício e encerramento da sala.`}
            confirmLabel="Transferir anfitrião"
            intent="primary"
            onConfirm={() => {
              if (transferTarget) transferHostOnline(transferTarget.id);
              setTransferTarget(null);
            }}
          />

          <ConfirmDialog
            open={removeTarget !== null}
            onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
            title="Remover jogador?"
            description={`${removeTarget?.name ?? 'Esse jogador'} será removido imediatamente da sala e não poderá reconectar usando este dispositivo.`}
            confirmLabel="Remover jogador"
            intent="danger"
            onConfirm={() => {
              if (removeTarget) removePlayerOnline(removeTarget.id);
              setRemoveTarget(null);
            }}
          />

          <GameModal
            open={roomInviteFriendsOpen}
            onOpenChange={setRoomInviteFriendsOpen}
            title="CONVIDAR AMIGOS"
            subtitle="Convide mesmo com o amigo offline. O convite vale 5 minutos; ele só recebe o aviso se tiver ativado as notificações."
            size="wide"
          >
            <div className="space-y-3">
              {roomInviteError ? <StatusBanner tone="danger" role="alert">{roomInviteError}</StatusBanner> : null}
              {acceptedFriends.length === 0 ? (
                <EmptyState title="Você ainda não tem amigos" description="Adicione amigos e aguarde eles aceitarem para poder convidá-los para uma sala." />
              ) : (
                acceptedFriends.map(friendship => {
                  const friend = friendIdentity(friendship, account?.id);
                  const sent = sentRoomInviteFriendships.includes(friendship.id);
                  const busy = roomInviteActionId === friendship.id;
                  const canInvite = !friendship.is_busy && !sent && roomInviteActionId === null;
                  return (
                    <div key={friendship.id} className="flex items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)] p-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ui-brand)]/15 text-sm font-bold text-[var(--ui-brand-strong)]">
                        {friend.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 max-w-full text-sm font-semibold text-[var(--ui-text)]"><StyledName name={friend.displayName} styleKey={friend.nameStyleKey} size="sm" /></div>
                        <div className="truncate text-xs text-[var(--ui-text-muted)]">@{friend.username}</div>
                        <div className={cn(
                          'mt-1 text-label font-bold uppercase tracking-wider',
                          friendship.is_available ? 'text-emerald-400' : 'text-[var(--ui-text-muted)]',
                        )}>
                          {friendship.is_available ? 'DISPONÍVEL' : friendship.is_busy ? 'EM PARTIDA' : 'OFFLINE'}
                        </div>
                      </div>
                      <Button
                        type="button"
                        intent={sent ? 'success' : 'secondary'}
                        loading={busy}
                        disabled={!canInvite}
                        onClick={() => void inviteFriendToCurrentRoom(friendship.id)}
                        className="shrink-0 px-3 text-xs"
                      >
                        {sent ? <><Check size={14} /> ENVIADO</> : <><Send size={14} /> CONVIDAR</>}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </GameModal>
        </div>
      </AppShell>
    );
  }

  // Home: the dashboard (featured action, modes, progress). The room steps below keep their own layout.
  if (menuMode === 'selection') {
    return (
      <AppShell>
        {!account ? (
          <div className="flex items-center justify-end gap-2 px-4 pt-4 sm:px-6 xl:hidden">
            <SoundControl />
            <Button type="button" intent="secondary" size="small" disabled={accountLoading} onClick={() => dispatch({ type: 'SET_PHASE', phase: 'account' })}>
              <UserRound size={15} aria-hidden="true" /> Entrar
            </Button>
          </div>
        ) : null}
        <HomeDashboard
          hasAccount={!!account}
          busy={accountLoading || (!!account && soloCampaignSyncStatus === 'syncing')}
          savedCampaign={savedSoloCampaign}
          stageLabel={savedSoloCampaign ? soloCampaignStageLabel(savedSoloCampaign) : null}
          onContinue={() => { void continueSoloCampaign(); }}
          onNewCampaign={() => setSoloSaveConfirm('new')}
          onPlaySolo={handlePlaySolo}
          onOnline={() => setMenuMode('online')}
          onAlbum={() => dispatch({ type: 'SET_PHASE', phase: 'album' })}
          onAchievements={() => dispatch({ type: 'SET_PHASE', phase: 'achievements' })}
          onEvents={() => dispatch({ type: 'SET_PHASE', phase: 'events' })}
          onRankings={() => dispatch({ type: 'SET_ACCOUNT_SECTION', section: 'records' })}
          onLogin={() => dispatch({ type: 'SET_PHASE', phase: 'account' })}
        />
        {account ? (
          <AccountTabBar
            active="home"
            incomingFriendRequestCount={incomingFriendRequestCount}
            onNavigate={tab => {
              if (tab === 'home') return;
              if (tab === 'store') { dispatch({ type: 'SET_PHASE', phase: 'store' }); return; }
              dispatch({ type: 'SET_ACCOUNT_SECTION', section: tab });
            }}
          />
        ) : null}
        <ConfirmDialog
          open={soloSaveConfirm === 'new'}
          onOpenChange={open => { if (!open) setSoloSaveConfirm(null); }}
          title="Começar nova campanha?"
          description={`A campanha salva${savedSoloCampaign ? ` (${savedSoloCampaign.teamName})` : ''} será substituída pela nova.`}
          confirmLabel="Começar nova"
          onConfirm={() => { setSoloSaveConfirm(null); void discardSoloCampaign().then(handlePlaySolo); }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell immersive className="relative overflow-hidden">

      {/* Content */}
      {!account ? (
        <div className="absolute inset-x-4 top-4 z-20 flex items-center justify-end gap-2 sm:inset-x-6 sm:top-6 xl:hidden">
          <SoundControl />
          <div className="shrink-0">
            <Button
              type="button"
              intent="ghost"
              disabled={accountLoading}
              onClick={() => dispatch({ type: 'SET_PHASE', phase: 'account' })}
              className="w-20 min-h-9 justify-center border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/90 px-1 text-label min-[380px]:w-24 min-[380px]:px-2 min-[380px]:text-xs"
            >
              <UserRound size={15} aria-hidden="true" /> ENTRAR
            </Button>
          </div>
        </div>
      ) : null}

      <div className={cn(
        'relative z-10 flex flex-col items-center px-4',
        account ? 'min-h-dvh py-8' : 'min-h-dvh pb-4 pt-20 sm:pt-24 xl:min-h-0 xl:pb-8 xl:pt-6',
      )}>
        <div aria-hidden="true" className="flex-1" />

        {/* Dynamic Mode Forms */}
        <div className="flex w-full justify-center">
          {menuMode === 'online' && (
            <div
              className="w-full max-w-xs space-y-4 lg:max-w-sm"
            >
              {!account ? (
                <div>
                  <label className="mb-2 block text-caption font-bold tracking-wide-caps text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                    SEU NOME
                  </label>
                  <Input
                    type="text"
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    placeholder="Como você quer aparecer na sala"
                    maxLength={20}
                    autoFocus
                    className="ui-input mb-3"
                  />
                </div>
              ) : null}

              {!account ? (
                <Panel tone="inset" className="space-y-3 p-3">
                  <div>
                    <div className="text-caption font-bold tracking-wide-caps text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      CONFIGURAÇÃO DA PARTIDA
                    </div>
                    <p className="mt-1 text-body-sm leading-relaxed text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      Ao criar uma sala, você define o formato e a dificuldade nas próximas telas. Depois, o código reúne todos na mesma competição.
                    </p>
                  </div>
                  <p className="text-label leading-relaxed text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                    Para entrar em uma sala existente, basta informar o código — as configurações vêm do anfitrião.
                  </p>
                </Panel>
              ) : null}

              <div className={account ? 'flex flex-col gap-3' : 'grid grid-cols-2 gap-2'}>
                <Button
                  type="button"
                  intent="primary"
                  size={account ? 'large' : undefined}
                  onClick={handleCreateRoom}
                  disabled={!lobbyName}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Plus size={16} strokeWidth={3} /> CRIAR SALA
                  </span>
                </Button>
                <Button
                  type="button"
                  intent="secondary"
                  size={account ? 'large' : undefined}
                  onClick={() => setMenuMode('online_join')}
                  disabled={!lobbyName}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <LogIn size={16} strokeWidth={3} /> ENTRAR EM SALA
                  </span>
                </Button>
              </div>

              <Button
                type="button"
                intent="ghost"
                onClick={() => setMenuMode('selection')}
                className="w-full"
              >
                Voltar ao Menu principal
              </Button>
            </div>
          )}

          {menuMode === 'online_join' && (
            <div
              className="w-full max-w-xs space-y-4 lg:max-w-sm"
            >
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-caption font-bold tracking-wide-caps text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                    CÓDIGO DA SALA (4 LETRAS)
                  </label>
                  <Input
                    type="text"
                    value={roomCodeInput}
                    onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="EX: ABCD"
                    maxLength={4}
                    autoFocus
                    className="ui-input text-center font-display text-xl tracking-widest"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  intent="ghost"
                  onClick={() => setMenuMode('online')}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  intent="primary"
                  onClick={handleJoinRoom}
                  disabled={!roomCodeInput.trim() || roomCodeInput.length < 4}
                  className="flex-1"
                >
                  CONECTAR SALA ✓
                </Button>
              </div>
            </div>
          )}
        </div>

        <div aria-hidden="true" className="flex-1" />
      </div>


    </AppShell>
  );
}
