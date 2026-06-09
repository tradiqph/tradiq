import { ConsoleGuard } from "@/components/console/console-guard";
import { ConsoleShell } from "@/components/console/console-shell";

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
