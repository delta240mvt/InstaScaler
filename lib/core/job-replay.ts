import type { QueueBinding } from "@/lib/cloudflare/env";
import { reserveQueueJob, type BudgetDb } from "@/lib/jobs/budget";
import { loadJournalEvent, type JournalBucket } from "@/lib/events/journal";
import { parseInstagramJob, type InstagramJob } from "@/lib/jobs/contracts";

export type ReplayEvent = { externalId: string; kind: "COMMENT" | "POSTBACK" | "MESSAGE" | "RECOVER_R2" | "FOLLOW_UP"; terminalStatus: string | null; r2Key: string | null; instagramAccount: { id: string; instagramId: string } | null };
export type ReplayDb = BudgetDb & {
  processedEvent: { findUnique(args: unknown): Promise<ReplayEvent | null>; update(args: unknown): Promise<unknown> };
};

export async function replayFailedEvent(db: ReplayDb, queue: QueueBinding, externalId: string, bucket?: Pick<JournalBucket, "get">) {
  const event = await db.processedEvent.findUnique({ where: { externalId }, include: { instagramAccount: { select: { id: true, instagramId: true } } } });
  if (!event || event.terminalStatus !== "FAILED" || !event.r2Key || !event.instagramAccount) return { status: "not_replayable" as const };
  let job: InstagramJob;
  if (event.kind === "FOLLOW_UP") {
    if (!bucket) return { status: "not_replayable" as const };
    const saved = parseInstagramJob(await loadJournalEvent(bucket, event.r2Key));
    if (saved.kind !== "FOLLOW_UP" || saved.externalId !== externalId || saved.instagramAccountId !== event.instagramAccount.instagramId) return { status: "not_replayable" as const };
    job = { ...saved, r2Key: event.r2Key };
  } else {
    job = { version: 1, kind: event.kind, externalId, instagramAccountId: event.instagramAccount.instagramId, r2Key: event.r2Key };
  }
  if (!(await reserveQueueJob(db, event.instagramAccount.id, 1)).allowed) return { status: "budget_exhausted" as const };
  await db.processedEvent.update({ where: { externalId }, data: { terminalStatus: "RETRYING", completedAt: null } });
  try {
    await queue.send(job);
    return { status: "queued" as const };
  } catch (error) {
    await db.processedEvent.update({ where: { externalId }, data: { terminalStatus: "FAILED" } });
    throw error;
  }
}
