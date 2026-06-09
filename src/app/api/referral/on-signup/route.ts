import { NextRequest, NextResponse } from "next/server";
import { Firestore } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { trackReferralSignup } from "@/lib/referral-payout";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { referralCodeSchema } from "@/lib/security/validation";

async function resolveReferrerUid(
  db: Firestore,
  code: string
): Promise<string | null> {
  const snap = await db
    .collection("users")
    .where("referralCode", "==", code)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  let referralCode: string | undefined;
  try {
    const body = await request.json();
    if (body?.referralCode && typeof body.referralCode === "string") {
      referralCode = body.referralCode.trim();
    }
  } catch {
    // Empty body is fine for users without a referral code
  }

  try {
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return apiBadRequest("User profile not found");
    }

    const userData = userSnap.data()!;

    if (!userData.referredBy && referralCode) {
      const parsed = referralCodeSchema.safeParse(referralCode);
      if (parsed.success) {
        const referrerUid = await resolveReferrerUid(db, parsed.data);
        if (referrerUid && referrerUid !== decoded.uid) {
          await userRef.update({ referredBy: referrerUid });
        }
      }
    }

    await trackReferralSignup(db, decoded.uid);
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError("referral/on-signup", e, 500, "Failed to process referral");
  }
}
