import { afterEach, describe, expect, it, vi } from "vitest";
import { safeCallbackUrl } from "@/lib/admin-auth/callback-url";
import { createSessionToken } from "@/lib/admin-auth/session";
import { normalizeAutomationInput, importAutomations, updateAutomation, listAutomations } from "@/lib/automations/service";
import { getPublicReport } from "@/lib/core/report-share";
import { createCoreApp } from "@/workers/core";
import { summarizeDmStatuses } from "@/lib/tracking/analytics";

const campaign = { name: "Campaign", instagramAccountId: "account", dmMessage: "Hello", keywords: ["go"], postId: "post" };
afterEach(() => vi.restoreAllMocks());

describe("Core audit regressions", () => {
  it.each(["/\\evil.example", "/\t/evil.example", "/\n/evil.example"])("rejects browser-normalized external callback %j", (value) => {
    expect(safeCallbackUrl(value)).toBe("/dashboard");
  });

  it("preserves tracked link identities and click history when saving a campaign", async () => {
    const current = { ...normalizeAutomationInput(campaign), trackedLinks: [
      { id: "primary", slug: "sent-primary", destinationUrl: "https://example.com/guide", label: "Guide" },
      { id: "secondary", slug: "sent-secondary", destinationUrl: "https://example.com/bonus", label: "Bonus" },
    ] };
    const update = vi.fn(async ({ data }: { data: unknown }) => data);
    await updateAutomation({ automation: { findUnique: async () => current, update } }, "campaign", { trackedDestinationUrl: "https://example.com/new-guide" });
    expect(update).toHaveBeenCalledWith({ where: { id: "campaign" }, data: expect.objectContaining({ trackedLinks: expect.objectContaining({
      update: expect.arrayContaining([{ where: { id: "primary" }, data: { destinationUrl: "https://example.com/new-guide", label: "Guide" } }]),
    }) }) });
    const data = update.mock.calls[0][0].data as { trackedLinks: { deleteMany?: unknown; delete?: unknown[] } };
    expect(data.trackedLinks.deleteMany).toBeUndefined();
    expect(data.trackedLinks.delete ?? []).toEqual([]);
  });

  it("rejects a patch that removes the last trigger keyword", async () => {
    const update = vi.fn();
    await expect(updateAutomation({ automation: { findUnique: async () => normalizeAutomationInput(campaign), update } }, "campaign", { keywords: [] })).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "data:text/html,hello"])("rejects non-web tracked destination %s", (trackedDestinationUrl) => {
    expect(() => normalizeAutomationInput({ ...campaign, trackedDestinationUrl })).toThrow();
  });

  it("validates every import row before writing any campaign", async () => {
    const create = vi.fn();
    await expect(importAutomations({ automation: { findMany: async () => [], create } }, [campaign, { ...campaign, name: "" }])).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("counts the current SKIPPED delivery status", () => {
    expect(summarizeDmStatuses([{ status: "SKIPPED", _count: 3 }])).toEqual({ sent: 0, failed: 0, skipped: 3 });
  });

  it("returns invalid credentials for a null JSON login body", async () => {
    const response = await createCoreApp().request("https://app.example/api/auth/login", { method: "POST", headers: { origin: "https://app.example", "content-type": "application/json" }, body: "null" }, { LOGIN_THROTTLE: { idFromName: () => "ip", get: () => ({ checkAndRecord: async () => ({ allowed: true }) }) } } as never);
    expect(response.status).toBe(401);
  });

  it("reports database failures as internal errors without logging secret-bearing messages", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const cookie = `__Host-instascaler-session=${await createSessionToken(Math.floor(Date.now() / 1000), 600, "key")}`;
    const app = createCoreApp({ db: { automation: { create: async () => { throw new Error("database-password=secret-value"); } } } as never });
    const response = await app.request("https://app.example/api/automations", { method: "POST", headers: { origin: "https://app.example", cookie, "content-type": "application/json" }, body: JSON.stringify(campaign) }, { SESSION_SIGNING_KEY: "key" } as never);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "internal_error", requestId: expect.any(String) });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("secret-value");
  });

  it.each([
    ["/api/automations/campaign/report", "PATCH", "null"],
    ["/api/automations/import", "POST", "null"],
    ["/api/diagnostics/replay", "POST", "null"],
    ["/api/instagram/conversations", "POST", '{"recipientId":"123","text":42}'],
    ["/api/instagram/conversations", "POST", "null"],
    ["/api/automations?id=campaign", "PATCH", "{"],
  ])("rejects malformed %s input as a client error", async (path, method, body) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cookie = `__Host-instascaler-session=${await createSessionToken(Math.floor(Date.now() / 1000), 600, "key")}`;
    const response = await createCoreApp({ db: {} as never }).request(`https://app.example${path}`, { method, headers: { cookie, origin: "https://app.example", "content-type": "application/json" }, body }, { SESSION_SIGNING_KEY: "key" } as never);
    expect(response.status).toBe(400);
  });

  it("dispatches manual inbox messages through Jobs instead of sending from Core", async () => {
    const cookie = `__Host-instascaler-session=${await createSessionToken(Math.floor(Date.now() / 1000), 600, "key")}`;
    const sendManualMessage = vi.fn(async () => ({ ok: true, data: { message_id: "sent" } }));
    const request = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Core must not send"));
    const response = await createCoreApp({ db: { instagramAccount: { findUnique: async () => ({ id: "account", instagramId: "123" }) } } as never }).request("https://app.example/api/instagram/conversations", { method: "POST", headers: { cookie, origin: "https://app.example", "content-type": "application/json" }, body: JSON.stringify({ instagramAccountId: "account", recipientId: "456", text: " Hello " }) }, { SESSION_SIGNING_KEY: "key", JOBS_API: { sendManualMessage } } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { message_id: "sent" } });
    expect(sendManualMessage).toHaveBeenCalledWith({ instagramAccountId: "account", recipientId: "456", text: "Hello" });
    expect(request).not.toHaveBeenCalled();
  });

  it("does not skip a different account's imported campaign for the same post ID", async () => {
    const result = await importAutomations({ automation: { findMany: async () => [{ instagramAccountId: "account", postId: "post" }], create: async ({ data }) => data } }, [campaign, { ...campaign, instagramAccountId: "other" }]);
    expect(result.created).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("reports imported campaigns without a specific post as created", async () => {
    const result = await importAutomations({ automation: { findMany: async () => [], create: async ({ data }) => data } }, [{ ...campaign, postId: null, matchAnyPost: true }]);
    expect(result.created).toHaveLength(1);
  });

  it("returns the latest follower history window in chronological order", async () => {
    const cookie = `__Host-instascaler-session=${await createSessionToken(Math.floor(Date.now() / 1000), 600, "key")}`;
    const findMany = vi.fn(async () => [{ date: new Date("2026-09-08"), followersCount: 20, backfilled: false }, { date: new Date("2026-09-07"), followersCount: 10, backfilled: false }]);
    const response = await createCoreApp({ db: { instagramAccount: { findFirst: async () => ({ id: "account" }) }, followerSnapshot: { findMany } } as never }).request("https://app.example/api/instagram/follower-history", { headers: { cookie } }, { SESSION_SIGNING_KEY: "key" } as never);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { date: "desc" }, take: 365 }));
    expect(await response.json()).toMatchObject({ data: [{ date: "2026-09-07" }, { date: "2026-09-08" }] });
  });

  it("rejects invalid log status before querying the database", async () => {
    const cookie = `__Host-instascaler-session=${await createSessionToken(Math.floor(Date.now() / 1000), 600, "key")}`;
    const findMany = vi.fn(async () => []);
    const response = await createCoreApp({ db: { dmLog: { findMany, count: async () => 0 } } as never }).request("https://app.example/api/logs?status=garbage", { headers: { cookie } }, { SESSION_SIGNING_KEY: "key" } as never);
    expect(response.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("builds campaign analytics from bounded aggregates instead of loading every DM", async () => {
    const findMany = vi.fn(async () => [{ id: "campaign", trackedLinks: [{ slug: "link", _count: { clicks: 4 } }] }]);
    const rows = await listAutomations({ automation: { findMany }, $queryRawUnsafe: async () => [{ automationId: "campaign", sent: 10, skipped: 3, failed: 2, topKeywords: [{ keyword: "go", count: 8 }] }] } as never);
    expect(rows[0].analytics).toMatchObject({ sent: 10, skipped: 3, failed: 2, clicks: 4, ctr: 40, topKeywords: [{ keyword: "go", count: 8 }] });
    expect(findMany.mock.calls[0]).not.toEqual(expect.arrayContaining([expect.objectContaining({ include: expect.objectContaining({ dmLogs: expect.anything() }) })]));
  });

  it("returns aggregate public report statistics without individual delivery rows", async () => {
    const findFirst = vi.fn(async () => ({ id: "campaign", name: "Campaign", trackedLinks: [{ _count: { clicks: 4 } }] }));
    const report = await getPublicReport({ automation: { findFirst }, $queryRawUnsafe: async () => [{ automationId: "campaign", sent: 10, skipped: 3, failed: 2, topKeywords: [] }] } as never, "share");
    expect(report).toMatchObject({ analytics: { sent: 10, skipped: 3, failed: 2, clicks: 4, ctr: 40 } });
    expect(findFirst.mock.calls[0]).not.toEqual(expect.arrayContaining([expect.objectContaining({ select: expect.objectContaining({ dmLogs: expect.anything() }) })]));
  });

  it("counts dashboard contacts inside PostgreSQL without transferring every contact", async () => {
    const cookie = `__Host-instascaler-session=${await createSessionToken(Math.floor(Date.now() / 1000), 600, "key")}`;
    const findMany = vi.fn(async () => []);
    const count = vi.fn(async () => 0);
    const raw = vi.fn(async () => [{ count: 42 }]);
    const response = await createCoreApp({ db: { instagramAccount: { findMany: async () => [] }, automation: { count }, dmLog: { count, groupBy: async () => [], findMany }, linkClick: { count }, $queryRawUnsafe: raw } as never }).request("https://app.example/api/dashboard/stats?instagramAccountId=account", { headers: { cookie } }, { SESSION_SIGNING_KEY: "key" } as never);
    expect(await response.json()).toMatchObject({ data: { contactsCount: 42 } });
    expect(raw).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT "commenterId")'), "account");
    expect(findMany).toHaveBeenCalledOnce();
  });
});
