import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Image as ImageIcon, Sparkles, Type } from 'lucide-react';
import { AVATAR_FRAMES } from '@shared/game/events';
import { NAME_STYLES } from '@shared/game/nameStyles';
import { PROFILE_COVER_PRESETS } from '@shared/profileCovers';
import { useAccount } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { Button, GameModal, StatusBanner, Tab, TabList, TabPanel, Tabs } from '../../design-system';
import { CoinAmount } from '../album/AlbumPieces';
import { FrameImage } from '../account/AvatarFrame';
import GalleryPagination from '../account/GalleryPagination';
import StyledName from '../account/StyledName';

const SHOP_FRAMES = AVATAR_FRAMES.filter(frame => frame.shopPrice !== undefined);
const SHOP_COVERS = PROFILE_COVER_PRESETS.filter(cover => cover.shopPrice !== undefined);
const SHOP_NAME_STYLES = NAME_STYLES.filter(style => style.shopPrice !== undefined);
/** Four columns from 1280px: a page of 8 fills two whole rows (a page of 6 left two empty places). */
function usePerPage(): number {
  const query = '(min-width: 1280px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide ? 8 : 6;
}
type ConfirmingItem = { kind: 'frame' | 'cover' | 'name-style'; key: string };

export default function AppearanceShop() {
  const perPage = usePerPage();
  const { account, getEvents, peekEvents, updateProfile } = useAccount();
  const { album, buyFrame, buyCover, buyNameStyle } = useAlbum();
  // What the account read last (see AccountContext): the shop opens with it, refreshed in the background, instead of a skeleton.
  const [ownedFrames, setOwnedFrames] = useState<string[] | null>(() => peekEvents()?.frames ?? null);
  const [ownedNameStyles, setOwnedNameStyles] = useState<string[] | null>(() => { const cached = peekEvents(); return cached ? cached.nameStyles ?? [] : null; });
  const [appearanceLoadError, setAppearanceLoadError] = useState('');
  const [confirming, setConfirming] = useState<ConfirmingItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [pages, setPages] = useState({ frames: 0, covers: 0, fonts: 0 });
  useEffect(() => {
    const last = (total: number) => Math.max(0, Math.ceil(total / perPage) - 1);
    setPages(current => ({ frames: Math.min(current.frames, last(SHOP_FRAMES.length)), covers: Math.min(current.covers, last(SHOP_COVERS.length)), fonts: Math.min(current.fonts, last(SHOP_NAME_STYLES.length)) }));
  }, [perPage]);
  const confirmingFrame = confirming?.kind === 'frame' ? SHOP_FRAMES.find(frame => frame.key === confirming.key) ?? null : null;
  const confirmingCover = confirming?.kind === 'cover' ? SHOP_COVERS.find(cover => cover.key === confirming.key) ?? null : null;
  const confirmingNameStyle = confirming?.kind === 'name-style' ? SHOP_NAME_STYLES.find(style => style.key === confirming.key) ?? null : null;
  const confirmingItem = confirmingFrame ?? confirmingCover ?? confirmingNameStyle;
  useEffect(() => {
    let active = true;
    void getEvents().then(result => {
      if (active) {
        setOwnedFrames(result.frames);
        setOwnedNameStyles(result.nameStyles ?? []);
        setAppearanceLoadError('');
      }
    }).catch(cause => {
      if (active) setAppearanceLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar os itens de aparência.');
    });
    return () => { active = false; };
  }, [getEvents]);

  const purchase = async () => {
    if (!confirmingItem || !confirming) return;
    setBusy(confirmingItem.key);
    try {
      if (confirming.kind === 'frame') {
        await buyFrame(confirmingItem.key);
        const purchasedKey = confirmingItem.key;
        setOwnedFrames(current => current?.includes(purchasedKey) ? current : [...(current ?? []), purchasedKey]);
        try {
          const result = await getEvents(true);
          setOwnedFrames(result.frames);
        } catch {
          // Keep the optimistic ownership update if refreshing the inventory fails.
        }
      } else if (confirming.kind === 'cover') {
        await buyCover(confirmingItem.key);
      } else {
        await buyNameStyle(confirmingItem.key);
        const purchasedKey = confirmingItem.key;
        setOwnedNameStyles(current => current?.includes(purchasedKey) ? current : [...(current ?? []), purchasedKey]);
        void getEvents().then(result => {
          setOwnedFrames(result.frames);
          setOwnedNameStyles(result.nameStyles ?? []);
        }).catch(() => undefined);
      }
      setConfirming(null);
      toast.success(`${confirmingItem.name} adicionada à sua coleção.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível concluir a compra.');
    } finally {
      setBusy(null);
    }
  };

  const equip = async (frameKey: string) => {
    if (equipping) return;
    setEquipping(frameKey);
    try {
      await updateProfile({ avatarFrameKey: frameKey });
      toast.success('Moldura aplicada ao perfil.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível aplicar a moldura.');
    } finally {
      setEquipping(null);
    }
  };

  const equipCover = async (coverKey: string) => {
    if (equipping) return;
    setEquipping(coverKey);
    try {
      await updateProfile({ coverKey });
      toast.success('Fundo aplicado ao perfil.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível aplicar o fundo.');
    } finally {
      setEquipping(null);
    }
  };

  const equipNameStyle = async (styleKey: string | null) => {
    if (equipping) return;
    const key = styleKey ?? 'default-font';
    setEquipping(key);
    try {
      await updateProfile({ nameStyleKey: styleKey });
      toast.success(styleKey ? 'Fonte aplicada ao nome.' : 'Fonte padrão aplicada.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Não foi possível aplicar esta fonte.');
    } finally {
      setEquipping(null);
    }
  };

  return (
    <Tabs defaultValue="frames">
      <TabList aria-label="Tipos de aparência" className="ui-tabs--equal">
        <Tab value="frames" className="inline-flex items-center justify-center gap-2"><Sparkles size={15} aria-hidden="true" /> Molduras</Tab>
        <Tab value="covers" className="inline-flex items-center justify-center gap-2"><ImageIcon size={15} aria-hidden="true" /> Fundos</Tab>
        <Tab value="fonts" className="inline-flex items-center justify-center gap-2"><Type size={15} aria-hidden="true" /> Fontes</Tab>
      </TabList>

      <TabPanel value="frames" className="pt-4">
        {appearanceLoadError ? <StatusBanner tone="danger" title="Não foi possível carregar os itens de aparência">{appearanceLoadError}</StatusBanner> : null}
        {ownedFrames === null && !appearanceLoadError ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" aria-label="Carregando molduras">
            {SHOP_FRAMES.slice(pages.frames * perPage, (pages.frames + 1) * perPage).map(frame => <div key={frame.key} className="h-44 animate-pulse rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] sm:h-48" />)}
          </div>
        ) : ownedFrames ? (
          <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-3 xl:grid-cols-4">
            {SHOP_FRAMES.slice(pages.frames * perPage, (pages.frames + 1) * perPage).map(frame => {
              const price = frame.shopPrice!;
              const owned = ownedFrames.includes(frame.key);
              const equipped = account?.avatarFrameKey === frame.key;
              const canAfford = (album?.coins ?? 0) >= price;
              return (
                <article key={frame.key} className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-[var(--ui-surface-1)]" style={{ borderColor: `color-mix(in srgb, ${frame.color} 36%, var(--ui-line-subtle))` }}>
                  <div className="relative grid h-32 place-items-center overflow-hidden sm:h-36" style={{ background: `radial-gradient(ellipse at center, ${frame.color}20, transparent 70%)` }}>
                    <FrameImage frameKey={frame.key} className="size-28 sm:size-32" />
                    {equipped ? <span className="absolute right-1.5 top-1.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: frame.color, borderColor: `${frame.color}55`, backgroundColor: 'var(--ui-surface-1)' }}>Em uso</span> : null}
                  </div>
                  <div className="flex flex-1 flex-col border-t border-[var(--ui-line-subtle)] p-2.5 sm:p-3">
                    <div className="flex min-h-9 items-start justify-between gap-1.5">
                      <h3 className="min-w-0 break-words font-display text-sm leading-tight text-[var(--ui-text)] sm:text-base">{frame.name}</h3>
                    </div>
                    <div className="mt-auto pt-2">
                      {owned ? (
                        <Button type="button" intent={equipped ? 'ghost' : 'secondary'} disabled={equipped || equipping !== null} loading={equipping === frame.key} onClick={() => void equip(frame.key)} className="w-full px-2 text-xs">
                          {equipped ? <><Check size={14} aria-hidden="true" /> Em uso</> : 'Equipar'}
                        </Button>
                      ) : (
                        <Button type="button" intent="primary" disabled={!canAfford || busy !== null || ownedFrames === null} onClick={() => setConfirming({ kind: 'frame', key: frame.key })} className="w-full px-2 text-xs">
                          <span className="flex w-full items-center justify-between gap-1.5"><span>Comprar</span><CoinAmount value={price} size={13} className="text-inherit" /></span>
                        </Button>
                      )}
                      {!owned && !canAfford ? <p className="mt-1 text-center text-[9px] leading-tight text-[var(--ui-text-muted)]">Faltam {(price - (album?.coins ?? 0)).toLocaleString('pt-BR')} moedas</p> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {ownedFrames !== null ? <GalleryPagination page={pages.frames} pageCount={Math.ceil(SHOP_FRAMES.length / perPage)} label="Paginação das molduras da loja" onPageChange={page => setPages(current => ({ ...current, frames: page }))} /> : null}
      </TabPanel>
      <TabPanel value="covers" className="pt-4">
        <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-3 xl:grid-cols-4">
          {SHOP_COVERS.slice(pages.covers * perPage, (pages.covers + 1) * perPage).map(cover => {
            const price = cover.shopPrice!;
            const owned = album?.covers.includes(cover.key) ?? false;
            const equipped = account?.coverKey === cover.key && !account.coverUrl;
            const canAfford = (album?.coins ?? 0) >= price;
            return (
              <article key={cover.key} className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)]">
                <div className="relative aspect-[3/2] overflow-hidden bg-[var(--ui-surface-2)]">
                  <img src={cover.src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                  {equipped ? <span className="absolute right-1.5 top-1.5 rounded-full border border-white/20 bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">Em uso</span> : null}
                </div>
                <div className="flex flex-1 flex-col border-t border-[var(--ui-line-subtle)] p-2.5 sm:p-3">
                  <h3 className="min-h-9 break-words font-display text-sm leading-tight text-[var(--ui-text)] sm:text-base">{cover.name}</h3>
                  <div className="mt-auto pt-2">
                    {owned ? (
                      <Button type="button" intent={equipped ? 'ghost' : 'secondary'} disabled={equipped || equipping !== null} loading={equipping === cover.key} onClick={() => void equipCover(cover.key)} className="w-full px-2 text-xs">
                        {equipped ? <><Check size={14} aria-hidden="true" /> Em uso</> : 'Equipar'}
                      </Button>
                    ) : (
                      <Button type="button" intent="primary" disabled={!canAfford || busy !== null} onClick={() => setConfirming({ kind: 'cover', key: cover.key })} className="w-full px-2 text-xs">
                        <span className="flex w-full items-center justify-between gap-1.5"><span>Comprar</span><CoinAmount value={price} size={13} className="text-inherit" /></span>
                      </Button>
                    )}
                    {!owned && !canAfford ? <p className="mt-1 text-center text-[9px] leading-tight text-[var(--ui-text-muted)]">Faltam {(price - (album?.coins ?? 0)).toLocaleString('pt-BR')} moedas</p> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <GalleryPagination page={pages.covers} pageCount={Math.ceil(SHOP_COVERS.length / perPage)} label="Paginação dos fundos da loja" onPageChange={page => setPages(current => ({ ...current, covers: page }))} />
      </TabPanel>
      <TabPanel value="fonts" className="pt-4">
        {appearanceLoadError ? <StatusBanner tone="danger" title="Não foi possível carregar suas fontes">{appearanceLoadError}</StatusBanner> : null}
        {ownedNameStyles === null && !appearanceLoadError ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" aria-label="Carregando fontes">
            {SHOP_NAME_STYLES.slice(pages.fonts * perPage, (pages.fonts + 1) * perPage).map(style => <div key={style.key} className="h-40 animate-pulse rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)]" />)}
          </div>
        ) : ownedNameStyles ? (
          <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-3 xl:grid-cols-4">
            {SHOP_NAME_STYLES.slice(pages.fonts * perPage, (pages.fonts + 1) * perPage).map(style => {
              const price = style.shopPrice!;
              const owned = ownedNameStyles.includes(style.key);
              const equipped = account?.nameStyleKey === style.key;
              const canAfford = (album?.coins ?? 0) >= price;
              return (
                <article key={style.key} className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)]">
                  <div className="relative grid min-h-24 place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(233,196,106,.11),transparent_72%)] px-2">
                    <StyledName name="Seu nome" styleKey={style.key} className="font-shop-preview max-w-full" />
                    {equipped ? <span className="absolute right-1.5 top-1.5 rounded-full border border-white/20 bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">Em uso</span> : null}
                  </div>
                  <div className="flex flex-1 flex-col border-t border-[var(--ui-line-subtle)] p-2.5 sm:p-3">
                    <h3 className="min-h-9 break-words font-display text-sm leading-tight text-[var(--ui-text)] sm:text-base">{style.name}</h3>
                    <div className="mt-auto">
                      {owned ? (
                        <Button type="button" intent={equipped ? 'ghost' : 'secondary'} disabled={equipped || equipping !== null} loading={equipping === style.key} onClick={() => void equipNameStyle(style.key)} className="w-full px-2 text-xs">
                          {equipped ? <><Check size={14} aria-hidden="true" /> Em uso</> : 'Equipar'}
                        </Button>
                      ) : (
                        <Button type="button" intent="primary" disabled={!canAfford || busy !== null || ownedNameStyles === null} onClick={() => setConfirming({ kind: 'name-style', key: style.key })} className="w-full px-2 text-xs">
                          <span className="flex w-full items-center justify-between gap-1.5"><span>Comprar</span><CoinAmount value={price} size={13} className="text-inherit" /></span>
                        </Button>
                      )}
                      {!owned && !canAfford ? <p className="mt-1 text-center text-[9px] leading-tight text-[var(--ui-text-muted)]">Faltam {(price - (album?.coins ?? 0)).toLocaleString('pt-BR')} moedas</p> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {ownedNameStyles !== null ? <GalleryPagination page={pages.fonts} pageCount={Math.ceil(SHOP_NAME_STYLES.length / perPage)} label="Paginação das fontes da loja" onPageChange={page => setPages(current => ({ ...current, fonts: page }))} /> : null}
      </TabPanel>

      <GameModal
        open={confirmingItem !== null}
        onOpenChange={open => { if (!open && busy === null) setConfirming(null); }}
        title={confirmingItem ? `Comprar ${confirmingItem.name}?` : 'Confirmar compra'}
        subtitle={confirming?.kind === 'cover' ? 'O fundo ficará disponível no seu perfil.' : confirming?.kind === 'name-style' ? 'A fonte ficará disponível para personalizar seu nome.' : 'A moldura ficará disponível no seu perfil.'}
        closeLabel="Cancelar compra"
        footer={confirmingItem ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" intent="ghost" disabled={busy !== null} onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button type="button" intent="primary" className="w-full sm:w-auto" disabled={busy !== null || (album?.coins ?? 0) < confirmingItem.shopPrice!} loading={busy === confirmingItem.key} onClick={() => void purchase()}>
              <span>Confirmar compra</span><CoinAmount value={confirmingItem.shopPrice!} size={14} className="text-inherit" />
            </Button>
          </div>
        ) : undefined}
      >
        {confirmingItem ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            {confirmingFrame ? (
              <div className="grid size-28 place-items-center rounded-full" style={{ background: `radial-gradient(circle, ${confirmingFrame.color}25, transparent 72%)` }}>
                <FrameImage frameKey={confirmingFrame.key} className="size-full" />
              </div>
            ) : confirmingCover ? <img src={confirmingCover.src} alt="" className="aspect-[3/2] w-full max-w-sm rounded-xl object-cover" /> : confirmingNameStyle ? <div className="grid min-h-24 w-full place-items-center rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)]"><StyledName name="Seu nome" styleKey={confirmingNameStyle.key} className="font-shop-preview" /></div> : null}
            <p className="text-sm text-[var(--ui-text-soft)]">
              Comprar {confirming?.kind === 'cover' ? 'este fundo' : confirming?.kind === 'name-style' ? 'esta fonte' : 'esta moldura'} por <strong className="inline-flex items-center gap-1 text-[var(--ui-text)]"><CoinAmount value={confirmingItem.shopPrice!} size={14} /></strong> moedas?
            </p>
            <p className="text-xs text-[var(--ui-text-muted)]">Saldo após a compra: <CoinAmount value={Math.max(0, (album?.coins ?? 0) - confirmingItem.shopPrice!)} size={13} /> moedas.</p>
          </div>
        ) : null}
      </GameModal>
    </Tabs>
  );
}
