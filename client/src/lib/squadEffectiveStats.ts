import { FORMATIONS, type Player } from '@shared/game/gameData';
import {
  calculateChemistry, captainBoostFromStarters, computeCharacteristicBoosts, getPlayerEffectiveStats,
  type EffectiveStats, type Team,
} from '@shared/game/gameEngine';
import { projectLevel } from '@shared/game/clubProjects';

export interface SquadStatsContext {
  players: Player[];
  coachId: string;
  formationId: string;
  playStyle?: string;
  captain?: string | null;
  isKnockout?: boolean;
  coachPrime?: boolean;
  analysisLevel: number;
  credits?: number;
}

/**
 * The values every card of the squad shows in Meu Time: starters with all their buffs
 * (individual chemistry, position, captain), reserves with only the team-wide ones (coach,
 * team chemistry, characteristics…). Any screen showing the player's own cards (market,
 * trades) uses the same numbers.
 */
export function squadEffectiveStats(ctx: SquadStatsContext): Record<string, EffectiveStats> {
  const xi = ctx.players.slice(0, 11);
  const formationRoles = FORMATIONS.find(f => f.id === ctx.formationId)?.positions.map(p => p.role) ?? [];
  const chemData = calculateChemistry(xi, ctx.coachId, formationRoles, ctx.formationId);
  const captainBoost = captainBoostFromStarters(xi, ctx.captain ?? undefined) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(ctx.players);
  const playStyle = ctx.playStyle ?? 'balanced';
  return Object.fromEntries(ctx.players.map((player, index) => {
    const isStarter = index < 11;
    return [player.id, getPlayerEffectiveStats(
      player,
      isStarter ? (chemData.individual[player.id] ?? 0) : 0,
      isStarter ? (chemData.outOfPosition[player.id] ?? false) : false,
      ctx.coachId,
      // Team-wide chemistry remains the current squad context for reserves;
      // only their individual link score/position penalty is absent.
      chemData.total,
      playStyle,
      {
        captainBoost: isStarter ? captainBoost : undefined,
        charBoosts,
        isKnockout: ctx.isKnockout,
        coachPrime: ctx.coachPrime,
        analysisLevel: ctx.analysisLevel,
        role: isStarter ? (formationRoles[index] ?? player.position) : player.position,
        isSecondary: isStarter ? (chemData.secondaryPos[player.id] ?? false) : false,
        credits: ctx.credits,
      },
    )];
  }));
}

/** squadEffectiveStats for a whole team (its own coach, shape, captain and projects). */
export function teamEffectiveStats(team: Team, isKnockout: boolean, credits: number): Record<string, EffectiveStats> {
  return squadEffectiveStats({
    players: team.players,
    coachId: team.coachId,
    formationId: team.formationId,
    playStyle: team.playStyle,
    captain: team.captain,
    isKnockout,
    coachPrime: team.coachPrime,
    analysisLevel: projectLevel(team.clubProjects, 'analysis'),
    credits,
  });
}
