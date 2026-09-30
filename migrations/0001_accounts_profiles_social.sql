PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_account_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_key TEXT NOT NULL DEFAULT 'mark-evans',
  cover_key TEXT NOT NULL DEFAULT 'cover-01',
  favorite_crest_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY NOT NULL,
  code_verifier TEXT NOT NULL,
  return_path TEXT NOT NULL DEFAULT '/',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS competition_history (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'online')),
  difficulty_id TEXT NOT NULL,
  format_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  crest_id TEXT,
  coach_id TEXT,
  champion INTEGER NOT NULL DEFAULT 0,
  placement INTEGER,
  report_json TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_competition_history_user_date
  ON competition_history(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_competition_history_difficulty
  ON competition_history(difficulty_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS competition_records (
  id TEXT PRIMARY KEY NOT NULL,
  competition_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('goals', 'assists', 'saves', 'effective_overall')),
  difficulty_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_photo_url TEXT,
  value INTEGER NOT NULL,
  username_snapshot TEXT NOT NULL,
  team_name_snapshot TEXT NOT NULL,
  crest_id_snapshot TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (competition_id) REFERENCES competition_history(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_competition_records_top10
  ON competition_records(category, difficulty_id, value DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_competition_records_user
  ON competition_records(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status
  ON friendships(addressee_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status
  ON friendships(requester_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS profile_stats (
  user_id TEXT PRIMARY KEY NOT NULL,
  competitions_completed INTEGER NOT NULL DEFAULT 0,
  titles INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  highest_effective_overall INTEGER NOT NULL DEFAULT 0,
  highest_difficulty_id TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
