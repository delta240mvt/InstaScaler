import { describe, expect, it, vi } from "vitest";
import { createCoreApi } from "@/lib/core-api/client";
import { CoreApiError } from "@/lib/core-api/errors";

describe("Core API client", () => {
  it("forwards server cookies and encodes query strings", async () => {
    const request = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => Response.json({ data: [] }));
    const api = createCoreApi({ baseUrl: "https://core.example", cookie: "session=token", fetch: request as typeof fetch });
    await api.automations.list({ instagramAccountId: "account & one" });
    expect(request.mock.calls[0]?.[0]).toBe("https://core.example/api/automations?instagramAccountId=account+%26+one");
    expect((request.mock.calls[0]?.[1]?.headers as Headers).get("cookie")).toBe("session=token");
  });

  it("uses relative browser URLs and handles empty responses", async () => {
    const request = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(null, { status: 204 }));
    const api = createCoreApi({ baseUrl: "", fetch: request as typeof fetch });
    await expect(api.auth.logout()).resolves.toBeUndefined();
    expect(request.mock.calls[0]?.[0]).toBe("/api/auth/logout");
  });

  it("parses JSON errors with request IDs", async () => {
    const api = createCoreApi({ baseUrl: "", fetch: (async () => Response.json({ error: "invalid_credentials", requestId: "request" }, { status: 401 })) as typeof fetch });
    await expect(api.auth.login({ login: "a", password: "b" })).rejects.toEqual(new CoreApiError(401, "invalid_credentials", "request"));
  });
});
