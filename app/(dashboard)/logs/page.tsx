"use client";

import { coreFetch } from "@/lib/core-api/client";

/**
 * DM Logs Page
 *
 * Filterable, paginated table of DM logs.
 */

import { useEffect, useState, useCallback } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatusBadge from "@/components/status-badge";

interface DmLog {
  id: string;
  commenterId: string;
  commenterName: string | null;
  commentText: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  automation: { name: string; keywords: string[] };
  instagramAccount: { username: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  "ALL",
  "SENT",
  "FAILED",
  "QUEUED",
  "PROCESSING",
  "RETRYING",
  "SKIPPED",
];

export default function LogsPage() {
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }

      const res = await coreFetch(`/api/logs?${params}`, { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if ((data.data !== undefined)) {
        setError(null);
        setLogs(data.data.logs);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Nie udało się wczytać dziennika.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, statusFilter, selectedAccountId]);

  useEffect(() => {
    coreFetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if ((payload.data !== undefined)) setAccounts(payload.data.instagramAccounts ?? []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchLogs(controller.signal);
    }, 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [fetchLogs]);

  function handleFilterChange(status: string) {
    setLoading(true);
    setStatusFilter(status);
    setPage(1);
  }

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header><p className="app-kicker">Działanie systemu</p><h1 className="app-page-title mt-2">Dziennik aktywności</h1><p className="app-page-description mt-2">Sprawdź wysyłki, pominięcia i błędy we wszystkich kampaniach.</p></header>
      {error && <p role="alert" className="app-card p-4 text-sm text-error">{error}</p>}
      {/* Filters */}
      <div className="app-card flex flex-col gap-4 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`
                min-h-11 px-3 py-2 rounded-lg text-xs font-medium transition-all
                ${
                  statusFilter === status
                    ? "bg-accent/15 text-accent border border-accent/20"
                    : "bg-surface text-muted border border-border hover:border-border-hover hover:text-foreground"
                }
              `}
            >
              {status === "ALL" ? "Wszystkie" : ({ SENT: "Wysłano", FAILED: "Błędy", QUEUED: "W kolejce", PROCESSING: "Przetwarzanie", RETRYING: "Ponawianie", SKIPPED: "Pominięto" } as Record<string, string>)[status]}
            </button>
          ))}
        </div>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={handleAccountChange}
          />
        )}
      </div>

      {/* Table */}
      <div className="app-card overflow-hidden">
        <div className="divide-y divide-border md:hidden">
          {loading && Array.from({ length: 4 }, (_, index) => <div key={index} className="app-skeleton m-4 h-24 rounded-xl" />)}
          {!loading && logs.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted">Brak wpisów w dzienniku</p>}
          {!loading && logs.map((log) => (
            <article key={log.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">@{log.commenterName ?? log.commenterId.slice(0, 8)}</p><p className="mt-1 truncate text-xs text-muted">{log.commentText}</p></div><StatusBadge status={log.status} /></div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><span>{log.automation.name}</span><span aria-hidden="true">·</span><span>@{log.instagramAccount.username}</span><span aria-hidden="true">·</span><time>{new Date(log.createdAt).toLocaleString("pl-PL", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
              {log.errorMessage && <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{log.errorMessage}</p>}
            </article>
          ))}
        </div>
        {/* Six columns don't fit a phone; the table keeps its width and scrolls
            horizontally inside the panel rather than crushing every cell. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Autor komentarza</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Komentarz</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Kampania</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Konto</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Status</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Czas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-4 sm:px-6">
                        <div className="h-4 bg-surface-hover rounded" />
                      </td>
                    </tr>
                  ))}
                </>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted sm:px-6">

                    Brak wpisów w dzienniku
                  </td>
                </tr>
              )}
              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-4 sm:px-6">
                      <span className="font-medium text-foreground">
                        @{log.commenterName ?? log.commenterId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-[200px] sm:px-6">
                      <span className="text-muted truncate block">{log.commentText}</span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <span className="text-muted">{log.automation.name}</span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <span className="text-muted">@{log.instagramAccount.username}</span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-4 text-muted whitespace-nowrap sm:px-6">
                      {new Date(log.createdAt).toLocaleString("pl-PL", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-t border-border sm:px-6">
            <p className="text-xs text-muted">

              Wyświetlono {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}  z{" "}
              {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage(page - 1);
                }}
                className="app-button app-button-secondary min-h-11 px-3 text-xs disabled:pointer-events-none disabled:opacity-30"
              >

                Poprzednia
              </button>
              <span className="text-xs text-muted px-2">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage(page + 1);
                }}
                className="app-button app-button-secondary min-h-11 px-3 text-xs disabled:pointer-events-none disabled:opacity-30"
              >

                Następna
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
