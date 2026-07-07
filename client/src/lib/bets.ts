// UCL Immortals — Sistema de Palpite (apostas de pontos no placar de partidas).
// Módulo PURO: tipo, constantes de balanço e liquidação. Sem React/engine/rede.
// A regra de crédito diferido (só creditar na revelação) vive nos reducers/handlers,
// não aqui — este módulo só CALCULA se ganhou e quanto.

export const BET_OUTCOME_MULT = 1.5;  // acertar V/E/D
export const BET_EXACT_MULT = 2.5;    // acertar o placar exato
export const BET_ROUND_CAP = 200;     // teto de stake TOTAL por rodada
export const BET_MAX_GOALS = 15;      // teto do stepper de placar (0..15 por lado)

export interface Bet {
  matchKey: string;      // id estável da partida (ver builders abaixo)
  homeGoals: number;     // placar palpitado (perspectiva do mando da partida)
  awayGoals: number;
  stake: number;
  settled?: boolean;     // resultado já calculado (não exibir/creditar ainda)
  revealed?: boolean;    // já creditado + exibido (pós anti-spoiler)
  won?: boolean;
  tier?: 'exact' | 'outcome' | 'miss';
  payout?: number;       // quanto foi/será creditado (0 se miss)
}

// Compara o palpite com o placar real (orientado ao mando daquela partida).
export function settleBet(
  bet: Bet,
  result: { homeGoals: number; awayGoals: number }
): { won: boolean; tier: 'exact' | 'outcome' | 'miss'; payout: number } {
  const exact = bet.homeGoals === result.homeGoals && bet.awayGoals === result.awayGoals;
  const sign = (h: number, a: number) => Math.sign(h - a); // 1 casa / 0 empate / -1 fora
  const outcomeRight = sign(bet.homeGoals, bet.awayGoals) === sign(result.homeGoals, result.awayGoals);
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
export function canPlaceStake(bets: Bet[], keyPrefix: string, matchKey: string, stake: number): boolean {
  const used = bets.filter(b => b.matchKey.startsWith(keyPrefix) && b.matchKey !== matchKey).reduce((s, b) => s + b.stake, 0);
  return stake > 0 && used + stake <= BET_ROUND_CAP;
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
  bets: Bet[], ties: KoTieLike[], playerTeamId: string, watchedLegKeys: string[]
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
