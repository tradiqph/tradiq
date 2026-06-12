"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ConsoleLoader } from "@/components/console/console-loader";
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
    return <ConsoleLoader variant="fullscreen" label="Loading console" />;
  }

  return <>{children}</>;
}
