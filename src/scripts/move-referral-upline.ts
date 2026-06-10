/**
 * Option A: Move a member's direct upline (referredBy) without moving past commissions.
 * Then rebuild referralStats member counts for all users.
 *
 * Usage:
 *   npx tsx src/scripts/move-referral-upline.ts <memberUid> <newUplineUid> <expectedOldUplineUid>
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { syncReferralStats } from "../lib/admin-calculations";
import { getReferralTotals, normalizeReferralStats } from "../lib/referral-stats";

const REFERRAL_DEPTH = 5;

function loadEnv() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function loadCredential() {
  const env = loadEnv();
  const raw = env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (raw && raw.length > 20) return JSON.parse(raw);
  const file = join(process.cwd(), "firebase-service-account.json");
  if (!existsSync(file)) {
    throw new Error(
      "Add firebase-service-account.json or FIREBASE_ADMIN_SERVICE_ACCOUNT in .env.local"
    );
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

function snapshotUser(data: FirebaseFirestore.DocumentData | undefined) {
  if (!data) return null;
  const stats = normalizeReferralStats(data.referralStats);
  const totals = getReferralTotals(stats);
  return {
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    role: data.role ?? "user",
    referredBy: (data.referredBy as string | null) ?? null,
    walletBalance: data.walletBalance ?? 0,
    directMembers: totals.directMembers,
    totalEarned: totals.totalEarned,
  };
}

async function wouldCreateCycle(
  db: FirebaseFirestore.Firestore,
  memberUid: string,
  newUplineUid: string
): Promise<boolean> {
  let current: string | null = newUplineUid;
  const visited = new Set<string>();

  while (current && visited.size < REFERRAL_DEPTH + 2) {
    if (current === memberUid) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    const snap = await db.collection("users").doc(current).get();
    if (!snap.exists) break;
    current = (snap.data()?.referredBy as string | undefined) ?? null;
  }
  return false;
}

async function main() {
  const memberUid = process.argv[2];
  const newUplineUid = process.argv[3];
  const expectedOldUplineUid = process.argv[4];

  if (!memberUid || !newUplineUid || !expectedOldUplineUid) {
    console.error(
      "Usage: npx tsx src/scripts/move-referral-upline.ts <memberUid> <newUplineUid> <expectedOldUplineUid>"
    );
    process.exit(1);
  }

  if (memberUid === newUplineUid) {
    throw new Error("Member cannot refer themselves");
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredential()) });
  }
  const db = getFirestore();

  const [memberSnap, newUplineSnap, oldUplineSnap] = await Promise.all([
    db.collection("users").doc(memberUid).get(),
    db.collection("users").doc(newUplineUid).get(),
    db.collection("users").doc(expectedOldUplineUid).get(),
  ]);

  if (!memberSnap.exists) throw new Error(`Member not found: ${memberUid}`);
  if (!newUplineSnap.exists) throw new Error(`New upline not found: ${newUplineUid}`);
  if (!oldUplineSnap.exists) {
    throw new Error(`Old upline not found: ${expectedOldUplineUid}`);
  }

  const memberData = memberSnap.data()!;
  const currentReferredBy = (memberData.referredBy as string | null) ?? null;

  if (currentReferredBy !== expectedOldUplineUid) {
    throw new Error(
      `Abort: member referredBy is "${currentReferredBy ?? "null"}", expected "${expectedOldUplineUid}"`
    );
  }

  if (await wouldCreateCycle(db, memberUid, newUplineUid)) {
    throw new Error("Abort: new upline would create a referral cycle");
  }

  const before = {
    member: snapshotUser(memberData),
    newUpline: snapshotUser(newUplineSnap.data()),
    oldUpline: snapshotUser(oldUplineSnap.data()),
  };

  console.log("Pre-flight OK. Applying Option A (link only, no wallet move)...");
  console.log("Before:", JSON.stringify(before, null, 2));

  const update: Record<string, unknown> = {
    referredBy: newUplineUid,
  };
  if (memberData.signupReferralCode) {
    update.signupReferralCode = FieldValue.delete();
  }

  await memberSnap.ref.update(update);
  console.log(`Updated users/${memberUid}.referredBy -> ${newUplineUid}`);

  const synced = await syncReferralStats(db);
  console.log(`Synced referral stats for ${synced} users`);

  const [memberAfterSnap, newUplineAfterSnap, oldUplineAfterSnap] =
    await Promise.all([
      db.collection("users").doc(memberUid).get(),
      db.collection("users").doc(newUplineUid).get(),
      db.collection("users").doc(expectedOldUplineUid).get(),
    ]);

  const after = {
    member: snapshotUser(memberAfterSnap.data()),
    newUpline: snapshotUser(newUplineAfterSnap.data()),
    oldUpline: snapshotUser(oldUplineAfterSnap.data()),
  };

  console.log("After:", JSON.stringify(after, null, 2));
  console.log("Done. Past commission wallets unchanged; future bot subs use new upline.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
