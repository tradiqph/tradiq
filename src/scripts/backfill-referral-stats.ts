/**
 * Backfill per-level referral stats (members, invested, earned).
 * Run: npx tsx src/scripts/backfill-referral-stats.ts
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { syncReferralStats } from "../lib/admin-calculations";

function loadCredential() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (raw && raw.length > 20) return JSON.parse(raw);
  const file = join(process.cwd(), "firebase-service-account.json");
  if (!existsSync(file)) {
    console.error("Add firebase-service-account.json or set FIREBASE_ADMIN_SERVICE_ACCOUNT");
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadCredential()) });
}

const db = getFirestore();

syncReferralStats(db)
  .then((n) => console.log(`Synced referral stats for ${n} users`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
