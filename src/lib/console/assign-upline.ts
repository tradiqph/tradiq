import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  reconcileUplineReferralMemberCounts,
} from "@/lib/admin-calculations";
import {
  calculateReferralCommissions,
  REFERRAL_RATES,
} from "@/lib/finance";
import {
  applyReferralCommissions,
  trackReferralSignup,
} from "@/lib/referral-payout";

export interface AssignUplineCommissionLevel {
  level: number;
  email: string;
  amount: number;
}

export interface AssignUplineResult {
  linked: boolean;
  member: { id: string; email: string; displayName: string };
  upline: { id: string; email: string; displayName: string };
  botsCommissioned: number;
  botsSkipped: number;
  commissionChain: AssignUplineCommissionLevel[];
}

export interface AssignMemberUplineInput {
  memberUid: string;
  uplineEmail: string;
  /** When true, only validate and preview — no writes. */
  dryRun?: boolean;
}

export async function resolveUserByEmail(db: Firestore, email: string) {
  const snap = await db
    .collection("users")
    .where("email", "==", email.trim().toLowerCase())
    .limit(2)
    .get();

  if (snap.empty) {
    throw new Error(`User not found for email: ${email}`);
  }
  if (snap.size > 1) {
    throw new Error(`Multiple users found for email: ${email}`);
  }

  const doc = snap.docs[0];
  return { uid: doc.id, ref: doc.ref, data: doc.data() };
}

export async function wouldCreateCycle(
  db: Firestore,
  memberUid: string,
  uplineUid: string
): Promise<boolean> {
  let current: string | null = uplineUid;
  const visited = new Set([memberUid]);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    const snap = await db.collection("users").doc(current).get();
    if (!snap.exists) break;
    current = (snap.data()?.referredBy as string | undefined) ?? null;
  }

  return false;
}

async function getUplineChain(db: Firestore, startUplineUid: string) {
  const chain: { uid: string; email: string; displayName: string }[] = [];
  let current: string | null = startUplineUid;

  for (let i = 0; i < REFERRAL_RATES.length && current; i++) {
    const snap = await db.collection("users").doc(current).get();
    if (!snap.exists) break;
    const data = snap.data() as FirebaseFirestore.DocumentData;
    chain.push({
      uid: current,
      email: String(data.email ?? current),
      displayName: String(data.displayName ?? ""),
    });
    current = (data.referredBy as string | undefined) ?? null;
  }

  return chain;
}

async function hasCommissionForBot(
  db: Firestore,
  memberUid: string,
  botId: string,
  l1UplineUid: string,
  mutateOrphanLedger = true
): Promise<boolean> {
  const ledgerRef = db
    .collection("referralCommissionEvents")
    .doc(`${memberUid}_${botId}`);
  const ledger = await ledgerRef.get();

  const l1TxSnap = await db
    .collection("users")
    .doc(l1UplineUid)
    .collection("transactions")
    .where("type", "==", "referral")
    .get();

  const paid = l1TxSnap.docs.some((doc) => {
    const meta = doc.data().metadata as
      | { fromUserId?: string; botId?: string }
      | undefined;
    return meta?.fromUserId === memberUid && meta?.botId === botId;
  });

  if (paid) return true;

  if (ledger.exists && mutateOrphanLedger) {
    await ledgerRef.delete();
  }

  return false;
}

function buildCommissionChain(
  uplineChain: { email: string; displayName: string }[],
  sampleAmount: number
): AssignUplineCommissionLevel[] {
  const commissions = calculateReferralCommissions(sampleAmount);
  return uplineChain.map((u, i) => ({
    level: i + 1,
    email: u.email,
    amount: commissions[i] ?? 0,
  }));
}

export async function assignMemberUpline(
  db: Firestore,
  input: AssignMemberUplineInput
): Promise<AssignUplineResult> {
  const { memberUid, uplineEmail, dryRun = false } = input;

  const memberSnap = await db.collection("users").doc(memberUid).get();
  if (!memberSnap.exists) {
    throw new Error("Member not found");
  }

  const member = {
    uid: memberSnap.id,
    ref: memberSnap.ref,
    data: memberSnap.data()!,
  };

  const upline = await resolveUserByEmail(db, uplineEmail);

  if (member.uid === upline.uid) {
    throw new Error("Member and upline cannot be the same user");
  }

  const currentReferredBy = (member.data.referredBy as string | null) ?? null;
  if (currentReferredBy !== null && currentReferredBy !== upline.uid) {
    throw new Error("Member already linked to a different upline");
  }

  if (currentReferredBy === null) {
    if (await wouldCreateCycle(db, member.uid, upline.uid)) {
      throw new Error("Linking would create a referral cycle");
    }
  }

  const botsSnap = await member.ref.collection("bots").get();
  const bots = botsSnap.docs.map((doc) => ({
    id: doc.id,
    amount: (doc.data().amount as number) ?? 0,
    status: (doc.data().status as string) ?? "unknown",
  }));

  const uplineChain = await getUplineChain(db, upline.uid);
  const sampleAmount = bots[0]?.amount ?? 0;
  const commissionChain = sampleAmount
    ? buildCommissionChain(uplineChain, sampleAmount)
    : uplineChain.map((u, i) => ({
        level: i + 1,
        email: u.email,
        amount: 0,
      }));

  let botsCommissioned = 0;
  let botsSkipped = 0;

  if (!dryRun && currentReferredBy === null) {
    const update: Record<string, unknown> = {
      referredBy: upline.uid,
      referralNetworkTracked: false,
    };
    if (member.data.signupReferralCode) {
      update.signupReferralCode = FieldValue.delete();
    }

    await member.ref.update(update);
    await trackReferralSignup(db, member.uid, { hadReferralCode: true });
    await reconcileUplineReferralMemberCounts(db, upline.uid);
  }

  if (!dryRun) {
    for (const bot of bots) {
      const alreadyPaid = await hasCommissionForBot(
        db,
        member.uid,
        bot.id,
        upline.uid
      );
      if (alreadyPaid) {
        botsSkipped += 1;
        continue;
      }

      await applyReferralCommissions(db, member.uid, bot.amount, {
        botId: bot.id,
      });
      botsCommissioned += 1;
    }
  } else {
    for (const bot of bots) {
      const alreadyPaid = await hasCommissionForBot(
        db,
        member.uid,
        bot.id,
        upline.uid,
        false
      );
      if (alreadyPaid) {
        botsSkipped += 1;
      }
    }
  }

  return {
    linked: currentReferredBy === null,
    member: {
      id: member.uid,
      email: String(member.data.email ?? ""),
      displayName: String(member.data.displayName ?? ""),
    },
    upline: {
      id: upline.uid,
      email: String(upline.data.email ?? ""),
      displayName: String(upline.data.displayName ?? ""),
    },
    botsCommissioned,
    botsSkipped,
    commissionChain,
  };
}
