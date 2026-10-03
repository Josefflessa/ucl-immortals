// UCL Immortals — explains WHERE a player's stat buffs come from.
// The detail modal shows the net delta per stat, but not its sources. This breaks
// the uplift into: individual chemistry (a multiplier + WHY, via the connection web),
// team-wide chemistry, the coach, the player's traits (named, with what each grants)
// and the tactic — data-driven from EffectiveStats.breakdown so it always matches what
// the match engine actually uses.
import { EffectiveStats, ChemLinkType, CharBoost, LOBO_CHEM_PENALTY, PILAR_CHEM_BONUS, ARROGANTE_GOALS_PER_PENALTY, arroganteStatBoost, arroganteTeamPenalty, DECIMO_HOMEM_STAT_BOOST, ESTRIBADO_CREDITS_PER_BOOST, FRAGIL_STAT_BOOST, GARCOM_ASSISTS_PER_BOOST, GOLEADOR_GOALS_PER_BOOST, INFORM_STAT_BOOST, LOBO_STAT_BOOST, MARTIR_TARGET_BOOST, MERCENARIO_STAT_BOOST_PER_MISSION, NOE_CHEM_BONUS, NOE_STAT_BOOST, PIPOQUEIRO_KO_PENALTY, PIPOQUEIRO_LEAGUE_BOOST, PRODIGIO_STARTS_PER_BOOST, RESILIENTE_DEFEAT_BOOST, TODOS_POR_UM_CHEM_BONUS, TODOS_POR_UM_STAT_BOOST, estribadoStatBoost, garcomStatBoost, goleadorStatBoost, isOutfieldGoalkeeper, mercenarioStatBoost, prodigioStatBoost } from '@shared/game/gameEngine';
import { getTacticById, Player } from '@shared/game/gameData';
import { getCardVariants } from './PlayerCard';

const ATTR_PT: Record<string, string> = {
  pace: 'RIT', shooting: 'FIN', passing: 'PAS', dribbling: 'DRI', defending: 'DEF', physical: 'FIS',
  vision: 'VIS', composure: 'CMP',
};
const ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure'] as const;

type Delta = { a: string; v: number };

// Individual-chemistry context: who this player connects with (and why), or why he is OOP.
interface ChemInfo {
  oop: boolean;
  nativePos: string;      // PT label of the player's natural position
  formationPos: string;   // PT label of the slot he's filling
  links: { type: ChemLinkType; label: string; color: string; names: string[] }[];
  rawPts: number;         // raw link points (the chem LEVEL is round(rawPts / 3))
  nextAt: number | null;  // raw pts needed for the next level (null when maxed at 3/3)
}
// The player's traits, each with what it grants and a short flavour line.
interface TraitInfo { id: string; icon: string; effect: string; flavor: string }

function collect(eff: EffectiveStats, pick: (b: EffectiveStats['breakdown']['pace']) => number): Delta[] {
  return ATTRS.map(a => ({ a, v: pick(eff.breakdown[a]) })).filter(x => x.v !== 0);
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-[13px] leading-tight font-black px-2 py-1 rounded-md"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: 'var(--font-game), sans-serif' }}>
      {text}
    </span>
  );
}

function Row({ icon, name, color, children }: { icon: string; name: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black tracking-wider" style={{ color, fontFamily: 'var(--font-game), sans-serif' }}>{name}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

type VariantEffectChip = { text: string; color: string };

function specialVariantDetails({ variant, player, charBoost, isStarter, credits, inactive }: {
  variant: ReturnType<typeof getCardVariants>[number];
  player: Player;
  charBoost?: CharBoost;
  isStarter?: boolean;
  credits?: number;
  inactive: boolean;
}): { chips: VariantEffectChip[]; description: string } {
  const green = '#22C55E';
  const red = '#EF4444';
  const color = variant.color === '#FFFFFF' ? '#E5E7EB' : variant.color;
  const prodigioStarts = player.prodigioStarts ?? 0;
  const goleadorGoals = player.goleadorGoals ?? 0;
  const garcomAssists = player.garcomAssists ?? 0;
  const arroganteGoals = player.arroganteGoals ?? 0;
  const arroganteBoost = arroganteStatBoost(arroganteGoals);
  const arrogantePenalty = arroganteTeamPenalty(arroganteGoals);
  const mercenarioMissions = player.mercenarioMissions ?? 0;
  const currentCredits = Math.max(0, credits ?? 0);
  const colecionadorBoost = charBoost?.sources.find(source => source.type === 'colecionador')?.flatAll;

  switch (variant.key) {
    case 'inForm':
      return { chips: [{ text: `+${INFORM_STAT_BOOST} EM CADA ATRIBUTO`, color }], description: `A carta recebe +${INFORM_STAT_BOOST} em cada atributo; esse bônus já está incluído no geral e nos atributos impressos.` };
    case 'lobo':
      return { chips: [
        { text: `+${LOBO_STAT_BOOST} EM CADA ATRIBUTO`, color },
        { text: '−12 QUÍMICA GERAL DO TIME', color: red },
      ], description: `Recebe +${LOBO_STAT_BOOST} em cada atributo, já incluídos nos valores da carta, mas reduz em ${LOBO_CHEM_PENALTY} a química geral do time.` };
    case 'coringa':
      return { chips: [{ text: 'IMUNE A FORA-DE-POSIÇÃO', color }], description: 'Pode jogar em qualquer posição sem penalidade de posição ou de química. No gol, ainda sofre a penalidade de aptidão por ser jogador de linha.' };
    case 'nomade':
      return { chips: [{ text: 'QUALQUER NAÇÃO NA QUÍMICA', color }], description: 'Forma vínculos de química como se fosse de qualquer nação.' };
    case 'pilar':
      return { chips: [{ text: `+${PILAR_CHEM_BONUS} QUÍMICA GERAL DO TIME`, color }], description: `Aumenta em ${PILAR_CHEM_BONUS} a química geral do time enquanto estiver na escalação.` };
    case 'martir':
      return { chips: [
        { text: '−6 EM CADA ATRIBUTO', color: red },
        { text: `+${MARTIR_TARGET_BOOST} EM TUDO A 2 TITULARES`, color: green },
      ], description: `Sacrifica 6 em cada atributo e concede +${MARTIR_TARGET_BOOST} em tudo a dois titulares escolhidos.` };
    case 'idolo':
      return { chips: [{ text: '+2 EM TUDO AOS OUTROS DO MESMO CLUBE', color: green }], description: 'Concede +2 em cada atributo aos outros titulares do mesmo clube; o próprio Ídolo não recebe esse bônus.' };
    case 'decimoHomem':
      return {
        chips: [inactive
          ? { text: 'SEM EFEITO — PRECISA ESTAR NO BANCO', color: red }
          : { text: `+${DECIMO_HOMEM_STAT_BOOST} EM TUDO AO TIME (NO BANCO)`, color: green }],
        description: `Só funciona no banco: concede +${DECIMO_HOMEM_STAT_BOOST} em todos os atributos a todo o time.`,
      };
    case 'pipoqueiro':
      return { chips: [
        { text: `+${PIPOQUEIRO_LEAGUE_BOOST} EM TUDO NA FASE DE LIGA`, color: green },
        { text: `−${PIPOQUEIRO_KO_PENALTY} EM TUDO NO MATA-MATA`, color: red },
      ], description: `Recebe +${PIPOQUEIRO_LEAGUE_BOOST} em cada atributo na fase de liga e −${PIPOQUEIRO_KO_PENALTY} no mata-mata.` };
    case 'noe':
      return {
        chips: inactive
          ? [{ text: isStarter === false ? 'SEM EFEITO — SÓ VALE COMO TITULAR' : 'SEM EFEITO — NÃO É O ÚNICO C/ CARACTERÍSTICA', color: red }]
          : [
            { text: `+${NOE_STAT_BOOST} EM TUDO`, color: green },
            { text: `+${NOE_CHEM_BONUS} QUÍMICA GERAL DO TIME`, color },
          ],
        description: `Só funciona enquanto for o único titular com característica: recebe +${NOE_STAT_BOOST} em tudo e dá +${NOE_CHEM_BONUS} de química geral ao time.`,
      };
    case 'forasteiro':
      return {
        chips: inactive
          ? [{ text: isStarter === false ? 'SEM EFEITO — SÓ VALE COMO TITULAR' : 'SEM EFEITO — COMPARTILHA PAÍS OU CLUBE', color: red }]
          : [{ text: '+8 EM TUDO', color: green }],
        description: 'Recebe +8 em cada atributo quando é o único titular do seu país e do seu clube.'
      };
    case 'colecionador':
      return {
        chips: colecionadorBoost === undefined ? [] : [{ text: `+${colecionadorBoost} EM TUDO`, color }],
        description: 'Ganha +1 em cada atributo por jogador que estiver na reserva.',
      };
    case 'estribado':
      return { chips: [{ text: `+${estribadoStatBoost(currentCredits)} EM CADA ATRIBUTO (${currentCredits} CRÉDITOS · 1 A CADA ${ESTRIBADO_CREDITS_PER_BOOST})`, color }], description: `A cada ${ESTRIBADO_CREDITS_PER_BOOST} créditos disponíveis, ganha +1 em cada atributo. Saldo atual: ${currentCredits} créditos.` };
    case 'todosPorUm':
      return {
        chips: inactive
          ? [{ text: 'SEM EFEITO — OS 11 TITULARES PRECISAM TER', color: red }]
          : [{ text: `+${TODOS_POR_UM_STAT_BOOST} EM TUDO · +${TODOS_POR_UM_CHEM_BONUS} QUÍMICA GERAL`, color: green }],
        description: `Só funciona quando os 11 titulares têm a característica: todos recebem +${TODOS_POR_UM_STAT_BOOST} em tudo e o time ganha +${TODOS_POR_UM_CHEM_BONUS} de química geral.`,
      };
    case 'capitaoNato':
      return { chips: [{ text: 'BÔNUS DE CAPITÃO DOBRADO (SE FOR O CAPITÃO)', color: '#F97316' }], description: 'Se for escolhido como capitão, dobra o bônus de capitão que concede a todo o time.' };
    case 'magnata':
      return { chips: [
        { text: 'CRÉDITOS DA PARTIDA ×1,5 (TITULAR)', color: green },
        { text: '−7 EM TUDO', color: red },
      ], description: 'Como titular, multiplica por 1,5 os créditos da partida; em troca, perde 7 em cada atributo.' };
    case 'fragil':
      return { chips: [
        { text: `+${FRAGIL_STAT_BOOST} EM TUDO`, color: '#F59E0B' },
        { text: 'RISCO DE LESÃO MUITO MAIOR', color: red },
      ], description: `Recebe +${FRAGIL_STAT_BOOST} em todos os atributos, mas fica muito mais sujeito a lesões.` };
    case 'prodigio': {
      const boost = prodigioStatBoost(prodigioStarts);
      return { chips: [{ text: `+${boost} EM CADA ATRIBUTO (${prodigioStarts} TITULARIDADE${prodigioStarts === 1 ? '' : 'S'} · 1 A CADA ${PRODIGIO_STARTS_PER_BOOST})`, color: '#FDE047' }], description: `Ganha +1 em todos os atributos a cada ${PRODIGIO_STARTS_PER_BOOST} titularidades. Já acumulou ${prodigioStarts}; bônus atual: +${boost}.` };
    }
    case 'resiliente': {
      const defeats = player.resilienteDefeats ?? 0;
      return { chips: [{ text: `+${defeats * RESILIENTE_DEFEAT_BOOST} EM CADA ATRIBUTO (${defeats} DERROTA${defeats === 1 ? '' : 'S'} COMO TITULAR)`, color: '#FB7185' }], description: `Ganha +${RESILIENTE_DEFEAT_BOOST} em todos os atributos a cada derrota do time enquanto for titular. Acumulado: ${defeats} derrota${defeats === 1 ? '' : 's'}.` };
    }
    case 'goleador': {
      const boost = goleadorStatBoost(goleadorGoals);
      return { chips: [{ text: `+${boost} EM CADA ATRIBUTO (${goleadorGoals} GOL${goleadorGoals === 1 ? '' : 'S'} · 1 A CADA ${GOLEADOR_GOALS_PER_BOOST})`, color: '#F97316' }], description: `Ganha +1 em todos os atributos a cada ${GOLEADOR_GOALS_PER_BOOST} gols. Já marcou ${goleadorGoals}; bônus atual: +${boost}.` };
    }
    case 'garcom': {
      const boost = garcomStatBoost(garcomAssists);
      return { chips: [{ text: `+${boost} EM CADA ATRIBUTO (${garcomAssists} ASSISTÊNCIA${garcomAssists === 1 ? '' : 'S'} · 1 A CADA ${GARCOM_ASSISTS_PER_BOOST})`, color: '#38BDF8' }], description: `Ganha +1 em todos os atributos a cada ${GARCOM_ASSISTS_PER_BOOST} assistências. Já deu ${garcomAssists}; bônus atual: +${boost}.` };
    }
    case 'arrogante':
      return { chips: [{ text: `+${arroganteBoost} EM TUDO · −${arrogantePenalty} NOS OUTROS (${arroganteGoals} GOL${arroganteGoals === 1 ? '' : 'S'} · 1 PENALIDADE A CADA ${ARROGANTE_GOALS_PER_PENALTY})`, color: '#E879F9' }], description: `Ganha +2 em tudo por gol. A cada ${ARROGANTE_GOALS_PER_PENALTY} gols, os outros titulares perdem −1 em tudo. Já marcou ${arroganteGoals}; bônus próprio +${arroganteBoost}, penalidade atual −${arrogantePenalty}.` };
    case 'mercenario': {
      const boost = mercenarioStatBoost(mercenarioMissions);
      return { chips: [{ text: `+${boost} EM CADA ATRIBUTO (${mercenarioMissions} ${mercenarioMissions === 1 ? 'MISSÃO' : 'MISSÕES'} · +${MERCENARIO_STAT_BOOST_PER_MISSION} POR MISSÃO)`, color: '#F59E0B' }], description: `Ganha +${MERCENARIO_STAT_BOOST_PER_MISSION} em todos os atributos por missão concluída. Já concluiu ${mercenarioMissions} ${mercenarioMissions === 1 ? 'missão' : 'missões'}; bônus atual: +${boost}.` };
    }
    default:
      return { chips: [], description: '' };
  }
}

function SpecialVariantRow({ variant, player, charBoost, isStarter, credits }: {
  variant: ReturnType<typeof getCardVariants>[number];
  player: Player;
  charBoost?: CharBoost;
  isStarter?: boolean;
  credits?: number;
}) {
  const inactive = variant.key === 'decimoHomem' ? isStarter === true
    : variant.key === 'noe' ? !charBoost?.sources.some(source => source.type === 'noe')
      : variant.key === 'forasteiro' ? !charBoost?.sources.some(source => source.type === 'forasteiro')
        : variant.key === 'todosPorUm' ? !charBoost?.sources.some(source => source.type === 'todosPorUm')
          : false;
  const title = variant.key === 'decimoHomem' ? `${variant.label} ${inactive ? '(INATIVO — ESTÁ JOGANDO)' : '(ATIVO — NO BANCO)'}`
    : ['noe', 'forasteiro', 'todosPorUm'].includes(variant.key) ? `${variant.label} ${inactive ? '(INATIVO)' : '(ATIVO)'}`
      : variant.label;
  const color = inactive ? '#6A6A7A' : (variant.color === '#FFFFFF' ? '#E5E7EB' : variant.color);
  const details = specialVariantDetails({ variant, player, charBoost, isStarter, credits, inactive });

  return (
    <Row icon={variant.icon} name={title} color={color}>
      {details.chips.length > 0 && <div className="flex flex-wrap gap-1">{details.chips.map((chip, index) => <Chip key={`${variant.key}-${index}`} text={chip.text} color={chip.color} />)}</div>}
      {details.description && <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{details.description}</div>}
    </Row>
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
  const chemNet = ATTRS.reduce((s, a) => s + eff.breakdown[a].chem, 0);
  const coach = collect(eff, b => b.coach);
  const traitDeltas = collect(eff, b => b.trait);
  const tactic = collect(eff, b => b.tactic);
  const captain = collect(eff, b => b.captain);
  const train = collect(eff, b => b.train);
  const evolve = collect(eff, b => b.evolve);
  const specialization = collect(eff, b => b.specialization);
  const evolution = [...evolve, ...specialization];
  const position = collect(eff, b => b.position);
  const char = collect(eff, b => b.char);
  const medicalReturnBoost = Math.max(0, Math.floor(player?.medicalReturnBoost ?? 0));
  // A carta especial própria já é explicada no bloco especial acima. Aqui ficam apenas
  // características especiais que deram um bônus a este jogador.
  const receivedCharSources = (charBoost?.sources ?? []).filter(source => !source.self && source.fromId !== player?.id);
  const hasGlobal = eff.globalChemBonus.passing > 0 || eff.globalChemBonus.pace > 0 || eff.globalChemBonus.special > 0;
  const showChem = chemNet !== 0 || !!chem;
  const showTraits = (traits && traits.length > 0) || traitDeltas.length > 0;
  // Uma carta Única pode ter duas características; cada uma recebe sua própria linha e explicação.
  const variants = player ? getCardVariants(player) : [];
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
  const anything = showChem || hasGlobal || coach.length > 0 || showTraits || tactic.length > 0 || showCaptain || train.length > 0 || evolution.length > 0 || position.length > 0 || char.length > 0 || variants.length > 0 || medicalReturnBoost > 0 || isOutfieldInGoal;

  const chips = (list: Delta[], color: string) =>
    list.map(({ a, v }) => <Chip key={a} text={`${v > 0 ? '+' : ''}${v} ${ATTR_PT[a]}`} color={color} />);
  const chemColor = chem?.oop || chemNet < 0 ? '#EF4444' : '#22C55E';

  return (
    <div className="px-4 py-3 border-t" style={{ borderColor: '#161626', background: '#09090f' }}>
      <div className="text-xs font-black text-gray-400 tracking-widest mb-2" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
        🧬 DE ONDE VEM O BÔNUS
      </div>
      {!anything ? (
        <div className="text-sm text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
          Sem modificadores ativos — atributos no valor base.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: '#141422' }}>
          {variants.map(variant => player && <SpecialVariantRow key={variant.key} variant={variant} player={player} charBoost={charBoost} isStarter={isStarter} credits={credits} />)}

          {medicalReturnBoost > 0 && (
            <Row icon="🏥" name="DEPARTAMENTO MÉDICO" color="#22D3EE">
              <div className="flex flex-wrap gap-1">
                <Chip text={`+${medicalReturnBoost} EM CADA ATRIBUTO`} color="#22D3EE" />
              </div>
              <div className="mt-1 text-[12px] text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                Bônus permanente acumulado ao voltar de lesões. Já está incorporado aos atributos e ao geral da carta.
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
                <div className="text-[12px] leading-snug mt-1.5 rounded-md px-2 py-1.5" style={{ fontFamily: 'var(--font-game), sans-serif', color: '#FCA5A5', background: '#EF444415', border: '1px solid #EF444433' }}>
                  Joga como <b>{chem.formationPos}</b>, mas é <b>{chem.nativePos}</b> de origem → a química zera e ele perde rendimento. Troque por alguém da posição.
                </div>
              ) : chem && chem.links.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {chem.links.map(l => (
                      <span key={l.type} className="inline-flex items-center gap-1 text-[12px] font-bold px-1.5 py-0.5 rounded"
                        style={{ fontFamily: 'var(--font-game), sans-serif', color: l.color, background: `${l.color}1A`, border: `1px solid ${l.color}44` }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                        {l.label}: {l.names.join(', ')}
                      </span>
                    ))}
                  </div>
                  {chem.nextAt != null && (
                    <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                      Vínculos somam <b style={{ color: 'var(--ui-text-soft)' }}>{chem.rawPts} pt{chem.rawPts === 1 ? '' : 's'}</b>
                      {chem.rawPts < chem.nextAt
                        ? <> — faltam <b style={{ color: 'var(--ui-brand-strong)' }}>{chem.nextAt - chem.rawPts}</b> pra subir 1 nível de química.</>
                        : <> — suficiente pro nível atual.</>}
                    </div>
                  )}
                </>
              ) : chem ? (
                <div className="text-[12px] text-gray-500 mt-1.5" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
              <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
                <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                  Bônus de química do time: <b style={{ color: 'var(--ui-brand-strong)' }}>+{eff.globalChemBonus.special} em todos os atributos</b> de todos os titulares (sobe a cada marco, +5 na química perfeita).
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
              <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                A melhor estatística do capitão vira <b style={{ color: '#93C5FD' }}>+{captain[0]?.v ?? 3}</b> pra todo o time — inclusive pra ele.
              </div>
            </Row>
          )}

          {coach.length > 0 && (
            <Row icon="🎯" name="TREINADOR" color="#E8C84A">
              <div className="flex flex-wrap gap-1">{chips(coach, '#E8C84A')}</div>
              {activeCoach.length > 0 && (
                <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
                        <span className="text-[12px] font-black text-white" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{t.id}</span>
                        {t.effect && <span className="text-[12px] font-bold" style={{ color: '#A78BFA', fontFamily: 'var(--font-game), sans-serif' }}> — {t.effect}</span>}
                        {t.flavor && <div className="text-[12px] text-gray-500" style={{ fontFamily: 'var(--font-game), sans-serif' }}>{t.flavor}</div>}
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
              <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                Melhoria permanente comprada na loja — soma direto no atributo (sem teto) e reflete no geral.
              </div>
            </Row>
          )}

          {/* ⭐ EVOLUÇÃO — bônus aplicado aos atributos escolhidos. */}
          {evolution.length > 0 && (
            <Row icon="⭐" name="EVOLUÇÃO" color="#22C55E">
              <div className="flex flex-wrap gap-1">{chips(evolution, '#22C55E')}</div>
              <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
                Bônus de evolução aplicados aos atributos escolhidos — soma direto nos atributos e reflete no geral.
              </div>
            </Row>
          )}

          {/* As características da própria carta já aparecem no bloco especial acima. */}

          {/* 🔁 POSIÇÃO — penalidade por jogar fora da nativa (química fica intacta). */}
          {position.length > 0 && (
            <Row icon="🔁" name={positionLabel} color={positionColor}>
              <div className="flex flex-wrap items-center gap-1">{chips(position, positionColor)}</div>
              <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
                  <div className="text-[12px] text-gray-500 mt-1" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
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
            : char.length > 0 && variants.length === 0 && (
              <Row icon="🤝" name="CARACTERÍSTICA DO TIME" color="#F472B6">
                <div className="flex flex-wrap gap-1">{chips(char, '#F472B6')}</div>
              </Row>
            )}
        </div>
      )}
    </div>
  );
}
