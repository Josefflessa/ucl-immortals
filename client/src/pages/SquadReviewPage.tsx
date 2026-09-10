// UCL Immortals — Squad Review Page (post-draft).
// Thin page shell around the shared <SquadEditor> (same UI as the in-league "MEU TIME" tab),
// plus the post-draft chrome: header and the "iniciar competição" action. Wiring uses the
// draft-phase state + actions; online mode submits the lineup instead of starting locally.
import { useGame } from '../contexts/GameContext';
import { Player } from '../lib/gameData';
import SquadEditor from '../components/game/SquadEditor';
import { AppShell, Button, PageContainer, TopBar } from '../design-system';

export default function SquadReviewPage() {
  const { state, dispatch, submitSquadReviewOnline } = useGame();
  const online = state.mode === 'online';
  const me = online ? state.onlinePlayers.find(p => p.socketId === state.socketId) : null;
  const isReady = me?.ready || false;
  const draftedPlayers = state.draftedPlayers as Player[];

  const handleStart = () => {
    if (online) {
      submitSquadReviewOnline(state.captain, state.penaltyTaker, state.freeKickTaker, state.draftedPlayers, state.selectedPlayStyle, state.selectedFormationId);
    } else {
      dispatch({ type: 'START_LEAGUE' });
    }
  };

  if (online && isReady) {
    return (
      <AppShell className="flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 text-4xl text-[var(--ui-brand-strong)]">◌</div>
        <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--ui-brand)] border-t-transparent" />
        <div className="max-w-xs text-lg font-bold leading-snug text-[var(--ui-text)] sm:max-w-md">
          Aguardando os demais jogadores confirmarem a escalação…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title="REVISÃO DO ELENCO" playerName={state.playerName} />

      <PageContainer className="max-w-5xl overflow-y-auto">
        <SquadEditor
          players={draftedPlayers}
          coachId={state.selectedCoachId}
          formationId={state.selectedFormationId}
          playStyle={state.selectedPlayStyle}
          captain={state.captain}
          penaltyTaker={state.penaltyTaker}
          freeKickTaker={state.freeKickTaker}
          onSetFormation={(id) => dispatch({ type: 'SET_FORMATION', formationId: id })}
          onSetPlayStyle={(id) => dispatch({ type: 'SET_PLAY_STYLE', playStyle: id })}
          onSetCaptain={(id) => dispatch({ type: 'SET_CAPTAIN', playerId: id })}
          onSetPenaltyTaker={(id) => dispatch({ type: 'SET_PENALTY_TAKER', playerId: id })}
          onSetFreeKickTaker={(id) => dispatch({ type: 'SET_FREE_KICK_TAKER', playerId: id })}
          onSwap={(a, b) => dispatch({ type: 'SWAP_PLAYERS', indexA: a, indexB: b })}
          footer={
            <Button
              type="button"
              intent="primary"
              size="large"
              onClick={handleStart}
              className="w-full"
            >
              🏆 INICIAR COMPETIÇÃO →
            </Button>
          }
        />
      </PageContainer>
    </AppShell>
  );
}
