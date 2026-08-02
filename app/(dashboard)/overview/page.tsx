"use client";

import { useEffect, useMemo, useState } from "react";
import AccountSelect from "@/components/account-select";
import FollowerChart from "@/components/follower-chart";
import StatCard from "@/components/stat-card";
import { Icon } from "@/components/ui-icons";
import { createCoreApi } from "@/lib/core-api/client";
import type { InstagramAccountSummary } from "@/lib/core-api/contracts";

type Insight = { name?: string; title?: string; values?: Array<{ value?: number; end_time?: string }>; total_value?: { value?: number } };
const coreApi = createCoreApi({ baseUrl: "" });

export default function OverviewPage() {
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [followerHistory, setFollowerHistory] = useState<Array<{ date: string; followersCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { coreApi.accounts.list().then(({ data }) => { setAccounts(data.instagramAccounts); setSelected(data.selectedInstagramAccountId ?? ""); }).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!selected) return;
    coreApi.accounts.overview(selected).then(({ data }) => setInsights((data as { data?: Insight[] }).data ?? [])).catch(() => setInsights([]));
    coreApi.accounts.followerHistory(selected).then(({ data }) => setFollowerHistory(data)).catch(() => setFollowerHistory([]));
  }, [selected]);

  const chartData = useMemo(() => followerHistory.map((point, index) => ({ date: point.date.slice(0, 10), followers: point.followersCount, delta: index ? point.followersCount - followerHistory[index - 1].followersCount : null })), [followerHistory]);

  if (loading) return <div className="space-y-5"><div className="app-skeleton h-24 rounded-2xl" /><div className="app-skeleton h-72 rounded-2xl" /></div>;

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="app-kicker">Instagram insights</p><h1 className="app-page-title mt-2">Account overview</h1><p className="app-page-description mt-2">Audience health and account metrics reported by Meta.</p></div>{accounts.length > 1 && <AccountSelect accounts={accounts} value={selected} onChange={setSelected} includeAll={false} />}</header>
    {!selected ? <section className="app-card px-5 py-14 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon name="overview" /></div><h2 className="mt-4 font-semibold">Connect Instagram to see insights</h2><p className="mt-1 text-sm text-muted">Your audience metrics will appear here after connecting an account.</p></section> : <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{insights.length ? insights.map((item, index) => <StatCard key={`${item.name}-${index}`} label={item.title ?? item.name ?? "Metric"} value={item.total_value?.value ?? item.values?.at(-1)?.value ?? "—"} />) : <div className="app-card col-span-2 px-5 py-10 text-center text-sm text-muted lg:col-span-4">No insights returned. Reconnect the account if Meta permissions changed.</div>}</section>
      <FollowerChart data={chartData} followers={chartData.at(-1)?.followers ?? null} />
    </>}
  </div>;
}
