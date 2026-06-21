import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Firestore } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { reconcileUplineReferralMemberCounts } from "@/lib/admin-calculations";
import { getAdminDb } from "@/lib/firebase/admin";
import { trackReferralSignup } from "@/lib/referral-payout";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { referralCodeSchema } from "@/lib/security/validation";

function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function parseReferralCode(raw: string | undefined): string | null {
  if (!raw) return null;
  const normalized = normalizeReferralCode(raw);
  const parsed = referralCodeSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}

async function resolveReferrerUid(
  db: Firestore,
  code: string
): Promise<string | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const snap = await db
    .collection("users")
    .where("referralCode", "==", normalized)
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
      const parsed = parseReferralCode(body.referralCode);
      if (!parsed) {
        return apiBadRequest("Invalid referral code format");
      }
      referralCode = parsed;
    }
  } catch {
    // Empty body is fine — may retry with stored signupReferralCode
  }

  try {
    const userRef = db.collection("users").doc(decoded.uid);
    let userSnap = await userRef.get();
    if (!userSnap.exists) {
      return apiBadRequest("User profile not found");
    }

    let userData = userSnap.data()!;
    const storedCode =
      typeof userData.signupReferralCode === "string"
        ? parseReferralCode(userData.signupReferralCode)
        : null;

    const codeToResolve = referralCode ?? storedCode ?? undefined;
    const hadReferralCode = Boolean(codeToResolve);

    if (!userData.referredBy && codeToResolve) {
      const referrerUid = await resolveReferrerUid(db, codeToResolve);
      if (referrerUid && referrerUid !== decoded.uid) {
        await userRef.update({
          referredBy: referrerUid,
          signupReferralCode: codeToResolve,
        });
        userSnap = await userRef.get();
        userData = userSnap.data()!;
      } else if (referrerUid === decoded.uid) {
        await userRef.update({ signupReferralCode: FieldValue.delete() });
      } else {
        await userRef.update({ signupReferralCode: codeToResolve });
      }
    } else if (hadReferralCode && !userData.signupReferralCode && codeToResolve) {
      await userRef.update({ signupReferralCode: codeToResolve });
    }

    // Repair accounts that were marked tracked before referredBy was linked
    const latest = (await userRef.get()).data()!;
    if (
      latest.referralNetworkTracked &&
      !latest.referredBy &&
      hadReferralCode
    ) {
      await userRef.update({ referralNetworkTracked: false });
    }

    await trackReferralSignup(db, decoded.uid, { hadReferralCode });

    const finalSnap = await userRef.get();
    const referredBy = (finalSnap.data()?.referredBy as string | undefined) ?? null;
    if (referredBy) {
      await reconcileUplineReferralMemberCounts(db, referredBy);
    }

    return NextResponse.json({
      success: true,
      referredBy,
      tracked: Boolean(finalSnap.data()?.referralNetworkTracked),
    });
  } catch (e) {
    return apiError("referral/on-signup", e, 500, "Failed to process referral");
  }
}
