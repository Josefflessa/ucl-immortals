/**
 * The three beats a danger is narrated with on the match screen (build-up,
 * attempt, reveal), built from the play the engine actually simulated. The
 * narration also picks how the play unfolds (its variant) and how it ends (its
 * finish: low or in the top corner, parried or held, wide or blocked...), and the
 * live pitch plays exactly that, so the words always match the picture. Every
 * choice is drawn from a source seeded by the event, so the same match reads the
 * same on every device and on every replay.
 */
import type { MatchEvent, Team } from './engine/teamModel';
import type { Approach } from './matchNarrative';
import { allowsAssist, epicFinishesFor, finishesFor, isEpic, isEpicVariant, PLAY_VARIANTS, serverRolesFor, strikeClassOf, variantFor, type FinishStyle, type PlayVariant } from './playVariants';
import { rollEpic } from './epicPlays';
import { formationRoleForPlayer } from './engine/teamModel';
import { random, seededRandom, seedFromString, withRandomSource } from './random';
import type { MatchPlay, PlayKind } from './engine/teamModel';

export type DangerOutcome = 'goal' | 'save' | 'miss';
export type { FinishStyle } from './playVariants';

export interface DangerNarration {
  attackTeamId: string;
  outcome: DangerOutcome;
  isOwnGoal: boolean;
  /** On an own goal: "Gol Contra (Fulano)". */
  attackerName: string;
  defenderName: string;
  goalkeeperName: string;
  /** How the play unfolds on the pitch (the build-up and attempt lines describe it). */
  variant: PlayVariant;
  /** How it ends (the reveal describes it). */
  finish: FinishStyle;
  /** One of the rare, memorable plays (shown with its own badge). */
  epic: boolean;
  buildUp: string;
  attempt: string;
  reveal: string;
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];

export function dangerSeed(event: MatchEvent, eventIndex: number): number {
  return seedFromString(`${eventIndex}|${event.minute}|${event.type}|${event.teamId}|${event.playerId ?? ''}|${event.opponentId ?? ''}`);
}

const OPEN_PLAY: ReadonlySet<string> = new Set(['cross', 'through', 'dribble', 'longrange', 'counter']);

/** The open-play wording that fits a recorded play (legacy events without a play read as a through ball). */
export function approachForPlay(play: MatchPlay | undefined): Approach {
  if (!play) return 'through';
  if (OPEN_PLAY.has(play.kind)) return play.kind as Approach;
  if (play.kind === 'corner') return 'cross';
  if (play.kind === 'freekick' || play.kind === 'penalty' || play.kind === 'screamer') return 'longrange';
  return 'dribble';
}

/** Names used by the lines: finisher (A), the one who serves it (W), the marker (D), the keeper (G), the team (T), the own-goal scorer (O). */
interface Names { A: string; W: string; D: string; G: string; T: string; O: string }

/** Build-up (stage 1) and strike (stage 2) lines for each variant of each play. */
function linesFor(kind: PlayKind, variant: PlayVariant, n: Names, assisted: boolean): { buildUp: string[]; attempt: string[] } {
  const { A, W, D, G, T, O } = n;
  const headers = [
    `⚽ ${A} sobe mais que ${D} e CABECEIA...!`, `⚽ Subida de ${A} na área, cabeçada firme...!`, `⚽ ${A} se antecipa a ${D} e testa para o gol...!`,
    `⚽ ${A} ganha pelo alto de ${D} e manda de cabeça...!`, `⚽ ${A} aparece no meio da zaga e cabeceia...!`, `⚽ Testada de ${A}, firme, em direção ao gol...!`,
  ];
  const oneOnOne = [
    `⚽ ${A} fica cara a cara com ${G} e finaliza...!`, `⚽ ${A} invade a área e bate na saída de ${G}...!`, `⚽ ${A} sai sozinho na frente de ${G} e bate...!`,
    `⚽ Só ${G} pela frente... ${A} finaliza...!`, `⚽ ${A} encara ${G} e finaliza...!`, `⚽ ${A} entra livre na área e chuta na saída de ${G}...!`,
  ];
  const longShots = [
    `⚽ ${A} ARMA O CHUTE e solta a bomba de longe...!`, `⚽ ${A} arrisca de fora da área...!`, `⚽ ${A} ajeita o corpo e chuta forte...!`,
    `⚽ ${A} solta o pé de longe...!`, `⚽ Lá de fora! ${A} tenta o chute...!`, `⚽ ${A} enche o pé da entrada da área...!`,
  ];
  const cutInside = {
    buildUp: [`💨 ${A} parte para cima de ${D} pela ponta...`, `🌀 ${A} ameaça ir para a linha de fundo diante de ${D}...`],
    attempt: [`⚽ ${A} corta para dentro e bate colocado, de curva...!`, `⚽ Corte para o meio e ${A} chuta buscando o canto...!`],
  };
  const layoff = {
    buildUp: [
      `💣 ${W} ajeita para ${A}, que prepara o chute de fora da área...`, `🔭 ${A} recebe de ${W} na intermediária, com espaço...`,
      `💣 ${W} rola para ${A}, que vem de trás com espaço para bater...`, `🔭 ${A} recebe de ${W} na entrada da área e ninguém chega nele...`,
    ],
    attempt: longShots,
  };
  const halfCleared = {
    buildUp: [
      `💣 A zaga afasta mal e a bola sobra para ${A}, de frente para o gol...`, `🔭 Rebote da defesa! A bola cai na direção de ${A}...`,
      `💣 Corte parcial da zaga, e a sobra é de ${A}...`, `🔭 A defesa rebate e a bola vem limpa para ${A}...`,
    ],
    attempt: [`⚽ ${A} pega de primeira, de voleio...!`, `⚽ ${A} emenda de primeira o rebote...!`],
  };
  const takeOn = {
    buildUp: [`💨 ${A} parte para cima de ${D} com a bola dominada...`, `⚡ Encarada! ${A} tenta passar por ${D}...`],
    attempt: [`⚽ ${A} deixa ${D} para trás e finaliza...!`, `⚽ Drible em ${D} e ${A} solta a perna...!`],
  };
  switch (kind) {
    case 'cross':
      if (variant === 'trivela') return {
        buildUp: [`🌀 ${W} cruza de trivela e a bola faz a curva na direção de ${A}...`, `🌀 Cruzamento de três dedos de ${W}, fechando no segundo pau...`, `🌀 ${W} pega com o lado de fora do pé e a bola viaja em curva para ${A}...`],
        attempt: headers,
      };
      if (variant === 'lowfar') return {
        buildUp: [`➡️ ${W} cruza rasteiro e a bola atravessa toda a pequena área...`, `➡️ Bola rasteira de ${W} passando por todo mundo, rumo ao segundo pau...`, `➡️ ${W} manda rasteiro para trás da zaga, onde chega ${A}...`],
        attempt: [`⚽ ${A} chega no segundo pau e bate de primeira...!`, `⚽ ${A} aparece livre na segunda trave e finaliza de primeira...!`, `⚽ ${A} só empurra, de primeira, no segundo pau...!`],
      };
      if (variant === 'bicycle') return {
        buildUp: [`↗️ ${W} cruza alto e a bola passa um pouco atrás de ${A}...`, `↗️ Cruzamento de ${W}; ${A} está de costas para o gol...`],
        attempt: [`🚲 BICICLETAAAA! ${A} se joga no ar e pega de bicicleta...!`, `🚲 ${A}, de costas para o gol... TENTA A BICICLETA...!`],
      };
      if (variant === 'diving') return {
        buildUp: [`➡️ ${W} cruza na meia altura, a bola vem baixa e rápida...`, `➡️ Cruzamento rasante de ${W} na direção de ${A}...`],
        attempt: [`🐟 PEIXINHO! ${A} mergulha e cabeceia rente ao chão...!`, `🐟 ${A} se atira de cabeça na bola...!`],
      };
      if (variant === 'backheel') return {
        buildUp: [`↩️ ${W} cruza rasteiro, mas a bola passa um pouco atrás de ${A}...`, `↩️ ${W} chega à linha de fundo e cruza; ${A} está de costas para o gol...`],
        attempt: [`👠 DE CALCANHAR! ${A} improvisa e toca de calcanhar para o gol...!`, `👠 ${A} inventa um toque de calcanhar...!`],
      };
      if (variant === 'early') return {
        buildUp: [`↗️ ${W} cruza cedo, antes da marcação chegar, procurando ${A}...`, `🎯 Bola levantada da intermediária por ${W} na direção de ${A}...`],
        attempt: headers,
      };
      if (variant === 'cutback') return {
        buildUp: [`🏃 ${W} vai até a linha de fundo e rola para trás, procurando ${A}...`, `↩️ ${W} chega ao fundo e toca para trás, na entrada da área...`],
        attempt: [`⚽ ${A} chega batendo de primeira...!`, `⚽ ${A} pega de primeira na marca do pênalti...!`],
      };
      if (variant === 'overlap') return {
        buildUp: [`🏃 ${W} passa em velocidade por fora e recebe na ponta...`, `↗️ Ultrapassagem de ${W} pela lateral, de olho em ${A} na área...`],
        attempt: headers,
      };
      if (variant === 'volley') return {
        buildUp: [`↗️ ${W} cruza para a segunda trave, onde aparece ${A}...`, `🏃 ${W} levanta da ponta e a bola atravessa a área na direção de ${A}...`],
        attempt: [`⚽ ${A} pega de VOLEIO na segunda trave...!`, `⚽ ${A} emenda de primeira, sem deixar a bola cair...!`],
      };
      if (variant === 'driven') return {
        buildUp: [`➡️ ${W} avança pela ponta e cruza rasteiro, com força...`, `➡️ ${W} manda um cruzamento rasteiro e tenso para a pequena área...`],
        attempt: [`⚽ ${A} se antecipa no primeiro poste e desvia de primeira...!`, `⚽ ${A} chega de carrinho no primeiro poste...!`],
      };
      return {
        buildUp: [`↗️ ${W} avança pela ponta e levanta na área para ${A}...`, `🏃 ${W} ganha da marcação pela ponta e cruza na cabeça de ${A}...`],
        attempt: headers,
      };
    case 'own_goal': {
      const attempt = [`⚽ A bola viaja perigosamente em direção ao gol...!`, `⚽ ${O} toca na bola... e ela vai na direção do gol...!`];
      if (variant === 'cutback') return { buildUp: [`↩️ ${W} chega ao fundo e rola para trás; ${O} se joga para cortar...`], attempt };
      if (variant === 'clearance') return { buildUp: [`➡️ ${W} cruza rasteiro e forte; ${O} estica a perna para afastar...`], attempt };
      return { buildUp: [`↗️ ${W} cruza da ponta e ${O} sobe para tentar cortar...`], attempt };
    }
    case 'through':
      if (variant === 'heelpass') return {
        buildUp: [`👠 ${W} recebe de costas e toca de calcanhar para ${A}...`, `👠 Calcanhar de ${W}! A bola sai nas costas de ${D} para ${A}...`, `👠 ${W} nem olha: de calcanhar, deixa ${A} na cara do gol...`],
        attempt: oneOnOne,
      };
      if (variant === 'dummy') return {
        buildUp: [`🙈 Corta-luz! O passe de ${W} passa por um companheiro e chega a ${A}...`, `🙈 ${W} toca, o companheiro deixa passar e ${A} recebe livre...`, `🙈 Que inteligência! O corta-luz deixa ${A} livre diante de ${D}...`],
        attempt: oneOnOne,
      };
      if (variant === 'tikitaka') return {
        buildUp: [`🎼 ...e depois de tanto toque, ${W} enfia para ${A}!`, `🎼 Toca, toca, toca... e ${W} acha ${A} nas costas de ${D}!`],
        attempt: oneOnOne,
      };
      if (variant === 'onetwo') return {
        buildUp: [`🔑 Tabela! ${A} toca em ${W}, que devolve nas costas de ${D}...`, `⚡ ${A} e ${W} tabelam e abrem a defesa...`],
        attempt: oneOnOne,
      };
      if (variant === 'channel') return {
        buildUp: [`📐 ${W} recebe aberto e põe em diagonal para ${A}, nas costas de ${D}...`, `🔑 Bola em diagonal de ${W} e ${A} ataca o espaço...`],
        attempt: oneOnOne,
      };
      if (variant === 'lofted') return {
        buildUp: [`🎯 Lançamento por cima da zaga! ${W} encontra ${A}...`, `🎯 ${W} cava a bola por cima de ${D} para ${A}...`],
        attempt: [`⚽ ${A} domina dentro da área e finaliza...!`, `⚽ ${A} ajeita e chuta antes da chegada de ${D}...!`],
      };
      if (variant === 'roundkeeper') return {
        buildUp: [`🔑 ${W} enfia para ${A}, que escapa de ${D}, e ${G} sai do gol...`, `⚡ ${A} recebe de ${W} nas costas de ${D}; ${G} sai para abafar...`],
        attempt: [`⚽ ${A} dribla ${G}...!`, `⚽ ${A} tira ${G} da jogada e finaliza...!`],
      };
      if (variant === 'split') return {
        buildUp: [`🔑 ${W} enfia a bola entre os zagueiros! ${A} dispara...`, `⚡ Passe que rasga a zaga! ${W} encontra ${A} entre os dois zagueiros...`],
        attempt: oneOnOne,
      };
      return {
        buildUp: [`🔑 Passe em profundidade de ${W}! ${A} escapa nas costas de ${D}...`, `⚡ ${W} enxerga ${A} entrando e enfia a bola...`],
        attempt: oneOnOne,
      };
    case 'dribble':
      // Scored with an assist: the run starts from the pass.
      if (assisted) {
        const fromPass: Record<string, string[]> = {
          single: [`💨 ${W} toca para ${A}, que parte para cima de ${D}...`, `⚡ ${A} recebe de ${W} e encara ${D}...`],
          double: [`💨 ${A} recebe de ${W}, passa por ${D} e segue em direção à área...`],
          cutinside: [`💨 ${A} recebe de ${W} pela ponta e encara ${D}...`],
          solo: [`🚀 ${W} toca na frente e ${A} arranca, deixando ${D} para trás...`],
          hurdle: [`💨 ${A} recebe de ${W} e ${D} vem no carrinho...`],
          nutmeg: [`🤯 ${A} recebe de ${W} e dá uma caneta em ${D}...`],
          elastico: [`🪄 ${A} recebe de ${W}, encara ${D}... ELÁSTICO!`],
          chapeu: [`🎩 ${A} recebe de ${W} e dá um chapéu em ${D}...`],
        };
        const base = linesFor(kind, variant, n, false);
        return { buildUp: fromPass[variant] ?? base.buildUp, attempt: base.attempt };
      }
      if (variant === 'double') return {
        buildUp: [`💨 ${A} passa por ${D} e segue em direção à área...`, `🔥 ${A} limpa ${D} e ainda encontra mais um pela frente...`],
        attempt: [`⚽ ${A} passa pelo segundo marcador e bate...!`, `⚽ Que jogada! ${A} deixa dois para trás e finaliza...!`],
      };
      if (variant === 'cutinside') return cutInside;
      if (variant === 'elastico') return {
        buildUp: [`🪄 ${A} encara ${D}... ELÁSTICO!`, `🪄 ${A} ameaça para um lado e sai para o outro: elástico em ${D}...`, `🪄 Que drible! ${A} dá um elástico em ${D}...`],
        attempt: [`⚽ ${A} deixa ${D} na saudade e finaliza...!`, `⚽ Depois do elástico, ${A} solta a perna...!`],
      };
      if (variant === 'chapeu') return {
        buildUp: [`🎩 CHAPÉU! ${A} levanta a bola por cima de ${D}...`, `🎩 ${A} dá um lençol em ${D} e vai buscar do outro lado...`, `🎩 Que ousadia! ${A} encobre ${D} com a bola...`],
        attempt: [`⚽ ${A} pega de primeira, antes da bola cair...!`, `⚽ ${A} chega do outro lado e emenda de primeira...!`],
      };
      if (variant === 'slalom') return {
        buildUp: [`💨 ...e ${A} já está na área, encarando ${D}!`, `💨 ${A} chega à área e ainda tem ${D} pela frente...`],
        attempt: [`⚽ Passa por ${D} também e finaliza...!`, `⚽ ${A} deixa ${D} no chão e bate...!`],
      };
      if (variant === 'nutmeg') return {
        buildUp: [`🤯 CANETA! ${A} passa a bola entre as pernas de ${D}...`, `🤯 ${A} dá uma caneta em ${D} e segue com a bola...`],
        attempt: [`⚽ ${A} invade a área e bate...!`, `⚽ ${A} ajeita e finaliza...!`],
      };
      if (variant === 'hurdle') return {
        buildUp: [`💨 ${A} avança com a bola e ${D} vem no carrinho...`, `⚡ Carrinho de ${D}! ${A} toca na frente e pula por cima...`],
        attempt: [`⚽ ${A} se livra do carrinho e finaliza...!`, `⚽ ${A} deixa ${D} no chão e bate...!`],
      };
      if (variant === 'solo') return {
        buildUp: [`💨 ${A} toca na frente de ${D} e dispara em velocidade...`, `🚀 Arrancada de ${A}! Deixa ${D} para trás...`],
        attempt: oneOnOne,
      };
      return takeOn;
    case 'blunder':
      if (variant === 'longshot') return {
        buildUp: [`🔭 ${A} recebe de ${W} longe do gol, sem marcação...`],
        attempt: [`⚽ ${A} arrisca de longe, sem muita força, em cima de ${G}...!`],
      };
      return {
        buildUp: takeOn.buildUp,
        attempt: [`⚽ ${A} finaliza rasteiro em direção a ${G}...!`, `⚽ ${A} bate sem muita força no canto de ${G}...!`],
      };
    case 'deflected':
      return variant === 'dribble' ? takeOn : layoff;
    case 'longrange':
      if (variant === 'clearance') return halfCleared;
      if (variant === 'carryshot') return {
        buildUp: [`🏃 ${A} arranca desde o meio-campo e ninguém chega nele...`, `🏃 ${A} conduz pelo meio e a zaga vai recuando...`, `🏃 ${A} avança com a bola dominada, ganhando metros...`],
        attempt: [`⚽ ${A} levanta os olhos e solta a BOMBA de fora da área...!`, ...longShots],
      };
      if (variant === 'knockdown') return {
        buildUp: [`🤜 ${W} escora de cabeça para ${A}, na entrada da área...`, `🤜 Bola alta, ${W} ajeita de cabeça e ela cai para ${A}...`, `🤜 ${W} ganha no alto e escora para ${A}, que vem de trás...`, `🤜 Cabeçada de ${W} para o meio, e a bola sobra para ${A}...`],
        attempt: [`⚽ ${A} emenda de primeira, de fora da área...!`, `⚽ ${A} pega de sem-pulo, de longe...!`],
      };
      if (variant === 'halfway') return {
        buildUp: [`👀 ${A} recebe no meio-campo e vê ${G} adiantado...`, `👀 ${A} levanta a cabeça no meio-campo: ${G} está fora do gol...`],
        attempt: [`🚀 ${A} ARRISCA DO MEIO-CAMPO...!`, `🚀 DO MEIO DE CAMPO! ${A} chuta por cima de ${G}...!`],
      };
      if (variant === 'square') return {
        buildUp: [`↔️ ${W} rola para o meio, na entrada da área, para ${A}...`, `↔️ ${W} toca de lado procurando ${A} na meia-lua...`],
        attempt: [`⚽ ${A} ajeita e solta o pé da entrada da área...!`, ...longShots],
      };
      return layoff;
    case 'woodwork':
      if (variant === 'curler') return cutInside;
      return variant === 'clearance' ? halfCleared : layoff;
    case 'counter':
      if (variant === 'threevtwo') return {
        buildUp: [`⚡ CONTRA-ATAQUE! Três contra dois! ${W} conduz e abre o jogo...`, `🚀 O ${T} chega em superioridade: três contra dois, com ${W} na bola...`],
        attempt: [`⚽ ${W} inverte para ${A}, que chega batendo...!`, `⚽ A bola chega a ${A} do outro lado e ele finaliza...!`],
      };
      if (variant === 'overlap') return {
        buildUp: [`⚡ ${W} puxa o contra-ataque e ${A} passa por fora em velocidade...`, `🚀 ${A} faz a ultrapassagem e recebe de ${W} lá na frente...`],
        attempt: [`⚽ ${A} invade a área e bate cruzado...!`, ...oneOnOne],
      };
      if (variant === 'carry') return {
        buildUp: [`⚡ CONTRA-ATAQUE! ${W} conduz em velocidade com ${A} ao lado...`, `💨 ${W} carrega a bola no campo aberto e procura ${A}...`],
        attempt: [`⚽ ${W} rola para ${A}, que bate de primeira...!`, `⚽ Passe de ${W} e ${A} finaliza de primeira...!`],
      };
      if (variant === 'twoonone') return {
        buildUp: [`⚡ CONTRA-ATAQUE! Dois contra um! ${W} conduz e só ${D} está na frente...`, `💨 ${W} puxa o contra-ataque com ${A} livre ao lado e só ${D} para marcar...`],
        attempt: [`⚽ ${W} atrai ${D} e rola para ${A}, que bate de primeira...!`, `⚽ ${D} vai em ${W}, que toca para ${A} finalizar...!`],
      };
      if (variant === 'recovery') return {
        buildUp: [`⚡ CONTRA-ATAQUE! ${A} dispara e ${D} volta para tentar o carrinho...`, `🚀 ${A} sai em velocidade; ${D} se joga no carrinho e não alcança...`],
        attempt: [`⚽ ${A} escapa do carrinho de ${D} e fica cara a cara com ${G}...!`, `⚽ ${A} salta o carrinho e finaliza na saída de ${G}...!`],
      };
      if (variant === 'breakaway') return {
        buildUp: [`⚡ CONTRA-ATAQUE! ${A} sai sozinho, com ${D} correndo atrás...`, `🚀 ${A} arranca sozinho em direção ao gol e ${D} não alcança...`],
        attempt: [`⚽ ${A} fica cara a cara com ${G}...!`, `⚽ ${G} sai do gol e ${A} finaliza...!`],
      };
      return {
        buildUp: [`⚡ CONTRA-ATAQUE! ${W} lança ${A} em velocidade...`, `💨 Bola recuperada pelo ${T} e lançamento de ${W} para ${A}...`],
        attempt: [`⚽ ${A} chega na frente de ${G} e bate...!`, `⚽ ${A} conclui o contra-ataque...!`],
      };
    case 'corner':
      if (variant === 'backpost') return {
        // With an assist, the assist provider is the one heading it back across.
        buildUp: assisted
          ? [`🚩 Escanteio para o ${T}! A cobrança vai no segundo pau e ${W} escora de cabeça para o meio...`]
          : [`🚩 Escanteio para o ${T}! ${W} levanta no segundo pau e a bola volta escorada para o meio...`, `🚩 ${W} cobra na segunda trave, um companheiro escora de cabeça para a pequena área...`],
        attempt: [`⚽ ${A} aparece no meio da área e cabeceia...!`, `⚽ ${A} completa de cabeça a escorada...!`],
      };
      if (variant === 'nearpower') return {
        buildUp: [`🚩 Escanteio ensaiado! ${W} cobra rasteiro e forte no primeiro pau...`, `🚩 ${W} manda o escanteio rasteiro, na direção de ${A} no primeiro poste...`],
        attempt: [`⚽ ${A} se antecipa e desvia de primeira...!`, `⚽ Toque de primeira de ${A} no primeiro pau...!`],
      };
      if (variant === 'olimpico') return {
        buildUp: [`🚩 ${A} vai para a cobrança do escanteio... e bate fechado, com muito efeito...`, `🚩 ${A} cobra o escanteio com veneno, fechando no gol...`],
        attempt: [`🌀 A bola faz a curva... VAI DIRETO PARA O GOL...!`, `🌀 Cobrança com efeito, a bola vai direto no gol...!`],
      };
      if (variant === 'near') return {
        buildUp: [`🚩 Escanteio para o ${T}! ${W} cobra fechado, no primeiro poste...`, `🚩 ${W} bate o escanteio na direção do primeiro pau...`, `🚩 Escanteio fechado de ${W}, buscando o primeiro poste...`],
        attempt: [`⚽ ${A} se antecipa no primeiro poste e cabeceia...!`, `⚽ Desvio de cabeça de ${A} no primeiro poste...!`],
      };
      if (variant === 'short') return {
        buildUp: [`🚩 Escanteio curto! O ${T} troca passes e ${W} cruza para a área...`, `🚩 O ${T} cobra curto e ${W} levanta na área...`],
        attempt: [`⚽ ${A} aparece no meio da área e cabeceia...!`, `⚽ ${A} ganha de ${D} pelo alto...!`],
      };
      if (variant === 'edge') return {
        buildUp: [`🚩 Escanteio para o ${T}! ${W} cobra rasteiro, para a entrada da área...`, `🚩 Escanteio ensaiado: ${W} rola para trás, na entrada da área...`],
        attempt: [`⚽ ${A} chega batendo de primeira, da entrada da área...!`, `⚽ ${A} solta o pé de primeira...!`],
      };
      if (variant === 'flick') return {
        buildUp: assisted
          ? [`🚩 Escanteio para o ${T}! A cobrança vai no primeiro poste e ${W} desvia de cabeça...`]
          : [`🚩 Escanteio para o ${T}! ${W} cobra no primeiro poste e a bola é desviada de cabeça...`],
        attempt: [`⚽ A bola atravessa a área e ${A} cabeceia no segundo poste...!`, `⚽ ${A} chega no segundo poste para completar de cabeça...!`],
      };
      return {
        buildUp: [`🚩 Escanteio para o ${T}! ${W} levanta na segunda trave...`, `🚩 ${W} cobra o escanteio aberto, no segundo pau...`, `🚩 Escanteio de ${W}: a bola viaja até a segunda trave...`],
        attempt: [`⚽ ${A} sobe na segunda trave e cabeceia...!`, `⚽ ${A} aparece no segundo poste e testa...!`],
      };
    case 'freekick':
      if (variant === 'routine') return {
        buildUp: [`🎯 Falta ensaiada! A bola é rolada para o lado...`, `🎯 Cobrança combinada: toque curto para ${A} chegar batendo...`, `🎯 Jogada de laboratório: toque de lado e ${A} vem de trás...`, `🎯 O ${T} inventa na falta: rolada curta para ${A}...`],
        attempt: [`⚽ ${A} chega batendo forte, por cima da barreira...!`, `⚽ ${A} solta a bomba depois do toque curto...!`],
      };
      if (variant === 'flank') return {
        buildUp: [`🎯 Falta pelo lado do campo: ${W} levanta na área...`, `🎯 ${W} cobra a falta lateral na direção de ${A}...`, `🎯 Falta da ponta: ${W} põe a bola na área...`],
        attempt: headers,
      };
      if (variant === 'distance') return {
        buildUp: [`🎯 Falta de muito longe, uns 35 metros... ${A} ajeita a bola.`, `🎯 ${A} vai bater a falta de longe, de onde ninguém arriscaria...`],
        attempt: [`🚀 ${A} solta uma BOMBA de 35 metros...!`, `🚀 ${A} ARRISCA DE MUITO LONGE na cobrança...!`],
      };
      if (variant === 'power') return {
        buildUp: [`🎯 Falta frontal! ${A} toma distância para bater forte...`, `🎯 ${A} dá uns passos para trás: vai bater com força...`, `🎯 Falta perigosa! ${A} toma uma longa distância para a cobrança...`],
        attempt: [`⚽ ${A} solta uma pancada por cima da barreira...!`, `⚽ ${A} bate com muita força, por cima da barreira...!`],
      };
      if (variant === 'under') return {
        buildUp: [`🎯 Falta perigosa! ${A} observa a barreira com atenção...`, `🎯 ${A} encara a barreira, estudando a cobrança...`, `🎯 Falta na entrada da área: ${A} olha para a barreira e para o gol...`],
        attempt: [`⚽ ${A} bate rasteiro, por baixo da barreira que sobe...!`, `⚽ A barreira pula e ${A} bate por baixo...!`],
      };
      return {
        buildUp: [
          `🎯 Falta perigosa na entrada da área! ${A} ajeita a bola para a cobrança direta.`,
          `🎯 ${A} posiciona a bola com carinho: vai bater direto...`,
          `🎯 Falta frontal para o ${T}! ${A} se prepara para a cobrança...`,
        ],
        attempt: [`⚽ ${A} cobra por cima da barreira...!`, `⚽ ${A} bate com curva por cima da barreira...!`, `⚽ ${A} levanta a bola por cima da barreira, com efeito...!`],
      };
    case 'penalty': {
      const buildUp = [
        `🎯 PÊNALTI! ${A} ajeita a bola na marca. ${G} se prepara em cima da linha.`,
        `🎯 PÊNALTI para o ${T}! ${A} vai para a cobrança, ${G} na linha...`,
        `🎯 ${A} pega a bola e coloca na marca do pênalti. ${G} pula na linha...`,
        `🎯 Pênalti! Frente a frente: ${A} e ${G}...`,
      ];
      if (variant === 'stutter') return { buildUp, attempt: [`⚽ ${A} faz a paradinha e bate...!`, `⚽ Paradinha de ${A}... e a batida...!`] };
      if (variant === 'power') return { buildUp, attempt: [`⚽ ${A} toma distância, corre forte e solta a bomba...!`, `⚽ ${A} corre e enche o pé...!`] };
      if (variant === 'panenka') return { buildUp, attempt: [`⚽ ${A} corre devagar... e tenta a cavadinha...!`, `⚽ ${A} espera o goleiro... e cava...!`] };
      return { buildUp, attempt: [`⚽ ${A} toma distância, corre para a bola e bate...!`, `⚽ ${A} parte para a bola e chuta...!`] };
    }
    case 'screamer':
      if (variant === 'volley') return {
        buildUp: [`💣 A zaga afasta o cruzamento de ${W} e a bola sobra para ${A}, muito longe do gol...`],
        attempt: [`⚽ ${A} pega de VOLEIO, de muito longe...!`, `⚽ ${A} emenda de primeira, com toda a força...!`],
      };
      return {
        buildUp: [`💣 ${A} domina com espaço, muito longe do gol...`, `🔭 ${A} levanta a cabeça a uns 30 metros do gol...`],
        attempt: [`⚽ ${A} solta uma BOMBA de muito longe...!`, `⚽ ${A} arrisca de longe com toda a força...!`],
      };
  }
}

/** The reveal of an epic play, in its own words (undefined: the ordinary reveal fits). */
function epicReveal(kind: PlayKind, variant: PlayVariant, finish: FinishStyle, n: Names): string[] | undefined {
  const { A, G, T } = n;
  const TT = T.toUpperCase();
  const goal = finish === 'low' || finish === 'high' || finish === 'postin';
  const key = `${kind}/${variant}`;
  switch (key) {
    case 'cross/bicycle':
      if (goal) return [`🔥🚲 GOLAÇO DE BICICLETA! ${A} acerta em cheio e ${G} não alcança! ${TT} MARCA!`, `🔥🚲 QUE GOL! BICICLETA DE ${A}! É para ficar na história!`];
      if (finish === 'parry') return [`🧤 ${G} VOA E ESPALMA A BICICLETA DE ${A}! Que lance!`];
      if (finish === 'tip') return [`🧤 ${G} tira a bicicleta de ${A} com a ponta dos dedos, por cima do travessão!`];
      if (finish === 'wide') return [`❌ A bicicleta de ${A} passa rente à trave! Que tentativa!`];
      if (finish === 'over') return [`❌ Por cima! A bicicleta de ${A} sai por cima do gol, mas que ousadia!`];
      if (finish === 'bar') return [`💥 NO TRAVESSÃO! A bicicleta de ${A} explode no travessão!`];
      return undefined;
    case 'cross/diving':
      if (goal) return [`🔥🐟 GOOOOL DE PEIXINHO! ${A} se atira na bola e manda para as redes!`, `🔥🐟 QUE CORAGEM! ${A} mergulha de cabeça e marca! ${TT} MARCA!`];
      if (finish === 'catch') return [`🧤 ${G} segura firme o peixinho de ${A}!`];
      if (finish === 'parry') return [`🧤 ${G} espalma o peixinho de ${A}!`];
      if (finish === 'feet') return [`🧤 ${G} salva com o pé o peixinho de ${A}!`];
      if (finish === 'wide') return [`❌ O peixinho de ${A} passa rente à trave!`];
      if (finish === 'post') return [`💥 NA TRAVE! O peixinho de ${A} explode no poste!`];
      return undefined;
    case 'cross/backheel':
      if (finish === 'postin') return [`🔥👠 DE CALCANHAR, NA TRAVE E PARA DENTRO! ${A} faz um gol de gênio!`];
      if (goal) return [`🔥👠 GOL DE CALCANHAR! ${A} inventa e marca! Que categoria!`, `🔥👠 DE CALCANHAR! ${A} faz um gol de craque! ${TT} MARCA!`];
      if (finish === 'catch') return [`🧤 ${G} estava atento e segura o calcanhar de ${A}!`];
      if (finish === 'parry') return [`🧤 ${G} espalma o toque de calcanhar de ${A}!`];
      if (finish === 'wide') return [`❌ O calcanhar de ${A} sai rente à trave! Quase um golaço!`];
      if (finish === 'post') return [`💥 NA TRAVE! O calcanhar de ${A} bate no poste!`];
      return undefined;
    case 'longrange/halfway':
      if (goal) return [`🔥🚀 GOOOOL DO MEIO-CAMPO! ${A} encobre ${G} de muito longe! INACREDITÁVEL!`, `🔥🚀 DO MEIO DE CAMPO! ${G} volta desesperado, mas não alcança! Golaço de ${A}!`];
      if (finish === 'tip') return [`🧤 ${G} volta correndo e tira com a ponta dos dedos, por cima do travessão! Que susto!`];
      if (finish === 'over') return [`❌ Por cima! O chute do meio-campo de ${A} passa por cima do gol!`];
      if (finish === 'wide') return [`❌ Rente à trave! ${A} quase marca do meio-campo!`];
      if (finish === 'bar') return [`💥 NO TRAVESSÃO! O chute do meio-campo de ${A} explode no travessão!`];
      return undefined;
    case 'corner/olimpico':
      if (goal) return [`🔥🌀 GOL OLÍMPICO! ${A} bate o escanteio direto para as redes!`, `🔥🌀 OLÍMPICO! A bola faz a curva e entra direto! Que cobrança de ${A}!`];
      if (finish === 'tip' || finish === 'parry') return [`🧤 ${G} percebe a malandragem e tira o escanteio que ia direto para o gol!`];
      if (finish === 'post') return [`💥 NA TRAVE! O escanteio de ${A} quase entra direto!`];
      if (finish === 'bar') return [`💥 NO TRAVESSÃO! O escanteio fechado de ${A} explode no travessão!`];
      return undefined;
    case 'freekick/distance':
      if (finish === 'postin') return [`🔥🚀 NA TRAVE E PARA DENTRO! Falta de muito longe de ${A}!`];
      if (goal) return [`🔥🚀 GOLAÇO DE FALTA DE 35 METROS! ${A} solta o pé e ${G} só olha!`, `🔥🚀 DE MUITO LONGE! A falta de ${A} entra no ângulo! ${TT} MARCA!`];
      if (finish === 'tip') return [`🧤 ${G} voa e tira a falta de longe de ${A} com a ponta dos dedos!`];
      if (finish === 'parry') return [`🧤 ${G} espalma a bomba de falta de ${A}!`];
      if (finish === 'over') return [`❌ Por cima! A falta de longe de ${A} passa por cima do gol!`];
      if (finish === 'bar') return [`💥 NO TRAVESSÃO! A falta de 35 metros de ${A} explode no travessão!`];
      return undefined;
    case 'dribble/slalom':
      if (finish === 'low' || finish === 'high') return [`🔥💨 GOLAÇO! ${A} saiu do próprio campo e passou por todo mundo! ${TT} MARCA!`, `🔥💨 QUE ARRANCADA! ${A} deixa todos para trás e marca um gol de placa!`];
      if (finish === 'parry' || finish === 'catch' || finish === 'feet') return [`🧤 ${G} para a arrancada histórica de ${A}!`, `🧤 Depois de driblar todo mundo, ${A} para em ${G}!`];
      if (finish === 'wide' || finish === 'over') return [`❌ Depois de passar por todos, ${A} manda para fora! Que pena!`];
      return undefined;
    case 'through/tikitaka':
      if (finish === 'low' || finish === 'high' || finish === 'chip') return [`🔥🎼 GOLAÇO COLETIVO! Mais de sete passes e ${A} conclui! Que jogada do ${T}!`, `🔥🎼 QUE TOQUE DE BOLA! O ${T} troca passes até ${A} marcar!`];
      return undefined;
  }
  return undefined;
}

/** The reveal (stage 3): exactly how it ended. */
function revealFor(kind: PlayKind, variant: PlayVariant, finish: FinishStyle, n: Names & { DT: string }): string[] {
  const { A, G, T, O, DT } = n;
  const TT = T.toUpperCase();
  const header = strikeClassOf(kind, variant) === 'header';
  const epic = epicReveal(kind, variant, finish, n);
  if (epic) return epic;
  switch (finish) {
    case 'double':
      return [`🧤🧤 MILAGRE DUPLO! ${G} defende o chute de ${A} e ainda salva o rebote!`, `🧤🧤 INACREDITÁVEL! ${G} faz duas defesas seguidas e a bola não entra!`, `🧤🧤 DUAS DEFESAS! ${G} salva o chute e o rebote de ${A}!`];
    case 'posts':
      return [`💥💥 NAS DUAS TRAVES! A bola bate em um poste, corre pela linha, bate no outro e sai!`, `💥💥 INACREDITÁVEL! ${A} acerta as duas traves e a bola não entra!`];
    // Goals
    case 'low':
      if (variant === 'roundkeeper') return [`🔥 GOOOOL! ${A} dribla ${G} e toca para o gol vazio!`, `🔥 GOOOOL! ${A} deixa ${G} no chão e empurra para as redes!`];
      if (header) return [`🔥 GOOOOL! Cabeçada para baixo de ${A}, a bola quica e entra! ${TT} MARCA!`, `🔥 GOOOOL! ${A} testa no chão e não dá chance para ${G}!`, `🔥 GOOOOL! ${A} cabeceia para o chão e a bola quica antes de entrar!`];
      if (kind === 'penalty') return [`🔥 GOOOOL! ${A} bate no canto e ${G} vai para o outro lado!`, `🔥 GOOOOL! Rasteiro, no cantinho! ${A} não desperdiça!`, `🔥 GOOOOL! ${A} desloca ${G} e bate no canto!`, `🔥 GOOOOL! Cobrança perfeita, rasteira, de ${A}!`];
      return [`🔥 GOOOOL! ${A} bate rasteiro, no cantinho, sem chance para ${G}!`, `🔥 GOOOOL! ${A} finaliza firme, rasteiro, e não dá chance para ${G}! ${TT} MARCA!`, `🔥 GOOOOL! Chute rasteiro de ${A}, no canto, e ${G} não alcança!`, `🔥 GOOOOL! ${A} tira de ${G} e coloca rasteiro no canto! ${TT} MARCA!`, `🔥 GOOOOL! Rasteiro e cruzado! ${A} não perdoa!`];
    case 'high':
      if (header) return [`🔥 GOOOOL! ${A} testa firme, no alto, sem chance para ${G}!`, `🔥 GOOOOL! Cabeçada no ângulo de ${A}! ${TT} MARCA!`, `🔥 GOOOOL! ${A} cabeceia no alto e a bola morre na rede!`];
      if (kind === 'penalty') return [`🔥 GOOOOL! ${A} enche o pé, no alto, sem defesa para ${G}!`, `🔥 GOOOOL! Pênalti no alto, sem chance para ${G}!`, `🔥 GOOOOL! ${A} bate forte, no ângulo! ${TT} MARCA!`];
      return [`🔥 GOOOOL! ${A} manda no ângulo! ${G} nem viu!`, `🔥 GOLAÇO! ${A} coloca no alto, onde a coruja dorme! ${TT} MARCA!`, `🔥 GOOOOL! Que pancada de ${A}, no alto! ${G} só olha!`, `🔥 GOLAÇO! ${A} acerta o ângulo de ${G}! ${TT} MARCA!`, `🔥 GOOOOL! ${A} estufa a rede, no alto!`];
    case 'chip':
      return [`🔥 GOOOOL! ${A} dá uma cavadinha por cima de ${G}! Que categoria!`, `🔥 GOOOOL! ${G} sai e ${A} toca por cobertura! ${TT} MARCA!`, `🔥 GOOOOL! Toque sutil de ${A} por cima de ${G}! Que golaço!`, `🔥 GOOOOL! ${A} encobre ${G} com classe!`];
    case 'postin':
      return [`🔥 GOOOOL! A bola beija a trave e entra! ${A} marca para o ${T}!`, `🔥 GOOOOL! Na trave e para dentro! Que finalização de ${A}!`, `🔥 GOOOOL! Bate na trave e entra! ${A} comemora!`, `🔥 GOOOOL! A bola resvala no poste e morre na rede! ${TT} MARCA!`];
    case 'deflect':
      if (kind === 'own_goal') {
        if (variant === 'cutback') return [`😱 GOL CONTRA! ${O} se joga para cortar e manda para as próprias redes! O ${TT} agradece!`];
        if (variant === 'clearance') return [`😱 GOL CONTRA! ${O} tenta afastar e acaba empurrando para dentro do próprio gol! O ${TT} agradece!`];
        return [`😱 GOL CONTRA de ${O} (${DT})! Ele desvia de cabeça contra a própria meta e o ${TT} agradece!`];
      }
      return [`🔥 GOOOOL! O chute de ${A} desvia no meio do caminho e engana ${G}!`, `🔥 GOOOOL! Desvio na zaga e a bola morre no fundo das redes! ${A} comemora!`, `🔥 GOOOOL! A bola desvia em um zagueiro e ${G} fica no meio do caminho!`, `🔥 GOOOOL! Chute de ${A}, desvio, e ${G} vendido no lance!`];
    case 'rebound':
      return [`🔥 GOOOOL! ${G} ainda defende, mas ${A} pega o rebote e marca!`, `🔥 GOOOOL! No rebote! ${G} espalma e ${A} não perdoa!`, `🔥 GOOOOL! ${G} solta a bola e ${A}, atento, empurra para as redes!`, `🔥 GOOOOL! Rebote para ${A}, que não desperdiça! ${TT} MARCA!`, `🔥 GOOOOL! ${A} estava no lugar certo e aproveita o rebote de ${G}!`];
    case 'fumble':
      return [`🤦 FRANGO! ${G} deixa a bola escapar entre as mãos e ${A} comemora! ${TT} MARCA!`, `🤦 QUE FALHA! O chute de ${A} passa por baixo de ${G} e entra!`, `🤦 QUE LAMBANÇA! ${G} falha feio e o chute de ${A} entra!`, `🤦 FRANGAÇO! A bola escorrega das mãos de ${G} e entra!`];
    case 'panenka':
      return [`🔥 GOOOOL DE CAVADINHA! ${A} espera ${G} cair e toca no meio! Que frieza!`];
    // Saves
    case 'parry':
      return [`🧤 PAREDÃO! ${G} espalma a finalização de ${A} para escanteio!`, `🧤 ${G} VOA E SALVA! Espalma para escanteio!`, `🧤 QUE DEFESA! ${G} se estica todo e tira de ${A}!`, `🧤 ${G} espalma com firmeza e manda para escanteio!`, `🧤 GRANDE DEFESA! ${G} desvia o chute de ${A} para a linha de fundo!`, `🧤 Espalmou! ${G} evita o gol de ${A}!`];
    case 'catch':
      if (kind === 'penalty' && variant === 'panenka') return [`🧤 ${G} NÃO CAI NA CAVADINHA! Fica em pé e segura a bola de ${A}!`];
      return [`🧤 SEGURA FIRME! ${G} encaixa a finalização de ${A}!`, `🧤 Seguro! ${G} fica com a bola e esfria o ataque.`, `🧤 DEFESAÇA DE ${G}! Encaixa sem dar rebote para ${A}!`, `🧤 ${G} encaixa sem susto o chute de ${A}.`, `🧤 Bem colocado, ${G} segura firme!`, `🧤 ${G} agarra a bola de ${A} sem dar rebote!`];
    case 'tip':
      return [`🧤 INCRÍVEL! ${G} tira com a ponta dos dedos por cima do travessão!`, `🧤 ${G} VOA NO ÂNGULO e manda para fora o chute de ${A}!`, `🧤 ${G} se estica e tira por cima do travessão!`, `🧤 Na pontinha dos dedos! ${G} salva o chute de ${A}!`, `🧤 QUE VOO! ${G} se atira e manda para fora!`];
    case 'feet':
      return [`🧤 ${G} SALVA COM O PÉ! Defesa milagrosa no chute de ${A}!`, `🧤 Com a perna! ${G} fecha o ângulo e bloqueia ${A}!`, `🧤 ${G} estica a perna e salva!`, `🧤 Defesa com o pé! ${G} tira o chute de ${A}!`];
    // Misses
    case 'wide':
      if (variant === 'roundkeeper') return [`❌ ${A} dribla ${G}, mas fica sem ângulo e manda para fora!`];
      return [`❌ PARA FORA! ${A} perdeu grande chance!`, `❌ ${A} finalizou mas mandou pela linha de fundo!`, `❌ QUE PERDIDA! ${A} tinha o gol na cara e mandou rente à trave!`, `❌ Passou raspando! ${A} mandou para fora!`, `❌ Para fora! O chute de ${A} sai pela linha de fundo.`, `❌ Rente à trave! ${A} quase marca!`];
    case 'over':
      if (kind === 'penalty' && variant === 'panenka') return [`❌ A CAVADINHA SAIU ALTA DEMAIS! ${A} manda por cima do gol!`];
      return [`❌ ISOLOU! ${A} pegou mal e mandou por cima do gol!`, `❌ Por cima! ${A} carregou demais na força.`, `❌ POR CIMA DO GOL! ${A} isolou a bola!`, `❌ ALTA DEMAIS! O chute de ${A} vai por cima do travessão!`, `❌ ${A} mandou para a arquibancada!`];
    case 'post':
      return [`💥 NA TRAVE! Que azar de ${A}!`, `💥 NO POSTE! ${A} acerta a trave e a bola volta!`, `💥 QUE AZAR! O chute de ${A} bate na trave!`, `💥 NO PAU! A bola de ${A} explode na trave!`, `💥 TRAVE! ${G} só olhou, mas o poste salvou!`];
    case 'bar':
      return [`💥 NO TRAVESSÃO! ${A} acerta o travessão e a bola volta para o campo!`, `💥 TRAVESSÃO! O chute de ${A} explode no travessão!`, `💥 NO TRAVESSÃO! Que pancada de ${A}!`, `💥 TRAVESSÃO! ${G} estava batido, mas a bola explode no travessão!`];
    case 'cleared':
      return [`😱 EM CIMA DA LINHA! ${G} já estava batido, mas a zaga salva o chute de ${A}!`, `😱 TIROU EM CIMA DA LINHA! A zaga salva e manda para escanteio!`, `😱 SALVOU EM CIMA DA LINHA! A bola de ${A} ia entrando!`, `😱 QUE CORTE! O zagueiro tira em cima da linha o chute de ${A}!`, `😱 NA LINHA! A defesa evita o gol de ${A} no último instante!`];
    case 'blocked':
      if (kind === 'freekick') return [`🧱 NA BARREIRA! A cobrança de ${A} explode na barreira e sai para escanteio.`];
      return [`🧱 BLOQUEADO! A zaga se joga na frente do chute de ${A} e a bola desvia para escanteio!`, `🧱 Travado! O chute de ${A} desvia na marcação e sai pela linha de fundo.`, `🧱 BLOQUEADO! O chute de ${A} explode no zagueiro e vai para escanteio!`, `🧱 Na marcação! A finalização de ${A} desvia e sai.`];
  }
}

/** How the ball reached the decisive move (as the pitch played it), with player ids. */
export interface LeadInLine {
  pattern: 'carry' | 'pass' | 'switch' | 'combo' | 'wall' | 'recovery' | 'settle' | 'slalom' | 'tikitaka'
    | 'throwin' | 'interception' | 'longball' | 'beat' | 'pivot';
  ownerId?: string; passerId?: string; secondId?: string; loserId?: string;
  /** A long lead-in's moments (ms from the start of the danger), with who is beaten there. */
  steps?: readonly { at: number; beatenId?: string }[];
}

/**
 * The lines read out along a long lead-in (the run from his own half, the long passing
 * move), each at the moment the pitch shows it. Empty for an ordinary lead-in.
 */
export function leadSteps(lead: LeadInLine, nameOf: (id?: string) => string | undefined, team: string, eventIndex: number): { at: number; line: string }[] {
  const steps = lead.steps ?? [];
  const O = nameOf(lead.ownerId) ?? team;
  const P = nameOf(lead.passerId) ?? team;
  const S = nameOf(lead.secondId) ?? team;
  const one = (list: string[]) => list[eventIndex % list.length];
  if (lead.pattern === 'slalom') {
    return steps.map((step, i) => {
      const B = nameOf(step.beatenId) ?? 'o marcador';
      return {
        at: step.at,
        line: i === 0
          ? one([`💨 Deixa ${B} para trás no bote!`, `💨 Passa por ${B}!`])
          : one([`💨 Pula o carrinho de ${B}! Ninguém segura ${O}!`, `💨 Passa por ${B} também, por cima do carrinho! ${O} segue!`]),
      };
    });
  }
  if (lead.pattern === 'tikitaka') {
    return steps.map((step, i) => ({
      at: step.at,
      line: i === 0
        ? one([`🎼 Toca ${P}, toca ${S}... o adversário só corre atrás!`, `🎼 ${P}, ${S}, de pé em pé... ninguém tira a bola do ${team}!`])
        : one([`🎼 Já são seis, sete passes seguidos! Olé!`, `🎼 Olé! O ${team} não deixa o adversário tocar na bola!`]),
    }));
  }
  return [];
}

/**
 * The first line of a danger: where the ball comes from (the lead-in the pitch plays
 * before the decisive move). Several phrasings each, picked by the event so it reads the
 * same on every device; one read out lately in the match (`recent`) is passed over for
 * the next, so repeats get rarer.
 */
export function leadLine(lead: LeadInLine, nameOf: (id?: string) => string | undefined, team: string, kind: PlayKind, eventIndex: number, recent: readonly string[] = []): string {
  const O = nameOf(lead.ownerId) ?? team;
  const P = nameOf(lead.passerId) ?? team;
  const S = nameOf(lead.secondId) ?? team;
  const L = nameOf(lead.loserId) ?? 'o adversário';
  const options: Record<LeadInLine['pattern'], string[]> = {
    carry: [
      `🏃 ${O} avança com a bola pelo campo adversário...`,
      `🏃 ${O} conduz e o ${team} se aproxima da área...`,
      `🏃 ${O} puxa o ataque, com a bola dominada...`,
      `🏃 O ${team} sobe com ${O} conduzindo pelo meio...`,
    ],
    pass: [
      `⚽ ${P} toca para ${O}...`,
      `⚽ ${P} encontra ${O}, que vem de trás...`,
      `⚽ Bola com ${P}, que rola para ${O}...`,
      `⚽ ${P} acha ${O} livre no meio...`,
    ],
    switch: [
      `🔄 ${P} inverte o jogo e encontra ${O} do outro lado...`,
      `🔄 Lançamento longo de ${P} para ${O}, mudando o lado do jogo...`,
      `🔄 ${P} vira o jogo com um passe longo para ${O}...`,
      `🔄 Bola esticada de ${P} para ${O}, no outro lado do campo...`,
    ],
    combo: [
      `🔁 ${P} e ${S} trocam passes e a bola chega a ${O}...`,
      `🔁 Toca ${P}, toca ${S}... e a bola sobra para ${O}...`,
      `🔁 O ${team} roda a bola: ${P}, ${S} e agora ${O}...`,
      `🔁 Troca de passes entre ${P} e ${S} até achar ${O}...`,
    ],
    wall: [
      `🔁 ${O} tabela com ${P} e segue com a bola...`,
      `🔁 Bate e volta entre ${O} e ${P}...`,
      `🔁 ${O} toca em ${P} e recebe de volta na frente...`,
      `🔁 Tabelinha de ${O} com ${P}...`,
    ],
    slalom: [
      `🏃 ${O} pega a bola ainda no próprio campo e arranca...`,
      `🏃 ${O} recebe no campo de defesa e sai em disparada...`,
    ],
    tikitaka: [
      `🎼 O ${team} começa a trocar passes, com paciência...`,
      `🎼 O ${team} gira a bola desde o meio-campo...`,
    ],
    recovery: [
      `🧲 ${O} rouba a bola de ${L} e o ${team} sai rápido...`,
      `🧲 Bola recuperada! ${O} desarma ${L}...`,
      `🧲 ${L} perde a bola para ${O}, e o ${team} sai em velocidade...`,
      `🧲 Desarme de ${O} em cima de ${L}!`,
    ],
    throwin: [
      `🙌 Lateral para o ${team}: ${P} cobra rápido para ${O}...`,
      `🙌 ${P} repõe a bola com as mãos e acha ${O}...`,
      `🙌 Cobrança de lateral de ${P}, e ${O} domina...`,
      `🙌 Lateral rápido! ${P} joga em ${O}...`,
    ],
    interception: [
      `✋ ${O} lê o passe de ${L} e intercepta!`,
      `✋ Passe errado de ${L}, e ${O} rouba no meio-campo!`,
      `✋ ${O} se antecipa e corta o passe de ${L}...`,
      `✋ Interceptação de ${O}! O ${team} sai jogando...`,
    ],
    longball: [
      `🚀 Lançamento longo de ${P} lá de trás, e ${O} domina...`,
      `🚀 ${P} acha ${O} com um lançamento da defesa...`,
      `🚀 Bola longa de ${P}, da defesa para ${O}...`,
      `🚀 ${P} pula o meio-campo com um lançamento para ${O}...`,
    ],
    beat: [
      `💨 ${O} deixa ${L} para trás no meio-campo e avança...`,
      `💨 ${O} passa por ${L} com um corte seco...`,
      `💨 Drible de ${O} em cima de ${L}, e lá vai ele...`,
      `💨 ${L} vai no bote, ${O} escapa e segue...`,
    ],
    pivot: [
      `🔁 ${P} toca em ${S}, que escora de primeira para ${O}...`,
      `🔁 ${S} faz o pivô e devolve para ${O}, que chega de trás...`,
      `🔁 Bola em ${S}, de costas para o gol, ajeitada para ${O}...`,
      `🔁 ${P} acha ${S}, que rola de primeira para ${O}...`,
    ],
    settle: kind === 'corner'
      ? [`🚩 A área se enche para a cobrança do escanteio...`, `🚩 Escanteio: empurra-empurra dentro da área...`, `🚩 Todo mundo na área para o escanteio do ${team}...`]
      : kind === 'freekick'
        ? [`🎯 A barreira se arma para a cobrança da falta...`, `🎯 O juiz organiza a barreira para a falta...`, `🎯 Falta perigosa: a barreira se posiciona...`]
        : kind === 'penalty'
          ? [`🎯 Clima tenso: o pênalti vai ser cobrado...`, `🎯 Silêncio no estádio: vai ser cobrado o pênalti...`, `🎯 Tudo pronto para a cobrança do pênalti...`]
          : [`⚽ O ${team} se aproxima da área...`, `⚽ O ${team} chega ao ataque...`],
  };
  const list = options[lead.pattern];
  const first = eventIndex % list.length;
  for (let i = 0; i < list.length; i++) {
    const line = list[(first + i) % list.length];
    if (!recent.includes(line)) return line;
  }
  return list[first];
}

export function narrateDanger(args: {
  event: MatchEvent;
  eventIndex: number;
  homeTeam: Team;
  awayTeam: Team;
  fallbackGoalkeeperName: (team: Team) => string;
  /**
   * What this match has shown lately ("kind/variant", "kind/finish" and lines). Anything
   * in it is drawn a second time, once: a repeat stays possible, just much rarer.
   */
  recent?: { plays: readonly string[]; lines: readonly string[] };
  /** Plays exactly this variant and finish (tests, the gallery, the dev harness). */
  force?: { variant: PlayVariant; finish: FinishStyle };
}): DangerNarration {
  const { event, eventIndex, homeTeam, awayTeam } = args;
  const outcome = event.type as DangerOutcome;
  const play = event.play;
  // A save is credited to the keeper's side; goal and miss to the attackers.
  const eventTeam = event.teamId === homeTeam.id ? homeTeam : awayTeam;
  const otherTeam = eventTeam === homeTeam ? awayTeam : homeTeam;
  const attackTeam = outcome === 'save' ? otherTeam : eventTeam;
  const defendTeam = attackTeam === homeTeam ? awayTeam : homeTeam;
  const nameIn = (team: Team, id?: string) => (id ? team.players.find(p => p.id === id)?.shortName : undefined);

  // Own goals carry no scorer on the attacking side (the engine tags the defender as opponentId).
  const isOwnGoal = outcome === 'goal' && (play?.kind === 'own_goal' || !event.playerId);
  const kind: PlayKind = play?.kind ?? (isOwnGoal ? 'own_goal' : 'through');
  const ownGoalName = isOwnGoal ? nameIn(defendTeam, play?.defenderId ?? event.opponentId) ?? 'um zagueiro' : '';
  const shooterId = play?.attackerId ?? (outcome === 'save' ? event.opponentId : event.playerId);
  const shooterName = nameIn(attackTeam, shooterId) ?? 'Atacante';
  const attackerName = isOwnGoal ? `Gol Contra (${ownGoalName})` : shooterName;
  const goalkeeperName = nameIn(defendTeam, play?.goalkeeperId) ?? args.fallbackGoalkeeperName(defendTeam);
  const defenderName = nameIn(defendTeam, play?.defenderId) ?? goalkeeperName;
  // With an assist, the assist provider is the one who serves the ball.
  const assisted = outcome === 'goal' && !!event.assisterId;
  // Who serves the ball: as named by the engine (the assist first) when he is on the pitch;
  // otherwise the same rule the pitch uses, so the name read out is the player shown.
  const lineup = attackTeam.players.slice(0, 11);
  const namedId = (assisted ? event.assisterId : undefined) ?? play?.wideId ?? play?.creatorId;
  const named = lineup.find(p => p.id === namedId && p.id !== shooterId && formationRoleForPlayer(attackTeam, p) !== 'GK');
  const byRole = serverRolesFor(kind).map(role => lineup.find(p => p.id !== shooterId && formationRoleForPlayer(attackTeam, p) === role)).find(Boolean);
  const anyone = lineup.find(p => p.id !== shooterId && formationRoleForPlayer(attackTeam, p) !== 'GK');
  const serverName = (named ?? byRole ?? anyone)?.shortName ?? attackTeam.name;

  // The epic roll, on its own stream (so it never shifts the ordinary draws below).
  const epicRandom = seededRandom(dangerSeed(event, eventIndex) ^ 0x5eed1e);
  const epicPick = args.force ? null : rollEpic({
    kind, outcome, assisted,
    shooter: attackTeam.players.find(p => p.id === shooterId),
    keeper: defendTeam.players.find(p => p.id === play?.goalkeeperId),
    lineup,
  }, epicRandom(), epicRandom());

  return withRandomSource(seededRandom(dangerSeed(event, eventIndex)), () => {
    const seen = (key: string) => args.recent?.plays.includes(key) ?? false;
    let variant = variantFor(kind, random(), outcome, assisted);
    if (seen(`${kind}/${variant}`)) variant = variantFor(kind, random(), outcome, assisted);
    const finishes = finishesFor(kind, variant, outcome);
    let finish = pick(finishes);
    if (seen(`${kind}/${finish}`)) finish = pick(finishes);
    if (args.force) {
      variant = args.force.variant;
      finish = args.force.finish;
    } else if (epicPick?.variant) {
      variant = epicPick.variant;
      finish = pick(finishesFor(kind, variant, outcome));
    } else if (epicPick?.finish) {
      // An epic finish crowns an ordinary play that can end that way.
      const epicFinish = epicPick.finish;
      const fitting = (PLAY_VARIANTS[kind] as readonly PlayVariant[])
        .filter(v => !isEpicVariant(kind, v) && (!assisted || allowsAssist(kind, v)) && epicFinishesFor(kind, v, outcome).includes(epicFinish));
      if (fitting.length > 0) {
        if (!fitting.includes(variant)) variant = pick(fitting);
        finish = epicFinish;
      }
    }
    const fresh = (list: readonly string[]) => {
      const line = pick(list);
      return args.recent?.lines.includes(line) ? pick(list) : line;
    };
    const names = { A: shooterName, W: serverName, D: defenderName, G: goalkeeperName, T: attackTeam.name, O: ownGoalName };
    const lines = linesFor(kind, variant, names, assisted);
    const buildUp = fresh(lines.buildUp);
    const attempt = fresh(lines.attempt);
    const reveal = fresh(revealFor(kind, variant, finish, { ...names, DT: defendTeam.name }));
    return { attackTeamId: attackTeam.id, outcome, isOwnGoal, attackerName, defenderName, goalkeeperName, variant, finish, epic: isEpic(kind, variant, finish), buildUp, attempt, reveal };
  });
}
