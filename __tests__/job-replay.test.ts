import { describe, expect, it, vi } from "vitest";
import { replayFailedEvent } from "@/lib/core/job-replay";
import type { BudgetDb } from "@/lib/jobs/budget";

describe("manual failed-job replay", () => {
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
