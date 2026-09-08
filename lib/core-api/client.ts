import type { AdminSession, ApiData, AutomationContract, InstagramAccountSummary, Page } from "@/lib/core-api/contracts";
import { CoreApiError } from "@/lib/core-api/errors";
import type { GraphIssue, QuizDraft } from "@/lib/quiz/contracts";
import type { ContactDetail, ContactPatch, ContactSummary, PathDetail, QuizEventSummary, RunSummary } from "./quiz-contracts";

type Options = { baseUrl: string; cookie?: string; fetch?: typeof fetch };
type Query = Record<string, string | number | boolean | null | undefined>;

async function checkedResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string; requestId?: string; issues?: GraphIssue[] };
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new CoreApiError(response.status, payload.error ?? "http_error", payload.requestId, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined, payload.issues);
  }
  return response;
}

/** Checked fetch for existing browser read models using the Core { data } envelope. */
export async function coreFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return checkedResponse(await fetch(input, init).catch((error) => {
    if (init?.signal?.aborted) throw error;
    throw new CoreApiError(0, "service_unavailable");
  }));
}

export function createCoreApi(options: Options) {
  const requestFetch = options.fetch ?? fetch;
  async function request<T>(path: string, init: RequestInit & { query?: Query } = {}): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(init.query ?? {})) if (value !== undefined && value !== null) query.set(key, String(value));
    const suffix = query.size ? `?${query}` : "";
    const url = `${options.baseUrl.replace(/\/$/, "")}${path}${suffix}`;
    const headers = new Headers(init.headers);
    if (options.cookie) headers.set("cookie", options.cookie);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await checkedResponse(await requestFetch(url, { ...init, query: undefined, headers, credentials: "same-origin" } as RequestInit).catch((error) => {
      if (init.signal?.aborted) throw error;
      throw new CoreApiError(0, "service_unavailable");
    }));
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => ({})) as { error?: string; requestId?: string };
    if (!response.ok) throw new CoreApiError(response.status, payload.error ?? "http_error", payload.requestId);
    return payload as T;
  }
  const jsonBody = (value: unknown) => JSON.stringify(value);
  return {
    quizPaths: {
      list: (query: Query = {}) => request<ApiData<Page<PathDetail>>>("/api/quiz-paths", { query }),
      get: (id: string) => request<ApiData<PathDetail>>(`/api/quiz-paths/${encodeURIComponent(id)}`),
      create: (draft: QuizDraft) => request<ApiData<PathDetail>>("/api/quiz-paths", { method: "POST", body: jsonBody(draft) }),
      saveDraft: (id: string, expectedRevision: number, draft: QuizDraft) => request<ApiData<PathDetail>>(`/api/quiz-paths/${encodeURIComponent(id)}/draft`, { method: "PUT", body: jsonBody({ expectedRevision, draft }) }),
      publish: (id: string, expectedRevision: number) => request<ApiData<PathDetail>>(`/api/quiz-paths/${encodeURIComponent(id)}/publish`, { method: "POST", body: jsonBody({ expectedRevision }) }),
      duplicate: (id: string) => request<ApiData<PathDetail>>(`/api/quiz-paths/${encodeURIComponent(id)}/duplicate`, { method: "POST" }),
      setState: (id: string, acceptsEntries: boolean, halted: boolean) => request<ApiData<PathDetail>>(`/api/quiz-paths/${encodeURIComponent(id)}/state`, { method: "PATCH", body: jsonBody({ acceptsEntries, halted }) }),
    },
    quizContacts: {
      list: (query: Query = {}) => request<ApiData<Page<ContactSummary>>>("/api/quiz-contacts", { query }),
      get: (id: string) => request<ApiData<ContactDetail>>(`/api/quiz-contacts/${encodeURIComponent(id)}`),
      runs: (id: string, query: Query = {}) => request<ApiData<Page<RunSummary>>>(`/api/quiz-contacts/${encodeURIComponent(id)}/runs`, { query }),
      events: (id: string, query: Query = {}) => request<ApiData<Page<QuizEventSummary>>>(`/api/quiz-runs/${encodeURIComponent(id)}/events`, { query }),
      update: (id: string, patch: ContactPatch) => request<ApiData<ContactDetail>>(`/api/quiz-contacts/${encodeURIComponent(id)}`, { method: "PATCH", body: jsonBody(patch) }),
      delete: (id: string) => request<void>(`/api/quiz-contacts/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },
    quizRuns: { control: (id: string, action: "pause" | "resume" | "stop" | "restart") => request<ApiData<{ id: string; status: string }>>(`/api/quiz-runs/${encodeURIComponent(id)}/control`, { method: "POST", body: jsonBody({ action }) }) },
    auth: {
      login: (input: { login: string; password: string }, signal?: AbortSignal) => request<AdminSession>("/api/auth/login", { method: "POST", body: jsonBody(input), signal }),
      logout: () => request<void>("/api/auth/logout", { method: "POST" }),
      session: () => request<AdminSession>("/api/auth/session"),
    },
    dashboard: { stats: (query: Query = {}) => request<ApiData<Record<string, unknown>>>("/api/dashboard/stats", { query }) },
    accounts: {
      list: () => request<ApiData<{ instagramAccounts: InstagramAccountSummary[]; selectedInstagramAccountId: string | null }>>("/api/instagram/accounts"),
      disconnect: (id: string) => request<void>("/api/instagram/disconnect", { method: "DELETE", query: { id } }),
      profile: (instagramAccountId?: string) => request<ApiData<unknown>>("/api/instagram/profile", { query: { instagramAccountId } }),
      followerHistory: (instagramAccountId?: string) => request<ApiData<Array<{ date: string; followersCount: number; backfilled: boolean }>>>("/api/instagram/follower-history", { query: { instagramAccountId } }),
      posts: (instagramAccountId?: string) => request<ApiData<unknown>>("/api/instagram/posts", { query: { instagramAccountId } }),
      overview: (instagramAccountId?: string) => request<ApiData<unknown>>("/api/instagram/overview", { query: { instagramAccountId } }),
    },
    automations: {
      list: (query: Query = {}) => request<ApiData<AutomationContract[]>>("/api/automations", { query }),
      create: (input: unknown) => request<ApiData<AutomationContract>>("/api/automations", { method: "POST", body: jsonBody(input) }),
      update: (id: string, input: unknown) => request<ApiData<AutomationContract>>("/api/automations", { method: "PATCH", query: { id }, body: jsonBody(input) }),
      setReportSharing: (id: string, enabled: boolean) => request<ApiData<{ reportShareEnabled: boolean; reportShareSlug: string; reportUrl: string | null }>>(`/api/automations/${encodeURIComponent(id)}/report`, { method: "PATCH", body: jsonBody({ enabled }) }),
      delete: (id: string) => request<void>("/api/automations", { method: "DELETE", query: { id } }),
      import: (campaigns: unknown[]) => request<ApiData<unknown>>("/api/automations/import", { method: "POST", body: jsonBody({ campaigns }) }),
    },
    inbox: {
      list: (instagramAccountId?: string) => request<ApiData<unknown>>("/api/instagram/conversations", { query: { instagramAccountId } }),
      detail: (id: string, instagramAccountId?: string) => request<ApiData<unknown>>(`/api/instagram/conversations/${encodeURIComponent(id)}`, { query: { instagramAccountId } }),
    },
    logs: (query: Query = {}) => request<ApiData<Page<unknown>>>("/api/logs", { query }),
    diagnostics: () => request<ApiData<unknown>>("/api/diagnostics"),
    replayJob: (externalId: string) => request<ApiData<{ status: "queued" }>>("/api/diagnostics/replay", { method: "POST", body: jsonBody({ externalId }) }),
    reports: { get: (shareSlug: string) => request<ApiData<unknown>>(`/api/reports/${encodeURIComponent(shareSlug)}`) },
  };
}

export type CoreApi = ReturnType<typeof createCoreApi>;
