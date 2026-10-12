// UCL Immortals — Captain, penalty-taker & free-kick-taker selector
// Shared by the squad-review screen (after the draft) and the league "MEU TIME"
// tab (between matches). Lets the manager choose who wears the armband and who
// takes the penalties that occur DURING a match.
//
// The effect numbers below mirror the engine so the UI never lies:
//  - Captain: the captain's single best attribute is boosted +CAPTAIN_BOOST for every
//      teammate (gameEngine.captainBestStat / CAPTAIN_BOOST = +3, ×2 with Capitão Nato)
//  - Penalty taker: shoots first in the shootout and gets +5 composure as the
//      designated taker; success scales with composure + the traits
//      "Especialista em Decisões"/"Frio na Final" (+10 each). (gameEngine.simulatePenalties)

import { useState } from 'react';
import { Info, Plus } from 'lucide-react';
import { CAPTAIN_BOOST, captainBestStatFromStarters, type EffectiveStats } from '@shared/game/gameEngine';
import type { Player } from '@shared/game/gameData';
import PlayerPortrait from './PlayerPortrait';

type RoleStat = 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'composure';
type EffectiveRoleStats = Pick<EffectiveStats, RoleStat>;

export type GameRole = 'captain' | 'penalty' | 'freeKick';

export interface RoleMetric {
  primaryLabel: string;
  primaryValue: number;
  secondaryLabel?: string;
  secondaryValue?: number;
  traitLabel?: string;
}

export interface RoleablePlayer {
  id: string;
  shortName: string;
  position: string;
  overall: number;
  effectiveOverall?: number;
  rarity?: string;
  photoUrl?: string;
  composure?: number;
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
  traits?: string[];
  // In Meu Time/Revisão, role decisions and displayed dead-ball values use the
  // same effective team-context attributes shown on the player card.
  effectiveStats?: EffectiveRoleStats;
}

interface RolesSelectorProps {
  players: RoleablePlayer[]; // the 11 starters
  captainId: string | null | undefined;
  penaltyTakerId: string | null | undefined;
  freeKickTakerId: string | null | undefined;
  onActivateRole: (role: GameRole) => void;
  activeRole?: GameRole | null;
}

const STAT_LABELS: Record<string, string> = {
  pace: 'Ritmo', shooting: 'Finalização', passing: 'Passe', dribbling: 'Drible', defending: 'Defesa', physical: 'Físico',
};
const roleStatValue = (p: RoleablePlayer, stat: RoleStat): number => p.effectiveStats?.[stat] ?? p[stat] ?? 0;
const rawRoleStatValue = (p: RoleablePlayer, stat: RoleStat): number => p[stat] ?? 0;

function captainBestStatOf(p: RoleablePlayer): { stat: RoleStat; label: string; value: number; effectiveValue: number } {
  // The engine deliberately chooses the captain's best BASE attribute. Keep the
  // suggestion tied to that same rule; otherwise a coach/chemistry bonus could
  // make the UI suggest Passe while the match engine applies Drible.
  // RoleablePlayer is an intentional UI projection of Player; the engine helper
  // only reads the id and the six captain attributes from this value.
  const stat = (captainBestStatFromStarters([p as unknown as Player], p.id) ?? 'pace') as RoleStat;
  return {
    stat,
    label: STAT_LABELS[stat] ?? stat,
    value: rawRoleStatValue(p, stat),
    effectiveValue: roleStatValue(p, stat),
  };
}

// Penalty reliability score used only to RANK candidates for the suggestion.
// Mirrors the composure + trait weighting the engine uses on each kick.
function penaltyScoreFor(p: RoleablePlayer): number {
  return roleStatValue(p, 'composure')
    + (p.traits?.includes('Especialista em Decisões') ? 10 : 0)
    + (p.traits?.includes('Frio na Final') ? 10 : 0);
}

// Free-kick ranking — mirrors gameEngine.getFreeKickTaker (specialist trait first,
// otherwise highest shooting + composure).
function freeKickScoreFor(p: RoleablePlayer): number {
  return roleStatValue(p, 'shooting') + roleStatValue(p, 'composure')
    + ((p.traits?.includes('Cobrador de Falta') || p.traits?.includes('Cobrança de Falta')) ? 50 : 0);
}

const overallForDisplay = (p: RoleablePlayer): number => p.effectiveOverall ?? p.overall;

export function suggestedRoleId(players: RoleablePlayer[], role: GameRole): string | undefined {
  const ranked = [...players].sort((a, b) => {
    if (role === 'captain') return captainBestStatOf(b).value - captainBestStatOf(a).value || overallForDisplay(b) - overallForDisplay(a);
    if (role === 'penalty') return penaltyScoreFor(b) - penaltyScoreFor(a) || overallForDisplay(b) - overallForDisplay(a);
    return freeKickScoreFor(b) - freeKickScoreFor(a) || overallForDisplay(b) - overallForDisplay(a);
  });
  return ranked[0]?.id;
}

export function roleMetricFor(player: RoleablePlayer, role: GameRole): RoleMetric {
  if (role === 'captain') {
    const best = captainBestStatOf(player);
    return {
      primaryLabel: best.label.toUpperCase(),
      primaryValue: Math.round(best.effectiveValue),
      traitLabel: (player as unknown as Record<string, unknown>).capitaoNato ? 'NATO' : undefined,
    };
  }

  if (role === 'penalty') {
    const trait = player.traits?.find(name => name === 'Especialista em Decisões' || name === 'Frio na Final');
    return {
      primaryLabel: 'COMP',
      primaryValue: Math.round(roleStatValue(player, 'composure')),
      traitLabel: trait ? 'FRIO' : undefined,
    };
  }

  const trait = player.traits?.find(name => name === 'Cobrador de Falta' || name === 'Cobrança de Falta');
  return {
    primaryLabel: 'FIN',
    primaryValue: Math.round(roleStatValue(player, 'shooting')),
    secondaryLabel: 'COMP',
    secondaryValue: Math.round(roleStatValue(player, 'composure')),
    traitLabel: trait ? 'ESPECIALISTA' : undefined,
  };
}

/** Badge artwork per match role (public/roles). */
function RoleArt({ role, size }: { role: GameRole; size: number }) {
  return (
    <img
      src={`/roles/${role}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className="pointer-events-none shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}

export default function RolesSelector({
  players,
  captainId,
  penaltyTakerId,
  freeKickTakerId,
  onActivateRole,
  activeRole = null,
}: RolesSelectorProps) {
  const [infoRole, setInfoRole] = useState<GameRole | null>(null);

  const captain = players.find(p => p.id === captainId);
  const taker = players.find(p => p.id === penaltyTakerId);
  const fkTaker = players.find(p => p.id === freeKickTakerId);
  const roleCards: Array<{ role: GameRole; label: string; color: string; player?: RoleablePlayer }> = [
    { role: 'captain', label: 'CAPITÃO', color: '#F5B731', player: captain },
    { role: 'penalty', label: 'PÊNALTI', color: '#D4DAE3', player: taker },
    { role: 'freeKick', label: 'FALTA', color: '#3B82F6', player: fkTaker },
  ];

  const info: Record<GameRole, { title: string; description: string; metric: string }> = {
    captain: {
      title: 'CAPITÃO',
      description: `A maior estatística do capitão vira +${CAPTAIN_BOOST} para todo o time. O jogador com Capitão Nato triplica esse bônus.`,
      metric: 'Compare o melhor atributo entre Ritmo, Finalização, Passe, Drible, Defesa e Físico.',
    },
    penalty: {
      title: 'PÊNALTI',
      description: 'É o cobrador prioritário durante o jogo e recebe +5 de Compostura quando cobra.',
      metric: 'Compare Compostura e características de frieza para encontrar o mais confiável.',
    },
    freeKick: {
      title: 'FALTA',
      description: 'É o cobrador prioritário das faltas perigosas durante o jogo.',
      metric: 'Compare Finalização + Compostura; características de cobrança têm prioridade.',
    },
  };

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--ui-surface-1)', border: '1px solid var(--ui-surface-3)' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base font-black tracking-widest" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FFF' }}>
          FUNÇÕES DE JOGO
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
        {roleCards.map(card => {
          const isActive = activeRole === card.role;
          const infoOpen = infoRole === card.role;
          return (
            <div
              key={card.role}
              className="relative min-w-0 overflow-hidden rounded-xl transition-colors"
              style={{
                background: isActive ? `linear-gradient(180deg, ${card.color}26, ${card.color}0d)` : 'linear-gradient(180deg, #17172d, #111122)',
                border: `1px solid ${isActive ? `${card.color}aa` : infoOpen ? `${card.color}66` : '#26263A'}`,
                boxShadow: isActive ? `0 0 0 1px ${card.color}33, 0 4px 14px ${card.color}22` : undefined,
              }}
            >
              <button
                type="button"
                onClick={() => onActivateRole(card.role)}
                aria-pressed={isActive}
                className="flex w-full min-w-0 flex-col items-center gap-1.5 px-1.5 pb-2.5 pt-3 text-center transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{ color: card.color }}
                title={`Escolher ${card.label.toLowerCase()} no campo`}
              >
                <RoleArt role={card.role} size={38} />
                <span className="text-[12px] font-black uppercase tracking-[0.1em] sm:text-[13px]">{card.label}</span>
                {card.player ? (
                  <span className="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg bg-black/25 px-1.5 py-1">
                    <span className="size-6 shrink-0 overflow-hidden rounded-full bg-[#10101d]" style={{ boxShadow: `0 0 0 1.5px ${card.color}88` }}>
                      <PlayerPortrait
                        playerId={card.player.id}
                        photoUrl={card.player.photoUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        style={{ objectPosition: 'center top' }}
                        fallback={<span className="flex h-full w-full items-center justify-center text-[12px]">⚽</span>}
                      />
                    </span>
                    <span className="truncate text-[12px] font-bold text-white">{card.player.shortName}</span>
                  </span>
                ) : (
                  <span
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed px-1.5 py-1 text-[12px] font-bold"
                    style={{ borderColor: `${card.color}55`, color: '#A3A3B8' }}
                  >
                    <Plus size={13} strokeWidth={2.6} aria-hidden="true" />Escolher
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label={`O que significa ${card.label.toLowerCase()}`}
                title={`O que significa ${card.label.toLowerCase()}`}
                aria-expanded={infoOpen}
                onClick={() => setInfoRole(current => current === card.role ? null : card.role)}
                className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                style={{ color: infoOpen ? card.color : '#6E6E86' }}
              >
                <Info size={15} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {infoRole ? (
        <div className="mt-2 rounded-lg px-3.5 py-3 text-[13px] leading-snug" style={{ background: '#0A0A14', border: `1px solid ${roleCards.find(card => card.role === infoRole)?.color ?? '#C9A84C'}55`, color: '#B8B8C8', fontFamily: 'var(--font-game), sans-serif' }}>
          <div className="flex items-start gap-3">
            <RoleArt role={infoRole} size={48} />
            <div className="min-w-0">
              <div className="mb-1 text-sm font-black tracking-widest" style={{ color: roleCards.find(card => card.role === infoRole)?.color ?? 'var(--ui-brand)' }}>
                {info[infoRole].title}
              </div>
              <div>{info[infoRole].description}</div>
              <div className="mt-1.5" style={{ color: '#9999A8' }}>{info[infoRole].metric} Toque no bloco para escolher diretamente no campo.</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
