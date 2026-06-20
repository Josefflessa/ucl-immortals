// UCL Immortals — Coach Selection Page

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { COACHES } from '../lib/gameData';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';

const COACH_ICONS: Record<string, string> = {
  guardiola: '🧠',
  klopp: '🔥',
  mourinho: '🛡️',
  ancelotti: '⚖️',
  zidane: '⭐',
  ferguson: '❤️',
};

const COACH_COLORS: Record<string, string> = {
  guardiola: '#3B82F6',
  klopp: '#EF4444',
  mourinho: '#8B5CF6',
  ancelotti: '#10B981',
  zidane: '#C9A84C',
  ferguson: '#F97316',
};

export default function CoachPage() {
  const { state, dispatch } = useGame();

  const handleSelect = (coachId: string) => {
    dispatch({ type: 'SET_COACH', coachId });
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_PHASE', phase: 'formation' });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-8 h-8 object-contain" />
        <span className="text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          UCL IMMORTALS
        </span>
        {/* Progress */}
        <div className="ml-auto flex items-center gap-2">
          {['Dificuldade', 'Treinador', 'Formação', 'Draft'].map((step, i) => (
            <div key={step} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{
                background: i === 1 ? '#C9A84C' : i < 1 ? '#22C55E' : '#333'
              }} />
              <span className="text-xs hidden sm:block" style={{
                color: i === 1 ? '#C9A84C' : i < 1 ? '#22C55E' : '#555',
                fontFamily: 'Rajdhani, sans-serif',
              }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl"
        >
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black tracking-widest mb-2"
              style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
              ESCOLHA SEU TREINADOR
            </h2>
            <p style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              O treinador define sua filosofia de jogo e bônus táticos. Jogadores que trabalharam com ele ganham química extra.
            </p>
          </div>

          {/* Coach grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COACHES.map((coach, i) => {
              const isSelected = state.selectedCoachId === coach.id;
              const color = COACH_COLORS[coach.id] || '#C9A84C';
              const icon = COACH_ICONS[coach.id] || '⚽';

              return (
                <motion.button
                  key={coach.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect(coach.id)}
                  className="text-left rounded-xl p-5 transition-all"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${color}18 0%, #0F0F1A 100%)`
                      : '#0F0F1A',
                    border: `1px solid ${isSelected ? color : '#1A1A2A'}`,
                    boxShadow: isSelected ? `0 0 25px ${color}33` : 'none',
                  }}
                >
                  {/* Icon/Photo + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    {coach.photoUrl ? (
                      <img
                        src={coach.photoUrl}
                        alt={coach.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                        style={{
                          border: `1px solid ${isSelected ? color : '#1A1A2A'}`,
                        }}
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{
                          background: `${color}22`,
                          border: `1px solid ${color}44`,
                        }}
                      >
                        {icon}
                      </div>
                    )}
                    <div>
                      <div
                        className="font-black text-lg leading-tight"
                        style={{
                          fontFamily: 'Bebas Neue, sans-serif',
                          color: isSelected ? color : '#FFFFFF',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {coach.name.toUpperCase()}
                      </div>
                      <div className="text-xs font-semibold" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>
                        {coach.philosophy}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                    {coach.description}
                  </p>

                  {/* Effect */}
                  <div className="px-3 py-2 rounded-lg mb-3"
                    style={{ background: `${color}11`, border: `1px solid ${color}22` }}>
                    <div className="text-xs font-bold" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>
                      EFEITO TÁTICO
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#CCC', fontFamily: 'Rajdhani, sans-serif' }}>
                      {coach.effect}
                    </div>
                  </div>

                  {/* Special ability */}
                  <div className="flex items-start gap-2">
                    <div className="text-sm flex-shrink-0">⚡</div>
                    <div>
                      <div className="text-xs font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                        {coach.specialAbilityName}
                      </div>
                      <div className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                        {coach.specialAbility}
                      </div>
                    </div>
                  </div>

                  {/* Preferred formation */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      Formação preferida:
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: '#1A1A2A', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                      {coach.preferredFormation}
                    </span>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-xs font-bold" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>
                        SELECIONADO
                      </span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Continue */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
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
            ESCOLHER FORMAÇÃO →
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
