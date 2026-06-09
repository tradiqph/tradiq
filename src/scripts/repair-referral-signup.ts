/**
 * One-time repair: link referredBy from signupReferralCode and increment upline member counts.
 *
 * Usage: npx tsx src/scripts/repair-referral-signup.ts [userEmail]
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { trackReferralSignup } from "../lib/referral-payout";

function loadServiceAccount() {
  const path = join(process.cwd(), "firebase-service-account.json");
  if (!existsSync(path)) {
    throw new Error("firebase-service-account.json not found");
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const emailArg = process.argv[2];
  const referralCodeArg = process.argv[3]?.trim().toUpperCase();
  const sa = loadServiceAccount();
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert(sa),
          projectId: sa.project_id,
        });

  const db = getFirestore(app);

  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  if (emailArg) {
    const snap = await db
      .collection("users")
      .where("email", "==", emailArg)
      .get();
    docs = snap.docs;
  } else {
    const snap = await db.collection("users").get();
    docs = snap.docs.filter((d) => {
      const data = d.data();
      return (
        data.signupReferralCode ||
        (data.referredBy && !data.referralNetworkTracked)
      );
    });
  }

  console.log(`Found ${docs.length} user(s) to inspect`);

  for (const doc of docs) {
    const data = doc.data();
    const code =
      (data.signupReferralCode as string | undefined) ?? referralCodeArg;
    if (!code && !data.referredBy && !emailArg) continue;

    let referredBy = data.referredBy as string | null | undefined;
    if (!referredBy && code) {
      const refSnap = await db
        .collection("users")
        .where("referralCode", "==", code.trim().toUpperCase())
        .limit(1)
        .get();
      if (!refSnap.empty) {
        referredBy = refSnap.docs[0].id;
        await doc.ref.update({ referredBy });
        console.log(`Linked ${data.email} -> ${referredBy}`);
      }
    }

    if (referredBy) {
      await doc.ref.update({ referralNetworkTracked: false });
      await trackReferralSignup(db, doc.id, {
        hadReferralCode: Boolean(code || referredBy),
      });
      console.log(`Tracked signup for ${data.email}`);
    }
  }

  console.log("Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
