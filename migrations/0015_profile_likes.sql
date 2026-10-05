-- Profile likes: an account can like another player's profile once.

CREATE TABLE IF NOT EXISTS profile_likes (
  -- The profile that was liked.
  user_id TEXT NOT NULL,
  liker_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, liker_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (liker_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profile_likes_liker ON profile_likes(liker_id);
