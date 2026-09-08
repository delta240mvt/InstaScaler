import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverInstagramJob } from "@/lib/delivery/runtime";
import { processInstagramJob } from "@/lib/delivery";
import { parsePostbackPayload } from "@/lib/delivery/postback-context";
import type { JobsEnv } from "@/lib/cloudflare/env";

vi.mock("@/lib/core/meta-oauth", () => ({ decryptToken: async () => "test-token" }));
afterEach(() => vi.unstubAllGlobals());

function fixture(subscribed = true) {
  const account = { id: "account", instagramId: "ig", webhookSubscribed: subscribed, accessToken: "encrypted" };
  const automation = { id: "campaign", instagramAccount: account, dmMessage: "Freebie", requireFollowBeforeFreebie: false, followUpEnabled: true, followUpMessage: "Follow-up", followUpDelayMinutes: 5 };
  const logs = new Map<string, { status: string; errorMessage?: string }>();
  const db = {
    automation: { findFirst: async () => automation },
    dmLog: {
      findUnique: async ({ where }: { where: { externalId: string } }) => logs.get(where.externalId) ?? null,
      create: async ({ data }: { data: { externalId: string; status: string } }) => { logs.set(data.externalId, data); },
      update: async ({ where, data }: { where: { externalId: string }; data: { status: string } }) => { logs.set(where.externalId, data); },
      upsert: async ({ where, update }: { where: { externalId: string }; update: { status: string } }) => { logs.set(where.externalId, update); },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ dailyBudget: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) }, dailyAggregate: { upsert: async () => ({}) } }),
  };
  const sends: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => { sends.push(JSON.parse(init.body)); return Response.json({ message_id: "sent" }); }));
  const queue = vi.fn(async () => undefined);
  const journals = new Map<string, string>();
  const env = { EVENT_JOURNAL: { put: async (key: string, value: string) => { journals.set(key, value); }, get: async (key: string) => journals.has(key) ? { text: async () => journals.get(key)! } : null }, ACCOUNT_RATE_LIMITER: { idFromName: () => "ig", get: () => ({ reserve: async () => ({ allowed: true }) }) }, INSTAGRAM_EVENTS: { send: queue } } as unknown as JobsEnv;
  const job = { version: 1 as const, kind: "POSTBACK" as const, externalId: "postback:1", instagramAccountId: "ig", r2Key: "events/test.json" };
  const envelope = { version: 1, kind: "POSTBACK", externalId: job.externalId, instagramAccountId: "ig", payload: { userId: "user", payload: "reveal:campaign:comment" } };
  return { db, env, job, envelope, queue, sends, logs, automation, journals };
}

describe("delivery audit regressions", () => {
  it("delivers an admitted RECEIVED event instead of discarding it as a duplicate", async () => {
    const db = { processedEvent: { findUnique: async () => ({ terminalStatus: "RECEIVED" }), create: vi.fn(), update: vi.fn(), updateMany: async () => ({ count: 1 }) } };
    let sends = 0;
    const result = await processInstagramJob({ db, load: async () => ({}), deliver: async () => { sends++; return { status: "sent", code: "SENT" }; } }, { version: 1, kind: "COMMENT", externalId: "comment", instagramAccountId: "ig", r2Key: "events/x.json" });
    expect(result.status).toBe("sent");
    expect(sends).toBe(1);
  });
  it("allows only one consumer to claim a retrying event", async () => {
    let state = "RETRYING";
    const db = { processedEvent: {
      findUnique: async () => ({ terminalStatus: state }), create: async () => ({}),
      update: async ({ data }: { data: { terminalStatus: string } }) => { state = data.terminalStatus; },
      updateMany: async ({ where, data }: { where: { terminalStatus: string }; data: { terminalStatus: string } }) => { if (state !== where.terminalStatus) return { count: 0 }; state = data.terminalStatus; return { count: 1 }; },
    } };
    let sends = 0;
    const context = { db, load: async () => ({}), deliver: async () => { sends++; return { status: "sent" as const, code: "SENT" }; } };
    const job = { version: 1 as const, kind: "COMMENT" as const, externalId: "comment", instagramAccountId: "ig", r2Key: "events/x.json" };
    await Promise.all([processInstagramJob(context, job), processInstagramJob(context, job)]);
    expect(sends).toBe(1);
  });
  it.each(["POSTBACK", "FOLLOW_UP"] as const)("respects account pause for %s", async (kind) => {
    const f = fixture(false);
    const job = kind === "POSTBACK" ? f.job : { version: 1 as const, kind, externalId: "followup", instagramAccountId: "ig", automationId: "campaign", userId: "user", dueAt: "2026-01-01T00:00:00Z" };
    expect(await deliverInstagramJob(f, job, f.envelope)).toEqual({ status: "skipped", code: "ACCOUNT_DISABLED" });
    expect(f.sends).toEqual([]);
  });

  it("does not deliver a follow-up with another account's campaign", async () => {
    const f = fixture();
    expect(await deliverInstagramJob(f, { version: 1, kind: "FOLLOW_UP", externalId: "followup", instagramAccountId: "other", automationId: "campaign", userId: "user", dueAt: "2026-01-01T00:00:00Z" }, null)).toEqual({ status: "skipped", code: "CAMPAIGN_DISABLED" });
    expect(f.sends).toEqual([]);
  });

  it("does not send a delayed follow-up before its due time", async () => {
    const f = fixture();
    expect(await deliverInstagramJob(f, { version: 1, kind: "FOLLOW_UP", externalId: "followup", instagramAccountId: "ig", automationId: "campaign", userId: "user", dueAt: new Date(Date.now() + 60_000).toISOString() }, null)).toEqual({ status: "retry", code: "FOLLOW_UP_NOT_DUE" });
    expect(f.sends).toEqual([]);
  });

  it("records follow-ups so retrying an accepted delivery does not send twice", async () => {
    const f = fixture();
    const job = { version: 1 as const, kind: "FOLLOW_UP" as const, externalId: "followup", instagramAccountId: "ig", automationId: "campaign", userId: "user", dueAt: "2026-01-01T00:00:00Z" };
    await deliverInstagramJob(f, job, null);
    await deliverInstagramJob(f, job, null);
    expect(f.sends).toHaveLength(1);
    expect(f.logs.get("followup")?.status).toBe("SENT");
  });

  it("stores safe diagnostic codes instead of raw upstream errors", async () => {
    const f = fixture();
    vi.stubGlobal("fetch", async () => { throw new Error("request failed access_token=private-value"); });
    expect((await deliverInstagramJob(f, f.job, f.envelope)).status).toBe("retry");
    expect(f.logs.get("freebie:campaign:comment")?.errorMessage).toBe("TRANSIENT_FAILURE");
  });

  it("does not reopen a sent DM when optional public-reply bookkeeping fails", async () => {
    const f = fixture();
    const account = { id: "account", instagramId: "ig", webhookSubscribed: true, accessToken: "encrypted", automations: [{ ...f.automation, matchAnyPost: true, matchAnyWord: true, openingDmEnabled: false, publicReplyEnabled: true, publicReplyMessages: ["Sent!"] }] };
    const update = f.db.dmLog.update;
    const db = { ...f.db, instagramAccount: { findUnique: async () => account }, dmLog: { ...f.db.dmLog, update: async (args: Parameters<typeof update>[0]) => { if (!args.data.status) throw new Error("log unavailable"); return update(args); } } };
    const job = { ...f.job, kind: "COMMENT" as const, externalId: "comment:event" };
    const envelope = { ...f.envelope, kind: "COMMENT", externalId: job.externalId, payload: { commentId: "comment", fromId: "user", text: "freebie", mediaId: "media" } };
    await deliverInstagramJob({ db, env: f.env }, job, envelope);
    expect(f.logs.get("comment:campaign:comment")?.status).toBe("SENT");
    expect(f.sends).toHaveLength(2);
  });

  it("rejects a journal envelope that belongs to a different account", async () => {
    const f = fixture();
    expect(await deliverInstagramJob(f, { ...f.job, instagramAccountId: "other" }, f.envelope)).toEqual({ status: "failed", code: "JOURNAL_JOB_MISMATCH" });
    expect(f.sends).toEqual([]);
  });

  it("retries publishing the follow-up without repeating an already sent freebie", async () => {
    const f = fixture();
    f.queue.mockRejectedValueOnce(new Error("Queue unavailable"));
    expect((await deliverInstagramJob(f, f.job, f.envelope)).status).toBe("retry");
    expect((await deliverInstagramJob(f, f.job, f.envelope)).status).toBe("sent");
    expect(f.queue).toHaveBeenCalledTimes(2);
    expect(f.sends).toHaveLength(1);
  });

  it("retains a follow-up's recipient and due time when publishing fails", async () => {
    const f = fixture();
    f.queue.mockRejectedValueOnce(new Error("Queue unavailable"));
    await deliverInstagramJob(f, f.job, f.envelope);
    expect(f.journals.size).toBe(1);
    const [key, value] = [...f.journals][0];
    expect(key).toMatch(/^follow-ups\//);
    expect(JSON.parse(value)).toMatchObject({ kind: "FOLLOW_UP", automationId: "campaign", userId: "user", externalId: "followup:campaign:comment" });
    const dueAt = JSON.parse(value).dueAt;
    await deliverInstagramJob(f, f.job, f.envelope);
    expect(JSON.parse(f.journals.get(key)!).dueAt).toBe(dueAt);
    expect(f.queue).toHaveBeenLastCalledWith(expect.objectContaining({ r2Key: key, dueAt }), expect.anything());
  });

  it("keeps completed delivery terminal when journal cleanup fails", async () => {
    let terminalStatus: string | null = null;
    const db = { processedEvent: { findUnique: async () => terminalStatus ? { terminalStatus } : null, create: async () => { terminalStatus = "PROCESSING"; }, updateMany: vi.fn(), update: async ({ data }: { data: { terminalStatus: string } }) => { terminalStatus = data.terminalStatus; } } };
    let sends = 0;
    const job = { version: 1 as const, kind: "COMMENT" as const, externalId: "comment", instagramAccountId: "ig", r2Key: "events/x.json" };
    const context = { db, load: async () => ({}), remove: async () => { throw new Error("R2 unavailable"); }, deliver: async () => { sends++; return { status: "sent" as const, code: "SENT" }; } };
    await processInstagramJob(context, job);
    expect(terminalStatus).toBe("COMPLETED");
    await processInstagramJob(context, job);
    expect(sends).toBe(1);
  });

  it("preserves complete Meta message IDs containing colons", () => {
    expect(parsePostbackPayload("reveal:campaign:mid:one:two")?.deliveryKey).toBe("mid:one:two");
  });
});
