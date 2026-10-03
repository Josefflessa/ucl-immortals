-- Online campaigns were inserted without competition_points (it stayed at the
-- default 0), so they never counted in the score leaderboard. The correct value
-- was always stored in the report JSON; copy it into the column.
UPDATE competition_history
SET competition_points = CASE
  WHEN champion = 1 THEN 100
  WHEN json_valid(report_json) THEN COALESCE(
    CAST(json_extract(report_json, '$.competitionPoints') AS INTEGER),
    CAST(json_extract(report_json, '$.historySnapshot.competitionPoints') AS INTEGER),
    0
  )
  ELSE 0
END
WHERE mode = 'online' AND competition_points = 0;
