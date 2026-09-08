"use client";

import Link from "next/link";

export default function ErrorPage({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <main className="grid min-h-dvh place-items-center px-6 py-12"><div className="app-card max-w-lg p-7"><p className="app-kicker">InstaScaler</p><h1 className="app-page-title mt-4">Nie udało się wyświetlić strony</h1><p className="app-page-description mt-4">Spróbuj ponownie. Jeśli problem się powtarza, wróć do panelu i sprawdź diagnostykę.</p><div className="mt-7 flex flex-wrap gap-3"><button onClick={unstable_retry} className="app-button app-button-primary">Spróbuj ponownie</button><Link href="/dashboard" className="app-button app-button-secondary">Wróć do panelu</Link></div></div></main>;
}
