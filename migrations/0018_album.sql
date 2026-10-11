-- Álbum dos Imortais (shared/game/album.ts, server/album.ts): the account's stickers, the
-- packs in its inventory, its album coins, the daily pack, and what completing pages unlocked.
-- Everything is granted, opened, sold and bought by the server; campaign packs come from
-- competition_history (each finished competition is rewarded once).

-- One row per account, created on account album load or when it records a campaign.
CREATE TABLE IF NOT EXISTS user_album (
  user_id TEXT PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 0,
  -- UTC day (YYYY-MM-DD) the daily pack was last claimed.
  daily_claimed_day TEXT,
  -- Campaign rewards start here; older competitions are not granted retroactively.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Generic inventory: item key (pack:gold, envelope:silver, ...) and how many.
CREATE TABLE IF NOT EXISTS user_inventory (
  user_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- A card in the album: copies applied (its level: 1, 2, 4, 7, 10 copies = ★1..★5) and spare
-- copies waiting to be applied or sold.
CREATE TABLE IF NOT EXISTS user_stickers (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1),
  spare INTEGER NOT NULL DEFAULT 0 CHECK (spare >= 0),
  first_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, card_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Finished competitions already rewarded with album packs (never twice).
CREATE TABLE IF NOT EXISTS album_competition_grants (
  competition_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_album_competition_grants_user ON album_competition_grants(user_id);

-- Pages the account completed, and at what size: a page that grows (new cards) and is
-- completed again gives a smaller reward again.
CREATE TABLE IF NOT EXISTS user_album_pages (
  user_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  completed_size INTEGER NOT NULL,
  completions INTEGER NOT NULL DEFAULT 1,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, page_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Profile covers unlocked by the account (a completed club's own cover).
CREATE TABLE IF NOT EXISTS user_covers (
  user_id TEXT NOT NULL,
  cover_key TEXT NOT NULL,
  source TEXT,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, cover_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
