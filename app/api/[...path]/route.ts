import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

type CoreService = {
  fetch(request: Request): Promise<Response>;
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  // Validate the browser origin before replacing it for the internal service hop.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
    && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  const { env } = await getCloudflareContext({ async: true });
  const core = (env as unknown as { CORE_API: CoreService }).CORE_API;
  const { path } = await context.params;
  const target = new URL(`https://core.internal/api/${path.map(encodeURIComponent).join("/")}`);
  target.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.set("origin", "https://core.internal");
  headers.delete("host");

  const response = await core.fetch(
    new Request(target, {
      method: request.method,
      headers,
      redirect: "manual",
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    }),
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
