import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shirt, Eye, Play, Pause, SkipForward, Brain } from 'lucide-react';
import TacticSelector from '../components/game/TacticSelector';
import { getTacticById } from '../lib/gameData';
import { useGame } from '../contexts/GameContext';
import {
  Team, MatchResult, MatchEvent, simulateMatch,
  getEffectiveAttribute, calculateTeamStrength, getChemistryBonus,
  PlayerCard as EnginePlayerCard, PlayerMatchStat, simulateRemainingMatch, pickWeightedAssister,
  getPenaltyTaker, getPenaltyOrder, setStatIds, statKey,
  teamMidfieldPassing, midfieldBuildUpEdge, getFreeKickTaker, getHeaderTarget, resolveOpenPlayChance, buildKeyMinutes,
  formationProfile, tacticProfile, MATCH_NOISE, HOME_ADVANTAGE, captainBestStat, CAPTAIN_BOOST,
} from '../lib/gameEngine';

// Captain leadership context: their best stat is lifted +CAPTAIN_BOOST for the whole side.
const captainBoostCtx = (team: Team) => {
  const s = captainBestStat(team);
  return s ? { stat: s as string, amount: CAPTAIN_BOOST } : undefined;
};
import { getGoalkeeperTraitBonus, getPenaltyComposureBonus } from '../lib/traits';
import {
  selectApproach, buildUpDesc, goalDesc, ownGoalDesc, saveDesc, missDesc, duelDesc,
  frangoDesc, screamedDesc, deflectedDesc, woodworkDesc,
  penaltyGoalDesc, penaltySaveDesc, penaltyMissDesc,
  freeKickGoalDesc, freeKickSaveDesc, freeKickMissDesc,
  cornerGoalDesc, cornerSaveDesc, cornerMissDesc,
  flowDesc, dangerStage1Msg, celebrationMsg, saveCelebMsg, missCelebMsg, tackleCelebMsg,
  Approach,
} from '../lib/matchNarrative';
import { COACHES, FORMATIONS, getRarityColor, POS_PT } from '../lib/gameData';
import PlayerCard, { buildSofifaUrl } from '../components/game/PlayerCard';

const posLabel = (pos: string) => POS_PT[pos] ?? pos;

// Event descriptions already start with an emoji (⚽ GOL!, 🧤 DEFENDEU!…). The feed
// also renders a type-icon badge next to them, so strip the leading emoji from the
// text to avoid showing it twice (e.g. "⚽ ⚽ GOL CONTRA!").
const stripLeadingEmoji = (s: string) =>
  s.replace(/^[\s☀-➿⬀-⯿️‍\uD800-\uDFFF]+/, '');


export default function MatchSimPage() {
  const {
    state,
    dispatch,
    notifyMatchWatchedOnline,
  } = useGame();
  const { currentMatchTeams, activeKnockoutMatch } = state;

  if (!currentMatchTeams) return null;
  const [initialHome, initialAway] = currentMatchTeams;

  const playerTeamId = state.playerTeam?.id;
  const isPlayerHome = initialHome.id === playerTeamId;

  // REPLAY MODE: when a pre-computed authoritative result is set, we do NOT
  // simulate locally — we replay its event timeline so the final score and stats
  // are identical on every device. Used by ONLINE matches and by ALL knockout
  // ties (online + solo, since two-legged aggregate ties are engine-decided).
  const replayResult = state.currentMatchResult;
  const isReplay = !!replayResult;

  // Two-legged context (for the aggregate banner during a second leg).
  const legNumber = activeKnockoutMatch?.leg;
  const firstLeg = activeKnockoutMatch?.firstLeg;

  // Local-sim control flag (kept for compatibility): always true now, except we
  // gate the local simulation clock off entirely while replaying.
  const isSimulatorHost = true;

  // Online = "broadcast ao vivo": runs at a single fixed pace for everyone, no
  // pause / speed / skip controls (keeps every screen synchronized & spoiler-free).
  // Solo keeps the full manual controls.
  const broadcastMode = state.mode === 'online';

  const isKnockout = !!activeKnockoutMatch;
  const isFinal = activeKnockoutMatch?.round === 'final';

  // 1. Stateful teams to track substitutions, cards
  const [homeTeam, setHomeTeam] = useState<Team>(() => ({ ...initialHome }));
  const [awayTeam, setAwayTeam] = useState<Team>(() => ({ ...initialAway }));

  // 2. Real-time simulation state variables
  const [minute, setMinute] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [momentum, setMomentum] = useState(50); // 0 (away dominance) to 100 (home dominance)
  const [momentumHistory, setMomentumHistory] = useState<number[]>([50]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(2); // Multipliers
  const [isFinished, setIsFinished] = useState(false);
  const [goalAlert, setGoalAlert] = useState<{ teamName: string; scorer: string } | null>(null);

  // Dynamic player ratings and match statistics: single source of truth
  const [playerMatchStats, setPlayerMatchStats] = useState<Record<string, PlayerMatchStat>>(() => {
    // Stamp per-instance stat keys so a player who happens to be on BOTH teams
    // (the pool is smaller than 36×11) gets separate stats per side.
    setStatIds(initialHome, initialAway);
    // In replay mode, show the authoritative final ratings from the server result
    // (already keyed by teamId::playerId by the engine).
    if (isReplay && replayResult?.playerStats) {
      return { ...replayResult.playerStats };
    }
    const initial: Record<string, PlayerMatchStat> = {};
    const initStatsForTeam = (team: Team) => {
      team.players.slice(0, 11).forEach(p => {
        initial[p.statId!] = {
          playerId: p.id,
          playerName: p.shortName,
          teamId: team.id,
          rating: 6.4,
          goals: 0,
          assists: 0,
          shots: 0,
          tackles: 0,
          saves: 0,
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          keyPasses: 0,
          interceptions: 0,
          shotsOnTarget: 0,
        };
      });
    };
    initStatsForTeam(initialHome);
    initStatsForTeam(initialAway);
    return initial;
  });

  const adjustPlayerStat = (playerId: string, callback: (stat: PlayerMatchStat) => void) => {
    setPlayerMatchStats(prev => {
      const current = prev[playerId];
      if (!current) return prev;
      const copy = { ...current };
      callback(copy);
      copy.rating = Math.min(10.0, Math.max(3.0, copy.rating));
      copy.rating = parseFloat(copy.rating.toFixed(1));
      return { ...prev, [playerId]: copy };
    });
  };

  // Substitutions removed — apenas 11 titulares
  const [squadModal, setSquadModal] = useState<'mine' | 'opponent' | null>(null);
  // Live tactic change (solo only): switch your team's mentality mid-match.
  const [showTactics, setShowTactics] = useState(false);

  // Suspense-based Key Attack Danger state
  const [dangerState, setDangerState] = useState<{
    stage: number;
    teamId: string;
    attacker: string;
    defender: string;
    type: string;
    message: string;
    approach?: Approach;
    buildUp?: string;
  } | null>(null);

  const pendingGoalResult = useRef<any>(null);
  const pendingReplayGoals = useRef<any>(null); // buffered goal events for replay danger sequence
  const keyMinutesRef = useRef<number[] | null>(null); // jittered key-event minutes for THIS match

  // Interactive Penalty Shootout state
  const [penaltyMode, setPenaltyMode] = useState(false);
  const [penaltiesHome, setPenaltiesHome] = useState<boolean[]>([]);
  const [penaltiesAway, setPenaltiesAway] = useState<boolean[]>([]);
  const [penaltyHomeScore, setPenaltyHomeScore] = useState(0);
  const [penaltyAwayScore, setPenaltyAwayScore] = useState(0);
  const [penaltyCommentary, setPenaltyCommentary] = useState('A disputa de pênaltis vai começar! Escolha o próximo batedor.');
  const [penaltyWinner, setPenaltyWinner] = useState<string | null>(null);
  // Replay-mode kick-by-kick index (-1 = not in replay penalty mode)
  const [penaltyReplayIdx, setPenaltyReplayIdx] = useState(-1);
  // Team currently stepping up (build-up phase) — drives the overlay's "a cobrar" glow.
  const [penaltyKickPending, setPenaltyKickPending] = useState<string | null>(null);

  // Stats accumulator (progressive)
  const [stats, setStats] = useState<MatchResult['stats']>({
    homePos: 50, awayPos: 50,
    homeShots: 0, awayShots: 0,
    homeShotsOnTarget: 0, awayShotsOnTarget: 0,
    homeFouls: 0, awayFouls: 0,
    homeSaves: 0, awaySaves: 0,
    homeCorners: 0, awayCorners: 0,
  });

  const myTeam = isPlayerHome ? homeTeam : awayTeam;
  const oppTeam = isPlayerHome ? awayTeam : homeTeam;
  const setMyTeam = isPlayerHome ? setHomeTeam : setAwayTeam;
  const setOppTeam = isPlayerHome ? setAwayTeam : setHomeTeam;

  // NOTE: Spectator mode and match event streaming have been removed.
  // Each player now simulates their own match independently.

  const renderSquadRow = (p: EnginePlayerCard, rating: number, goals = 0, assists = 0) => {
    const rColor = rating >= 8.5 ? '#d4af37' : rating >= 7.5 ? '#22c55e' : rating <= 5.3 ? '#ef4444' : '#ffffff';
    const ringColor = getRarityColor(p.rarity);
    const photoUrl = buildSofifaUrl(p.id, 120);
    return (
      <div
        key={p.id}
        className="flex items-center justify-between p-2 rounded-xl border"
        style={{ background: '#08080f', borderColor: '#171725' }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Player photo with rarity ring */}
          <div
            className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ background: '#10101d', border: `1.5px solid ${ringColor}` }}
          >
            {photoUrl
              ? <img src={photoUrl} alt={p.shortName} referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ objectPosition: 'center top', scale: '1.25' }} />
              : <span className="text-[10px] font-black" style={{ color: ringColor, fontFamily: 'Rajdhani, sans-serif' }}>{posLabel(p.position)}</span>}
          </div>
          <span className="text-[10px] font-black w-6 text-center rounded px-1 flex-shrink-0" style={{ background: '#171725', color: '#c9a84c', fontFamily: 'Rajdhani, sans-serif' }}>
            {posLabel(p.position)}
          </span>
          <span className="text-sm font-bold text-white truncate" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            {p.shortName}
          </span>
          {/* Goal / assist markers */}
          {goals > 0 && (
            <span className="text-[11px] flex-shrink-0" title={`${goals} gol(s)`}>
              {goals > 1 ? `⚽×${goals}` : '⚽'}
            </span>
          )}
          {assists > 0 && (
            <span className="text-[10px] flex-shrink-0 font-black" style={{ color: '#60a5fa', fontFamily: 'Rajdhani, sans-serif' }} title={`${assists} assistência(s)`}>
              {assists > 1 ? `🅰×${assists}` : '🅰'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-black px-2 py-0.5 rounded-lg border text-center min-w-[36px]" style={{ background: '#1a1a2e', color: rColor, borderColor: '#1f1f3b', fontFamily: 'Rajdhani, sans-serif' }}>
            {rating.toFixed(1)}
          </span>
        </div>
      </div>
    );
  };


  const eventFeedRef = useRef<HTMLDivElement>(null);

  // Time tick speed
  const getTickDuration = () => {
    if (broadcastMode) return 250; // fixed live-broadcast pace online (≈4x, same for all)
    if (speed === 1) return 1000;
    if (speed === 2) return 500;
    return 250;
  };



  // Helper helper to adjust stats
  const incrementStat = (key: keyof MatchResult['stats']) => {
    setStats(prev => ({ ...prev, [key]: prev[key] + 1 }));
  };

  const simulateKeyEvent = (nextMin: number, homeAttacks: boolean) => {
    const attackTeam = homeAttacks ? homeTeam : awayTeam;
    const defendTeam = homeAttacks ? awayTeam : homeTeam;

    const homeCoach = COACHES.find(c => c.id === homeTeam.coachId)!;
    const awayCoach = COACHES.find(c => c.id === awayTeam.coachId)!;
    const homeChem = getChemistryBonus(homeTeam.totalChemistry);
    const awayChem = getChemistryBonus(awayTeam.totalChemistry);
    const attackCoach = homeAttacks ? homeCoach : awayCoach;
    const defendCoach = homeAttacks ? awayCoach : homeCoach;
    const attackChem = homeAttacks ? homeChem : awayChem;
    const defendChem = homeAttacks ? awayChem : homeChem;

    const attackers = attackTeam.players.slice(0, 11).filter(p =>
      ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(p.position)
    );
    const defenders = defendTeam.players.slice(0, 11).filter(p =>
      ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.position)
    );

    const attacker = attackers[Math.floor(Math.random() * attackers.length)] || attackTeam.players[10];
    const defender = defenders[Math.floor(Math.random() * defenders.length)] || defendTeam.players[0];
    const gk = defendTeam.players.find(p => p.position === 'GK') || defendTeam.players[0];

    const widePlayer = attackTeam.players.slice(0, 11).find(p =>
      ['LW', 'RW', 'LM', 'RM'].includes(p.position)
    ) || attackTeam.players.slice(0, 11).find(p =>
      ['CAM', 'CM'].includes(p.position)
    ) || attacker;

    const homeIsLosing = homeScore < awayScore;
    const awayIsLosing = awayScore < homeScore;
    const attackIsLosing = homeAttacks ? homeIsLosing : awayIsLosing;
    const defendIsLosing = homeAttacks ? awayIsLosing : homeIsLosing;
    const attackCtx = { isKnockout, isFinal, isLosing: attackIsLosing, captainBoost: captainBoostCtx(attackTeam) };
    const defendCtx = { isKnockout, isFinal, isLosing: defendIsLosing, captainBoost: captainBoostCtx(defendTeam) };

    const atkProf = formationProfile(attackTeam.formationId);
    const defProf = formationProfile(defendTeam.formationId);
    let approach = selectApproach(attackTeam.playStyle ?? 'balanced');
    // Narrow formations cross less → swap some crosses for central through-balls.
    if (atkProf.cross <= -2 && approach === 'cross' && Math.random() < 0.6) approach = 'through';
    const bUpMsg = buildUpDesc(approach, attacker.shortName, defender.shortName, widePlayer.shortName, attackTeam.name);

    let isGoal = false;
    let isSaveResult = false;
    let homeScoreDelta = 0;
    let awayScoreDelta = 0;
    let goalAlert: { teamName: string; scorer: string } | undefined;
    let momentumShift = 0;
    const playerStatUpdates: { statKey: string; updateFn: (s: PlayerMatchStat) => void }[] = [];
    const statIncrements: (keyof MatchResult['stats'])[] = [];
    const eventsToPush: MatchEvent[] = [];
    let messageStage3 = "";

    const isLuckEvent = Math.random() < 0.04;

    if (isLuckEvent) {
      const randLuck = Math.random();

      if (randLuck < 0.15) {
        isGoal = true;
        if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
        const newHG = homeScore + (homeAttacks ? 1 : 0);
        const newAG = awayScore + (homeAttacks ? 0 : 1);
        goalAlert = { teamName: attackTeam.name, scorer: 'Gol Contra' };
        playerStatUpdates.push({ statKey: defender.statId!, updateFn: s => { s.rating -= 0.8; } });
        eventsToPush.push({
          minute: nextMin, type: 'goal',
          description: ownGoalDesc(defender.shortName, gk.shortName),
          teamId: attackTeam.id, opponentId: defender.id,
        });
        momentumShift = homeAttacks ? 15 : -15;
        messageStage3 = `⚽ GOL DO ${attackTeam.name.toUpperCase()}! ${defender.shortName} faz gol contra! ${newHG}-${newAG}`;
      } else if (randLuck < 0.30) {
        isGoal = true;
        if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
        const newHG = homeScore + (homeAttacks ? 1 : 0);
        const newAG = awayScore + (homeAttacks ? 0 : 1);
        goalAlert = { teamName: attackTeam.name, scorer: attacker.shortName };
        playerStatUpdates.push(
          { statKey: attacker.statId!, updateFn: s => { s.goals++; s.rating += 1.2; } },
          { statKey: gk.statId!, updateFn: s => { s.rating -= 1.0; } }
        );
        eventsToPush.push({
          minute: nextMin, type: 'goal',
          description: frangoDesc(attacker.shortName, gk.shortName),
          teamId: attackTeam.id, playerId: attacker.id, opponentId: gk.id,
        });
        momentumShift = homeAttacks ? 15 : -15;
        messageStage3 = `⚽ GOOOOOOL DO ${attackTeam.name.toUpperCase()}! Frangaço de ${gk.shortName}! ${newHG}-${newAG}`;
      } else if (randLuck < 0.50) {
        isGoal = true;
        if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
        const newHG = homeScore + (homeAttacks ? 1 : 0);
        const newAG = awayScore + (homeAttacks ? 0 : 1);
        goalAlert = { teamName: attackTeam.name, scorer: attacker.shortName };
        playerStatUpdates.push(
          { statKey: attacker.statId!, updateFn: s => { s.goals++; s.rating += 1.2; } },
          { statKey: defender.statId!, updateFn: s => { s.rating -= 0.3; } }
        );
        eventsToPush.push({
          minute: nextMin, type: 'goal',
          description: deflectedDesc(attacker.shortName, defender.shortName),
          teamId: attackTeam.id, playerId: attacker.id, opponentId: defender.id,
        });
        momentumShift = homeAttacks ? 15 : -15;
        messageStage3 = `⚽ GOOOOOOL DO ${attackTeam.name.toUpperCase()}! Desvio fatal! ${newHG}-${newAG}`;
      } else if (randLuck < 0.68) {
        isGoal = true;
        if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
        const newHG = homeScore + (homeAttacks ? 1 : 0);
        const newAG = awayScore + (homeAttacks ? 0 : 1);
        goalAlert = { teamName: attackTeam.name, scorer: attacker.shortName };
        playerStatUpdates.push({ statKey: attacker.statId!, updateFn: s => { s.goals++; s.rating += 1.6; } });
        eventsToPush.push({
          minute: nextMin, type: 'goal',
          description: screamedDesc(attacker.shortName, gk.shortName),
          teamId: attackTeam.id, playerId: attacker.id, opponentId: gk.id, isSpecial: true,
        });
        momentumShift = homeAttacks ? 20 : -20;
        messageStage3 = `⚽ GOLAÇO DO ${attackTeam.name.toUpperCase()}! Que míssil de ${attacker.shortName}! ${newHG}-${newAG}`;
      } else if (randLuck < 0.86) {
        const taker = getPenaltyTaker(attackTeam);
        const isPenaltyGoal = Math.random() < 0.76;
        if (isPenaltyGoal) {
          isGoal = true;
          if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
          const newHG = homeScore + (homeAttacks ? 1 : 0);
          const newAG = awayScore + (homeAttacks ? 0 : 1);
          goalAlert = { teamName: attackTeam.name, scorer: taker.shortName };
          playerStatUpdates.push(
            { statKey: taker.statId!, updateFn: s => { s.goals++; s.rating += 1.0; } },
            { statKey: defender.statId!, updateFn: s => { s.rating -= 0.2; } }
          );
          eventsToPush.push({
            minute: nextMin, type: 'goal',
            description: penaltyGoalDesc(taker.shortName, attacker.shortName, defender.shortName, gk.shortName),
            teamId: attackTeam.id, playerId: taker.id, opponentId: gk.id,
          });
          momentumShift = homeAttacks ? 15 : -15;
          messageStage3 = `⚽ GOOOOOOL DO ${attackTeam.name.toUpperCase()}! Pênalti convertido! ${newHG}-${newAG}`;
        } else {
          const isSaved = Math.random() < 0.5;
          if (isSaved) {
            isSaveResult = true;
            statIncrements.push(homeAttacks ? 'awaySaves' : 'homeSaves');
            playerStatUpdates.push(
              { statKey: gk.statId!, updateFn: s => { s.saves++; s.rating += 0.8; } },
              { statKey: taker.statId!, updateFn: s => { s.rating -= 0.5; } }
            );
            eventsToPush.push({
              minute: nextMin, type: 'save',
              description: penaltySaveDesc(gk.shortName, taker.shortName),
              teamId: defendTeam.id, playerId: gk.id, opponentId: taker.id,
            });
            momentumShift = homeAttacks ? -8 : 8;
            messageStage3 = saveCelebMsg(gk.shortName, taker.shortName);
          } else {
            playerStatUpdates.push({ statKey: taker.statId!, updateFn: s => { s.rating -= 0.6; } });
            eventsToPush.push({
              minute: nextMin, type: 'miss',
              description: penaltyMissDesc(taker.shortName),
              teamId: attackTeam.id, playerId: taker.id,
            });
            momentumShift = homeAttacks ? -8 : 8;
            messageStage3 = missCelebMsg(taker.shortName);
          }
        }
      } else {
        playerStatUpdates.push({ statKey: attacker.statId!, updateFn: s => { s.shots++; s.rating += 0.1; } });
        eventsToPush.push({
          minute: nextMin, type: 'miss',
          description: woodworkDesc(attacker.shortName, defender.shortName),
          teamId: attackTeam.id, playerId: attacker.id,
        });
        momentumShift = homeAttacks ? 4 : -4;
        messageStage3 = `💥 NA TRAVE! Que azar de ${attacker.shortName}!`;
      }
    } else {
      // Push build-up commentary before the resolution event
      eventsToPush.push({
        minute: nextMin, type: 'momentum',
        description: bUpMsg,
        teamId: attackTeam.id,
      });

      const atkShooting = getEffectiveAttribute(attacker, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle ?? 'balanced', attackCtx);
      const atkPace = getEffectiveAttribute(attacker, 'pace', attackCoach, 'Criação', attackChem, attackTeam.playStyle ?? 'balanced', attackCtx);
      const atkDribbling = getEffectiveAttribute(attacker, 'dribbling', attackCoach, 'Criação', attackChem, attackTeam.playStyle ?? 'balanced', attackCtx);
      const defDefending = getEffectiveAttribute(defender, 'defending', defendCoach, 'Defesa', defendChem, defendTeam.playStyle ?? 'balanced', defendCtx);
      const defPhysical = getEffectiveAttribute(defender, 'physical', defendCoach, 'Defesa', defendChem, defendTeam.playStyle ?? 'balanced', defendCtx);

      // Trait effects are already baked into the effective attributes above
      // (getEffectiveAttribute + trait catalog), so no extra bonuses here.
      // Midfield control (passing) lifts the quality of the chance created.
      // Formation + tactic tune chance quality (midfield battle + opponent solidity).
      const atkTac = tacticProfile(attackTeam.playStyle ?? 'balanced');
      const defTac = tacticProfile(defendTeam.playStyle ?? 'balanced');
      const formMod = ((atkProf.control + atkTac.control) - (defProf.control + defTac.control)) * 1.2
        + atkTac.attack * 1.6
        - (defProf.defense + defTac.defense) * 2.2;
      const buildUp = midfieldBuildUpEdge(teamMidfieldPassing(attackTeam), teamMidfieldPassing(defendTeam), attackTeam.playStyle ?? 'balanced') + formMod;
      const chance = resolveOpenPlayChance({
        atkShooting, atkPace, atkDribbling, defDefending, defPhysical, buildUp,
        gkRating: gk.defending + getGoalkeeperTraitBonus(gk.traits), approach,
      });

      if (chance.outcome !== 'duel') {
        statIncrements.push(homeAttacks ? 'homeShots' : 'awayShots');

        if (chance.outcome !== 'miss') {
          statIncrements.push(homeAttacks ? 'homeShotsOnTarget' : 'awayShotsOnTarget');

          if (chance.outcome === 'goal') {
            isGoal = true;
            if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
            const newHG = homeScore + (homeAttacks ? 1 : 0);
            const newAG = awayScore + (homeAttacks ? 0 : 1);
            goalAlert = { teamName: attackTeam.name, scorer: attacker.shortName };

            const assister = pickWeightedAssister(attackTeam, attacker.id);
            const isImmortal = attacker.rarity === 'immortal';
            if (assister) {
              playerStatUpdates.push({ statKey: assister.statId!, updateFn: s => { s.assists++; s.rating += 0.8; } });
            }

            const atkGoals = homeAttacks ? newHG : newAG;
            const defGoals = homeAttacks ? newAG : newHG;

            eventsToPush.push({
              minute: nextMin, type: 'goal',
              description: goalDesc(approach, attacker.shortName, assister?.shortName ?? null, defender.shortName, gk.shortName, newHG, newAG, nextMin, atkGoals, defGoals, isImmortal),
              teamId: attackTeam.id, playerId: attacker.id, opponentId: defender.id,
              assisterId: assister?.id,
              isSpecial: isImmortal || attacker.traits.includes('Frio na Final'),
            });

            playerStatUpdates.push(
              { statKey: attacker.statId!, updateFn: s => { s.goals++; s.shotsOnTarget++; s.rating += 1.4; } },
              { statKey: gk.statId!, updateFn: s => { s.rating -= 0.3; } },
              { statKey: defender.statId!, updateFn: s => { s.rating -= 0.2; } }
            );
            defendTeam.players.slice(0, 11).forEach(p => {
              if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && p.id !== defender.id) {
                playerStatUpdates.push({ statKey: p.statId!, updateFn: s => { s.rating -= 0.1; } });
              }
            });

            momentumShift = homeAttacks ? 15 : -15;
            messageStage3 = celebrationMsg(approach, attackTeam.name, attacker.shortName, newHG, newAG);
          } else {
            isSaveResult = true;
            statIncrements.push(homeAttacks ? 'awaySaves' : 'homeSaves');

            const isCorner = Math.random() < 0.45;
            if (isCorner) statIncrements.push(homeAttacks ? 'homeCorners' : 'awayCorners');

            eventsToPush.push({
              minute: nextMin, type: 'save',
              description: saveDesc(approach, gk.shortName, attacker.shortName, isCorner),
              teamId: defendTeam.id, playerId: gk.id, opponentId: attacker.id,
            });
            playerStatUpdates.push(
              { statKey: gk.statId!, updateFn: s => { s.saves++; s.rating += 0.45; } },
              { statKey: attacker.statId!, updateFn: s => { s.shotsOnTarget++; s.rating += 0.05; } }
            );
            const saveCreator = pickWeightedAssister(attackTeam, attacker.id);
            if (saveCreator) playerStatUpdates.push({ statKey: saveCreator.statId!, updateFn: s => { s.keyPasses++; s.rating += 0.25; } });
            momentumShift = homeAttacks ? -8 : 8;
            messageStage3 = saveCelebMsg(gk.shortName, attacker.shortName);
          }
        } else {
          eventsToPush.push({
            minute: nextMin, type: 'miss',
            description: missDesc(approach, attacker.shortName, defender.shortName, gk.shortName),
            teamId: attackTeam.id, playerId: attacker.id,
          });
          playerStatUpdates.push({ statKey: attacker.statId!, updateFn: s => { s.shots++; s.rating -= 0.1; } });
          const missCreator = pickWeightedAssister(attackTeam, attacker.id);
          if (missCreator) playerStatUpdates.push({ statKey: missCreator.statId!, updateFn: s => { s.keyPasses++; s.rating += 0.15; } });
          momentumShift = homeAttacks ? -3 : 3;
          messageStage3 = missCelebMsg(attacker.shortName);
        }
      } else {
        const duelTackle = Math.random() < 0.5;
        playerStatUpdates.push(
          { statKey: defender.statId!, updateFn: s => { if (duelTackle) s.tackles++; else s.interceptions++; s.rating += 0.32; } },
          { statKey: attacker.statId!, updateFn: s => { s.rating -= 0.12; } }
        );
        eventsToPush.push({
          minute: nextMin, type: 'duel',
          description: duelDesc(approach, defender.shortName, attacker.shortName),
          teamId: defendTeam.id, playerId: defender.id, opponentId: attacker.id,
        });
        momentumShift = homeAttacks ? -5 : 5;
        messageStage3 = tackleCelebMsg(defender.shortName, attacker.shortName);
      }
    }

    return {
      isGoal,
      isSaveResult,
      homeScoreDelta,
      awayScoreDelta,
      goalAlert,
      momentumShift,
      playerStatUpdates,
      statIncrements,
      eventsToPush,
      messageStage3,
      attackerName: attacker.shortName,
      defenderName: defender.shortName,
      gkName: gk.shortName,
      approach,
      buildUpMsg: bUpMsg,
      attackTeamId: attackTeam.id,
    };
  };

  // Direct free kick — a fraction of fouls become a dangerous dead ball. Returns the
  // SAME result shape as simulateKeyEvent so it flows through the 3-stage suspense.
  // Conversion is low (free kicks rarely go in), scaled by the taker's shooting+composure.
  const simulateFreeKick = (nextMin: number, homeAttacks: boolean) => {
    const attackTeam = homeAttacks ? homeTeam : awayTeam;
    const defendTeam = homeAttacks ? awayTeam : homeTeam;
    const homeCoach = COACHES.find(c => c.id === homeTeam.coachId)!;
    const awayCoach = COACHES.find(c => c.id === awayTeam.coachId)!;
    const attackCoach = homeAttacks ? homeCoach : awayCoach;
    const attackChem = getChemistryBonus(attackTeam.totalChemistry);
    const attackCtx = { isKnockout, isFinal, isLosing: homeAttacks ? homeScore < awayScore : awayScore < homeScore, captainBoost: captainBoostCtx(attackTeam) };

    const taker = getFreeKickTaker(attackTeam);
    const gk = defendTeam.players.find(p => p.position === 'GK') || defendTeam.players[0];
    const takerShoot = getEffectiveAttribute(taker, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle ?? 'balanced', attackCtx);
    const skill = (takerShoot + taker.composure) / 2;
    const goalChance = Math.max(0.015, Math.min(0.11, (skill - 80) / 140));
    const r = Math.random();

    let isGoal = false, isSaveResult = false, homeScoreDelta = 0, awayScoreDelta = 0;
    let goalAlert: { teamName: string; scorer: string } | undefined;
    let momentumShift = 0;
    const playerStatUpdates: { statKey: string; updateFn: (s: PlayerMatchStat) => void }[] = [];
    const statIncrements: (keyof MatchResult['stats'])[] = [];
    const eventsToPush: MatchEvent[] = [];
    let messageStage3 = '';

    statIncrements.push(homeAttacks ? 'homeShots' : 'awayShots');

    if (r < goalChance) {
      isGoal = true;
      if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
      statIncrements.push(homeAttacks ? 'homeShotsOnTarget' : 'awayShotsOnTarget');
      const newHG = homeScore + (homeAttacks ? 1 : 0);
      const newAG = awayScore + (homeAttacks ? 0 : 1);
      goalAlert = { teamName: attackTeam.name, scorer: taker.shortName };
      playerStatUpdates.push(
        { statKey: taker.statId!, updateFn: s => { s.goals++; s.rating += 1.5; } },
        { statKey: gk.statId!, updateFn: s => { s.rating -= 0.3; } },
      );
      eventsToPush.push({ minute: nextMin, type: 'goal', description: freeKickGoalDesc(taker.shortName, gk.shortName), teamId: attackTeam.id, playerId: taker.id, opponentId: gk.id, isSpecial: true });
      momentumShift = homeAttacks ? 15 : -15;
      messageStage3 = `⚽ GOLAÇO DE FALTA DO ${attackTeam.name.toUpperCase()}! ${taker.shortName} marca! ${newHG}-${newAG}`;
    } else if (r < goalChance + 0.35) {
      isSaveResult = true;
      statIncrements.push(homeAttacks ? 'homeShotsOnTarget' : 'awayShotsOnTarget', homeAttacks ? 'awaySaves' : 'homeSaves');
      playerStatUpdates.push({ statKey: gk.statId!, updateFn: s => { s.saves++; s.rating += 0.5; } });
      eventsToPush.push({ minute: nextMin, type: 'save', description: freeKickSaveDesc(gk.shortName, taker.shortName), teamId: defendTeam.id, playerId: gk.id, opponentId: taker.id });
      momentumShift = homeAttacks ? -6 : 6;
      messageStage3 = saveCelebMsg(gk.shortName, taker.shortName);
    } else {
      playerStatUpdates.push({ statKey: taker.statId!, updateFn: s => { s.rating -= 0.1; } });
      eventsToPush.push({ minute: nextMin, type: 'miss', description: freeKickMissDesc(taker.shortName), teamId: attackTeam.id, playerId: taker.id });
      momentumShift = homeAttacks ? -3 : 3;
      messageStage3 = missCelebMsg(taker.shortName);
    }

    return {
      isGoal, isSaveResult, homeScoreDelta, awayScoreDelta, goalAlert, momentumShift,
      playerStatUpdates, statIncrements, eventsToPush, messageStage3,
      attackerName: taker.shortName, defenderName: gk.shortName, gkName: gk.shortName,
      approach: 'longrange' as Approach,
      buildUpMsg: `⚠️ FALTA PERIGOSA! ${taker.shortName} ajeita a bola para a cobrança direta...`,
      attackTeamId: attackTeam.id,
    };
  };

  // Corner header — a fraction of corners become an aerial chance. Same result shape
  // as simulateKeyEvent so it flows through the 3-stage suspense.
  const simulateCornerHeader = (nextMin: number, homeAttacks: boolean) => {
    const attackTeam = homeAttacks ? homeTeam : awayTeam;
    const defendTeam = homeAttacks ? awayTeam : homeTeam;
    const homeCoach = COACHES.find(c => c.id === homeTeam.coachId)!;
    const awayCoach = COACHES.find(c => c.id === awayTeam.coachId)!;
    const attackCoach = homeAttacks ? homeCoach : awayCoach;
    const attackChem = getChemistryBonus(attackTeam.totalChemistry);
    const attackCtx = { isKnockout, isFinal, isLosing: homeAttacks ? homeScore < awayScore : awayScore < homeScore, captainBoost: captainBoostCtx(attackTeam) };

    const header = getHeaderTarget(attackTeam);
    const gk = defendTeam.players.find(p => p.position === 'GK') || defendTeam.players[0];
    const hSkill = (getEffectiveAttribute(header, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle ?? 'balanced', attackCtx) + header.physical) / 2;
    const goalChance = Math.max(0.04, Math.min(0.20, (hSkill - 74) / 95));
    const r = Math.random();

    let isGoal = false, isSaveResult = false, homeScoreDelta = 0, awayScoreDelta = 0;
    let goalAlert: { teamName: string; scorer: string } | undefined;
    let momentumShift = 0;
    const playerStatUpdates: { statKey: string; updateFn: (s: PlayerMatchStat) => void }[] = [];
    const statIncrements: (keyof MatchResult['stats'])[] = [];
    const eventsToPush: MatchEvent[] = [];
    let messageStage3 = '';

    statIncrements.push(homeAttacks ? 'homeShots' : 'awayShots');

    if (r < goalChance) {
      isGoal = true;
      if (homeAttacks) homeScoreDelta = 1; else awayScoreDelta = 1;
      statIncrements.push(homeAttacks ? 'homeShotsOnTarget' : 'awayShotsOnTarget');
      const newHG = homeScore + (homeAttacks ? 1 : 0);
      const newAG = awayScore + (homeAttacks ? 0 : 1);
      goalAlert = { teamName: attackTeam.name, scorer: header.shortName };
      const assister = pickWeightedAssister(attackTeam, header.id);
      playerStatUpdates.push(
        { statKey: header.statId!, updateFn: s => { s.goals++; s.rating += 1.4; } },
        { statKey: gk.statId!, updateFn: s => { s.rating -= 0.3; } },
      );
      if (assister) playerStatUpdates.push({ statKey: assister.statId!, updateFn: s => { s.assists++; s.rating += 0.7; } });
      eventsToPush.push({ minute: nextMin, type: 'goal', description: cornerGoalDesc(header.shortName, gk.shortName), teamId: attackTeam.id, playerId: header.id, opponentId: gk.id, assisterId: assister?.id, isSpecial: true });
      momentumShift = homeAttacks ? 15 : -15;
      messageStage3 = `⚽ GOL DE CABEÇA DO ${attackTeam.name.toUpperCase()}! ${header.shortName} marca no escanteio! ${newHG}-${newAG}`;
    } else if (r < goalChance + 0.40) {
      isSaveResult = true;
      statIncrements.push(homeAttacks ? 'homeShotsOnTarget' : 'awayShotsOnTarget', homeAttacks ? 'awaySaves' : 'homeSaves');
      playerStatUpdates.push({ statKey: gk.statId!, updateFn: s => { s.saves++; s.rating += 0.5; } });
      eventsToPush.push({ minute: nextMin, type: 'save', description: cornerSaveDesc(gk.shortName, header.shortName), teamId: defendTeam.id, playerId: gk.id, opponentId: header.id });
      momentumShift = homeAttacks ? -6 : 6;
      messageStage3 = saveCelebMsg(gk.shortName, header.shortName);
    } else {
      playerStatUpdates.push({ statKey: header.statId!, updateFn: s => { s.rating -= 0.1; } });
      eventsToPush.push({ minute: nextMin, type: 'miss', description: cornerMissDesc(header.shortName), teamId: attackTeam.id, playerId: header.id });
      momentumShift = homeAttacks ? -3 : 3;
      messageStage3 = missCelebMsg(header.shortName);
    }

    return {
      isGoal, isSaveResult, homeScoreDelta, awayScoreDelta, goalAlert, momentumShift,
      playerStatUpdates, statIncrements, eventsToPush, messageStage3,
      attackerName: header.shortName, defenderName: gk.shortName, gkName: gk.shortName,
      approach: 'cross' as Approach,
      buildUpMsg: `🚩 ESCANTEIO! A bola vai na área e ${header.shortName} sobe para o cabeceio...`,
      attackTeamId: attackTeam.id,
    };
  };

  // 3. Clock tick runner (LOCAL simulation — disabled while replaying a server result)
  useEffect(() => {
    if (isReplay) return;
    if (state.mode === 'online' && !isSimulatorHost) return;
    if (!isPlaying || isFinished || dangerState || penaltyMode) return;

    const interval = setInterval(() => {
      const nextMin = minute + 1;
      const finalMin = isKnockout ? 120 : 90;

      // Finish condition
      if (nextMin > finalMin) {
        clearInterval(interval);
        if (isKnockout && homeScore === awayScore) {
          setPenaltyMode(true);
          setIsPlaying(false);
          setMinute(120);
        } else {
          setIsFinished(true);
          setIsPlaying(false);
        }
        return;
      }

      setMinute(nextMin);

      // 3.2 Match Simulation math resolver
      const homeCoach = COACHES.find(c => c.id === homeTeam.coachId)!;
      const awayCoach = COACHES.find(c => c.id === awayTeam.coachId)!;
      const homeFormation = FORMATIONS.find(f => f.id === homeTeam.formationId)!;
      const awayFormation = FORMATIONS.find(f => f.id === awayTeam.formationId)!;

      const homeChem = getChemistryBonus(homeTeam.totalChemistry);
      const awayChem = getChemistryBonus(awayTeam.totalChemistry);

      const homeFormBonus = homeFormation.counters.includes(awayTeam.formationId) ? 5 : 0;
      const awayFormBonus = awayFormation.counters.includes(homeTeam.formationId) ? 5 : 0;

      const fergusonActive = (team: Team, goals: number, oppGoals: number) =>
        team.coachId === 'ferguson' && goals < oppGoals;
      const zidaneBonus = (team: Team) =>
        team.coachId === 'zidane' && isKnockout ? (minute >= 90 ? 10 : 7) : 0;

      const homeStrength = calculateTeamStrength(homeTeam, homeCoach, homeChem, homeFormBonus) +
        zidaneBonus(homeTeam) +
        (fergusonActive(homeTeam, homeScore, awayScore) ? 10 : 0) +
        (isFinal ? 0 : HOME_ADVANTAGE); // neutral venue for the final → no host edge
      const awayStrength = calculateTeamStrength(awayTeam, awayCoach, awayChem, awayFormBonus) +
        zidaneBonus(awayTeam) +
        (fergusonActive(awayTeam, awayScore, homeScore) ? 10 : 0);

      const homeMomBonus = (momentum - 50) * 0.12;
      const awayMomBonus = ((100 - momentum) - 50) * 0.12;

      // Attacking FORMATIONS take a little more of the territory (the tactic's attacking
      // intent lifts chance QUALITY below instead, so it doesn't also hog possession).
      const homeAtkScore = homeStrength + homeMomBonus + formationProfile(homeTeam.formationId).attack * 2 + (Math.random() * 2 - 1) * MATCH_NOISE;
      const awayAtkScore = awayStrength + awayMomBonus + formationProfile(awayTeam.formationId).attack * 2 + (Math.random() * 2 - 1) * MATCH_NOISE;

      const homeAttacks = homeAtkScore > awayAtkScore;
      const attackTeam = homeAttacks ? homeTeam : awayTeam;
      const defendTeam = homeAttacks ? awayTeam : homeTeam;

      // Flavour box-score (never affects the score) — mirrors the engine so the
      // player's live match shows realistic, varied shots/fouls/corners/saves.
      if (Math.random() < 0.24) incrementStat(homeAttacks ? 'awayFouls' : 'homeFouls');
      if (Math.random() < 0.20) {
        incrementStat(homeAttacks ? 'homeShots' : 'awayShots');
        const o = Math.random();
        if (o < 0.34) {
          incrementStat(homeAttacks ? 'homeShotsOnTarget' : 'awayShotsOnTarget');
          incrementStat(homeAttacks ? 'awaySaves' : 'homeSaves');
        } else if (o < 0.62) {
          incrementStat(homeAttacks ? 'homeCorners' : 'awayCorners');
        }
      }

      if (!keyMinutesRef.current) keyMinutesRef.current = buildKeyMinutes(isKnockout);
      const isKeyEvent = keyMinutesRef.current.includes(nextMin);

      if (isKeyEvent) {
        const result = simulateKeyEvent(nextMin, homeAttacks);

        // Suspense applies to ANY shot outcome (goal / save / miss), wherever it
        // sits in eventsToPush. The normal play pushes a 'momentum' build-up event
        // first, which used to hide saves/misses — so every danger sequence ended
        // in a goal, spoiling the suspense. Now defenses and misses build tension too.
        const isSuspenseWorthy = result.eventsToPush.some(
          e => e.type === 'goal' || e.type === 'save' || e.type === 'miss'
        );

        if (isSuspenseWorthy) {
          setIsPlaying(false);
          pendingGoalResult.current = result;

          const attackingTeam = result.attackTeamId === homeTeam.id ? homeTeam : awayTeam;
          const dangerMsg = dangerStage1Msg(
            result.approach,
            attackingTeam.name,
            result.attackerName,
            result.defenderName,
            result.isGoal,
            result.isSaveResult,
          );

          setDangerState({
            stage: 1,
            teamId: result.attackTeamId,
            attacker: result.attackerName,
            defender: result.defenderName,
            type: 'attack',
            message: dangerMsg,
            approach: result.approach,
            buildUp: result.buildUpMsg,
          });
        } else {
          // Silent resolution
          result.playerStatUpdates.forEach(update => {
            adjustPlayerStat(update.statKey, update.updateFn);
          });
          result.statIncrements.forEach(key => {
            incrementStat(key);
          });
          setEvents(prev => [...prev, ...result.eventsToPush]);
          setMomentum(prev => {
            const nextMom = Math.min(100, Math.max(0, prev + result.momentumShift));
            setMomentumHistory(hist => [...hist, nextMom]);
            return nextMom;
          });
        }
      } else if (Math.random() < 0.02) {
        // Dangerous free kick at a non-key minute (~1.5/match) — runs through the
        // same 3-stage suspense as a normal danger play.
        const fkResult = simulateFreeKick(nextMin, homeAttacks);
        setIsPlaying(false);
        pendingGoalResult.current = fkResult;
        setDangerState({
          stage: 1,
          teamId: fkResult.attackTeamId,
          attacker: fkResult.attackerName,
          defender: fkResult.defenderName,
          type: 'attack',
          message: dangerStage1Msg(fkResult.approach, attackTeam.name, fkResult.attackerName, fkResult.defenderName, fkResult.isGoal, fkResult.isSaveResult),
          approach: fkResult.approach,
          buildUp: fkResult.buildUpMsg,
        });
      } else if (Math.random() < 0.01) {
        // Corner header at a non-key minute (~0.7/match) — same 3-stage suspense.
        const chResult = simulateCornerHeader(nextMin, homeAttacks);
        setIsPlaying(false);
        pendingGoalResult.current = chResult;
        setDangerState({
          stage: 1,
          teamId: chResult.attackTeamId,
          attacker: chResult.attackerName,
          defender: chResult.defenderName,
          type: 'attack',
          message: dangerStage1Msg(chResult.approach, attackTeam.name, chResult.attackerName, chResult.defenderName, chResult.isGoal, chResult.isSaveResult),
          approach: chResult.approach,
          buildUp: chResult.buildUpMsg,
        });
      } else {
        // Flow/Commentary events (30% chance, context-aware)
        if (Math.random() < 0.30) {
          const homePossesses = Math.random() < (momentum / 100);
          const possessTeam = homePossesses ? homeTeam : awayTeam;
          const dTeam = homePossesses ? awayTeam : homeTeam;

          const midPlayers = possessTeam.players.slice(0, 11).filter(p =>
            ['MID', 'CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p.position)
          );
          const defPlayers = dTeam.players.slice(0, 11).filter(p =>
            ['DEF', 'CB', 'LB', 'RB', 'CDM'].includes(p.position)
          );

          const playerA = midPlayers[Math.floor(Math.random() * midPlayers.length)] || possessTeam.players[5];
          const defPlayerA = defPlayers[Math.floor(Math.random() * defPlayers.length)] || dTeam.players[2];

          const coach = COACHES.find(c => c.id === possessTeam.coachId);
          const lastEvt = [...events].reverse().find(e => ['goal', 'save', 'miss', 'duel'].includes(e.type));
          const lastCtxForFlow = lastEvt ? {
            type: lastEvt.type as 'goal' | 'save' | 'miss' | 'duel',
            teamId: lastEvt.teamId ?? possessTeam.id,
            atkName: lastEvt.playerId ? (possessTeam.players.find(p => p.id === lastEvt.playerId)?.shortName ?? playerA.shortName) : playerA.shortName,
            defName: defPlayerA.shortName,
            gkName: dTeam.players.find(p => p.position === 'GK')?.shortName ?? defPlayerA.shortName,
            approach: 'counter' as Approach,
          } : null;

          const desc = flowDesc(
            lastCtxForFlow,
            possessTeam.name,
            possessTeam.id,
            playerA.shortName,
            defPlayerA.shortName,
            possessTeam.playStyle ?? 'balanced',
            coach?.id ?? '',
            dTeam.name,
            homeScore,
            awayScore,
            nextMin,
          );

          const flowEvent: MatchEvent = {
            minute: nextMin,
            type: 'momentum',
            description: desc,
            teamId: possessTeam.id,
            playerId: playerA.id,
          };
          setEvents(prev => [...prev, flowEvent]);
          adjustPlayerStat(playerA.statId!, s => { s.rating += 0.1; });

          setMomentum(prev => {
            const shift = homePossesses ? 2 : -2;
            const nextMom = Math.min(95, Math.max(5, prev + shift));
            setMomentumHistory(hist => [...hist, nextMom]);
            return nextMom;
          });
        } else {
          setMomentumHistory(hist => [...hist, momentum]);
        }
      }
    }, getTickDuration());

    return () => clearInterval(interval);
  }, [isPlaying, isFinished, speed, minute, momentum, homeTeam, awayTeam, dangerState, penaltyMode]);

  // 4. Suspense / Danger sequence state runner (drives stages 1→2→3 for BOTH the
  // local sim and the online replay — stage 2 branches per mode below). This must
  // run in replay mode too; otherwise an online danger sequence freezes at stage 1.
  useEffect(() => {
    if (state.mode === 'online' && !isSimulatorHost) return;
    if (!dangerState) return;

    if (dangerState.stage === 1) {
      const timer = setTimeout(() => {
        setDangerState(prev => prev ? {
          ...prev,
          stage: 2,
          message: prev.buildUp ?? `🤺 ${prev.attacker} parte para cima de ${prev.defender} — duelo decisivo!`,
        } : null);
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (dangerState.stage === 2) {
      const timer = setTimeout(() => {
        // Replay mode: apply the buffered goal events from pendingReplayGoals
        if (isReplay && pendingReplayGoals.current) {
          const rg = pendingReplayGoals.current;
          setHomeScore(s => s + rg.homeGoalDelta);
          setAwayScore(s => s + rg.awayGoalDelta);
          setEvents(prev => [...prev, ...rg.goalEvents]);
          setGoalAlert(rg.goalAlert);
          setTimeout(() => setGoalAlert(null), 2500);
          setMomentum(m => {
            const next = Math.min(100, Math.max(0, m + rg.momentumShift));
            setMomentumHistory(h => [...h, next]);
            return next;
          });
          setDangerState(prev => prev ? { ...prev, stage: 3, message: rg.messageStage3 } : null);
          pendingReplayGoals.current = null;
          return;
        }

        const result = pendingGoalResult.current;
        if (result) {
          // Apply pre-simulated scores
          const newHomeScore = homeScore + result.homeScoreDelta;
          const newAwayScore = awayScore + result.awayScoreDelta;
          setHomeScore(newHomeScore);
          setAwayScore(newAwayScore);

          // Trigger Goal alert
          if (result.goalAlert) {
            setGoalAlert(result.goalAlert);
            setTimeout(() => setGoalAlert(null), 3000);
          }

          // Apply pre-simulated player stats
          result.playerStatUpdates.forEach((update: any) => {
            adjustPlayerStat(update.statKey, update.updateFn);
          });

          // Apply pre-simulated team stats
          result.statIncrements.forEach((key: any) => {
            incrementStat(key);
          });

          // Add pre-simulated events
          setEvents(prev => [...prev, ...result.eventsToPush]);

          // Shift momentum
          setMomentum(prev => {
            const nextMom = Math.min(100, Math.max(0, prev + result.momentumShift));
            setMomentumHistory(hist => [...hist, nextMom]);
            return nextMom;
          });

          // Transition to stage 3
          setDangerState(prev => prev ? {
            ...prev,
            stage: 3,
            message: result.messageStage3
          } : null);
        } else {
          setDangerState(null);
          setIsPlaying(true);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }

    if (dangerState.stage === 3) {
      const timer = setTimeout(() => {
        setDangerState(null);
        pendingGoalResult.current = null;
        pendingReplayGoals.current = null;
        setIsPlaying(true); // Resume simulation clock (or replay clock)
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [dangerState]);

  // 4b. REPLAY clock — steps through the server's authoritative event timeline.
  // Reveals each event at its minute and rebuilds the score from goal events, so
  // the replay ends exactly on the server's score on every device.
  useEffect(() => {
    if (!isReplay || !replayResult) return;
    // Pause during danger sequence (goals trigger the same 3-stage suspense as local sim)
    if (!isPlaying || isFinished || penaltyMode || goalAlert || dangerState) return;

    // The result carries its own duration (90 or 120) — a first leg never goes to
    // extra time; a second leg / single tie may. Penalties are signalled by the
    // result's penaltyWinner, decided on aggregate by the engine.
    const finalMin = replayResult.durationMinutes ?? (isKnockout ? 120 : 90);

    const timer = setTimeout(() => {
      const nextMin = minute + 1;

      if (nextMin > finalMin) {
        // Regular / extra time finished.
        if (replayResult.penaltyWinner) {
          // Enter penalty mode and auto-play kicks one by one (kick-by-kick narration).
          setPenaltyCommentary('⚡ DISPUTA DE PÊNALTIS! Máxima tensão...');
          setPenaltyMode(true);
          setPenaltyReplayIdx(0);
          setIsPlaying(false);
        } else {
          setIsFinished(true);
          setIsPlaying(false);
        }
        setMinute(finalMin);
        return;
      }

      setMinute(nextMin);

      const evs = replayResult.events.filter(e => e.minute === nextMin);
      if (evs.length > 0) {
        // Separate goal events from non-goal events. Non-goal events (yellow cards,
        // saves, etc.) are shown immediately. Goal events trigger the 3-stage danger
        // play sequence so knockouts get the same suspense as the local sim.
        // Shot outcomes (goal / save / miss) get the 3-stage suspense — you should
        // NOT know if it's a goal until the reveal. Everything else (build-up, duels,
        // fouls, cards) shows immediately.
        const shotEvs = evs.filter(e => e.type === 'goal' || e.type === 'save' || e.type === 'miss');
        // 'penalty' is the engine's shootout SUMMARY (carries the final pen score) — it
        // must NEVER hit the live feed here, or it spoils the result before the shootout
        // overlay even opens. It's added to the feed only after the overlay finishes.
        const otherEvs = evs.filter(e => e.type !== 'goal' && e.type !== 'save' && e.type !== 'miss' && e.type !== 'penalty');

        if (otherEvs.length > 0) {
          setEvents(prev => [...prev, ...otherEvs]);
          let delta = 0;
          for (const e of otherEvs) {
            const isHome = e.teamId === homeTeam.id;
            if (e.type === 'momentum') delta += isHome ? 6 : -6;
            else if (e.type === 'duel') delta += isHome ? 5 : -5;
          }
          if (delta !== 0) setMomentum(m => {
            const next = Math.min(95, Math.max(5, m + delta));
            setMomentumHistory(h => [...h, next]);
            return next;
          });
        }

        if (shotEvs.length > 0) {
          const decisive = shotEvs[shotEvs.length - 1];
          const isGoalOutcome = shotEvs.some(e => e.type === 'goal');
          const isSaveOutcome = !isGoalOutcome && decisive.type === 'save';
          // For a save the event teamId is the keeper's (defending) side; the attacker
          // is on the other team. For goals/misses teamId is the attacking team.
          const atkId = isSaveOutcome ? (decisive.teamId === homeTeam.id ? awayTeam.id : homeTeam.id) : decisive.teamId;
          const atkTeam = atkId === homeTeam.id ? homeTeam : awayTeam;
          const defTeam = atkTeam.id === homeTeam.id ? awayTeam : homeTeam;
          // Own goal: the engine tags the scorer via opponentId (a defender on the
          // OTHER team). Name him explicitly so the broadcast is clear about who put
          // it in his own net and for which team — instead of a vague "Gol Contra".
          // Own goals carry NO playerId (the scorer isn't on the attacking team). The
          // old check `description.includes('Contra')` wrongly flagged "Contra-ataque"
          // goals — which DO have a scorer — as own goals. Use the structural signal.
          const isOwnGoal = isGoalOutcome && !decisive.playerId;
          const ogName = isOwnGoal
            ? (defTeam.players.find(p => p.id === decisive.opponentId)?.shortName ?? 'um zagueiro')
            : '';
          const attackerName = isOwnGoal
            ? `Gol Contra (${ogName})`
            : isSaveOutcome
              ? (atkTeam.players.find(p => p.id === decisive.opponentId)?.shortName ?? 'Atacante')
              : (atkTeam.players.find(p => p.id === decisive.playerId)?.shortName ?? 'Atacante');
          const gkName = defTeam.players.find(p => p.position === 'GK')?.shortName ?? defTeam.name;
          const homeDelta = shotEvs.filter(e => e.type === 'goal' && e.teamId === homeTeam.id).length;
          const awayDelta = shotEvs.filter(e => e.type === 'goal' && e.teamId === awayTeam.id).length;
          const atkIsHome = atkId === homeTeam.id;
          const momentumShift = isGoalOutcome ? (atkIsHome ? 22 : -22) : isSaveOutcome ? (atkIsHome ? -8 : 8) : (atkIsHome ? -3 : 3);
          const messageStage3 = isOwnGoal
            ? `😱 GOL CONTRA de ${ogName} (${defTeam.name})! Ele desviou para a própria meta e o ${atkTeam.name.toUpperCase()} agradece!`
            : isGoalOutcome
              ? `🔥 GOOOOL! ${attackerName} balança as redes! ${atkTeam.name.toUpperCase()} MARCA!`
              : isSaveOutcome ? saveCelebMsg(gkName, attackerName) : missCelebMsg(attackerName);

          pendingReplayGoals.current = {
            goalEvents: shotEvs,
            homeGoalDelta: homeDelta,
            awayGoalDelta: awayDelta,
            goalAlert: isGoalOutcome ? { teamName: atkTeam.name, scorer: attackerName } : null,
            momentumShift,
            messageStage3,
          };

          setIsPlaying(false);
          const replayApproach = selectApproach(atkTeam.playStyle ?? 'balanced');
          const replayBuildUp = isOwnGoal
            ? `😬 ${ogName} tenta cortar sob pressão na área do ${defTeam.name}, mas a bola desvia em direção ao próprio gol...`
            : buildUpDesc(replayApproach, attackerName, gkName, gkName, atkTeam.name);
          setDangerState({
            stage: 1,
            teamId: atkId,
            attacker: isOwnGoal ? ogName : attackerName,
            defender: gkName,
            type: 'attack',
            message: isOwnGoal
              ? `⚠️ Cruzamento perigoso na área do ${defTeam.name} — todo cuidado é pouco!`
              : dangerStage1Msg(replayApproach, atkTeam.name, attackerName, gkName, isGoalOutcome, isSaveOutcome),
            approach: replayApproach,
            buildUp: replayBuildUp,
          });
        } else if (otherEvs.length === 0) {
          setMomentumHistory(h => [...h, momentum]);
        }
      } else {
        setMomentumHistory(h => [...h, momentum]);
      }
    }, getTickDuration());

    return () => clearTimeout(timer);
  }, [isReplay, replayResult, isPlaying, isFinished, penaltyMode, goalAlert, dangerState, minute, speed, isKnockout, homeTeam, awayTeam, momentum]);

  // Scroll live events feed to bottom automatically
  useEffect(() => {
    if (eventFeedRef.current) {
      eventFeedRef.current.scrollTop = eventFeedRef.current.scrollHeight;
    }
  }, [events, dangerState]);

  // 4c. Replay penalty kick-by-kick auto-narration
  useEffect(() => {
    if (!penaltyMode || !isReplay || !replayResult || penaltyReplayIdx < 0 || penaltyWinner) return;
    const kicks = replayResult.penaltyKicks;
    if (!kicks || kicks.length === 0) {
      // No kick data — fallback to instant reveal
      setPenaltyWinner(replayResult.penaltyWinner!);
      setPenaltyHomeScore(replayResult.homePenalties ?? 0);
      setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
      return;
    }
    if (penaltyReplayIdx >= kicks.length) {
      // All kicks narrated → reveal winner. Only NOW is it safe to drop the shootout
      // summary into the live feed (the result is no longer a spoiler).
      setPenaltyKickPending(null);
      setPenaltyWinner(replayResult.penaltyWinner!);
      setPenaltyHomeScore(replayResult.homePenalties ?? 0);
      setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
      const champ = replayResult.penaltyWinner === homeTeam.id ? homeTeam.name : awayTeam.name;
      setEvents(prev => prev.some(e => e.type === 'penalty') ? prev : [...prev, {
        minute: replayResult.durationMinutes ?? (isKnockout ? 120 : 90),
        type: 'penalty',
        description: `🎯 Pênaltis: ${homeTeam.name} ${replayResult.homePenalties ?? 0}-${replayResult.awayPenalties ?? 0} ${awayTeam.name} — ${champ} avança!`,
        teamId: replayResult.penaltyWinner!,
      }]);
      return;
    }

    const kick = kicks[penaltyReplayIdx];
    const isHome = kick.teamId === homeTeam.id;
    const teamName = isHome ? homeTeam.name : awayTeam.name;
    const num = penaltyReplayIdx + 1;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1 — build-up (suspense): the taker steps up, the keeper tries to read him.
    setPenaltyKickPending(kick.teamId);
    setPenaltyCommentary(`COBRANÇA ${num} · ${teamName.toUpperCase()}\n🎯 ${kick.takerName} ajeita a bola na marca... ${kick.gkName} dança na linha tentando intimidar.`);

    timers.push(setTimeout(() => {
      // Phase 2 — the reveal.
      let desc: string;
      if (kick.isGoal) {
        desc = `⚽ GOOOOL! ${kick.takerName} desloca o goleiro e estufa a rede!`;
      } else {
        desc = penaltyReplayIdx % 2 === 0
          ? `🧤 PEGOU! ${kick.gkName} voa no canto e DEFENDE a cobrança de ${kick.takerName}!`
          : `❌ PRA FORA! ${kick.takerName} pesa a perna e manda por cima do travessão!`;
      }
      setPenaltyCommentary(`COBRANÇA ${num} · ${teamName.toUpperCase()}\n${desc}`);
      setPenaltyKickPending(null);
      if (isHome) {
        setPenaltiesHome(prev => [...prev, kick.isGoal]);
        if (kick.isGoal) setPenaltyHomeScore(prev => prev + 1);
      } else {
        setPenaltiesAway(prev => [...prev, kick.isGoal]);
        if (kick.isGoal) setPenaltyAwayScore(prev => prev + 1);
      }
      // Hold the reveal so the drama lands before the next taker walks up.
      timers.push(setTimeout(() => setPenaltyReplayIdx(prev => prev + 1), 1700));
    }, 1900));

    return () => timers.forEach(clearTimeout);
  }, [penaltyMode, isReplay, replayResult, penaltyReplayIdx, penaltyWinner, homeTeam, awayTeam, isKnockout]);

  // 5. Interactive Penalty Shootout Handler
  const handleTakePenalty = () => {
    const currentKick = penaltiesHome.length + penaltiesAway.length;
    const isHomeTurn = penaltiesHome.length === penaltiesAway.length;

    const attackTeam = isHomeTurn ? homeTeam : awayTeam;
    const defendTeam = isHomeTurn ? awayTeam : homeTeam;

    const order = getPenaltyOrder(attackTeam);
    const takerIdx = Math.floor(currentKick / 2);
    const taker = order[takerIdx % order.length];
    const gk = defendTeam.players.find(p => p.position === 'GK') || defendTeam.players[0];

    const composure = taker.composure + getPenaltyComposureBonus(taker.traits);
    const gkReflexes = gk.defending + getGoalkeeperTraitBonus(gk.traits);

    const goalChance = composure / (composure + gkReflexes * 0.45);
    const isGoal = Math.random() < goalChance;

    let desc = "";
    if (isGoal) {
      desc = `🎯 CONVERTEU! ${taker.shortName} cobra com categoria na bochecha da rede!`;
    } else {
      desc = Math.random() < 0.5
        ? `🧤 DEFENDEU! O goleiro voa para o canto e espalma o chute de ${taker.shortName}!`
        : `❌ PARA FORA! ${taker.shortName} sente a pressão e isola o pênalti por cima!`;
    }

    const comment = `${attackTeam.name} (${taker.shortName}) vs ${defendTeam.name} (${gk.shortName}):\n${desc}`;
    setPenaltyCommentary(comment);

    const nextHomePens = [...penaltiesHome];
    const nextAwayPens = [...penaltiesAway];
    let nextHomeScore = penaltyHomeScore;
    let nextAwayScore = penaltyAwayScore;

    if (isHomeTurn) {
      nextHomePens.push(isGoal);
      if (isGoal) nextHomeScore = penaltyHomeScore + 1;
      setPenaltiesHome(nextHomePens);
      setPenaltyHomeScore(nextHomeScore);
    } else {
      nextAwayPens.push(isGoal);
      if (isGoal) nextAwayScore = penaltyAwayScore + 1;
      setPenaltiesAway(nextAwayPens);
      setPenaltyAwayScore(nextAwayScore);
    }

    // Check if resolved
    const hKicks = isHomeTurn ? nextHomePens.length : penaltiesHome.length;
    const aKicks = isHomeTurn ? penaltiesAway.length : nextAwayPens.length;
    const hScore = isHomeTurn ? nextHomeScore : penaltyHomeScore;
    const aScore = isHomeTurn ? penaltyAwayScore : nextAwayScore;

    const hRem = 5 - hKicks;
    const aRem = 5 - aKicks;

    let ended = false;
    let winner = null;

    if (hKicks >= 3 || aKicks >= 3) {
      if (hScore > aScore + aRem) {
        ended = true;
        winner = homeTeam.id;
      } else if (aScore > hScore + hRem) {
        ended = true;
        winner = awayTeam.id;
      }
    }

    if (hKicks === 5 && aKicks === 5 && !ended) {
      if (hScore > aScore) {
        ended = true;
        winner = homeTeam.id;
      } else if (aScore > hScore) {
        ended = true;
        winner = awayTeam.id;
      }
    } else if (hKicks > 5 && aKicks === hKicks && !ended) {
      if (hScore !== aScore) {
        ended = true;
        winner = hScore > aScore ? homeTeam.id : awayTeam.id;
      }
    }

    if (ended && winner) {
      setPenaltyWinner(winner);
      setIsFinished(true);

      const finalPensEvent: MatchEvent = {
        minute: 120,
        type: 'penalty',
        description: `🎯 DISPUTA DE PÊNALTIS FINALIZADA! ${homeTeam.name} ${hScore}-${aScore} ${awayTeam.name}. Vencedor: ${winner === homeTeam.id ? homeTeam.name : awayTeam.name}`,
        teamId: winner,
      };
      setEvents(prev => [...prev, finalPensEvent]);
    }
  };

  const handleSkip = () => {
    // REPLAY: jump straight to the authoritative final state.
    if (isReplay && replayResult) {
      // If already in penalty replay mode, skip to final shootout result immediately.
      if (penaltyMode && penaltyReplayIdx >= 0 && replayResult.penaltyKicks) {
        const kicks = replayResult.penaltyKicks;
        const homeKicks = kicks.filter(k => k.teamId === homeTeam.id).map(k => k.isGoal);
        const awayKicks = kicks.filter(k => k.teamId === awayTeam.id).map(k => k.isGoal);
        setPenaltiesHome(homeKicks);
        setPenaltiesAway(awayKicks);
        setPenaltyWinner(replayResult.penaltyWinner!);
        setPenaltyHomeScore(replayResult.homePenalties ?? 0);
        setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
        setPenaltyReplayIdx(-1);
        return;
      }
      setMinute(replayResult.durationMinutes ?? (isKnockout ? 120 : 90));
      setEvents(replayResult.events);
      setHomeScore(replayResult.homeGoals);
      setAwayScore(replayResult.awayGoals);
      setStats(replayResult.stats);
      if (replayResult.playerStats) setPlayerMatchStats(replayResult.playerStats);
      setGoalAlert(null);
      if (replayResult.penaltyWinner) {
        // Skip past penalty replay too
        const kicks = replayResult.penaltyKicks ?? [];
        setPenaltiesHome(kicks.filter(k => k.teamId === homeTeam.id).map(k => k.isGoal));
        setPenaltiesAway(kicks.filter(k => k.teamId === awayTeam.id).map(k => k.isGoal));
        setPenaltyWinner(replayResult.penaltyWinner);
        setPenaltyHomeScore(replayResult.homePenalties ?? 0);
        setPenaltyAwayScore(replayResult.awayPenalties ?? 0);
        setPenaltyMode(true);
        setPenaltyReplayIdx(-1);
        setIsPlaying(false);
      } else {
        setIsFinished(true);
        setIsPlaying(false);
      }
      return;
    }

    // Generate organic outcome for remaining minutes using the actual engine logic!
    const result = simulateRemainingMatch(
      homeTeam,
      awayTeam,
      minute,
      homeScore,
      awayScore,
      events,
      stats,
      isKnockout,
      isFinal
    );

    setMinute(isKnockout ? 120 : 90);
    setHomeScore(result.homeGoals);
    setAwayScore(result.awayGoals);
    setEvents(result.events);
    setStats(result.stats);
    
    if (result.playerStats) {
      setPlayerMatchStats(result.playerStats);
    }

    if (isKnockout && result.homeGoals === result.awayGoals) {
      setPenaltyMode(true);
      setIsPlaying(false);
      if (result.penaltyWinner) {
        setPenaltyWinner(result.penaltyWinner);
        setPenaltyHomeScore(result.homePenalties ?? 0);
        setPenaltyAwayScore(result.awayPenalties ?? 0);
      }
    } else {
      setIsFinished(true);
      setIsPlaying(false);
      if (result.winner) {
        setPenaltyWinner(result.winner);
      }
    }
  };

  const handleFinish = () => {
    const allPlayers = [...homeTeam.players, ...awayTeam.players];

    // Compute clean sheet and match outcome modifiers just before finishing
    const updatedStats = { ...playerMatchStats };
    const homeGoals = homeScore;
    const awayGoals = awayScore;
    const winner = penaltyWinner || (homeGoals > awayGoals ? homeTeam.id : awayGoals > homeGoals ? awayTeam.id : null);

    if (awayGoals === 0) {
      homeTeam.players.slice(0, 11).forEach(p => {
        if (updatedStats[p.id]) {
          if (p.position === 'GK') updatedStats[p.id].rating += 0.8;
          else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) updatedStats[p.id].rating += 0.4;
        }
      });
    }
    if (homeGoals === 0) {
      awayTeam.players.slice(0, 11).forEach(p => {
        if (updatedStats[p.id]) {
          if (p.position === 'GK') updatedStats[p.id].rating += 0.8;
          else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) updatedStats[p.id].rating += 0.4;
        }
      });
    }

    if (winner === homeTeam.id) {
      homeTeam.players.slice(0, 11).forEach(p => { if (updatedStats[p.id]) updatedStats[p.id].rating += 0.3; });
      awayTeam.players.slice(0, 11).forEach(p => { if (updatedStats[p.id]) updatedStats[p.id].rating -= 0.2; });
    } else if (winner === awayTeam.id) {
      awayTeam.players.slice(0, 11).forEach(p => { if (updatedStats[p.id]) updatedStats[p.id].rating += 0.3; });
      homeTeam.players.slice(0, 11).forEach(p => { if (updatedStats[p.id]) updatedStats[p.id].rating -= 0.2; });
    }

    // Clamp and round final ratings
    allPlayers.forEach(p => {
      if (updatedStats[p.id]) {
        const finalR = Math.min(10.0, Math.max(3.0, updatedStats[p.id].rating));
        updatedStats[p.id].rating = parseFloat(finalR.toFixed(1));
      }
    });

    const sorted = [...allPlayers].sort((a, b) => {
      const rA = updatedStats[a.statId!]?.rating ?? 6.0;
      const rB = updatedStats[b.statId!]?.rating ?? 6.0;
      return rB - rA;
    });
    const mvpId = sorted[0]?.id || 'messi';

    const finalResult: MatchResult = {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeGoals: homeScore,
      awayGoals: awayScore,
      events: events,
      winner: winner,
      penaltyWinner: penaltyWinner || undefined,
      homePenalties: penaltyWinner ? penaltyHomeScore : undefined,
      awayPenalties: penaltyWinner ? penaltyAwayScore : undefined,
      mvp: mvpId,
      stats: getProgressiveStats(),
      playerStats: updatedStats,
    };

    // Online results are authoritative on the server already (this screen is a
    // replay), so we just return to the league/knockout view. Solo computes
    // the result locally as before.
    if (activeKnockoutMatch) {
      // Spectators (eliminated players watching someone else's tie) must NOT notify the
      // advance-gate — they aren't participants in this round.
      if (state.mode === 'online' && !state.spectating) notifyMatchWatchedOnline('knockout');
      dispatch({ type: 'FINISH_KNOCKOUT_MATCH', result: finalResult });
    } else {
      if (state.mode === 'online') notifyMatchWatchedOnline('league');
      dispatch({ type: 'FINISH_LEAGUE_MATCH', result: finalResult });
    }
  };

  // Helper helper to get progressive stats with ball possession
  const getProgressiveStats = () => {
    const getMidfielderPassing = (t: Team) => {
      const mids = t.players.slice(0, 11).filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position));
      if (mids.length === 0) return 75;
      return mids.reduce((sum, p) => sum + p.passing, 0) / mids.length;
    };
    const homeMidPass = getMidfielderPassing(homeTeam);
    const awayMidPass = getMidfielderPassing(awayTeam);
    const baseHomePos = Math.min(65, Math.max(35, Math.round((homeMidPass / (homeMidPass + awayMidPass)) * 100)));

    // Fluctuates possession dynamically based on current momentum and minute ticks for realism
    const momentumEffect = (momentum - 50) * 0.12; // up to +-6%
    const tickSeed = Math.sin(minute * 0.8) * 2.2; // organic oscillation
    let currentHomePos = Math.round(baseHomePos + momentumEffect + tickSeed);

    const duelEvents = events.filter(e => e.type === 'duel');
    if (duelEvents.length > 0) {
      const homeWins = duelEvents.filter(e => e.teamId === homeTeam.id).length;
      const deviation = (homeWins / duelEvents.length - 0.5) * 12;
      currentHomePos = Math.round(currentHomePos + deviation);
    }

    currentHomePos = Math.min(78, Math.max(22, currentHomePos));

    return {
      ...stats,
      homePos: currentHomePos,
      awayPos: 100 - currentHomePos,
    };
  };

  // REPLAY: rebuild live player ratings + team stats progressively from the
  // events revealed so far, so they build up in real time instead of appearing
  // final from the kickoff. Deterministic (same events => same numbers on every
  // device), and we snap to the authoritative result at the final whistle.
  const replayProgress = useMemo(() => {
    if (!isReplay || !replayResult) return null;

    const ps: Record<string, PlayerMatchStat> = {};
    const initTeam = (team: Team) => {
      team.players.slice(0, 11).forEach(p => {
        ps[p.statId!] = {
          playerId: p.id, playerName: p.shortName, teamId: team.id, rating: 6.4,
          goals: 0, assists: 0, shots: 0, tackles: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0,
          keyPasses: 0, interceptions: 0, shotsOnTarget: 0,
        };
      });
    };
    initTeam(homeTeam);
    initTeam(awayTeam);
    // Event ids → per-team stat keys (actor is on e.teamId; opponent on the other).
    const otherOf = (teamId?: string) => (teamId === replayResult.homeTeamId ? replayResult.awayTeamId : replayResult.homeTeamId);
    const aKey = (e: MatchEvent, id?: string) => (e.teamId && id ? statKey(e.teamId, id) : undefined);
    const oKey = (e: MatchEvent, id?: string) => (id ? statKey(otherOf(e.teamId), id) : undefined);

    const panel = {
      homePos: 50, awayPos: 50, homeShots: 0, awayShots: 0,
      homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeFouls: 0, awayFouls: 0,
      homeSaves: 0, awaySaves: 0, homeCorners: 0, awayCorners: 0,
    };

    const homeId = replayResult.homeTeamId;
    for (const e of events) {
      const isHome = e.teamId === homeId;
      const ak = aKey(e, e.playerId);
      const asK = aKey(e, e.assisterId);
      const ok = oKey(e, e.opponentId);
      if (e.type === 'goal') {
        if (ak && ps[ak]) { ps[ak].goals++; ps[ak].rating += 1.4; }
        if (asK && ps[asK]) { ps[asK].assists++; ps[asK].rating += 0.8; }
        if (ok && ps[ok]) ps[ok].rating -= 0.4;
        if (isHome) { panel.homeShots++; panel.homeShotsOnTarget++; } else { panel.awayShots++; panel.awayShotsOnTarget++; }
      } else if (e.type === 'save') {
        if (ak && ps[ak]) { ps[ak].saves++; ps[ak].rating += 0.4; }
        if (ok && ps[ok]) ps[ok].rating -= 0.1;
        // the shot belongs to the attacking (other) team
        if (isHome) { panel.homeSaves++; panel.awayShots++; panel.awayShotsOnTarget++; }
        else { panel.awaySaves++; panel.homeShots++; panel.homeShotsOnTarget++; }
        if (e.description?.includes('Escanteio')) { if (isHome) panel.awayCorners++; else panel.homeCorners++; }
      } else if (e.type === 'miss') {
        if (ak && ps[ak]) { ps[ak].shots++; ps[ak].rating -= 0.15; }
        if (isHome) panel.homeShots++; else panel.awayShots++;
      } else if (e.type === 'duel') {
        if (ak && ps[ak]) { ps[ak].tackles++; ps[ak].rating += 0.35; }
        if (ok && ps[ok]) ps[ok].rating -= 0.15;
      } else if (e.type === 'yellow') {
        if (ak && ps[ak]) { ps[ak].yellowCards++; ps[ak].rating -= 0.5; ps[ak].fouls++; }
        if (isHome) panel.homeFouls++; else panel.awayFouls++;
      } else if (e.type === 'foul') {
        if (ak && ps[ak]) { ps[ak].fouls++; ps[ak].rating -= 0.1; }
        if (isHome) panel.homeFouls++; else panel.awayFouls++;
      }
    }

    Object.values(ps).forEach(s => {
      s.rating = parseFloat(Math.min(10, Math.max(3, s.rating)).toFixed(1));
    });

    const totalShots = panel.homeShots + panel.awayShots;
    panel.homePos = totalShots > 0
      ? Math.min(70, Math.max(30, Math.round(50 + ((panel.homeShots - panel.awayShots) / totalShots) * 18)))
      : 50;
    panel.awayPos = 100 - panel.homePos;

    return { ps, panel };
  }, [isReplay, replayResult, events, homeTeam, awayTeam]);

  // During a replay the panel/ratings build up live; at the whistle we use the
  // authoritative server values (already stored in playerMatchStats for replays).
  const currentStats = isReplay
    ? (isFinished || penaltyMode ? (replayResult?.stats ?? getProgressiveStats()) : (replayProgress?.panel ?? replayResult?.stats ?? getProgressiveStats()))
    : getProgressiveStats();

  const getDisplayRating = (playerId: string): number => {
    if (isReplay && !isFinished && !penaltyMode && replayProgress) {
      return replayProgress.ps[playerId]?.rating ?? 6.0;
    }
    return playerMatchStats[playerId]?.rating ?? 6.0;
  };

  const getDisplayStat = (playerId: string): PlayerMatchStat | undefined => {
    if (isReplay && !isFinished && !penaltyMode && replayProgress) return replayProgress.ps[playerId];
    return playerMatchStats[playerId];
  };

  const latestEvent = events[events.length - 1];

  // Helper to format events icons
  const getEventIcon = (type: MatchEvent['type']) => {
    switch (type) {
      case 'goal': return '⚽';
      case 'duel': return '🤺';
      case 'save': return '🧤';
      case 'sub': return '🔄';
      case 'penalty': return '🎯';
      default: return '📢';
    }
  };

  // Render the pressure curves
  const renderMomentumChart = () => {
    if (momentumHistory.length === 0) return null;

    const width = 320;
    const height = 60;
    const padding = 10;
    const midY = height / 2;

    const points = momentumHistory.map((val, idx) => {
      const x = padding + (idx / (momentumHistory.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - (val / 100) * (height - 2 * padding);
      return { x, y };
    });

    const pathD = points.reduce((acc, p, idx) =>
      idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
    , "");

    const areaPathD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${midY} L ${points[0].x} ${midY} Z`
      : "";

    const goalEvents = events.filter(e => e.type === 'goal');

    return (
      <div className="bg-[#0e0e1a] border border-[#1f1f35] rounded-xl p-3 flex flex-col flex-shrink-0">
        <span className="text-[10px] font-black text-yellow-500 tracking-widest uppercase mb-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          MOMENTUM
        </span>
        <div className="relative w-full h-[60px] bg-[#07070d] rounded-lg border border-[#141426] p-1 overflow-hidden">
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <line x1={padding} y1={midY} x2={width - padding} y2={midY} stroke="#1f1f35" strokeDasharray="3,3" strokeWidth="1" />
            
            {areaPathD && (
              <path d={areaPathD} fill="url(#momentumAreaGrad)" />
            )}

            {pathD && (
              <path d={pathD} fill="none" stroke="url(#momentumLineGrad)" strokeWidth="2.2" strokeLinecap="round" />
            )}

            <defs>
              <linearGradient id="momentumLineGrad" x1="0" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffd700" />
                <stop offset="47%" stopColor="#ffd700" />
                <stop offset="50%" stopColor="#8a8a9a" />
                <stop offset="53%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="momentumAreaGrad" x1="0" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffd700" stopOpacity="0.25" />
                <stop offset="45%" stopColor="#ffd700" stopOpacity="0.03" />
                <stop offset="50%" stopColor="#07070d" stopOpacity="0" />
                <stop offset="55%" stopColor="#6366f1" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {/* Display goals as marker circles on the graph */}
            {goalEvents.map((g, idx) => {
              const markerIdx = g.minute;
              const p = points[markerIdx] || points[points.length - 1];
              if (!p) return null;
              return (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill="#ffd700" stroke="#05050a" strokeWidth="1.2" />
                  <text x={p.x} y={p.y - 7} fontSize="9" textAnchor="middle" className="select-none pointer-events-none">⚽</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex justify-between mt-2 text-[9px] font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          <span style={{ color: '#ffd700' }}>▲ DOMINÂNCIA: {homeTeam.name.toUpperCase()}</span>
          <span style={{ color: '#6366f1' }}>▼ DOMINÂNCIA: {awayTeam.name.toUpperCase()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col relative overflow-hidden select-none" style={{ background: '#05050a' }}>
      
      {/* ── 1. GOAL SPLASH SCREEN ── */}
      <AnimatePresence>
        {goalAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0, 0, 0, 0.92)' }}
          >
            <motion.h1
              animate={{ scale: [1, 1.18, 1] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
              className="text-8xl font-black text-center tracking-wider text-yellow-500 mb-2"
              style={{ fontFamily: 'Bebas Neue, sans-serif', textShadow: '0 0 50px rgba(234, 179, 8, 0.95)' }}
            >
              GOOOOOL!
            </motion.h1>
            <p className="text-3xl text-white font-bold tracking-widest text-center" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              {goalAlert.teamName.toUpperCase()}
            </p>
            <p className="text-2xl text-yellow-400 font-extrabold text-center mt-3 animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              ⭐ {goalAlert.scorer.toUpperCase()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. SCOREBOARD HEADER ── */}
      <div className="flex-shrink-0 border-b relative z-10" style={{ background: '#0b0b14', borderColor: '#171725' }}>
        <div className="py-3 px-3 sm:py-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
            {/* Home team metadata */}
            <div className="flex-1 text-right pr-2 sm:pr-6 min-w-0">
              <h2 className="font-black text-white truncate" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em', fontSize: 'clamp(1rem, 4vw, 1.875rem)' }}>
                {homeTeam.name.toUpperCase()}
              </h2>
              <span className="text-[10px] sm:text-xs font-bold tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#c9a84c' }}>
                {homeTeam.id === playerTeamId ? 'SEU TIME' : 'ADVERSÁRIO'}
              </span>
            </div>

            {/* Core Scoreboard Widgets */}
            <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
              <div className="font-black text-white tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2rem, 8vw, 3.75rem)' }}>
                {homeScore}
              </div>

              <div className="flex flex-col items-center justify-center px-2 sm:px-6 py-1 sm:py-2 rounded-xl border" style={{ background: '#0e0e1a', borderColor: '#1f1f35' }}>
                <span className="text-[8px] sm:text-[9px] font-black text-yellow-500 tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {minute >= 90 && penaltyMode ? 'PÊNALTIS' : isKnockout && minute > 90 ? 'PRORRG.' : 'MIN'}
                </span>
                <span className="font-black text-white leading-none mt-0.5" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(1.5rem, 6vw, 2.5rem)' }}>
                  {minute}'
                </span>
              </div>

              <div className="font-black text-white tabular-nums" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2rem, 8vw, 3.75rem)' }}>
                {awayScore}
              </div>
            </div>

            {/* Away team metadata */}
            <div className="flex-1 text-left pl-2 sm:pl-6 min-w-0">
              <h2 className="font-black text-white truncate" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em', fontSize: 'clamp(1rem, 4vw, 1.875rem)' }}>
                {awayTeam.name.toUpperCase()}
              </h2>
              <span className="text-[10px] sm:text-xs font-bold tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#c9a84c' }}>
                {awayTeam.id === playerTeamId ? 'SEU TIME' : 'ADVERSÁRIO'}
              </span>
            </div>
          </div>
        </div>

        {/* ── GOAL TICKER ── Classic broadcaster-style goal list */}
        {(() => {
          const homeGoals = events.filter(e => e.type === 'goal' && e.teamId === homeTeam.id);
          const awayGoals = events.filter(e => e.type === 'goal' && e.teamId === awayTeam.id);
          if (homeGoals.length === 0 && awayGoals.length === 0) return null;
          return (
            <div className="border-t px-3 sm:px-6 py-1.5 flex items-start justify-center gap-4 sm:gap-8 max-w-6xl mx-auto" style={{ borderColor: '#1a1a2e' }}>
              {/* Home goals */}
              <div className="flex-1 flex flex-wrap justify-end gap-x-2 sm:gap-x-3 gap-y-0.5">
                {homeGoals.map((g, i) => {
                  const scorer = g.playerId
                    ? homeTeam.players.find(p => p.id === g.playerId)?.shortName ?? '?'
                    : 'Gol Contra'; // no playerId on a goal event ⇒ own goal
                  return (
                    <span key={i} className="text-[10px] sm:text-[11px] font-bold text-yellow-300 whitespace-nowrap" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      ⚽ {scorer} {g.minute}'
                    </span>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="w-px self-stretch" style={{ background: '#1f1f35' }} />

              {/* Away goals */}
              <div className="flex-1 flex flex-wrap justify-start gap-x-2 sm:gap-x-3 gap-y-0.5">
                {awayGoals.map((g, i) => {
                  const scorer = g.playerId
                    ? awayTeam.players.find(p => p.id === g.playerId)?.shortName ?? '?'
                    : 'Gol Contra'; // no playerId on a goal event ⇒ own goal
                  return (
                    <span key={i} className="text-[10px] sm:text-[11px] font-bold text-indigo-300 whitespace-nowrap" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      ⚽ {scorer} {g.minute}'
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── 2b. SECOND-LEG AGGREGATE BANNER ── */}
      {legNumber === 2 && firstLeg && (
        <div className="flex-shrink-0 border-b px-3 sm:px-6 py-1.5 flex items-center justify-center gap-3 relative z-10" style={{ background: '#0d0d18', borderColor: '#1a1a2e' }}>
          <span className="text-[9px] sm:text-[10px] font-black tracking-widest" style={{ color: '#818CF8', fontFamily: 'Rajdhani, sans-serif' }}>
            JOGO DE VOLTA
          </span>
          <span className="text-[10px] sm:text-xs font-bold" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
            AGREGADO:
          </span>
          <span className="text-sm sm:text-base font-black tabular-nums" style={{ color: '#C9A84C', fontFamily: 'Bebas Neue, sans-serif' }}>
            {homeTeam.name.split(' ')[0].toUpperCase()} {homeScore + firstLeg.home} - {awayScore + firstLeg.away} {awayTeam.name.split(' ')[0].toUpperCase()}
          </span>
          <span className="hidden sm:inline text-[9px] text-gray-600" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            (1ª mão {firstLeg.home}-{firstLeg.away})
          </span>
        </div>
      )}

      {/* ── 3. MAIN SIMULATION INTERFACE ── */}
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 overflow-y-auto lg:overflow-hidden relative z-10">
        
        {/* LEFT COLUMN: live feed */}
        <div className="lg:col-span-2 flex flex-col min-h-[300px] sm:min-h-[420px] lg:min-h-0 lg:h-full rounded-2xl overflow-hidden border flex-shrink-0" style={{ background: '#0b0b14', borderColor: '#171725' }}>
          
          {/* Live broadcast commentary banner */}
          <div className="p-2 sm:p-3 border-b flex flex-col justify-center flex-shrink-0" style={{ background: 'linear-gradient(90deg, #0e0e1d, #14142b)', borderColor: '#171725' }}>
            <span className="text-[9px] sm:text-[10px] font-black text-yellow-500 tracking-widest uppercase mb-0.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              AO VIVO
            </span>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-sm sm:text-base font-bold text-yellow-500 tabular-nums min-w-[28px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {minute}'
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={latestEvent ? latestEvent.description : 'start'}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-sm sm:text-base font-extrabold text-white leading-tight uppercase break-words"
                  style={{ fontFamily: 'Rajdhani, sans-serif' }}
                >
                  {latestEvent ? latestEvent.description : 'Árbitro posiciona a bola. Arquibancadas cantam forte!'}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Live Suspense Danger / Threat Meter Overlay */}
          <AnimatePresence>
            {dangerState && (() => {
              // Colour-code the threat by side: GREEN = your team is attacking (your
              // chance), RED = the opponent is attacking your goal (defend!).
              const dangerForMe = dangerState.teamId === myTeam.id;
              const accent = dangerForMe ? '#22C55E' : '#EF4444';
              const label = dangerForMe ? '⚔️ CHANCE DO SEU TIME!' : '🛡️ PERIGO NO SEU GOL!';
              const bar = dangerForMe
                ? 'linear-gradient(90deg,#15803d,#4ade80,#22c55e)'
                : 'linear-gradient(90deg,#a16207,#facc15,#ef4444)';
              return (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="border-b p-2.5 sm:p-3.5 flex flex-col flex-shrink-0 relative"
                style={{ background: `${accent}1a`, borderColor: `${accent}4d` }}
              >
                <div className="absolute inset-0 animate-pulse" style={{ background: `${accent}0d` }} />
                <div className="flex items-center justify-between mb-1.5 z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ background: accent }} />
                    <span className="text-[10px] sm:text-xs font-black tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: accent }}>
                      {label}
                    </span>
                  </div>
                  <span className="text-[10px] font-black" style={{ fontFamily: 'Rajdhani, sans-serif', color: accent }}>
                    ETAPA {dangerState.stage}/3
                  </span>
                </div>

                {/* Threat bar — colour reflects who the chance favours */}
                <div className="h-2 w-full rounded-full overflow-hidden mb-2 z-10" style={{ background: '#00000055' }}>
                  <motion.div
                    className="h-full"
                    style={{ background: bar }}
                    initial={{ width: '0%' }}
                    animate={{ width: dangerState.stage === 1 ? '35%' : dangerState.stage === 2 ? '70%' : '100%' }}
                    transition={{ duration: 0.8 }}
                  />
                </div>

                <p className="text-xs sm:text-sm font-black text-white uppercase tracking-wide leading-tight z-10" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {dangerState.message}
                </p>
              </motion.div>
              );
            })()}
          </AnimatePresence>

          <div className="px-3 sm:px-5 py-2 sm:py-2.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: '#171725', background: '#08080f' }}>
            <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-gray-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              TRANSMISSÃO DE LANCES
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-[9px] font-black text-red-500 tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif' }}>AO VIVO</span>
            </div>
          </div>

          {/* FIXED HEIGHT TIMELINE FEED */}
          <div
            ref={eventFeedRef}
            className="flex-1 min-h-0 basis-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 space-y-2.5 sm:space-y-3.5 scroll-smooth"
            style={{ background: '#08080f' }}
          >
            {events.filter(event => event.type === 'goal' || event.type === 'penalty').length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col text-center text-gray-500 py-8" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                <span className="text-5xl sm:text-6xl mb-3 animate-bounce">⚽</span>
                <span className="text-sm sm:text-base font-bold text-white tracking-wide">ÁRBITRO APITA O INÍCIO!</span>
                <span className="text-xs text-gray-500 mt-1 max-w-xs">A bola rola. Que vença a melhor estratégia!</span>
              </div>
            ) : (
              events
                .filter(event => event.type === 'goal' || event.type === 'penalty')
                .map((event, idx) => {
                  const isPlayerEvent = event.teamId === playerTeamId;
                  const isGoal = event.type === 'goal';
                  const accentColor   = isPlayerEvent ? '#22c55e' : '#ef4444';
                  const bgColor       = isPlayerEvent
                    ? 'rgba(34, 197, 94, 0.07)'
                    : 'rgba(239, 68, 68, 0.07)';
                  const borderColor   = isPlayerEvent
                    ? 'rgba(34, 197, 94, 0.25)'
                    : 'rgba(239, 68, 68, 0.25)';

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: isPlayerEvent ? -14 : 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all border"
                      style={{ background: bgColor, borderColor }}
                    >
                      {/* Coloured left accent bar */}
                      <div className="w-0.5 rounded-full flex-shrink-0 self-stretch" style={{ background: accentColor }} />

                      <span
                        className="font-extrabold text-xs sm:text-sm tabular-nums flex-shrink-0 w-7 sm:w-8"
                        style={{ fontFamily: 'Rajdhani, sans-serif', color: accentColor }}
                      >
                        {event.minute}'
                      </span>

                      <span className="text-sm sm:text-base flex-shrink-0">
                        {getEventIcon(event.type)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs sm:text-sm font-semibold leading-snug"
                          style={{ fontFamily: 'Rajdhani, sans-serif', color: isGoal ? accentColor : '#dfdfe8' }}
                        >
                          {stripLeadingEmoji(event.description)}
                        </p>
                        {/* Team label badge */}
                        <span
                          className="text-[9px] font-black tracking-widest uppercase mt-0.5 inline-block px-1.5 py-0.5 rounded"
                          style={{
                            fontFamily: 'Rajdhani, sans-serif',
                            color: accentColor,
                            background: isPlayerEvent ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          }}
                        >
                          {isPlayerEvent ? '▲ A FAVOR' : '▼ ADVERSÁRIO'}
                        </span>
                        {event.isSpecial && (
                          <span className="text-[10px] text-yellow-500 font-extrabold tracking-widest mt-0.5 block animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                            ✨ HABILIDADE DE IMORTAL ATIVADA
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: stats + squad buttons */}
        <div className="lg:col-span-1 flex flex-col min-h-0 lg:h-full gap-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={() => setSquadModal('mine')}
              className="py-3 sm:py-4 px-3 rounded-xl border font-black text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02]"
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                background: 'linear-gradient(135deg, #14142a, #0b0b14)',
                borderColor: '#c9a84c55',
                color: '#C9A84C',
              }}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><Shirt size={15} /> MEU TIME</span>
              <span className="block text-[9px] sm:text-[10px] font-bold mt-1 truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#8A8A9A' }}>
                {myTeam.name}
              </span>
            </button>
            <button
              onClick={() => setSquadModal('opponent')}
              className="py-3 sm:py-4 px-3 rounded-xl border font-black text-xs sm:text-sm tracking-widest transition-all hover:scale-[1.02]"
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                background: 'linear-gradient(135deg, #14142a, #0b0b14)',
                borderColor: '#6366f155',
                color: '#818CF8',
              }}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><Eye size={15} /> ADVERSÁRIO</span>
              <span className="block text-[9px] sm:text-[10px] font-bold mt-1 truncate" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#8A8A9A' }}>
                {oppTeam.name}
              </span>
            </button>
          </div>

          <div className="flex-shrink-0 space-y-3">
            {renderMomentumChart()}
            <div className="bg-[#0b0b14] border border-[#171725] rounded-2xl p-3 flex flex-col">
              <span className="text-[10px] font-black text-yellow-500 tracking-widest uppercase mb-2" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                ESTATÍSTICAS (AO VIVO)
              </span>
              <div className="space-y-2">
                {[
                  { label: 'Posse (%)', homeVal: currentStats.homePos, awayVal: currentStats.awayPos },
                  { label: 'Finalizações', homeVal: currentStats.homeShots, awayVal: currentStats.awayShots },
                  { label: 'No Alvo', homeVal: currentStats.homeShotsOnTarget, awayVal: currentStats.awayShotsOnTarget },
                  { label: 'Escanteios', homeVal: currentStats.homeCorners, awayVal: currentStats.awayCorners },
                  { label: 'Faltas', homeVal: currentStats.homeFouls, awayVal: currentStats.awayFouls },
                  { label: 'Defesas', homeVal: currentStats.homeSaves, awayVal: currentStats.awaySaves },
                ].map((s, i) => {
                  const total = s.homeVal + s.awayVal || 1;
                  const hPct = (s.homeVal / total) * 100;
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] font-bold text-gray-300" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                        <span style={{ color: '#ffd700' }}>{s.homeVal}</span>
                        <span className="text-gray-500 text-[8px] tracking-wider uppercase">{s.label}</span>
                        <span style={{ color: '#6366f1' }}>{s.awayVal}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden flex" style={{ background: '#141426' }}>
                        <div className="h-full bg-yellow-500 transition-all duration-300" style={{ width: `${hPct}%` }} />
                        <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${100 - hPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. SQUAD MODAL ── */}
      <AnimatePresence>
        {squadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0b14] border rounded-2xl p-5 max-w-md w-full max-h-[85vh] flex flex-col"
              style={{ borderColor: squadModal === 'mine' ? '#c9a84c55' : '#6366f155' }}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black tracking-widest uppercase" style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    color: squadModal === 'mine' ? '#C9A84C' : '#818CF8',
                  }}>
                    {squadModal === 'mine' ? 'MEU TIME' : 'ADVERSÁRIO'}
                  </h3>
                  <p className="text-sm font-bold text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    {(squadModal === 'mine' ? myTeam : oppTeam).name}
                  </p>
                </div>
                <button
                  onClick={() => setSquadModal(null)}
                  className="text-gray-400 hover:text-white text-2xl font-black"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {(squadModal === 'mine' ? myTeam : oppTeam).players.map(p => {
                  const st = getDisplayStat(p.statId!);
                  return renderSquadRow(p, getDisplayRating(p.statId!), st?.goals ?? 0, st?.assists ?? 0);
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Live tactic change (solo) ── */}
      <AnimatePresence>
        {showTactics && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={() => setShowTactics(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0b0b14] border border-[#1d1d2f] rounded-2xl p-5 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black tracking-widest uppercase inline-flex items-center gap-2" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#818CF8' }}>
                  <Brain size={18} /> MUDAR TÁTICA
                </h3>
                <button onClick={() => setShowTactics(false)} className="text-gray-400 hover:text-white text-xl font-black">✕</button>
              </div>
              <p className="text-[11px] mb-3" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                Vale <b style={{ color: '#FFF' }}>a partir de agora</b>, só nesta partida. {myTeam.name} está em <b style={{ color: '#C9A84C' }}>{getTacticById(myTeam.playStyle).name}</b>.
              </p>
              <TacticSelector
                value={myTeam.playStyle}
                onChange={(id) => setMyTeam(prev => ({ ...prev, playStyle: id }))}
              />
              <button
                onClick={() => { setShowTactics(false); if (!isFinished && !penaltyMode) setIsPlaying(true); }}
                className="w-full mt-3 py-3 rounded-xl font-black tracking-widest"
                style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg, #C9A84C, #E8C84A)', color: '#080810' }}
              >
                VOLTAR AO JOGO →
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 5. PENALTY SHOOTOUT OVERLAY ── */}
      <AnimatePresence>
        {penaltyMode && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(4,4,10,0.95)', backdropFilter: 'blur(10px)' }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl rounded-3xl overflow-hidden"
              style={{ background: 'linear-gradient(165deg,#12121f 0%,#0a0a14 100%)', border: '1px solid rgba(255,215,0,0.28)', boxShadow: '0 0 60px rgba(255,215,0,0.12)' }}
            >
              {/* Header */}
              <div className="px-6 py-4 text-center" style={{ background: 'linear-gradient(135deg,#1c1636,#0f0f1e)', borderBottom: '1px solid rgba(255,215,0,0.18)' }}>
                <div className="inline-flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] font-black tracking-[0.22em] text-red-400" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    AO VIVO · DECISÃO POR PÊNALTIS
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#ffd700' }}>
                  DISPUTA DE PÊNALTIS
                </h2>
              </div>

              {/* Scoreboard */}
              <div className="px-5 sm:px-6 py-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                  {[{ team: homeTeam, pens: penaltiesHome }, null, { team: awayTeam, pens: penaltiesAway }].map((col, ci) => {
                    if (!col) return (
                      <div key="score" className="text-center px-1">
                        <div className="text-4xl sm:text-5xl font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#fff' }}>
                          {penaltyHomeScore}<span className="text-gray-600 mx-1.5 sm:mx-2">-</span>{penaltyAwayScore}
                        </div>
                        <div className="text-[9px] font-bold tracking-widest text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>PLACAR</div>
                      </div>
                    );
                    const shooting = penaltyKickPending === col.team.id;
                    const slots = Math.max(5, col.pens.length + (shooting ? 1 : 0));
                    return (
                      <div key={ci} className="text-center rounded-2xl py-3 px-2 transition-all"
                        style={{ background: shooting ? 'rgba(255,215,0,0.08)' : 'transparent', border: `1px solid ${shooting ? 'rgba(255,215,0,0.4)' : 'transparent'}`, boxShadow: shooting ? '0 0 18px rgba(255,215,0,0.15)' : 'none' }}>
                        <h3 className="text-base sm:text-lg font-black truncate leading-tight" style={{ fontFamily: 'Bebas Neue, sans-serif', color: shooting ? '#ffd700' : '#fff' }}>
                          {col.team.name.toUpperCase()}
                        </h3>
                        <div className="h-3.5">
                          {shooting && <div className="text-[9px] font-black tracking-widest text-yellow-500 animate-pulse" style={{ fontFamily: 'Rajdhani, sans-serif' }}>▼ COBRANDO</div>}
                        </div>
                        <div className="flex gap-1 justify-center mt-1.5 flex-wrap">
                          {Array.from({ length: slots }).map((_, i) => {
                            const v = col.pens[i];
                            const isNext = shooting && i === col.pens.length;
                            return (
                              <div key={i} className={`w-3.5 h-3.5 rounded-full ${isNext ? 'animate-pulse' : ''}`} style={{
                                background: v === true ? '#22c55e' : v === false ? '#ef4444' : '#141426',
                                border: `1px solid ${isNext ? '#ffd700' : '#1f1f35'}`,
                                boxShadow: isNext ? '0 0 8px rgba(255,215,0,0.6)' : 'none',
                              }} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live narrative */}
              <div className="px-5 sm:px-6">
                <div className="rounded-2xl px-4 py-4 min-h-[88px] flex items-center justify-center text-center" style={{ background: '#06060d', border: '1px solid #1a1a2c' }}>
                  <p className="text-sm sm:text-base font-bold text-gray-100 uppercase whitespace-pre-line leading-relaxed" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    {penaltyCommentary}
                  </p>
                </div>
              </div>

              {/* Action / winner */}
              <div className="px-5 sm:px-6 pb-6 pt-4 text-center">
                {penaltyWinner ? (
                  <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <div className="text-2xl sm:text-3xl font-black text-yellow-500 mb-4 tracking-wider" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      🏆 {penaltyWinner === homeTeam.id ? homeTeam.name.toUpperCase() : awayTeam.name.toUpperCase()} AVANÇA!
                    </div>
                    <button
                      onClick={handleFinish}
                      className="px-8 py-3 rounded-xl font-black text-lg tracking-widest cursor-pointer"
                      style={{ fontFamily: 'Bebas Neue, sans-serif', background: 'linear-gradient(135deg, #ffd700, #e8c84a)', color: '#080810', boxShadow: '0 0 25px rgba(255, 215, 0, 0.4)' }}
                    >
                      CONCLUIR →
                    </button>
                  </motion.div>
                ) : isReplay ? (
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-yellow-500/70" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> A DISPUTA ESTÁ SENDO DECIDIDA...
                  </div>
                ) : (
                  <button
                    onClick={handleTakePenalty}
                    disabled={state.mode === 'online' && !isSimulatorHost}
                    className="px-8 py-3.5 rounded-xl font-black text-lg tracking-widest"
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      background: 'linear-gradient(135deg,#ffd700,#e8c84a)', color: '#080810',
                      boxShadow: '0 0 20px rgba(234,179,8,0.3)',
                      opacity: (state.mode === 'online' && !isSimulatorHost) ? 0.5 : 1,
                      cursor: (state.mode === 'online' && !isSimulatorHost) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {(penaltiesHome.length === penaltiesAway.length) ? 'COBRAR PÊNALTI' : 'DEFENDER PÊNALTI'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 6. FOOTER CONTROL CENTER ── */}
      <div className="py-3 px-3 sm:py-4 sm:px-6 border-t flex flex-col sm:flex-row sm:flex-wrap items-center justify-between gap-2 sm:gap-4 z-10 flex-shrink-0" style={{ background: '#0b0b14', borderColor: '#171725' }}>
        
        {/* Speed selectors and Simulation control — hidden in online broadcast mode */}
        {broadcastMode ? (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            {!isFinished && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, letterSpacing: '0.18em', color: '#ff6b6b', fontSize: 13 }}>AO VIVO</span>
              </span>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-start">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isFinished || penaltyMode || (state.mode === 'online' && !isSimulatorHost)}
            className="px-5 sm:px-6 py-2.5 rounded-xl font-bold text-sm tracking-wider transition-all"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              background: isFinished ? '#1a1a2e' : isPlaying ? '#EF4444' : '#22C55E',
              color: '#fff',
              opacity: isFinished || (state.mode === 'online' && !isSimulatorHost) ? 0.5 : 1,
              cursor: isFinished || (state.mode === 'online' && !isSimulatorHost) ? 'not-allowed' : 'pointer',
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
              {isPlaying ? 'PAUSAR' : 'SIMULAR'}
            </span>
          </button>

          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            {([1, 2, 4] as const).map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                disabled={isFinished || (state.mode === 'online' && !isSimulatorHost)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  background: speed === s ? '#c9a84c' : '#0e0e1a',
                  color: speed === s ? '#000' : '#8a8a9a',
                  opacity: (state.mode === 'online' && !isSimulatorHost) ? 0.5 : 1,
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Live tactic change — solo only, situational mid-match decision */}
          {!isFinished && !penaltyMode && (
            <button
              onClick={() => { setIsPlaying(false); setShowTactics(true); }}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl font-bold text-sm tracking-wider border transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                borderColor: '#6366f155',
                background: 'linear-gradient(135deg, #14142a, #0b0b14)',
                color: '#818CF8',
              }}
              title="Mudar a tática do seu time durante a partida"
            >
              <Brain size={15} /> TÁTICA
            </button>
          )}
        </div>
        )}

        {/* Skip & Conclude Match Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-end">
          {!isFinished && !penaltyMode && !broadcastMode && state.mode !== 'online' && (
            <button
              onClick={handleSkip}
              className="px-4 sm:px-6 py-2.5 rounded-xl font-bold text-sm tracking-wider border transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                borderColor: '#171725',
                color: '#8a8a9a',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <span className="inline-flex items-center gap-1.5"><SkipForward size={15} /> PULAR</span>
            </button>
          )}

          {isFinished ? (
            <button
              onClick={handleFinish}
              className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-black text-base sm:text-lg tracking-widest cursor-pointer shadow-lg transition-transform hover:scale-[1.03]"
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                background: 'linear-gradient(135deg, #c9a84c, #e8c84a)',
                color: '#080810',
                boxShadow: '0 0 25px rgba(201, 168, 76, 0.4)',
              }}
            >
              CONCLUIR →
            </button>
          ) : (
            <button
              disabled
              className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-black text-base sm:text-lg tracking-widest opacity-40 cursor-not-allowed"
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                background: '#1A1A2A',
                color: '#555',
              }}
            >
              {penaltyMode ? 'PÊNALTIS' : 'JOGANDO...'}
            </button>
          )}
        </div>
      </div>

      {/* Ticker styling override for custom thin scrolls */}
      <style>{`
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.01);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.22);
        }
      `}</style>
    </div>
  );
}
