// UCL Immortals — Aba "Mercado", com duas sub-abas:
//  • VENDER   — vende reservas PRA BANCA por valor fixo (sellValue). Solo e online.
//  • ANUNCIAR — anuncia reservas pros outros jogadores da sala (P2P, escrow). Só online.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { sellValue } from '../../lib/shop';
import { marketMinPrice } from '../../lib/market';
import PlayerCard from './PlayerCard';
import { Button, Panel, PanelBody } from '../../design-system';

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
    <div className="ui-stack">
      {/* Cabeçalho */}
      <Panel tone="accent">
        <PanelBody className="flex items-center justify-between py-3">
          <div className="ui-panel__title">🏪 Mercado</div>
          <div className="font-display text-2xl text-[var(--ui-brand-strong)]">💰 {state.points}</div>
        </PanelBody>
      </Panel>

      {/* Sub-abas (só no online; no solo só existe VENDER) */}
      {online && (
        <div className="ui-tabs">
          {([['sell', '💰 VENDER'], ['listings', '🤝 ANUNCIAR']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className="ui-tab flex-1"
              data-active={subTab === id}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ─────────── VENDER (pra banca, valor fixo) ─────────── */}
      {view === 'sell' && (
        <>
          <div className="text-sm leading-relaxed text-[var(--ui-text-muted)]">
            Venda reservas pra banca por um valor fixo. Pra vender um titular, mande-o pro banco no MEU TIME.
          </div>
          {bench.length === 0 ? (
            <div className="ui-empty">
              Sem reservas pra vender — seus reforços e picks de banco aparecem aqui.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {bench.map(p => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <PlayerCard player={p} compact lite />
                  <button
                    onClick={() => setConfirmId(p.id)}
                    className="ui-btn ui-btn--danger min-h-8 px-3 text-[11px]"
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
            <div className="ui-section-label mb-2">Meu banco — anuncie</div>
            {bench.length === 0 ? (
              <div className="ui-empty">
                Sem reservas pra anunciar.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {bench.map(p => (
                  <div key={p.id} className="flex flex-col items-center gap-1">
                    <PlayerCard player={p} compact lite />
                    <button
                      onClick={() => { setPriceInput(marketMinPrice(p)); setListFor(p.id); }}
                      className="ui-btn ui-btn--info min-h-8 px-3 text-[11px]"
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
            <div className="ui-section-label mb-2 mt-4">À venda no mercado</div>
            {state.onlineMarket.length === 0 ? (
              <div className="ui-empty">
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
                      <div className="text-center text-xs text-[var(--ui-text-muted)]">
                        {mine ? 'Seu anúncio' : li.sellerName} · <b className="text-[var(--ui-brand-strong)]">💰{li.price}</b>
                      </div>
                      {mine ? (
                        <button
                          onClick={() => marketCancelOnline(li.id)}
                          className="ui-btn ui-btn--secondary min-h-8 px-3 text-[11px]"
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button
                          disabled={cantAfford || alreadyOwn}
                          onClick={() => marketBuyOnline(li.id)}
                          className="ui-btn ui-btn--info min-h-8 px-3 text-[11px]"
                          title={alreadyOwn ? 'Você já tem esse jogador' : cantAfford ? 'Pontos insuficientes' : undefined}
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
        <div className="ui-modal-backdrop z-[60]" onClick={() => setConfirmId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="ui-modal max-w-sm border-[var(--ui-danger)] p-5 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl mb-1">🏪</div>
            <h3 className="ui-modal__title mb-2 text-[var(--ui-danger)]">Vender jogador</h3>
            <p className="mb-1 text-sm text-[var(--ui-text-soft)]">
              Vender <b className="text-[var(--ui-text)]">{confirmPlayer.shortName}</b> pra banca por <b className="text-[var(--ui-brand-strong)]">💰 {sellValue(confirmPlayer.rarity)}</b>?
            </p>
            <p className="mb-4 text-xs text-[var(--ui-text-muted)]">Essa ação é permanente.</p>
            <div className="flex gap-2">
              <Button intent="ghost" className="flex-1" onClick={() => setConfirmId(null)}>
                CANCELAR
              </Button>
              <Button intent="danger" className="flex-1"
                onClick={() => { doSell(confirmPlayer.id); setConfirmId(null); }}
              >
                VENDER
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: definir preço do ANÚNCIO (P2P) */}
      {listPlayer && (
        <div className="ui-modal-backdrop z-[60]" onClick={() => setListFor(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="ui-modal max-w-sm border-[#0e7490] p-5 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl mb-1">🤝</div>
            <h3 className="ui-modal__title mb-2 text-[#78c4d8]">Anunciar jogador</h3>
            <p className="mb-3 text-sm text-[var(--ui-text-soft)]">
              Anunciar <b className="text-[var(--ui-text)]">{listPlayer.shortName}</b> pros outros. Mínimo: <b className="text-[var(--ui-brand-strong)]">💰 {marketMinPrice(listPlayer)}</b>.
            </p>
            <input
              type="number"
              min={marketMinPrice(listPlayer)}
              value={priceInput}
              onChange={e => setPriceInput(Number(e.target.value))}
              className="ui-input mb-4 text-center font-bold"
            />
            <div className="flex gap-2">
              <Button intent="ghost" className="flex-1" onClick={() => setListFor(null)}>
                CANCELAR
              </Button>
              <Button intent="info" className="flex-1"
                onClick={() => { marketListOnline(listPlayer.id, Math.max(marketMinPrice(listPlayer), Math.floor(priceInput || 0))); setListFor(null); }}
              >
                ANUNCIAR
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
