import type { JobsEnv } from "@/lib/cloudflare/env";
import { AccountRateLimiter } from "@/workers/jobs/account-rate-limiter";
import { scheduledTasksForCron } from "@/workers/jobs/scheduled";
import { createPrisma } from "@/lib/db/neon";
import { loadJournalEvent, deleteJournalEvent } from "@/lib/events/journal";
import { parseInstagramJob } from "@/lib/jobs/contracts";
import { processInstagramJob, type JobResult } from "@/lib/delivery";
import { deliverInstagramJob } from "@/lib/delivery/runtime";
import { recordDailyOutcome } from "@/lib/jobs/budget";

type QueueMessage<T = unknown> = {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

type QueueBatch = { messages: QueueMessage[] };

export async function consumeQueueBatch(
  batch: QueueBatch,
  process: (body: Record<string, unknown>) => Promise<JobResult>,
): Promise<void> {
  await Promise.all(batch.messages.map(async (message) => {
    const result = await process(message.body as Record<string, unknown>);
    if (result.status === "retry") message.retry({ delaySeconds: 60 });
    else message.ack();
  }));
}

export default {
  async queue(batch: QueueBatch, env: JobsEnv): Promise<void> {
    const db = createPrisma(env.DATABASE_URL);
    await consumeQueueBatch(batch, async (body) => {
      let job;
      try { job = parseInstagramJob(body); }
      catch { return { status: "failed", code: "INVALID_JOB" }; }
      const result = await processInstagramJob({
        db,
        load: (key) => loadJournalEvent(env.EVENT_JOURNAL, key),
        remove: (key) => deleteJournalEvent(env.EVENT_JOURNAL as Required<Pick<typeof env.EVENT_JOURNAL, "delete">>, key),
        deliver: (currentJob, payload) => deliverInstagramJob({ db, env }, currentJob, payload),
      }, job);
      const account = await db.instagramAccount.findUnique({ where: { instagramId: job.instagramAccountId }, select: { id: true } });
      if (account) await recordDailyOutcome(db, account.id, result);
      return result;
    });
  },
  async scheduled(event: { cron: string }): Promise<void> {
    for (const task of scheduledTasksForCron(event.cron)) console.log("Starting scheduled Jobs task", { task });
  },
};

export { AccountRateLimiter };
export { ReconcileAccountWorkflow } from "@/workers/jobs/workflows/reconcile-account";
export { RecoverJournalWorkflow } from "@/workers/jobs/workflows/recover-journal";
export { RefreshTokensWorkflow } from "@/workers/jobs/workflows/refresh-tokens";
export { AttachNextReelWorkflow } from "@/workers/jobs/workflows/attach-next-reel";
export { SnapshotFollowersWorkflow } from "@/workers/jobs/workflows/snapshot-followers";
export { RetentionWorkflow } from "@/workers/jobs/workflows/retention";
