import { useMemo, useState } from 'react';
import { POS_PT, type Player } from '@shared/game/gameData';
import { getEvolutionLevel, type Team } from '@shared/game/gameEngine';
import { projectLevel } from '@shared/game/clubProjects';
import PlayerCard, { cardTexture, UNIQUE_STYLE } from './PlayerCard';
import PlayerSheet from './player-sheet/PlayerSheet';
import { buildPlayerSheet } from './player-sheet/playerSheetModel';
import { GameModal } from '../../design-system';

interface Props {
  player: Player;
  team: Team;
  positionIndex: number;
  activePlayStyle?: string;
  isKnockout?: boolean;
  isFinal?: boolean;
  isLosing?: boolean;
  coachPrime?: boolean;
  analysisLevel?: number;
  onClose: () => void;
}

/** Read-only player sheet used by post-match results. It intentionally has no swap,
 * evolution, specialization, physiotherapy or other mutating controls. */
export default function PlayerDetailsModal({
  player,
  team,
  positionIndex,
  activePlayStyle,
  isKnockout = false,
  isFinal = false,
  isLosing = false,
  coachPrime = false,
  analysisLevel = 1,
  onClose,
}: Props) {
  const [zoomCard, setZoomCard] = useState(false);
  const model = useMemo(() => buildPlayerSheet({
    player,
    players: team.players,
    index: positionIndex,
    coachId: team.coachId,
    formationId: team.formationId,
    playStyle: activePlayStyle ?? team.playStyle,
    captainId: team.captain,
    isKnockout,
    isFinal,
    isLosing,
    coachPrime,
    analysisLevel,
    stadiumProjectLevel: projectLevel(team.clubProjects, 'stadium'),
    credits: team.credits,
  }), [player, team, positionIndex, activePlayStyle, isKnockout, isFinal, isLosing, coachPrime, analysisLevel]);
  const texture = UNIQUE_STYLE[player.id]?.texture ?? cardTexture(player.rarity, getEvolutionLevel(player), player.specialization);
  const where = model.isStarter ? `titular · ${POS_PT[model.formationRole] ?? model.formationRole}` : 'reserva';

  return (
    <>
      <GameModal
        open
        stacked
        onOpenChange={open => { if (!open) onClose(); }}
        size="wide"
        title="FICHA DO JOGADOR"
        subtitle={<><span className="font-extrabold text-primary">{player.shortName}</span> · {where}</>}
        headerExtra={(
          <button onClick={() => setZoomCard(true)} title="Ver card em tela cheia" aria-label="Ver card ampliado"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10"
            style={{ border: '1px solid #2E2E42', color: '#C9C9D5' }}>
            🔍
          </button>
        )}
        footer={(
          <button onClick={onClose}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[#2E2E42] px-6 py-2.5 text-sm font-black text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            FECHAR
          </button>
        )}
        bodyClassName="relative !p-0"
        bodyStyle={{
          backgroundColor: '#090910',
          backgroundImage: `linear-gradient(180deg,rgba(9,9,16,.48),rgba(9,9,16,.66)),url(${texture})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'scroll',
        }}
      >
        <div className="relative z-10 p-[18px]">
          <PlayerSheet model={model} />
        </div>
      </GameModal>

      {zoomCard && (
        <GameModal open stacked onOpenChange={open => { if (!open) setZoomCard(false); }} title={<span className="sr-only">Visualização ampliada do card</span>} closeLabel="Fechar" bodyClassName="flex items-center justify-center">
          <PlayerCard player={player} effectiveStats={model.eff} scale={1.5} />
        </GameModal>
      )}
    </>
  );
}
