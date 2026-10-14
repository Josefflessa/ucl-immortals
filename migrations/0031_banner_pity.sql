-- Keep each account's banner protection across rotations, reloads and devices.
ALTER TABLE user_album ADD COLUMN daily_banner_pity INTEGER NOT NULL DEFAULT 0
  CHECK (daily_banner_pity >= 0 AND daily_banner_pity < 15);
ALTER TABLE user_album ADD COLUMN weekly_banner_pity INTEGER NOT NULL DEFAULT 0
  CHECK (weekly_banner_pity >= 0 AND weekly_banner_pity < 40);

-- Serialize same-banner purchases so simultaneous requests cannot bypass or consume pity twice.
ALTER TABLE user_album ADD COLUMN daily_banner_lock_token TEXT;
ALTER TABLE user_album ADD COLUMN daily_banner_lock_until INTEGER;
ALTER TABLE user_album ADD COLUMN weekly_banner_lock_token TEXT;
ALTER TABLE user_album ADD COLUMN weekly_banner_lock_until INTEGER;
