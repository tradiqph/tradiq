"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export type SupportBadgeScope =
  | { mode: "today" }
  | { mode: "all" }
  | { mode: "date"; date: string };

const DEFAULT_SUPPORT_BADGE_SCOPE: SupportBadgeScope = { mode: "today" };

function buildSupportBadgeUrl(scope: SupportBadgeScope): string {
  if (scope.mode === "all") {
    return "/api/console/support/badge?scope=all";
  }
  if (scope.mode === "date") {
    return `/api/console/support/badge?scope=today&date=${encodeURIComponent(scope.date)}`;
  }
  return "/api/console/support/badge?scope=today";
}

interface ConsoleBadgesContextValue {
  openSupportCount: number;
  refetchSupportBadge: () => Promise<void>;
  setSupportBadgeScope: (scope: SupportBadgeScope) => void;
}

const ConsoleBadgesContext = createContext<ConsoleBadgesContextValue>({
  openSupportCount: 0,
  refetchSupportBadge: async () => {},
  setSupportBadgeScope: () => {},
});

export function ConsoleBadgesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [openSupportCount, setOpenSupportCount] = useState(0);
  const supportBadgeScopeRef = useRef<SupportBadgeScope>(
    DEFAULT_SUPPORT_BADGE_SCOPE
  );

  const setSupportBadgeScope = useCallback((scope: SupportBadgeScope) => {
    supportBadgeScopeRef.current = scope;
  }, []);

  const refetchSupportBadge = useCallback(async () => {
    if (!user) {
      setOpenSupportCount(0);
      return;
    }

    try {
      const token = await user.getIdToken();
      const url = buildSupportBadgeUrl(supportBadgeScopeRef.current);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = (await res.json()) as { openCount?: number };
      setOpenSupportCount(Math.max(0, data.openCount ?? 0));
    } catch {
      // Keep last known count until a successful fetch returns zero
    }
  }, [user]);

  useEffect(() => {
    if (!pathname.startsWith("/console/support")) {
      supportBadgeScopeRef.current = DEFAULT_SUPPORT_BADGE_SCOPE;
    }
    void refetchSupportBadge();
  }, [refetchSupportBadge, pathname]);

  useEffect(() => {
    const onFocus = () => {
      void refetchSupportBadge();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetchSupportBadge]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refetchSupportBadge();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refetchSupportBadge]);

  return (
    <ConsoleBadgesContext.Provider
      value={{ openSupportCount, refetchSupportBadge, setSupportBadgeScope }}
    >
      {children}
    </ConsoleBadgesContext.Provider>
  );
}

export function useConsoleBadges() {
  return useContext(ConsoleBadgesContext);
}
