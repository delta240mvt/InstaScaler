import type { JobsEnv } from "@/lib/cloudflare/env";
import { decryptToken } from "@/lib/core/meta-oauth";
import type { EventEnvelope } from "@/lib/events/journal";
import type { InstagramJob } from "@/lib/jobs/contracts";
import { matchKeywords } from "@/lib/utils/keyword-matcher";
import {
  getUserFollowStatus,
  sendCommentReply,
  sendDirectMessage,
  sendDirectMessageWithButton,
  sendPrivateReply,
  sendPrivateReplyWithButton,
} from "@/lib/meta/client";
import { deliveryError } from "@/lib/delivery/errors";
import { PermissionError, TokenExpiredError } from "@/lib/meta/client";
import type { JobResult } from "@/lib/delivery";
import { reserveQueueJob, validateDelaySeconds, type BudgetDb } from "@/lib/jobs/budget";

type Automation = {
  id: string; instagramAccountId: string; name: string; postId: string | null; matchAnyPost: boolean;
  keywords: string[]; matchAnyWord: boolean; wholeWordMatch: boolean; dmTriggerEnabled: boolean;
  dmMessage: string; openingDmEnabled: boolean; openingDmMessage: string | null; openingDmButtonLabel: string | null;
  requireFollowBeforeFreebie: boolean; followPromptMessage: string | null; followPromptButtonLabel: string | null;
  followUpEnabled: boolean; followUpMessage: string | null; followUpDelayMinutes: number;
  publicReplyEnabled: boolean; publicReplyMessage: string | null; publicReplyMessages: string[];
  trackedLinks?: Array<{ slug: string }>;
};
type Account = { id: string; instagramId: string; accessToken: string; webhookSubscribed: boolean; automations?: Automation[] };
type DeliveryDb = BudgetDb & {
  instagramAccount: { findUnique(args: unknown): Promise<Account | null>; update(args: unknown): Promise<unknown> };
  operationalEvent: { create(args: unknown): Promise<unknown> };
  automation: { findFirst(args: unknown): Promise<(Automation & { instagramAccount: Account }) | null> };
  dmLog: { findUnique(args: unknown): Promise<{ status?: string } | null>; create(args: unknown): Promise<unknown>; update(args: unknown): Promise<unknown>; upsert(args: unknown): Promise<unknown> };
};

type DeliveryReservationDb = { dmLog: Pick<DeliveryDb["dmLog"], "findUnique" | "create" | "update"> };

type FailureDb = { instagramAccount: Pick<DeliveryDb["instagramAccount"], "update">; operationalEvent: DeliveryDb["operationalEvent"] };

export async function handleDeliveryFailure(db: FailureDb, instagramId: string, error: unknown): Promise<JobResult> {
  if (error instanceof TokenExpiredError || error instanceof PermissionError) {
    const lastErrorCode = error instanceof TokenExpiredError ? "META_TOKEN_EXPIRED" : "META_PERMISSION";
    await db.instagramAccount.update({ where: { instagramId }, data: { webhookSubscribed: false, requiresReconnect: true, lastErrorCode } });
    await db.operationalEvent.create({ data: { source: "JOBS", level: "ERROR", message: "Instagram account requires reconnection", payload: { instagramId, code: lastErrorCode } } });
  }
  return deliveryError(error);
}

export async function reserveDelivery(db: DeliveryReservationDb, data: { externalId: string; automationId: string; instagramAccountId: string; commenterId: string }): Promise<boolean> {
  const existing = await db.dmLog.findUnique({ where: { externalId: data.externalId } });
  if (existing?.status === "RETRYING") {
    await db.dmLog.update({ where: { externalId: data.externalId }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
    return true;
  }
  if (existing) return false;
  try {
    await db.dmLog.create({ data: { ...data, status: "PROCESSING", attempts: 1 } });
    return true;
  } catch (error) {
    if (await db.dmLog.findUnique({ where: { externalId: data.externalId } })) return false;
    throw error;
  }
}

function text(payload: EventEnvelope, key: string): string { const value = payload.payload[key]; return typeof value === "string" ? value : ""; }
function render(message: string, name: string, link?: string) {
  return message.replaceAll("{username}", name || "there").replaceAll("{link}", link ?? "");
}
function trackedUrl(env: JobsEnv, automation: Automation): string | undefined {
  const slug = automation.trackedLinks?.[0]?.slug;
  return slug ? `${env.APP_BASE_URL.replace(/\/$/, "")}/r/${slug}` : undefined;
}
async function reserve(env: JobsEnv, instagramId: string, amount = 1): Promise<boolean> {
  const binding = env.ACCOUNT_RATE_LIMITER;
  const stub = binding.get(binding.idFromName(instagramId));
  return (await stub.reserve({ amount, now: Date.now() })).allowed;
}
async function accountFor(db: DeliveryDb, instagramId: string): Promise<Account | null> {
  return db.instagramAccount.findUnique({ where: { instagramId }, include: { automations: { where: { isActive: true }, include: { trackedLinks: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } } } });
}
async function record(db: DeliveryDb, automation: Automation, account: Account, externalId: string, userId: string, status: string, code?: string) {
  await db.dmLog.upsert({ where: { externalId }, create: { externalId, automationId: automation.id, instagramAccountId: account.id, commenterId: userId, status, errorMessage: code }, update: { status, errorMessage: code, attempts: { increment: 1 }, ...(status === "SENT" ? { dmSentAt: new Date() } : {}) } });
}

async function deliverComment(db: DeliveryDb, env: JobsEnv, envelope: EventEnvelope): Promise<JobResult> {
  const account = await accountFor(db, envelope.instagramAccountId);
  if (!account?.webhookSubscribed) return { status: "skipped", code: "ACCOUNT_DISABLED" };
  const commentId = text(envelope, "commentId");
  const userId = text(envelope, "fromId");
  const mediaId = text(envelope, "mediaId");
  const commentText = text(envelope, "text");
  const automation = account.automations?.find((item) => {
    if (!item.matchAnyPost && item.postId !== mediaId) return false;
    return item.matchAnyWord || matchKeywords(commentText, item.keywords, item.wholeWordMatch).matched;
  });
  if (!automation) return { status: "skipped", code: "NO_CAMPAIGN_MATCH" };
  if (!await reserve(env, account.instagramId, automation.publicReplyEnabled ? 2 : 1)) return { status: "retry", code: "ACCOUNT_RATE_LIMIT" };
  const token = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
  const prompt = automation.requireFollowBeforeFreebie;
  const opening = prompt || automation.openingDmEnabled;
  const link = trackedUrl(env, automation);
  const externalId = `comment:${automation.id}:${commentId}`;
  if (!await reserveDelivery(db, { externalId, automationId: automation.id, instagramAccountId: account.id, commenterId: userId })) return { status: "skipped", code: "DUPLICATE_DELIVERY" };
  try {
    if (opening) {
      await sendPrivateReplyWithButton(token, account.instagramId, commentId,
        render(prompt ? automation.followPromptMessage || "Follow this account, then confirm below." : automation.openingDmMessage || "Tap below to continue.", text(envelope, "fromUsername")),
        prompt ? automation.followPromptButtonLabel || "I'm following" : automation.openingDmButtonLabel || "Continue",
        `${prompt ? "followcheck" : "reveal"}:${automation.id}`);
    } else await sendPrivateReply(token, account.instagramId, commentId, render(automation.dmMessage, text(envelope, "fromUsername"), link));
    await record(db, automation, account, externalId, userId, "SENT");
  } catch (error) {
    await db.dmLog.update({ where: { externalId }, data: { status: "RETRYING", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed" } });
    throw error;
  }
  if (automation.publicReplyEnabled) {
    const variants = automation.publicReplyMessages.filter(Boolean);
    const reply = variants.length ? variants[Math.abs(commentId.length) % variants.length] : automation.publicReplyMessage;
    if (reply) {
      try {
        await sendCommentReply(token, commentId, reply);
        await db.dmLog.update({ where: { externalId }, data: { publicReplySentAt: new Date(), publicReplyError: null } });
      } catch (error) {
        await db.dmLog.update({ where: { externalId }, data: { publicReplyError: error instanceof Error ? error.message.slice(0, 1000) : "Public reply failed" } });
      }
    }
  }
  return { status: "sent", code: opening ? "OPENING_SENT" : "FREEBIE_SENT" };
}

async function deliverPostback(db: DeliveryDb, env: JobsEnv, envelope: EventEnvelope): Promise<JobResult> {
  const payload = text(envelope, "payload");
  const [kind, automationId] = payload.split(":", 2);
  if (!automationId || !["reveal", "followcheck"].includes(kind)) return { status: "skipped", code: "UNKNOWN_POSTBACK" };
  const automation = await db.automation.findFirst({ where: { id: automationId, isActive: true }, include: { instagramAccount: true, trackedLinks: { orderBy: { createdAt: "asc" } } } });
  if (!automation || automation.instagramAccount.instagramId !== envelope.instagramAccountId) return { status: "skipped", code: "CAMPAIGN_DISABLED" };
  const account = automation.instagramAccount;
  const userId = text(envelope, "userId");
  const externalId = `freebie:${automation.id}:${userId}`;
  const token = await decryptToken(account.accessToken, env.ENCRYPTION_KEY);
  if (automation.requireFollowBeforeFreebie) {
    const follows = await getUserFollowStatus(token, userId);
    if (follows === null) return { status: "retry", code: "FOLLOW_CHECK_UNAVAILABLE" };
    if (!follows) {
      if (!await reserve(env, account.instagramId)) return { status: "retry", code: "ACCOUNT_RATE_LIMIT" };
      await sendDirectMessageWithButton(token, account.instagramId, userId, automation.followPromptMessage || "Follow this account, then confirm below.", automation.followPromptButtonLabel || "I'm following", `followcheck:${automation.id}`);
      return { status: "skipped", code: "FOLLOW_REQUIRED" };
    }
  }
  if (!await reserve(env, account.instagramId)) return { status: "retry", code: "ACCOUNT_RATE_LIMIT" };
  if (!await reserveDelivery(db, { externalId, automationId: automation.id, instagramAccountId: account.id, commenterId: userId })) return { status: "skipped", code: "DUPLICATE_DELIVERY" };
  try {
    await sendDirectMessage(token, account.instagramId, userId, render(automation.dmMessage, text(envelope, "username"), trackedUrl(env, automation)));
    await record(db, automation, account, externalId, userId, "SENT");
  } catch (error) {
    await db.dmLog.update({ where: { externalId }, data: { status: "RETRYING", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed" } });
    throw error;
  }
  if (automation.followUpEnabled && automation.followUpMessage?.trim()) {
    const delaySeconds = validateDelaySeconds(automation.followUpDelayMinutes * 60);
    if ((await reserveQueueJob(db, account.id, 1)).allowed) {
      await env.INSTAGRAM_EVENTS.send({ version: 1, kind: "FOLLOW_UP", externalId: `followup:${automation.id}:${userId}`, instagramAccountId: account.instagramId, automationId: automation.id, userId, dueAt: new Date(Date.now() + delaySeconds * 1000).toISOString() }, { delaySeconds });
    }
  }
  return { status: "sent", code: "FREEBIE_SENT" };
}

async function deliverMessage(db: DeliveryDb, env: JobsEnv, envelope: EventEnvelope): Promise<JobResult> {
  const account = await accountFor(db, envelope.instagramAccountId);
  if (!account?.webhookSubscribed) return { status: "skipped", code: "ACCOUNT_DISABLED" };
  const body = text(envelope, "text");
  const automation = account.automations?.find((item) => item.dmTriggerEnabled && (item.matchAnyWord || matchKeywords(body, item.keywords, item.wholeWordMatch).matched));
  if (!automation) return { status: "skipped", code: "NO_CAMPAIGN_MATCH" };
  return deliverPostback(db, env, { ...envelope, kind: "POSTBACK", payload: { payload: `${automation.requireFollowBeforeFreebie ? "followcheck" : "reveal"}:${automation.id}`, userId: text(envelope, "senderId") } });
}

async function deliverFollowUp(db: DeliveryDb, env: JobsEnv, job: Extract<InstagramJob, { kind: "FOLLOW_UP" }>): Promise<JobResult> {
  const automation = await db.automation.findFirst({ where: { id: job.automationId, isActive: true, followUpEnabled: true }, include: { instagramAccount: true } });
  if (!automation?.followUpMessage) return { status: "skipped", code: "FOLLOW_UP_DISABLED" };
  if (!await reserve(env, automation.instagramAccount.instagramId)) return { status: "retry", code: "ACCOUNT_RATE_LIMIT" };
  await sendDirectMessage(await decryptToken(automation.instagramAccount.accessToken, env.ENCRYPTION_KEY), automation.instagramAccount.instagramId, job.userId, render(automation.followUpMessage, job.commenterName ?? ""));
  return { status: "sent", code: "FOLLOW_UP_SENT" };
}

export async function deliverInstagramJob(context: { db: unknown; env: JobsEnv }, job: InstagramJob, payload: unknown): Promise<JobResult> {
  const db = context.db as DeliveryDb;
  try {
    if (job.kind === "FOLLOW_UP") return await deliverFollowUp(db, context.env, job);
    const envelope = payload as EventEnvelope;
    if (job.kind === "COMMENT") return await deliverComment(db, context.env, envelope);
    if (job.kind === "POSTBACK") return await deliverPostback(db, context.env, envelope);
    if (job.kind === "MESSAGE") return await deliverMessage(db, context.env, envelope);
    return { status: "skipped", code: "RECOVERY_CONTROL" };
  } catch (error) { return handleDeliveryFailure(db, job.instagramAccountId, error); }
}
