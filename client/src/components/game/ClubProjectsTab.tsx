// UCL Immortals — estrutura visual dos Projetos do Clube.
// Efeitos de gameplay são ativados por etapas; esta tela já usa o contrato
// normalizado para ficar pronta para solo, online e campanhas antigas.

import { useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../../contexts/GameContext';
import { ConfirmDialog, GameModal } from '../../design-system';
import PlayerCard from './PlayerCard';
import { TRAIN_ATTRS } from '../../lib/shop';
import type { TrainAttr } from '../../lib/shop';
import { BET_ROUND_CAP } from '../../lib/bets';
import {
  CLUB_PROJECT_DEFINITIONS,
  CLUB_PROJECT_LEVELS,
  normalizeClubProjects,
  projectUpgradeCost,
  trainingBoostForProject,
  trainingCostForProject,
} from '../../lib/clubProjects';
import { formationAdvantageColorForAnalysisLevel } from '../../lib/gameEngine';
import type { ClubProjectId } from '../../lib/clubProjects';

function ProjectLevelBar({ level, color }: { level: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Nível ${level} de ${CLUB_PROJECT_LEVELS}`}>
      {Array.from({ length: CLUB_PROJECT_LEVELS }, (_, index) => (
        <span
          key={index}
          className="h-2 flex-1 rounded-full"
          style={{ background: index < level ? color : '#242436' }}
        />
      ))}
    </div>
  );
}

function formatProjectCopy(projectId: string, text: string): ReactNode {
  if (projectId !== 'analysis') return text;
  return text.split(/(leve|clara|forte)/gi).map((part, index) =>
    /^(leve|clara|forte)$/i.test(part)
      ? <strong key={`${part}-${index}`} className="font-black" style={{ color: formationAdvantageColorForAnalysisLevel(part.toLowerCase() === 'forte' ? 5 : part.toLowerCase() === 'clara' ? 3 : 1) }}>{part}</strong>
      : part,
  );
}

export default function ClubProjectsTab() {
  const { state, dispatch, upgradeClubProjectOnline, shopTrainOnline } = useGame();
  const projects = useMemo(() => normalizeClubProjects(state.playerTeam?.clubProjects), [state.playerTeam?.clubProjects]);
  const medicalEnabled = state.competitionFormat?.matchSettings?.injuriesEnabled !== false;
  const bettingEnabled = BET_ROUND_CAP > 0;
  const visibleProjectDefinitions = useMemo(
    () => CLUB_PROJECT_DEFINITIONS.filter(project => (project.id !== 'medical' || medicalEnabled) && (project.id !== 'betting' || bettingEnabled)),
    [bettingEnabled, medicalEnabled],
  );
  const totalLevels = visibleProjectDefinitions.reduce((sum, project) => sum + projects.levels[project.id], 0);
  const [selectedProjectId, setSelectedProjectId] = useState<ClubProjectId | null>(null);
  const selectedProject = selectedProjectId
    ? visibleProjectDefinitions.find(project => project.id === selectedProjectId) ?? null
    : null;
  const [detailsProjectId, setDetailsProjectId] = useState<ClubProjectId | null>(null);
  const detailsProject = detailsProjectId
    ? visibleProjectDefinitions.find(project => project.id === detailsProjectId) ?? null
    : null;
  const selectedLevel = selectedProjectId ? projects.levels[selectedProjectId] : null;
  const selectedNextLevel = selectedLevel !== null ? selectedLevel + 1 : null;
  const selectedCost = selectedNextLevel !== null ? projectUpgradeCost(selectedNextLevel) : null;
  const selectedNextEffect = selectedProject && selectedLevel !== null
    ? selectedProject.levelEffects?.[selectedLevel] ?? selectedProject.nextStep
    : null;
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [trainingPlayerId, setTrainingPlayerId] = useState<string | null>(null);
  const online = state.mode === 'online';
  const trainingLevel = projects.levels.training;
  const trainingPlayer = trainingPlayerId
    ? state.playerTeam?.players.find(player => player.id === trainingPlayerId) ?? null
    : null;
  const firstTrainingForPlayer = !!trainingPlayer && (trainingPlayer.trainCount ?? 0) === 0;
  const trainingCost = trainingPlayer
    ? trainingCostForProject(trainingLevel, trainingPlayer.trainCount ?? 0)
    : null;
  const trainingBoost = trainingBoostForProject(trainingLevel, firstTrainingForPlayer);
  const trainingAvailable = state.phase === 'league' || state.phase === 'knockout';
  const confirmUpgrade = () => {
    if (!selectedProjectId || !selectedCost) return;
    if (online) upgradeClubProjectOnline(selectedProjectId);
    else dispatch({ type: 'UPGRADE_CLUB_PROJECT', projectId: selectedProjectId });
    setSelectedProjectId(null);
  };

  const trainPlayer = (attr: TrainAttr) => {
    if (!trainingPlayer || trainingCost === null || state.points < trainingCost) return;
    if (online) shopTrainOnline(trainingPlayer.id, attr);
    else dispatch({ type: 'SHOP_TRAIN', playerId: trainingPlayer.id, attr });
    setTrainingPlayerId(null);
    setTrainingOpen(false);
  };

  return (
    <section className="space-y-4" aria-labelledby="club-projects-title">
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{ background: 'linear-gradient(135deg, #151526, #0F0F1A)', borderColor: '#C9A84C55' }}
      >
        <div>
          <div className="min-w-0">
            <h2 id="club-projects-title" className="text-3xl font-black tracking-wide text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              ESTRUTURA DO CLUBE
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#9A9AAA]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              Invista seus créditos nas áreas do clube e escolha quais projetos desenvolver primeiro.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#242436] pt-3 text-xs font-bold tracking-wider text-[#77778A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          <span>{visibleProjectDefinitions.length} áreas de desenvolvimento</span>
          <span className="text-[#C9A84C]">{totalLevels}/{visibleProjectDefinitions.length * CLUB_PROJECT_LEVELS} níveis investidos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibleProjectDefinitions.map(project => {
          const level = projects.levels[project.id];
          const nextCost = projectUpgradeCost(level + 1);
          const maxed = level >= CLUB_PROJECT_LEVELS;
          const implemented = project.id === 'recruitment' || project.id === 'analysis' || project.id === 'betting' || project.id === 'medical' || project.id === 'training' || project.id === 'stadium' || project.id === 'supporters';
          const canUpgrade = implemented && !maxed && !!nextCost && state.points >= nextCost;

          return (
            <article
              key={project.id}
              className="relative flex h-full flex-col overflow-hidden rounded-2xl border p-4 sm:p-5"
              style={{ background: '#0F0F1A', borderColor: `${project.color}55` }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: project.color }} />
              <div className="flex items-start gap-4">
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-xl text-3xl"
                  style={{ background: `${project.color}16`, border: `1px solid ${project.color}55` }}
                  aria-hidden="true"
                >
                  {project.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-balance text-xl font-black leading-none text-white sm:text-2xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{project.title}</h3>
                    <span className="rounded-full px-2.5 py-1.5 text-[10px] font-black tracking-wider" style={{ background: `${project.color}18`, color: project.color, fontFamily: 'Rajdhani, sans-serif' }}>
                      NÍVEL {level}/{CLUB_PROJECT_LEVELS}
                    </span>
                  </div>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-[#9A9AAA]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{project.description}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#242436] bg-[#0A0A14] p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black tracking-wider" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  <span className="text-[#77778A]">PROGRESSÃO</span>
                  <span style={{ color: project.color }}>{maxed ? 'MÁXIMO' : nextCost ? `PRÓXIMO · ${nextCost} CR` : 'BASE'}</span>
                </div>
                <ProjectLevelBar level={level} color={project.color} />
                  <p className="mt-3 text-pretty text-sm leading-relaxed text-[#B0B0BE]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  <span className="font-bold text-white">Nível atual:</span>{' '}
                  {formatProjectCopy(project.id, project.levelEffects?.[level - 1] ?? project.foundation)}
                </p>
                {!maxed && (
                    <p className="mt-1 text-pretty text-sm leading-relaxed text-[#77778A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    <span className="font-bold text-[#A0A0B0]">Próximo:</span>{' '}
                    {formatProjectCopy(project.id, project.levelEffects?.[level] ?? project.nextStep)}
                  </p>
                )}
              </div>

              <div className="mt-auto flex min-h-[72px] flex-col gap-2 pt-3">
                <span className="flex min-h-4 items-center text-xs font-black leading-4 tracking-wider text-[#626274]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {maxed ? 'PROJETO COMPLETO' : implemented ? 'PROJETO ATIVO' : 'ESTRUTURA PREPARADA'}
                </span>
                <div className="grid h-10 grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsProjectId(project.id)}
                    className="h-10 rounded-lg border px-3 text-xs font-black tracking-wider transition-colors hover:bg-white/[.04]"
                    style={{ borderColor: `${project.color}55`, color: '#D7D7E2', fontFamily: 'Rajdhani, sans-serif' }}
                  >
                    VER NÍVEIS
                  </button>
                  <button
                    type="button"
                    disabled={!canUpgrade}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="h-10 rounded-lg border px-3 text-xs font-black tracking-wider transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                    style={{ borderColor: `${project.color}66`, color: project.color, fontFamily: 'Rajdhani, sans-serif' }}
                    title={
                      !implemented ? 'Este projeto será ativado em uma próxima etapa'
                        : maxed ? 'Projeto no nível máximo'
                          : !canUpgrade ? `Você precisa de mais ${Math.max(0, (nextCost ?? 0) - state.points)} créditos`
                            : `Evoluir para o nível ${level + 1}`
                    }
                  >
                    {!implemented ? 'EM BREVE' : maxed ? 'MÁXIMO' : `EVOLUIR · ${nextCost} CR`}
                  </button>
                </div>
              </div>

              {project.id === 'training' && (
                <button
                  type="button"
                  disabled={!trainingAvailable}
                  onClick={() => { setTrainingOpen(true); setTrainingPlayerId(null); }}
                  className="mt-3 h-10 w-full rounded-lg border px-3 text-[11px] font-black tracking-wider transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ borderColor: `${project.color}66`, color: project.color, fontFamily: 'Rajdhani, sans-serif' }}
                  title={!trainingAvailable ? 'O treinamento fica disponível durante a competição' : 'Abrir Centro de Treinamento'}
                >
                  ABRIR TREINAMENTO
                </button>
              )}
            </article>
          );
        })}
      </div>

      {state.playerTeam && (
        <GameModal
          open={trainingOpen}
          onOpenChange={open => setTrainingOpen(open)}
          size="wide"
          title="💪 CENTRO DE TREINAMENTO"
          subtitle="Evolua permanentemente um atributo do jogador. O treino é aplicado na hora e usa os créditos da campanha."
          closeLabel="Fechar treinamento"
        >
              {!trainingPlayer ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#FBBF2444] bg-[#FBBF240D] p-3 text-xs leading-relaxed text-[#D6D0BE]">
                    <div className="font-black tracking-wider text-[#FBBF24]">NÍVEL {trainingLevel}/5 · PRÓXIMO TREINO</div>
                    <div className="mt-1">
                      O custo começa em <b className="text-white">{trainingLevel >= 2 ? 50 : 100}</b> e aumenta <b className="text-white">{trainingLevel >= 5 ? 25 : 50}</b> a cada treino no mesmo jogador. {trainingLevel === 3 ? 'O primeiro treino de cada jogador concede +4.' : trainingLevel >= 4 ? 'Todos os treinos concedem +4.' : 'Cada treino concede +3.'}
                    </div>
                  </div>
                  {[{ title: 'TITULARES', color: '#22C55E', players: state.playerTeam.players.slice(0, 11) }, { title: 'BANCO / RESERVAS', color: '#818CF8', players: state.playerTeam.players.slice(11) }].map(group => group.players.length === 0 ? null : (
                    <div key={group.title}>
                      <div className="mb-2 text-[11px] font-black tracking-widest" style={{ color: group.color }}>{group.title}</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {group.players.map(player => {
                          const firstTraining = (player.trainCount ?? 0) === 0;
                          const cost = trainingCostForProject(trainingLevel, player.trainCount ?? 0);
                          const affordable = state.points >= cost;
                          return (
                            <button
                              key={player.id}
                              type="button"
                              disabled={!affordable}
                              onClick={() => setTrainingPlayerId(player.id)}
                              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-[#242436] bg-[#07070F] p-2 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
                              title={!affordable ? `Faltam ${cost - state.points} créditos` : `Treinar ${player.shortName}`}
                            >
                              <PlayerCard player={player} compact lite />
                              <span className="text-[10px] font-black tracking-wide" style={{ color: affordable ? '#34D399' : '#EF4444', fontFamily: 'Rajdhani, sans-serif' }}>
                                💰 {cost}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <button type="button" onClick={() => setTrainingPlayerId(null)} className="text-xs font-black tracking-wider text-[#A0A0B0]">← ESCOLHER OUTRO JOGADOR</button>
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-[#FBBF2444] bg-[#07070F] p-3 sm:flex-row sm:items-start">
                    <PlayerCard player={trainingPlayer} compact lite />
                    <div className="min-w-0 text-center sm:text-left">
                      <div className="text-lg font-black text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{trainingPlayer.shortName}</div>
                      <div className="mt-1 text-xs text-[#B0B0BE]">Treinos realizados: {trainingPlayer.trainCount ?? 0}</div>
                      <div className="mt-2 text-sm font-black" style={{ color: state.points >= (trainingCost ?? Infinity) ? '#34D399' : '#EF4444' }}>
                        💰 {trainingCost} créditos · +{trainingBoost} no atributo
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TRAIN_ATTRS.map(attribute => (
                      <button
                        key={attribute.key}
                        type="button"
                        disabled={trainingCost === null || state.points < trainingCost}
                        onClick={() => trainPlayer(attribute.key)}
                        className="rounded-lg border border-[#FBBF2444] bg-[#0A0A14] px-2 py-3 text-xs font-black text-[#FBBF24] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ fontFamily: 'Rajdhani, sans-serif' }}
                      >
                        {attribute.label}
                        <span className="mt-1 block text-[10px] text-[#9A9AAA]">+{trainingBoost}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
        </GameModal>
      )}

      {detailsProject && (
        <GameModal
          open={!!detailsProjectId}
          onOpenChange={open => { if (!open) setDetailsProjectId(null); }}
          size="default"
          closeLabel="Fechar níveis"
          title={(
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ background: detailsProject.color + '18', border: '1px solid ' + detailsProject.color + '55' }}
                aria-hidden="true"
              >
                {detailsProject.icon}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-black tracking-widest text-[#9A9AAA]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  PROGRESSÃO COMPLETA
                </div>
                <div className="mt-1 text-xl leading-tight sm:text-2xl font-black" style={{ color: detailsProject.color, fontFamily: 'Bebas Neue, sans-serif' }}>
                  {detailsProject.title}
                </div>
                <p className="mt-1 text-sm text-[var(--ui-text-soft)]">
                  Nível atual: <b className="text-white">{projects.levels[detailsProject.id]}/{CLUB_PROJECT_LEVELS}</b>
                </p>
              </div>
            </div>
          )}
        >
              <div
                className="rounded-xl border p-3 text-sm leading-relaxed sm:p-4"
                style={{ borderColor: detailsProject.color + '55', background: detailsProject.color + '0D', color: '#D6D6E0', fontFamily: 'Rajdhani, sans-serif' }}
              >
                {detailsProject.description}
              </div>

              <div className="mt-4 space-y-2.5">
                {Array.from({ length: CLUB_PROJECT_LEVELS }, (_, index) => {
                  const levelNumber = index + 1;
                  const currentLevel = projects.levels[detailsProject.id];
                  const isCurrent = levelNumber === currentLevel;
                  const isCompleted = levelNumber < currentLevel;
                  const effect = detailsProject.levelEffects?.[index]
                    ?? (index === 0 ? detailsProject.foundation : detailsProject.nextStep);
                  const status = isCurrent ? 'NÍVEL ATUAL' : isCompleted ? 'CONCLUÍDO' : 'PRÓXIMO';

                  return (
                    <div
                      key={levelNumber}
                      className="rounded-xl border p-3 sm:p-4"
                      style={{
                        borderColor: isCurrent ? detailsProject.color : '#242436',
                        background: isCurrent ? detailsProject.color + '12' : '#0A0A14',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-black tracking-wider text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                          NÍVEL {levelNumber}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-black tracking-wider"
                          style={{
                            color: isCurrent ? detailsProject.color : isCompleted ? '#34D399' : '#9A9AAA',
                            background: isCurrent ? detailsProject.color + '18' : '#242436',
                            fontFamily: 'Rajdhani, sans-serif',
                          }}
                        >
                          {status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[#D0D0DC]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        {formatProjectCopy(detailsProject.id, effect)}
                      </p>
                      <div className="mt-3 border-t border-white/[.08] pt-2 text-xs font-bold tracking-wide text-[#8F8FA0]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        {levelNumber === 1 ? 'BASE DO PROJETO' : 'CUSTO PARA DESBLOQUEAR · ' + projectUpgradeCost(levelNumber) + ' CR'}
                      </div>
                    </div>
                  );
                })}
              </div>
        </GameModal>
      )}

      {selectedProject && selectedLevel !== null && selectedNextLevel !== null && selectedCost !== null && selectedNextEffect && (
        <ConfirmDialog
          open={!!selectedProjectId}
          onOpenChange={open => { if (!open) setSelectedProjectId(null); }}
          title={`Evoluir ${selectedProject.title}`}
          description={(
            <div className="space-y-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2A2A40] bg-[#0A0A14] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[10px] font-black tracking-widest text-[#7E7E92]">NÍVEL ATUAL</div>
                  <div className="mt-0.5 text-xl font-black text-white">{selectedLevel}</div>
                </div>
                <span className="text-xl text-[#6A6A7A]" aria-hidden="true">→</span>
                <div className="min-w-0 text-right">
                  <div className="text-[10px] font-black tracking-widest text-[#7E7E92]">PRÓXIMO NÍVEL</div>
                  <div className="mt-0.5 text-xl font-black" style={{ color: selectedProject.color }}>{selectedNextLevel}</div>
                </div>
              </div>

              <div className="rounded-xl border px-3 py-3" style={{ borderColor: selectedProject.color + '55', background: selectedProject.color + '0D' }}>
                <div className="text-[10px] font-black tracking-widest" style={{ color: selectedProject.color }}>NOVO BENEFÍCIO</div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#D6D6E0]">{formatProjectCopy(selectedProject.id, selectedNextEffect)}</p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#C9A84C55] bg-[#C9A84C0D] px-3 py-2.5">
                <span className="text-[10px] font-black tracking-widest text-[#A7A7B8]">CUSTO DA EVOLUÇÃO</span>
                <strong className="shrink-0 text-base font-black text-[#E8C84A]">{selectedCost} CRÉDITOS</strong>
              </div>
            </div>
          )}
          confirmLabel={`CONFIRMAR · ${selectedCost} CR`}
          cancelLabel="CANCELAR"
          intent="primary"
          onConfirm={confirmUpgrade}
        />
      )}
    </section>
  );
}
