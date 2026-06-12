"use client";

import { useEffect, useState } from "react";

const POOLS = [
  "BSC liquidity pools",
  "SOL/USDT pairs",
  "RAY pools",
  "285 pools",
  "DEX entry setups",
  "mid-cap momentum",
];

export function LiveActivityScanBar() {
  const [progress, setProgress] = useState(0);
  const [poolIndex, setPoolIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 4));
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPoolIndex((i) => (i + 1) % POOLS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const blocks = 12;
  const filled = Math.floor((progress / 100) * blocks);

  return (
    <div className="border-t border-white/5 bg-zinc-950 px-4 py-2 font-mono text-[10px] sm:text-xs">
      <div className="flex flex-wrap items-center gap-2 text-cyan-400">
        <span className="font-bold">SCAN</span>
        <span className="text-zinc-600">[</span>
        {Array.from({ length: blocks }).map((_, i) => (
          <span
            key={i}
            className={
              i < filled ? "text-cyan-400" : "text-zinc-700"
            }
          >
            {i < filled ? "█" : "░"}
          </span>
        ))}
        <span className="text-zinc-600">]</span>
        <span className="text-zinc-500">
          scanning {POOLS[poolIndex]}…
        </span>
      </div>
    </div>
  );
}
