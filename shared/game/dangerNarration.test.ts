import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowsAssist, epicFinishesFor, finishesFor, isEpic, isEpicVariant, PLAY_VARIANTS, variantFor, type PlayVariant } from './playVariants';
import { epicOptions, skillWeight } from './epicPlays';
import { seededRandom } from './random';
import { generateBotTeam } from './gameEngine';
import { narrateDanger } from './dangerNarration';
import type { MatchEvent, Team } from './engine/teamModel';
import { buildDangerTimeline } from './pitch/plays';
import { kickoffPositions } from './pitch/flow';
import { resolveDangerActors } from './pitch/actors';

let home: Team;
let away: Team;
beforeEach(() => {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(77));
  home = generateBotTeam('Casa', 0.8);
  away = generateBotTeam('Fora', 0.8);
  vi.restoreAllMocks();
});
afterEach(() => vi.restoreAllMocks());

const gkName = (team: Team) => team.players[0].shortName;

function goal(play: MatchEvent['play']): MatchEvent {
  return { minute: 33, type: 'goal', description: '', teamId: home.id, playerId: home.players[10].id, opponentId: away.players[3].id, play };
}

describe('narrateDanger', () => {
  it('gera sempre o mesmo texto para o mesmo lance, sem gastar o Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    const event = goal({ kind: 'cross', shot: 'header', attackerId: home.players[10].id, wideId: home.players[8].id, defenderId: away.players[3].id, goalkeeperId: away.players[0].id });
    const a = narrateDanger({ event, eventIndex: 12, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    const b = narrateDanger({ event, eventIndex: 12, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(a).toEqual(b);
    expect(spy).not.toHaveBeenCalled();
  });

  it('usa os jogadores do lance: finalizador, defensor e goleiro', () => {
    const event = goal({ kind: 'dribble', shot: 'normal', attackerId: home.players[10].id, defenderId: away.players[3].id, goalkeeperId: away.players[0].id });
    const n = narrateDanger({ event, eventIndex: 4, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: () => 'X' });
    expect(n.attackerName).toBe(home.players[10].shortName);
    expect(n.defenderName).toBe(away.players[3].shortName);
    expect(n.goalkeeperName).toBe(away.players[0].shortName);
    expect(n.attackTeamId).toBe(home.id);
    expect(n.reveal).toContain(home.players[10].shortName);
  });

  it('na defesa o time do evento é o do goleiro, e o atacante vem do opponentId', () => {
    const event: MatchEvent = { minute: 50, type: 'save', description: '', teamId: away.id, playerId: away.players[0].id, opponentId: home.players[9].id,
      play: { kind: 'longrange', shot: 'long_range', attackerId: home.players[9].id, goalkeeperId: away.players[0].id } };
    const n = narrateDanger({ event, eventIndex: 9, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(n.attackTeamId).toBe(home.id);
    expect(n.attackerName).toBe(home.players[9].shortName);
    expect(n.outcome).toBe('save');
  });

  it('gol contra é identificado e nomeia quem desviou', () => {
    const event: MatchEvent = { minute: 70, type: 'goal', description: '', teamId: home.id, opponentId: away.players[2].id,
      play: { kind: 'own_goal', attackerId: home.players[10].id, defenderId: away.players[2].id, goalkeeperId: away.players[0].id } };
    const n = narrateDanger({ event, eventIndex: 20, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(n.isOwnGoal).toBe(true);
    expect(n.attackerName).toContain(away.players[2].shortName);
  });

  it('evento antigo sem play continua narrado', () => {
    const event: MatchEvent = { minute: 15, type: 'miss', description: '', teamId: home.id, playerId: home.players[10].id };
    const n = narrateDanger({ event, eventIndex: 2, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(n.buildUp.length).toBeGreaterThan(10);
    expect(n.attempt.length).toBeGreaterThan(10);
    expect(n.reveal.length).toBeGreaterThan(5);
    expect(n.goalkeeperName).toBe(away.players[0].shortName);
  });

  it('narra os mesmos jogadores que a animação usa quando os indicados foram expulsos', () => {
    const sides = {
      left: { teamId: home.id, playerIds: home.players.slice(0, 11).map(p => p.id), formationId: home.formationId },
      right: { teamId: away.id, playerIds: away.players.slice(0, 11).map(p => p.id), formationId: away.formationId },
    } as const;
    const sentOff = new Set([9, 5, 11, 13]);
    const event: MatchEvent = {
      minute: 64,
      type: 'goal',
      description: '',
      teamId: home.id,
      playerId: home.players[9].id,
      opponentId: away.players[2].id,
      play: {
        kind: 'through',
        attackerId: home.players[9].id,
        creatorId: home.players[5].id,
        defenderId: away.players[2].id,
        goalkeeperId: away.players[0].id,
      },
    };
    const actors = resolveDangerActors({ sides, attackSide: 'left', event, outcome: 'goal', sentOff });
    const n = narrateDanger({
      event,
      eventIndex: 64,
      homeTeam: home,
      awayTeam: away,
      fallbackGoalkeeperName: gkName,
      pitchSides: sides,
      sentOff,
    });
    const d = buildDangerTimeline({
      sides,
      attackSide: 'left',
      event,
      outcome: 'goal',
      prev: kickoffPositions(sides),
      sentOff,
      entry: 'cut',
      seed: 6401,
      variant: n.variant,
      finish: n.finish,
    });
    const playerAtSlot = (slot: number) => (slot < 11 ? home : away).players[slot % 11];
    const visualFinisher = d.cast.find(actor => actor.role === 'finisher');
    const visualKeeper = d.cast.find(actor => actor.role === 'goalkeeper');
    expect(visualFinisher).toBeDefined();
    expect(visualKeeper).toBeDefined();
    expect(playerAtSlot(visualFinisher!.slot).id).toBe(actors.finisherId);
    expect(playerAtSlot(visualKeeper!.slot).id).toBe(actors.goalkeeperId);
    expect(n.attackerName).toBe(playerAtSlot(actors.finisher).shortName);
    expect(n.defenderName).toBe(playerAtSlot(actors.defender).shortName);
    expect(n.goalkeeperName).toBe(playerAtSlot(actors.goalkeeper).shortName);
    expect(n.buildUp).toContain(playerAtSlot(actors.creator).shortName);
  });

  it('bola na trave sempre é narrada como trave, e defesa e chute para fora trazem o estilo', () => {
    const post: MatchEvent = { minute: 60, type: 'miss', description: '', teamId: home.id, playerId: home.players[10].id, play: { kind: 'woodwork', attackerId: home.players[10].id } };
    for (let i = 0; i < 20; i++) {
      const n = narrateDanger({ event: post, eventIndex: i, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
      expect(['post', 'bar', 'posts']).toContain(n.finish); // (the epic: off both posts)
      expect(n.reveal.toUpperCase()).toMatch(n.finish === 'bar' ? /TRAVESSÃO/ : /TRAVE|POSTE/);
    }
    const save: MatchEvent = { minute: 61, type: 'save', description: '', teamId: away.id, playerId: away.players[0].id, opponentId: home.players[9].id, play: { kind: 'through', attackerId: home.players[9].id, goalkeeperId: away.players[0].id } };
    const styles = new Set(Array.from({ length: 30 }, (_, i) => narrateDanger({ event: save, eventIndex: i, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName }).finish));
    expect(styles.size).toBeGreaterThan(1);
  });

  it('cada desfecho escolhido é um dos possíveis para o lance, e a revelação conta o desvio', () => {
    const kinds = ['cross', 'through', 'dribble', 'longrange', 'counter', 'corner', 'freekick', 'penalty'] as const;
    for (const kind of kinds) {
      for (const type of ['goal', 'save', 'miss'] as const) {
        for (let i = 0; i < 12; i++) {
          const event: MatchEvent = type === 'save'
            ? { minute: 30, type, description: '', teamId: away.id, playerId: away.players[0].id, opponentId: home.players[10].id, play: { kind, attackerId: home.players[10].id, goalkeeperId: away.players[0].id } }
            : { minute: 30, type, description: '', teamId: home.id, playerId: home.players[10].id, play: { kind, attackerId: home.players[10].id, goalkeeperId: away.players[0].id } };
          const n = narrateDanger({ event, eventIndex: i, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
          expect([...finishesFor(kind, n.variant, type), ...epicFinishesFor(kind, n.variant, type)]).toContain(n.finish);
          if (n.finish === 'blocked') expect(n.reveal).toMatch(/BARREIRA|BLOQUEADO|desvia/);
        }
      }
    }
    const deflected = narrateDanger({ event: goal({ kind: 'deflected', shot: 'normal', attackerId: home.players[10].id, goalkeeperId: away.players[0].id }), eventIndex: 3, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(deflected.reveal).toMatch(/desvi|Desvio/);
  });

  it('gol com assistência: quem deu a assistência serve a bola e não sai jogada individual', () => {
    for (const kind of ['counter', 'dribble', 'cross'] as const) {
      for (let i = 0; i < 20; i++) {
        const event = { ...goal({ kind, attackerId: home.players[10].id, wideId: home.players[8].id, goalkeeperId: away.players[0].id }), assisterId: home.players[6].id };
        const n = narrateDanger({ event, eventIndex: i, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
        expect(['breakaway', 'recovery']).not.toContain(n.variant);
        expect(n.buildUp + n.attempt, `${kind}/${n.variant}`).toContain(home.players[6].shortName);
      }
    }
  });

  it('com memória da partida, a mesma jogada se repete bem menos (mas ainda pode)', () => {
    // Summed over a few generated matchups, so the measure does not hang on one team's draw
    // (the bot teams come from the whole catalogue, which grows).
    const teams = [77, 78, 79, 80, 81].map(seed => {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      return { home: generateBotTeam('Casa', 0.8), away: generateBotTeam('Fora', 0.8) };
    });
    const run = (withMemory: boolean) => teams.reduce((sum, pair) => sum + runFor(pair.home, pair.away, withMemory), 0);
    const runFor = (home: Team, away: Team, withMemory: boolean) => {
      let recent = { plays: [] as string[], lines: [] as string[] };
      const seenVariants: string[] = [];
      let repeats = 0;
      for (let i = 0; i < 200; i++) {
        const n = narrateDanger({ event: { ...goal({ kind: 'cross', attackerId: home.players[10].id, goalkeeperId: away.players[0].id }), teamId: home.id, playerId: home.players[10].id, opponentId: away.players[3].id, minute: i % 90 }, eventIndex: i, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName, recent: withMemory ? recent : undefined });
        if (seenVariants.slice(-2).includes(n.variant)) repeats++;
        seenVariants.push(n.variant);
        recent = { plays: [...recent.plays, 'cross/' + n.variant, 'cross/' + n.finish].slice(-8), lines: [...recent.lines, n.buildUp, n.attempt, n.reveal].slice(-12) };
      }
      return repeats;
    };
    const without = run(false);
    const withMemory = run(true);
    expect(withMemory).toBeLessThan(without * 0.6);
    expect(withMemory).toBeGreaterThan(0);
  });

  it('sem passador registrado pelo motor, a narração cita quem o campo mostra servindo', () => {
    const sides = { left: { teamId: home.id, playerIds: home.players.slice(0, 11).map(p => p.id), formationId: home.formationId }, right: { teamId: away.id, playerIds: away.players.slice(0, 11).map(p => p.id), formationId: away.formationId } };
    for (const kind of ['through', 'cross', 'counter'] as const) {
      for (let i = 0; i < 6; i++) {
        const event = goal({ kind, attackerId: home.players[10].id, defenderId: away.players[3].id, goalkeeperId: away.players[0].id });
        const n = narrateDanger({ event, eventIndex: i, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
        const d = buildDangerTimeline({ sides, attackSide: 'left', event, outcome: 'goal', prev: kickoffPositions(sides, 'left'), sentOff: new Set(), entry: 'cut', seed: i + 1, variant: n.variant, finish: n.finish });
        const creator = d.cast.find(c => c.role === 'creator');
        if (!creator) continue;
        const shown = home.players[creator.slot].shortName;
        const named = home.players.slice(0, 11).filter(p => p.id !== home.players[10].id).find(p => (n.buildUp + n.attempt).includes(p.shortName));
        expect(named?.shortName, kind + '/' + n.variant + ': ' + n.buildUp).toBe(shown);
      }
    }
  });

  it('pênalti e falta têm narração de bola parada', () => {
    const penalty = narrateDanger({ event: goal({ kind: 'penalty', shot: 'normal', attackerId: home.players[10].id, goalkeeperId: away.players[0].id }), eventIndex: 1, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(penalty.buildUp).toContain('PÊNALTI');
    const freeKick = narrateDanger({ event: goal({ kind: 'freekick', shot: 'normal', attackerId: home.players[10].id, goalkeeperId: away.players[0].id }), eventIndex: 1, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName });
    expect(freeKick.buildUp).toContain('Falta');
  });
});

describe('lances épicos e variações novas', () => {
  const kinds = ['cross', 'through', 'dribble', 'longrange', 'counter', 'corner', 'freekick', 'penalty', 'own_goal', 'blunder', 'deflected', 'screamer', 'woodwork'] as const;
  const outcomesOf = (kind: string): ('goal' | 'save' | 'miss')[] =>
    ['own_goal', 'blunder', 'deflected', 'screamer'].includes(kind) ? ['goal'] : kind === 'woodwork' ? ['miss'] : ['goal', 'save', 'miss'];

  it('toda variação com todo desfecho (épicos incluídos) tem as três frases, com os nomes certos', () => {
    for (const kind of kinds) {
      for (const outcome of outcomesOf(kind)) {
        for (const variant of PLAY_VARIANTS[kind] as readonly PlayVariant[]) {
          for (const finish of [...finishesFor(kind, variant, outcome), ...epicFinishesFor(kind, variant, outcome)]) {
            const event: MatchEvent = {
              minute: 60, type: outcome, description: '',
              teamId: outcome === 'save' ? away.id : home.id,
              playerId: outcome === 'save' ? away.players[0].id : kind === 'own_goal' ? undefined : home.players[10].id,
              opponentId: outcome === 'save' ? home.players[10].id : kind === 'own_goal' ? away.players[3].id : undefined,
              play: { kind, attackerId: home.players[10].id, creatorId: home.players[7].id, defenderId: away.players[3].id, goalkeeperId: away.players[0].id },
            };
            const n = narrateDanger({ event, eventIndex: 3, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: gkName, force: { variant, finish } });
            const label = `${kind}/${variant}/${finish}`;
            for (const line of [n.buildUp, n.attempt, n.reveal]) {
              expect(typeof line, label).toBe('string');
              expect(line.length, label).toBeGreaterThan(10);
              expect(line, label).not.toMatch(/undefined|\$\{/);
            }
            expect(n.variant, label).toBe(variant);
            expect(n.finish, label).toBe(finish);
            expect(n.epic, label).toBe(isEpic(kind, variant, finish));
          }
        }
      }
    }
  });

  it('o sorteio comum nunca escolhe um épico: só o sorteio de raridade', () => {
    for (const kind of kinds) {
      for (const outcome of outcomesOf(kind)) {
        for (let i = 0; i < 100; i++) {
          const v = variantFor(kind, i / 100, outcome, i % 2 === 0);
          expect(isEpicVariant(kind, v), `${kind}/${v}`).toBe(false);
        }
      }
    }
  });

  it('a chance de épico cresce com a qualidade de quem faz o lance', () => {
    expect(skillWeight(70)).toBe(0.25);
    expect(skillWeight(85)).toBeCloseTo(1, 5);
    expect(skillWeight(99)).toBe(2);
    // An assisted goal never becomes a play that has no assist (an Olympic goal, a solo run...).
    for (const kind of kinds) {
      for (const option of epicOptions(kind, 'goal', true)) {
        if (option.variant) expect(allowsAssist(kind, option.variant), `${kind}/${option.variant}`).toBe(true);
      }
    }
  });
});
