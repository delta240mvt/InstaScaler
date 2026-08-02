import { describe, expect, it } from "vitest";
import { createCoreApp } from "@/workers/core";
import { errorPayload } from "@/workers/core/middleware/errors";

describe("Core API contract", () => {
  it("returns JSON for unknown API routes", async () => {
    const response = await createCoreApp().request("https://core.example/api/missing");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({ error: "not_found" });
  });

  it("protects private read models without a session", async () => {
    const response = await createCoreApp().request("https://core.example/api/logs", {}, { SESSION_SIGNING_KEY: "key" } as never);
    expect(response.status).toBe(401);
  });

  it("does not expose stack traces in unexpected errors", () => {
    const payload = errorPayload(new Error("database password secret"), "request-id");
    expect(payload).toEqual({ error: "internal_error", requestId: "request-id" });
  });
});
