import { useMemo, useState } from 'react';
import { FORMATIONS, POS_PT, type Player, effectiveSecondaries, getRarityColor } from '../../lib/gameData';
import {
  calculateChemistry,
  captainBoostFromStarters,
  computeCharacteristicBoosts,
  getChemistryLinks,
  getPlayerEffectiveStats,
  getEvolutionLevel,
  positionFit,
  type Team,
} from '../../lib/gameEngine';
import { TRAIT_MAP, traitEffectLabel } from '../../lib/traits';
import { CHEM_LINK_COLOR } from './FormationField';
import BuffBreakdown from './BuffBreakdown';
import PlayerCard, { cardTexture, UNIQUE_STYLE } from './PlayerCard';
import PlayerPortrait from './PlayerPortrait';
import { GameModal } from '../../design-system';

interface Props {
  player: Player;
  team: Team;
  positionIndex: number;
  activePlayStyle?: string;
  isKnockout?: boolean;
  isFinal?: boolean;
  isLosing?: boolean;
  coachPrime?: boolean;
  analysisLevel?: number;
  onClose: () => void;
}

/** Read-only player view used by post-match results. It intentionally has no swap,
 * evolution, specialization, physiotherapy or other mutating controls. */
export default function PlayerDetailsModal({
  player,
  team,
  positionIndex,
  activePlayStyle,
  isKnockout = false,
  isFinal = false,
  isLosing = false,
  coachPrime = false,
  analysisLevel = 1,
  onClose,
}: Props) {
  const [zoomCard, setZoomCard] = useState(false);
  const formation = FORMATIONS.find(item => item.id === team.formationId) ?? FORMATIONS[0];
  const starters = useMemo(() => team.players.slice(0, 11), [team.players]);
  const formationRoles = useMemo(() => formation.positions.map(position => position.role), [formation]);
  const chemistry = useMemo(
    () => calculateChemistry(starters, team.coachId, formationRoles, team.formationId),
    [starters, team.coachId, formationRoles, team.formationId],
  );
  const chemistryLinks = useMemo(() => getChemistryLinks(starters, team.coachId), [starters, team.coachId]);
  const captainBoost = useMemo(() => captainBoostFromStarters(starters, team.captain ?? undefined) ?? undefined, [starters, team.captain]);
  const characteristicBoosts = useMemo(() => computeCharacteristicBoosts(team.players), [team.players]);

  const formationRole = formationRoles[positionIndex] ?? player.position;
  const fit = positionFit(player, formationRole);
  const isOutOfPosition = fit === 'off';
  const isSecondary = fit === 'secondary';
  const chemistryScore = chemistry.individual[player.id] ?? 0;
  const playStyle = activePlayStyle ?? team.playStyle;
  const effectiveStats = getPlayerEffectiveStats(
    player,
    chemistryScore,
    isOutOfPosition,
    team.coachId,
    chemistry.total,
    playStyle,
    {
      captainBoost,
      charBoosts: characteristicBoosts,
      isKnockout,
      isFinal,
      isLosing,
      coachPrime,
      analysisLevel,
      role: formationRole,
      isSecondary,
      credits: team.credits,
    },
  );

  const medicalReturnBoost = Math.max(0, Math.floor(player.medicalReturnBoost ?? 0));
  const originalOverall = Math.max(1, (player.baseOverall ?? player.overall) - medicalReturnBoost);
  const cardVariantDelta = player.baseOverall !== undefined ? player.overall - player.baseOverall : 0;
  const effectiveOverallDelta = effectiveStats.overall - originalOverall;
  const originalStat = (value: number) => Math.max(1, value - cardVariantDelta - medicalReturnBoost);
  const chemDots = [0, 1, 2].map(index => index < effectiveStats.chemScore);
  const linkLabels: Record<string, string> = {
    club: 'Mesmo clube',
    nation: 'Mesma nação',
    coach: 'Mesmo técnico',
    partner: 'Dupla histórica',
  };
  const selectedLinks = chemistryLinks
    .filter(link => link.aIndex === positionIndex || link.bIndex === positionIndex)
    .map(link => ({ player: starters[link.aIndex === positionIndex ? link.bIndex : link.aIndex], type: link.type }));
  const linksByType = (['club', 'nation', 'coach', 'partner'] as const)
    .map(type => ({ type, names: selectedLinks.filter(link => link.type === type).map(link => link.player?.shortName).filter(Boolean) as string[] }))
    .filter(group => group.names.length > 0);
  const linkPoints: Record<string, number> = { club: 2, nation: 1, coach: 2, partner: 1 };
  const rawChemistryPoints = isOutOfPosition
    ? 0
    : selectedLinks.reduce((sum, link) => sum + (linkPoints[link.type] ?? 0), 0)
      + ((player.historicalCoaches ?? []).includes(team.coachId) ? 1 : 0);
  const chemThresholds = [2, 5, 8];
  const chemInfo = {
    oop: isOutOfPosition,
    nativePos: POS_PT[player.position] ?? player.position,
    formationPos: POS_PT[formationRole] ?? formationRole,
    links: linksByType.map(({ type, names }) => ({ type, label: linkLabels[type], color: CHEM_LINK_COLOR[type], names })),
    rawPts: rawChemistryPoints,
    nextAt: effectiveStats.chemScore >= 3 ? null : chemThresholds[effectiveStats.chemScore],
  };
  const traitInfos = (player.traits ?? []).filter(traitId => TRAIT_MAP[traitId]).map(traitId => {
    const definition = TRAIT_MAP[traitId];
    return { id: traitId, icon: definition?.icon ?? '✨', effect: traitEffectLabel(traitId), flavor: definition?.flavor ?? '' };
  });
  const statRows = [
    { label: 'RIT', base: originalStat(player.pace), value: effectiveStats.pace },
    { label: 'FIN', base: originalStat(player.shooting), value: effectiveStats.shooting },
    { label: 'PAS', base: originalStat(player.passing), value: effectiveStats.passing },
    { label: 'DRI', base: originalStat(player.dribbling), value: effectiveStats.dribbling },
    { label: 'DEF', base: originalStat(player.defending), value: effectiveStats.defending },
    { label: 'FIS', base: originalStat(player.physical), value: effectiveStats.physical },
    { label: 'VIS', base: originalStat(player.vision), value: effectiveStats.vision },
    { label: 'CMP', base: originalStat(player.composure), value: effectiveStats.composure },
  ];
  const texture = UNIQUE_STYLE[player.id]?.texture ?? cardTexture(player.rarity, getEvolutionLevel(player), player.specialization);

  return (
    <>
      <GameModal
        open
        stacked
        onOpenChange={open => { if (!open) onClose(); }}
        size="wide"
        title="DETALHES DO JOGADOR"
        subtitle={<>Visualização de <span className="font-extrabold text-[#C9A84C]">{player.shortName}</span></>}
        headerExtra={(
          <button
            onClick={() => setZoomCard(true)}
            title="Ver card em tela cheia"
            aria-label="Ver card ampliado"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10 focus:outline-none"
            style={{ border: '1px solid #2E2E42', color: '#C9C9D5' }}
          >
            🔍
          </button>
        )}
        footer={(
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[#2E2E42] px-6 py-2.5 text-sm font-black text-gray-300 transition-colors hover:bg-white/5 hover:text-white focus:outline-none"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            FECHAR
          </button>
        )}
        bodyClassName="relative !p-0"
        bodyStyle={{
          backgroundColor: '#090910',
          backgroundImage: `linear-gradient(180deg,rgba(9,9,16,.48),rgba(9,9,16,.66)),url(${texture})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'scroll',
        }}
      >
        <div className="relative z-10 space-y-5 p-[18px]">
          <div className="overflow-hidden rounded-xl" style={{ background: 'rgba(7,7,15,.78)', border: `1px solid ${getRarityColor(player.rarity)}22` }}>
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: '#10101d', border: `2px solid ${getRarityColor(player.rarity)}` }}>
                <PlayerPortrait
                  playerId={player.id}
                  photoUrl={player.photoUrl}
                  alt={player.shortName}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: 'center top', scale: '1.2' }}
                  fallback={<span className="text-2xl" style={{ color: getRarityColor(player.rarity) }}>⚽</span>}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-[#1c1c2e] px-2 py-0.5 text-[10px] font-black text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[formationRole] ?? formationRole}</span>
                  {isOutOfPosition && <span className="rounded border border-[#EF444444] bg-[#EF444422] px-2 py-0.5 text-[9px] font-black text-[#EF4444]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>⚠️ FORA DE POSIÇÃO</span>}
                  {isSecondary && <span className="whitespace-nowrap rounded border border-[#F59E0B55] bg-[#F59E0B22] px-2 py-0.5 text-[9px] font-black text-[#F59E0B]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>🔁 2ª POSIÇÃO · −5%</span>}
                </div>
                <div className="truncate text-xl font-black uppercase text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{player.shortName}</div>
                {getEvolutionLevel(player) > 0 && <span className="mt-1 inline-flex items-center justify-center rounded bg-gradient-to-r from-[#0a7a2f] to-[#22C55E] px-2 py-0.5 text-center text-[9px] font-black leading-none text-[#04120a]" style={{ letterSpacing: '0.06em' }}>⭐ NÍVEL {getEvolutionLevel(player)}</span>}
                <div className="truncate text-xs text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{player.club} · {player.nation}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-3xl font-black text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{effectiveStats.overall}</div>
                {effectiveOverallDelta !== 0 && <div className="text-xs font-bold" style={{ color: effectiveOverallDelta > 0 ? '#22C55E' : '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>({effectiveOverallDelta > 0 ? '+' : ''}{effectiveOverallDelta})</div>}
                <div className="text-[9px] font-bold text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>GERAL EFETIVO</div>
                <div className="mt-1 text-[8px] font-bold leading-tight text-[#8A8A9A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>BASE ORIGINAL {originalOverall}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 border-t" style={{ borderColor: '#161626' }}>
              {statRows.map(({ label, base, value }, index) => {
                const delta = value - base;
                const color = delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : '#E8D080';
                return (
                  <div key={label} className={`flex flex-col items-center py-3 ${((index + 1) % 4 === 0) ? '' : 'border-r'} ${index < 4 ? 'border-b' : ''}`} style={{ borderColor: '#161626' }}>
                    <span className="text-[9px] font-bold tracking-wider text-gray-600" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{label}</span>
                    <span className="text-lg font-black" style={{ fontFamily: 'Rajdhani, sans-serif', color }}>{value}</span>
                    {delta !== 0 && <span className="text-[9px] font-bold" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>{delta > 0 ? '+' : ''}{delta}</span>}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3" style={{ borderColor: '#161626' }}>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold tracking-wider text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>QUÍMICA INDIVIDUAL</span>
                <div className="flex gap-1">{chemDots.map((filled, index) => <div key={index} style={{ width: 10, height: 10, borderRadius: '50%', background: filled ? '#22C55E' : '#1a1a2e', boxShadow: filled ? '0 0 5px #22C55E' : 'none', border: '1px solid rgba(255,255,255,.1)' }} />)}</div>
                <span className="text-[10px] font-black text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{effectiveStats.chemScore}/3</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="text-[9px] font-bold tracking-wider text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>JOGA EM:</span>
                <span className="rounded bg-[#1c1c2e] px-1.5 py-0.5 text-[9px] font-black text-[#C9A84C]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[player.position] ?? player.position}</span>
                {effectiveSecondaries(player).map(position => <span key={position} className="rounded border border-[#2a2a3a] bg-[#12121c] px-1.5 py-0.5 text-[9px] font-bold text-[#9A9AAA]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{POS_PT[position] ?? position}</span>)}
              </div>
            </div>


            {effectiveStats.activeCoachEffects.length > 0 && (
              <div className="border-t bg-[#09090f] px-4 py-3" style={{ borderColor: '#161626' }}>
                <div className="mb-2 text-[9px] font-black tracking-widest text-yellow-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>⚡ BÔNUS ATIVO DO TREINADOR</div>
                <div className="flex flex-wrap gap-1.5">{effectiveStats.activeCoachEffects.map((effect, index) => <span key={index} className="rounded border border-[#C9A84C44] bg-[#C9A84C22] px-2 py-0.5 text-[9px] font-black text-[#E8C84A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{effect}</span>)}</div>
              </div>
            )}

            <BuffBreakdown
              eff={effectiveStats}
              chem={chemInfo}
              traits={traitInfos}
              player={player}
              charBoost={characteristicBoosts[player.id]}
              isStarter
              formationRole={formationRole}
              credits={team.credits}
              playStyle={playStyle}
            />
          </div>
        </div>
      </GameModal>

      {zoomCard && (
        <GameModal open stacked onOpenChange={open => { if (!open) setZoomCard(false); }} title={<span className="sr-only">Visualização ampliada do card</span>} closeLabel="Fechar" bodyClassName="flex items-center justify-center">
          <PlayerCard player={player} effectiveStats={effectiveStats} scale={1.5} />
        </GameModal>
      )}
    </>
  );
}
