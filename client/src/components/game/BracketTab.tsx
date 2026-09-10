/**
 * BracketTab — full knockout bracket overview (Playoffs → Oitavas → Quartas → Semis → Final).
 *
 * Renders one column per round (horizontally scrollable on mobile), each listing its
 * ties. Decided rounds show the aggregate score and highlight who advanced; the ACTIVE
 * round shows only the matchup (scores hidden to avoid spoilers until it's resolved and
 * everyone has watched); future rounds show "A definir" placeholder slots. The player's
 * own path is highlighted in gold throughout.
 */
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import { useTeams } from '../../hooks/useTeams';

type Tie = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  played?: boolean;
  result?: { homeGoals: number; awayGoals: number; winner?: string } | null;
};

const ROUND_ORDER = ['playoffs', 'round16', 'quarters', 'semis', 'final'] as const;
const ROUND_SLOTS: Record<string, number> = { playoffs: 8, round16: 8, quarters: 4, semis: 2, final: 1 };
const ROUND_LABEL: Record<string, string> = { playoffs: 'Playoffs', round16: 'Oitavas', quarters: 'Quartas', semis: 'Semis', final: 'Final' };

export default function BracketTab() {
  const { state } = useGame();
  const { knockoutBracket } = state;
  const { localTeamId, getTeamName: resolveTeamName } = useTeams();

  if (!knockoutBracket) return null;
  const kb = knockoutBracket as any;
  // A 16-team qualification line skips the playoff entirely. Hide that column
  // so the active marker and bracket hierarchy start at the Round of 16.
  const roundOrder = kb.playoffs?.length ? ROUND_ORDER : ROUND_ORDER.filter(key => key !== 'playoffs');
  const getTeamName = (teamId: string) => resolveTeamName(teamId, '');

  const isMe = (teamId: string) =>
    !!teamId && (teamId === localTeamId ||
      (state.mode === 'online' && state.onlinePlayers.some(p => p.id === teamId && p.socketId === state.socketId)));

  const curIdx = roundOrder.indexOf(knockoutBracket.currentRound as any);

  const tiesFor = (key: string): Tie[] => {
    if (key === 'quarters') return kb.quarterFinals || [];
    if (key === 'semis') return kb.semiFinals || [];
    if (key === 'final') return kb.final ? [kb.final] : [];
    return kb[key] || [];
  };

  const TeamRow = ({ teamId, score, isWinner, hideScore }: { teamId: string; score: number | null; isWinner: boolean; hideScore: boolean }) => {
    const name = getTeamName(teamId);
    const me = isMe(teamId);
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <span className="font-ui flex items-center gap-1 truncate text-[11px] font-bold leading-tight"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            color: me ? '#C9A84C' : isWinner ? '#E6E6EE' : name ? '#9A9AAA' : '#55556A',
          }}>
          {isWinner && !hideScore && <Check size={11} className="text-green-500 flex-shrink-0" />}
          {name || 'A definir'}
        </span>
        <span className="text-xs font-black flex-shrink-0"
          style={{ fontFamily: 'Bebas Neue, sans-serif', color: isWinner ? '#22C55E' : '#7A7A8A' }}>
          {hideScore ? '·' : score == null ? '' : score}
        </span>
      </div>
    );
  };

  const TieCard = ({ tie, status }: { tie: Tie | null; status: 'done' | 'active' | 'future' }) => {
    const hasTeams = !!tie && (!!tie.homeTeamId || !!tie.awayTeamId);
    const decided = status === 'done' && !!tie?.result;
    // Spoiler guard: only ever show a score for a FULLY decided (past) round.
    const hideScore = !decided;
    const hp = isMe(tie?.homeTeamId || '');
    const ap = isMe(tie?.awayTeamId || '');
    const mine = hp || ap;
    const winner = tie?.result?.winner;
    return (
      <div className="ui-panel ui-panel--inset overflow-hidden"
        style={{
          background: status === 'active' ? 'var(--ui-surface-2)' : 'var(--ui-surface-inset)',
          borderColor: mine ? 'rgba(215,180,90,0.4)' : status === 'active' ? 'rgba(108,145,216,0.45)' : 'var(--ui-line-subtle)',
          opacity: status === 'future' ? 0.5 : 1,
        }}>
        <TeamRow teamId={tie?.homeTeamId || ''} score={tie?.result?.homeGoals ?? null}
          isWinner={decided && winner === tie?.homeTeamId} hideScore={hideScore || !hasTeams} />
        <div className="h-px mx-2" style={{ background: '#1F1F30' }} />
        <TeamRow teamId={tie?.awayTeamId || ''} score={tie?.result?.awayGoals ?? null}
          isWinner={decided && winner === tie?.awayTeamId} hideScore={hideScore || !hasTeams} />
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-3 text-sm leading-relaxed text-[var(--ui-text-muted)]">
        Caminho até o título — seu time em <span style={{ color: '#C9A84C' }}>dourado</span>. O placar da fase em andamento fica oculto até todos assistirem.
      </div>
      <div className="overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
        <div className="flex gap-3 min-w-max">
          {roundOrder.map((key, ri) => {
            const status: 'done' | 'active' | 'future' = ri < curIdx ? 'done' : ri === curIdx ? 'active' : 'future';
            const real = tiesFor(key);
            const slots = ROUND_SLOTS[key];
            // Future rounds have no ties yet — render greyed placeholders so the tree shape reads.
            const cards: (Tie | null)[] = real.length > 0 ? real : Array.from({ length: slots }, () => null);
            return (
              <div key={key} className="flex w-[150px] flex-col gap-2">
                <div className="ui-badge w-full justify-center"
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    background: status === 'active' ? '#C9A84C' : '#0F0F1A',
                    color: status === 'active' ? '#080810' : status === 'done' ? '#6A6A7A' : '#44445A',
                    border: `1px solid ${status === 'active' ? '#C9A84C' : '#1A1A2A'}`,
                  }}>
                  {ROUND_LABEL[key]}
                </div>
                <div className="flex flex-col justify-around gap-2 flex-1">
                  {cards.map((tie, i) => (
                    <TieCard key={tie?.id || `${key}_${i}`} tie={tie} status={status} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
