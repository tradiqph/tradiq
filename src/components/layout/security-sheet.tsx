"use client";

import Link from "next/link";
import {
  ChevronRight,
  KeyRound,
  Lock,
  Shield,
  ShieldCheck,
  Terminal,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserProfile } from "@/types";
import { isSuperAdminRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface SecuritySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
}

export function SecuritySheet({
  open,
  onOpenChange,
  profile,
}: SecuritySheetProps) {
  const pinSet = Boolean(profile?.securityPinHash);
  const isSuperAdmin = isSuperAdminRole(profile?.role);

  const items = [
    {
      icon: pinSet ? ShieldCheck : KeyRound,
      title: pinSet ? "Security PIN active" : "Set security PIN",
      description: pinSet
        ? "Your withdrawals are protected with a PIN."
        : "Add a 4-digit PIN before cashing out.",
      href: "/account",
      status: pinSet ? "ok" : "warn",
    },
    {
      icon: Lock,
      title: "Withdrawal accounts",
      description: "Manage GCash, bank, or e-wallet payout details.",
      href: "/account",
      status: "neutral",
    },
    {
      icon: User,
      title: "Account profile",
      description: "Update your display name and view membership info.",
      href: "/account",
      status: "neutral",
    },
    ...(isSuperAdmin
      ? [
          {
            icon: Terminal,
            title: "Super Admin Console",
            description: "Dashboard, withdrawals, members, investments, and reports.",
            href: "/console",
            status: "neutral" as const,
          },
        ]
      : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-amber-500/20 bg-zinc-950 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Shield className="h-4 w-4 text-amber-400" />
            Security Center
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Account status
            </p>
            <p className="mt-2 text-sm text-white">
              {profile?.email ?? "Signed in"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {pinSet
                ? "PIN protection enabled · Firebase secured"
                : "PIN not configured — recommended before withdrawals"}
            </p>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 rounded-xl border border-amber-500/10 bg-white/5 p-3 transition-colors hover:border-amber-500/25 hover:bg-white/[0.07] cursor-pointer"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    item.status === "ok" && "bg-emerald-500/10 text-emerald-400",
                    item.status === "warn" && "bg-amber-500/15 text-amber-400",
                    item.status === "neutral" && "bg-white/10 text-zinc-300"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-zinc-500">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
              </Link>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
