// Opening album packs and envelopes, one after another: tear the pack (or break the envelope's
// seal), the stickers turn over one by one marked NOVA or REPETIDA, and a completed page shows
// what it unlocked. The server draws the stickers when the pack is torn.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, Copy, Package, Sparkles } from 'lucide-react';
import { ENVELOPE_SIZE, PACK_SIZE, parseItemKey, type AlbumItemKey } from '@shared/game/album';
import { getRarityColor, type Rarity } from '@shared/game/gameData';
import { getCrest } from '@shared/game/crests';
import BannerGachaReveal from '../store/gacha/BannerGachaReveal';
import { playSound } from '../../audio/uiSound';
import { useMusicDuck } from '../../audio/musicPlayer';
import { PackFront } from '../game/UniquePackOpening';
import AlbumPackArt, { ALBUM_PACK_ASPECT, ALBUM_PACK_TEAR_AT } from './AlbumPackArt';
import { ClubCover, ClubFrameRing } from '../account/ClubRewards';
import { useAlbum, type OpenResult, type PageReward } from '../../contexts/AlbumContext';
import { Button } from '../../design-system';
import { albumCard, CATALOG, groupKeys, itemColor, itemLabel, RARITY_LABEL } from './albumData';
import { ItemArt } from './AlbumPieces';
import PlayerPortrait from '../game/PlayerPortrait';

type Stage = 'sealed' | 'tearing' | 'revealed';

const FONT = { fontFamily: 'var(--font-game), sans-serif' };
const MUTED = '#9693A5';
const PACK_HEIGHT = 'min(52vh, 460px)';
const PACK_BOX = { height: PACK_HEIGHT, width: `calc(${PACK_HEIGHT} * ${ALBUM_PACK_ASPECT})` };
const TEAR_MS = 900;

/** What a completed page unlocked: a club's frame and cover, or packs. */
export function PageRewardCard({ reward }: { reward: PageReward }) {
  const page = CATALOG.pageById.get(reward.pageId);
  const clubId = page?.clubId ?? null;
  const title = page?.title ?? 'Página';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: .96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full overflow-hidden rounded-2xl border border-[#E9C46A]/40 bg-[#0E0F18]"
    >
      {clubId && reward.coverKey ? (
        <ClubCover clubId={clubId} className="h-28 sm:h-32">
          <div className="relative flex h-full items-center gap-4 px-5">
            <span className="relative block size-14 shrink-0 rounded-full bg-[#1A1B29]">
              {reward.frameKey ? <ClubFrameRing clubId={clubId} className="absolute" style={{ left: '-20%', top: '-20%', width: '140%', height: '140%' }} /> : null}
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold tracking-[0.2em] text-[#E9C46A]" style={FONT}>PÁGINA COMPLETA</div>
              <div className="font-display text-2xl leading-[1.05] text-white [overflow-wrap:anywhere]">{title}</div>
            </div>
          </div>
        </ClubCover>
      ) : (
        <div className="flex items-center gap-3 px-5 pt-4">
          {clubId && getCrest(clubId) ? <img src={getCrest(clubId)!.url} alt="" referrerPolicy="no-referrer" className="size-9 object-contain" /> : <BookOpen size={22} className="text-[#E9C46A]" aria-hidden="true" />}
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.2em] text-[#E9C46A]" style={FONT}>{reward.recompleted ? 'PÁGINA COMPLETA DE NOVO' : 'PÁGINA COMPLETA'}</div>
            <div className="font-display text-2xl leading-[1.05] text-white [overflow-wrap:anywhere]">{title}</div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm text-white/85">
        {reward.frameKey ? <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-[#7BD88F]" aria-hidden="true" /> Moldura de perfil do clube</span> : null}
        {reward.coverKey ? <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-[#7BD88F]" aria-hidden="true" /> Fundo de perfil do clube</span> : null}
        {groupKeys(reward.items).map(([key, count]) => (
          <span key={key} className="inline-flex items-center gap-2">
            <ItemArt itemKey={key} height={30} />
            {count > 1 ? `${count}× ` : ''}{itemLabel(key)}
          </span>
        ))}
      </div>
      {reward.frameKey || reward.coverKey ? <p className="px-5 pb-4 text-xs text-white/55">Use no seu perfil em Conta → Aparência.</p> : null}
    </motion.div>
  );
}

/** The envelope: tap to break the seal. */
function EnvelopeFront({ itemKey, opening, onOpen }: { itemKey: AlbumItemKey; opening: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} disabled={opening} className="group relative flex flex-col items-center outline-none" aria-label="Abrir envelope">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-[40%] -z-[1] rounded-full" style={{ background: `radial-gradient(circle, ${itemColor(itemKey)}44 0%, transparent 70%)` }} />
      <motion.div
        animate={opening ? { scale: [1, 1.06, .2], opacity: [1, 1, 0], rotate: [0, -2, 6] } : { scale: [1, 1.015, 1] }}
        transition={opening ? { duration: .7, ease: 'easeIn' } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ItemArt itemKey={itemKey} height={300} />
      </motion.div>
    </button>
  );
}

const BULK_RARITY_ORDER: Record<Rarity, number> = { bronze: 0, silver: 1, gold: 2, legendary: 3, immortal: 4, unique: 5 };

function AlbumBulkOpenSummary({ itemKey, quantity, result, onClose }: { itemKey: AlbumItemKey; quantity: number; result: OpenResult; onClose: () => void }) {
  const grouped = new Map<string, { id: string; total: number; newCopies: number; repeatCopies: number }>();
  for (const draw of result.cards) {
    const row = grouped.get(draw.id) ?? { id: draw.id, total: 0, newCopies: 0, repeatCopies: 0 };
    row.total += 1;
    if (draw.isNew) row.newCopies += 1;
    else row.repeatCopies += 1;
    grouped.set(draw.id, row);
  }
  const cards = Array.from(grouped.values()).flatMap(row => {
    const player = albumCard(row.id);
    return player ? [{ ...row, player, number: CATALOG.stickers.get(row.id)?.number ?? 0 }] : [];
  }).sort((a, b) => BULK_RARITY_ORDER[b.player.rarity] - BULK_RARITY_ORDER[a.player.rarity]
    || b.newCopies - a.newCopies
    || b.total - a.total
    || a.number - b.number);
  const newCount = result.cards.filter(draw => draw.isNew).length;
  const repeatCount = result.cards.length - newCount;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Resultado da abertura em lote" className="fixed inset-0 z-[80] flex flex-col overflow-hidden text-white" style={{ background: 'radial-gradient(circle at 50% 0%, #191827 0%, #090A12 52%, #05060B 100%)' }}>
      <header className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-black tracking-[0.18em] text-[#E9C46A]" style={FONT}>ABERTURA EM LOTE</div>
            <h2 className="mt-1 truncate text-lg font-black text-white sm:text-xl" style={FONT}>{quantity}× {itemLabel(itemKey)}</h2>
          </div>
          <Package className="size-6 shrink-0 text-[#E9C46A]" aria-hidden="true" />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <section aria-label="Resumo da abertura" className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'CARTAS', value: result.cards.length, color: '#FFFFFF' },
              { label: 'NOVAS', value: newCount, color: '#7BD88F' },
              { label: 'REPETIDAS', value: repeatCount, color: '#E9C46A' },
            ].map(metric => (
              <div key={metric.label} className="min-w-0 rounded-xl border border-white/10 bg-white/[.04] px-2 py-3 text-center sm:px-4 sm:py-4">
                <div className="font-display text-2xl leading-none tabular-nums sm:text-3xl" style={{ color: metric.color }}>{metric.value.toLocaleString('pt-BR')}</div>
                <div className="mt-1.5 text-[9px] font-black tracking-[0.12em] text-white/55 sm:text-[11px]">{metric.label}</div>
              </div>
            ))}
          </section>

          <section aria-label="Cartas recebidas">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-black text-white sm:text-base" style={FONT}>Cartas recebidas</h3>
              <span className="text-xs tabular-nums text-white/55">{cards.length} {cards.length === 1 ? 'tipo' : 'tipos'}</span>
            </div>
            <div className="grid max-h-[min(52dvh,620px)] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {cards.map(({ id, player, number, total, newCopies, repeatCopies }) => {
                const color = getRarityColor(player.rarity);
                return (
                  <article key={id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-2.5 sm:p-3">
                    <PlayerPortrait playerId={id} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg border border-white/10 bg-black/30 object-cover" fallback={<span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-black text-white/50">{player.shortName.slice(0, 2)}</span>} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <strong className="min-w-0 break-words text-sm leading-snug text-white">{player.shortName}</strong>
                        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{RARITY_LABEL[player.rarity]}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-white/55">{player.club} · Nº {number}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {newCopies > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-[#7BD88F]/10 px-2 py-0.5 text-[10px] font-bold text-[#7BD88F]"><Sparkles size={10} aria-hidden="true" />{newCopies} {newCopies === 1 ? 'nova' : 'novas'}</span> : null}
                        {repeatCopies > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-[#E9C46A]/10 px-2 py-0.5 text-[10px] font-bold text-[#E9C46A]"><Copy size={10} aria-hidden="true" />{repeatCopies} {repeatCopies === 1 ? 'repetida' : 'repetidas'}</span> : null}
                        {total > 1 ? <span className="rounded-full bg-white/[.08] px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/55">×{total} no lote</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {result.pageRewards.length > 0 ? (
            <section aria-label="Páginas completadas" className="space-y-2">
              <h3 className="text-sm font-black text-white sm:text-base" style={FONT}>Páginas completadas · {result.pageRewards.length}</h3>
              {result.pageRewards.map(reward => {
                const page = CATALOG.pageById.get(reward.pageId);
                const rewards = [
                  ...(reward.frameKey ? ['Moldura de perfil'] : []),
                  ...(reward.coverKey ? ['Fundo de perfil'] : []),
                  ...groupKeys(reward.items).map(([key, count]) => `${count > 1 ? `${count}× ` : ''}${itemLabel(key)}`),
                ];
                return (
                  <div key={reward.pageId} className="flex min-w-0 items-start gap-2.5 rounded-lg border border-[#E9C46A]/20 bg-[#E9C46A]/[.05] p-3">
                    <BookOpen size={16} className="mt-0.5 shrink-0 text-[#E9C46A]" aria-hidden="true" />
                    <div className="min-w-0">
                      <strong className="block break-words text-xs text-white">{page?.title ?? 'Página do Álbum'}</strong>
                      <span className="mt-0.5 block break-words text-[11px] text-white/55">Recompensas: {rewards.length > 0 ? rewards.join(' · ') : 'página completada'}</span>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}
        </div>
      </main>

      <footer className="shrink-0 border-t border-white/10 bg-[#090A12]/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-8">
        <Button intent="primary" size="large" onClick={onClose} className="mx-auto w-full max-w-md">CONCLUIR</Button>
      </footer>
    </div>,
    document.body,
  );
}

export default function AlbumPackOpening({ items, onClose, bulk = false }: { items: readonly AlbumItemKey[]; onClose: () => void; bulk?: boolean }) {
  useMusicDuck();
  const { open } = useAlbum();
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('sealed');
  const [result, setResult] = useState<OpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cutProgress, setCutProgress] = useState(0);
  const [cutStartX, setCutStartX] = useState<number | null>(null);
  /** The staged reveal of the cards runs once per pack, on top of the summary screen. */
  const [staged, setStaged] = useState(false);
  const [bulkResult, setBulkResult] = useState<OpenResult | null>(null);
  const packRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);

  const isBulk = bulk && items.length > 1;
  const itemKey = isBulk ? items[0] : items[index];
  const parsed = itemKey ? parseItemKey(itemKey) : null;
  const accent = itemKey ? itemColor(itemKey) : '#C9A84C';
  const remaining = isBulk ? 0 : items.length - index - 1;

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  // Esc closes (the stickers already drawn stay in the album).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && stage !== 'tearing') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, stage]);

  /** True from the moment the tear starts: many pointer events can arrive before the state catches up, and each must not open another pack. */
  const opening = useRef(false);

  /** Tears the pack: asks the server for the stickers while the tear plays. */
  const startOpening = () => {
    if (opening.current || stage !== 'sealed' || !itemKey) return;
    opening.current = true;
    setStage('tearing');
    playSound('packTear');
    setCutProgress(100);
    setCutStartX(null);
    setError(null);
    const minDelay = new Promise(resolve => { timer.current = window.setTimeout(resolve, TEAR_MS); });
    Promise.all([open(itemKey, isBulk ? items.length : 1), minDelay])
      .then(([opened]) => {
        if (isBulk) {
          setStage('revealed');
          setBulkResult(opened);
          return;
        }
        setResult(opened);
        setStaged(true);
        setStage('revealed');
      })
      .catch(cause => {
        opening.current = false;
        setError(cause instanceof Error ? cause.message : 'Não foi possível abrir agora.');
        setCutProgress(0);
        setStage('sealed');
      });
  };

  const next = () => {
    opening.current = false;
    setIndex(value => value + 1);
    setResult(null);
    setStaged(false);
    setCutProgress(0);
    setStage('sealed');
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (stage !== 'sealed' || parsed?.kind !== 'pack') return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setCutStartX(event.clientX);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (stage !== 'sealed' || cutStartX === null) return;
    const distance = Math.max(0, event.clientX - cutStartX);
    const target = (packRef.current?.getBoundingClientRect().width ?? 240) * .82;
    const progress = Math.min(100, (distance / Math.max(1, target)) * 100);
    setCutProgress(progress);
    if (progress >= 100) startOpening();
  };
  const handlePointerUp = () => {
    if (stage !== 'sealed') return;
    if (cutProgress >= 96) startOpening();
    else { setCutStartX(null); setCutProgress(0); }
  };

  if (!itemKey || !parsed) return null;
  if (bulkResult && isBulk) return <AlbumBulkOpenSummary itemKey={itemKey} quantity={items.length} result={bulkResult} onClose={onClose} />;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isBulk ? `Abrindo ${items.length} ${itemLabel(itemKey)}` : `Abrindo ${itemLabel(itemKey)}`}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden text-white"
      style={{ background: 'radial-gradient(circle at 50% 40%, #181827 0%, #090A12 50%, #05060B 100%)' }}
    >
      <header className="flex shrink-0 items-center gap-2 px-4 py-3 sm:gap-3 sm:px-8 sm:py-5">
        <div className="min-w-0 whitespace-nowrap text-sm font-bold tracking-[0.12em] sm:text-base sm:tracking-[0.2em]" style={{ color: accent, ...FONT }}>
          {isBulk ? `${items.length}× ${itemLabel(itemKey).toUpperCase()}` : itemLabel(itemKey).toUpperCase()}
          {!isBulk && items.length > 1 ? <span className="ml-2 text-white/45">{index + 1}/{items.length}</span> : null}
        </div>
      </header>

      <main
        className={`flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 sm:px-4 ${stage === 'revealed' ? 'justify-start pb-6 pt-3' : 'justify-center py-8'}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <AnimatePresence mode="wait" initial={false}>
          {stage !== 'revealed' ? (
            <motion.section key={`sealed-${index}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="flex w-full flex-col items-center">
              <p className="mb-5 text-center text-xs" style={{ color: MUTED, ...FONT }}>
                {isBulk
                  ? `Serão adicionadas ${items.length * (parsed.kind === 'pack' ? PACK_SIZE : ENVELOPE_SIZE)} cartas de uma vez.`
                  : parsed.kind === 'pack' ? `${PACK_SIZE} cartas para o seu álbum.` : `${ENVELOPE_SIZE} cartas para o seu álbum.`}
              </p>
              {parsed.kind === 'pack' ? (
                <>
                  <motion.div
                    ref={packRef}
                    style={PACK_BOX}
                    animate={stage === 'tearing' ? { scale: [1, 1.018, .988, 1.006, 1], rotate: [0, -.35, .35, -.18, 0] } : { scale: 1, rotate: 0 }}
                    transition={stage === 'tearing' ? { duration: .64, ease: 'easeOut' } : { duration: .14 }}
                  >
                    <PackFront rarity={parsed.tier} art={<AlbumPackArt tier={parsed.tier} className="block h-full w-full" />} tearAt={ALBUM_PACK_TEAR_AT} cutProgress={cutProgress} isTearing={stage === 'tearing'} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
                  </motion.div>
                  <button type="button" onClick={startOpening} disabled={stage === 'tearing'} className="mt-5 text-[12px] font-bold tracking-[0.14em] text-[#7D7A8C] transition-colors hover:text-white disabled:opacity-40" style={FONT}>
                    ABRIR SEM ANIMAÇÃO
                  </button>
                </>
              ) : (
                <>
                  <EnvelopeFront itemKey={itemKey} opening={stage === 'tearing'} onOpen={startOpening} />
                  <p className="mt-6 text-[12px] font-bold tracking-[0.16em] text-[#7D7A8C]" style={FONT}>TOQUE NO ENVELOPE PARA ABRIR</p>
                </>
              )}
              {error ? <p role="alert" className="mt-4 max-w-sm text-center text-sm text-[#FF8A8A]">{error}</p> : null}
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>
      {staged && result ? (
        <BannerGachaReveal
          skipCharge
          onClose={onClose}
          summary={{
            primaryLabel: remaining > 0 ? `Abrir próximo (${remaining})` : 'Concluir',
            onPrimary: remaining > 0 ? next : onClose,
            secondaryLabel: remaining > 0 ? 'Guardar o resto' : undefined,
            onSecondary: remaining > 0 ? onClose : undefined,
            extra: result.pageRewards.length > 0 ? <div className="flex w-full max-w-[520px] flex-col gap-3">{result.pageRewards.map(reward => <PageRewardCard key={reward.pageId} reward={reward} />)}</div> : null,
          }}
          draws={{
            cards: result.cards.map(card => ({ card, rarity: albumCard(card.id)?.rarity ?? 'bronze', pityTriggered: false })),
            dayStart: '', price: 0, pageRewards: [],
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}
