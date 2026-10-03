import Crest from '../../components/game/Crest';
import SpoilerLock from './SpoilerLock';
import type { LeagueHub } from './useLeagueHub';

/** placement "aside": the desktop side column, visible whatever tab is open (league phase only). */
export default function StandingsTab({ hub, placement = 'tab' }: { hub: LeagueHub; placement?: 'tab' | 'aside' }) {
  const {
    state, showingLeagueClassification, isKnockout, spoilerLock, spoilerWaiting, hasGroupStage,
    playerGroupLabel, groupTables, playerGroup, playerTeam, allTeams, leagueStandings,
    isLeagueOnly, isGroupStage, directTeams, playoffTeams, qualifiedTeams, groupQualifiedIds,
    hasLeagueClassification,
  } = hub;
  const visible = placement === 'aside' ? hasLeagueClassification && !isKnockout : showingLeagueClassification;
  return (
    <>
        {/* League/group classification remains available as a historical view during knockout. */}
        {visible && !isKnockout && spoilerLock && (
          <SpoilerLock waiting={spoilerWaiting} label="CLASSIFICAÇÃO OCULTA" />
        )}
        {visible && (isKnockout || !spoilerLock) && (
          <div
            className="rounded-xl overflow-hidden overflow-x-auto"
            style={{ border: '1px solid var(--ui-surface-3)' }}
          >
            {hasGroupStage ? (
              <div className="space-y-3 p-3 sm:p-4">
                <div className="flex items-end justify-between gap-3 px-1">
                  <div>
                    <div className="text-[12px] font-black tracking-widest" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>
                      CLASSIFICAÇÃO POR GRUPO
                    </div>
                    <div className="mt-1 text-xs" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                      Os {state.competitionFormat.qualifiedPerGroup} primeiros de cada grupo avançam.
                    </div>
                  </div>
                  {playerGroupLabel && (
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-black tracking-wider" style={{ background: '#C9A84C1A', color: 'var(--ui-brand-strong)', fontFamily: 'var(--font-game), sans-serif' }}>
                      SEU GRUPO: {playerGroupLabel}
                    </span>
                  )}
                </div>

                <div className={placement === 'aside' ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-3 lg:grid-cols-2'}>
                  {groupTables.map(group => {
                    const groupLabel = String.fromCharCode(65 + group.groupId);
                    return (
                      <div key={group.groupId} className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--ui-surface-3)', background: '#0A0A14' }}>
                        <div className="flex items-center justify-between border-b px-3 py-2.5 sm:px-4" style={{ borderColor: 'var(--ui-surface-3)', background: 'var(--ui-surface-1)' }}>
                          <span className="text-sm font-black tracking-widest" style={{ color: group.groupId === playerGroup?.groupId ? 'var(--ui-brand-strong)' : '#FFFFFF', fontFamily: 'var(--font-game), sans-serif' }}>
                            GRUPO {groupLabel}
                          </span>
                          <span className="text-[12px] font-bold" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                            {state.competitionFormat.qualifiedPerGroup} avançam
                          </span>
                        </div>
                        <div className="grid gap-0 px-3 py-2 sm:px-4" style={{ gridTemplateColumns: '1.5rem 1fr 1.8rem 1.8rem 1.8rem 1.8rem 2.4rem 1.8rem 2.4rem', borderBottom: '1px solid var(--ui-surface-3)' }}>
                          {['#', 'Time', 'J', 'V', 'E', 'D', 'GP', 'GC', 'PTS'].map(h => (
                            <div key={`${group.groupId}-${h}`} className="text-center text-[12px] font-bold" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                              {h}
                            </div>
                          ))}
                        </div>
                        {group.entries.map((entry, i) => {
                          const isPlayer = entry.teamId === playerTeam?.id;
                          const isQualified = i < state.competitionFormat.qualifiedPerGroup;
                          return (
                            <div
                              key={entry.teamId}
                              className="grid items-center gap-0 px-3 py-2 sm:px-4 sm:py-2.5"
                              style={{
                                gridTemplateColumns: '1.5rem 1fr 1.8rem 1.8rem 1.8rem 1.8rem 2.4rem 1.8rem 2.4rem',
                                background: isPlayer ? 'var(--ui-surface-2)' : i % 2 === 0 ? '#0A0A14' : 'var(--ui-bg)',
                                borderBottom: '1px solid var(--ui-surface-3)',
                                borderLeft: isPlayer ? '3px solid var(--ui-brand)' : '3px solid transparent',
                              }}
                            >
                              <div className="text-center">
                                <span className="text-xs font-bold sm:text-sm" style={{ fontFamily: 'var(--font-display), sans-serif', color: i === 0 ? 'var(--ui-brand)' : isQualified ? 'var(--ui-success)' : 'var(--ui-danger)' }}>
                                  {i + 1}
                                </span>
                              </div>
                              <div className="flex min-w-0 items-center gap-1.5">
                                <div className="h-1 w-1 shrink-0 rounded-full sm:h-1.5 sm:w-1.5" style={{ background: isQualified ? 'var(--ui-success)' : 'var(--ui-danger)' }} />
                                <Crest crestId={allTeams.find(t => t.id === entry.teamId)?.crestId} name={entry.teamName} size={18} />
                                <span className="truncate text-xs font-semibold sm:text-sm" style={{ fontFamily: 'var(--font-game), sans-serif', color: isPlayer ? 'var(--ui-brand)' : '#FFFFFF', fontWeight: isPlayer ? 'bold' : 'normal' }}>
                                  {entry.teamName}
                                </span>
                              </div>
                              {[entry.played, entry.won, entry.drawn, entry.lost, entry.goalsFor, entry.goalsAgainst].map((val, vi) => (
                                <div key={vi} className="text-center text-[12px] sm:text-xs" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                                  {val}
                                </div>
                              ))}
                              <div className="text-center text-xs font-black sm:text-sm" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>
                                {entry.points}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
            <div style={{ minWidth: '360px' }}>
            {/* Table header */}
            <div className="grid gap-0 px-3 sm:px-4 py-2"
              style={{
                gridTemplateColumns: '1.5rem 1fr 1.8rem 1.8rem 1.8rem 1.8rem 2.4rem 1.8rem 2.4rem',
                background: 'var(--ui-surface-1)',
                borderBottom: '1px solid var(--ui-surface-3)',
              }}>
              {['#', 'Time', 'J', 'V', 'E', 'D', 'GP', 'GC', 'PTS'].map(h => (
                <div key={h} className="text-[12px] sm:text-xs font-bold text-center"
                  style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                  {h}
                </div>
              ))}
            </div>

            {leagueStandings.map((entry, i) => {
              const isPlayer = entry.teamId === playerTeam?.id;
              const isDirectQual = !isLeagueOnly && !isGroupStage && i < directTeams;
              const isPlayoff = !isLeagueOnly && playoffTeams > 0 && i >= directTeams && i < qualifiedTeams;
              const isGroupQual = isGroupStage && groupQualifiedIds.has(entry.teamId);
              const isEliminated = !isLeagueOnly && (isGroupStage ? !isGroupQual : i >= qualifiedTeams);

              return (
                <div
                  key={entry.teamId}
                  className="grid gap-0 px-3 sm:px-4 py-2 sm:py-2.5 items-center"
                  style={{
                    gridTemplateColumns: '1.5rem 1fr 1.8rem 1.8rem 1.8rem 1.8rem 2.4rem 1.8rem 2.4rem',
                    background: isPlayer
                      ? 'var(--ui-surface-2)'
                      : i % 2 === 0 ? '#0A0A14' : 'var(--ui-bg)',
                    borderBottom: '1px solid var(--ui-surface-3)',
                    borderLeft: isPlayer ? '3px solid var(--ui-brand)' : '3px solid transparent',
                  }}
                >
                  <div className="text-center">
                    <span className="text-xs sm:text-sm font-bold"
                      style={{
                        fontFamily: 'var(--font-display), sans-serif',
                        color: i === 0 ? 'var(--ui-brand)' : isGroupQual || isDirectQual ? 'var(--ui-success)' : isPlayoff ? '#3B82F6' : isEliminated ? 'var(--ui-danger)' : '#8A8A9A',
                      }}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isDirectQual && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ui-success)' }} />}
                    {isGroupQual && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ui-success)' }} />}
                    {isPlayoff && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: '#3B82F6' }} />}
                    {isEliminated && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ui-danger)' }} />}
                    <Crest crestId={allTeams.find(t => t.id === entry.teamId)?.crestId} name={entry.teamName} size={18} />
                    <span className="text-xs sm:text-sm font-semibold truncate"
                      style={{
                        fontFamily: 'var(--font-game), sans-serif',
                        color: isPlayer ? 'var(--ui-brand)' : '#FFFFFF',
                        fontWeight: isPlayer ? 'bold' : 'normal',
                      }}>
                      {entry.teamName}
                    </span>
                  </div>
                  {[entry.played, entry.won, entry.drawn, entry.lost, entry.goalsFor, entry.goalsAgainst].map((val, vi) => (
                    <div key={vi} className="text-center text-[12px] sm:text-xs"
                      style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                      {val}
                    </div>
                  ))}
                  <div className="text-center text-xs sm:text-sm font-black"
                    style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand)' }}>
                    {entry.points}
                  </div>
                </div>
              );
            })}
            </div>
            )}
          </div>
        )}
    </>
  );
}
