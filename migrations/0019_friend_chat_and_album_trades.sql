-- Direct messages are visible for 24 hours. Friend removal deletes the conversation.
CREATE TABLE IF NOT EXISTS friend_messages (
  id TEXT PRIMARY KEY NOT NULL,
  friendship_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (friendship_id) REFERENCES friendships(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friend_messages_conversation_time
  ON friend_messages(friendship_id, created_at);
CREATE INDEX IF NOT EXISTS idx_friend_messages_expiry
  ON friend_messages(expires_at);

-- A trade gives one or more spare copies from each side. The applied album copy is never moved.
CREATE TABLE IF NOT EXISTS album_friend_trades (
  id TEXT PRIMARY KEY NOT NULL,
  friendship_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  requester_card_id TEXT NOT NULL,
  requester_quantity INTEGER NOT NULL CHECK (requester_quantity BETWEEN 1 AND 999),
  addressee_card_id TEXT,
  addressee_quantity INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (requester_id <> addressee_id),
  FOREIGN KEY (friendship_id) REFERENCES friendships(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_album_friend_trades_friend_status
  ON album_friend_trades(friendship_id, status, created_at DESC);
