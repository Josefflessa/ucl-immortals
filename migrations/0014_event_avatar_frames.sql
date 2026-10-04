-- Account events and their reward: avatar frames.
-- Frames are unlocked by completing a time-limited event (shared/game/events.ts);
-- progress is derived from competition_history by the server. Once unlocked a
-- frame is kept for good, and the profile shows the one the player equipped.

CREATE TABLE IF NOT EXISTS user_frames (
  user_id TEXT NOT NULL,
  frame_key TEXT NOT NULL,
  -- The event that granted it.
  event_id TEXT,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, frame_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- The frame drawn around the avatar (NULL = none).
ALTER TABLE profiles
  ADD COLUMN avatar_frame_key TEXT;
