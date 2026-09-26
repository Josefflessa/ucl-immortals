import type { MatchPoints } from '../../lib/shop';
import { Button } from '../../design-system';

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

  return (
    <div className="ui-modal-backdrop z-[60] p-4" onClick={onClose}>
      <div
        className="ui-modal max-w-sm overflow-hidden border-[var(--ui-success)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <div
            className="text-center text-[11px] font-black tracking-widest"
            style={{ color: '#34D399', fontFamily: 'Rajdhani, sans-serif' }}
          >
            💰 CRÉDITOS DA PARTIDA
          </div>
          <div
            className="mt-2 text-center text-6xl font-black leading-none"
            style={{ color: '#34D399', fontFamily: 'Bebas Neue, sans-serif' }}
          >
            +{points.total}
          </div>

          <div
            className="mt-3 text-center text-[12px] leading-relaxed"
            style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}
          >
            {points.outcome === 'win' ? 'Vitória' : points.outcome === 'draw' ? 'Empate' : 'Derrota'} +{points.base}
            {points.gdBonus > 0 && ` · saldo +${points.gdBonus}`}
            {points.goalsBonus > 0 && ` · gols +${points.goalsBonus}`}
            {points.csBonus > 0 && ` · sem sofrer +${points.csBonus}`}
          </div>

          {((points.supportersBonus ?? 0) > 0 || (points.magnataBonus ?? 0) > 0) && (
            <div
              className="mt-3 border-t border-white/10 pt-3 text-center text-[11px]"
              style={{ color: '#A7A7B8', fontFamily: 'Rajdhani, sans-serif' }}
            >
              {(points.supportersBonus ?? 0) > 0 && (
                <>📣 Torcida {venueLabel} +{points.supportersPercent}% (+{points.supportersBonus})</>
              )}
              {(points.supportersBonus ?? 0) > 0 && (points.magnataBonus ?? 0) > 0 && ' · '}
              {(points.magnataBonus ?? 0) > 0 && (
                <>🤑 Magnata +{points.magnataPercent}% (+{points.magnataBonus})</>
              )}
            </div>
          )}

          <div
            className="mt-3 text-center text-[11px]"
            style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}
          >
            Use os créditos na aba 🛒 LOJA
          </div>
        </div>

        <Button intent="success" className="w-full rounded-none border-0" onClick={onClose}>
          CONTINUAR
        </Button>
      </div>
    </div>
  );
}
