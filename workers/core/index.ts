import { Hono } from "hono";
import { clearSessionCookie, serializeSessionCookie } from "@/lib/admin-auth/cookies";
import { verifyAdminPassword } from "@/lib/admin-auth/password";
import { createSessionToken } from "@/lib/admin-auth/session";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { createPrisma } from "@/lib/db/neon";
import type { AutomationStore } from "@/lib/automations/service";
import { LoginThrottle } from "@/workers/core/login-throttle";
import { requireAdmin, requireSameOrigin } from "@/workers/core/middleware/auth";
import { automationRoutes } from "@/workers/core/routes/automations";
import { instagramRoutes, type InstagramDb } from "@/workers/core/routes/instagram";
import { webhookRoutes, type WebhookDb } from "@/workers/core/routes/webhook";
import { dashboardRoutes, type DashboardDb } from "@/workers/core/routes/dashboard";
import { reportRoutes, type ReportDb } from "@/workers/core/routes/reports";
import { logRoutes, type LogDb } from "@/workers/core/routes/logs";
import { diagnosticRoutes, type DiagnosticDb } from "@/workers/core/routes/diagnostics";
import { redirectRoutes, type RedirectDb } from "@/workers/core/routes/redirects";
import { errorPayload, errorStatus } from "@/workers/core/middleware/errors";

type CoreDatabase = AutomationStore & InstagramDb & DashboardDb & ReportDb & LogDb & DiagnosticDb & RedirectDb & WebhookDb;

export function createCoreApp(options?: { db?: CoreDatabase }) {
  const app = new Hono<{ Bindings: CoreEnv }>();

  app.use("*", async (context, next) => {
    await next();
    if (context.res.status < 200 || context.res.status >= 300 || !context.res.headers.get("content-type")?.includes("application/json")) return;
    const payload = await context.res.clone().json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || !("data" in payload) || "success" in payload) return;
    const headers = new Headers(context.res.headers);
    context.res = new Response(JSON.stringify({ success: true, ...payload }), { status: context.res.status, headers });
  });

  app.get("/health", (context) => context.json({ status: "ok", service: "core" }));
  app.route("/", webhookRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as WebhookDb));
  app.route("/", redirectRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as RedirectDb));
  app.use("/api/*", requireSameOrigin);
  app.post("/api/auth/login", async (context) => {
    const body: { login?: unknown; password?: unknown } = await context.req.json<{ login?: unknown; password?: unknown }>().catch(() => ({}));
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
  app.route("/api", instagramRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as InstagramDb));
  app.route("/api", dashboardRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as DashboardDb));
  app.route("/api", reportRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as ReportDb));
  app.route("/api", logRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as LogDb));
  app.route("/api", diagnosticRoutes((env) => options?.db ?? createPrisma(env.DATABASE_URL) as unknown as DiagnosticDb));
  app.notFound((context) => context.json({ error: "not_found" }, 404));
  app.onError((error, context) => {
    const requestId = crypto.randomUUID();
    console.error("Core request failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
    return context.json(errorPayload(error, requestId), errorStatus(error));
  });
  return app;
}

const app = createCoreApp();

export { LoginThrottle };

const worker = {
  fetch: app.fetch,
};

export default worker;
