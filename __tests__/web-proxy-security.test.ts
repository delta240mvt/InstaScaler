import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/[...path]/route";

const { coreFetch } = vi.hoisted(() => ({ coreFetch: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: { CORE_API: { fetch: coreFetch } } }) }));
const context = { params: Promise.resolve({ path: ["auth", "login"] }) };

describe("Web proxy origin protection", () => {
  beforeEach(() => coreFetch.mockReset().mockResolvedValue(Response.json({ ok: true })));
  it.each(["https://evil.example", "null", undefined])("rejects mutation from %s before forwarding", async (origin) => {
    const response = await POST(new NextRequest("https://app.example/api/auth/login", { method: "POST", headers: origin ? { origin } : {} }), context);
    expect(response.status).toBe(403);
    expect(coreFetch).not.toHaveBeenCalled();
  });
  it("forwards an authorized same-origin mutation with its body", async () => {
    const response = await POST(new NextRequest("https://app.example/api/auth/login", { method: "POST", headers: { origin: "https://app.example", "content-type": "application/json" }, body: '{"login":"admin"}' }), context);
    expect(response.status).toBe(200);
    const forwarded = coreFetch.mock.calls[0][0] as Request;
    expect(forwarded.headers.get("origin")).toBe("https://core.internal");
    expect(await forwarded.json()).toEqual({ login: "admin" });
  });
  it("preserves public GET queries and response cookies", async () => {
    coreFetch.mockResolvedValueOnce(new Response("ok", { headers: { "set-cookie": "session=; Max-Age=0" } }));
    const response = await GET(new NextRequest("https://app.example/api/reports/demo?range=7"), { params: Promise.resolve({ path: ["reports", "demo"] }) });
    expect((coreFetch.mock.calls[0][0] as Request).url).toBe("https://core.internal/api/reports/demo?range=7");
    expect(response.headers.get("set-cookie")).toBe("session=; Max-Age=0");
  });
});
