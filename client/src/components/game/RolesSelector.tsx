// UCL Immortals — Captain & Penalty-taker selector
// Shared by the squad-review screen (after the draft) and the league "MEU TIME"
// tab (between matches). Lets the manager choose who wears the armband and who
// takes the penalties that occur DURING a match.
//
// The effect numbers below mirror the engine so the UI never lies:
//  - Captain: the captain's single best attribute is boosted +CAPTAIN_BOOST for every
//      teammate (gameEngine.captainBestStat / CAPTAIN_BOOST)
//      immortal +3.5 · legendary +2.5 · others +1.5
//  - Penalty taker: shoots first in the shootout and gets +5 composure as the
//      designated taker; success scales with composure + the traits
//      "Especialista em Decisões"/"Frio na Final" (+10 each). (gameEngine.simulatePenalties)

import { useState } from 'react';
import { Info } from 'lucide-react';
import { CAPTAIN_BOOST, captainBestStatFromStarters, type EffectiveStats } from '../../lib/gameEngine';
import type { Player } from '../../lib/gameData';
import { buildSofifaUrl } from './PlayerCard';
import { IconButton } from '../../design-system';

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
  onSetCaptain: (playerId: string) => void;
  onSetPenaltyTaker: (playerId: string) => void;
  onSetFreeKickTaker: (playerId: string) => void;
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

export default function RolesSelector({
  players,
  captainId,
  penaltyTakerId,
  freeKickTakerId,
  onSetCaptain,
  onSetPenaltyTaker,
  onSetFreeKickTaker,
  onActivateRole,
  activeRole = null,
}: RolesSelectorProps) {
  const [infoRole, setInfoRole] = useState<GameRole | null>(null);

  const captain = players.find(p => p.id === captainId);
  const taker = players.find(p => p.id === penaltyTakerId);
  const fkTaker = players.find(p => p.id === freeKickTakerId);
  const roleCards: Array<{ role: GameRole; label: string; icon: string; color: string; player?: RoleablePlayer }> = [
    { role: 'captain', label: 'CAPITÃO', icon: '🅒', color: '#3B82F6', player: captain },
    { role: 'penalty', label: 'PÊNALTI', icon: '⚽', color: '#C9A84C', player: taker },
    { role: 'freeKick', label: 'FALTA', icon: '🎯', color: '#22C55E', player: fkTaker },
  ];

  const info: Record<GameRole, { title: string; description: string; metric: string }> = {
    captain: {
      title: 'CAPITÃO',
      description: `A maior estatística do capitão vira +${CAPTAIN_BOOST} para todo o time. O jogador com Capitão Nato dobra esse bônus.`,
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
    <div className="rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
          FUNÇÕES DE JOGO
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 sm:gap-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        {roleCards.map(card => {
          const isActive = activeRole === card.role;
          return (
            <div
              key={card.role}
              className="group flex min-w-0 items-center overflow-hidden rounded-lg"
              style={{
                background: isActive ? `${card.color}18` : '#14142A',
                border: `1px solid ${isActive ? `${card.color}99` : '#26263A'}`,
              }}
            >
              <button
                type="button"
                onClick={() => onActivateRole(card.role)}
                aria-pressed={isActive}
                className="min-w-0 flex-1 px-1.5 py-2 text-left transition-colors group-hover:bg-white/10 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-2.5 sm:py-2.5"
                style={{ color: card.color }}
                title={`Escolher ${card.label.toLowerCase()} no campo`}
              >
                <span className="flex min-w-0 items-center gap-0.5 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.02em] sm:gap-1 sm:text-[11px] sm:tracking-[0.08em]">
                  <span aria-hidden="true">{card.icon}</span>
                  <span>{card.label}</span>
                </span>
                <span className="mt-1 flex min-h-7 items-center gap-1.5 truncate text-[12px] font-bold" style={{ color: card.player ? '#FFF' : '#8A8A9A' }}>
                  {card.player ? (
                    <>
                      <img
                        src={buildSofifaUrl(card.player.id, 120) ?? undefined}
                        alt=""
                        className="h-7 w-6 shrink-0 rounded object-cover object-top"
                      />
                      <span className="truncate">{card.player.shortName}</span>
                    </>
                  ) : 'Escolher'}
                </span>
              </button>
              <IconButton
                label={`O que significa ${card.label.toLowerCase()}`}
                onClick={() => setInfoRole(current => current === card.role ? null : card.role)}
                aria-expanded={infoRole === card.role}
                title={`O que significa ${card.label.toLowerCase()}`}
                className="mr-0.5 size-8 shrink-0 rounded-full border-[var(--ui-line-strong)] bg-[var(--ui-surface-2)] p-0 text-[var(--ui-text-soft)] shadow-sm hover:border-[var(--ui-brand)] hover:text-[var(--ui-brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] sm:mr-1 sm:size-10"
                style={{ color: card.color, borderColor: `${card.color}66` }}
              >
                <Info size={19} className="size-4 sm:size-[19px]" aria-hidden="true" />
              </IconButton>
            </div>
          );
        })}
      </div>

      {infoRole ? (
        <div className="mt-2 rounded-lg px-3.5 py-3 text-[13px] leading-snug" style={{ background: '#0A0A14', border: `1px solid ${roleCards.find(card => card.role === infoRole)?.color ?? '#C9A84C'}55`, color: '#B8B8C8', fontFamily: 'Rajdhani, sans-serif' }}>
          <div className="mb-1 text-sm font-black tracking-widest" style={{ color: roleCards.find(card => card.role === infoRole)?.color ?? '#C9A84C' }}>
            {info[infoRole].title}
          </div>
          <div>{info[infoRole].description}</div>
          <div className="mt-1.5" style={{ color: '#9999A8' }}>{info[infoRole].metric} Toque no bloco para escolher diretamente no campo.</div>
        </div>
      ) : null}
    </div>
  );
}
