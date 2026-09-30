PRAGMA foreign_keys = ON;

ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN cover_url TEXT;

ALTER TABLE competition_history ADD COLUMN source_key TEXT;

ALTER TABLE competition_records ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_history_source
  ON competition_history(user_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competition_records_public_top10
  ON competition_records(verified, difficulty_id, category, value DESC, created_at ASC);
