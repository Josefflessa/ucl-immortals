-- Existing chat messages predate read tracking; do not show them as newly unread.
ALTER TABLE friend_messages ADD COLUMN read_at INTEGER;

UPDATE friend_messages SET read_at = created_at WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_friend_messages_unread
  ON friend_messages(friendship_id, sender_id, read_at, expires_at);
