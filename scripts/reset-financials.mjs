/**
 * Reset all wallet balances, referral earnings, transactions, bots, deposits,
 * and withdrawal requests. User accounts (email, referral codes, roles) are kept.
 *
 * Usage: npm run reset:financials
 *        npm run reset:financials -- --confirm
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const REFERRAL_LEVEL_COUNT = 5;

function emptyReferralStats() {
  return {
    totalEarned: 0,
    levels: Array.from({ length: REFERRAL_LEVEL_COUNT }, () => ({
      members: 0,
      invested: 0,
      earned: 0,
    })),
  };
}

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function loadServiceAccount(env) {
  const jsonPath = resolve(root, "firebase-service-account.json");
  if (existsSync(jsonPath)) {
    return JSON.parse(readFileSync(jsonPath, "utf8"));
  }
  const raw = env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (raw && raw.length > 20) {
    return JSON.parse(raw);
  }
  throw new Error(
    "Missing credentials. Add firebase-service-account.json or FIREBASE_ADMIN_SERVICE_ACCOUNT in .env.local"
  );
}

function initAdmin(env) {
  if (getApps().length) return getFirestore();
  const sa = loadServiceAccount(env);
  initializeApp({
    credential: cert(sa),
    projectId: sa.project_id || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return getFirestore();
}

async function deleteCollection(db, collRef, batchSize = 400) {
  let deleted = 0;
  while (true) {
    const snap = await collRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

async function main() {
  const confirmed = process.argv.includes("--confirm");
  if (!confirmed) {
    console.log(
      "This will ZERO all wallet balances, delete all transactions, bots,\n" +
        "deposits, and withdrawal requests. User accounts are kept.\n\n" +
        "Run: npm run reset:financials -- --confirm"
    );
    process.exit(0);
  }

  const env = loadEnv();
  const db = initAdmin(env);
  console.log("Resetting financial data…\n");

  const usersSnap = await db.collection("users").get();
  let txDeleted = 0;
  let botsDeleted = 0;

  for (const userDoc of usersSnap.docs) {
    txDeleted += await deleteCollection(
      db,
      userDoc.ref.collection("transactions")
    );
    botsDeleted += await deleteCollection(db, userDoc.ref.collection("bots"));

    await userDoc.ref.update({
      walletBalance: 0,
      depositBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalEarnings: 0,
      referralStats: emptyReferralStats(),
      referralNetworkTracked: false,
      signupReferralCode: FieldValue.delete(),
    });
    console.log(`✓ reset user ${userDoc.data().email ?? userDoc.id}`);
  }

  const depositsDeleted = await deleteCollection(db, db.collection("deposits"));
  const withdrawalsDeleted = await deleteCollection(
    db,
    db.collection("withdrawalRequests")
  );

  await db.collection("appConfig").doc("platform").set(
    {
      enableTestDepositFulfillment: false,
      enableClientBotSubscribe: false,
      enableClientWithdrawals: false,
      resetAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("\nDone:");
  console.log(`  Users reset: ${usersSnap.size}`);
  console.log(`  Transactions deleted: ${txDeleted}`);
  console.log(`  Bots deleted: ${botsDeleted}`);
  console.log(`  Deposits deleted: ${depositsDeleted}`);
  console.log(`  Withdrawal requests deleted: ${withdrawalsDeleted}`);
  console.log("  Test-mode flags disabled on appConfig/platform");
}

main().catch((err) => {
  console.error("Reset failed:", err.message);
  process.exit(1);
});
