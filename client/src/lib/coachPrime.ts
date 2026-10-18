import type { Coach } from '@shared/game/gameData';

export interface CoachPrimeDefinition {
  name: string;
  baseNormal: string;
  basePrime: string;
  normal: string;
  prime: string;
}

/** Presentation is derived from the same rules the match engine applies. */
export function coachPrimeDefinition(coach: Coach): CoachPrimeDefinition {
  return {
    name: coach.specialAbilityName,
    baseNormal: coach.baseEffects.map(effect => effect.description).join(' '),
    basePrime: coach.baseEffects.map(effect => effect.primeDescription ?? effect.description).join(' '),
    normal: coach.specialEffects.map(effect => effect.description).filter(Boolean).join(' '),
    prime: coach.specialEffects.map(effect => effect.primeDescription ?? effect.description).filter(Boolean).join(' '),
  };
}

export function coachBaseDescription(coach: Coach, isPrime = false): string[] {
  return coach.baseEffects.map(effect => isPrime ? effect.primeDescription ?? effect.description : effect.description);
}
