"use client";

import {
  formatPresentationUptime,
  getPresentationUptimeDays,
} from "@/lib/console/live-activity-format";

const SERVICES = [
  { label: "VPS Online", ok: true },
  { label: "RPC Connected", ok: true },
  { label: "Market Feed", ok: true },
  { label: "Wallet Engine", ok: true },
  { label: "Bot Running", ok: true },
];

export function LiveActivitySidebar() {
  const uptimeDays = getPresentationUptimeDays();

  return (
    <aside className="hidden w-52 shrink-0 border-l border-white/5 bg-zinc-950/80 p-4 lg:block">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
        System Health
      </p>
      <dl className="mt-3 space-y-2 font-mono text-[10px]">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Server</dt>
          <dd className="text-zinc-300">Singapore</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">RAM</dt>
          <dd className="text-zinc-300">1.6 / 3.8 GB</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Uptime</dt>
          <dd className="text-zinc-300">
            {formatPresentationUptime(uptimeDays)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">SOL Wallet</dt>
          <dd className="truncate text-zinc-400">Gjx73X…nLqohz</dd>
        </div>
      </dl>

      <p className="mt-6 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
        Service Status
      </p>
      <ul className="mt-3 space-y-2">
        {SERVICES.map(({ label, ok }) => (
          <li
            key={label}
            className="flex items-center gap-2 font-mono text-[10px] text-zinc-400"
          >
            <span
              className={
                ok
                  ? "h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  : "h-1.5 w-1.5 rounded-full bg-red-400"
              }
            />
            {label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
