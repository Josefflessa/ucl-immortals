// UCL Immortals — LOJA (shop) tab.
// Spend the points earned each match. Each item opens a small flow (pick a coach / player /
// variant / attribute / pack option) and dispatches the matching SHOP_* action; the reducer
// validates the cost. Solo-league only.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { COACHES, POS_PT, Player } from '../../lib/gameData';
import { generateStarPackOptions, generateScoutOptions } from '../../lib/gameEngine';
import { SHOP_COSTS, trainCost, TRAIN_BOOST, TRAIN_ATTRS, TURBINAR_VARIANTS, ShopVariant, TrainAttr } from '../../lib/shop';
import PlayerCard from './PlayerCard';

type ItemId = 'coach' | 'turbinar' | 'star' | 'scout' | 'train';
const SCOUT_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

function hasVariant(p: Player) {
  return !!(p.inForm || p.lobo || p.coringa || p.nomade || p.pilar);
}

export default function ShopTab() {
  const { state, dispatch, shopChangeCoachOnline, shopBuyPlayerOnline, shopTurbinarOnline, shopTrainOnline } = useGame();
  const team = state.playerTeam;
  const points = state.points;
  const online = state.mode === 'online';
  const [active, setActive] = useState<ItemId | null>(null);
  const [packOptions, setPackOptions] = useState<Player[]>([]);
  const [scoutPos, setScoutPos] = useState<string | null>(null);
  const [selPlayerId, setSelPlayerId] = useState<string | null>(null);

  if (!team) return null;

  // Solo mutates local state via the reducer; online emits to the authoritative server.
  const buyCoach = (coachId: string) => online ? shopChangeCoachOnline(coachId) : dispatch({ type: 'SHOP_CHANGE_COACH', coachId });
  const buyPlayer = (player: Player, kind: 'star' | 'scout') => online ? shopBuyPlayerOnline(player, kind) : dispatch({ type: 'SHOP_BUY_PLAYER', player, kind });
  const buyTurbinar = (playerId: string, variant: ShopVariant) => online ? shopTurbinarOnline(playerId, variant) : dispatch({ type: 'SHOP_TURBINAR', playerId, variant });
  const buyTrain = (playerId: string, attr: TrainAttr) => online ? shopTrainOnline(playerId, attr) : dispatch({ type: 'SHOP_TRAIN', playerId, attr });
  const ownedIds = team.players.map(p => p.id);
  const selPlayer = team.players.find(p => p.id === selPlayerId) ?? null;

  const close = () => { setActive(null); setPackOptions([]); setScoutPos(null); setSelPlayerId(null); };

  const ITEMS: { id: ItemId; icon: string; name: string; cost: number | 'dyn'; color: string; desc: string }[] = [
    { id: 'coach', icon: '🎓', name: 'TROCAR TÉCNICO', cost: SHOP_COSTS.changeCoach, color: '#A78BFA', desc: 'Troca o comandante do time (muda buffs e estilo).' },
    { id: 'turbinar', icon: '✨', name: 'TURBINAR CARTA', cost: SHOP_COSTS.turbinar, color: '#E8C84A', desc: 'Aplica uma carta especial (Em Alta, Lobo, Coringa…) a um jogador.' },
    { id: 'star', icon: '🌟', name: 'PACOTE DO CRAQUE', cost: SHOP_COSTS.starPack, color: '#F59E0B', desc: 'Escolha 1 de 3 jogadores de overall 88+. Entra no banco.' },
    { id: 'scout', icon: '🔍', name: 'CAÇA-TALENTOS', cost: SHOP_COSTS.scout, color: '#38BDF8', desc: 'Escolha 1 de 4 jogadores da posição que você precisa.' },
    { id: 'train', icon: '💪', name: 'TREINO INTENSIVO', cost: 'dyn', color: '#34D399', desc: `+${TRAIN_BOOST} permanente num atributo (sem teto). Custo sobe a cada treino no mesmo jogador.` },
  ];

  const openItem = (id: ItemId) => {
    if (id === 'star') {
      if (points < SHOP_COSTS.starPack) return;
      setPackOptions(generateStarPackOptions(ownedIds));
    }
    setSelPlayerId(null);
    setScoutPos(null);
    setActive(id);
  };

  const pickScoutPosition = (pos: string) => {
    setScoutPos(pos);
    setPackOptions(generateScoutOptions(pos, ownedIds));
  };

  return (
    <div className="space-y-4">
      {/* Balance */}
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#171206,#0B0B14)', border: '1px solid #C9A84C55' }}>
        <div>
          <div className="text-[10px] font-black tracking-widest" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>SEUS PONTOS</div>
          <div className="text-[11px] mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>Ganhe mais vencendo partidas com bom saldo de gols.</div>
        </div>
        <div className="text-4xl font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>💰 {points}</div>
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ITEMS.map(item => {
          const cost = item.cost === 'dyn' ? trainCost(0) : item.cost;
          const affordable = points >= cost;
          return (
            <button
              key={item.id}
              onClick={() => affordable && openItem(item.id)}
              disabled={!affordable}
              className="text-left rounded-xl p-4 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0F0F1A', border: `1px solid ${affordable ? item.color + '55' : '#1A1A2A'}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-black px-2 py-0.5 rounded" style={{ fontFamily: 'Bebas Neue, sans-serif', background: `${item.color}22`, color: item.color }}>
                  💰 {item.cost === 'dyn' ? `${cost}+` : cost}
                </span>
              </div>
              <div className="text-base font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{item.name}</div>
              <div className="text-[11px] mt-0.5 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{item.desc}</div>
              {!affordable && <div className="text-[10px] mt-1 font-bold" style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>Pontos insuficientes</div>}
            </button>
          );
        })}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {active && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            style={{ background: 'rgba(6,6,14,0.95)', backdropFilter: 'blur(3px)' }} onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
              style={{ background: '#0B0B14', border: '1px solid #C9A84C55', boxShadow: '0 0 50px rgba(201,168,76,0.18)' }}>

              {/* Modal header */}
              <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #1d1d2f', background: 'linear-gradient(135deg,#171206,#0B0B14)' }}>
                <h3 className="text-xl font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#E8C84A' }}>
                  {ITEMS.find(i => i.id === active)?.icon} {ITEMS.find(i => i.id === active)?.name}
                </h3>
                <button onClick={close} className="text-gray-400 hover:text-white text-2xl font-black">✕</button>
              </div>

              <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 min-h-0">
                {/* TROCAR TÉCNICO */}
                {active === 'coach' && (
                  <div className="space-y-2">
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o novo técnico (−{SHOP_COSTS.changeCoach} pontos):</p>
                    {COACHES.filter(c => c.id !== team.coachId).map(c => (
                      <button key={c.id} onClick={() => { buyCoach(c.id); close(); }}
                        className="w-full text-left rounded-lg p-3 flex items-center gap-3 transition-all hover:border-[#C9A84C]/60 active:scale-[0.99]"
                        style={{ background: '#07070f', border: '1px solid #1A1A2A' }}>
                        {c.photoUrl && <img src={c.photoUrl} alt={c.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" style={{ objectPosition: 'center top', border: '1px solid #C9A84C44' }} />}
                        <div className="min-w-0">
                          <div className="text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{c.name}</div>
                          <div className="text-[11px] font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>{c.philosophy}</div>
                          <div className="text-[10px] mt-0.5 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{c.effect}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* PACOTE DO CRAQUE / CAÇA-TALENTOS pack options */}
                {(active === 'star' || (active === 'scout' && scoutPos)) && (
                  <div>
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                      {active === 'star'
                        ? <>Escolha <b style={{ color: '#FFF' }}>1 craque</b> (−{SHOP_COSTS.starPack} pontos) — entra no seu banco.</>
                        : <>Posição <b style={{ color: '#FFF' }}>{POS_PT[scoutPos!] ?? scoutPos}</b> · escolha 1 (−{SHOP_COSTS.scout} pontos).</>}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2.5 sm:gap-4">
                      {packOptions.map(option => (
                        <button key={option.id}
                          onClick={() => { buyPlayer(option, active === 'star' ? 'star' : 'scout'); close(); }}
                          className="transition-transform hover:scale-[1.06] active:scale-[0.97]">
                          <PlayerCard player={option} compact lite />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CAÇA-TALENTOS position picker */}
                {active === 'scout' && !scoutPos && (
                  <div>
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Qual posição você precisa reforçar?</p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {SCOUT_POSITIONS.map(pos => (
                        <button key={pos} onClick={() => pickScoutPosition(pos)}
                          className="py-3 rounded-lg font-black text-sm transition-all hover:border-[#38BDF8]/60 active:scale-95"
                          style={{ fontFamily: 'Bebas Neue, sans-serif', background: '#07070f', border: '1px solid #1A1A2A', color: '#FFF' }}>
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TURBINAR CARTA — pick player then variant */}
                {active === 'turbinar' && (
                  !selPlayer ? (
                    <div>
                      <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o jogador que vai receber a carta especial:</p>
                      <div className="flex flex-wrap gap-2">
                        {team.players.map(p => (
                          <button key={p.id} onClick={() => !hasVariant(p) && setSelPlayerId(p.id)} disabled={hasVariant(p)}
                            className="disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-[1.05]" title={hasVariant(p) ? 'Já tem uma carta especial' : ''}>
                            <PlayerCard player={p} compact />
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] mt-2" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Jogadores que já têm uma carta especial ficam desabilitados (uma por carta).</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                        Carta especial para <b style={{ color: '#C9A84C' }}>{selPlayer.shortName}</b> (−{SHOP_COSTS.turbinar} pontos):
                      </p>
                      <div className="space-y-2">
                        {TURBINAR_VARIANTS.map(v => {
                          const color = v.color === '#FFFFFF' ? '#E5E7EB' : v.color;
                          return (
                            <button key={v.key} onClick={() => { buyTurbinar(selPlayer.id, v.key as ShopVariant); close(); }}
                              className="w-full text-left rounded-lg p-3 flex items-center gap-3 transition-all active:scale-[0.99]"
                              style={{ background: '#07070f', border: `1px solid ${color}44` }}>
                              <span className="text-2xl">{v.icon}</span>
                              <div>
                                <div className="text-base font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color }}>{v.label}</div>
                                <div className="text-[11px] leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{v.desc}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={() => setSelPlayerId(null)} className="mt-3 text-xs font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>← trocar jogador</button>
                    </div>
                  )
                )}

                {/* TREINO INTENSIVO — pick player then attribute */}
                {active === 'train' && (
                  !selPlayer ? (
                    <div>
                      <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o jogador para treinar:</p>
                      <div className="flex flex-wrap gap-2">
                        {team.players.map(p => {
                          const c = trainCost(p.trainCount ?? 0);
                          return (
                            <button key={p.id} onClick={() => setSelPlayerId(p.id)} className="relative transition-transform hover:scale-[1.05]">
                              <PlayerCard player={p} compact />
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black px-1 rounded" style={{ background: '#34D39922', color: '#34D399', fontFamily: 'Rajdhani, sans-serif' }}>💰{c}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (() => {
                    const cost = trainCost(selPlayer.trainCount ?? 0);
                    const affordable = points >= cost;
                    return (
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                          Treinar <b style={{ color: '#C9A84C' }}>{selPlayer.shortName}</b> · custo <b style={{ color: affordable ? '#34D399' : '#EF4444' }}>💰 {cost}</b> · +{TRAIN_BOOST} no atributo escolhido.
                        </p>
                        <p className="text-[10px] mb-3" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                          Já treinado {selPlayer.trainCount ?? 0}× — o próximo treino dele custará mais.
                        </p>
                        {!affordable && <p className="text-[11px] mb-2 font-bold" style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>Pontos insuficientes para este jogador.</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {TRAIN_ATTRS.map(a => (
                            <button key={a.key} disabled={!affordable}
                              onClick={() => { buyTrain(selPlayer.id, a.key as TrainAttr); close(); }}
                              className="py-3 rounded-lg font-black text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ fontFamily: 'Rajdhani, sans-serif', background: '#07070f', border: '1px solid #34D39944', color: '#34D399' }}>
                              {a.label}<div className="text-[9px] text-gray-500">+{TRAIN_BOOST}</div>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setSelPlayerId(null)} className="mt-3 text-xs font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>← trocar jogador</button>
                      </div>
                    );
                  })()
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
