import { Hono } from "hono";
import { disconnectInstagramAccount, listInstagramAccounts, type AccountDb } from "@/lib/core/instagram-accounts";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { requireAdmin } from "@/workers/core/middleware/auth";

export function instagramRoutes(getDb: (env: CoreEnv) => AccountDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("*", requireAdmin);
  app.get("/instagram/accounts", async (context) => {
    const accounts = await listInstagramAccounts(getDb(context.env));
    return context.json({ data: { instagramAccounts: accounts, selectedInstagramAccountId: (accounts[0] as { id?: string } | undefined)?.id ?? null } });
  });
  app.delete("/instagram/accounts/:id", async (context) => {
    await disconnectInstagramAccount(getDb(context.env), context.req.param("id"));
    return context.body(null, 204);
  });
  return app;
}
