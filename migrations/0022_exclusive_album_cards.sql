-- Event and weekly-store exclusive cards share the album's normal copy, upgrade,
-- duplicate and sale mechanics while staying outside country and club page totals.
INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at)
SELECT user_id, card_id, 1, 0, unlocked_at, unlocked_at
FROM user_event_cards
WHERE true
ON CONFLICT(user_id, card_id) DO NOTHING;
