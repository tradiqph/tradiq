/**
 * Check referral commissions paid to upline from a member.
 * Usage: npx tsx src/scripts/check-referral-commissions.ts <memberEmail>
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadCredential() {
  const envPath = join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      if (trimmed.slice(0, eq) === "FIREBASE_ADMIN_SERVICE_ACCOUNT") {
        const val = trimmed.slice(eq + 1);
        if (val.length > 20) return JSON.parse(val);
      }
    }
  }
  return JSON.parse(
    readFileSync(join(process.cwd(), "firebase-service-account.json"), "utf8")
  );
}

async function main() {
  const memberEmail = process.argv[2];
  if (!memberEmail) {
    console.error("Usage: npx tsx src/scripts/check-referral-commissions.ts <memberEmail>");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredential()) });
  }
  const db = getFirestore();

  const memberSnap = await db
    .collection("users")
    .where("email", "==", memberEmail.trim().toLowerCase())
    .limit(1)
    .get();

  if (memberSnap.empty) {
    throw new Error(`User not found: ${memberEmail}`);
  }

  const member = memberSnap.docs[0];
  const uplineId = member.data().referredBy as string | null;

  const botsSnap = await member.ref.collection("bots").get();
  console.log(`Member: ${member.data().displayName} (${member.data().email})`);
  console.log(`referredBy: ${uplineId ?? "none"}`);
  console.log(`Bots: ${botsSnap.size}`);

  for (const botDoc of botsSnap.docs) {
    const bot = botDoc.data();
    console.log(
      `  - ${botDoc.id}: ${bot.status} amount=${bot.amount}`
    );
  }

  if (!uplineId) {
    console.log("No upline — no referral commissions expected.");
    return;
  }

  const uplineSnap = await db.collection("users").doc(uplineId).get();
  console.log(
    `Upline: ${uplineSnap.data()?.displayName} (${uplineSnap.data()?.email})`
  );

  const refTxSnap = await db
    .collection("users")
    .doc(uplineId)
    .collection("transactions")
    .where("type", "==", "referral")
    .get();

  const fromMember = refTxSnap.docs.filter(
    (doc) => doc.data().metadata?.fromUserId === member.id
  );

  console.log(`Referral commissions from member to upline: ${fromMember.length}`);
  for (const tx of fromMember) {
    const d = tx.data();
    console.log(
      `  - ${d.title}: ₱${d.amount} (botId=${d.metadata?.botId ?? "n/a"})`
    );
  }

  if (botsSnap.size > 0 && fromMember.length === 0) {
    console.log("\n=> Commission NOT applied for existing bot(s).");
  } else if (botsSnap.size === 0) {
    console.log("\n=> No bots yet — commission will apply on future subscription.");
  } else {
    console.log("\n=> Commission already applied.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
