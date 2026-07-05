// UCL Immortals — SquadEditor
// THE single source of truth for the squad-editing UI, shared by the post-draft "Revisão do
// elenco" screen AND the in-league "MEU TIME" tab. Both used to be near-duplicates; now any
// change here shows up in both. It's purely presentational: data + callbacks come from props,
// so each host wires its own state (drafted players vs the league team) and actions.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FORMATIONS, COACHES, HISTORICAL_TRIOS, getRarityColor, Player, POS_PT, effectiveSecondaries } from '../../lib/gameData';
import {
  calculateChemistry, getPlayerEffectiveStats, getCoachModifiersForPlayer, getChemistryLinks,
  PREFERRED_FORMATION_CHEM_BONUS, PILAR_CHEM_BONUS, LOBO_CHEM_PENALTY, captainBoostFromStarters,
  computeCharacteristicBoosts, isEvolved, evolvePointsSpent, EVOLVE_GAMES, EVOLVE_POINTS, positionFit,
} from '../../lib/gameEngine';
import { TRAIT_MAP, traitEffectLabel, hasOopRelief, type AttrKey } from '../../lib/traits';
import FormationField, { CHEM_LINK_COLOR } from './FormationField';
import CoachStadiumPanel from './CoachStadiumPanel';
import { stadiumFor } from '../../lib/stadium';
import PlayerCard, { buildSofifaUrl, cardTexture, UNIQUE_STYLE, getCardVariants } from './PlayerCard';
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
  onSetMartirTargets?: (playerId: string, targetIds: string[]) => void; // 🩸 pick the 2 buffed teammates
  showCoachCard?: boolean;           // the manager card (default on)
  footer?: React.ReactNode;          // host-specific action (e.g. "INICIAR DRAFT")
  isKnockout?: boolean;              // 🍿 phase: drives the Pipoqueiro league(+)/knockout(−) preview
  // 🟨🟥🩹 Disponibilidade (suspensão/lesão/amarelos) por playerId + ação de fisioterapia.
  availability?: Record<string, { yellows: number; banned: number; injured: number }>;
  onHealInjury?: (playerId: string) => void;
  canAffordPhysio?: boolean;
  physioCost?: number;               // 🏥 custo da fisioterapia (mostrado no botão + confirmação)
  // ⭐ Técnico Prime (Fase 2): evolução via critério + pontos (só no MEU TIME).
  coachPrime?: boolean;
  points?: number;
  wins?: number;
  onEvolvePrime?: () => void;
  // ⭐ Cartas Evoluídas: distribuir/resetar os 8 pontos livres (só no MEU TIME).
  onSetEvolvePoint?: (playerId: string, attr: AttrKey, delta: number) => void;
  onResetEvolvePoints?: (playerId: string) => void;
}

// Atributos com rótulo pt-br (alocador da Carta Evoluída).
const EVOLVE_ATTRS: { key: AttrKey; label: string }[] = [
  { key: 'pace', label: 'RITMO' }, { key: 'shooting', label: 'FINALIZAÇÃO' }, { key: 'passing', label: 'PASSE' }, { key: 'dribbling', label: 'DRIBLE' },
  { key: 'defending', label: 'DEFESA' }, { key: 'physical', label: 'FÍSICO' }, { key: 'vision', label: 'VISÃO' }, { key: 'composure', label: 'COMPOSTURA' },
];

export default function SquadEditor({
  players, coachId, formationId, playStyle,
  captain, penaltyTaker, freeKickTaker,
  onSetFormation, onSetPlayStyle, onSetCaptain, onSetPenaltyTaker, onSetFreeKickTaker, onSwap, onSetMartirTargets,
  showCoachCard = true, footer, isKnockout = false,
  availability, onHealInjury, canAffordPhysio, physioCost = 250,
  coachPrime, points, wins, onEvolvePrime,
  onSetEvolvePoint, onResetEvolvePoints,
}: SquadEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // 🔍 Ver o card do jogador em tela cheia (só visualização).
  const [zoomCard, setZoomCard] = useState(false);
  // 🏥 Fisioterapia: guarda o id do jogador aguardando CONFIRMAÇÃO (nada de comprar num clique só).
  const [confirmPhysioFor, setConfirmPhysioFor] = useState<string | null>(null);
  // 🟨🟥🩹 Badge de disponibilidade de um jogador (ou null se está tudo certo).
  const availBadge = (playerId: string): { txt: string; color: string } | null => {
    const a = availability?.[playerId];
    if (!a) return null;
    if (a.banned > 0) return { txt: `🟥 SUSP · ${a.banned} ${a.banned === 1 ? 'JOGO' : 'JOGOS'}`, color: '#EF4444' };
    if (a.injured > 0) return { txt: `🩹 LESÃO · ${a.injured} ${a.injured === 1 ? 'JOGO' : 'JOGOS'}`, color: '#F59E0B' };
    if (a.yellows > 0) return { txt: `🟨×${a.yellows}`, color: '#EAB308' };
    return null;
  };

  const formation = FORMATIONS.find(f => f.id === formationId);
  const coach = COACHES.find(c => c.id === coachId);
  const xi = players.slice(0, 11);
  const bench = players.slice(11);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const chemData = calculateChemistry(xi, coachId, formationRoles, formationId);
  const chemLinks = getChemistryLinks(xi, coachId);
  const captainBoost = captainBoostFromStarters(xi, captain ?? undefined) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(players); // 🩸❤️🪑 team-effect characteristics

  const chemColor = chemData.total >= 90 ? '#22C55E' : chemData.total >= 60 ? '#EAB308' : chemData.total >= 30 ? '#F97316' : '#EF4444';
  const activeTrios = chemData.trios.map(id => HISTORICAL_TRIOS.find(t => t.id === id)).filter(Boolean);

  const teamOverall = xi.length === 11
    ? Math.round(xi.reduce((sum, p) => {
      const eff = getPlayerEffectiveStats(p, chemData.individual[p.id] ?? 0, chemData.outOfPosition[p.id] ?? false, coachId, chemData.total, playStyle, { captainBoost, charBoosts, isKnockout, isSecondary: chemData.secondaryPos[p.id] ?? false });
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
  const selectedIsSecondary = selectedPlayer ? (chemData.secondaryPos[selectedPlayer.id] ?? false) : false;

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

      {/* ── Comando do Time: técnico + estádio (+ evolução Prime no MEU TIME) ── */}
      {showCoachCard && coach && (
        <CoachStadiumPanel
          coach={coach}
          formation={formation}
          coachPrime={!!coachPrime}
          stadium={stadiumFor(coachId, !!coachPrime)}
          wins={wins}
          points={points}
          onEvolve={onEvolvePrime}
        />
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
            {xi.map((player, index) => {
              const ab = availBadge(player.id);
              return (
                <div key={player.id} className="relative">
                  <PlayerCard player={player} chemScore={chemData.individual[player.id]} showChemistry compact
                    selected={selectedIndex === index} onClick={() => setSelectedIndex(index)} />
                  {ab && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                    style={{ background: '#0A0A14', color: ab.color, border: `1px solid ${ab.color}88`, fontFamily: 'Rajdhani, sans-serif' }}>{ab.txt}</span>}
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t" style={{ borderColor: '#1A1A2A' }}>
            <div className="text-xs font-black tracking-widest mb-2 flex items-center gap-2" style={{ color: '#818CF8', fontFamily: 'Rajdhani, sans-serif' }}>
              🪑 BANCO / RESERVAS {bench.length > 0 && <span style={{ color: '#6A6A7A' }}>({bench.length})</span>}
            </div>
            {bench.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {bench.map((player, i) => {
                    const ab = availBadge(player.id);
                    return (
                      <div key={player.id} className="relative">
                        <PlayerCard player={player} compact selected={selectedIndex === 11 + i} onClick={() => setSelectedIndex(11 + i)} />
                        {ab && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                          style={{ background: '#0A0A14', color: ab.color, border: `1px solid ${ab.color}88`, fontFamily: 'Rajdhani, sans-serif' }}>{ab.txt}</span>}
                      </div>
                    );
                  })}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative bg-[#0b0b14] border border-[#1d1d2f] rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Fundo: textura da carta do jogador (a Única usa a sua própria), com véu leve p/ legibilidade */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0, backgroundImage: `url(${UNIQUE_STYLE[selectedPlayer.id]?.texture ?? cardTexture(selectedPlayer.rarity, isEvolved(selectedPlayer))})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.95 }} />
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0, background: 'linear-gradient(180deg,rgba(9,9,16,.52),rgba(9,9,16,.6))' }} />

              <div className="relative z-10 flex items-center justify-between border-b px-6 pt-5 pb-4" style={{ borderColor: '#1d1d2f' }}>
                <div>
                  <h3 className="text-xl font-black text-white tracking-widest uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>GERENCIAR POSIÇÃO</h3>
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Trocar posição de <span className="font-extrabold text-[#C9A84C]">{selectedPlayer.shortName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setZoomCard(true)} title="Ver card em tela cheia"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors hover:bg-white/10 focus:outline-none"
                    style={{ border: '1px solid #2E2E42', color: '#C9C9D5' }}>🔍</button>
                  <button onClick={() => setSelectedIndex(null)} className="w-9 h-9 rounded-lg flex items-center justify-center text-2xl font-black text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none">✕</button>
                </div>
              </div>

              {/* 🟨🟥🩹 Disponibilidade + Fisioterapia */}
              {(() => {
                const a = availability?.[selectedPlayer.id];
                if (!a || (a.banned === 0 && a.injured === 0 && a.yellows === 0)) return null;
                return (
                  <div className="relative z-10 px-6 py-3 flex items-center justify-between gap-3 border-b" style={{ borderColor: '#1d1d2f', background: '#12060688' }}>
                    <div className="text-xs font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: a.banned ? '#FCA5A5' : a.injured ? '#FCD34D' : '#EAB308' }}>
                      {a.banned > 0 ? `🟥 Suspenso — fora de ${a.banned} jogo(s)` : a.injured > 0 ? `🩹 Lesionado — fora de ${a.injured} jogo(s)` : `🟨 ${a.yellows} amarelo(s) acumulado(s)`}
                    </div>
                    {a.injured > 0 && onHealInjury && (
                      <button disabled={!canAffordPhysio} onClick={() => setConfirmPhysioFor(selectedPlayer.id)}
                        className="text-[11px] font-black px-3 py-1.5 rounded-lg tracking-wider disabled:opacity-40 transition-transform active:scale-95 flex items-center gap-1.5"
                        style={{ fontFamily: 'Rajdhani, sans-serif', background: '#0E7490', color: '#ECFEFF', border: '1px solid #22D3EE55' }}
                        title={canAffordPhysio ? undefined : `Faltam pontos (custa ${physioCost})`}>
                        🏥 Fisioterapia · −1 jogo
                        <span className="px-1.5 py-0.5 rounded" style={{ background: '#083344', color: '#67E8F9' }}>{physioCost} pts</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* 🏥 Confirmação da fisioterapia — evita comprar num clique só. */}
              {confirmPhysioFor && (() => {
                const pp = players.find(p => p.id === confirmPhysioFor);
                if (!pp) return null;
                const inj = availability?.[confirmPhysioFor]?.injured ?? 0;
                return (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={() => setConfirmPhysioFor(null)}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="w-full max-w-sm rounded-2xl p-5 text-center" style={{ background: '#0b0b14', border: '1px solid #0E7490' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="text-3xl mb-1">🏥</div>
                      <h3 className="text-lg font-black tracking-widest uppercase mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#67E8F9' }}>Fisioterapia</h3>
                      <p className="text-[13px] mb-1" style={{ color: '#C8D0D4', fontFamily: 'Rajdhani, sans-serif' }}>
                        Reduzir <b style={{ color: '#FFF' }}>1 jogo</b> de lesão de <b style={{ color: '#FFF' }}>{pp.shortName}</b>?
                      </p>
                      <p className="text-[12px] mb-4" style={{ color: '#8A9BA0', fontFamily: 'Rajdhani, sans-serif' }}>
                        Fica <b style={{ color: '#FCD34D' }}>{Math.max(0, inj - 1)} jogo(s)</b> de fora · custa <b style={{ color: '#67E8F9' }}>{physioCost} pts</b>
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmPhysioFor(null)} className="flex-1 py-2.5 rounded-xl font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', background: '#17171f', color: '#9A9AA5' }}>
                          CANCELAR
                        </button>
                        <button
                          disabled={!canAffordPhysio}
                          onClick={() => { onHealInjury?.(confirmPhysioFor); setConfirmPhysioFor(null); }}
                          className="flex-1 py-2.5 rounded-xl font-black tracking-widest disabled:opacity-40 transition-transform active:scale-95"
                          style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg,#0E7490,#22D3EE)', color: '#062028' }}>
                          CONFIRMAR
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })()}

              <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-5">
                {(() => {
                  const isStarter = selectedIndex < 11;
                  const eff = getPlayerEffectiveStats(selectedPlayer, selectedChemScore, selectedIsOOP, coachId, chemData.total, playStyle, { captainBoost: isStarter ? captainBoost : undefined, charBoosts, isKnockout, isSecondary: selectedIsSecondary });
                  const posIdx = isStarter ? selectedIndex : -1;
                  const formationRole = isStarter ? (formationRoles[posIdx] ?? selectedPlayer.position) : selectedPlayer.position;
                  const photoUrl = UNIQUE_STYLE[selectedPlayer.id]?.render ?? buildSofifaUrl(selectedPlayer.id, 120);
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
                            ? <img src={photoUrl} alt={selectedPlayer.shortName} referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} />
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
                            {selectedIsSecondary && (
                              hasOopRelief(selectedPlayer.traits)
                                ? <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: '#14532d', color: '#86efac', border: '1px solid #22C55E55', fontFamily: 'Rajdhani, sans-serif' }}>🧭 2ª POSIÇÃO · SEM PENALIDADE</span>
                                : <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B55', fontFamily: 'Rajdhani, sans-serif' }}>🔁 2ª POSIÇÃO · −7%</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-xl font-black uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{selectedPlayer.shortName}</div>
                            {isEvolved(selectedPlayer) && (
                              <span className="inline-flex items-center justify-center text-center text-[9px] font-black px-2 py-0.5 rounded leading-none flex-shrink-0" style={{ background: 'linear-gradient(90deg,#0a7a2f,#22C55E)', color: '#04120a', letterSpacing: '0.06em' }}>⭐ EVOLUÍDO</span>
                            )}
                          </div>
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
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <span className="text-[9px] text-gray-500 font-bold tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>JOGA EM:</span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: '#1c1c2e', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[selectedPlayer.position] ?? selectedPlayer.position}</span>
                          {effectiveSecondaries(selectedPlayer).map(pos => (
                            <span key={pos} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#12121c', color: '#9A9AAA', border: '1px solid #2a2a3a', fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[pos] ?? pos}</span>
                          ))}
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

                      <BuffBreakdown eff={eff} chem={isStarter ? chemInfo : undefined} traits={traitInfos} player={selectedPlayer} charBoost={charBoosts[selectedPlayer.id]} isStarter={isStarter} />
                    </div>
                  );
                })()}

                {/* 🩸 Mártir — pick the 2 XI teammates who get +3 (in-league only; post-draft uses auto). */}
                {selectedPlayer.martir && onSetMartirTargets && selectedIndex < 11 && (() => {
                  const others = players.slice(0, 11).filter(p => p.id !== selectedPlayer.id);
                  const current = (selectedPlayer.martirTargets ?? []).filter(id => others.some(o => o.id === id));
                  const toggle = (id: string) => {
                    let next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
                    if (next.length > 2) next = next.slice(next.length - 2);
                    onSetMartirTargets(selectedPlayer.id, next);
                  };
                  return (
                    <div className="rounded-xl p-3" style={{ background: '#1a0808', border: '1px solid #B91C1C55' }}>
                      <div className="text-[11px] font-black tracking-widest" style={{ color: '#F87171', fontFamily: 'Rajdhani, sans-serif' }}>🩸 SACRIFÍCIO DO MÁRTIR</div>
                      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                        Escolha até <b style={{ color: '#fff' }}>2 titulares</b> que recebem <b style={{ color: '#F87171' }}>+3 em todos os atributos</b>.
                        {current.length < 2 && <> Sem escolher, vai automático pros 2 de maior overall.</>}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {others.map(o => {
                          const sel = current.includes(o.id);
                          return (
                            <button key={o.id} onClick={() => toggle(o.id)}
                              className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95"
                              style={{ background: sel ? '#B91C1C33' : '#07070f', color: sel ? '#F87171' : '#9A9AAA', border: `1px solid ${sel ? '#B91C1C' : '#1A1A2A'}`, fontFamily: 'Rajdhani, sans-serif' }}>
                              {sel ? '✓ ' : ''}{o.shortName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ⭐ Carta Evoluída — alocador dos 8 pontos livres (ou progresso pra evoluir) */}
                {onSetEvolvePoint && (() => {
                  const evolved = isEvolved(selectedPlayer);
                  const ep = selectedPlayer.evolvePoints ?? {};
                  const spent = evolvePointsSpent(ep);
                  const left = EVOLVE_POINTS - spent;
                  const apps = selectedPlayer.appearances ?? 0;
                  return (
                    <div className="rounded-xl overflow-hidden" style={{ background: '#0F0F1A', border: `1px solid ${evolved ? '#22C55E55' : '#1A1A2A'}` }}>
                      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
                        <span className="text-[10px] font-black tracking-widest" style={{ color: evolved ? '#22C55E' : '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>⭐ CARTA EVOLUÍDA</span>
                        {evolved && <span className="text-[10px] font-black" style={{ color: left > 0 ? '#E8C84A' : '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Pontos: {left}/{EVOLVE_POINTS}</span>}
                      </div>
                      {evolved ? (
                        <div className="p-3">
                          <div className="text-[10px] mb-2 leading-snug" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                            Você tem <b style={{ color: '#22C55E' }}>{EVOLVE_POINTS} pontos livres</b> pra reforçar esta carta: cada <b style={{ color: '#C9C9D5' }}>+</b> soma <b style={{ color: '#C9C9D5' }}>+1</b> no atributo (sem teto — pode empilhar num só). Dá pra <b style={{ color: '#C9C9D5' }}>resetar</b> e redistribuir quando quiser.
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {EVOLVE_ATTRS.map(a => {
                              const v = ep[a.key] ?? 0;
                              return (
                                <div key={a.key} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: '#0A0A12', border: '1px solid #1A1A2A' }}>
                                  <span className="text-[10px] font-bold" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{a.label}</span>
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => onSetEvolvePoint(selectedPlayer.id, a.key, -1)} disabled={v <= 0} className="w-5 h-5 rounded flex items-center justify-center text-xs font-black" style={{ background: v > 0 ? '#1A1A2A' : '#12121C', color: v > 0 ? '#EF4444' : '#3A3A4A', cursor: v > 0 ? 'pointer' : 'default' }}>−</button>
                                    <span className="text-[11px] font-black w-4 text-center" style={{ color: v > 0 ? '#22C55E' : '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{v}</span>
                                    <button onClick={() => onSetEvolvePoint(selectedPlayer.id, a.key, 1)} disabled={left <= 0} className="w-5 h-5 rounded flex items-center justify-center text-xs font-black" style={{ background: left > 0 ? '#1A1A2A' : '#12121C', color: left > 0 ? '#22C55E' : '#3A3A4A', cursor: left > 0 ? 'pointer' : 'default' }}>+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {onResetEvolvePoints && spent > 0 && (
                            <button onClick={() => onResetEvolvePoints(selectedPlayer.id)} className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-black" style={{ background: '#1A1A2A', color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>↺ RESETAR PONTOS</button>
                          )}
                        </div>
                      ) : (
                        <div className="p-3">
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                            <span style={{ color: '#8A8A9A' }}>Jogos para evoluir</span>
                            <span style={{ color: '#C9C9D5' }}>{Math.min(apps, EVOLVE_GAMES)}/{EVOLVE_GAMES}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1A1A2A' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, apps / EVOLVE_GAMES * 100)}%`, background: 'linear-gradient(90deg,#0a7a2f,#22C55E)' }} />
                          </div>
                          <div className="text-[10px] mt-1.5 leading-snug" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                            Use esta carta como titular por {EVOLVE_GAMES} jogos pra evoluir. Ao evoluir, ela ganha <b style={{ color: '#22C55E' }}>{EVOLVE_POINTS} pontos livres</b> pra distribuir nos atributos (cada ponto = <b style={{ color: '#C9C9D5' }}>+1</b>, à sua escolha), e você pode redistribuir quando quiser.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Swap candidates list — grouped Titulares / Reservas, com indicador de encaixe na vaga */}
                <div className="space-y-3">
                  {(() => {
                    // Encaixe da TROCA: quem entra numa vaga de formação e em qual papel.
                    // - Titular selecionado → o CANDIDATO entra no slot selecionado.
                    // - Reserva selecionada → o SELECIONADO entra no slot do titular candidato.
                    const starterSel = selectedIndex !== null && selectedIndex < 11;
                    const headerRole = starterSel ? (formationRoles[selectedIndex!] ?? null) : null;
                    const swapFit = (candidate: Player, idx: number): { fit: 'native' | 'secondary' | 'off' | null; role: string | null; occupant: Player } => {
                      const role = starterSel ? (formationRoles[selectedIndex!] ?? null) : (idx < 11 ? (formationRoles[idx] ?? null) : null);
                      const occupant = starterSel ? candidate : selectedPlayer!;
                      return { fit: role ? positionFit(occupant, role) : null, role, occupant };
                    };
                    const fitRank = (c: Player, idx: number) => {
                      const f = swapFit(c, idx).fit;
                      return f === 'native' ? 2 : f === 'secondary' ? 1 : 0;
                    };

                    const renderCandidate = (candidate: Player, idx: number) => {
                      const preview = getChemPreview(idx);
                      const diffColor = preview.diff > 0 ? '#22C55E' : preview.diff < 0 ? '#EF4444' : '#8A8A9A';
                      const diffLabel = preview.diff > 0 ? `+${preview.diff}` : `${preview.diff}`;
                      const photoUrl = UNIQUE_STYLE[candidate.id]?.render ?? buildSofifaUrl(candidate.id, 120);
                      const variants = getCardVariants(candidate);
                      const { fit, role, occupant } = swapFit(candidate, idx);
                      const nativeFit = fit === 'native';
                      const secFit = fit === 'secondary';
                      const fits = nativeFit || secFit;
                      const occVersatile = hasOopRelief(occupant.traits); // 🧭 quem entra na vaga é versátil?
                      const borderCol = role ? (nativeFit ? '#22C55E66' : secFit ? '#F59E0B66' : '#EF444455') : '#161626';
                      const bgCol = role ? (nativeFit ? '#08120b' : secFit ? '#141008' : '#120a0a') : '#07070f';
                      return (
                        <div key={candidate.id}
                          onClick={() => { onSwap(selectedIndex!, idx); setSelectedIndex(null); }}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border hover:brightness-125 active:scale-[0.98] transition-all"
                          style={{ background: bgCol, borderColor: borderCol }}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]" style={{ border: `1.5px solid ${getRarityColor(candidate.rarity)}` }}>
                            {photoUrl
                              ? <img src={photoUrl} alt={candidate.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} loading="lazy" referrerPolicy="no-referrer" />
                              : <span className="text-sm font-bold" style={{ color: getRarityColor(candidate.rarity) }}>⚽</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* nome + características */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-black text-white truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{candidate.shortName.toUpperCase()}</span>
                              {variants.map(v => (
                                <span key={v.key} title={v.label} className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 15, height: 15, fontSize: 9, borderRadius: 999, background: `${v.color}22`, border: `1px solid ${v.color}77` }}>{v.icon}</span>
                              ))}
                            </div>
                            {/* posições (nativa + secundárias) + GER */}
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: (starterSel && nativeFit) ? '#0a7a2f' : '#26263a', color: (starterSel && nativeFit) ? '#eafff0' : '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[candidate.position] ?? candidate.position}</span>
                              {effectiveSecondaries(candidate).map(pos => (
                                <span key={pos} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: (starterSel && secFit && pos === role) ? '#7a5c0f' : '#12121c', color: (starterSel && secFit && pos === role) ? '#ffe8b0' : '#7A7A8A', border: '1px solid #2a2a3a', fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[pos] ?? pos}</span>
                              ))}
                              <span className="text-[9px] font-bold text-gray-500 ml-0.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>GER {candidate.overall}</span>
                            </div>
                            {/* selo de encaixe na vaga (quem ocupa o slot após a troca) */}
                            {role && (
                              <div className="mt-1">
                                {nativeFit && <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: '#0a7a2f', color: '#eafff0', fontFamily: 'Rajdhani, sans-serif' }}>✓ ENCAIXA NA VAGA{starterSel ? '' : ` (${POS_PT[role] ?? role})`}</span>}
                                {secFit && (occVersatile
                                  ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: '#14532d', color: '#86efac', border: '1px solid #22C55E55', fontFamily: 'Rajdhani, sans-serif' }}>🧭 COBRE A VAGA (2ª pos · sem penalidade)</span>
                                  : <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: '#3a2708', color: '#F59E0B', border: '1px solid #F59E0B66', fontFamily: 'Rajdhani, sans-serif' }}>🔁 COBRE A VAGA (2ª pos · −7%){starterSel ? '' : ` (${POS_PT[role] ?? role})`}</span>)}
                                {!fits && <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: '#3a0a0a', color: '#EF4444', border: '1px solid #EF444455', fontFamily: 'Rajdhani, sans-serif' }}>⚠️ FORA DE POSIÇÃO{starterSel ? '' : ` (${POS_PT[role] ?? role})`}</span>}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[9px] text-gray-500 font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA</div>
                            <div className="text-xs font-black" style={{ color: diffColor, fontFamily: 'Rajdhani, sans-serif' }}>{preview.total} <span className="text-[10px] font-bold">({diffLabel})</span></div>
                          </div>
                        </div>
                      );
                    };

                    // Ordena: quem encaixa na vaga primeiro, depois maior overall.
                    const sortFit = (a: { c: Player; i: number }, b: { c: Player; i: number }) => fitRank(b.c, b.i) - fitRank(a.c, a.i) || b.c.overall - a.c.overall;
                    const starters = players.map((c, i) => ({ c, i })).filter(({ i }) => i < 11 && i !== selectedIndex).sort(sortFit);
                    const bench = players.map((c, i) => ({ c, i })).filter(({ i }) => i >= 11 && i !== selectedIndex).sort(sortFit);
                    const Section = ({ title, color, items }: { title: string; color: string; items: { c: Player; i: number }[] }) =>
                      items.length === 0 ? null : (
                        <div className="space-y-2">
                          <div className="text-[10px] font-black tracking-widest" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>{title}</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{items.map(({ c, i }) => renderCandidate(c, i))}</div>
                        </div>
                      );
                    return (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#8A8A9A] tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>TROCAR COM</span>
                          {headerRole && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ background: '#1c1c2e', color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>VAGA: {POS_PT[headerRole] ?? headerRole}</span>
                          )}
                        </div>
                        <div className="space-y-4">
                          <Section title="TITULARES" color="#22C55E" items={starters} />
                          <Section title="🪑 RESERVAS / BANCO" color="#818CF8" items={bench} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex justify-end px-6 py-4 border-t flex-shrink-0" style={{ borderColor: '#1d1d2f' }}>
                <button onClick={() => setSelectedIndex(null)}
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-black text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus:outline-none whitespace-nowrap"
                  style={{ fontFamily: 'Rajdhani, sans-serif', border: '1px solid #2E2E42' }}>Cancelar</button>
              </div>
            </motion.div>

            {/* 🔍 Card do jogador em tela cheia (só pra ver de perto) */}
            {zoomCard && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(3,3,10,0.92)' }} onClick={() => setZoomCard(false)}>
                <button onClick={() => setZoomCard(false)} title="Fechar"
                  className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-2xl font-black text-gray-300 hover:text-white focus:outline-none"
                  style={{ background: '#12121c', border: '1px solid #2E2E42' }}>✕</button>
                <div onClick={e => e.stopPropagation()}>
                  <PlayerCard player={selectedPlayer} scale={1.5} />
                </div>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
