/**
 * Backfill daysAccrued and termDays on existing bot subscriptions.
 * Run: npx tsx src/scripts/backfill-bot-days.ts
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { BOT_TERM_DAYS, dailyPayout } from "../lib/investments";

const serviceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
if (!serviceAccount) {
  console.error("Set FIREBASE_ADMIN_SERVICE_ACCOUNT env var");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
}

const db = getFirestore();

async function backfill() {
  const botsSnap = await db.collectionGroup("bots").get();
  let updated = 0;

  for (const doc of botsSnap.docs) {
    const data = doc.data();
    const needsDaysAccrued = typeof data.daysAccrued !== "number";
    const needsTermDays = typeof data.termDays !== "number";

    if (!needsDaysAccrued && !needsTermDays) continue;

    const amount = data.amount ?? 0;
    const totalAccrued = data.totalAccrued ?? 0;
    const perDay = dailyPayout(amount);
    const inferred =
      perDay > 0
        ? Math.min(BOT_TERM_DAYS, Math.round(totalAccrued / perDay))
        : 0;

    await doc.ref.update({
      ...(needsDaysAccrued ? { daysAccrued: inferred } : {}),
      ...(needsTermDays ? { termDays: BOT_TERM_DAYS } : {}),
    });
    updated += 1;
  }

  console.log(`Backfilled ${updated} bot documents`);
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
