import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  aggregateConsoleStats,
  fetchAllInvestments,
} from "@/lib/console/aggregate-stats";
import {
  getReferralLevelSummaries,
  getReferralTotals,
  normalizeReferralStats,
} from "@/lib/referral-stats";
import { REFERRAL_RATES } from "@/lib/finance";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function inRange(
  iso: string | null,
  from: Date | null,
  to: Date | null
): boolean {
  if (!iso) return !from && !to;
  const d = new Date(iso);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "platform-summary";
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const from = parseDate(request.nextUrl.searchParams.get("from"));
  const to = parseDate(request.nextUrl.searchParams.get("to"));
  if (to) to.setHours(23, 59, 59, 999);

  let rows: Record<string, unknown>[] = [];
  let filename = "report";

  switch (type) {
    case "daily-liability": {
      filename = "daily-liability";
      const { investments } = await fetchAllInvestments(auth.db, "active");
      rows = investments.map((i) => ({
        member: i.displayName || i.email,
        email: i.email,
        principal: i.amount,
        dailyDue: i.dailyDue,
        day: `${i.daysAccrued}/${i.termDays}`,
        dueToday: i.dueToday ? "yes" : "no",
        maturityDate: i.maturityAt,
        status: i.status,
      }));
      break;
    }
    case "withdrawals": {
      filename = "withdrawals";
      const snap = await auth.db
        .collection("withdrawalRequests")
        .orderBy("createdAt", "desc")
        .get();
      rows = snap.docs
        .map((d) => {
          const data = d.data();
          const createdAt = data.createdAt?.toDate?.()?.toISOString() ?? null;
          return {
            id: d.id,
            userEmail: data.userEmail,
            amount: data.amount,
            status: data.status,
            createdAt,
            reviewedAt: data.reviewedAt?.toDate?.()?.toISOString() ?? null,
          };
        })
        .filter((r) => inRange(r.createdAt, from, to));
      break;
    }
    case "members": {
      filename = "members";
      const snap = await auth.db.collection("users").get();
      rows = snap.docs.map((d) => {
        const data = d.data();
        const referral = normalizeReferralStats(data.referralStats);
        const totals = getReferralTotals(referral);
        const levels = getReferralLevelSummaries(referral);
        return {
          displayName: data.displayName,
          email: data.email,
          referralCode: data.referralCode,
          role: data.role,
          walletBalance: data.walletBalance ?? 0,
          depositBalance: data.depositBalance ?? 0,
          totalDeposited: data.totalDeposited ?? 0,
          totalWithdrawn: data.totalWithdrawn ?? 0,
          totalBotEarnings: data.totalEarnings ?? 0,
          referralEarned: totals.totalEarned,
          referralNetwork: totals.totalMembers,
          directReferrals: totals.directMembers,
          downlineInvested: totals.totalInvested,
          ...Object.fromEntries(
            levels.flatMap((l) => [
              [`l${l.level}Members`, l.members],
              [`l${l.level}Invested`, l.invested],
              [`l${l.level}Earned`, l.earned],
            ])
          ),
        };
      });
      break;
    }
    case "referrals": {
      filename = "referrals";
      const snap = await auth.db.collection("users").get();
      const platformLevels = REFERRAL_RATES.map((rate, i) => ({
        level: i + 1,
        percent: Math.round(rate * 100),
        members: 0,
        invested: 0,
        earned: 0,
      }));

      for (const d of snap.docs) {
        const levels = getReferralLevelSummaries(
          normalizeReferralStats(d.data().referralStats)
        );
        for (const l of levels) {
          const row = platformLevels[l.level - 1];
          row.members += l.members;
          row.invested += l.invested;
          row.earned += l.earned;
        }
      }

      rows = platformLevels.map((l) => ({
        level: l.level,
        commissionPercent: l.percent,
        totalMembers: l.members,
        totalDownlineInvested: Math.round(l.invested * 100) / 100,
        totalCommissionsEarned: Math.round(l.earned * 100) / 100,
      }));
      break;
    }
    case "investments": {
      filename = "investments";
      const { investments } = await fetchAllInvestments(auth.db, "all");
      rows = investments
        .filter((i) => inRange(i.subscribedAt, from, to))
        .map((i) => ({
          member: i.displayName || i.email,
          email: i.email,
          principal: i.amount,
          day: `${i.daysAccrued}/${i.termDays}`,
          dailyDue: i.dailyDue,
          totalAccrued: i.totalAccrued,
          maturityDate: i.maturityAt,
          status: i.status,
          subscribedAt: i.subscribedAt,
        }));
      break;
    }
    case "platform-summary":
    default: {
      filename = "platform-summary";
      const stats = await aggregateConsoleStats(auth.db);
      rows = [stats as unknown as Record<string, unknown>];
      break;
    }
  }

  if (format === "csv") {
    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  return NextResponse.json({ type, rows });
}
