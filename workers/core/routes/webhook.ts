import { Hono } from "hono";
import { journalEvent, verifyMetaSignature, type EventEnvelope } from "@/lib/events/journal";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { reserveInboundEvent } from "@/lib/jobs/budget";

export type WebhookDb = {
  instagramAccount: { findUnique(args: unknown): Promise<{ id: string } | null> };
  $transaction<T>(callback: (tx: { dailyAggregate: { upsert(args: unknown): Promise<unknown>; updateMany(args: unknown): Promise<{ count: number }> } }) => Promise<T>): Promise<T>;
};

function normalizeEvents(payload: Record<string, unknown>): EventEnvelope[] {
  const receivedAt = new Date().toISOString();
  const envelopes: EventEnvelope[] = [];
  for (const entry of Array.isArray(payload.entry) ? payload.entry as Record<string, unknown>[] : []) {
    const accountId = typeof entry.id === "string" ? entry.id : "";
    if (!accountId) continue;
    for (const change of Array.isArray(entry.changes) ? entry.changes as Record<string, unknown>[] : []) {
      const value = change.value as Record<string, unknown> | undefined;
      const from = value?.from as Record<string, unknown> | undefined;
      const media = value?.media as Record<string, unknown> | undefined;
      const commentId = typeof value?.id === "string" ? value.id : typeof value?.comment_id === "string" ? value.comment_id : "";
      if (change.field === "comments" && commentId && typeof from?.id === "string" && from.id !== accountId) {
        envelopes.push({ version: 1, externalId: `comment:${commentId}`, instagramAccountId: accountId, kind: "COMMENT", receivedAt, payload: { commentId, text: typeof value?.text === "string" ? value.text : "", fromId: from.id, fromUsername: typeof from.username === "string" ? from.username : null, mediaId: typeof media?.id === "string" ? media.id : typeof value?.media_id === "string" ? value.media_id : "" } });
      }
    }
    for (const messaging of Array.isArray(entry.messaging) ? entry.messaging as Record<string, unknown>[] : []) {
      const sender = messaging.sender as Record<string, unknown> | undefined;
      const senderId = typeof sender?.id === "string" ? sender.id : "";
      if (!senderId || senderId === accountId) continue;
      const postback = messaging.postback as Record<string, unknown> | undefined;
      if (typeof postback?.payload === "string") {
        const mid = typeof postback.mid === "string" ? postback.mid : `${senderId}:${postback.payload}:${String(entry.time ?? "")}`;
        envelopes.push({ version: 1, externalId: `postback:${mid}`, instagramAccountId: accountId, kind: "POSTBACK", receivedAt, payload: { userId: senderId, payload: postback.payload, mid } });
      }
      const message = messaging.message as Record<string, unknown> | undefined;
      if (typeof message?.mid === "string" && typeof message.text === "string" && !message.is_echo && !message.is_deleted && !message.is_unsupported) {
        envelopes.push({ version: 1, externalId: `message:${message.mid}`, instagramAccountId: accountId, kind: "MESSAGE", receivedAt, payload: { senderId, messageId: message.mid, text: message.text } });
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
    const envelopes = normalizeEvents(JSON.parse(body) as Record<string, unknown>);
    for (const envelope of envelopes) {
      const journal = await journalEvent(context.env.EVENT_JOURNAL, envelope);
      if (getDb) {
        const db = getDb(context.env);
        const account = await db.instagramAccount.findUnique({ where: { instagramId: envelope.instagramAccountId }, select: { id: true } });
        if (!account || !await reserveInboundEvent(db, account.id)) continue;
      }
      await context.env.INSTAGRAM_EVENTS.send({ version: 1, kind: envelope.kind, externalId: journal.externalId, instagramAccountId: envelope.instagramAccountId, r2Key: journal.key });
    }
    return context.json({ accepted: envelopes.length });
  });
  return app;
}
