// UCL Immortals — Setup Page
// Choose difficulty level before coach selection

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS, getRarityColor, type Rarity } from '../lib/gameData';
import { AppShell, Button, ChoiceCard, PageContainer, SectionHeader, TopBar } from '../design-system';

export default function SetupPage() {
  const { state, dispatch, createRoom } = useGame();
  const isOnlineRoomCreation = state.onlineSetupIntent === 'create';
  const lastDifficultyClick = useRef<{ id: string; at: number } | null>(null);

  const handleSelect = (diffId: string) => {
    dispatch({ type: 'SET_DIFFICULTY', difficulty: diffId });
  };

  const handleContinue = (difficultyOverride?: string) => {
    const difficulty = difficultyOverride ?? state.difficulty;
    if (isOnlineRoomCreation) {
      createRoom(state.playerName.trim(), state.competitionFormat, difficulty);
      return;
    }
    dispatch({ type: 'SET_PHASE', phase: 'crest' });
  };

  const handleDifficultyClick = (diffId: string) => {
    const now = performance.now();
    const previous = lastDifficultyClick.current;
    const isDoubleClick = previous?.id === diffId && now - previous.at <= 500;

    handleSelect(diffId);
    lastDifficultyClick.current = isDoubleClick ? null : { id: diffId, at: now };

    // Use the clicked card as the source of truth. This avoids depending on a
    // state update completing between the two clicks, which was unreliable in
    // the online room-creation flow on some browsers.
    if (isDoubleClick) handleContinue(diffId);
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', phase: 'format' });
  };

  return (
    <AppShell>
      <TopBar playerName={state.playerName} />

      <PageContainer narrow className="flex min-h-[calc(100dvh-64px)] flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          {/* Title */}
          <SectionHeader
            kicker="NÍVEL DA COMPETIÇÃO"
            title="Escolha a dificuldade"
            description={isOnlineRoomCreation ? 'Define a força dos bots que completarão a competição da sala.' : 'Define a força dos times controlados pela IA na competição.'}
            className="mb-8"
          />

          {/* Difficulty grid */}
          <div className="ui-stack">
            {DIFFICULTY_LEVELS.map((diff, i) => {
              const isSelected = state.difficulty === diff.id;
              const color = getRarityColor(diff.id as Rarity);
              const level = i + 1; // 1..5

              return (
                <ChoiceCard
                  key={diff.id}
                  selected={isSelected}
                  onClick={() => handleDifficultyClick(diff.id)}
                  title="Clique duas vezes para escolher e continuar"
                  className="ui-choice flex items-center gap-3.5 px-4 py-3.5"
                  style={{
                    background: isSelected ? `${color}14` : undefined,
                    border: `1.5px solid ${isSelected ? color : '#1A1A2A'}`,
                    boxShadow: isSelected ? `0 0 0 1px ${color}22` : 'none',
                  }}
                >
                  {/* Emblema do tier (número do nível na cor da raridade) */}
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18`, border: `1.5px solid ${isSelected ? color : `${color}55`}` }}>
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
                    {/* Medidor visual do nível selecionado */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, k) => (
                          <div key={k} style={{ width: 17, height: 5, borderRadius: 3, background: k < level ? color : '#22222F' }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Selecionado */}
                  {isSelected && (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: color, color: '#080810', fontSize: 13, fontWeight: 900 }}>
                      ✓
                    </div>
                  )}
                </ChoiceCard>
              );
            })}
          </div>

          {/* Continue button */}
          <div className="mt-8 flex gap-3">
            <Button onClick={handleBack} intent="ghost" className="border border-[var(--ui-line-subtle)]">
              ← VOLTAR
            </Button>
            <Button
              intent="primary"
              size="large"
              onClick={() => handleContinue()}
              className="flex-1"
            >
              {isOnlineRoomCreation ? 'CRIAR SALA →' : 'ESCOLHER ESCUDO →'}
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    </AppShell>
  );
}
