"use client";

import { Building2, Pencil, Smartphone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getAccountTypeConfig,
  maskAccountNumber,
} from "@/lib/withdrawal-accounts";
import { WithdrawalAccount } from "@/types";

interface WithdrawalAccountCardProps {
  account: WithdrawalAccount & { id: string };
  onEdit: (account: WithdrawalAccount & { id: string }) => void;
  onDelete: (account: WithdrawalAccount & { id: string }) => void;
}

export function WithdrawalAccountCard({
  account,
  onEdit,
  onDelete,
}: WithdrawalAccountCardProps) {
  const config = getAccountTypeConfig(account.accountType);
  const isEwallet = config?.category === "ewallet";
  const Icon = isEwallet ? Smartphone : Building2;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
        <Icon className="h-4 w-4 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{account.label}</p>
          <Badge
            variant="secondary"
            className="shrink-0 border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-400"
          >
            {config?.label ?? account.accountType}
          </Badge>
        </div>
        {account.bankName && (
          <p className="mt-0.5 text-xs text-zinc-400">{account.bankName}</p>
        )}
        <p className="mt-0.5 font-mono text-xs tracking-wide text-zinc-400">
          {maskAccountNumber(account.accountType, account.accountNumber)}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
          {account.accountName}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={() => onEdit(account)}
          aria-label={`Edit ${account.label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-zinc-900 text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-400 cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(account)}
          aria-label={`Delete ${account.label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-zinc-900 text-zinc-400 transition-colors hover:border-red-500/30 hover:text-red-400 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
