"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui-icons";

const pageTitles: Record<string, { title: string; eyebrow: string }> = {
  "/dashboard": { title: "Dashboard", eyebrow: "Workspace" },
  "/overview": { title: "Instagram overview", eyebrow: "Analytics" },
  "/inbox": { title: "Inbox", eyebrow: "Conversations" },
  "/campaigns": { title: "Campaigns", eyebrow: "Automations" },
  "/campaigns/new": { title: "New campaign", eyebrow: "Automations" },
  "/automations": { title: "Campaigns", eyebrow: "Automations" },
  "/automations/new": { title: "New campaign", eyebrow: "Automations" },
  "/logs": { title: "DM logs", eyebrow: "Operations" },
  "/settings": { title: "Settings", eyebrow: "Workspace" },
  "/diagnostics": { title: "Diagnostics", eyebrow: "Operations" },
};

interface TopBarProps { onMenuClick: () => void; instagramUsername: string | null; instagramAccountCount: number }

export default function TopBar({ onMenuClick, instagramUsername, instagramAccountCount }: TopBarProps) {
  const pathname = usePathname();
  const exact = pageTitles[pathname];
  const root = Object.entries(pageTitles).find(([path]) => pathname.startsWith(`${path}/`))?.[1];
  const page = exact ?? root ?? pageTitles["/dashboard"];

  return <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-surface/92 px-3 backdrop-blur-xl sm:px-6 lg:h-20 lg:px-8">
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
      <button type="button" onClick={onMenuClick} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted shadow-sm hover:bg-surface-hover hover:text-foreground lg:hidden" aria-label="Open navigation">
        <Icon name="menu" size={20} />
      </button>
      <div className="min-w-0">
        <p className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-muted sm:block">{page.eyebrow}</p>
        <h1 className="truncate text-[15px] font-bold tracking-[-0.025em] text-foreground sm:text-lg">{page.title}</h1>
      </div>
    </div>

    {instagramAccountCount > 0 ? <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface-hover/70 px-2.5 sm:px-3">
      <span className="relative grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#d4a15a] to-[#b47719] text-white"><Icon name="instagram" size={14} /><span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" /></span>
      <span className="hidden max-w-36 truncate text-xs font-semibold text-foreground sm:block">{instagramAccountCount > 1 ? `${instagramAccountCount} accounts` : `@${instagramUsername}`}</span>
    </div> : <a href="/api/instagram/connect" className="app-button app-button-primary min-h-10 px-3 sm:px-4"><Icon name="instagram" size={17} /><span className="hidden sm:inline">Connect Instagram</span><span className="sm:hidden">Connect</span></a>}
  </header>;
}
