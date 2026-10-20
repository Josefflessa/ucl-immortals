import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CircleHelp, Eye, LoaderCircle, Trophy } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useTeams } from '../hooks/useTeams';
import Crest from '../components/game/Crest';
import BracketTab from '../components/game/BracketTab';
import MatchDetailsModal from '../components/game/MatchDetailsModal';
import PlayerSeasonStatsPanel, { type PlayerSeasonStatsRow } from '../components/game/PlayerSeasonStatsPanel';
import { Button } from '../design-system';
import {
  computeGroupStandings,
  computeStandings,
  getAllPlayedMatchResults,
  getPlayerSeasonStats,
  knockoutRoundLabel,
  MIN_MATCHES_FOR_RATING_LEADER,
  statKey,
  type MatchResult,
  type Team,
} from '@shared/game/gameEngine';

export type CompetitionReviewSection = 'table' | 'bracket' | 'matches' | 'stats';
type StatsCategory = 'squad' | 'goals' | 'assists' | 'ratings' | 'keepers' | 'tackles' | 'cards';

interface Props {
  section: CompetitionReviewSection;
  partial?: boolean;
}

interface ReviewMatch {
  key: string;
  stage: string;
  result: MatchResult;
  isKnockout: boolean;
  isFinal: boolean;
}

const KNOCKOUT_ROUNDS = [
  { key: 'playoffs', label: 'playoffs' },
  { key: 'round16', label: 'round16' },
  { key: 'quarters', label: 'quarters' },
  { key: 'semis', label: 'semis' },
  { key: 'final', label: 'final' },
] as const;

function ResultScore({ result }: { result: MatchResult }) {
  return <span className="whitespace-nowrap font-display text-2xl tabular-nums" style={{ color: 'var(--ui-brand-strong)' }}>{result.homeGoals} <span className="opacity-50">–</span> {result.awayGoals}</span>;
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border px-5 py-10 text-center" style={{ background: 'var(--ui-surface-1)', borderColor: 'var(--ui-line-subtle)', color: 'var(--ui-text-muted)' }}>
      <CircleHelp size={24} className="mx-auto mb-2 opacity-60" aria-hidden="true" />
      <p className="text-sm">{children}</p>
    </div>
  );
}

interface StandingStatus {
  label: string;
  color: string;
}

function StandingsTable({ entries, localTeamId, teams, statusFor }: {
  entries: ReturnType<typeof computeStandings>;
  localTeamId?: string;
  teams: Team[];
  statusFor: (index: number) => StandingStatus;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[390px] border-collapse text-left text-sm sm:min-w-[640px]">
        <caption className="sr-only">Classificação e situação de cada equipe</caption>
        <thead>
          <tr className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ui-text-faint)', background: 'var(--ui-bg)' }}>
            <th className="px-2 py-3 text-center">#</th><th className="px-2 py-3">Time</th><th className="px-2 py-3 text-center">J</th>
            <th className="hidden px-2 py-3 text-center md:table-cell">V</th><th className="hidden px-2 py-3 text-center md:table-cell">E</th><th className="hidden px-2 py-3 text-center md:table-cell">D</th>
            <th className="hidden px-2 py-3 text-center md:table-cell">GP</th><th className="hidden px-2 py-3 text-center md:table-cell">GC</th><th className="px-2 py-3 text-center">SG</th><th className="px-2 py-3 text-center">PTS</th><th className="hidden px-3 py-3 sm:table-cell">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--ui-line-subtle)' }}>
          {entries.map((entry, index) => {
            const goalDiff = entry.goalsFor - entry.goalsAgainst;
            const isLocal = entry.teamId === localTeamId;
            const team = teams.find(item => item.id === entry.teamId);
            const status = statusFor(index);
            return (
              <tr key={entry.teamId} style={{ background: isLocal ? 'color-mix(in srgb, var(--ui-brand) 10%, var(--ui-surface-1))' : 'var(--ui-surface-1)' }}>
                <td className="px-2 py-3 text-center font-display" style={{ color: status.color }}>{index + 1}</td>
                <td className="max-w-[190px] px-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Crest crestId={team?.crestId} name={entry.teamName} size={23} />
                    <div className="min-w-0">
                      <div className="truncate font-bold" style={{ color: isLocal ? 'var(--ui-brand-strong)' : 'var(--ui-text)' }} title={entry.teamName}>{entry.teamName}</div>
                      <div className="truncate text-[10px] font-bold uppercase tracking-wide sm:hidden" style={{ color: status.color }}>
                        {isLocal ? 'Meu time · ' : ''}{status.label}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-center tabular-nums">{entry.played}</td>
                <td className="hidden px-2 py-3 text-center tabular-nums md:table-cell">{entry.won}</td><td className="hidden px-2 py-3 text-center tabular-nums md:table-cell">{entry.drawn}</td><td className="hidden px-2 py-3 text-center tabular-nums md:table-cell">{entry.lost}</td>
                <td className="hidden px-2 py-3 text-center tabular-nums md:table-cell">{entry.goalsFor}</td><td className="hidden px-2 py-3 text-center tabular-nums md:table-cell">{entry.goalsAgainst}</td>
                <td className="px-2 py-3 text-center tabular-nums">{goalDiff > 0 ? `+${goalDiff}` : goalDiff}</td>
                <td className="px-2 py-3 text-center font-black tabular-nums" style={{ color: 'var(--ui-brand-strong)' }}>{entry.points}</td>
                <td className="hidden px-3 py-3 text-xs font-bold sm:table-cell" style={{ color: status.color }}>{status.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CompetitionReview({ section, partial = false }: Props) {
  const { state, requestMatchResultOnline, getTeamById } = useGame();
  const { allTeams, localTeamId } = useTeams();
  const [statsCategory, setStatsCategory] = useState<StatsCategory>('squad');
  const [detailsMatch, setDetailsMatch] = useState<{ result: MatchResult; isKnockout: boolean; isFinal: boolean } | null>(null);
  const [loadingMatchKey, setLoadingMatchKey] = useState<string | null>(null);
  const format = state.competitionFormat;
  const bracket = state.knockoutBracket as any;
  const isGroupFormat = format.id === 'groups_knockout';
  const hasLeagueStage = format.id !== 'knockout';
  const isLocalPartial = partial;

  const groupTables = useMemo(
    () => isGroupFormat ? computeGroupStandings(allTeams, state.leagueFixtures, format) : [],
    [allTeams, format, isGroupFormat, state.leagueFixtures],
  );
  const leagueTable = useMemo(
    () => state.leagueStandings.length > 0 ? state.leagueStandings : computeStandings(allTeams, state.leagueFixtures),
    [allTeams, state.leagueFixtures, state.leagueStandings],
  );

  const matches = useMemo<ReviewMatch[]>(() => {
    const leagueMatches = state.leagueFixtures
      .filter(fixture => fixture.played && fixture.result)
      .map(fixture => ({
        key: `league-${fixture.round}-${fixture.homeTeamId}-${fixture.awayTeamId}`,
        stage: isGroupFormat && typeof fixture.groupId === 'number'
          ? `Fase de grupos · Grupo ${String.fromCharCode(65 + fixture.groupId)} · Rodada ${fixture.round}`
          : `Fase de liga · Rodada ${fixture.round}`,
        result: { ...fixture.result!, round: fixture.result!.round ?? fixture.round },
        isKnockout: false,
        isFinal: false,
        order: fixture.round,
      }));
    const knockoutMatches: Array<ReviewMatch & { order: number }> = [];
    const rounds = [
      bracket?.playoffs ?? [], bracket?.round16 ?? [], bracket?.quarterFinals ?? [], bracket?.semiFinals ?? [], bracket?.final ? [bracket.final] : [],
    ];
    rounds.forEach((ties, roundIndex) => {
      const key = KNOCKOUT_ROUNDS[roundIndex]?.key ?? 'knockout';
      const label = knockoutRoundLabel(key, bracket?.firstRoundSize);
      ties.forEach((tie: any) => {
        const pushLeg = (leg: MatchResult | undefined, suffix: string, legOrder: number) => {
          if (!leg) return;
          knockoutMatches.push({
            key: `${tie.id}-${suffix}`,
            stage: `${label} · ${suffix}`,
            result: leg,
            isKnockout: true,
            isFinal: key === 'final',
            order: 100 + roundIndex * 100 + legOrder,
          });
        };
        if (tie.leg1 || tie.leg2) {
          pushLeg(tie.leg1, 'ida', 1);
          pushLeg(tie.leg2, 'volta', 2);
        } else if (tie.played && tie.result) {
          pushLeg(tie.result, 'partida única', 1);
        }
      });
    });
    return [...leagueMatches, ...knockoutMatches].sort((a, b) => a.order - b.order).map(({ order: _order, ...match }) => match);
  }, [bracket, isGroupFormat, state.leagueFixtures]);

  const allPlayedResults = useMemo(
    () => getAllPlayedMatchResults(state.leagueResults, state.knockoutBracket),
    [state.leagueResults, state.knockoutBracket],
  );
  const statsRows = useMemo<PlayerSeasonStatsRow[]>(() => {
    const ownTeam = allTeams.find(team => team.id === localTeamId) ?? state.playerTeam;
    if (statsCategory === 'squad') {
      return ownTeam ? ownTeam.players.map((player, index) => ({
        player,
        isReserve: index >= 11,
        stats: state.mode === 'online'
          ? state.onlineSeasonPlayerStats[statKey(ownTeam.id, player.id)] ?? getPlayerSeasonStats(player.id, ownTeam.id, allPlayedResults)
          : getPlayerSeasonStats(player.id, ownTeam.id, allPlayedResults),
      })) : [];
    }
    const rows = allTeams.flatMap(team => team.players.map(player => ({
      player,
      teamName: team.name,
      stats: state.mode === 'online'
        ? state.onlineSeasonPlayerStats[statKey(team.id, player.id)] ?? getPlayerSeasonStats(player.id, team.id, allPlayedResults)
        : getPlayerSeasonStats(player.id, team.id, allPlayedResults),
    })));
    const comparators: Record<Exclude<StatsCategory, 'squad'>, (a: PlayerSeasonStatsRow, b: PlayerSeasonStatsRow) => number> = {
      goals: (a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists,
      assists: (a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals,
      ratings: (a, b) => b.stats.ratingAvg - a.stats.ratingAvg || b.stats.played - a.stats.played,
      keepers: (a, b) => b.stats.saves - a.stats.saves || b.stats.played - a.stats.played,
      tackles: (a, b) => b.stats.tackles - a.stats.tackles,
      cards: (a, b) => (b.stats.redCards * 10 + b.stats.yellowCards) - (a.stats.redCards * 10 + a.stats.yellowCards),
    };
    const eligible = rows.filter(row => {
      if (statsCategory === 'goals') return row.stats.goals > 0;
      if (statsCategory === 'assists') return row.stats.assists > 0;
      if (statsCategory === 'ratings') return row.stats.played >= MIN_MATCHES_FOR_RATING_LEADER;
      if (statsCategory === 'keepers') return row.player.position === 'GK' && row.stats.played > 0;
      if (statsCategory === 'tackles') return row.stats.tackles > 0;
      return row.stats.yellowCards + row.stats.redCards > 0;
    });
    return eligible.sort(comparators[statsCategory]).slice(0, 15);
  }, [allPlayedResults, allTeams, localTeamId, state.mode, state.onlineSeasonPlayerStats, state.playerTeam, statsCategory]);

  const openMatchDetails = async (match: ReviewMatch) => {
    let result = match.result;
    if (result.resultTrimmed && state.mode === 'online' && typeof result.round === 'number') {
      if (loadingMatchKey) return;
      setLoadingMatchKey(match.key);
      const toastId = toast.loading('Carregando detalhes da partida…');
      let full: MatchResult | null = null;
      try {
        full = await requestMatchResultOnline(result.round, result.homeTeamId, result.awayTeamId);
      } catch {
        full = null;
      } finally {
        toast.dismiss(toastId);
        setLoadingMatchKey(null);
      }
      if (!full) {
        toast.error('Não foi possível carregar os detalhes dessa partida agora. Tente novamente.');
        return;
      }
      result = full;
    }
    setDetailsMatch({ result, isKnockout: match.isKnockout, isFinal: match.isFinal });
  };

  if (section === 'table') {
    if (!hasLeagueStage) return <EmptyState>Esta competição não tem fase de liga ou grupos.</EmptyState>;
    const playoffPlaces = Math.max(0, format.qualifiedTeams - 16);
    const directPlaces = Math.max(0, 16 - playoffPlaces);
    const statusFor = (index: number): StandingStatus => {
      if (isGroupFormat) {
        return index < format.qualifiedPerGroup
          ? { label: 'Avança', color: 'var(--ui-success)' }
          : { label: 'Fora da classificação', color: 'var(--ui-text-faint)' };
      }
      if (format.id === 'league') {
        return index === 0
          ? { label: isLocalPartial ? 'Líder' : '1º lugar', color: 'var(--ui-brand-strong)' }
          : { label: '—', color: 'var(--ui-text-faint)' };
      }
      if (index < directPlaces) return { label: 'Oitavas', color: 'var(--ui-success)' };
      if (index < format.qualifiedTeams) return { label: 'Playoff', color: '#60A5FA' };
      return { label: 'Fora da classificação', color: 'var(--ui-text-faint)' };
    };
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display text-2xl" style={{ color: 'var(--ui-text)' }}>{isGroupFormat ? 'CLASSIFICAÇÃO DOS GRUPOS' : isLocalPartial ? 'CLASSIFICAÇÃO ATÉ AQUI' : 'CLASSIFICAÇÃO FINAL'}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isGroupFormat
            ? `${format.qualifiedPerGroup} ${format.qualifiedPerGroup === 1 ? 'time avança' : 'times avançam'} de cada grupo.`
            : format.id === 'league'
              ? 'Tabela final organizada por pontos, saldo de gols e critérios de desempate.'
              : `${directPlaces} ${directPlaces === 1 ? 'vaga direta' : 'vagas diretas'} às oitavas${playoffPlaces > 0 ? ` · ${playoffPlaces} vagas no playoff` : ''}.`}</p>
        </div>
        {isGroupFormat ? groupTables.map(group => (
          <section key={group.groupId} className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--ui-line-subtle)', background: 'var(--ui-surface-1)' }}>
            <h3 className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm font-black tracking-widest" style={{ borderColor: 'var(--ui-line-subtle)', color: 'var(--ui-brand-strong)' }}>
              <span>GRUPO {String.fromCharCode(65 + group.groupId)}</span>
              <span className="text-[10px] tracking-wide" style={{ color: 'var(--ui-text-muted)' }}>{format.qualifiedPerGroup} avançam</span>
            </h3>
            <StandingsTable entries={group.entries} localTeamId={localTeamId} teams={allTeams} statusFor={statusFor} />
          </section>
        )) : (
          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--ui-line-subtle)', background: 'var(--ui-surface-1)' }}>
            <StandingsTable entries={leagueTable} localTeamId={localTeamId} teams={allTeams} statusFor={statusFor} />
          </section>
        )}
        <p className="text-xs" style={{ color: 'var(--ui-text-faint)' }}>No celular, a tabela mostra jogos, saldo e pontos. Em telas maiores, aparecem também vitórias, empates, derrotas e gols pró/contra.</p>
      </div>
    );
  }

  if (section === 'bracket') {
    if (!bracket) return <EmptyState>O chaveamento ainda não foi iniciado nesta competição.</EmptyState>;
    return (
      <div className="space-y-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl" style={{ color: 'var(--ui-text)' }}><Trophy size={21} aria-hidden="true" /> CHAVEAMENTO</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isLocalPartial ? 'Veja até onde a competição avançou e em qual confronto sua campanha terminou.' : 'Acompanhe os placares e os classificados de cada fase.'}</p>
        </div>
        <BracketTab reviewMode />
      </div>
    );
  }

  if (section === 'matches') {
    const matchSections = [
      { key: 'league', title: isGroupFormat ? 'FASE DE GRUPOS' : 'FASE DE LIGA', results: matches.filter(match => !match.isKnockout) },
      { key: 'knockout', title: 'MATA-MATA', results: matches.filter(match => match.isKnockout) },
    ].filter(group => group.results.length > 0);
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-2xl" style={{ color: 'var(--ui-text)' }}>PARTIDAS DA CAMPANHA</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isLocalPartial ? `${matches.length} ${matches.length === 1 ? 'resultado registrado' : 'resultados registrados'} até o fim da sua campanha.` : `${matches.length} ${matches.length === 1 ? 'partida disputada' : 'partidas disputadas'} nesta competição. Selecione “Detalhes” para rever uma partida.`}</p>
        </div>
        {matches.length === 0 ? <EmptyState>Nenhuma partida foi disputada ainda.</EmptyState> : (
          <div className="space-y-5">
            {matchSections.map(group => (
              <section key={group.key} className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: 'var(--ui-line-subtle)' }}>
                  <h3 className="text-xs font-black tracking-[0.16em]" style={{ color: 'var(--ui-brand-strong)' }}>{group.title}</h3>
                  <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--ui-text-faint)' }}>{group.results.length} {group.results.length === 1 ? 'partida' : 'partidas'}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {group.results.map(match => {
                    const home = allTeams.find(team => team.id === match.result.homeTeamId);
                    const away = allTeams.find(team => team.id === match.result.awayTeamId);
                    const winner = match.result.winner ?? match.result.penaltyWinner;
                    const involvesPlayer = match.result.homeTeamId === localTeamId || match.result.awayTeamId === localTeamId;
                    const outcomeLabel = !involvesPlayer ? null : winner === localTeamId ? 'SUA VITÓRIA' : winner == null ? 'EMPATE' : 'SUA DERROTA';
                    const outcomeColor = winner === localTeamId ? 'var(--ui-success)' : winner == null ? 'var(--ui-warning)' : 'var(--ui-danger)';
                    return (
                      <article key={match.key} className="rounded-xl border p-3 sm:p-4" style={{ background: 'var(--ui-surface-1)', borderColor: involvesPlayer ? 'color-mix(in srgb, var(--ui-brand) 30%, var(--ui-line-subtle))' : 'var(--ui-line-subtle)' }}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ui-text-faint)' }}>{match.stage}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            {match.result.durationMinutes === 120 && <span className="text-[10px] font-bold" style={{ color: 'var(--ui-text-faint)' }}>PRORROGAÇÃO</span>}
                            {outcomeLabel && <span className="rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide" style={{ color: outcomeColor, background: `color-mix(in srgb, ${outcomeColor} 13%, transparent)` }}>{outcomeLabel}</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
                            <span className="min-w-0 truncate text-right text-xs font-bold sm:text-sm" style={{ color: winner === match.result.homeTeamId ? 'var(--ui-text)' : 'var(--ui-text-muted)' }}>{home?.name ?? match.result.homeTeamId}</span>
                            <Crest crestId={home?.crestId} name={home?.name ?? match.result.homeTeamId} size={22} />
                          </div>
                          <ResultScore result={match.result} />
                          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                            <Crest crestId={away?.crestId} name={away?.name ?? match.result.awayTeamId} size={22} />
                            <span className="min-w-0 truncate text-xs font-bold sm:text-sm" style={{ color: winner === match.result.awayTeamId ? 'var(--ui-text)' : 'var(--ui-text-muted)' }}>{away?.name ?? match.result.awayTeamId}</span>
                          </div>
                          <Button type="button" intent="secondary" aria-label={`${loadingMatchKey === match.key ? 'Carregando detalhes' : 'Ver detalhes'}: ${home?.name ?? 'mandante'} contra ${away?.name ?? 'visitante'}`} disabled={loadingMatchKey !== null} onClick={() => void openMatchDetails(match)} className="min-h-9 shrink-0 px-2.5 text-xs">
                            {loadingMatchKey === match.key ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}<span className="hidden sm:inline">{loadingMatchKey === match.key ? 'CARREGANDO' : 'DETALHES'}</span>
                          </Button>
                        </div>
                        {match.result.penaltyWinner && <div className="mt-2 text-center text-xs font-bold" style={{ color: 'var(--ui-warning)' }}>Pênaltis · {match.result.homePenalties}–{match.result.awayPenalties}</div>}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {detailsMatch && <MatchDetailsModal
          result={detailsMatch.result}
          homeTeam={getTeamById(detailsMatch.result.homeTeamId)}
          awayTeam={getTeamById(detailsMatch.result.awayTeamId)}
          homeName={allTeams.find(team => team.id === detailsMatch.result.homeTeamId)?.name ?? detailsMatch.result.homeTeamId}
          awayName={allTeams.find(team => team.id === detailsMatch.result.awayTeamId)?.name ?? detailsMatch.result.awayTeamId}
          isKnockout={detailsMatch.isKnockout}
          isFinal={detailsMatch.isFinal}
          localTeamId={localTeamId}
          onClose={() => setDetailsMatch(null)}
        />}
      </div>
    );
  }

  const categories: Array<{ id: StatsCategory; label: string }> = [
    { id: 'squad', label: 'MEU ELENCO' },
    ...(!isLocalPartial ? [
      { id: 'goals' as const, label: 'GOLS' }, { id: 'assists' as const, label: 'ASSISTÊNCIAS' }, { id: 'ratings' as const, label: 'NOTA MÉDIA' },
      { id: 'keepers' as const, label: 'GOLEIROS' }, { id: 'tackles' as const, label: 'DESARMES' }, { id: 'cards' as const, label: 'DISCIPLINA' },
    ] : []),
  ];
  const titles: Record<StatsCategory, string> = {
    squad: 'ESTATÍSTICAS DO MEU ELENCO', goals: 'ARTILHARIA · TOP 15', assists: 'ASSISTÊNCIAS · TOP 15', ratings: 'MELHORES NOTAS · TOP 15',
    keepers: 'DEFESAS · TOP 15', tackles: 'DESARMES · TOP 15', cards: 'DISCIPLINA · TOP 15',
  };
  const descriptions: Record<StatsCategory, string> = {
    squad: isLocalPartial
      ? 'Os números consideram as partidas disputadas até o fim da sua campanha. Abra cada jogador para ver os detalhes.'
      : 'Todos os seus jogadores, inclusive reservas e quem ainda não entrou em campo. Abra cada linha para ver os números completos.',
    goals: 'Jogadores com ao menos um gol. A nota média considera quem disputou pelo menos três jogos.',
    assists: 'Jogadores com ao menos uma assistência registrada.', ratings: `Jogadores com pelo menos ${MIN_MATCHES_FOR_RATING_LEADER} jogos, ordenados pela nota média.`,
    keepers: 'Goleiros que já atuaram, ordenados pelo total de defesas.', tackles: 'Jogadores com ao menos um desarme.', cards: 'Jogadores que receberam cartões, ordenados pela pontuação disciplinar.',
  };
  const defaultSort: Record<StatsCategory, 'played' | 'goals' | 'assists' | 'rating' | 'saves' | 'tackles' | 'cards'> = {
    squad: 'played', goals: 'goals', assists: 'assists', ratings: 'rating', keepers: 'saves', tackles: 'tackles', cards: 'cards',
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl" style={{ color: 'var(--ui-text)' }}>{isLocalPartial ? 'ESTATÍSTICAS DA CAMPANHA' : 'ESTATÍSTICAS DA COMPETIÇÃO'}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isLocalPartial ? 'Como a competição continuou após sua eliminação, esta seção mostra somente os dados do seu elenco.' : 'Números acumulados das partidas oficiais, incluindo a fase de mata-mata.'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="tablist" aria-label="Categoria das estatísticas">
        {categories.map(category => <button key={category.id} id={`competition-stats-tab-${category.id}`} type="button" role="tab" aria-selected={statsCategory === category.id} aria-controls={`competition-stats-panel-${category.id}`} onClick={() => setStatsCategory(category.id)} className="ui-tab w-full justify-center text-xs sm:w-auto" data-active={statsCategory === category.id}>{category.label}</button>)}
      </div>
      <div id={`competition-stats-panel-${statsCategory}`} role="tabpanel" aria-labelledby={`competition-stats-tab-${statsCategory}`}>
        <PlayerSeasonStatsPanel
          key={statsCategory}
          rows={statsRows}
          title={titles[statsCategory]}
          description={descriptions[statsCategory]}
          emptyMessage={statsCategory === 'squad' ? 'Não há elenco disponível nesta campanha.' : 'Ainda não há jogadores registrados nesta categoria.'}
          defaultSort={defaultSort[statsCategory]}
        />
      </div>
    </div>
  );
}
