import { CheckCircle2, Clock3, Trophy, XCircle } from 'lucide-react';
import { Button, GameModal } from '../../design-system';
import { MISSION_MAP, MISSION_RARITY_META, missionReward } from '@shared/game/missions';
import type { MissionResolution } from '@shared/game/missions';

interface MissionResolutionModalProps {
  resolution: MissionResolution;
  onClose: () => void;
  missionsProjectLevel?: number;
}

export default function MissionResolutionModal({ resolution, onClose, missionsProjectLevel = 1 }: MissionResolutionModalProps) {
  const completed = resolution.completed
    .map(missionId => MISSION_MAP[missionId])
    .filter(Boolean);
  const expired = resolution.expired
    .map(missionId => MISSION_MAP[missionId])
    .filter(Boolean);
  const completedTotal = completed.reduce((total, mission) => total + missionReward(mission.id, missionsProjectLevel), 0);
  const onlyCompleted = completed.length > 0 && expired.length === 0;
  const onlyExpired = completed.length === 0 && expired.length > 0;
  const title = onlyCompleted
    ? completed.length === 1 ? 'MISSÃO CONCLUÍDA' : 'MISSÕES CONCLUÍDAS'
    : onlyExpired
      ? expired.length === 1 ? 'MISSÃO EXPIRADA' : 'MISSÕES EXPIRADAS'
      : 'RESULTADO DAS MISSÕES';
  const subtitle = onlyCompleted
    ? 'Você concluiu as missões que estavam no seu mural.'
    : onlyExpired
      ? 'O prazo terminou e as missões do seu mural foram encerradas sem recompensa.'
      : 'A partida concluiu algumas missões do seu mural; outras expiraram sem recompensa.';

  return (
    <GameModal
      open
      onOpenChange={next => { if (!next) onClose(); }}
      dismissible={false}
      className="max-w-lg overflow-hidden"
      title={(
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
            style={{
              background: onlyExpired ? '#64748B22' : '#22C55E22',
              border: `1px solid ${onlyExpired ? '#64748B55' : '#22C55E55'}`,
            }}
          >
            {onlyExpired ? <Clock3 size={20} style={{ color: '#94A3B8' }} /> : <Trophy size={20} style={{ color: '#4ADE80' }} />}
          </div>
          <h3
            className="text-2xl sm:text-3xl font-black tracking-widest leading-none"
            style={{ fontFamily: 'Bebas Neue, sans-serif', color: onlyExpired ? '#CBD5E1' : '#4ADE80' }}
          >
            {title}
          </h3>
        </div>
      )}
      subtitle={<span className="text-sm leading-relaxed text-pretty">{subtitle}</span>}
      footer={(
          <Button intent="primary" size="large" className="w-full text-base" onClick={onClose}>
          CONTINUAR
        </Button>
      )}
    >
      <div className="space-y-3 px-5 py-5 sm:px-7">
        {completed.map(mission => {
          const rarity = MISSION_RARITY_META[mission.rarity];
          return (
            <div key={`completed-${mission.id}`} className="rounded-xl border border-[#22C55E33] bg-[#22C55E0D] p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={19} className="mt-0.5 flex-shrink-0" style={{ color: '#4ADE80' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-base font-black text-white sm:text-lg" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      {mission.title}
                    </strong>
                    <span className="text-base font-black tabular-nums" style={{ color: '#F0C674', fontFamily: 'Rajdhani, sans-serif' }}>
                      +{missionReward(mission.id, missionsProjectLevel)} créditos
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-pretty leading-relaxed" style={{ color: '#A5A5B6', fontFamily: 'Rajdhani, sans-serif' }}>
                    {mission.description}
                  </p>
                  <span className="mt-2 inline-flex rounded px-1.5 py-0.5 text-xs font-black tracking-widest" style={{ color: rarity.color, background: `${rarity.color}18`, fontFamily: 'Rajdhani, sans-serif' }}>
                    CONCLUÍDA · {rarity.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {expired.map(mission => (
          <div key={`expired-${mission.id}`} className="rounded-xl border border-[#64748B33] bg-[#64748B0D] p-4">
            <div className="flex items-start gap-3">
              <XCircle size={19} className="mt-0.5 flex-shrink-0" style={{ color: '#94A3B8' }} />
              <div className="min-w-0">
                <strong className="text-base font-black text-white sm:text-lg" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {mission.title}
                </strong>
                <p className="mt-1 text-sm text-pretty leading-relaxed" style={{ color: '#A5A5B6', fontFamily: 'Rajdhani, sans-serif' }}>
                  O prazo terminou e a missão foi encerrada sem recompensa.
                </p>
                <span className="mt-2 inline-flex rounded px-1.5 py-0.5 text-xs font-black tracking-widest" style={{ color: '#94A3B8', background: '#64748B18', fontFamily: 'Rajdhani, sans-serif' }}>
                  EXPIRADA
                </span>
              </div>
            </div>
          </div>
        ))}

        {completedTotal > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-[#F0C67433] bg-[#F0C6740D] px-4 py-3">
            <span className="text-xs font-black tracking-widest" style={{ color: '#A5A5B6', fontFamily: 'Rajdhani, sans-serif' }}>
              TOTAL DE RECOMPENSAS
            </span>
            <strong className="text-lg font-black" style={{ color: '#F0C674', fontFamily: 'Bebas Neue, sans-serif' }}>
              +{completedTotal} créditos
            </strong>
          </div>
        )}
      </div>
    </GameModal>
  );
}
