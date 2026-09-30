/** Keep compact history rows permanently while retaining only recent full reports. */
export async function retainRecentCompetitionSnapshots(db: D1Database, userId: string): Promise<void> {
  await db.prepare(`UPDATE competition_history
    SET report_json = json_set(
      json_remove(report_json, '$.historySnapshot'),
      '$.snapshotArchived',
      json('true')
    )
    WHERE user_id = ?
      AND id IN (
        SELECT id FROM competition_history
        WHERE user_id = ?
          AND CASE
            WHEN json_valid(report_json) THEN json_type(report_json, '$.historySnapshot')
            ELSE NULL
          END IS NOT NULL
        ORDER BY completed_at DESC, id DESC
        LIMIT -1 OFFSET 20
      )`).bind(userId, userId).run();
}
