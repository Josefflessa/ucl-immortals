// UCL Immortals — LOJA (shop) tab.
// Spend the points earned each match. Each item opens a small flow (pick a coach / player /
// variant / attribute / pack option) and dispatches the matching SHOP_* action; the reducer
// validates the cost. Solo and online league flows share the same presentation.
import { useEffect, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { COACHES, PLAYERS, POS_PT, Player, UNIQUE_CARDS } from '@shared/game/gameData';
import { buildUniquePackRoundKey, SCOUT_MIN_OVERALL, hasVariant, canAddVariant, variantCount } from '@shared/game/gameEngine';
import type { VariantFlag } from '@shared/game/gameEngine';
import { PLAYER_PACK_META, PLAYER_PACK_RARITIES, SHOP_COSTS, TURBINAR_VARIANTS, ShopVariant, type PlayerPackRarity, type RegularPlayerPackRarity, playerPackCost } from '@shared/game/shop';
import PlayerCard, { getCardVariants, UNIQUE_STYLE } from './PlayerCard';
import UniquePackOpening from './UniquePackOpening';
import { Button, GameModal } from '../../design-system';

type ItemId = 'coach' | 'turbinar' | 'removeVariant' | 'scout' | 'playerPacks';
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
        className="rounded-md px-2.5 py-1.5 text-[12px] font-black tracking-wider disabled:opacity-30"
        style={{ color: '#C9C9D5', border: '1px solid #343449', fontFamily: 'Rajdhani, sans-serif' }}>
        ← ANTERIOR
      </button>
      <span className="text-[12px] font-black tracking-widest text-center" style={{ color: '#A9A9BA', fontFamily: 'Rajdhani, sans-serif' }}>
        PÁGINA {page + 1}/{pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        className="rounded-md px-2.5 py-1.5 text-[12px] font-black tracking-wider disabled:opacity-30"
        style={{ color: '#C9C9D5', border: '1px solid #343449', fontFamily: 'Rajdhani, sans-serif' }}>
        PRÓXIMA →
      </button>
    </div>
  );
}

export default function ShopTab() {
  const { state, dispatch, shopChangeCoachOnline, shopOpenUniquePackOnline, shopClaimUniquePackOnline, ensurePlayerPackOffersOnline, shopOpenPlayerPackOnline, shopClaimPlayerPackOnline, shopOpenPackOnline, shopPickPackOnline, shopTurbinarOnline, shopRemoveVariantOnline } = useGame();
  const team = state.playerTeam;
  const points = state.points;
  const online = state.mode === 'online';
  const pendingPack = state.pendingPack; // 🛒 pacote JÁ PAGO aguardando a escolha do jogador
  const pendingPackKind = pendingPack?.kind ?? null;
  const pendingPackOptionIds = pendingPack?.options.map(option => option.id).join('|') ?? null;
  const pendingPackReveal = state.pendingPackReveal; // 📦 pacote de raridade já pago, aguardando a animação/revelação
  const pendingUniquePack = state.pendingUniquePack; // ⭐ carta sorteada e reservada até a revelação
  const [active, setActive] = useState<ItemId | null>(null);
  const [selPlayerId, setSelPlayerId] = useState<string | null>(null);
  const [variantPage, setVariantPage] = useState(0);
  const [turbinarView, setTurbinarView] = useState<'catalog' | 'apply'>('catalog');
  const [selectedPackRarity, setSelectedPackRarity] = useState<PlayerPackRarity | null>(null);
  // 🛒 Confirmação de compra (premium) — reutilizada por todas as compras significativas da loja.
  const [confirmCfg, setConfirmCfg] = useState<null | { title: string; message: string; onConfirm: () => void }>(null);
  const askConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmCfg({ title, message, onConfirm });

  // Deixa o catálogo pronto enquanto o usuário navega pela loja, sem disputar
  // o primeiro frame da troca de aba.
  useEffect(() => {
    if (active === 'playerPacks' && !pendingUniquePack && !pendingPackReveal) {
      if (online) ensurePlayerPackOffersOnline();
      else {
        dispatch({ type: 'ENSURE_UNIQUE_PACK_OFFER' });
        dispatch({ type: 'ENSURE_PLAYER_PACK_OFFERS' });
      }
    }
  }, [active, online, pendingUniquePack, pendingPackReveal, state.leagueRound, state.knockoutBracket, dispatch, ensurePlayerPackOffersOnline]);

  // A compra é confirmada primeiro pelo estado autoritativo (especialmente
  // no online). Se o modal da loja fechar durante essa atualização, a carta
  // reservada não deve ficar escondida na tela da loja: reabrimos a experiência
  // automaticamente quando um novo pacote pendente chega. As dependências
  // usam a identidade da carta para não reabrir a abertura depois que o usuário
  // a fechou manualmente sem reivindicá-la.
  useEffect(() => {
    if (!pendingPackReveal && !pendingUniquePack) return;
    setSelPlayerId(null);
    setActive('playerPacks');
  }, [pendingPackReveal?.kind, pendingPackReveal?.card.id, pendingUniquePack?.id]);

  // O Caça-Talentos é confirmado pelo estado autoritativo no online. Quando a
  // oferta chega, abre a escolha sem exigir que a pessoa
  // feche e abra o item de novo. As dependências identificam uma oferta nova;
  // fechar manualmente uma oferta pendente não a reabre a cada atualização.
  useEffect(() => {
    if (!pendingPackKind) return;
    setSelPlayerId(null);
    setActive('scout');
  }, [pendingPackKind, pendingPackOptionIds]);

  // A troca de jogador/modal sempre começa pela primeira página. Isso evita
  // manter uma página alta que não exista para a nova lista de características.
  useEffect(() => {
    setVariantPage(0);
  }, [active, selPlayerId]);

  if (!team) return null;

  // Solo mutates local state via the reducer; online emits to the authoritative server.
  const buyCoach = (coachId: string) => online ? shopChangeCoachOnline(coachId) : dispatch({ type: 'SHOP_CHANGE_COACH', coachId });
  const openUniquePack = () => online ? shopOpenUniquePackOnline() : dispatch({ type: 'SHOP_OPEN_UNIQUE_PACK' });
  const claimPlayerPack = () => online ? shopClaimPlayerPackOnline() : dispatch({ type: 'SHOP_CLAIM_PLAYER_PACK' });
  const claimUniquePack = () => online ? shopClaimUniquePackOnline() : dispatch({ type: 'SHOP_CLAIM_UNIQUE_PACK' });
  // 🛒 Pacote: COBRA ao abrir (open) → guarda; a escolha (pick) é grátis. Impede re-sortear de graça.
  const openScoutPack = (position: string) => online ? shopOpenPackOnline(position) : dispatch({ type: 'SHOP_OPEN_PACK', position });
  const pickPack = (player: Player) => online ? shopPickPackOnline(player) : dispatch({ type: 'SHOP_PICK_PACK', player });
  const buyTurbinar = (playerId: string, variant: ShopVariant) => online ? shopTurbinarOnline(playerId, variant) : dispatch({ type: 'SHOP_TURBINAR', playerId, variant });
  const removeVariant = (playerId: string, variantKey?: VariantFlag) => online ? shopRemoveVariantOnline(playerId, variantKey) : dispatch({ type: 'SHOP_REMOVE_VARIANT', playerId, variantKey });
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
  const regularPackCards: Partial<Record<RegularPlayerPackRarity, Player[]>> = {};
  for (const rarity of PLAYER_PACK_RARITIES) {
    if (rarity === 'unique') continue;
    regularPackCards[rarity] = state.playerPackOfferRoundKeys[rarity] === uniqueOfferRoundKey
      ? (state.playerPackOfferIds[rarity] ?? [])
        .map(id => PLAYERS.find(card => card.id === id))
        .filter((card): card is Player => !!card)
      : [];
  }

  const close = () => { setActive(null); setSelPlayerId(null); setVariantPage(0); setTurbinarView('catalog'); setSelectedPackRarity(null); };

  const ITEMS: { id: ItemId; icon: string; name: string; cost: number | null; color: string; desc: string }[] = [
    { id: 'coach', icon: '🎓', name: 'TROCAR TÉCNICO', cost: SHOP_COSTS.changeCoach, color: '#A78BFA', desc: 'Troca o comandante do time (muda buffs e estilo).' },
    { id: 'playerPacks', icon: '📦', name: 'PACOTES DE JOGADOR', cost: null, color: '#F0C674', desc: 'Escolha uma raridade, do Bronze à Única, e abra um pacote temático para reforçar o elenco.' },
    { id: 'scout', icon: '🔍', name: 'CAÇA-TALENTOS', cost: SHOP_COSTS.scout, color: '#38BDF8', desc: `Paga ao abrir e escolhe 1 de até 4 jogadores ${SCOUT_MIN_OVERALL}+ da posição principal escolhida.` },
    { id: 'turbinar', icon: '✨', name: 'TURBINAR CARTA', cost: SHOP_COSTS.turbinar, color: '#E8C84A', desc: 'Consulte todas as características e aplique uma delas a um jogador.' },
    { id: 'removeVariant', icon: '🧹', name: 'REMOVER CARACTERÍSTICA', cost: SHOP_COSTS.removeVariant, color: '#F87171', desc: 'Tira a carta especial de um jogador — pra depois aplicar outra (via Turbinar).' },
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
    // Se já tem um pacote PAGO pendente, abre ELE (força escolher antes de abrir outro).
    if (pendingPack && (id === 'playerPacks' || id === 'scout')) {
      setSelPlayerId(null); setActive(id === 'playerPacks' ? 'playerPacks' : 'scout');
      return;
    }
    if (pendingPackReveal && id !== 'playerPacks') {
      setSelPlayerId(null); setActive('playerPacks');
      return;
    }
    if (pendingUniquePack && id !== 'playerPacks') {
      setSelPlayerId(null); setActive('playerPacks');
      return;
    }
    if (id === 'playerPacks') {
      if (!online) dispatch({ type: 'ENSURE_UNIQUE_PACK_OFFER' });
      if (!online) dispatch({ type: 'ENSURE_PLAYER_PACK_OFFERS' });
      setSelectedPackRarity(null);
      setSelPlayerId(null); setActive('playerPacks');
      return;
    }
    setSelPlayerId(null);
    if (id === 'turbinar') setTurbinarView('apply');
    setActive(id);
  };

  const pickScoutPosition = (pos: string) => {
    if (points < SHOP_COSTS.scout) return;
    askConfirm('Caça-Talentos', `Abrir o Caça-Talentos de ${POS_PT[pos] ?? pos} por 💰 ${SHOP_COSTS.scout}? (posição principal, overall ${SCOUT_MIN_OVERALL}+)`, () => {
      openScoutPack(pos); // COBRA ao abrir
    });
  };

  const openRarityPack = (rarity: PlayerPackRarity) => {
    const cost = playerPackCost(rarity);
    const meta = PLAYER_PACK_META[rarity];
    if (points < cost) return;
    if (rarity === 'unique') {
      askConfirm(`Pacote ${meta.label}`, `Abrir um pacote ${meta.label} por 💰 ${cost}? A carta será revelada na animação de abertura.`, openUniquePack);
      return;
    }
    askConfirm(`Pacote ${meta.label}`, `Abrir um pacote ${meta.label} por 💰 ${cost}? Uma das quatro cartas da oferta será revelada na animação.`, () => {
      if (online) shopOpenPlayerPackOnline(rarity);
      else dispatch({ type: 'SHOP_OPEN_PLAYER_PACK', rarity });
      setSelPlayerId(null);
      setActive('playerPacks');
    });
  };

  return (
    <div className="ui-stack">
      {/* Item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ITEMS.map(item => {
          const cost = item.cost;
          const affordable = cost === null || points >= cost;
          const canOpen = affordable;
           return (
             <div
               key={item.id}
               className="ui-choice relative h-[150px] p-4"
                style={{ borderColor: affordable ? item.color + '88' : undefined }}
             >
               <button
                 type="button"
                 onClick={() => canOpen && openItem(item.id)}
                 onPointerDown={() => item.id === 'playerPacks' && warmUniqueCardAssets(uniquePackCards)}
                 disabled={!canOpen}
                 className="h-full w-full pb-8 text-left disabled:cursor-not-allowed disabled:opacity-50"
               >
                 <div className="flex items-center justify-between mb-1">
                   {item.icon && <span className="text-2xl">{item.icon}</span>}
                   {cost !== null && (
                     <span className="text-sm font-black px-2 py-0.5 rounded" style={{ fontFamily: 'Bebas Neue, sans-serif', background: `${item.color}22`, color: item.color }}>
                       💰 {cost}
                     </span>
                   )}
                 </div>
                 <div className="text-base font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{item.name}</div>
                 <div className="text-[13px] mt-0.5 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{item.desc}</div>
                 {!affordable && item.id !== 'turbinar' && <div className="text-[12px] mt-1 font-bold" style={{ color: '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>Créditos insuficientes</div>}
               </button>
               {item.id === 'turbinar' && (
                 <button
                   type="button"
                   aria-label="Ver características especiais"
                   onClick={() => { setSelPlayerId(null); setVariantPage(0); setTurbinarView('catalog'); setActive('turbinar'); }}
                   className="absolute bottom-3 right-3 flex h-7 items-center justify-center rounded-full px-2.5 text-[12px] font-black tracking-wider transition-transform hover:scale-105 active:scale-95"
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
        {active === 'playerPacks' && pendingUniquePack && (
          <div
            className="fixed inset-0 z-[60]"
          >
            <UniquePackOpening
              card={pendingUniquePack}
              rarity="unique"
              onClose={close}
              onClaim={() => { claimUniquePack(); close(); }}
            />
          </div>
        )}
        {active === 'playerPacks' && pendingPackReveal && (
          <div className="fixed inset-0 z-[60]">
            <UniquePackOpening
              card={pendingPackReveal.card}
              rarity={pendingPackReveal.kind}
              onClose={close}
              onClaim={() => { claimPlayerPack(); close(); }}
            />
          </div>
        )}
      </>

      {/* ── Modals ── */}
      <>
        {active && !pendingUniquePack && !pendingPackReveal && (
          <GameModal
            open
            onOpenChange={next => { if (!next) close(); }}
            size="wide"
            className="flex max-h-[90vh] flex-col"
            title={
              <>
                {ITEMS.find(i => i.id === active)?.icon && `${ITEMS.find(i => i.id === active)?.icon} `}{ITEMS.find(i => i.id === active)?.name}
              </>
            }
          >
                {/* 📦 PACOTES DE JOGADOR — raridade, oferta da rodada e abertura */}
                {active === 'playerPacks' && !pendingPack && (() => {
                  const selectedCards = selectedPackRarity === 'unique'
                    ? uniquePackCards
                    : selectedPackRarity
                      ? (regularPackCards[selectedPackRarity] ?? [])
                      : [];
                  const availableCards = selectedCards.filter(card => !ownedIds.includes(card.id));
                  const selectedCost = selectedPackRarity ? playerPackCost(selectedPackRarity) : 0;
                  const selectedAffordable = points >= selectedCost;
                  return (
                    <div>
                      {!selectedPackRarity ? (
                        <>
                          <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
                            Escolha a raridade do pacote. Cada oferta mostra <b style={{ color: '#FFF' }}>4 cartas</b> que ficam disponíveis durante toda a rodada e mudam na próxima.
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {PLAYER_PACK_RARITIES.map(rarity => {
                              const meta = PLAYER_PACK_META[rarity];
                              const cards = rarity === 'unique' ? uniquePackCards : (regularPackCards[rarity] ?? []);
                              const available = cards.filter(card => !ownedIds.includes(card.id)).length;
                              return (
                                <button
                                  key={rarity}
                                  type="button"
                                  onClick={() => setSelectedPackRarity(rarity)}
                                  className="flex h-full flex-col rounded-xl p-4 text-left transition-all hover:brightness-110 active:scale-[0.99]"
                                  style={{ background: '#07070f', border: `1px solid ${meta.color}66` }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-lg font-black" style={{ color: meta.color, fontFamily: 'Bebas Neue, sans-serif' }}>PACOTE {meta.label}</span>
                                    <span className="text-sm font-black whitespace-nowrap" style={{ color: meta.color, fontFamily: 'Rajdhani, sans-serif' }}>{playerPackCost(rarity)}</span>
                                  </div>
                                  <div className="mt-1.5 min-h-[2.75rem] text-sm leading-snug" style={{ color: '#A9A9BA', fontFamily: 'Rajdhani, sans-serif' }}>{meta.description}</div>
                                  <div className="mt-auto pt-1.5 text-xs font-bold" style={{ color: '#CFCFE0', fontFamily: 'Rajdhani, sans-serif' }}>{cards.length}/4 cartas na oferta · {available} disponíveis</div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-2xl font-black" style={{ color: PLAYER_PACK_META[selectedPackRarity].color, fontFamily: 'Bebas Neue, sans-serif' }}>PACOTE {PLAYER_PACK_META[selectedPackRarity].label}</div>
                              <div className="text-sm" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Oferta da rodada · 4 cartas · uma será revelada</div>
                            </div>
                          </div>
                          {selectedCards.length > 0 ? (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-5 justify-items-center sm:grid-cols-4 sm:gap-x-4">
                              {selectedCards.map(card => {
                                const owned = ownedIds.includes(card.id);
                                return (
                                  <div key={card.id} className="flex min-w-0 flex-col items-center gap-1.5">
                                    <div className={owned ? 'opacity-55' : ''}>
                                      <PlayerCard player={card} lite scale={0.82} />
                                    </div>
                                    <span className="text-center text-xs font-black px-2.5 py-1 rounded-full tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif', background: owned ? '#22C55E22' : '#1A1A2A', color: owned ? '#86EFAC' : '#CFCFE0', border: `1px solid ${owned ? '#22C55E55' : '#2A2A3A'}` }}>
                                      {owned ? 'JÁ POSSUI' : 'DISPONÍVEL'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl px-4 py-8 text-center text-xs font-bold" style={{ background: '#07070f', border: '1px dashed #2A2A3A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                              Nenhuma carta disponível nesta oferta.
                            </div>
                          )}
                          <div className="mt-4 text-center">
                            {(availableCards.length === 0 || !selectedAffordable) && (
                              <p className="mb-3 text-xs" style={{ color: '#FCA5A5', fontFamily: 'Rajdhani, sans-serif' }}>
                                {availableCards.length === 0
                                  ? 'Você já possui as cartas disponíveis desta oferta.'
                                  : `Faltam ${selectedCost - points} créditos para abrir este pacote.`}
                              </p>
                            )}
                            <button
                              type="button"
                              disabled={!selectedAffordable || availableCards.length === 0}
                              onClick={() => openRarityPack(selectedPackRarity)}
                              className="w-full rounded-xl px-4 py-3 text-sm font-black tracking-widest transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                              style={{ background: PLAYER_PACK_META[selectedPackRarity].color, color: '#0A0A14', fontFamily: 'Bebas Neue, sans-serif' }}
                            >
                              ABRIR PACOTE · 💰 {selectedCost}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedPackRarity(null)}
                            className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-black tracking-wide transition-colors hover:bg-white/[0.06]"
                            style={{ color: '#CFCFE0', background: '#0F0F1A', border: '1px solid #343449', fontFamily: 'Rajdhani, sans-serif' }}
                          >
                            ← VOLTAR ÀS RARIDADES
                          </button>
                        </>
                      )}
                      <div className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ background: '#F0C67412', border: '1px solid #F0C67433', color: '#CFCFE0', fontFamily: 'Rajdhani, sans-serif' }}>
                        A carta revelada entra no banco e não altera seus titulares. Jogadores adquiridos continuam marcados na oferta até a próxima rodada.
                      </div>
                    </div>
                  );
                })()}

                {/* TROCAR TÉCNICO */}
                {active === 'coach' && (
                  <div className="space-y-2">
                    <p className="text-xs mb-3" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>Escolha o novo técnico (−{SHOP_COSTS.changeCoach} créditos):</p>
                    {COACHES.filter(c => c.id !== team.coachId).map(c => (
                      <button key={c.id} onClick={() => askConfirm('Trocar Técnico', `Trocar o comandante para ${c.name} por 💰 ${SHOP_COSTS.changeCoach}?`, () => { buyCoach(c.id); close(); })}
                        className="w-full text-left rounded-lg p-3 flex items-center gap-3 transition-all hover:border-primary/60 active:scale-[0.99]"
                        style={{ background: '#07070f', border: '1px solid #1A1A2A' }}>
                        {c.photoUrl && <img src={c.photoUrl} alt={c.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" style={{ objectPosition: 'center top', border: '1px solid #C9A84C44' }} />}
                        <div className="min-w-0">
                          <div className="text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{c.name}</div>
                          <div className="text-[13px] font-bold" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>{c.philosophy}</div>
                          <div className="text-[12px] mt-0.5 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{c.effect}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* PACOTES — escolha do pacote JÁ PAGO */}
                {(active === 'playerPacks' || active === 'scout') && pendingPack && (
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
                            <div className="text-[12px] font-black tracking-widest mb-2" style={{ color: g.c, fontFamily: 'Rajdhani, sans-serif' }}>{g.t}</div>
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
                      <p className="text-[12px] mt-2" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>Uma característica por carta — as <b style={{ color: '#F0E6C0' }}>Únicas</b> podem ter <b>duas</b>. Quem já atingiu o limite fica desabilitado.</p>
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
                            <div className="text-[12px] font-black tracking-widest mb-2" style={{ color: g.c, fontFamily: 'Rajdhani, sans-serif' }}>{g.t}</div>
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
                                            className="text-[12px] font-black px-2 py-0.5 rounded-full transition-transform hover:scale-[1.08] active:scale-95"
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

          </GameModal>
        )}
      </>

      {/* 🛒 Confirmação de compra (premium) — acima do modal do item */}
      <>
        {confirmCfg && (
          <GameModal
            open
            onOpenChange={next => { if (!next) setConfirmCfg(null); }}
            stacked
            className="max-w-sm border-[var(--ui-brand)]"
            bodyClassName="text-center"
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
          </GameModal>
        )}
      </>
    </div>
  );
}
