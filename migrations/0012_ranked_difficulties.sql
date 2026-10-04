-- Accounts can now play every difficulty. The finish stage (furthest stage a
-- campaign reached) becomes its own column, so per-phase counts no longer have
-- to be guessed from the point value, and points become stage x difficulty
-- weight (see shared/game/competitionRanking.ts).

ALTER TABLE competition_history
  ADD COLUMN finish_stage TEXT;

-- Until now every campaign was scored with the full table, so the stored points
-- identify the stage exactly.
UPDATE competition_history
SET finish_stage = CASE
  WHEN champion = 1 THEN 'champion'
  WHEN competition_points = 80 THEN 'runnerUp'
  WHEN competition_points = 60 THEN 'semifinalist'
  WHEN competition_points = 40 THEN 'quarterfinalist'
  WHEN competition_points = 25 THEN 'roundOf16'
  WHEN competition_points = 15 THEN 'playoff'
  WHEN competition_points = 5 THEN 'leaguePhase'
  ELSE NULL
END;

-- One rule for every campaign: online rooms created without an account could
-- already run below Imortal and were scored with the full table. Imortal rows
-- keep their points; unknown difficulties are left untouched.
-- Weights in percent, rounded half up like Math.round:
--   bronze 10 · silver 25 · gold 45 · legendary 70 · immortal 100 (minimum 1).
UPDATE competition_history
SET competition_points = MAX(1, CAST((
  CASE finish_stage
    WHEN 'champion' THEN 100
    WHEN 'runnerUp' THEN 80
    WHEN 'semifinalist' THEN 60
    WHEN 'quarterfinalist' THEN 40
    WHEN 'roundOf16' THEN 25
    WHEN 'playoff' THEN 15
    ELSE 5
  END * CASE difficulty_id
    WHEN 'bronze' THEN 10
    WHEN 'silver' THEN 25
    WHEN 'gold' THEN 45
    ELSE 70
  END + 50) / 100 AS INTEGER))
WHERE finish_stage IS NOT NULL
  AND difficulty_id IN ('bronze', 'silver', 'gold', 'legendary');

CREATE INDEX IF NOT EXISTS idx_competition_history_user_difficulty
  ON competition_history(user_id, difficulty_id, finish_stage);

CREATE INDEX IF NOT EXISTS idx_competition_history_difficulty_points
  ON competition_history(difficulty_id, user_id, competition_points);
