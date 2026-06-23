import { Firestore } from "firebase-admin/firestore";
import {
  BotInvestmentData,
  dailyPayout,
  enrichBotInvestment,
} from "@/lib/investments";
import { TransactionStatus, TransactionType } from "@/types";

export const AUDIT_PAGE_SIZE = 50;

export type AuditTransactionFilter =
  | "all"
  | "deposits"
  | "withdrawals"
  | "earnings"
  | "referral"
  | "bot_investments";

export const AUDIT_FILTERS: { id: AuditTransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "earnings", label: "Bot Earnings" },
  { id: "referral", label: "Referral" },
  { id: "bot_investments", label: "Bot Investments" },
];

export interface AuditTransactionRow {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  title?: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
}

export interface WithdrawalBreakdown {
  pending: { count: number; amount: number };
  approved: { count: number; amount: number };
  rejected: { count: number; amount: number };
  expired: { count: number; amount: number };
  pendingExposure: number;
}

export interface AuditBotRow {
  id: string;
  amount: number;
  status: string;
  daysAccrued: number;
  termDays: number;
  daysRemaining: number;
  dailyDue: number;
  totalAccrued: number;
  remainingPayout: number;
  subscribedAt: string | null;
}

export interface AuditBotSummary {
  activeBotCount: number;
  activePrincipal: number;
  expectedDailyEarnings: number;
  totalAccruedToDate: number;
  remainingBotPayout: number;
}

export interface AuditFlag {
  id: string;
  message: string;
  severity: "warning" | "critical";
}

export interface AuditSummary {
  walletBalance: number;
  depositBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalEarnings: number;
  totalBotEarnings: number;
  totalReferralEarnings: number;
  totalEarned: number;
  earnedMatchesWithdrawals: boolean;
  credits: number;
  debits: number;
  ledgerBalance: number;
  balanceDelta: number;
  withdrawals: WithdrawalBreakdown;
  bots: AuditBotSummary;
  flags: AuditFlag[];
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

function normalizeStatus(status: unknown): TransactionStatus {
  const value = String(status ?? "pending").toLowerCase().trim();
  if (
    value === "paid" ||
    value === "approved" ||
    value === "pending" ||
    value === "expired" ||
    value === "rejected"
  ) {
    return value;
  }
  return "pending";
}

function normalizeType(type: unknown, title?: string): TransactionType {
  const raw = String(type ?? "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_");

  if (raw === "earnings") return "earning";
  if (
    raw === "deposit" ||
    raw === "deposit_bonus" ||
    raw === "bot_subscribe" ||
    raw === "earning" ||
    raw === "referral" ||
    raw === "withdrawal"
  ) {
    return raw;
  }

  const titleLower = (title ?? "").toLowerCase();
  if (
    titleLower.includes("daily bot earnings") ||
    titleLower.includes("final bot earnings") ||
    titleLower.includes("principal returned")
  ) {
    return "earning";
  }
  if (titleLower.includes("copy trading bot")) return "bot_subscribe";
  if (titleLower.includes("withdrawal")) return "withdrawal";
  if (titleLower.includes("referral")) return "referral";
  if (titleLower.includes("deposit") || titleLower.includes("qr ph")) {
    return "deposit";
  }

  return "deposit";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseAuditTransaction(
  id: string,
  data: FirebaseFirestore.DocumentData
): AuditTransactionRow {
  const title = data.title as string | undefined;
  return {
    id,
    type: normalizeType(data.type, title),
    amount: Number(data.amount) || 0,
    status: normalizeStatus(data.status),
    title,
    subtitle: data.subtitle as string | undefined,
    metadata: (data.metadata as Record<string, unknown> | undefined) ?? {},
    createdAt: toDate(data.createdAt)?.toISOString() ?? null,
  };
}

export function matchesAuditFilter(
  tx: Pick<AuditTransactionRow, "type">,
  filter: AuditTransactionFilter
): boolean {
  switch (filter) {
    case "deposits":
      return tx.type === "deposit" || tx.type === "deposit_bonus";
    case "withdrawals":
      return tx.type === "withdrawal";
    case "earnings":
      return tx.type === "earning";
    case "referral":
      return tx.type === "referral";
    case "bot_investments":
      return tx.type === "bot_subscribe";
    default:
      return true;
  }
}

export function filterAuditTransactions(
  transactions: AuditTransactionRow[],
  filter: AuditTransactionFilter
): AuditTransactionRow[] {
  if (filter === "all") return transactions;
  return transactions.filter((tx) => matchesAuditFilter(tx, filter));
}

function sortTransactionsDesc(
  transactions: AuditTransactionRow[]
): AuditTransactionRow[] {
  return [...transactions].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
  });
}

export function paginateAuditTransactions(
  transactions: AuditTransactionRow[],
  limit: number,
  cursor: string | null
): {
  items: AuditTransactionRow[];
  nextCursor: string | null;
  hasMore: boolean;
  totalMatching: number;
} {
  const sorted = sortTransactionsDesc(transactions);
  let startIndex = 0;

  if (cursor) {
    const cursorIndex = sorted.findIndex((tx) => tx.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const slice = sorted.slice(startIndex, startIndex + limit + 1);
  const hasMore = slice.length > limit;
  const items = slice.slice(0, limit);
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return {
    items,
    nextCursor,
    hasMore,
    totalMatching: sorted.length,
  };
}

function isPaidCredit(tx: AuditTransactionRow): boolean {
  return tx.status === "paid";
}

function isWalletDebit(tx: AuditTransactionRow): boolean {
  if (tx.type === "bot_subscribe") return tx.status === "paid";
  if (tx.type === "withdrawal") {
    return tx.status === "pending" || tx.status === "approved";
  }
  return false;
}

export function computeAuditSummary(
  profile: FirebaseFirestore.DocumentData,
  transactions: AuditTransactionRow[],
  botRows: AuditBotRow[]
): AuditSummary {
  let credits = 0;
  let debits = 0;
  let totalBotEarnings = 0;
  let totalReferralEarnings = 0;

  const withdrawals: WithdrawalBreakdown = {
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    expired: { count: 0, amount: 0 },
    pendingExposure: 0,
  };

  for (const tx of transactions) {
    if (tx.type === "earning" && isPaidCredit(tx)) {
      totalBotEarnings += tx.amount;
    }
    if (tx.type === "referral" && isPaidCredit(tx)) {
      totalReferralEarnings += tx.amount;
    }

    if (
      (tx.type === "deposit" ||
        tx.type === "deposit_bonus" ||
        tx.type === "earning" ||
        tx.type === "referral") &&
      isPaidCredit(tx)
    ) {
      credits += tx.amount;
    }

    if (isWalletDebit(tx)) {
      debits += tx.amount;
    }

    if (tx.type === "withdrawal") {
      const bucket =
        tx.status === "pending"
          ? withdrawals.pending
          : tx.status === "approved"
            ? withdrawals.approved
            : tx.status === "rejected"
              ? withdrawals.rejected
              : tx.status === "expired"
                ? withdrawals.expired
                : null;

      if (bucket) {
        bucket.count += 1;
        bucket.amount += tx.amount;
      }

      if (tx.status === "pending") {
        withdrawals.pendingExposure += tx.amount;
      }
    }
  }

  credits = round2(credits);
  debits = round2(debits);
  totalBotEarnings = round2(totalBotEarnings);
  totalReferralEarnings = round2(totalReferralEarnings);
  const totalEarned = round2(totalBotEarnings + totalReferralEarnings);

  const walletBalance = round2(Number(profile.walletBalance) || 0);
  const totalDeposited = round2(Number(profile.totalDeposited) || 0);
  const totalWithdrawn = round2(Number(profile.totalWithdrawn) || 0);
  const earnedMatchesWithdrawals =
    Math.abs(totalEarned - totalWithdrawn) < 0.01;
  const ledgerBalance = round2(credits - debits);
  const balanceDelta = round2(walletBalance - ledgerBalance);

  const activeBots = botRows.filter((b) => b.status === "active");
  const botSummary: AuditBotSummary = {
    activeBotCount: activeBots.length,
    activePrincipal: round2(
      activeBots.reduce((sum, b) => sum + b.amount, 0)
    ),
    expectedDailyEarnings: round2(
      activeBots.reduce((sum, b) => sum + b.dailyDue, 0)
    ),
    totalAccruedToDate: round2(
      botRows.reduce((sum, b) => sum + b.totalAccrued, 0)
    ),
    remainingBotPayout: round2(
      activeBots.reduce((sum, b) => sum + b.remainingPayout, 0)
    ),
  };

  const flags: AuditFlag[] = [];

  if (withdrawals.approved.amount > credits && credits > 0) {
    flags.push({
      id: "withdrawals_exceed_credits",
      message:
        "Approved withdrawals exceed documented deposits and earnings — review suggested.",
      severity: "critical",
    });
  } else if (withdrawals.approved.amount > credits) {
    flags.push({
      id: "withdrawals_exceed_credits",
      message:
        "Approved withdrawals exceed documented credits with no matching deposits — review suggested.",
      severity: "critical",
    });
  }

  if (
    walletBalance > 0 &&
    withdrawals.pending.amount > walletBalance * 0.8
  ) {
    flags.push({
      id: "high_pending_withdrawals",
      message:
        "Pending withdrawal exposure is high relative to current wallet balance — review suggested.",
      severity: "warning",
    });
  }

  if (Math.abs(balanceDelta) > 0.01) {
    flags.push({
      id: "ledger_mismatch",
      message: `Wallet balance differs from transaction ledger by ₱${Math.abs(balanceDelta).toLocaleString("en-PH", { minimumFractionDigits: 2 })} — review suggested.`,
      severity: "warning",
    });
  }

  if (Math.abs(totalWithdrawn - withdrawals.approved.amount) > 0.01) {
    flags.push({
      id: "profile_withdrawn_mismatch",
      message:
        "Profile total withdrawn does not match sum of approved withdrawal transactions — review suggested.",
      severity: "warning",
    });
  }

  return {
    walletBalance,
    depositBalance: round2(Number(profile.depositBalance) || 0),
    totalDeposited,
    totalWithdrawn,
    totalEarnings: round2(Number(profile.totalEarnings) || 0),
    totalBotEarnings,
    totalReferralEarnings,
    totalEarned,
    earnedMatchesWithdrawals,
    credits,
    debits,
    ledgerBalance,
    balanceDelta,
    withdrawals: {
      pending: {
        count: withdrawals.pending.count,
        amount: round2(withdrawals.pending.amount),
      },
      approved: {
        count: withdrawals.approved.count,
        amount: round2(withdrawals.approved.amount),
      },
      rejected: {
        count: withdrawals.rejected.count,
        amount: round2(withdrawals.rejected.amount),
      },
      expired: {
        count: withdrawals.expired.count,
        amount: round2(withdrawals.expired.amount),
      },
      pendingExposure: round2(withdrawals.pendingExposure),
    },
    bots: botSummary,
    flags,
  };
}

export async function fetchMemberAuditBots(
  db: Firestore,
  userId: string
): Promise<AuditBotRow[]> {
  const botsSnap = await db
    .collection("users")
    .doc(userId)
    .collection("bots")
    .get();

  const rows: AuditBotRow[] = [];

  for (const botDoc of botsSnap.docs) {
    const data = botDoc.data() as BotInvestmentData;
    const enriched = enrichBotInvestment(data, userId, botDoc.id);
    rows.push({
      id: enriched.id,
      amount: enriched.amount,
      status: enriched.status,
      daysAccrued: enriched.daysAccrued,
      termDays: enriched.termDays,
      daysRemaining: enriched.daysRemaining,
      dailyDue: enriched.dailyDue,
      totalAccrued: enriched.totalAccrued,
      remainingPayout: enriched.remainingPayout,
      subscribedAt: enriched.subscribedAt,
    });
  }

  rows.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? "");
  });

  return rows;
}

export async function fetchMemberAuditTransactions(
  db: Firestore,
  userId: string
): Promise<AuditTransactionRow[]> {
  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => parseAuditTransaction(doc.id, doc.data()));
}

export async function enrichReferralMetadata(
  db: Firestore,
  transactions: AuditTransactionRow[]
): Promise<AuditTransactionRow[]> {
  const missingIds = new Set<string>();

  for (const tx of transactions) {
    if (tx.type !== "referral") continue;
    const fromUserId = tx.metadata?.fromUserId;
    if (typeof fromUserId !== "string") continue;
    const name = tx.metadata?.fromUserDisplayName;
    const email = tx.metadata?.fromUserEmail;
    if (
      (typeof name === "string" && name.trim()) ||
      (typeof email === "string" && email.trim())
    ) {
      continue;
    }
    missingIds.add(fromUserId);
  }

  if (missingIds.size === 0) return transactions;

  const userSnaps = await Promise.all(
    [...missingIds].map((id) => db.collection("users").doc(id).get())
  );

  const labels = new Map<string, { displayName: string; email: string }>();
  for (const snap of userSnaps) {
    if (!snap.exists) continue;
    const data = snap.data()!;
    labels.set(snap.id, {
      displayName: String(data.displayName ?? ""),
      email: String(data.email ?? ""),
    });
  }

  return transactions.map((tx) => {
    if (tx.type !== "referral") return tx;
    const fromUserId = tx.metadata?.fromUserId;
    if (typeof fromUserId !== "string") return tx;
    const resolved = labels.get(fromUserId);
    if (!resolved) return tx;

    return {
      ...tx,
      metadata: {
        ...tx.metadata,
        fromUserDisplayName: resolved.displayName || tx.metadata?.fromUserDisplayName,
        fromUserEmail: resolved.email || tx.metadata?.fromUserEmail,
      },
    };
  });
}

export function parseAuditFilter(
  value: string | null
): AuditTransactionFilter {
  const valid: AuditTransactionFilter[] = [
    "all",
    "deposits",
    "withdrawals",
    "earnings",
    "referral",
    "bot_investments",
  ];
  if (valid.includes(value as AuditTransactionFilter)) {
    return value as AuditTransactionFilter;
  }
  return "all";
}
