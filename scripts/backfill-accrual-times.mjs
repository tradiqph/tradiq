/**
 * Backfill lastAccruedAt to subscription-aligned slot times (display only — no payouts).
 *
 * Usage:
 *   npm run accrual:backfill           # dry-run
 *   npm run accrual:backfill -- --confirm   # write timestamps
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const botAccrualPath = resolve(__dirname, "../functions/lib/bot-accrual.js");
const requireFromFunctions = createRequire(botAccrualPath);
const { initializeApp, cert, getApps } = requireFromFunctions("firebase-admin/app");
const { getFirestore, Timestamp } = requireFromFunctions("firebase-admin/firestore");
const {
  getScheduledPayoutAt,
  inferDaysAccrued,
  toDate,
} = requireFromFunctions("./bot-accrual.js");

const root = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

function formatManila(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function sameInstant(a, b, toleranceMs = 60_000) {
  if (!a || !b) return false;
  return Math.abs(a.getTime() - b.getTime()) <= toleranceMs;
}

async function listBotsToBackfill(db) {
  const botsSnap = await db.collectionGroup("bots").get();
  const rows = [];

  for (const botDoc of botsSnap.docs) {
    const bot = botDoc.data();
    if (bot.status !== "active") continue;

    const daysAccrued = inferDaysAccrued(bot);
    if (daysAccrued <= 0) continue;

    const subscribedAt = toDate(bot.subscribedAt);
    if (!subscribedAt) continue;

    const canonical = getScheduledPayoutAt(subscribedAt, daysAccrued);
    const current = toDate(bot.lastAccruedAt);

    if (sameInstant(current, canonical)) continue;

    const userRef = botDoc.ref.parent.parent;
    const email = userRef
      ? (await userRef.get()).data()?.email ?? userRef.id
      : "—";

    rows.push({
      ref: botDoc.ref,
      botId: botDoc.id,
      email,
      daysAccrued,
      subscribedAt: formatManila(subscribedAt),
      currentLastAccrued: formatManila(current),
      canonicalLastAccrued: formatManila(canonical),
      canonicalDate: canonical,
    });
  }

  return rows;
}

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const env = loadEnv();
  const db = initAdmin(env);

  const rows = await listBotsToBackfill(db);

  if (rows.length === 0) {
    console.log("No active bots need lastAccruedAt backfill.");
    return;
  }

  console.log(`Bots to backfill: ${rows.length}\n`);
  for (const row of rows) {
    console.log(
      `- ${row.email} | bot ${row.botId} | day ${row.daysAccrued}/30`
    );
    console.log(`  subscribed: ${row.subscribedAt}`);
    console.log(`  current lastAccruedAt: ${row.currentLastAccrued}`);
    console.log(`  canonical lastAccruedAt: ${row.canonicalLastAccrued}`);
  }

  if (!confirmed) {
    console.log("\nDry run only. Re-run with: npm run accrual:backfill -- --confirm");
    return;
  }

  console.log("\nWriting canonical lastAccruedAt timestamps...");
  let updated = 0;
  for (const row of rows) {
    await row.ref.update({
      lastAccruedAt: Timestamp.fromDate(row.canonicalDate),
    });
    updated += 1;
  }
  console.log(`Done. Updated ${updated} bot(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
