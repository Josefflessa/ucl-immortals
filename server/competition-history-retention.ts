import { getTeamEffectiveStats, type Team } from '../client/src/lib/gameEngine.js';

/** Keep compact history rows permanently while retaining only recent full reports. */
export async function retainRecentCompetitionSnapshots(db: D1Database, userId: string): Promise<void> {
  // Materialize effective card values before discarding a full snapshot. New
  // campaigns already save these values on every record card; this also upgrades
  // older retained campaigns as they age out of the 20 full-history window.
  let offset = 20;
  while (true) {
    const rows = await db.prepare(`SELECT id, report_json FROM competition_history
      WHERE user_id = ?
        AND CASE WHEN json_valid(report_json) THEN json_type(report_json, '$.historySnapshot') ELSE NULL END IS NOT NULL
      ORDER BY completed_at DESC, id DESC
      LIMIT 10 OFFSET ?`).bind(userId, offset).all<{ id: string; report_json: string }>();
    if (rows.results.length === 0) break;

    for (const row of rows.results) {
      const statsByPlayerId = effectiveCardStatsByPlayerId(row.report_json);
      if (!statsByPlayerId) continue;
      const records = await db.prepare(`SELECT id, player_id, player_card_json
        FROM competition_records WHERE competition_id = ?`).bind(row.id).all<{
          id: string;
          player_id: string;
          player_card_json: string | null;
        }>();
      const statements = records.results.flatMap(record => {
        const stats = statsByPlayerId[record.player_id];
        if (!stats) return [];
        let playerCard: Record<string, unknown> | null = null;
        try {
          const parsed: unknown = JSON.parse(String(record.player_card_json ?? ''));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) playerCard = parsed as Record<string, unknown>;
        } catch {
          // A card without a valid stored snapshot cannot be safely rewritten.
        }
        if (!playerCard) return [];
        return [db.prepare(`UPDATE competition_records
          SET player_card_json = ?, value = CASE WHEN category = 'effective_overall' THEN ? ELSE value END
          WHERE id = ?`).bind(JSON.stringify({ ...playerCard, effectiveStats: stats }), stats.overall, record.id)];
      });
      if (statements.length > 0) await db.batch(statements);
    }
    offset += rows.results.length;
  }

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

function effectiveCardStatsByPlayerId(reportJson: string): Record<string, Record<string, number>> | null {
  try {
    const report: unknown = JSON.parse(reportJson);
    if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
    const reportRecord = report as Record<string, unknown>;
    const snapshot = reportRecord.historySnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    const snapshotRecord = snapshot as Record<string, unknown>;
    const saved = snapshotRecord.effectiveStatsByPlayerId;
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      const normalized = normalizeStatsMap(saved as Record<string, unknown>);
      if (normalized) return normalized;
    }

    const team = snapshotRecord.playerTeam;
    if (!team || typeof team !== 'object' || Array.isArray(team)) return null;
    const teamRecord = team as Team;
    const players = Array.isArray(teamRecord.players) ? teamRecord.players : [];
    if (players.length === 0 || players.length > 40) return null;
    const teamId = typeof teamRecord.id === 'string' ? teamRecord.id : '';
    const formatId = typeof snapshotRecord.formatId === 'string' ? snapshotRecord.formatId : '';
    const finalResult = snapshotRecord.finalResult && typeof snapshotRecord.finalResult === 'object' && !Array.isArray(snapshotRecord.finalResult)
      ? snapshotRecord.finalResult as Record<string, unknown>
      : null;
    const finalIncludesTeam = Boolean(finalResult && (finalResult.homeTeamId === teamId || finalResult.awayTeamId === teamId));
    const isServerRecord = reportRecord.source === 'server';
    const isLosing = isServerRecord
      ? snapshotRecord.championId !== teamId
      : finalIncludesTeam && (finalResult!.homeTeamId === teamId
        ? Number(finalResult!.homeGoals) < Number(finalResult!.awayGoals)
        : Number(finalResult!.awayGoals) < Number(finalResult!.homeGoals));
    const effective = getTeamEffectiveStats(teamRecord, {
      playStyle: typeof snapshotRecord.playStyle === 'string' ? snapshotRecord.playStyle : undefined,
      isKnockout: formatId !== 'league',
      isFinal: isServerRecord || finalIncludesTeam,
      isLosing,
    });
    return Object.fromEntries(players.map(player => {
      const stats = effective[player.id];
      return [player.id, {
        overall: Math.round(stats?.overall ?? player.overall),
        pace: Math.round(stats?.pace ?? player.pace),
        shooting: Math.round(stats?.shooting ?? player.shooting),
        passing: Math.round(stats?.passing ?? player.passing),
        dribbling: Math.round(stats?.dribbling ?? player.dribbling),
        defending: Math.round(stats?.defending ?? player.defending),
        physical: Math.round(stats?.physical ?? player.physical),
        vision: Math.round(stats?.vision ?? player.vision),
        composure: Math.round(stats?.composure ?? player.composure),
      }] as const;
    }));
  } catch {
    return null;
  }
}

function normalizeStatsMap(value: Record<string, unknown>): Record<string, Record<string, number>> | null {
  const fields = ['overall', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure'];
  const entries = Object.entries(value).map(([playerId, rawStats]) => {
    if (!rawStats || typeof rawStats !== 'object' || Array.isArray(rawStats)) return null;
    const raw = rawStats as Record<string, unknown>;
    const stats: Record<string, number> = {};
    for (const field of fields) {
      const stat = raw[field];
      if (typeof stat !== 'number' || !Number.isSafeInteger(stat) || stat < 1) return null;
      stats[field] = stat;
    }
    return [playerId, stats] as const;
  });
  if (entries.some(entry => entry === null)) return null;
  return Object.fromEntries(entries as Array<readonly [string, Record<string, number>]>);
}
