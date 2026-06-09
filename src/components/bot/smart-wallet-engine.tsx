"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Target, Shield, RefreshCw, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Target,
    text: "Four independent signal bots monitored and ranked in real time",
  },
  {
    icon: Shield,
    text: "Every signal source wallet is on-chain and verifiable via Solscan",
  },
  {
    icon: RefreshCw,
    text: "Engine auto-rotates to the top-performing strategy for your subscription",
  },
  {
    icon: Activity,
    text: "94–99% win rates across leaders with combined +$12.1M tracked PNL",
  },
];

export function SmartWalletEngine() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="surface-accent mx-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left cursor-pointer"
      >
        <Image
          src="/assets/smart-wallet-engine.png"
          alt="Smart Wallet Engine"
          width={48}
          height={48}
          className="rounded-full"
        />
        <div className="flex-1">
          <h3 className="font-bold text-white">Smart Wallet Engine</h3>
          <p className="text-xs text-zinc-500">
            4 Wallets · 95.9% Avg Win Rate · Auto-Calibrating
          </p>
        </div>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-400 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-amber-500/10 px-4 pb-4">
          <p className="py-3 text-[10px] font-semibold tracking-wider text-zinc-500">
            WHY TRADIQ IS DIFFERENT
          </p>
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="rounded-xl border border-white/5 bg-zinc-950 p-3">
                <Icon className="mb-2 h-4 w-4 text-amber-400" />
                <p className="text-[10px] leading-relaxed text-zinc-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
