"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoldButton } from "@/components/ui/gold-button";
import { cn } from "@/lib/utils";
import {
  PH_BANKS,
  WITHDRAWAL_ACCOUNT_TYPES,
  formatAccountNumber,
  getAccountTypeConfig,
  getDigitProgress,
  normalizeAccountNumber,
  stripAccountNumber,
  validateAccountNumber,
  validateBankName,
  validateWithdrawalAccount,
  type WithdrawalAccountType,
} from "@/lib/withdrawal-accounts";
import { WithdrawalAccount } from "@/types";

export interface WithdrawalAccountFormData {
  label: string;
  accountType: WithdrawalAccountType;
  accountNumber: string;
  accountName: string;
  bankName?: string;
}

const initialForm: WithdrawalAccountFormData = {
  label: "",
  accountType: "GCash",
  accountNumber: "",
  accountName: "",
  bankName: "",
};

function toFormValues(
  account: WithdrawalAccount
): WithdrawalAccountFormData {
  const config = getAccountTypeConfig(account.accountType);
  const accountType = (config?.value ?? "GCash") as WithdrawalAccountType;
  return {
    label: account.label,
    accountType,
    accountNumber: formatAccountNumber(accountType, account.accountNumber),
    accountName: account.accountName,
    bankName: account.bankName ?? "",
  };
}

interface AddWithdrawalAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: WithdrawalAccountFormData) => Promise<void>;
  editAccount?: (WithdrawalAccount & { id: string }) | null;
}

export function AddWithdrawalAccountDialog({
  open,
  onOpenChange,
  onSave,
  editAccount,
}: AddWithdrawalAccountDialogProps) {
  const isEdit = Boolean(editAccount);
  const [form, setForm] = useState<WithdrawalAccountFormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({
    number: false,
    name: false,
    label: false,
    bank: false,
  });

  const typeConfig = getAccountTypeConfig(form.accountType);
  const digitProgress = getDigitProgress(form.accountType, form.accountNumber);
  const isBank = typeConfig?.category === "bank";

  useEffect(() => {
    if (!open) return;
    if (editAccount) {
      setForm(toFormValues(editAccount));
    } else {
      setForm(initialForm);
    }
    setTouched({ number: false, name: false, label: false, bank: false });
  }, [open, editAccount]);

  const numberError = useMemo(() => {
    if (!touched.number && !form.accountNumber) return null;
    return validateAccountNumber(form.accountType, form.accountNumber);
  }, [form.accountType, form.accountNumber, touched.number]);

  const bankError = useMemo(() => {
    if (!isBank || (!touched.bank && !form.bankName)) return null;
    return validateBankName(form.accountType, form.bankName);
  }, [form.accountType, form.bankName, isBank, touched.bank]);

  const isValid =
    form.label.trim().length > 0 &&
    form.accountName.trim().length > 0 &&
    validateWithdrawalAccount({
      accountType: form.accountType,
      accountNumber: form.accountNumber,
      bankName: form.bankName,
    }) === null;

  const handleTypeChange = (accountType: WithdrawalAccountType) => {
    setForm((prev) => ({
      ...prev,
      accountType,
      accountNumber: "",
      bankName: accountType === "Bank Account" ? prev.bankName : "",
    }));
    setTouched((prev) => ({ ...prev, number: false, bank: false }));
  };

  const handleNumberChange = (value: string) => {
    const raw = stripAccountNumber(value);
    const max =
      typeConfig?.digits ?? typeConfig?.maxDigits ?? 12;
    if (raw.length > max) return;
    setForm((prev) => ({
      ...prev,
      accountNumber: formatAccountNumber(prev.accountType, raw),
    }));
  };

  const handleSave = async () => {
    setTouched({ number: true, name: true, label: true, bank: true });
    if (!isValid) return;

    setSaving(true);
    try {
      const payload: WithdrawalAccountFormData = {
        ...form,
        label: form.label.trim(),
        accountName: form.accountName.trim(),
        accountNumber: normalizeAccountNumber(form.accountNumber),
      };
      if (isBank) {
        payload.bankName = form.bankName?.trim();
      } else {
        delete payload.bankName;
      }
      await onSave(payload);
      setForm(initialForm);
      setTouched({ number: false, name: false, label: false, bank: false });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setForm(initialForm);
      setTouched({ number: false, name: false, label: false, bank: false });
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm border-amber-500/20 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-400" />
            {isEdit ? "Edit Withdrawal Account" : "Add Withdrawal Account"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-zinc-500">
          {isEdit
            ? "Update your saved payout details."
            : "Save a payout method for faster withdrawals. You can store up to 3 accounts."}
        </p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-400">Nickname</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              onBlur={() => setTouched((p) => ({ ...p, label: true }))}
              placeholder={isBank ? "e.g. My BDO Savings" : "e.g. My GCash"}
              className="border-amber-500/20 bg-black text-white"
            />
            {touched.label && !form.label.trim() && (
              <p className="text-xs text-red-400">Nickname is required</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400">Account Type</Label>
            <div className="relative">
              <select
                value={form.accountType}
                onChange={(e) =>
                  handleTypeChange(e.target.value as WithdrawalAccountType)
                }
                className="w-full appearance-none rounded-lg border border-amber-500/20 bg-black px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-amber-500/50 cursor-pointer"
              >
                {WITHDRAWAL_ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value} className="bg-zinc-950">
                    {type.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            </div>
            {typeConfig && (
              <p className="text-[11px] text-zinc-500">{typeConfig.hint}</p>
            )}
          </div>

          {isBank && (
            <div className="space-y-1.5">
              <Label className="text-zinc-400">Bank Name</Label>
              <div className="relative">
                <select
                  value={form.bankName ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, bankName: e.target.value })
                  }
                  onBlur={() => setTouched((p) => ({ ...p, bank: true }))}
                  className={cn(
                    "w-full appearance-none rounded-lg border bg-black px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-amber-500/50 cursor-pointer",
                    bankError && touched.bank
                      ? "border-red-500/50"
                      : "border-amber-500/20"
                  )}
                >
                  <option value="" className="bg-zinc-950">
                    Select your bank
                  </option>
                  {PH_BANKS.map((bank) => (
                    <option key={bank} value={bank} className="bg-zinc-950">
                      {bank}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
              {bankError && touched.bank && (
                <p className="text-xs text-red-400">{bankError}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-zinc-400">
                {typeConfig?.numberLabel ?? "Account Number"}
              </Label>
              {typeConfig && (
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    digitProgress.complete ? "text-emerald-400" : "text-zinc-500"
                  )}
                >
                  {digitProgress.label}
                </span>
              )}
            </div>
            <Input
              inputMode="numeric"
              value={form.accountNumber}
              onChange={(e) => handleNumberChange(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, number: true }))}
              placeholder={typeConfig?.placeholder}
              className={cn(
                "border-amber-500/20 bg-black font-mono text-white tracking-wide",
                numberError && touched.number && "border-red-500/50"
              )}
            />
            {numberError && touched.number && (
              <p className="text-xs text-red-400">{numberError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400">Account Name</Label>
            <Input
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              onBlur={() => setTouched((p) => ({ ...p, name: true }))}
              placeholder="Name on the account"
              className="border-amber-500/20 bg-black text-white"
            />
            {touched.name && !form.accountName.trim() && (
              <p className="text-xs text-red-400">Account name is required</p>
            )}
          </div>

          <GoldButton
            onClick={handleSave}
            disabled={saving || !isValid}
            className="w-full"
          >
            {saving ? "Saving..." : isEdit ? "Update Account" : "Save Account"}
          </GoldButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
