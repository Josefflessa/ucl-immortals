// UCL Immortals — home dashboard.
// Layout follows the hub pattern of card games (one featured action, the player's
// progress in cards, navigation fixed elsewhere): the most likely next step is the
// biggest target, everything else is one tap away and grouped by meaning.

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronRight, Cloud, Gift, LibraryBig, LogIn, Medal, Play, Plus, Sparkles, Trophy, Users } from 'lucide-react';
import { DIFFICULTY_LEVELS } from '@shared/game/gameData';
import { currentSeason, seasonBounds } from '@shared/game/seasons';
import type { SavedSoloCampaign } from '../../contexts/GameContext';
import { useAccount, type ScoreLeaderboardPosition } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';
import { albumProgress, sortedItems } from '../album/albumData';
import DailyRewardsHomeButton from '../account/DailyRewards';
import Crest from '../game/Crest';
import { Button, Progress } from '../../design-system';
import { cn } from '../../lib/utils';

const LOGO_URL = '/icons/logo_ucl.png';

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

function savedAgo(savedAt: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - savedAt) / 60_000));
  if (minutes < 1) return 'salva agora';
  if (minutes < 60) return `salva há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `salva há ${hours} h`;
  const days = Math.round(hours / 24);
  return `salva há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/** A status card: icon, label, the value that matters and a short line of context. The whole card is the button. */
function StatusCard({ icon, label, value, detail, highlight = false, onClick, loading = false }: {
  icon: ReactNode; label: string; value: ReactNode; detail: ReactNode; highlight?: boolean; onClick: () => void; loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[7.5rem] w-full flex-col lg:min-h-[8.5rem] justify-between gap-3 rounded-(--ui-radius-lg) border p-4 text-left transition-colors',
        highlight
          ? 'border-[var(--ui-brand-line)] bg-[var(--ui-brand-soft)] hover:border-[var(--ui-brand)]'
          : 'border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] hover:border-[var(--ui-line-strong)] hover:bg-[var(--ui-surface-2)]',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[var(--ui-text-muted)]">
          <span className={cn('hidden size-8 place-items-center rounded-(--ui-radius-md) sm:grid', highlight ? 'bg-[var(--ui-brand-strong)] text-[var(--ui-brand-ink)]' : 'bg-[var(--ui-surface-3)] text-[var(--ui-brand-strong)]')} aria-hidden="true">{icon}</span>
          <span className="ui-section-label truncate">{label}</span>
        </span>
        <ChevronRight size={16} aria-hidden="true" className="hidden shrink-0 text-[var(--ui-text-faint)] transition-transform group-hover:translate-x-0.5 sm:block" />
      </span>
      {loading ? (
        <span className="ui-skeleton block h-10 w-3/4" />
      ) : (
        <span className="min-w-0">
          <span className="block truncate font-display text-title-lg uppercase leading-none tracking-caps text-[var(--ui-text)]">{value}</span>
          <span className="mt-1 line-clamp-2 text-label leading-ui-snug text-[var(--ui-text-muted)]">{detail}</span>
        </span>
      )}
    </button>
  );
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
    <div className="mx-auto w-full max-w-[calc(1280px+1.5rem)] px-3 pb-28 pt-4 sm:max-w-[calc(1280px+2.5rem)] sm:px-5 sm:pt-6 xl:pb-10">
      <h1 className="sr-only">UCL Immortals — início</h1>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        {/* ── Featured: the next step (continue, or start) ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          aria-label="Modo solo"
          className="relative isolate overflow-hidden rounded-(--ui-radius-xl) border border-[var(--ui-brand-line)] bg-[var(--ui-surface-1)] p-5 sm:p-7 lg:col-span-8 lg:row-span-2 lg:flex lg:min-h-[26rem] lg:flex-col lg:justify-end lg:p-10"
        >
          {/* Decorative: golden glow and the brand crest, kept to one side so the text keeps contrast. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(232,200,74,0.18),transparent_55%),linear-gradient(180deg,transparent,rgba(8,8,16,0.6))]" />
          <img src={LOGO_URL} alt="" aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 -z-10 h-44 w-44 object-contain opacity-[0.12] sm:h-56 sm:w-56 sm:opacity-25 lg:right-6 lg:top-6 lg:h-64 lg:w-64 lg:opacity-90" />

          {savedCampaign ? (
            <>
              <div className="ui-kicker">Campanha em andamento</div>
              <div className="mt-1 flex items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-(--ui-radius-lg) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] sm:size-16">
                  <Crest crestId={savedCampaign.crestId ?? null} name={savedCampaign.teamName || undefined} size={40} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[clamp(2rem,4.6vw,3.25rem)] uppercase leading-none tracking-display text-[var(--ui-text)]">{savedCampaign.teamName || 'Seu time'}</h2>
                  <p className="mt-1.5 text-body-sm text-[var(--ui-text-soft)]">
                    {[stageLabel, difficultyName, savedAgo(savedCampaign.savedAt)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row lg:mt-8">
                <Button intent="primary" size="large" onClick={props.onContinue} disabled={busy} className="sm:min-w-[16rem]">
                  <Play size={18} fill="currentColor" aria-hidden="true" /> CONTINUAR CAMPANHA
                </Button>
                <Button intent="secondary" size="large" onClick={props.onNewCampaign} disabled={busy} className="font-ui text-body-sm">
                  <Plus size={16} aria-hidden="true" /> Nova campanha
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="ui-kicker">Modo solo</div>
              <h2 className="max-w-xl font-display text-[clamp(2rem,4.6vw,3.25rem)] uppercase leading-[0.95] tracking-display text-[var(--ui-text)]">Monte um time de lendas</h2>
              <p className="mt-3 max-w-md text-body text-[var(--ui-text-soft)]">Escolha craques de todas as eras no draft e dispute liga e mata-mata até a taça.</p>
              <div className="mt-6 lg:mt-8">
                <Button intent="primary" size="large" onClick={props.onPlaySolo} disabled={busy} className="w-full sm:w-auto sm:min-w-[16rem]">
                  <Play size={18} fill="currentColor" aria-hidden="true" /> JOGAR SOLO
                </Button>
              </div>
            </>
          )}
        </motion.section>

        {/* ── Secondary modes, next to the featured one on a wide screen ── */}
        <motion.button
          type="button" onClick={props.onOnline}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="group flex items-center gap-4 rounded-(--ui-radius-xl) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-5 text-left transition-colors hover:border-[var(--ui-info)] lg:col-span-4 lg:flex-col lg:items-start lg:justify-between"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-(--ui-radius-lg) bg-[var(--ui-info-soft)] text-[var(--ui-info)]" aria-hidden="true"><Users size={24} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-title-lg uppercase leading-none tracking-caps text-[var(--ui-text)]">Multiplayer online</span>
            <span className="mt-1 block text-body-sm text-[var(--ui-text-muted)]">Crie uma sala ou entre com o código de um amigo.</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-[var(--ui-text-faint)] transition-transform group-hover:translate-x-0.5 lg:hidden" />
        </motion.button>

        <motion.button
          type="button" onClick={props.onAlbum}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="group flex items-center gap-4 rounded-(--ui-radius-xl) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-2)] p-5 text-left transition-colors hover:border-[var(--ui-brand)] lg:col-span-4 lg:flex-col lg:items-start lg:justify-between"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-(--ui-radius-lg) bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)]" aria-hidden="true"><LibraryBig size={24} /></span>
          <span className="w-full min-w-0 flex-1">
            <span className="block font-display text-title-lg uppercase leading-none tracking-caps text-[var(--ui-text)]">{hasAccount ? 'Álbum' : 'Catálogo'}</span>
            {hasAccount ? (
              <>
                <span className="mt-1 block text-body-sm text-[var(--ui-text-muted)]">
                  {albumPercent}% completo{packsToOpen > 0 ? ` · ${packsToOpen} ${packsToOpen === 1 ? 'pacote para abrir' : 'pacotes para abrir'}` : ''}
                </span>
                <Progress value={albumPercent} className="mt-2.5" aria-label={`Álbum ${albumPercent}% completo`} />
              </>
            ) : (
              <span className="mt-1 block text-body-sm text-[var(--ui-text-muted)]">Todos os jogadores do jogo, com atributos e versões.</span>
            )}
          </span>
          <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-[var(--ui-text-faint)] transition-transform group-hover:translate-x-0.5 lg:hidden" />
        </motion.button>
      </div>

      {/* ── Progress: account status at a glance ── */}
      {hasAccount ? (
        <section aria-label="Seu progresso" className="mt-6 lg:mt-8">
          <h2 className="ui-section-label mb-3">Seu progresso</h2>
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
        <section aria-label="Crie sua conta" className="mt-6 grid gap-5 rounded-(--ui-radius-xl) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] p-5 sm:p-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="ui-kicker">Jogue com conta</div>
            <h2 className="font-display text-heading uppercase leading-none tracking-display text-[var(--ui-text)]">Guarde seu progresso e dispute o ranking</h2>
            <ul className="mt-4 grid gap-2 text-body-sm text-[var(--ui-text-soft)] sm:grid-cols-2">
              {[
                [<Sparkles key="a" size={15} />, 'Álbum de cartas com pacotes e evolução'],
                [<Trophy key="b" size={15} />, 'Rankings por temporada com prêmios'],
                [<Users key="c" size={15} />, 'Amigos, convites e trocas de cartas'],
                [<Cloud key="d" size={15} />, 'Campanhas salvas na nuvem'],
              ].map(([icon, text]) => (
                <li key={String(text)} className="flex items-center gap-2"><span className="text-[var(--ui-brand-strong)]" aria-hidden="true">{icon}</span>{text}</li>
              ))}
            </ul>
          </div>
          <Button intent="primary" size="large" onClick={props.onLogin} className="w-full lg:w-auto lg:min-w-[14rem]">
            <LogIn size={18} aria-hidden="true" /> ENTRAR OU CRIAR CONTA
          </Button>
        </section>
      )}

      <footer className="mt-10 text-center text-label font-bold tracking-wide-caps text-[var(--ui-text-faint)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>by J.Lessa</footer>
    </div>
  );
}
