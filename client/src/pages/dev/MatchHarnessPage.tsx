/**
 * Dev-only: the real match screen on two generated teams, with a result simulated by
 * the engine, outside any campaign (nothing is saved; "Concluir" only logs). Open with
 * #partida, or #partida-penaltis for a knockout that goes to a shootout.
 */
import { useMemo } from 'react';
import { generateBotTeam } from '@shared/game/gameEngine';
import { simulateMatch } from '@shared/game/engine/matchSim';
import type { MatchResult, Team } from '@shared/game/engine/teamModel';
import { seededRandom, withRandomSource } from '@shared/game/random';
import { GameContext, type GameContextType } from '../../contexts/game/provider';
import MatchSimPage from '../MatchSimPage';
import { allowsAssist } from '@shared/game/playVariants';
import { forcedLance } from './forcedPlay';

function pickMatch(penalties: boolean): { home: Team; away: Team; result: MatchResult } {
  for (let seed = 1; seed < 500; seed++) {
    const match = withRandomSource(seededRandom(seed), () => {
      const home = generateBotTeam('Meu Time', 0.9);
      const away = generateBotTeam('Adversário', 0.9);
      return { home, away, result: simulateMatch(home, away, penalties, false) };
    });
    if (!penalties || (match.result.penaltyKicks?.length ?? 0) > 0) return match;
  }
  throw new Error('no match found');
}

export default function MatchHarnessPage({ penalties }: { penalties: boolean }) {
  const value = useMemo(() => {
    const { home, away, result } = pickMatch(penalties);
    // A forced lance (#partida?lance=kind/variant/finish): the match's first shot with that
    // outcome is played as that kind of play (and without an assist when it allows none).
    const lance = forcedLance();
    if (lance) {
      const shot = result.events.find(e => e.type === lance.outcome && e.play);
      if (shot?.play) {
        shot.play = { ...shot.play, kind: lance.kind };
        if (!allowsAssist(lance.kind, lance.variant)) shot.assisterId = undefined;
        console.info('[harness] lance forçado no minuto', shot.minute, lance);
      }
    }
    const state = {
      currentMatchTeams: [home, away],
      currentMatchResult: result,
      mode: 'solo',
      playerTeam: home,
      activeKnockoutMatch: penalties ? { round: 'quarter', leg: 1 } : null,
      spectating: false,
    };
    const log = (name: string) => (...args: unknown[]) => console.info('[harness]', name, ...args);
    return new Proxy({ state, dispatch: log('dispatch'), notifyMatchWatchedOnline: log('notify') }, {
      get: (target, key: string) => (key in target ? target[key as keyof typeof target] : log(key)),
    }) as unknown as GameContextType;
  }, [penalties]);
  return (
    <GameContext.Provider value={value}>
      <MatchSimPage />
    </GameContext.Provider>
  );
}
