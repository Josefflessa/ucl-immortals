// UCL Immortals — Setup Page
// Choose difficulty level before coach selection

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS } from '../lib/gameData';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';

export default function SetupPage() {
  const { state, dispatch } = useGame();

  const handleSelect = (diffId: string) => {
    dispatch({ type: 'SET_DIFFICULTY', difficulty: diffId });
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_PHASE', phase: 'coach' });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-8 h-8 object-contain" />
        <span className="text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          UCL IMMORTALS
        </span>
        <span className="text-sm ml-auto" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
          Time: <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>{state.playerName}</span>
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black tracking-widest mb-2"
              style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
              ESCOLHA A DIFICULDADE
            </h2>
            <p style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              Define a força dos times controlados pela IA na competição
            </p>
          </div>

          {/* Difficulty grid */}
          <div className="grid grid-cols-1 gap-3">
            {DIFFICULTY_LEVELS.map((diff, i) => {
              const isSelected = state.difficulty === diff.id;
              const strengthPct = Math.round(diff.botStrength * 100);

              return (
                <motion.button
                  key={diff.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelect(diff.id)}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(135deg, #1A1400 0%, #14142A 100%)'
                      : '#0F0F1A',
                    border: `1px solid ${isSelected ? '#C9A84C' : '#1A1A2A'}`,
                    boxShadow: isSelected ? '0 0 20px rgba(201,168,76,0.2)' : 'none',
                  }}
                >
                  {/* Difficulty icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      background: isSelected ? '#C9A84C22' : '#1A1A2A',
                      border: `1px solid ${isSelected ? '#C9A84C' : '#333'}`,
                      color: isSelected ? '#C9A84C' : '#8A8A9A',
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-black text-base tracking-wider"
                        style={{
                          fontFamily: 'Bebas Neue, sans-serif',
                          color: isSelected ? '#C9A84C' : '#FFFFFF',
                        }}
                      >
                        {diff.name.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {diff.description}
                    </p>
                  </div>

                  {/* Strength bar */}
                  <div className="flex-shrink-0 w-24">
                    <div className="text-right text-xs mb-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      Força IA: {strengthPct}%
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: '#1A1A2A' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${strengthPct}%`,
                          background: isSelected
                            ? 'linear-gradient(90deg, #C9A84C, #E8C84A)'
                            : '#333',
                        }}
                      />
                    </div>
                  </div>

                  {/* Selected check */}
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#C9A84C', color: '#080810', fontSize: '10px', fontWeight: 'bold' }}>
                      ✓
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Continue button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinue}
            className="w-full mt-8 py-4 rounded-xl font-black text-xl tracking-widest"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
              color: '#080810',
              boxShadow: '0 0 30px rgba(201,168,76,0.3)',
            }}
          >
            ESCOLHER TREINADOR →
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
