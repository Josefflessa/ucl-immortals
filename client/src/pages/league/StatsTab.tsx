import { Goal, Footprints, Star, Hand, Swords, AlertTriangle } from 'lucide-react';
import PlayerAvatar from '../../components/game/PlayerAvatar';
import { POS_PT } from '@shared/game/gameData';
import { Tab, TabList, Tabs } from '../../design-system';
import SpoilerLock from './SpoilerLock';
import type { LeagueHub } from './useLeagueHub';

export default function StatsTab({ hub }: { hub: LeagueHub }) {
  const {
    activeTab, spoilerLock, spoilerWaiting, statsSubTab, setStatsSubTab, playerTeam,
    topScorers, topAssists, topRatings, topKeepers, topTacklers, topCards,
  } = hub;
  return (
    <>
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
                    className="text-[12px] sm:text-xs"
                  >
                    <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {label}</span>
                  </Tab>
                );
              })}
              </TabList>
            </Tabs>

            {/* List panel */}
            <div key={statsSubTab} className="rounded-xl overflow-hidden border border-[#1A1A2A]" style={{ background: 'var(--ui-surface-1)' }}>
              {/* Header label */}
              <div className="px-4 py-3 border-b border-[#1A1A2A] bg-[#0A0A12] flex justify-between items-center">
                <span className="text-[12px] font-black tracking-widest text-[#6A6A7A]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  {statsSubTab === 'goals' && 'ARTILHARIA DO CAMPEONATO'}
                  {statsSubTab === 'assists' && 'LÍDERES EM ASSISTÊNCIAS'}
                  {statsSubTab === 'ratings' && 'MELHORES NOTAS DA TEMPORADA (MÍN. 1 JOGO)'}
                  {statsSubTab === 'keepers' && 'GOLEIROS COM MAIS DEFESAS REALIZADAS'}
                  {statsSubTab === 'tackles' && 'LÍDERES EM DESARMES DO CAMPEONATO'}
                  {statsSubTab === 'cards' && 'DISCIPLINA — MAIS CARTÕES DA TEMPORADA'}
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
                    <div className="py-12 text-center text-xs text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      Nenhum registro encontrado para esta categoria ainda. Avance rodadas para computar estatísticas!
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-[#1A1A2A] lg:columns-2 lg:gap-0">
                    {/* Desktop: two columns, read top to bottom (1–8 left, 9–15 right). */}
                    {currentList.slice(0, 15).map((player, i) => {
                      const isPlayerTeam = player.teamId === playerTeam?.id;

                      // Resolve metric values
                      let metricVal: string | number = 0;
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
                        metricVal = `${player.stats.yellowCards}🟨${player.stats.redCards > 0 ? ` ${player.stats.redCards}🟥` : ''}`;
                        metricLabel = 'cartões';
                      }

                      return (
                        <div
                          key={`${statsSubTab}-${player.id}`}
                          className="flex items-center gap-4 px-4 py-3 break-inside-avoid"
                          style={{
                            background: isPlayerTeam ? 'var(--ui-surface-2)' : i % 2 === 0 ? '#0A0A14' : 'var(--ui-bg)',
                          }}
                        >
                          {/* Rank number */}
                          <span className="w-6 text-center font-black text-sm" style={{
                            fontFamily: 'var(--font-display), sans-serif',
                            color: i === 0 ? 'var(--ui-brand)' : i === 1 ? '#D1D5DB' : i === 2 ? '#B45309' : '#4B5563',
                          }}>
                            {i + 1}
                          </span>

                          {/* Player face avatar (robust fallback) */}
                          <PlayerAvatar playerId={player.id} photoUrl={player.photoUrl} rarity={player.rarity} size={40} />

                          {/* Player details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-black px-1.5 py-0.2 rounded text-white" style={{ background: '#222', fontFamily: 'var(--font-game), sans-serif' }}>
                                {POS_PT[player.position] ?? player.position}
                              </span>
                            </div>
                            <div className="text-sm font-black text-white truncate" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                              {player.shortName}
                            </div>
                            <div className="text-[12px] text-[#6A6A7A] font-semibold truncate" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                              {player.teamName} · <span className="text-[#8A8A9A]">{player.stats.played} {player.stats.played === 1 ? 'jogo' : 'jogos'}</span>
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
                            <div className="text-[12px] font-black text-gray-500 tracking-wider uppercase" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
          </div>
        )}
    </>
  );
}
