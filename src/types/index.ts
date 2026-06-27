import { Timestamp } from "firebase/firestore";
import type { ReferralStats } from "@/lib/referral-stats";

export type UserRole = "super_admin" | "admin" | "user";

export type MemberRank = "member" | "leader" | "director" | "ambassador";

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
  /** Server-set flag so clients can detect PIN without reading the hash */
  hasSecurityPin?: boolean;
  role: UserRole;
  referralStats: ReferralStats;
  referralNetworkTracked?: boolean;
  /** Server-stored code for retry until referredBy is linked */
  signupReferralCode?: string;
  pushNotificationsEnabled?: boolean;
  memberRank?: MemberRank;
  rankActivatedAt?: Timestamp | null;
  /** Reward tier ids already claimed (tier_500k, tier_1m, tier_2m) */
  claimedRewardTiers?: string[];
  /** Super-admin only: marks qa@tradiq.biz as the QA test account */
  isTestAccount?: boolean;
  /** Temporary simulated eligibility for QA testing (qa@tradiq.biz only) */
  qaEligibilityOverride?: {
    enabled: boolean;
    enabledBy: string;
    enabledAt: Timestamp;
    expiresAt?: Timestamp;
    target: "leader_and_tier_500k";
  };
}

export type RewardClaimStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "received";

export interface RewardDeliveryAddress {
  street: string;
  barangay: string;
  city: string;
  postalCode: string;
}

export interface RewardClaim {
  referenceNumber: string;
  userId: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  rewardType: string;
  rewardName: string;
  rewardValue: number;
  deliveryAddress: RewardDeliveryAddress;
  status: RewardClaimStatus;
  courier?: string;
  trackingNumber?: string;
  claimedAt: Timestamp;
  shippedAt?: Timestamp;
  receivedAt?: Timestamp;
  createdBy: string;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface RewardClaimStatusHistoryEntry {
  status: RewardClaimStatus;
  updatedBy: string;
  updatedAt: Timestamp;
  courier?: string;
  trackingNumber?: string;
}

export type TransactionType =
  | "deposit"
  | "deposit_bonus"
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

export type PaymongoTransferStatus = "pending" | "succeeded" | "failed";

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
  paymongoTransferId?: string;
  paymongoTransferStatus?: PaymongoTransferStatus;
  paidAt?: Timestamp;
  paidBy?: string;
  payError?: string;
  payoutInFlight?: boolean;
  payoutLockedBy?: string;
  payoutLockedAt?: Timestamp;
}

export interface Deposit {
  userId: string;
  amount: number;
  paymongoIntentId: string;
  status: "pending" | "paid" | "expired";
  qrImageUrl?: string;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  source?: "paymongo" | "admin_cash";
  creditedBy?: string;
  creditedByEmail?: string;
  note?: string;
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
