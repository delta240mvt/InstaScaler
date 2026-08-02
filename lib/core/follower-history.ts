export type FollowerPoint = { date: string; followersCount: number; backfilled: boolean };

export function serializeFollowerHistory(rows: { date: Date; followersCount: number; backfilled: boolean }[]): FollowerPoint[] {
  return rows.map((row) => ({ date: row.date.toISOString().slice(0, 10), followersCount: row.followersCount, backfilled: row.backfilled }));
}
