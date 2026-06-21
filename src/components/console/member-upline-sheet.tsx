"use client";

import { useCallback, useEffect, useState } from "react";
import { ConsoleError } from "@/components/console/console-error";
import { ConsoleLoader } from "@/components/console/console-loader";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

interface MemberUplineSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

interface UplineRow {
  level: number;
  label: string;
  id: string;
  displayName: string;
  email: string;
  referralCode: string;
}

interface UplineResponse {
  member: {
    signupReferralCode: string | null;
  };
  upline: UplineRow[];
}

export function MemberUplineSheet({
  open,
  onOpenChange,
  member,
}: MemberUplineSheetProps) {
  const { user } = useAuth();
  const [upline, setUpline] = useState<UplineRow[]>([]);
  const [signupReferralCode, setSignupReferralCode] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUpline = useCallback(async () => {
    if (!user || !member) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/console/members/${member.id}/upline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as UplineResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load upline");
        return;
      }
      setUpline(data.upline ?? []);
      setSignupReferralCode(data.member?.signupReferralCode ?? null);
    } finally {
      setLoading(false);
    }
  }, [user, member]);

  useEffect(() => {
    if (open && member) {
      void fetchUpline();
    } else if (!open) {
      setUpline([]);
      setSignupReferralCode(null);
      setError(null);
    }
  }, [open, member, fetchUpline]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-amber-500/20 bg-zinc-950 text-white sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-left text-white">
            Upline
            {member ? (
              <span className="mt-1 block text-sm font-normal text-zinc-400">
                {member.displayName || member.email}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pt-2">
          {error ? (
            <ConsoleError message={error} />
          ) : loading ? (
            <ConsoleLoader variant="section" label="Loading upline" />
          ) : upline.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-zinc-400">
              <p>No upline linked for this member.</p>
              {signupReferralCode ? (
                <p className="mt-2">
                  Signup referral code:{" "}
                  <span className="font-mono text-amber-400">
                    {signupReferralCode}
                  </span>
                </p>
              ) : null}
            </div>
          ) : (
            <ol className="space-y-3">
              {upline.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-400">
                      L{row.level}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                        {row.label}
                      </p>
                      <p className="mt-1 font-medium text-white">
                        {row.displayName || "—"}
                      </p>
                      <p className="text-sm text-zinc-400">{row.email}</p>
                      {row.referralCode ? (
                        <p className="mt-2 font-mono text-xs text-zinc-500">
                          Code: {row.referralCode}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}