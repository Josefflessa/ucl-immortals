/**
 * Dev-only: play the banner reveal with made-up draws (#gacha), to see every rarity and the
 * 1-card and 10-card versions without spending coins.
 */
import { useMemo, useState } from 'react';
import type { Rarity } from '@shared/game/gameData';
import { AccountProvider } from '../../contexts/AccountContext';
import { AlbumProvider, type BannerBatchResult } from '../../contexts/AlbumContext';
import { CATALOG, albumCard } from '../../components/album/albumData';
import BannerGachaReveal from '../../components/store/gacha/BannerGachaReveal';
import UniquePackOpening from '../../components/game/UniquePackOpening';
import type { PlayerPackRarity } from '@shared/game/shop';

function Preview() {
  const [draws, setDraws] = useState<BannerBatchResult | null>(null);
  const [run, setRun] = useState(0);
  const [pack, setPack] = useState<PlayerPackRarity | null>(null);
  const byRarity = useMemo(() => {
    const groups = new Map<Rarity, string[]>();
    CATALOG.stickers.forEach((_, id) => {
      const card = albumCard(id);
      if (card) groups.set(card.rarity, [...(groups.get(card.rarity) ?? []), id]);
    });
    return groups;
  }, []);
  const pick = (rarity: Rarity, n: number) => { const ids = byRarity.get(rarity) ?? []; return ids[n % Math.max(1, ids.length)]; };
  const make = (rarities: Rarity[]): BannerBatchResult => ({
    cards: rarities.map((rarity, index) => ({ card: { id: pick(rarity, index * 7), isNew: index % 3 !== 1 }, rarity, pityTriggered: rarity === 'unique' })),
    dayStart: '2026-10-17', price: 100, pageRewards: [],
  });
  const play = (rarities: Rarity[]) => { setRun(value => value + 1); setDraws(make(rarities)); };
  const ten = (best: Rarity): Rarity[] => ['bronze', 'silver', 'bronze', 'gold', 'silver', 'bronze', 'silver', best, 'bronze', 'gold'];
  const button = 'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold hover:bg-white/10';
  return (
    <div className="min-h-dvh bg-[#0A0A12] p-6 text-white">
      <h1 className="mb-4 text-xl font-black">Sorteio de banner (prévia)</h1>
      <div className="mb-2 text-xs font-black tracking-widest text-yellow-400">1 CARTA</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {(['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'] as Rarity[]).map(rarity => <button key={rarity} type="button" className={button} onClick={() => play([rarity])}>{rarity}</button>)}
      </div>
      <div className="mb-2 text-xs font-black tracking-widest text-yellow-400">10 CARTAS (a melhor é…)</div>
      <div className="flex flex-wrap gap-2">
        {(['silver', 'gold', 'legendary', 'immortal', 'unique'] as Rarity[]).map(rarity => <button key={rarity} type="button" className={button} onClick={() => play(ten(rarity))}>{rarity}</button>)}
        <button type="button" className={button} onClick={() => play(['gold', 'silver'])}>2 cartas</button>
        <button type="button" className={button} onClick={() => play(Array.from({ length: 5 }, () => 'bronze' as Rarity))}>5 comuns</button>
      </div>
      <div className="mb-2 mt-5 text-xs font-black tracking-widest text-yellow-400">PACOTE DE JOGADOR (loja da competição)</div>
      <div className="flex flex-wrap gap-2">
        {(['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'] as PlayerPackRarity[]).map(rarity => <button key={rarity} type="button" className={button} onClick={() => setPack(rarity)}>{rarity}</button>)}
      </div>
      {pack ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <UniquePackOpening rarity={pack} card={albumCard(pick(pack === 'unique' ? 'unique' : pack, 3))!} onClaim={() => setPack(null)} onClose={() => setPack(null)} />
        </div>
      ) : null}
      {draws ? <BannerGachaReveal key={run} draws={draws} onClose={() => setDraws(null)} /> : null}
    </div>
  );
}

export default function GachaPreviewPage() {
  return <AccountProvider><AlbumProvider><Preview /></AlbumProvider></AccountProvider>;
}
