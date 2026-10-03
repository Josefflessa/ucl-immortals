// Everything the player sheet shows, computed once from the same engine functions the match
// uses. Both the squad modal (Meu Time) and the read-only report modal render from this model,
// so the numbers, the per-attribute sources and the explanations never diverge.
import { COACHES, FORMATIONS, POS_PT, type Player } from '@shared/game/gameData';
import {
  calculateChemistry, captainBestStatFromStarters, captainBoostFromStarters, computeCharacteristicBoosts,
  getChemistryLinks, getPlayerEffectiveStats, goalkeeperShotStoppingRating, isOutfieldGoalkeeper, positionFit,
  type CharBoost, type EffectiveStats, type StatBreakdown,
} from '@shared/game/gameEngine';
import { TRAIT_MAP, getGoalkeeperTraitBonus, traitEffectLabel } from '@shared/game/traits';
import { stadiumHomeBonus } from '@shared/game/clubProjects';
import { getCardVariants } from '../PlayerCard';
import { CHEM_LINK_COLOR } from '../FormationField';

export const SHEET_ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure'] as const;
export type SheetAttr = typeof SHEET_ATTRS[number];
export const ATTR_SHORT: Record<SheetAttr, string> = {
  pace: 'RIT', shooting: 'FIN', passing: 'PAS', dribbling: 'DRI', defending: 'DEF', physical: 'FIS', vision: 'VIS', composure: 'CMP',
};
export const ATTR_LONG: Record<SheetAttr, string> = {
  pace: 'Ritmo', shooting: 'Finalização', passing: 'Passe', dribbling: 'Drible', defending: 'Defesa', physical: 'Físico', vision: 'Visão', composure: 'Compostura',
};

export interface StatSource { key: string; icon: string; label: string; value: number }
export interface SheetStat { attr: SheetAttr; base: number; value: number; delta: number; sources: StatSource[] }

export interface ChemLinkGroup { key: string; label: string; color: string; points: number; names: string[] }
export interface SheetChem {
  score: number;
  multiplier: number;
  oop: boolean;
  nativePos: string;
  formationPos: string;
  groups: ChemLinkGroup[];
  rawPoints: number;
  nextAt: number | null;
}

export interface SheetTrait { id: string; icon: string; effect: string; flavor: string | null; keeperOnly: boolean }
export interface SheetCaptain { name: string; auto: boolean; stat: string; amount: number; isThisPlayer: boolean }
export interface SheetSituation { label: string; effects: string[]; overall: number }

export interface PlayerSheetModel {
  player: Player;
  eff: EffectiveStats;
  isStarter: boolean;
  formationRole: string;
  fit: 'native' | 'secondary' | 'off';
  originalOverall: number;
  overallDelta: number;
  stats: SheetStat[];
  chem: SheetChem | null;
  traits: SheetTrait[];
  captain: SheetCaptain | null;
  charBoost?: CharBoost;
  coachName: string;
  situations: SheetSituation[];
  homeBonus: number;
  keeper: { rating: number; traitBonus: number } | null;
  outfieldInGoal: boolean;
  isKnockout: boolean;
  credits: number;
  playStyle: string;
}

export interface PlayerSheetInput {
  player: Player;
  /** The whole squad in lineup order (XI first, then the bench). */
  players: Player[];
  /** Index of the player in `players` (≥ 11 = reserve). */
  index: number;
  coachId: string;
  formationId: string;
  playStyle?: string;
  captainId?: string | null;
  isKnockout?: boolean;
  isFinal?: boolean;
  isLosing?: boolean;
  coachPrime?: boolean;
  analysisLevel?: number;
  stadiumProjectLevel?: number;
  credits?: number;
}

// Variants that change the card's own printed values (already inside player.*).
const BAKED_VARIANTS = new Set(['inForm', 'lobo', 'martir', 'fragil', 'magnata']);
const LINK_POINTS: Record<string, number> = { club: 2, nation: 1, coach: 2, partner: 1, nomade: 1 };
const LINK_LABEL: Record<string, string> = {
  club: 'Mesmo clube', nation: 'Mesma nação', coach: 'Mesmo técnico', partner: 'Dupla histórica', nomade: 'Nômade (vale como nação)',
};
const CHEM_THRESHOLDS = [2, 5, 8];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Flavour lines that only restate the trait name add nothing ("Reflexo Felino" → "Reflexos felinos."). */
function usefulFlavor(id: string, flavor: string | undefined): string | null {
  if (!flavor) return null;
  const stems = normalize(id).split(/\s+/).filter(Boolean).map(word => word.slice(0, 5));
  const text = normalize(flavor);
  return flavor.length < 40 && stems.every(stem => text.includes(stem)) ? null : flavor;
}

export function buildPlayerSheet(input: PlayerSheetInput): PlayerSheetModel {
  const { player, players, index } = input;
  const xi = players.slice(0, 11);
  const isStarter = index >= 0 && index < 11;
  const formation = FORMATIONS.find(f => f.id === input.formationId) ?? FORMATIONS[0];
  const roles = formation.positions.map(p => p.role);
  const formationRole = isStarter ? (roles[index] ?? player.position) : player.position;
  const fit = isStarter ? positionFit(player, formationRole) : 'native';
  const chemData = calculateChemistry(xi, input.coachId, roles, input.formationId);
  const charBoosts = computeCharacteristicBoosts(players);
  const captainBoost = captainBoostFromStarters(xi, input.captainId ?? undefined) ?? undefined;
  const playStyle = input.playStyle ?? 'balanced';
  const credits = Math.max(0, input.credits ?? 0);
  const baseContext = {
    captainBoost: isStarter ? captainBoost : undefined,
    charBoosts,
    isKnockout: input.isKnockout ?? false,
    isFinal: input.isFinal ?? false,
    isLosing: input.isLosing ?? false,
    coachPrime: input.coachPrime,
    analysisLevel: input.analysisLevel,
    role: formationRole,
    isSecondary: fit === 'secondary',
    credits,
  };
  const chemScore = isStarter ? (chemData.individual[player.id] ?? 0) : 0;
  const effFor = (overrides: Partial<typeof baseContext>) => getPlayerEffectiveStats(
    player, chemScore, fit === 'off', input.coachId, chemData.total, playStyle, { ...baseContext, ...overrides },
  );
  const eff = effFor({});

  // Baseline = the card as printed before its own variant and medical-return gains, so every
  // permanent gain shows up exactly once as a source.
  const medical = Math.max(0, Math.floor(player.medicalReturnBoost ?? 0));
  const variantDelta = player.baseOverall !== undefined ? player.overall - player.baseOverall : 0;
  const originalOverall = Math.max(1, (player.baseOverall ?? player.overall) - medical);
  const variants = getCardVariants(player);
  const bakedLabel = variants.filter(v => BAKED_VARIANTS.has(v.key)).map(v => v.label).join(' + ') || 'Característica da carta';
  const bakedIcon = variants.find(v => BAKED_VARIANTS.has(v.key))?.icon ?? '🃏';
  const variantInfo = (key: string, fallbackIcon: string, fallbackLabel: string) => {
    const v = variants.find(item => item.key === key);
    return { icon: v?.icon ?? fallbackIcon, label: v?.label ?? fallbackLabel };
  };
  const positionLabel = fit === 'off' ? 'Fora de posição (−15%)' : 'Posição secundária (−5%)';
  const sourceDefs: Array<{ key: keyof StatBreakdown; icon: string; label: string }> = [
    { key: 'chem', icon: '🔗', label: 'Química individual' },
    { key: 'position', icon: '🔁', label: positionLabel },
    { key: 'goalkeeper', icon: '🧤', label: 'Aptidão no gol (jogador de linha)' },
    { key: 'coach', icon: '🎓', label: 'Treinador' },
    { key: 'trait', icon: '🎨', label: 'Estilos de jogo' },
    { key: 'tactic', icon: '📋', label: 'Tática' },
    { key: 'globalChem', icon: '⭐', label: 'Química do time' },
    { key: 'captain', icon: '👑', label: 'Capitão' },
    { key: 'train', icon: '💪', label: 'Treino (loja)' },
    { key: 'evolve', icon: '🆙', label: 'Evolução' },
    { key: 'specialization', icon: '💠', label: 'Especialização' },
    { key: 'prodigio', ...variantInfo('prodigio', '📈', 'Prodígio') },
    { key: 'resiliente', ...variantInfo('resiliente', '🔥', 'Resiliente') },
    { key: 'goleador', ...variantInfo('goleador', '⚽', 'Goleador') },
    { key: 'garcom', ...variantInfo('garcom', '🎯', 'Garçom') },
    { key: 'arrogante', ...variantInfo('arrogante', '👑', 'Arrogante') },
    { key: 'estribado', ...variantInfo('estribado', '💰', 'Estribado') },
    { key: 'mercenario', ...variantInfo('mercenario', '🏆', 'Conquistador') },
    { key: 'pipoqueiro', ...variantInfo('pipoqueiro', '🍿', 'Pipoqueiro') },
    { key: 'char', icon: '🤝', label: 'Companheiros (características)' },
  ];

  const stats: SheetStat[] = SHEET_ATTRS.map(attr => {
    const b = eff.breakdown[attr];
    const value = eff[attr];
    const base = Math.max(1, player[attr] - variantDelta - medical);
    const sources: StatSource[] = [];
    if (variantDelta !== 0) sources.push({ key: 'variant', icon: bakedIcon, label: bakedLabel, value: variantDelta });
    if (medical > 0) sources.push({ key: 'medical', icon: '🏥', label: 'Departamento médico', value: medical });
    for (const def of sourceDefs) {
      const v = b[def.key] as number;
      if (v) sources.push({ key: def.key, icon: def.icon, label: def.label, value: v });
    }
    // The engine floors every attribute at 1; account for it so the list always adds up.
    const listed = sources.reduce((sum, s) => sum + s.value, 0);
    if (base + listed !== value) sources.push({ key: 'floor', icon: '⚖️', label: 'Ajuste mínimo do atributo', value: value - base - listed });
    return { attr, base, value, delta: value - base, sources };
  });

  // Individual chemistry: who links with this player and how much each kind is worth.
  let chem: SheetChem | null = null;
  if (isStarter) {
    const links = getChemistryLinks(xi, input.coachId)
      .filter(l => l.aIndex === index || l.bIndex === index)
      .map(l => {
        const other = xi[l.aIndex === index ? l.bIndex : l.aIndex];
        const nomade = l.type === 'nation' && !!other && other.nation !== player.nation;
        return { key: nomade ? 'nomade' : l.type, name: other?.shortName ?? '' };
      });
    const groups: ChemLinkGroup[] = (['club', 'nation', 'nomade', 'coach', 'partner'] as const)
      .map(key => ({
        key,
        label: LINK_LABEL[key],
        color: CHEM_LINK_COLOR[key === 'nomade' ? 'nation' : key],
        points: LINK_POINTS[key],
        names: links.filter(l => l.key === key).map(l => l.name).filter(Boolean),
      }))
      .filter(g => g.names.length > 0);
    const coach = COACHES.find(c => c.id === input.coachId);
    if ((player.historicalCoaches ?? []).includes(input.coachId)) {
      groups.push({ key: 'coachBond', label: 'Já trabalhou com o técnico', color: '#C084FC', points: 1, names: [coach?.name ?? 'técnico'] });
    }
    const rawPoints = fit === 'off' ? 0 : groups.reduce((sum, g) => sum + g.points * g.names.length, 0);
    chem = {
      score: eff.chemScore,
      multiplier: eff.chemMult,
      oop: fit === 'off',
      nativePos: POS_PT[player.position] ?? player.position,
      formationPos: POS_PT[formationRole] ?? formationRole,
      groups,
      rawPoints,
      nextAt: eff.chemScore >= 3 ? null : CHEM_THRESHOLDS[eff.chemScore],
    };
  }

  const traits: SheetTrait[] = (player.traits ?? []).filter(id => TRAIT_MAP[id]).map(id => ({
    id,
    icon: TRAIT_MAP[id]?.icon ?? '✨',
    effect: traitEffectLabel(id),
    flavor: usefulFlavor(id, TRAIT_MAP[id]?.flavor),
    keeperOnly: getGoalkeeperTraitBonus([id]) > 0,
  }));

  // Captain: the chosen one, or the automatic fallback (the starter with the highest overall).
  let captain: SheetCaptain | null = null;
  if (captainBoost) {
    const chosen = input.captainId ? xi.find(p => p.id === input.captainId) : undefined;
    const holder = chosen ?? [...xi].sort((a, b) => b.overall - a.overall)[0];
    const stat = captainBestStatFromStarters(xi, input.captainId ?? undefined) as SheetAttr | null;
    if (holder && stat) {
      captain = { name: holder.shortName, auto: !chosen, stat: ATTR_SHORT[stat] ?? stat, amount: captainBoost.amount, isThisPlayer: holder.id === player.id };
    }
  }

  // Bonuses that only switch on during a match situation, asked to the engine itself.
  const situationDefs: Array<{ label: string; ctx: Partial<typeof baseContext> }> = [
    { label: 'Quando o time está perdendo', ctx: { isLosing: true } },
    ...(input.isKnockout ? [] : [{ label: 'No mata-mata', ctx: { isKnockout: true } }]),
    ...(input.isFinal ? [] : [{ label: 'Na final', ctx: { isKnockout: true, isFinal: true } }]),
  ];
  const situations = situationDefs.map(({ label, ctx }) => {
    const alt = effFor(ctx);
    const effects = alt.activeCoachEffects.filter(e => !eff.activeCoachEffects.includes(e));
    return { label, effects, overall: alt.overall };
  }).filter(s => s.effects.length > 0);

  const role = formationRole;
  const keeperTraitBonus = role === 'GK' ? goalkeeperShotStoppingRating(player, eff.defending, player.traits) - eff.defending : 0;

  return {
    player,
    eff,
    isStarter,
    formationRole,
    fit,
    originalOverall,
    overallDelta: eff.overall - originalOverall,
    stats,
    chem,
    traits,
    captain,
    charBoost: charBoosts[player.id],
    coachName: COACHES.find(c => c.id === input.coachId)?.name ?? '',
    situations,
    homeBonus: isStarter ? stadiumHomeBonus(input.stadiumProjectLevel ?? 1) : 0,
    keeper: role === 'GK' && isStarter ? { rating: eff.defending + keeperTraitBonus, traitBonus: keeperTraitBonus } : null,
    outfieldInGoal: isStarter && isOutfieldGoalkeeper(player, formationRole),
    isKnockout: input.isKnockout ?? false,
    credits,
    playStyle,
  };
}
