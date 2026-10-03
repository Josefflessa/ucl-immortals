// Bot teams, chemistry rebuilds and the end-of-campaign report.

import { Player, PLAYERS, COACHES, FORMATIONS, HISTORICAL_TRIOS } from '../gameData';
import { rollPlayerTraits } from '../traits';
import { ALL_CRESTS, BOT_CREST_MAP, crestIdForClub, sameClub } from '../crests';
import { random } from '../random';
import { type PlayerCard, type Team, type MatchResult } from './teamModel';
import { calculateChemistry } from './chemistry';
import { formationProfile } from './matchSim';
import { applyShopVariant } from './draft';

// ============================================================
// BOT TEAM GENERATOR
// ============================================================

// Bots pick a tactic COERENTE com a formação e a dificuldade (não fica sempre no 'balanced'):
// formações ofensivas puxam táticas de ataque, defensivas puxam retranca/contra-ataque, e um bot
// mais forte joga mais assertivo (posse/pressão) enquanto o mais fraco senta mais atrás. Sorteio
// PONDERADO — então continua variado, sem virar regra fixa. 'balanced' mantém um peso-base sólido.
function pickBotTactic(formationId: string, difficulty: number): string {
  const prof = formationProfile(formationId);
  const lean = prof.attack - prof.defense;   // >0 = formação ofensiva · <0 = formação defensiva
  const d = Math.max(0, Math.min(1, difficulty)); // 0.45 fácil … 0.97 difícil
  const up = Math.max(0, lean), down = Math.max(0, -lean);
  const creation = Math.max(0, prof.control);
  const lowCreation = Math.max(0, -prof.control);
  const weights: Record<string, number> = {
    balanced:       2.0,
    possession:     1.0 + up * 0.4 + creation * 0.7 + d * 1.2,
    counter:        1.0 + down * 0.4 + lowCreation * 0.4 + (1 - d) * 1.0,
    high_press:     0.8 + up * 0.3 + creation * 0.2 + d * 1.0,
    defensive:      0.8 + down * 0.6 + lowCreation * 0.5 + (1 - d) * 1.2,
    all_out_attack: 0.5 + up * 0.6 + d * 0.6,
  };
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = random() * total;
  for (const [style, v] of entries) { r -= v; if (r <= 0) return style; }
  return 'balanced';
}

// 🎚️ Perfil de dificuldade: um `botStrength` (0.45 bronze … 0.97 imortal) vira VÁRIOS botões que
// deixam o bot mais forte E mais inteligente por nível. Puro/testável. (ver spec dificuldade-multidimensional)
function difficultyProfile(strength: number) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // Os botStrength dos 5 níveis têm espaçamento DESIGUAL → uma fórmula linear neles dá passos desiguais.
  // Mapeia strength → "tier" 0..1 UNIFORME entre os níveis (0=Bronze … 1=Imortal) pra a dificuldade
  // subir em passos PARELHOS. Contínuo (o ref/bots com strength intermediário caem no meio).
  const PTS = [0.45, 0.62, 0.75, 0.88, 0.97];
  let t = strength <= PTS[0] ? 0 : 1;
  for (let i = 0; i < PTS.length - 1; i++) {
    if (strength <= PTS[i + 1]) { t = (i + clamp((strength - PTS[i]) / (PTS[i + 1] - PTS[i]), 0, 1)) / (PTS.length - 1); break; }
  }
  return {
    // Gradação PARELHA e num patamar moderado (nerfado). A química fica abaixo do 1º marco (45) até
    // o topo, então a dificuldade sobe suave pelo OVERALL (sem marcos); só o Imortal cruza o marco.
    center: 78 + t * 11,           // Bronze 78 · Prata ~80,8 · Ouro ~83,5 · Lendário ~86,3 · Imortal 89 (passos iguais)
    loSpread: 8 - t * 4,           // piso sobe mais rápido que o teto
    hiSpread: 6,
    chemBias: t * 0.32,            // baixa (abaixo do "engate" ~0.3) → química sobe suave, sem pulo
    smartCoachChance: t,
    variantChance: Math.max(0, (t - 0.2) * 0.26), // rampa GRADUAL e fraca (Prata ~0 · Ouro ~8% · Lendário ~14% · Imortal ~21%)
  };
}

// Escolha PONDERADA POR QUÍMICA: com chemBias>0, prefere candidatos conectados (mesmo clube ×2,
// mesma nação ×1) aos já escolhidos — é o que faz o bot montar um XI entrosado nos níveis altos.
function pickChemAware(cands: Player[], selected: Player[], chemBias: number): Player {
  if (chemBias <= 0 || selected.length === 0) return cands[Math.floor(random() * cands.length)];
  const conn = (p: Player) => selected.reduce((n, s) => n + (sameClub(s.club, p.club) ? 2 : 0) + (s.nation === p.nation ? 1 : 0), 0);
  const weights = cands.map(p => 1 + chemBias * conn(p) * 1.5);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

// The bot clubs of a competition, in draw order. The last ones are reserves for when human
// teams take some of the names/crests (see pickBotNames).
export const BOT_NAMES = [
  'Real Madrid', 'Manchester City', 'Bayern München', 'Paris Saint-Germain', 'Liverpool FC',
  'Inter de Milão', 'Arsenal FC', 'FC Barcelona', 'Borussia Dortmund', 'Juventus FC',
  'Atlético de Madrid', 'Bayer Leverkusen', 'AC Milan', 'Benfica Glorioso', 'Sporting CP',
  'FC Porto', 'Ajax Legends', 'PSV Eindhoven', 'Feyenoord Roterdã', 'Aston Villa',
  'Atalanta Bergamo', 'AS Monaco', 'Lille OSC', 'VfB Stuttgart', 'Bologna FC', 'Girona FC',
  'Celtic FC', 'Club Brugge', 'Shakhtar Donetsk', 'Dinamo Zagreb', 'RB Salzburg',
  'Sparta Praga', 'Young Boys Bern', 'Estrela Vermelha', 'Lazio Roma',
  'Real Betis', 'Dynamo Kyiv',
];

export interface HumanTeamIdentity {
  name: string;
  crestId?: string | null;
}

const identityKey = (value: string) => value
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The crest a bot of this name plays with. */
export function botCrestId(name: string): string | undefined {
  return BOT_CREST_MAP[name] ?? crestIdForClub(name) ?? undefined;
}

/**
 * Bot clubs for a competition: never the same name or crest as a human team. Falls back to
 * other clubs of the crest catalogue if the regular list runs out.
 */
export function pickBotNames(count: number, humans: HumanTeamIdentity[]): string[] {
  const takenNames = new Set(humans.map(h => identityKey(h.name)));
  const takenCrests = new Set(humans.map(h => h.crestId).filter((id): id is string => !!id));
  const free = (name: string, crestId: string | undefined) =>
    !takenNames.has(identityKey(name)) && !(crestId && takenCrests.has(crestId));
  const picked: string[] = [];
  const use = (name: string, crestId: string | undefined) => {
    if (picked.length >= count || !free(name, crestId)) return;
    picked.push(name);
    takenNames.add(identityKey(name));
    if (crestId) takenCrests.add(crestId);
  };
  for (const name of BOT_NAMES) use(name, botCrestId(name));
  for (const crest of ALL_CRESTS) use(crest.name, crest.id);
  return picked;
}

export function generateBotTeam(name: string, difficulty: number): Team {
  const prof = difficultyProfile(difficulty);
  const formation = FORMATIONS[Math.floor(random() * FORMATIONS.length)];
  // 🎩 Técnico: nos níveis altos, tende a escolher um que COMBINA com a formação (senão aleatório).
  let coach = COACHES[Math.floor(random() * COACHES.length)];
  if (random() < prof.smartCoachChance) {
    const fitting = COACHES.filter(c => c.preferredFormation === formation.id);
    if (fitting.length > 0) coach = fitting[Math.floor(random() * fitting.length)];
  }

  // Difficulty sets the OVERALL BAND the bot recruits from; WITHIN the band each slot
  // is filled at RANDOM. So two bots of the same difficulty field different XIs drawn
  // from the WHOLE 200+ pool — not the same handful of top names every time — while a
  // harder bot still recruits from a clearly higher band than an easier one.
  const lo = prof.center - prof.loSpread, hi = prof.center + prof.hiSpread;

  const selected: Player[] = [];
  const taken = (p: Player) => selected.some(s => s.id === p.id);
  const inBand = (p: Player) => p.overall >= lo && p.overall <= hi;
  // Never use a goalkeeper in an outfield slot, even when a legacy card has
  // an accidental secondary position that would otherwise make it eligible.
  const fits = (p: Player, role: string) => role === 'GK'
    ? p.position === 'GK'
    : p.position !== 'GK' && (p.position === role || (p.secondaryPositions?.includes(role) ?? false));
  const randOf = (arr: Player[]) => arr[Math.floor(random() * arr.length)];

  // Fill formation positions (11 titulares) — dentro da faixa, por posição, PONDERADO POR QUÍMICA.
  for (const pos of formation.positions) {
    let cands = PLAYERS.filter(p => !taken(p) && fits(p, pos.role) && inBand(p));
    if (cands.length < 4) cands = PLAYERS.filter(p => !taken(p) && fits(p, pos.role)); // widen if scarce for this role
    if (cands.length === 0) cands = PLAYERS.filter(p => !taken(p) && inBand(p) && p.position !== 'GK');
    if (cands.length > 0) selected.push(pickChemAware(cands, selected, prof.chemBias));
  }

  // Complete missing slots if formation matching failed.
  while (selected.length < 11) {
    let rem = PLAYERS.filter(p => !taken(p) && inBand(p) && p.position !== 'GK');
    if (rem.length === 0) rem = PLAYERS.filter(p => !taken(p));
    if (rem.length === 0) break;
    selected.push(pickChemAware(rem, selected, prof.chemBias));
  }

  // 🎖️ Características: nos níveis altos, alguns titulares ganham uma variante SEMPRE-BOA
  // (Em Alta +4 em tudo, ou Pilar +química) — antes de calcular a química e o banco.
  if (prof.variantChance > 0) {
    for (let i = 0; i < Math.min(11, selected.length); i++) {
      if (random() < prof.variantChance) {
        // Favorece Em Alta (boost liso de stats) sobre Pilar (+12 química, que pode cruzar marcos e criar degrau).
        selected[i] = applyShopVariant(selected[i], random() < 0.75 ? 'inForm' : 'pilar');
      }
    }
  }

  // 🪑 Banco: 7 reservas da mesma faixa, GARANTINDO 1 goleiro reserva (p/ cobrir lesão/suspensão do GK).
  const bench: Player[] = [];
  const takenAll = (p: Player) => taken(p) || bench.some(b => b.id === p.id);
  let gkCands = PLAYERS.filter(p => !takenAll(p) && p.position === 'GK' && inBand(p));
  if (gkCands.length === 0) gkCands = PLAYERS.filter(p => !takenAll(p) && p.position === 'GK');
  if (gkCands.length > 0) bench.push(randOf(gkCands));
  while (bench.length < 7) {
    let rem = PLAYERS.filter(p => !takenAll(p) && inBand(p) && p.position !== 'GK');
    if (rem.length === 0) rem = PLAYERS.filter(p => !takenAll(p) && p.position !== 'GK');
    if (rem.length === 0) break;
    bench.push(randOf(rem));
  }
  const starters = selected.slice(0, 11); // química/forma só sobre os titulares
  selected.push(...bench);

  const formationRoles = formation.positions.map(p => p.role);
  const chemData = calculateChemistry(starters, coach.id, formationRoles, formation.id);

  const playerCards: PlayerCard[] = selected.map(p => ({
    ...p,
    traits: rollPlayerTraits(p.position, p.rarity), // random traits, like every card
    chemistryScore: chemData.individual[p.id] ?? 1,
    isOOP: chemData.outOfPosition[p.id] ?? false,
    isSecondary: chemData.secondaryPos[p.id] ?? false,
  }));

  return {
    id: `bot_${name.toLowerCase().replace(/\s/g, '_')}`,
    name,
    coachId: coach.id,
    formationId: formation.id,
    playStyle: pickBotTactic(formation.id, difficulty),
    players: playerCards,
    totalChemistry: chemData.total,
    isBot: true,
    botStrength: difficulty,
    crestId: botCrestId(name),
  };
}

// ============================================================
// IMMORTAL REPORT
// ============================================================
export interface ImmortalReport {
  champion: string;
  topScorer: { name: string; goals: number };
  bestMatch: string;
  mvpFinal: string;
  biggestDuel: string;
  chemistryHighlight: string;
  historicalRecreations: string[];
  totalGoals: number;
}

export function rebuildTeamChemistry(team: Team): Team {
  const formation = FORMATIONS.find(f => f.id === team.formationId);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const starters = team.players.slice(0, 11);
  const chemData = calculateChemistry(starters, team.coachId, formationRoles, team.formationId);

  const updatedPlayers = team.players.map(p => ({
    ...p,
    chemistryScore: chemData.individual[p.id] ?? 1,
    isOOP: chemData.outOfPosition[p.id] ?? false,
    isSecondary: chemData.secondaryPos[p.id] ?? false,
  }));

  return {
    ...team,
    players: updatedPlayers,
    totalChemistry: chemData.total,
  };
}

export function generateImmortalReport(
  playerTeam: Team,
  allResults: MatchResult[],
  champion: string,
): ImmortalReport {
  const playerResults = allResults.filter(
    r => r.homeTeamId === playerTeam.id || r.awayTeamId === playerTeam.id
  );

  // Count goals per player
  const goalCount: Record<string, number> = {};
  for (const result of playerResults) {
    for (const event of result.events) {
      if (event.type === 'goal' && event.teamId === playerTeam.id && event.playerId) {
        goalCount[event.playerId] = (goalCount[event.playerId] || 0) + 1;
      }
    }
  }

  const topScorerEntry = Object.entries(goalCount).sort((a, b) => b[1] - a[1])[0];
  const topScorer = topScorerEntry
    ? { name: playerTeam.players.find(p => p.id === topScorerEntry[0])?.shortName ?? 'Desconhecido', goals: topScorerEntry[1] }
    : { name: 'Nenhum', goals: 0 };

  // Best match (most goals)
  const bestResult = playerResults.sort((a, b) => {
    const totalA = a.homeGoals + a.awayGoals;
    const totalB = b.homeGoals + b.awayGoals;
    return totalB - totalA;
  })[0];

  const bestMatch = bestResult
    ? `${bestResult.homeGoals}-${bestResult.awayGoals}`
    : '0-0';

  // Chemistry highlights
  const chemData = calculateChemistry(playerTeam.players.slice(0, 11), playerTeam.coachId);
  const activeTrios = chemData.trios.map(trioId => {
    const trio = HISTORICAL_TRIOS.find(t => t.id === trioId);
    return trio?.name ?? trioId;
  });

  const totalGoals = playerResults.reduce((sum, r) => {
    return sum + (r.homeTeamId === playerTeam.id ? r.homeGoals : r.awayGoals);
  }, 0);

  return {
    champion,
    topScorer,
    bestMatch,
    mvpFinal: playerTeam.players[Math.floor(random() * Math.min(5, playerTeam.players.length))]?.shortName ?? 'Desconhecido',
    biggestDuel: 'Duelo épico da campanha',
    chemistryHighlight: chemData.total >= 90 ? 'Química Perfeita!' : chemData.total >= 60 ? 'Química Excelente' : 'Química Boa',
    historicalRecreations: activeTrios,
    totalGoals,
  };
}
