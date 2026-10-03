import { UserPlus, AlertTriangle } from 'lucide-react';
import PlayerCard from '../../components/game/PlayerCard';
import MatchDetailsModal from '../../components/game/MatchDetailsModal';
import MatchCreditsModal from '../../components/game/MatchCreditsModal';
import MissionResolutionModal from '../../components/game/MissionResolutionModal';
import TradeInviteModal from '../../components/game/TradeInviteModal';
import TradeNegotiationModal from '../../components/game/TradeNegotiationModal';
import BetSlipModal, { type BetSlipSubmission } from '../../components/game/BetSlipModal';
import { bettingPayoutRulesForLevel } from '@shared/game/bets';
import { projectLevel } from '@shared/game/clubProjects';
import { MAX_RESERVE_PLAYERS } from '@shared/game/gameEngine';
import { POS_PT } from '@shared/game/gameData';
import { Button, GameModal } from '../../design-system';
import type { LeagueHub } from './useLeagueHub';

// Modals rendered at the end of the league hub page.
export default function HubModals({ hub }: { hub: LeagueHub }) {
  const {
    state, dispatch, online, pickReinforcementOnline, dismissReinforcementOnline, rerollReinforcementOnline,
    shopPlaceBetOnline, shopCancelBetOnline,
    emergencySelection, setEmergencySelection, handleEmergencySelection,
    showCreditsModal, closeCreditsModal, showMissionResolutionModal, closeMissionResolutionModal,
    postMatchModalQueueReady, recruitmentOffer, recruitmentEventLabel, recruitmentLevel,
    recruitmentSelectionsRemaining, recruitmentTotalOptions, recruitmentRerollsRemaining,
    detailsMatch, setDetailsMatch, betSlip, setBetSlip, betFor, remainingCap, bettingLevel,
    lineupWarning, setLineupWarning, reserveCount,
  } = hub;
  return (
    <>
      {/* ── Contratação emergencial: vaga titular sem cobertura no banco ── */}
      {emergencySelection && emergencySelection.options.length > 0 && (
        <GameModal
          open
          onOpenChange={next => { if (!next) setEmergencySelection(null); }}
          size="wide"
          className="flex max-h-[95vh] flex-col"
          title={
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F59E0B22', border: '1px solid #F59E0B55' }}>
                <AlertTriangle size={20} style={{ color: '#FBBF24' }} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-widest leading-none" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FBBF24' }}>
                CONTRATAÇÃO EMERGENCIAL
              </h3>
            </div>
          }
          subtitle={
            <>
              <b style={{ color: '#FFF' }}>{emergencySelection.starterName}</b> está indisponível e não há reserva para <b style={{ color: '#FBBF24' }}>{POS_PT[emergencySelection.position] ?? emergencySelection.position}</b>.
            </>
          }
          footer={
            <div className="flex w-full items-center justify-between">
              <span className="text-[13px] hidden sm:inline" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                A rodada continua bloqueada até ajustar o XI.
              </span>
              <Button intent="ghost" className="ml-auto" onClick={() => setEmergencySelection(null)}>
                VOLTAR
              </Button>
            </div>
          }
        >
              <div className="ui-panel ui-panel--inset flex-shrink-0 border-[#F59E0B]/35 bg-[#F59E0B]/[0.07] px-4 py-3">
                <div className="text-[13px] font-black tracking-widest" style={{ color: '#FBBF24', fontFamily: 'var(--font-game), sans-serif' }}>
                  ESCOLHA GRATUITA · PRATA OU BRONZE
                </div>
                <div className="text-[13px] mt-1" style={{ color: '#A9A9B8', fontFamily: 'var(--font-game), sans-serif' }}>
                  O escolhido entra direto no time titular, substitui o indisponível e mantém o valor de venda normal da sua raridade.
                </div>
              </div>

              <div className="py-5 flex-1 min-h-0 flex items-center justify-center">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 justify-items-center">
                  {emergencySelection.options.map(option => (
                    <button
                      key={option.id}
                      onClick={() => handleEmergencySelection(option)}
                      className="transition-transform hover:scale-[1.06] active:scale-[0.97] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
                      title={`Contratar ${option.shortName} para ${POS_PT[emergencySelection.position] ?? emergencySelection.position}`}
                    >
                      <PlayerCard player={option} compact lite />
                    </button>
                  ))}
                </div>
              </div>
        </GameModal>
        )}

      {/* ── End-of-round reinforcement pick ── */}
      <>
        {showCreditsModal && state.lastMatchPoints && (
          <MatchCreditsModal points={state.lastMatchPoints} onClose={closeCreditsModal} />
        )}
        {showMissionResolutionModal && state.missions.missionResolution && (
          <MissionResolutionModal
            resolution={state.missions.missionResolution}
            onClose={closeMissionResolutionModal}
            missionsProjectLevel={projectLevel(state.playerTeam?.clubProjects, 'missions')}
          />
        )}
        {state.mode === 'online' && <TradeInviteModal />}
        {state.mode === 'online' && <TradeNegotiationModal />}
        {postMatchModalQueueReady && state.reinforcementOptions && state.reinforcementOptions.length > 0 && !showCreditsModal && !showMissionResolutionModal && (
          <GameModal
            open
            onOpenChange={() => {}}
            dismissible={false}
            size="wide"
            className="flex max-h-[95vh] flex-col"
            bodyClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
            title={
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#C9A84C22', border: '1px solid #C9A84C55' }}>
                  <UserPlus size={20} style={{ color: 'var(--ui-brand-strong)' }} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-[12px] font-black tracking-[0.16em]" style={{ color: '#A7A7B8', fontFamily: 'var(--font-game), sans-serif' }}>
                    CENTRO DE RECRUTAMENTO · NÍVEL {recruitmentLevel}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-widest leading-none" style={{ fontFamily: 'var(--font-display), sans-serif', color: 'var(--ui-brand-strong)' }}>
                    RECRUTAMENTO DA {recruitmentEventLabel}
                  </h3>
                </div>
              </div>
            }
            subtitle={
              <>
                O Centro encontrou <b style={{ color: '#FFF' }}>{recruitmentTotalOptions} jogadores</b>. Escolha <b style={{ color: '#FFF' }}>{recruitmentSelectionsRemaining} para contratar</b> e adicionar ao seu <b style={{ color: 'var(--ui-info)' }}>banco de reservas</b>.
                {recruitmentOffer?.minimumOverall ? <> Todas as opções têm <b style={{ color: '#F0D77A' }}>overall {recruitmentOffer.minimumOverall}+</b>.</> : null}
              </>
            }
            footer={
              <div className="flex w-full items-center justify-between">
                <span className="text-[13px] hidden sm:inline" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                  👆 Toque em um card para contratar · {recruitmentSelectionsRemaining} escolha{recruitmentSelectionsRemaining === 1 ? '' : 's'} restante{recruitmentSelectionsRemaining === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  {recruitmentRerollsRemaining > 0 && (
                    <Button intent="secondary" className="text-[#f472b6] border-[#f472b6]/40"
                      onClick={() => online ? rerollReinforcementOnline() : dispatch({ type: 'REROLL_REINFORCEMENT' })}
                    >
                      🔄 Re-sortear opções · grátis
                    </Button>
                  )}
                  <Button intent="ghost"
                    onClick={() => online ? dismissReinforcementOnline() : dispatch({ type: 'DISMISS_REINFORCEMENT' })}
                  >
                    Pular recrutamento
                  </Button>
                </div>
              </div>
            }
          >
                {/* Options — bigger full cards (light, no animations) */}
                {/* Opções: grade que cabe SEM rolagem (3 col no celular, 6 no PC) */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 justify-items-center">
                  {state.reinforcementOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => online ? pickReinforcementOnline(option) : dispatch({ type: 'PICK_REINFORCEMENT', player: option })}
                      className="transition-transform hover:scale-[1.06] active:scale-[0.97] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
                      title={`Contratar ${option.shortName} (${recruitmentSelectionsRemaining} escolha${recruitmentSelectionsRemaining === 1 ? '' : 's'} restante${recruitmentSelectionsRemaining === 1 ? '' : 's'})`}
                      aria-label={`Contratar ${option.shortName}`}
                    >
                      <PlayerCard player={option} compact lite />
                    </button>
                  ))}
                </div>
          </GameModal>
        )}
      </>

      {/* 🔍 Ver Detalhes da partida (rodada / MEUS JOGOS) */}
      {detailsMatch && (
        <MatchDetailsModal
          result={detailsMatch.result}
          homeTeam={detailsMatch.homeTeam}
          awayTeam={detailsMatch.awayTeam}
          homeName={detailsMatch.homeName}
          awayName={detailsMatch.awayName}
          isKnockout={detailsMatch.isKnockout}
          isFinal={detailsMatch.isFinal}
          onClose={() => setDetailsMatch(null)}
        />
      )}

      {/* 🎯 Slip de palpite */}
      {betSlip && (() => {
          const myBet = betFor(betSlip.matchKey);
          const capLeft = remainingCap + (myBet?.stake ?? 0); // editar reaproveita o próprio stake
          return (
            <BetSlipModal
              homeName={betSlip.homeName} awayName={betSlip.awayName} existing={myBet}
              remainingCap={capLeft} points={state.points}
              payoutRules={bettingPayoutRulesForLevel(bettingLevel)}
              onConfirm={(submission: BetSlipSubmission) => {
                if (online) shopPlaceBetOnline(betSlip.matchKey, submission.homeGoals, submission.awayGoals, submission.stake, betSlip.homeTeamId, betSlip.awayTeamId, submission.market, submission.selections);
                else dispatch({
                  type: 'PLACE_BET',
                  matchKey: betSlip.matchKey,
                  homeTeamId: betSlip.homeTeamId,
                  awayTeamId: betSlip.awayTeamId,
                  homeGoals: submission.homeGoals,
                  awayGoals: submission.awayGoals,
                  stake: submission.stake,
                  market: submission.market,
                  selections: submission.selections,
                });
                setBetSlip(null);
              }}
              onCancelBet={myBet ? () => {
                if (online) shopCancelBetOnline(betSlip.matchKey);
                else dispatch({ type: 'CANCEL_BET', matchKey: betSlip.matchKey });
                setBetSlip(null);
              } : undefined}
              onClose={() => setBetSlip(null)}
            />
          );
        })()}

      {/* 🚫 Aviso: escalação/banco impedem o início da partida */}
      {lineupWarning && (
        <GameModal
          open
          onOpenChange={next => { if (!next) setLineupWarning(null); }}
          className="max-w-sm overflow-hidden border-[var(--ui-danger)] text-center"
          footer={
            <Button intent="danger" className="w-full rounded-none border-0" onClick={() => setLineupWarning(null)}>
              ENTENDI
            </Button>
          }
        >
              <div className="text-4xl mb-2">🚫</div>
              <div className="text-lg font-black tracking-widest" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FCA5A5' }}>ESCALAÇÃO INVÁLIDA</div>
              {lineupWarning.kind === 'reserve' ? (
                <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#C9B3B3', fontFamily: 'var(--font-game), sans-serif' }}>
                  Seu banco tem <b style={{ color: '#FCA5A5' }}>{reserveCount} reservas</b>, mas o limite para iniciar uma partida é de <b style={{ color: '#FFF' }}>{MAX_RESERVE_PLAYERS}</b>.<br />
                  Venda ou remova reservas na aba <b style={{ color: 'var(--ui-brand)' }}>MERCADO</b> antes de jogar.
                </p>
              ) : (
                <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#C9B3B3', fontFamily: 'var(--font-game), sans-serif' }}>
                  Você tem jogador(es) <b style={{ color: '#FCA5A5' }}>suspenso(s)/lesionado(s)</b> no time titular: <b style={{ color: '#FFF' }}>{lineupWarning.names.join(', ')}</b>.<br />
                  Substitua na aba <b style={{ color: 'var(--ui-brand)' }}>MEU CLUBE</b> antes de jogar a rodada.
                </p>
              )}
        </GameModal>
      )}
    </>
  );
}
