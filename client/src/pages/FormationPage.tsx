// UCL Immortals — Formation Selection Page

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { FORMATIONS, COACHES } from '../lib/gameData';
import { formationProfile } from '../lib/gameEngine';
import FormationField from '../components/game/FormationField';
import ImpactMeter from '../components/game/ImpactMeter';
import { AppShell, Button, ChoiceCard, PageContainer, Panel, SectionHeader, TopBar } from '../design-system';

export default function FormationPage() {
  const { state, dispatch, submitSetupOnline } = useGame();
  const selectedCoach = COACHES.find(c => c.id === state.selectedCoachId);

  const me = state.mode === 'online' ? state.onlinePlayers.find(p => p.socketId === state.socketId) : null;
  const isReady = me?.ready || false;

  const handleSelect = (formationId: string) => {
    dispatch({ type: 'SET_FORMATION', formationId });
  };

  const handleDoubleClick = (formationId: string) => {
    // Ensure the formation that received the double click is the one submitted,
    // even if both click events are batched by the browser.
    dispatch({ type: 'SET_FORMATION', formationId });
    handleContinue();
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

      <PageContainer wide className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Formation list */}
        <div className="flex-1">
          <SectionHeader
            kicker="PLANO DE JOGO · 05"
            title="Escolha a formação"
            description={selectedCoach ? `${selectedCoach.name} prefere ${selectedCoach.preferredFormation}.` : undefined}
            className="mb-6"
          />

          <div role="note" className="ui-panel ui-panel--inset mb-4 px-3 py-2.5">
            <div className="text-xs font-black tracking-widest" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
              COMO LER OS INDICADORES
            </div>
            <p className="mt-1 text-sm leading-relaxed text-pretty" style={{ color: '#A7A7B8', fontFamily: 'Rajdhani, sans-serif' }}>
              Controle gera mais iniciativa, volume de jogadas e posse. Ataque torna suas chances mais perigosas. Defesa reduz o perigo das chances adversárias. Um confronto favorável concede um <b style={{ color: '#22C55E' }}>bônus temporário ao time durante a partida</b>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMATIONS.map((formation) => {
              const isSelected = state.selectedFormationId === formation.id;
              const isPreferred = selectedCoach?.preferredFormation === formation.id;

              return (
                <ChoiceCard
                  key={formation.id}
                  selected={isSelected}
                  onClick={() => handleSelect(formation.id)}
                  onDoubleClick={() => handleDoubleClick(formation.id)}
                  title="Clique duas vezes para escolher e iniciar o draft"
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
                      <div key={s} className="mb-0.5 flex items-center gap-1.5 text-sm"
                        style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                        <span>+</span> {s}
                      </div>
                    ))}
                  </div>

                  {/* Weaknesses */}
                  <div>
                    {formation.weaknesses.slice(0, 1).map(w => (
                      <div key={w} className="flex items-center gap-1.5 text-sm"
                        style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>
                        <span>−</span> {w}
                      </div>
                    ))}
                  </div>

                  {/* Impacto qualitativo (setas) */}
                  <div className="mt-2">
                    <ImpactMeter profile={formationProfile(formation.id)} />
                  </div>

                  {/* Matchup info — bônus situacional de equipe, aplicado somente durante a partida */}
                  {(formation.counters.length > 0 || formation.counteredBy.length > 0) && (
                    <div className="mt-3 text-sm leading-relaxed text-pretty" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                      {formation.counters.length > 0 && (
                        <>Confronto favorável contra: <span style={{ color: '#22C55E' }}>{formation.counters.join(', ')}</span> <span style={{ color: '#22C55E' }}>(bônus durante a partida)</span></>
                      )}
                      {formation.counters.length > 0 && formation.counteredBy.length > 0 && ' · '}
                      {formation.counteredBy.length > 0 && (
                        <>Pode sofrer contra: <span style={{ color: '#F97316' }}>{formation.counteredBy.join(', ')}</span> <span style={{ color: '#F97316' }}>(o rival recebe um bônus na partida)</span></>
                      )}
                    </div>
                  )}
                </ChoiceCard>
              );
            })}
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
                showPlayerCards
              />
            </motion.div>
          )}

          {selectedFormation && (
            <Panel tone="inset" className="w-full p-4">
              <div className="mb-2 text-sm font-bold tracking-widest"
                style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                ANÁLISE TÁTICA
              </div>
              <div className="space-y-1">
                {selectedFormation.strengths.map(s => (
                  <div key={s} className="flex items-start gap-2 text-sm"
                    style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                    <span className="flex-shrink-0">✓</span> {s}
                  </div>
                ))}
                {selectedFormation.weaknesses.map(w => (
                  <div key={w} className="flex items-start gap-2 text-sm"
                    style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>
                    <span className="flex-shrink-0">✗</span> {w}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
        </div>

        {/* Mesmo padrão de ações das etapas de técnico e escudo. */}
        <div className="mt-8 flex gap-3">
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
      </PageContainer>
    </AppShell>
  );
}
