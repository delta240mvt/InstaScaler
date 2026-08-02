import { describe, expect, it, vi } from "vitest";
import { processInstagramJob } from "@/lib/delivery";
import { consumeQueueBatch } from "@/workers/jobs/index";

describe("Queue consumer", () => {
  it("does not deliver a duplicate external event twice", async () => {
    const delivery = vi.fn(async () => ({ status: "sent" as const, code: "SENT" }));
    const db = { processedEvent: { findUnique: async () => ({ terminalStatus: "COMPLETED" }), create: vi.fn(), update: vi.fn() } };
    const result = await processInstagramJob({ db, load: async () => ({ commentId: "comment" }), deliver: delivery }, { version: 1, kind: "COMMENT", externalId: "event", instagramAccountId: "account", r2Key: "events/x.json" });
    expect(result).toEqual({ status: "skipped", code: "DUPLICATE_EVENT" });
    expect(delivery).not.toHaveBeenCalled();
  });

  it("continues a retry and removes the journal only after a terminal result", async () => {
    const remove = vi.fn(async () => undefined);
    const update = vi.fn(async () => ({}));
    const db = { processedEvent: { findUnique: async () => ({ terminalStatus: "RETRYING" }), create: vi.fn(), update } };
    const result = await processInstagramJob(
      { db, load: async () => ({ commentId: "comment" }), remove, deliver: async () => ({ status: "sent", code: "SENT" }) },
      { version: 1, kind: "COMMENT", externalId: "event", instagramAccountId: "account", r2Key: "events/x.json" },
    );
    expect(result.status).toBe("sent");
    expect(remove).toHaveBeenCalledWith("events/x.json");
  });

  it("keeps the journal and marks transient failures for retry", async () => {
    const remove = vi.fn();
    const update = vi.fn(async () => ({}));
    const db = { processedEvent: { findUnique: async () => null, create: vi.fn(async () => ({})), update } };
    const result = await processInstagramJob(
      { db, load: async () => ({}), remove, deliver: async () => { throw new Error("Neon unavailable"); } },
      { version: 1, kind: "MESSAGE", externalId: "message", instagramAccountId: "account", r2Key: "events/y.json" },
    );
    expect(result).toEqual({ status: "retry", code: "DELIVERY_TRANSIENT_FAILURE" });
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("Cloudflare Queue acknowledgements", () => {
  it("acks terminal outcomes and retries transient outcomes", async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const messages = [
      { body: { externalId: "one" }, ack, retry },
      { body: { externalId: "two" }, ack: vi.fn(), retry },
    ];
    await consumeQueueBatch({ messages }, async (body) => body.externalId === "one"
      ? { status: "sent", code: "SENT" }
      : { status: "retry", code: "TRANSIENT" });
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 60 });
  });
});
