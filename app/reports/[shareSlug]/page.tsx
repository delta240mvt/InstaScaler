"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createCoreApi } from "@/lib/core-api/client";

type PublicReport = {
  name: string; goal: string | null; createdAt: string;
  instagramAccount: { username: string; name: string | null };
  trackedLinks: Array<{ id: string; slug: string; label: string | null; destinationUrl: string; _count: { clicks: number } }>;
  dmLogs: Array<{ status: string; matchedKeyword: string | null; createdAt: string }>;
};

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="panel rounded p-5"><p className="text-xs uppercase tracking-wide text-muted">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>;
}

export default function ReportPage() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [report, setReport] = useState<PublicReport | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    createCoreApi({ baseUrl: "" }).reports.get(shareSlug)
      .then((payload) => setReport(payload.data as PublicReport))
      .catch(() => setMissing(true));
  }, [shareSlug]);
  const metrics = useMemo(() => {
    const logs = report?.dmLogs ?? [];
    const sent = logs.filter((item) => item.status === "SENT").length;
    const skipped = logs.filter((item) => item.status === "SKIPPED").length;
    const failed = logs.filter((item) => item.status === "FAILED").length;
    const clicks = (report?.trackedLinks ?? []).reduce((sum, link) => sum + link._count.clicks, 0);
    return { sent, skipped, failed, clicks, ctr: sent ? Math.round(clicks / sent * 1000) / 10 : 0 };
  }, [report]);

  if (missing) return <main className="mx-auto max-w-2xl px-6 py-20"><h1 className="text-2xl font-bold">Report not found</h1></main>;
  if (!report) return <main className="mx-auto max-w-6xl px-6 py-20 text-muted">Loading report…</main>;
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-5 py-10 sm:px-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Public campaign report</p>
        <h1 className="mt-3 text-4xl font-black">{report.name}</h1>
        <p className="mt-2 text-muted">@{report.instagramAccount.username}{report.goal ? ` · ${report.goal}` : ""}</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="DMs sent" value={metrics.sent} /><Metric label="Skipped" value={metrics.skipped} />
        <Metric label="Failed" value={metrics.failed} /><Metric label="Clicks" value={metrics.clicks} />
        <Metric label="CTR" value={`${metrics.ctr}%`} />
      </section>
      <section className="panel rounded p-5">
        <h2 className="text-lg font-semibold">Tracked links</h2>
        <div className="mt-4 space-y-3">{report.trackedLinks.length ? report.trackedLinks.map((link) => <div key={link.id} className="flex justify-between border-b border-border pb-3"><span className="truncate text-muted">{link.label || link.destinationUrl}</span><strong>{link._count.clicks}</strong></div>) : <p className="text-sm text-muted">No tracked links.</p>}</div>
      </section>
    </main>
  );
}
