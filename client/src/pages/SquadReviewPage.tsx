// UCL Immortals — Squad Review Page
// Review squad, set captain, view chemistry

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { FORMATIONS, COACHES, HISTORICAL_TRIOS, getRarityColor, Player } from '../lib/gameData';
import { calculateChemistry, getPlayerEffectiveStats, isPlayerInPosition, getCoachModifiersForPlayer } from '../lib/gameEngine';
import FormationField from '../components/game/FormationField';
import PlayerCard, { SOFIFA_MAPPING } from '../components/game/PlayerCard';

const POS_PT: Record<string, string> = {
  GK: 'GL', CB: 'ZAG', LB: 'LE', RB: 'LD',
  LWB: 'AEL', RWB: 'AED', CDM: 'VOL', CM: 'MC',
  CAM: 'MEI', LM: 'ML', RM: 'MD',
  LW: 'ALE', RW: 'ALD', CF: 'SS', ST: 'CA',
};

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';

export default function SquadReviewPage() {
  const { state, dispatch, submitSquadReviewOnline } = useGame();
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number | null>(null);

  const me = state.mode === 'online' ? state.onlinePlayers.find(p => p.socketId === state.socketId) : null;
  const isReady = me?.ready || false;

  const handlePlayerClick = (index: number) => {
    setSelectedPlayerIndex(index);
  };
  const { draftedPlayers: rawDraftedPlayers, selectedFormationId, selectedCoachId } = state;
  const draftedPlayers = rawDraftedPlayers as Player[];

  const formation = FORMATIONS.find(f => f.id === selectedFormationId);
  const coach = COACHES.find(c => c.id === selectedCoachId);

  const starters = draftedPlayers.slice(0, 11);

  // Build formation roles list (first 11 slots)
  const formationRoles = formation?.positions.map(p => p.role) ?? [];

  const chemData = calculateChemistry(starters, selectedCoachId, formationRoles);

  // Team overall = avg effective overall of all 11 starters
  const teamOverall = starters.length === 11
    ? Math.round(starters.reduce((sum, p, i) => {
        const eff = getPlayerEffectiveStats(
          p,
          chemData.individual[p.id] ?? 0,
          chemData.outOfPosition[p.id] ?? false,
          selectedCoachId,
          chemData.total,
        );
        return sum + eff.overall;
      }, 0) / 11)
    : null;

  const getChemPreview = (candidateIdx: number) => {
    if (selectedPlayerIndex === null) return { total: chemData.total, diff: 0 };
    const tempPlayers = [...draftedPlayers];
    const temp = tempPlayers[selectedPlayerIndex];
    tempPlayers[selectedPlayerIndex] = tempPlayers[candidateIdx];
    tempPlayers[candidateIdx] = temp;

    const newChemPreview = calculateChemistry(tempPlayers.slice(0, 11), selectedCoachId, formationRoles);
    const diff = newChemPreview.total - chemData.total;
    return { total: newChemPreview.total, diff };
  };

  const activeTrios = chemData.trios.map(trioId => HISTORICAL_TRIOS.find(t => t.id === trioId)).filter(Boolean);

  const chemColor = chemData.total >= 90 ? '#22C55E' : chemData.total >= 60 ? '#EAB308' : chemData.total >= 30 ? '#F97316' : '#EF4444';
  const chemLabel = chemData.total >= 90 ? 'PERFEITA' : chemData.total >= 60 ? 'EXCELENTE' : chemData.total >= 30 ? 'BOA' : 'BAIXA';

  const handleStart = () => {
    if (state.mode === 'online') {
      submitSquadReviewOnline(state.captain, state.penaltyTaker, state.draftedPlayers);
    } else {
      dispatch({ type: 'START_LEAGUE' });
    }
  };

  if (state.mode === 'online' && isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#080810' }}>
        <img src={LOGO_URL} alt="UCL Logo" className="w-16 h-16 object-contain mb-4 animate-pulse" />
        <div className="flex items-center gap-2 text-white font-bold text-lg" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-[#C9A84C] animate-spin" />
          AGUARDANDO DEMAIS JOGADORES CONFIRMAREM ESCALAÇÃO...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
        <span className="text-base sm:text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          REVISÃO DO ELENCO
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {teamOverall !== null && (
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-bold tracking-widest hidden sm:inline" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>OVERALL DO TIME</span>
              <span className="text-xl sm:text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>{teamOverall}</span>
            </div>
          )}
          <span className="text-xs hidden sm:inline" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
            Time: <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>{state.playerName}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 px-3 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Left: Formation + Chemistry */}
        <div className="flex flex-col gap-4 lg:w-[420px] flex-shrink-0">
          {/* Chemistry meter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4"
            style={{ background: '#0F0F1A', border: `1px solid ${chemColor}44` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-black tracking-widest"
                style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
                QUÍMICA DO TIME
              </div>
              <div className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: chemColor }}>
                {chemData.total}
              </div>
            </div>

            <div className="h-3 rounded-full mb-2" style={{ background: '#1A1A2A' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${chemData.total}%` }}
                transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: `linear-gradient(90deg, ${chemColor}88, ${chemColor})` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest" style={{ color: chemColor, fontFamily: 'Rajdhani, sans-serif' }}>
                {chemLabel}
              </span>
              <span className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                / 100
              </span>
            </div>
          </motion.div>

          {/* Active trios */}
          {activeTrios.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl p-4"
              style={{ background: '#14100A', border: '1px solid #C9A84C44' }}
            >
              <div className="text-xs font-black tracking-widest mb-3"
                style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                ⭐ PARCERIAS HISTÓRICAS ATIVAS
              </div>
              {activeTrios.map(trio => trio && (
                <div key={trio.id} className="mb-2">
                  <div className="text-sm font-bold" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>
                    {trio.name}
                  </div>
                  <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                    {trio.description}
                  </div>
                  <div className="text-xs font-bold mt-0.5" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                    +{trio.chemBonus} Química
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Formation field */}
          {formation && (
            <div>
              <div className="text-xs font-bold tracking-widest mb-2"
                style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                CAMPO
              </div>
              <FormationField
                formation={formation}
                players={starters}
                chemistryScores={chemData.individual}
                showChemLines
                selectedPlayerIndex={selectedPlayerIndex}
                onPlayerClick={(player, posIndex) => handlePlayerClick(posIndex)}
              />
            </div>
          )}
        </div>

        {/* Right: Squad list */}
        <div className="flex-1">
          {/* Swap instructions banner */}
          <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A', fontFamily: 'Rajdhani, sans-serif' }}>
            <span style={{ color: '#8A8A9A' }}>
              💡 <span style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Gerenciamento do Time:</span> Clique em qualquer jogador para trocar posições no campo e ver o impacto de química.
            </span>
          </div>

          {/* Starters */}
          <div className="mb-6">
            <div className="text-xs font-bold tracking-widest mb-3"
              style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>
              TITULARES ({starters.length}/11)
            </div>
            <div className="flex flex-wrap gap-3">
              {starters.map((player, index) => (
                <div key={player.id} className="relative">
                  <PlayerCard
                    player={player}
                    chemScore={chemData.individual[player.id]}
                    showChemistry
                    compact
                    selected={selectedPlayerIndex === index}
                    onClick={() => handlePlayerClick(index)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Coach summary */}
          {coach && (
            <div className="rounded-xl p-4 mb-6" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <div className="flex items-center gap-3">
                {coach.photoUrl ? (
                  <img
                    src={coach.photoUrl}
                    alt={coach.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    style={{ border: '1px solid #C9A84C44' }}
                  />
                ) : (
                  <div className="text-3xl">⚽</div>
                )}
                <div>
                  <div className="text-sm font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                    {coach.name.toUpperCase()}
                  </div>
                  <div className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                    {coach.effect}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Start competition */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            className="w-full py-5 rounded-xl font-black text-2xl tracking-widest"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
              color: '#080810',
              boxShadow: '0 0 40px rgba(201,168,76,0.4)',
            }}
          >
            🏆 INICIAR COMPETIÇÃO →
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {selectedPlayerIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-[#0b0b14] border border-[#1d1d2f] rounded-2xl p-6 max-w-2xl w-full flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: '#1d1d2f' }}>
                <div>
                  <h3 className="text-xl font-black text-white tracking-widest uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    SUBSTITUIÇÃO / SELEÇÃO
                  </h3>
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Substituir ou trocar a posição de <span className="font-extrabold text-[#C9A84C]">{draftedPlayers[selectedPlayerIndex].shortName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPlayerIndex(null)}
                  className="text-gray-400 hover:text-white text-2xl font-black focus:outline-none"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                {/* Current Player — Full Detail Card */}
                {(() => {
                  const player = draftedPlayers[selectedPlayerIndex];
                  const isStarter = selectedPlayerIndex < 11;
                  const posIdx = isStarter ? selectedPlayerIndex : -1;
                  const formationRole = isStarter ? (formationRoles[posIdx] ?? player.position) : player.position;
                  const chemScore = chemData.individual[player.id] ?? 0;
                  const isOOP = isStarter ? (chemData.outOfPosition[player.id] ?? false) : false;
                  const eff = getPlayerEffectiveStats(player, chemScore, isOOP, selectedCoachId, chemData.total);

                  const baseId = Object.keys(SOFIFA_MAPPING).find(key => player.id === key || player.id.startsWith(key + '_')) || player.id.split('_')[0];
                  const m = SOFIFA_MAPPING[baseId];
                  const photoUrl = m ? `https://cdn.sofifa.net/players/${String(m.id).padStart(6, '0').slice(0,3)}/${String(m.id).padStart(6, '0').slice(3,6)}/${m.ver}_120.png` : null;

                  const statRows = [
                    { label: 'RIT', base: player.pace,      eff: eff.pace },
                    { label: 'FIN', base: player.shooting,  eff: eff.shooting },
                    { label: 'PAS', base: player.passing,   eff: eff.passing },
                    { label: 'DRI', base: player.dribbling, eff: eff.dribbling },
                    { label: 'DEF', base: player.defending, eff: eff.defending },
                    { label: 'FIS', base: player.physical,  eff: eff.physical },
                  ];

                  const chemDots = [0, 1, 2].map(i => i < eff.chemScore);

                  return (
                    <div className="rounded-xl overflow-hidden" style={{ background: '#07070f', border: `1px solid ${getRarityColor(player.rarity)}22` }}>
                      {/* Top strip */}
                      <div className="flex items-center gap-4 p-4">
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#10101d', border: `2px solid ${getRarityColor(player.rarity)}` }}>
                          {photoUrl
                            ? <img src={photoUrl} alt={player.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
                            : <span className="text-2xl" style={{ color: getRarityColor(player.rarity) }}>⚽</span>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ background: '#1c1c2e', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                              {POS_PT[formationRole] ?? formationRole}
                            </span>
                            {isOOP && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444', fontFamily: 'Rajdhani, sans-serif' }}>
                                ⚠️ FORA DE POSIÇÃO
                              </span>
                            )}
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: isStarter ? '#22C55E22' : '#3B82F622', color: isStarter ? '#22C55E' : '#3B82F6', fontFamily: 'Rajdhani, sans-serif' }}>
                              POSIÇÃO {posIdx + 1}
                            </span>
                          </div>
                          <div className="text-xl font-black uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{player.shortName}</div>
                          <div className="text-xs text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{player.club} · {player.nation}</div>
                        </div>
                        {/* Overall block */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{eff.overall}</div>
                          {eff.overallMod > 0 && <div className="text-xs font-bold" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>(+{eff.overallMod} química/trein.)</div>}
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

                      {/* Chemistry + position-fit row */}
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
                          Pos. nativa: <span className="text-white">{POS_PT[player.position] ?? player.position}</span>
                          {player.secondaryPositions && player.secondaryPositions.length > 0 && (
                            <span className="text-gray-500"> · Alt: {player.secondaryPositions.map(p => POS_PT[p] ?? p).join(', ')}</span>
                          )}
                        </div>
                      </div>

                      {/* Active Coach Effects */}
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
                    </div>
                  );
                })()}

                {/* Candidate Selection List */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#8A8A9A] tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    ESCOLHA O JOGADOR PARA ENTRAR NO LUGAR:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {draftedPlayers.map((player, idx) => {
                      if (idx === selectedPlayerIndex) return null;
                      
                      const chemPreview = getChemPreview(idx);
                      const isStarter = idx < 11;
                      const posIdx = isStarter ? idx : -1;
                      const chemDiffColor = chemPreview.diff > 0 ? '#22C55E' : chemPreview.diff < 0 ? '#EF4444' : '#8A8A9A';
                      const chemDiffLabel = chemPreview.diff > 0 ? `+${chemPreview.diff}` : chemPreview.diff < 0 ? `${chemPreview.diff}` : '0';
                      
                      const baseId = Object.keys(SOFIFA_MAPPING).find(key => player.id === key || player.id.startsWith(key + '_')) || player.id.split('_')[0];
                      const m = SOFIFA_MAPPING[baseId];
                      const photoUrl = m ? `https://cdn.sofifa.net/players/${String(m.id).padStart(6, '0').slice(0,3)}/${String(m.id).padStart(6, '0').slice(3,6)}/${m.ver}_120.png` : null;

                      // Check compatibility if target index is a starter slot
                      const targetIsStarterSlot = selectedPlayerIndex < 11;
                      const targetRole = targetIsStarterSlot ? formationRoles[selectedPlayerIndex] : null;
                      const compatLabel = (() => {
                        if (!targetRole) return null;
                        if (player.position === targetRole) {
                          return {
                            label: `✓ Posição Nativa (${POS_PT[player.position] ?? player.position})`,
                            color: '#22C55E',
                            bg: '#22C55E1A',
                            border: '#22C55E33'
                          };
                        }
                        if (isPlayerInPosition(player, targetRole)) {
                          return {
                            label: `✓ Alternativa (${POS_PT[player.position] ?? player.position})`,
                            color: '#3B82F6',
                            bg: '#3B82F61A',
                            border: '#3B82F633'
                          };
                        }
                        return {
                          label: `⚠️ Fora de Pos. (${POS_PT[player.position] ?? player.position})`,
                          color: '#EF4444',
                          bg: '#EF44441A',
                          border: '#EF444433'
                        };
                      })();

                      return (
                        <div
                          key={player.id}
                          onClick={() => {
                            dispatch({ type: 'SWAP_PLAYERS', indexA: selectedPlayerIndex, indexB: idx });
                            setSelectedPlayerIndex(null);
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-[#161626] hover:border-[#C9A84C]/50 active:scale-[0.98] transition-all"
                          style={{
                            background: '#07070f',
                          }}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]" style={{ border: `1.5px solid ${getRarityColor(player.rarity)}` }}>
                            {photoUrl ? (
                              <img src={photoUrl} alt={player.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
                            ) : (
                              <span className="text-sm font-bold" style={{ color: getRarityColor(player.rarity) }}>⚽</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {compatLabel ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border" style={{ background: compatLabel.bg, color: compatLabel.color, borderColor: compatLabel.border, fontFamily: 'Rajdhani, sans-serif' }}>
                                  {compatLabel.label}
                                </span>
                              ) : (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: '#222', fontFamily: 'Rajdhani, sans-serif' }}>
                                  {POS_PT[player.position] ?? player.position}
                                </span>
                              )}
                              <span className="text-[9px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                                GER: {player.overall}
                              </span>
                              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded" style={{ background: isStarter ? '#22C55E22' : '#3B82F622', color: isStarter ? '#22C55E' : '#3B82F6', fontFamily: 'Rajdhani, sans-serif' }}>
                                POSIÇÃO {posIdx + 1}
                              </span>
                            </div>
                            <div className="text-sm font-black text-white truncate mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              {player.shortName.toUpperCase()}
                            </div>
                          </div>

                          {/* Chemistry preview indicator */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-[9px] text-gray-500 font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA</div>
                            <div className="text-xs font-black" style={{ color: chemDiffColor, fontFamily: 'Rajdhani, sans-serif' }}>
                              {chemPreview.total} <span className="text-[10px] font-bold">({chemDiffLabel})</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Close Button Footer */}
              <div className="flex justify-end mt-4 pt-4 border-t" style={{ borderColor: '#1d1d2f' }}>
                <button
                  onClick={() => setSelectedPlayerIndex(null)}
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
    </div>
  );
}
