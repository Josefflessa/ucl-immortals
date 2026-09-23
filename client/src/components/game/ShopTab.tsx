// UCL Immortals — LOJA (shop) tab.
// Spend the points earned each match. Each item opens a small flow (pick a coach / player /
// variant / attribute / pack option) and dispatches the matching SHOP_* action; the reducer
// validates the cost. Solo and online league flows share the same presentation.
import { useEffect, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { COACHES, POS_PT, Player, UNIQUE_CARDS } from '../../lib/gameData';
import { buildUniquePackRoundKey, generateStarPackOptions, generateScoutOptions, SCOUT_MIN_OVERALL, hasVariant, canAddVariant, variantCount } from '../../lib/gameEngine';
import type { VariantFlag } from '../../lib/gameEngine';
import { SHOP_COSTS, trainCost, TRAIN_BOOST, TRAIN_ATTRS, TURBINAR_VARIANTS, ShopVariant, TrainAttr } from '../../lib/shop';
import PlayerCard, { getCardVariants, UNIQUE_STYLE } from './PlayerCard';
import UniquePackOpening from './UniquePackOpening';
import { Button, Panel, PanelBody } from '../../design-system';

type ItemId = 'coach' | 'turbinar' | 'removeVariant' | 'star' | 'scout' | 'train' | 'reroll' | 'unique';
const SCOUT_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
const VARIANTS_PER_PAGE = 10;
// A grade do pacote Único é a parte mais pesada da loja: cada card tem textura,
// render próprio e moldura. Aqueça apenas as quatro cartas da oferta atual,
// nunca o catálogo inteiro.
const warmedUniqueAssets = new Map<string, HTMLImageElement>();

function warmUniqueCardAssets(cards: Player[] = []) {
  if (typeof window === 'undefined') return;
  const assets = new Set(cards.flatMap(card => {
    const style = UNIQUE_STYLE[card.id];
    return style ? [style.texture, style.render] : [];
  }));
  assets.forEach(src => {
    if (warmedUniqueAssets.has(src)) return;
    const image = new window.Image();
    image.decoding = 'async';
    image.src = src;
    warmedUniqueAssets.set(src, image);
    void image.decode?.().catch(() => {});
  });
}

function VariantPagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (next: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg px-2 py-2" style={{ background: '#0B0B15', border: '1px solid #1B1B2B' }}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="rounded-md px-2.5 py-1.5 text-[10px] font-black tracking-wider disabled:opacity-30"
        style={{ color: '#C9C9D5', border: '1px solid #343449', fontFamily: 'Rajdhani, sans-serif' }}>
        ← ANTERIOR
      </button>
      <span className="text-[10px] font-black tracking-widest text-center" style={{ color: '#A9A9BA', fontFamily: 'Rajdhani, sans-serif' }}>
        PÁGINA {page + 1}/{pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        className="rounded-md px-2.5 py-1.5 text-[10px] font-black tracking-wider disabled:opacity-30"
        style={{ color: '#C9C9D5', border: '1px solid #343449', fontFamily: 'Rajdhani, sans-serif' }}>
        PRÓXIMA →
      </button>
    </div>
  );
}

export default function ShopTab() {
  const { state, dispatch, shopChangeCoachOnline, shopOpenUniquePackOnline, shopClaimUniquePackOnline, shopOpenPackOnline, shopPickPackOnline, shopTurbinarOnline, shopRemoveVariantOnline, shopTrainOnline, shopBuyRerollOnline } = useGame();
  const team = state.playerTeam;
  const points = state.points;
  const online = state.mode === 'online';
  const pendingPack = state.pendingPack; // 🛒 pacote JÁ PAGO (Craque/Caça-Talentos) aguardando escolha
  const pendingUniquePack = state.pendingUniquePack; // ⭐ carta sorteada e reservada até a revelação
  const [active, setActive] = useState<ItemId | null>(null);
  const [selPlayerId, setSelPlayerId] = useState<string | null>(null);
  const [variantPage, setVariantPage] = useState(0);
  const [turbinarView, setTurbinarView] = useState<'catalog' | 'apply'>('catalog');
  // 🛒 Confirmação de compra (premium) — reutilizada por todas as compras significativas da loja.
  const [confirmCfg, setConfirmCfg] = useState<null | { title: string; message: string; onConfirm: () => void }>(null);
  const askConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmCfg({ title, message, onConfirm });

  // Deixa o catálogo pronto enquanto o usuário navega pela loja, sem disputar
  // o primeiro frame da troca de aba.
  useEffect(() => {
    if (active === 'unique' && !online && !pendingUniquePack) {
      dispatch({ type: 'ENSURE_UNIQUE_PACK_OFFER' });
    }
  }, [active, online, pendingUniquePack, state.leagueRound, state.knockoutBracket, dispatch]);

  // A troca de jogador/modal sempre começa pela primeira página. Isso evita
  // manter uma página alta que não exista para a nova lista de características.
  useEffect(() => {
    setVariantPage(0);
  }, [active, selPlayerId]);

  if (!team) return null;

  // Solo mutates local state via the reducer; online emits to the authoritative server.
  const buyCoach = (coachId: string) => online ? shopChangeCoachOnline(coachId) : dispatch({ type: 'SHOP_CHANGE_COACH', coachId });
  const openUniquePack = () => online ? shopOpenUniquePackOnline() : dispatch({ type: 'SHOP_OPEN_UNIQUE_PACK' });
  const claimUniquePack = () => online ? shopClaimUniquePackOnline() : dispatch({ type: 'SHOP_CLAIM_UNIQUE_PACK' });
  // 🛒 Pacote: COBRA ao abrir (open) → guarda; a escolha (pick) é grátis. Impede re-sortear de graça.
  const openPack = (kind: 'star' | 'scout', options: Player[], position?: string) => online ? shopOpenPackOnline(kind, position) : dispatch({ type: 'SHOP_OPEN_PACK', kind, options });
  const pickPack = (player: Player) => online ? shopPickPackOnline(player) : dispatch({ type: 'SHOP_PICK_PACK', player });
  const buyTurbinar = (playerId: string, variant: ShopVariant) => online ? shopTurbinarOnline(playerId, variant) : dispatch({ type: 'SHOP_TURBINAR', playerId, variant });
  const removeVariant = (playerId: string, variantKey?: VariantFlag) => online ? shopRemoveVariantOnline(playerId, variantKey) : dispatch({ type: 'SHOP_REMOVE_VARIANT', playerId, variantKey });
  const buyTrain = (playerId: string, attr: TrainAttr) => online ? shopTrainOnline(playerId, attr) : dispatch({ type: 'SHOP_TRAIN', playerId, attr });
  const buyReroll = () => online ? shopBuyRerollOnline() : dispatch({ type: 'SHOP_BUY_REROLL' });
  const ownedIds = team.players.map(p => p.id);
  const selPlayer = team.players.find(p => p.id === selPlayerId) ?? null;
  const uniqueOfferRoundKey = state.phase === 'league'
    ? buildUniquePackRoundKey('league', state.leagueRound)
    : state.phase === 'knockout' && state.knockoutBracket
      ? buildUniquePackRoundKey('knockout', state.leagueRound, state.knockoutBracket.currentRound, state.knockoutBracket.currentLeg)
      : null;
  const uniquePackCards = state.uniquePackOfferRoundKey === uniqueOfferRoundKey
    ? state.uniquePackOfferIds
      .map(id => UNIQUE_CARDS.find(card => card.id === id))
      .filter((card): card is Player => !!card)
    : [];

  const close = () => { setActive(null); setSelPlayerId(null); setVariantPage(0); setTurbinarView('catalog'); };

  const ITEMS: { id: ItemId; icon: string; name: string; cost: number | 'dyn'; color: string; desc: string }[] = [
    { id: 'unique', icon: '⭐', name: 'PACOTE ÚNICO', cost: SHOP_COSTS.uniqueCard, color: '#F0E6C0', desc: '4 cartas mudam a cada rodada. Cada abertura sorteia uma delas; a carta entra no banco após a revelação.' },
    { id: 'coach', icon: '🎓', name: 'TROCAR TÉCNICO', cost: SHOP_COSTS.changeCoach, color: '#A78BFA', desc: 'Troca o comandante do time (muda buffs e estilo).' },
    { id: 'turbinar', icon: '✨', name: 'TURBINAR CARTA', cost: SHOP_COSTS.turbinar, color: '#E8C84A', desc: 'Consulte todas as características e aplique uma delas a um jogador.' },
    { id: 'removeVariant', icon: '🧹', name: 'REMOVER CARACTERÍSTICA', cost: SHOP_COSTS.removeVariant, color: '#F87171', desc: 'Tira a carta especial de um jogador — pra depois aplicar outra (via Turbinar).' },
    { id: 'star', icon: '🌟', name: 'PACOTE DO CRAQUE', cost: SHOP_COSTS.starPack, color: '#F59E0B', desc: 'Paga ao abrir e escolhe 1 de 3 jogadores (overall 88+). Entra no banco.' },
    { id: 'scout', icon: '🔍', name: 'CAÇA-TALENTOS', cost: SHOP_COSTS.scout, color: '#38BDF8', desc: `Paga ao abrir e escolhe 1 de até 4 jogadores ${SCOUT_MIN_OVERALL}+ da posição principal escolhida.` },
    { id: 'train', icon: '💪', name: 'TREINO INTENSIVO', cost: 'dyn', color: '#34D399', desc: `+${TRAIN_BOOST} permanente num atributo (sem teto). Custo sobe a cada treino no mesmo jogador.` },
    { id: 'reroll', icon: '🔄', name: 'REROLL DE REFORÇO', cost: SHOP_COSTS.reroll, color: '#F472B6', desc: `Re-sorteia as opções do reforço pós-partida. Acumula entre rodadas. Você tem: ${state.reinforcementRerolls}.` },
  ];

  const availableVariants = selPlayer
    ? TURBINAR_VARIANTS.filter(v => !(selPlayer as unknown as Record<string, unknown>)[v.key])
    : [];
  const variantPageCount = Math.max(1, Math.ceil(availableVariants.length / VARIANTS_PER_PAGE));
  const safeVariantPage = Math.min(variantPage, variantPageCount - 1);
  const visibleVariants = availableVariants.slice(
    safeVariantPage * VARIANTS_PER_PAGE,
    (safeVariantPage + 1) * VARIANTS_PER_PAGE,
  );
  const catalogPageCount = Math.ceil(TURBINAR_VARIANTS.length / VARIANTS_PER_PAGE);
  const safeCatalogPage = Math.min(variantPage, catalogPageCount - 1);
  const visibleCatalogVariants = TURBINAR_VARIANTS.slice(
    safeCatalogPage * VARIANTS_PER_PAGE,
    (safeCatalogPage + 1) * VARIANTS_PER_PAGE,
  );

  const openItem = (id: ItemId) => {
    if (id === 'reroll') { if (points >= SHOP_COSTS.reroll) buyReroll(); return; } // compra direta, sem modal
    // Se já tem um pacote PAGO pendente, abre ELE (força escolher antes de abrir outro).
    if (pendingPack && (id === 'unique' || id === 'star' || id === 'scout')) {
      setSelPlayerId(null); setActive(pendingPack.kind);
      return;
    }
    if (pendingUniquePack && id !== 'unique') {
      setSelPlayerId(null); setActive('unique');
      return;
    }
    if (id === 'unique') {
      if (!online) dispatch({ type: 'ENSURE_UNIQUE_PACK_OFFER' });
      setSelPlayerId(null); setActive('unique');
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
    if (id === 'turbinar') setTurbinarView('apply');
    setActive(id);
  };

  const pickScoutPosition = (pos: string) => {
    if (points < SHOP_COSTS.scout) return;
    askConfirm('Caça-Talentos', `Abrir o Caça-Talentos de ${POS_PT[pos] ?? pos} por 💰 ${SHOP_COSTS.scout}? (posição principal, overall ${SCOUT_MIN_OVERALL}+)`, () => {
      openPack('scout', generateScoutOptions(pos, ownedIds), pos); // COBRA ao abrir
    });
  };

  return (
    <div className="ui-stack">
      {/* Balance */}
      <Panel tone="accent">
        <PanelBody className="flex items-center justify-between">
          <div>
            <div className="ui-panel__title">Seus créditos</div>
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
             <div
               key={item.id}
               className="ui-choice relative p-4"
                style={{ borderColor: (affordable || item.id === 'unique') ? item.color + '88' : undefined }}
             >
               <button
                 type="button"
                 onClick={() => canOpen && openItem(item.id)}
                 onPointerDown={() => item.id === 'unique' && warmUniqueCardAssets(uniquePackCards)}
                 disabled={!canOpen}
                 className="w-full pb-8 text-left disabled:cursor-not-allowed disabled:opacity-50"
               >
                 <div className="flex items-center justify-between mb-1">
                   <span className="text-2xl">{item.icon}</span>
                   <span className="text-sm font-black px-2 py-0.5 rounded" style={{ fontFamily: 'Bebas Neue, sans-serif', background: `${item.color}22`, color: item.color }}>
                     💰 {item.cost === 'dyn' ? `${cost}+` : cost}
                   </span>
                 </div>
                 <div className="text-base font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{item.name}</div>
                 <div className="text-[11px] mt-0.5 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{item.desc}</div>
                 {!affordable && item.id !== 'unique' && item.id !== 'turbinar' && <div className="text-[10px] mt-1 font-bold" style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>Créditos insuficientes</div>}
                 {!affordable && item.id === 'unique' && <div className="text-[10px] mt-1 font-bold" style={{ color: '#F0E6C0', fontFamily: 'Rajdhani, sans-serif' }}>👀 Ver as cartas</div>}
               </button>
               {item.id === 'turbinar' && (
                 <button
                   type="button"
                   aria-label="Ver características especiais"
                   onClick={() => { setSelPlayerId(null); setVariantPage(0); setTurbinarView('catalog'); setActive('turbinar'); }}
                   className="absolute bottom-3 right-3 flex h-7 items-center justify-center rounded-full px-2.5 text-[10px] font-black tracking-wider transition-transform hover:scale-105 active:scale-95"
                   style={{ color: '#E8C84A', background: '#E8C84A18', border: '1px solid #E8C84A66' }}
                 >
                   ⓘ LISTA
                 </button>
               )}
             </div>
           );
        })}
      </div>

      {/* ⭐ A abertura ocupa a tela inteira: o pacote é a própria experiência, sem a modal padrão da loja. */}
      <>
        {active === 'unique' && pendingUniquePack && (
          <div
            className="fixed inset-0 z-[60]"
          >
            <UniquePackOpening
              card={pendingUniquePack}
              onClose={close}
              onClaim={() => { claimUniquePack(); close(); }}
            />
          </div>
        )}
      </>

      {/* ── Modals ── */}
      <>
        {active && !pendingUniquePack && (
          <div
            className="ui-modal-backdrop z-50 p-3 sm:p-4" onClick={close}>
            <div
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
                {/* ⭐ PACOTE ÚNICO — quatro cartas da rodada + abertura/revelação aleatória */}
                {active === 'unique' && (
                  pendingUniquePack ? (
                    <UniquePackOpening
                      card={pendingUniquePack}
                      onClaim={() => { claimUniquePack(); close(); }}
                    />
                  ) : (() => {
                    const ownedUniqueCount = UNIQUE_CARDS.filter(card => ownedIds.includes(card.id)).length;
                    const selectableUniqueCards = uniquePackCards.filter(card => !ownedIds.includes(card.id));
                    const offerReady = uniquePackCards.length > 0 || ownedUniqueCount >= UNIQUE_CARDS.length;
                    const canBuyPack = points >= SHOP_COSTS.uniqueCard && selectableUniqueCards.length > 0;
                    return (
                      <div>
                        <p className="text-xs mb-2" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                          A oferta mostra <b style={{ color: '#FFF' }}>4 Cartas Únicas</b>. Por <b style={{ color: '#F0E6C0' }}>💰 {SHOP_COSTS.uniqueCard}</b>, uma delas é sorteada aleatoriamente e só entra no banco depois da revelação.
                        </p>
                        <div className="mb-4 text-[11px] font-bold px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: '#F0E6C014', border: '1px solid #F0E6C033', color: '#EAD9A0', fontFamily: 'Rajdhani, sans-serif' }}>
                          <span className="text-sm leading-none">✨</span>
                          <span>As Únicas têm <b style={{ color: '#F0E6C0' }}>overall 99</b>, visual exclusivo e podem carregar <b style={{ color: '#F0E6C0' }}>duas características</b> ao mesmo tempo. A oferta muda a cada rodada. Você já tem <b style={{ color: '#FFF' }}>{ownedUniqueCount}</b> de {UNIQUE_CARDS.length}.</span>
                        </div>
                        {!offerReady ? (
                          <div className="rounded-xl px-4 py-8 text-center text-xs font-bold" style={{ background: '#07070f', border: '1px dashed #2A2A3A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                            Preparando a oferta desta rodada…
                          </div>
                        ) : uniquePackCards.length > 0 ? (
                          <div className="grid grid-cols-2 gap-x-2 gap-y-5 justify-items-center sm:grid-cols-4 sm:gap-x-3">
                            {uniquePackCards.map(card => {
                              const owned = ownedIds.includes(card.id);
                              return (
                                <div key={card.id} className="unique-card-catalog-tile relative flex min-w-0 flex-col items-center gap-2">
                                  <div className={owned ? 'opacity-100' : 'opacity-75'}>
                                    <PlayerCard player={card} lite scale={0.68} />
                                  </div>
                                  <span className="text-center text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif', background: owned ? '#22C55E22' : '#1A1A2A', color: owned ? '#86EFAC' : '#CFCFE0', border: `1px solid ${owned ? '#22C55E55' : '#2A2A3A'}` }}>
                                    {owned ? 'JÁ POSSUI' : 'DISPONÍVEL'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl px-4 py-8 text-center text-xs font-bold" style={{ background: '#07070f', border: '1px dashed #2A2A3A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                            Você já possui todas as Cartas Únicas.
                          </div>
                        )}
                        <div className="mt-5 rounded-xl p-3 text-center" style={{ background: '#07070f', border: '1px solid #F0E6C033' }}>
                          <p className="mb-3 text-xs" style={{ color: canBuyPack ? '#CFCFE0' : '#FCA5A5', fontFamily: 'Rajdhani, sans-serif' }}>
                            {!offerReady
                              ? 'A oferta desta rodada está sendo preparada.'
                              : selectableUniqueCards.length === 0
                                ? 'Você já possui as quatro cartas desta oferta.'
                              : points < SHOP_COSTS.uniqueCard
                                ? `Faltam ${SHOP_COSTS.uniqueCard - points} créditos para abrir o pacote.`
                                : 'O jogador será revelado em uma animação de abertura.'}
                          </p>
                          <button
                            type="button"
                            disabled={!canBuyPack}
                            onClick={() => askConfirm('Pacote Único', `Abrir um pacote aleatório por 💰 ${SHOP_COSTS.uniqueCard}? A carta sorteada será uma Única que você ainda não possui.`, openUniquePack)}
                            className="w-full rounded-xl px-4 py-3 text-sm font-black tracking-widest transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ background: '#F0E6C0', color: '#0A0A14', fontFamily: 'Bebas Neue, sans-serif' }}
                          >
                            {selectableUniqueCards.length === 0 ? 'OFERTA ADQUIRIDA' : `ABRIR PACOTE · 💰 ${SHOP_COSTS.uniqueCard}`}
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* TROCAR TÉCNICO */}
                {active === 'coach' && (
                  <div className="space-y-2">
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o novo técnico (−{SHOP_COSTS.changeCoach} créditos):</p>
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

                {/* TURBINAR CARTA — catálogo informativo, sem exigir saldo ou jogador */}
                {active === 'turbinar' && turbinarView === 'catalog' && (
                  <div>
                    <div className="space-y-2">
                      {visibleCatalogVariants.map(v => {
                        const color = v.color === '#FFFFFF' ? '#E5E7EB' : v.color;
                        return (
                          <div key={v.key} className="w-full min-h-[86px] rounded-xl p-4 flex items-center gap-4" style={{ background: '#07070f', border: `1px solid ${color}44` }}>
                            <span className="text-3xl flex-shrink-0">{v.icon}</span>
                            <div className="min-w-0">
                              <div className="text-lg font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color }}>{v.label}</div>
                              <div className="text-xs leading-relaxed" style={{ color: '#B1B1C0', fontFamily: 'Rajdhani, sans-serif' }}>{v.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <VariantPagination page={safeCatalogPage} pageCount={catalogPageCount} onPageChange={setVariantPage} />
                  </div>
                )}

                {/* TURBINAR CARTA — escolha do jogador e aplicação */}
                {active === 'turbinar' && turbinarView === 'apply' && (
                  !selPlayer ? (
                    <div>
                      <button type="button" onClick={() => { setTurbinarView('catalog'); setVariantPage(0); }} className="mb-3 text-xs font-bold" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>ⓘ ver características especiais</button>
                      <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o jogador que vai receber a carta especial:</p>
                      <div className="space-y-3">
                        {[{ t: 'TITULARES', c: '#22C55E', list: team.players.slice(0, 11) }, { t: '🪑 BANCO / RESERVAS', c: '#818CF8', list: team.players.slice(11) }].map(g => g.list.length === 0 ? null : (
                          <div key={g.t}>
                            <div className="text-[10px] font-black tracking-widest mb-2" style={{ color: g.c, fontFamily: 'Rajdhani, sans-serif' }}>{g.t}</div>
                            <div className="flex flex-wrap gap-2">
                              {g.list.map(p => (
                                <button key={p.id} onClick={() => { if (canAddVariant(p)) { setSelPlayerId(p.id); setVariantPage(0); } }} disabled={!canAddVariant(p)}
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
                          ? <>2ª característica para <b style={{ color: '#F0E6C0' }}>{selPlayer.shortName}</b> ⭐ (−{SHOP_COSTS.turbinar} créditos):</>
                          : <>Carta especial para <b style={{ color: '#C9A84C' }}>{selPlayer.shortName}</b> (−{SHOP_COSTS.turbinar} créditos):</>}
                      </p>
                      <div className="space-y-2">
                        {visibleVariants.map(v => {
                          const color = v.color === '#FFFFFF' ? '#E5E7EB' : v.color;
                          return (
                            <button key={v.key} onClick={() => askConfirm('Turbinar Carta', `Aplicar ${v.label} em ${selPlayer.shortName} por 💰 ${SHOP_COSTS.turbinar}?`, () => { buyTurbinar(selPlayer.id, v.key as ShopVariant); close(); })}
                              className="w-full text-left rounded-xl p-4 flex items-center gap-4 transition-all active:scale-[0.99]"
                              style={{ background: '#07070f', border: `1px solid ${color}44` }}>
                              <span className="text-3xl flex-shrink-0">{v.icon}</span>
                              <div>
                                <div className="text-lg font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color }}>{v.label}</div>
                                <div className="text-xs leading-relaxed" style={{ color: '#B1B1C0', fontFamily: 'Rajdhani, sans-serif' }}>{v.desc}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <VariantPagination page={safeVariantPage} pageCount={variantPageCount} onPageChange={setVariantPage} />
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
                        Clique na <b style={{ color: '#F87171' }}>característica</b> que quer remover (−{SHOP_COSTS.removeVariant} créditos). Cartas <b style={{ color: '#F0E6C0' }}>Únicas</b> podem ter duas — some só a que você escolher.
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
                        {!affordable && <p className="text-[11px] mb-2 font-bold" style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>Créditos insuficientes para este jogador.</p>}
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
            </div>
          </div>
        )}
      </>

      {/* 🛒 Confirmação de compra (premium) — acima do modal do item */}
      <>
        {confirmCfg && (
          <div className="ui-modal-backdrop z-[70]" onClick={() => setConfirmCfg(null)}>
            <div
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
            </div>
          </div>
        )}
      </>
    </div>
  );
}
