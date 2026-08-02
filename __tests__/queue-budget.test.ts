import { describe, expect, it, vi } from "vitest";
import { estimateQueueOperations, recordDailyOutcome, reserveQueueJob, validateDelaySeconds } from "@/lib/jobs/budget";

describe("Queue Free budget", () => {
  it("budgets three operations per message and an extra read per retry", () => {
    expect(estimateQueueOperations({ messages: 2, retries: 1 })).toBe(7);
  });

  it("reserves optional work only below the conservative ceiling", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const db = { $transaction: async <T,>(work: (tx: { dailyAggregate: { upsert(args: unknown): Promise<unknown>; updateMany(args: unknown): Promise<{ count: number }> } }) => Promise<T>) => work({ dailyAggregate: { upsert: vi.fn(async () => ({})), updateMany } }) };
    await expect(reserveQueueJob(db, "account", 1)).resolves.toEqual({ allowed: false, estimatedOperations: 3 });
  });
  it("accepts follow-up delays through 24 hours only", () => {
    expect(validateDelaySeconds(0)).toBe(0);
    expect(validateDelaySeconds(86_400)).toBe(86_400);
    expect(() => validateDelaySeconds(86_401)).toThrow();
  });

  it("records terminal delivery outcomes but not retries or duplicate queue deliveries", async () => {
    const upsert = vi.fn(async () => ({}));
    const db = { dailyAggregate: { upsert } };
    await recordDailyOutcome(db, "account", { status: "sent", code: "FREEBIE_SENT" });
    await recordDailyOutcome(db, "account", { status: "retry", code: "RATE_LIMIT" });
    await recordDailyOutcome(db, "account", { status: "skipped", code: "DUPLICATE_EVENT" });
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { sent: { increment: 1 } } }));
  });
});
