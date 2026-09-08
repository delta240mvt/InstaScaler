import { describe, expect, it } from "vitest";
import { CoreApiError } from "@/lib/core-api/errors";
import { createCoreApi } from "@/lib/core-api/client";

describe("Polish API errors", () => {
  it("localizes failures without losing the stable code or request ID", async () => {
    const api = createCoreApi({ baseUrl: "", fetch: async () => Response.json({ error: "rate_limited", requestId: "r1" }, { status: 429 }) });
    await expect(api.auth.logout()).rejects.toMatchObject({ message: "Limit żądań został przekroczony. Spróbuj ponownie za chwilę.", code: "rate_limited", requestId: "r1" });
  });
  it("does not expose unrecognized backend diagnostics in the UI", () => {
    expect(new CoreApiError(500, "upstream secret detail").message).toBe("Nie udało się wykonać operacji. Spróbuj ponownie.");
  });
});

it("reads Retry-After seconds without changing the API error code", async () => {
  const api = createCoreApi({ baseUrl: "", fetch: async () => Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "31" } }) });
  await expect(api.auth.logout()).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 31 });
});

it("localizes network failures without exposing browser English messages", async () => {
  const api = createCoreApi({ baseUrl: "", fetch: async () => { throw new TypeError("Failed to fetch"); } });
  await expect(api.auth.session()).rejects.toMatchObject({ code: "service_unavailable", message: "Usługa jest chwilowo niedostępna. Spróbuj ponownie później." });
});
