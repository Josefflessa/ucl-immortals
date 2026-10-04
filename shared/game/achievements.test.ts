import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_ID,
  achievementGoalText,
  evaluateAchievements,
  rarityLabel,
  sanitizeShowcase,
  SHOWCASE_MAX_ITEMS,
  summarizeCareer,
  type CareerCompetition,
} from './achievements';

const DAY = 24 * 60 * 60 * 1000;
let clock = Date.UTC(2026, 9, 1, 15);
const campaign = (over: Partial<CareerCompetition> = {}): CareerCompetition => ({
  difficultyId: 'gold',
  mode: 'solo',
  finishStage: 'leaguePhase',
  champion: false,
  wins: 4,
  draws: 2,
  losses: 3,
  games: 9,
  goals: 15,
  goalsAgainst: 12,
  humanPlayers: null,
  coachId: 'guardiola',
  crestId: 'real-madrid',
  completedAt: (clock += 60_000),
  rankingPoints: 2,
  topPlayerGoals: 6,
  topPlayerAssists: 4,
  topKeeperSaves: 18,
  topPlayerOverall: 92,
  ...over,
});
const title = (over: Partial<CareerCompetition> = {}) => campaign({ finishStage: 'champion', champion: true, wins: 12, draws: 2, losses: 1, games: 15, goals: 35, ...over });
const metricsOf = (career: CareerCompetition[]) => summarizeCareer(career).metrics;
const levelOf = (competitions: CareerCompetition[], id: string) => evaluateAchievements(competitions).find(entry => entry.id === id)!;

describe('achievement definitions', () => {
  it('has 40 unique achievements with strictly increasing thresholds', () => {
    expect(ACHIEVEMENTS).toHaveLength(40);
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map(a => a.name)).size).toBe(ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) {
      const [a, b, c, d] = achievement.thresholds;
      expect(a).toBeGreaterThan(0);
      expect(a < b && b < c && c < d).toBe(true);
    }
  });
});

describe('goal texts', () => {
  it('use the singular for a single time and the plural otherwise', () => {
    const immortal = ACHIEVEMENT_BY_ID.get('immortal_legend')!;
    expect(achievementGoalText(immortal, 0)).toBe('Seja campeão no Imortal');
    expect(achievementGoalText(immortal, 1)).toBe('Seja campeão 3 vezes no Imortal');
    expect(achievementGoalText(ACHIEVEMENT_BY_ID.get('iron_wall')!, 0)).toBe('Seja campeão sofrendo no máximo 10 gols');
    expect(achievementGoalText(ACHIEVEMENT_BY_ID.get('goal_machine')!, 2)).toBe('Marque 2.000 gols na carreira');
    for (const achievement of ACHIEVEMENTS) {
      for (const tier of [0, 1, 2, 3]) expect(achievementGoalText(achievement, tier)).not.toMatch(/(^|\s)1 vezes/);
    }
  });
});

describe('career evaluation', () => {
  it('counts titles, streaks and per-difficulty titles from the history order', () => {
    const career = [title(), title({ difficultyId: 'immortal' }), campaign(), title({ difficultyId: 'bronze' }), title(), title()];
    expect(metricsOf(career)).toMatchObject({ titles: 5, bestTitleStreak: 3, titleDifficulties: 3, immortalTitles: 1, competitions: 6, goldOrAboveTitles: 4 });
    expect(levelOf(career, 'trophy_collector')).toMatchObject({ level: 2, progress: 5 });
    expect(levelOf(career, 'dynasty')).toMatchObject({ level: 2, progress: 3 });
    expect(levelOf(career, 'ladder')).toMatchObject({ level: 2, progress: 3 });
  });

  it('only campaign facts count: unbeaten, perfect and tight titles, best single campaign', () => {
    const career = [
      title({ losses: 0, draws: 0, goalsAgainst: 8 }),
      title({ losses: 0, draws: 1, goalsAgainst: 20 }),
      title({ losses: 2, goalsAgainst: 5 }),
      campaign({ losses: 0, goals: 52, goalsAgainst: 10, wins: 13 }), // not champion: no Invicto
    ];
    const metrics = metricsOf(career);
    expect(metrics).toMatchObject({ unbeatenTitles: 2, perfectTitles: 1, tightTitles: 2, bestCompetitionGoals: 52, bestCompetitionWins: 13, bestGoalDifference: 42 });
    expect(levelOf(career, 'firepower').level).toBe(3);
    expect(levelOf(career, 'goal_difference').level).toBe(3);
  });

  it('finals, runner-ups and the qualified streak', () => {
    const career = [title(), campaign({ finishStage: 'runnerUp' }), campaign({ finishStage: 'playoff' }), campaign(), campaign({ finishStage: 'quarterfinalist' })];
    expect(metricsOf(career)).toMatchObject({ finals: 2, runnerUps: 1, qualified: 4, bestQualifiedStreak: 3, semifinalOrBetter: 2 });
  });

  it('best players of a campaign come from its records', () => {
    const career = [campaign({ topPlayerGoals: 21, topPlayerAssists: 9 }), campaign({ topKeeperSaves: 44, topPlayerOverall: 131 })];
    expect(metricsOf(career)).toMatchObject({ bestPlayerGoals: 21, bestPlayerAssists: 9, bestKeeperSaves: 44, bestPlayerOverall: 131 });
    expect(levelOf(career, 'top_scorer').level).toBe(3);
    expect(levelOf(career, 'galactic_squad').level).toBe(3);
  });

  it('loyalty follows the most used coach and crest, and reports which one', () => {
    const career = [
      ...Array.from({ length: 6 }, () => campaign({ coachId: 'ancelotti', crestId: 'milan' })),
      ...Array.from({ length: 4 }, () => campaign({ coachId: 'guardiola', crestId: 'milan' })),
    ];
    const partnership = levelOf(career, 'lasting_partnership');
    expect(partnership).toMatchObject({ level: 1, progress: 6, detail: 'ancelotti' });
    expect(levelOf(career, 'loyal_crest')).toMatchObject({ level: 1, progress: 10, detail: 'milan' });
    expect(levelOf(career, 'veteran').detail).toBeNull();
  });

  it('distinct coaches and crests with titles, difficulties played and active days', () => {
    clock = Date.UTC(2026, 9, 1, 15);
    const career = [
      title({ coachId: 'a', crestId: 'x', difficultyId: 'bronze' }),
      title({ coachId: 'b', crestId: 'x', completedAt: clock + DAY }),
      campaign({ difficultyId: 'immortal', completedAt: clock + 2 * DAY }),
      // 01:00 UTC is still the previous day in Brasília.
      campaign({ completedAt: Date.UTC(2026, 9, 4, 1) }),
    ];
    expect(metricsOf(career)).toMatchObject({ titleCoaches: 2, titleCrests: 1, difficultiesPlayed: 3, activeDays: 3 });
  });

  it('career totals: matches, ranking points and hard difficulties', () => {
    const career = [
      campaign({ games: 0, wins: 5, draws: 1, losses: 2, rankingPoints: 40, difficultyId: 'legendary' }),
      campaign({ games: 12, rankingPoints: 100, difficultyId: 'immortal', finishStage: 'semifinalist' }),
    ];
    expect(metricsOf(career)).toMatchObject({ matchesPlayed: 20, rankingPoints: 140, hardCompetitions: 2, immortalCompetitions: 1, immortalSemifinals: 1 });
  });

  it('online titles, crowded rooms and online feats', () => {
    const career = [
      title({ mode: 'online', humanPlayers: 4, losses: 0 }),
      title({ mode: 'online', humanPlayers: 2 }),
      title({ mode: 'online', humanPlayers: null }),
      campaign({ mode: 'online', finishStage: 'semifinalist' }),
    ];
    expect(metricsOf(career)).toMatchObject({ onlineTitles: 3, crowdedOnlineTitles: 1, onlineCompetitions: 4, onlineSemifinals: 4, onlineUnbeatenTitles: 1 });
  });

  it('an empty career has every achievement locked', () => {
    expect(evaluateAchievements([]).every(entry => entry.level === 0)).toBe(true);
  });
});

describe('showcase and rarity', () => {
  it('accepts known items only, without duplicates, up to the limit', () => {
    expect(sanitizeShowcase([{ type: 'achievement', id: 'veteran' }, { type: 'record', difficultyId: 'gold', category: 'goals' }]))
      .toEqual([{ type: 'achievement', id: 'veteran' }, { type: 'record', difficultyId: 'gold', category: 'goals' }]);
    expect(sanitizeShowcase([{ type: 'achievement', id: 'nope' }])).toBeNull();
    expect(sanitizeShowcase([{ type: 'record', difficultyId: 'easy', category: 'goals' }])).toBeNull();
    expect(sanitizeShowcase([{ type: 'achievement', id: 'veteran' }, { type: 'achievement', id: 'veteran' }])).toBeNull();
    expect(sanitizeShowcase(Array.from({ length: SHOWCASE_MAX_ITEMS + 1 }, () => ({ type: 'achievement', id: 'veteran' })))).toBeNull();
  });

  it('names rarity from the share of players', () => {
    expect([60, 30, 10, 2, 0.5].map(rarityLabel)).toEqual(['Comum', 'Incomum', 'Rara', 'Épica', 'Lendária']);
  });
});
