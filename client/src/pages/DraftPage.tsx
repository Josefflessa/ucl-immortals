// UCL Immortals — Draft Page
// 13 rounds (11 titulares + 2 reservas), 6 options each, 30s timer, 4 vetoes

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import PlayerCard, { buildSofifaUrl } from '../components/game/PlayerCard';
import FormationField from '../components/game/FormationField';
import { Ban } from 'lucide-react';
import { FORMATIONS, COACHES, Player, POS_PT } from '../lib/gameData';
import { getTraitInfo, traitEffectLabel } from '../lib/traits';
import { DRAFT_TURN_SECONDS } from '@shared/const';
import { AppShell, Button, Panel, PanelHeader, PanelTitle, Progress, TopBar } from '../design-system';

const DRAFT_TIME = DRAFT_TURN_SECONDS;

const posLabel = (pos: string) => POS_PT[pos] ?? pos;

// Escala responsiva dos cards de escolha: o card FULL é 200px fixo, então 2×200 estoura telas
// ~360px e eles ficavam colados. Encolhe no mobile (2 col) e um pouco no tablet (3 col) pra
// caber com respiro; volta ao tamanho cheio no desktop (onde há espaço de sobra).
function useDraftCardScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const mMobile = window.matchMedia('(max-width: 639px)');
    const mSm = window.matchMedia('(min-width: 640px) and (max-width: 1023px)');
    const update = () => setScale(mMobile.matches ? 0.74 : mSm.matches ? 0.84 : 1);
    update();
    mMobile.addEventListener('change', update);
    mSm.addEventListener('change', update);
    return () => { mMobile.removeEventListener('change', update); mSm.removeEventListener('change', update); };
  }, []);
  return scale;
}

const DraftTimer = memo(function DraftTimer({
  round,
  timerKey,
  onExpire,
}: {
  round: number;
  timerKey: number;
  onExpire: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(DRAFT_TIME);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // One self-contained countdown per turn. Restarts when the turn or the reroll
  // key changes; a reroll keeps the same round but grants a fresh decision window.
  // Using a single interval + a local guard avoids the old two-effect race, where a
  // pick changed `round` while timeLeft was still 0 and re-fired the auto-pick (or
  // left the timer stuck at 0). onExpire fires exactly once, then the interval stops.
  useEffect(() => {
    setTimeLeft(DRAFT_TIME);
    let remaining = DRAFT_TIME;
    let fired = false;
    const id = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (remaining <= 0 && !fired) {
        fired = true;
        clearInterval(id);
        onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [round, timerKey]);

  const timerColor = timeLeft <= 5 ? 'var(--ui-danger)' : timeLeft <= 10 ? 'var(--ui-warning)' : 'var(--ui-brand)';
  const timerPct = (timeLeft / DRAFT_TIME) * 100;

  return (
    <div className="flex flex-col items-center">
      <div
        className="text-4xl font-black leading-none"
        style={{ fontFamily: 'Bebas Neue, sans-serif', color: timerColor }}
      >
        {timeLeft}
      </div>
      <div className="w-16 h-1.5 rounded-full mt-1" style={{ background: '#1A1A2A' }}>
        <div
          className="h-full rounded-full transition-[width] duration-1000 linear"
          style={{ background: timerColor, width: `${timerPct}%` }}
        />
      </div>
      {timeLeft <= 5 && (
        <div className="text-xs mt-1 font-bold" style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>
          Auto-pick!
        </div>
      )}
    </div>
  );
});

const DraftOptions = memo(function DraftOptions({
  round,
  options,
  selectedId,
  onSelect,
  onConfirm,
}: {
  round: number;
  options: Player[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
}) {
  const cardScale = useDraftCardScale();
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 justify-items-center mb-6">
        {options.map(player => (
          <PlayerCard
            key={`${round}-${player.id}`}
            player={player}
            lite
            scale={cardScale}
            selected={selectedId === player.id}
            onClick={() => {
              if (selectedId === player.id) {
                onConfirm(player.id);
              } else {
                onSelect(player.id);
              }
            }}
          />
        ))}
      </div>
      {selectedId && (() => {
        const sel = options.find(p => p.id === selectedId);
        if (!sel) return null;
        return (
          <div className="mx-auto mb-3 max-w-md rounded-xl px-3 py-2.5" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
            <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: '#9AA8C8', fontFamily: 'Rajdhani, sans-serif' }}>
              {sel.shortName.toUpperCase()}
            </div>
            {/* Vision & composure — hidden attributes (vision drives possession/playmaking and
                the Guardiola trigger ≥80; composure drives penalties/clutch), shown here so the
                pick can be weighed without bloating the card. */}
            <div className="flex items-center gap-4 mb-2 text-[11px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              <span className="inline-flex items-center gap-1.5 text-gray-400" title="Visão: peso de armação — influencia quem controla a posse e dispara habilidades como a do Guardiola (Visão ≥ 80).">
                👁️ Visão <b className="text-white">{sel.vision}</b>
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-400" title="Compostura: frieza nos momentos decisivos — pênaltis e a escolha do batedor/finalizador.">
                🧊 Compostura <b className="text-white">{sel.composure}</b>
              </span>
            </div>
            {sel.traits.length > 0 && (
            <>
            <div className="text-[9px] font-black tracking-widest mb-1 text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>🎯 ESTILOS DE JOGO</div>
            <div className="flex flex-col gap-1">
              {sel.traits.map(t => {
                const info = getTraitInfo(t);
                const isRolled = t === sel.rolledTrait;
                return (
                  <div key={t} className="flex items-baseline gap-1.5 text-[11px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    <span className="flex-shrink-0">{info?.icon ?? '⭐'}</span>
                    <span className="font-black flex-shrink-0" style={{ color: isRolled ? '#E8C84A' : '#FFF' }}>{isRolled ? `${t} (extra)` : t}</span>
                    <span style={{ color: '#C9A84C' }}>{traitEffectLabel(t) || 'sem efeito direto'}</span>
                  </div>
                );
              })}
            </div>
            </>
            )}
          </div>
        );
      })()}
      {selectedId && (
        <div className="flex justify-center">
          <Button
            type="button"
            intent="primary"
            onClick={() => onConfirm(selectedId)}
            size="large"
            className="px-6 sm:px-8"
          >
            CONFIRMAR ESCOLHA ✓
          </Button>
        </div>
      )}
    </>
  );
});

const DraftedRoster = memo(function DraftedRoster({
  players,
  total,
}: {
  players: (Player | undefined)[];
  total: number;
}) {
  const filled = players.filter((p): p is Player => p !== null && p !== undefined);
  return (
    <div className="mt-6">
      <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
        MEU ELENCO ({filled.length}/{total}) <span style={{ color: '#4A4A5A' }}>· 11 titulares + 2 reservas</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {filled.map(p => (
          <PlayerCard key={p.id} player={p} compact lite />
        ))}
        {Array.from({ length: Math.max(0, total - filled.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="rounded-lg flex items-center justify-center"
            style={{ width: 80, height: 100, background: '#0F0F1A', border: '1px dashed #1A1A2A' }}
          >
            <span style={{ color: '#333', fontSize: '20px' }}>?</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default function DraftPage() {
  const { 
    state, 
    dispatch, 
    draftPickOnline, 
    draftVetoOnline 
  } = useGame();

  const { draftState, draftedPlayers, selectedFormationId, selectedCoachId } = state;
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const formation = FORMATIONS.find(f => f.id === selectedFormationId);
  const coach = COACHES.find(c => c.id === selectedCoachId);

  // Online Multiplayer state details
  const isOnline = state.mode === 'online';
  const activePlayerId = isOnline ? state.draftOrder[state.draftTurnIndex] : null;
  const activePlayer = isOnline ? state.onlinePlayers.find(p => p.id === activePlayerId) : null;
  const isMyTurn = isOnline ? (activePlayer?.socketId === state.socketId) : true;

  const handlePick = useCallback((playerId: string) => {
    if (!draftState) return;
    setSelectedCard(null);

    if (isOnline) {
      draftPickOnline(playerId);
    } else {
      const player = draftState.currentOptions.find(p => p.id === playerId);
      if (!player) return;
      dispatch({ type: 'DRAFT_PLAYER', player });
    }
  }, [draftState, dispatch, isOnline, draftPickOnline]);

  const handleAutoPick = useCallback(() => {
    if (!draftState) return;
    const first = draftState.currentOptions[0];
    if (first) handlePick(first.id);
  }, [draftState, handlePick]);

  useEffect(() => {
    setSelectedCard(null);
  }, [draftState?.round, state.draftTurnIndex]);

  const handleVeto = () => {
    if (!draftState || draftState.vetoesLeft <= 0) return;
    setSelectedCard(null);

    if (isOnline) {
      draftVetoOnline();
    } else {
      dispatch({ type: 'VETO_DRAFT' });
    }
  };

  if (!draftState) return null;

  const { round, totalRounds, currentOptions, neededPositions, vetoesLeft } = draftState;
  const progressPct = ((round - 1) / totalRounds) * 100;

  const renderQueue = () => {
    if (!isOnline) return null;
    return (
      <div className="ui-panel ui-panel--inset mb-4 p-3">
        <div className="text-[10px] font-black text-[#C9A84C] tracking-widest uppercase mb-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          FILA DE ESCOLHAS (SNAKE DRAFT)
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {state.draftOrder.slice(state.draftTurnIndex, state.draftTurnIndex + 6).map((pid, idx) => {
            const player = state.onlinePlayers.find(p => p.id === pid);
            const isCurrent = idx === 0;
            const turnRound = Math.floor((state.draftTurnIndex + idx) / state.onlinePlayers.length) + 1;
            
            return (
              <div 
                key={`${pid}-${idx}`}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all"
                style={{
                  background: isCurrent ? '#C9A84C' : '#08080f',
                  borderColor: isCurrent ? '#C9A84C' : '#1A1A2A',
                  color: isCurrent ? '#000' : '#FFF',
                  boxShadow: isCurrent ? '0 0 10px rgba(201,168,76,0.3)' : 'none'
                }}
              >
                <span className="text-[9px] opacity-75 font-normal uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  R{turnRound}
                </span>
                <span style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {player?.name}
                </span>
                {isCurrent && <span className="text-[9px] animate-pulse">●</span>}
              </div>
            );
          })}
          {state.draftOrder.length > state.draftTurnIndex + 6 && (
            <div className="text-xs text-gray-500 font-bold px-2 py-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              +{state.draftOrder.length - (state.draftTurnIndex + 6)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPickHistory = () => {
    if (!isOnline || state.draftHistory.length === 0) return null;
    return (
      <div className="ui-panel ui-panel--inset flex h-[280px] flex-col p-4">
        <div className="text-xs font-black text-[#C9A84C] tracking-widest uppercase mb-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          ESCOLHAS DA RODADA ({state.draftHistory.length})
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {[...state.draftHistory].reverse().map((pick, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 p-2 rounded bg-[#08080f] border border-[#171725] text-xs"
            >
              {/* Player photo (older picks may lack playerId → fallback to a ball glyph) */}
              <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d]" style={{ border: '1px solid #2A2A3A' }}>
                {(() => {
                  const photo = pick.playerId ? buildSofifaUrl(pick.playerId, 120) : null;
                  return photo
                    ? <img src={photo} alt={pick.playerName} className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.2' }} referrerPolicy="no-referrer" />
                    : <span className="text-sm">⚽</span>;
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[#C9A84C] font-bold block truncate" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {pick.teamName}
                </span>
                <span className="text-white font-extrabold block truncate" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {pick.playerName}
                </span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.2 rounded font-black block" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {posLabel(pick.position)}
                </span>
                <span className="text-[10px] text-gray-500 font-bold block" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  GER {pick.overall}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWaitingScreen = () => {
    return (
      <div className="ui-panel flex h-[340px] flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-yellow-500/10 border border-yellow-500/20">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-yellow-500 animate-spin" />
        </div>
        <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          VEZ DE OUTRO JOGADOR
        </h3>
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
          Aguarde enquanto <span className="text-yellow-500 font-bold">{activePlayer?.name}</span> seleciona um jogador para o elenco dele.
        </p>
      </div>
    );
  };

  return (
    <AppShell className="flex flex-col">
      {/* Top Header */}
      <TopBar
        title={`DRAFT${isOnline ? ' ONLINE' : ''}`}
        playerName={state.playerName}
        right={(
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs text-[var(--ui-text-faint)]">Rodada</span>
              <span className="font-display text-lg text-[var(--ui-text)]">{round}</span>
              <span className="text-xs text-[var(--ui-text-faint)]">/ {totalRounds}</span>
            </div>
            <Button
              type="button"
              intent="danger"
              onClick={handleVeto}
              disabled={vetoesLeft <= 0 || !isMyTurn}
              className="min-h-9 px-3 text-xs"
            >
              <Ban size={14} /> VETAR ({vetoesLeft})
            </Button>
          </div>
        )}
      />
      {/* Progress bar */}
      <Progress value={progressPct} max={100} tone="brand" className="h-1 rounded-none" aria-label={`Progresso do draft: rodada ${round} de ${totalRounds}`} />

      <div className="ui-shell flex-1 flex flex-col gap-4 py-4 lg:grid lg:grid-cols-4">
        {/* Left Column: Draft state, Queue, cards grid */}
        <div className="lg:col-span-3 flex flex-col min-w-0">
          
          {renderQueue()}

          <div className="flex-1 flex flex-col justify-center">
            {isMyTurn ? (
              <>
                <div className="mb-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1">
                    {/* Ainda escolhendo TITULARES enquanto tiver menos de 11 picks (o banco só começa
                        depois dos 11). Gate por contagem de picks — não por neededPositions, que pode
                        vir vazio por outros motivos no online. */}
                    {draftedPlayers.filter(Boolean).length < 11 ? (
                      <>
                        <div className="text-xs font-bold tracking-widest mb-1" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                          POSIÇÕES RESTANTES
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {neededPositions.map((pos, idx) => (
                            <span
                              key={`${pos}-${idx}`}
                              className="font-black px-2 py-0.5 rounded"
                              style={{
                                fontFamily: 'Bebas Neue, sans-serif',
                                fontSize: idx === 0 ? '0.9rem' : '0.75rem',
                                background: '#C9A84C22',
                                color: idx === 0 ? '#E8C84A' : '#C9A84C',
                                border: `1px solid ${idx === 0 ? '#C9A84C88' : '#C9A84C44'}`,
                              }}
                            >
                              {posLabel(pos)}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-black tracking-widest mb-1" style={{ color: '#22D3EE', fontFamily: 'Rajdhani, sans-serif' }}>
                          🪑 RESERVA — BANCO
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: '#8A9BA0', fontFamily: 'Rajdhani, sans-serif' }}>
                          Escolha qualquer jogador para o banco.
                        </div>
                      </>
                    )}
                  </div>
                  <DraftTimer round={round} timerKey={draftState.timerKey} onExpire={handleAutoPick} />
                </div>

                <DraftOptions
                  round={round}
                  options={currentOptions}
                  selectedId={selectedCard}
                  onSelect={setSelectedCard}
                  onConfirm={handlePick}
                />
              </>
            ) : (
              renderWaitingScreen()
            )}
          </div>

          <DraftedRoster players={draftedPlayers} total={totalRounds} />
        </div>

        {/* Right Column: Tática preview + Pick history */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          
          {renderPickHistory()}

          <Panel tone="inset" className="flex flex-col gap-3 p-3">
            <PanelHeader className="-mx-3 -mt-3 mb-0 rounded-t-[var(--ui-radius-lg)]">
              <PanelTitle>Minha formação</PanelTitle>
            </PanelHeader>
            {formation && (
              <FormationField
                formation={formation}
                players={draftedPlayers}
                compact
              />
            )}
            {coach && (
              <div className="rounded-xl p-3 bg-[#08080f] border border-[#1A1A2A]">
                <div className="text-xs font-bold mb-1 text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>TREINADOR</div>
                <div className="text-sm font-black text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{coach.name}</div>
                <div className="text-xs mt-1 text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{coach.philosophy}</div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
