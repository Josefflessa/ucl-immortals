// UCL Immortals — Menu Page
// Design: Dark Premium Gaming UI — hero with stadium background, gold accents

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Trophy, Plus, LogIn, LogOut, BookOpen } from 'lucide-react';
import HowToPlayModal from '../components/game/HowToPlayModal';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS } from '../lib/gameData';
import { competitionFormatSummary, MAX_LEAGUE_ROUNDS, MAX_QUALIFIED_TEAMS, MIN_LEAGUE_ROUNDS, MIN_QUALIFIED_TEAMS, validateCompetitionFormat } from '../lib/competition';
import { AppShell, Button, ChoiceCard, Input, Panel, StatusBanner } from '../design-system';

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
  const [onlineLeagueRounds, setOnlineLeagueRounds] = useState(String(state.competitionFormat.leagueRounds));
  const [onlineQualifiedTeams, setOnlineQualifiedTeams] = useState(String(state.competitionFormat.qualifiedTeams));
  const [onlineFormatError, setOnlineFormatError] = useState<string | null>(null);

  const handlePlaySolo = () => {
    if (!playerName.trim()) return;
    dispatch({ type: 'SET_PLAYER_NAME', name: playerName.trim() });
    dispatch({ type: 'SET_PHASE', phase: 'setup' });
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    const competitionFormat = {
      leagueRounds: Number(onlineLeagueRounds),
      qualifiedTeams: Number(onlineQualifiedTeams),
    };
    const error = validateCompetitionFormat(competitionFormat);
    if (error) {
      setOnlineFormatError(error);
      return;
    }
    setOnlineFormatError(null);
    createRoom(playerName.trim(), competitionFormat);
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
            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#1A1A2A' }}>
              <span className="text-xs font-bold text-[#C9A84C] tracking-widest block uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                FORMATO DA COMPETIÇÃO
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {competitionFormatSummary(state.competitionFormat)}
              </p>
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
                      <ChoiceCard
                        key={d.id}
                        selected={state.difficulty === d.id}
                        onClick={() => setDifficultyOnline(d.id)}
                        className="min-h-8 rounded border px-1 py-1 text-[10px] font-bold transition-all"
                        style={{
                          fontFamily: 'Rajdhani, sans-serif',
                          background: state.difficulty === d.id ? '#C9A84C' : '#08080f',
                          color: state.difficulty === d.id ? '#000' : '#8A8A9A',
                          borderColor: state.difficulty === d.id ? '#C9A84C' : '#171725'
                        }}
                      >
                        {d.name}
                      </ChoiceCard>
                    ))}
                  </div>
                </div>

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

          <Button
            type="button"
            intent="danger"
            onClick={handleLeaveLobby}
            className="mt-4 min-h-9 px-3 text-xs"
          >
            <LogOut size={14} /> SAIR DA SALA
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell immersive backgroundImage={HERO_BG} className="relative overflow-hidden">

      {/* Content */}
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-8">
        {/* Eyebrow */}
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="ui-kicker mb-3 text-center tracking-[0.32em] sm:tracking-[0.42em]"
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
            <img src={LOGO_URL} alt="UCL Immortals" className="relative w-36 h-36 sm:w-44 sm:h-44 object-contain" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.6))' }} />
          </div>
          <h1 className="mt-2 text-center font-display text-[clamp(2.8rem,11vw,4.6rem)] font-normal leading-[0.85] tracking-wider">
            <span className="block text-[var(--ui-brand-strong)]">UCL</span>
            <span className="block text-[var(--ui-text)]">IMMORTALS</span>
          </h1>
        </motion.div>

        {/* Régua + tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="flex flex-col items-center mt-4 mb-7"
        >
          <div className="h-px w-40 bg-[var(--ui-brand)] opacity-70 sm:w-56" />
          <p className="ui-subtitle mt-3 max-w-[34ch] text-center text-sm sm:text-base">
            Monte um elenco histórico e competitivo. Conquiste o título da <span className="font-bold text-[var(--ui-brand-strong)]">Ultimate Champions League</span>.
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
                onClick={() => setShowGuide(true)}
                className="w-full border border-[var(--ui-line-subtle)]"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <BookOpen size={16} strokeWidth={2.5} /> COMO JOGAR
                </span>
              </Button>
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
                  Avançar Setup →
                </Button>
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
                    FORMATO DA COMPETIÇÃO
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Defina livremente a duração da liga e a linha de classificação. O sistema bloqueia valores que não fecham com o mata-mata.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Rodadas da liga
                    <Input
                      type="number"
                      min={MIN_LEAGUE_ROUNDS}
                      max={MAX_LEAGUE_ROUNDS}
                      step={1}
                      value={onlineLeagueRounds}
                      onChange={e => { setOnlineLeagueRounds(e.target.value); setOnlineFormatError(null); }}
                      className="ui-input mt-1 text-center"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Times classificados
                    <Input
                      type="number"
                      min={MIN_QUALIFIED_TEAMS}
                      max={MAX_QUALIFIED_TEAMS}
                      step={1}
                      value={onlineQualifiedTeams}
                      onChange={e => { setOnlineQualifiedTeams(e.target.value); setOnlineFormatError(null); }}
                      className="ui-input mt-1 text-center"
                    />
                  </label>
                </div>
                {onlineFormatError && (
                  <StatusBanner tone="danger" role="alert">{onlineFormatError}</StatusBanner>
                )}
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
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <HowToPlayModal open={showGuide} onClose={() => setShowGuide(false)} />
    </AppShell>
  );
}
