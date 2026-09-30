PRAGMA foreign_keys = ON;

ALTER TABLE competition_history
  ADD COLUMN competition_points INTEGER NOT NULL DEFAULT 0;

UPDATE competition_history
SET competition_points = CASE
  WHEN champion = 1 THEN 100
  WHEN json_valid(report_json) THEN COALESCE(
    CAST(json_extract(report_json, '$.competitionPoints') AS INTEGER),
    CAST(json_extract(report_json, '$.historySnapshot.competitionPoints') AS INTEGER),
    0
  )
  ELSE 0
END;

ALTER TABLE competition_records
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'solo';
ALTER TABLE competition_records
  ADD COLUMN format_id TEXT NOT NULL DEFAULT 'league';
ALTER TABLE competition_records
  ADD COLUMN completed_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE competition_records
  ADD COLUMN player_card_json TEXT;

UPDATE competition_records
SET mode = COALESCE((
      SELECT h.mode FROM competition_history h
      WHERE h.id = competition_records.competition_id
    ), mode),
    format_id = COALESCE((
      SELECT h.format_id FROM competition_history h
      WHERE h.id = competition_records.competition_id
    ), format_id),
    completed_at = COALESCE((
      SELECT h.completed_at FROM competition_history h
      WHERE h.id = competition_records.competition_id
    ), completed_at),
    player_card_json = (
      SELECT json_set(player.value, '$.overall', COALESCE((
          SELECT CASE WHEN effective.type IN ('integer', 'real') THEN CAST(effective.value AS INTEGER) END
          FROM competition_history effective_history,
               json_each(CASE WHEN json_valid(effective_history.report_json)
                 THEN COALESCE(json_extract(effective_history.report_json, '$.historySnapshot.effectiveOverallByPlayerId'), '{}')
                 ELSE '{}'
               END) effective
          WHERE effective_history.id = competition_records.competition_id
            AND effective.key = json_extract(player.value, '$.id')
          LIMIT 1
        ), CAST(json_extract(player.value, '$.overall') AS INTEGER)))
      FROM competition_history h,
           json_each(CASE WHEN json_valid(h.report_json)
             THEN COALESCE(json_extract(h.report_json, '$.historySnapshot.playerTeam.players'), '[]')
             ELSE '[]'
           END) player
      WHERE h.id = competition_records.competition_id
        AND json_extract(player.value, '$.id') = competition_records.player_id
      LIMIT 1
    );

WITH ranked_snapshots AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY completed_at DESC, id DESC) AS snapshot_rank
  FROM competition_history
  WHERE CASE
    WHEN json_valid(report_json) THEN json_type(report_json, '$.historySnapshot')
    ELSE NULL
  END IS NOT NULL
)
UPDATE competition_history
SET report_json = json_set(
  json_remove(report_json, '$.historySnapshot'),
  '$.snapshotArchived',
  json('true')
)
WHERE id IN (SELECT id FROM ranked_snapshots WHERE snapshot_rank > 20);
