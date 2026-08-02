import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { getPublicReport } from "@/lib/core/report-share";

export type ReportDb = Parameters<typeof getPublicReport>[0];

export function reportRoutes(getDb: (env: CoreEnv) => ReportDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.get("/reports/:shareSlug", async (context) => {
    const report = await getPublicReport(getDb(context.env), context.req.param("shareSlug"));
    return report ? context.json({ data: report }) : context.json({ error: "report_not_found" }, 404);
  });
  return app;
}
