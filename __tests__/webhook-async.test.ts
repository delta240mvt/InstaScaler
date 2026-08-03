import { describe, expect, it } from "vitest";
import { webhookRoutes } from "@/workers/core/routes/webhook";

type TestExecutionContext = { waitUntil(promise: Promise<unknown>): void };

describe("Meta webhook acknowledgement", () => {
  it("acknowledges immediately and schedules durable processing", async () => {
    const secret = "test-secret";
    const body = JSON.stringify({ entry: [] });
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const scheduled: Promise<unknown>[] = [];
    const executionContext = {
      waitUntil(promise: Promise<unknown>) { scheduled.push(promise); },
    } as TestExecutionContext;
    const app = webhookRoutes();

    const response = await app.fetch(
      new Request("https://core.example/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": `sha256=${digest}`,
        },
        body,
      }),
      { META_APP_SECRET: secret, META_WEBHOOK_VERIFY_TOKEN: "verify" } as never,
      executionContext as never,
    );

    expect(response.status).toBe(200);
    expect(scheduled).toHaveLength(1);
    await Promise.all(scheduled);
  });
});
