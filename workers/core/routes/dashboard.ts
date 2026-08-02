import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { requireAdmin } from "@/workers/core/middleware/auth";

export type DashboardDb = {
  instagramAccount: { findMany(args: unknown): Promise<unknown[]> };
  automation: { count(args: unknown): Promise<number> };
  dmLog: { count(args: unknown): Promise<number> };
  linkClick: { count(args: unknown): Promise<number> };
};

export function dashboardRoutes(getDb: (env: CoreEnv) => DashboardDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("*", requireAdmin);
  app.get("/dashboard/stats", async (context) => {
    const db = getDb(context.env);
    const accountId = context.req.query("instagramAccountId");
    const accountFilter = accountId && accountId !== "all" ? { instagramAccountId: accountId } : {};
    const [instagramAccounts, activeAutomations, sent, failed, clicks] = await Promise.all([
      db.instagramAccount.findMany({ orderBy: { connectedAt: "desc" }, select: { id: true, instagramId: true, username: true, name: true } }),
      db.automation.count({ where: { isActive: true, ...accountFilter } }),
      db.dmLog.count({ where: { status: "SENT", ...accountFilter } }),
      db.dmLog.count({ where: { status: "FAILED", ...accountFilter } }),
      db.linkClick.count({ where: accountFilter }),
    ]);
    return context.json({ data: { instagramAccounts, selectedInstagramAccountId: accountId ?? (instagramAccounts[0] as { id?: string } | undefined)?.id ?? null, activeAutomations, sent, failed, clicks } }, 200, { "Cache-Control": "no-store" });
  });
  return app;
}
