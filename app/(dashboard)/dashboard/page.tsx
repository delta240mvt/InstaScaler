"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import { Icon } from "@/components/ui-icons";

interface DashboardStats {
  userName: string | null;
  contactsCount: number;
  totalAutomations: number;
  activeAutomations: number;
  dmsSentToday: number;
  dmsSentWeek: number;
  dmsSentMonth: number;
  dmsSkippedMonth: number;
  dmsFailedMonth: number;
  totalDMs: number;
  clicksThisMonth: number;
  totalClicks: number;
  ctrThisMonth: number;
  instagramAccounts: AccountOption[];
  selectedInstagramAccountId: string | null;
  topKeywords: { keyword: string; count: number }[];
  dailyDMs: { date: string; count: number }[];
  recentLogs: Array<{ id: string; commenterName: string | null; commentText: string; status: string; createdAt: string; automation: { name: string }; instagramAccount?: { username: string } }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") params.set("instagramAccountId", selectedAccountId);
    fetch(`/api/dashboard/stats${params.size ? `?${params}` : ""}`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setStats(data.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  if (loading) {
    return <div className="space-y-6" aria-label="Loading dashboard">
      <div className="app-skeleton h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="app-skeleton h-32 rounded-2xl" />)}</div>
      <div className="app-skeleton h-72 rounded-2xl" />
    </div>;
  }

  const connectedCount = stats?.instagramAccounts.length ?? 0;
  const maxDM = Math.max(...(stats?.dailyDMs.map((day) => day.count) ?? [1]), 1);

  return <div className="space-y-7 sm:space-y-8">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="app-kicker">Workspace overview</p>
        <h1 className="app-page-title mt-2">Good to see you, {stats?.userName ?? "there"}</h1>
        <p className="app-page-description mt-2">{connectedCount} connected {connectedCount === 1 ? "account" : "accounts"} · {stats?.contactsCount ?? 0} contacts</p>
      </div>
      <div className="flex flex-col gap-3 min-[420px]:flex-row sm:items-center">
        {stats && stats.instagramAccounts.length > 1 && <AccountSelect accounts={stats.instagramAccounts} value={selectedAccountId} onChange={(value) => { setLoading(true); setSelectedAccountId(value); }} />}
        <Link href="/campaigns/new" className="app-button app-button-primary w-full min-[420px]:w-auto"><Icon name="plus" size={18} />Create campaign</Link>
      </div>
    </header>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-label="Campaign metrics">
      <StatCard label="Active campaigns" value={stats?.activeAutomations ?? 0} />
      <StatCard label="DMs sent" value={stats?.dmsSentMonth ?? 0} />
      <StatCard label="Skipped" value={stats?.dmsSkippedMonth ?? 0} />
      <StatCard label="Failed" value={stats?.dmsFailedMonth ?? 0} />
      <StatCard label="Clicks" value={stats?.clicksThisMonth ?? 0} />
      <StatCard label="CTR" value={`${stats?.ctrThisMonth ?? 0}%`} />
    </section>

    <section className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <article className="app-card min-w-0 p-5 sm:p-6 lg:col-span-7">
        <div className="flex items-center justify-between"><div><p className="app-kicker">Delivery</p><h2 className="mt-1 font-semibold text-foreground">DMs in the last 7 days</h2></div><Link href="/logs" className="text-sm font-semibold text-accent hover:underline">View logs</Link></div>
        <div className="mt-8 flex h-48 items-end gap-1.5 sm:gap-3">
          {stats?.dailyDMs.map((day) => <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-xs font-semibold text-muted">{day.count}</span><div className="w-full min-h-1 rounded-t-lg bg-gradient-to-t from-accent to-indigo-400" style={{ height: `${Math.max((day.count / maxDM) * 100, 4)}%` }} /><span className="w-full truncate text-center text-[10px] text-muted">{day.date}</span></div>)}
        </div>
      </article>

      <article className="app-card p-5 sm:p-6 lg:col-span-5">
        <p className="app-kicker">Performance</p><h2 className="mt-1 font-semibold text-foreground">Top keywords</h2>
        <div className="mt-5 space-y-2">{!stats?.topKeywords.length ? <p className="rounded-xl bg-surface-subtle px-4 py-8 text-center text-sm text-muted">Keyword matches will appear here.</p> : stats.topKeywords.map((keyword, index) => <div key={keyword.keyword} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-subtle"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-bold text-accent">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{keyword.keyword}</span><span className="text-sm tabular-nums text-muted">{keyword.count}</span></div>)}</div>
      </article>
    </section>

    <section className="app-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><p className="app-kicker">Live feed</p><h2 className="mt-1 font-semibold">Recent activity</h2></div><Link href="/logs" className="text-sm font-semibold text-accent hover:underline">See all</Link></div>
      <div className="divide-y divide-border">{!stats?.recentLogs.length ? <p className="px-5 py-12 text-center text-sm text-muted">Activity will appear after your first campaign event.</p> : stats.recentLogs.map((log) => <div key={log.id} className="flex items-center gap-3 px-5 py-4 sm:px-6"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name="inbox" size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">@{log.commenterName ?? "unknown"}</p><p className="truncate text-xs text-muted">{log.instagramAccount ? `@${log.instagramAccount.username} · ` : ""}{log.commentText}</p></div><StatusBadge status={log.status} /></div>)}</div>
    </section>
  </div>;
}
