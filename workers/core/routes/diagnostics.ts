import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { databaseStorageLevel } from "@/lib/core/reports";
import { requireAdmin } from "@/workers/core/middleware/auth";

export type DiagnosticDb = {
  jobRun: { findMany(args: unknown): Promise<unknown[]> };
  operationalEvent: { findMany(args: unknown): Promise<unknown[]> };
  dailyAggregate: { findMany(args: unknown): Promise<unknown[]> };
  $queryRawUnsafe<T>(query: string): Promise<T>;
};

export function diagnosticRoutes(getDb: (env: CoreEnv) => DiagnosticDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("*", requireAdmin);
  app.get("/diagnostics", async (context) => {
    const db = getDb(context.env);
    const [jobRuns, operationalEvents, dailyCounters, storageRows] = await Promise.all([
      db.jobRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      db.operationalEvent.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.dailyAggregate.findMany({ orderBy: { date: "desc" }, take: 35 }),
      db.$queryRawUnsafe<{ bytes: bigint | number | string }[]>("SELECT pg_database_size(current_database()) AS bytes"),
    ]);
    const storageBytes = Number(storageRows[0]?.bytes ?? 0);
    return context.json({ data: { jobRuns, operationalEvents, dailyCounters, database: { bytes: storageBytes, level: databaseStorageLevel(storageBytes) } } });
  });
  return app;
}
