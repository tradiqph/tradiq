import { AuthGuard } from "@/components/auth/auth-guard";
import { MobileShell } from "@/components/layout/mobile-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <MobileShell>{children}</MobileShell>
    </AuthGuard>
  );
}
