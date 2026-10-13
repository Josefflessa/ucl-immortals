// Opening album packs and envelopes, one after another: tear the pack (or break the envelope's
// seal), the stickers turn over one by one marked NOVA or REPETIDA, and a completed page shows
// what it unlocked. The server draws the stickers when the pack is torn.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen, Check, Copy, Sparkles } from 'lucide-react';
import { parseItemKey, type AlbumItemKey } from '@shared/game/album';
import { getCrest } from '@shared/game/crests';
import { Button } from '../../design-system';
import PlayerCard from '../game/PlayerCard';
import { PackFront } from '../game/UniquePackOpening';
import AlbumPackArt, { ALBUM_PACK_ASPECT, ALBUM_PACK_TEAR_AT } from './AlbumPackArt';
import { ClubCover, ClubFrameRing } from '../account/ClubRewards';
import { useAlbum, type OpenResult, type PageReward } from '../../contexts/AlbumContext';
import { albumCard, CATALOG, groupKeys, itemColor, itemLabel, RARITY_LABEL } from './albumData';
import { ItemArt } from './AlbumPieces';

type Stage = 'sealed' | 'tearing' | 'revealed';

const FONT = { fontFamily: 'var(--font-game), sans-serif' };
const MUTED = '#9693A5';
const PACK_HEIGHT = 'min(52vh, 460px)';
const PACK_BOX = { height: PACK_HEIGHT, width: `calc(${PACK_HEIGHT} * ${ALBUM_PACK_ASPECT})` };
const TEAR_MS = 900;

function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 720);
  useEffect(() => {
    const update = () => setNarrow(window.innerWidth < 720);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return narrow;
}

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

function RevealedCard({ id, isNew, index, scale }: { id: string; isNew: boolean; index: number; scale: number }) {
  const card = albumCard(id);
  const sticker = CATALOG.stickers.get(id);
  if (!card) return null;
  const tagColor = isNew ? '#7BD88F' : '#E9C46A';
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0, y: 12 }}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      transition={{ duration: .55, delay: .15 + index * .32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center"
      style={{ perspective: 1000 }}
    >
      <div className="relative">
        <PlayerCard player={card} lite scale={scale} showAlbumLevel />
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: .5 + index * .32, type: 'spring', stiffness: 420, damping: 18 }}
          className="absolute left-1/2 top-0 z-[5] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-[0.12em] text-[#0B0C12] shadow-lg"
          style={{ background: tagColor, ...FONT }}
        >
          {isNew ? <Sparkles size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
          {isNew ? 'NOVA' : 'REPETIDA'}
        </motion.span>
      </div>
      <div className="mt-1.5 text-center text-xs font-semibold leading-tight text-white/65" style={{ ...FONT, maxWidth: Math.max(200 * scale, 84) }}>
        Nº {sticker?.number ?? '—'} · {RARITY_LABEL[card.rarity]}
      </div>
    </motion.div>
  );
}

/** The envelope: tap to break the seal. */
function EnvelopeFront({ itemKey, opening, onOpen }: { itemKey: AlbumItemKey; opening: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} disabled={opening} className="group relative flex flex-col items-center outline-none" aria-label="Abrir envelope">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-[30%] -z-[1] rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${itemColor(itemKey)}44 0%, transparent 70%)` }} />
      <motion.div
        animate={opening ? { scale: [1, 1.06, .2], opacity: [1, 1, 0], rotate: [0, -2, 6] } : { scale: [1, 1.015, 1] }}
        transition={opening ? { duration: .7, ease: 'easeIn' } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ItemArt itemKey={itemKey} height={300} />
      </motion.div>
    </button>
  );
}

export default function AlbumPackOpening({ items, onClose }: { items: readonly AlbumItemKey[]; onClose: () => void }) {
  const { open } = useAlbum();
  const narrow = useNarrow();
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('sealed');
  const [result, setResult] = useState<OpenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cutProgress, setCutProgress] = useState(0);
  const [cutStartX, setCutStartX] = useState<number | null>(null);
  const packRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);

  const itemKey = items[index];
  const parsed = itemKey ? parseItemKey(itemKey) : null;
  const accent = itemKey ? itemColor(itemKey) : '#C9A84C';
  const remaining = items.length - index - 1;

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  // Esc closes (the stickers already drawn stay in the album).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && stage !== 'tearing') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, stage]);

  /** Tears the pack: asks the server for the stickers while the tear plays. */
  const startOpening = () => {
    if (stage !== 'sealed' || !itemKey) return;
    setStage('tearing');
    setCutProgress(100);
    setCutStartX(null);
    setError(null);
    const minDelay = new Promise(resolve => { timer.current = window.setTimeout(resolve, TEAR_MS); });
    Promise.all([open(itemKey), minDelay])
      .then(([opened]) => { setResult(opened); setStage('revealed'); })
      .catch(cause => {
        setError(cause instanceof Error ? cause.message : 'Não foi possível abrir agora.');
        setCutProgress(0);
        setStage('sealed');
      });
  };

  const next = () => {
    setIndex(value => value + 1);
    setResult(null);
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
  const cards = result?.cards ?? [];
  const newCount = cards.filter(card => card.isNew).length;
  // Three per row on phones (two rows for a pack), even at 360px.
  const cardScale = narrow ? (cards.length > 2 ? (window.innerWidth < 400 ? .46 : .5) : .62) : .74;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Abrindo ${itemLabel(itemKey)}`}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden text-white"
      style={{ background: 'radial-gradient(circle at 50% 40%, #181827 0%, #090A12 50%, #05060B 100%)' }}
    >
      <header className="flex shrink-0 items-center gap-2 px-4 py-3 sm:gap-3 sm:px-8 sm:py-5">
        <div className="min-w-0 whitespace-nowrap text-sm font-bold tracking-[0.12em] sm:text-base sm:tracking-[0.2em]" style={{ color: accent, ...FONT }}>
          {itemLabel(itemKey).toUpperCase()}
          {items.length > 1 ? <span className="ml-2 text-white/45">{index + 1}/{items.length}</span> : null}
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
                {parsed.kind === 'pack' ? '5 cartas para o seu álbum.' : '2 cartas para o seu álbum.'}
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
          ) : (
            <motion.section key={`revealed-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-full max-w-[1000px] shrink-0 flex-col items-center">
              <div className="mb-4 w-full max-w-[26rem] px-2 text-center sm:mb-6">
                <div className="mx-auto max-w-full break-words text-sm font-bold leading-snug tracking-[0.1em] sm:text-base sm:tracking-[0.18em]" style={{ color: accent, ...FONT }}>
                  {newCount > 0 ? `${newCount} CARTA${newCount > 1 ? 'S' : ''} NOVA${newCount > 1 ? 'S' : ''} PARA O ÁLBUM` : 'TODAS REPETIDAS'}
                </div>
                <p className="mx-auto mt-2 max-w-[26rem] text-sm leading-relaxed" style={{ color: MUTED, ...FONT }}>
                  {cards.length - newCount > 0 ? 'As cartas repetidas ficam guardadas: use uma para subir o nível ou venda por moedas.' : 'Já adicionadas ao seu álbum.'}
                </p>
              </div>
              {/* Keep the wrapped rows' full height so flex shrinking cannot move the buttons over the last card. */}
              <div className="flex w-full shrink-0 flex-wrap items-start justify-center gap-x-3 gap-y-6 sm:gap-x-5">
                {cards.map((card, i) => <RevealedCard key={`${card.id}-${i}`} id={card.id} isNew={card.isNew} index={i} scale={cardScale} />)}
              </div>
              {result && result.pageRewards.length > 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .4 + cards.length * .32 }} className="mt-8 flex w-full max-w-[520px] shrink-0 flex-col gap-3">
                  {result.pageRewards.map(reward => <PageRewardCard key={reward.pageId} reward={reward} />)}
                </motion.div>
              ) : null}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      {stage === 'revealed' ? (
        <footer className="z-10 shrink-0 border-t border-white/10 bg-[#080911]/95 px-3 pt-3 backdrop-blur sm:px-8 sm:pt-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex w-full max-w-[420px] flex-col gap-2.5">
            {remaining > 0 ? (
              <Button intent="primary" size="large" onClick={next} className="flex w-full items-center justify-center gap-2">
                Abrir próximo <span className="opacity-70">({remaining})</span> <ArrowRight size={17} aria-hidden="true" />
              </Button>
            ) : null}
            <Button intent={remaining > 0 ? 'ghost' : 'primary'} size={remaining > 0 ? 'default' : 'large'} onClick={onClose} className="w-full">
              {remaining > 0 ? 'Guardar o resto' : 'Concluir'}
            </Button>
          </div>
        </footer>
      ) : null}
    </div>,
    document.body,
  );
}
