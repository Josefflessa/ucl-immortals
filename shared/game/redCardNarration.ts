/**
 * The three beats a red card is narrated with on the match screen: the move that ends in the foul
 * (stage 1), the foul and the referee running in (stage 2) and the card itself (stage 3, the line
 * the feed shows). Built from the play the engine recorded (its kind and variant), so the words
 * match the picture the live pitch plays. Every choice is drawn from a source seeded by the event,
 * so the same match reads the same on every device and on every replay.
 */
import type { MatchEvent, Team } from './engine/teamModel';
import { isRedVariantOf, redKindOf, redVariantFor, type RedKind, type RedVariant } from './redCards';
import { seededRandom, seedFromString } from './random';

export interface RedCardNarration {
  kind: RedKind;
  variant: RedVariant;
  offenderId?: string;
  /** The fouled player (a card id), when there is one. */
  victimId?: string;
  offenderTeamId: string;
  buildUp: string;
  attempt: string;
  reveal: string;
}

interface Names { O: string; V: string; G: string; T: string; U: string }
type Lines = { buildUp: string[]; attempt: string[] };

/** The words of each variant of each kind: O the offender, V the fouled player, G the keeper, T his team, U theirs. */
function linesFor(kind: RedKind, variant: RedVariant, n: Names): Lines {
  const { O, V, G, T, U } = n;
  switch (`${kind}/${variant}`) {
    case 'tackle/behind': return {
      buildUp: [
        `⚡ ${V} arranca com a bola pelo meio, e ${O} vem correndo atrás...`,
        `💨 ${V} escapa no meio-campo e ${O} corre para tentar alcançá-lo...`,
        `🏃 Contra-ataque de ${U}! ${V} acelera e ${O} vem de trás, em disparada...`,
      ],
      attempt: [
        `💥 ${O} DESCE O CARRINHO POR TRÁS em ${V}! Apito! O árbitro corre para lá...`,
        `💥 Entrada por trás de ${O} em ${V}! O juiz apita... e vai ao bolso?`,
        `💥 ${O} chega com tudo e leva ${V} no carrinho! O árbitro apita!`,
      ],
    };
    case 'tackle/twofoot': return {
      buildUp: [
        `🏃 ${V} conduz no meio-campo, e ${O} vem em diagonal para fechá-lo...`,
        `⚡ ${V} levanta a cabeça com a bola, enquanto ${O} se aproxima pelo lado...`,
        `🎯 ${V} domina a bola no meio, com ${O} chegando com muita vontade...`,
      ],
      attempt: [
        `💥 ${O} VAI COM OS DOIS PÉS na frente em ${V}! Apito! O árbitro corre para o lance...`,
        `💥 Entrada de DOIS PÉS de ${O}! ${V} cai! O juiz apita e vai até lá...`,
        `💥 ${O} salta com os dois pés em ${V}! Apito, e o banco se levanta!`,
      ],
    };
    case 'tackle/highboot': return {
      buildUp: [
        `☁️ A bola sobra alta no meio-campo, e ${V} sobe para dominar, com ${O} perto...`,
        `🎯 ${V} vai amortecer a bola no peito, e ${O} chega junto...`,
        `☁️ Bola alta e disputa no meio: ${V} de um lado, ${O} do outro...`,
      ],
      attempt: [
        `💥 ${O} ESTICA A PERNA ALTA e acerta ${V} com a sola! Apito! O árbitro corre...`,
        `💥 Sola no peito de ${V}! ${O} chega alto e o juiz apita na hora!`,
        `💥 ${O} atinge ${V} com a chuteira lá no alto! Apito, e o estádio reclama!`,
      ],
    };
    case 'lastman/pull': return {
      buildUp: [
        `🏃 ${V} sai em disparada rumo ao gol, com só ${G} pela frente... e ${O} correndo atrás!`,
        `⚡ ${V} está lançado! ${O} é o último defensor e tenta alcançá-lo...`,
        `🚀 Lançamento e ${V} escapa da defesa de ${T}! ${O} corre desesperado atrás...`,
      ],
      attempt: [
        `🛑 ${O} AGARRA A CAMISA de ${V} quando ele ia ficar cara a cara com ${G}! Apito!`,
        `🛑 ${O} puxa ${V} pela camisa e derruba o atacante! O árbitro apita e corre!`,
        `🛑 ${O} segura ${V} na hora H, impedindo a chance clara! Apito! O juiz vai ao bolso?`,
      ],
    };
    case 'lastman/clip': return {
      buildUp: [
        `🚀 ${V} fica livre e parte para cima de ${G}! ${O} tenta alcançá-lo...`,
        `🏃 ${V} sai na frente da defesa de ${T}, e ${O} corre para tentar fechar...`,
        `⚡ ${V} escapa pelo meio, com ${O} como último homem...`,
      ],
      attempt: [
        `🛑 ${O} ENGANCHA os pés de ${V} dentro da jogada e o atacante cai! Apito! Chance clara de gol!`,
        `🛑 ${O} toca no calcanhar de ${V}, que vai ao chão! Apito, o árbitro corre!`,
        `🛑 ${O} derruba ${V} que ia sozinho para o gol! Apito!`,
      ],
    };
    case 'lastman/bodycheck': return {
      buildUp: [
        `🏃 ${V} sai na frente com espaço, e ${O} vem de lado tentando alcançá-lo...`,
        `⚡ ${V} acelera rumo ao gol! ${O} corre em diagonal para fechar o caminho...`,
        `🚀 ${V} escapa da marcação e vai para cima de ${G}...`,
      ],
      attempt: [
        `🛑 ${O} ENTRA NO OMBRO e joga ${V} longe da bola! Apito! O árbitro vem correndo...`,
        `🛑 Trombada de ${O} em ${V}, que ia sozinho! Apito!`,
        `🛑 ${O} dá um tranco em ${V} e corta a jogada na marra! Apito!`,
      ],
    };
    case 'handball/line': return {
      buildUp: [
        `🚩 Bola levantada na área de ${T}! ${V} se prepara para subir...`,
        `🚩 Cruzamento da linha de fundo! A bola vem para a área, com ${V} atacando...`,
        `🚩 A bola vem alta para dentro da área! ${V} vai ao encontro dela...`,
      ],
      attempt: [
        `🧤 ${V} CABECEIA PARA O GOL... e ${O} TIRA COM A MÃO em cima da linha! Apito!`,
        `🧤 A bola vai no canto... ${O} espalma em cima da linha! É mão! Apito!`,
        `🧤 Cabeçada de ${V}! ${O} corta com o braço em cima da linha! O árbitro apita!`,
      ],
    };
    case 'handball/block': return {
      buildUp: [
        `⚡ ${V} ajeita e prepara o chute da entrada da área...`,
        `🔭 ${V} recebe na entrada da área e arma o chute, com ${O} se jogando para fechar...`,
        `💣 ${V} entra na área com espaço para bater...`,
      ],
      attempt: [
        `🧤 ${V} CHUTA PARA O GOL... e a bola bate no braço de ${O}! Apito!`,
        `🧤 ${V} finaliza e ${O} se joga na frente... bola na mão! Apito!`,
        `🧤 Chute forte de ${V}! ${O} bloqueia com o braço aberto! O árbitro apita na hora!`,
      ],
    };
    case 'secondyellow/late': return {
      buildUp: [
        `⚡ ${V} arranca pela lateral com a bola, e ${O}, que já tem amarelo, corre atrás...`,
        `💨 Contra-ataque de ${U}! ${V} escapa e ${O} vem de longe, pendurado...`,
        `🏃 ${V} sai na ponta e ${O}, já amarelado, tenta alcançá-lo...`,
      ],
      attempt: [
        `💥 ${O}, que JÁ ESTÁ AMARELADO, chega atrasado em ${V}! Apito! O juiz vai ao bolso...`,
        `💥 Carrinho tardio de ${O} em ${V}, com a bola já longe! Apito! O árbitro corre para lá...`,
        `💥 ${O} chega depois da bola e leva ${V}! Apito! Ele já tinha amarelo...`,
      ],
    };
    case 'secondyellow/shirt': return {
      buildUp: [
        `⚡ ${V} arranca pelo lado com a bola, e ${O}, pendurado, vem junto...`,
        `🏃 Transição rápida de ${U}! ${V} acelera, com ${O} grudado nele...`,
        `💨 ${V} sai em velocidade e ${O}, que já foi amarelado, corre ao lado...`,
      ],
      attempt: [
        `🟨 ${O}, amarelado, PUXA A CAMISA de ${V}! Apito! O árbitro vai ao bolso...`,
        `🟨 ${O} segura ${V} pela camisa, de novo! Apito! Ele já tinha amarelo...`,
        `🟨 Puxão de ${O} em ${V} para parar o contra-ataque! Apito, e o juiz corre...`,
      ],
    };
    case 'elbow/aerial': return {
      buildUp: [
        `☁️ Bola longa para o meio-campo! ${V} e ${O} sobem juntos...`,
        `☁️ Lançamento alto: ${V} e ${O} vão disputar pelo alto...`,
        `🎯 A bola vem lá de trás e ${V} e ${O} saltam ao mesmo tempo...`,
      ],
      attempt: [
        `💢 ${V} e ${O} sobem juntos... e ${O} ABRE O COTOVELO no rosto de ${V}! Apito!`,
        `💢 Disputa pelo alto e ${O} acerta ${V} com o cotovelo! Apito, o jogador cai!`,
        `💢 ${O} sobe com o braço aberto e atinge ${V} no rosto! O árbitro apita!`,
      ],
    };
    case 'elbow/blind': return {
      buildUp: [
        `🚩 Cruzamento para a área! ${V} e ${O} se pegam na marcação...`,
        `🚩 A bola vem da ponta, e ${V} e ${O} brigam por posição na área...`,
        `🎯 Bola levantada: ${V} e ${O} empurram um ao outro na disputa...`,
      ],
      attempt: [
        `💢 Longe da bola, ${O} dá uma COTOVELADA em ${V}! O árbitro viu e apita!`,
        `💢 ${O} acerta o cotovelo no rosto de ${V}, sem disputar a bola! Apito!`,
        `💢 ${V} cai na área depois de uma cotovelada de ${O}! Apito, e o juiz corre!`,
      ],
    };
    case 'brawl/shove': return {
      buildUp: [
        `😠 O clima esquenta! ${V} e ${O} se encaram depois de um lance...`,
        `😠 ${V} e ${O} trocam provocações no meio-campo...`,
        `😤 ${O} e ${V} discutem, cara a cara, depois da dividida...`,
      ],
      attempt: [
        `😡 ${O} EMPURRA ${V} com as duas mãos! Apito! Os jogadores correm para lá!`,
        `😡 Empurrão de ${O} em ${V}, e a confusão começa! Apito!`,
        `😡 ${O} perde a cabeça e empurra ${V}! O árbitro apita e corre para separar!`,
      ],
    };
    case 'brawl/melee': return {
      buildUp: [
        `😠 O jogo está quente! ${V} e ${O} se desentendem em campo...`,
        `😤 Discussão entre ${V} e ${O}, e os companheiros se aproximam...`,
        `😠 ${O} e ${V} trocam empurrões, e o clima pesa...`,
      ],
      attempt: [
        `😡 CONFUSÃO! ${O} parte para cima de ${V} e os dois times se juntam! Apito!`,
        `😡 Briga generalizada! ${O} empurra ${V} e todo mundo corre para lá! Apito!`,
        `😡 ${O} e ${V} se agarram, e a confusão toma conta do campo! O árbitro apita!`,
      ],
    };
    default: return linesFor('tackle', 'behind', n);
  }
}

/** A line the match has not read lately (any, when all have been). */
function pickFresh(list: readonly string[], recent: readonly string[], rng: () => number): string {
  const fresh = list.filter(line => !recent.includes(line));
  const pool = fresh.length ? fresh : list;
  return pool[Math.floor(rng() * pool.length)];
}

export function redCardSeed(event: MatchEvent, eventIndex: number): number {
  return seedFromString(`${eventIndex}|${event.minute}|red|${event.teamId}|${event.playerId ?? ''}`);
}

export function narrateRedCard(args: {
  event: MatchEvent;
  eventIndex: number;
  homeTeam: Team;
  awayTeam: Team;
  /** The player the engine's foul says was fouled. */
  victimId?: string;
  /** Lines this match has read lately, so they vary. */
  recent?: readonly string[];
  force?: { kind?: RedKind; variant?: RedVariant };
  /** Name of a keeper to use when the fouled team's victim is facing one. */
  goalkeeperName?: (team: Team) => string;
}): RedCardNarration {
  const { event, eventIndex, homeTeam, awayTeam, recent = [] } = args;
  const rng = seededRandom(redCardSeed(event, eventIndex));
  const kind = args.force?.kind ?? redKindOf(event);
  const variantDraw = rng();
  const recorded = isRedVariantOf(kind, event.redVariant) ? event.redVariant : undefined;
  const variant = isRedVariantOf(kind, args.force?.variant) ? args.force!.variant! : recorded ?? redVariantFor(kind, variantDraw);

  const offTeam = event.teamId === homeTeam.id ? homeTeam : awayTeam;
  const otherTeam = offTeam.id === homeTeam.id ? awayTeam : homeTeam;
  const offender = offTeam.players.find(p => p.id === event.playerId);
  const victim = otherTeam.players.find(p => p.id === args.victimId);
  const keeper = offTeam.players.find(p => p.position === 'GK');
  const names: Names = {
    O: offender?.shortName ?? 'O zagueiro',
    V: victim?.shortName ?? 'o atacante',
    G: args.goalkeeperName?.(offTeam) ?? keeper?.shortName ?? offTeam.name,
    T: offTeam.name,
    U: otherTeam.name,
  };
  const lines = linesFor(kind, variant, names);
  const buildUp = pickFresh(lines.buildUp, recent, rng);
  const attempt = pickFresh(lines.attempt, recent, rng);
  return {
    kind, variant, offenderId: event.playerId, victimId: args.victimId, offenderTeamId: offTeam.id,
    buildUp,
    attempt,
    // A second yellow always says so (a replay with another line would read as a straight red).
    reveal: kind === 'secondyellow' && !/amarelo/i.test(event.description) ? `🟥 SEGUNDO AMARELO! ${names.O} é expulso de campo!` : event.description,
  };
}
