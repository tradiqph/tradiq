/**
 * Link a member to a direct upline and backfill one-time bot subscription commissions.
 *
 * Usage:
 *   npx tsx src/scripts/repair-referral-link-and-commissions.ts --dry-run <memberEmail> <uplineEmail>
 *   npx tsx src/scripts/repair-referral-link-and-commissions.ts <memberEmail> <uplineEmail>
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { syncReferralStats } from "../lib/admin-calculations";
import {
  calculateReferralCommissions,
  formatPeso,
  REFERRAL_RATES,
} from "../lib/finance";
import {
  applyReferralCommissions,
  trackReferralSignup,
} from "../lib/referral-payout";
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
    referredBy: (data.referredBy as string | null) ?? null,
    walletBalance: data.walletBalance ?? 0,
    directMembers: totals.directMembers,
    totalEarned: totals.totalEarned,
  };
}

async function resolveUserByEmail(
  db: FirebaseFirestore.Firestore,
  email: string
) {
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

  const doc = snap.docs[0]!;
  return { uid: doc.id, data: doc.data(), ref: doc.ref };
}

async function wouldCreateCycle(
  db: FirebaseFirestore.Firestore,
  memberUid: string,
  uplineUid: string
): Promise<boolean> {
  let current: string | null = uplineUid;
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

async function getUplineChain(
  db: FirebaseFirestore.Firestore,
  startUid: string
): Promise<{ uid: string; email: string }[]> {
  const chain: { uid: string; email: string }[] = [];
  let current: string | null = startUid;

  for (let i = 0; i < REFERRAL_DEPTH && current; i++) {
    const snap = await db.collection("users").doc(current).get();
    if (!snap.exists) break;
    chain.push({
      uid: current,
      email: (snap.data()?.email as string) ?? current,
    });
    current = (snap.data()?.referredBy as string | undefined) ?? null;
  }

  return chain;
}

async function hasL1CommissionForSubscription(
  db: FirebaseFirestore.Firestore,
  l1UplineUid: string,
  memberUid: string,
  amount: number
): Promise<boolean> {
  const txSnap = await db
    .collection("users")
    .doc(l1UplineUid)
    .collection("transactions")
    .where("type", "==", "referral")
    .get();

  return txSnap.docs.some((doc) => {
    const meta = doc.data().metadata as
      | { fromUserId?: string; investmentAmount?: number }
      | undefined;
    return meta?.fromUserId === memberUid && meta?.investmentAmount === amount;
  });
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const emails = argv.filter((a) => !a.startsWith("--"));
  const memberEmail = emails[0];
  const uplineEmail = emails[1];

  if (!memberEmail || !uplineEmail) {
    console.error(
      "Usage: npx tsx src/scripts/repair-referral-link-and-commissions.ts [--dry-run] <memberEmail> <uplineEmail>"
    );
    process.exit(1);
  }

  return { dryRun, memberEmail, uplineEmail };
}

async function main() {
  const { dryRun, memberEmail, uplineEmail } = parseArgs(process.argv.slice(2));

  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredential()) });
  }
  const db = getFirestore();

  console.log(dryRun ? "=== DRY RUN (no writes) ===" : "=== LIVE RUN ===");
  console.log(`Member: ${memberEmail}`);
  console.log(`Upline: ${uplineEmail}`);
  console.log("");

  const member = await resolveUserByEmail(db, memberEmail);
  const upline = await resolveUserByEmail(db, uplineEmail);

  if (member.uid === upline.uid) {
    throw new Error("Member and upline cannot be the same user");
  }

  const currentReferredBy = (member.data.referredBy as string | null) ?? null;
  if (currentReferredBy !== null) {
    throw new Error(
      `Abort: member already has referredBy="${currentReferredBy}". Expected null.`
    );
  }

  if (await wouldCreateCycle(db, member.uid, upline.uid)) {
    throw new Error("Abort: linking would create a referral cycle");
  }

  const botsSnap = await member.ref.collection("bots").get();
  if (botsSnap.empty) {
    throw new Error("Abort: member has no bot subscriptions to commission");
  }

  const bots = botsSnap.docs.map((doc) => ({
    id: doc.id,
    amount: (doc.data().amount as number) ?? 0,
    status: (doc.data().status as string) ?? "unknown",
  }));

  const uplineChain = await getUplineChain(db, upline.uid);

  console.log("Pre-flight OK");
  console.log(`Member UID: ${member.uid}`);
  console.log(`Upline UID: ${upline.uid} (${upline.data.displayName ?? ""})`);
  console.log(
    "Bots:",
    bots.map((b) => `${b.id} status=${b.status} amount=${formatPeso(b.amount)}`).join("; ")
  );
  console.log(
    "Upline chain for commissions:",
    uplineChain.map((u, i) => `L${i + 1} ${u.email}`).join(" → ") || "(none)"
  );
  console.log("");

  for (const bot of bots) {
    const commissions = calculateReferralCommissions(bot.amount);
    const alreadyPaid = await hasL1CommissionForSubscription(
      db,
      upline.uid,
      member.uid,
      bot.amount
    );

    console.log(`Bot ${bot.id} (${formatPeso(bot.amount)}):`);
    commissions.forEach((c, i) => {
      const payee = uplineChain[i];
      if (!payee) return;
      console.log(`  L${i + 1} ${payee.email}: ${formatPeso(c)}`);
    });
    console.log(
      alreadyPaid
        ? "  -> SKIP commission (L1 already paid for this subscription)"
        : "  -> WILL APPLY commission"
    );
    console.log("");
  }

  const before = {
    member: snapshotUser(member.data),
    upline: snapshotUser(upline.data),
  };
  console.log("Before:", JSON.stringify(before, null, 2));

  if (dryRun) {
    console.log("\nDry run complete. No changes written.");
    return;
  }

  const update: Record<string, unknown> = {
    referredBy: upline.uid,
    referralNetworkTracked: false,
  };
  if (member.data.signupReferralCode) {
    update.signupReferralCode = FieldValue.delete();
  }

  await member.ref.update(update);
  console.log(`\nLinked users/${member.uid}.referredBy -> ${upline.uid}`);

  await trackReferralSignup(db, member.uid, { hadReferralCode: true });
  console.log("Tracked referral signup (member counts on uplines)");

  for (const bot of bots) {
    const alreadyPaid = await hasL1CommissionForSubscription(
      db,
      upline.uid,
      member.uid,
      bot.amount
    );
    if (alreadyPaid) {
      console.log(
        `Skipped commission for bot ${bot.id} (${formatPeso(bot.amount)}) — already paid`
      );
      continue;
    }

    await applyReferralCommissions(db, member.uid, bot.amount);
    console.log(
      `Applied commissions for bot ${bot.id} (${formatPeso(bot.amount)})`
    );
  }

  const synced = await syncReferralStats(db);
  console.log(`Synced referral stats for ${synced} users`);

  const [memberAfter, uplineAfter] = await Promise.all([
    member.ref.get(),
    upline.ref.get(),
  ]);

  const after = {
    member: snapshotUser(memberAfter.data()),
    upline: snapshotUser(uplineAfter.data()),
  };
  console.log("\nAfter:", JSON.stringify(after, null, 2));
  console.log("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
