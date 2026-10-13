// UCL Immortals — Setup Page
// Choose difficulty level before coach selection

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useAccount } from '../contexts/AccountContext';
import CompetitionExitControl from '../components/game/CompetitionExitControl';
import { DIFFICULTY_LEVELS, getRarityColor, type Rarity } from '@shared/game/gameData';
import { ALBUM_TIER_META, type AlbumItemKey } from '@shared/game/album';
import { COMPETITION_FINISH_STAGES, competitionCoinReward, competitionStagePoints, type CompetitionFinishStage, type RankedDifficultyId } from '@shared/game/competitionRanking';
import DifficultyEmblem from '../components/game/DifficultyEmblem';
import { CoinAmount, ItemArt } from '../components/album/AlbumPieces';
import { cn } from '../lib/utils';
import { AppShell, Button, ChoiceCard, FixedActionBar, GameModal, PageContainer, SectionHeader, TopBar } from '../design-system';

const FINISH_STAGE_LABELS: Record<CompetitionFinishStage, string> = {
  champion: 'Campeão',
  runnerUp: 'Vice-campeão',
  semifinalist: 'Semifinal',
  quarterfinalist: 'Quartas de final',
  roundOf16: 'Oitavas de final',
  playoff: 'Playoff',
  leaguePhase: 'Fase de liga',
};

export default function SetupPage() {
  const { state, dispatch, createRoom } = useGame();
  const { account } = useAccount();
  const canViewDifficultyRewards = Boolean(account);
  const isOnlineRoomCreation = state.onlineSetupIntent === 'create';
  const lastDifficultyClick = useRef<{ id: string; at: number } | null>(null);
  const [infoDifficulty, setInfoDifficulty] = useState<RankedDifficultyId | null>(null);
  const infoDifficultyLevel = DIFFICULTY_LEVELS.find(diff => diff.id === infoDifficulty);

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
    if (account) {
      dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: null });
      dispatch({ type: 'SET_PHASE', phase: 'menu' });
      return;
    }
    dispatch({ type: 'SET_PHASE', phase: 'format' });
  };

  return (
    <AppShell>
      <TopBar right={<CompetitionExitControl />} />

      <PageContainer narrow className="flex min-h-[calc(100dvh-64px)] flex-col pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          {/* Title */}
          <SectionHeader
            title="Escolha a dificuldade"
            description={isOnlineRoomCreation ? 'Define a força dos bots que completarão a competição da sala.' : 'Define a força dos times controlados pela IA na competição.'}
            className="mb-8"
          />

          {/* Difficulty grid */}
          <div className="ui-stack">
            {DIFFICULTY_LEVELS.map(diff => {
              const isSelected = state.difficulty === diff.id;
              const color = getRarityColor(diff.id as Rarity);

              return (
                <div key={diff.id} className="relative">
                  <ChoiceCard
                    selected={isSelected}
                    onClick={() => handleDifficultyClick(diff.id)}
                    title="Clique duas vezes para escolher e continuar"
                    className={cn('ui-choice flex w-full items-center gap-3.5 px-4 py-3.5', canViewDifficultyRewards ? 'pr-14' : 'pr-4')}
                    style={{
                      background: isSelected ? `${color}14` : undefined,
                      border: `1.5px solid ${isSelected ? color : '#1A1A2A'}`,
                      boxShadow: isSelected ? `0 0 0 1px ${color}22` : 'none',
                    }}
                  >
                    <DifficultyEmblem difficulty={diff.id} size={72} className={cn('-my-2 transition-transform', isSelected && 'scale-105')} />
                    <div className="min-w-0 flex-1">
                      <span className="font-black tracking-wider" style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 20, color: isSelected ? color : '#FFFFFF' }}>
                        {diff.name.toUpperCase()}
                      </span>
                    </div>
                    {isSelected ? (
                      <div className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full', !canViewDifficultyRewards && 'absolute right-2 top-1/2 -translate-y-1/2')} style={{ background: color, color: 'var(--ui-bg)', fontSize: 13, fontWeight: 900 }} aria-hidden="true">
                        ✓
                      </div>
                    ) : null}
                  </ChoiceCard>
                  {canViewDifficultyRewards ? (
                    <button
                      type="button"
                      aria-label={`Ver recompensas de ${diff.name}`}
                      title={`Recompensas de ${diff.name}`}
                      onClick={() => setInfoDifficulty(diff.id as RankedDifficultyId)}
                      className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] text-[var(--ui-text-muted)] transition-colors hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand-strong)]"
                    >
                      <Info size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

        </motion.div>
      </PageContainer>

      <FixedActionBar narrow>
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
      </FixedActionBar>

      <GameModal
        open={canViewDifficultyRewards && infoDifficulty !== null}
        onOpenChange={open => { if (!open) setInfoDifficulty(null); }}
        title={infoDifficultyLevel ? `Recompensas · ${infoDifficultyLevel.name}` : 'Recompensas'}
        subtitle="Envelope, pacote, pontos e moedas por fase"
        closeLabel="Fechar recompensas"
      >
        {infoDifficulty ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3">
                <div className="flex h-16 w-12 shrink-0 items-center justify-center">
                  <ItemArt itemKey={`envelope:${infoDifficulty}` as AlbumItemKey} height={64} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ui-text)]">1 envelope {ALBUM_TIER_META[infoDifficulty].label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Recebido ao encerrar a campanha.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-3">
                <div className="flex h-16 w-12 shrink-0 items-center justify-center">
                  <ItemArt itemKey={`pack:${infoDifficulty}` as AlbumItemKey} height={64} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ui-text)]">Pacote {ALBUM_TIER_META[infoDifficulty].label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Recebido ao ser campeão.</p>
                </div>
              </div>
            </div>

            <section aria-labelledby="difficulty-ranking-rewards" className="space-y-2">
              <div>
                <h3 id="difficulty-ranking-rewards" className="text-xs font-bold uppercase tracking-wide text-[var(--ui-text-soft)]">Pontos por fase</h3>
                <p className="mt-1 text-xs text-[var(--ui-text-muted)]">Conta a fase mais distante alcançada na campanha.</p>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 px-3 text-[10px] font-bold uppercase tracking-wide text-[var(--ui-text-faint)]">
                <span>Fase</span>
                <span>Pontos</span>
                <span>Moedas</span>
              </div>
              <dl className="divide-y divide-[var(--ui-line-subtle)] overflow-hidden rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3">
                {COMPETITION_FINISH_STAGES.map(stage => (
                  <div key={stage} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-2 text-sm">
                    <dt className="text-[var(--ui-text-muted)]">{FINISH_STAGE_LABELS[stage]}</dt>
                    <dd className="text-right font-semibold tabular-nums" style={{ color: getRarityColor(infoDifficulty as Rarity) }}>{competitionStagePoints(stage, infoDifficulty)} pts</dd>
                    <dd><CoinAmount value={competitionCoinReward(stage, infoDifficulty)} size={14} className="text-xs" /></dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        ) : null}
      </GameModal>
    </AppShell>
  );
}
