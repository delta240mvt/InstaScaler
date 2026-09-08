import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { requireAdmin } from "@/workers/core/middleware/auth";

export type DashboardDb = {
  instagramAccount: { findMany(args: unknown): Promise<unknown[]> };
  automation: { count(args: unknown): Promise<number> };
  dmLog: { count(args: unknown): Promise<number>; findMany(args: unknown): Promise<unknown[]>; groupBy(args: unknown): Promise<Array<{ status?: string; matchedKeyword?: string | null; _count: { _all: number } }>> };
  linkClick: { count(args: unknown): Promise<number> };
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

export function dashboardRoutes(getDb: (env: CoreEnv) => DashboardDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("/dashboard/*", requireAdmin);
  app.get("/dashboard/stats", async (context) => {
    const db = getDb(context.env);
    const requested = context.req.query("instagramAccountId");
    const accountFilter = requested && requested !== "all" ? { instagramAccountId: requested } : {};
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const week = new Date(today.getTime() - 6 * 86_400_000);
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [instagramAccounts, totalAutomations, activeAutomations, dmsSentToday, dmsSentWeek, dmsSentMonth, totalDMs, statusRows, clicksThisMonth, totalClicks, keywordRows, recentLogs, contacts] = await Promise.all([
      db.instagramAccount.findMany({ orderBy: { connectedAt: "desc" }, select: { id: true, instagramId: true, username: true, name: true, tokenExpiresAt: true, webhookSubscribed: true } }),
      db.automation.count({ where: accountFilter }), db.automation.count({ where: { isActive: true, ...accountFilter } }),
      db.dmLog.count({ where: { status: "SENT", createdAt: { gte: today }, ...accountFilter } }),
      db.dmLog.count({ where: { status: "SENT", createdAt: { gte: week }, ...accountFilter } }),
      db.dmLog.count({ where: { status: "SENT", createdAt: { gte: month }, ...accountFilter } }),
      db.dmLog.count({ where: { status: "SENT", ...accountFilter } }),
      db.dmLog.groupBy({ by: ["status"], where: { createdAt: { gte: month }, ...accountFilter }, _count: { _all: true } }),
      db.linkClick.count({ where: { createdAt: { gte: month }, ...accountFilter } }), db.linkClick.count({ where: accountFilter }),
      db.dmLog.groupBy({ by: ["matchedKeyword"], where: { matchedKeyword: { not: null }, ...accountFilter }, _count: { _all: true }, orderBy: { _count: { matchedKeyword: "desc" } }, take: 5 }),
      db.dmLog.findMany({ where: accountFilter, orderBy: { createdAt: "desc" }, take: 10, include: { automation: { select: { name: true } }, instagramAccount: { select: { username: true } } } }),
      requested && requested !== "all"
        ? db.$queryRawUnsafe<Array<{ count: bigint | number }>>('SELECT COUNT(DISTINCT "commenterId") AS count FROM "DmLog" WHERE "instagramAccountId" = $1', requested)
        : db.$queryRawUnsafe<Array<{ count: bigint | number }>>('SELECT COUNT(DISTINCT "commenterId") AS count FROM "DmLog"'),
    ]);
    const dailyDMs = await Promise.all(Array.from({ length: 7 }, async (_, index) => {
      const start = new Date(today.getTime() - (6 - index) * 86_400_000); const end = new Date(start.getTime() + 86_400_000);
      return { date: start.toLocaleDateString("pl-PL", { weekday: "short", timeZone: "UTC" }), count: await db.dmLog.count({ where: { status: "SENT", createdAt: { gte: start, lt: end }, ...accountFilter } }) };
    }));
    const statusCount = (status: string) => statusRows.find((row) => row.status === status)?._count._all ?? 0;
    return context.json({ data: { userName: "Admin", contactsCount: Number(contacts[0]?.count ?? 0), instagramAccounts, selectedInstagramAccountId: requested ?? "all", totalAutomations, activeAutomations, dmsSentToday, dmsSentWeek, dmsSentMonth, dmsSkippedMonth: statusCount("SKIPPED"), dmsFailedMonth: statusCount("FAILED"), totalDMs, clicksThisMonth, totalClicks, ctrThisMonth: dmsSentMonth ? Math.round(clicksThisMonth / dmsSentMonth * 1000) / 10 : 0, topKeywords: keywordRows.map((row) => ({ keyword: row.matchedKeyword ?? "", count: row._count._all })), dailyDMs, recentLogs } }, 200, { "Cache-Control": "no-store" });
  });
  return app;
}
