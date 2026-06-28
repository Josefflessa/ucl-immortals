// UCL Immortals — Squad Review Page (post-draft).
// Thin page shell around the shared <SquadEditor> (same UI as the in-league "MEU TIME" tab),
// plus the post-draft chrome: header and the "iniciar competição" action. Wiring uses the
// draft-phase state + actions; online mode submits the lineup instead of starting locally.
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { Player } from '../lib/gameData';
import SquadEditor from '../components/game/SquadEditor';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';

export default function SquadReviewPage() {
  const { state, dispatch, submitSquadReviewOnline } = useGame();
  const online = state.mode === 'online';
  const me = online ? state.onlinePlayers.find(p => p.socketId === state.socketId) : null;
  const isReady = me?.ready || false;
  const draftedPlayers = state.draftedPlayers as Player[];

  const handleStart = () => {
    if (online) {
      submitSquadReviewOnline(state.captain, state.penaltyTaker, state.freeKickTaker, state.draftedPlayers, state.selectedPlayStyle, state.selectedFormationId);
    } else {
      dispatch({ type: 'START_LEAGUE' });
    }
  };

  if (online && isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#080810' }}>
        <img src={LOGO_URL} alt="UCL Logo" className="w-16 h-16 object-contain mb-4 animate-pulse" />
        <div className="flex items-center gap-2 text-white font-bold text-lg" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-[#C9A84C] animate-spin" />
          AGUARDANDO DEMAIS JOGADORES CONFIRMAREM ESCALAÇÃO...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
        <span className="text-base sm:text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          REVISÃO DO ELENCO
        </span>
        <span className="ml-auto text-xs hidden sm:inline" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
          Time: <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>{state.playerName}</span>
        </span>
      </div>

      <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 max-w-5xl mx-auto w-full overflow-y-auto">
        <SquadEditor
          players={draftedPlayers}
          coachId={state.selectedCoachId}
          formationId={state.selectedFormationId}
          playStyle={state.selectedPlayStyle}
          captain={state.captain}
          penaltyTaker={state.penaltyTaker}
          freeKickTaker={state.freeKickTaker}
          onSetFormation={(id) => dispatch({ type: 'SET_FORMATION', formationId: id })}
          onSetPlayStyle={(id) => dispatch({ type: 'SET_PLAY_STYLE', playStyle: id })}
          onSetCaptain={(id) => dispatch({ type: 'SET_CAPTAIN', playerId: id })}
          onSetPenaltyTaker={(id) => dispatch({ type: 'SET_PENALTY_TAKER', playerId: id })}
          onSetFreeKickTaker={(id) => dispatch({ type: 'SET_FREE_KICK_TAKER', playerId: id })}
          onSwap={(a, b) => dispatch({ type: 'SWAP_PLAYERS', indexA: a, indexB: b })}
          footer={
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              className="w-full py-5 rounded-xl font-black text-2xl tracking-widest"
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
                color: '#080810',
                boxShadow: '0 0 40px rgba(201,168,76,0.4)',
              }}
            >
              🏆 INICIAR COMPETIÇÃO →
            </motion.button>
          }
        />
      </div>
    </div>
  );
}
