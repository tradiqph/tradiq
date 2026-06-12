"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

interface ConsoleBadgesContextValue {
  openSupportCount: number;
  refetchSupportBadge: () => Promise<void>;
}

const ConsoleBadgesContext = createContext<ConsoleBadgesContextValue>({
  openSupportCount: 0,
  refetchSupportBadge: async () => {},
});

export function ConsoleBadgesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [openSupportCount, setOpenSupportCount] = useState(0);

  const refetchSupportBadge = useCallback(async () => {
    if (!user) {
      setOpenSupportCount(0);
      return;
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/console/support/badge", {
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
      value={{ openSupportCount, refetchSupportBadge }}
    >
      {children}
    </ConsoleBadgesContext.Provider>
  );
}

export function useConsoleBadges() {
  return useContext(ConsoleBadgesContext);
}
