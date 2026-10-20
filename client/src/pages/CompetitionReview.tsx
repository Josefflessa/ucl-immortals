import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, CircleHelp, Eye, LoaderCircle, Table2, Trophy } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useTeams } from '../hooks/useTeams';
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

function StandingsTable({ entries, localTeamId }: { entries: ReturnType<typeof computeStandings>; localTeamId?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead>
          <tr className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ui-text-faint)', background: 'var(--ui-bg)' }}>
            <th className="px-3 py-3 text-center">#</th><th className="px-3 py-3">Time</th><th className="px-2 py-3 text-center">J</th><th className="px-2 py-3 text-center">V</th><th className="px-2 py-3 text-center">E</th><th className="px-2 py-3 text-center">D</th><th className="px-2 py-3 text-center">GP</th><th className="px-2 py-3 text-center">GC</th><th className="px-2 py-3 text-center">SG</th><th className="px-3 py-3 text-center">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--ui-line-subtle)' }}>
          {entries.map((entry, index) => {
            const goalDiff = entry.goalsFor - entry.goalsAgainst;
            const isLocal = entry.teamId === localTeamId;
            return (
              <tr key={entry.teamId} style={{ background: isLocal ? 'color-mix(in srgb, var(--ui-brand) 10%, var(--ui-surface-1))' : 'var(--ui-surface-1)' }}>
                <td className="px-3 py-3 text-center font-display" style={{ color: index < 4 ? 'var(--ui-brand-strong)' : 'var(--ui-text-faint)' }}>{index + 1}</td>
                <td className="max-w-[220px] truncate px-3 py-3 font-bold" style={{ color: isLocal ? 'var(--ui-brand-strong)' : 'var(--ui-text)' }}>{entry.teamName}{isLocal ? <span className="ml-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--ui-brand)' }}>Meu time</span> : null}</td>
                <td className="px-2 py-3 text-center tabular-nums">{entry.played}</td><td className="px-2 py-3 text-center tabular-nums">{entry.won}</td><td className="px-2 py-3 text-center tabular-nums">{entry.drawn}</td><td className="px-2 py-3 text-center tabular-nums">{entry.lost}</td><td className="px-2 py-3 text-center tabular-nums">{entry.goalsFor}</td><td className="px-2 py-3 text-center tabular-nums">{entry.goalsAgainst}</td><td className="px-2 py-3 text-center tabular-nums">{goalDiff > 0 ? `+${goalDiff}` : goalDiff}</td>
                <td className="px-3 py-3 text-center font-black tabular-nums" style={{ color: 'var(--ui-brand-strong)' }}>{entry.points}</td>
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
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display text-2xl" style={{ color: 'var(--ui-text)' }}>{isGroupFormat ? 'CLASSIFICAÇÃO DOS GRUPOS' : isLocalPartial ? 'CLASSIFICAÇÃO ATÉ AQUI' : 'CLASSIFICAÇÃO FINAL'}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isLocalPartial ? 'Dados atualizados até o encerramento da sua campanha.' : 'Tabela calculada com os resultados disputados nesta competição.'}</p>
        </div>
        {isGroupFormat ? groupTables.map(group => (
          <section key={group.groupId} className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--ui-line-subtle)', background: 'var(--ui-surface-1)' }}>
            <h3 className="border-b px-4 py-3 text-sm font-black tracking-widest" style={{ borderColor: 'var(--ui-line-subtle)', color: 'var(--ui-brand-strong)' }}>GRUPO {String.fromCharCode(65 + group.groupId)}</h3>
            <StandingsTable entries={group.entries} localTeamId={localTeamId} />
          </section>
        )) : (
          <section className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--ui-line-subtle)', background: 'var(--ui-surface-1)' }}>
            <StandingsTable entries={leagueTable} localTeamId={localTeamId} />
          </section>
        )}
        <p className="text-xs" style={{ color: 'var(--ui-text-faint)' }}>J: jogos · V: vitórias · E: empates · D: derrotas · GP/GC: gols pró/contra · SG: saldo · PTS: pontos</p>
      </div>
    );
  }

  if (section === 'bracket') {
    if (!bracket) return <EmptyState>O chaveamento ainda não foi iniciado nesta competição.</EmptyState>;
    const bracketRounds = KNOCKOUT_ROUNDS.map(({ key }) => ({
      key,
      label: knockoutRoundLabel(key, bracket.firstRoundSize),
      ties: key === 'quarters' ? bracket.quarterFinals ?? [] : key === 'semis' ? bracket.semiFinals ?? [] : key === 'final' ? bracket.final ? [bracket.final] : [] : bracket[key] ?? [],
    })).filter(round => round.ties.some((tie: any) => tie.homeTeamId || tie.awayTeamId || tie.played));
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display text-2xl" style={{ color: 'var(--ui-text)' }}>CHAVEAMENTO</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isLocalPartial ? 'Apenas confrontos e resultados registrados até o fim da sua campanha.' : 'Confrontos, placares agregados e classificados de cada fase.'}</p>
        </div>
        {bracketRounds.length === 0 ? <EmptyState>Nenhum confronto do mata-mata foi definido.</EmptyState> : bracketRounds.map(round => (
          <section key={round.key} className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-black tracking-[0.16em]" style={{ color: 'var(--ui-brand-strong)' }}><Trophy size={14} aria-hidden="true" />{round.label.toUpperCase()}</h3>
            <div className="grid gap-2 lg:grid-cols-2">
              {round.ties.map((tie: any, index: number) => {
                const home = allTeams.find(team => team.id === tie.homeTeamId);
                const away = allTeams.find(team => team.id === tie.awayTeamId);
                const finalResult: MatchResult | undefined = tie.result;
                const winnerId = finalResult?.winner ?? finalResult?.penaltyWinner;
                const aggregate = tie.leg1 && tie.leg2 ? finalResult : null;
                const id = tie.id ?? `${round.key}-${index}`;
                return (
                  <article key={id} className="rounded-xl border p-3 sm:p-4" style={{ background: 'var(--ui-surface-1)', borderColor: winnerId === localTeamId ? 'color-mix(in srgb, var(--ui-brand) 48%, var(--ui-line-subtle))' : 'var(--ui-line-subtle)' }}>
                    <div className="space-y-2">
                      {[{ team: home, teamId: tie.homeTeamId, score: aggregate?.homeGoals ?? (tie.isSingleLeg ? finalResult?.homeGoals : null) }, { team: away, teamId: tie.awayTeamId, score: aggregate?.awayGoals ?? (tie.isSingleLeg ? finalResult?.awayGoals : null) }].map((row, rowIndex) => (
                        <div key={`${id}-${rowIndex}`} className="flex items-center gap-2">
                          {winnerId === row.teamId ? <Check size={15} className="shrink-0 text-emerald-400" aria-label="Classificado" /> : <span className="w-[15px] shrink-0" />}
                          <span className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: row.teamId === localTeamId ? 'var(--ui-brand-strong)' : 'var(--ui-text)' }}>{row.team?.name ?? 'A definir'}</span>
                          <span className="font-display text-xl tabular-nums" style={{ color: finalResult ? 'var(--ui-text)' : 'var(--ui-text-faint)' }}>{row.score ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                    {aggregate && <div className="mt-2 border-t pt-2 text-xs font-bold" style={{ borderColor: 'var(--ui-line-subtle)', color: 'var(--ui-text-muted)' }}>Placar agregado{finalResult?.penaltyWinner ? ` · decidido nos pênaltis` : ''}</div>}
                    {tie.leg1 && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs" style={{ borderColor: 'var(--ui-line-subtle)', color: 'var(--ui-text-muted)' }}>
                      <span>Ida: {allTeams.find(team => team.id === tie.leg1.homeTeamId)?.name ?? tie.leg1.homeTeamId} {tie.leg1.homeGoals}–{tie.leg1.awayGoals} {allTeams.find(team => team.id === tie.leg1.awayTeamId)?.name ?? tie.leg1.awayTeamId}</span>
                      {tie.leg2 && <span>Volta: {allTeams.find(team => team.id === tie.leg2.homeTeamId)?.name ?? tie.leg2.homeTeamId} {tie.leg2.homeGoals}–{tie.leg2.awayGoals} {allTeams.find(team => team.id === tie.leg2.awayTeamId)?.name ?? tie.leg2.awayTeamId}</span>}
                    </div>}
                    {!tie.played && <div className="mt-2 text-xs" style={{ color: 'var(--ui-text-faint)' }}>{tie.leg1 ? 'Aguardando jogo de volta' : 'Confronto ainda não disputado'}</div>}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (section === 'matches') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-2xl" style={{ color: 'var(--ui-text)' }}>HISTÓRICO DE PARTIDAS</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isLocalPartial ? 'Resultados disputados até o encerramento da sua campanha.' : `${matches.length} ${matches.length === 1 ? 'partida disputada' : 'partidas disputadas'} nesta competição.`}</p>
        </div>
        {matches.length === 0 ? <EmptyState>Nenhuma partida foi disputada ainda.</EmptyState> : (
          <div className="space-y-2">
            {matches.map(match => {
              const home = allTeams.find(team => team.id === match.result.homeTeamId);
              const away = allTeams.find(team => team.id === match.result.awayTeamId);
              const winner = match.result.winner ?? match.result.penaltyWinner;
              return (
                <article key={match.key} className="rounded-xl border p-3 sm:p-4" style={{ background: 'var(--ui-surface-1)', borderColor: 'var(--ui-line-subtle)' }}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ui-text-faint)' }}>{match.stage}</span>
                    <span className="shrink-0 text-[11px] font-bold" style={{ color: 'var(--ui-text-faint)' }}>{match.result.durationMinutes === 120 ? 'Prorrogação' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="min-w-0 flex-1 truncate text-right text-sm font-bold" style={{ color: winner === match.result.homeTeamId ? 'var(--ui-text)' : 'var(--ui-text-muted)' }}>{home?.name ?? match.result.homeTeamId}</span>
                    <ResultScore result={match.result} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: winner === match.result.awayTeamId ? 'var(--ui-text)' : 'var(--ui-text-muted)' }}>{away?.name ?? match.result.awayTeamId}</span>
                    <Button type="button" intent="secondary" aria-label={`${loadingMatchKey === match.key ? 'Carregando detalhes' : 'Ver detalhes'}: ${home?.name ?? 'mandante'} contra ${away?.name ?? 'visitante'}`} disabled={loadingMatchKey !== null} onClick={() => void openMatchDetails(match)} className="min-h-9 shrink-0 px-2.5 text-xs">
                      {loadingMatchKey === match.key ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}<span className="hidden sm:inline">{loadingMatchKey === match.key ? 'CARREGANDO' : 'DETALHES'}</span>
                    </Button>
                  </div>
                  {match.result.penaltyWinner && <div className="mt-2 text-center text-xs font-bold" style={{ color: 'var(--ui-warning)' }}>Decidida nos pênaltis · {match.result.homePenalties}–{match.result.awayPenalties}</div>}
                </article>
              );
            })}
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
    squad: 'Todos os seus jogadores, inclusive reservas e quem ainda não entrou em campo. Abra cada linha para ver os números completos.',
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
        <h2 className="font-display text-2xl" style={{ color: 'var(--ui-text)' }}>ESTATÍSTICAS DA COMPETIÇÃO</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--ui-text-muted)' }}>{isLocalPartial ? 'Sua campanha foi encerrada. Os dados do seu elenco consideram somente as partidas registradas até aqui.' : 'Números acumulados das partidas oficiais, incluindo a fase de mata-mata.'}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Categoria das estatísticas">
        {categories.map(category => <button key={category.id} id={`competition-stats-tab-${category.id}`} type="button" role="tab" aria-selected={statsCategory === category.id} aria-controls={`competition-stats-panel-${category.id}`} onClick={() => setStatsCategory(category.id)} className="ui-tab shrink-0 text-xs" data-active={statsCategory === category.id}>{category.label}</button>)}
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
