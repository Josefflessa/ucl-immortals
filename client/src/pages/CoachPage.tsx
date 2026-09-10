// UCL Immortals — Coach Selection Page

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { COACHES } from '../lib/gameData';
import { AppShell, Button, ChoiceCard, PageContainer, SectionHeader, TopBar } from '../design-system';

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

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', phase: 'crest' });
  };

  return (
    <AppShell>
      <TopBar />

      <PageContainer wide>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-4xl"
        >
          {/* Title */}
          <SectionHeader
            kicker="IDENTIDADE TÁTICA · 03"
            title="Escolha seu treinador"
            description="O treinador define sua filosofia de jogo e bônus táticos. Jogadores que trabalharam com ele ganham química extra."
            className="mb-8"
          />

          {/* Coach grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COACHES.map((coach) => {
              const isSelected = state.selectedCoachId === coach.id;
              const color = COACH_COLORS[coach.id] || '#C9A84C';
              const icon = COACH_ICONS[coach.id] || '⚽';

              return (
                <ChoiceCard
                  key={coach.id}
                  selected={isSelected}
                  onClick={() => handleSelect(coach.id)}
                  className="ui-choice text-left p-5"
                  style={{
                    background: isSelected ? 'var(--ui-surface-2)' : undefined,
                    border: `1px solid ${isSelected ? 'var(--ui-brand-strong)' : 'var(--ui-line-subtle)'}`,
                    boxShadow: isSelected ? '0 0 0 1px var(--ui-brand-soft)' : 'none',
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
                          border: `1px solid ${isSelected ? 'var(--ui-brand-strong)' : 'var(--ui-line-subtle)'}`,
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
                          color: isSelected ? 'var(--ui-brand-strong)' : '#FFFFFF',
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
                      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--ui-brand-strong)' }} />
                      <span className="text-xs font-bold" style={{ color: 'var(--ui-brand-strong)', fontFamily: 'Rajdhani, sans-serif' }}>
                        SELECIONADO
                      </span>
                    </div>
                  )}
                </ChoiceCard>
              );
            })}
          </div>

          {/* Continue */}
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
              ESCOLHER FORMAÇÃO →
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    </AppShell>
  );
}
