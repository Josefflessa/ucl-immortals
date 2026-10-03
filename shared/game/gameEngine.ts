// UCL Immortals — Game Engine
// Public entry point: the engine is split by concern under ./engine.

// Re-export the discipline multiplier used by the UI so the selector and the match engine
// always read the same source of truth.
export { tacticAggression } from './discipline';
export {
  setStatIds, statKey, MAX_MATCH_TRIGGERS, MATCH_TRIGGER_MINUTES, MATCH_TRIGGER_GOAL_MARGINS, MATCH_TRIGGER_ACTIONS, DEFAULT_MATCH_PLAN, normalizeMatchPlan, validateMatchPlan, MAX_RESERVE_PLAYERS, reservePlayerCount, matchRoleForPlayer, activeGoalkeeperForTeam, playerMatchDiscipline, teamLostMatch, applyDefeatGrowth, applyMatchStatGrowth, applyMercenarioProgress, STANDARD_TABLE_POINTS,
} from './engine/teamModel';
export type {
  PlayerCard, MatchTriggerCondition, MatchTriggerAction, MatchTrigger, MatchPlan, Team, MatchEvent, MatchStatsDelta, PlayerMatchStat, PenaltyKick, MatchResult, StandingsEntry, DraftState,
} from './engine/teamModel';
export {
  PREFERRED_FORMATION_CHEM_BONUS, calculateChemistry, getChemistryLinks, getPlayerEffectiveStats, getChemistryBonus, computeCharacteristicBoosts, getTeamEffectiveStats, computePossession, getFreeKickTaker,
} from './engine/chemistry';
export type {
  ChemLinkType, ChemLink, StatBreakdown, EffectiveStats, CharSource, CharBoost,
} from './engine/chemistry';
export {
  getEffectiveAttribute, GK_SAVE_EDGE, ON_TARGET_RESISTANCE, HOME_ATTR_BONUS, SECONDARY_STAT_MULT, positionFit, EVOLVE_LEVEL_THRESHOLDS, EVOLVE_GAMES, EVOLVE_POINTS, SPECIALIZATION_LEVEL, SPECIALIZATION_UNLOCK_COST, evolvePointsBudget, getEvolutionLevel, isEvolved, evolvePointsSpent, chooseEvolveAttribute, applyEvolvePoint, specializationAttributeBonus, canChooseSpecialization, canUnlockSpecialization, unlockPlayerSpecialization, choosePlayerSpecialization, starterPlayerIds, bumpStarterAppearances, stampMatchStartingLineups, startingIdsForResult, formationCounterBonusForAnalysisLevel, formationAdvantageLabelForAnalysisLevel, formationAdvantageColorForAnalysisLevel,
} from './engine/attributes';
export {
  OUTFIELD_GK_MULTIPLIER, isOutfieldGoalkeeper, goalkeeperShotStoppingRating, shotTypeForApproach, resolveOpenPlayChance, buildKeyMinutes, formationProfile, tacticBuffMultiplierForAnalysisLevel, tacticStatBonus, tacticProfile, tacticalChanceVolumeModifier, tacticalChanceDangerModifier, runMatchSimulation, freeKickGoalChance, penaltyGoalChance, simulateMatch,
} from './engine/matchSim';
export {
  CAPTAIN_BOOST, captainBestStatFromStarters, captainBoostFromStarters, calculateTeamStrength, getPenaltyTaker, getPenaltyOrder, simulatePenalties,
} from './engine/strength';
export {
  DRAFT_RARITY_CHANCES, MARTIR_TARGET_BOOST, DECIMO_HOMEM_STAT_BOOST, FRAGIL_STAT_BOOST, MAGNATA_POINT_MULT, magnataPointMultiplier, PIPOQUEIRO_LEAGUE_BOOST, PIPOQUEIRO_KO_PENALTY, NOE_STAT_BOOST, NOE_CHEM_BONUS, FORASTEIRO_STAT_BOOST, COLECIONADOR_PER_RESERVE, ESTRIBADO_CREDITS_PER_BOOST, ESTRIBADO_STAT_BOOST, estribadoStatBoost, INFORM_STAT_BOOST, LOBO_STAT_BOOST, LOBO_CHEM_PENALTY, PILAR_CHEM_BONUS, RESILIENTE_DEFEAT_BOOST, PRODIGIO_STARTS_PER_BOOST, GOLEADOR_GOALS_PER_BOOST, GARCOM_ASSISTS_PER_BOOST, ARROGANTE_GOALS_PER_PENALTY, ARROGANTE_STAT_BOOST_PER_GOAL, TODOS_POR_UM_STAT_BOOST, TODOS_POR_UM_CHEM_BONUS, MERCENARIO_STAT_BOOST_PER_MISSION, prodigioStatBoost, goleadorStatBoost, garcomStatBoost, arroganteStatBoost, arroganteTeamPenalty, mercenarioStatBoost, draftSlotIndex, generateDraftOptions, PLAYER_PACK_OFFER_SIZE, generatePlayerPackOptions, generatePlayerPackOffer, drawPlayerPackCard, SCOUT_MIN_OVERALL, generateScoutOptions, buildUniquePackRoundKey, generateUniquePackOffer, drawUniquePackCard, applyShopVariant, hasVariant, variantCount, canAddVariant, stripVariant, stripSpecificVariant, getNeededPositions,
} from './engine/draft';
export type {
  VariantFlag,
} from './engine/draft';
export {
  generateBotTeam, rebuildTeamChemistry, generateImmortalReport,
} from './engine/bots';
export type {
  ImmortalReport,
} from './engine/bots';
export {
  generateLeagueFixtures, generateRandomLeagueFixtures, generateGroupFixtures, generateRandomGroupFixtures, computeStandings, computeGroupStandings, computeGroupQualifiedStandings, createKnockoutBracket, getActiveKnockoutMatches, isKnockoutTeamAlive, playActiveKnockoutLeg, advanceKnockoutBracket, knockoutRoundLabel, getAllPlayedMatchResults, getPlayerSeasonStats,
} from './engine/tournament';
export type {
  LeagueFixture, KnockoutBracket, PlayerSeasonStats,
} from './engine/tournament';
