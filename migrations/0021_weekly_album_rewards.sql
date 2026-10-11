-- One account can claim each weekday's album reward once per São Paulo calendar week.
CREATE TABLE IF NOT EXISTS user_weekly_pack_claims (
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  item_key TEXT NOT NULL CHECK (item_key IN ('pack:bronze', 'pack:silver', 'pack:gold', 'pack:legendary')),
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, week_start, day_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_weekly_pack_claims_user_week
  ON user_weekly_pack_claims(user_id, week_start);
