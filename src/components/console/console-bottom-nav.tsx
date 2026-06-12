"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConsoleNavBadge } from "@/components/console/console-nav-badge";
import { consoleNavItems } from "@/lib/console/nav";
import { cn } from "@/lib/utils";

interface ConsoleBottomNavProps {
  openSupportCount?: number;
}

export function ConsoleBottomNav({
  openSupportCount = 0,
}: ConsoleBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-500/10 bg-zinc-950/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      aria-label="Console navigation"
    >
      <div
        className="grid px-1 pt-2 pb-2"
        style={{
          gridTemplateColumns: `repeat(${consoleNavItems.length}, minmax(0, 1fr))`,
        }}
      >
        {consoleNavItems.map(
          ({ href, shortLabel, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname.startsWith(href);
            const showSupportBadge =
              href === "/console/support" && openSupportCount > 0;

            return (
              <Link
                key={href}
                href={href}
                aria-label={shortLabel}
                aria-current={active ? "page" : undefined}
                className="flex min-w-0 flex-col items-center gap-1 px-0.5"
              >
                <div
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                    active
                      ? "bg-amber-500/20 text-amber-400"
                      : "text-zinc-500"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 2} />
                  {showSupportBadge && (
                    <ConsoleNavBadge
                      count={openSupportCount}
                      className="absolute -top-1.5 -right-1.5 h-[18px] min-w-[18px] text-[9px]"
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "w-full truncate text-center text-[9px] font-medium leading-none",
                    active ? "text-amber-400" : "text-zinc-500"
                  )}
                >
                  {shortLabel}
                </span>
              </Link>
            );
          }
        )}
      </div>
    </nav>
  );
}
