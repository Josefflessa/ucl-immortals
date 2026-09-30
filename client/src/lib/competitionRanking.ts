export const COMPETITION_RANKING_POINTS = {
  champion: 100,
  runnerUp: 80,
  semifinalist: 60,
  quarterfinalist: 40,
  roundOf16: 25,
  playoff: 15,
  leaguePhase: 5,
} as const;

interface PlacementMatch {
  homeTeamId: string;
  awayTeamId: string;
  played?: boolean;
  result?: { winner?: string | null };
}

interface PlacementBracket {
  playoffs?: PlacementMatch[];
  round16?: PlacementMatch[];
  quarterFinals?: PlacementMatch[];
  semiFinals?: PlacementMatch[];
  final?: PlacementMatch | null;
}

function lostAtStage(matches: PlacementMatch[] | undefined, teamId: string): boolean {
  return Boolean(matches?.some(match =>
    match.played === true
    && (match.homeTeamId === teamId || match.awayTeamId === teamId)
    && typeof match.result?.winner === 'string'
    && match.result.winner !== teamId,
  ));
}

/** Awards a single end-of-competition score based on the last knockout stage reached. */
export function competitionRankingPoints(
  teamId: string,
  championId: string | null | undefined,
  bracket?: PlacementBracket | null,
): number {
  if (championId === teamId) return COMPETITION_RANKING_POINTS.champion;

  const final = bracket?.final;
  if (final?.played && (final.homeTeamId === teamId || final.awayTeamId === teamId)) {
    return COMPETITION_RANKING_POINTS.runnerUp;
  }
  if (lostAtStage(bracket?.semiFinals, teamId)) return COMPETITION_RANKING_POINTS.semifinalist;
  if (lostAtStage(bracket?.quarterFinals, teamId)) return COMPETITION_RANKING_POINTS.quarterfinalist;
  if (lostAtStage(bracket?.round16, teamId)) return COMPETITION_RANKING_POINTS.roundOf16;
  if (lostAtStage(bracket?.playoffs, teamId)) return COMPETITION_RANKING_POINTS.playoff;
  return COMPETITION_RANKING_POINTS.leaguePhase;
}
