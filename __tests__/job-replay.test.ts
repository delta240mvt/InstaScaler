import { describe, expect, it, vi } from "vitest";
import { replayFailedEvent } from "@/lib/core/job-replay";
import type { BudgetDb } from "@/lib/jobs/budget";

describe("manual failed-job replay", () => {
  it("replays a retained FOLLOW_UP with its original recipient, campaign and due time", async () => {
    const saved = { version: 1, kind: "FOLLOW_UP", externalId: "follow", instagramAccountId: "ig", automationId: "campaign", userId: "recipient", dueAt: "2026-09-08T12:00:00.000Z", r2Key: "follow-ups/x.json" };
    const send = vi.fn(async () => undefined);
    const db = {
      processedEvent: { findUnique: async () => ({ externalId: "follow", kind: "FOLLOW_UP" as const, terminalStatus: "FAILED", r2Key: "follow-ups/x.json", instagramAccount: { id: "account", instagramId: "ig" } }), update: vi.fn(async () => ({})) },
      $transaction: async <T,>(work: Parameters<BudgetDb["$transaction"]>[0]) => work({ dailyAggregate: { upsert: async () => ({}) }, dailyBudget: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) } }) as Promise<T>,
    };
    await expect(replayFailedEvent(db, { send }, "follow", { get: async () => ({ text: async () => JSON.stringify(saved) }) })).resolves.toEqual({ status: "queued" });
    expect(send).toHaveBeenCalledWith(saved);
  });

  it("reserves queue budget and republishes the retained R2 envelope", async () => {
    const send = vi.fn(async () => undefined);
    const update = vi.fn(async () => ({}));
    const db = {
      processedEvent: { findUnique: vi.fn(async () => ({ externalId: "event", kind: "COMMENT" as const, terminalStatus: "FAILED", r2Key: "events/x.json", instagramAccount: { id: "account", instagramId: "ig" } })), update },
      $transaction: async <T,>(work: Parameters<BudgetDb["$transaction"]>[0]) => work({ dailyAggregate: { upsert: vi.fn(async () => ({})) }, dailyBudget: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) } }) as Promise<T>,
    };
    await expect(replayFailedEvent(db, { send }, "event")).resolves.toEqual({ status: "queued" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ externalId: "event", r2Key: "events/x.json" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ terminalStatus: "RETRYING" }) }));
  });
});
