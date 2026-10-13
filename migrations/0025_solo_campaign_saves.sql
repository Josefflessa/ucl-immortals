CREATE TABLE IF NOT EXISTS solo_campaign_saves (
  user_id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL,
  saved_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL CHECK (chunk_count > 0),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS solo_campaign_save_chunks (
  user_id TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  chunk_data BLOB NOT NULL,
  PRIMARY KEY (user_id, saved_at, chunk_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
