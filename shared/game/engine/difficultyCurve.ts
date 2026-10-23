// How hard the bots are, and how that grows through a campaign.
//
// A difficulty level sets two things: how good the bots are when the competition opens, and how much
// better they get by the final. The player's team grows along the way (new cards, traits that evolve,
// reinforcements), so the opposition grows too: the start is not a wall and the end is not a stroll.
//
// "Progress" runs from 0 (first round) to 1 (the final). Every round of the league counts one step and
// every knockout round one and a half, so the league warms up slowly and the knockout tightens fast,
// like a real competition where the survivors are the best sides.

import type { CompetitionFormat } from '../competition';
import type { Team } from './teamModel';

const LEAGUE_ROUND_WEIGHT = 1;
const KNOCKOUT_ROUND_WEIGHT = 1.6;

/** The bot strengths of the five levels (Bronze to Imortal): the stops the curves below are read at. */
const LEVEL_STRENGTHS = [0.45, 0.62, 0.75, 0.88, 0.97] as const;

/** Bot strength multiplier at the first round and at the final, per level. */
const MULTIPLIER_START = [0.928, 1.007, 1.059, 1.07, 1.086] as const;
const MULTIPLIER_END = [1.196, 1.254, 1.259, 1.275, 1.317] as const;

function atLevel(table: readonly number[], strength: number): number {
  if (strength <= LEVEL_STRENGTHS[0]) return table[0];
  for (let i = 0; i < LEVEL_STRENGTHS.length - 1; i++) {
    if (strength <= LEVEL_STRENGTHS[i + 1]) {
      const u = (strength - LEVEL_STRENGTHS[i]) / (LEVEL_STRENGTHS[i + 1] - LEVEL_STRENGTHS[i]);
      return table[i] + (table[i + 1] - table[i]) * u;
    }
  }
  return table[table.length - 1];
}

/** The multiplier on a bot's strength at a point of the campaign (0 = first round, 1 = the final). */
export function botStrengthMultiplier(botStrength: number, progress = 0): number {
  const p = Math.max(0, Math.min(1, progress));
  const start = atLevel(MULTIPLIER_START, botStrength);
  const end = atLevel(MULTIPLIER_END, botStrength);
  return start + (end - start) * p;
}

/** How many knockout rounds a format plays (24 teams: playoff, round of 16, quarters, semis, final). */
export function knockoutRoundCount(format: CompetitionFormat): number {
  if (format.id === 'league') return 0;
  const entrants = format.id === 'knockout' ? format.teamCount : format.qualifiedTeams;
  return entrants >= 2 ? Math.ceil(Math.log2(entrants)) : 0;
}

/** How many rounds of league (or of the group stage) come before the knockout. */
export function leagueStageCount(format: CompetitionFormat): number {
  if (format.id === 'knockout') return 0;
  return format.id === 'groups_knockout' ? format.groupRounds || format.leagueRounds : format.leagueRounds;
}

export type CampaignStage =
  | { phase: 'league'; round: number }
  /** `fromFinal`: 0 for the final, 1 for the semis, 2 for the quarters, and so on back. */
  | { phase: 'knockout'; fromFinal: number };

/** 0 at the first round of the competition, 1 at the final. */
export function campaignProgress(format: CompetitionFormat | undefined, stage: CampaignStage): number {
  if (!format) return 0;
  const leagueRounds = Math.max(0, leagueStageCount(format));
  const knockoutRounds = knockoutRoundCount(format);
  const total = leagueRounds * LEAGUE_ROUND_WEIGHT + knockoutRounds * KNOCKOUT_ROUND_WEIGHT;
  // The last stage is where the curve ends: what counts is the weight of everything before it.
  const span = total - (knockoutRounds > 0 ? KNOCKOUT_ROUND_WEIGHT : LEAGUE_ROUND_WEIGHT);
  if (span <= 0) return 0;
  let before: number;
  if (stage.phase === 'league') {
    before = (Math.max(1, Math.min(leagueRounds || 1, stage.round)) - 1) * LEAGUE_ROUND_WEIGHT;
  } else {
    const index = Math.max(0, knockoutRounds - 1 - Math.max(0, stage.fromFinal));
    before = leagueRounds * LEAGUE_ROUND_WEIGHT + index * KNOCKOUT_ROUND_WEIGHT;
  }
  return Math.max(0, Math.min(1, before / span));
}

/** How far a knockout round is from the final (the bracket names its rounds). */
export function roundsFromFinal(round: string): number {
  switch (round) {
    case 'final': return 0;
    case 'semis': case 'semiFinals': case 'semi': return 1;
    case 'quarters': case 'quarterFinals': return 2;
    case 'round16': return 3;
    default: return 4; // playoffs
  }
}

/** A bot carries the point of the campaign it plays at, so its strength can grow with it. */
export function withCampaignProgress<T extends Team>(team: T, progress: number): T {
  return team.isBot ? { ...team, campaignProgress: progress } : team;
}
