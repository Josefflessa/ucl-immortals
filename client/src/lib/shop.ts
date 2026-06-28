// UCL Immortals — Shop & points economy.
// Pure data + formulas (no React, no engine cycle): how many points a league match awards,
// what each shop item costs, and the escalating cost of training a player. The reducer in
// GameContext applies the effects; the generators (star pack / scout) live in gameEngine
// (they need the player pool). Designed to be a balanced points SINK, not a snowball.
import type { MatchResult } from './gameEngine';

// ── Points earned per league match (performance-based, with catch-up for losses) ──
export const WIN_PTS = 100;
export const DRAW_PTS = 45;
export const LOSS_PTS = 15;          // even a loss pays a little so you're never stuck
export const GD_PTS = 12;            // per goal of POSITIVE margin
export const GOAL_PTS = 3;           // per goal scored (rewards attacking)
export const CLEAN_SHEET_PTS = 20;   // not conceding

export interface MatchPoints {
  total: number;
  outcome: 'win' | 'draw' | 'loss';
  goalsFor: number;
  goalsAgainst: number;
  gd: number;
  cleanSheet: boolean;
  base: number;
  gdBonus: number;
  goalsBonus: number;
  csBonus: number;
}

// Points the PLAYER earns from one finished league match (from their perspective).
export function computeMatchPoints(result: MatchResult, playerTeamId: string): MatchPoints {
  const isHome = result.homeTeamId === playerTeamId;
  const goalsFor = isHome ? result.homeGoals : result.awayGoals;
  const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
  const gd = goalsFor - goalsAgainst;
  const outcome: MatchPoints['outcome'] = gd > 0 ? 'win' : gd < 0 ? 'loss' : 'draw';

  const base = outcome === 'win' ? WIN_PTS : outcome === 'draw' ? DRAW_PTS : LOSS_PTS;
  const gdBonus = Math.max(0, gd) * GD_PTS;
  const goalsBonus = goalsFor * GOAL_PTS;
  const csBonus = goalsAgainst === 0 ? CLEAN_SHEET_PTS : 0;

  return { total: base + gdBonus + goalsBonus + csBonus, outcome, goalsFor, goalsAgainst, gd, cleanSheet: goalsAgainst === 0, base, gdBonus, goalsBonus, csBonus };
}

// ── Fixed item costs ──
export const SHOP_COSTS = {
  changeCoach: 250,
  turbinar: 300,
  starPack: 350,
  scout: 220,
} as const;

// ── Training (💪) — +3 to a chosen attribute, no cap. Escalating cost per player so stacking
// everything on one star is expensive (≈ a whole league for +12), while spreading is cheap. ──
export const TRAIN_BOOST = 3;
export const TRAIN_BASE_COST = 100;
export const TRAIN_COST_STEP = 50;
export function trainCost(trainCount: number): number {
  return TRAIN_BASE_COST + TRAIN_COST_STEP * Math.max(0, trainCount);
}

export type TrainAttr = 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'vision' | 'composure';
export const TRAIN_ATTRS: { key: TrainAttr; label: string }[] = [
  { key: 'pace', label: 'RITMO' },
  { key: 'shooting', label: 'FINALIZAÇÃO' },
  { key: 'passing', label: 'PASSE' },
  { key: 'dribbling', label: 'DRIBLE' },
  { key: 'defending', label: 'DEFESA' },
  { key: 'physical', label: 'FÍSICO' },
  { key: 'vision', label: 'VISÃO' },
  { key: 'composure', label: 'COMPOSTURA' },
];

// ── "Turbinar Carta" — the special variants the player can buy onto a card. ──
export type ShopVariant = 'inForm' | 'lobo' | 'coringa' | 'nomade' | 'pilar';
export const TURBINAR_VARIANTS: { key: ShopVariant; icon: string; label: string; color: string; desc: string }[] = [
  { key: 'inForm', icon: '⚡', label: 'Em Alta', color: '#39FF14', desc: '+3 em todos os atributos.' },
  { key: 'lobo', icon: '🐺', label: 'Lobo Solitário', color: '#A855F7', desc: '+6 em todos os atributos, mas −12 na química geral do time.' },
  { key: 'coringa', icon: '🃏', label: 'Coringa', color: '#EF4444', desc: 'Joga em qualquer posição sem penalidade de stats nem química.' },
  { key: 'nomade', icon: '🌍', label: 'Nômade', color: '#3B82F6', desc: 'Conta como qualquer nação para vínculos de química.' },
  { key: 'pilar', icon: '🧱', label: 'Pilar', color: '#FFFFFF', desc: '+12 na química geral do time só por estar na escalação.' },
];
