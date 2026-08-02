"use client";

import { useEffect, useState } from "react";
import AccountSelect from "@/components/account-select";
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
    coreApi.accounts.overview(selected).then(({ data }) => {
      const resource = data as { data?: Insight[] };
      setInsights(resource.data ?? []);
    }).catch(() => setInsights([]));
    coreApi.accounts.followerHistory(selected).then(({ data }) => setFollowerHistory(data)).catch(() => setFollowerHistory([]));
  }, [selected]);
  if (loading) return <div className="panel h-64 rounded" />;
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><h1 className="text-2xl font-bold">Instagram overview</h1><p className="text-sm text-muted">Account insights reported by Meta.</p></div>{accounts.length > 1 && <AccountSelect accounts={accounts} value={selected} onChange={setSelected} includeAll={false} />}</div>
    {!selected ? <div className="panel rounded p-8 text-sm text-muted">Connect Instagram to view insights.</div> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{insights.length ? insights.map((item, index) => <div key={`${item.name}-${index}`} className="panel rounded p-5"><p className="text-sm text-muted">{item.title ?? item.name ?? "Metric"}</p><p className="mt-2 text-3xl font-bold">{item.total_value?.value ?? item.values?.at(-1)?.value ?? "—"}</p></div>) : <div className="panel rounded p-8 text-sm text-muted sm:col-span-2">No insights returned. Reconnect the account if Meta permissions changed.</div>}</div><section className="panel rounded p-5"><h2 className="font-semibold">Follower history</h2>{followerHistory.length ? <div className="mt-4 flex flex-wrap gap-3">{followerHistory.slice(-14).map((point) => <div key={point.date} className="rounded border border-border px-3 py-2 text-sm"><span className="text-muted">{point.date}</span><strong className="ml-2">{point.followersCount}</strong></div>)}</div> : <p className="mt-3 text-sm text-muted">Follower snapshots will appear after the daily workflow runs.</p>}</section></>}
  </div>;
}
