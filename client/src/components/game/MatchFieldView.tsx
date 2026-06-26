// UCL Immortals — In-match formation view.
// Replaces the old plain ratings LIST shown during a match: now the player sees the team laid
// out on the pitch (formation), each card showing its live rating + goals/assists, plus the
// coach and key info (tactic, formation, chemistry, average rating). Fully responsive.

import { FORMATIONS, COACHES, getTacticById, Player } from '../../lib/gameData';
import FormationField from './FormationField';

interface MatchTeam {
  name: string;
  players: Player[];
  coachId: string;
  formationId: string;
  playStyle: string;
  totalChemistry?: number;
}

interface MatchFieldViewProps {
  team: MatchTeam;
  ratings: Record<string, number>;          // by player.id
  goalsByPlayer?: Record<string, number>;
  assistsByPlayer?: Record<string, number>;
  accent: string;
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

export default function MatchFieldView({ team, ratings, goalsByPlayer, assistsByPlayer, accent }: MatchFieldViewProps) {
  const formation = FORMATIONS.find(f => f.id === team.formationId) ?? FORMATIONS[0];
  const coach = COACHES.find(c => c.id === team.coachId);
  const tactic = getTacticById(team.playStyle);
  const starters = team.players.slice(0, 11);

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
              className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
              style={{ border: `2px solid ${accent}55`, objectPosition: 'center top' }}
            />
          ) : (
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 text-lg" style={{ background: '#14142a', border: `2px solid ${accent}55` }}>🎓</div>
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
          <Chip icon={tactic.icon} label="Tática" value={tactic.name} color="#818CF8" />
          {team.totalChemistry !== undefined && (
            <Chip icon="🔗" label="Química" value={`${team.totalChemistry}/100`} color="#22C55E" />
          )}
          <Chip icon="⭐" label="Nota média" value={avgRating ? avgRating.toFixed(1) : '—'} color={avgColor} />
        </div>

        {motm && (
          <div className="mt-2 text-[10px] font-bold" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
            👑 Melhor em campo: <b style={{ color: '#d4af37' }}>{motm.name}</b> ({motm.r.toFixed(1)})
          </div>
        )}
      </div>

      {/* ── The pitch with live ratings ── */}
      <FormationField
        formation={formation}
        players={starters}
        ratings={ratings}
        goalsByPlayer={goalsByPlayer}
        assistsByPlayer={assistsByPlayer}
      />
    </div>
  );
}
