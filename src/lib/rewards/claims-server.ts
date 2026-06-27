import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getRankBadge } from "@/lib/ranks/display";
import { loadRankMetrics } from "@/lib/ranks/metrics";
import type { RankMetrics } from "@/lib/ranks/progress";
import {
  getEffectiveRewardGroupSales,
  getRewardTierProgress,
  getRewardTier,
  isRewardTierEligible,
  type RewardClaimStatus,
  type RewardTierProgress,
  type RewardType,
} from "@/lib/rewards/config";
import { allocateRewardReferenceNumber } from "@/lib/rewards/reference";
import {
  normalizePhilippinePhone,
  type RewardClaimInput,
} from "@/lib/rewards/validation";
import type { RewardClaim, RewardDeliveryAddress } from "@/types";

export interface RewardProgressResponse {
  groupSales: number;
  lifetimeGroupSales: number;
  claimedRewardTiers: string[];
  tiers: RewardTierProgress[];
  metrics: RankMetrics;
  currentRank: string;
  currentBadge: string;
  claims: SerializedRewardClaim[];
  qaOverrideActive: boolean;
}

export async function loadRewardProgress(
  db: Firestore,
  userId: string
): Promise<RewardProgressResponse> {
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    throw new Error("User not found");
  }

  const userData = userSnap.data() ?? {};
  const claimedRewardTiers = Array.isArray(userData.claimedRewardTiers)
    ? (userData.claimedRewardTiers as string[])
    : [];

  const { metrics, currentRank, qaOverrideActive } = await loadRankMetrics(
    db,
    userId
  );

  const claimsSnap = await db
    .collection("reward_claims")
    .where("userId", "==", userId)
    .orderBy("claimedAt", "desc")
    .get();

  const claims = claimsSnap.docs.map((doc) =>
    serializeRewardClaim(doc.id, doc.data())
  );

  return {
    groupSales: getEffectiveRewardGroupSales(
      metrics.groupSales,
      claimedRewardTiers
    ),
    lifetimeGroupSales: metrics.groupSales,
    claimedRewardTiers,
    tiers: getRewardTierProgress(metrics, claimedRewardTiers),
    metrics,
    currentRank,
    currentBadge: getRankBadge(currentRank),
    claims,
    qaOverrideActive,
  };
}

export interface SubmitRewardClaimResult {
  claimId: string;
  referenceNumber: string;
  status: RewardClaimStatus;
  rewardName: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  rewardValue: number;
  deliveryAddress: RewardDeliveryAddress;
  claimedAt: Date;
}

export async function submitRewardClaim(
  db: Firestore,
  userId: string,
  input: RewardClaimInput
): Promise<SubmitRewardClaimResult> {
  const rewardType = input.rewardType as RewardType;
  const tier = getRewardTier(rewardType);
  const memberPhone = normalizePhilippinePhone(input.memberPhone);

  const { metrics } = await loadRankMetrics(db, userId);
  const userSnap = await db.collection("users").doc(userId).get();
  const claimedRewardTiers = Array.isArray(userSnap.data()?.claimedRewardTiers)
    ? (userSnap.data()!.claimedRewardTiers as string[])
    : [];

  if (!isRewardTierEligible(rewardType, metrics, claimedRewardTiers)) {
    throw new Error("Reward requirements not met");
  }

  const claimRef = db.collection("reward_claims").doc();

  const result = await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(userId);
    const userSnapTx = await tx.get(userRef);
    if (!userSnapTx.exists) {
      throw new Error("User not found");
    }

    const userData = userSnapTx.data() ?? {};
    const claimed = Array.isArray(userData.claimedRewardTiers)
      ? [...(userData.claimedRewardTiers as string[])]
      : [];

    if (claimed.includes(rewardType)) {
      throw new Error("This reward has already been claimed");
    }

    if (!isRewardTierEligible(rewardType, metrics, claimed)) {
      throw new Error("Reward requirements not met");
    }

    const referenceNumber = await allocateRewardReferenceNumber(db, tx);
    const memberName = input.memberName.trim();
    const memberEmail = input.memberEmail.trim().toLowerCase();

    const claimData: Omit<RewardClaim, "claimedAt"> & {
      claimedAt: FirebaseFirestore.FieldValue;
    } = {
      referenceNumber,
      userId,
      memberName,
      memberEmail,
      memberPhone,
      rewardType,
      rewardName: tier.name,
      rewardValue: tier.threshold,
      deliveryAddress: input.deliveryAddress,
      status: "pending",
      createdBy: userId,
      claimedAt: FieldValue.serverTimestamp(),
    };

    tx.set(claimRef, claimData);
    tx.update(userRef, {
      claimedRewardTiers: FieldValue.arrayUnion(rewardType),
    });

    const historyRef = claimRef.collection("statusHistory").doc();
    tx.set(historyRef, {
      status: "pending",
      updatedBy: userId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      referenceNumber,
      memberName,
      memberEmail,
      memberPhone,
    };
  });

  return {
    claimId: claimRef.id,
    referenceNumber: result.referenceNumber,
    status: "pending",
    rewardName: tier.name,
    memberName: result.memberName,
    memberEmail: result.memberEmail,
    memberPhone: result.memberPhone,
    rewardValue: tier.threshold,
    deliveryAddress: input.deliveryAddress,
    claimedAt: new Date(),
  };
}

export interface SerializedRewardClaim {
  id: string;
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
  claimedAt: { seconds: number } | null;
  shippedAt?: { seconds: number } | null;
  receivedAt?: { seconds: number } | null;
  createdBy: string;
  updatedBy?: string;
  updatedAt?: { seconds: number } | null;
}

function serializeTimestamp(value: unknown): { seconds: number } | null {
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return {
      seconds: Math.floor(
        (value as { toDate: () => Date }).toDate().getTime() / 1000
      ),
    };
  }
  if (typeof (value as { _seconds?: number })._seconds === "number") {
    return { seconds: (value as { _seconds: number })._seconds };
  }
  if (typeof (value as { seconds?: number }).seconds === "number") {
    return { seconds: (value as { seconds: number }).seconds };
  }
  return null;
}

export function serializeRewardClaim(
  id: string,
  data: FirebaseFirestore.DocumentData
): SerializedRewardClaim {
  return {
    id,
    referenceNumber: String(data.referenceNumber ?? ""),
    userId: String(data.userId ?? ""),
    memberName: String(data.memberName ?? ""),
    memberEmail: String(data.memberEmail ?? ""),
    memberPhone: String(data.memberPhone ?? ""),
    rewardType: String(data.rewardType ?? ""),
    rewardName: String(data.rewardName ?? ""),
    rewardValue: Number(data.rewardValue ?? 0),
    deliveryAddress: (data.deliveryAddress ?? {
      street: "",
      barangay: "",
      city: "",
      postalCode: "",
    }) as RewardDeliveryAddress,
    status: (data.status ?? "pending") as RewardClaimStatus,
    courier: data.courier ? String(data.courier) : undefined,
    trackingNumber: data.trackingNumber
      ? String(data.trackingNumber)
      : undefined,
    claimedAt: serializeTimestamp(data.claimedAt),
    shippedAt: serializeTimestamp(data.shippedAt) ?? undefined,
    receivedAt: serializeTimestamp(data.receivedAt) ?? undefined,
    createdBy: String(data.createdBy ?? ""),
    updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
    updatedAt: serializeTimestamp(data.updatedAt) ?? undefined,
  };
}

export function claimMatchesSearch(
  claim: SerializedRewardClaim,
  search: string
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    claim.referenceNumber.toLowerCase().includes(q) ||
    claim.memberName.toLowerCase().includes(q) ||
    claim.memberEmail.toLowerCase().includes(q) ||
    claim.rewardName.toLowerCase().includes(q)
  );
}

export function claimInDateRange(
  claim: SerializedRewardClaim,
  dateFrom: string | null,
  dateTo: string | null
): boolean {
  if (!dateFrom && !dateTo) return true;
  const seconds = claim.claimedAt?.seconds;
  if (!seconds) return false;

  const claimDate = new Date(seconds * 1000);
  const claimKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(claimDate);

  if (dateFrom && claimKey < dateFrom) return false;
  if (dateTo && claimKey > dateTo) return false;
  return true;
}

export async function fetchRewardClaimSummary(
  db: Firestore
): Promise<Record<RewardClaimStatus, number>> {
  const snap = await db.collection("reward_claims").get();
  const summary: Record<RewardClaimStatus, number> = {
    pending: 0,
    processing: 0,
    shipped: 0,
    received: 0,
  };

  for (const doc of snap.docs) {
    const status = doc.data().status as RewardClaimStatus;
    if (status in summary) {
      summary[status] += 1;
    }
  }

  return summary;
}

export interface RewardClaimStatusHistoryItem {
  id: string;
  status: RewardClaimStatus;
  updatedBy: string;
  updatedAt: { seconds: number } | null;
  courier?: string;
  trackingNumber?: string;
}

export async function fetchRewardClaimHistory(
  db: Firestore,
  claimId: string
): Promise<RewardClaimStatusHistoryItem[]> {
  const snap = await db
    .collection("reward_claims")
    .doc(claimId)
    .collection("statusHistory")
    .orderBy("updatedAt", "desc")
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      status: data.status as RewardClaimStatus,
      updatedBy: String(data.updatedBy ?? ""),
      updatedAt: serializeTimestamp(data.updatedAt),
      courier: data.courier ? String(data.courier) : undefined,
      trackingNumber: data.trackingNumber
        ? String(data.trackingNumber)
        : undefined,
    };
  });
}

export async function updateRewardClaimStatus(
  db: Firestore,
  params: {
    claimId: string;
    status: RewardClaimStatus;
    adminUid: string;
    courier?: string;
    trackingNumber?: string;
  }
): Promise<{
  claim: SerializedRewardClaim;
  previousStatus: RewardClaimStatus;
  sendShipmentEmail: boolean;
}> {
  const claimRef = db.collection("reward_claims").doc(params.claimId);

  const result = await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) {
      throw new Error("Claim not found");
    }

    const current = claimSnap.data()!;
    const previousStatus = current.status as RewardClaimStatus;

    const update: Record<string, unknown> = {
      status: params.status,
      updatedBy: params.adminUid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (params.status === "shipped") {
      update.shippedAt = FieldValue.serverTimestamp();
      if (params.courier !== undefined) {
        update.courier = params.courier.trim() || null;
      }
      if (params.trackingNumber !== undefined) {
        update.trackingNumber = params.trackingNumber.trim() || null;
      }
    }

    if (params.status === "received") {
      update.receivedAt = FieldValue.serverTimestamp();
    }

    tx.update(claimRef, update);

    const historyRef = claimRef.collection("statusHistory").doc();
    tx.set(historyRef, {
      status: params.status,
      updatedBy: params.adminUid,
      updatedAt: FieldValue.serverTimestamp(),
      ...(params.courier ? { courier: params.courier.trim() } : {}),
      ...(params.trackingNumber
        ? { trackingNumber: params.trackingNumber.trim() }
        : {}),
    });

    return {
      previousStatus,
      sendShipmentEmail:
        params.status === "shipped" && previousStatus !== "shipped",
      claimData: { ...current, ...update },
    };
  });

  const updatedSnap = await claimRef.get();
  return {
    claim: serializeRewardClaim(params.claimId, updatedSnap.data() ?? result.claimData),
    previousStatus: result.previousStatus,
    sendShipmentEmail: result.sendShipmentEmail,
  };
}
