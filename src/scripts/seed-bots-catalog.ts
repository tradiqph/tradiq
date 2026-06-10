/**
 * Run after Firebase is configured:
 * npx tsx src/scripts/seed-bots-catalog.ts
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, cert, getApps, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { BOTS_CATALOG_SEED } from "../lib/bots-catalog";

function loadServiceAccount(): ServiceAccount {
  const candidates = [
    process.env.FIREBASE_ADMIN_CREDENTIALS_PATH,
    join(process.cwd(), "firebase-service-account.json"),
    join(process.cwd(), "service-account.json"),
  ].filter((p): p is string => Boolean(p));

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    return JSON.parse(readFileSync(filePath, "utf8")) as ServiceAccount;
  }

  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (raw && raw.length > 20) {
    return JSON.parse(raw) as ServiceAccount;
  }

  console.error(
    "Missing credentials. Add firebase-service-account.json or FIREBASE_ADMIN_SERVICE_ACCOUNT."
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
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
