"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon, type IconName } from "@/components/ui-icons";

const navGroups: Array<{ label: string; items: Array<{ label: string; href: string; icon: IconName }> }> = [
  { label: "Workspace", items: [
    { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { label: "Overview", href: "/overview", icon: "overview" },
    { label: "Inbox", href: "/inbox", icon: "inbox" },
    { label: "Campaigns", href: "/campaigns", icon: "campaigns" },
  ] },
  { label: "Operations", items: [
    { label: "DM Logs", href: "/logs", icon: "logs" },
    { label: "Diagnostics", href: "/diagnostics", icon: "diagnostics" },
    { label: "Settings", href: "/settings", icon: "settings" },
  ] },
];

interface SidebarProps { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return <>
    <button
      type="button"
      aria-label="Close navigation backdrop"
      tabIndex={isOpen ? 0 : -1}
      className={`fixed inset-0 z-40 bg-[#4d3926]/25 backdrop-blur-[2px] transition-opacity lg:hidden ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      onClick={onClose}
    />
    <aside
      role={isOpen ? "dialog" : undefined}
      aria-modal={isOpen ? true : undefined}
      aria-label="Primary navigation"
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[248px] max-w-[86vw] shrink-0 flex-col border-r border-border bg-surface shadow-2xl shadow-amber-950/10 transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-full lg:translate-x-0 lg:shadow-none ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex h-20 items-center justify-between px-5">
        <Link href="/dashboard" onClick={onClose} className="group flex min-h-11 items-center gap-3 rounded-xl pr-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-md shadow-accent/20">
            <Icon name="sparkles" size={18} />
          </span>
          <span>
            <span className="block font-serif text-lg font-medium tracking-[-0.04em] text-foreground">InstaScaler</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Growth studio</span>
          </span>
        </Link>
        <button type="button" aria-label="Close navigation" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-xl text-muted hover:bg-surface-hover hover:text-foreground lg:hidden">
          <Icon name="close" size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-5 pt-2" aria-label="Main menu">
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
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-success" />Cloudflare native</span>
          </span>
        </div>
      </div>
    </aside>
  </>;
}
