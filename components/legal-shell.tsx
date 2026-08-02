import Link from "next/link";
import { Icon } from "@/components/ui-icons";

interface LegalShellProps {
  title: string;
  description: string;
  updatedAt: string;
  children: React.ReactNode;
}

export default function LegalShell({
  title,
  description,
  updatedAt,
  children,
}: LegalShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-white"><Icon name="campaigns" size={18} /></span><span className="text-lg font-bold">OpenReply</span>
          </Link>
          <Link
            href="/login"
            className="app-button app-button-secondary min-h-10"
          >
            Sign in
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-14">
        <p className="app-kicker">
          Last updated {updatedAt}
        </p>
        <h1 className="app-page-title mt-4 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-8 text-muted">{description}</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-muted [&_h2]:text-foreground">
          {children}
        </div>
      </article>
    </main>
  );
}
