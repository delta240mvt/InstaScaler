export type AnalyticsDb = { $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> };
type Analytics = { sent: number; skipped: number; failed: number; topKeywords: Array<{ keyword: string; count: number }> };

// Bound returned data by campaigns and five keywords, regardless of delivery volume.
export async function automationAnalytics(db: AnalyticsDb, ids: string[]): Promise<Map<string, Analytics>> {
  if (!ids.length) return new Map();
  const rows = await db.$queryRawUnsafe<Array<Analytics & { automationId: string }>>(`
    WITH logs AS (
      SELECT "automationId", status, "matchedKeyword" FROM "DmLog"
      WHERE "automationId" IN (SELECT jsonb_array_elements_text($1::jsonb))
    ), statuses AS (
      SELECT "automationId", COUNT(*) FILTER (WHERE status = 'SENT')::integer AS sent,
        COUNT(*) FILTER (WHERE status = 'SKIPPED')::integer AS skipped,
        COUNT(*) FILTER (WHERE status = 'FAILED')::integer AS failed
      FROM logs GROUP BY "automationId"
    ), keywords AS (
      SELECT "automationId", "matchedKeyword" AS keyword, COUNT(*)::integer AS count,
        ROW_NUMBER() OVER (PARTITION BY "automationId" ORDER BY COUNT(*) DESC, "matchedKeyword") AS rank
      FROM logs WHERE "matchedKeyword" IS NOT NULL GROUP BY "automationId", "matchedKeyword"
    )
    SELECT statuses.*, COALESCE(
      jsonb_agg(jsonb_build_object('keyword', keyword, 'count', count) ORDER BY rank)
        FILTER (WHERE rank IS NOT NULL), '[]'::jsonb) AS "topKeywords"
    FROM statuses LEFT JOIN keywords ON keywords."automationId" = statuses."automationId" AND rank <= 5
    GROUP BY statuses."automationId", sent, skipped, failed
  `, JSON.stringify(ids));
  return new Map(rows.map(({ automationId, ...analytics }) => [automationId, analytics]));
}

export function withClickAnalytics(analytics: Analytics | undefined, clicks: number) {
  const counts = analytics ?? { sent: 0, skipped: 0, failed: 0, topKeywords: [] };
  return { ...counts, clicks, ctr: counts.sent ? Math.round(clicks / counts.sent * 1000) / 10 : 0 };
}
