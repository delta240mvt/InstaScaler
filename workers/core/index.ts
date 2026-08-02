import { Hono } from "hono";
import { clearSessionCookie, serializeSessionCookie } from "@/lib/admin-auth/cookies";
import { verifyAdminPassword } from "@/lib/admin-auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/admin-auth/session";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { createPrisma } from "@/lib/db/neon";
import type { AutomationStore } from "@/lib/automations/service";
import type { AccountDb } from "@/lib/core/instagram-accounts";
import { LoginThrottle } from "@/workers/core/login-throttle";
import { requireAdmin, requireSameOrigin } from "@/workers/core/middleware/auth";
import { automationRoutes } from "@/workers/core/routes/automations";
import { instagramRoutes } from "@/workers/core/routes/instagram";

export function createCoreApp(options?: { db?: AutomationStore & AccountDb }) {
  const app = new Hono<{ Bindings: CoreEnv }>();

  app.get("/health", (context) => context.json({ status: "ok", service: "core" }));
  app.use("/api/*", requireSameOrigin);
  app.post("/api/auth/login", async (context) => {
    const body = await context.req.json<{ login?: unknown; password?: unknown }>().catch(() => ({}));
    const throttle = context.env.LOGIN_THROTTLE.get(context.env.LOGIN_THROTTLE.idFromName(context.req.header("cf-connecting-ip") ?? "unknown"));
    const credentialsValid = typeof body.login === "string" && typeof body.password === "string" && body.login === context.env.ADMIN_LOGIN && await verifyAdminPassword(body.password, context.env.ADMIN_PASSWORD_PEPPER, context.env.ADMIN_PASSWORD_VERIFIER);
    const result = await throttle.checkAndRecord(credentialsValid);
    if (!credentialsValid || !result.allowed) return context.json({ error: "invalid_credentials" }, result.allowed ? 401 : 429);
    const token = await createSessionToken(Math.floor(Date.now() / 1000), 604_800, context.env.SESSION_SIGNING_KEY);
    context.header("Set-Cookie", serializeSessionCookie(token));
    return context.json({ admin: true });
  });
  app.get("/api/auth/session", requireAdmin, (context) => context.json({ admin: true }));
  app.post("/api/auth/logout", requireAdmin, (context) => {
    context.header("Set-Cookie", clearSessionCookie());
    return context.json({ ok: true });
  });
  app.route("/api", automationRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as AutomationStore));
  app.route("/api", instagramRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as AccountDb));
  return app;
}

const app = createCoreApp();

export { LoginThrottle };

export default {
  fetch: app.fetch,
};
