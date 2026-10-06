-- Choice events (shared/game/events.ts): the account picks one option for good
-- and, by completing its objectives, unlocks that option's event Única, which
-- then joins its own Pacote Único pool. Progress comes from competition_history.

CREATE TABLE IF NOT EXISTS user_event_choices (
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  choice_key TEXT NOT NULL,
  chosen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_event_cards (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  -- The event that granted it.
  event_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, card_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
