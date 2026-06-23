// UCL Immortals — shared team helpers
// Centralizes the "online vs solo" team resolution that used to be duplicated
// across LeaguePage / KnockoutPage / ReportPage.

import { useMemo, useCallback } from 'react';
import { useGame } from '../contexts/GameContext';
import { Team } from '../lib/gameEngine';

export function useTeams() {
  const { state } = useGame();
  const { mode, onlinePlayers, botTeams, playerTeam, socketId } = state;

  // Every team relevant to the current session: in online mode all human teams
  // plus the bots; in solo mode the player's team plus the bots.
  const allTeams = useMemo<Team[]>(() => (
    mode === 'online'
      ? [...onlinePlayers.filter(p => p.team).map(p => p.team!), ...botTeams]
      : playerTeam ? [playerTeam, ...botTeams] : botTeams
  ), [mode, onlinePlayers, botTeams, playerTeam]);

  // The id of the team controlled by this client (undefined if not resolvable).
  const localTeamId = useMemo(() => (
    mode === 'online'
      ? onlinePlayers.find(p => p.socketId === socketId)?.id
      : playerTeam?.id
  ), [mode, onlinePlayers, socketId, playerTeam]);

  // Resolve a team id to a display name. `fallback` is returned when the id is
  // unknown (e.g. 'TBD' for not-yet-decided knockout slots); defaults to the id.
  const getTeamName = useCallback((teamId: string, fallback?: string) => {
    if (teamId === playerTeam?.id) return playerTeam.name;
    const online = onlinePlayers.find(p => p.id === teamId);
    if (online) return online.name;
    return botTeams.find(t => t.id === teamId)?.name ?? fallback ?? teamId;
  }, [playerTeam, onlinePlayers, botTeams]);

  return { allTeams, localTeamId, getTeamName };
}
