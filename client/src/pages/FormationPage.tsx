// UCL Immortals — Formation Selection Page

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { FORMATIONS, COACHES } from '../lib/gameData';
import FormationField from '../components/game/FormationField';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';

import { useState } from 'react';

export default function FormationPage() {
  const { state, dispatch, submitSetupOnline } = useGame();
  const selectedCoach = COACHES.find(c => c.id === state.selectedCoachId);

  const me = state.mode === 'online' ? state.onlinePlayers.find(p => p.socketId === state.socketId) : null;
  const isReady = me?.ready || false;

  const handleSelect = (formationId: string) => {
    dispatch({ type: 'SET_FORMATION', formationId });
  };

  const handleContinue = () => {
    if (state.mode === 'online') {
      submitSetupOnline(state.selectedCoachId, state.selectedFormationId);
    } else {
      dispatch({ type: 'START_DRAFT' });
    }
  };

  const selectedFormation = FORMATIONS.find(f => f.id === state.selectedFormationId);

  if (state.mode === 'online' && isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#080810' }}>
        <img src={LOGO_URL} alt="UCL Logo" className="w-16 h-16 object-contain mb-4 animate-pulse" />
        <div className="flex items-center gap-2 text-white font-bold text-lg" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-[#C9A84C] animate-spin" />
          AGUARDANDO DEMAIS JOGADORES DEFINIREM A TÁTICA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-8 h-8 object-contain" />
        <span className="text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          UCL IMMORTALS
        </span>
        <div className="ml-auto flex items-center gap-2">
          {['Dificuldade', 'Treinador', 'Formação', 'Draft'].map((step, i) => (
            <div key={step} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{
                background: i === 2 ? '#C9A84C' : i < 2 ? '#22C55E' : '#333'
              }} />
              <span className="text-xs hidden sm:block" style={{
                color: i === 2 ? '#C9A84C' : i < 2 ? '#22C55E' : '#555',
                fontFamily: 'Rajdhani, sans-serif',
              }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 py-6 max-w-6xl mx-auto w-full">
        {/* Left: Formation list */}
        <div className="flex-1">
          <div className="mb-6">
            <h2 className="text-4xl font-black tracking-widest mb-1"
              style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
              ESCOLHA A FORMAÇÃO
            </h2>
            {selectedCoach && (
              <p style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif', fontSize: '14px' }}>
                <span style={{ color: '#C9A84C' }}>{selectedCoach.name}</span> prefere {selectedCoach.preferredFormation}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMATIONS.map((formation, i) => {
              const isSelected = state.selectedFormationId === formation.id;
              const isPreferred = selectedCoach?.preferredFormation === formation.id;

              return (
                <motion.button
                  key={formation.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect(formation.id)}
                  className="text-left rounded-xl p-4"
                  style={{
                    background: isSelected ? '#14142A' : '#0F0F1A',
                    border: `1px solid ${isSelected ? '#C9A84C' : isPreferred ? '#C9A84C44' : '#1A1A2A'}`,
                    boxShadow: isSelected ? '0 0 20px rgba(201,168,76,0.2)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-2xl font-black"
                      style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        color: isSelected ? '#C9A84C' : '#FFFFFF',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {formation.name}
                    </span>
                    {isPreferred && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: '#C9A84C22', color: '#C9A84C', border: '1px solid #C9A84C44', fontFamily: 'Rajdhani, sans-serif' }}>
                        ⭐ Preferida
                      </span>
                    )}
                    {isSelected && !isPreferred && (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                        style={{ background: '#C9A84C', color: '#080810', fontWeight: 'bold' }}>✓</div>
                    )}
                  </div>

                  {/* Strengths */}
                  <div className="mb-2">
                    {formation.strengths.slice(0, 2).map(s => (
                      <div key={s} className="flex items-center gap-1.5 text-xs mb-0.5"
                        style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                        <span>+</span> {s}
                      </div>
                    ))}
                  </div>

                  {/* Weaknesses */}
                  <div>
                    {formation.weaknesses.slice(0, 1).map(w => (
                      <div key={w} className="flex items-center gap-1.5 text-xs"
                        style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>
                        <span>−</span> {w}
                      </div>
                    ))}
                  </div>

                  {/* Matchup info */}
                  {formation.counters.length > 0 && (
                    <div className="mt-2 text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      Vence: <span style={{ color: '#22C55E' }}>{formation.counters.join(', ')}</span>
                      {' · '}
                      Perde: <span style={{ color: '#EF4444' }}>{formation.counteredBy.join(', ')}</span>
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
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContinue}
            className="w-full mt-6 py-4 rounded-xl font-black text-xl tracking-widest"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
              color: '#080810',
              boxShadow: '0 0 30px rgba(201,168,76,0.3)',
            }}
          >
            INICIAR DRAFT →
          </motion.button>
        </div>

        {/* Right: Formation preview */}
        <div className="flex flex-col items-center gap-4 lg:w-80">
          <div className="text-center">
            <div className="text-sm font-bold tracking-widest mb-1"
              style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
              PRÉVIA DA FORMAÇÃO
            </div>
          </div>

          {selectedFormation && (
            <motion.div
              key={selectedFormation.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <FormationField
                formation={selectedFormation}
                players={[]}
                compact={false}
              />
            </motion.div>
          )}

          {selectedFormation && (
            <div className="w-full rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <div className="text-xs font-bold mb-2 tracking-widest"
                style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                ANÁLISE TÁTICA
              </div>
              <div className="space-y-1">
                {selectedFormation.strengths.map(s => (
                  <div key={s} className="flex items-start gap-2 text-xs"
                    style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                    <span className="flex-shrink-0">✓</span> {s}
                  </div>
                ))}
                {selectedFormation.weaknesses.map(w => (
                  <div key={w} className="flex items-start gap-2 text-xs"
                    style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>
                    <span className="flex-shrink-0">✗</span> {w}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
