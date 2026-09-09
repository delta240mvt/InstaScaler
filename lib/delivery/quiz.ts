import type { JobsEnv } from "@/lib/cloudflare/env";
import type { EventEnvelope } from "@/lib/events/journal";
import type { JobResult } from "./index";
import { graphSchema, type QuizGraph } from "@/lib/quiz/contracts";
import { acceptQuizControl, acceptQuizInput, advanceQuizRun, createQuizEntry, participantKey, reconcileQuizButton } from "@/lib/quiz/execution";
import { activeStatuses, snapshotOf, type QuizDb } from "@/lib/quiz/repository";
import { decodeQuizPayload } from "./quiz-payload";
import { canSendQuizMessage, sourceTimestamp } from "./quiz-policy";
import { dispatchQuizWorkNow } from "./quiz-work";
import { matchKeywords } from "@/lib/utils/keyword-matcher";

function matchesQuizEntry(graph: QuizGraph, e: EventEnvelope) {
  const start = graph.nodes.find(n => n.type === "start");
  if (!start || typeof e.payload.text !== "string") return false;
  const channelMatches = e.kind === "COMMENT"
    ? start.trigger === "comment" && (start.allPosts || start.postIds.includes(String(e.payload.mediaId)))
    : e.kind === "MESSAGE" && start.trigger === "dm" && !e.payload.quickReplyPayload && e.payload.text.trim().toUpperCase() !== "STOP";
  return channelMatches && matchKeywords(e.payload.text, [start.keyword], true).matched;
}

export async function isQuizRecoveryEvent(db: QuizDb, e: EventEnvelope) {
  if ([e.payload?.payload, e.payload?.quickReplyPayload].some(v => typeof v === "string" && v.startsWith("quiz1:"))) return true;
  const account = await db.instagramAccount.findUnique({ where: { instagramId: e.instagramAccountId }, select: { id: true } });
  if (!account) return false;
  if (e.kind === "COMMENT" || e.kind === "MESSAGE") {
    const paths = await db.quizPath.findMany({ where: { instagramAccountId: account.id, acceptsEntries: true }, include: { publishedVersion: true }, take: 500 });
    if (paths.some(p => p.publishedVersion && matchesQuizEntry(graphSchema.parse(p.publishedVersion.graph), e))) return true;
    if (e.kind === "COMMENT") return false;
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
  const key = e.kind !== "COMMENT" ? await participantKey(account.id, userId) : null;
  const contact = key ? await db.quizContact.findUnique({ where: { instagramAccountId_participantKey: { instagramAccountId: account.id, participantKey: key } } }) : null;
  const active = contact && !contact.deletedAt ? await db.quizRun.findFirst({ where: { contactId: contact.id, status: { in: [...activeStatuses] } } }) : null;
  if (e.kind === "COMMENT" || (e.kind === "MESSAGE" && !active && !raw && text("text").trim().toUpperCase() !== "STOP")) {
    const paths = await db.quizPath.findMany({ where: { instagramAccountId: account.id, acceptsEntries: true, halted: false }, include: { publishedVersion: true }, orderBy: { createdAt: "asc" }, take: 500 });
    const path = paths.find(p => p.publishedVersion && matchesQuizEntry(graphSchema.parse(p.publishedVersion.graph), e));
    if (!path?.publishedVersionId) return null;
    const comment = e.kind === "COMMENT";
    if (!occurredAt || !canSendQuizMessage({ now: new Date(), lastInteractionAt: comment ? null : occurredAt, commentCreatedAt: comment ? occurredAt : null, opening: comment, blocked: false })) return { status: "skipped", code: comment ? "QUIZ_COMMENT_TIME_UNKNOWN_OR_EXPIRED" : "QUIZ_INTERACTION_EXPIRED" };
    const source = comment ? { kind: "COMMENT" as const, commentId: text("commentId"), postId: text("mediaId") } : { kind: "MESSAGE" as const, messageId: text("messageId") };
    if (!(source.kind === "COMMENT" ? source.commentId : source.messageId)) return { status: "skipped", code: "QUIZ_INVALID_SOURCE" };
    const entry = await createQuizEntry(db, { accountId: account.id, instagramUserId: userId, username: text("fromUsername") || null, pathVersionId: path.publishedVersionId, ...source, externalId: e.externalId, occurredAt, receivedAt: new Date(e.receivedAt) });
    if ("workId" in entry) await dispatchQuizWorkNow(db, env, entry.workId);
    return { status: "skipped", code: "QUIZ_ENTRY_HANDLED" };
  }
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
  if (next.workId) await dispatchQuizWorkNow(db, env, next.workId);
  return { status: "skipped", code: "QUIZ_INPUT_HANDLED" };
}
