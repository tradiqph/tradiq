"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { isSuperAdminRole } from "@/lib/roles";

export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isSuperAdminRole(profile?.role)) {
      router.replace("/home");
    }
  }, [loading, user, profile, router]);

  if (loading || !user || !isSuperAdminRole(profile?.role)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-zinc-500">
        Loading console...
      </div>
    );
  }

  return <>{children}</>;
}
