import { useEffect, useRef, useState } from 'react';
import { playSound } from '../../audio/uiSound';
import { Check, DoorOpen, X } from 'lucide-react';
import { useAccount, type RoomInvitationEntry } from '../../contexts/AccountContext';
import { useGame } from '../../contexts/GameContext';
import { Button, GameModal, StatusBanner } from '../../design-system';

export default function RoomInvitationPrompt() {
  const { state, joinRoom } = useGame();
  const { account, getRoomInvitations, respondToRoomInvitation, setPresence } = useAccount();
  const [invitations, setInvitations] = useState<RoomInvitationEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const dismissedIds = useRef(new Set<string>());
  const presenceId = useRef<string | null>(null);
  const presenceRevision = useRef(0);
  const presenceStatusRef = useRef<'available' | 'busy' | 'away'>('busy');
  if (!presenceId.current) {
    presenceId.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `presence_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  }

  useEffect(() => {
    const syncVisibility = () => setIsVisible(document.visibilityState === 'visible');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  const canReceiveInvitation = !!account
    && !state.roomCode
    && (state.phase === 'menu'
      || state.phase === 'account'
      || state.phase === 'album'
      || state.phase === 'store'
      || state.phase === 'achievements'
      || state.phase === 'events');
  const desiredPresence = !canReceiveInvitation ? 'busy' : isVisible ? 'available' : 'away';
  presenceStatusRef.current = desiredPresence;

  useEffect(() => {
    if (!account) return;
    const revision = ++presenceRevision.current;
    void setPresence(presenceId.current!, desiredPresence, revision, true).catch(() => {
      // Presence is best-effort; stale heartbeats expire server-side.
    });
  }, [account?.id, desiredPresence, setPresence]);

  useEffect(() => {
    if (!account) return;
    const heartbeat = () => {
      const revision = ++presenceRevision.current;
      const status = presenceStatusRef.current;
      void setPresence(presenceId.current!, status, revision).catch(() => {
        // The server stops considering this tab online when heartbeats go stale.
      });
    };
    const interval = window.setInterval(heartbeat, 10_000);
    return () => window.clearInterval(interval);
  }, [account?.id, setPresence]);

  useEffect(() => {
    if (!account) {
      setInvitations([]);
      dismissedIds.current.clear();
      return;
    }

    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void getRoomInvitations().then(nextInvitations => {
        if (!active) return;
        setInvitations(nextInvitations.filter(invitation => !dismissedIds.current.has(invitation.id)));
      }).catch(() => {
        // A transient inbox error should not interrupt the current screen.
      });
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'room-invitation') refresh();
    };
    navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);

    refresh();
    const interval = window.setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
    };
  }, [account?.id, getRoomInvitations]);

  const invitation = canReceiveInvitation ? invitations[0] ?? null : null;

  useEffect(() => {
    if (!invitation) return;
    playSound('notify');
    setError('');
  }, [invitation?.id]);

  const dismiss = (current: RoomInvitationEntry) => {
    dismissedIds.current.add(current.id);
    setInvitations(previous => previous.filter(invite => invite.id !== current.id));
    void respondToRoomInvitation(current.id, 'decline').catch(() => {
      // Keep it dismissed for this visit if the connection drops during close.
    });
  };

  const joinInvitedRoom = async (current: RoomInvitationEntry) => {
    if (!account || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await respondToRoomInvitation(current.id, 'accept');
      if (!result.roomCode) throw new Error('room_not_available');
      dismissedIds.current.add(current.id);
      setInvitations(previous => previous.filter(invite => invite.id !== current.id));
      // The profile name identifies the person in the lobby. The team name is
      // chosen later, together with the crest, on the competition setup screen.
      joinRoom(result.roomCode, account.displayName || account.username);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      const messages: Record<string, string> = {
        room_not_available: 'Essa sala não está mais disponível.',
        room_full: 'A sala já está cheia.',
        already_in_room: 'Sua conta já tem uma vaga nesta sala.',
        inviter_left_room: 'Quem enviou o convite já saiu da sala.',
        room_invitation_expired: 'Esse convite expirou. Peça para enviarem outro.',
        invitee_unavailable: 'Você não pode entrar enquanto estiver em outra sala ou competição.',
      };
      setError(messages[code] ?? 'Não foi possível entrar na sala.');
      void getRoomInvitations().then(nextInvitations => {
        setInvitations(nextInvitations.filter(invite => !dismissedIds.current.has(invite.id)));
      }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!invitation) return null;

  return (
    <GameModal
      open
      onOpenChange={open => { if (!open && !busy) dismiss(invitation); }}
      title="CONVITE PARA SALA"
      subtitle="Convite válido por 5 minutos."
      size="default"
      stacked
      dismissible={!busy}
      closeLabel="Dispensar convite"
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-[var(--ui-brand)]/30 bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)]">
            <DoorOpen size={28} aria-hidden="true" />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--ui-text-muted)]">
            <strong className="text-[var(--ui-text)]">{invitation.inviter_display_name}</strong> está convidando você para entrar em uma partida.
          </p>
        </div>
        {error ? <StatusBanner tone="danger" role="alert">{error}</StatusBanner> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" intent="ghost" disabled={busy} onClick={() => dismiss(invitation)} className="w-full">
            <X size={16} /> RECUSAR
          </Button>
          <Button type="button" intent="primary" loading={busy} disabled={busy} onClick={() => void joinInvitedRoom(invitation)} className="w-full">
            {!busy ? <Check size={16} /> : null} ACEITAR
          </Button>
        </div>
      </div>
    </GameModal>
  );
}
