// UCL Immortals — Immortal Report Page
// Final summary after the tournament

import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { COACHES, FORMATIONS } from '../lib/gameData';
import { calculateChemistry, getAllPlayedMatchResults } from '../lib/gameEngine';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';
const TROPHY_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-trophy-oKrRV4CKRhdEsz5wuhybrL.webp';

export default function ReportPage() {
  const { state, dispatch } = useGame();
  const { report, playerTeam, champion, leagueResults, knockoutBracket } = state;

  const isChampion = champion === playerTeam?.id;
  const coach = COACHES.find(c => c.id === playerTeam?.coachId);

  const formation = FORMATIONS.find(f => f.id === playerTeam?.formationId);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];

  const chemData = playerTeam
    ? calculateChemistry(playerTeam.players.slice(0, 11), playerTeam.coachId, formationRoles)
    : null;

  // Every played match across the league + full knockout (play-offs → final).
  const allResults = getAllPlayedMatchResults(leagueResults, knockoutBracket) as any[];

  const playerResults = allResults.filter(
    r => r.homeTeamId === playerTeam?.id || r.awayTeamId === playerTeam?.id
  );

  const totalGoals = playerResults.reduce((sum: number, r: any) => {
    return sum + (r.homeTeamId === playerTeam?.id ? r.homeGoals : r.awayGoals);
  }, 0);

  const wins = playerResults.filter((r: any) => r.winner === playerTeam?.id).length;
  const draws = playerResults.filter((r: any) => r.winner === null).length;
  const losses = playerResults.filter((r: any) => r.winner !== null && r.winner !== playerTeam?.id).length;

  const handlePlayAgain = () => {
    dispatch({ type: 'RESET_GAME' });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Celebration background */}
      {isChampion && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 6 + 2,
                height: Math.random() * 6 + 2,
                background: i % 3 === 0 ? '#C9A84C' : i % 3 === 1 ? '#FFFFFF' : '#1B4FD8',
                left: `${Math.random() * 100}%`,
                top: '-10px',
              }}
              animate={{
                y: ['0vh', '110vh'],
                x: [0, (Math.random() - 0.5) * 200],
                rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
              }}
              transition={{
                duration: 3 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 5,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-8 h-8 object-contain" />
        <span className="text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
          RELATÓRIO IMORTAL
        </span>
      </div>

      <div className="relative z-10 flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
        {/* Champion banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="text-center mb-8"
        >
          {isChampion ? (
            <>
              <motion.div
                animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex justify-center mb-4"
              >
                <img src={TROPHY_URL} alt="Trophy" className="w-32 h-40 object-contain"
                  style={{ filter: 'drop-shadow(0 0 40px rgba(201,168,76,0.8))' }} />
              </motion.div>
              <h1 className="text-6xl font-black tracking-widest"
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  color: '#C9A84C',
                  textShadow: '0 0 60px rgba(201,168,76,0.6)',
                }}>
                CAMPEÃO!
              </h1>
              <p className="text-xl mt-2" style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>
                {playerTeam?.name} conquistou a Champions League!
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">🏅</div>
              <h1 className="text-5xl font-black tracking-widest"
                style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
                CAMPANHA ENCERRADA
              </h1>
              <p className="text-base mt-2" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                {state.botTeams.find(t => t.id === champion)?.name ?? 'Outro time'} foi o campeão desta edição.
              </p>
            </>
          )}
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'JOGOS', value: playerResults.length, color: '#FFFFFF' },
            { label: 'VITÓRIAS', value: wins, color: '#22C55E' },
            { label: 'GOLS', value: totalGoals, color: '#C9A84C' },
            { label: 'QUÍMICA', value: `${chemData?.total ?? 0}%`, color: '#3B82F6' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl p-4 text-center"
              style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
            >
              <div className="text-3xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs font-bold tracking-widest mt-1"
                style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* W/D/L */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl p-5 mb-6"
          style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
        >
          <div className="text-xs font-bold tracking-widest mb-4"
            style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
            DESEMPENHO GERAL
          </div>
          <div className="flex gap-4">
            <div className="flex-1 h-3 rounded-full overflow-hidden flex">
              <div className="h-full" style={{ width: `${(wins / Math.max(playerResults.length, 1)) * 100}%`, background: '#22C55E' }} />
              <div className="h-full" style={{ width: `${(draws / Math.max(playerResults.length, 1)) * 100}%`, background: '#EAB308' }} />
              <div className="h-full" style={{ width: `${(losses / Math.max(playerResults.length, 1)) * 100}%`, background: '#EF4444' }} />
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            {[
              { label: 'Vitórias', value: wins, color: '#22C55E' },
              { label: 'Empates', value: draws, color: '#EAB308' },
              { label: 'Derrotas', value: losses, color: '#EF4444' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-xs" style={{ color: s.color, fontFamily: 'Rajdhani, sans-serif' }}>
                  {s.value} {s.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Report highlights */}
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl p-5 mb-6"
            style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
          >
            <div className="text-xs font-bold tracking-widest mb-4"
              style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
              DESTAQUES DA CAMPANHA
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚽</span>
                <div>
                  <div className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                    Artilheiro
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>
                    {report.topScorer.name} — {report.topScorer.goals} gols
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">🧪</span>
                <div>
                  <div className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                    Química
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>
                    {report.chemistryHighlight} ({chemData?.total ?? 0}/100)
                  </div>
                </div>
              </div>
              {report.historicalRecreations.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-xl">⭐</span>
                  <div>
                    <div className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      Parcerias Históricas Recriadas
                    </div>
                    {report.historicalRecreations.map(trio => (
                      <div key={trio} className="text-sm font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
                        {trio}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {coach && (
                <div className="flex items-center gap-3">
                  <span className="text-xl">🧠</span>
                  <div>
                    <div className="text-xs" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                      Treinador
                    </div>
                    <div className="text-sm font-bold" style={{ color: '#FFFFFF', fontFamily: 'Rajdhani, sans-serif' }}>
                      {coach.name} — {coach.philosophy}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Squad summary */}
        {playerTeam && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl p-5 mb-8"
            style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}
          >
            <div className="text-xs font-bold tracking-widest mb-3"
              style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
              SEU ELENCO IMORTAL
            </div>
            <div className="flex flex-wrap gap-2">
              {playerTeam.players.slice(0, 11).map(p => (
                <div key={p.id}
                  className="px-2 py-1 rounded text-xs font-bold"
                  style={{
                    background: '#14142A',
                    border: '1px solid #1A1A2A',
                    color: '#FFFFFF',
                    fontFamily: 'Rajdhani, sans-serif',
                  }}>
                  {p.shortName}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Play again */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePlayAgain}
          className="w-full py-5 rounded-xl font-black text-2xl tracking-widest"
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
            color: '#080810',
            boxShadow: '0 0 40px rgba(201,168,76,0.4)',
          }}
        >
          🔄 JOGAR NOVAMENTE
        </motion.button>
      </div>
    </div>
  );
}
