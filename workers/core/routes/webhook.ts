import { Hono } from "hono";
import { journalEvent, verifyMetaSignature, type EventEnvelope } from "@/lib/events/journal";
import type { CoreEnv } from "@/lib/cloudflare/env";

function normalizeEvent(payload: Record<string, unknown>): EventEnvelope | null {
  const entry = Array.isArray(payload.entry) ? payload.entry[0] as Record<string, unknown> | undefined : undefined;
  const changes = Array.isArray(entry?.changes) ? entry.changes[0] as Record<string, unknown> | undefined : undefined;
  const value = changes?.value as Record<string, unknown> | undefined;
  const commentId = typeof value?.id === "string" ? value.id : undefined;
  const accountId = typeof entry?.id === "string" ? entry.id : undefined;
  if (!commentId || !accountId) return null;
  return { version: 1, externalId: commentId, instagramAccountId: accountId, kind: "COMMENT", receivedAt: new Date().toISOString(), payload: { commentId, text: typeof value?.text === "string" ? value.text : null, fromId: typeof (value?.from as Record<string, unknown> | undefined)?.id === "string" ? (value?.from as Record<string, string>).id : null } };
}

export function webhookRoutes() {
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
    const envelope = normalizeEvent(JSON.parse(body) as Record<string, unknown>);
    if (!envelope) return context.json({ accepted: 0 });
    const journal = await journalEvent(context.env.EVENT_JOURNAL, envelope);
    await context.env.INSTAGRAM_EVENTS.send({ version: 1, kind: "COMMENT", externalId: journal.externalId, instagramAccountId: envelope.instagramAccountId, r2Key: journal.key });
    return context.json({ accepted: 1 });
  });
  return app;
}
