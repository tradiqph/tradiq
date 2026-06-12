"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft } from "lucide-react";
import { ConsoleBottomNav } from "@/components/console/console-bottom-nav";
import { LiveActivityPresentation } from "@/components/console/live-activity/live-activity-presentation";
import { ConsoleNavBadge } from "@/components/console/console-nav-badge";
import { ConsoleBadgesProvider, useConsoleBadges } from "@/contexts/console-badges";
import { resetLiveActivitySession } from "@/lib/console/live-activity-session";
import { consoleNavItems } from "@/lib/console/nav";
import { cn } from "@/lib/utils";

function LiveActivityButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/15 cursor-pointer"
    >
      <Activity className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Live Activity</span>
      <span className="sm:hidden">Live</span>
    </button>
  );
}

function ConsoleShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openSupportCount } = useConsoleBadges();
  const [liveActivityOpen, setLiveActivityOpen] = useState(false);

  useEffect(() => {
    return () => resetLiveActivitySession();
  }, []);

  return (
    <div className="min-h-dvh bg-black text-white">
      <LiveActivityPresentation
        open={liveActivityOpen}
        onClose={() => setLiveActivityOpen(false)}
      />

      <div className="mx-auto flex min-h-dvh max-w-7xl">
        <aside className="hidden w-56 shrink-0 border-r border-white/5 bg-zinc-950/50 p-4 md:block">
          <div className="mb-8">
            <p className="text-xs font-semibold tracking-widest text-amber-400">
              TRADIQ
            </p>
            <h1 className="text-lg font-bold text-white">Super Admin</h1>
          </div>
          <nav className="space-y-1">
            {consoleNavItems.map(({ href, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname.startsWith(href);
              const showSupportBadge =
                href === "/console/support" && openSupportCount > 0;

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 overflow-visible rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-amber-500/15 text-amber-400"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {showSupportBadge && (
                    <ConsoleNavBadge count={openSupportCount} />
                  )}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/home"
            className="mt-8 flex items-center gap-2 text-xs text-zinc-500 hover:text-amber-400"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to app
          </Link>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/5 bg-black/90 px-4 py-3 backdrop-blur-md md:hidden">
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-amber-400">
                TRADIQ
              </p>
              <p className="text-sm font-bold text-white">Super Admin</p>
            </div>
            <div className="flex items-center gap-2">
              <LiveActivityButton onClick={() => setLiveActivityOpen(true)} />
              <Link
                href="/home"
                className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400"
              >
                <ArrowLeft className="h-3 w-3" />
                App
              </Link>
            </div>
          </header>

          <header className="sticky top-0 z-40 hidden items-center justify-end border-b border-white/5 bg-black/90 px-6 py-3 backdrop-blur-md md:flex">
            <LiveActivityButton onClick={() => setLiveActivityOpen(true)} />
          </header>

          <main className="flex-1 overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      <ConsoleBottomNav openSupportCount={openSupportCount} />
    </div>
  );
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleBadgesProvider>
      <ConsoleShellInner>{children}</ConsoleShellInner>
    </ConsoleBadgesProvider>
  );
}
