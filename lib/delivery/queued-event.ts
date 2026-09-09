import type { JobsEnv } from "@/lib/cloudflare/env";
import { createPrisma } from "@/lib/db/neon";
import { loadJournalEvent, deleteJournalEvent, journalFollowUpJob } from "@/lib/events/journal";
import { parseInstagramJob } from "@/lib/jobs/contracts";
import { processInstagramJob, type JobResult } from "./index";
import { deliverInstagramJob } from "./runtime";
import { recordDailyOutcome } from "@/lib/jobs/budget";

// Both the immediate service call and durable Queue use this exact delivery path.
export async function processQueuedEvent(env: JobsEnv, body: unknown): Promise<JobResult> {
  const db = createPrisma(env.DATABASE_URL);
  const startedAt = Date.now();
  let journalAgeMs: number | null = null;
  let job;
  try { job = parseInstagramJob(body); }
  catch { return { status: "failed", code: "INVALID_JOB" }; }
  if (job.kind === "FOLLOW_UP" && !job.r2Key) job = await journalFollowUpJob(env.EVENT_JOURNAL, job);
  const account = await db.instagramAccount.findUnique({ where: { instagramId: job.instagramAccountId }, select: { id: true } });
  const result = await processInstagramJob({
    db,
    accountId: account?.id,
    load: async (key) => {
      const envelope = await loadJournalEvent(env.EVENT_JOURNAL, key);
      if (envelope.receivedAt) journalAgeMs = startedAt - Date.parse(envelope.receivedAt);
      return envelope;
    },
    remove: (key) => deleteJournalEvent(env.EVENT_JOURNAL as Required<Pick<typeof env.EVENT_JOURNAL, "delete">>, key),
    deliver: (currentJob, payload) => deliverInstagramJob({ db, env }, currentJob, payload),
  }, job);
  if (account) await recordDailyOutcome(db, account.id, result);
  console.info("instagram_job_timing", { kind: job.kind, journalAgeMs, elapsedMs: Date.now() - startedAt, code: result.code });
  return result;
}
