// UCL Immortals — FormationField Component
// Tactical field with player positions and chemistry lines

import { motion } from 'framer-motion';
import { Player, Formation, getRarityColor, POS_PT } from '../../lib/gameData';
import { isPlayerInPosition } from '../../lib/gameEngine';
import { buildSofifaUrl } from './PlayerCard';

const posLabel = (pos: string) => POS_PT[pos] ?? pos;

interface FormationFieldProps {
  formation: Formation;
  players: (Player | undefined)[];
  chemistryScores?: Record<string, number>;
  showChemLines?: boolean;
  onPlayerClick?: (player: Player, posIndex: number) => void;
  compact?: boolean;
  selectedPlayerIndex?: number | null;
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
  onPlayerClick,
  compact = false,
  selectedPlayerIndex = null,
}: FormationFieldProps) {
  const fieldWidth = compact ? 300 : 410;
  const fieldHeight = compact ? 410 : 550;

  const getChemColor = (score: number) => {
    if (score >= 3) return '#22C55E';
    if (score >= 2) return '#EAB308';
    if (score >= 1) return '#F97316';
    return '#EF4444';
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        width: fieldWidth,
        height: fieldHeight,
        background: 'linear-gradient(180deg, #0A2A0A 0%, #0D3A0D 50%, #0A2A0A 100%)',
        border: '1px solid #1A4A1A',
      }}
    >
      {/* Field markings */}
      <svg
        className="absolute inset-0"
        width={fieldWidth}
        height={fieldHeight}
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

        {/* Chemistry lines */}
        {showChemLines && players.length >= 2 && formation.positions.map((pos, i) => {
          const player = players[i];
          if (!player) return null;
          const chemScore = chemistryScores[player.id] ?? 0;
          if (chemScore < 2) return null;

          return formation.positions.slice(i + 1, i + 3).map((pos2, j) => {
            const player2 = players[i + j + 1];
            if (!player2) return null;
            const chemScore2 = chemistryScores[player2.id] ?? 0;
            if (chemScore2 < 2) return null;

            const x1 = (pos.x / 100) * fieldWidth;
            const y1 = (pos.y / 100) * fieldHeight;
            const x2 = (pos2.x / 100) * fieldWidth;
            const y2 = (pos2.y / 100) * fieldHeight;
            const color = Math.min(chemScore, chemScore2) >= 3 ? '#22C55E' : '#EAB308';

            return (
              <line key={`${i}-${j}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth="1" strokeOpacity="0.4"
                strokeDasharray="4,4"
              />
            );
          });
        })}
      </svg>

      {/* Player tokens */}
      {formation.positions.map((pos, index) => {
        const player = players[index];
        const x = (pos.x / 100) * fieldWidth;
        const y = (pos.y / 100) * fieldHeight;
        const posColor = POSITION_COLORS[pos.role] || '#8A8A9A';
        const chemScore = player ? (chemistryScores[player.id] ?? 0) : 0;
        const rarityColor = player ? getRarityColor(player.rarity) : '#555';
        const initials = player ? (PLAYER_INITIALS[player.id] || player.shortName.slice(0, 2).toUpperCase()) : '?';
        const photoUrl = player ? buildSofifaUrl(player.id, 120) : null;
        const tokenSize = compact ? 34 : 48;

        const isSelected = selectedPlayerIndex === index;

        return (
          <motion.div
            key={index}
            className="absolute flex flex-col items-center"
            style={{
              left: x - tokenSize / 2,
              top: y - tokenSize / 2 - (compact ? 8 : 10),
              width: tokenSize,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
            onClick={() => player && onPlayerClick?.(player, index)}
          >
            {/* Player circle */}
            <div
              className="rounded-full flex items-center justify-center font-bold cursor-pointer overflow-hidden"
              style={{
                width: tokenSize,
                height: tokenSize,
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

            {/* Position badge */}
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

            {/* Player name */}
            {player && (
              <div
                className="text-center font-semibold leading-none"
                style={{
                  fontSize: compact ? '6px' : '7px',
                  color: '#CCC',
                  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  maxWidth: tokenSize + 16,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {player.shortName}
              </div>
            )}

            {/* Chemistry dot */}
            {player && (
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
