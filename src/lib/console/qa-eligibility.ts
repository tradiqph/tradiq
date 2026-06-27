import {
  FieldValue,
  type Firestore,
  type Timestamp,
} from "firebase-admin/firestore";
import { normalizeMemberRank } from "@/lib/ranks/config";
import {
  isAllowedQaTestAccount,
  isQaOverrideActive,
  QA_OVERRIDE_TTL_MS,
  type QaEligibilityTarget,
} from "@/lib/console/qa-eligibility-shared";

export {
  isAllowedQaTestAccount,
  isQaOverrideActive,
  LEADER_QA_METRICS,
  QA_OVERRIDE_TTL_MS,
  QA_TEST_ACCOUNT_EMAIL,
  type QaEligibilityTarget,
} from "@/lib/console/qa-eligibility-shared";

export interface QaEligibilityOverride {
  enabled: boolean;
  enabledBy: string;
  enabledAt: Timestamp;
  expiresAt?: Timestamp;
  target: QaEligibilityTarget;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return null;
}

export function assertQaTestAccountEmail(
  userData: FirebaseFirestore.DocumentData
): void {
  if (!isAllowedQaTestAccount(userData.email as string | undefined)) {
    throw new Error(
      "QA tools are only available for the designated test account"
    );
  }
}

async function getUserOrThrow(db: Firestore, userId: string) {
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) {
    throw new Error("User not found");
  }
  const data = snap.data()!;
  assertQaTestAccountEmail(data);
  return { ref: snap.ref, data };
}

export interface QaEligibilityStatus {
  isTestAccount: boolean;
  overrideEnabled: boolean;
  expiresAt: string | null;
  memberRank: string;
  claimedRewardTiers: string[];
  claimsCount: number;
  pendingClaimsCount: number;
}

export async function getQaEligibilityStatus(
  db: Firestore,
  userId: string
): Promise<QaEligibilityStatus> {
  const { data } = await getUserOrThrow(db, userId);
  const override = data.qaEligibilityOverride as QaEligibilityOverride | undefined;

  const claimsSnap = await db
    .collection("reward_claims")
    .where("userId", "==", userId)
    .get();

  const pendingClaimsCount = claimsSnap.docs.filter(
    (doc) => doc.data().status === "pending"
  ).length;

  return {
    isTestAccount: data.isTestAccount === true,
    overrideEnabled: isQaOverrideActive(data),
    expiresAt: toIsoString(override?.expiresAt),
    memberRank: normalizeMemberRank(data.memberRank),
    claimedRewardTiers: Array.isArray(data.claimedRewardTiers)
      ? (data.claimedRewardTiers as string[])
      : [],
    claimsCount: claimsSnap.size,
    pendingClaimsCount,
  };
}

export async function markQaTestAccount(
  db: Firestore,
  userId: string,
  adminUid: string
): Promise<QaEligibilityStatus> {
  const { ref, data } = await getUserOrThrow(db, userId);
  if (data.isTestAccount === true) {
    return getQaEligibilityStatus(db, userId);
  }

  await ref.update({ isTestAccount: true });
  console.info(
    `[qa-eligibility] marked test account by ${adminUid} for ${userId}`
  );
  return getQaEligibilityStatus(db, userId);
}

export async function enableQaEligibility(
  db: Firestore,
  userId: string,
  adminUid: string
): Promise<QaEligibilityStatus> {
  const { ref, data } = await getUserOrThrow(db, userId);
  if (data.isTestAccount !== true) {
    throw new Error("Mark this account as a test account first");
  }

  const expiresAt = new Date(Date.now() + QA_OVERRIDE_TTL_MS);
  await ref.update({
    qaEligibilityOverride: {
      enabled: true,
      enabledBy: adminUid,
      enabledAt: FieldValue.serverTimestamp(),
      expiresAt,
      target: "leader_and_tier_500k",
    },
  });

  console.info(
    `[qa-eligibility] enabled override by ${adminUid} for ${userId}`
  );
  return getQaEligibilityStatus(db, userId);
}

export async function disableQaEligibility(
  db: Firestore,
  userId: string,
  adminUid: string
): Promise<QaEligibilityStatus> {
  const { ref } = await getUserOrThrow(db, userId);

  await ref.update({
    "qaEligibilityOverride.enabled": false,
  });

  console.info(
    `[qa-eligibility] disabled override by ${adminUid} for ${userId}`
  );
  return getQaEligibilityStatus(db, userId);
}

async function deletePendingRewardClaims(db: Firestore, userId: string) {
  const claimsSnap = await db
    .collection("reward_claims")
    .where("userId", "==", userId)
    .get();

  for (const claimDoc of claimsSnap.docs) {
    if (claimDoc.data().status !== "pending") continue;
    const historySnap = await claimDoc.ref.collection("statusHistory").get();
    const batch = db.batch();
    historySnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(claimDoc.ref);
    await batch.commit();
  }
}

export async function resetQaTestState(
  db: Firestore,
  userId: string,
  adminUid: string
): Promise<QaEligibilityStatus> {
  const { ref, data } = await getUserOrThrow(db, userId);
  if (data.isTestAccount !== true) {
    throw new Error("Mark this account as a test account first");
  }

  await deletePendingRewardClaims(db, userId);

  await ref.update({
    memberRank: "member",
    rankActivatedAt: FieldValue.delete(),
    claimedRewardTiers: [],
  });

  console.info(
    `[qa-eligibility] reset test state by ${adminUid} for ${userId}`
  );
  return getQaEligibilityStatus(db, userId);
}

export type QaEligibilityAction =
  | "markTestAccount"
  | "enable"
  | "disable"
  | "reset";
