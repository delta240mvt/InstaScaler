"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui-icons";
import { createCoreApi } from "@/lib/core-api/client";
import { CoreApiError } from "@/lib/core-api/errors";

type PublicReport = { name: string; goal: string | null; instagramAccount: { username: string }; trackedLinks: Array<{ id: string; label: string | null; destinationUrl: string; _count: { clicks: number } }>; analytics: { sent: number; skipped: number; failed: number; clicks: number; ctr: number } };

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="app-card p-4 sm:p-5"><p className="app-kicker">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{typeof value === "number" ? value.toLocaleString("pl-PL") : value}</p></div>;
}

export default function ReportPage() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [report, setReport] = useState<PublicReport | null>(null);
  const [error, setError] = useState<"missing" | "unavailable" | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    createCoreApi({ baseUrl: "" }).reports.get(shareSlug)
      .then((payload) => { if (!cancelled) { setReport(payload.data as PublicReport); setError(null); } })
      .catch((caught) => { if (!cancelled) setError(caught instanceof CoreApiError && caught.status === 404 ? "missing" : "unavailable"); });
    return () => { cancelled = true; };
  }, [shareSlug, attempt]);

  if (error) return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="app-card max-w-md p-8 text-center"><Icon name="diagnostics" className="mx-auto" /><h1 className="app-page-title mt-5">{error === "missing" ? "Nie znaleziono raportu" : "Raport jest chwilowo niedostępny"}</h1><p className="mt-3 text-sm text-muted">{error === "missing" ? "Link jest nieprawidłowy lub udostępnianie zostało wyłączone." : "Nie udało się pobrać danych. Spróbuj ponownie za chwilę."}</p>{error === "unavailable" && <button className="app-button app-button-primary mt-5" onClick={() => { setError(null); setReport(null); setAttempt((value) => value + 1); }}>Spróbuj ponownie</button>}</div></main>;
  if (!report) return <main aria-label="Wczytywanie raportu" aria-busy="true" className="mx-auto min-h-screen max-w-6xl space-y-5 bg-background px-5 py-10 sm:px-8"><div className="app-skeleton h-28" /><div className="app-skeleton h-40" /></main>;
  const metrics = report.analytics;
  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8 sm:py-12">
    <nav aria-label="InstaScaler" className="flex items-center justify-between border-b border-foreground pb-5"><Link href="/login" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center border border-foreground bg-accent text-foreground"><Icon name="campaigns" size={18} /></span><span className="text-xl font-black tracking-tight">InstaScaler</span></Link><span className="font-mono text-[10px] text-muted">DELTA240MVT</span></nav>
    <header className="border-l-4 border-accent py-3 pl-5"><p className="app-kicker">Publiczny raport kampanii</p><h1 className="app-page-title mt-3">{report.name}</h1><p className="app-page-description mt-2">@{report.instagramAccount.username}{report.goal ? ` · ${report.goal}` : ""}</p></header>
    <section aria-label="Wyniki kampanii" className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Metric label="Wysłane wiadomości" value={metrics.sent} /><Metric label="Pominięte" value={metrics.skipped} /><Metric label="Błędy" value={metrics.failed} /><Metric label="Kliknięcia" value={metrics.clicks} /><Metric label="Współczynnik kliknięć" value={`${metrics.ctr.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`} /></section>
    <section className="app-card p-5 sm:p-6"><p className="app-kicker">Zaangażowanie</p><h2 className="mt-1 text-lg font-bold">Śledzone linki</h2><div className="mt-5 divide-y divide-border">{report.trackedLinks.length ? report.trackedLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 break-all text-sm text-muted">{link.label || link.destinationUrl}</span><strong className="bg-accent-soft px-2.5 py-1 text-sm text-accent">{link._count.clicks.toLocaleString("pl-PL")}</strong></div>) : <p className="py-8 text-center text-sm text-muted">Ta kampania nie ma jeszcze śledzonych linków.</p>}</div></section>
    <footer className="pb-4 text-center font-mono text-[10px] text-muted">Wyniki kampanii z InstaScaler / DELTA240MVT</footer>
  </div></main>;
}
