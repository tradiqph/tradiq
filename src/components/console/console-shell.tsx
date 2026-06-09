"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Users,
  TrendingUp,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/console", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/console/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/console/members", label: "Members", icon: Users },
  { href: "/console/investments", label: "Investments", icon: TrendingUp },
  { href: "/console/reports", label: "Reports", icon: FileText },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="mx-auto flex min-h-dvh max-w-7xl">
        <aside className="hidden w-56 shrink-0 border-r border-white/5 bg-zinc-950/50 p-4 md:block">
          <div className="mb-8">
            <p className="text-xs font-semibold tracking-widest text-amber-400">
              TRADIQ
            </p>
            <h1 className="text-lg font-bold text-white">Super Admin</h1>
          </div>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-amber-500/15 text-amber-400"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
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

        <div className="flex-1 overflow-x-hidden">
          <header className="border-b border-white/5 px-4 py-3 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map(({ href, label, exact }) => {
                const active = exact
                  ? pathname === href
                  : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs",
                      active
                        ? "bg-amber-500/20 text-amber-400"
                        : "text-zinc-500"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </header>
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
