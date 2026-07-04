// UCL Immortals — Aba "Mercado", com duas sub-abas:
//  • VENDER   — vende reservas PRA BANCA por valor fixo (sellValue). Solo e online.
//  • ANUNCIAR — anuncia reservas pros outros jogadores da sala (P2P, escrow). Só online.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { sellValue } from '../../lib/shop';
import { marketMinPrice } from '../../lib/market';
import PlayerCard from './PlayerCard';

export default function MarketTab() {
  const { state, dispatch, marketSellOnline, marketListOnline, marketCancelOnline, marketBuyOnline } = useGame();
  const team = state.playerTeam;
  const online = state.mode === 'online';
  const [subTab, setSubTab] = useState<'sell' | 'listings'>('sell');
  const [confirmId, setConfirmId] = useState<string | null>(null); // venda pra banca (aguardando confirmação)
  const [listFor, setListFor] = useState<string | null>(null);     // anúncio P2P (aguardando definir preço)
  const [priceInput, setPriceInput] = useState<number>(0);
  if (!team) return null;

  const bench = team.players.slice(11);
  const meId = online ? state.onlinePlayers.find(p => p.team?.id === team.id)?.id : undefined;
  const view = online ? subTab : 'sell'; // solo só tem VENDER

  const doSell = (playerId: string) => {
    if (online) marketSellOnline(playerId); else dispatch({ type: 'SELL_PLAYER', playerId });
  };
  const confirmPlayer = confirmId ? bench.find(p => p.id === confirmId) : null;
  const listPlayer = listFor ? bench.find(p => p.id === listFor) : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
        <div className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>🏪 MERCADO</div>
        <div className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>💰 {state.points}</div>
      </div>

      {/* Sub-abas (só no online; no solo só existe VENDER) */}
      {online && (
        <div className="flex gap-2">
          {([['sell', '💰 VENDER'], ['listings', '🤝 ANUNCIAR']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-black tracking-wider transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                background: subTab === id ? '#C9A84C' : '#0F0F1A',
                color: subTab === id ? '#080810' : '#8A8A9A',
                border: `1px solid ${subTab === id ? '#C9A84C' : '#1A1A2A'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ─────────── VENDER (pra banca, valor fixo) ─────────── */}
      {view === 'sell' && (
        <>
          <div className="text-[11px]" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
            Venda reservas pra banca por um valor fixo. Pra vender um titular, mande-o pro banco no MEU TIME.
          </div>
          {bench.length === 0 ? (
            <div className="rounded-xl px-4 py-10 text-center" style={{ background: '#0F0F1A', border: '1px dashed #1A1A2A', color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              Sem reservas pra vender — seus reforços e picks de banco aparecem aqui.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {bench.map(p => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <PlayerCard player={p} compact lite />
                  <button
                    onClick={() => setConfirmId(p.id)}
                    className="text-[11px] font-black px-3 py-1.5 rounded-lg tracking-wider transition-transform active:scale-95"
                    style={{ fontFamily: 'Rajdhani, sans-serif', background: '#7f1d1dCC', color: '#FCA5A5', border: '1px solid #EF444455' }}
                  >
                    Vender · 💰{sellValue(p.rarity)}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─────────── ANUNCIAR (P2P — só online) ─────────── */}
      {view === 'listings' && online && (
        <>
          {/* MEU BANCO — anunciar */}
          <div>
            <div className="text-xs font-black tracking-widest mb-2" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>MEU BANCO — ANUNCIE</div>
            {bench.length === 0 ? (
              <div className="rounded-xl px-4 py-6 text-center text-[12px]" style={{ background: '#0F0F1A', border: '1px dashed #1A1A2A', color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                Sem reservas pra anunciar.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {bench.map(p => (
                  <div key={p.id} className="flex flex-col items-center gap-1">
                    <PlayerCard player={p} compact lite />
                    <button
                      onClick={() => { setPriceInput(marketMinPrice(p)); setListFor(p.id); }}
                      className="text-[11px] font-black px-3 py-1.5 rounded-lg tracking-wider transition-transform active:scale-95"
                      style={{ fontFamily: 'Rajdhani, sans-serif', background: '#14342a', color: '#67E8F9', border: '1px solid #22D3EE55' }}
                    >
                      Anunciar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* À VENDA — anúncios da sala */}
          <div>
            <div className="text-xs font-black tracking-widest mb-2 mt-4" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>À VENDA NO MERCADO</div>
            {state.onlineMarket.length === 0 ? (
              <div className="rounded-xl px-4 py-6 text-center text-[12px]" style={{ background: '#0F0F1A', border: '1px dashed #1A1A2A', color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                Nenhum jogador à venda.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {state.onlineMarket.map(li => {
                  const mine = li.sellerId === meId;
                  const alreadyOwn = team.players.some(p => p.id === li.player.id);
                  const cantAfford = state.points < li.price;
                  return (
                    <div key={li.id} className="flex flex-col items-center gap-1">
                      <PlayerCard player={li.player} compact lite />
                      <div className="text-[10px] font-bold text-center" style={{ color: '#8A9BA0', fontFamily: 'Rajdhani, sans-serif' }}>
                        {mine ? 'seu anúncio' : li.sellerName} · <b style={{ color: '#E8C84A' }}>💰{li.price}</b>
                      </div>
                      {mine ? (
                        <button
                          onClick={() => marketCancelOnline(li.id)}
                          className="text-[11px] font-black px-3 py-1.5 rounded-lg tracking-wider transition-transform active:scale-95"
                          style={{ fontFamily: 'Rajdhani, sans-serif', background: '#2a2a1a', color: '#EAB308', border: '1px solid #EAB30855' }}
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button
                          disabled={cantAfford || alreadyOwn}
                          onClick={() => marketBuyOnline(li.id)}
                          className="text-[11px] font-black px-3 py-1.5 rounded-lg tracking-wider transition-transform active:scale-95 disabled:opacity-40"
                          title={alreadyOwn ? 'Você já tem esse jogador' : cantAfford ? 'Pontos insuficientes' : undefined}
                          style={{ fontFamily: 'Rajdhani, sans-serif', background: '#14342a', color: '#67E8F9', border: '1px solid #22D3EE55' }}
                        >
                          Comprar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: confirmar VENDA pra banca */}
      {confirmPlayer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={() => setConfirmId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-2xl p-5 text-center" style={{ background: '#0b0b14', border: '1px solid #7f1d1d' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl mb-1">🏪</div>
            <h3 className="text-lg font-black tracking-widest uppercase mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FCA5A5' }}>Vender jogador</h3>
            <p className="text-[13px] mb-1" style={{ color: '#C8D0D4', fontFamily: 'Rajdhani, sans-serif' }}>
              Vender <b style={{ color: '#FFF' }}>{confirmPlayer.shortName}</b> pra banca por <b style={{ color: '#E8C84A' }}>💰 {sellValue(confirmPlayer.rarity)}</b>?
            </p>
            <p className="text-[11px] mb-4" style={{ color: '#8A9BA0', fontFamily: 'Rajdhani, sans-serif' }}>Essa ação é permanente.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2.5 rounded-xl font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', background: '#17171f', color: '#9A9AA5' }}>
                CANCELAR
              </button>
              <button
                onClick={() => { doSell(confirmPlayer.id); setConfirmId(null); }}
                className="flex-1 py-2.5 rounded-xl font-black tracking-widest transition-transform active:scale-95"
                style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg,#b91c1c,#ef4444)', color: '#fff' }}
              >
                VENDER
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: definir preço do ANÚNCIO (P2P) */}
      {listPlayer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={() => setListFor(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-2xl p-5 text-center" style={{ background: '#0b0b14', border: '1px solid #0E7490' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl mb-1">🤝</div>
            <h3 className="text-lg font-black tracking-widest uppercase mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#67E8F9' }}>Anunciar jogador</h3>
            <p className="text-[13px] mb-3" style={{ color: '#C8D0D4', fontFamily: 'Rajdhani, sans-serif' }}>
              Anunciar <b style={{ color: '#FFF' }}>{listPlayer.shortName}</b> pros outros. Mínimo: <b style={{ color: '#E8C84A' }}>💰 {marketMinPrice(listPlayer)}</b>.
            </p>
            <input
              type="number"
              min={marketMinPrice(listPlayer)}
              value={priceInput}
              onChange={e => setPriceInput(Number(e.target.value))}
              className="w-full mb-4 px-3 py-2 rounded-lg text-center font-black"
              style={{ fontFamily: 'Rajdhani, sans-serif', background: '#12121c', color: '#FFF', border: '1px solid #22D3EE55' }}
            />
            <div className="flex gap-2">
              <button onClick={() => setListFor(null)} className="flex-1 py-2.5 rounded-xl font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', background: '#17171f', color: '#9A9AA5' }}>
                CANCELAR
              </button>
              <button
                onClick={() => { marketListOnline(listPlayer.id, Math.max(marketMinPrice(listPlayer), Math.floor(priceInput || 0))); setListFor(null); }}
                className="flex-1 py-2.5 rounded-xl font-black tracking-widest transition-transform active:scale-95"
                style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg,#0E7490,#22D3EE)', color: '#062028' }}
              >
                ANUNCIAR
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
