import CompetitionExitControl from '../../components/game/CompetitionExitControl';
import CreditsWallet from '../../components/game/CreditsWallet';
import Crest from '../../components/game/Crest';
import { Tab, TabList, Tabs, TopBar } from '../../design-system';
import SpoilerLock from './SpoilerLock';
import type { LeagueHub } from './useLeagueHub';

const FIELD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-field-bg-TNi7gMGy2VJGpi28zWLUUX.webp';

export function HubHeader({ hub }: { hub: LeagueHub }) {
  const {
    state, isKnockout, isGroupStage, isLeagueOnly, playerStanding, qualifies, playerPosition,
    knockoutLabel, leagueRound, leagueRounds, qualifiedTeams,
  } = hub;
  return (
    <>
      <TopBar
        title={isKnockout ? 'MATA-MATA' : isGroupStage ? 'FASE DE GRUPOS' : 'FASE DE LIGA'}
        center={<CreditsWallet points={state.points} />}
        right={
          <div className="flex items-center gap-2 sm:gap-3">
              {!isKnockout && playerStanding && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--ui-text-faint)]">Posição:</span>
                <span className={`font-display text-xl ${qualifies ? 'text-[var(--ui-success)]' : 'text-[var(--ui-danger)]'}`}>{playerPosition}º</span>
              </div>
            )}
            <CompetitionExitControl />
          </div>
        }
      />

      {/* Hero banner */}
      <div className="relative h-20 sm:h-32 overflow-hidden">
        <div className="absolute inset-0"
          style={{
            backgroundImage: `url(${FIELD_BG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.3,
          }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, transparent, var(--ui-bg))',
        }} />
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-3xl sm:text-5xl font-black tracking-widest"
              style={{ fontFamily: 'var(--font-display), sans-serif', color: isKnockout ? 'var(--ui-brand)' : '#FFFFFF' }}>
              {isKnockout ? knockoutLabel : isGroupStage ? `FASE DE GRUPOS · RODADA ${leagueRound} DE ${leagueRounds}` : `RODADA ${leagueRound} DE ${leagueRounds}`}
            </h2>
            <p className="hidden sm:block" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif', fontSize: '13px' }}>
              {isKnockout ? 'Mata-mata — gerencie seu time entre os confrontos' : isLeagueOnly ? 'Dispute rodada por rodada e seja o campeão da tabela' : isGroupStage ? `Dispute seu grupo e fique entre os ${state.competitionFormat.qualifiedPerGroup} primeiros` : `Dispute rodada por rodada e termine entre os ${qualifiedTeams} melhores`}
            </p>
          </div>
        </div>
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
  return (
    <>
        {/* Player summary card — league standing only (irrelevant in the knockout) */}
        {/* ONLINE anti-spoiler: while others are still watching, hide the position/qualification. */}
        {!isKnockout && spoilerLock && (
          <div className="mb-6">
            <SpoilerLock waiting={spoilerWaiting} label="POSIÇÃO E CLASSIFICAÇÃO OCULTAS" />
          </div>
        )}
        {!isKnockout && !spoilerLock && playerStanding && (
          <div
            className="rounded-xl p-4 mb-6"
            style={{
              background: qualifies
                ? 'linear-gradient(135deg, #0A2A0A, #0F0F1A)'
                : 'linear-gradient(135deg, #2A0A0A, #0F0F1A)',
              border: `1px solid ${qualifies ? '#22C55E44' : '#EF444444'}`,
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
                <div className="min-w-0 truncate text-lg font-black leading-none" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FFFFFF' }}>
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
                    <div className="text-xs" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 border-t border-white/[.05] pt-2 text-center text-xs" style={{
              color: (isLeagueOnly || groupQualified || directQual) ? 'var(--ui-success)' : playoffQual ? '#3B82F6' : 'var(--ui-danger)',
              fontFamily: 'var(--font-game), sans-serif',
            }}>
              {isLeagueOnly
                ? '✓ Competição decidida pela tabela'
                : isGroupStage
                  ? groupQualified ? `✓ Classificado pelo grupo ${playerGroupLabel ?? ''}` : '✗ Eliminado — fora da zona de classificação do grupo'
                : directQual
                ? `✓ Classificação direta às Oitavas (Top ${directTeams})`
                : playoffQual
                  ? `✓ Zona de Playoff (${directTeams + 1}º a ${qualifiedTeams}º)`
                  : `✗ Eliminado (fora do Top ${qualifiedTeams})`}
            </div>
          </div>
        )}

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
                { id: 'missions', label: 'MISSÕES' },
                { id: 'shop', label: 'LOJA' },
                { id: 'market', label: 'MERCADO' },
              ]
            : [
                { id: 'fixtures', label: `RODADA ${leagueRound}` },
                { id: 'standings', label: 'CLASSIFICAÇÃO' },
                { id: 'scorers', label: 'ESTATÍSTICAS' },
                { id: 'squad', label: 'MEU CLUBE' },
                { id: 'results', label: 'HISTÓRICO' },
                { id: 'missions', label: 'MISSÕES' },
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
