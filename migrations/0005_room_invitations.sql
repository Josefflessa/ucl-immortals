PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS room_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  room_code TEXT NOT NULL CHECK (length(room_code) = 4),
  inviter_user_id TEXT NOT NULL,
  invitee_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (inviter_user_id <> invitee_user_id),
  FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invitee_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_invitations_inbox
  ON room_invitations(invitee_user_id, status, expires_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_invitations_room
  ON room_invitations(room_code, status, expires_at);
