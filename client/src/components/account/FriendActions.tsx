import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeftRight, MessageCircle, MoreHorizontal, Send, UserMinus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY, getProfileAvatarBackground } from '@shared/profileAppearance';
import { api, useAccount } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { resolveProfileAvatarImage } from '../../lib/profileAvatars';
import PlayerCard from '../game/PlayerCard';
import FramedAvatar from './AvatarFrame';
import { albumCard, CATALOG } from '../album/albumData';
import { Button, GameModal, Input, StatusBanner, Tab, TabList, TabPanel, Tabs } from '../../design-system';

interface FriendActionsProps {
  friendshipId: string;
  friendName: string;
  friendAvatarKey: string;
  friendAvatarBackgroundKey: string;
  friendAvatarUrl?: string | null;
  friendAvatarFrameKey?: string | null;
  friendOnline: boolean;
  friendAvailable: boolean;
  unreadMessageCount?: number;
  initiallyOpenChat?: boolean;
  onInitialChatOpened?: () => void;
  onMessagesRead?: (friendshipId: string) => void;
  onRemove: () => void;
  removeDisabled?: boolean;
}

interface ProfilePhotoData {
  name: string;
  avatarKey: string;
  avatarBackgroundKey: string;
  avatarUrl?: string | null;
  avatarFrameKey?: string | null;
}

interface FriendMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: number;
  expires_at: number;
}

interface FriendTrade {
  id: string;
  friendship_id: string;
  requester_id: string;
  addressee_id: string;
  requester_card_id: string;
  requester_quantity: number;
  addressee_card_id: string | null;
  addressee_quantity: number | null;
  requester_ready: boolean;
  addressee_ready: boolean;
  status: 'pending' | 'accepted';
  created_at: number;
  updated_at: number;
  expires_at: number;
}

interface SpareCard {
  id: string;
  name: string;
  number: number;
  spare: number;
}

function useSpareCards(): SpareCard[] {
  const { album } = useAlbum();
  return useMemo(() => {
    if (!album) return [];
    return Array.from(album.stickers.entries())
      .flatMap(([id, sticker]) => {
        const card = albumCard(id);
        const number = CATALOG.stickers.get(id)?.number;
        return card && number && sticker.spare > 0 ? [{ id, name: card.shortName, number, spare: sticker.spare }] : [];
      })
      .sort((a, b) => a.number - b.number);
  }, [album]);
}

function cardLabel(cardId: string): string {
  const card = albumCard(cardId);
  const number = CATALOG.stickers.get(cardId)?.number;
  return card ? `${card.shortName}${number ? ` · Nº ${number}` : ''}` : 'Carta indisponível';
}

function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function socialError(cause: unknown, fallback: string): string {
  const code = cause instanceof Error ? cause.message : '';
  const messages: Record<string, string> = {
    invalid_message: 'A mensagem precisa ter entre 1 e 500 caracteres.',
    invalid_card: 'Essa carta não está disponível para troca.',
    invalid_quantity: 'Confira a quantidade de cópias.',
    no_spare_copy: 'Uma das cartas selecionadas não tem mais cópias extras suficientes. Confiram as ofertas e tentem novamente.',
    trade_cards_unavailable: 'As cópias dessa oferta não estão mais disponíveis.',
    trade_changed: 'A oferta mudou. Confira a carta do seu amigo antes de confirmar.',
    friend_unavailable: 'Seu amigo precisa estar online e disponível para iniciar uma troca.',
    trade_in_progress: 'Já existe uma negociação em andamento com esse amigo.',
    trade_not_found: 'Essa oferta não está mais disponível.',
    friendship_not_found: 'Essa amizade não está mais ativa.',
  };
  return messages[code] ?? (code || fallback);
}

function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0]}` : words[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function ProfilePhoto({ profile, sizeClassName = 'size-8' }: { profile: ProfilePhotoData; sizeClassName?: string }) {
  const image = profile.avatarUrl || resolveProfileAvatarImage(profile.avatarKey);
  return <FramedAvatar frameKey={profile.avatarFrameKey} compact><span role="img" aria-label={`Foto de ${profile.name}`} className={`relative flex ${sizeClassName} shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ui-line-strong)] text-[11px] font-bold text-white`} style={{ backgroundColor: getProfileAvatarBackground(profile.avatarBackgroundKey || DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY).color }}>
    <span aria-hidden="true" hidden={!!image}>{nameInitials(profile.name)}</span>
    {image ? <img src={image} alt="" loading="lazy" className={`absolute inset-0 ${sizeClassName} rounded-full object-cover`} onError={event => { event.currentTarget.style.display = 'none'; const fallback = event.currentTarget.previousElementSibling as HTMLElement | null; if (fallback) fallback.hidden = false; }} /> : null}
  </span></FramedAvatar>;
}

export default function FriendActions({ friendshipId, friendName, friendAvatarKey, friendAvatarBackgroundKey, friendAvatarUrl, friendAvatarFrameKey, friendOnline, friendAvailable, unreadMessageCount = 0, initiallyOpenChat = false, onInitialChatOpened, onMessagesRead, onRemove, removeDisabled = false }: FriendActionsProps) {
  const { account } = useAccount();
  const [chatOpen, setChatOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const friendProfile: ProfilePhotoData = { name: friendName, avatarKey: friendAvatarKey, avatarBackgroundKey: friendAvatarBackgroundKey, avatarUrl: friendAvatarUrl, avatarFrameKey: friendAvatarFrameKey };
  const viewerProfile: ProfilePhotoData = {
    name: account?.displayName ?? 'Você',
    avatarKey: account?.avatarKey ?? 'mark-evans',
    avatarBackgroundKey: account?.avatarBackgroundKey ?? DEFAULT_PROFILE_AVATAR_BACKGROUND_KEY,
    avatarUrl: account?.avatarUrl,
    avatarFrameKey: account?.avatarFrameKey,
  };
  const unreadMessageDescription = unreadMessageCount === 1
    ? '1 mensagem não lida'
    : `${unreadMessageCount} mensagens não lidas`;

  useEffect(() => {
    if (!initiallyOpenChat) return;
    setChatOpen(true);
    onInitialChatOpened?.();
  }, [initiallyOpenChat, onInitialChatOpened]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }
    const updatePosition = () => {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = 192;
      const height = 148;
      setMenuPosition({
        left: Math.min(Math.max(8, trigger.right - width), Math.max(8, window.innerWidth - width - 8)),
        top: Math.min(trigger.bottom + 6, Math.max(8, window.innerHeight - height - 8)),
      });
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    updatePosition();
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <div ref={rootRef} className="shrink-0">
        <Button type="button" intent="ghost" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={unreadMessageCount > 0 ? `Mais opções para ${friendName}, ${unreadMessageDescription}` : `Mais opções para ${friendName}`} title="Mais opções" onClick={() => setMenuOpen(value => !value)} className="size-9 min-h-9 rounded-lg border border-[var(--ui-line-subtle)] px-0 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]">
          <span className="relative inline-flex items-center justify-center"><MoreHorizontal size={19} aria-hidden="true" />{unreadMessageCount > 0 ? <span aria-hidden="true" className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--ui-surface)] bg-[var(--ui-danger)] px-1 text-[10px] font-bold leading-none text-white">{unreadMessageCount > 9 ? '9+' : unreadMessageCount}</span> : null}</span>
        </Button>
        {menuOpen && menuPosition ? createPortal(
          <div ref={menuRef} role="menu" aria-label={`Opções para ${friendName}`} className="fixed z-[10000] w-48 overflow-hidden rounded-xl border border-[var(--ui-line-strong)] bg-[var(--ui-surface-1)] p-1 shadow-2xl" style={{ top: menuPosition.top, left: menuPosition.left, maxHeight: 'calc(100dvh - 16px)' }}>
            <button type="button" role="menuitem" aria-label={unreadMessageCount > 0 ? `Conversar com ${friendName}, ${unreadMessageDescription}` : `Conversar com ${friendName}`} onClick={() => { closeMenu(); setChatOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-2)]">
              <MessageCircle size={16} aria-hidden="true" className="text-[var(--ui-text-muted)]" /> <span className="flex-1">Conversar</span>{unreadMessageCount > 0 ? <span aria-hidden="true" className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--ui-danger)] px-1 text-[10px] font-bold leading-none text-white">{unreadMessageCount > 9 ? '9+' : unreadMessageCount}</span> : null}
            </button>
            <button type="button" role="menuitem" title={!friendAvailable ? `Você pode consultar negociações; para iniciar uma nova, ${friendOnline ? 'seu amigo precisa estar disponível' : 'seu amigo precisa ficar online e disponível'}.` : undefined} onClick={() => { closeMenu(); setTradeOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-2)]">
              <ArrowLeftRight size={16} aria-hidden="true" className="text-[var(--ui-text-muted)]" /> <span className="flex-1">Trocar cartas</span>{!friendAvailable ? <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ui-text-faint)]">{friendOnline ? 'Ocupado' : 'Offline'}</span> : null}
            </button>
            <div aria-hidden="true" className="my-1 border-t border-[var(--ui-line-subtle)]" />
            <button type="button" role="menuitem" disabled={removeDisabled} onClick={() => { closeMenu(); onRemove(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--ui-danger)] transition hover:bg-[var(--ui-danger-soft)] disabled:cursor-not-allowed disabled:opacity-50">
              <UserMinus size={16} aria-hidden="true" /> Remover amigo
            </button>
          </div>,
          document.body,
        ) : null}
      </div>
      {chatOpen ? <FriendChatDialog open onOpenChange={setChatOpen} friendshipId={friendshipId} friendName={friendName} friendProfile={friendProfile} viewerProfile={viewerProfile} accountId={account?.id ?? ''} hasUnreadMessages={unreadMessageCount > 0} onMessagesRead={onMessagesRead} /> : null}
      {tradeOpen ? <FriendTradeDialog open onOpenChange={setTradeOpen} friendshipId={friendshipId} friendName={friendName} friendOnline={friendOnline} friendAvailable={friendAvailable} accountId={account?.id ?? ''} /> : null}
    </>
  );
}

function FriendChatDialog({ open, onOpenChange, friendshipId, friendName, friendProfile, viewerProfile, accountId, hasUnreadMessages, onMessagesRead }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendshipId: string;
  friendName: string;
  friendProfile: ProfilePhotoData;
  viewerProfile: ProfilePhotoData;
  accountId: string;
  hasUnreadMessages: boolean;
  onMessagesRead?: (friendshipId: string) => void;
}) {
  const { getFriends } = useAccount();
  const hasUnreadMessagesRef = useRef(hasUnreadMessages);
  const onMessagesReadRef = useRef(onMessagesRead);
  hasUnreadMessagesRef.current = hasUnreadMessages;
  onMessagesReadRef.current = onMessagesRead;
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const route = `/api/account/friends/${encodeURIComponent(friendshipId)}/messages`;
  const readRoute = `${route}/read`;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const refresh = async (initial: boolean) => {
      if (initial) setLoading(true);
      try {
        const result = await api<{ messages: FriendMessage[] }>(readRoute, { method: 'POST', body: '{}' });
        if (active) {
          setMessages(result.messages);
          setError('');
          if (initial) {
            void getFriends().catch(() => undefined);
            if (hasUnreadMessagesRef.current) onMessagesReadRef.current?.(friendshipId);
          }
        }
      } catch (cause) {
        if (active) setError(socialError(cause, 'Não foi possível carregar as mensagens.'));
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    void refresh(true);
    const timer = window.setInterval(() => { void refresh(false); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, readRoute, getFriends]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages, open]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await api<{ message: FriendMessage }>(route, { method: 'POST', body: JSON.stringify({ body }) });
      setMessages(current => current.some(message => message.id === result.message.id) ? current : [...current, result.message]);
      setDraft('');
    } catch (cause) {
      setError(socialError(cause, 'Não foi possível enviar a mensagem.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <GameModal
      open={open}
      onOpenChange={onOpenChange}
      title={<span className="flex min-w-0 items-center gap-3 normal-case tracking-normal"><ProfilePhoto profile={friendProfile} sizeClassName="size-10" /><span className="min-w-0"><span className="block truncate font-sans text-base font-semibold leading-tight tracking-normal text-[var(--ui-text)]">{friendName}</span><span className="mt-0.5 block font-sans text-[11px] font-normal tracking-normal text-[var(--ui-text-muted)]">Conversa</span></span></span>}
      subtitle="As mensagens desaparecem após 24 horas."
      bodyClassName="flex min-h-[min(62dvh,520px)] flex-col gap-3 p-3 sm:p-4"
      footer={<form onSubmit={sendMessage} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`friend-message-${friendshipId}`}>Mensagem para {friendName}</label>
        <Input id={`friend-message-${friendshipId}`} value={draft} maxLength={500} onChange={event => setDraft(event.target.value)} placeholder="Escreva uma mensagem..." disabled={sending} />
        <Button type="submit" intent="primary" aria-label="Enviar mensagem" disabled={!draft.trim() || sending} className="size-10 min-h-10 shrink-0 px-0"><Send size={16} aria-hidden="true" /></Button>
      </form>}
    >
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:p-4" aria-live="polite" aria-label="Mensagens">
        {loading ? <p className="m-auto text-sm text-[var(--ui-text-muted)]">Carregando conversa...</p>
          : messages.length === 0 ? <div className="m-auto max-w-xs px-4 text-center"><MessageCircle size={22} aria-hidden="true" className="mx-auto mb-2 text-[var(--ui-text-faint)]" /><p className="text-sm font-semibold text-[var(--ui-text)]">A conversa começa aqui</p><p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Envie uma mensagem para {friendName}. As mensagens ficam disponíveis por 24 horas.</p></div>
            : messages.map((message, index) => {
              const mine = message.sender_id === accountId;
              const groupStart = index === 0 || messages[index - 1]?.sender_id !== message.sender_id;
              return <article key={message.id} className={`flex w-full items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine ? <span className="w-7 shrink-0">{groupStart ? <ProfilePhoto profile={friendProfile} sizeClassName="size-7" /> : null}</span> : null}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-sm bg-[var(--ui-brand)]/15 text-[var(--ui-text)]' : 'rounded-bl-sm bg-white/[.06] text-[var(--ui-text)]'}`}>
                  <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                  <time dateTime={new Date(message.created_at).toISOString()} title={`Expira às ${new Date(message.expires_at).toLocaleString('pt-BR')}`} className="mt-1 block text-right text-[10px] text-[var(--ui-text-faint)]">{timeLabel(message.created_at)}</time>
                </div>
                {mine ? <span className="w-7 shrink-0">{groupStart ? <ProfilePhoto profile={viewerProfile} sizeClassName="size-7" /> : null}</span> : null}
              </article>;
            })}
        <div ref={bottomRef} />
      </div>
    </GameModal>
  );
}

function FriendTradeDialog({ open, onOpenChange, friendshipId, friendName, friendOnline, friendAvailable, accountId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendshipId: string;
  friendName: string;
  friendOnline: boolean;
  friendAvailable: boolean;
  accountId: string;
}) {
  const { album, refresh: refreshAlbum } = useAlbum();
  const spareCards = useSpareCards();
  const [trades, setTrades] = useState<FriendTrade[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [tradeTab, setTradeTab] = useState<'offers' | 'new'>('offers');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const tradeStateRevision = useRef(0);
  const refreshedAcceptedTrades = useRef(new Set<string>());
  const route = `/api/account/friends/${encodeURIComponent(friendshipId)}/trades`;
  const filteredCards = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return spareCards.filter(card => !needle || `${card.name} ${card.number}`.toLocaleLowerCase('pt-BR').includes(needle));
  }, [spareCards, search]);
  const selectedCard = spareCards.find(card => card.id === selectedCardId) ?? null;

  const loadTrades = useCallback(async (initial = false) => {
    const revision = tradeStateRevision.current;
    if (initial) setLoading(true);
    try {
      const result = await api<{ trades: FriendTrade[] }>(route);
      if (revision === tradeStateRevision.current) {
        setTrades(result.trades);
        setError('');
      }
    } catch (cause) {
      setError(socialError(cause, 'Não foi possível carregar as trocas.'));
    } finally {
      if (initial) setLoading(false);
    }
  }, [route]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let refreshing = false;
    const refresh = async (initial: boolean) => {
      if (refreshing) return;
      refreshing = true;
      const revision = tradeStateRevision.current;
      if (initial) setLoading(true);
      try {
        const result = await api<{ trades: FriendTrade[] }>(route);
        if (active && revision === tradeStateRevision.current) {
          setTrades(result.trades);
          setError('');
          const newlyAccepted = result.trades.filter(trade => trade.status === 'accepted' && !refreshedAcceptedTrades.current.has(trade.id));
          if (newlyAccepted.length > 0) {
            newlyAccepted.forEach(trade => refreshedAcceptedTrades.current.add(trade.id));
            setSuccess('Uma troca foi concluída. Seu álbum e seu inventário foram atualizados.');
            void refreshAlbum();
          }
        }
      } catch (cause) {
        if (active) setError(socialError(cause, 'Não foi possível carregar as trocas.'));
      } finally {
        refreshing = false;
        if (active && initial) setLoading(false);
      }
    };
    void refresh(true);
    const timer = window.setInterval(() => { void refresh(false); }, 1500);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, refreshAlbum, route]);

  useEffect(() => {
    if (!filteredCards.some(card => card.id === selectedCardId)) {
      setSelectedCardId(filteredCards[0]?.id ?? '');
      setQuantity(1);
    }
  }, [selectedCardId, filteredCards]);

  const submitOffer = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCard || creating || !friendAvailable || trades.some(trade => trade.status === 'pending')) return;
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      tradeStateRevision.current += 1;
      await api<{ trade: FriendTrade }>(route, { method: 'POST', body: JSON.stringify({ cardId: selectedCard.id, quantity }) });
      tradeStateRevision.current += 1;
      setSearch('');
      setTradeTab('offers');
      setSuccess(`Negociação iniciada. ${friendName} poderá escolher a carta de volta e confirmar com você.`);
      await loadTrades();
    } catch (cause) {
      setError(socialError(cause, 'Não foi possível enviar a oferta.'));
    } finally {
      setCreating(false);
    }
  };

  const actOnTrade = async (trade: FriendTrade, action: 'decline' | 'cancel') => {
    tradeStateRevision.current += 1;
    setError('');
    try {
      await api(`${route}/${encodeURIComponent(trade.id)}/${action}`, { method: 'POST' });
      tradeStateRevision.current += 1;
      await loadTrades();
    } catch (cause) {
      tradeStateRevision.current += 1;
      setError(socialError(cause, 'Não foi possível atualizar a oferta.'));
    }
  };

  const saveSelection = async (trade: FriendTrade, cardId: string, quantity: number, ready: boolean) => {
    tradeStateRevision.current += 1;
    try {
      const result = await api<{ trade: FriendTrade; status?: string }>(`${route}/${encodeURIComponent(trade.id)}/selection`, {
        method: 'PATCH', body: JSON.stringify({
          cardId,
          quantity,
          ready,
          expectedOtherCardId: ready ? (trade.requester_id === accountId ? trade.addressee_card_id : trade.requester_card_id) : null,
          expectedOtherQuantity: ready ? (trade.requester_id === accountId ? trade.addressee_quantity : trade.requester_quantity) : null,
        }),
      });
      tradeStateRevision.current += 1;
      setTrades(current => current.map(item => item.id === trade.id ? result.trade : item));
      if (result.status === 'accepted' || result.trade.status === 'accepted') {
        await refreshAlbum();
        setSuccess('Troca concluída. Seu álbum e seu inventário foram atualizados.');
      }
    } catch (cause) {
      tradeStateRevision.current += 1;
      throw cause;
    }
  };

  const incoming = trades.filter(trade => trade.status === 'pending' && trade.addressee_id === accountId);
  const outgoing = trades.filter(trade => trade.status === 'pending' && trade.requester_id === accountId);
  const hasActiveTrade = incoming.length + outgoing.length > 0;

  return (
    <GameModal
      open={open}
      onOpenChange={onOpenChange}
      title="NEGOCIAÇÃO"
      subtitle={`Com ${friendName} · os dois escolhem e confirmam as cartas`}
      size="wide"
      bodyClassName="space-y-4 p-3 sm:p-4"
    >
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}
      {success ? <StatusBanner tone="success">{success}</StatusBanner> : null}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${friendAvailable ? 'bg-[var(--ui-success)]/10 text-[var(--ui-success)]' : 'bg-white/[.04] text-[var(--ui-text-muted)]'}`}><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${friendAvailable ? 'bg-[var(--ui-success)]' : friendOnline ? 'bg-[var(--ui-warning)]' : 'bg-[var(--ui-text-faint)]'}`} />{friendAvailable ? `${friendName} está online e disponível para receber uma troca.` : friendOnline ? `${friendName} está online, mas ocupado. Você poderá iniciar uma troca quando estiver disponível.` : `${friendName} está offline. Você poderá iniciar uma troca quando estiver online e disponível.`}</div>

      <Tabs value={tradeTab} onValueChange={value => setTradeTab(value as 'offers' | 'new')}>
        <TabList aria-label="Seções de negociação" className="grid w-full grid-cols-2">
          <Tab value="offers">OFERTAS <span className="ml-1 tabular-nums text-[var(--ui-text-muted)]">{incoming.length + outgoing.length}</span></Tab>
          <Tab value="new">NOVA OFERTA</Tab>
        </TabList>

        <TabPanel value="new" className="pt-3">
          <form onSubmit={submitOffer} className="space-y-3 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:p-4">
        {hasActiveTrade ? <StatusBanner tone="default">Já existe uma negociação em andamento. Continue pela aba Ofertas.</StatusBanner> : null}
        <div>
          <h3 className="text-sm font-bold text-[var(--ui-text)]">Escolha o que oferecer</h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">Depois de iniciar, os dois escolhem as repetidas e confirmam a troca juntos.</p>
        </div>
        {spareCards.length === 0 ? <p className="text-sm text-[var(--ui-text-muted)]">Você não tem cópias extras para trocar.</p> : <>
          <label className="block space-y-1.5 text-xs font-semibold text-[var(--ui-text-muted)]">
            Buscar uma carta repetida
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou número no álbum" />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-[var(--ui-text-muted)]">
            Carta que você oferece
            <select className="ui-input w-full" value={selectedCardId} onChange={event => { setSelectedCardId(event.target.value); setQuantity(1); }}>
              {filteredCards.length === 0 ? <option value="">Nenhuma carta encontrada</option> : filteredCards.map(card => <option key={card.id} value={card.id}>{card.name} · Nº {card.number} · {card.spare} extra(s)</option>)}
            </select>
          </label>
          {selectedCard ? <div className="flex items-center gap-3 rounded-lg border border-[var(--ui-line-subtle)] bg-black/10 p-2">
            <PlayerCard player={albumCard(selectedCard.id)!} lite scale={0.22} />
            <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--ui-text)]">{selectedCard.name}</strong><span className="text-xs text-[var(--ui-text-muted)]">Nº {selectedCard.number} · {selectedCard.spare} cópia(s) extra(s)</span></div>
            <label className="w-20 shrink-0 space-y-1 text-[11px] font-semibold text-[var(--ui-text-muted)]">Quantidade<Input type="number" min={1} max={selectedCard.spare} value={quantity} onChange={event => setQuantity(Math.max(1, Math.min(selectedCard.spare, Number(event.target.value) || 1)))} /></label>
          </div> : null}
          <Button type="submit" intent="primary" loading={creating} disabled={!friendAvailable || hasActiveTrade || !selectedCard || quantity < 1 || quantity > (selectedCard?.spare ?? 0)} className="w-full sm:w-auto">{hasActiveTrade ? 'NEGOCIAÇÃO EM ANDAMENTO' : 'INICIAR NEGOCIAÇÃO'}</Button>
        </>}
        <p className="text-[11px] text-[var(--ui-text-faint)]">A negociação expira após 72 horas. As cartas só são trocadas quando os dois confirmam.</p>
          </form>
        </TabPanel>

        <TabPanel value="offers" className="space-y-4 pt-3">
          {loading ? <p className="py-8 text-center text-sm text-[var(--ui-text-muted)]">Carregando ofertas...</p>
            : incoming.length === 0 && outgoing.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--ui-line-subtle)] px-4 py-8 text-center"><p className="text-sm font-semibold text-[var(--ui-text)]">Nenhuma oferta em andamento</p><p className="mt-1 text-xs text-[var(--ui-text-muted)]">Ofertas suas ou de {friendName} aparecerão aqui.</p><Button type="button" intent="secondary" onClick={() => setTradeTab('new')} className="mt-3 min-h-9 px-3 text-xs">CRIAR OFERTA</Button></div>
              : <div className="space-y-5">
                {incoming.length > 0 ? <section className="space-y-3"><h3 className="text-sm font-bold text-[var(--ui-text)]">Recebidas <span className="text-[var(--ui-text-muted)]">({incoming.length})</span></h3><div className="space-y-2">{incoming.map(trade => <FriendTradeSessionCard key={trade.id} trade={trade} isRequester={false} friendName={friendName} spareCards={spareCards} onUpdate={saveSelection} onClose={actOnTrade} />)}</div></section> : null}
                {outgoing.length > 0 ? <section className="space-y-3"><h3 className="text-sm font-bold text-[var(--ui-text)]">Enviadas <span className="text-[var(--ui-text-muted)]">({outgoing.length})</span></h3><div className="space-y-2">{outgoing.map(trade => <FriendTradeSessionCard key={trade.id} trade={trade} isRequester friendName={friendName} spareCards={spareCards} onUpdate={saveSelection} onClose={actOnTrade} />)}</div></section> : null}
              </div>}
          {!album ? <p className="text-xs text-[var(--ui-text-faint)]">Carregando seu álbum...</p> : null}
        </TabPanel>
      </Tabs>
    </GameModal>
  );
}

function FriendTradeSessionCard({ trade, isRequester, friendName, spareCards, onUpdate, onClose }: {
  trade: FriendTrade;
  isRequester: boolean;
  friendName: string;
  spareCards: SpareCard[];
  onUpdate: (trade: FriendTrade, cardId: string, quantity: number, ready: boolean) => Promise<void>;
  onClose: (trade: FriendTrade, action: 'decline' | 'cancel') => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const myCardId = isRequester ? trade.requester_card_id : trade.addressee_card_id;
  const myQuantity = isRequester ? trade.requester_quantity : trade.addressee_quantity ?? 1;
  const myReady = isRequester ? trade.requester_ready : trade.addressee_ready;
  const theirCardId = isRequester ? trade.addressee_card_id : trade.requester_card_id;
  const theirQuantity = isRequester ? trade.addressee_quantity : trade.requester_quantity;
  const theirReady = isRequester ? trade.addressee_ready : trade.requester_ready;
  const selectedCard = spareCards.find(card => card.id === myCardId) ?? null;
  const filteredCards = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return spareCards.filter(card => !needle || `${card.name} ${card.number}`.toLocaleLowerCase('pt-BR').includes(needle));
  }, [spareCards, search]);

  const selectCard = async (card: SpareCard) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onUpdate(trade, card.id, card.id === myCardId ? myQuantity : 1, false);
    } catch (cause) {
      setError(socialError(cause, 'Não foi possível atualizar sua oferta.'));
    } finally {
      setBusy(false);
    }
  };

  const setReady = async (ready: boolean) => {
    if (!myCardId || !selectedCard || busy || (ready && (!theirCardId || !theirQuantity))) return;
    setBusy(true);
    setError('');
    try {
      await onUpdate(trade, myCardId, myQuantity, ready);
    } catch (cause) {
      setError(socialError(cause, 'Não foi possível confirmar sua oferta.'));
    } finally {
      setBusy(false);
    }
  };

  const changeQuantity = async (delta: number) => {
    if (!myCardId || !selectedCard || busy) return;
    const next = Math.max(1, Math.min(selectedCard.spare, myQuantity + delta));
    if (next === myQuantity) return;
    setBusy(true);
    setError('');
    try {
      await onUpdate(trade, myCardId, next, false);
    } catch (cause) {
      setError(socialError(cause, 'Não foi possível alterar a quantidade.'));
    } finally {
      setBusy(false);
    }
  };

  const closeTrade = async () => {
    setBusy(true);
    setError('');
    try {
      await onClose(trade, isRequester ? 'cancel' : 'decline');
    } catch (cause) {
      setError(socialError(cause, 'Não foi possível encerrar a negociação.'));
    } finally {
      setBusy(false);
    }
  };

  return <article className="space-y-4 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] p-3 sm:p-4">
    <div className="flex items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-[var(--ui-text)]">Negociação ao vivo</h4><p className="text-xs text-[var(--ui-text-muted)]">Escolham uma repetida cada e confirmem.</p></div><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ui-success)]"><span className="size-1.5 animate-pulse rounded-full bg-[var(--ui-success)]" />ao vivo</span></div>
    <div className="grid gap-3 md:grid-cols-2">
      <section className="min-w-0 space-y-3 rounded-lg border border-[var(--ui-line-subtle)] bg-black/10 p-3">
        <div className="flex items-center justify-between gap-2"><div><strong className="text-xs text-[var(--ui-text)]">Sua carta</strong><p className="text-[11px] text-[var(--ui-text-muted)]">{myReady ? 'Você confirmou sua oferta.' : 'Selecione uma carta repetida.'}</p></div><OfferReadyState ready={myReady} /></div>
        {myCardId && albumCard(myCardId) ? <div className="flex items-center gap-2"><PlayerCard player={albumCard(myCardId)!} compact lite /><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-[var(--ui-text)]">{myQuantity}× {cardLabel(myCardId)}</strong><span className="text-[10px] text-[var(--ui-text-muted)]">{selectedCard?.spare ?? 0} extra(s)</span><div className="mt-1 flex items-center gap-1.5"><Button type="button" intent="ghost" aria-label="Diminuir quantidade" disabled={busy || myQuantity <= 1} onClick={() => void changeQuantity(-1)} className="size-7 min-h-7 px-0"><span aria-hidden="true">−</span></Button><span className="min-w-8 text-center text-xs tabular-nums text-[var(--ui-text)]">{myQuantity}</span><Button type="button" intent="ghost" aria-label="Aumentar quantidade" disabled={busy || myQuantity >= (selectedCard?.spare ?? 0)} onClick={() => void changeQuantity(1)} className="size-7 min-h-7 px-0"><span aria-hidden="true">+</span></Button></div></div></div> : <p className="rounded-md border border-dashed border-[var(--ui-line-subtle)] p-3 text-center text-xs text-[var(--ui-text-muted)]">Escolha sua carta abaixo.</p>}
        <label className="block space-y-1 text-[11px] font-semibold text-[var(--ui-text-muted)]">Buscar repetida<Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou número" /></label>
        {filteredCards.length ? <div className="grid max-h-48 grid-cols-3 justify-items-center gap-2 overflow-y-auto rounded-md p-1 sm:grid-cols-4">{filteredCards.map(card => { const player = albumCard(card.id); return player ? <div key={card.id} className="flex flex-col items-center gap-1"><PlayerCard player={player} compact lite selected={card.id === myCardId} onClick={() => void selectCard(card)} /><span className="text-[10px] text-[var(--ui-text-muted)]">{card.spare} extra(s)</span></div> : null; })}</div> : <p className="text-xs text-[var(--ui-text-muted)]">Sem repetidas disponíveis.</p>}
      </section>
      <section className="min-w-0 space-y-3 rounded-lg border border-[var(--ui-line-subtle)] bg-black/10 p-3">
        <div className="flex items-center justify-between gap-2"><div><strong className="text-xs text-[var(--ui-text)]">Carta de {friendName}</strong><p className="text-[11px] text-[var(--ui-text-muted)]">{theirReady ? 'Amigo confirmou a oferta.' : 'A seleção aparece em tempo real.'}</p></div><OfferReadyState ready={theirReady} /></div>
        {theirCardId && albumCard(theirCardId) ? <div className="flex items-center gap-2"><PlayerCard player={albumCard(theirCardId)!} compact lite /><div className="min-w-0"><strong className="block truncate text-xs text-[var(--ui-text)]">{theirQuantity}× {cardLabel(theirCardId)}</strong><span className="text-[10px] text-[var(--ui-text-muted)]">Oferta de {friendName}</span></div></div> : <div className="grid min-h-36 place-items-center rounded-md border border-dashed border-[var(--ui-line-subtle)] px-3 text-center"><div><ArrowLeftRight size={20} aria-hidden="true" className="mx-auto mb-2 text-[var(--ui-text-faint)]" /><p className="text-sm font-semibold text-[var(--ui-text)]">Aguardando carta</p><p className="mt-1 text-[11px] text-[var(--ui-text-muted)]">{friendName} ainda está escolhendo.</p></div></div>}
        <div className="rounded-md border border-[var(--ui-line-subtle)] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ui-text-faint)]">Prontidão</p><p className="mt-2 flex items-center justify-between text-xs"><span className="text-[var(--ui-text-muted)]">Você</span><span className={myReady ? 'text-[var(--ui-success)]' : 'text-[var(--ui-text-faint)]'}>{myReady ? 'Pronto' : 'Escolhendo'}</span></p><p className="mt-1 flex items-center justify-between text-xs"><span className="text-[var(--ui-text-muted)]">{friendName}</span><span className={theirReady ? 'text-[var(--ui-success)]' : 'text-[var(--ui-text-faint)]'}>{theirReady ? 'Pronto' : 'Escolhendo'}</span></p></div>
      </section>
    </div>
    {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" intent="ghost" disabled={busy} onClick={() => void closeTrade()} className="min-h-9 px-3 text-xs">{isRequester ? 'CANCELAR NEGOCIAÇÃO' : 'RECUSAR TROCA'}</Button><Button type="button" intent={myReady ? 'secondary' : 'success'} loading={busy} disabled={!myCardId || !selectedCard || busy || (!myReady && (!theirCardId || !theirQuantity))} onClick={() => void setReady(!myReady)} className="min-h-9 px-3 text-xs">{myReady ? 'CONFIRMADO · DESFAZER' : 'CONFIRMAR MINHA OFERTA'}</Button></div>
  </article>;
}

function OfferReadyState({ ready }: { ready: boolean }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${ready ? 'bg-[var(--ui-success)]/15 text-[var(--ui-success)]' : 'bg-white/[.06] text-[var(--ui-text-muted)]'}`}>{ready ? 'Confirmada' : 'Escolhendo'}</span>;
}
