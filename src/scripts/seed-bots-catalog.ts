/**
 * Run after Firebase is configured:
 * npx tsx src/scripts/seed-bots-catalog.ts
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { BOTS_CATALOG_SEED } from "../lib/bots-catalog";

const serviceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
if (!serviceAccount) {
  console.error("Set FIREBASE_ADMIN_SERVICE_ACCOUNT env var");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
}

const db = getFirestore();

const LEGACY_BOT_IDS = [
  "alpha-vault",
  "precision-bot",
  "momentum-engine",
  "apex-trader",
];

async function seed() {
  for (const legacyId of LEGACY_BOT_IDS) {
    await db.collection("botsCatalog").doc(legacyId).delete().catch(() => {});
    console.log(`Removed legacy ${legacyId}`);
  }
  for (const bot of BOTS_CATALOG_SEED) {
    const { id, ...data } = bot;
    await db.collection("botsCatalog").doc(id).set(data);
    console.log(`Seeded ${id}`);
  }
  console.log("Done seeding botsCatalog");
}

seed().catch(console.error);
