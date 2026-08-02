export const QUEUE_DAILY_OPERATION_LIMIT = 9_500;

export function estimateQueueOperations(input: { messages: number; retries?: number }): number {
  return input.messages * 3 + (input.retries ?? 0);
}

export function validateDelaySeconds(delaySeconds: number): number {
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 86_400) throw new Error("INVALID_QUEUE_DELAY");
  return delaySeconds;
}

export async function reserveQueueJob(
  db: { dailyAggregate: { upsert(args: unknown): Promise<{ queueJobs: number }> } },
  instagramAccountId: string,
  count: number,
): Promise<{ allowed: boolean; estimatedOperations: number }> {
  const estimatedOperations = estimateQueueOperations({ messages: count });
  const row = await db.dailyAggregate.upsert({
    where: { date_instagramAccountId: { date: new Date(new Date().toISOString().slice(0, 10)), instagramAccountId } },
    create: { date: new Date(new Date().toISOString().slice(0, 10)), instagramAccountId, queueJobs: estimatedOperations },
    update: { queueJobs: { increment: estimatedOperations } },
  });
  return { allowed: row.queueJobs <= QUEUE_DAILY_OPERATION_LIMIT, estimatedOperations };
}
