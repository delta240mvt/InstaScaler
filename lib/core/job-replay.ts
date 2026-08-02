import type { QueueBinding } from "@/lib/cloudflare/env";
import { reserveQueueJob, type BudgetDb } from "@/lib/jobs/budget";

export type ReplayEvent = { externalId: string; kind: "COMMENT" | "POSTBACK" | "MESSAGE" | "RECOVER_R2" | "FOLLOW_UP"; terminalStatus: string | null; r2Key: string | null; instagramAccount: { id: string; instagramId: string } | null };
export type ReplayDb = BudgetDb & {
  processedEvent: { findUnique(args: unknown): Promise<ReplayEvent | null>; update(args: unknown): Promise<unknown> };
};

export async function replayFailedEvent(db: ReplayDb, queue: QueueBinding, externalId: string) {
  const event = await db.processedEvent.findUnique({ where: { externalId }, include: { instagramAccount: { select: { id: true, instagramId: true } } } });
  if (!event || event.terminalStatus !== "FAILED" || !event.r2Key || !event.instagramAccount || event.kind === "FOLLOW_UP") return { status: "not_replayable" as const };
  if (!(await reserveQueueJob(db, event.instagramAccount.id, 1)).allowed) return { status: "budget_exhausted" as const };
  await db.processedEvent.update({ where: { externalId }, data: { terminalStatus: "RETRYING", completedAt: null } });
  try {
    await queue.send({ version: 1, kind: event.kind, externalId, instagramAccountId: event.instagramAccount.instagramId, r2Key: event.r2Key });
    return { status: "queued" as const };
  } catch (error) {
    await db.processedEvent.update({ where: { externalId }, data: { terminalStatus: "FAILED" } });
    throw error;
  }
}
