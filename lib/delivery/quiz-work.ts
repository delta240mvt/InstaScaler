import type { CoreEnv, JobsEnv } from "@/lib/cloudflare/env";
import type { QuizStepJob } from "@/lib/jobs/contracts";
import type { JournalBucket } from "@/lib/events/journal";
import { reserveQueueJob } from "@/lib/jobs/budget";
import { decryptToken } from "@/lib/core/meta-oauth";
import { MetaApiError, RateLimitError, sendQuizMessage } from "@/lib/meta/client";
import { graphSchema } from "@/lib/quiz/contracts";
import { lockContact, runInclude, saveSnapshot, snapshotOf, type QuizDb, type WorkPayload } from "@/lib/quiz/repository";
import { qualify } from "@/lib/quiz/qualification";
import { advanceQuizRun } from "@/lib/quiz/execution";
import { canSendQuizMessage } from "./quiz-policy";
import { encodeQuizPayload } from "./quiz-payload";
import type { JobResult } from "./index";

export async function journalQuizWork(bucket: JournalBucket, job: Omit<QuizStepJob, "r2Key">): Promise<QuizStepJob> {
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(job.externalId))), b => b.toString(16).padStart(2, "0")).join("");
  const saved = { ...job, r2Key: `quiz-steps/${digest}.json` };
  await bucket.put(saved.r2Key, JSON.stringify(saved), { httpMetadata: { contentType: "application/json" } });
  return saved;
}
export async function dispatchQuizWork(db: QuizDb, env: Pick<JobsEnv | CoreEnv, "EVENT_JOURNAL" | "INSTAGRAM_EVENTS">, workId: string) {
  const work = await db.quizWork.findUnique({ where: { id: workId }, include: { run: { include: { path: { include: { instagramAccount: { select: { instagramId: true } } } }, contact: true } } } });
  if (!work || work.status !== "PENDING" || work.run.contact.deletedAt || work.run.path.halted || ["PAUSED", "HUMAN", "STOPPED", "RESTARTED", "FAILED", "COMPLETED", "UNKNOWN"].includes(work.run.status)) return false;
  const job = await journalQuizWork(env.EVENT_JOURNAL, { version: 1, kind: "QUIZ_STEP", externalId: `quiz-work:${work.id}`, workId, instagramAccountId: work.run.path.instagramAccount.instagramId });
  await db.quizWork.update({ where: { id: workId }, data: { r2Key: job.r2Key } });
  if (!(await reserveQueueJob(db, work.run.path.instagramAccountId, 1)).allowed) return false;
  await env.INSTAGRAM_EVENTS.send(job);
  return true;
}
export async function deliverQuizWork(db: QuizDb, env: JobsEnv, job: QuizStepJob): Promise<JobResult> {
  const first = await db.quizWork.findUnique({ where: { id: job.workId }, include: { run: { include: { path: { include: { instagramAccount: true } } } } } });
  if (!first) return { status: "skipped", code: "QUIZ_WORK_REMOVED" };
  if (job.externalId !== `quiz-work:${first.id}` || first.r2Key !== job.r2Key || first.run.path.instagramAccount.instagramId !== job.instagramAccountId) return { status: "failed", code: "JOURNAL_JOB_MISMATCH" };
  if (["SENT", "CANCELLED"].includes(first.status)) return { status: "skipped", code: "QUIZ_WORK_TERMINAL" };
  if (first.status !== "PENDING") return { status: "failed", code: "QUIZ_SEND_UNCERTAIN" };
  const account = first.run.path.instagramAccount;
  if (!account.webhookSubscribed || account.requiresReconnect) return { status: "retry", code: "ACCOUNT_DISABLED" };
  const limiter = env.ACCOUNT_RATE_LIMITER.get(env.ACCOUNT_RATE_LIMITER.idFromName(account.instagramId));
  if (!(await limiter.reserve({ amount: 1, now: Date.now() })).allowed) return { status: "retry", code: "ACCOUNT_RATE_LIMIT" };
  const token = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
  const claimed = await db.$transaction(async tx => {
    await lockContact(tx, first.run.contactId);
    const work = await tx.quizWork.findUnique({ where: { id: first.id }, include: { run: { include: runInclude } } });
    if (!work || work.status !== "PENDING") return null;
    const run = work.run;
    if (run.contact.deletedAt || run.path.halted || ["PAUSED", "HUMAN", "UNKNOWN"].includes(run.status)) return null;
    if (["STOPPED", "RESTARTED", "FAILED", "COMPLETED"].includes(run.status) || work.revision !== run.revision) {
      await tx.quizWork.update({ where: { id: work.id }, data: { status: "CANCELLED" } }); return null;
    }
    const payload = work.payload as WorkPayload;
    if (!canSendQuizMessage({ now: new Date(), lastInteractionAt: run.lastInteractionAt, commentCreatedAt: payload.commentCreatedAt ? new Date(payload.commentCreatedAt) : run.commentCreatedAt, opening: !!payload.opening, blocked: false })) {
      if (payload.opening) {
        await tx.quizWork.update({ where: { id: work.id }, data: { status: "CANCELLED" } });
        if (run.status === "WAITING_START") await tx.quizRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date() } });
      } else await tx.quizRun.update({ where: { id: run.id }, data: { status: "WAITING_WINDOW" } });
      return null;
    }
    await tx.quizWork.update({ where: { id: work.id }, data: { status: "SENDING" } });
    return work;
  });
  if (!claimed) return { status: "retry", code: "QUIZ_WAITING" };
  const run = claimed.run;
  const payload = claimed.payload as WorkPayload;
  const snapshot = snapshotOf(claimed.afterSnapshot ?? run.snapshot);
  const revision = claimed.revision + (claimed.afterSnapshot ? 1 : 0);
  const context = { runId: run.id, versionId: run.versionId, revision, nodeId: snapshot.nodeId, choiceId: "" };
  const buttons: Parameters<typeof sendQuizMessage>[4] = payload.controls
    ? payload.controls.map(c => ({ type: "postback", title: c.label, payload: encodeQuizPayload({ ...context, versionId: c.versionId ?? run.versionId, action: c.action }) }))
    : payload.message.buttons.map(b => ({ type: "postback", title: b.label, payload: encodeQuizPayload({ ...context, action: b.kind, choiceId: b.kind === "answer" ? b.id : "" }) }));
  if (payload.message.material) buttons.push({ type: "web_url", title: payload.message.material.name, url: payload.message.material.url });
  let messageId: string;
  try {
    const sent = await sendQuizMessage(token, account.instagramId, payload.opening ? { comment_id: payload.commentId ?? run.sourceCommentId } : { id: run.contact.instagramUserId! }, payload.message.text, buttons);
    if (!sent.message_id) throw new Error("QUIZ_SEND_UNCERTAIN");
    messageId = sent.message_id;
  } catch (error) {
    const retry = error instanceof RateLimitError;
    const permanent = error instanceof MetaApiError && [10, 100, 190, 200].includes(error.code);
    await db.$transaction(async tx => {
      await lockContact(tx, run.contactId);
      const changed = await tx.quizWork.updateMany({ where: { id: claimed.id, status: "SENDING" }, data: { status: retry ? "PENDING" : permanent ? "FAILED" : "UNKNOWN" } });
      if (changed.count && !retry) await tx.quizRun.updateMany({ where: { id: run.id, revision: run.revision, status: { in: ["ACTIVE", "WAITING_START", "WAITING_REPLY", "WAITING_WINDOW"] } }, data: { status: permanent ? "FAILED" : "UNKNOWN", ...(permanent ? { finishedAt: new Date() } : {}) } });
    });
    return { status: retry ? "retry" : "failed", code: retry ? "META_RATE_LIMIT" : permanent ? "META_PERMANENT" : "QUIZ_SEND_UNCERTAIN" };
  }
  await db.$transaction(async tx => {
    await lockContact(tx, run.contactId);
    const current = await tx.quizRun.findUnique({ where: { id: run.id }, include: runInclude });
    if (!current || current.contact.deletedAt) return;
    const changed = await tx.quizWork.updateMany({ where: { id: claimed.id, status: "SENDING" }, data: { status: "SENT", messageId } });
    if (!changed.count) return;
    await tx.quizEvent.create({ data: { runId: run.id, externalId: `quiz-sent:${claimed.id}`, nodeId: snapshotOf(run.snapshot).nodeId, kind: payload.message.material ? "MATERIAL_SENT" : "MESSAGE_SENT", data: { messageId } } });
    if (claimed.afterSnapshot && current.revision === run.revision && !["STOPPED", "RESTARTED", "FAILED", "COMPLETED"].includes(current.status)) {
      await saveSnapshot(tx, current, snapshot, qualify(graphSchema.parse(current.version.graph).qualification, snapshot), new Date());
      if (["PAUSED", "HUMAN"].includes(current.status)) await tx.quizRun.update({ where: { id: run.id }, data: { status: current.status } });
      else if (payload.opening) await tx.quizRun.update({ where: { id: run.id }, data: { status: "WAITING_START" } });
    }
  });
  const next = await advanceQuizRun(db, run.id);
  if (next.workId) await dispatchQuizWork(db, env, next.workId);
  return { status: "sent", code: "QUIZ_MESSAGE_SENT" };
}
