export interface ConsoleBotInvestment {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  amount: number;
  status: string;
  daysAccrued: number;
  termDays: number;
  dailyDue: number;
  totalAccrued: number;
  dueToday: boolean;
  payoutTodayStatus: "pending" | "added" | null;
  completingToday: boolean;
  subscribedAt: string | null;
  lastAccruedAt: string | null;
  nextPayoutAt: string | null;
  maturityAt: string | null;
  remainingPayout: number;
}

export interface MemberInvestmentGroup {
  userId: string;
  displayName: string;
  email: string;
  bots: ConsoleBotInvestment[];
}

export function groupInvestmentsByMember(
  investments: ConsoleBotInvestment[]
): MemberInvestmentGroup[] {
  const byUser = new Map<string, MemberInvestmentGroup>();

  for (const investment of investments) {
    let group = byUser.get(investment.userId);
    if (!group) {
      group = {
        userId: investment.userId,
        displayName: investment.displayName,
        email: investment.email,
        bots: [],
      };
      byUser.set(investment.userId, group);
    }
    group.bots.push(investment);
  }

  const groups = [...byUser.values()];

  for (const group of groups) {
    group.bots.sort((a, b) =>
      (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? "")
    );
  }

  groups.sort((a, b) =>
    (a.displayName || a.email).localeCompare(b.displayName || b.email)
  );

  return groups;
}
