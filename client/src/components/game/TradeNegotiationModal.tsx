// UCL Immortals — Sala de negociação de troca (mercado online): abre pros dois lados assim que
// o convite é aceito. Cada lado escolhe um ou mais jogadores do PRÓPRIO banco + créditos
// opcionais, vendo a oferta do outro em tempo real, até os dois marcarem "Pronto".
import { useGame } from '../../contexts/GameContext';
import PlayerCard from './PlayerCard';
import { Button, GameModal } from '../../design-system';

export default function TradeNegotiationModal() {
  const { state, tradeSelectOnline, tradeReadyOnline, tradeLeaveOnline } = useGame();
  const team = state.playerTeam;
  const meId = state.mode === 'online' && team
    ? state.onlinePlayers.find(p => p.team?.id === team.id)?.id
    : undefined;
  const session = state.onlineTradeSessions.find(t => t.status === 'negotiating' && (t.hostId === meId || t.guestId === meId)) ?? null;
  if (!session || !team || !meId) return null;

  const isHost = session.hostId === meId;
  const mySide = isHost ? session.host : session.guest;
  const theirSide = isHost ? session.guest : session.host;
  const myPlayerIds = Array.isArray(mySide.playerIds)
    ? mySide.playerIds
    : mySide.playerId ? [mySide.playerId] : [];
  const theirPlayerIds = Array.isArray(theirSide.playerIds)
    ? theirSide.playerIds
    : theirSide.playerId ? [theirSide.playerId] : [];
  const theirName = isHost ? session.guestName : session.hostName;
  const theirRoomPlayer = state.onlinePlayers.find(p => p.id === (isHost ? session.guestId : session.hostId));
  const theirBench = theirRoomPlayer?.team?.players.slice(11) ?? [];
  const theirCards = theirBench.filter(p => theirPlayerIds.includes(p.id));

  const bench = team.players.slice(11);
  const sameOfferSize = theirPlayerIds.length === 0 || theirPlayerIds.length === myPlayerIds.length;
  const togglePlayer = (playerId: string) => {
    const nextPlayerIds = myPlayerIds.includes(playerId)
      ? myPlayerIds.filter(id => id !== playerId)
      : [...myPlayerIds, playerId];
    tradeSelectOnline(session.id, nextPlayerIds, mySide.creditsDelta);
  };

  return (
    <GameModal
      open
      onOpenChange={next => { if (!next) tradeLeaveOnline(session.id); }}
      size="wide"
      title={<span className="text-[#78c4d8]">🔄 Negociando com {theirName}</span>}
      footer={
        <div className="flex gap-2">
          <Button intent="ghost" className="flex-1" onClick={() => tradeLeaveOnline(session.id)}>
            SAIR DA NEGOCIAÇÃO
          </Button>
          <Button
            intent={mySide.ready ? 'secondary' : 'success'}
            className="flex-1"
            disabled={!myPlayerIds.length || !sameOfferSize}
            onClick={() => tradeReadyOnline(session.id)}
            title={!sameOfferSize ? 'As duas ofertas precisam ter a mesma quantidade de jogadores.' : undefined}
          >
            {mySide.ready ? 'VOCÊ ESTÁ PRONTO ✓' : 'MARCAR PRONTO'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* MEU LADO */}
        <div>
          <div className="ui-section-label mb-2 flex items-center justify-between">
            <span>Sua oferta</span>
            <span className="text-[var(--ui-text-muted)]">{myPlayerIds.length} selecionado{myPlayerIds.length === 1 ? '' : 's'}</span>
            {mySide.ready && <span className="text-[var(--ui-success)]">✓ pronto</span>}
          </div>
          <p className="mb-2 text-xs text-[var(--ui-text-muted)]">Selecione um ou mais reservas para oferecer.</p>
          <div className="market-player-row flex flex-wrap gap-3">
            {bench.length === 0 ? (
              <div className="ui-empty">Sem reservas pra oferecer.</div>
            ) : bench.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                compact
                lite
                selected={myPlayerIds.includes(p.id)}
                onClick={() => togglePlayer(p.id)}
              />
            ))}
          </div>
          <div className="ui-section-label mt-3 mb-1">Créditos extras (opcional)</div>
          <input
            type="number"
            min={0}
            value={mySide.creditsDelta}
            onChange={e => tradeSelectOnline(session.id, myPlayerIds, Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
            className="ui-input text-center font-bold"
            placeholder="0"
          />
        </div>

        {/* LADO DO OUTRO */}
        <div>
          <div className="ui-section-label mb-2 flex items-center justify-between">
            <span>Oferta de {theirName}</span>
            <span className="text-[var(--ui-text-muted)]">{theirPlayerIds.length} selecionado{theirPlayerIds.length === 1 ? '' : 's'}</span>
            {theirSide.ready && <span className="text-[var(--ui-success)]">✓ pronto</span>}
          </div>
          <div className="market-player-row flex flex-wrap gap-3">
            {theirCards.length > 0 ? (
              theirCards.map(player => <PlayerCard key={player.id} player={player} compact lite />)
            ) : (
              <div className="ui-empty">Ainda escolhendo...</div>
            )}
          </div>
          {theirSide.creditsDelta > 0 && (
            <div className="mt-3 text-center text-xs text-[var(--ui-text-muted)]">
              + <b className="text-[var(--ui-brand-strong)]">💰{theirSide.creditsDelta}</b> extra
            </div>
          )}
        </div>
      </div>
    </GameModal>
  );
}
