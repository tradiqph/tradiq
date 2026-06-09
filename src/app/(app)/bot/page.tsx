"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { SmartWalletEngine } from "@/components/bot/smart-wallet-engine";
import { BotCatalogCard } from "@/components/bot/bot-catalog-card";
import { SubscribeBotModal } from "@/components/modals/subscribe-bot-modal";
import { GoldButton } from "@/components/ui/gold-button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { useBotsCatalog } from "@/hooks/use-bots-catalog";
import { useAuth } from "@/hooks/use-auth";
import { useUserBots } from "@/hooks/use-user-bots";
import { cn } from "@/lib/utils";

const filters = ["All", "Active", "Completed"] as const;

export default function BotPage() {
  const { user } = useAuth();
  const { bots, activeCount } = useUserBots(user?.uid);
  const { bots: catalogBots } = useBotsCatalog();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const filteredUserBots = bots.filter((b) => {
    if (filter === "All") return true;
    if (filter === "Active") return b.status === "active";
    return b.status === "completed";
  });

  const filterCounts = {
    All: bots.length,
    Active: bots.filter((b) => b.status === "active").length,
    Completed: bots.filter((b) => b.status === "completed").length,
  };

  return (
    <>
      <AppHeader
        title="Copy Trading Bots"
        showBack
        backHref="/home"
        rightBadge={`${activeCount} Active`}
      />

      <div className="px-4 pb-4">
        <GoldButton
          onClick={() => setSubscribeOpen(true)}
          className="relative mb-4 w-full py-6"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Copy Trading Bot
          <Badge className="absolute right-4 border-yellow-400/50 bg-yellow-400 text-[10px] text-black">
            3% DAILY
          </Badge>
        </GoldButton>

        <div className="mb-4 flex gap-4 border-b border-white/5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "cursor-pointer pb-2 text-xs font-medium transition-colors",
                filter === f
                  ? "border-b-2 border-amber-400 text-amber-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {f} ({filterCounts[f]})
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <SmartWalletEngine />
      </div>

      {filteredUserBots.length === 0 ? (
        <div className="surface-flat mx-4 flex flex-col items-center py-10">
          <Image
            src="/assets/empty-no-bots.png"
            alt="No bots"
            width={200}
            height={150}
            className="mb-4 opacity-80"
          />
          <p className="text-zinc-500">No bots yet</p>
        </div>
      ) : (
        <div className="mb-6 space-y-3">
          {filteredUserBots.map((bot) => (
            <div
              key={bot.id}
              className="surface-flat mx-4 p-4"
            >
              <div className="flex justify-between">
                <span className="font-bold text-white">Your Bot</span>
                <span
                  className={cn(
                    "text-xs",
                    bot.status === "active" ? "text-emerald-400" : "text-zinc-500"
                  )}
                >
                  {bot.status.toUpperCase()}
                </span>
              </div>
              <p className="text-2xl font-bold text-amber-400">
                ₱{bot.amount.toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500">
                Earned: ₱{bot.totalAccrued.toFixed(2)} · 3% daily
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4 pb-4">
        <SectionHeader title="Signal Leaders" className="px-4" />
        {catalogBots.map((bot) => (
          <BotCatalogCard key={bot.id} bot={bot} />
        ))}
      </div>

      <SubscribeBotModal
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
      />
    </>
  );
}
