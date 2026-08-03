import AdminLoginForm from "@/components/admin-login-form";
import { Icon } from "@/components/ui-icons";
import { safeCallbackUrl } from "@/lib/admin-auth/callback-url";

export const metadata = { title: "Sign in - InstaScaler", description: "Sign in to manage Instagram growth campaigns." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);
  return <main className="editorial-canvas relative min-h-dvh overflow-hidden px-4 py-5 sm:px-6 sm:py-8 lg:grid lg:grid-cols-2 lg:gap-8">
    <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-accent/10 blur-3xl" />
    <section className="relative hidden overflow-hidden rounded-[30px] border border-border bg-surface p-10 lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-between xl:p-14">
      <div aria-hidden="true" className="absolute -right-24 top-1/3 h-80 w-80 rounded-full border border-accent/15 bg-accent/5" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white"><Icon name="sparkles" size={20} /></span>
        <span className="font-serif text-xl font-medium tracking-[-0.04em]">minbestedag@!</span>
      </div>
      <div className="relative max-w-xl pb-10">
        <p className="app-kicker mb-5">Creative growth studio</p>
        <h1 className="font-serif text-5xl font-medium leading-[1.03] tracking-[-0.055em] text-foreground xl:text-6xl">Scale the conversations that grow your Instagram.</h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-muted">A quieter workspace for campaigns, DMs, follower gates and the operational details that keep your growth intentional.</p>
      </div>
      <div className="relative grid grid-cols-3 gap-3">
        {["Private by design", "Meta-ready", "Built to scale"].map((label) => <div key={label} className="rounded-2xl border border-border bg-background/65 px-4 py-3 text-xs font-semibold text-muted">{label}</div>)}
      </div>
    </section>

    <section className="relative flex min-h-[calc(100dvh-2.5rem)] items-center justify-center py-6 lg:min-h-0 lg:py-0">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20"><Icon name="sparkles" size={19} /></span>
          <span className="font-serif text-xl font-medium tracking-[-0.04em]">minbestedag@!</span>
        </div>
        <div className="app-card p-5 shadow-[var(--app-shadow-lg)] sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <p className="app-kicker">Welcome back</p>
          <h2 className="mt-3 font-serif text-4xl font-medium tracking-[-0.045em] text-foreground sm:text-[2.4rem]">Your growth workspace</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in to manage campaigns, conversations and delivery health.</p>
          <div className="mt-8"><AdminLoginForm callbackUrl={callbackUrl} /></div>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted"><Icon name="check" size={14} className="text-success" />Secure, single-administrator access</p>
      </div>
    </section>
  </main>;
}
