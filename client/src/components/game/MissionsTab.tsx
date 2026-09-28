import { useMemo, useState } from 'react';
import { Clock3, LockKeyhole, RefreshCw, ScrollText, Trash2, Trophy } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import { projectLevel } from '../../lib/clubProjects';
import {
  MISSION_MAP,
  MISSION_RARITY_META,
  canRerollMissionBoard,
  missionDeadline,
  missionReward,
  missionRemovalCost,
} from '../../lib/missions';
import { Button, ConfirmDialog, Progress } from '../../design-system';

function deadlineLabel(matches: number): string {
  return `${matches} ${matches === 1 ? 'partida restante' : 'partidas restantes'}`;
}

function MissionCard({
  missionId,
  active,
  resolved = false,
  canAccept,
  canRemove = true,
  missionsProjectLevel = 1,
  onAccept,
  onRemove,
}: {
  missionId: string;
  active?: { progress: number; matchesRemaining: number };
  resolved?: boolean;
  canAccept: boolean;
  canRemove?: boolean;
  missionsProjectLevel?: number;
  onAccept: () => void;
  onRemove: () => void;
}) {
  const definition = MISSION_MAP[missionId];
  if (!definition) return null;
  const rarity = MISSION_RARITY_META[definition.rarity];
  const progress = active ? Math.min(definition.target, active.progress) : 0;
  const reward = missionReward(missionId, missionsProjectLevel);
  const removalCost = missionRemovalCost(missionId, missionsProjectLevel);
  const deadline = missionDeadline(missionId, missionsProjectLevel);

  return (
    <article
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: active ? '#151528' : '#10101C',
        border: `1px solid ${active ? rarity.color + 'AA' : '#24243A'}`,
        boxShadow: active ? `0 0 22px ${rarity.color}12` : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${rarity.color}18`, color: rarity.color }}
        >
          {active ? <Trophy size={17} /> : <ScrollText size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black tracking-wide text-balance text-white sm:text-xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {definition.title}
            </h3>
            <span className="rounded px-1.5 py-0.5 text-[11px] font-black tracking-widest" style={{ color: rarity.color, background: `${rarity.color}18`, fontFamily: 'Rajdhani, sans-serif' }}>
              {rarity.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-pretty leading-relaxed" style={{ color: '#A5A5B6', fontFamily: 'Rajdhani, sans-serif' }}>
            {definition.description}
          </p>
        </div>
      </div>

      {active ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-bold tabular-nums" style={{ color: '#BDBDCC', fontFamily: 'Rajdhani, sans-serif' }}>
              <span>PROGRESSO</span>
              <span>{progress}/{definition.target}</span>
            </div>
            <Progress value={progress} max={definition.target} tone="success" />
          </div>
          <div className="mt-auto space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: '#8E8EA0', fontFamily: 'Rajdhani, sans-serif' }}>
              <span className="inline-flex items-center gap-1"><Clock3 size={14} /> {deadlineLabel(active.matchesRemaining)}</span>
              <span className="font-black" style={{ color: '#F0C674' }}>💰 +{reward}</span>
            </div>
            <Button
              intent="danger"
              size="default"
              className="w-full"
              disabled={!canRemove}
              title={!canRemove ? 'Você não tem créditos suficientes para remover esta missão.' : undefined}
              onClick={onRemove}
            >
              <Trash2 size={14} /> Remover por 💰 {removalCost}
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: '#8E8EA0', fontFamily: 'Rajdhani, sans-serif' }}>
            <span className="inline-flex items-center gap-1"><Clock3 size={14} /> Prazo: {deadline} {deadline === 1 ? 'partida' : 'partidas'}</span>
            <span className="font-black" style={{ color: '#F0C674' }}>💰 +{reward}</span>
          </div>
          {resolved ? (
            <div className="flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-black tracking-widest" style={{ color: '#66667A', background: '#0B0B14', fontFamily: 'Rajdhani, sans-serif' }}>
              <LockKeyhole size={12} /> DISPONÍVEL NO PRÓXIMO MURAL
            </div>
          ) : (
            <Button intent="primary" size="default" className="w-full" disabled={!canAccept} onClick={onAccept}>
              {canAccept ? 'ACEITAR MISSÃO' : '2 MISSÕES ATIVAS'}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

export default function MissionsTab() {
  const { state, dispatch, acceptMissionOnline, rerollMissionsOnline, removeMissionOnline } = useGame();
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const online = state.mode === 'online';
  const activeById = useMemo(() => new Map(state.missions.active.map(active => [active.missionId, active])), [state.missions.active]);
  const board = state.missions.boardIds
    .map(id => MISSION_MAP[id])
    .filter(definition => definition && !activeById.has(definition.id));
  const activeCount = state.missions.active.length;
  const availableCredits = Math.max(0, state.points);
  const missionsProjectLevel = projectLevel(state.playerTeam?.clubProjects, 'missions');
  const rerollAvailable = canRerollMissionBoard(state.missions, missionsProjectLevel);

  const accept = (missionId: string) => {
    if (online) acceptMissionOnline(missionId);
    else dispatch({ type: 'ACCEPT_MISSION', missionId });
  };
  const remove = (missionId: string) => {
    if (online) removeMissionOnline(missionId);
    else dispatch({ type: 'REMOVE_MISSION', missionId });
    setRemoveTarget(null);
  };
  const reroll = () => {
    if (!rerollAvailable) return;
    if (online) rerollMissionsOnline();
    else dispatch({ type: 'REROLL_MISSIONS' });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #17172B, #10101A)', border: '1px solid #2A2A46' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ScrollText size={20} style={{ color: '#F0C674' }} />
              <h2 className="text-2xl font-black tracking-widest text-balance text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>MURAL DE MISSÕES</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-pretty leading-relaxed" style={{ color: '#9696AA', fontFamily: 'Rajdhani, sans-serif' }}>
              O mural muda a cada rodada, mas as missões aceitas continuam valendo até serem concluídas, expirarem ou serem removidas.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {missionsProjectLevel >= 2 && (
              <Button
                intent={rerollAvailable ? 'primary' : 'secondary'}
                size="default"
                disabled={!rerollAvailable}
                title={rerollAvailable ? 'Atualiza as 5 ofertas do mural. 1 uso por rodada.' : 'A atualização gratuita desta rodada já foi usada.'}
                onClick={reroll}
              >
                <RefreshCw size={15} /> {rerollAvailable ? 'ATUALIZAR MURAL' : 'MURAL ATUALIZADO'}
              </Button>
            )}
            <div className="rounded-lg px-3 py-2 text-center" style={{ background: '#0B0B15', border: '1px solid #34344E' }}>
              <div className="text-xs font-black tracking-widest" style={{ color: '#85859A', fontFamily: 'Rajdhani, sans-serif' }}>MISSÕES ATIVAS</div>
              <div className="mt-0.5 text-3xl font-black tabular-nums" style={{ color: activeCount === 2 ? '#F0C674' : '#FFF', fontFamily: 'Bebas Neue, sans-serif' }}>{activeCount}/2</div>
            </div>
          </div>
        </div>
      </div>

      {state.missions.active.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={15} style={{ color: '#F0C674' }} />
            <h2 className="text-base font-black tracking-widest text-balance text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>SUAS MISSÕES</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {state.missions.active.map(active => (
              <MissionCard
                key={active.missionId}
                missionId={active.missionId}
                active={active}
                resolved={false}
                canAccept={false}
                missionsProjectLevel={missionsProjectLevel}
                canRemove={availableCredits >= missionRemovalCost(active.missionId, missionsProjectLevel)}
                onAccept={() => undefined}
                onRemove={() => {
                  if (availableCredits >= missionRemovalCost(active.missionId, missionsProjectLevel)) setRemoveTarget(active.missionId);
                }}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText size={15} style={{ color: '#8E8EA0' }} />
            <h2 className="text-base font-black tracking-widest text-balance text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>MISSÕES DISPONÍVEIS</h2>
          </div>
          <span className="text-xs font-bold" style={{ color: '#77778A', fontFamily: 'Rajdhani, sans-serif' }}>
            {board.length} {board.length === 1 ? 'oferta disponível' : 'ofertas disponíveis'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {board.map(definition => {
            const active = activeById.get(definition.id);
            const resolved = state.missions.history.some(history => history.missionId === definition.id && history.cycleKey === state.missions.cycleKey);
            return (
              <MissionCard
                key={definition.id}
                missionId={definition.id}
                active={active}
                resolved={resolved}
                canAccept={activeCount < 2 && !resolved}
                missionsProjectLevel={missionsProjectLevel}
                onAccept={() => accept(definition.id)}
                onRemove={() => setRemoveTarget(definition.id)}
              />
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={open => { if (!open) setRemoveTarget(null); }}
        title="Remover missão?"
        description={removeTarget ? <>Essa missão será encerrada antes do prazo. O custo é de <b style={{ color: '#F0C674' }}>{missionRemovalCost(removeTarget, missionsProjectLevel)} créditos</b>.</> : ''}
        confirmLabel="Remover missão"
        onConfirm={() => removeTarget && remove(removeTarget)}
        intent="danger"
      />
    </div>
  );
}

