import { Timestamp } from "firebase/firestore";
import type { ReferralStats } from "@/lib/referral-stats";

export type UserRole = "super_admin" | "admin" | "user";

export interface UserProfile {
  email: string;
  displayName: string;
  photoURL: string | null;
  referralCode: string;
  referredBy: string | null;
  memberSince: Timestamp;
  walletBalance: number;
  depositBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalEarnings: number;
  securityPinHash: string | null;
  role: UserRole;
  referralStats: ReferralStats;
  referralNetworkTracked?: boolean;
  /** Server-stored code for retry until referredBy is linked */
  signupReferralCode?: string;
}

export type TransactionType =
  | "deposit"
  | "bot_subscribe"
  | "earning"
  | "referral"
  | "withdrawal";

export type TransactionStatus =
  | "pending"
  | "paid"
  | "expired"
  | "approved"
  | "rejected";

export interface Transaction {
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  title?: string;
  subtitle?: string;
}

export interface UserBot {
  amount: number;
  status: "active" | "completed";
  dailyRate: number;
  subscribedAt: Timestamp;
  lastAccruedAt: Timestamp | null;
  totalAccrued: number;
  daysAccrued: number;
  termDays: number;
  catalogBotId?: string;
}

export interface WithdrawalAccount {
  label: string;
  accountType: string;
  accountNumber: string;
  accountName: string;
  bankName?: string;
}

export interface WithdrawalRequest {
  userId: string;
  userEmail: string;
  amount: number;
  processingFee?: number;
  processingFeeRate?: number;
  netPayout?: number;
  accountSnapshot: WithdrawalAccount;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}

export interface Deposit {
  userId: string;
  amount: number;
  paymongoIntentId: string;
  status: "pending" | "paid" | "expired";
  qrImageUrl: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface BotCatalogItem {
  name: string;
  strategy: string;
  description: string;
  rank: number;
  winRate: number;
  pnl: string;
  volume: string;
  trades: string;
  avgHold: string;
  isActive: boolean;
  avatarUrl: string;
  walletAddress: string;
  weeklyPnl: string;
  lastSignal: string;
}
