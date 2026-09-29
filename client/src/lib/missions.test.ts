import { describe, expect, it } from 'vitest';
import type { MatchResult, PlayerCard, Team } from './gameEngine';
import {
  acceptMission,
  createMissionMatchContext,
  createMissionState,
  dismissMissionResolution,
  extendActiveMissionDeadlines,
  canRerollMissionBoard,
  MISSION_CATALOG,
  MISSION_MAP,
  missionDeadline,
  missionReward,
  missionRemovalCost,
  removeMission,
  rerollMissionBoard,
  updateMissionsAfterMatch,
} from './missions';
import { HISTORICAL_TRIOS } from './gameData';

function player(id: string, extra: Partial<PlayerCard> = {}): PlayerCard {
  return {
    id,
    shortName: id,
    fullName: id,
    position: 'ST',
    secondaryPositions: [],
    nation: 'Brasil',
    club: 'Clube',
    season: '2025/26',
    overall: 85,
    pace: 80,
    shooting: 80,
    passing: 80,
    dribbling: 80,
    defending: 40,
    physical: 70,
    composure: 70,
    vision: 70,
    chemistryScore: 2,
    isOOP: false,
    ...extra,
  } as PlayerCard;
}

function team(id: string, players: PlayerCard[], extra: Partial<Team> = {}): Team {
  return {
    id,
    name: id,
    coachId: 'guardiola',
    formationId: '4-3-3',
    playStyle: 'balanced',
    players,
    totalChemistry: 70,
    isBot: id !== 'home',
    ...extra,
  };
}

function result(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeGoals: 1,
    awayGoals: 0,
    winner: 'home',
    durationMinutes: 90,
    events: [{ minute: 12, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' }],
    stats: {
      homePos: 55,
      awayPos: 45,
      homeShots: 10,
      awayShots: 5,
      homeShotsOnTarget: 6,
      awayShotsOnTarget: 1,
      homeFouls: 0,
      awayFouls: 0,
      homeSaves: 1,
      awaySaves: 5,
      homeCorners: 10,
      awayCorners: 2,
    },
    playerStats: {
      'home::h1': { playerId: 'h1', playerName: 'h1', teamId: 'home', rating: 8, goals: 1, assists: 0, shots: 3, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
    },
    ...overrides,
  };
}

describe('mission board', () => {
  it('contains the expanded catalog, rarity missions and no duplicate ids', () => {
    expect(MISSION_CATALOG).toHaveLength(207);
    expect(new Set(MISSION_CATALOG.map(definition => definition.id)).size).toBe(207);
    expect(MISSION_MAP.dominance_complete).toBeDefined();
    expect(MISSION_MAP.five_wins).toBeDefined();
    expect(MISSION_MAP.prodigy_goals_win).toBeDefined();
    expect(MISSION_MAP.chemistry_superior).toBeUndefined();
    expect(MISSION_MAP.efficiency_lethal).toBeUndefined();
    expect(MISSION_MAP.wall).toBeUndefined();
    expect(MISSION_MAP.absolute_pressure).toBeUndefined();
    expect(MISSION_MAP.no_conceded_corners).toBeUndefined();
    expect(MISSION_MAP.total_block).toBeUndefined();
    expect(MISSION_MAP.martir_win).toBeDefined();
    expect(MISSION_MAP.double_in_form_win).toBeDefined();
    expect(MISSION_MAP.nomade_decisive_win).toBeDefined();
    expect(MISSION_MAP.two_goal_margin_win).toBeDefined();
    expect(MISSION_MAP.three_goal_margin_win).toBeDefined();
    expect(MISSION_MAP.second_half_clean_win).toBeDefined();
    expect(MISSION_MAP.level_at_half_win).toBeDefined();
    expect(MISSION_MAP.late_comeback_win).toBeDefined();
    expect(MISSION_MAP.first_last_goal_win).toBeDefined();
    expect(MISSION_MAP.two_assists_same_player_win).toBeDefined();
    expect(MISSION_MAP.two_assistors_win).toBeDefined();
    expect(MISSION_MAP.two_defenders_score_win).toBeDefined();
    expect(MISSION_MAP.two_midfielders_score_win).toBeDefined();
    expect(MISSION_MAP.all_sectors_score_win).toBeDefined();
    expect(MISSION_MAP.three_same_half_goals_win).toBeDefined();
    expect(MISSION_MAP.two_each_half_win).toBeDefined();
    expect(MISSION_MAP.equalizer_retake_lead_win).toBeDefined();
    expect(MISSION_MAP.fifteen_shots_win).toBeDefined();
    expect(MISSION_MAP.five_corners_win).toBeDefined();
    expect(MISSION_MAP.no_opponent_target_shots_win).toBeDefined();
    expect(MISSION_MAP.more_target_shots_win).toBeDefined();
    expect(MISSION_MAP.more_corners_win).toBeDefined();
    expect(MISSION_MAP.balanced_tactic_win).toBeDefined();
    expect(MISSION_MAP.pressing_433_win).toBeDefined();
    expect(MISSION_MAP.possession_532_win).toBeDefined();
    expect(MISSION_MAP.coach_identity_chemistry_win).toBeDefined();
    expect(MISSION_MAP.mid_chemistry_win).toBeDefined();
    expect(MISSION_MAP.goleador_two_goals_win).toBeDefined();
    expect(MISSION_MAP.garcom_assist_win).toBeDefined();
    expect(MISSION_MAP.in_form_goal_win).toBeDefined();
    expect(MISSION_MAP.all_regular_rarities_win).toBeDefined();
    expect(MISSION_MAP.all_rarities_win).toBeDefined();
    expect(MISSION_MAP.one_unique_win).toBeDefined();
  });

  it('evaluates rarity missions with and without Unique cards', () => {
    const rarities = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'] as const;
    const home = team('home', [
      ...rarities.map((rarity, index) => player(`rarity-${index}`, { rarity })),
      ...Array.from({ length: 5 }, (_, index) => player(`extra-${index}`, { rarity: 'bronze' })),
    ]);
    const away = team('away', [player('a1')]);
    const context = createMissionMatchContext(home, away, result({
      playerStats: {},
      stats: { ...result().stats, homeFouls: 2, awayFouls: 5 },
    }))!;
    const stateFor = (missionId: string) => ({
      version: 1 as const,
      cycleKey: 'L1',
      boardIds: [missionId],
      active: [{ missionId, progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }],
      history: [],
      processedMatchKeys: [],
      missionResolution: null,
    });
    const completes = (missionId: string) => updateMissionsAfterMatch(stateFor(missionId), context, `L1:${missionId}`).completed;

    expect(completes('all_regular_rarities_win')).toEqual(['all_regular_rarities_win']);
    expect(completes('all_rarities_win')).toEqual(['all_rarities_win']);
    expect(completes('one_unique_win')).toEqual(['one_unique_win']);
    expect(completes('disciplined_marking_win')).toEqual(['disciplined_marking_win']);

    const regularOnly = team('home', [
      ...rarities.slice(0, 5).map((rarity, index) => player(`regular-${index}`, { rarity })),
      ...Array.from({ length: 6 }, (_, index) => player(`regular-extra-${index}`, { rarity: 'bronze' })),
    ]);
    const regularContext = createMissionMatchContext(regularOnly, away, result({ playerStats: {} }))!;
    const regularState = stateFor('all_rarities_win');
    expect(updateMissionsAfterMatch(regularState, regularContext, 'L1:regular-only').completed).toEqual([]);
  });

  it('creates a deterministic five-offer board and accepts at most two missions', () => {
    const first = createMissionState('seed', 'L1');
    const second = createMissionState('seed', 'L1');
    expect(first.boardIds).toHaveLength(5);
    expect(first.boardIds).toEqual(second.boardIds);
    expect(new Set(first.boardIds).size).toBe(5);
    expect(first.boardIds.every(id => MISSION_MAP[id])).toBe(true);

    const seenAcrossRounds = new Set<string>();
    for (let index = 0; index < 500; index++) {
      createMissionState(`seed-${index}`, 'L1').boardIds.forEach(id => seenAcrossRounds.add(id));
    }
    expect(seenAcrossRounds.has('three_wins')).toBe(true);
    expect(seenAcrossRounds.has('hat_trick')).toBe(true);
    expect(seenAcrossRounds.has('counter_tactic')).toBe(true);
    expect(seenAcrossRounds.size).toBeGreaterThan(150);

    const one = acceptMission(first, first.boardIds[0]);
    expect(one?.active).toHaveLength(1);
    const two = acceptMission(one!, first.boardIds[1]);
    expect(two?.active).toHaveLength(2);
    expect(acceptMission(two!, first.boardIds[2])).toBeNull();
  });

  it('awards a clean-sheet mission only after a regulation win', () => {
    const home = team('home', [player('h1')]);
    const away = team('away', [player('a1')]);
    const base = { version: 1 as const, cycleKey: 'L1', boardIds: ['clean_sheet_win'], active: [{ missionId: 'clean_sheet_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    const context = createMissionMatchContext(home, away, result());
    expect(context).not.toBeNull();
    const completed = updateMissionsAfterMatch(base, context!, 'L1:home:away');
    expect(completed.reward).toBe(55);
    expect(completed.completed).toEqual(['clean_sheet_win']);
    expect(completed.state.active).toHaveLength(0);
    expect(completed.state.missionResolution).toEqual({ matchKey: 'L1:home:away', completed: ['clean_sheet_win'], expired: [] });
    expect(dismissMissionResolution(completed.state).missionResolution).toBeNull();

    const extraTime = createMissionMatchContext(home, away, result({ durationMinutes: 120 }));
    const rejected = updateMissionsAfterMatch(base, extraTime!, 'K:extra');
    expect(rejected.reward).toBe(0);
    expect(rejected.expired).toEqual(['clean_sheet_win']);
    expect(rejected.state.missionResolution).toEqual({ matchKey: 'K:extra', completed: [], expired: ['clean_sheet_win'] });
  });

  it('applies all Núcleo de Missões effects through shared mission rules', () => {
    const state = {
      ...createMissionState('missions-effects', 'L1'),
      boardIds: ['first_win', 'clean_sheet_win', 'hat_trick', 'three_wins', 'counter_tactic'],
    };
    expect(missionDeadline('first_win', 1)).toBe(1);
    expect(missionDeadline('first_win', 4)).toBe(2);
    expect(missionReward('clean_sheet_win', 1)).toBe(55);
    expect(missionReward('clean_sheet_win', 5)).toBe(85);
    expect(missionRemovalCost('hat_trick', 1)).toBe(125);
    expect(missionRemovalCost('hat_trick', 3)).toBe(63);
    const accepted = acceptMission(state, 'first_win', 4);
    expect(accepted?.active[0].matchesRemaining).toBe(2);
    expect(extendActiveMissionDeadlines(accepted!, 3, 4).active[0].matchesRemaining).toBe(3);
  });

  it('permite um único reroll do mural por ciclo no nível 2', () => {
    const state = createMissionState('reroll', 'L1');
    expect(canRerollMissionBoard(state, 1)).toBe(false);
    expect(canRerollMissionBoard(state, 2)).toBe(true);
    const rerolled = rerollMissionBoard(state, 'reroll', 2);
    expect(rerolled).not.toBeNull();
    expect(rerolled?.boardIds).toHaveLength(5);
    expect(rerolled?.boardIds).not.toEqual(state.boardIds);
    expect(rerolled?.rerollUsedCycleKey).toBe('L1');
    expect(rerolled && canRerollMissionBoard(rerolled, 2)).toBe(false);
  });

  it('expires an unfinished mission and charges the rarity-based removal cost', () => {
    const state = createMissionState('seed', 'L1');
    const active = { ...state, boardIds: ['hat_trick'], active: [{ missionId: 'hat_trick', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }] };
    expect(missionRemovalCost('hat_trick')).toBe(125);
    expect(removeMission(active, 'hat_trick', 124)).toBeNull();
    const removed = removeMission(active, 'hat_trick', 125);
    expect(removed?.cost).toBe(125);
    expect(removed?.state.active).toHaveLength(0);
  });

  it('recognizes the Lobo chemistry challenge using the chemistry at kickoff', () => {
    const lobo = player('h1', { lobo: true });
    const home = team('home', [lobo], { totalChemistry: 40 });
    const away = team('away', [player('a1')]);
    const state = { version: 1 as const, cycleKey: 'L1', boardIds: ['lobo_win'], active: [{ missionId: 'lobo_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    const context = createMissionMatchContext(home, away, result());
    const updated = updateMissionsAfterMatch(state, context!, 'L1:lobo');
    expect(updated.completed).toEqual(['lobo_win']);
    expect(updated.reward).toBe(270);
  });

  it('recognizes a Coringa outside its natural positions and excludes it from the two secondary-position slots', () => {
    const homePlayers = [
      player('gk', { position: 'GK' }),
      player('lb', { position: 'LB' }),
      player('cb1', { position: 'CB' }),
      player('cb2', { position: 'CB' }),
      player('rb', { position: 'RB' }),
      player('secondary-1', { position: 'ST', secondaryPositions: ['CM'] }),
      player('cdm', { position: 'CDM' }),
      player('secondary-2', { position: 'ST', secondaryPositions: ['CM'] }),
      player('joker', { position: 'ST', coringa: true }),
      player('st', { position: 'ST' }),
      player('rw', { position: 'RW' }),
    ];
    const home = team('home', homePlayers);
    const away = team('away', [player('a1')]);
    const context = createMissionMatchContext(home, away, result())!;
    const stateFor = (missionId: string) => ({
      version: 1 as const,
      cycleKey: 'L1',
      boardIds: [missionId],
      active: [{ missionId, progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }],
      history: [],
      processedMatchKeys: [],
      missionResolution: null,
    });

    expect(updateMissionsAfterMatch(stateFor('coringa_win'), context, 'L1:coringa').completed)
      .toEqual(['coringa_win']);
    expect(updateMissionsAfterMatch(stateFor('coringa_adapted_win'), context, 'L1:coringa-adapted').completed)
      .toEqual(['coringa_adapted_win']);

    const oneSecondary = [...homePlayers];
    oneSecondary[7] = player('regular-cm', { position: 'CM' });
    const negativeContext = createMissionMatchContext(team('home', oneSecondary), away, result())!;
    expect(updateMissionsAfterMatch(stateFor('coringa_adapted_win'), negativeContext, 'L1:coringa-adapted-negative').completed)
      .toEqual([]);
  });

  it('detects that a team was still losing after minute 60 before scoring the equalizer', () => {
    const home = team('home', [player('h1'), player('h2')]);
    const away = team('away', [player('a1')]);
    const context = createMissionMatchContext(home, away, result({
      homeGoals: 2,
      awayGoals: 1,
      events: [
        { minute: 30, type: 'goal', description: 'gol', teamId: 'away', playerId: 'a1' },
        { minute: 70, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 80, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h2' },
      ],
    }))!;
    const state = { version: 1 as const, cycleKey: 'L1', boardIds: ['late_comeback_win'], active: [{ missionId: 'late_comeback_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    expect(updateMissionsAfterMatch(state, context, 'L1:late-comeback-after-cutoff').completed)
      .toEqual(['late_comeback_win']);
  });

  it('keeps the same formation for the new same-value streak mission', () => {
    const home = team('home', [player('h1')], { formationId: '4-4-2', playStyle: 'counter' });
    const away = team('away', [player('a1')]);
    const state = { version: 1 as const, cycleKey: 'L1', boardIds: ['same_formation_streak'], active: [{ missionId: 'same_formation_streak', progress: 0, matchesRemaining: 3, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    const context = createMissionMatchContext(home, away, result());
    const first = updateMissionsAfterMatch(state, context!, 'L1:one');
    const second = updateMissionsAfterMatch(first.state, context!, 'L1:two');
    const third = updateMissionsAfterMatch(second.state, context!, 'L1:three');
    expect(first.state.active[0].progress).toBe(1);
    expect(second.state.active[0].progress).toBe(2);
    expect(third.completed).toEqual(['same_formation_streak']);
  });

  it('evaluates the new position and assist-based match missions', () => {
    const homePlayers = [
      player('h1', { position: 'CB' }),
      player('h2', { position: 'CM' }),
      player('h3', { position: 'ST' }),
    ];
    const home = team('home', homePlayers);
    const away = team('away', [player('a1')]);
    const match = result({
      events: [
        { minute: 12, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 28, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h2' },
      ],
      playerStats: {
        'home::h1': { playerId: 'h1', playerName: 'h1', teamId: 'home', rating: 8, goals: 1, assists: 1, shots: 3, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
        'home::h2': { playerId: 'h2', playerName: 'h2', teamId: 'home', rating: 8, goals: 1, assists: 1, shots: 3, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
        'home::h3': { playerId: 'h3', playerName: 'h3', teamId: 'home', rating: 8, goals: 0, assists: 1, shots: 3, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
      },
    });
    const context = createMissionMatchContext(home, away, match)!;
    const defenderState = { version: 1 as const, cycleKey: 'L1', boardIds: ['defender_goal_win'], active: [{ missionId: 'defender_goal_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    const assistState = { ...defenderState, boardIds: ['three_assistors'], active: [{ missionId: 'three_assistors', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }] };
    expect(updateMissionsAfterMatch(defenderState, context, 'L1:defender').completed).toEqual(['defender_goal_win']);
    expect(updateMissionsAfterMatch(assistState, context, 'L1:assist').completed).toEqual(['three_assistors']);
  });

  it('evaluates the approved expansion across match events, stats and setup', () => {
    const homePlayers = [
      player('h1', { position: 'CB', goleador: true }),
      player('h2', { position: 'CM', garcom: true }),
      player('h3', { position: 'ST', inForm: true }),
    ];
    const home = team('home', homePlayers, { totalChemistry: 85 });
    const away = team('away', [player('a1')]);
    const match = result({
      homeGoals: 4,
      awayGoals: 2,
      events: [
        { minute: 10, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 40, type: 'goal', description: 'gol', teamId: 'away', playerId: 'a1' },
        { minute: 61, type: 'goal', description: 'gol', teamId: 'away', playerId: 'a1' },
        { minute: 70, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h2' },
        { minute: 80, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h3' },
        { minute: 85, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
      ],
      stats: {
        homePos: 58,
        awayPos: 42,
        homeShots: 15,
        awayShots: 6,
        homeShotsOnTarget: 8,
        awayShotsOnTarget: 2,
        homeFouls: 0,
        awayFouls: 0,
        homeSaves: 1,
        awaySaves: 5,
        homeCorners: 6,
        awayCorners: 4,
      },
      playerStats: {
        'home::h1': { playerId: 'h1', playerName: 'h1', teamId: 'home', rating: 9, goals: 2, assists: 0, shots: 5, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 4 },
        'home::h2': { playerId: 'h2', playerName: 'h2', teamId: 'home', rating: 8, goals: 1, assists: 2, shots: 4, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
        'home::h3': { playerId: 'h3', playerName: 'h3', teamId: 'home', rating: 8, goals: 1, assists: 0, shots: 4, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
      },
    });
    const context = createMissionMatchContext(home, away, match)!;
    const stateFor = (missionId: string) => ({
      version: 1 as const,
      cycleKey: 'L1',
      boardIds: [missionId],
      active: [{ missionId, progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }],
      history: [],
      processedMatchKeys: [],
      missionResolution: null,
    });
    const completes = (missionId: string) => updateMissionsAfterMatch(stateFor(missionId), context, `L1:${missionId}`).completed;

    expect(completes('level_at_half_win')).toEqual(['level_at_half_win']);
    expect(completes('late_comeback_win')).toEqual(['late_comeback_win']);
    expect(completes('first_last_goal_win')).toEqual(['first_last_goal_win']);
    expect(completes('equalizer_retake_lead_win')).toEqual(['equalizer_retake_lead_win']);
    expect(completes('two_defenders_score_win')).toEqual([]);
    expect(completes('all_sectors_score_win')).toEqual(['all_sectors_score_win']);
    expect(completes('three_same_half_goals_win')).toEqual(['three_same_half_goals_win']);
    expect(completes('fifteen_shots_win')).toEqual(['fifteen_shots_win']);
    expect(completes('five_corners_win')).toEqual(['five_corners_win']);
    expect(completes('more_target_shots_win')).toEqual(['more_target_shots_win']);
    expect(completes('more_corners_win')).toEqual(['more_corners_win']);
    expect(completes('coach_identity_chemistry_win')).toEqual(['coach_identity_chemistry_win']);
    expect(completes('goleador_two_goals_win')).toEqual(['goleador_two_goals_win']);
    expect(completes('garcom_assist_win')).toEqual(['garcom_assist_win']);
    expect(completes('in_form_goal_win')).toEqual(['in_form_goal_win']);
  });

  it('evaluates exact scorelines and confirms that the first lead is never surrendered', () => {
    const home = team('home', [player('h1'), player('h2')]);
    const away = team('away', [player('a1')]);
    const match = result({
      homeGoals: 2,
      awayGoals: 0,
      events: [
        { minute: 12, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 70, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h2' },
      ],
      playerStats: {
        'home::h1': { playerId: 'h1', playerName: 'h1', teamId: 'home', rating: 8, goals: 1, assists: 0, shots: 3, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
        'home::h2': { playerId: 'h2', playerName: 'h2', teamId: 'home', rating: 8, goals: 1, assists: 0, shots: 3, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 2 },
      },
    });
    const context = createMissionMatchContext(home, away, match)!;
    const exactState = { version: 1 as const, cycleKey: 'L1', boardIds: ['exactly_two_goals_win'], active: [{ missionId: 'exactly_two_goals_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    const heldState = { ...exactState, boardIds: ['held_lead_win'], active: [{ missionId: 'held_lead_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }] };
    expect(updateMissionsAfterMatch(exactState, context, 'L1:exact').completed).toEqual(['exactly_two_goals_win']);
    expect(updateMissionsAfterMatch(heldState, context, 'L1:held').completed).toEqual(['held_lead_win']);
  });

  it('evaluates the corrected goal, tactic and late-game rules', () => {
    const home = team('home', [player('h1'), player('h2'), player('h3')]);
    const away = team('away', [player('a1')]);
    const stateFor = (missionId: string) => ({
      version: 1 as const,
      cycleKey: 'L1',
      boardIds: [missionId],
      active: [{ missionId, progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }],
      history: [],
      processedMatchKeys: [],
      missionResolution: null,
    });

    const perfect = createMissionMatchContext(home, away, result({
      homeGoals: 3,
      awayGoals: 0,
      events: [
        { minute: 10, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 40, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h2' },
        { minute: 80, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h3' },
      ],
    }))!;
    expect(updateMissionsAfterMatch(stateFor('perfect_victory_win'), perfect, 'L1:perfect').completed)
      .toEqual(['perfect_victory_win']);

    const opponentTactic = createMissionMatchContext(home, away, result({
      events: [{ minute: 30, type: 'tactic', description: 'tática', teamId: 'away', tacticAction: 'counter' }],
    }))!;
    expect(updateMissionsAfterMatch(stateFor('plan_b'), opponentTactic, 'L1:opponent-tactic').completed)
      .toEqual([]);

    const alreadyLeadingLate = createMissionMatchContext(home, away, result({
      homeGoals: 3,
      awayGoals: 0,
      events: [
        { minute: 10, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 20, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h2' },
        { minute: 80, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h3' },
      ],
    }))!;
    expect(updateMissionsAfterMatch(stateFor('late_decisive_goal'), alreadyLeadingLate, 'L1:already-leading').completed)
      .toEqual([]);

    const losingAt60AndEqualizingLater = createMissionMatchContext(home, away, result({
      homeGoals: 2,
      awayGoals: 1,
      events: [
        { minute: 60, type: 'goal', description: 'gol', teamId: 'away', playerId: 'a1' },
        { minute: 70, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 80, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h2' },
      ],
    }))!;
    expect(updateMissionsAfterMatch(stateFor('late_comeback_win'), losingAt60AndEqualizingLater, 'L1:exact-60').completed)
      .toEqual(['late_comeback_win']);
  });

  it('requires the same player to score twice for the Prodígio mission', () => {
    const home = team('home', [player('h1', { prodigio: true }), player('h2')]);
    const away = team('away', [player('a1')]);
    const match = result({
      homeGoals: 2,
      events: [
        { minute: 12, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
        { minute: 67, type: 'goal', description: 'gol', teamId: 'home', playerId: 'h1' },
      ],
      playerStats: {
        'home::h1': { playerId: 'h1', playerName: 'h1', teamId: 'home', rating: 9, goals: 2, assists: 0, shots: 4, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 3 },
      },
    });
    const context = createMissionMatchContext(home, away, match)!;
    const state = { version: 1 as const, cycleKey: 'L1', boardIds: ['prodigy_goals_win'], active: [{ missionId: 'prodigy_goals_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    expect(updateMissionsAfterMatch(state, context, 'L1:prodigy').completed).toEqual(['prodigy_goals_win']);
  });

  it('keeps clean-sheet draws valid and simplifies Mártir to a participation mission', () => {
    const home = team('home', [player('h1', { martir: true })]);
    const away = team('away', [player('a1')]);
    const draw = result({ homeGoals: 0, awayGoals: 0, winner: undefined, events: [] });
    const context = createMissionMatchContext(home, away, draw)!;

    const defenseState = {
      version: 1 as const,
      cycleKey: 'L1',
      boardIds: ['three_clean_sheets'],
      active: [{ missionId: 'three_clean_sheets', progress: 0, matchesRemaining: 3, acceptedCycleKey: 'L1' }],
      history: [],
      processedMatchKeys: [],
      missionResolution: null,
    };
    const defenseUpdate = updateMissionsAfterMatch(defenseState, context, 'L1:draw-clean');
    expect(defenseUpdate.state.active[0].progress).toBe(1);
    expect(defenseUpdate.completed).toEqual([]);

    const martirState = { ...defenseState, boardIds: ['martir_win'], active: [{ missionId: 'martir_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }] };
    const martirUpdate = updateMissionsAfterMatch(martirState, context, 'L1:martir');
    expect(martirUpdate.completed).toEqual(['martir_win']);
    expect(martirUpdate.reward).toBe(85);
  });

  it('uses event minutes for first-goal missions and accepts historical card variants', () => {
    const historicalPlayers = HISTORICAL_TRIOS[0].playerIds.map((basePlayerId, index) => player(`variant-${index}`, { basePlayerId }));
    const home = team('home', historicalPlayers);
    const away = team('away', [player('a1')]);
    const match = result({
      homeGoals: 1,
      awayGoals: 0,
      events: [
        { minute: 70, type: 'goal', description: 'gol', teamId: 'home', playerId: 'variant-0' },
        { minute: 10, type: 'goal', description: 'gol', teamId: 'away', playerId: 'a1' },
      ],
      playerStats: {},
    });
    const context = createMissionMatchContext(home, away, match)!;
    const firstGoalState = { version: 1 as const, cycleKey: 'L1', boardIds: ['first_goal_win'], active: [{ missionId: 'first_goal_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };
    const historicalState = { ...firstGoalState, boardIds: ['historical_trio'], active: [{ missionId: 'historical_trio', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }] };

    expect(updateMissionsAfterMatch(firstGoalState, context, 'L1:first-goal').completed).toEqual([]);
    expect(updateMissionsAfterMatch(historicalState, context, 'L1:historical').completed).toEqual(['historical_trio']);
  });

  it('lets the Nômade mission focus on contribution without requiring a chemistry link', () => {
    const home = team('home', [player('h1', { nomade: true })], { totalChemistry: 0 });
    const away = team('away', [player('a1')]);
    const context = createMissionMatchContext(home, away, result())!;
    const state = { version: 1 as const, cycleKey: 'L1', boardIds: ['nomade_decisive_win'], active: [{ missionId: 'nomade_decisive_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }], history: [], processedMatchKeys: [], missionResolution: null };

    expect(updateMissionsAfterMatch(state, context, 'L1:nomade').completed).toEqual(['nomade_decisive_win']);

    const basicNomadeState = { ...state, boardIds: ['nomade_win'], active: [{ missionId: 'nomade_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' }] };
    expect(updateMissionsAfterMatch(basicNomadeState, context, 'L1:nomade-basic').completed).toEqual(['nomade_win']);
  });

  it('keeps completed and expired missions together in the same post-match resolution', () => {
    const home = team('home', [player('h1')]);
    const away = team('away', [player('a1')]);
    const context = createMissionMatchContext(home, away, result())!;
    const state = {
      version: 1 as const,
      cycleKey: 'L1',
      boardIds: ['clean_sheet_win', 'hat_trick'],
      active: [
        { missionId: 'clean_sheet_win', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' },
        { missionId: 'hat_trick', progress: 0, matchesRemaining: 1, acceptedCycleKey: 'L1' },
      ],
      history: [],
      processedMatchKeys: [],
      missionResolution: null,
    };

    const updated = updateMissionsAfterMatch(state, context, 'L1:mixed-resolution');
    expect(updated.completed).toEqual(['clean_sheet_win']);
    expect(updated.expired).toEqual(['hat_trick']);
    expect(updated.reward).toBe(55);
    expect(updated.state.missionResolution).toEqual({
      matchKey: 'L1:mixed-resolution',
      completed: ['clean_sheet_win'],
      expired: ['hat_trick'],
    });
  });
});

