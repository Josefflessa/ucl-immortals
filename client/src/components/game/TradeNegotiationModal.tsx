// UCL Immortals — Sala de negociação de troca (mercado online): abre pros dois lados assim que
// o convite é aceito. Cada lado escolhe um jogador do PRÓPRIO banco + créditos opcionais, vendo a
// escolha do outro em tempo real, até os dois marcarem "Pronto".
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
  const theirName = isHost ? session.guestName : session.hostName;
  const theirRoomPlayer = state.onlinePlayers.find(p => p.id === (isHost ? session.guestId : session.hostId));
  const theirBench = theirRoomPlayer?.team?.players.slice(11) ?? [];
  const theirCard = theirSide.playerId ? theirBench.find(p => p.id === theirSide.playerId) ?? null : null;

  const bench = team.players.slice(11);

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
            disabled={!mySide.playerId}
            onClick={() => tradeReadyOnline(session.id)}
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
            {mySide.ready && <span className="text-[var(--ui-success)]">✓ pronto</span>}
          </div>
          <div className="market-player-row flex flex-wrap gap-3">
            {bench.length === 0 ? (
              <div className="ui-empty">Sem reservas pra oferecer.</div>
            ) : bench.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                compact
                lite
                selected={mySide.playerId === p.id}
                onClick={() => tradeSelectOnline(session.id, p.id, mySide.creditsDelta)}
              />
            ))}
          </div>
          <div className="ui-section-label mt-3 mb-1">Créditos extras (opcional)</div>
          <input
            type="number"
            min={0}
            value={mySide.creditsDelta}
            onChange={e => tradeSelectOnline(session.id, mySide.playerId, Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
            className="ui-input text-center font-bold"
            placeholder="0"
          />
        </div>

        {/* LADO DO OUTRO */}
        <div>
          <div className="ui-section-label mb-2 flex items-center justify-between">
            <span>Oferta de {theirName}</span>
            {theirSide.ready && <span className="text-[var(--ui-success)]">✓ pronto</span>}
          </div>
          <div className="market-player-row flex flex-wrap gap-3">
            {theirCard ? (
              <PlayerCard player={theirCard} compact lite />
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
