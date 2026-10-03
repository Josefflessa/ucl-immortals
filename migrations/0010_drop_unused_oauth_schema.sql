-- Google/OAuth login was replaced by local username + password accounts.
-- Nothing reads or writes these tables/column anymore.
DROP INDEX IF EXISTS idx_oauth_accounts_user_id;
DROP TABLE IF EXISTS oauth_accounts;

DROP INDEX IF EXISTS idx_oauth_states_expires_at;
DROP TABLE IF EXISTS oauth_states;

-- Password recovery codes were never implemented.
ALTER TABLE users DROP COLUMN recovery_code_hash;
