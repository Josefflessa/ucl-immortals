-- Competition rewards now credit account-store coins exactly once with the existing grant ledger.
ALTER TABLE album_competition_grants
  ADD COLUMN coins_awarded INTEGER NOT NULL DEFAULT 0 CHECK (coins_awarded >= 0);

CREATE TRIGGER IF NOT EXISTS album_competition_coins_after_grant
AFTER INSERT ON album_competition_grants
WHEN NEW.coins_awarded > 0
BEGIN
  UPDATE user_album
  SET coins = coins + NEW.coins_awarded,
      updated_at = NEW.granted_at
  WHERE user_id = NEW.user_id;
END;
