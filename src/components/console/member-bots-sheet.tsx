"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { ConsoleError } from "@/components/console/console-error";
import { DataTable } from "@/components/console/data-table";
import { PesoAmount } from "@/components/ui/peso-amount";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

interface MemberBotsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

interface MemberActiveBot {
  id: string;
  amount: number;
  subscribedAt: string | null;
}

function formatManilaDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function MemberBotsSheet({
  open,
  onOpenChange,
  member,
}: MemberBotsSheetProps) {
  const { user } = useAuth();
  const [bots, setBots] = useState<MemberActiveBot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    if (!user || !member) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/console/members/${member.id}/bots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load bots");
        return;
      }
      setBots(data.bots ?? []);
    } finally {
      setLoading(false);
    }
  }, [user, member]);

  useEffect(() => {
    if (!open || !member) return;
    void fetchBots();
  }, [open, member, fetchBots]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-amber-500/20 bg-zinc-950 sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Bot className="h-4 w-4 text-amber-400" />
            Active bots
          </SheetTitle>
          {member && (
            <p className="text-sm text-zinc-500">
              {member.displayName || member.email}
              {member.displayName ? ` · ${member.email}` : ""}
            </p>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          {error ? (
            <ConsoleError message={error} />
          ) : loading ? (
            <p className="text-sm text-zinc-500">Loading bots...</p>
          ) : (
            <DataTable
              data={bots}
              rowKey={(row) => row.id}
              emptyMessage="No active bots"
              columns={[
                {
                  key: "principal",
                  header: "Principal",
                  primary: true,
                  cell: (row) => <PesoAmount amount={row.amount} gold />,
                },
                {
                  key: "invested",
                  header: "Invested",
                  cell: (row) => (
                    <span className="text-zinc-300">
                      {formatManilaDateTime(row.subscribedAt)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
