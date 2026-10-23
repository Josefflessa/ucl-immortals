// UCL Immortals — Formation Selection Page

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { FORMATIONS, COACHES } from '@shared/game/gameData';
import { formationAdvantageLabelForAnalysisLevel, formationProfile } from '@shared/game/gameEngine';
import FormationField from '../components/game/FormationField';
import OnlineWaitingScreen from '../components/game/OnlineWaitingScreen';
import CompetitionExitControl from '../components/game/CompetitionExitControl';
import ImpactMeter from '../components/game/ImpactMeter';
import { AppShell, Badge, Button, ChoiceCard, ChoiceCheck, FixedActionBar, PageContainer, Panel, SectionHeader, StatusBanner, TopBar } from '../design-system';
import { Star } from 'lucide-react';
import { INLINE_ICON } from '../components/game/inlineIcon';
import { useAlbum } from '../contexts/AlbumContext';

export default function FormationPage() {
  const { state, dispatch, submitSetupOnline } = useGame();
  const { captureCompetitionSnapshot, loading: albumLoading, error: albumError } = useAlbum();
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

  const handleContinue = async () => {
    if (state.mode === 'online') {
      submitSetupOnline(state.selectedCoachId, state.selectedFormationId, state.selectedCrestId, state.teamName);
    } else {
      if (albumLoading) return;
      try {
        const snapshot = await captureCompetitionSnapshot();
        dispatch({
          type: 'START_DRAFT',
          albumLevelSnapshot: Object.fromEntries(snapshot.levels),
          albumPageBonusSnapshot: Object.fromEntries(snapshot.pageBonuses),
        });
      } catch {
        // The Album provider keeps the error visible; do not start a competition
        // with an incomplete snapshot. The button can retry the load.
      }
    }
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', phase: 'coach' });
  };

  const selectedFormation = FORMATIONS.find(f => f.id === state.selectedFormationId);
  if (state.mode === 'online' && isReady) {
    return <OnlineWaitingScreen message="Os demais jogadores estão escolhendo a formação…" headerRight={<CompetitionExitControl />} />;
  }

  return (
    <AppShell>
      <TopBar right={<CompetitionExitControl />} />

      <PageContainer wide className="flex flex-col gap-6 pb-32">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Left: Formation list */}
        <div className="min-w-0 flex-1">
          <SectionHeader
            title="Escolha a formação"
            description={selectedCoach ? `${selectedCoach.name} prefere ${selectedCoach.preferredFormation}.` : undefined}
            className="mb-6"
          />

          <div role="note" className="ui-panel ui-panel--inset mb-4 px-4 py-3">
            <div className="ui-kicker mb-0">Como ler os indicadores</div>
            <p className="mt-1.5 text-body leading-ui-snug text-pretty" style={{ color: 'var(--ui-text-soft)', fontFamily: 'var(--font-game), sans-serif' }}>
              Controle gera mais iniciativa, volume de jogadas e posse. Ataque torna suas chances mais perigosas. Defesa reduz o perigo das chances adversárias. Um confronto favorável dá um <b style={{ color: 'var(--ui-success)' }}>bônus ao time durante a partida</b>.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
                    className="p-4 text-left"
                    style={!isSelected && isPreferred ? { borderColor: 'var(--ui-brand-line)' } : undefined}
                  >
                    <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
                      <span className={`font-display text-heading leading-none tracking-caps ${isSelected ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text)]'}`}>
                        {formation.name}
                      </span>
                      <span className="flex items-center gap-2">
                        {isPreferred && (
                          <Badge tone="brand">
                            <Star {...INLINE_ICON} fill="currentColor" />Preferida
                          </Badge>
                        )}
                        {isSelected && <ChoiceCheck size="small" />}
                      </span>
                    </div>

                    {/* Impacto qualitativo (setas) */}
                    <div className="mt-2">
                      <ImpactMeter profile={formationProfile(formation.id)} />
                    </div>

                    {/* Matchup info — bônus situacional de equipe, aplicado somente durante a partida */}
                    {(formation.counters.length > 0 || formation.counteredBy.length > 0) && (
                      <div className="mt-3 space-y-1 text-body-sm leading-ui-snug text-pretty" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        {formation.counters.length > 0 && (
                          <div>
                            <span className="font-bold" style={{ color: 'var(--ui-success)' }}>Vantagem contra: </span>
                            <span style={{ color: 'var(--ui-success)' }}>{formation.counters.join(', ')} · {formationAdvantageLabelForAnalysisLevel(1)}</span>
                          </div>
                        )}
                        {formation.counteredBy.length > 0 && (
                          <div>
                            <span className="font-bold" style={{ color: 'var(--ui-caution)' }}>Desvantagem contra: </span>
                            <span style={{ color: 'var(--ui-caution)' }}>{formation.counteredBy.join(', ')} (o rival terá {formationAdvantageLabelForAnalysisLevel(1).toLowerCase()})</span>
                          </div>
                        )}
                      </div>
                    )}
                </ChoiceCard>
              );
            })}
          </div>

        </div>

        {/* Right: Formation preview */}
        <div className="flex flex-col items-center gap-4 lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
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
              />
            </motion.div>
          )}

          {selectedFormation && (
            <Panel tone="inset" className="w-full p-4">
              <div className="ui-kicker">Indicadores do esquema</div>
              <ImpactMeter profile={formationProfile(selectedFormation.id)} />
              <div className="mt-3 space-y-2 text-sm" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                <div>
                  <span className="font-bold text-[var(--ui-success)]">Vantagem contra:</span>{' '}
                  <span className="text-[var(--ui-text-soft)]">{selectedFormation.counters.join(', ') || 'Nenhuma formação específica'}</span>
                </div>
                <div>
                  <span className="font-bold text-[var(--ui-caution)]">Desvantagem contra:</span>{' '}
                  <span className="text-[var(--ui-text-soft)]">{selectedFormation.counteredBy.join(', ') || 'Nenhuma formação específica'}</span>
                </div>
                <div className="text-label text-[var(--ui-text-muted)]">
                  Um confronto favorável concede <strong className="text-[var(--ui-success)]">{formationAdvantageLabelForAnalysisLevel(1).toLowerCase()}</strong> ao time durante a partida.
                </div>
              </div>
            </Panel>
          )}
        </div>
        </div>

        {state.mode === 'solo' && albumError && (
          <StatusBanner tone="warning" role="status" className="mt-4">
            Não foi possível confirmar os níveis do Álbum. Toque em Iniciar draft de novo para carregar o progresso.
          </StatusBanner>
        )}
      </PageContainer>
      <FixedActionBar>
        <Button onClick={handleBack} intent="ghost" className="border border-[var(--ui-line-subtle)]">
          ← VOLTAR
        </Button>
        <Button
          intent="primary"
          size="large"
          disabled={state.mode === 'solo' && albumLoading}
          onClick={handleContinue}
          className="flex-1"
        >
          {state.mode === 'solo' && albumLoading ? 'CARREGANDO ÁLBUM…' : 'INICIAR DRAFT →'}
        </Button>
      </FixedActionBar>

    </AppShell>
  );
}
