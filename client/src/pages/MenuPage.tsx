// UCL Immortals — Menu Page
// Design: Dark Premium Gaming UI — hero with stadium background, gold accents

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Trophy, Plus, LogIn, BookOpen, LibraryBig } from 'lucide-react';
import HowToPlayModal from '../components/game/HowToPlayModal';
import RoomOptionsMenu, { type RoomMenuAction } from '../components/game/RoomOptionsMenu';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS } from '../lib/gameData';
import { competitionFormatSummary } from '../lib/competition';
import { AppShell, Button, ConfirmDialog, Input, Panel } from '../design-system';

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-hero-bg-h6Wx2jrfCPsrWkvEcMdhqo.webp';
const LOGO_URL = '/icons/logo_ucl.png';

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
  } = useGame();

  const [menuMode, setMenuMode] = useState<'selection' | 'solo' | 'online' | 'online_join'>('selection');
  const [showGuide, setShowGuide] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomAction, setRoomAction] = useState<RoomMenuAction | null>(null);
  const difficultyName = DIFFICULTY_LEVELS.find(level => level.id === state.difficulty)?.name ?? state.difficulty;

  useEffect(() => {
    // Reset only when the lobby is actually left. Including `menuMode` here
    // makes every click on SOLO/ONLINE immediately revert to the selection
    // screen, because both flows start while the app is still in phase `menu`.
    if (!state.roomCode && state.phase === 'menu') {
      setMenuMode('selection');
    }
  }, [state.phase, state.roomCode]);

  const handlePlaySolo = () => {
    if (!playerName.trim()) return;
    dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: null });
    dispatch({ type: 'SET_PLAYER_NAME', name: playerName.trim() });
    dispatch({ type: 'SET_PHASE', phase: 'format' });
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
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

  // If already in lobby, render Lobby view
  if (state.roomCode && state.phase === 'lobby') {
    return (
      <AppShell immersive backgroundImage={HERO_BG} className="relative overflow-hidden">
        
        <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 max-w-md mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <img src={LOGO_URL} alt="UCL Logo" className="w-10 h-10 object-contain" />
            <h2 className="text-2xl font-black tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              LOBBY MULTIPLAYER
            </h2>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="ui-panel w-full p-5"
          >
            {/* Room Code Header */}
            <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: '#1A1A2A' }}>
              <div className="min-w-0 flex-1 text-center">
                <span className="text-xs font-bold text-gray-500 tracking-widest block uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  CÓDIGO DA SALA
                </span>
                <span className="text-4xl font-black text-yellow-500 tracking-wider block mt-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {state.roomCode}
                </span>
              </div>
              <RoomOptionsMenu isHost={state.isHost} onAction={handleRoomAction} />
            </div>

            {/* Players List */}
            <div className="my-4">
              <span className="text-xs font-bold text-[#C9A84C] tracking-widest block uppercase mb-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                JOGADORES CONECTADOS ({state.onlinePlayers.length})
              </span>
              <div className="space-y-2">
                {state.onlinePlayers.map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between p-2.5 rounded-lg border" 
                    style={{ background: '#08080f', borderColor: '#171725' }}
                  >
                    <span className="font-bold text-white text-sm" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      {p.name} {p.socketId === state.socketId && <span className="text-xs text-[#C9A84C] font-normal">(Você)</span>}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        {p.id === state.onlineHostId ? 'ANFITRIÃO' : 'PRONTO'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Options */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#1A1A2A' }}>
              <span className="text-xs font-bold text-[#C9A84C] tracking-widest block uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                FORMATO DA COMPETIÇÃO
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {competitionFormatSummary(state.competitionFormat)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ background: '#08080f', borderColor: '#171725' }}>
                <span className="text-[10px] font-bold tracking-widest text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>DIFICULDADE DOS BOTS</span>
                <span className="text-xs font-black uppercase tracking-wider text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{difficultyName}</span>
              </div>
            </div>

            {/* Host progression */}
            {state.isHost ? (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: '#1A1A2A' }}>
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
              <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: '#1A1A2A' }}>
                <div className="flex items-center justify-center gap-2 mb-2 text-xs font-bold text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
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
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell immersive backgroundImage={HERO_BG} className="relative overflow-hidden">

      {/* Content */}
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-8">
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

        {/* (troféu removido) */}

        {/* Dynamic Mode Forms */}
        <div>
          {menuMode === 'selection' && (
            <div
              className="flex flex-col gap-3 w-full max-w-xs"
            >
              <Button
                type="button"
                intent="primary"
                size="large"
                onClick={() => setMenuMode('solo')}
                className="w-full"
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <Gamepad2 size={22} strokeWidth={2.5} /> JOGAR SOLO
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

              <Button
                type="button"
                intent="ghost"
                onClick={() => dispatch({ type: 'SET_PHASE', phase: 'album' })}
                className="w-full border border-[var(--ui-line-subtle)]"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <LibraryBig size={16} strokeWidth={2.5} /> ÁLBUM DE JOGADORES
                </span>
              </Button>

              <Button
                type="button"
                intent="ghost"
                onClick={() => setShowGuide(true)}
                className="w-full border border-[var(--ui-line-subtle)]"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <BookOpen size={16} strokeWidth={2.5} /> COMO JOGAR
                </span>
              </Button>
            </div>
          )}

          {menuMode === 'solo' && (
            <div
              className="w-full max-w-xs space-y-4"
            >
              <div>
                <label className="block text-xs font-bold mb-2 tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
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
              className="w-full max-w-xs space-y-4"
            >
              <div>
                <label className="block text-xs font-bold mb-2 tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
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

              <Panel tone="inset" className="space-y-3 p-3">
                <div>
                  <div className="text-xs font-bold tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    CONFIGURAÇÃO DA PARTIDA
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Ao criar uma sala, você define o formato do torneio e a dificuldade dos bots nas próximas telas. Depois, o código reúne todos na mesma competição.
                  </p>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Para entrar em uma sala existente, basta informar o código — as configurações vêm do anfitrião.
                </p>
              </Panel>

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
              className="w-full max-w-xs space-y-4"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
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

      </div>

      <HowToPlayModal open={showGuide} onClose={() => setShowGuide(false)} />
    </AppShell>
  );
}
