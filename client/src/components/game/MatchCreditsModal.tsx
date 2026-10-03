import type { MatchPoints } from '@shared/game/shop';
import { Button, GameModal } from '../../design-system';

interface MatchCreditsModalProps {
  points: MatchPoints;
  onClose: () => void;
}

/** Shared post-match reward summary for league and knockout matches. */
export default function MatchCreditsModal({ points, onClose }: MatchCreditsModalProps) {
  const venueLabel = points.supportersVenue === 'home'
    ? 'em casa'
    : points.supportersVenue === 'away'
      ? 'fora'
      : 'neutro';
  const outcomeLabel = points.outcome === 'win' ? 'Vitória' : points.outcome === 'draw' ? 'Empate' : 'Derrota';
  const outcomeColor = points.outcome === 'win' ? '#4ADE80' : points.outcome === 'draw' ? '#FACC15' : '#FB7185';
  const rewardRows = [
    { label: outcomeLabel, value: `+${points.base}`, color: outcomeColor },
    points.gdBonus > 0 ? { label: 'Saldo de gols', value: `+${points.gdBonus}`, color: '#E8C84A' } : null,
    points.goalsBonus > 0 ? { label: 'Gols marcados', value: `+${points.goalsBonus}`, color: '#E8C84A' } : null,
    points.csBonus > 0 ? { label: 'Jogo sem sofrer gol', value: `+${points.csBonus}`, color: '#60A5FA' } : null,
    (points.supportersBonus ?? 0) > 0 ? { label: `Torcida ${venueLabel} · +${points.supportersPercent ?? 0}%`, value: `+${points.supportersBonus}`, color: '#FBBF24' } : null,
    (points.magnataBonus ?? 0) > 0 ? { label: `Magnata · +${points.magnataPercent ?? 0}%`, value: `+${points.magnataBonus}`, color: '#FBBF24' } : null,
    (points.lossStreakBonus ?? 0) > 0 ? { label: 'Bônus de recuperação', value: `+${points.lossStreakBonus}`, color: '#FB923C' } : null,
  ].filter((row): row is { label: string; value: string; color: string } => row !== null);

  return (
    <GameModal
      open
      onOpenChange={next => { if (!next) onClose(); }}
      title="💰 Créditos da partida"
      className="max-w-md overflow-hidden border-[var(--ui-success)]"
      footer={<Button intent="success" className="w-full rounded-none border-0" onClick={onClose}>CONTINUAR</Button>}
    >
        <div className="px-5 pt-5 pb-5 sm:px-7">
          <div
            className="text-center text-7xl font-black leading-none sm:text-8xl"
            style={{ color: '#34D399', fontFamily: 'Bebas Neue, sans-serif' }}
          >
            +{points.total}
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-sm font-bold" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            <span style={{ color: outcomeColor }}>{outcomeLabel}</span>
            <span style={{ color: '#6A6A7A' }}>·</span>
            <span style={{ color: '#D7D7E2' }}>{points.goalsFor} – {points.goalsAgainst}</span>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-white/10" style={{ background: '#0B0B14' }}>
            <div className="border-b border-white/10 px-4 py-2.5 text-[13px] font-black tracking-[0.16em]" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              COMPOSIÇÃO DA RECOMPENSA
            </div>
            <div>
              {rewardRows.map((row, index) => (
                <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 last:border-b-0">
                  <span className="text-sm font-semibold" style={{ color: '#C5C5D2', fontFamily: 'Rajdhani, sans-serif' }}>{row.label}</span>
                  <strong className="text-base font-black tabular-nums" style={{ color: row.color, fontFamily: 'Rajdhani, sans-serif' }}>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
    </GameModal>
  );
}
