"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  User,
  Key,
  Lock,
  Calendar,
  Copy,
  Plus,
  Shield,
  ChevronRight,
} from "lucide-react";
import { SecuritySheet } from "@/components/layout/security-sheet";
import { AddWithdrawalAccountDialog } from "@/components/account/add-withdrawal-account-dialog";
import { WithdrawalAccountCard } from "@/components/account/withdrawal-account-card";
import { GoldButton } from "@/components/ui/gold-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format } from "date-fns";
import bcrypt from "bcryptjs";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { WithdrawalAccount } from "@/types";
import { validateWithdrawalAccount, getAccountTypeConfig } from "@/lib/withdrawal-accounts";
import type { WithdrawalAccountFormData } from "@/components/account/add-withdrawal-account-dialog";

function SettingsRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
        <Icon className="h-4 w-4 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm text-white">{title}</p>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
    </>
  );

  const className =
    "flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] cursor-pointer";

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export default function AccountPage() {
  const { user, profile, logout, refreshProfile, changePassword } = useAuth();
  const [accounts, setAccounts] = useState<
    (WithdrawalAccount & { id: string })[]
  >([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<
    (WithdrawalAccount & { id: string }) | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<
    (WithdrawalAccount & { id: string }) | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user || !db) return;
    getDocs(collection(db, "users", user.uid, "withdrawalAccounts")).then(
      (snap) =>
        setAccounts(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as WithdrawalAccount),
          }))
        )
    );
  }, [user]);

  const copyCode = () => {
    if (profile?.referralCode) {
      navigator.clipboard.writeText(profile.referralCode);
      toast.success("Referral code copied");
    }
  };

  const buildPayload = (form: WithdrawalAccountFormData) => {
    const config = getAccountTypeConfig(form.accountType);
    const payload: Record<string, string> = {
      label: form.label,
      accountType: form.accountType,
      accountNumber: form.accountNumber,
      accountName: form.accountName,
    };
    if (config?.requiresBank && form.bankName) {
      payload.bankName = form.bankName;
    }
    return payload;
  };

  const addAccount = async (form: WithdrawalAccountFormData) => {
    if (!user || !db) return;

    const validationError = validateWithdrawalAccount({
      accountType: form.accountType,
      accountNumber: form.accountNumber,
      bankName: form.bankName,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (accounts.length >= 3) {
      toast.error("Maximum 3 accounts");
      return;
    }

    try {
      const payload = buildPayload(form);

      const docRef = await addDoc(
        collection(db, "users", user.uid, "withdrawalAccounts"),
        { ...payload, createdAt: serverTimestamp() }
      );
      setAccounts((prev) => [
        ...prev,
        { id: docRef.id, ...payload } as WithdrawalAccount & { id: string },
      ]);
      toast.success("Account saved");
    } catch {
      toast.error("Failed to save account");
      throw new Error("Failed to save account");
    }
  };

  const updateAccount = async (form: WithdrawalAccountFormData) => {
    if (!user || !db || !editAccount) return;

    const validationError = validateWithdrawalAccount({
      accountType: form.accountType,
      accountNumber: form.accountNumber,
      bankName: form.bankName,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const payload = buildPayload(form);
      const config = getAccountTypeConfig(form.accountType);
      const ref = doc(db, "users", user.uid, "withdrawalAccounts", editAccount.id);

      await updateDoc(ref, {
        ...payload,
        ...(config?.requiresBank ? {} : { bankName: deleteField() }),
      });

      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editAccount.id
            ? { id: editAccount.id, ...payload }
            : a
        )
      );
      toast.success("Account updated");
    } catch {
      toast.error("Failed to update account");
      throw new Error("Failed to update account");
    }
  };

  const deleteAccount = async () => {
    if (!user || !db || !deleteTarget) return;

    setDeleting(true);
    try {
      await deleteDoc(
        doc(db, "users", user.uid, "withdrawalAccounts", deleteTarget.id)
      );
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success("Account removed");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const setSecurityPin = async () => {
    if (!user || !db) return;
    if (pin.length < 4 || pin.length > 6) {
      toast.error("PIN must be 4-6 digits");
      return;
    }
    try {
      const hash = await bcrypt.hash(pin, 10);
      await updateDoc(doc(db, "users", user.uid), { securityPinHash: hash });
      await refreshProfile();
      toast.success("PIN set successfully");
      setPinOpen(false);
      setPin("");
    } catch {
      toast.error("Failed to save PIN");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password updated successfully");
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: string }).code)
          : "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Current password is incorrect");
      } else if (code === "auth/weak-password") {
        toast.error("New password is too weak");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Try again later.");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to change password");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const memberSince = profile?.memberSince
    ? format(
        typeof profile.memberSince === "object" && "toDate" in profile.memberSince
          ? profile.memberSince.toDate()
          : new Date(),
        "MM/dd/yyyy, hh:mm a"
      )
    : "—";

  return (
    <>
      <div className="px-4 pb-4 pt-6">
        <div className="surface-flat flex items-center gap-4 p-4">
          <div className="relative h-16 w-16 shrink-0">
            <Image
              src={profile?.photoURL ?? "/assets/avatar-placeholder.png"}
              alt="Profile"
              fill
              className="rounded-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-white">
              {profile?.displayName ?? "User"}
            </h1>
            <p className="truncate text-sm text-zinc-400">{profile?.email}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Member since {memberSince}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4">
        <div className="surface-flat overflow-hidden">
          <p className="px-4 pt-3 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Identity
          </p>
          <SettingsRow
            icon={User}
            title={profile?.displayName || "Display Name"}
            subtitle="Tap to update your name"
          />
          <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Copy className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white">Referral Code</p>
              <p className="text-xs text-amber-400">{profile?.referralCode}</p>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="text-xs text-amber-400 cursor-pointer"
            >
              Copy
            </button>
          </div>
          <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Calendar className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white">Member Since</p>
              <p className="text-xs text-zinc-500">{memberSince}</p>
            </div>
          </div>
        </div>

        <div className="surface-flat overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              Withdrawal Accounts
            </p>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-4 rounded-full ${
                    i < accounts.length ? "bg-amber-400" : "bg-zinc-800"
                  }`}
                />
              ))}
              <span className="ml-1 text-[10px] text-zinc-500">
                {accounts.length}/3
              </span>
            </div>
          </div>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              <Image
                src="/assets/empty-no-accounts.png"
                alt="No accounts"
                width={120}
                height={90}
                className="mb-3 opacity-60"
              />
              <p className="px-4 text-center text-xs text-zinc-500">
                No saved accounts yet. Add your accounts here for faster withdrawals.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {accounts.map((a) => (
                <WithdrawalAccountCard
                  key={a.id}
                  account={a}
                  onEdit={(account) => {
                    setEditAccount(account);
                    setAddOpen(true);
                  }}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
          {accounts.length < 3 && (
            <div className="border-t border-white/5 p-4">
              <GoldButton
                onClick={() => {
                  setEditAccount(null);
                  setAddOpen(true);
                }}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Withdrawal Account
              </GoldButton>
            </div>
          )}
        </div>

        <div className="surface-flat overflow-hidden">
          <p className="px-4 pt-3 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Security
          </p>
          <SettingsRow
            icon={Shield}
            title="Security Center"
            subtitle="PIN, accounts, and account protection"
            onClick={() => setSecurityOpen(true)}
          />
          <SettingsRow
            icon={Key}
            title="Change Password"
            subtitle="Update your account password"
            onClick={() => setPasswordOpen(true)}
          />
          <SettingsRow
            icon={Lock}
            title={profile?.securityPinHash ? "PIN is set" : "Set Security PIN"}
            subtitle="4–6 digit PIN for login and withdrawals"
            onClick={() => setPinOpen(true)}
          />
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="w-full py-3 text-sm text-red-400 cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      <SecuritySheet
        open={securityOpen}
        onOpenChange={setSecurityOpen}
        profile={profile}
      />

      <AddWithdrawalAccountDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setEditAccount(null);
        }}
        onSave={editAccount ? updateAccount : addAccount}
        editAccount={editAccount}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Delete Account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Remove{" "}
            <span className="font-medium text-white">{deleteTarget?.label}</span>?
            This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleting}
              className="flex-1 rounded-lg bg-red-500/90 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 cursor-pointer"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordOpen}
        onOpenChange={(open) => {
          setPasswordOpen(open);
          if (!open) {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
          }
        }}
      >
        <DialogContent className="max-w-sm border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-zinc-400">Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="border-amber-500/20 bg-black"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400">New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                minLength={6}
                className="border-amber-500/20 bg-black"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                minLength={6}
                className="border-amber-500/20 bg-black"
                autoComplete="new-password"
              />
            </div>
            <GoldButton
              onClick={handleChangePassword}
              disabled={
                changingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="w-full"
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </GoldButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Set Security PIN</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            maxLength={6}
            placeholder="4-6 digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="border-amber-500/20 bg-black"
          />
          <GoldButton onClick={setSecurityPin} className="w-full">
            Save PIN
          </GoldButton>
        </DialogContent>
      </Dialog>
    </>
  );
}
