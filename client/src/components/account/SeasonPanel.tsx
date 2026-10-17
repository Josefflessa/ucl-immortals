// UCL Immortals — the ranking season: a compact bar on the Rankings page (season,
// time left, the viewer's standing) and a modal with everything about it (prizes of
// the top 10, the season's exclusives and the rules). Rules: shared/game/seasons.ts.

import { useState } from 'react';
import { CalendarDays, Check, Clock, Gift, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button, GameModal } from '../../design-system';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import { FrameImage } from './AvatarFrame';
import { CoinAmount, ItemArt } from '../album/AlbumPieces';
import PlayerCard from '../game/PlayerCard';
import { getProfileCover } from '../../lib/profileCovers';
import { ALL_UNIQUE_CARDS } from '@shared/game/gameData';
import { ALBUM_TIER_META, type AlbumPackTier } from '@shared/game/album';
import { AVATAR_FRAME_BY_KEY } from '@shared/game/events';
import {
  browsableSeasons, currentSeason, seasonBounds, seasonLabel, seasonPrize, SEASON_PRIZE_POSITIONS, SEASON_THEMES,
  type SeasonPrize,
} from '@shared/game/seasons';
import { useAccount, type ScoreLeaderboardPosition, type SeasonRewardEntry } from '../../contexts/AccountContext';
import { useAlbum } from '../../contexts/AlbumContext';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PODIUM = [
  { label: 'Campeão', color: '#E9C46A' },
  { label: 'Vice', color: '#C9D1DE' },
  { label: '3º lugar', color: '#D08A55' },
];

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function timeLeft(end: number, now: number): string {
  const ms = Math.max(0, end - now);
  if (ms >= DAY_MS) {
    const days = Math.ceil(ms / DAY_MS);
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  const hours = Math.max(1, Math.ceil(ms / HOUR_MS));
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

function packEntries(prize: SeasonPrize): [AlbumPackTier, number][] {
  return (Object.entries(prize.packs) as [AlbumPackTier, number][]).filter(([, quantity]) => quantity > 0);
}

function SeasonSelect({ season, onChange }: { season: number; onChange: (season: number) => void }) {
  const options: SelectMenuOption<string>[] = browsableSeasons().map(value => ({
    value: String(value),
    text: seasonLabel(value),
    label: <><span className="grid size-6 place-items-center"><CalendarDays size={16} aria-hidden="true" /></span><span className="mr-auto">{seasonLabel(value)}</span></>,
  }));
  return <SelectMenu label="Temporada" value={String(season)} options={options} onChange={value => onChange(Number(value))} className="min-w-0 flex-1" buttonClassName="w-full" />;
}

function PackRow({ prize, art = 56 }: { prize: SeasonPrize; art?: number }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {packEntries(prize).map(([tier, quantity]) => (
        <div key={tier} className="flex flex-col items-center gap-1">
          <ItemArt itemKey={`pack:${tier}`} height={art} />
          <span className="text-[11px] font-bold leading-none" style={{ color: ALBUM_TIER_META[tier].color }}>
            {quantity}× {ALBUM_TIER_META[tier].label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ExclusiveTile({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <figure className="flex w-[150px] min-w-0 flex-col items-center gap-1.5 text-center">
      <div className="grid min-h-[104px] place-items-center">{children}</div>
      <figcaption className="leading-tight">
        <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--ui-text-faint)]">{label}</span>
        <span className="block text-xs font-bold text-[var(--ui-text)]">{name}</span>
      </figcaption>
    </figure>
  );
}

function PodiumCard({ season, position }: { season: number; position: number }) {
  const prize = seasonPrize(position)!;
  const { label, color } = PODIUM[position - 1];
  const theme = SEASON_THEMES[season];
  const frame = theme && prize.frame ? AVATAR_FRAME_BY_KEY.get(theme.frameKey) : undefined;
  const cover = theme && prize.cover ? getProfileCover(theme.coverKey) : undefined;
  const card = theme && prize.card ? ALL_UNIQUE_CARDS.find(item => item.id === theme.cardId) : undefined;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-[var(--ui-surface-inset)] p-4" style={{ borderColor: `${color}66`, boxShadow: `inset 0 1px 0 ${color}22` }}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg border font-display text-xl leading-none" style={{ color, borderColor: `${color}66`, background: `${color}14` }}>{position}º</span>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{label}</span>
        </div>
        <CoinAmount value={prize.coins} size={15} className="text-base" />
      </header>
      <PackRow prize={prize} />
      {frame || cover || card ? (
        <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-3 border-t border-[var(--ui-line-subtle)] pt-3">
          {card ? (
            <ExclusiveTile label="Carta Única exclusiva" name={card.shortName}>
              <div className="pointer-events-none"><PlayerCard player={card} scale={0.55} /></div>
            </ExclusiveTile>
          ) : null}
          {frame ? (
            <ExclusiveTile label="Moldura" name={frame.name}>
              <span className="relative block size-[96px]"><FrameImage frameKey={frame.key} className="absolute inset-0 size-full" /></span>
            </ExclusiveTile>
          ) : null}
          {cover ? (
            <ExclusiveTile label="Fundo de perfil" name={cover.name}>
              <img src={cover.src} alt="" className="h-[96px] w-full max-w-[150px] rounded-lg border border-white/10 object-cover" />
            </ExclusiveTile>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ClaimPanel({ season, reward, onClaimed }: { season: number; reward: SeasonRewardEntry; onClaimed: (reward: SeasonRewardEntry) => void }) {
  const { claimSeasonReward } = useAccount();
  const { refresh: refreshAlbum } = useAlbum();
  const [busy, setBusy] = useState(false);
  const claimed = reward.claimed_at !== null;
  const claim = async () => {
    setBusy(true);
    try {
      const next = await claimSeasonReward(season);
      onClaimed(next);
      void refreshAlbum();
      toast.success('Prêmios da temporada resgatados!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível resgatar os prêmios.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--ui-brand)]/45 bg-[var(--ui-brand-soft)] p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
      <Gift size={22} className="shrink-0 text-[var(--ui-brand-strong)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-none text-[var(--ui-text)]">Você terminou em {reward.position}º</p>
        <p className="mt-1 text-xs text-[var(--ui-text-muted)]">
          {claimed ? `Prêmios resgatados em ${formatDay(reward.claimed_at!)}.` : 'Os prêmios ficam guardados até você resgatar.'}
        </p>
      </div>
      </div>
      {claimed
        ? <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ui-success)]"><Check size={16} aria-hidden="true" />Resgatado</span>
        : <Button type="button" intent="primary" disabled={busy} onClick={() => { void claim(); }} className="min-h-10 w-full shrink-0 px-4 sm:w-auto">{busy ? 'Resgatando…' : 'Resgatar prêmios'}</Button>}
    </section>
  );
}

function SeasonPrizesModal({ season, open, onOpenChange, reward, onClaimed }: {
  season: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: SeasonRewardEntry | null;
  onClaimed: (reward: SeasonRewardEntry) => void;
}) {
  const bounds = seasonBounds(season);
  const now = Date.now();
  const closed = season < currentSeason(now);
  const lowerRows: { range: string; position: number }[] = [
    { range: '4º e 5º', position: 4 },
    { range: '6º ao 10º', position: SEASON_PRIZE_POSITIONS },
  ];
  return (
    <GameModal
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title={seasonLabel(season).toUpperCase()}
      subtitle={closed
        ? `Encerrada em ${formatDay(bounds.end - 1)}`
        : `${season === 0 ? 'Até' : `De ${formatDay(bounds.start)} a`} ${formatDay(bounds.end - 1)} · termina em ${timeLeft(bounds.end, now)}`}
      closeLabel="Fechar prêmios da temporada"
    >
      <div className="space-y-5">
        {reward ? <ClaimPanel season={season} reward={reward} onClaimed={onClaimed} /> : null}
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-[var(--ui-text-soft)]"><Trophy size={14} aria-hidden="true" />Pódio</h3>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map(position => <PodiumCard key={position} season={season} position={position} />)}
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="text-[12px] font-black uppercase tracking-widest text-[var(--ui-text-soft)]">Do 4º ao 10º</h3>
          <ul className="divide-y divide-[var(--ui-line-subtle)] overflow-hidden rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)]">
            {lowerRows.map(row => {
              const prize = seasonPrize(row.position)!;
              return (
                <li key={row.range} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="w-20 font-display text-lg leading-none text-[var(--ui-text)]">{row.range}</span>
                  <PackRow prize={prize} art={40} />
                  <CoinAmount value={prize.coins} size={14} className="ml-auto text-sm" />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-[12px] font-black uppercase tracking-widest text-[var(--ui-text-soft)]">Como funciona</h3>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--ui-text-muted)]">
            <li>Vale só o ranking geral de pontos: cada competição concluída na temporada soma pontos pela fase alcançada e pela dificuldade.</li>
            <li>{season === 0 ? 'A Temporada 0 conta todas as competições concluídas até o fim dela.' : 'Cada temporada dura um mês, do dia 17 ao dia 17 seguinte (horário de Brasília).'}</li>
            <li>Quando a temporada termina, o Top 10 é congelado e cada um resgata os próprios prêmios aqui, quando quiser. Só perfis públicos disputam.</li>
            <li>Em caso de empate nos pontos, fica à frente quem tem mais títulos e depois mais competições pontuadas.</li>
            <li>A moldura, o fundo e a Carta Única de cada temporada são exclusivos: não voltam em outras temporadas nem são vendidos na loja.</li>
          </ul>
        </section>
      </div>
    </GameModal>
  );
}

function standingText(standing: ScoreLeaderboardPosition | null, closed: boolean): string | null {
  if (!standing || standing.reward) return null;
  if (standing.status === 'profile_not_public') return 'Perfil privado: fora do ranking e dos prêmios';
  if (standing.position === null) return null;
  const inPrizes = standing.position <= SEASON_PRIZE_POSITIONS && !closed;
  return `Você está em ${standing.position}º com ${standing.points} pontos${inPrizes ? ' · zona de prêmios' : ''}`;
}

export default function SeasonBar({ season, onSeasonChange, standing }: {
  season: number;
  onSeasonChange: (season: number) => void;
  standing: ScoreLeaderboardPosition | null;
}) {
  const [prizesOpen, setPrizesOpen] = useState(false);
  // The claim answer overrides the standing until the ranking is read again.
  const [claimed, setClaimed] = useState<SeasonRewardEntry | null>(null);
  const reward = claimed?.season === season ? claimed : standing?.reward ?? null;
  const now = Date.now();
  const bounds = seasonBounds(season);
  const closed = season < currentSeason(now);
  const position = standingText(standing, closed);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SeasonSelect season={season} onChange={onSeasonChange} />
        <Button
          type="button"
          intent="ghost"
          onClick={() => setPrizesOpen(true)}
          aria-label="Ver prêmios da temporada"
          title="Prêmios da temporada"
          className="min-h-11 shrink-0 gap-1.5 rounded-xl border border-[var(--ui-line-subtle)] px-3 text-xs font-bold"
        >
          <Gift size={16} aria-hidden="true" /><span className="hidden sm:inline">Prêmios</span>
        </Button>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-[var(--ui-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} aria-hidden="true" />
          {closed
            ? `Encerrada em ${formatDay(bounds.end - 1)}`
            : <>Termina em <strong className="text-[var(--ui-brand-strong)]">{timeLeft(bounds.end, now)}</strong> ({formatDay(bounds.end - 1)})</>}
        </span>
        {position ? <span>{position}</span> : null}
      </p>
      {reward && reward.claimed_at === null ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--ui-brand)]/40 bg-[var(--ui-brand-soft)] px-3 py-2 text-sm text-[var(--ui-text)]">
          <Gift size={16} className="shrink-0 text-[var(--ui-brand-strong)]" aria-hidden="true" />
          <span className="min-w-0 flex-1">Você terminou em <strong>{reward.position}º</strong>. Seus prêmios estão esperando.</span>
          <Button type="button" intent="primary" onClick={() => setPrizesOpen(true)} className="min-h-9 shrink-0 px-3 text-xs">Resgatar</Button>
        </div>
      ) : null}
      <SeasonPrizesModal season={season} open={prizesOpen} onOpenChange={setPrizesOpen} reward={reward} onClaimed={setClaimed} />
    </div>
  );
}
