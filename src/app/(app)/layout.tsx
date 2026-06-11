"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { MobileShell } from "@/components/layout/mobile-shell";
import { TransactionsProvider } from "@/hooks/use-transactions";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <TransactionsProvider>
        <MobileShell>{children}</MobileShell>
      </TransactionsProvider>
    </AuthGuard>
  );
}
