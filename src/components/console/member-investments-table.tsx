"use client";

import { format } from "date-fns";
import { PesoAmount } from "@/components/ui/peso-amount";
import { formatPeso } from "@/lib/finance";
import {
  type ConsoleBotInvestment,
  type MemberInvestmentGroup,
} from "@/lib/console/investments-group";
import { cn } from "@/lib/utils";

function formatNextPayout(investment: ConsoleBotInvestment): string {
  if (!investment.nextPayoutAt || investment.status !== "active") {
    return "—";
  }
  if (
    investment.maturityAt &&
    new Date(investment.nextPayoutAt).getTime() ===
      new Date(investment.maturityAt).getTime()
  ) {
    return "—";
  }
  return format(new Date(investment.nextPayoutAt), "MMM d, yyyy HH:mm");
}

function DueTodayCell({ bot }: { bot: ConsoleBotInvestment }) {
  if (bot.payoutTodayStatus === "added") {
    return <span className="text-emerald-400">+3% added</span>;
  }
  if (bot.payoutTodayStatus === "pending") {
    return <span className="text-amber-400">Yes</span>;
  }
  return <span className="text-zinc-600">No</span>;
}

function MemberCell({ group }: { group: MemberInvestmentGroup }) {
  return (
    <div>
      <p className="text-white">{group.displayName || group.email}</p>
      <p className="text-xs text-zinc-500">{group.email}</p>
      {group.bots.length > 1 && (
        <p className="mt-1 text-[10px] text-amber-400/80">
          {group.bots.length} bots
        </p>
      )}
    </div>
  );
}

function BotDetailGrid({
  bot,
  dueColumnLabel,
}: {
  bot: ConsoleBotInvestment;
  dueColumnLabel: string;
}) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Principal", value: <PesoAmount amount={bot.amount} gold /> },
    {
      label: "Day",
      value: (
        <span className="font-mono text-amber-400">
          {bot.daysAccrued}/{bot.termDays}
        </span>
      ),
    },
    { label: "Daily due", value: formatPeso(bot.dailyDue) },
    { label: "Total accrued", value: formatPeso(bot.totalAccrued) },
    {
      label: "Remaining payout",
      value:
        bot.status === "active" ? (
          <PesoAmount amount={bot.remainingPayout} />
        ) : (
          "—"
        ),
    },
    { label: dueColumnLabel, value: <DueTodayCell bot={bot} /> },
    {
      label: "Last payout",
      value: bot.lastAccruedAt
        ? format(new Date(bot.lastAccruedAt), "MMM d, HH:mm")
        : "—",
    },
    { label: "Next payout", value: formatNextPayout(bot) },
    {
      label: "Maturity",
      value: bot.maturityAt
        ? format(new Date(bot.maturityAt), "MMM d, yyyy HH:mm")
        : "—",
    },
    {
      label: "Status",
      value: <span className="capitalize">{bot.status}</span>,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            {field.label}
          </dt>
          <dd className="mt-0.5 text-sm text-zinc-300">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface MemberInvestmentsTableProps {
  groups: MemberInvestmentGroup[];
  emptyMessage?: string;
  dueColumnLabel?: string;
}

export function MemberInvestmentsTable({
  groups,
  emptyMessage = "No bot investments found",
  dueColumnLabel = "Due today",
}: MemberInvestmentsTableProps) {
  if (groups.length === 0) {
    return (
      <div className="surface-flat p-8 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  const headers = [
    "Member",
    "Principal",
    "Day",
    "Daily due",
    "Total accrued",
    "Remaining payout",
    dueColumnLabel,
    "Last payout",
    "Next payout",
    "Maturity",
    "Status",
  ];

  return (
    <>
      <div className="space-y-3 md:hidden">
        {groups.map((group) => (
          <div key={group.userId} className="surface-flat rounded-xl p-3">
            <MemberCell group={group} />
            <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
              {group.bots.map((bot, index) => (
                <div
                  key={bot.id}
                  className={cn(
                    index > 0 && "border-t border-white/5 pt-3"
                  )}
                >
                  {group.bots.length > 1 && (
                    <p className="mb-2 text-[10px] font-medium text-zinc-500 uppercase">
                      Bot {index + 1}
                    </p>
                  )}
                  <BotDetailGrid bot={bot} dueColumnLabel={dueColumnLabel} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="surface-flat hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs text-zinc-500">
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              group.bots.map((bot, botIndex) => (
                <tr
                  key={bot.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  {botIndex === 0 && (
                    <td
                      rowSpan={group.bots.length}
                      className="px-4 py-3 align-top"
                    >
                      <MemberCell group={group} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <PesoAmount amount={bot.amount} gold />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-amber-400">
                      {bot.daysAccrued}/{bot.termDays}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatPeso(bot.dailyDue)}</td>
                  <td className="px-4 py-3">{formatPeso(bot.totalAccrued)}</td>
                  <td className="px-4 py-3">
                    {bot.status === "active" ? (
                      <PesoAmount amount={bot.remainingPayout} />
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DueTodayCell bot={bot} />
                  </td>
                  <td className="px-4 py-3">
                    {bot.lastAccruedAt
                      ? format(new Date(bot.lastAccruedAt), "MMM d, HH:mm")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatNextPayout(bot)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {bot.maturityAt
                      ? format(new Date(bot.maturityAt), "MMM d, yyyy HH:mm")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize text-zinc-400">
                      {bot.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
