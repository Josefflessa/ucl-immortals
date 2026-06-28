// UCL Immortals — SquadEditor
// THE single source of truth for the squad-editing UI, shared by the post-draft "Revisão do
// elenco" screen AND the in-league "MEU TIME" tab. Both used to be near-duplicates; now any
// change here shows up in both. It's purely presentational: data + callbacks come from props,
// so each host wires its own state (drafted players vs the league team) and actions.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FORMATIONS, COACHES, HISTORICAL_TRIOS, getRarityColor, Player, POS_PT } from '../../lib/gameData';
import {
  calculateChemistry, getPlayerEffectiveStats, getCoachModifiersForPlayer, getChemistryLinks,
  PREFERRED_FORMATION_CHEM_BONUS, PILAR_CHEM_BONUS, LOBO_CHEM_PENALTY, captainBoostFromStarters,
} from '../../lib/gameEngine';
import { TRAIT_MAP, traitEffectLabel } from '../../lib/traits';
import FormationField, { CHEM_LINK_COLOR } from './FormationField';
import PlayerCard, { buildSofifaUrl } from './PlayerCard';
import RolesSelector from './RolesSelector';
import TacticSelector from './TacticSelector';
import FormationSelector from './FormationSelector';
import ChemistryBonusInfo from './ChemistryBonusInfo';
import BuffBreakdown from './BuffBreakdown';

export interface SquadEditorProps {
  players: Player[];                 // full squad (first 11 = XI, rest = bench)
  coachId: string;
  formationId: string;
  playStyle: string;
  captain?: string | null;
  penaltyTaker?: string | null;
  freeKickTaker?: string | null;
  onSetFormation: (id: string) => void;
  onSetPlayStyle: (id: string) => void;
  onSetCaptain: (id: string) => void;
  onSetPenaltyTaker: (id: string) => void;
  onSetFreeKickTaker: (id: string) => void;
  onSwap: (indexA: number, indexB: number) => void;
  showCoachCard?: boolean;           // the manager card (default on)
  footer?: React.ReactNode;          // host-specific action (e.g. "INICIAR DRAFT")
}

export default function SquadEditor({
  players, coachId, formationId, playStyle,
  captain, penaltyTaker, freeKickTaker,
  onSetFormation, onSetPlayStyle, onSetCaptain, onSetPenaltyTaker, onSetFreeKickTaker, onSwap,
  showCoachCard = true, footer,
}: SquadEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const formation = FORMATIONS.find(f => f.id === formationId);
  const coach = COACHES.find(c => c.id === coachId);
  const xi = players.slice(0, 11);
  const bench = players.slice(11);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const chemData = calculateChemistry(xi, coachId, formationRoles, formationId);
  const chemLinks = getChemistryLinks(xi, coachId);
  const captainBoost = captainBoostFromStarters(xi, captain ?? undefined) ?? undefined;

  const chemColor = chemData.total >= 90 ? '#22C55E' : chemData.total >= 60 ? '#EAB308' : chemData.total >= 30 ? '#F97316' : '#EF4444';
  const activeTrios = chemData.trios.map(id => HISTORICAL_TRIOS.find(t => t.id === id)).filter(Boolean);

  const teamOverall = xi.length === 11
    ? Math.round(xi.reduce((sum, p) => {
        const eff = getPlayerEffectiveStats(p, chemData.individual[p.id] ?? 0, chemData.outOfPosition[p.id] ?? false, coachId, chemData.total, playStyle, { captainBoost });
        return sum + eff.overall;
      }, 0) / 11)
    : null;

  const getChemPreview = (candidateIdx: number) => {
    if (selectedIndex === null) return { total: chemData.total, diff: 0 };
    const temp = [...players];
    const swap = temp[selectedIndex];
    temp[selectedIndex] = temp[candidateIdx];
    temp[candidateIdx] = swap;
    const preview = calculateChemistry(temp.slice(0, 11), coachId, formationRoles, formationId);
    return { total: preview.total, diff: preview.total - chemData.total };
  };

  const selectedPlayer = selectedIndex !== null ? players[selectedIndex] : null;
  const selectedChemScore = selectedPlayer ? (chemData.individual[selectedPlayer.id] ?? 0) : 0;
  const selectedIsOOP = selectedPlayer ? (chemData.outOfPosition[selectedPlayer.id] ?? false) : false;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Team overall + chemistry summary */}
      <div className="rounded-xl p-4" style={{ background: '#0F0F1A', border: `1px solid ${chemColor}44` }}>
        {teamOverall !== null && (
          <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: '#1A1A2A' }}>
            <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>OVERALL DO TIME</span>
            <span className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>{teamOverall}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>QUÍMICA DO TIME</span>
          <span className="text-2xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: chemColor }}>{chemData.total}</span>
        </div>
        <div className="h-2 rounded-full" style={{ background: '#1A1A2A' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${chemData.total}%`, background: chemColor }} />
        </div>
        {coach && formation?.id === coach.preferredFormation && (
          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
            style={{ background: '#22C55E18', border: '1px solid #22C55E40', color: '#4ADE80', fontFamily: 'Rajdhani, sans-serif' }}>
            ✓ Inclui <b>+{PREFERRED_FORMATION_CHEM_BONUS}</b> da formação preferida do técnico ({coach.name})
          </div>
        )}
        {/* Cartas especiais que mexem na QUÍMICA GERAL (total) do time — Pilar (+) e Lobo Solitário (−). */}
        {(() => {
          const pilars = xi.filter(p => p?.pilar);
          const lobos = xi.filter(p => p?.lobo);
          if (pilars.length === 0 && lobos.length === 0) return null;
          return (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pilars.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
                  style={{ background: '#22C55E18', border: '1px solid #22C55E40', color: '#4ADE80', fontFamily: 'Rajdhani, sans-serif' }}>
                  🧱 {p.shortName} <b>+{PILAR_CHEM_BONUS}</b> química geral
                </span>
              ))}
              {lobos.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
                  style={{ background: '#EF444418', border: '1px solid #EF444440', color: '#FCA5A5', fontFamily: 'Rajdhani, sans-serif' }}>
                  🐺 {p.shortName} <b>−{LOBO_CHEM_PENALTY}</b> química geral
                </span>
              ))}
            </div>
          );
        })()}
        {activeTrios.length > 0 && (
          <div className="mt-3 text-xs" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
            ⭐ {activeTrios.map(t => t?.name).join(' · ')}
          </div>
        )}
        <ChemistryBonusInfo total={chemData.total} />
      </div>

      {/* ── Coach / manager card ── */}
      {showCoachCard && coach && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
          <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
            <span className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🎓 TÉCNICO</span>
            <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>COMANDO DO TIME</span>
          </div>
          <div className="p-4 flex gap-3.5">
            {coach.photoUrl && (
              <img src={coach.photoUrl} alt={coach.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                style={{ border: '2px solid #C9A84C55', objectPosition: 'center top' }} />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{coach.name}</div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>{coach.philosophy}</div>
              <div className="text-[11px] mt-1 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{coach.description}</div>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-2">
            <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #1A1A2A' }}>
              <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>⚡ EFEITO NO ELENCO</div>
              <div className="text-[11px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{coach.effect}</div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #2A2A4A' }}>
              <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: '#A78BFA', fontFamily: 'Rajdhani, sans-serif' }}>✨ HABILIDADE: {coach.specialAbilityName?.toUpperCase()}</div>
              <div className="text-[11px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{coach.specialAbility}</div>
            </div>
            {coach.preferredFormation && (
              <div className="flex items-center gap-2 text-[10px] pt-0.5 flex-wrap" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                <span style={{ color: '#6A6A7A' }}>Formação preferida:</span>
                <span className="px-2 py-0.5 rounded font-black" style={{ background: '#C9A84C22', color: '#E8C84A', border: '1px solid #C9A84C44' }}>{coach.preferredFormation}</span>
                {formation?.id === coach.preferredFormation
                  ? <span className="font-bold inline-flex items-center gap-1" style={{ color: '#22C55E' }}>✓ em uso · <span style={{ color: '#22C55E' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</span></span>
                  : <span style={{ color: '#8A8A9A' }}>jogue nela pra <b style={{ color: '#22C55E' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</b> do time</span>}
              </div>
            )}
          </div>
        </div>
      )}

      <FormationSelector value={formationId} onChange={onSetFormation} />
      <TacticSelector value={playStyle} onChange={onSetPlayStyle} />

      <RolesSelector
        players={xi}
        captainId={captain}
        penaltyTakerId={penaltyTaker}
        freeKickTakerId={freeKickTaker}
        onSetCaptain={onSetCaptain}
        onSetPenaltyTaker={onSetPenaltyTaker}
        onSetFreeKickTaker={onSetFreeKickTaker}
      />

      <p className="text-xs" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
        Clique em um jogador para trocar posições e ver buffs ativos do treinador.
      </p>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {formation && (
          <div className="lg:w-[420px] flex-shrink-0 space-y-2">
            <FormationField
              formation={formation}
              players={xi}
              chemistryScores={chemData.individual}
              showChemLines
              chemLinks={chemLinks}
              selectedPlayerIndex={selectedIndex}
              onPlayerClick={(_player, posIndex) => setSelectedIndex(posIndex)}
            />
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#8A8A9A' }}>
              <span className="font-bold tracking-wider text-[#6A6A7A]">CONEXÕES:</span>
              {([['club', 'Mesmo clube'], ['nation', 'Mesma nação'], ['coach', 'Mesmo técnico'], ['partner', 'Dupla histórica']] as const).map(([t, label]) => (
                <span key={t} className="flex items-center gap-1">
                  <span style={{ width: 12, height: 2.5, borderRadius: 2, background: CHEM_LINK_COLOR[t], display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>TITULARES</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {xi.map((player, index) => (
              <PlayerCard key={player.id} player={player} chemScore={chemData.individual[player.id]} showChemistry compact
                selected={selectedIndex === index} onClick={() => setSelectedIndex(index)} />
            ))}
          </div>

          <div className="mt-5 pt-4 border-t" style={{ borderColor: '#1A1A2A' }}>
            <div className="text-xs font-black tracking-widest mb-2 flex items-center gap-2" style={{ color: '#818CF8', fontFamily: 'Rajdhani, sans-serif' }}>
              🪑 BANCO / RESERVAS {bench.length > 0 && <span style={{ color: '#6A6A7A' }}>({bench.length})</span>}
            </div>
            {bench.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {bench.map((player, i) => (
                    <PlayerCard key={player.id} player={player} compact selected={selectedIndex === 11 + i} onClick={() => setSelectedIndex(11 + i)} />
                  ))}
                </div>
                <p className="text-[11px] mt-2" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                  Clique num reserva e escolha <b style={{ color: '#C9A84C' }}>"Trocar com"</b> um titular para colocá-lo no time.
                </p>
              </>
            ) : (
              <p className="text-[11px]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                Sem reservas ainda. Você ganha um <b style={{ color: '#E8C84A' }}>reforço ao fim de cada rodada</b> — ele aparece aqui no banco.
              </p>
            )}
          </div>
        </div>
      </div>

      {footer}

      {/* Premium Player Modal */}
      <AnimatePresence>
        {selectedIndex !== null && selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-[#0b0b14] border border-[#1d1d2f] rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="flex items-center justify-between border-b px-6 pt-5 pb-4" style={{ borderColor: '#1d1d2f' }}>
                <div>
                  <h3 className="text-xl font-black text-white tracking-widest uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>GERENCIAR POSIÇÃO</h3>
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Trocar posição de <span className="font-extrabold text-[#C9A84C]">{selectedPlayer.shortName}</span>
                  </p>
                </div>
                <button onClick={() => setSelectedIndex(null)} className="text-gray-400 hover:text-white text-2xl font-black focus:outline-none">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {(() => {
                  const isStarter = selectedIndex < 11;
                  const eff = getPlayerEffectiveStats(selectedPlayer, selectedChemScore, selectedIsOOP, coachId, chemData.total, playStyle, { captainBoost: isStarter ? captainBoost : undefined });
                  const posIdx = isStarter ? selectedIndex : -1;
                  const formationRole = isStarter ? (formationRoles[posIdx] ?? selectedPlayer.position) : selectedPlayer.position;
                  const photoUrl = buildSofifaUrl(selectedPlayer.id, 120);
                  const chemDots = [0, 1, 2].map(i => i < eff.chemScore);
                  const linkLabels: Record<string, string> = { club: 'Mesmo clube', nation: 'Mesma nação', coach: 'Mesmo técnico', partner: 'Dupla histórica' };
                  const selLinks = posIdx >= 0
                    ? chemLinks.filter(l => l.aIndex === posIdx || l.bIndex === posIdx).map(l => ({ player: xi[l.aIndex === posIdx ? l.bIndex : l.aIndex], type: l.type }))
                    : [];
                  const linksByType = (['club', 'nation', 'coach', 'partner'] as const)
                    .map(t => ({ t, names: selLinks.filter(l => l.type === t).map(l => l.player?.shortName).filter(Boolean) as string[] }))
                    .filter(g => g.names.length > 0);
                  const LINK_PTS: Record<string, number> = { club: 2, nation: 1, coach: 2, partner: 1 };
                  const chemRawPts = selectedIsOOP ? 0
                    : selLinks.reduce((s, l) => s + (LINK_PTS[l.type] ?? 0), 0) + ((selectedPlayer.historicalCoaches ?? []).includes(coachId) ? 1 : 0);
                  const chemThresholds = [2, 5, 8];
                  const chemNextAt = eff.chemScore >= 3 ? null : chemThresholds[eff.chemScore];
                  const chemInfo = {
                    oop: selectedIsOOP,
                    nativePos: POS_PT[selectedPlayer.position] ?? selectedPlayer.position,
                    formationPos: POS_PT[formationRole] ?? formationRole,
                    links: linksByType.map(({ t, names }) => ({ type: t, label: linkLabels[t], color: CHEM_LINK_COLOR[t], names })),
                    rawPts: chemRawPts, nextAt: chemNextAt,
                  };
                  const traitInfos = (selectedPlayer.traits ?? []).map(tid => {
                    const def = TRAIT_MAP[tid];
                    return { id: tid, icon: def?.icon ?? '✨', effect: traitEffectLabel(tid), flavor: def?.flavor ?? '' };
                  });
                  const statRows = [
                    { label: 'RIT', base: selectedPlayer.pace, eff: eff.pace },
                    { label: 'FIN', base: selectedPlayer.shooting, eff: eff.shooting },
                    { label: 'PAS', base: selectedPlayer.passing, eff: eff.passing },
                    { label: 'DRI', base: selectedPlayer.dribbling, eff: eff.dribbling },
                    { label: 'DEF', base: selectedPlayer.defending, eff: eff.defending },
                    { label: 'FIS', base: selectedPlayer.physical, eff: eff.physical },
                    { label: 'VIS', base: selectedPlayer.vision, eff: eff.vision },
                    { label: 'CMP', base: selectedPlayer.composure, eff: eff.composure },
                  ];
                  return (
                    <div className="rounded-xl overflow-hidden" style={{ background: '#07070f', border: `1px solid ${getRarityColor(selectedPlayer.rarity)}22` }}>
                      <div className="flex items-center gap-4 p-4">
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#10101d', border: `2px solid ${getRarityColor(selectedPlayer.rarity)}` }}>
                          {photoUrl
                            ? <img src={photoUrl} alt={selectedPlayer.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
                            : <span className="text-2xl" style={{ color: getRarityColor(selectedPlayer.rarity) }}>⚽</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ background: '#1c1c2e', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                              {POS_PT[formationRole] ?? formationRole}
                            </span>
                            {selectedIsOOP && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444444', fontFamily: 'Rajdhani, sans-serif' }}>⚠️ FORA DE POSIÇÃO</span>
                            )}
                          </div>
                          <div className="text-xl font-black uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{selectedPlayer.shortName}</div>
                          <div className="text-xs text-gray-400 truncate" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{selectedPlayer.club} · {selectedPlayer.nation}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{eff.overall}</div>
                          {eff.overallMod > 0 && <div className="text-xs font-bold" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>(+{eff.overallMod})</div>}
                          <div className="text-[9px] text-gray-500 mt-0.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>GERAL EFETIVO</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 border-t" style={{ borderColor: '#161626' }}>
                        {statRows.map(({ label, base, eff: effVal }, i) => {
                          const delta = effVal - base;
                          const statColor = delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : '#E8D080';
                          const rightEdge = (i + 1) % 4 === 0;
                          const firstRow = i < 4;
                          return (
                            <div key={label} className={`flex flex-col items-center py-3 ${rightEdge ? '' : 'border-r'} ${firstRow ? 'border-b' : ''}`} style={{ borderColor: '#161626' }}>
                              <span className="text-[9px] font-bold text-gray-600 tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
                              <span className="text-lg font-black" style={{ fontFamily: 'Rajdhani, sans-serif', color: statColor }}>{effVal}</span>
                              {delta !== 0 && <span className="text-[9px] font-bold" style={{ color: statColor, fontFamily: 'Rajdhani, sans-serif' }}>{delta > 0 ? '+' : ''}{delta}</span>}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#161626' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-500 font-bold tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA INDIVIDUAL</span>
                          <div className="flex gap-1">
                            {chemDots.map((filled, i) => (
                              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: filled ? '#22C55E' : '#1a1a2e', boxShadow: filled ? '0 0 5px #22C55E' : 'none', border: '1px solid rgba(255,255,255,.1)' }} />
                            ))}
                          </div>
                          <span className="text-[10px] font-black text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{eff.chemScore}/3</span>
                        </div>
                        <div className="text-[9px] text-gray-500 font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                          Pos. nativa: <span className="text-white">{POS_PT[selectedPlayer.position] ?? selectedPlayer.position}</span>
                        </div>
                      </div>

                      {eff.activeCoachEffects.length > 0 && (
                        <div className="px-4 py-3 border-t" style={{ borderColor: '#161626', background: '#09090f' }}>
                          <div className="text-[9px] font-black text-yellow-400 tracking-widest mb-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>⚡ BÔNUS ATIVO DO TREINADOR</div>
                          <div className="flex flex-wrap gap-1.5">
                            {eff.activeCoachEffects.map((effect, ei) => (
                              <span key={ei} className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: '#C9A84C22', color: '#E8C84A', border: '1px solid #C9A84C44', fontFamily: 'Rajdhani, sans-serif' }}>{effect}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <BuffBreakdown eff={eff} chem={isStarter ? chemInfo : undefined} traits={traitInfos} player={selectedPlayer} />
                    </div>
                  );
                })()}

                {/* Swap candidates list */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#8A8A9A] tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>TROCAR COM:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {players.map((candidate, idx) => {
                      if (idx === selectedIndex) return null;
                      const preview = getChemPreview(idx);
                      const isStarter = idx < 11;
                      const diffColor = preview.diff > 0 ? '#22C55E' : preview.diff < 0 ? '#EF4444' : '#8A8A9A';
                      const diffLabel = preview.diff > 0 ? `+${preview.diff}` : `${preview.diff}`;
                      const photoUrl = buildSofifaUrl(candidate.id, 120);
                      const candidateMods = getCoachModifiersForPlayer(candidate, coachId);
                      const hasBuffs = candidateMods.activeEffects.length > 0;
                      return (
                        <div key={candidate.id}
                          onClick={() => { onSwap(selectedIndex!, idx); setSelectedIndex(null); }}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-[#161626] hover:border-[#C9A84C]/50 active:scale-[0.98] transition-all"
                          style={{ background: '#07070f' }}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]" style={{ border: `1.5px solid ${getRarityColor(candidate.rarity)}` }}>
                            {photoUrl
                              ? <img src={photoUrl} alt={candidate.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
                              : <span className="text-sm font-bold" style={{ color: getRarityColor(candidate.rarity) }}>⚽</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: '#222', fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[candidate.position] ?? candidate.position}</span>
                              <span className="text-[9px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>GER: {candidate.overall}</span>
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: isStarter ? '#22C55E22' : '#3B82F622', color: isStarter ? '#22C55E' : '#3B82F6', fontFamily: 'Rajdhani, sans-serif' }}>POS. {idx + 1}</span>
                              {hasBuffs && <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ background: '#C9A84C22', color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>⚡ BUFF</span>}
                            </div>
                            <div className="text-sm font-black text-white truncate mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{candidate.shortName.toUpperCase()}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[9px] text-gray-500 font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA</div>
                            <div className="text-xs font-black" style={{ color: diffColor, fontFamily: 'Rajdhani, sans-serif' }}>{preview.total} <span className="text-[10px] font-bold">({diffLabel})</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end px-6 py-4 border-t flex-shrink-0" style={{ borderColor: '#1d1d2f' }}>
                <button onClick={() => setSelectedIndex(null)}
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-black text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus:outline-none whitespace-nowrap"
                  style={{ fontFamily: 'Rajdhani, sans-serif', border: '1px solid #2E2E42' }}>Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
