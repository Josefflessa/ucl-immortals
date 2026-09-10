// UCL Immortals — Setup Page
// Choose difficulty level before coach selection

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { DIFFICULTY_LEVELS, getRarityColor, type Rarity } from '../lib/gameData';
import { MAX_LEAGUE_ROUNDS, MAX_QUALIFIED_TEAMS, MIN_LEAGUE_ROUNDS, MIN_QUALIFIED_TEAMS, competitionFormatSummary, validateCompetitionFormat } from '../lib/competition';
import { AppShell, Button, ChoiceCard, Input, PageContainer, SectionHeader, TopBar } from '../design-system';

export default function SetupPage() {
  const { state, dispatch } = useGame();
  const [leagueRounds, setLeagueRounds] = useState(String(state.competitionFormat.leagueRounds));
  const [qualifiedTeams, setQualifiedTeams] = useState(String(state.competitionFormat.qualifiedTeams));
  const [formatError, setFormatError] = useState<string | null>(null);

  const handleSelect = (diffId: string) => {
    dispatch({ type: 'SET_DIFFICULTY', difficulty: diffId });
  };

  const handleContinue = () => {
    const format = { leagueRounds: Number(leagueRounds), qualifiedTeams: Number(qualifiedTeams) };
    const error = validateCompetitionFormat(format);
    if (error) {
      setFormatError(error);
      return;
    }
    dispatch({ type: 'SET_COMPETITION_FORMAT', format });
    dispatch({ type: 'SET_PHASE', phase: 'crest' });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_PHASE', phase: 'menu' });
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
            kicker="NÍVEL DA COMPETIÇÃO · 01"
            title="Escolha a dificuldade"
            description="Define a força dos times controlados pela IA na competição."
            className="mb-8"
          />

          {/* Difficulty grid */}
          <div className="ui-stack">
            {DIFFICULTY_LEVELS.map((diff, i) => {
              const isSelected = state.difficulty === diff.id;
              const color = getRarityColor(diff.id as Rarity);
              const strengthPct = Math.round(diff.botStrength * 100);
              const level = i + 1; // 1..5

              return (
                <ChoiceCard
                  key={diff.id}
                  selected={isSelected}
                  onClick={() => handleSelect(diff.id)}
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
                    {/* Medidor de dificuldade (pips) + força IA */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, k) => (
                          <div key={k} style={{ width: 17, height: 5, borderRadius: 3, background: k < level ? color : '#22222F' }} />
                        ))}
                      </div>
                      <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>FORÇA IA {strengthPct}%</span>
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

          <div className="ui-panel ui-panel--inset mt-6 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="ui-section-label">FORMATO DA COMPETIÇÃO</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">
                  Configure a duração da fase de liga e quantos times seguem para o mata-mata.
                </p>
              </div>
              <span className="hidden sm:block text-right text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)]">
                36 times<br />mata-mata de 16
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">
                Rodadas da liga
                <Input
                  type="number"
                  min={MIN_LEAGUE_ROUNDS}
                  max={MAX_LEAGUE_ROUNDS}
                  step={1}
                  value={leagueRounds}
                  onChange={e => { setLeagueRounds(e.target.value); setFormatError(null); }}
                  className="ui-input mt-1 text-center"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">
                Times classificados
                <Input
                  type="number"
                  min={MIN_QUALIFIED_TEAMS}
                  max={MAX_QUALIFIED_TEAMS}
                  step={1}
                  value={qualifiedTeams}
                  onChange={e => { setQualifiedTeams(e.target.value); setFormatError(null); }}
                  className="ui-input mt-1 text-center"
                />
              </label>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-[var(--ui-text-faint)]">
              {competitionFormatSummary({ leagueRounds: Number(leagueRounds), qualifiedTeams: Number(qualifiedTeams) })}
            </p>
            {formatError && (
              <p className="mt-2 text-[11px] font-bold leading-relaxed text-[var(--ui-danger)]" role="alert">
                ⚠ {formatError}
              </p>
            )}
          </div>

          {/* Continue button */}
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
              ESCOLHER ESCUDO →
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    </AppShell>
  );
}
