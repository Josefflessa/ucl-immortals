// React provider: solo autosave, the online socket and every action exposed to the pages.

import React from 'react';
import { createContext, useContext, useReducer, useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAccount } from '../AccountContext';
import { clearSoloSave, loadSoloSave, writeSoloSave } from '../../lib/soloSave';
import { Player, type PlayerSpecialization } from '@shared/game/gameData';
import { Team, MatchResult, type MatchPlan, type VariantFlag } from '@shared/game/gameEngine';
import { type AttrKey } from '@shared/game/traits';
import { ShopVariant, TrainAttr, type RegularPlayerPackRarity } from '@shared/game/shop';
import { BetBuilderSelection, BetMarket, buildLeagueMatchKey } from '@shared/game/bets';
import { type ClubProjectId } from '@shared/game/clubProjects';
import { TradeSession } from '@shared/game/market';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem, getClientId } from '../../lib/storage';
import { type CompetitionFormat } from '@shared/game/competition';
import { applyRoomPatch, type RoomPatchOperation } from '../../../../shared/room-sync';
import { DurableRealtimeSocket, type RealtimeClientSocket } from '../../lib/realtimeSocket';
import { toast } from 'sonner';
import { type GameState, type GameAction, initialState } from './state';
import { SOLO_CAMPAIGN_PHASES, type SavedSoloCampaign, savedCampaignSummary } from './soloCampaign';
import { gameReducer } from './reducer';

// ============================================================
// CONTEXT
// ============================================================
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  // Helpers
  getTeamById: (id: string) => Team | undefined;
  
  // Online Multiplayer Socket emitters
  createRoom: (creatorName: string, competitionFormat: CompetitionFormat, difficulty?: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  startSetupOnline: () => void;
  submitSetupOnline: (coachId: string, formationId: string, crestId?: string | null) => void;
  draftPickOnline: (playerId: string) => void;
  draftVetoOnline: () => void;
  submitSquadReviewOnline: (captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, draftedPlayers: (Player | undefined)[], playStyle: string, formationId: string, matchPlan: MatchPlan) => void;
  setMatchRolesOnline: (captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, playStyle?: string, formationId?: string) => void;
  setMatchPlanOnline: (matchPlan: MatchPlan) => void;
  // League — host only
  playRoundOnline: () => void;
  advanceRoundOnline: () => void;
  // Knockout — host only
  playKnockoutRoundOnline: () => void;
  advanceKnockoutRoundOnline: () => void;
  restartRoomOnline: () => void;
  transferHostOnline: (targetPlayerId: string) => void;
  removePlayerOnline: (targetPlayerId: string) => void;
  leaveRoomOnline: () => void;
  closeRoomOnline: () => void;
  // Each player emits this when they finish watching their match replay. A
  // knockout replay identifies the exact tie/leg so ida remains confirmable
  // after the bracket pointer has advanced to the volta.
  notifyMatchWatchedOnline: (type: 'league' | 'knockout', knockout?: { matchId: string; leg?: number }) => void;
  /** The solo campaign saved on this device for the current account (null = none). */
  savedSoloCampaign: SavedSoloCampaign | null;
  continueSoloCampaign: () => Promise<void>;
  discardSoloCampaign: () => Promise<void>;
  shopChangeCoachOnline: (coachId: string) => void;
  upgradeClubProjectOnline: (projectId: ClubProjectId) => void;
  evolveCoachPrimeOnline: () => void;
  shopOpenUniquePackOnline: () => void;
  shopClaimUniquePackOnline: () => void;
  ensurePlayerPackOffersOnline: () => void;
  shopOpenPlayerPackOnline: (rarity: RegularPlayerPackRarity) => void;
  shopClaimPlayerPackOnline: () => void;
  shopOpenPackOnline: (position: string) => void;
  shopPickPackOnline: (player: Player) => void;
  shopTurbinarOnline: (playerId: string, variant: ShopVariant) => void;
  shopRemoveVariantOnline: (playerId: string, variantKey?: VariantFlag) => void;
  shopPlaceBetOnline: (matchKey: string, homeGoals: number, awayGoals: number, stake: number, homeTeamId?: string, awayTeamId?: string, market?: BetMarket, selections?: BetBuilderSelection[]) => void;
  shopCancelBetOnline: (matchKey: string) => void;
  healInjuryOnline: (playerId: string) => void;
  emergencyReplaceOnline: (starterId: string, playerId: string) => void;
  marketSellOnline: (playerId: string) => void;
  marketListOnline: (playerId: string, price: number) => void;
  marketCancelOnline: (listingId: string) => void;
  marketBuyOnline: (listingId: string) => void;
  tradeInviteOnline: (toPlayerId: string) => void;
  tradeLeaveOnline: (tradeId: string) => void;
  tradeAcceptInviteOnline: (tradeId: string) => void;
  tradeSelectOnline: (tradeId: string, playerIds: string[], creditsDelta: number) => void;
  tradeReadyOnline: (tradeId: string) => void;
  playerReadyOnline: () => void;
  playerUnreadyOnline: () => void;
  shopTrainOnline: (playerId: string, attr: TrainAttr) => void;
  swapPlayerTeamOnline: (indexA: number, indexB: number) => void;
  martirTargetsOnline: (playerId: string, targetIds: string[]) => void;
  padrinhoTargetOnline: (playerId: string, targetId: string) => void;
  setEvolvePointOnline: (playerId: string, attr: AttrKey, delta: number) => void;
  setAutoEvolveAttributeOnline: (playerId: string, attr: AttrKey | null) => void;
  unlockSpecializationOnline: (playerId: string) => void;
  chooseSpecializationOnline: (playerId: string, specialization: PlayerSpecialization) => void;
  resetEvolvePointsOnline: (playerId: string) => void;
  rerollReinforcementOnline: () => void;
  pickReinforcementOnline: (player: Player) => void;
  dismissReinforcementOnline: () => void;
  requestMatchResultOnline: (round: number, homeTeamId: string, awayTeamId: string) => Promise<MatchResult | null>;
  acceptMissionOnline: (missionId: string) => void;
  rerollMissionsOnline: () => void;
  removeMissionOnline: (missionId: string) => void;
  dismissMissionResolutionOnline: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

// Production builds use the Durable Object endpoint on the same Cloudflare
// hostname. `pnpm dev` uses the Socket.IO server embedded in Vite.
function usesDurableRealtime(): boolean {
  return !import.meta.env.DEV;
}

// Exported separately to avoid HMR incompatibility
export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const socketRef = useRef<RealtimeClientSocket | null>(null);
  const socketRoomCodeRef = useRef<string | null>(null);
  const onlineRoomRef = useRef<any | null>(null);
  const onlineSyncRevisionRef = useRef<number | null>(null);
  // Server-side room revision. Unlike the per-socket patch counter, this is
  // shared by every connection and lets us reject a late snapshot from an old
  // socket/reconnect instead of rendering the room back in time.
  const authoritativeRoomRevisionRef = useRef<number | null>(null);
  const syncRequestPendingRef = useRef(false);
  const commandSequenceRef = useRef(0);
  // Pending "Ver Detalhes" fetches for a trimmed (bygone-round) online result,
  // keyed by buildLeagueMatchKey so a response resolves the matching request.
  const matchResultRequestsRef = useRef(new Map<string, { resolve: (result: MatchResult | null) => void; timeout: ReturnType<typeof setTimeout> }>());
  const clearPendingMatchResultRequests = useCallback(() => {
    matchResultRequestsRef.current.forEach(({ resolve, timeout }) => {
      clearTimeout(timeout);
      resolve(null);
    });
    matchResultRequestsRef.current.clear();
  }, []);

  // Every gameplay action gets an opaque command ID. The Durable Object stores
  // a bounded receipt for it, so a reconnect can safely retry the exact action
  // without charging twice or advancing a bracket twice.
  const emitOnlineAction = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    if (!socketRef.current || !state.roomCode) return;
    commandSequenceRef.current += 1;
    const entropy = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replaceAll('-', '')
      : Math.random().toString(36).slice(2);
    const commandId = `${getClientId()}-${Date.now().toString(36)}-${commandSequenceRef.current}-${entropy}`;
    const roomEpoch = onlineRoomRef.current?.roomEpoch;
    socketRef.current.emit(event, {
      ...payload,
      commandId,
      ...(Number.isSafeInteger(roomEpoch) && roomEpoch > 0 ? { roomEpoch } : {}),
    });
  }, [state.roomCode]);

  // Auto disconnect on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const connectSocket = useCallback((requestedRoomCode?: string) => {
    const durableRealtime = usesDurableRealtime();
    const roomCode = requestedRoomCode?.toUpperCase() || getStorageItem(STORAGE_KEYS.roomCode)?.toUpperCase();
    if (socketRef.current) {
      // A failed join/create may leave a live socket pointing to a different
      // room object. Recreate it instead of leaking actions into that room.
      if (!durableRealtime || !roomCode || socketRoomCodeRef.current === roomCode) return socketRef.current;
      socketRef.current.disconnect();
      socketRef.current = null;
      authoritativeRoomRevisionRef.current = null;
    }

    if (durableRealtime && !roomCode) {
      throw new Error('Uma sala é necessária para abrir a conexão online.');
    }

    // O Socket.IO continua disponível para `pnpm dev`. No build publicado o
    // transporte é WebSocket nativo, atendido pelo Durable Object da própria
    // Cloudflare; não há host externo de backend para configurar.
    const socketInstance: RealtimeClientSocket = durableRealtime
      ? new DurableRealtimeSocket(roomCode!)
      : io({
        transports: ['websocket', 'polling'],
        autoConnect: true,
      }) as unknown as RealtimeClientSocket;

    socketRef.current = socketInstance;
    socketRoomCodeRef.current = roomCode ?? null;
    authoritativeRoomRevisionRef.current = null;

    const requestRoomSync = () => {
      const roomCode = getStorageItem(STORAGE_KEYS.roomCode);
      if (!roomCode || syncRequestPendingRef.current) return;
      syncRequestPendingRef.current = true;
      socketInstance.emit("sync_room", { roomCode });
    };

    const isCurrentSocket = () => socketRef.current === socketInstance;
    const endOnlineSession = () => {
      if (!isCurrentSocket()) return;
      // Clear the identity before closing the transport. This prevents the
      // intentional close from being mistaken for a recoverable network drop.
      onlineRoomRef.current = null;
      onlineSyncRevisionRef.current = null;
      authoritativeRoomRevisionRef.current = null;
      syncRequestPendingRef.current = false;
      clearPendingMatchResultRequests();
      removeStorageItem(STORAGE_KEYS.playerName);
      removeStorageItem(STORAGE_KEYS.roomCode);
      socketRef.current = null;
      socketRoomCodeRef.current = null;
      socketInstance.disconnect();
      dispatch({ type: 'DISCONNECT_ONLINE' });
    };
    const acceptRoomState = (roomState: any): boolean => {
      if (!isCurrentSocket() || !roomState || typeof roomState !== 'object') return false;
      const incomingRevision = Number.isSafeInteger(roomState.stateRevision) && roomState.stateRevision >= 0
        ? roomState.stateRevision as number
        : null;
      const currentRevision = authoritativeRoomRevisionRef.current;
      // Every server frame is versioned; never let an older revision overwrite a newer one.
      if (incomingRevision === null) return false;
      if (currentRevision !== null && incomingRevision < currentRevision) return false;
      authoritativeRoomRevisionRef.current = incomingRevision;
      return true;
    };

    // `connect` dispara no primeiro conecte E em toda reconexão de transporte (o
    // socket caiu e o socket.io reconectou sozinho, sem recarregar a página). Numa
    // reconexão o `socket.id` é NOVO, então o servidor não nos reconhece mais e toda
    // ação vira no-op silencioso (tela travada). Re-emitimos o join com a identidade
    // persistente (clientId): o servidor reassocia o socket ao nosso jogador, nos põe
    // de volta na sala e re-sincroniza o estado. O primeiro conecte é ignorado aqui —
    // quem cuida dele é o fluxo de create/join (e o auto-reconnect de mount).
    let hasConnectedOnce = false;
    let reconnectToastId: string | number | undefined;
    socketInstance.on("connect", () => {
      if (!isCurrentSocket()) return;
      console.log("Socket connected to server:", socketInstance.id);
      if (hasConnectedOnce) {
        const roomCode = getStorageItem(STORAGE_KEYS.roomCode);
        const playerName = getStorageItem(STORAGE_KEYS.playerName);
        if (roomCode && playerName) {
          console.log(`Reconectado — re-entrando na sala ${roomCode}...`);
          socketInstance.emit("join_room", { roomCode, playerName, clientId: getClientId() });
        }
        if (reconnectToastId !== undefined) {
          toast.dismiss(reconnectToastId);
          toast.success("Reconectado ✓");
          reconnectToastId = undefined;
        }
      }
      hasConnectedOnce = true;
    });

    // Conexão perdida no meio de uma sessão: mostra um aviso persistente enquanto o
    // socket.io tenta reconectar (o `connect` acima re-entra na sala e limpa o aviso).
    // Ignora saídas intencionais (o próprio jogador saiu) e quando não há sala ativa.
    socketInstance.on("disconnect", (payload?: string | { reason?: string; code?: number }) => {
      if (!isCurrentSocket()) return;
      onlineRoomRef.current = null;
      onlineSyncRevisionRef.current = null;
      authoritativeRoomRevisionRef.current = null;
      syncRequestPendingRef.current = false;
      const inRoom = getStorageItem(STORAGE_KEYS.roomCode);
      const reason = typeof payload === 'string' ? payload : payload?.reason;
      if (inRoom && reason !== "io client disconnect" && reconnectToastId === undefined) {
        reconnectToastId = toast.loading("Conexão perdida — reconectando…");
      }
    });

    socketInstance.on("realtime_latency", ({ rttMs }: { rttMs?: unknown }) => {
      if (!isCurrentSocket() || typeof rttMs !== 'number' || !Number.isFinite(rttMs)) return;
      // Keep this diagnostic quiet during normal play; it becomes useful when
      // a player reports delay and gives us a client-side signal to compare
      // with the Durable Object's slow-operation logs.
      if (rttMs >= 1_500) console.warn(`Latência realtime elevada: ${Math.round(rttMs)}ms`);
    });

    // Uma ação estourou no servidor (o wrapper de handlers avisou). Em vez de a tela
    // ficar travada sem feedback, mostramos um toast.
    socketInstance.on("action_error", ({ message }: { message?: string }) => {
      if (!isCurrentSocket()) return;
      toast.error(message || "Algo deu errado ao processar a ação. Tenta de novo.");
    });

    socketInstance.on("action_dropped", () => {
      if (!isCurrentSocket()) return;
      toast.error("Conexão instável: a ação não foi enviada. Aguarde a reconexão e tente novamente.");
    });

    // Response to "request_match_result" — the full (untrimmed) result of one
    // bygone-round league fixture, fetched on demand for "Ver Detalhes".
    socketInstance.on("match_result_full", ({ round, homeTeamId, awayTeamId, result }: { round?: unknown; homeTeamId?: unknown; awayTeamId?: unknown; result?: MatchResult }) => {
      if (!isCurrentSocket() || typeof round !== 'number' || typeof homeTeamId !== 'string' || typeof awayTeamId !== 'string') return;
      const key = buildLeagueMatchKey(round, homeTeamId, awayTeamId);
      const pending = matchResultRequestsRef.current.get(key);
      if (!pending) return;
      matchResultRequestsRef.current.delete(key);
      clearTimeout(pending.timeout);
      pending.resolve(result ?? null);
    });

    // A rejected command is terminal (it was not applied), but the browser may
    // have been acting on a stale phase/balance. Pull one authoritative snapshot
    // so the UI immediately explains the current room instead of remaining stale.
    socketInstance.on("command_ack", ({ status }: { status?: string }) => {
      if (!isCurrentSocket()) return;
      if (status === 'rejected') requestRoomSync();
    });

    socketInstance.on("room_snapshot", ({ roomState, syncRevision }: { roomState?: any; syncRevision?: number }) => {
      if (!isCurrentSocket()) return;
      if (!roomState || typeof syncRevision !== 'number' || !Number.isInteger(syncRevision) || syncRevision < 0) {
        requestRoomSync();
        return;
      }
      if (!acceptRoomState(roomState)) return;
      onlineRoomRef.current = roomState;
      onlineSyncRevisionRef.current = syncRevision;
      syncRequestPendingRef.current = false;
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("room_patch", ({ baseRevision, revision, patch }: {
      baseRevision?: number;
      revision?: number;
      patch?: RoomPatchOperation[];
    }) => {
      if (!isCurrentSocket()) return;
      if (!onlineRoomRef.current
        || !Number.isInteger(baseRevision)
        || !Number.isInteger(revision)
        || revision !== (baseRevision as number) + 1
        || onlineSyncRevisionRef.current !== baseRevision
        || !Array.isArray(patch)) {
        requestRoomSync();
        return;
      }

      try {
        const nextRoom = applyRoomPatch(onlineRoomRef.current, patch);
        if (!acceptRoomState(nextRoom)) return;
        onlineRoomRef.current = nextRoom;
        onlineSyncRevisionRef.current = revision as number;
        syncRequestPendingRef.current = false;
        dispatch({ type: 'SET_ONLINE_STATE', roomState: nextRoom, socketId: socketInstance.id || "" });
      } catch {
        requestRoomSync();
      }
    });

    // Trocas alteram somente a sessão de negociação. Receba esse recorte
    // imediatamente, sem esperar o clone/diff do estado completo da sala.
    socketInstance.on("trade_state_updated", ({ trades, readyPlayers }: { trades?: unknown; readyPlayers?: unknown }) => {
      if (!isCurrentSocket() || !Array.isArray(trades)) return;
      dispatch({
        type: 'SET_ONLINE_TRADE_STATE',
        trades: trades as TradeSession[],
        readyPlayers: Array.isArray(readyPlayers) ? readyPlayers.filter((id): id is string => typeof id === 'string') : [],
      });
    });

    socketInstance.on("ready_state_updated", ({ readyPlayers }: { readyPlayers?: string[] }) => {
      if (!isCurrentSocket()) return;
      dispatch({ type: 'SET_ONLINE_READY_PLAYERS', readyPlayers: readyPlayers || [] });
    });

    // Server refused an advance because not everyone has watched their match yet.
    socketInstance.on("advance_blocked", ({ waiting }: { waiting: string[] }) => {
      if (!isCurrentSocket()) return;
      dispatch({ type: 'SET_ADVANCE_BLOCKED', waiting: waiting || [] });
    });

    socketInstance.on("room_left", ({ message }: { message?: string }) => {
      if (!isCurrentSocket()) return;
      toast.success(message || 'Você saiu da sala.');
      endOnlineSession();
    });

    socketInstance.on("room_closed", ({ message }: { message?: string }) => {
      if (!isCurrentSocket()) return;
      toast.info(message || 'A sala foi encerrada pelo anfitrião.');
      endOnlineSession();
    });

    socketInstance.on("room_kicked", ({ message }: { message?: string }) => {
      if (!isCurrentSocket()) return;
      toast.error(message || 'Você foi removido da sala pelo anfitrião.');
      endOnlineSession();
    });

    socketInstance.on("room_created", ({ roomCode, roomState }) => {
      if (!acceptRoomState(roomState)) return;
      onlineRoomRef.current = roomState;
      onlineSyncRevisionRef.current = 0;
      syncRequestPendingRef.current = false;
      const me = roomState.players[0];
      if (me) {
        setStorageItem(STORAGE_KEYS.playerName, me.name);
        setStorageItem(STORAGE_KEYS.roomCode, roomCode);
      }
      dispatch({ type: 'INIT_ONLINE', socketId: socketInstance.id || "", roomCode, isHost: true });
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("joined_room", ({ roomCode, player, roomState }) => {
      if (!acceptRoomState(roomState)) return;
      onlineRoomRef.current = roomState;
      onlineSyncRevisionRef.current = 0;
      syncRequestPendingRef.current = false;
      setStorageItem(STORAGE_KEYS.playerName, player.name);
      setStorageItem(STORAGE_KEYS.roomCode, roomCode);
      dispatch({ type: 'INIT_ONLINE', socketId: socketInstance.id || "", roomCode, isHost: player.id === roomState.hostId });
      dispatch({ type: 'SET_ONLINE_STATE', roomState, socketId: socketInstance.id || "" });
    });

    socketInstance.on("error_message", (msg: string) => {
      if (!isCurrentSocket()) return;
      onlineRoomRef.current = null;
      onlineSyncRevisionRef.current = null;
      authoritativeRoomRevisionRef.current = null;
      syncRequestPendingRef.current = false;
      toast.error(msg);
      removeStorageItem(STORAGE_KEYS.playerName);
      removeStorageItem(STORAGE_KEYS.roomCode);
      dispatch({ type: 'DISCONNECT_ONLINE' });
    });

    return socketInstance;
  }, []);

  const createRoom = useCallback((creatorName: string, competitionFormat: CompetitionFormat, difficulty?: string) => {
    if (!usesDurableRealtime()) {
      const s = connectSocket();
      s.emit("create_room", { creatorName, competitionFormat, difficulty, clientId: getClientId() });
      return;
    }

    void (async () => {
      try {
        const response = await fetch('/api/realtime/room-code', { method: 'POST' });
        const body = await response.json().catch(() => null) as { roomCode?: unknown; reservationToken?: unknown; message?: unknown } | null;
        if (!response.ok || typeof body?.roomCode !== 'string') {
          throw new Error(typeof body?.message === 'string' ? body.message : 'Não foi possível criar a sala online.');
        }
        if (typeof body.reservationToken !== 'string' || body.reservationToken.length === 0) {
          throw new Error('A reserva da sala não foi confirmada. Tente criar novamente.');
        }
        const roomCode = body.roomCode.toUpperCase();
        const socket = connectSocket(roomCode);
        socket.emit('create_room', { creatorName, competitionFormat, difficulty, clientId: getClientId(), roomCode, reservationToken: body.reservationToken });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível criar a sala online.');
      }
    })();
  }, [connectSocket]);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const s = connectSocket(normalizedRoomCode);
    s.emit("join_room", { roomCode: normalizedRoomCode, playerName, clientId: getClientId() });
  }, [connectSocket]);

  const startSetupOnline = useCallback(() => {
    emitOnlineAction("start_setup", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const submitSetupOnline = useCallback((coachId: string, formationId: string, crestId?: string | null) => {
    emitOnlineAction("submit_setup", { roomCode: state.roomCode, coachId, formationId, crestId });
  }, [emitOnlineAction, state.roomCode]);

  const draftPickOnline = useCallback((playerId: string) => {
    emitOnlineAction("draft_pick", { roomCode: state.roomCode, playerId });
  }, [emitOnlineAction, state.roomCode]);

  const draftVetoOnline = useCallback(() => {
    emitOnlineAction("draft_veto", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const submitSquadReviewOnline = useCallback((captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, draftedPlayers: (Player | undefined)[], playStyle: string, formationId: string, matchPlan: MatchPlan) => {
    emitOnlineAction("submit_squad_review", {
      roomCode: state.roomCode,
      captain,
      penaltyTaker,
      freeKickTaker,
      draftedPlayers,
      playStyle,
      formationId,
      matchPlan,
    });
  }, [emitOnlineAction, state.roomCode]);

  const setMatchRolesOnline = useCallback((captain: string | null, penaltyTaker: string | null, freeKickTaker: string | null, playStyle?: string, formationId?: string) => {
    emitOnlineAction("set_match_roles", { roomCode: state.roomCode, captain, penaltyTaker, freeKickTaker, playStyle, formationId });
  }, [emitOnlineAction, state.roomCode]);

  const playRoundOnline = useCallback(() => {
    emitOnlineAction("play_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const advanceRoundOnline = useCallback(() => {
    emitOnlineAction("advance_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const playKnockoutRoundOnline = useCallback(() => {
    emitOnlineAction("play_knockout_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const advanceKnockoutRoundOnline = useCallback(() => {
    emitOnlineAction("advance_knockout_round", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const restartRoomOnline = useCallback(() => {
    emitOnlineAction("restart_room", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const transferHostOnline = useCallback((targetPlayerId: string) => {
    emitOnlineAction("transfer_host", { roomCode: state.roomCode, targetPlayerId });
  }, [emitOnlineAction, state.roomCode]);

  const removePlayerOnline = useCallback((targetPlayerId: string) => {
    emitOnlineAction("remove_player", { roomCode: state.roomCode, targetPlayerId });
  }, [emitOnlineAction, state.roomCode]);

  const leaveRoomOnline = useCallback(() => {
    emitOnlineAction("leave_room", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const closeRoomOnline = useCallback(() => {
    emitOnlineAction("close_room", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const notifyMatchWatchedOnline = useCallback((type: 'league' | 'knockout', knockout?: { matchId: string; leg?: number }) => {
    emitOnlineAction("player_match_watched", {
      roomCode: state.roomCode,
      type,
      ...(type === 'league' ? { round: state.leagueRound } : {}),
      ...knockout,
    });
  }, [emitOnlineAction, state.roomCode, state.leagueRound]);

  // ── Shop (online): emit to the server, which validates + broadcasts the new team/points ──
  const shopChangeCoachOnline = useCallback((coachId: string) => {
    emitOnlineAction("shop_change_coach", { roomCode: state.roomCode, coachId });
  }, [emitOnlineAction, state.roomCode]);
  const upgradeClubProjectOnline = useCallback((projectId: ClubProjectId) => {
    dispatch({ type: 'UPGRADE_CLUB_PROJECT', projectId });
    emitOnlineAction("upgrade_club_project", { roomCode: state.roomCode, projectId });
  }, [dispatch, emitOnlineAction, state.roomCode]);
  const evolveCoachPrimeOnline = useCallback(() => {
    emitOnlineAction("evolve_coach_prime", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const shopOpenUniquePackOnline = useCallback(() => {
    emitOnlineAction("shop_open_unique_pack", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const setMatchPlanOnline = useCallback((matchPlan: MatchPlan) => {
    emitOnlineAction("set_match_plan", { roomCode: state.roomCode, matchPlan });
  }, [emitOnlineAction, state.roomCode]);
  const shopClaimUniquePackOnline = useCallback(() => {
    emitOnlineAction("shop_claim_unique_pack", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const ensurePlayerPackOffersOnline = useCallback(() => {
    emitOnlineAction("shop_ensure_player_pack_offers", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const shopOpenPlayerPackOnline = useCallback((rarity: RegularPlayerPackRarity) => {
    emitOnlineAction("shop_open_player_pack", { roomCode: state.roomCode, rarity });
  }, [emitOnlineAction, state.roomCode]);
  const shopClaimPlayerPackOnline = useCallback(() => {
    emitOnlineAction("shop_claim_player_pack", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const shopOpenPackOnline = useCallback((position: string) => {
    emitOnlineAction("shop_open_pack", { roomCode: state.roomCode, position });
  }, [emitOnlineAction, state.roomCode]);
  const shopPickPackOnline = useCallback((player: Player) => {
    emitOnlineAction("shop_pick_pack", { roomCode: state.roomCode, playerId: player.id });
  }, [emitOnlineAction, state.roomCode]);
  const shopTurbinarOnline = useCallback((playerId: string, variant: ShopVariant) => {
    emitOnlineAction("shop_turbinar", { roomCode: state.roomCode, playerId, variant });
  }, [emitOnlineAction, state.roomCode]);
  const shopTrainOnline = useCallback((playerId: string, attr: TrainAttr) => {
    emitOnlineAction("shop_train", { roomCode: state.roomCode, playerId, attr });
  }, [emitOnlineAction, state.roomCode]);
  const shopRemoveVariantOnline = useCallback((playerId: string, variantKey?: VariantFlag) => {
    emitOnlineAction("shop_remove_variant", { roomCode: state.roomCode, playerId, variantKey });
  }, [emitOnlineAction, state.roomCode]);
  const shopPlaceBetOnline = useCallback((matchKey: string, homeGoals: number, awayGoals: number, stake: number, homeTeamId?: string, awayTeamId?: string, market?: BetMarket, selections?: BetBuilderSelection[]) => {
    emitOnlineAction("place_bet", { roomCode: state.roomCode, matchKey, homeGoals, awayGoals, stake, homeTeamId, awayTeamId, market, selections });
  }, [emitOnlineAction, state.roomCode]);
  const shopCancelBetOnline = useCallback((matchKey: string) => {
    emitOnlineAction("cancel_bet", { roomCode: state.roomCode, matchKey });
  }, [emitOnlineAction, state.roomCode]);
  const healInjuryOnline = useCallback((playerId: string) => {
    emitOnlineAction("heal_injury", { roomCode: state.roomCode, playerId });
  }, [emitOnlineAction, state.roomCode]);
  const emergencyReplaceOnline = useCallback((starterId: string, playerId: string) => {
    emitOnlineAction("emergency_replace_player", { roomCode: state.roomCode, starterId, playerId });
  }, [emitOnlineAction, state.roomCode]);
  const marketSellOnline = useCallback((playerId: string) => {
    emitOnlineAction("market_sell", { roomCode: state.roomCode, playerId });
  }, [emitOnlineAction, state.roomCode]);
  const marketListOnline = useCallback((playerId: string, price: number) => {
    emitOnlineAction("market_list", { roomCode: state.roomCode, playerId, price });
  }, [emitOnlineAction, state.roomCode]);
  const marketCancelOnline = useCallback((listingId: string) => {
    emitOnlineAction("market_cancel", { roomCode: state.roomCode, listingId });
  }, [emitOnlineAction, state.roomCode]);
  const marketBuyOnline = useCallback((listingId: string) => {
    emitOnlineAction("market_buy", { roomCode: state.roomCode, listingId });
  }, [emitOnlineAction, state.roomCode]);
  const tradeInviteOnline = useCallback((toPlayerId: string) => {
    emitOnlineAction("trade_invite", { roomCode: state.roomCode, toPlayerId });
  }, [emitOnlineAction, state.roomCode]);
  const tradeLeaveOnline = useCallback((tradeId: string) => {
    emitOnlineAction("trade_leave", { roomCode: state.roomCode, tradeId });
  }, [emitOnlineAction, state.roomCode]);
  const tradeAcceptInviteOnline = useCallback((tradeId: string) => {
    emitOnlineAction("trade_accept_invite", { roomCode: state.roomCode, tradeId });
  }, [emitOnlineAction, state.roomCode]);
  const tradeSelectOnline = useCallback((tradeId: string, playerIds: string[], creditsDelta: number) => {
    emitOnlineAction("trade_select", { roomCode: state.roomCode, tradeId, playerIds, creditsDelta });
  }, [emitOnlineAction, state.roomCode]);
  const tradeReadyOnline = useCallback((tradeId: string) => {
    emitOnlineAction("trade_ready", { roomCode: state.roomCode, tradeId });
  }, [emitOnlineAction, state.roomCode]);
  const playerReadyOnline = useCallback(() => {
    emitOnlineAction("player_ready", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const playerUnreadyOnline = useCallback(() => {
    emitOnlineAction("player_unready", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const swapPlayerTeamOnline = useCallback((indexA: number, indexB: number) => {
    emitOnlineAction("swap_player_team", { roomCode: state.roomCode, indexA, indexB });
  }, [emitOnlineAction, state.roomCode]);
  const martirTargetsOnline = useCallback((playerId: string, targetIds: string[]) => {
    emitOnlineAction("set_martir_targets", { roomCode: state.roomCode, playerId, targetIds });
  }, [emitOnlineAction, state.roomCode]);
  const padrinhoTargetOnline = useCallback((playerId: string, targetId: string) => {
    emitOnlineAction("set_padrinho_target", { roomCode: state.roomCode, playerId, targetId });
  }, [emitOnlineAction, state.roomCode]);
  const setEvolvePointOnline = useCallback((playerId: string, attr: AttrKey, delta: number) => {
    // Render the allocation immediately. The server remains authoritative: its
    // next room update replaces this optimistic value, and a rejected command
    // already triggers a fresh authoritative sync in the socket listener.
    if (!socketRef.current || !state.roomCode) return;
    dispatch({ type: 'SET_EVOLVE_POINT', playerId, attr, delta });
    emitOnlineAction("set_evolve_point", { roomCode: state.roomCode, playerId, attr, delta });
  }, [dispatch, emitOnlineAction, state.roomCode]);
  const setAutoEvolveAttributeOnline = useCallback((playerId: string, attr: AttrKey | null) => {
    if (!socketRef.current || !state.roomCode) return;
    dispatch({ type: 'SET_AUTO_EVOLVE_ATTRIBUTE', playerId, attr });
    emitOnlineAction("set_auto_evolve_attribute", { roomCode: state.roomCode, playerId, attr });
  }, [dispatch, emitOnlineAction, state.roomCode]);
  const unlockSpecializationOnline = useCallback((playerId: string) => {
    if (!socketRef.current || !state.roomCode) return;
    dispatch({ type: 'UNLOCK_PLAYER_SPECIALIZATION', playerId });
    emitOnlineAction("unlock_player_specialization", { roomCode: state.roomCode, playerId });
  }, [dispatch, emitOnlineAction, state.roomCode]);
  const chooseSpecializationOnline = useCallback((playerId: string, specialization: PlayerSpecialization) => {
    if (!socketRef.current || !state.roomCode) return;
    dispatch({ type: 'CHOOSE_PLAYER_SPECIALIZATION', playerId, specialization });
    emitOnlineAction("choose_player_specialization", { roomCode: state.roomCode, playerId, specialization });
  }, [dispatch, emitOnlineAction, state.roomCode]);
  const resetEvolvePointsOnline = useCallback((playerId: string) => {
    if (!socketRef.current || !state.roomCode) return;
    dispatch({ type: 'RESET_EVOLVE_POINTS', playerId });
    emitOnlineAction("reset_evolve_points", { roomCode: state.roomCode, playerId });
  }, [dispatch, emitOnlineAction, state.roomCode]);
  const rerollReinforcementOnline = useCallback(() => {
    emitOnlineAction("reroll_reinforcement", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);
  const pickReinforcementOnline = useCallback((player: Player) => {
    // Keep the current offer visible until the authoritative room update
    // arrives. Optimistically closing/rebuilding it made a level-3 offer
    // briefly disappear and reappear when the first selection was confirmed.
    // The server validates the card and selection limit before changing it.
    if (!socketRef.current || !state.roomCode) return;
    emitOnlineAction("pick_reinforcement", { roomCode: state.roomCode, player });
  }, [emitOnlineAction, state.roomCode]);
  const dismissReinforcementOnline = useCallback(() => {
    if (!socketRef.current || !state.roomCode) return;
    dispatch({ type: 'DISMISS_REINFORCEMENT' });
    emitOnlineAction("dismiss_reinforcement", { roomCode: state.roomCode });
  }, [dispatch, emitOnlineAction, state.roomCode]);

  const acceptMissionOnline = useCallback((missionId: string) => {
    emitOnlineAction("accept_mission", { roomCode: state.roomCode, missionId });
  }, [emitOnlineAction, state.roomCode]);

  const rerollMissionsOnline = useCallback(() => {
    emitOnlineAction("reroll_missions", { roomCode: state.roomCode });
  }, [emitOnlineAction, state.roomCode]);

  const removeMissionOnline = useCallback((missionId: string) => {
    emitOnlineAction("remove_mission", { roomCode: state.roomCode, missionId });
  }, [emitOnlineAction, state.roomCode]);

  const dismissMissionResolutionOnline = useCallback(() => {
    if (!socketRef.current || !state.roomCode) return;
    dispatch({ type: 'DISMISS_MISSION_RESOLUTION' });
    emitOnlineAction("dismiss_mission_resolution", { roomCode: state.roomCode });
  }, [dispatch, emitOnlineAction, state.roomCode]);

  // Fetches the full (untrimmed) result of one bygone-round league fixture —
  // "Ver Detalhes" calls this when the locally-held result is trimmed. Not a
  // mutation, so it bypasses emitOnlineAction's commandId/idempotency
  // machinery and just resolves once "match_result_full" answers (or after
  // 8s, so a dropped response never leaves the modal waiting forever).
  const requestMatchResultOnline = useCallback((round: number, homeTeamId: string, awayTeamId: string): Promise<MatchResult | null> => {
    if (!socketRef.current || !state.roomCode) return Promise.resolve(null);
    const key = buildLeagueMatchKey(round, homeTeamId, awayTeamId);
    const existing = matchResultRequestsRef.current.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
      matchResultRequestsRef.current.delete(key);
      existing.resolve(null);
    }
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        matchResultRequestsRef.current.delete(key);
        resolve(null);
      }, 8000);
      matchResultRequestsRef.current.set(key, { resolve, timeout });
      socketRef.current!.emit("request_match_result", { roomCode: state.roomCode, round, homeTeamId, awayTeamId });
    });
  }, [state.roomCode]);


  const getTeamById = useCallback((id: string) => {
    if (state.mode === 'online') {
      const match = state.onlinePlayers.find(p => p.id === id);
      if (match && match.team) return match.team;
    }
    if (state.playerTeam?.id === id) return state.playerTeam;
    return state.botTeams.find(t => t.id === id);
  }, [state.playerTeam, state.botTeams, state.onlinePlayers, state.mode]);


  // Auto reconnect to room if details exist in localStorage on mount.
  // Guard against double-joining: only reconnect when no socket is active yet.
  // ── Solo campaign autosave ────────────────────────────────────────────────
  const { account, loading: accountLoading } = useAccount();
  const accountId = account?.id ?? null;
  const [savedSoloCampaign, setSavedSoloCampaign] = useState<SavedSoloCampaign | null>(null);
  const discardedSaveRef = useRef(false);

  useEffect(() => {
    if (accountLoading) return;
    let cancelled = false;
    loadSoloSave<GameState>(accountId).then(save => {
      if (cancelled) return;
      setSavedSoloCampaign(save ? savedCampaignSummary(save.state, save.savedAt) : null);
    });
    return () => { cancelled = true; };
  }, [accountId, accountLoading]);

  useEffect(() => {
    if (accountLoading || state.mode !== 'solo' || !SOLO_CAMPAIGN_PHASES.has(state.phase)) return;
    discardedSaveRef.current = false;
    // Debounced: a burst of actions (draft picks, shop clicks) becomes one write.
    const timer = window.setTimeout(() => {
      if (discardedSaveRef.current) return;
      const savedAt = Date.now();
      void writeSoloSave(state, accountId);
      setSavedSoloCampaign(savedCampaignSummary(state, savedAt));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state, accountId, accountLoading]);

  const continueSoloCampaign = useCallback(async () => {
    const save = await loadSoloSave<GameState>(accountId);
    if (!save) { setSavedSoloCampaign(null); return; }
    dispatch({ type: 'RESTORE_SOLO_CAMPAIGN', state: save.state });
  }, [accountId]);

  const discardSoloCampaign = useCallback(async () => {
    discardedSaveRef.current = true;
    setSavedSoloCampaign(null);
    await clearSoloSave(accountId);
  }, [accountId]);

  useEffect(() => {
    if (socketRef.current) return;
    const storedName = getStorageItem(STORAGE_KEYS.playerName);
    const storedCode = getStorageItem(STORAGE_KEYS.roomCode);
    if (storedName && storedCode) {
      console.log(`Auto-reconnecting to room ${storedCode} as ${storedName}...`);
      joinRoom(storedCode, storedName);
    }
  }, [joinRoom]);

  const contextValue = useMemo(() => ({
    state, dispatch, getTeamById,
    createRoom, joinRoom, startSetupOnline, submitSetupOnline,
    draftPickOnline, draftVetoOnline, submitSquadReviewOnline, setMatchRolesOnline, setMatchPlanOnline,
    playRoundOnline, advanceRoundOnline, playKnockoutRoundOnline, advanceKnockoutRoundOnline,
    restartRoomOnline, transferHostOnline, removePlayerOnline, leaveRoomOnline, closeRoomOnline, notifyMatchWatchedOnline,
    shopChangeCoachOnline, upgradeClubProjectOnline, evolveCoachPrimeOnline, shopOpenUniquePackOnline, shopClaimUniquePackOnline, ensurePlayerPackOffersOnline, shopOpenPlayerPackOnline, shopClaimPlayerPackOnline, shopOpenPackOnline, shopPickPackOnline, shopTurbinarOnline, shopRemoveVariantOnline, shopPlaceBetOnline, shopCancelBetOnline, healInjuryOnline, emergencyReplaceOnline, marketSellOnline, marketListOnline, marketCancelOnline, marketBuyOnline, tradeInviteOnline, tradeLeaveOnline, tradeAcceptInviteOnline, tradeSelectOnline, tradeReadyOnline, playerReadyOnline, playerUnreadyOnline, shopTrainOnline,
    swapPlayerTeamOnline, martirTargetsOnline, padrinhoTargetOnline, setEvolvePointOnline, setAutoEvolveAttributeOnline, unlockSpecializationOnline, chooseSpecializationOnline, resetEvolvePointsOnline, rerollReinforcementOnline,
    pickReinforcementOnline, dismissReinforcementOnline, requestMatchResultOnline, acceptMissionOnline, rerollMissionsOnline, removeMissionOnline, dismissMissionResolutionOnline,
    savedSoloCampaign, continueSoloCampaign, discardSoloCampaign,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, dispatch, savedSoloCampaign, continueSoloCampaign, discardSoloCampaign]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}
