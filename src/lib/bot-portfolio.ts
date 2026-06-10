import { enrichBotInvestment, type BotInvestmentData } from "@/lib/investments";
import { UserBot } from "@/types";

export function summarizeActiveBots(bots: (UserBot & { id: string })[]) {
  const activeBots = bots.filter((bot) => bot.status === "active");
  const completedCount = bots.filter((bot) => bot.status === "completed").length;

  let totalInvested = 0;
  let dailyEarnings = 0;
  let estimatedEarnings = 0;

  for (const bot of activeBots) {
    const data: BotInvestmentData = {
      amount: bot.amount,
      status: bot.status,
      dailyRate: bot.dailyRate,
      subscribedAt: bot.subscribedAt,
      lastAccruedAt: bot.lastAccruedAt,
      totalAccrued: bot.totalAccrued,
      daysAccrued: bot.daysAccrued,
      termDays: bot.termDays,
    };

    const enriched = enrichBotInvestment(data, "", bot.id);
    totalInvested += bot.amount;
    dailyEarnings += enriched.dailyDue;
    estimatedEarnings += enriched.daysRemaining * enriched.dailyDue;
  }

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    dailyEarnings: Math.round(dailyEarnings * 100) / 100,
    estimatedEarnings: Math.round(estimatedEarnings * 100) / 100,
    activeCount: activeBots.length,
    completedCount,
    totalCount: bots.length,
  };
}
