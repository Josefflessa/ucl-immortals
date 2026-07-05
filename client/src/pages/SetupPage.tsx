// UCL Immortals — Setup Page
// Choose difficulty level before coach selection

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS, getRarityColor, type Rarity } from '../lib/gameData';

const LOGO_URL = '/icons/logo_ucl.png';

export default function SetupPage() {
  const { state, dispatch } = useGame();

  const handleSelect = (diffId: string) => {
    dispatch({ type: 'SET_DIFFICULTY', difficulty: diffId });
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_PHASE', phase: 'crest' });
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
          <div className="grid grid-cols-1 gap-2.5">
            {DIFFICULTY_LEVELS.map((diff, i) => {
              const isSelected = state.difficulty === diff.id;
              const color = getRarityColor(diff.id as Rarity);
              const strengthPct = Math.round(diff.botStrength * 100);
              const level = i + 1; // 1..5

              return (
                <motion.button
                  key={diff.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ scale: 1.01, x: 3 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelect(diff.id)}
                  className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected ? `linear-gradient(135deg, ${color}1F 0%, #0b0b14 62%)` : '#0F0F1A',
                    border: `1.5px solid ${isSelected ? color : '#1A1A2A'}`,
                    boxShadow: isSelected ? `0 0 24px ${color}44, inset 0 0 22px ${color}12` : 'none',
                  }}
                >
                  {/* Emblema do tier (número do nível na cor da raridade) */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18`, border: `1.5px solid ${isSelected ? color : `${color}55`}`, boxShadow: isSelected ? `0 0 14px ${color}55` : 'none' }}>
                    <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{level}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, color: isSelected ? color : '#FFFFFF' }}>
                        {diff.name.toUpperCase()}
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded leading-none" style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.06em' }}>
                        NÍVEL {level}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {diff.description}
                    </p>
                    {/* Medidor de dificuldade (pips) + força IA */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, k) => (
                          <div key={k} style={{ width: 17, height: 5, borderRadius: 3, background: k < level ? color : '#22222F', boxShadow: k < level && isSelected ? `0 0 6px ${color}88` : 'none' }} />
                        ))}
                      </div>
                      <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>FORÇA IA {strengthPct}%</span>
                    </div>
                  </div>

                  {/* Selecionado */}
                  {isSelected && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: color, color: '#080810', fontSize: 13, fontWeight: 900, boxShadow: `0 0 12px ${color}88` }}>
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
            ESCOLHER ESCUDO →
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
