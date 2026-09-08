import { describe, expect, it, vi } from "vitest";
import { webhookRoutes } from "@/workers/core/routes/webhook";
import { hmac } from "@/lib/admin-auth/encoding";

const event = { entry: [{ id: "123", changes: [{ field: "comments", value: { id: "comment", from: { id: "456" }, media: { id: "media" }, text: "go" } }] }] };
async function request(body: unknown) {
  const serialized = JSON.stringify(body);
  const signature = Array.from(await hmac("secret", serialized), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request("https://app.example/webhook", { method: "POST", body: serialized, headers: { "x-hub-signature-256": `sha256=${signature}` } });
}

describe("Core durable webhook acknowledgement", () => {
  it("asks Meta to retry when R2 cannot persist an event", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const tasks: Promise<unknown>[] = [];
    const send = vi.fn();
    const response = await webhookRoutes().fetch(await request(event), { META_APP_SECRET: "secret", EVENT_JOURNAL: { put: async () => { throw new Error("token=secret-value"); } }, INSTAGRAM_EVENTS: { send } } as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
    await Promise.all(tasks);
    expect(response.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain("secret-value");
    logged.mockRestore();
  });

  it("ignores malformed entries while keeping valid events in the same envelope", async () => {
    const tasks: Promise<unknown>[] = [];
    const send = vi.fn(async () => {});
    const response = await webhookRoutes().fetch(await request({ entry: [null, { id: "123", changes: [null], messaging: [null] }, ...event.entry] }), { META_APP_SECRET: "secret", EVENT_JOURNAL: { put: async () => {} }, INSTAGRAM_EVENTS: { send } } as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
    expect(response.status).toBe(200);
    await Promise.all(tasks);
    expect(send).toHaveBeenCalledOnce();
  });

  it("keeps postback queue IDs bounded when Meta omits mid", async () => {
    const tasks: Promise<unknown>[] = [];
    const send = vi.fn(async () => {});
    const response = await webhookRoutes().fetch(await request({ entry: [{ id: "123", time: 100, messaging: [{ timestamp: 99, sender: { id: "456" }, postback: { payload: "x".repeat(1000) } }] }] }), { META_APP_SECRET: "secret", EVENT_JOURNAL: { put: async () => {} }, INSTAGRAM_EVENTS: { send } } as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
    expect(response.status).toBe(200);
    await Promise.all(tasks);
    expect((send.mock.calls[0] as unknown as [{ externalId: string }])[0].externalId.length).toBeLessThanOrEqual(255);
  });

  it("records inbound admission after journaling and before publishing", async () => {
    const order: string[] = [];
    const tasks: Promise<unknown>[] = [];
    const db = {
      instagramAccount: { findUnique: async () => ({ id: "account" }) },
      $transaction: async (work: (transaction: unknown) => Promise<unknown>) => work({
        dailyBudget: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) },
        dailyAggregate: { upsert: async () => ({}) },
        processedEvent: { findUnique: async () => null, create: async () => { order.push("admission"); return {}; } },
      }),
    };
    const response = await webhookRoutes(() => db as never).fetch(await request(event), { META_APP_SECRET: "secret", EVENT_JOURNAL: { put: async () => { order.push("journal"); } }, INSTAGRAM_EVENTS: { send: async () => { order.push("queue"); } } } as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
    expect(response.status).toBe(200);
    await Promise.all(tasks);
    expect(order).toEqual(["journal", "admission", "queue"]);
  });
});
