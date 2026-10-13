-- Move sixteen existing profile covers into the appearance shop. Accounts that
-- were using one of these presets fall back to the original starter cover.
-- A custom uploaded cover_url is preserved and remains visible.
UPDATE profiles
SET cover_key = 'cover-01'
WHERE cover_key IN (
  'cover-04', 'cover-05', 'cover-06', 'cover-07',
  'cover-10', 'cover-12', 'cover-13', 'cover-14',
  'cover-16', 'cover-17', 'cover-18', 'cover-20',
  'cover-21', 'cover-22', 'cover-23', 'cover-24'
);
