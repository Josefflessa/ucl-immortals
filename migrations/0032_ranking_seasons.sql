-- Ranking seasons (shared/game/seasons.ts): the score ranking and the public
-- records are read per season, by the completion time of each competition.
-- When a season closes, the server pays its top 10 once.

-- One row per closed season that was already paid.
CREATE TABLE IF NOT EXISTS season_finalizations (
  season INTEGER PRIMARY KEY,
  finalized_at INTEGER NOT NULL
);

-- The final position and prize of each paid account. The primary key makes every
-- grant idempotent: a grant only runs while this row does not exist yet.
CREATE TABLE IF NOT EXISTS season_rewards (
  season INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  points INTEGER NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (season, user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_season_rewards_user ON season_rewards(user_id, season);
CREATE INDEX IF NOT EXISTS idx_competition_history_completed_at ON competition_history(completed_at);
CREATE INDEX IF NOT EXISTS idx_competition_records_completed_at ON competition_records(completed_at);
