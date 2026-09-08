"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "@/components/ui-icons";

const navGroups: Array<{ label: string; items: Array<{ label: string; href: string; icon: IconName }> }> = [
  { label: "Panel", items: [
    { label: "Pulpit", href: "/dashboard", icon: "dashboard" },
    { label: "Przegląd", href: "/overview", icon: "overview" },
    { label: "Skrzynka odbiorcza", href: "/inbox", icon: "inbox" },
    { label: "Kampanie", href: "/campaigns", icon: "campaigns" },
  ] },
  { label: "Działanie systemu", items: [
    { label: "Dziennik wiadomości", href: "/logs", icon: "logs" },
    { label: "Diagnostyka", href: "/diagnostics", icon: "diagnostics" },
    { label: "Ustawienia", href: "/settings", icon: "settings" },
  ] },
];

interface SidebarProps { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && window.innerWidth < 1024) {
        const items = controls(); const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [isOpen, onClose]);

  return <>
    <button
      type="button"
      aria-label="Zamknij menu nawigacji"
      tabIndex={isOpen ? 0 : -1}
      className={`fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity lg:hidden ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      onClick={onClose}
    />
    <aside ref={panelRef}
      role={isOpen ? "dialog" : undefined}
      aria-modal={isOpen ? true : undefined}
      aria-label="Nawigacja główna"
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[248px] max-w-[86vw] shrink-0 flex-col border-r border-border bg-surface shadow-2xl shadow-black/10 transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-full lg:translate-x-0 lg:shadow-none ${isOpen ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"}`}
    >
      <div className="flex h-20 items-center justify-between px-5">
        <Link href="/dashboard" onClick={onClose} className="group flex min-h-11 items-center gap-3 rounded-xl pr-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-black shadow-md shadow-accent/20">
            <Icon name="sparkles" size={18} />
          </span>
          <span>
            <span className="block font-sans text-lg font-medium tracking-[-0.04em] text-foreground">InstaScaler</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">DELTA240MVT</span>
          </span>
        </Link>
        <button type="button" aria-label="Zamknij nawigację" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-xl text-muted hover:bg-surface-hover hover:text-foreground lg:hidden">
          <Icon name="close" size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-5 pt-2" aria-label="Menu główne">
        {navGroups.map((group) => <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? "page" : undefined} className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? "bg-accent/8 text-accent" : "text-muted hover:bg-surface-hover hover:text-foreground"}`}>
                {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
                <Icon name={item.icon} size={18} className={active ? "text-accent" : "text-muted group-hover:text-foreground"} />
                <span>{item.label}</span>
              </Link>;
            })}
          </div>
        </div>)}
      </nav>

      <div className="m-3 rounded-2xl border border-border bg-background/70 p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-xs font-bold text-white">A</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-foreground">Administrator</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-success" />Panel prywatny</span>
          </span>
        </div>
      </div>
    </aside>
  </>;
}
