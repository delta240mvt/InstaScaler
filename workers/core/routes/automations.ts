import { Hono } from "hono";
import { ZodError } from "zod";
import { createAutomation, deleteAutomation, importAutomations, listAutomations, updateAutomation, type AutomationInput, type AutomationStore } from "@/lib/automations/service";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { requireAdmin } from "@/workers/core/middleware/auth";

export function automationRoutes(getDb: (env: CoreEnv) => AutomationStore) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("/automations*", requireAdmin);
  app.get("/automations", async (context) => context.json({ data: await listAutomations(getDb(context.env), context.req.query("instagramAccountId")) }));
  app.post("/automations", async (context) => {
    try { return context.json({ data: await createAutomation(getDb(context.env), await context.req.json<AutomationInput>()) }, 201); }
    catch (error) { return context.json({ error: "invalid_input", details: error instanceof ZodError ? error.flatten() : undefined }, 400); }
  });
  app.patch("/automations", async (context) => {
    const id = context.req.query("id");
    if (!id) return context.json({ error: "missing_automation_id" }, 400);
    return context.json({ data: await updateAutomation(getDb(context.env), id, await context.req.json<Partial<AutomationInput>>()) });
  });
  app.delete("/automations", async (context) => {
    const id = context.req.query("id");
    if (!id) return context.json({ error: "missing_automation_id" }, 400);
    await deleteAutomation(getDb(context.env), id);
    return context.body(null, 204);
  });
  app.post("/automations/import", async (context) => {
    const body = await context.req.json<{ campaigns?: AutomationInput[] }>();
    if (!Array.isArray(body.campaigns) || body.campaigns.length === 0 || body.campaigns.length > 200) return context.json({ error: "invalid_input" }, 400);
    return context.json({ data: await importAutomations(getDb(context.env), body.campaigns) }, 201);
  });
  return app;
}
