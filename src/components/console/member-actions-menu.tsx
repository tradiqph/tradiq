"use client";

import { useState } from "react";
import { ArrowUpFromDot, Banknote, ClipboardList, Gift, Key, Lock, MoreHorizontal, Trash2, Users } from "lucide-react";
import { MemberAuditSheet } from "@/components/console/member-audit-sheet";
import { MemberNetworkSheet } from "@/components/console/member-network-sheet";
import { MemberUplineSheet } from "@/components/console/member-upline-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoldButton } from "@/components/ui/gold-button";
import { useAuth } from "@/hooks/use-auth";
import { canUseCashDepositFeatures } from "@/lib/console/cash-deposit";
import { isSuperAdminRole } from "@/lib/roles";
import { toast } from "sonner";

interface MemberActionsMenuProps {
  member: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
  onUpdated: () => void;
}

export function MemberActionsMenu({ member, onUpdated }: MemberActionsMenuProps) {
  const { user, profile } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [uplineOpen, setUplineOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isSelf = user?.uid === member.id;
  const isProtected = isSuperAdminRole(member.role) || isSelf;
  const operatorEmail = user?.email ?? profile?.email;
  const canCreditDeposit =
    canUseCashDepositFeatures({
      email: operatorEmail,
      role: profile?.role,
    }) && !isProtected;

  const patchMember = async (body: object) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/console/members/${member.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Update failed");
  };

  const handleSetPassword = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await patchMember({ action: "setPassword", password });
      toast.success("Password updated");
      setPasswordOpen(false);
      setPassword("");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN must be 4–6 digits");
      return;
    }
    setLoading(true);
    try {
      await patchMember({ action: "setPin", pin });
      toast.success("PIN updated");
      setPinOpen(false);
      setPin("");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClearPin = async () => {
    setLoading(true);
    try {
      await patchMember({ action: "clearPin" });
      toast.success("PIN removed");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreditDeposit = async () => {
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/console/members/${member.id}/deposit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          note: depositNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deposit failed");
      toast.success(`Credited ${member.displayName}'s wallet`);
      setDepositOpen(false);
      setDepositAmount("");
      setDepositNote("");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreditBonus = async () => {
    const amount = Number(bonusAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/console/members/${member.id}/deposit-bonus`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            note: bonusNote.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bonus credit failed");
      toast.success(`Deposit bonus credited to ${member.displayName}`);
      setBonusOpen(false);
      setBonusAmount("");
      setBonusNote("");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirmEmail.trim().toLowerCase() !== member.email.toLowerCase()) {
      toast.error("Email confirmation does not match");
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/console/members/${member.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Member deleted");
      setDeleteOpen(false);
      setConfirmEmail("");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
          aria-label="Member actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 bg-zinc-950">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setNetworkOpen(true)}
          >
            <Users className="mr-2 h-4 w-4" />
            Network
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setUplineOpen(true)}
          >
            <ArrowUpFromDot className="mr-2 h-4 w-4" />
            See upline
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setAuditOpen(true)}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Audit Account
          </DropdownMenuItem>
          {canCreditDeposit && (
            <>
              <DropdownMenuItem
                className="cursor-pointer text-amber-400"
                onClick={() => setDepositOpen(true)}
              >
                <Banknote className="mr-2 h-4 w-4" />
                Credit deposit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-amber-400"
                onClick={() => setBonusOpen(true)}
              >
                <Gift className="mr-2 h-4 w-4" />
                Credit bonus
              </DropdownMenuItem>
            </>
          )}
          {!isProtected && (
            <>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setPasswordOpen(true)}
          >
            <Key className="mr-2 h-4 w-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setPinOpen(true)}
          >
            <Lock className="mr-2 h-4 w-4" />
            Change PIN
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-red-400"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete member
          </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <MemberNetworkSheet
        open={networkOpen}
        onOpenChange={setNetworkOpen}
        member={member}
      />

      <MemberUplineSheet
        open={uplineOpen}
        onOpenChange={setUplineOpen}
        member={member}
      />

      <MemberAuditSheet
        open={auditOpen}
        onOpenChange={setAuditOpen}
        member={member}
      />

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Credit deposit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Cash received for{" "}
            <span className="text-white">{member.displayName}</span> (
            {member.email}). This credits their wallet like a paid deposit.
          </p>
          <div className="space-y-2">
            <Label className="text-zinc-400">Amount (PHP)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="border-white/10 bg-black text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Note (optional, admin only)</Label>
            <Input
              value={depositNote}
              onChange={(e) => setDepositNote(e.target.value)}
              placeholder="e.g. Cash at office"
              className="border-white/10 bg-black text-white"
              maxLength={500}
            />
          </div>
          <GoldButton
            className="w-full"
            disabled={loading}
            onClick={() => void handleCreditDeposit()}
          >
            {loading ? "Crediting…" : "Credit to wallet"}
          </GoldButton>
        </DialogContent>
      </Dialog>

      <Dialog open={bonusOpen} onOpenChange={setBonusOpen}>
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Credit bonus</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Extra direct-deposit bonus for{" "}
            <span className="text-white">{member.displayName}</span> (
            {member.email}). Credits their wallet as a deposit bonus — separate
            from the main deposit amount.
          </p>
          <div className="space-y-2">
            <Label className="text-zinc-400">Amount (PHP)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              placeholder="0.00"
              className="border-white/10 bg-black text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Note (optional, admin only)</Label>
            <Input
              value={bonusNote}
              onChange={(e) => setBonusNote(e.target.value)}
              placeholder="e.g. 2% bonus on ₱50,000 direct deposit"
              className="border-white/10 bg-black text-white"
              maxLength={500}
            />
          </div>
          <GoldButton
            className="w-full"
            disabled={loading}
            onClick={() => void handleCreditBonus()}
          >
            {loading ? "Crediting…" : "Credit bonus to wallet"}
          </GoldButton>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">{member.email}</p>
          <div className="space-y-2">
            <Label className="text-zinc-400">New password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-white/10 bg-black text-white"
              minLength={6}
            />
          </div>
          <GoldButton
            className="w-full"
            disabled={loading}
            onClick={() => void handleSetPassword()}
          >
            {loading ? "Saving…" : "Update password"}
          </GoldButton>
        </DialogContent>
      </Dialog>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="border-amber-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Change PIN</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">{member.email}</p>
          <div className="space-y-2">
            <Label className="text-zinc-400">New PIN (4–6 digits)</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              className="border-white/10 bg-black text-white"
            />
          </div>
          <div className="flex gap-2">
            <GoldButton
              className="flex-1"
              disabled={loading}
              onClick={() => void handleSetPin()}
            >
              {loading ? "Saving…" : "Set PIN"}
            </GoldButton>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleClearPin()}
              className="rounded-lg border border-white/10 px-4 text-sm text-zinc-400"
            >
              Clear PIN
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-red-500/20 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Delete member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            This permanently deletes{" "}
            <span className="text-white">{member.displayName}</span> (
            {member.email}), their Firebase login, wallet data, bots, and
            transactions. This cannot be undone.
          </p>
          <div className="space-y-2">
            <Label className="text-zinc-400">
              Type <span className="text-white">{member.email}</span> to confirm
            </Label>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="border-white/10 bg-black text-white"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleDelete()}
            className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Deleting…" : "Delete permanently"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
