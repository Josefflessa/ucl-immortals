// UCL Immortals — Disciplina & Lesões. Módulo PURO (sem React/rede). A geração DENTRO do jogo
// vive no motor (runMatchSimulation); aqui ficam os tipos, as constantes de balanço, os helpers
// de probabilidade e a lógica de TEMPORADA (aplicar consequências + resolver escalação).
import type { MatchEvent, Team, PlayerCard } from './gameEngine';
import { rebuildTeamChemistry } from './gameEngine';
import { FORMATIONS } from './gameData';

export interface PlayerAvailability { yellows: number; banned: number; injured: number }
export type DisciplineMap = Record<string, PlayerAvailability>; // key = `${teamId}:${playerId}`
// Item de resumo para os avisos ("Fulano suspenso 1j / Ciclano lesão 2j").
export interface DisciplineEntry { teamId: string; playerId: string; playerName: string; games: number; kind: 'ban' | 'injury' }

export const availKey = (teamId: string, playerId: string) => `${teamId}:${playerId}`;
export const isAvailable = (m: DisciplineMap, teamId: string, playerId: string): boolean => {
  const a = m[availKey(teamId, playerId)];
  return !a || (a.banned === 0 && a.injured === 0);
};

// Titulares (índices 0-10) do time que estão INDISPONÍVEIS (suspensos/lesionados). Vazio = pode jogar.
// Usado para BLOQUEAR a rodada até o jogador ajustar a escalação (sem troca automática).
export function unavailableStarters(team: { id: string; players: { id: string; shortName?: string }[] }, m: DisciplineMap): { id: string; shortName?: string }[] {
  return team.players.slice(0, 11).filter(p => !isAvailable(m, team.id, p.id));
}

// ── Constantes de balanço (re-tunáveis) ──
export const YELLOW_ACCUM_THRESHOLD = 3;   // 3 amarelos acumulados = 1 jogo suspenso
export const INJURY_DEBUFF = 12;           // −N em cada atributo do lesionado (resto do jogo)
export const RED_PENALTY = 15;             // força a menos por jogar com 10 (jogar com um a menos DÓI)
export const RED_GK_PENALTY = 24;          // goleiro expulso → jogador de linha no gol (bem pior)
export const INJURY_SEVERITY_WEIGHTS: [1 | 2 | 3, number][] = [[1, 0.6], [2, 0.3], [3, 0.1]];
export const PHYSIO_COST = 250;            // 🏥 Fisioterapia: −1 jogo de lesão

// Multiplicador de risco de cartão por posição (goleiro ~0; atacante baixo; zaga/volante alto).
export const CARD_POS_MULT: Record<string, number> = {
  GK: 0.03, ST: 0.6, CF: 0.6, LW: 0.7, RW: 0.7, CAM: 0.9, LM: 0.9, RM: 0.9,
  CM: 1.1, CDM: 1.35, LB: 1.15, RB: 1.15, CB: 1.3,
};
export const FOUL_YELLOW_BASE = 0.11;      // prob. base de um amarelo por falta (× posição × ímpeto × compostura × tática) → alvo ~1.5 🟨/jogo
export const STRAIGHT_RED_PROB = 0.0007;   // prob. de 🟥 direto por falta (× tática) → alvo baixo (resto vem de 2º amarelo)

// 🔗 Ligação com os LANCES DE PERIGO: uma falta que vira cobrança perigosa (falta dura) ou que corta
// um ataque ameaçador (momentum alto) é mais propensa a cartão. Multiplicam a chance de cartão.
export const DANGEROUS_FOUL_CARD_MULT = 1.7;  // falta que gera cobrança perigosa (dura, perto da área)
export const THREAT_FOUL_CARD_MULT = 1.3;     // falta que interrompe um ataque em momentum alto
export const DANGEROUS_FOUL_INJURY_MULT = 1.5; // falta dura também machuca mais o faltado

// 📉 Controle de VARIÂNCIA (aproxima pico e vale sem mexer na média):
// - COMPRESS: comprime o quanto o ímpeto do jogo (matchAggression) afeta a chance de cartão/lesão
//   (0 = ímpeto não afeta cartão · 1 = afeta cheio). Menor = menos jogos extremos.
// - SETTLE: a cada cartão já mostrado, o árbitro "acalma" um pouco (reduz a chance dos próximos),
//   cortando a cauda de jogos com muitos cartões.
export const CARD_AGGR_COMPRESS = 0.45;
export const CARD_SETTLE = 0.14;
// LENIÊNCIA no 2º amarelo: se o faltador JÁ está amarelado, o juiz pensa mais antes de dar o
// segundo (que expulsa) — como na vida real. Reduz a chance do cartão em 20% NESSE caso (só p/
// quem já tem amarelo; quem ainda não foi amarelado segue com a chance normal).
export const SECOND_YELLOW_LENIENCY = 0.8;
export const compressAggression = (matchAggression: number): number => 1 + (matchAggression - 1) * CARD_AGGR_COMPRESS;
export const settleFactor = (cardsSoFar: number): number => 1 / (1 + cardsSoFar * CARD_SETTLE);

// Fator de agressividade por ESTILO/TÁTICA — modula a chance de cartão do time que marca.
// Pressão alta e marcação sob pressão faltam mais; posse/ataque total faltam menos.
export const TACTIC_AGGRESSION: Record<string, number> = {
  high_press: 1.35, defensive: 1.15, counter: 1.05, balanced: 1.0, all_out_attack: 0.85, possession: 0.8,
};
export const tacticAggression = (playStyle: string): number => TACTIC_AGGRESSION[playStyle] ?? 1;

// Fator de agressividade por FORMAÇÃO — derivado do tamanho da LINHA DE FUNDO (CB/LB/RB). Bloco baixo
// (5 atrás) comete mais falta tática; formação de 3 zagueiros, menos. Alavanca SECUNDÁRIA (a tática
// é o motor principal). Fácil de calibrar: mexa em STEP (força) e MIN/MAX (teto). Neutro em 4 atrás.
export const FORMATION_AGGR_BASE = 1.0;    // 4 defensores na linha = neutro
export const FORMATION_AGGR_STEP = 0.12;   // por defensor da linha de fundo acima/abaixo de 4
export const FORMATION_AGGR_MIN = 0.85;
export const FORMATION_AGGR_MAX = 1.25;
const BACKLINE_ROLES = new Set(['CB', 'LB', 'RB']);
export function formationAggression(formationId: string): number {
  const f = FORMATIONS.find(x => x.id === formationId);
  if (!f) return 1;
  const defCount = f.positions.filter(p => BACKLINE_ROLES.has(p.role)).length;
  const raw = FORMATION_AGGR_BASE + FORMATION_AGGR_STEP * (defCount - 4);
  return Math.max(FORMATION_AGGR_MIN, Math.min(FORMATION_AGGR_MAX, raw));
}
export const INJURY_FOUL_PROB = 0.00528;   // prob. de lesionar o faltado numa falta dura → ~0.08 lesão/jogo (raras)
export const INJURY_RANDOM_BASE = 0.00085; // base de lesão aleatória por titular por jogo (× frag. física)

// ── Helpers de probabilidade (usados pelo motor; puros/testáveis) ──

// Sorteia a gravidade da lesão (1/2/3 jogos) pelos pesos. rng injetável nos testes.
export function rollInjurySeverity(rng: () => number): 1 | 2 | 3 {
  const r = rng();
  let acc = 0;
  for (const [sev, w] of INJURY_SEVERITY_WEIGHTS) { acc += w; if (r < acc) return sev; }
  return 3;
}

// Chance de amarelo numa falta: posição (zaga/volante faltam mais) × cabeça fria (compostura alta
// reduz) × ímpeto do jogo. Goleiro é ~0 pelo CARD_POS_MULT.
export function yellowChance(position: string, composure: number, aggression: number): number {
  const posMult = CARD_POS_MULT[position] ?? 1;
  const compMult = Math.max(0.4, 1.6 - composure / 80); // comp 40→1.1 · 90→0.475 (piso 0.4)
  return FOUL_YELLOW_BASE * posMult * compMult * aggression;
}

// Chance de lesionar o FALTADO numa falta dura — sempre positiva, maior p/ jogador de físico baixo.
export function injuryChanceFromFoul(fouledPhysical: number): number {
  return INJURY_FOUL_PROB * Math.max(0.5, (110 - fouledPhysical) / 60);
}

// Chance de lesão ALEATÓRIA (não-falta) por titular por jogo — quanto menor o físico, mais frágil.
export function randomInjuryChance(physical: number): number {
  return INJURY_RANDOM_BASE * Math.max(0.4, (110 - physical) / 55);
}

// ── Camada de TEMPORADA (pura, testável) ──

interface MatchLike { homeTeamId: string; awayTeamId: string; events: MatchEvent[] }

// Aplica a disciplina de UMA rodada/perna. ORDEM: 1) decrementa quem estava fora nos times que
// jogaram (cumpriu 1 jogo); 2) aplica as consequências deste jogo (então 🟥 hoje = fora do PRÓXIMO).
// `injurySeverityRng` é injetável nos testes (default Math.random).
export function applyMatchDiscipline(
  prev: DisciplineMap,
  playedTeamIds: string[],
  results: MatchLike[],
  nameOf: (teamId: string, playerId: string) => string,
  injurySeverityRng: () => number = Math.random,
): { next: DisciplineMap; newSuspensions: DisciplineEntry[]; newInjuries: DisciplineEntry[] } {
  const next: DisciplineMap = {};
  for (const k in prev) next[k] = { ...prev[k] };

  // 1) DECREMENTA quem estava fora nos times que jogaram.
  for (const teamId of playedTeamIds) {
    for (const k in next) {
      if (!k.startsWith(teamId + ':')) continue;
      if (next[k].banned > 0) next[k].banned--;
      if (next[k].injured > 0) next[k].injured--;
    }
  }

  // 2) APLICA as consequências deste jogo.
  const newSuspensions: DisciplineEntry[] = [];
  const newInjuries: DisciplineEntry[] = [];
  const bump = (teamId: string, playerId: string) => {
    const k = availKey(teamId, playerId);
    if (!next[k]) next[k] = { yellows: 0, banned: 0, injured: 0 };
    return next[k];
  };
  for (const r of results) {
    // amarelos deste jogo, por jogador
    const yellowsThis: Record<string, number> = {};
    for (const e of r.events) {
      if (e.type === 'yellow' && e.playerId) {
        const key = availKey(e.teamId, e.playerId);
        yellowsThis[key] = (yellowsThis[key] ?? 0) + 1;
      }
    }
    for (const key in yellowsThis) {
      const [teamId, playerId] = key.split(':');
      const a = bump(teamId, playerId);
      a.yellows += yellowsThis[key];
      if (a.yellows >= YELLOW_ACCUM_THRESHOLD) {
        a.yellows = 0; a.banned = Math.max(a.banned, 1);
        newSuspensions.push({ teamId, playerId, playerName: nameOf(teamId, playerId), games: 1, kind: 'ban' });
      }
    }
    for (const e of r.events) {
      if (!e.playerId) continue;
      if (e.type === 'red') {
        const a = bump(e.teamId, e.playerId); a.banned = Math.max(a.banned, 1);
        newSuspensions.push({ teamId: e.teamId, playerId: e.playerId, playerName: nameOf(e.teamId, e.playerId), games: 1, kind: 'ban' });
      } else if (e.type === 'injury') {
        const sev = rollInjurySeverity(injurySeverityRng);
        const a = bump(e.teamId, e.playerId); a.injured = Math.max(a.injured, sev);
        newInjuries.push({ teamId: e.teamId, playerId: e.playerId, playerName: nameOf(e.teamId, e.playerId), games: sev, kind: 'injury' });
      }
    }
  }
  return { next, newSuspensions, newInjuries };
}

// Zera os amarelos acumulados (ao entrar no mata-mata); preserva suspensões/lesões em curso.
export function resetYellowsForKnockout(m: DisciplineMap): DisciplineMap {
  const out: DisciplineMap = {};
  for (const k in m) out[k] = { ...m[k], yellows: 0 };
  return out;
}

// 🏥 Fisioterapia: reduz 1 jogo de lesão (piso 0).
export function healInjury(m: DisciplineMap, teamId: string, playerId: string): DisciplineMap {
  const k = availKey(teamId, playerId);
  if (!m[k]) return m;
  return { ...m, [k]: { ...m[k], injured: Math.max(0, m[k].injured - 1) } };
}

// Resolve a escalação de um time contra o mapa de disponibilidade: para cada titular (0-10)
// indisponível, promove o melhor reserva compatível do banco. GOLEIRO é caso à parte: promove um
// GK reserva; sem GK no banco, coloca o melhor jogador de linha no gol marcado isOOP (nunca deixa
// a XI sem goleiro). Recomputa química e re-seleciona capitão/batedores que saírem. Puro (não muta).
export function resolveAvailableLineup(team: Team, m: DisciplineMap): { team: Team; forced: { outId: string; inId: string }[] } {
  const players: PlayerCard[] = team.players.map(p => ({ ...p }));
  const forced: { outId: string; inId: string }[] = [];
  const avail = (p: PlayerCard) => isAvailable(m, team.id, p.id);
  const fits = (p: PlayerCard, pos: string) => p.position === pos || (p.secondaryPositions?.includes(pos) ?? false);

  for (let i = 0; i < 11 && i < players.length; i++) {
    const starter = players[i];
    if (!starter || avail(starter)) continue;
    const wantGK = starter.position === 'GK';
    const bench = players.slice(11).filter(p => avail(p));
    let pick: PlayerCard | undefined = wantGK
      ? bench.filter(p => p.position === 'GK').sort((a, b) => b.overall - a.overall)[0]
      : (bench.filter(p => fits(p, starter.position)).sort((a, b) => b.overall - a.overall)[0]
         ?? bench.slice().sort((a, b) => b.overall - a.overall)[0]);
    if (!pick && wantGK) {
      // sem GK reserva → melhor jogador de linha disponível vai pro gol (OOP)
      pick = bench.slice().sort((a, b) => b.overall - a.overall)[0];
      if (pick) pick.isOOP = true;
    }
    if (!pick) continue; // banco esgotado (raro) — deixa como está
    const bi = players.indexOf(pick);
    [players[i], players[bi]] = [players[bi], players[i]];
    forced.push({ outId: starter.id, inId: pick.id });
  }

  let resolved: Team = rebuildTeamChemistry({ ...team, players });
  // re-seleciona capitão/batedores se saíram do XI
  const xiIds = new Set(resolved.players.slice(0, 11).map(p => p.id));
  const bestBy = (key: 'overall' | 'composure' | 'shooting'): string | undefined =>
    resolved.players.slice(0, 11).filter(p => p.position !== 'GK' || key === 'overall')
      .slice().sort((a, b) => ((b[key] as number) ?? 0) - ((a[key] as number) ?? 0))[0]?.id ?? undefined;
  if (resolved.captain && !xiIds.has(resolved.captain)) resolved = { ...resolved, captain: bestBy('overall') };
  if (resolved.penaltyTaker && !xiIds.has(resolved.penaltyTaker)) resolved = { ...resolved, penaltyTaker: bestBy('composure') };
  if (resolved.freeKickTaker && !xiIds.has(resolved.freeKickTaker)) resolved = { ...resolved, freeKickTaker: bestBy('shooting') };
  return { team: resolved, forced };
}
