// Player-seat rules shared by solo and online.
//
// A "seat" is one human player's team plus their private economy (credits,
// pending packs, round offers, missions). The solo reducer and the online
// server both apply these pure functions, so a shop purchase, a project
// upgrade or an evolution choice follows exactly the same rule everywhere.
// Network-input validation (ids, enums) stays at the server boundary.

import { FORMATIONS, PLAYERS, TACTICS, UNIQUE_CARDS, type Player, type PlayerSpecialization } from './gameData';
import {
  applyEvolvePoint, applyMercenarioProgress, generateDraftOptions, getActiveKnockoutMatches, validateMatchPlan, applyShopVariant, canAddVariant, canUnlockSpecialization,
  choosePlayerSpecialization, drawPlayerPackCard, drawUniquePackCard, evolvePointsBudget,
  generatePlayerPackOffer, generateScoutOptions, generateUniquePackOffer, getEvolutionLevel, hasVariant,
  isEvolved, rebuildTeamChemistry, SPECIALIZATION_UNLOCK_COST, stripSpecificVariant, stripVariant,
  unlockPlayerSpecialization, type PlayerCard, type Team, type VariantFlag,
} from './gameEngine';
import { canEvolvePrime, PRIME_COST, sellValue, SHOP_COSTS, type RegularPlayerPackRarity, type ShopVariant, type TrainAttr } from './shop';
import {
  bettingStakeCapBonus, medicalFreeTreatmentsPerCompetition, medicalPhysioCost, medicalReturnBoost, projectLevel, projectUpgradeCost, purchaseClubProjectUpgrade, trainingBoostForProject, trainingCostForProject,
  type ClubProjectId, type RecruitmentOfferMeta,
} from './clubProjects';
import {
  acceptMission, completedMissionCount, dismissMissionResolution, extendActiveMissionDeadlines, MAX_ACTIVE_MISSIONS, missionCycleKey,
  missionRemovalCost, normalizeMissionState, removeMission, rerollMissionBoard, rotateMissionBoard, type MissionState,
} from './missions';
import {
  applyEmergencyReplacement, applyMedicalReturnBoost, getEmergencyReplacementTarget, healInjury, type DisciplineMap,
} from './discipline';
import { BET_ROUND_CAP, bettingPayoutRulesForLevel, buildKnockoutMatchKey, buildLeagueMatchKey, canPlaceStake, createBet, type Bet, type BetMarket } from './bets';

export interface PlayerSeat {
  team: Team;
  points: number;
  missions?: MissionState;
  bets?: Bet[];
  medicalFreeTreatmentsUsed?: number;
  reinforcementOptions?: Player[] | null;
  reinforcementOffer?: RecruitmentOfferMeta | null;
  pendingPack: { kind: 'scout'; options: Player[] } | null;
  pendingPackReveal: { kind: RegularPlayerPackRarity; card: Player } | null;
  pendingUniquePack: Player | null;
  uniquePackOfferIds?: string[];
  uniquePackOfferRoundKey?: string | null;
  playerPackOfferIds?: Partial<Record<RegularPlayerPackRarity, string[]>>;
  playerPackOfferRoundKeys?: Partial<Record<RegularPlayerPackRarity, string | null>>;
}

/** Where the competition stands, for rules that depend on it. */
export interface SeatContext {
  /** Shop, projects and training are open only during the league/knockout hubs. */
  shopOpen: boolean;
  /** Identifies the current round/leg: shop offers are stable within it. */
  roundKey: string | null;
}

export type SeatResult = { ok: true; seat: PlayerSeat } | { ok: false; error?: string };

const ok = (seat: PlayerSeat): SeatResult => ({ ok: true, seat });
type Rejected = { ok: false; error?: string };
const fail = (error?: string): Rejected => ({ ok: false, error });
const insufficient = (points: number, cost: number, unit = 'créditos'): Rejected =>
  fail(`Saldo insuficiente: você tem ${points} ${unit} e precisa de ${cost}.`);

/** Spends credits; the team mirrors the balance for Estribado. */
function spend(seat: PlayerSeat, cost: number, team: Team = seat.team): PlayerSeat {
  const points = seat.points - cost;
  return { ...seat, points, team: { ...team, credits: points } };
}

function addToBench(seat: PlayerSeat, card: Player): Team {
  const playerCard: PlayerCard = { ...card, chemistryScore: 0, isOOP: false };
  return applyMercenarioProgress(
    { ...seat.team, players: [...seat.team.players, playerCard] },
    seat.missions ? completedMissionCount(seat.missions) : 0,
  );
}

const ownedIds = (seat: PlayerSeat) => seat.team.players.map(player => player.id);
const mapPlayer = (seat: PlayerSeat, playerId: string, update: (card: PlayerCard) => PlayerCard): PlayerCard[] =>
  seat.team.players.map(card => (card.id === playerId ? update(card) : card));

// ── Coach ──────────────────────────────────────────────────────────────────

export function changeCoach(seat: PlayerSeat, ctx: SeatContext, coachId: string): SeatResult {
  if (!ctx.shopOpen || seat.team.coachId === coachId) return fail();
  const cost = SHOP_COSTS.changeCoach;
  if (seat.points < cost) return insufficient(seat.points, cost);
  // The coach drives chemistry links and buffs, so the team is recomputed.
  return ok(spend(seat, cost, rebuildTeamChemistry({ ...seat.team, coachId })));
}

export function evolveCoachPrime(seat: PlayerSeat, ctx: SeatContext, wins: number): SeatResult {
  if (!ctx.shopOpen || seat.team.coachPrime) return fail();
  if (!canEvolvePrime(wins, seat.points)) return fail();
  return ok(spend(seat, PRIME_COST, { ...seat.team, coachPrime: true }));
}

// ── Round offers (Unique pack + regular rarity packs) ──────────────────────

/** Materializes the round's four Unique cards once; the offer stays stable within the round. */
export function ensureUniquePackOffer(seat: PlayerSeat, ctx: SeatContext): PlayerSeat {
  if (!ctx.shopOpen || !ctx.roundKey) return seat;
  const owned = ownedIds(seat);
  const excluded = seat.pendingUniquePack ? [seat.pendingUniquePack.id] : [];
  const stored = seat.uniquePackOfferIds;
  const validStored = Array.isArray(stored) && stored.every(id => UNIQUE_CARDS.some(card => card.id === id));
  const unavailable = new Set([...owned, ...excluded]);
  const anyLeft = UNIQUE_CARDS.some(card => !unavailable.has(card.id));
  // An empty offer is valid once the whole catalogue is owned.
  if (seat.uniquePackOfferRoundKey === ctx.roundKey && validStored && (stored!.length > 0 || !anyLeft)) return seat;
  return { ...seat, uniquePackOfferIds: generateUniquePackOffer(owned, excluded), uniquePackOfferRoundKey: ctx.roundKey };
}

export const REGULAR_PLAYER_PACK_RARITIES: RegularPlayerPackRarity[] = ['bronze', 'silver', 'gold', 'legendary', 'immortal'];

/** Materializes the four-card offer of every regular rarity once per round. */
export function ensurePlayerPackOffers(seat: PlayerSeat, ctx: SeatContext): PlayerSeat {
  if (!ctx.shopOpen || !ctx.roundKey) return seat;
  const owned = ownedIds(seat);
  const ids = { ...(seat.playerPackOfferIds ?? {}) };
  const keys = { ...(seat.playerPackOfferRoundKeys ?? {}) };
  let changed = false;
  for (const rarity of REGULAR_PLAYER_PACK_RARITIES) {
    const stored = ids[rarity];
    const validStored = Array.isArray(stored) && stored.every(id => PLAYERS.some(card => card.id === id && card.rarity === rarity));
    if (keys[rarity] === ctx.roundKey && validStored) continue;
    ids[rarity] = generatePlayerPackOffer(rarity, owned);
    keys[rarity] = ctx.roundKey;
    changed = true;
  }
  return changed ? { ...seat, playerPackOfferIds: ids, playerPackOfferRoundKeys: keys } : seat;
}

const hasPendingPack = (seat: PlayerSeat) => !!(seat.pendingPack || seat.pendingUniquePack || seat.pendingPackReveal);

// ── Packs: paid on open, drawn from the round offer, claimed after the reveal ──

export function openUniquePack(seat: PlayerSeat, ctx: SeatContext): SeatResult {
  if (!ctx.shopOpen || hasPendingPack(seat)) return fail();
  const offered = ensureUniquePackOffer(seat, ctx);
  const cost = SHOP_COSTS.uniqueCard;
  if (offered.points < cost) return insufficient(offered.points, cost, 'pontos');
  const card = drawUniquePackCard(offered.uniquePackOfferIds ?? [], ownedIds(offered));
  if (!card) return fail('Você já possui todas as Cartas Únicas desta oferta.');
  return ok({ ...spend(offered, cost), pendingUniquePack: { ...card } });
}

export function claimUniquePack(seat: PlayerSeat): SeatResult {
  const pending = seat.pendingUniquePack;
  if (!pending) return fail();
  const canonical = UNIQUE_CARDS.find(card => card.id === pending.id);
  // The pack stays reserved when validation fails, so a paid purchase is never lost.
  if (!canonical || seat.team.players.some(card => card.id === canonical.id)) return fail('Não foi possível adicionar esta Carta Única.');
  return ok({ ...seat, pendingUniquePack: null, team: addToBench(seat, canonical) });
}

export function openPlayerPack(seat: PlayerSeat, ctx: SeatContext, rarity: RegularPlayerPackRarity): SeatResult {
  if (!ctx.shopOpen || hasPendingPack(seat)) return fail();
  const offered = ensurePlayerPackOffers(seat, ctx);
  const cost = SHOP_COSTS.playerPack[rarity];
  if (offered.points < cost) return insufficient(offered.points, cost, 'pontos');
  const card = drawPlayerPackCard(offered.playerPackOfferIds?.[rarity] ?? [], rarity, ownedIds(offered));
  if (!card) return fail('Você já possui todas as cartas disponíveis desta oferta.');
  return ok({ ...spend(offered, cost), pendingPackReveal: { kind: rarity, card: { ...card } } });
}

export function claimPlayerPack(seat: PlayerSeat): SeatResult {
  const pending = seat.pendingPackReveal;
  if (!pending) return fail();
  const canonical = PLAYERS.find(card => card.id === pending.card.id && card.rarity === pending.kind);
  if (!canonical || seat.team.players.some(card => card.id === canonical.id)) return fail('Não foi possível adicionar esta carta ao banco.');
  return ok({ ...seat, pendingPackReveal: null, team: addToBench(seat, canonical) });
}

/** Caça-Talentos: paid on open; the options are rolled here from the catalogue. */
export function openScoutPack(seat: PlayerSeat, ctx: SeatContext, position: string): SeatResult {
  if (!ctx.shopOpen || hasPendingPack(seat)) return fail();
  const options = generateScoutOptions(position, ownedIds(seat));
  if (options.length === 0) return fail();
  const cost = SHOP_COSTS.scout;
  if (seat.points < cost) return insufficient(seat.points, cost, 'pontos');
  return ok({ ...spend(seat, cost), pendingPack: { kind: 'scout', options: options.map(option => ({ ...option })) } });
}

export function pickScoutPack(seat: PlayerSeat, playerId: string): SeatResult {
  if (!seat.pendingPack) return fail();
  const valid = seat.pendingPack.options.some(option => option.id === playerId)
    && !seat.team.players.some(card => card.id === playerId);
  const chosen = PLAYERS.find(card => card.id === playerId);
  // A stale choice never consumes a pack that was already paid for.
  if (!valid || !chosen) return fail('Essa opção não está mais disponível. O pacote continua reservado para você.');
  return ok({ ...seat, pendingPack: null, team: addToBench(seat, chosen) });
}

// ── Card upgrades ──────────────────────────────────────────────────────────

/** `competitionStats`: the card's goals/assists so far, so a growing characteristic starts from them. */
export function turbinar(
  seat: PlayerSeat,
  ctx: SeatContext,
  playerId: string,
  variant: ShopVariant,
  competitionStats: { goals?: number; assists?: number },
): SeatResult {
  if (!ctx.shopOpen) return fail();
  const target = seat.team.players.find(card => card.id === playerId);
  const cost = SHOP_COSTS.turbinar;
  if (!target || !canAddVariant(target)) return fail(); // one per card (Únicas: two)
  if (seat.points < cost) return insufficient(seat.points, cost, 'pontos');
  const stats = { ...competitionStats, missionsCompleted: seat.missions ? completedMissionCount(seat.missions) : 0 };
  const players = mapPlayer(seat, playerId, card => ({ ...applyShopVariant(card, variant, stats), chemistryScore: card.chemistryScore, isOOP: card.isOOP } as PlayerCard));
  return ok(spend(seat, cost, rebuildTeamChemistry({ ...seat.team, players })));
}

export function removeVariant(seat: PlayerSeat, ctx: SeatContext, playerId: string, variantKey?: VariantFlag): SeatResult {
  if (!ctx.shopOpen) return fail();
  const target = seat.team.players.find(card => card.id === playerId);
  const cost = SHOP_COSTS.removeVariant;
  if (!target || !hasVariant(target)) return fail();
  if (seat.points < cost) return insufficient(seat.points, cost, 'pontos');
  const players = mapPlayer(seat, playerId, card => ({
    ...(variantKey ? stripSpecificVariant(card, variantKey) : stripVariant(card)),
    chemistryScore: card.chemistryScore,
    isOOP: card.isOOP,
  } as PlayerCard));
  return ok(spend(seat, cost, rebuildTeamChemistry({ ...seat.team, players })));
}

export function train(seat: PlayerSeat, ctx: SeatContext, playerId: string, attr: TrainAttr): SeatResult {
  if (!ctx.shopOpen) return fail();
  const target = seat.team.players.find(card => card.id === playerId);
  if (!target) return fail();
  const level = projectLevel(seat.team.clubProjects, 'training');
  const cost = trainingCostForProject(level, target.trainCount ?? 0);
  const boost = trainingBoostForProject(level, (target.trainCount ?? 0) === 0);
  if (seat.points < cost) return insufficient(seat.points, cost);
  const players = mapPlayer(seat, playerId, card => ({
    ...card,
    trainBoosts: { ...(card.trainBoosts ?? {}), [attr]: (card.trainBoosts?.[attr] ?? 0) + boost },
    trainCount: (card.trainCount ?? 0) + 1,
  }));
  return ok(spend(seat, cost, { ...seat.team, players }));
}

// ── Club projects ──────────────────────────────────────────────────────────

export function upgradeClubProject(seat: PlayerSeat, ctx: SeatContext, projectId: ClubProjectId): SeatResult {
  if (!ctx.shopOpen) return fail();
  const upgrade = purchaseClubProjectUpgrade(seat.team.clubProjects, projectId, seat.points);
  if (!upgrade) {
    const cost = projectUpgradeCost(projectLevel(seat.team.clubProjects, projectId) + 1);
    return cost ? insufficient(seat.points, cost) : fail();
  }
  const next = spend(seat, seat.points - upgrade.remainingCredits, { ...seat.team, clubProjects: upgrade.projects });
  // Núcleo de Missões level 4 also extends the deadlines of missions already active.
  if (projectId === 'missions' && next.missions) {
    next.missions = extendActiveMissionDeadlines(next.missions, upgrade.fromLevel, upgrade.toLevel);
  }
  return ok(next);
}

// ── Evolution ──────────────────────────────────────────────────────────────

export function setEvolvePoint(seat: PlayerSeat, playerId: string, attr: TrainAttr, delta: number): SeatResult {
  const players = mapPlayer(seat, playerId, card => {
    if (!isEvolved(card)) return card;
    return { ...card, evolvePoints: applyEvolvePoint(card.evolvePoints ?? {}, attr, delta, evolvePointsBudget(getEvolutionLevel(card))) };
  });
  return ok({ ...seat, team: { ...seat.team, players } });
}

export function setAutoEvolveAttribute(seat: PlayerSeat, playerId: string, attr: TrainAttr | null): SeatResult {
  const target = seat.team.players.find(card => card.id === playerId);
  if (!target || target.rarity === 'unique' || target.autoEvolveAttribute === (attr ?? undefined)) return fail();
  const players = mapPlayer(seat, playerId, card => ({ ...card, autoEvolveAttribute: attr ?? undefined }));
  return ok({ ...seat, team: { ...seat.team, players } });
}

export function unlockSpecialization(seat: PlayerSeat, playerId: string): SeatResult {
  const target = seat.team.players.find(card => card.id === playerId);
  if (!target || !canUnlockSpecialization(target)) return fail();
  if (seat.points < SPECIALIZATION_UNLOCK_COST) return insufficient(seat.points, SPECIALIZATION_UNLOCK_COST);
  const players = mapPlayer(seat, playerId, card => unlockPlayerSpecialization(card));
  return ok(spend(seat, SPECIALIZATION_UNLOCK_COST, { ...seat.team, players }));
}

export function chooseSpecialization(seat: PlayerSeat, playerId: string, specialization: PlayerSpecialization): SeatResult {
  const players = mapPlayer(seat, playerId, card => choosePlayerSpecialization(card, specialization));
  return ok({ ...seat, team: { ...seat.team, players } });
}

export function resetEvolvePoints(seat: PlayerSeat, playerId: string): SeatResult {
  const players = mapPlayer(seat, playerId, card => ({ ...card, evolvePoints: {} }));
  return ok({ ...seat, team: { ...seat.team, players } });
}

// ── Bets ───────────────────────────────────────────────────────────────────

/** The competition data needed to locate a bettable match. */
export interface BetCompetition {
  phase: string;
  leagueRound: number;
  leagueFixtures: Array<{ round: number; homeTeamId: string; awayTeamId: string; played?: boolean }>;
  knockoutBracket: Parameters<typeof getActiveKnockoutMatches>[0] | null;
}

export interface BetTarget {
  /** Stake-cap scope: the whole league round, or each knockout leg on its own. */
  capPrefix: string;
  homeTeamId: string;
  awayTeamId: string;
}

/** A bet is only accepted on a match of the current round/leg that has not been played yet. */
export function resolveBetTarget(matchKey: string, competition: BetCompetition): BetTarget | null {
  if (competition.phase === 'league') {
    const fixture = competition.leagueFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === matchKey);
    if (!fixture || fixture.round !== competition.leagueRound || fixture.played) return null;
    return { capPrefix: `L${competition.leagueRound}:`, homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId };
  }
  if (competition.phase === 'knockout' && competition.knockoutBracket) {
    const leg = competition.knockoutBracket.currentLeg;
    const tie = (getActiveKnockoutMatches(competition.knockoutBracket) as Array<{ id: string; homeTeamId: string; awayTeamId: string; leg1?: unknown; leg2?: unknown; result?: unknown }>)
      .find(match => buildKnockoutMatchKey(match.id, leg) === matchKey);
    const legPlayed = tie && (leg === 2 ? !!tie.leg2 : !!(tie.leg1 || tie.result));
    if (!tie || legPlayed) return null;
    // The return leg swaps the venue.
    return {
      capPrefix: matchKey,
      homeTeamId: leg === 2 ? tie.awayTeamId : tie.homeTeamId,
      awayTeamId: leg === 2 ? tie.homeTeamId : tie.awayTeamId,
    };
  }
  return null;
}

export interface BetInput {
  homeTeamId?: string;
  awayTeamId?: string;
  homeGoals?: number;
  awayGoals?: number;
  stake: number;
  market?: BetMarket;
  selections?: unknown;
}

/** Places or edits a bet. The stake is held in escrow now; editing adjusts it by the difference. */
export function placeBet(seat: PlayerSeat, matchKey: string, target: BetTarget | null, input: BetInput): SeatResult {
  if (!target || !Number.isSafeInteger(input.stake) || input.stake <= 0) return fail();
  // The score selectors are labelled by team; they must match the real fixture order.
  if ((input.homeTeamId != null && input.homeTeamId !== target.homeTeamId)
    || (input.awayTeamId != null && input.awayTeamId !== target.awayTeamId)) return fail();
  const bets = seat.bets ?? [];
  const existing = bets.find(bet => bet.matchKey === matchKey);
  if (existing?.settled) return fail();
  const escrowDelta = input.stake - (existing?.stake ?? 0);
  if (escrowDelta > seat.points) return fail();
  const bettingLevel = projectLevel(seat.team.clubProjects, 'betting');
  if (!canPlaceStake(bets, target.capPrefix, matchKey, input.stake, BET_ROUND_CAP + bettingStakeCapBonus(bettingLevel))) return fail();
  // The canonical builder parser calculates and locks the multiplier; the client never picks odds.
  const bet = createBet({
    matchKey,
    homeTeamId: target.homeTeamId,
    awayTeamId: target.awayTeamId,
    homeGoals: input.homeGoals,
    awayGoals: input.awayGoals,
    stake: input.stake,
    market: input.market,
    selections: input.selections,
    payoutRules: bettingPayoutRulesForLevel(bettingLevel),
  });
  if (!bet) return fail();
  return ok({
    ...seat,
    points: seat.points - escrowDelta,
    bets: existing ? bets.map(current => (current.matchKey === matchKey ? bet : current)) : [...bets, bet],
  });
}

/** Cancels an unsettled bet and refunds its stake. */
export function cancelBet(seat: PlayerSeat, matchKey: string): SeatResult {
  const bets = seat.bets ?? [];
  const existing = bets.find(bet => bet.matchKey === matchKey);
  if (!existing || existing.settled) return fail();
  return ok({ ...seat, points: seat.points + existing.stake, bets: bets.filter(bet => bet.matchKey !== matchKey) });
}

// ── Squad availability: physio, emergency signing and selling a reserve ────
// These also touch the competition-wide discipline map (suspensions/injuries).

export type DisciplineResult =
  | { ok: true; seat: PlayerSeat; discipline: DisciplineMap }
  | { ok: false; error?: string };

/** Physiotherapy: −1 match of injury. The Medical Department grants free uses per competition. */
export function treatInjury(seat: PlayerSeat, discipline: DisciplineMap, playerId: string): DisciplineResult {
  if (!seat.team.players.some(card => card.id === playerId)) return fail();
  const key = `${seat.team.id}:${playerId}`;
  const injured = discipline[key]?.injured ?? 0;
  if (injured <= 0) return fail();
  const medicalLevel = projectLevel(seat.team.clubProjects, 'medical');
  const freeUsed = seat.medicalFreeTreatmentsUsed ?? 0;
  const free = freeUsed < medicalFreeTreatmentsPerCompetition(medicalLevel);
  const cost = free ? 0 : medicalPhysioCost(medicalLevel);
  if (seat.points < cost) return insufficient(seat.points, cost);
  const nextDiscipline = healInjury(discipline, seat.team.id, playerId);
  const recovered = nextDiscipline[key]?.injured === 0;
  const team = recovered ? applyMedicalReturnBoost(seat.team, playerId, medicalReturnBoost(medicalLevel)) : seat.team;
  return {
    ok: true,
    seat: { ...spend(seat, cost, team), medicalFreeTreatmentsUsed: freeUsed + (free ? 1 : 0) },
    discipline: nextDiscipline,
  };
}

/** Free silver/bronze signing, only when no reserve can cover an unavailable starter. */
export function emergencyReplace(seat: PlayerSeat, discipline: DisciplineMap, starterId: string, playerId: string): SeatResult {
  const target = getEmergencyReplacementTarget(seat.team, discipline);
  const chosen = PLAYERS.find(card => card.id === playerId);
  if (!target || target.starterId !== starterId || !chosen || !target.options.some(option => option.id === chosen.id)) {
    return fail('Essa contratação emergencial não está disponível.');
  }
  const team = applyEmergencyReplacement(seat.team, discipline, starterId, chosen);
  if (!team) return fail('Não foi possível atualizar a escalação.');
  return ok({ ...seat, team });
}

/** Sells a reserve (bench index ≥ 11) to the bank for its fixed value. Starters are not for sale. */
export function sellReserve(seat: PlayerSeat, ctx: SeatContext, discipline: DisciplineMap, playerId: string): DisciplineResult {
  if (!ctx.shopOpen) return fail();
  const index = seat.team.players.findIndex(card => card.id === playerId);
  if (index < 11) return fail();
  const sold = seat.team.players[index];
  const nextDiscipline = { ...discipline };
  delete nextDiscipline[`${seat.team.id}:${sold.id}`];
  const players = seat.team.players.filter((_, i) => i !== index);
  return { ok: true, seat: spend(seat, -sellValue(sold.rarity), { ...seat.team, players }), discipline: nextDiscipline };
}

// ── Missions ───────────────────────────────────────────────────────────────

/** Mission board identity: the campaign seed and the current round/leg cycle. */
export interface MissionBoardContext {
  seed: string;
  cycle: string;
}

/** The mission cycle of the current competition step (league round or knockout leg). */
export function currentMissionCycle(competition: Pick<BetCompetition, 'phase' | 'leagueRound' | 'knockoutBracket'>): string {
  const bracket = competition.knockoutBracket as { currentRound?: string; currentLeg?: number } | null;
  return competition.phase === 'knockout'
    ? missionCycleKey('knockout', competition.leagueRound, bracket?.currentRound, bracket?.currentLeg)
    : missionCycleKey('league', competition.leagueRound);
}

/** The board as it should look in the current cycle (rotated if a new round started). */
function currentBoard(seat: PlayerSeat, board: MissionBoardContext): MissionState {
  return rotateMissionBoard(normalizeMissionState(seat.missions, board.seed, board.cycle), board.seed, board.cycle);
}

export function acceptMissionOnBoard(seat: PlayerSeat, ctx: SeatContext, board: MissionBoardContext, missionId: string): SeatResult {
  if (!ctx.shopOpen) return fail();
  const missions = acceptMission(currentBoard(seat, board), missionId, projectLevel(seat.team.clubProjects, 'missions'));
  if (!missions) return fail(`Essa missão não está disponível ou você já possui ${MAX_ACTIVE_MISSIONS} missões ativas.`);
  return ok({ ...seat, missions });
}

export function rerollMissions(seat: PlayerSeat, ctx: SeatContext, board: MissionBoardContext): SeatResult {
  if (!ctx.shopOpen) return fail();
  const missions = rerollMissionBoard(currentBoard(seat, board), board.seed, projectLevel(seat.team.clubProjects, 'missions'));
  if (!missions) return fail('A atualização gratuita deste mural já foi usada ou o projeto ainda não está no nível necessário.');
  return ok({ ...seat, missions });
}

export function removeActiveMission(seat: PlayerSeat, ctx: SeatContext, board: MissionBoardContext, missionId: string): SeatResult {
  if (!ctx.shopOpen) return fail();
  const missionsLevel = projectLevel(seat.team.clubProjects, 'missions');
  const removed = removeMission(normalizeMissionState(seat.missions, board.seed, board.cycle), missionId, seat.points, missionsLevel);
  if (!removed) {
    const cost = missionRemovalCost(missionId, missionsLevel);
    return fail(Number.isFinite(cost) ? `Você precisa de ${cost} créditos para remover essa missão.` : 'Essa missão não está ativa.');
  }
  return ok({ ...spend(seat, removed.cost), missions: removed.state });
}

export function dismissMissionResult(seat: PlayerSeat): SeatResult {
  if (!seat.missions) return fail();
  return ok({ ...seat, missions: dismissMissionResolution(seat.missions) });
}

// ── Recruitment Centre offer ───────────────────────────────────────────────

/** Adds one offered card to the bench. Multi-pick offers stay open until their selection limit. */
export function pickReinforcement(seat: PlayerSeat, canRecruit: boolean, playerId: string): SeatResult {
  if (!canRecruit) return fail();
  const offered = seat.reinforcementOptions?.find(option => option.id === playerId);
  // Rebuilt from the catalogue: the client never submits a card's stats or traits.
  const canonical = offered && PLAYERS.find(card => card.id === offered.id);
  if (!canonical || seat.team.players.some(card => card.id === canonical.id)) {
    return fail('Essa carta não está mais disponível. Sua escolha continua reservada.');
  }
  const offer = seat.reinforcementOffer ?? null;
  const selectionsMade = (offer?.selectionsMade ?? 0) + 1;
  const completed = selectionsMade >= Math.max(1, offer?.selectionLimit ?? 1);
  return ok({
    ...seat,
    team: addToBench(seat, canonical),
    reinforcementOptions: completed ? null : (seat.reinforcementOptions ?? []).filter(option => option.id !== canonical.id),
    reinforcementOffer: completed || !offer ? null : { ...offer, selectionsMade },
  });
}

/** Recruitment Centre level 4: one free re-roll of the current offer. */
export function rerollReinforcement(seat: PlayerSeat, canRecruit: boolean): SeatResult {
  const offer = seat.reinforcementOffer;
  const rerollsLeft = (offer?.freeRerolls ?? 0) - (offer?.rerollsUsed ?? 0);
  if (!canRecruit || !offer || rerollsLeft <= 0 || !seat.reinforcementOptions?.length) return fail();
  return ok({
    ...seat,
    reinforcementOptions: generateDraftOptions([], ownedIds(seat), seat.reinforcementOptions.length, offer.minimumOverall ?? 0),
    reinforcementOffer: { ...offer, rerollsUsed: offer.rerollsUsed + 1 },
  });
}

export function dismissReinforcement(seat: PlayerSeat): SeatResult {
  return ok({ ...seat, reinforcementOptions: null, reinforcementOffer: null });
}

// ── Lineup ─────────────────────────────────────────────────────────────────

/** Swaps two squad slots (bench ↔ starter or within the XI); roles that left the XI are dropped. */
export function swapLineup(seat: PlayerSeat, indexA: number, indexB: number): SeatResult {
  const players = [...seat.team.players];
  if (!Number.isInteger(indexA) || !Number.isInteger(indexB) || indexA < 0 || indexB < 0
    || indexA >= players.length || indexB >= players.length || indexA === indexB) return fail();
  [players[indexA], players[indexB]] = [players[indexB], players[indexA]];
  const starters = new Set(players.slice(0, 11).map(card => card.id));
  const keep = (id?: string) => (id && starters.has(id) ? id : undefined);
  return ok({
    ...seat,
    team: rebuildTeamChemistry({
      ...seat.team,
      players,
      captain: keep(seat.team.captain),
      penaltyTaker: keep(seat.team.penaltyTaker),
      freeKickTaker: keep(seat.team.freeKickTaker),
    }),
  });
}

/** A role must be held by a starter; the penalty and free-kick takers cannot be goalkeepers. */
export function roleHolder(value: unknown, starters: Array<Player | PlayerCard>, outfieldOnly = false): string | null {
  if (typeof value !== 'string') return null;
  return starters.find(card => card.id === value && (!outfieldOnly || card.position !== 'GK'))?.id ?? null;
}

export interface MatchRoles {
  captain?: string | null;
  penaltyTaker?: string | null;
  freeKickTaker?: string | null;
}

/** Sets the given roles (null clears one). Every assigned role is validated against the XI. */
export function setMatchRoles(seat: PlayerSeat, roles: MatchRoles): SeatResult {
  const starters = seat.team.players.slice(0, 11);
  const resolve = (value: string | null | undefined, outfieldOnly: boolean): string | undefined | false => {
    if (value === undefined) return undefined;
    if (value === null) return undefined;
    return roleHolder(value, starters, outfieldOnly) ?? false;
  };
  const captain = resolve(roles.captain, false);
  const penaltyTaker = resolve(roles.penaltyTaker, true);
  const freeKickTaker = resolve(roles.freeKickTaker, true);
  if (captain === false || penaltyTaker === false || freeKickTaker === false) return fail();
  return ok({
    ...seat,
    team: {
      ...seat.team,
      ...('captain' in roles ? { captain } : {}),
      ...('penaltyTaker' in roles ? { penaltyTaker } : {}),
      ...('freeKickTaker' in roles ? { freeKickTaker } : {}),
    },
  });
}

/** Changing the shape re-maps the occupied roles, so chemistry/out-of-position is recomputed. */
export function setFormation(seat: PlayerSeat, formationId: string): SeatResult {
  if (!FORMATIONS.some(formation => formation.id === formationId)) return fail();
  if (seat.team.formationId === formationId) return ok(seat);
  return ok({ ...seat, team: rebuildTeamChemistry({ ...seat.team, formationId }) });
}

export function setPlayStyle(seat: PlayerSeat, playStyle: string): SeatResult {
  if (!TACTICS.some(tactic => tactic.id === playStyle)) return fail();
  return ok({ ...seat, team: { ...seat.team, playStyle } });
}

/** Stores the canonical plan; malformed plans (unknown actions, too many triggers) are rejected. */
export function setMatchPlan(seat: PlayerSeat, plan: unknown): SeatResult {
  const matchPlan = validateMatchPlan(plan);
  if (!matchPlan) return fail();
  return ok({ ...seat, team: { ...seat.team, matchPlan } });
}

/** Mártir: up to two other starters receive its boost. */
export function setMartirTargets(seat: PlayerSeat, playerId: string, targetIds: unknown): SeatResult {
  const source = seat.team.players.find(card => card.id === playerId);
  if (!source?.martir || !Array.isArray(targetIds)) return fail();
  const starters = new Set(seat.team.players.slice(0, 11).map(card => card.id));
  const targets = targetIds.filter((id): id is string => typeof id === 'string' && id !== playerId && starters.has(id)).slice(0, 2);
  return ok({ ...seat, team: { ...seat.team, players: mapPlayer(seat, playerId, card => ({ ...card, martirTargets: targets })) } });
}
