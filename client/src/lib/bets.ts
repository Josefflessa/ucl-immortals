// UCL Immortals — Sistema de Palpite (apostas de pontos em partidas).
// Módulo PURO: tipo, constantes de balanço e liquidação. Sem React/engine/rede.
// A regra de crédito diferido (só creditar na revelação) vive nos reducers/handlers,
// não aqui — este módulo só CALCULA se ganhou e quanto.

import { DEFAULT_MATCH_SETTINGS } from './competition';

export const BET_OUTCOME_MULT = 1.5;  // acertar V/E/D
export const BET_EXACT_MULT = 2.5;    // acertar o placar exato
export const BET_ROUND_CAP = DEFAULT_MATCH_SETTINGS.betRoundCap; // teto padrão de stake TOTAL por rodada
export const BET_MAX_GOALS = 15;      // teto do stepper de placar (0..15 por lado)

// A combinada usa poucos mercados estáveis e fáceis de explicar. As odds-base não
// são multiplicadas integralmente porque alguns mercados são correlacionados (por
// exemplo, ambas marcam e mais de 2,5). O desconto abaixo mantém o prêmio atrativo
// sem transformar uma stake pequena em uma fonte desproporcional de pontos.
export const BET_BUILDER_MIN_SELECTIONS = 1;
export const BET_BUILDER_MAX_SELECTIONS = 4;
export const BET_BUILDER_CORRELATION_DISCOUNT = {
  1: 1,
  2: 0.72,
  3: 0.58,
  4: 0.48,
} as const;
export const BET_BUILDER_MAX_MULTIPLIER = 2.75;
export const BET_TOTAL_GOALS_LINES = [0.5, 1.5, 2.5, 3.5, 4.5] as const;
export type BetTotalGoalsLine = typeof BET_TOTAL_GOALS_LINES[number];
const BET_TOTAL_GOALS_MULTIPLIERS: Record<'over' | 'under', Record<BetTotalGoalsLine, number>> = {
  over: { 0.5: 1.15, 1.5: 1.35, 2.5: 1.8, 3.5: 2.2, 4.5: 2.65 },
  under: { 0.5: 2.65, 1.5: 2.1, 2.5: 1.8, 3.5: 1.45, 4.5: 1.2 },
};

export type BetMarket = 'score' | 'builder';

export type BetBuilderSelection =
  | { type: 'exact_score'; homeGoals: number; awayGoals: number }
  | { type: 'outcome'; value: 'home' | 'draw' | 'away' }
  | { type: 'total_goals'; operator: 'over' | 'under'; line: BetTotalGoalsLine }
  | { type: 'both_score'; value: boolean };

export type BetDraft = {
  matchKey: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeGoals?: number;
  awayGoals?: number;
  stake: number;
  market?: BetMarket;
  selections?: unknown;
};

export interface Bet {
  matchKey: string;      // id estável da partida (ver builders abaixo)
  // The score is stored from the perspective of the actual home/away teams of
  // that leg. These ids were added after the first version of betting so old
  // saved bets remain valid without them.
  homeTeamId?: string;
  awayTeamId?: string;
  homeGoals: number;     // placar palpitado (perspectiva do mando da partida)
  awayGoals: number;
  stake: number;
  // `market` is optional for backwards compatibility with old solo saves and
  // rooms created before bet builder support. Missing means the original score bet.
  market?: BetMarket;
  selections?: BetBuilderSelection[];
  // Stored when the ticket is created so future balance changes cannot alter an
  // already placed bet's return. The server always calculates this value itself.
  multiplier?: number;
  settled?: boolean;     // resultado já calculado (não exibir/creditar ainda)
  revealed?: boolean;    // já creditado + exibido (pós anti-spoiler)
  won?: boolean;
  tier?: 'exact' | 'outcome' | 'builder' | 'miss';
  payout?: number;       // quanto foi/será creditado (0 se miss)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates and canonicalizes the public builder payload. This is intentionally
 * strict because it is also used by the server for untrusted socket input.
 */
export function normalizeBuilderSelections(value: unknown): BetBuilderSelection[] | null {
  if (!Array.isArray(value)
    || value.length < BET_BUILDER_MIN_SELECTIONS
    || value.length > BET_BUILDER_MAX_SELECTIONS) return null;

  const parsed: BetBuilderSelection[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.type !== 'string') return null;
    const rawHomeGoals = raw.homeGoals;
    const rawAwayGoals = raw.awayGoals;
    if (raw.type === 'exact_score'
      && Number.isInteger(rawHomeGoals) && Number.isInteger(rawAwayGoals)
      && (rawHomeGoals as number) >= 0 && (rawAwayGoals as number) >= 0
      && (rawHomeGoals as number) <= BET_MAX_GOALS && (rawAwayGoals as number) <= BET_MAX_GOALS) {
      parsed.push({ type: 'exact_score', homeGoals: rawHomeGoals as number, awayGoals: rawAwayGoals as number });
      continue;
    }
    if (raw.type === 'outcome'
      && (raw.value === 'home' || raw.value === 'draw' || raw.value === 'away')) {
      parsed.push({ type: 'outcome', value: raw.value });
      continue;
    }
    if (raw.type === 'total_goals'
      && (raw.operator === 'over' || raw.operator === 'under')
      && BET_TOTAL_GOALS_LINES.includes(raw.line as BetTotalGoalsLine)) {
      parsed.push({ type: 'total_goals', operator: raw.operator, line: raw.line as BetTotalGoalsLine });
      continue;
    }
    if (raw.type === 'both_score' && typeof raw.value === 'boolean') {
      parsed.push({ type: 'both_score', value: raw.value });
      continue;
    }
    return null;
  }

  // Only one selection from each market is allowed. Repeating a market would
  // create meaningless conditions such as over 2.5 + under 2.5.
  return new Set(parsed.map(selection => selection.type)).size === parsed.length ? parsed : null;
}

export function builderSelectionMultiplier(selection: BetBuilderSelection): number {
  if (selection.type === 'exact_score') return BET_EXACT_MULT;
  if (selection.type === 'outcome') return BET_OUTCOME_MULT;
  if (selection.type === 'total_goals') return BET_TOTAL_GOALS_MULTIPLIERS[selection.operator][selection.line];
  if (selection.type === 'both_score') return selection.value ? 1.7 : 1.6;
  return 0;
}

/** Returns the locked, conservative multiplier for a valid combined ticket. */
export function calculateBuilderMultiplier(selections: unknown): number | null {
  const normalized = normalizeBuilderSelections(selections);
  if (!normalized) return null;
  const individualMultipliers = normalized.map(builderSelectionMultiplier);
  const product = individualMultipliers.reduce((total, multiplier) => total * multiplier, 1);
  const discount = BET_BUILDER_CORRELATION_DISCOUNT[normalized.length as 1 | 2 | 3 | 4];
  const discountedProduct = product * discount;
  // A correlação pode reduzir o produto, mas nunca pode transformar uma
  // condição adicional em uma pior cotação do que a melhor condição isolada.
  // Ex.: "Casa vence" (1,50) + "Mais de 0,5 gols" (1,15) continua em 1,50,
  // pois uma vitória da casa já implica pelo menos um gol na partida.
  const strongestIndividual = Math.max(...individualMultipliers);
  return Math.min(
    BET_BUILDER_MAX_MULTIPLIER,
    Math.round(Math.max(strongestIndividual, discountedProduct) * 100) / 100,
  );
}

/** Creates a canonical ticket for both solo state and the authoritative server. */
export function createBet(draft: BetDraft): Bet | null {
  if (typeof draft.matchKey !== 'string' || draft.matchKey.length === 0 || draft.matchKey.length > 160
    || !Number.isInteger(draft.stake) || draft.stake <= 0) return null;
  const market = draft.market ?? 'score';

  if (market === 'score') {
    if (!Number.isInteger(draft.homeGoals) || !Number.isInteger(draft.awayGoals)
      || draft.homeGoals! < 0 || draft.awayGoals! < 0
      || draft.homeGoals! > BET_MAX_GOALS || draft.awayGoals! > BET_MAX_GOALS) return null;
    return {
      matchKey: draft.matchKey,
      homeTeamId: draft.homeTeamId,
      awayTeamId: draft.awayTeamId,
      homeGoals: draft.homeGoals!,
      awayGoals: draft.awayGoals!,
      stake: draft.stake,
      market: 'score',
    };
  }

  if (market !== 'builder') return null;
  const selections = normalizeBuilderSelections(draft.selections);
  const multiplier = calculateBuilderMultiplier(selections);
  if (!selections || multiplier == null) return null;
  return {
    matchKey: draft.matchKey,
    homeTeamId: draft.homeTeamId,
    awayTeamId: draft.awayTeamId,
    // Builder tickets do not use a score. Keep the legacy fields populated so
    // old readers and serializers remain safe.
    homeGoals: 0,
    awayGoals: 0,
    stake: draft.stake,
    market: 'builder',
    selections,
    multiplier,
  };
}

export function describeBet(bet: Pick<Bet, 'market' | 'selections' | 'homeGoals' | 'awayGoals'>): string {
  if (bet.market === 'builder') {
    const selections = normalizeBuilderSelections(bet.selections);
    if (selections) return selections.map(selection => {
      if (selection.type === 'exact_score') return `Placar ${selection.homeGoals}-${selection.awayGoals}`;
      if (selection.type === 'outcome') return selection.value === 'home' ? 'Casa' : selection.value === 'away' ? 'Fora' : 'Empate';
      if (selection.type === 'total_goals') return `${selection.operator === 'over' ? '+' : '-'}${selection.line.toString().replace('.', ',')} gols`;
      return selection.value ? 'Ambas' : 'Não ambas';
    }).join(' + ');
    return 'Combinada';
  }
  return `${bet.homeGoals}-${bet.awayGoals}`;
}

function builderSelectionHit(
  selection: BetBuilderSelection,
  homeGoals: number,
  awayGoals: number,
): boolean {
  if (selection.type === 'exact_score') return homeGoals === selection.homeGoals && awayGoals === selection.awayGoals;
  if (selection.type === 'outcome') {
    const sign = Math.sign(homeGoals - awayGoals);
    return selection.value === (sign > 0 ? 'home' : sign < 0 ? 'away' : 'draw');
  }
  if (selection.type === 'total_goals') {
    const total = homeGoals + awayGoals;
    return selection.operator === 'over' ? total > selection.line : total < selection.line;
  }
  return (homeGoals > 0 && awayGoals > 0) === selection.value;
}

// Compara o palpite com o placar real (orientado ao mando daquela partida).
export function settleBet(
  bet: Bet,
  result: {
    homeGoals: number;
    awayGoals: number;
    homeTeamId?: string;
    awayTeamId?: string;
  }
): { won: boolean; tier: 'exact' | 'outcome' | 'builder' | 'miss'; payout: number } {
  // A two-legged tie changes its home/away order on the return leg. New bets
  // carry the leg's team ids, so a stale UI/order can never turn a win into a
  // loss merely because the two teams were displayed in the opposite order.
  const reversed = !!bet.homeTeamId && !!bet.awayTeamId
    && !!result.homeTeamId && !!result.awayTeamId
    && bet.homeTeamId === result.awayTeamId
    && bet.awayTeamId === result.homeTeamId;
  const betHomeGoals = reversed ? bet.awayGoals : bet.homeGoals;
  const betAwayGoals = reversed ? bet.homeGoals : bet.awayGoals;

  if (bet.market === 'builder') {
    const selections = normalizeBuilderSelections(bet.selections);
    const multiplier = selections ? (bet.multiplier ?? calculateBuilderMultiplier(selections)) : null;
    // A malformed legacy/network ticket must fail closed and never credit points.
    if (!selections || multiplier == null) return { won: false, tier: 'miss', payout: 0 };
    const effectiveHomeGoals = reversed ? result.awayGoals : result.homeGoals;
    const effectiveAwayGoals = reversed ? result.homeGoals : result.awayGoals;
    const won = selections.every(selection => builderSelectionHit(
      selection,
      effectiveHomeGoals,
      effectiveAwayGoals,
    ));
    const exactOnly = selections.length === 1 && selections[0].type === 'exact_score';
    return won
      ? { won: true, tier: exactOnly ? 'exact' : 'builder', payout: Math.round(bet.stake * multiplier) }
      : { won: false, tier: 'miss', payout: 0 };
  }

  const exact = betHomeGoals === result.homeGoals && betAwayGoals === result.awayGoals;
  const sign = (h: number, a: number) => Math.sign(h - a); // 1 casa / 0 empate / -1 fora
  const outcomeRight = sign(betHomeGoals, betAwayGoals) === sign(result.homeGoals, result.awayGoals);
  if (exact) return { won: true, tier: 'exact', payout: Math.round(bet.stake * BET_EXACT_MULT) };
  if (outcomeRight) return { won: true, tier: 'outcome', payout: Math.round(bet.stake * BET_OUTCOME_MULT) };
  return { won: false, tier: 'miss', payout: 0 };
}

export function buildLeagueMatchKey(round: number, homeTeamId: string, awayTeamId: string): string {
  return `L${round}:${homeTeamId}-${awayTeamId}`;
}

export function buildKnockoutMatchKey(matchId: string, leg: number): string {
  return `K${matchId}:${leg}`;
}

// Soma dos stakes dos palpites cujo matchKey começa com o prefixo da rodada (ex.: 'L3:').
export function roundStakeUsed(bets: Bet[], keyPrefix: string): number {
  return bets.filter(b => b.matchKey.startsWith(keyPrefix)).reduce((s, b) => s + b.stake, 0);
}

// Cabe apostar `stake` em `matchKey` sem estourar BET_ROUND_CAP? (ignora o bet que está
// sendo editado, pra troca de valor no mesmo jogo não somar duas vezes.)
export function canPlaceStake(bets: Bet[], keyPrefix: string, matchKey: string, stake: number, cap = BET_ROUND_CAP): boolean {
  const used = bets.filter(b => b.matchKey.startsWith(keyPrefix) && b.matchKey !== matchKey).reduce((s, b) => s + b.stake, 0);
  return stake > 0 && used + stake <= cap;
}

// Prefixo do teto de aposta pra `canPlaceStake`: liga é POR RODADA (compartilha o teto entre
// os jogos da rodada → prefixo `Lr:`); mata-mata é POR PARTIDA (cada tie tem seu próprio teto
// → o prefixo é o PRÓPRIO matchKey `KmatchId:leg`). Fonte única — o servidor faz o mesmo.
export function betCapPrefix(matchKey: string, leagueRound: number): string {
  return matchKey.startsWith('K') ? matchKey : `L${leagueRound}:`;
}

// Estrutura mínima de um confronto de mata-mata que o reveal precisa conhecer.
export interface KoTieLike {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  leg1?: { homeGoals: number; awayGoals: number } | null;
  leg2?: { homeGoals: number; awayGoals: number } | null;
  result?: { homeGoals: number; awayGoals: number } | null;
}

// Liquida+revela os palpites de mata-mata cujo resultado JÁ EXISTE e que são SEGUROS de
// revelar: confronto que o jogador NÃO joga (o placar dele já é visível → sem spoiler) OU
// perna do confronto próprio que ele JÁ ASSISTIU. O confronto próprio ainda não assistido
// fica intocado (anti-spoiler). Puro: devolve os bets atualizados + o total a creditar.
// Corrige o bug de apostar num confronto que você não disputa (o resultado nunca revelava,
// pois a revelação estava presa a você terminar a sua própria partida).
export function revealEligibleKoBets(
  bets: Bet[], ties: KoTieLike[], playerTeamId: string, watchedLegKeys: string[] = []
): { bets: Bet[]; winnings: number } {
  let winnings = 0;
  const out = bets.map(bet => {
    if (bet.revealed || !bet.matchKey.startsWith('K')) return bet;
    const [id, legStr] = bet.matchKey.slice(1).split(':');
    const leg = Number(legStr);
    const tie = ties.find(t => t.id === id);
    if (!tie) return bet;
    const res = leg === 2 ? tie.leg2 : (tie.leg1 ?? tie.result);
    if (!res) return bet;
    const isParticipant = tie.homeTeamId === playerTeamId || tie.awayTeamId === playerTeamId;
    const watchedThisLeg = watchedLegKeys.includes(`${id}_l${leg}`);
    if (isParticipant && !watchedThisLeg) return bet; // anti-spoiler: espera assistir
    const r = settleBet(bet, res);
    winnings += r.payout;
    return { ...bet, settled: true, revealed: true, won: r.won, tier: r.tier, payout: r.payout };
  });
  return { bets: out, winnings };
}
