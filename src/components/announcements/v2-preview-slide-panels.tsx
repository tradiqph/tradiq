"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Gift,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { V2PreviewCountdown } from "@/components/announcements/v2-preview-countdown";
import type { V2PreviewSlide } from "@/lib/announcements/v2-preview-campaign";
import { cn } from "@/lib/utils";

function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/20 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function SlideHeroImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-h-[min(46dvh,380px)] overflow-hidden rounded-2xl border border-amber-500/25 bg-black shadow-[0_0_32px_rgba(245,158,11,0.1)]">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain object-center"
        sizes="(max-width: 448px) 100vw, 448px"
        priority
        unoptimized
      />
    </div>
  );
}

const LEADERBOARD_PRIZES = ["₱5,000", "₱3,000", "₱1,000"] as const;

const LEADERBOARD_CATEGORIES = {
  personal: {
    label: "Personal Investment",
    icon: TrendingUp,
    winners: ["Member A", "Member B", "Member C"],
  },
  group: {
    label: "Group Sales",
    icon: Users,
    winners: ["Team Alpha", "Team Beta", "Team Gamma"],
  },
} as const;

function PioneerExample() {
  return (
    <GlassCard className="mt-3 space-y-2">
      <p className="text-center text-sm font-medium leading-snug text-white">
        Invite now while you still can — every direct referral earns{" "}
        <span className="font-bold text-amber-300">15%</span> before it
        drops to 7%. Build your team before time runs out.
      </p>
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">
        Live countdown to pioneer end
      </p>
      <V2PreviewCountdown compact />
    </GlassCard>
  );
}

function LeaderboardExample() {
  const [category, setCategory] = useState<"personal" | "group">("personal");
  const active = LEADERBOARD_CATEGORIES[category];
  const Icon = active.icon;

  return (
    <GlassCard className="mt-3 space-y-2.5">
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">
        Weekly · Sun–Sat (PH time)
      </p>
      <div className="flex gap-2">
        {(Object.keys(LEADERBOARD_CATEGORIES) as Array<keyof typeof LEADERBOARD_CATEGORIES>).map(
          (key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer",
                category === key
                  ? "border-amber-400/50 bg-amber-500/15 text-amber-300"
                  : "border-white/10 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {LEADERBOARD_CATEGORIES[key].label}
            </button>
          )
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">
            Top 3 — {active.label}
          </span>
        </div>
        <div className="space-y-2">
          {active.winners.map((name, i) => (
            <div
              key={name}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-zinc-200">
                <Trophy
                  className={cn(
                    "h-4 w-4",
                    i === 0
                      ? "text-amber-400"
                      : i === 1
                        ? "text-zinc-400"
                        : "text-amber-700"
                  )}
                />
                #{i + 1} {name}
              </span>
              <span className="font-bold text-amber-300">
                {LEADERBOARD_PRIZES[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

const REWARD_TIERS = [
  { sales: "₱500K", reward: "iPhone 14 Pro Max 256GB", icon: Gift },
  { sales: "₱1M", reward: "iPhone 17 Pro Max 256GB", icon: Sparkles },
  { sales: "₱2M", reward: "Yamaha Aerox or Nmax", icon: Star },
] as const;

function RewardsExample() {
  return (
    <GlassCard className="mt-3 space-y-2">
      {REWARD_TIERS.map(({ sales, reward, icon: Icon }) => (
        <div key={sales} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400/80">
              {sales} group sales
            </p>
            <p className="text-sm font-medium text-white">{reward}</p>
          </div>
        </div>
      ))}
      <p className="border-t border-white/5 pt-2 text-center text-[11px] text-zinc-400">
        Prerequisite:{" "}
        <span className="font-medium text-amber-300/90">
          ₱10K personal · 10 refs @ ₱10K
        </span>
      </p>
    </GlassCard>
  );
}

const RANK_TIERS = [
  {
    name: "Leader",
    rate: "1.0% / 30d",
    detail: "₱10K personal · 10 refs @ ₱10K · ₱110K group",
  },
  {
    name: "Director",
    rate: "1.2% / 30d",
    detail: "20 refs @ ₱10K · ₱1M group",
  },
  {
    name: "Ambassador",
    rate: "1.5% / 30d",
    detail: "30 refs @ ₱10K · ₱2M group",
  },
] as const;

function RanksExample({ footer }: { footer?: string }) {
  return (
    <>
      <GlassCard className="mt-3 space-y-2">
        {RANK_TIERS.map(({ name, rate, detail }) => (
          <div key={name} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-xs font-bold text-amber-400">
              {name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-white">{name}</p>
                <p className="shrink-0 text-xs font-semibold text-amber-300">
                  {rate}
                </p>
              </div>
              <p className="text-[11px] leading-tight text-zinc-400">{detail}</p>
            </div>
          </div>
        ))}
      </GlassCard>
      {footer && (
        <p className="mt-2 text-center text-xs font-semibold uppercase tracking-widest text-amber-400/90">
          {footer}
        </p>
      )}
    </>
  );
}

function SlideExample({ slide }: { slide: V2PreviewSlide }) {
  switch (slide.visual) {
    case "pioneer":
      return <PioneerExample />;
    case "leaderboard":
      return <LeaderboardExample />;
    case "rewards":
      return <RewardsExample />;
    case "ranks":
      return <RanksExample footer={slide.footer} />;
    default:
      return null;
  }
}

export function V2PreviewSlidePanel({ slide }: { slide: V2PreviewSlide }) {
  return (
    <div>
      <SlideHeroImage src={slide.imageSrc} alt={slide.title} />
      <SlideExample slide={slide} />
    </div>
  );
}
