/** Shootout scoreboard and narration, shown under the pitch while the kicks play out on it. */
import { motion } from 'framer-motion';
import type { Team } from '@shared/game/engine/teamModel';

interface ShootoutPanelProps {
  homeTeam: Team;
  awayTeam: Team;
  penaltiesHome: boolean[];
  penaltiesAway: boolean[];
  homeScore: number;
  awayScore: number;
  pendingTeamId: string | null;
  commentary: string;
  winnerId: string | null;
  onFinish: () => void;
}

export default function ShootoutPanel(props: ShootoutPanelProps) {
  const { homeTeam, awayTeam, homeScore, awayScore, pendingTeamId, commentary, winnerId, onFinish } = props;
  const columns = [{ team: homeTeam, pens: props.penaltiesHome }, { team: awayTeam, pens: props.penaltiesAway }];
  return (
    <div className="flex-shrink-0 border-b px-3 sm:px-5 py-3" style={{ borderColor: 'rgba(255,215,0,0.25)', background: 'linear-gradient(165deg,#12121f,#0a0a14)' }}>
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[12px] font-black tracking-[0.22em] text-red-400" style={{ fontFamily: 'var(--font-game), sans-serif' }}>DISPUTA DE PÊNALTIS</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {[columns[0], null, columns[1]].map((col, ci) => {
          if (!col) return (
            <div key="score" className="text-center text-3xl sm:text-4xl font-black leading-none text-white" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {homeScore}<span className="text-gray-600 mx-1.5">-</span>{awayScore}
            </div>
          );
          const shooting = pendingTeamId === col.team.id;
          const slots = Math.max(5, col.pens.length + (shooting ? 1 : 0));
          return (
            <div key={ci} className="text-center rounded-xl py-2 px-1 transition-all" style={{ background: shooting ? 'rgba(255,215,0,0.08)' : 'transparent', border: `1px solid ${shooting ? 'rgba(255,215,0,0.4)' : 'transparent'}` }}>
              <div className="text-sm sm:text-base font-black truncate" style={{ fontFamily: 'var(--font-display), sans-serif', color: shooting ? '#ffd700' : '#fff' }}>{col.team.name.toUpperCase()}</div>
              <div className="flex gap-1 justify-center mt-1 flex-wrap">
                {Array.from({ length: slots }).map((_, i) => {
                  const v = col.pens[i];
                  const isNext = shooting && i === col.pens.length;
                  return <div key={i} className={`w-3 h-3 rounded-full ${isNext ? 'animate-pulse' : ''}`} style={{ background: v === true ? '#22c55e' : v === false ? '#ef4444' : '#141426', border: `1px solid ${isNext ? '#ffd700' : '#1f1f35'}` }} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs sm:text-sm font-bold text-gray-100 uppercase whitespace-pre-line leading-relaxed" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{commentary}</p>
      {winnerId && (
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3 text-center">
          <div className="text-xl sm:text-2xl font-black text-yellow-500 mb-2 tracking-wider" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            {(winnerId === homeTeam.id ? homeTeam.name : awayTeam.name).toUpperCase()} AVANÇA!
          </div>
        </motion.div>
      )}
    </div>
  );
}
