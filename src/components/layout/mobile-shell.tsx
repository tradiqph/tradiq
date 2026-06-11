"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative mx-auto min-h-dvh max-w-md bg-black pb-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
      </div>
      <div key={pathname} className="app-page-enter relative">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
