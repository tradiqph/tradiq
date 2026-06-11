/**
 * Run one bot accrual pass (max one payout per due active bot).
 *
 * Usage:
 *   npm run accrual:run       # dry-run — list bots due for 24h+ payout
 *   npm run accrual:confirm   # execute accruals
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const botAccrualPath = resolve(__dirname, "../functions/lib/bot-accrual.js");
const requireFromFunctions = createRequire(botAccrualPath);
const { initializeApp, cert, getApps } = requireFromFunctions("firebase-admin/app");
const { getFirestore } = requireFromFunctions("firebase-admin/firestore");
const {
  runBotAccrualBatch,
  recordAccrualRun,
  isDueForAccrual,
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

async function summarizeActiveBots(db, now) {
  const botsSnap = await db
    .collectionGroup("bots")
    .where("status", "==", "active")
    .get();

  let notDueYet = 0;
  let waitingNextCycle = 0;

  for (const botDoc of botsSnap.docs) {
    const bot = botDoc.data();
    if (isDueForAccrual(bot, now)) continue;

    const lastAccruedAt = toDate(bot.lastAccruedAt);
    const daysAccrued = bot.daysAccrued ?? 0;
    if (daysAccrued > 0 || lastAccruedAt) {
      waitingNextCycle += 1;
    } else {
      notDueYet += 1;
    }
  }

  return {
    totalActive: botsSnap.size,
    notDueYet,
    waitingNextCycle,
  };
}

async function listDueBots(db, now) {
  const botsSnap = await db
    .collectionGroup("bots")
    .where("status", "==", "active")
    .get();

  const due = [];
  for (const botDoc of botsSnap.docs) {
    const bot = botDoc.data();
    if (!isDueForAccrual(bot, now)) continue;

    const userRef = botDoc.ref.parent.parent;
    if (!userRef) continue;

    const userSnap = await userRef.get();
    const email = userSnap.exists ? userSnap.data()?.email ?? userRef.id : userRef.id;
    const subscribedAt = toDate(bot.subscribedAt);
    const lastAccruedAt = toDate(bot.lastAccruedAt);
    const earning = Math.round((bot.amount ?? 0) * (bot.dailyRate ?? 0.03) * 100) / 100;

    due.push({
      botId: botDoc.id,
      userId: userRef.id,
      email,
      amount: bot.amount ?? 0,
      earning,
      daysAccrued: bot.daysAccrued ?? 0,
      subscribedAt: formatManila(subscribedAt),
      lastAccruedAt: formatManila(lastAccruedAt),
    });
  }
  return due;
}

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const env = loadEnv();
  const db = initAdmin(env);
  const now = new Date();

  const [dueBots, activeSummary] = await Promise.all([
    listDueBots(db, now),
    summarizeActiveBots(db, now),
  ]);

  if (dueBots.length === 0) {
    console.log("No active bots are due for accrual (24h+ since subscribe/last payout).");
    console.log(
      `Active bots: ${activeSummary.totalActive} — ${activeSummary.notDueYet} not yet 24h from subscribe, ${activeSummary.waitingNextCycle} waiting for next 24h cycle.`
    );
    return;
  }

  console.log(`Bots due for accrual: ${dueBots.length}\n`);
  for (const row of dueBots) {
    console.log(
      `- ${row.email} | bot ${row.botId} | principal ₱${row.amount.toLocaleString("en-PH")} | payout ₱${row.earning.toLocaleString("en-PH", { minimumFractionDigits: 2 })} | day ${row.daysAccrued + 1}/30`
    );
    console.log(`  subscribed: ${row.subscribedAt} | last accrual: ${row.lastAccruedAt}`);
  }

  console.log(
    `\nSkipped: ${activeSummary.waitingNextCycle} already paid (waiting next 24h), ${activeSummary.notDueYet} not yet 24h from subscribe.`
  );

  if (!confirmed) {
    console.log("\nDry run only. Re-run with: npm run accrual:confirm");
    return;
  }

  console.log("\nProcessing accruals...");
  const summary = await runBotAccrualBatch(db, now);
  await recordAccrualRun(db, summary, "manual");
  console.log(`Done. due=${summary.dueCount} processed=${summary.processedCount}`);

  for (const result of summary.results) {
    if (result.processed) {
      console.log(
        `  ✓ bot ${result.botId} user ${result.userId} +₱${result.earning?.toFixed(2)} (day ${result.newDaysAccrued})`
      );
    } else {
      console.log(`  ✗ bot ${result.botId} skipped: ${result.reason}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
