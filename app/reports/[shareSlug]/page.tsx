"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/ui-icons";
import { createCoreApi } from "@/lib/core-api/client";

type PublicReport = { name: string; goal: string | null; createdAt: string; instagramAccount: { username: string; name: string | null }; trackedLinks: Array<{ id: string; slug: string; label: string | null; destinationUrl: string; _count: { clicks: number } }>; dmLogs: Array<{ status: string; matchedKeyword: string | null; createdAt: string }> };

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="app-card p-4 sm:p-5"><p className="app-kicker">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p></div>;
}

export default function ReportPage() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [report, setReport] = useState<PublicReport | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { createCoreApi({ baseUrl: "" }).reports.get(shareSlug).then((payload) => setReport(payload.data as PublicReport)).catch(() => setMissing(true)); }, [shareSlug]);
  const metrics = useMemo(() => {
    const logs = report?.dmLogs ?? [];
    const sent = logs.filter((item) => item.status === "SENT").length;
    const skipped = logs.filter((item) => item.status === "SKIPPED").length;
    const failed = logs.filter((item) => item.status === "FAILED").length;
    const clicks = (report?.trackedLinks ?? []).reduce((sum, link) => sum + link._count.clicks, 0);
    return { sent, skipped, failed, clicks, ctr: sent ? Math.round(clicks / sent * 1000) / 10 : 0 };
  }, [report]);

  if (missing) return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="app-card max-w-md p-8 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon name="diagnostics" /></div><h1 className="app-page-title mt-5">Report not found</h1><p className="mt-2 text-sm text-muted">This link may have expired or sharing was disabled.</p></div></main>;
  if (!report) return <main className="mx-auto min-h-screen max-w-6xl space-y-5 bg-background px-5 py-10 sm:px-8"><div className="app-skeleton h-28 rounded-2xl" /><div className="app-skeleton h-40 rounded-2xl" /></main>;

  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8 sm:py-12">
    <nav className="flex items-center gap-2 text-sm font-bold tracking-tight"><span className="flex size-9 items-center justify-center rounded-xl bg-accent text-white"><Icon name="campaigns" size={18} /></span><span className="font-serif text-xl font-medium tracking-[-0.04em]">InstaScaler</span></nav>
    <header className="app-card relative overflow-hidden p-6 sm:p-8"><div className="absolute -right-16 -top-20 size-56 rounded-full bg-accent-soft blur-2xl" /><div className="relative"><p className="app-kicker">Public campaign report</p><h1 className="app-page-title mt-3 sm:text-4xl">{report.name}</h1><p className="app-page-description mt-2">@{report.instagramAccount.username}{report.goal ? ` · ${report.goal}` : ""}</p></div></header>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Metric label="DMs sent" value={metrics.sent} /><Metric label="Skipped" value={metrics.skipped} /><Metric label="Failed" value={metrics.failed} /><Metric label="Clicks" value={metrics.clicks} /><Metric label="CTR" value={`${metrics.ctr}%`} /></section>
    <section className="app-card p-5 sm:p-6"><div><p className="app-kicker">Engagement</p><h2 className="mt-1 text-lg font-semibold">Tracked links</h2></div><div className="mt-5 divide-y divide-border">{report.trackedLinks.length ? report.trackedLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 truncate text-sm text-muted">{link.label || link.destinationUrl}</span><strong className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm text-accent">{link._count.clicks}</strong></div>) : <p className="py-8 text-center text-sm text-muted">No tracked links yet.</p>}</div></section>
    <footer className="pb-4 text-center text-xs text-muted">Campaign analytics powered by InstaScaler</footer>
  </div></main>;
}
