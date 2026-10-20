// UCL Immortals — explains WHERE a player's numbers come from, grouped as the player thinks
// about them: what belongs to the CARD, what comes from the TEAM (chemistry, captain, coach,
// tactic, teammates) and what only switches on DURING A MATCH. Everything is read from the
// player-sheet model, which is computed by the same engine functions the match uses.
import TraitIcon from './TraitIcon';
import PlaystyleIcon from './PlaystyleIcon';
import { BookOpenCheck, ChevronsUp, ClipboardList, Dna, Dumbbell, GraduationCap, Hand, House, Link, Palette, Repeat, Star, Timer } from 'lucide-react';
import { INLINE_ICON } from './inlineIcon';
import { useState } from 'react';
import {
  ARROGANTE_GOALS_PER_PENALTY, IMPROVISADOR_SECONDARY_CHEM, IMPROVISADOR_OOP_CHEM, DESENFREADO_CHEM_PER_BOOST, FAZ_TUDO_STARTS_TO_LEARN, FOMINHA_STAT_BOOST_PER_GOAL, FOMINHA_CHEM_PENALTY_PER_GOAL, POLIGLOTA_STAT_BOOST_PER_NATION, ARROGANTE_STAT_BOOST_PER_GOAL, DECIMO_HOMEM_STAT_BOOST, DECIMO_HOMEM_CHEM_BONUS, CORINGA_SECONDARY_STAT_BOOST, CORINGA_OOP_STAT_BOOST, ESTRIBADO_CREDITS_PER_BOOST,
  FORASTEIRO_STAT_BOOST, FORASTEIRO_CHEM_PENALTY_PER_PLAYER, FRAGIL_STAT_BOOST, GARCOM_ASSISTS_PER_BOOST, GOLEADOR_GOALS_PER_BOOST, IDOLO_STAT_BOOST,
  INFORM_STAT_BOOST, LOBO_CHEM_PENALTY, LOBO_STAT_BOOST, MAGNATA_POINT_MULT, MAGNATA_STAT_PENALTY, MARTIR_INITIAL_DISTRIBUTION,
  LAPIDADOR_RESERVE_BOOST, APOSTADOR_STAT_BOOST_PER_WIN, AGREGADOR_STAT_BOOST_PER_TRAIT, MIDIATICO_CREDITS_PER_GOAL, apostadorStatBoost, martirDistributionLimit, MERCENARIO_STAT_BOOST_PER_MISSION, NOE_CHEM_BONUS, PADRINHO_AFILHADO_BOOST, NOE_STAT_BOOST, OUTFIELD_GK_MULTIPLIER,
  PILAR_CHEM_BONUS, PIPOQUEIRO_KO_PENALTY, PIPOQUEIRO_LEAGUE_BOOST, PRODIGIO_STARTS_PER_BOOST, RESILIENTE_DEFEAT_BOOST,
  TODOS_POR_UM_STAT_BOOST, arroganteStatBoost, arroganteTeamPenalty, estribadoStatBoost,
  garcomStatBoost, goleadorStatBoost, mercenarioStatBoost, padrinhoStatBoost, prodigioStatBoost, type CharBoost, type StatBreakdown,
} from '@shared/game/gameEngine';
import { getTacticById, POS_PT, type Player } from '@shared/game/gameData';
import { getCardVariants } from './PlayerCard';
import { ATTR_SHORT, SHEET_ATTRS, type PlayerSheetModel } from './player-sheet/playerSheetModel';

const GREEN = '#22C55E';
const RED = '#EF4444';
const MUTED = '#6A6A7A';
const FONT = { fontFamily: 'var(--font-game), sans-serif' } as const;

type Chip = { text: string; color: string; dim?: boolean };

function ChipView({ text, color, dim }: Chip) {
  return (
    <span className="rounded-md px-2 py-1 text-[13px] font-black leading-tight"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44`, opacity: dim ? 0.45 : 1, ...FONT }}>
      {text}
    </span>
  );
}

function Chips({ items }: { items: Chip[] }) {
  if (items.length === 0) return null;
  return <div className="flex flex-wrap gap-1">{items.map((c, i) => <ChipView key={i} {...c} />)}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[12px] leading-snug text-[var(--ui-text-muted)]" style={FONT}>{children}</div>;
}

function Row({ icon, name, color, children }: { icon: React.ReactNode; name: string; color: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <span className="inline-flex h-5 flex-shrink-0 items-center text-sm" style={{ color }} aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-black tracking-wider" style={{ color, ...FONT }}>{name}</div>
        {children ? <div className="mt-1">{children}</div> : null}
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode[] }) {
  const rows = children.filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <section className="pt-2">
      <div className="flex items-baseline justify-between gap-2 border-b pb-1.5" style={{ borderColor: '#1c1c2c' }}>
        <h4 className="text-[12px] font-black tracking-[0.16em] text-[var(--ui-text-soft)]" style={FONT}>{title}</h4>
        <span className="text-right text-[12px] text-[var(--ui-text-faint)]" style={FONT}>{hint}</span>
      </div>
      <div className="divide-y" style={{ borderColor: '#141422' }}>{rows}</div>
    </section>
  );
}

const perAttr = (model: PlayerSheetModel, key: keyof StatBreakdown) =>
  SHEET_ATTRS.map(a => ({ a, v: model.eff.breakdown[a][key] as number })).filter(x => x.v !== 0);
const attrChips = (list: { a: (typeof SHEET_ATTRS)[number]; v: number }[], color: string): Chip[] =>
  list.map(({ a, v }) => ({ text: `${v > 0 ? '+' : ''}${v} ${ATTR_SHORT[a]}`, color: v < 0 ? RED : color }));

// ── Card characteristics ─────────────────────────────────────────────────────

type Variant = ReturnType<typeof getCardVariants>[number];

function variantState(variant: Variant, model: PlayerSheetModel): { active: boolean; inactiveReason?: string } {
  const sources = model.charBoost?.sources ?? [];
  switch (variant.key) {
    case 'decimoHomem': return model.isStarter ? { active: false, inactiveReason: 'precisa estar no banco' } : { active: true };
    case 'noe': return sources.some(s => s.type === 'noe') ? { active: true } : { active: false, inactiveReason: model.isStarter ? 'nenhum titular sem característica' : 'só ativa se for titular' };
    case 'poliglota': return sources.some(s => s.type === 'poliglota') ? { active: true } : { active: false, inactiveReason: model.isStarter ? 'nenhum titular ou reserva de outra nacionalidade' : 'só ativa se for titular' };
    case 'desenfreado': return sources.some(s => s.type === 'desenfreado') ? { active: true } : { active: false, inactiveReason: model.isStarter ? 'química geral até 100' : 'só ativa se for titular' };
    case 'martir': return !model.isStarter
      ? { active: false, inactiveReason: 'só funciona se for titular' }
      : sources.some(s => s.type === 'martir' && s.fromId === model.player.id)
        ? { active: true }
        : { active: false, inactiveReason: 'distribua pontos aos dois titulares escolhidos' };
    case 'fominha': return !model.isStarter ? { active: false, inactiveReason: 'só ativa se for titular' } : (model.player.fominhaGoals ?? 0) > 0 ? { active: true } : { active: false, inactiveReason: 'ainda sem gols' };
    case 'forasteiro': return sources.some(s => s.type === 'forasteiro') ? { active: true } : { active: false, inactiveReason: model.isStarter ? 'nenhum titular tem clube e nacionalidade diferentes' : 'só ativa se for titular' };
    case 'todosPorUm': return sources.some(s => s.type === 'todosPorUm') ? { active: true } : { active: false, inactiveReason: 'os 11 titulares precisam ter a característica' };
    case 'agregador': return sources.some(s => s.type === 'agregador' && s.fromId === model.player.id) ? { active: true } : { active: false, inactiveReason: 'só ativa se for titular' };
    case 'padrinho':
    case 'mentor':
    case 'improvisador':
    case 'fazTudo':
    case 'lapidador': return model.isStarter ? { active: true } : { active: false, inactiveReason: 'só ativa se for titular' };
    default: {
      // Characteristics that grow over time: nothing accumulated yet means no effect yet.
      const growing: Record<string, number> = {
        estribado: estribadoStatBoost(model.credits),
        prodigio: prodigioStatBoost(model.player.prodigioStarts ?? 0),
        resiliente: (model.player.resilienteDefeats ?? 0) * RESILIENTE_DEFEAT_BOOST,
        goleador: goleadorStatBoost(model.player.goleadorGoals ?? 0),
        garcom: garcomStatBoost(model.player.garcomAssists ?? 0),
        arrogante: arroganteStatBoost(model.player.arroganteGoals ?? 0),
        mercenario: mercenarioStatBoost(model.player.mercenarioMissions ?? 0),
        apostador: apostadorStatBoost(model.player.apostadorWins ?? 0),
        colecionador: sources.find(s => s.type === 'colecionador')?.flatAll ?? 0,
      };
      return variant.key in growing && growing[variant.key] <= 0 ? { active: false, inactiveReason: 'ainda sem bônus acumulado' } : { active: true };
    }
  }
}

function variantDetails(variant: Variant, model: PlayerSheetModel, charBoost?: CharBoost): { chips: Chip[]; description: string } {
  const p: Player = model.player;
  const own = variant.color === '#FFFFFF' ? '#E5E7EB' : variant.color;
  switch (variant.key) {
    case 'inForm':
      return { chips: [{ text: `+${INFORM_STAT_BOOST} EM CADA ATRIBUTO`, color: GREEN }], description: `Já incluído nos valores impressos da carta.` };
    case 'lobo':
      return { chips: [{ text: `+${LOBO_STAT_BOOST} EM CADA ATRIBUTO`, color: GREEN }, { text: `−${LOBO_CHEM_PENALTY} QUÍMICA GERAL DO TIME`, color: RED }], description: `O bônus próprio já está nos valores da carta. Em troca, o time perde ${LOBO_CHEM_PENALTY} de química geral.` };
    case 'coringa': {
      const boost = charBoost?.sources.find(s => s.type === 'coringa' && s.fromId === p.id)?.flatAll;
      return {
        chips: [
          { text: 'SEM PENALIDADE DE POSIÇÃO', color: GREEN },
          { text: model.isStarter ? `+${boost ?? 0} EM TUDO` : `+${CORINGA_SECONDARY_STAT_BOOST} / +${CORINGA_OOP_STAT_BOOST} EM TUDO`, color: GREEN },
        ],
        description: `Se for titular, recebe +${CORINGA_SECONDARY_STAT_BOOST} em todos os atributos por cada titular em posição secundária e +${CORINGA_OOP_STAT_BOOST} por cada titular fora de posição. A contagem inclui o próprio Coringa se ele estiver numa dessas posições. Continua sem penalidade por jogar fora de posição. No gol, um jogador de linha ainda defende com ${Math.round(OUTFIELD_GK_MULTIPLIER * 100)}% da Defesa.`,
      };
    }
    case 'nomade':
      return { chips: [{ text: 'VALE COMO QUALQUER NAÇÃO', color: GREEN }], description: 'Forma vínculo de nação com qualquer titular com quem ainda não tenha vínculo.' };
    case 'pilar':
      return { chips: [{ text: `+${PILAR_CHEM_BONUS} QUÍMICA GERAL DO TIME`, color: GREEN }], description: `Enquanto estiver no XI, a química geral do time sobe ${PILAR_CHEM_BONUS}.` };
    case 'martir': {
      const used = Object.values(p.martirDistribution ?? {}).reduce((sum, value) => sum + Math.max(0, Math.floor(value || 0)), 0);
      const limit = martirDistributionLimit(p.martirWins);
      const selfLoss = charBoost?.sources
        .filter(source => source.type === 'martir' && source.fromId === p.id && source.self)
        .reduce((sum, source) => sum + Math.abs(Math.min(0, source.flatAll ?? 0)), 0) ?? 0;
      const wins = Math.max(0, Math.floor(p.martirWins ?? 0));
      return {
        chips: [
          { text: selfLoss ? `−${selfLoss} EM TUDO` : 'SEM PONTOS DISTRIBUÍDOS', color: selfLoss ? RED : '#9CA3AF' },
          { text: `${used}/${limit} PONTOS DISTRIBUÍDOS`, color: GREEN },
        ],
        description: `Cada ponto distribuído tira 1 em todos os atributos do Mártir e dá +1 em tudo a um dos dois titulares escolhidos. Começa com ${MARTIR_INITIAL_DISTRIBUTION} pontos; cada vitória com ele titular acrescenta 2. ${wins} vitória${wins === 1 ? '' : 's'} registrada${wins === 1 ? '' : 's'}.`,
      };
    }
    case 'idolo':
      return { chips: [{ text: `+${IDOLO_STAT_BOOST} EM TUDO AOS COLEGAS DO MESMO CLUBE`, color: GREEN }], description: `Os outros titulares do mesmo clube recebem +${IDOLO_STAT_BOOST} em cada atributo. O próprio Ídolo não recebe o bônus.` };
    case 'decimoHomem':
      return {
        chips: [
          { text: `+${DECIMO_HOMEM_STAT_BOOST} EM TUDO AO TIME`, color: GREEN },
          { text: `+${DECIMO_HOMEM_CHEM_BONUS} QUÍMICA GERAL`, color: GREEN },
        ],
        description: `Só funciona no banco: todo o XI recebe +${DECIMO_HOMEM_STAT_BOOST} em todos os atributos e o time ganha +${DECIMO_HOMEM_CHEM_BONUS} de química geral.`,
      };
    case 'pipoqueiro': {
      const ko = model.isKnockout;
      return {
        chips: [
          { text: `+${PIPOQUEIRO_LEAGUE_BOOST} EM TUDO NA LIGA`, color: GREEN, dim: ko },
          { text: `−${PIPOQUEIRO_KO_PENALTY} EM TUDO NO MATA-MATA`, color: RED, dim: !ko },
        ],
        description: ko ? `Está no mata-mata: vale a penalidade de −${PIPOQUEIRO_KO_PENALTY}.` : `Está na fase de liga: vale o bônus de +${PIPOQUEIRO_LEAGUE_BOOST}. No mata-mata vira −${PIPOQUEIRO_KO_PENALTY}.`,
      };
    }
    case 'noe':
      { const boost = charBoost?.sources.find(s => s.type === 'noe' && s.fromId === p.id)?.flatAll ?? 0; const plain = boost / NOE_STAT_BOOST;
      return { chips: [{ text: `+${boost} EM TUDO`, color: GREEN }, { text: `+${plain * NOE_CHEM_BONUS} QUÍMICA GERAL DO TIME`, color: GREEN }], description: `Se for titular, o Noé recebe +${NOE_STAT_BOOST} em todos os atributos por cada jogador titular sem característica especial. O time recebe +${NOE_CHEM_BONUS} de química geral por cada um.` }; }
    case 'forasteiro': {
      const source = charBoost?.sources.find(s => s.type === 'forasteiro' && s.fromId === p.id);
      const boost = source?.flatAll ?? 0;
      const penalty = source?.chemistryPenalty ?? 0;
      return {
        chips: source ? [
          { text: `+${boost} EM TUDO`, color: GREEN },
          { text: `−${penalty} QUÍMICA GERAL`, color: RED },
        ] : [],
        description: `Se for titular, recebe +${FORASTEIRO_STAT_BOOST} em todos os atributos e reduz ${FORASTEIRO_CHEM_PENALTY_PER_PLAYER} da química geral por cada outro titular que seja de um clube e de uma nacionalidade diferentes dos dele.`,
      };
    }
    case 'colecionador': {
      const boost = charBoost?.sources.find(s => s.type === 'colecionador')?.flatAll;
      return { chips: boost === undefined ? [] : [{ text: `+${boost} EM TUDO`, color: GREEN }], description: 'Ganha +1 em cada atributo por jogador na reserva.' };
    }
    case 'estribado':
      return { chips: [{ text: `+${estribadoStatBoost(model.credits)} EM CADA ATRIBUTO`, color: GREEN }], description: `+1 em cada atributo a cada ${ESTRIBADO_CREDITS_PER_BOOST} créditos disponíveis. Saldo atual: ${model.credits} créditos.` };
    case 'todosPorUm':
      return { chips: [{ text: `+${TODOS_POR_UM_STAT_BOOST} EM TODOS OS ATRIBUTOS`, color: GREEN }], description: 'Só funciona quando os 11 titulares têm a característica.' };
    case 'capitaoNato':
      return { chips: [{ text: 'BÔNUS DE CAPITÃO TRIPLICADO', color: GREEN }], description: 'Vale quando ele é o capitão: o bônus que o capitão dá ao time inteiro é triplicado.' };
    case 'magnata':
      return { chips: [{ text: `CRÉDITOS DA PARTIDA ×${String(MAGNATA_POINT_MULT).replace('.', ',')}`, color: GREEN }, { text: `−${MAGNATA_STAT_PENALTY} EM TUDO`, color: RED }], description: `Se for titular, aumenta os créditos ganhos na partida. A perda própria já está nos valores da carta.` };
    case 'fragil':
      return { chips: [{ text: `+${FRAGIL_STAT_BOOST} EM TUDO`, color: GREEN }, { text: 'RISCO DE LESÃO MUITO MAIOR', color: RED }], description: 'O bônus já está nos valores da carta.' };
    case 'prodigio': {
      const starts = p.prodigioStarts ?? 0;
      return { chips: [{ text: `+${prodigioStatBoost(starts)} EM CADA ATRIBUTO`, color: GREEN }], description: `+1 a cada ${PRODIGIO_STARTS_PER_BOOST} titularidade${PRODIGIO_STARTS_PER_BOOST === 1 ? '' : 's'}. Acumulou ${starts}.` };
    }
    case 'resiliente': {
      const defeats = p.resilienteDefeats ?? 0;
      return { chips: [{ text: `+${defeats * RESILIENTE_DEFEAT_BOOST} EM CADA ATRIBUTO`, color: GREEN }], description: `+${RESILIENTE_DEFEAT_BOOST} a cada derrota do time com ele titular. Acumulou ${defeats}.` };
    }
    case 'goleador': {
      const goals = p.goleadorGoals ?? 0;
      return { chips: [{ text: `+${goleadorStatBoost(goals)} EM CADA ATRIBUTO`, color: GREEN }], description: `+1 a cada ${GOLEADOR_GOALS_PER_BOOST} gols. Já marcou ${goals}.` };
    }
    case 'garcom': {
      const assists = p.garcomAssists ?? 0;
      return { chips: [{ text: `+${garcomStatBoost(assists)} EM CADA ATRIBUTO`, color: GREEN }], description: `+1 a cada ${GARCOM_ASSISTS_PER_BOOST} assistências. Já deu ${assists}.` };
    }
    case 'arrogante': {
      const goals = p.arroganteGoals ?? 0;
      return {
        chips: [{ text: `+${arroganteStatBoost(goals)} EM TUDO`, color: GREEN }, ...(arroganteTeamPenalty(goals) > 0 ? [{ text: `−${arroganteTeamPenalty(goals)} AOS OUTROS TITULARES`, color: RED }] : [])],
        description: `Cada gol dá +${ARROGANTE_STAT_BOOST_PER_GOAL} em tudo. A cada ${ARROGANTE_GOALS_PER_PENALTY} gols, os outros titulares perdem 1. Já marcou ${goals}.`,
      };
    }
    case 'mercenario': {
      const missions = p.mercenarioMissions ?? 0;
      return { chips: [{ text: `+${mercenarioStatBoost(missions)} EM CADA ATRIBUTO`, color: GREEN }], description: `+${MERCENARIO_STAT_BOOST_PER_MISSION} por missão concluída. Já concluiu ${missions}.` };
    }
    case 'padrinho': {
      const goals = p.padrinhoGoals ?? 0;
      const chips: Chip[] = [{ text: `+${PADRINHO_AFILHADO_BOOST} EM TUDO NO AFILHADO${model.godchild ? `: ${model.godchild.name.toUpperCase()}` : ''}`, color: own }];
      if (padrinhoStatBoost(goals) > 0) chips.push({ text: `+${padrinhoStatBoost(goals)} EM CADA ATRIBUTO NELE`, color: GREEN });
      return { chips, description: `O afilhado recebe o bônus se os dois forem titulares. Se você não escolher alguém, será o titular de maior geral. Cada gol dele nessas partidas dá +1 permanente ao Padrinho (${goals} até agora).` };
    }
    case 'lapidador':
      return { chips: [{ text: `+${LAPIDADOR_RESERVE_BOOST} PERMANENTE NA RESERVA POR VITÓRIA`, color: own }], description: 'A cada vitória em uma partida em que for titular, todos os jogadores da reserva ganham +1 em todos os atributos, para sempre. Mais de um Lapidador soma.' };
    case 'apostador': {
      const wins = p.apostadorWins ?? 0;
      return { chips: [{ text: `+${apostadorStatBoost(wins)} EM CADA ATRIBUTO`, color: GREEN }], description: `+${APOSTADOR_STAT_BOOST_PER_WIN} permanente a cada aposta vencida com ele no elenco. Já venceu ${wins}.` };
    }
    case 'agregador': {
      const boost = charBoost?.sources.find(s => s.type === 'agregador' && s.fromId === p.id)?.flatAll;
      return { chips: boost === undefined ? [] : [{ text: `+${boost} EM TUDO AO TIME`, color: GREEN }], description: `Se for titular, cada tipo diferente de característica no time dá +${AGREGADOR_STAT_BOOST_PER_TRAIT} em cada atributo a todos os titulares. Mais de um Agregador soma.` };
    }
    case 'pechincheiro':
      return { chips: [{ text: 'LOJA 15% MAIS BARATA', color: GREEN }], description: 'Enquanto estiver no elenco (titular ou reserva): Turbinar, remover característica, pacotes, Caça-Talentos e troca de técnico custam 15% a menos.' };
    case 'mentor':
      return { chips: [{ text: '+1 EVOLUÇÃO AO ELENCO POR VITÓRIA', color: GREEN }], description: 'A cada vitória em uma partida em que for titular, aumenta em 1 o progresso de evolução de todo o elenco, titulares e reservas. Não acumula com outro Mentor.' };
    case 'improvisador':
      return { chips: model.isStarter ? [{ text: `+${model.chemBonuses.improvisador} QUÍMICA GERAL`, color: model.chemBonuses.improvisador > 0 ? GREEN : '#94A3B8' }] : [{ text: `+${IMPROVISADOR_SECONDARY_CHEM} / +${IMPROVISADOR_OOP_CHEM} QUÍMICA GERAL`, color: GREEN }], description: `Se for titular, cada jogador em posição secundária acrescenta +${IMPROVISADOR_SECONDARY_CHEM} à química geral. Cada jogador fora de posição acrescenta +${IMPROVISADOR_OOP_CHEM}. O bônus não acumula.` };
    case 'desenfreado': {
      const boost = charBoost?.sources.find(s => s.type === 'desenfreado')?.flatAll;
      return { chips: boost === undefined ? [] : [{ text: `+${boost} EM TUDO AO TIME`, color: GREEN }], description: `Todo o XI ganha +1 em cada atributo a cada ${DESENFREADO_CHEM_PER_BOOST} pontos de química geral acima de 100.` };
    }
    case 'fazTudo': {
      const learned = p.learnedPositions ?? [];
      return { chips: learned.map(pos => ({ text: `APRENDEU ${POS_PT[pos] ?? pos}`, color: GREEN })), description: `Após ${FAZ_TUDO_STARTS_TO_LEARN} partidas como titular fora de posição numa mesma posição, ela vira posição secundária até o fim da competição.` };
    }
    case 'fominha': {
      const goals = p.fominhaGoals ?? 0;
      return { chips: [{ text: `+${goals * FOMINHA_STAT_BOOST_PER_GOAL} EM TUDO`, color: GREEN }, ...(goals > 0 ? [{ text: `−${goals * FOMINHA_CHEM_PENALTY_PER_GOAL} QUÍMICA GERAL`, color: RED }] : [])], description: `Se for titular, cada gol dele dá +${FOMINHA_STAT_BOOST_PER_GOAL} em todos os atributos e reduz em ${FOMINHA_CHEM_PENALTY_PER_GOAL} a química geral. ${goals} gol${goals === 1 ? '' : 's'} até agora.` };
    }
    case 'poliglota': {
      const boost = charBoost?.sources.find(s => s.type === 'poliglota' && s.fromId === p.id)?.flatAll;
      return { chips: boost === undefined ? [] : [{ text: `+${boost} EM TUDO`, color: GREEN }], description: `Se for titular, recebe +${POLIGLOTA_STAT_BOOST_PER_NATION} em todos os atributos por cada nacionalidade diferente da dele entre titulares e reservas.` };
    }
    case 'midiatico':
      return { chips: [{ text: `+${MIDIATICO_CREDITS_PER_GOAL} CRÉDITOS POR GOL`, color: GREEN }], description: 'Cada gol dele rende créditos, somados aos créditos da partida.' };
    default:
      return { chips: [{ text: variant.label.toUpperCase(), color: own }], description: '' };
  }
}

// Team-effect characteristics received FROM teammates.
const TEAMCHAR: Record<string, { icon: string; label: string; color: string }> = {
  martir: { icon: '🩸', label: 'MÁRTIR', color: '#F87171' },
  idolo: { icon: '❤️', label: 'ÍDOLO', color: '#F59E0B' },
  coringa: { icon: '🃏', label: 'CORINGA', color: '#EF4444' },
  decimoHomem: { icon: '🪑', label: '12º HOMEM', color: '#14B8A6' },
  noe: { icon: '🛟', label: 'NOÉ', color: '#22D3EE' },
  forasteiro: { icon: '🧳', label: 'FORASTEIRO', color: '#A3E635' },
  colecionador: { icon: '🧩', label: 'COLECIONADOR', color: '#C084FC' },
  todosPorUm: { icon: '🤝', label: 'TODOS POR UM', color: '#4ADE80' },
  arrogante: { icon: '👑', label: 'ARROGANTE', color: '#E879F9' },
  padrinho: { icon: '🤵', label: 'PADRINHO', color: '#C4B5FD' },
  agregador: { icon: '🔗', label: 'AGREGADOR', color: '#A5ACC2' },
  fominha: { icon: '🍽️', label: 'FOMINHA', color: '#B32D45' },
  poliglota: { icon: '💬', label: 'POLIGLOTA', color: '#8FD6B4' },
  desenfreado: { icon: '🚀', label: 'DESENFREADO', color: '#D2A86E' },
};

export default function BuffBreakdown({ model, collapsible = false }: { model: PlayerSheetModel; collapsible?: boolean }) {
  const [open, setOpen] = useState(() => !collapsible || (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches));
  const { eff, player, chem } = model;
  const variants = getCardVariants(player);
  const albumLevel = player.competitionAlbumLevel ?? 0;
  const pageBonus = player.competitionAlbumPageBonus ?? 0;
  const medical = Math.max(0, Math.floor(player.medicalReturnBoost ?? 0));
  const lapidado = Math.max(0, Math.floor(player.lapidadoBoost ?? 0));
  const train = perAttr(model, 'train');
  const evolution = [...perAttr(model, 'evolve'), ...perAttr(model, 'specialization')];
  const chemPerAttr = perAttr(model, 'chem');
  const coach = perAttr(model, 'coach');
  const tactic = perAttr(model, 'tactic');
  const captain = perAttr(model, 'captain');
  const position = perAttr(model, 'position');
  const goalkeeper = eff.breakdown.defending.goalkeeper;
  const teammateSources = (model.charBoost?.sources ?? []).filter(s => !s.self && s.fromId !== player.id);
  const global = eff.globalChemBonus;
  const hasGlobal = global.passing > 0 || global.pace > 0 || global.special > 0;
  const tacticName = getTacticById(model.playStyle).name;

  const cardRows = [
    albumLevel > 0 && (
      <Row key="album" icon={<Star size={15} strokeWidth={2.4} fill="currentColor" />} name="ÁLBUM" color="#D8B84E">
        <Chips items={[{ text: `+${albumLevel} EM TODOS OS ATRIBUTOS`, color: '#D8B84E' }]} />
        <Note>Nível congelado no início da competição; acompanha a carta se ela for negociada.</Note>
      </Row>
    ),
    pageBonus > 0 && (
      <Row key="album-page" icon={<BookOpenCheck size={15} strokeWidth={2.4} />} name="PÁGINA COMPLETA" color="#67E8F9">
        <Chips items={[{ text: `+${pageBonus} EM TODOS OS ATRIBUTOS`, color: '#67E8F9' }]} />
        <Note>Página completa conferida no início da competição; o bônus fica fixo até o fim.</Note>
      </Row>
    ),
    ...variants.map(variant => {
      const state = variantState(variant, model);
      const details = variantDetails(variant, model, model.charBoost);
      const color = state.active ? (variant.color === '#FFFFFF' ? '#E5E7EB' : variant.color) : MUTED;
      return (
        <Row key={`v-${variant.key}`} icon={<TraitIcon trait={variant.key} fallback={variant.icon} size={28} />} color={color}
          name={`${variant.label.toUpperCase()}${state.active ? '' : state.inactiveReason === 'ainda sem bônus acumulado' ? ' · SEM BÔNUS AINDA' : ' · SEM EFEITO AGORA'}`}>
          <Chips items={details.chips.map(c => (state.active ? c : { ...c, dim: true }))} />
          <Note>{state.active || state.inactiveReason === 'ainda sem bônus acumulado' ? details.description : `Inativo: ${state.inactiveReason}. ${details.description}`}</Note>
        </Row>
      );
    }),
    model.traits.length > 0 && (
      <Row key="traits" icon={<Palette size={15} strokeWidth={2.4} />} name="ESTILOS DE JOGO" color="#A78BFA">
        <div className="space-y-1.5">
          {model.traits.map(t => (
            <div key={t.id} className="flex items-start gap-1.5">
              <PlaystyleIcon trait={t.id} fallback={t.icon} size={14} color="#A78BFA" className="mt-px flex-shrink-0" />
              <div className="min-w-0 text-[12px]" style={FONT}>
                <span className="font-black text-white">{t.id}</span>
                {t.effect && <span className="font-bold text-[#A78BFA]"> — {t.effect}</span>}
                {t.keeperOnly && <span className="text-[var(--ui-text-muted)]"> (vale na defesa de chutes, não muda o atributo DEF)</span>}
                {t.flavor && <div className="text-[var(--ui-text-muted)]">{t.flavor}</div>}
              </div>
            </div>
          ))}
        </div>
      </Row>
    ),
    evolution.length > 0 && (
      <Row key="evolution" icon={<ChevronsUp size={15} strokeWidth={2.4} />} name="EVOLUÇÃO" color={GREEN}>
        <Chips items={attrChips(evolution, GREEN)} />
        <Note>Pontos de evolução e especialização aplicados nesta carta.</Note>
      </Row>
    ),
    train.length > 0 && (
      <Row key="train" icon={<Dumbbell size={15} strokeWidth={2.4} />} name="TREINO (LOJA)" color="#34D399">
        <Chips items={attrChips(train, '#34D399')} />
        <Note>Melhoria permanente comprada na loja.</Note>
      </Row>
    ),
    medical > 0 && (
      <Row key="medical" icon={<img src="/projects/medical.webp" alt="" className="h-4 w-4 object-contain" />} name="DEPARTAMENTO MÉDICO" color="#22D3EE">
        <Chips items={[{ text: `+${medical} EM CADA ATRIBUTO`, color: '#22D3EE' }]} />
        <Note>Bônus permanente acumulado ao voltar de lesões.</Note>
      </Row>
    ),
    lapidado > 0 && (
      <Row key="lapidado" icon={<TraitIcon trait="lapidado" size={16} />} name="LAPIDADO" color="#93C5FD">
        <Chips items={[{ text: `+${lapidado} EM CADA ATRIBUTO`, color: '#93C5FD' }]} />
        <Note>Bônus permanente recebido de Lapidadores em vitórias enquanto estava na reserva.</Note>
      </Row>
    ),
  ];

  const teamRows = [
    chem && (
      <Row key="chem" icon={<Link size={15} strokeWidth={2.4} />} color={chem.oop ? RED : GREEN}
        name={`QUÍMICA INDIVIDUAL ${chem.score}/3 · ×${chem.multiplier.toFixed(2)}${chem.oop ? ' · FORA DE POSIÇÃO' : ''}`}>
        {chemPerAttr.length > 0 && <Chips items={attrChips(chemPerAttr, GREEN)} />}
        {chem.oop ? (
          <Note>Joga como <b>{chem.formationPos}</b>, mas é <b>{chem.nativePos}</b>: a química individual zera. Troque por alguém da posição.</Note>
        ) : chem.groups.length > 0 ? (
          <>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chem.groups.map(g => (
                <span key={g.key} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-bold"
                  style={{ color: g.color, background: `${g.color}1A`, border: `1px solid ${g.color}44`, ...FONT }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.color }} />
                  {g.label} (+{g.points}{g.key === 'coachBond' ? '' : ' cada'}): {g.names.join(', ')}
                </span>
              ))}
            </div>
            <Note>
              Soma <b className="text-[var(--ui-text-soft)]">{chem.rawPoints} pt{chem.rawPoints === 1 ? '' : 's'}</b>
              {chem.nextAt == null ? ' — química individual máxima.' : chem.rawPoints < chem.nextAt
                ? <> — faltam <b className="text-[var(--ui-brand-strong)]">{chem.nextAt - chem.rawPoints}</b> para o próximo nível.</>
                : ' — suficiente para o nível atual.'}
            </Note>
          </>
        ) : (
          <Note>Na posição certa, mas sem vínculos (clube, nação, técnico ou dupla) com os titulares.</Note>
        )}
      </Row>
    ),
    hasGlobal && (
      <Row key="global" icon={<Star size={15} strokeWidth={2.4} />} name="QUÍMICA DO TIME" color="#C9A84C">
        <Chips items={[
          ...(global.passing > 0 ? [{ text: `+${global.passing} PAS`, color: '#C9A84C' }] : []),
          ...(global.pace > 0 ? [{ text: `+${global.pace} RIT`, color: '#C9A84C' }] : []),
          ...(global.special > 0 ? [{ text: `+${global.special} EM TODOS`, color: '#C9A84C' }] : []),
        ]} />
        <Note>Bônus da química geral do time, igual para todos os titulares.</Note>
      </Row>
    ),
    captain.length > 0 && model.captain && (
      <Row key="captain" icon={<img src="/roles/captain.webp" alt="" className="h-4 w-4 object-contain" />} name={`CAPITÃO: ${model.captain.name.toUpperCase()}${model.captain.auto ? ' (AUTOMÁTICO)' : ''}`} color="#F5B731">
        <Chips items={attrChips(captain, '#F5B731')} />
        <Note>
          {model.captain.isThisPlayer ? 'Ele é o capitão: ' : ''}a melhor estatística do capitão ({model.captain.stat}) vale +{model.captain.amount} para todo o time.
          {model.captain.auto ? ' Nenhum capitão foi escolhido, então o jogo usa o titular de maior geral. Escolha em Funções de jogo.' : ''}
        </Note>
      </Row>
    ),
    (coach.length > 0 || eff.activeCoachEffects.length > 0) && (
      <Row key="coach" icon={<GraduationCap size={15} strokeWidth={2.4} />} name={`TREINADOR${model.coachName ? `: ${model.coachName.toUpperCase()}` : ''}`} color="#E8C84A">
        <Chips items={attrChips(coach, '#E8C84A')} />
        {eff.activeCoachEffects.length > 0 && <Note>Ativo agora: {eff.activeCoachEffects.join(' · ')}</Note>}
      </Row>
    ),
    tactic.length > 0 && (
      <Row key="tactic" icon={<ClipboardList size={15} strokeWidth={2.4} />} name={`TÁTICA: ${tacticName.toUpperCase()}`} color="#4FC3F7">
        <Chips items={attrChips(tactic, '#4FC3F7')} />
      </Row>
    ),
    position.length > 0 && (
      <Row key="position" icon={<Repeat size={15} strokeWidth={2.4} />} name={eff.isOOP ? 'FORA DE POSIÇÃO · −15%' : 'POSIÇÃO SECUNDÁRIA · −5%'} color={eff.isOOP ? RED : '#EAB308'}>
        <Chips items={attrChips(position, eff.isOOP ? RED : '#EAB308')} />
        <Note>Penalidade nos atributos por jogar fora da posição de origem.</Note>
      </Row>
    ),
    model.outfieldInGoal && (
      <Row key="gk" icon={<Hand size={15} strokeWidth={2.4} />} name="JOGADOR DE LINHA NO GOL" color="#F59E0B">
        <Chips items={[{ text: `${goalkeeper} DEF`, color: '#F59E0B' }]} />
        <Note>Jogadores de linha aproveitam {Math.round(OUTFIELD_GK_MULTIPLIER * 100)}% da Defesa no gol.</Note>
      </Row>
    ),
    ...teammateSources.map((src, i) => {
      const vis = TEAMCHAR[src.type];
      return (
        <Row key={`mate-${i}`} icon={<TraitIcon trait={src.type} fallback={vis.icon} size={28} />} name={`${vis.label} — DE ${src.fromName.toUpperCase()}`} color={vis.color}>
          <Chips items={[
            ...(src.flatAll !== 0 ? [{ text: `${src.flatAll > 0 ? '+' : ''}${src.flatAll} EM CADA ATRIBUTO`, color: src.flatAll < 0 ? RED : vis.color }] : []),
            ...Object.entries(src.perStat as Record<string, number>).map(([k, v]) => ({ text: `+${v} ${ATTR_SHORT[k as keyof typeof ATTR_SHORT] ?? k}`, color: vis.color })),
          ]} />
        </Row>
      );
    }),
  ];

  const matchRows = [
    ...model.situations.map(s => (
      <Row key={`sit-${s.label}`} icon={<Timer size={15} strokeWidth={2.4} />} name={s.label.toUpperCase()} color="#FBBF24">
        <Chips items={s.effects.map(e => ({ text: e, color: '#FBBF24' }))} />
        {s.replaces.length > 0 && <Note>Substitui {s.replaces.join(', ')} (não soma).</Note>}
        <Note>
          Nessa situação o geral efetivo vai de <b className="text-[var(--ui-text-soft)]">{model.eff.overall}</b> a <b className="text-[var(--ui-text-soft)]">{s.overall}</b>
          {' '}({s.overallDelta >= 0 ? '+' : ''}{s.overallDelta}).
        </Note>
      </Row>
    )),
    model.homeBonus > 0 && (
      <Row key="home" icon={<House size={15} strokeWidth={2.4} />} name="JOGANDO EM CASA" color="#60A5FA">
        <Chips items={[{ text: `+${model.homeBonus} EM CADA ATRIBUTO`, color: '#60A5FA' }]} />
        <Note>Vale nos lances das partidas em casa (projeto Estádio). A final em jogo único é em campo neutro.</Note>
      </Row>
    ),
    model.keeper && (
      <Row key="keeper" icon={<Hand size={15} strokeWidth={2.4} />} name={`DEFESA DE CHUTES: ${model.keeper.rating}`} color="#22D3EE">
        <Note>
          É o valor usado contra finalizações e pênaltis: DEF {eff.defending}
          {model.keeper.traitBonus > 0 ? <> + <b className="text-[var(--ui-text-soft)]">{model.keeper.traitBonus}</b> dos estilos de goleiro</> : null}.
        </Note>
      </Row>
    ),
  ];

  const total = [...cardRows, ...teamRows, ...matchRows].filter(Boolean).length;

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: '#161626', background: '#09090f' }}>
      <button type="button" onClick={() => collapsible && setOpen(v => !v)} disabled={!collapsible}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-default">
        <span className="text-xs font-black tracking-widest text-[var(--ui-text-soft)]" style={FONT}><Dna {...INLINE_ICON} />DE ONDE VEM CADA BÔNUS</span>
        {collapsible && <span className="text-[12px] font-bold text-[var(--ui-text-muted)]" style={FONT}>{open ? 'Ocultar ▴' : `Ver ${total} fonte${total === 1 ? '' : 's'} ▾`}</span>}
      </button>
      {open && (total === 0 ? (
        <div className="mt-2 text-sm text-[var(--ui-text-muted)]" style={FONT}>Sem modificadores ativos — atributos no valor da carta.</div>
      ) : (
        <div className="mt-1 space-y-2">
          <Group title="DA CARTA" hint="vale em qualquer time">{cardRows}</Group>
          <Group title="DO TIME" hint="química, capitão, técnico, tática">{teamRows}</Group>
          <Group title="SÓ NA PARTIDA" hint="situações do jogo">{matchRows}</Group>
        </div>
      ))}
    </div>
  );
}
