"use client";

import { useEffect, useState } from "react";
import { createCoreApi } from "@/lib/core-api/client";

type Diagnostics = {
  jobRuns: Array<{ id: string; kind: string; status: string; startedAt: string; errorMessage?: string | null }>;
  operationalEvents: Array<{ id: string; level: string; source: string; message: string; createdAt: string }>;
  dailyCounters: Array<{ id: string; date: string; received: number; sent: number; failed: number; queueJobs: number; workflowSteps: number }>;
  database: { bytes: number; level: string };
};

export default function DiagnosticsPage() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function refresh() {
    setError(null);
    try { setData((await createCoreApi({ baseUrl: "" }).diagnostics()).data as Diagnostics); }
    catch { setError("Could not load diagnostics."); }
  }
  useEffect(() => {
    let active = true;
    createCoreApi({ baseUrl: "" }).diagnostics()
      .then((payload) => { if (active) setData(payload.data as Diagnostics); })
      .catch(() => { if (active) setError("Could not load diagnostics."); });
    return () => { active = false; };
  }, []);
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Diagnostics</h1><p className="text-sm text-muted">Core, Queue and Workflow state.</p></div><button onClick={() => void refresh()} className="rounded border border-border px-3 py-2 text-sm">Refresh</button></div>
    {error && <p className="text-error">{error}</p>}
    {!data ? <div className="panel h-48 rounded" /> : <>
      <section className="panel rounded p-5"><h2 className="font-semibold">Database</h2><p className="mt-2 text-sm text-muted">{(data.database.bytes / 1024 / 1024).toFixed(1)} MB · {data.database.level}</p></section>
      <section className="panel rounded p-5"><h2 className="font-semibold">Recent jobs</h2><div className="mt-4 space-y-2">{data.jobRuns.length ? data.jobRuns.map((run) => <div key={run.id} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><span>{run.kind}</span><span className="text-muted">{run.status}</span></div>) : <p className="text-sm text-muted">No job runs yet.</p>}</div></section>
      <section className="panel rounded p-5"><h2 className="font-semibold">Open operational events</h2><div className="mt-4 space-y-2">{data.operationalEvents.length ? data.operationalEvents.map((event) => <div key={event.id} className="border-b border-border py-2 text-sm"><strong>{event.level}</strong> · {event.message}</div>) : <p className="text-sm text-muted">No open incidents.</p>}</div></section>
    </>}
  </div>;
}
