"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import { createCoreApi } from "@/lib/core-api/client";
import type { InstagramAccountSummary } from "@/lib/core-api/contracts";
import { Icon } from "@/components/ui-icons";
const coreApi = createCoreApi({ baseUrl: "" });

export default function SettingsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<InstagramAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    coreApi.accounts.list()
      .then((payload) => setAccounts(payload.data.instagramAccounts))
      .finally(() => setLoading(false));
  }, []);

  async function disconnectInstagram(id: string) {
    if (!confirm("Disconnect Instagram? Campaigns for this account will stop sending DMs.")) return;
    setBusy(id);
    try {
      await coreApi.accounts.disconnect(id);
      setAccounts((current) => current.filter((account) => account.id !== id));
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    setBusy("logout");
    try {
      await coreApi.auth.logout();
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="app-skeleton h-64 rounded-2xl" />;

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header><p className="app-kicker">Workspace</p><h1 className="app-page-title mt-2">Settings</h1><p className="app-page-description mt-2">Manage Instagram connections and your private administrator session.</p></header>
      <Suspense fallback={null}><InstagramConnectNotice /></Suspense>

      <section className="app-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name="instagram" size={19} /></span><h2 className="text-base font-semibold">Instagram accounts</h2></div>
        <p className="mb-6 text-sm text-muted">Connect up to five professional accounts.</p>
        <div className="space-y-3">
          {accounts.length === 0 && <p className="text-sm text-muted">No account connected.</p>}
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">@{account.username}</p>
                <p className="text-xs text-muted">{account.webhookSubscribed ? "Webhook ready" : "Webhook pending"}</p>
              </div>
              <button
                type="button"
                disabled={busy === account.id}
                onClick={() => void disconnectInstagram(account.id)}
                className="app-button app-button-danger w-full disabled:opacity-50 sm:w-auto"
              >
                {busy === account.id ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ))}
        </div>
        {accounts.length < 5 && (
          <a href="/api/instagram/connect" className="app-button app-button-primary mt-6 w-full sm:w-auto">
            {accounts.length ? "Connect another account" : "Connect Instagram"}
          </a>
        )}
      </section>

      <section className="app-card border-error/15 p-5 sm:p-6">
        <h2 className="mb-2 text-base font-semibold">Administrator session</h2>
        <p className="mb-5 text-sm text-muted">This private installation has one login and no team management.</p>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={busy === "logout"}
          className="app-button app-button-secondary w-full disabled:opacity-50 sm:w-auto"
        >
          {busy === "logout" ? "Signing out..." : "Sign out"}
        </button>
      </section>
    </div>
  );
}
