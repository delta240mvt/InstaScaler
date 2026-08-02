"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import { createCoreApi } from "@/lib/core-api/client";
import type { InstagramAccountSummary } from "@/lib/core-api/contracts";
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

  if (loading) return <div className="panel h-64 rounded p-8" />;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Suspense fallback={null}><InstagramConnectNotice /></Suspense>

      <section className="panel rounded p-4 sm:p-6">
        <h2 className="mb-2 text-base font-semibold">Instagram accounts</h2>
        <p className="mb-6 text-sm text-muted">Connect up to five professional accounts.</p>
        <div className="space-y-3">
          {accounts.length === 0 && <p className="text-sm text-muted">No account connected.</p>}
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between gap-3 rounded border border-border p-4">
              <div>
                <p className="text-sm font-semibold">@{account.username}</p>
                <p className="text-xs text-muted">{account.webhookSubscribed ? "Webhook ready" : "Webhook pending"}</p>
              </div>
              <button
                type="button"
                disabled={busy === account.id}
                onClick={() => void disconnectInstagram(account.id)}
                className="rounded border border-error/20 px-3 py-2 text-sm text-error disabled:opacity-50"
              >
                {busy === account.id ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ))}
        </div>
        {accounts.length < 5 && (
          <a href="/api/instagram/connect" className="mt-6 inline-flex rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
            {accounts.length ? "Connect another account" : "Connect Instagram"}
          </a>
        )}
      </section>

      <section className="panel rounded p-4 sm:p-6">
        <h2 className="mb-2 text-base font-semibold">Administrator session</h2>
        <p className="mb-5 text-sm text-muted">This private installation has one login and no team management.</p>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={busy === "logout"}
          className="rounded border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy === "logout" ? "Signing out..." : "Sign out"}
        </button>
      </section>
    </div>
  );
}
