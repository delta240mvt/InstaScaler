import type { JobsEnv } from "@/lib/cloudflare/env";
import { createPrisma } from "@/lib/db/neon";
import { decryptToken, encryptToken } from "@/lib/core/meta-oauth";
import { journalEvent, loadJournalEvent, type EventEnvelope } from "@/lib/events/journal";
import { getRecentMediaComments, getUserInfo, getUserMedia, refreshLongLivedToken } from "@/lib/meta/client";
import { reserveQueueJob } from "@/lib/jobs/budget";

export type WorkflowTask = "reconcile" | "recover-journal" | "refresh-tokens" | "attach-next-reel" | "snapshot-followers" | "retention";
type Db = ReturnType<typeof createPrisma>;

async function accounts(db: Db) {
  return db.instagramAccount.findMany({ where: { webhookSubscribed: true }, orderBy: { connectedAt: "asc" }, take: 5 });
}

async function reconcile(db: Db, env: JobsEnv) {
  let published = 0;
  for (const account of await db.instagramAccount.findMany({ where: { webhookSubscribed: true }, include: { automations: { where: { isActive: true, postId: { not: null } }, select: { postId: true } } }, take: 5 })) {
    const token = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
    for (const mediaId of [...new Set(account.automations.flatMap((item) => item.postId ? [item.postId] : []))]) {
      const comments = await getRecentMediaComments(token, mediaId, Date.now() - 65 * 60_000, 100);
      for (const comment of comments) {
        if (!comment.from?.id || comment.from.id === account.instagramId) continue;
        const envelope: EventEnvelope = { version: 1, externalId: `comment:${comment.id}`, instagramAccountId: account.instagramId, kind: "COMMENT", receivedAt: new Date().toISOString(), payload: { commentId: comment.id, text: comment.text, fromId: comment.from.id, fromUsername: comment.from.username ?? null, mediaId } };
        const saved = await journalEvent(env.EVENT_JOURNAL, envelope);
        await env.INSTAGRAM_EVENTS.send({ version: 1, kind: "COMMENT", externalId: envelope.externalId, instagramAccountId: account.instagramId, r2Key: saved.key });
        published += 1;
      }
    }
  }
  return { published };
}

async function recoverJournal(db: Db, env: JobsEnv) {
  if (!env.EVENT_JOURNAL.list) return { recovered: 0 };
  let recovered = 0;
  let cursor: string | undefined;
  do {
    const page = await env.EVENT_JOURNAL.list({ prefix: "events/", cursor, limit: 100 });
    for (const object of page.objects) {
      const envelope = await loadJournalEvent(env.EVENT_JOURNAL, object.key);
      const existing = await db.processedEvent.findUnique({ where: { externalId: envelope.externalId } });
      const account = await db.instagramAccount.findUnique({ where: { instagramId: envelope.instagramAccountId }, select: { id: true } });
      if (account && (!existing || existing.terminalStatus === "RETRYING") && (await reserveQueueJob(db, account.id, 1)).allowed) {
        await env.INSTAGRAM_EVENTS.send({ version: 1, kind: envelope.kind, externalId: envelope.externalId, instagramAccountId: envelope.instagramAccountId, r2Key: object.key });
        recovered += 1;
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && recovered < 500);
  return { recovered };
}

async function refreshTokens(db: Db, env: JobsEnv) {
  let refreshed = 0;
  const threshold = new Date(Date.now() + 7 * 86_400_000);
  for (const account of await db.instagramAccount.findMany({ where: { tokenExpiresAt: { lte: threshold } }, take: 5 })) {
    const current = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
    const next = await refreshLongLivedToken(current);
    await db.instagramAccount.update({ where: { id: account.id }, data: { accessToken: await encryptToken(next.accessToken, env.ENCRYPTION_KEY), tokenExpiresAt: new Date(Date.now() + next.expiresIn * 1000) } });
    refreshed += 1;
  }
  return { refreshed };
}

async function attachNextReel(db: Db, env: JobsEnv) {
  let attached = 0;
  for (const account of await accounts(db)) {
    const pending = await db.automation.findFirst({ where: { instagramAccountId: account.id, pendingNextReel: true, isActive: true }, orderBy: { createdAt: "asc" } });
    if (!pending) continue;
    const media = await getUserMedia(await decryptToken(account.accessToken, env.ENCRYPTION_KEY), 25);
    const reel = media.find((item) => item.media_type === "VIDEO" || item.media_product_type === "REELS");
    if (reel) { await db.automation.update({ where: { id: pending.id }, data: { postId: reel.id, postUrl: reel.permalink ?? null, pendingNextReel: false } }); attached += 1; }
  }
  return { attached };
}

async function snapshotFollowers(db: Db, env: JobsEnv) {
  let snapshots = 0;
  const date = new Date(new Date().toISOString().slice(0, 10));
  for (const account of await accounts(db)) {
    const profile = await getUserInfo(await decryptToken(account.accessToken, env.ENCRYPTION_KEY));
    if (typeof profile.followers_count !== "number") continue;
    await db.followerSnapshot.upsert({ where: { instagramAccountId_date: { instagramAccountId: account.id, date } }, create: { instagramAccountId: account.id, date, followersCount: profile.followers_count }, update: { followersCount: profile.followers_count } });
    snapshots += 1;
  }
  return { snapshots };
}

async function retention(db: Db) {
  const cutoff = new Date(Date.now() - 90 * 86_400_000);
  const [dmLogs, processedEvents, operationalEvents] = await db.$transaction([
    db.dmLog.deleteMany({ where: { createdAt: { lt: cutoff }, status: { in: ["SENT", "SKIPPED", "FAILED"] } }, limit: 500 }),
    db.processedEvent.deleteMany({ where: { firstSeenAt: { lt: cutoff }, terminalStatus: { in: ["COMPLETED", "SKIPPED", "FAILED"] } }, limit: 500 }),
    db.operationalEvent.deleteMany({ where: { createdAt: { lt: cutoff }, resolvedAt: { not: null } }, limit: 500 }),
  ]);
  return { dmLogs: dmLogs.count, processedEvents: processedEvents.count, operationalEvents: operationalEvents.count };
}

export async function executeWorkflowTask(task: WorkflowTask, env: JobsEnv): Promise<unknown> {
  const db = createPrisma(env.DATABASE_URL);
  if (task === "reconcile") return reconcile(db, env);
  if (task === "recover-journal") return recoverJournal(db, env);
  if (task === "refresh-tokens") return refreshTokens(db, env);
  if (task === "attach-next-reel") return attachNextReel(db, env);
  if (task === "snapshot-followers") return snapshotFollowers(db, env);
  return retention(db);
}

export function workflowExternalId(task: WorkflowTask, now = new Date()): string {
  return `workflow:${task}:${now.toISOString().slice(0, task === "reconcile" || task === "recover-journal" ? 13 : 10)}`;
}

export async function withJobRun(task: WorkflowTask, env: JobsEnv, execute: () => Promise<unknown>) {
  const db = createPrisma(env.DATABASE_URL);
  const externalId = workflowExternalId(task);
  const existing = await db.jobRun.findUnique({ where: { externalId } });
  if (existing?.status === "COMPLETED" || existing?.status === "PROCESSING") return { skipped: true, reason: "already_started" };
  const run = existing
    ? await db.jobRun.update({ where: { id: existing.id }, data: { status: "PROCESSING", errorMessage: null, finishedAt: null, attempt: { increment: 1 } } })
    : await db.jobRun.create({ data: { externalId, kind: "RECOVER_R2", status: "PROCESSING" } });
  try {
    const result = await execute();
    await db.jobRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date() } });
    return result;
  } catch (error) {
    await db.jobRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unknown workflow error", finishedAt: new Date() } });
    throw error;
  }
}
