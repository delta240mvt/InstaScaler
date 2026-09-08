import type { Page } from "@playwright/test";

export const account = { id: "acc1", instagramId: "123", username: "konto_testowe", name: "Konto testowe", webhookSubscribed: true, requiresReconnect: false };
export const campaign = {
  id: "campaign1", name: "Poradnik testowy", goal: "Pobrania poradnika", instagramAccountId: account.id, instagramAccount: account,
  postId: null, postUrl: null, pendingNextReel: false, matchAnyPost: true, keywords: ["PORADNIK"], matchAnyWord: false,
  dmMessage: "Oto Twój poradnik: {link}", openingDmEnabled: false, openingDmMessage: "Chcesz poradnik?", openingDmButtonLabel: "Wyślij poradnik",
  dmTriggerEnabled: false, publicReplyEnabled: false, publicReplyMessage: null, publicReplyMessages: [], requireFollowBeforeFreebie: false,
  followPromptMessage: null, followPromptButtonLabel: null, followUpEnabled: false, followUpMessage: null, followUpDelayMinutes: 60,
  isActive: true, wholeWordMatch: true, linkButtonLabel: "Otwórz", reportShareSlug: "demo", reportShareEnabled: false, reportUrl: null,
  createdAt: "2026-09-08T08:00:00.000Z", _count: { dmLogs: 12 },
  trackedLinks: [{ id: "link1", slug: "guide", label: "Poradnik", destinationUrl: "https://example.com/poradnik", trackedUrl: "https://example.com/r/guide", _count: { clicks: 4 } }],
  analytics: { sent: 10, skipped: 1, failed: 1, clicks: 4, ctr: 40, topKeywords: [{ keyword: "PORADNIK", count: 10 }] },
};

export async function fixtureApi(page: Page, options: { noAccounts?: boolean; rejectMutations?: boolean; reportFailure?: number; sessionFailure?: number } = {}) {
  const state = { campaigns: [structuredClone(campaign)], mutations: [] as Array<{ method: string; path: string; body: Record<string, unknown> }>, messages: [] as string[], unexpected: [] as string[] };
  const accounts = options.noAccounts ? [] : [account];
  await page.context().addCookies([{ name: "__Host-instascaler-session", value: "browser-fixture", domain: "127.0.0.1", path: "/", secure: true, httpOnly: true, sameSite: "None" }]);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/api/auth/session") return options.sessionFailure ? reply({ error: "unauthorized" }, options.sessionFailure) : reply({ admin: true });
    if (path === "/api/auth/login") return reply({ admin: true });
    if (path === "/api/auth/logout") return route.fulfill({ status: 204 });
    if (path === "/api/instagram/accounts") return reply({ data: { instagramAccounts: accounts, selectedInstagramAccountId: accounts[0]?.id ?? null } });
    if (path === "/api/dashboard/stats") return reply({ data: {
      userName: "Tester", contactsCount: 12, totalAutomations: state.campaigns.length, activeAutomations: 1,
      dmsSentToday: 2, dmsSentWeek: 5, dmsSentMonth: 10, dmsSkippedMonth: 1, dmsFailedMonth: 1, totalDMs: 12,
      clicksThisMonth: 4, totalClicks: 4, ctrThisMonth: 40, instagramAccounts: accounts, selectedInstagramAccountId: accounts[0]?.id ?? null,
      topKeywords: [{ keyword: "PORADNIK", count: 10 }], dailyDMs: [{ date: "2026-09-08", count: 2 }], recentLogs: [],
    } });
    if (path === "/api/instagram/profile") return reply({ data: { username: account.username, name: account.name, profilePictureUrl: null, followersCount: 1234 } });
    if (path === "/api/instagram/posts") return reply({ data: [] });
    if (path === "/api/instagram/follower-history") return reply({ data: [{ date: "2026-09-08", followersCount: 1234, backfilled: false }] });
    if (path === "/api/instagram/overview") return reply({ data: { data: [{ name: "reach", title: "Reach", values: [{ value: 42 }] }] } });
    if (path === "/api/automations" && method === "GET") return reply({ data: state.campaigns });
    if (path === "/api/automations" && method !== "GET") {
      const body = method === "DELETE" ? {} : request.postDataJSON();
      state.mutations.push({ method, path, body });
      if (options.rejectMutations) return reply({ error: "service_unavailable" }, 503);
      if (method === "DELETE") { state.campaigns = state.campaigns.filter((c) => c.id !== url.searchParams.get("id")); return route.fulfill({ status: 204 }); }
      if (method === "PATCH") { Object.assign(state.campaigns[0], body); return reply({ data: state.campaigns[0] }); }
      const created = { ...structuredClone(campaign), ...body, id: "created" };
      state.campaigns.push(created);
      return reply({ data: created });
    }
    if (/^\/api\/automations\/[^/]+\/report$/.test(path)) return reply({ data: { reportShareEnabled: true, reportShareSlug: "demo", reportUrl: "https://example.com/reports/demo" } });
    if (path === "/api/logs") return reply({ data: { logs: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } });
    if (path === "/api/diagnostics") return reply({ data: { accounts, jobRuns: [], operationalEvents: [], dailyCounters: [], globalBudgets: [{ date: "2026-09-08", received: 10, queueJobs: 12, workflowSteps: 1 }], failedJobs: [], database: { bytes: 1048576, level: "ok" } } });
    if (path.startsWith("/api/reports/")) return options.reportFailure ? reply({ error: "unavailable" }, options.reportFailure) : reply({ data: campaign });
    if (path === "/api/instagram/conversations" && method === "GET") return reply({ data: { account, conversations: [
      { id: "thread1", contact: { id: "456", username: "ania_test" }, updatedTime: "2026-09-08T08:00:00Z", lastMessage: { text: "Poproszę poradnik", fromMe: false } },
      { id: "thread2", contact: { id: "789", username: "jan_test" }, updatedTime: "2026-09-08T09:00:00Z", lastMessage: { text: "Dziękuję", fromMe: false } },
    ] } });
    if (path.startsWith("/api/instagram/conversations/") && method === "GET") return reply({ data: { messages: [{ id: "msg1", text: path.endsWith("thread1") ? "Wiadomość Ani" : "Wiadomość Jana", fromMe: false, createdTime: "2026-09-08T08:00:00Z" }] } });
    if (path === "/api/instagram/conversations" && method === "POST") { state.messages.push(request.postDataJSON().text); return reply({ data: { message_id: "sent1" } }); }
    if (path === "/api/instagram/disconnect") return route.fulfill({ status: 204 });
    state.unexpected.push(`${method} ${path}`);
    return reply({ error: "fixture_not_found" }, 404);
  });
  return state;
}
