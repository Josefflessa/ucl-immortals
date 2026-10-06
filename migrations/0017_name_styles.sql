-- Name styles: a cosmetic font + effect for the display name (shared/game/nameStyles.ts),
-- unlocked as an event reward. The account keeps the styles it unlocked and shows
-- the one it picked.

CREATE TABLE IF NOT EXISTS user_name_styles (
  user_id TEXT NOT NULL,
  style_key TEXT NOT NULL,
  -- The event that granted it.
  event_id TEXT,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, style_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- The style the display name is shown with (NULL = default).
ALTER TABLE profiles
  ADD COLUMN name_style_key TEXT;
