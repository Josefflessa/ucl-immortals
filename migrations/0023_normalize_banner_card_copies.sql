-- The first banner prototype duplicated catalogue cards with a _store_exclusive
-- suffix. The banner now awards the normal catalogue card itself; fold any
-- prototype ownership into that card and discard the synthetic account unlock.
INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at)
SELECT user_id,
       substr(card_id, 1, length(card_id) - 16),
       copies,
       spare,
       first_at,
       updated_at
FROM user_stickers
WHERE substr(card_id, length(card_id) - 15, 16) = '_store_exclusive'
ON CONFLICT(user_id, card_id) DO UPDATE SET
  copies = user_stickers.copies + excluded.copies,
  spare = user_stickers.spare + excluded.spare,
  first_at = MIN(user_stickers.first_at, excluded.first_at),
  updated_at = MAX(user_stickers.updated_at, excluded.updated_at);

DELETE FROM user_stickers
WHERE substr(card_id, length(card_id) - 15, 16) = '_store_exclusive';

DELETE FROM user_event_cards
WHERE substr(card_id, length(card_id) - 15, 16) = '_store_exclusive';
