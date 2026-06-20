"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { V2PreviewAnnouncementHost } from "@/components/announcements/v2-preview-announcement-host";
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
      <V2PreviewAnnouncementHost>
        <TransactionsProvider>
          <PushNotificationsBootstrap />
          <ForegroundEarningAlertsProvider />
          <MobileShell>{children}</MobileShell>
        </TransactionsProvider>
      </V2PreviewAnnouncementHost>
    </AuthGuard>
  );
}
