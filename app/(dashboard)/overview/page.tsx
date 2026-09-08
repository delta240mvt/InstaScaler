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
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [followerHistory, setFollowerHistory] = useState<Array<{ date: string; followersCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { coreApi.accounts.list().then(({ data }) => { setAccounts(data.instagramAccounts); setSelected(data.selectedInstagramAccountId ?? ""); }).catch((error) => setError(error instanceof Error ? error.message : "Nie udało się wczytać kont.")).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    Promise.all([coreApi.accounts.overview(selected), coreApi.accounts.followerHistory(selected)])
      .then(([overview, history]) => { if (active) { setInsights((overview.data as { data?: Insight[] }).data ?? []); setFollowerHistory(history.data); setError(null); } })
      .catch((error) => { if (active) { setInsights([]); setFollowerHistory([]); setError(error instanceof Error ? error.message : "Nie udało się wczytać statystyk."); } });
    return () => { active = false; };
  }, [selected]);

  const chartData = useMemo(() => followerHistory.map((point, index) => ({ date: point.date.slice(0, 10), followers: point.followersCount, delta: index ? point.followersCount - followerHistory[index - 1].followersCount : null })), [followerHistory]);

  if (loading) return <div className="space-y-5"><div className="app-skeleton h-24 rounded-2xl" /><div className="app-skeleton h-72 rounded-2xl" /></div>;

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="app-kicker">Statystyki Instagrama</p><h1 className="app-page-title mt-2">Przegląd konta</h1><p className="app-page-description mt-2">Statystyki odbiorców i konta udostępniane przez Meta.</p></div>{accounts.length > 1 && <AccountSelect accounts={accounts} value={selected} onChange={(id) => { setInsights([]); setFollowerHistory([]); setSelected(id); }} includeAll={false} />}</header>
    {error && <p role="alert" className="app-card p-4 text-sm text-error">{error}</p>}
    {!selected ? <section className="app-card px-5 py-14 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon name="overview" /></div><h2 className="mt-4 font-semibold">Połącz Instagram, aby zobaczyć statystyki</h2><p className="mt-1 text-sm text-muted">Statystyki odbiorców pojawią się tutaj po połączeniu konta.</p></section> : <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{insights.length ? insights.map((item, index) => <StatCard key={`${item.name}-${index}`} label={({ reach: "Zasięg", profile_views: "Wyświetlenia profilu", accounts_engaged: "Zaangażowane konta", total_interactions: "Wszystkie interakcje", follows_and_unfollows: "Obserwowania i rezygnacje" } as Record<string, string>)[item.name ?? ""] ?? "Statystyka konta"} value={item.total_value?.value ?? item.values?.at(-1)?.value ?? "—"} />) : <div className="app-card col-span-2 px-5 py-10 text-center text-sm text-muted lg:col-span-4">Brak statystyk. Jeśli uprawnienia Meta się zmieniły, połącz konto ponownie.</div>}</section>
      <FollowerChart data={chartData} followers={chartData.at(-1)?.followers ?? null} />
    </>}
  </div>;
}
