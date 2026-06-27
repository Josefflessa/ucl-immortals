// UCL Immortals — FormationField Component
// Tactical field with player positions and chemistry lines

import { motion } from 'framer-motion';
import { Player, Formation, getRarityColor, POS_PT } from '../../lib/gameData';
import { isPlayerInPosition, ChemLink, ChemLinkType } from '../../lib/gameEngine';
import { buildSofifaUrl } from './PlayerCard';

const posLabel = (pos: string) => POS_PT[pos] ?? pos;

// Connection colours by link type — shared with the legend in the squad screen.
export const CHEM_LINK_COLOR: Record<ChemLinkType, string> = {
  club: '#C9A84C',    // mesmo clube
  nation: '#3B82F6',  // mesma nação
  coach: '#A855F7',   // mesmo técnico histórico
  partner: '#22C55E', // dupla histórica
};

interface FormationFieldProps {
  formation: Formation;
  players: (Player | undefined)[];
  chemistryScores?: Record<string, number>;
  showChemLines?: boolean;
  chemLinks?: ChemLink[];
  onPlayerClick?: (player: Player, posIndex: number) => void;
  compact?: boolean;
  selectedPlayerIndex?: number | null;
  // Match mode — when provided, each token shows the live RATING (colour-coded) plus goal/assist
  // markers instead of the chemistry dot. Keyed by player.id (unique within a single XI).
  ratings?: Record<string, number>;
  goalsByPlayer?: Record<string, number>;
  assistsByPlayer?: Record<string, number>;
}

const POSITION_COLORS: Record<string, string> = {
  GK: '#F59E0B',
  CB: '#3B82F6', LB: '#3B82F6', RB: '#3B82F6',
  CDM: '#10B981', CM: '#10B981', CAM: '#10B981', LM: '#10B981', RM: '#10B981',
  LW: '#EF4444', RW: '#EF4444', ST: '#EF4444', CF: '#EF4444',
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

export default function FormationField({
  formation,
  players,
  chemistryScores = {},
  showChemLines = false,
  chemLinks,
  onPlayerClick,
  compact = false,
  selectedPlayerIndex = null,
  ratings,
  goalsByPlayer,
  assistsByPlayer,
}: FormationFieldProps) {
  const ratingMode = !!ratings;
  const ratingColor = (r: number) => r >= 8.5 ? '#d4af37' : r >= 7.5 ? '#22c55e' : r >= 6.5 ? '#e5e7eb' : r <= 5.3 ? '#ef4444' : '#f59e0b';
  // Intrinsic aspect used for the SVG viewBox + token sizing maths. The field itself is now
  // FLUID: it fills its container up to maxW and keeps this aspect ratio, so it never overflows
  // on mobile (no sideways drag) and stays centred. Positions are placed in % of the field.
  const fieldWidth = compact ? 300 : 410;
  const fieldHeight = compact ? 410 : 550;
  const maxW = compact ? 300 : 410;

  const getChemColor = (score: number) => {
    if (score >= 3) return '#22C55E';
    if (score >= 2) return '#EAB308';
    if (score >= 1) return '#F97316';
    return '#EF4444';
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden mx-auto"
      style={{
        width: '100%',
        maxWidth: maxW,
        aspectRatio: `${fieldWidth} / ${fieldHeight}`,
        background: 'linear-gradient(180deg, #0A2A0A 0%, #0D3A0D 50%, #0A2A0A 100%)',
        border: '1px solid #1A4A1A',
      }}
    >
      {/* Field markings — scales with the container via viewBox */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
        preserveAspectRatio="none"
        style={{ opacity: 0.3 }}
      >
        {/* Outer border */}
        <rect x="10" y="10" width={fieldWidth - 20} height={fieldHeight - 20}
          fill="none" stroke="#2A6A2A" strokeWidth="1.5" />

        {/* Center line */}
        <line x1="10" y1={fieldHeight / 2} x2={fieldWidth - 10} y2={fieldHeight / 2}
          stroke="#2A6A2A" strokeWidth="1" />

        {/* Center circle */}
        <circle cx={fieldWidth / 2} cy={fieldHeight / 2} r={compact ? 35 : 45}
          fill="none" stroke="#2A6A2A" strokeWidth="1" />
        <circle cx={fieldWidth / 2} cy={fieldHeight / 2} r="3"
          fill="#2A6A2A" />

        {/* Top penalty area */}
        <rect x={fieldWidth * 0.25} y="10" width={fieldWidth * 0.5} height={fieldHeight * 0.18}
          fill="none" stroke="#2A6A2A" strokeWidth="1" />
        {/* Top goal area */}
        <rect x={fieldWidth * 0.35} y="10" width={fieldWidth * 0.3} height={fieldHeight * 0.08}
          fill="none" stroke="#2A6A2A" strokeWidth="1" />

        {/* Bottom penalty area */}
        <rect x={fieldWidth * 0.25} y={fieldHeight - fieldHeight * 0.18 - 10}
          width={fieldWidth * 0.5} height={fieldHeight * 0.18}
          fill="none" stroke="#2A6A2A" strokeWidth="1" />
        {/* Bottom goal area */}
        <rect x={fieldWidth * 0.35} y={fieldHeight - fieldHeight * 0.08 - 10}
          width={fieldWidth * 0.3} height={fieldHeight * 0.08}
          fill="none" stroke="#2A6A2A" strokeWidth="1" />

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
            const x1 = (posA.x / 100) * fieldWidth, y1 = (posA.y / 100) * fieldHeight;
            const x2 = (posB.x / 100) * fieldWidth, y2 = (posB.y / 100) * fieldHeight;
            const color = CHEM_LINK_COLOR[link.type];
            const hasSel = selectedPlayerIndex !== null && selectedPlayerIndex < formation.positions.length;
            const touchesSel = hasSel && (link.aIndex === selectedPlayerIndex || link.bIndex === selectedPlayerIndex);
            const opacity = hasSel ? (touchesSel ? 0.95 : 0.1) : 0.5;
            const width = touchesSel ? 2.6 : 1.6;
            return (
              <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth={width} strokeOpacity={opacity} strokeLinecap="round" />
            );
          })}
        </svg>
      )}

      {/* Player tokens — positioned in % of the field so they track the fluid size */}
      {formation.positions.map((pos, index) => {
        const player = players[index];
        const posColor = POSITION_COLORS[pos.role] || '#8A8A9A';
        const chemScore = player ? (chemistryScores[player.id] ?? 0) : 0;
        const rarityColor = player ? getRarityColor(player.rarity) : '#555';
        const initials = player ? (PLAYER_INITIALS[player.id] || player.shortName.slice(0, 2).toUpperCase()) : '?';
        const photoUrl = player ? buildSofifaUrl(player.id, 120) : null;
        const tokenSize = compact ? 34 : 48;
        // Match (rating) mode: a more compact token with the rating/goals OVERLAID on the photo
        // (not stacked below), so cards never overlap their neighbours on tight formations.
        const photoSize = ratingMode ? (compact ? 30 : 40) : tokenSize;

        const isSelected = selectedPlayerIndex === index;
        const r = player ? ratings?.[player.id] : undefined;
        const g = player ? (goalsByPlayer?.[player.id] ?? 0) : 0;
        const a = player ? (assistsByPlayer?.[player.id] ?? 0) : 0;

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
                  background: player
                    ? `radial-gradient(circle, ${rarityColor}33 0%, #0F0F1A 100%)`
                    : '#1A1A2A',
                  border: isSelected ? '2px solid #FFF' : `2px solid ${player ? rarityColor : '#333'}`,
                  boxShadow: isSelected
                    ? '0 0 12px #FFF'
                    : player && player.rarity === 'immortal'
                      ? `0 0 12px ${rarityColor}88`
                      : player ? `0 0 6px ${rarityColor}44` : 'none',
                  fontSize: compact ? '10px' : '13px',
                  color: isSelected ? '#FFF' : (player ? rarityColor : '#555'),
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

              {/* Match mode — rating badge over the bottom edge, goals/assists at the top-right */}
              {ratingMode && player && (() => {
                const rc = r !== undefined ? ratingColor(r) : '#8A8A9A';
                return (
                  <>
                    <span
                      className="absolute left-1/2 font-black leading-none rounded"
                      style={{
                        bottom: -6, transform: 'translateX(-50%)',
                        fontSize: compact ? '7.5px' : '9px', padding: '1px 3px',
                        color: rc, background: '#0b0b14', border: `1px solid ${rc}`,
                        fontFamily: 'Rajdhani, sans-serif', whiteSpace: 'nowrap',
                      }}
                    >
                      {r !== undefined ? r.toFixed(1) : '—'}
                    </span>
                    {(g > 0 || a > 0) && (
                      <span
                        className="absolute leading-none rounded-full"
                        style={{
                          top: -4, right: -4, fontSize: compact ? '7px' : '8px', padding: '0 2px',
                          background: '#0b0b14', border: '1px solid #ffffff33', whiteSpace: 'nowrap',
                        }}
                      >
                        {g > 0 ? `⚽${g > 1 ? g : ''}` : ''}{a > 0 ? `🅰${a > 1 ? a : ''}` : ''}
                      </span>
                    )}
                  </>
                );
              })()}
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
                const isOOP = !isPlayerInPosition(player, pos.role);
                return (
                  <span
                    className="px-1 py-0.2 rounded font-extrabold"
                    style={{
                      fontSize: compact ? '5.5px' : '7.5px',
                      background: isOOP ? '#EF444422' : '#22C55E22',
                      color: isOOP ? '#EF4444' : '#22C55E',
                      border: `1px solid ${isOOP ? '#EF444444' : '#22C55E44'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isOOP ? `OOP: ${posLabel(player.position)}` : `${posLabel(player.position)}`}
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

      {/* Formation label */}
      <div
        className="absolute bottom-2 right-2 text-xs font-bold"
        style={{ color: '#C9A84C', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em' }}
      >
        {formation.name}
      </div>
    </div>
  );
}
