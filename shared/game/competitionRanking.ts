// UCL Immortals — account ranking points.
// One table of finish stages (the furthest stage a campaign reached) and one
// weight per difficulty. Both client and server read from here, so the points a
// campaign is worth are defined exactly once.

/** Furthest stage a campaign reached, best first. */
export const COMPETITION_FINISH_STAGES = [
  'champion',
  'runnerUp',
  'semifinalist',
  'quarterfinalist',
  'roundOf16',
  'playoff',
  'leaguePhase',
] as const;
export type CompetitionFinishStage = (typeof COMPETITION_FINISH_STAGES)[number];

/** Points per finish stage at full weight (Imortal). */
export const COMPETITION_RANKING_POINTS: Record<CompetitionFinishStage, number> = {
  champion: 100,
  runnerUp: 80,
  semifinalist: 60,
  quarterfinalist: 40,
  roundOf16: 25,
  playoff: 15,
  leaguePhase: 5,
};

/** Difficulties an account can play for ranking points, easiest first. */
export const RANKED_DIFFICULTY_IDS = ['bronze', 'silver', 'gold', 'legendary', 'immortal'] as const;
export type RankedDifficultyId = (typeof RANKED_DIFFICULTY_IDS)[number];

/**
 * Share of the full points each difficulty is worth, in whole percent so the
 * rounding is exact (15 × 0.7 is 10.4999… in floating point). The curve is
 * steep on purpose: a campaign takes the same time on every difficulty, so a
 * title on Bronze must never be worth more than a deep run on Imortal.
 */
export const DIFFICULTY_POINT_WEIGHT_PERCENT: Record<RankedDifficultyId, number> = {
  bronze: 10,
  silver: 25,
  gold: 45,
  legendary: 70,
  immortal: 100,
};

export function isRankedDifficulty(id: unknown): id is RankedDifficultyId {
  return typeof id === 'string' && (RANKED_DIFFICULTY_IDS as readonly string[]).includes(id);
}

export function isCompetitionFinishStage(stage: unknown): stage is CompetitionFinishStage {
  return typeof stage === 'string' && (COMPETITION_FINISH_STAGES as readonly string[]).includes(stage);
}

/** Points a finish stage is worth on a difficulty (at least 1 for any finish). */
export function competitionStagePoints(stage: CompetitionFinishStage, difficultyId: RankedDifficultyId): number {
  const weighted = Math.round((COMPETITION_RANKING_POINTS[stage] * DIFFICULTY_POINT_WEIGHT_PERCENT[difficultyId]) / 100);
  return Math.max(1, weighted);
}

/**
 * Stage of a campaign stored before stages were recorded. Those campaigns were
 * all scored with the full table, so the stored points identify the stage.
 */
export function finishStageFromLegacyPoints(points: unknown, champion?: unknown): CompetitionFinishStage | null {
  if (champion === true || champion === 1) return 'champion';
  const value = Number(points);
  return COMPETITION_FINISH_STAGES.find(stage => COMPETITION_RANKING_POINTS[stage] === value) ?? null;
}

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

/** The last knockout stage a team reached in a finished competition. */
export function competitionFinishStage(
  teamId: string,
  championId: string | null | undefined,
  bracket?: PlacementBracket | null,
): CompetitionFinishStage {
  if (championId === teamId) return 'champion';

  const final = bracket?.final;
  if (final?.played && (final.homeTeamId === teamId || final.awayTeamId === teamId)) return 'runnerUp';
  if (lostAtStage(bracket?.semiFinals, teamId)) return 'semifinalist';
  if (lostAtStage(bracket?.quarterFinals, teamId)) return 'quarterfinalist';
  if (lostAtStage(bracket?.round16, teamId)) return 'roundOf16';
  if (lostAtStage(bracket?.playoffs, teamId)) return 'playoff';
  return 'leaguePhase';
}

/** Awards a single end-of-competition score: finish stage weighted by difficulty. */
export function competitionRankingPoints(
  teamId: string,
  championId: string | null | undefined,
  bracket?: PlacementBracket | null,
  difficultyId: RankedDifficultyId = 'immortal',
): number {
  return competitionStagePoints(competitionFinishStage(teamId, championId, bracket), difficultyId);
}
