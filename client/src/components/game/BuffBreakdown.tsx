// UCL Immortals — explains WHERE a player's stat buffs come from.
// The detail modal shows the net delta per stat, but not its sources. This breaks
// the uplift into: individual chemistry (a multiplier + WHY, via the connection web),
// team-wide chemistry, the coach, the player's traits (named, with what each grants)
// and the tactic — data-driven from EffectiveStats.breakdown so it always matches what
// the match engine actually uses.
import { EffectiveStats, ChemLinkType, CharBoost, ARROGANTE_GOALS_PER_PENALTY, arroganteStatBoost, arroganteTeamPenalty, DECIMO_HOMEM_STAT_BOOST, ESTRIBADO_CREDITS_PER_BOOST, GARCOM_ASSISTS_PER_BOOST, GOLEADOR_GOALS_PER_BOOST, INFORM_STAT_BOOST, LOBO_STAT_BOOST, MARTIR_TARGET_BOOST, NOE_CHEM_BONUS, NOE_STAT_BOOST, PIPOQUEIRO_KO_PENALTY, PIPOQUEIRO_LEAGUE_BOOST, PRODIGIO_STARTS_PER_BOOST, RESILIENTE_DEFEAT_BOOST, TODOS_POR_UM_CHEM_BONUS, TODOS_POR_UM_STAT_BOOST, estribadoStatBoost, garcomStatBoost, goleadorStatBoost, isOutfieldGoalkeeper, prodigioStatBoost } from '../../lib/gameEngine';
import { getTacticById, Player } from '../../lib/gameData';
import { getCardVariant } from './PlayerCard';

const ATTR_PT: Record<string, string> = {
  pace: 'RIT', shooting: 'FIN', passing: 'PAS', dribbling: 'DRI', defending: 'DEF', physical: 'FIS',
  vision: 'VIS', composure: 'CMP',
};
const ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure'] as const;

type Delta = { a: string; v: number };

// Individual-chemistry context: who this player connects with (and why), or why he is OOP.
export interface ChemInfo {
  oop: boolean;
  nativePos: string;      // PT label of the player's natural position
  formationPos: string;   // PT label of the slot he's filling
  links: { type: ChemLinkType; label: string; color: string; names: string[] }[];
  rawPts: number;         // raw link points (the chem LEVEL is round(rawPts / 3))
  nextAt: number | null;  // raw pts needed for the next level (null when maxed at 3/3)
}
// The player's traits, each with what it grants and a short flavour line.
export interface TraitInfo { id: string; icon: string; effect: string; flavor: string }

function collect(eff: EffectiveStats, pick: (b: EffectiveStats['breakdown']['pace']) => number): Delta[] {
  return ATTRS.map(a => ({ a, v: pick(eff.breakdown[a]) })).filter(x => x.v !== 0);
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-[11px] leading-tight font-black px-2 py-1 rounded-md"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: 'Rajdhani, sans-serif' }}>
      {text}
    </span>
  );
}

function Row({ icon, name, color, children }: { icon: string; name: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black tracking-wider" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>{name}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

// Visual por tipo de característica de time (fonte do bônus).
const TEAMCHAR: Record<string, { icon: string; label: string; color: string }> = {
  martir: { icon: '🩸', label: 'MÁRTIR', color: '#B91C1C' },
  idolo: { icon: '❤️', label: 'ÍDOLO', color: '#F59E0B' },
  decimoHomem: { icon: '🪑', label: '12º HOMEM', color: '#14B8A6' },
  noe: { icon: '🛟', label: 'NOÉ', color: '#22D3EE' },
  forasteiro: { icon: '🧳', label: 'FORASTEIRO', color: '#A3E635' },
  colecionador: { icon: '🧩', label: 'COLECIONADOR', color: '#C084FC' },
  todosPorUm: { icon: '🤝', label: 'TODOS POR UM', color: '#4ADE80' },
  arrogante: { icon: '👑', label: 'ARROGANTE', color: '#E879F9' },
};

export default function BuffBreakdown({ eff, chem, traits, player, charBoost, isStarter, formationRole, credits, playStyle }: { eff: EffectiveStats; chem?: ChemInfo; traits?: TraitInfo[]; player?: Player; charBoost?: CharBoost; isStarter?: boolean; formationRole?: string; credits?: number; playStyle?: string }) {
  // 🪑 12º Homem só rende NO BANCO — se estiver jogando, fica sem efeito. Sinaliza esse estado
  // (é a única característica cujo efeito liga/desliga de um jeito contraintuitivo).
  const decimoInactive = !!player?.decimoHomem && isStarter === true;
  // 🛟 Noé · 🧳 Forasteiro — condicionais: só valem quando a condição do XI bate. A fonte só entra
  // em charBoost quando está ATIVO, então a ausência dela = INATIVO agora.
  const noeInactive = !!player?.noe && !charBoost?.sources.some(s => s.type === 'noe');
  const forasteiroInactive = !!player?.forasteiro && !charBoost?.sources.some(s => s.type === 'forasteiro');
  const todosPorUmInactive = !!player?.todosPorUm && !charBoost?.sources.some(s => s.type === 'todosPorUm');
  const chemNet = ATTRS.reduce((s, a) => s + eff.breakdown[a].chem, 0);
  const coach = collect(eff, b => b.coach);
  const traitDeltas = collect(eff, b => b.trait);
  const tactic = collect(eff, b => b.tactic);
  const captain = collect(eff, b => b.captain);
  const train = collect(eff, b => b.train);
  const evolve = collect(eff, b => b.evolve);
  const position = collect(eff, b => b.position);
  const char = collect(eff, b => b.char);
  // A carta especial própria já é explicada no bloco especial acima. Aqui ficam apenas
  // características especiais que deram um bônus a este jogador.
  const receivedCharSources = (charBoost?.sources ?? []).filter(source => !source.self && source.fromId !== player?.id);
  const hasGlobal = eff.globalChemBonus.passing > 0 || eff.globalChemBonus.pace > 0 || eff.globalChemBonus.special > 0;
  const showChem = chemNet !== 0 || !!chem;
  const showTraits = (traits && traits.length > 0) || traitDeltas.length > 0;
  // Special draft variant (em alta / lobo / coringa / nômade / pilar) — surfaced here so its
  // effect is visible. The stat boost (em alta / lobo) lives in the BASE stats, so it never
  // shows as a per-stat delta below; the chem effects (coringa/nômade/pilar/lobo) live in the team total.
  const variant = player ? getCardVariant(player) : null;
  const variantBoost = player?.baseOverall !== undefined ? (player.overall - player.baseOverall) : (player?.inForm ? INFORM_STAT_BOOST : player?.lobo ? LOBO_STAT_BOOST : 0);
  const variantColor = variant?.color === '#FFFFFF' ? '#E5E7EB' : (variant?.color ?? '#9AA8C8');
  const prodigioStarts = player?.prodigioStarts ?? 0;
  const prodigioBoost = prodigioStatBoost(prodigioStarts);
  const goleadorGoals = player?.goleadorGoals ?? 0;
  const goleadorBoost = goleadorStatBoost(goleadorGoals);
  const garcomAssists = player?.garcomAssists ?? 0;
  const garcomBoost = garcomStatBoost(garcomAssists);
  const arroganteGoals = player?.arroganteGoals ?? 0;
  const arroganteBoost = arroganteStatBoost(arroganteGoals);
  const arrogantePenalty = arroganteTeamPenalty(arroganteGoals);
  const currentCredits = Math.max(0, credits ?? 0);
  const estribadoBoost = estribadoStatBoost(currentCredits);
  const isOutfieldInGoal = !!player && isOutfieldGoalkeeper(player, formationRole);
  const goalkeeperDefDelta = eff.breakdown.defending.goalkeeper;
  const goalkeeperDefBefore = eff.defending - goalkeeperDefDelta;
  const goalkeeperDefLoss = Math.max(0, goalkeeperDefBefore - eff.defending);
  const positionColor = eff.isOOP ? '#EF4444' : '#EAB308';
  const positionLabel = eff.isOOP ? 'FORA DE POSIÇÃO · −15%' : '2ª POSIÇÃO · −5%';
  const activeTactic = getTacticById(playStyle);
  // Named coach effects (e.g. "Visão de Jogo: +3 Geral") are ALREADY folded into the
  // per-stat TREINADOR chips below — caption them so the bonus never reads as doubled.
  const activeCoach = eff.activeCoachEffects ?? [];
  const showCaptain = captain.length > 0;
  const anything = showChem || hasGlobal || coach.length > 0 || showTraits || tactic.length > 0 || showCaptain || train.length > 0 || evolve.length > 0 || position.length > 0 || char.length > 0 || !!variant || isOutfieldInGoal;

  const chips = (list: Delta[], color: string) =>
    list.map(({ a, v }) => <Chip key={a} text={`${v > 0 ? '+' : ''}${v} ${ATTR_PT[a]}`} color={color} />);
  const chemColor = chem?.oop || chemNet < 0 ? '#EF4444' : '#22C55E';

  return (
    <div className="px-4 py-3 border-t" style={{ borderColor: '#161626', background: '#09090f' }}>
      <div className="text-xs font-black text-gray-400 tracking-widest mb-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        🧬 DE ONDE VEM O BÔNUS
      </div>
      {!anything ? (
        <div className="text-sm text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          Sem modificadores ativos — atributos no valor base.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: '#141422' }}>
          {/* SPECIAL DRAFT VARIANT — em alta / lobo / coringa / nômade / pilar. Stat boosts live in
              the base stats and chem effects in the team total, so neither shows as a delta above. */}
          {variant && player && (
            <Row icon={variant.icon}
              name={variant.key === 'decimoHomem' ? `12º HOMEM ${decimoInactive ? '(INATIVO — ESTÁ JOGANDO)' : '(ATIVO — NO BANCO)'}`
                : variant.key === 'noe' ? `NOÉ ${noeInactive ? '(INATIVO)' : '(ATIVO)'}`
                : variant.key === 'forasteiro' ? `FORASTEIRO ${forasteiroInactive ? '(INATIVO)' : '(ATIVO)'}`
                    : variant.key === 'todosPorUm' ? `TODOS POR UM ${todosPorUmInactive ? '(INATIVO)' : '(ATIVO)'}`
                      : `${variant.label} (CARTA ESPECIAL)`}
              color={(decimoInactive || noeInactive || forasteiroInactive || todosPorUmInactive) ? '#6A6A7A' : variantColor}>
              <div className="flex flex-wrap gap-1">
                {variantBoost > 0 && <Chip text={`+${variantBoost} EM CADA ATRIBUTO`} color={variantColor} />}
                {player.martir && <Chip text="−6 EM CADA ATRIBUTO" color="#EF4444" />}
                {player.martir && <Chip text={`+${MARTIR_TARGET_BOOST} EM TUDO A 2 TITULARES`} color="#22C55E" />}
                {player.idolo && <Chip text="+2 EM TUDO AOS OUTROS DO MESMO CLUBE (NÃO A ELE)" color="#22C55E" />}
                {player.decimoHomem && !decimoInactive && <Chip text={`+${DECIMO_HOMEM_STAT_BOOST} EM TUDO AO TIME (NO BANCO)`} color="#22C55E" />}
                {player.decimoHomem && decimoInactive && <Chip text="SEM EFEITO — PRECISA ESTAR NO BANCO" color="#EF4444" />}
                {player.pipoqueiro && <Chip text={`+${PIPOQUEIRO_LEAGUE_BOOST} EM TUDO NA LIGA`} color="#22C55E" />}
                {player.pipoqueiro && <Chip text={`−${PIPOQUEIRO_KO_PENALTY} EM TUDO NO MATA-MATA`} color="#EF4444" />}
                {player.noe && !noeInactive && <Chip text={`+${NOE_STAT_BOOST} EM TUDO`} color="#22C55E" />}
                {player.noe && !noeInactive && <Chip text={`+${NOE_CHEM_BONUS} QUÍMICA GERAL DO TIME`} color={variantColor} />}
                {player.noe && noeInactive && <Chip text={isStarter === false ? 'SEM EFEITO — SÓ VALE COMO TITULAR' : 'SEM EFEITO — NÃO É O ÚNICO C/ CARACTERÍSTICA'} color="#EF4444" />}
                {player.forasteiro && !forasteiroInactive && <Chip text="+8 EM TUDO" color="#22C55E" />}
                {player.forasteiro && forasteiroInactive && <Chip text={isStarter === false ? 'SEM EFEITO — SÓ VALE COMO TITULAR' : 'SEM EFEITO — COMPARTILHA PAÍS OU CLUBE'} color="#EF4444" />}
                {player.colecionador && charBoost?.sources.find(s => s.type === 'colecionador') && <Chip text={`+${charBoost.sources.find(s => s.type === 'colecionador')?.flatAll ?? 0} EM TUDO`} color="#C084FC" />}
                {player.capitaoNato && <Chip text="🗣️ BÔNUS DE CAPITÃO DOBRADO (SE FOR O CAPITÃO)" color="#F97316" />}
                {player.magnata && <Chip text="🤑 CRÉDITOS DA PARTIDA ×1,5 (TITULAR)" color="#16A34A" />}
                {player.magnata && <Chip text="−7 EM TUDO" color="#EF4444" />}
                {player.prodigio && <Chip text={`+${prodigioBoost} EM CADA ATRIBUTO (${prodigioStarts} TITULARIDADE${prodigioStarts === 1 ? '' : 'S'} · 1 A CADA ${PRODIGIO_STARTS_PER_BOOST})`} color="#FDE047" />}
                {player.resiliente && <Chip text={`+${(player.resilienteDefeats ?? 0) * RESILIENTE_DEFEAT_BOOST} EM CADA ATRIBUTO (${player.resilienteDefeats ?? 0} DERROTA${(player.resilienteDefeats ?? 0) === 1 ? '' : 'S'} COMO TITULAR)`} color="#FB7185" />}
                {player.goleador && <Chip text={`+${goleadorBoost} EM CADA ATRIBUTO (${goleadorGoals} GOL${goleadorGoals === 1 ? '' : 'S'} · 1 A CADA ${GOLEADOR_GOALS_PER_BOOST})`} color="#F97316" />}
                {player.garcom && <Chip text={`+${garcomBoost} EM CADA ATRIBUTO (${garcomAssists} ASSISTÊNCIA${garcomAssists === 1 ? '' : 'S'} · 1 A CADA ${GARCOM_ASSISTS_PER_BOOST})`} color="#38BDF8" />}
                {player.arrogante && <Chip text={`+${arroganteBoost} EM TUDO · −${arrogantePenalty} NOS OUTROS (${arroganteGoals} GOL${arroganteGoals === 1 ? '' : 'S'} · 1 PENALIDADE A CADA ${ARROGANTE_GOALS_PER_PENALTY})`} color="#E879F9" />}
                {player.estribado && <Chip text={`+${estribadoBoost} EM CADA ATRIBUTO (${currentCredits} CRÉDITOS · 1 A CADA ${ESTRIBADO_CREDITS_PER_BOOST})`} color="#FACC15" />}
                {player.todosPorUm && !todosPorUmInactive && <Chip text={`+${TODOS_POR_UM_STAT_BOOST} EM TUDO · +${TODOS_POR_UM_CHEM_BONUS} QUÍMICA GERAL`} color="#4ADE80" />}
                {player.todosPorUm && todosPorUmInactive && <Chip text="SEM EFEITO — OS 11 TITULARES PRECISAM TER" color="#EF4444" />}
                {player.lobo && <Chip text="−12 QUÍMICA GERAL DO TIME" color="#EF4444" />}
                {player.pilar && <Chip text="+12 QUÍMICA GERAL DO TIME" color={variantColor} />}
                {player.coringa && <Chip text="IMUNE A FORA-DE-POSIÇÃO" color={variantColor} />}
                {player.nomade && <Chip text="QUALQUER NAÇÃO NA QUÍMICA" color={variantColor} />}
              </div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {player.coringa ? 'Joga em qualquer posição sem penalidade de posição ou química. No gol, ainda sofre a penalidade de aptidão de goleiro por ser jogador de linha.'
                  : player.nomade ? 'Forma vínculo de química com jogadores de qualquer nação.'
                    : player.pilar ? 'Eleva a QUÍMICA GERAL do time (o número total) só por estar na escalação.'
                      : player.lobo ? 'Boost individual forte — mas reduz a QUÍMICA GERAL do time (o número total).'
                          : player.decimoHomem ? `No banco, dá +${DECIMO_HOMEM_STAT_BOOST} em todos os atributos a todo o time. Jogando, não tem efeito.`
                          : player.idolo ? 'Dá +2 em cada atributo aos OUTROS titulares do mesmo clube — não a ele mesmo.'
                            : player.martir ? `−6 em cada atributo nele (já no valor base); em troca, dá +${MARTIR_TARGET_BOOST} em tudo a 2 titulares escolhidos.`
                              : player.pipoqueiro ? `+${PIPOQUEIRO_LEAGUE_BOOST} em tudo na FASE DE LIGA, mas −${PIPOQUEIRO_KO_PENALTY} em tudo no MATA-MATA. Craque de campeonato que some no jogo grande.`
                                : player.noe ? `Só rende enquanto for o ÚNICO titular com característica: +${NOE_STAT_BOOST} em tudo nele e +${NOE_CHEM_BONUS} na química geral (põe o time inteiro na arca). Qualquer outro especial no XI desliga.`
                                  : player.forasteiro ? 'Quando é o ÚNICO do seu país E do seu clube no XI, ganha +8 em tudo — transforma a química baixa em vantagem.'
                                    : player.colecionador ? 'Ganha +1 em tudo por cada jogador que estiver na reserva.'
                                    : player.capitaoNato ? 'Se for o CAPITÃO do time, o bônus de capitão (a melhor stat dele, dada a todos) vem DOBRADO.'
                                        : player.magnata ? 'Como titular, multiplica os créditos da partida por 1,5 na liga e no mata-mata — em troca de −7 em cada atributo nele.'
                                          : player.prodigio ? `+1 em todos os atributos a cada ${PRODIGIO_STARTS_PER_BOOST} partidas iniciadas como titular (${prodigioStarts} titularidade${prodigioStarts === 1 ? '' : 's'}; bônus atual +${prodigioBoost}).`
                                            : player.resiliente ? `A cada derrota do time em que for titular, ganha +${RESILIENTE_DEFEAT_BOOST} em todos os atributos. Já acumulou ${player.resilienteDefeats ?? 0} derrota${(player.resilienteDefeats ?? 0) === 1 ? '' : 's'} como titular.`
                                                : player.goleador ? `A cada ${GOLEADOR_GOALS_PER_BOOST} gols marcados, ganha +1 em todos os atributos. Já marcou ${goleadorGoals} gol${goleadorGoals === 1 ? '' : 's'} e o bônus atual é +${goleadorBoost}.`
                                                  : player.garcom ? `A cada ${GARCOM_ASSISTS_PER_BOOST} assistências dadas, ganha +1 em todos os atributos. Já deu ${garcomAssists} assistência${garcomAssists === 1 ? '' : 's'} e o bônus atual é +${garcomBoost}.`
                                                    : player.arrogante ? `Ganha +2 em todos os atributos por gol. A cada ${ARROGANTE_GOALS_PER_PENALTY} gols, os outros titulares perdem −1 em tudo. Já marcou ${arroganteGoals} gol${arroganteGoals === 1 ? '' : 's'}; bônus próprio +${arroganteBoost} e penalidade atual −${arrogantePenalty}.`
                                     : player.estribado ? `A cada ${ESTRIBADO_CREDITS_PER_BOOST} créditos disponíveis, ganha +1 em todos os atributos. Saldo atual: ${currentCredits} créditos; bônus atual +${estribadoBoost}.`
                                       : player.todosPorUm ? `Só funciona quando os 11 titulares têm a característica: todos recebem +${TODOS_POR_UM_STAT_BOOST} em tudo e o time ganha +${TODOS_POR_UM_CHEM_BONUS} de química geral.`
                                         : 'Já no valor base — por isso não aparece como delta acima.'}
              </div>
            </Row>
          )}

          {/* INDIVIDUAL CHEMISTRY — the multiplier AND why (connections / out-of-position) */}
          {showChem && (
            <Row icon="🔗" color={chemColor}
              name={`QUÍMICA INDIVIDUAL (${eff.chemScore}/3)${chem?.oop ? ' · FORA DE POSIÇÃO' : ''}`}>
              <div className="flex flex-wrap gap-1">
                <Chip text={`×${eff.chemMult.toFixed(2)}`} color={chemColor} />
                {chemNet !== 0 && <Chip text={`${chemNet > 0 ? '+' : ''}${chemNet} no total`} color={chemColor} />}
              </div>
              {chem?.oop ? (
                <div className="text-[10px] leading-snug mt-1.5 rounded-md px-2 py-1.5" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#FCA5A5', background: '#EF444415', border: '1px solid #EF444433' }}>
                  Joga como <b>{chem.formationPos}</b>, mas é <b>{chem.nativePos}</b> de origem → a química zera e ele perde rendimento. Troque por alguém da posição.
                </div>
              ) : chem && chem.links.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {chem.links.map(l => (
                      <span key={l.type} className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ fontFamily: 'Rajdhani, sans-serif', color: l.color, background: `${l.color}1A`, border: `1px solid ${l.color}44` }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                        {l.label}: {l.names.join(', ')}
                      </span>
                    ))}
                  </div>
                  {chem.nextAt != null && (
                    <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      Vínculos somam <b style={{ color: '#CFCFE0' }}>{chem.rawPts} pt{chem.rawPts === 1 ? '' : 's'}</b>
                      {chem.rawPts < chem.nextAt
                        ? <> — faltam <b style={{ color: '#E8C84A' }}>{chem.nextAt - chem.rawPts}</b> pra subir 1 nível de química.</>
                        : <> — suficiente pro nível atual.</>}
                    </div>
                  )}
                </>
              ) : chem ? (
                <div className="text-[9px] text-gray-500 mt-1.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Na posição certa, mas sem vínculos (clube/nação/técnico) com os titulares.
                </div>
              ) : null}
            </Row>
          )}

          {isOutfieldInGoal && (
            <Row icon="🧤" name="APTIDÃO NO GOL" color="#F59E0B">
              <div className="flex flex-wrap gap-1">
                <Chip text={`−30% DEF = −${goalkeeperDefLoss} DEF`} color="#F59E0B" />
              </div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                Jogadores de linha aproveitam 70% da Defesa para defender. O valor exibido já inclui o ajuste.
              </div>
            </Row>
          )}

          {hasGlobal && (
            <Row icon="⭐" name="QUÍMICA DO TIME (global)" color="#C9A84C">
              <div className="flex flex-wrap gap-1">
                {eff.globalChemBonus.passing > 0 && <Chip text={`+${eff.globalChemBonus.passing} PAS`} color="#C9A84C" />}
                {eff.globalChemBonus.pace > 0 && <Chip text={`+${eff.globalChemBonus.pace} RIT`} color="#C9A84C" />}
                {eff.globalChemBonus.special > 0 && <Chip text={`✨ +${eff.globalChemBonus.special} EM TODOS`} color="#C9A84C" />}
              </div>
              {eff.globalChemBonus.special > 0 && (
                <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Bônus de química do time: <b style={{ color: '#E8C84A' }}>+{eff.globalChemBonus.special} em todos os atributos</b> de todos os titulares (sobe a cada marco, +5 na química perfeita).
                </div>
              )}
            </Row>
          )}

          {/* CAPTAIN — the armband lifts the captain's single best stat by +3 for the WHOLE
              team (the captain included). Applied by the engine but never surfaced as a delta
              before, so without this row it was an invisible buff. */}
          {showCaptain && (
            <Row icon="👑" name="CAPITÃO" color="#3B82F6">
              <div className="flex flex-wrap gap-1">{chips(captain, '#3B82F6')}</div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                A melhor estatística do capitão vira <b style={{ color: '#93C5FD' }}>+{captain[0]?.v ?? 3}</b> pra todo o time — inclusive pra ele.
              </div>
            </Row>
          )}

          {coach.length > 0 && (
            <Row icon="🎯" name="TREINADOR" color="#E8C84A">
              <div className="flex flex-wrap gap-1">{chips(coach, '#E8C84A')}</div>
              {activeCoach.length > 0 && (
                <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Já inclui: {activeCoach.join(' · ')}
                </div>
              )}
            </Row>
          )}

          {/* TRAITS — each one named, with what it grants and a flavour line */}
          {showTraits && (
            <Row icon="🎯" name="ESTILOS DE JOGO" color="#A78BFA">
              {traits && traits.length > 0 ? (
                <div className="space-y-1">
                  {traits.map(t => (
                    <div key={t.id} className="flex items-start gap-1.5">
                      <span className="text-xs flex-shrink-0 leading-none mt-0.5">{t.icon}</span>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{t.id}</span>
                        {t.effect && <span className="text-[9px] font-bold" style={{ color: '#A78BFA', fontFamily: 'Rajdhani, sans-serif' }}> — {t.effect}</span>}
                        {t.flavor && <div className="text-[8px] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{t.flavor}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">{chips(traitDeltas, '#A78BFA')}</div>
              )}
            </Row>
          )}

          {tactic.length > 0 && (
            <Row icon="📋" name={`TÁTICA (${activeTactic.name.toUpperCase()})`} color="#4FC3F7">
              <div className="flex flex-wrap gap-1">{chips(tactic, '#4FC3F7')}</div>
            </Row>
          )}

          {/* TREINO — permanent per-attribute boost bought in the shop. Stacks with no cap and
              already flows into the effective overall (it's a delta like any other buff). */}
          {train.length > 0 && (
            <Row icon="💪" name="TREINO (LOJA)" color="#34D399">
              <div className="flex flex-wrap gap-1">{chips(train, '#34D399')}</div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                Melhoria permanente comprada na loja — soma direto no atributo (sem teto) e reflete no geral.
              </div>
            </Row>
          )}

          {/* ⭐ EVOLUÇÃO — bônus aplicado aos atributos escolhidos. */}
          {evolve.length > 0 && (
              <Row icon="⭐" name="EVOLUÇÃO" color="#22C55E">
              <div className="flex flex-wrap gap-1">{chips(evolve, '#22C55E')}</div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                Bônus de evolução aplicado aos atributos escolhidos — soma direto nos atributos e reflete no geral.
              </div>
            </Row>
          )}

          {/* As características da própria carta já aparecem no bloco especial acima. */}

          {/* 🔁 POSIÇÃO — penalidade por jogar fora da nativa (química fica intacta). */}
          {position.length > 0 && (
            <Row icon="🔁" name={positionLabel} color={positionColor}>
              <div className="flex flex-wrap items-center gap-1">{chips(position, positionColor)}</div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                A penalidade acima é aplicada aos atributos da carta. A química não é afetada.
              </div>
            </Row>
          )}

          {/* 🩸❤️🪑👑 Bônus recebido de características especiais de companheiros. */}
          {/* Uma linha específica por fonte — sem repetir a característica do próprio jogador. */}
          {receivedCharSources.length > 0
            ? receivedCharSources.map((src, i) => {
              const vis = TEAMCHAR[src.type];
              return (
                <Row key={i} icon={vis.icon} name={src.self ? `${vis.label} (ATIVO)` : `${vis.label} — de ${src.fromName}`} color={vis.color}>
                  <div className="flex flex-wrap gap-1">
                    {src.flatAll !== 0 && <Chip text={`${src.flatAll > 0 ? '+' : ''}${src.flatAll} EM CADA ATRIBUTO`} color={src.flatAll < 0 ? '#EF4444' : vis.color} />}
                    {Object.entries(src.perStat as Record<string, number>).map(([k, v]) => (
                      <Chip key={k} text={`+${v} ${ATTR_PT[k] ?? k.toUpperCase()}`} color={vis.color} />
                    ))}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    {src.type === 'martir' ? `Sacrifício do ${src.fromName} (Mártir): +${MARTIR_TARGET_BOOST} em tudo pra você.`
                      : src.type === 'idolo' ? `${src.fromName} (Ídolo) do mesmo clube: +2 em cada atributo.`
                        : src.type === 'noe' ? `Noé ATIVO: é o único titular com característica → +${NOE_STAT_BOOST} em tudo (e +${NOE_CHEM_BONUS} na química geral do time).`
                          : src.type === 'forasteiro' ? 'Forasteiro ATIVO: único do seu país e clube no XI → +8 em tudo.'
                            : src.type === 'colecionador' ? `${src.fromName} (Colecionador): +1 por jogador na reserva → +${src.flatAll} em tudo.`
                              : src.type === 'arrogante' ? `${src.fromName} (Arrogante): a cada ${ARROGANTE_GOALS_PER_PENALTY} gols dele, os outros titulares perdem −1 em tudo.`
                                : src.type === 'todosPorUm' ? `Todos por um ATIVO: os 11 titulares têm a característica → +${TODOS_POR_UM_STAT_BOOST} em tudo e +${TODOS_POR_UM_CHEM_BONUS} na química geral.`
                                  : `${src.fromName} (12º Homem) no banco: +${DECIMO_HOMEM_STAT_BOOST} em todos os atributos.`}
                  </div>
                </Row>
              );
            })
            : char.length > 0 && !variant && (
              <Row icon="🤝" name="CARACTERÍSTICA DO TIME" color="#F472B6">
                <div className="flex flex-wrap gap-1">{chips(char, '#F472B6')}</div>
              </Row>
            )}
        </div>
      )}
    </div>
  );
}
