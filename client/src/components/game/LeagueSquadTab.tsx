// UCL Immortals — "MEU TIME" tab (in-league squad management).
// Thin wrapper around the shared <SquadEditor>: reads the league team and wires solo dispatch
// (or online sync) to the editor's callbacks. All the UI lives in SquadEditor.
import { useGame } from '../../contexts/GameContext';
import SquadEditor from './SquadEditor';
import { medicalFreeTreatmentsPerCompetition, medicalPhysioCost, projectLevel } from '../../lib/clubProjects';

export default function LeagueSquadTab() {
  const { state, dispatch, setMatchRolesOnline, setMatchPlanOnline, swapPlayerTeamOnline, martirTargetsOnline, healInjuryOnline, evolveCoachPrimeOnline, setEvolvePointOnline, chooseSpecializationOnline, resetEvolvePointsOnline } = useGame();
  const team = state.playerTeam;
  if (!team) return null;
  const online = state.mode === 'online';
  const medicalLevel = projectLevel(team.clubProjects, 'medical');
  const freeTreatmentLimit = medicalFreeTreatmentsPerCompetition(medicalLevel);
  const physioFree = (state.medicalFreeTreatmentsUsed ?? 0) < freeTreatmentLimit;
  const physioCost = medicalPhysioCost(medicalLevel);
  const wins = state.leagueStandings.find(s => s.teamId === team.id)?.won ?? 0;
  const cap = team.captain ?? null;
  const pen = team.penaltyTaker ?? null;
  const fk = team.freeKickTaker ?? null;

  // 🟨🟥🩹 Disponibilidade dos MEUS jogadores (mapa global → keyed por playerId).
  const availability: Record<string, { yellows: number; banned: number; injured: number }> = {};
  for (const p of team.players) {
    const a = state.discipline[`${team.id}:${p.id}`];
    if (a) availability[p.id] = a;
  }

  return (
    <SquadEditor
      isKnockout={state.phase === 'knockout'}
      availability={availability}
      canAffordPhysio={physioFree || state.points >= physioCost}
      physioFree={physioFree}
      physioCost={physioCost}
      onHealInjury={(playerId) => online ? healInjuryOnline(playerId) : dispatch({ type: 'HEAL_INJURY', playerId })}
      coachPrime={team.coachPrime}
      points={state.points}
      analysisLevel={projectLevel(team.clubProjects, 'analysis')}
      stadiumProjectLevel={projectLevel(team.clubProjects, 'stadium')}
      wins={wins}
      onEvolvePrime={() => online ? evolveCoachPrimeOnline() : dispatch({ type: 'EVOLVE_COACH_PRIME' })}
      onSetEvolvePoint={(playerId, attr, delta) => online ? setEvolvePointOnline(playerId, attr, delta) : dispatch({ type: 'SET_EVOLVE_POINT', playerId, attr, delta })}
      onChooseSpecialization={(playerId, specialization) => online ? chooseSpecializationOnline(playerId, specialization) : dispatch({ type: 'CHOOSE_PLAYER_SPECIALIZATION', playerId, specialization })}
      onResetEvolvePoints={(playerId) => online ? resetEvolvePointsOnline(playerId) : dispatch({ type: 'RESET_EVOLVE_POINTS', playerId })}
      players={team.players}
      coachId={team.coachId}
      formationId={team.formationId}
      playStyle={team.playStyle}
      matchPlan={team.matchPlan}
      captain={team.captain}
      penaltyTaker={team.penaltyTaker}
      freeKickTaker={team.freeKickTaker}
      onSetFormation={(id) => online
        ? setMatchRolesOnline(cap, pen, fk, team.playStyle, id)
        : dispatch({ type: 'SET_PLAYER_TEAM_FORMATION', formationId: id })}
      onSetPlayStyle={(id) => online
        ? setMatchRolesOnline(cap, pen, fk, id)
        : dispatch({ type: 'SET_PLAYER_TEAM_PLAY_STYLE', playStyle: id })}
      onSetMatchPlan={(plan) => online
        ? setMatchPlanOnline(plan)
        : dispatch({ type: 'SET_PLAYER_TEAM_MATCH_PLAN', plan })}
      onSetCaptain={(id) => online
        ? setMatchRolesOnline(id, pen, fk)
        : dispatch({ type: 'SET_PLAYER_TEAM_CAPTAIN', playerId: id })}
      onSetPenaltyTaker={(id) => online
        ? setMatchRolesOnline(cap, id, fk)
        : dispatch({ type: 'SET_PLAYER_TEAM_PENALTY_TAKER', playerId: id })}
      onSetFreeKickTaker={(id) => online
        ? setMatchRolesOnline(cap, pen, id)
        : dispatch({ type: 'SET_PLAYER_TEAM_FREE_KICK_TAKER', playerId: id })}
      onSwap={(a, b) => online
        ? swapPlayerTeamOnline(a, b)
        : dispatch({ type: 'SWAP_PLAYER_TEAM', indexA: a, indexB: b })}
      onSetMartirTargets={(playerId, targetIds) => online
        ? martirTargetsOnline(playerId, targetIds)
        : dispatch({ type: 'SET_PLAYER_TEAM_MARTIR_TARGETS', playerId, targetIds })}
    />
  );
}
