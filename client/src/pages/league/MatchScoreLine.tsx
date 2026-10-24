import type { ReactNode } from 'react';
import Crest from '../../components/game/Crest';

type MatchScoreLineProps = {
  homeName: string;
  awayName: string;
  homeCrestId?: string | null;
  awayCrestId?: string | null;
  homeColor?: string;
  awayColor?: string;
  score: ReactNode;
};

/** Shared home/away/score layout for match cards in rounds and history. */
export default function MatchScoreLine({
  homeName,
  awayName,
  homeCrestId,
  awayCrestId,
  homeColor = 'var(--ui-text)',
  awayColor = 'var(--ui-text)',
  score,
}: MatchScoreLineProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="min-w-0 whitespace-normal break-words text-right text-body-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: homeColor }}>
          {homeName}
        </span>
        <Crest crestId={homeCrestId} name={homeName} size={22} />
      </div>
      <div className="flex w-24 shrink-0 flex-col items-center justify-center text-center sm:w-28 lg:w-24">
        {score}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
        <Crest crestId={awayCrestId} name={awayName} size={22} />
        <span className="min-w-0 whitespace-normal break-words text-left text-body-sm font-semibold leading-tight" style={{ fontFamily: 'var(--font-game), sans-serif', color: awayColor }}>
          {awayName}
        </span>
      </div>
    </div>
  );
}
