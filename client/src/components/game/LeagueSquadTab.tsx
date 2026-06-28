// UCL Immortals — "MEU TIME" tab (in-league squad management).
// Thin wrapper around the shared <SquadEditor>: reads the league team and wires solo dispatch
// (or online sync) to the editor's callbacks. All the UI lives in SquadEditor.
import { useGame } from '../../contexts/GameContext';
import SquadEditor from './SquadEditor';

export default function LeagueSquadTab() {
  const { state, dispatch, setMatchRolesOnline } = useGame();
  const team = state.playerTeam;
  if (!team) return null;
  const online = state.mode === 'online';
  const cap = team.captain ?? null;
  const pen = team.penaltyTaker ?? null;
  const fk = team.freeKickTaker ?? null;

  return (
    <SquadEditor
      players={team.players}
      coachId={team.coachId}
      formationId={team.formationId}
      playStyle={team.playStyle}
      captain={team.captain}
      penaltyTaker={team.penaltyTaker}
      freeKickTaker={team.freeKickTaker}
      onSetFormation={(id) => online
        ? setMatchRolesOnline(cap, pen, fk, team.playStyle, id)
        : dispatch({ type: 'SET_PLAYER_TEAM_FORMATION', formationId: id })}
      onSetPlayStyle={(id) => online
        ? setMatchRolesOnline(cap, pen, fk, id)
        : dispatch({ type: 'SET_PLAYER_TEAM_PLAY_STYLE', playStyle: id })}
      onSetCaptain={(id) => online
        ? setMatchRolesOnline(id, pen, fk)
        : dispatch({ type: 'SET_PLAYER_TEAM_CAPTAIN', playerId: id })}
      onSetPenaltyTaker={(id) => online
        ? setMatchRolesOnline(cap, id, fk)
        : dispatch({ type: 'SET_PLAYER_TEAM_PENALTY_TAKER', playerId: id })}
      onSetFreeKickTaker={(id) => online
        ? setMatchRolesOnline(cap, pen, id)
        : dispatch({ type: 'SET_PLAYER_TEAM_FREE_KICK_TAKER', playerId: id })}
      onSwap={(a, b) => dispatch({ type: 'SWAP_PLAYER_TEAM', indexA: a, indexB: b })}
    />
  );
}
