import type { Metadata } from "next";
import { ConsoleGuard } from "@/components/console/console-guard";
import { ConsoleShell } from "@/components/console/console-shell";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsoleGuard>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleGuard>
  );
}
