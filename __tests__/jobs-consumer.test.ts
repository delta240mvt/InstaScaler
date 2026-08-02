import { describe, expect, it, vi } from "vitest";
import { processInstagramJob } from "@/lib/delivery";
import { consumeQueueBatch, retryDelaySeconds } from "@/workers/jobs/index";

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

  it("keeps a permanently failed envelope for manual replay and records account ownership", async () => {
    const remove = vi.fn();
    const create = vi.fn(async () => ({}));
    const db = { processedEvent: { findUnique: async () => null, create, update: vi.fn(async () => ({})) } };
    const result = await processInstagramJob(
      { db, accountId: "internal-account", load: async () => ({}), remove, deliver: async () => ({ status: "failed", code: "META_PERMANENT" }) },
      { version: 1, kind: "COMMENT", externalId: "failed", instagramAccountId: "ig", r2Key: "events/failed.json" },
    );
    expect(result.status).toBe("failed");
    expect(remove).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ instagramAccountId: "internal-account" }) }));
  });
});

describe("Cloudflare Queue acknowledgements", () => {
  it("uses bounded exponential retry delays", () => {
    expect([1, 2, 3, 7, 99].map(retryDelaySeconds)).toEqual([60, 120, 240, 3600, 3600]);
  });

  it("acks terminal outcomes and retries transient outcomes", async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const messages = [
      { body: { externalId: "one" }, attempts: 1, ack, retry },
      { body: { externalId: "two" }, attempts: 2, ack: vi.fn(), retry },
    ];
    await consumeQueueBatch({ messages }, async (body) => body.externalId === "one"
      ? { status: "sent", code: "SENT" }
      : { status: "retry", code: "TRANSIENT" });
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 120 });
  });

  it("acks a transient outcome when the retry budget is exhausted so R2 recovery can defer it", async () => {
    const ack = vi.fn();
    const retry = vi.fn();
    await consumeQueueBatch({ messages: [{ body: { externalId: "one" }, attempts: 5, ack, retry }] }, async () => ({ status: "retry", code: "TRANSIENT" }), async () => false);
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
  });
});
