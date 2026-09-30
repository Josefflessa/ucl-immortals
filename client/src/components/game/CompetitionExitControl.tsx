import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import { Button, ConfirmDialog } from '../../design-system';
import RoomOptionsMenu, { type RoomMenuAction } from './RoomOptionsMenu';

type ConfirmAction = 'room' | 'solo' | 'restart' | 'close';

/** Shared room/exit control for each screen in the competition flow. */
export default function CompetitionExitControl() {
  const {
    state,
    dispatch,
    leaveRoomOnline,
    closeRoomOnline,
    restartRoomOnline,
    transferHostOnline,
    removePlayerOnline,
  } = useGame();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const handleRoomAction = (action: RoomMenuAction) => {
    setConfirmAction(action === 'leave' ? 'room' : action);
  };

  const handleTransferHost = (playerId: string) => {
    const target = state.onlinePlayers.find(player => player.id === playerId);
    if (target) setTransferTarget({ id: target.id, name: target.name });
  };

  const handleRemovePlayer = (playerId: string) => {
    const target = state.onlinePlayers.find(player => player.id === playerId && player.id !== state.onlineHostId && !player.kicked);
    if (target) setRemoveTarget({ id: target.id, name: target.name });
  };

  const confirmRoomAction = () => {
    if (confirmAction === 'room') leaveRoomOnline();
    if (confirmAction === 'restart') restartRoomOnline();
    if (confirmAction === 'close') closeRoomOnline();
    if (confirmAction === 'solo') dispatch({ type: 'RESET_GAME' });
    setConfirmAction(null);
  };

  if (state.mode !== 'online') {
    return (
      <>
        <Button
          type="button"
          intent="ghost"
          onClick={() => setConfirmAction('solo')}
          title="Sair do jogo"
          className="border border-[var(--ui-danger)]/30 text-[var(--ui-danger)]"
        >
          <LogOut size={13} /> <span className="hidden sm:inline">Sair</span>
        </Button>
        <ConfirmDialog
          open={confirmAction === 'solo'}
          onOpenChange={open => { if (!open) setConfirmAction(null); }}
          title="Sair do jogo?"
          description="Você perderá o progresso desta temporada e voltará para a tela inicial."
          confirmLabel="Sair do jogo"
          onConfirm={confirmRoomAction}
        />
      </>
    );
  }

  return (
    <>
      <RoomOptionsMenu
        isHost={state.isHost}
        onAction={handleRoomAction}
        roomCode={state.roomCode}
        players={state.onlinePlayers}
        hostId={state.onlineHostId}
        onTransferHost={handleTransferHost}
        onRemovePlayer={handleRemovePlayer}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={open => { if (!open) setConfirmAction(null); }}
        title={confirmAction === 'room' ? 'Sair da sala?' : confirmAction === 'restart' ? 'Reiniciar competição?' : 'Encerrar sala?'}
        description={confirmAction === 'room'
          ? state.isHost
            ? 'Você sairá da sala e o anfitrião passará imediatamente para outro jogador conectado.'
            : 'Você deixará o torneio online. Para voltar, entre novamente com o mesmo código e nome enquanto a sala existir.'
          : confirmAction === 'restart'
            ? 'A competição será zerada para todos, mantendo os jogadores na sala.'
            : 'A sala será encerrada para todos e não poderá mais ser reaberta.'}
        confirmLabel={confirmAction === 'room' ? 'Sair da sala' : confirmAction === 'restart' ? 'Reiniciar' : 'Encerrar sala'}
        onConfirm={confirmRoomAction}
      />

      <ConfirmDialog
        open={transferTarget !== null}
        onOpenChange={open => { if (!open) setTransferTarget(null); }}
        title="Transferir anfitrião?"
        description={`A partir de agora, ${transferTarget?.name ?? 'esse jogador'} controlará o início, reinício e encerramento da sala.`}
        confirmLabel="Transferir host"
        intent="primary"
        onConfirm={() => {
          if (transferTarget) transferHostOnline(transferTarget.id);
          setTransferTarget(null);
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={open => { if (!open) setRemoveTarget(null); }}
        title="Remover jogador?"
        description={`${removeTarget?.name ?? 'Esse jogador'} será removido imediatamente da sala e não poderá reconectar usando este dispositivo.`}
        confirmLabel="Remover jogador"
        intent="danger"
        onConfirm={() => {
          if (removeTarget) removePlayerOnline(removeTarget.id);
          setRemoveTarget(null);
        }}
      />
    </>
  );
}
