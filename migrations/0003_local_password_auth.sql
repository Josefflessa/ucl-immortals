PRAGMA foreign_keys = ON;

-- Local accounts do not require an email provider. The existing users.email
-- column remains a stable internal identifier for older OAuth-created rows.
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked
  ON auth_rate_limits(blocked_until);
