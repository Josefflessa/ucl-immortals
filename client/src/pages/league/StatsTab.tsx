import { Goal, Footprints, Star, Hand, Swords, AlertTriangle, UsersRound } from 'lucide-react';
import PlayerAvatar from '../../components/game/PlayerAvatar';
import { POS_PT } from '@shared/game/gameData';
import { Tab, TabList, Tabs } from '../../design-system';
import SpoilerLock from './SpoilerLock';
import type { LeagueHub } from './useLeagueHub';
import { CardIcon } from '../../components/game/StatusIcon';
import type { ReactNode } from 'react';
import PlayerSeasonStatsPanel from '../../components/game/PlayerSeasonStatsPanel';

export default function StatsTab({ hub }: { hub: LeagueHub }) {
  const {
    activeTab, spoilerLock, spoilerWaiting, statsSubTab, setStatsSubTab, playerTeam, allTeams,
    topScorers, topAssists, topRatings, topKeepers, topTacklers, topCards, myPlayerStats,
  } = hub;
  return (
    <div className="competition-live-reading">
        {/* Estatísticas da Temporada */}
        {activeTab === 'scorers' && spoilerLock && (
          <SpoilerLock waiting={spoilerWaiting} label="ESTATÍSTICAS OCULTAS" />
        )}
        {activeTab === 'scorers' && !spoilerLock && (
          <div className="space-y-4">
            {/* Sub-tabs share the same editorial navigation grammar as the hub tabs. */}
            <Tabs
              value={statsSubTab}
              onValueChange={(value) => setStatsSubTab(value as typeof statsSubTab)}
            >
              <TabList>
              {[
                { id: 'squad', label: 'MEU ELENCO', Icon: UsersRound },
                { id: 'goals', label: 'GOLS', Icon: Goal },
                { id: 'assists', label: 'ASSISTÊNCIAS', Icon: Footprints },
                { id: 'ratings', label: 'NOTA MÉDIA', Icon: Star },
                { id: 'keepers', label: 'GOLEIROS', Icon: Hand },
                { id: 'tackles', label: 'DESARMES', Icon: Swords },
                { id: 'cards', label: 'DISCIPLINA', Icon: AlertTriangle },
              ].map(({ id, label, Icon }) => {
                return (
                  <Tab
                    key={id}
                    value={id}
                  >
                    <span className="inline-flex items-center gap-2"><Icon size={15} /> {label}</span>
                  </Tab>
                );
              })}
              </TabList>
            </Tabs>

            {statsSubTab === 'squad' ? (
              <PlayerSeasonStatsPanel
                rows={myPlayerStats}
                title="ESTATÍSTICAS DO MEU ELENCO"
                emptyMessage="Seu elenco ainda não tem estatísticas registradas. Elas aparecem depois das primeiras partidas."
              />
            ) : (
            <div key={statsSubTab} className="rounded-xl overflow-hidden border border-[var(--ui-surface-3)]" style={{ background: 'var(--ui-surface-1)' }}>
              {/* Header label */}
              <div className="px-5 py-4 border-b border-[var(--ui-surface-3)] bg-[var(--ui-bg-raised)] flex justify-between items-center">
                <span className="ui-section-label">
                  {statsSubTab === 'goals' && 'ARTILHARIA DO CAMPEONATO'}
                  {statsSubTab === 'assists' && 'LÍDERES EM ASSISTÊNCIAS'}
                  {statsSubTab === 'ratings' && 'MELHORES NOTAS DA COMPETIÇÃO (MÍN. 3 JOGOS)'}
                  {statsSubTab === 'keepers' && 'GOLEIROS COM MAIS DEFESAS REALIZADAS'}
                  {statsSubTab === 'tackles' && 'LÍDERES EM DESARMES DO CAMPEONATO'}
                  {statsSubTab === 'cards' && 'DISCIPLINA — MAIS CARTÕES DA COMPETIÇÃO'}
                </span>
              </div>

              {(() => {
                const getActiveList = () => {
                  if (statsSubTab === 'goals') return topScorers;
                  if (statsSubTab === 'assists') return topAssists;
                  if (statsSubTab === 'ratings') return topRatings;
                  if (statsSubTab === 'keepers') return topKeepers;
                  if (statsSubTab === 'cards') return topCards;
                  return topTacklers;
                };

                const currentList = getActiveList();

                if (currentList.length === 0) {
                  return (
                    <div className="py-12 px-5 text-center text-sm text-[var(--ui-text-muted)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      Nenhum registro encontrado para esta categoria ainda. Avance rodadas para computar estatísticas!
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[var(--ui-surface-3)] lg:columns-2 lg:gap-0">
                    {/* Desktop: two columns, read top to bottom (1–8 left, 9–15 right). */}
                    {currentList.slice(0, 15).map((player, i) => {
                      const isPlayerTeam = player.teamId === playerTeam?.id;
                      const displayTeamName = allTeams.find(team => team.id === player.teamId)?.name ?? player.teamName;

                      // Resolve metric values
                      let metricVal: ReactNode = 0;
                      let metricLabel = "";

                      if (statsSubTab === 'goals') {
                        metricVal = player.stats.goals;
                        metricLabel = metricVal === 1 ? 'gol' : 'gols';
                      } else if (statsSubTab === 'assists') {
                        metricVal = player.stats.assists;
                        metricLabel = metricVal === 1 ? 'assistência' : 'assistências';
                      } else if (statsSubTab === 'ratings') {
                        metricVal = player.stats.ratingAvg.toFixed(2);
                        metricLabel = 'nota média';
                      } else if (statsSubTab === 'keepers') {
                        metricVal = player.stats.saves;
                        metricLabel = metricVal === 1 ? 'defesa' : 'defesas';
                      } else if (statsSubTab === 'tackles') {
                        metricVal = player.stats.tackles;
                        metricLabel = metricVal === 1 ? 'desarme' : 'desarmes';
                      } else if (statsSubTab === 'cards') {
                        metricVal = <span className="inline-flex items-center gap-1">{player.stats.yellowCards}<CardIcon color="yellow" />{player.stats.redCards > 0 && <>{' '}{player.stats.redCards}<CardIcon color="red" /></>}</span>;
                        metricLabel = 'cartões';
                      }

                      return (
                        <div
                          key={`${statsSubTab}-${player.id}`}
                          className="flex items-center gap-2 px-3 py-3 break-inside-avoid sm:gap-4 sm:px-5 sm:py-4"
                          style={{
                            background: isPlayerTeam ? 'var(--ui-surface-2)' : i % 2 === 0 ? 'var(--ui-bg-raised)' : 'var(--ui-bg)',
                          }}
                        >
                          {/* Rank number */}
                          <span className="w-7 text-center font-black text-base" style={{
                            fontFamily: 'var(--font-display), sans-serif',
                            color: i === 0 ? 'var(--ui-brand)' : i === 1 ? '#D1D5DB' : i === 2 ? '#B45309' : 'var(--ui-text-faint)',
                          }}>
                            {i + 1}
                          </span>

                          {/* Player face avatar (robust fallback) */}
                          <PlayerAvatar playerId={player.id} photoUrl={player.photoUrl} rarity={player.rarity} size={40} />

                          {/* Player details */}
                          <div className="flex-1 min-w-0">
                            <div className="whitespace-normal break-words text-body font-black leading-tight text-white" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                              {player.shortName}
                            </div>
                            <div className="mt-1 min-w-0 space-y-1 text-label font-semibold text-[var(--ui-text-muted)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                              <div>
                                <span className="inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-black text-white" style={{ background: '#222' }}>
                                  {POS_PT[player.position] ?? player.position}
                                </span>
                              </div>
                              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                {displayTeamName && <>
                                  <span className="min-w-0 whitespace-normal break-words leading-tight">{displayTeamName}</span>
                                  <span className="shrink-0" aria-hidden="true">·</span>
                                </>}
                                <span className="shrink-0 text-[var(--ui-text-muted)]">{player.stats.played} {player.stats.played === 1 ? 'jogo' : 'jogos'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Metric value box */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-xl font-black" style={{
                              fontFamily: 'var(--font-display), sans-serif',
                              color: 'var(--ui-brand)'
                            }}>
                              {metricVal}
                            </div>
                            <div className="max-w-[88px] whitespace-normal break-words text-caption font-black uppercase leading-tight tracking-wide-caps text-[var(--ui-text-muted)] sm:max-w-none" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                              {metricLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            )}
          </div>
        )}
    </div>
  );
}
