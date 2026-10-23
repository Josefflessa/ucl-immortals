import { describe, expect, it } from 'vitest';
import { generateBotTeam } from './engine/bots';
import type { MatchEvent, Team } from './engine/teamModel';
import { narrateRedCard, redCardSeed } from './redCardNarration';
import { isRedKind, RED_KINDS, RED_VARIANTS, redKindOf, redVariantFor, type RedKind, type RedVariant } from './redCards';
import { seededRandom, withRandomSource } from './random';
import { straightRedPlay } from './matchNarrative';

function teams(): [Team, Team] {
  return withRandomSource(seededRandom(11), () => [generateBotTeam('Casa FC', 0.8), generateBotTeam('Fora FC', 0.8)]) as [Team, Team];
}

function redEvent(home: Team, extra: Partial<MatchEvent> = {}): MatchEvent {
  return { minute: 61, type: 'red', teamId: home.id, playerId: home.players[3].id, description: '🟥 EXPULSO!', ...extra };
}

describe('cartão vermelho — a narração', () => {
  const [home, away] = teams();

  it('todo tipo e variação tem as três falas, com os nomes certos e sem buracos', () => {
    for (const kind of RED_KINDS) {
      for (const variant of RED_VARIANTS[kind] as readonly RedVariant[]) {
        const event = redEvent(home, { redKind: kind, redVariant: variant, secondYellow: kind === 'secondyellow' });
        const n = narrateRedCard({ event, eventIndex: 3, homeTeam: home, awayTeam: away, victimId: away.players[9].id });
        const tag = `${kind}/${variant}`;
        expect(n.kind, tag).toBe(kind);
        expect(n.variant, tag).toBe(variant);
        for (const line of [n.buildUp, n.attempt]) {
          expect(line.length, tag).toBeGreaterThan(20);
          expect(line, tag).not.toMatch(/undefined|null|\$\{|NaN/);
        }
        expect(n.attempt, tag).toContain(home.players[3].shortName);
        const names = [away.players[9].shortName, home.players[3].shortName, home.name, away.name];
        expect(names.some(name => n.buildUp.includes(name)), tag).toBe(true);
        if (kind === 'secondyellow') expect(n.reveal, tag).toMatch(/AMARELO/);
        else expect(n.reveal, tag).toBe(event.description);
      }
    }
  });

  it('o segundo amarelo sempre diz que é o segundo amarelo, mesmo com outra linha gravada', () => {
    const n = narrateRedCard({ event: redEvent(home, { secondYellow: true, description: '🟥 EXPULSO!' }), eventIndex: 4, homeTeam: home, awayTeam: away });
    expect(n.reveal).toMatch(/SEGUNDO AMARELO/);
    expect(n.attempt).toMatch(/amarel/i);
    const kept = narrateRedCard({ event: redEvent(home, { secondYellow: true, description: '🟥 Amarelo que vira VERMELHO!' }), eventIndex: 4, homeTeam: home, awayTeam: away });
    expect(kept.reveal).toBe('🟥 Amarelo que vira VERMELHO!');
  });

  it('é determinística: o mesmo evento lê igual; eventos diferentes variam', () => {
    const event = redEvent(home, { redKind: 'tackle' });
    const a = narrateRedCard({ event, eventIndex: 5, homeTeam: home, awayTeam: away, victimId: away.players[8].id });
    const b = narrateRedCard({ event, eventIndex: 5, homeTeam: home, awayTeam: away, victimId: away.players[8].id });
    expect(b).toEqual(a);
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) seen.add(narrateRedCard({ event, eventIndex: i, homeTeam: home, awayTeam: away, victimId: away.players[8].id }).attempt);
    expect(seen.size).toBeGreaterThan(3);
    expect(redCardSeed(event, 1)).not.toBe(redCardSeed(event, 2));
  });

  it('uma variação gravada pelo motor vale; uma inválida cai no sorteio; eventos antigos viram entrada dura', () => {
    const recorded = narrateRedCard({ event: redEvent(home, { redKind: 'lastman', redVariant: 'clip' }), eventIndex: 1, homeTeam: home, awayTeam: away });
    expect(recorded.variant).toBe('clip');
    const stale = narrateRedCard({ event: redEvent(home, { redKind: 'handball', redVariant: 'pull' as RedVariant }), eventIndex: 1, homeTeam: home, awayTeam: away });
    expect(RED_VARIANTS.handball as readonly string[]).toContain(stale.variant);
    const legacy = narrateRedCard({ event: redEvent(home), eventIndex: 1, homeTeam: home, awayTeam: away });
    expect(legacy.kind).toBe('tackle');
    const second = narrateRedCard({ event: redEvent(home, { secondYellow: true }), eventIndex: 1, homeTeam: home, awayTeam: away });
    expect(second.kind).toBe('secondyellow');
  });

  it('evita repetir as últimas falas da partida quando há alternativa', () => {
    const event = redEvent(home, { redKind: 'tackle', redVariant: 'behind' });
    const first = narrateRedCard({ event, eventIndex: 1, homeTeam: home, awayTeam: away, victimId: away.players[9].id });
    const next = narrateRedCard({ event, eventIndex: 1, homeTeam: home, awayTeam: away, victimId: away.players[9].id, recent: [first.buildUp, first.attempt] });
    expect(next.buildUp).not.toBe(first.buildUp);
    expect(next.attempt).not.toBe(first.attempt);
  });
});

describe('cartão vermelho — o tipo vem do motor', () => {
  it('toda frase do vermelho direto carrega um tipo e uma variação válidos, e os dois lados do sorteio aparecem', () => {
    const kinds = new Set<RedKind>();
    withRandomSource(seededRandom(99), () => {
      for (let i = 0; i < 400; i++) {
        const play = straightRedPlay('Fulano', 40 + (i % 50));
        expect(isRedKind(play.kind)).toBe(true);
        expect(play.kind).not.toBe('secondyellow');
        expect(RED_VARIANTS[play.kind] as readonly string[]).toContain(play.variant);
        expect(play.text).toContain('Fulano');
        kinds.add(play.kind);
      }
    });
    expect(Array.from(kinds).sort()).toEqual(['brawl', 'elbow', 'handball', 'lastman', 'tackle']);
  });

  it('redKindOf e redVariantFor', () => {
    expect(redKindOf({ secondYellow: true, redKind: 'tackle' })).toBe('secondyellow');
    expect(redKindOf({ redKind: 'elbow' })).toBe('elbow');
    expect(redKindOf({ redKind: 'lixo' })).toBe('tackle');
    expect(redKindOf({ description: '🟥 MÃO NA BOLA! Fulano tira em cima da linha' })).toBe('handball');
    expect(redKindOf({ description: '🟥 Falta como último homem! Fulano derruba o atacante' })).toBe('lastman');
    expect(redKindOf({ description: '🟥 Fulano acerta uma cotovelada' })).toBe('elbow');
    expect(redVariantFor('handball', 0)).toBe('line');
    expect(redVariantFor('handball', 0.99)).toBe('block');
  });
});
