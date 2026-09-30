PRAGMA foreign_keys = ON;

-- Older history rows contain only summary totals, so they cannot reproduce the
-- end-of-season result screen. Remove those rows for every account. Linked
-- public records are intentionally removed by the competition_records cascade;
-- aggregate profile_stats are independent lifetime totals and remain intact.
DELETE FROM competition_history
WHERE CASE
  WHEN json_valid(report_json) THEN json_extract(report_json, '$.historySnapshot.version')
  ELSE NULL
END IS NOT 1;
