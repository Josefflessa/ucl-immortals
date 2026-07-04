// UCL Immortals — Menu Page
// Design: Dark Premium Gaming UI — hero with stadium background, gold accents

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Trophy, Plus, LogIn, LogOut, Swords, FlaskConical, Target, ListOrdered, BarChart3, BookOpen } from 'lucide-react';
import HowToPlayModal from '../components/game/HowToPlayModal';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS } from '../lib/gameData';

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-hero-bg-h6Wx2jrfCPsrWkvEcMdhqo.webp';
const LOGO_URL = '/icons/logo_ucl.png';

export default function MenuPage() {
  const {
    state,
    dispatch,
    createRoom,
    joinRoom,
    setDifficultyOnline,
    startSetupOnline,
    disconnectOnline
  } = useGame();

  const [menuMode, setMenuMode] = useState<'selection' | 'solo' | 'online' | 'online_join'>('selection');
  const [showGuide, setShowGuide] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const handlePlaySolo = () => {
    if (!playerName.trim()) return;
    dispatch({ type: 'SET_PLAYER_NAME', name: playerName.trim() });
    dispatch({ type: 'SET_PHASE', phase: 'setup' });
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    createRoom(playerName.trim());
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || !roomCodeInput.trim()) return;
    joinRoom(roomCodeInput.trim().toUpperCase(), playerName.trim());
  };

  const handleLeaveLobby = () => {
    disconnectOnline();
    setMenuMode('selection');
  };

  // If already in lobby, render Lobby view
  if (state.roomCode && state.phase === 'lobby') {
    return (
      <div className="min-h-screen relative overflow-hidden" style={{ background: '#080810' }}>
        <div className="absolute inset-0" style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center bottom', opacity: 0.3 }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,8,16,0.3) 0%, rgba(8,8,16,0.7) 50%, rgba(8,8,16,0.95) 100%)' }} />
        
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 max-w-md mx-auto">
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
            className="w-full rounded-2xl p-5 border" 
            style={{ background: '#0F0F1A', borderColor: '#1A1A2A' }}
          >
            {/* Room Code Header */}
            <div className="text-center pb-4 border-b" style={{ borderColor: '#1A1A2A' }}>
              <span className="text-xs font-bold text-gray-500 tracking-widest block uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                CÓDIGO DA SALA
              </span>
              <span className="text-4xl font-black text-yellow-500 tracking-wider block mt-1" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {state.roomCode}
              </span>
            </div>

            {/* Players List */}
            <div className="my-4">
              <span className="text-xs font-bold text-[#C9A84C] tracking-widest block uppercase mb-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                JOGADORES CONECTADOS ({state.onlinePlayers.length})
              </span>
              <div className="space-y-2">
                {state.onlinePlayers.map((p, idx) => (
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
                        {idx === 0 ? 'ANFITRIÃO' : 'PRONTO'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Options */}
            {state.isHost ? (
              <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: '#1A1A2A' }}>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 tracking-widest uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    DIFICULDADE DOS BOTS
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {DIFFICULTY_LEVELS.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setDifficultyOnline(d.id)}
                        className="py-1 text-[10px] font-bold rounded border transition-all"
                        style={{
                          fontFamily: 'Rajdhani, sans-serif',
                          background: state.difficulty === d.id ? '#C9A84C' : '#08080f',
                          color: state.difficulty === d.id ? '#000' : '#8A8A9A',
                          borderColor: state.difficulty === d.id ? '#C9A84C' : '#171725'
                        }}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startSetupOnline}
                  disabled={state.onlinePlayers.length < 2}
                  className="w-full py-3.5 rounded-xl font-black text-lg tracking-widest uppercase transition-all"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: state.onlinePlayers.length >= 2 
                      ? 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)' 
                      : '#333',
                    color: state.onlinePlayers.length >= 2 ? '#080810' : '#666',
                    cursor: state.onlinePlayers.length >= 2 ? 'pointer' : 'not-allowed',
                    boxShadow: state.onlinePlayers.length >= 2 ? '0 0 25px rgba(201,168,76,0.3)' : 'none'
                  }}
                >
                  {state.onlinePlayers.length >= 2 ? 'INICIAR PARTIDA →' : 'AGUARDANDO JOGADORES (MÍN. 2)'}
                </button>
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

          <button
            onClick={handleLeaveLobby}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest transition-all"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            <LogOut size={14} /> SAIR DA SALA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#080810' }}>
      {/* Background — estádio + gradiente + brilho dourado + vinheta (atmosfera premium) */}
      <div className="absolute inset-0" style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center bottom', opacity: 0.38 }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,8,16,0.35) 0%, rgba(8,8,16,0.6) 45%, rgba(8,8,16,0.97) 100%)' }} />
      {/* brilho dourado radial atrás do herói */}
      <div className="absolute inset-x-0 top-0 h-[70vh] pointer-events-none" style={{ background: 'radial-gradient(60% 55% at 50% 32%, rgba(201,168,76,0.16), transparent 70%)' }} />
      {/* vinheta */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(3,3,8,0.85) 100%)' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Eyebrow */}
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[10px] sm:text-xs font-bold uppercase mb-3"
          style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.42em', color: '#B79A54' }}
        >
          Ultimate Champions League
        </motion.span>

        {/* Logo (herói) + título */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute pointer-events-none" style={{ width: 240, height: 240, background: 'radial-gradient(circle, rgba(201,168,76,0.22), transparent 62%)', filter: 'blur(4px)' }} />
            <img src={LOGO_URL} alt="UCL Immortals" className="relative w-36 h-36 sm:w-44 sm:h-44 object-contain" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.6))' }} />
          </div>
          <h1 className="mt-2 font-black leading-[0.85] tracking-wider text-center" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2.8rem, 11vw, 4.6rem)' }}>
            <span className="block text-[#E8C84A]" style={{ textShadow: '0 0 44px rgba(201,168,76,0.55), 0 2px 4px rgba(0,0,0,0.85)' }}>UCL</span>
            <span className="block text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.85)' }}>IMMORTALS</span>
          </h1>
        </motion.div>

        {/* Régua + tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="flex flex-col items-center mt-4 mb-7"
        >
          <div className="h-px w-40 sm:w-56" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
          <p className="mt-3 text-center text-sm sm:text-base" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#AFB4C6', maxWidth: '34ch' }}>
            Monte seu time de lendas. Conquiste a <span className="font-bold text-[#E8C84A]">imortalidade</span>.
          </p>
        </motion.div>

        {/* (troféu removido) */}

        {/* Dynamic Mode Forms */}
        <AnimatePresence mode="wait">
          {menuMode === 'selection' && (
            <motion.div 
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-3 w-full max-w-xs"
            >
              <button
                onClick={() => setMenuMode('solo')}
                className="py-4 rounded-xl font-black text-xl tracking-widest uppercase transition-all hover:scale-[1.02]"
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  background: 'linear-gradient(135deg, #1B4FD8 0%, #1B4FD8AA 100%)',
                  color: '#FFF',
                  boxShadow: '0 0 25px rgba(27,79,216,0.3)',
                  border: '1px solid #1B4FD888'
                }}
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <Gamepad2 size={22} strokeWidth={2.5} /> JOGAR SOLO
                </span>
              </button>

              <button
                onClick={() => setMenuMode('online')}
                className="py-4 rounded-xl font-black text-xl tracking-widest uppercase transition-all hover:scale-[1.02]"
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                  color: '#080810',
                  boxShadow: '0 0 25px rgba(201,168,76,0.4)'
                }}
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <Trophy size={22} strokeWidth={2.5} /> MULTIPLAYER ONLINE
                </span>
              </button>

              <button
                onClick={() => setShowGuide(true)}
                className="py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:scale-[1.02]"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: '#0F0F1A',
                  color: '#9AA8C8',
                  border: '1px solid #2A2A3A',
                }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <BookOpen size={16} strokeWidth={2.5} /> COMO JOGAR
                </span>
              </button>
            </motion.div>
          )}

          {menuMode === 'solo' && (
            <motion.div 
              key="solo"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full max-w-xs space-y-4"
            >
              <div>
                <label className="block text-xs font-bold mb-2 tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  NOME DO SEU TIME
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePlaySolo()}
                  placeholder="Ex: Real Madrid Lendário"
                  maxLength={20}
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg text-white font-semibold outline-none"
                  style={{ background: '#0F0F1A', border: '1px solid #C9A84C66', fontFamily: 'Rajdhani, sans-serif', fontSize: '16px' }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setMenuMode('selection')}
                  className="py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border"
                  style={{ fontFamily: 'Rajdhani, sans-serif', borderColor: '#1A1A2A', background: '#0F0F1A', color: '#8A8A9A' }}
                >
                  Voltar
                </button>
                <button
                  onClick={handlePlaySolo}
                  disabled={!playerName.trim()}
                  className="flex-1 py-3 rounded-lg font-black text-md uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: playerName.trim() ? 'linear-gradient(135deg, #1B4FD8 0%, #1B4FD8 100%)' : '#333',
                    color: playerName.trim() ? '#FFF' : '#666',
                    cursor: playerName.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Avançar Setup →
                </button>
              </div>
            </motion.div>
          )}

          {menuMode === 'online' && (
            <motion.div 
              key="online"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full max-w-xs space-y-4"
            >
              <div>
                <label className="block text-xs font-bold mb-2 tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  NOME DO SEU TIME
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="Ex: Real Madrid Lendário"
                  maxLength={20}
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg text-white font-semibold outline-none mb-3"
                  style={{ background: '#0F0F1A', border: '1px solid #C9A84C66', fontFamily: 'Rajdhani, sans-serif', fontSize: '16px' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCreateRoom}
                  disabled={!playerName.trim()}
                  className="py-3.5 rounded-lg font-black text-sm uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: playerName.trim() ? 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 100%)' : '#333',
                    color: playerName.trim() ? '#080810' : '#666',
                    cursor: playerName.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Plus size={16} strokeWidth={3} /> CRIAR SALA
                  </span>
                </button>
                <button
                  onClick={() => setMenuMode('online_join')}
                  disabled={!playerName.trim()}
                  className="py-3.5 rounded-lg font-black text-sm uppercase tracking-wider transition-all border"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    borderColor: playerName.trim() ? '#C9A84C66' : '#1A1A2A',
                    background: '#0F0F1A',
                    color: playerName.trim() ? '#C9A84C' : '#666',
                    cursor: playerName.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <LogIn size={16} strokeWidth={3} /> ENTRAR EM SALA
                  </span>
                </button>
              </div>

              <button
                onClick={() => setMenuMode('selection')}
                className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border text-center block text-gray-500 border-[#1A1A2A] bg-transparent"
                style={{ fontFamily: 'Rajdhani, sans-serif' }}
              >
                Voltar ao Menu principal
              </button>
            </motion.div>
          )}

          {menuMode === 'online_join' && (
            <motion.div 
              key="online_join"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full max-w-xs space-y-4"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    CÓDIGO DA SALA (4 LETRAS)
                  </label>
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="EX: ABCD"
                    maxLength={4}
                    autoFocus
                    className="w-full px-4 py-3 rounded-lg text-white font-black text-center tracking-widest outline-none text-xl"
                    style={{ background: '#0F0F1A', border: '1px solid #C9A84C66', fontFamily: 'Bebas Neue, sans-serif' }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setMenuMode('online')}
                  className="py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all border"
                  style={{ fontFamily: 'Rajdhani, sans-serif', borderColor: '#1A1A2A', background: '#0F0F1A', color: '#8A8A9A' }}
                >
                  Voltar
                </button>
                <button
                  onClick={handleJoinRoom}
                  disabled={!roomCodeInput.trim() || roomCodeInput.length < 4}
                  className="flex-1 py-3 rounded-lg font-black text-md uppercase tracking-wider transition-all"
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    background: (roomCodeInput.trim().length === 4) ? 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 100%)' : '#333',
                    color: (roomCodeInput.trim().length === 4) ? '#080810' : '#666',
                    cursor: (roomCodeInput.trim().length === 4) ? 'pointer' : 'not-allowed'
                  }}
                >
                  CONECTAR SALA ✓
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-wrap gap-3 mt-10 justify-center"
        >
          {[
            { Icon: Swords, label: 'Draft de Lendas' },
            { Icon: FlaskConical, label: 'Sistema de Química' },
            { Icon: Target, label: 'Simulação Tática' },
            { Icon: ListOrdered, label: 'Liga + Mata-Mata' },
            { Icon: BarChart3, label: 'Relatório Imortal' },
          ].map(({ Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(201,168,76,0.06)',
                border: '1px solid rgba(201,168,76,0.22)',
                color: '#C9B471',
                fontFamily: 'Rajdhani, sans-serif',
              }}
            >
              <Icon size={13} /> {label}
            </div>
          ))}
        </motion.div>

        {/* No account notice */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6 text-xs text-gray-600"
          style={{ fontFamily: 'Rajdhani, sans-serif' }}
        >
          Sem cadastro · Sem login · Cada sessão começa do zero
        </motion.p>
      </div>

      <HowToPlayModal open={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
