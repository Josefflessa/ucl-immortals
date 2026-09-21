// UCL Immortals — SquadEditor
// THE single source of truth for the squad-editing UI, shared by the post-draft "Revisão do
// elenco" screen AND the in-league "MEU TIME" tab. Both used to be near-duplicates; now any
// change here shows up in both. It's purely presentational: data + callbacks come from props,
// so each host wires its own state (drafted players vs the league team) and actions.
import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { FORMATIONS, COACHES, HISTORICAL_TRIOS, getRarityColor, getTacticById, Player, POS_PT, effectiveSecondaries } from '../../lib/gameData';
import {
  calculateChemistry, getPlayerEffectiveStats, getCoachModifiersForPlayer, getChemistryLinks, getEvolutionLevel,
  PREFERRED_FORMATION_CHEM_BONUS, PILAR_CHEM_BONUS, LOBO_CHEM_PENALTY, captainBoostFromStarters,
  computeCharacteristicBoosts, evolvePointsSpent, EVOLVE_LEVEL_THRESHOLDS, EVOLVE_POINTS, positionFit, type EffectiveStats,
} from '../../lib/gameEngine';
import { TRAIT_MAP, traitEffectLabel, type AttrKey } from '../../lib/traits';
import type { MatchPlan } from '../../lib/gameEngine';
import FormationField, { CHEM_LINK_COLOR } from './FormationField';
import CoachStadiumPanel from './CoachStadiumPanel';
import { stadiumFor } from '../../lib/stadium';
import PlayerCard, { buildSofifaUrl, cardTexture, UNIQUE_STYLE, getCardVariants } from './PlayerCard';
import RolesSelector, { roleMetricFor, suggestedRoleId, type GameRole, type RoleablePlayer } from './RolesSelector';
import TacticSelector from './TacticSelector';
import MatchPlanSelector from './MatchPlanSelector';
import FormationSelector from './FormationSelector';
import ChemistryBonusInfo from './ChemistryBonusInfo';
import BuffBreakdown from './BuffBreakdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { canonicalClubName } from '../../lib/crests';

export interface SquadEditorProps {
  players: Player[];                 // full squad (first 11 = XI, rest = bench)
  coachId: string;
  formationId: string;
  playStyle: string;
  matchPlan?: MatchPlan;
  captain?: string | null;
  penaltyTaker?: string | null;
  freeKickTaker?: string | null;
  onSetFormation: (id: string) => void;
  onSetPlayStyle: (id: string) => void;
  onSetMatchPlan?: (plan: MatchPlan) => void;
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
  // ⭐ Cartas Evoluídas: cada nível libera 6 pontos para distribuir (só no MEU TIME).
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
  matchPlan,
  captain, penaltyTaker, freeKickTaker,
  onSetFormation, onSetPlayStyle, onSetMatchPlan, onSetCaptain, onSetPenaltyTaker, onSetFreeKickTaker, onSwap, onSetMartirTargets,
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
  // Atalho de troca: segurar uma reserva arma o modo de substituição; o titular
  // escolhido no campo só é trocado depois da confirmação do usuário.
  const [pendingSwap, setPendingSwap] = useState<{ fromIndex: number; toIndex: number } | null>(null);
  const [benchSwapSourceIndex, setBenchSwapSourceIndex] = useState<number | null>(null);
  const [starterSwapSourceIndex, setStarterSwapSourceIndex] = useState<number | null>(null);
  const [benchDraggingIndex, setBenchDraggingIndex] = useState<number | null>(null);
  const [activeRole, setActiveRole] = useState<GameRole | null>(null);
  const [fieldSettingsPanel, setFieldSettingsPanel] = useState<'formation' | 'tactic' | null>(null);
  const fieldPreviewRef = useRef<HTMLDivElement>(null);
  const benchHoldTimerRef = useRef<number | null>(null);
  const benchHoldClickGuardRef = useRef(false);
  const benchDragClickGuardRef = useRef(false);
  const benchPointerStartRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const [isDesktopInput, setIsDesktopInput] = useState(false);

  // Native HTML5 dragging is reliable with a mouse/trackpad and gives the same
  // interaction as the titular cards. Touch devices keep the long-press shortcut
  // because native draggable elements are inconsistent on mobile browsers.
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setIsDesktopInput(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
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
  const activeTactic = getTacticById(playStyle);
  const coach = COACHES.find(c => c.id === coachId);
  const xi = players.slice(0, 11);
  const bench = players.slice(11);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const chemData = calculateChemistry(xi, coachId, formationRoles, formationId);
  const chemLinks = getChemistryLinks(xi, coachId);
  const captainBoost = captainBoostFromStarters(xi, captain ?? undefined) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(players); // 🩸❤️🪑 team-effect characteristics

  // A química usa o verde como identidade visual fixa nesta síntese do elenco;
  // o valor continua indicando o nível real, sem mudar o cálculo.
  const chemColor = '#22C55E';
  const activeTrios = chemData.trios.map(id => HISTORICAL_TRIOS.find(t => t.id === id)).filter(Boolean);

  const teamOverall = xi.length === 11
    ? Math.round(xi.reduce((sum, p, idx) => {
      const eff = getPlayerEffectiveStats(p, chemData.individual[p.id] ?? 0, chemData.outOfPosition[p.id] ?? false, coachId, chemData.total, playStyle, { captainBoost, charBoosts, isKnockout, role: formationRoles[idx] ?? p.position, isSecondary: chemData.secondaryPos[p.id] ?? false });
      return sum + eff.overall;
    }, 0) / 11)
    : null;

  // Meu Time is the only card context that renders effective values. Draft, shop and
  // reinforcement pickers omit this map and therefore keep the card's own values.
  const effectiveStatsById: Record<string, EffectiveStats> = Object.fromEntries(
    players.map((player, index) => {
      const isStarter = index < 11;
      const effective = getPlayerEffectiveStats(
        player,
        isStarter ? (chemData.individual[player.id] ?? 0) : 0,
        isStarter ? (chemData.outOfPosition[player.id] ?? false) : false,
        coachId,
        // Team-wide chemistry remains the current squad context for reserves;
        // only their individual link score/position penalty is absent.
        chemData.total,
        playStyle,
        {
          captainBoost: isStarter ? captainBoost : undefined,
          charBoosts,
          isKnockout,
          role: isStarter ? (formationRoles[index] ?? player.position) : player.position,
          isSecondary: isStarter ? (chemData.secondaryPos[player.id] ?? false) : false,
        },
      );
      return [player.id, effective];
    }),
  );

  const rolePlayers: RoleablePlayer[] = xi.map(player => ({
    ...player,
    effectiveOverall: effectiveStatsById[player.id]?.overall,
    effectiveStats: effectiveStatsById[player.id],
  }));
  const roleMetrics = activeRole
    ? Object.fromEntries(rolePlayers.map(player => [player.id, roleMetricFor(player, activeRole)]))
    : {};
  const roleSuggestionId = activeRole ? suggestedRoleId(rolePlayers, activeRole) : null;

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

  const clearBenchHoldTimer = () => {
    if (benchHoldTimerRef.current !== null) {
      window.clearTimeout(benchHoldTimerRef.current);
      benchHoldTimerRef.current = null;
    }
  };

  const revealFieldPreview = () => {
    clearBenchHoldTimer();
    // Keep the destination visible immediately so the user can choose the
    // titular without having to maintain a drag gesture during the scroll.
    fieldPreviewRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
  };

  const startBenchSwapSelection = () => {
    const start = benchPointerStartRef.current;
    if (!start) return;
    setBenchSwapSourceIndex(start.index);
    setStarterSwapSourceIndex(null);
    setActiveRole(null);
    setSelectedIndex(null);
    // Releasing the long press also produces a click on the reserve card. That
    // click must not reopen its player modal after the shortcut was armed.
    benchHoldClickGuardRef.current = true;
    revealFieldPreview();
  };

  const handleBenchPointerDown = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (isDesktopInput || activeRole) return;
    if (event.button !== 0) return;
    clearBenchHoldTimer();
    benchPointerStartRef.current = { index, x: event.clientX, y: event.clientY };
    // The gesture is intentionally a long press for every input type. It only
    // reveals the field and arms a selection; the next click chooses the target.
    benchHoldTimerRef.current = window.setTimeout(startBenchSwapSelection, 280);
  };

  const handleBenchPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isDesktopInput) return;
    const start = benchPointerStartRef.current;
    if (!start) return;
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance > 12) {
      clearBenchHoldTimer();
      benchPointerStartRef.current = null;
    }
  };

  const handleBenchPointerEnd = () => {
    if (isDesktopInput) return;
    clearBenchHoldTimer();
    benchPointerStartRef.current = null;
    // The long press itself is followed by a synthetic click in browsers.
    // Ignore that one click, then restore normal reserve-card selection.
    if (benchHoldClickGuardRef.current) {
      window.setTimeout(() => { benchHoldClickGuardRef.current = false; }, 0);
    }
  };

  const handleBenchDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (!isDesktopInput) return;
    clearBenchHoldTimer();
    benchPointerStartRef.current = null;
    benchDragClickGuardRef.current = true;
    setBenchDraggingIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    event.dataTransfer.setData('application/x-ucl-player-index', String(index));

    // Use the complete compact card as the native ghost, rather than only the
    // portrait nested inside it.
    const cardElement = event.currentTarget.querySelector<HTMLElement>('[data-player-card="true"]') ?? event.currentTarget;
    const cardRect = cardElement.getBoundingClientRect();
    event.dataTransfer.setDragImage(cardElement, cardRect.width / 2, cardRect.height / 2);
  };

  const handleBenchDragEnd = () => {
    setBenchDraggingIndex(null);
    window.setTimeout(() => { benchDragClickGuardRef.current = false; }, 0);
  };

  const requestPlayerSwap = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= players.length || toIndex < 0 || toIndex >= players.length || fromIndex === toIndex) return;
    if (!players[fromIndex] || !players[toIndex]) return;
    setPendingSwap({ fromIndex, toIndex });
  };

  const startStarterSwapSelection = (index: number) => {
    setStarterSwapSourceIndex(index);
    setBenchSwapSourceIndex(null);
    setActiveRole(null);
    setSelectedIndex(null);
  };

  const activateRoleSelection = (role: GameRole) => {
    const nextRole = activeRole === role ? null : role;
    setActiveRole(nextRole);
    if (nextRole) {
      window.requestAnimationFrame(() => {
        fieldPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };

  const activeRoleLabel = activeRole === 'captain'
    ? 'CAPITÃO'
    : activeRole === 'penalty'
      ? 'BATEDOR DE PÊNALTI'
      : activeRole === 'freeKick'
        ? 'COBRADOR DE FALTA'
        : null;

  const confirmPlayerSwap = () => {
    if (!pendingSwap) return;
    onSwap(pendingSwap.fromIndex, pendingSwap.toIndex);
    setPendingSwap(null);
    setSelectedIndex(null);
  };

  const pendingFromPlayer = pendingSwap ? players[pendingSwap.fromIndex] : null;
  const pendingToPlayer = pendingSwap ? players[pendingSwap.toIndex] : null;
  const pendingTargetRole = pendingSwap ? formationRoles[pendingSwap.toIndex] : undefined;
  const pendingSourceRole = pendingSwap ? formationRoles[pendingSwap.fromIndex] : undefined;
  const pendingIsStarterSwap = pendingSwap ? pendingSwap.fromIndex < 11 : false;

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
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, chemData.total)}%`, background: chemColor }} />
        </div>
        {coach && formation?.id === coach.preferredFormation && (
          <div className="mt-2 w-full flex items-start gap-1.5 px-2 py-1.5 rounded-md text-[11px] leading-snug"
            style={{ background: '#22C55E18', border: '1px solid #22C55E40', color: '#4ADE80', fontFamily: 'Rajdhani, sans-serif' }}>
            <span className="shrink-0" aria-hidden="true">✓</span>
            <span className="min-w-0 break-words">Inclui <b>+{PREFERRED_FORMATION_CHEM_BONUS}</b> da formação preferida do técnico ({coach.name})</span>
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

      {onSetMatchPlan ? (
        <MatchPlanSelector value={matchPlan} playStyle={playStyle} onChange={onSetMatchPlan} />
      ) : null}

      <RolesSelector
        players={rolePlayers}
        captainId={captain}
        penaltyTakerId={penaltyTaker}
        freeKickTakerId={freeKickTaker}
        onSetCaptain={onSetCaptain}
        onSetPenaltyTaker={onSetPenaltyTaker}
        onSetFreeKickTaker={onSetFreeKickTaker}
        onActivateRole={activateRoleSelection}
        activeRole={activeRole}
      />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {formation && (
          <div ref={fieldPreviewRef} className="ui-gesture-surface lg:w-[420px] flex-shrink-0 space-y-2 scroll-mt-6">
            {(benchSwapSourceIndex !== null || starterSwapSourceIndex !== null) && players[benchSwapSourceIndex ?? starterSwapSourceIndex!] && (
              <div
                role="status"
                className="flex items-center gap-3 rounded-xl border border-[#C9A84C66] bg-[#17151B] px-3.5 py-3 text-sm leading-snug"
                style={{ color: '#F4D56A', fontFamily: 'Rajdhani, sans-serif' }}
              >
                <span className="min-w-0 flex-1">
                  {benchSwapSourceIndex !== null
                    ? <>Escolha no campo quem vai sair para entrar <b>{players[benchSwapSourceIndex].shortName}</b>.</>
                    : <>Escolha no campo quem vai trocar com <b>{players[starterSwapSourceIndex!].shortName}</b>.</>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBenchSwapSourceIndex(null);
                    setStarterSwapSourceIndex(null);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#C9A84C66] text-xl font-black text-[#F4D56A] transition-colors hover:bg-[#C9A84A22]"
                  aria-label="Cancelar escolha de substituição"
                  title="Cancelar"
                >
                  ×
                </button>
              </div>
            )}
            {activeRole && (
              <div
                role="status"
                className="mb-2 flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm leading-snug"
                style={{ color: '#F4D56A', background: '#17151B', borderColor: '#C9A84C66', fontFamily: 'Rajdhani, sans-serif' }}
              >
                <span className="min-w-0 flex-1">
                  <b className="block tracking-widest">ESCOLHA O {activeRoleLabel}</b>
                  <span className="mt-1 block text-[13px] text-[#D0CBAE]">Toque em um titular no campo para definir a função.</span>
                  {roleSuggestionId && (() => {
                    const suggestion = rolePlayers.find(player => player.id === roleSuggestionId);
                    const photoUrl = suggestion ? buildSofifaUrl(suggestion.id, 120) : null;
                    return suggestion ? (
                      <span className="mt-2 flex items-center gap-2 text-[13px] text-[#C9A84C]">
                        {photoUrl && <img src={photoUrl} alt="" className="h-10 w-8 rounded object-cover object-top" />}
                        <span>★ Sugestão: <b>{suggestion.shortName}</b></span>
                      </span>
                    ) : null;
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveRole(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#C9A84C66] text-xl font-black text-[#F4D56A] transition-colors hover:bg-[#C9A84A22]"
                  aria-label="Cancelar escolha da função"
                  title="Cancelar"
                >
                  ×
                </button>
              </div>
            )}
            <FormationField
              formation={formation}
              players={xi}
              showPlayerCards
              onPlayerLongPress={startStarterSwapSelection}
              // Reuse the same compact match indicators on the tactical field:
              // suspension (red), injury and accumulated yellows.
              disciplineByPlayer={Object.fromEntries(
                Object.entries(availability ?? {}).map(([playerId, status]) => [playerId, {
                  yellow: status.yellows,
                  red: status.banned > 0,
                  injury: status.injured > 0,
                }]),
              )}
              effectiveStats={effectiveStatsById}
              chemistryScores={chemData.individual}
              showChemLines={!activeRole}
              chemLinks={chemLinks}
              roleSelection={activeRole}
              roleMetrics={roleMetrics}
              roleSuggestionId={roleSuggestionId}
              fieldControls={(
                <div className="flex w-full items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setFieldSettingsPanel('formation')}
                    className="w-fit max-w-[9.75rem] rounded-lg border border-[#C9A84C99] bg-[#080F0AEE] px-2.5 py-1.5 text-left shadow-lg backdrop-blur-sm transition-colors hover:bg-[#1A2A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
                    title="Abrir configurações da formação"
                  >
                    <span className="block text-[10px] font-black tracking-widest text-[#B4B4C4]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>FORMAÇÃO</span>
                    <span className="block max-w-32 truncate text-base font-black text-[#F0D77A]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{formation.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldSettingsPanel('tactic')}
                    className="w-fit max-w-[9.75rem] rounded-lg border border-[#818CF899] bg-[#080F0AEE] px-2.5 py-1.5 text-left shadow-lg backdrop-blur-sm transition-colors hover:bg-[#1A2A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"
                    title="Abrir configurações da tática"
                  >
                    <span className="block text-[10px] font-black tracking-widest text-[#B4B4C4]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>TÁTICA</span>
                    <span className="block max-w-36 truncate text-base font-black text-[#C7D2FE]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{activeTactic.icon} {activeTactic.name}</span>
                  </button>
                </div>
              )}
              selectedPlayerIndex={selectedIndex}
              positionGuidePlayer={benchSwapSourceIndex !== null
                ? players[benchSwapSourceIndex] ?? null
                : starterSwapSourceIndex !== null
                  ? players[starterSwapSourceIndex] ?? null
                : benchDraggingIndex !== null
                  ? players[benchDraggingIndex] ?? null
                  : null}
              onPlayerClick={(_player, posIndex) => {
                if (activeRole) {
                  if (activeRole === 'captain') onSetCaptain(_player.id);
                  if (activeRole === 'penalty') onSetPenaltyTaker(_player.id);
                  if (activeRole === 'freeKick') onSetFreeKickTaker(_player.id);
                  setActiveRole(null);
                  return;
                }
                if (benchSwapSourceIndex !== null) {
                  requestPlayerSwap(benchSwapSourceIndex, posIndex);
                  setBenchSwapSourceIndex(null);
                  return;
                }
                if (starterSwapSourceIndex !== null) {
                  requestPlayerSwap(starterSwapSourceIndex, posIndex);
                  setStarterSwapSourceIndex(null);
                  return;
                }
                setSelectedIndex(posIndex);
              }}
              onPlayerDrop={requestPlayerSwap}
            />
            {!activeRole && (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#8A8A9A' }}>
                <span className="font-bold tracking-wider text-[#6A6A7A]">CONEXÕES:</span>
                {([['club', 'Mesmo clube'], ['nation', 'Mesma nação'], ['coach', 'Mesmo técnico'], ['partner', 'Dupla histórica']] as const).map(([t, label]) => (
                  <span key={t} className="flex items-center gap-1">
                    <span style={{ width: 12, height: 2.5, borderRadius: 2, background: CHEM_LINK_COLOR[t], display: 'inline-block' }} />
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>TITULARES</div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4">
            {xi.map((player, index) => {
              const ab = availBadge(player.id);
              return (
                <div key={player.id} className="relative">
                  <PlayerCard player={player} effectiveStats={effectiveStatsById[player.id]} chemScore={chemData.individual[player.id]} showChemistry compact
                    selected={selectedIndex === index} onClick={() => setSelectedIndex(index)} />
                  {ab && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                    style={{ background: '#0A0A14', color: ab.color, border: `1px solid ${ab.color}88`, fontFamily: 'Rajdhani, sans-serif' }}>{ab.txt}</span>}
                </div>
              );
            })}
          </div>

          <div className="ui-gesture-surface mt-5 pt-4 border-t" style={{ borderColor: '#1A1A2A' }}>
            <div className="text-xs font-black tracking-widest mb-2 flex items-center gap-2" style={{ color: '#818CF8', fontFamily: 'Rajdhani, sans-serif' }}>
              🪑 BANCO / RESERVAS {bench.length > 0 && <span style={{ color: '#6A6A7A' }}>({bench.length})</span>}
            </div>
            {bench.length > 0 ? (
              <>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {bench.map((player, i) => {
                    const ab = availBadge(player.id);
                    return (
                      <div
                        key={player.id}
                        className={`relative cursor-pointer ${isDesktopInput ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        // Let a vertical finger movement scroll the page; the
                        // long press still arms the reserve-to-starter swap.
                        style={{ touchAction: isDesktopInput ? undefined : 'pan-y', opacity: 1 }}
                        draggable={isDesktopInput}
                        onDragStart={event => handleBenchDragStart(event, 11 + i)}
                        onDragEnd={handleBenchDragEnd}
                        onPointerDown={event => handleBenchPointerDown(event, 11 + i)}
                        onPointerMove={handleBenchPointerMove}
                        onPointerUp={handleBenchPointerEnd}
                        onPointerCancel={handleBenchPointerEnd}
                        title={isDesktopInput ? 'Arraste sobre um titular para trocar' : 'Segure para escolher no campo quem será substituído'}
                      >
                        <PlayerCard player={player} effectiveStats={effectiveStatsById[player.id]} compact selected={selectedIndex === 11 + i || benchSwapSourceIndex === 11 + i}
                          onClick={() => {
                            if (activeRole) return;
                            if (benchHoldClickGuardRef.current || benchDragClickGuardRef.current) {
                              benchHoldClickGuardRef.current = false;
                              benchDragClickGuardRef.current = false;
                              return;
                            }
                            setSelectedIndex(11 + i);
                          }} />
                        {ab && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                          style={{ background: '#0A0A14', color: ab.color, border: `1px solid ${ab.color}88`, fontFamily: 'Rajdhani, sans-serif' }}>{ab.txt}</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] mt-2" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                  Segure uma reserva para levar o campo à tela e clique no titular que ela vai substituir.
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

      <Dialog open={fieldSettingsPanel !== null} onOpenChange={open => { if (!open) setFieldSettingsPanel(null); }}>
        <DialogContent
          disableAnimation
          overlayClassName="bg-black/85"
          closeButtonLabel="Fechar configurações do campo"
          closeButtonClassName="right-3 top-3 flex size-10 items-center justify-center rounded-xl bg-[var(--ui-surface-2)] p-0 text-[var(--ui-text)] opacity-100 shadow-md hover:bg-[var(--ui-surface-3)] [&_svg]:size-5"
          className="!left-0 !top-0 !h-dvh !w-screen !max-h-dvh !max-w-none !translate-x-0 !translate-y-0 content-start gap-3 overflow-y-auto rounded-none border-0 bg-[var(--ui-bg-raised)] p-4 text-[var(--ui-text)] shadow-none sm:!left-1/2 sm:!top-1/2 sm:!h-auto sm:!max-h-[min(92dvh,860px)] sm:!w-full sm:!max-w-3xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg sm:border sm:border-[var(--ui-line)] sm:p-6 sm:shadow-2xl"
        >
          <DialogHeader className="gap-1 pr-12 text-left">
            <DialogTitle className="font-display text-2xl tracking-wide text-[var(--ui-brand-strong)] sm:text-3xl">
              {fieldSettingsPanel === 'formation' ? 'FORMAÇÃO' : 'TÁTICA DO TIME'}
            </DialogTitle>
            <p className="text-sm leading-snug text-[var(--ui-text-muted)]">
              {fieldSettingsPanel === 'formation'
                ? 'Escolha o esquema e veja como ele muda o comportamento do time.'
                : 'Escolha a mentalidade que orienta o comportamento do time na partida.'}
            </p>
          </DialogHeader>
          {fieldSettingsPanel === 'formation' ? (
            <FormationSelector value={formationId} onChange={onSetFormation} />
          ) : (
            <TacticSelector value={playStyle} onChange={onSetPlayStyle} />
          )}
        </DialogContent>
      </Dialog>

      {footer}

      {/* Premium Player Modal */}
      <>
        {selectedIndex !== null && selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
            <div
              className="relative min-h-0 bg-[#0b0b14] border border-[#1d1d2f] rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Fundo: textura da carta do jogador (a Única usa a sua própria), com véu leve p/ legibilidade */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0, backgroundImage: `url(${UNIQUE_STYLE[selectedPlayer.id]?.texture ?? cardTexture(selectedPlayer.rarity, getEvolutionLevel(selectedPlayer))})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.95 }} />
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0, background: 'linear-gradient(180deg,rgba(9,9,16,.52),rgba(9,9,16,.6))' }} />

              <div className="relative z-10 flex flex-shrink-0 items-center justify-between border-b px-6 pt-5 pb-4" style={{ borderColor: '#1d1d2f' }}>
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

              {/* 🟨🟥🩹 Disciplina + disponibilidade: resumo completo e independente por status. */}
              {(() => {
                const a = availability?.[selectedPlayer.id] ?? { yellows: 0, banned: 0, injured: 0 };
                const hasActiveStatus = a.yellows > 0 || a.banned > 0 || a.injured > 0;
                return (
                  <div className="relative z-10 flex flex-shrink-0 flex-col gap-3 border-b px-5 py-3 sm:px-6" style={{ borderColor: '#1d1d2f', background: '#12060688' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#D8D8E4' }}>DISCIPLINA E DISPONIBILIDADE</div>
                        <div className="mt-0.5 text-[10px]" style={{ fontFamily: 'Rajdhani, sans-serif', color: hasActiveStatus ? '#B7AFAF' : '#7F8794' }}>
                          {hasActiveStatus ? 'Situação atual do jogador' : 'Nenhuma pendência ativa'}
                        </div>
                      </div>
                      <span className="text-[10px] font-black tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif', color: hasActiveStatus ? '#FCD34D' : '#4ADE80' }}>
                        {hasActiveStatus ? 'ATENÇÃO' : 'REGULAR'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[
                        { icon: '🟨', label: 'AMARELOS', value: a.yellows > 0 ? `${a.yellows} acumulado(s)` : 'Nenhum', color: '#EAB308', active: a.yellows > 0 },
                        { icon: '🟥', label: 'SUSPENSÃO', value: a.banned > 0 ? `${a.banned} jogo(s) fora` : 'Nenhuma', color: '#EF4444', active: a.banned > 0 },
                        { icon: '🩹', label: 'LESÃO', value: a.injured > 0 ? `${a.injured} jogo(s) fora` : 'Nenhuma', color: '#F59E0B', active: a.injured > 0 },
                      ].map(status => (
                        <div key={status.label} className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: status.active ? `${status.color}66` : '#252535', background: status.active ? `${status.color}12` : '#0D0D18' }}>
                          <span className="text-base leading-none" aria-hidden="true">{status.icon}</span>
                          <span className="min-w-0">
                            <span className="block text-[9px] font-black tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif', color: status.active ? status.color : '#777789' }}>{status.label}</span>
                            <span className="block truncate text-[11px] font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: status.active ? '#F4F4FA' : '#777789' }}>{status.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    {a.banned > 0 && (
                      <div className="text-[10px] leading-tight" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#9A9292' }}>
                        A suspensão pode vir de cartão vermelho ou do acúmulo de amarelos; o estado atual registra a punição, não a origem.
                      </div>
                    )}
                    {a.injured > 0 && onHealInjury && (
                      <button disabled={!canAffordPhysio} onClick={() => setConfirmPhysioFor(selectedPlayer.id)}
                        type="button"
                        className="flex w-full flex-shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[11px] font-black tracking-wider whitespace-nowrap disabled:opacity-40 transition-transform active:scale-95"
                        style={{ fontFamily: 'Rajdhani, sans-serif', background: '#0E7490', color: '#ECFEFF', border: '1px solid #22D3EE55' }}
                        title={canAffordPhysio ? undefined : `Faltam créditos (custa ${physioCost})`}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-lg leading-none" aria-hidden="true">🏥</span>
                          <span className="flex flex-col leading-none">
                            <span>FISIOTERAPIA</span>
                            <span className="mt-1 text-[10px] font-bold tracking-wide" style={{ color: '#A5F3FC' }}>−1 JOGO DE LESÃO</span>
                          </span>
                        </span>
                        <span className="flex flex-col items-end rounded-lg px-2 py-1 leading-none" style={{ background: '#083344', color: '#67E8F9' }}>
                          <span className="text-sm font-black tabular-nums">{physioCost}</span>
                          <span className="mt-0.5 text-[9px] tracking-wider">PTS</span>
                        </span>
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
                    <div
                      className="w-full max-w-sm rounded-2xl p-5 text-center" style={{ background: '#0b0b14', border: '1px solid #0E7490' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="text-3xl mb-1">🏥</div>
                      <h3 className="text-lg font-black tracking-widest uppercase mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#67E8F9' }}>Fisioterapia</h3>
                      <p className="text-[13px] mb-1" style={{ color: '#C8D0D4', fontFamily: 'Rajdhani, sans-serif' }}>
                        Reduzir <b style={{ color: '#FFF' }}>1 jogo</b> de lesão de <b style={{ color: '#FFF' }}>{pp.shortName}</b>?
                      </p>
                      <p className="text-[12px] mb-4" style={{ color: '#8A9BA0', fontFamily: 'Rajdhani, sans-serif' }}>
                        Fica <b style={{ color: '#FCD34D' }}>{Math.max(0, inj - 1)} jogo(s)</b> de fora · custa <b style={{ color: '#67E8F9' }}>{physioCost} créditos</b>
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
                    </div>
                  </div>
                );
              })()}

              <div className="relative z-10 min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
                {(() => {
                  const isStarter = selectedIndex < 11;
                  const posIdx = isStarter ? selectedIndex : -1;
                  const formationRole = isStarter ? (formationRoles[posIdx] ?? selectedPlayer.position) : selectedPlayer.position;
                  const eff = getPlayerEffectiveStats(selectedPlayer, selectedChemScore, selectedIsOOP, coachId, chemData.total, playStyle, { captainBoost: isStarter ? captainBoost : undefined, charBoosts, isKnockout, role: formationRole, isSecondary: selectedIsSecondary });
                  const originalOverall = selectedPlayer.baseOverall ?? selectedPlayer.overall;
                  // Card-level variants (Em Alta/Lobo/Mártir/Magnata) are already baked into
                  // selectedPlayer.*. For this breakdown, compare the final effective result
                  // against the untouched base so the user sees one complete delta.
                  const cardVariantDelta = selectedPlayer.baseOverall !== undefined
                    ? selectedPlayer.overall - selectedPlayer.baseOverall
                    : 0;
                  const effectiveOverallDelta = eff.overall - originalOverall;
                  const originalStat = (value: number) => value - cardVariantDelta;
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
                  const traitInfos = (selectedPlayer.traits ?? []).filter(tid => TRAIT_MAP[tid]).map(tid => {
                    const def = TRAIT_MAP[tid];
                    return { id: tid, icon: def?.icon ?? '✨', effect: traitEffectLabel(tid), flavor: def?.flavor ?? '' };
                  });
                  const statRows = [
                    { label: 'RIT', base: originalStat(selectedPlayer.pace), eff: eff.pace },
                    { label: 'FIN', base: originalStat(selectedPlayer.shooting), eff: eff.shooting },
                    { label: 'PAS', base: originalStat(selectedPlayer.passing), eff: eff.passing },
                    { label: 'DRI', base: originalStat(selectedPlayer.dribbling), eff: eff.dribbling },
                    { label: 'DEF', base: originalStat(selectedPlayer.defending), eff: eff.defending },
                    { label: 'FIS', base: originalStat(selectedPlayer.physical), eff: eff.physical },
                    { label: 'VIS', base: originalStat(selectedPlayer.vision), eff: eff.vision },
                    { label: 'CMP', base: originalStat(selectedPlayer.composure), eff: eff.composure },
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
                              <span className="whitespace-nowrap text-[9px] font-black px-2 py-0.5 rounded" style={{ background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B55', fontFamily: 'Rajdhani, sans-serif' }}>🔁 2ª POSIÇÃO · −5%</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xl font-black uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{selectedPlayer.shortName}</div>
                            {getEvolutionLevel(selectedPlayer) > 0 && (
                              <span className="mt-1 inline-flex max-w-full items-center justify-center text-center text-[9px] font-black px-2 py-0.5 rounded leading-none" style={{ background: 'linear-gradient(90deg,#0a7a2f,#22C55E)', color: '#04120a', letterSpacing: '0.06em' }}>⭐ NÍVEL {getEvolutionLevel(selectedPlayer)}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 truncate" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{canonicalClubName(selectedPlayer.club)} · {selectedPlayer.nation}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{eff.overall}</div>
                          {effectiveOverallDelta !== 0 && <div className="text-xs font-bold" style={{ color: effectiveOverallDelta > 0 ? '#22C55E' : '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>({effectiveOverallDelta > 0 ? '+' : ''}{effectiveOverallDelta})</div>}
                          <div className="text-[9px] text-gray-500 mt-0.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>GERAL EFETIVO</div>
                          <div className="mt-1 text-[8px] font-bold leading-tight" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>BASE ORIGINAL {originalOverall}</div>
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

                      <BuffBreakdown eff={eff} chem={isStarter ? chemInfo : undefined} traits={traitInfos} player={selectedPlayer} charBoost={charBoosts[selectedPlayer.id]} isStarter={isStarter} formationRole={isStarter ? formationRole : undefined} />
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

                {/* ⭐ Evolução cumulativa — cada nível libera mais um pacote de 6 pontos */}
                {onSetEvolvePoint && selectedPlayer.rarity !== 'unique' && (() => {
                  const evolutionLevel = getEvolutionLevel(selectedPlayer);
                  const evolved = evolutionLevel > 0;
                  const ep = selectedPlayer.evolvePoints ?? {};
                  const spent = evolvePointsSpent(ep);
                  const unlockedPoints = evolutionLevel * EVOLVE_POINTS;
                  const availablePoints = Math.max(0, unlockedPoints - spent);
                  const apps = selectedPlayer.appearances ?? 0;
                  const nextThreshold = evolutionLevel < 3 ? EVOLVE_LEVEL_THRESHOLDS[evolutionLevel + 1] : null;
                  const progressTarget = nextThreshold ?? EVOLVE_LEVEL_THRESHOLDS[3];
                  const progressCurrent = Math.min(apps, progressTarget);
                  const progressLabel = evolutionLevel < 3 ? `PROGRESSO · NÍVEL ${evolutionLevel} → ${evolutionLevel + 1}` : 'PROGRESSO · NÍVEL 3';
                  const evolutionProgress = (
                    <div className="rounded-lg px-3 py-2.5 mb-3" style={{ background: '#0A0A12', border: '1px solid #1A1A2A' }}>
                      <div className="flex items-center justify-between text-[10px] font-black mb-1.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        <span style={{ color: '#8A8A9A', letterSpacing: '.06em' }}>{progressLabel}</span>
                        <span style={{ color: '#C9C9D5' }}>{progressCurrent}/{progressTarget}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1A1A2A' }}>
                        <div className="h-full rounded-full" style={{ width: `${progressTarget ? progressCurrent / progressTarget * 100 : 100}%`, background: 'linear-gradient(90deg,#0a7a2f,#22C55E)' }} />
                      </div>
                      <div className="text-[9px] mt-1.5 leading-snug" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                        {evolutionLevel < 3
                          ? `Faltam ${Math.max(0, progressTarget - apps)} titularidade${Math.max(0, progressTarget - apps) === 1 ? '' : 's'} para liberar o nível ${evolutionLevel + 1}.`
                          : 'Nível máximo alcançado.'}
                      </div>
                    </div>
                  );
                  return (
                    <div className="rounded-xl overflow-hidden" style={{ background: '#0F0F1A', border: `1px solid ${evolved ? '#22C55E55' : '#1A1A2A'}` }}>
                      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
                        <span className="text-[11px] font-black tracking-widest" style={{ color: evolved ? '#22C55E' : '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>⭐ EVOLUÇÃO · NÍVEL {evolutionLevel}/3</span>
                        {evolved && <span className="text-[11px] font-black" style={{ color: availablePoints > 0 ? '#4ADE80' : '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>{availablePoints > 0 ? `+${availablePoints} DISPONÍVEIS` : `+${spent} APLICADOS`}</span>}
                      </div>
                      {evolved ? (
                        <div className="p-3.5">
                          {evolutionProgress}
                          <div className="text-[10px] mb-2 leading-snug" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                            Cada nível libera <b style={{ color: '#C9C9D5' }}>+{EVOLVE_POINTS}</b>. Você pode colocar todos os pontos no mesmo atributo.
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {EVOLVE_ATTRS.map(a => (
                              <button
                                key={a.key}
                                disabled={availablePoints < EVOLVE_POINTS}
                                onClick={() => onSetEvolvePoint(selectedPlayer.id, a.key, EVOLVE_POINTS)}
                                className="flex items-center justify-center rounded-lg px-3 py-2.5 text-[11px] font-black transition-transform active:scale-[0.98]"
                                style={{
                                  background: (ep[a.key] ?? 0) > 0 ? '#0a2114' : '#0A0A12',
                                  color: (ep[a.key] ?? 0) > 0 ? '#4ADE80' : availablePoints >= EVOLVE_POINTS ? '#C9C9D5' : '#6A6A7A',
                                  border: `1px solid ${(ep[a.key] ?? 0) > 0 ? '#22C55E88' : '#1A1A2A'}`,
                                  cursor: availablePoints >= EVOLVE_POINTS ? 'pointer' : 'default',
                                  fontFamily: 'Rajdhani, sans-serif',
                                }}
                              >
                                <span>{a.label}{(ep[a.key] ?? 0) > 0 ? ` · +${ep[a.key]}` : ''}</span>
                              </button>
                            ))}
                          </div>
                          {nextThreshold !== null && availablePoints === 0 && (
                            <div className="text-[10px] mt-2.5 leading-snug" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                              Nível {evolutionLevel + 1} libera mais <b style={{ color: '#22C55E' }}>+{EVOLVE_POINTS}</b> em {nextThreshold} titularidades.
                            </div>
                          )}
                          {evolutionLevel === 3 && availablePoints === 0 && (
                            <div className="text-[10px] mt-2.5 leading-snug" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                              Evolução máxima alcançada: <b style={{ color: '#22C55E' }}>+{EVOLVE_POINTS * 3}</b> distribuídos.
                            </div>
                          )}
                          {onResetEvolvePoints && spent > 0 && (
                            <button onClick={() => onResetEvolvePoints(selectedPlayer.id)} className="w-full mt-2.5 py-2.5 rounded-lg text-[11px] font-black tracking-wide transition-transform active:scale-[0.98]" style={{ background: '#1A1A2A', color: '#9A9AAA', border: '1px solid #2A2A3A', fontFamily: 'Rajdhani, sans-serif' }}>↺ RESETAR PONTOS</button>
                          )}
                        </div>
                      ) : (
                        <div className="p-3">
                          {evolutionProgress}
                          <div className="text-[10px] leading-snug" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                            Ao liberar cada nível, você recebe mais <b style={{ color: '#22C55E' }}>+{EVOLVE_POINTS}</b> pontos para distribuir.
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
                      const isUnique = !!UNIQUE_STYLE[candidate.id];
                      const photoUrl = UNIQUE_STYLE[candidate.id]?.render ?? buildSofifaUrl(candidate.id, 120);
                      const variants = getCardVariants(candidate);
                      const { fit, role, occupant } = swapFit(candidate, idx);
                      const nativeFit = fit === 'native';
                      const secFit = fit === 'secondary';
                      const fits = nativeFit || secFit;
                      const borderCol = role ? (nativeFit ? '#22C55E66' : secFit ? '#F59E0B66' : '#EF444455') : '#161626';
                      const bgCol = role ? (nativeFit ? '#08120b' : secFit ? '#141008' : '#120a0a') : '#07070f';
                      return (
                        <div key={candidate.id}
                          onClick={() => { onSwap(selectedIndex!, idx); setSelectedIndex(null); }}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border hover:brightness-125 active:scale-[0.98] transition-all"
                          style={{ background: bgCol, borderColor: borderCol }}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]" style={{ border: `1.5px solid ${getRarityColor(candidate.rarity)}` }}>
                            {photoUrl
                              ? <img src={photoUrl} alt={candidate.shortName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} loading={isUnique ? 'eager' : 'lazy'} referrerPolicy="no-referrer" />
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
                                {secFit && <span className="text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: '#3a2708', color: '#F59E0B', border: '1px solid #F59E0B66', fontFamily: 'Rajdhani, sans-serif' }}>🔁 COBRE A VAGA (2ª pos · −5%){starterSel ? '' : ` (${POS_PT[role] ?? role})`}</span>}
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
            </div>

            {/* 🔍 Card do jogador em tela cheia (só pra ver de perto) */}
            {zoomCard && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(3,3,10,0.92)' }} onClick={() => setZoomCard(false)}>
                <button onClick={() => setZoomCard(false)} title="Fechar"
                  className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-2xl font-black text-gray-300 hover:text-white focus:outline-none"
                  style={{ background: '#12121c', border: '1px solid #2E2E42' }}>✕</button>
                <div onClick={e => e.stopPropagation()}>
                  <PlayerCard player={selectedPlayer} effectiveStats={effectiveStatsById[selectedPlayer.id]} scale={1.5} />
                </div>
              </div>
            )}
          </div>
        )}
      </>

      {/* Confirmação da troca rápida — soltar um card nunca altera o elenco sozinho. */}
      {pendingSwap && pendingFromPlayer && pendingToPlayer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPendingSwap(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-swap-title"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#C9A84C66] bg-[#0B0B14] shadow-[0_0_40px_rgba(0,0,0,.55)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="border-b border-[#242436] bg-[#11111D] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C9A84C55] bg-[#C9A84C18] text-xl text-[#E8C84A]" aria-hidden="true">↔</div>
                <div className="min-w-0">
                  <h3 id="quick-swap-title" className="text-lg font-black tracking-widest text-[#E8C84A]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    {pendingIsStarterSwap ? 'CONFIRMAR TROCA DE POSIÇÃO' : 'CONFIRMAR ENTRADA NO TIME'}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#9A9AAA]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    Confira o movimento antes de aplicar ao elenco.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 px-5 py-4" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              <div className="rounded-xl border border-[#22C55E44] bg-[#22C55E0D] px-3 py-2.5">
                <div className="text-[10px] font-black tracking-widest text-[#4ADE80]">{pendingIsStarterSwap ? 'VAI PARA A POSIÇÃO' : 'ENTRA EM CAMPO'}</div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm font-bold text-white">
                  <span className="truncate">{pendingFromPlayer.shortName}</span>
                  <span className="shrink-0 text-xs text-[#86EFAC]">→ {POS_PT[pendingTargetRole ?? ''] ?? pendingTargetRole ?? 'TITULAR'}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[#F59E0B44] bg-[#F59E0B0D] px-3 py-2.5">
                <div className="text-[10px] font-black tracking-widest text-[#FBBF24]">{pendingIsStarterSwap ? 'TROCA DE POSIÇÃO' : 'SAI DA VAGA'}</div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm font-bold text-white">
                  <span className="truncate">{pendingToPlayer.shortName}</span>
                  <span className="shrink-0 text-xs text-[#FCD34D]">→ {pendingIsStarterSwap ? (POS_PT[pendingSourceRole ?? ''] ?? pendingSourceRole ?? 'TITULAR') : 'BANCO'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-[#242436] px-5 py-4">
              <button type="button" onClick={() => setPendingSwap(null)} className="flex-1 rounded-xl border border-[#2E2E42] bg-[#17171F] py-2.5 text-xs font-black tracking-widest text-[#A9A9B8] transition-colors hover:bg-[#222230] hover:text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                CANCELAR
              </button>
              <button type="button" onClick={confirmPlayerSwap} className="flex-1 rounded-xl border border-[#C9A84C] bg-[#C9A84C] py-2.5 text-xs font-black tracking-widest text-[#090910] transition-colors hover:bg-[#E8C84A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}
