"use client";

import { ForegroundEarningAlertsHost } from "@/components/notifications/foreground-earning-alert";
import { useForegroundEarningAlerts } from "@/hooks/use-foreground-earning-alerts";

export function ForegroundEarningAlertsProvider() {
  const { queue, dismissCurrent } = useForegroundEarningAlerts();

  return (
    <ForegroundEarningAlertsHost queue={queue} onDismiss={dismissCurrent} />
  );
}
