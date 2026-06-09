"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export function useConsoleFetch<T>(url: string, deps: unknown[] = []) {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let json: { error?: string } = {};
      if (text) {
        try {
          json = JSON.parse(text) as { error?: string };
        } catch {
          throw new Error("Invalid server response");
        }
      }
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setData(json as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [user, url]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, ...deps]);

  return { data, loading, error, refetch };
}
