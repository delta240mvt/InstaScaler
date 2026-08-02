import type { MiddlewareHandler } from "hono";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/admin-auth/cookies";
import { verifySessionToken } from "@/lib/admin-auth/session";
import type { CoreEnv } from "@/lib/cloudflare/env";

function cookieValue(header: string | undefined, name: string): string | null {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

export const requireAdmin: MiddlewareHandler<{ Bindings: CoreEnv }> = async (context, next) => {
  const token = cookieValue(context.req.header("cookie"), SESSION_COOKIE);
  const session = token && await verifySessionToken(token, Math.floor(Date.now() / 1000), context.env.SESSION_SIGNING_KEY);
  if (!session) {
    context.header("Set-Cookie", clearSessionCookie());
    return context.json({ error: "unauthorized" }, 401);
  }
  await next();
};

export const requireSameOrigin: MiddlewareHandler<{ Bindings: CoreEnv }> = async (context, next) => {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(context.req.method)) {
    const origin = context.req.header("origin");
    if (origin !== new URL(context.req.url).origin) return context.json({ error: "invalid_origin" }, 403);
  }
  await next();
};
