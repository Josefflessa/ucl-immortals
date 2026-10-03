// UCL Immortals — Aba "Mercado", com três sub-abas:
//  • VENDER   — vende reservas PRA BANCA por valor fixo (sellValue). Solo e online.
//  • ANUNCIAR — anuncia reservas pros outros jogadores da sala (P2P, escrow). Só online.
//  • TROCAR   — negociação direta de reservas (+ créditos) com outro jogador. Só online.
import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { sellValue } from '../../lib/shop';
import { marketMinPrice } from '../../lib/market';
import PlayerCard from './PlayerCard';
import { Button, GameModal } from '../../design-system';

export default function MarketTab() {
  const {
    state, dispatch, marketSellOnline, marketListOnline, marketCancelOnline, marketBuyOnline,
    tradeInviteOnline, tradeLeaveOnline,
  } = useGame();
  const team = state.playerTeam;
  const online = state.mode === 'online';
  const [subTab, setSubTab] = useState<'sell' | 'listings' | 'trades'>('sell');
  const [confirmId, setConfirmId] = useState<string | null>(null); // venda pra banca (aguardando confirmação)
  const [listFor, setListFor] = useState<string | null>(null);     // anúncio P2P (aguardando definir preço)
  const [priceInput, setPriceInput] = useState<number>(0);
  if (!team) return null;

  const bench = team.players.slice(11);
  const meId = online ? state.onlinePlayers.find(p => p.team?.id === team.id)?.id : undefined;
  const view = online ? subTab : 'sell'; // solo só tem VENDER

  // 🔄 Trocar: minha sessão ativa (se eu já convidei alguém ou já estou negociando), e quem
  // ainda pode ser convidado (ninguém ocupado em outra sessão, e com jogador no banco).
  const mySession = state.onlineTradeSessions.find(t => t.hostId === meId || t.guestId === meId) ?? null;
  const busyIds = new Set(state.onlineTradeSessions.flatMap(t => [t.hostId, t.guestId]));
  const tradeOpponents = state.onlinePlayers.filter(p => p.id !== meId && !busyIds.has(p.id) && p.team && p.team.players.slice(11).length > 0);

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
          <div className="text-sm leading-relaxed text-[var(--ui-text-muted)]">
            Convide alguém da sala pra negociar uma troca. Se aceitar, os dois escolhem os jogadores
            numa sala compartilhada — o pop-up de negociação abre automaticamente pros dois lados.
          </div>

          {mySession ? (
            <div className="rounded-lg border border-white/10 p-4 text-center">
              {mySession.status === 'invite' && mySession.hostId === meId ? (
                <>
                  <div className="mb-1 text-2xl">⏳</div>
                  <p className="text-sm text-[var(--ui-text-soft)]">
                    Aguardando <b className="text-[var(--ui-text)]">{mySession.guestName}</b> aceitar o convite...
                  </p>
                </>
              ) : mySession.status === 'invite' ? (
                <>
                  <div className="mb-1 text-2xl">📨</div>
                  <p className="text-sm text-[var(--ui-text-soft)]">
                    <b className="text-[var(--ui-text)]">{mySession.hostName}</b> te convidou pra trocar — veja o pop-up.
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-1 text-2xl">🔄</div>
                  <p className="text-sm text-[var(--ui-text-soft)]">
                    Negociando com <b className="text-[var(--ui-text)]">{mySession.hostId === meId ? mySession.guestName : mySession.hostName}</b> — veja o pop-up.
                  </p>
                </>
              )}
              <button
                onClick={() => tradeLeaveOnline(mySession.id)}
                className="ui-btn ui-btn--secondary mt-3 min-h-8 px-4 text-[11px]"
              >
                {mySession.status === 'invite' && mySession.hostId === meId ? 'Cancelar convite' : 'Sair da negociação'}
              </button>
            </div>
          ) : (
            <div>
              <div className="ui-section-label mb-2">Convidar pra trocar</div>
              {tradeOpponents.length === 0 ? (
                <div className="ui-empty">Nenhum adversário disponível pra trocar agora.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tradeOpponents.map(p => (
                    <button
                      key={p.id}
                      onClick={() => tradeInviteOnline(p.id)}
                      className="ui-btn ui-btn--secondary min-h-8 px-3 text-[11px]"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
