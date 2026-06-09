"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Gift, TrendingUp, ChevronDown } from "lucide-react";
import { ReferralLevelSummary } from "@/components/referral/referral-level-summary";
import { AppHeader } from "@/components/layout/app-header";
import { GoldButton } from "@/components/ui/gold-button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildReferralLink } from "@/lib/app-url";
import { getReferralRewardExamples } from "@/lib/finance";

const commissionTiers = getReferralRewardExamples();

export default function ReferralPage() {
  const { profile } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const referralCode = profile?.referralCode ?? "";
  const [referralLink, setReferralLink] = useState("");

  useEffect(() => {
    setReferralLink(buildReferralLink(referralCode));
  }, [referralCode]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <>
      <AppHeader title="Referral Program" showBack backHref="/home" />

      <div className="space-y-4 px-4 pb-4">
        <div className="surface-accent p-4">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Your Referral Code
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-bold text-amber-400">{referralCode}</span>
            <button
              type="button"
              onClick={() => copy(referralCode, "Code")}
              className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-zinc-950 px-3 py-1.5 text-xs text-white cursor-pointer"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        </div>

        {referralLink && (
          <p className="break-all rounded-xl border border-white/5 bg-black/40 px-3 py-2 text-xs text-zinc-400">
            {referralLink}
          </p>
        )}

        <GoldButton
          onClick={() => copy(referralLink, "Referral link")}
          disabled={!referralLink}
          className="w-full"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Referral Link
        </GoldButton>

        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 p-4">
          <Image
            src="/assets/referral-hero.png"
            alt=""
            fill
            className="object-cover opacity-10"
          />
          <div className="relative">
            <div className="mb-1 flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-400" />
              <h2 className="font-bold text-white">Subscribe, Invite & Earn</h2>
            </div>
            <p className="text-sm text-zinc-400">
              Share your code to earn bonuses on every referral subscription.
            </p>
          </div>
        </div>

        {profile && <ReferralLevelSummary profile={profile} />}

        <div className="surface-flat overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-3 p-4 cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
              <TrendingUp className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-white">How Much You Earn</p>
              <p className="text-xs text-zinc-500">
                {expanded ? "Tap to hide breakdown" : "Tap to show breakdown"}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-zinc-400 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
          {expanded && (
            <div className="space-y-5 border-t border-amber-500/10 px-4 pb-4 pt-4">
              {commissionTiers.map((tier) => (
                <div key={tier.level} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black">
                      {tier.level}
                    </div>
                    <p className="flex-1 text-sm font-semibold text-white">
                      {tier.label}
                    </p>
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      {tier.percent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {tier.examples.map((ex) => (
                      <div
                        key={ex.sub}
                        className="rounded-xl border border-white/5 bg-zinc-950 px-2 py-3 text-center"
                      >
                        <p className="text-[10px] text-zinc-500">
                          Subscribes ₱{ex.sub.toLocaleString()}
                        </p>
                        <p className="mt-1 text-lg font-bold text-amber-400">
                          ₱{ex.reward.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-zinc-500">for you</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
