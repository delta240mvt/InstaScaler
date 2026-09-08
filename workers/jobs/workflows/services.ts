import type { JobsEnv } from "@/lib/cloudflare/env";
import { createPrisma } from "@/lib/db/neon";
import { decryptToken, encryptToken } from "@/lib/core/meta-oauth";
import { journalEvent, loadJournalEvent, type EventEnvelope } from "@/lib/events/journal";
import { getRecentMediaComments, getUserInfo, getUserMedia, refreshLongLivedToken } from "@/lib/meta/client";
import { admitInboundEvent, reserveQueueJob, reserveWorkflowStep } from "@/lib/jobs/budget";
import { PermissionError, TokenExpiredError } from "@/lib/meta/client";
import { assignNextMedia } from "@/lib/workflows/next-media";
import { parseInstagramJob, type InstagramJob } from "@/lib/jobs/contracts";
import { deliveryError } from "@/lib/delivery/errors";
import { recoverQuizWork } from "@/lib/quiz/recovery";
import { retainQuizWork } from "@/lib/quiz/privacy";
import { graphSchema } from "@/lib/quiz/contracts";
import { isQuizRecoveryEvent } from "@/lib/delivery/quiz";

export type WorkflowTask = "reconcile" | "recover-journal" | "refresh-tokens" | "attach-next-reel" | "snapshot-followers" | "retention";
type Db = ReturnType<typeof createPrisma>;

export function workflowJobKind(task: WorkflowTask) {
  return ({ reconcile: "RECONCILE", "recover-journal": "RECOVER_R2", "refresh-tokens": "REFRESH_TOKENS", "attach-next-reel": "ATTACH_NEXT_REEL", "snapshot-followers": "SNAPSHOT_FOLLOWERS", retention: "RETENTION" } as const)[task];
}

async function runAccountWorkflowStep<T>(db: Db, task: WorkflowTask, accountId: string, execute: () => Promise<T>, fallback: T): Promise<T> {
  const externalId = `${workflowExternalId(task)}:${accountId}`;
  const existing = await db.jobRun.findUnique({ where: { externalId } });
  if (existing?.status === "COMPLETED") return fallback;
  const run = existing
    ? await db.jobRun.update({ where: { id: existing.id }, data: { status: "PROCESSING", errorMessage: null, finishedAt: null, attempt: { increment: 1 } } })
    : await db.jobRun.create({ data: { externalId, instagramAccountId: accountId, kind: workflowJobKind(task), status: "PROCESSING" } });
  try {
    const result = await execute();
    await db.jobRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date() } });
    return result;
  } catch (error) {
    await db.jobRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: deliveryError(error).code, finishedAt: new Date() } });
    if (error instanceof TokenExpiredError || error instanceof PermissionError) await db.instagramAccount.update({ where: { id: accountId }, data: { webhookSubscribed: false, requiresReconnect: true, lastErrorCode: error instanceof TokenExpiredError ? "META_TOKEN_EXPIRED" : "META_PERMISSION" } });
    await db.operationalEvent.create({ data: { source: "WORKFLOW", level: "ERROR", message: `Account workflow ${task} failed`, payload: { accountId, code: deliveryError(error).code } } });
    if (deliveryError(error).status === "retry") throw error;
    return fallback;
  }
}

async function accounts(db: Db) {
  const rows = await db.instagramAccount.findMany({ where: { webhookSubscribed: true }, orderBy: { connectedAt: "asc" }, take: 5 });
  const eligible: typeof rows = [];
  for (const account of rows) if (await reserveWorkflowStep(db, account.id)) eligible.push(account);
  return eligible;
}

async function reconcile(db: Db, env: JobsEnv) {
  let published = 0;
  for (const account of await db.instagramAccount.findMany({ where: { webhookSubscribed: true }, include: { automations: { where: { isActive: true, postId: { not: null } }, select: { postId: true } } }, take: 5 })) {
    if (!await reserveWorkflowStep(db, account.id)) continue;
    published += await runAccountWorkflowStep(db, "reconcile", account.id, async () => {
      let accountPublished = 0;
      const token = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
      const quizPaths = db.quizPath ? await db.quizPath.findMany({ where: { instagramAccountId: account.id, acceptsEntries: true, halted: false }, include: { publishedVersion: true }, take: 100 }) : [];
      const quizPosts = quizPaths.flatMap(p => { const start = p.publishedVersion && graphSchema.parse(p.publishedVersion.graph).nodes.find(n => n.type === "start"); return start?.type === "start" ? start.postIds : []; });
      for (const mediaId of [...new Set([...account.automations.flatMap((item) => item.postId ? [item.postId] : []), ...quizPosts])].slice(0, 100)) {
        const comments = await getRecentMediaComments(token, mediaId, Date.now() - 65 * 60_000, 100);
        for (const comment of comments) {
          if (!comment.from?.id || comment.from.id === account.instagramId) continue;
          const envelope: EventEnvelope = { version: 1, externalId: `comment:${comment.id}`, instagramAccountId: account.instagramId, kind: "COMMENT", receivedAt: new Date().toISOString(), payload: { occurredAt: comment.timestamp, commentId: comment.id, text: comment.text, fromId: comment.from.id, fromUsername: comment.from.username ?? null, mediaId } };
          const saved = await journalEvent(env.EVENT_JOURNAL, envelope);
          if (await admitInboundEvent(db, { externalId: envelope.externalId, instagramAccountId: account.id, kind: envelope.kind, r2Key: saved.key, source: "POLLING" }) !== "admitted") continue;
          await env.INSTAGRAM_EVENTS.send({ version: 1, kind: "COMMENT", externalId: envelope.externalId, instagramAccountId: account.instagramId, r2Key: saved.key });
          accountPublished += 1;
        }
      }
      return accountPublished;
    }, 0);
  }
  return { published };
}

async function recoverJournal(db: Db, env: JobsEnv) {
  const quizzes = db.quizWork ? await recoverQuizWork(db, env) : { recovered: 0 };
  const events = await recoverJournalPrefix(db, env, "events/");
  const followUps = await recoverJournalPrefix(db, env, "follow-ups/");
  return { recovered: events.recovered + followUps.recovered + quizzes.recovered };
}

async function recoverJournalPrefix(db: Db, env: JobsEnv, prefix: "events/" | "follow-ups/") {
  if (!env.EVENT_JOURNAL.list) return { recovered: 0 };
  let recovered = 0;
  let scanned = 0;
  const workflowAccounts = new Map<string, boolean>();
  const cursorKey = prefix === "events/" ? "control/journal-recovery-cursor.json" : "control/follow-up-recovery-cursor.json";
  const savedCursor = await env.EVENT_JOURNAL.get(cursorKey);
  const cursorValue: unknown = savedCursor ? JSON.parse(await savedCursor.text()) : null;
  let cursor = typeof cursorValue === "string" ? cursorValue : undefined;
  do {
    const page = await env.EVENT_JOURNAL.list({ prefix, cursor, limit: 100 });
    for (const object of page.objects) {
      scanned += 1;
      let envelope: EventEnvelope;
      try { envelope = await loadJournalEvent(env.EVENT_JOURNAL, object.key); }
      catch (error) {
        if (error instanceof Error && error.message === "JOURNAL_EVENT_NOT_FOUND") continue;
        throw error;
      }
      const job: InstagramJob = prefix === "follow-ups/"
        ? { ...parseInstagramJob(envelope), r2Key: object.key }
        : { version: 1, kind: envelope.kind, externalId: envelope.externalId, instagramAccountId: envelope.instagramAccountId, r2Key: object.key };
      let existing = await db.processedEvent.findUnique({ where: { externalId: envelope.externalId } });
      if (db.quizPath && prefix === "events/" && existing?.terminalStatus === "PROCESSING" && existing.firstSeenAt < new Date(Date.now() - 120_000) && await isQuizRecoveryEvent(db, envelope)) {
        await db.processedEvent.updateMany({ where: { id: existing.id, terminalStatus: "PROCESSING" }, data: { terminalStatus: "RETRYING" } });
        existing = await db.processedEvent.findUnique({ where: { externalId: envelope.externalId } });
      }
      if (existing?.terminalStatus === "COMPLETED" || existing?.terminalStatus === "SKIPPED") {
        if (env.EVENT_JOURNAL.delete) await env.EVENT_JOURNAL.delete(object.key);
        continue;
      }
      if (job.kind === "FOLLOW_UP" && Date.parse(job.dueAt) > Date.now()) continue;
      const account = await db.instagramAccount.findUnique({ where: { instagramId: envelope.instagramAccountId }, select: { id: true } });
      if (account && !workflowAccounts.has(account.id)) workflowAccounts.set(account.id, await reserveWorkflowStep(db, account.id));
      if (account && workflowAccounts.get(account.id) && (!existing || existing.terminalStatus === "RETRYING" || existing.terminalStatus === "RECEIVED")) {
        if (!existing && job.kind !== "FOLLOW_UP" && job.kind !== "RECOVER_R2" && job.kind !== "QUIZ_STEP") {
          if (await admitInboundEvent(db, { externalId: job.externalId, instagramAccountId: account.id, kind: job.kind, r2Key: object.key, source: "RECOVERY" }) !== "admitted") continue;
        } else if (!(await reserveQueueJob(db, account.id, 1)).allowed) continue;
        await env.INSTAGRAM_EVENTS.send(job);
        recovered += 1;
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
    await env.EVENT_JOURNAL.put(cursorKey, JSON.stringify(cursor ?? null));
  } while (cursor && scanned < 500);
  return { recovered };
}

async function refreshTokens(db: Db, env: JobsEnv) {
  let refreshed = 0;
  const threshold = new Date(Date.now() + 7 * 86_400_000);
  for (const account of await db.instagramAccount.findMany({ where: { tokenExpiresAt: { lte: threshold } }, take: 5 })) {
    if (!await reserveWorkflowStep(db, account.id)) continue;
    refreshed += await runAccountWorkflowStep(db, "refresh-tokens", account.id, async () => {
      const current = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
      const next = await refreshLongLivedToken(current);
      await db.instagramAccount.update({ where: { id: account.id }, data: { accessToken: await encryptToken(next.accessToken, env.ENCRYPTION_KEY), tokenExpiresAt: new Date(Date.now() + next.expiresIn * 1000), requiresReconnect: false, lastErrorCode: null } });
      return 1;
    }, 0);
  }
  return { refreshed };
}

async function attachNextReel(db: Db, env: JobsEnv) {
  let attached = 0;
  for (const account of await accounts(db)) {
    attached += await runAccountWorkflowStep(db, "attach-next-reel", account.id, async () => {
      const pending = await db.automation.findMany({
        where: { instagramAccountId: account.id, pendingNextReel: true, isActive: true },
        orderBy: { updatedAt: "asc" },
        select: { id: true, createdAt: true, updatedAt: true },
      });
      if (pending.length === 0) return 0;
      const media = await getUserMedia(await decryptToken(account.accessToken, env.ENCRYPTION_KEY), 25);
      const assignments = assignNextMedia(pending, media);
      await Promise.all(assignments.map(({ automation, media: publication }) =>
        db.automation.update({ where: { id: automation.id }, data: { postId: publication.id, postUrl: publication.permalink ?? null, pendingNextReel: false } })
      ));
      return assignments.length;
    }, 0);
  }
  return { attached };
}

async function snapshotFollowers(db: Db, env: JobsEnv) {
  let snapshots = 0;
  const date = new Date(new Date().toISOString().slice(0, 10));
  for (const account of await accounts(db)) {
    snapshots += await runAccountWorkflowStep(db, "snapshot-followers", account.id, async () => {
      const profile = await getUserInfo(await decryptToken(account.accessToken, env.ENCRYPTION_KEY));
      if (typeof profile.followers_count !== "number") return 0;
      await db.followerSnapshot.upsert({ where: { instagramAccountId_date: { instagramAccountId: account.id, date } }, create: { instagramAccountId: account.id, date, followersCount: profile.followers_count }, update: { followersCount: profile.followers_count } });
      return 1;
    }, 0);
  }
  return { snapshots };
}

async function retention(db: Db, env: JobsEnv) {
  const retentionAccounts = await db.instagramAccount.findMany({ orderBy: { connectedAt: "asc" }, select: { id: true }, take: 5 });
  let capacityAvailable = retentionAccounts.length === 0;
  for (const account of retentionAccounts) if (await reserveWorkflowStep(db, account.id)) capacityAvailable = true;
  if (!capacityAvailable) return { dmLogs: 0, processedEvents: 0, operationalEvents: 0 };
  const cutoff = new Date(Date.now() - 90 * 86_400_000);
  if (db.quizWork) await retainQuizWork(db, env.EVENT_JOURNAL, cutoff);
  const expiredEvents = await db.processedEvent.findMany({ where: { firstSeenAt: { lt: cutoff }, terminalStatus: { in: ["COMPLETED", "SKIPPED", "FAILED"] } }, select: { id: true, r2Key: true }, orderBy: { firstSeenAt: "asc" }, take: 500 });
  if (env.EVENT_JOURNAL.delete) for (const event of expiredEvents) if (event.r2Key) await env.EVENT_JOURNAL.delete(event.r2Key);
  const [dmLogs, processedEvents, operationalEvents] = await db.$transaction([
    db.dmLog.deleteMany({ where: { createdAt: { lt: cutoff }, status: { in: ["SENT", "SKIPPED", "FAILED"] } }, limit: 500 }),
    db.processedEvent.deleteMany({ where: { id: { in: expiredEvents.map(event => event.id) }, terminalStatus: { in: ["COMPLETED", "SKIPPED", "FAILED"] } }, limit: 500 }),
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
  return retention(db, env);
}

export function workflowExternalId(task: WorkflowTask, now = new Date()): string {
  const hourly = task === "reconcile" || task === "recover-journal" || task === "attach-next-reel";
  return `workflow:${task}:${now.toISOString().slice(0, hourly ? 13 : 10)}`;
}

export async function withJobRun(task: WorkflowTask, env: JobsEnv, execute: () => Promise<unknown>) {
  if (!env.DATABASE_URL) return { skipped: true, reason: "database_not_configured" };
  const db = createPrisma(env.DATABASE_URL);
  const externalId = workflowExternalId(task);
  const existing = await db.jobRun.findUnique({ where: { externalId } });
  // Cloudflare resumes the same durable step after eviction; PROCESSING is not terminal.
  if (existing?.status === "COMPLETED") return { skipped: true, reason: "already_started" };
  const run = existing
    ? await db.jobRun.update({ where: { id: existing.id }, data: { status: "PROCESSING", errorMessage: null, finishedAt: null, attempt: { increment: 1 } } })
    : await db.jobRun.create({ data: { externalId, kind: workflowJobKind(task), status: "PROCESSING" } });
  try {
    const result = await execute();
    await db.jobRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date() } });
    return result;
  } catch (error) {
    await db.jobRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: deliveryError(error).code, finishedAt: new Date() } });
    throw error;
  }
}
