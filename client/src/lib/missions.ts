// UCL Immortals — Mission board
//
// Missions are deliberately data-driven. The same catalog, board rotation and
// evaluator run in solo and on the authoritative multiplayer server, so a
// mission can never complete differently depending on who is watching it.

import { COACHES, FORMATIONS, HISTORICAL_TRIOS, getPositionGroup } from './gameData';
import type { MatchResult, PlayerCard, Team } from './gameEngine';
import { calculateChemistry, positionFit } from './gameEngine';
import { sameClub } from './crests';

export type MissionRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type MissionBoardCategory = 'results' | 'goals' | 'stats' | 'setup' | 'special';
export type MissionProgressMode = 'single' | 'streak' | 'accumulate';

export interface MissionRule {
  kind: string;
  value?: number;
  values?: string[];
  valueKey?: 'formationId' | 'playStyle';
  sequenceMode?: 'same' | 'different';
}

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  category: MissionBoardCategory;
  rarity: MissionRarity;
  deadline: number;
  reward: number;
  target: number;
  mode: MissionProgressMode;
  rule: MissionRule;
}

export interface ActiveMission {
  missionId: string;
  progress: number;
  matchesRemaining: number;
  acceptedCycleKey: string;
  lastSequenceValue?: string;
}

export interface MissionHistoryEntry {
  missionId: string;
  outcome: 'completed' | 'expired' | 'removed';
  matchKey?: string;
  reward: number;
  cycleKey: string;
}

export interface MissionState {
  version: 1;
  /** Randomized once per competition and retained to keep later boards stable. */
  seed?: string;
  cycleKey: string;
  boardIds: string[];
  active: ActiveMission[];
  history: MissionHistoryEntry[];
  processedMatchKeys: string[];
  missionResolution: MissionResolution | null;
  /** The free level-2 mural refresh is scoped to the current cycle/round. */
  rerollUsedCycleKey?: string;
}

/** Presentation event emitted once when a match completes or expires missions. */
export interface MissionResolution {
  matchKey: string;
  completed: string[];
  expired: string[];
}

/** Total permanente de missões concluídas nesta campanha/mural. */
export function completedMissionCount(state: MissionState): number {
  return state.history.reduce((count, entry) => count + (entry.outcome === 'completed' ? 1 : 0), 0);
}

export interface MissionMatchContext {
  result: MatchResult;
  team: Team;
  opponent: Team;
  teamId: string;
  scoreFor: number;
  scoreAgainst: number;
  isWin: boolean;
  isDraw: boolean;
  isRegulation: boolean;
  chemistry: number;
  formationId: string;
  playStyle: string;
  coachPrime: boolean;
  starters: PlayerCard[];
  bench: PlayerCard[];
  starterIds: Set<string>;
  teamStats: {
    possession: number;
    shots: number;
    shotsOnTarget: number;
    saves: number;
    corners: number;
    fouls: number;
  };
  opponentStats: {
    possession: number;
    shots: number;
    shotsOnTarget: number;
    saves: number;
    corners: number;
    fouls: number;
  };
  playerStats: Record<string, { goals: number; assists: number; shots: number; saves: number; yellowCards: number; redCards: number }>;
}

export const MISSION_RARITY_META: Record<MissionRarity, { label: string; color: string }> = {
  common: { label: 'COMUM', color: '#94A3B8' },
  uncommon: { label: 'INCOMUM', color: '#22C55E' },
  rare: { label: 'RARA', color: '#38BDF8' },
  epic: { label: 'ÉPICA', color: '#A78BFA' },
  legendary: { label: 'LENDÁRIA', color: '#F0C674' },
};

export const MISSION_REMOVE_COSTS: Record<MissionRarity, number> = {
  common: 20,
  uncommon: 40,
  rare: 75,
  epic: 125,
  legendary: 200,
};

// Global balance adjustment applied once to each mission's base reward. It is
// intentionally separate from the level-5 Missions Core bonus.
export const MISSION_GLOBAL_REWARD_MULTIPLIER = 1.5;
export const MISSION_REWARD_STEP = 5;

export function roundMissionReward(value: number): number {
  return Math.round(value / MISSION_REWARD_STEP) * MISSION_REWARD_STEP;
}

function missionBaseReward(reward: number): number {
  return roundMissionReward(reward * MISSION_GLOBAL_REWARD_MULTIPLIER);
}

const m = (
  id: string,
  title: string,
  description: string,
  category: MissionBoardCategory,
  rarity: MissionRarity,
  deadline: number,
  reward: number,
  rule: MissionRule,
  target = 1,
  mode: MissionProgressMode = 'single',
): MissionDefinition => ({ id, title, description, category, rarity, deadline, reward: missionBaseReward(reward), target, mode, rule });

// Initial catalog. The board exposes five of these at a time, while two is the
// maximum number of missions that may be active simultaneously.
export const MISSION_CATALOG: MissionDefinition[] = [
  m('first_win', 'Primeira Vitória', 'Vencer uma partida.', 'results', 'common', 1, 25, { kind: 'win' }),
  m('convincing_win', 'Vitória Convincente', 'Vencer uma partida por pelo menos 2 gols de diferença.', 'results', 'uncommon', 1, 55, { kind: 'win_margin', value: 2 }),
  m('three_wins', 'Trinca de Vitórias', 'Vencer 3 partidas consecutivas.', 'results', 'rare', 3, 95, { kind: 'win' }, 3, 'streak'),
  m('unbeaten_streak', 'Invencibilidade', 'Passar por 3 partidas consecutivas sem perder.', 'results', 'uncommon', 3, 70, { kind: 'not_loss' }, 3, 'streak'),
  m('two_wins', 'Duas Seguidas', 'Vencer 2 partidas consecutivas.', 'results', 'uncommon', 2, 60, { kind: 'win' }, 2, 'streak'),
  m('comeback_first_goal', 'Reação Imediata', 'Sofrer o primeiro gol da partida e ainda vencer.', 'results', 'rare', 1, 90, { kind: 'concede_first_and_win' }),
  m('comeback_two', 'Virada de Dois', 'Ficar 2 gols atrás em algum momento da partida e vencer.', 'results', 'epic', 1, 180, { kind: 'behind_by_and_win', value: 2 }),
  m('halftime_comeback', 'Virada no Intervalo', 'Estar perdendo no intervalo e vencer a partida.', 'results', 'rare', 1, 115, { kind: 'losing_at_half_and_win' }),
  m('full_comeback', 'Gol da Virada', 'Estar atrás no placar, virar a partida e vencer.', 'results', 'rare', 1, 120, { kind: 'come_from_behind_and_win' }),
  m('clean_sheet_win', 'Vitória Sem Sofrer Gols', 'Vencer uma partida sem sofrer nenhum gol.', 'results', 'common', 1, 35, { kind: 'clean_sheet_win' }),
  m('late_decisive_goal', 'Gol Decisivo', 'Marcar o gol que coloca seu time à frente depois dos 75 minutos e vencer.', 'results', 'rare', 1, 100, { kind: 'late_lead_goal_win', value: 75 }),
  m('opponent_red_win', 'Aproveitou a Expulsão', 'Vencer uma partida em que um jogador adversário recebeu cartão vermelho.', 'results', 'rare', 1, 110, { kind: 'opponent_red_and_win' }),
  m('win_by_one', 'Vitória por Um', 'Vencer uma partida por exatamente 1 gol de diferença.', 'results', 'common', 1, 45, { kind: 'win_exact_margin', value: 1 }),
  m('first_goal_win', 'Primeiro Gol, Três Pontos', 'Marcar o primeiro gol da partida e vencer.', 'results', 'uncommon', 1, 50, { kind: 'first_goal_and_win' }),
  m('lead_at_half_win', 'Começo na Frente', 'Estar vencendo no intervalo e vencer a partida.', 'results', 'common', 1, 45, { kind: 'winning_at_half_and_win' }),
  m('four_wins', 'Sequência Implacável', 'Vencer 4 partidas consecutivas.', 'results', 'rare', 4, 130, { kind: 'win' }, 4, 'streak'),
  m('five_unbeaten', 'Cinco sem Perder', 'Passar por 5 partidas consecutivas sem perder. Empates contam.', 'results', 'rare', 5, 125, { kind: 'not_loss' }, 5, 'streak'),
  m('two_clean_sheet_wins', 'Duas Vitórias sem Sofrer', 'Vencer 2 partidas consecutivas sem sofrer gols.', 'results', 'rare', 2, 120, { kind: 'clean_sheet_win' }, 2, 'streak'),
  m('five_wins', 'Cinco Vitórias Seguidas', 'Vencer 5 partidas consecutivas.', 'results', 'epic', 5, 180, { kind: 'win' }, 5, 'streak'),
  m('seven_unbeaten', 'Sete sem Perder', 'Passar por 7 partidas consecutivas sem perder. Empates contam.', 'results', 'epic', 7, 210, { kind: 'not_loss' }, 7, 'streak'),
  m('three_first_goal_wins', 'Três Aberturas Perfeitas', 'Vencer 3 partidas consecutivas marcando o primeiro gol em todas elas.', 'results', 'epic', 3, 160, { kind: 'first_goal_and_win' }, 3, 'streak'),
  m('three_clean_sheets', 'Defesa em Série', 'Terminar 3 partidas consecutivas sem sofrer gols. Vitórias e empates contam; derrotas quebram a sequência.', 'results', 'rare', 3, 135, { kind: 'clean_sheet' }, 3, 'streak'),
  m('three_of_four_wins', 'Regularidade', 'Vencer pelo menos 3 das próximas 4 partidas.', 'results', 'rare', 4, 125, { kind: 'win' }, 3, 'accumulate'),
  m('held_lead_win', 'Vantagem Mantida', 'Marcar o primeiro gol, não sofrer nenhum gol depois disso e vencer a partida.', 'results', 'rare', 1, 105, { kind: 'held_lead_and_win' }),

  m('early_goal', 'Gol Relâmpago', 'Marcar pelo menos um gol antes dos 20 minutos.', 'goals', 'common', 1, 30, { kind: 'goal_before', value: 20 }),
  m('two_early_goals', 'Começo Devastador', 'Marcar 2 gols antes dos 30 minutos.', 'goals', 'uncommon', 1, 55, { kind: 'goals_before', value: 2, values: ['30'] }),
  m('four_goals', 'Chuva de Gols', 'Marcar pelo menos 4 gols na mesma partida.', 'goals', 'rare', 1, 110, { kind: 'goals_at_least', value: 4 }),
  m('brace', 'Doblete', 'Fazer um mesmo jogador marcar 2 gols na partida.', 'goals', 'uncommon', 1, 65, { kind: 'player_goals', value: 2 }),
  m('hat_trick', 'Hat-trick', 'Fazer um mesmo jogador marcar 3 gols na partida.', 'goals', 'epic', 1, 170, { kind: 'player_goals', value: 3 }),
  m('goal_burst', 'Minutos de Fúria', 'Marcar 2 gols com intervalo máximo de 10 minutos entre eles.', 'goals', 'rare', 1, 90, { kind: 'goals_within', value: 10 }),
  m('three_scorers', 'Ataque Coletivo', 'Marcar gols com pelo menos 3 jogadores diferentes.', 'goals', 'rare', 1, 100, { kind: 'different_scorers', value: 3 }),
  m('two_goal_matches', 'Fome de Gol', 'Marcar pelo menos 2 gols em 2 partidas consecutivas.', 'goals', 'uncommon', 2, 80, { kind: 'goals_at_least', value: 2 }, 2, 'streak'),
  m('early_and_late', 'Começo e Final', 'Marcar um gol antes dos 20 minutos e outro depois dos 75.', 'goals', 'rare', 1, 115, { kind: 'early_and_late_goal', value: 20, values: ['75'] }),
  m('three_goals_win', 'Três Gols e Vitória', 'Marcar pelo menos 3 gols e vencer a partida.', 'goals', 'rare', 1, 100, { kind: 'goals_at_least_and_win', value: 3 }),
  m('both_halves_win', 'Dois Tempos, Uma Vitória', 'Marcar pelo menos 1 gol em cada tempo e vencer.', 'goals', 'uncommon', 1, 65, { kind: 'goals_in_both_halves_and_win' }),
  m('second_half_two_goals_win', 'Segundo Tempo Implacável', 'Marcar pelo menos 2 gols no segundo tempo e vencer.', 'goals', 'rare', 1, 100, { kind: 'second_half_goals_and_win', value: 2 }),
  m('defender_goal_win', 'Defesa Goleadora', 'Vencer uma partida em que um zagueiro ou lateral titular marque um gol.', 'goals', 'rare', 1, 95, { kind: 'position_goal_and_win', values: ['DEF'] }),
  m('midfielder_goal_win', 'Meio-Campo Goleador', 'Vencer uma partida em que um meio-campista titular marque um gol.', 'goals', 'uncommon', 1, 75, { kind: 'position_goal_and_win', values: ['MID'] }),
  m('four_scorers', 'Ataque Descentralizado', 'Marcar gols com pelo menos 4 jogadores diferentes na mesma partida.', 'goals', 'epic', 1, 150, { kind: 'different_scorers', value: 4 }),
  m('two_first_half_goals_win', 'Pressão Inicial', 'Marcar pelo menos 2 gols no primeiro tempo e vencer.', 'goals', 'rare', 1, 95, { kind: 'first_half_goals_and_win', value: 2 }),
  m('three_assistors', 'Assistência Coletiva', 'Ter pelo menos 3 jogadores diferentes registrando uma assistência na mesma partida.', 'goals', 'rare', 1, 100, { kind: 'different_assistors', value: 3 }),
  m('exactly_two_goals_win', 'Placar em Dobro', 'Marcar exatamente 2 gols e vencer a partida.', 'goals', 'uncommon', 1, 70, { kind: 'exact_goals_and_win', value: 2 }),
  m('four_scoring_matches', 'Gols em Série', 'Marcar pelo menos 1 gol em 4 partidas consecutivas.', 'goals', 'rare', 4, 125, { kind: 'goals_at_least', value: 1 }, 4, 'streak'),
  m('player_goal_assist', 'Assistência Decisiva', 'Fazer o mesmo jogador marcar pelo menos 1 gol e dar pelo menos 1 assistência na mesma partida.', 'goals', 'rare', 1, 115, { kind: 'player_goal_and_assist' }),
  m('mid_attacker_goals', 'Dupla de Setores', 'Vencer com pelo menos um meio-campista e um atacante marcando gols na mesma partida.', 'goals', 'rare', 1, 110, { kind: 'position_groups_goal_and_win', values: ['MID', 'ATT'] }),
  m('defender_attacker_goals', 'Defesa e Ataque', 'Vencer com pelo menos um defensor e um atacante marcando gols na mesma partida.', 'goals', 'rare', 1, 120, { kind: 'position_groups_goal_and_win', values: ['DEF', 'ATT'] }),

  m('high_possession', 'Domínio do Meio', 'Vencer com pelo menos 60% de posse de bola.', 'stats', 'uncommon', 1, 65, { kind: 'possession_and_win', value: 60 }),
  m('low_possession', 'Vitória sem a Bola', 'Vencer com no máximo 35% de posse de bola.', 'stats', 'rare', 1, 100, { kind: 'low_possession_and_win', value: 35 }),
  m('ten_shots_win', 'Volume Ofensivo', 'Finalizar pelo menos 10 vezes e vencer.', 'stats', 'common', 1, 40, { kind: 'shots_and_win', value: 10 }),
  m('six_shots_on_target', 'Testando o Goleiro', 'Ter pelo menos 6 finalizações no alvo.', 'stats', 'uncommon', 1, 65, { kind: 'shots_on_target', value: 6 }),
  m('ten_corners', 'Bola Parada', 'Conseguir pelo menos 10 escanteios.', 'stats', 'rare', 1, 100, { kind: 'corners', value: 10 }),
  m('five_saves_win', 'Goleiro Trabalhou', 'Vencer com pelo menos 5 defesas do goleiro registradas na partida.', 'stats', 'rare', 1, 100, { kind: 'saves_and_win', value: 5 }),
  m('no_cards_win', 'Disciplina Tática', 'Vencer sem receber cartão amarelo ou vermelho.', 'stats', 'common', 1, 35, { kind: 'no_cards_and_win' }),
  m('compact_defense', 'Defesa Compacta', 'Vencer permitindo no máximo 3 finalizações adversárias no alvo.', 'stats', 'rare', 1, 90, { kind: 'opponent_shots_on_target_and_win', value: 3 }),
  m('more_shots_win', 'Superioridade Ofensiva', 'Vencer terminando a partida com mais finalizações que o adversário.', 'stats', 'uncommon', 1, 55, { kind: 'more_shots_and_win' }),
  m('dominance_complete', 'Domínio Completo', 'Vencer com pelo menos 60% de posse e mais finalizações que o adversário.', 'stats', 'rare', 1, 105, { kind: 'possession_and_shots_win', value: 60 }),

  m('counter_tactic', 'Contra-ataque', 'Vencer utilizando a tática Contra-ataque.', 'setup', 'uncommon', 1, 70, { kind: 'play_style_and_win', values: ['counter'] }),
  m('possession_tactic', 'Posse Controlada', 'Vencer utilizando a tática Posse de Bola e ter pelo menos 55% de posse.', 'setup', 'rare', 1, 100, { kind: 'play_style_possession_win', values: ['possession'], value: 55 }),
  m('high_press_tactic', 'Pressão Incessante', 'Vencer utilizando a tática Pressão Alta.', 'setup', 'uncommon', 1, 70, { kind: 'play_style_and_win', values: ['high_press'] }),
  m('defensive_tactic', 'Muralha Tática', 'Vencer utilizando a tática Defensivo e sofrer no máximo 1 gol.', 'setup', 'rare', 1, 95, { kind: 'play_style_concede_and_win', values: ['defensive'], value: 1 }),
  m('all_out_attack', 'Tudo ou Nada', 'Vencer utilizando a tática Tudo pro Ataque e marcar pelo menos 3 gols.', 'setup', 'rare', 1, 110, { kind: 'play_style_goals_and_win', values: ['all_out_attack'], value: 3 }),
  m('plan_b', 'Plano B', 'Ativar uma mudança automática de tática durante a partida e vencer.', 'setup', 'rare', 1, 95, { kind: 'tactic_trigger_and_win' }),
  m('coach_formation', 'A Cara do Treinador', 'Vencer utilizando a formação preferida do treinador.', 'setup', 'common', 1, 40, { kind: 'preferred_formation_and_win' }),
  m('three_defenders', 'Três Zagueiros', 'Vencer utilizando uma formação com 3 zagueiros, como 3-5-2 ou 3-4-3.', 'setup', 'uncommon', 1, 70, { kind: 'formation_and_win', values: ['3-5-2', '3-4-3'] }),
  m('five_defenders', 'Linha de Cinco', 'Vencer utilizando a formação 5-3-2.', 'setup', 'uncommon', 1, 70, { kind: 'formation_and_win', values: ['5-3-2'] }),
  m('offensive_formation', 'Formação Ofensiva', 'Vencer utilizando a formação 3-4-3.', 'setup', 'rare', 1, 95, { kind: 'formation_and_win', values: ['3-4-3'] }),
  m('formation_chameleon', 'Formação Camaleônica', 'Vencer 2 partidas consecutivas utilizando uma formação diferente em cada uma.', 'setup', 'rare', 2, 120, { kind: 'win', valueKey: 'formationId' }, 2, 'streak'),
  m('formation_antidote', 'Formação Antídoto', 'Vencer utilizando uma formação que tenha vantagem contra a formação adversária.', 'setup', 'rare', 1, 120, { kind: 'formation_counter_and_win' }),
  m('same_tactic_streak', 'Tática Fiel', 'Vencer 3 partidas consecutivas utilizando a mesma tática.', 'setup', 'rare', 3, 130, { kind: 'win', valueKey: 'playStyle', sequenceMode: 'same' }, 3, 'streak'),
  m('same_formation_streak', 'Mestre da Formação', 'Vencer 3 partidas consecutivas utilizando a mesma formação.', 'setup', 'rare', 3, 130, { kind: 'win', valueKey: 'formationId', sequenceMode: 'same' }, 3, 'streak'),
  m('classic_442', 'Clássico 4-4-2', 'Vencer utilizando a formação 4-4-2.', 'setup', 'common', 1, 55, { kind: 'formation_and_win', values: ['4-4-2'] }),
  m('classic_433', 'Formação 4-3-3', 'Vencer utilizando a formação 4-3-3.', 'setup', 'common', 1, 45, { kind: 'formation_and_win', values: ['4-3-3'] }),
  m('counter_4231', 'Contra-ataque em 4-2-3-1', 'Vencer utilizando a formação 4-2-3-1 e a tática Contra-ataque.', 'setup', 'rare', 1, 105, { kind: 'formation_play_style_and_win', values: ['4-2-3-1', 'counter'] }),
  m('three_different_tactics', 'Tática Alternada', 'Vencer 3 partidas consecutivas utilizando uma tática diferente em cada partida.', 'setup', 'epic', 3, 155, { kind: 'win', valueKey: 'playStyle', sequenceMode: 'different' }, 3, 'streak'),
  m('two_counter_formations', 'Antídoto em Série', 'Vencer 2 partidas consecutivas utilizando, em ambas, uma formação que tenha vantagem contra a formação adversária.', 'setup', 'epic', 2, 170, { kind: 'formation_counter_and_win' }, 2, 'streak'),
  m('two_tactic_changes_win', 'Plano de Jogo Completo', 'Ativar pelo menos 2 mudanças automáticas de tática diferentes durante a partida e vencer.', 'setup', 'rare', 1, 120, { kind: 'tactic_triggers_and_win', value: 2 }),
  m('attacking_433', 'Ataque em 4-3-3', 'Vencer utilizando a formação 4-3-3 e marcando pelo menos 3 gols.', 'setup', 'rare', 1, 115, { kind: 'formation_goals_and_win', values: ['4-3-3'], value: 3 }),
  m('defensive_532', 'Muralha em 5-3-2', 'Vencer utilizando a formação 5-3-2 e sofrer no máximo 1 gol.', 'setup', 'rare', 1, 105, { kind: 'formation_concede_and_win', values: ['5-3-2'], value: 1 }),
  m('control_4231', 'Controle em 4-2-3-1', 'Vencer utilizando a formação 4-2-3-1 e terminar com pelo menos 55% de posse.', 'setup', 'uncommon', 1, 80, { kind: 'formation_possession_and_win', values: ['4-2-3-1'], value: 55 }),
  m('attacking_combination', 'Combinação Ofensiva', 'Vencer utilizando a formação 3-4-3, a tática Tudo pro Ataque e marcando pelo menos 3 gols.', 'setup', 'epic', 1, 190, { kind: 'formation_tactic_goals_and_win', values: ['3-4-3', 'all_out_attack'], value: 3 }),
  m('perfect_chemistry', 'Química Perfeita', 'Vencer uma partida iniciada com pelo menos 90 de química.', 'setup', 'epic', 1, 170, { kind: 'chemistry_and_win', value: 90 }),
  m('low_chemistry', 'Contra Todas as Probabilidades', 'Vencer uma partida iniciada com no máximo 10 de química.', 'setup', 'legendary', 1, 320, { kind: 'chemistry_max_and_win', value: 10 }),
  m('coherent_lineup', 'Escalação Coerente', 'Vencer sem nenhum titular estar fora de suas posições compatíveis.', 'setup', 'common', 1, 35, { kind: 'all_compatible_and_win' }),
  m('versatility', 'Versatilidade', 'Vencer começando a partida com pelo menos 3 titulares em posições secundárias.', 'setup', 'rare', 1, 100, { kind: 'secondary_positions_and_win', value: 3 }),
  m('decisive_captain', 'Capitão Decisivo', 'O capitão marcar um gol ou dar uma assistência em uma vitória.', 'setup', 'uncommon', 1, 65, { kind: 'captain_goal_or_assist_win' }),
  m('prime_coach', 'Mestre Prime', 'Vencer utilizando um treinador Prime.', 'setup', 'rare', 1, 100, { kind: 'prime_coach_and_win' }),
  m('historical_trio', 'Trio Histórico', 'Vencer com um trio histórico completo entre os titulares.', 'setup', 'rare', 1, 110, { kind: 'historical_trio_and_win' }),
  m('national_core', 'Nação em Campo', 'Vencer começando com pelo menos 4 titulares da mesma nacionalidade.', 'setup', 'uncommon', 1, 75, { kind: 'same_nation_and_win', value: 4 }),

  m('noe_play', 'A Arca', 'Jogar uma partida com a característica Noé ativa no início da partida.', 'special', 'rare', 1, 100, { kind: 'noe_active' }),
  m('noe_win', 'Noé Sobrevive', 'Vencer uma partida com a característica Noé ativa.', 'special', 'epic', 1, 170, { kind: 'noe_and_win' }),
  m('todos_por_um', 'Todos por Um', 'Jogar uma partida com os 11 titulares possuindo Todos por um ativo.', 'special', 'legendary', 2, 400, { kind: 'todos_por_um_active' }),
  m('twelfth_man_play', '12º Homem', 'Jogar uma partida mantendo um jogador com 12º Homem no banco.', 'special', 'common', 1, 30, { kind: 'twelfth_man_bench' }),
  m('twelfth_man_win', 'Banco que Ajuda', 'Vencer mantendo um jogador com 12º Homem no banco.', 'special', 'rare', 1, 85, { kind: 'twelfth_man_bench_and_win' }),
  m('goleador_hat_trick', 'O Homem do Jogo', 'Fazer um jogador com Goleador marcar 3 gols na mesma partida.', 'special', 'legendary', 2, 350, { kind: 'goleador_goals', value: 3 }),
  m('garcom_assists', 'Garçom de Luxo', 'Fazer um jogador com Garçom dar 2 assistências na mesma partida.', 'special', 'rare', 1, 130, { kind: 'garcom_assists', value: 2 }),
  m('magnata_win', 'Dinheiro em Campo', 'Vencer com um jogador com Magnata entre os titulares.', 'special', 'rare', 1, 90, { kind: 'magnata_and_win' }),
  m('pipoqueiro_win', 'Pipoca na Pressão', 'Vencer com um jogador com Pipoqueiro entre os titulares.', 'special', 'epic', 1, 140, { kind: 'pipoqueiro_and_win' }),
  m('coringa_win', 'Coringa Tático', 'Vencer utilizando um jogador com Coringa fora de sua posição natural.', 'special', 'rare', 1, 100, { kind: 'coringa_oop_and_win' }),
  m('pilar_win', 'Pilar da Equipe', 'Vencer com um jogador com Pilar titular e com pelo menos 80 de química no início da partida.', 'special', 'rare', 1, 110, { kind: 'pilar_chemistry_and_win', value: 80 }),
  m('lobo_win', 'Lobo Solitário', 'Vencer com um jogador com Lobo Solitário entre os titulares e com a química do time em 40 ou menos no início da partida.', 'special', 'epic', 1, 180, { kind: 'lobo_chemistry_and_win', value: 40 }),
  m('nomade_win', 'Nômade', 'Vencer com um jogador com Nômade entre os titulares.', 'special', 'rare', 1, 105, { kind: 'nomade_and_win' }),
  m('forasteiro_win', 'Forasteiro Isolado', 'Vencer com Forasteiro ativo, sendo ele o único titular de seu país e clube.', 'special', 'epic', 1, 170, { kind: 'forasteiro_and_win' }),
  m('martir_win', 'Mártir em Campo', 'Jogar uma partida com um jogador com Mártir entre os titulares.', 'special', 'uncommon', 1, 55, { kind: 'martir_active' }),
  m('idolo_win', 'Ídolo do Vestiário', 'Vencer com Ídolo titular e pelo menos 3 companheiros do mesmo clube na escalação.', 'special', 'rare', 1, 120, { kind: 'idolo_and_win', value: 3 }),
  m('collector_win', 'Elenco Completo', 'Vencer com Colecionador entre os titulares e pelo menos 5 jogadores fora do time titular disponíveis no banco.', 'special', 'uncommon', 1, 80, { kind: 'collector_bench_and_win', value: 5 }),
  m('estribado_win', 'Cofre Cheio', 'Vencer com Estribado titular e pelo menos 500 créditos no início da partida.', 'special', 'rare', 1, 110, { kind: 'estribado_credits_and_win', value: 500 }),
  m('capitao_nato_win', 'Capitão Nato', 'Vencer utilizando um jogador com Capitão Nato como capitão.', 'special', 'rare', 1, 100, { kind: 'capitao_nato_and_win' }),
  m('fragil_win', 'Frágil, mas Firme', 'Vencer com Frágil titular sem que ele sofra lesão durante a partida.', 'special', 'epic', 1, 150, { kind: 'fragil_and_win' }),
  m('resiliente_win', 'Resiliência', 'Vencer com Resiliente titular depois de ele ter participado como titular de pelo menos uma derrota.', 'special', 'rare', 1, 115, { kind: 'resiliente_and_win' }),
  m('arrogante_two_goals', 'Orgulho Ferido', 'Vencer com Arrogante titular e fazer esse jogador marcar 2 gols.', 'special', 'epic', 1, 160, { kind: 'arrogante_goals_and_win', value: 2 }),

  m('tactic_chameleon', 'Tática Camaleônica', 'Vencer 2 partidas consecutivas utilizando uma tática diferente em cada partida.', 'setup', 'rare', 2, 120, { kind: 'win', valueKey: 'playStyle' }, 2, 'streak'),
  m('chemistry_consistency', 'Química Consistente', 'Vencer 2 partidas consecutivas iniciando ambas com pelo menos 80 de química.', 'setup', 'epic', 2, 180, { kind: 'chemistry_and_win', value: 80 }, 2, 'streak'),
  m('chemistry_70_streak', 'Química Estável', 'Vencer 3 partidas consecutivas iniciando todas com pelo menos 70 de química.', 'setup', 'rare', 3, 145, { kind: 'chemistry_and_win', value: 70 }, 3, 'streak'),
  m('chemistry_range', 'Química na Medida', 'Vencer uma partida iniciando com química entre 70 e 79.', 'setup', 'uncommon', 1, 75, { kind: 'chemistry_range_and_win', value: 70, values: ['79'] }),
  m('chemistry_85_89', 'Química Controlada', 'Vencer iniciando a partida com química entre 85 e 89.', 'setup', 'rare', 1, 95, { kind: 'chemistry_range_and_win', value: 85, values: ['89'] }),
  m('seven_nations', 'Seleção Internacional', 'Vencer com pelo menos 7 nacionalidades diferentes entre os titulares.', 'setup', 'rare', 1, 110, { kind: 'distinct_nations_and_win', value: 7 }),
  m('no_specials_win', 'Elenco Tradicional', 'Vencer sem nenhum titular possuir uma característica especial ativa.', 'special', 'uncommon', 1, 60, { kind: 'no_specials_and_win' }),
  m('special_variety', 'Características Variadas', 'Vencer com pelo menos 4 características especiais diferentes presentes entre os titulares.', 'special', 'epic', 1, 180, { kind: 'special_variety_and_win', value: 4 }),
  m('club_unity', 'Clube Unido', 'Vencer com pelo menos 5 titulares do mesmo clube.', 'special', 'rare', 1, 95, { kind: 'same_club_and_win', value: 5 }),
  m('deep_bench', 'Banco Profundo', 'Vencer com pelo menos 10 jogadores fora do XI titular disponíveis no banco.', 'special', 'uncommon', 1, 65, { kind: 'bench_size_and_win', value: 10 }),
  m('historical_pairs', 'História Compartilhada', 'Vencer com pelo menos 2 pares de jogadores que possuam vínculo histórico entre si entre os titulares.', 'special', 'epic', 1, 160, { kind: 'historical_pairs_and_win', value: 2 }),
  m('in_form_win', 'Em Alta', 'Vencer com um jogador com Em Alta entre os titulares.', 'special', 'uncommon', 1, 65, { kind: 'in_form_and_win' }),
  m('prodigy_goals_win', 'Prodígio Decisivo', 'Vencer com um jogador com Prodígio entre os titulares, e esse jogador marcar pelo menos 2 gols na partida.', 'special', 'epic', 1, 165, { kind: 'trait_player_goals_and_win', values: ['prodigio'], value: 2 }),
  m('coringa_lobo_win', 'Dupla de Características', 'Vencer com jogadores com Coringa e Lobo Solitário entre os titulares.', 'special', 'legendary', 1, 220, { kind: 'coringa_lobo_and_win' }),
  m('noe_clean_sheet_win', 'Noé Invencível', 'Vencer uma partida com Noé ativo e sem sofrer gols.', 'special', 'epic', 1, 190, { kind: 'noe_clean_sheet_and_win' }),
  m('double_in_form_win', 'Em Alta em Dobro', 'Vencer com pelo menos 2 titulares com Em Alta.', 'special', 'epic', 1, 150, { kind: 'in_form_count_and_win', value: 2 }),
  m('double_goleador_win', 'Dupla de Goleadores', 'Vencer com pelo menos 2 titulares diferentes com Goleador marcando pelo menos 1 gol cada.', 'special', 'legendary', 1, 190, { kind: 'distinct_trait_scorers_and_win', values: ['goleador'], value: 2 }),
  m('garcom_goleador_win', 'Garçom e Goleador', 'Vencer com um titular com Garçom dando assistência e um titular com Goleador marcando gol.', 'special', 'epic', 1, 165, { kind: 'trait_combo_goal_assist_and_win', values: ['garcom', 'goleador'] }),
  m('pilar_clean_sheet_win', 'Pilar de Aço', 'Vencer sem sofrer gols com um jogador com Pilar entre os titulares.', 'special', 'epic', 1, 150, { kind: 'pilar_clean_sheet_and_win' }),
  m('lobo_goal_win', 'Lobo Artilheiro', 'Vencer com um jogador com Lobo Solitário entre os titulares, e esse jogador marcar pelo menos 1 gol.', 'special', 'epic', 1, 170, { kind: 'trait_player_goal_and_win', values: ['lobo'] }),
  m('forasteiro_decisive_win', 'Forasteiro Decisivo', 'Vencer com Forasteiro ativo, e esse mesmo jogador marcar um gol ou dar uma assistência.', 'special', 'epic', 1, 160, { kind: 'trait_player_goal_or_assist_and_win', values: ['forasteiro'] }),
  m('nomade_decisive_win', 'Nômade Decisivo', 'Vencer com um jogador com Nômade entre os titulares, e esse jogador marcar um gol ou dar uma assistência.', 'special', 'epic', 1, 150, { kind: 'trait_player_goal_or_assist_and_win', values: ['nomade'] }),
  m('fragil_heroic_win', 'Frágil Heroico', 'Vencer sem que um jogador com Frágil sofra lesão, com esse mesmo jogador marcando um gol ou dando uma assistência.', 'special', 'epic', 1, 165, { kind: 'fragil_heroic_and_win' }),
  m('resiliente_comeback_win', 'Virada Resiliente', 'Vencer depois de ficar atrás no placar com um jogador com Resiliente entre os titulares.', 'special', 'epic', 1, 175, { kind: 'resiliente_comeback_win' }),

  // Approved expansion: the 27 missions kept from the additional 30-idea batch.
  m('two_goal_margin_win', 'Vitória por Dois', 'Vencer uma partida por exatamente 2 gols de diferença.', 'results', 'uncommon', 1, 65, { kind: 'win_exact_margin', value: 2 }),
  m('three_goal_margin_win', 'Vitória Avassaladora', 'Vencer uma partida por pelo menos 3 gols de diferença.', 'results', 'rare', 1, 90, { kind: 'win_margin', value: 3 }),
  m('second_half_clean_win', 'Segundo Tempo Seguro', 'Vencer uma partida sem sofrer gols depois do minuto 45.', 'results', 'uncommon', 1, 60, { kind: 'second_half_clean_sheet_and_win' }),
  m('level_at_half_win', 'Empate no Intervalo', 'Estar empatado até o minuto 45 e vencer a partida.', 'results', 'uncommon', 1, 75, { kind: 'level_at_half_and_win' }),
  m('late_comeback_win', 'Virada Tardia', 'Estar perdendo depois do minuto 60 e vencer a partida.', 'results', 'epic', 1, 150, { kind: 'losing_after_minute_and_win', value: 60 }),
  m('first_last_goal_win', 'Primeiro e Último', 'Marcar o primeiro e o último gol da partida e vencer.', 'results', 'rare', 1, 80, { kind: 'first_and_last_goal_and_win' }),
  m('two_assists_same_player_win', 'Garçom Incansável', 'Fazer o mesmo jogador dar pelo menos 2 assistências e vencer.', 'results', 'rare', 1, 105, { kind: 'player_assists_and_win', value: 2 }),
  m('two_assistors_win', 'Dupla de Garçons', 'Vencer com pelo menos 2 jogadores diferentes registrando uma assistência.', 'results', 'rare', 1, 100, { kind: 'different_assistors_and_win', value: 2 }),
  m('two_defenders_score_win', 'Zaga Surpreendente', 'Vencer com 2 defensores diferentes marcando gols.', 'results', 'epic', 1, 150, { kind: 'position_scorers_and_win', values: ['DEF'], value: 2 }),
  m('two_midfielders_score_win', 'Meio-Campo Decisivo', 'Vencer com 2 meio-campistas diferentes marcando gols.', 'results', 'rare', 1, 120, { kind: 'position_scorers_and_win', values: ['MID'], value: 2 }),
  m('all_sectors_score_win', 'Gol em Todos os Setores', 'Vencer com um defensor, um meio-campista e um atacante marcando gols.', 'results', 'epic', 1, 170, { kind: 'position_groups_goal_and_win', values: ['DEF', 'MID', 'ATT'] }),
  m('three_same_half_goals_win', 'Domínio de um Tempo', 'Marcar pelo menos 3 gols no mesmo tempo e vencer.', 'results', 'rare', 1, 115, { kind: 'same_half_goals_and_win', value: 3 }),
  m('two_each_half_win', 'Pressão nos Dois Tempos', 'Marcar pelo menos 2 gols até o minuto 45 e 2 depois dele, vencendo a partida.', 'results', 'rare', 1, 110, { kind: 'both_halves_min_goals_and_win', value: 2 }),
  m('equalizer_retake_lead_win', 'Virada de Roteiro', 'Marcar o primeiro gol, sofrer o empate, voltar a ficar na frente e vencer.', 'results', 'epic', 1, 165, { kind: 'retake_lead_after_equalizer_and_win' }),

  m('fifteen_shots_win', 'Chuteira Quente', 'Finalizar pelo menos 15 vezes e vencer.', 'stats', 'uncommon', 1, 55, { kind: 'shots_and_win', value: 15 }),
  m('five_corners_win', 'Escanteio Decisivo', 'Conseguir pelo menos 5 escanteios e vencer.', 'stats', 'uncommon', 1, 60, { kind: 'corners_and_win', value: 5 }),
  m('no_opponent_target_shots_win', 'Bloqueio Total', 'Vencer sem permitir nenhuma finalização adversária no alvo.', 'stats', 'epic', 1, 150, { kind: 'opponent_shots_on_target_and_win', value: 0 }),
  m('more_target_shots_win', 'Mais Perigoso', 'Vencer tendo mais finalizações no alvo que o adversário.', 'stats', 'rare', 1, 95, { kind: 'more_shots_on_target_and_win' }),
  m('more_corners_win', 'Domínio pelos Cantos', 'Vencer conseguindo mais escanteios que o adversário.', 'stats', 'rare', 1, 90, { kind: 'more_corners_and_win' }),

  m('balanced_tactic_win', 'Equilíbrio Perfeito', 'Vencer utilizando a tática Equilibrado.', 'setup', 'common', 1, 45, { kind: 'play_style_and_win', values: ['balanced'] }),
  m('pressing_433_win', 'Pressão em 4-3-3', 'Vencer utilizando a formação 4-3-3 e a tática Pressão Alta.', 'setup', 'rare', 1, 100, { kind: 'formation_play_style_and_win', values: ['4-3-3', 'high_press'] }),
  m('possession_532_win', 'Posse em 5-3-2', 'Vencer utilizando a formação 5-3-2 e pelo menos 55% de posse.', 'setup', 'rare', 1, 95, { kind: 'formation_possession_and_win', values: ['5-3-2'], value: 55 }),
  m('coach_identity_chemistry_win', 'Identidade Completa', 'Vencer utilizando a formação preferida do treinador e pelo menos 80 de química.', 'setup', 'epic', 1, 145, { kind: 'preferred_formation_chemistry_and_win', value: 80 }),
  m('mid_chemistry_win', 'Química Intermediária', 'Vencer iniciando a partida com química entre 50 e 59.', 'setup', 'rare', 1, 85, { kind: 'chemistry_range_and_win', value: 50, values: ['59'] }),

  m('goleador_two_goals_win', 'Goleador Decisivo', 'Vencer com um jogador com Goleador titular marcando pelo menos 2 gols.', 'special', 'epic', 1, 145, { kind: 'trait_player_goals_and_win', values: ['goleador'], value: 2 }),
  m('garcom_assist_win', 'Garçom Decisivo', 'Vencer com um jogador com Garçom titular dando pelo menos 1 assistência.', 'special', 'uncommon', 1, 70, { kind: 'trait_player_assists_and_win', values: ['garcom'], value: 1 }),
  m('in_form_goal_win', 'Em Alta Goleador', 'Vencer com um jogador com Em Alta titular marcando pelo menos 1 gol.', 'special', 'rare', 1, 85, { kind: 'trait_player_goals_and_win', values: ['inForm'], value: 1 }),

  // Approved expansion: 39 additional missions.
  m('pilar_in_form_win', 'Pilar em Alta', 'Vencer com um jogador com Pilar e um jogador com Em Alta entre os titulares.', 'special', 'epic', 1, 160, { kind: 'pilar_in_form_and_win' }),
  m('idolo_mass_win', 'Ídolo em Massa', 'Vencer com Ídolo titular e pelo menos 5 outros titulares do mesmo clube.', 'special', 'epic', 1, 165, { kind: 'idolo_and_win', value: 5 }),
  m('twelfth_man_attack_win', '12º Homem Ofensivo', 'Vencer com 12º Homem no banco e pelo menos 3 titulares diferentes marcando gols.', 'special', 'epic', 1, 150, { kind: 'twelfth_man_scorers_and_win', value: 3 }),
  m('collector_twelfth_win', 'Banco de Efeitos', 'Vencer com Colecionador titular e 12º Homem no banco.', 'special', 'epic', 1, 145, { kind: 'collector_twelfth_and_win' }),
  m('magnata_decisive_win', 'Magnata no Sacrifício', 'Vencer com Magnata titular e esse jogador marcando um gol ou dando uma assistência.', 'special', 'epic', 1, 140, { kind: 'trait_player_goal_or_assist_and_win', values: ['magnata'] }),
  m('magnata_estribado_win', 'Magnata e Estribado', 'Vencer com Magnata e Estribado entre os titulares e começar com pelo menos 500 créditos.', 'special', 'legendary', 1, 220, { kind: 'magnata_estribado_and_win', value: 500 }),
  m('pipoqueiro_decisive_win', 'Pipoqueiro Decisivo', 'Vencer com Pipoqueiro titular e esse jogador marcando um gol ou dando uma assistência.', 'special', 'epic', 1, 145, { kind: 'trait_player_goal_or_assist_and_win', values: ['pipoqueiro'] }),
  m('estribado_rich_win', 'Estribado Abastado', 'Vencer com Estribado titular e começar com pelo menos 1.000 créditos.', 'special', 'rare', 1, 130, { kind: 'estribado_credits_and_win', value: 1000 }),
  m('collector_deep_bench_win', 'Colecionador de Reservas', 'Vencer com Colecionador titular e pelo menos 15 jogadores fora do XI titular disponíveis no banco.', 'special', 'rare', 1, 120, { kind: 'collector_bench_and_win', value: 15 }),
  m('capitao_nato_decisive_win', 'Capitão Nato Decisivo', 'Vencer com Capitão Nato como capitão e esse jogador marcando um gol ou dando uma assistência.', 'special', 'epic', 1, 145, { kind: 'capitao_nato_goal_or_assist_and_win' }),
  m('prodigio_streak_goals_win', 'Prodígio em Série', 'Vencer 2 partidas consecutivas com um jogador com Prodígio titular marcando pelo menos 1 gol em cada partida.', 'special', 'epic', 2, 175, { kind: 'trait_player_goals_and_win', values: ['prodigio'], value: 1 }, 2, 'streak'),
  m('arrogante_three_goals_win', 'Arrogante Dominante', 'Vencer com Arrogante titular e esse jogador marcando pelo menos 3 gols.', 'special', 'epic', 1, 200, { kind: 'arrogante_goals_and_win', value: 3 }),
  m('fragil_goal_win', 'Frágil Goleador', 'Vencer com Frágil titular, sem esse jogador sofrer lesão, e ele marcar pelo menos 2 gols.', 'special', 'epic', 1, 190, { kind: 'fragil_goals_and_win', value: 2 }),
  m('resiliente_attack_win', 'Resiliente Ofensivo', 'Vencer com Resiliente titular e marcar pelo menos 3 gols na partida.', 'special', 'epic', 1, 160, { kind: 'resiliente_goals_and_win', value: 3 }),
  m('lobo_possession_win', 'Lobo sob Controle', 'Vencer com Lobo Solitário titular, química inicial de no máximo 40 e pelo menos 60% de posse.', 'special', 'epic', 1, 195, { kind: 'lobo_chemistry_possession_and_win', value: 40, values: ['60'] }),
  m('nomade_stable_win', 'Nômade Estável', 'Vencer com Nômade titular e começar com pelo menos 70 de química.', 'special', 'epic', 1, 160, { kind: 'nomade_chemistry_and_win', value: 70 }),
  m('forasteiro_clean_sheet_win', 'Forasteiro de Ferro', 'Vencer com Forasteiro ativo entre os titulares e sem sofrer gols.', 'special', 'epic', 1, 180, { kind: 'forasteiro_clean_sheet_and_win' }),
  m('pilar_elite_win', 'Pilar Imponente', 'Vencer com Pilar titular e começar com pelo menos 90 de química.', 'special', 'epic', 1, 160, { kind: 'pilar_chemistry_and_win', value: 90 }),
  m('coringa_adapted_win', 'Coringa Adaptado', 'Vencer com Coringa titular fora da posição natural e pelo menos 2 outros titulares em posições secundárias.', 'special', 'epic', 1, 170, { kind: 'coringa_secondary_and_win', value: 2 }),
  m('in_form_prodigy_win', 'Em Alta e Prodígio', 'Vencer com Em Alta e Prodígio titulares, com Em Alta marcando e Prodígio dando uma assistência.', 'special', 'legendary', 1, 230, { kind: 'in_form_prodigy_goal_assist_and_win' }),
  m('goleador_streak_win', 'Goleador em Série', 'Vencer 2 partidas consecutivas com Goleador titular marcando pelo menos 1 gol em cada partida.', 'special', 'epic', 2, 180, { kind: 'trait_player_goals_and_win', values: ['goleador'], value: 1 }, 2, 'streak'),
  m('garcom_streak_win', 'Garçom em Série', 'Vencer 2 partidas consecutivas com Garçom titular dando pelo menos 1 assistência em cada partida.', 'special', 'epic', 2, 170, { kind: 'trait_player_assists_and_win', values: ['garcom'], value: 1 }, 2, 'streak'),
  m('arrogante_garcom_win', 'Arrogante e Garçom', 'Vencer com um titular com Arrogante marcando e um titular com Garçom dando assistência.', 'special', 'legendary', 1, 220, { kind: 'arrogante_garcom_goal_assist_and_win' }),
  m('martir_idolo_win', 'Dupla de Efeitos', 'Vencer com Mártir e Ídolo entre os titulares.', 'special', 'legendary', 1, 210, { kind: 'martir_idolo_and_win' }),
  m('twelfth_man_elite_win', '12º Homem de Elite', 'Vencer com 12º Homem no banco e começar com pelo menos 80 de química.', 'special', 'rare', 1, 130, { kind: 'twelfth_man_chemistry_and_win', value: 80 }),

  m('complete_time_blocks_win', 'Bloco Completo', 'Vencer marcando pelo menos 1 gol entre os minutos 1–30, 31–60 e 61–90.', 'results', 'epic', 1, 160, { kind: 'goals_in_time_blocks_and_win' }),
  m('late_pressure_win', 'Pressão Final', 'Vencer marcando pelo menos 2 gols depois do minuto 75.', 'goals', 'rare', 1, 120, { kind: 'second_half_goals_after_and_win', value: 2, values: ['75'] }),
  m('disciplined_marking_win', 'Marcação Disciplinada', 'Vencer sofrendo no máximo 1 gol e cometendo menos faltas que o adversário.', 'stats', 'epic', 1, 150, { kind: 'concede_fewer_fouls_and_win', value: 1 }),
  m('efficient_finishing_win', 'Finalização Eficiente', 'Vencer marcando pelo menos 3 gols e realizando no máximo 12 finalizações.', 'stats', 'rare', 1, 125, { kind: 'goals_and_shots_limit_win', value: 3, values: ['12'] }),
  m('volume_superior_win', 'Volume Superior', 'Vencer realizando pelo menos 12 finalizações e terminando com mais finalizações que o adversário.', 'stats', 'rare', 1, 115, { kind: 'shots_min_and_more_and_win', value: 12 }),
  m('discipline_result_win', 'Disciplina de Resultado', 'Vencer marcando pelo menos 2 gols sem receber cartões.', 'stats', 'rare', 1, 120, { kind: 'goals_and_no_cards_win', value: 2 }),
  m('safe_442_win', '4-4-2 Seguro', 'Vencer utilizando a formação 4-4-2 e sofrendo no máximo 1 gol.', 'setup', 'rare', 1, 100, { kind: 'formation_concede_and_win', values: ['4-4-2'], value: 1 }),
  m('dominant_352_win', '3-5-2 Dominante', 'Vencer utilizando a formação 3-5-2 e marcando pelo menos 3 gols.', 'setup', 'rare', 1, 115, { kind: 'formation_goals_and_win', values: ['3-5-2'], value: 3 }),
  m('clean_4231_win', '4-2-3-1 Limpo', 'Vencer utilizando a formação 4-2-3-1 sem sofrer gols.', 'setup', 'rare', 1, 105, { kind: 'formation_concede_and_win', values: ['4-2-3-1'], value: 0 }),
  m('balanced_433_win', '4-3-3 Equilibrada', 'Vencer utilizando a formação 4-3-3 e sofrendo no máximo 1 gol.', 'setup', 'rare', 1, 105, { kind: 'formation_concede_and_win', values: ['4-3-3'], value: 1 }),
  m('blocked_532_win', '5-3-2 Bloqueadora', 'Vencer utilizando a formação 5-3-2 e permitindo no máximo 6 finalizações adversárias.', 'setup', 'epic', 1, 130, { kind: 'formation_opponent_shots_and_win', values: ['5-3-2'], value: 6 }),
  m('three_margin_exact_win', 'Vitória por Três', 'Vencer por exatamente 3 gols de diferença.', 'results', 'rare', 1, 100, { kind: 'win_exact_margin', value: 3 }),
  m('perfect_victory_win', 'Vitória Perfeita', 'Vencer marcando pelo menos 3 gols sem sofrer nenhum gol.', 'results', 'epic', 1, 150, { kind: 'goals_and_clean_sheet_win', value: 3 }),
  m('perfect_score_win', 'Placar Perfeito', 'Vencer uma partida por 2 a 0.', 'results', 'rare', 1, 100, { kind: 'win_exact_score', value: 2, values: ['0'] }),

  // Rarity-focused expansion: the six card rarities are bronze, silver, gold,
  // legendary, immortal and unique. The first set deliberately excludes Unique.
  m('all_regular_rarities_win', 'Escalação Tradicional', 'Vencer com pelo menos um titular de cada raridade regular: Bronze, Prata, Ouro, Lendária e Imortal.', 'setup', 'epic', 1, 175, { kind: 'all_rarities_and_win', values: ['bronze', 'silver', 'gold', 'legendary', 'immortal'] }),
  m('all_rarities_win', 'Coleção Absoluta', 'Vencer com pelo menos um titular de cada raridade, incluindo Única.', 'setup', 'legendary', 1, 280, { kind: 'all_rarities_and_win', values: ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'] }),
  m('bronze_core_win', 'Base de Bronze', 'Vencer com pelo menos 4 titulares de raridade Bronze.', 'setup', 'uncommon', 1, 70, { kind: 'rarity_count_and_win', values: ['bronze'], value: 4 }),
  m('silver_or_bronze_core_win', 'Base Popular', 'Vencer com pelo menos 6 titulares de raridade Bronze ou Prata.', 'setup', 'rare', 1, 105, { kind: 'rarity_count_and_win', values: ['bronze', 'silver'], value: 6 }),
  m('gold_legendary_core_win', 'Ouro e Lendárias', 'Vencer com pelo menos 5 titulares de raridade Ouro ou Lendária.', 'setup', 'rare', 1, 115, { kind: 'rarity_count_and_win', values: ['gold', 'legendary'], value: 5 }),
  m('elite_rarity_core_win', 'Núcleo de Elite', 'Vencer com pelo menos 4 titulares de raridade Lendária, Imortal ou Única.', 'setup', 'epic', 1, 180, { kind: 'rarity_count_and_win', values: ['legendary', 'immortal', 'unique'], value: 4 }),
  m('one_unique_win', 'Uma Joia Única', 'Vencer com exatamente 1 titular de raridade Única.', 'setup', 'rare', 1, 100, { kind: 'rarity_exact_count_and_win', values: ['unique'], value: 1 }),
];

export const MISSION_MAP: Record<string, MissionDefinition> = Object.fromEntries(MISSION_CATALOG.map(definition => [definition.id, definition]));

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const output = [...items];
  let state = hashSeed(seed) || 1;
  for (let i = output.length - 1; i > 0; i--) {
    state = Math.imul(state ^ (state >>> 16), 2246822519) >>> 0;
    const j = state % (i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export function newMissionSeed(scope = 'campaign'): string {
  return `${scope}:${crypto.randomUUID()}`;
}

export function missionDefinition(id: string): MissionDefinition | undefined {
  return MISSION_MAP[id];
}

export function missionDeadline(missionId: string, missionsProjectLevel = 1): number {
  const definition = MISSION_MAP[missionId];
  if (!definition) return 0;
  return definition.deadline + (missionsProjectLevel >= 4 ? 1 : 0);
}

export function missionReward(missionId: string, missionsProjectLevel = 1): number {
  const definition = MISSION_MAP[missionId];
  if (!definition) return 0;
  const projectMultiplier = missionsProjectLevel >= 5 ? 1.5 : 1;
  return roundMissionReward(definition.reward * projectMultiplier);
}

export function missionRemovalCost(missionId: string, missionsProjectLevel = 1): number {
  const definition = MISSION_MAP[missionId];
  if (!definition) return Number.POSITIVE_INFINITY;
  const baseCost = MISSION_REMOVE_COSTS[definition.rarity];
  return missionsProjectLevel >= 3 ? Math.ceil(baseCost / 2) : baseCost;
}

function buildBoard(seed: string, cycleKey: string, excludedIds: Set<string> = new Set()): string[] {
  // Each campaign and cycle gets its own stable randomized draw. Exclusions are
  // only for the current draw (for example, replacing the five visible offers),
  // so a mission can appear again in a later round.
  return seededShuffle(
    MISSION_CATALOG.filter(definition => !excludedIds.has(definition.id)),
    `${seed}:${cycleKey}:board`,
  ).slice(0, 5).map(definition => definition.id);
}

export function createMissionState(seed: string, cycleKey = 'L1'): MissionState {
  const boardIds = buildBoard(seed, cycleKey);
  return {
    version: 1,
    seed,
    cycleKey,
    boardIds,
    active: [],
    history: [],
    processedMatchKeys: [],
    missionResolution: null,
    rerollUsedCycleKey: undefined,
  };
}

function hasValidBoard(boardIds: string[]): boolean {
  const valid = boardIds.length <= 5
    && new Set(boardIds).size === boardIds.length
    && boardIds.every(id => Boolean(MISSION_MAP[id]));
  return valid && boardIds.length === 5;
}

export function normalizeMissionState(input: unknown, seed: string, cycleKey = 'L1'): MissionState {
  if (!input || typeof input !== 'object') return createMissionState(seed, cycleKey);
  const raw = input as Partial<MissionState>;
  const active = Array.isArray(raw.active)
    ? raw.active
      .filter(item => item && typeof item === 'object' && typeof item.missionId === 'string' && MISSION_MAP[item.missionId])
      .slice(0, 2)
      .map(item => ({
        missionId: item.missionId!,
        progress: Math.max(0, Math.floor(Number(item.progress) || 0)),
        matchesRemaining: Math.max(0, Math.floor(Number(item.matchesRemaining) || MISSION_MAP[item.missionId!].deadline)),
        acceptedCycleKey: typeof item.acceptedCycleKey === 'string' ? item.acceptedCycleKey : cycleKey,
        ...(typeof item.lastSequenceValue === 'string' ? { lastSequenceValue: item.lastSequenceValue } : {}),
      }))
    : [];
  const boardIds = Array.isArray(raw.boardIds)
    ? raw.boardIds.filter(id => typeof id === 'string' && !!MISSION_MAP[id]).slice(0, 5) as string[]
    : [];
  const history = Array.isArray(raw.history) ? raw.history as MissionHistoryEntry[] : [];
  const processedMatchKeys = Array.isArray(raw.processedMatchKeys)
    ? raw.processedMatchKeys.filter(key => typeof key === 'string').slice(-32) as string[]
    : [];
  const rawResolution = raw.missionResolution;
  const missionResolution = rawResolution && typeof rawResolution === 'object'
    && typeof rawResolution.matchKey === 'string'
    ? {
        matchKey: rawResolution.matchKey,
        completed: Array.isArray(rawResolution.completed)
          ? rawResolution.completed.filter(id => typeof id === 'string' && !!MISSION_MAP[id])
          : [],
        expired: Array.isArray(rawResolution.expired)
          ? rawResolution.expired.filter(id => typeof id === 'string' && !!MISSION_MAP[id])
          : [],
      }
    : null;
  const normalized: MissionState = {
    version: 1,
    seed: typeof raw.seed === 'string' && raw.seed.length > 0 && raw.seed.length <= 200 ? raw.seed : seed,
    cycleKey: typeof raw.cycleKey === 'string' ? raw.cycleKey : cycleKey,
    boardIds,
    active,
    history,
    processedMatchKeys,
    missionResolution,
    ...(typeof raw.rerollUsedCycleKey === 'string' ? { rerollUsedCycleKey: raw.rerollUsedCycleKey } : {}),
  };
  if (hasValidBoard(normalized.boardIds)) return normalized;
  const nextBoard = buildBoard(normalized.seed ?? seed, cycleKey);
  return {
    ...normalized,
    cycleKey,
    boardIds: nextBoard,
  };
}

export function rotateMissionBoard(state: MissionState, seed: string, cycleKey: string): MissionState {
  const campaignSeed = state.seed ?? seed;
  if (state.cycleKey === cycleKey && hasValidBoard(state.boardIds)) {
    return { ...state, seed: campaignSeed };
  }
  const boardIds = buildBoard(campaignSeed, cycleKey);
  return {
    ...state,
    seed: campaignSeed,
    cycleKey,
    boardIds,
    rerollUsedCycleKey: undefined,
  };
}

export function canRerollMissionBoard(state: MissionState, missionsProjectLevel = 1): boolean {
  return missionsProjectLevel >= 2
    && state.rerollUsedCycleKey !== state.cycleKey;
}

/**
 * Replaces the offers once per cycle after the Missions Core reaches level 2.
 * It draws five different missions, excluding only the offers visible now.
 */
export function rerollMissionBoard(
  state: MissionState,
  seed: string,
  missionsProjectLevel = 1,
): MissionState | null {
  if (!canRerollMissionBoard(state, missionsProjectLevel)) return null;
  const campaignSeed = state.seed ?? seed;
  const boardIds = buildBoard(campaignSeed, `${state.cycleKey}:reroll`, new Set(state.boardIds));
  return boardIds.length > 0
    ? {
        ...state,
        seed: campaignSeed,
        boardIds,
        rerollUsedCycleKey: state.cycleKey,
      }
    : null;
}

export function acceptMission(state: MissionState, missionId: string, missionsProjectLevel = 1): MissionState | null {
  const definition = MISSION_MAP[missionId];
  if (!definition || !state.boardIds.includes(missionId)) return null;
  if (state.active.length >= 2 || state.active.some(active => active.missionId === missionId)) return null;
  if (state.history.some(history => history.missionId === missionId && history.cycleKey === state.cycleKey)) return null;
  return {
    ...state,
    active: [...state.active, {
      missionId,
      progress: 0,
      matchesRemaining: missionDeadline(missionId, missionsProjectLevel),
      acceptedCycleKey: state.cycleKey,
    }],
  };
}

/**
 * A level-4 purchase takes effect immediately. If missions were already
 * active when the upgrade was bought, they receive the same extra match as
 * missions accepted afterwards; level 4 is therefore not dependent on the
 * timing of a shop visit.
 */
export function extendActiveMissionDeadlines(
  state: MissionState,
  previousProjectLevel: number,
  nextProjectLevel: number,
): MissionState {
  if (previousProjectLevel >= 4 || nextProjectLevel < 4) return state;
  return {
    ...state,
    active: state.active.map(active => ({
      ...active,
      matchesRemaining: active.matchesRemaining + 1,
    })),
  };
}

export function removeMission(
  state: MissionState,
  missionId: string,
  points: number,
  missionsProjectLevel = 1,
): { state: MissionState; cost: number } | null {
  const active = state.active.find(item => item.missionId === missionId);
  if (!active) return null;
  const cost = missionRemovalCost(missionId, missionsProjectLevel);
  if (!Number.isFinite(cost) || points < cost) return null;
  return {
    cost,
    state: {
      ...state,
      active: state.active.filter(item => item.missionId !== missionId),
      history: [...state.history, { missionId, outcome: 'removed' as const, reward: 0, cycleKey: state.cycleKey }],
    },
  };
}

export function dismissMissionResolution(state: MissionState): MissionState {
  if (!state.missionResolution) return state;
  return { ...state, missionResolution: null };
}

export function missionCycleKey(phase: 'league' | 'knockout', leagueRound: number, knockoutRound?: string, knockoutLeg?: number): string {
  return phase === 'league'
    ? `L${Math.max(1, leagueRound)}`
    : `K:${knockoutRound ?? 'round16'}:${knockoutLeg ?? 1}`;
}

const SPECIAL_TRAIT_KEYS: Array<keyof PlayerCard> = [
  'inForm', 'lobo', 'coringa', 'nomade', 'pilar', 'martir', 'idolo', 'decimoHomem',
  'pipoqueiro', 'noe', 'forasteiro', 'colecionador', 'estribado', 'todosPorUm',
  'capitaoNato', 'magnata', 'fragil', 'prodigio', 'resiliente', 'goleador', 'garcom', 'arrogante',
];

function specialCarded(player: PlayerCard): boolean {
  return SPECIAL_TRAIT_KEYS.some(key => Boolean(player[key]));
}

function startingPlayers(team: Team, result: MatchResult): PlayerCard[] {
  const ids = result.homeTeamId === team.id ? result.startingLineups?.home : result.startingLineups?.away;
  const source = ids?.length ? ids : team.players.slice(0, 11).map(player => player.id);
  return source.map(id => team.players.find(player => player.id === id)).filter((player): player is PlayerCard => !!player);
}

function statsForTeam(result: MatchResult, teamId: string): MissionMatchContext['playerStats'] {
  const output: MissionMatchContext['playerStats'] = {};
  Object.values(result.playerStats ?? {}).forEach(stat => {
    if (stat.teamId !== teamId) return;
    output[stat.playerId] = {
      goals: stat.goals ?? 0,
      assists: stat.assists ?? 0,
      shots: stat.shots ?? 0,
      saves: stat.saves ?? 0,
      yellowCards: stat.yellowCards ?? 0,
      redCards: stat.redCards ?? 0,
    };
  });
  return output;
}

export function createMissionMatchContext(team: Team, opponent: Team, result: MatchResult): MissionMatchContext | null {
  if (result.homeTeamId !== team.id && result.awayTeamId !== team.id) return null;
  const home = result.homeTeamId === team.id;
  const starters = startingPlayers(team, result);
  const starterIds = new Set(starters.map(player => player.id));
  // Results from the authoritative simulator always include these fields, but
  // old persisted snapshots and lightweight replay fixtures may omit them.
  // Normalize at the boundary so mission evaluation remains total and never
  // crashes while rebuilding a legacy state.
  const stats = result.stats ?? {
    homePos: 0,
    awayPos: 0,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeFouls: 0,
    awayFouls: 0,
    homeSaves: 0,
    awaySaves: 0,
    homeCorners: 0,
    awayCorners: 0,
  };
  const safeResult = result.events && result.stats === stats
    ? result
    : { ...result, events: result.events ?? [], stats };
  return {
    result: safeResult,
    team,
    opponent,
    teamId: team.id,
    scoreFor: home ? result.homeGoals : result.awayGoals,
    scoreAgainst: home ? result.awayGoals : result.homeGoals,
    isWin: result.winner === team.id || (home ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals),
    isDraw: result.homeGoals === result.awayGoals && !result.penaltyWinner,
    isRegulation: (result.durationMinutes ?? 90) <= 90 && !result.penaltyWinner,
    chemistry: team.totalChemistry ?? 0,
    formationId: team.formationId,
    playStyle: team.playStyle,
    coachPrime: team.coachPrime === true,
    starters,
    bench: team.players.filter(player => !starterIds.has(player.id)),
    starterIds,
    teamStats: home
      ? { possession: stats.homePos, shots: stats.homeShots, shotsOnTarget: stats.homeShotsOnTarget, saves: stats.homeSaves, corners: stats.homeCorners, fouls: stats.homeFouls }
      : { possession: stats.awayPos, shots: stats.awayShots, shotsOnTarget: stats.awayShotsOnTarget, saves: stats.awaySaves, corners: stats.awayCorners, fouls: stats.awayFouls },
    opponentStats: home
      ? { possession: stats.awayPos, shots: stats.awayShots, shotsOnTarget: stats.awayShotsOnTarget, saves: stats.awaySaves, corners: stats.awayCorners, fouls: stats.awayFouls }
      : { possession: stats.homePos, shots: stats.homeShots, shotsOnTarget: stats.homeShotsOnTarget, saves: stats.homeSaves, corners: stats.homeCorners, fouls: stats.homeFouls },
    playerStats: statsForTeam(result, team.id),
  };
}

function goalEvents(context: MissionMatchContext) {
  return context.result.events
    .filter(event => event.type === 'goal' && event.teamId === context.teamId)
    .sort((a, b) => a.minute - b.minute);
}

function allGoalEvents(context: MissionMatchContext) {
  return context.result.events
    .filter(event => event.type === 'goal' && (event.teamId === context.teamId || event.teamId === context.opponent.id))
    .sort((a, b) => a.minute - b.minute);
}

function opponentRed(context: MissionMatchContext): boolean {
  return context.result.events.some(event => event.type === 'red' && event.teamId === context.opponent.id);
}

function teamCards(context: MissionMatchContext): number {
  return Object.values(context.playerStats).reduce((total, stat) => total + stat.yellowCards + stat.redCards, 0)
    + context.result.events.filter(event => (event.type === 'yellow' || event.type === 'red') && event.teamId === context.teamId).length;
}

function wasBehindBy(context: MissionMatchContext, margin: number): boolean {
  let own = 0;
  let opponent = 0;
  const events = context.result.events.filter(event => event.type === 'goal' && (event.teamId === context.teamId || event.teamId === context.opponent.id)).sort((a, b) => a.minute - b.minute);
  for (const event of events) {
    if (event.teamId === context.teamId) own++;
    else opponent++;
    if (opponent - own >= margin) return true;
  }
  return false;
}

function wasLosingAtHalf(context: MissionMatchContext): boolean {
  let own = 0;
  let opponent = 0;
  context.result.events
    .filter(event => event.type === 'goal' && event.minute <= 45 && (event.teamId === context.teamId || event.teamId === context.opponent.id))
    .sort((a, b) => a.minute - b.minute)
    .forEach(event => { if (event.teamId === context.teamId) own++; else opponent++; });
  return opponent > own;
}

function wasWinningAtHalf(context: MissionMatchContext): boolean {
  let own = 0;
  let opponent = 0;
  context.result.events
    .filter(event => event.type === 'goal' && event.minute <= 45 && (event.teamId === context.teamId || event.teamId === context.opponent.id))
    .sort((a, b) => a.minute - b.minute)
    .forEach(event => { if (event.teamId === context.teamId) own++; else opponent++; });
  return own > opponent;
}

function wasLevelAtHalf(context: MissionMatchContext): boolean {
  let own = 0;
  let opponent = 0;
  allGoalEvents(context)
    .filter(event => event.minute <= 45)
    .forEach(event => { if (event.teamId === context.teamId) own++; else opponent++; });
  return own === opponent;
}

function wasLosingAfterMinute(context: MissionMatchContext, minute: number): boolean {
  let own = 0;
  let opponent = 0;
  const allGoals = allGoalEvents(context);
  for (const event of allGoals) {
    // The team may already be behind when the cutoff passes. Check the score
    // before a later goal as well as after it, rather than only observing goals
    // that happened after the cutoff.
    if (event.minute > minute && opponent > own) return true;
    if (event.teamId === context.teamId) own++; else opponent++;
    if (event.minute > minute && opponent > own) return true;
  }
  return false;
}

function isOutsideNaturalPositions(player: PlayerCard, role: string): boolean {
  // Coringa is treated as native by the chemistry engine so it can play
  // anywhere without a chemistry penalty. Missions still need to know whether
  // the occupied role is outside the card's actual primary/secondary positions.
  return positionFit({ position: player.position, secondaryPositions: player.secondaryPositions }, role) === 'off';
}

function goalsInPeriod(context: MissionMatchContext, secondHalf: boolean): number {
  return goalEvents(context).filter(event => secondHalf ? event.minute > 45 : event.minute <= 45).length;
}

function cameFromBehind(context: MissionMatchContext): boolean {
  let own = 0;
  let opponent = 0;
  let wasBehind = false;
  for (const event of context.result.events.filter(event => event.type === 'goal' && (event.teamId === context.teamId || event.teamId === context.opponent.id)).sort((a, b) => a.minute - b.minute)) {
    if (event.teamId === context.teamId) own++; else opponent++;
    if (opponent > own) wasBehind = true;
    if (wasBehind && own > opponent) return true;
  }
  return false;
}

function retookLeadAfterEqualizer(context: MissionMatchContext): boolean {
  let own = 0;
  let opponent = 0;
  let scoredFirst = false;
  let wasEqualized = false;
  for (const event of allGoalEvents(context)) {
    if (event.teamId === context.teamId) own++; else opponent++;
    if (own === 1 && opponent === 0) scoredFirst = true;
    if (scoredFirst && own === opponent && own > 0) wasEqualized = true;
    if (wasEqualized && own > opponent) return true;
  }
  return false;
}

function hasLateLeadGoal(context: MissionMatchContext, minute: number): boolean {
  let own = 0;
  let opponent = 0;
  for (const event of context.result.events.filter(event => event.type === 'goal' && (event.teamId === context.teamId || event.teamId === context.opponent.id)).sort((a, b) => a.minute - b.minute)) {
    const wasNotLeading = own <= opponent;
    if (event.teamId === context.teamId) own++; else opponent++;
    if (event.teamId === context.teamId && event.minute > minute && wasNotLeading && own > opponent) return true;
  }
  return false;
}

function playerWithFlag(context: MissionMatchContext, key: keyof PlayerCard): PlayerCard | undefined {
  return context.starters.find(player => Boolean(player[key]));
}

function traitIsActive(context: MissionMatchContext, key: keyof PlayerCard): boolean {
  if (key === 'noe') {
    const carded = context.starters.filter(specialCarded);
    return carded.length === 1 && Boolean(carded[0]?.noe);
  }
  if (key === 'todosPorUm') return context.starters.length === 11 && context.starters.every(player => player.todosPorUm);
  if (key === 'forasteiro') {
    return context.starters.some(player => player.forasteiro
      && context.starters.filter(other => other.nation === player.nation).length === 1
      && context.starters.filter(other => sameClub(other.club, player.club)).length === 1);
  }
  return activeTraitPlayers(context, key).length > 0;
}

function activeTraitPlayers(context: MissionMatchContext, key: keyof PlayerCard): PlayerCard[] {
  if (key === 'forasteiro') {
    return context.starters.filter(player => player.forasteiro
      && context.starters.filter(other => other.nation === player.nation).length === 1
      && context.starters.filter(other => sameClub(other.club, player.club)).length === 1);
  }
  return context.starters.filter(player => Boolean(player[key]));
}

function playerHasGoalOrAssist(context: MissionMatchContext, playerId: string): boolean {
  const stat = context.playerStats[playerId];
  return Boolean(stat && (stat.goals > 0 || stat.assists > 0));
}

function differentSpecialTraits(context: MissionMatchContext): number {
  return SPECIAL_TRAIT_KEYS.filter(key => context.starters.some(player => Boolean(player[key]))).length;
}

function historicalIdentityIds(player: PlayerCard): string[] {
  return [player.id, player.basePlayerId, player.historicalPlayerId]
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function historicalPairCount(context: MissionMatchContext): number {
  let pairs = 0;
  for (let i = 0; i < context.starters.length; i++) {
    for (let j = i + 1; j < context.starters.length; j++) {
      const first = context.starters[i];
      const second = context.starters[j];
      const firstIds = new Set(historicalIdentityIds(first));
      const secondIds = new Set(historicalIdentityIds(second));
      const linked = (first.historicalPartners ?? []).some(id => secondIds.has(id))
        || (second.historicalPartners ?? []).some(id => firstIds.has(id));
      if (linked) pairs++;
    }
  }
  return pairs;
}

function ruleMatches(definition: MissionDefinition, context: MissionMatchContext): { matched: boolean; sequenceValue?: string } {
  const rule = definition.rule;
  if (!context.isRegulation) return { matched: false };
  const goals = goalEvents(context);
  const starters = context.starters;
  const formation = FORMATIONS.find(item => item.id === context.formationId);
  const coringaOutOfPosition = starters.some((player, index) => {
    const role = formation?.positions[index]?.role;
    return Boolean(role && player.coringa && isOutsideNaturalPositions(player, role));
  });
  const playerGoals = (player: PlayerCard) => context.playerStats[player.id]?.goals ?? 0;
  const playerAssists = (player: PlayerCard) => context.playerStats[player.id]?.assists ?? 0;

  switch (rule.kind) {
    case 'win': return { matched: context.isWin, sequenceValue: rule.valueKey === 'formationId' ? context.formationId : rule.valueKey === 'playStyle' ? context.playStyle : undefined };
    case 'not_loss': return { matched: context.isWin || context.isDraw };
    case 'win_margin': return { matched: context.isWin && context.scoreFor - context.scoreAgainst >= (rule.value ?? 1) };
    case 'win_exact_margin': return { matched: context.isWin && context.scoreFor - context.scoreAgainst === (rule.value ?? 1) };
    case 'win_exact_score': return { matched: context.isWin && context.scoreFor === (rule.value ?? 2) && context.scoreAgainst === Number(rule.values?.[0] ?? 0) };
    case 'held_lead_and_win': {
      const allGoals = allGoalEvents(context);
      const firstGoal = allGoals[0];
      return { matched: context.isWin && firstGoal?.teamId === context.teamId && !allGoals.some(event => event.teamId === context.opponent.id) };
    }
    case 'exact_goals_and_win': return { matched: context.isWin && context.scoreFor === (rule.value ?? 2) };
    case 'first_goal_and_win': {
      const firstGoal = allGoalEvents(context)[0];
      return { matched: context.isWin && firstGoal?.teamId === context.teamId };
    }
    case 'concede_first_and_win': {
      const firstGoal = allGoalEvents(context)[0];
      return { matched: context.isWin && firstGoal?.teamId === context.opponent.id };
    }
    case 'behind_by_and_win': return { matched: context.isWin && wasBehindBy(context, rule.value ?? 2) };
    case 'losing_at_half_and_win': return { matched: context.isWin && wasLosingAtHalf(context) };
    case 'winning_at_half_and_win': return { matched: context.isWin && wasWinningAtHalf(context) };
    case 'second_half_clean_sheet_and_win': return { matched: context.isWin && !allGoalEvents(context).some(event => event.teamId === context.opponent.id && event.minute > 45) };
    case 'level_at_half_and_win': return { matched: context.isWin && wasLevelAtHalf(context) };
    case 'losing_after_minute_and_win': return { matched: context.isWin && wasLosingAfterMinute(context, rule.value ?? 60) };
    case 'first_and_last_goal_and_win': {
      const allGoals = allGoalEvents(context);
      return { matched: context.isWin && allGoals.length > 0 && allGoals[0].teamId === context.teamId && allGoals.at(-1)?.teamId === context.teamId };
    }
    case 'retake_lead_after_equalizer_and_win': return { matched: context.isWin && retookLeadAfterEqualizer(context) };
    case 'come_from_behind_and_win': return { matched: context.isWin && cameFromBehind(context) };
    case 'clean_sheet': return { matched: context.scoreAgainst === 0 };
    case 'clean_sheet_win': return { matched: context.isWin && context.scoreAgainst === 0 };
    case 'late_lead_goal_win': return { matched: context.isWin && hasLateLeadGoal(context, rule.value ?? 75) };
    case 'opponent_red_and_win': return { matched: context.isWin && opponentRed(context) };
    case 'goal_before': return { matched: goals.some(event => event.minute < (rule.value ?? 20)) };
    case 'goals_before': return { matched: goals.filter(event => event.minute < Number(rule.values?.[0] ?? 30)).length >= (rule.value ?? 2) };
    case 'goals_at_least': return { matched: context.scoreFor >= (rule.value ?? 1) };
    case 'player_goals': return { matched: starters.some(player => playerGoals(player) >= (rule.value ?? 1)) };
    case 'goals_within': return { matched: goals.some((event, index) => index > 0 && event.minute - goals[index - 1].minute <= (rule.value ?? 10)) };
    case 'different_scorers': return { matched: starters.filter(player => playerGoals(player) > 0).length >= (rule.value ?? 3) };
    case 'early_and_late_goal': return { matched: goals.some(event => event.minute < (rule.value ?? 20)) && goals.some(event => event.minute > Number(rule.values?.[0] ?? 75)) };
    case 'goals_at_least_and_win': return { matched: context.isWin && context.scoreFor >= (rule.value ?? 3) };
    case 'goals_and_clean_sheet_win': return { matched: context.isWin && context.scoreFor >= (rule.value ?? 3) && context.scoreAgainst === 0 };
    case 'goals_in_both_halves_and_win': return { matched: context.isWin && goalsInPeriod(context, false) > 0 && goalsInPeriod(context, true) > 0 };
    case 'second_half_goals_and_win': return { matched: context.isWin && goalsInPeriod(context, true) >= (rule.value ?? 2) };
    case 'second_half_goals_after_and_win': return { matched: context.isWin && goals.filter(event => event.minute > Number(rule.values?.[0] ?? 75)).length >= (rule.value ?? 2) };
    case 'goals_in_time_blocks_and_win': return {
      matched: context.isWin
        && goals.some(event => event.minute >= 1 && event.minute <= 30)
        && goals.some(event => event.minute >= 31 && event.minute <= 60)
        && goals.some(event => event.minute >= 61 && event.minute <= 90),
    };
    case 'position_goal_and_win': return { matched: context.isWin && starters.some(player => rule.values?.includes(getPositionGroup(player.position)) && playerGoals(player) > 0) };
    case 'position_scorers_and_win': return { matched: context.isWin && starters.filter(player => rule.values?.includes(getPositionGroup(player.position)) && playerGoals(player) > 0).length >= (rule.value ?? 2) };
    case 'position_groups_goal_and_win': return { matched: context.isWin && (rule.values ?? []).every(group => starters.some(player => getPositionGroup(player.position) === group && playerGoals(player) > 0)) };
    case 'first_half_goals_and_win': return { matched: context.isWin && goalsInPeriod(context, false) >= (rule.value ?? 2) };
    case 'same_half_goals_and_win': return { matched: context.isWin && Math.max(goalsInPeriod(context, false), goalsInPeriod(context, true)) >= (rule.value ?? 3) };
    case 'both_halves_min_goals_and_win': return { matched: context.isWin && goalsInPeriod(context, false) >= (rule.value ?? 2) && goalsInPeriod(context, true) >= (rule.value ?? 2) };
    case 'different_assistors': return { matched: starters.filter(player => playerAssists(player) > 0).length >= (rule.value ?? 3) };
    case 'different_assistors_and_win': return { matched: context.isWin && starters.filter(player => playerAssists(player) > 0).length >= (rule.value ?? 2) };
    case 'player_assists_and_win': return { matched: context.isWin && starters.some(player => playerAssists(player) >= (rule.value ?? 2)) };
    case 'player_goal_and_assist': return { matched: starters.some(player => playerGoals(player) > 0 && playerAssists(player) > 0) };
    case 'possession_and_win': return { matched: context.isWin && context.teamStats.possession >= (rule.value ?? 60) };
    case 'low_possession_and_win': return { matched: context.isWin && context.teamStats.possession <= (rule.value ?? 35) };
    case 'shots_and_win': return { matched: context.isWin && context.teamStats.shots >= (rule.value ?? 10) };
    case 'shots_on_target': return { matched: context.teamStats.shotsOnTarget >= (rule.value ?? 6) };
    case 'corners': return { matched: context.teamStats.corners >= (rule.value ?? 10) };
    case 'corners_and_win': return { matched: context.isWin && context.teamStats.corners >= (rule.value ?? 5) };
    case 'saves_and_win': return { matched: context.isWin && context.teamStats.saves >= (rule.value ?? 5) };
    case 'no_cards_and_win': return { matched: context.isWin && teamCards(context) === 0 };
    case 'concede_fewer_fouls_and_win': return { matched: context.isWin && context.scoreAgainst <= (rule.value ?? 1) && context.teamStats.fouls < context.opponentStats.fouls };
    case 'goals_and_shots_limit_win': return { matched: context.isWin && context.scoreFor >= (rule.value ?? 3) && context.teamStats.shots <= Number(rule.values?.[0] ?? 12) };
    case 'shots_min_and_more_and_win': return { matched: context.isWin && context.teamStats.shots >= (rule.value ?? 12) && context.teamStats.shots > context.opponentStats.shots };
    case 'goals_and_no_cards_win': return { matched: context.isWin && context.scoreFor >= (rule.value ?? 2) && teamCards(context) === 0 };
    case 'opponent_shots_on_target_and_win': return { matched: context.isWin && context.opponentStats.shotsOnTarget <= (rule.value ?? 3) };
    case 'more_shots_and_win': return { matched: context.isWin && context.teamStats.shots > context.opponentStats.shots };
    case 'more_shots_on_target_and_win': return { matched: context.isWin && context.teamStats.shotsOnTarget > context.opponentStats.shotsOnTarget };
    case 'more_corners_and_win': return { matched: context.isWin && context.teamStats.corners > context.opponentStats.corners };
    case 'possession_and_shots_win': return { matched: context.isWin && context.teamStats.possession >= (rule.value ?? 60) && context.teamStats.shots > context.opponentStats.shots };
    case 'play_style_and_win': return { matched: context.isWin && context.playStyle === rule.values?.[0] };
    case 'play_style_possession_win': return { matched: context.isWin && context.playStyle === rule.values?.[0] && context.teamStats.possession >= (rule.value ?? 55) };
    case 'play_style_concede_and_win': return { matched: context.isWin && context.playStyle === rule.values?.[0] && context.scoreAgainst <= (rule.value ?? 1) };
    case 'play_style_goals_and_win': return { matched: context.isWin && context.playStyle === rule.values?.[0] && context.scoreFor >= (rule.value ?? 3) };
    case 'tactic_trigger_and_win': return { matched: context.isWin && context.result.events.some(event => event.type === 'tactic' && event.teamId === context.teamId && event.tacticAction) };
    case 'tactic_triggers_and_win': {
      const actions = new Set(context.result.events
        .filter(event => event.type === 'tactic' && event.teamId === context.teamId && event.tacticAction)
        .map(event => event.tacticAction));
      return { matched: context.isWin && actions.size >= (rule.value ?? 2) };
    }
    case 'preferred_formation_and_win': return { matched: context.isWin && COACHES.find(coach => coach.id === context.team.coachId)?.preferredFormation === context.formationId };
    case 'preferred_formation_chemistry_and_win': return { matched: context.isWin && COACHES.find(coach => coach.id === context.team.coachId)?.preferredFormation === context.formationId && context.chemistry >= (rule.value ?? 80) };
    case 'formation_and_win': return { matched: context.isWin && Boolean(rule.values?.includes(context.formationId)) };
    case 'formation_play_style_and_win': return { matched: context.isWin && context.formationId === rule.values?.[0] && context.playStyle === rule.values?.[1] };
    case 'formation_possession_and_win': return { matched: context.isWin && Boolean(rule.values?.includes(context.formationId)) && context.teamStats.possession >= (rule.value ?? 55) };
    case 'formation_goals_and_win': return { matched: context.isWin && Boolean(rule.values?.includes(context.formationId)) && context.scoreFor >= (rule.value ?? 3) };
    case 'formation_concede_and_win': return { matched: context.isWin && Boolean(rule.values?.includes(context.formationId)) && context.scoreAgainst <= (rule.value ?? 1) };
    case 'formation_opponent_shots_and_win': return { matched: context.isWin && Boolean(rule.values?.includes(context.formationId)) && context.opponentStats.shots <= (rule.value ?? 6) };
    case 'formation_tactic_goals_and_win': return { matched: context.isWin && context.formationId === rule.values?.[0] && context.playStyle === rule.values?.[1] && context.scoreFor >= (rule.value ?? 3) };
    case 'formation_counter_and_win': return { matched: context.isWin && Boolean(FORMATIONS.find(formation => formation.id === context.formationId)?.counters.includes(context.opponent.formationId)) };
    case 'chemistry_and_win': return { matched: context.isWin && context.chemistry >= (rule.value ?? 80) };
    case 'chemistry_max_and_win': return { matched: context.isWin && context.chemistry <= (rule.value ?? 10) };
    case 'chemistry_range_and_win': return { matched: context.isWin && context.chemistry >= (rule.value ?? 70) && context.chemistry <= Number(rule.values?.[0] ?? 79) };
    case 'all_compatible_and_win': return { matched: context.isWin && context.starters.every(player => !player.isOOP) };
    case 'secondary_positions_and_win': {
      // `isSecondary` is stamped by the squad/chemistry pipeline in current games;
      // the fallback calculates it from the occupied formation role for old rooms.
      const calculated = calculateChemistry(context.starters, context.team.coachId, formation?.positions.map(position => position.role), context.formationId);
      const fallbackCount = formation?.positions.reduce((total, role, index) => {
        const player = context.starters[index];
        return total + (player && !calculated.outOfPosition[player.id] && calculated.secondaryPos[player.id] ? 1 : 0);
      }, 0) ?? 0;
      return { matched: context.isWin && fallbackCount >= (rule.value ?? 3) };
    }
    case 'coringa_secondary_and_win': {
      const calculated = calculateChemistry(context.starters, context.team.coachId, formation?.positions.map(position => position.role), context.formationId);
      const secondaryCount = formation?.positions.reduce((total, role, index) => {
        const player = context.starters[index];
        return total + (player && !player.coringa && !calculated.outOfPosition[player.id] && calculated.secondaryPos[player.id] ? 1 : 0);
      }, 0) ?? 0;
      return { matched: context.isWin && coringaOutOfPosition && secondaryCount >= (rule.value ?? 2) };
    }
    case 'captain_goal_or_assist_win': return { matched: context.isWin && !!context.team.captain && playerHasGoalOrAssist(context, context.team.captain) };
    case 'prime_coach_and_win': return { matched: context.isWin && context.coachPrime };
    case 'historical_trio_and_win': {
      const starterHistoricalIds = new Set(context.starters.flatMap(historicalIdentityIds));
      return { matched: context.isWin && HISTORICAL_TRIOS.some(trio => trio.playerIds.every(id => starterHistoricalIds.has(id))) };
    }
    case 'historical_pairs_and_win': return { matched: context.isWin && historicalPairCount(context) >= (rule.value ?? 2) };
    case 'same_nation_and_win': return { matched: context.isWin && new Set(starters.map(player => player.nation)).size < starters.length && starters.some(player => starters.filter(other => other.nation === player.nation).length >= (rule.value ?? 4)) };
    case 'distinct_nations_and_win': return { matched: context.isWin && new Set(starters.map(player => player.nation)).size >= (rule.value ?? 7) };
    case 'no_specials_and_win': return { matched: context.isWin && starters.every(player => !specialCarded(player)) };
    case 'special_variety_and_win': return { matched: context.isWin && differentSpecialTraits(context) >= (rule.value ?? 4) };
    case 'same_club_and_win': return { matched: context.isWin && starters.some(player => starters.filter(other => sameClub(other.club, player.club)).length >= (rule.value ?? 5)) };
    case 'bench_size_and_win': return { matched: context.isWin && context.bench.length >= (rule.value ?? 10) };
    case 'in_form_and_win': return { matched: context.isWin && starters.some(player => player.inForm) };
    case 'trait_player_goals_and_win': {
      const traitKey = rule.values?.[0] as keyof PlayerCard | undefined;
      return { matched: context.isWin && !!traitKey && starters.some(player => Boolean(player[traitKey]) && playerGoals(player) >= (rule.value ?? 2)) };
    }
    case 'trait_player_assists_and_win': {
      const traitKey = rule.values?.[0] as keyof PlayerCard | undefined;
      return { matched: context.isWin && !!traitKey && activeTraitPlayers(context, traitKey).some(player => playerAssists(player) >= (rule.value ?? 1)) };
    }
    case 'in_form_count_and_win': return { matched: context.isWin && starters.filter(player => player.inForm).length >= (rule.value ?? 2) };
    case 'pilar_in_form_and_win': return { matched: context.isWin && starters.some(player => player.pilar) && starters.some(player => player.inForm) };
    case 'twelfth_man_scorers_and_win': return { matched: context.isWin && context.bench.some(player => player.decimoHomem) && starters.filter(player => playerGoals(player) > 0).length >= (rule.value ?? 3) };
    case 'collector_twelfth_and_win': return { matched: context.isWin && starters.some(player => player.colecionador) && context.bench.some(player => player.decimoHomem) };
    case 'magnata_estribado_and_win': return { matched: context.isWin && starters.some(player => player.magnata) && starters.some(player => player.estribado) && (context.team.credits ?? 0) >= (rule.value ?? 500) };
    case 'capitao_nato_goal_or_assist_and_win': {
      const captain = context.team.captain ? starters.find(player => player.id === context.team.captain) : undefined;
      return { matched: context.isWin && Boolean(captain?.capitaoNato) && playerHasGoalOrAssist(context, captain!.id) };
    }
    case 'fragil_goals_and_win': return { matched: context.isWin && starters.some(player => player.fragil && !context.result.events.some(event => event.type === 'injury' && event.teamId === context.teamId && event.playerId === player.id) && playerGoals(player) >= (rule.value ?? 2)) };
    case 'resiliente_goals_and_win': return { matched: context.isWin && context.scoreFor >= (rule.value ?? 3) && starters.some(player => player.resiliente) };
    case 'lobo_chemistry_possession_and_win': return { matched: context.isWin && starters.some(player => player.lobo) && context.chemistry <= (rule.value ?? 40) && context.teamStats.possession >= Number(rule.values?.[0] ?? 60) };
    case 'nomade_chemistry_and_win': return { matched: context.isWin && starters.some(player => player.nomade) && context.chemistry >= (rule.value ?? 70) };
    case 'forasteiro_clean_sheet_and_win': return { matched: context.isWin && activeTraitPlayers(context, 'forasteiro').length > 0 && context.scoreAgainst === 0 };
    case 'in_form_prodigy_goal_assist_and_win': return { matched: context.isWin && starters.some(player => player.inForm && playerGoals(player) > 0) && starters.some(player => player.prodigio && playerAssists(player) > 0) };
    case 'arrogante_garcom_goal_assist_and_win': return { matched: context.isWin && starters.some(player => player.arrogante && playerGoals(player) > 0) && starters.some(player => player.garcom && playerAssists(player) > 0) };
    case 'martir_idolo_and_win': return { matched: context.isWin && starters.some(player => player.martir) && starters.some(player => player.idolo) };
    case 'twelfth_man_chemistry_and_win': return { matched: context.isWin && context.bench.some(player => player.decimoHomem) && context.chemistry >= (rule.value ?? 80) };
    case 'all_rarities_and_win': return { matched: context.isWin && (rule.values ?? []).every(rarity => starters.some(player => player.rarity === rarity)) };
    case 'rarity_count_and_win': return { matched: context.isWin && starters.filter(player => rule.values?.includes(player.rarity)).length >= (rule.value ?? 1) };
    case 'rarity_exact_count_and_win': return { matched: context.isWin && starters.filter(player => rule.values?.includes(player.rarity)).length === (rule.value ?? 1) };
    case 'distinct_trait_scorers_and_win': {
      const traitKey = rule.values?.[0] as keyof PlayerCard | undefined;
      return { matched: context.isWin && !!traitKey && activeTraitPlayers(context, traitKey).filter(player => playerGoals(player) > 0).length >= (rule.value ?? 2) };
    }
    case 'trait_combo_goal_assist_and_win': {
      const assistKey = rule.values?.[0] as keyof PlayerCard | undefined;
      const goalKey = rule.values?.[1] as keyof PlayerCard | undefined;
      return { matched: context.isWin && !!assistKey && !!goalKey && activeTraitPlayers(context, assistKey).some(player => playerAssists(player) > 0) && activeTraitPlayers(context, goalKey).some(player => playerGoals(player) > 0) };
    }
    case 'trait_player_goal_and_win': {
      const traitKey = rule.values?.[0] as keyof PlayerCard | undefined;
      return { matched: context.isWin && !!traitKey && activeTraitPlayers(context, traitKey).some(player => playerGoals(player) > 0) };
    }
    case 'trait_player_goal_or_assist_and_win': {
      const traitKey = rule.values?.[0] as keyof PlayerCard | undefined;
      return { matched: context.isWin && !!traitKey && activeTraitPlayers(context, traitKey).some(player => playerHasGoalOrAssist(context, player.id)) };
    }
    case 'coringa_lobo_and_win': return { matched: context.isWin && starters.some(player => player.coringa) && starters.some(player => player.lobo) };
    case 'noe_active': return { matched: traitIsActive(context, 'noe') };
    case 'noe_and_win': return { matched: context.isWin && traitIsActive(context, 'noe') };
    case 'noe_clean_sheet_and_win': return { matched: context.isWin && traitIsActive(context, 'noe') && context.scoreAgainst === 0 };
    case 'todos_por_um_active': return { matched: traitIsActive(context, 'todosPorUm') };
    case 'twelfth_man_bench': return { matched: context.bench.some(player => player.decimoHomem) };
    case 'twelfth_man_bench_and_win': return { matched: context.isWin && context.bench.some(player => player.decimoHomem) };
    case 'goleador_goals': return { matched: starters.some(player => player.goleador && playerGoals(player) >= (rule.value ?? 3)) };
    case 'garcom_assists': return { matched: starters.some(player => player.garcom && playerAssists(player) >= (rule.value ?? 2)) };
    case 'magnata_and_win': return { matched: context.isWin && starters.some(player => player.magnata) };
    case 'pipoqueiro_and_win': return { matched: context.isWin && starters.some(player => player.pipoqueiro) };
    case 'coringa_oop_and_win': return { matched: context.isWin && coringaOutOfPosition };
    case 'pilar_chemistry_and_win': return { matched: context.isWin && starters.some(player => player.pilar) && context.chemistry >= (rule.value ?? 80) };
    case 'pilar_clean_sheet_and_win': return { matched: context.isWin && starters.some(player => player.pilar) && context.scoreAgainst === 0 };
    case 'lobo_chemistry_and_win': return { matched: context.isWin && starters.some(player => player.lobo) && context.chemistry <= (rule.value ?? 40) };
    case 'nomade_and_win': return { matched: context.isWin && starters.some(player => player.nomade) };
    case 'forasteiro_and_win': return { matched: context.isWin && traitIsActive(context, 'forasteiro') };
    case 'martir_active': return { matched: starters.some(player => player.martir) };
    case 'idolo_and_win': return { matched: context.isWin && starters.some(idol => idol.idolo && starters.filter(other => other.id !== idol.id && sameClub(other.club, idol.club)).length >= (rule.value ?? 3)) };
    case 'collector_bench_and_win': return { matched: context.isWin && starters.some(player => player.colecionador) && context.bench.length >= (rule.value ?? 5) };
    case 'estribado_credits_and_win': return { matched: context.isWin && starters.some(player => player.estribado) && (context.team.credits ?? 0) >= (rule.value ?? 500) };
    case 'capitao_nato_and_win': return { matched: context.isWin && !!context.team.captain && starters.some(player => player.id === context.team.captain && player.capitaoNato) };
    case 'fragil_and_win': return { matched: context.isWin && starters.some(player => player.fragil && !context.result.events.some(event => event.type === 'injury' && event.teamId === context.teamId && event.playerId === player.id)) };
    case 'fragil_heroic_and_win': return { matched: context.isWin && starters.some(player => player.fragil && !context.result.events.some(event => event.type === 'injury' && event.teamId === context.teamId && event.playerId === player.id) && playerHasGoalOrAssist(context, player.id)) };
    case 'resiliente_and_win': return { matched: context.isWin && starters.some(player => player.resiliente && (player.resilienteDefeats ?? 0) > 0) };
    case 'resiliente_comeback_win': return { matched: context.isWin && cameFromBehind(context) && starters.some(player => player.resiliente && (player.resilienteDefeats ?? 0) > 0) };
    case 'arrogante_goals_and_win': return { matched: context.isWin && starters.some(player => player.arrogante && playerGoals(player) >= (rule.value ?? 2)) };
    default: return { matched: false };
  }
}

export interface MissionUpdateResult {
  state: MissionState;
  reward: number;
  completed: string[];
  expired: string[];
}

export function updateMissionsAfterMatch(
  input: MissionState,
  context: MissionMatchContext,
  matchKey: string,
  missionsProjectLevel = 1,
): MissionUpdateResult {
  if (input.processedMatchKeys.includes(matchKey)) return { state: input, reward: 0, completed: [], expired: [] };
  let reward = 0;
  const completed: string[] = [];
  const expired: string[] = [];
  const nextActive: ActiveMission[] = [];
  const nextHistory = [...input.history];

  input.active.forEach(active => {
    const definition = MISSION_MAP[active.missionId];
    if (!definition) return;
    const result = ruleMatches(definition, context);
    let progress = active.progress;
    let sequenceValue = active.lastSequenceValue;
    if (definition.mode === 'single') {
      progress = result.matched ? 1 : 0;
    } else if (definition.mode === 'accumulate') {
      if (result.matched) progress += 1;
    } else if (definition.mode === 'streak') {
      if (!result.matched) {
        progress = 0;
        sequenceValue = undefined;
      } else if (result.sequenceValue && sequenceValue) {
        const sameValue = result.sequenceValue === sequenceValue;
        if (definition.rule.sequenceMode === 'same') {
          progress = sameValue ? progress + 1 : 1;
        } else {
          // The original sequence missions require a different value each
          // time (formation/tactic chameleon). Keep that behavior explicit.
          progress = sameValue ? 1 : progress + 1;
        }
        sequenceValue = result.sequenceValue;
      } else {
        progress += 1;
        sequenceValue = result.sequenceValue ?? sequenceValue;
      }
    }

    if (progress >= definition.target) {
      const completedReward = missionReward(definition.id, missionsProjectLevel);
      reward += completedReward;
      completed.push(definition.id);
      nextHistory.push({ missionId: definition.id, outcome: 'completed', matchKey, reward: completedReward, cycleKey: input.cycleKey });
      return;
    }

    const matchesRemaining = active.matchesRemaining - 1;
    if (matchesRemaining <= 0) {
      expired.push(definition.id);
      nextHistory.push({ missionId: definition.id, outcome: 'expired', matchKey, reward: 0, cycleKey: input.cycleKey });
      return;
    }
    nextActive.push({ ...active, progress, matchesRemaining, ...(sequenceValue ? { lastSequenceValue: sequenceValue } : {}) });
  });

  return {
    state: {
      ...input,
      active: nextActive,
      history: nextHistory,
      processedMatchKeys: [...input.processedMatchKeys, matchKey].slice(-32),
      missionResolution: completed.length > 0 || expired.length > 0
        ? { matchKey, completed: [...completed], expired: [...expired] }
        : input.missionResolution,
    },
    reward,
    completed,
    expired,
  };
}

