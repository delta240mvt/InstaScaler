import type { JobsEnv } from "@/lib/cloudflare/env";
import { AccountRateLimiter } from "@/workers/jobs/account-rate-limiter";
import { createPrisma } from "@/lib/db/neon";
import { loadJournalEvent, deleteJournalEvent, journalFollowUpJob } from "@/lib/events/journal";
import { parseInstagramJob } from "@/lib/jobs/contracts";
import { processInstagramJob, type JobResult } from "@/lib/delivery";
import { deliverInstagramJob } from "@/lib/delivery/runtime";
import { recordDailyOutcome, reserveQueueRetry } from "@/lib/jobs/budget";

type QueueMessage<T = unknown> = {
  body: T;
  attempts?: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

type QueueBatch = { messages: QueueMessage[] };

export function retryDelaySeconds(attempts = 1): number {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 3_600);
}

export async function consumeQueueBatch(
  batch: QueueBatch,
  process: (body: Record<string, unknown>) => Promise<JobResult>,
  beforeRetry: (body: Record<string, unknown>) => Promise<boolean> = async () => true,
): Promise<void> {
  await Promise.all(batch.messages.map(async (message) => {
    const result = await process(message.body as Record<string, unknown>);
    if (result.status === "retry" && await beforeRetry(message.body as Record<string, unknown>)) message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
    else message.ack();
  }));
}

const worker = {
  async fetch(request: Request, env: JobsEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return Response.json({ status: "ok", service: "jobs" });
    if (url.pathname !== "/internal/bootstrap" || request.method !== "POST") return new Response("Not found", { status: 404 });
    if (!env.SCHEDULER_BOOTSTRAP_TOKEN || request.headers.get("authorization") !== `Bearer ${env.SCHEDULER_BOOTSTRAP_TOKEN}`) return new Response("Unauthorized", { status: 401 });
    const scheduler = env.WORKFLOW_SCHEDULER.get(env.WORKFLOW_SCHEDULER.idFromName("singleton"));
    return Response.json(await scheduler.bootstrap());
  },
  async queue(batch: QueueBatch, env: JobsEnv): Promise<void> {
    const db = createPrisma(env.DATABASE_URL);
    await consumeQueueBatch(batch, async (body) => {
      let job;
      try { job = parseInstagramJob(body); }
      catch { return { status: "failed", code: "INVALID_JOB" }; }
      if (job.kind === "FOLLOW_UP" && !job.r2Key) job = await journalFollowUpJob(env.EVENT_JOURNAL, job);
      const account = await db.instagramAccount.findUnique({ where: { instagramId: job.instagramAccountId }, select: { id: true } });
      const result = await processInstagramJob({
        db,
        accountId: account?.id,
        load: (key) => loadJournalEvent(env.EVENT_JOURNAL, key),
        remove: (key) => deleteJournalEvent(env.EVENT_JOURNAL as Required<Pick<typeof env.EVENT_JOURNAL, "delete">>, key),
        deliver: (currentJob, payload) => deliverInstagramJob({ db, env }, currentJob, payload),
      }, job);
      if (account) await recordDailyOutcome(db, account.id, result);
      return result;
    }, async (body) => {
      let job;
      try { job = parseInstagramJob(body); } catch { return false; }
      const account = await db.instagramAccount.findUnique({ where: { instagramId: job.instagramAccountId }, select: { id: true } });
      return account ? reserveQueueRetry(db, account.id) : false;
    });
  },
};

export default worker;

export { AccountRateLimiter };
export { ManualMessages } from "@/workers/jobs/manual-messages";
export { WorkflowScheduler } from "@/workers/jobs/workflow-scheduler";
export { ReconcileAccountWorkflow } from "@/workers/jobs/workflows/reconcile-account";
export { RecoverJournalWorkflow } from "@/workers/jobs/workflows/recover-journal";
export { RefreshTokensWorkflow } from "@/workers/jobs/workflows/refresh-tokens";
export { AttachNextReelWorkflow } from "@/workers/jobs/workflows/attach-next-reel";
export { SnapshotFollowersWorkflow } from "@/workers/jobs/workflows/snapshot-followers";
export { RetentionWorkflow } from "@/workers/jobs/workflows/retention";
