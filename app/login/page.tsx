import AdminLoginForm from "@/components/admin-login-form";
import { Icon } from "@/components/ui-icons";
import { safeCallbackUrl } from "@/lib/admin-auth/callback-url";

export const metadata = { title: "Login - OpenReply", description: "Sign in to manage Instagram comment-to-DM campaigns." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);
  return <main className="relative min-h-dvh overflow-hidden bg-[#f6f7fb] px-4 py-5 sm:px-6 sm:py-8 lg:grid lg:grid-cols-2 lg:gap-6">
    <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-accent/8 blur-3xl" />
    <section className="relative hidden overflow-hidden rounded-[28px] bg-[#171d32] p-10 text-white lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:justify-between xl:p-14">
      <div aria-hidden="true" className="absolute -right-24 top-1/3 h-80 w-80 rounded-full border border-white/10 bg-white/[0.03]" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#22284a]"><Icon name="sparkles" size={20} /></span>
        <span className="text-base font-bold tracking-[-0.03em]">OpenReply</span>
      </div>
      <div className="relative max-w-xl pb-10">
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-[#a9aefa]">Private automation studio</p>
        <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-5xl">Turn every Instagram comment into a thoughtful conversation.</h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-white/60">One quiet workspace for campaigns, DMs, follower gates and the operational details that keep everything moving.</p>
      </div>
      <div className="relative grid grid-cols-3 gap-3">
        {["Private by design", "Cloudflare native", "Built for one"].map((label) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-medium text-white/70">{label}</div>)}
      </div>
    </section>

    <section className="relative flex min-h-[calc(100dvh-2.5rem)] items-center justify-center py-6 lg:min-h-0 lg:py-0">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20"><Icon name="sparkles" size={19} /></span>
          <span className="text-base font-bold tracking-[-0.03em]">OpenReply</span>
        </div>
        <div className="app-card p-5 shadow-[var(--app-shadow-lg)] sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <p className="app-kicker">Welcome back</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-[2.15rem]">Your private creator workspace</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in to manage campaigns, conversations and delivery health.</p>
          <div className="mt-8"><AdminLoginForm callbackUrl={callbackUrl} /></div>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted"><Icon name="check" size={14} className="text-success" />Secure, single-administrator access</p>
      </div>
    </section>
  </main>;
}
