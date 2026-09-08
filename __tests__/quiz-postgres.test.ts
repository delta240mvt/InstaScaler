import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { webhookRoutes } from "@/workers/core/routes/webhook";
import { createCoreApp } from "@/workers/core";
import { createSessionToken } from "@/lib/admin-auth/session";
import { encryptToken } from "@/lib/core/meta-oauth";
import { processInstagramJob } from "@/lib/delivery";
import { deliverInstagramJob } from "@/lib/delivery/runtime";
import { dispatchQuizWork } from "@/lib/delivery/quiz-work";
import { parseInstagramJob, type InstagramJob } from "@/lib/jobs/contracts";
import type { JobsEnv, CoreEnv } from "@/lib/cloudflare/env";
import { neonConfig } from "@neondatabase/serverless";
import { startLocalNeonProxy } from "@/test-support/local-neon-proxy.mjs";
import { createPrisma } from "@/lib/db/neon";
import { createPath, publishPath, saveDraft } from "@/lib/quiz/paths";
import { createDemoGraph } from "@/lib/quiz/demo";
import { acceptQuizControl, acceptQuizInput, createQuizEntry, advanceQuizRun, reconcileQuizButton } from "@/lib/quiz/execution";
import { decodeQuizPayload } from "@/lib/delivery/quiz-payload";
import { controlQuizRun, recoverQuizWork } from "@/lib/quiz/recovery";
import { createQuizRepository, json, snapshotOf } from "@/lib/quiz/repository";
import { initialSnapshot } from "@/lib/quiz/engine";
import { qualify } from "@/lib/quiz/qualification";
import { contactQuery, contactWhere } from "@/lib/quiz/contacts";
import { deleteQuizContact } from "@/lib/quiz/privacy";

const url = process.env.QUIZ_TEST_DATABASE_URL;
if (url && url === process.env.DATABASE_URL) throw new Error("Refusing to test against the application database");
describe.skipIf(!url)("quiz PostgreSQL integration (isolated database only)", { timeout: 30000 }, () => {
  let db: ReturnType<typeof createPrisma>;
  let proxy: Awaited<ReturnType<typeof startLocalNeonProxy>> | undefined;
  let accountId: string;
  beforeAll(async () => {
    if (!url) return;
    if (["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
      proxy = await startLocalNeonProxy(url);
      neonConfig.webSocketConstructor = proxy.WebSocket;
      neonConfig.wsProxy = () => `127.0.0.1:${proxy!.port}`;
      neonConfig.useSecureWebSocket = false;
      neonConfig.pipelineConnect = false;
    }
    db = createPrisma(url);
    accountId = (await db.instagramAccount.create({ data: { instagramId: `quiz-test-${crypto.randomUUID()}`, username: "quiz_test", accessToken: "synthetic-test-value", webhookSubscribed: true } })).id;
  }, 30000);
  afterAll(async () => {
    if (accountId) {
      await db.quizRun.deleteMany({ where: { contact: { instagramAccountId: accountId } } });
      await db.instagramAccount.delete({ where: { id: accountId } });
    }
    await db?.$disconnect();
    await proxy?.close();
  });
  async function fixture() {
    const draft = { name: "Test", instagramAccountId: accountId, graph: createDemoGraph() };
    // Distinct keyword avoids intentionally conflicting fixture publications.
    const start = draft.graph.nodes[0]; if (start.type === "start") start.keyword = crypto.randomUUID();
    const p = await createPath(db, draft);
    const published = await publishPath(db, p.id, p.draftRevision);
    const entry = await createQuizEntry(db, { accountId, instagramUserId: crypto.randomUUID(), username: "test", pathVersionId: published.publishedVersionId!, commentId: crypto.randomUUID(), postId: "123", externalId: `test-entry:${crypto.randomUUID()}`, occurredAt: new Date(), receivedAt: new Date() });
    if (!("runId" in entry)) throw new Error("entry blocked");
    return { draft, path: published, entry };
  }
  it("enforces one active run and rolls back failed transactions", async () => {
    const { entry } = await fixture();
    const run = await db.quizRun.findUniqueOrThrow({ where: { id: entry.runId } });
    await expect(db.quizRun.create({ data: { contactId: run.contactId, pathId: run.pathId, versionId: run.versionId, snapshot: run.snapshot!, sourceCommentId: "other", sourcePostId: "123", commentCreatedAt: new Date() } })).rejects.toThrow();
    await expect(db.$transaction(async tx => { await tx.quizContact.update({ where: { id: run.contactId }, data: { tags: ["rolled-back"] } }); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect((await db.quizContact.findUniqueOrThrow({ where: { id: run.contactId } })).tags).toEqual([]);
  });
  it("keeps draft conflicts and publications atomic", async () => {
    const { path, draft } = await fixture();
    await saveDraft(db, path.id, path.draftRevision, { ...draft, name: "New" });
    await expect(saveDraft(db, path.id, path.draftRevision, draft)).rejects.toMatchObject({ code: "quiz_revision_conflict" });
    expect((await db.quizVersion.findUniqueOrThrow({ where: { id: path.publishedVersionId! } })).graph).toEqual(draft.graph);
  });
  it("only accepts one of two simultaneous answers at one revision", async () => {
    const { draft, entry } = await fixture();
    await db.quizWork.deleteMany({ where: { runId: entry.runId } });
    const waiting = { ...initialSnapshot(draft.graph), phase: "waiting" as const };
    const run = await db.quizRun.update({ where: { id: entry.runId }, data: { snapshot: json(waiting), status: "WAITING_REPLY", revision: 4, lastInteractionAt: new Date() }, include: { contact: true } });
    const input = { runId: run.id, expectedRevision: 4, instagramUserId: run.contact.instagramUserId!, instagramAccountId: accountId, nodeId: "wybor", occurredAt: new Date() };
    const results = await Promise.all([acceptQuizInput(db, { ...input, externalId: `answer-a:${run.id}`, input: { kind: "answer", value: "", choiceId: "pomoc" } }), acceptQuizInput(db, { ...input, externalId: `answer-b:${run.id}`, input: { kind: "answer", value: "", choiceId: "material" } })]);
    expect(results.filter(r => r === "accepted")).toHaveLength(1);
    expect(await db.quizEvent.count({ where: { runId: run.id, kind: "ANSWER" } })).toBe(1);
    await advanceQuizRun(db, run.id);
    expect(await db.quizWork.count({ where: { runId: run.id, status: "PENDING" } })).toBe(1);
    expect(snapshotOf((await db.quizRun.findUniqueOrThrow({ where: { id: run.id } })).snapshot).nodeId).toBe("email");
  });
  it("pins the old version until an explicit restart and records the new source post", async () => {
    const { path, draft, entry } = await fixture();
    await db.quizWork.update({ where: { id: entry.workId }, data: { status: "SENT" } });
    const run = await db.quizRun.findUniqueOrThrow({ where: { id: entry.runId }, include: { contact: true } });
    const saved = await saveDraft(db, path.id, path.draftRevision, { ...draft, name: "Version two" });
    const current = await publishPath(db, path.id, saved.draftRevision);
    expect(current.publishedVersionId).not.toBe(run.versionId);
    const at = new Date();
    const reentry = await createQuizEntry(db, { accountId, instagramUserId: run.contact.instagramUserId!, username: "test", pathVersionId: current.publishedVersionId!, commentId: "new-comment", postId: "new-post", externalId: `reentry:${run.id}`, occurredAt: at, receivedAt: at });
    if (!("workId" in reentry)) throw new Error("reentry blocked");
    expect(reentry.runId).toBe(run.id);
    expect((await db.quizRun.findUniqueOrThrow({ where: { id: run.id } })).versionId).toBe(run.versionId);
    await db.quizWork.update({ where: { id: reentry.workId }, data: { status: "SENT" } });
    const nextId = await acceptQuizControl(db, { runId: run.id, versionId: current.publishedVersionId!, revision: run.revision, nodeId: snapshotOf(run.snapshot).nodeId, choiceId: "", action: "restart" }, `restart:${run.id}`, accountId, run.contact.instagramUserId!, at);
    expect(nextId).toBeTruthy();
    const next = await db.quizRun.findUniqueOrThrow({ where: { id: nextId! } });
    expect(next.versionId).toBe(current.publishedVersionId);
    expect(next.sourcePostId).toBe("new-post"); expect(next.sourceCommentId).toBe("new-comment");
    expect(snapshotOf(next.snapshot).answers).toEqual({});
    expect((await db.quizRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("RESTARTED");
  });
  it("atomically prepares one send for competing transitions", async () => {
    const { draft, entry } = await fixture();
    await db.quizWork.deleteMany({ where: { runId: entry.runId } });
    const snapshot = initialSnapshot(draft.graph);
    await db.quizRun.update({ where: { id: entry.runId }, data: { status: "ACTIVE", snapshot: json(snapshot) } });
    const repo = createQuizRepository(db);
    const input = { runId: entry.runId, expectedRevision: 0, nodeId: snapshot.nodeId, after: { ...snapshot, phase: "waiting" as const }, qualification: qualify(draft.graph.qualification, snapshot), outbound: { text: "Question", buttons: [] }, now: new Date() };
    const result = await Promise.all([repo.commitTransition({ ...input, externalId: `transition-a:${entry.runId}` }), repo.commitTransition({ ...input, externalId: `transition-b:${entry.runId}` })]);
    expect(result.filter(r => r === "applied")).toHaveLength(1);
    expect(await db.quizWork.count({ where: { runId: entry.runId } })).toBe(1);
  });
  it("scrubs contact data and rejects old journal reentry", async () => {
    const { path, entry } = await fixture();
    const run = await db.quizRun.findUniqueOrThrow({ where: { id: entry.runId }, include: { contact: true } });
    const before = new Date();
    await deleteQuizContact(db, { put: async () => undefined, get: async () => null, delete: async () => undefined }, run.contactId);
    const c = await db.quizContact.findUniqueOrThrow({ where: { id: run.contactId } });
    expect(c.instagramUserId).toBeNull(); expect(c.tags).toEqual([]);
    expect(await db.quizRun.count({ where: { contactId: c.id } })).toBe(0);
    expect(await createQuizEntry(db, { accountId, instagramUserId: run.contact.instagramUserId!, username: null, pathVersionId: path.publishedVersionId!, commentId: run.sourceCommentId, postId: run.sourcePostId, externalId: `replay:${run.id}`, occurredAt: before, receivedAt: before })).toEqual({ blocked: true });
  });
  it("handles signed START → opening → choice → invalid/valid email → completion through real persistence", async () => {
    const { draft, path } = await fixture();
    const account = await db.instagramAccount.findUniqueOrThrow({ where: { id: accountId } });
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    await db.instagramAccount.update({ where: { id: accountId }, data: { accessToken: await encryptToken("synthetic-test-token", key) } });
    const journals = new Map<string, string>(); const queue: InstagramJob[] = []; const order: string[] = [];
    const sends: Array<{ recipient: Record<string, string>; message: { text?: string; attachment?: { payload: { text: string; buttons: Array<{ payload: string; title: string }> } } } }> = [];
    const env = { ENCRYPTION_KEY: key, META_APP_SECRET: "synthetic-meta-secret", SESSION_SIGNING_KEY: "synthetic-session-key", APP_BASE_URL: "https://app.example", EVENT_JOURNAL: { put: async (k: string, v: string) => { journals.set(k, v); order.push("journal"); }, get: async (k: string) => journals.has(k) ? { text: async () => journals.get(k)! } : null, delete: async (k: string) => { journals.delete(k); } }, INSTAGRAM_EVENTS: { send: async (j: unknown) => { const job = parseInstagramJob(j); expect(journals.has(job.r2Key!)).toBe(true); queue.push(job); order.push("queue"); } }, ACCOUNT_RATE_LIMITER: { idFromName: () => "id", get: () => ({ reserve: async () => { order.push("reserve"); return { allowed: true }; } }) } } as unknown as JobsEnv & CoreEnv;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => { expect(order.at(-1)).toBe("reserve"); sends.push(JSON.parse(init!.body as string)); order.push("send"); return Response.json({ message_id: `sent-${sends.length}` }); }));
    try {
      const app = webhookRoutes(() => db);
      const webhook = async (payload: unknown) => {
        const body = JSON.stringify(payload); const signing = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.META_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = Buffer.from(await crypto.subtle.sign("HMAC", signing, new TextEncoder().encode(body))).toString("hex");
        const pending: Promise<unknown>[] = [];
        const response = await app.request("https://app.example/webhook", { method: "POST", headers: { "x-hub-signature-256": `sha256=${signature}` }, body }, env, { waitUntil: p => pending.push(p), passThroughOnException() {}, props: {} });
        expect(response.status).toBe(200); await Promise.all(pending);
      };
      const drain = async () => { let count = 0; while (queue.length) { if (++count > 30) throw new Error("unbounded queue"); const job = queue.shift()!; const result = await processInstagramJob({ db, accountId, load: async k => JSON.parse(journals.get(k)!), remove: async k => { journals.delete(k); }, deliver: (j, e) => deliverInstagramJob({ db, env }, j, e) }, job); expect(result.status, result.code).not.toMatch(/failed|retry/); } };
      const userId = `900${Date.now()}`;
      const postback = async (payload: string, mid = crypto.randomUUID()) => { await webhook({ entry: [{ id: account.instagramId, messaging: [{ sender: { id: userId }, timestamp: Date.now(), postback: { mid, payload } }] }] }); await drain(); };
      const message = async (text: string) => { await webhook({ entry: [{ id: account.instagramId, messaging: [{ sender: { id: userId }, timestamp: Date.now(), message: { mid: crypto.randomUUID(), text } }] }] }); await drain(); };
      const start = draft.graph.nodes[0]; if (start.type !== "start") throw new Error("start");
      await webhook({ entry: [{ id: account.instagramId, time: Math.floor(Date.now() / 1000), changes: [{ field: "comments", value: { id: crypto.randomUUID(), text: start.keyword, from: { id: userId }, media: { id: "123" } } }] }] });
      await drain(); expect(sends).toHaveLength(1); expect(sends[0].recipient.comment_id).toBeTruthy();
      await postback(sends[0].message.attachment!.payload.buttons[0].payload);
      expect(sends).toHaveLength(2);
      const choice = sends[1].message.attachment!.payload.buttons[1].payload;
      await postback(choice); expect(sends).toHaveLength(3);
      await postback(choice); expect(sends).toHaveLength(3);
      await message("bad-email"); expect(sends).toHaveLength(4);
      await message("osoba@example.com"); expect(sends).toHaveLength(5);
      const run = await db.quizRun.findFirstOrThrow({ where: { pathId: path.id, contact: { instagramUserId: userId } }, include: { contact: true } });
      expect(run.status).toBe("COMPLETED"); expect(run.qualified).toBe(true); expect(run.contact.tags).toContain("pomoc"); expect(run.contact.email).toBe("osoba@example.com");
      expect(journals.size).toBe(0);
      // Private endpoints exercise real auth/origin middleware.
      const core = createCoreApp({ db: db as unknown as NonNullable<Parameters<typeof createCoreApp>[0]>["db"] });
      expect((await core.request("https://app.example/api/quiz-paths", {}, env)).status).toBe(401);
      const cookie = `__Host-instascaler-session=${await createSessionToken(Math.floor(Date.now() / 1000), 600, env.SESSION_SIGNING_KEY)}`;
      expect((await core.request("https://app.example/api/quiz-paths", { headers: { cookie } }, env)).status).toBe(200);
      expect((await core.request("https://app.example/api/quiz-paths", { method: "POST", headers: { cookie, origin: "https://other.example" }, body: "{}" }, env)).status).toBe(403);
    } finally { vi.unstubAllGlobals(); }
  }, 60000);
  it("keeps ambiguous sends UNKNOWN and never automatically resends", async () => {
    const { entry } = await fixture();
    const account = await db.instagramAccount.findUniqueOrThrow({ where: { id: accountId } });
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    await db.instagramAccount.update({ where: { id: accountId }, data: { accessToken: await encryptToken("synthetic", key) } });
    let job: InstagramJob | undefined;
    const env = { ENCRYPTION_KEY: key, EVENT_JOURNAL: { put: async () => undefined }, INSTAGRAM_EVENTS: { send: async (value: unknown) => { job = parseInstagramJob(value); } }, ACCOUNT_RATE_LIMITER: { idFromName: () => "id", get: () => ({ reserve: async () => ({ allowed: true }) }) } } as unknown as JobsEnv;
    let clickedPayload = "";
    const send = vi.fn(async (_url: unknown, init?: RequestInit) => { clickedPayload = JSON.parse(init!.body as string).message.attachment.payload.buttons[0].payload; throw new TypeError("connection lost"); }); vi.stubGlobal("fetch", send);
    try {
      await dispatchQuizWork(db, env, entry.workId);
      expect(job?.instagramAccountId).toBe(account.instagramId);
      expect((await deliverInstagramJob({ db, env }, job!, job!)).code).toBe("QUIZ_SEND_UNCERTAIN");
      expect((await db.quizWork.findUniqueOrThrow({ where: { id: entry.workId } })).status).toBe("UNKNOWN");
      await deliverInstagramJob({ db, env }, job!, job!);
      expect(send).toHaveBeenCalledTimes(1);
      const run = await db.quizRun.findUniqueOrThrow({ where: { id: entry.runId }, include: { contact: true } });
      const button = decodeQuizPayload(clickedPayload)!;
      expect(await reconcileQuizButton(db, button, accountId, "wrong-user")).toBe(false);
      expect(await reconcileQuizButton(db, button, accountId, run.contact.instagramUserId!)).toBe(true);
      expect((await db.quizRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("WAITING_START");
      expect((await db.quizWork.findUniqueOrThrow({ where: { id: entry.workId } })).status).toBe("SENT");
    } finally { vi.unstubAllGlobals(); }
  }, 30000);
  it("recovers work persisted before Queue publication and blocks sends after pause or STOP", async () => {
    const { entry } = await fixture();
    const journals = new Map<string, string>(); const jobs: unknown[] = [];
    const env = { EVENT_JOURNAL: { put: async (k: string, value: string) => { journals.set(k, value); }, get: async (k: string) => journals.has(k) ? { text: async () => journals.get(k)! } : null }, INSTAGRAM_EVENTS: { send: async (job: unknown) => { jobs.push(job); } } } as unknown as JobsEnv;
    await controlQuizRun(db, entry.runId, "pause");
    expect(await dispatchQuizWork(db, env, entry.workId)).toBe(false);
    await controlQuizRun(db, entry.runId, "resume");
    await recoverQuizWork(db, env);
    expect(jobs.some(j => parseInstagramJob(j).externalId === `quiz-work:${entry.workId}`)).toBe(true);
    const run = await db.quizRun.findUniqueOrThrow({ where: { id: entry.runId }, include: { contact: true } });
    expect(await acceptQuizInput(db, { runId: run.id, expectedRevision: 999, externalId: `stop:${run.id}`, instagramUserId: run.contact.instagramUserId!, instagramAccountId: accountId, nodeId: "not-current", input: { kind: "stop" }, occurredAt: new Date() })).toBe("accepted");
    expect(await dispatchQuizWork(db, env, entry.workId)).toBe(false);
    expect((await db.quizWork.findUniqueOrThrow({ where: { id: entry.workId } })).status).toBe("CANCELLED");
  }, 30000);
});
it("binds path and qualification filters to the same run", () => {
  expect(contactWhere(contactQuery.parse({ pathId: "p1", qualified: "true" })).runs).toEqual({ some: { pathId: "p1", qualified: true } });
  expect(contactWhere(contactQuery.parse({ qualified: "false" })).runs).toEqual({ none: { qualified: true } });
  expect(contactWhere(contactQuery.parse({ pathId: "p1", qualified: "false" })).runs).toEqual({ some: { pathId: "p1" }, none: { pathId: "p1", qualified: true } });
});
