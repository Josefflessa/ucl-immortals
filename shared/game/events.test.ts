import { describe, expect, it } from 'vitest';
import type { CareerCompetition } from './achievements';
import { evaluateGameEvent, GAME_EVENT_BY_ID, NEYMAR_CARD_IDS } from './events';
import { ALL_UNIQUE_CARDS, PLAYERS } from './gameData';

const event = GAME_EVENT_BY_ID.get('neymar-2026')!;

function competition(patch: Partial<CareerCompetition> = {}): CareerCompetition {
  return {
    difficultyId: 'gold', mode: 'solo', finishStage: 'champion', champion: true,
    wins: 7, draws: 1, losses: 0, games: 8, goals: 20, goalsAgainst: 5, humanPlayers: null,
    coachId: null, crestId: null, completedAt: event.startsAt + 1000, rankingPoints: 0,
    topPlayerGoals: 0, topPlayerAssists: 0, topKeeperSaves: 0, topPlayerOverall: 0,
    finalStarterIds: ['neymar_psg', 'messi'],
    ...patch,
  };
}

describe('evento O Príncipe (Neymar)', () => {
  it('dá a Única do Neymar no Barcelona, que existe entre as Únicas de evento', () => {
    expect(event.rewardCardId).toBe('neymar_barca_unico');
    expect(ALL_UNIQUE_CARDS.some(card => card.id === 'neymar_barca_unico' && card.club === 'Barcelona')).toBe(true);
  });

  it('conta só títulos no Ouro ou acima com um Neymar entre os titulares da final', () => {
    const counted = evaluateGameEvent(event, [
      competition(),
      competition({ difficultyId: 'immortal', finalStarterIds: ['neymar_unico'] }),
      competition({ difficultyId: 'silver' }),                              // abaixo do Ouro
      competition({ champion: false, finishStage: 'runnerUp' }),            // perdeu a final
      competition({ finalStarterIds: ['messi', 'suarez'] }),                // sem Neymar na final
      competition({ finalStarterIds: [] }),                                 // sem final registrada
      competition({ completedAt: event.startsAt - 1 }),                     // antes do evento
    ]);
    expect(counted.objectives[0].progress).toBe(2);
    expect(counted.completed).toBe(false);
  });

  it('completa com 4 títulos válidos', () => {
    const career = ['neymar', 'neymar_santos', 'neymar_al_hilal_2023_24', 'neymar_barca_unico']
      .map(id => competition({ finalStarterIds: [id] }));
    expect(evaluateGameEvent(event, career).completed).toBe(true);
  });

  it('reconhece todas as versões do Neymar do catálogo', () => {
    const neymars = [...PLAYERS, ...ALL_UNIQUE_CARDS]
      .filter(card => card.fullName === 'Neymar da Silva Santos Júnior' || card.basePlayerId === 'neymar')
      .map(card => card.id);
    expect(neymars.length).toBeGreaterThanOrEqual(5);
    for (const id of neymars) expect(NEYMAR_CARD_IDS.has(id)).toBe(true);
  });
});
