import { Hono } from "hono";
import { journalEvent, verifyMetaSignature, type EventEnvelope } from "@/lib/events/journal";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { admitInboundEvent, type AdmissionDb } from "@/lib/jobs/budget";
import { sourceTimestamp } from "@/lib/delivery/quiz-policy";
import type { InstagramJob } from "@/lib/jobs/contracts";

export type WebhookDb = AdmissionDb & {
  instagramAccount: { findUnique(args: unknown): Promise<{ id: string } | null> };
};

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item)) : [];
}

async function normalizeEvents(payload: unknown): Promise<EventEnvelope[]> {
  const receivedAt = new Date().toISOString();
  const envelopes: EventEnvelope[] = [];
  if (!payload || typeof payload !== "object") return envelopes;
  for (const entry of records((payload as Record<string, unknown>).entry)) {
    const accountId = typeof entry.id === "string" ? entry.id : "";
    if (!accountId) continue;
    for (const change of records(entry.changes)) {
      const value = change.value as Record<string, unknown> | undefined;
      const from = value?.from as Record<string, unknown> | undefined;
      const media = value?.media as Record<string, unknown> | undefined;
      const commentId = typeof value?.id === "string" ? value.id : typeof value?.comment_id === "string" ? value.comment_id : "";
      if (change.field === "comments" && commentId && typeof from?.id === "string" && from.id !== accountId) {
        envelopes.push({ version: 1, externalId: `comment:${commentId}`, instagramAccountId: accountId, kind: "COMMENT", receivedAt, payload: { occurredAt: sourceTimestamp(value?.timestamp ?? entry.time, new Date(receivedAt), "s"), commentId, text: typeof value?.text === "string" ? value.text : "", fromId: from.id, fromUsername: typeof from.username === "string" ? from.username : null, mediaId: typeof media?.id === "string" ? media.id : typeof value?.media_id === "string" ? value.media_id : "" } });
      }
    }
    for (const messaging of records(entry.messaging)) {
      const sender = messaging.sender as Record<string, unknown> | undefined;
      const senderId = typeof sender?.id === "string" ? sender.id : "";
      if (!senderId || senderId === accountId) continue;
      const postback = messaging.postback as Record<string, unknown> | undefined;
      if (typeof postback?.payload === "string") {
        const fingerprint = JSON.stringify([accountId, senderId, postback.payload, messaging.timestamp ?? entry.time ?? ""]);
        const mid = typeof postback.mid === "string" ? postback.mid : Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint))), (byte) => byte.toString(16).padStart(2, "0")).join("");
        envelopes.push({ version: 1, externalId: `postback:${mid}`, instagramAccountId: accountId, kind: "POSTBACK", receivedAt, payload: { occurredAt: sourceTimestamp(messaging.timestamp, new Date(receivedAt), "ms"), userId: senderId, payload: postback.payload, mid } });
      }
      const message = messaging.message as Record<string, unknown> | undefined;
      if (typeof message?.mid === "string" && typeof message.text === "string" && !message.is_echo && !message.is_deleted && !message.is_unsupported) {
        const quickReply = message.quick_reply as Record<string, unknown> | undefined;
        envelopes.push({ version: 1, externalId: `message:${message.mid}`, instagramAccountId: accountId, kind: "MESSAGE", receivedAt, payload: { occurredAt: sourceTimestamp(messaging.timestamp, new Date(receivedAt), "ms"), quickReplyPayload: typeof quickReply?.payload === "string" ? quickReply.payload : null, senderId, messageId: message.mid, text: message.text } });
      }
    }
  }
  return envelopes;
}

export function webhookRoutes(getDb?: (env: CoreEnv) => WebhookDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.get("/webhook", (context) => {
    const mode = context.req.query("hub.mode");
    const token = context.req.query("hub.verify_token");
    const challenge = context.req.query("hub.challenge");
    return mode === "subscribe" && token === context.env.META_WEBHOOK_VERIFY_TOKEN && challenge ? context.text(challenge) : context.json({ error: "forbidden" }, 403);
  });
  app.post("/webhook", async (context) => {
    const body = await context.req.text();
    if (!await verifyMetaSignature(body, context.req.header("x-hub-signature-256"), context.env.META_APP_SECRET)) return context.json({ error: "invalid_signature" }, 401);
    let payload: unknown;
    try { payload = JSON.parse(body); }
    catch { return context.json({ error: "invalid_input" }, 400); }
    const envelopes = await normalizeEvents(payload);
    const journals: Array<{ key: string; externalId: string }> = [];
    try {
      for (const envelope of envelopes) journals.push(await journalEvent(context.env.EVENT_JOURNAL, envelope));
    } catch {
      const requestId = crypto.randomUUID();
      console.error("Webhook journal failed", { requestId, error: "journal_unavailable" });
      return context.json({ error: "journal_unavailable", requestId }, 503);
    }
    const process = (async () => {
      const immediate: Promise<unknown>[] = [];
      for (const [index, envelope] of envelopes.entries()) {
        const journal = journals[index];
        if (getDb) {
          const db = getDb(context.env);
          const account = await db.instagramAccount.findUnique({ where: { instagramId: envelope.instagramAccountId }, select: { id: true } });
          if (!account || await admitInboundEvent(db, { externalId: envelope.externalId, instagramAccountId: account.id, kind: envelope.kind, r2Key: journal.key, source: "WEBHOOK" }) !== "admitted") continue;
        }
        const job: InstagramJob = { version: 1, kind: envelope.kind, externalId: journal.externalId, instagramAccountId: envelope.instagramAccountId, r2Key: journal.key };
        await context.env.INSTAGRAM_EVENTS.send(job);
        // Queue is durable before the fast path. Jobs owns sending and atomically claims the event.
        if (getDb && context.env.JOBS_API) {
          immediate.push(Promise.resolve().then(() => context.env.JOBS_API.processEvent(job)).catch(() => {
            console.warn("Immediate Jobs call failed; Queue retains the event", { code: "IMMEDIATE_DELIVERY_UNAVAILABLE" });
          }));
        }
      }
      await Promise.all(immediate);
    })().catch(() => {
      console.error("Webhook processing failed", { requestId: crypto.randomUUID(), error: "queue_publish_failed" });
    });
    context.executionCtx.waitUntil(process);
    return context.json({ accepted: envelopes.length });
  });
  return app;
}
