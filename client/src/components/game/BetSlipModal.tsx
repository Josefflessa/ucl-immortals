// UCL Immortals — slip de PALPITE. Escolha um placar + valor. Sem odds por confronto:
// só os múltiplos fixos (1.5× resultado · 2.5× placar exato) como info genérica.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bet, BET_MAX_GOALS, BET_OUTCOME_MULT, BET_EXACT_MULT } from '../../lib/bets';
import { Button } from '../../design-system';

function Stepper({ label, value, set, max }: { label: string; value: number; set: (n: number) => void; max: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-black tracking-widest text-gray-400 truncate max-w-[110px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => set(Math.max(0, value - 1))} className="ui-icon-btn" aria-label={`Diminuir ${label}`}>−</button>
        <span className="w-8 text-center text-2xl font-black tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{value}</span>
        <button onClick={() => set(Math.min(max, value + 1))} className="ui-icon-btn" aria-label={`Aumentar ${label}`}>+</button>
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
      className="ui-modal-backdrop" onClick={onClose}>
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        className="ui-modal max-w-sm">
        <div className="ui-modal__header">
          <div>
            <h2 className="ui-modal__title">🎯 Palpite</h2>
            <div className="mt-2 text-xs text-[var(--ui-text-muted)]">Chute o placar. Acertou o resultado → {BET_OUTCOME_MULT}× · placar exato → {BET_EXACT_MULT}×.</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="ui-icon-btn">✕</button>
        </div>

        <div className="ui-modal__body ui-stack">
          <div className="flex items-center justify-center gap-3">
            <Stepper label={homeName} value={hg} set={setHg} max={BET_MAX_GOALS} />
            <span className="text-xl font-black text-gray-600">×</span>
            <Stepper label={awayName} value={ag} set={setAg} max={BET_MAX_GOALS} />
          </div>

          <div>
            <div className="flex justify-between gap-3 text-[10px] font-bold tracking-widest mb-1 text-[var(--ui-text-faint)]">
              <span>VALOR APOSTADO</span><span>resta na rodada: {remainingCap} · saldo: {points}</span>
            </div>
            <input type="number" min={1} max={maxStake} value={stake}
              onChange={e => setStake(Math.max(0, Math.min(maxStake, Math.floor(Number(e.target.value) || 0))))}
              className={`ui-input text-lg font-display tabular-nums ${!stakeOk ? 'border-[var(--ui-danger)]' : ''}`} />
            <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
              Ganho potencial: {Math.round(stake * BET_OUTCOME_MULT)} (resultado) · {Math.round(stake * BET_EXACT_MULT)} (placar)
            </div>
          </div>

          <div className="flex gap-2">
            <Button intent="primary" size="large" className="flex-1" disabled={!stakeOk} onClick={() => stakeOk && onConfirm(hg, ag, stake)}>
              {existing ? 'ATUALIZAR PALPITE' : 'CONFIRMAR PALPITE'}
            </Button>
            {existing && onCancelBet && (
              <button onClick={onCancelBet} aria-label="Cancelar palpite" className="ui-icon-btn text-[var(--ui-danger)]">
                🗑
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
