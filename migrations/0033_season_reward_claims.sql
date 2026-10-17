-- Season prizes are no longer paid automatically: closing a season freezes the
-- top 10 in season_rewards, and each account claims its prize in the season modal.
-- NULL = not claimed yet.
ALTER TABLE season_rewards
  ADD COLUMN claimed_at INTEGER;
