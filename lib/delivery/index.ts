import type { InstagramJob } from "@/lib/jobs/contracts";

export type JobResult = { status: "sent" | "skipped" | "retry" | "failed"; code: string };

type ProcessedEventDb = {
  processedEvent: {
    findUnique(args: unknown): Promise<{ terminalStatus?: string | null } | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
};

export async function processInstagramJob(
  context: {
    db: ProcessedEventDb;
    load: (key: string) => Promise<unknown>;
    remove?: (key: string) => Promise<void>;
    deliver: (job: InstagramJob, payload: unknown) => Promise<JobResult>;
    accountId?: string;
  },
  job: InstagramJob,
): Promise<JobResult> {
  const existing = await context.db.processedEvent.findUnique({ where: { externalId: job.externalId } });
  if (existing && existing.terminalStatus !== "RETRYING") return { status: "skipped", code: "DUPLICATE_EVENT" };
  if (!existing) await context.db.processedEvent.create({ data: { externalId: job.externalId, instagramAccountId: context.accountId, source: "r2Key" in job ? "WEBHOOK" : "INTERNAL", kind: job.kind, r2Key: "r2Key" in job ? job.r2Key : null, terminalStatus: "PROCESSING" } });
  else await context.db.processedEvent.update({ where: { externalId: job.externalId }, data: { terminalStatus: "PROCESSING" } });
  try {
    const payload = "r2Key" in job ? await context.load(job.r2Key) : job;
    const result = await context.deliver(job, payload);
    await context.db.processedEvent.update({ where: { externalId: job.externalId }, data: { terminalStatus: result.status === "sent" ? "COMPLETED" : result.status === "retry" ? "RETRYING" : result.status === "failed" ? "FAILED" : "SKIPPED", completedAt: result.status === "retry" ? null : new Date() } });
    if ((result.status === "sent" || result.status === "skipped") && "r2Key" in job && context.remove) await context.remove(job.r2Key);
    return result;
  } catch {
    await context.db.processedEvent.update({ where: { externalId: job.externalId }, data: { terminalStatus: "RETRYING" } });
    return { status: "retry", code: "DELIVERY_TRANSIENT_FAILURE" };
  }
}
