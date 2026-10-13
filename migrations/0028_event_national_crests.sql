-- National-team crests earned from account events remain available permanently.
CREATE TABLE IF NOT EXISTS user_event_crests (
  user_id TEXT NOT NULL,
  crest_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, crest_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
