// UCL Immortals — In-match formation view.
// Replaces the old plain ratings LIST shown during a match: now the player sees the team laid
// out on the pitch (formation), each card showing its live rating + goals/assists, plus the
// coach and key info (tactic, formation, chemistry, average rating). Fully responsive.

import { FORMATIONS, COACHES, getTacticById } from '../../lib/gameData';
import { activeGoalkeeperForTeam, calculateChemistry, getTeamEffectiveStats, matchRoleForPlayer, type Team } from '../../lib/gameEngine';
import FormationField, { type EmergencyGoalkeeperDisplay } from './FormationField';

interface MatchFieldViewProps {
  team: Team;
  activePlayStyle?: string;
  ratings: Record<string, number>;          // by player.id
  goalsByPlayer?: Record<string, number>;
  assistsByPlayer?: Record<string, number>;
  disciplineByPlayer?: Record<string, { yellow: number; red: boolean; injury: boolean }>;
  accent: string;
  isKnockout?: boolean;
  isFinal?: boolean;
  isLosing?: boolean;
}

function Chip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 min-w-0"
      style={{ background: `${color}14`, border: `1px solid ${color}33` }}
    >
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[8px] font-bold uppercase tracking-wider truncate" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>{label}</div>
        <div className="text-[11px] font-black leading-tight truncate" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>{value}</div>
      </div>
    </div>
  );
}

export default function MatchFieldView({ team, activePlayStyle, ratings, goalsByPlayer, assistsByPlayer, disciplineByPlayer, accent, isKnockout, isFinal, isLosing }: MatchFieldViewProps) {
  const formation = FORMATIONS.find(f => f.id === team.formationId) ?? FORMATIONS[0];
  const coach = COACHES.find(c => c.id === team.coachId);
  const tactic = getTacticById(activePlayStyle ?? team.playStyle);
  const starters = team.players.slice(0, 11);
  const chemistry = calculateChemistry(
    starters,
    team.coachId,
    formation.positions.map(position => position.role),
    team.formationId,
  );

  // The match engine can move a line player to goal after a goalkeeper red card.
  // Derive the same state from the match events so the live and post-match field
  // views show the actual ten-man shape instead of continuing to display eleven
  // active-looking tokens.
  const redIds = new Set(
    Object.entries(disciplineByPlayer ?? {})
      .filter(([, discipline]) => discipline.red)
      .map(([playerId]) => playerId),
  );
  const goalkeeperSlotIndex = formation.positions.findIndex(position => position.role === 'GK');
  const originalGoalkeeper = starters.find(player => matchRoleForPlayer(team, player) === 'GK');
  const activeGoalkeeper = activeGoalkeeperForTeam(team, redIds);
  const emergencyGoalkeeper: EmergencyGoalkeeperDisplay | undefined = (
    activeGoalkeeper.emergency &&
    originalGoalkeeper &&
    goalkeeperSlotIndex >= 0 &&
    activeGoalkeeper.player.id !== originalGoalkeeper.id
  ) ? {
    playerId: activeGoalkeeper.player.id,
    goalkeeperSlotIndex,
    vacatedSlotIndex: starters.findIndex(player => player.id === activeGoalkeeper.player.id),
  } : undefined;
  const effectiveStats = getTeamEffectiveStats(team, {
    playStyle: activePlayStyle ?? team.playStyle,
    isKnockout,
    isFinal,
    isLosing,
    roleOverrides: emergencyGoalkeeper ? { [emergencyGoalkeeper.playerId]: 'GK' } : undefined,
  });

  const rated = starters.map(p => ratings[p.id]).filter((r): r is number => r !== undefined);
  const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
  // Man of the match (best-rated starter so far).
  const motm = starters.reduce<{ name: string; r: number } | null>((best, p) => {
    const r = ratings[p.id];
    if (r === undefined) return best;
    return !best || r > best.r ? { name: p.shortName, r } : best;
  }, null);

  const avgColor = avgRating >= 7.5 ? '#22c55e' : avgRating >= 6.5 ? '#e5e7eb' : avgRating <= 5.3 ? '#ef4444' : '#f59e0b';

  return (
    <div className="space-y-3">
      {/* ── Header: coach + key info ── */}
      <div className="rounded-xl p-3" style={{ background: '#0A0A14', border: '1px solid #18182a' }}>
        <div className="flex items-center gap-3 mb-2.5">
          {coach?.photoUrl ? (
            <img
              src={coach.photoUrl}
              alt={coach.name}
              referrerPolicy="no-referrer"
              className="w-[66px] h-[66px] rounded-lg object-cover flex-shrink-0"
              style={{ border: `2px solid ${accent}55`, objectPosition: 'center top' }}
            />
          ) : (
            <div className="w-[66px] h-[66px] rounded-lg flex items-center justify-center flex-shrink-0 text-2xl" style={{ background: '#14142a', border: `2px solid ${accent}55` }}>🎓</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>Técnico</div>
            <div className="text-sm font-black leading-tight truncate" style={{ color: '#FFF', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em' }}>
              {coach?.name ?? '—'}
            </div>
            {coach?.philosophy && (
              <div className="text-[10px] font-bold truncate" style={{ color: accent, fontFamily: 'Rajdhani, sans-serif' }}>{coach.philosophy}</div>
            )}
          </div>
        </div>

        {/* Info chips — wrap cleanly on mobile, sit in a row on wider screens */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <Chip icon="📐" label="Formação" value={formation.name} color={accent} />
          <Chip icon={tactic.icon} label={activePlayStyle ? 'Tática atual' : 'Tática inicial'} value={tactic.name} color="#818CF8" />
          <Chip icon="🔗" label="Química" value={`${chemistry.total}`} color="#22C55E" />
          <Chip icon="⭐" label="Nota média" value={avgRating ? avgRating.toFixed(1) : '—'} color={avgColor} />
        </div>

        {motm && (
          <div className="mt-2 text-[10px] font-bold" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
            👑 Melhor em campo: <b style={{ color: '#d4af37' }}>{motm.name}</b> ({motm.r.toFixed(1)})
          </div>
        )}
      </div>

      {/* ── The pitch with live ratings ── */}
      {emergencyGoalkeeper && originalGoalkeeper && (
        <div
          className="rounded-xl px-3 py-2"
          role="status"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }}
        >
          <div className="flex items-center gap-2 text-[11px] font-black" style={{ color: '#FCA5A5', fontFamily: 'Rajdhani, sans-serif' }}>
            <span>🟥 {originalGoalkeeper.shortName} foi expulso</span>
            <span style={{ color: '#6B7280' }}>•</span>
            <span style={{ color: '#FDE68A' }}>🧤 {activeGoalkeeper.player.shortName} assumiu o gol</span>
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
            O time segue com 10 jogadores e o goleiro emergencial tem aptidão reduzida para defender.
          </div>
        </div>
      )}
      <FormationField
        formation={formation}
        players={starters}
        showPlayerCards
        ratings={ratings}
        goalsByPlayer={goalsByPlayer}
        assistsByPlayer={assistsByPlayer}
        disciplineByPlayer={disciplineByPlayer}
        emergencyGoalkeeper={emergencyGoalkeeper}
        effectiveStats={effectiveStats}
      />
    </div>
  );
}
