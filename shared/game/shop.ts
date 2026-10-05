// UCL Immortals — Shop & points economy.
// Pure data + formulas (no React, no engine cycle): how many points a league match awards,
// what each shop item costs, and the escalating cost of training a player. The reducer in
// GameContext applies the effects; the generators (star pack / scout) live in gameEngine
// (they need the player pool). Designed to be a balanced points SINK, not a snowball.
import type { MatchResult } from './gameEngine';
import type { CompetitionPointsConfig } from './competition';
export const PLAYER_PACK_RARITIES = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'] as const;
export type PlayerPackRarity = typeof PLAYER_PACK_RARITIES[number];
export type RegularPlayerPackRarity = Exclude<PlayerPackRarity, 'unique'>;

export const PLAYER_PACK_META: Record<PlayerPackRarity, {
  label: string;
  icon: string;
  color: string;
  description: string;
}> = {
  bronze: { label: 'BRONZE', icon: '🥉', color: '#CD7F32', description: 'A base do elenco, com jogadores de raridade Bronze.' },
  silver: { label: 'PRATA', icon: '🥈', color: '#A8A8B8', description: 'Peças confiáveis para fortalecer o time.' },
  gold: { label: 'OURO', icon: '🥇', color: '#C9A84C', description: 'Jogadores de alto nível para dar qualidade ao elenco.' },
  legendary: { label: 'LENDÁRIA', icon: '🔥', color: '#FF8C00', description: 'Cartas históricas de raridade Lendária.' },
  immortal: { label: 'IMORTAL', icon: '👑', color: '#FFD700', description: 'Ícones raros de raridade Imortal.' },
  unique: { label: 'ÚNICA', icon: '⭐', color: '#F0E6C0', description: 'Cartas especiais de overall 99 e até duas características.' },
};

// ── Points earned per league match (performance-based, with catch-up for losses) ──
const WIN_PTS = 100;
const DRAW_PTS = 45;
const LOSS_PTS = 15;          // even a loss pays a little so you're never stuck
const GD_PTS = 12;            // per goal of POSITIVE margin
const GOAL_PTS = 3;           // per goal scored (rewards attacking)
const CLEAN_SHEET_PTS = 20;   // not conceding

export interface MatchPoints {
  /** Stable match identity used to acknowledge the reward exactly once in the UI. */
  matchKey?: string;
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
  /** Optional post-match modifiers, populated after the project/variant bonuses are applied. */
  baseTotal?: number;
  supportersBonus?: number;
  supportersPercent?: number;
  supportersVenue?: 'home' | 'away' | 'neutral';
  magnataBonus?: number;
  magnataPercent?: number;
  /** 📺 Midiático — credits from its goals. */
  midiaticoBonus?: number;
  /** 🔥 Recuperação — extra credits paid on a loss, scaled by the CURRENT losing streak. */
  lossStreakBonus?: number;
  lossStreakAfter?: number;
}

// Points the PLAYER earns from one finished league match (from their perspective).
export function computeMatchPoints(result: MatchResult, playerTeamId: string): MatchPoints {
  return computeMatchPointsWithConfig(result, playerTeamId, {
    win: WIN_PTS,
    draw: DRAW_PTS,
    loss: LOSS_PTS,
    goalDifference: GD_PTS,
    goal: GOAL_PTS,
    cleanSheet: CLEAN_SHEET_PTS,
  });
}

/** Same breakdown as the current economy, with values supplied by the format preset. */
export function computeMatchPointsWithConfig(result: MatchResult, playerTeamId: string, config: CompetitionPointsConfig): MatchPoints {
  const isHome = result.homeTeamId === playerTeamId;
  const goalsFor = isHome ? result.homeGoals : result.awayGoals;
  const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
  const gd = goalsFor - goalsAgainst;
  const outcome: MatchPoints['outcome'] = gd > 0 ? 'win' : gd < 0 ? 'loss' : 'draw';

  const base = outcome === 'win' ? config.win : outcome === 'draw' ? config.draw : config.loss;
  const gdBonus = Math.max(0, gd) * config.goalDifference;
  const goalsBonus = goalsFor * config.goal;
  const csBonus = goalsAgainst === 0 ? config.cleanSheet : 0;

  return { total: base + gdBonus + goalsBonus + csBonus, outcome, goalsFor, goalsAgainst, gd, cleanSheet: goalsAgainst === 0, base, gdBonus, goalsBonus, csBonus };
}

// ── 🔥 Recuperação — catch-up bonus for teams stuck on a losing streak ──
// Every loss still pays LOSS_PTS as usual; on TOP of that, each consecutive loss
// beyond the first adds another step, capped so it never reaches WIN_PTS. A win
// or a draw resets the streak back to zero.
export const LOSS_STREAK_BONUS_STEP = 15;
export const LOSS_STREAK_BONUS_MAX_STEPS = 5; // 6th+ loss in a row caps the bonus

/** `priorLossStreak` is how many losses in a row happened BEFORE this match. */
export function lossStreakBonus(outcome: MatchPoints['outcome'], priorLossStreak: number): number {
  if (outcome !== 'loss') return 0;
  const steps = Math.min(Math.max(0, Math.floor(priorLossStreak)), LOSS_STREAK_BONUS_MAX_STEPS);
  return steps * LOSS_STREAK_BONUS_STEP;
}

/** Next streak value to persist on the team after this match's outcome. */
export function nextLossStreak(outcome: MatchPoints['outcome'], priorLossStreak: number): number {
  return outcome === 'loss' ? Math.max(0, Math.floor(priorLossStreak)) + 1 : 0;
}

// ── Fixed item costs ──
export const SHOP_COSTS = {
  changeCoach: 250,
  turbinar: 300,
  playerPack: {
    bronze: 60,
    silver: 100,
    gold: 160,
    legendary: 300,
    immortal: 450,
    unique: 750,
  } satisfies Record<PlayerPackRarity, number>,
  scout: 220,
  removeVariant: 150, // 🧹 remove a característica de um jogador (pra poder aplicar outra)
  uniqueCard: 750,    // ⭐ Pacote Único (oferta de 4 cartas por rodada; sorteia uma, raridade Única, overall 99)
} as const;

export function playerPackCost(rarity: PlayerPackRarity): number {
  return SHOP_COSTS.playerPack[rarity];
}

/** 🏷️ Pechincheiro: discount on shop items while one is in the squad (does not stack). */
export const PECHINCHEIRO_DISCOUNT = 0.15;

/**
 * Price of a shop item (Turbinar, removing a characteristic, packs, Caça-Talentos,
 * coach change) for this squad. Training, physio and club projects never use it.
 */
export function shopItemCost(baseCost: number, players: ReadonlyArray<{ pechincheiro?: boolean } | null | undefined>): number {
  return players.some(player => player?.pechincheiro) ? Math.round(baseCost * (1 - PECHINCHEIRO_DISCOUNT)) : baseCost;
}

function isPlayerPackRarity(value: unknown): value is PlayerPackRarity {
  return typeof value === 'string' && (PLAYER_PACK_RARITIES as readonly string[]).includes(value);
}

export function isRegularPlayerPackRarity(value: unknown): value is Exclude<PlayerPackRarity, 'unique'> {
  return isPlayerPackRarity(value) && value !== 'unique';
}

// ⭐ Técnico Prime (Fase 2): critério + custo pra evoluir o técnico.
export const PRIME_COST = 350;
export const PRIME_WINS_REQUIRED = 4;
export function canEvolvePrime(wins: number, points: number): boolean {
  return wins >= PRIME_WINS_REQUIRED && points >= PRIME_COST;
}

// 🏪 Mercado (venda solo): quanto o jogador recebe ao vender uma RESERVA, por raridade.
// Calibrado modesto vs. ganho por partida (~100-150 pts) pra recompensar sem virar farm.
const SELL_VALUES: Record<string, number> = {
  bronze: 30,
  silver: 60,
  gold: 100,
  legendary: 180,
  immortal: 250,
  unique: 400,
};
export function sellValue(rarity: string): number {
  return SELL_VALUES[rarity] ?? SELL_VALUES.bronze;
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
export type ShopVariant = 'inForm' | 'lobo' | 'coringa' | 'nomade' | 'pilar' | 'martir' | 'idolo' | 'decimoHomem' | 'pipoqueiro' | 'noe' | 'forasteiro' | 'colecionador' | 'estribado' | 'todosPorUm' | 'capitaoNato' | 'magnata' | 'fragil' | 'prodigio' | 'resiliente' | 'goleador' | 'garcom' | 'arrogante' | 'mercenario' | 'padrinho' | 'lapidador' | 'apostador' | 'agregador' | 'pechincheiro' | 'midiatico';
export const TURBINAR_VARIANTS: { key: ShopVariant; icon: string; label: string; color: string; desc: string }[] = [
  { key: 'inForm', icon: '⚡', label: 'Em Alta', color: '#39FF14', desc: '+4 em todos os atributos.' },
  { key: 'lobo', icon: '🐺', label: 'Lobo Solitário', color: '#A855F7', desc: '+7 em todos os atributos, mas −12 na química geral do time.' },
  { key: 'coringa', icon: '🃏', label: 'Coringa', color: '#EF4444', desc: 'Joga em qualquer posição sem penalidade de stats nem química.' },
  { key: 'nomade', icon: '🌍', label: 'Nômade', color: '#3B82F6', desc: 'Conta como qualquer nação para vínculos de química.' },
  { key: 'pilar', icon: '🧱', label: 'Pilar', color: '#FFFFFF', desc: '+12 na química geral do time só por estar na escalação.' },
  { key: 'martir', icon: '🩸', label: 'Mártir', color: '#B91C1C', desc: '−6 em todos os atributos nele, mas dá +5 em tudo a 2 titulares que você escolhe.' },
  { key: 'idolo', icon: '❤️', label: 'Ídolo', color: '#F59E0B', desc: '+2 em todos os atributos a cada titular do MESMO CLUBE que ele.' },
  { key: 'decimoHomem', icon: '🪑', label: '12º Homem', color: '#14B8A6', desc: 'No banco, dá +1 em todos os atributos a todo o time.' },
  { key: 'pipoqueiro', icon: '🍿', label: 'Pipoqueiro', color: '#EC4899', desc: '+7 em todos os atributos na fase de liga, mas −7 em tudo no mata-mata.' },
  { key: 'noe', icon: '🛟', label: 'Noé', color: '#22D3EE', desc: '+20 em tudo NELE e +50 na química geral — SÓ enquanto for o único titular com característica.' },
  { key: 'forasteiro', icon: '🧳', label: 'Forasteiro', color: '#A3E635', desc: '+8 em tudo quando é o único titular do seu país E do seu clube.' },
  { key: 'colecionador', icon: '🧩', label: 'Colecionador', color: '#C084FC', desc: '+1 em todos os atributos por jogador que estiver na reserva.' },
  { key: 'estribado', icon: '💰', label: 'Estribado', color: '#FACC15', desc: '+1 em todos os atributos a cada 100 créditos que você possui.' },
  { key: 'todosPorUm', icon: '🤝', label: 'Todos por um', color: '#4ADE80', desc: 'Sozinha não faz nada. Se os 11 titulares tiverem, todos ganham +20 em tudo e o time recebe +50 de química geral.' },
  { key: 'capitaoNato', icon: '🗣️', label: 'Capitão Nato', color: '#F97316', desc: 'Se for o CAPITÃO do time, o bônus de capitão vem DOBRADO.' },
  { key: 'magnata', icon: '🤑', label: 'Magnata', color: '#16A34A', desc: 'Titular: multiplica os créditos da partida por 1,5, na liga e no mata-mata. Mas −7 em todos os atributos nele.' },
  { key: 'fragil', icon: '🩹', label: 'Frágil', color: '#F59E0B', desc: '+7 em todos os atributos, mas aumenta drasticamente a chance de se machucar.' },
  { key: 'prodigio', icon: '📈', label: 'Prodígio', color: '#FDE047', desc: '+1 em todos os atributos a cada partida iniciada como titular desde que recebeu a característica.' },
  { key: 'resiliente', icon: '🔥', label: 'Resiliente', color: '#FB7185', desc: '+2 em todos os atributos a cada derrota do time em que for titular. Acumula.' },
  { key: 'goleador', icon: '⚽', label: 'Goleador', color: '#F97316', desc: '+1 em todos os atributos a cada 3 gols marcados. Acumula.' },
  { key: 'garcom', icon: '🎯', label: 'Garçom', color: '#38BDF8', desc: '+1 em todos os atributos a cada 2 assistências dadas. Acumula.' },
  { key: 'arrogante', icon: '👑', label: 'Arrogante', color: '#E879F9', desc: '+2 em todos os atributos por gol; a cada 2 gols, os outros titulares perdem −1 em tudo.' },
  { key: 'mercenario', icon: '🏆', label: 'Conquistador', color: '#F59E0B', desc: '+2 em todos os atributos por missão concluída. Acumula sem limite.' },
  { key: 'padrinho', icon: '🤵', label: 'Padrinho', color: '#C4B5FD', desc: 'O afilhado (um titular que você escolhe) ganha +3 em tudo enquanto os dois jogam juntos. A cada gol do afilhado, o Padrinho ganha +1 permanente.' },
  { key: 'lapidador', icon: '💎', label: 'Lapidador', color: '#93C5FD', desc: 'A cada vitória em que ele for titular, todos os reservas ganham +1 permanente em todos os atributos. Acumula.' },
  { key: 'apostador', icon: '🎲', label: 'Apostador', color: '#D9752F', desc: '+2 permanente em todos os atributos a cada aposta vencida com ele no elenco. Acumula.' },
  { key: 'agregador', icon: '🔗', label: 'Agregador', color: '#A5ACC2', desc: 'Titular: todo o time ganha +1 em todos os atributos para cada característica diferente entre os titulares.' },
  { key: 'pechincheiro', icon: '🏷️', label: 'Pechincheiro', color: '#E0315F', desc: 'No elenco: Turbinar, remover característica, pacotes, Caça-Talentos e troca de técnico custam 15% a menos.' },
  { key: 'midiatico', icon: '📺', label: 'Midiático', color: '#7C6FF0', desc: 'Cada gol dele rende 15 créditos.' },
];
