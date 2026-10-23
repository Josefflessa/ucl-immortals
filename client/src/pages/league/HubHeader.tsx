import { useRef } from 'react';
import CompetitionExitControl from '../../components/game/CompetitionExitControl';
import CreditsWallet from '../../components/game/CreditsWallet';
import Crest from '../../components/game/Crest';
import MissionQuickSummary from '../../components/game/MissionQuickSummary';
import { Tab, TabList, Tabs, TopBar } from '../../design-system';
import { CircleCheck, CircleX } from 'lucide-react';
import { DIFFICULTY_LEVELS } from '@shared/game/gameData';
import SpoilerLock from './SpoilerLock';
import type { LeagueHub } from './useLeagueHub';


export function HubHeader({ hub }: { hub: LeagueHub }) {
  const {
    state, isKnockout, isGroupStage, isLeagueOnly, playerStanding, qualifies, playerPosition,
    knockoutLabel, leagueRound, leagueRounds, qualifiedTeams,
  } = hub;
  const difficultyName = DIFFICULTY_LEVELS.find(level => level.id === state.difficulty)?.name ?? state.difficulty;
  return (
    <>
      <TopBar
        title={isKnockout ? 'MATA-MATA' : isGroupStage ? 'FASE DE GRUPOS' : 'FASE DE LIGA'}
        subtitle={`DIFICULDADE · ${difficultyName}`}
        center={<CreditsWallet points={state.points} />}
        right={
          <div className="flex items-center gap-2 sm:gap-3">
              {!isKnockout && playerStanding && (
              <div className="flex items-center gap-2">
                <span className="text-label text-[var(--ui-text-muted)]">Posição</span>
                <span className={`font-display text-xl ${qualifies ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>{playerPosition}º</span>
              </div>
            )}
            <CompetitionExitControl />
          </div>
        }
      />

      {/* Page title: the stage the competition is in, aligned with the content below. */}
      <div className="ui-shell pt-5 sm:pt-8">
        <h1 className={`ui-title ${isKnockout ? 'text-[var(--ui-brand-strong)]' : ''}`}>
          {isKnockout ? knockoutLabel : isGroupStage ? `Fase de grupos · Rodada ${leagueRound} de ${leagueRounds}` : `Rodada ${leagueRound} de ${leagueRounds}`}
        </h1>
        <p className="ui-subtitle mt-1.5 text-body-sm sm:text-lead">
          {isKnockout ? 'Gerencie seu time entre os confrontos do mata-mata.' : isLeagueOnly ? 'Dispute rodada por rodada e termine no topo da tabela.' : isGroupStage ? `Dispute seu grupo e fique entre os ${state.competitionFormat.qualifiedPerGroup} primeiros.` : `Dispute rodada por rodada e termine entre os ${qualifiedTeams} melhores.`}
        </p>
      </div>
    </>
  );
}

export function HubSummary({ hub }: { hub: LeagueHub }) {
  const {
    isKnockout, isGroupStage, isLeagueOnly, spoilerLock, spoilerWaiting, playerStanding, playerTeam,
    qualifies, playerPosition, groupQualified, directQual, playoffQual, playerGroupLabel,
    directTeams, qualifiedTeams, activeTab, setActiveTab, hasLeagueClassification, leagueRound,
  } = hub;
  const previousTab = useRef<typeof activeTab>('fixtures');

  const handleMissionShortcut = () => {
    if (activeTab === 'missions') {
      setActiveTab(previousTab.current);
      return;
    }

    previousTab.current = activeTab;
    setActiveTab('missions');
  };

  return (
    <>
        {/* Player summary card — league standing only (irrelevant in the knockout) */}
        {/* ONLINE anti-spoiler: while others are still watching, hide the position/qualification. */}
        {!isKnockout && spoilerLock && (
          <div className="mb-3">
            <SpoilerLock waiting={spoilerWaiting} label="POSIÇÃO E CLASSIFICAÇÃO OCULTAS" />
          </div>
        )}
        {!isKnockout && !spoilerLock && playerStanding && (
          <div
            className="ui-panel mb-3 p-4"
            style={{
              background: `linear-gradient(135deg, ${qualifies ? 'var(--ui-success-soft)' : 'var(--ui-danger-soft)'}, var(--ui-surface-1) 70%)`,
              borderColor: qualifies ? 'var(--ui-success-line)' : 'var(--ui-danger-line)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 text-3xl font-black" style={{
                fontFamily: 'var(--font-display), sans-serif',
                color: qualifies ? 'var(--ui-success)' : 'var(--ui-danger)',
              }}>
                {playerPosition}º
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Crest crestId={playerTeam?.crestId} name={playerTeam?.name} size={34} />
                <div className="min-w-0 truncate font-display text-title uppercase leading-none tracking-caps text-[var(--ui-text)]">
                  {playerTeam?.name}
                </div>
              </div>
              <div className="ml-auto grid flex-shrink-0 grid-cols-4 gap-2 text-center sm:gap-4">
                {[
                  { label: 'PTS', value: playerStanding.points },
                  { label: 'V', value: playerStanding.won },
                  { label: 'E', value: playerStanding.drawn },
                  { label: 'D', value: playerStanding.lost },
                ].map(stat => (
                  <div key={stat.label}>
                    <div className="text-lg sm:text-xl font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>
                      {stat.value}
                    </div>
                    <div className="text-caption font-bold tracking-caps text-[var(--ui-text-muted)]">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--ui-line-subtle)] pt-2.5 text-body-sm font-semibold" style={{
              color: (isLeagueOnly || groupQualified || directQual) ? 'var(--ui-success)' : playoffQual ? 'var(--ui-info)' : 'var(--ui-danger)',
            }}>
              {(isLeagueOnly || groupQualified || directQual || playoffQual) ? <CircleCheck size={15} aria-hidden="true" /> : <CircleX size={15} aria-hidden="true" />}
              {isLeagueOnly
                ? 'Competição decidida pela tabela'
                : isGroupStage
                  ? groupQualified ? `Classificado pelo grupo ${playerGroupLabel ?? ''}` : 'Fora da zona de classificação do grupo'
                : directQual
                ? `Classificação direta às oitavas (top ${directTeams})`
                : playoffQual
                  ? `Zona de playoff (${directTeams + 1}º a ${qualifiedTeams}º)`
                  : `Fora da zona de classificação (top ${qualifiedTeams})`}
            </div>
          </div>
        )}

        <MissionQuickSummary
          isOpen={activeTab === 'missions'}
          onOpen={handleMissionShortcut}
        />

        {/* Tabs — scrollable on mobile */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        >
          <TabList className="mb-4">
            {(isKnockout
            ? [
                { id: 'fixtures', label: 'CONFRONTOS' },
                ...(hasLeagueClassification
                  ? [{ id: 'standings', label: 'CLASSIFICAÇÃO' }]
                  : [{ id: 'bracket', label: 'CHAVEAMENTO' }]),
                { id: 'scorers', label: 'ESTATÍSTICAS' },
                { id: 'squad', label: 'MEU CLUBE' },
                { id: 'results', label: 'HISTÓRICO' },
                { id: 'shop', label: 'LOJA' },
                { id: 'market', label: 'MERCADO' },
              ]
            : [
                { id: 'fixtures', label: `RODADA ${leagueRound}` },
                { id: 'standings', label: 'CLASSIFICAÇÃO' },
                { id: 'scorers', label: 'ESTATÍSTICAS' },
                { id: 'squad', label: 'MEU CLUBE' },
                { id: 'results', label: 'HISTÓRICO' },
                { id: 'shop', label: 'LOJA' },
                { id: 'market', label: 'MERCADO' },
              ]
          ).map(tab => (
            <Tab
              key={tab.id}
              value={tab.id}
            >
              {tab.label}
            </Tab>
          ))}
          </TabList>
        </Tabs>
    </>
  );
}
