/**
 * Link a member to a direct upline and backfill L1–L5 bot subscription commissions.
 *
 * Usage:
 *   npx tsx src/scripts/link-referral-upline.ts --dry-run <memberEmail> <uplineEmail>
 *   npx tsx src/scripts/link-referral-upline.ts <memberEmail> <uplineEmail>
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  assignMemberUpline,
  resolveUserByEmail,
} from "../lib/console/assign-upline";
import { formatPeso } from "../lib/finance";

function loadCredential() {
  const envPath = join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1);
      if (key === "FIREBASE_ADMIN_SERVICE_ACCOUNT" && val.length > 20) {
        return JSON.parse(val);
      }
    }
  }
  const file = join(process.cwd(), "firebase-service-account.json");
  if (!existsSync(file)) {
    throw new Error(
      "Add firebase-service-account.json or FIREBASE_ADMIN_SERVICE_ACCOUNT in .env.local"
    );
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const emails = argv.filter((a) => !a.startsWith("--"));
  const memberEmail = emails[0];
  const uplineEmail = emails[1];

  if (!memberEmail || !uplineEmail) {
    console.error(
      "Usage: npx tsx src/scripts/link-referral-upline.ts [--dry-run] <memberEmail> <uplineEmail>"
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
  const result = await assignMemberUpline(db, {
    memberUid: member.uid,
    uplineEmail,
    dryRun,
  });

  console.log("Pre-flight OK");
  console.log(`Member UID: ${result.member.id} (${result.member.displayName})`);
  console.log(`Upline UID: ${result.upline.id} (${result.upline.displayName})`);
  console.log(result.linked ? "Upline: linked" : "Upline: already linked");

  if (result.commissionChain.length > 0) {
    console.log(
      "Commission chain (L1–L5):",
      result.commissionChain
        .map((c) => `L${c.level} ${c.email}: ${formatPeso(c.amount)}`)
        .join(" → ")
    );
  }

  if (dryRun) {
    console.log("\nDry run complete. No changes written.");
    return;
  }

  console.log(
    `Commissions: ${result.botsCommissioned} applied, ${result.botsSkipped} skipped`
  );
  console.log("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
