import type { CoreEnv, JobsEnv } from "@/lib/cloudflare/env";
import { dispatchQuizWork } from "@/lib/delivery/quiz-work";
import { reserveWorkflowStep } from "@/lib/jobs/budget";
import { canSendQuizMessage } from "@/lib/delivery/quiz-policy";
import { parseInstagramJob } from "@/lib/jobs/contracts";
import { advanceQuizRun, participantKey } from "./execution";
import { graphSchema } from "./contracts";
import { initialSnapshot } from "./engine";
import { QuizError } from "./errors";
import { activeStatuses, json, lockContact, runInclude, snapshotOf, statusFor, type QuizDb } from "./repository";

export async function controlQuizRun(db: QuizDb, runId: string, action: "pause" | "resume" | "stop" | "restart", now = new Date()) {
  return db.$transaction(async tx => {
    const first = await tx.quizRun.findUnique({ where: { id: runId }, select: { contactId: true } });
    if (!first) throw new QuizError("quiz_run_not_found", 404);
    await lockContact(tx, first.contactId);
    const run = await tx.quizRun.findUniqueOrThrow({ where: { id: runId }, include: runInclude });
    if (run.contact.deletedAt || !(activeStatuses as readonly string[]).includes(run.status)) throw new QuizError("quiz_run_blocked", 409);
    let id = run.id;
    if (action === "stop") {
      await tx.quizWork.updateMany({ where: { runId, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.quizRun.update({ where: { id }, data: { status: "STOPPED", finishedAt: now, revision: { increment: 1 }, snapshot: json({ ...snapshotOf(run.snapshot), phase: "stopped" }) } });
    } else if (action === "pause") await tx.quizRun.update({ where: { id }, data: { status: "PAUSED" } });
    else if (action === "restart") {
      if (!run.lastInteractionAt) throw new QuizError("quiz_run_blocked", 409);
      if (await tx.quizWork.findFirst({ where: { runId, status: { in: ["SENDING", "UNKNOWN"] } } })) throw new QuizError("quiz_send_uncertain", 409);
      const version = run.path.publishedVersionId ? await tx.quizVersion.findUnique({ where: { id: run.path.publishedVersionId } }) : null;
      if (!version || run.path.halted) throw new QuizError("quiz_run_blocked", 409);
      await tx.quizRun.update({ where: { id }, data: { status: "RESTARTED", finishedAt: now, revision: { increment: 1 } } });
      await tx.quizWork.updateMany({ where: { runId, status: "PENDING" }, data: { status: "CANCELLED" } });
      const graph = graphSchema.parse(version.graph);
      const snapshot = initialSnapshot(graph, snapshotOf(run.snapshot));
      const eligible = canSendQuizMessage({ now, lastInteractionAt: run.lastInteractionAt, opening: false, blocked: false, commentCreatedAt: null });
      const next = await tx.quizRun.create({ data: { contactId: run.contactId, pathId: run.pathId, versionId: version.id, status: eligible ? "ACTIVE" : "WAITING_WINDOW", snapshot: json(snapshot), sourceCommentId: run.sourceCommentId, sourcePostId: run.sourcePostId, commentCreatedAt: run.commentCreatedAt, lastInteractionAt: run.lastInteractionAt } });
      id = next.id;
    } else {
      if (run.path.halted || await tx.quizWork.findFirst({ where: { runId, status: { in: ["SENDING", "UNKNOWN"] } } })) throw new QuizError("quiz_send_uncertain", 409);
      const snapshot = snapshotOf(run.snapshot);
      const isOpening = graphSchema.parse(run.version.graph).nodes.find(n => n.id === snapshot.nodeId)?.type === "start";
      if (snapshot.phase === "human") throw new QuizError("quiz_run_blocked", 409);
      const eligible = canSendQuizMessage({ now, lastInteractionAt: run.lastInteractionAt, opening: false, blocked: false, commentCreatedAt: null });
      await tx.quizRun.update({ where: { id }, data: { status: isOpening ? "WAITING_START" : eligible ? statusFor(snapshot) : "WAITING_WINDOW" } });
    }
    await tx.quizEvent.create({ data: { runId: id, externalId: `quiz-admin:${crypto.randomUUID()}`, kind: `ADMIN_${action.toUpperCase()}` } });
    return tx.quizRun.findUniqueOrThrow({ where: { id }, include: runInclude });
  });
}
export async function pauseQuizForManualMessage(db: QuizDb, accountId: string, userId: string) {
  const key = await participantKey(accountId, userId);
  const contact = await db.quizContact.findUnique({ where: { instagramAccountId_participantKey: { instagramAccountId: accountId, participantKey: key } } });
  if (!contact || contact.deletedAt) return;
  const run = await db.quizRun.findFirst({ where: { contactId: contact.id, status: { in: [...activeStatuses] } } });
  if (run) await controlQuizRun(db, run.id, "pause");
}
export async function recoverQuizWork(db: QuizDb, env: Pick<JobsEnv | CoreEnv, "EVENT_JOURNAL" | "INSTAGRAM_EVENTS">) {
  const cutoff = new Date(Date.now() - 120_000);
  const stuck = await db.quizWork.findMany({ where: { status: "SENDING", updatedAt: { lt: cutoff } }, take: 100, orderBy: { updatedAt: "asc" } });
  for (const work of stuck) await db.$transaction(async tx => {
    const run = await tx.quizRun.findUnique({ where: { id: work.runId } });
    if (!run) return;
    await lockContact(tx, run.contactId);
    const changed = await tx.quizWork.updateMany({ where: { id: work.id, status: "SENDING", updatedAt: { lt: cutoff } }, data: { status: "UNKNOWN" } });
    if (changed.count) await tx.quizRun.updateMany({ where: { id: run.id, status: { in: ["ACTIVE", "WAITING_START", "WAITING_REPLY", "WAITING_WINDOW"] } }, data: { status: "UNKNOWN" } });
  });
  const ready = await db.quizRun.findMany({ where: { status: "ACTIVE", path: { halted: false }, contact: { deletedAt: null }, work: { none: { status: { in: ["PENDING", "SENDING", "UNKNOWN"] } } } }, take: 100, orderBy: { updatedAt: "asc" } });
  for (const run of ready) if (await reserveWorkflowStep(db, (await db.quizPath.findUniqueOrThrow({ where: { id: run.pathId }, select: { instagramAccountId: true } })).instagramAccountId)) await advanceQuizRun(db, run.id);
  const pending = await db.quizWork.findMany({ where: { status: "PENDING", run: { status: { in: ["ACTIVE", "WAITING_START", "WAITING_REPLY"] }, path: { halted: false }, contact: { deletedAt: null } } }, include: { run: { select: { path: { select: { instagramAccountId: true } } } } }, take: 100, orderBy: { updatedAt: "asc" } });
  let recovered = 0;
  for (const work of pending) {
    if (!await reserveWorkflowStep(db, work.run.path.instagramAccountId)) continue;
    await db.processedEvent.updateMany({ where: { externalId: `quiz-work:${work.id}`, terminalStatus: { in: ["PROCESSING", "FAILED", "SKIPPED", "COMPLETED"] } }, data: { terminalStatus: "RETRYING", completedAt: null } });
    if (await dispatchQuizWork(db, env, work.id)) recovered++;
  }
  if (env.EVENT_JOURNAL.list) {
    const key = "control/quiz-recovery-cursor.json";
    const saved = await env.EVENT_JOURNAL.get(key);
    const cursor: unknown = saved ? JSON.parse(await saved.text()) : null;
    const page = await env.EVENT_JOURNAL.list({ prefix: "quiz-steps/", cursor: typeof cursor === "string" ? cursor : undefined, limit: 200 });
    for (const object of page.objects) {
      const raw = await env.EVENT_JOURNAL.get(object.key);
      if (!raw) continue;
      const job = parseInstagramJob(JSON.parse(await raw.text()));
      if (job.kind !== "QUIZ_STEP") continue;
      const work = await db.quizWork.findUnique({ where: { id: job.workId }, select: { status: true } });
      if (!work || work.status === "SENT" || work.status === "CANCELLED") {
        await db.processedEvent.updateMany({ where: { externalId: job.externalId }, data: { terminalStatus: work?.status === "SENT" ? "COMPLETED" : "SKIPPED", completedAt: new Date() } });
        if (env.EVENT_JOURNAL.delete) await env.EVENT_JOURNAL.delete(object.key);
      }
    }
    await env.EVENT_JOURNAL.put(key, JSON.stringify(page.truncated ? page.cursor ?? null : null));
  }
  return { recovered };
}
