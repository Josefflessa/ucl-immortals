-- These Únicas moved from the general pool to the weekly banner. Preserve access
-- for accounts that already had one in their album before the catalogue change.
INSERT OR IGNORE INTO user_event_cards (user_id, card_id, event_id, unlocked_at)
SELECT user_id, card_id, 'weekly-banner-pool-rebalance', first_at
FROM user_stickers
WHERE card_id IN (
  'cruyff_unico',
  'cristiano_unico',
  'lewandowski_unico',
  'kroos_unico',
  'rogerio_ceni_unico',
  'adriano_unico',
  'ronaldo_unico',
  'gattuso_unico',
  'nesta_unico',
  'delpiero_unico',
  'dani_alves_unico',
  'roberto_carlos_unico',
  'sergio_ramos_unico',
  'pele_unico',
  'xavi_unico',
  'shevchenko_unico',
  'zidane_unico',
  'figo_unico'
);
