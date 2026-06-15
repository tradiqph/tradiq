"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { MobileShell } from "@/components/layout/mobile-shell";
import { ForegroundEarningAlertsProvider } from "@/components/notifications/foreground-earning-alerts-host";
import { PushNotificationsBootstrap } from "@/components/push/push-notifications-bootstrap";
import { TransactionsProvider } from "@/hooks/use-transactions";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <TransactionsProvider>
        <PushNotificationsBootstrap />
        <ForegroundEarningAlertsProvider />
        <MobileShell>{children}</MobileShell>
      </TransactionsProvider>
    </AuthGuard>
  );
}
