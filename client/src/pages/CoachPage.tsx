// UCL Immortals — Coach Selection Page

import { motion } from 'framer-motion';
import { Brain, Flame, Heart, Scale, Shield, Sparkles, Star, Zap, type LucideIcon } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import CompetitionExitControl from '../components/game/CompetitionExitControl';
import { COACHES } from '@shared/game/gameData';
import { PREFERRED_FORMATION_CHEM_BONUS } from '@shared/game/gameEngine';
import { coachBaseDescription, coachPrimeDefinition } from '../lib/coachPrime';
import { AppShell, Button, ChoiceCard, ChoiceCheck, FixedActionBar, PageContainer, SectionHeader, TopBar } from '../design-system';

/** Shown when a coach has no photo: his style, as a line icon. */
const COACH_ICONS: Record<string, LucideIcon> = {
  guardiola: Brain,
  klopp: Flame,
  mourinho: Shield,
  ancelotti: Scale,
  zidane: Star,
  ferguson: Heart,
  luis_enrique: Zap,
};

const COACH_COLORS: Record<string, string> = {
  guardiola: '#3B82F6',
  klopp: '#EF4444',
  mourinho: '#8B5CF6',
  ancelotti: '#10B981',
  zidane: '#C9A84C',
  ferguson: '#F97316',
  luis_enrique: '#38BDF8',
};

export default function CoachPage() {
  const { state, dispatch } = useGame();

  const handleSelect = (coachId: string) => {
    dispatch({ type: 'SET_COACH', coachId });
  };

  const handleDoubleClick = (coachId: string) => {
    // Ensure the card that received the double click is the one submitted,
    // even if both click events are batched by the browser.
    dispatch({ type: 'SET_COACH', coachId });
    handleContinue();
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_PHASE', phase: 'formation' });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', phase: 'crest' });
  };

  return (
    <AppShell>
      <TopBar right={<CompetitionExitControl />} />

      <PageContainer wide className="pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          {/* Title */}
          <SectionHeader
            title="Escolha seu treinador"
            description="Cada treinador reforça dois atributos do elenco e traz uma habilidade própria."
            className="mb-8"
          />

          {/* Coach grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {COACHES.map((coach) => {
              const isSelected = state.selectedCoachId === coach.id;
              const color = COACH_COLORS[coach.id] || '#C9A84C';
              const CoachStyle = COACH_ICONS[coach.id];
              const icon = CoachStyle ? <CoachStyle size={26} strokeWidth={2.2} color={color} /> : '⚽';
              const baseDescription = coachBaseDescription(coach);
              const abilityDescription = coachPrimeDefinition(coach).normal;

              return (
                <ChoiceCard
                  key={coach.id}
                  selected={isSelected}
                  onClick={() => handleSelect(coach.id)}
                  onDoubleClick={() => handleDoubleClick(coach.id)}
                  title="Clique duas vezes para escolher e continuar"
                  className="relative flex h-full flex-col p-5 text-left sm:p-6"
                >
                  {isSelected && <ChoiceCheck className="absolute right-4 top-4" />}

                  {/* Photo + name + philosophy */}
                  <div className="flex items-center gap-4 pr-10">
                    {coach.photoUrl ? (
                      <img
                        src={coach.photoUrl}
                        alt={coach.name}
                        referrerPolicy="no-referrer"
                        className="size-[84px] flex-shrink-0 rounded-2xl object-cover"
                        style={{
                          objectPosition: 'center top',
                          border: `2px solid ${isSelected ? 'var(--ui-brand-strong)' : color + '66'}`,
                        }}
                      />
                    ) : (
                      <div
                        className="flex size-[84px] flex-shrink-0 items-center justify-center rounded-2xl text-3xl"
                        style={{ background: `${color}22`, border: `2px solid ${color}66` }}
                      >
                        {icon}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className={`font-display text-title-lg uppercase leading-none tracking-display ${isSelected ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text)]'}`}>
                        {coach.name}
                      </div>
                      <div className="mt-1 text-sm font-bold leading-snug" style={{ color, fontFamily: 'var(--font-game), sans-serif' }}>
                        {coach.philosophy}
                      </div>
                    </div>
                  </div>

                  {/* Bonus */}
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center gap-2 text-body-sm font-black tracking-kicker" style={{ color, fontFamily: 'var(--font-game), sans-serif' }}>
                      <Zap size={14} strokeWidth={2.6} aria-hidden="true" />BÔNUS BASE
                    </div>
                    <div className="space-y-1 text-base font-semibold leading-snug" style={{ color: 'var(--ui-text)', fontFamily: 'var(--font-game), sans-serif' }}>
                      {baseDescription.map((line, index) => <p key={index}>{line}</p>)}
                    </div>
                  </div>

                  {/* Ability */}
                  <div className="mb-4 mt-4 rounded-xl p-3.5" style={{ background: `${color}12`, border: `1px solid ${color}2E` }}>
                    <div className="mb-1 flex items-center gap-2 text-body-sm font-black tracking-kicker" style={{ color, fontFamily: 'var(--font-game), sans-serif' }}>
                      <Sparkles size={14} strokeWidth={2.6} aria-hidden="true" />HABILIDADE · {coach.specialAbilityName.toUpperCase()}
                    </div>
                    <p className="text-base leading-snug" style={{ color: 'var(--ui-text-soft)', fontFamily: 'var(--font-game), sans-serif' }}>
                      {abilityDescription}
                    </p>
                  </div>

                  {/* Preferred formation */}
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-4" style={{ borderColor: 'var(--ui-line-subtle)' }}>
                    <span className="text-sm font-bold tracking-wide" style={{ color: 'var(--ui-text-muted)', fontFamily: 'var(--font-game), sans-serif' }}>
                      FORMAÇÃO PREFERIDA
                    </span>
                    <span
                      className="rounded-lg px-3 py-1 text-[15px] font-black"
                      style={{ background: 'var(--ui-surface-3)', color: 'var(--ui-brand-strong)', fontFamily: 'var(--font-game), sans-serif' }}
                    >
                      {coach.preferredFormation}
                    </span>
                    <span className="basis-full text-[15px] leading-snug" style={{ color: 'var(--ui-success)', fontFamily: 'var(--font-game), sans-serif' }}>
                      Nessa formação, o time recebe <b>+{PREFERRED_FORMATION_CHEM_BONUS} de química geral</b>.
                    </span>
                  </div>
                </ChoiceCard>
              );
            })}
          </div>

        </motion.div>
      </PageContainer>
      <FixedActionBar>
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
      </FixedActionBar>
    </AppShell>
  );
}
