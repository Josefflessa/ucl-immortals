/**
 * matchNarrative.ts
 * Shared narration helpers used by both the local simulator (MatchSimPage)
 * and the server-side engine (gameEngine). Keeps descriptions consistent
 * and removes all duplication between the two code paths.
 */

export type Approach = 'cross' | 'through' | 'dribble' | 'longrange' | 'counter';

// ─── Utility ────────────────────────────────────────────────────────────────

export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ─── Approach selection (weighted by play style) ────────────────────────────

export function selectApproach(playStyle: string): Approach {
  const r = Math.random();
  if (playStyle === 'possession') {
    if (r < 0.30) return 'through';
    if (r < 0.55) return 'cross';
    if (r < 0.72) return 'dribble';
    if (r < 0.87) return 'counter';
    return 'longrange';
  }
  if (playStyle === 'counter') {
    if (r < 0.38) return 'counter';
    if (r < 0.62) return 'through';
    if (r < 0.78) return 'dribble';
    if (r < 0.90) return 'longrange';
    return 'cross';
  }
  // balanced / default
  if (r < 0.22) return 'cross';
  if (r < 0.45) return 'through';
  if (r < 0.65) return 'dribble';
  if (r < 0.83) return 'counter';
  return 'longrange';
}

// ─── Score / time context suffix ────────────────────────────────────────────

export function ctxSuffix(
  attackerGoals: number,
  defenderGoals: number,
  minute: number,
): string {
  const diff = attackerGoals - defenderGoals;
  if (minute >= 88) {
    if (diff === 0) return ' Tensão máxima nos acréscimos!';
    if (diff < 0) return ' Última chance de empatar!';
    if (diff > 0) return ' Gol de seguro nos instantes finais!';
  }
  if (minute >= 75) {
    if (diff < 0) return ' O time precisa reagir!';
    if (diff === 0) return ' Partida em aberto!';
  }
  return '';
}

// ─── Build-up descriptions (shown just before key resolution) ───────────────

export function buildUpDesc(
  approach: Approach,
  atk: string,
  def: string,
  wide: string,
  teamName: string,
): string {
  switch (approach) {
    case 'cross': return pick([
      `↗️ ${wide} avança pela ponta e levanta a bola na área para ${atk}...`,
      `⚽ Jogada coletiva! ${wide} abre pelo lado e cruza para ${atk} dentro da área...`,
      `📐 ${atk} se posiciona na segunda trave aguardando o cruzamento de ${wide}...`,
      `🏃 ${wide} para no fundo, levanta na cabeça de ${atk} na área...`,
      `🎯 ${wide} cobra da ponta e a bola sobra na área para ${atk}...`,
      `↗️ ${wide} cruza fechado e ${atk} aparece entre os zagueiros...`,
    ]);
    case 'through': return pick([
      `🔑 Passe em profundidade! ${atk} escapa nas costas de ${def} e avança sozinho...`,
      `⚡ ${wide} enxerga o movimento de ${atk} nas costas da zaga e passa!`,
      `🎯 Lance de ruptura — ${atk} recebe cara a cara com o goleiro...`,
      `🏃 ${atk} pede a bola no corredor central e escapa em velocidade de ${def}...`,
      `🔑 ${atk} tabela com ${wide} e parte nas costas de ${def}...`,
      `🎯 Lançamento por cima da defesa — ${atk} domina dentro da área...`,
    ]);
    case 'dribble': return pick([
      `💨 ${atk} recebe de frente para ${def} e decide partir para o drible!`,
      `⚡ Encarada! ${atk} tenta superar ${def} em duelo individual...`,
      `🏃 ${atk} acelera pela esquerda tentando deixar ${def} para trás...`,
      `💡 ${atk} finta para direita, para para esquerda — ${def} está perdido!`,
      `🔥 ${atk} corta para o meio em cima de ${def} buscando o espaço...`,
      `💨 ${atk} encara ${def} de frente e parte para cima com a bola dominada...`,
    ]);
    case 'longrange': return pick([
      `💣 ${atk} domina fora da área e avalia o chute de longe...`,
      `🔭 ${atk} com espaço a 25 metros — vai arriscar?`,
      `🎯 ${atk} se livra da marcação na intermediária e olha para o gol!`,
      `⚡ Bola no pé de ${atk} a longa distância — o goleiro se posiciona...`,
      `💣 ${atk} recebe na intermediária, ajeita o corpo e prepara o chute...`,
      `🔭 A defesa recua e dá espaço para ${atk} armar de longe...`,
    ]);
    case 'counter': return pick([
      `⚡ CONTRA-ATAQUE! ${teamName} rouba a bola no meio e sai em velocidade!`,
      `🏃 Transição rápida! ${atk} lidera o contra com ${wide} na ponta!`,
      `💨 Bola recuperada — ${atk} parte em disparada com a zaga desorganizada!`,
      `🔥 ${teamName} quebra a pressão e sai em dois contra um!`,
      `⚡ Bola recuperada! ${teamName} dispara no contra-ataque com ${atk}...`,
      `💨 ${atk} conduz no campo aberto com a defesa correndo atrás...`,
    ]);
  }
}

// ─── Goal descriptions ───────────────────────────────────────────────────────

export function goalDesc(
  approach: Approach,
  atk: string,
  assister: string | null,
  def: string,
  gk: string,
  hg: number,
  ag: number,
  minute: number,
  attackerGoals: number,
  defenderGoals: number,
  isImmortal = false,
): string {
  const score = `${hg}-${ag}`;
  const ctx = ctxSuffix(attackerGoals, defenderGoals, minute);
  const immortalTag = isImmortal ? ' Que craque!' : '';

  switch (approach) {
    case 'cross': return assister
      ? pick([
          `⚽ GOL! ${assister} cruza na medida e ${atk} sobe mais alto que ${def} para cabecear firme! ${score}${ctx}`,
          `⚽ GOL! Cruzamento preciso de ${assister} e ${atk} aparece na segunda trave para completar! ${score}${ctx}`,
          `⚽ GOL! ${assister} levanta, ${atk} antecipa ${def} e manda para as redes de cabeça! ${score}${ctx}`,
          `⚽ GOL! Cruzamento rasteiro de ${assister} e ${atk} só empurra! ${score}${ctx}`,
        ])
      : pick([
          `⚽ GOL! ${atk} domina o cruzamento no peito e chuta no ângulo antes de ${def}! ${score}${ctx}`,
          `⚽ GOL! Jogada aérea de ${atk} vence ${def} no duelo e marca! ${score}${ctx}`,
        ]);
    case 'through': return assister
      ? pick([
          `⚽ GOL! Passe primoroso de ${assister} e ${atk} sai cara a cara com ${gk}, desloca e marca! ${score}${ctx}${immortalTag}`,
          `⚽ GOL! ${assister} enxerga ${atk} nas costas de ${def} — finalização precisa! ${score}${ctx}`,
          `⚽ GOL! ${atk} recebe de ${assister} nas costas da zaga, domina e empurra! ${score}${ctx}`,
        ])
      : pick([
          `⚽ GOL! ${atk} escapa de ${def}, sai sozinho e desloca ${gk} com categoria! ${score}${ctx}`,
          `⚽ GOL! Lance individual de ${atk} — correu, dominou e bateu com precisão! ${score}${ctx}`,
        ]);
    case 'dribble': return assister
      ? pick([
          `⚽ GOL! ${assister} arma a jogada e ${atk} deixa ${def} sentado antes de bater no cantinho! ${score}${ctx}`,
          `⚽ GOL! Combinação linda! ${assister} passa, ${atk} dribla ${def} e finaliza! ${score}${ctx}`,
        ])
      : pick([
          `⚽ GOL! ${atk} faz a finta, deixa ${def} no chão e bate cruzado no ângulo! ${score}${ctx}${immortalTag}`,
          `⚽ GOL! Drible desconcertante de ${atk} sobre ${def} e chute seco no canto! ${score}${ctx}`,
          `⚽ GOL! ${atk} parte da esquerda, corta para dentro e encobre ${gk}! ${score}${ctx}`,
        ]);
    case 'longrange': return assister
      ? pick([
          `⚽ GOLAÇO! ${assister} afasta para ${atk} que arrisca de longe e acerta no ângulo! ${score}${ctx}`,
          `⚽ GOL DE FORA! ${assister} recua e ${atk} bate de primeira — foguete! ${score}${ctx}`,
        ])
      : pick([
          `⚽ GOLAÇO! ${atk} arrisca de longe e a bola explode no ângulo sem chance para ${gk}! ${score}${ctx}${immortalTag}`,
          `⚽ QUE GOL! ${atk} bate de primeira da intermediária e encobre o goleiro! ${score}${ctx}`,
          `⚽ GOL DE FORA DA ÁREA! Bomba de ${atk} que não deu para ${gk}! ${score}${ctx}`,
        ]);
    case 'counter': return assister
      ? pick([
          `⚽ GOL EM TRANSIÇÃO! ${assister} lança ${atk} em velocidade — finalização perfeita! ${score}${ctx}`,
          `⚽ GOL! Contra-ataque fulminante de ${atk} com assistência de ${assister}! ${score}${ctx}`,
        ])
      : pick([
          `⚽ GOL! Contra-ataque avassalador! ${atk} corre livre e não perdoa! ${score}${ctx}`,
          `⚽ GOL! Saída rápida pela direita — ${atk} finaliza antes da defesa se reorganizar! ${score}${ctx}`,
          `⚽ GOL! ${atk} lidera o contra, chega na área e bate sem deixar ${gk} reagir! ${score}${ctx}`,
        ]);
  }
}

// ─── Own goal descriptions ───────────────────────────────────────────────────

export function ownGoalDesc(def: string, gk: string): string {
  return pick([
    `⚽ GOL CONTRA! Cruzamento na área e ${def} tenta o corte de cabeça, mas desvia para as próprias redes!`,
    `⚽ GOL CONTRA! ${def} tenta afastar o perigo, mas a bola toca no seu joelho e engana ${gk}!`,
    `⚽ GOL CONTRA! Pressão na área — ${def} desvia involuntariamente para dentro do gol!`,
  ]);
}

// ─── Save descriptions ────────────────────────────────────────────────────────

export function saveDesc(approach: Approach, gk: string, atk: string, isCorner: boolean): string {
  const corner = isCorner ? ' Escanteio!' : '';
  switch (approach) {
    case 'cross': return pick([
      `🧤 ${gk} sai no momento certo e vence o duelo aéreo com ${atk}!${corner}`,
      `🧤 Cabeceio perigoso de ${atk}, mas ${gk} voa no ângulo e espalma!${corner}`,
      `🧤 ${gk} domina o cruzamento com segurança antes de ${atk} completar!`,
    ]);
    case 'through': return pick([
      `🧤 Um a um! ${atk} vai cara a cara, mas ${gk} fecha o ângulo e defende!${corner}`,
      `🧤 ${gk} sai rápido dos pés e abafa a finalização de ${atk} em velocidade!`,
      `🧤 ${atk} domina e bate — ${gk} cai no ângulo e salva com a ponta dos dedos!${corner}`,
    ]);
    case 'dribble': return pick([
      `🧤 ${atk} superou ${gk} no drible, mas o goleiro se recuperou e defendeu!${corner}`,
      `🧤 Drible bem-sucedido de ${atk}, porém o chute bate em cheio em ${gk}!`,
      `🧤 ${gk} fecha bem o ângulo após o drible de ${atk} — fantástica saída!${corner}`,
    ]);
    case 'longrange': return pick([
      `🧤 Parece impossível, mas ${gk} alcança o chute forte de ${atk}!${corner}`,
      `🧤 Chutão de fora da área de ${atk}, ${gk} espalma com segurança!`,
      `🧤 ${gk} em destaque! Bola colocada por ${atk} no ângulo, mas ele voa e tira!${corner}`,
    ]);
    case 'counter': return pick([
      `🧤 Contra-ataque neutralizado! ${gk} sai bem dos pés de ${atk}!`,
      `🧤 ${atk} saiu em velocidade mas encontrou ${gk} perfeitamente posicionado!${corner}`,
      `🧤 ${gk} enorme! Saiu rápido do gol e fechou o ângulo de ${atk} no contra!`,
    ]);
  }
}

// ─── Frango / screamer / deflected descriptions ──────────────────────────────

export function frangoDesc(atk: string, gk: string): string {
  return pick([
    `⚽ FRANGO! ${atk} chuta fraco rasteiro de longe e a bola passa por baixo das mãos de ${gk}!`,
    `⚽ QUE VACILO DE ${gk}! ${atk} arrisca sem força e o goleiro deixa escorregar!`,
    `⚽ INACREDITÁVEL! ${gk} tenta segurar um chute simples de ${atk} e a bola passa por ele!`,
  ]);
}

export function screamedDesc(atk: string, gk: string): string {
  return pick([
    `⚽ GOLAÇO MONSTRUOSO! ${atk} domina e manda uma bomba na gaveta — ${gk} não teve chance!`,
    `⚽ QUE MÍSSIL! ${atk} arrisca de longe e a bola explode no ângulo a 120km/h!`,
    `⚽ OBRA DE ARTE! ${atk} pega de chapa no vício do ângulo — espetacular!`,
  ]);
}

export function deflectedDesc(atk: string, def: string): string {
  return pick([
    `⚽ GOL DESVIADO! ${atk} bate forte, a bola carimba as costas de ${def} e muda de rumo!`,
    `⚽ GOL DE SORTE! Chute de ${atk} desvia em ${def} e engana o goleiro!`,
    `⚽ DESVIO FATAL! ${def} tenta o bloqueio, mas a bola muda de direção e entra!`,
  ]);
}

// ─── Miss descriptions ────────────────────────────────────────────────────────

export function missDesc(approach: Approach, atk: string, def: string, gk: string): string {
  switch (approach) {
    case 'cross': return pick([
      `❌ Cruzamento perigoso, mas ${def} afasta de cabeça antes de ${atk}!`,
      `❌ ${atk} sobe para o cabeceio mas não tem direção — bola vai à esquerda do gol!`,
      `❌ Cruzamento rasteiro desviado pela defesa para escanteio!`,
    ]);
    case 'through': return pick([
      `❌ ${atk} sai sozinho, mas finaliza por cima do travessão!`,
      `❌ ${def} retorna em velocidade e tira de ${atk} no último instante!`,
      `❌ Mano a mano! ${atk} bate e ${gk} toca de pontinha para fora!`,
    ]);
    case 'dribble': return pick([
      `❌ ${atk} passou por ${def} mas bateu torto na hora da finalização!`,
      `❌ Boa jogada individual de ${atk}, porém o chute sai fraco e sem direção!`,
      `❌ ${atk} faz o drible mas ${def} recupera antes da finalização!`,
    ]);
    case 'longrange': return pick([
      `💥 NA TRAVE! ${atk} arrisca de longe e a bola explode no poste!`,
      `❌ Chute potente de ${atk} da intermediária, mas vai altão!`,
      `❌ ${atk} bateu forte, mas a bola raspa o travessão e sai!`,
      `❌ Chutão de ${atk} a 25 metros — bola passa à direita do gol!`,
    ]);
    case 'counter': return pick([
      `❌ Contra-ataque desperdiçado! ${atk} tinha mais tempo mas bateu fora!`,
      `❌ ${def} volta correndo e rouba de ${atk} no último segundo!`,
      `❌ ${atk} finaliza no contra-ataque, mas a bola bate em ${gk} e sai!`,
    ]);
  }
}

// ─── Duel / tackle descriptions ──────────────────────────────────────────────

export function duelDesc(approach: Approach, def: string, atk: string): string {
  switch (approach) {
    case 'cross': return pick([
      `🛡️ ${def} vence o duelo aéreo com ${atk} e afasta de cabeça!`,
      `🛡️ Cruzamento interceptado! ${def} lê a jogada antes de ${atk}!`,
      `🛡️ ${def} aparece bem e bloqueia o cruzamento na entrada da área!`,
    ]);
    case 'through': return pick([
      `🛡️ ${def} retorna em velocidade e corta o passe profundo antes de ${atk}!`,
      `🛡️ Bloqueio preciso de ${def}! Antecipou o movimento de ${atk}!`,
      `🛡️ ${def} lê a jogada cedo e se interpõe antes de ${atk} receber!`,
    ]);
    case 'dribble': return pick([
      `🛡️ Parada firme! ${def} antecipa o drible de ${atk} com categoria!`,
      `🛡️ Entrada limpa de ${def} — rouba a bola de ${atk} com precisão!`,
      `🛡️ ${def} fecha o ângulo e não deixa ${atk} avançar. Ótima marcação!`,
      `🛡️ ${atk} tentou o drible mas ${def} estava preparado — recupera!`,
    ]);
    case 'longrange': return pick([
      `🛡️ Pressão de ${def}! Fechou o espaço e ${atk} não conseguiu bater!`,
      `🛡️ ${def} adianta o corpo e bloqueia o chute de ${atk} antes de sair!`,
    ]);
    case 'counter': return pick([
      `🛡️ Contra-ataque anulado! ${def} retorna em velocidade e recupera de ${atk}!`,
      `🛡️ ${def} cobre perfeitamente e rouba a bola de ${atk} na entrada da área!`,
      `🛡️ Desarme providencial de ${def} — encerrou o perigo do contra-ataque!`,
    ]);
  }
}

// ─── Woodwork description (luck event) ──────────────────────────────────────

export function woodworkDesc(atk: string, def: string): string {
  return pick([
    `💥 NA TRAVE! ${atk} bate colocado de chapa e a bola explode no poste!`,
    `💥 NO TRAVESSÃO! ${atk} limpa ${def} e arrisca — a bola bate na madeira!`,
    `💥 QUE AZAR! ${atk} bate colocado no ângulo, mas a bola beija o poste e sai!`,
  ]);
}

// ─── Penalty event descriptions ───────────────────────────────────────────────

export function penaltyGoalDesc(taker: string, victim: string, def: string, gk: string): string {
  return pick([
    `⚽ PÊNALTI! ${def} derrubou ${victim} dentro da área — ${taker} cobra com categoria e desloca ${gk}!`,
    `⚽ GOL DE PÊNALTI! Falta de ${def} sobre ${victim} na área; ${taker} bate firme no canto, sem chances para ${gk}!`,
    `⚽ NA MARCA DA CAL! ${def} chegou atrasado em ${victim} e foi pênalti — ${taker} converte com frieza diante de ${gk}!`,
  ]);
}

export function penaltySaveDesc(gk: string, taker: string): string {
  return pick([
    `🧤 DEFENDEU O PÊNALTI! ${gk} voa no canto e espalma a cobrança de ${taker}!`,
    `🧤 INCRÍVEL! ${gk} mergulha para a direita e salva o time!`,
    `🧤 ${gk} adivinhou o canto! Faz a defesa do jogo no pênalti de ${taker}!`,
  ]);
}

export function penaltyMissDesc(taker: string): string {
  return pick([
    `❌ PÊNALTI PARA FORA! ${taker} bate com muita força e manda por cima!`,
    `❌ QUE VACILO! ${taker} cola no ângulo, mas a bola vai tirando tinta da trave!`,
    `❌ ${taker} decide bater no canto e a bola vai para fora pela linha de fundo!`,
  ]);
}

// ── Foul & direct free-kick descriptions ──────────────────────────────────────

export function foulDesc(fouler: string, victim: string): string {
  return pick([
    `🦶 Falta de ${fouler} em ${victim}. O árbitro marca.`,
    `✋ ${fouler} chega atrasado e derruba ${victim} — falta perigosa!`,
    `⚠️ ${fouler} para ${victim} na infração. Bola parada na entrada da área.`,
    `🤙 ${victim} sofre a falta de ${fouler} em ótima posição para a cobrança.`,
  ]);
}

export function freeKickGoalDesc(taker: string, gk: string): string {
  return pick([
    `⚽ GOLAÇO DE FALTA! ${taker} cobra por cima da barreira no ângulo, sem chance para ${gk}!`,
    `⚽ NO ÂNGULO! ${taker} bate a falta com categoria e ${gk} só vê a bola entrar!`,
    `⚽ QUE COBRANÇA! ${taker} acerta um míssil na falta e estufa as redes!`,
  ]);
}

export function freeKickSaveDesc(gk: string, taker: string): string {
  return pick([
    `🧤 DEFENDAÇA! ${taker} bate firme na falta, mas ${gk} voa e espalma!`,
    `🧤 ${gk} estava atento! Pega a cobrança de falta de ${taker} no canto!`,
    `🧤 NO CANTINHO... mas ${gk} se estica e salva a cobrança de ${taker}!`,
  ]);
}

export function freeKickMissDesc(taker: string): string {
  return pick([
    `❌ POR CIMA! ${taker} caprichou na cobrança, mas mandou para a arquibancada.`,
    `❌ NA BARREIRA! A falta de ${taker} é afastada pela barreira.`,
    `❌ ${taker} cobra a falta, mas a bola passa rente à trave!`,
  ]);
}

// ── Corner (header) descriptions ──────────────────────────────────────────────

export function cornerGoalDesc(header: string, gk: string): string {
  return pick([
    `⚽ DE CABEÇA! ${header} sobe mais que todos no escanteio e testa firme, sem chance para ${gk}!`,
    `⚽ GOL DE ESCANTEIO! ${header} cabeceia no contrapé de ${gk} e estufa as redes!`,
    `⚽ SUBIU! ${header} ganha pelo alto na cobrança de escanteio e marca de cabeça!`,
  ]);
}

export function cornerSaveDesc(gk: string, header: string): string {
  return pick([
    `🧤 NO ESCANTEIO... ${header} cabeceia firme, mas ${gk} faz a defesa por baixo do travessão!`,
    `🧤 ${gk} ENORME! Espalma o cabeceio de ${header} após a cobrança de escanteio!`,
    `🧤 ${header} testa com perigo, mas ${gk} estava no lugar certo!`,
  ]);
}

export function cornerMissDesc(header: string): string {
  return pick([
    `❌ DE CABEÇA, POR CIMA! ${header} sobe no escanteio, mas manda para fora.`,
    `❌ ${header} cabeceia no escanteio, mas a bola raspa a trave e sai!`,
    `❌ NA ÁREA... ${header} testa de cabeça, mas sem direção. Tiro de meta.`,
  ]);
}

// ─── Flow / continuity commentary ────────────────────────────────────────────

export type LastKeyCtx = {
  type: 'goal' | 'save' | 'miss' | 'duel';
  teamId: string;
  atkName: string;
  defName: string;
  gkName: string;
  approach: Approach;
} | null;

export function flowDesc(
  last: LastKeyCtx,
  possessTeamName: string,
  possessTeamId: string,
  midPlayer: string,
  defPlayer: string,
  coachStyle: string,
  coachName: string,
  defTeamName: string,
  hg: number,
  ag: number,
  minute: number,
): string {
  // After a save — reference the corner / distribution
  if (last?.type === 'save') {
    return pick([
      `🚩 ${possessTeamName} cobra o escanteio — a zaga se prepara para afastar...`,
      `⚽ ${last.gkName} distribui rápido após a defesa, e o jogo se abre pelo lado.`,
      `🔄 Bola afastada pela defesa! ${possessTeamName} tenta organizar novamente.`,
      `🔄 Reposicionamento após o susto. ${defTeamName} se fecha bem no contra-ataque.`,
    ]);
  }

  // After a goal — reference the restart
  if (last?.type === 'goal') {
    const losing = last.teamId === possessTeamId ? defTeamName : possessTeamName;
    return pick([
      `🔄 Recomeço após o gol. ${losing} tenta reorganizar o ataque rapidamente.`,
      `⚽ ${losing} reinicia no centro buscando resposta imediata.`,
      `🎯 ${possessTeamName} com a bola, tentando administrar a vantagem de ${hg}-${ag}.`,
      `⚡ ${losing} pressiona após o gol sofrido — o duelo fica mais aberto!`,
    ]);
  }

  // After a miss — reference goal kick / clearance
  if (last?.type === 'miss') {
    return pick([
      `⚽ Tiro de meta! O goleiro distribui pelo lado para sair jogando.`,
      `🔄 Bola sai pelo fundo — reposição longa do goleiro abre o jogo.`,
      `🛡️ ${defTeamName} respira após o perigo. Posse recuperada no meio.`,
    ]);
  }

  // After a duel / tackle — reference the transition
  if (last?.type === 'duel') {
    return pick([
      `⚡ Posse recuperada! ${possessTeamName} tenta sair rápido em transição.`,
      `🔄 ${midPlayer} tenta impor ritmo após o desarme no meio do campo.`,
      `🏃 ${possessTeamName} constrói pelo lado após ganhar a bola no meio.`,
    ]);
  }

  // Neutral flow commentary (style-aware)
  if (coachStyle === 'possession' || coachName === 'guardiola') {
    return pick([
      `🔄 ${midPlayer} organiza a saída de bola trocando passes curtos com paciência.`,
      `⚙️ Troca de passes rápidos! ${possessTeamName} envolve a marcação com maestria.`,
      `🛡️ ${defTeamName} fecha os espaços tentando conter a posse de bola adversária.`,
      `⚽ ${possessTeamName} circula a bola no campo de ataque buscando o espaço ideal.`,
    ]);
  }

  if (coachStyle === 'counter' || coachName === 'klopp') {
    return pick([
      `⚡ ${midPlayer} puxa a transição ofensiva em alta velocidade!`,
      `🏃 ${possessTeamName} adianta linhas e pressiona a saída de bola adversária!`,
      `🛑 Recuperação de bola de ${defPlayer} — ${possessTeamName} já contra-ataca!`,
      `💨 Bola longa para o espaço! ${possessTeamName} tenta explorar as costas da zaga.`,
    ]);
  }

  // Default balanced
  return pick([
    `⚽ ${midPlayer} domina no meio-campo e distribui o jogo.`,
    `⚔️ Batalha física no meio! ${midPlayer} e ${defPlayer} disputam palmo a palmo.`,
    `🛡️ A linha defensiva de ${defTeamName} fecha bem o bloco e aguarda a oportunidade.`,
    `🔄 ${possessTeamName} mantém a posse tentando encontrar o espaço entre as linhas.`,
    `🔭 ${midPlayer} levanta a cabeça e procura opções pelo lado direito do ataque.`,
  ]);
}

// ─── Danger sequence (MatchSimPage dangerState) — a clean 3-beat arc ──────────
// 1) build-up (buildUpDesc) → 2) the ATTEMPT (dangerAttemptMsg, below) → 3) the outcome.
// Stage 2 shows the shot/header being TAKEN to build tension, but never reveals goal/save/miss
// (that is stage 3). This keeps the three beats connected and in the right order.
export function dangerAttemptMsg(approach: Approach, atk: string, def: string, gk: string): string {
  switch (approach) {
    case 'cross': return pick([
      `⚽ ${atk} sobe mais alto que a marcação e CABECEIA em direção ao gol...!`,
      `⚽ A bola é alçada na área e ${atk} testa de cabeça com perigo...!`,
      `⚽ ${atk} se joga na segunda trave e completa o cruzamento de primeira...!`,
      `⚽ Subida poderosa de ${atk}, que cabeceia firme no canto...!`,
    ]);
    case 'through': return pick([
      `⚽ ${atk} chega CARA A CARA com ${gk} e finaliza...!`,
      `⚽ Sozinho na frente do gol, ${atk} bate para o fundo das redes...!`,
      `⚽ ${atk} invade a área nas costas da zaga e conclui...!`,
      `⚽ Na saída de ${gk}, ${atk} tenta o toque por baixo...!`,
    ]);
    case 'dribble': return pick([
      `⚽ ${atk} passa por ${def} e ARRISCA a finalização...!`,
      `⚽ ${atk} limpa a marcação dentro da área e solta a perna...!`,
      `⚽ Drible desconcertante e ${atk} bate cruzado...!`,
      `⚽ ${atk} deixa ${def} para trás e finaliza de primeira...!`,
    ]);
    case 'longrange': return pick([
      `⚽ ${atk} ARMA O CHUTE e solta uma bomba de longe...!`,
      `⚽ Sem espaço para entrar, ${atk} arrisca de fora da área...!`,
      `⚽ ${atk} ajeita o corpo e chuta forte da intermediária...!`,
      `⚽ De muito longe, ${atk} tenta encobrir ${gk}...!`,
    ]);
    case 'counter': return pick([
      `⚽ O contra-ataque termina com ${atk} invadindo a área e FINALIZANDO...!`,
      `⚽ ${atk} chega na frente do goleiro após o contra e bate...!`,
      `⚽ Saída em velocidade! ${atk} conclui o contra-ataque...!`,
      `⚽ ${atk} carrega no contra e arremata em direção ao gol de ${gk}...!`,
    ]);
  }
}

// ─── Stage 1 danger message (MatchSimPage dangerState) ───────────────────────

export function dangerStage1Msg(
  approach: Approach,
  teamName: string,
  atkName: string,
  defName: string,
  isGoal: boolean,
  isSave: boolean,
): string {
  if (isGoal || (!isSave && approach !== 'duel' as any)) {
    switch (approach) {
      case 'cross': return pick([
        `↗️ CRUZAMENTO! ${teamName.toUpperCase()} levanta na área...`,
        `⚡ ${atkName} na segunda trave! Cruzamento perigoso de ${teamName.toUpperCase()}!`,
      ]);
      case 'through': return pick([
        `🔑 PASSE EM PROFUNDIDADE! ${atkName} escapa da marcação!`,
        `⚡ ATRÁS DA ZAGA! ${atkName} saiu livre pelo corredor...`,
      ]);
      case 'dribble': return pick([
        `💨 ${atkName} ENFRENTA ${defName} NO DRIBLE! Vai conseguir?`,
        `⚡ ENCARADA! ${atkName} parte para cima de ${defName}...`,
      ]);
      case 'longrange': return pick([
        `💣 ${atkName} COM ESPAÇO FORA DA ÁREA! Vai arriscar?!`,
        `🎯 CHUTE DE LONGE! ${atkName} avalia o ângulo...`,
      ]);
      case 'counter': return pick([
        `⚡ CONTRA-ATAQUE DE ${teamName.toUpperCase()}! Velocidade total!`,
        `🏃 TRANSIÇÃO RÁPIDA! ${atkName} lidera o contra...`,
      ]);
    }
  }
  if (isSave) {
    return pick([
      `🧤 CHUTE COM ENDEREÇO! ${atkName} arrisca e o goleiro se prepara...`,
      `💥 ${atkName} FINALIZA! O goleiro tem que se virar!`,
    ]);
  }
  return `🚨 OPORTUNIDADE! ${teamName.toUpperCase()} em jogada perigosa com ${atkName}...`;
}

// ─── Stage 3 celebration message ─────────────────────────────────────────────

export function celebrationMsg(
  approach: Approach,
  teamName: string,
  atkName: string,
  hg: number,
  ag: number,
): string {
  const score = `${hg}-${ag}`;
  switch (approach) {
    case 'cross': return pick([
      `⚽ GOOOOOL! ${atkName} de cabeça! ${teamName.toUpperCase()} marca! ${score}`,
      `⚽ GOOOOOOL! Que cabeceio de ${atkName}! ${score}`,
      `⚽ GOOOOOL! ${atkName} subiu na área e testou firme — não deu pro goleiro! ${score}`,
    ]);
    case 'through': return pick([
      `⚽ GOOOOOL! ${atkName} saiu livre e não perdoou! ${teamName.toUpperCase()} na frente! ${score}`,
      `⚽ GOOOOOOL! Cara a cara com o goleiro — ${atkName} faz o gol! ${score}`,
      `⚽ GOOOOOL! ${atkName} recebeu nas costas da zaga e bateu na saída do goleiro! ${score}`,
    ]);
    case 'dribble': return pick([
      `⚽ GOOOOOL! ${atkName} DEIXOU O DEFENSOR NO CHÃO E MARCOU! ${score}`,
      `⚽ GOOOOOOL! Drible espetacular de ${atkName}! ${teamName.toUpperCase()} MARCA! ${score}`,
      `⚽ GOOOOOL! ${atkName} limpou a marcação e bateu no cantinho! ${score}`,
    ]);
    case 'longrange': return pick([
      `⚽ GOOOOOL! QUE GOLAÇO DE ${atkName}! Bomba de fora da área! ${score}`,
      `⚽ GOOOOOOL DE FORA! ${atkName} não deu chance ao goleiro! ${score}`,
      `⚽ GOOOOOL! ${atkName} armou da intermediária e mandou no ângulo! ${score}`,
    ]);
    case 'counter': return pick([
      `⚽ GOOOOOL! Contra-ataque mortal de ${teamName.toUpperCase()}! ${atkName} marca! ${score}`,
      `⚽ GOOOOOOL EM TRANSIÇÃO! ${atkName} liquida no contra! ${score}`,
      `⚽ GOOOOOL! Saída rápida e ${atkName} concluiu antes da defesa voltar! ${score}`,
    ]);
  }
}

// ─── Tackle celebration (stage 3 for non-goal suspense) ─────────────────────

export function tackleCelebMsg(defName: string, atkName: string): string {
  return pick([
    `🛑 BLOQUEADO! ${defName} salva o time na hora certa!`,
    `🛡️ DESARME PRIMOROSO de ${defName} sobre ${atkName}!`,
    `💪 ${defName} vence o duelo com ${atkName} — que intervenção defensiva!`,
  ]);
}

export function saveCelebMsg(gkName: string, atkName: string): string {
  return pick([
    `🧤 DEFESAÇA DE ${gkName}! Impediu o gol de ${atkName}!`,
    `🧤 ${gkName} VOA E SALVA! Que reflexo incrível!`,
    `🧤 INCRÍVEL! ${gkName} mantém o placar impedindo ${atkName}!`,
    `🧤 PAREDÃO! ${gkName} espalma a finalização de ${atkName}!`,
    `🧤 QUE DEFESA! ${gkName} se estica todo e tira de ${atkName}!`,
  ]);
}

export function missCelebMsg(atkName: string): string {
  return pick([
    `❌ PARA FORA! ${atkName} perdeu grande chance!`,
    `💥 NA TRAVE! Que azar de ${atkName}!`,
    `❌ ${atkName} finalizou mas mandou pela linha de fundo!`,
    `❌ ISOLOU! ${atkName} pegou mal e mandou por cima do gol!`,
    `❌ QUE PERDIDA! ${atkName} tinha o gol na cara e desperdiçou!`,
  ]);
}
