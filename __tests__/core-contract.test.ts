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
    const replay = await createCoreApp().request("https://core.example/api/diagnostics/replay", { method: "POST", headers: { origin: "https://core.example" }, body: JSON.stringify({ externalId: "event" }) }, { SESSION_SIGNING_KEY: "key" } as never);
    expect(replay.status).toBe(401);
    const reportToggle = await createCoreApp().request("https://core.example/api/automations/id/report", { method: "PATCH", headers: { origin: "https://core.example" }, body: JSON.stringify({ enabled: true }) }, { SESSION_SIGNING_KEY: "key" } as never);
    expect(reportToggle.status).toBe(401);
  });

  it("does not expose stack traces in unexpected errors", () => {
    const payload = errorPayload(new Error("database password secret"), "request-id");
    expect(payload).toEqual({ error: "internal_error", requestId: "request-id" });
  });
});
