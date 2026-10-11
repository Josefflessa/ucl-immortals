ALTER TABLE album_friend_trades
  ADD COLUMN requester_ready INTEGER NOT NULL DEFAULT 0 CHECK (requester_ready IN (0, 1));

ALTER TABLE album_friend_trades
  ADD COLUMN addressee_ready INTEGER NOT NULL DEFAULT 0 CHECK (addressee_ready IN (0, 1));

-- There can be only one live negotiation between a pair of friends at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_album_friend_trades_one_live
  ON album_friend_trades(friendship_id)
  WHERE status IN ('pending', 'processing');
