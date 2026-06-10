"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function usePendingDepositSync(hasPendingDeposits: boolean) {
  const { user, refreshProfile } = useAuth();
  const syncingRef = useRef(false);

  const syncPending = useCallback(async () => {
    if (!user || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/deposits/sync-pending", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return;

      if (data.synced > 0) {
        await refreshProfile();
        toast.success(
          data.synced === 1
            ? "Deposit credited to your wallet"
            : `${data.synced} deposits credited to your wallet`
        );
      }
    } finally {
      syncingRef.current = false;
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    if (!user || !hasPendingDeposits) return;

    void syncPending();
    const interval = setInterval(() => void syncPending(), 15000);
    return () => clearInterval(interval);
  }, [user, hasPendingDeposits, syncPending]);

  return { syncPending };
}
