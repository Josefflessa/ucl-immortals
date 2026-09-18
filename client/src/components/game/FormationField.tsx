// UCL Immortals — FormationField Component
// Tactical field with player positions and chemistry lines

import { useEffect, useId, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import { Player, Formation, getRarityColor, POS_PT } from '../../lib/gameData';
import { isPlayerInPosition, positionFit, ChemLink, ChemLinkType } from '../../lib/gameEngine';
import PlayerCard, { buildSofifaUrl, getCardVariants, type PlayerCardStats } from './PlayerCard';

const posLabel = (pos: string) => POS_PT[pos] ?? pos;
const FIELD_CARD_WIDTH = 92;
const FIELD_CARD_HEIGHT = 146;
const FIELD_CARD_SIZE_MULTIPLIER = 1.1;

// Result-only vertical layout. The compact field keeps the gameplay coordinates
// from Formation; the card field uses these tuned coordinates so each formation
// reads as a compact tactical block instead of leaving a large gap between lines.
// The goalkeeper stays deep, with a deliberate clear area below the outfield.
const RESULT_FORMATION_Y: Record<string, number[]> = {
  // GK, back four, midfield three, front three (central ST remains advanced).
  '4-3-3': [90, 68, 70, 70, 68, 45, 49, 45, 25, 15, 25],
  // GK, back four, double pivot, three behind the striker, ST.
  '4-2-3-1': [90, 68, 70, 70, 68, 48, 48, 35, 32, 35, 15],
  // GK, back four, midfield four, two strikers.
  '4-4-2': [90, 68, 70, 70, 68, 44, 46, 46, 44, 22, 22],
  // GK, back three, midfield five, two strikers.
  '3-5-2': [90, 68, 70, 68, 45, 43, 47, 43, 45, 22, 22],
  // GK, back three, midfield four, front three (central ST remains advanced).
  '3-4-3': [90, 68, 70, 68, 44, 46, 46, 44, 20, 13, 20],
  // GK, back five, midfield three, two strikers.
  '5-3-2': [90, 66, 68, 70, 68, 66, 44, 47, 44, 22, 22],
};

// Connection colours by link type — shared with the legend in the squad screen.
export const CHEM_LINK_COLOR: Record<ChemLinkType, string> = {
  club: '#C9A84C',    // mesmo clube
  nation: '#3B82F6',  // mesma nação
  coach: '#A855F7',   // mesmo técnico histórico
  partner: '#22C55E', // dupla histórica
};

export interface EmergencyGoalkeeperDisplay {
  playerId: string;
  goalkeeperSlotIndex: number;
  vacatedSlotIndex: number;
}

interface FormationFieldProps {
  formation: Formation;
  players: (Player | undefined)[];
  chemistryScores?: Record<string, number>;
  showChemLines?: boolean;
  chemLinks?: ChemLink[];
  onPlayerClick?: (player: Player, posIndex: number) => void;
  // Optional quick reorder for squad-management fields: drag one starter onto another.
  onPlayerDrop?: (fromIndex: number, toIndex: number) => void;
  compact?: boolean;
  // Card-field presentation: render the production compact PlayerCard at each
  // position instead of the small circular token.
  showPlayerCards?: boolean;
  // Optional team-context stats. Omit this in Draft/shop/result previews so the field
  // stays on card values; Meu Time supplies it for both starters and the bench.
  effectiveStats?: Record<string, PlayerCardStats>;
  selectedPlayerIndex?: number | null;
  // When a player is being moved (starter drag or reserve long-press shortcut),
  // colour every field slot according to that player's position fit.
  positionGuidePlayer?: Player | null;
  // Match mode — when provided, each token shows the live RATING (colour-coded) plus goal/assist
  // markers instead of the chemistry dot. Keyed by player.id (unique within a single XI).
  ratings?: Record<string, number>;
  goalsByPlayer?: Record<string, number>;
  assistsByPlayer?: Record<string, number>;
  // 🟨🟥🩹 Disciplina/lesão por jogador (durante a partida). Expulso é escurecido + 🟥; lesionado 🩹.
  disciplineByPlayer?: Record<string, { yellow: number; red: boolean; injury: boolean }>;
  // When the starting goalkeeper is sent off, the match engine keeps the XI order
  // for identity but moves a line player into the goal. The field mirrors that
  // state: the emergency keeper occupies the GK slot and his old slot is empty.
  emergencyGoalkeeper?: EmergencyGoalkeeperDisplay;
}

const POSITION_COLORS: Record<string, string> = {
  GK: '#F59E0B',
  CB: '#3B82F6', LB: '#3B82F6', RB: '#3B82F6',
  CDM: '#10B981', CM: '#10B981', CAM: '#10B981', LM: '#10B981', RM: '#10B981',
  LW: '#EF4444', RW: '#EF4444', ST: '#EF4444',
};

const PLAYER_INITIALS: Record<string, string> = {
  messi: 'LM', cristiano: 'CR', xavi: 'XH', iniesta: 'AI',
  modric: 'LM', ramos: 'SR', casillas: 'IC', neuer: 'MN', buffon: 'GB',
  pirlo: 'AP', kaka: 'KK', maldini: 'PM', drogba: 'DD', benzema: 'KB',
  alonso: 'XA', busquets: 'SB', alves: 'DA', marcelo: 'MA', lahm: 'PL',
  neymar: 'NJ', suarez: 'LS', ribery: 'FR', robben: 'AR', lampard: 'FL',
  gerrard: 'SG', terry: 'JT', cech: 'PC', sneijder: 'WS', milito: 'DM',
  zanetti: 'JZ', rooney: 'WR', giggs: 'RG', scholes: 'PS', tevez: 'CT',
  henry: 'TH', puyol: 'CP', chiellini: 'GC', nesta: 'AN',
  schweinsteiger: 'BS', valdes: 'VV', fabregas: 'CF', pedro: 'PR',
  vidic: 'NV', evra: 'PE', maicon: 'MC', kompany: 'VK', silva_david: 'DS',
  villa: 'DV', torres: 'FT',
};

interface PointerDragState {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
}

export default function FormationField({
  formation,
  players,
  chemistryScores = {},
  showChemLines = false,
  chemLinks,
  onPlayerClick,
  onPlayerDrop,
  compact = false,
  showPlayerCards = false,
  effectiveStats = {},
  selectedPlayerIndex = null,
  positionGuidePlayer = null,
  ratings,
  goalsByPlayer,
  assistsByPlayer,
  disciplineByPlayer,
  emergencyGoalkeeper,
}: FormationFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const fieldId = useId().replace(/:/g, '');
  const [fieldPixelWidth, setFieldPixelWidth] = useState(0);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pointerDrag, setPointerDrag] = useState<PointerDragState | null>(null);
  const didDragRef = useRef(false);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const [nativeDragEnabled, setNativeDragEnabled] = useState(false);
  const ratingMode = !!ratings;
  const canReorderPlayers = showPlayerCards && !!onPlayerDrop;
  const canUseNativeDrag = canReorderPlayers && nativeDragEnabled;
  // A starter gets its guide from the native drag state. A reserve is supplied
  // by SquadEditor after its long press, so the user can release the gesture
  // and then click the titular target without losing the guide.
  const guidedPlayer = positionGuidePlayer ?? (draggingIndex !== null ? players[draggingIndex] : null);
  const positionGuideActive = canReorderPlayers && !!guidedPlayer && (
    positionGuidePlayer !== null || draggingIndex !== null
  );
  const ratingColor = (r: number) => r >= 8.5 ? '#d4af37' : r >= 7.5 ? '#22c55e' : r >= 6.5 ? '#e5e7eb' : r <= 5.3 ? '#ef4444' : '#f59e0b';
  // Intrinsic aspect used for the SVG viewBox + token sizing maths. The field itself is now
  // FLUID: it fills its container up to maxW and keeps this aspect ratio, so it never overflows
  // on mobile (no sideways drag) and stays centred. Positions are placed in % of the field.
  const fieldWidth = compact ? 300 : showPlayerCards ? 760 : 410;
  const fieldHeight = compact ? 410 : showPlayerCards ? 1300 : 550;
  const maxW = compact ? 300 : showPlayerCards ? 760 : 410;

  useEffect(() => {
    if (!showPlayerCards) return;
    const node = fieldRef.current;
    if (!node) return;
    const updateWidth = () => setFieldPixelWidth(node.getBoundingClientRect().width);
    updateWidth();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, [showPlayerCards]);

  // HTML5 drag-and-drop is kept for mouse/trackpad input, while touch/pen uses
  // Pointer Events below. Mobile browsers do not consistently start a native
  // drag from a draggable element, so exposing `draggable` there would leave
  // the user with a press that does nothing (or drags only the image).
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setNativeDragEnabled(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  // A drag originating in the bench lives outside this component's field-card
  // handlers. Listen at document level so a cancelled drag or a drop on empty
  // grass can never leave an old destination highlighted.
  useEffect(() => {
    if (!canReorderPlayers) return;
    const clearDragState = () => {
      setDraggingIndex(null);
      setDragOverIndex(null);
    };
    document.addEventListener('dragend', clearDragState);
    document.addEventListener('drop', clearDragState);
    return () => {
      document.removeEventListener('dragend', clearDragState);
      document.removeEventListener('drop', clearDragState);
    };
  }, [canReorderPlayers]);

  // Five compact cards is the tightest supported row (5-3-2). Size the same
  // card used by the TITULARES section from the rendered field width so it
  // remains readable while preserving separation on narrow screens.
  const cardScale = showPlayerCards
    ? Math.min(1, Math.max(0.46, fieldPixelWidth > 0 ? (fieldPixelWidth * 0.18 - 8) / FIELD_CARD_WIDTH : 0.9)) * FIELD_CARD_SIZE_MULTIPLIER
    : 1;
  // Keep the native drop target exactly aligned with the visible scaled card.
  // The previous fixed wrapper was wider than the card on narrow fields, so a
  // drop on nearby grass could still be interpreted as a drop on the player.
  const displayedCardWidth = FIELD_CARD_WIDTH * cardScale;
  const displayedCardHeight = FIELD_CARD_HEIGHT * cardScale;
  // Keep the formation's original depth instead of snapping positions into broad
  // row bands. This matters in shapes such as 4-3-3, where the central striker
  // is intentionally ahead of the wingers. The small clamp keeps the outer card
  // edges inside the field, especially for the goalkeeper at 92%.
  const visualY = (y: number, positionIndex?: number) => {
    if (!showPlayerCards) return y;
    const tunedY = positionIndex === undefined ? y : RESULT_FORMATION_Y[formation.id]?.[positionIndex] ?? y;
    return Math.min(90, Math.max(10, tunedY));
  };

  const getChemColor = (score: number) => {
    if (score >= 3) return '#22C55E';
    if (score >= 2) return '#EAB308';
    if (score >= 1) return '#F97316';
    return '#EF4444';
  };

  const handlePlayerDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (!canUseNativeDrag || !players[index]) return;
    didDragRef.current = true;
    setDraggingIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    event.dataTransfer.setData('application/x-ucl-player-index', String(index));

    // Browsers otherwise pick the first draggable child (the portrait) as the
    // native ghost image. Use the whole positioned card so the shortcut feels
    // like moving a card, not just dragging its photo.
    const cardElement = event.currentTarget.querySelector<HTMLElement>('[data-player-card="true"]') ?? event.currentTarget;
    const cardRect = cardElement.getBoundingClientRect();
    event.dataTransfer.setDragImage(cardElement, cardRect.width / 2, cardRect.height / 2);
  };

  const readDraggedIndex = (event: DragEvent<HTMLDivElement>) => {
    const rawIndex = event.dataTransfer.getData('application/x-ucl-player-index') || event.dataTransfer.getData('text/plain');
    const sourceIndex = Number(rawIndex);
    return Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : null;
  };

  const handlePlayerDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    const sourceIndex = draggingIndex ?? readDraggedIndex(event);
    if (!canReorderPlayers || sourceIndex === null || sourceIndex === index || !players[index]) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handlePlayerDrop = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    if (!canReorderPlayers || !players[targetIndex]) return;
    event.preventDefault();
    const sourceIndex = draggingIndex ?? readDraggedIndex(event);
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      onPlayerDrop?.(sourceIndex, targetIndex);
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleFieldDrop = () => {
    // A drop on the field background is intentionally a no-op: it cancels the
    // pending target instead of guessing which nearby player was intended.
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handlePlayerDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
    // A native drag may be followed by a synthetic click. Ignore that click, but
    // release the guard on the next task so a later intentional click still works.
    window.setTimeout(() => { didDragRef.current = false; }, 0);
  };

  const getPointerDropTarget = (clientX: number, clientY: number, sourceIndex: number) => {
    const slots = fieldRef.current?.querySelectorAll<HTMLElement>('[data-player-slot]');
    if (!slots) return null;

    for (const slot of Array.from(slots)) {
      const targetIndex = Number(slot.dataset.playerSlot);
      if (!Number.isInteger(targetIndex) || targetIndex === sourceIndex || !players[targetIndex]) continue;
      const rect = slot.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return targetIndex;
      }
    }

    return null;
  };

  const clearPointerDrag = () => {
    pointerDragRef.current = null;
    setPointerDrag(null);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handlePlayerPointerDown = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    // Mouse/trackpad keeps the established native drag interaction. Touch and
    // pen use this implementation because they do not reliably support HTML5
    // drag-and-drop.
    if (!canReorderPlayers || event.pointerType === 'mouse' || !players[index] || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = {
      index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: 0,
      y: 0,
      active: false,
    };
  };

  const handlePlayerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = pointerDragRef.current;
    if (!current || current.pointerId !== event.pointerId || event.pointerType === 'mouse') return;
    event.preventDefault();

    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.active && distance < 8) return;

    const fieldRect = fieldRef.current?.getBoundingClientRect();
    if (!fieldRect) return;
    const next: PointerDragState = {
      ...current,
      x: event.clientX - fieldRect.left,
      y: event.clientY - fieldRect.top,
      active: true,
    };
    pointerDragRef.current = next;
    setPointerDrag(next);
    setDraggingIndex(next.index);
    setDragOverIndex(getPointerDropTarget(event.clientX, event.clientY, next.index));
    didDragRef.current = true;
  };

  const handlePlayerPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = pointerDragRef.current;
    if (!current || current.pointerId !== event.pointerId || event.pointerType === 'mouse') return;
    event.preventDefault();

    if (current.active) {
      const targetIndex = getPointerDropTarget(event.clientX, event.clientY, current.index);
      if (targetIndex !== null) onPlayerDrop?.(current.index, targetIndex);
      didDragRef.current = true;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearPointerDrag();
  };

  const handlePlayerPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = pointerDragRef.current;
    if (!current || current.pointerId !== event.pointerId || event.pointerType === 'mouse') return;
    if (current.active) didDragRef.current = true;
    clearPointerDrag();
  };

  return (
    <div
      ref={fieldRef}
      className="relative rounded-xl overflow-hidden mx-auto"
      onDrop={handleFieldDrop}
      style={{
        width: '100%',
        maxWidth: maxW,
        aspectRatio: `${fieldWidth} / ${fieldHeight}`,
        background: [
          'radial-gradient(ellipse at 50% 44%, rgba(35, 126, 57, 0.22) 0%, rgba(9, 49, 19, 0) 64%)',
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.025) 7%, rgba(0,0,0,0.02) 7%, rgba(0,0,0,0.02) 14%)',
          'linear-gradient(180deg, #08250E 0%, #0B3516 48%, #08270F 100%)',
        ].join(','),
        border: '1px solid #2E7D43',
        boxShadow: 'inset 0 0 0 1px rgba(110, 201, 113, 0.12), inset 0 0 42px rgba(0, 0, 0, 0.24), 0 12px 30px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Field markings — scales with the container via viewBox */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
        preserveAspectRatio="none"
        style={{ opacity: 0.46 }}
      >
        {/* Subtle field wash keeps the markings legible without competing with cards. */}
        <defs>
          <linearGradient id={`${fieldId}-lines`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#73C87A" stopOpacity="0.72" />
            <stop offset="50%" stopColor="#4DAB5B" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#73C87A" stopOpacity="0.72" />
          </linearGradient>
        </defs>

        {/* Outer border */}
        <rect x="10" y="10" width={fieldWidth - 20} height={fieldHeight - 20}
          fill="none" stroke={`url(#${fieldId}-lines)`} strokeWidth="2" rx="5" />

        {/* Center line */}
        <line x1="10" y1={fieldHeight / 2} x2={fieldWidth - 10} y2={fieldHeight / 2}
          stroke="#5CAF67" strokeWidth="1.4" />

        {/* Center circle */}
        <circle cx={fieldWidth / 2} cy={fieldHeight / 2} r={compact ? 35 : 45}
          fill="rgba(68, 171, 88, 0.035)" stroke="#5CAF67" strokeWidth="1.35" />
        <circle cx={fieldWidth / 2} cy={fieldHeight / 2} r="3"
          fill="#78D17C" />

        {/* Top penalty area */}
        <rect x={fieldWidth * 0.25} y="10" width={fieldWidth * 0.5} height={fieldHeight * 0.18}
          fill="rgba(72, 176, 88, 0.025)" stroke="#4DAB5B" strokeWidth="1.25" />
        {/* Top goal area */}
        <rect x={fieldWidth * 0.35} y="10" width={fieldWidth * 0.3} height={fieldHeight * 0.08}
          fill="none" stroke="#4DAB5B" strokeWidth="1.25" />
        <circle cx={fieldWidth / 2} cy={fieldHeight * 0.18} r="2.2" fill="#78D17C" />

        {/* Bottom penalty area */}
        <rect x={fieldWidth * 0.25} y={fieldHeight - fieldHeight * 0.18 - 10}
          width={fieldWidth * 0.5} height={fieldHeight * 0.18}
          fill="rgba(72, 176, 88, 0.025)" stroke="#4DAB5B" strokeWidth="1.25" />
        {/* Bottom goal area */}
        <rect x={fieldWidth * 0.35} y={fieldHeight - fieldHeight * 0.08 - 10}
          width={fieldWidth * 0.3} height={fieldHeight * 0.08}
          fill="none" stroke="#4DAB5B" strokeWidth="1.25" />
        <circle cx={fieldWidth / 2} cy={fieldHeight * 0.82} r="2.2" fill="#78D17C" />

      </svg>

      {/* Chemistry connection web — real links (club / nation / coach / partner), colour
          coded. Selecting a player highlights only their connections. Drawn in its own
          full-opacity SVG (the markings layer above is dimmed to 30%). */}
      {showChemLines && chemLinks && chemLinks.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${fieldWidth} ${fieldHeight}`} preserveAspectRatio="none">
          {chemLinks.map((link, idx) => {
            const posA = formation.positions[link.aIndex];
            const posB = formation.positions[link.bIndex];
            if (!posA || !posB) return null;
            const x1 = (posA.x / 100) * fieldWidth, y1 = (visualY(posA.y, link.aIndex) / 100) * fieldHeight;
            const x2 = (posB.x / 100) * fieldWidth, y2 = (visualY(posB.y, link.bIndex) / 100) * fieldHeight;
            const color = CHEM_LINK_COLOR[link.type];
            const hasSel = selectedPlayerIndex !== null && selectedPlayerIndex < formation.positions.length;
            const touchesSel = hasSel && (link.aIndex === selectedPlayerIndex || link.bIndex === selectedPlayerIndex);
            const opacity = hasSel ? (touchesSel ? 1 : 0.14) : 0.62;
            const width = touchesSel ? 3.2 : 2;
            return (
              <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth={width} strokeOpacity={opacity} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
      )}

      {/* Player tokens — positioned in % of the field so they track the fluid size */}
      {formation.positions.map((pos, index) => {
        const isEmergencyGoalkeeperSlot = emergencyGoalkeeper?.goalkeeperSlotIndex === index;
        const isVacatedSlot = emergencyGoalkeeper?.vacatedSlotIndex === index;
        const emergencyPlayer = emergencyGoalkeeper
          ? players.find(p => p?.id === emergencyGoalkeeper.playerId)
          : undefined;
        // The display order still belongs to the original XI. For the special red-card
        // goalkeeper state, render the emergency line player in goal and leave his old
        // position vacant so the field visibly remains a 10-man side.
        const player = isEmergencyGoalkeeperSlot
          ? emergencyPlayer
          : isVacatedSlot
            ? undefined
            : players[index];
        const posColor = POSITION_COLORS[pos.role] || '#8A8A9A';
        const chemScore = player ? (chemistryScores[player.id] ?? 0) : 0;
        const rarityColor = player ? getRarityColor(player.rarity) : '#555';
        const initials = player ? (PLAYER_INITIALS[player.id] || player.shortName.slice(0, 2).toUpperCase()) : isVacatedSlot ? '—' : '?';
        const photoUrl = player ? buildSofifaUrl(player.id, 120) : null;
        const tokenSize = compact ? 34 : 48;
        // Match (rating) mode: a more compact token with the rating/goals OVERLAID on the photo
        // (not stacked below), so cards never overlap their neighbours on tight formations.
        const photoSize = ratingMode ? (compact ? 33 : 44) : tokenSize;

        const isSelected = selectedPlayerIndex === index;
        const r = player ? ratings?.[player.id] : undefined;
        const g = player ? (goalsByPlayer?.[player.id] ?? 0) : 0;
        const a = player ? (assistsByPlayer?.[player.id] ?? 0) : 0;
        const disc = player ? disciplineByPlayer?.[player.id] : undefined;
        const sentOff = !!disc?.red;
        // ⭐ Características do jogador (Em Alta, Lobo, Ídolo, Magnata…) — tingem a borda/glow do token
        // (como no card) e aparecem num chip com o(s) ícone(s) no canto inferior esquerdo.
        const variants = player ? getCardVariants(player) : [];
        const tokenColor = variants[0]?.color ?? rarityColor;
        const positionFitType = positionGuideActive && guidedPlayer
          ? positionFit(guidedPlayer, pos.role)
          : null;
        const positionGuideColor = positionFitType === 'native'
          ? '#22C55E'
          : positionFitType === 'secondary'
            ? '#EAB308'
            : positionFitType === 'off'
              ? '#EF4444'
              : null;
        // Do not colour the source card itself during a starter drag; the
        // remaining cards are the possible destinations. For a reserve source,
        // all eleven field cards are destinations.
        const isPositionGuideTarget = positionGuideColor !== null && index !== draggingIndex;

        if (showPlayerCards) {
          return (
            <motion.div
              key={index}
              className={`absolute flex items-center justify-center ${canReorderPlayers && player ? 'cursor-grab active:cursor-grabbing' : ''} ${dragOverIndex === index ? 'z-20' : ''}`}
              data-player-slot={showPlayerCards ? index : undefined}
              style={{
                left: `${pos.x}%`, top: `${visualY(pos.y, index)}%`, width: displayedCardWidth, height: displayedCardHeight,
                touchAction: canReorderPlayers && player ? 'none' : undefined,
                ...(isPositionGuideTarget ? {
                  borderRadius: 12,
                  boxShadow: `0 0 0 2px ${positionGuideColor}, 0 0 14px ${positionGuideColor}99`,
                } : {}),
              }}
              transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              draggable={canUseNativeDrag && !!player}
              // Use the native capture handlers because Framer Motion reserves
              // onDragStart/onDragEnd for its own pointer-drag API.
              onDragStartCapture={event => handlePlayerDragStart(event, index)}
              onDragOver={event => handlePlayerDragOver(event, index)}
              onDragLeave={event => {
                const related = event.relatedTarget;
                if (!(related instanceof Node) || !event.currentTarget.contains(related)) setDragOverIndex(null);
              }}
              onDrop={event => handlePlayerDrop(event, index)}
              onDragEndCapture={handlePlayerDragEnd}
              onPointerDown={event => handlePlayerPointerDown(event, index)}
              onPointerMove={handlePlayerPointerMove}
              onPointerUp={handlePlayerPointerUp}
              onPointerCancel={handlePlayerPointerCancel}
              onClick={() => {
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                if (player) onPlayerClick?.(player, index);
              }}
              title={canReorderPlayers && player ? 'Arraste sobre outro jogador para trocar' : undefined}
            >
              <div className="relative" style={{ width: FIELD_CARD_WIDTH, height: FIELD_CARD_HEIGHT, transform: `scale(${cardScale})`, transformOrigin: 'center center', opacity: draggingIndex === index ? 0.52 : 1 }}>
                <div style={{ opacity: sentOff ? 0.42 : 1, filter: sentOff ? 'grayscale(1)' : 'none' }}>
                  {player ? (
                    <PlayerCard player={player} compact lite effectiveStats={effectiveStats[player.id]} />
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-xl"
                      aria-label={`Posição ${posLabel(pos.role)}`}
                      style={{
                        width: 92,
                        height: 146,
                        color: posColor,
                        background: 'linear-gradient(160deg, rgba(9, 18, 28, 0.88), rgba(9, 11, 20, 0.96))',
                        border: `1px dashed ${posColor}99`,
                        boxShadow: isPositionGuideTarget
                          ? `0 0 0 2px ${positionGuideColor}, 0 0 14px ${positionGuideColor}99`
                          : `inset 0 0 0 1px ${posColor}22, 0 4px 12px rgba(0, 0, 0, 0.22)`,
                        fontFamily: 'Rajdhani, sans-serif',
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                      }}
                    >
                      <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 25, lineHeight: 1 }}>
                        {posLabel(pos.role)}
                      </span>
                      <span style={{ marginTop: 4, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#A7A7B8' }}>
                        POSIÇÃO
                      </span>
                    </div>
                  )}
                </div>

                {/* Live match data stays visible after replacing the token with a card. */}
                {ratingMode && player && r !== undefined && (
                  <span
                    className="absolute left-1/2 rounded font-black leading-none"
                    style={{
            bottom: -10, transform: 'translateX(-50%)', fontSize: 12, padding: '3px 5px',
                      color: ratingColor(r), background: '#0B0B14', border: `1px solid ${ratingColor(r)}`,
                      fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap', zIndex: 5,
                    }}
                  >
                    {r.toFixed(1)}
                  </span>
                )}
                {ratingMode && player && (g > 0 || a > 0) && (
                  <span
                    className="absolute rounded-full font-black leading-none"
                    style={{
                      top: -9, right: -9, fontSize: 11, padding: '2px 3px',
                      color: '#FFF', background: '#0B0B14', border: '1px solid #FFFFFF55',
                      fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap', zIndex: 5,
                    }}
                  >
                    {g > 0 ? `⚽${g > 1 ? g : ''}` : ''}{a > 0 ? `🅰${a > 1 ? a : ''}` : ''}
                  </span>
                )}
                {ratingMode && player && disc && (disc.red || disc.injury || disc.yellow > 0) && (
                  <span
                    className="absolute leading-none"
                    style={{ top: -9, left: -9, fontSize: 11, whiteSpace: 'nowrap', zIndex: 5 }}
                  >
                    {disc.red ? '🟥' : disc.yellow > 1 ? '🟨🟨' : disc.yellow === 1 ? '🟨' : ''}{disc.injury ? '🩹' : ''}
                  </span>
                )}
                {ratingMode && isEmergencyGoalkeeperSlot && player && (
                  <span
                    className="absolute rounded-full font-black leading-none"
                    style={{ bottom: -9, left: -9, fontSize: 9, padding: '2px 4px', color: '#FDE68A', background: '#29200A', border: '1px solid #D4AF37', fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap', zIndex: 5 }}
                  >
                    GK
                  </span>
                )}
                {ratingMode && isVacatedSlot && (
                  <span
                    className="absolute rounded-full font-black leading-none"
                    style={{ bottom: -9, right: -9, fontSize: 8, padding: '2px 4px', color: '#9CA3AF', background: '#11111B', border: '1px solid #4B5563', fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap', zIndex: 5 }}
                  >
                    VAGA
                  </span>
                )}
              </div>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={index}
            className="absolute flex flex-col items-center"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: photoSize }}
            // Centre the token on its (%) point, then layer framer's scale on top.
            transformTemplate={(_, generated) => `translate(-50%, calc(-50% - ${compact ? 8 : 10}px)) ${generated}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
            onClick={() => player && onPlayerClick?.(player, index)}
          >
            {/* Player circle (relative so the rating / goal badges can overlay it in match mode) */}
            <div className="relative" style={{ width: photoSize, height: photoSize }}>
              <div
                className="rounded-full flex items-center justify-center font-bold cursor-pointer overflow-hidden w-full h-full"
                style={{
                  // Expulso: só a FOTO fica escurecida/cinza — os badges (nota, 🟥) seguem coloridos.
                  opacity: sentOff ? 0.4 : 1,
                  filter: sentOff ? 'grayscale(1)' : 'none',
                  background: player
                    ? `radial-gradient(circle, ${rarityColor}33 0%, #0F0F1A 100%)`
                    : isVacatedSlot ? 'rgba(255,255,255,0.035)' : '#1A1A2A',
                  border: isSelected ? '2px solid #FFF' : isVacatedSlot ? '1px dashed #6B7280' : `2px solid ${player ? tokenColor : '#333'}`,
                  boxShadow: isSelected
                    ? '0 0 12px #FFF'
                    : variants.length > 0
                      ? `0 0 10px ${tokenColor}99`
                      : player && player.rarity === 'immortal'
                        ? `0 0 12px ${rarityColor}88`
                        : player ? `0 0 6px ${rarityColor}44` : 'none',
                  fontSize: compact ? '10px' : '13px',
                  color: isSelected ? '#FFF' : (player ? rarityColor : isVacatedSlot ? '#9CA3AF' : '#555'),
                }}
              >
                {player && photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={player.shortName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                    style={{ objectPosition: 'center top', scale: '1.25', transform: 'translateY(1px)' }}
                  />
                ) : (
                  initials
                )}
              </div>

              {isEmergencyGoalkeeperSlot && player && (
                <span
                  className="absolute leading-none rounded-full font-black"
                  title="Goleiro emergencial"
                  style={{
                    top: -6, right: -8, fontSize: compact ? '8px' : '9px', padding: '2px 3px',
                    color: '#FDE68A', background: '#29200A', border: '1px solid #D4AF37',
                    fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap', zIndex: 4,
                  }}
                >
                  🧤 GK
                </span>
              )}

              {isVacatedSlot && (
                <span
                  className="absolute leading-none rounded-full font-black"
                  title="Posição deixada pelo goleiro emergencial"
                  style={{
                    top: -6, right: -12, fontSize: compact ? '7px' : '8px', padding: '2px 3px',
                    color: '#9CA3AF', background: '#11111B', border: '1px solid #4B5563',
                    fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap', zIndex: 4,
                  }}
                >
                  VAGA
                </span>
              )}

              {/* Match mode — rating badge over the bottom edge, goals/assists at the top-right */}
              {ratingMode && player && (() => {
                const rc = r !== undefined ? ratingColor(r) : '#8A8A9A';
                return (
                  <>
                    <span
                      className="absolute left-1/2 font-black leading-none rounded"
                      style={{
              bottom: -7, transform: 'translateX(-50%)',
              fontSize: compact ? '9px' : '11px', padding: '2px 4px',
                        color: rc, background: '#0b0b14', border: `1px solid ${rc}`,
                        fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap',
                      }}
                    >
                      {r !== undefined ? r.toFixed(1) : '—'}
                    </span>
                    {(g > 0 || a > 0) && (
                      <span
                        className="absolute leading-none rounded-full font-black"
                        style={{
                          top: -5, right: -5, fontSize: compact ? '9px' : '11px', padding: '1px 3px',
                          background: '#0b0b14', border: '1px solid #ffffff44', whiteSpace: 'nowrap',
                          fontFamily: 'Rajdhani, sans-serif',
                        }}
                      >
                        {g > 0 ? `⚽${g > 1 ? g : ''}` : ''}{a > 0 ? `🅰${a > 1 ? a : ''}` : ''}
                      </span>
                    )}
                    {/* 🟨🟥🩹 Disciplina/lesão — canto superior esquerdo */}
                    {disc && (disc.red || disc.injury || disc.yellow > 0) && (
                      <span className="absolute leading-none" style={{ top: -5, left: -5, fontSize: compact ? '9px' : '11px', whiteSpace: 'nowrap' }}>
                        {disc.red ? '🟥' : disc.yellow > 1 ? '🟨🟨' : disc.yellow === 1 ? '🟨' : ''}{disc.injury ? '🩹' : ''}
                      </span>
                    )}
                  </>
                );
              })()}

              {/* ⭐ Característica(s) do jogador — chip com ícone (canto inferior esquerdo). */}
              {variants.length > 0 && (
                <span
                  className="absolute leading-none rounded-full font-black flex items-center justify-center"
                  title={variants.map(v => v.label).join(' · ')}
                  style={{
                    bottom: -5, left: -12, fontSize: compact ? '8.5px' : '10.5px', padding: '1.5px 3px', gap: '1px',
                    background: '#0b0b14', border: `1px solid ${variants[0].color}`,
                    boxShadow: `0 0 5px ${variants[0].color}77`, whiteSpace: 'nowrap', zIndex: 3,
                  }}
                >
                  {variants.map(v => v.icon).join('')}
                </span>
              )}
            </div>

            {/* Position badge — squad screens only (in a live match the position is obvious from the spot) */}
            {!ratingMode && (
            <div
              className="text-center font-bold mt-0.5 flex flex-col items-center gap-0.5"
              style={{
                fontSize: compact ? '7px' : '8px',
                color: posColor,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}
            >
              <span>{posLabel(pos.role)}</span>
              {player && player.position !== pos.role && (() => {
                const wouldBeOOP = !isPlayerInPosition(player, pos.role);
                // 🃏 Coringa joga em qualquer posição sem penalidade — mostra como neutro, nunca como OOP vermelho.
                const isOOP = wouldBeOOP && !player.coringa;
                const isCoringaOOP = wouldBeOOP && player.coringa;
                const color = isOOP ? '#EF4444' : isCoringaOOP ? '#EF4444' : '#22C55E';
                return (
                  <span
                    className="px-1 py-0.2 rounded font-extrabold"
                    style={{
                      fontSize: compact ? '5.5px' : '7.5px',
                      background: `${color}22`,
                      color,
                      border: `1px solid ${color}44`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isCoringaOOP ? `🃏 ${posLabel(player.position)}` : isOOP ? `OOP: ${posLabel(player.position)}` : `${posLabel(player.position)}`}
                  </span>
                );
              })()}
            </div>
            )}

            {/* Player name */}
            {player && (
              <div
                className="text-center font-semibold leading-none"
                style={{
                  fontSize: compact ? '6px' : '7px',
                  color: '#CCC',
                  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  maxWidth: ratingMode ? photoSize + 8 : photoSize + 18, // tighter in match mode → never overlaps a neighbour
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: ratingMode ? (compact ? 7 : 8) : 2, // clear the overlapping rating badge
                }}
              >
                {player.shortName}
              </div>
            )}
            {player && !ratingMode && (
              <div
                className="w-1.5 h-1.5 rounded-full mt-0.5"
                style={{ background: getChemColor(chemScore) }}
              />
            )}
          </motion.div>
        );
      })}

      {/* Touch browsers do not provide a dependable native drag ghost. Render a
          complete card in the field and move it with the captured pointer so
          the user sees the same card they picked up, not just its portrait. */}
      {pointerDrag && (() => {
        const draggedPlayer = players[pointerDrag.index];
        if (!draggedPlayer) return null;
        return (
          <div
            className="absolute z-50 pointer-events-none"
            aria-hidden="true"
            style={{
              left: pointerDrag.x,
              top: pointerDrag.y,
              width: displayedCardWidth,
              height: displayedCardHeight,
              transform: 'translate(-50%, -50%)',
              opacity: 0.96,
              filter: 'drop-shadow(0 10px 16px rgba(0,0,0,.55))',
            }}
          >
            <div style={{ width: FIELD_CARD_WIDTH, height: FIELD_CARD_HEIGHT, transform: `scale(${cardScale})`, transformOrigin: 'center center' }}>
              <PlayerCard player={draggedPlayer} compact lite effectiveStats={effectiveStats[draggedPlayer.id]} />
            </div>
          </div>
        );
      })()}

      {/* In the result view the enlarged cards already identify the formation
          through their positions; keeping this label would compete with the GK card. */}
      {!showPlayerCards && (
        <div
          className="absolute bottom-2 right-2 text-xs font-bold"
          style={{ color: '#C9A84C', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
        >
          {formation.name}
        </div>
      )}
    </div>
  );
}
