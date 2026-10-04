// UCL Immortals — Menu Page
// Design: Dark Premium Gaming UI — hero with stadium background, gold accents

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Gamepad2, Medal, Play, Trophy, Plus, LogIn, LibraryBig, Send, UserRound, Users, X } from 'lucide-react';
import RoomOptionsMenu, { type RoomMenuAction } from '../components/game/RoomOptionsMenu';
import AccountTabBar from '../components/account/AccountTabBar';
import { useGame, type SavedSoloCampaign } from '../contexts/GameContext';
import { useAccount, type FriendshipEntry } from '../contexts/AccountContext';
import { DIFFICULTY_LEVELS } from '@shared/game/gameData';
import { competitionStagePoints, type RankedDifficultyId } from '@shared/game/competitionRanking';
import { COMPETITION_FORMAT_PRESETS, competitionFormatSummary, createCompetitionFormat } from '@shared/game/competition';
import { cn } from '../lib/utils';
import { resolveProfileAvatarImage } from '../lib/profileAvatars';
import { getProfileAvatarBackground } from '@shared/profileAppearance';
import { AppShell, Button, ConfirmDialog, EmptyState, GameModal, Input, Panel, StatusBanner } from '../design-system';

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-hero-bg-h6Wx2jrfCPsrWkvEcMdhqo.webp';
const LOGO_URL = '/icons/logo_ucl.png';
const COMPETITIVE_FORMAT = createCompetitionFormat('league_knockout');

function friendIdentity(friendship: FriendshipEntry, accountId: string | undefined) {
  if (friendship.requester_id === accountId) {
    return { username: friendship.addressee_username, displayName: friendship.addressee_display_name, avatarKey: friendship.addressee_avatar_key };
  }
  return { username: friendship.requester_username, displayName: friendship.requester_display_name, avatarKey: friendship.requester_avatar_key };
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
    continueSoloCampaign,
    discardSoloCampaign,
  } = useGame();
  const {
    account,
    loading: accountLoading,
    getFriends,
    inviteFriendToRoom,
    updateFriendship,
  } = useAccount();
  const [menuMode, setMenuMode] = useState<'selection' | 'solo' | 'online' | 'online_join'>('selection');
  const [soloSaveConfirm, setSoloSaveConfirm] = useState<'choose' | 'new' | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomAction, setRoomAction] = useState<RoomMenuAction | null>(null);
  const [guestModeInfoOpen, setGuestModeInfoOpen] = useState(false);
  const [friendships, setFriendships] = useState<FriendshipEntry[]>([]);
  const [incomingFriendRequestCount, setIncomingFriendRequestCount] = useState(0);
  const [friendNotificationsOpen, setFriendNotificationsOpen] = useState(false);
  const [friendNotificationError, setFriendNotificationError] = useState('');
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
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

  const incomingFriendRequests = account
    ? friendships.filter(friendship => friendship.status === 'pending' && friendship.addressee_id === account.id)
    : [];
  const profileImage = account ? account.avatarUrl || resolveProfileAvatarImage(account.avatarKey) : null;
  const acceptedFriends = account
    ? friendships.filter(friendship => friendship.status === 'accepted')
    : [];

  const handleFriendNotification = async (friendshipId: string, action: 'accept' | 'decline') => {
    setFriendActionId(friendshipId);
    setFriendNotificationError('');
    try {
      await updateFriendship(friendshipId, action);
      await refreshInbox();
    } catch (error) {
      setFriendNotificationError(error instanceof Error ? error.message : 'Não foi possível atualizar o pedido de amizade.');
    } finally {
      setFriendActionId(null);
    }
  };

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
        room_not_available: 'A sala não está mais no lobby.',
        room_full: 'A sala já está cheia.',
        friend_already_in_room: 'Esse amigo já está na sala.',
        friend_unavailable: 'Esse amigo está offline ou ocupado em uma sala/competição.',
        accepted_friendship_required: 'Só é possível convidar amigos que já aceitaram seu pedido.',
      };
      setRoomInviteError(messages[errorCode] ?? 'Não foi possível enviar o convite. Tente novamente.');
    } finally {
      setRoomInviteActionId(null);
    }
  };

  const handlePlaySolo = () => {
    if (!playerName.trim()) return;
    dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: null });
    dispatch({ type: 'SET_PLAYER_NAME', name: playerName.trim() });
    if (account) {
      // Ranked play: fixed format, free difficulty (chosen on the next screen).
      dispatch({ type: 'SET_COMPETITION_FORMAT', format: createCompetitionFormat('league_knockout') });
      dispatch({ type: 'SET_PHASE', phase: 'setup' });
      return;
    }
    dispatch({ type: 'SET_PHASE', phase: 'format' });
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    if (account) {
      dispatch({ type: 'SET_PLAYER_NAME', name: playerName.trim() });
      dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: 'create' });
      dispatch({ type: 'SET_COMPETITION_FORMAT', format: createCompetitionFormat('league_knockout') });
      dispatch({ type: 'SET_PHASE', phase: 'setup' });
      return;
    }
    dispatch({ type: 'SET_PLAYER_NAME', name: playerName.trim() });
    dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: 'create' });
    dispatch({ type: 'SET_PHASE', phase: 'format' });
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || !roomCodeInput.trim()) return;
    joinRoom(roomCodeInput.trim().toUpperCase(), playerName.trim());
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
      <AppShell immersive backgroundImage={HERO_BG} className="relative overflow-hidden">
        
        <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <img src={LOGO_URL} alt="UCL Logo" className="w-10 h-10 object-contain" />
            <h2 className="text-2xl font-black tracking-widest text-primary" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              LOBBY MULTIPLAYER
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
                <span className="text-xs font-bold text-gray-500 tracking-widest block uppercase" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
              <span className="text-xs font-bold text-primary tracking-widest block uppercase mb-3" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                JOGADORES CONECTADOS ({state.onlinePlayers.length})
              </span>
              <div className="space-y-2">
                {state.onlinePlayers.map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between p-2.5 rounded-lg border" 
                    style={{ background: '#08080f', borderColor: '#171725' }}
                  >
                    <span className="font-bold text-white text-sm" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      {p.name} {p.socketId === state.socketId && <span className="text-xs text-primary font-normal">(Você)</span>}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[12px] text-green-500 font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        {p.id === state.onlineHostId ? 'ANFITRIÃO' : 'PRONTO'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Options */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ui-surface-3)' }}>
              <span className="text-xs font-bold text-primary tracking-widest block uppercase" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                FORMATO DA COMPETIÇÃO
              </span>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                {competitionFormatSummary(state.competitionFormat)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ background: '#08080f', borderColor: '#171725' }}>
                <span className="text-[12px] font-bold tracking-widest text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>DIFICULDADE DOS BOTS</span>
                <span className="text-xs font-black uppercase tracking-wider text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{difficultyName}</span>
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
                  {state.onlinePlayers.length >= 2 ? 'INICIAR PARTIDA →' : 'AGUARDANDO JOGADORES (MÍN. 2)'}
                </Button>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: 'var(--ui-surface-3)' }}>
                <div className="flex items-center justify-center gap-2 mb-2 text-xs font-bold text-gray-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-yellow-500 animate-spin flex-shrink-0" />
                  <span>AGUARDANDO O ANFITRIÃO INICIAR O JOGO...</span>
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
            confirmLabel="Transferir host"
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
            subtitle="Só amigos online e disponíveis. O convite expira em 1 minuto."
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
                  const canInvite = friendship.is_online && friendship.is_available && !sent && roomInviteActionId === null;
                  return (
                    <div key={friendship.id} className="flex items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)] p-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ui-brand)]/15 text-sm font-bold text-[var(--ui-brand-strong)]">
                        {friend.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--ui-text)]">{friend.displayName}</div>
                        <div className="truncate text-xs text-[var(--ui-text-muted)]">@{friend.username}</div>
                        <div className={cn(
                          'mt-1 text-[12px] font-bold uppercase tracking-wider',
                          friendship.is_available ? 'text-emerald-400' : 'text-[var(--ui-text-muted)]',
                        )}>
                          {friendship.is_available ? 'DISPONÍVEL' : friendship.is_busy ? 'OCUPADO' : 'OFFLINE'}
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

  return (
    <AppShell immersive backgroundImage={HERO_BG} className="relative overflow-hidden">

      {/* Content */}
      {account ? (
        <>
          <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
            <Button
              type="button"
              intent="ghost"
              aria-label={incomingFriendRequestCount > 0
                ? `Solicitações de amizade, ${incomingFriendRequestCount} pendentes`
                : 'Solicitações de amizade'}
              title="Solicitações de amizade"
              onClick={() => {
                setFriendNotificationError('');
                setFriendNotificationsOpen(true);
                void refreshInbox();
              }}
              className="relative size-11 min-h-11 w-11 justify-center rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/90 p-0"
            >
              <Bell size={19} aria-hidden="true" />
              {incomingFriendRequestCount > 0 ? (
                <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--ui-bg)] bg-[var(--ui-danger)] px-1 text-[12px] font-bold leading-none tabular-nums text-white">
                  {incomingFriendRequestCount > 9 ? '9+' : incomingFriendRequestCount}
                </span>
              ) : null}
            </Button>
          </div>
          {/* The profile lives here instead of the tab bar: photo + name, top right. */}
          <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
            <button
              type="button"
              aria-label="Abrir perfil"
              onClick={() => dispatch({ type: 'SET_ACCOUNT_SECTION', section: 'profile' })}
              className="flex min-h-11 max-w-[11rem] items-center gap-2 rounded-full border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/90 py-1 pl-1 pr-3.5 transition-colors hover:border-[var(--ui-brand)]/50 sm:max-w-[14rem]"
            >
              <span
                aria-hidden="true"
                className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ui-brand)]/60 text-xs font-bold text-[var(--ui-text)]"
                style={{ backgroundColor: getProfileAvatarBackground(account.avatarBackgroundKey).color }}
              >
                {/* Initial only when there is no portrait (they have transparent backgrounds). */}
                <span hidden={!!profileImage}>{account.displayName.trim().charAt(0).toUpperCase()}</span>
                {profileImage ? <img key={profileImage} src={profileImage} alt="" className={cn('absolute inset-0 size-full', account.avatarUrl ? 'object-cover' : 'object-contain')} onError={event => {
                  event.currentTarget.style.display = 'none';
                  const fallback = event.currentTarget.previousElementSibling as HTMLElement | null;
                  if (fallback) fallback.hidden = false;
                }} /> : null}
              </span>
              <span className="truncate text-xs font-bold text-[var(--ui-text)]">{account.displayName}</span>
            </button>
          </div>
        </>
      ) : (
        <div className="absolute inset-x-4 top-4 z-20 flex items-center justify-end gap-2 sm:inset-x-6 sm:top-6">
          <div className="shrink-0">
            <Button
              type="button"
              intent="ghost"
              disabled={accountLoading}
              onClick={() => dispatch({ type: 'SET_PHASE', phase: 'account' })}
              className="w-20 min-h-9 justify-center border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)]/90 px-1 text-[12px] min-[380px]:w-24 min-[380px]:px-2 min-[380px]:text-xs"
            >
              <UserRound size={15} aria-hidden="true" /> ENTRAR
            </Button>
          </div>
        </div>
      )}

      <div className={cn('relative z-10 flex min-h-dvh flex-col items-center px-4 pt-20 sm:pt-24', account ? 'pb-24' : 'pb-4')}>
        {/* Spacers keep the content centred and the signature in flow, so it never slides under the tab bar. */}
        <div aria-hidden="true" className="flex-1" />
        {/* Eyebrow */}
        <span
          className="ui-kicker mb-3 text-center tracking-[0.32em] sm:tracking-[0.42em]"
        >
          Ultimate Champions League
        </span>

        {/* Logo (herói) + título */}
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <img src={LOGO_URL} alt="UCL Immortals" className="relative w-36 h-36 sm:w-44 sm:h-44 object-contain" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.6))' }} />
          </div>
          <h1 className="mt-2 text-center font-display text-[clamp(2.8rem,11vw,4.6rem)] font-normal leading-[0.85] tracking-wider">
            <span className="block text-[var(--ui-brand-strong)]">UCL</span>
            <span className="block text-[var(--ui-text)]">IMMORTALS</span>
          </h1>
        </div>

        {/* Régua + tagline */}
        <div className="flex flex-col items-center mt-4 mb-7">
          <div className="h-px w-40 bg-[var(--ui-brand)] opacity-70 sm:w-56" />
          <p className="ui-subtitle mt-3 max-w-[34ch] text-center text-sm sm:text-base">
            Monte um elenco histórico e competitivo. Conquiste o título da <span className="font-bold text-[var(--ui-brand-strong)]">Ultimate Champions League</span>.
          </p>
        </div>

        {/* Dynamic Mode Forms */}
        <div className="flex w-full justify-center">
          {menuMode === 'selection' && (
            <div className="mb-5 flex w-full max-w-xs flex-col lg:max-w-sm gap-3 sm:mb-8">
              <Button
                type="button"
                intent="primary"
                size="large"
                onClick={() => (savedSoloCampaign ? setSoloSaveConfirm('choose') : setMenuMode('solo'))}
                className="w-full"
              >
                <span className="flex flex-col items-center justify-center leading-tight">
                  <span className="inline-flex items-center justify-center gap-2.5">
                    <Gamepad2 size={22} strokeWidth={2.5} /> JOGAR SOLO
                  </span>
                  {savedSoloCampaign ? (
                    <span className="mt-0.5 max-w-full truncate text-[12px] font-semibold normal-case tracking-normal opacity-80" style={{ fontFamily: "var(--font-ui), sans-serif" }}>
                      Campanha salva · {savedSoloCampaign.teamName}
                    </span>
                  ) : null}
                </span>
              </Button>

              <Button
                type="button"
                intent="secondary"
                size="large"
                onClick={() => setMenuMode('online')}
                className="w-full"
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <Trophy size={22} strokeWidth={2.5} /> MULTIPLAYER ONLINE
                </span>
              </Button>

              {/* Accounts also get their achievements next to the album. */}
              <div className={cn('grid w-full gap-2', account ? 'grid-cols-2' : 'grid-cols-1')}>
                <Button
                  type="button"
                  intent="ghost"
                  onClick={() => dispatch({ type: 'SET_PHASE', phase: 'album' })}
                  className="w-full min-w-0 border border-[var(--ui-line-subtle)] px-2"
                >
                  <span className="inline-flex min-w-0 items-center justify-center gap-2">
                    <LibraryBig size={16} strokeWidth={2.5} className="shrink-0" />
                    {account ? 'ÁLBUM' : 'ÁLBUM DE JOGADORES'}
                  </span>
                </Button>
                {account ? (
                  <Button
                    type="button"
                    intent="ghost"
                    onClick={() => dispatch({ type: 'SET_PHASE', phase: 'achievements' })}
                    className="w-full min-w-0 border border-[var(--ui-line-subtle)] px-2"
                  >
                    <span className="inline-flex min-w-0 items-center justify-center gap-2">
                      <Medal size={16} strokeWidth={2.5} className="shrink-0" /> CONQUISTAS
                    </span>
                  </Button>
                ) : null}
              </div>

              {account ? <AccountTabBar
                active="home"
                incomingFriendRequestCount={incomingFriendRequestCount}
                onNavigate={tab => {
                  if (tab === 'home') return;
                  dispatch({ type: 'SET_ACCOUNT_SECTION', section: tab });
                }}
              /> : null}
            </div>
          )}

          <ConfirmDialog
            open={soloSaveConfirm === 'new'}
            onOpenChange={open => { if (!open) setSoloSaveConfirm(null); }}
            title="Começar nova campanha?"
            description={`A campanha salva${savedSoloCampaign ? ` (${savedSoloCampaign.teamName})` : ''} será substituída pela nova.`}
            confirmLabel="Começar nova"
            onConfirm={() => { setSoloSaveConfirm(null); void discardSoloCampaign().then(() => setMenuMode('solo')); }}
          />
          <GameModal
            open={soloSaveConfirm === 'choose'}
            onOpenChange={open => { if (!open) setSoloSaveConfirm(null); }}
            title="JOGAR SOLO"
            subtitle={savedSoloCampaign ? `Campanha salva: ${savedSoloCampaign.teamName} · ${soloCampaignStageLabel(savedSoloCampaign)}` : undefined}
            footer={(
              <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:justify-end">
                <Button type="button" intent="secondary" onClick={() => setSoloSaveConfirm('new')}>
                  Nova campanha
                </Button>
                <Button type="button" intent="primary" onClick={() => { setSoloSaveConfirm(null); void continueSoloCampaign(); }}>
                  <span className="inline-flex items-center gap-2"><Play size={16} strokeWidth={2.5} /> Continuar campanha</span>
                </Button>
              </div>
            )}
          >
            <p className="text-sm text-[var(--ui-text-soft)]">
              Continue de onde parou ou comece uma campanha nova. Começar uma nova substitui a campanha salva.
            </p>
          </GameModal>

          {menuMode === 'solo' && (
            <div
              className="w-full max-w-xs space-y-4 lg:max-w-sm"
            >
              <div>
                <label className="block text-xs font-bold mb-2 tracking-widest text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  NOME DO SEU TIME
                </label>
                <Input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePlaySolo()}
                  placeholder="Ex: Real Madrid Lendário"
                  maxLength={20}
                  autoFocus
                  className="ui-input"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  intent="ghost"
                  onClick={() => setMenuMode('selection')}
                  className="border border-[var(--ui-line-subtle)] px-4 text-xs"
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  intent="primary"
                  onClick={handlePlaySolo}
                  disabled={!playerName.trim()}
                  className="flex-1"

                >
                  Avançar →
                </Button>
              </div>
            </div>
          )}

          {menuMode === 'online' && (
            <div
              className="w-full max-w-xs space-y-4 lg:max-w-sm"
            >
              <div>
                <label className="block text-xs font-bold mb-2 tracking-widest text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  NOME DO SEU TIME
                </label>
                <Input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="Ex: Real Madrid Lendário"
                  maxLength={20}
                  autoFocus
                  className="ui-input mb-3"
                />
              </div>

              {!account ? (
                <Panel tone="inset" className="space-y-3 p-3">
                  <div>
                    <div className="text-xs font-bold tracking-widest text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      CONFIGURAÇÃO DA PARTIDA
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      Ao criar uma sala, você define o formato e a dificuldade nas próximas telas. Depois, o código reúne todos na mesma competição.
                    </p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                    Para entrar em uma sala existente, basta informar o código — as configurações vêm do anfitrião.
                  </p>
                </Panel>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  intent="primary"
                  onClick={handleCreateRoom}
                  disabled={!playerName.trim()}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Plus size={16} strokeWidth={3} /> CRIAR SALA
                  </span>
                </Button>
                <Button
                  type="button"
                  intent="secondary"
                  onClick={() => setMenuMode('online_join')}
                  disabled={!playerName.trim()}
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
                  <label className="block text-xs font-bold mb-1 tracking-widest text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
        <footer className="pointer-events-none flex justify-center pt-8">
          <span className="text-[12px] font-bold tracking-[0.18em] text-[var(--ui-text-muted)] opacity-75" style={{ fontFamily: 'var(--font-game), sans-serif' }}>by J.Lessa</span>
        </footer>
      </div>


      <GameModal
        open={guestModeInfoOpen}
        onOpenChange={setGuestModeInfoOpen}
        title="DUAS FORMAS DE JOGAR"
        subtitle="O modo livre é independente da conta; o modo competitivo registra sua trajetória."
        size="wide"
        footer={(
          <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              intent="primary"
              onClick={() => {
                setGuestModeInfoOpen(false);
                dispatch({ type: 'SET_PHASE', phase: 'account' });
              }}
            >
              <UserRound size={15} aria-hidden="true" /> ENTRAR OU CRIAR CONTA
            </Button>
            <Button type="button" intent="ghost" onClick={() => setGuestModeInfoOpen(false)}>
              CONTINUAR NO MODO LIVRE
            </Button>
          </div>
        )}
      >
        <div className="space-y-2.5">
          <Panel tone="inset" className="space-y-1.5 p-3">
            <div className="ui-kicker">MODO LIVRE</div>
            <p className="text-pretty text-sm leading-relaxed text-[var(--ui-text-muted)]">
              Jogue solo ou multiplayer sem conta. Suas competições no modo livre não aparecem no perfil, no histórico, nos rankings ou nos recordes.
            </p>
          </Panel>

          <Panel tone="accent" className="space-y-1.5 p-3">
            <div className="ui-kicker">MODO COMPETITIVO · COM CONTA</div>
            <p className="text-pretty text-sm leading-relaxed text-[var(--ui-text-muted)]">
              Entre ou crie uma conta para registrar seu progresso no modo oficial. Suas competições concluídas formam seu histórico e alimentam o perfil, os rankings e os recordes.
            </p>
            <p className="pt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">
              O formato é fixo para todos e você escolhe a dificuldade. Quanto mais difícil, mais pontos cada fase vale no ranking:
            </p>
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3">
                <div className="ui-kicker">FORMATO FIXO</div>
                <div className="mt-1 text-sm font-bold text-[var(--ui-text)]">{COMPETITION_FORMAT_PRESETS[COMPETITIVE_FORMAT.id].name}</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">{competitionFormatSummary(COMPETITIVE_FORMAT)}</p>
              </div>
              <div className="rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3">
                <div className="ui-kicker">DIFICULDADE À SUA ESCOLHA</div>
                <div className="mt-1 text-sm font-bold text-[var(--ui-brand-strong)]">Bronze a Imortal</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">
                  Um título vale {DIFFICULTY_LEVELS.map(level => `${competitionStagePoints('champion', level.id as RankedDifficultyId)} no ${level.name}`).join(', ')}.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </GameModal>

      <GameModal
        open={friendNotificationsOpen}
        onOpenChange={setFriendNotificationsOpen}
        title="NOTIFICAÇÕES"
        subtitle="Avisos e solicitações da sua conta."
        size="wide"
      >
        <div className="space-y-3">
          {friendNotificationError ? <StatusBanner tone="danger" role="alert">{friendNotificationError}</StatusBanner> : null}
          {incomingFriendRequests.length === 0 ? (
            <EmptyState title="Tudo em dia" description="Não há notificações pendentes no momento." />
          ) : incomingFriendRequests.map(friendship => {
            const friend = friendIdentity(friendship, account?.id);
            const busy = friendActionId === friendship.id;
            return (
              <div key={friendship.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface)] p-3 sm:flex-nowrap">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ui-brand)]/15 text-sm font-bold text-[var(--ui-brand-strong)]">
                  {friend.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--ui-text)]">{friend.displayName}</div>
                  <div className="truncate text-xs text-[var(--ui-text-muted)]">@{friend.username} quer adicionar você</div>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button type="button" intent="ghost" disabled={friendActionId !== null} onClick={() => void handleFriendNotification(friendship.id, 'decline')} className="flex-1 px-3 text-xs sm:flex-none">
                    <X size={14} /> RECUSAR
                  </Button>
                  <Button type="button" intent="primary" loading={busy} disabled={friendActionId !== null} onClick={() => void handleFriendNotification(friendship.id, 'accept')} className="flex-1 px-3 text-xs sm:flex-none">
                    {!busy ? <Check size={14} /> : null} ACEITAR
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </GameModal>

    </AppShell>
  );
}
