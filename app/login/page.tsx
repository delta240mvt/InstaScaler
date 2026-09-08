import Link from "next/link";
import AdminLoginForm from "@/components/admin-login-form";
import { Icon } from "@/components/ui-icons";
import { safeCallbackUrl } from "@/lib/admin-auth/callback-url";

export const metadata = { title: "Logowanie — InstaScaler", description: "Zaloguj się do panelu kampanii i wiadomości na Instagramie." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);
  return <main className="editorial-canvas min-h-dvh lg:grid lg:grid-cols-2">
    <section className="relative flex flex-col justify-between overflow-hidden border-b border-foreground bg-foreground px-6 py-8 text-background sm:px-10 lg:min-h-dvh lg:border-b-0 lg:border-r lg:p-12 xl:p-16">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xl font-black tracking-[-0.055em]">DELTA240MVT<span style={{ color: "var(--color-accent)" }}> /</span></span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-background/60">InstaScaler</span>
      </div>
      <div className="max-w-xl py-12 lg:py-16">
        <p className="mb-6 inline-block bg-yellow px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground">Komentarz to początek.</p>
        <h1 className="text-[clamp(2.7rem,5.2vw,5.8rem)] font-extrabold uppercase leading-[1.05] tracking-[-0.035em]">Zamień<br />komentarze<br /><span style={{ color: "var(--color-accent)" }}>w rozmowy.</span></h1>
        <p className="mt-7 max-w-sm font-mono text-sm leading-7 text-background/75">Twoje kampanie, wiadomości i materiały. W jednym miejscu, pod Twoją kontrolą.</p>
      </div>
      <div className="hidden grid-cols-3 border-t border-background/25 pt-5 font-mono text-[10px] uppercase tracking-wider lg:grid">
        {["01 / Kampanie", "02 / Wiadomości", "03 / Wyniki"].map((label) => <span key={label}>{label}</span>)}
      </div>
    </section>
    <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:py-16">
      <div className="w-full max-w-[420px]">
        <p className="app-kicker">Panel administratora</p>
        <h2 className="app-page-title mt-4">Dobrze Cię<br />widzieć.</h2>
        <p className="mt-4 text-sm leading-6 text-muted">Zaloguj się, aby zarządzać kampaniami i rozmowami na Instagramie.</p>
        <div className="mt-9"><AdminLoginForm callbackUrl={callbackUrl} /></div>
        <p className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted"><Icon name="check" size={14} className="text-success" />Dostęp tylko dla administratora</p>
        <nav aria-label="Informacje o aplikacji" className="mt-6 flex flex-wrap gap-x-5 gap-y-3 font-mono text-[10px] text-muted">
          <Link href="/privacy" className="underline underline-offset-4">Prywatność</Link>
          <Link href="/terms" className="underline underline-offset-4">Regulamin</Link>
          <Link href="/data-deletion" className="underline underline-offset-4">Usuwanie danych</Link>
        </nav>
      </div>
    </section>
  </main>;
}
