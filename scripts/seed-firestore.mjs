/**
 * Seed TradIQ Firestore database.
 *
 * Prerequisites:
 * 1. Firestore database created (billing enabled on GCP project)
 * 2. FIREBASE_ADMIN_SERVICE_ACCOUNT set in .env.local OR `firebase login` + ADC
 *
 * Run: npm run seed:firestore
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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

const env = loadEnv();
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tradiq-f4962";

function initAdmin() {
  if (getApps().length) return getFirestore();

  const raw = env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (!raw) {
    throw new Error(
      "FIREBASE_ADMIN_SERVICE_ACCOUNT is missing in .env.local.\n\n" +
        "Fix:\n" +
        "1. Firebase Console → Project Settings → Service accounts\n" +
        "2. Click 'Generate new private key'\n" +
        "3. Paste the entire JSON as one line in .env.local:\n" +
        '   FIREBASE_ADMIN_SERVICE_ACCOUNT={"type":"service_account",...}\n\n' +
        "Or run: npx firebase login && set GOOGLE_APPLICATION_CREDENTIALS to the key file path."
    );
  }

  initializeApp({
    credential: cert(JSON.parse(raw)),
    projectId,
  });
  return getFirestore();
}

const LEGACY_BOT_IDS = [
  "alpha-vault",
  "precision-bot",
  "momentum-engine",
  "apex-trader",
];

const BOTS_CATALOG = [
  {
    id: "aurum-pulse",
    name: "Aurum Pulse",
    strategy: "Scalp · High-frequency",
    description:
      "Rapid-entry signal bot tuned for short bursts on trending Solana pairs. Prioritizes tight stops and quick profit locks.",
    rank: 1,
    winRate: 98,
    pnl: "+$3.92M",
    volume: "$612.8M",
    trades: "481.2K",
    avgHold: "18m",
    isActive: false,
    avatarUrl: "/assets/bot-alpha-vault.png",
    walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuZZosgP9",
    weeklyPnl: "+$142K",
    lastSignal: "2m ago",
  },
  {
    id: "nexus-quant",
    name: "Nexus Quant",
    strategy: "Grid · Range-bound",
    description:
      "Systematic grid strategy that harvests volatility inside established price bands. Best in sideways markets.",
    rank: 2,
    winRate: 97,
    pnl: "+$2.44M",
    volume: "$388.5M",
    trades: "296.7K",
    avgHold: "32m",
    isActive: false,
    avatarUrl: "/assets/bot-precision.png",
    walletAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    weeklyPnl: "+$89K",
    lastSignal: "8m ago",
  },
  {
    id: "velocity-core",
    name: "Velocity Core",
    strategy: "Momentum · Trend",
    description:
      "Follows breakout momentum across mid-cap tokens. Enters on volume spikes and trails winners with dynamic exits.",
    rank: 3,
    winRate: 94,
    pnl: "+$1.67M",
    volume: "$271.3M",
    trades: "218.4K",
    avgHold: "1h 12m",
    isActive: false,
    avatarUrl: "/assets/bot-momentum.png",
    walletAddress: "DYw8jCTfwHNRJhhmFcbXvVDVqLU5oHpD5hG8kW2jE1wX",
    weeklyPnl: "+$61K",
    lastSignal: "14m ago",
  },
  {
    id: "vertex-flow",
    name: "Vertex Flow",
    strategy: "Multi-signal · Auto-switch",
    description:
      "TradIQ's flagship engine — rotates between top signals in real time and auto-calibrates to the strongest performer.",
    rank: 4,
    winRate: 99,
    pnl: "+$4.11M",
    volume: "$589.2M",
    trades: "367.9K",
    avgHold: "41m",
    isActive: true,
    avatarUrl: "/assets/bot-apex.png",
    walletAddress: "HN7cABqLq46Es1jh92dQQisAq662SmxAU7gSWZDZg5Jk",
    weeklyPnl: "+$178K",
    lastSignal: "Just now",
  },
];

const PLATFORM_CONFIG = {
  dailyBotRate: 0.03,
  referralRates: [0.05, 0.02, 0.01],
  depositPresets: [500, 1000, 3000, 5000, 10000],
  botPresets: [500, 1000, 3000, 5000, 10000],
  currency: "PHP",
  minDeposit: 100,
  maxWithdrawalAccounts: 3,
  smartWalletEngine: {
    walletCount: 4,
    avgWinRate: 95.9,
    tagline: "Auto-Calibrating",
  },
  seededAt: FieldValue.serverTimestamp(),
  version: 1,
};

async function seed() {
  console.log(`Seeding Firestore for project: ${projectId}`);
  const db = initAdmin();

  // Platform config
  await db.collection("appConfig").doc("platform").set(PLATFORM_CONFIG, { merge: true });
  console.log("✓ appConfig/platform");

  // Bot catalog — remove legacy Coppii-style entries
  for (const legacyId of LEGACY_BOT_IDS) {
    await db.collection("botsCatalog").doc(legacyId).delete().catch(() => {});
    console.log(`✓ removed legacy botsCatalog/${legacyId}`);
  }

  for (const bot of BOTS_CATALOG) {
    const { id, ...data } = bot;
    await db.collection("botsCatalog").doc(id).set(
      { ...data, seededAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log(`✓ botsCatalog/${id}`);
  }

  // Schema marker (documents created on first use)
  await db.collection("_meta").doc("schema").set(
    {
      version: 1,
      collections: [
        "users",
        "botsCatalog",
        "deposits",
        "withdrawalRequests",
        "appConfig",
      ],
      seededAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log("✓ _meta/schema");

  console.log("\nSeed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  if (err.message?.includes("does not exist")) {
    console.error(
      "\nFirestore database not created yet. Enable billing and create the database:"
    );
    console.error("  https://console.firebase.google.com/project/tradiq-f4962/firestore");
    console.error("  Or run: npx firebase firestore:databases:create --location=asia-southeast1");
  }
  process.exit(1);
});
