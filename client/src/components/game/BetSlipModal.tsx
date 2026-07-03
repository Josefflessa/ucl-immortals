// UCL Immortals — slip de PALPITE. Escolha um placar + valor. Sem odds por confronto:
// só os múltiplos fixos (1.5× resultado · 2.5× placar exato) como info genérica.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bet, BET_MAX_GOALS, BET_OUTCOME_MULT, BET_EXACT_MULT } from '../../lib/bets';

function Stepper({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-black tracking-widest text-gray-400 truncate max-w-[110px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => set(Math.max(0, value - 1))} className="w-8 h-8 rounded-lg font-black" style={{ background: '#1A1A2A', color: '#C9A84C', border: '1px solid #333' }}>−</button>
        <span className="w-8 text-center text-2xl font-black tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{value}</span>
        <button onClick={() => set(Math.min(max, value + 1))} className="w-8 h-8 rounded-lg font-black" style={{ background: '#1A1A2A', color: '#C9A84C', border: '1px solid #333' }}>+</button>
      </div>
    </div>
  );
}

export default function BetSlipModal({ homeName, awayName, existing, remainingCap, points, onConfirm, onCancelBet, onClose }: {
  homeName: string; awayName: string; existing?: Bet; remainingCap: number; points: number;
  onConfirm: (homeGoals: number, awayGoals: number, stake: number) => void; onCancelBet?: () => void; onClose: () => void;
}) {
  const [hg, setHg] = useState(existing?.homeGoals ?? 1);
  const [ag, setAg] = useState(existing?.awayGoals ?? 0);
  const maxStake = Math.max(0, Math.min(remainingCap, points));
  const [stake, setStake] = useState(existing?.stake ?? Math.min(50, maxStake));
  const stakeOk = stake > 0 && stake <= maxStake;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(6,6,14,0.92)' }} onClick={onClose}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0B0B14', border: '1px solid #C9A84C55' }}>
        <div className="px-5 py-3 relative" style={{ background: 'linear-gradient(135deg,#171206,#0B0B14)', borderBottom: '1px solid #1d1d2f' }}>
          <button onClick={onClose} aria-label="Fechar"
            className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-base font-black transition-transform hover:scale-110"
            style={{ background: '#1A1A2A', color: '#9A9AAA', border: '1px solid #333' }}>✕</button>
          <div className="text-lg font-black tracking-widest pr-8" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>🎯 PALPITE</div>
          <div className="text-[11px] pr-8" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Chute o placar. Acertou o resultado → {BET_OUTCOME_MULT}× · placar exato → {BET_EXACT_MULT}×.</div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Stepper label={homeName} value={hg} set={setHg} max={BET_MAX_GOALS} />
            <span className="text-xl font-black text-gray-600">×</span>
            <Stepper label={awayName} value={ag} set={setAg} max={BET_MAX_GOALS} />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold tracking-widest mb-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              <span>VALOR APOSTADO</span><span>resta na rodada: {remainingCap} · saldo: {points}</span>
            </div>
            <input type="number" min={1} max={maxStake} value={stake}
              onChange={e => setStake(Math.max(0, Math.min(maxStake, Math.floor(Number(e.target.value) || 0))))}
              className="w-full px-3 py-2 rounded-lg text-lg font-black tabular-nums"
              style={{ background: '#07070f', border: `1px solid ${stakeOk ? '#C9A84C55' : '#EF444455'}`, color: '#FFF', fontFamily: 'Bebas Neue, sans-serif' }} />
            <div className="mt-1 text-[11px]" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
              Ganho potencial: {Math.round(stake * BET_OUTCOME_MULT)} (resultado) · {Math.round(stake * BET_EXACT_MULT)} (placar)
            </div>
          </div>

          <div className="flex gap-2">
            <button disabled={!stakeOk} onClick={() => stakeOk && onConfirm(hg, ag, stake)}
              className="flex-1 py-2.5 rounded-lg font-black tracking-widest disabled:opacity-40"
              style={{ fontFamily: 'Bebas Neue, sans-serif', background: '#C9A84C', color: '#080810' }}>
              {existing ? 'ATUALIZAR PALPITE' : 'CONFIRMAR PALPITE'}
            </button>
            {existing && onCancelBet && (
              <button onClick={onCancelBet} className="px-3 py-2.5 rounded-lg font-black" style={{ fontFamily: 'Rajdhani, sans-serif', background: '#1A1A2A', color: '#F87171', border: '1px solid #333' }}>
                🗑
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
