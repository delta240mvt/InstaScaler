import type { JobsEnv } from "@/lib/cloudflare/env";
import type { EventEnvelope } from "@/lib/events/journal";
import type { JobResult } from "./index";
import { graphSchema } from "@/lib/quiz/contracts";
import { acceptQuizControl, acceptQuizInput, advanceQuizRun, createQuizEntry, participantKey, reconcileQuizButton } from "@/lib/quiz/execution";
import { activeStatuses, snapshotOf, type QuizDb } from "@/lib/quiz/repository";
import { decodeQuizPayload } from "./quiz-payload";
import { canSendQuizMessage, sourceTimestamp } from "./quiz-policy";
import { dispatchQuizWork } from "./quiz-work";
import { matchKeywords } from "@/lib/utils/keyword-matcher";

export async function isQuizRecoveryEvent(db: QuizDb, e: EventEnvelope) {
  if ([e.payload?.payload, e.payload?.quickReplyPayload].some(v => typeof v === "string" && v.startsWith("quiz1:"))) return true;
  const account = await db.instagramAccount.findUnique({ where: { instagramId: e.instagramAccountId }, select: { id: true } });
  if (!account) return false;
  if (e.kind === "COMMENT") {
    const paths = await db.quizPath.findMany({ where: { instagramAccountId: account.id, acceptsEntries: true }, include: { publishedVersion: true }, take: 500 });
    return paths.some(p => { const start = p.publishedVersion && graphSchema.parse(p.publishedVersion.graph).nodes.find(n => n.type === "start"); return start?.type === "start" && (start.allPosts || start.postIds.includes(String(e.payload.mediaId))) && matchKeywords(String(e.payload.text), [start.keyword], true).matched; });
  }
  const userId = e.kind === "MESSAGE" ? e.payload.senderId : e.payload.userId;
  if (typeof userId !== "string") return false;
  const key = await participantKey(account.id, userId);
  return !!await db.quizContact.findFirst({ where: { instagramAccountId: account.id, participantKey: key, deletedAt: null, runs: { some: { status: { in: [...activeStatuses] } } } }, select: { id: true } });
}

export async function routeQuizEvent(db: QuizDb, env: JobsEnv, e: EventEnvelope): Promise<JobResult | null> {
  const text = (key: string) => typeof e.payload[key] === "string" ? e.payload[key] as string : "";
  const raw = text("payload") || text("quickReplyPayload");
  const recognized = raw.startsWith("quiz1:");
  const account = await db.instagramAccount.findUnique({ where: { instagramId: e.instagramAccountId }, select: { id: true, webhookSubscribed: true } });
  if (!account?.webhookSubscribed) return recognized ? { status: "skipped", code: "ACCOUNT_DISABLED" } : null;
  const userId = text(e.kind === "COMMENT" ? "fromId" : e.kind === "MESSAGE" ? "senderId" : "userId");
  if (!userId) return recognized ? { status: "skipped", code: "QUIZ_INVALID_USER" } : null;
  const timestamp = sourceTimestamp(text("occurredAt"), new Date(e.receivedAt), "ms");
  const occurredAt = timestamp ? new Date(timestamp) : null;
  if (e.kind === "COMMENT") {
    const paths = await db.quizPath.findMany({ where: { instagramAccountId: account.id, acceptsEntries: true, halted: false }, include: { publishedVersion: true }, orderBy: { createdAt: "asc" }, take: 500 });
    const path = paths.find(p => {
      if (!p.publishedVersion) return false;
      const start = graphSchema.parse(p.publishedVersion.graph).nodes.find(n => n.type === "start");
      return start?.type === "start" && (start.allPosts || start.postIds.includes(text("mediaId"))) && matchKeywords(text("text"), [start.keyword], true).matched;
    });
    if (!path?.publishedVersionId) return null;
    if (!occurredAt || !canSendQuizMessage({ now: new Date(), lastInteractionAt: null, commentCreatedAt: occurredAt, opening: true, blocked: false })) return { status: "skipped", code: "QUIZ_COMMENT_TIME_UNKNOWN_OR_EXPIRED" };
    const entry = await createQuizEntry(db, { accountId: account.id, instagramUserId: userId, username: text("fromUsername") || null, pathVersionId: path.publishedVersionId, commentId: text("commentId"), postId: text("mediaId"), externalId: e.externalId, occurredAt, receivedAt: new Date(e.receivedAt) });
    if ("workId" in entry) await dispatchQuizWork(db, env, entry.workId);
    return { status: "skipped", code: "QUIZ_ENTRY_HANDLED" };
  }
  const key = await participantKey(account.id, userId);
  const contact = await db.quizContact.findUnique({ where: { instagramAccountId_participantKey: { instagramAccountId: account.id, participantKey: key } } });
  const active = contact && !contact.deletedAt ? await db.quizRun.findFirst({ where: { contactId: contact.id, status: { in: [...activeStatuses] } } }) : null;
  if (!active && !recognized) return null;
  if (!active) return { status: "skipped", code: "QUIZ_NO_ACTIVE_RUN" };
  const button = recognized ? decodeQuizPayload(raw) : null;
  const stop = e.kind === "MESSAGE" && text("text").trim().toUpperCase() === "STOP";
  if (!stop && (!occurredAt || !canSendQuizMessage({ now: new Date(), lastInteractionAt: occurredAt, commentCreatedAt: null, opening: false, blocked: false }))) return { status: "skipped", code: "QUIZ_INTERACTION_EXPIRED" };
  let runId = active.id;
  if (!stop && recognized && (!button || button.runId !== active.id)) return { status: "skipped", code: "QUIZ_STALE_BUTTON" };
  if (!stop && button && (active.status === "UNKNOWN" || button.revision !== active.revision)) await reconcileQuizButton(db, button, account.id, userId);
  if (!stop && button && ["start", "continue", "restart", "switch"].includes(button.action)) {
    const selected = await acceptQuizControl(db, button, e.externalId, account.id, userId, occurredAt!);
    if (!selected) return { status: "skipped", code: "QUIZ_STALE_BUTTON" };
    runId = selected;
  } else {
    if (!stop && button && button.versionId !== active.versionId) return { status: "skipped", code: "QUIZ_STALE_BUTTON" };
    if (!stop && e.kind === "POSTBACK" && !button) return { status: "skipped", code: "QUIZ_OWNS_CONVERSATION" };
    await acceptQuizInput(db, { runId, expectedRevision: button?.revision ?? active.revision, externalId: e.externalId, instagramUserId: userId, instagramAccountId: account.id, nodeId: button?.nodeId ?? snapshotOf(active.snapshot).nodeId, occurredAt: occurredAt ?? new Date(0), input: stop ? { kind: "stop" } : button?.action === "skip" ? { kind: "skip" } : { kind: "answer", value: text("text"), ...(button ? { choiceId: button.choiceId } : {}) } });
  }
  const next = await advanceQuizRun(db, runId);
  if (next.workId) await dispatchQuizWork(db, env, next.workId);
  return { status: "skipped", code: "QUIZ_INPUT_HANDLED" };
}
