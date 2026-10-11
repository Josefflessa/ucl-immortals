/**
 * The score in the full-screen match: a broadcast-style board beside the pitch, one row per
 * team (crest, full name, goals), with the clock and the sound and exit buttons above.
 */
import { Minimize2, Volume2, VolumeX } from 'lucide-react';
import Crest from '../Crest';

export interface ScoreboardTeam {
  name: string;
  crestId?: string | null;
  goals: number;
  /** Shoot-out goals, while there is one. */
  penalties?: number;
  /** The viewer's team: marked in gold. */
  mine: boolean;
}

interface Props {
  home: ScoreboardTeam;
  away: ScoreboardTeam;
  /** "67'", "FIM", "PÊNALTIS"... and its state, for the colour and the live dot. */
  clock: { label: string; state: 'live' | 'paused' | 'done' };
  /** The two-legged tie's aggregate, on the second leg ("Agregado 3 × 2"). */
  aggregate?: string;
  muted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
}

export default function FullscreenScoreboard({ home, away, clock, aggregate, muted, onToggleMute, onExit }: Props) {
  const leader = home.goals + (home.penalties ?? 0) - (away.goals + (away.penalties ?? 0));
  const row = (team: ScoreboardTeam, ahead: boolean) => (
    <div className={`fs-board__team${team.mine ? ' fs-board__team--mine' : ''}${ahead ? ' fs-board__team--ahead' : ''}`}>
      <Crest crestId={team.crestId} name={team.name} size={26} />
      <span className="fs-board__name" title={team.name}>{team.name}</span>
      {team.penalties !== undefined && <span className="fs-board__pens" aria-label={`${team.penalties} nos pênaltis`}>({team.penalties})</span>}
      <span className="fs-board__goals">{team.goals}</span>
    </div>
  );
  return (
    <div className="fs-board">
      <div className="fs-board__top">
        <span className={`fs-board__clock fs-board__clock--${clock.state}`}>
          {clock.state === 'live' && <i aria-hidden="true" />}
          {clock.label}
        </span>
        <div className="fs-board__actions">
          <button type="button" className="fs-board__icon" onClick={onToggleMute} aria-label={muted ? 'Ligar o som' : 'Desligar o som'} aria-pressed={!muted} title={muted ? 'Ligar o som' : 'Desligar o som'}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button type="button" className="fs-board__icon" onClick={onExit} aria-label="Sair da tela cheia" title="Sair da tela cheia (Esc)">
            <Minimize2 size={16} />
          </button>
        </div>
      </div>
      <div className="fs-board__teams">
        {row(home, leader > 0)}
        {row(away, leader < 0)}
      </div>
      {aggregate && <div className="fs-board__aggregate">{aggregate}</div>}
    </div>
  );
}
