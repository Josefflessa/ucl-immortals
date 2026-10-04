-- Career achievements and the profile showcase (mural).
-- Achievements are derived from competition_history by the server (see
-- shared/game/achievements.ts). One row per account and achievement keeps the
-- level reached (0 = locked, 1..4 = Bronze..Lendário) and the current progress.

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
  progress INTEGER NOT NULL DEFAULT 0,
  -- Who drives the progress of a "most with one X" achievement (coach or crest id).
  detail TEXT,
  -- When the current level was reached (NULL while locked).
  unlocked_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rarity: how many evaluated players hold each achievement level.
CREATE INDEX IF NOT EXISTS idx_user_achievements_rarity
  ON user_achievements(achievement_id, level);

-- Which achievement definitions an account was last evaluated with. Accounts
-- below the current version are re-evaluated from their history on access, so
-- existing players receive what their history already proves.
ALTER TABLE profile_stats
  ADD COLUMN achievements_version INTEGER NOT NULL DEFAULT 0;

-- The items a player pinned to the profile mural, in order (JSON array).
ALTER TABLE profiles
  ADD COLUMN showcase_json TEXT NOT NULL DEFAULT '[]';
