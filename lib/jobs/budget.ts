export const QUEUE_DAILY_OPERATION_LIMIT = 9_500;

export function estimateQueueOperations(input: { messages: number; retries?: number }): number {
  return input.messages * 3 + (input.retries ?? 0);
}

export function validateDelaySeconds(delaySeconds: number): number {
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 86_400) throw new Error("INVALID_QUEUE_DELAY");
  return delaySeconds;
}

type Aggregate = {
  upsert(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
type BudgetDb = { $transaction<T>(callback: (tx: { dailyAggregate: Aggregate }) => Promise<T>): Promise<T> };
export const INBOUND_DAILY_EVENT_LIMIT = 1_000;

type Outcome = { status: "sent" | "skipped" | "retry" | "failed"; code: string };

export async function recordDailyOutcome(db: { dailyAggregate: { upsert(args: unknown): Promise<unknown> } }, instagramAccountId: string, result: Outcome): Promise<void> {
  if (result.status === "retry" || result.code === "DUPLICATE_EVENT") return;
  const date = new Date(new Date().toISOString().slice(0, 10));
  const field = result.status === "sent" ? "sent" : result.status === "failed" ? "failed" : "skipped";
  await db.dailyAggregate.upsert({
    where: { date_instagramAccountId: { date, instagramAccountId } },
    create: { date, instagramAccountId, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

export async function reserveQueueJob(
  db: BudgetDb,
  instagramAccountId: string,
  count: number,
): Promise<{ allowed: boolean; estimatedOperations: number }> {
  const estimatedOperations = estimateQueueOperations({ messages: count });
  const date = new Date(new Date().toISOString().slice(0, 10));
  const allowed = await db.$transaction(async (tx) => {
    await tx.dailyAggregate.upsert({
      where: { date_instagramAccountId: { date, instagramAccountId } },
      create: { date, instagramAccountId, queueJobs: 0 },
      update: {},
    });
    const reserved = await tx.dailyAggregate.updateMany({
      where: { date, instagramAccountId, queueJobs: { lte: QUEUE_DAILY_OPERATION_LIMIT - estimatedOperations } },
      data: { queueJobs: { increment: estimatedOperations } },
    });
    return reserved.count === 1;
  });
  return { allowed, estimatedOperations };
}

export async function reserveInboundEvent(db: BudgetDb, instagramAccountId: string): Promise<boolean> {
  const date = new Date(new Date().toISOString().slice(0, 10));
  const operations = estimateQueueOperations({ messages: 1 });
  return db.$transaction(async (tx) => {
    await tx.dailyAggregate.upsert({ where: { date_instagramAccountId: { date, instagramAccountId } }, create: { date, instagramAccountId }, update: {} });
    const reserved = await tx.dailyAggregate.updateMany({
      where: { date, instagramAccountId, received: { lt: INBOUND_DAILY_EVENT_LIMIT }, queueJobs: { lte: QUEUE_DAILY_OPERATION_LIMIT - operations } },
      data: { received: { increment: 1 }, queueJobs: { increment: operations } },
    });
    return reserved.count === 1;
  });
}
