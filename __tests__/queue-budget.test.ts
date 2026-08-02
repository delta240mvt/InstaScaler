import { describe, expect, it, vi } from "vitest";
import { estimateQueueOperations, recordDailyOutcome, reserveInboundEvent, reserveQueueJob, reserveQueueRetry, reserveWorkflowStep, validateDelaySeconds, type BudgetDb } from "@/lib/jobs/budget";

function budgetDb(count: number) {
  const globalUpdate = vi.fn(async () => ({ count }));
  const accountUpsert = vi.fn(async () => ({}));
  const db: BudgetDb = {
    $transaction: async <T,>(work: Parameters<BudgetDb["$transaction"]>[0]) => work({
      dailyBudget: { upsert: vi.fn(async () => ({})), updateMany: globalUpdate },
      dailyAggregate: { upsert: accountUpsert },
    }) as Promise<T>,
  };
  return { db, globalUpdate, accountUpsert };
}

describe("Queue Free budget", () => {
  it("budgets three operations per message and an extra read per retry", () => {
    expect(estimateQueueOperations({ messages: 2, retries: 1 })).toBe(7);
  });

  it("reserves optional work only below the conservative ceiling", async () => {
    const { db, globalUpdate, accountUpsert } = budgetDb(0);
    await expect(reserveQueueJob(db, "account", 1)).resolves.toEqual({ allowed: false, estimatedOperations: 3 });
    expect(globalUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ queueJobs: { lte: 9_497 } }) }));
    expect(accountUpsert).not.toHaveBeenCalled();
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

  it("stops optional workflow work before the free daily step ceiling", async () => {
    const { db, globalUpdate } = budgetDb(0);
    await expect(reserveWorkflowStep(db, "account", 1)).resolves.toBe(false);
    expect(globalUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workflowSteps: { lte: 2_799 } }) }));
  });
  it("accounts for the extra Queue read before scheduling a retry", async () => {
    const { db, globalUpdate, accountUpsert } = budgetDb(1);
    await expect(reserveQueueRetry(db, "account")).resolves.toBe(true);
    expect(globalUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { queueJobs: { increment: 1 } } }));
    expect(accountUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: { queueJobs: { increment: 1 } } }));
  });

  it("enforces one application-wide inbound limit while retaining per-account metrics", async () => {
    const { db, globalUpdate, accountUpsert } = budgetDb(1);
    await expect(reserveInboundEvent(db, "account-b")).resolves.toBe(true);
    expect(globalUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ received: { lt: 1_000 } }) }));
    expect(accountUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ instagramAccountId: "account-b", received: 1 }) }));
  });
});
