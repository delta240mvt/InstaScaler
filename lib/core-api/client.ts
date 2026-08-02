import type { AdminSession, ApiData, AutomationContract, InstagramAccountSummary, Page } from "@/lib/core-api/contracts";
import { CoreApiError } from "@/lib/core-api/errors";

type Options = { baseUrl: string; cookie?: string; fetch?: typeof fetch };
type Query = Record<string, string | number | boolean | null | undefined>;

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
    const response = await requestFetch(url, { ...init, query: undefined, headers, credentials: "same-origin" } as RequestInit);
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => ({})) as { error?: string; requestId?: string };
    if (!response.ok) throw new CoreApiError(response.status, payload.error ?? "http_error", payload.requestId);
    return payload as T;
  }
  const jsonBody = (value: unknown) => JSON.stringify(value);
  return {
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
      posts: (instagramAccountId?: string) => request<ApiData<unknown>>("/api/instagram/posts", { query: { instagramAccountId } }),
      overview: (instagramAccountId?: string) => request<ApiData<unknown>>("/api/instagram/overview", { query: { instagramAccountId } }),
    },
    automations: {
      list: (query: Query = {}) => request<ApiData<AutomationContract[]>>("/api/automations", { query }),
      create: (input: unknown) => request<ApiData<AutomationContract>>("/api/automations", { method: "POST", body: jsonBody(input) }),
      update: (id: string, input: unknown) => request<ApiData<AutomationContract>>("/api/automations", { method: "PATCH", query: { id }, body: jsonBody(input) }),
      delete: (id: string) => request<void>("/api/automations", { method: "DELETE", query: { id } }),
      import: (campaigns: unknown[]) => request<ApiData<unknown>>("/api/automations/import", { method: "POST", body: jsonBody({ campaigns }) }),
    },
    inbox: {
      list: (instagramAccountId?: string) => request<ApiData<unknown>>("/api/instagram/conversations", { query: { instagramAccountId } }),
      detail: (id: string, instagramAccountId?: string) => request<ApiData<unknown>>(`/api/instagram/conversations/${encodeURIComponent(id)}`, { query: { instagramAccountId } }),
    },
    logs: (query: Query = {}) => request<ApiData<Page<unknown>>>("/api/logs", { query }),
    diagnostics: () => request<ApiData<unknown>>("/api/diagnostics"),
    reports: { get: (shareSlug: string) => request<ApiData<unknown>>(`/api/reports/${encodeURIComponent(shareSlug)}`) },
  };
}

export type CoreApi = ReturnType<typeof createCoreApi>;
