// UCL Immortals — Pop-up de convite de troca (mercado online): aparece pro CONVIDADO assim que
// alguém da sala propõe negociar, em qualquer aba que ele esteja.
import { useGame } from '../../contexts/GameContext';
import { Button, GameModal } from '../../design-system';

export default function TradeInviteModal() {
  const { state, tradeAcceptInviteOnline, tradeLeaveOnline } = useGame();
  const meId = state.mode === 'online' && state.playerTeam
    ? state.onlinePlayers.find(p => p.team?.id === state.playerTeam!.id)?.id
    : undefined;
  const invite = state.onlineTradeSessions.find(t => t.status === 'invite' && t.guestId === meId) ?? null;
  if (!invite) return null;

  return (
    <GameModal
      open
      onOpenChange={() => {}}
      dismissible={false}
      size="default"
      title={<span className="text-[#78c4d8]">🔄 Convite de troca</span>}
      footer={
        <div className="flex gap-2">
          <Button intent="ghost" className="flex-1" onClick={() => tradeLeaveOnline(invite.id)}>
            RECUSAR
          </Button>
          <Button intent="info" className="flex-1" onClick={() => tradeAcceptInviteOnline(invite.id)}>
            ACEITAR
          </Button>
        </div>
      }
    >
      <div className="text-center">
        <div className="mb-1 text-3xl">🤝</div>
        <p className="text-sm text-[var(--ui-text-soft)]">
          <b className="text-[var(--ui-text)]">{invite.hostName}</b> quer negociar uma troca com você.
        </p>
        <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
          Se aceitar, os dois escolhem os jogadores numa sala compartilhada.
        </p>
      </div>
    </GameModal>
  );
}
