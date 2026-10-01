-- Effective overalls are not capped at 150. Normalize saved record cards from
-- each competition's per-player snapshot, falling back to its effective-overall
-- record when the full snapshot has already been archived.
CREATE INDEX IF NOT EXISTS idx_competition_records_comp_player_category
  ON competition_records(competition_id, player_id, category);

UPDATE competition_records
SET value = COALESCE((
  SELECT CAST(player_overall.value AS INTEGER)
  FROM competition_history h
  JOIN json_each(CASE WHEN json_valid(h.report_json)
    THEN COALESCE(json_extract(h.report_json, '$.historySnapshot.effectiveOverallByPlayerId'), '{}')
    ELSE '{}'
  END) player_overall ON player_overall.key = competition_records.player_id
  WHERE h.id = competition_records.competition_id
    AND player_overall.type IN ('integer', 'real')
    AND CAST(player_overall.value AS INTEGER) >= 1
  LIMIT 1
), value)
WHERE category = 'effective_overall';

UPDATE competition_records
SET player_card_json = json_set(player_card_json, '$.overall', COALESCE(
  (SELECT CAST(player_overall.value AS INTEGER)
   FROM competition_history h
   JOIN json_each(CASE WHEN json_valid(h.report_json)
     THEN COALESCE(json_extract(h.report_json, '$.historySnapshot.effectiveOverallByPlayerId'), '{}')
     ELSE '{}'
   END) player_overall ON player_overall.key = competition_records.player_id
   WHERE h.id = competition_records.competition_id
     AND player_overall.type IN ('integer', 'real')
     AND CAST(player_overall.value AS INTEGER) >= 1
   LIMIT 1),
  (SELECT MAX(e.value)
   FROM competition_records e
   WHERE e.competition_id = competition_records.competition_id
     AND e.player_id = competition_records.player_id
     AND e.category = 'effective_overall'),
  CAST(json_extract(player_card_json, '$.overall') AS INTEGER)
))
WHERE json_valid(player_card_json)
  AND json_type(player_card_json, '$.overall') IN ('integer', 'real');

-- Newer snapshots preserve the complete effective card stats. Keep the denormalized
-- record card aligned with them before those full snapshots are archived.
WITH saved_stats AS (
  SELECT r.id,
    (SELECT player_stats.value
     FROM competition_history h
     JOIN json_each(CASE WHEN json_valid(h.report_json)
       THEN COALESCE(json_extract(h.report_json, '$.historySnapshot.effectiveStatsByPlayerId'), '{}')
       ELSE '{}'
     END) player_stats ON player_stats.key = r.player_id
     WHERE h.id = r.competition_id
     LIMIT 1) AS stats_json
  FROM competition_records r
  WHERE json_valid(r.player_card_json)
)
UPDATE competition_records
SET player_card_json = json_set(player_card_json, '$.effectiveStats', json_object(
  'overall', CAST(json_extract(saved_stats.stats_json, '$.overall') AS INTEGER),
  'pace', CAST(json_extract(saved_stats.stats_json, '$.pace') AS INTEGER),
  'shooting', CAST(json_extract(saved_stats.stats_json, '$.shooting') AS INTEGER),
  'passing', CAST(json_extract(saved_stats.stats_json, '$.passing') AS INTEGER),
  'dribbling', CAST(json_extract(saved_stats.stats_json, '$.dribbling') AS INTEGER),
  'defending', CAST(json_extract(saved_stats.stats_json, '$.defending') AS INTEGER),
  'physical', CAST(json_extract(saved_stats.stats_json, '$.physical') AS INTEGER),
  'vision', CAST(json_extract(saved_stats.stats_json, '$.vision') AS INTEGER),
  'composure', CAST(json_extract(saved_stats.stats_json, '$.composure') AS INTEGER)
))
FROM saved_stats
WHERE saved_stats.id = competition_records.id
  AND json_valid(saved_stats.stats_json)
  AND json_type(saved_stats.stats_json) = 'object';
