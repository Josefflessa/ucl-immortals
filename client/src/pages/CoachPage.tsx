// UCL Immortals — Coach Selection Page

import { motion } from 'framer-motion';
import { Brain, Check, Flame, Heart, Scale, Shield, Sparkles, Star, Zap, type LucideIcon } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import CompetitionExitControl from '../components/game/CompetitionExitControl';
import { COACHES } from '@shared/game/gameData';
import { PREFERRED_FORMATION_CHEM_BONUS } from '@shared/game/gameEngine';
import { AppShell, Button, ChoiceCard, FixedActionBar, PageContainer, SectionHeader, TopBar } from '../design-system';

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
          className="mx-auto w-full max-w-4xl"
        >
          {/* Title */}
          <SectionHeader
            title="Escolha seu treinador"
            description="O treinador define sua filosofia de jogo e bônus táticos. Jogadores que trabalharam com ele ganham química extra."
            className="mb-8"
          />

          {/* Coach grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {COACHES.map((coach) => {
              const isSelected = state.selectedCoachId === coach.id;
              const color = COACH_COLORS[coach.id] || '#C9A84C';
              const CoachStyle = COACH_ICONS[coach.id];
              const icon = CoachStyle ? <CoachStyle size={26} strokeWidth={2.2} color={color} /> : '⚽';

              return (
                <ChoiceCard
                  key={coach.id}
                  selected={isSelected}
                  onClick={() => handleSelect(coach.id)}
                  onDoubleClick={() => handleDoubleClick(coach.id)}
                  title="Clique duas vezes para escolher e continuar"
                  className="ui-choice relative text-left p-6"
                  style={{
                    background: isSelected ? 'var(--ui-surface-2)' : undefined,
                    border: `1px solid ${isSelected ? 'var(--ui-brand-strong)' : 'var(--ui-line-subtle)'}`,
                    boxShadow: isSelected ? '0 0 0 1px var(--ui-brand-soft)' : 'none',
                  }}
                >
                  {/* Selected badge */}
                  {isSelected && (
                    <span
                      className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full"
                      style={{ background: 'var(--ui-brand-strong)', color: '#0A0A12' }}
                      aria-hidden="true"
                    >
                      <Check size={18} strokeWidth={3.2} />
                    </span>
                  )}

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
                      <div
                        className="text-[22px] font-black leading-none"
                        style={{
                          fontFamily: 'var(--font-display), sans-serif',
                          color: isSelected ? 'var(--ui-brand-strong)' : '#FFFFFF',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {coach.name.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Bonus */}
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center gap-2 text-[12px] font-black tracking-[0.14em]" style={{ color, fontFamily: 'var(--font-game), sans-serif' }}>
                      <Zap size={14} strokeWidth={2.6} aria-hidden="true" />BÔNUS DO TÉCNICO
                    </div>
                    <p className="text-[15px] font-semibold leading-snug" style={{ color: '#ECECF4', fontFamily: 'var(--font-game), sans-serif' }}>
                      {coach.effect}
                    </p>
                  </div>

                  {/* Ability */}
                  <div className="mt-4 rounded-xl p-3.5" style={{ background: `${color}12`, border: `1px solid ${color}2E` }}>
                    <div className="mb-1 flex items-center gap-2 text-[12px] font-black tracking-[0.14em]" style={{ color, fontFamily: 'var(--font-game), sans-serif' }}>
                      <Sparkles size={14} strokeWidth={2.6} aria-hidden="true" />HABILIDADE · {coach.specialAbilityName.toUpperCase()}
                    </div>
                    <p className="text-[15px] leading-snug" style={{ color: '#D6D6E2', fontFamily: 'var(--font-game), sans-serif' }}>
                      {coach.specialAbility}
                    </p>
                  </div>

                  {/* Preferred formation */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-4" style={{ borderColor: 'var(--ui-line-subtle)' }}>
                    <span className="text-[13px] font-bold tracking-wide" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                      FORMAÇÃO PREFERIDA
                    </span>
                    <span
                      className="rounded-lg px-3 py-1 text-[15px] font-black"
                      style={{ background: 'var(--ui-surface-3)', color: 'var(--ui-brand-strong)', fontFamily: 'var(--font-game), sans-serif' }}
                    >
                      {coach.preferredFormation}
                    </span>
                    <span className="basis-full text-[14px] leading-snug" style={{ color: 'var(--ui-success)', fontFamily: 'var(--font-game), sans-serif' }}>
                      Jogando no {coach.preferredFormation}, o time inteiro ganha <b>+{PREFERRED_FORMATION_CHEM_BONUS} de Química Geral</b>.
                    </span>
                  </div>
                </ChoiceCard>
              );
            })}
          </div>

        </motion.div>
      </PageContainer>
      <FixedActionBar contentClassName="max-w-4xl">
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
