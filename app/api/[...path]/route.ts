import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

export const runtime = "edge";

type CoreService = {
  fetch(request: Request): Promise<Response>;
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const { env } = await getCloudflareContext({ async: true });
  const core = (env as unknown as { CORE_API: CoreService }).CORE_API;
  const { path } = await context.params;
  const target = new URL(`https://core.internal/api/${path.join("/")}`);
  target.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.set("origin", "https://core.internal");
  headers.delete("host");

  const response = await core.fetch(
    new Request(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
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
