"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import { createCoreApi } from "@/lib/core-api/client";
import { useRouter } from "next/navigation";

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ username: string }>>([]);
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const api = createCoreApi({ baseUrl: "" });
    api.auth.session()
      .then(() => {
        setSessionChecked(true);
        api.accounts.list()
          .then((payload) => setAccounts(payload.data.instagramAccounts))
          .catch(() => setAccounts([]));
      })
      .catch(() => { router.replace("/login"); router.refresh(); });
  }, [router]);

  if (!sessionChecked) return <div className="min-h-dvh bg-background" aria-label="Checking session" />;

  return (
    // h-dvh, not h-screen: on mobile browsers the URL bar eats into 100vh, which
    // would push the composer and pagination controls below the fold.
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          instagramUsername={accounts[0]?.username ?? null}
          instagramAccountCount={accounts.length}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 lg:px-8 py-5 sm:py-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
