export const QUEUE_DAILY_OPERATION_LIMIT = 9_500;
export const WORKFLOW_DAILY_STEP_LIMIT = 2_800;

export function estimateQueueOperations(input: { messages: number; retries?: number }): number {
  return input.messages * 3 + (input.retries ?? 0);
}

export function validateDelaySeconds(delaySeconds: number): number {
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 86_400) throw new Error("INVALID_QUEUE_DELAY");
  return delaySeconds;
}

type Aggregate = {
  upsert(args: unknown): Promise<unknown>;
};
type GlobalBudget = Aggregate & { updateMany(args: unknown): Promise<{ count: number }> };
export type BudgetDb = { $transaction<T>(callback: (tx: { dailyAggregate: Aggregate; dailyBudget: GlobalBudget }) => Promise<T>): Promise<T> };
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
    await tx.dailyBudget.upsert({ where: { date }, create: { date }, update: {} });
    const reserved = await tx.dailyBudget.updateMany({
      where: { date, queueJobs: { lte: QUEUE_DAILY_OPERATION_LIMIT - estimatedOperations } },
      data: { queueJobs: { increment: estimatedOperations } },
    });
    if (reserved.count === 1) await tx.dailyAggregate.upsert({
      where: { date_instagramAccountId: { date, instagramAccountId } },
      create: { date, instagramAccountId, queueJobs: estimatedOperations },
      update: { queueJobs: { increment: estimatedOperations } },
    });
    return reserved.count === 1;
  });
  return { allowed, estimatedOperations };
}

export async function reserveQueueRetry(db: BudgetDb, instagramAccountId: string): Promise<boolean> {
  const date = new Date(new Date().toISOString().slice(0, 10));
  return db.$transaction(async (tx) => {
    await tx.dailyBudget.upsert({ where: { date }, create: { date }, update: {} });
    const reserved = await tx.dailyBudget.updateMany({
      where: { date, queueJobs: { lt: QUEUE_DAILY_OPERATION_LIMIT } },
      data: { queueJobs: { increment: 1 } },
    });
    if (reserved.count === 1) await tx.dailyAggregate.upsert({
      where: { date_instagramAccountId: { date, instagramAccountId } },
      create: { date, instagramAccountId, queueJobs: 1 },
      update: { queueJobs: { increment: 1 } },
    });
    return reserved.count === 1;
  });
}

export async function reserveInboundEvent(db: BudgetDb, instagramAccountId: string): Promise<boolean> {
  const date = new Date(new Date().toISOString().slice(0, 10));
  const operations = estimateQueueOperations({ messages: 1 });
  return db.$transaction(async (tx) => {
    await tx.dailyBudget.upsert({ where: { date }, create: { date }, update: {} });
    const reserved = await tx.dailyBudget.updateMany({
      where: { date, received: { lt: INBOUND_DAILY_EVENT_LIMIT }, queueJobs: { lte: QUEUE_DAILY_OPERATION_LIMIT - operations } },
      data: { received: { increment: 1 }, queueJobs: { increment: operations } },
    });
    if (reserved.count === 1) await tx.dailyAggregate.upsert({
      where: { date_instagramAccountId: { date, instagramAccountId } },
      create: { date, instagramAccountId, received: 1, queueJobs: operations },
      update: { received: { increment: 1 }, queueJobs: { increment: operations } },
    });
    return reserved.count === 1;
  });
}

export async function reserveWorkflowStep(db: BudgetDb, instagramAccountId: string, count = 1): Promise<boolean> {
  if (!Number.isInteger(count) || count < 1) return false;
  const date = new Date(new Date().toISOString().slice(0, 10));
  return db.$transaction(async (tx) => {
    await tx.dailyBudget.upsert({ where: { date }, create: { date }, update: {} });
    const reserved = await tx.dailyBudget.updateMany({
      where: { date, workflowSteps: { lte: WORKFLOW_DAILY_STEP_LIMIT - count } },
      data: { workflowSteps: { increment: count } },
    });
    if (reserved.count === 1) await tx.dailyAggregate.upsert({
      where: { date_instagramAccountId: { date, instagramAccountId } },
      create: { date, instagramAccountId, workflowSteps: count },
      update: { workflowSteps: { increment: count } },
    });
    return reserved.count === 1;
  });
}
