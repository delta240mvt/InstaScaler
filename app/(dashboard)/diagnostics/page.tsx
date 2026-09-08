"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/status-badge";
import { createCoreApi } from "@/lib/core-api/client";

type Diagnostics = {
  jobRuns: Array<{ id: string; kind: string; status: string; startedAt: string; errorMessage?: string | null }>;
  operationalEvents: Array<{ id: string; level: string; source: string; message: string; createdAt: string }>;
  dailyCounters: Array<{ id: string; date: string; received: number; sent: number; failed: number; queueJobs: number; workflowSteps: number }>;
  globalBudgets: Array<{ date: string; received: number; queueJobs: number; workflowSteps: number }>;
  accounts: Array<{ id: string; username: string; webhookSubscribed: boolean; requiresReconnect: boolean; lastErrorCode?: string | null; tokenExpiresAt?: string | null }>;
  failedJobs: Array<{ externalId: string; kind: string; firstSeenAt: string; instagramAccount?: { username?: string | null } | null }>;
  database: { bytes: number; level: string };
};

const labels: Record<string, string> = { COMMENT: "Komentarz", POSTBACK: "Naciśnięcie przycisku", MESSAGE: "Wiadomość", FOLLOW_UP: "Wiadomość uzupełniająca", RECOVER_R2: "Odzyskiwanie zdarzeń", RECONCILE: "Uzgadnianie zdarzeń", REFRESH_TOKENS: "Odświeżanie połączeń", ATTACH_NEXT_REEL: "Przypisanie następnej rolki", SNAPSHOT_FOLLOWERS: "Pomiar obserwujących", RETENTION: "Usuwanie starych danych", INFO: "Informacja", WARNING: "Ostrzeżenie", ERROR: "Błąd", normal: "W normie", warning: "Zbliżasz się do limitu", critical: "Przekroczono próg krytyczny", ok: "W normie" };

function BudgetBar({ label, value, limit }: { label: string; value: number; limit: number }) {
  const percent = Math.min(100, Math.round(value / limit * 100));
  return <div><div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium">{label}</span><span className="tabular-nums text-muted">{value.toLocaleString("pl-PL")} / {limit.toLocaleString("pl-PL")}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className={`h-full rounded-full ${percent >= 85 ? "bg-warning" : "bg-accent"}`} style={{ width: `${percent}%` }} /></div></div>;
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function refresh() { setError(null); try { setData((await createCoreApi({ baseUrl: "" }).diagnostics()).data as Diagnostics); } catch { setError("Nie udało się wczytać diagnostyki."); } }
  async function replay(externalId: string) { setError(null); setBusy(externalId); try { await createCoreApi({ baseUrl: "" }).replayJob(externalId); await refresh(); } catch { setError("Nie udało się dodać zadania do ponowienia."); } finally { setBusy(null); } }
  useEffect(() => { let active = true; createCoreApi({ baseUrl: "" }).diagnostics().then((payload) => { if (active) setData(payload.data as Diagnostics); }).catch(() => { if (active) setError("Nie udało się wczytać diagnostyki."); }); return () => { active = false; }; }, []);
  const budget = data?.globalBudgets[0];

  return <div className="mx-auto max-w-5xl space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="app-kicker">Stan systemu</p><h1 className="app-page-title mt-2">Diagnostyka</h1><p className="app-page-description mt-2">Stan usług i wykorzystanie bezpłatnych limitów.</p></div><button onClick={() => void refresh()} className="app-button app-button-secondary w-full sm:w-auto">Odśwież dane</button></header>
    {error && <p role="alert" className="rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</p>}
    {!data ? <div className="app-skeleton h-48 rounded-2xl" /> : <>
      <section className="grid gap-4 md:grid-cols-3"><div className="app-card p-5"><p className="app-kicker">Baza danych</p><p className="mt-3 text-2xl font-bold">{(data.database.bytes / 1024 / 1024).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} MB</p><p className="mt-1 text-xs text-muted">{labels[data.database.level] ?? "Stan niedostępny"}</p></div><div className="app-card p-5 md:col-span-2"><p className="app-kicker">Wykorzystanie bezpłatnego planu</p>{budget ? <div className="mt-4 grid gap-4 sm:grid-cols-3"><BudgetBar label="Zdarzenia" value={budget.received} limit={1000} /><BudgetBar label="Operacje kolejki" value={budget.queueJobs} limit={9500} /><BudgetBar label="Kroki procesów" value={budget.workflowSteps} limit={2800} /></div> : <p className="mt-3 text-sm text-muted">Dziś nie zarejestrowano zużycia.</p>}</div></section>
      <section className="app-card p-5 sm:p-6"><h2 className="font-semibold">Połączenia z Instagramem</h2><div className="mt-4 divide-y divide-border">{data.accounts.map((account) => <div key={account.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold">@{account.username}</span><span className={account.requiresReconnect ? "text-error" : "text-muted"}>{account.requiresReconnect ? `Połącz konto ponownie · ${account.lastErrorCode ?? "błąd tokenu"}` : account.webhookSubscribed ? "Połączono · odbieranie zdarzeń aktywne" : "Odbieranie zdarzeń nieaktywne"}</span></div>)}</div></section>
      <div className="grid gap-4 lg:grid-cols-2"><section className="app-card p-5 sm:p-6"><h2 className="font-semibold">Ostatnie zadania</h2><div className="mt-4 divide-y divide-border">{data.jobRuns.length ? data.jobRuns.map((run) => <div key={run.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="truncate">{labels[run.kind] ?? "Zadanie systemowe"}</span><StatusBadge status={run.status} /></div>) : <p className="py-6 text-sm text-muted">Nie uruchomiono jeszcze żadnych zadań.</p>}</div></section>
      <section className="app-card p-5 sm:p-6"><h2 className="font-semibold">Nieudane zadania do ponowienia</h2><div className="mt-4 divide-y divide-border">{data.failedJobs.length ? data.failedJobs.map((job) => <div key={job.externalId} className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{labels[job.kind] ?? "Zadanie systemowe"} · @{job.instagramAccount?.username ?? "nieznany"}</span><button onClick={() => void replay(job.externalId)} disabled={busy === job.externalId} className="app-button app-button-secondary min-h-10 text-xs disabled:opacity-50">{busy === job.externalId ? "Dodawanie do kolejki…" : "Ponów"}</button></div>) : <p className="py-6 text-sm text-muted">Brak zadań do ponowienia.</p>}</div></section></div>
      <section className="app-card p-5 sm:p-6"><h2 className="font-semibold">Nierozwiązane zdarzenia systemowe</h2><div className="mt-4 divide-y divide-border">{data.operationalEvents.length ? data.operationalEvents.map((event) => <div key={event.id} className="py-3 text-sm"><strong>{labels[event.level] ?? "Zdarzenie"}</strong><span className="text-muted"> · {event.message.startsWith("Account workflow ") ? "Nie udało się wykonać zadania dla konta." : event.message.startsWith("Daily budget ") ? "Osiągnięto dzienny limit operacji." : "Zdarzenie wymaga sprawdzenia diagnostyki systemu."}</span></div>) : <p className="py-6 text-sm text-muted">Brak nierozwiązanych incydentów.</p>}</div></section>
    </>}
  </div>;
}
