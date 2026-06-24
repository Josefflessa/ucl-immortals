import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { FORMATIONS, HISTORICAL_TRIOS, getRarityColor, POS_PT } from '../../lib/gameData';
import { calculateChemistry, getPlayerEffectiveStats, getCoachModifiersForPlayer } from '../../lib/gameEngine';
import FormationField from './FormationField';
import PlayerCard, { buildSofifaUrl } from './PlayerCard';
import RolesSelector from './RolesSelector';
import TacticSelector from './TacticSelector';
import ChemistryBonusInfo from './ChemistryBonusInfo';
import BuffBreakdown from './BuffBreakdown';

export default function LeagueSquadTab() {
  const { state, dispatch, setMatchRolesOnline } = useGame();
  const team = state.playerTeam;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!team) return null;

  const handleSetCaptain = (id: string) => {
    if (state.mode === 'online') setMatchRolesOnline(id, team.penaltyTaker ?? null);
    else dispatch({ type: 'SET_PLAYER_TEAM_CAPTAIN', playerId: id });
  };
  const handleSetPenaltyTaker = (id: string) => {
    if (state.mode === 'online') setMatchRolesOnline(team.captain ?? null, id);
    else dispatch({ type: 'SET_PLAYER_TEAM_PENALTY_TAKER', playerId: id });
  };

  const formation = FORMATIONS.find(f => f.id === team.formationId);
  // The XI is always the first 11; anything beyond is the bench (reinforcements).
  const xi = team.players.slice(0, 11);
  const bench = team.players.slice(11);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const chemData = calculateChemistry(xi, team.coachId, formationRoles);

  const chemColor = chemData.total >= 90 ? '#22C55E' : chemData.total >= 60 ? '#EAB308' : chemData.total >= 30 ? '#F97316' : '#EF4444';
  const activeTrios = chemData.trios.map(id => HISTORICAL_TRIOS.find(t => t.id === id)).filter(Boolean);

  // Team overall = avg EFFECTIVE overall of the 11 starters (mirrors the post-draft
  // screen), so it reflects chemistry, coach, traits and tactic — not just base.
  const teamOverall = xi.length === 11
    ? Math.round(xi.reduce((sum, p) => {
        const eff = getPlayerEffectiveStats(
          p,
          chemData.individual[p.id] ?? 0,
          chemData.outOfPosition[p.id] ?? false,
          team.coachId,
          chemData.total,
          team.playStyle,
        );
        return sum + eff.overall;
      }, 0) / 11)
    : null;

  const getChemPreview = (candidateIdx: number) => {
    if (selectedIndex === null) return { total: chemData.total, diff: 0 };
    const temp = [...team.players];
    const swap = temp[selectedIndex];
    temp[selectedIndex] = temp[candidateIdx];
    temp[candidateIdx] = swap;
    const preview = calculateChemistry(temp.slice(0, 11), team.coachId, formationRoles);
    return { total: preview.total, diff: preview.total - chemData.total };
  };

  const selectedPlayer = selectedIndex !== null ? team.players[selectedIndex] : null;
  const selectedChemScore = selectedPlayer ? (chemData.individual[selectedPlayer.id] ?? 0) : 0;
  const selectedIsOOP = selectedPlayer ? (chemData.outOfPosition[selectedPlayer.id] ?? false) : false;

  const getPlayerPhotoUrl = (playerId: string) => buildSofifaUrl(playerId, 120);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Team overall + chemistry summary */}
      <div className="rounded-xl p-4" style={{ background: '#0F0F1A', border: `1px solid ${chemColor}44` }}>
        {teamOverall !== null && (
          <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: '#1A1A2A' }}>
            <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
              OVERALL DO TIME
            </span>
            <span className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>
              {teamOverall}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
            QUÍMICA DO TIME
          </span>
          <span className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: chemColor }}>
            {chemData.total}
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ background: '#1A1A2A' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${chemData.total}%`, background: chemColor }} />
        </div>
        {activeTrios.length > 0 && (
          <div className="mt-3 text-xs" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
            ⭐ {activeTrios.map(t => t?.name).join(' · ')}
          </div>
        )}
        <ChemistryBonusInfo total={chemData.total} />
      </div>

      {/* Tactic / play style — changeable between matches (solo and online) */}
      <TacticSelector
        value={team.playStyle}
        onChange={(id) => {
          if (state.mode === 'online') setMatchRolesOnline(team.captain ?? null, team.penaltyTaker ?? null, id);
          else dispatch({ type: 'SET_PLAYER_TEAM_PLAY_STYLE', playStyle: id });
        }}
      />

      {/* Captain & penalty taker */}
      <RolesSelector
        players={xi}
        captainId={team.captain}
        penaltyTakerId={team.penaltyTaker}
        onSetCaptain={handleSetCaptain}
        onSetPenaltyTaker={handleSetPenaltyTaker}
      />

      <p className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
        Clique em um jogador para trocar posições e ver buffs ativos do treinador.
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {formation && (
          <div className="lg:w-[380px] flex-shrink-0">
            <FormationField
              formation={formation}
              players={xi}
              chemistryScores={chemData.individual}
              showChemLines
              selectedPlayerIndex={selectedIndex}
              onPlayerClick={(_player, posIndex) => setSelectedIndex(posIndex)}
            />
          </div>
        )}
        <div className="flex-1">
          <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>
            TITULARES
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {xi.map((player, index) => (
              <PlayerCard
                key={player.id}
                player={player}
                chemScore={chemData.individual[player.id]}
                showChemistry
                compact
                selected={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>

          {/* Bench / reinforcements — click a player, then "TROCAR COM" a starter */}
          {bench.length > 0 && (
            <>
              <div className="text-xs font-bold tracking-widest mb-3 flex items-center gap-2" style={{ color: '#818CF8', fontFamily: 'Rajdhani, sans-serif' }}>
                BANCO / RESERVAS ({bench.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {bench.map((player, i) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    compact
                    selected={selectedIndex === 11 + i}
                    onClick={() => setSelectedIndex(11 + i)}
                  />
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                Clique num reserva e escolha "Trocar com" um titular para substituir.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Premium Player Modal */}
      <AnimatePresence>
        {selectedIndex !== null && selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-[#0b0b14] border border-[#1d1d2f] rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b px-6 pt-5 pb-4" style={{ borderColor: '#1d1d2f' }}>
                <div>
                  <h3 className="text-xl font-black text-white tracking-widest uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    GERENCIAR POSIÇÃO
                  </h3>
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Trocar posição de <span className="font-extrabold text-[#C9A84C]">{selectedPlayer.shortName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="text-gray-400 hover:text-white text-2xl font-black focus:outline-none"
                >✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Selected Player Detail Card */}
                {(() => {
                  const eff = getPlayerEffectiveStats(
                    selectedPlayer,
                    selectedChemScore,
                    selectedIsOOP,
                    team.coachId,
                    chemData.total,
                    team.playStyle,
                  );
                  const isStarter = selectedIndex < 11;
                  const posIdx = isStarter ? selectedIndex : -1;
                  const formationRole = isStarter ? (formationRoles[posIdx] ?? selectedPlayer.position) : selectedPlayer.position;
                  const photoUrl = getPlayerPhotoUrl(selectedPlayer.id);
                  const chemDots = [0, 1, 2].map(i => i < eff.chemScore);
                  const statRows = [
                    { label: 'RIT', base: selectedPlayer.pace,      eff: eff.pace },
                    { label: 'FIN', base: selectedPlayer.shooting,  eff: eff.shooting },
                    { label: 'PAS', base: selectedPlayer.passing,   eff: eff.passing },
                    { label: 'DRI', base: selectedPlayer.dribbling, eff: eff.dribbling },
                    { label: 'DEF', base: selectedPlayer.defending, eff: eff.defending },
                    { label: 'FIS', base: selectedPlayer.physical,  eff: eff.physical },
                  ];

                  return (
                    <div className="rounded-xl overflow-hidden" style={{ background: '#07070f', border: `1px solid ${getRarityColor(selectedPlayer.rarity)}22` }}>
                      {/* Player header */}
                      <div className="flex items-center gap-4 p-4">
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#10101d', border: `2px solid ${getRarityColor(selectedPlayer.rarity)}` }}>
                          {photoUrl
                            ? <img src={photoUrl} alt={selectedPlayer.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
                            : <span className="text-2xl" style={{ color: getRarityColor(selectedPlayer.rarity) }}>⚽</span>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ background: '#1c1c2e', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                              {POS_PT[formationRole] ?? formationRole}
                            </span>
                            {selectedIsOOP && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444', fontFamily: 'Rajdhani, sans-serif' }}>
                                ⚠️ FORA DE POSIÇÃO
                              </span>
                            )}
                          </div>
                          <div className="text-xl font-black uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{selectedPlayer.shortName}</div>
                          <div className="text-xs text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{selectedPlayer.club} · {selectedPlayer.nation}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{eff.overall}</div>
                          {eff.overallMod > 0 && <div className="text-xs font-bold" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>(+{eff.overallMod})</div>}
                          <div className="text-[9px] text-gray-500 mt-0.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>GERAL EFETIVO</div>
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-6 border-t" style={{ borderColor: '#161626' }}>
                        {statRows.map(({ label, base, eff: effVal }) => {
                          const delta = effVal - base;
                          const statColor = delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : '#E8D080';
                          return (
                            <div key={label} className="flex flex-col items-center py-3 border-r last:border-r-0" style={{ borderColor: '#161626' }}>
                              <span className="text-[8px] font-bold text-gray-600 tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
                              <span className="text-base font-black" style={{ fontFamily: 'Rajdhani, sans-serif', color: statColor }}>{effVal}</span>
                              {delta !== 0 && <span className="text-[8px] font-bold" style={{ color: statColor, fontFamily: 'Rajdhani, sans-serif' }}>{delta > 0 ? '+' : ''}{delta}</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Chemistry dots */}
                      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#161626' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-500 font-bold tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA INDIVIDUAL</span>
                          <div className="flex gap-1">
                            {chemDots.map((filled, i) => (
                              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: filled ? '#22C55E' : '#1a1a2e', boxShadow: filled ? '0 0 5px #22C55E' : 'none', border: '1px solid rgba(255,255,255,.1)' }} />
                            ))}
                          </div>
                        </div>
                        <div className="text-[9px] text-gray-500 font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                          Pos. nativa: <span className="text-white">{POS_PT[selectedPlayer.position] ?? selectedPlayer.position}</span>
                        </div>
                      </div>

                      {/* Active Coach Buffs */}
                      {eff.activeCoachEffects.length > 0 && (
                        <div className="px-4 py-3 border-t" style={{ borderColor: '#161626', background: '#09090f' }}>
                          <div className="text-[9px] font-black text-yellow-400 tracking-widest mb-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                            ⚡ BÔNUS ATIVO DO TREINADOR
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {eff.activeCoachEffects.map((effect, ei) => (
                              <span
                                key={ei}
                                className="text-[9px] font-black px-2 py-0.5 rounded"
                                style={{ background: '#C9A84C22', color: '#E8C84A', border: '1px solid #C9A84C44', fontFamily: 'Rajdhani, sans-serif' }}
                              >
                                {effect}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Per-source buff breakdown — what's lifting each stat */}
                      <BuffBreakdown eff={eff} />
                    </div>
                  );
                })()}

                {/* Swap candidates list */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#8A8A9A] tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    TROCAR COM:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {team.players.map((candidate, idx) => {
                      if (idx === selectedIndex) return null;
                      const preview = getChemPreview(idx);
                      const isStarter = idx < 11;
                      const diffColor = preview.diff > 0 ? '#22C55E' : preview.diff < 0 ? '#EF4444' : '#8A8A9A';
                      const diffLabel = preview.diff > 0 ? `+${preview.diff}` : `${preview.diff}`;
                      const photoUrl = getPlayerPhotoUrl(candidate.id);
                      const candidateMods = getCoachModifiersForPlayer(candidate, team.coachId);
                      const hasBuffs = candidateMods.activeEffects.length > 0;

                      return (
                        <div
                          key={candidate.id}
                          onClick={() => {
                            dispatch({ type: 'SWAP_PLAYER_TEAM', indexA: selectedIndex!, indexB: idx });
                            setSelectedIndex(null);
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-[#161626] hover:border-[#C9A84C]/50 active:scale-[0.98] transition-all"
                          style={{ background: '#07070f' }}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]" style={{ border: `1.5px solid ${getRarityColor(candidate.rarity)}` }}>
                            {photoUrl
                              ? <img src={photoUrl} alt={candidate.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
                              : <span className="text-sm font-bold" style={{ color: getRarityColor(candidate.rarity) }}>⚽</span>}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: '#222', fontFamily: 'Rajdhani, sans-serif' }}>
                                {POS_PT[candidate.position] ?? candidate.position}
                              </span>
                              <span className="text-[9px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                                GER: {candidate.overall}
                              </span>
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: isStarter ? '#22C55E22' : '#3B82F622', color: isStarter ? '#22C55E' : '#3B82F6', fontFamily: 'Rajdhani, sans-serif' }}>
                                POS. {idx + 1}
                              </span>
                              {hasBuffs && (
                                <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ background: '#C9A84C22', color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>
                                  ⚡ BUFF
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-black text-white truncate mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              {candidate.shortName.toUpperCase()}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-[9px] text-gray-500 font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA</div>
                            <div className="text-xs font-black" style={{ color: diffColor, fontFamily: 'Rajdhani, sans-serif' }}>
                              {preview.total} <span className="text-[10px] font-bold">({diffLabel})</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end px-6 py-4 border-t" style={{ borderColor: '#1d1d2f' }}>
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="px-5 py-2.5 rounded-lg text-sm font-black text-white hover:bg-white/5 transition-colors focus:outline-none"
                  style={{ fontFamily: 'Rajdhani, sans-serif', border: '1px solid #1d1d2f' }}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
