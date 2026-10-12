/**
 * Full audit of the dangers, generated as the match generates them (the narration picks,
 * the pitch plays): physics, football sense, and narration against the picture. Report
 * mode first (every rule broken, with examples), then it fails on any breach of the strict
 * rules (a tolerated one has a ceiling). On demand, ~40 s: AUDIT=1 npx vitest run audit
 */
import { expect, it } from 'vitest';
import type { MatchEvent, PlayKind, Team } from '../engine/teamModel';
import { generateBotTeam } from '../engine/bots';
import { narrateDanger, leadLine } from '../dangerNarration';
import { allowsAssist, epicFinishesFor, finishesFor, PLAY_VARIANTS, type PlayVariant } from '../playVariants';
import { seededRandom, withRandomSource } from '../random';
import { FORMATIONS } from '../gameData';
import { kickoffPositions } from './flow';
import { BALL_SLOT, GOAL_HEIGHT, GOAL_Y_MAX, GOAL_Y_MIN, roleOfSlot, type PitchSides, type Side } from './geometry';
import { buildDangerTimeline, DANGER_KINDS, FADE_ENTRY_MS, MAX_PASS_SPEED, peakBallSpeed, type DangerOutcome } from './plays';
import { CUT_MS, CUT_SNAP_MS } from './motion';
import { createPositionBuffer, sampleTimeline } from './timeline';

const OUTCOMES: Record<string, DangerOutcome[]> = { own_goal: ['goal'], blunder: ['goal'], deflected: ['goal'], screamer: ['goal'], woodwork: ['miss'] };
const STEP = 20;

it.runIf(process.env.AUDIT)('auditoria completa dos lances', () => {
  const issues = new Map<string, string[]>();
  const flag = (rule: string, example: string) => {
    const list = issues.get(rule) ?? [];
    list.push(example);
    issues.set(rule, list);
  };
  let cases = 0;
  const stretches: number[] = [];
  const paces: number[] = [];
  const peaks = { lead: [] as number[], decisive: [] as number[], shot: [] as number[] };

  for (let f = 0; f < FORMATIONS.length; f++) {
    const [home, away] = withRandomSource(seededRandom(100 + f), () => [generateBotTeam('Casa', 0.9), generateBotTeam('Fora', 0.9)]) as [Team, Team];
    home.formationId = FORMATIONS[f].id;
    away.formationId = FORMATIONS[(f + 2) % FORMATIONS.length].id;
    const sides: PitchSides = {
      left: { teamId: home.id, playerIds: home.players.slice(0, 11).map(p => p.id), formationId: home.formationId },
      right: { teamId: away.id, playerIds: away.players.slice(0, 11).map(p => p.id), formationId: away.formationId },
    };
    const nameOf = (id?: string) => [...home.players, ...away.players].find(p => p.id === id)?.shortName;
    for (const kind of DANGER_KINDS) {
      for (const outcome of OUTCOMES[kind] ?? (['goal', 'save', 'miss'] as DangerOutcome[])) {
        // Every variant with every finish it can have (the epics included), half of them in each
        // formation, with the side, the entry and a sending-off varying along the way.
        const combos = (PLAY_VARIANTS[kind] as readonly PlayVariant[]).flatMap(variant => [...finishesFor(kind, variant, outcome), ...epicFinishesFor(kind, variant, outcome)].map(finish => ({ variant, finish })));
        for (let n = 0; n < combos.length; n++) {
          if ((n + f) % 2 !== 0) continue;
          const combo = combos[n];
          cases++;
          const attackSide: Side = n % 2 === 0 ? 'left' : 'right';
          const atk = attackSide === 'left' ? home : away;
          const def = attackSide === 'left' ? away : home;
          const atkSlot = attackSide === 'left' ? 0 : 11;
          const defSlot = attackSide === 'left' ? 11 : 0;
          // As the engine: assists only on open-play and corner goals.
          const assisted = outcome === 'goal' && ['cross', 'through', 'dribble', 'longrange', 'counter', 'corner'].includes(kind) && n % 3 !== 0 && allowsAssist(kind as PlayKind, combo.variant);
          const sentOff = new Set<number>(n === 5 ? [atkSlot + 4, defSlot + 6] : []);
          const event: MatchEvent = {
            minute: 10 + n * 7, type: outcome, description: '',
            teamId: outcome === 'save' ? def.id : atk.id,
            playerId: outcome === 'save' ? def.players[0].id : kind === 'own_goal' ? undefined : atk.players[9].id,
            opponentId: outcome === 'save' ? atk.players[9].id : kind === 'own_goal' ? def.players[3].id : undefined,
            assisterId: assisted ? atk.players[7].id : undefined,
            play: { kind: kind as PlayKind, attackerId: atk.players[9].id, creatorId: atk.players[7].id, wideId: kind === 'cross' ? atk.players[10].id : undefined, defenderId: def.players[3].id, goalkeeperId: def.players[0].id },
          };
          const eventIndex = f * 10000 + DANGER_KINDS.indexOf(kind) * 200 + n;
          const narration = narrateDanger({ event, eventIndex, homeTeam: home, awayTeam: away, fallbackGoalkeeperName: t => t.players[0].shortName, force: combo });
          const d = buildDangerTimeline({
            sides, attackSide, event, outcome, prev: kickoffPositions(sides, n % 4 < 2 ? 'left' : 'right'), sentOff,
            entry: n % 3 === 0 ? 'cut' : 'fade', seed: eventIndex * 7 + 1, variant: narration.variant, finish: narration.finish,
          });
          const lead = leadLine(d.lead, nameOf, atk.name, kind as PlayKind, eventIndex);
          const tag = `${kind}/${d.variant}/${d.finish} ${attackSide} lead:${d.lead.pattern} f${FORMATIONS[f].id} n${n}`;
          const text = `${lead} | ${narration.buildUp} | ${narration.attempt} | ${narration.reveal}`;

          // Positions in the attacker's frame (attacking towards x = 105).
          const out = createPositionBuffer();
          const at = (t: number) => { sampleTimeline(d.timeline, t, out); return out; };
          const P = (buf: Float32Array, s: number) => attackSide === 'left'
            ? { x: buf[s * 3], y: buf[s * 3 + 1], z: buf[s * 3 + 2] }
            : { x: 105 - buf[s * 3], y: 68 - buf[s * 3 + 1], z: buf[s * 3 + 2] };
          const slotOf = (id?: string) => (id ? [...sides.left.playerIds, ...sides.right.playerIds].indexOf(id) : -1);
          // The lead-in is the attackers' (a legend can be in both bot squads).
          const atkSlotOf = (id?: string) => { const i = id ? sides[attackSide].playerIds.indexOf(id) : -1; return i < 0 ? -1 : i + atkSlot; };
          const fin = d.cast.find(c => c.role === 'finisher')!.slot;
          const gk = d.cast.find(c => c.role === 'goalkeeper')!.slot;
          const creator = slotOf(assisted ? event.assisterId : event.play?.wideId ?? event.play?.creatorId);
          const defender = slotOf(event.play?.defenderId);
          const defenders = Array.from({ length: 11 }, (_, i) => defSlot + i).filter(s => !sentOff.has(s));
          const attackers = Array.from({ length: 11 }, (_, i) => atkSlot + i).filter(s => !sentOff.has(s));
          const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

          // Sample the whole danger once.
          const frames: { t: number; pos: Float32Array }[] = [];
          for (let t = 0; t <= d.timing.endMs; t += STEP) frames.push({ t, pos: Float32Array.from(at(t)) });
          const frameAt = (t: number) => frames[Math.min(frames.length - 1, Math.round(t / STEP))].pos;

          // ── Physics ──
          // The ball before the strike at a real pass's speed at most; the decisive move's
          // stretch (1: scripted pace) for the report.
          const entryMs = d.entry === 'cut' ? CUT_MS : FADE_ENTRY_MS;
          stretches.push((d.timing.contactMs - d.timing.decisiveMs) / (1650 - entryMs));
          const leadPeak = peakBallSpeed(d.timeline, Math.max(entryMs, CUT_SNAP_MS) + STEP, d.timing.decisiveMs);
          const decisivePeak = peakBallSpeed(d.timeline, d.timing.decisiveMs, d.timing.contactMs - 30);
          peaks.lead.push(leadPeak); peaks.decisive.push(decisivePeak);
          const shotPeak = peakBallSpeed(d.timeline, d.timing.contactMs - 10, d.timing.arrivalMs - 20);
          peaks.shot.push(shotPeak);
          // Its average pace to the target: a strike in slow motion reads as a replay (epics only).
          { const a = P(frameAt(d.timing.contactMs), BALL_SLOT), b = P(frameAt(d.timing.arrivalMs), BALL_SLOT); const pace = dist(a, b) / ((d.timing.arrivalMs - d.timing.contactMs) / 1000); paces.push(pace); if (pace < 8 && !d.epic && !['rebound', 'blocked', 'deflect', 'panenka', 'chip'].includes(d.finish) && !(kind === 'blunder' && d.variant === 'header')) flag('chute em câmera lenta', tag + ' ' + pace.toFixed(1) + ' m/s'); }
          // A strike leaves the foot at ~120 km/h at most.
          if (shotPeak > 36) flag('chute rápido demais', tag + ' ' + shotPeak.toFixed(0) + ' m/s');
          if (Math.max(leadPeak, decisivePeak) > MAX_PASS_SPEED * 1.08) flag('bola rápida demais antes do chute', `${tag} lead ${leadPeak.toFixed(0)} decisiva ${decisivePeak.toFixed(0)} m/s`);
          for (let i = 1; i < frames.length; i++) {
            const t = frames[i].t;
            const inCut = d.entry === 'cut' && t >= CUT_SNAP_MS - STEP && t <= CUT_SNAP_MS + STEP;
            if (inCut || t <= FADE_ENTRY_MS) continue;
            const a = frames[i - 1].pos, b = frames[i].pos;
            const ball = P(b, BALL_SLOT), ballPrev = P(a, BALL_SLOT);
            const ballSpeed = dist(ball, ballPrev) / (STEP / 1000);
            // Loose ball lying alone in the build-up.
            // (A deflection off the wall or a fumbled free kick also starts from a dead ball.)
            const deadBall = ['corner', 'freekick', 'penalty'].includes(kind) || (kind === 'deflected' && (d.variant === 'freekick' || d.variant === 'edge')) || (kind === 'blunder' && d.variant === 'freekick');
            const atSpot = deadBall && t < (kind === 'corner' || d.variant === 'edge' ? d.timing.decisiveMs + 300 : d.timing.contactMs);
            if (t < d.timing.contactMs && ball.z < 0.3 && ballSpeed < 2 && !atSpot) {
              const nearest = Math.min(...[...attackers, ...defenders].map(s => dist(P(b, s), ball)));
              if (nearest > 3) { flag('bola parada sozinha na construção', `${tag} t=${t} (${nearest.toFixed(1)} m do mais próximo)`); break; }
            }
          }
          // A fast ground ball going straight through an opponent before the strike (not the nutmeg).
          if (d.variant !== 'nutmeg') {
            for (const { t, pos } of frames) {
              if (t < FADE_ENTRY_MS + 100 || t > d.timing.contactMs - 40) continue;
              const ball = P(pos, BALL_SLOT);
              const prev = P(frameAt(t - STEP), BALL_SLOT);
              if (ball.z > 1.2 || dist(ball, prev) / (STEP / 1000) < 9) continue;
              // A ball at an attacker's feet is being carried, not passed.
              if (attackers.some(s => dist(P(pos, s), ball) < 1.3)) continue;
              const hit = defenders.find(s => s !== gk && !(kind === 'own_goal' && s === defender) && dist(P(pos, s), ball) < 0.6);
              if (hit !== undefined && d.lead.pattern !== 'recovery' && !(d.lead.pattern === 'interception' && t < d.timing.decisiveMs)) { const role = d.cast.find(cc => cc.slot === hit)?.role ?? (hit === defender ? 'marcador' : 'apoio'); flag('passe atravessando adversário', `${tag} t=${t} slot ${hit} (${role})`); break; }
            }
          }
          // Players on top of each other for a while (not a duel in the air).
          {
            const together = new Map<string, number>();
            for (const { t, pos } of frames) {
              if (t < FADE_ENTRY_MS) continue;
              const all = [...attackers, ...defenders];
              for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
                const a = P(pos, all[i]), b = P(pos, all[j]);
                const key = `${all[i]}-${all[j]}`;
                if (dist(a, b) < 0.5 && a.z < 0.05 && b.z < 0.05) together.set(key, (together.get(key) ?? 0) + STEP);
              }
            }
            const worst = [...together.entries()].sort((a, b) => b[1] - a[1])[0];
            // Jostling at a set piece touches for a moment; over 0.6 s together is a bug.
            if (worst && worst[1] >= 600) flag('jogadores sobrepostos', `${tag} ${worst[0]} por ${worst[1]} ms`);
          }
          // The defending keeper strays out of his box.
          {
            const out = frames.find(({ t, pos }) => t > FADE_ENTRY_MS && t < d.timing.arrivalMs && P(pos, gk).x < 88.5);
            if (out) flag('goleiro fora da área', `${tag} t=${out.t} x=${P(out.pos, gk).x.toFixed(1)}`);
          }
          // Ball off the pitch before the strike.
          {
            const off = frames.find(({ t, pos }) => { const b = P(pos, BALL_SLOT); return t > FADE_ENTRY_MS && t < d.timing.contactMs && (b.x < -0.5 || b.x > 105.5 || b.y < -0.5 || b.y > 68.5); });
            if (off) flag('bola fora do campo antes do chute', `${tag} t=${off.t}`);
          }

          // ── Football ──
          // Offside at the decisive pass: the receiver beyond the second-last defender (and the ball).
          if (!['corner', 'freekick', 'penalty'].includes(d.variant === 'edge' ? 'corner' : kind) && kind !== 'corner') {
            let received = -1;
            for (const { t, pos } of frames) {
              if (t < d.timing.decisiveMs || t > d.timing.contactMs) continue;
              if (dist(P(pos, fin), P(pos, BALL_SLOT)) < 1.3 && P(pos, BALL_SLOT).z < 2.6) { received = t; break; }
            }
            if (received > 0) {
              // The pass: the last time before reception that someone else had the ball.
              let passT = -1;
              for (const { t, pos } of frames) {
                if (t >= received) break;
                if (t < FADE_ENTRY_MS) continue;
                const b = P(pos, BALL_SLOT);
                if (attackers.some(s => s !== fin && dist(P(pos, s), b) < 1.3)) passT = t;
              }
              if (passT > 0) {
                const pos = frameAt(passT);
                const xs = defenders.map(s => P(pos, s).x).sort((a, b) => b - a);
                const line = Math.max(xs[1] ?? 0, P(pos, BALL_SLOT).x);
                const fx = P(pos, fin).x;
                if (fx > line + 0.8 && fx > 52.5) flag('impedimento no passe decisivo', `${tag} t=${passT} atacante x=${fx.toFixed(1)} linha=${line.toFixed(1)}`);
              }
            }
          }
          if (kind === 'corner') {
            const b = P(frameAt(d.timing.decisiveMs), BALL_SLOT);
            if (d.variant !== 'short' && (b.x < 103 || (b.y > 2 && b.y < 66))) flag('escanteio fora da bandeira', `${tag} bola em (${b.x.toFixed(1)},${b.y.toFixed(1)})`);
          }
          if (kind === 'penalty') {
            const b = P(frameAt(d.timing.contactMs - 40), BALL_SLOT);
            if (Math.abs(b.x - 94) > 0.3 || Math.abs(b.y - 34) > 0.3) flag('pênalti fora da marca', `${tag} (${b.x.toFixed(1)},${b.y.toFixed(1)})`);
          }
          if (kind === 'freekick') {
            const a = P(frameAt(d.timing.decisiveMs), BALL_SLOT), b = P(frameAt(d.timing.contactMs - 40), BALL_SLOT);
            // (A routine rolls it aside first; a free kick out wide is crossed in; a chipped one dinked over the wall.)
            if (dist(a, b) > 0.3 && d.variant !== 'routine' && d.variant !== 'flank' && d.variant !== 'chipped') flag('falta: bola andou antes da cobrança', `${tag}`);
          }
          // An assisted goal: the assist provider plays the last pass to the finisher.
          if (assisted && kind !== 'own_goal') {
            // Use the play's authored touch log. Inferring touches from a nearby player and
            // a change of direction can mistake a runner crossing the pass for its receiver.
            const lastPass = [...d.touches].reverse().find(({ t, slot }) => t < d.timing.contactMs - 120 && slot !== fin);
            const last = lastPass?.slot ?? -1;
            if (last !== creator) flag('assistência: último passe não é do autor', `${tag} último=${last} autor=${creator}`);
          }

          // ── Narration against the picture ──
          const contact = frameAt(d.timing.contactMs);
          const ballC = P(contact, BALL_SLOT);
          if (kind !== 'own_goal' && dist(P(contact, fin), ballC) > 1.6) flag('finalizador longe da bola no chute', `${tag} ${dist(P(contact, fin), ballC).toFixed(1)} m`);
          const saysHeader = /cabe[cç]|testa|pelo alto/i.test(narration.attempt + narration.reveal);
          // A diving header meets it low, on purpose.
          if (saysHeader && ballC.z < 1.3 && d.variant !== 'diving') flag('narra cabeçada mas bola baixa', `${tag} z=${ballC.z.toFixed(2)} "${narration.attempt}"`);
          if (!saysHeader && ballC.z > 1.5 && !/voleio|VOLEIO|primeira|bicicleta|BICICLETA/.test(narration.attempt)) flag('bola na altura da cabeça sem narrar cabeçada', `${tag} z=${ballC.z.toFixed(2)} "${narration.attempt}"`);
          const W = nameOf(assisted ? event.assisterId : event.play?.wideId ?? event.play?.creatorId);
          const D = nameOf(event.play?.defenderId);
          const decisiveText = narration.buildUp + ' ' + narration.attempt;
          if (W && decisiveText.includes(W) && creator >= 0) {
            const touched = frames.some(({ t, pos }) => t >= FADE_ENTRY_MS && t <= d.timing.contactMs && dist(P(pos, creator), P(pos, BALL_SLOT)) < 1.4);
            if (!touched) flag('narra quem serve mas ele não toca na bola', `${tag} ${W}: "${narration.buildUp}"`);
          }
          if (D && decisiveText.includes(D) && defender >= 0 && !sentOff.has(defender)) {
            const close = Math.min(...frames.filter(({ t }) => t >= d.timing.decisiveMs && t <= d.timing.arrivalMs).map(({ pos }) => dist(P(pos, defender), P(pos, BALL_SLOT))));
            if (close > (/correndo atrás|não alcança/.test(decisiveText) ? 7 : 4)) flag('narra o zagueiro mas ele não participa', `${tag} ${D} a ${close.toFixed(1)} m: "${decisiveText}"`);
          }
          // The lead-in line against who really had the ball.
          {
            const touchedLead = (id?: string) => { const s = atkSlotOf(id); return s >= 0 && frames.some(({ t, pos }) => t >= FADE_ENTRY_MS && t <= d.timing.decisiveMs + 40 && dist(P(pos, s), P(pos, BALL_SLOT)) < 1.4); };
            if (['pass', 'switch', 'combo', 'wall', 'longball', 'pivot', 'throwin'].includes(d.lead.pattern) && !touchedLead(d.lead.passerId)) { const ps = atkSlotOf(d.lead.passerId); const md = Math.min(...frames.filter(({ t }) => t >= FADE_ENTRY_MS && t <= d.timing.decisiveMs + 40).map(({ pos }) => dist(P(pos, ps), P(pos, BALL_SLOT)))); flag('preparação: quem passa não toca na bola', `${tag} slot ${ps} min ${md.toFixed(2)} m "${lead}"`); }
            if ((d.lead.pattern === 'combo' || d.lead.pattern === 'pivot') && !touchedLead(d.lead.secondId)) flag('preparação: segundo da troca não toca', `${tag} "${lead}"`);
            if (d.lead.pattern !== 'settle' && d.lead.ownerId) {
              const s = atkSlotOf(d.lead.ownerId);
              const pos = frameAt(d.timing.decisiveMs);
              if (dist(P(pos, s), P(pos, BALL_SLOT)) > 1.5) flag('preparação: bola não está com quem inicia a jogada', `${tag} ${dist(P(pos, s), P(pos, BALL_SLOT)).toFixed(1)} m`);
            }
            // The presser who is beaten really goes to ground at him.
            if (d.lead.pattern === 'beat' && !frames.some(({ t, pos }) => t >= FADE_ENTRY_MS && t <= d.timing.decisiveMs && dist(P(pos, slotOf(d.lead.loserId)), P(pos, BALL_SLOT)) < 2.2)) flag('preparação: o marcador driblado não chega no bote', tag);
            if (d.lead.pattern === 'recovery' || d.lead.pattern === 'interception') {
              const s = slotOf(d.lead.loserId);
              const pos = frameAt(FADE_ENTRY_MS + 40);
              if (dist(P(pos, s), P(pos, BALL_SLOT)) > 1.6) flag('preparação: quem perde a bola não estava com ela', `${tag}`);
            }
          }
          // The reveal's words against the ball at the goal.
          {
            const arrive = frameAt(d.timing.arrivalMs);
            const b = P(arrive, BALL_SLOT);
            const r = narration.reveal;
            if (outcome === 'goal' && /ângulo|no alto|ANGULO|ÂNGULO/.test(r) && b.z < 1.4) flag('narra no ângulo mas bola baixa', `${tag} z=${b.z.toFixed(2)} "${r}"`);
            if (outcome === 'goal' && /rasteiro|cantinho|quica/.test(r) && b.z > 0.7) flag('narra rasteiro mas bola alta', `${tag} z=${b.z.toFixed(2)} "${r}"`);
            if (/ISOLOU|Por cima|por cima do gol|ALTA DEMAIS/.test(r) && b.z <= GOAL_HEIGHT) flag('narra por cima mas bola abaixo do travessão', `${tag} z=${b.z.toFixed(2)}`);
            if (/TRAVESSÃO/.test(r) && !(b.y > GOAL_Y_MIN && b.y < GOAL_Y_MAX && Math.abs(b.z - GOAL_HEIGHT) < 0.2)) flag('narra travessão mas não bateu nele', `${tag}`);
            if (outcome === 'save' && dist(P(arrive, gk), b) > 1.5) flag('defesa: bola longe do goleiro', `${tag}`);
          }
          // After a goal the ball stays in the net; after a catch, with the keeper.
          if (outcome === 'goal') {
            const late = frames.filter(({ t }) => t > d.timing.arrivalMs + 300).find(({ pos }) => { const b = P(pos, BALL_SLOT); return b.x < 105 || b.y < GOAL_Y_MIN || b.y > GOAL_Y_MAX; });
            if (late) flag('gol: bola sai da rede depois', `${tag} t=${late.t}`);
          }
          if (outcome === 'save' && d.finish === 'catch') {
            const late = frames.filter(({ t }) => t > d.timing.arrivalMs + 300).find(({ pos }) => dist(P(pos, gk), P(pos, BALL_SLOT)) > 1.6);
            if (late) flag('encaixe: bola se separa do goleiro', `${tag} t=${late.t}`);
          }
          void roleOfSlot; void text;
        }
      }
    }
  }
  const pct = (list: number[], p: number) => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))].toFixed(2);
  const spread = (list: number[]) => `p50 ${pct(list, 0.5)} p90 ${pct(list, 0.9)} p99 ${pct(list, 0.99)} máx ${pct(list, 1)}`;
  const lines = [`${cases} lances auditados`, `esticamento da jogada decisiva: ${spread(stretches)} (${stretches.filter(x => x > 1.001).length} esticadas)`, `bola na preparação (m/s): ${spread(peaks.lead)}`, `bola na jogada decisiva (m/s): ${spread(peaks.decisive)}`, `chute (m/s): ${spread(peaks.shot)}`, `ritmo médio do chute (m/s): p10 ${pct(paces, 0.1)} p50 ${pct(paces, 0.5)}`];
  for (const [rule, list] of [...issues.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`\n■ ${rule}: ${list.length}`);
    const byPlay = new Map<string, number>();
    for (const example of list) { const key = example.split(" ")[0].split("/").slice(0, 2).join("/") + " " + (example.match(/lead:w+/)?.[0] ?? ""); byPlay.set(key, (byPlay.get(key) ?? 0) + 1); }
    lines.push("   por jogada: " + [...byPlay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + "=" + v).join(", "));
    for (const example of list.slice(0, 3)) lines.push(`   - ${example}`);
  }
  console.log(lines.join('\n'));
  // Tolerated: a retreating defender crossing a pass at full sprint (an interception that misses).
  const tolerated: Record<string, number> = { 'passe atravessando adversário': Math.ceil(cases * 0.01) };
  for (const [rule, list] of issues) expect(list.length, `${rule}: ${list.slice(0, 3).join(' | ')}`).toBeLessThanOrEqual(tolerated[rule] ?? 0);
}, 600000);
