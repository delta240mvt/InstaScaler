"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import { createCoreApi } from "@/lib/core-api/client";
import type { InstagramAccountSummary } from "@/lib/core-api/contracts";
import { Icon } from "@/components/ui-icons";
import { clearClientCache } from "@/lib/client-cache";
import { getPolishErrorMessage } from "@/lib/core-api/errors";
const coreApi = createCoreApi({ baseUrl: "" });

export default function SettingsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    coreApi.accounts.list()
      .then((payload) => setAccounts(payload.data.instagramAccounts))
      .catch((error) => setError(error instanceof Error ? error.message : getPolishErrorMessage(null)))
      .finally(() => setLoading(false));
  }, []);

  async function disconnectInstagram(id: string) {
    if (!confirm("Odłączyć Instagram? Kampanie tego konta przestaną wysyłać wiadomości.")) return;
    setBusy(id);
    try {
      await coreApi.accounts.disconnect(id);
      clearClientCache();
      setAccounts((current) => current.filter((account) => account.id !== id));
    } catch (error) {
      setError(error instanceof Error ? error.message : getPolishErrorMessage(null));
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    setBusy("logout");
    try {
      await coreApi.auth.logout();
      clearClientCache();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : getPolishErrorMessage(null));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="app-skeleton h-64 rounded-2xl" />;

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header><p className="app-kicker">Panel</p><h1 className="app-page-title mt-2">Ustawienia</h1><p className="app-page-description mt-2">Zarządzaj połączeniami z Instagramem i sesją administratora.</p></header>
      {error && <p role="alert" className="app-card p-4 text-sm text-error">{error}</p>}
      <Suspense fallback={null}><InstagramConnectNotice /></Suspense>

      <section className="app-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name="instagram" size={19} /></span><h2 className="text-base font-semibold">Konta Instagram</h2></div>
        <p className="mb-6 text-sm text-muted">Możesz połączyć maksymalnie pięć kont profesjonalnych.</p>
        <div className="space-y-3">
          {accounts.length === 0 && <p className="text-sm text-muted">Nie połączono żadnego konta.</p>}
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">@{account.username}</p>
                <p className="text-xs text-muted">{account.webhookSubscribed ? "Odbieranie zdarzeń aktywne" : "Oczekiwanie na aktywację zdarzeń"}</p>
              </div>
              <button
                type="button"
                disabled={busy === account.id}
                onClick={() => void disconnectInstagram(account.id)}
                className="app-button app-button-danger w-full disabled:opacity-50 sm:w-auto"
              >
                {busy === account.id ? "Odłączanie…" : "Odłącz"}
              </button>
            </div>
          ))}
        </div>
        {accounts.length < 5 && (
          <button type="button" onClick={() => window.location.assign("/api/instagram/connect")} className="app-button app-button-primary mt-6 w-full sm:w-auto">
            {accounts.length ? "Połącz kolejne konto" : "Połącz Instagram"}
          </button>
        )}
      </section>

      <section className="app-card border-error/15 p-5 sm:p-6">
        <h2 className="mb-2 text-base font-semibold">Sesja administratora</h2>
        <p className="mb-5 text-sm text-muted">Ta prywatna instalacja ma jedno konto administratora.</p>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={busy === "logout"}
          className="app-button app-button-secondary w-full disabled:opacity-50 sm:w-auto"
        >
          {busy === "logout" ? "Wylogowywanie…" : "Wyloguj się"}
        </button>
      </section>
    </div>
  );
}
