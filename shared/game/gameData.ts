// UCL Immortals — Game Data
// Types, coaches, formations, tactics and historical trios (the cards live in ./players)

import type { AttrKey } from './traits';

export type Rarity = 'bronze' | 'silver' | 'gold' | 'legendary' | 'immortal' | 'unique';
type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';
// Visual/progression level for standard cards. Unique cards intentionally do
// not participate in the evolution track.
export type EvolutionLevel = 0 | 1 | 2 | 3 | 4;
export type PlayerSpecialization = 'finalizador' | 'maestro' | 'motor' | 'muralha';

// Level 4 is an Immortal-only specialization. The texture is intentionally
// independent from rarity: rarity continues to be shown by the card frame and
// ribbon, while this texture identifies the chosen specialization.
export const PLAYER_SPECIALIZATIONS = {
  finalizador: {
    label: 'FINALIZADOR', icon: '🎯', color: '#F97316', texture: '/cards/especializacoes/finalizador.webp',
    attributes: ['shooting', 'composure'] as const,
    attributeLabel: 'Finalização e compostura',
  },
  maestro: {
    label: 'MAESTRO', icon: '🎼', color: '#8B5CF6', texture: '/cards/especializacoes/maestro.webp',
    attributes: ['passing', 'vision'] as const,
    attributeLabel: 'Passe e visão',
  },
  motor: {
    label: 'MOTOR', icon: '⚡', color: '#22C55E', texture: '/cards/especializacoes/motor.webp',
    attributes: ['pace', 'dribbling'] as const,
    attributeLabel: 'Ritmo e drible',
  },
  muralha: {
    label: 'MURALHA', icon: '🛡️', color: '#E2E8F0', texture: '/cards/especializacoes/muralha.webp',
    attributes: ['defending', 'physical'] as const,
    attributeLabel: 'Defesa e físico',
  },
} as const satisfies Record<PlayerSpecialization, {
  label: string;
  icon: string;
  color: string;
  texture: string;
  attributes: readonly string[];
  attributeLabel: string;
}>;

export interface Player {
  id: string;
  // Stable footballer identity shared by premium variants (for duplicate/identity
  // handling). Historical chemistry can override it with historicalPlayerId when
  // a card represents a different club/era.
  basePlayerId?: string;
  // Exact club/era identity used by historical partners and trios. Defaults to
  // basePlayerId, then id, so older cards keep their existing behavior.
  historicalPlayerId?: string;
  shortName: string;
  fullName: string;
  photoUrl?: string;
  position: string;
  secondaryPositions?: string[];
  nation: string;
  // Human-readable label kept for cards/UI. Use clubId for chemistry, filters
  // and any logic that compares clubs.
  club: string;
  clubId?: string;
  season: string;
  rarity: Rarity;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  composure: number;
  vision: number;
  traits: string[];
  historicalCoaches?: string[];
  historicalPartners?: string[];
  // Draft-time variants (never present on the base PLAYERS pool — only on cloned
  // cards produced during the draft). See gameEngine.applyDraftVariant.
  rolledTrait?: string; // extra "wildcard" trait granted randomly in the draft
  inForm?: boolean;     // rare boosted "in-form" special card
  baseOverall?: number; // original overall before the in-form / lobo boost (shown in details)
  // Special draft variants (rolled at draft time, mutually exclusive — see gameEngine.applyDraftVariant):
  lobo?: boolean;       // 🐺 Lobo Solitário — big personal boost, but drains TEAM chemistry
  coringa?: boolean;    // 🃏 Coringa — immune to the out-of-position penalty (stats & chemistry)
  nomade?: boolean;     // 🌍 Nômade — counts as ANY nation for chemistry links
  pilar?: boolean;      // 🧱 Pilar — lifts the whole team's chemistry just by being in the XI
  // ── Team-effect characteristics (buff OTHER players — see gameEngine.computeCharacteristicBoosts) ──
  martir?: boolean;     // 🩸 Mártir — −6 em tudo nele; dá +5 em tudo a 2 titulares escolhidos (acumulável)
  martirTargets?: string[]; // ids dos (até 2) titulares que recebem o +5 do Mártir; vazio → 2 maiores overalls
  idolo?: boolean;      // ❤️ Ídolo — +2 em tudo a cada OUTRO titular do mesmo clube (não a ele)
  decimoHomem?: boolean; // 🪑 12º Homem — no banco, +1 em todos os atributos a todo o XI
  pipoqueiro?: boolean;  // 🍿 Pipoqueiro — +7 em tudo na FASE DE LIGA, −7 em tudo no MATA-MATA (o anti-Pilar: some no jogo grande)
  noe?: boolean;         // 🛟 Noé — só quando é o ÚNICO titular do XI com característica: +20 em tudo NELE + 50 na química geral
  forasteiro?: boolean;  // 🧳 Forasteiro — +8 em tudo quando é o ÚNICO titular do seu país E do seu clube (anti-química)
  colecionador?: boolean; // 🧩 Colecionador — +1 em tudo por jogador que estiver na reserva
  estribado?: boolean;    // 💰 Estribado — +1 em tudo a cada 100 créditos disponíveis
  todosPorUm?: boolean;   // 🤝 Todos por um — com os 11 titulares, +20 em tudo e +50 de química geral
  capitaoNato?: boolean; // 🗣️ Capitão Nato — se for o CAPITÃO do time, o bônus de capitão vem DOBRADO
  magnata?: boolean;     // 🤑 Magnata — titular multiplica os créditos da partida por 1,5, mas −7 em tudo nele
  fragil?: boolean;      // 🩹 Frágil — +7 em tudo, mas aumenta drasticamente o risco de lesão
  prodigio?: boolean;    // 📈 Prodígio — +1 em todos os atributos a cada titularidade acumulada
  prodigioStarts?: number; // 📈 titularidades acumuladas desde que a característica foi recebida
  resiliente?: boolean;  // 🔥 Resiliente — cresce após cada derrota do time em que estiver no XI
  resilienteDefeats?: number; // 🔥 derrotas do time contabilizadas enquanto foi titular
  medicalReturnBoost?: number; // 🏥 bônus permanente acumulado por retornos de lesão
  goleador?: boolean;    // ⚽ Goleador — +1 em tudo a cada 3 gols marcados
  goleadorGoals?: number; // ⚽ gols acumulados desde que recebeu a característica
  goleadorMatchIds?: string[]; // ⚽ partidas já contabilizadas (idempotência online/reconexão)
  garcom?: boolean;      // 🎯 Garçom — +1 em tudo a cada 2 assistências dadas
  garcomAssists?: number; // 🎯 assistências acumuladas desde que recebeu a característica
  garcomMatchIds?: string[]; // 🎯 partidas já contabilizadas (idempotência online/reconexão)
  arrogante?: boolean;   // 👑 Arrogante — +2 em tudo por gol; −1 nos outros titulares a cada 2 gols
  arroganteGoals?: number; // 👑 gols acumulados desde que recebeu a característica
  arroganteMatchIds?: string[]; // 👑 partidas já contabilizadas (idempotência online/reconexão)
  mercenario?: boolean;  // 🏆 Conquistador — +2 em tudo por missão concluída
  mercenarioMissions?: number; // 🏆 missões concluídas contabilizadas enquanto a carta carrega a característica
  padrinho?: boolean;    // 🤵 Padrinho — o afilhado (titular escolhido) ganha +3 em tudo; +1 permanente nele por gol do afilhado
  padrinhoTarget?: string; // 🤵 id do afilhado; vazio → o titular de maior overall além dele
  padrinhoGoals?: number; // 🤵 gols do afilhado contabilizados com os dois titulares
  padrinhoMatchIds?: string[]; // 🤵 partidas já contabilizadas (idempotência online/reconexão)
  lapidador?: boolean;   // 💎 Lapidador — a cada vitória como titular, todos os reservas ganham +1 permanente em tudo
  lapidadorMatchIds?: string[]; // 💎 partidas já contabilizadas (idempotência online/reconexão)
  lapidadoBoost?: number; // 💎 bônus permanente recebido de Lapidadores enquanto estava na reserva (fica com a carta)
  trainCount?: number;  // 💪 how many times this player was trained in the shop (escalates the next cost)
  // 💪 Shop "Treino" — a permanent, stacking per-attribute boost (no cap; flows through the
  // engine and the effective-overall like any other buff, and is shown in the player modal).
  trainBoosts?: {
    pace?: number; shooting?: number; passing?: number; dribbling?: number;
    defending?: number; physical?: number; vision?: number; composure?: number;
  };
  // ⭐ Evolução cumulativa: 4/8/12 titularidades desbloqueiam os níveis 1/2/3.
  // Cartas Imortais chegam ao nível 4 com um desbloqueio único de créditos
  // depois do nível 3 e escolhem uma especialização; os níveis 1–3 continuam
  // liberando pacotes de 6 pontos.
  appearances?: number;
  // Explicit evolution level for previews. Level-4 unlocks are persisted
  // through specializationUnlocked below.
  evolutionLevel?: EvolutionLevel;
  // ⭐ Desbloqueio pago do nível 4 (exclusivo de cartas Imortais; uma vez só).
  specializationUnlocked?: boolean;
  // ⭐ Especialização do nível 4 (exclusiva de cartas Imortais; pode ser trocada sem custo).
  specialization?: PlayerSpecialization;
  // Identificadores das partidas/pernas que já concederam uma titularidade.
  // Mantido na carta para que uma repetição do mesmo evento nunca conte duas vezes,
  // inclusive depois de reconexão ou reenvio da ação no online.
  appearanceMatchIds?: string[];
  evolvePoints?: {
    pace?: number; shooting?: number; passing?: number; dribbling?: number;
    defending?: number; physical?: number; vision?: number; composure?: number;
  };
  // Atributo que recebe automaticamente os próximos pacotes de 6 pontos ao
  // desbloquear os níveis 1–3. Pontos já liberados continuam manuais.
  autoEvolveAttribute?: AttrKey;
}

export interface CoachBonus {
  phase: string;
  attribute: string;
  value: number;
}

export interface Coach {
  id: string;
  name: string;
  philosophy: string;
  description: string;
  effect: string;
  specialAbilityName: string;
  specialAbility: string;
  preferredFormation: string;
  bonuses: CoachBonus[];
  photoUrl?: string;
}

export interface FormationPosition {
  role: string;
  x: number; // 0-100 (left to right)
  y: number; // 0-100 (top = attack, bottom = defense)
}

export interface Formation {
  id: string;
  name: string;
  positions: FormationPosition[];
  strengths: string[];
  weaknesses: string[];
  counters: string[];
  counteredBy: string[];
}

interface HistoricalTrio {
  id: string;
  name: string;
  description: string;
  playerIds: string[];
  chemBonus: number;
}

interface DifficultyLevel {
  id: string;
  name: string;
  description: string;
  botStrength: number;
}

// ============================================================
// HELPERS
// ============================================================
export function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'unique': return '#F0E6C0';
    case 'immortal': return '#FFD700';
    case 'legendary': return '#FF8C00';
    case 'gold': return '#C9A84C';
    case 'silver': return '#A8A8B8';
    case 'bronze': return '#CD7F32';
  }
}

export function getPositionGroup(position: string): PositionGroup {
  if (position === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return 'MID';
  return 'ATT';
}

export const POSITION_GROUPS: Record<PositionGroup, string[]> = {
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MID: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  ATT: ['ST', 'LW', 'RW'],
};

export const POS_PT: Record<string, string> = {
  GK: 'GL', CB: 'ZAG', LB: 'LE', RB: 'LD',
  LWB: 'AE', RWB: 'AD', CDM: 'VOL', CM: 'MC',
  CAM: 'MEI', LM: 'ME', RM: 'MD',
  LW: 'PE', RW: 'PD', ST: 'CA',
};

// Secundárias PADRÃO por posição nativa (vizinhança realista). `secondaryPositions` explícito vence.
const SECONDARY_ADJACENCY: Record<string, string[]> = {
  GK: [], CB: ['CDM'], LB: ['LWB', 'LM'], RB: ['RWB', 'RM'],
  LWB: ['LB', 'LM'], RWB: ['RB', 'RM'], CDM: ['CM', 'CB'], CM: ['CDM', 'CAM'],
  CAM: ['CM'], LM: ['LW', 'LWB'], RM: ['RW', 'RWB'],
  LW: ['LM'], RW: ['RM'], ST: [],
};
export function effectiveSecondaries(p: { position: string; secondaryPositions?: string[] }): string[] {
  const primary = p.position;
  const configured = p.secondaryPositions ?? SECONDARY_ADJACENCY[primary] ?? [];
  return Array.from(new Set(configured)).filter(position => position !== primary);
}

// ============================================================
// TACTICS (PLAY STYLE)
// ============================================================
// The `id` MUST match the playStyle strings the engine reads in
// gameEngine.getEffectiveAttribute / matchNarrative.selectApproach.
// Changing an id here without updating the engine silently disables the bonus.
interface Tactic {
  id: string;
  name: string;
  icon: string;
  short: string; // one-line attribute effect, kept in sync with the engine
  desc: string;
}

export const TACTICS: Tactic[] = [
  { id: 'balanced',       name: 'Equilibrado',     icon: '⚖️', short: '+2 nos atributos principais', desc: 'Postura neutra e segura, sem uma fraqueza tática dominante.' },
  { id: 'possession',     name: 'Posse de Bola',   icon: '🎯', short: '+Passe/Visão/Drible · domina o meio', desc: 'Domina a bola e cria com paciência. Aumenta o volume de sequências e usa o meio-campo para construir melhor as jogadas — mas pode ter dificuldade contra blocos baixos.' },
  { id: 'counter',        name: 'Contra-ataque',   icon: '⚡', short: '+Ritmo/Finalização · sai rápido', desc: 'Defende firme e explode na velocidade. Cria menos sequências, mas aumenta o perigo de cada saída rápida. Ótima como azarão.' },
  { id: 'high_press',     name: 'Pressão Alta',    icon: '🔥', short: '+Físico/Defesa/Ritmo · intenso', desc: 'Sufoca a saída de bola lá na frente. Recupera a bola com frequência e cria jogadas perigosas, mas deixa espaço nas costas.' },
  { id: 'defensive',      name: 'Defensivo',       icon: '🛡️', short: '+Defesa/Físico · bloco baixo', desc: 'Fecha os espaços e segura o resultado. No bloco baixo, sofre menos, mas cria pouco — a escolha clássica de quem quer controlar o jogo.' },
  { id: 'all_out_attack', name: 'Tudo pro Ataque', icon: '⚔️', short: '+Finalização/Ritmo/Drible · arriscado', desc: 'Joga com tudo no ataque. Torna as chances muito mais perigosas, mas fica aberto atrás e sofre bem mais. Para quando você precisa do gol.' },
];

export function getTacticById(id: string | undefined): Tactic {
  return TACTICS.find(t => t.id === id) ?? TACTICS[0];
}

// ============================================================
// DIFFICULTY LEVELS
// ============================================================
export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    description: 'Ideal para aprender as mecânicas. Times da IA usam jogadores medianos.',
    botStrength: 0.45,
  },
  {
    id: 'silver',
    name: 'Prata',
    description: 'Desafio moderado. Times equilibrados com alguns destaques.',
    botStrength: 0.62,
  },
  {
    id: 'gold',
    name: 'Ouro',
    description: 'Experiência autêntica da Champions League. Times competitivos.',
    botStrength: 0.75,
  },
  {
    id: 'legendary',
    name: 'Lendário',
    description: 'Os melhores times históricos. Apenas para os mais experientes.',
    botStrength: 0.88,
  },
  {
    id: 'immortal',
    name: 'Imortal',
    description: 'Modo extremo. Times perfeitos com química máxima. Quase impossível.',
    botStrength: 0.97,
  },
];

// ============================================================
// COACHES
// ============================================================
export const COACHES: Coach[] = [
  {
    id: 'guardiola',
    name: 'Pep Guardiola',
    philosophy: 'Posse e Pressão Alta',
    description: 'Mestre do tiki-taka e da posse de bola. Transforma times comuns em máquinas de futebol.',
    effect: '+5 Passe e Visão para os meio-campistas. +2 Passe para todo o elenco.',
    specialAbilityName: 'Visão de Jogo',
    specialAbility: 'Jogadores com Visão ≥ 80 ganham +3 em todos os atributos.',
    preferredFormation: '4-3-3',
    bonuses: [
      { phase: 'Todos', attribute: 'passing', value: 2 },
    ],
    photoUrl: '/coaches/guardiola.jpg',
  },
  {
    id: 'klopp',
    name: 'Jürgen Klopp',
    philosophy: 'Gegenpressing e Intensidade',
    description: 'Futebol de alta intensidade e pressão implacável. Cria times com coração de leão.',
    effect: '+6 Físico e +4 Ritmo para todo o elenco. +4 Defesa na marcação.',
    specialAbilityName: 'Pressão Máxima',
    specialAbility: 'Quando perdendo, todos os jogadores ganham +8 em todos os atributos.',
    preferredFormation: '4-3-3',
    bonuses: [
      { phase: 'Todos', attribute: 'physical', value: 6 },
      { phase: 'Todos', attribute: 'pace', value: 4 },
      { phase: 'Defesa', attribute: 'defending', value: 4 },
    ],
    photoUrl: '/coaches/klopp.jpg',
  },
  {
    id: 'mourinho',
    name: 'José Mourinho',
    philosophy: 'Organização Defensiva',
    description: 'O Special One. Mestre da organização tática e de vencer jogos difíceis.',
    effect: '+8 Defesa e +5 Físico na marcação. O goleiro ganha +5 em Defesa.',
    specialAbilityName: 'Fortaleza',
    specialAbility: 'No mata-mata, todos os defensores ganham +6 em Defesa.',
    preferredFormation: '4-2-3-1',
    bonuses: [
      { phase: 'Defesa', attribute: 'defending', value: 8 },
      { phase: 'Defesa', attribute: 'physical', value: 5 },
    ],
    photoUrl: '/coaches/mourinho.jpg',
  },
  {
    id: 'ancelotti',
    name: 'Carlo Ancelotti',
    philosophy: 'Equilíbrio e Gestão',
    description: 'O treinador mais campeão da Champions League. Equilibra ataque e defesa com maestria.',
    effect: '+2 em todos os atributos para o elenco. Craques (Overall ≥ 85) ganham +4 a mais.',
    specialAbilityName: 'Maestro da Final',
    specialAbility: 'Na final, todos os jogadores ganham +6 em todos os atributos.',
    preferredFormation: '4-4-2',
    bonuses: [
      { phase: 'Todos', attribute: 'all', value: 2 },
    ],
    photoUrl: '/coaches/ancelotti.jpg',
  },
  {
    id: 'zidane',
    name: 'Zinedine Zidane',
    philosophy: 'Gestão de Estrelas',
    description: 'Ganhou 3 Champions seguidas. Sabe como motivar os maiores craques do mundo.',
    effect: '+2 em todos os atributos. Lendários e Imortais ganham +4 (total).',
    specialAbilityName: 'Rei do Mata-Mata',
    specialAbility: 'O bônus dos Lendários/Imortais sobe para +6 no mata-mata e na final.',
    preferredFormation: '4-3-3',
    bonuses: [
      { phase: 'Todos', attribute: 'all', value: 2 },
    ],
    photoUrl: '/coaches/zidane.jpg',
  },
  {
    id: 'ferguson',
    name: 'Sir Alex Ferguson',
    philosophy: 'Mentalidade Vencedora',
    description: 'A lenda de Old Trafford. Nunca desiste. Seus times sempre acreditam na virada.',
    effect: '+5 Físico e +3 Passe para todos, e +5 na Finalização.',
    specialAbilityName: 'Fergie Time',
    specialAbility: 'Quando perdendo, todos os jogadores ganham +10 em todos os atributos.',
    preferredFormation: '4-4-2',
    bonuses: [
      { phase: 'Todos', attribute: 'physical', value: 5 },
      { phase: 'Todos', attribute: 'passing', value: 3 },
      { phase: 'Finalização', attribute: 'shooting', value: 5 },
    ],
    photoUrl: '/coaches/ferguson.jpg',
  },
  {
    id: 'luis_enrique',
    name: 'Luis Enrique',
    philosophy: 'Posse, Pressão e Verticalidade',
    description: 'Um futebol intenso e técnico, que combina circulação de bola com aceleração imediata no ataque.',
    effect: '+3 em todos os atributos. Meio-campistas e atacantes recebem bônus na construção vertical.',
    specialAbilityName: 'Transição Vertical',
    specialAbility: 'Meio-campistas ganham +3 Visão e atacantes +2 Ritmo e +2 Drible.',
    preferredFormation: '4-3-3',
    bonuses: [
      { phase: 'Todos', attribute: 'all', value: 3 },
    ],
    photoUrl: '/coaches/luis-enrique.jpg',
  },
];

// ============================================================
// FORMATIONS
// ============================================================
// `counteredBy` é DERIVADO de `counters` (logo abaixo) pra nunca dessincronizar: se A "vence" B,
// então B automaticamente tem A na sua desvantagem. A fonte da verdade é só `counters`.
const FORMATIONS_BASE: Omit<Formation, 'counteredBy'>[] = [
  {
    id: '4-3-3',
    name: '4-3-3',
    positions: [
      { role: 'GK', x: 50, y: 92 },
      { role: 'LB', x: 15, y: 75 },
      { role: 'CB', x: 38, y: 78 },
      { role: 'CB', x: 62, y: 78 },
      { role: 'RB', x: 85, y: 75 },
      { role: 'CM', x: 25, y: 55 },
      { role: 'CDM', x: 50, y: 60 },
      { role: 'CM', x: 75, y: 55 },
      { role: 'LW', x: 15, y: 25 },
      { role: 'ST', x: 50, y: 15 },
      { role: 'RW', x: 85, y: 25 },
    ],
    strengths: ['Cria volume pelos lados', 'Três atacantes ameaçam a última linha', 'Equilíbrio entre defesa e ataque'],
    weaknesses: ['Pode deixar espaço nas transições', 'Laterais precisam recompor'],
    counters: ['4-4-2', '3-5-2'],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    positions: [
      { role: 'GK', x: 50, y: 92 },
      { role: 'LB', x: 15, y: 75 },
      { role: 'CB', x: 38, y: 78 },
      { role: 'CB', x: 62, y: 78 },
      { role: 'RB', x: 85, y: 75 },
      { role: 'CDM', x: 35, y: 60 },
      { role: 'CDM', x: 65, y: 60 },
      { role: 'LM', x: 18, y: 38 },
      { role: 'CAM', x: 50, y: 35 },
      { role: 'RM', x: 82, y: 38 },
      { role: 'ST', x: 50, y: 15 },
    ],
    strengths: ['Controle com duplo volante', 'Proteção central consistente', 'Meia entrelinhas para conectar o ataque'],
    weaknesses: ['Menos presença direta na área', 'Depende da criação do CAM'],
    counters: ['4-3-3', '4-4-2'],
  },
  {
    id: '4-4-2',
    name: '4-4-2',
    positions: [
      { role: 'GK', x: 50, y: 92 },
      { role: 'LB', x: 15, y: 75 },
      { role: 'CB', x: 38, y: 78 },
      { role: 'CB', x: 62, y: 78 },
      { role: 'RB', x: 85, y: 75 },
      { role: 'LM', x: 15, y: 52 },
      { role: 'CM', x: 38, y: 55 },
      { role: 'CM', x: 62, y: 55 },
      { role: 'RM', x: 85, y: 52 },
      { role: 'ST', x: 35, y: 18 },
      { role: 'ST', x: 65, y: 18 },
    ],
    strengths: ['Estrutura simples e equilibrada', 'Duas referências na área', 'Fácil de entender'],
    weaknesses: ['Pode perder superioridade central', 'Pouca criação entrelinhas'],
    counters: ['3-5-2', '5-3-2'],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    positions: [
      { role: 'GK', x: 50, y: 92 },
      { role: 'CB', x: 25, y: 78 },
      { role: 'CB', x: 50, y: 80 },
      { role: 'CB', x: 75, y: 78 },
      { role: 'LM', x: 10, y: 52 },
      { role: 'CM', x: 30, y: 50 },
      { role: 'CDM', x: 50, y: 58 },
      { role: 'CM', x: 70, y: 50 },
      { role: 'RM', x: 90, y: 52 },
      { role: 'ST', x: 35, y: 18 },
      { role: 'ST', x: 65, y: 18 },
    ],
    strengths: ['Maior volume de criação pelo meio', 'Duas referências ofensivas', 'Largura pelos alas'],
    weaknesses: ['Corredores dependem da recomposição dos alas', 'Exige zagueiros bons no 1x1'],
    counters: ['4-4-2', '4-2-3-1'],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    positions: [
      { role: 'GK', x: 50, y: 92 },
      { role: 'CB', x: 25, y: 78 },
      { role: 'CB', x: 50, y: 80 },
      { role: 'CB', x: 75, y: 78 },
      { role: 'LM', x: 12, y: 52 },
      { role: 'CM', x: 38, y: 55 },
      { role: 'CM', x: 62, y: 55 },
      { role: 'RM', x: 88, y: 52 },
      { role: 'LW', x: 15, y: 22 },
      { role: 'ST', x: 50, y: 12 },
      { role: 'RW', x: 85, y: 22 },
    ],
    strengths: ['Chances mais perigosas', 'Pressão ofensiva com 3 atacantes', 'Largura total'],
    weaknesses: ['Concede chances perigosas', 'Exige recomposição dos alas'],
    counters: ['4-2-3-1', '5-3-2'],
  },
  {
    id: '5-3-2',
    name: '5-3-2',
    positions: [
      { role: 'GK', x: 50, y: 92 },
      { role: 'LB', x: 10, y: 72 },
      { role: 'CB', x: 30, y: 78 },
      { role: 'CB', x: 50, y: 80 },
      { role: 'CB', x: 70, y: 78 },
      { role: 'RB', x: 90, y: 72 },
      { role: 'CM', x: 25, y: 52 },
      { role: 'CDM', x: 50, y: 58 },
      { role: 'CM', x: 75, y: 52 },
      { role: 'ST', x: 35, y: 18 },
      { role: 'ST', x: 65, y: 18 },
    ],
    strengths: ['Reduz o perigo adversário', 'Proteção forte da área', 'Difícil de superar'],
    weaknesses: ['Menor volume de criação', 'Pouca presença entrelinhas'],
    counters: ['4-3-3', '3-4-3'],
  },
];

// FORMATIONS público: cada formação com `counteredBy` DERIVADO — quem tem esta formação em
// `counters` automaticamente entra na desvantagem dela. Impossível dessincronizar.
export const FORMATIONS: Formation[] = FORMATIONS_BASE.map(f => ({
  ...f,
  counteredBy: FORMATIONS_BASE.filter(o => o.counters.includes(f.id)).map(o => o.id),
}));

// ============================================================
// HISTORICAL TRIOS
// ============================================================
export const HISTORICAL_TRIOS: HistoricalTrio[] = [
  {
    id: 'msi',
    name: 'MSN — Barcelona 2014/15',
    description: 'Messi, Suárez e Neymar — o trio mais letal da história do futebol.',
    playerIds: ['messi', 'suarez', 'neymar'],
    chemBonus: 15,
  },
  {
    id: 'bbc',
    name: 'BBC — Real Madrid 2013/14',
    description: 'Bale, Benzema e Cristiano — a trindade do Real Madrid campeão.',
    playerIds: ['cristiano', 'benzema', 'bale'],
    chemBonus: 12,
  },
  {
    id: 'xavi_iniesta_busquets',
    name: 'Triângulo Mágico — Barcelona',
    description: 'Xavi, Iniesta e Busquets — o meio-campo mais dominante da história.',
    playerIds: ['xavi', 'iniesta', 'busquets'],
    chemBonus: 14,
  },
  {
    id: 'lampard_gerrard_scholes',
    name: 'Meio-Campo Inglês',
    description: 'Lampard, Gerrard e Scholes — os três maiores meias ingleses de uma geração.',
    playerIds: ['lampard', 'gerrard', 'scholes'],
    chemBonus: 10,
  },
  {
    id: 'henry_pires_bergkamp',
    name: 'Arsenal Invencível',
    description: 'Henry, Pirès e Bergkamp — o ataque do Arsenal Invencível.',
    playerIds: ['henry', 'pires', 'bergkamp'],
    chemBonus: 11,
  },
  {
    id: 'maldini_nesta_cannavaro',
    name: 'Muralha Italiana',
    description: 'Maldini, Nesta e Cannavaro — a defesa mais sólida da história.',
    playerIds: ['maldini', 'nesta', 'cannavaro'],
    chemBonus: 13,
  },
  {
    id: 'kaka_pirlo_seedorf',
    name: 'Meio-Campo Milan',
    description: 'Kaká, Pirlo e Seedorf — a elegância e técnica do Milan campeão.',
    playerIds: ['kaka_milan', 'pirlo', 'seedorf'],
    chemBonus: 12,
  },
  {
    id: 'ribery_robben',
    name: 'Dupla Bávara',
    description: 'Ribéry e Robben — os dois alas mais temidos do Bayern Munich.',
    playerIds: ['ribery', 'robben'],
    chemBonus: 8,
  },
];

// ============================================================
// PLAYERS DATABASE — see players/index.ts (and `pnpm catalog` to search it)
// ============================================================
export { PLAYERS, UNIQUE_CARDS, PLAYER_SOURCES } from './players';
