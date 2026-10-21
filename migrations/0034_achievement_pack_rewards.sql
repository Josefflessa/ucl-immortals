-- One album pack for each achievement tier reached by an account.
-- The unique key makes new and retroactive rewards safe to reconcile repeatedly.
DROP INDEX IF EXISTS idx_user_achievements_rarity;
ALTER TABLE user_achievements RENAME TO user_achievements_before_immortal;

CREATE TABLE user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
  progress INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  unlocked_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO user_achievements (user_id, achievement_id, level, progress, detail, unlocked_at, updated_at)
SELECT user_id, achievement_id, level, progress, detail, unlocked_at, updated_at
FROM user_achievements_before_immortal;

DROP TABLE user_achievements_before_immortal;

CREATE INDEX IF NOT EXISTS idx_user_achievements_rarity
  ON user_achievements(achievement_id, level);

CREATE TABLE IF NOT EXISTS user_achievement_pack_rewards (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, achievement_id, level),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_achievement_pack_rewards_user
  ON user_achievement_pack_rewards(user_id, granted_at DESC);
