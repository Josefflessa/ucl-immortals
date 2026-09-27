// UCL Immortals — Aba "Mercado", com duas sub-abas:
//  • VENDER   — vende reservas PRA BANCA por valor fixo (sellValue). Solo e online.
//  • ANUNCIAR — anuncia reservas pros outros jogadores da sala (P2P, escrow). Só online.
import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { sellValue } from '../../lib/shop';
import { marketMinPrice } from '../../lib/market';
import PlayerCard from './PlayerCard';
import { Button, GameModal } from '../../design-system';

export default function MarketTab() {
  const {
    state, dispatch, marketSellOnline, marketListOnline, marketCancelOnline, marketBuyOnline,
    tradeProposeOnline, tradeCancelOnline, tradeAcceptOnline, tradeRejectOnline,
  } = useGame();
  const team = state.playerTeam;
  const online = state.mode === 'online';
  const [subTab, setSubTab] = useState<'sell' | 'listings' | 'trades'>('sell');
  const [confirmId, setConfirmId] = useState<string | null>(null); // venda pra banca (aguardando confirmação)
  const [listFor, setListFor] = useState<string | null>(null);     // anúncio P2P (aguardando definir preço)
  const [priceInput, setPriceInput] = useState<number>(0);
  // 🔄 Propor troca: alvo → meu jogador oferecido → jogador pedido dele → créditos opcionais.
  const [tradeTargetId, setTradeTargetId] = useState<string | null>(null);
  const [tradeOfferId, setTradeOfferId] = useState<string | null>(null);
  const [tradeRequestId, setTradeRequestId] = useState<string | null>(null);
  const [tradeCreditsInput, setTradeCreditsInput] = useState<number>(0);
  if (!team) return null;

  const bench = team.players.slice(11);
  const meId = online ? state.onlinePlayers.find(p => p.team?.id === team.id)?.id : undefined;
  const view = online ? subTab : 'sell'; // solo só tem VENDER

  // 🔄 Adversários com pelo menos 1 jogador no banco (só eles podem receber uma proposta).
  const tradeOpponents = state.onlinePlayers.filter(p => p.id !== meId && p.team && p.team.players.slice(11).length > 0);
  const tradeTarget = tradeTargetId ? tradeOpponents.find(p => p.id === tradeTargetId) ?? null : null;
  const tradeTargetBench = tradeTarget?.team?.players.slice(11) ?? [];
  const myOfferCard = tradeOfferId ? bench.find(p => p.id === tradeOfferId) ?? null : null;
  const theirRequestCard = tradeRequestId ? tradeTargetBench.find(p => p.id === tradeRequestId) ?? null : null;
  const resetTradeForm = () => { setTradeTargetId(null); setTradeOfferId(null); setTradeRequestId(null); setTradeCreditsInput(0); };
  const sentTrades = state.onlineTrades.filter(t => t.fromPlayerId === meId);
  const receivedTrades = state.onlineTrades.filter(t => t.toPlayerId === meId);

  const doSell = (playerId: string) => {
    if (online) marketSellOnline(playerId); else dispatch({ type: 'SELL_PLAYER', playerId });
  };
  const confirmPlayer = confirmId ? bench.find(p => p.id === confirmId) : null;
  const listPlayer = listFor ? bench.find(p => p.id === listFor) : null;

  return (
    <div className="ui-stack">
      {/* Sub-abas (só no online; no solo só existe VENDER) */}
      {online && (
        <div className="ui-tabs">
          {([['sell', '💰 VENDER'], ['listings', '🤝 ANUNCIAR'], ['trades', '🔄 TROCAR']] as const).map(([id, label]) => (
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
              Sem reservas pra vender — suas contratações e picks de banco aparecem aqui.
            </div>
          ) : (
            <div className="market-player-row flex flex-wrap gap-3">
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
              <div className="market-player-row flex flex-wrap gap-3">
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
              <div className="market-player-row flex flex-wrap gap-3">
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
                          title={alreadyOwn ? 'Você já tem esse jogador' : cantAfford ? 'Créditos insuficientes' : undefined}
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

      {/* ─────────── TROCAR (P2P direto — só online) ─────────── */}
      {view === 'trades' && online && (
        <>
          {/* Propostas recebidas — posso aceitar ou recusar */}
          <div>
            <div className="ui-section-label mb-2">Propostas recebidas</div>
            {receivedTrades.length === 0 ? (
              <div className="ui-empty">Ninguém te propôs uma troca ainda.</div>
            ) : (
              <div className="ui-stack">
                {receivedTrades.map(t => (
                  <div key={t.id} className="rounded-lg border border-white/10 p-3">
                    <div className="mb-2 text-center text-xs text-[var(--ui-text-muted)]">
                      Proposta de <b className="text-[var(--ui-text)]">{t.fromPlayerName}</b>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <PlayerCard player={t.offeredPlayer} compact lite />
                        <span className="text-[10px] text-[var(--ui-text-muted)]">você recebe</span>
                      </div>
                      <span className="text-lg text-[var(--ui-text-muted)]">⇄</span>
                      <div className="flex flex-col items-center gap-1">
                        <PlayerCard player={t.requestedPlayer} compact lite />
                        <span className="text-[10px] text-[var(--ui-text-muted)]">você entrega</span>
                      </div>
                    </div>
                    {t.creditsDelta !== 0 && (
                      <div className="mt-2 text-center text-xs">
                        {t.creditsDelta > 0
                          ? <>Ele(a) ainda paga <b className="text-[var(--ui-brand-strong)]">💰{t.creditsDelta}</b> pra você</>
                          : <>Ele(a) pede que você pague <b className="text-[var(--ui-danger)]">💰{-t.creditsDelta}</b> também</>}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => tradeRejectOnline(t.id)} className="ui-btn ui-btn--secondary min-h-8 flex-1 text-[11px]">
                        Recusar
                      </button>
                      <button
                        onClick={() => tradeAcceptOnline(t.id)}
                        disabled={t.creditsDelta < 0 && state.points < -t.creditsDelta}
                        className="ui-btn ui-btn--success min-h-8 flex-1 text-[11px]"
                        title={t.creditsDelta < 0 && state.points < -t.creditsDelta ? 'Créditos insuficientes' : undefined}
                      >
                        Aceitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Minhas propostas enviadas — posso cancelar */}
          <div>
            <div className="ui-section-label mb-2 mt-4">Minhas propostas enviadas</div>
            {sentTrades.length === 0 ? (
              <div className="ui-empty">Nenhuma proposta enviada.</div>
            ) : (
              <div className="ui-stack">
                {sentTrades.map(t => (
                  <div key={t.id} className="rounded-lg border border-white/10 p-3">
                    <div className="mb-2 text-center text-xs text-[var(--ui-text-muted)]">
                      Pra <b className="text-[var(--ui-text)]">{t.toPlayerName}</b>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <PlayerCard player={t.offeredPlayer} compact lite />
                        <span className="text-[10px] text-[var(--ui-text-muted)]">você oferece</span>
                      </div>
                      <span className="text-lg text-[var(--ui-text-muted)]">⇄</span>
                      <div className="flex flex-col items-center gap-1">
                        <PlayerCard player={t.requestedPlayer} compact lite />
                        <span className="text-[10px] text-[var(--ui-text-muted)]">você pede</span>
                      </div>
                    </div>
                    {t.creditsDelta !== 0 && (
                      <div className="mt-2 text-center text-xs">
                        {t.creditsDelta > 0
                          ? <>Você paga <b className="text-[var(--ui-brand-strong)]">💰{t.creditsDelta}</b> a mais</>
                          : <>Você pede <b className="text-[var(--ui-brand-strong)]">💰{-t.creditsDelta}</b> a mais</>}
                      </div>
                    )}
                    <button
                      onClick={() => tradeCancelOnline(t.id)}
                      className="ui-btn ui-btn--secondary mt-3 min-h-8 w-full text-[11px]"
                    >
                      Cancelar proposta
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Propor nova troca */}
          <div>
            <div className="ui-section-label mb-2 mt-4">Propor troca</div>
            {tradeOpponents.length === 0 ? (
              <div className="ui-empty">Nenhum adversário com jogador no banco pra trocar agora.</div>
            ) : !tradeTarget ? (
              <div className="flex flex-wrap gap-2">
                {tradeOpponents.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTradeTargetId(p.id)}
                    className="ui-btn ui-btn--secondary min-h-8 px-3 text-[11px]"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="ui-stack">
                <div className="flex items-center justify-between text-xs text-[var(--ui-text-muted)]">
                  <span>Trocando com <b className="text-[var(--ui-text)]">{tradeTarget.name}</b></span>
                  <button onClick={resetTradeForm} className="ui-btn ui-btn--ghost min-h-6 px-2 text-[10px]">
                    Trocar de adversário
                  </button>
                </div>

                <div className="ui-section-label">Seu banco — escolha quem oferecer</div>
                <div className="market-player-row flex flex-wrap gap-3">
                  {bench.map(p => (
                    <PlayerCard key={p.id} player={p} compact lite selected={tradeOfferId === p.id} onClick={() => setTradeOfferId(p.id)} />
                  ))}
                </div>

                <div className="ui-section-label mt-2">Banco de {tradeTarget.name} — escolha quem pedir</div>
                <div className="market-player-row flex flex-wrap gap-3">
                  {tradeTargetBench.map(p => (
                    <PlayerCard key={p.id} player={p} compact lite selected={tradeRequestId === p.id} onClick={() => setTradeRequestId(p.id)} />
                  ))}
                </div>

                <div className="ui-section-label mt-2">Créditos extras (opcional)</div>
                <input
                  type="number"
                  value={tradeCreditsInput}
                  onChange={e => setTradeCreditsInput(Math.trunc(Number(e.target.value) || 0))}
                  className="ui-input text-center font-bold"
                  placeholder="0"
                />
                <div className="text-center text-[11px] text-[var(--ui-text-muted)]">
                  {tradeCreditsInput > 0 && <>Você paga +💰{tradeCreditsInput} extra junto com {myOfferCard?.shortName ?? 'seu jogador'}.</>}
                  {tradeCreditsInput < 0 && <>Você pede +💰{-tradeCreditsInput} extra de {tradeTarget.name}.</>}
                  {tradeCreditsInput === 0 && <>Troca 1 por 1, sem créditos extras.</>}
                </div>

                <button
                  disabled={!myOfferCard || !theirRequestCard}
                  onClick={() => {
                    if (!myOfferCard || !theirRequestCard || !tradeTarget) return;
                    tradeProposeOnline(tradeTarget.id, myOfferCard.id, theirRequestCard.id, tradeCreditsInput);
                    resetTradeForm();
                  }}
                  className="ui-btn ui-btn--info min-h-9 w-full text-[12px]"
                >
                  Enviar proposta
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: confirmar VENDA pra banca */}
      <GameModal
        open={!!confirmPlayer}
        onOpenChange={open => { if (!open) setConfirmId(null); }}
        size="default"
        title={<span className="text-[var(--ui-danger)]">Vender jogador</span>}
        footer={confirmPlayer ? (
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
        ) : null}
      >
        {confirmPlayer && (
          <div className="text-center">
            <div className="text-3xl mb-1">🏪</div>
            <p className="mb-1 text-sm text-[var(--ui-text-soft)]">
              Vender <b className="text-[var(--ui-text)]">{confirmPlayer.shortName}</b> pra banca por <b className="text-[var(--ui-brand-strong)]">💰 {sellValue(confirmPlayer.rarity)}</b>?
            </p>
            <p className="text-xs text-[var(--ui-text-muted)]">Essa ação é permanente.</p>
          </div>
        )}
      </GameModal>

      {/* Modal: definir preço do ANÚNCIO (P2P) */}
      <GameModal
        open={!!listPlayer}
        onOpenChange={open => { if (!open) setListFor(null); }}
        size="default"
        title={<span className="text-[#78c4d8]">Anunciar jogador</span>}
        footer={listPlayer ? (
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
        ) : null}
      >
        {listPlayer && (
          <div className="text-center">
            <div className="text-3xl mb-1">🤝</div>
            <p className="mb-3 text-sm text-[var(--ui-text-soft)]">
              Anunciar <b className="text-[var(--ui-text)]">{listPlayer.shortName}</b> pros outros. Mínimo: <b className="text-[var(--ui-brand-strong)]">💰 {marketMinPrice(listPlayer)}</b>.
            </p>
            <input
              type="number"
              min={marketMinPrice(listPlayer)}
              value={priceInput}
              onChange={e => setPriceInput(Number(e.target.value))}
              className="ui-input text-center font-bold"
            />
          </div>
        )}
      </GameModal>
    </div>
  );
}
