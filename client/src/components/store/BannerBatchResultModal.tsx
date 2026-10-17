import type { BannerBatchResult } from '../../contexts/AlbumContext';
import BannerGachaReveal from './gacha/BannerGachaReveal';

/** The result of a banner draw, staged as a summoning (see BannerGachaReveal). */
export default function BannerBatchResultModal({ draws, onClose }: { draws: BannerBatchResult | null; onClose: () => void }) {
  return draws && draws.cards.length > 0 ? <BannerGachaReveal draws={draws} onClose={onClose} /> : null;
}
