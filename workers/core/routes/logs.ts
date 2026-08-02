import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { normalizePagination } from "@/lib/core/reports";
import { requireAdmin } from "@/workers/core/middleware/auth";

export type LogDb = { dmLog: { findMany(args: unknown): Promise<unknown[]>; count(args: unknown): Promise<number> } };

export function logRoutes(getDb: (env: CoreEnv) => LogDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("/logs", requireAdmin);
  app.get("/logs", async (context) => {
    const page = normalizePagination({ page: context.req.query("page"), pageSize: context.req.query("pageSize") });
    const instagramAccountId = context.req.query("instagramAccountId");
    const where = instagramAccountId && instagramAccountId !== "all" ? { instagramAccountId } : {};
    const db = getDb(context.env);
    const [items, total] = await Promise.all([
      db.dmLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.pageSize, include: { automation: { select: { id: true, name: true } }, instagramAccount: { select: { id: true, username: true } } } }),
      db.dmLog.count({ where }),
    ]);
    return context.json({ data: { items, total, page: page.page, pageSize: page.pageSize } });
  });
  return app;
}
