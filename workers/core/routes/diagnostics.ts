import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { databaseStorageLevel } from "@/lib/core/reports";
import { requireAdmin } from "@/workers/core/middleware/auth";
import { replayFailedEvent, type ReplayDb } from "@/lib/core/job-replay";

export type DiagnosticDb = ReplayDb & {
  jobRun: { findMany(args: unknown): Promise<unknown[]> };
  operationalEvent: { findMany(args: unknown): Promise<unknown[]> };
  dailyAggregate: { findMany(args: unknown): Promise<unknown[]> };
  dailyBudget: { findMany(args: unknown): Promise<unknown[]> };
  instagramAccount: { findMany(args: unknown): Promise<unknown[]> };
  processedEvent: ReplayDb["processedEvent"] & { findMany(args: unknown): Promise<unknown[]> };
  $queryRawUnsafe<T>(query: string): Promise<T>;
};

export function diagnosticRoutes(getDb: (env: CoreEnv) => DiagnosticDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("/diagnostics", requireAdmin);
  app.use("/diagnostics/*", requireAdmin);
  app.get("/diagnostics", async (context) => {
    const db = getDb(context.env);
    const [jobRuns, operationalEvents, dailyCounters, globalBudgets, accounts, failedJobs, storageRows] = await Promise.all([
      db.jobRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      db.operationalEvent.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.dailyAggregate.findMany({ orderBy: { date: "desc" }, take: 35 }),
      db.dailyBudget.findMany({ orderBy: { date: "desc" }, take: 7 }),
      db.instagramAccount.findMany({ orderBy: { connectedAt: "asc" }, select: { id: true, username: true, webhookSubscribed: true, requiresReconnect: true, lastErrorCode: true, tokenExpiresAt: true } }),
      db.processedEvent.findMany({ where: { terminalStatus: "FAILED", r2Key: { not: null } }, orderBy: { firstSeenAt: "desc" }, take: 50, select: { externalId: true, kind: true, firstSeenAt: true, instagramAccount: { select: { username: true } } } }),
      db.$queryRawUnsafe<{ bytes: bigint | number | string }[]>("SELECT pg_database_size(current_database()) AS bytes"),
    ]);
    const storageBytes = Number(storageRows[0]?.bytes ?? 0);
    return context.json({ data: { jobRuns, operationalEvents, dailyCounters, globalBudgets, accounts, failedJobs, database: { bytes: storageBytes, level: databaseStorageLevel(storageBytes) } } });
  });
  app.post("/diagnostics/replay", async (context) => {
    const body = await context.req.json<{ externalId?: unknown }>().catch(() => ({})) as { externalId?: unknown };
    if (typeof body.externalId !== "string" || !body.externalId) return context.json({ error: "invalid_input" }, 400);
    const result = await replayFailedEvent(getDb(context.env), context.env.INSTAGRAM_EVENTS, body.externalId);
    return result.status === "queued" ? context.json({ data: result }) : context.json({ error: result.status }, result.status === "budget_exhausted" ? 429 : 404);
  });
  return app;
}
