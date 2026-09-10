// UCL Immortals — Formation Selection Page

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { FORMATIONS, COACHES } from '../lib/gameData';
import { formationProfile } from '../lib/gameEngine';
import FormationField from '../components/game/FormationField';
import ImpactMeter from '../components/game/ImpactMeter';
import { AppShell, Button, ChoiceCard, PageContainer, Panel, SectionHeader, TopBar } from '../design-system';

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
      submitSetupOnline(state.selectedCoachId, state.selectedFormationId, state.selectedCrestId);
    } else {
      dispatch({ type: 'START_DRAFT' });
    }
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', phase: 'coach' });
  };

  const selectedFormation = FORMATIONS.find(f => f.id === state.selectedFormationId);
  if (state.mode === 'online' && isReady) {
    return (
      <AppShell className="flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 text-4xl text-[var(--ui-brand-strong)]">◌</div>
        <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--ui-brand)] border-t-transparent" />
        <div className="max-w-xs text-lg font-bold leading-snug text-[var(--ui-text)] sm:max-w-md">
          Aguardando os demais jogadores definirem a tática…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar playerName={state.playerName} />

      <PageContainer wide className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Formation list */}
        <div className="flex-1">
          <SectionHeader
            kicker="PLANO DE JOGO · 04"
            title="Escolha a formação"
            description={selectedCoach ? `${selectedCoach.name} prefere ${selectedCoach.preferredFormation}.` : undefined}
            className="mb-6"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMATIONS.map((formation) => {
              const isSelected = state.selectedFormationId === formation.id;
              const isPreferred = selectedCoach?.preferredFormation === formation.id;

              return (
                <ChoiceCard
                  key={formation.id}
                  selected={isSelected}
                  onClick={() => handleSelect(formation.id)}
                  className="ui-choice text-left p-4"
                  style={{
                    background: isSelected ? '#14142A' : '#0F0F1A',
                    border: `1px solid ${isSelected ? '#C9A84C' : isPreferred ? '#C9A84C44' : '#1A1A2A'}`,
                    boxShadow: isSelected ? '0 0 0 1px rgba(201,168,76,0.18)' : 'none',
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

                  {/* Impacto qualitativo (setas) */}
                  <div className="mt-2">
                    <ImpactMeter profile={formationProfile(formation.id)} />
                  </div>

                  {/* Matchup info — leve vantagem/desvantagem situacional (não decide o jogo) */}
                  {(formation.counters.length > 0 || formation.counteredBy.length > 0) && (
                    <div className="mt-2 text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {formation.counters.length > 0 && (
                        <>Vantagem contra: <span style={{ color: '#22C55E' }}>{formation.counters.join(', ')}</span></>
                      )}
                      {formation.counters.length > 0 && formation.counteredBy.length > 0 && ' · '}
                      {formation.counteredBy.length > 0 && (
                        <>Desvantagem contra: <span style={{ color: '#F97316' }}>{formation.counteredBy.join(', ')}</span></>
                      )}
                    </div>
                  )}
                </ChoiceCard>
              );
            })}
          </div>

          {/* Continue */}
          <div className="mt-6 flex gap-3">
            <Button onClick={handleBack} intent="ghost" className="border border-[var(--ui-line-subtle)]">
              ← VOLTAR
            </Button>
            <Button
              intent="primary"
              size="large"
              onClick={handleContinue}
              className="flex-1"
            >
              INICIAR DRAFT →
            </Button>
          </div>
        </div>

        {/* Right: Formation preview */}
        <div className="flex flex-col items-center gap-4 lg:w-80">
          <div className="ui-kicker mb-0">Prévia da formação</div>

          {selectedFormation && (
            <motion.div
              key={selectedFormation.id}
              className="w-full"
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
            <Panel tone="inset" className="w-full p-4">
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
            </Panel>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
