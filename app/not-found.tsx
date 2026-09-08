import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-dvh place-items-center px-6 py-12"><div className="max-w-lg border-l-4 border-accent pl-6"><p className="app-kicker">InstaScaler / 404</p><h1 className="app-page-title mt-4">Nie znaleziono strony</h1><p className="app-page-description mt-4">Sprawdź adres lub wróć do panelu.</p><Link href="/dashboard" className="app-button app-button-primary mt-7">Wróć do panelu</Link></div></main>;
}
