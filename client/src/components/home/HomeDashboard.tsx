// UCL Immortals — home dashboard.
// Layout follows the hub pattern of card games (one featured action, the player's
// progress in cards, navigation fixed elsewhere): the most likely next step is the
// biggest target, everything else is one tap away and grouped by meaning.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronRight, Gift, LogIn, Medal, Play, Plus, Trophy } from 'lucide-react';
import { ALL_UNIQUE_CARDS, DIFFICULTY_LEVELS, type Player } from '@shared/game/gameData';
import { currentSeason, seasonBounds } from '@shared/game/seasons';
import type { SavedSoloCampaign } from '../../contexts/GameContext';
import { useAccount, type ScoreLeaderboardPosition } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { albumProgress, sortedItems } from '../album/albumData';
import DailyRewardsHomeButton from '../account/DailyRewards';
import Crest from '../game/Crest';
import DifficultyEmblem from '../game/DifficultyEmblem';
import PlayerCard from '../game/PlayerCard';
import { Button, Progress } from '../../design-system';
import { cn } from '../../lib/utils';

/** Three Única cards fanned behind the solo call, a new trio each day (the same for everyone on a given date). */
function cardsOfTheDay(date = new Date()): Player[] {
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let seed = 0;
  for (const char of day) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const pool = [...ALL_UNIQUE_CARDS];
  const picked: Player[] = [];
  while (picked.length < 3 && pool.length > 0) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    picked.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return picked;
}

const STADIUM_URL = '/stadiums/home-night.webp';

/** The night stadium behind a card, darkened toward where the text sits. */
function StadiumBackdrop({ position, shade }: { position: string; shade: string }) {
  return (
    <>
      <img src={STADIUM_URL} alt="" aria-hidden="true" decoding="async" className="pointer-events-none absolute inset-0 -z-20 size-full object-cover" style={{ objectPosition: position }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ background: shade }} />
    </>
  );
}

function LegendFan({ compact = false }: { compact?: boolean }) {
  const cards = useMemo(() => cardsOfTheDay(), []);
  // On phones the fan is scaled to just fit the card's width: as large as possible, never cut at the sides.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const fanRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(0.6);
  useEffect(() => {
    if (!compact) return undefined;
    const frame = frameRef.current;
    const fan = fanRef.current;
    if (!frame || !fan) return undefined;
    const fit = () => {
      const current = Number(getComputedStyle(fan).scale) || 1;
      // The tilted outer cards stick out of the row's own box, so measure the cards themselves.
      const rects = Array.from(fan.children, child => child.getBoundingClientRect());
      const naturalWidth = (Math.max(...rects.map(r => r.right)) - Math.min(...rects.map(r => r.left))) / current;
      if (naturalWidth > 0) setFitScale(Math.min(0.7, ((frame.clientWidth - 8) / naturalWidth) * 0.88));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [compact]);
  // A soft oval mask fades every edge into the card, so the fan reads as part of the background, not a picture on it.
  const mask = compact
    ? 'linear-gradient(180deg, #000 62%, transparent 100%)'
    : 'radial-gradient(ellipse 58% 72% at 58% 50%, #000 42%, transparent 100%)';
  return (
    <div
      ref={frameRef}
      aria-hidden="true"
      className={compact
        ? 'pointer-events-none relative -mx-5 mb-2 h-48 overflow-hidden opacity-70 sm:-mx-7 sm:h-64 lg:hidden'
        : 'pointer-events-none absolute inset-y-0 -right-8 -z-10 hidden w-[38rem] items-center justify-center opacity-60 lg:flex'}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div ref={fanRef} className={cn('flex rotate-[-9deg] items-center', compact && 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[46%]')} style={compact ? { scale: String(fitScale) } : undefined}>
        {cards.map((card, index) => (
          <div key={card.id} className={cn('-ml-6 first:ml-0', index === 1 ? 'z-10 -translate-y-5' : 'translate-y-4 opacity-80')} style={{ rotate: `${(index - 1) * 9}deg` }}>
            <PlayerCard player={card} lite flat scale={1.02} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Large, tilted club crest that fades into the campaign card like the card art on the solo hero. */
function CampaignCrestArt({ crestId, name }: { crestId: string | null; name?: string }) {
  const mask = 'radial-gradient(ellipse 58% 62% at 58% 50%, #000 42%, transparent 100%)';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-[-2rem] top-[-1.5rem] z-[1] flex h-44 w-[58%] items-start justify-center opacity-25 sm:inset-y-0 sm:right-[-1rem] sm:h-auto sm:w-[50%] sm:items-center sm:opacity-30 lg:right-[-1.5rem] lg:w-[48%] lg:opacity-40"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div className="origin-top rotate-[10deg] scale-[0.75] drop-shadow-[0_18px_28px_rgba(0,0,0,0.42)] sm:origin-center sm:scale-[0.78] lg:scale-[1.12]">
        <Crest crestId={crestId} name={name} size={280} />
      </div>
    </div>
  );
}

export interface HomeDashboardProps {
  hasAccount: boolean;
  busy: boolean;
  savedCampaign: SavedSoloCampaign | null;
  stageLabel: string | null;
  onContinue: () => void;
  onNewCampaign: () => void;
  onPlaySolo: () => void;
  onOnline: () => void;
  onAlbum: () => void;
  onAchievements: () => void;
  onEvents: () => void;
  onRankings: () => void;
  onLogin: () => void;
}

function daysLeft(endMs: number): number {
  return Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000));
}

/** A status card: the label as a quiet line with its icon, the value large, one line of context.
 *  "Something to do" is a gold value and a gold top edge, not a tinted box. The whole card is the button. */
function StatusCard({ icon, label, value, detail, highlight = false, onClick, loading = false }: {
  icon: ReactNode; label: string; value: ReactNode; detail: ReactNode; highlight?: boolean; onClick: () => void; loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[7.5rem] w-full flex-col justify-start gap-3 overflow-hidden rounded-(--ui-radius-lg) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-4 text-left transition-colors hover:border-[var(--ui-line-strong)] hover:bg-[var(--ui-surface-2)] sm:p-5 lg:min-h-[8.5rem]"
    >
      {highlight ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-[var(--ui-brand-strong)]" /> : null}
      <span className="flex items-center justify-between gap-2 text-[var(--ui-text-muted)]">
        <span className="flex min-w-0 items-center gap-1.5 text-label font-semibold">
          <span className={highlight ? 'text-[var(--ui-brand-strong)]' : ''} aria-hidden="true">{icon}</span>
          <span className="truncate">{label}</span>
        </span>
        <ChevronRight size={16} aria-hidden="true" className="hidden shrink-0 text-[var(--ui-text-faint)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 sm:block" />
      </span>
      {loading ? (
        <span className="ui-skeleton block h-10 w-3/4" />
      ) : (
        <span className="min-w-0">
          <span className={cn('block truncate font-display text-[1.3rem] uppercase leading-none tracking-caps sm:text-[2rem]', highlight ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text)]')}>{value}</span>
          <span className="mt-1.5 block text-label leading-ui-snug text-[var(--ui-text-muted)] sm:line-clamp-2">{detail}</span>
        </span>
      )}
    </button>
  );
}

/** A secondary mode: the name on top, and under a rule the line that says what it is (plus its meter, if any). */
function ModeCard({ title, detail, meter, backdrop, onClick }: { title: string; detail: ReactNode; meter?: ReactNode; backdrop: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative isolate flex min-h-[11rem] flex-col justify-between gap-5 overflow-hidden rounded-(--ui-radius-xl) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-5 text-left transition-colors hover:border-[var(--ui-line-strong)] sm:p-6 lg:col-span-4"
    >
      <StadiumBackdrop position={backdrop} shade="linear-gradient(180deg, rgba(10,10,18,0.55) 0%, rgba(10,10,18,0.8) 55%, rgba(10,10,18,0.95) 100%)" />
      <span className="min-w-0 font-display text-[1.75rem] uppercase leading-none tracking-caps text-[var(--ui-text)] sm:text-[2rem]">{title}</span>
      <span className="flex items-end justify-between gap-3 border-t border-[var(--ui-line-subtle)] pt-4">
        <span className="block min-w-0 flex-1">
          <span className="block text-body-sm text-[var(--ui-text-muted)]">{detail}</span>
          {meter}
        </span>
        <ChevronRight size={18} aria-hidden="true" className="mb-0.5 shrink-0 text-[var(--ui-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ui-brand-strong)]" />
      </span>
    </button>
  );
}

/** A pill of campaign context (stage, difficulty). */
function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-8 items-center rounded-(--ui-radius-pill) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-3.5 text-body-sm font-semibold text-[var(--ui-text-soft)]">{children}</span>;
}

export default function HomeDashboard(props: HomeDashboardProps) {
  const { hasAccount, busy, savedCampaign, stageLabel } = props;
  const { getScoreLeaderboardPosition, getEvents, eventCards } = useAccount();
  const { album } = useAlbum();
  const [standing, setStanding] = useState<ScoreLeaderboardPosition | null>(null);
  const [standingLoading, setStandingLoading] = useState(hasAccount);
  const [activeEvents, setActiveEvents] = useState<number | null>(null);

  useEffect(() => {
    if (!hasAccount) return undefined;
    let alive = true;
    void getScoreLeaderboardPosition().then(value => { if (alive) setStanding(value); }).catch(() => undefined).finally(() => { if (alive) setStandingLoading(false); });
    void getEvents().then(payload => { if (alive) setActiveEvents(payload.events.filter(event => event.status === 'active' && !event.completed).length); }).catch(() => undefined);
    return () => { alive = false; };
  }, [hasAccount, getScoreLeaderboardPosition, getEvents]);

  const season = standing?.season ?? currentSeason();
  const seasonDays = daysLeft(seasonBounds(season).end);
  const progress = albumProgress(album, eventCards);
  const albumPercent = progress.total ? Math.floor((progress.owned / progress.total) * 100) : 0;
  const packsToOpen = album ? sortedItems(album.inventory).reduce((n, [, q]) => n + q, 0) : 0;
  const difficultyName = savedCampaign?.difficulty ? DIFFICULTY_LEVELS.find(level => level.id === savedCampaign.difficulty)?.name : null;

  const seasonValue = standing?.status === 'ranked' && standing.position !== null ? `${standing.position}º lugar` : 'Sem pontos';
  const seasonDetail = standing?.status === 'ranked'
    ? `${standing.points.toLocaleString('pt-BR')} pontos · termina em ${seasonDays} ${seasonDays === 1 ? 'dia' : 'dias'}`
    : standing?.status === 'profile_not_public'
      ? 'Perfil privado não entra no ranking'
      : `Conclua uma competição · ${seasonDays} ${seasonDays === 1 ? 'dia' : 'dias'} restantes`;

  return (
    // The bottom padding only clears the tab bar, so the signature rests right on top of it.
    <div className={cn('mx-auto w-full max-w-[calc(1280px+1.5rem)] px-3 pt-4 sm:max-w-[calc(1280px+2.5rem)] sm:px-5 sm:pt-6 xl:pb-6', hasAccount ? 'pb-[calc(73px+env(safe-area-inset-bottom)+0.75rem)]' : 'pb-4')}>
      <h1 className="sr-only">UCL Immortals — início</h1>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        {/* ── Featured: the next step (continue, or start) ── */}
        <section
          aria-label="Modo solo"
          className="relative isolate overflow-hidden rounded-(--ui-radius-xl) border border-[var(--ui-brand-line)] bg-[var(--ui-surface-1)] p-5 sm:p-7 lg:col-span-8 lg:row-span-2 lg:flex lg:min-h-[26rem] lg:flex-col lg:justify-end lg:p-10"
        >
          {/* Decorative: a gold glow from the top-right; the art there is the team's crest (or the game's, before a campaign). */}
          <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_88%_30%,rgba(232,200,74,0.16),transparent_60%),linear-gradient(180deg,transparent_40%,rgba(8,8,16,0.55))]', savedCampaign ? 'z-0' : '-z-10')} />
          {savedCampaign ? (
            <CampaignCrestArt crestId={savedCampaign.crestId ?? null} name={savedCampaign.teamName || undefined} />
          ) : (
            <LegendFan />
          )}

          {savedCampaign ? (
            <div className="relative z-10 w-full sm:w-[78%] lg:w-[68%]">
              <p className="text-body font-semibold text-[var(--ui-brand-strong)] lg:text-lg">Sua campanha</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="min-w-0 truncate font-display text-[clamp(2.5rem,6vw,4.25rem)] uppercase leading-[0.9] tracking-display text-[var(--ui-text)] lg:text-[clamp(3.25rem,5.2vw,5.25rem)]">{savedCampaign.teamName || 'Seu time'}</h2>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {stageLabel ? <Tag>{stageLabel}</Tag> : null}
                {difficultyName ? <Tag><DifficultyEmblem difficulty={savedCampaign.difficulty} size={22} className="-ml-1 mr-1.5" />{difficultyName}</Tag> : null}
              </div>
              <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 lg:mt-9">
                <Button intent="primary" size="large" onClick={props.onContinue} disabled={busy} className="w-full sm:w-auto sm:min-w-[16rem] lg:min-w-[17rem]">
                  <Play size={18} fill="currentColor" aria-hidden="true" /> CONTINUAR
                </Button>
                <Button intent="secondary" size="large" onClick={props.onNewCampaign} disabled={busy} className="w-full shrink-0 whitespace-nowrap font-ui text-body-sm normal-case tracking-normal sm:w-auto lg:px-4">
                  <Plus size={16} aria-hidden="true" /> Nova campanha
                </Button>
              </div>
            </div>
          ) : (
            <>
              <LegendFan compact />
              <p className="text-body-sm font-semibold text-[var(--ui-brand-strong)]">Modo solo</p>
              <h2 className="mt-2 max-w-xl font-display text-[clamp(2.5rem,6vw,4.25rem)] uppercase leading-[0.9] tracking-display text-[var(--ui-text)]">Monte um time de lendas</h2>
              <p className="mt-3 max-w-md text-body text-[var(--ui-text-soft)]">Do elenco à taça, cada decisão é sua.</p>
              <div className="mt-6 lg:mt-8">
                <Button intent="primary" size="large" onClick={props.onPlaySolo} disabled={busy} className="w-full sm:w-auto sm:min-w-[16rem]">
                  <Play size={18} fill="currentColor" aria-hidden="true" /> JOGAR SOLO
                </Button>
              </div>
            </>
          )}
        </section>

        {/* ── Secondary modes, next to the featured one on a wide screen ── */}
        <ModeCard
          backdrop="12% 25%" title="Multiplayer" onClick={props.onOnline}
          detail="Crie uma sala ou entre com o código de um amigo."
        />

        <ModeCard
          backdrop="88% 30%" title={hasAccount ? 'Álbum' : 'Catálogo'} onClick={props.onAlbum}
          detail={hasAccount
            ? <>{packsToOpen > 0 ? <span className="block text-[var(--ui-brand-strong)]">{packsToOpen} {packsToOpen === 1 ? 'pacote para abrir' : 'pacotes para abrir'}</span> : null}<span className="block">{albumPercent}% completo, {progress.owned.toLocaleString('pt-BR')} de {progress.total.toLocaleString('pt-BR')} cartas</span></>
            : 'Todos os jogadores do jogo, com atributos e versões.'}
          meter={hasAccount ? <Progress value={albumPercent} className="mt-2.5" aria-label={`Álbum ${albumPercent}% completo`} /> : null}
        />
      </div>

      {/* ── Progress: account status at a glance ── */}
      {hasAccount ? (
        <section aria-label="Seu progresso" className="mt-4 lg:mt-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatusCard icon={<Trophy size={16} />} label={`Temporada ${season}`} value={seasonValue} detail={seasonDetail} loading={standingLoading} onClick={props.onRankings} />
            <DailyRewardsHomeButton renderTrigger={info => (
              <StatusCard
                icon={<Gift size={16} />} label="Recompensa diária" highlight={info.available} loading={info.loading} onClick={info.open}
                value={info.available ? 'Disponível' : 'Resgatada'}
                detail={info.available ? `${info.rewardLabel ?? 'Pacote'} para resgatar hoje` : 'Volte amanhã para a próxima'}
              />
            )} />
            <StatusCard
              icon={<CalendarDays size={16} />} label="Eventos" onClick={props.onEvents} loading={activeEvents === null} highlight={(activeEvents ?? 0) > 0}
              value={activeEvents ? `${activeEvents} ${activeEvents === 1 ? 'ativo' : 'ativos'}` : 'Nenhum ativo'}
              detail={activeEvents ? 'Desafios com prêmios exclusivos' : 'Veja os próximos desafios'}
            />
            <StatusCard icon={<Medal size={16} />} label="Conquistas" value="Ver progresso" detail="Cada nível rende um pacote" onClick={props.onAchievements} />
          </div>
        </section>
      ) : (
        // What an account adds, as four short columns under one call to action (no icon list).
        <section aria-label="Crie sua conta" className="mt-6 overflow-hidden rounded-(--ui-radius-xl) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] lg:mt-8">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-[var(--ui-brand-strong)]">Jogue com conta</p>
              <h2 className="mt-2 max-w-2xl font-display text-[clamp(2rem,4vw,2.75rem)] uppercase leading-[0.95] tracking-display text-[var(--ui-text)]">Guarde seu progresso e dispute o ranking</h2>
            </div>
            <Button intent="primary" size="large" onClick={props.onLogin} className="w-full shrink-0 lg:w-auto lg:min-w-[15rem]">
              <LogIn size={18} aria-hidden="true" /> ENTRAR OU CRIAR CONTA
            </Button>
          </div>
          <dl className="grid grid-cols-2 border-t border-[var(--ui-line-subtle)] lg:grid-cols-4">
            {[
              ['Álbum', 'Abra pacotes e evolua suas cartas.'],
              ['Ranking', 'Temporadas mensais com prêmios.'],
              ['Amigos', 'Convites para salas e trocas de cartas.'],
              ['Nuvem', 'Campanhas salvas em qualquer aparelho.'],
            ].map(([title, text], index) => (
              <div key={title} className={cn('p-5 sm:p-6', index % 2 === 0 && 'border-r border-[var(--ui-line-subtle)]', index < 2 && 'border-b border-[var(--ui-line-subtle)] lg:border-b-0', index === 1 && 'lg:border-r')}>
                <dt className="font-display text-title uppercase leading-none tracking-caps text-[var(--ui-text)]">{title}</dt>
                <dd className="mt-2 text-body-sm text-[var(--ui-text-muted)]">{text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <footer className="mt-12 flex justify-center">
        <span className="text-label font-bold tracking-wide-caps text-[var(--ui-text-faint)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>by J.Lessa</span>
      </footer>
    </div>
  );
}
