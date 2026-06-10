"use client";

import Image from "next/image";
import { Copy, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { BotCatalogItem } from "@/types";
import {
  solscanAccountUrl,
  truncateWallet,
} from "@/lib/bots-catalog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BotTrackRecordSheetProps {
  bot: (BotCatalogItem & { id?: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BotTrackRecordSheet({
  bot,
  open,
  onOpenChange,
}: BotTrackRecordSheetProps) {
  if (!bot) return null;

  const copyWallet = () => {
    navigator.clipboard.writeText(bot.walletAddress);
    toast.success("Wallet address copied");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-amber-500/20 bg-zinc-950">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3 text-left text-white">
            <Image
              src={bot.avatarUrl}
              alt={bot.name}
              width={40}
              height={40}
              className="rounded-full"
            />
            <div>
              <span className="block text-lg font-bold">{bot.name}</span>
              <span className="text-xs font-normal text-amber-400">
                {bot.strategy}
              </span>
            </div>
            {bot.isActive && (
              <Badge className="ml-auto border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                LIVE
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          {bot.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "All-time PNL", value: bot.pnl, green: true },
            { label: "7-day PNL", value: bot.weeklyPnl, green: true },
            { label: "Win rate", value: `${bot.winRate}%` },
            { label: "Last signal", value: bot.lastSignal },
            { label: "Volume", value: bot.volume },
            { label: "Trades", value: bot.trades },
            { label: "Avg hold", value: bot.avgHold },
            { label: "Rank", value: `#${bot.rank}` },
          ].map(({ label, value, green }) => (
            <div
              key={label}
              className="rounded-xl border border-amber-500/10 bg-black/40 p-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-bold",
                  green ? "text-emerald-400" : "text-white"
                )}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Signal source wallet
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <code className="text-sm text-amber-400">
              {truncateWallet(bot.walletAddress)}
            </code>
            <button
              type="button"
              onClick={copyWallet}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/20 text-zinc-400 hover:text-white cursor-pointer"
              aria-label="Copy wallet address"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {bot.binanceLeadUrl ? (
          <a
            href={bot.binanceLeadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-3 text-sm font-medium text-amber-300 hover:bg-amber-500/15 hover:text-amber-200 cursor-pointer"
          >
            View on Binance Copy Trading
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}

        <a
          href={solscanAccountUrl(bot.walletAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-black/40 py-3 text-sm text-zinc-300 hover:text-white cursor-pointer",
            bot.binanceLeadUrl ? "mt-2" : "mt-4"
          )}
        >
          Verify on Solscan
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </SheetContent>
    </Sheet>
  );
}
