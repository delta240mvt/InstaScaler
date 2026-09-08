import Link from "next/link";
import Image from "next/image";

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
            <Image src="/icon.svg" width={36} height={36} alt="" className="shrink-0" unoptimized /><span className="text-xl font-black tracking-[-0.04em]">InstaScaler</span>
          </Link>
          <Link
            href="/login"
            className="app-button app-button-secondary min-h-10"
          >
            Zaloguj się
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-14">
        <p className="app-kicker">
          Aktualizacja: {updatedAt}
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
