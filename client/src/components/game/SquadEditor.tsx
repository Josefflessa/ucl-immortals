// UCL Immortals — SquadEditor
// THE single source of truth for the squad-editing UI, shared by the post-draft "Revisão do
// elenco" screen AND the in-league "MEU TIME" tab. Both used to be near-duplicates; now any
// change here shows up in both. It's purely presentational: data + callbacks come from props,
// so each host wires its own state (drafted players vs the league team) and actions.
import TacticIcon from './TacticIcon';
import TraitIcon from './TraitIcon';
import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { FORMATIONS, COACHES, HISTORICAL_TRIOS, getRarityColor, getTacticById, PLAYER_SPECIALIZATIONS, Player, POS_PT, effectiveSecondaries, type PlayerSpecialization } from '@shared/game/gameData';
import {
  calculateChemistry, getPlayerEffectiveStats, getChemistryLinks, getEvolutionLevel,
  MAX_RESERVE_PLAYERS,
  PREFERRED_FORMATION_CHEM_BONUS, PILAR_CHEM_BONUS, LOBO_CHEM_PENALTY, MARTIR_TARGET_BOOST, PADRINHO_AFILHADO_BOOST, captainBoostFromStarters,
  computeCharacteristicBoosts, evolvePointsSpent, evolvePointsBudget, EVOLVE_LEVEL_THRESHOLDS, EVOLVE_POINTS, SPECIALIZATION_LEVEL, SPECIALIZATION_UNLOCK_COST, positionFit, type EffectiveStats,
} from '@shared/game/gameEngine';
import { type AttrKey } from '@shared/game/traits';
import type { MatchPlan } from '@shared/game/gameEngine';
import FormationField, { CHEM_LINK_COLOR } from './FormationField';
import CoachStadiumPanel from './CoachStadiumPanel';
import { stadiumFor } from '@shared/game/stadium';
import PlayerCard, { cardTexture, UNIQUE_STYLE, getCardVariants } from './PlayerCard';
import PlayerPortrait from './PlayerPortrait';
import RolesSelector, { roleMetricFor, suggestedRoleId, type GameRole, type RoleablePlayer } from './RolesSelector';
import TacticSelector from './TacticSelector';
import MatchPlanSelector from './MatchPlanSelector';
import FormationSelector from './FormationSelector';
import ChemistryBonusInfo from './ChemistryBonusInfo';
import PlayerSheet from './player-sheet/PlayerSheet';
import { buildPlayerSheet } from './player-sheet/playerSheetModel';
import { squadEffectiveStats } from '../../lib/squadEffectiveStats';
import { GameModal } from '../../design-system';

interface SquadEditorProps {
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
  onSetPadrinhoTarget?: (playerId: string, targetId: string) => void; // 🤵 pick the godchild ("" = automatic)
  showCoachCard?: boolean;           // the manager card (default on)
  footer?: React.ReactNode;          // host-specific action (e.g. "INICIAR DRAFT")
  isKnockout?: boolean;              // 🍿 phase: drives the Pipoqueiro league(+)/knockout(−) preview
  // 🟨🟥🩹 Disponibilidade (suspensão/lesão/amarelos) por playerId + ação de fisioterapia.
  availability?: Record<string, { yellows: number; banned: number; injured: number }>;
  onHealInjury?: (playerId: string) => void;
  canAffordPhysio?: boolean;
  physioFree?: boolean;
  physioCost?: number;               // 🏥 custo da fisioterapia (mostrado no botão + confirmação)
  // ⭐ Técnico Prime (Fase 2): evolução via critério + pontos (só no MEU TIME).
  coachPrime?: boolean;
  points?: number;
  analysisLevel?: number;            // 🔎 Núcleo de Análise: progressão de formação/tática.
  stadiumProjectLevel?: number;      // 🏟️ Nível 5 usa a imagem do estádio Prime.
  wins?: number;
  onEvolvePrime?: () => void;
  // ⭐ Cartas Evoluídas: cada nível libera 6 pontos para distribuir (só no MEU TIME).
  onSetEvolvePoint?: (playerId: string, attr: AttrKey, delta: number) => void;
  onSetAutoEvolveAttribute?: (playerId: string, attr: AttrKey | null) => void;
  onUnlockSpecialization?: (playerId: string) => void;
  onChooseSpecialization?: (playerId: string, specialization: PlayerSpecialization) => void;
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
  onSetFormation, onSetPlayStyle, onSetMatchPlan, onSetCaptain, onSetPenaltyTaker, onSetFreeKickTaker, onSwap, onSetMartirTargets, onSetPadrinhoTarget,
  showCoachCard = true, footer, isKnockout = false,
  availability, onHealInjury, canAffordPhysio, physioFree = false, physioCost = 150,
  coachPrime, points, analysisLevel = 1, stadiumProjectLevel = 1, wins, onEvolvePrime,
  onSetEvolvePoint, onSetAutoEvolveAttribute, onUnlockSpecialization, onChooseSpecialization, onResetEvolvePoints,
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
  const [fieldSettingsPanel, setFieldSettingsPanel] = useState<'formation' | 'tactic' | 'coach' | null>(null);
  const fieldPreviewRef = useRef<HTMLDivElement>(null);
  const benchHoldTimerRef = useRef<number | null>(null);
  const benchHoldClickGuardRef = useRef(false);
  const benchSwapRevealPendingRef = useRef(false);
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
  const disciplineChips = (playerId: string) => {
    const a = availability?.[playerId];
    if (!a) return [];
    return [
      ...(a.yellows > 0 ? [{ key: 'yellow', label: `🟨 ${a.yellows}`, title: `${a.yellows} cartão${a.yellows === 1 ? '' : 'ões'} amarelo${a.yellows === 1 ? '' : 's'}`, color: '#EAB308' }] : []),
      ...(a.banned > 0 ? [{ key: 'banned', label: `🟥 ${a.banned}J`, title: `Suspenso por ${a.banned} jogo${a.banned === 1 ? '' : 's'}`, color: '#EF4444' }] : []),
      ...(a.injured > 0 ? [{ key: 'injured', label: `🩹 ${a.injured}J`, title: `Lesionado por ${a.injured} jogo${a.injured === 1 ? '' : 's'}`, color: '#F59E0B' }] : []),
    ];
  };

  const formation = FORMATIONS.find(f => f.id === formationId);
  const activeTactic = getTacticById(playStyle);
  const coach = COACHES.find(c => c.id === coachId);
  const coachStadium = stadiumFor(coachId, !!coachPrime);
  const coachDisplayPhoto = coachPrime && coachStadium.coachPhotoUrl ? coachStadium.coachPhotoUrl : coach?.photoUrl;
  // These calculations are shared by the field, player cards and detail modal.
  // Keep them stable while the user only changes the selected card; this avoids
  // recalculating the whole squad just to open/close or browse the modal.
  const xi = useMemo(() => players.slice(0, 11), [players]);
  const bench = useMemo(() => players.slice(11), [players]);
  const formationRoles = useMemo(() => formation?.positions.map(p => p.role) ?? [], [formation]);
  const chemData = useMemo(() => calculateChemistry(xi, coachId, formationRoles, formationId), [xi, coachId, formationRoles, formationId]);
  const chemLinks = useMemo(() => getChemistryLinks(xi, coachId), [xi, coachId]);
  const captainBoost = useMemo(() => captainBoostFromStarters(xi, captain ?? undefined) ?? undefined, [xi, captain]);
  const charBoosts = useMemo(() => computeCharacteristicBoosts(players), [players]); // 🩸❤️🪑 team-effect characteristics

  // A química usa o verde como identidade visual fixa nesta síntese do elenco;
  // o valor continua indicando o nível real, sem mudar o cálculo.
  const chemColor = '#22C55E';
  const activeTrios = useMemo(() => chemData.trios.map(id => HISTORICAL_TRIOS.find(t => t.id === id)).filter(Boolean), [chemData.trios]);

  const teamOverall = useMemo(() => xi.length === 11
    ? Math.round(xi.reduce((sum, p, idx) => {
      const eff = getPlayerEffectiveStats(p, chemData.individual[p.id] ?? 0, chemData.outOfPosition[p.id] ?? false, coachId, chemData.total, playStyle, { captainBoost, charBoosts, isKnockout, coachPrime, analysisLevel, role: formationRoles[idx] ?? p.position, isSecondary: chemData.secondaryPos[p.id] ?? false, credits: points });
      return sum + eff.overall;
    }, 0) / 11)
    : null, [xi, chemData, coachId, playStyle, captainBoost, charBoosts, isKnockout, coachPrime, analysisLevel, formationRoles, points]);

  // Meu Time is the only card context that renders effective values. Draft, shop and
  // reinforcement pickers omit this map and therefore keep the card's own values.
  const effectiveStatsById: Record<string, EffectiveStats> = useMemo(() => squadEffectiveStats({
    players, coachId, formationId, playStyle, captain, isKnockout, coachPrime, analysisLevel, credits: points,
  }), [players, coachId, formationId, playStyle, captain, isKnockout, coachPrime, analysisLevel, points]);

  const rolePlayers: RoleablePlayer[] = useMemo(() => xi.map(player => ({
    ...player,
    effectiveOverall: effectiveStatsById[player.id]?.overall,
    effectiveStats: effectiveStatsById[player.id],
  })), [xi, effectiveStatsById]);
  const roleMetrics = useMemo(() => activeRole
    ? Object.fromEntries(rolePlayers.map(player => [player.id, roleMetricFor(player, activeRole)]))
    : {}, [activeRole, rolePlayers]);
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
  // The sheet (numbers, sources, explanations) comes from the same model as the report modal.
  const selectedSheet = useMemo(() => (selectedPlayer && selectedIndex !== null ? buildPlayerSheet({
    player: selectedPlayer,
    players,
    index: selectedIndex,
    coachId,
    formationId,
    playStyle,
    captainId: captain,
    isKnockout,
    coachPrime,
    analysisLevel,
    stadiumProjectLevel,
    credits: points,
  }) : null), [selectedPlayer, selectedIndex, players, coachId, formationId, playStyle, captain, isKnockout, coachPrime, analysisLevel, stadiumProjectLevel, points]);

  const clearBenchHoldTimer = () => {
    if (benchHoldTimerRef.current !== null) {
      window.clearTimeout(benchHoldTimerRef.current);
      benchHoldTimerRef.current = null;
    }
  };

  const revealFieldPreview = () => {
    clearBenchHoldTimer();
    // Scroll only after the reserve touch is released. Scrolling while the
    // pointer is still down can retarget its synthetic click to a field card.
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
    benchSwapRevealPendingRef.current = true;
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
    if (benchSwapRevealPendingRef.current) {
      benchSwapRevealPendingRef.current = false;
      window.requestAnimationFrame(revealFieldPreview);
    }
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
      {/* Desktop: chemistry beside plan + roles (same height), then formation, tactic and
          coach in one full-width row. Mobile keeps the stack. */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
      <div className="space-y-4">
      {/* Team overall + chemistry summary */}
      <div className="rounded-xl p-4 lg:h-full" style={{ background: '#0F0F1A', border: `1px solid ${chemColor}44` }}>
        {teamOverall !== null && (
          <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--ui-surface-3)' }}>
            <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FFF' }}>OVERALL DO TIME</span>
            <span className="text-2xl font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand-strong)' }}>{teamOverall}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FFF' }}>QUÍMICA DO TIME</span>
          <span className="text-2xl font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: chemColor }}>{chemData.total}</span>
        </div>
        <div className="h-2 rounded-full" style={{ background: 'var(--ui-surface-3)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, chemData.total)}%`, background: chemColor }} />
        </div>
        {coach && formation?.id === coach.preferredFormation && (
          <div className="mt-2 w-full flex items-start gap-1.5 px-2 py-1.5 rounded-md text-[13px] leading-snug"
            style={{ background: '#22C55E18', border: '1px solid #22C55E40', color: '#4ADE80', fontFamily: 'var(--font-game), sans-serif' }}>
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
                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13px]"
                  style={{ background: '#22C55E18', border: '1px solid #22C55E40', color: '#4ADE80', fontFamily: 'var(--font-game), sans-serif' }}>
                  <TraitIcon trait="pilar" fallback="🧱" size={18} /> {p.shortName} <b>+{PILAR_CHEM_BONUS}</b> química geral
                </span>
              ))}
              {lobos.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13px]"
                  style={{ background: '#EF444418', border: '1px solid #EF444440', color: '#FCA5A5', fontFamily: 'var(--font-game), sans-serif' }}>
                  <TraitIcon trait="lobo" fallback="🐺" size={18} /> {p.shortName} <b>−{LOBO_CHEM_PENALTY}</b> química geral
                </span>
              ))}
            </div>
          );
        })()}
        {activeTrios.length > 0 && (
          <div className="mt-3 text-xs" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>
            ⭐ {activeTrios.map(t => t?.name).join(' · ')}
          </div>
        )}
        <ChemistryBonusInfo total={chemData.total} />
      </div>
      </div>

      <div className="space-y-4">

      {onSetMatchPlan ? (
        <MatchPlanSelector value={matchPlan} playStyle={playStyle} onChange={onSetMatchPlan} />
      ) : null}

      <RolesSelector
        players={rolePlayers}
        captainId={captain}
        penaltyTakerId={penaltyTaker}
        freeKickTakerId={freeKickTaker}
        onActivateRole={activateRoleSelection}
        activeRole={activeRole}
      />

      </div>

      {/* Controles rápidos do campo: formação e tática em cima, técnico abaixo,
          todos fora da área jogável para nunca cobrir as cartas. */}
      <div className="mt-3 w-full space-y-2 lg:col-span-2 lg:mt-0 lg:grid lg:grid-cols-3 lg:gap-2 lg:space-y-0" onPointerDown={event => event.stopPropagation()}>
        <div className="grid w-full grid-cols-2 gap-2 lg:col-span-2">
          <button
            type="button"
            onClick={() => setFieldSettingsPanel('formation')}
            className="flex min-h-[60px] min-w-0 flex-col justify-center rounded-lg border border-primary/60 bg-[#080F0AEE] px-2 py-2 text-left shadow-lg backdrop-blur-sm transition-colors hover:bg-[#1A2A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Abrir configurações da formação"
          >
            <span className="block truncate text-[12px] font-black tracking-widest text-[#B4B4C4]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>FORMAÇÃO</span>
            <span className="block truncate text-base font-black leading-none text-[#F0D77A] sm:text-[17px]" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{formation?.name ?? formationId}</span>
          </button>
          <button
            type="button"
            onClick={() => setFieldSettingsPanel('tactic')}
            className="flex min-h-[60px] min-w-0 flex-col justify-center rounded-lg border border-[#818CF899] bg-[#080F0AEE] px-2 py-2 text-left shadow-lg backdrop-blur-sm transition-colors hover:bg-[#1A2A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"
            title="Abrir configurações da tática"
          >
            <span className="block truncate text-[12px] font-black tracking-widest text-[#B4B4C4]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>TÁTICA</span>
            <span className="flex min-w-0 items-center gap-1.5 text-base font-black leading-none text-[#C7D2FE] sm:text-[17px]" style={{ fontFamily: 'var(--font-display), sans-serif' }}><TacticIcon tactic={activeTactic.id} fallback={activeTactic.icon} size={28} /><span className="truncate">{activeTactic.name}</span></span>
          </button>
        </div>
        {coach && showCoachCard && (
          <div className="flex w-full">
            <button
              type="button"
              onClick={() => setFieldSettingsPanel('coach')}
              className="group flex min-h-[76px] w-full min-w-0 items-center gap-2 rounded-lg border border-primary/60 bg-[#080F0AF2] px-2 py-2 text-left shadow-lg backdrop-blur-sm transition-colors hover:border-[#F0D77A] hover:bg-[#122016] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Abrir informações do técnico e estádio"
            >
              <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-primary/60 bg-[#15151F] sm:h-16 sm:w-16">
                {coachDisplayPhoto ? (
                  <img
                    src={coachDisplayPhoto}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm">🎓</span>
                )}
                {coachPrime && <span className="absolute bottom-0 right-0 rounded-tl-md bg-brand-strong px-0.5 text-[12px] font-black leading-3 text-[#17120A]">★</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black tracking-[0.12em] text-[#B4B4C4]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>TÉCNICO{coachPrime ? ' · PRIME' : ''}</span>
                <span className="block truncate text-[17px] font-black leading-none text-[#F0D77A] sm:text-lg" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{coach.name}</span>
              </span>
            </button>
          </div>
        )}
      </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {formation && (
          <div ref={fieldPreviewRef} className="ui-gesture-surface lg:w-[420px] flex-shrink-0 space-y-2 scroll-mt-6">
            {(benchSwapSourceIndex !== null || starterSwapSourceIndex !== null) && players[benchSwapSourceIndex ?? starterSwapSourceIndex!] && (
              <div
                role="status"
                className="flex items-center gap-3 rounded-xl border border-primary/40 bg-[#17151B] px-3.5 py-3 text-sm leading-snug"
                style={{ color: '#F4D56A', fontFamily: 'var(--font-game), sans-serif' }}
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xl font-black text-[#F4D56A] transition-colors hover:bg-[#C9A84A22]"
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
                style={{ color: '#F4D56A', background: '#17151B', borderColor: '#C9A84C66', fontFamily: 'var(--font-game), sans-serif' }}
              >
                <span className="min-w-0 flex-1">
                  <b className="block tracking-widest">ESCOLHA O {activeRoleLabel}</b>
                  <span className="mt-1 block text-[13px] text-[#D0CBAE]">Toque em um titular no campo para definir a função.</span>
                  {roleSuggestionId && (() => {
                    const suggestion = xi.find(player => player.id === roleSuggestionId);
                    return suggestion ? (
                      <span className="mt-2 flex items-center gap-2 text-[13px] text-primary">
                        <span className="h-10 w-8 shrink-0 overflow-hidden rounded bg-[#10101d]">
                          <PlayerPortrait
                            playerId={suggestion.id}
                            photoUrl={suggestion.photoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{ objectPosition: 'center top' }}
                          />
                        </span>
                        <span>★ Sugestão: <b>{suggestion.shortName}</b></span>
                      </span>
                    ) : null;
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveRole(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xl font-black text-[#F4D56A] transition-colors hover:bg-[#C9A84A22]"
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
              showChemLines={!activeRole}
              chemLinks={chemLinks}
              roleSelection={activeRole}
              roleMetrics={roleMetrics}
              roleSuggestionId={roleSuggestionId}
              selectedPlayerIndex={selectedIndex}
              positionGuidePlayer={benchSwapSourceIndex !== null
                ? players[benchSwapSourceIndex] ?? null
                : starterSwapSourceIndex !== null
                  ? players[starterSwapSourceIndex] ?? null
                : benchDraggingIndex !== null
                  ? players[benchDraggingIndex] ?? null
                  : null}
              onPlayerClick={(_player, posIndex) => {
                // The synthetic click from a reserve long-press may land on
                // a field card if the page scrolls during that same gesture.
                // Consume it without treating it as the user's target choice.
                if (benchHoldClickGuardRef.current) {
                  benchHoldClickGuardRef.current = false;
                  return;
                }
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
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px]" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#8A8A9A' }}>
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
          <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#FFF', fontFamily: 'var(--font-game), sans-serif' }}>TITULARES</div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4">
            {xi.map((player, index) => {
              const ab = availBadge(player.id);
              return (
                <div key={player.id} className="relative">
                  <PlayerCard player={player} effectiveStats={effectiveStatsById[player.id]} chemScore={chemData.individual[player.id]} showChemistry compact
                    selected={selectedIndex === index} onClick={() => setSelectedIndex(index)} />
                  {ab && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[12px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                    style={{ background: '#0A0A14', color: ab.color, border: `1px solid ${ab.color}88`, fontFamily: 'var(--font-game), sans-serif' }}>{ab.txt}</span>}
                </div>
              );
            })}
          </div>

          <div className="ui-gesture-surface mt-5 pt-4 border-t" style={{ borderColor: 'var(--ui-surface-3)' }}>
            <div className="text-xs font-black tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--ui-info)', fontFamily: 'var(--font-game), sans-serif' }}>
              🪑 BANCO / RESERVAS <span style={{ color: bench.length > MAX_RESERVE_PLAYERS ? '#FCA5A5' : 'var(--ui-text-faint)' }}>({bench.length}/{MAX_RESERVE_PLAYERS})</span>
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
                        {ab && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[12px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap z-10"
                          style={{ background: '#0A0A14', color: ab.color, border: `1px solid ${ab.color}88`, fontFamily: 'var(--font-game), sans-serif' }}>{ab.txt}</span>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[13px] mt-2" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                  Segure uma reserva para levar o campo à tela e clique no titular que ela vai substituir.
                </p>
              </>
            ) : (
              <p className="text-[13px]" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                Sem reservas ainda. Você ganha uma <b style={{ color: 'var(--ui-brand-strong)' }}>oferta de recrutamento ao fim de cada rodada</b> — as contratações aparecem aqui no banco.
              </p>
            )}
          </div>
        </div>
      </div>

      <GameModal
        open={fieldSettingsPanel !== null}
        onOpenChange={open => { if (!open) setFieldSettingsPanel(null); }}
        size="wide"
        title={fieldSettingsPanel === 'formation' ? 'FORMAÇÃO' : fieldSettingsPanel === 'tactic' ? 'TÁTICA DO TIME' : 'TÉCNICO'}
        subtitle={
          fieldSettingsPanel === 'formation'
            ? 'Escolha o esquema e veja como ele muda o comportamento do time.'
            : fieldSettingsPanel === 'tactic'
              ? 'Escolha a mentalidade que orienta o comportamento do time na partida.'
              : 'Confira o técnico e os efeitos ativos do seu time.'
        }
        closeLabel="Fechar configurações do campo"
        className="!h-dvh !w-screen !max-h-dvh !max-w-none rounded-none border-0 sm:!h-auto sm:!max-h-[min(92dvh,860px)] sm:!w-full sm:!max-w-3xl sm:rounded-[var(--ui-radius-xl)] sm:border"
        bodyClassName="overflow-x-hidden"
      >
        {fieldSettingsPanel === 'formation' ? (
          <FormationSelector value={formationId} onChange={onSetFormation} analysisLevel={analysisLevel} />
        ) : fieldSettingsPanel === 'tactic' ? (
          <TacticSelector value={playStyle} onChange={onSetPlayStyle} analysisLevel={analysisLevel} />
        ) : coach ? (
          <CoachStadiumPanel
            coach={coach}
            formation={formation}
            coachPrime={!!coachPrime}
            stadiumProjectLevel={stadiumProjectLevel}
            wins={wins}
            points={points}
            onEvolve={onEvolvePrime}
          />
        ) : null}
      </GameModal>

      {footer}

      {/* Player sheet + management (swap, evolution, Mártir, physio) */}
      <>
        {selectedIndex !== null && selectedPlayer && selectedSheet && (
          <GameModal
            open
            onOpenChange={open => { if (!open) setSelectedIndex(null); }}
            size="wide"
            className="lg:w-[min(100%,1180px)]"
            title="FICHA DO JOGADOR"
            subtitle={<><span className="font-extrabold text-primary">{selectedPlayer.shortName}</span> · {selectedSheet.isStarter ? `titular · ${POS_PT[selectedSheet.formationRole] ?? selectedSheet.formationRole}` : 'reserva'}</>}
            headerExtra={
              <button onClick={() => setZoomCard(true)} title="Ver card em tela cheia" aria-label="Ver card ampliado"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors hover:bg-white/10"
                style={{ border: '1px solid #2E2E42', color: '#C9C9D5' }}>🔍</button>
            }
            footer={
              <button onClick={() => setSelectedIndex(null)}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-black text-gray-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
                style={{ fontFamily: 'var(--font-game), sans-serif', border: '1px solid #2E2E42' }}>FECHAR</button>
            }
            bodyClassName="relative !p-0"
            bodyStyle={{
              backgroundColor: '#090910',
              backgroundImage: `linear-gradient(180deg,rgba(9,9,16,.48),rgba(9,9,16,.66)),url(${UNIQUE_STYLE[selectedPlayer.id]?.texture ?? cardTexture(selectedPlayer.rarity, getEvolutionLevel(selectedPlayer), selectedPlayer.specialization)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
              backgroundAttachment: 'scroll',
            }}
          >
            <div className="relative z-10 space-y-5 p-[18px]">
              {/* 🟨🟥🩹 Faixa compacta de disponibilidade — só aparece quando o jogador tem alguma pendência. */}
              {(() => {
                const a = availability?.[selectedPlayer.id];
                if (!a || (a.banned === 0 && a.injured === 0 && a.yellows === 0)) return null;
                return (
                  <div className="flex flex-col items-stretch gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#1d1d2f', background: '#12060688' }}>
                    <div className="min-w-0 text-xs font-bold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: a.banned > 0 ? '#FCA5A5' : a.injured > 0 ? '#FCD34D' : 'var(--ui-warning)' }}>
                      {a.banned > 0 ? `🟥 Suspenso — fora de ${a.banned} jogo(s)` : a.injured > 0 ? `🩹 Lesionado — fora de ${a.injured} jogo(s)` : `🟨 ${a.yellows} amarelo(s) acumulado(s)`}
                    </div>
                    {a.injured > 0 && onHealInjury && (
                      <button disabled={!canAffordPhysio} onClick={() => setConfirmPhysioFor(selectedPlayer.id)}
                        type="button"
                        className="flex w-full flex-shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-black tracking-wider whitespace-nowrap disabled:opacity-40 transition-transform active:scale-95 sm:w-auto"
                        style={{ fontFamily: 'var(--font-game), sans-serif', background: '#0E7490', color: '#ECFEFF', border: '1px solid #22D3EE55' }}
                        title={canAffordPhysio ? undefined : `Faltam créditos (custa ${physioCost})`}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-lg leading-none" aria-hidden="true">🏥</span>
                          <span className="flex flex-col leading-none">
                            <span>FISIOTERAPIA</span>
                            <span className="mt-1 text-[12px] font-bold tracking-wide" style={{ color: '#A5F3FC' }}>−1 JOGO DE LESÃO</span>
                          </span>
                        </span>
                        <span className="flex flex-col items-end rounded-lg px-2.5 py-2 leading-none" style={{ background: '#083344', color: '#67E8F9' }}>
                          <span className="text-sm font-black tabular-nums">{physioFree ? 'GRÁTIS' : physioCost}</span>
                          {!physioFree && <span className="mt-0.5 text-[12px] tracking-wider">CRÉDITOS</span>}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}


              {/* Desktop: the sheet on the left (kept in view), the actions on the right. */}
              <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-5 lg:space-y-0">
                <div className="lg:sticky lg:top-0">
                  <PlayerSheet model={selectedSheet} collapsibleBreakdown />
                </div>
                <div className="min-w-0 space-y-5">
                {/* 🩸 Mártir — pick the 2 XI teammates who get +5 (in-league only; post-draft uses auto). */}
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
                      <div className="text-[13px] font-black tracking-widest" style={{ color: '#F87171', fontFamily: 'var(--font-game), sans-serif' }}>🩸 SACRIFÍCIO DO MÁRTIR</div>
                      <p className="text-[13px] mt-0.5 leading-snug" style={{ color: 'var(--ui-text-muted)', fontFamily: 'var(--font-game), sans-serif' }}>
                        Escolha até <b style={{ color: '#fff' }}>2 titulares</b> que recebem <b style={{ color: '#F87171' }}>+{MARTIR_TARGET_BOOST} em todos os atributos</b>.
                        {current.length < 2 && <> Sem escolher, vai automático pros 2 de maior overall.</>}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {others.map(o => {
                          const sel = current.includes(o.id);
                          return (
                            <button key={o.id} onClick={() => toggle(o.id)}
                              className="text-[13px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95"
                              style={{ background: sel ? '#B91C1C33' : '#07070f', color: sel ? '#F87171' : '#9A9AAA', border: `1px solid ${sel ? '#B91C1C' : '#1A1A2A'}`, fontFamily: 'var(--font-game), sans-serif' }}>
                              {sel ? '✓ ' : ''}{o.shortName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 🤵 Padrinho — escolhe o afilhado (um titular) que recebe +3 em tudo. */}
                {selectedPlayer.padrinho && onSetPadrinhoTarget && selectedIndex < 11 && (() => {
                  const others = players.slice(0, 11).filter(p => p.id !== selectedPlayer.id);
                  const chosen = others.some(o => o.id === selectedPlayer.padrinhoTarget) ? selectedPlayer.padrinhoTarget : undefined;
                  const effective = selectedSheet?.godchild?.id;
                  return (
                    <div className="rounded-xl p-3" style={{ background: '#120c1f', border: '1px solid #C4B5FD44' }}>
                      <div className="text-[13px] font-black tracking-widest" style={{ color: '#C4B5FD', fontFamily: 'var(--font-game), sans-serif' }}>🤵 AFILHADO DO PADRINHO</div>
                      <p className="text-[13px] mt-0.5 leading-snug" style={{ color: 'var(--ui-text-muted)', fontFamily: 'var(--font-game), sans-serif' }}>
                        Escolha <b style={{ color: '#fff' }}>1 titular</b> que recebe <b style={{ color: '#C4B5FD' }}>+{PADRINHO_AFILHADO_BOOST} em todos os atributos</b>. Cada gol dele dá +1 permanente ao Padrinho.
                        {!chosen && <> Sem escolher, vai automático para o titular de maior geral.</>}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {others.map(o => {
                          const sel = o.id === effective;
                          return (
                            <button key={o.id} onClick={() => onSetPadrinhoTarget(selectedPlayer.id, o.id === chosen ? '' : o.id)}
                              className="text-[13px] font-bold px-2 py-1 rounded-lg transition-all active:scale-95"
                              style={{ background: sel ? '#C4B5FD26' : '#07070f', color: sel ? '#C4B5FD' : '#9A9AAA', border: `1px solid ${sel ? '#C4B5FD' : '#1A1A2A'}`, fontFamily: 'var(--font-game), sans-serif' }}>
                              {sel ? '✓ ' : ''}{o.shortName}{sel && !chosen ? ' (auto)' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ⭐ Evolução cumulativa — nível 4 escolhe uma especialização Imortal */}
                {(onSetEvolvePoint || onSetAutoEvolveAttribute) && selectedPlayer.rarity !== 'unique' && (() => {
                  const evolutionLevel = getEvolutionLevel(selectedPlayer);
                  const evolved = evolutionLevel > 0;
                  const ep = selectedPlayer.evolvePoints ?? {};
                  const spent = evolvePointsSpent(ep);
                  const unlockedPoints = evolvePointsBudget(evolutionLevel);
                  const availablePoints = Math.max(0, unlockedPoints - spent);
                  const hasFutureEvolveLevel = evolutionLevel < 3;
                  const apps = selectedPlayer.appearances ?? 0;
                  const maxLevel = selectedPlayer.rarity === 'immortal' ? SPECIALIZATION_LEVEL : 3;
                  const needsSpecializationUnlock = selectedPlayer.rarity === 'immortal'
                    && evolutionLevel === 3
                    && selectedPlayer.specializationUnlocked !== true;
                  const nextThreshold = evolutionLevel < maxLevel ? EVOLVE_LEVEL_THRESHOLDS[evolutionLevel + 1] : null;
                  const progressTarget = needsSpecializationUnlock
                    ? EVOLVE_LEVEL_THRESHOLDS[3]
                    : nextThreshold ?? EVOLVE_LEVEL_THRESHOLDS[maxLevel];
                  const progressCurrent = Math.min(apps, progressTarget);
                  const progressLabel = evolutionLevel < maxLevel ? `PROGRESSO · NÍVEL ${evolutionLevel} → ${evolutionLevel + 1}` : `PROGRESSO · NÍVEL ${maxLevel}`;
                  const specializationEntries = (Object.keys(PLAYER_SPECIALIZATIONS) as PlayerSpecialization[]).map(id => [id, PLAYER_SPECIALIZATIONS[id]] as const);
                  const evolutionProgress = (
                    <div className="rounded-lg px-3 py-2.5 mb-3" style={{ background: '#0A0A12', border: '1px solid var(--ui-surface-3)' }}>
                      <div className="flex items-center justify-between text-[12px] font-black mb-1.5" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                        <span style={{ color: '#8A8A9A', letterSpacing: '.06em' }}>{progressLabel}</span>
                        <span style={{ color: '#C9C9D5' }}>{progressCurrent}/{progressTarget}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ui-surface-3)' }}>
                        <div className="h-full rounded-full" style={{ width: `${progressTarget ? progressCurrent / progressTarget * 100 : 100}%`, background: 'linear-gradient(90deg,#0a7a2f,#22C55E)' }} />
                      </div>
                      <div className="text-[12px] mt-1.5 leading-snug" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                        {needsSpecializationUnlock
                          ? `Nível 3 concluído. Desbloqueie o nível 4 por ${SPECIALIZATION_UNLOCK_COST} créditos.`
                          : evolutionLevel < maxLevel
                          ? `Faltam ${Math.max(0, progressTarget - apps)} titularidade${Math.max(0, progressTarget - apps) === 1 ? '' : 's'} para liberar o nível ${evolutionLevel + 1}.`
                          : evolutionLevel === 3 && selectedPlayer.rarity === 'immortal'
                            ? `Faltam ${Math.max(0, progressTarget - apps)} titularidade${Math.max(0, progressTarget - apps) === 1 ? '' : 's'} para liberar o nível 4.`
                            : evolutionLevel === 4 ? 'Nível máximo alcançado.' : 'Nível máximo disponível para esta carta.'}
                      </div>
                    </div>
                  );
                  return (
                    <div className="rounded-xl overflow-hidden" style={{ background: '#0F0F1A', border: `1px solid ${evolved ? '#22C55E55' : '#1A1A2A'}` }}>
                      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--ui-surface-3)', background: '#0A0A12' }}>
                        <span className="text-[13px] font-black tracking-widest" style={{ color: evolved ? 'var(--ui-success)' : 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>⭐ EVOLUÇÃO · NÍVEL {evolutionLevel}/{maxLevel}</span>
                        {evolved && <span className="text-[13px] font-black" style={{ color: availablePoints > 0 ? '#4ADE80' : 'var(--ui-success)', fontFamily: 'var(--font-game), sans-serif' }}>{availablePoints > 0 ? `+${availablePoints} DISPONÍVEIS` : `+${spent} APLICADOS`}</span>}
                      </div>
                      <div className="p-3.5">
                        {evolutionProgress}
                        {onSetAutoEvolveAttribute && (
                          <label className="mb-3 block rounded-lg p-3" style={{ background: '#0A0A12', border: '1px solid var(--ui-surface-3)' }}>
                            <span className="block text-[12px] font-black tracking-widest" style={{ color: '#C9C9D5', fontFamily: 'var(--font-game), sans-serif' }}>AUTOMATIZAR PRÓXIMAS EVOLUÇÕES</span>
                            <select
                              value={selectedPlayer.autoEvolveAttribute ?? ''}
                              onChange={event => {
                                const attr = EVOLVE_ATTRS.find(attribute => attribute.key === event.target.value)?.key ?? null;
                                onSetAutoEvolveAttribute(selectedPlayer.id, attr);
                              }}
                              className="mt-2 w-full rounded-lg px-3 py-2.5 text-xs font-bold"
                              style={{ color: '#F3F4F6', background: '#12121E', border: '1px solid #29293A', fontFamily: 'var(--font-game), sans-serif' }}
                            >
                              <option value="">Manual · escolher no modal</option>
                              {EVOLVE_ATTRS.map(attribute => (
                                <option key={attribute.key} value={attribute.key} disabled={!hasFutureEvolveLevel && selectedPlayer.autoEvolveAttribute !== attribute.key}>
                                  {attribute.label}
                                </option>
                              ))}
                            </select>
                            <span className="mt-1.5 block text-[12px] leading-snug" style={{ color: '#777789', fontFamily: 'var(--font-game), sans-serif' }}>
                              {selectedPlayer.autoEvolveAttribute && hasFutureEvolveLevel
                                ? `Os próximos pacotes de +${EVOLVE_POINTS} irão para ${EVOLVE_ATTRS.find(attribute => attribute.key === selectedPlayer.autoEvolveAttribute)?.label.toLowerCase()}. Pontos já liberados continuam como estão.`
                                : selectedPlayer.autoEvolveAttribute
                                  ? 'Os níveis que liberam pontos já foram concluídos. Você ainda pode desligar a preferência.'
                                  : 'Sem automação: distribua manualmente os pontos já liberados e escolha os próximos no modal.'}
                            </span>
                          </label>
                        )}
                        {evolved && evolutionLevel < SPECIALIZATION_LEVEL && (
                          <div className="text-[12px] mb-2 leading-snug" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>
                            Cada nível libera <b style={{ color: '#C9C9D5' }}>+{EVOLVE_POINTS}</b>. Você pode colocar todos os pontos no mesmo atributo.
                          </div>
                        )}
                        {onSetEvolvePoint && evolved && evolutionLevel > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {EVOLVE_ATTRS.map(a => (
                              <button
                                key={a.key}
                                disabled={availablePoints < EVOLVE_POINTS}
                                onClick={() => onSetEvolvePoint(selectedPlayer.id, a.key, EVOLVE_POINTS)}
                                className="flex items-center justify-center rounded-lg px-3 py-2.5 text-[13px] font-black transition-transform active:scale-[0.98]"
                                style={{
                                  background: (ep[a.key] ?? 0) > 0 ? '#0a2114' : '#0A0A12',
                                  color: (ep[a.key] ?? 0) > 0 ? '#4ADE80' : availablePoints >= EVOLVE_POINTS ? '#C9C9D5' : '#6A6A7A',
                                  border: `1px solid ${(ep[a.key] ?? 0) > 0 ? '#22C55E88' : '#1A1A2A'}`,
                                  cursor: availablePoints >= EVOLVE_POINTS ? 'pointer' : 'default',
                                  fontFamily: 'var(--font-game), sans-serif',
                                }}
                              >
                                <span>{a.label}{(ep[a.key] ?? 0) > 0 ? ` · +${ep[a.key]}` : ''}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {onResetEvolvePoints && spent > 0 && (
                          <button onClick={() => onResetEvolvePoints(selectedPlayer.id)} className="w-full mt-2.5 py-2.5 rounded-lg text-[13px] font-black tracking-wide transition-transform active:scale-[0.98]" style={{ background: 'var(--ui-surface-3)', color: 'var(--ui-text-muted)', border: '1px solid var(--ui-line)', fontFamily: 'var(--font-game), sans-serif' }}>↺ RESETAR PONTOS</button>
                        )}
                        {needsSpecializationUnlock && onUnlockSpecialization && (
                          <div className="mt-3 rounded-lg p-3" style={{ background: '#151207', border: '1px solid #C9A84C66' }}>
                            <div className="text-[13px] font-black tracking-widest" style={{ color: '#F5D76E', fontFamily: 'var(--font-game), sans-serif' }}>DESBLOQUEIO DO NÍVEL 4</div>
                            <div className="text-[12px] mt-1 mb-2.5 leading-snug" style={{ color: '#A9A9B8', fontFamily: 'var(--font-game), sans-serif' }}>
                              Pague uma vez para liberar a especialização. Depois disso, você poderá trocar a escolha sem pagar novamente.
                            </div>
                            <button
                              type="button"
                              disabled={(points ?? 0) < SPECIALIZATION_UNLOCK_COST}
                              onClick={() => onUnlockSpecialization(selectedPlayer.id)}
                              className="w-full rounded-lg px-3 py-2.5 text-[13px] font-black tracking-wide transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                              style={{ background: '#C9A84C22', color: '#F5D76E', border: '1px solid #C9A84C88', fontFamily: 'var(--font-game), sans-serif' }}
                            >
                              DESBLOQUEAR · {SPECIALIZATION_UNLOCK_COST} CRÉDITOS
                            </button>
                            <div className="mt-1.5 text-center text-[12px]" style={{ color: '#777789', fontFamily: 'var(--font-game), sans-serif' }}>
                              Saldo: {points ?? 0} créditos
                            </div>
                          </div>
                        )}
                        {evolutionLevel === SPECIALIZATION_LEVEL && selectedPlayer.rarity === 'immortal' && onChooseSpecialization && (
                          <div className="mt-3 rounded-lg p-3" style={{ background: '#0A0A12', border: '1px solid #C9A84C55' }}>
                            <div className="text-[13px] font-black tracking-widest" style={{ color: '#F5D76E', fontFamily: 'var(--font-game), sans-serif' }}>{selectedPlayer.specialization ? 'ALTERAR ESPECIALIZAÇÃO' : 'ESCOLHA UMA ESPECIALIZAÇÃO'}</div>
                            <div className="text-[12px] mt-1 mb-2.5 leading-snug" style={{ color: '#8A8A9A', fontFamily: 'var(--font-game), sans-serif' }}>{selectedPlayer.specialization ? 'Clique em outra opção para trocar a escolha.' : 'Escolha uma área para receber +6 nos dois atributos relacionados.'}</div>
                            <div className="grid grid-cols-2 gap-2">
                              {specializationEntries.map(([id, definition]) => (
                                <button key={id} type="button" onClick={() => onChooseSpecialization(selectedPlayer.id, id)} className="relative overflow-hidden min-h-[104px] rounded-lg p-3 text-left transition-transform active:scale-[0.98]" style={{ border: `${selectedPlayer.specialization === id ? 2 : 1}px solid ${definition.color}${selectedPlayer.specialization === id ? '' : '88'}`, boxShadow: selectedPlayer.specialization === id ? `0 0 0 1px ${definition.color}55, 0 0 16px ${definition.color}33` : 'none', background: `linear-gradient(180deg,rgba(5,5,12,.18),rgba(5,5,12,.78)),url(${definition.texture}) center/cover` }}>
                                  <span className="relative z-10 flex items-center gap-1.5 text-[13px] font-black" style={{ color: definition.color, fontFamily: 'var(--font-game), sans-serif' }}><span>{definition.icon}</span>{definition.label}</span>
                                  <span className="relative z-10 mt-1.5 block text-[13px] leading-tight" style={{ color: '#F3F4F6', fontFamily: 'var(--font-game), sans-serif' }}>+6 {definition.attributeLabel}</span>
                                  {selectedPlayer.specialization === id && <span className="relative z-10 mt-2 inline-flex rounded px-1.5 py-0.5 text-[12px] font-black tracking-wider" style={{ color: '#090910', background: definition.color, fontFamily: 'var(--font-game), sans-serif' }}>✓ ESCOLHIDA</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
                    const swapFit = (candidate: Player, idx: number): { fit: 'native' | 'secondary' | 'off' | null; role: string | null; occupant: Player; coringaInGoal: boolean } => {
                      const role = starterSel ? (formationRoles[selectedIndex!] ?? null) : (idx < 11 ? (formationRoles[idx] ?? null) : null);
                      const occupant = starterSel ? candidate : selectedPlayer!;
                      // A Coringa has no position penalty, but an outfielder in goal still defends with 70%.
                      const coringaInGoal = role === 'GK' && !!occupant.coringa && occupant.position !== 'GK';
                      return { fit: role ? positionFit(occupant, role) : null, role, occupant, coringaInGoal };
                    };
                    const fitRank = (c: Player, idx: number) => {
                      const { fit: f, coringaInGoal } = swapFit(c, idx);
                      return coringaInGoal ? 1 : f === 'native' ? 2 : f === 'secondary' ? 1 : 0;
                    };

                    const renderCandidate = (candidate: Player, idx: number) => {
                      const preview = getChemPreview(idx);
                      const diffColor = preview.diff > 0 ? '#22C55E' : preview.diff < 0 ? '#EF4444' : '#8A8A9A';
                      const diffLabel = preview.diff > 0 ? `+${preview.diff}` : `${preview.diff}`;
                      const variants = getCardVariants(candidate);
                      const candidateDisciplineChips = disciplineChips(candidate.id);
                      const { fit, role, coringaInGoal } = swapFit(candidate, idx);
                      const nativeFit = fit === 'native' && !coringaInGoal;
                      const secFit = fit === 'secondary' || coringaInGoal;
                      const fits = nativeFit || secFit;
                      const borderCol = role ? (nativeFit ? '#22C55E66' : secFit ? '#F59E0B66' : '#EF444455') : '#161626';
                      const bgCol = role ? (nativeFit ? '#08120b' : secFit ? '#141008' : '#120a0a') : '#07070f';
                      return (
                        <div key={candidate.id}
                          onClick={() => { onSwap(selectedIndex!, idx); setSelectedIndex(null); }}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border hover:brightness-125 active:scale-[0.98] transition-all"
                          style={{ background: bgCol, borderColor: borderCol }}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]" style={{ border: `1.5px solid ${getRarityColor(candidate.rarity)}` }}>
                            <PlayerPortrait
                              playerId={candidate.id}
                              photoUrl={candidate.photoUrl}
                              alt={candidate.shortName}
                              loading="lazy"
                              className="w-full h-full object-cover"
                              style={{ objectPosition: 'center top', scale: '1.2' }}
                              fallback={<span className="text-sm font-bold" style={{ color: getRarityColor(candidate.rarity) }}>⚽</span>}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* nome + características */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-black text-white truncate" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{candidate.shortName.toUpperCase()}</span>
                              {variants.map(v => (
                                <span key={v.key} title={v.label} className="inline-flex flex-shrink-0"><TraitIcon trait={v.key} fallback={v.icon} size={24} /></span>
                              ))}
                            </div>
                            {/* posições (nativa + secundárias) + GER */}
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                              <span className="text-[12px] font-black px-1.5 py-0.5 rounded" style={{ background: (starterSel && nativeFit) ? '#0a7a2f' : '#26263a', color: (starterSel && nativeFit) ? '#eafff0' : '#C9C9D5', fontFamily: 'var(--font-game), sans-serif' }}>{POS_PT[candidate.position] ?? candidate.position}</span>
                              {effectiveSecondaries(candidate).map(pos => (
                                <span key={pos} className="text-[12px] font-bold px-1.5 py-0.5 rounded" style={{ background: (starterSel && secFit && pos === role) ? '#7a5c0f' : '#12121c', color: (starterSel && secFit && pos === role) ? '#ffe8b0' : '#7A7A8A', border: '1px solid var(--ui-line)', fontFamily: 'var(--font-game), sans-serif' }}>{POS_PT[pos] ?? pos}</span>
                              ))}
                              <span className="text-[12px] font-bold text-gray-500 ml-0.5" style={{ fontFamily: 'var(--font-game), sans-serif' }}>GER {candidate.overall}</span>
                            </div>
                            {candidateDisciplineChips.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {candidateDisciplineChips.map(status => (
                                  <span key={status.key} title={status.title} className="inline-flex items-center rounded px-1.5 py-0.5 text-[12px] font-black leading-none" style={{ background: `${status.color}18`, border: `1px solid ${status.color}66`, color: status.color, fontFamily: 'var(--font-game), sans-serif' }}>
                                    {status.label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* selo de encaixe na vaga (quem ocupa o slot após a troca) */}
                            {role && (
                              <div className="mt-1">
                                {nativeFit && <span className="text-[12px] font-black px-1.5 py-0.5 rounded" style={{ background: '#0a7a2f', color: '#eafff0', fontFamily: 'var(--font-game), sans-serif' }}>✓ ENCAIXA NA VAGA{starterSel ? '' : ` (${POS_PT[role] ?? role})`}</span>}
                                {secFit && <span className="text-[12px] font-black px-1.5 py-0.5 rounded" style={{ background: '#3a2708', color: '#F59E0B', border: '1px solid #F59E0B66', fontFamily: 'var(--font-game), sans-serif' }}>{coringaInGoal ? '🃏 CORINGA NO GOL · DEFENDE COM 70%' : '🔁 COBRE A VAGA (2ª pos · −5%)'}{starterSel ? '' : ` (${POS_PT[role] ?? role})`}</span>}
                                {!fits && <span className="text-[12px] font-black px-1.5 py-0.5 rounded" style={{ background: '#3a0a0a', color: 'var(--ui-danger)', border: '1px solid #EF444455', fontFamily: 'var(--font-game), sans-serif' }}>⚠️ FORA DE POSIÇÃO{starterSel ? '' : ` (${POS_PT[role] ?? role})`}</span>}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[12px] text-gray-500 font-bold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif' }}>QUÍMICA<br />DO TIME</div>
                            <div className="text-xs font-black" style={{ color: diffColor, fontFamily: 'var(--font-game), sans-serif' }}>{preview.total} <span className="text-[12px] font-bold">({diffLabel})</span></div>
                          </div>
                        </div>
                      );
                    };

                    // Ordena: quem encaixa na vaga primeiro, depois maior overall.
                    const sortFit = (a: { c: Player; i: number }, b: { c: Player; i: number }) => fitRank(b.c, b.i) - fitRank(a.c, a.i) || b.c.overall - a.c.overall;
                    const starters = players.map((c, i) => ({ c, i })).filter(({ i }) => i < 11 && i !== selectedIndex).sort(sortFit);
                    const bench = players.map((c, i) => ({ c, i })).filter(({ i }) => i >= 11 && i !== selectedIndex).sort(sortFit);
                    const fitsSlot = ({ c, i }: { c: Player; i: number }) => fitRank(c, i) > 0;
                    const Section = ({ title, color, items }: { title: string; color: string; items: { c: Player; i: number }[] }) => {
                      if (items.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <div className="text-[12px] font-black tracking-widest" style={{ color, fontFamily: 'var(--font-game), sans-serif' }}>{title}</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{items.map(({ c, i }) => renderCandidate(c, i))}</div>
                        </div>
                      );
                    };
                    // Nobody fits (e.g. a keeper slot with no backup keeper): warn that any swap plays out of position.
                    const noneFits = [...starters, ...bench].every(item => !fitsSlot(item));
                    return (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#8A8A9A] tracking-wider" style={{ fontFamily: 'var(--font-game), sans-serif' }}>TROCAR COM</span>
                          {headerRole && (
                            <span className="text-[12px] font-black px-2 py-0.5 rounded" style={{ background: '#1c1c2e', color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>VAGA: {POS_PT[headerRole] ?? headerRole}</span>
                          )}
                        </div>
                        <div className="space-y-4">
                          {noneFits && starters.length + bench.length > 0 && <div className="rounded-lg px-3 py-2 text-[12px] text-[#F59E0B]" style={{ background: '#F59E0B12', border: '1px solid #F59E0B44', fontFamily: 'var(--font-game), sans-serif' }}>⚠️ Ninguém do elenco joga nesta posição. Qualquer troca aqui deixa o substituto fora de posição.</div>}
                          {/* A starter is usually replaced from the bench, so the bench comes first. */}
                          {starterSel ? (
                            <>
                              <Section title="🪑 RESERVAS / BANCO" color="#818CF8" items={bench} />
                              <Section title="TITULARES (TROCA DE POSIÇÃO)" color="#22C55E" items={starters} />
                            </>
                          ) : (
                            <>
                              <Section title="TITULARES" color="#22C55E" items={starters} />
                              <Section title="🪑 RESERVAS / BANCO" color="#818CF8" items={bench} />
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                </div>
              </div>
            </div>
          </GameModal>
        )}

        {/* 🏥 Confirmação da fisioterapia — evita comprar num clique só. */}
        {confirmPhysioFor && (() => {
          const pp = players.find(p => p.id === confirmPhysioFor);
          if (!pp) return null;
          const inj = availability?.[confirmPhysioFor]?.injured ?? 0;
          return (
            <GameModal
              open
              onOpenChange={open => { if (!open) setConfirmPhysioFor(null); }}
              stacked
              title="Fisioterapia"
              footer={
                <div className="flex w-full gap-2">
                  <button onClick={() => setConfirmPhysioFor(null)} className="flex-1 py-2.5 rounded-xl font-black tracking-widest" style={{ fontFamily: 'var(--font-game), sans-serif', background: '#17171f', color: '#9A9AA5' }}>
                    CANCELAR
                  </button>
                  <button
                    disabled={!canAffordPhysio}
                    onClick={() => { onHealInjury?.(confirmPhysioFor); setConfirmPhysioFor(null); }}
                    className="flex-1 py-2.5 rounded-xl font-black tracking-widest disabled:opacity-40 transition-transform active:scale-95"
                    style={{ fontFamily: 'var(--font-display), sans-serif', background: 'linear-gradient(135deg,#0E7490,#22D3EE)', color: '#062028' }}>
                    CONFIRMAR
                  </button>
                </div>
              }
            >
              <div className="text-center">
                <div className="text-3xl mb-1">🏥</div>
                <p className="text-[13px] mb-1" style={{ color: '#C8D0D4', fontFamily: 'var(--font-game), sans-serif' }}>
                  Reduzir <b style={{ color: '#FFF' }}>1 jogo</b> de lesão de <b style={{ color: '#FFF' }}>{pp.shortName}</b>?
                </p>
                <p className="text-[12px]" style={{ color: '#8A9BA0', fontFamily: 'var(--font-game), sans-serif' }}>
                  Fica <b style={{ color: '#FCD34D' }}>{Math.max(0, inj - 1)} jogo(s)</b> de fora · {physioFree ? <b style={{ color: '#67E8F9' }}>1 uso gratuito disponível</b> : <>custa <b style={{ color: '#67E8F9' }}>{physioCost} créditos</b></>}
                </p>
              </div>
            </GameModal>
          );
        })()}

        {/* 🔍 Card do jogador em tela cheia (só pra ver de perto) */}
        {zoomCard && selectedPlayer && (
          <GameModal
            open
            onOpenChange={open => { if (!open) setZoomCard(false); }}
            stacked
            title={<span className="sr-only">Visualização ampliada do card</span>}
            closeLabel="Fechar"
            bodyClassName="flex items-center justify-center"
          >
            <PlayerCard player={selectedPlayer} effectiveStats={effectiveStatsById[selectedPlayer.id]} scale={1.5} />
          </GameModal>
        )}
      </>

      {/* Confirmação da troca rápida — soltar um card nunca altera o elenco sozinho. */}
      {pendingSwap && pendingFromPlayer && pendingToPlayer && (
        <GameModal
          open
          onOpenChange={open => { if (!open) setPendingSwap(null); }}
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/33 bg-primary/9 text-xl text-brand-strong" aria-hidden="true">↔</span>
              <span>{pendingIsStarterSwap ? 'CONFIRMAR TROCA DE POSIÇÃO' : 'CONFIRMAR ENTRADA NO TIME'}</span>
            </span>
          }
          subtitle="Confira o movimento antes de aplicar ao elenco."
          footer={
            <div className="flex w-full gap-2">
              <button type="button" onClick={() => setPendingSwap(null)} className="flex-1 rounded-xl border border-[#2E2E42] bg-[#17171F] py-2.5 text-xs font-black tracking-widest text-[#A9A9B8] transition-colors hover:bg-[#222230] hover:text-white" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                CANCELAR
              </button>
              <button type="button" onClick={confirmPlayerSwap} className="flex-1 rounded-xl border border-primary bg-primary py-2.5 text-xs font-black tracking-widest text-[#090910] transition-colors hover:bg-brand-strong" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                CONFIRMAR
              </button>
            </div>
          }
        >
          <div className="space-y-2" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            <div className="rounded-xl border border-[#22C55E44] bg-[#22C55E0D] px-3 py-2.5">
              <div className="text-[12px] font-black tracking-widest text-[#4ADE80]">{pendingIsStarterSwap ? 'VAI PARA A POSIÇÃO' : 'ENTRA EM CAMPO'}</div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm font-bold text-white">
                <span className="truncate">{pendingFromPlayer.shortName}</span>
                <span className="shrink-0 text-xs text-[#86EFAC]">→ {POS_PT[pendingTargetRole ?? ''] ?? pendingTargetRole ?? 'TITULAR'}</span>
              </div>
            </div>
            <div className="rounded-xl border border-[#F59E0B44] bg-[#F59E0B0D] px-3 py-2.5">
              <div className="text-[12px] font-black tracking-widest text-[#FBBF24]">{pendingIsStarterSwap ? 'TROCA DE POSIÇÃO' : 'SAI DA VAGA'}</div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm font-bold text-white">
                <span className="truncate">{pendingToPlayer.shortName}</span>
                <span className="shrink-0 text-xs text-[#FCD34D]">→ {pendingIsStarterSwap ? (POS_PT[pendingSourceRole ?? ''] ?? pendingSourceRole ?? 'TITULAR') : 'BANCO'}</span>
              </div>
            </div>
          </div>
        </GameModal>
      )}

    </motion.div>
  );
}
