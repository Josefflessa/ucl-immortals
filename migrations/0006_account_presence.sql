PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS account_presence (
  user_id TEXT NOT NULL,
  presence_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'busy', 'away')),
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, presence_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_presence_freshness
  ON account_presence(updated_at, user_id, status);
