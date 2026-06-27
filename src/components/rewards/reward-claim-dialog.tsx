"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { RankRequirementChecklist } from "@/components/rank/rank-requirement-checklist";
import { GoldButton } from "@/components/ui/gold-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDeliveryAddress, type RewardTierProgress } from "@/lib/rewards/config";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RewardClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: RewardTierProgress | null;
  onSuccess: (result: { referenceNumber: string }) => void;
}

type Step = "confirm" | "address" | "review";

const emptyAddress = {
  street: "",
  barangay: "",
  city: "",
  postalCode: "",
};

export function RewardClaimDialog({
  open,
  onOpenChange,
  tier,
  onSuccess,
}: RewardClaimDialogProps) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>("confirm");
  const [confirmation, setConfirmation] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(emptyAddress);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMemberName(profile?.displayName?.trim() ?? "");
    setMemberEmail(profile?.email?.trim() ?? user?.email ?? "");
  }, [open, profile?.displayName, profile?.email, user?.email]);

  const reset = () => {
    setStep("confirm");
    setConfirmation("");
    setMemberName("");
    setMemberEmail("");
    setMemberPhone("");
    setDeliveryAddress(emptyAddress);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const confirmationValid = confirmation === "TRADIQ";
  const nameValid = memberName.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail.trim());
  const addressValid =
    deliveryAddress.street.trim().length >= 3 &&
    deliveryAddress.barangay.trim().length >= 2 &&
    deliveryAddress.city.trim().length >= 2 &&
    /^\d{4}$/.test(deliveryAddress.postalCode.trim());
  const phoneValid = /^(\+63|0)?9\d{9}$/.test(memberPhone.trim());
  const contactValid = nameValid && emailValid && phoneValid && addressValid;

  const submitClaim = async () => {
    if (!user || !tier) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rewardType: tier.id,
          confirmation: "TRADIQ",
          memberName: memberName.trim(),
          memberEmail: memberEmail.trim(),
          memberPhone: memberPhone.trim(),
          deliveryAddress: {
            street: deliveryAddress.street.trim(),
            barangay: deliveryAddress.barangay.trim(),
            city: deliveryAddress.city.trim(),
            postalCode: deliveryAddress.postalCode.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to submit claim");
        return;
      }
      const referenceNumber = String(data.referenceNumber ?? "");
      reset();
      onOpenChange(false);
      onSuccess({ referenceNumber });
    } finally {
      setSubmitting(false);
    }
  };

  if (!tier) return null;

  if (tier.state !== "eligible") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="border-white/10 bg-zinc-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Requirements not met</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            You must meet all milestone requirements before claiming this reward.
          </p>
          <RankRequirementChecklist items={tier.checklist} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Claim {tier.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-800/90">
            <Image
              src={tier.imageSrc}
              alt={tier.imageAlt}
              fill
              className="object-contain p-1 brightness-110"
              sizes="64px"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{tier.shortName}</p>
            <p className="text-xs text-zinc-500">All requirements met</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {(["confirm", "address", "review"] as Step[]).map((s, i) => (
            <span
              key={s}
              className={cn(
                "rounded-full px-2 py-0.5 capitalize",
                step === s
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-zinc-600"
              )}
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>

        {step === "confirm" && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              To confirm this reward claim, type{" "}
              <strong className="text-white">TRADIQ</strong> below.
            </p>
            <div className="space-y-2">
              <Label htmlFor="tradiq-confirm">Confirmation</Label>
              <Input
                id="tradiq-confirm"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="TRADIQ"
                autoComplete="off"
                className="border-white/10 bg-black/40"
              />
            </div>
            <GoldButton
              className="w-full"
              disabled={!confirmationValid}
              onClick={() => setStep("address")}
            >
              Continue
            </GoldButton>
          </div>
        )}

        {step === "address" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-name">Full name</Label>
              <Input
                id="member-name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                className="border-white/10 bg-black/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                className="border-white/10 bg-black/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-phone">Mobile number</Label>
              <Input
                id="member-phone"
                value={memberPhone}
                onChange={(e) => setMemberPhone(e.target.value)}
                placeholder="09123456789"
                inputMode="tel"
                autoComplete="tel"
                className="border-white/10 bg-black/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="street">Street address (include landmarks)</Label>
              <Input
                id="street"
                value={deliveryAddress.street}
                onChange={(e) =>
                  setDeliveryAddress((prev) => ({
                    ...prev,
                    street: e.target.value,
                  }))
                }
                placeholder="Purok 4, near barangay hall"
                className="border-white/10 bg-black/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barangay">Barangay</Label>
              <Input
                id="barangay"
                value={deliveryAddress.barangay}
                onChange={(e) =>
                  setDeliveryAddress((prev) => ({
                    ...prev,
                    barangay: e.target.value,
                  }))
                }
                className="border-white/10 bg-black/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={deliveryAddress.city}
                  onChange={(e) =>
                    setDeliveryAddress((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  className="border-white/10 bg-black/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal code</Label>
                <Input
                  id="postal"
                  value={deliveryAddress.postalCode}
                  onChange={(e) =>
                    setDeliveryAddress((prev) => ({
                      ...prev,
                      postalCode: e.target.value,
                    }))
                  }
                  maxLength={4}
                  inputMode="numeric"
                  className="border-white/10 bg-black/40"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("confirm")}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 cursor-pointer"
              >
                Back
              </button>
              <GoldButton
                className="flex-1"
                disabled={!contactValid}
                onClick={() => setStep("review")}
              >
                Review
              </GoldButton>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm">
              <p className="text-zinc-500">Reward</p>
              <p className="font-medium text-white">{tier.name}</p>
              <p className="mt-3 text-zinc-500">Full name</p>
              <p className="text-white">{memberName.trim()}</p>
              <p className="mt-3 text-zinc-500">Email</p>
              <p className="text-white">{memberEmail.trim()}</p>
              <p className="mt-3 text-zinc-500">Phone</p>
              <p className="text-white">{memberPhone.trim()}</p>
              <p className="mt-3 text-zinc-500">Delivery address</p>
              <p className="whitespace-pre-line text-white">
                {formatDeliveryAddress({
                  street: deliveryAddress.street.trim(),
                  barangay: deliveryAddress.barangay.trim(),
                  city: deliveryAddress.city.trim(),
                  postalCode: deliveryAddress.postalCode.trim(),
                })}
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              Submitting will deduct this milestone from your reward progress.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("address")}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 cursor-pointer"
              >
                Back
              </button>
              <GoldButton
                className="flex-1"
                disabled={submitting}
                onClick={() => void submitClaim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Claim"
                )}
              </GoldButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
