import { Hono } from "hono";
import { ZodError } from "zod";
import { createAutomation, deleteAutomation, importAutomations, listAutomations, setReportSharing, updateAutomation, type AutomationInput, type AutomationStore } from "@/lib/automations/service";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { requireAdmin } from "@/workers/core/middleware/auth";

export function automationRoutes(getDb: (env: CoreEnv) => AutomationStore) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("/automations", requireAdmin);
  app.use("/automations/*", requireAdmin);
  app.get("/automations", async (context) => context.json({ data: await listAutomations(getDb(context.env), context.req.query("instagramAccountId"), context.env.APP_BASE_URL) }));
  app.post("/automations", async (context) => {
    try { return context.json({ data: await createAutomation(getDb(context.env), await context.req.json<AutomationInput>()) }, 201); }
    catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) return context.json({ error: "invalid_input", details: error instanceof ZodError ? error.flatten() : undefined }, 400);
      throw error;
    }
  });
  app.patch("/automations", async (context) => {
    const id = context.req.query("id");
    if (!id) return context.json({ error: "missing_automation_id" }, 400);
    const data = await updateAutomation(getDb(context.env), id, await context.req.json<Partial<AutomationInput>>());
    return data ? context.json({ data }) : context.json({ error: "automation_not_found" }, 404);
  });
  app.delete("/automations", async (context) => {
    const id = context.req.query("id");
    if (!id) return context.json({ error: "missing_automation_id" }, 400);
    await deleteAutomation(getDb(context.env), id);
    return context.body(null, 204);
  });
  app.patch("/automations/:id/report", async (context) => {
    const body = await context.req.json<{ enabled?: unknown } | null>().catch(() => null);
    if (typeof body?.enabled !== "boolean") return context.json({ error: "invalid_input" }, 400);
    const data = await setReportSharing(getDb(context.env), context.req.param("id"), body.enabled, context.env.APP_BASE_URL);
    return data ? context.json({ data }) : context.json({ error: "automation_not_found" }, 404);
  });
  app.post("/automations/import", async (context) => {
    const body = await context.req.json<{ campaigns?: AutomationInput[] } | null>();
    if (!Array.isArray(body?.campaigns) || body.campaigns.length === 0 || body.campaigns.length > 200) return context.json({ error: "invalid_input" }, 400);
    return context.json({ data: await importAutomations(getDb(context.env), body.campaigns) }, 201);
  });
  return app;
}
