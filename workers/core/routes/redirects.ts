import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { resolveTrackedRedirect } from "@/lib/core/tracked-redirect";

export type RedirectDb = Parameters<typeof resolveTrackedRedirect>[0];

async function hashIp(ip: string | undefined, salt: string): Promise<string | null> {
  if (!ip) return null;
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function redirectRoutes(getDb: (env: CoreEnv) => RedirectDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.get("/r/:slug", async (context) => {
    const destination = await resolveTrackedRedirect(getDb(context.env), context.req.param("slug"), {
      ipHash: await hashIp(context.req.header("cf-connecting-ip"), context.env.IP_HASH_SALT),
      userAgent: context.req.header("user-agent") ?? null,
      referrer: context.req.header("referer") ?? null,
    });
    return destination ? context.redirect(destination, 302) : context.json({ error: "link_not_found" }, 404);
  });
  return app;
}
