// UCL Immortals — LOJA (shop) tab.
// Spend the points earned each match. Each item opens a small flow (pick a coach / player /
// variant / attribute / pack option) and dispatches the matching SHOP_* action; the reducer
// validates the cost. Solo-league only.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../contexts/GameContext';
import { COACHES, POS_PT, Player, UNIQUE_CARDS } from '../../lib/gameData';
import { generateStarPackOptions, generateScoutOptions, hasVariant, canAddVariant, variantCount } from '../../lib/gameEngine';
import type { VariantFlag } from '../../lib/gameEngine';
import { SHOP_COSTS, trainCost, TRAIN_BOOST, TRAIN_ATTRS, TURBINAR_VARIANTS, ShopVariant, TrainAttr } from '../../lib/shop';
import PlayerCard, { getCardVariants } from './PlayerCard';
import { Button, Panel, PanelBody } from '../../design-system';

type ItemId = 'coach' | 'turbinar' | 'removeVariant' | 'star' | 'scout' | 'train' | 'reroll' | 'unique';
const SCOUT_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

export default function ShopTab() {
  const { state, dispatch, shopChangeCoachOnline, shopBuyPlayerOnline, shopOpenPackOnline, shopPickPackOnline, shopTurbinarOnline, shopRemoveVariantOnline, shopTrainOnline, shopBuyRerollOnline } = useGame();
  const team = state.playerTeam;
  const points = state.points;
  const online = state.mode === 'online';
  const pendingPack = state.pendingPack; // 🛒 pacote JÁ PAGO (Craque/Caça-Talentos) aguardando escolha
  const [active, setActive] = useState<ItemId | null>(null);
  const [selPlayerId, setSelPlayerId] = useState<string | null>(null);
  const [uniqueWarn, setUniqueWarn] = useState<string | null>(null); // aviso "pontos insuficientes" na loja de únicas
  // 🛒 Confirmação de compra (premium) — reutilizada por todas as compras significativas da loja.
  const [confirmCfg, setConfirmCfg] = useState<null | { title: string; message: string; onConfirm: () => void }>(null);
  const askConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmCfg({ title, message, onConfirm });

  if (!team) return null;

  // Solo mutates local state via the reducer; online emits to the authoritative server.
  const buyCoach = (coachId: string) => online ? shopChangeCoachOnline(coachId) : dispatch({ type: 'SHOP_CHANGE_COACH', coachId });
  const buyPlayer = (player: Player, kind: 'unique') => online ? shopBuyPlayerOnline(player, kind) : dispatch({ type: 'SHOP_BUY_PLAYER', player, kind });
  // 🛒 Pacote: COBRA ao abrir (open) → guarda; a escolha (pick) é grátis. Impede re-sortear de graça.
  const openPack = (kind: 'star' | 'scout', options: Player[], position?: string) => online ? shopOpenPackOnline(kind, position) : dispatch({ type: 'SHOP_OPEN_PACK', kind, options });
  const pickPack = (player: Player) => online ? shopPickPackOnline(player) : dispatch({ type: 'SHOP_PICK_PACK', player });
  const buyTurbinar = (playerId: string, variant: ShopVariant) => online ? shopTurbinarOnline(playerId, variant) : dispatch({ type: 'SHOP_TURBINAR', playerId, variant });
  const removeVariant = (playerId: string, variantKey?: VariantFlag) => online ? shopRemoveVariantOnline(playerId, variantKey) : dispatch({ type: 'SHOP_REMOVE_VARIANT', playerId, variantKey });
  const buyTrain = (playerId: string, attr: TrainAttr) => online ? shopTrainOnline(playerId, attr) : dispatch({ type: 'SHOP_TRAIN', playerId, attr });
  const buyReroll = () => online ? shopBuyRerollOnline() : dispatch({ type: 'SHOP_BUY_REROLL' });
  const ownedIds = team.players.map(p => p.id);
  const selPlayer = team.players.find(p => p.id === selPlayerId) ?? null;

  const close = () => { setActive(null); setSelPlayerId(null); setUniqueWarn(null); };

  const ITEMS: { id: ItemId; icon: string; name: string; cost: number | 'dyn'; color: string; desc: string }[] = [
    { id: 'unique', icon: '⭐', name: 'CARTAS ÚNICAS', cost: SHOP_COSTS.uniqueCard, color: '#F0E6C0', desc: 'Jogadores especiais de raridade ÚNICA — overall 99, visual exclusivo. Aceitam 2 características. Uma de cada.' },
    { id: 'coach', icon: '🎓', name: 'TROCAR TÉCNICO', cost: SHOP_COSTS.changeCoach, color: '#A78BFA', desc: 'Troca o comandante do time (muda buffs e estilo).' },
    { id: 'turbinar', icon: '✨', name: 'TURBINAR CARTA', cost: SHOP_COSTS.turbinar, color: '#E8C84A', desc: 'Aplica uma carta especial (Em Alta, Lobo, Coringa…) a um jogador. Só em quem NÃO tem característica.' },
    { id: 'removeVariant', icon: '🧹', name: 'REMOVER CARACTERÍSTICA', cost: SHOP_COSTS.removeVariant, color: '#F87171', desc: 'Tira a carta especial de um jogador — pra depois aplicar outra (via Turbinar).' },
    { id: 'star', icon: '🌟', name: 'PACOTE DO CRAQUE', cost: SHOP_COSTS.starPack, color: '#F59E0B', desc: 'Paga ao abrir e escolhe 1 de 3 jogadores (overall 88+). Entra no banco.' },
    { id: 'scout', icon: '🔍', name: 'CAÇA-TALENTOS', cost: SHOP_COSTS.scout, color: '#38BDF8', desc: 'Paga ao abrir e escolhe 1 de 4 da posição que você precisa.' },
    { id: 'train', icon: '💪', name: 'TREINO INTENSIVO', cost: 'dyn', color: '#34D399', desc: `+${TRAIN_BOOST} permanente num atributo (sem teto). Custo sobe a cada treino no mesmo jogador.` },
    { id: 'reroll', icon: '🔄', name: 'REROLL DE REFORÇO', cost: SHOP_COSTS.reroll, color: '#F472B6', desc: `Re-sorteia as opções do reforço pós-partida. Acumula entre rodadas. Você tem: ${state.reinforcementRerolls}.` },
  ];

  const openItem = (id: ItemId) => {
    if (id === 'reroll') { if (points >= SHOP_COSTS.reroll) buyReroll(); return; } // compra direta, sem modal
    // Se já tem um pacote PAGO pendente, abre ELE (força escolher antes de abrir outro).
    if ((id === 'star' || id === 'scout') && pendingPack) {
      setSelPlayerId(null); setActive(pendingPack.kind);
      return;
    }
    if (id === 'star') {
      if (points < SHOP_COSTS.starPack) return;
      askConfirm('Pacote do Craque', `Abrir o Pacote do Craque por 💰 ${SHOP_COSTS.starPack}? (você escolhe 1 de 3)`, () => {
        openPack('star', generateStarPackOptions(ownedIds)); // COBRA ao abrir
        setSelPlayerId(null); setActive('star');
      });
      return;
    }
    setSelPlayerId(null);
    setActive(id);
  };

  const pickScoutPosition = (pos: string) => {
    if (points < SHOP_COSTS.scout) return;
    askConfirm('Caça-Talentos', `Abrir o Caça-Talentos de ${POS_PT[pos] ?? pos} por 💰 ${SHOP_COSTS.scout}? (você escolhe 1 de 4)`, () => {
      openPack('scout', generateScoutOptions(pos, ownedIds), pos); // COBRA ao abrir
    });
  };

  return (
    <div className="ui-stack">
      {/* Balance */}
      <Panel tone="accent">
        <PanelBody className="flex items-center justify-between">
          <div>
            <div className="ui-panel__title">Seus pontos</div>
            <div className="mt-1 text-xs text-[var(--ui-text-muted)]">Ganhe mais vencendo partidas com bom saldo de gols.</div>
          </div>
          <div className="font-display text-4xl text-[var(--ui-brand-strong)]">💰 {points}</div>
        </PanelBody>
      </Panel>

      {/* Item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ITEMS.map(item => {
          const cost = item.cost === 'dyn' ? trainCost(0) : item.cost;
          const affordable = points >= cost;
          // Cartas Únicas: sempre dá pra ABRIR (ver as cartas) mesmo sem dinheiro — a cobrança é ao comprar.
          const canOpen = affordable || item.id === 'unique';
          return (
            <button
              key={item.id}
              onClick={() => canOpen && openItem(item.id)}
              disabled={!canOpen}
              className="ui-choice p-4 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: (affordable || item.id === 'unique') ? item.color + '88' : undefined }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-black px-2 py-0.5 rounded" style={{ fontFamily: 'Bebas Neue, sans-serif', background: `${item.color}22`, color: item.color }}>
                  💰 {item.cost === 'dyn' ? `${cost}+` : cost}
                </span>
              </div>
              <div className="text-base font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{item.name}</div>
              <div className="text-[11px] mt-0.5 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{item.desc}</div>
              {!affordable && item.id !== 'unique' && <div className="text-[10px] mt-1 font-bold" style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>Pontos insuficientes</div>}
              {!affordable && item.id === 'unique' && <div className="text-[10px] mt-1 font-bold" style={{ color: '#F0E6C0', fontFamily: 'Rajdhani, sans-serif' }}>👀 Ver as cartas</div>}
            </button>
          );
        })}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {active && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="ui-modal-backdrop z-50 p-3 sm:p-4" onClick={close}>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="ui-modal ui-modal--wide flex max-h-[90vh] flex-col">

              {/* Modal header */}
              <div className="ui-modal__header flex-shrink-0">
                <h3 className="ui-modal__title">
                  {ITEMS.find(i => i.id === active)?.icon} {ITEMS.find(i => i.id === active)?.name}
                </h3>
                <button onClick={close} aria-label="Fechar" className="ui-icon-btn">✕</button>
              </div>

              <div className="ui-modal__body flex-1">
                {/* ⭐ CARTAS ÚNICAS — jogadores especiais, overall 99, raridade Única */}
                {active === 'unique' && (
                  <div>
                    <p className="text-xs mb-2" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                      Jogadores especiais de raridade <b style={{ color: '#F0E6C0' }}>ÚNICA</b> — <b style={{ color: '#FFF' }}>overall 99</b>, visual exclusivo. −{SHOP_COSTS.uniqueCard} pontos cada · uma de cada, entra no banco.
                    </p>
                    <div className="mb-3 text-[11px] font-bold px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: '#F0E6C014', border: '1px solid #F0E6C033', color: '#EAD9A0', fontFamily: 'Rajdhani, sans-serif' }}>
                      <span className="text-sm leading-none">✨</span>
                      <span>Diferencial das Únicas: podem carregar <b style={{ color: '#F0E6C0' }}>DUAS características</b> ao mesmo tempo (as demais só uma). Aplique-as depois em <b style={{ color: '#E8C84A' }}>Turbinar Carta</b>.</span>
                    </div>
                    {uniqueWarn && (
                      <div className="mb-3 text-[11px] font-bold px-3 py-2 rounded-lg" style={{ background: '#EF444422', border: '1px solid #EF444455', color: '#FCA5A5', fontFamily: 'Rajdhani, sans-serif' }}>
                        ⚠️ {uniqueWarn}
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5 justify-items-center">
                      {UNIQUE_CARDS.map(card => {
                        const owned = ownedIds.includes(card.id);
                        const afford = points >= SHOP_COSTS.uniqueCard;
                        return (
                          <div key={card.id} className="flex flex-col items-center gap-2">
                            <PlayerCard player={card} lite scale={0.82} />
                            <button
                              onClick={() => {
                                if (owned) return;
                                if (afford) askConfirm('Carta Única', `Comprar ${card.shortName} (Única, 99) por 💰 ${SHOP_COSTS.uniqueCard}?`, () => { buyPlayer(card, 'unique'); close(); });
                                else setUniqueWarn(`Pontos insuficientes — você tem ${points}, e ${card.shortName} custa ${SHOP_COSTS.uniqueCard}.`);
                              }}
                              disabled={owned}
                              className="text-xs font-black px-4 py-1.5 rounded-lg tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95"
                              style={{ fontFamily: 'Bebas Neue, sans-serif', background: owned ? '#1A1A2A' : '#F0E6C0', color: owned ? '#8A8A9A' : '#0A0A14', border: owned ? '1px solid #2A2A3A' : 'none', opacity: (!owned && !afford) ? 0.72 : 1 }}>
                              {owned ? 'JÁ TEM' : `💰 ${SHOP_COSTS.uniqueCard}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TROCAR TÉCNICO */}
                {active === 'coach' && (
                  <div className="space-y-2">
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o novo técnico (−{SHOP_COSTS.changeCoach} pontos):</p>
                    {COACHES.filter(c => c.id !== team.coachId).map(c => (
                      <button key={c.id} onClick={() => askConfirm('Trocar Técnico', `Trocar o comandante para ${c.name} por 💰 ${SHOP_COSTS.changeCoach}?`, () => { buyCoach(c.id); close(); })}
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

                {/* PACOTE DO CRAQUE / CAÇA-TALENTOS — escolha do pacote JÁ PAGO */}
                {(active === 'star' || active === 'scout') && pendingPack && (
                  <div>
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                      Pacote <b style={{ color: '#22C55E' }}>já pago</b> ✓ — escolha <b style={{ color: '#FFF' }}>1</b> pra entrar no seu banco.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2.5 sm:gap-4">
                      {pendingPack.options.map(option => (
                        <button key={option.id}
                          onClick={() => { pickPack(option); close(); }}
                          className="transition-transform hover:scale-[1.06] active:scale-[0.97]">
                          <PlayerCard player={option} compact lite />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CAÇA-TALENTOS position picker (só antes de pagar o pacote) */}
                {active === 'scout' && !pendingPack && (
                  <div>
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Qual posição você precisa reforçar?</p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {SCOUT_POSITIONS.map(pos => (
                        <button key={pos} onClick={() => pickScoutPosition(pos)}
                          className="py-3 rounded-lg font-black text-sm transition-all hover:border-[#38BDF8]/60 active:scale-95"
                          style={{ fontFamily: 'Bebas Neue, sans-serif', background: '#07070f', border: '1px solid #1A1A2A', color: '#FFF' }}>
                          {POS_PT[pos] ?? pos}
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
                      <div className="space-y-3">
                        {[{ t: 'TITULARES', c: '#22C55E', list: team.players.slice(0, 11) }, { t: '🪑 BANCO / RESERVAS', c: '#818CF8', list: team.players.slice(11) }].map(g => g.list.length === 0 ? null : (
                          <div key={g.t}>
                            <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: g.c, fontFamily: 'Rajdhani, sans-serif' }}>{g.t}</div>
                            <div className="flex flex-wrap gap-2">
                              {g.list.map(p => (
                                <button key={p.id} onClick={() => canAddVariant(p) && setSelPlayerId(p.id)} disabled={!canAddVariant(p)}
                                  className="disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-[1.05]"
                                  title={!canAddVariant(p) ? 'Já atingiu o máximo de características' : (variantCount(p) === 1 ? '⭐ Única: pode receber a 2ª característica' : '')}>
                                  <PlayerCard player={p} compact lite />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] mt-2" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Uma característica por carta — as <b style={{ color: '#F0E6C0' }}>Únicas</b> podem ter <b>duas</b>. Quem já atingiu o limite fica desabilitado.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                        {variantCount(selPlayer) === 1
                          ? <>2ª característica para <b style={{ color: '#F0E6C0' }}>{selPlayer.shortName}</b> ⭐ (−{SHOP_COSTS.turbinar} pontos):</>
                          : <>Carta especial para <b style={{ color: '#C9A84C' }}>{selPlayer.shortName}</b> (−{SHOP_COSTS.turbinar} pontos):</>}
                      </p>
                      <div className="space-y-2">
                        {TURBINAR_VARIANTS.filter(v => !(selPlayer as unknown as Record<string, unknown>)[v.key]).map(v => {
                          const color = v.color === '#FFFFFF' ? '#E5E7EB' : v.color;
                          return (
                            <button key={v.key} onClick={() => askConfirm('Turbinar Carta', `Aplicar ${v.label} em ${selPlayer.shortName} por 💰 ${SHOP_COSTS.turbinar}?`, () => { buyTurbinar(selPlayer.id, v.key as ShopVariant); close(); })}
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

                {/* REMOVER CARACTERÍSTICA — pick a player that HAS a variant */}
                {active === 'removeVariant' && (() => {
                  const groups = [
                    { t: 'TITULARES', c: '#22C55E', list: team.players.slice(0, 11).filter(hasVariant) },
                    { t: '🪑 BANCO / RESERVAS', c: '#818CF8', list: team.players.slice(11).filter(hasVariant) },
                  ];
                  if (groups.every(g => g.list.length === 0)) {
                    return <p className="text-xs" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Nenhum jogador tem característica pra remover.</p>;
                  }
                  return (
                    <div>
                      <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                        Clique na <b style={{ color: '#F87171' }}>característica</b> que quer remover (−{SHOP_COSTS.removeVariant} pontos). Cartas <b style={{ color: '#F0E6C0' }}>Únicas</b> podem ter duas — some só a que você escolher.
                      </p>
                      <div className="space-y-3">
                        {groups.map(g => g.list.length === 0 ? null : (
                          <div key={g.t}>
                            <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: g.c, fontFamily: 'Rajdhani, sans-serif' }}>{g.t}</div>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-5 py-1">
                              {g.list.map(p => {
                                const vs = getCardVariants(p);
                                return (
                                  <div key={p.id} className="flex flex-col items-center gap-1.5">
                                    <PlayerCard player={p} compact lite />
                                    <div className="flex flex-wrap justify-center gap-1" style={{ maxWidth: 120 }}>
                                      {vs.map(v => {
                                        const vc = v.color === '#FFFFFF' ? '#E5E7EB' : v.color;
                                        return (
                                          <button key={v.key} onClick={() => askConfirm('Remover Característica', `Remover ${v.label} de ${p.shortName} por 💰 ${SHOP_COSTS.removeVariant}?`, () => { removeVariant(p.id, v.key as VariantFlag); close(); })}
                                            className="text-[10px] font-black px-2 py-0.5 rounded-full transition-transform hover:scale-[1.08] active:scale-95"
                                            title={`Remover ${v.label}`}
                                            style={{ background: `${vc}22`, color: vc, border: `1px solid ${vc}55`, fontFamily: 'Rajdhani, sans-serif' }}>
                                            🧹 {v.icon} {v.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* TREINO INTENSIVO — pick player then attribute */}
                {active === 'train' && (
                  !selPlayer ? (
                    <div>
                      <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o jogador para treinar:</p>
                      <div className="space-y-3">
                        {[{ t: 'TITULARES', c: '#22C55E', list: team.players.slice(0, 11) }, { t: '🪑 BANCO / RESERVAS', c: '#818CF8', list: team.players.slice(11) }].map(g => g.list.length === 0 ? null : (
                          <div key={g.t}>
                            <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: g.c, fontFamily: 'Rajdhani, sans-serif' }}>{g.t}</div>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-5 py-1">
                              {g.list.map(p => {
                                const c = trainCost(p.trainCount ?? 0);
                                return (
                                  <button key={p.id} onClick={() => setSelPlayerId(p.id)} className="flex flex-col items-center gap-1.5 transition-transform hover:scale-[1.05]">
                                    <PlayerCard player={p} compact lite />
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: '#34D39922', color: '#34D399', border: '1px solid #34D39944', fontFamily: 'Rajdhani, sans-serif' }}>💰 {c}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
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

      {/* 🛒 Confirmação de compra (premium) — acima do modal do item */}
      <AnimatePresence>
        {confirmCfg && (
          <div className="ui-modal-backdrop z-[70]" onClick={() => setConfirmCfg(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
              className="ui-modal max-w-sm border-[var(--ui-brand)] p-5 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-3xl mb-1">🛒</div>
              <h3 className="ui-modal__title mb-2">{confirmCfg.title}</h3>
              <p className="mb-2 text-sm text-[var(--ui-text-soft)]">{confirmCfg.message}</p>
              <p className="mb-4 text-xs text-[var(--ui-text-muted)]">Seu saldo: 💰 {points}</p>
              <div className="flex gap-2">
                <Button intent="ghost" className="flex-1" onClick={() => setConfirmCfg(null)}>
                  CANCELAR
                </Button>
                <Button intent="primary" className="flex-1"
                  onClick={() => { const fn = confirmCfg.onConfirm; setConfirmCfg(null); fn(); }}
                >
                  CONFIRMAR
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
