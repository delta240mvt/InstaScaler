"use client";

import { coreFetch } from "@/lib/core-api/client";

/**
 * Import Campaigns Page
 *
 * Paste a CSV of everything except the post. Each row is queued and opened in
 * the campaign builder prefilled and editable, one at a time, so you review
 * each campaign and pick its reel before saving.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { parseCsv } from "@/lib/utils/csv";
import { IMPORT_QUEUE_KEY, IMPORT_ACCOUNT_KEY } from "@/lib/import-queue";

const SAMPLE = `keywords,dm_message,public_reply,tracked_url,opening_dm,opening_dm_button
"PORADNIK","Oto Twój poradnik: {link}","Sprawdź wiadomości prywatne","https://example.com/poradnik","Cześć! Naciśnij przycisk, aby otrzymać poradnik","Wyślij link"
"LINK,SKLEP","Znajdziesz to tutaj: {link}","Wiadomość już czeka",,,`;

export default function ImportCampaignsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coreFetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if ((payload.data !== undefined)) {
          const next = payload.data.instagramAccounts ?? [];
          setAccounts(next);
          setSelectedAccountId(next[0]?.id ?? "");
        }
      })
      .catch(() => setAccounts([]));
  }, []);

  function startImport() {
    setError(null);
    const parsed = parseCsv(csv);
    if (parsed.length === 0) {
      setError("Wklej CSV z nagłówkiem i co najmniej jedną kampanią.");
      return;
    }

    const rows = [];
    for (let i = 0; i < parsed.length; i++) {
      const r = parsed[i];
      const keywords = (r.keywords ?? "")
        .split(/[,;]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10);
      const dmMessage = (r.dm_message ?? r.message ?? "").trim();
      if (keywords.length === 0 || !dmMessage) {
        setError(`W wierszu ${i + 1} brakuje słów kluczowych lub wiadomości.`);
        return;
      }
      rows.push({
        name: (r.name ?? "").trim(),
        keywords,
        dmMessage,
        publicReply: (r.public_reply ?? "").trim(),
        trackedUrl: (r.tracked_url ?? "").trim(),
        openingDmMessage: (r.opening_dm ?? "").trim(),
        openingDmButtonLabel: (r.opening_dm_button ?? "").trim(),
      });
    }

    try {
      window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(rows));
      if (selectedAccountId) {
        window.localStorage.setItem(IMPORT_ACCOUNT_KEY, selectedAccountId);
      }
    } catch {
      setError("Nie udało się przygotować importu w tej przeglądarce.");
      return;
    }
    router.push("/campaigns/new");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="app-kicker">Import zbiorczy</p>
        <h1 className="app-page-title mt-2">Import kampanii</h1>
        <p className="app-page-description mt-2">

          Wklej CSV z jedną kampanią w każdym wierszu. Wiersze otworzą się kolejno w edytorze, aby można było sprawdzić treść i wybrać rolkę przed zapisem. Wymagane kolumny:{" "}
          <code className="text-accent">keywords</code>  oraz{" "}
          <code className="text-accent">dm_message</code>. Opcjonalne:{" "}
          <code className="text-accent">name</code>,{" "}
          <code className="text-accent">public_reply</code>,{" "}
          <code className="text-accent">tracked_url</code>,{" "}
          <code className="text-accent">opening_dm</code>,{" "}
          <code className="text-accent">opening_dm_button</code>. Słowa kluczowe wpisz w jednej komórce, oddzielając je przecinkami. Użyj{" "}
          <code className="text-accent">{"{link}"}</code>  w wiadomości, aby wstawić śledzony link.
        </p>
      </header>

      {error && (
        <div className="p-4 rounded bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {accounts.length > 1 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">

            Konto Instagram
          </label>
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
            label="Konto"
          />
        </div>
      )}

      <section className="app-card space-y-3 p-5 sm:p-6">
        <label className="app-label" htmlFor="campaign-csv">Kampanie w formacie CSV</label>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={SAMPLE}
          rows={10}
          id="campaign-csv"
          className="app-field min-h-72 w-full resize-y px-4 py-3 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setCsv(SAMPLE)}
          className="text-xs text-muted hover:text-foreground"
        >

          Wstaw przykład
        </button>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <button
          onClick={startImport}
          className="app-button app-button-primary w-full sm:w-auto"
        >

          Sprawdź i importuj
        </button>
        <button
          onClick={() => router.push("/campaigns")}
          className="app-button app-button-secondary w-full sm:w-auto"
        >

          Anuluj
        </button>
      </div>
    </div>
  );
}
